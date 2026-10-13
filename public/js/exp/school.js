// 📚 Quiz Day: a normal school day at Marbly School. The bell rings, the teacher gives a short lesson,
// then everyone takes out their iPad (you see it first-person) and plays a Kahoot-style quiz against
// classmates and bots. The fastest right answers score the most. The bottom three do push-ups!
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { experience, L, ui, std, mesh, canvasTexture, confetti, esc, money } from './core.js';
import { Building } from '../buildings.js';
import { TEX, labelSprite } from '../world.js';
import { Avatar, randomAvatar } from '../avatar.js';
import { say } from '../audio.js';

const Q = [ // [question en, question ru, [answers], correct index]
  ['7 × 8 = ?', '7 × 8 = ?', ['54', '56', '64', '48'], 1], ['What is the capital of Kyrgyzstan?', 'Столица Кыргызстана?', ['Osh', 'Almaty', 'Bishkek', 'Tashkent'], 2],
  ['How many legs does a spider have?', 'Сколько ног у паука?', ['6', '8', '10', '4'], 1], ['Which planet is closest to the Sun?', 'Какая планета ближе всех к Солнцу?', ['Venus', 'Mars', 'Mercury', 'Earth'], 2],
  ['What gas do plants take in?', 'Какой газ поглощают растения?', ['Oxygen', 'Carbon dioxide', 'Helium', 'Hydrogen'], 1], ['12 + 15 = ?', '12 + 15 = ?', ['27', '25', '37', '26'], 0],
  ['The opposite of "hot" is…', 'Противоположность «горячий»…', ['warm', 'cold', 'big', 'fast'], 1], ['Water freezes at…', 'Вода замерзает при…', ['0 °C', '10 °C', '100 °C', '-10 °C'], 0],
  ['How many days are in a week?', 'Сколько дней в неделе?', ['5', '6', '7', '8'], 2], ['Which animal is the largest?', 'Какое животное самое большое?', ['Elephant', 'Blue whale', 'Giraffe', 'Shark'], 1],
  ['100 − 37 = ?', '100 − 37 = ?', ['63', '73', '67', '53'], 0], ['Which is a mammal?', 'Кто из них млекопитающее?', ['Frog', 'Eagle', 'Dolphin', 'Salmon'], 2],
  ['How many continents are there?', 'Сколько континентов?', ['5', '6', '7', '8'], 2], ['"Cat" in Russian is…', '«Cat» по-русски…', ['собака', 'кошка', 'птица', 'мышь'], 1],
  ['9 × 9 = ?', '9 × 9 = ?', ['81', '72', '99', '89'], 0], ['What do bees make?', 'Что делают пчёлы?', ['Milk', 'Honey', 'Silk', 'Wax only'], 1],
  ['Which shape has 3 sides?', 'У какой фигуры 3 стороны?', ['Square', 'Circle', 'Triangle', 'Hexagon'], 2], ['The Sun is a…', 'Солнце — это…', ['planet', 'star', 'moon', 'comet'], 1],
  ['What is 1/2 of 50?', 'Половина от 50?', ['20', '25', '30', '15'], 1], ['Which ocean is the biggest?', 'Какой океан самый большой?', ['Atlantic', 'Indian', 'Arctic', 'Pacific'], 3],
  ['How many hours in a day?', 'Сколько часов в сутках?', ['12', '20', '24', '48'], 2], ['The past tense of "go" is…', 'Прошедшее время «go»…', ['goed', 'went', 'gone', 'going'], 1],
  ['6 × 7 = ?', '6 × 7 = ?', ['42', '36', '48', '49'], 0], ['Lake Issyk-Kul is in…', 'Озеро Иссык-Куль находится в…', ['Kazakhstan', 'Kyrgyzstan', 'China', 'Russia'], 1],
  ['Which is NOT a fruit?', 'Что НЕ фрукт?', ['Apple', 'Banana', 'Carrot', 'Mango'], 2], ['What makes a rainbow?', 'Из-за чего появляется радуга?', ['Wind', 'Sunlight and rain', 'Snow', 'Clouds only'], 1],
  ['45 ÷ 5 = ?', '45 ÷ 5 = ?', ['8', '9', '7', '10'], 1],
  ['How many sides does a hexagon have?', 'Сколько сторон у шестиугольника?', ['5', '6', '7', '8'], 1], ['Which gas do we breathe in to live?', 'Каким газом мы дышим, чтобы жить?', ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], 0],
  ['8 × 12 = ?', '8 × 12 = ?', ['86', '96', '108', '92'], 1], ['What is the plural of "mouse"?', 'Множественное число «mouse»?', ['mouses', 'mice', 'meese', 'mouse'], 1],
  ['Which planet is called the Red Planet?', 'Какую планету называют Красной?', ['Jupiter', 'Venus', 'Mars', 'Saturn'], 2], ['What is 25% of 200?', '25% от 200?', ['25', '40', '50', '75'], 2],
  ['Where do penguins mostly live?', 'Где в основном живут пингвины?', ['Arctic', 'Antarctica', 'Africa', 'Europe'], 1], ['How many bones are in an adult human?', 'Сколько костей у взрослого человека?', ['106', '206', '306', '156'], 1],
  ['Which instrument has 88 keys?', 'У какого инструмента 88 клавиш?', ['Guitar', 'Violin', 'Piano', 'Drum'], 2], ['What is H₂O?', 'Что такое H₂O?', ['Salt', 'Water', 'Air', 'Sugar'], 1],
  ['1000 − 1 = ?', '1000 − 1 = ?', ['990', '999', '900', '1001'], 1], ['Which word is a verb?', 'Какое слово — глагол?', ['run', 'blue', 'happy', 'table'], 0],
  ['The fastest land animal is the…', 'Самое быстрое наземное животное…', ['Lion', 'Horse', 'Cheetah', 'Rabbit'], 2], ['How many players are on a football team on the field?', 'Сколько игроков футбольной команды на поле?', ['9', '10', '11', '12'], 2],
  ['What colour do you get mixing blue and yellow?', 'Какой цвет из синего и жёлтого?', ['Purple', 'Green', 'Orange', 'Brown'], 1], ['Which is the longest river in the world?', 'Самая длинная река в мире?', ['Nile', 'Volga', 'Thames', 'Danube'], 0],
  ['15 × 4 = ?', '15 × 4 = ?', ['45', '50', '60', '65'], 2], ['What do caterpillars turn into?', 'В кого превращается гусеница?', ['Bees', 'Butterflies', 'Spiders', 'Beetles'], 1],
  ['Which month has 28 or 29 days?', 'В каком месяце 28 или 29 дней?', ['January', 'February', 'April', 'June'], 1], ['The opposite of "early" is…', 'Противоположность «early»…', ['late', 'fast', 'soon', 'now'], 0], ['Which is the tallest mountain?', 'Самая высокая гора?', ['Everest', 'K2', 'Elbrus', 'Lenin Peak'], 0],
  ['A baby dog is a…', 'Детёныш собаки —…', ['kitten', 'puppy', 'calf', 'cub'], 1], ['How many minutes in an hour?', 'Сколько минут в часе?', ['30', '60', '100', '90'], 1],
];
const SLIDES = [
  ['🌍 Our planet', '🌍 Наша планета', 'Earth goes round the Sun once a year. The Moon goes round the Earth.', 'Земля оборачивается вокруг Солнца за год. Луна — вокруг Земли.'],
  ['🔢 Times tables', '🔢 Таблица умножения', '7 × 8 = 56 · 9 × 9 = 81 · 6 × 7 = 42. Practise them every day!', '7 × 8 = 56 · 9 × 9 = 81 · 6 × 7 = 42. Повторяй каждый день!'],
  ['🌱 Plants', '🌱 Растения', 'Plants take in carbon dioxide and give us oxygen.', 'Растения поглощают углекислый газ и дают нам кислород.'],
  ['🏔️ Kyrgyzstan', '🏔️ Кыргызстан', 'The capital is Bishkek. Issyk-Kul is one of the biggest mountain lakes in the world.', 'Столица — Бишкек. Иссык-Куль — одно из крупнейших горных озёр мира.'],
];
const BOT_NAMES = ['Aibek', 'Dana', 'Timur', 'Amina', 'Nurlan', 'Sofia', 'Erlan', 'Malika', 'Ruslan', 'Aruuke', 'Daniel', 'Kamila', 'Bekzat', 'Zarina', 'Max'];
const COLORS = ['#e21b3c', '#1368ce', '#d89e00', '#26890c'], SHAPES = ['▲', '◆', '●', '■'];
const PH = { arrive: 14, lesson: 24, ipads: 5, q: 15, reveal: 5, board: 5, podium: 8, pushups: 22, break: 10 };
const NQ = 8;
const C = { w: 26, d: 20 }; // the classroom, centred on 0,0; the board is on the north wall
let A;

