# CHANGELOG

## v2.1.0 — 2026-03-19

> **Debate Chain 3-AI 코드 리뷰 적용** (8.0/10 수렴)
> Claude Opus 4.6 (Generator) + GPT-5.4 (Critic) + Gemini (Verifier) 병렬 리뷰 3라운드

### recommendations.py 전면 리팩터링

#### 성능 개선

- **테이블 감지 캐싱**: 매 요청마다 `_table_exists()` 호출하던 것을 FastAPI `lifespan`에서 1회 초기화 후 `TableConfig` dataclass로 캐싱
- **쿼리 제한**: `MAX_INGREDIENTS_PER_DISEASE=30`, `MAX_FOODS=50`, `MAX_RECIPES=20` 상수화
- **LLM 타임아웃**: `generate_summary()`에 `asyncio.wait_for(timeout=10)` 적용, 타임아웃 시 기본 메시지 폴백

#### 보안 강화

- **입력 검증**: `breed_id` 파라미터에 정규식(`^[a-zA-Z0-9_-]+$`), 길이 제한(1~64자) 적용
- **에러 처리 특화**: `except Exception: pass` → `except PostgrestAPIError`로 교체, 코드/메시지별 분기 처리
- **방어적 필드 접근**: `_safe_str()` (필수 필드, 없으면 에러) / `_opt_str()` (선택 필드, 없으면 빈 문자열) 유틸 도입

#### 코드 품질

- **함수 분리**: 200줄 단일 함수 → 10개 소함수로 분리 (`_build_disease_map`, `_fetch_disease_ingredients`, `_build_nutrient_tabs`, `_fetch_food_tabs`, `_fetch_recipes` 등)
- **관련성 랭킹**: 음식은 영양소 매칭 수 기준, 레시피는 (질병 매칭 수 + 심각도) 기준으로 정렬 후 상위 N개 반환
- **로깅 추가**: `logging.getLogger(__name__)` 활용, 비정상 상황 `exc_info=True`로 추적 가능

#### main.py

- FastAPI 앱에 `lifespan` 연결 (서버 시작 시 테이블 설정 초기화)
- 버전 2.1.0으로 업데이트

### Debate Chain 리뷰 요약

| 라운드 | Critic (GPT-5.4)                               | Verifier (Gemini)                    | 평균           |
| ------ | ---------------------------------------------- | ------------------------------------ | -------------- |
| R1     | -                                              | -                                    | Generator 초안 |
| R2     | 지적: bare except, 무제한 쿼리, 입력 검증 없음 | 지적: 매 요청 테이블 감지, 랭킹 없음 | 미달           |
| R3     | 8.0/10                                         | 8.0/10                               | **8.0 (수렴)** |

---

## v2.0 — 2026-03-19

> 스토리보드 v2.1 + PRD 테이블 정의서 v2.1 기준 통합 정보

### 프론트엔드

- Navigation: Upload → BreedResult → Recommendation → RecipeDetail
- 5개 스크린 전면 재작성 (NativeWind Tailwind 스타일)
- 공통 컴포넌트: LoadingSpinner, ErrorState, EmptyState, Disclaimer, RiskBadge, DonutChart
- API 타입 정의 v2 (types/index.ts)

### 백엔드

- DB 스키마 v2 (foods, food_ingredients, recipe_foods, recipe_target_diseases 테이블 추가)
- Routers: recommendations, recipes, diseases, breeds, ai 전면 재작성
- Seed 스크립트 v2 (CSV + JSON → Supabase)
- Migration SQL (v1 → v2)
- config.py에서 하드코딩된 API 키 제거 → 환경변수 전용

### 데이터 구조

```
breeds → breed_diseases → diseases → disease_ingredients → ingredients
                                   → foods → food_ingredients
                                           → recipe_foods → recipes
recipes → recipe_steps (조리 단계)
recipes → recipe_target_diseases (대상 유전병)
```
