"""
Recommendations API v3
Debate Chain 3-AI 리뷰 결과 적용 (8.0/10 수렴)
- 테이블 감지 lifespan 캐싱
- PostgrestAPIError 특화 에러 처리
- 쿼리 제한 + 관련성 기반 랭킹
- 방어적 필드 접근 (_safe_str/_opt_str)
- LLM 타임아웃 처리
"""
import asyncio
import json
import logging
import re
from collections import defaultdict
from contextlib import asynccontextmanager
from dataclasses import dataclass
from typing import Any

import time
from fastapi import APIRouter, HTTPException, Query
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import StreamingResponse, JSONResponse
from postgrest.exceptions import APIError as PostgrestAPIError
from pydantic import BaseModel

from backend.database import get_supabase
from backend.models.schemas import (
    FoodCard,
    IngredientInDisease,
    NutrientItem,
    RecipeCard,
    RecommendationResponse,
)
from backend.services.llm_service import generate_summary, generate_summary_stream

# ── summary 인메모리 캐시 (breed_id → summary) ──
_summary_cache: dict[str, str] = {}
_summary_cache_ts: dict[str, float] = {}
_SUMMARY_CACHE_TTL = 3600
_summary_locks: dict[str, asyncio.Lock] = {}


def _scache_get(key: str) -> str | None:
    ts = _summary_cache_ts.get(key)
    if ts and time.time() - ts < _SUMMARY_CACHE_TTL:
        return _summary_cache.get(key)
    return None


def _scache_set(key: str, val: str):
    _summary_cache[key] = val
    _summary_cache_ts[key] = time.time()

logger = logging.getLogger(__name__)

MAX_RECIPES = 20
MAX_FOODS = 50
MAX_INGREDIENTS_PER_DISEASE = 30
SUMMARY_TIMEOUT_SECONDS = 10


# ─── 테이블 설정 캐싱 (lifespan 초기화) ───

@dataclass(frozen=True)
class TableConfig:
    has_foods: bool
    recipe_diseases_table: str


_table_config: TableConfig | None = None


def _table_exists(db: Any, table_name: str) -> bool:
    try:
        db.table(table_name).select("id", count="exact").limit(0).execute()
        return True
    except PostgrestAPIError as exc:
        code = getattr(exc, "code", "") or ""
        message = str(exc).lower()
        if "relation" in message and "does not exist" in message:
            logger.info("Table %s does not exist", table_name)
            return False
        if code in ("PGRST204", "PGRST205", "42P01"):
            logger.info("Table %s not found (code=%s)", table_name, code)
            return False
        logger.error("Unexpected DB error probing table %s: %s", table_name, exc)
        raise


def _get_table_config() -> TableConfig:
    if _table_config is None:
        raise RuntimeError("TableConfig not initialized — call init_table_config() at startup")
    return _table_config


def init_table_config() -> None:
    global _table_config
    db = get_supabase()
    has_foods = _table_exists(db, "foods")
    has_target = _table_exists(db, "recipe_target_diseases")
    _table_config = TableConfig(
        has_foods=has_foods,
        recipe_diseases_table="recipe_target_diseases" if has_target else "recipe_diseases",
    )
    logger.info("TableConfig initialized: %s", _table_config)


@asynccontextmanager
async def lifespan(app: Any):
    await run_in_threadpool(init_table_config)
    yield


# ─── 유틸리티: 방어적 필드 접근 ───

def _safe_str(row: dict, key: str, fallback_key: str | None = None) -> str:
    val = row.get(key)
    if val is not None:
        return str(val)
    if fallback_key is not None:
        val = row.get(fallback_key)
        if val is not None:
            return str(val)
    raise ValueError(f"Missing required field '{key}' in row: {list(row.keys())}")


def _opt_str(row: dict, key: str, fallback_key: str | None = None) -> str:
    val = row.get(key)
    if val is not None:
        return str(val)
    if fallback_key is not None:
        val = row.get(fallback_key)
        if val is not None:
            return str(val)
    return ""


# ─── 질병 데이터 빌더 ───

def _build_disease_map(
    bd_data: list[dict],
) -> tuple[list[str], list[str], dict[str, dict]]:
    disease_ids: list[str] = []
    disease_names: list[str] = []
    disease_map: dict[str, dict] = {}
    for bd in bd_data:
        d = bd.get("diseases")
        if not d or "id" not in d:
            continue
        did = str(d["id"])
        if did in disease_map:
            continue
        disease_ids.append(did)
        name = _opt_str(d, "name_ko", "name_en")
        disease_names.append(name)
        disease_map[did] = {
            "name_ko": name,
            "severity": d.get("severity", "medium"),
        }
    return disease_ids, disease_names, disease_map


