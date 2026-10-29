"""Готовит OBJ для сайта: оставляет только вершины, объекты, материалы и грани.

Нормали и UV не нужны — нормали пересчитываются в браузере (toCreasedNormals),
а материалы назначаются в коде по именам. Линии (l) ломают OBJLoader — их убираем.
Многоугольники с 5+ вершинами режем на треугольники «отрезанием ушей»: OBJLoader
режет их веером, и на вогнутых гранях (щель печати) появляются лишние треугольники.

Использование: python3 scripts/clean_obj.py models-src/polaroid.obj public/models/polaroid.obj
"""
import sys

src, dst = sys.argv[1], sys.argv[2]


def newell(pts):
    n = [0.0, 0.0, 0.0]
    for i, a in enumerate(pts):
        b = pts[(i + 1) % len(pts)]
        n[0] += (a[1] - b[1]) * (a[2] + b[2])
        n[1] += (a[2] - b[2]) * (a[0] + b[0])
        n[2] += (a[0] - b[0]) * (a[1] + b[1])
    return n


def ear_clip(idx, verts):
    pts3 = [verts[i] for i in idx]
    n = newell(pts3)
    ax = max(range(3), key=lambda k: abs(n[k]))
    u, v = [k for k in range(3) if k != ax]
    sign = 1 if n[ax] > 0 else -1
    pts = [(p[u], p[v]) for p in pts3]
    order = list(range(len(idx)))

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])

    def inside(p, a, b, c):
        d1, d2, d3 = cross(a, b, p), cross(b, c, p), cross(c, a, p)
        neg = d1 < 0 or d2 < 0 or d3 < 0
        pos = d1 > 0 or d2 > 0 or d3 > 0
        return not (neg and pos)

    tris = []
    guard = 0
    while len(order) > 3 and guard < 10000:
        guard += 1
        m = len(order)
        for k in range(m):
            i0, i1, i2 = order[(k - 1) % m], order[k], order[(k + 1) % m]
            a, b, c = pts[i0], pts[i1], pts[i2]
            if cross(a, b, c) * sign <= 1e-12:
                continue
            if any(inside(pts[j], a, b, c) for j in order if j not in (i0, i1, i2)):
                continue
            tris.append((idx[i0], idx[i1], idx[i2]))
            order.pop(k)
            break
        else:
            break  # вырожденный многоугольник — добиваем веером
    for k in range(1, len(order) - 1):
        tris.append((idx[order[0]], idx[order[k]], idx[order[k + 1]]))
    return tris


verts, out = [], []
for line in open(src, encoding="utf-8"):
    t = line.split()
    if not t:
        continue
    if t[0] == "v":
        p = tuple(float(x) for x in t[1:4])
        verts.append(p)
        out.append("v " + " ".join(f"{x:.4f}".rstrip("0").rstrip(".") for x in p))
    elif t[0] in ("o", "usemtl"):
        out.append(line.strip())
    elif t[0] == "f":
        idx = [int(x.split("/")[0]) - 1 for x in t[1:]]
        if len(idx) <= 4:
            out.append("f " + " ".join(str(i + 1) for i in idx))
        else:
            for tri in ear_clip(idx, verts):
                out.append("f " + " ".join(str(i + 1) for i in tri))
open(dst, "w", encoding="utf-8").write("\n".join(out) + "\n")
print(f"{dst}: {len(out)} строк")
