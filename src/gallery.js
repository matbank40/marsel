import { photos, collages, categories, photoUrl as src } from './data.js';
const toSlide = (p) => ({ src: src(p.id), title: p.title, sub: categories[p.cat] || 'Коллаж', alt: p.alt || p.title });

// ---------- Лайтбокс ----------
export function initLightbox({ lenis } = {}) {
  const box = document.querySelector('.lightbox');
  const img = box.querySelector('.lightbox__img');
  const title = box.querySelector('.lightbox__title');
  const count = box.querySelector('.lightbox__count');
  let list = [];
  let index = 0;
  let lastFocus = null;

  function show(i, dir = 0) {
    index = (i + list.length) % list.length;
    const s = list[index];
    const apply = () => {
      img.src = s.src;
      img.alt = s.alt;
      title.textContent = s.title;
      count.textContent = `${s.sub} · ${index + 1} / ${list.length}`;
      img.classList.remove('is-swapping');
    };
    if (dir && !box.hidden) {
      img.classList.add('is-swapping');
      const pre = new Image();
      pre.src = s.src;
      pre.decode().catch(() => {}).finally(() => setTimeout(apply, 120));
    } else apply();
    // подгружаем соседей
    [1, -1].forEach((d) => { new Image().src = list[(index + d + list.length) % list.length].src; });
  }

  function open(slides, i) {
    list = slides;
    lastFocus = document.activeElement;
    box.hidden = false;
    document.documentElement.classList.add('lightbox-open');
    lenis?.stop();
    show(i);
    box.querySelector('.lightbox__close').focus({ preventScroll: true });
  }

  function close() {
    box.hidden = true;
    document.documentElement.classList.remove('lightbox-open');
    lenis?.start();
    lastFocus?.focus?.({ preventScroll: true });
  }

  box.querySelector('.lightbox__bg').addEventListener('click', close);
  box.querySelector('.lightbox__close').addEventListener('click', close);
  box.querySelector('.lightbox__prev').addEventListener('click', () => show(index - 1, -1));
  box.querySelector('.lightbox__next').addEventListener('click', () => show(index + 1, 1));
  window.addEventListener('keydown', (e) => {
    if (box.hidden) return;
    if (e.key === 'Escape') close();
    if (e.key === 'ArrowRight') show(index + 1, 1);
    if (e.key === 'ArrowLeft') show(index - 1, -1);
  });

  // свайпы на телефоне
  let sx = 0, sy = 0, tracking = false;
  const fig = box.querySelector('.lightbox__figure');
  fig.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; tracking = true; });
  fig.addEventListener('pointerup', (e) => {
    if (!tracking) return;
    tracking = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) show(index + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
    else if (dy > 90) close();
  });
  fig.addEventListener('click', (e) => { if (e.target === fig) close(); });

  return { open };
}

// ---------- Кольцо-карусель ----------
export function initRing(lightbox) {
  const ring = document.querySelector('.ring');
  const stage = document.querySelector('.ring-stage');
  if (!ring || !photos.length) return null;

  // В кольце ровно RING_SIZE карточек: с ростом портфолио кольцо не раздувается.
  // Берём кадры равномерно по всему списку (или отмеченные featured: true),
  // при нехватке фото повторяем их.
  const RING_SIZE = 12;
  const featured = photos.filter((p) => p.featured);
  const pool = featured.length >= RING_SIZE ? featured.slice(0, RING_SIZE)
    : photos.length > RING_SIZE
      ? Array.from({ length: RING_SIZE }, (_, i) => photos[Math.floor((i * photos.length) / RING_SIZE)])
      : photos;
  const items = Array.from({ length: RING_SIZE }, (_, i) => pool[i % pool.length]);
  const N = items.length;
  const slides = pool.map(toSlide);

  ring.style.setProperty('--n', N);
  ring.innerHTML = items.map((p, i) => `
    <button class="ring__item" style="--i:${i}" data-cursor="view" data-idx="${i % pool.length}" aria-label="Открыть фото «${p.title}»">
      <img src="${src(p.id, true)}" alt="${p.alt}" width="820" height="1230" loading="lazy" decoding="async" draggable="false" />
    </button>`).join('');
  const els = [...ring.children];

  let itemW = 260;
  function layout() {
    const vw = window.innerWidth, vh = window.innerHeight;
    itemW = vw < 760 ? Math.min(vw * 0.5, vh * 0.3) : Math.min(Math.max(vw * 0.17, 200), vh * 0.34, 320);
    const radius = (itemW / 2) / Math.tan(Math.PI / N) * 1.18;
    ring.style.setProperty('--item-w', `${itemW}px`);
    ring.style.setProperty('--radius-3d', `${radius}px`);
  }
  layout();
  window.addEventListener('resize', layout);

  let progress = 0, drag = 0, velocity = 0, dragging = false, moved = 0, lastX = 0, raf = 0;
  function apply() {
    const rot = -progress * 300 + drag;
    ring.style.setProperty('--rot', `${rot}deg`);
    els.forEach((el, i) => {
      const a = ((i * 360) / N + rot) * (Math.PI / 180);
      const f = Math.max(0, Math.cos(a));
      el.style.setProperty('--f', (f * f).toFixed(3));
    });
  }
  apply();

  // инерция после перетаскивания
  function coast() {
    velocity *= 0.94;
    drag += velocity;
    apply();
    if (Math.abs(velocity) > 0.02) raf = requestAnimationFrame(coast);
  }

  stage.style.touchAction = 'pan-y';
  stage.addEventListener('pointerdown', (e) => {
    dragging = true; moved = 0; lastX = e.clientX; velocity = 0;
    cancelAnimationFrame(raf);
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastX;
    lastX = e.clientX;
    moved += Math.abs(dx);
    velocity = dx * 0.25;
    drag += dx * 0.25;
    apply();
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    raf = requestAnimationFrame(coast);
  });
  window.addEventListener('pointercancel', () => { dragging = false; });

  ring.addEventListener('click', (e) => {
    const btn = e.target.closest('.ring__item');
    if (!btn || moved > 8) return;
    lightbox.open(slides, Number(btn.dataset.idx));
  });

  return { update(p) { progress = p; apply(); } };
}