# ─── 영양소 탭 ───

def _fetch_disease_ingredients(db: Any, disease_ids: list[str]) -> list[dict]:
    all_data: list[dict] = []
    select_full = (
        "disease_id, ingredient_id, effect_description, priority, "
        "ingredients(id, name_ko, name_en)"
    )
    select_fallback = (
        "disease_id, ingredient_id, priority, ingredients(id, name_ko, name_en)"
    )
    use_fallback = False

    for did in disease_ids:
        fields = select_fallback if use_fallback else select_full
        try:
            result = (
                db.table("disease_ingredients")
                .select(fields)
                .eq("disease_id", did)
                .order("priority")
                .limit(MAX_INGREDIENTS_PER_DISEASE)
                .execute()
            )
            all_data.extend(result.data)
        except PostgrestAPIError as exc:
            if not use_fallback and "effect_description" in str(exc):
                logger.warning("Falling back to select without effect_description")
                use_fallback = True
                result = (
                    db.table("disease_ingredients")
                    .select(select_fallback)
                    .eq("disease_id", did)
                    .order("priority")
                    .limit(MAX_INGREDIENTS_PER_DISEASE)
                    .execute()
                )
                all_data.extend(result.data)
            else:
                raise
    return all_data


def _build_nutrient_tabs(
    di_data: list[dict], disease_map: dict[str, dict]
) -> list[NutrientItem]:
    disease_ingredients: dict[str, list[IngredientInDisease]] = defaultdict(list)
    for di in di_data:
        ing = di.get("ingredients")
        if not ing or "id" not in ing:
            continue
        did = str(di["disease_id"])
        disease_ingredients[did].append(
            IngredientInDisease(
                ingredient_id=str(ing["id"]),
                name_ko=_opt_str(ing, "name_ko", "name_en"),
                effect_description=di.get("effect_description"),
                priority=di.get("priority", 1),
            )
        )
    return [
        NutrientItem(
            disease_name_ko=info["name_ko"],
            severity=info["severity"],
            recommended_ingredients=disease_ingredients.get(did, []),
        )
        for did, info in disease_map.items()
    ]


# ─── 음식 탭 (관련성 랭킹) ───

def _build_ingredient_name_index(di_data: list[dict]) -> dict[str, str]:
    index: dict[str, str] = {}
    for di in di_data:
        ing = di.get("ingredients")
        if ing and "id" in ing:
            index[str(ing["id"])] = _opt_str(ing, "name_ko", "name_en")
    return index


def _fetch_food_tabs(
    db: Any, ingredient_name_index: dict[str, str]
) -> list[FoodCard]:
    ingredient_ids = list(ingredient_name_index.keys())
    if not ingredient_ids:
        return []

    fi_result = (
        db.table("food_ingredients")
        .select(
            "food_id, ingredient_id, "
            "foods(id, name_en, name_ko, category, image_url)"
        )
        .in_("ingredient_id", ingredient_ids)
        .execute()
    )

    food_data: dict[str, dict] = {}
    for fi in fi_result.data:
        f = fi.get("foods")
        if not f or "id" not in f:
            continue
        fid = str(f["id"])
        if fid not in food_data:
            food_data[fid] = {"food": f, "ingredient_names": set()}
        ing_id = str(fi["ingredient_id"])
        name = ingredient_name_index.get(ing_id)
        if name:
            food_data[fid]["ingredient_names"].add(name)

    # 관련 영양소 매칭 수 기준 랭킹
    ranked = sorted(
        food_data.items(),
        key=lambda item: len(item[1]["ingredient_names"]),
        reverse=True,
    )[:MAX_FOODS]

    food_ids = [fid for fid, _ in ranked]
    recipe_by_food: dict[str, list[str]] = defaultdict(list)
    if food_ids:
        try:
            rf_result = (
                db.table("recipe_foods")
                .select("food_id, recipe_id")
                .in_("food_id", food_ids)
                .execute()
            )
            for rf in rf_result.data:
                recipe_by_food[str(rf["food_id"])].append(str(rf["recipe_id"]))
        except Exception:
            logger.warning("Failed to fetch recipe_foods", exc_info=True)

    return [
        FoodCard(
            food_id=fid,
            name_ko=_opt_str(fd["food"], "name_ko", "name_en"),
            category=fd["food"].get("category"),
            image_url=fd["food"].get("image_url"),
            related_ingredients=sorted(fd["ingredient_names"]),
            recipe_ids=recipe_by_food.get(fid, []),
        )
        for fid, fd in ranked
    ]