experience({
  id: 'school', title: 'Quiz Day', titleRu: 'День викторины', icon: '📚', spawn: [9, 7, Math.PI], sun: [40, 140],
  admin: [
    { a: 'skip', icon: '⏭️', en: 'Skip to the next part', ru: 'Дальше' },
    { a: 'double', icon: '✖️2', en: 'Double points', ru: 'Двойные очки' },
    { a: 'allpush', icon: '💪', en: 'Everyone does push-ups', ru: 'Все отжимаются' },
    { a: 'teacherdance', icon: '🕺', en: 'Teacher dances', ru: 'Учитель танцует' },
    { a: 'pizza', icon: '🍕', en: 'Pizza party', ru: 'Пицца-вечеринка' },
    { a: 'snow', icon: '❄️', en: 'Snow in class', ru: 'Снег в классе' },
  ],
  build, frame, onAdmin,
});

function build(app) {
  A = app; const w = app.world, S = w.scene;
  // ---------- outside ----------
  mesh(w, new THREE.CircleGeometry(300, 40).rotateX(-Math.PI / 2), w.texMat(TEX.grass, 300, 300, { color: 0x7fb069 }), 0, -0.05, 0, { cast: false });
  mesh(w, new THREE.BoxGeometry(60, 0.06, 30), w.texMat(TEX.concrete, 60, 30, { color: 0xbfc4cc }), 0, 0, 22, { cast: false });
  const brick = w.texMat(TEX.brick, 30, 8, { color: 0xc8735a });
  // ---------- the classroom ----------
  const B = new Building(w, { x: 0, z: 0, w: C.w, d: C.d, floors: 1, fh: 4.4, base: 0, door: { side: 's', at: 9, width: 2.6 } });
  const { minX, maxX, minZ, maxZ } = B, H = 4.4;
  const wallIn = std(0xf3ead8, { roughness: 0.9 });
  mesh(w, new THREE.BoxGeometry(C.w, H, 0.3), wallIn, 0, H / 2, minZ);
  mesh(w, new THREE.BoxGeometry(0.3, H, C.d), wallIn, maxX, H / 2, 0);
  for (const [a, b] of [[minX, 7.7], [10.3, maxX]]) mesh(w, new THREE.BoxGeometry(b - a, H, 0.3), wallIn, (a + b) / 2, H / 2, maxZ);
  mesh(w, new THREE.BoxGeometry(2.6, 1.2, 0.3), wallIn, 9, H - 0.6, maxZ);
  // the west wall has big windows
  mesh(w, new THREE.BoxGeometry(0.3, 1, C.d), wallIn, minX, 0.5, 0); mesh(w, new THREE.BoxGeometry(0.3, 0.8, C.d), wallIn, minX, H - 0.4, 0);
  const gl = new THREE.Mesh(new THREE.PlaneGeometry(C.d, H - 1.8), new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.25, metalness: 0.5, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false })); gl.position.set(minX, 1 + (H - 1.8) / 2, 0); gl.rotation.y = Math.PI / 2; S.add(gl);
  for (let i = 0; i <= 6; i++) mesh(w, new THREE.BoxGeometry(0.2, H - 1.8, 0.15), std(0xffffff), minX, 1 + (H - 1.8) / 2, minZ + i * C.d / 6);
  // outside skin of brick and a roof
  mesh(w, new THREE.BoxGeometry(C.w + 1, H + 0.6, 0.4), brick, 0, (H + 0.6) / 2, minZ - 0.4);
  mesh(w, new THREE.BoxGeometry(0.4, H + 0.6, C.d + 1), brick, maxX + 0.4, (H + 0.6) / 2, 0);
  mesh(w, new THREE.BoxGeometry(C.w + 2, 0.4, C.d + 2), std(0x5a3a28), 0, H + 0.4, 0);
  mesh(w, new THREE.BoxGeometry(C.w, 0.1, C.d), w.texMat(TEX.wood, C.w, C.d, { color: 0xc49a6c, roughness: 0.55 }), 0, 0.03, 0, { cast: false });
  const sign = labelSprite('🏫 Marbly School', 1, { bg: 'rgba(200,60,40,0.95)', weight: 800 }); sign.position.set(4, H + 1.6, maxZ + 0.6); S.add(sign);
  // ceiling lights
  for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) mesh(w, new THREE.BoxGeometry(3, 0.08, 0.6), std(0xffffff, { emissive: 0xfffbea, emissiveIntensity: 1.6 }), -6 + i * 6, H - 0.1, -3 + k * 7, { cast: false });
  // the smart board
  app.bd = canvasTexture(1024, 576, () => {}); app.bdG = app.bd.image.getContext('2d');
  const board = new THREE.Mesh(new THREE.PlaneGeometry(9, 5.06), new THREE.MeshBasicMaterial({ map: app.bd })); board.position.set(0, 2.4, minZ + 0.2); S.add(board);
  mesh(w, new THREE.BoxGeometry(9.4, 5.4, 0.12), std(0x23272d), 0, 2.4, minZ + 0.12);
  // posters and a clock
  ['🔢 MATH', '🌍 GEO', '🔬 SCIENCE', '📖 ENGLISH'].forEach((p, i) => { const l = labelSprite(p, 0.45, { bg: ['#e21b3c', '#1368ce', '#d89e00', '#26890c'][i] }); l.position.set(maxX - 0.3, 2.6, -6 + i * 4); S.add(l); });
  app.clock = canvasTexture(128, 128, () => {}); const ck = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshBasicMaterial({ map: app.clock })); ck.position.set(6.5, 3.6, minZ + 0.2); S.add(ck);
  // teacher's desk
  mesh(w, new RoundedBox(2.4, 0.9, 1.1, 2, 0.06), std(0x6b4226), -7, 0.45, minZ + 2.6); B.block(0, -7, minZ + 2.6, 1.2, 0.6);
  // student desks: 4 rows of 5; players get the middle seats
  app.seats = [];
  for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) {
    const x = -8 + c * 4, z = -3.2 + r * 3;
    mesh(w, new THREE.BoxGeometry(1.3, 0.06, 0.75), std(0xe8d5b0, { roughness: 0.5 }), x, 0.76, z); mesh(w, new THREE.BoxGeometry(1.2, 0.73, 0.06), std(0x5d6b7a, { metalness: 0.5 }), x, 0.37, z - 0.3);
    mesh(w, new THREE.BoxGeometry(0.5, 0.05, 0.5), std(0x2e6fd1), x, 0.46, z + 0.62); mesh(w, new THREE.BoxGeometry(0.5, 0.5, 0.05), std(0x2e6fd1), x, 0.72, z + 0.88);
    // an iPad on every desk
    mesh(w, new THREE.BoxGeometry(0.42, 0.02, 0.3), std(0x111111, { metalness: 0.6 }), x, 0.8, z + 0.05, { cast: false });
    B.block(0, x, z, 0.65, 0.38);
    app.seats.push({ x, z: z + 0.62, ry: Math.PI, i: app.seats.length, player: r === 1 && c > 0 && c < 4 || r === 2 && (c === 1 || c === 3) });
  }
  // ---------- teacher and classmates ----------
  app.teacher = new Avatar({ ...randomAvatar(), skin: '#f2c49b', hair: 'bun', hairColor: '#4a2c17', shirt: '#8c1d3a', pants: '#22293a', top: 'plain', hat: 'none', pet: 'none', face: 'smile', height: 1.08 }, '', 'bot');
  app.teacher.group.position.set(-6.2, 0, minZ + 3.8); S.add(app.teacher.group);
  app.bubble = null;
  app.bots = BOT_NAMES.map((n, i) => ({ id: 'b' + i, name: n, skill: 0.45 + ((i * 37) % 50) / 100 }));
  const botSeats = app.seats.filter(s => !s.player);
  app.botAv = app.bots.map((b, i) => { const av = new Avatar(randomAvatar(), b.name, 'bot'); const s = botSeats[i]; av.group.position.set(s.x, 0.35, s.z); av.group.rotation.y = s.ry; av.play('sit'); S.add(av.group); av.seat = s; return av; });
  w.updaters.push(dt => { app.botAv.forEach(av => { if (!av.push) av.animate(0, dt, false); }); });
  // ---------- the quiz state (run by the host) ----------
  app.day = { phase: 'arrive', phaseEnds: Date.now() + 8000, qs: pickQs(), qi: 0, scores: {}, ans: {}, last: {} };
  app.net.onState('day', d => d && setDay(app, d));
  app.onEvent(ev => { if (ev.type === 'qa' && app.isHost() && app.day.phase === 'q' && ev.data.qi === app.day.qi) { app.day.ans[ev.data.pid] = { c: ev.data.c, ms: ev.data.ms, name: ev.data.name }; } });
  ipadDom(app);
  drawBoard(app);
}

