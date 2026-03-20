# CHANGELOG

## v2.7.0 — 2026-03-20

> **Debate Chain pair2 모드** — Claude(Part1) + Codex(Part2) 병렬 생성
> AI 서비스 추론 속도 최적화

### ai-service 전면 리팩터링

#### 새 파일

- `image_pipeline.py` — 이미지 1회 전처리 (decode+resize+hash), PreprocessedImage dataclass
- `prediction_cache.py` — Thread-safe LRU 캐시 (128개, TTL 5분)

#### 성능 최적화

- **병렬 추론**: `asyncio.gather(predict_dog, predict_breed)` — ~50% 속도 향상
- **이미지 1회 전처리**: PIL 변환 중복 제거
- **run_in_executor**: model.predict() 비동기화
- **LRU 캐시**: 동일 이미지 재요청 시 즉시 응답
- **모듈 레벨 import + Warmup**: 첫 요청 지연 제거

#### API 추가

- `GET /cache/stats`, `POST /cache/clear`, `GET /health` (v2)

---

## v2.6.0 — 2026-03-20

### 버그 수정

- **`BreedResultScreen`**: `gradcamUri` params 누락 수정 (화면 크래시 해결)
- **`ai-service/server.py`**: GradCAM import 에러 traceback 출력 추가
- **`ai-service/server.py`**: `breed` 경로 sys.path 명시적 추가
- **`ai-service/.venv`**: 경로 깨진 가상환경 재생성 (Python 3.12 기준)
- **`ai-service`**: `matplotlib` 패키지 누락 설치

---

## v2.5.0 — 2026-03-20

### 프론트엔드 UI 개선

- **`UploadScreen`**: 로고 이미지 `width: 100%` + `height: 220` + `cover`로 변경 → 브라우저/기기 크기 무관하게 일정하게 표시
- **`assets/logo.png`**: 세로형 → 가로형 배너 이미지로 교체 (1536×1024, 3:2)
- **`types/index.ts`**: `FoodCard`에 `difficulty?: string`, `target_diseases?: string[]` 필드 추가 (타입 오류 수정)

---

## v2.4.0 — 2026-03-20

### 성능 개선 - Lazy Loading

- **`recommendations.py`**: API 분리 — `GET /recommendations` (DB만 즉시 반환) / `GET /recommendations/summary` (LLM summary 별도)
- **`RecommendationScreen`**: `CollapsibleSummary` lazy 로딩 — "AI 추천 이유" 버튼 펼칠 때만 LLM 호출, 초기 로딩 속도 대폭 개선
- **`recommendations.ts`**: `getRecommendationSummary()` API 함수 추가

---

## v2.3.0 — 2026-03-20

### 프론트엔드 UX 개선

- **`BreedResultScreen`**: 유전병 위험 높음/중간/낮음 섹션별 접기/펼치기 (높음 기본 펼침)
- **`BreedResultScreen`**: 맞춤 추천 보기 + 다른 강아지 분석하기 하단 sticky 고정
- **`RecommendationScreen`**: 유전병별 영양소 카드 접기/펼치기 (첫 번째만 기본 펼침)
- **`RecommendationScreen`**: 뒤로가기 + 다른 강아지 분석하기 하단 sticky 고정
- **`RecipeDetailScreen`**: 재료 중복 제거 (이름 기준 dedupe)
- **`RecipeDetailScreen`**: 재료/조리 순서 섹션 접기/펼치기
- **`RecipeDetailScreen`**: 뒤로가기 + 다른 강아지 분석하기 하단 sticky 고정
- **`FloatingChatButton`**: 드래그 가능한 플로팅 AI 챗봇 버튼 추가 (품종 분석 후 모든 페이지)
- **`FloatingChatButton`**: 웹 mouse event / 네이티브 PanResponder 분리 구현
- **`FloatingChatButton`**: 뒤로가기 버튼 클릭 시 챗봇 오작동 버그 수정 (`dragging.current` 조건 추가)
- **`BreedResultScreen`**: top3 품종명 한글 표시 (`breed_ko` 필드 연동)
- **`context/BreedContext`**: 전역 breed 상태 관리 Context 추가
- **`App.tsx`**: BreedProvider 추가, FloatingChatButton 전역 배치

---

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
