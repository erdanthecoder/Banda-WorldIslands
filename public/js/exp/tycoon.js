// 🍦 Ice Cream Tycoon: claim one of six plots round the candy plaza, step on green buttons to buy droppers,
// watch scoops ride the belts through cone and sundae machines into your collector, cash in, and grow an
// ice cream empire (shop with customers, second floor, slide, golden statue…). Rebirth for a permanent multiplier.
import * as THREE from 'three';
import { experience, L, ui, std, canvasTexture, confetti, flash, money } from './core.js';
import { Coins } from './fun.js';
import { labelSprite } from '../world.js';
import { People } from './people.js';
import { Bodies, walkPose } from '../crowd.js';
import { Avatar, randomAvatar } from '../avatar.js';
import { M, FLAVORS, BUILD, DROPS, BELTS, BX0, BX1, ARCH, COLLECT, CLAIM, COUNTER, SLIDE_PTS, PSLIDE, DOT, plotBase, plaza, plazaSlide, canvasPlane } from './tycoon-art.js';

const N = 6, PR = 50, TAU = Math.PI * 2, VAL = 3, KMUL = [1, 2, 4, 8];
const BOTS = ['Scoop Sam', 'Lola Gelato', 'Chef Choco', 'Minty Max', 'Berry Bella', 'Waffle Will'];
// every button, in the order they unlock (at = where the button sits on the plot: x, z, floor height)
const ITEMS = [
  { id: 'drop1', icon: '🍓', en: 'Strawberry Dropper', ru: 'Клубничный дроппер', price: 0, at: [6, 1] },
  { id: 'drop2', icon: '🍦', en: 'Vanilla Dropper', ru: 'Ванильный дроппер', price: 30, req: ['drop1'], at: [3.5, 1] },
  { id: 'floor', icon: '🟪', en: 'Candy Floor', ru: 'Конфетный пол', price: 50, req: ['drop1'], at: [-3, 3.2] },
  { id: 'drop3', icon: '🍫', en: 'Chocolate Dropper', ru: 'Шоколадный дроппер', price: 90, req: ['drop2'], at: [6, 3.5] },
  { id: 'cone', icon: '🍦', en: 'Cone Machine ×2', ru: 'Машина рожков ×2', price: 160, req: ['drop3'], at: [-3, 0.6] },
  { id: 'walls', icon: '🧱', en: 'Walls', ru: 'Стены', price: 220, req: ['floor'], at: [-5.8, 3.2] },
  { id: 'sign', icon: '🪧', en: 'Name Sign', ru: 'Вывеска с именем', price: 300, req: ['walls'], at: [-3, 6] },
  { id: 'belt2', icon: '➰', en: 'Second Belt', ru: 'Вторая лента', price: 400, req: ['cone'], at: [3.5, 3.5] },
  { id: 'drop4', icon: '🌿', en: 'Mint Dropper', ru: 'Мятный дроппер', price: 500, req: ['belt2'], at: [6, 6] },
  { id: 'lamps', icon: '💡', en: 'Candy Lamps', ru: 'Леденцовые фонари', price: 600, req: ['sign'], at: [-5.8, 6] },
  { id: 'drop5', icon: '🫐', en: 'Blueberry Dropper', ru: 'Черничный дроппер', price: 700, req: ['drop4'], at: [3.5, 6] },
  { id: 'counter', icon: '🏪', en: 'Shop Counter', ru: 'Прилавок', price: 900, req: ['sign'], at: [9, 10.5] },
  { id: 'drop6', icon: '🥭', en: 'Mango Dropper', ru: 'Манговый дроппер', price: 1000, req: ['drop5'], at: [6, 8.5] },
  { id: 'fast1', icon: '⚡', en: 'Turbo Belts', ru: 'Турбо-ленты', price: 1300, req: ['belt2'], at: [3.5, 8.5] },
  { id: 'sundae', icon: '🍨', en: 'Sundae Maker ×4', ru: 'Машина пломбира ×4', price: 1600, req: ['drop6'], at: [-3, 9] },
  { id: 'balloon', icon: '🎈', en: 'Ad Balloon', ru: 'Рекламный шар', price: 1900, req: ['counter'], at: [9, 7.8] },
  { id: 'stairs', icon: '🪜', en: 'Stairs', ru: 'Лестница', price: 2200, req: ['counter'], at: [10.4, 3] },
  { id: 'floor2', icon: '🏢', en: 'Second Floor', ru: 'Второй этаж', price: 2800, req: ['stairs'], at: [-5.8, 9] },
  { id: 'freezer', icon: '❄️', en: 'Mega Freezer', ru: 'Мега-морозилка', price: 3500, req: ['floor2'], at: [-6, -3, 5.5] },
  { id: 'tables', icon: '☂️', en: 'Party Tables', ru: 'Столики', price: 4000, req: ['floor2'], at: [-2, -3, 5.5] },
  { id: 'slide', icon: '🛝', en: 'Slide', ru: 'Горка', price: 4800, req: ['tables'], at: [-10.5, -3.5, 5.5] },
  { id: 'fast2', icon: '🚀', en: 'Hyper Belts', ru: 'Гипер-ленты', price: 5500, req: ['sundae', 'fast1'], at: [-8.5, 3.8] },
  { id: 'fountain', icon: '⛲', en: 'Fountain', ru: 'Фонтан', price: 6500, req: ['balloon'], at: [-9.5, 10.5] },
  { id: 'golden', icon: '✨', en: 'Golden Dropper', ru: 'Золотой дроппер', price: 8000, req: ['fast2'], at: [-0.5, 12] },
  { id: 'sprinkles', icon: '🌈', en: 'Sprinkle Blaster ×8', ru: 'Посыпатель ×8', price: 10000, req: ['golden'], at: [-3.5, 12] },
  { id: 'topper', icon: '🗼', en: 'Giant Cone Tower', ru: 'Башня-рожок', price: 12000, req: ['freezer'], at: [2, -3, 5.5] },
  { id: 'fireworks', icon: '🎆', en: 'Firework Launcher', ru: 'Салютная пушка', price: 14000, req: ['topper'], at: [6, -3, 5.5] },
  { id: 'statue', icon: '🗿', en: 'Your Golden Statue', ru: 'Твоя золотая статуя', price: 17000, req: ['sprinkles'], at: [3.5, 11.5] },
  { id: 'rebirth', icon: '🔁', en: 'REBIRTH', ru: 'ПЕРЕРОЖДЕНИЕ', price: 25000, req: ['statue', 'fireworks', 'slide', 'fountain', 'lamps'], at: [9, -8, 5.5] },
];
const ITEM = Object.fromEntries(ITEMS.map(x => [x.id, x]));
// real mBank coins for big moments (cents)
const MILESTONES = { drop1: [20, 'First dropper!', 'Первый дроппер!'], cone: [30, 'First upgrade!', 'Первое улучшение!'], floor2: [50, 'Second floor!', 'Второй этаж!'], statue: [50, 'Golden statue!', 'Золотая статуя!'] };
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(2) + 'M' : n >= 1e4 ? (n / 1e3).toFixed(1) + 'K' : Math.floor(n).toLocaleString('en-US');
const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const nowMs = () => performance.now();
let A;

experience({
  id: 'tycoon', title: 'Ice Cream Tycoon', titleRu: 'Тайкун Мороженого', icon: '🍦', spawn: [0, 20, Math.PI], sun: [38, 140],
  admin: [
    { a: 'tyrain', icon: '💸', en: 'Money rain (cash for all)', ru: 'Денежный дождь (всем кэш)' },
    { a: 'ty10x', icon: '🔥', en: '10× income for 60 s', ru: 'Доход ×10 на 60 с' },
    { a: 'tygold', icon: '✨', en: 'Golden scoops everywhere', ru: 'Золотые шарики везде' },
    { a: 'tyfree', icon: '🎁', en: 'Free item for every plot', ru: 'Бесплатная постройка всем' },
    { a: 'tyflood', icon: '🌊', en: 'Ice cream flood', ru: 'Потоп из мороженого' },
    { a: 'tyscoop', icon: '🍨', en: 'Giant scoop from the sky', ru: 'Гигантский шарик с неба' },
    { a: 'tyrobbers', icon: '🦹', en: 'Robbers everywhere', ru: 'Грабители повсюду' },
    { a: 'tyrush', icon: '🏃', en: 'Customer rush', ru: 'Наплыв покупателей' },
    { a: 'tyhalf', icon: '🏷️', en: 'Everything half price', ru: 'Всё за полцены' },
    { a: 'tyrebirth', icon: '🔁', en: 'Rebirth everyone (?!)', ru: 'Переродить всех (?!)' },
    { a: 'tysprinkle', icon: '🌈', en: 'Sprinkle storm', ru: 'Шторм посыпки' },
    { a: 'typarty', icon: '🤪', en: 'Droppers go crazy', ru: 'Дропперы сошли с ума' },
    { a: 'tystatue', icon: '🗽', en: 'Statue comes alive', ru: 'Статуя оживает' },
  ],
  build, frame, onAdmin, started, onPlayers,
});

// ---------- save (tycoon cash lives in this browser, per account) ----------
function load(app) {
  let s = {}; try { s = JSON.parse(localStorage.getItem('marbly_tycoon_' + app.me.uid)) || {}; } catch (e) {}
  return { cash: 10, it: [], rb: 0, ms: {}, day: '', stored: 0, ...s };
}
function save(app) { try { localStorage.setItem('marbly_tycoon_' + app.me.uid, JSON.stringify(app.ty)); } catch (e) {} }
const mult = app => (1 + 0.5 * app.ty.rb) * (app.fx.x10 > nowMs() ? 10 : 1) * (app.fx.x2 > nowMs() ? 2 : 1);
const cost = (app, it) => it.id === 'rebirth' ? 25000 * (1 + app.ty.rb) : Math.round(it.price * (app.fx.half > nowMs() ? 0.5 : 1));
const avail = have => ITEMS.filter(it => !have.has(it.id) && (it.req || []).every(r => have.has(r)));

