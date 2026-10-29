import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

// Процедурная модель камеры с моментальной печатью.
// Единицы — сантиметры. Объектив смотрит в +Z, экран и щель печати — сзади (−Z).

const BODY_W = 13;
const LENS_Y = -0.45;
const BODY_FRONT = 1.75;
const TOP_Y = 3.975; // верх верхней панели
const SLOT_Z = -1.12; // щель печати у задней кромки
export const DISPLAY_FONT = '"Oswald", "Arial Narrow", sans-serif';

function canvasTexture(w, h, draw, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
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
        const nx = -dx * s, ny = dy * s, nz = 1;
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
    if (Math.hypot(x, z) < r * 0.98) continue;
    const a = Math.atan2(z, x);
    const k = 1 + (depth / r) * Math.pow(0.5 + 0.5 * Math.cos(a * teeth), sharp);
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

// Выпуклая передняя линза.
function lensElement(R, thick, sagF, sagB) {
  const pts = [];
  const N = 24;
  for (let i = 0; i <= N; i++) pts.push([R * (i / N), thick / 2 + sagF * (1 - (i / N) ** 2)]);
  for (let i = N; i >= 0; i--) pts.push([R * (i / N), -thick / 2 - sagB * (1 - (i / N) ** 2)]);
  return lathe(pts.reverse(), 96);
}

// Надпись по окружности на кольце объектива (UV у RingGeometry планарные).
function ringLabelTexture() {
  return canvasTexture(1024, 1024, (ctx, w) => {
    ctx.fillStyle = '#0b0b0c';
    ctx.fillRect(0, 0, w, w);
    const c = w / 2;
    ctx.translate(c, c);
    ctx.font = `500 44px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = [...'MARSEL  50mm  1:1.2  ø62  '];
    const step = (Math.PI * 2) / chars.length;
    chars.forEach((ch, i) => {
      ctx.save();
      ctx.rotate(i * step - Math.PI / 2);
      ctx.translate(0, -c * 0.885);
      ctx.fillStyle = '#e9e6df';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  });
}

// Логотип на «горбу» видоискателя.
function brandTexture() {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.font = `700 170px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1a1916';
    ctx.letterSpacing = '18px';
    ctx.fillText('MARSEL', w / 2, h / 2 + 6);
  });
}

// Маркировка диска режимов.
function dialTexture() {
  return canvasTexture(512, 512, (ctx, w) => {
    const c = w / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, '#d6d1c7');
    g.addColorStop(1, '#a29d93');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, w);
    ctx.translate(c, c);
    ctx.font = `700 52px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ['A', 'P', 'S', 'M', 'C1', 'C2', 'V'].forEach((m, i, arr) => {
      ctx.save();
      ctx.rotate((i / arr.length) * Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fillText(m, 0, -c * 0.66);
      ctx.restore();
    });
  });
}

// Экран на задней панели: кадр «на просмотре» с параметрами съёмки.
function screenTexture(image) {
  return canvasTexture(960, 640, (ctx, w, h) => {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    const ih = h * 0.84;
    const iw = ih * (image.width / image.height);
    ctx.drawImage(image, (w - iw) / 2, (h - ih) / 2, iw, ih);
    ctx.font = `500 30px ${DISPLAY_FONT}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textBaseline = 'middle';
    ctx.fillText('1/250   F2.0   ISO 200', 26, h - 26);
    ctx.textAlign = 'right';
    ctx.fillText('0001', w - 26, 30);
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

// Размеры снимка (рамка как у моментального фото) и окна с изображением.
export const PRINT = { w: 4.6, h: 6.4, photoW: 3.9, photoH: 4.88, photoY: 0.41 };

export function buildCameraModel({ photo, lite = false }) {
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
    slot: new THREE.MeshBasicMaterial({ color: 0x020202 }),
    blades: new THREE.MeshStandardMaterial({ color: 0x18181a, roughness: 0.45, metalness: 0.7, side: THREE.DoubleSide }),
    // Тонированное стекло с просветлением. Без transmission: преломление требует
    // отдельного прохода рендера каждый кадр, а на телефонах это заметно дорого.
    glass: new THREE.MeshPhysicalMaterial({
      color: 0x0a0c18, metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.86,
      iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 700],
      clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.4, depthWrite: false,
    }),
    lamp: new THREE.MeshStandardMaterial({ color: 0xff5a36, emissive: 0x551500, roughness: 0.15 }),
    paper: new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.62, metalness: 0 }),
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
  add(body, new RoundedBoxGeometry(BODY_W + 0.02, 0.06, 3.42, 2, 0.03), M.gold, [0, 1.92, 0]);

  // «Горб» видоискателя — только в передней половине, сзади остаётся место для щели печати
  const hump = new THREE.Shape();
  hump.moveTo(-2.75, 0);
  hump.lineTo(2.75, 0);
  hump.lineTo(1.75, 1.9);
  hump.lineTo(-1.75, 1.9);
  hump.closePath();
  const humpGeo = new THREE.ExtrudeGeometry(hump, {
    depth: 1.6, bevelEnabled: true, bevelThickness: 0.28, bevelSize: 0.28, bevelSegments: 6, curveSegments: 4,
  });
  humpGeo.translate(0, 0, -0.15);
  add(body, humpGeo, M.titanium, [0, 3.85, 0]);
  add(body, new RoundedBoxGeometry(2.3, 0.18, 1.3, 2, 0.05), M.graphite, [0, 6.08, 0.65]);
  add(body, new THREE.BoxGeometry(2.1, 0.14, 0.12), M.titanium, [0, 6.22, 1.2]);
  add(body, new THREE.BoxGeometry(2.1, 0.14, 0.12), M.titanium, [0, 6.22, 0.1]);
  add(
    body,
    new THREE.PlaneGeometry(3.3, 0.82),
    new THREE.MeshStandardMaterial({ map: brandTexture(), transparent: true, metalness: 0.4, roughness: 0.5 }),
    [0, 4.75, 1.75],
  ).renderOrder = 2;

  // щель печати
  add(body, new THREE.BoxGeometry(5.5, 0.04, 0.16), M.slot, [0, TOP_Y + 0.005, SLOT_Z]);
  add(body, new RoundedBoxGeometry(5.9, 0.08, 0.1, 2, 0.03), M.graphite, [0, TOP_Y + 0.02, SLOT_Z - 0.16]);
  add(body, new RoundedBoxGeometry(5.9, 0.08, 0.1, 2, 0.03), M.graphite, [0, TOP_Y + 0.02, SLOT_Z + 0.16]);

  // рукоять, кнопка спуска, диски
  add(body, new RoundedBoxGeometry(2.7, 5.9, 1.7, 6, 0.75), M.leather, [-4.75, -0.85, 1.6]);
  add(body, knurledCylinder(0.82, 0.26, 40, 0.035), M.titanium, [-4.7, 4.1, 0.75]);
  const shutter = add(body, new THREE.CylinderGeometry(0.46, 0.5, 0.36, 48), M.gold, [-4.7, 4.3, 0.75]);
  add(body, new RoundedBoxGeometry(1.2, 0.14, 0.5, 2, 0.06), M.graphite, [-3.75, 4.02, 1.05], [0, -0.5, 0]);
  add(body, knurledCylinder(0.72, 0.5, 32, 0.045, 2), M.graphite, [-4.3, 4.22, -0.95]);
  add(body, knurledCylinder(1.25, 0.72, 44, 0.055, 2), M.titanium, [4.45, 4.33, -0.1]);
  add(
    body,
    new THREE.CircleGeometry(1.08, 64),
    new THREE.MeshStandardMaterial({ map: dialTexture(), metalness: 0.7, roughness: 0.35 }),
    [4.45, 4.7, -0.1],
    [-Math.PI / 2, 0, 0],
  );
  add(body, new THREE.CylinderGeometry(0.42, 0.42, 0.25, 32), M.gold, [5.75, 4.08, 1.15]);
  [-1, 1].forEach((s) => {
    add(body, new THREE.TorusGeometry(0.32, 0.09, 12, 32), M.titanium, [s * 6.62, 2.75, 0], [0, Math.PI / 2, 0]);
  });
  add(body, new THREE.SphereGeometry(0.26, 24, 16), M.lamp, [3.6, 1.25, BODY_FRONT - 0.08]);
  add(body, new THREE.CylinderGeometry(0.38, 0.38, 0.22, 32), M.titanium, [3.55, -1.95, BODY_FRONT], [Math.PI / 2, 0, 0]);
  add(body, lathe([[3.25, 0], [3.25, 0.18], [3.05, 0.32], [2.85, 0.32], [2.85, 0]], 128), M.titanium, [0, LENS_Y, BODY_FRONT - 0.02]);

  // ---------- Задняя панель: экран и кнопки ----------
  const BACK = -1.65;
  add(body, new RoundedBoxGeometry(7.0, 4.75, 0.16, 4, 0.08), M.graphite, [0.9, -0.75, BACK - 0.02]);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x050607, toneMapped: false });
  add(body, new THREE.PlaneGeometry(6.6, 4.4), screenMat, [0.9, -0.75, BACK - 0.105], [0, Math.PI, 0]);
  const screenTex = screenTexture(photo.image);
  // кнопки справа от экрана (если смотреть сзади, это сторона рукояти)
  add(body, knurledCylinder(0.95, 0.22, 36, 0.03, 2), M.graphite, [-4.6, -1.3, BACK - 0.05], [Math.PI / 2, 0, 0]);
  add(body, new THREE.CylinderGeometry(0.38, 0.38, 0.2, 32), M.titanium, [-4.6, -1.3, BACK - 0.12], [Math.PI / 2, 0, 0]);
  [0.6, 1.5].forEach((y) => add(body, new THREE.CylinderGeometry(0.3, 0.3, 0.16, 32), M.graphite, [-4.6, y, BACK - 0.05], [Math.PI / 2, 0, 0]));
  add(body, new THREE.CylinderGeometry(0.3, 0.3, 0.16, 32), M.graphite, [-4.6, -3.0, BACK - 0.05], [Math.PI / 2, 0, 0]);

  // ---------- Объектив ----------
  const lens = new THREE.Group();
  lens.position.set(0, LENS_Y, BODY_FRONT + 0.3);
  body.add(lens);
  add(lens, lathe([[2.8, 0], [2.95, 0.05], [2.95, 0.38], [2.8, 0.42]]), M.titanium);
  add(lens, knurledCylinder(2.82, 0.95, 60, 0.04, 3), M.blackMetal, [0, 0, 0.9], [Math.PI / 2, 0, 0]);
  add(lens, new THREE.CylinderGeometry(2.86, 2.86, 0.09, 128), M.gold, [0, 0, 1.44], [Math.PI / 2, 0, 0]);
  add(lens, new THREE.CylinderGeometry(2.84, 2.84, 0.9, 128, 1, true), M.blackMetal, [0, 0, 1.95], [Math.PI / 2, 0, 0]);
  const focusRing = add(lens, knurledCylinder(3.0, 2.55, 90, 0.07, 4), M.rubber, [0, 0, 3.75], [Math.PI / 2, 0, 0]);
  add(lens, new THREE.CylinderGeometry(2.88, 2.88, 0.12, 128, 1, true), M.titanium, [0, 0, 2.4], [Math.PI / 2, 0, 0]);
  add(lens, lathe([[2.86, 0], [2.88, 0.6], [2.98, 1.6], [3.1, 2.15], [3.1, 2.3], [2.4, 2.3]], 128), M.blackMetal, [0, 0, 4.0]);
  add(
    lens,
    new THREE.RingGeometry(2.38, 3.08, 128, 1),
    new THREE.MeshPhysicalMaterial({ map: ringLabelTexture(), metalness: 0.4, roughness: 0.4, clearcoat: 0.6 }),
    [0, 0, 6.31],
  ).renderOrder = 1;
  add(lens, new THREE.CylinderGeometry(2.4, 2.4, 6.0, 64, 1, true), M.matte, [0, 0, 3.2], [Math.PI / 2, 0, 0]);
  add(lens, lensElement(2.42, 0.12, 0.42, 0.05), M.glass, [0, 0, 6.15]);

  // Лепестки диафрагмы: сегменты круга, отсечённые прямой на расстоянии a от центра.
  const blades = new THREE.Group();
  blades.position.z = 4.6;
  lens.add(blades);
  const bladeMeshes = Array.from({ length: 9 }, (_, i) => {
    const m = new THREE.Mesh(new THREE.BufferGeometry(), M.blades);
    m.position.z = i * 0.012;
    blades.add(m);
    return m;
  });
  const R = 2.4;
  let lastA = -1;
  function setAperture(a) {
    a = THREE.MathUtils.clamp(a, 0.05, 2.12);
    if (Math.abs(a - lastA) < 0.004) return;
    lastA = a;
    const beta = Math.PI / 9 + 0.012;
    bladeMeshes.forEach((m, i) => {
      const phi = (i / 9) * Math.PI * 2;
      const n = new THREE.Vector2(Math.cos(phi), Math.sin(phi));
      const t = new THREE.Vector2(-Math.sin(phi), Math.cos(phi));
      const shape = new THREE.Shape();
      for (let k = 0; k <= 14; k++) {
        const th = phi - beta + (2 * beta * k) / 14;
        k === 0 ? shape.moveTo(Math.cos(th) * R, Math.sin(th) * R) : shape.lineTo(Math.cos(th) * R, Math.sin(th) * R);
      }
      const s2 = R * Math.sin(beta) * 1.02;
      const p2 = n.clone().multiplyScalar(a).add(t.clone().multiplyScalar(s2));
      const p1 = n.clone().multiplyScalar(a).add(t.clone().multiplyScalar(-s2));
      shape.lineTo(p2.x, p2.y);
      shape.lineTo(p1.x, p1.y);
      shape.closePath();
      m.geometry.dispose();
      m.geometry = new THREE.ShapeGeometry(shape, 6);
      m.rotation.z = 0.05 * (i % 2 ? 1 : -1);
    });
  }
  setAperture(1.9);

  // ---------- Снимок ----------
  // Карточка с белой рамкой; изображение смотрит назад (−Z), как и экран.
  const print = new THREE.Group();
  const printStart = new THREE.Vector3(0, TOP_Y - PRINT.h / 2 - 0.08, SLOT_Z);
  print.position.copy(printStart);
  body.add(print);
  add(print, new RoundedBoxGeometry(PRINT.w, PRINT.h, 0.03, 2, 0.012), M.paper);
  const photoTex = photo.clone();
  photoTex.colorSpace = THREE.SRGBColorSpace;
  // кадр 2:3 вписываем в окно 0.8 обрезкой по высоте
  const visible = (photo.image.width / photo.image.height) / (PRINT.photoW / PRINT.photoH);
  photoTex.repeat.set(1, visible);
  photoTex.offset.set(0, (1 - visible) / 2);
  photoTex.needsUpdate = true;
  add(print, new THREE.PlaneGeometry(PRINT.photoW, PRINT.photoH), new THREE.MeshBasicMaterial({ map: photoTex, toneMapped: false }), [0, PRINT.photoY, -0.017], [0, Math.PI, 0]);
  // «проявка»: тёмная плёнка поверх изображения постепенно исчезает
  const develop = new THREE.MeshBasicMaterial({ color: 0x24262c, transparent: true, opacity: 1, toneMapped: false });
  add(print, new THREE.PlaneGeometry(PRINT.photoW, PRINT.photoH), develop, [0, PRINT.photoY, -0.019], [0, Math.PI, 0]);

  // мягкая тень
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 14),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.75 }),
  );
  shadow.rotation.x = -Math.PI / 2;

  return {
    root,
    body,
    shadow,
    print,
    printStart,
    lensFront: new THREE.Vector3(0, LENS_Y, BODY_FRONT + 6.9),
    shutter,
    setAperture,
    setFocusTurn(r) { focusRing.rotation.y = r; },
    setEject(k) { print.position.y = printStart.y + k * (PRINT.h - 0.25); },
    setDevelop(k) { develop.opacity = 1 - k; },
    setScreen(on) {
      screenMat.map = on ? screenTex : null;
      screenMat.color.set(on ? 0xffffff : 0x050607);
      screenMat.needsUpdate = true;
    },
  };
}
