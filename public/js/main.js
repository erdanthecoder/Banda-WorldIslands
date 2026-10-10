import { CONFIG, DEV } from './config.js';
import { t, setLang, getLang, applyI18n, langChosen } from './i18n.js';
import { sfx, say, playSong, stopSong, SONGS, setMuted, isMuted, unlockAudio, ambience } from './audio.js';
import { createNet } from './net.js';
import { currentAccount, signInWithHub, signOut } from './auth.js';
import { World, ISLANDS, TOWER, MARKET, PLAYGROUND, PITCH, COURT, BANK, RESTO, PATHS, PLAZA_R } from './world.js';
import { Avatar, avatarCreator, randomAvatar, EMOTES } from './avatar.js';
import { Tower, Market, Bank, Restaurant, FLOORS } from './buildings.js';
import { Mall } from './mall.js';
import { Playground, coffeeKiosk } from './playground.js';
import { BankUI } from './bank.js';
import { Phone } from './phone.js';
import { Jobs } from './jobs.js';
import { Shop, money, PRICES, ICON, CAFE, RESTO_MENU } from './shop.js';
import { Minigames, MIN_PLAYERS } from './minigames.js';
import { Bots } from './bots.js';
import { Shows } from './shows.js';
import { Admin } from './admin.js';
import { Fishing } from './fishing.js';
import { whatsNew } from './whatsnew.js';
import { isV2, LAUNCH_2 } from './launch.js';
import { mathQuiz, speedMath, timesTable, langQuiz, wordMatch } from './games/learn.js';
import { flappy, snake, minicraft, breaker, dodger } from './games/arcade.js';
import { geoQuiz, scienceQuiz, spellingBee, logicQuiz } from './games/discover.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const show = (el, on = true) => (typeof el === 'string' ? $(el) : el).classList.toggle('hidden', !on);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wantsTeacher = /^\/teachers?(\/|$)/i.test(location.pathname) || (DEV && (new URLSearchParams(location.search).has('teacher') || location.hash === '#teacher'));

const GAMES = {
  math: { run: mathQuiz }, speed: { run: speedMath }, times: { run: timesTable },
  english: { run: c => langQuiz(c, 'en') }, russian: { run: c => langQuiz(c, 'ru') }, match: { run: wordMatch },
  geo: { run: geoQuiz }, science: { run: scienceQuiz }, spelling: { run: spellingBee }, logic: { run: logicQuiz },
  craft: { run: minicraft, arcade: true }, flappy: { run: flappy, arcade: true }, snake: { run: snake, arcade: true }, breaker: { run: breaker, arcade: true }, dodger: { run: dodger, arcade: true },
};

const app = { t, sfx, say, players: {}, users: {}, me: null, effects: {}, evCbs: [], onEvent(cb) { this.evCbs.push(cb); } };
window.banda = app;

// ---------------- UI helpers ----------------
const ui = app.ui = {
  toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; $('#toasts').appendChild(d); setTimeout(() => d.remove(), 3500); },
  banner(msg, ms = 2500) { const b = $('#banner'); b.textContent = msg; show(b); b.style.animation = 'none'; b.offsetHeight; b.style.animation = ''; clearTimeout(this._bt); this._bt = setTimeout(() => show(b, false), ms); },
  floatStar(n) { const d = document.createElement('div'); d.className = 'floatStar'; d.textContent = `+${n} ★`; document.body.appendChild(d); setTimeout(() => d.remove(), 1300); },
  floatMoney(c) { const d = document.createElement('div'); d.className = 'floatMoney'; d.textContent = `+${money(c)}`; document.body.appendChild(d); setTimeout(() => d.remove(), 1300); },
  mgHud(text) { show('#mgHud', !!text); if (text && $('#mgHud').textContent !== text) $('#mgHud').textContent = text; },
  mgButtons(type) { show('#mgBtns', type === 'football' || type === 'dodgeball' || type === 'basketball'); $('#bAction').textContent = type === 'dodgeball' ? t('throw') : type === 'basketball' ? '🏀 ' + t('shoot') : t('kick'); },
  impostorButtons(s) {
    show('#impBtns', !!s); if (!s) return;
    $('#bReport').disabled = !s.report; show('#bEmergency', !!s.emergency);
    const imp = app.mg.impostor.role(app.mg.mg) === 'impostor'; show('#bKill', imp); $('#bKill').disabled = !s.kill;
  },
  blind(on, n) { show('#blind', on); if (on) $('#blindN').textContent = n; },
  flash() { const f = $('#flash'); show(f); f.style.animation = 'none'; f.offsetHeight; f.style.animation = ''; setTimeout(() => show(f, false), 600); },
  fade(on) { $('#fade').classList.toggle('on', on); },
  results(title, lines) { $('#resTitle').textContent = title; $('#resLines').innerHTML = lines.map(l => `<p>${esc(l)}</p>`).join(''); show('#results'); },
  chat(html, cls) { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; const log = $('#chatLog'); log.appendChild(d); while (log.children.length > 50) log.firstChild.remove(); log.scrollTop = 1e9; setTimeout(() => d.classList.add('old'), 12000); },
  question(title, q, cb) {
    const box = $('#qModal'); $('#qTitle').textContent = title;
    $('#qBody').innerHTML = `<div class="q-text">${q.html}</div><div class="q-grid">${q.options.map((o, i) => `<button class="q-opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
    app.world.inputLocked = true; show(box);
    $$('#qBody .q-opt').forEach(b => b.onclick = () => {
      const ok = String(q.options[+b.dataset.i]) === String(q.answer);
      b.classList.add(ok ? 'ok' : 'bad'); sfx(ok ? 'correct' : 'wrong');
      setTimeout(() => { show(box, false); app.world.inputLocked = false; cb(ok); }, 700);
    });
  },
};
app.toast = m => ui.toast(m);

// ---------------- Boot ----------------
function langMenu(next) {
  show('#langMenu');
  $$('#langMenu [data-lang]').forEach(b => b.onclick = () => { unlockAudio(); sfx('click'); setLang(b.dataset.lang); applyI18n(); show('#langMenu', false); next(); });
}