// ---------- build ----------
function build(app) {
  A = app; const w = app.world, S = w.scene;
  w.scene.fog.density = 0.0018;
  app.ty = load(app); app.fx = {}; app.pops = []; app.joinT = Date.now(); app.claims = {}; app.rate = 0; app.inc = 0;
  app.statue = plaza(w);
  const title = labelSprite('🍦 ICE CREAM TYCOON', 2.2, { bg: 'rgba(255,79,139,0.92)', weight: 900 }); title.position.set(0, 29, 0); S.add(title);
  // belts: a scrolling arrow texture (each plot gets its own copy so speeds differ)
  app.beltTex = canvasTexture(128, 64, (g, W, H) => { g.fillStyle = '#3b3f48'; g.fillRect(0, 0, W, H); g.strokeStyle = '#5c6270'; g.lineWidth = 8; for (const x of [20, 84]) { g.beginPath(); g.moveTo(x + 24, 10); g.lineTo(x, H / 2); g.lineTo(x + 24, H - 10); g.stroke(); } });
  app.beltTex.wrapS = app.beltTex.wrapT = THREE.RepeatWrapping; app.beltTex.repeat.set((BX1 - BX0) / 1.5, 1);
  app.plots = Array.from({ length: N }, (_, i) => makePlot(app, i));
  scoopMeshes(app);
  plazaFun(app);
  customers(app);
  app.robbers = [];
  app.people = new People(w, { rings: [{ cx: 0, cz: 0, rx: 20, rz: 20, n: w.hq ? 22 : 12, stops: [{ x: 12, z: -18.5, face: Math.PI * 0.83 }, { x: -12, z: -18.5, face: -Math.PI * 0.83 }] }], far: w.hq ? 150 : 100 });
  app.coins = new Coins(app, { respawn: 45, reach: 1.3 });
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + 0.2, r = k % 2 ? 12 : 27; app.coins.add(Math.sin(a) * r, 1, Math.cos(a) * r, 5); }
  // HUD: tycoon cash, and a button to go home
  app.cashEl = document.createElement('div'); app.cashEl.className = 'ty-cash'; document.body.appendChild(app.cashEl);
  app.homeBtn = document.createElement('button'); app.homeBtn.className = 'x-act'; app.homeBtn.innerHTML = '🏠<small>H</small>'; app.homeBtn.onclick = () => goHome(app); document.body.appendChild(app.homeBtn);
  addEventListener('keydown', e => { if (/INPUT|TEXTAREA/.test(e.target.tagName) || w.inputLocked) return; if (e.code === 'KeyH') goHome(app); });
  // multiplayer: the host keeps every plot (owner, items) in shared state; buys are broadcast so they pop in for everyone
  app.net.onState('tyc', v => v && v.p && applyState(app, v));
  app.onEvent(ev => {
    const d = ev.data || {};
    if (ev.type === 'tclaim' || ev.type === 'tsync') hostClaim(app, d, ev.type === 'tsync');
    if (ev.type === 'tbuy') onBuy(app, d);
    if (ev.type === 'treb') onReb(app, d);
  });
  app.extraPos = () => ({ ty: app.mine ? app.mine.i : -1 });
  app.ty.it = app.ty.it.filter(id => BUILD[id]);
}
function started(app) {
  app.joinT = Date.now(); app.ready = true;
  ui.banner('🍦 ' + L('Ice Cream Tycoon! Walk onto a green 🔓 pad to claim a plot, then step on buttons to build.', 'Тайкун Мороженого! Встань на зелёную 🔓 площадку, чтобы занять участок, и наступай на кнопки, чтобы строить.'), 6000);
}
function onPlayers(app) {
  const known = app._known || (app._known = new Set()), ids = Object.keys(app.players), grew = ids.some(id => !known.has(id));
  if (ids.length === known.size && !grew) return;
  app._known = new Set(ids);
  if (grew) { if (app.hs) push(app); if (app.mine) claimMsg(app, app.mine, 'tsync'); }
}

// ---------- plots ----------
function makePlot(app, i) {
  const w = app.world, a = i * TAU / N, th = a + Math.PI;
  const P = { i, a, th, cx: Math.sin(a) * PR, cz: Math.cos(a) * PR, c: Math.cos(th), s: Math.sin(th), items: new Set(), objs: {}, sol: {}, owner: null, name: BOTS[i], rb: 0, scoops: [], drops: [], up: [], btns: {}, queue: [], anims: [], serveT: 2, fresh: true, fw: rnd(10, 30) };
  P.w = (lx, lz) => [P.cx + lx * P.c + lz * P.s, P.cz - lx * P.s + lz * P.c];
  P.l = (x, z) => { const dx = x - P.cx, dz = z - P.cz; return [dx * P.c - dz * P.s, dx * P.s + dz * P.c]; };
  const g = P.g = new THREE.Group(); g.position.set(P.cx, 0, P.cz); g.rotation.y = th; w.scene.add(g);
  P.beltTex = app.beltTex.clone(); P.beltTex.needsUpdate = true; P.beltMat = std(0xffffff, { map: P.beltTex, roughness: 0.55 });
  const base = plotBase(P); g.add(base); addSolids(app, P, 'base', base.userData.sol); P.pad = base.userData.pad;
  P.claimMat = std(0x111111, { emissive: 0x3dff7a, emissiveIntensity: 1.3 });
  const cp = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 0.06, 32), P.claimMat); cp.position.set(CLAIM[0], 0.19, CLAIM[1]); g.add(cp);
  P.ring = new THREE.Mesh(new THREE.TorusGeometry(1.3, 0.06, 8, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x3dff7a, transparent: true })); P.ring.position.set(CLAIM[0], 0.3, CLAIM[1]); g.add(P.ring);
  // the bot that builds here while no player owns the plot
  const av = new Avatar({ ...randomAvatar(), hat: pick(['cap', 'none', 'beanie']) }, '', 'bot'), tag = labelSprite('🤖 ' + BOTS[i], 0.38, { bg: 'rgba(120,60,200,0.85)' });
  tag.position.y = 2.35; av.group.add(tag); w.scene.add(av.group);
  P.bot = { av, x: 0, z: 6, tx: 0, tz: 6, wait: 0 }; botPlace(P);
  // second floor and stairs (only for walkers that are up there; the camera and teleports ignore them)
  w.grounds.push((x, z, wy) => {
    if (wy > 1e8 || (!P.items.has('floor2') && !P.items.has('stairs'))) return null;
    const [lx, lz] = P.l(x, z);
    if (P.items.has('floor2') && Math.abs(lx) < 15.2 && lz < -0.8 && lz > -15.2 && wy >= 4.9) return 5.5;
    if (P.items.has('stairs') && lx > 12.2 && lx < 14.6 && lz > -0.8 && lz < 6) { const top = (Math.min(11, Math.max(0, Math.floor((6 - lz) / (6.8 / 12)))) + 1) * 5.5 / 12; if (wy >= top - 0.6) return top; }
    return null;
  });
  labels(app, P);
  return P;
}
function addSolids(app, P, key, list) {
  if (!list) return; const out = P.sol[key] = [];
  for (const s of list) {
    const [x, z] = P.w(s[0], s[1]);
    const o = s.length === 6 ? { x, z, hw: s[2], hd: s[3], rot: P.th, y0: s[4], y1: s[5] } : s.length === 5 ? { x, z, r: s[2], y0: s[3], y1: s[4] } : { x, z, r: s[2] };
    out.push(o); app.world.solids.push(o);
  }
}
function dropSolids(app, P, key) { const list = P.sol[key]; if (!list) return; const S = app.world.solids; for (const o of list) { const k = S.indexOf(o); if (k >= 0) S.splice(k, 1); } delete P.sol[key]; }
function addItem(app, P, id, anim, delay = 0) {
  if (P.items.has(id) || !BUILD[id]) return;
  P.items.add(id);
  const g = BUILD[id](P); P.g.add(g); P.objs[id] = g;
  addSolids(app, P, id, g.userData.sol);
  g.traverse(o => { if (o.userData.spin || o.userData.pulse) P.anims.push(o); });
  if (anim) {
    g.userData.k = -delay; g.userData.s0 = g.scale.x; g.scale.setScalar(0.001); app.pops.push(g);
    const it = ITEM[id], [x, z] = P.w(it.at[0], it.at[1]);
    if (near(app, P, 50)) { setTimeout(() => { burst(app, x, (it.at[2] || 0) + 1, z); app.sfx(delay ? 'pop' : 'place'); }, delay * 1000); }
  }
  refresh(app, P);
}
function removeItem(app, P, id, anim) {
  const g = P.objs[id]; if (!g) return;
  P.items.delete(id); delete P.objs[id]; dropSolids(app, P, id);
  P.anims = P.anims.filter(o => { let p = o; while (p) { if (p === g) return false; p = p.parent; } return true; });
  const kill = () => { P.g.remove(g); g.traverse(o => { if (o.isMesh) o.geometry.dispose(); }); (g.userData.dispose || []).forEach(x => x.dispose()); };
  if (anim) { g.userData.out = 1; app.pops.push(g); g.userData.kill = kill; } else kill();
  refresh(app, P);
}
function clearPlot(app, P, anim) { for (const id of [...P.items]) removeItem(app, P, id, anim); P.scoops = []; if (anim && near(app, P, 60)) { app.sfx('whoosh'); burst(app, P.cx, 3, P.cz, 80); } }
// what the plot can do now: droppers, upgrade machines, belt speed
function refresh(app, P) {
  const has = id => P.items.has(id);
  P.drops = Object.keys(DROPS).filter(has).map(id => { const old = P.drops.find(d => d.id === id); return { id, b: DROPS[id][0], x: DROPS[id][1], f: id === 'golden' ? 0 : +id.slice(4) - 1, gold: id === 'golden', t: old ? old.t : rnd(0.2, 1.5), noz: P.objs[id].userData.noz }; });
  P.up = ['cone', 'sundae', 'sprinkles'].map(has);
  P.kind = P.up.lastIndexOf(true) + 1;
  P.speed = 1.4 * (1 + (has('fast1') ? 0.4 : 0) + (has('fast2') ? 0.6 : 0)); P.rate = 1 + (has('fast1') ? 0.3 : 0) + (has('fast2') ? 0.5 : 0);
  if (P === app.mine) app.btnDirty = true;
}
const near = (app, P, r) => Math.hypot(app.world.me.group.position.x - P.cx, app.world.me.group.position.z - P.cz) < r;

