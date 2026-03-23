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
    fig, ax = plt.subplots(1, 1, figsize=(10, 10))
    ax.imshow(np.array(pil_image.convert('RGB')))
    ax.axis('off')

    # 라벨 위치 겹침 방지: y 기준 정렬 후 최소 간격 보장
    MIN_GAP = 90  # 라벨 간 최소 픽셀 간격
    label_positions = []
    for r in results:
        label_positions.append([r["cx"] + 30, r["cy"]])

    MARGIN = 30  # 이미지 경계 안쪽 여백
    orig_w, orig_h = pil_image.width, pil_image.height

    # y 좌표 겹침 해소 (반복적으로 밀어냄)
    for _ in range(30):
        for i in range(len(label_positions)):
            for j in range(i + 1, len(label_positions)):
                dy = label_positions[j][1] - label_positions[i][1]
                if abs(dy) < MIN_GAP:
                    push = (MIN_GAP - abs(dy)) / 2
                    label_positions[i][1] -= push
                    label_positions[j][1] += push

    # 이미지 경계 안으로 클램핑
    for pos in label_positions:
        pos[0] = max(MARGIN, min(pos[0], orig_w - MARGIN))
        pos[1] = max(MARGIN, min(pos[1], orig_h - MARGIN))

    for r, (lx, ly) in zip(results, label_positions):
        # 마커 동그라미도 이미지 경계 안으로 클램핑
        cx = max(MARGIN, min(r["cx"], orig_w - MARGIN))
        cy = max(MARGIN, min(r["cy"], orig_h - MARGIN))
        color = [c / 255 for c in BOX_COLORS[r["rank"] - 1]]

        # 확률 비례 마커/글자 크기 (1% → 최소, 100% → 최대)
        prob_ratio = r["prob"] / 100.0
        markersize = 20 + prob_ratio * 45       # 20 ~ 65
        marker_fontsize = int(14 + prob_ratio * 14)   # 14 ~ 28
        label_fontsize = int(13 + prob_ratio * 12)    # 13 ~ 25

        ax.plot(cx, cy, 'o', markersize=markersize, color=color,
                markeredgecolor='white', markeredgewidth=3,
                alpha=0.65, zorder=5)
        ax.text(cx, cy, str(r["rank"]),
                color='white', fontsize=marker_fontsize, fontweight='bold',
                ha='center', va='center', zorder=6)

        txt = ax.annotate(
            f"Top{r['rank']}: {r['breed']} ({r['prob']:.1f}%)",
            xy=(cx, cy), xytext=(lx, ly),
            color='white', fontsize=label_fontsize, fontweight='bold',
            bbox=dict(facecolor=color, alpha=0.85, pad=6, linewidth=0),
            arrowprops=dict(arrowstyle='->', color=color, lw=3),
            zorder=7
        )
        txt.set_path_effects([
            pe.Stroke(linewidth=3, foreground='black'),
            pe.Normal()
        ])

    plt.tight_layout()

    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=150, bbox_inches='tight')
    plt.close()
    buf.seek(0)

    return base64.b64encode(buf.read()).decode('utf-8')
