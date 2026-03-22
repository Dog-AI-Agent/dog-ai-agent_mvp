"""
DALL-E 3 기반 반려견 레시피 이미지 생성 모듈
"""

import os
import requests
from pathlib import Path
from datetime import datetime

OUTPUT_DIR = Path(__file__).resolve().parent / "output"


def build_image_prompt_from_steps(food_name: str, ingredients: str, recipe_steps: list) -> str:
    """
    recipe_steps 리스트를 기반으로 완성된 요리 이미지 DALL-E 프롬프트를 생성합니다.
    - 마지막 단계로 최종 플레이팅 묘사
    - 전체 단계 키워드로 조리 방법 파악
    """
    final_step = recipe_steps[-1] if recipe_steps else ""

    all_steps = " ".join(recipe_steps)
    methods = []
    if any(k in all_steps for k in ["삶", "익힌", "데친"]):
        methods.append("cooked")
    if any(k in all_steps for k in ["찐", "쪄"]):
        methods.append("steamed")
    if any(k in all_steps for k in ["으깬", "으깨"]):
        methods.append("mashed")
    if any(k in all_steps for k in ["죽", "끓여"]):
        methods.append("simmered into a soft porridge")
    if any(k in all_steps for k in ["섞", "올려", "뿌려"]):
        methods.append("mixed and plated")
    cooking_desc = ", ".join(methods) if methods else "cooked"

    return (
        f"A real photograph of a finished homemade dog food dish called '{food_name}'. "
        f"The dish is made with {ingredients}, prepared as follows: {final_step} "
        f"The ingredients are {cooking_desc}. "
        f"Served in a simple white ceramic bowl on a pure white background. "
        f"Only the bowl with the finished dish, nothing else — no loose ingredients, no garnish outside the bowl, no props, no animals, no people. "
        f"Everything must be inside the bowl only. "
        f"Realistic food textures, vibrant natural colors. "
        f"Bright, even studio lighting. Slight overhead angle. "
        f"Clean, minimal commercial food photography. "
        f"No text, no labels, no illustrations, no cartoon style."
    )


def save_image(image_url: str, food_name: str) -> Path:
    """생성된 이미지 URL을 다운로드하여 output 폴더에 저장합니다."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_name = food_name.replace(" ", "_")[:30]
    filepath = OUTPUT_DIR / f"{safe_name}_{timestamp}.png"

    response = requests.get(image_url, timeout=30)
    response.raise_for_status()

    with open(filepath, "wb") as f:
        f.write(response.content)

    return filepath