// the sign over the claim pad, and the cash sign on my collector
function labels(app, P) {
  if (P.lab) P.g.remove(P.lab);
  const mine = P === app.mine, txt = mine ? '🏠 ' + L('Your plot', 'Твой участок') + (app.ty.rb ? ` · ⭐${app.ty.rb}` : '') : P.owner ? `🏠 ${P.name}${P.rb ? ` · ⭐${P.rb}` : ''}` : '🔓 ' + L('Claim this plot!', 'Займи участок!');
  P.lab = labelSprite(txt, 0.62, { bg: mine ? 'rgba(255,79,139,0.95)' : P.owner ? 'rgba(30,40,70,0.85)' : 'rgba(30,170,90,0.95)', weight: 800 });
  P.lab.position.set(CLAIM[0], 3.1, CLAIM[1]); P.g.add(P.lab);
  P.claimMat.emissive.setHex(mine ? 0xff4f8b : P.owner ? 0x334466 : 0x3dff7a); P.ring.visible = !P.owner;
  P.bot.av.group.visible = !P.owner;
}
function cashSign(app, P) {
  if (!P.cashS) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    P.cashS = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true })); P.cashS.scale.set(3.6, 1.125, 1); P.cashS.renderOrder = 10;
    P.cashS.position.set(-10.6, 3.6, -0.9); P.g.add(P.cashS); P.cashS.userData.c = c; P.cashV = -1;
  }
  const v = Math.floor(app.ty.stored); if (v === P.cashV) return; P.cashV = v;
  const c = P.cashS.userData.c, g = c.getContext('2d'); g.clearRect(0, 0, 512, 160);
  g.fillStyle = 'rgba(20,24,40,0.85)'; g.beginPath(); g.roundRect(4, 4, 504, 152, 26); g.fill(); g.strokeStyle = '#ffd34d'; g.lineWidth = 5; g.stroke();
  g.textAlign = 'center'; g.fillStyle = '#ffd34d'; g.font = '900 64px Manrope, system-ui, sans-serif'; g.fillText('🍦 ' + fmt(v), 256, 72);
  g.fillStyle = '#fff'; g.font = '700 30px Manrope, system-ui, sans-serif'; g.fillText(L('Step on 💰 to collect', 'Встань на 💰, чтобы забрать'), 256, 128);
  P.cashS.material.map.needsUpdate = true;
}

// ---------- buttons on my plot ----------
function btnTag(it, price, ok) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), name = `${it.icon} ${L(it.en, it.ru)}`;
  g.font = '800 44px Manrope, system-ui, sans-serif'; const W = Math.max(300, Math.ceil(g.measureText(name).width) + 50); c.width = W; c.height = 150;
  g.fillStyle = it.id === 'rebirth' ? 'rgba(120,40,200,0.95)' : ok ? 'rgba(20,140,70,0.95)' : 'rgba(40,44,58,0.92)'; g.beginPath(); g.roundRect(0, 0, W, 150, 24); g.fill();
  g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.font = '800 44px Manrope, system-ui, sans-serif'; g.fillText(name, W / 2, 46);
  g.fillStyle = ok ? '#ffe680' : '#ff8a8a'; g.font = '900 46px Manrope, system-ui, sans-serif'; g.fillText(price ? '🍦 ' + fmt(price) : L('FREE', 'БЕСПЛАТНО'), W / 2, 108);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthWrite: false, transparent: true })); s.scale.set(1.1 * W / 150, 1.1, 1); s.renderOrder = 10; return s;
}
const padGeo = new THREE.CylinderGeometry(0.95, 1.05, 0.24, 28), arrowGeo = new THREE.ConeGeometry(0.28, 0.5, 4).rotateX(Math.PI);
function syncButtons(app) {
  const P = app.mine; if (!P) return; app.btnDirty = false;
  const want = avail(P.items);
  for (const id in P.btns) if (!want.some(it => it.id === id)) dropBtn(P, id);
  for (const it of want) {
    const price = cost(app, it), ok = app.ty.cash >= price, b = P.btns[it.id];
    if (b && b.ok === ok && b.price === price) continue;
    if (b) dropBtn(P, it.id);
    const g = new THREE.Group(), y = it.at[2] || 0, col = it.id === 'rebirth' ? M.gP : ok ? M.gG : M.gPink;
    const pad = new THREE.Mesh(padGeo, col); pad.position.y = 0.12; g.add(pad);
    const ar = new THREE.Mesh(arrowGeo, col); ar.position.y = 1.2; g.add(ar);
    const tag = btnTag(it, price, ok); tag.position.y = 2.2; g.add(tag);
    g.position.set(it.at[0], y + 0.02, it.at[1]); P.g.add(g);
    if (!b) { g.scale.setScalar(0.001); g.userData.k = 0; g.userData.s0 = 1; app.pops.push(g); }
    P.btns[it.id] = { g, ar, ok, price, x: it.at[0], z: it.at[1], y };
  }
}
function dropBtn(P, id) { const b = P.btns[id]; if (!b) return; P.g.remove(b.g); b.g.children[2].material.map.dispose(); b.g.children[2].material.dispose(); delete P.btns[id]; }
function buy(app, id, free) {
  const P = app.mine, S = app.ty, it = ITEM[id]; if (!P || P.items.has(id)) return;
  const price = free ? 0 : cost(app, it);
  if (S.cash < price) { ui.toast(`🍦 ${L('You need', 'Нужно ещё')} ${fmt(price - S.cash)} ${L('more', '')}`.trim()); app.sfx('wrong'); return; }
  if (id === 'rebirth') return rebirth(app);
  S.cash -= price; S.it.push(id); addItem(app, P, id, true);
  app.emit('tbuy', { i: P.i, pid: app.me.pid, id });
  ui.toast(`${it.icon} ${L(it.en, it.ru)}${free ? ' 🎁' : ''}!`); app.sfx('cheer');
  const m = MILESTONES[id]; if (m && !S.ms[id]) { S.ms[id] = 1; realCoins(app, m[0], L(m[1], m[2])); }
  if (!avail(P.items).some(x => x.id !== 'rebirth') && P.items.has('statue')) ui.banner('🏆 ' + L('Your ice cream empire is complete! Rebirth upstairs for a permanent bonus!', 'Империя мороженого готова! Перерождение наверху даст вечный бонус!'), 5000);
  save(app); syncButtons(app); cashPop(app);
}
function rebirth(app) {
  const P = app.mine, S = app.ty;
  S.rb++; S.cash = 0; S.stored = 0; S.it = []; P.rb = S.rb;
  clearPlot(app, P, true); for (const id in P.btns) dropBtn(P, id);
  app.emit('treb', { i: P.i, pid: app.me.pid, rb: S.rb });
  flash(); confetti(); app.world.fireworks(10); app.sfx('champions');
  ui.banner(`🔁 ${L('REBIRTH!', 'ПЕРЕРОЖДЕНИЕ!')} ⭐${S.rb} · ${L('income', 'доход')} ×${(1 + 0.5 * S.rb).toFixed(1)} ${L('forever', 'навсегда')}!`, 6000);
  realCoins(app, 100, L('Rebirth!', 'Перерождение!'));
  labels(app, P); save(app); app.btnDirty = true;
}
function realCoins(app, cents, why) { app.coins.bonus(cents, true); ui.toast(`🪙 +${money(cents)} · ${why}`); app.sfx('paid'); }