async function boot() {
  applyI18n();
  show('#loading');
  const account = await currentAccount();
  show('#loading', false);
  if (!account) return signInScreen();
  app.account = account;
  const net = app.net = createNet(account);
  net.watchLobby(c => { app.lobby = c; });
  const row = await net.myRow().catch(() => null);
  const role = account.profile.role === 'teacher' ? 'teacher' : 'student';
  if (wantsTeacher && role !== 'teacher') ui.toast(t('notTeacherAccount'));
  app.money = row?.money_cents ?? 10000;
  app.bank = { card: row?.bank_card || null, hand: !!row?.hand_pay };
  app.loadPending();
  app.me = { uid: account.user.id, pid: account.user.id.slice(0, 8) + '-' + Math.random().toString(36).slice(2, 6), role, name: row?.name || account.profile.full_name || '', avatar: row?.avatar && Object.keys(row.avatar).length ? row.avatar : null };
  if (!app.me.avatar || !app.me.name) {
    show('#creator');
    avatarCreator($('#creatorBody'), { t, cfg: app.me.avatar || randomAvatar(), name: app.me.name, onSave: async (cfg, name) => { app.me.avatar = cfg; app.me.name = name; await net.saveProfile(name, cfg); show('#creator', false); autoJoin(); } });
  } else autoJoin();
}

function signInScreen() {
  show('#signin');
  $('#signRole').textContent = wantsTeacher ? t('teacher') : t('student');
  $('#signBtn').onclick = () => signInWithHub(wantsTeacher);
  $('#signLang').onclick = () => { show('#signin', false); langMenu(signInScreen); };
}

// Join the busiest server that still has room, so classmates end up together.
async function autoJoin() {
  show('#loading');
  await new Promise(r => setTimeout(r, 1200));
  const counts = app.lobby || {};
  const open = CONFIG.servers.filter(s => (counts[s.id] || 0) < CONFIG.maxPlayersPerServer);
  const best = open.sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0))[0] || CONFIG.servers[0];
  start(best.id);
}

// ---------------- Game start ----------------
async function start(serverId) {
  show('#loading'); applyI18n();
  const net = app.net, me = app.me;
  app.server = CONFIG.servers.find(s => s.id === serverId);
  document.body.classList.toggle('teacher', me.role === 'teacher');
  await new Promise(r => setTimeout(r, 30));
  let quality = 'high'; try { quality = localStorage.getItem('banda_quality') || (matchMedia('(pointer: coarse)').matches ? 'low' : 'high'); } catch (e) {}
  const world = app.world = new World($('#scene'), { quality });
  Avatar.blobShadows = !world.hq;
  world.setPlayer(new Avatar(me.avatar, me.name, me.role));
  world.onJump = () => sfx('jump'); world.onFirework = () => sfx('firework');
  app.shop = new Shop(app); app.shop.loadInv(); app.bankUI = new BankUI(app); app.phone = new Phone(app);
  buildWorld(world);
  app.fishing = new Fishing(app);
  if (!world.hq) world.dropPointLights();
  world.teleport(0, 15, 0);
  world.snapshotStatic(); setTimeout(() => { const n = world.batchStatic(); if (DEV) console.log('batched', n); }, 4000);

  net.onPlayers((id, d) => {
    const was = app.players[id];
    if (d) app.players[id] = d; else delete app.players[id];
    world.upsertRemote(id, d, dd => new Avatar(dd.avatar, dd.name, dd.role));
    if (!was && d && d.name) ui.chat(`<b>${esc(d.name)}</b> ${t('joined')}`, 'sys');
    if (was && !d) ui.chat(`<b>${esc(was.name)}</b> ${t('left')}`, 'sys');
    if (!$('#panel').classList.contains('hidden')) renderKids();
    $('#online').textContent = `${app.server.name} · ${Object.keys(app.players).length + 1} ${t('online')}`;
  });
  net.onEvent(ev => { onEvent(ev); app.evCbs.forEach(cb => cb(ev)); });
  net.onUsers(u => { app.users = u; renderMe(); if (!$('#board').classList.contains('hidden')) renderBoard(); });
  net.onState('effects', e => { app.effects = e || {}; world.setEffects(app.effects); });

  await net.joinServer(serverId, { pid: me.pid, uid: me.uid, name: me.name, role: me.role, avatar: me.avatar });
  app.mg = new Minigames(app); app.closeGame = closeGame; app.openGame = openGame;
  app.bots = new Bots(app);
  app.shows = new Shows(app); app.admin = new Admin(app);
  shareElevators(world, net);
  app.phone.start();
  if (app.pending > 0) setTimeout(() => app.settle(), 4000);
  // World Islands 2.0: on now, or switched on live at 10:00 Amman time for everyone who is playing
  const go2 = live => { $$('.v2').forEach(e => e.classList.remove('hidden')); show('#bNew'); document.title = 'World Islands 2.0 — 3D learning world for kids'; if (live) { sfx('champions'); app.world.fireworks(12); ui.banner('🎉 World Islands 2.0!', 5000); } setTimeout(() => whatsNew(app), live ? 1500 : 2500); };
  if (isV2()) go2(false); else setTimeout(() => go2(true), LAUNCH_2 - Date.now() + 500);

  let last = '', lastSent = 0;
  setInterval(() => {
    const g = world.me.group, p = g.position;
    const pos = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ry: +g.rotation.y.toFixed(2), giant: !!app.effects.giant, sh: app.mg.shCount || 0, em: world.me.emote ? app.emoteSig : '', fx: app.mood || '', hb: app.hover ? 1 : 0, tiny: world.tiny ? 1 : 0 };
    const sig = JSON.stringify(pos);
    if (sig !== last || Date.now() - lastSent > 3000) { last = sig; lastSent = Date.now(); net.sendPos(pos); }
  }, 200);
  addEventListener('beforeunload', () => net.leave());

  hudSetup();
  show('#loading', false); show('#hud');
  $('#online').textContent = `${app.server.name} · 1 ${t('online')}`;
  if (!localStorage.getItem('banda_tip')) { ui.chat(t('howToPlay'), 'sys'); try { localStorage.setItem('banda_tip', '1'); } catch (e) {} }
  sfx('chime'); ambience(true);
  world.start(frame);
}

