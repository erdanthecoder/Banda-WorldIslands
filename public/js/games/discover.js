// Discovery Lab (floor 3): geography, science, spelling by ear, logic sequences.
import { runRound, levelPicker, shuffle, WORDS } from './learn.js';

const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[rnd(0, a.length - 1)];
const L = (ctx, en, ru) => ctx.lang === 'ru' ? ru : en;

// [country en, country ru, capital en, capital ru, flag, continent en, continent ru, level]
const COUNTRIES = [
  ['Kyrgyzstan', 'Кыргызстан', 'Bishkek', 'Бишкек', '🇰🇬', 'Asia', 'Азия', 1], ['Russia', 'Россия', 'Moscow', 'Москва', '🇷🇺', 'Europe', 'Европа', 1],
  ['France', 'Франция', 'Paris', 'Париж', '🇫🇷', 'Europe', 'Европа', 1], ['Japan', 'Япония', 'Tokyo', 'Токио', '🇯🇵', 'Asia', 'Азия', 1],
  ['USA', 'США', 'Washington', 'Вашингтон', '🇺🇸', 'North America', 'Северная Америка', 1], ['United Kingdom', 'Великобритания', 'London', 'Лондон', '🇬🇧', 'Europe', 'Европа', 1],
  ['China', 'Китай', 'Beijing', 'Пекин', '🇨🇳', 'Asia', 'Азия', 1], ['Italy', 'Италия', 'Rome', 'Рим', '🇮🇹', 'Europe', 'Европа', 1],
  ['Germany', 'Германия', 'Berlin', 'Берлин', '🇩🇪', 'Europe', 'Европа', 2], ['Kazakhstan', 'Казахстан', 'Astana', 'Астана', '🇰🇿', 'Asia', 'Азия', 2],
  ['Egypt', 'Египет', 'Cairo', 'Каир', '🇪🇬', 'Africa', 'Африка', 2], ['Brazil', 'Бразилия', 'Brasília', 'Бразилиа', '🇧🇷', 'South America', 'Южная Америка', 2],
  ['Spain', 'Испания', 'Madrid', 'Мадрид', '🇪🇸', 'Europe', 'Европа', 2], ['Turkey', 'Турция', 'Ankara', 'Анкара', '🇹🇷', 'Asia', 'Азия', 3],
  ['Uzbekistan', 'Узбекистан', 'Tashkent', 'Ташкент', '🇺🇿', 'Asia', 'Азия', 2], ['India', 'Индия', 'New Delhi', 'Нью-Дели', '🇮🇳', 'Asia', 'Азия', 2],
  ['Canada', 'Канада', 'Ottawa', 'Оттава', '🇨🇦', 'North America', 'Северная Америка', 3], ['Australia', 'Австралия', 'Canberra', 'Канберра', '🇦🇺', 'Oceania', 'Океания', 3],
  ['Kenya', 'Кения', 'Nairobi', 'Найроби', '🇰🇪', 'Africa', 'Африка', 3], ['Argentina', 'Аргентина', 'Buenos Aires', 'Буэнос-Айрес', '🇦🇷', 'South America', 'Южная Америка', 3],
  ['South Korea', 'Южная Корея', 'Seoul', 'Сеул', '🇰🇷', 'Asia', 'Азия', 2], ['Mexico', 'Мексика', 'Mexico City', 'Мехико', '🇲🇽', 'North America', 'Северная Америка', 3],
  ['Norway', 'Норвегия', 'Oslo', 'Осло', '🇳🇴', 'Europe', 'Европа', 4], ['Nigeria', 'Нигерия', 'Abuja', 'Абуджа', '🇳🇬', 'Africa', 'Африка', 4],
  ['Tajikistan', 'Таджикистан', 'Dushanbe', 'Душанбе', '🇹🇯', 'Asia', 'Азия', 3], ['Mongolia', 'Монголия', 'Ulaanbaatar', 'Улан-Батор', '🇲🇳', 'Asia', 'Азия', 4],
  ['Peru', 'Перу', 'Lima', 'Лима', '🇵🇪', 'South America', 'Южная Америка', 4], ['Finland', 'Финляндия', 'Helsinki', 'Хельсинки', '🇫🇮', 'Europe', 'Европа', 4],
];
const GEO_FACTS = [
  [['The largest ocean?', 'Самый большой океан?'], ['Pacific', 'Тихий'], [['Atlantic', 'Атлантический'], ['Indian', 'Индийский'], ['Arctic', 'Северный Ледовитый']], 1],
  [['The longest river in the world?', 'Самая длинная река в мире?'], ['Nile', 'Нил'], [['Volga', 'Волга'], ['Amazon', 'Амазонка'], ['Danube', 'Дунай']], 2],
  [['The highest mountain on Earth?', 'Самая высокая гора на Земле?'], ['Everest', 'Эверест'], [['Elbrus', 'Эльбрус'], ['Kilimanjaro', 'Килиманджаро'], ['Lenin Peak', 'Пик Ленина']], 1],
  [['The big lake in Kyrgyzstan?', 'Большое озеро в Кыргызстане?'], ['Issyk-Kul', 'Иссык-Куль'], [['Baikal', 'Байкал'], ['Balkhash', 'Балхаш'], ['Ladoga', 'Ладога']], 1],
  [['The biggest country by area?', 'Самая большая страна по площади?'], ['Russia', 'Россия'], [['Canada', 'Канада'], ['China', 'Китай'], ['USA', 'США']], 1],
  [['The largest desert (hot)?', 'Самая большая жаркая пустыня?'], ['Sahara', 'Сахара'], [['Gobi', 'Гоби'], ['Kalahari', 'Калахари'], ['Atacama', 'Атакама']], 2],
  [['How many continents are there?', 'Сколько континентов на Земле?'], ['7', '7'], [['5', '5'], ['6', '6'], ['8', '8']], 1],
  [['The deepest lake in the world?', 'Самое глубокое озеро в мире?'], ['Baikal', 'Байкал'], [['Issyk-Kul', 'Иссык-Куль'], ['Victoria', 'Виктория'], ['Superior', 'Верхнее']], 3],
  [['Mountains in Kyrgyzstan?', 'Горы в Кыргызстане?'], ['Tian Shan', 'Тянь-Шань'], [['Alps', 'Альпы'], ['Andes', 'Анды'], ['Urals', 'Урал']], 2],
  [['The smallest continent?', 'Самый маленький континент?'], ['Australia', 'Австралия'], [['Europe', 'Европа'], ['Antarctica', 'Антарктида'], ['Africa', 'Африка']], 3],
];
const SCIENCE = [
  [['Which planet is the Red Planet?', 'Какую планету называют Красной?'], ['Mars', 'Марс'], [['Venus', 'Венера'], ['Jupiter', 'Юпитер'], ['Saturn', 'Сатурн']], 1, '🔴'],
  [['What do plants need to make food?', 'Что нужно растениям, чтобы делать пищу?'], ['Sunlight', 'Солнечный свет'], [['Sand', 'Песок'], ['Darkness', 'Темнота'], ['Salt', 'Соль']], 1, '🌱'],
  [['Water freezes at…', 'Вода замерзает при…'], ['0 °C', '0 °C'], [['10 °C', '10 °C'], ['100 °C', '100 °C'], ['−50 °C', '−50 °C']], 1, '🧊'],
  [['Water boils at…', 'Вода кипит при…'], ['100 °C', '100 °C'], [['50 °C', '50 °C'], ['0 °C', '0 °C'], ['200 °C', '200 °C']], 1, '♨️'],
  [['The biggest planet?', 'Самая большая планета?'], ['Jupiter', 'Юпитер'], [['Earth', 'Земля'], ['Mars', 'Марс'], ['Neptune', 'Нептун']], 1, '🪐'],
  [['How many legs does a spider have?', 'Сколько ног у паука?'], ['8', '8'], [['6', '6'], ['10', '10'], ['4', '4']], 1, '🕷️'],
  [['What gas do we breathe in to live?', 'Какой газ нам нужен, чтобы дышать?'], ['Oxygen', 'Кислород'], [['Helium', 'Гелий'], ['Carbon dioxide', 'Углекислый газ'], ['Hydrogen', 'Водород']], 2, '🫁'],
  [['Which is a mammal?', 'Кто из них млекопитающее?'], ['Whale', 'Кит'], [['Shark', 'Акула'], ['Frog', 'Лягушка'], ['Eagle', 'Орёл']], 2, '🐋'],
  [['The closest star to Earth?', 'Ближайшая к Земле звезда?'], ['The Sun', 'Солнце'], [['Sirius', 'Сириус'], ['Polaris', 'Полярная'], ['The Moon', 'Луна']], 2, '☀️'],
  [['What pulls things down to the ground?', 'Что тянет предметы к земле?'], ['Gravity', 'Гравитация'], [['Magnetism', 'Магнетизм'], ['Wind', 'Ветер'], ['Light', 'Свет']], 2, '🍎'],
  [['How many bones does an adult have?', 'Сколько костей у взрослого человека?'], ['206', '206'], [['106', '106'], ['300', '300'], ['156', '156']], 3, '🦴'],
  [['H₂O is…', 'H₂O — это…'], ['Water', 'Вода'], [['Salt', 'Соль'], ['Air', 'Воздух'], ['Gold', 'Золото']], 2, '💧'],
  [['A caterpillar turns into a…', 'Гусеница превращается в…'], ['Butterfly', 'Бабочку'], [['Bee', 'Пчелу'], ['Spider', 'Паука'], ['Snail', 'Улитку']], 1, '🐛'],
  [['Which organ pumps blood?', 'Какой орган качает кровь?'], ['Heart', 'Сердце'], [['Lungs', 'Лёгкие'], ['Brain', 'Мозг'], ['Stomach', 'Желудок']], 1, '❤️'],
  [['Light travels faster than…', 'Свет быстрее, чем…'], ['Sound', 'Звук'], [['Nothing', 'Ничто'], ['Itself', 'Сам свет'], ['Time', 'Время']], 3, '⚡'],
  [['What does a thermometer measure?', 'Что измеряет термометр?'], ['Temperature', 'Температуру'], [['Weight', 'Вес'], ['Speed', 'Скорость'], ['Time', 'Время']], 1, '🌡️'],
  [['Which planet has the big rings?', 'У какой планеты большие кольца?'], ['Saturn', 'Сатурн'], [['Mars', 'Марс'], ['Mercury', 'Меркурий'], ['Venus', 'Венера']], 1, '🪐'],
  [['Ice, water and steam are… of water', 'Лёд, вода и пар — это… воды'], ['States', 'Состояния'], [['Colours', 'Цвета'], ['Sizes', 'Размеры'], ['Smells', 'Запахи']], 3, '🧪'],
  [['Which animal lays eggs?', 'Какое животное откладывает яйца?'], ['Chicken', 'Курица'], [['Cow', 'Корова'], ['Dog', 'Собака'], ['Horse', 'Лошадь']], 1, '🥚'],
  [['Plants breathe out…', 'Растения выделяют…'], ['Oxygen', 'Кислород'], [['Smoke', 'Дым'], ['Helium', 'Гелий'], ['Nitrogen', 'Азот']], 3, '🌳'],
];

