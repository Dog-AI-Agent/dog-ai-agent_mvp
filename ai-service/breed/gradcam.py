import io
import base64

import numpy as np
import tensorflow as tf
import tf_keras
import matplotlib
matplotlib.use('Agg')  # GUI 없는 환경용
import matplotlib.pyplot as plt
import matplotlib.patheffects as pe
import matplotlib.font_manager as fm

# 한글 폰트 설정 (맑은 고딕 - Windows 기본 한글 폰트)
plt.rcParams['font.family'] = 'Malgun Gothic'
plt.rcParams['axes.unicode_minus'] = False
from PIL import Image

from breed_classifier import _load_resources

BOX_COLORS = [(255, 80, 80), (80, 130, 255), (80, 200, 80)]  # 빨강, 파랑, 초록


def _get_feature_extractor(model):
    backbone = model.layers[0]  # mobilenetv2
    last_conv = next(l for l in reversed(backbone.layers) if isinstance(l, tf_keras.layers.Conv2D))
    feature_extractor = tf_keras.models.Model(
        inputs=backbone.inputs,
        outputs=backbone.get_layer(last_conv.name).output
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


def _heatmap_to_bbox(heatmap, original_size, threshold=0.5):
    h, w = heatmap.shape
    mask = heatmap >= threshold
    if not mask.any():
        cy, cx = np.unravel_index(np.argmax(heatmap), heatmap.shape)
        rows, cols = np.array([cy]), np.array([cx])
    else:
        rows, cols = np.where(mask)

    orig_w, orig_h = original_size
    x1 = int(cols.min() / w * orig_w)
    y1 = int(rows.min() / h * orig_h)
    x2 = int(cols.max() / w * orig_w)
    y2 = int(rows.max() / h * orig_h)
    return x1, y1, x2, y2


def generate_gradcam_image(pil_image: Image.Image) -> str:
    """
    업로드된 PIL 이미지에 대해 top1/2/3 GradCAM 박스를 그린 이미지를
    base64 문자열로 반환한다.
    """
    model, breed_data = _load_resources()
    feature_extractor, gap_layer, cls_layer = _get_feature_extractor(model)

    img = pil_image.convert('RGB').resize((224, 224))
    img_tensor = np.expand_dims(np.array(img, dtype=np.float32) / 255.0, axis=0)

    preds = model.predict(img_tensor, verbose=0)[0]
    top_indices = np.argsort(preds)[::-1][:3]

    results = []
    for rank, class_idx in enumerate(top_indices):
        breed_name = breed_data[class_idx]["ko"] if class_idx < len(breed_data) else f"class_{class_idx}"
        prob = float(preds[class_idx]) * 100
        heatmap = _compute_gradcam(feature_extractor, gap_layer, cls_layer, img_tensor, class_idx)
        bbox = _heatmap_to_bbox(heatmap, pil_image.size)
        results.append({"rank": rank + 1, "breed": breed_name, "prob": prob, "bbox": bbox})

    # 이미지 렌더링
    fig, ax = plt.subplots(1, 1, figsize=(8, 8))
    ax.imshow(np.array(pil_image.convert('RGB')))
    ax.axis('off')

    for r in reversed(results):
        x1, y1, x2, y2 = r["bbox"]
        color = [c / 255 for c in BOX_COLORS[r["rank"] - 1]]
        rect = plt.Rectangle(
            (x1, y1), x2 - x1, y2 - y1,
            linewidth=3, edgecolor=color, facecolor='none'
        )
        ax.add_patch(rect)
        txt = ax.text(
            x1 + 6, y1 + 6,
            f"Top{r['rank']}: {r['breed']} ({r['prob']:.1f}%)",
            color='white', fontsize=12, fontweight='bold', va='top',
            bbox=dict(facecolor=color, alpha=0.85, pad=3, linewidth=0)
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