function pickQs() { const idx = Q.map((_, i) => i).sort(() => Math.random() - 0.5); return idx.slice(0, NQ); }
const NEXT = { arrive: 'lesson', lesson: 'ipads', ipads: 'q', q: 'reveal', reveal: 'board', board: 'q', podium: 'pushups', pushups: 'break', break: 'arrive' };
function push(app, d) { app.net.setState('day', d); }
function hostTick(app, now) {
  const d = app.day; if (now < d.phaseEnds && !app.skip) return;
  app.skip = false;
  let n = { ...d, phase: NEXT[d.phase] };
  if (d.phase === 'q') { // score everyone: players' answers, and the bots answer too
    const q = Q[d.qs[d.qi]], scores = { ...d.scores }, last = {}, mult = app.double ? 2 : 1;
    for (const b of app.bots) { const ok = Math.random() < b.skill, ms = 2500 + Math.random() * 10000; const c = ok ? q[3] : (q[3] + 1 + Math.floor(Math.random() * 3)) % 4; d.ans[b.id] = { c, ms, name: b.name, bot: true }; }
    // fast right answers score more, and a streak of right answers adds a bonus (🔥 +100 per answer in a row, up to +300)
    for (const id in d.ans) { const a = d.ans[id], ok = a.c === q[3], streak = ok ? (scores[id]?.streak || 0) + 1 : 0, bonus = ok && streak > 1 ? Math.min(300, (streak - 1) * 100) : 0, pts = ok ? Math.round((500 + 500 * (1 - Math.min(1, a.ms / (PH.q * 1000)))) * mult) + bonus : 0; scores[id] = { name: a.name, pts: (scores[id]?.pts || 0) + pts, bot: !!a.bot, streak }; last[id] = { c: a.c, pts, streak, bonus }; }
    for (const id in scores) if (!d.ans[id] && scores[id].streak) scores[id] = { ...scores[id], streak: 0 };
    for (const p of [app.me, ...Object.values(app.players)]) { const id = p.pid; if (!scores[id]) scores[id] = { name: p.name, pts: 0 }; }
    n = { ...n, scores, last, ans: {} };
  }
  if (d.phase === 'board') { if (d.qi + 1 >= NQ) n.phase = 'podium'; else n.qi = d.qi + 1; }
  if (n.phase === 'pushups') { const order = Object.entries(d.scores).sort((a, b) => a[1].pts - b[1].pts); n.losers = order.slice(0, 3).map(([id]) => id); }
  if (n.phase === 'arrive') { n = { phase: 'arrive', qs: pickQs(), qi: 0, scores: {}, ans: {}, last: {} }; app.double = false; }
  n.phaseEnds = now + PH[n.phase] * 1000;
  push(app, n);
}
function setDay(app, d) {
  const was = app.day.phase, wasQ = app.day.qi; app.day = d;
  const L2 = (en, ru) => L(en, ru);
  if (d.phase !== was || d.qi !== wasQ) {
    app.answered = null;
    if (d.phase === 'arrive') { app.sfx('ding'); teacherSays(app, L2('Good morning, class! Find your seats, please.', 'Доброе утро, класс! Садитесь, пожалуйста.')); ui.banner('🔔 ' + L2('The bell rings! School starts.', 'Звенит звонок! Урок начинается.'), 3000); app.botAv.forEach(av => { av.push = false; av.play('sit'); }); }
    if (d.phase === 'lesson') { teacherSays(app, L2('Today we revise a few facts. Then… a quiz!', 'Сегодня повторим факты. А потом… викторина!')); seat(app); }
    if (d.phase === 'ipads') { teacherSays(app, L2('Take out your iPads! Quiz time!', 'Доставайте айпады! Время викторины!')); app.sfx('drumroll'); seat(app); pov(app, true); }
    if (d.phase === 'q') { app.qStart = Date.now(); app.sfx('countdown'); pov(app, true); }
    if (d.phase === 'reveal') { const mine = d.last[app.me.pid]; app.sfx(mine && mine.pts ? 'correct' : 'wrong'); }
    if (d.phase === 'podium') { pov(app, false); const top = rank(d); teacherSays(app, `🏆 ${top[0] ? top[0][1].name : ''} ${L2('wins today!', 'сегодня побеждает!')}`); app.world.fireworks(6); confetti(); app.sfx('champions'); const me = top.findIndex(([id]) => id === app.me.pid); if (me >= 0 && me < 3) app.net.earn([300, 200, 100][me]).then(b => { app.setMoney(b); ui.toast(`🏆 +${money([300, 200, 100][me])}`); }).catch(() => {}); }
    if (d.phase === 'pushups') pushups(app, d);
    if (d.phase === 'break') { stand(app); teacherSays(app, L2('Great job! Short break, then a new quiz.', 'Молодцы! Перемена, потом новая викторина.')); app.botAv.forEach(av => { av.push = false; av.play('sit'); }); }
  }
  // late joiners jump straight into the quiz
  if (['ipads', 'q', 'reveal', 'board'].includes(d.phase) && !app.pov && !app.pushing) { seat(app); pov(app, true); }
  renderIpad(app); drawBoard(app);
}
const rank = d => Object.entries(d.scores || {}).sort((a, b) => b[1].pts - a[1].pts);

