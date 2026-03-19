import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import json
from pathlib import Path

import numpy as np
import tf_keras
from PIL import Image

# ── 설정 ──────────────────────────────────────────────────────────────────────
_DIR            = Path(__file__).parent
MODEL_PATH      = str(_DIR / "trained_models" / "model_1.h5")
BREED_DATA_FILE = str(_DIR / "breed_data.json")
INPUT_SIZE      = (224, 224)
MIXED_THRESHOLD = 0.50
TOP_K           = 3


# ── 리소스 로드 ────────────────────────────────────────────────────────────────
class FixedDepthwiseConv2D(tf_keras.layers.DepthwiseConv2D):
    def __init__(self, **kwargs):
        kwargs.pop('groups', None)
        super().__init__(**kwargs)


_model = None
_breed_data = None


def _load_resources():
    global _model, _breed_data
    if _model is None:
        print("모델 로딩 중...")
        _model = tf_keras.models.load_model(
            MODEL_PATH,
            custom_objects={'DepthwiseConv2D': FixedDepthwiseConv2D}
        )
        print("모델 로딩 완료.")
    if _breed_data is None:
        with open(BREED_DATA_FILE, 'r', encoding='utf-8') as f:
            _breed_data = json.load(f)
    return _model, _breed_data


# ── 예측 함수 ──────────────────────────────────────────────────────────────────
def predict(pil_image: Image.Image, threshold: float = MIXED_THRESHOLD):
    model, breed_data = _load_resources()
    img = pil_image.convert('RGB').resize(INPUT_SIZE)
    arr = np.array(img, dtype=np.float32) / 255.0
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

    top1_idx    = top_indices[0]
    top1_breed  = breed_data[top1_idx]
    is_purebred = top3[0]["probability"] >= threshold

    return {
        "is_purebred": is_purebred,
        "breed_en":    top1_breed["en"],
        "breed_ko":    top1_breed["ko"],
        "size":        top1_breed["size"],
        "top3":        top3,
        "threshold":   threshold,
    }
