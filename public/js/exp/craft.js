// ⛏️ Marbly Craft: a blocky island to mine, craft and build on together. Punch trees, craft tools, smelt glass,
// light torches, blow up TNT, bounce on trampolines and climb to the sky island. Every block you change shows up
// for everyone (the host keeps the list for late joiners), and bot builders keep the island busy.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { experience, L, ui, confetti, flash, esc, money } from './core.js';
import { labelSprite } from '../world.js';
import { Coins } from './fun.js';
import { Avatar, SKINS, HAIR_COLORS, CLOTH, PANTS, SHOES, HAIRSTYLES, FACES, TOPS } from '../avatar.js';
import { Voxels, BLOCKS, ITEMS, ID, SOLID, OPAQUE, TL, ATLAS, N, H, Y0, OFF, idx, ci, cj, ck, inb, center, cellOf, icon, blockGeo } from './craft-world.js';

const SEED = 1017, MAXC = 12000, DAY = 600, PICKS = ['pick_diamond', 'pick_iron', 'pick_stone', 'pick_wood'];
const RECIPES = [
  { out: 'planks', n: 4, need: { log: 1 } }, { out: 'stick', n: 4, need: { planks: 2 } }, { out: 'table', n: 1, need: { planks: 4 } },
  { out: 'pick_wood', n: 1, need: { planks: 3, stick: 2 }, st: 'table' }, { out: 'pick_stone', n: 1, need: { stone: 3, stick: 2 }, st: 'table' },
  { out: 'furnace', n: 1, need: { stone: 8 }, st: 'table' }, { out: 'torch', n: 4, need: { coal: 1, stick: 1 } }, { out: 'bricks', n: 4, need: { stone: 4 }, st: 'table' },
  { out: 'glass', n: 1, need: { sand: 1 }, st: 'furnace' }, { out: 'iron', n: 1, need: { iron_ore: 1, coal: 1 }, st: 'furnace' }, { out: 'gold', n: 1, need: { gold_ore: 1, coal: 1 }, st: 'furnace' },
  { out: 'pick_iron', n: 1, need: { iron: 3, stick: 2 }, st: 'table' }, { out: 'pick_diamond', n: 1, need: { diamond: 3, stick: 2 }, st: 'table' },
  { out: 'lamp', n: 1, need: { glass: 1, torch: 2 } }, { out: 'jack', n: 1, need: { pumpkin: 1, torch: 1 } }, { out: 'ladder', n: 3, need: { stick: 4 } },
  { out: 'tnt', n: 1, need: { sand: 4, coal: 2 }, st: 'table' }, { out: 'tramp', n: 1, need: { leaves: 4, planks: 2 }, st: 'table' },
  { out: 'gold_block', n: 1, need: { gold: 4 }, st: 'table' }, { out: 'diamond_block', n: 1, need: { diamond: 4 }, st: 'table' }, { out: 'diamond', n: 4, need: { diamond_block: 1 } },
];
// [id, icon, English, Russian, reward in cents, hint EN, hint RU]
const QUESTS = [
  ['log', '🪵', 'Punch a tree and get a log', 'Добудь бревно из дерева', 15, 'Hold left click (or ⛏) on a tree trunk.', 'Держи левую кнопку (или ⛏) на стволе.'],
  ['planks', '🪚', 'Craft planks', 'Сделай доски', 10, 'Press E (🛠) and craft planks from a log.', 'Нажми E (🛠) и сделай доски из бревна.'],
  ['table', '🛠', 'Craft a crafting table', 'Сделай верстак', 15, '4 planks make a crafting table.', '4 доски = верстак.'],
  ['pick_wood', '⛏', 'Make a wooden pickaxe', 'Сделай деревянную кирку', 20, 'Planks + sticks, at a crafting table.', 'Доски + палки, на верстаке.'],
  ['pick_stone', '⛏', 'Make a stone pickaxe', 'Сделай каменную кирку', 30, 'Dig down to grey stone.', 'Копай вниз до серого камня.'],
  ['furnace', '🔥', 'Build a furnace', 'Построй печь', 25, '8 stone at a crafting table.', '8 камней на верстаке.'],
  ['glass', '🪟', 'Melt sand into glass', 'Расплавь песок в стекло', 30, 'Sand from the beach + a furnace.', 'Песок с пляжа + печь.'],
  ['light', '🔦', 'Place a torch or a lamp', 'Поставь факел или лампу', 15, 'Torches: coal + a stick.', 'Факел: уголь + палка.'],
  ['tower', '🗼', 'Build a tower 5 blocks tall', 'Построй башню из 5 блоков', 40, 'Jump and place a block under your feet!', 'Прыгай и ставь блок под ноги!'],
  ['bounce', '🦘', 'Bounce on a trampoline', 'Прыгни на батуте', 20, 'Leaves + planks make a trampoline.', 'Листва + доски = батут.'],
  ['pick_iron', '⚒️', 'Make an iron pickaxe', 'Сделай железную кирку', 60, 'Smelt iron ore with coal in a furnace.', 'Расплавь железную руду с углём в печи.'],
  ['diamond', '💎', 'Find a diamond', 'Найди алмаз', 100, 'Follow the torches into the mountain cave.', 'Иди по факелам в пещеру в горе.'],
  ['tnt', '💥', 'Blow up TNT', 'Взорви динамит', 40, 'Craft TNT, place it, then hit it and run!', 'Сделай динамит, поставь, ударь и беги!'],
  ['sky', '☁️', 'Reach the sky island', 'Доберись до небесного острова', 60, 'Climb the ladder tower.', 'Залезь по лестнице на башне.'],
  ['gold_block', '🟨', 'Make a gold block', 'Сделай золотой блок', 80, '4 gold ingots at a crafting table.', '4 золотых слитка на верстаке.'],
  ['builder', '🧱', 'Place 50 blocks', 'Поставь 50 блоков', 50, '', ''],
  ['miner', '⛏️', 'Mine 100 blocks', 'Добудь 100 блоков', 50, '', ''],
];
const BOTS = ['Builder Bek', 'Miner Mira', 'Crafty Kai', 'Brick Bota', 'Torch Timur'];
const DIGITS = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rnd = (a, b) => a + Math.random() * (b - a), name = k => L(ITEMS[k].en, ITEMS[k].ru);
let A; // the running game

experience({
  id: 'craft', title: 'Marbly Craft', titleRu: 'Marbly Крафт', icon: '⛏️', spawn: [0, 4, 0], sun: [40, 140], ground: -6, sea: -0.9,
  admin: [
    { a: 'tntrain', icon: '💣', en: 'TNT rain', ru: 'Дождь из динамита' },
    { a: 'diamonds', icon: '💎', en: 'Diamond rain', ru: 'Алмазный дождь' },
    { a: 'fullinv', icon: '🎒', en: 'Everyone gets 64 of everything', ru: 'Всем по 64 всего' },
    { a: 'flood', icon: '🌊', en: 'The flood (water rises)', ru: 'Потоп (вода поднимается)' },
    { a: 'pyramid', icon: '🔺', en: 'Instant pyramid', ru: 'Пирамида за секунду' },
    { a: 'statue', icon: '🗿', en: 'Giant statue', ru: 'Гигантская статуя' },
    { a: 'gold', icon: '🟨', en: 'Midas touch: island turns gold', ru: 'Золотой остров' },
    { a: 'meteor', icon: '☄️', en: 'Meteor strike', ru: 'Падение метеорита' },
    { a: 'ice', icon: '🧊', en: 'Ice age (walk on the sea)', ru: 'Ледниковый период' },
    { a: 'lava', icon: '🌋', en: 'Lava pools', ru: 'Лужи лавы' },
    { a: 'creative', icon: '✨', en: 'Creative mode for 60 s', ru: 'Творческий режим на 60 с' },
    { a: 'megatnt', icon: '🧨', en: 'MEGA TNT', ru: 'МЕГА-динамит' },
    { a: 'botparty', icon: '🤖', en: 'Bot build party', ru: 'Стройка ботов' },
    { a: 'night', icon: '🌙', en: 'Instant night', ru: 'Мгновенная ночь' },
    { a: 'sheep', icon: '🐑', en: 'Sheep stampede', ru: 'Нашествие овец' },
    { a: 'reset', icon: '🔄', en: 'Reset the world', ru: 'Сбросить мир' },
  ],
  build, frame, onAdmin, started, onPlayers,
});

