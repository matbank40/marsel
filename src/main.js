import './style.css';
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { initLightbox, initRing, initGrid, initCollages } from './gallery.js';
import { initPackages, initBooking } from './booking.js';
import { photoUrl } from './data.js';

gsap.registerPlugin(ScrollTrigger);

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
const lite = !finePointer || window.innerWidth < 760 || (navigator.hardwareConcurrency || 8) <= 4;
const HERO_PHOTO = 'blue-veil';

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

// ---------- Меню ----------
const burger = document.querySelector('.nav__burger');
function setMenu(open) {
  document.documentElement.classList.toggle('menu-open', open);
  burger.setAttribute('aria-expanded', open);
  document.querySelector('.menu').setAttribute('aria-hidden', !open);
  if (lenis) open ? lenis.stop() : lenis.start();
}
burger.addEventListener('click', () => setMenu(!document.documentElement.classList.contains('menu-open')));

// ---------- Первый экран ----------
function initHeroParallax() {
  const img = document.querySelector('.hero__media img');
  if (reduceMotion) return;
  ScrollTrigger.create({
    trigger: '.hero',
    start: 'top top',
    end: 'bottom top',
    scrub: true,
    onUpdate: (self) => {
      img.style.transform = `translate3d(0, ${self.progress * 18}%, 0) scale(${1 + self.progress * 0.08})`;
    },
  });
}

function showHero() {
  document.body.classList.remove('is-intro');
  lenis?.start();
  ScrollTrigger.refresh();
  if (reduceMotion) return;
  // снимок из ролика «доезжает» до кадрирования первого экрана
  gsap.fromTo('.hero__media img', { scale: 1.18 }, { scale: 1, duration: 1.8, ease: 'power3.out', clearProps: 'transform' });
  gsap.from('.hero__title span', { yPercent: 105, stagger: 0.06, duration: 1.2, ease: 'expo.out', delay: 0.15 });
  gsap.from('.hero__row > *', { y: 24, autoAlpha: 0, stagger: 0.1, duration: 1, ease: 'expo.out', delay: 0.45 });
}

// ---------- Манифест: слова проявляются по скроллу ----------
function initManifesto() {
  const el = document.querySelector('[data-words]');
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
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
    label.textContent = view ? 'Открыть' : '';
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

initHeroParallax();
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

// ---------- Загрузка и вступительный ролик ----------
(async function start() {
  const pre = document.querySelector('.preloader');
  const bar = pre.querySelector('.preloader__bar');
  const count = pre.querySelector('.preloader__count');
  const introEl = document.querySelector('.intro');

  const shown = { v: 0 };
  let target = 0.1;
  const tick = () => {
    shown.v += (target - shown.v) * 0.1;
    bar.style.setProperty('--p', shown.v.toFixed(3));
    count.textContent = Math.round(shown.v * 100);
  };
  gsap.ticker.add(tick);

  // шрифт нужен до сборки модели: им набраны надписи на камере
  await Promise.race([
    Promise.all([document.fonts?.load('700 64px Oswald'), document.fonts?.ready]),
    new Promise((r) => setTimeout(r, 2500)),
  ]).catch(() => {});
  target = 0.45;

  let intro = null;
  if (!reduceMotion) {
    // 3D-движок грузится отдельным файлом и только для ролика
    const { createIntro } = await import('./scene/intro.js');
    intro = await createIntro({
      canvas: introEl.querySelector('.intro__canvas'),
      flashEl: introEl.querySelector('.intro__flash'),
      photoUrl: photoUrl(HERO_PHOTO),
      lite,
    }).catch(() => null);
  }
  target = 0.85;
  intro?.warmup();
  await new Promise((r) => {
    const img = document.querySelector('.hero__media img');
    if (img.complete) r();
    else img.addEventListener('load', r, { once: true }), img.addEventListener('error', r, { once: true });
  });
  target = 1;
  await new Promise((r) => setTimeout(r, 450));
  gsap.ticker.remove(tick);
  count.textContent = '100';
  pre.classList.add('is-done');
  document.body.classList.remove('is-loading');

  if (!intro) {
    introEl.remove();
    showHero();
    return;
  }

  const skip = introEl.querySelector('.intro__skip');
  const onKey = (e) => { if (e.key === 'Escape') intro.skip(); };
  skip.addEventListener('click', () => intro.skip());
  window.addEventListener('keydown', onKey);

  await intro.play({
    onReveal: () => {
      introEl.classList.add('is-revealing');
      showHero();
    },
  });
  window.removeEventListener('keydown', onKey);
  introEl.remove();
})();