# ─── 레시피 (질병 수 + 심각도 랭킹) ───

def _fetch_recipes(
    db: Any,
    recipe_diseases_table: str,
    disease_ids: list[str],
    disease_map: dict[str, dict],
) -> list[RecipeCard]:
    try:
        rd_result = (
            db.table(recipe_diseases_table)
            .select(
                "recipe_id, disease_id, "
                "recipes(id, title_ko, title_en, description, difficulty, cook_time_min)"
            )
            .in_("disease_id", disease_ids)
            .execute()
        )
    except Exception:
        logger.warning("Failed to fetch from %s", recipe_diseases_table, exc_info=True)
        return []

    seen: dict[str, dict] = {}
    for rd in rd_result.data:
        r = rd.get("recipes")
        if not r or "id" not in r:
            continue
        rid = str(r["id"])
        if rid not in seen:
            seen[rid] = {"recipe": r, "disease_ids": set()}
        seen[rid]["disease_ids"].add(str(rd["disease_id"]))

    severity_rank = {"high": 3, "medium": 2, "low": 1}

    def _relevance(info: dict) -> tuple[int, int]:
        matched = info["disease_ids"]
        count = len(matched)
        max_sev = max(
            (severity_rank.get(disease_map.get(d, {}).get("severity", "medium"), 2) for d in matched),
            default=0,
        )
        return (count, max_sev)

    ranked = sorted(seen.values(), key=_relevance, reverse=True)[:MAX_RECIPES]

    return [
        RecipeCard(
            recipe_id=str(info["recipe"]["id"]),
            title=(
                info["recipe"].get("title")
                or info["recipe"].get("title_ko")
                or info["recipe"].get("title_en")
                or ""
            ),
            description=info["recipe"].get("description"),
            difficulty=info["recipe"].get("difficulty"),
            cook_time_min=info["recipe"].get("cook_time_min"),
            target_diseases=[
                disease_map[did]["name_ko"]
                for did in info["disease_ids"]
                if did in disease_map
            ],
        )
        for info in ranked
    ]


# ─── 동기 DB 작업 (run_in_threadpool) ───

def _sync_get_recommendations(breed_id: str) -> dict:
    db = get_supabase()
    cfg = _get_table_config()

    breed_result = (
        db.table("breeds")
        .select("id, name_ko, size_category")
        .eq("id", breed_id)
        .execute()
    )
    if not breed_result.data:
        raise HTTPException(status_code=404, detail="BREED_NOT_FOUND")

    breed = breed_result.data[0]
    try:
        breed_name_ko = _safe_str(breed, "name_ko")
    except ValueError:
        logger.error("breeds row missing name_ko for id=%s", breed_id)
        raise HTTPException(status_code=502, detail="MALFORMED_BREED_DATA")

    summary = breed.get("summary") or ""

    bd_result = (
        db.table("breed_diseases")
        .select("disease_id, risk_level, diseases(id, name_en, name_ko, severity)")
        .eq("breed_id", breed_id)
        .execute()
    )
    disease_ids, disease_names, disease_map = _build_disease_map(bd_result.data)

    tab_nutrients: list[NutrientItem] = []
    tab_foods: list[FoodCard] = []
    recipes: list[RecipeCard] = []

    if disease_ids:
        di_data = _fetch_disease_ingredients(db, disease_ids)
        tab_nutrients = _build_nutrient_tabs(di_data, disease_map)

        if cfg.has_foods:
            ingredient_name_index = _build_ingredient_name_index(di_data)
            try:
                tab_foods = _fetch_food_tabs(db, ingredient_name_index)
            except Exception:
                logger.warning("Failed to build food tabs", exc_info=True)

        recipes = _fetch_recipes(
            db, cfg.recipe_diseases_table, disease_ids, disease_map
        )

    return {
        "breed_name_ko": breed_name_ko,
        "summary": summary,
        "breed": breed,
        "disease_names": disease_names,
        "tab_nutrients": tab_nutrients,
        "tab_foods": tab_foods,
        "recipes": recipes,
    }


# ─── 라우터 ───

router = APIRouter(prefix="/recommendations", tags=["Recommendations"])


@router.get("", response_model=RecommendationResponse)
async def get_recommendations(
    breed_id: str = Query(
        ...,
        description="Breed ID (required)",
        min_length=1,
        max_length=64,
        pattern=r"^[a-zA-Z0-9_-]+$",
    ),
):
    """DB 데이터만 즉시 반환 (LLM summary 제외 → 빠름)"""
    data = await run_in_threadpool(_sync_get_recommendations, breed_id)

    return RecommendationResponse(
        breed_name_ko=data["breed_name_ko"],
        summary="",  # summary는 /summary 엔드포인트에서 별도 요청
        tab_nutrients=data["tab_nutrients"],
        tab_foods=data["tab_foods"],
        recipes=data["recipes"],
    )


