import './style.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createStage } from './scene/stage.js';
import { initLightbox, initRing, initGrid, initCollages } from './gallery.js';
import { initPackages, initBooking } from './booking.js';
import { photoUrl } from './data.js';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const lite = !finePointer || window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;

document.querySelector('.year').textContent = new Date().getFullYear();

// ---------- Плавный скролл ----------
const lenis = reduceMotion ? null : new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
if (lenis) {
  lenis.stop();
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}

function scrollToTarget(hash) {
  const el = hash === '#top' ? 0 : document.querySelector(hash);
  if (el === null) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else if (el === 0) window.scrollTo({ top: 0, behavior: 'smooth' });
  else el.scrollIntoView({ behavior: 'smooth' });
}

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[data-scroll]');
  if (!a) return;
  e.preventDefault();
  setMenu(false);
  scrollToTarget(a.getAttribute('href'));
});

// ---------- Навигация и меню ----------
const nav = document.querySelector('.nav');
const burger = document.querySelector('.nav__burger');
function setMenu(open) {
  document.documentElement.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', open);
  document.querySelector('.menu').setAttribute('aria-hidden', !open);
  if (lenis) open ? lenis.stop() : lenis.start();
}
burger.addEventListener('click', () => setMenu(!document.documentElement.classList.contains('menu-open')));

// ---------- 3D-история ----------
const story = document.querySelector('.story');
const canvas = document.querySelector('.story__canvas');
const hotspots = [...document.querySelectorAll('.hotspot')];
const iris = document.querySelector('.iris');

// над 3D-сценой навигация прозрачная, дальше — «стекло»
ScrollTrigger.create({
  trigger: story,
  start: 'bottom 80px',
  end: 'max',
  onToggle: (self) => nav.classList.toggle('is-solid', self.isActive),
});

