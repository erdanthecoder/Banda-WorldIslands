import { CONFIG } from './config.js';
import { t, setLang, getLang, applyI18n } from './i18n.js';
import { sfx, say, playSong, stopSong, SONGS, setMuted, isMuted, unlockAudio } from './audio.js';
import { createNet } from './net.js';
import { googleSignIn, guestUser, isTeacherCode, isTeacherEmail, saveSession, savedSession, logout } from './auth.js';
import { World, Avatar, ISLANDS } from './world.js';
import { Minigames } from './minigames.js';
import { mathQuiz, speedMath, timesTable, langQuiz, wordMatch } from './games/learn.js';
import { flappy, snake, minicraft } from './games/arcade.js';

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const show = (el, on = true) => (typeof el === 'string' ? $(el) : el).classList.toggle('hidden', !on);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const wantsTeacher = /^\/teachers?(\/|$)/i.test(location.pathname);

const GAMES = {
  math: { icon: '🧮', run: mathQuiz }, speed: { icon: '⚡', run: speedMath }, times: { icon: '✖️', run: timesTable },
  english: { icon: '🇬🇧', run: c => langQuiz(c, 'en') }, russian: { icon: '🇷🇺', run: c => langQuiz(c, 'ru') }, match: { icon: '🧠', run: wordMatch },
  craft: { icon: '⛏️', run: minicraft }, flappy: { icon: '🐤', run: flappy }, snake: { icon: '🐍', run: snake },
};
const ISLAND_GAMES = { math: ['math', 'speed', 'times'], lang: ['english', 'russian', 'match'], arcade: ['craft', 'flappy', 'snake'], sports: ['football', 'dodgeball', 'hide', 'starhunt'] };
const MG_ICON = { football: '⚽', dodgeball: '🔴', hide: '🙈', starhunt: '⭐' };
const ISLAND_ICON = { hub: '🏝️', math: '🧮', lang: '🔤', arcade: '🕹️', sports: '🏟️', teacher: '🏰' };
const SPAWN = { sports: [6, -241] };

const app = {
  t, sfx, say, players: {}, users: {}, me: null, effects: {}, evCbs: [],
  onEvent(cb) { this.evCbs.push(cb); },
};
window.banda = app; // handy for debugging

// ---------------- UI helpers ----------------
const ui = app.ui = {
  toast(msg) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg; $('#toasts').appendChild(d); setTimeout(() => d.remove(), 3500); },
  banner(msg, ms = 2500) { const b = $('#banner'); b.textContent = msg; show(b); b.style.animation = 'none'; b.offsetHeight; b.style.animation = ''; clearTimeout(this._bt); this._bt = setTimeout(() => show(b, false), ms); },
  floatStar(n) { const d = document.createElement('div'); d.className = 'floatStar'; d.textContent = `+${n}⭐`; d.style.left = (40 + Math.random() * 20) + '%'; d.style.top = '45%'; document.body.appendChild(d); setTimeout(() => d.remove(), 1300); },
  mgHud(text) { show('#mgHud', !!text); if (text) $('#mgHud').textContent = text; },
  mgButtons(type) { show('#mgBtns', type === 'football' || type === 'dodgeball'); $('#bAction').textContent = type === 'dodgeball' ? '🔴' : '⚽'; },
  blind(on, n) { show('#blind', on); if (on) $('#blindN').textContent = n; },
  flash() { const f = $('#flash'); show(f); f.style.animation = 'none'; f.offsetHeight; f.style.animation = ''; setTimeout(() => show(f, false), 600); },
  results(title, lines) { $('#resTitle').textContent = title; $('#resLines').innerHTML = lines.map(l => `<p>${esc(l)}</p>`).join(''); show('#results'); },
  chat(html, cls) { const d = document.createElement('div'); if (cls) d.className = cls; d.innerHTML = html; const log = $('#chatLog'); log.appendChild(d); while (log.children.length > 40) log.firstChild.remove(); log.scrollTop = 1e9; },
};
app.toast = m => ui.toast(m);