const fromBank = (ctx, bank, level) => {
  const pool = bank.filter(q => q[3] <= level + 1), q = pick(pool.length ? pool : bank), i = ctx.lang === 'ru' ? 1 : 0;
  return { html: `${q[4] ? `<div class="emoji">${q[4]}</div>` : ''}<div class="sentence">${q[0][i]}</div>`, options: shuffle([q[1][i], ...q[2].map(o => o[i])]), answer: q[1][i] };
};
function geoQ(ctx, level) {
  const kind = rnd(0, 3);
  if (kind === 3) return fromBank(ctx, GEO_FACTS, level);
  const i = ctx.lang === 'ru' ? 1 : 0, pool = COUNTRIES.filter(c => c[7] <= level), c = pick(pool.length > 4 ? pool : COUNTRIES), others = shuffle(COUNTRIES.filter(x => x !== c));
  if (kind === 0) return { html: `<div class="emoji">${c[4]}</div><div class="sentence">${L(ctx, 'Capital of', 'Столица')} ${c[i]}?</div>`, options: shuffle([c[2 + i], ...others.slice(0, 3).map(x => x[2 + i])]), answer: c[2 + i] };
  if (kind === 1) return { html: `<div class="emoji big">${c[4]}</div><div class="sentence">${L(ctx, 'Whose flag is this?', 'Чей это флаг?')}</div>`, options: shuffle([c[i], ...others.slice(0, 3).map(x => x[i])]), answer: c[i] };
  const conts = [...new Set(COUNTRIES.map(x => x[5 + i]))], wrong = shuffle(conts.filter(x => x !== c[5 + i])).slice(0, 3);
  return { html: `<div class="emoji">${c[4]}</div><div class="sentence">${L(ctx, 'Which continent is', 'На каком континенте')} ${c[i]}?</div>`, options: shuffle([c[5 + i], ...wrong]), answer: c[5 + i] };
}