// ---------- build ----------
function build(app) {
  A = app; const w = app.world, S = w.scene;
  Object.assign(app, { inv: {}, bar: Array(9).fill(null), sel: 0, done: new Set(), stats: { mined: 0, placed: 0 }, mine: { c: -1, t: 0 }, out: [], recent: new Map(), fuses: new Map(), myFuses: new Set(), falls: [], parts: [], fxs: [], shake: 0, fp: false, creativeUntil: 0, nightUntil: 0, frozenUntil: 0, partyUntil: 0, flood: null, swingT: 0, warned: 0 });
  S.fog.density = 0.0035; w.dist = 5.5; w.pitch = 0.35;
  const vx = app.vx = new Voxels(w, SEED);
  setSpawn(app);
  // walk on the blocks; block walls stop you; the frozen sea holds you during the ice age
  w.grounds.push((x, z, y) => vx.ground(x, z, y));
  w.grounds.push((x, z, y) => (app.frozenUntil > Date.now() && y > -1.6 ? -0.85 : null));
  w.constrain = (nx, nz) => {
    const p = w.me.group.position; if (blocked(p.x, p.z, p.y)) return [nx, nz];
    if (!blocked(nx, nz, p.y)) return [nx, nz]; if (!blocked(nx, p.z, p.y)) return [nx, p.z]; if (!blocked(p.x, nz, p.y)) return [p.x, nz]; return [p.x, p.z];
  };
  w.cameraOverride = (cam, dt) => camera(app, cam, dt);
  S.add(w.camera);
  // the target outline and the cracks while mining
  app.outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(1.005, 1.005, 1.005)), new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.7 })); app.outline.visible = false; S.add(app.outline);
  app.crack = new THREE.Mesh(new THREE.BoxGeometry(1.012, 1.012, 1.012), new THREE.MeshBasicMaterial({ map: ATLAS.cracks[0], transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })); app.crack.visible = false; S.add(app.crack);
  // debris particles (one draw call)
  app.deb = new THREE.InstancedMesh(new THREE.BoxGeometry(0.14, 0.14, 0.14), new THREE.MeshLambertMaterial(), 500); app.deb.count = 0; app.deb.frustumCulled = false; app.deb.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(1500), 3); S.add(app.deb);
  skySetup(app); hand(app); animals(app); bots(app);
  // labels that help you find things
  const lab = (t, x, y, z, bg) => { const s = labelSprite(t, 0.6, { bg, weight: 800 }); s.position.set(x, y, z); S.add(s); return s; };
  const I = vx.info; app.labels = [lab('💎 ' + L('Cave', 'Пещера'), I.cave[0], vx.ground(I.cave[0], I.cave[1], 99) + 3, I.cave[1], 'rgba(40,40,60,0.85)'), lab('☁️ ' + L('Sky island ↑', 'Небесный остров ↑'), I.ladder[0], 9, I.ladder[1], 'rgba(40,110,200,0.9)')];
  // coins: gold bars on the sky island, coins on hill tops
  app.coins = new Coins(app, { respawn: 60 });
  for (let k = 0; k < 3; k++) app.coins.add(I.sky[0] - 1.5 + k * 1.5, I.sky[1] + 1, I.sky[2] + 2, 40, true);
  for (let k = 0; k < 16; k++) { const a = k / 16 * 6.28, r = 8 + (k % 4) * 4, x = Math.cos(a) * r + 0.5, z = Math.sin(a) * r + 0.5, g = vx.ground(x, z, 99); if (g !== null && g > 0) app.coins.add(x, g + 1, z, 5); }
  load(app); ui$(app); input(app); net(app);
  app.api = { breakBlock, place, gain, spend, openCraft, openQuests, explode, ignite, quest, change, pushState, toSpawn, aim }; // handy for tests
}
function setSpawn(app) { const I = app.vx.info, dx = I.cave[0] - I.spawn[0], dz = I.cave[1] - I.spawn[1]; app.def.spawn = [I.spawn[0], I.spawn[1], Math.atan2(-dx, -dz)]; }
function toSpawn(app) { const s = app.def.spawn; app.world.teleport(s[0], s[1], s[2]); }
// is the body (feet + 0.45 up to the head) inside a solid block?
function blocked(x, z, y) {
  const vx = A.vx, r = 0.3;
  for (let i = Math.floor(x - r + OFF); i <= Math.floor(x + r + OFF); i++) for (let j = Math.floor(z - r + OFF); j <= Math.floor(z + r + OFF); j++) for (let k = Math.floor(y + 0.45 - Y0); k <= Math.floor(y + 1.8 - Y0); k++) if (inb(i, k, j) && SOLID[vx.vox[idx(i, k, j)]]) return true;
  return false;
}
function started(app) {
  ui.banner('⛏️ ' + L('Welcome to Marbly Craft! Hold left click (or ⛏) on a tree to get logs, then press E to craft.', 'Добро пожаловать в Marbly Крафт! Держи левую кнопку (или ⛏) на дереве, потом нажми E для крафта.'), 6500);
  app.emit('creq', { pid: app.me.pid });
}

// ---------- the camera: over the shoulder (crosshair in the middle) or first person ----------
const lookPitch = w => clamp(-(w.pitch * 1.25 - 0.1), -1.45, 0.62);
function camera(app, cam, dt) {
  const w = app.world, p = w.me.group.position, s = w.me.group.scale.x, lp = lookPitch(w), y = w.yaw;
  const f = new THREE.Vector3(-Math.sin(y) * Math.cos(lp), Math.sin(lp), -Math.cos(y) * Math.cos(lp)), head = new THREE.Vector3(p.x, p.y + 1.62 * s, p.z);
  w.me.group.visible = !app.fp; app.fpHand.visible = app.fp;
  if (app.fp) cam.position.copy(head);
  else {
    const piv = head.clone().add(new THREE.Vector3(Math.cos(y) * 0.6 * s, 0.25 * s, -Math.sin(y) * 0.6 * s)), back = f.clone().negate();
    let d = w.dist * (0.8 + s * 0.2); const hit = app.vx.ray(piv, back, d + 0.4, OPAQUE); if (hit) d = Math.max(0.3, hit.t - 0.35);
    app.camD = app.camD === undefined || d < app.camD ? d : app.camD + (d - app.camD) * Math.min(1, dt * 6);
    cam.position.copy(piv).addScaledVector(back, app.camD);
  }
  if (app.shake > 0.01) { cam.position.x += (Math.random() - 0.5) * app.shake; cam.position.y += (Math.random() - 0.5) * app.shake; app.shake *= Math.pow(0.02, dt); }
  cam.lookAt(cam.position.clone().add(f));
  app.aimO = cam.position.clone(); app.aimD = f; app.head = head;
}

// ---------- your stuff (saved on this device) ----------
function load(app) {
  try { const s = JSON.parse(localStorage.getItem('marbly_craft') || '{}'); app.inv = s.inv || {}; app.bar = s.bar || app.bar; app.sel = s.sel || 0; app.done = new Set(s.q || []); app.stats = s.st || app.stats; } catch (e) {}
  for (const k in app.inv) if (!ITEMS[k] || !(app.inv[k] > 0)) delete app.inv[k];
  app.bar = app.bar.map(k => (k && app.inv[k] > 0 ? k : null));
}
function save(app) { clearTimeout(app._sv); app._sv = setTimeout(() => { try { localStorage.setItem('marbly_craft', JSON.stringify({ inv: app.inv, bar: app.bar, sel: app.sel, q: [...app.done], st: app.stats })); } catch (e) {} }, 800); }
const creative = app => app.creativeUntil > Date.now();
function gain(app, k, n = 1, quiet, noQuest) {
  if (!ITEMS[k]) return; app.inv[k] = (app.inv[k] || 0) + n;
  if (ITEMS[k].block && !app.bar.includes(k)) { const e = app.bar.indexOf(null); if (e >= 0) app.bar[e] = k; }
  if (!quiet) pickup(app, `+${n} <img src="${icon(k)}"> ${esc(name(k))}`);
  if (!noQuest && k === 'log') quest(app, 'log'); if (!noQuest && (k === 'diamond' || k === 'diamond_block')) quest(app, 'diamond');
  renderBar(app); save(app);
}
function spend(app, k, n = 1) { app.inv[k] = Math.max(0, (app.inv[k] || 0) - n); if (!app.inv[k]) { delete app.inv[k]; app.bar = app.bar.map(b => (b === k ? null : b)); } renderBar(app); save(app); }
function bestPick(app) { return PICKS.find(k => app.inv[k] > 0); }
function quest(app, id) {
  if (app.done.has(id)) return; const q = QUESTS.find(x => x[0] === id); if (!q) return;
  app.done.add(id); save(app); app.coins.bonus(q[4]);
  ui.banner(`🏆 ${L('Quest done', 'Задание выполнено')}: ${q[1]} ${L(q[2], q[3])} · +${money(q[4])}`, 4000); app.sfx('star'); confetti(50); renderQuest(app);
}

// ---------- HUD: crosshair, hotbar, buttons, quest tracker ----------
function ui$(app) {
  const touch = matchMedia('(pointer: coarse)').matches; if (touch) document.body.classList.add('cr-touch');
  document.body.insertAdjacentHTML('beforeend', `<div class="cr-cross" id="crCross"></div><div class="cr-bar" id="crBar"></div><div class="cr-pick" id="crPick"></div>
    <div class="cr-quest" id="crQuest"></div><div class="cr-side"><button id="crCraft" title="${L('Crafting', 'Крафт')} (E)">🛠<small>E</small></button><button id="crQuests" title="${L('Quests', 'Задания')} (Q)">📜<small>Q</small></button><button id="crView" title="${L('Camera', 'Камера')} (V)">👁<small>V</small></button></div>
    <button class="x-act${touch ? '' : ' hidden'}" id="crMine">⛏<small>${L('Mine', 'Копать')}</small></button><button class="x-act x-act2${touch ? '' : ' hidden'}" id="crPlace">🧱<small>${L('Place', 'Ставить')}</small></button>
    <div class="o-timer hidden" id="crMode"></div>`);
  const $ = s => document.querySelector(s);
  $('#crCraft').onclick = () => openCraft(app); $('#crQuests').onclick = () => openQuests(app); $('#crView').onclick = () => toggleView(app); $('#crQuest').onclick = () => openQuests(app);
  const hold = (el, on, off) => { el.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); on(); }); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) el.addEventListener(ev, off); };
  hold($('#crMine'), () => (app.mining = true), () => (app.mining = false));
  hold($('#crPlace'), () => { app.placing = true; app.placeT = 0; place(app); }, () => (app.placing = false));
  const j = $('#xJump'); if (j) { j.addEventListener('pointerdown', () => (app.jumpHeld = true)); for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) j.addEventListener(ev, () => (app.jumpHeld = false)); }
  renderBar(app); renderQuest(app);
}
function renderBar(app) {
  const el = document.querySelector('#crBar'); if (!el) return;
  el.innerHTML = app.bar.map((k, i) => `<button class="cr-slot${i === app.sel ? ' on' : ''}" data-s="${i}"><i>${i + 1}</i>${k ? `<img src="${icon(k)}" alt=""><b>${creative(app) ? '∞' : app.inv[k] || 0}</b>` : ''}</button>`).join('');
  el.querySelectorAll('[data-s]').forEach(b => b.onclick = e => { e.stopPropagation(); select(app, +b.dataset.s); });
  heldItem(app);
}
function select(app, i) { app.sel = i; renderBar(app); save(app); const k = app.bar[i]; if (k) pickup(app, `<img src="${icon(k)}"> ${esc(name(k))}`); app.sfx('click'); }
function pickup(app, html) { const p = document.querySelector('#crPick'); p.innerHTML = html; p.style.opacity = 1; clearTimeout(app._pk); app._pk = setTimeout(() => (p.style.opacity = 0), 1400); }
function renderQuest(app) {
  const q = QUESTS.find(x => !app.done.has(x[0])), el = document.querySelector('#crQuest'); if (!el) return;
  el.innerHTML = q ? `📜 <b>${q[1]} ${esc(L(q[2], q[3]))}</b> <span class="cr-gold">+${money(q[4])}</span>${q[5] ? `<small>${esc(L(q[5], q[6]))}</small>` : ''}` : `🏆 <b>${L('All quests done! You are a master crafter.', 'Все задания выполнены! Ты мастер крафта.')}</b>`;
}
function toggleView(app) { app.fp = !app.fp; app.sfx('click'); ui.toast(app.fp ? '👁 ' + L('First person', 'От первого лица') : '👁 ' + L('Third person', 'От третьего лица')); }

