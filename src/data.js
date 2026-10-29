// Весь контент сайта в одном месте: чтобы добавить фото или поменять цену,
// достаточно отредактировать этот файл.

// Путь к файлам из public/ с учётом базового адреса (на GitHub Pages сайт живёт в /marsel/).
export const asset = (path) => `${import.meta.env.BASE_URL}${path}`;
export const photoUrl = (id, small = false) => asset(`photos/${id}${small ? '-sm' : ''}.webp`);

// Адрес серверной функции, которая пересылает заявки в Telegram (api/booking.js на Vercel).
// VITE_BOOKING_API=off — функции нет (например, GitHub Pages): форма сразу откроет Telegram
// с готовым текстом заявки.
const api = import.meta.env.VITE_BOOKING_API ?? 'api/booking';
export const bookingApi = api === 'off' ? '' : api;

export const contacts = {
  telegram: { handle: '@MARSEL_PH', url: 'https://t.me/MARSEL_PH', note: 'Для записи' },
  channel: { handle: '@MARSEL_PH1', url: 'https://t.me/MARSEL_PH1', note: 'Работы, коллажи' },
  instagram: { handle: 'marsel_phgr', url: 'https://instagram.com/marsel_phgr', note: 'Портфолио' },
};

export const categories = {
  portrait: 'Портрет',
  fashion: 'Fashion',
  editorial: 'Editorial',
  couple: 'Пара',
  concert: 'Концерт',
};

// Файлы лежат в public/photos: <id>.webp (полный размер) и <id>-sm.webp (превью).
// Новые фото конвертируются скриптом scripts/optimize_photos.py.
export const photos = [
  { id: 'blue-veil', title: 'Blue Veil', cat: 'editorial', w: 1333, h: 2000, alt: 'Девушка с синими волосами в чёрной вуали, снятая сквозь кольцо света' },
  { id: 'ice-hood', title: 'Ice Hood', cat: 'fashion', w: 1333, h: 2000, alt: 'Парень в голубой куртке с капюшоном на голубом фоне' },
  { id: 'hiphop-motion', title: 'Hip-Hop Motion', cat: 'fashion', w: 1333, h: 2000, alt: 'Девушка в наушниках и голубой шапке держит кроссовок' },
  { id: 'noir-fur', title: 'Noir', cat: 'fashion', w: 1333, h: 2000, alt: 'Девушка в чёрной шубе в студии на сером фоне' },
  { id: 'saint-sound', title: 'Saint Sound', cat: 'portrait', w: 1333, h: 2000, alt: 'Портрет артиста в голубом капюшоне с кулоном Saint Sound' },
];

// Панорамные коллажи (соотношение ~2.4:1). Секция «Коллажи» появляется,
// как только здесь есть хотя бы один элемент.
export const collages = [
  { id: 'collage-hiphop-motion', title: 'Hip-Hop Motion', w: 2000, h: 833, alt: 'Коллаж Hip-Hop Motion: девушка в наушниках, джинсах и голубой шапке в движении, скейтборд' },
  { id: 'collage-saint-buzzy', title: 'Saint Buzzy 40', w: 2000, h: 833, alt: 'Коллаж Saint Buzzy 40: артист в маске и голубой куртке на оранжевом фоне' },
  { id: 'collage-ulyana', title: 'Ulyana', w: 2000, h: 833, alt: 'Коллаж Ulyana: девушка в белой рубашке и галстуке, леопардовый фон' },
  { id: 'collage-glamour', title: 'Glamour', w: 2000, h: 833, alt: 'Коллаж Glamour: девушка в чёрном жакете и лаковых сапогах с журналом' },
];

export const packages = [
  {
    id: 'silver',
    name: 'Silver Chariot',
    price: 6000,
    duration: '40 минут съёмки',
    photo: 'ice-hood',
    features: ['7 фото в фирменной обработке', '10 фото в цветокоррекции', 'Консультация за 2–3 дня'],
    prepay: 1000,
    terms: 'Готовность: до 3 дней · Перенос не позднее чем за 2 дня',
  },
  {
    id: 'gold',
    name: 'Gold Experience',
    price: 10000,
    duration: 'До 1,5 часа съёмки',
    popular: true,
    photo: 'noir-fur',
    features: [
      '12 фото в фирменной обработке',
      '15 фото в цветокоррекции',
      'До 2 образов',
      'Бэкстейдж-контент',
      'Коллаж из лучших кадров',
      'Подбор локации',
      'Подсказки по позированию',
      'Консультация за 2–3 дня',
    ],
    prepay: 1500,
    terms: 'Готовность: 7–10 дней',
  },
];

export const formatPrice = (n) => n.toLocaleString('ru-RU').replace(/ /g, ' ') + ' ₽';
