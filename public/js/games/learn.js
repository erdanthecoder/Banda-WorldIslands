// Learning games — stars come from here. Harder levels pay more.
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[rnd(0, a.length - 1)];
export const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };
export const STAR_RATE = [0.5, 1, 1.5, 2]; // stars per correct answer, by level 1–4

export const WORDS = [
  ['cat', 'кошка', '🐱'], ['dog', 'собака', '🐶'], ['apple', 'яблоко', '🍎'], ['house', 'дом', '🏠'], ['sun', 'солнце', '☀️'],
  ['book', 'книга', '📕'], ['car', 'машина', '🚗'], ['tree', 'дерево', '🌳'], ['fish', 'рыба', '🐟'], ['ball', 'мяч', '⚽'],
  ['water', 'вода', '💧'], ['bird', 'птица', '🐦'], ['milk', 'молоко', '🥛'], ['star', 'звезда', '⭐'], ['moon', 'луна', '🌙'],
  ['flower', 'цветок', '🌸'], ['school', 'школа', '🏫'], ['teacher', 'учитель', '👩‍🏫'], ['bread', 'хлеб', '🍞'], ['horse', 'лошадь', '🐴'],
  ['rain', 'дождь', '🌧️'], ['snow', 'снег', '❄️'], ['heart', 'сердце', '❤️'], ['hand', 'рука', '✋'], ['eye', 'глаз', '👁️'],
  ['bear', 'медведь', '🐻'], ['mouse', 'мышь', '🐭'], ['banana', 'банан', '🍌'], ['train', 'поезд', '🚆'], ['island', 'остров', '🏝️'],
  ['friend', 'друг', '🤝'], ['mountain', 'гора', '⛰️'], ['river', 'река', '🏞️'], ['window', 'окно', '🪟'], ['clock', 'часы', '🕒'],
  ['library', 'библиотека', '📚'], ['science', 'наука', '🔬'], ['planet', 'планета', '🪐'], ['weather', 'погода', '🌦️'], ['question', 'вопрос', '❓'],
  ['answer', 'ответ', '💬'], ['knowledge', 'знание', '🧠'], ['journey', 'путешествие', '🧭'], ['history', 'история', '🏛️'], ['experiment', 'эксперимент', '🧪'],
];
const EN_GRAMMAR = [
  ['She ___ to school every day.', 'goes', ['go', 'going', 'gone']], ['They ___ playing football now.', 'are', ['is', 'am', 'be']],
  ['I ___ my homework yesterday.', 'did', ['do', 'done', 'does']], ['He has ___ finished his lunch.', 'already', ['yet', 'still', 'ever']],
  ['This is the ___ book I have ever read.', 'best', ['good', 'better', 'well']], ['We ___ to the museum last week.', 'went', ['go', 'gone', 'goes']],
  ['If it rains, we ___ stay inside.', 'will', ['would', 'are', 'did']], ['There ___ many apples on the table.', 'are', ['is', 'be', 'was']],
  ['She is taller ___ her brother.', 'than', ['then', 'that', 'as']], ['I have lived here ___ 2019.', 'since', ['for', 'from', 'during']],
  ['He can ___ very fast.', 'run', ['runs', 'running', 'ran']], ['Look! The baby ___.', 'is sleeping', ['sleeps', 'sleep', 'slept']],
  ['___ you ever been to London?', 'Have', ['Did', 'Do', 'Are']], ['The cake was eaten ___ the children.', 'by', ['from', 'of', 'with']],
  ['I am interested ___ science.', 'in', ['on', 'at', 'for']], ['She didn’t ___ the answer.', 'know', ['knew', 'knows', 'known']],
  ['These are ___ pencils.', 'our', ['we', 'us', 'ours']], ['How ___ water do you drink?', 'much', ['many', 'few', 'lot']],
  ['When I was young, I ___ in a village.', 'lived', ['live', 'living', 'have lived']], ['The book ___ on the shelf is mine.', 'lying', ['lie', 'lies', 'lay']],
];
const RU_GRAMMAR = [
  ['Я иду в ___ (школа).', 'школу', ['школа', 'школе', 'школой']], ['Мы живём в ___ (город).', 'городе', ['город', 'города', 'городом']],
  ['У меня нет ___ (брат).', 'брата', ['брат', 'брату', 'братом']], ['Я пишу ___ (ручка).', 'ручкой', ['ручка', 'ручку', 'ручке']],
  ['Она дала книгу ___ (подруга).', 'подруге', ['подруга', 'подругу', 'подругой']], ['Вчера я ___ (читать) книгу.', 'читал', ['читаю', 'читать', 'буду читать']],
  ['Завтра мы ___ (пойти) в парк.', 'пойдём', ['пошли', 'идём', 'пойти']], ['Это ___ (мой) мама.', 'моя', ['мой', 'моё', 'мои']],
  ['На столе лежат три ___ (яблоко).', 'яблока', ['яблоко', 'яблок', 'яблоки']], ['Я думаю о ___ (лето).', 'лете', ['лето', 'лета', 'летом']],
  ['Кот сидит под ___ (стол).', 'столом', ['стол', 'стола', 'столе']], ['Мы гордимся ___ (наша школа).', 'нашей школой', ['наша школа', 'нашу школу', 'нашей школе']],
  ['Пять ___ (ученик) пришли.', 'учеников', ['ученик', 'ученика', 'ученики']], ['Он ___ (быть) дома вчера.', 'был', ['есть', 'будет', 'быть']],
  ['Красивое ___ (окно).', 'окно', ['окна', 'окном', 'окне']], ['Я люблю ___ (математика).', 'математику', ['математика', 'математике', 'математикой']],
];

