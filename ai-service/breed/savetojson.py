"""
강아지 이미지를 분류하고 결과를 JSON 파일로 저장하는 스크립트

사용법:
  단일 이미지: python savetojson.py dog.jpg          → data/dog.json
  폴더 전체:   python savetojson.py ./images/         → data/{이미지명}.json (개별 저장)
  임계값 지정: python savetojson.py ./images/ --threshold 0.5
  출력 폴더:   python savetojson.py ./images/ --outdir results/
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

from PIL import Image

from breed_classifier import MIXED_THRESHOLD, _load_resources, predict

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


def save_to_json(image_path: str, outdir: str = "data", threshold: float = MIXED_THRESHOLD) -> str:
    """
    강아지 이미지를 분류하고 결과를 JSON 파일로 저장합니다.

    Args:
        image_path: 이미지 파일 경로
        outdir: 결과 JSON을 저장할 폴더 (기본값: data)
        threshold: 순종 판단 임계값

    Returns:
        저장된 JSON 파일의 절대 경로
    """
    img_path = Path(image_path)
    result = predict(Image.open(img_path), threshold=threshold)
    record = {"filename": img_path.name, "created_at": datetime.now().isoformat(), **result}

    out_dir = Path(outdir)
    out_dir.mkdir(parents=True, exist_ok=True)

    output_path = out_dir / (img_path.stem + ".json")
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(record, f, ensure_ascii=False, indent=2)

    return str(output_path.resolve())


# ── 메인 ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="강아지 종 분류 결과를 JSON 파일로 저장")
    parser.add_argument("path", help="이미지 파일 또는 폴더 경로")
    parser.add_argument("--threshold", type=float, default=MIXED_THRESHOLD,
                        help=f"순종 판단 임계값 (기본값: {MIXED_THRESHOLD})")
    parser.add_argument("--outdir", default="data",
                        help="결과 JSON을 저장할 폴더 (기본값: data)")
    args = parser.parse_args()

    target = Path(args.path)
    if target.is_file():
        image_paths = [target]
    elif target.is_dir():
        image_paths = [p for p in target.iterdir() if p.suffix.lower() in IMAGE_EXTS]
    else:
        raise FileNotFoundError(f"경로를 찾을 수 없습니다: {target}")

    out_dir = Path(args.outdir)
    out_dir.mkdir(parents=True, exist_ok=True)

    _load_resources()
    print(f"총 {len(image_paths)}개 이미지 처리 시작\n")

    success, fail = 0, 0
    for img_path in image_paths:
        try:
            result = predict(Image.open(img_path), threshold=args.threshold)
            record = {"filename": img_path.name, "created_at": datetime.now().isoformat(), **result}

            output_path = out_dir / (img_path.stem + ".json")
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(record, f, ensure_ascii=False, indent=2)

            purity = "순종" if result["is_purebred"] else "잡종"
            print(f"[OK] {img_path.name}  →  {purity} | {result['breed_en']} | {result['breed_ko']} | {result['size']}")
            print(f"     저장: {output_path.resolve()}")
            success += 1
        except Exception as e:
            print(f"[FAIL] {img_path.name}: {e}")
            fail += 1

    print(f"\n완료: 성공 {success}개 / 실패 {fail}개")


if __name__ == "__main__":
    main()