// ---------------- Language menu ----------------
function langMenu(next) {
  show('#langMenu'); show('#login', false);
  $$('#langMenu [data-lang]').forEach(b => b.onclick = () => { unlockAudio(); sfx('click'); setLang(b.dataset.lang); applyI18n(); show('#langMenu', false); next(); });
}

// ---------------- Login ----------------
function loginScreen() {
  show('#login'); applyI18n();
  $('#loginRole').textContent = wantsTeacher ? '👑 ' + t('teacher') : '🎒 ' + t('student');
  show('#teacherBox', wantsTeacher);
  show('#guestBox', CONFIG.allowGuests || !CONFIG.googleClientId);
  const prev = savedSession(); if (prev?.user?.provider === 'guest') $('#guestName').value = prev.user.name;
  const err = k => { $('#loginErr').textContent = t(k); sfx('wrong'); };
  const finish = async user => {
    let role = 'student';
    if (wantsTeacher) {
      if (isTeacherEmail(user.email) || await isTeacherCode($('#teacherCode').value)) role = 'teacher';
      else return err('wrongCode');
    }
    saveSession({ user, role }); start(user, role);
  };
  if (!$('#gsiBtn').dataset.done) { $('#gsiBtn').dataset.done = 1; googleSignIn($('#gsiBtn'), finish, err); }
  $('#guestGo').onclick = () => { const n = $('#guestName').value.trim(); if (n.length < 2) return err('nameShort'); finish(guestUser(n)); };
  $('#guestName').onkeydown = e => { if (e.key === 'Enter') $('#guestGo').click(); };
  $('#changeLang').onclick = () => langMenu(loginScreen);
}

// ---------------- Game start ----------------
async function start(user, role) {
  show('#login', false); show('#loading'); applyI18n();
  const net = app.net = await createNet();
  const pid = user.uid + '-' + Math.random().toString(36).slice(2, 6);
  app.me = { pid, uid: user.uid, name: user.name, role, color: colorFor(user.uid) };
  document.body.classList.toggle('teacher', role === 'teacher');
  net.ensureUser(user.uid, user.name, role);

  const world = app.world = new World($('#scene'));
  world.setPlayer(new Avatar(app.me.color, user.name, role));
  world.onJump = () => sfx('jump');
  world.onFirework = () => sfx('firework');
  buildPortals(world);
  if (role === 'teacher') world.teleportIsland('teacher');

  net.onPlayers((id, d) => {
    if (id === pid) return;
    const was = app.players[id];
    if (d) app.players[id] = d; else delete app.players[id];
    world.upsertRemote(id, d, dd => new Avatar(colorFor(dd.uid || id), dd.name, dd.role));
    if (!was && d) ui.chat(`👋 <b>${esc(d.name)}</b> ${t('joined')}`, 'sys');
    if (was && !d) ui.chat(`👋 <b>${esc(was.name)}</b> ${t('left')}`, 'sys');
    if (!$('#panel').classList.contains('hidden')) renderKids();
  });
  net.onEvent(ev => { onEvent(ev); app.evCbs.forEach(cb => cb(ev)); });
  net.onUsers(u => { app.users = u; renderMe(); if (!$('#board').classList.contains('hidden')) renderBoard(); });
  net.onState('effects', e => { app.effects = e || {}; world.setEffects(app.effects); });

  app.mg = new Minigames(app);
  app.closeGame = closeGame;

  setInterval(() => {
    const p = world.me.group.position;
    net.setPresence(pid, { name: app.me.name, role: app.me.role, uid: app.me.uid, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ry: +world.me.group.rotation.y.toFixed(2), giant: !!app.effects.giant, sh: app.mg.shCount || 0 });
  }, 110);
  if (role === 'teacher') setInterval(() => net.cleanupEvents(), 30000);
  addEventListener('beforeunload', () => net.removePresence(pid));

  hudSetup();
  show('#loading', false); show('#hud');
  ui.chat(`🏝️ ${t('welcome')}, <b>${esc(user.name)}</b>! ${net.kind === 'local' ? '<i>(' + t('localMode') + ')</i>' : ''}`, 'sys');
  sfx('chime');
  world.start(frame);
}

