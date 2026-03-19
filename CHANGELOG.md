# CHANGELOG

## v2.0 — 2026-03-19

> **목표**: 스토리보드(v2.1) · PRD 테이블 정의서(v2.1) 기준 정합성 확보  
> **원칙**: 기존 데이터 최대 보존, 스토리보드/테이블설계 변경 없음, 레이아웃만 수정

---

### 프론트엔드

#### Navigation (`src/navigation/RootStack.tsx`)
- `LandingScreen` 제거, `UploadScreen`을 `initialRouteName`으로 변경
- 모든 "다른 강아지 분석하기" → `Upload` 화면으로 `navigation.reset`
- 화면 흐름: **Upload → BreedResult → Recommendation → RecipeDetail** (4개)
- `LandingScreen.tsx` 파일은 잔류 (네비게이션에서 미참조, 삭제 가능)

#### S1 — UploadScreen (`src/screens/UploadScreen.tsx`)
- Landing + Upload 통합: idle 상태에서 서비스 소개 + 3단계 사용 안내 표시
- `file_selected` 상태: 이미지 미리보기 + "탭하여 재선택" 오버레이 + 분석하기 버튼
- 에러 메시지를 스토리보드 S2 에러 케이스 테이블 기준으로 세분화:
  - `400` → 파일 형식 에러
  - `413` → 파일 크기 에러
  - `422 DOG_NOT_DETECTED` → 강아지 미인식
  - `422 BREED_MAPPING_FAILED` → 품종 매칭 실패
  - `429` → Rate limit
  - `500` → 서버 에러
- 하단에 디스클레이머 + 팀 크레딧 추가

#### S3 — BreedResultScreen (`src/screens/BreedResultScreen.tsx`)
- **2×2 기본 정보 그리드**: 크기 · 평균 체중 · 평균 수명 · 성격
- **순종/믹스견 뱃지**: `is_purebred=true` → 파란색 "순종" / `false` → 노란색 "믹스견 추정"
- 유전병 risk_level 뱃지를 `RiskBadge` 컴포넌트로 교체 (높음 빨강 / 중간 주황 / 낮음 초록)
- confidence 퍼센트 우측 표시

#### S4 — RecommendationScreen (`src/screens/RecommendationScreen.tsx`)
- 탭 구조를 스토리보드 기준 **2탭**으로 변경:
  - **탭1 "유전병별 영양소"**: `tab_nutrients[]` → 유전병 카드 + severity 뱃지 + 권장 영양소 리스트 (effect_description 포함)
  - **탭2 "추천 음식"**: `tab_foods[]` → 음식 카드 + category 뱃지 + 관련 영양소 태그 + `recipe_ids.length`개 표시
- `tab_foods` 비어있으면 `recipes[]` fallback으로 기존 레시피 카드 표시
- 난이도 한글 변환 (easy→쉬움, medium→보통, hard→어려움)
- 대상 유전병 태그 빨간 뱃지

#### S5 — RecipeDetailScreen (`src/screens/RecipeDetailScreen.tsx`)
- **4열 메타 그리드**: ⏱ 조리시간 · 🔥 칼로리 · 📊 난이도 · 🍽 인분
- 재료 체크리스트: 커스텀 체크박스 UI (체크 시 초록 배경 + 취소선)
- 대상 유전병 태그를 제목 바로 아래로 이동
- LLM 재료별 효능 · 급여 안내 섹션 유지

#### 새 컴포넌트
- **`RiskBadge.tsx`** — risk_level/severity 뱃지 (높음·중간·낮음 색상 분리)

#### 수정된 컴포넌트
- **`LoadingSpinner.tsx`** — 경과 시간 기반 메시지 변경 (10초 후 "조금만 기다려주세요") + 프로그레스 바
- **`ErrorState.tsx`** — 이모지 아이콘 + retryLabel prop 추가
- **`EmptyState.tsx`** — 이모지 아이콘 추가
- **`Disclaimer.tsx`** — ⚠ 아이콘 추가

#### 타입 변경 (`src/types/index.ts`)
- `NutrientItem` 추가 (disease_name_ko, severity, recommended_ingredients)
- `FoodCard` 추가 (food_id, name_ko, category, image_url, related_ingredients, recipe_ids)
- `RecommendationResponse` 변경: `feeds/supplements` 제거 → `tab_nutrients/tab_foods` 추가
- `DiseaseDetailResponse` 변경: `prevention_tips: string[]` → `string`, `source_name/source_url` 추가
- `RecipeDetailResponse` 변경: `image_url/source_name/source_url` 추가

#### 스타일 (`tailwind.config.js`)
- risk 색상 추가: `risk-high`, `risk-high-text`, `risk-medium`, `risk-medium-text`, `risk-low`, `risk-low-text`
- `primary-light: "#eef1ff"` 추가

#### 미변경 파일
- `App.tsx`, `api/*` (client, ai, breeds, recommendations, recipes, diseases), `utils/parseSummary.ts`, `DonutChart.tsx`

---

### 백엔드

#### DB 스키마 (`schema.sql` → v2)