// ---------- crafting and quests panels ----------
function near(app, v, r = 5) {
  const p = app.world.me.group.position, c0 = cellOf(p.x, p.y + 1, p.z); if (c0 < 0) return false;
  const i0 = ci(c0), k0 = ck(c0), j0 = cj(c0);
  for (let k = k0 - r; k <= k0 + r; k++) for (let j = j0 - r; j <= j0 + r; j++) for (let i = i0 - r; i <= i0 + r; i++) if (inb(i, k, j) && app.vx.vox[idx(i, k, j)] === v) return true;
  return false;
}
function openCraft(app) {
  app.panel = 'craft';
  const st = { table: app.inv.table > 0 || near(app, ID.table), furnace: app.inv.furnace > 0 || near(app, ID.furnace) };
  const can = r => (!r.st || st[r.st]) && Object.entries(r.need).every(([k, n]) => (app.inv[k] || 0) >= n);
  const keys = Object.keys(ITEMS).filter(k => app.inv[k] > 0);
  const b = ui.modal('🛠 ' + L('Inventory & crafting', 'Инвентарь и крафт'), `<div class="cr-panel">
    <p class="muted">${L('Tap a block to put it in your selected hotbar slot. Pickaxes work by themselves: the best one is always used.', 'Нажми на блок, чтобы положить его в выбранную ячейку. Кирки работают сами: всегда берётся лучшая.')}</p>
    <div class="cr-inv">${keys.length ? keys.map(k => `<button class="cr-it${ITEMS[k].block ? '' : ' tool'}" data-k="${k}" title="${esc(name(k))}"><img src="${icon(k)}" alt=""><b>${app.inv[k]}</b><span>${esc(name(k))}</span></button>`).join('') : `<p class="muted">${L('Empty. Go punch a tree! 🌳', 'Пусто. Иди ударь дерево! 🌳')}</p>`}</div>
    <div class="cr-st"><span class="${st.table ? 'ok' : ''}">🛠 ${L('Crafting table', 'Верстак')} ${st.table ? '✅' : '❌'}</span><span class="${st.furnace ? 'ok' : ''}">🔥 ${L('Furnace', 'Печь')} ${st.furnace ? '✅' : '❌'}</span><small class="muted">${L('Carry one, or stand near a placed one.', 'Носи с собой или стой рядом с поставленным.')}</small></div>
    <div class="cr-recs">${RECIPES.map((r, i) => `<button class="cr-rec${can(r) ? '' : ' off'}" data-r="${i}"><span class="cr-out"><img src="${icon(r.out)}" alt="">${r.n > 1 ? `<b>×${r.n}</b>` : ''}</span><span class="cr-name">${esc(name(r.out))}${r.st ? ` <em>${r.st === 'table' ? '🛠' : '🔥'}</em>` : ''}<span class="cr-need">${Object.entries(r.need).map(([k, n]) => `<span class="${(app.inv[k] || 0) >= n ? '' : 'miss'}"><img src="${icon(k)}" alt="">${n}</span>`).join('')}</span></span></button>`).join('')}</div></div>`);
  b.querySelectorAll('[data-r]').forEach(el => el.onclick = () => {
    const r = RECIPES[+el.dataset.r]; if (!can(r)) { app.sfx('wrong'); return; }
    for (const [k, n] of Object.entries(r.need)) spend(app, k, n);
    gain(app, r.out, r.n, true); app.sfx('ding'); quest(app, r.out); openCraft(app);
  });
  b.querySelectorAll('[data-k]').forEach(el => el.onclick = () => { const k = el.dataset.k; if (!ITEMS[k].block) return; app.bar = app.bar.map(x => (x === k ? null : x)); app.bar[app.sel] = k; renderBar(app); save(app); app.sfx('click'); openCraft(app); });
}
function openQuests(app) {
  app.panel = 'quests';
  const left = QUESTS.filter(q => !app.done.has(q[0])).reduce((s, q) => s + q[4], 0);
  ui.modal('📜 ' + L('Quests', 'Задания'), `<div class="cr-qs">${QUESTS.map(q => `<div class="cr-q${app.done.has(q[0]) ? ' done' : ''}"><span>${app.done.has(q[0]) ? '✅' : q[1]}</span><div><b>${esc(L(q[2], q[3]))}</b>${q[5] ? `<small>${esc(L(q[5], q[6]))}</small>` : ''}</div><em>+${money(q[4])}</em></div>`).join('')}</div>
    <p class="muted small">${L('Still to earn', 'Ещё можно заработать')}: <b>${money(left)}</b> · ${L('Mined', 'Добыто')}: ${app.stats.mined} · ${L('Placed', 'Поставлено')}: ${app.stats.placed}</p>
    <p class="muted small">🖱 ${L('Left click: mine · Right click: place · 1–9 / wheel: hotbar · Shift+wheel: zoom · E: crafting · V: camera · drag: look around', 'Левая кнопка: копать · Правая: ставить · 1–9 / колесо: ячейки · Shift+колесо: зум · E: крафт · V: камера · тяни: обзор')}</p>`);
}

// ---------- input ----------
function input(app) {
  const w = app.world, cv = w.renderer.domElement, modal = () => !document.querySelector('#xModal').classList.contains('hidden');
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.code === 'KeyE' || e.code === 'KeyQ') { if (modal()) { if (app.panel) { ui.close(); app.panel = null; } } else if (!w.inputLocked) (e.code === 'KeyE' ? openCraft : openQuests)(app); return; }
    if (w.inputLocked || modal()) return;
    const n = DIGITS.indexOf(e.code); if (n >= 0) { e.stopImmediatePropagation(); select(app, n); return; }
    if (e.code === 'KeyV') toggleView(app);
    if (e.code === 'Minus' || e.code === 'Equal') w.dist = clamp(w.dist + (e.code === 'Minus' ? 1 : -1), 2.5, 12);
  }, true);
  addEventListener('wheel', e => {
    if (e.target !== cv) return; e.stopImmediatePropagation();
    if (e.shiftKey || e.altKey) { w.dist = clamp(w.dist + (e.deltaY || e.deltaX) * 0.008, 2.5, 12); return; }
    app.wheel = (app.wheel || 0) + e.deltaY; if (Math.abs(app.wheel) >= 40) { select(app, (app.sel + Math.sign(app.wheel) + 9) % 9); app.wheel = 0; }
  }, { capture: true, passive: true });
  cv.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; if (e.button === 0) app.mining = true; if (e.button === 2) { app.placing = true; app.placeT = 0; place(app); } });
  addEventListener('pointerup', e => { if (e.pointerType !== 'mouse') return; if (e.button === 0) app.mining = false; if (e.button === 2) app.placing = false; });
  addEventListener('blur', () => { app.mining = app.placing = false; });
  cv.addEventListener('contextmenu', e => e.preventDefault());
  app.extraPos = () => ({ mi: app.mining && app.target ? 1 : 0 });
}

// ---------- mining and placing ----------
function aim(app) {
  const w = app.world; app.target = null; if (!app.aimO || w.inputLocked) return;
  const reach = creative(app) ? 9 : 5.5, hit = app.vx.ray(app.aimO, app.aimD, (app.fp ? 0 : app.camD || 0) + reach + 1);
  if (hit) { const [x, y, z] = center(hit.c); if (Math.hypot(x - app.head.x, y - app.head.y, z - app.head.z) <= reach + 0.5) app.target = hit; }
}
function mineTick(app, dt) {
  const t = app.target, vx = app.vx;
  if (!app.mining || !t || app.world.inputLocked) { app.mine.t = Math.max(0, app.mine.t - dt * 3); app.crack.visible = false; return; }
  if (app.mine.c !== t.c) app.mine = { c: t.c, t: 0 };
  const v = vx.vox[t.c], B = BLOCKS[v]; app.swingT = 0.3;
  if (v === ID.tnt) { app.mining = false; ignite(app, t.c, true); return; }
  if (B.hard === Infinity) { if (app.warned !== t.c) { app.warned = t.c; ui.toast('🪨 ' + L('Bedrock is unbreakable!', 'Бедрок не сломать!')); } return; }
  const pk = bestPick(app), tier = pk ? ITEMS[pk].tier : 0, mult = pk ? ITEMS[pk].mult : 1;
  if ((B.tier || 0) > tier && !creative(app)) { if (app.warned !== t.c) { app.warned = t.c; ui.toast(`⛏ ${L('You need', 'Нужна')} ${name(B.tier >= 3 ? 'pick_iron' : 'pick_stone')} ${L('for', 'для:')} ${L(B.en, B.ru)}`); app.sfx('bonk'); } return; }
  app.mine.t += dt * (creative(app) ? 40 : B.rock ? mult : 1 + (mult - 1) * 0.45);
  if ((app._hit = (app._hit || 0) + dt) > 0.28) { app._hit = 0; app.sfx('click'); debris(app, t.c, 2); }
  const k = app.mine.t / Math.max(0.05, B.hard);
  app.crack.visible = k > 0.05; app.crack.position.set(...center(t.c)); app.crack.material.map = ATLAS.cracks[Math.min(7, Math.floor(k * 8))];
  if (k >= 1) { breakBlock(app, t.c); app.mine = { c: -1, t: 0 }; app.crack.visible = false; }
}
function breakBlock(app, c) {
  const vx = app.vx, v = vx.vox[c], B = BLOCKS[v]; if (!v) return;
  change(app, c, 0); debris(app, c, 14); app.sfx('pop');
  if (!creative(app)) gain(app, B.drop || B.k);
  if (B.k === 'gold_ore' || B.k === 'diamond_ore') app.coins.bonus(B.k === 'gold_ore' ? 2 : 5, false);
  const up = c + N * N; if (ck(c) < H - 1 && (vx.vox[up] === ID.torch)) { change(app, up, 0); if (!creative(app)) gain(app, 'torch'); }
  app.stats.mined++; if (app.stats.mined >= 100) quest(app, 'miner'); save(app);
}
function place(app) {
  const t = app.target, vx = app.vx, w = app.world; if (!t || w.inputLocked) return;
  const tv = vx.vox[t.c];
  if ((tv === ID.table || tv === ID.furnace) && !app.placing2) { app.placing = false; openCraft(app); return; }
  const k = app.bar[app.sel]; if (!k || !(app.inv[k] > 0 || creative(app))) { if (Date.now() - (app._nb || 0) > 2500) { app._nb = Date.now(); ui.toast('🧱 ' + L('Pick a block for your hotbar (E)', 'Выбери блок для панели (E)')); } return; }
  const v = ITEMS[k].block, i = ci(t.c) + t.n[0], kk = ck(t.c) + t.n[1], j = cj(t.c) + t.n[2]; if (!v || !inb(i, kk, j)) return;
  const c = idx(i, kk, j), cur = vx.vox[c]; if (cur && cur !== ID.water && cur !== ID.lava) return;
  if (SOLID[v]) { const p = w.me.group.position, x0 = i - OFF, y0 = kk + Y0, z0 = j - OFF; if (p.x + 0.3 > x0 && p.x - 0.3 < x0 + 1 && p.z + 0.3 > z0 && p.z - 0.3 < z0 + 1 && p.y + 1.8 > y0 && p.y + 0.02 < y0 + 1) return; }
  change(app, c, v); app.sfx('place'); app.swingT = 0.25;
  if (!creative(app)) spend(app, k);
  app.stats.placed++; if (app.stats.placed >= 50) quest(app, 'builder');
  if (k === 'torch' || k === 'lamp' || k === 'jack') quest(app, 'light');
  let n = 1; for (let q = c - N * N; q >= 0 && n < 5 && SOLID[vx.vox[q]] && vx.changes.has(q) && vx.base[q] === 0; q -= N * N) n++; if (n >= 5) quest(app, 'tower');
  save(app);
}

