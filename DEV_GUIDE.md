# 댕슐랭 로컬 개발 가이드

## 실행 순서

### 1. 백엔드 실행
```powershell
cd D:\...\dog-ai-agent_mvp
.\backend\.venv\Scripts\activate
uvicorn backend.main:app --reload
```

### 2. AI 서버 실행 (새 창)
```powershell
cd D:\...\dog-ai-agent_mvp\ai-service
.\.venv\Scripts\activate
python server.py
```

### 3. ngrok 터널 열기 (새 창)
```powershell
C:\ngrok\ngrok.exe http 8000
```
→ 출력된 `https://xxxx.ngrok-free.app` URL 복사

### 4. Vercel 환경변수 업데이트
[vercel.com](https://vercel.com) → 프로젝트 → Settings → Environment Variables

| Key | Value |
|-----|-------|
| `EXPO_PUBLIC_API_URL` | `https://daeng-michelin.vercel.app/api/proxy/api/v1` |
| `BACKEND_URL` | `https://xxxx.ngrok-free.app` ← ngrok URL로 변경 |

저장 후 **Deployments → Redeploy**

---

## 배포 (자동)
`main` 브랜치에 push하면 Vercel이 자동으로 빌드 & 배포

```powershell
git add .
git commit -m "커밋 메시지"
git push origin main
```

---

## 주의사항
- ngrok free 플랜은 PC 재시작 시 URL 변경됨 → Vercel `BACKEND_URL` 업데이트 필요
- 3개 창 동시 실행 필요: uvicorn / AI server / ngrok
