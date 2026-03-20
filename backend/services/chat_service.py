"""
Chat Service — breed_id 기반 SQL 컨텍스트 검색 + OpenAI 챗봇
"""
import logging

from openai import OpenAI

from backend.config import OPENAI_API_KEY
from backend.database import get_supabase

logger = logging.getLogger(__name__)

MAX_HISTORY = 20  # 최근 대화 최대 포함 수


def _fetch_breed_context(breed_id: str) -> str:
    """breed_id 기반으로 DB에서 관련 데이터를 조회하여 텍스트 컨텍스트로 조합"""
    sb = get_supabase()
    parts: list[str] = []

    # 1) 품종 기본 정보
    # FIX: maybe_single() → limit(1).execute() — 결과 없을 때 204 APIError 방지
    breed = (
        sb.table("breeds")
        .select("name_ko, name_en, size_category, avg_weight_kg, avg_life_span_years, description")
        .eq("id", breed_id)
        .limit(1)
        .execute()
    )
    if breed.data:
        b = breed.data[0]  # FIX: limit(1) 결과는 리스트이므로 [0] 접근
        parts.append(
            f"[품종 정보]\n"
            f"이름: {b.get('name_ko', '')} ({b.get('name_en', '')})\n"
            f"크기: {b.get('size_category', '정보 없음')}\n"
            f"평균 체중: {b.get('avg_weight_kg', '정보 없음')}kg\n"
            f"평균 수명: {b.get('avg_life_span_years', '정보 없음')}년\n"
            f"설명: {b.get('description', '정보 없음')}"
        )

    # 2) 유전병 정보
    diseases = (
        sb.table("breed_diseases")
        .select("risk_level, diseases(id, name_ko, name_en, description, severity, symptoms, affected_area, prevention_tips)")
        .eq("breed_id", breed_id)
        .execute()
    )
    if diseases.data:
        disease_lines = []
        for bd in diseases.data:
            d = bd.get("diseases", {})
            if not d:
                continue
            symptoms = ", ".join(d.get("symptoms", [])) if d.get("symptoms") else "정보 없음"
            disease_lines.append(
                f"- {d.get('name_ko', d.get('name_en', ''))}\n"
                f"  위험도: {bd.get('risk_level', '?')}, 심각도: {d.get('severity', '?')}\n"
                f"  설명: {d.get('description', '정보 없음')}\n"
                f"  증상: {symptoms}\n"
                f"  영향 부위: {d.get('affected_area', '정보 없음')}\n"
                f"  예방법: {d.get('prevention_tips', '정보 없음')}"
            )
        if disease_lines:
            parts.append("[유전병 정보]\n" + "\n".join(disease_lines))

    # 3) 권장 영양소 (disease_ingredients)
    if diseases.data:
        disease_ids = [
            bd["diseases"]["id"]
            for bd in diseases.data
            if bd.get("diseases", {}).get("id")
        ]
        if disease_ids:
            ingredients = (
                sb.table("disease_ingredients")
                .select("priority, ingredients(name_ko, category)")
                .in_("disease_id", disease_ids)
                .order("priority", desc=True)
                .limit(30)
                .execute()
            )
            if ingredients.data:
                ing_lines = [
                    f"- {i['ingredients']['name_ko']} (분류: {i['ingredients'].get('category', '?')})"
                    for i in ingredients.data
                    if i.get("ingredients")
                ]
                if ing_lines:
                    parts.append("[권장 영양소]\n" + "\n".join(ing_lines))

    # 4) 추천 레시피 (상위 5개)
    if diseases.data:
        disease_ids = [
            bd["diseases"]["id"]
            for bd in diseases.data
            if bd.get("diseases", {}).get("id")
        ]
        if disease_ids:
            recipes = (
                sb.table("recipe_target_diseases")
                .select("recipes(id, title, description, difficulty, cook_time_min)")
                .in_("disease_id", disease_ids)
                .limit(10)
                .execute()
            )
            if recipes.data:
                seen = set()
                recipe_lines = []
                for r in recipes.data:
                    rec = r.get("recipes", {})
                    if not rec or rec.get("id") in seen:
                        continue
                    seen.add(rec["id"])
                    recipe_lines.append(
                        f"- {rec.get('title', '?')} "
                        f"(난이도: {rec.get('difficulty', '?')}, "
                        f"조리시간: {rec.get('cook_time_min', '?')}분)\n"
                        f"  설명: {rec.get('description', '정보 없음')}"
                    )
                if recipe_lines:
                    parts.append("[추천 레시피]\n" + "\n".join(recipe_lines[:5]))

    return "\n\n".join(parts) if parts else "해당 품종에 대한 데이터가 없습니다."


def _build_system_prompt(context: str, breed_name: str) -> str:
    return (
        f"당신은 반려견 전문 영양 상담 수의사입니다.\n"
        f"현재 사용자는 '{breed_name}' 품종에 대해 상담 중이며, "
        f"아래 데이터베이스 정보가 참고 자료로 제공됩니다.\n\n"
        f"규칙:\n"
        f"1. 반드시 한국어로 답변하세요.\n"
        f"2. 아래 제공된 데이터베이스 정보가 있으면 우선적으로 활용하되, "
        f"데이터에 없는 내용이라도 강아지 관련 질문이라면 일반적인 수의학 지식을 바탕으로 답변하세요.\n"
        f"3. 강아지와 전혀 관련 없는 질문(날씨, 주식, 일반 상식 등)에는 "
        f"정중하게 거절하고, 강아지 관련 질문을 해달라고 안내하세요.\n"
        f"4. 따뜻하고 전문적인 어조로 답변하세요.\n"
        f"5. 답변은 간결하되 충분한 정보를 제공하세요.\n\n"
        f"─── 참고: {breed_name} 데이터베이스 정보 ───\n{context}"
    )


async def get_chat_response(
    breed_id: str,
    user_message: str,
    history: list[dict],
) -> str:
    """대화 기록과 DB 컨텍스트를 조합하여 OpenAI 응답 생성"""
    fallback = "죄송합니다. 일시적으로 응답을 생성할 수 없습니다. 잠시 후 다시 시도해주세요."

    if not OPENAI_API_KEY:
        return fallback

    # DB에서 품종 컨텍스트 조회
    # FIX: DB 조회 실패 시에도 챗봇이 동작하도록 방어
    try:
        context = _fetch_breed_context(breed_id)
    except Exception:
        logger.exception("Failed to fetch breed context")
        context = "해당 품종에 대한 데이터가 없습니다."

    # 품종명 추출
    sb = get_supabase()
    # FIX: maybe_single() → limit(1).execute() — 결과 없을 때 204 APIError 방지
    breed_row = (
        sb.table("breeds")
        .select("name_ko")
        .eq("id", breed_id)
        .limit(1)
        .execute()
    )
    breed_name = breed_row.data[0].get("name_ko", breed_id) if breed_row.data else breed_id

    system_prompt = _build_system_prompt(context, breed_name)

    # 메시지 구성
    messages: list[dict] = [{"role": "system", "content": system_prompt}]

    # 최근 대화 기록 추가
    for msg in history[-MAX_HISTORY:]:
        messages.append({"role": msg["role"], "content": msg["content"]})

    # 현재 사용자 메시지
    messages.append({"role": "user", "content": user_message})

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        return response.choices[0].message.content or fallback
    except Exception:
        logger.exception("Chat LLM call failed")
        return fallback
