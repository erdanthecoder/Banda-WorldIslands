// 🎮 Marbly experience runtime: everything the games share.
// Signs you in (FlexiHub account), loads your avatar and mBank money, builds an empty world for the game,
// shows everyone else who is playing, the HUD, phone controls, mPAY payments and admin abuse.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { World } from '../world.js';
import { Avatar, EMOTES } from '../avatar.js';
import { currentAccount } from '../auth.js';
import { createNet } from '../net.js';
import { sfx, setMuted, isMuted, unlockAudio, playSong, stopSong } from '../audio.js';
import { t, getLang } from '../i18n.js';
import { Shop, money } from '../shop.js';
import { MPay } from '../mpay.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const L = (en, ru) => (getLang() === 'ru' && ru ? ru : en);
export { esc, money };

// admin abuse everyone gets in every game (the game adds its own on top)
const COMMON = [
  { a: 'fireworks', icon: '🎆', en: 'Fireworks', ru: 'Салют' },
  { a: 'lowgrav', icon: '🪶', en: 'Moon gravity', ru: 'Лунная гравитация' },
  { a: 'giant', icon: '🦒', en: 'Everyone giant', ru: 'Все великаны' },
  { a: 'tiny', icon: '🐜', en: 'Everyone tiny', ru: 'Все крошечные' },
  { a: 'speed', icon: '⚡', en: 'Super speed', ru: 'Супер скорость' },
  { a: 'disco', icon: '🪩', en: 'Disco lights', ru: 'Диско' },
  { a: 'dance', icon: '💃', en: 'Everyone dances', ru: 'Все танцуют' },
  { a: 'confetti', icon: '🎊', en: 'Confetti rain', ru: 'Дождь конфетти' },
];

export async function experience(def) {
  const app = { id: def.id, t, L, sfx, players: {}, evCbs: [], money: 0, def };
  window.marbly = app;
  document.title = `${def.title} · Marbly`;
  hudDom(def);
  const account = await currentAccount();
  if (!account) { location.href = '/'; return; }
  const net = app.net = createNet(account);
  const row = await net.myRow().catch(() => null);
  if (!row || !row.avatar || !Object.keys(row.avatar).length || !row.name) { location.href = '/'; return; }
  app.account = account;
  app.me = { uid: account.user.id, pid: account.user.id.slice(0, 8) + '-' + Math.random().toString(36).slice(2, 6), role: account.profile.role === 'teacher' ? 'teacher' : 'student', name: row.name, avatar: row.avatar };
  app.money = row.money_cents ?? 10000;
  app.bank = { card: row.bank_card || null, hand: !!row.hand_pay };
  app.ui = ui; app.toast = m => ui.toast(m);
  app.setMoney = c => { if (typeof c !== 'number') return; app.money = c; $('#xMoney').textContent = money(c); };
  app.refreshMoney = async () => { const r = await net.myRow().catch(() => null); if (r) { app.setMoney(r.money_cents); app.bank = { card: r.bank_card || null, hand: !!r.hand_pay }; } };

  let quality = 'high'; try { quality = localStorage.getItem('banda_quality') || (matchMedia('(pointer: coarse)').matches ? 'low' : 'high'); } catch (e) {}
  const world = app.world = new World($('#scene'), { quality, blank: { ground: def.ground ?? 0 } });
  Avatar.blobShadows = !world.hq;
  world.setPlayer(new Avatar(app.me.avatar, app.me.name, app.me.role));
  world.onJump = () => sfx('jump'); world.onFirework = () => sfx('firework');
  if (def.sun) world._setSun(...def.sun);
  world.water.position.y = def.sea ?? -3; // the sea sits below the game's floor
  // realistic reflections on glass, metal and car paint
  try { world.scene.environment = world.pmrem.fromScene(new RoomEnvironment(), 0.04).texture; world.scene.environmentIntensity = 0.55; } catch (e) {}
  app.shop = new Shop(app); app.mpay = new MPay(app);
  app.emit = (type, data) => net.emit(type, data);
  app.onEvent = cb => app.evCbs.push(cb);
  // the host is whoever has the smallest id among everyone here: it runs shared things (races, quizzes, bots)
  app.isHost = () => [app.me.pid, ...Object.keys(app.players)].sort()[0] === app.me.pid;
  app.count = () => Object.keys(app.players).length + 1;
  app.buy = (item, cb) => app.shop.buyService(item, cb);

  await def.build(app);
  const sp = def.spawn || [0, 0, 0];
  world.teleport(sp[0], sp[1], sp[2]);
  if (!world.hq) world.dropPointLights();

  net.onPlayers((id, d) => {
    const was = app.players[id];
    if (d) app.players[id] = d; else delete app.players[id];
    world.upsertRemote(id, d, dd => new Avatar(dd.avatar, dd.name, dd.role));
    if (!was && d && d.name) ui.toast(`👋 ${d.name} ${L('joined', 'зашёл')}`);
    $('#xOnline').textContent = `${app.count()} ${L('online', 'онлайн')}`;
    def.onPlayers && def.onPlayers(app);
  });
  net.onEvent(ev => { if (ev.trusted) adminEvent(app, ev); app.evCbs.forEach(cb => cb(ev)); });
  await net.joinServer(def.server || def.id + '-1', { pid: app.me.pid, uid: app.me.uid, name: app.me.name, role: app.me.role, avatar: app.me.avatar });
  $('#xOnline').textContent = `${app.count()} ${L('online', 'онлайн')}`;

  // send my position a few times a second (only when it changes)
  let last = '', lastSent = 0;
  setInterval(() => {
    const g = world.me.group, p = g.position;
    const pos = { x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2), ry: +g.rotation.y.toFixed(2), em: world.me.emote ? app.emoteSig || '' : '', giant: !!world.effects.giant, tiny: !!world.tiny, ...(app.extraPos ? app.extraPos() : {}) };
    const sig = JSON.stringify(pos);
    if (sig !== last || Date.now() - lastSent > 3000) { last = sig; lastSent = Date.now(); net.sendPos(pos); }
  }, 150);
  addEventListener('beforeunload', () => net.leave());

  hudSetup(app);
  app.setMoney(app.money);
  $('#xLoading').classList.add('hidden');
  sfx('chime');
  world.start((dt, tt) => def.frame && def.frame(dt, tt, app));
  def.started && def.started(app);
  return app;
}

