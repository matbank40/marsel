import * as THREE from 'three';
import { gsap } from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildCameraModel, PRINT } from './camera-model.js';

// Вступительный ролик: камера прилетает, делает снимок со вспышкой, разворачивается,
// печатает фото — и снимок «влетает» в экран, превращаясь в первый экран сайта.
// Возвращает { ready, play, skip }. play() резолвится, когда сайт можно показывать.

export async function createIntro({ canvas, flashEl, photoUrl, lite = false }) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lite ? 1.5 : 1.75));
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
  const rim = new THREE.DirectionalLight(0x9db4ff, 3.0);
  rim.position.set(14, 6, -12);
  const back = new THREE.DirectionalLight(0xffffff, 1.4);
  back.position.set(4, 10, -18);
  const fill = new THREE.HemisphereLight(0xffffff, 0x1a1410, 0.35);
  const flashLight = new THREE.PointLight(0xffffff, 0, 60, 1.5);
  scene.add(key, rim, back, fill, flashLight);

  const photo = await new THREE.TextureLoader().loadAsync(photoUrl);
  photo.colorSpace = THREE.SRGBColorSpace;
  photo.anisotropy = 4;

  const model = buildCameraModel({ photo, lite });
  model.body.position.y = -1.0;
  scene.add(model.root, model.shadow);

  // ---------- Кадрирование под экран ----------
  let w = 1, h = 1, dist = 50;
  const CAM_Y = 0.3;
  function layout() {
    w = window.innerWidth;
    h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const portrait = w / h < 0.9;
    const byW = 15 / ((portrait ? 0.92 : 0.44) * 2 * tan * camera.aspect);
    const byH = 13 / ((portrait ? 0.5 : 0.62) * 2 * tan);
    dist = Math.max(byW, byH);
    camera.position.set(0, CAM_Y, dist);
    camera.lookAt(0, CAM_Y, 0);
  }
  layout();
  window.addEventListener('resize', layout);

  // ---------- Состояние, которое анимирует таймлайн ----------
  const s = {
    px: -16, py: 10, pz: -46, rx: 0.9, ry: -2.7, rz: 0.7,
    aperture: 1.9, focus: 0, press: 0, recoil: 0, flash: 0,
    eject: 0, develop: 0, fly: 0, fall: 0,
  };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  const onMove = (e) => {
    pointer.tx = (e.clientX / w) * 2 - 1;
    pointer.ty = (e.clientY / h) * 2 - 1;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  // Полёт снимка: из руки камеры — в точку, где изображение закрывает весь экран
  let flight = null;
  function detachPrint() {
    if (flight) return;
    scene.attach(model.print);
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const d = 6;
    const vh = 2 * d * tan, vw = vh * camera.aspect;
    const scale = Math.max(vh / PRINT.photoH, vw / PRINT.photoW) * 1.03;
    const toQuat = camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI));
    flight = {
      fromPos: model.print.position.clone(),
      fromQuat: model.print.quaternion.clone(),
      fromScale: model.print.scale.x,
      toPos: new THREE.Vector3(0, CAM_Y - PRINT.photoY * scale, dist - d),
      toQuat,
      toScale: scale,
    };
  }

  const tmpPos = new THREE.Vector3();
  function render(time) {
    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;
    const free = flight ? 0 : 1;

    model.setAperture(s.aperture);
    model.setFocusTurn(s.focus);
    model.setEject(s.eject);
    model.setDevelop(s.develop);
    model.shutter.position.y = 4.3 - s.press * 0.1;

    // мелкая вибрация, пока идёт печать
    const buzz = s.eject > 0 && s.eject < 1 ? Math.sin(time * 0.09) * 0.006 : 0;
    const root = model.root;
    root.rotation.set(
      s.rx + pointer.y * 0.08 * free,
      s.ry + pointer.x * 0.16 * free,
      s.rz + buzz,
    );
    root.position.set(
      s.px,
      s.py + Math.sin(time * 0.0012) * 0.18 * free - s.fall * 14,
      s.pz - s.recoil * 0.6,
    );
    model.shadow.position.set(root.position.x, -6.6 + s.py * 0.3, root.position.z);
    model.shadow.material.opacity = 0.7 * Math.max(0, 1 - Math.abs(s.pz) / 30) * (1 - s.fall);

    flashLight.intensity = s.flash * 900;
    flashLight.position.set(s.px, s.py + 3, s.pz + 14);

    if (flight) {
      const t = s.fly;
      tmpPos.lerpVectors(flight.fromPos, flight.toPos, t);
      tmpPos.y += Math.sin(Math.PI * t) * 2.2;
      model.print.position.copy(tmpPos);
      model.print.quaternion.slerpQuaternions(flight.fromQuat, flight.toQuat, Math.min(1, t * 1.25));
      model.print.scale.setScalar(THREE.MathUtils.lerp(flight.fromScale, flight.toScale, t * t));
    }

    renderer.render(scene, camera);
  }

  let raf = 0;
  const loop = (t) => {
    render(t);
    raf = requestAnimationFrame(loop);
  };

  function flash() {
    gsap.fromTo(flashEl, { opacity: 0 }, { opacity: 0.9, duration: 0.05, ease: 'none', yoyo: true, repeat: 1, repeatDelay: 0.04 });
    gsap.to(flashEl, { opacity: 0, duration: 0.6, delay: 0.14, ease: 'power2.out' });
    gsap.fromTo(s, { flash: 1 }, { flash: 0, duration: 0.7, ease: 'power3.out' });
  }

  function dispose() {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', layout);
    window.removeEventListener('pointermove', onMove);
    renderer.dispose();
    renderer.forceContextLoss();
  }

  let tl = null;
  let finish = () => {};

  return {
    // компилируем шейдеры заранее, чтобы первый кадр не дёргался
    warmup() {
      renderer.compile(scene, camera);
      render(0);
    },
    play({ onReveal }) {
      raf = requestAnimationFrame(loop);
      return new Promise((resolve) => {
        let revealed = false;
        const reveal = () => {
          if (revealed) return;
          revealed = true;
          onReveal();
        };
        finish = () => {
          tl?.kill();
          reveal();
          gsap.to(canvas, {
            opacity: 0, duration: 0.6, ease: 'power2.out',
            onComplete: () => { dispose(); resolve(); },
          });
        };

        tl = gsap.timeline({ onComplete: () => finish() });
        tl
          // прилёт
          .to(s, { px: 0, py: 0, pz: 0, duration: 1.7, ease: 'power3.out' }, 0)
          .to(s, { rx: 0.14, ry: 0.45, rz: 0, duration: 1.9, ease: 'power3.out' }, 0)
          // наводка на зрителя
          .to(s, { rx: 0.02, ry: 0, pz: 4, duration: 0.7, ease: 'power2.inOut' }, 1.75)
          .to(s, { focus: 1.4, aperture: 1.1, duration: 0.7, ease: 'power2.inOut' }, 1.75)
          // спуск затвора
          .to(s, { press: 1, duration: 0.08 }, 2.45)
          .to(s, { aperture: 0.05, duration: 0.07, ease: 'power2.in' }, 2.5)
          .call(flash, null, 2.56)
          .to(s, { recoil: 1, duration: 0.06 }, 2.56)
          .to(s, { recoil: 0, press: 0, duration: 0.45, ease: 'power2.out' }, 2.62)
          .to(s, { aperture: 1.9, duration: 0.2, ease: 'power2.out' }, 2.62)
          .call(() => model.setScreen(true), null, 2.75)
          // разворот к зрителю экраном
          .to(s, { ry: Math.PI, rx: 0.45, py: -2.4, pz: 0, duration: 1.2, ease: 'power3.inOut' }, 2.9)
          // печать и проявка
          .to(s, { eject: 1, duration: 1.3, ease: 'power1.inOut' }, 4.05)
          .to(s, { develop: 1, duration: 1.9, ease: 'power1.in' }, 4.4)
          // снимок летит в экран, камера уходит вниз
          .call(detachPrint, null, 5.55)
          .to(s, { fly: 1, duration: 1.25, ease: 'power3.inOut' }, 5.55)
          .to(s, { fall: 1, duration: 1.0, ease: 'power2.in' }, 5.6)
          .call(reveal, null, 6.8)
          .to({}, { duration: 0.1 });
        // ?intro-seek — ручная перемотка ролика для отладки кадров
        if (new URLSearchParams(location.search).has('intro-seek')) {
          tl.pause();
          window.__introSeek = (t) => tl.seek(t, false);
        }
      });
    },
    skip() {
      finish();
    },
  };
}
