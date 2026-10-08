// Learning games — these give stars ⭐
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const h = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export const WORDS = [
  ['cat', 'кошка', '🐱'], ['dog', 'собака', '🐶'], ['apple', 'яблоко', '🍎'], ['house', 'дом', '🏠'], ['sun', 'солнце', '☀️'],
  ['book', 'книга', '📕'], ['car', 'машина', '🚗'], ['tree', 'дерево', '🌳'], ['fish', 'рыба', '🐟'], ['ball', 'мяч', '⚽'],
  ['water', 'вода', '💧'], ['bird', 'птица', '🐦'], ['milk', 'молоко', '🥛'], ['star', 'звезда', '⭐'], ['moon', 'луна', '🌙'],
  ['flower', 'цветок', '🌸'], ['school', 'школа', '🏫'], ['teacher', 'учитель', '👩‍🏫'], ['bread', 'хлеб', '🍞'], ['horse', 'лошадь', '🐴'],
  ['rain', 'дождь', '🌧️'], ['snow', 'снег', '❄️'], ['heart', 'сердце', '❤️'], ['hand', 'рука', '✋'], ['eye', 'глаз', '👁️'],
  ['bear', 'медведь', '🐻'], ['mouse', 'мышь', '🐭'], ['banana', 'банан', '🍌'], ['train', 'поезд', '🚆'], ['island', 'остров', '🏝️'],
  ['friend', 'друг', '🤝'], ['red', 'красный', '🟥'], ['green', 'зелёный', '🟩'], ['blue', 'синий', '🟦'], ['one', 'один', '1️⃣'],
  ['two', 'два', '2️⃣'], ['three', 'три', '3️⃣'], ['happy', 'весёлый', '😀'], ['big', 'большой', '🐘'], ['music', 'музыка', '🎵'],
];

function mathQ(op, level) {
  const L = Math.min(level, 6);
  if (op === 'mix') op = ['add', 'sub', 'mul', 'div', 'sq'][rnd(0, 4)];
  let a, b, ans, text;
  if (op === 'add') { a = rnd(1, 10 * L); b = rnd(1, 10 * L); ans = a + b; text = `${a} + ${b}`; }
  else if (op === 'sub') { a = rnd(2, 10 * L); b = rnd(1, a); ans = a - b; text = `${a} − ${b}`; }
  else if (op === 'mul') { a = rnd(2, 4 + L); b = rnd(2, 10); ans = a * b; text = `${a} × ${b}`; }
  else if (op === 'div') { b = rnd(2, 4 + L); ans = rnd(2, 10); a = b * ans; text = `${a} ÷ ${b}`; }
  else { a = rnd(2, 6 + L); ans = a * a; text = `${a}²`; }
  return { text, ans };
}
function numOptions(ans) {
  const s = new Set([ans]);
  while (s.size < 4) { const d = rnd(1, Math.max(3, Math.round(Math.abs(ans) * 0.2))) * (Math.random() < 0.5 ? -1 : 1); if (ans + d >= 0) s.add(ans + d); }
  return shuffle([...s]);
}