// ---------- the shared world: changes go out in small batches, the host keeps the full list ----------
function change(app, c, v, send = true) {
  if (!app.vx.set(c, v)) return;
  if (send) { app.recent.set(c, Date.now()); app.out.push(c, v); }
  app.dirty = true;
}
function net(app) {
  const vx = app.vx;
  setInterval(() => { if (app.out.length) { app.emit('cb', { c: app.out, g: vx.gen }); app.out = []; } }, 250);
  setInterval(() => { if (app.isHost() && (app.dirty || Date.now() - (app._pushed || 0) > 30000)) pushState(app); }, 2000);
  app.net.onState('blocks', s => applyState(app, s));
  app.onEvent(ev => {
    const d = ev.data || {}; if (ev.from === app.me.pid && !ev.trusted) return;
    if (ev.type === 'cb' && d.g === vx.gen && d.c) for (let k = 0; k + 1 < d.c.length; k += 2) change(app, d.c[k], d.c[k + 1], false);
    if (ev.type === 'creq' && app.isHost()) setTimeout(() => pushState(app), 300);
    if (ev.type === 'cfuse' && d.g === vx.gen) fuse(app, d.c, d.t);
    if (ev.type === 'boom' && d.g === vx.gen) boom(app, d);
    if (ev.type === 'cfall' && d.g === vx.gen) d.f.forEach(f => fall(app, ...f));
    if (ev.type === 'cbots' && !app.isHost()) botsIn(app, d);
  });
}
function onPlayers(app) {
  const ids = Object.keys(app.players).sort().join(); if (ids === app._ids) return;
  const grew = Object.keys(app.players).some(id => !(app._known || new Set()).has(id)); app._ids = ids; app._known = new Set(Object.keys(app.players));
  if (grew && app.isHost()) setTimeout(() => pushState(app), 600);
}
function pushState(app) {
  const vx = app.vx; app.dirty = false; app._pushed = Date.now();
  // keep it bounded: the oldest changes fade back to the original island
  if (vx.changes.size > MAXC) { const old = [...vx.changes.keys()].slice(0, vx.changes.size - MAXC); old.forEach(c => change(app, c, vx.base[c])); app.dirty = false; }
  app.net.setState('blocks', { g: vx.gen, seed: vx.seed, d: vx.encode(MAXC) });
}
function applyState(app, s) {
  if (!s || typeof s.d !== 'string') return; const vx = app.vx, now = Date.now();
  if (s.g !== vx.gen || s.seed !== vx.seed) newWorld(app, s.seed, s.g);
  const m = Voxels.decode(s.d), fresh = c => now - (app.recent.get(c) || 0) < 5000;
  for (const [c, v] of m) if (vx.vox[c] !== v && !fresh(c)) change(app, c, v, false);
  for (const c of [...vx.changes.keys()]) if (!m.has(c) && !fresh(c)) change(app, c, vx.base[c], false);
  app.dirty = false;
}
function newWorld(app, seed, gen) {
  const vx = app.vx; vx.load(seed, gen); app.recent.clear(); app.out = [];
  app.fuses.forEach(f => app.world.scene.remove(f.m)); app.fuses.clear(); setSpawn(app); toSpawn(app);
  app.botList.forEach(b => { b.x = app.def.spawn[0] + rnd(-4, 4); b.z = app.def.spawn[1] + rnd(-4, 4); b.y = vx.ground(b.x, b.z, 99) ?? 2; b.mode = 'idle'; b.t = 1; b.cells = []; });
}

