"""
나머지 77개 품종 추가 업데이트 스크립트
"""
import time
from supabase import create_client

SUPABASE_URL = "https://ikmycpoibpvrpdxjbjlg.supabase.co"
SUPABASE_KEY = "sb_publishable_3eOvBPdENQWnUiO4DIQrIg_P7ALvCyh"

EXTRA_BREED_DATA = {
    "norwegian_elkhound": {"avg_weight_kg": 22.0, "avg_life_span_years": 13.0, "temperament": "대담하고 활발하며 독립적이다. 충성스럽고 사냥 본능이 강하다. 에너지가 넘치고 추운 날씨에 강하다."},
    "otterhound": {"avg_weight_kg": 47.5, "avg_life_span_years": 12.0, "temperament": "활발하고 유쾌하며 친근하다. 수영을 좋아하고 냄새 추적 능력이 뛰어나다. 독립적이고 완고한 편이다."},
    "saluki": {"avg_weight_kg": 22.5, "avg_life_span_years": 13.5, "temperament": "우아하고 온화하며 독립적이다. 속도가 매우 빠르고 사냥 본능이 강하다. 가족에게 충성스럽지만 낯선 사람에게 거리를 둔다."},
    "scottish_deerhound": {"avg_weight_kg": 45.5, "avg_life_span_years": 9.5, "temperament": "온화하고 친근하며 조용하다. 속도가 빠르고 사냥 본능이 강하다. 독립적이지만 가족에게 충성스럽다."},
    "australian_terrier": {"avg_weight_kg": 6.5, "avg_life_span_years": 14.0, "temperament": "활발하고 용감하며 지능이 높다. 충성스럽고 독립적이며 경계심이 강하다. 에너지가 넘치고 장난기가 많다."},
    "boston_bull": {"avg_weight_kg": 7.5, "avg_life_span_years": 13.0, "temperament": "활발하고 외향적이며 지능이 높다. 친근하고 사교적이며 어린이와 잘 어울린다. 도시 생활에 적합하다."},
    "giant_schnauzer": {"avg_weight_kg": 35.0, "avg_life_span_years": 12.0, "temperament": "충성스럽고 용감하며 지능이 높다. 에너지가 넘치고 훈련하기 쉽다. 경계심이 강하고 보호 본능이 있다."},
    "standard_schnauzer": {"avg_weight_kg": 17.5, "avg_life_span_years": 13.5, "temperament": "활발하고 지능이 높으며 충성스럽다. 경계심이 강하고 독립적이다. 훈련하기 쉽고 에너지가 넘친다."},
    "scotch_terrier": {"avg_weight_kg": 9.0, "avg_life_span_years": 13.0, "temperament": "독립적이고 용감하며 활발하다. 충성스럽고 고집이 있으며 경계심이 강하다. 가족에게 애정이 넘친다."},
    "tibetan_terrier": {"avg_weight_kg": 10.5, "avg_life_span_years": 14.0, "temperament": "온화하고 사교적이며 활발하다. 충성스럽고 적응력이 뛰어나다. 민감하고 가족과의 유대감이 강하다."},
    "irish_water_spaniel": {"avg_weight_kg": 25.5, "avg_life_span_years": 12.0, "temperament": "활발하고 지능이 높으며 장난기가 많다. 수영을 좋아하고 에너지가 넘친다. 충성스럽고 훈련하기 쉽다."},
    "schipperke": {"avg_weight_kg": 5.5, "avg_life_span_years": 14.0, "temperament": "활발하고 호기심이 많으며 독립적이다. 충성스럽고 경계심이 강하다. 장난기가 많고 에너지가 넘친다."},
    "groenendael": {"avg_weight_kg": 28.0, "avg_life_span_years": 13.0, "temperament": "지능이 높고 활발하며 충성스럽다. 경계심이 강하고 보호 본능이 있다. 훈련하기 쉽고 에너지가 넘친다."},
    "malinois": {"avg_weight_kg": 28.5, "avg_life_span_years": 14.0, "temperament": "지능이 매우 높고 활발하며 충성스럽다. 경찰견, 군용견으로 많이 활용된다. 에너지가 넘치고 훈련하기 쉽다."},
    "briard": {"avg_weight_kg": 35.0, "avg_life_span_years": 12.0, "temperament": "충성스럽고 용감하며 지능이 높다. 보호 본능이 강하고 가족에게 헌신적이다. 낯선 사람에게 경계심이 강하다."},
    "kelpie": {"avg_weight_kg": 17.5, "avg_life_span_years": 13.5, "temperament": "지능이 높고 활발하며 에너지가 넘친다. 일하기를 좋아하고 훈련하기 쉽다. 충성스럽고 독립적이다."},
    "komondor": {"avg_weight_kg": 50.0, "avg_life_span_years": 11.0, "temperament": "충성스럽고 용감하며 독립적이다. 보호 본능이 강하고 낯선 사람에게 경계심이 강하다. 가족에게 헌신적이다."},
    "old_english_sheepdog": {"avg_weight_kg": 35.0, "avg_life_span_years": 11.0, "temperament": "온화하고 지능이 높으며 적응력이 뛰어나다. 활발하고 장난기가 많으며 가족 친화적이다. 어린이와 잘 어울린다."},
    "bouvier_des_flandres": {"avg_weight_kg": 38.5, "avg_life_span_years": 12.0, "temperament": "충성스럽고 용감하며 지능이 높다. 보호 본능이 강하고 훈련하기 쉽다. 가족에게 헌신적이다."},
    "affenpinscher": {"avg_weight_kg": 3.5, "avg_life_span_years": 13.0, "temperament": "활발하고 장난기가 많으며 용감하다. 호기심이 많고 고집이 있으며 애정이 넘친다. 작은 체구지만 대담하다."},
    "leonberg": {"avg_weight_kg": 55.0, "avg_life_span_years": 9.0, "temperament": "온화하고 자신감이 있으며 친근하다. 가족에게 충성스럽고 어린이와 잘 어울린다. 차분하고 사회적이다."},
    "newfoundland": {"avg_weight_kg": 65.0, "avg_life_span_years": 10.0, "temperament": "온화하고 인내심이 강하며 충성스럽다. 수영을 좋아하고 구조 본능이 있다. 어린이와 매우 잘 어울린다."},
    "great_pyrenees": {"avg_weight_kg": 50.0, "avg_life_span_years": 11.0, "temperament": "온화하고 인내심이 강하며 충성스럽다. 보호 본능이 강하고 독립적이다. 차분하고 자신감이 있다."},
    "japanese_spaniel": {"avg_weight_kg": 4.0, "avg_life_span_years": 13.0, "temperament": "우아하고 사교적이며 온화하다. 충성스럽고 지능이 높으며 적응력이 뛰어나다. 실내 생활에 적합하다."},
    "pekinese": {"avg_weight_kg": 5.0, "avg_life_span_years": 13.0, "temperament": "독립적이고 자신감이 있으며 우아하다. 충성스럽지만 고집이 있다. 낯선 사람에게 경계심이 강하다."},
    "blenheim_spaniel": {"avg_weight_kg": 6.5, "avg_life_span_years": 12.5, "temperament": "온화하고 애정이 넘치며 우아하다. 사교적이고 친근하며 어린이와 잘 어울린다. 활발하고 적응력이 뛰어나다."},
    "toy_terrier": {"avg_weight_kg": 3.0, "avg_life_span_years": 14.0, "temperament": "활발하고 용감하며 충성스럽다. 지능이 높고 경계심이 강하다. 작은 체구지만 대담하고 에너지가 넘친다."},
    "rhodesian_ridgeback": {"avg_weight_kg": 36.5, "avg_life_span_years": 12.0, "temperament": "충성스럽고 용감하며 독립적이다. 보호 본능이 강하고 에너지가 넘친다. 낯선 사람에게 경계심이 강하다."},
    "basset": {"avg_weight_kg": 25.5, "avg_life_span_years": 12.0, "temperament": "온화하고 인내심이 강하며 충성스럽다. 냄새 추적 능력이 뛰어나고 완고한 편이다. 사교적이고 어린이와 잘 어울린다."},
    "staffordshire_bullterrier": {"avg_weight_kg": 14.5, "avg_life_span_years": 13.0, "temperament": "용감하고 지능이 높으며 애정이 넘친다. 어린이와 매우 잘 어울리고 충성스럽다. 활발하고 에너지가 넘친다."},
    "american_staffordshire_terrier": {"avg_weight_kg": 28.5, "avg_life_span_years": 13.0, "temperament": "충성스럽고 용감하며 자신감이 있다. 가족에게 애정이 넘치고 어린이와 잘 어울린다. 훈련하기 쉽고 활발하다."},
    "bedlington_terrier": {"avg_weight_kg": 8.5, "avg_life_span_years": 14.0, "temperament": "온화하고 활발하며 지능이 높다. 충성스럽고 사교적이며 어린이와 잘 어울린다. 양처럼 생겼지만 용감하다."},
    "border_terrier": {"avg_weight_kg": 6.5, "avg_life_span_years": 14.0, "temperament": "활발하고 지능이 높으며 적응력이 뛰어나다. 충성스럽고 사교적이며 어린이와 잘 어울린다. 에너지가 넘친다."},
    "kerry_blue_terrier": {"avg_weight_kg": 16.5, "avg_life_span_years": 13.5, "temperament": "활발하고 지능이 높으며 충성스럽다. 에너지가 넘치고 용감하다. 가족에게 애정이 넘치지만 다른 동물에 주의가 필요하다."},
    "irish_terrier": {"avg_weight_kg": 12.0, "avg_life_span_years": 14.0, "temperament": "용감하고 활발하며 충성스럽다. 지능이 높고 에너지가 넘친다. 독립적이고 고집이 있으며 완고한 편이다."},
    "norfolk_terrier": {"avg_weight_kg": 5.5, "avg_life_span_years": 14.0, "temperament": "활발하고 용감하며 사교적이다. 충성스럽고 적응력이 뛰어나다. 어린이와 잘 어울리고 장난기가 많다."},
    "norwich_terrier": {"avg_weight_kg": 5.5, "avg_life_span_years": 14.0, "temperament": "활발하고 용감하며 사교적이다. 충성스럽고 에너지가 넘친다. 독립적이지만 애정이 넘친다."},
    "wire_haired_fox_terrier": {"avg_weight_kg": 8.0, "avg_life_span_years": 14.0, "temperament": "활발하고 용감하며 지능이 높다. 독립적이고 완고하며 에너지가 넘친다. 장난기가 많고 호기심이 강하다."},
    "lakeland_terrier": {"avg_weight_kg": 7.5, "avg_life_span_years": 14.0, "temperament": "활발하고 자신감이 있으며 독립적이다. 용감하고 충성스러우며 완고한 편이다. 에너지가 넘치고 호기심이 강하다."},
    "sealyham_terrier": {"avg_weight_kg": 9.0, "avg_life_span_years": 14.0, "temperament": "활발하고 용감하며 독립적이다. 충성스럽고 완고한 편이다. 침착하고 자신감이 있다."},
    "airedale": {"avg_weight_kg": 25.5, "avg_life_span_years": 13.0, "temperament": "활발하고 지능이 높으며 충성스럽다. 용감하고 독립적이며 에너지가 넘친다. 훈련하기 쉽고 가족에게 애정이 넘친다."},
    "dandie_dinmont": {"avg_weight_kg": 9.5, "avg_life_span_years": 13.0, "temperament": "독립적이고 완고하며 용감하다. 충성스럽고 온화하며 지능이 높다. 가족에게 애정이 넘친다."},
    "ibizan_hound": {"avg_weight_kg": 22.5, "avg_life_span_years": 13.5, "temperament": "활발하고 독립적이며 지능이 높다. 사냥 본능이 강하고 에너지가 넘친다. 가족에게 충성스럽고 친근하다."},
    "silky_terrier": {"avg_weight_kg": 4.5, "avg_life_span_years": 14.0, "temperament": "활발하고 외향적이며 지능이 높다. 충성스럽고 경계심이 강하다. 장난기가 많고 애정이 넘친다."},
    "soft_coated_wheaten_terrier": {"avg_weight_kg": 17.0, "avg_life_span_years": 13.5, "temperament": "활발하고 지능이 높으며 애정이 넘친다. 충성스럽고 사교적이며 어린이와 잘 어울린다. 에너지가 넘치고 훈련 가능하다."},
    "flat_coated_retriever": {"avg_weight_kg": 30.0, "avg_life_span_years": 11.0, "temperament": "활발하고 외향적이며 장난기가 많다. 지능이 높고 훈련하기 쉬우며 사교적이다. 가족 친화적이고 어린이와 잘 어울린다."},
    "curly_coated_retriever": {"avg_weight_kg": 32.5, "avg_life_span_years": 12.0, "temperament": "자신감이 있고 활발하며 지능이 높다. 독립적이고 수영을 좋아한다. 충성스럽고 가족에게 애정이 넘친다."},
    "chesapeake_bay_retriever": {"avg_weight_kg": 32.0, "avg_life_span_years": 12.5, "temperament": "충성스럽고 용감하며 지능이 높다. 수영을 좋아하고 에너지가 넘친다. 독립적이고 보호 본능이 강하다."},
    "kuvasz": {"avg_weight_kg": 45.0, "avg_life_span_years": 12.0, "temperament": "충성스럽고 용감하며 독립적이다. 보호 본능이 강하고 낯선 사람에게 경계심이 강하다. 가족에게 헌신적이다."},
    "miniature_pinscher": {"avg_weight_kg": 4.5, "avg_life_span_years": 14.0, "temperament": "활발하고 용감하며 에너지가 넘친다. 독립적이고 호기심이 많으며 충성스럽다. 작은 체구지만 대담하다."},
    "greater_swiss_mountain_dog": {"avg_weight_kg": 55.0, "avg_life_span_years": 10.0, "temperament": "온화하고 충성스러우며 자신감이 있다. 가족에게 헌신적이고 어린이와 잘 어울린다. 차분하고 사회적이다."},
    "appenzeller": {"avg_weight_kg": 27.5, "avg_life_span_years": 13.0, "temperament": "활발하고 충성스러우며 지능이 높다. 에너지가 넘치고 일하기를 좋아한다. 가족에게 헌신적이고 경계심이 강하다."},
    "entlebucher": {"avg_weight_kg": 25.0, "avg_life_span_years": 13.0, "temperament": "활발하고 충성스러우며 지능이 높다. 에너지가 넘치고 훈련하기 쉽다. 가족에게 헌신적이고 경계심이 강하다."},
    "bull_mastiff": {"avg_weight_kg": 57.5, "avg_life_span_years": 10.0, "temperament": "충성스럽고 용감하며 자신감이 있다. 보호 본능이 강하고 가족에게 애정이 넘친다. 낯선 사람에게 경계심이 강하다."},
    "tibetan_mastiff": {"avg_weight_kg": 65.0, "avg_life_span_years": 13.0, "temperament": "독립적이고 용감하며 충성스럽다. 보호 본능이 매우 강하고 낯선 사람에게 경계심이 강하다. 고집이 있다."},
    "bluetick": {"avg_weight_kg": 28.5, "avg_life_span_years": 12.0, "temperament": "활발하고 온화하며 충성스럽다. 냄새 추적 능력이 뛰어나고 에너지가 넘친다. 사교적이고 완고한 편이다."},
    "black_and_tan_coonhound": {"avg_weight_kg": 30.0, "avg_life_span_years": 12.0, "temperament": "온화하고 충성스러우며 친근하다. 냄새 추적 능력이 뛰어나고 완고한 편이다. 사교적이고 어린이와 잘 어울린다."},
    "walker_hound": {"avg_weight_kg": 27.5, "avg_life_span_years": 13.0, "temperament": "활발하고 온화하며 사교적이다. 냄새 추적 능력이 뛰어나고 에너지가 넘친다. 충성스럽고 친근하다."},
    "english_foxhound": {"avg_weight_kg": 30.0, "avg_life_span_years": 13.0, "temperament": "온화하고 사교적이며 활발하다. 무리 생활을 좋아하고 에너지가 넘친다. 친근하고 독립적이다."},
    "redbone": {"avg_weight_kg": 30.0, "avg_life_span_years": 12.0, "temperament": "온화하고 충성스러우며 활발하다. 냄새 추적 능력이 뛰어난다. 사교적이고 완고한 편이다."},
    "borzoi": {"avg_weight_kg": 37.5, "avg_life_span_years": 12.0, "temperament": "우아하고 독립적이며 온화하다. 속도가 매우 빠르고 사냥 본능이 강하다. 가족에게 충성스럽지만 낯선 사람에게 거리를 둔다."},
    "irish_wolfhound": {"avg_weight_kg": 67.5, "avg_life_span_years": 8.0, "temperament": "온화하고 인내심이 강하며 친근하다. 거대한 체구에도 불구하고 조용하고 온순하다. 충성스럽고 어린이와 잘 어울린다."},
    "italian_greyhound": {"avg_weight_kg": 4.5, "avg_life_span_years": 14.0, "temperament": "우아하고 민감하며 애정이 넘친다. 충성스럽고 활발하며 빠르다. 추위에 약하고 실내 생활을 좋아한다."},
    "eskimo_dog": {"avg_weight_kg": 15.0, "avg_life_span_years": 13.0, "temperament": "활발하고 지능이 높으며 경계심이 강하다. 충성스럽고 훈련하기 쉽다. 가족과 함께 있기를 좋아한다."},
    "brabancon_griffon": {"avg_weight_kg": 4.5, "avg_life_span_years": 13.0, "temperament": "활발하고 자신감이 있으며 사교적이다. 충성스럽고 지능이 높으며 애정이 넘친다. 민감하고 주인에게 의존적이다."},
    "cardigan": {"avg_weight_kg": 14.0, "avg_life_span_years": 13.0, "temperament": "충성스럽고 애정이 넘치며 지능이 높다. 경계심이 강하고 훈련하기 쉽다. 활발하고 적응력이 뛰어나다."},
    "mexican_hairless": {"avg_weight_kg": 13.0, "avg_life_span_years": 14.0, "temperament": "충성스럽고 경계심이 강하며 독립적이다. 가족에게 애정이 넘치고 침착하다. 낯선 사람에게 거리를 둔다."},
    "dingo": {"avg_weight_kg": 16.0, "avg_life_span_years": 13.0, "temperament": "독립적이고 지능이 높으며 사냥 본능이 강하다. 야생견으로 가정견으로는 특별한 훈련이 필요하다."},
    "dhole": {"avg_weight_kg": 17.0, "avg_life_span_years": 10.0, "temperament": "사회적이고 협력적이며 지능이 높다. 무리 생활을 하며 사냥 본능이 강하다."},
    "african_hunting_dog": {"avg_weight_kg": 25.0, "avg_life_span_years": 11.0, "temperament": "사회적이고 협력적이며 지능이 높다. 무리 생활을 하며 사냥 본능이 강하다. 야생견으로 가정견으로는 적합하지 않다."},
    "english_setter": {"avg_weight_kg": 29.0, "avg_life_span_years": 13.0, "temperament": "온화하고 친근하며 사교적이다. 에너지가 넘치고 훈련하기 쉽다. 가족 친화적이고 어린이와 잘 어울린다."},
    "gordon_setter": {"avg_weight_kg": 27.5, "avg_life_span_years": 12.5, "temperament": "충성스럽고 자신감이 있으며 활발하다. 에너지가 넘치고 훈련하기 쉽다. 가족에게 헌신적이고 독립적이다."},
    "brittany_spaniel": {"avg_weight_kg": 17.5, "avg_life_span_years": 13.5, "temperament": "활발하고 지능이 높으며 순종적이다. 에너지가 넘치고 사냥 본능이 강하다. 가족 친화적이고 훈련하기 쉽다."},
    "clumber": {"avg_weight_kg": 32.5, "avg_life_span_years": 12.0, "temperament": "온화하고 충성스러우며 차분하다. 사냥 능력이 뛰어나지만 느긋한 편이다. 가족에게 애정이 넘친다."},
    "english_springer": {"avg_weight_kg": 22.5, "avg_life_span_years": 13.0, "temperament": "활발하고 외향적이며 순종적이다. 지능이 높고 훈련하기 쉬우며 에너지가 넘친다. 가족 친화적이고 어린이와 잘 어울린다."},
    "welsh_springer_spaniel": {"avg_weight_kg": 20.0, "avg_life_span_years": 13.0, "temperament": "활발하고 충성스러우며 온화하다. 에너지가 넘치고 훈련하기 쉽다. 가족에게 헌신적이고 사교적이다."},
    "sussex_spaniel": {"avg_weight_kg": 20.0, "avg_life_span_years": 13.0, "temperament": "온화하고 차분하며 충성스럽다. 완고한 편이지만 애정이 넘친다. 가족에게 헌신적이고 사교적이다."},
}