// ---------- claiming and the host's plot list ----------
function claim(app, P) {
  if (app.mine) { if (app.mine !== P) ui.toast('🏠 ' + L('You already have a plot. Press 🏠 to go home!', 'У тебя уже есть участок. Жми 🏠, чтобы вернуться!')); return; }
  if (P.owner && P.owner !== app.me.pid) { ui.toast(`🔒 ${L('This plot belongs to', 'Этот участок у')} ${P.name}`); app.sfx('wrong'); return; }
  if (Date.now() - (app._claimT || 0) < 1500) return; app._claimT = Date.now();
  claimMsg(app, P, 'tclaim'); app.sfx('beep');
}
function claimMsg(app, P, kind) { const d = { i: P.i, pid: app.me.pid, name: app.me.name, it: [...app.ty.it], rb: app.ty.rb }; app.emit(kind, d); if (app.isHost()) hostClaim(app, d, kind === 'tsync'); }
function botState(i, n = 0) { const it = [], have = new Set(); for (let k = 0; k < n; k++) { const a = avail(have).filter(x => x.id !== 'rebirth'); if (!a.length) break; const x = pick(a.slice(0, 2)); it.push(x.id); have.add(x.id); } return { o: null, n: BOTS[i], it, rb: 0 }; }
function hostClaim(app, d, sync) {
  if (!app.isHost()) return;
  if (!app.hs) { app.claims[d.pid] = d; return; }
  const H = app.hs, s = H[d.i]; if (!s) return;
  if (s.o && s.o !== d.pid && (s.o === app.me.pid || app.players[s.o])) return; // taken
  const cur = H.findIndex(x => x.o === d.pid); if (cur >= 0 && cur !== d.i) H[cur] = botState(cur);
  const it = (d.it || []).filter(id => BUILD[id]);
  if (sync && s.o === d.pid && s.it.join() === it.join() && s.rb === d.rb) return;
  H[d.i] = { o: d.pid, n: String(d.name || '?').slice(0, 24), it, rb: d.rb || 0 }; app.dirty = true;
}
function onBuy(app, d) {
  if (app.hs) { const s = app.hs[d.i]; if (s && s.o === d.pid && !s.it.includes(d.id) && BUILD[d.id]) { s.it.push(d.id); app.dirty = true; } }
  const P = app.plots[d.i]; if (P && d.pid !== app.me.pid && P.owner === d.pid) addItem(app, P, d.id, true);
}
function onReb(app, d) {
  if (app.hs) { const s = app.hs[d.i]; if (s && s.o === d.pid) { s.it = []; s.rb = d.rb; app.dirty = true; } }
  const P = app.plots[d.i]; if (P && d.pid !== app.me.pid && P.owner === d.pid) { clearPlot(app, P, true); P.rb = d.rb; labels(app, P); if (near(app, P, 70)) app.world.fireworks(4, new THREE.Vector3(P.cx, 0, P.cz)); }
}
function push(app) { app.lastPush = Date.now(); app.dirty = false; app.net.setState('tyc', { p: app.hs, by: app.me.pid }); }
function hostTick(app) {
  const now = Date.now();
  if (!app.isHost() || !app.ready) { app.hs = null; return; }
  if (!app.hs) {
    if (app.lastState) app.hs = JSON.parse(JSON.stringify(app.lastState));
    else if (now - app.joinT > 3000) {
      app.hs = app.plots.map((P, i) => botState(i, 3 + Math.floor(Math.random() * 12))); app.hsFresh = now;
      Object.values(app.claims).forEach(d => hostClaim(app, d, false)); app.claims = {};
      if (app.mine || app.pendingMine) claimMsg(app, app.mine || app.pendingMine, 'tsync');
    } else return;
    app.dirty = true;
  }
  const H = app.hs;
  H.forEach((s, i) => {
    if (s.o && s.o !== app.me.pid && !app.players[s.o]) { H[i] = botState(i); app.dirty = true; return; } // the owner left: a bot takes over
    if (s.o) return;
    // bots build up their plots over time, then start again
    if (!s.next) s.next = now + rnd(9000, 20000);
    if (now < s.next) return;
    const a = avail(new Set(s.it)).filter(x => x.id !== 'rebirth');
    if (a.length) { s.it.push(pick(a.slice(0, 2)).id); s.next = now + rnd(12000, 26000); }
    else { s.it = []; s.rb = (s.rb || 0) + 1; s.next = now + 15000; }
    app.dirty = true;
  });
  if ((app.dirty && now - (app.lastPush || 0) > 250) || now - (app.lastPush || 0) > 4000) push(app);
}
function applyState(app, v) {
  app.lastState = v.p;
  if (app.hs && v.by !== app.me.pid && app.hsFresh && Date.now() - app.hsFresh < 15000) { app.hs = JSON.parse(JSON.stringify(v.p)); app.hsFresh = 0; } // someone already had the real plots
  v.p.forEach((s, i) => syncPlot(app, app.plots[i], s));
}
function syncPlot(app, P, s) {
  const me = app.me.pid, fresh = P.fresh; P.fresh = false;
  if (P === app.mine) {
    if (s.o !== me) { if (!s.o || !app.players[s.o]) claimMsg(app, P, 'tsync'); else { app.mine = null; P.cashS && P.g.remove(P.cashS); P.cashS = null; for (const id in P.btns) dropBtn(P, id); ui.toast('😮 ' + L('Your plot was taken. Claim another one!', 'Участок заняли. Займи другой!')); P.owner = null; syncPlot(app, P, s); } }
    return;
  }
  if (s.o === me) return becomeOwner(app, P);
  if (s.o !== P.owner || (s.o && s.n !== P.name)) {
    P.owner = s.o; P.name = s.n; P.rb = s.rb || 0; clearPlot(app, P, false); s.it.forEach(id => addItem(app, P, id, false)); labels(app, P); return;
  }
  if (!s.it.length && P.items.size) clearPlot(app, P, !fresh);
  else { for (const id of [...P.items]) if (!s.it.includes(id)) removeItem(app, P, id); for (const id of s.it) if (!P.items.has(id)) { addItem(app, P, id, !fresh); if (!fresh && !P.owner) { const at = ITEM[id].at; if (!at[2]) { P.bot.tx = at[0] + 1.4; P.bot.tz = at[1] + 1.2; } P.bot.cheer = 1; } } }
  if ((s.rb || 0) !== P.rb) { P.rb = s.rb || 0; labels(app, P); }
}
function becomeOwner(app, P) {
  const S = app.ty; app.pendingMine = null;
  P.owner = app.me.pid; P.name = app.me.name; P.rb = S.rb; app.mine = P;
  clearPlot(app, P, false); P.scoops = [];
  S.it.forEach((id, k) => addItem(app, P, id, true, Math.min(2.5, k * 0.09)));
  labels(app, P); cashSign(app, P); syncButtons(app);
  app.sfx('cheer'); confetti(60);
  ui.banner(S.it.length ? '🏠 ' + L('Welcome back! Your ice cream empire is rebuilt.', 'С возвращением! Твоя империя мороженого снова здесь.') : '🎉 ' + L('This plot is yours! Step on the green buttons to build. 💰 = collect cash.', 'Участок твой! Наступай на зелёные кнопки, чтобы строить. 💰 = забрать деньги.'), 5000);
  if (!S.it.length) setTimeout(() => ui.toast('💡 ' + L('The first dropper is FREE!', 'Первый дроппер — БЕСПЛАТНО!')), 2500);
}
function goHome(app) {
  const w = app.world;
  const P = app.mine || app.plots.find(p => !p.owner) || app.plots[0];
  const [x, z] = P.w(0, app.mine ? 10 : 21); w.teleport(x, z, P.th); app.sfx('teleport');
}

// ---------- scoops: droppers drop, belts carry, machines upgrade, the collector cashes in ----------
function scoopMeshes(app) {
  const S = app.world.scene, n = 600, im = (geo, mat, c) => { const m = new THREE.InstancedMesh(geo, mat, c); m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.castShadow = app.world.hq; m.count = 0; S.add(m); return m; };
  app.im = { scoop: im(new THREE.SphereGeometry(0.3, 14, 10), std(0xffffff, { roughness: 0.4 }), n), cone: im(new THREE.ConeGeometry(0.24, 0.62, 12).rotateX(Math.PI), M.waffle, n), cup: im(new THREE.CylinderGeometry(0.33, 0.2, 0.34, 14), std(0xff9ec4, { roughness: 0.25 }), n), cherry: im(new THREE.SphereGeometry(0.09, 8, 6), M.red, n) };
  const c = new THREE.Color(1, 1, 1); for (let i = 0; i < n; i++) app.im.scoop.setColorAt(i, c);
  app.m4 = new THREE.Matrix4(); app.v3 = new THREE.Vector3(); app.q = new THREE.Quaternion(); app.one = new THREE.Vector3(1, 1, 1); app.col = new THREE.Color();
}
function simPlot(app, P, dt, mine) {
  const now = nowMs(), fx = app.fx, speed = P.speed * (fx.party > now ? 1.8 : 1);
  for (const d of P.drops) {
    if (d.noz) d.noz.scale.y += (1 - d.noz.scale.y) * Math.min(1, dt * 8);
    if (d.b === 1 && !P.items.has('belt2')) continue;
    d.t -= dt * P.rate * (fx.party > now ? 5 : 1);
    if (d.t > 0) continue;
    d.t += d.gold ? 4 : 2;
    if (P.scoops.length < 70) { P.scoops.push({ b: d.b, x: d.x, y: 2.25, vy: 0, k: fx.sprinkle > now ? 3 : 0, g: d.gold || fx.gold > now, f: d.f }); if (d.noz) d.noz.scale.y = 1.8; }
  }
  for (let j = P.scoops.length - 1; j >= 0; j--) {
    const s = P.scoops[j];
    if (s.y > 1.04) { s.vy -= 16 * dt; s.y = Math.max(1.04, s.y + s.vy * dt); continue; }
    const x0 = s.x; s.x -= speed * dt;
    for (let u = 0; u < 3; u++) if (P.up[u] && x0 > ARCH[u] && s.x <= ARCH[u] && s.k < u + 1) s.k = u + 1;
    if (s.x > BX0 + 0.25) continue;
    P.scoops.splice(j, 1);
    if (mine) { const v = VAL * KMUL[s.k] * (s.g ? 10 : 1) * mult(app); app.ty.stored += v; app.inc += v; if (s.g) { const [x, z] = P.w(-10.6, BELTS[s.b]); popText(app, x, 3, z, '✨ +' + fmt(v), '#ffd34d'); } }
  }
  P.beltTex.offset.x = (P.beltTex.offset.x + speed * dt / 1.5) % 1;
}
function drawScoops(app) {
  const I = app.im, m4 = app.m4, v = app.v3, q = app.q, col = app.col, cam = app.world.camera.position, t = nowMs() / 1000;
  let ns = 0, nc = 0, nu = 0, nh = 0; const max = 600;
  const put = (im, i, x, y, z, s = 1) => { m4.compose(v.set(x, y, z), q, app.one.setScalar(s)); im.setMatrixAt(i, m4); };
  for (const P of app.plots) {
    if (Math.hypot(cam.x - P.cx, cam.z - P.cz) > (app.world.hq ? 130 : 90)) continue;
    for (const s of P.scoops) {
      if (ns >= max) break;
      const [x, z] = P.w(s.x, BELTS[s.b]), y = s.y, falling = y > 1.04;
      col.setHex(s.g ? 0xffd34d : s.k === 3 ? 0xffffff : FLAVORS[s.f]); if (s.k === 3 && !s.g) col.setHSL((t * 0.5 + s.x * 0.08) % 1, 0.85, 0.7);
      if (falling || s.k === 0) put(I.scoop, ns, x, y + 0.28, z);
      else if (s.k === 1) { put(I.cone, nc++, x, y + 0.31, z); put(I.scoop, ns, x, y + 0.72, z); }
      else { put(I.cup, nu++, x, y + 0.17, z); put(I.scoop, ns, x, y + 0.5, z); put(I.cherry, nh++, x + 0.05, y + 0.84, z); }
      I.scoop.setColorAt(ns++, col);
    }
  }
  I.scoop.count = ns; I.cone.count = nc; I.cup.count = nu; I.cherry.count = nh;
  for (const k in I) { I[k].instanceMatrix.needsUpdate = true; if (I[k].instanceColor) I[k].instanceColor.needsUpdate = true; }
}

