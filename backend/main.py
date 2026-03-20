from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import ai, auth, breeds, chat, diseases, recommendations, recipes, users
from backend.routers.recommendations import lifespan

app = FastAPI(
    title="댕슐랭 (Daeng Michelin) API",
    description="강아지 품종 식별 → 유전병 → 맞춤 레시피 추천 서비스",
    version="2.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(ai.router, prefix="/api/v1")
app.include_router(breeds.router, prefix="/api/v1")
app.include_router(diseases.router, prefix="/api/v1")
app.include_router(recommendations.router, prefix="/api/v1")
app.include_router(recipes.router, prefix="/api/v1")
app.include_router(chat.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")


@app.get("/")
async def root():
    return {"service": "댕슐랭", "version": "2.1.0"}


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
