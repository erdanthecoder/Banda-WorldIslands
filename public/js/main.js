import { CONFIG, DEV } from './config.js';
import { t, setLang, getLang, applyI18n, langChosen } from './i18n.js';
import { sfx, say, playSong, stopSong, SONGS, setMuted, isMuted, unlockAudio } from './audio.js';
import { createNet } from './net.js';
import { currentAccount, signInWithHub, signOut } from './auth.js';
import { World, ISLANDS, isl, heightAt } from './world.js';
import { Avatar, avatarCreator, randomAvatar } from './avatar.js';
import { Metro } from './metro.js';
import { Minigames, MIN_PLAYERS } from './minigames.js';
import { mathQuiz, speedMath, timesTable, langQuiz, wordMatch } from './games/learn.js';
import { flappy, snake, minicraft } from './games/arcade.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const show = (el, on = true) => (typeof el === 'string' ? $(el) : el).classList.toggle('hidden', !on);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wantsTeacher = /^\/teachers?(\/|$)/i.test(location.pathname) || (DEV && new URLSearchParams(location.search).has('teacher'));

const GAMES = {
  math: { run: mathQuiz }, speed: { run: speedMath }, times: { run: timesTable },
  english: { run: c => langQuiz(c, 'en') }, russian: { run: c => langQuiz(c, 'ru') }, match: { run: wordMatch },
  craft: { run: minicraft }, flappy: { run: flappy }, snake: { run: snake },
};
const ISLAND_SETUP = {
  hub: { building: { name: 'Banda School', tex: 'stone', w: 26, h: 14 }, angle: -Math.PI / 2, kiosks: [{ mg: 'quiz' }, { mg: 'starhunt' }, { mg: 'hide' }] },
  math: { building: { name: 'Math Academy', tex: 'glass', h: 16 }, kiosks: [{ game: 'math' }, { game: 'speed' }, { game: 'times' }] },
  lang: { building: { name: 'Language Library', tex: 'brick', h: 12 }, kiosks: [{ game: 'english' }, { game: 'russian' }, { game: 'match' }] },
  arcade: { building: { name: 'Arcade Hall', tex: 'concrete', h: 10 }, kiosks: [{ game: 'craft' }, { game: 'flappy' }, { game: 'snake' }, { mg: 'impostor' }] },
  teacher: { building: { name: 'Teachers’ Hall', tex: 'stone', w: 24, h: 13 }, kiosks: [] },
};

const app = { t, sfx, say, players: {}, users: {}, me: null, effects: {}, evCbs: [], onEvent(cb) { this.evCbs.push(cb); } };
window.banda = app;

// ---------------- UI helpers ----------------
const ui = app.ui = {
  toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; $('#toasts').appendChild(d); setTimeout(() => d.remove(), 3500); },
  banner(msg, ms = 2500) { const b = $('#banner'); b.textContent = msg; show(b); b.style.animation = 'none'; b.offsetHeight; b.style.animation = ''; clearTimeout(this._bt); this._bt = setTimeout(() => show(b, false), ms); },
  floatStar(n) { const d = document.createElement('div'); d.className = 'floatStar'; d.textContent = `+${n} ★`; document.body.appendChild(d); setTimeout(() => d.remove(), 1300); },
  mgHud(text) { show('#mgHud', !!text); if (text && $('#mgHud').textContent !== text) $('#mgHud').textContent = text; },
  mgButtons(type) { show('#mgBtns', type === 'football' || type === 'dodgeball'); $('#bAction').textContent = type === 'dodgeball' ? t('throw') : t('kick'); },
  impostorButtons(s) { show('#impBtns', !!s); if (s) { $('#bReport').disabled = !s.report; $('#bKill').classList.toggle('hidden', s.kill === undefined || !app.mg.impostor.role(app.mg.mg).startsWith('imp')); $('#bKill').disabled = !s.kill; } },
  blind(on, n) { show('#blind', on); if (on) $('#blindN').textContent = n; },
  flash() { const f = $('#flash'); show(f); f.style.animation = 'none'; f.offsetHeight; f.style.animation = ''; setTimeout(() => show(f, false), 600); },
  fade(on) { $('#fade').classList.toggle('on', on); },
  results(title, lines) { $('#resTitle').textContent = title; $('#resLines').innerHTML = lines.map(l => `<p>${esc(l)}</p>`).join(''); show('#results'); },
  chat(html, cls) { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; const log = $('#chatLog'); log.appendChild(d); while (log.children.length > 50) log.firstChild.remove(); log.scrollTop = 1e9; },
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
  const row = await net.myRow().catch(() => null);
  const role = account.profile.role === 'teacher' ? 'teacher' : 'student';
  if (wantsTeacher && role !== 'teacher') ui.toast(t('notTeacherAccount'));
  app.me = { uid: account.user.id, pid: account.user.id.slice(0, 8) + '-' + Math.random().toString(36).slice(2, 6), role, name: row?.name || account.profile.full_name || '', avatar: row?.avatar && Object.keys(row.avatar).length ? row.avatar : null };
  if (!app.me.avatar || !app.me.name) {
    show('#creator');
    avatarCreator($('#creatorBody'), { t, cfg: app.me.avatar || randomAvatar(), name: app.me.name, onSave: async (cfg, name) => { app.me.avatar = cfg; app.me.name = name; await net.saveProfile(name, cfg); show('#creator', false); serverScreen(); } });
  } else serverScreen();
}

