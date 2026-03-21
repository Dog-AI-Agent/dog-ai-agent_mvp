"""
LLM Service — 댕슐랭 강아지 레시피 AI Summary
Debate Chain 최적화 버전:
- AsyncOpenAI 싱글톤 (connection pool 재사용)
- few-shot을 system prompt에 인라인 통합 (파일 I/O 제거)
- system prompt 100% 고정 → KV캐싱 히트율 극대화
- 동적 데이터는 user message에만 배치
- max_tokens=800, temperature=0.3
"""

import os
import logging
from openai import AsyncOpenAI, OpenAIError

from backend.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

MODEL = "gpt-4o-mini"
MAX_TOKENS = 800
TEMPERATURE = 0.3

SERVING_SIZE = {
    "소형": "100~150g",
    "중형": "200~300g",
    "대형": "400~500g",
}

# ── 싱글톤 AsyncOpenAI client (connection pool 재사용) ──
_client: AsyncOpenAI | None = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        if not OPENAI_API_KEY:
            raise ValueError("OPENAI_API_KEY가 설정되지 않았습니다.")
        _client = AsyncOpenAI(api_key=OPENAI_API_KEY)
    return _client


async def close_client():
    """앱 종료 시 호출 (lifespan shutdown)"""
    global _client
    if _client is not None:
        await _client.close()
        _client = None


# ── System Prompt (100% 고정 → KV캐싱 극대화, few-shot 인라인) ──
_RECIPE_SYSTEM_PROMPT = """\
당신은 반려견 영양 상담 전문 수의사입니다.
사용자가 제공하는 강아지 레시피 정보를 바탕으로 영양학적 분석과 요약을 제공합니다.

## 응답 규칙
- 반드시 한국어로 답변합니다.
- 강아지 건강에 위험한 재료가 있으면 반드시 경고합니다.
- 간결하고 실용적인 요약을 제공합니다.
- 레시피의 장점과 주의사항을 균형 있게 서술합니다.
- 반드시 아래 형식을 따르세요.

## 응답 형식
### 한 줄 소개
(이 레시피가 이 견종에 왜 좋은지 1~2문장)

### 재료
- 재료명: 숫자g 또는 숫자개 (반드시 구체적인 수치로 표기. '적당량' '약간' 금지)

### 만드는 법
1. 첫 번째 단계
2. 두 번째 단계

### 추천 이유
(주요 재료가 해당 질병/건강에 왜 도움이 되는지)

### 급여량
(견종 크기에 맞는 1회 급여량: 소형 100~150g, 중형 200~300g, 대형 400~500g)

## 예시

### 예시 입력
레시피명: 닭가슴살 고구마 볼
재료: 닭가슴살 200g, 고구마 100g, 당근 50g, 브로콜리 30g
대상견: 골든 리트리버 (대형견), 고관절 이형성증 위험

### 예시 응답
### 한 줄 소개
관절 건강에 좋은 저지방 고단백 레시피로, 골든 리트리버의 고관절 부담을 줄여줍니다.

### 재료
- 닭가슴살: 200g
- 고구마: 100g
- 당근: 50g
- 브로콜리: 30g

### 만드는 법
1. 닭가슴살을 삶아 잘게 찢습니다.
2. 고구마와 당근을 찐 후 으깨어 섞습니다.
3. 브로콜리는 살짝 데쳐 잘게 썰어 함께 섞습니다.
4. 한 입 크기로 뭉쳐 식힌 후 제공합니다.

### 추천 이유
닭가슴살의 고단백 저지방 성분이 근육량 유지를 도우며 관절 부하를 줄입니다. 고구마의 베타카로틴이 항염 작용을 하고, 브로콜리의 비타민 C가 관절 연골 보호에 도움됩니다.

### 급여량
대형견 기준 1회 400~500g 제공을 권장합니다.

## 지시사항
사용자가 레시피 정보를 제공하면, 위 형식으로 영양 요약을 작성하세요.\
"""

# ── 추천 요약용 System Prompt ──
_SUMMARY_SYSTEM_PROMPT = """\
당신은 반려견 영양 상담 전문 수의사입니다.
견종과 질병 위험을 기반으로 맞춤 식단 추천 이유를 한국어로 작성합니다.

## 규칙
- 반드시 한국어로 답변합니다.
- 3~5문장으로 간결하게 작성합니다.
- 해당 견종의 유전병 위험과 연관지어 설명합니다.
- 따뜻하고 전문적인 어조를 유지합니다.\
"""


def _build_recipe_user_message(
    recipe_title_ko: str,
    ingredient_names: list[str],
    breed_name_ko: str,
    breed_size: str | None,
    disease_names: list[str],
) -> str:
    size_info = ""
    if breed_size:
        serving = SERVING_SIZE.get(breed_size, "")
        ko = {"small": "소형견", "medium": "중형견", "large": "대형견", "giant": "초대형견"}.get(breed_size, breed_size)
        size_info = f" ({ko}, 1회 급여량 {serving})" if serving else f" ({ko})"

    disease_str = ", ".join(disease_names) if disease_names else "알려진 유전 질병 없음"
    ingredients_str = ", ".join(ingredient_names) if ingredient_names else "정보 없음"

    return (
        f"레시피명: {recipe_title_ko}\n"
        f"재료: {ingredients_str}\n"
        f"대상견: {breed_name_ko}{size_info}, 주요 질병 위험: {disease_str}\n"
        f"중요: 재료 분량은 '적당량' 없이 반드시 숫자g 또는 숫자개로 명시하세요."
    )


