"""
LLM Service — OpenAI GPT-4o-mini few-shot recommendation summary
"""

import json
import os
from pathlib import Path
from openai import OpenAI

from backend.config import OPENAI_API_KEY

BASE_DIR = Path(__file__).resolve().parent.parent.parent
FEW_SHOT_PATH = BASE_DIR / "ai-service" / "LLM" / "few_shot_samples.json"
FOOD_TRANS_PATH = BASE_DIR / "ai-service" / "LLM" / "food_translation.json"

SERVING_SIZE = {
    "소형": "100~150g",
    "중형": "200~300g",
    "대형": "400~500g",
}

# Load food translation map (English -> Korean) once at module level
_food_translation: dict[str, str] | None = None


def _load_food_translation() -> dict[str, str]:
    global _food_translation
    if _food_translation is not None:
        return _food_translation
    if FOOD_TRANS_PATH.exists():
        with open(FOOD_TRANS_PATH, "r", encoding="utf-8") as f:
            _food_translation = json.load(f)
    else:
        _food_translation = {}
    return _food_translation


def _translate_food(name: str) -> str:
    """Translate an English food name to Korean. Falls back to original."""
    ft = _load_food_translation()
    return ft.get(name, name)


def _build_system_prompt() -> str:
    return (
        "당신은 반려견 영양 상담 전문 수의사입니다. "
        "견종, 질병 위험, 유전 여부를 기반으로 적합한 레시피와 효과적인 재료를 추천합니다.\n\n"
        "중요: 반드시 모든 응답을 한국어로 작성하세요. "
        "아래 few-shot 예시는 참고용이지만, 실제 응답은 반드시 한국어로 해주세요.\n\n"
        "규칙:\n"
        "1. 해당 질병에 대해 간단히 설명하고, 유전성 여부를 언급하세요.\n"
        "2. 최대 3개의 레시피와 재료를 추천하세요.\n"
        "3. 각 레시피마다 '재료: ~~~' 형태로 재료를 나열하고, "
        "그 아래에 번호를 매겨 조리법을 단계별로 알려주세요.\n"
        "4. 각 레시피마다 해당 재료가 질병에 왜 도움이 되는지 이유를 설명하세요.\n"
        "5. 알려진 질병 위험이 없는 견종이라면 보호자를 안심시키고 "
        "균형 잡힌 식단을 유지하도록 권장하세요.\n"
        "6. 믹스견(혼합견)의 경우, 여러 견종에서 공통으로 나타나는 질병을 "
        "우선적으로 설명하고, 해당 질병에 맞는 레시피를 추천하세요. "
        "공통 질병이 없다면 각 견종의 주요 질병을 종합하여 추천하세요.\n"
        "7. 견종의 크기(소형/중형/대형)에 따라 1회 급여량을 안내하세요. "
        "소형: 100~150g, 중형: 200~300g, 대형: 400~500g.\n"
        "8. 견종명과 레시피명은 반드시 한국어로 표기하세요. "
        "사용자 질문에 포함된 한국어 레시피명을 그대로 사용하세요.\n"
        "9. 따뜻하고 전문적인 어조로 응답하세요."
    )


def _build_few_shot_messages() -> list[dict]:
    if not FEW_SHOT_PATH.exists():
        return []
    with open(FEW_SHOT_PATH, "r", encoding="utf-8") as f:
        samples = json.load(f)

    messages = []
    for sample in samples:
        inp = sample["input"]
        out = sample["output"]

        size_info = f" ({inp.get('size', '')})" if inp.get("size") else ""
        if inp.get("disease"):
            genetic_str = "유전성" if inp.get("genetic_disease") == 1 else "비유전성"
            user_msg = (
                f"우리 강아지 견종은 {inp['breed']}{size_info}입니다. "
                f"{inp['disease']} 위험이 있습니다 ({genetic_str}). "
                f"어떤 음식을 추천하시나요? 추천 이유, 재료, 만드는 법, 급여량도 알려주세요."
            )
        else:
            user_msg = (
                f"우리 강아지 견종은 {inp['breed']}{size_info}입니다. "
                f"어떤 질병 위험이 있고, 어떤 음식을 추천하시나요?"
            )

        # Build detailed assistant message with recipe details
        assistant_msg = out["message"]
        if out.get("recommended_recipes"):
            assistant_msg += "\n\n추천 레시피:\n"
            for i, recipe in enumerate(out["recommended_recipes"], 1):
                assistant_msg += (
                    f"\n  {i}. {recipe['food']}\n"
                    f"     재료: {recipe['ingredients']}\n"
                )
                if "reason" in recipe:
                    assistant_msg += f"     추천 이유: {recipe['reason']}\n"
                if "serving_size" in recipe:
                    assistant_msg += f"     급여량: {recipe['serving_size']}\n"
                if "recipe_steps" in recipe:
                    assistant_msg += "     만드는 법:\n"
                    for step_num, step in enumerate(recipe["recipe_steps"], 1):
                        assistant_msg += f"       {step_num}. {step}\n"

        messages.append({"role": "user", "content": user_msg})
        messages.append({"role": "assistant", "content": assistant_msg})

    return messages


