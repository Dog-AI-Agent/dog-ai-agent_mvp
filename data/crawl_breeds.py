"""
강아지 품종 정보 크롤링 스크립트
- TheDogAPI에서 체중/수명/성격 가져와서 Supabase 업데이트
- pip install requests supabase python-dotenv
"""

import os
import time
import requests
from supabase import create_client

# ── Supabase 설정 ──
SUPABASE_URL = "https://ikmycpoibpvrpdxjbjlg.supabase.co"
SUPABASE_KEY = "sb_publishable_3eOvBPdENQWnUiO4DIQrIg_P7ALvCyh"
DOG_API_KEY  = ""  # https://thedogapi.com 무료 가입 후 키 발급 (없어도 일부 동작)

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ── TheDogAPI 전체 품종 목록 가져오기 ──
def fetch_dog_api_breeds():
    headers = {"x-api-key": DOG_API_KEY} if DOG_API_KEY else {}
    url = "https://api.thedogapi.com/v1/breeds?limit=200"
    resp = requests.get(url, headers=headers, timeout=10)
    resp.raise_for_status()
    return resp.json()

# ── 품종명 유사도 매칭 ──
def find_match(name_en: str, api_breeds: list) -> dict | None:
    name_lower = name_en.lower().strip()

    # 정확 일치
    for b in api_breeds:
        if b["name"].lower() == name_lower:
            return b

    # 부분 일치 (DB명이 API명에 포함되거나 반대)
    for b in api_breeds:
        api_name = b["name"].lower()
        if name_lower in api_name or api_name in name_lower:
            return b

    # 첫 단어 일치
    first_word = name_lower.split()[0]
    for b in api_breeds:
        if b["name"].lower().startswith(first_word):
            return b

    return None

# ── 체중 파싱 (예: "6 - 7" -> 평균값) ──
def parse_weight(weight_str: str | None) -> float | None:
    if not weight_str:
        return None
    try:
        # "6 - 7" 형태
        if "-" in weight_str:
            parts = weight_str.replace(" ", "").split("-")
            return (float(parts[0]) + float(parts[1])) / 2
        return float(weight_str.strip())
    except:
        return None

# ── 수명 파싱 (예: "12 - 15" -> 평균값) ──
def parse_lifespan(life_str: str | None) -> float | None:
    if not life_str:
        return None
    try:
        # "12 - 15 years" 형태
        life_str = life_str.replace("years", "").replace("year", "").strip()
        if "-" in life_str:
            parts = life_str.replace(" ", "").split("-")
            return (float(parts[0]) + float(parts[1])) / 2
        return float(life_str.strip())
    except:
        return None

def main():
    print("TheDogAPI에서 품종 데이터 가져오는 중...")
    api_breeds = fetch_dog_api_breeds()
    print(f"API 품종 수: {len(api_breeds)}")

    # Supabase에서 업데이트 필요한 품종 가져오기
    result = supabase.table("breeds").select("id, name_en, name_ko, avg_weight_kg").execute()
    db_breeds = result.data
    print(f"DB 품종 수: {len(db_breeds)}")

    updated = 0
    not_found = []

    for db_breed in db_breeds:
        name_en = db_breed.get("name_en", "")
        breed_id = db_breed["id"]

        match = find_match(name_en, api_breeds)

        if not match:
            not_found.append(name_en)
            continue

        # 데이터 추출
        weight_metric = match.get("weight", {}).get("metric")
        lifespan = match.get("life_span")
        temperament = match.get("temperament")

        avg_weight = parse_weight(weight_metric)
        avg_life = parse_lifespan(lifespan)

        # 업데이트할 데이터 준비
        update_data = {}
        if avg_weight:
            update_data["avg_weight_kg"] = avg_weight
        if avg_life:
            update_data["avg_life_span_years"] = avg_life
        if temperament:
            update_data["temperament"] = temperament

        if update_data:
            supabase.table("breeds").update(update_data).eq("id", breed_id).execute()
            print(f"✅ {name_en} ({db_breed['name_ko']}) → 체중:{avg_weight}kg 수명:{avg_life}년")
            updated += 1
        
        time.sleep(0.1)  # API 요청 간격

    print(f"\n완료! 업데이트: {updated}개")
    print(f"매칭 실패: {len(not_found)}개")
    if not_found:
        print("실패 목록:", not_found[:20])

if __name__ == "__main__":
    main()
