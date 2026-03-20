# 🐶 댕슐랭 (Daeng Michelin)

> **AI 기반 반려견 견종 분석 & 맞춤 영양 추천 서비스**

반려견 사진 한 장으로 견종을 분석하고, 유전 질환 기반 맞춤 영양소·식재료·레시피를 추천합니다.

---

## 핵심 기능

| 기능               | 설명                                                                   |
| ------------------ | ---------------------------------------------------------------------- |
| **견종 인식**      | 사진 업로드 → MobileNetV2 기반 개 감지 + 커스텀 모델로 Top-3 견종 분류 |
| **GradCAM 시각화** | AI가 어떤 부위를 보고 판단했는지 히트맵으로 설명                       |
| **유전 질환 분석** | CIDD 데이터 기반 견종별 유전 질환 및 위험도 매핑                       |
| **맞춤 영양 추천** | 질환별 권장 영양소 → 식재료 → 레시피 단계별 추천                       |
| **AI 추천 이유**   | GPT-4o-mini가 수의 영양사 관점에서 추천 근거 설명 (Lazy Loading)       |
| **RAG 챗봇**       | 견종·질환·영양 DB를 컨텍스트로 주입한 대화형 상담                      |
| **소셜 로그인**    | Google / Naver / Kakao OAuth 지원                                      |

---

## 기술 스택

### Frontend

| 항목       | 기술                         |
| ---------- | ---------------------------- |
| Framework  | React Native (Expo ~52)      |
| Language   | TypeScript 5.3               |
| Navigation | React Navigation v7          |
| Styling    | NativeWind v4 (Tailwind CSS) |
| State      | React Context API            |
| Deploy     | Vercel (Expo Web Export)     |

### Backend (port 8000)

| 항목      | 기술                      |
| --------- | ------------------------- |
| Framework | FastAPI (Python 3.11)     |
| Database  | Supabase (PostgreSQL)     |
| Auth      | JWT (python-jose) + OAuth |
| LLM       | OpenAI GPT-4o-mini        |
| Server    | Uvicorn (ASGI)            |

### AI Service (port 8001)

| 항목        | 기술                                         |
| ----------- | -------------------------------------------- |
| 개 감지     | TensorFlow MobileNetV2 (ImageNet pretrained) |
| 견종 분류   | Custom MobileNetV2 Fine-tuned 모델           |
| 설명 가능성 | GradCAM (tf.GradientTape)                    |
| 시각화      | Matplotlib                                   |

### Infra

| 항목            | 기술                      |
| --------------- | ------------------------- |
| Frontend 호스팅 | Vercel                    |
| API Proxy       | Vercel Edge Functions     |
| Dev Tunnel      | ngrok                     |
| CI/CD           | GitHub → Vercel 자동 배포 |

---

## 시스템 아키텍처

```
Mobile / Web App (React Native + Expo)
    │
    ▼
Vercel Edge Function (API Proxy)
    │
    ▼
FastAPI Backend (port 8000)
    ├── Supabase (PostgreSQL) ─── 견종 · 질환 · 영양 데이터
    ├── AI Service (port 8001) ── 견종 분류 · GradCAM 추론
    └── OpenAI API ────────────── LLM 요약 · RAG 챗봇
```

---

## 프로젝트 구조

```
dog-ai-agent_mvp/
├── frontend/                  # React Native (Expo) 앱
│   └── src/
│       ├── api/               # API 클라이언트 (auth, ai, breeds, chat 등)
│       ├── components/        # 공통 UI 컴포넌트
│       ├── context/           # AuthContext, BreedContext
│       ├── screens/           # 화면 (Login, Upload, Result, Recommendation 등)
│       ├── navigation/        # RootStack (인증 분기)
│       ├── types/             # TypeScript 타입 정의
│       └── utils/             # 유틸리티 함수
│
├── backend/                   # FastAPI 메인 API 서버
│   ├── routers/               # 엔드포인트 (ai, auth, breeds, chat 등)
│   ├── services/              # LLM 서비스, 챗봇 서비스
│   ├── models/                # Pydantic 스키마
│   ├── schema.sql             # DB 스키마 (Supabase SQL)
│   └── seed.py                # 시드 데이터 스크립트
│
├── ai-service/                # AI 추론 서버 (TensorFlow)
│   ├── breed/                 # 견종 분류 모델 + GradCAM
│   ├── dog-detection/         # 개 감지 (MobileNetV2)
│   └── LLM/                   # Few-shot 샘플, 번역 매핑
│
├── api/                       # Vercel Edge Functions (프록시)
├── data/                      # CIDD 견종 질환 원본 데이터
└── vercel.json                # Vercel 빌드 + 라우팅 설정
```