// ---------- HUD ----------
const ui = {
  toast(msg) { const d = document.createElement('div'); d.className = 'x-toast'; d.textContent = msg; $('#xToasts').appendChild(d); setTimeout(() => d.remove(), 3500); },
  banner(msg, ms = 2600) { const b = $('#xBanner'); b.textContent = msg; b.classList.remove('hidden'); b.style.animation = 'none'; b.offsetHeight; b.style.animation = ''; clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.add('hidden'), ms); },
  hud(html) { const h = $('#xHud'); h.classList.toggle('hidden', !html); if (html) h.innerHTML = html; },
  modal(title, html) { $('#xModalT').textContent = title; $('#xModalB').innerHTML = html; $('#xModal').classList.remove('hidden'); if (window.marbly?.world) { window.marbly.world.inputLocked = true; window.marbly.world.keys = {}; } return $('#xModalB'); },
  close() { $('#xModal').classList.add('hidden'); if (window.marbly?.world) window.marbly.world.inputLocked = false; },
};
export { ui };

function hudDom(def) {
  document.body.insertAdjacentHTML('beforeend', `
    <div id="xLoading" class="x-loading"><div class="x-logo">Marbly</div><div class="x-sub">${esc(def.icon)} ${esc(L(def.title, def.titleRu))}</div><div class="spinner"></div></div>
    <div class="x-top">
      <a class="x-btn" href="/" title="Marbly">⬅ <b>Marbly</b></a>
      <div class="x-chip"><span>${esc(def.icon)} ${esc(L(def.title, def.titleRu))}</span><small id="xOnline"></small></div>
      <div class="x-chip money" id="xMoneyChip">💳 <b id="xMoney">$0.00</b></div>
      <div class="x-right"><button class="x-btn" id="xEmote" title="Emotes">😀</button><button class="x-btn" id="xSnd">🔊</button><button class="x-btn admin" id="xAdmin" title="Admin">🛡️</button></div>
    </div>
    <div id="xEmotes" class="x-emotes hidden"></div>
    <div id="xHud" class="x-hud hidden"></div>
    <div id="xBanner" class="x-banner hidden"></div>
    <div id="xToasts" class="x-toasts"></div>
    <div id="xModal" class="modal hidden"><div class="sheet small x-sheet"><div class="sheet-head"><h2 id="xModalT"></h2><button class="ibtn light" id="xModalX">✕</button></div><div id="xModalB"></div></div></div>
    <div id="xTouch" class="x-touch hidden"><div id="xJoy" class="x-joy"><i></i></div><button id="xJump" class="x-jump">⤒</button></div>
    <div id="xFlash" class="x-flash"></div>`);
  $('#xModalX').onclick = () => ui.close();
}