// ---------- customers queue at shop counters ----------
function customers(app) {
  const w = app.world, n = w.hq ? 28 : 16;
  app.cust = { body: new Bodies(w, n), list: Array.from({ length: n }, (_, i) => ({ i, st: 'off', x: 0, z: 0, s: rnd(0.8, 1.02), phase: rnd(0, TAU), walk: 0, ry: 0, bag: false })), spawn: 1 };
  app.cust.cone = new THREE.InstancedMesh(new THREE.ConeGeometry(0.1, 0.28, 8).rotateX(Math.PI), M.waffle, n); app.cust.ball = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12, 10, 8), std(0xffffff, { roughness: 0.4 }), n);
  for (const im of [app.cust.cone, app.cust.ball]) { im.frustumCulled = false; w.scene.add(im); }
  for (let i = 0; i < n; i++) app.cust.ball.setColorAt(i, new THREE.Color(pick(FLAVORS)));
}
function custTick(app, dt) {
  const C = app.cust, now = nowMs(), rush = app.fx.rush > now, zero = new THREE.Matrix4().makeScale(0, 0, 0), m4 = app.m4, v = app.v3, q = app.q;
  C.spawn -= dt * (rush ? 6 : 1);
  if (C.spawn <= 0) {
    C.spawn = rnd(0.8, 2.2);
    const shops = app.plots.filter(P => P.items.has('counter') && P.queue.length < 6), c = C.list.find(x => x.st === 'off');
    if (shops.length && c) {
      const P = pick(shops.flatMap(p => p.items.has('balloon') ? [p, p, p] : [p])), a = P.a + rnd(-0.45, 0.45), r = rnd(14, 26);
      Object.assign(c, { st: 'in', P, x: Math.sin(a) * r, z: Math.cos(a) * r, hold: false, q: P.queue.length }); P.queue.push(c);
    }
  }
  for (const P of app.plots) {
    if (!P.items.has('counter')) { P.queue.forEach(c => leave(c)); P.queue = []; continue; }
    P.serveT -= dt * (rush ? 4 : 1);
    const f = P.queue[0];
    if (f && f.st === 'q' && P.serveT <= 0) {
      P.serveT = P.items.has('balloon') ? 2.5 : 3.5; P.queue.shift(); P.queue.forEach((c, k) => { c.q = k; c.st = 'in'; }); leave(f); f.hold = true;
      if (P === app.mine) { const val = 15 * KMUL[P.kind] * mult(app); app.ty.stored += val; app.inc += val; const [x, z] = P.w(COUNTER[0], COUNTER[1]); popText(app, x, 2.6, z, '🛒 +' + fmt(val), '#7dffb0'); if (near(app, P, 30)) app.sfx('scan'); }
    }
  }
  function leave(c) { const a = c.P.a + rnd(-0.6, 0.6), r = rnd(8, 22); c.st = 'out'; c.tx = Math.sin(a) * r; c.tz = Math.cos(a) * r; }
  for (const c of C.list) {
    if (c.st === 'off') { C.body.hide(c.i); C.cone.setMatrixAt(c.i, zero); C.ball.setMatrixAt(c.i, zero); continue; }
    if (c.st === 'in' || c.st === 'q') { const [tx, tz] = c.P.w(COUNTER[0], 16.2 + c.q * 0.95); c.tx = tx; c.tz = tz; }
    const dx = c.tx - c.x, dz = c.tz - c.z, d = Math.hypot(dx, dz), sp = (rush ? 3.2 : 1.6) * dt, moving = d > 0.08;
    if (moving) { const st = Math.min(d, sp); c.x += dx / d * st; c.z += dz / d * st; c.ry += Math.atan2(Math.sin(Math.atan2(dx, dz) - c.ry), Math.cos(Math.atan2(dx, dz) - c.ry)) * Math.min(1, dt * 8); c.walk += dt * 6; }
    else if (c.st === 'in') { c.st = 'q'; c.ry = c.P.th + Math.PI; }
    else if (c.st === 'out') { c.st = 'off'; continue; }
    const a = -1.25, s = c.s;
    C.body.pose(c.i, c.x, 0, c.z, c.ry, walkPose(c, moving, now / 1000, c.hold ? { armR: a } : {}));
    if (c.hold) { const lx = 0.54 * s, ly = (1.44 - Math.cos(a) * 0.81) * s, lz = -Math.sin(a) * 0.81 * s, cs = Math.cos(c.ry), sn = Math.sin(c.ry), hx = c.x + lx * cs + lz * sn, hz = c.z - lx * sn + lz * cs;
      m4.compose(v.set(hx, ly + 0.1, hz), q, app.one.setScalar(1)); C.cone.setMatrixAt(c.i, m4); m4.compose(v.set(hx, ly + 0.32, hz), q, app.one); C.ball.setMatrixAt(c.i, m4); }
    else { C.cone.setMatrixAt(c.i, zero); C.ball.setMatrixAt(c.i, zero); }
  }
  C.body.flush(); C.cone.instanceMatrix.needsUpdate = true; C.ball.instanceMatrix.needsUpdate = true;
}

// ---------- robbers sneak into plots while the owner is away ----------
function spawnRobber(app, P) {
  if (app.robbers.some(r => r.P === P && r.st !== 'gone')) return;
  const av = new Avatar({ ...randomAvatar(), shirt: '#262626', top: 'stripes', pants: '#1d1d1f', hair: 'none', hat: 'beanie', face: 'grin' }, '', 'bot');
  const mask = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), M.dark); mask.position.y = 0.04; av.head.add(mask);
  const sack = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), std(0x8a6a3a, { roughness: 0.9 })); sack.position.set(0.25, 1.1, -0.35); sack.visible = false; av.group.add(sack);
  const tag = labelSprite('🦹 ' + L('Robber!', 'Грабитель!'), 0.42, { bg: 'rgba(200,30,50,0.92)' }); tag.position.y = 2.4; av.group.add(tag);
  const path = [[0, 24], [0, 13], [-6, 4], [-9.6, 2.2]].map(([x, z]) => P.w(x, z));
  av.group.position.set(path[0][0], 0, path[0][1]); app.world.scene.add(av.group);
  app.robbers.push({ av, sack, P, path, k: 1, st: 'sneak', loot: 0, t: 0 });
  if (P === app.mine) { ui.banner('🚨 ' + L('A robber is sneaking into your plot! Run back and tag him!', 'Грабитель лезет на твой участок! Беги и поймай его!'), 4000); app.sfx('whistle'); }
}
function robberTick(app, dt) {
  const me = app.world.me.group.position, S = app.ty;
  for (const r of app.robbers) {
    if (r.st === 'gone') continue;
    r.t += dt;
    if (r.st === 'caught') { r.av.animate(0, dt, false); if (r.t > 1.6) { app.world.scene.remove(r.av.group); burst(app, r.av.group.position.x, 1, r.av.group.position.z, 30); r.st = 'gone'; } continue; }
    const g = r.av.group, [tx, tz] = r.path[r.k], dx = tx - g.position.x, dz = tz - g.position.z, d = Math.hypot(dx, dz), sp = r.st === 'run' ? 4.6 : 2.6;
    if (d > 0.1) { const st = Math.min(d, sp * dt); g.position.x += dx / d * st; g.position.z += dz / d * st; g.rotation.y = Math.atan2(dx, dz); r.av.animate(sp, dt, false); }
    else if (r.k < r.path.length - 1) r.k++;
    else if (r.st === 'sneak') {
      // grab from the collector, then run off across the plaza
      r.st = 'run'; r.k = 0; const out = r.P.a + Math.PI + rnd(-0.5, 0.5); r.path = [[0, 13], [0, 24]].map(([x, z]) => r.P.w(x, z)).concat([[Math.sin(out) * 30, Math.cos(out) * 30]]); r.sack.visible = true; r.av.play('laugh');
      if (r.P === app.mine) { r.loot = Math.floor(S.stored * 0.4); S.stored -= r.loot; ui.banner(r.loot ? `🦹 ${L('He grabbed', 'Он украл')} 🍦${fmt(r.loot)}! ${L('Catch him!', 'Лови его!')}` : '🦹 ' + L('He found an empty collector! 🤣', 'Коллектор пуст! 🤣'), 3500); app.sfx('laugh'); }
    } else { if (r.P === app.mine && r.loot) ui.toast(`😭 ${L('The robber got away with', 'Грабитель унёс')} 🍦${fmt(r.loot)}`); app.world.scene.remove(g); r.st = 'gone'; }
    // tag him to get the cash back (and a reward)
    if (Math.hypot(me.x - g.position.x, me.z - g.position.z) < 1.4 && Math.abs(me.y - g.position.y) < 1.5) {
      r.st = 'caught'; r.t = 0; r.av.play('sleep'); r.sack.visible = false;
      const bonus = Math.round(50 * mult(app)) + r.loot; S.cash += bonus; cashPop(app);
      ui.banner(`👮 ${L('Caught the robber!', 'Грабитель пойман!')} +🍦${fmt(bonus)}`, 3000); app.sfx('star'); confetti(40); realCoins(app, 5, L('Robber caught', 'Поймал грабителя'));
    }
  }
  if (app.robbers.length > 12) app.robbers = app.robbers.filter(r => r.st !== 'gone');
}