| 변경 | 테이블 | 내용 |
|------|--------|------|
| 수정 | `breeds` | `summary TEXT` 추가 (LLM 사전 생성 요약), `synset` 제거, `size_category` CHECK 추가 |
| 수정 | `diseases` | `is_genetic` 제거 → `severity CHECK(low\|medium\|high)` 대체, `prevention_tips TEXT[]→TEXT`, `source_name/source_url` 추가 |
| 수정 | `ingredients` | `effect_description` 제거 (→ `disease_ingredients`로 이동), `category TEXT` 추가, `description TEXT` 추가 |
| **신규** | `foods` | 음식/식재료 테이블 (name_en UK, name_ko, category, description, image_url) |
| 수정 | `recipes` | `title_en/title_ko` → `title` 단일 컬럼, `image_url/source_name/source_url` 추가 |
| 수정 | `breed_diseases` | 별도 UUID PK 제거 → `(breed_id, disease_id)` 복합 PK |
| 수정 | `disease_ingredients` | 복합 PK, `effect_description/source_name/source_url` 추가 |
| **신규** | `food_ingredients` | 음식 ↔ 성분 M:N (`food_id, ingredient_id` 복합 PK) |
| **신규** | `recipe_foods` | 레시피 ↔ 재료 M:N (기존 `recipe_ingredients` 대체, `amount/unit/sort_order`) |
| 수정 | `recipe_steps` | `instruction` → `description` 컬럼명 변경, `UNIQUE(recipe_id, step_number)` 추가 |
| 리네임 | `recipe_target_diseases` | 기존 `recipe_diseases` → PRD 네이밍 정합 |
| **삭제** | `feeds` | 미사용 테이블 제거 |
| **삭제** | `recipe_nutrition` | 미사용 테이블 제거 |

최종: **11개 테이블** (기존 12개에서 feeds/recipe_nutrition 삭제, foods/food_ingredients/recipe_foods 신규)

#### 마이그레이션 (`migration_v1_to_v2.sql`)
- 기존 테이블 전체 DROP → schema.sql 재실행 → seed.py 재시딩 방식
- 데이터 초기화 필요 (CSV 기반 재시딩)

#### Pydantic 스키마 (`models/schemas.py`)
- `NutrientItem` 추가 — 탭1 유전병별 영양소 카드
- `FoodCard` 추가 — 탭2 추천 음식 카드
- `RecommendationResponse` 변경: `tab_nutrients/tab_foods` 필드 추가
- `DiseaseDetailResponse` 변경: `prevention_tips` str, `source_name/source_url` 추가
- `RecipeDetailResponse` 변경: `image_url/source_name/source_url` 추가, `calories_per_serving` float→int

#### 라우터 — v1/v2 호환 방어 코드

**`routers/recommendations.py`**
- `_table_exists()` 헬퍼로 `foods`, `recipe_target_diseases` 테이블 존재 여부 자동 감지
- `disease_ingredients`: try v2(effect_description 포함) → except v1(미포함) 자동 전환
- `tab_nutrients`: 유전병별 영양소 그룹핑 (disease_ingredients JOIN ingredients)
- `tab_foods`: food_ingredients → foods → recipe_foods 체인 (v2 전용, v1에서는 빈 배열)
- `recipes`: `recipes(*)` 와일드카드 셀렉트로 title/title_en 컬럼 충돌 회피
- `summary`: breeds.summary DB 값 우선 → 없으면 LLM fallback

**`routers/recipes.py`**
- 재료: try `recipe_foods → foods` (v2) → except `recipe_ingredients` (v1)
- 조리 단계: `select("*")` + `instruction or description` 양쪽 컬럼명 처리
- 대상 유전병: try `recipe_target_diseases` → except `recipe_diseases` 순차 시도
- 제목: `title or title_ko or title_en` 우선순위 처리

**`routers/diseases.py`**
- `disease_ingredients`: try v2(effect_description 포함) → except v1
- `prevention_tips`: TEXT[] → TEXT 자동 변환 (list이면 join)
- `source_name/source_url` 응답 추가

**`routers/breeds.py`** — 미변경 (기존 코드 호환)

**`routers/ai.py`** — 미변경

#### 시드 스크립트 (`seed.py` → v2)
- `foods` 테이블 시딩 추가 (CSV food 컬럼 → foods)
- `food_ingredients` 매핑 추가 (CSV food ↔ effective_ingredients)
- `recipe_foods` 자동 생성 (음식별 단일 재료 레시피)
- `recipe_target_diseases` 매핑 (기존 recipe_diseases → 테이블명 변경)
- FK 의존성 순서: breeds → diseases → ingredients → foods → breed_diseases → disease_ingredients → food_ingredients → recipes + recipe_foods + recipe_target_diseases
- 시딩 완료 시 Summary 출력

#### 미변경 파일
- `main.py`, `config.py`, `database.py`, `services/llm_service.py`, `utils/image_validation.py`

---

### 적용 방법

#### 기존 DB에서 즉시 실행 (v1 호환 모드)
```bash
# 백엔드 재시작만 하면 됨 — 방어 코드가 v1 스키마 자동 감지
cd backend
python -m uvicorn backend.main:app --reload
```

#### 새 스키마 적용 (v2 전환)
```bash
# 1. Supabase SQL Editor에서 실행
#    → migration_v1_to_v2.sql (기존 테이블 DROP)
#    → schema.sql (새 테이블 생성)

# 2. 재시딩
cd backend
python -m backend.seed

# 3. 서버 재시작
python -m uvicorn backend.main:app --reload
```

---

### Data Mapping Pipeline (v2 기준)

```
[AI Model Output]
breed_model → breeds.breed_model (UNIQUE)
  ↓ JOIN breed_diseases
diseases.id → disease_ingredients.disease_id
  ↓ JOIN ingredients
ingredients.id → food_ingredients.ingredient_id
  ↓ JOIN foods
foods.id → recipe_foods.food_id
  ↓ JOIN recipes
recipes.id → recipe_steps (조리 단계)
recipes.id → recipe_target_diseases (대상 유전병)
```