// ---------- sitting at your desk and the first-person iPad ----------
function mySeat(app) {
  const ps = [app.me.pid, ...Object.keys(app.players)].sort(), k = ps.indexOf(app.me.pid), free = app.seats.filter(s => s.player);
  return free[k] || { x: -6 + k * 1.2, z: 8.2, ry: Math.PI, standing: true };
}
function seat(app) {
  const w = app.world; if (w.carrier && w.carrier.school) return; const s = app.mySeat = { ...mySeat(app) };
  w.carrier = { school: true, update: (dt, p, me) => { if (!app.pushing && (app._seatT = (app._seatT || 0) + dt) > 1) { app._seatT = 0; const ns = mySeat(app); if (ns.x !== s.x || ns.z !== s.z) { Object.assign(s, ns); } } p.set(s.x, s.standing ? 0 : 0.35, s.z); me.group.rotation.y = s.ry; if (app.pushing) pushPose(me, app.pushT); else if (!s.standing && me.emote !== 'sit') me.play('sit'); me.animate(0, dt, false); if (app.pushing) pushPose(me, app.pushT); return false; }, onCancel: () => {} };
  if (!s.standing) { w.me.play('sit'); app.emoteSig = 'sit:' + Date.now(); }
}
function stand(app) { const w = app.world; if (w.carrier && w.carrier.school) { w.carrier = null; w.me.emote = null; w.teleport(app.mySeat.x + 1.4, app.mySeat.z, Math.PI); } pov(app, false); app.pushing = false; }
function pov(app, on) {
  const w = app.world; app.pov = on;
  document.querySelector('#ipad').classList.toggle('hidden', !on);
  w.me.group.visible = !on;
  w.cameraOverride = on ? (cam, dt) => { const s = app.mySeat || mySeat(app); cam.position.lerp(new THREE.Vector3(s.x, s.standing ? 1.8 : 1.6, s.z - 0.15), Math.min(1, dt * 6)); cam.lookAt(0, 2.7, -C.d / 2); } : null;
}
function ipadDom(app) {
  document.body.insertAdjacentHTML('beforeend', `<div id="ipad" class="ipad hidden"><div class="ipad-screen" id="ipadS"></div></div>`);
}
function renderIpad(app) {
  const d = app.day, el = document.querySelector('#ipadS'); if (!el || !app.pov) return;
  const q = Q[d.qs[d.qi]], meScore = d.scores?.[app.me.pid]?.pts || 0;
  const head = `<div class="ip-head"><b>Q ${Math.min(NQ, d.qi + 1)}/${NQ}</b><span>📚 Kahoot · Marbly School</span><b>${meScore} pts</b></div>`;
  if (d.phase === 'ipads') { el.innerHTML = `${head}<div class="ip-big">📱 ${L('Get ready!', 'Приготовься!')}</div><div class="ip-sub">${L('Answer fast: faster right answers score more.', 'Отвечай быстро: чем быстрее верный ответ, тем больше очков.')}</div>`; return; }
  if (d.phase === 'q') {
    if (app.answered !== null && app.answered !== undefined) { el.innerHTML = `${head}<div class="ip-big">⏳ ${L('Answer locked!', 'Ответ принят!')}</div><div class="ip-sub">${L('Waiting for the others…', 'Ждём остальных…')}</div><div class="ip-lock" style="background:${COLORS[app.answered]}">${SHAPES[app.answered]}</div>`; return; }
    el.innerHTML = `${head}<div class="ip-q">${esc(L(q[0], q[1]))}</div><div class="ip-timer"><i id="ipT"></i></div><div class="ip-grid">${q[2].map((o, i) => `<button class="ip-a" data-i="${i}" style="background:${COLORS[i]}"><span>${SHAPES[i]}</span>${esc(o)}</button>`).join('')}</div>`;
    el.querySelectorAll('.ip-a').forEach(b => b.onclick = () => { if (app.answered != null) return; app.answered = +b.dataset.i; app.sfx('click'); const ms = Date.now() - (app.qStart || Date.now()); app.emit('qa', { pid: app.me.pid, qi: d.qi, c: app.answered, ms, name: app.me.name }); if (app.isHost()) app.day.ans[app.me.pid] = { c: app.answered, ms, name: app.me.name }; renderIpad(app); });
    return;
  }
  if (d.phase === 'reveal') { const m = d.last?.[app.me.pid], ok = m && m.pts > 0; el.innerHTML = `${head}<div class="ip-res ${ok ? 'ok' : 'bad'}">${ok ? '✅ ' + L('Correct!', 'Верно!') : m ? '❌ ' + L('Wrong!', 'Неверно!') : '⏰ ' + L("Time's up!", 'Время вышло!')}</div><div class="ip-sub">${ok ? '+' + m.pts + ' pts' + (m.streak > 1 ? `<div class="ip-streak">🔥 ${m.streak} ${L('in a row!', 'подряд!')} +${m.bonus}</div>` : '') : L('The answer was:', 'Правильный ответ:') + ' <b>' + esc(q[2][q[3]]) + '</b>'}</div>`; return; }
  if (d.phase === 'board') { const r = rank(d), me = r.findIndex(([id]) => id === app.me.pid); el.innerHTML = `${head}<div class="ip-board">${r.slice(0, 5).map(([id, s], i) => `<div class="${id === app.me.pid ? 'me' : ''}"><b>${i + 1}</b><span>${esc(s.name)}</span><em>${s.pts}</em></div>`).join('')}</div>${me >= 5 ? `<div class="ip-sub">${L('You are', 'Ты на')} #${me + 1}</div>` : ''}`; return; }
}

// ---------- push-ups for the bottom three ----------
function pushPose(av, t) {
  const up = (Math.sin(t) + 1) / 2;
  av.body.rotation.set(Math.PI / 2, 0, 0); av.body.position.y = 0.32 + up * 0.38;
  av.armL.rotation.set(-Math.PI / 2 + 0.1, 0, 0); av.armR.rotation.set(-Math.PI / 2 + 0.1, 0, 0); av.legL.rotation.set(0, 0, 0); av.legR.rotation.set(0, 0, 0); av.head.rotation.set(-0.5, 0, 0);
}
function pushups(app, d) {
  const losers = d.losers || [], names = losers.map(id => d.scores[id]?.name || '?');
  teacherSays(app, `💪 ${names.join(', ')}: ${L('10 push-ups, please!', '10 отжиманий, пожалуйста!')}`);
  ui.banner('💪 ' + L('Push-ups for', 'Отжимаются') + ': ' + names.join(', '), 4500);
  // bots who lost go to the front and do push-ups
  losers.forEach((id, k) => { const i = app.bots.findIndex(b => b.id === id); if (i < 0) return; const av = app.botAv[i]; av.emote = null; av.push = true; av.pushK = k; av.group.position.set(-3 + k * 3, 0, -C.d / 2 + 4.6); av.group.rotation.y = 0; });
  if (losers.includes(app.me.pid)) {
    pov(app, false); const w = app.world, k = losers.indexOf(app.me.pid);
    app.mySeat = { x: -3 + k * 3, z: -C.d / 2 + 4.6, ry: 0, standing: true }; app.pushing = true; app.pushT = 0; app.pushN = 0;
    w.carrier = null; seat(app);
    w.cameraOverride = (cam, dt) => { cam.position.lerp(new THREE.Vector3(app.mySeat.x + 3, 2.2, app.mySeat.z + 4), Math.min(1, dt * 4)); cam.lookAt(app.mySeat.x, 0.5, app.mySeat.z); };
    ui.hud(`💪 ${L('Do 10 push-ups! Press Space or tap', 'Сделай 10 отжиманий! Жми Пробел или экран')} · 0/10`);
    // one push-up per press: down and up in 0.4 s (timed by the clock, so slow phones count the same)
    const go = () => {
      if (!app.pushing || app.pushBusy) return; app.pushBusy = true; const t0 = performance.now();
      const step = () => { const k = Math.min(1, (performance.now() - t0) / 400); app.pushT = Math.PI / 2 + k * Math.PI * 2; if (k < 1) requestAnimationFrame(step); };
      step();
      setTimeout(() => { app.pushBusy = false; app.pushN++; app.sfx('pop'); ui.hud(`💪 ${app.pushN}/10`); if (app.pushN >= 10) { app.pushing = false; ui.hud(''); ui.banner('💪 ' + L('Done! Strong!', 'Готово! Силач!'), 2500); app.sfx('cheer'); stand(app); } }, 420);
    };
    app.pushGo = go;
  } else if (app.pov) { pov(app, false); stand(app); }
}

// ---------- the teacher, the board and every frame ----------
function teacherSays(app, text) {
  const S = app.world.scene; if (app.bubble) S.remove(app.bubble);
  app.bubble = labelSprite('👩‍🏫 ' + text, 0.38, { bg: 'rgba(255,255,255,0.95)', color: '#1b1b1b' }); app.bubble.position.set(app.teacher.group.position.x, 2.5, app.teacher.group.position.z + 0.3); S.add(app.bubble);
  app.teacher.play('wave'); try { say(text.replace(/[^\p{L}\p{N}\s,.!?'-]/gu, ''), L('en', 'ru')); } catch (e) {}
}
function drawBoard(app) {
  const g = app.bdG, d = app.day, W = 1024, H = 576; if (!g) return;
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, W, H); g.fillStyle = '#46178f'; g.fillRect(0, 0, W, 70);
  g.fillStyle = '#fff'; g.font = '900 40px Manrope, system-ui'; g.textBaseline = 'middle'; g.fillText('📚 Marbly School · ' + L('Quiz Day', 'День викторины'), 24, 36);
  g.fillStyle = '#1b1b1b'; const now = Date.now(), left = Math.max(0, Math.ceil(((d.phaseEnds || now) - now) / 1000));
  const wrapText = (t, x, y, mw, lh) => { const words = t.split(' '); let line = ''; for (const wd of words) { if (g.measureText(line + wd).width > mw) { g.fillText(line, x, y); line = ''; y += lh; } line += wd + ' '; } g.fillText(line, x, y); };
  if (d.phase === 'arrive' || d.phase === 'break') { g.font = '800 56px Manrope, system-ui'; g.fillText(d.phase === 'arrive' ? L('Good morning! ☀️', 'Доброе утро! ☀️') : L('Break time 🍎', 'Перемена 🍎'), 40, 200); g.font = '600 34px Manrope, system-ui'; g.fillText(L('Quiz starts soon. Sit at a desk!', 'Скоро викторина. Садись за парту!'), 40, 290); }
  else if (d.phase === 'lesson') { const s = SLIDES[Math.floor((now / 6000)) % SLIDES.length]; g.font = '800 54px Manrope, system-ui'; g.fillText(L(s[0], s[1]), 40, 170); g.font = '600 36px Manrope, system-ui'; wrapText(L(s[2], s[3]), 40, 260, 940, 50); }
  else if (d.phase === 'ipads') { g.font = '900 72px Manrope, system-ui'; g.fillText('📱 Kahoot!', 40, 220); g.font = '700 38px Manrope, system-ui'; g.fillText(L('Take out your iPads', 'Достаньте айпады'), 40, 320); }
  else if (d.phase === 'q' || d.phase === 'reveal') {
    const q = Q[d.qs[d.qi]]; g.font = '800 46px Manrope, system-ui'; wrapText(L(q[0], q[1]), 40, 140, 940, 54);
    const counts = [0, 0, 0, 0]; if (d.phase === 'reveal') Object.values(d.last || {}).forEach(a => counts[a.c]++);
    q[2].forEach((o, i) => { const x = 40 + (i % 2) * 480, y = 300 + Math.floor(i / 2) * 110; g.globalAlpha = d.phase === 'reveal' && i !== q[3] ? 0.35 : 1; g.fillStyle = COLORS[i]; g.fillRect(x, y, 460, 92); g.fillStyle = '#fff'; g.font = '800 36px Manrope, system-ui'; g.fillText(`${SHAPES[i]}  ${o}${d.phase === 'reveal' ? '  · ' + counts[i] : ''}`, x + 20, y + 46); g.globalAlpha = 1; });
    if (d.phase === 'q') { g.fillStyle = '#46178f'; g.beginPath(); g.arc(940, 160, 50, 0, 7); g.fill(); g.fillStyle = '#fff'; g.font = '900 44px Manrope, system-ui'; g.textAlign = 'center'; g.fillText(left, 940, 162); g.textAlign = 'left'; }
  } else if (d.phase === 'board' || d.phase === 'podium') {
    g.font = '900 52px Manrope, system-ui'; g.fillText(d.phase === 'podium' ? '🏆 ' + L('Winners', 'Победители') : L('Leaderboard', 'Таблица'), 40, 130);
    rank(d).slice(0, 5).forEach(([id, s], i) => { g.fillStyle = i === 0 ? '#d89e00' : '#46178f'; g.fillRect(40, 175 + i * 76, 940, 64); g.fillStyle = '#fff'; g.font = '800 36px Manrope, system-ui'; g.fillText(`${i + 1}. ${s.name}${s.bot ? ' 🤖' : ''}`, 60, 207 + i * 76); g.textAlign = 'right'; g.fillText(s.pts, 960, 207 + i * 76); g.textAlign = 'left'; });
  } else if (d.phase === 'pushups') { g.font = '900 64px Manrope, system-ui'; g.fillText('💪 ' + L('PUSH-UPS!', 'ОТЖИМАНИЯ!'), 40, 200); g.font = '700 40px Manrope, system-ui'; (d.losers || []).forEach((id, i) => g.fillText(`${d.scores[id]?.name || '?'} × 10`, 60, 290 + i * 60)); }
  app.bd.needsUpdate = true;
}
function frame(dt, t, app) {
  if (!app.bdG) return;
  const now = Date.now();
  if (app.isHost()) { hostTick(app, now); if ((app._sync = (app._sync || 0) + dt) > 3) { app._sync = 0; push(app, app.day); } }
  if ((app._b = (app._b || 0) + dt) > 0.5) { app._b = 0; drawBoard(app); drawClock(app); }
  const tb = document.querySelector('#ipT'); if (tb && app.day.phase === 'q') tb.style.width = Math.max(0, (app.day.phaseEnds - now) / (PH.q * 1000) * 100) + '%';
  app.botAv.forEach((av, i) => { if (av.push) { av.animate(0, dt, false); pushPose(av, t * 5 + i); } });
  // remote players who lost do push-ups too
  if (app.day.phase === 'pushups') for (const id in app.world.remotes) if ((app.day.losers || []).includes(id)) pushPose(app.world.remotes[id].av, t * 5);
  if (app.teacherDance) { if (app.teacher.emote !== 'dance') app.teacher.play('dance'); app.teacher.animate(0, dt, false); }
  else alive(app, dt, t);
  if (app.snow) app.snow.forEach(f => { f.position.y -= dt * 0.8; f.position.x += Math.sin(t + f.userData.k) * dt * 0.2; if (f.position.y < 0) f.position.y = 4.2; });
  if (app.allPush) app.botAv.forEach((av, i) => { av.animate(0, dt, false); pushPose(av, t * 5 + i); });
}
function drawClock(app) {
  const g = app.clock.image.getContext('2d'), d = new Date();
  g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 62, 0, 7); g.fill(); g.strokeStyle = '#23272d'; g.lineWidth = 6; g.stroke();
  const hand = (a, l, wd) => { g.lineWidth = wd; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + Math.sin(a) * l, 64 - Math.cos(a) * l); g.stroke(); };
  hand((d.getHours() % 12 + d.getMinutes() / 60) / 12 * Math.PI * 2, 30, 6); hand(d.getMinutes() / 60 * Math.PI * 2, 46, 4); g.strokeStyle = '#e21b3c'; hand(d.getSeconds() / 60 * Math.PI * 2, 50, 2);
  app.clock.needsUpdate = true;
}
addEventListener('keydown', e => { if (e.code === 'Space' && A && A.pushing) { e.preventDefault(); A.pushGo && A.pushGo(); } });
addEventListener('pointerdown', e => { if (A && A.pushing && !e.target.closest('button, a, input')) A.pushGo && A.pushGo(); });

function onAdmin(a, d, app) {
  if (a === 'skip') { if (app.isHost()) app.skip = true; ui.banner('⏭️ ' + L('Admin skips ahead!', 'Админ перематывает!')); }
  if (a === 'double') { app.double = true; ui.banner('✖️2 ' + L('Double points this round!', 'Двойные очки в этом раунде!')); app.sfx('airhorn'); }
  if (a === 'allpush') { app.allPush = true; ui.banner('💪 ' + L('EVERYONE does push-ups!', 'ВСЕ отжимаются!')); setTimeout(() => { app.allPush = false; app.botAv.forEach(av => { if (!av.push) av.play('sit'); }); }, 12000); }
  if (a === 'teacherdance') { app.teacherDance = true; teacherSays(app, '🎶 ' + L('Let me show you my moves!', 'Смотрите, как я танцую!')); setTimeout(() => { app.teacherDance = false; app.teacher.emote = null; }, 15000); }
  if (a === 'pizza') { confetti(80); ui.banner('🍕 ' + L('Pizza party!', 'Пицца-вечеринка!')); app.seats.forEach(s => { const p = labelSprite('🍕', 0.5, { bg: null }); p.position.set(s.x, 1.1, s.z - 0.62); app.world.scene.add(p); setTimeout(() => app.world.scene.remove(p), 20000); }); app.sfx('cheer'); }
  if (a === 'snow') { if (!app.snow) { app.snow = []; const m = std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 0.5 }); for (let i = 0; i < 300; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 3), m); f.position.set((Math.random() - 0.5) * C.w, Math.random() * 4.2, (Math.random() - 0.5) * C.d); f.userData.k = i; app.world.scene.add(f); app.snow.push(f); } setTimeout(() => { app.snow.forEach(f => app.world.scene.remove(f)); app.snow = null; }, 30000); } ui.banner('❄️ ' + L('It is snowing in class!', 'В классе идёт снег!')); }
}