// ---------- the plaza: slide, daily gift, leaderboard ----------
function plazaFun(app) {
  const w = app.world, S = w.scene;
  // the slide tower (local frame like a plot: +z points at the statue)
  const a = Math.PI / 6, th = a + Math.PI, T = { cx: Math.sin(a) * 26, cz: Math.cos(a) * 26, c: Math.cos(th), s: Math.sin(th) };
  T.w = (lx, lz) => [T.cx + lx * T.c + lz * T.s, T.cz - lx * T.s + lz * T.c]; T.l = (x, z) => { const dx = x - T.cx, dz = z - T.cz; return [dx * T.c - dz * T.s, dx * T.s + dz * T.c]; };
  const sl = plazaSlide(); sl.position.set(T.cx, 0, T.cz); sl.rotation.y = th; S.add(sl);
  w.grounds.push((x, z, wy) => {
    if (wy > 1e8) return null; const [lx, lz] = T.l(x, z);
    if (Math.abs(lx) < 1.45 && Math.abs(lz) < 1.45 && wy >= 5.4) return 6;
    if (lx > 1.3 && lx < 8.6 && Math.abs(lz) < 0.9) { const top = (Math.min(12, Math.floor((8.6 - lx) / (7.3 / 13))) + 1) * 6 / 13; if (wy >= top - 0.6) return top; }
    return null;
  });
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { const [wx, wz] = T.w(x, z); w.solids.push({ x: wx, z: wz, r: 0.15, y0: -2, y1: 4.5 }); }
  for (const s of [-1, 1]) { const [wx, wz] = T.w(0, s * 1.4); w.solids.push({ x: wx, z: wz, hw: 1.4, hd: 0.08, rot: th, y0: 5.5, y1: 8 }); }
  const sLab = labelSprite('🛝 ' + L('Slide!', 'Горка!'), 0.6, { bg: 'rgba(255,170,30,0.95)' }); const [lx0, lz0] = T.w(0, 0); sLab.position.set(lx0, 8, lz0); S.add(sLab);
  app.slides = [{ test: p => { const [lx, lz] = T.l(p.x, p.z); return p.y > 5.5 && lx < -0.7 && lx > -1.6 && Math.abs(lz) < 0.8; }, curve: () => new THREE.CatmullRomCurve3(PSLIDE.map(([x, y, z]) => { const [wx, wz] = T.w(x, z); return new THREE.Vector3(wx, y, wz); })) }];
  // daily gift
  const ga = Math.PI * 7 / 6, gx = Math.sin(ga) * 24, gz = Math.cos(ga) * 24, gift = new THREE.Group();
  const gb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.6), std(0xe8304c, { roughness: 0.35 })); gb.position.y = 0.7; gift.add(gb);
  for (const r of [0, Math.PI / 2]) { const rb = new THREE.Mesh(new THREE.BoxGeometry(1.64, 1.44, 0.3), M.yellow); rb.position.y = 0.7; rb.rotation.y = r; gift.add(rb); }
  for (const s of [-1, 1]) { const bow = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.1, 8, 16), M.yellow); bow.position.set(s * 0.3, 1.6, 0); bow.rotation.y = Math.PI / 2; gift.add(bow); }
  gift.position.set(gx, 0, gz); S.add(gift); app.gift = gift; w.solids.push({ x: gx, z: gz, r: 0.9 });
  const gl = labelSprite('🎁 ' + L('Daily bonus', 'Ежедневный бонус'), 0.55, { bg: 'rgba(232,48,76,0.95)' }); gl.position.set(gx, 3, gz); S.add(gl);
  w.zone({ x: gx, z: gz, r: 1.9, onEnter: () => daily(app) });
  // leaderboard
  const ba = Math.PI * 5 / 6, bx = Math.sin(ba) * 24, bz = Math.cos(ba) * 24, bd = new THREE.Group(); bd.position.set(bx, 0, bz); bd.rotation.y = ba + Math.PI; S.add(bd);
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 6, 10), M.candy); p.position.set(s * 3.6, 3, -0.1); bd.add(p); }
  const fr = new THREE.Mesh(new THREE.BoxGeometry(7.6, 4.4, 0.25), M.hot); fr.position.set(0, 3.9, -0.15); bd.add(fr);
  app.board = canvasPlane(7.2, 4.0, 1024, 568, () => {}); app.board.position.set(0, 3.9, 0.0); bd.add(app.board);
  w.solids.push({ x: bx, z: bz, hw: 3.8, hd: 0.3, rot: ba + Math.PI }); drawBoard(app);
}
function drawBoard(app) {
  const t = app.board.material.map, c = t.image, g = c.getContext('2d'), W = c.width, H = c.height;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2b1640'); gr.addColorStop(1, '#4a1f5c'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillStyle = '#ffd34d'; g.font = '900 60px Manrope, system-ui, sans-serif'; g.fillText('🏆 ' + L('Top tycoons', 'Лучшие магнаты'), W / 2, 56);
  const rows = app.plots.map(P => ({ n: (P.owner ? '🏠 ' : '🤖 ') + P.name, k: P.items.size, rb: P.rb, me: P === app.mine })).sort((a, b) => (b.rb * 100 + b.k) - (a.rb * 100 + a.k));
  g.textAlign = 'left'; g.font = '800 44px Manrope, system-ui, sans-serif';
  rows.forEach((r, i) => { const y = 140 + i * 70; g.fillStyle = r.me ? '#ff8fc0' : i === 0 ? '#ffd34d' : '#fff'; g.fillText(`${i + 1}. ${r.n.slice(0, 22)}`, 40, y); g.textAlign = 'right'; g.fillText(`${r.rb ? '⭐' + r.rb + '  ' : ''}🏗️ ${r.k}`, W - 40, y); g.textAlign = 'left'; });
  t.needsUpdate = true;
}
function daily(app) {
  const S = app.ty, today = new Date().toDateString();
  if (S.day === today) { ui.toast('🎁 ' + L('Come back tomorrow for another gift!', 'Приходи завтра за новым подарком!')); return; }
  S.day = today; const v = Math.round(300 * (1 + S.rb) * (1 + 0.5 * S.rb)); S.cash += v; save(app); cashPop(app);
  ui.banner(`🎁 ${L('Daily bonus', 'Ежедневный бонус')}: +🍦${fmt(v)}!`, 3500); confetti(70); realCoins(app, 10, L('Daily gift', 'Подарок дня'));
}
function ride(app, curve) {
  const w = app.world; let s = 0; const len = curve.getLength();
  w.me.play('sit'); app.emoteSig = 'sit:' + Date.now(); app.sfx('whoosh');
  w.carrier = { update: (dt, p, me) => { s = Math.min(1, s + dt * (5 + s * 9) / len); p.copy(curve.getPointAt(s)); p.y += 0.05; const t = curve.getTangentAt(s); me.group.rotation.y = Math.atan2(t.x, t.z); me.animate(0, dt, false); return s >= 1; }, onEnd: () => { w.me.emote = null; app.sfx('boing'); }, onCancel: () => { w.me.emote = null; } };
}