// ---------- question generators ----------
function nums(ans) {
  const s = new Set([ans]);
  while (s.size < 4) { const d = rnd(1, Math.max(3, Math.round(Math.abs(ans) * 0.15))) * (Math.random() < 0.5 ? -1 : 1); s.add(ans + d); }
  return shuffle([...s]);
}
const gcd = (a, b) => b ? gcd(b, a % b) : a;
const frac = (n, d) => { const g = gcd(Math.abs(n), Math.abs(d)); n /= g; d /= g; return d === 1 ? String(n) : `${n}/${d}`; };

export const MATH_TOPICS = ['add', 'sub', 'mul', 'div', 'order', 'fractions', 'percent', 'equations', 'mixed'];
export function mathQ(topic, level) {
  const L = Math.max(1, Math.min(4, level));
  if (topic === 'mixed') topic = pick(L < 3 ? ['add', 'sub', 'mul', 'div'] : MATH_TOPICS.slice(0, 8));
  let text, ans, opts;
  switch (topic) {
    case 'add': { const m = [20, 100, 1000, 10000][L - 1]; const a = rnd(1, m), b = rnd(1, m); text = `${a} + ${b}`; ans = a + b; break; }
    case 'sub': { const m = [20, 100, 1000, 10000][L - 1]; let a = rnd(2, m), b = rnd(1, m); if (L < 3 && b > a) [a, b] = [b, a]; text = `${a} − ${b}`; ans = a - b; break; }
    case 'mul': { const [x, y] = [[2, 5], [2, 10], [6, 25], [12, 99]][L - 1]; const a = rnd(x, y), b = rnd(2, L > 2 ? 19 : 10); text = `${a} × ${b}`; ans = a * b; break; }
    case 'div': { const b = rnd(2, [5, 10, 15, 25][L - 1]); ans = rnd(2, [10, 12, 30, 60][L - 1]); text = `${b * ans} ÷ ${b}`; break; }
    case 'order': {
      const a = rnd(2, 9), b = rnd(2, 9), c = rnd(2, 9), d = rnd(1, 9);
      const forms = [[`${a} + ${b} × ${c}`, a + b * c], [`(${a} + ${b}) × ${c}`, (a + b) * c], [`${a} × ${b} − ${c}`, a * b - c], [`${a * c} ÷ ${c} + ${b} × ${d}`, a + b * d], [`${a}² − ${b} × ${c}`, a * a - b * c]];
      [text, ans] = pick(forms.slice(0, L + 1)); break;
    }
    case 'fractions': {
      const d1 = pick([2, 3, 4, 5, 6, 8, 10]), d2 = L < 3 ? d1 : pick([2, 3, 4, 5, 6, 8]), n1 = rnd(1, d1 - 1), n2 = rnd(1, d2 - 1);
      const op = L < 2 ? '+' : pick(['+', '−', '×']);
      let n, d; if (op === '+') { n = n1 * d2 + n2 * d1; d = d1 * d2; } else if (op === '−') { n = n1 * d2 - n2 * d1; d = d1 * d2; } else { n = n1 * n2; d = d1 * d2; }
      text = `${n1}/${d1} ${op} ${n2}/${d2}`; ans = frac(n, d);
      const s = new Set([ans]); while (s.size < 4) s.add(frac(n + rnd(-3, 3) || 1, d + (Math.random() < 0.5 ? 0 : rnd(-2, 2) || 1)));
      opts = shuffle([...s]); break;
    }
    case 'percent': { const p = pick(L < 3 ? [10, 25, 50] : [5, 10, 15, 20, 25, 30, 40, 75]), base = rnd(1, [10, 20, 40, 80][L - 1]) * (100 / gcd(p, 100)); text = `${p}% × ${base}`; ans = p * base / 100; break; }
    case 'equations': {
      const x = rnd(-5 * (L > 2) + 1, 12 + L * 5), a = rnd(2, 3 + L * 2), b = rnd(1, 20);
      const forms = [[`x + ${b} = ${x + b}`, x], [`${a}x = ${a * x}`, x], [`${a}x + ${b} = ${a * x + b}`, x], [`${a}x − ${b} = ${a * x - b}`, x]];
      [text, ans] = pick(forms.slice(0, L)); text = `${text}  →  x = ?`; break;
    }
  }
  return { html: text.includes('x = ?') ? text : `${text} = ?`, options: opts || nums(ans), answer: ans };
}

