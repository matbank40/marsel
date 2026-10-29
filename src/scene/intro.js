import * as THREE from 'three';
import { gsap } from 'gsap';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildPolaroidModel, PRINT } from './polaroid-model.js';

// Вступительный ролик: камера моментальной печати прилетает, делает снимок со вспышкой,
// наклоняется — из щели выезжает фото и проявляется, а потом снимок «влетает» в экран
// и становится первым экраном сайта.
// Возвращает { ready, play, skip }. play() резолвится, когда сайт можно показывать.

export async function createIntro({ canvas, flashEl, photoUrl, modelUrl, lite = false }) {
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
  scene.environmentIntensity = 0.7;

  const camera = new THREE.PerspectiveCamera(26, 1, 0.1, 400);
  const key = new THREE.DirectionalLight(0xfff0dc, 2.4);
  key.position.set(-14, 16, 8);
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

  const model = await buildPolaroidModel({ photo, url: modelUrl });
  scene.add(model.root, model.shadow);

  // ---------- Кадрирование под экран ----------
  let w = 1, h = 1, dist = 50, portrait = false;
  const CAM_Y = 0.3;
  function layout() {
    w = window.innerWidth;
    h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    portrait = w / h < 0.9;
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
    press: 0, recoil: 0, flash: 0,
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
    const toQuat = camera.quaternion.clone();
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

    model.setEject(s.eject);
    model.setDevelop(s.develop);
    model.setPress(s.press);
    model.setFlash(s.flash);

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
    model.shadow.position.set(root.position.x, model.bottomY - 0.05 + s.py * 0.3, root.position.z);
    model.shadow.material.opacity = 0.7 * Math.max(0, 1 - Math.abs(s.pz) / 30) * (1 - s.fall);

    flashLight.intensity = s.flash * 900;
    if (s.flash > 0) {
      root.updateMatrixWorld(true);
      model.flashWorld(flashLight.position).z += 3;
    }

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
  let finish = () => {};
  const loop = (t) => {
    try {
      render(t);
    } catch (e) {
      // любая ошибка рендера — сразу показываем сайт, а не замерший кадр
      console.error(e);
      finish();
      return;
    }
    raf = requestAnimationFrame(loop);
  };
  canvas.addEventListener('webglcontextlost', () => finish(), { once: true });

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
        let done = false;
        // Страховка: что бы ни случилось с WebGL или таймлайном, через 12 с сайт откроется.
        // Если вкладку свернули посреди ролика, тоже не держим его — вернутся уже к сайту.
        const safety = setTimeout(() => finish(), 12000);
        const onHidden = () => { if (document.hidden) finish(); };
        document.addEventListener('visibilitychange', onHidden);
        finish = () => {
          if (done) return;
          done = true;
          clearTimeout(safety);
          document.removeEventListener('visibilitychange', onHidden);
          tl?.kill();
          reveal();
          // затухание через CSS, без GSAP: срабатывает, даже если его тикер встал
          canvas.style.transition = 'opacity 0.6s ease-out';
          canvas.style.opacity = '0';
          setTimeout(() => { dispose(); resolve(); }, 650);
        };

        tl = gsap.timeline({ onComplete: () => finish() });
        tl
          // прилёт
          .to(s, { px: 0, py: 0, pz: 0, duration: 1.7, ease: 'power3.out' }, 0)
          .to(s, { rx: 0.12, ry: 0.55, rz: 0, duration: 1.9, ease: 'power3.out' }, 0)
          // наводка на зрителя
          .to(s, { rx: 0.03, ry: 0, pz: 4, duration: 0.7, ease: 'power2.inOut' }, 1.75)
          // спуск: кнопка, вспышка, отдача
          .to(s, { press: 1, duration: 0.08 }, 2.45)
          .call(flash, null, 2.56)
          .to(s, { recoil: 1, duration: 0.06 }, 2.56)
          .to(s, { recoil: 0, press: 0, duration: 0.45, ease: 'power2.out' }, 2.62)
          // камера наклоняется к зрителю — видно, как выезжает снимок
          .to(s, { rx: 0.55, ry: 0.32, px: portrait ? -1.6 : 0, py: 3.2, pz: portrait ? -4 : -2, duration: 1.1, ease: 'power2.inOut' }, 2.95)
          .to(s, { eject: 1, duration: 1.5, ease: 'power1.inOut' }, 3.2)
          .to(s, { develop: 1, duration: 2.0, ease: 'power1.in' }, 3.55)
          // снимок летит в экран, камера уходит вниз
          .call(detachPrint, null, 5.55)
          .to(s, { fly: 1, duration: 1.25, ease: 'power3.inOut' }, 5.55)
          .to(s, { fall: 1, duration: 1.0, ease: 'power2.in' }, 5.6)
          .call(reveal, null, 6.8)
          .to({}, { duration: 0.1 });
        // ?intro-seek — ручная перемотка ролика для отладки кадров
        if (new URLSearchParams(location.search).has('intro-seek')) {
          tl.pause();
          clearTimeout(safety);
          window.__introSeek = (t) => tl.seek(t, false);
        }
      });
    },
    skip() {
      finish();
    },
  };
}