function signInScreen() {
  show('#signin');
  $('#signRole').textContent = wantsTeacher ? t('teacher') : t('student');
  $('#signBtn').onclick = () => signInWithHub(wantsTeacher);
  $('#signLang').onclick = () => { show('#signin', false); langMenu(signInScreen); };
}

function serverScreen() {
  show('#servers');
  const counts = {}; let picked = false;
  const draw = () => {
    $('#serverList').innerHTML = CONFIG.servers.map(s => {
      const n = counts[s.id] || 0, full = n >= CONFIG.maxPlayersPerServer;
      return `<button class="server" data-id="${s.id}" ${full ? 'disabled' : ''}><span class="dot ${n ? 'on' : ''}"></span><b>${s.name}</b><span>${n} / ${CONFIG.maxPlayersPerServer} ${t('players')}</span></button>`;
    }).join('');
    $$('#serverList .server').forEach(b => b.onclick = () => { if (picked) return; picked = true; show('#servers', false); start(b.dataset.id); });
  };
  app.net.watchLobby(c => { Object.keys(counts).forEach(k => delete counts[k]); Object.assign(counts, c); draw(); });
  draw();
  $('#serverHello').textContent = `${t('hello')}, ${app.me.name}`;
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
  world.setPlayer(new Avatar(me.avatar, me.name, me.role));
  world.onJump = () => sfx('jump'); world.onFirework = () => sfx('firework');
  buildIslands(world);
  app.metro = new Metro(world, { title: 'Banda Metro', board: t('boardTrain'), stations: ISLANDS.map(I => t('island_' + I.id)) });
  if (me.role === 'teacher') teleportTo('teacher');

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
  app.mg = new Minigames(app); app.closeGame = closeGame;

  let last = '', lastSent = 0;
  setInterval(() => {
    const g = world.me.group, p = g.position;
    const pos = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ry: +g.rotation.y.toFixed(2), giant: !!app.effects.giant, sh: app.mg.shCount || 0 };
    const sig = JSON.stringify(pos);
    if (sig !== last || Date.now() - lastSent > 3000) { last = sig; lastSent = Date.now(); net.sendPos(pos); }
  }, 200);
  addEventListener('beforeunload', () => net.leave());

  hudSetup();
  show('#loading', false); show('#hud');
  $('#online').textContent = `${app.server.name} · 1 ${t('online')}`;
  ui.chat(`${t('welcome')}, <b>${esc(me.name)}</b> · ${esc(app.server.name)}${net.kind === 'local' ? ' <i>(dev)</i>' : ''}`, 'sys');
  sfx('chime');
  world.start(frame);
}