export function langQ(target, level, ui) {
  const ti = target === 'en' ? 0 : 1, oi = 1 - ti;
  const L = Math.max(1, Math.min(4, level));
  const kind = L === 1 ? rnd(0, 1) : L === 2 ? rnd(0, 2) : L === 3 ? rnd(1, 3) : rnd(2, 3);
  const pool = L < 3 ? WORDS.slice(0, 30) : WORDS;
  const w = pick(pool);
  if (kind === 3) {
    const [s, a, wrong] = pick(target === 'en' ? EN_GRAMMAR : RU_GRAMMAR);
    return { html: `<div class="sentence">${s.replace('___', '<u>____</u>')}</div><small>${ui('fillGap')}</small>`, options: shuffle([a, ...wrong]), answer: a, speak: s.replace('___', a).replace(/\s*\(.*?\)/, ''), lang: target };
  }
  if (kind === 2) {
    const word = w[ti], pos = rnd(0, word.length - 1), letter = word[pos];
    const alpha = target === 'en' ? 'abcdefghijklmnopqrstuvwxyz' : 'абвгдеёжзийклмнопрстуфхцчшщыэюя';
    const ls = new Set([letter]); while (ls.size < 4) ls.add(pick(alpha));
    return { html: `<div class="emoji">${w[2]}</div><div class="word">${word.slice(0, pos)}<u>_</u>${word.slice(pos + 1)}</div><small>${ui('missingLetter')}</small>`, options: shuffle([...ls]), answer: letter, speak: word, lang: target };
  }
  const opts = shuffle([w, ...shuffle(pool.filter(x => x !== w)).slice(0, 3)]).map(x => x[ti]);
  return kind === 0
    ? { html: `<div class="emoji">${w[2]}</div><small>${ui('whatIsThis')}</small>`, options: opts, answer: w[ti], speak: w[ti], lang: target }
    : { html: `<div class="word">${w[oi]}</div><small>${ui('translate')}</small>`, options: opts, answer: w[ti], speak: w[ti], lang: target };
}

// Any subject, for Quiz Battle and Impostor tasks.
export function makeQuestion(subject, level, ui) {
  if (subject === 'mixed') subject = pick(['math', 'english', 'russian']);
  if (subject === 'math') return mathQ('mixed', level);
  return langQ(subject === 'english' ? 'en' : 'ru', level, ui);
}

