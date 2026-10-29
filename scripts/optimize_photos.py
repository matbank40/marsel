"""Конвертирует фото в WebP двух размеров: full (1600px) и thumb (800px).

Использование: python3 scripts/optimize_photos.py <исходник> <имя> [<исходник> <имя> ...]
Результат: public/photos/<имя>.webp и public/photos/<имя>-sm.webp
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

OUT = Path(__file__).resolve().parent.parent / "public" / "photos"
OUT.mkdir(parents=True, exist_ok=True)

args = sys.argv[1:]
for src, name in zip(args[::2], args[1::2]):
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    for suffix, edge, q in (("", 1800, 84), ("-sm", 820, 78)):
        im = img.copy()
        im.thumbnail((edge, edge), Image.LANCZOS)
        im.save(OUT / f"{name}{suffix}.webp", "WEBP", quality=q, method=6)
    print(name, img.size)