// ---------------- the island: World Tower, market, playground ----------------
function buildWorld(world) {
  app.pads = [];
  const boing = () => sfx('boing');
  world.onElevatorDing = () => sfx('ding'); world.onElevatorCall = () => sfx('beep');
  app.tower = new Tower(world, {
    t, boing,
    station: (b, lv, kind, x, z, arcade) => b.spot(lv, x, z, t('g_' + kind), arcade ? 0xff3fa4 : lv === 2 ? 0x39d39a : 0x4aa8ff, () => openGame(kind)),
    pad: (b, lv, type, x, z) => addPad(world, x, z, type, b.floorY(lv)),
    panel: elev => floorPanel(elev),
    rest: (kind, room) => {
      if (world.speedNow > 0.5) return;
      if (kind === 'hotel') { const mine = myRoom(); if (!mine) return ui.toast(`🛎️ ${t('checkInFirst')}`); if (mine !== room) return ui.toast(`🚪 ${t('notYourRoom').replace('{r}', mine)}`); emote('sit'); return ui.banner(`😴 ${t('sweetDreams')}`, 2500); }
      emote('sit'); ui.toast(kind === 'cinema' ? '🍿 ' + t('relax') : kind === 'spa' ? '♨️ ' + t('relax') : '😴 ' + t('relax'));
    },
    hotelDesk: () => hotelDesk(), say: (txt, l) => say(txt, l), sfx: n => sfx(n),
    cafe: () => app.shop.openAisle('☕ ' + t('cafe'), CAFE, { cafe: true }),
  });
  app.market = new Market(world, { t, aisle: a => app.shop.openAisle(t('aisle_' + a.id), a.items), checkout: () => app.shop.checkout() });
  app.mbank = new Bank(world, { t, desk: i => app.bankUI.desk(i), someoneAt, wait: () => ui.toast(`⏳ ${t('waitInLine')}`),
    jobs: () => app.jobs.board(), cashierIn: () => app.jobs.cashierIn(), cashierOut: () => app.jobs.cashierOut() });
  app.resto = new Restaurant(world, { t, sit: seat => restoSit(seat), pass: () => app.jobs.pass() });
  app.mall = new Mall(world, { t, shop: (id, sh) => app.shop.openAisle(`${sh.icon} ${t('mall_' + id)}`, sh.items, { cafe: true }), jobs: () => app.jobs.board(), barista: on => app.jobs && app.jobs.baristaAt(on) });
  app.jobs = new Jobs(app);
  addPad(world, COURT.x - COURT.hw - 3, COURT.z, 'basketball', COURT.h);
  if (myRoom()) app.tower.setMyRoom(myRoom());
  coffeeKiosk(world, { t, cafe: () => app.shop.openAisle('☕ Island Coffee', CAFE, { cafe: true }) });
  const pg = new Playground(world, { boing, sfx });
  pg.post(5, -21.5, `▲ ${t('tower')} · ◀ mBank · 🍽️ ▶`); pg.post(-21, 5.5, `◀ ${t('market')} · 🛍️ Pentagon Mall`); pg.post(21, 5.5, `${t('playground')} ▶`); pg.post(4, 21.5, `▼ ${t('stadium')}`); pg.post(-7, -21, `☕ ${t('coffeeHere')}`);
  [[-12, -14], [12, -14]].forEach(([x, z]) => world.trampoline(x, z, boing));
}

// sit at a restaurant table: the menu opens and the waiter brings what you order
function restoSit(seat) {
  const w = app.world;
  if (app.jobs.job === 'waiter' || app.mg.active || w.inputLocked) return;
  const p = w.me.group.position; p.x = seat.x; p.z = seat.z; w.me.group.rotation.y = seat.ry; emote('sit');
  app.shop.openAisle('🍽️ ' + t('restaurant'), RESTO_MENU, { cafe: true, serve: item => { ui.toast(`🍽️ ${t('foodComing')}`); app.resto.serve(seat, ICON[item], () => { app.useItem(item); emote('sit'); }); } });
}

function addPad(world, x, z, type, y) {
  const pad = world.pad(x, z, t('mg_' + type), type === 'impostor' ? 0xd64545 : type === 'quiz' ? 0xffc94d : 0x4aa8ff);
  pad.group.position.y = y; pad.y = y; pad.type = type; app.pads.push(pad);
  world.zone({ test: (px, py, pz) => Math.hypot(px - x, pz - z) < 1.7 && Math.abs(py - y) < 1.5,
    onEnter: () => { if (app.mg.running()) return ui.toast(t('mgRunning')); pad.armed = performance.now(); },
    onStay: () => {
      if (!pad.armed || app.mg.running()) return;
      const left = 3 - (performance.now() - pad.armed) / 1000;
      ui.mgHud(`${t('mg_' + type)} · ${t('startsIn')} ${Math.max(0, Math.ceil(left))}`);
      if (left <= 0) { pad.armed = 0; ui.mgHud(null); app.mg.start(type, type === 'impostor' ? 8 : 5); }
    },
    onLeave: () => { if (pad.armed) { pad.armed = 0; ui.mgHud(null); } } });
}

// inside the elevator: pick a floor
function floorPanel(elev) {
  if (app.mg.active || app.world.carrier) return;
  const w = app.world; w.inputLocked = true; w.keys = {}; sfx('click');
  $('#bldTitle').textContent = `${t('elevator')} · ${t('chooseFloor')}`;
  $('#bldList').className = 'floors';
  $('#bldList').innerHTML = FLOORS.map((f, lv) => ({ f, lv })).reverse().map(({ f, lv }) => `<button data-lv="${lv}" class="${lv === elev.level ? 'here' : ''}"><b>${lv + 1}</b><span>${t(f)}<small>${lv === elev.level ? t('youAreHere') : t('fd_' + f.slice(2))}</small></span></button>`).join('');
  show('#bldBox');
  $$('#bldList button').forEach(b => b.onclick = () => {
    const lv = +b.dataset.lv; show('#bldBox', false); w.inputLocked = false;
    if (lv === elev.level) return stepOut(elev);
    sfx('click');
    elev.ride(lv, () => { ui.banner(`${lv + 1} · ${t(FLOORS[lv])}`, 2500); });
  });
  app.closePanel = () => stepOut(elev);
}
function stepOut(elev) { const p = app.world.me.group.position; p.z = elev.cz + 2.6; p.x = elev.cx; }
function closeBuilding() { show('#bldBox', false); app.world.inputLocked = false; if (app.closePanel) { app.closePanel(); app.closePanel = null; } else stepBack(); }
// after closing a menu, step back so it doesn't reopen at once
function stepBack() { const w = app.world, g = w.me.group; g.position.x -= Math.sin(g.rotation.y) * 1.6; g.position.z -= Math.cos(g.rotation.y) * 1.6; }
// 🛹 hoverboard: faster, and everyone sees your board (not in matches)
function setHover(on) {
  if (on && app.mg.active) return ui.toast(t('mgRunning'));
  app.hover = on; app.world.speedMul = on ? 1.7 : 1; app.world.me.setBoard(on); sfx(on ? 'zip' : 'click');
  ui.toast(on ? '🛹 ' + t('hoverOn') : '🛹 ' + t('hoverOff'));
}
app.setHover = setHover;
function emote(name) { const w = app.world; if (w.speedNow > 0.5) return; w.me.play(name); app.emoteSig = name + ':' + Date.now(); }