// Hear a word, pick the right spelling.
function misspell(w, ru) {
  const v = ru ? 'аеиоуыэяю' : 'aeiouy', s = new Set();
  let guard = 0;
  while (s.size < 3 && guard++ < 50) {
    const a = [...w], k = rnd(0, a.length - 1), m = rnd(0, 3);
    if (m === 0 && a.length > 3) a.splice(k, 1);
    else if (m === 1) a.splice(k, 0, a[k]);
    else if (m === 2 && v.includes(a[k])) a[k] = pick([...v].filter(x => x !== a[k]));
    else if (k < a.length - 1) [a[k], a[k + 1]] = [a[k + 1], a[k]];
    const r = a.join(''); if (r !== w) s.add(r);
  }
  return [...s];
}
function spellQ(ctx, level) {
  const ru = ctx.lang === 'ru', pool = WORDS.slice(0, [15, 25, 35, 45][level - 1]), w = pick(pool), word = w[ru ? 1 : 0];
  setTimeout(() => ctx.say(word, ru ? 'ru' : 'en'), 250);
  return { html: `<div class="emoji">🔊</div><button class="btn" onclick="this.dispatchEvent(new CustomEvent('say',{bubbles:true}))">${L(ctx, 'Listen again', 'Послушать ещё')}</button><div class="sentence">${L(ctx, 'Which spelling is right?', 'Как пишется правильно?')}</div>`, options: shuffle([word, ...misspell(word, ru)]), answer: word, speakWord: word };
}