// ---------- Сетка с фильтрами ----------
export function initGrid(lightbox) {
  const grid = document.querySelector('.grid');
  const filters = document.querySelector('.filters');
  const present = Object.keys(categories).filter((c) => photos.some((p) => p.cat === c));
  const tabs = [['all', 'Все'], ...present.map((c) => [c, categories[c]])];

  filters.innerHTML = `<span class="filters__pill" aria-hidden="true"></span>` + tabs
    .map(([id, label], i) => `<button class="filter${i ? '' : ' is-active'}" role="tab" aria-selected="${!i}" data-cat="${id}">${label}</button>`)
    .join('');
  const pill = filters.querySelector('.filters__pill');

  function movePill() {
    const a = filters.querySelector('.filter.is-active');
    pill.style.width = `${a.offsetWidth}px`;
    pill.style.transform = `translateX(${a.offsetLeft}px)`;
  }

  let current = [];
  function render(cat) {
    current = cat === 'all' ? photos : photos.filter((p) => p.cat === cat);
    grid.innerHTML = current.map((p, i) => `
      <button class="tile" style="--d:${i % 6}" data-cursor="view" data-i="${i}" aria-label="Открыть «${p.title}»">
        <img src="${src(p.id, true)}" srcset="${src(p.id, true)} 820w, ${src(p.id)} ${p.w}w"
          sizes="(max-width: 760px) 50vw, (max-width: 1024px) 50vw, 33vw"
          width="${p.w}" height="${p.h}" alt="${p.alt}" loading="lazy" decoding="async" />
        <span class="tile__cap"><b>${p.title}</b><span>${categories[p.cat]}</span></span>
      </button>`).join('');
    requestAnimationFrame(() => grid.querySelectorAll('.tile').forEach((t) => t.classList.add('is-in')));
  }

  filters.addEventListener('click', (e) => {
    const b = e.target.closest('.filter');
    if (!b || b.classList.contains('is-active')) return;
    filters.querySelectorAll('.filter').forEach((f) => {
      f.classList.toggle('is-active', f === b);
      f.setAttribute('aria-selected', f === b);
    });
    movePill();
    render(b.dataset.cat);
    window.dispatchEvent(new Event('layoutchange'));
  });

  grid.addEventListener('click', (e) => {
    const t = e.target.closest('.tile');
    if (t) lightbox.open(current.map(toSlide), Number(t.dataset.i));
  });

  render('all');
  requestAnimationFrame(movePill);
  window.addEventListener('resize', movePill);
  document.fonts?.ready.then(movePill);
}

// ---------- Коллажи: стопка полноэкранных «обложек» ----------
// Каждая обложка прилипает к экрану, следующая наезжает сверху, а предыдущая
// уходит вглубь (уменьшается и темнеет). На телефоне коллаж можно листать пальцем вбок.
export function initCollages(lightbox) {
  const section = document.querySelector('.collages');
  if (!section || !collages.length) return null;
  section.hidden = false;
  const wrap = section.querySelector('.covers');
  const slides = collages.map(toSlide);
  const pad = (n) => String(n).padStart(2, '0');

  wrap.innerHTML = collages.map((c, i) => `
    <article class="cover" style="--accent:${c.color || '#c8a46a'}">
      <div class="cover__inner">
        <div class="cover__bg" style="background-image:url('${src(c.id, true)}')"></div>
        <div class="cover__meta">
          <span class="cover__num">${pad(i + 1)}<small>/${pad(collages.length)}</small></span>
          <div><p class="cover__tag">${c.tag || 'Коллаж'}</p><h3 class="cover__title">${c.title}</h3></div>
        </div>
        <div class="cover__scroller">
          <button class="cover__art" data-cursor="view" data-i="${i}" aria-label="Открыть коллаж «${c.title}»">
            <img src="${src(c.id, true)}" srcset="${src(c.id, true)} 1100w, ${src(c.id)} ${c.w}w"
              sizes="(max-width: 760px) 160vw, 92vw" width="${c.w}" height="${c.h}"
              alt="${c.alt || c.title}" loading="lazy" decoding="async" draggable="false" />
          </button>
        </div>
        <p class="cover__hint">Листайте вбок · нажмите, чтобы открыть</p>
      </div>
    </article>`).join('');

  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('.cover__art');
    if (b) lightbox.open(slides, Number(b.dataset.i));
  });

  // На телефоне начинаем с середины коллажа — там обычно главный кадр
  const centerScrollers = () => {
    wrap.querySelectorAll('.cover__scroller').forEach((sc) => {
      sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) / 2;
    });
  };
  wrap.querySelectorAll('img').forEach((im) => im.addEventListener('load', centerScrollers, { once: true }));
  window.addEventListener('resize', centerScrollers);

  const covers = [...wrap.querySelectorAll('.cover')];
  return {
    covers,
    // k — насколько следующая обложка уже наехала на эту (0…1)
    setDepth(i, k) {
      const el = covers[i].querySelector('.cover__inner');
      el.style.transform = `scale(${1 - k * 0.1}) translateY(${-k * 3}%)`;
      el.style.filter = `brightness(${1 - k * 0.6})`;
    },
    // p — прогресс появления обложки снизу (0…1)
    setEnter(i, p) {
      covers[i].style.setProperty('--enter', p.toFixed(3));
    },
  };
}