// Shared elevators: the host (the same player who runs the bots) moves them and tells everyone;
// everybody else sends their button presses to the host.
function shareElevators(world, net) {
  const els = app.tower.elevators, host = () => app.bots.amHost();
  world.elevAuthority = host;
  world.elevRequest = (i, lv) => net.emit('elev_req', { i, lv });
  app.onEvent(ev => {
    const d = ev.data || {};
    if (ev.type === 'elev_req' && host() && els[d.i] && Number.isInteger(d.lv) && d.lv >= 0 && d.lv < app.tower.floors) els[d.i].enqueue(d.lv);
    if (ev.type === 'elev' && !host() && Array.isArray(d.e)) d.e.forEach((s, i) => s && els[i] && els[i].applyNet(s));
  });
  let last = '', sent = 0;
  setInterval(() => {
    if (!host()) return;
    const snap = els.map(e => e.snap()), sig = JSON.stringify(snap.map(x => [x.y, x.s, x.q, x.t])), now = Date.now();
    if (sig !== last || now - sent > 2000) { last = sig; sent = now; net.emit('elev', { e: snap }); }
  }, 150);
}

// is any other player or bot standing at this spot (e.g. being served at an mBank desk)?
function someoneAt(x, z) { const w = app.world; for (const id in w.remotes) { const q = w.remotes[id].av.group.position; if (Math.hypot(q.x - x, q.z - z) < 0.9 && Math.abs(q.y - 4) < 2) return true; } return false; }
// hotel: check in at the desk to get your own room (its door light turns green)
const roomKey = () => 'banda_room_' + app.me.uid;
function myRoom() { try { return localStorage.getItem(roomKey()); } catch (e) { return null; } }
function hotelDesk() {
  let r = myRoom();
  if (!r) { const rooms = app.tower.hotelRooms || []; r = rooms[Math.floor(Math.random() * rooms.length)].num; try { localStorage.setItem(roomKey(), r); } catch (e) {} sfx('paid'); }
  app.tower.setMyRoom(r);
  ui.results(`🛎️ Island Hotel`, [t('roomIsYours').replace('{r}', r), t('roomHow')]);
}

// elevator button: call the nearest elevator to your floor, or choose a floor when you're in the cab
function elevatorHud() {
  const T = app.tower, w = app.world, p = w.me.group.position, b = $('#bElev');
  const inT = T && T.contains(p.x, p.z) && p.y > T.base - 1 && !w.carrier, near = inT && p.z < T.minZ + 8 && Math.abs(p.x - T.x) < 10;
  const cab = near && T.elevators.find(e => e.contains(p));
  show(b, !!near && !app.mg.active);
  if (!near) return;
  const txt = cab ? `🛗 ${t('chooseFloor')}` : `🛗 ${t('callElevator')}`; if (b.textContent !== txt) b.textContent = txt;
  b.onclick = () => {
    if (cab) return cab.state === 'idle' ? floorPanel(cab) : null;
    const e = T.call(p); sfx('beep'); ui.toast(e.level === T.levelAt(p.y) && e.state === 'idle' ? t('elevatorHere') : t('elevatorComing'));
  };
}

// ---------------- money (mPAY) ----------------
const logKey = () => 'banda_paylog_' + app.me.uid;
app.payLog = () => { try { return JSON.parse(localStorage.getItem(logKey())) || []; } catch (e) { return []; } };
app.logPay = (items, how) => { const l = app.payLog(); l.unshift({ items, how, total: items.reduce((a, i) => a + (PRICES[i.item] || 0) * i.qty, 0), at: Date.now() }); try { localStorage.setItem(logKey(), JSON.stringify(l.slice(0, 12))); } catch (e) {} };
app.setMoney = c => { if (typeof c !== 'number') return; app.money = c; const el = $('#meMoney'); if (el) el.textContent = money(c); };
// Money only comes from learning games and jobs. It first waits as "pending";
// small amounts arrive by themselves, bigger ones (over $5) you accept with mBank phone or hand.
const pendKey = () => 'banda_pending_' + app.me.uid;
app.pending = 0;
app.loadPending = () => { try { app.pending = +localStorage.getItem(pendKey()) || 0; } catch (e) { app.pending = 0; } };
const savePending = () => { try { localStorage.setItem(pendKey(), String(app.pending)); } catch (e) {} };
app.earn = cents => {
  cents = Math.round(cents); if (!(cents > 0)) return;
  ui.floatMoney(cents); sfx('coin'); app.pending += cents; savePending();
};
// call when a game or a work shift ends
app.settle = () => { if (app.pending <= 0) return; if (app.pending > 500) app.payout(); else credit(app.pending, null); };
async function credit(cents, how) {
  let left = cents, got = 0;
  while (left > 0) { const k = Math.min(500, left); const bal = await app.net.earn(k).catch(() => null); if (bal === null) break; left -= k; got += k; app.setMoney(bal); }
  app.pending = Math.max(0, app.pending - got); savePending();
  if (got) { const l = app.payLog(); l.unshift({ how: how || 'auto', total: got, at: Date.now() }); try { localStorage.setItem(logKey(), JSON.stringify(l.slice(0, 12))); } catch (e) {} }
  if (left > 0) ui.toast(t('dailyLimit'));
  return got;
}
app.payout = () => {
  const box = $('#payoutBox'), amt = app.pending, b = app.bank || {};
  if (!amt) return;
  app.world.inputLocked = true; app.world.keys = {};
  $('#poAmount').textContent = money(amt);
  const body = $('#poBody');
  const done = async how => {
    body.innerHTML = `<p class="mpay-msg">${t('processing')}</p>`;
    const got = await credit(amt, how); sfx('paid'); app.world.fireworks(2);
    body.innerHTML = `<p class="mpay-msg ok">✓ ${t('received')} ${money(got)} · ${t('balance')} ${money(app.money)}</p>`;
    setTimeout(() => { show(box, false); app.world.inputLocked = false; }, 1600);
  };
  const later = () => { show(box, false); app.world.inputLocked = false; ui.toast(t('moneyWaits')); };
  if (!b.card) body.innerHTML = `<div class="mpay-need"><b>🏦 ${t('needCard')}</b><span>${t('moneyWaitsCard')}</span></div><div class="row"><button class="btn" id="poLater">OK</button></div>`;
  else body.innerHTML = `<p class="po-q">${t('wantMoney')}</p><div class="paytabs"><button id="poPhone">📱 <span>${t('payPhone')}</span></button><button id="poHand">✋ <span>${t('payHand')}</span></button></div><div id="poArea"></div><button class="link light" id="poLater">${t('later')}</button>`;
  show(box);
  const lt = $('#poLater'); if (lt) lt.onclick = later;
  const ph = $('#poPhone'); if (ph) ph.onclick = () => { $('#poArea').innerHTML = `<div class="mphone"><div class="mphone-top">mBank</div><div class="bankcard small"><b>mBank</b><span class="cardno">${b.card}</span><small class="cardname">${app.me.name}</small></div><button class="btn primary big" id="poGet">${t('receive')} ${money(amt)}</button></div>`; $('#poGet').onclick = () => done('phone'); };
  const hd = $('#poHand'); if (hd) hd.onclick = () => {
    if (!b.hand) { $('#poArea').innerHTML = `<p class="mpay-msg bad">✋ ${t('handNotSet')}</p>`; return; }
    $('#poArea').innerHTML = `<div class="palm small-palm" id="poPalm"><svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="54"/><circle class="arc" cx="60" cy="60" r="54" pathLength="100"/></svg><span class="hand">🖐️</span><i class="scanline"></i></div><p class="mpay-msg">${t('holdHand')}</p>`;
    app.bankUI.scanner($('#poPalm'), () => done('hand'));
  };
};

