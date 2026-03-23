import io
import base64

import numpy as np
import tensorflow as tf
import keras
import matplotlib
matplotlib.use('Agg')  # GUI 없는 환경용
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
import matplotlib.font_manager as fm

# 한글 폰트 설정 (맑은 고딕 - Windows 기본 한글 폰트)
plt.rcParams['font.family'] = 'Malgun Gothic'
plt.rcParams['axes.unicode_minus'] = False
from PIL import Image

from breed_classifier import _load_resources, TOP_K

BOX_COLORS = [(255, 80, 80), (80, 130, 255), (80, 200, 80)]  # 빨강, 파랑, 초록


def _get_feature_extractor(model):
    backbone = model.layers[0]
    # EfficientNetB0: top_activation이 GAP 직전 최적 GradCAM 타겟
    try:
        target_layer = backbone.get_layer('top_activation')
    except ValueError:
        target_layer = next(l for l in reversed(backbone.layers) if isinstance(l, keras.layers.Conv2D))
    feature_extractor = keras.models.Model(
        inputs=backbone.inputs,
        outputs=target_layer.output
    )
    return feature_extractor, model.layers[1], model.layers[2]  # extractor, GAP, Dense


def _compute_gradcam(feature_extractor, gap_layer, cls_layer, img_tensor, class_idx):
    with tf.GradientTape() as tape:
        inputs = tf.cast(img_tensor, tf.float32)
        conv_outputs = feature_extractor(inputs)
        tape.watch(conv_outputs)
        x = gap_layer(conv_outputs)
        predictions = cls_layer(x)
        loss = predictions[:, class_idx]

    grads = tape.gradient(loss, conv_outputs)
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    conv_out = conv_outputs[0]
    heatmap = conv_out @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)
    heatmap = tf.maximum(heatmap, 0) / (tf.math.reduce_max(heatmap) + 1e-8)
    return heatmap.numpy()


def _heatmap_to_center(heatmap, original_size):
    """heatmap 활성화 무게중심 → 원본 이미지 좌표로 변환."""
    h, w = heatmap.shape
    orig_w, orig_h = original_size

    # 무게중심 계산
    total = heatmap.sum() + 1e-8
    ys, xs = np.indices(heatmap.shape)
    cx = int((xs * heatmap).sum() / total / w * orig_w)
    cy = int((ys * heatmap).sum() / total / h * orig_h)
    return cx, cy


def generate_gradcam_image(pil_image: Image.Image) -> str:
    """
    업로드된 PIL 이미지에 대해 Top1 GradCAM bbox를 그린 이미지를
    base64 문자열로 반환한다.
    """
    model, breed_data = _load_resources()
    feature_extractor, gap_layer, cls_layer = _get_feature_extractor(model)

    img = pil_image.convert('RGB').resize((224, 224))
    img_tensor = np.expand_dims(np.array(img, dtype=np.float32), axis=0)

    preds = model.predict(img_tensor, verbose=0)[0]
    top_indices = np.argsort(preds)[::-1][:TOP_K]
    orig_size = (pil_image.width, pil_image.height)

    results = []
    for rank, class_idx in enumerate(top_indices):
        breed_name = breed_data[class_idx]["ko"] if class_idx < len(breed_data) else f"class_{class_idx}"
        prob = float(preds[class_idx]) * 100
        heatmap = _compute_gradcam(feature_extractor, gap_layer, cls_layer, img_tensor, class_idx)
        cx, cy = _heatmap_to_center(heatmap, orig_size)
        results.append({"rank": rank + 1, "breed": breed_name, "prob": prob, "cx": cx, "cy": cy})

    # 이미지 렌더링
    fig, ax = plt.subplots(1, 1, figsize=(8, 8))
    ax.imshow(np.array(pil_image.convert('RGB')))
    ax.axis('off')

    for r in results:
        cx, cy = r["cx"], r["cy"]
        color = [c / 255 for c in BOX_COLORS[r["rank"] - 1]]

        # 확률 비례 마커 크기 (10% → 20, 100% → 50)
        markersize = 20 + r["prob"] * 0.3
        ax.plot(cx, cy, 'o', markersize=markersize, color=color,
                markeredgecolor='white', markeredgewidth=2.5,
                alpha=0.6, zorder=5)
        ax.text(cx, cy, str(r["rank"]),
                color='white', fontsize=13, fontweight='bold',
                ha='center', va='center', zorder=6)

        # 라벨 (마커 오른쪽 또는 아래로 오프셋)
        offset_x = 18
        offset_y = -18 + (r["rank"] - 1) * 30
        txt = ax.annotate(
            f"Top{r['rank']}: {r['breed']} ({r['prob']:.1f}%)",
            xy=(cx, cy), xytext=(cx + offset_x, cy + offset_y),
            color='white', fontsize=11, fontweight='bold',
            bbox=dict(facecolor=color, alpha=0.85, pad=3, linewidth=0),
            arrowprops=dict(arrowstyle='->', color=color, lw=2),
            zorder=7
        )
        txt.set_path_effects([
            pe.Stroke(linewidth=2, foreground='black'),
            pe.Normal()
        ])

    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    buf.seek(0)

    return base64.b64encode(buf.read()).decode('utf-8')