function hudSetup(app) {
  const w = app.world;
  $('#xSnd').onclick = () => { setMuted(!isMuted()); $('#xSnd').textContent = isMuted() ? '🔇' : '🔊'; };
  $('#xAdmin').onclick = () => openAdmin(app);
  $('#xMoneyChip').onclick = () => app.mpay.scratch();
  addEventListener('pointerdown', () => unlockAudio(), { once: true });
  // emotes
  $('#xEmotes').innerHTML = EMOTES.map(e => `<button class="x-btn" data-e="${e}">${t('em_' + e)}</button>`).join('');
  $('#xEmote').onclick = () => $('#xEmotes').classList.toggle('hidden');
  const emote = e => { w.me.play(e); app.emoteSig = e + ':' + Date.now(); };
  app.emote = emote;
  document.querySelectorAll('#xEmotes [data-e]').forEach(b => b.onclick = () => { emote(b.dataset.e); $('#xEmotes').classList.add('hidden'); });
  addEventListener('keydown', e => { if (w.inputLocked || /INPUT|TEXTAREA/.test(e.target.tagName)) return; const n = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9'].indexOf(e.code); if (n >= 0 && EMOTES[n]) emote(EMOTES[n]); });
  // phones: joystick and jump
  if (matchMedia('(pointer: coarse)').matches) {
    $('#xTouch').classList.remove('hidden');
    const joy = $('#xJoy'), knob = joy.querySelector('i'); let jid = null;
    const move = e => { const r = joy.getBoundingClientRect(); let dx = (e.clientX - r.left - r.width / 2) / (r.width / 2), dy = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; } w.joy.x = dx; w.joy.y = -dy; w.joyRun = l > 0.95; knob.style.transform = `translate(${dx * 35}px, ${dy * 35}px)`; };
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); move(e); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === jid) move(e); });
    const end = () => { jid = null; w.joy.x = w.joy.y = 0; w.joyRun = false; knob.style.transform = ''; };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
    $('#xJump').onpointerdown = e => { e.preventDefault(); w.joyJump = true; app.def.onJump && app.def.onJump(app); };
  }
}

// ---------- admin abuse ----------
// The password is never in this file: the server checks it (and locks you out after 5 wrong tries).
let PW = null;
function openAdmin(app) {
  if (!PW) {
    const b = ui.modal('🛡️ ' + L('Admin', 'Админ'), `<p class="muted">${L('Enter the admin password.', 'Введи пароль админа.')}</p>
      <form id="xPwF" class="x-pw"><input id="xPw" type="password" autocomplete="off" maxlength="64" placeholder="••••••••"><button class="btn primary">${L('Unlock', 'Открыть')}</button></form><p id="xPwMsg" class="x-err"></p>`);
    $('#xPw').focus();
    $('#xPwF').onsubmit = async e => {
      e.preventDefault(); const pw = $('#xPw').value; if (!pw) return;
      $('#xPwMsg').textContent = '…';
      try { const ok = await app.net.admin(pw, 'check'); if (!ok) { $('#xPwMsg').textContent = L('Wrong password.', 'Неверный пароль.'); sfx('wrong'); return; } PW = pw; sfx('star'); openAdmin(app); }
      catch (er) { $('#xPwMsg').textContent = /locked/.test(er.message || '') ? L('Too many wrong tries. Try again in 15 minutes.', 'Слишком много попыток. Попробуй через 15 минут.') : L('Could not check. Try again.', 'Не получилось. Попробуй ещё.'); }
    };
    void b; return;
  }
  const own = app.def.admin || [];
  const btn = x => `<button class="tile x-adm" data-a="${x.a}"><span>${x.icon} ${esc(L(x.en, x.ru))}</span></button>`;
  ui.modal('🛡️ ' + L('Admin abuse', 'Админ-абуз') + ' · ' + L(app.def.title, app.def.titleRu), `
    ${own.length ? `<h4>${esc(app.def.icon)} ${L('This game', 'Эта игра')}</h4><div class="menu-grid">${own.map(btn).join('')}</div>` : ''}
    <h4>🌍 ${L('Everyone, everywhere', 'Для всех')}</h4><div class="menu-grid">${COMMON.map(btn).join('')}</div>
    <h4>📣 ${L('Announcement', 'Объявление')}</h4><div class="x-pw"><input id="xAnn" maxlength="200" placeholder="${L('Say something to everyone…', 'Напиши всем…')}"><button class="btn" id="xAnnGo">➤</button></div>
    <h4>💰 ${L('Money', 'Деньги')}</h4><div class="x-pw"><input id="xCash" type="number" min="0.01" max="10000" step="0.01" value="10"><button class="btn" id="xCashMe">${L('To me', 'Мне')}</button><button class="btn" id="xCashAll">${L('To everyone', 'Всем')}</button></div>
    <p class="muted small">${L('Works in every Marbly game.', 'Работает во всех играх Marbly.')}</p>`);
  const send = async (kind, data) => { try { const ok = await app.net.admin(PW, kind, data); if (!ok) { PW = null; ui.toast(L('Password changed. Unlock again.', 'Пароль сменился.')); } return ok; } catch (e) { ui.toast('⚠️ ' + (e.message || 'error')); return false; } };
  document.querySelectorAll('#xModalB .x-adm').forEach(b => b.onclick = async () => {
    const a = b.dataset.a, mine = own.some(x => x.a === a);
    if (a === 'fireworks') await send('fireworks', {});
    else await send('xp', { exp: mine ? app.def.id : '*', a, by: app.me.name });
    b.classList.add('on'); setTimeout(() => b.classList.remove('on'), 600);
  });
  $('#xAnnGo').onclick = async () => { const text = $('#xAnn').value.trim(); if (text && await send('announce', { text: text.slice(0, 200), name: '🛡️ ' + app.me.name })) { $('#xAnn').value = ''; ui.toast('📣 ✓'); } };
  const cents = () => Math.round(Math.min(10000, Math.max(0.01, +$('#xCash').value || 0)) * 100);
  $('#xCashMe').onclick = async () => { try { const bal = await app.net.adminMoney(PW, cents()); app.setMoney(bal); sfx('paid'); } catch (e) { ui.toast('⚠️ ' + e.message); } };
  $('#xCashAll').onclick = async () => { if (await send('moneyall', { cents: cents() })) ui.toast(`💸 ${money(cents())} → ${L('everyone', 'всем')}`); };
}