// Generic multiple-choice round
function runRound(ctx, title, makeQ, rounds = 10, secs = 15) {
  const { el, t } = ctx;
  let i = 0, score = 0, timer, left;
  const next = () => {
    clearInterval(timer);
    if (i >= rounds) return finish();
    const q = makeQ(i);
    el.innerHTML = '';
    const top = h('div', 'q-top', `<span>${title}</span><span>${i + 1}/${rounds}</span><span>⭐ ${score}</span>`);
    const bar = h('div', 'q-bar', '<i></i>');
    const qe = h('div', 'q-text', q.html);
    const grid = h('div', 'q-grid');
    q.options.forEach(o => {
      const b = h('button', 'q-opt', String(o));
      b.onclick = () => {
        clearInterval(timer);
        grid.querySelectorAll('button').forEach(x => { x.disabled = true; if (String(x.textContent) === String(q.answer)) x.classList.add('ok'); });
        if (String(o) === String(q.answer)) { score++; ctx.sfx('correct'); ctx.award(1); } else { b.classList.add('bad'); ctx.sfx('wrong'); }
        q.after && q.after();
        i++; setTimeout(next, 1100);
      };
      grid.appendChild(b);
    });
    el.append(top, bar, qe, grid);
    left = secs; const fill = bar.firstChild;
    timer = setInterval(() => {
      left -= 0.1; fill.style.width = (left / secs * 100) + '%';
      if (left <= 0) { clearInterval(timer); ctx.sfx('wrong'); grid.querySelectorAll('button').forEach(x => { x.disabled = true; if (String(x.textContent) === String(q.answer)) x.classList.add('ok'); }); i++; setTimeout(next, 1100); }
    }, 100);
  };
  const finish = () => {
    const bonus = score === rounds ? 3 : 0;
    if (bonus) ctx.award(bonus);
    ctx.sfx(score >= rounds * 0.7 ? 'cheer' : 'chime');
    el.innerHTML = `<div class="q-end"><div class="big">${score === rounds ? '🏆' : score >= rounds / 2 ? '🎉' : '💪'}</div>
      <h2>${t('result')}: ${score}/${rounds}</h2><p>⭐ +${score + bonus}${bonus ? ' (' + t('perfect') + ')' : ''}</p></div>`;
    const again = h('button', 'btn big-btn', t('playAgain')); again.onclick = () => { i = 0; score = 0; next(); };
    el.firstChild.appendChild(again);
  };
  next();
  return () => clearInterval(timer);
}

