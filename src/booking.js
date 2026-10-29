import { packages, formatPrice, contacts } from './data.js';

const check = '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 10.5l4 4 8-9"/></svg>';

// ---------- Карточки пакетов ----------
export function initPackages({ onChoose, finePointer }) {
  const wrap = document.querySelector('.cards');
  wrap.innerHTML = packages.map((p, i) => `
    <article class="card${p.popular ? ' card--gold' : ''}" data-reveal style="--d:${i}">
      <div class="card__bg"><img src="/photos/${p.photo}-sm.webp" alt="" loading="lazy" /></div>
      <div class="card__spot"></div>
      ${p.popular ? '<span class="card__badge">Популярный</span>' : ''}
      <span class="card__name">${p.name}</span>
      <div class="card__price">${formatPrice(p.price)}</div>
      <span class="card__dur">${p.duration}</span>
      <ul class="card__list">${p.features.map((f) => `<li>${check}<span>${f}</span></li>`).join('')}</ul>
      <div class="card__terms"><b>Предоплата — ${formatPrice(p.prepay)}</b><span>${p.terms}</span></div>
      <button class="btn ${p.popular ? 'btn--gold' : 'btn--light'}" data-package="${p.id}">Записаться</button>
    </article>`).join('');

  wrap.addEventListener('click', (e) => {
    const b = e.target.closest('[data-package]');
    if (b) onChoose(b.dataset.package);
  });

  wrap.querySelectorAll('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${x * 100}%`);
      card.style.setProperty('--my', `${y * 100}%`);
      if (finePointer) {
        card.style.setProperty('--rx', `${(0.5 - y) * 6}deg`);
        card.style.setProperty('--ry', `${(x - 0.5) * 8}deg`);
      }
    });
    card.addEventListener('pointerleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });
}