function colorFor(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `hsl(${h % 360}, 70%, 52%)`; }

function buildPortals(world) {
  app.portals = [];
  const others = ISLANDS.filter(I => I.id !== 'hub');
  others.forEach((I, i) => {
    const a = i / others.length * Math.PI * 2 + 0.3, x = Math.cos(a) * 30, z = Math.sin(a) * 30;
    const p = world.addPortal(x, z, '', I.color, { tp: I.id }); app.portals.push(p);
    // return portal on the island
    const ang = Math.atan2(-I.z, -I.x), rx = I.x + Math.cos(ang) * 16, rz = I.z + Math.sin(ang) * 16;
    const back = I.id === 'sports' ? world.addPortal(0, -246, '', 0xffd34d, { tp: 'hub' }) : world.addPortal(rx, rz, '', 0xffd34d, { tp: 'hub' });
    app.portals.push(back);
    const list = ISLAND_GAMES[I.id] || [];
    list.forEach((g, k) => {
      let gx, gz;
      if (I.id === 'sports') { gx = [-24, -12, 12, 24][k]; gz = -243; }
      else { const ga = ang + Math.PI + (k - (list.length - 1) / 2) * 0.9; gx = I.x + Math.cos(ga) * 15; gz = I.z + Math.sin(ga) * 15; }
      const col = shade(I.color, k);
      app.portals.push(world.addPortal(gx, gz, '', col, MG_ICON[g] ? { mg: g } : { game: g }));
    });
  });
  relabelPortals();
}
function shade(base, k) { const r = (base >> 16) & 255, g = (base >> 8) & 255, b = base & 255, f = 1 - k * 0.15; return (Math.round(r * f) << 16) | (Math.round(g * f) << 8) | Math.round(b * f); }

function portalLabel(a) {
  if (a.tp) return `${ISLAND_ICON[a.tp]} ${t('island_' + a.tp)}`;
  if (a.game) return `${GAMES[a.game].icon} ${t('g_' + a.game)}`;
  return `${MG_ICON[a.mg]} ${t('mg_' + a.mg)}`;
}
function relabelPortals() { app.portals.forEach(p => app.world.setPortalLabel(p, portalLabel(p.action))); }

function usePortal(p) {
  const a = p.action, w = app.world;
  if (a.tp) {
    if (app.mg.active) return ui.toast(t('mgRunning'));
    sfx('teleport'); ui.flash();
    const s = SPAWN[a.tp]; if (s) w.teleport(s[0], s[1], Math.PI); else w.teleportIsland(a.tp);
    ui.banner(`${ISLAND_ICON[a.tp]} ${t('island_' + a.tp)}`, 1800);
  } else if (a.game) openGame(a.game);
  else if (a.mg) {
    if (app.mg.running()) return ui.toast(t('mgRunning'));
    if (Date.now() - (app.lastMgStart || 0) < 60000) return ui.toast(t('wait'));
    app.lastMgStart = Date.now();
    app.mg.start(a.mg, 5);
  }
}