export function mathQuiz(ctx) {
  const { el, t } = ctx;
  const ops = [['add', '➕', t('add')], ['sub', '➖', t('sub')], ['mul', '✖️', t('mul')], ['div', '➗', t('div')], ['sq', 'x²', t('squares')], ['mix', '🎲', t('mixed')]];
  let stop = () => {};
  const menu = () => {
    el.innerHTML = `<h2 class="center">${t('chooseOp')}</h2>`;
    const g = h('div', 'menu-grid');
    ops.forEach(([op, ic, name]) => {
      const b = h('button', 'tile', `<b>${ic}</b><span>${name}</span>`);
      b.onclick = () => { let level = 1; stop = runRound(ctx, name, i => { level = 1 + Math.floor(i / 3); const q = mathQ(op, level); return { html: `${q.text} = ?`, options: numOptions(q.ans), answer: q.ans }; }); };
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
  const newQ = () => { q = mathQ(['add', 'sub', 'mul', 'div'][rnd(0, 3)], 1 + Math.floor(score / 5)); qe.textContent = q.text + ' = ?'; input = ''; inp.textContent = '_'; };
  const press = k => {
    if (left <= 0) return;
    if (k === '⌫') input = input.slice(0, -1);
    else if (k === '✔') { if (+input === q.ans) { score++; ctx.sfx('correct'); if (score % 3 === 0) ctx.award(1); newQ(); } else { ctx.sfx('wrong'); inp.classList.add('shake'); setTimeout(() => inp.classList.remove('shake'), 300); input = ''; } }
    else if (input.length < 4) input += k;
    inp.textContent = input || '_';
    if (k !== '✔' && input && +input === q.ans) press('✔');
  };
  ['7', '8', '9', '4', '5', '6', '1', '2', '3', '⌫', '0', '✔'].forEach(k => { const b = h('button', 'key', k); b.onclick = () => press(k); pad.appendChild(b); });
  const onKey = e => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('⌫'); else if (e.key === 'Enter') press('✔'); };
  addEventListener('keydown', onKey);
  const draw = () => { top.innerHTML = `<span>⚡ ${t('speedMath')}</span><span>⏱ ${Math.ceil(left)}</span><span>✅ ${score}</span>`; };
  newQ(); draw();
  timer = setInterval(() => {
    left -= 1; draw();
    if (left <= 0) { clearInterval(timer); ctx.sfx('cheer'); qe.innerHTML = `${t('timeUp')}! ✅ ${score} → ⭐ +${Math.floor(score / 3)}`; inp.textContent = ''; }
  }, 1000);
  return () => { clearInterval(timer); removeEventListener('keydown', onKey); };
}

// English or Russian quiz. target = 'en' | 'ru'
export function langQuiz(ctx, target) {
  const { t } = ctx;
  const ti = target === 'en' ? 0 : 1, oi = 1 - ti;
  const pool = shuffle([...WORDS]);
  return runRound(ctx, target === 'en' ? t('englishQuiz') : t('russianQuiz'), i => {
    const w = pool[i % pool.length];
    const kind = i % 3;
    const opts = shuffle([w, ...shuffle(WORDS.filter(x => x !== w)).slice(0, 3)]);
    if (kind === 2) { // spelling: missing letter
      const word = w[ti], pos = rnd(0, word.length - 1), letter = word[pos];
      const alpha = target === 'en' ? 'abcdefghijklmnopqrstuvwxyz' : 'абвгдеёжзийклмнопрстуфхцчшщыэюя';
      const ls = new Set([letter]); while (ls.size < 4) ls.add(alpha[rnd(0, alpha.length - 1)]);
      return { html: `<div class="emoji">${w[2]}</div>${word.slice(0, pos)}<u>_</u>${word.slice(pos + 1)}<small>${t('missingLetter')}</small>`, options: shuffle([...ls]), answer: letter, after: () => ctx.say(word, target) };
    }
    const prompt = kind === 0 ? `<div class="emoji">${w[2]}</div><small>${t('whatIsThis')}</small>` : `<div class="word">${w[oi]}</div><small>${t('translate')}</small>`;
    return { html: prompt, options: opts.map(x => x[ti]), answer: w[ti], after: () => ctx.say(w[ti], target) };
  });
}

export function wordMatch(ctx) {
  const { el, t } = ctx;
  const pick = shuffle([...WORDS]).slice(0, 6);
  const cards = shuffle(pick.flatMap((w, i) => [{ k: i, txt: w[2] + ' ' + w[0], lang: 'en' }, { k: i, txt: w[1], lang: 'ru' }]));
  let open = [], found = 0, moves = 0;
  el.innerHTML = `<div class="q-top"><span>🧠 ${t('wordMatch')}</span><span id="wm-moves"></span></div>`;
  const grid = h('div', 'mem-grid'); el.appendChild(grid);
  cards.forEach(c => {
    const b = h('button', 'mem', '<span>?</span>'); c.b = b;
    b.onclick = () => {
      if (open.length === 2 || b.classList.contains('open')) return;
      b.classList.add('open'); b.innerHTML = `<span>${c.txt}</span>`; ctx.sfx('click'); ctx.say(c.txt.replace(/^\S+ /, ''), c.lang); open.push(c);
      if (open.length === 2) {
        moves++; el.querySelector('#wm-moves').textContent = `${t('moves')}: ${moves}`;
        const [a, d] = open;
        if (a.k === d.k) { found++; a.b.classList.add('ok'); d.b.classList.add('ok'); open = []; ctx.sfx('correct'); ctx.award(1);
          if (found === 6) { ctx.sfx('cheer'); ctx.award(3); setTimeout(() => { el.innerHTML = `<div class="q-end"><div class="big">🏆</div><h2>${t('result')}: ${moves} ${t('moves')}</h2><p>⭐ +9</p></div>`; }, 700); } }
        else setTimeout(() => { [a, d].forEach(x => { x.b.classList.remove('open'); x.b.innerHTML = '<span>?</span>'; }); open = []; }, 900);
      }
    };
    grid.appendChild(b);
  });
  return () => {};
}

export function timesTable(ctx) {
  const { el, t } = ctx;
  el.innerHTML = `<h2 class="center">${t('pickTable')}</h2>`;
  const g = h('div', 'menu-grid'); let stop = () => {};
  for (let n = 2; n <= 10; n++) {
    const b = h('button', 'tile', `<b>×${n}</b>`);
    b.onclick = () => { const order = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]); stop = runRound(ctx, `${t('timesTable')} ×${n}`, i => ({ html: `${n} × ${order[i]} = ?`, options: numOptions(n * order[i]), answer: n * order[i] }), 10, 12); };
    g.appendChild(b);
  }
  el.appendChild(g);
  return () => stop();
}