function placeHotspots(points, state) {
  const len = window.innerWidth < 760 ? 46 : 84;
  hotspots.forEach((el, i) => {
    const p = points[el.dataset.anchor];
    const k = Math.min(1, Math.max(0, state.labels * 1.8 - i * 0.22));
    el.style.opacity = p.visible ? k : 0;
    el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0)`;
    el.style.setProperty('--len', `${len * (0.6 + k * 0.4)}px`);
  });
}

const stage = createStage(canvas, { lite, onProject: placeHotspots });
if (!stage) {
  canvas.hidden = true;
  document.querySelector('.story__fallback').hidden = false;
}

// Ирис-диафрагма: девятиугольник, который раскрывается и поворачивается
const irisState = { k: 0 };
function drawIris() {
  const k = irisState.k;
  iris.style.visibility = k > 0.001 ? 'visible' : 'hidden';
  stage?.setCovered(k > 0.995);
  iris.style.setProperty('--k', k.toFixed(3));
  const w = iris.clientWidth, h = iris.clientHeight;
  const r = Math.hypot(w, h) * 0.62 * k;
  const rot = k * 1.4;
  const pts = [];
  for (let i = 0; i < 9; i++) {
    const a = rot + (i / 9) * Math.PI * 2;
    pts.push(`${(w / 2 + Math.cos(a) * r).toFixed(1)}px ${(h / 2 + Math.sin(a) * r).toFixed(1)}px`);
  }
  iris.style.clipPath = `polygon(${pts.join(',')})`;
}

function buildStory() {
  const tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: { trigger: story, start: 'top top', end: 'bottom bottom', scrub: reduceMotion ? true : 0.9 },
  });
  if (stage) {
    const s = stage.state;
    tl.to(s, { ry: 1.05, rx: 0.08, rz: 0, side: 0.62, lift: 0.3, aperture: 0.8, focusTurn: 1.6, duration: 2.4, ease: 'power1.inOut' }, 0)
      .to(s, { explode: 1, zoomOut: 1.3, ry: 1.28, rx: 0.24, side: -0.78, lift: 0.12, duration: 2.4, ease: 'power2.inOut' }, 2.6)
      .to(s, { labels: 1, duration: 0.7 }, 4.4)
      .to(s, { labels: 0, duration: 0.5 }, 6.0)
      .to(s, { explode: 0, zoomOut: 1, ry: 0, rx: 0, side: 0, lift: 0, aperture: 2.12, focusTurn: 0, duration: 1.9, ease: 'power2.inOut' }, 6.3)
      .to(s, { dolly: 1, duration: 1.8, ease: 'power2.in' }, 8.1);
  }
  tl.to('.hero-title', { autoAlpha: 0, scale: 0.9, duration: 1.0 }, 0.15)
    .to('.hero-copy', { autoAlpha: 0, y: -40, duration: 0.7 }, 0.1)
    .to('.scroll-hint', { autoAlpha: 0, duration: 0.4 }, 0.1)
    .fromTo('[data-line="1"]', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 1.2)
    .to('[data-line="1"]', { autoAlpha: 0, y: -40, duration: 0.6 }, 2.7)
    .fromTo('[data-line="2"]', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: 0.7 }, 6.7)
    .to('[data-line="2"]', { autoAlpha: 0, y: -30, duration: 0.5 }, 8.3)
    .fromTo(irisState, { k: 0 }, { k: 1, duration: 1.4, ease: 'power2.inOut', onUpdate: drawIris }, 8.7)
    .to({}, { duration: 0.5 });
}

// рендерим 3D только когда история на экране
if (stage) {
  ScrollTrigger.create({
    trigger: story,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => stage.setActive(self.isActive),
  });
}

// ---------- Манифест: слова «загораются» по скроллу ----------
function initManifesto() {
  const el = document.querySelector('[data-words]');
  const accent = /^(fashion|editorial|настоящий:?)$/i;
  el.innerHTML = el.textContent.trim().split(/\s+/)
    .map((w) => `<span class="w${accent.test(w) ? ' accent' : ''}">${w}</span>`).join(' ');
  const words = [...el.querySelectorAll('.w')];
  ScrollTrigger.create({
    trigger: el,
    start: 'top 82%',
    end: 'bottom 45%',
    scrub: true,
    onUpdate: (self) => {
      const n = Math.round(self.progress * words.length);
      words.forEach((w, i) => w.classList.toggle('on', i < n));
    },
  });
}

// ---------- Портрет фотографа: мягкий параллакс ----------
function initAboutPhoto() {
  const img = document.querySelector('.about__frame img');
  if (!img || reduceMotion) return;
  ScrollTrigger.create({
    trigger: '.about__photo',
    start: 'top bottom',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => img.style.setProperty('--py', `${-16 + self.progress * 16}%`),
  });
}

// ---------- Счётчики ----------
function initCounters() {
  document.querySelectorAll('[data-count]').forEach((el) => {
    const target = Number(el.dataset.count);
    const o = { v: 0 };
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => gsap.to(o, { v: target, duration: 2.2, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } }),
    });
  });
}

// ---------- Появление блоков ----------
function initReveal() {
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add('is-visible');
        io.unobserve(e.target);
      }
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('[data-reveal], .step').forEach((el) => {
    if (!el.style.getPropertyValue('--d')) el.style.setProperty('--d', [...el.parentElement.children].indexOf(el));
    io.observe(el);
  });
  document.querySelectorAll('.principle').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}

// ---------- Курсор ----------
function initCursor() {
  if (!finePointer || reduceMotion) return;
  document.documentElement.classList.add('has-cursor');
  const c = document.querySelector('.cursor');
  const dot = c.querySelector('.cursor__dot');
  const ring = c.querySelector('.cursor__ring');
  const label = c.querySelector('.cursor__label');
  const pos = { x: innerWidth / 2, y: innerHeight / 2 }, ringPos = { ...pos };
  window.addEventListener('pointermove', (e) => {
    pos.x = e.clientX;
    pos.y = e.clientY;
    dot.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
    const t = e.target;
    const view = t.closest?.('[data-cursor="view"]');
    const text = t.closest?.('input[type="text"], textarea');
    const link = t.closest?.('a, button, label, .pkg-option');
    c.classList.toggle('is-view', !!view);
    c.classList.toggle('is-text', !view && !!text);
    c.classList.toggle('is-link', !view && !text && !!link);
    label.textContent = view ? 'Смотреть' : '';
  }, { passive: true });
  gsap.ticker.add(() => {
    ringPos.x += (pos.x - ringPos.x) * 0.18;
    ringPos.y += (pos.y - ringPos.y) * 0.18;
    ring.style.transform = `translate3d(${ringPos.x}px, ${ringPos.y}px, 0)`;
  });
  document.addEventListener('pointerleave', () => { c.style.opacity = 0; });
  document.addEventListener('pointerenter', () => { c.style.opacity = 1; });
}

// ---------- Сборка страницы ----------
const lightbox = initLightbox({ lenis });
const ring = initRing(lightbox);
initGrid(lightbox);
const collages = initCollages(lightbox);
const booking = initBooking();
initPackages({
  finePointer,
  onChoose: (id) => {
    booking.selectPackage(id);
    scrollToTarget('#booking');
  },
});

buildStory();
initManifesto();
initAboutPhoto();
initCounters();
initReveal();
initCursor();

if (ring) {
  ScrollTrigger.create({
    trigger: '.ring-section',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => ring.update(self.progress),
  });
}
if (collages) {
  ScrollTrigger.create({
    trigger: '.collages',
    start: 'top top',
    end: 'bottom bottom',
    onUpdate: (self) => collages.update(self.progress),
    onRefreshInit: () => collages.layout(),
  });
}
window.addEventListener('layoutchange', () => ScrollTrigger.refresh());

// ---------- Прелоадер и интро ----------
(function preload() {
  const pre = document.querySelector('.preloader');
  const bar = pre.querySelector('.preloader__bar');
  const count = pre.querySelector('.preloader__count');
  const irisSvg = pre.querySelector('.preloader__iris g');
  irisSvg.innerHTML = Array.from({ length: 9 }, (_, i) => {
    const a = (i / 9) * Math.PI * 2;
    const x1 = 50 + Math.cos(a) * 44, y1 = 50 + Math.sin(a) * 44;
    const x2 = 50 + Math.cos(a + 2.1) * 18, y2 = 50 + Math.sin(a + 2.1) * 18;
    return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)}"/>`;
  }).join('') + '<circle cx="50" cy="50" r="44" fill="none" stroke="#c8a46a" stroke-width="1.4"/>';

  const shown = { v: 0 };
  let target = 0.15;
  const tick = () => {
    shown.v += (target - shown.v) * 0.08;
    bar.style.setProperty('--p', shown.v.toFixed(3));
    count.textContent = Math.round(shown.v * 100);
  };
  gsap.ticker.add(tick);

  const fontReady = (document.fonts?.ready || Promise.resolve()).then(() => { target = Math.max(target, 0.45); });
  const imgReady = new Promise((res) => {
    const im = new Image();
    im.onload = im.onerror = res;
    im.src = photoUrl('blue-veil');
  }).then(() => { target = Math.max(target, 0.7); });
  const minTime = new Promise((r) => setTimeout(r, reduceMotion ? 200 : 1400));

  Promise.all([fontReady, imgReady]).then(() => {
    // шейдеры компилируем после шрифтов: на текстурах есть надписи
    if (stage) stage.warmup();
    target = 1;
    return minTime;
  }).then(() => new Promise((r) => setTimeout(r, 450))).then(() => {
    gsap.ticker.remove(tick);
    count.textContent = '100';
    pre.classList.add('is-done');
    document.body.classList.remove('is-loading');
    lenis?.start();
    ScrollTrigger.refresh();
    intro();
  });
})();

function intro() {
  if (stage) gsap.to(stage.state, { intro: 1, duration: reduceMotion ? 0 : 2.4, ease: 'power3.out' });
  if (reduceMotion) return;
  gsap.from('.hero-title span', { yPercent: 60, autoAlpha: 0, filter: 'blur(12px)', stagger: 0.07, duration: 1.6, ease: 'expo.out', delay: 0.1 });
  gsap.from('.hero-copy > *', { y: 30, autoAlpha: 0, stagger: 0.12, duration: 1.2, ease: 'expo.out', delay: 0.6 });
  gsap.from('.nav', { y: -30, autoAlpha: 0, duration: 1.2, ease: 'expo.out', delay: 0.4 });
}