// ---------- a real classroom: the teacher moves about, classmates react ----------
function alive(app, dt, t) {
  const d = app.day, T = app.teacher, g = T.group;
  // the teacher walks along the front during the lesson and stands by the board for the quiz
  const lesson = d.phase === 'lesson' || d.phase === 'arrive' || d.phase === 'break';
  const tx = lesson ? Math.sin(t * 0.25) * 6 : -6.2, tz = -C.d / 2 + (lesson ? 2.6 : 3.8), dx = tx - g.position.x, dz = tz - g.position.z, dist = Math.hypot(dx, dz);
  if (dist > 0.05) { const st = Math.min(dist, 1.1 * dt); g.position.x += dx / dist * st; g.position.z += dz / dist * st; g.rotation.y = Math.atan2(dx, dz); T.animate(1.1, dt, false); }
  else { g.rotation.y += (0 - g.rotation.y) * Math.min(1, dt * 4); T.animate(0, dt, false); if (lesson && !T.emote && Math.sin(t * 0.9) > 0.6) { T.armR.rotation.set(-2.2, 0, -0.3); } }
  if (app.bubble) app.bubble.position.set(g.position.x, 2.5, g.position.z + 0.3);
  // classmates: hands up in the lesson, typing in the quiz, cheering or sad after each answer
  app.botAv.forEach((av, i) => {
    if (av.push || app.allPush) return;
    const b = app.bots[i], last = d.last && d.last[b.id], q = Q[d.qs ? d.qs[d.qi] : 0];
    if (d.phase === 'lesson' && Math.sin(t * 0.4 + i * 2.1) > 0.92) { av.armR.rotation.set(-2.9, 0, 0.1); }
    else if (d.phase === 'q') { const tap = Math.sin(t * 9 + i) * 0.15; av.armL.rotation.set(-1.1 + tap, 0, 0.2); av.armR.rotation.set(-1.1 - tap, 0, -0.2); av.head.rotation.x = 0.35; }
    else if (d.phase === 'reveal' && last) { if (last.pts > 0) { const j = Math.abs(Math.sin(t * 8 + i)); av.armL.rotation.set(-2.9, 0, 0.3); av.armR.rotation.set(-2.9, 0, -0.3); av.body.position.y = -0.62 + j * 0.06; } else { av.head.rotation.x = 0.5; av.armL.rotation.set(-0.3, 0, 0.6); av.armR.rotation.set(-0.3, 0, -0.6); } }
    void q;
  });
}