async def generate_summary(
    breed_name_ko: str,
    breed_size: str | None,
    disease_names: list[str],
    recipe_titles: list[str] | None = None,
) -> str:
    """Generate LLM summary for recommendations. Falls back to static text on failure."""
    fallback = f"{breed_name_ko}의 건강을 위한 맞춤 레시피를 추천합니다."

    if not OPENAI_API_KEY:
        return fallback

    size_info = ""
    if breed_size:
        serving = SERVING_SIZE.get(breed_size, "")
        size_info = f" ({breed_size}, 1회 급여량 {serving})" if serving else f" ({breed_size})"

    disease_str = ", ".join(disease_names) if disease_names else "알려진 유전 질병 없음"

    # Build user query with Korean-translated recipe names
    user_query = f"우리 강아지 견종은 {breed_name_ko}{size_info}입니다. "

    if disease_names:
        user_query += f"주요 질병 위험: {disease_str}. "

        # Include available recipes translated to Korean
        if recipe_titles:
            translated = [_translate_food(t) for t in recipe_titles[:5]]
            user_query += f"선택 가능한 레시피: {', '.join(translated)}. "

        user_query += "어떤 음식을 추천하시나요? 추천 이유, 재료, 만드는 법, 급여량도 알려주세요."
    else:
        user_query += "어떤 질병 위험이 있고, 어떤 음식을 추천하시나요?"

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        system_prompt = _build_system_prompt()
        few_shot = _build_few_shot_messages()

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(few_shot)
        messages.append({"role": "user", "content": user_query})

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=1024,
        )
        return response.choices[0].message.content or fallback
    except Exception:
        return fallback


async def generate_recipe_summary(
    recipe_title_ko: str,
    ingredient_names: list[str],
    breed_name_ko: str,
    breed_size: str | None,
    disease_names: list[str],
) -> str:
    """Generate LLM explanation for a specific recipe in context of a breed."""
    fallback = f"{breed_name_ko}를 위한 '{recipe_title_ko}' 레시피입니다."

    if not OPENAI_API_KEY:
        return fallback

    size_info = ""
    if breed_size:
        serving = SERVING_SIZE.get(breed_size, "")
        size_info = f" ({breed_size}, 1회 급여량 {serving})" if serving else f" ({breed_size})"

    disease_str = ", ".join(disease_names) if disease_names else "알려진 유전 질병 없음"
    ingredients_str = ", ".join(ingredient_names) if ingredient_names else ""

    system_prompt = (
        "당신은 반려견 영양 상담 전문 수의사입니다. "
        "사용자가 선택한 특정 레시피에 대해 해당 견종과 질병에 왜 도움이 되는지 설명합니다.\n\n"
        "규칙:\n"
        "1. 이 레시피가 해당 견종의 질병에 왜 도움이 되는지 재료별로 설명하세요.\n"
        "2. 각 주요 재료의 영양학적 효능을 간단히 설명하세요.\n"
        "3. 급여 시 주의사항이 있다면 알려주세요.\n"
        "4. 견종 크기에 맞는 1회 급여량을 안내하세요. "
        "소형: 100~150g, 중형: 200~300g, 대형: 400~500g.\n"
        "5. 따뜻하고 전문적인 어조로 작성하세요.\n"
        "6. 반드시 한국어로 작성하세요.\n"
        "7. 마크다운 문법(#, *, ** 등)은 사용하지 마세요. 일반 텍스트로만 작성하세요."
    )

    user_query = (
        f"우리 강아지는 {breed_name_ko}{size_info}이고, "
        f"주요 질병 위험은 {disease_str}입니다.\n"
        f"선택한 레시피: {recipe_title_ko}\n"
        f"재료: {ingredients_str}\n\n"
        f"이 레시피가 우리 강아지에게 왜 좋은지 설명해주세요."
    )

    try:
        client = OpenAI(api_key=OPENAI_API_KEY)
        few_shot = _build_few_shot_messages()

        messages = [{"role": "system", "content": system_prompt}]
        messages.extend(few_shot)
        messages.append({"role": "user", "content": user_query})

        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            temperature=0.7,
            max_tokens=512,
        )
        return response.choices[0].message.content or fallback
    except Exception:
        return fallback