class SummaryResponse(BaseModel):
    summary: str


@router.get("/summary/stream")
async def stream_summary(
    breed_id: str = Query(..., min_length=1, max_length=64, pattern=r"^[a-zA-Z0-9_-]+$"),
):
    """수상 요약 SSE 스트리밍 - 캐시 히트 시 JSON, 미스 시 SSE"""
    t0 = time.perf_counter()

    # 캐시 히트 → 즉시 JSON
    cached = _scache_get(breed_id)
    if cached:
        return JSONResponse({"status": "complete", "summary": cached, "cached": True})

    data = await run_in_threadpool(_sync_get_recommendations, breed_id)

    if breed_id not in _summary_locks:
        _summary_locks[breed_id] = asyncio.Lock()

    async def sse_gen():
        async with _summary_locks[breed_id]:
            cached2 = _scache_get(breed_id)
            if cached2:
                escaped = cached2.replace("\n", "\\n")
                yield f"data: {escaped}\n\n"
                yield "data: [DONE]\n\n"
                return

            chunks: list[str] = []
            first = True
            async for token in generate_summary_stream(
                breed_name_ko=data["breed_name_ko"],
                breed_size=data["breed"].get("size_category"),
                disease_names=data["disease_names"],
                recipe_titles=[r.title for r in data["recipes"][:5]],
            ):
                if first:
                    logger.info(f"[TIMING] summary first token {(time.perf_counter()-t0)*1000:.0f}ms")
                    first = False
                chunks.append(token)
                yield f"data: {token.replace(chr(10), chr(92)+'n')}\n\n"

            full = "".join(chunks)
            _scache_set(breed_id, full)
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        sse_gen(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/summary")
async def get_summary(
    breed_id: str = Query(
        ...,
        description="Breed ID (required)",
        min_length=1,
        max_length=64,
        pattern=r"^[a-zA-Z0-9_-]+$",
    ),
) -> SummaryResponse:
    """LLM summary만 반환 (느림 → 프론트에서 lazy 호출)"""
    data = await run_in_threadpool(_sync_get_recommendations, breed_id)
    recipes = data["recipes"]
    summary = data.get("summary") or ""

    if not summary:
        try:
            summary = await asyncio.wait_for(
                generate_summary(
                    breed_name_ko=data["breed_name_ko"],
                    breed_size=data["breed"].get("size_category"),
                    disease_names=data["disease_names"],
                    recipe_titles=[r.title for r in recipes[:5]],
                ),
                timeout=SUMMARY_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            logger.warning("Summary timed out for breed %s", data["breed_name_ko"])
            summary = f"{data['breed_name_ko']}에 대한 맞춤 건강 정보입니다."
        except Exception:
            logger.exception("Summary failed for breed %s", data["breed_name_ko"])
            summary = f"{data['breed_name_ko']}에 대한 맞춤 건강 정보입니다."

    return SummaryResponse(summary=summary)


# (origin/dev NDJSON 스트리밍 제거 - SSE 방식으로 통일)
# @router.get("/summary/stream")
async def get_summary_stream_REMOVED(
    breed_id: str = Query(
        ...,
        description="Breed ID (required)",
        min_length=1,
        max_length=64,
        pattern=r"^[a-zA-Z0-9_-]+$",
    ),
):
    """LLM summary를 NDJSON 스트리밍으로 반환"""
    data = await run_in_threadpool(_sync_get_recommendations, breed_id)
    recipes = data["recipes"]

    async def _generate():
        full_content = ""
        try:
            async for token in stream_summary(
                breed_name_ko=data["breed_name_ko"],
                breed_size=data["breed"].get("size_category"),
                disease_names=data["disease_names"],
                recipe_titles=[r.title for r in recipes[:5]],
            ):
                full_content += token
                yield json.dumps({"token": token}, ensure_ascii=False) + "\n"
        except Exception:
            logger.exception("Streaming summary failed for breed %s", data["breed_name_ko"])

        if not full_content:
            full_content = f"{data['breed_name_ko']}에 대한 맞춤 건강 정보입니다."
            yield json.dumps({"token": full_content}, ensure_ascii=False) + "\n"

        yield json.dumps({
            "done": True,
            "summary": full_content,
        }, ensure_ascii=False) + "\n"

    return StreamingResponse(_generate(), media_type="application/x-ndjson")
