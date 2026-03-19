"""
AI Server — 강아지 감지 + 품종 분류 API
Port 8001
"""

import io
import time
import sys
import os

# Add breed and dog-detection modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'breed'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'dog-detection'))

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from PIL import Image


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: preload models
    print("Loading AI models...")
    try:
        from savetojson import _load_resources
        _load_resources()
        print("✅ 품종 분류 모델 로딩 완료")
    except Exception as e:
        print(f"⚠️  품종 분류 모델 로딩 실패 (model_1.h5 없음): {e}")
        print("   → ai-service/breed/trained_models/model_1.h5 파일을 추가하면 정상 작동합니다.")
    try:
        from dog_detector import load_model
        load_model()
        print("✅ 강아지 감지 모델 로딩 완료")
    except Exception as e:
        print(f"⚠️  강아지 감지 모델 로딩 실패: {e}")
    yield


app = FastAPI(title="댕슐랭 AI Server", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/detect-and-classify")
async def detect_and_classify(file: UploadFile = File(...)):
    contents = await file.read()

    # Dog detection
    try:
        from dog_detector import is_dog_from_bytes
    except Exception as e:
        raise HTTPException(status_code=503, detail="강아지 감지 모델이 로드되지 않았습니다. 서버 로그를 확인하세요.")

    # Breed model check
    try:
        from savetojson import _load_resources as _check
        _check()
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"model_1.h5 파일이 없습니다. ai-service/breed/trained_models/model_1.h5 를 추가해주세요.")

    start = time.time()

    try:
        dog_detected = is_dog_from_bytes(contents)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dog detection failed: {str(e)}")

    if not dog_detected:
        elapsed = round((time.time() - start) * 1000, 1)
        return {
            "is_dog": False,
            "breed_en": None,
            "breed_ko": None,
            "size": None,
            "confidence": 0.0,
            "top3": [],
            "inference_time_ms": elapsed,
        }

    # Breed classification
    from breed_classifier import predict
    try:
        pil_image = Image.open(io.BytesIO(contents))
        result = predict(pil_image)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Breed classification failed: {str(e)}")

    elapsed = round((time.time() - start) * 1000, 1)

    return {
        "is_dog": True,
        "breed_en": result["breed_en"],
        "breed_ko": result["breed_ko"],
        "size": result["size"],
        "confidence": result["top3"][0]["probability"],
        "top3": result["top3"],
        "inference_time_ms": elapsed,
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