app.setAvatar = async a => {
  const w = app.world; app.me.avatar = a;
  await app.net.saveProfile(app.me.name, a); app.net.updateMeta({ avatar: a });
  w.replacePlayer(new Avatar(a, app.me.name, app.me.role));
};
app.useItem = k => {
  const w = app.world; sfx(k === 'ball' || k === 'balloon' || k === 'teddy' ? 'cheer' : 'eat');
  const d = document.createElement('div'); d.className = 'floatStar'; d.textContent = ICON[k]; document.body.appendChild(d); setTimeout(() => d.remove(), 1300);
  const boost = (key, sec, msg) => { w.effects = { ...w.effects, [key]: true }; ui.banner(msg, 2600); clearTimeout(app['_b' + key]); app['_b' + key] = setTimeout(() => { w.effects = { ...w.effects, [key]: !!app.effects[key] }; }, sec * 1000); };
  if (k === 'balloon') boost('lowGravity', 20, `🎈 ${t('floaty')}`);
  else if (k === 'ball') { w.fireworks(3); emote('cheer'); }
  else if (k === 'teddy') emote('sit');
  else if (['coffee', 'latte', 'cocoa', 'tea'].includes(k)) boost('speed', 40, `${ICON[k]} ${t('coffeeBoost')}`);
  else boost('speed', ['pizza', 'burger', 'cake'].includes(k) ? 45 : 20, `${t('yum')} ${t('energy')}`);
};

// ---------------- Games overlay ----------------
let gameCleanup = null;
function openGame(id) {
  sfx('click');
  const w = app.world; w.inputLocked = true; w.keys = {};
  $('#gameTitle').textContent = t('g_' + id);
  show('#game');
  if (id === 'craft') w.pause(true);
  const ctx = { el: $('#gameBody'), t, sfx, lang: getLang(), say: (s, l) => say(s, l), award: n => { app.award(n); app.earn(n * 25); } };
  gameCleanup = GAMES[id].run(ctx) || null;
}
function closeGame() {
  if ($('#game').classList.contains('hidden')) return;
  try { gameCleanup && gameCleanup(); } catch (e) { console.warn(e); }
  gameCleanup = null; $('#gameBody').innerHTML = ''; show('#game', false);
  app.world.inputLocked = false; app.world.pause(false); stepBack();
  setTimeout(() => app.settle(), 300);
}

// ---------------- Stars / points ----------------
app.award = async (n, silent) => {
  if (!n || n < 1) return;
  if (!silent) { ui.floatStar(n); sfx('star'); }
  let left = Math.round(n);
  while (left > 0) { const k = Math.min(10, left); left -= k; await app.net.award(k).catch(() => {}); }
};
const totalPoints = u => (u.points || 0) + Math.floor((u.stars || 0) / CONFIG.starsPerPoint);
function renderMe() {
  if (!app.me) return;
  const u = app.users[app.me.uid] || { stars: 0, points: 0 }, tp = totalPoints(u), rem = (u.stars || 0) % CONFIG.starsPerPoint;
  $('#meName').textContent = app.me.name + (app.me.role === 'teacher' ? ` · ${t('teacher')}` : '');
  $('#meStars').textContent = u.stars || 0; $('#mePoints').textContent = tp;
  $('#meProg').style.width = (rem / CONFIG.starsPerPoint * 100) + '%';
  $('#meNext').textContent = `${rem} / ${CONFIG.starsPerPoint} ★ → +1 ${t('housePoint')}`;
  if (app.lastPoints !== undefined && tp > app.lastPoints) { ui.banner(`+${tp - app.lastPoints} ${t('housePoint')}`, 3000); sfx('champions'); app.world.fireworks(5); }
  app.lastPoints = tp;
}
function renderBoard() {
  const list = Object.values(app.users).filter(u => u.name).sort((a, b) => totalPoints(b) - totalPoints(a) || (b.stars || 0) - (a.stars || 0)).slice(0, 30);
  $('#boardList').innerHTML = list.map((u, i) => `<li class="${u.id === app.me.uid ? 'me' : ''}"><span class="rank">${i + 1}</span><span class="nm">${esc(u.name)}</span><span class="pts">${totalPoints(u)} ${t('points')} · ${u.stars || 0} ★</span></li>`).join('') || `<p>${t('noOne')}</p>`;
}

