import re
from fastapi import APIRouter, HTTPException, Query
from typing import Optional

from backend.database import get_supabase
from backend.models.schemas import (
    RecipeDetailResponse,
    RecipeIngredient,
    RecipeStep,
)
import time
import asyncio
from fastapi.responses import StreamingResponse, JSONResponse
from backend.services.llm_service import generate_recipe_summary, generate_recipe_summary_stream

# ── 인메모리 요약 캐시 (recipe_id → summary 텍스트) ──
# 프롬프트 변경 시 서버 재시작하면 자동 카시 초기화
_summary_cache: dict[str, str] = {}
_summary_cache_ts: dict[str, float] = {}
_CACHE_TTL = 3600  # 1시간
_inflight_locks: dict[str, asyncio.Lock] = {}


def _cache_get(recipe_id: str) -> str | None:
    ts = _summary_cache_ts.get(recipe_id)
    if ts and time.time() - ts < _CACHE_TTL:
        return _summary_cache.get(recipe_id)
    return None


def _cache_set(recipe_id: str, summary: str):
    _summary_cache[recipe_id] = summary
    _summary_cache_ts[recipe_id] = time.time()

router = APIRouter(prefix="/recipes", tags=["Recipes"])


@router.get("/{recipe_id}/stream")
async def stream_recipe_summary(
    recipe_id: str,
    breed_id: Optional[str] = Query(None),
):
    """LLM 요약 - 캐시 우선(JSON) → 미스 시 SSE 스트리밍"""
    import logging
    logger = logging.getLogger("recipes.stream")
    t0 = time.perf_counter()

    # 1) 캐시 히트 → 즉시 JSON 반환 (TTFT=0)
    cache_key = f"{recipe_id}:{breed_id or ''}"
    cached = _cache_get(cache_key)
    if cached:
        logger.info(f"[TIMING] cache hit {recipe_id} {(time.perf_counter()-t0)*1000:.0f}ms")
        return JSONResponse({"status": "complete", "summary": cached, "cached": True})

    db = get_supabase()
    recipe_result = db.table("recipes").select("*").eq("id", recipe_id).execute()
    if not recipe_result.data:
        return JSONResponse({"error": "recipe not found"}, status_code=404)

    recipe = recipe_result.data[0]
    title = recipe.get("title") or recipe.get("title_ko") or ""

    ing_result = db.table("recipe_ingredients").select("name").eq("recipe_id", recipe_id).execute()
    ingredient_names = list({r["name"] for r in ing_result.data})

    target_diseases: list[str] = []
    for table_name in ("recipe_target_diseases", "recipe_diseases"):
        try:
            rd = db.table(table_name).select("diseases(name_ko)").eq("recipe_id", recipe_id).execute()
            target_diseases = [r["diseases"]["name_ko"] for r in rd.data if r.get("diseases")]
            break
        except Exception:
            continue

    breed_name_ko, breed_size = "사랑스러운 강아지", None
    if breed_id:
        br = db.table("breeds").select("name_ko, size_category").eq("id", breed_id).execute()
        if br.data:
            breed_name_ko = br.data[0].get("name_ko", breed_name_ko)
            breed_size = br.data[0].get("size_category")

    logger.info(f"[TIMING] db fetch done {(time.perf_counter()-t0)*1000:.0f}ms")

    # 2) 동일 recipe_id 동시 요청 dedupe
    if cache_key not in _inflight_locks:
        _inflight_locks[cache_key] = asyncio.Lock()

    async def sse_generator():
        async with _inflight_locks[cache_key]:
            # 락 획득 후 다시 캐시 확인 (dedupe)
            cached2 = _cache_get(cache_key)
            if cached2:
                escaped = cached2.replace("\n", "\\n")
                yield f"data: {escaped}\n\n"
                yield "data: [DONE]\n\n"
                return

            full_chunks: list[str] = []
            first_token = True
            async for token in generate_recipe_summary_stream(
                recipe_title_ko=title,
                ingredient_names=ingredient_names,
                breed_name_ko=breed_name_ko,
                breed_size=breed_size,
                disease_names=target_diseases,
            ):
                if first_token:
                    logger.info(f"[TIMING] first token {(time.perf_counter()-t0)*1000:.0f}ms")
                    first_token = False
                full_chunks.append(token)
                escaped = token.replace("\n", "\\n")
                yield f"data: {escaped}\n\n"

            # 완성 후 캐시 저장
            full_text = "".join(full_chunks)
            _cache_set(cache_key, full_text)
            logger.info(f"[TIMING] stream done, cached. total={( time.perf_counter()-t0)*1000:.0f}ms")
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/{recipe_id}", response_model=RecipeDetailResponse)
async def get_recipe(
    recipe_id: str,
    breed_id: Optional[str] = Query(None, description="품종 ID (LLM 안내 생성용)"),
):
    db = get_supabase()

    # ── Get recipe ──
    recipe_result = db.table("recipes").select("*").eq("id", recipe_id).execute()
    if not recipe_result.data:
        raise HTTPException(status_code=404, detail="RECIPE_NOT_FOUND")

    recipe = recipe_result.data[0]
    title = recipe.get("title") or recipe.get("title_ko") or recipe.get("title_en") or ""

    # Get ingredients
    ing_result = (
        db.table("recipe_ingredients")
        .select("name, amount, sort_order, calories_per_100g, calories_small, calories_medium, calories_large")
        .eq("recipe_id", recipe_id)
        .order("sort_order")
        .execute()
    )
    ingredients = [
        RecipeIngredient(
            name=r["name"],
            amount=r.get("amount"),
            sort_order=r.get("sort_order", 0),
            calories_per_100g=r.get("calories_per_100g", 0),
            calories_small=r.get("calories_small", 0),
            calories_medium=r.get("calories_medium", 0),
            calories_large=r.get("calories_large", 0),
        )
        for r in ing_result.data
    ]

    # ── Get steps (select * to handle both v1 instruction / v2 description) ──
    steps: list[RecipeStep] = []
    try:
        steps_result = (
            db.table("recipe_steps")
            .select("*")
            .eq("recipe_id", recipe_id)
            .order("step_number")
            .execute()
        )
        steps = [
            RecipeStep(
                step_number=r["step_number"],
                instruction=r.get("instruction") or r.get("description") or "",
            )
            for r in steps_result.data
        ]
    except Exception:
        pass

    # ── Get target diseases ──
    target_diseases: list[str] = []
    for table_name in ("recipe_target_diseases", "recipe_diseases"):
        try:
            rd_result = (
                db.table(table_name)
                .select("diseases(name_ko, name_en)")
                .eq("recipe_id", recipe_id)
                .execute()
            )
            target_diseases = [
                rd["diseases"]["name_ko"] or rd["diseases"]["name_en"]
                for rd in rd_result.data
                if rd.get("diseases") and (rd["diseases"].get("name_ko") or rd["diseases"].get("name_en"))
            ]
            break
        except Exception:
            continue

    # ── size_category 기반 칼로리 계산 ──
    size_category = None
    calories_by_size: Optional[int] = recipe.get("calories_per_serving")

    if breed_id:
        breed_result = db.table("breeds").select("name_ko, size_category").eq("id", breed_id).execute()
        if breed_result.data:
            breed = breed_result.data[0]
            size_category = breed.get("size_category")  # small / medium / large / giant

            # 재료별 칼로리 합산 (size 기준, 중복 재료 제거)
            size_col = {
                "small": "calories_small",
                "medium": "calories_medium",
                "large": "calories_large",
                "giant": "calories_large",
            }.get(size_category, "calories_medium")

            # 같은 이름 재료 중복 제거 후 합산
            seen = {}
            for ing in ingredients:
                if ing.name not in seen:
                    seen[ing.name] = getattr(ing, size_col, 0) or 0
            total = sum(seen.values())
            if total > 0:
                calories_by_size = total

    # ── LLM summary ──
    summary = None
    if breed_id:
        breed_result2 = db.table("breeds").select("name_ko, size_category").eq("id", breed_id).execute()
        if breed_result2.data:
            breed = breed_result2.data[0]
            summary = await generate_recipe_summary(
                recipe_title_ko=title,
                ingredient_names=[ing.name for ing in ingredients],
                breed_name_ko=breed["name_ko"],
                breed_size=breed.get("size_category"),
                disease_names=target_diseases,
            )

    # ── LLM 재료 g수 파싱 → 칼로리 재계산 ──
    if summary and calories_by_size is not None:
        # 재료 칼로리 인덱스 (name -> calories_per_100g)
        cal_index = {ing.name: ing.calories_per_100g for ing in ingredients if ing.calories_per_100g > 0}

        # LLM 응답에서 ### 재료 섹션 파싱
        # 예: "- 연어: 150g", "- 블루베리: 50g"
        section_match = re.search(r'###\s*재료\s*\n(.*?)(?=###|$)', summary, re.DOTALL)
        if section_match:
            section = section_match.group(1)
            llm_cal_total = 0
            found = False
            for line in section.split('\n'):
                # "- 재료명: 숫자g" 또는 "- 재료명: 숫자~숫자g" 패턴
                m = re.search(r'[\-•]?\s*([가-힣a-zA-Z\s]+?)\s*:\s*(\d+)(?:~(\d+))?\s*g', line)
                if m:
                    name = m.group(1).strip()
                    g1 = int(m.group(2))
                    g2 = int(m.group(3)) if m.group(3) else g1
                    avg_g = (g1 + g2) / 2

                    # 재료명으로 칼로리 검색 (부분 일치)
                    matched_cal = 0
                    for ing_name, cal in cal_index.items():
                        if ing_name in name or name in ing_name:
                            matched_cal = cal
                            break

                    if matched_cal > 0 and avg_g > 0:
                        llm_cal_total += int(matched_cal * avg_g / 100)
                        found = True

            if found and llm_cal_total > 0:
                calories_by_size = llm_cal_total

    return RecipeDetailResponse(
        recipe_id=recipe["id"],
        title=title,
        description=recipe.get("description"),
        calories_per_serving=calories_by_size,
        cook_time_min=recipe.get("cook_time_min"),
        difficulty=recipe.get("difficulty"),
        servings=recipe.get("servings", 1),
        image_url=recipe.get("image_url"),
        source_name=recipe.get("source_name"),
        source_url=recipe.get("source_url"),
        ingredients=ingredients,
        steps=steps,
        target_diseases=target_diseases,
        summary=summary,
    )