def update_extra_breeds():
    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 업데이트 안 된 품종만 조회
    result = db.table("breeds").select("id, breed_model, name_ko").is_("avg_weight_kg", "null").execute()
    breeds = result.data

    print(f"데이터 없는 품종 {len(breeds)}개 처리 시작...\n")

    updated = 0
    not_found = []

    for breed in breeds:
        breed_id = breed["id"]
        breed_model = breed["breed_model"]
        name_ko = breed["name_ko"]

        data = EXTRA_BREED_DATA.get(breed_model)

        if not data:
            for key, val in EXTRA_BREED_DATA.items():
                if key in breed_model or breed_model in key:
                    data = val
                    break

        if data:
            try:
                db.table("breeds").update({
                    "avg_weight_kg": data["avg_weight_kg"],
                    "avg_life_span_years": data["avg_life_span_years"],
                    "temperament": data["temperament"],
                }).eq("id", breed_id).execute()
                print(f"✅ {name_ko} ({breed_model})")
                updated += 1
            except Exception as e:
                print(f"❌ {name_ko}: {e}")
        else:
            not_found.append(f"{name_ko} ({breed_model})")

        time.sleep(0.05)

    print(f"\n=== 결과 ===")
    print(f"✅ 업데이트: {updated}개")
    print(f"⚠️  매칭 안됨: {len(not_found)}개")
    if not_found:
        print("\n매칭 안된 품종:")
        for n in not_found:
            print(f"  - {n}")


if __name__ == "__main__":
    update_extra_breeds()
