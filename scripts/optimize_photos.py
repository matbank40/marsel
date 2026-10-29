"""Конвертирует фото в WebP двух размеров: full (1600px) и thumb (800px).

Использование: python3 scripts/optimize_photos.py [--wide] <исходник> <имя> [<исходник> <имя> ...]
Результат: public/photos/<имя>.webp и public/photos/<имя>-sm.webp
--wide — для панорамных коллажей: полный размер 2000px, превью 1100px.
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

OUT = Path(__file__).resolve().parent.parent / "public" / "photos"
OUT.mkdir(parents=True, exist_ok=True)

args = sys.argv[1:]
wide = "--wide" in args
args = [a for a in args if a != "--wide"]
sizes = (("", 2000, 86), ("-sm", 1100, 80)) if wide else (("", 1800, 84), ("-sm", 820, 78))
for src, name in zip(args[::2], args[1::2]):
    img = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    for suffix, edge, q in sizes:
        im = img.copy()
        im.thumbnail((edge, edge), Image.LANCZOS)
        im.save(OUT / f"{name}{suffix}.webp", "WEBP", quality=q, method=6)
    print(name, img.size)