---

## 주요 API 엔드포인트

모든 엔드포인트는 `/api/v1` 접두사를 사용합니다.

| 분류   | Method  | Endpoint                       | 설명                                 |
| ------ | ------- | ------------------------------ | ------------------------------------ |
| 인증   | POST    | `/auth/signup`                 | 회원가입 (JWT 발급)                  |
| 인증   | POST    | `/auth/login`                  | 로그인 (JWT 발급)                    |
| AI     | POST    | `/ai/breed-recognition`        | 이미지 → 견종 분류 (Top-3)           |
| AI     | POST    | `/ai/gradcam`                  | GradCAM 히트맵 생성                  |
| 견종   | GET     | `/breeds`                      | 견종 목록 (검색, 필터, 페이지네이션) |
| 질환   | GET     | `/diseases/{id}`               | 질환 상세 + 권장 영양소              |
| 추천   | GET     | `/recommendations`             | 영양소·식재료·레시피 추천 (DB)       |
| 추천   | GET     | `/recommendations/summary`     | AI 추천 요약 (LLM, Lazy)             |
| 챗봇   | POST    | `/chat/sessions`               | 채팅 세션 생성                       |
| 챗봇   | POST    | `/chat/sessions/{id}/messages` | 메시지 전송 + AI 응답                |
| 사용자 | GET/PUT | `/users/me`                    | 프로필 조회/수정                     |

---

## 설계 포인트

### Lazy Loading 패턴

- `GET /recommendations` → DB 데이터만 즉시 반환 (빠름)
- `GET /recommendations/summary` → LLM 호출은 사용자가 "AI 추천 이유"를 펼칠 때만 실행
- 초기 로딩 속도를 크게 개선하면서 AI 기능은 유지

### RAG 기반 챗봇

- 견종의 질환·영양·레시피 데이터를 Supabase에서 조회 후 시스템 프롬프트에 주입
- 대화 히스토리 최대 20건 유지
- 주제 이탈 방지 (견종 관련 질문만 응답)

### GradCAM 설명 가능성

- Top-3 예측 각각에 대해 GradCAM 히트맵 생성
- 바운딩 박스 시각화로 AI 판단 근거를 직관적으로 전달
- `ThreadPoolExecutor`로 비동기 처리 (이벤트 루프 블로킹 방지)

### 마이크로서비스 분리

- **Backend**: 비즈니스 로직, DB, 인증, LLM 오케스트레이션
- **AI Service**: TensorFlow 모델 추론 (무거운 연산 격리)
- 서버 시작 시 모델 사전 로딩 (`lifespan`)으로 콜드 스타트 방지

---

## 로컬 실행 방법

자세한 내용은 [DEV_GUIDE.md](./DEV_GUIDE.md)를 참고하세요.

### 사전 요구사항

- Python 3.11+ (Backend), Python 3.12+ (AI Service)
- Node.js 18+
- Supabase 프로젝트
- OpenAI API Key
- ngrok (개발용 터널)

### 빠른 시작

```bash
# 1. Backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn backend.main:app --reload

# 2. AI Service (새 터미널)
cd ai-service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python server.py

# 3. Frontend (새 터미널)
cd frontend
npm install
npx expo start
```

### 환경변수

```env
# Backend (.env)
SUPABASE_URL=
SUPABASE_ANON_KEY=
OPENAI_API_KEY=
AI_SERVICE_URL=http://localhost:8001
JWT_SECRET_KEY=

# Frontend (.env)
EXPO_PUBLIC_API_URL=
```

---

## 데이터 출처

- **유전 질환 데이터**: [CIDD (Canine Inherited Disorders Database)](https://cidd.discoveryspace.ca/)
- **견종 분류 모델**: MobileNetV2 기반 Fine-tuning

---

## 팀 구성

| 이름            | 역할                        |
| --------------- | --------------------         |
| 김재현          | Project Leader, AI Service  |
| 최동원          | Backend, Release            |
| 이민혜          | Frontend, Backend           |
| 송진우          | Frontend                    |
| 장승우          | AI Service, Data Analysis   |

---

## 라이선스

이 프로젝트는 교육 및 포트폴리오 목적으로 제작되었습니다.