// ---------- Календарь ----------
function initCalendar(form) {
  const btn = form.querySelector('.date-btn');
  const value = btn.querySelector('.date-btn__value');
  const cal = form.querySelector('.calendar');
  const input = form.querySelector('input[name="date"]');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let view = new Date(today.getFullYear(), today.getMonth(), 1);
  let selected = null;
  value.classList.add('is-empty');

  const monthTitle = (d) => d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
  const human = (d) => d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });
  const sameDay = (a, b) => a && b && a.getTime() === b.getTime();
  const maxView = new Date(today.getFullYear(), today.getMonth() + 11, 1);

  function render() {
    const first = (view.getDay() + 6) % 7; // понедельник — первый
    const days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    let cells = '';
    for (let i = 0; i < first; i++) cells += '<span></span>';
    for (let d = 1; d <= days; d++) {
      const date = new Date(view.getFullYear(), view.getMonth(), d);
      const dow = (date.getDay() + 6) % 7;
      const cls = ['cal__day', sameDay(date, today) && 'is-today', sameDay(date, selected) && 'is-selected', dow > 4 && 'is-weekend'].filter(Boolean).join(' ');
      cells += `<button type="button" class="${cls}" data-d="${d}" ${date < today ? 'disabled' : ''}>${d}</button>`;
    }
    cal.innerHTML = `
      <div class="cal__head">
        <span class="cal__title">${monthTitle(view)}</span>
        <div class="cal__nav">
          <button type="button" data-nav="-1" aria-label="Предыдущий месяц" ${view <= new Date(today.getFullYear(), today.getMonth(), 1) ? 'disabled' : ''}>‹</button>
          <button type="button" data-nav="1" aria-label="Следующий месяц" ${view >= maxView ? 'disabled' : ''}>›</button>
        </div>
      </div>
      <div class="cal__grid">${['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<span class="cal__dow">${d}</span>`).join('')}${cells}</div>`;
  }

  function toggle(open) {
    cal.hidden = !open;
    btn.setAttribute('aria-expanded', open);
    if (open) render();
  }

  btn.addEventListener('click', () => toggle(cal.hidden));
  cal.addEventListener('click', (e) => {
    e.stopPropagation();
    const nav = e.target.closest('[data-nav]');
    if (nav) {
      view = new Date(view.getFullYear(), view.getMonth() + Number(nav.dataset.nav), 1);
      render();
      return;
    }
    const day = e.target.closest('[data-d]');
    if (!day || day.disabled) return;
    selected = new Date(view.getFullYear(), view.getMonth(), Number(day.dataset.d));
    const text = human(selected);
    value.textContent = text.charAt(0).toUpperCase() + text.slice(1);
    value.classList.remove('is-empty');
    input.value = selected.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).replace(/\s*г\.$/, '');
    toggle(false);
  });
  document.addEventListener('click', (e) => {
    if (!cal.hidden && !e.target.closest('.field--date')) toggle(false);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !cal.hidden) toggle(false);
  });

  return {
    reset() {
      selected = null;
      input.value = '';
      value.textContent = 'Выберите дату';
      value.classList.add('is-empty');
    },
  };
}

// ---------- Форма записи ----------
export function initBooking() {
  const form = document.querySelector('.form');
  const options = form.querySelector('.pkg-options');
  options.innerHTML = packages.map((p, i) => `
    <label class="pkg-option">
      <input type="radio" name="package" value="${p.id}" ${i === 0 ? 'checked' : ''} />
      <b>${p.name}</b><span>${formatPrice(p.price)} · ${p.duration.toLowerCase()}</span>
    </label>`).join('');

  const calendar = initCalendar(form);
  const done = form.querySelector('.form__done');
  const fallback = form.querySelector('.form__fallback');
  let lastMessage = '';

  const fields = {
    name: { el: form.elements.name, ok: (v) => v.trim().length >= 2 },
    contact: {
      el: form.elements.contact,
      ok: (v) => {
        const s = v.trim();
        return /^@?[a-zA-Z][\w]{3,31}$/.test(s) || /t\.me\//.test(s) || s.replace(/\D/g, '').length >= 10;
      },
    },
  };

  Object.values(fields).forEach(({ el, ok }) => {
    el.addEventListener('input', () => {
      if (ok(el.value)) el.closest('.field').classList.remove('is-invalid');
    });
  });

  function buildMessage(d) {
    const pkg = packages.find((p) => p.id === d.package);
    return [
      'Здравствуйте! Хочу записаться на съёмку.',
      `Имя: ${d.name}`,
      `Контакт: ${d.contact}`,
      `Пакет: ${pkg ? `${pkg.name} — ${formatPrice(pkg.price)}` : '—'}`,
      `Дата: ${d.date || 'обсудим'}`,
      d.comment ? `Комментарий: ${d.comment}` : '',
    ].filter(Boolean).join('\n');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    let firstBad = null;
    for (const { el, ok } of Object.values(fields)) {
      const bad = !ok(el.value);
      el.closest('.field').classList.toggle('is-invalid', bad);
      if (bad && !firstBad) firstBad = el;
    }
    if (firstBad) {
      firstBad.focus();
      return;
    }

    const data = Object.fromEntries(new FormData(form).entries());
    Object.keys(data).forEach((k) => { data[k] = String(data[k]).trim(); });
    lastMessage = buildMessage(data);

    form.classList.add('is-sending');
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch('/api/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error('send failed');
      done.hidden = false;
    } catch {
      form.querySelector('.form__tg').href = `${contacts.telegram.url}?text=${encodeURIComponent(lastMessage)}`;
      fallback.hidden = false;
    } finally {
      form.classList.remove('is-sending');
    }
  });

  form.querySelector('.form__again').addEventListener('click', () => {
    form.reset();
    calendar.reset();
    done.hidden = true;
  });

  form.querySelector('.form__copy').addEventListener('click', async (e) => {
    try {
      await navigator.clipboard.writeText(lastMessage);
      e.currentTarget.textContent = 'Скопировано ✓';
    } catch {
      e.currentTarget.textContent = 'Не удалось скопировать';
    }
  });
  form.querySelector('.form__tg').addEventListener('click', () => {
    setTimeout(() => { fallback.hidden = true; }, 600);
  });

  return {
    selectPackage(id) {
      const r = form.querySelector(`input[name="package"][value="${id}"]`);
      if (r) r.checked = true;
    },
  };
}