// ---------------- Events ----------------
async function onEvent(ev) {
  const d = ev.data || {}, w = app.world, kid = app.me.role !== 'teacher';
  if (ev.type === 'chat') return ui.chat(`<b>${esc(d.name)}${d.role === 'teacher' ? ' · ' + t('teacher') : ''}:</b> ${esc(d.text)}`, d.role === 'teacher' ? 'tch' : '');
  if (!ev.trusted) return; // everything below comes from a verified teacher command
  switch (ev.type) {
    case 'announce':
      $('#announceText').textContent = d.text; $('#announceBy').textContent = d.name || ''; show('#announce');
      clearTimeout(app._an); app._an = setTimeout(() => show('#announce', false), 10000);
      sfx('chime'); setTimeout(() => say(d.text, /[а-яё]/i.test(d.text) ? 'ru' : 'en'), 700);
      ui.chat(`<b>${esc(d.name)}:</b> ${esc(d.text)}`, 'sys');
      break;
    case 'giveaway': {
      sfx('cheer'); w.fireworks(4);
      if (!kid) return ui.banner(`${t('giveaway')} +${d.n} ★`, 2500);
      const got = await app.net.claim(ev.id); const n = got === null ? d.n : got;
      if (got === null) app.award(d.n, true);
      ui.banner(n ? `${t('giveaway')} +${n} ★` : t('giveaway'), 3000);
      break;
    }
    case 'starRain': { ui.banner(t('starRain'), 2500); sfx('chime'); const p = w.me.group.position; w.spawnStars(d.n, p.x, p.z, 22, () => { sfx('star'); app.award(1, true); }); break; }
    case 'fireworks': w.fireworks(12); break;
    case 'song': d.i < 0 ? stopSong() : playSong(d.i); if (d.i >= 0) ui.toast(SONGS[d.i].name); break;
    case 'sfx': sfx(d.name); break;
    case 'summon':
      if (app.mg.active || ev.from === app.me.uid) return;
      sfx('teleport'); ui.flash(); w.teleport(d.x + (Math.random() - 0.5) * 3, d.z + 2 + Math.random() * 2, undefined, d.y); ui.banner(t('summoned'), 2000);
      break;
    case 'freeze': if (kid) { w.frozenUntil = performance.now() + d.sec * 1000; ui.banner(`${t('frozen')} ${d.sec} s`, 2000); sfx('hit'); } break;
    case 'gift':
      if (d.uid === app.me.uid) { ui.banner(`${d.n > 0 ? '+' : ''}${d.n} ${t(d.kind === 'points' ? 'points' : 'stars')} · ${t('fromTeacher')}`, 3000); sfx(d.n > 0 ? 'cheer' : 'wrong'); }
      app.net.loadUsers();
      break;
    case 'mgstart': app.mg.start(d.type, d.minutes); break;
  }
}

// ---------------- Teacher panel ----------------
function teacherPanel() {
  const net = app.net, me = app.me;
  const cmd = (kind, data) => net.command(kind, data).catch(e => ui.toast(t('teacherOnly') + ' ' + (e.message || '')));
  $$('#ptabs button').forEach(b => b.onclick = () => { $$('#ptabs button').forEach(x => x.classList.toggle('on', x === b)); $$('#panel .tab').forEach(tb => show(tb, tb.dataset.tab === b.dataset.tab)); if (b.dataset.tab === 'kids') renderKids(); });
  $('#annSend').onclick = () => { const text = $('#annText').value.trim(); if (!text) return; cmd('announce', { text: text.slice(0, 200), name: me.name }); $('#annText').value = ''; ui.toast(t('sent')); };
  const toggles = ['night', 'disco', 'lowGravity', 'speed', 'giant', 'chatLock'];
  const abuse = [
    ['starRain', () => cmd('starRain', { n: 25 })], ['fireworks', () => cmd('fireworks')],
    ['night'], ['disco'], ['lowGravity'], ['speed'], ['giant'],
    ['summon', () => { const p = app.world.me.group.position; cmd('summon', { x: p.x, z: p.z, y: p.y }); }],
    ['freeze', () => cmd('freeze', { sec: 5 })], ['chatLock'],
  ];
  const grid = $('#abuseGrid'); grid.innerHTML = '';
  abuse.forEach(([k, fn]) => {
    const b = document.createElement('button'); b.className = 'tile'; b.dataset.k = k; b.innerHTML = `<span>${t('ab_' + k)}</span><small>${t('abd_' + k)}</small>`;
    b.onclick = () => { sfx('click'); if (fn) return fn(); const e = { ...app.effects, [k]: !app.effects[k] }; cmd('effects', e); if (k === 'disco') cmd('song', { i: e.disco ? 1 : -1 }); };
    grid.appendChild(b);
  });
  net.onState('effects', e => toggles.forEach(k => { const b = grid.querySelector(`[data-k=${k}]`); b && b.classList.toggle('on', !!(e && e[k])); }));
  $('#giveRow').innerHTML = '';
  [1, 5, 10, 30].forEach(n => { const b = document.createElement('button'); b.className = 'chip'; b.textContent = `+${n} ★`; b.onclick = () => cmd('giveaway', { n }); $('#giveRow').appendChild(b); });
  let dur = 5; $('#durRow').innerHTML = '';
  [5, 7, 10].forEach(m => { const b = document.createElement('button'); b.className = 'chip' + (m === dur ? ' on' : ''); b.textContent = `${m} ${t('min')}`; b.onclick = () => { dur = m; $$('#durRow button').forEach(x => x.classList.toggle('on', x === b)); }; $('#durRow').appendChild(b); });
  const q = app.mg.quiz.pending;
  $('#quizOpts').innerHTML = ['mixed', 'math', 'english', 'russian'].map(s => `<button class="chip${q.subject === s ? ' on' : ''}" data-s="${s}">${t('subj_' + s)}</button>`).join('') + ' · ' + [1, 2, 3, 4].map(l => `<button class="chip${q.level === l ? ' on' : ''}" data-l="${l}">${t('level')} ${l}</button>`).join('');
  $$('#quizOpts .chip').forEach(b => b.onclick = () => { if (b.dataset.s) q.subject = b.dataset.s; if (b.dataset.l) q.level = +b.dataset.l; teacherPanel(); });
  $('#mgGrid').innerHTML = '';
  Object.keys(MIN_PLAYERS).forEach(k => { const b = document.createElement('button'); b.className = 'tile'; b.innerHTML = `<span>${t('mg_' + k)}</span><small>${t('mgd_' + k)}</small>`; b.onclick = () => { app.mg.start(k, dur); show('#panel', false); }; $('#mgGrid').appendChild(b); });
  $('#mgEnd').onclick = () => app.mg.end();
  $('#songGrid').innerHTML = '';
  SONGS.forEach((s, i) => { const b = document.createElement('button'); b.className = 'tile'; b.innerHTML = `<span>${s.name}</span>`; b.onclick = () => cmd('song', { i }); $('#songGrid').appendChild(b); });
  { const b = document.createElement('button'); b.className = 'tile'; b.innerHTML = `<span>${t('stopMusic')}</span>`; b.onclick = () => cmd('song', { i: -1 }); $('#songGrid').appendChild(b); }
  $('#sfxGrid').innerHTML = '';
  [['champions', 'Champions!'], ['daidai', 'Дай-дай!'], ['cheer', t('sfx_cheer')], ['airhorn', t('sfx_airhorn')], ['drumroll', t('sfx_drumroll')], ['whistle', t('sfx_whistle')], ['goal', t('goal')]]
    .forEach(([k, nm]) => { const b = document.createElement('button'); b.className = 'tile'; b.innerHTML = `<span>${nm}</span>`; b.onclick = () => cmd('sfx', { name: k }); $('#sfxGrid').appendChild(b); });
}
function renderKids() {
  if (app.me.role !== 'teacher') return;
  const net = app.net, seen = new Set();
  const online = Object.values(app.players).filter(p => p.role !== 'teacher' && !seen.has(p.uid) && seen.add(p.uid));
  $('#kidList').innerHTML = online.map(p => {
    const u = app.users[p.uid] || {};
    return `<div class="kid" data-uid="${esc(p.uid)}" data-name="${esc(p.name)}"><b>${esc(p.name)} <small>${totalPoints(u)} ${t('points')} · ${u.stars || 0} ★</small></b>
      <button data-k="stars" data-n="1">+1 ★</button><button data-k="stars" data-n="5">+5 ★</button><button data-k="points" data-n="1">+1 ${t('pointShort')}</button><button data-k="points" data-n="-1">−1 ${t('pointShort')}</button></div>`;
  }).join('') || `<p>${t('noOne')}</p>`;
  $$('#kidList button').forEach(b => b.onclick = async () => {
    const row = b.closest('.kid'), uid = row.dataset.uid, name = row.dataset.name, n = +b.dataset.n, kind = b.dataset.k;
    try { await net.give(uid, kind === 'stars' ? n : 0, kind === 'points' ? n : 0); await net.command('gift', { uid, name, n, kind }); sfx('star'); }
    catch (e) { ui.toast(t('teacherOnly')); }
    setTimeout(renderKids, 400);
  });
}