// ---------- small effects: pop-in animations, bursts, floating text ----------
function burst(app, x, y, z, n = 40) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [], cols = new Float32Array(n * 3), c = new THREE.Color();
  for (let i = 0; i < n; i++) { pos.set([x, y, z], i * 3); vel.push(new THREE.Vector3().randomDirection().multiplyScalar(rnd(3, 7)).add(new THREE.Vector3(0, 3, 0))); c.setHSL(Math.random(), 0.9, 0.65); cols.set([c.r, c.g, c.b], i * 3); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const mat = new THREE.PointsMaterial({ size: 0.45, map: DOT, vertexColors: true, transparent: true, depthWrite: false }), pts = new THREE.Points(geo, mat); app.world.scene.add(pts);
  let life = 0; app.world.updaters.push(dt => { life += dt; const a = geo.attributes.position; for (let i = 0; i < n; i++) { vel[i].y -= 12 * dt; a.setXYZ(i, a.getX(i) + vel[i].x * dt, a.getY(i) + vel[i].y * dt, a.getZ(i) + vel[i].z * dt); } a.needsUpdate = true; mat.opacity = 1 - life; if (life > 1) { app.world.scene.remove(pts); geo.dispose(); mat.dispose(); return true; } });
}
function popText(app, x, y, z, text, color = '#ffd34d') {
  app.popPool = app.popPool || []; let s = app.popPool.find(p => !p.visible);
  if (!s) { if (app.popPool.length >= 12) s = app.popPool[0]; else { const c = document.createElement('canvas'); c.width = 384; c.height = 96; const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false })); s.scale.set(2.8, 0.7, 1); s.renderOrder = 11; app.world.scene.add(s); app.popPool.push(s); } }
  const g = s.material.map.image.getContext('2d'); g.clearRect(0, 0, 384, 96); g.font = '900 56px Manrope, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 9; g.strokeStyle = 'rgba(0,0,0,0.55)'; g.strokeText(text, 192, 50); g.fillStyle = color; g.fillText(text, 192, 50);
  s.material.map.needsUpdate = true; s.position.set(x, y, z); s.visible = true; s.userData.t = 0; s.userData.y = y;
}
function fxTick(app, dt, t) {
  app.pops = app.pops.filter(g => {
    if (g.userData.out) { g.userData.out -= dt * 2.2; g.scale.setScalar(Math.max(0.001, g.userData.out)); if (g.userData.out <= 0) { g.userData.kill(); return false; } return true; }
    const k = (g.userData.k += dt * 1.8); if (k < 0) return true;
    const e = k >= 1 ? 1 : 1 + 2.7 * Math.pow(k - 1, 3) + 1.7 * Math.pow(k - 1, 2); g.scale.setScalar(Math.max(0.001, e * (g.userData.s0 || 1))); return k < 1;
  });
  for (const s of app.popPool || []) if (s.visible) { s.userData.t += dt; s.position.y = s.userData.y + s.userData.t * 1.6; s.material.opacity = Math.min(1, 2.2 - s.userData.t * 1.6); if (s.userData.t > 1.35) s.visible = false; }
  M.portal.forEach((m, k) => (m.opacity = 0.3 + Math.sin(t * 4 + k) * 0.15));
  if (app.gift) { app.gift.rotation.y += dt * 0.8; app.gift.position.y = Math.abs(Math.sin(t * 2)) * 0.3; }
}
function cashPop(app) { const e = app.cashEl; e.classList.remove('pop'); e.offsetHeight; e.classList.add('pop'); }

// ---------- every frame ----------
function frame(dt, t, app) {
  if (!app.plots) return;
  const w = app.world, me = w.me.group.position, now = nowMs(), S = app.ty;
  hostTick(app);
  for (const P of app.plots) {
    const mine = P === app.mine;
    simPlot(app, P, dt, mine);
    for (const o of P.anims) { if (o.userData.spin) o.rotation.x += dt * o.userData.spin; if (o.userData.pulse) o.scale.set(1 + Math.sin(t * 6) * 0.08, 1 + Math.sin(t * 4) * 0.2, 1 + Math.sin(t * 6) * 0.08); }
    const bl = P.objs.balloon; if (bl) { bl.position.y = 16 + Math.sin(t * 0.8 + P.i) * 0.6; bl.rotation.y += dt * 0.15; }
    if (P.lab) P.lab.visible = w.camera.position.distanceTo(P.lab.getWorldPosition(app.v3)) > 4;
    P.ring.position.y = 0.3 + (t * 0.8 % 1) * 1.2; P.ring.material.opacity = 1 - (t * 0.8 % 1);
    if (!P.owner) botTick(app, P, dt);
    // fireworks launchers fire now and then
    if (P.items.has('fireworks') && (P.fw -= dt) < 0) { P.fw = rnd(25, 45); if (near(app, P, 80)) { const [x, z] = P.w(11, -12); w.fireworks(3, new THREE.Vector3(x, 6, z)); } }
    // claim pads
    const [cx, cz] = P.w(CLAIM[0], CLAIM[1]), on = Math.hypot(me.x - cx, me.z - cz) < 1.6 && me.y < 1;
    if (on && !P.onPad) claim(app, P); P.onPad = on;
    // slides on plots
    if (P.items.has('slide') && !w.carrier && me.y > 5) { const [lx, lz] = P.l(me.x, me.z); if (Math.hypot(lx - SLIDE_PTS[0][0], lz - SLIDE_PTS[0][2]) < 0.8) ride(app, new THREE.CatmullRomCurve3(SLIDE_PTS.map(([x, y, z]) => { const [wx, wz] = P.w(x, z); return new THREE.Vector3(wx, y, wz); }))); }
  }
  for (const sl of app.slides) if (!w.carrier && sl.test(me)) ride(app, sl.curve());
  drawScoops(app); custTick(app, dt); robberTick(app, dt); fxTick(app, dt, t); app.coins.update(dt, t);
  // my plot: buttons, the collect pad, the freezer, robbers
  const P = app.mine;
  if (P) {
    if (app.btnDirty || (app._bt = (app._bt || 0) + dt) > 0.4) { app._bt = 0; syncButtons(app); }
    const [lx, lz] = P.l(me.x, me.z);
    let hit = null; for (const id in P.btns) { const b = P.btns[id]; b.ar.position.y = 1.2 + Math.sin(t * 4) * 0.15; b.ar.rotation.y += dt * 2; if (Math.hypot(lx - b.x, lz - b.z) < 1.05 && Math.abs(me.y - b.y) < 1.2) hit = id; }
    if (hit && hit !== app.onBtn) buy(app, hit); app.onBtn = hit;
    const onPad = Math.hypot(lx - COLLECT[0], lz - COLLECT[1]) < 1.45 && me.y < 1.5;
    if (onPad && S.stored >= 1) { const v = Math.floor(S.stored); S.cash += v; S.stored -= v; if (!app.onCollect || now - app.lastCol > 1200) { app.lastCol = now; app.sfx('paid'); const [x, z] = P.w(COLLECT[0], COLLECT[1]); popText(app, x, 2, z, '+🍦' + fmt(v)); cashPop(app); burst(app, x, 1, z, 20); } }
    app.onCollect = onPad; P.pad.material.color.setScalar(onPad ? 1.6 : 1);
    if (P.items.has('freezer') && (app._frz = (app._frz || 0) + dt) > 2) { app._frz = 0; const v = 40 * mult(app); S.stored += v; app.inc += v; }
    const [kx, kz] = P.w(COLLECT[0], COLLECT[1]), away = Math.hypot(me.x - kx, me.z - kz) > 24;
    if (!app.nextRob) app.nextRob = now + rnd(60000, 100000);
    if (away && S.stored >= 40 && now > app.nextRob) { app.nextRob = now + rnd(70000, 130000); spawnRobber(app, P); }
    cashSign(app, P);
  }
  // HUD, leaderboard, saving
  if ((app._hud = (app._hud || 0) + dt) > 0.25) {
    app._hud = 0;
    if ((app._rt = (app._rt || 0) + 0.25) >= 2) { app.rate = app.rate * 0.5 + app.inc / app._rt * 0.5; app.inc = 0; app._rt = 0; }
    const tm = k => Math.max(0, Math.ceil((app.fx[k] - now) / 1000)), fx = [['x10', '🔥×10'], ['x2', '😜×2'], ['gold', '✨'], ['half', '🏷️½'], ['rush', '🏃'], ['party', '🤪'], ['sprinkle', '🌈']].filter(([k]) => app.fx[k] > now).map(([k, l]) => `${l} ${tm(k)}s`).join(' · ');
    app.cashEl.innerHTML = `<b>🍦 ${fmt(S.cash)}</b><small>${P ? `+${fmt(app.rate)}/${L('s', 'с')} · ${L('in collector', 'в коллекторе')} ${fmt(S.stored)}` : L('Claim a plot to start!', 'Займи участок, чтобы начать!')}</small><small>${S.rb ? `⭐ ${L('Rebirth', 'Перерождение')} ${S.rb} · ×${(1 + 0.5 * S.rb).toFixed(1)}` : ''}</small>${fx ? `<small class="fx">${fx}</small>` : ''}`;
  }
  if ((app._lb = (app._lb || 0) + dt) > 2) { app._lb = 0; drawBoard(app); }
  if ((app._sv = (app._sv || 0) + dt) > 5) { app._sv = 0; save(app); }
  if (P && (app._sync = (app._sync || 0) + dt) > 8) { app._sync = 0; claimMsg(app, P, 'tsync'); }
  if (app.fx.statue > now) { const k = now / 1000; app.statue.position.y = Math.abs(Math.sin(k * 5)) * 3; app.statue.rotation.y += dt * 4; if (Math.random() < dt * 3) popText(app, rnd(-6, 6), rnd(12, 24), rnd(-6, 6), pick(['🍦', '🍨', '🍧', '🎉', 'WHEEE!']), '#fff'); }
  else if (app.statue.position.y || app.statue.rotation.y) { app.statue.position.y = 0; app.statue.rotation.y *= 0.9; if (Math.abs(app.statue.rotation.y) < 0.01) app.statue.rotation.y = 0; }
}
function botTick(app, P, dt) {
  const B = P.bot, av = B.av, dx = B.tx - B.x, dz = B.tz - B.z, d = Math.hypot(dx, dz);
  if (d > 0.1) { const st = Math.min(d, 2.4 * dt); B.x += dx / d * st; B.z += dz / d * st; B.ry = Math.atan2(dx, dz); av.animate(2.4, dt, false); }
  else { av.animate(0, dt, false); if (B.cheer) { B.cheer = 0; av.play(pick(['cheer', 'dance', 'wave'])); } if ((B.wait -= dt) < 0) { B.wait = rnd(2, 6); B.tx = rnd(-12, 12); B.tz = rnd(0.5, 12.5); } }
  botPlace(P);
}
function botPlace(P) { const B = P.bot, [x, z] = P.w(B.x, B.z); B.av.group.position.set(x, 0, z); B.av.group.rotation.y = (B.ry || 0) - P.th; }

