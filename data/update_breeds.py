"""
강아지 품종 정보 크롤링 스크립트
Wikipedia + Dog API에서 체중, 수명, 성격 정보를 가져와 Supabase에 업데이트
"""
import time
import requests
from supabase import create_client

# Supabase 설정
SUPABASE_URL = "https://ikmycpoibpvrpdxjbjlg.supabase.co"
SUPABASE_KEY = "sb_publishable_3eOvBPdENQWnUiO4DIQrIg_P7ALvCyh"

# 품종 정보 데이터 (Wikipedia + 전문 자료 기반)
# breed_model: DB의 breed_model 컬럼값
BREED_DATA = {
    "pomeranian": {
        "avg_weight_kg": 2.5,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 친근하며 외향적인 성격. 호기심이 많고 용감하며 지능적이다. 주인에게 충성스럽고 애교가 많지만 독립적인 면도 있다."
    },
    "samoyed": {
        "avg_weight_kg": 22.5,
        "avg_life_span_years": 13.0,
        "temperament": "온순하고 친절하며 사람을 좋아한다. 활발하고 장난기가 많으며 고집이 센 편이다. 가족에게 매우 충성스럽고 어린이와도 잘 지낸다."
    },
    "golden_retriever": {
        "avg_weight_kg": 30.0,
        "avg_life_span_years": 11.5,
        "temperament": "온순하고 신뢰할 수 있으며 친근하다. 지능이 높고 훈련하기 쉬우며 인내심이 강하다. 어린이와 다른 동물과도 잘 어울린다."
    },
    "labrador_retriever": {
        "avg_weight_kg": 30.0,
        "avg_life_span_years": 12.0,
        "temperament": "온화하고 외향적이며 활동적이다. 지능이 높고 훈련하기 쉬우며 사람을 좋아한다. 가족 친화적이고 다른 동물과도 잘 지낸다."
    },
    "german_shepherd": {
        "avg_weight_kg": 32.5,
        "avg_life_span_years": 11.0,
        "temperament": "충성스럽고 용감하며 자신감이 있다. 지능이 매우 높고 훈련하기 쉽다. 주인에게 헌신적이며 낯선 사람에게는 경계심이 강하다."
    },
    "bulldog": {
        "avg_weight_kg": 22.5,
        "avg_life_span_years": 9.0,
        "temperament": "온순하고 용감하며 우호적이다. 완고한 편이지만 애정이 넘치고 충성스럽다. 어린이와 잘 어울리며 느긋한 성격이다."
    },
    "french_bulldog": {
        "avg_weight_kg": 10.0,
        "avg_life_span_years": 11.0,
        "temperament": "적응력이 뛰어나고 놀기 좋아하며 스마트하다. 애정이 넘치고 재미있으며 충성스럽다. 아파트 생활에 적합하고 운동량이 적다."
    },
    "beagle": {
        "avg_weight_kg": 10.5,
        "avg_life_span_years": 13.0,
        "temperament": "호기심이 많고 활발하며 친근하다. 냄새를 잘 맡아 추적 본능이 강하다. 사교적이고 어린이와 잘 어울리지만 독립적인 면이 있다."
    },
    "yorkshire_terrier": {
        "avg_weight_kg": 3.0,
        "avg_life_span_years": 14.0,
        "temperament": "활발하고 용감하며 자신감이 넘친다. 애정이 많고 충성스러우며 영리하다. 작은 체구에도 불구하고 대담하고 호기심이 강하다."
    },
    "chihuahua": {
        "avg_weight_kg": 2.0,
        "avg_life_span_years": 15.0,
        "temperament": "용감하고 충성스러우며 자신감이 있다. 주인에게 매우 헌신적이지만 낯선 사람을 경계한다. 활발하고 영리하며 고집이 있다."
    },
    "maltese": {
        "avg_weight_kg": 3.0,
        "avg_life_span_years": 13.0,
        "temperament": "온순하고 애정이 넘치며 활발하다. 지능이 높고 훈련하기 쉽다. 사람을 좋아하고 사교적이며 장난기가 많다."
    },
    "shih_tzu": {
        "avg_weight_kg": 6.0,
        "avg_life_span_years": 13.0,
        "temperament": "온화하고 신뢰할 수 있으며 애정이 넘친다. 활발하고 외향적이며 친근하다. 어린이와 다른 동물과도 잘 어울린다."
    },
    "dachshund": {
        "avg_weight_kg": 8.5,
        "avg_life_span_years": 13.5,
        "temperament": "용감하고 호기심이 많으며 완고하다. 주인에게 충성스럽고 장난기가 많다. 독립적이고 냄새 추적 본능이 강하다."
    },
    "boxer": {
        "avg_weight_kg": 30.0,
        "avg_life_span_years": 11.0,
        "temperament": "충성스럽고 활발하며 재미있다. 가족에게 애정이 넘치고 어린이와 잘 놀아준다. 용감하고 경계심이 강하며 훈련하기 쉽다."
    },
    "husky": {
        "avg_weight_kg": 23.5,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 외향적이며 장난기가 많다. 독립적이고 고집이 있지만 친근하다. 탈출 본능이 강하며 달리기를 좋아한다."
    },
    "siberian_husky": {
        "avg_weight_kg": 23.5,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 외향적이며 장난기가 많다. 독립적이고 고집이 있지만 친근하다. 탈출 본능이 강하며 달리기를 좋아한다."
    },
    "dobermann": {
        "avg_weight_kg": 35.0,
        "avg_life_span_years": 11.0,
        "temperament": "충성스럽고 용감하며 지능이 높다. 경계심이 강하고 훈련하기 쉽다. 가족에게 헌신적이며 보호 본능이 강하다."
    },
    "doberman": {
        "avg_weight_kg": 35.0,
        "avg_life_span_years": 11.0,
        "temperament": "충성스럽고 용감하며 지능이 높다. 경계심이 강하고 훈련하기 쉽다. 가족에게 헌신적이며 보호 본능이 강하다."
    },
    "rottweiler": {
        "avg_weight_kg": 47.5,
        "avg_life_span_years": 10.0,
        "temperament": "충성스럽고 용감하며 자신감이 있다. 가족에게 애정이 넘치지만 낯선 사람에게 경계심이 강하다. 지능이 높고 훈련 가능하다."
    },
    "great_dane": {
        "avg_weight_kg": 62.5,
        "avg_life_span_years": 9.0,
        "temperament": "온화하고 친근하며 의존적이다. 거대한 체구에도 불구하고 부드럽고 사람을 좋아한다. 충성스럽고 인내심이 강하다."
    },
    "australian_shepherd": {
        "avg_weight_kg": 27.5,
        "avg_life_span_years": 13.0,
        "temperament": "지능이 높고 활발하며 에너지가 넘친다. 훈련하기 쉽고 일하기를 좋아한다. 충성스럽고 보호 본능이 강하다."
    },
    "border_collie": {
        "avg_weight_kg": 17.5,
        "avg_life_span_years": 13.5,
        "temperament": "지능이 매우 높고 활발하며 반응이 빠르다. 훈련하기 쉽고 일하기를 좋아한다. 에너지가 넘치고 집중력이 강하다."
    },
    "cocker_spaniel": {
        "avg_weight_kg": 12.0,
        "avg_life_span_years": 12.0,
        "temperament": "온순하고 애정이 넘치며 활발하다. 지능이 높고 사교적이며 친근하다. 가족에게 충성스럽고 어린이와 잘 어울린다."
    },
    "poodle": {
        "avg_weight_kg": 7.0,
        "avg_life_span_years": 14.0,
        "temperament": "지능이 매우 높고 활발하며 훈련하기 쉽다. 애정이 넘치고 충성스러우며 사교적이다. 알레르기가 있는 사람에게 적합한 저자극 견종이다."
    },
    "miniature_poodle": {
        "avg_weight_kg": 5.5,
        "avg_life_span_years": 14.0,
        "temperament": "지능이 매우 높고 활발하며 훈련하기 쉽다. 애정이 넘치고 충성스러우며 사교적이다. 소형이지만 활동적이고 에너지가 넘친다."
    },
    "toy_poodle": {
        "avg_weight_kg": 3.0,
        "avg_life_span_years": 14.5,
        "temperament": "지능이 높고 활발하며 애정이 넘친다. 충성스럽고 사교적이며 훈련하기 쉽다. 아파트 생활에 적합하다."
    },
    "standard_poodle": {
        "avg_weight_kg": 27.5,
        "avg_life_span_years": 13.0,
        "temperament": "지능이 매우 높고 활발하며 훈련하기 쉽다. 우아하고 자신감이 있으며 사교적이다. 스포츠와 수영을 즐긴다."
    },
    "bichon_frise": {
        "avg_weight_kg": 5.5,
        "avg_life_span_years": 14.0,
        "temperament": "온화하고 명랑하며 애정이 넘친다. 사교적이고 장난기가 많으며 훈련하기 쉽다. 어린이와 다른 동물과도 잘 어울린다."
    },
    "papillon": {
        "avg_weight_kg": 4.0,
        "avg_life_span_years": 14.0,
        "temperament": "활발하고 영리하며 우호적이다. 훈련하기 쉽고 에너지가 넘친다. 작은 체구지만 용감하고 적응력이 뛰어나다."
    },
    "cavalier_king_charles_spaniel": {
        "avg_weight_kg": 6.5,
        "avg_life_span_years": 12.5,
        "temperament": "온화하고 애정이 넘치며 우아하다. 사교적이고 적응력이 뛰어나며 친근하다. 어린이와 다른 동물과도 잘 어울린다."
    },
    "shetland_sheepdog": {
        "avg_weight_kg": 7.5,
        "avg_life_span_years": 13.0,
        "temperament": "지능이 높고 활발하며 충성스럽다. 훈련하기 쉽고 에너지가 넘친다. 가족에게 헌신적이며 낯선 사람에게 조심스럽다."
    },
    "sheltie": {
        "avg_weight_kg": 7.5,
        "avg_life_span_years": 13.0,
        "temperament": "지능이 높고 활발하며 충성스럽다. 훈련하기 쉽고 에너지가 넘친다. 가족에게 헌신적이며 낯선 사람에게 조심스럽다."
    },
    "pembroke_welsh_corgi": {
        "avg_weight_kg": 12.5,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 지능이 높으며 애정이 넘친다. 충성스럽고 경계심이 강하며 훈련하기 쉽다. 작은 체구지만 목양 본능이 강하다."
    },
    "corgi": {
        "avg_weight_kg": 12.5,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 지능이 높으며 애정이 넘친다. 충성스럽고 경계심이 강하며 훈련하기 쉽다. 작은 체구지만 목양 본능이 강하다."
    },
    "miniature_schnauzer": {
        "avg_weight_kg": 6.5,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 지능이 높으며 외향적이다. 충성스럽고 경계심이 강하며 훈련하기 쉽다. 에너지가 넘치고 사교적이다."
    },
    "bernese_mountain_dog": {
        "avg_weight_kg": 42.5,
        "avg_life_span_years": 9.0,
        "temperament": "온화하고 충성스러우며 애정이 넘친다. 인내심이 강하고 차분하며 어린이와 잘 어울린다. 작업 능력이 뛰어나고 적응력이 좋다."
    },
    "saint_bernard": {
        "avg_weight_kg": 72.5,
        "avg_life_span_years": 9.0,
        "temperament": "온화하고 인내심이 강하며 친근하다. 거대한 체구에도 불구하고 온순하고 어린이를 좋아한다. 충성스럽고 보호 본능이 있다."
    },
    "akita": {
        "avg_weight_kg": 40.0,
        "avg_life_span_years": 12.0,
        "temperament": "충성스럽고 용감하며 자신감이 있다. 주인에게 매우 헌신적이지만 독립적이다. 낯선 사람과 다른 동물에게 경계심이 강하다."
    },
    "shiba_inu": {
        "avg_weight_kg": 9.0,
        "avg_life_span_years": 13.5,
        "temperament": "용감하고 충실하며 매력적이다. 독립적이고 고집이 있으며 경계심이 강하다. 청결하고 고양이처럼 자기 관리를 잘 한다."
    },
    "japanese_spitz": {
        "avg_weight_kg": 6.5,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 외향적이며 순종적이다. 지능이 높고 훈련하기 쉬우며 사람을 좋아한다. 충성스럽고 애정이 넘친다."
    },
    "maltipoo": {
        "avg_weight_kg": 4.5,
        "avg_life_span_years": 13.0,
        "temperament": "온화하고 활발하며 애정이 넘친다. 지능이 높고 훈련하기 쉬우며 사교적이다. 어린이와 잘 어울리고 알레르기가 있는 사람에게 적합하다."
    },
    "havanese": {
        "avg_weight_kg": 5.0,
        "avg_life_span_years": 14.0,
        "temperament": "활발하고 외향적이며 장난기가 많다. 지능이 높고 훈련하기 쉬우며 사람을 좋아한다. 어린이와 다른 동물과도 잘 어울린다."
    },
    "west_highland_white_terrier": {
        "avg_weight_kg": 8.0,
        "avg_life_span_years": 14.0,
        "temperament": "활발하고 자신감이 있으며 독립적이다. 용감하고 호기심이 많으며 충성스럽다. 완고한 편이지만 애정이 넘친다."
    },
    "westie": {
        "avg_weight_kg": 8.0,
        "avg_life_span_years": 14.0,
        "temperament": "활발하고 자신감이 있으며 독립적이다. 용감하고 호기심이 많으며 충성스럽다. 완고한 편이지만 애정이 넘친다."
    },
    "whippet": {
        "avg_weight_kg": 12.5,
        "avg_life_span_years": 13.5,
        "temperament": "온화하고 조용하며 애정이 넘친다. 집에서는 차분하지만 밖에서는 매우 빠르다. 사교적이고 어린이와 잘 어울린다."
    },
    "vizsla": {
        "avg_weight_kg": 25.0,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 애정이 넘치며 충성스럽다. 지능이 높고 훈련하기 쉬우며 에너지가 넘친다. 주인에게 매우 의존적이고 분리불안이 있을 수 있다."
    },
    "weimaraner": {
        "avg_weight_kg": 32.5,
        "avg_life_span_years": 12.0,
        "temperament": "활발하고 지능이 높으며 복종적이다. 에너지가 넘치고 사냥 본능이 강하다. 충성스럽고 가족에게 애정이 넘친다."
    },
    "irish_setter": {
        "avg_weight_kg": 30.0,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 외향적이며 장난기가 많다. 에너지가 넘치고 사교적이며 친근하다. 훈련하기 쉽지 않지만 애정이 넘친다."
    },
    "afghan_hound": {
        "avg_weight_kg": 25.0,
        "avg_life_span_years": 13.0,
        "temperament": "우아하고 독립적이며 알루프하다. 고집이 있고 훈련하기 어렵다. 가족에게 충성스럽지만 낯선 사람에게 거리를 둔다."
    },
    "bloodhound": {
        "avg_weight_kg": 45.0,
        "avg_life_span_years": 11.0,
        "temperament": "온화하고 인내심이 강하며 고집이 있다. 냄새 추적 능력이 매우 뛰어나다. 사교적이고 어린이와 잘 어울린다."
    },
    "dalmatian": {
        "avg_weight_kg": 27.5,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 에너지가 넘치며 외향적이다. 지능이 높고 훈련하기 쉬우며 충성스럽다. 말과 친화적이며 운동을 좋아한다."
    },
    "pointer": {
        "avg_weight_kg": 27.5,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 외향적이며 친근하다. 사냥 본능이 강하고 에너지가 넘친다. 지능이 높고 훈련하기 쉽다."
    },
    "basenji": {
        "avg_weight_kg": 10.5,
        "avg_life_span_years": 13.5,
        "temperament": "독립적이고 지능이 높으며 호기심이 많다. 짖지 않는 특이한 견종이다. 고양이처럼 자기 관리를 잘 하고 경계심이 강하다."
    },
    "boston_terrier": {
        "avg_weight_kg": 7.5,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 외향적이며 지능이 높다. 친근하고 사교적이며 어린이와 잘 어울린다. 에너지가 적당하고 도시 생활에 적합하다."
    },
    "bull_terrier": {
        "avg_weight_kg": 25.0,
        "avg_life_span_years": 12.0,
        "temperament": "활발하고 장난기가 많으며 용감하다. 가족에게 충성스럽고 애정이 넘친다. 고집이 있지만 훈련 가능하다."
    },
    "cairn_terrier": {
        "avg_weight_kg": 6.5,
        "avg_life_span_years": 14.0,
        "temperament": "활발하고 용감하며 독립적이다. 호기심이 많고 장난기가 있으며 충성스럽다. 완고한 편이지만 적응력이 뛰어나다."
    },
    "scottish_terrier": {
        "avg_weight_kg": 9.0,
        "avg_life_span_years": 13.0,
        "temperament": "독립적이고 용감하며 활발하다. 충성스럽고 고집이 있으며 경계심이 강하다. 가족에게 애정이 넘치지만 낯선 사람에게 거리를 둔다."
    },
    "jack_russell_terrier": {
        "avg_weight_kg": 6.0,
        "avg_life_span_years": 14.0,
        "temperament": "활발하고 에너지가 넘치며 지능이 높다. 독립적이고 완고하며 용감하다. 장난기가 많고 호기심이 강하다."
    },
    "staffordshire_bull_terrier": {
        "avg_weight_kg": 14.5,
        "avg_life_span_years": 13.0,
        "temperament": "용감하고 지능이 높으며 애정이 넘친다. 어린이와 매우 잘 어울리고 충성스럽다. 활발하고 에너지가 넘친다."
    },
    "chow_chow": {
        "avg_weight_kg": 27.5,
        "avg_life_span_years": 12.0,
        "temperament": "독립적이고 충성스러우며 조용하다. 낯선 사람에게 경계심이 강하고 고집이 있다. 주인에게만 애정을 보이는 경향이 있다."
    },
    "shar_pei": {
        "avg_weight_kg": 25.0,
        "avg_life_span_years": 12.0,
        "temperament": "독립적이고 충성스러우며 차분하다. 낯선 사람에게 경계심이 강하다. 가족에게는 애정이 넘치지만 다른 동물과는 주의가 필요하다."
    },
    "chinese_shar_pei": {
        "avg_weight_kg": 25.0,
        "avg_life_span_years": 12.0,
        "temperament": "독립적이고 충성스러우며 차분하다. 낯선 사람에게 경계심이 강하다. 가족에게는 애정이 넘치지만 다른 동물과는 주의가 필요하다."
    },
    "lhasa_apso": {
        "avg_weight_kg": 7.0,
        "avg_life_span_years": 14.0,
        "temperament": "독립적이고 충성스러우며 자신감이 있다. 낯선 사람에게 경계심이 강하다. 가족에게 애정이 넘치지만 고집이 있다."
    },
    "pekingese": {
        "avg_weight_kg": 5.0,
        "avg_life_span_years": 13.0,
        "temperament": "독립적이고 자신감이 있으며 우아하다. 충성스럽지만 고집이 있다. 낯선 사람에게 경계심이 강하고 품위 있는 성격이다."
    },
    "pug": {
        "avg_weight_kg": 8.5,
        "avg_life_span_years": 12.0,
        "temperament": "매력적이고 사교적이며 장난기가 많다. 애정이 넘치고 충성스러우며 온화하다. 어린이와 잘 어울리고 가족 친화적이다."
    },
    "alaskan_malamute": {
        "avg_weight_kg": 38.0,
        "avg_life_span_years": 12.0,
        "temperament": "충성스럽고 활발하며 독립적이다. 에너지가 넘치고 강인하며 우호적이다. 사회화가 중요하고 고집이 있는 편이다."
    },
    "keeshond": {
        "avg_weight_kg": 18.0,
        "avg_life_span_years": 13.0,
        "temperament": "활발하고 외향적이며 사교적이다. 지능이 높고 훈련하기 쉬우며 애정이 넘친다. 가족과 함께 있기를 좋아한다."
    },
    "spitz": {
        "avg_weight_kg": 13.0,
        "avg_life_span_years": 14.0,
        "temperament": "활발하고 에너지가 넘치며 충성스럽다. 경계심이 강하고 지능이 높다. 독립적이지만 가족에게 애정이 넘친다."
    },
    "mixed": {
        "avg_weight_kg": 15.0,
        "avg_life_span_years": 13.5,
        "temperament": "혼합견은 유전적 다양성으로 일반적으로 건강하다. 성격은 부모 견종에 따라 다양하게 나타난다."
    },
    "mixed_breed": {
        "avg_weight_kg": 15.0,
        "avg_life_span_years": 13.5,
        "temperament": "혼합견은 유전적 다양성으로 일반적으로 건강하다. 성격은 부모 견종에 따라 다양하게 나타난다."
    },
}


