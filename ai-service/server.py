"""
AI Server v2 — 강아지 감지 + 품종 분류 API (Port 8001)

Pair2 리팩터링 적용:
- 이미지 1회만 전처리 (image_pipeline)
- asyncio.gather() 병렬 추론 (detection + classification 동시)
- run_in_executor (event loop 블로킹 해소)
- LRU 캐시 (동일 이미지 즉시 응답)
- 모듈 레벨 import + warmup (첫 요청 지연 제거)
"""
import asyncio
import io
import logging
import sys
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware

# Add breed and dog-detection modules to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'breed'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'dog-detection'))

from image_pipeline import preprocess_image
from prediction_cache import (
    prediction_cache, CachedPrediction, DetectionResult, ClassificationResult
)

logger = logging.getLogger("ai_service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: preload + warmup
    logger.info("Loading AI models...")

    try:
        from dog_detector import load_model as load_detector
        load_detector()
        logger.info("강아지 감지 모델 로딩 완료")
    except Exception as e:
        logger.warning(f"강아지 감지 모델 로딩 실패: {e}")

    try:
        from breed_classifier import _load_resources
        _load_resources()
        logger.info("품종 분류 모델 로딩 완료")
    except Exception as e:
        logger.warning(f"품종 분류 모델 로딩 실패: {e}")

    # Warmup: dummy inference로 TF 그래프 컴파일
    try:
        from breed_classifier import warmup
        await warmup()
        logger.info("모델 워밍업 완료 (첫 요청 지연 제거)")
    except Exception as e:
        logger.warning(f"워밍업 실패 (정상 작동에는 영향 없음): {e}")

    # GradCAM 미리 import
    try:
        from gradcam import generate_gradcam_image  # noqa: F401
        logger.info("GradCAM 모듈 로딩 완료")
    except Exception as e:
        logger.warning(f"GradCAM 모듈 로딩 실패: {e}")

    yield

    prediction_cache.clear()
    logger.info("Shutdown complete.")


app = FastAPI(title="댕슐랭 AI Server v2", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/detect-and-classify")
async def detect_and_classify(file: UploadFile = File(...)):
    """
    병렬 추론 파이프라인:
    1. 이미지 1회 전처리 (decode, resize 224x224, sha256 hash)
    2. 캐시 확인 → hit면 즉시 반환
    3. asyncio.gather()로 detection + classification 병렬 실행
    4. 결과 캐싱 후 반환
    """
    contents = await file.read()
    start = time.time()

    # Step 1: Single preprocessing
    try:
        img = preprocess_image(contents)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Step 2: Cache check
    cached = prediction_cache.get(img.image_hash)
    if cached is not None:
        logger.debug("Cache hit: %s", img.image_hash[:12])
        return _build_response(cached)

    # Step 3: Parallel inference
    from dog_detector import predict_dog
    from breed_classifier import predict_breed

    detection, classification = await asyncio.gather(
        predict_dog(img),
        predict_breed(img),
    )

    elapsed = round((time.time() - start) * 1000, 1)

    # 강아지 아니면 classification 무시
    final_classification = classification if detection.is_dog else None

    # Step 4: Cache and return
    result = CachedPrediction(
        image_hash=img.image_hash,
        detection=detection,
        classification=final_classification,
        inference_time_ms=elapsed,
        timestamp=time.time(),
    )
    prediction_cache.set(img.image_hash, result)

    return _build_response(result)


def _build_response(result: CachedPrediction) -> dict:
    """CachedPrediction → 기존 API 형식 호환 응답."""
    if not result.detection.is_dog:
        return {
            "is_dog": False,
            "breed_en": None,
            "breed_ko": None,
            "size": None,
            "confidence": 0.0,
            "top3": [],
            "inference_time_ms": result.inference_time_ms,
        }

    c = result.classification
    return {
        "is_dog": True,
        "breed_en": c.breed_en,
        "breed_ko": c.breed_ko,
        "size": c.size,
        "confidence": c.confidence,
        "top3": c.top3,
        "inference_time_ms": result.inference_time_ms,
    }


@app.post("/gradcam")
async def gradcam(file: UploadFile = File(...)):
    try:
        from gradcam import generate_gradcam_image
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"GradCAM 모듈 없음: {e}")

    contents = await file.read()
    from PIL import Image
    try:
        pil_image = Image.open(io.BytesIO(contents))
        b64 = await asyncio.get_event_loop().run_in_executor(
            None, generate_gradcam_image, pil_image
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GradCAM 생성 실패: {str(e)}")

    return {"gradcam_image_b64": b64}


@app.get("/cache/stats")
async def cache_stats():
    return {"cache_size": prediction_cache.size, "max_size": 128, "ttl": 300.0}


@app.post("/cache/clear")
async def clear_cache():
    prediction_cache.clear()
    return {"status": "cleared"}


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0", "cache_size": prediction_cache.size}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