// ---------------- HUD / input ----------------
function hudSetup() {
  const w = app.world, net = app.net;
  const menuState = () => { $('#muteState').textContent = isMuted() ? t('off') : t('on'); $('#qualState').textContent = w.hq ? t('qHigh') : t('qLow'); $('#menuName').textContent = app.me.name; $('#menuNext').textContent = $('#meNext').textContent; };
  $('#bMenu').onclick = () => { menuState(); show('#menu'); };
  $$('#menu .tile').forEach(b => b.addEventListener('click', () => { if (!['bMute'].includes(b.id)) show('#menu', false); }));
  $('#bMute').onclick = () => { setMuted(!isMuted()); menuState(); };
  $('#bChat').onclick = () => { const i = $('#chatIn'); show(i); i.focus(); $$('#chatLog div').forEach(d => d.classList.remove('old')); };
  $('#bEmote').onclick = () => $('#emotes').classList.toggle('hidden');
  $('#bLang').onclick = () => { setLang(getLang() === 'en' ? 'ru' : 'en'); applyI18n(); app.pads.forEach(p => w.setLabel(p, t('mg_' + p.type))); renderMe(); if (app.me.role === 'teacher') teacherPanel(); };
  $('#bBag').onclick = () => app.shop.openBag();
  $('#bPhone').onclick = () => app.phone.open();
  $('#bNew').onclick = () => whatsNew(app, true);
  // inside the Windows / Microsoft Store app: no "download the app" links
  if (/WorldIslandsApp/.test(navigator.userAgent)) { document.body.classList.add('in-app'); show('#bWin', false); }
  $('#bBoard').onclick = () => { net.loadUsers(); renderBoard(); show('#board'); };
  $('#bAvatar').onclick = () => {
    w.pause(true); show('#creator');
    avatarCreator($('#creatorBody'), { t, cfg: app.me.avatar, name: app.me.name, owned: app.shop.inv, onLocked: v => ui.toast(`🔒 ${t('it_' + v)} · ${money(PRICES[v])} · ${t('locked')}`), onCancel: () => { show('#creator', false); w.pause(false); },
      onSave: async (cfg, name) => { app.me.avatar = cfg; app.me.name = name; await net.saveProfile(name, cfg); net.updateMeta({ name, avatar: cfg }); w.replacePlayer(new Avatar(cfg, name, app.me.role)); show('#creator', false); w.pause(false); renderMe(); } });
  };
  $('#bQuality').onclick = () => { const q = w.hq ? 'low' : 'high'; try { localStorage.setItem('banda_quality', q); } catch (e) {} ui.toast(t('qualityReload')); setTimeout(() => location.reload(), 900); };
  $('#bOut').onclick = async () => { net.leave(); await signOut(); location.href = location.pathname; };
  $('#bPanel').onclick = () => show('#panel');
  $('#gameClose').onclick = closeGame;
  $('#bldClose').onclick = closeBuilding;
  $$('[data-close]').forEach(b => b.onclick = () => show(b.closest('.modal'), false));
  if (app.me.role === 'teacher') teacherPanel();
  $('#bReport').onclick = () => app.mg.impostor.report();
  $('#bKill').onclick = () => app.mg.impostor.kill(app.mg.mg);
  $('#bEmergency').onclick = () => app.mg.impostor.callEmergency(app.mg.mg);

  const chatIn = $('#chatIn');
  chatIn.onkeydown = e => {
    e.stopPropagation();
    if (e.key === 'Escape') { chatIn.blur(); show(chatIn, false); return; }
    if (e.key !== 'Enter') return;
    const text = chatIn.value.trim(); chatIn.value = ''; chatIn.blur(); show(chatIn, false);
    if (!text) return;
    if (/^\/teachers?\b/i.test(text)) return ui.toast(app.me.role === 'teacher' ? t('teacherMode') : t('notTeacherAccount'));
    if (app.effects.chatLock && app.me.role !== 'teacher') return ui.toast(t('chatLocked'));
    net.emit('chat', { name: app.me.name, role: app.me.role, text: text.slice(0, 120) });
  };
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'Enter' && $('#game').classList.contains('hidden')) { show(chatIn); chatIn.focus(); e.preventDefault(); }
    if (e.key === 'Escape') {
      if (!$('#game').classList.contains('hidden')) return closeGame();
      if (!$('#bldBox').classList.contains('hidden')) return closeBuilding();
      if (!$('#shopBox').classList.contains('hidden') || !$('#payBox').classList.contains('hidden') || !$('#bagBox').classList.contains('hidden')) return app.shop.close();
      if (!$('#bankBox').classList.contains('hidden')) return app.bankUI.close();
      if (app.phone.isOpen()) return app.phone.close();
      $$('.modal').forEach(m => !['game', 'creator', 'qModal', 'voteBox', 'quizBox'].includes(m.id) && show(m, false));
    }
    if (w.inputLocked) return;
    if (e.code === 'KeyF') app.mg.action();
    if (e.code === 'KeyR' && app.mg.active) app.mg.impostor.report();
    if (e.code === 'KeyQ' && app.mg.active) app.mg.impostor.kill(app.mg.mg);
    if (e.code === 'KeyT' && app.me.role === 'teacher') show('#panel');
    if (e.code === 'KeyM') $('#minimap').classList.toggle('big');
    const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].indexOf(e.code); if (n >= 0) emote(EMOTES[n]);
  });
  $('#bAction').onpointerdown = e => { e.preventDefault(); app.mg.action(); };
  $('#bJump').onpointerdown = e => { e.preventDefault(); w.joyJump = true; };
  const joy = $('#joy'), knob = joy.querySelector('i'); let jid = null;
  const jmove = e => {
    const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
    w.joy.x = dx; w.joy.y = -dy; w.joyRun = l > 0.95; knob.style.transform = `translate(${dx * 35}px, ${dy * 35}px)`;
  };
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); jmove(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
  const jend = () => { jid = null; w.joy.x = w.joy.y = 0; w.joyRun = false; knob.style.transform = ''; };
  joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
  $('#minimap').onclick = () => $('#minimap').classList.toggle('big');
  $('#emotes').innerHTML = EMOTES.map((e, i) => `<button class="chip dark" data-e="${e}" title="${i + 1}">${t('em_' + e)}</button>`).join('') + `<button class="chip dark" id="bHover">🛹 ${t('hoverboard')}</button>`;
  $$('#emotes button[data-e]').forEach(b => b.onclick = () => { emote(b.dataset.e); $('#emotes').classList.add('hidden'); });
  $('#bHover').onclick = () => { setHover(!app.hover); $('#emotes').classList.add('hidden'); };
  renderMe(); app.setMoney(app.money);
}