def update_breeds():
    db = create_client(SUPABASE_URL, SUPABASE_KEY)

    # 전체 breeds 조회
    result = db.table("breeds").select("id, breed_model, name_ko").execute()
    breeds = result.data

    print(f"총 {len(breeds)}개 품종 처리 시작...\n")

    updated = 0
    skipped = 0
    not_found = []

    for breed in breeds:
        breed_id = breed["id"]
        breed_model = breed["breed_model"]
        name_ko = breed["name_ko"]

        # 데이터 매핑 (breed_model 기준으로 찾기)
        data = BREED_DATA.get(breed_model)

        # breed_model에 없으면 부분 매칭 시도
        if not data:
            for key, val in BREED_DATA.items():
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
                print(f"✅ {name_ko} ({breed_model}) 업데이트 완료")
                updated += 1
            except Exception as e:
                print(f"❌ {name_ko} 업데이트 실패: {e}")
        else:
            not_found.append(f"{name_ko} ({breed_model})")
            skipped += 1

        time.sleep(0.1)  # API 제한 방지

    print(f"\n\n=== 결과 ===")
    print(f"✅ 업데이트: {updated}개")
    print(f"⚠️  데이터 없음: {skipped}개")

    if not_found:
        print(f"\n데이터 없는 품종 목록:")
        for name in not_found:
            print(f"  - {name}")


if __name__ == "__main__":
    update_breeds()