// admin commands arrive here in every game; the game handles its own ones
function adminEvent(app, ev) {
  const w = app.world, d = ev.data || {};
  if (ev.type === 'fireworks') { w.fireworks(12); return; }
  if (ev.type === 'announce') { ui.banner(`${d.name ? d.name + ': ' : ''}${d.text}`, 7000); sfx('chime'); return; }
  if (ev.type === 'money' && d.uid === app.me.uid) { app.refreshMoney(); ui.toast(`💸 +${money(d.cents)}`); sfx('paid'); return; }
  if (ev.type === 'moneyall') { app.net.claimMoney(ev.id, d.cents).then(n => { if (n) { app.refreshMoney(); ui.toast(`💸 +${money(n)} 🎁`); sfx('paid'); } }).catch(() => {}); return; }
  if (ev.type !== 'xp') return;
  if (d.exp !== '*' && d.exp !== app.def.id) return;
  if (d.by) ui.toast(`🛡️ ${d.by}`);
  const timed = (k, s = 30) => { w.setEffects({ ...w.effects, [k]: true }); setTimeout(() => w.setEffects({ ...w.effects, [k]: false }), s * 1000); };
  switch (d.a) {
    case 'lowgrav': timed('lowGravity'); ui.banner('🪶 ' + L('Moon gravity!', 'Лунная гравитация!')); break;
    case 'giant': timed('giant'); ui.banner('🦒 ' + L('Everyone is giant!', 'Все великаны!')); break;
    case 'tiny': w.tiny = true; setTimeout(() => (w.tiny = false), 30000); ui.banner('🐜 ' + L('Everyone is tiny!', 'Все крошечные!')); break;
    case 'speed': timed('speed'); ui.banner('⚡ ' + L('Super speed!', 'Супер скорость!')); break;
    case 'disco': timed('disco', 40); playSong(5); setTimeout(() => stopSong(), 40000); ui.banner('🪩 ' + L('Disco time!', 'Диско!')); break;
    case 'dance': app.emote('dance'); ui.banner('💃 ' + L('Everybody dance!', 'Все танцуют!')); break;
    case 'confetti': confetti(); break;
    default: app.def.onAdmin && app.def.onAdmin(d.a, d, app);
  }
}

export function confetti(n = 120) {
  for (let i = 0; i < n; i++) {
    const c = document.createElement('i'); c.className = 'x-conf';
    c.style.left = Math.random() * 100 + 'vw'; c.style.background = `hsl(${Math.random() * 360}, 90%, 60%)`; c.style.animationDelay = Math.random() * 1.5 + 's'; c.style.animationDuration = 2 + Math.random() * 2 + 's';
    document.body.appendChild(c); setTimeout(() => c.remove(), 5000);
  }
  sfx('cheer');
}
export function flash() { const f = $('#xFlash'); f.classList.remove('on'); f.offsetHeight; f.classList.add('on'); }

// small 3D helpers the games share
export const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
export function mesh(world, geo, mat, x, y, z, { ry = 0, cast = true, solid = false } = {}) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = true; world.scene.add(m);
  if (solid) { const b = new THREE.Box3().setFromObject(m); world.solids.push({ x: (b.min.x + b.max.x) / 2, z: (b.min.z + b.max.z) / 2, hw: (b.max.x - b.min.x) / 2, hd: (b.max.z - b.min.z) / 2, rot: 0, y0: b.min.y - 2, y1: b.max.y }); }
  return m;
}
export function canvasTexture(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; return tx; }
