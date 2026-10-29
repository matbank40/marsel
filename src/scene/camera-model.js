import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Процедурная модель беззеркальной камеры с объективом 50 мм.
// Единицы — сантиметры. Камера смотрит в +Z, объектив можно «разобрать» (setExplode)
// и закрыть диафрагму (setAperture).

const BODY_W = 13;
const LENS_Y = -0.45;
const BODY_FRONT = 1.75;

function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// Карта нормалей «шагрени»: высотное поле из случайных бугорков → нормали.
function leatherNormalMap(size = 512) {
  const hf = new Float32Array(size * size);
  const wrap = (v) => ((v % size) + size) % size;
  for (let n = 0; n < 3200; n++) {
    const cx = Math.random() * size;
    const cy = Math.random() * size;
    const r = 2.5 + Math.random() * 5.5;
    const amp = 0.55 + Math.random() * 0.45;
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r);
        if (d2 >= 1) continue;
        const i = wrap(y) * size + wrap(x);
        hf[i] = Math.max(hf[i], (1 - d2) ** 0.7 * amp);
      }
    }
  }
  return canvasTexture(size, size, (ctx) => {
    const img = ctx.createImageData(size, size);
    const s = 2.6;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = hf[y * size + wrap(x + 1)] - hf[y * size + wrap(x - 1)];
        const dy = hf[wrap(y + 1) * size + x] - hf[wrap(y - 1) * size + x];
        let nx = -dx * s, ny = dy * s, nz = 1;
        const l = Math.hypot(nx, ny, nz);
        const o = (y * size + x) * 4;
        img.data[o] = (nx / l * 0.5 + 0.5) * 255;
        img.data[o + 1] = (ny / l * 0.5 + 0.5) * 255;
        img.data[o + 2] = (nz / l * 0.5 + 0.5) * 255;
        img.data[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, false);
}

// Цилиндр с рифлением по окружности (кольца фокуса, диски, кнопки).
function knurledCylinder(r, h, teeth, depth, sharp = 1) {
  const g = new THREE.CylinderGeometry(r, r, h, teeth * 6, 1, false);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    const rr = Math.hypot(x, z);
    if (rr < r * 0.98) continue;
    const a = Math.atan2(z, x);
    const wave = 0.5 + 0.5 * Math.cos(a * teeth);
    const k = 1 + (depth / r) * Math.pow(wave, sharp);
    p.setX(i, x * k);
    p.setZ(i, z * k);
  }
  g.computeVertexNormals();
  return g;
}

// Профиль тела вращения вдоль оси Z (LatheGeometry крутит вокруг Y).
function lathe(points, segments = 128) {
  const g = new THREE.LatheGeometry(points.map(([r, z]) => new THREE.Vector2(r, z)), segments);
  g.rotateX(Math.PI / 2);
  return g;
}

// Двояковыпуклая линза.
function lensElement(R, thick, sagF, sagB) {
  const pts = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    pts.push([R * t, thick / 2 + sagF * (1 - t * t)]);
  }
  for (let i = N; i >= 0; i--) {
    const t = i / N;
    pts.push([R * t, -thick / 2 - sagB * (1 - t * t)]);
  }
  // LatheGeometry ожидает профиль снизу вверх; разворачиваем, чтобы нормали смотрели наружу
  return lathe(pts.reverse(), 96);
}