// ---------- admin abuse ----------
function onAdmin(a, d, app) {
  const w = app.world, now = nowMs(), S = app.ty;
  if (a === 'tyrain') {
    const v = Math.round(Math.max(500, app.rate * 45) * (1 + 0.5 * S.rb)); S.cash += v; cashPop(app); save(app);
    ui.banner(`💸 ${L('MONEY RAIN!', 'ДЕНЕЖНЫЙ ДОЖДЬ!')} +🍦${fmt(v)}`, 3500); app.sfx('paid'); rain(app, 0x4fbf5f, 6, 'bill');
  }
  if (a === 'ty10x') { app.fx.x10 = now + 60000; ui.banner('🔥 ' + L('10× INCOME for 60 seconds!', 'ДОХОД ×10 на 60 секунд!'), 3500); app.sfx('airhorn'); }
  if (a === 'tygold') { app.fx.gold = now + 45000; ui.banner('✨ ' + L('Every dropper makes GOLDEN scoops (×10)!', 'Все дропперы делают ЗОЛОТЫЕ шарики (×10)!'), 3500); app.sfx('star'); }
  if (a === 'tyfree') {
    ui.banner('🎁 ' + L('Free building for everyone!', 'Бесплатная постройка всем!'), 3000);
    if (app.mine) { const it = avail(app.mine.items).filter(x => x.id !== 'rebirth').sort((x, y) => x.price - y.price)[0]; if (it) buy(app, it.id, true); }
    if (app.hs) app.hs.forEach(s => { if (!s.o) { const it = avail(new Set(s.it)).find(x => x.id !== 'rebirth'); if (it) { s.it.push(it.id); app.dirty = true; } } });
  }
  if (a === 'tyflood') flood(app);
  if (a === 'tyscoop') giantScoop(app);
  if (a === 'tyrobbers') { app.plots.forEach(P => spawnRobber(app, P)); ui.banner('🦹 ' + L('ROBBERS EVERYWHERE! Tag them for cash!', 'ГРАБИТЕЛИ ПОВСЮДУ! Лови их за награду!'), 4000); app.sfx('whistle'); }
  if (a === 'tyrush') { app.fx.rush = now + 40000; ui.banner('🏃 ' + L('CUSTOMER RUSH! Everyone wants ice cream!', 'НАПЛЫВ ПОКУПАТЕЛЕЙ! Все хотят мороженое!'), 3500); app.sfx('cheer'); }
  if (a === 'tyhalf') { app.fx.half = now + 60000; app.btnDirty = true; ui.banner('🏷️ ' + L('EVERYTHING HALF PRICE for 60 seconds!', 'ВСЁ ЗА ПОЛЦЕНЫ на 60 секунд!'), 3500); app.sfx('ding'); setTimeout(() => (app.btnDirty = true), 60100); }
  if (a === 'tyrebirth') {
    ui.banner('🔁 ' + L('ADMIN IS REBIRTHING EVERYONE…', 'АДМИН ПЕРЕРОЖДАЕТ ВСЕХ…'), 2200); app.sfx('drumroll');
    [3, 2, 1].forEach((n, k) => setTimeout(() => { ui.banner(`😱 ${n}…`, 900); app.sfx('countdown'); }, 2200 + k * 1000));
    setTimeout(() => { flash(); app.sfx('airhorn'); confetti(); app.fx.x2 = nowMs() + 45000; ui.banner('🤪 ' + L('JUST KIDDING! Nobody lost anything. Enjoy 2× cash for 45 s!', 'ШУТКА! Никто ничего не потерял. Держи ×2 кэша на 45 с!'), 5000); }, 5200);
  }
  if (a === 'tysprinkle') { app.fx.sprinkle = now + 25000; ui.banner('🌈 ' + L('SPRINKLE STORM! Every scoop is a sprinkle sundae!', 'ШТОРМ ПОСЫПКИ! Все шарики — с посыпкой!'), 3500); rain(app, 0xffffff, 20, 'sprinkle'); app.sfx('whoosh'); }
  if (a === 'typarty') { app.fx.party = now + 25000; ui.banner('🤪 ' + L('The droppers went CRAZY!', 'Дропперы сошли с УМА!'), 3500); app.sfx('laugh'); }
  if (a === 'tystatue') { app.fx.statue = now + 20000; ui.banner('🗽 ' + L('The giant ice cream came alive!', 'Гигантское мороженое ожило!'), 3500); app.sfx('boing'); w.fireworks(8, new THREE.Vector3(0, 0, 0)); }
}
// falling bills or sprinkles around me
function rain(app, color, secs, kind) {
  const w = app.world, n = 160, geo = kind === 'bill' ? new THREE.PlaneGeometry(0.5, 0.25) : new THREE.CapsuleGeometry(0.05, 0.25, 2, 5);
  const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }), n), P = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1), c = new THREE.Color();
  for (let i = 0; i < n; i++) { P.push({ x: rnd(-25, 25), y: rnd(5, 35), z: rnd(-25, 25), r: rnd(0, 6), s: rnd(2, 5) }); if (kind !== 'bill') im.setColorAt(i, c.setHSL(Math.random(), 0.9, 0.6)); }
  im.frustumCulled = false; w.scene.add(im); let life = 0;
  w.updaters.push(dt => { life += dt; const me = w.me.group.position; P.forEach((p, i) => { p.y -= p.s * dt; p.r += dt * 3; if (p.y < 0) p.y += 30; m4.compose(v.set(me.x + p.x, p.y, me.z + p.z), q.setFromEuler(e.set(p.r, p.r * 0.7, 0)), one); im.setMatrixAt(i, m4); }); im.instanceMatrix.needsUpdate = true; if (life > secs) { w.scene.remove(im); im.geometry.dispose(); return true; } });
}
function flood(app) {
  const w = app.world, m = new THREE.Mesh(new THREE.CircleGeometry(150, 48).rotateX(-Math.PI / 2), std(0xffa8cf, { roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.88 }));
  m.position.y = -0.3; w.scene.add(m); let life = 0, sp = 0;
  ui.banner('🌊 ' + L('ICE CREAM FLOOD! Strawberry everywhere!', 'ПОТОП ИЗ МОРОЖЕНОГО! Всё в клубнике!'), 4000); app.sfx('splash');
  w.updaters.push(dt => {
    life += dt; const lv = life < 4 ? -0.3 + life / 4 * 1.2 : life < 18 ? 0.9 + Math.sin(life * 2) * 0.05 : 0.9 - (life - 18) / 6 * 1.2; m.position.y = lv;
    m.material.color.setHSL(0.92 + Math.sin(life * 0.5) * 0.03, 1, 0.82);
    const deep = lv > 0.3 && w.me.group.position.y < lv; w.speedMul = deep ? 0.6 : 1;
    if (deep && (sp -= dt) < 0) { sp = 1.2; app.sfx('splash'); }
    if (life > 24) { w.scene.remove(m); m.geometry.dispose(); w.speedMul = 1; return true; }
  });
}
function giantScoop(app) {
  const w = app.world, a = rnd(0, TAU), x = Math.sin(a) * 18, z = Math.cos(a) * 18, g = new THREE.Group();
  const f = pick([0, 2, 3, 4]), ball = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 24), std(FLAVORS[f], { roughness: 0.4 })); ball.castShadow = true; g.add(ball);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.9, 12, 32).rotateX(Math.PI / 2), ball.material); ring.position.y = -1.8; g.add(ring);
  const ch = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 12), M.red); ch.position.y = 4.2; g.add(ch);
  g.position.set(x, 90, z); w.scene.add(g); let vy = 0, landed = 0, life = 0, licked = false;
  ui.banner('🍨 ' + L('LOOK UP! A giant scoop is falling!', 'СМОТРИ ВВЕРХ! Падает гигантский шарик!'), 3500); app.sfx('whoosh');
  w.updaters.push(dt => {
    life += dt; const me = w.me.group.position;
    if (!landed) { vy -= 30 * dt; g.position.y += vy * dt; if (g.position.y <= 3) { g.position.y = 3; landed = life; app.sfx('crash'); burst(app, x, 1, z, 120); g.scale.set(1.25, 0.6, 1.25); if (Math.hypot(me.x - x, me.z - z) < 14) { w.vel.y = 11; w.onGround = false; } } return false; }
    const k = life - landed; g.scale.y += (0.85 - g.scale.y) * Math.min(1, dt * 6);
    if (k < 0.8) { w.camera.position.x += rnd(-0.4, 0.4); w.camera.position.y += rnd(-0.3, 0.3); }
    if (!licked && Math.hypot(me.x - x, me.z - z) < 6.2) { licked = true; const v = Math.round(Math.max(300, app.rate * 30)); app.ty.cash += v; cashPop(app); ui.banner(`😋 ${L('You licked the giant scoop!', 'Ты лизнул гигантский шарик!')} +🍦${fmt(v)}`, 3000); app.sfx('eat'); }
    if (k > 20) { g.scale.y -= dt * 0.5; g.position.y -= dt * 1.2; if (g.scale.y < 0.05) { w.scene.remove(g); ball.geometry.dispose(); ring.geometry.dispose(); return true; } }
  });
  w.solids.push(app._gs = { x, z, r: 4.6, y0: -2, y1: 2 }); setTimeout(() => { const k = w.solids.indexOf(app._gs); if (k >= 0) w.solids.splice(k, 1); }, 22000);
}
