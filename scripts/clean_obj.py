"""Готовит OBJ для сайта: оставляет только вершины, объекты, материалы и грани.

Нормали и UV не нужны — нормали пересчитываются в браузере (toCreasedNormals),
а материалы назначаются в коде по именам. Линии (l) ломают OBJLoader — их убираем.

Использование: python3 scripts/clean_obj.py models-src/polaroid.obj public/models/polaroid.obj
"""
import sys

src, dst = sys.argv[1], sys.argv[2]
out = []
for line in open(src, encoding="utf-8"):
    t = line.split()
    if not t:
        continue
    if t[0] == "v":
        out.append("v " + " ".join(f"{float(x):.4f}".rstrip("0").rstrip(".") for x in t[1:4]))
    elif t[0] in ("o", "usemtl"):
        out.append(line.strip())
    elif t[0] == "f":
        out.append("f " + " ".join(x.split("/")[0] for x in t[1:]))
open(dst, "w", encoding="utf-8").write("\n".join(out) + "\n")
print(f"{dst}: {len(out)} строк")
