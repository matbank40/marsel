// Vercel Serverless Function: принимает заявку с сайта и пересылает её в Telegram.
// Нужны переменные окружения в настройках проекта Vercel:
//   TELEGRAM_BOT_TOKEN — токен бота от @BotFather
//   TELEGRAM_CHAT_ID   — ваш chat id (узнать можно у @userinfobot)

const PACKAGES = {
  silver: 'Silver Chariot — 6 000 ₽',
  gold: 'Gold Experience — 10 000 ₽',
};

const clean = (v, max) => String(v ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false });
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return res.status(503).json({ ok: false, error: 'not_configured' });

  let body = req.body || {};
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  // ловушка для ботов: настоящий человек это поле не видит
  if (body.website) return res.status(200).json({ ok: true });

  const name = clean(body.name, 80);
  const contact = clean(body.contact, 80);
  if (name.length < 2 || contact.length < 4) return res.status(400).json({ ok: false, error: 'invalid' });

  const comment = String(body.comment ?? '').trim().slice(0, 1000);
  const lines = [
    '📸 <b>Новая заявка на съёмку</b>',
    '',
    `<b>Имя:</b> ${esc(name)}`,
    `<b>Контакт:</b> ${esc(contact)}`,
    `<b>Пакет:</b> ${esc(PACKAGES[body.package] || 'не выбран')}`,
    `<b>Дата:</b> ${esc(clean(body.date, 60) || 'обсудим')}`,
  ];
  if (comment) lines.push(`<b>Комментарий:</b> ${esc(comment)}`);

  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: 'telegram' });
    return res.status(200).json({ ok: true });
  } catch {
    return res.status(502).json({ ok: false, error: 'network' });
  }
}