// ---------- round runner ----------
function runRound(ctx, title, level, makeQ, rounds = 10, secs = 20) {
  const { el, t } = ctx;
  let i = 0, score = 0, timer;
  const next = () => {
    clearInterval(timer);
    if (i >= rounds) return finish();
    const q = makeQ(i);
    el.innerHTML = '';
    const top = h('div', 'q-top', `<span>${title} · ${t('level')} ${level}</span><span>${i + 1} / ${rounds}</span><span>✓ ${score}</span>`);
    const bar = h('div', 'q-bar', '<i></i>'), qe = h('div', 'q-text', q.html), grid = h('div', 'q-grid');
    const reveal = () => grid.querySelectorAll('button').forEach(x => { x.disabled = true; if (x.textContent === String(q.answer)) x.classList.add('ok'); });
    q.options.forEach(o => {
      const b = h('button', 'q-opt'); b.textContent = String(o);
      b.onclick = () => {
        clearInterval(timer); reveal();
        if (String(o) === String(q.answer)) { score++; ctx.sfx('correct'); } else { b.classList.add('bad'); ctx.sfx('wrong'); }
        if (q.speak) ctx.say(q.speak, q.lang);
        i++; setTimeout(next, 1300);
      };
      grid.appendChild(b);
    });
    el.append(top, bar, qe, grid);
    let left = secs; const fill = bar.firstChild;
    timer = setInterval(() => { left -= 0.1; fill.style.width = (left / secs * 100) + '%'; if (left <= 0) { clearInterval(timer); ctx.sfx('wrong'); reveal(); i++; setTimeout(next, 1300); } }, 100);
  };
  const finish = () => {
    const stars = Math.round(score * STAR_RATE[level - 1]) + (score === rounds ? level : 0);
    if (stars) ctx.award(stars);
    ctx.sfx(score >= rounds * 0.7 ? 'cheer' : 'chime');
    el.innerHTML = `<div class="q-end"><h2>${t('result')}: ${score} / ${rounds}</h2><p>+${stars} ★ ${score === rounds ? '· ' + t('perfect') : ''}</p><p class="muted">${t('starRule')}</p></div>`;
    const row = h('div', 'row');
    const again = h('button', 'btn primary', t('playAgain')); again.onclick = () => { i = 0; score = 0; next(); };
    row.appendChild(again);
    if (level < 4 && score >= rounds * 0.8) { const up = h('button', 'btn', `${t('level')} ${level + 1} →`); up.onclick = () => ctx.restart(level + 1); row.appendChild(up); }
    el.firstChild.appendChild(row);
  };
  next();
  return () => clearInterval(timer);
}

function levelPicker(el, t, current, onPick) {
  const row = h('div', 'levels');
  [1, 2, 3, 4].forEach(l => { const b = h('button', 'chip' + (l === current ? ' on' : ''), `${t('level')} ${l} · ${t('lvl' + l)}`); b.onclick = () => onPick(l); row.appendChild(b); });
  el.appendChild(row);
}

export function mathQuiz(ctx) {
  const { el, t } = ctx; let stop = () => {}, level = ctx.level || 1;
  const menu = () => {
    el.innerHTML = `<h3>${t('chooseLevel')}</h3>`;
    levelPicker(el, t, level, l => { level = l; menu(); });
    el.appendChild(h('h3', '', t('chooseOp')));
    const g = h('div', 'menu-grid');
    MATH_TOPICS.forEach(op => {
      const b = h('button', 'tile', `<span>${t('m_' + op)}</span>`);
      b.onclick = () => { ctx.restart = l => { level = l; stop(); stop = runRound(ctx, t('m_' + op), level, () => mathQ(op, level)); }; ctx.restart(level); };
      g.appendChild(b);
    });
    el.appendChild(g);
  };
  menu();
  return () => stop();
}