// ---------- TNT, explosions and things falling from the sky ----------
function ignite(app, c, mine) {
  if (app.fuses.has(c)) return; if (mine) app.myFuses.add(c);
  fuse(app, c, 2.6); app.emit('cfuse', { c, t: 2.6, g: app.vx.gen });
  ui.toast('💥 ' + L('TNT lit! Run!', 'Динамит горит! Беги!'));
}
function fuse(app, c, t = 2.6) {
  if (app.fuses.has(c)) return;
  const m = new THREE.Mesh(new THREE.BoxGeometry(1.03, 1.03, 1.03), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })); m.position.set(...center(c)); app.world.scene.add(m);
  app.fuses.set(c, { t, m }); app.sfx('beep');
}
function fuseTick(app, dt) {
  for (const [c, f] of app.fuses) {
    f.t -= dt; f.m.material.opacity = Math.sin(f.t * 22) > 0 ? 0.65 : 0; f.m.scale.setScalar(1 + Math.max(0, 0.6 - f.t) * 0.25);
    if (f.t <= 0 || app.vx.vox[c] !== ID.tnt) { app.world.scene.remove(f.m); app.fuses.delete(c); if (f.t <= 0 && app.vx.vox[c] === ID.tnt && app.isHost()) explode(app, c, 3.4); }
  }
}
// the host decides what an explosion removes and tells everyone
function explode(app, c, r) {
  const vx = app.vx, i0 = ci(c), k0 = ck(c), j0 = cj(c), R = Math.ceil(r + 1), cells = [];
  for (let k = k0 - R; k <= k0 + R; k++) for (let j = j0 - R; j <= j0 + R; j++) for (let i = i0 - R; i <= i0 + R; i++) {
    if (!inb(i, k, j)) continue; const q = idx(i, k, j), v = vx.vox[q], d = Math.hypot(i - i0, (k - k0) * 1.15, j - j0);
    if (!v || v === ID.bedrock || d > r + Math.random() * 0.8) continue;
    if (v === ID.tnt && q !== c) { setTimeout(() => { fuse(app, q, 0.5); app.emit('cfuse', { c: q, t: 0.5, g: vx.gen }); }, 100 + Math.random() * 300); continue; }
    cells.push(q);
  }
  const d = { c, r, x: cells, g: vx.gen }; app.emit('boom', d); boom(app, d);
}
function boom(app, d) {
  const vx = app.vx, w = app.world, [x, y, z] = center(d.c), pos = new THREE.Vector3(x, y, z);
  const sample = d.x.filter((_, i) => i % Math.max(1, Math.floor(d.x.length / 40)) === 0);
  sample.forEach(q => debris(app, q, 3, 9));
  d.x.forEach(q => change(app, q, 0, false));
  if (app.myFuses.has(d.c)) { app.myFuses.delete(d.c); quest(app, 'tnt'); }
  // fire ball, smoke and a shock wave
  burst(app, pos, d.r);
  const dist = pos.distanceTo(w.me.group.position);
  app.sfx('crash'); setTimeout(() => app.sfx('firework'), 80);
  if (dist < 30) { app.shake = Math.max(app.shake, (1 - dist / 30) * (0.5 + d.r * 0.08)); if (dist < 14) flash(); }
  if (dist < d.r + 3) { const p = w.me.group.position, k = (1 - dist / (d.r + 3)) * 14; w.vel.x += (p.x - x) / Math.max(1, dist) * k; w.vel.z += (p.z - z) / Math.max(1, dist) * k; w.vel.y = 7 + k * 0.6; w.onGround = false; }
}
function burst(app, pos, r) {
  const S = app.world.scene, n = 70 + r * 25, g = new THREE.BufferGeometry(), P = new Float32Array(n * 3), C = new Float32Array(n * 3), V = [];
  for (let i = 0; i < n; i++) { P.set([pos.x, pos.y, pos.z], i * 3); V.push(new THREE.Vector3().randomDirection().multiplyScalar(rnd(2, 6) * (0.6 + r * 0.18))); const c = new THREE.Color().setHSL(rnd(0.02, 0.12), 1, rnd(0.5, 0.7)); C.set([c.r * 2, c.g * 2, c.b * 2], i * 3); }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const fire = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.9 + r * 0.12, map: dot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })); S.add(fire);
  const wave = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.5, depthWrite: false })); wave.position.copy(pos); S.add(wave);
  const sm = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(P.slice(), 3)), new THREE.PointsMaterial({ size: 2.2 + r * 0.2, map: dot(), color: 0x6a6a6a, transparent: true, opacity: 0.6, depthWrite: false })); S.add(sm);
  const SV = V.map(v => v.clone().multiplyScalar(0.35).add(new THREE.Vector3(0, 1.2, 0)));
  app.fxs.push({ life: 0, tick(dt) {
    this.life += dt; const a = g.attributes.position, b = sm.geometry.attributes.position;
    for (let i = 0; i < n; i++) { V[i].multiplyScalar(Math.pow(0.08, dt)); a.setXYZ(i, a.getX(i) + V[i].x * dt, a.getY(i) + V[i].y * dt, a.getZ(i) + V[i].z * dt); b.setXYZ(i, b.getX(i) + SV[i].x * dt, b.getY(i) + SV[i].y * dt, b.getZ(i) + SV[i].z * dt); }
    a.needsUpdate = b.needsUpdate = true; fire.material.opacity = Math.max(0, 1 - this.life / 0.9); sm.material.opacity = Math.max(0, 0.6 - this.life / 4);
    wave.scale.setScalar(1 + this.life * r * 5); wave.material.opacity = Math.max(0, 0.5 - this.life * 1.4);
    if (this.life > 2.6) { [fire, wave, sm].forEach(o => { S.remove(o); o.geometry.dispose(); o.material.dispose(); }); return true; }
  } });
}
let DOT; function dot() { if (DOT) return DOT; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return (DOT = new THREE.CanvasTexture(c)); }
// little cubes flying off a block
function debris(app, c, n, sp = 3) {
  const v = app.vx.vox[c] || ID.stone, col = ATLAS.avg[TL[v][1]], [x, y, z] = center(c);
  for (let i = 0; i < n && app.parts.length < 500; i++) app.parts.push({ x: x + rnd(-0.4, 0.4), y: y + rnd(-0.4, 0.4), z: z + rnd(-0.4, 0.4), vx: rnd(-1, 1) * sp, vy: rnd(1, 3) * sp * 0.6, vz: rnd(-1, 1) * sp, life: rnd(0.5, 1.1), col, s: rnd(0.6, 1.3) });
}
function partsTick(app, dt) {
  const m = app.deb, M = new THREE.Matrix4(); let n = 0;
  app.parts = app.parts.filter(p => (p.life -= dt) > 0);
  for (const p of app.parts) { p.vy -= 20 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; if (app.vx.solid(p.x, p.y, p.z)) { p.vy = Math.abs(p.vy) * 0.3; p.vx *= 0.5; p.vz *= 0.5; p.y += 0.05; } const s = p.s * Math.min(1, p.life * 3); M.makeScale(s, s, s).setPosition(p.x, p.y, p.z); m.setMatrixAt(n, M); m.setColorAt(n, p.col); n++; }
  m.count = n; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
  app.fxs = app.fxs.filter(f => !f.tick(dt));
}
// kind: tnt, dia, meteor, mega. Everyone sees it fall; the host decides what happens when it lands.
function fall(app, x, z, kind) {
  const S = app.world.scene, mega = kind === 'mega', met = kind === 'meteor';
  let m;
  if (met) { m = new THREE.Mesh(new THREE.IcosahedronGeometry(1.6, 1), new THREE.MeshStandardMaterial({ color: 0x3a2a20, emissive: 0xff5a10, emissiveIntensity: 2.2, flatShading: true })); }
  else { m = new THREE.Mesh(blockGeo(kind === 'dia' ? ID.diamond_block : ID.tnt), app.vx.mat); if (mega) m.scale.setScalar(3); }
  m.castShadow = true; const sx = met ? x - 40 : x, sy = met ? 70 : 42 + rnd(0, 12); m.position.set(sx, sy, met ? z - 25 : z); S.add(m);
  const f = { m, x, z, kind, t: 0, dur: met ? 2.6 : 1.6 + (sy - 42) / 30 }; app.falls.push(f);
  if (met) { ui.banner('☄️ ' + L('METEOR INCOMING!', 'ЛЕТИТ МЕТЕОРИТ!'), 2600); app.sfx('whoosh'); }
}
function fallTick(app, dt) {
  const vx = app.vx;
  app.falls = app.falls.filter(f => {
    f.t += dt; const k = Math.min(1, f.t / f.dur), top = vx.ground(f.x, f.z, 99) ?? -1, met = f.kind === 'meteor', h = f.kind === 'mega' ? 1.5 : 0.5;
    if (met) { f.m.position.set(f.x - 40 * (1 - k), top + 0.5 + (70 - top) * (1 - k), f.z - 25 * (1 - k)); f.m.rotation.x += dt * 4; if (app.parts.length < 480) app.parts.push({ x: f.m.position.x + rnd(-1, 1), y: f.m.position.y + rnd(-1, 1), z: f.m.position.z + rnd(-1, 1), vx: rnd(-1, 1), vy: rnd(2, 4), vz: rnd(-1, 1), life: rnd(0.4, 0.9), col: ATLAS.avg[TL[ID.lava][1]], s: rnd(2, 4) }); }
    else { f.m.position.y = Math.max(top + h, f.m.position.y - dt * (8 + f.t * 26)); f.m.rotation.y += dt * 2; }
    const landed = met ? k >= 1 : f.m.position.y <= top + h + 0.01;
    if (!landed) return true;
    app.world.scene.remove(f.m);
    const c = cellOf(f.x, top + 0.5, f.z), cb = cellOf(f.x, top - 0.5, f.z);
    if (f.kind === 'dia') { debris(app, cb, 6); app.sfx('ding'); }
    if (app.isHost()) {
      if (f.kind === 'tnt') explode(app, c >= 0 ? c : cb, 3);
      if (f.kind === 'mega') explode(app, c >= 0 ? c : cb, 7.5);
      if (f.kind === 'dia' && c >= 0) change(app, c, ID.diamond_block);
      if (met && cb >= 0) {
        explode(app, cb, 5.5);
        setTimeout(() => { for (let q = 0; q < 7; q++) { const i = ci(cb) + Math.round(rnd(-2, 2)), j = cj(cb) + Math.round(rnd(-2, 2)), kk = vx.colTop(i, j); if (kk > 0) change(app, idx(i, kk, j), q < 3 ? ID.diamond_ore : ID.gold_ore); } }, 400);
      }
    }
    return false;
  });
}

// ---------- the hand: what you hold (in third person on the avatar, in first person in front of the camera) ----------
function hand(app) {
  const w = app.world, S = 0.36;
  app.fpHand = new THREE.Group(); app.fpHand.position.set(0.42, -0.38, -0.6); w.camera.add(app.fpHand);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.5), new THREE.MeshStandardMaterial({ color: (app.me.avatar && app.me.avatar.skin) || '#f2c49b', roughness: 0.6 })); arm.position.z = 0.1; app.fpHand.add(arm);
  app.heldTP = new THREE.Group(); app.heldTP.position.set(0, -2 * S - 0.06, 0.1); w.me.armR.add(app.heldTP);
  app.heldFP = new THREE.Group(); app.heldFP.position.set(0, 0.08, -0.18); app.fpHand.add(app.heldFP);
}
const itemTex = {};
function itemMesh(app, k, s) {
  const b = ITEMS[k].block;
  if (b && !BLOCKS[b].shape) return new THREE.Mesh(blockGeo(b, s), app.vx.mat);
  if (!itemTex[k]) { const t = new THREE.TextureLoader().load(icon(k)); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; itemTex[k] = new THREE.MeshStandardMaterial({ map: t, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 }); }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(s * 2, s * 2), itemTex[k]); m.rotation.y = Math.PI / 2; return m;
}
function heldItem(app) {
  const k = (app.bar[app.sel] && (app.inv[app.bar[app.sel]] > 0 || creative(app)) && app.bar[app.sel]) || bestPick(app) || '';
  if (app._held === k) return; app._held = k;
  for (const g of [app.heldTP, app.heldFP]) { g.clear(); if (k) g.add(itemMesh(app, k, g === app.heldTP ? 0.24 : 0.16)); }
}

