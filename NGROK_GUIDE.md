# 🌐 ngrok 서버 설정 가이드 (팀장 백엔드 서버용)

> 팀장 PC에서 백엔드 서버를 실행하고 ngrok으로 외부에 노출시키는 가이드입니다.

---

## 1. ngrok 설치

### Windows
1. [https://ngrok.com/download](https://ngrok.com/download) 접속
2. Windows 버전 다운로드 후 압축 해제
3. `ngrok.exe`를 `C:\ngrok\` 폴더에 이동 (또는 원하는 경로)

### 또는 winget으로 설치
```powershell
winget install ngrok
```

---

## 2. ngrok 계정 연결

1. [https://ngrok.com](https://ngrok.com) 회원가입 (무료)
2. 대시보드 → **Your Authtoken** 복사
3. 아래 명령어로 인증 등록:

```powershell
C:\ngrok\ngrok.exe config add-authtoken <YOUR_AUTHTOKEN>
```

---

## 3. 백엔드 서버 실행

```powershell
# 1) 프로젝트 폴더로 이동
cd D:\...\dog-ai-agent_mvp

# 2) 백엔드 venv 활성화
.\backend\.venv\Scripts\activate

# 3) 백엔드 실행
uvicorn backend.main:app --reload
# → http://127.0.0.1:8000 에서 실행됨
```

---

## 4. ngrok 터널 열기 (새 PowerShell 창)

```powershell
C:\ngrok\ngrok.exe http 8000
```

### 실행 후 출력 예시:
```
Forwarding  https://abc123-xxxx.ngrok-free.app -> http://localhost:8000
```

→ `https://abc123-xxxx.ngrok-free.app` 이 URL을 팀원들에게 공유!

---

## 5. 팀원들 설정 방법

### Vercel 환경변수 업데이트
Vercel 대시보드 → Settings → Environment Variables

| Key | Value |
|-----|-------|
| `BACKEND_URL` | `https://abc123-xxxx.ngrok-free.app` |

### 로컬 개발 시 `.env` 수정
```env
# frontend/.env 또는 루트 .env
EXPO_PUBLIC_API_URL=https://abc123-xxxx.ngrok-free.app/api/v1
```

---

## 6. ⚠️ 주의사항

### ngrok URL은 재시작할 때마다 바뀜
- ngrok 무료 플랜은 터널 재시작 시 URL이 변경됨
- URL 변경 시 팀원들에게 공유 + Vercel 환경변수 업데이트 필요

### 고정 URL 사용하려면 (유료 플랜 또는 무료 Static Domain)
ngrok 무료 계정도 **Static Domain 1개** 무료 제공:
1. [https://dashboard.ngrok.com/cloud-edge/domains](https://dashboard.ngrok.com/cloud-edge/domains) 접속
2. **New Domain** → 고정 URL 생성
3. 아래 명령어로 실행:
```powershell
C:\ngrok\ngrok.exe http --domain=your-domain.ngrok-free.app 8000
```

→ 이후 URL 고정! 팀원들에게 한 번만 공유하면 됨

---

## 7. AI 서버도 같이 노출할 경우

AI 서버(포트 8001)도 외부에서 접근해야 한다면:

```powershell
# 새 창에서
C:\ngrok\ngrok.exe http 8001
```

백엔드 `.env`에서 AI 서버 URL 업데이트:
```env
AI_SERVER_URL=https://ai-서버-ngrok-url.ngrok-free.app
```

---

## 8. 전체 실행 순서 요약

```
창1: uvicorn backend.main:app --reload          (백엔드 :8000)
창2: python ai-service/server.py                (AI 서버 :8001)
창3: ngrok http 8000                            (백엔드 터널)
창4: ngrok http 8001  (선택)                    (AI 서버 터널)
```

---

## 9. 팀원에게 공유할 정보

ngrok 실행 후 아래 정보를 팀 슬랙/카톡에 공유:

```
🚀 백엔드 서버 URL 업데이트!
BACKEND_URL: https://xxxx.ngrok-free.app
EXPO_PUBLIC_API_URL: https://xxxx.ngrok-free.app/api/v1

로컬 .env 파일 업데이트해주세요!
```

---

> 문의: 최동원 (DevOps 담당)
