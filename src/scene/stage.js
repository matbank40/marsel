import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCameraModel } from './camera-model.js';

// Сцена героя: рендерер, свет, модель и «режиссура» по состоянию state,
// которое снаружи анимирует GSAP по скроллу.

export function createStage(canvas, { lite = false, onProject } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.6 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  scene.environmentIntensity = 0.85;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 400);

  const key = new THREE.DirectionalLight(0xfff0dc, 2.6);
  key.position.set(-10, 14, 16);
  const rim = new THREE.DirectionalLight(0x9db4ff, 3.2);
  rim.position.set(14, 6, -12);
  const warmRim = new THREE.DirectionalLight(0xffc78a, 1.6);
  warmRim.position.set(-16, -2, -8);
  const fill = new THREE.HemisphereLight(0xffffff, 0x1a1410, 0.35);
  scene.add(key, rim, warmRim, fill);

  const model = buildCameraModel({ lite });
  model.body.position.y = -1.0;
  scene.add(model.root, model.shadow);

  const state = {
    intro: 0, rx: 0.2, ry: 0.62, rz: -0.05, side: 0, lift: 0,
    explode: 0, aperture: 1.8, zoomOut: 1, dolly: 0, focusTurn: 0, labels: 0,
  };

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  window.addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });

  let w = 1, h = 1, baseDist = 60, portrait = false;
  function layout() {
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    portrait = w / h < 0.9;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distW = 18 / ((portrait ? 0.9 : 0.42) * 2 * tan * camera.aspect);
    const distH = 12 / ((portrait ? 0.42 : 0.5) * 2 * tan);
    baseDist = Math.max(distW, distH);
  }
  layout();
  window.addEventListener('resize', layout);

  const lensLocal = new THREE.Vector3(0, model.lensY, model.lensFrontZ);
  const lensWorld = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const look = new THREE.Vector3();
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  function render(time) {
    const s = state;
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const free = 1 - s.dolly;
    const intro = easeOut(s.intro);

    model.setExplode(s.explode);
    model.setAperture(s.aperture);
    model.setFocusTurn(s.focusTurn + time * 0.00005);

    const root = model.root;
    root.rotation.set(
      s.rx + pointer.y * 0.09 * free,
      s.ry + pointer.x * 0.22 * free - (1 - intro) * 1.4,
      s.rz,
    );
    const floatY = Math.sin(time * 0.0011) * 0.22 * free;
    root.position.set(
      (portrait ? Math.min(0, s.side) * 1.4 : s.side) * 7,
      (portrait ? s.lift * 4.2 : 0) + floatY - (1 - intro) * 5,
      0,
    );
    model.shadow.position.x = root.position.x;
    model.shadow.position.y = root.position.y - 6.4 - floatY;
    model.shadow.material.opacity = 0.7 * intro * (1 - s.explode * 0.5) * free;

    root.updateMatrixWorld(true);
    model.body.localToWorld(lensWorld.copy(lensLocal));

    const d = THREE.MathUtils.smootherstep(s.dolly, 0, 1);
    const far = baseDist * (1 + (s.zoomOut - 1) * (portrait ? 2.1 : 1));
    camera.position.set(
      THREE.MathUtils.lerp(0, lensWorld.x, d),
      THREE.MathUtils.lerp(portrait ? -2.2 : -1.6, lensWorld.y, d),
      THREE.MathUtils.lerp(far, lensWorld.z + 1.2, d),
    );
    look.set(
      THREE.MathUtils.lerp(0, lensWorld.x, d),
      THREE.MathUtils.lerp(portrait ? -2.6 : -2.0, lensWorld.y, d),
      THREE.MathUtils.lerp(0, lensWorld.z - 6, d),
    );
    camera.lookAt(look);

    renderer.render(scene, camera);

    if (onProject) {
      const out = {};
      for (const [name, obj] of Object.entries(model.anchors)) {
        obj.getWorldPosition(tmp);
        tmp.project(camera);
        out[name] = { x: (tmp.x * 0.5 + 0.5) * w, y: (-tmp.y * 0.5 + 0.5) * h, visible: tmp.z < 1 };
      }
      onProject(out, state);
    }
  }

  // Во время «наезда» стекло занимает весь экран — это самый дорогой кадр.
  // Снижаем плотность пикселей, а когда ирис полностью закрыл сцену, не рендерим вовсе.
  const fullDpr = renderer.getPixelRatio();
  let covered = false;
  let raf = 0;
  let active = false;
  const loop = (t) => {
    const dpr = state.dolly > 0.25 ? Math.min(fullDpr, 1) : fullDpr;
    if (dpr !== renderer.getPixelRatio()) {
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
    }
    if (!covered) render(t);
    raf = requestAnimationFrame(loop);
  };
  function setActive(on) {
    if (on === active) return;
    active = on;
    if (on) raf = requestAnimationFrame(loop);
    else cancelAnimationFrame(raf);
  }

  // Прогреваем шейдеры заранее, чтобы первый кадр анимации не дёргался
  function warmup() {
    renderer.compile(scene, camera);
    render(0);
  }

  const setCovered = (v) => { covered = v; };

  return { state, setActive, setCovered, warmup, layout, get portrait() { return portrait; } };
}