// ---------- sky: day and night, clouds, stars, lights from glowing blocks ----------
function skySetup(app) {
  const w = app.world, S = w.scene;
  const cg = new THREE.BoxGeometry(1, 1, 1), cm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85 }), n = 46;
  app.clouds = new THREE.InstancedMesh(cg, cm, n); app.clouds.frustumCulled = false; app.cloudD = [];
  for (let i = 0; i < n; i++) app.cloudD.push({ x: rnd(-140, 140), z: rnd(-140, 140), sx: rnd(6, 18), sz: rnd(5, 14), y: 46 + rnd(-2, 3) });
  S.add(app.clouds);
  const sp = new Float32Array(1500); for (let i = 0; i < 500; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y) + 0.05; v.normalize().multiplyScalar(1500); sp.set([v.x, v.y, v.z], i * 3); }
  app.stars = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(sp, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0, depthWrite: false })); S.add(app.stars);
  app.moon = new THREE.Mesh(new THREE.BoxGeometry(40, 40, 4), new THREE.MeshBasicMaterial({ color: 0xf4f1e0, fog: false, transparent: true })); S.add(app.moon);
  // the ice age: frozen sea and snowflakes
  app.icePlane = new THREE.Mesh(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xdcefff, roughness: 0.25, metalness: 0.1 })); app.icePlane.position.y = -0.88; app.icePlane.visible = false; S.add(app.icePlane);
  const fp = new Float32Array(1800); for (let i = 0; i < 600; i++) fp.set([rnd(-30, 30), rnd(0, 30), rnd(-30, 30)], i * 3);
  app.snow = new THREE.Points(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(fp, 3)), new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, map: dot(), transparent: true, depthWrite: false })); app.snow.visible = false; app.snow.frustumCulled = false; S.add(app.snow);
  app.glowL = w.hq ? [...Array(6)].map(() => { const l = new THREE.PointLight(0xffb45a, 0, 11, 1.6); S.add(l); return l; }) : [];
}
const lerp = (a, b, k) => a + (b - a) * k, cA = new THREE.Color(), cB = new THREE.Color();
function skyTick(app, dt, t) {
  const w = app.world, now = Date.now(), su = w.sky.material.uniforms;
  let ph = (now / 1000 / DAY + 0.1) % 1; if (app.nightUntil > now) ph = 0.75;
  app.ph = (app.ph ?? ph) + (((ph - (app.ph ?? ph) + 1.5) % 1) - 0.5) * Math.min(1, dt * 2);
  const a = app.ph * Math.PI * 2, elev = 55 * Math.sin(a) + 38, az = app.ph * 360 + 60, day = THREE.MathUtils.smoothstep(elev, -6, 10);
  const sunV = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(az));
  su.sunPosition.value.copy(sunV); if (w.water.material.uniforms?.sunDirection) w.water.material.uniforms.sunDirection.value.copy(sunV);
  if (day > 0.5) w.sunDir.copy(sunV); else w.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - Math.max(30, -elev + 20)), THREE.MathUtils.degToRad(az + 180));
  const gold = THREE.MathUtils.smoothstep(elev, 0, 12) * (1 - THREE.MathUtils.smoothstep(elev, 14, 30));
  w.sun.intensity = lerp(0.45, 3.4, day); w.sun.color.copy(cA.set(0x8fa6ff).lerp(cB.set(0xffe2bf), day)).lerp(cB.set(0xff9a50), gold * 0.6);
  if (!w.effects.disco) w.hemi.intensity = lerp(0.14, 0.45, day);
  w.scene.fog.color.copy(cA.set(0x0b1222).lerp(cB.set(0xc4cdd6), day)); w.scene.environmentIntensity = lerp(0.08, 0.55, day);
  app.stars.material.opacity = 1 - day; app.moon.material.opacity = 1 - day;
  const mv = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 + elev), THREE.MathUtils.degToRad(az + 180)); app.moon.position.copy(w.camera.position).addScaledVector(mv, 900); app.moon.lookAt(w.camera.position);
  app.clouds.material.color.copy(cA.set(0x2a3350).lerp(cB.set(0xffffff), day));
  app.night = 1 - day;
  // clouds drift
  const M = new THREE.Matrix4(); app.cloudD.forEach((c, i) => { c.x += dt * 1.2; if (c.x > 150) c.x -= 300; M.makeScale(c.sx, 2, c.sz).setPosition(c.x, c.y, c.z); app.clouds.setMatrixAt(i, M); }); app.clouds.instanceMatrix.needsUpdate = true;
  // the nearest torches and lamps light up the night
  if (app.glowL.length && (app._gl = (app._gl || 0) + dt) > 0.5) {
    app._gl = 0; const p = w.me.group.position, list = [...app.vx.glow].map(c => { const [x, y, z] = center(c); return [x, y, z, (x - p.x) ** 2 + (y - p.y) ** 2 + (z - p.z) ** 2]; }).sort((a2, b) => a2[3] - b[3]);
    app.glowL.forEach((l, i) => { const g = list[i]; if (g && g[3] < 1600) { l.position.set(g[0], g[1] + 0.3, g[2]); l.intensity = 2 + app.night * 9; } else l.intensity = 0; });
  }
  app.vx.mat.emissiveIntensity = 1.1 + app.night * 0.6;
}

// ---------- animals (just for fun, each player sees their own) ----------
function animalGeo(parts) { return mergeGeometries(parts.map(([sx, sy, sz, x, y, z, c]) => { const g = new THREE.BoxGeometry(sx, sy, sz).translate(x, y, z), col = new THREE.Color(c), a = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < a.length; i += 3) a.set([col.r, col.g, col.b], i); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; })); }
function animals(app) {
  const S = app.world.scene, mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 });
  const sheep = animalGeo([[0.9, 0.62, 1.2, 0, 0.78, 0, 0xf2f0ea], [0.42, 0.42, 0.42, 0, 0.98, 0.72, 0x3a302a], [0.44, 0.2, 0.3, 0, 1.12, 0.6, 0xf2f0ea], ...[[-0.28, -0.4], [0.28, -0.4], [-0.28, 0.4], [0.28, 0.4]].map(([x, z]) => [0.18, 0.5, 0.18, x, 0.25, z, 0x4a4038])]);
  const hen = animalGeo([[0.42, 0.4, 0.55, 0, 0.45, 0, 0xffffff], [0.26, 0.32, 0.26, 0, 0.78, 0.24, 0xffffff], [0.12, 0.08, 0.14, 0, 0.75, 0.42, 0xffa21f], [0.06, 0.12, 0.14, 0, 0.98, 0.24, 0xe53b2f], [0.08, 0.1, 0.06, 0, 0.66, 0.38, 0xe53b2f], [0.06, 0.28, 0.06, -0.1, 0.14, 0, 0xf2b630], [0.06, 0.28, 0.06, 0.1, 0.14, 0, 0xf2b630]]);
  app.herd = [{ geo: sheep, n: 7, sp: 0.9, list: [] }, { geo: hen, n: 7, sp: 1.3, hop: 1, list: [] }];
  for (const h of app.herd) { h.mesh = new THREE.InstancedMesh(h.geo, mat, 60); h.mesh.castShadow = true; h.mesh.frustumCulled = false; S.add(h.mesh); for (let i = 0; i < h.n; i++) addAnimal(app, h); }
}
function addAnimal(app, h, x, z, life) {
  for (let k = 0; k < 30; k++) { const ax = x ?? rnd(-20, 20), az = z ?? rnd(-20, 20), g = app.vx.ground(ax, az, 99); if (g !== null && g > 0.5) { h.list.push({ x: ax, z: az, y: g, ry: rnd(0, 6.28), tx: ax, tz: az, t: 0, ph: rnd(0, 6), life }); return; } }
}
function animalTick(app, dt, t) {
  const vx = app.vx, me = app.world.me.group.position, O = new THREE.Object3D();
  for (const h of app.herd) {
    h.list = h.list.filter(a => !(a.life !== undefined && (a.life -= dt) < 0));
    h.list.forEach((a, i) => {
      a.t -= dt; const dm = Math.hypot(me.x - a.x, me.z - a.z), run = dm < 2.5 || a.life !== undefined;
      if (a.t < 0 || dm < 2.5) { const ang = dm < 2.5 ? Math.atan2(a.x - me.x, a.z - me.z) + rnd(-0.5, 0.5) : rnd(0, 6.28), r = rnd(2, 6); a.tx = a.x + Math.sin(ang) * r; a.tz = a.z + Math.cos(ang) * r; a.t = rnd(2, 6); }
      const dx = a.tx - a.x, dz = a.tz - a.z, d = Math.hypot(dx, dz), moving = d > 0.3 && (run || a.t < 4.5);
      if (moving) { const s = h.sp * (run ? 3 : 1) * dt, nx = a.x + dx / d * s, nz = a.z + dz / d * s, g = vx.ground(nx, nz, a.y + 1.1); if (g !== null && g > -0.5 && g - a.y < 1.1 && !vx.solid(nx, g + 0.5, nz)) { a.x = nx; a.z = nz; a.y = g > a.y ? g : Math.max(g, a.y - dt * 8); } else a.t = 0; a.ry += Math.atan2(Math.sin(Math.atan2(dx, dz) - a.ry), Math.cos(Math.atan2(dx, dz) - a.ry)) * Math.min(1, dt * 6); }
      const bob = moving ? Math.abs(Math.sin(t * (h.hop ? 14 : 8) + a.ph)) * (h.hop ? 0.18 : 0.08) : 0;
      O.position.set(a.x, a.y + bob, a.z); O.rotation.set(0, a.ry, moving ? 0 : Math.sin(t + a.ph) * 0.03); O.updateMatrix(); h.mesh.setMatrixAt(i, O.matrix);
    });
    h.mesh.count = h.list.length; h.mesh.instanceMatrix.needsUpdate = true;
  }
}