// Надпись по окружности на кольце объектива (UV у RingGeometry планарные).
function ringLabelTexture() {
  return canvasTexture(1024, 1024, (ctx, w) => {
    ctx.fillStyle = '#0b0b0c';
    ctx.fillRect(0, 0, w, w);
    const c = w / 2;
    ctx.save();
    ctx.translate(c, c);
    ctx.font = '600 40px Inter, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const text = 'MARSEL OPTICS  ·  50mm  1:1.2  ·  ASPH  ·  ø62  ·  ';
    const radius = c * 0.885;
    const chars = [...text];
    const step = (Math.PI * 2) / chars.length;
    chars.forEach((ch, i) => {
      ctx.save();
      ctx.rotate(i * step - Math.PI / 2);
      ctx.translate(0, -radius);
      ctx.fillStyle = ch === '·' ? '#c8a46a' : '#e9e6df';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
    ctx.restore();
  });
}

// Шкала дистанций на корпусе объектива (развёртка цилиндра).
function distanceScaleTexture() {
  return canvasTexture(2048, 128, (ctx, w, h) => {
    ctx.fillStyle = '#0d0d0e';
    ctx.fillRect(0, 0, w, h);
    ctx.font = '500 46px Inter, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const marks = ['∞', '10', '5', '3', '2', '1.5', '1.2', '1', '0.8', '0.7m'];
    marks.forEach((m, i) => {
      const x = w * 0.08 + i * (w * 0.042);
      ctx.fillStyle = i === 0 ? '#c8a46a' : '#d9d6cf';
      ctx.fillText(m, x, h * 0.55);
    });
    ctx.fillStyle = '#c8a46a';
    ctx.fillRect(w * 0.5, h * 0.2, 4, h * 0.6);
  });
}

// Логотип на «горбу» видоискателя.
function brandTexture() {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '600 150px "Cormorant Garamond", Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1a1916';
    ctx.letterSpacing = '22px';
    ctx.fillText('MARSEL', w / 2, h / 2 + 8);
  });
}

// Маркировка диска режимов.
function dialTexture() {
  return canvasTexture(512, 512, (ctx, w) => {
    ctx.fillStyle = '#b9b4aa';
    ctx.fillRect(0, 0, w, w);
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, '#d6d1c7');
    g.addColorStop(1, '#a29d93');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
    ctx.translate(c, c);
    ctx.font = '700 46px Inter, Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ['A', 'P', 'S', 'M', 'C1', 'C2', 'V'].forEach((m, i, arr) => {
      ctx.save();
      ctx.rotate((i / arr.length) * Math.PI * 2);
      ctx.fillStyle = m === 'M' ? '#9a7a43' : '#1a1a1a';
      ctx.fillText(m, 0, -c * 0.66);
      ctx.restore();
    });
  });
}

// Мягкая тень под камерой.
function shadowTexture() {
  return canvasTexture(256, 256, (ctx, w) => {
    const g = ctx.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.85)');
    g.addColorStop(0.45, 'rgba(0,0,0,0.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
  });
}

