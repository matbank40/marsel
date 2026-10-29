import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

// Камера моментальной печати на основе модели Polaroid OneStep (public/models/polaroid.obj).
// В OBJ только геометрия: нормали пересчитываем со «складками», материалы назначаем по именам,
// а надписи, кольцо объектива и снимок добавляем сами.
// Единицы OBJ: ширина корпуса ≈ 5, объектив смотрит в +Z, щель печати — спереди внизу.

export const DISPLAY_FONT = '"Oswald", "Arial Narrow", sans-serif';
const SCALE = 2.6;
const CENTER = new THREE.Vector3(0, 2.02, -0.47);
const LENS = new THREE.Vector3(0.13, 3.035, 1.57);
const SLOT = { y: 0.84, z: 2.56 };
// Снимок: белая рамка с толстым нижним полем, окно с фото квадратное
export const PRINT = { w: 3.0, h: 3.62, photoW: 2.6, photoH: 2.6, photoY: 0.36 };

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Надпись по окружности на кольце объектива (UV у RingGeometry планарные)
function ringLabelTexture() {
  return canvasTexture(1024, 1024, (ctx, w) => {
    ctx.fillStyle = '#0c0c0d';
    ctx.fillRect(0, 0, w, w);
    const c = w / 2;
    ctx.translate(c, c);
    ctx.font = `500 46px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const chars = [...'MARSEL  ·  106 mm  1:12  ·  INSTANT  ·  '];
    const step = (Math.PI * 2) / chars.length;
    chars.forEach((ch, i) => {
      ctx.save();
      ctx.rotate(i * step);
      ctx.translate(0, -c * 0.8);
      ctx.fillStyle = 'rgba(235,232,226,0.85)';
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  });
}

// Логотип на передней панели
function brandTexture() {
  return canvasTexture(1024, 256, (ctx, w, h) => {
    ctx.font = `700 150px ${DISPLAY_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.letterSpacing = '24px';
    ctx.fillStyle = '#d9d6cf';
    ctx.fillText('MARSEL', w / 2, h / 2 + 6);
  });
}

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

export async function buildPolaroidModel({ photo, url }) {
  const text = await (await fetch(url)).text();
  const obj = new OBJLoader().parse(text);

  // ---------- Материалы ----------
  const plastic = new THREE.MeshPhysicalMaterial({
    color: 0x0c0c0e, roughness: 0.62, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.5, specularIntensity: 0.45,
    sheen: 0, sheenColor: 0x2a2a2e, sheenRoughness: 0.6, envMapIntensity: 0.28,
  });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.9, metalness: 0 });
  const chrome = new THREE.MeshPhysicalMaterial({ color: 0xcfd2d6, metalness: 1, roughness: 0.16, clearcoat: 0.4 });
  const lensGlass = new THREE.MeshPhysicalMaterial({
    color: 0x0a0c18, metalness: 0.2, roughness: 0.06, transparent: true, opacity: 0.9,
    iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [250, 700],
    clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.6, depthWrite: false,
  });
  const smokedGlass = new THREE.MeshPhysicalMaterial({
    color: 0x1a1d24, metalness: 0.3, roughness: 0.08, transparent: true, opacity: 0.75, clearcoat: 1, envMapIntensity: 1.4,
  });
  const flashLens = new THREE.MeshPhysicalMaterial({
    color: 0xe9ebee, roughness: 0.22, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.15,
    emissive: 0xffffff, emissiveIntensity: 0,
  });
  const redButton = new THREE.MeshPhysicalMaterial({ color: 0xc8141b, roughness: 0.3, clearcoat: 0.8, clearcoatRoughness: 0.2 });
  const byName = {
    camera_negra: plastic,
    // радугу Polaroid заменяем на корпусный цвет — камера полностью чёрная
    redstripr: plastic, orangestripr: plastic, yellowstrpr: plastic, greenstripr: plastic, bluestripr: plastic,
    lensrug: rubber,
    lens: lensGlass,
    glass: smokedGlass,
    mirror_glas: smokedGlass,
    '2flash': chrome,
    flash: chrome,
    mirror: flashLens,
    red_button: redButton,
  };

  const parts = {};
  obj.traverse((m) => {
    if (!m.isMesh) return;
    m.geometry = toCreasedNormals(m.geometry, THREE.MathUtils.degToRad(32));
    const pick = (mat) => byName[mat.name] || plastic;
    m.material = Array.isArray(m.material) ? m.material.map(pick) : pick(m.material);
    parts[m.name] = m;
  });

  // ---------- Сборка ----------
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(SCALE);
  body.position.copy(CENTER).multiplyScalar(-SCALE);
  root.add(body);
  body.add(obj);

  // Кольцо объектива с гравировкой
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.47, 0.86, 128, 1),
    new THREE.MeshPhysicalMaterial({ map: ringLabelTexture(), roughness: 0.45, metalness: 0.3, clearcoat: 0.5, transparent: true }),
  );
  ring.position.copy(LENS).add(new THREE.Vector3(0, 0, 0.012));
  ring.renderOrder = 2;
  body.add(ring);

  // Логотип на передней панели под щелью печати
  const brand = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.375),
    new THREE.MeshStandardMaterial({ map: brandTexture(), transparent: true, roughness: 0.4, metalness: 0.5 }),
  );
  brand.position.set(0.1, 0.4, 2.615);
  body.add(brand);

  // ---------- Снимок ----------
  // Лежит плашмя, изображением вверх; верх кадра смотрит внутрь камеры,
  // поэтому при взгляде спереди-сверху снимок виден правильно.
  const print = new THREE.Group();
  print.rotation.x = -Math.PI / 2;
  const printStartZ = SLOT.z - PRINT.h / 2 - 0.05;
  print.position.set(0.1, SLOT.y, printStartZ);
  body.add(print);
  print.add(new THREE.Mesh(
    new RoundedBoxGeometry(PRINT.w, PRINT.h, 0.03, 2, 0.012),
    new THREE.MeshStandardMaterial({ color: 0xf3f0ea, roughness: 0.62 }),
  ));
  const photoTex = photo.clone();
  photoTex.colorSpace = THREE.SRGBColorSpace;
  const visible = (photo.image.width / photo.image.height) / (PRINT.photoW / PRINT.photoH);
  photoTex.repeat.set(1, visible);
  photoTex.offset.set(0, (1 - visible) / 2);
  photoTex.needsUpdate = true;
  const photoMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(PRINT.photoW, PRINT.photoH),
    new THREE.MeshBasicMaterial({ map: photoTex, toneMapped: false }),
  );
  photoMesh.position.set(0, PRINT.photoY, 0.017);
  print.add(photoMesh);
  // «проявка»: тёмная плёнка поверх изображения постепенно исчезает
  const develop = new THREE.MeshBasicMaterial({ color: 0x24262c, transparent: true, opacity: 1, toneMapped: false });
  const developMesh = new THREE.Mesh(new THREE.PlaneGeometry(PRINT.photoW, PRINT.photoH), develop);
  developMesh.position.set(0, PRINT.photoY, 0.019);
  print.add(developMesh);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(26, 20),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, opacity: 0.75 }),
  );
  shadow.rotation.x = -Math.PI / 2;

  const button = parts['red_button_Circle.001'];
  const buttonZ = button ? button.position.z : 0;
  // точка вспышки в мировых координатах относительно корня
  const flashLocal = new THREE.Vector3(1.7, 3.45, 1.2);

  return {
    root,
    body,
    shadow,
    print,
    bottomY: -CENTER.y * SCALE,
    flashWorld: (target) => body.localToWorld(target.copy(flashLocal)),
    setPress(k) { if (button) button.position.z = buttonZ - k * 0.05; },
    setFlash(k) { flashLens.emissiveIntensity = k * 6; },
    setEject(k) { print.position.z = printStartZ + k * (PRINT.h - 0.45); },
    setDevelop(k) { develop.opacity = 1 - k; },
  };
}
