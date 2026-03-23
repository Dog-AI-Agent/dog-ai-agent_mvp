"""
Breed Classifier — EfficientNetB0 (Keras 3), async non-blocking.
Pair2 리팩터링: run_in_executor + module-level load + warmup
"""
from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import TYPE_CHECKING

import keras
import numpy as np

if TYPE_CHECKING:
    from image_pipeline import PreprocessedImage
    from prediction_cache import ClassificationResult

_DIR = Path(__file__).parent
MODEL_PATH = str(_DIR / "trained_models" / "efficientnetb0_phase2.keras")
BREED_DATA_FILE = str(_DIR / "breed_data.json")
INPUT_SIZE = (224, 224)
MIXED_THRESHOLD = 0.50
TOP_K = 3


# ── Module-level load (한 번만) ──
_model = None
_breed_data = None


def _load_resources():
    global _model, _breed_data
    if _model is None:
        print("모델 로딩 중...")
        _model = keras.models.load_model(MODEL_PATH)
        print("모델 로딩 완료.")
    if _breed_data is None:
        with open(BREED_DATA_FILE, 'r', encoding='utf-8') as f:
            _breed_data = json.load(f)
    return _model, _breed_data


def _predict_sync(batch: np.ndarray) -> np.ndarray:
    model, _ = _load_resources()
    return model.predict(batch, verbose=0)


async def predict_breed(img: "PreprocessedImage") -> "ClassificationResult":
    """Breed classification — run_in_executor로 비동기 실행."""
    from prediction_cache import ClassificationResult

    model, breed_data = _load_resources()
    loop = asyncio.get_running_loop()

    # 모델 내부에 rescaling 레이어 포함 → [0,255] 그대로 전달
    batch = img.preprocessed_array.copy().astype(np.float32)
    preds = await loop.run_in_executor(None, _predict_sync, batch)

    top_indices = np.argsort(preds[0])[::-1][:TOP_K]
    top3 = [
        {
            "rank": rank + 1,
            "breed": breed_data[idx]["en"],
            "probability": round(float(preds[0][idx]), 4),
            "probability_pct": f"{preds[0][idx] * 100:.2f}%"
        }
        for rank, idx in enumerate(top_indices)
    ]

    top1_idx = top_indices[0]
    top1_breed = breed_data[top1_idx]

    return ClassificationResult(
        breed_en=top1_breed["en"],
        breed_ko=top1_breed["ko"],
        size=top1_breed["size"],
        confidence=round(float(preds[0][top1_idx]), 4),
        top3=top3,
    )


async def warmup_classifier() -> None:
    """Dummy inference로 TF 그래프 컴파일."""
    _load_resources()
    loop = asyncio.get_running_loop()
    dummy = np.zeros((1, 224, 224, 3), dtype=np.float32)
    await loop.run_in_executor(None, _predict_sync, dummy)


async def warmup() -> None:
    """Both models warmup."""
    import sys
    sys.path.insert(0, str(Path(__file__).parent.parent / 'dog-detection'))
    from dog_detector import warmup_detector
    await asyncio.gather(warmup_detector(), warmup_classifier())


# ── 기존 호환: predict() 동기 함수 ──
def predict(pil_image, threshold=MIXED_THRESHOLD):
    model, breed_data = _load_resources()
    img = pil_image.convert('RGB').resize(INPUT_SIZE)
    arr = np.array(img, dtype=np.float32)
    arr = np.expand_dims(arr, axis=0)

    preds = model.predict(arr, verbose=0)[0]
    top_indices = np.argsort(preds)[::-1][:TOP_K]
    top3 = [
        {
            "rank": rank + 1,
            "breed": breed_data[idx]["en"],
            "probability": round(float(preds[idx]), 4),
            "probability_pct": f"{preds[idx] * 100:.2f}%"
        }
        for rank, idx in enumerate(top_indices)
    ]
    top1_idx = top_indices[0]
    top1_breed = breed_data[top1_idx]

    return {
        "is_purebred": top3[0]["probability"] >= threshold,
        "breed_en": top1_breed["en"],
        "breed_ko": top1_breed["ko"],
        "size": top1_breed["size"],
        "top3": top3,
        "threshold": threshold,
    }