// ---------- bot builders: the host runs them, everyone sees them ----------
function bots(app) {
  const S = app.world.scene;
  app.botList = BOTS.map((nm, i) => {
    const cfg = { skin: SKINS[(i * 2 + 1) % SKINS.length], face: FACES[i % FACES.length], hair: HAIRSTYLES[i % 5], hairColor: HAIR_COLORS[(i * 3) % HAIR_COLORS.length], top: TOPS[(i + 1) % TOPS.length], shirt: CLOTH[(i * 3 + 1) % CLOTH.length], pants: PANTS[i % PANTS.length], shoes: SHOES[i % SHOES.length], hat: ['cap', 'none', 'beanie', 'none', 'cap'][i], pet: 'none', height: 1 };
    const av = new Avatar(cfg, '', 'bot'), lab = labelSprite('🤖 ' + nm, 0.32); lab.position.y = 2.35; av.group.add(lab); S.add(av.group);
    const pk = itemMesh(app, i % 2 ? 'pick_iron' : 'pick_stone', 0.22); pk.position.set(0, -0.78, 0.1); av.armR.add(pk);
    const x = app.def.spawn[0] + rnd(-6, 6), z = app.def.spawn[1] + rnd(-6, 6);
    return { name: nm, av, x, z, y: app.vx.ground(x, z, 99) ?? 2, ry: 0, mode: 'idle', t: 1 + i, act: 0, cells: [], gx: x, gy: 0, gz: z };
  });
  app.botList.forEach(b => { b.gy = b.y; b.av.group.position.set(b.x, b.y, b.z); });
}
const STRUCTS = {
  tower: () => { const h = 4 + (Math.random() * 3 | 0), m = Math.random() < 0.5 ? ID.bricks : ID.planks, c = []; for (let k = 0; k < h; k++) c.push([0, k, 0, m]); c.push([0, h, 0, ID.lamp]); return c; },
  hut: () => { const c = []; for (let k = 0; k < 2; k++) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((Math.abs(i) === 1 || Math.abs(j) === 1) && !(i === 0 && j === 1)) c.push([i, k, j, ID.planks]); for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) c.push([i, 2, j, ID.log]); c.push([0, 0, 0, ID.torch]); return c; },
  snowman: () => [[0, 0, 0, ID.snow], [0, 1, 0, ID.snow], [0, 2, 0, ID.jack]],
  wall: () => { const c = [], m = Math.random() < 0.5 ? ID.glass : ID.bricks; for (let i = -2; i <= 2; i++) for (let k = 0; k < 2; k++) c.push([i, k, 0, k && i % 2 === 0 ? ID.glass : m]); return c; },
  garden: () => [[0, 0, 0, ID.pumpkin], [2, 0, 1, ID.pumpkin], [1, 0, -1, ID.leaves], [-1, 0, 1, ID.leaves], [-1, 1, 1, ID.leaves], [1, 0, 1, ID.tramp]],
  statue: () => [[0, 0, 0, ID.bricks], [0, 1, 0, ID.bricks], [0, 2, 0, ID.gold_block], [-1, 1, 0, ID.torch], [1, 1, 0, ID.torch]],
};
function botGoal(app, b) {
  const vx = app.vx, party = app.partyUntil > Date.now(), mine = b.cells.length > 40 || Math.random() < 0.22;
  for (let k = 0; k < 20; k++) {
    let x = rnd(-22, 22), z = rnd(-22, 22), task;
    if (mine && b.cells.length) { const c = b.cells[0]; [x, , z] = center(c); task = { kind: 'mine', c, own: 1 }; }
    else if (mine) { const i = Math.floor(x + OFF), j = Math.floor(z + OFF), kk = vx.colTop(i, j); if (kk < 0 || ![ID.log, ID.leaves, ID.pumpkin].includes(vx.vox[idx(i, kk, j)])) continue; task = { kind: 'mine', c: idx(i, kk, j) }; }
    else { const keys = Object.keys(STRUCTS); task = { kind: 'build', plan: STRUCTS[keys[Math.random() * keys.length | 0]](), at: [x, z] }; }
    const g = vx.ground(x + 1.5, z, 99); if (g === null || g < 0.5) continue;
    if (task.kind === 'build' && Math.hypot(x - app.def.spawn[0], z - app.def.spawn[1]) < 4) continue;
    Object.assign(b, { mode: 'walk', tx: x + 1.6, tz: z, task, t: party ? 8 : 20 }); return;
  }
  b.mode = 'idle'; b.t = 2;
}
function botTick(app, dt, now) {
  const vx = app.vx, party = app.partyUntil > now;
  for (const b of app.botList) {
    b.t -= dt;
    if (b.mode === 'walk') {
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
      if (d < 0.5 || b.t < 0) { b.mode = 'work'; b.t = 0.6; b.ry = Math.atan2(b.task.at ? b.task.at[0] - b.x : center(b.task.c)[0] - b.x, b.task.at ? b.task.at[1] - b.z : center(b.task.c)[2] - b.z); continue; }
      const s = (party ? 5 : 2.6) * dt, nx = b.x + dx / d * s, nz = b.z + dz / d * s, g = vx.ground(nx, nz, b.y + 1.1);
      if (g === null || g < -0.5 || g - b.y > 1.05 || vx.solid(nx, g + 1.2, nz)) { b.t = Math.min(b.t, 0); b.tx = b.x + rnd(-3, 3); b.tz = b.z + rnd(-3, 3); continue; }
      b.x = nx; b.z = nz; b.y = g > b.y ? g : Math.max(g, b.y - dt * 9); b.ry = Math.atan2(dx, dz); b.act = 1;
    } else if (b.mode === 'work') {
      b.act = 2; if (b.t > 0) continue;
      const T = b.task;
      if (T.kind === 'mine') { if (vx.vox[T.c] && vx.vox[T.c] !== ID.bedrock) { debris(app, T.c, 8); change(app, T.c, 0); } b.cells = b.cells.filter(c => c !== T.c); b.mode = 'idle'; b.t = 1; b.act = 0; continue; }
      const [ox, oz] = T.at, i0 = Math.floor(ox + OFF), j0 = Math.floor(oz + OFF), k0 = vx.colTop(i0, j0) + 1, step = T.plan.shift();
      if (!step) { b.mode = 'idle'; b.t = 2.5; b.act = Math.random() < 0.5 ? 3 : 4; continue; }
      const [di, dk, dj, v] = step, c = inb(i0 + di, (T.k0 ??= k0) + dk, j0 + dj) ? idx(i0 + di, T.k0 + dk, j0 + dj) : -1;
      if (c >= 0 && !vx.vox[c] && !blockedBot(app, c)) { change(app, c, v); b.cells.push(c); }
      b.t = party ? 0.12 : 0.55;
    } else { b.act = b.act > 2 ? b.act : 0; if (b.t < 0) botGoal(app, b); }
  }
  if ((app._bs = (app._bs || 0) + dt) > 0.5) { app._bs = 0; app.emit('cbots', { b: app.botList.map(b => [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), +b.ry.toFixed(2), b.act]) }); }
}
// don't build on top of a player
function blockedBot(app, c) { const [x, y, z] = center(c), ps = [app.world.me.group.position, ...Object.values(app.world.remotes).map(r => r.av.group.position)]; return ps.some(p => Math.abs(p.x - x) < 0.9 && Math.abs(p.z - z) < 0.9 && p.y > y - 2.3 && p.y < y + 0.6); }
function botsIn(app, d) { (d.b || []).forEach((r, i) => { const b = app.botList[i]; if (!b) return; [b.x, b.y, b.z, b.ry, b.act] = r; }); }
function botDraw(app, dt, t) {
  const host = app.isHost();
  for (const b of app.botList) {
    const g = b.av.group, before = g.position.clone();
    if (host) g.position.set(b.x, b.y, b.z); else if (g.position.distanceTo(new THREE.Vector3(b.x, b.y, b.z)) > 8) g.position.set(b.x, b.y, b.z); else g.position.lerp(new THREE.Vector3(b.x, b.y, b.z), Math.min(1, dt * 5));
    let dr = b.ry - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 8);
    const sp = before.distanceTo(g.position) / Math.max(dt, 0.001);
    if (b.act === 3 && b.av.emote !== 'dance') b.av.play('dance'); if (b.act === 4 && b.av.emote !== 'wave' && b._w !== b.t) { b._w = b.t; b.av.play('wave'); }
    if (b.act < 3 && (b.av.emote === 'dance')) b.av.emote = null;
    b.av.animate(sp > 0.3 ? sp : 0, dt, false);
    if (b.act === 2) b.av.armR.rotation.x = -1.4 + Math.sin(t * 14 + b.x) * 0.7;
  }
}