// ---------------- minimap ----------------
function drawMinimap() {
  const c = $('#minimap'), g = c.getContext('2d'), W = c.width, w = app.world, p = w.me.group.position;
  const big = c.classList.contains('big'), scale = big ? W / 360 : W / 200, cx = big ? 0 : p.x, cz = big ? 0 : p.z;
  const X = x => W / 2 + (x - cx) * scale, Z = z => W / 2 + (z - cz) * scale;
  g.clearRect(0, 0, W, W);
  g.fillStyle = '#16384c'; g.fillRect(0, 0, W, W);
  for (const I of ISLANDS) {
    g.fillStyle = '#c8b48a'; g.beginPath(); g.arc(X(I.x), Z(I.z), I.r * 1.02 * scale, 0, 7); g.fill();
    g.fillStyle = '#4f6b34'; g.beginPath(); g.arc(X(I.x), Z(I.z), I.r * 0.92 * scale, 0, 7); g.fill();
  }
  g.fillStyle = '#c9c0ae'; g.beginPath(); g.arc(X(0), Z(0), PLAZA_R * scale, 0, 7); g.fill();
  for (const P of PATHS) g.fillRect(X(P.x0), Z(P.z0), (P.x1 - P.x0) * scale, (P.z1 - P.z0) * scale);
  const rect = (x, z, ww, dd, col, label) => {
    g.fillStyle = col; g.fillRect(X(x - ww / 2), Z(z - dd / 2), ww * scale, dd * scale);
    if (label && (big || scale > 1)) { g.fillStyle = '#fff'; g.font = `700 ${big ? 15 : 11}px Manrope, system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, X(x), Z(z)); g.textBaseline = 'alphabetic'; }
  };
  g.fillStyle = '#2c4f73'; g.beginPath(); g.arc(X(TOWER.x), Z(TOWER.z), TOWER.R * scale, 0, 7); g.fill();
  if (big || scale > 1) { g.fillStyle = '#fff'; g.font = `700 ${big ? 15 : 11}px Manrope, system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t('tower'), X(TOWER.x), Z(TOWER.z)); g.textBaseline = 'alphabetic'; }
  rect(MARKET.x, MARKET.z, MARKET.w, MARKET.d, '#2e8b57', t('market'));
  rect(BANK.x, BANK.z, BANK.w, BANK.d, '#14629e', 'mBank');
  rect(PLAYGROUND.x, PLAYGROUND.z, PLAYGROUND.w, PLAYGROUND.d, '#d9533f', t('playground'));
  rect(PITCH.x, PITCH.z, PITCH.hw * 2, PITCH.hd * 2, '#3e7c30', t('stadium'));
  rect(COURT.x, COURT.z, COURT.hw * 2, COURT.hd * 2, '#b07a46', '');
  const myY = p.y;
  for (const id in w.remotes) { const q = w.remotes[id].av.group.position; if (q.y < -20 || Math.abs(q.y - myY) > 4) continue; g.fillStyle = id.startsWith('bot-') ? '#cfd8e2' : '#4aa8ff'; g.beginPath(); g.arc(X(q.x), Z(q.z), 3.5, 0, 7); g.fill(); }
  if (p.y > -20) { g.save(); g.translate(X(p.x), Z(p.z)); g.rotate(-w.me.group.rotation.y + Math.PI); g.fillStyle = '#ffc94d'; g.beginPath(); g.moveTo(0, -8); g.lineTo(5.5, 6); g.lineTo(0, 3); g.lineTo(-5.5, 6); g.fill(); g.restore(); }
}

let whereLast = '', mapT = 0, perf = { t: 0, n: 0, done: false };
function frame(dt) {
  // if the first seconds run slowly, switch to lighter graphics automatically
  if (!perf.done) { perf.t += dt; perf.n++; if (perf.t > 8) { perf.done = true; if (perf.n / perf.t < 28 && app.world.hq) { app.world.lighten(); ui.toast(t('autoLight')); } } }
  const w = app.world, p = w.me.group.position;
  const I = w.inside, under = p.y < -20;
  const where = I ? (I.building === app.tower ? `${I.level + 1} · ${t(FLOORS[I.level])}` : I.building === app.market ? t('market') : I.building === app.mbank ? 'mBank' : t('mg_impostor'))
    : (() => { const isl = w.islandAt(p.x, p.z); return isl ? t('island_' + isl.id) : t('ocean'); })();
  if (where !== whereLast) { $('#where').textContent = where; whereLast = where; const wb = $('#whereBox'); wb.classList.remove('quiet'); clearTimeout(app._wq); app._wq = setTimeout(() => wb.classList.add('quiet'), 4000); }
  app.mg.tick(dt); app.bots.tick(dt); app.tower.update(p); elevatorHud();
  if ((mapT += dt) > 0.2) { mapT = 0; show('#minimap', !under); if (!under) drawMinimap(); }
}

langChosen() ? boot() : langMenu(boot);