export function buildCameraModel({ lite = false } = {}) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // ---------- Материалы ----------
  const leatherNormal = leatherNormalMap(lite ? 256 : 512);
  leatherNormal.wrapS = leatherNormal.wrapT = THREE.RepeatWrapping;
  leatherNormal.repeat.set(3.2, 1.6);

  const M = {
    leather: new THREE.MeshPhysicalMaterial({
      color: 0x111111, roughness: 0.72, metalness: 0, normalMap: leatherNormal,
      normalScale: new THREE.Vector2(0.55, 0.55), sheen: 0.4, sheenColor: 0x333333, sheenRoughness: 0.6,
    }),
    titanium: new THREE.MeshPhysicalMaterial({
      color: 0xc4bfb5, metalness: 1, roughness: 0.3, anisotropy: 0.55, clearcoat: 0.25, clearcoatRoughness: 0.2,
    }),
    graphite: new THREE.MeshPhysicalMaterial({ color: 0x1b1b1d, metalness: 0.75, roughness: 0.34, clearcoat: 0.4 }),
    blackMetal: new THREE.MeshPhysicalMaterial({ color: 0x0e0e0f, metalness: 0.6, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.25 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.92, metalness: 0 }),
    gold: new THREE.MeshPhysicalMaterial({ color: 0xc8a46a, metalness: 1, roughness: 0.22, clearcoat: 0.3 }),
    matte: new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 1, metalness: 0, side: THREE.BackSide }),
    blades: new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, thickness: 1.4, ior: 1.62,
      iridescence: 1, iridescenceIOR: 1.35, iridescenceThicknessRange: [160, 520],
      clearcoat: 1, clearcoatRoughness: 0.02, attenuationColor: new THREE.Color(0x8fa2ff), attenuationDistance: 6,
      specularIntensity: 1, envMapIntensity: 1.6,
    }),
    lamp: new THREE.MeshPhysicalMaterial({ color: 0xff5a36, emissive: 0x551500, roughness: 0.1, transmission: 0.4, thickness: 0.3 }),
  };

  const add = (parent, geo, mat, pos = [0, 0, 0], rot = [0, 0, 0]) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.rotation.set(...rot);
    parent.add(m);
    return m;
  };

  // ---------- Корпус ----------
  add(body, new RoundedBoxGeometry(BODY_W, 5.75, 3.3, 6, 0.55), M.leather, [0, -0.9, 0]);
  add(body, new RoundedBoxGeometry(BODY_W + 0.08, 2.05, 3.5, 6, 0.5), M.titanium, [0, 2.95, 0]);
  add(body, new RoundedBoxGeometry(BODY_W + 0.08, 0.55, 3.5, 4, 0.26), M.titanium, [0, -3.85, 0]);
  // тонкая золотая линия между кожей и металлом
  add(body, new RoundedBoxGeometry(BODY_W + 0.02, 0.06, 3.42, 2, 0.03), M.gold, [0, 1.92, 0]);

  // «Горб» видоискателя — трапеция с фаской
  const hump = new THREE.Shape();
  hump.moveTo(-2.75, 0);
  hump.lineTo(2.75, 0);
  hump.lineTo(1.75, 1.9);
  hump.lineTo(-1.75, 1.9);
  hump.closePath();
  const humpGeo = new THREE.ExtrudeGeometry(hump, {
    depth: 2.9, bevelEnabled: true, bevelThickness: 0.28, bevelSize: 0.28, bevelSegments: 6, curveSegments: 4,
  });
  humpGeo.translate(0, 0, -1.45);
  add(body, humpGeo, M.titanium, [0, 3.85, 0]);
  // горячий башмак
  add(body, new RoundedBoxGeometry(2.3, 0.18, 2.0, 2, 0.05), M.graphite, [0, 6.08, 0]);
  add(body, new THREE.BoxGeometry(2.1, 0.14, 0.12), M.titanium, [0, 6.22, 0.9]);
  add(body, new THREE.BoxGeometry(2.1, 0.14, 0.12), M.titanium, [0, 6.22, -0.9]);
  // логотип
  const brand = add(
    body,
    new THREE.PlaneGeometry(3.3, 0.82),
    new THREE.MeshStandardMaterial({ map: brandTexture(), transparent: true, metalness: 0.4, roughness: 0.5 }),
    [0, 4.75, 1.75],
  );
  brand.renderOrder = 2;

  // рукоять (смотрит на зрителя слева от объектива)
  add(body, new RoundedBoxGeometry(2.7, 5.9, 1.7, 6, 0.75), M.leather, [-4.75, -0.85, 1.6]);
  // кнопка спуска с ободком и рычаг включения
  add(body, knurledCylinder(0.82, 0.26, 40, 0.035), M.titanium, [-4.7, 4.1, 0.75]);
  add(body, new THREE.CylinderGeometry(0.46, 0.5, 0.36, 48), M.gold, [-4.7, 4.3, 0.75]);
  add(body, new RoundedBoxGeometry(1.2, 0.14, 0.5, 2, 0.06), M.graphite, [-3.75, 4.02, 1.05], [0, -0.5, 0]);
  // диск экспокоррекции
  add(body, knurledCylinder(0.72, 0.5, 32, 0.045, 2), M.graphite, [-4.3, 4.22, -0.95]);
  // диск режимов с маркировкой
  add(body, knurledCylinder(1.25, 0.72, 44, 0.055, 2), M.titanium, [4.45, 4.33, -0.1]);
  add(
    body,
    new THREE.CircleGeometry(1.08, 64),
    new THREE.MeshStandardMaterial({ map: dialTexture(), metalness: 0.7, roughness: 0.35 }),
    [4.45, 4.7, -0.1],
    [-Math.PI / 2, 0, 0],
  );
  add(body, new THREE.CylinderGeometry(0.42, 0.42, 0.25, 32), M.gold, [5.75, 4.08, 1.15]);

  // ушки для ремня
  [-1, 1].forEach((s) => {
    add(body, new THREE.TorusGeometry(0.32, 0.09, 12, 32), M.titanium, [s * 6.62, 2.75, 0], [0, Math.PI / 2, 0]);
  });
  // лампа автоспуска и кнопка отсоединения объектива
  add(body, new THREE.SphereGeometry(0.26, 24, 16), M.lamp, [3.6, 1.25, BODY_FRONT - 0.08]);
  add(body, new THREE.CylinderGeometry(0.38, 0.38, 0.22, 32), M.titanium, [3.55, -1.95, BODY_FRONT], [Math.PI / 2, 0, 0]);
  // байонет
  add(body, lathe([[3.25, 0], [3.25, 0.18], [3.05, 0.32], [2.85, 0.32], [2.85, 0]], 128), M.titanium, [0, LENS_Y, BODY_FRONT - 0.02]);

  // ---------- Объектив ----------
  const lens = new THREE.Group();
  lens.position.set(0, LENS_Y, BODY_FRONT + 0.3);
  body.add(lens);

  // каждая деталь — отдельная группа со своим смещением при разборке
  const parts = [];
  const part = (z, explodeZ) => {
    const g = new THREE.Group();
    g.position.z = z;
    lens.add(g);
    parts.push({ g, z, explodeZ });
    return g;
  };

  const mount = part(0, 0.6);
  add(mount, lathe([[2.8, 0], [2.95, 0.05], [2.95, 0.38], [2.8, 0.42]]), M.titanium);

  const apertureRing = part(0.42, 1.8);
  add(apertureRing, knurledCylinder(2.82, 0.95, 60, 0.04, 3), M.blackMetal, [0, 0, 0.48], [Math.PI / 2, 0, 0]);

  const elemA = part(1.0, 3.4);
  add(elemA, lensElement(2.0, 0.22, 0.32, 0.2), M.glass);

  const scale = part(1.4, 4.6);
  add(scale, new THREE.CylinderGeometry(2.86, 2.86, 0.09, 128), M.gold, [0, 0, 0.04], [Math.PI / 2, 0, 0]);
  const scaleTex = distanceScaleTexture();
  add(
    scale,
    new THREE.CylinderGeometry(2.84, 2.84, 0.9, 128, 1, true),
    new THREE.MeshPhysicalMaterial({ map: scaleTex, metalness: 0.55, roughness: 0.38, clearcoat: 0.5 }),
    [0, 0, 0.55],
    [Math.PI / 2, 0, 0],
  );

  const blades = part(2.3, 6.2);
  const bladeMeshes = [];
  for (let i = 0; i < 9; i++) {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), M.blades);
    m.position.z = i * 0.012;
    blades.add(m);
    bladeMeshes.push(m);
  }
  // тонкое кольцо-обойма для лепестков: видно только в разобранном виде
  const bladeHousing = add(blades, new THREE.TorusGeometry(2.42, 0.06, 12, 96), M.gold);

  const elemB = part(2.9, 7.6);
  add(elemB, lensElement(2.25, 0.18, 0.38, 0.38), M.glass);

  const focus = part(1.45, 9.0);
  const focusRing = add(focus, knurledCylinder(3.0, 2.55, 90, 0.07, 4), M.rubber, [0, 0, 2.3], [Math.PI / 2, 0, 0]);
  add(focus, new THREE.CylinderGeometry(2.88, 2.88, 0.12, 128, 1, true), M.titanium, [0, 0, 0.95], [Math.PI / 2, 0, 0]);

  const elemC = part(4.2, 10.4);
  add(elemC, lensElement(2.35, 0.2, 0.3, 0.12), M.glass);

  const front = part(4.0, 11.8);
  add(front, lathe([[2.86, 0], [2.88, 0.6], [2.98, 1.6], [3.1, 2.15], [3.1, 2.3], [2.4, 2.3]], 128), M.blackMetal);
  const nameRing = add(
    front,
    new THREE.RingGeometry(2.38, 3.08, 128, 1),
    new THREE.MeshPhysicalMaterial({ map: ringLabelTexture(), metalness: 0.4, roughness: 0.4, clearcoat: 0.6 }),
    [0, 0, 2.31],
  );
  nameRing.renderOrder = 1;
  // внутренняя «труба»: в собранном виде даёт глубину за стеклом
  const tube = add(front, new THREE.CylinderGeometry(2.4, 2.4, 6.0, 64, 1, true), M.matte, [0, 0, -0.8], [Math.PI / 2, 0, 0]);

  const glass = part(6.15, 13.4);
  const frontGlass = add(glass, lensElement(2.42, 0.12, 0.42, 0.05), M.glass);

  // точки привязки подписей (в локальных координатах деталей)
  const anchor = (parent, x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };
  const anchors = {
    light: anchor(glass, 0, 2.2, 0.35),
    focus: anchor(focus, 0, 3.05, 2.3),
    aperture: anchor(blades, 0, 2.45, 0),
    color: anchor(elemA, 0, 1.9, 0.2),
  };

  // мягкая тень
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 14),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.75 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -6.6;

  // ---------- Диафрагма ----------
  // Девять лепестков: каждый — сегмент круга, отсечённый прямой на расстоянии a от центра.
  // Их объединение оставляет в центре правильный девятиугольник.
  const R = 2.4;
  let lastA = -1;
  function setAperture(a) {
    a = THREE.MathUtils.clamp(a, 0.35, 2.12);
    if (Math.abs(a - lastA) < 0.004) return;
    lastA = a;
    const beta = Math.PI / 9 + 0.012;
    bladeMeshes.forEach((m, i) => {
      const phi = (i / 9) * Math.PI * 2;
      const n = new THREE.Vector2(Math.cos(phi), Math.sin(phi));
      const t = new THREE.Vector2(-Math.sin(phi), Math.cos(phi));
      const shape = new THREE.Shape();
      const steps = 14;
      for (let k = 0; k <= steps; k++) {
        const th = phi - beta + (2 * beta * k) / steps;
        const x = Math.cos(th) * R, y = Math.sin(th) * R;
        k === 0 ? shape.moveTo(x, y) : shape.lineTo(x, y);
      }
      const s2 = R * Math.sin(beta);
      const p2 = n.clone().multiplyScalar(a).add(t.clone().multiplyScalar(s2 * 1.02));
      const p1 = n.clone().multiplyScalar(a).add(t.clone().multiplyScalar(-s2 * 1.02));
      shape.lineTo(p2.x, p2.y);
      shape.lineTo(p1.x, p1.y);
      shape.closePath();
      m.geometry.dispose();
      m.geometry = new THREE.ShapeGeometry(shape, 6);
      m.rotation.z = 0.05 * (i % 2 ? 1 : -1);
    });
  }
  setAperture(1.8);

  function setExplode(e) {
    const k = THREE.MathUtils.smootherstep(e, 0, 1);
    parts.forEach((p) => {
      p.g.position.z = p.z + p.explodeZ * k;
    });
    tube.visible = k < 0.03;
    bladeHousing.visible = k > 0.05;
  }
  setExplode(0);

  function setFocusTurn(r) {
    focusRing.rotation.y = r;
  }

  return { root, body, shadow, lens, anchors, setAperture, setExplode, setFocusTurn, frontGlass, lensFrontZ: BODY_FRONT + 0.3 + 6.6, lensY: LENS_Y };
}