// ---------------- Games overlay ----------------
let gameCleanup = null;
function openGame(id) {
  sfx('teleport');
  const w = app.world; w.inputLocked = true; w.keys = {};
  $('#gameTitle').textContent = `${GAMES[id].icon} ${t('g_' + id)}`;
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
app.award = (n, silent) => {
  if (!n) return;
  app.net.addStars(app.me.uid, n, app.me.name);
  if (!silent) { ui.floatStar(n); sfx('star'); }
};
function myUser() { return app.users[app.me.uid] || { stars: 0, points: 0 }; }
function totalPoints(u) { return (u.points || 0) + Math.floor((u.stars || 0) / CONFIG.starsPerPoint); }
function renderMe() {
  if (!app.me) return;
  const u = myUser(), tp = totalPoints(u), rem = (u.stars || 0) % CONFIG.starsPerPoint;
  $('#meName').textContent = (app.me.role === 'teacher' ? '👑 ' : '🎒 ') + app.me.name;
  $('#meStars').textContent = u.stars || 0; $('#mePoints').textContent = tp;
  $('#meProg').style.width = (rem / CONFIG.starsPerPoint * 100) + '%';
  $('#meNext').textContent = `${rem}/${CONFIG.starsPerPoint} ⭐ → +1 🏆`;
  if (app.lastPoints !== undefined && tp > app.lastPoints) { ui.banner(`🏆 +${tp - app.lastPoints} ${t('housePoint')}!`, 3000); sfx('champions'); app.world.fireworks(5); }
  app.lastPoints = tp;
}
function renderBoard() {
  const list = Object.entries(app.users).filter(([, u]) => u.role !== 'teacher')
    .sort((a, b) => totalPoints(b[1]) - totalPoints(a[1]) || (b[1].stars || 0) - (a[1].stars || 0)).slice(0, 25);
  $('#boardList').innerHTML = list.map(([id, u], i) => `<li class="${id === app.me.uid ? 'me' : ''}">${['🥇', '🥈', '🥉'][i] || ''} ${esc(u.name || '?')}<span>🏆 ${totalPoints(u)} · ⭐ ${u.stars || 0}</span></li>`).join('') || `<p>${t('noOne')}</p>`;
}

// ---------------- Events ----------------
function isTeacherEv(ev) { const p = app.players[ev.from]; return (p && p.role === 'teacher') || ev.from === app.me.pid && app.me.role === 'teacher'; }
function onEvent(ev) {
  const d = ev.data || {}, w = app.world, mine = ev.from === app.me.pid, kid = app.me.role !== 'teacher';
  switch (ev.type) {
    case 'chat':
      ui.chat(`<b>${d.role === 'teacher' ? '👑 ' : ''}${esc(d.name)}:</b> ${esc(d.text)}`, d.role === 'teacher' ? 'tch' : '');
      break;
    case 'announce': {
      if (!isTeacherEv(ev)) return;
      $('#announceText').textContent = d.text; show('#announce');
      clearTimeout(app._an); app._an = setTimeout(() => show('#announce', false), 9000);
      sfx('chime'); setTimeout(() => say(d.text, /[а-яё]/i.test(d.text) ? 'ru' : 'en'), 700);
      ui.chat(`📢 <b>${esc(d.name)}:</b> ${esc(d.text)}`, 'sys');
      break;
    }
    case 'giveaway':
      if (!isTeacherEv(ev)) return;
      ui.banner(`🎁 ${t('giveaway')} +${d.n}⭐`, 3000); sfx('cheer'); w.fireworks(4);
      if (kid) app.award(d.n);
      break;
    case 'starRain':
      if (!isTeacherEv(ev)) return;
      ui.banner(`🌠 ${t('starRain')}!`, 2500); sfx('chime');
      { const p = w.me.group.position; w.spawnStars(d.n, p.x, p.z, 22, () => app.award(1)); }
      break;
    case 'fireworks': if (isTeacherEv(ev)) w.fireworks(12); break;
    case 'song': if (isTeacherEv(ev)) { d.i < 0 ? stopSong() : playSong(d.i); if (d.i >= 0) ui.toast(`🎵 ${SONGS[d.i].name}`); } break;
    case 'sfx': if (isTeacherEv(ev)) sfx(d.name); break;
    case 'summon':
      if (!isTeacherEv(ev) || mine || app.mg.active) return;
      sfx('teleport'); ui.flash(); w.teleport(d.x + (Math.random() - 0.5) * 10, d.z + 4 + Math.random() * 6); ui.banner('🧲 ' + t('summoned'), 2000);
      break;
    case 'freeze':
      if (!isTeacherEv(ev) || !kid) return;
      w.frozenUntil = performance.now() + d.sec * 1000; ui.banner(`🧊 ${t('frozen')} ${d.sec}s`, 2000); sfx('hit');
      break;
    case 'gift':
      if (!isTeacherEv(ev)) return;
      if (d.uid === app.me.uid) { ui.banner(`${d.kind === 'points' ? '🏆' : '⭐'} ${d.n > 0 ? '+' : ''}${d.n} ${t(d.kind === 'points' ? 'points' : 'stars')} — ${t('fromTeacher')}`, 3000); sfx(d.n > 0 ? 'cheer' : 'wrong'); }
      if (d.n > 0) ui.chat(`🎁 <b>${esc(d.name)}</b> ${d.kind === 'points' ? '🏆' : '⭐'} +${d.n}`, 'sys');
      break;
  }
}

// ---------------- Teacher panel ----------------
function teacherPanel() {
  const net = app.net, me = app.me;
  const emit = (type, data) => net.emit(type, data, me.pid);
  $$('#ptabs button').forEach(b => b.onclick = () => { $$('#ptabs button').forEach(x => x.classList.toggle('on', x === b)); $$('#panel .tab').forEach(tb => show(tb, tb.dataset.tab === b.dataset.tab)); if (b.dataset.tab === 'kids') renderKids(); });
  $('#annSend').onclick = () => { const text = $('#annText').value.trim(); if (!text) return; emit('announce', { text, name: me.name }); $('#annText').value = ''; ui.toast('📢 ✓'); };
  const toggles = ['night', 'disco', 'lowGravity', 'speed', 'giant', 'chatLock'];
  const abuse = [
    ['starRain', '🌠', () => emit('starRain', { n: 25 })], ['fireworks', '🎆', () => emit('fireworks')],
    ['night', '🌙'], ['disco', '🪩'], ['lowGravity', '🪶'], ['speed', '⚡'], ['giant', '🦖'],
    ['summon', '🧲', () => { const p = app.world.me.group.position; emit('summon', { x: p.x, z: p.z }); }],
    ['freeze', '🧊', () => emit('freeze', { sec: 5 })], ['chatLock', '🔇'],
  ];
  const grid = $('#abuseGrid'); grid.innerHTML = '';
  abuse.forEach(([k, ic, fn]) => {
    const b = document.createElement('button'); b.className = 'tile'; b.dataset.k = k; b.innerHTML = `<b>${ic}</b><span>${t('ab_' + k)}</span>`;
    b.onclick = () => { sfx('click'); if (fn) return fn(); const e = { ...app.effects, [k]: !app.effects[k] }; net.setState('effects', e); if (k === 'disco') emit('song', { i: e.disco ? 1 : -1 }); };
    grid.appendChild(b);
  });
  net.onState('effects', e => toggles.forEach(k => { const b = grid.querySelector(`[data-k=${k}]`); b && b.classList.toggle('on', !!(e && e[k])); }));
  $('#giveRow').innerHTML = '';
  [1, 5, 10, 30].forEach(n => { const b = document.createElement('button'); b.textContent = `🎁 +${n}⭐`; b.onclick = () => emit('giveaway', { n }); $('#giveRow').appendChild(b); });
  let dur = 5; $('#durRow').innerHTML = '';
  [5, 7, 10].forEach(m => { const b = document.createElement('button'); b.textContent = `${m} ${t('min')}`; b.classList.toggle('on', m === dur); b.onclick = () => { dur = m; $$('#durRow button').forEach(x => x.classList.toggle('on', x === b)); }; $('#durRow').appendChild(b); });
  $('#mgGrid').innerHTML = '';
  Object.keys(MG_ICON).forEach(k => { const b = document.createElement('button'); b.className = 'tile'; b.innerHTML = `<b>${MG_ICON[k]}</b><span>${t('mg_' + k)}</span>`; b.onclick = () => { app.mg.start(k, dur); show('#panel', false); }; $('#mgGrid').appendChild(b); });
  $('#mgEnd').onclick = () => app.mg.end();
  $('#songGrid').innerHTML = '';
  SONGS.forEach((s, i) => { const b = document.createElement('button'); b.className = 'tile'; b.innerHTML = `<b>${['🏆', '🔥', '🎉', '🥁', '🌊'][i]}</b><span>${s.name}</span>`; b.onclick = () => emit('song', { i }); $('#songGrid').appendChild(b); });
  { const b = document.createElement('button'); b.className = 'tile'; b.innerHTML = `<b>⏹</b><span>${t('stopMusic')}</span>`; b.onclick = () => emit('song', { i: -1 }); $('#songGrid').appendChild(b); }
  $('#sfxGrid').innerHTML = '';
  [['champions', '🏆', 'Champions!'], ['daidai', '🥁', 'Дай-дай!'], ['cheer', '👏', t('sfx_cheer')], ['airhorn', '📯', t('sfx_airhorn')], ['drumroll', '🥁', t('sfx_drumroll')], ['whistle', '😗', t('sfx_whistle')], ['goal', '⚽', t('goal')]]
    .forEach(([k, ic, nm]) => { const b = document.createElement('button'); b.className = 'tile'; b.innerHTML = `<b>${ic}</b><span>${nm}</span>`; b.onclick = () => emit('sfx', { name: k }); $('#sfxGrid').appendChild(b); });
}
function renderKids() {
  if (app.me.role !== 'teacher') return;
  const net = app.net, me = app.me, seen = new Set();
  const online = Object.values(app.players).filter(p => p.role !== 'teacher' && !seen.has(p.uid) && seen.add(p.uid));
  $('#kidList').innerHTML = online.map(p => {
    const u = app.users[p.uid] || {};
    return `<div class="kid" data-uid="${esc(p.uid)}" data-name="${esc(p.name)}"><b>🎒 ${esc(p.name)} <small>🏆${totalPoints(u)} ⭐${u.stars || 0}</small></b>
      <button data-k="stars" data-n="1">⭐+1</button><button data-k="stars" data-n="5">⭐+5</button><button data-k="points" data-n="1">🏆+1</button><button data-k="points" data-n="-1">🏆−1</button></div>`;
  }).join('') || `<p>${t('noOne')}</p>`;
  $$('#kidList button').forEach(b => b.onclick = () => {
    const row = b.closest('.kid'), uid = row.dataset.uid, name = row.dataset.name, n = +b.dataset.n, kind = b.dataset.k;
    kind === 'points' ? net.addPoints(uid, n, name) : net.addStars(uid, n, name);
    net.emit('gift', { uid, name, n, kind }, me.pid); sfx('star');
    setTimeout(renderKids, 300);
  });
}

// ---------------- HUD / input ----------------
function hudSetup() {
  const w = app.world, net = app.net;
  $('#bMute').onclick = () => { setMuted(!isMuted()); $('#bMute').textContent = isMuted() ? '🔇' : '🔊'; };
  $('#bLang').onclick = () => { setLang(getLang() === 'en' ? 'ru' : 'en'); applyI18n(); relabelPortals(); renderMe(); if (app.me.role === 'teacher') teacherPanel(); };
  $('#bBoard').onclick = () => { renderBoard(); show('#board'); };
  $('#bMap').onclick = () => {
    $('#mapList').innerHTML = '';
    ISLANDS.forEach(I => { const b = document.createElement('button'); b.className = 'tile'; b.innerHTML = `<b>${ISLAND_ICON[I.id]}</b><span>${t('island_' + I.id)}</span>`; b.onclick = () => { show('#map', false); usePortal({ action: { tp: I.id } }); }; $('#mapList').appendChild(b); });
    show('#map');
  };
  $('#bOut').onclick = () => { logout(); net.removePresence(app.me.pid); location.reload(); };
  $('#bPanel').onclick = () => show('#panel');
  $('#gameClose').onclick = closeGame;
  $$('[data-close]').forEach(b => b.onclick = () => show(b.closest('.modal'), false));
  if (app.me.role === 'teacher') teacherPanel();

  // chat + commands
  const chatIn = $('#chatIn');
  chatIn.onkeydown = async e => {
    e.stopPropagation();
    if (e.key === 'Escape') return chatIn.blur();
    if (e.key !== 'Enter') return;
    const text = chatIn.value.trim(); chatIn.value = ''; chatIn.blur();
    if (!text) return;
    if (/^\/teachers?$/i.test(text)) return becomeTeacher();
    if (/^\/student$/i.test(text)) { setRole('student'); return; }
    if (app.effects.chatLock && app.me.role !== 'teacher') return ui.toast('🔇 ' + t('chatLocked'));
    net.emit('chat', { name: app.me.name, role: app.me.role, text: text.slice(0, 120) }, app.me.pid);
  };
  addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'Enter' && $('#game').classList.contains('hidden')) { chatIn.focus(); e.preventDefault(); }
    if (e.key === '/' && $('#game').classList.contains('hidden')) { chatIn.focus(); }
    if (e.key === 'Escape') { closeGame(); $$('.modal').forEach(m => m.id !== 'game' && show(m, false)); }
    if (e.code === 'KeyE' && !w.inputLocked) { const p = w.nearestPortal(); if (p) usePortal(p); }
    if (e.code === 'KeyF' && !w.inputLocked) app.mg.action();
    if (e.code === 'KeyT' && app.me.role === 'teacher' && !w.inputLocked) show('#panel');
  });
  $('#prompt').onclick = () => { const p = w.nearestPortal(); if (p) usePortal(p); };
  $('#bUse').onclick = () => { const p = w.nearestPortal(); if (p) usePortal(p); else app.mg.action(); };
  $('#bAction').onpointerdown = e => { e.preventDefault(); app.mg.action(); };
  $('#bJump').onpointerdown = e => { e.preventDefault(); w.joyJump = true; };
  // joystick
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