function logicQ(ctx, level) {
  const kind = rnd(0, level > 1 ? 2 : 1);
  if (kind === 2) { // odd one out
    const groups = [
      [['🍎', '🍌', '🍇', '🍐'], ['🚗', '🚕', '🚙']], [['🐶', '🐱', '🐭', '🐰'], ['🌳', '🌲', '🌴']], [['⚽', '🏀', '🏈', '🎾'], ['🍕', '🍔', '🌭']],
      [['2', '4', '6', '8', '10', '12'], ['7', '9', '11', '13']], [['3', '6', '9', '12', '15'], ['10', '14', '16', '20']], [['☀️', '⭐', '🌟'], ['🌧️', '❄️', '⛈️']],
    ];
    const [a, b] = pick(groups), odd = pick(b), set = shuffle(a).slice(0, 3);
    return { html: `<div class="sentence">${L(ctx, 'Which one does not belong?', 'Что здесь лишнее?')}</div>`, options: shuffle([...set, odd]), answer: odd };
  }
  if (kind === 1) { // shape pattern
    const sh = shuffle(['🔴', '🔵', '🟢', '🟡', '🟣', '🔺', '⬛']), n = rnd(2, 3), pat = sh.slice(0, n), len = n * 2 + rnd(0, n - 1), seq = Array.from({ length: len }, (_, i) => pat[i % n]);
    const ans = pat[len % n];
    return { html: `<div class="emoji seq">${seq.join(' ')} ❓</div><div class="sentence">${L(ctx, 'What comes next?', 'Что дальше?')}</div>`, options: shuffle([...new Set([ans, ...sh.slice(0, 4)])]).slice(0, 4).concat([]).filter((x, i, a) => a.indexOf(x) === i), answer: ans, fix: true };
  }
  // number sequences
  const a = rnd(1, 10), d = rnd(2, 3 + level * 2), forms = [
    [i => a + d * i, 1], [i => a * 10 - d * i + 40, 1], [i => a * Math.pow(2, i), 2], [i => (i + 1) * (i + 1), 3], [i => a + d * i * (i + 1) / 2, 3], [i => i < 2 ? 1 : null, 4],
  ].filter(f => f[1] <= level);
  const [f] = pick(forms); let seq;
  if (f(0) === 1 && f(5) === null) { seq = [1, 1]; while (seq.length < 7) seq.push(seq[seq.length - 1] + seq[seq.length - 2]); }
  else seq = Array.from({ length: 6 }, (_, i) => f(i));
  const ans = seq[5], s = new Set([ans]); while (s.size < 4) s.add(ans + rnd(-6, 6) || ans + 7);
  return { html: `<div class="emoji seq">${seq.slice(0, 5).join(', ')}, ❓</div><div class="sentence">${L(ctx, 'Find the next number', 'Найди следующее число')}</div>`, options: shuffle([...s]), answer: ans };
}
function fixOpts(q) { if (!q.options.includes(q.answer)) q.options[0] = q.answer; while (q.options.length < 4) q.options.push('⬜'); q.options = shuffle(q.options); return q; }

function quiz(ctx, title, make) {
  const { el, t } = ctx; let stop = () => {}, level = 1, cur = null;
  const onSay = () => cur && cur.speakWord && ctx.say(cur.speakWord, ctx.lang === 'ru' ? 'ru' : 'en');
  el.addEventListener('say', onSay);
  el.innerHTML = `<h3>${t('chooseLevel')}</h3>`;
  levelPicker(el, t, level, l => { ctx.restart = l2 => { level = l2; stop(); stop = runRound(ctx, title, level, () => (cur = fixOpts(make(ctx, level)))); }; ctx.restart(l); });
  return () => { stop(); el.removeEventListener('say', onSay); };
}
export const geoQuiz = ctx => quiz(ctx, ctx.t('g_geo'), geoQ);
export const scienceQuiz = ctx => quiz(ctx, ctx.t('g_science'), (c, l) => fromBank(c, SCIENCE, l));
export const spellingBee = ctx => quiz(ctx, ctx.t('g_spelling'), spellQ);
export const logicQuiz = ctx => quiz(ctx, ctx.t('g_logic'), logicQ);