function buildIslands(world) {
  app.kiosks = [];
  for (const I of ISLANDS) {
    const out = Math.atan2(I.z, I.x), setup = ISLAND_SETUP[I.id];
    if (I.id === 'sports') {
      [{ mg: 'football' }, { mg: 'dodgeball' }].forEach((a, k) => app.kiosks.push(world.kiosk(-5 + k * 10, -263, '', a, Math.PI)));
      app.kiosks.push(world.metroEntrance(-24, -263, Math.PI / 2, '', { metro: 'sports' }));
      continue;
    }
    const ang = setup.angle ?? (I.id === 'hub' ? -Math.PI / 2 : out);
    const door = world.building(I, ang, 30, { w: 22, d: 12, ...setup.building });
    const face = Math.atan2(-Math.cos(ang), -Math.sin(ang)), tx = -Math.sin(ang), tz = Math.cos(ang);
    setup.kiosks.forEach((a, k) => {
      const off = (k - (setup.kiosks.length - 1) / 2) * 3.4;
      app.kiosks.push(world.kiosk(door.x + tx * off - Math.cos(ang) * 2, door.z + tz * off - Math.sin(ang) * 2, '', a, face));
    });
    const ma = ang + Math.PI / 2, mx = I.x + Math.cos(ma) * 15, mz = I.z + Math.sin(ma) * 15;
    app.kiosks.push(world.metroEntrance(mx, mz, Math.atan2(-Math.cos(ma), -Math.sin(ma)), '', { metro: I.id }));
  }
  relabel();
}
function kioskLabel(a) {
  if (a.metro) return `Ⓜ ${t('metro')} · ${t('island_' + a.metro)}`;
  if (a.game) return t('g_' + a.game);
  if (a.mg) return t('mg_' + a.mg);
  return '';
}
function relabel() { app.kiosks.forEach(p => app.world.setKioskLabel(p, kioskLabel(p.action))); }

function stationExit(id) {
  if (id === 'sports') return [-24 + 4.8, -263];
  const I = isl(id), ang = (ISLAND_SETUP[id].angle ?? (id === 'hub' ? -Math.PI / 2 : Math.atan2(I.z, I.x))) + Math.PI / 2;
  return [I.x + Math.cos(ang) * 9.5, I.z + Math.sin(ang) * 9.5];
}
function teleportTo(id) { const [x, z] = stationExit(id); app.world.teleport(x, z); }

// ---------------- interaction ----------------
function usePortal(p) {
  const a = p.action, mg = app.mg;
  if (a.metro) {
    if (mg.active) return ui.toast(t('mgRunning'));
    app.metroFrom = a.metro; sfx('teleport'); ui.fade(true);
    setTimeout(() => { app.metro.enter(); ui.fade(false); ui.banner(t('metroPlatform'), 2200); }, 450);
  } else if (a.board) {
    if (app.metro.state !== 'docked') return ui.toast(t('trainComing'));
    metroDestinations();
  } else if (a.game) openGame(a.game);
  else if (a.mg) {
    if (mg.running()) return ui.toast(t('mgRunning'));
    if (Date.now() - (app.lastMgStart || 0) < 60000) return ui.toast(t('wait'));
    app.lastMgStart = Date.now();
    mg.start(a.mg, a.mg === 'impostor' ? 8 : 5);
  } else if (a.task !== undefined) mg.impostor.doTask(a.task, mg.mg);
  else if (a.emergency) mg.impostor.callEmergency(mg.mg);
}

function metroDestinations() {
  $('#metroList').innerHTML = ISLANDS.filter(I => I.id !== app.metroFrom).map(I => `<button class="tile" data-id="${I.id}"><span>${t('island_' + I.id)}</span><small>${t('isl_desc_' + I.id)}</small></button>`).join('');
  show('#metroBox');
  $$('#metroList .tile').forEach(b => b.onclick = () => {
    show('#metroBox', false); sfx('teleport');
    const dest = b.dataset.id;
    ui.banner(`${t('nextStation')}: ${t('island_' + dest)}`, 3000);
    app.metro.ride(() => { ui.fade(true); setTimeout(() => { teleportTo(dest); ui.fade(false); ui.banner(t('island_' + dest), 2000); }, 400); });
  });
}