export function speedMath(ctx) {
  const { el, t } = ctx;
  let score = 0, left = 60, q, input = '', timer;
  el.innerHTML = '';
  const top = h('div', 'q-top'), qe = h('div', 'q-text'), inp = h('div', 'q-input'), pad = h('div', 'pad');
  el.append(top, qe, inp, pad);
  const newQ = () => { q = mathQ(pick(['add', 'sub', 'mul', 'div']), 1 + Math.min(3, Math.floor(score / 6))); qe.textContent = q.html.replace(' = ?', '') + ' = ?'; input = ''; inp.textContent = '_'; };
  const press = k => {
    if (left <= 0) return;
    if (k === '⌫') input = input.slice(0, -1);
    else if (k === '−') input = input.startsWith('-') ? input.slice(1) : '-' + input;
    else if (k === '✔') { if (+input === q.answer) { score++; ctx.sfx('correct'); newQ(); } else { ctx.sfx('wrong'); inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 300); input = ''; } }
    else if (input.length < 6) input += k;
    inp.textContent = input || '_';
    if (k !== '✔' && input && +input === q.answer) press('✔');
  };
  ['7', '8', '9', '4', '5', '6', '1', '2', '3', '−', '0', '⌫'].forEach(k => { const b = h('button', 'key', k); b.onclick = () => press(k); pad.appendChild(b); });
  const onKey = e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === '-') press('−'); else if (e.key === 'Backspace') press('⌫'); else if (e.key === 'Enter') press('✔'); };
  addEventListener('keydown', onKey);
  const draw = () => { top.innerHTML = `<span>${t('g_speed')}</span><span>${Math.ceil(left)} s</span><span>✓ ${score}</span>`; };
  newQ(); draw();
  timer = setInterval(() => {
    left -= 1; draw();
    if (left <= 0) { clearInterval(timer); const stars = Math.floor(score / 2); if (stars) ctx.award(stars); ctx.sfx('cheer'); qe.innerHTML = `${t('timeUp')} · ✓ ${score} · +${stars} ★`; inp.textContent = ''; }
  }, 1000);
  return () => { clearInterval(timer); removeEventListener('keydown', onKey); };
}

export function langQuiz(ctx, target) {
  const { el, t } = ctx; let stop = () => {}, level = 1;
  const title = target === 'en' ? t('englishQuiz') : t('russianQuiz');
  const menu = () => {
    el.innerHTML = `<h3>${t('chooseLevel')}</h3><p class="muted">${t('langLevels')}</p>`;
    levelPicker(el, t, level, l => { ctx.restart = l2 => { level = l2; stop(); stop = runRound(ctx, title, level, () => langQ(target, level, t)); }; ctx.restart(l); });
  };
  menu();
  return () => stop();
}

export function wordMatch(ctx) {
  const { el, t } = ctx;
  const pickW = shuffle([...WORDS]).slice(0, 8);
  const cards = shuffle(pickW.flatMap((w, i) => [{ k: i, txt: w[0], lang: 'en' }, { k: i, txt: w[1], lang: 'ru' }]));
  let open = [], found = 0, moves = 0, t0 = Date.now();
  el.innerHTML = `<div class="q-top"><span>${t('wordMatch')}</span><span id="wm-moves"></span></div>`;
  const grid = h('div', 'mem-grid'); el.appendChild(grid);
  cards.forEach(c => {
    const b = h('button', 'mem', '<span>?</span>'); c.b = b;
    b.onclick = () => {
      if (open.length === 2 || b.classList.contains('open')) return;
      b.classList.add('open'); b.innerHTML = `<span>${c.txt}</span>`; ctx.sfx('click'); ctx.say(c.txt, c.lang); open.push(c);
      if (open.length === 2) {
        moves++; el.querySelector('#wm-moves').textContent = `${t('moves')}: ${moves}`;
        const [a, d] = open;
        if (a.k === d.k) { found++; a.b.classList.add('ok'); d.b.classList.add('ok'); open = []; ctx.sfx('correct');
          if (found === 8) { const stars = Math.max(2, 10 - Math.max(0, moves - 10)); ctx.award(stars); ctx.sfx('cheer'); setTimeout(() => { el.innerHTML = `<div class="q-end"><h2>${moves} ${t('moves')} · ${Math.round((Date.now() - t0) / 1000)} s</h2><p>+${stars} ★</p></div>`; }, 700); } }
        else setTimeout(() => { [a, d].forEach(x => { x.b.classList.remove('open'); x.b.innerHTML = '<span>?</span>'; }); open = []; }, 900);
      }
    };
    grid.appendChild(b);
  });
  return () => {};
}

export function timesTable(ctx) {
  const { el, t } = ctx;
  el.innerHTML = `<h3>${t('pickTable')}</h3>`;
  const g = h('div', 'menu-grid'); let stop = () => {};
  for (let n = 2; n <= 12; n++) {
    const b = h('button', 'tile', `<b>×${n}</b>`);
    b.onclick = () => { const order = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]); ctx.restart = () => { stop(); stop = runRound(ctx, `${t('timesTable')} ×${n}`, 2, i => ({ html: `${n} × ${order[i]} = ?`, options: nums(n * order[i]), answer: n * order[i] }), 12, 8); }; ctx.restart(); };
    g.appendChild(b);
  }
  el.appendChild(g);
  return () => stop();
}
