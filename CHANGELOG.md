# CHANGELOG

## v2.2.0 — 2026-03-20

### 배포 & 인프라
- **Vercel 배포 연결**: Expo 웹 빌드(`npx expo export --platform web`) Vercel 자동 배포 설정
- **ngrok CORS 프록시**: Vercel Edge Function(`api/proxy/[...path].js`)으로 ngrok 우회 프록시 구현, `ngrok-skip-browser-warning` 헤더 자동 주입
- **GitHub 연동**: Dog-AI-Agent 조직 레포 Vercel 자동 배포 연결
- **루트 vercel.json**: 팀원 공통 빌드 설정 적용 (`buildCommand`, `outputDirectory`, `rewrites`)
- **DEV_GUIDE.md**: 로컬 개발 환경 설정 가이드 문서 추가

### 백엔드 버그 수정
- **`recommendations.py`**: `PGRST205` 에러 코드 처리 추가 (schema cache에서 테이블 못 찾는 경우)
- **`recommendations.py`**: `breeds.summary` 컬럼 없음 오류 수정 → select에서 제거
- **`recommendations.py`**: `recipes.title` 컬럼 없음 오류 수정 → `title_ko/title_en` 폴백 처리
- **`recipes.py`**: `size_category` 기반 칼로리 동적 계산 추가 (`calories_small/medium/large`)
- **`recipes.py`**: 중복 재료 제거 후 칼로리 합산 로직 추가
- **`recipes.py`**: LLM 응답 `### 재료` 섹션 파싱 → g수 기반 정밀 칼로리 계산
- **`ai.py`**: `breed_ko` 필드 추가 — top3 품종명 DB에서 한글 변환 후 반환
- **`schemas.py`**: `TopKPrediction`에 `breed_ko: Optional[str]` 필드 추가
- **`backend/.venv`**: 경로 깨진 가상환경 재생성 (기존 `D:\dog-dan\backend` 경로 → 현재 경로)

### 데이터
- **`recipes` 테이블**: `cook_time_min` 요리 유형별 일괄 업데이트 (볼 10분, 스튜 20분, 죽 25분, 사골 120분 등)
- **`recipes` 테이블**: `calories_per_serving` 재료 칼로리 합산으로 일괄 업데이트 (medium 기준)
- **`breeds` 테이블**: 120개 품종 `avg_weight_kg`, `avg_life_span_years`, `temperament` 데이터 추가
- **`data/update_breeds.py`**: 43개 주요 품종 자동 업데이트 스크립트
- **`data/update_breeds_extra.py`**: 나머지 77개 품종 추가 업데이트 스크립트

### 프론트엔드
- **`client.ts`**: `EXPO_PUBLIC_API_URL` 환경변수 기반 BASE_URL 설정
- **`client.ts`**: `ngrok-skip-browser-warning` 헤더 자동 추가
- **`DonutChart.tsx`**: top3 품종명 한글 우선 표시 (`breed_ko || breed`)
- **`types/index.ts`**: `TopKPrediction`에 `breed_ko?: string` 추가
- **`RecipeDetailScreen.tsx`**: 조리시간, 칼로리 표시 (데이터 연동)

---

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