// ---------------- Games overlay ----------------
let gameCleanup = null;
function openGame(id) {
  sfx('click');
  const w = app.world; w.inputLocked = true; w.keys = {};
  $('#gameTitle').textContent = t('g_' + id);
  show('#game');
  if (id === 'craft') w.pause(true);
  const ctx = { el: $('#gameBody'), t, sfx, lang: getLang(), say: (s, l) => say(s, l), award: n => app.award(n) };
  gameCleanup = GAMES[id].run(ctx) || null;
}
function closeGame() {
  if ($('#game').classList.contains('hidden')) return;
  try { gameCleanup && gameCleanup(); } catch (e) { console.warn(e); }
  gameCleanup = null; $('#gameBody').innerHTML = ''; show('#game', false);
  app.world.inputLocked = false; app.world.pause(false);
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
      sfx('teleport'); ui.flash(); w.teleport(d.x + (Math.random() - 0.5) * 8, d.z + 3 + Math.random() * 5); ui.banner(t('summoned'), 2000);
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
    ['summon', () => { const p = app.world.me.group.position; cmd('summon', { x: p.x, z: p.z }); }],
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
  $('#bMute').onclick = () => { setMuted(!isMuted()); $('#bMute').classList.toggle('off', isMuted()); };
  $('#bLang').onclick = () => { setLang(getLang() === 'en' ? 'ru' : 'en'); applyI18n(); relabel(); renderMe(); if (app.me.role === 'teacher') teacherPanel(); };
  $('#bBoard').onclick = () => { net.loadUsers(); renderBoard(); show('#board'); };
  $('#bAvatar').onclick = () => {
    w.pause(true); show('#creator');
    avatarCreator($('#creatorBody'), { t, cfg: app.me.avatar, name: app.me.name, onCancel: () => { show('#creator', false); w.pause(false); },
      onSave: async (cfg, name) => { app.me.avatar = cfg; app.me.name = name; await net.saveProfile(name, cfg); net.updateMeta({ name, avatar: cfg }); w.replacePlayer(new Avatar(cfg, name, app.me.role)); show('#creator', false); w.pause(false); renderMe(); } });
  };
  $('#bQuality').onclick = () => { const q = w.hq ? 'low' : 'high'; try { localStorage.setItem('banda_quality', q); } catch (e) {} ui.toast(t('qualityReload')); setTimeout(() => location.reload(), 900); };
  $('#bOut').onclick = async () => { net.leave(); await signOut(); location.href = location.pathname; };
  $('#bPanel').onclick = () => show('#panel');
  $('#gameClose').onclick = closeGame;
  $$('[data-close]').forEach(b => b.onclick = () => show(b.closest('.modal'), false));
  if (app.me.role === 'teacher') teacherPanel();
  $('#bReport').onclick = () => app.mg.impostor.report();
  $('#bKill').onclick = () => app.mg.impostor.kill(app.mg.mg);

  const chatIn = $('#chatIn');
  chatIn.onkeydown = e => {
    e.stopPropagation();
    if (e.key === 'Escape') return chatIn.blur();
    if (e.key !== 'Enter') return;
    const text = chatIn.value.trim(); chatIn.value = ''; chatIn.blur();
    if (!text) return;
    if (/^\/teachers?\b/i.test(text)) return ui.toast(app.me.role === 'teacher' ? t('teacherMode') : t('notTeacherAccount'));
    if (app.effects.chatLock && app.me.role !== 'teacher') return ui.toast(t('chatLocked'));
    net.emit('chat', { name: app.me.name, role: app.me.role, text: text.slice(0, 120) });
  };
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if (e.key === 'Enter' && $('#game').classList.contains('hidden')) { chatIn.focus(); e.preventDefault(); }
    if (e.key === 'Escape') { closeGame(); $$('.modal').forEach(m => !['game', 'creator', 'qModal', 'voteBox', 'quizBox'].includes(m.id) && show(m, false)); }
    if (w.inputLocked) return;
    if (e.code === 'KeyE') { const p = w.nearestPortal(); if (p) usePortal(p); }
    if (e.code === 'KeyF') app.mg.action();
    if (e.code === 'KeyR' && app.mg.active) app.mg.impostor.report();
    if (e.code === 'KeyQ' && app.mg.active) app.mg.impostor.kill(app.mg.mg);
    if (e.code === 'KeyT' && app.me.role === 'teacher') show('#panel');
  });
  $('#prompt').onclick = () => { const p = w.nearestPortal(); if (p) usePortal(p); };
  $('#bUse').onclick = () => { const p = w.nearestPortal(); if (p) usePortal(p); else app.mg.action(); };
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
  renderMe();
}

let whereLast = '';
function frame(dt) {
  const w = app.world, p = w.me.group.position;
  const near = !w.inputLocked && w.nearestPortal();
  show('#prompt', !!near);
  if (near) { const txt = `${matchMedia('(pointer: coarse)').matches ? '' : 'E · '}${near.label}`; if ($('#prompt').textContent !== txt) $('#prompt').textContent = txt; }
  const where = w.inside ? (w.inside === app.metro.interior ? t('metro') : t('mg_impostor')) : (() => { const I = w.islandAt(p.x, p.z); return I ? t('island_' + I.id) : t('ocean'); })();
  if (where !== whereLast) { $('#where').textContent = where; whereLast = where; }
  app.mg.tick(dt);
}

langChosen() ? boot() : langMenu(boot);