// ---------- admin abuse ----------
function landSpot(app, minD = 6) { const vx = app.vx, s = app.def.spawn; for (let k = 0; k < 60; k++) { const x = rnd(-22, 22), z = rnd(-22, 22), g = vx.ground(x, z, 99); if (g !== null && g >= 0 && Math.hypot(x - s[0], z - s[1]) >= minD) return [x, z]; } return [s[0] + 8, s[1] + 8]; }
function buildCells(app, cells, record) { const vx = app.vx; cells.forEach(([i, k, j, v]) => { if (!inb(i, k, j)) return; const c = idx(i, k, j); if (vx.vox[c] === ID.bedrock) return; if (record) record.push([c, vx.vox[c], v]); change(app, c, v); }); }
// put changed blocks back after a while (only if nobody changed them since)
function revertLater(app, rec, ms) { setTimeout(() => { if (!app.isHost()) return; rec.forEach(([c, was, now]) => { if (app.vx.vox[c] === now) change(app, c, was); }); }, ms); }
function surface(app, fn) { const vx = app.vx, out = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = vx.colTop(i, j); if (k > 0) { const v = fn(vx.vox[idx(i, k, j)], i, k, j); if (v) out.push([i, k, j, v]); } } return out; }
function onAdmin(a, d, app) {
  const host = app.isHost(), w = app.world, vx = app.vx, now = Date.now();
  if (a === 'tntrain') { ui.banner('💣 ' + L('TNT RAIN! Take cover!', 'ДОЖДЬ ИЗ ДИНАМИТА! Прячься!')); app.sfx('airhorn'); if (host) { const f = [...Array(14)].map(() => [...landSpot(app, 5), 'tnt']); app.emit('cfall', { f, g: vx.gen }); f.forEach(x => fall(app, ...x)); } }
  if (a === 'diamonds') { ui.banner('💎 ' + L('It is raining diamonds! Grab them!', 'Дождь из алмазов! Хватай!')); app.sfx('cheer'); if (host) { const f = [...Array(18)].map(() => [...landSpot(app, 2), 'dia']); app.emit('cfall', { f, g: vx.gen }); f.forEach(x => fall(app, ...x)); } }
  if (a === 'fullinv') { Object.keys(ITEMS).forEach(k => gain(app, k, PICKS.includes(k) ? 1 : 64, true, true)); ui.banner('🎒 ' + L('Everyone gets 64 of everything!', 'Всем по 64 всего!')); app.sfx('paid'); confetti(60); }
  if (a === 'flood') { app.flood = { t0: now }; ui.banner('🌊 ' + L('THE FLOOD! Climb high!', 'ПОТОП! Лезь повыше!'), 4000); app.sfx('splash'); }
  if (a === 'pyramid') {
    ui.banner('🔺 ' + L('A pyramid appears!', 'Появилась пирамида!')); app.sfx('drumroll');
    if (host) { const [x, z] = landSpot(app, 12), i0 = Math.floor(x + OFF), j0 = Math.floor(z + OFF), k0 = Math.max(4, vx.colTop(i0, j0)), c = []; for (let l = 0; l < 8; l++) for (let di = -(7 - l); di <= 7 - l; di++) for (let dj = -(7 - l); dj <= 7 - l; dj++) c.push([i0 + di, k0 + l, j0 + dj, l === 7 ? ID.gold_block : (l + di + dj) % 4 === 0 && Math.abs(di) === 7 - l ? ID.bricks : ID.sand]); buildCells(app, c); }
  }
  if (a === 'statue') {
    ui.banner('🗿 ' + L('A giant statue rises!', 'Вырастает гигантская статуя!')); app.sfx('drumroll');
    if (host) {
      const [x, z] = landSpot(app, 9), i0 = Math.floor(x + OFF), j0 = Math.floor(z + OFF), k0 = vx.colTop(i0, j0) + 1, c = [], box = (x0, x1, y0, y1, z0, z1, v) => { for (let i = x0; i <= x1; i++) for (let k = y0; k <= y1; k++) for (let j = z0; j <= z1; j++) c.push([i0 + i, k0 + k, j0 + j, typeof v === 'function' ? v(i, k, j) : v]); };
      box(-2, 1, 0, 0, -1, 0, ID.bricks); box(-2, 1, 1, 5, -1, 0, ID.diamond_block); box(-2, 1, 6, 11, -1, 0, ID.gold_block);
      box(-4, -3, 6, 11, -1, 0, (i, k) => (k < 9 ? ID.sand : ID.gold_block)); box(2, 3, 6, 11, -1, 0, (i, k) => (k < 9 ? ID.sand : ID.gold_block));
      box(-2, 1, 12, 15, -2, 1, (i, k, j) => (k === 15 || j === -2 ? ID.log : j === 1 && k === 14 && (i === -2 || i === 1) ? ID.diamond_block : j === 1 && k === 12 && (i === -1 || i === 0) ? ID.coal_ore : ID.sand));
      buildCells(app, c);
    }
  }
  if (a === 'gold') { ui.banner('🟨 ' + L('MIDAS TOUCH! The island turns to gold!', 'ЗОЛОТОЕ КАСАНИЕ! Остров стал золотым!'), 4000); app.sfx('paid'); if (host) { const rec = []; buildCells(app, surface(app, v => ([ID.grass, ID.sand, ID.snow, ID.stone, ID.dirt, ID.leaves].includes(v) ? ID.gold_block : 0)), rec); revertLater(app, rec, 60000); } }
  if (a === 'meteor') { if (host) { const f = [[...landSpot(app, 9), 'meteor']]; app.emit('cfall', { f, g: vx.gen }); f.forEach(x => fall(app, ...x)); } }
  if (a === 'ice') { app.frozenUntil = now + 60000; ui.banner('🧊 ' + L('ICE AGE! The sea is frozen: walk on it!', 'ЛЕДНИКОВЫЙ ПЕРИОД! Море замёрзло: гуляй по нему!'), 4000); app.sfx('whoosh'); if (host) { const rec = []; buildCells(app, surface(app, v => (v === ID.grass ? ID.snow : v === ID.water ? ID.ice : v === ID.leaves ? ID.snow : 0)), rec); revertLater(app, rec, 60000); } }
  if (a === 'lava') {
    ui.banner('🌋 ' + L('LAVA! Touch it and you go back to spawn!', 'ЛАВА! Коснёшься — вернёшься на старт!'), 4000); app.sfx('crash');
    if (host) { const rec = [], c = []; for (let p = 0; p < 10; p++) { const [x, z] = landSpot(app, 6), i0 = Math.floor(x + OFF), j0 = Math.floor(z + OFF), r = 1 + (Math.random() * 2 | 0); for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) if (di * di + dj * dj <= r * r + 1 && inb(i0 + di, 1, j0 + dj)) { const k = vx.colTop(i0 + di, j0 + dj); if (k > 1 && SOLID[vx.vox[idx(i0 + di, k, j0 + dj)]]) c.push([i0 + di, k, j0 + dj, ID.lava]); } } buildCells(app, c, rec); revertLater(app, rec, 45000); }
  }
  if (a === 'creative') { app.creativeUntil = now + 60000; ui.banner('✨ ' + L('CREATIVE MODE! Instant mining, endless blocks, hold jump to fly!', 'ТВОРЧЕСКИЙ РЕЖИМ! Мгновенная добыча, бесконечные блоки, держи прыжок — летай!'), 4500); app.sfx('star'); renderBar(app); }
  if (a === 'megatnt') { ui.banner('🧨 ' + L('MEGA TNT INCOMING!!!', 'ЛЕТИТ МЕГА-ДИНАМИТ!!!'), 3000); app.sfx('airhorn'); if (host) { const f = [[...landSpot(app, 14), 'mega']]; app.emit('cfall', { f, g: vx.gen }); f.forEach(x => fall(app, ...x)); } }
  if (a === 'botparty') { app.partyUntil = now + 30000; ui.banner('🤖 ' + L('Bot build party! Watch them go!', 'Стройка ботов! Смотри, как строят!')); app.sfx('drumroll'); app.botList.forEach(b => { b.mode = 'idle'; b.t = 0; }); }
  if (a === 'night') { app.nightUntil = now + 60000; ui.banner('🌙 ' + L('Night falls! Light some torches.', 'Наступила ночь! Зажги факелы.')); app.sfx('chime'); }
  if (a === 'sheep') { const p = w.me.group.position; for (let k = 0; k < 28; k++) addAnimal(app, app.herd[0], p.x + rnd(-8, 8), p.z + rnd(-8, 8), 45); ui.banner('🐑 ' + L('SHEEP STAMPEDE!', 'НАШЕСТВИЕ ОВЕЦ!')); app.sfx('laugh'); }
  if (a === 'reset') { ui.banner('🔄 ' + L('The world is reset!', 'Мир сброшен!')); app.sfx('teleport'); if (host) { newWorld(app, vx.seed, vx.gen + 1); pushState(app); } }
}

// ---------- every frame ----------
function frame(dt, t, app) {
  if (!app.vx) return;
  const w = app.world, vx = app.vx, p = w.me.group.position, now = Date.now(), cre = creative(app);
  // body extras: head bumps, ladders, water, trampolines, lava, getting stuck, flying in creative mode
  if (!w.carrier) {
    if (w.vel.y > 0 && vx.solid(p.x, p.y + 1.88, p.z)) { w.vel.y = 0; p.y = Math.floor(p.y + 1.88 - Y0) + Y0 - 1.9; }
    if (vx.solid(p.x, p.y + 0.3, p.z)) { const g = vx.ground(p.x, p.z, 99); if (g !== null) { p.y = g; w.vel.y = 0; } }
    const k = w.keys, up = !w.inputLocked && (k.Space || app.jumpHeld), fwd = !w.inputLocked && (k.KeyW || k.ArrowUp || w.joy.y > 0.3);
    const lvl = app.floodLevel ?? -9, wet = p.y + 0.7 < lvl || vx.at(p.x, p.y + 0.5, p.z) === ID.water;
    if (wet) { if (!app._wet) app.sfx('splash'); w.vel.y = up ? 4.2 : Math.max(w.vel.y, -1.6); if (p.y + 1.5 < lvl) w.vel.y = Math.max(w.vel.y, 1.4); }
    app._wet = wet;
    if (vx.at(p.x, p.y + 0.4, p.z) === ID.ladder || vx.at(p.x, p.y + 1.2, p.z) === ID.ladder) { w.vel.y = up || fwd ? 3.6 : Math.max(w.vel.y, -1.4); }
    if (cre && up) w.vel.y = Math.max(w.vel.y, 6);
    if (w.onGround && vx.at(p.x, p.y - 0.2, p.z) === ID.tramp) { w.vel.y = 17; w.onGround = false; app.sfx('boing'); quest(app, 'bounce'); }
    if (vx.at(p.x, p.y + 0.3, p.z) === ID.lava || vx.at(p.x, p.y - 0.05, p.z) === ID.lava) { toSpawn(app); app.sfx('wrong'); flash(); ui.toast('🔥 ' + L('Ouch, lava! Back to spawn.', 'Ай, лава! Обратно на старт.')); }
    if (p.y < -30) toSpawn(app);
  }
  // aim, mine, place
  aim(app);
  const tg = app.target; app.outline.visible = !!tg; document.querySelector('#crCross')?.classList.toggle('on', !!tg);
  if (tg) { app.outline.position.set(...center(tg.c)); const tor = BLOCKS[tg.v].shape === 'torch'; app.outline.scale.set(tor ? 0.2 : 1, tor ? 0.64 : 1, tor ? 0.2 : 1); if (tor) app.outline.position.y -= 0.19; }
  mineTick(app, dt);
  if (app.placing && (app.placeT += dt) > 0.28) { app.placeT = 0; app.placing2 = true; place(app); app.placing2 = false; }
  // swing the arm while working, and face the block
  const me = w.me, hs = Math.hypot(w.vel.x, w.vel.z);
  if (app.swingT > 0) { app.swingT -= dt; me.armR.rotation.x = -1.3 + Math.sin(t * 16) * 0.7; app.fpHand.rotation.x = Math.sin(t * 16) * 0.35 - 0.2; if (tg && hs < 0.5) { const [x, , z] = center(tg.c); me.group.rotation.y = Math.atan2(x - p.x, z - p.z); } } else app.fpHand.rotation.x = 0;
  for (const id in w.remotes) { const R = w.remotes[id]; if (R.d && R.d.mi) R.av.armR.rotation.x = -1.3 + Math.sin(t * 16 + id.length) * 0.7; }
  heldItem(app);
  // timed things
  fuseTick(app, dt); fallTick(app, dt); partsTick(app, dt); skyTick(app, dt, t); animalTick(app, dt, t); app.coins.update(dt, t);
  if (app.isHost()) botTick(app, dt, now); botDraw(app, dt, t);
  if (app.flood) { const f = (now - app.flood.t0) / 1000, k = f < 12 ? f / 12 : f < 42 ? 1 : Math.max(0, 1 - (f - 42) / 10); app.floodLevel = -0.9 + 6.5 * k; w.water.position.y = app.floodLevel; if (f > 52) { app.flood = null; app.floodLevel = undefined; w.water.position.y = -0.9; } }
  const frozen = app.frozenUntil > now; app.icePlane.visible = frozen; w.water.visible = !frozen; app.snow.visible = frozen;
  if (frozen) { const a = app.snow.geometry.attributes.position, c = w.camera.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - dt * 3; if (y < -5) y += 30; a.setY(i, y); } a.needsUpdate = true; app.snow.position.set(c.x, c.y - 10, c.z); }
  // the creative mode pill and the sky island quest
  if ((app._hud = (app._hud || 0) + dt) > 0.25) {
    app._hud = 0; const m = document.querySelector('#crMode'), left = Math.ceil((app.creativeUntil - now) / 1000);
    m.classList.toggle('hidden', !cre); if (cre) m.textContent = `✨ ${L('Creative', 'Творческий')} ${left}s`;
    if (cre !== app._cre) { app._cre = cre; renderBar(app); }
    const I = vx.info; if (p.y > I.sky[1] - 0.6 && Math.hypot(p.x - I.sky[0], p.z - I.sky[2]) < 6.5) quest(app, 'sky');
  }
  vx.flush();
}