# ── 레시피 요약 스트리밍 (SSE용) ──
async def generate_recipe_summary_stream(
    recipe_title_ko: str,
    ingredient_names: list[str],
    breed_name_ko: str,
    breed_size: str | None,
    disease_names: list[str],
):
    """레시피 요약 스트리밍 async generator"""
    if not OPENAI_API_KEY:
        yield "AI 서비스가 설정되지 않았습니다."
        return

    user_message = _build_recipe_user_message(
        recipe_title_ko, ingredient_names, breed_name_ko, breed_size, disease_names
    )

    try:
        client = get_client()
        stream = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": _RECIPE_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=TEMPERATURE,
            max_tokens=MAX_TOKENS,
            stream=True,
        )
        async for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                yield token
    except OpenAIError as e:
        logger.error(f"OpenAI 스트리밍 오류: {e}")
        yield "\n\n(AI 응답 생성 중 오류가 발생했습니다.)"
    except Exception as e:
        logger.error(f"예상치 못한 오류: {e}")
        yield "\n\n(AI 응답 생성 중 오류가 발생했습니다.)"


# ── 레시피 요약 비스트리밍 ──
async def generate_recipe_summary(
    recipe_title_ko: str,
    ingredient_names: list[str],
    breed_name_ko: str,
    breed_size: str | None,
    disease_names: list[str],
) -> str:
    """레시피 요약 비스트리밍 (전체 응답 반환)"""
    fallback = f"{breed_name_ko}를 위한 '{recipe_title_ko}' 레시피입니다."
    if not OPENAI_API_KEY:
        return fallback

    user_message = _build_recipe_user_message(
        recipe_title_ko, ingredient_names, breed_name_ko, breed_size, disease_names
    )

    try:
        client = get_client()
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": _RECIPE_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=TEMPERATURE,
            max_tokens=MAX_TOKENS,
        )
        return response.choices[0].message.content or fallback
    except OpenAIError as e:
        logger.error(f"OpenAI 오류: {e}")
        return fallback
    except Exception as e:
        logger.error(f"예상치 못한 오류: {e}")
        return fallback


# ── 추천 요약 스트리밍 (SSE용) ──
async def generate_summary_stream(
    breed_name_ko: str,
    breed_size: str | None,
    disease_names: list[str],
    recipe_titles: list[str] | None = None,
):
    """recommendations summary SSE async generator"""
    if not OPENAI_API_KEY:
        yield f"{breed_name_ko}의 건강을 위한 맞춤 레시피를 추천합니다."
        return

    size_ko = {"small": "소형견", "medium": "중형견", "large": "대형견", "giant": "초대형견"}.get(breed_size or "", "")
    disease_str = ", ".join(disease_names) if disease_names else "알려진 유전 질병 없음"
    recipe_str = ", ".join(recipe_titles[:5]) if recipe_titles else ""

    user_message = (
        f"견종: {breed_name_ko} ({size_ko})\n"
        f"주요 질병 위험: {disease_str}\n"
        f"추천 레시피: {recipe_str}\n\n"
        f"이 견종의 건강 관리를 위한 식단 추천 이유를 3~5문장으로 작성해주세요."
    )

    try:
        client = get_client()
        stream = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": _SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=TEMPERATURE,
            max_tokens=400,
            stream=True,
        )
        async for chunk in stream:
            token = chunk.choices[0].delta.content
            if token:
                yield token
    except OpenAIError as e:
        logger.error(f"Summary 스트리밍 오류: {e}")
        yield f"{breed_name_ko}의 건강을 위한 맞춤 레시피를 추천합니다."
    except Exception as e:
        logger.error(f"예상치 못한 오류: {e}")
        yield f"{breed_name_ko}의 건강을 위한 맞춤 레시피를 추천합니다."


# ── 추천 요약 비스트리밍 ──
async def generate_summary(
    breed_name_ko: str,
    breed_size: str | None,
    disease_names: list[str],
    recipe_titles: list[str] | None = None,
) -> str:
    """추천 화면용 AI 요약 (비스트리밍)"""
    fallback = f"{breed_name_ko}의 건강을 위한 맞춤 레시피를 추천합니다."
    if not OPENAI_API_KEY:
        return fallback

    size_ko = {"small": "소형견", "medium": "중형견", "large": "대형견", "giant": "초대형견"}.get(breed_size or "", "")
    disease_str = ", ".join(disease_names) if disease_names else "알려진 유전 질병 없음"
    recipe_str = ", ".join(recipe_titles[:5]) if recipe_titles else ""

    user_message = (
        f"견종: {breed_name_ko} ({size_ko})\n"
        f"주요 질병 위험: {disease_str}\n"
        f"추천 레시피: {recipe_str}\n\n"
        f"이 견종의 건강 관리를 위한 식단 추천 이유를 3~5문장으로 작성해주세요."
    )

    try:
        client = get_client()
        response = await client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": _SUMMARY_SYSTEM_PROMPT},
                {"role": "user", "content": user_message},
            ],
            temperature=TEMPERATURE,
            max_tokens=400,
        )
        return response.choices[0].message.content or fallback
    except OpenAIError as e:
        logger.error(f"OpenAI 오류: {e}")
        return fallback
    except Exception as e:
        logger.error(f"예상치 못한 오류: {e}")
        return fallback