async function becomeTeacher() {
  if (app.me.role === 'teacher') return ui.toast('👑 ✓');
  const code = prompt(t('teacherCode'));
  if (code && await isTeacherCode(code)) setRole('teacher'); else { ui.toast('❌ ' + t('wrongCode')); sfx('wrong'); }
}
function setRole(role) {
  const me = app.me, w = app.world; me.role = role;
  document.body.classList.toggle('teacher', role === 'teacher');
  const pos = w.me.group.position.clone(), ry = w.me.group.rotation.y;
  w.scene.remove(w.me.group); w.me = new Avatar(me.color, me.name, role); w.scene.add(w.me.group); w.me.group.position.copy(pos); w.me.group.rotation.y = ry;
  const s = savedSession(); if (s) saveSession({ ...s, role });
  app.net.ensureUser(me.uid, me.name, role);
  if (role === 'teacher') { teacherPanel(); ui.banner('👑 ' + t('teacherMode'), 2500); sfx('champions'); }
  renderMe();
}

let whereLast = '';
function frame(dt) {
  const w = app.world, p = w.me.group.position;
  const near = !w.inputLocked && w.nearestPortal();
  show('#prompt', !!near);
  if (near) { const txt = `${matchMedia('(pointer: coarse)').matches ? '👆' : '[E]'} ${near.label}`; if ($('#prompt').textContent !== txt) $('#prompt').textContent = txt; }
  const I = w.islandAt(p.x, p.z), where = I ? `${ISLAND_ICON[I.id]} ${t('island_' + I.id)}` : `🌊 ${t('ocean')}`;
  if (where !== whereLast) { $('#where').textContent = where; whereLast = where; }
  app.mg.tick(dt);
}

// ---------------- boot ----------------
langMenu(loginScreen);
