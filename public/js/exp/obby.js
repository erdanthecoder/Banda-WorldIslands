// 🧗 Mega Obby: a Roblox-style obstacle course — 36 stages through Candy Land, Lava Caves, Frozen Peaks, the Jungle
// Temple, a Space Station and the Sky Castle. Checkpoints are saved, bot climbers run the course with you, a live board
// shows everyone's stage, and whoever reaches the trophy room joins today's winners wall.
import * as THREE from 'three';
import { experience, L, ui, std, confetti, esc, money } from './core.js';
import { Coins } from './fun.js';
import { labelSprite } from '../world.js';
import { Avatar, randomAvatar } from '../avatar.js';
import { People } from './people.js';
import { ZONES, G, LOBBY_R, buildCourse, cellAt, inside, solidOn, blk, M } from './obby-course.js';

const LAST = 36, SPAWN = [-6, 0, -Math.PI / 2], EPOCH = 1.7e12, SKIP_MS = 10 * 60 * 1000, SAVE = 'marbly_obby';
const BOTS = [['Pro Pasha', 0.95], ['Jumpy Jess', 0.8], ['Speedy Sam', 0.68], ['Obby Olya', 0.55], ['Noob Nikita', 0.4], ['Bacon Bob', 0.28]];
const SWAP = { KeyW: 'KeyS', KeyS: 'KeyW', KeyA: 'KeyD', KeyD: 'KeyA', ArrowUp: 'ArrowDown', ArrowDown: 'ArrowUp', ArrowLeft: 'ArrowRight', ArrowRight: 'ArrowLeft' };
const $ = s => document.querySelector(s);
const yawFor = d => Math.atan2(-d[0], -d[1]);
const fmt = ms => { const s = Math.max(0, ms) / 1000; return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`; };
const today = () => new Date().toISOString().slice(0, 10);
let A;

experience({
  id: 'obby', title: 'Mega Obby', titleRu: 'Мега Обби', icon: '🧗', spawn: SPAWN, sun: [42, 135], ground: 0, sea: -0.6,
  admin: [
    { a: 'olava', icon: '🌋', en: 'Rising lava for everyone', ru: 'Лава поднимается у всех' },
    { a: 'orestart', icon: '⏮️', en: 'Everyone back to stage 1', ru: 'Все на 1-й этап' },
    { a: 'oskip', icon: '⏩', en: 'Everyone skips 5 stages', ru: 'Всем +5 этапов' },
    { a: 'ovanish', icon: '👻', en: 'Platforms vanish for 10 s', ru: 'Платформы исчезают на 10 с' },
    { a: 'ofast', icon: '🌀', en: 'Spinners & movers 3× speed', ru: 'Вертушки и платформы ×3' },
    { a: 'oreverse', icon: '🔀', en: 'Reverse controls', ru: 'Управление наоборот' },
    { a: 'oice', icon: '🧊', en: 'Ice mode: everything slippery', ru: 'Режим льда: всё скользит' },
    { a: 'otramp', icon: '🤸', en: 'Kill bricks become trampolines', ru: 'Красные блоки — батуты' },
    { a: 'osafe', icon: '🛡️', en: 'Safe mode: kill bricks off', ru: 'Безопасный режим: без красных блоков' },
    { a: 'obots', icon: '🤪', en: 'Bots go crazy', ru: 'Боты сходят с ума' },
    { a: 'oball', icon: '⚽', en: 'Giant ball rolls down the course', ru: 'Гигантский мяч катится по трассе' },
    { a: 'obridge', icon: '🌈', en: 'Rainbow bridge to the next stage', ru: 'Радужный мост к следующему этапу' },
  ],
  build, frame, onAdmin, started, onJump: () => (G.jp = performance.now()),
});

// ---------- saving ----------
function load() { try { return JSON.parse(localStorage.getItem(SAVE)) || {}; } catch (e) { return {}; } }
function save() { try { localStorage.setItem(SAVE, JSON.stringify({ cp: G.cp, best: G.best, ms: Math.round(G.ms), deaths: G.deaths, skip: G.skipAt, paid: G.paid, bt: G.bt, wins: G.wins })); } catch (e) {} }

// ---------- build ----------
function build(app) {
  A = app; const w = app.world;
  w.scene.fog.density = 0.0032;
  buildCourse(w);
  G.falls = G.blocks.filter(b => b.k === 'fall'); G.blinks = G.blocks.filter(b => b.blink); G.spins = G.blocks.filter(b => b.spin);
  // every block of the course is ground you can stand on
  w.grounds.push((x, z, y) => {
    let best = null;
    for (const list of [cellAt(x, z), G.movers]) for (const b of list) if (solidOn(b) && y >= b.top - 0.6 && inside(b, x, z) && (best === null || b.top > best)) best = b.top;
    return best;
  });
  const s = load(); Object.assign(G, { cp: Math.min(37, s.cp || 0), best: s.best || 0, ms: s.ms || 0, deaths: s.deaths || 0, skipAt: s.skip || 0, paid: s.paid || 0, bt: s.bt || 0, wins: s.wins || 0, bots: [], botAv: {}, win: { day: today(), list: [] }, pv: [0, 0], knockT: 0 });
  try { const wl = JSON.parse(localStorage.getItem(SAVE + '_win')); if (wl && wl.day === today()) G.win = wl; } catch (e) {}
  app.coins = new Coins(app, { respawn: 60 });
  for (const [x, y, z, v, big] of G.coins) app.coins.add(x, y, z, v, big);
  app.people = new People(w, { rings: [{ cx: -3, cz: 0, rx: 12, rz: 12, n: w.hq ? 14 : 8, stops: [{ x: -10, z: -6.5, face: -2.2 }, { x: -10, z: 6.5, face: -1 }, { x: 10, z: 0, face: Math.PI / 2 }] }], far: 90 });
  poofSetup(w); hud(app);
  app.extraPos = () => ({ st: G.cp });
  // shared state: the bots (the host runs them) and today's winners
  app.net.onState('obots', b => { if (Array.isArray(b) && (!app.isHost() || !G.bots.length)) G.bots = b; });
  app.net.onState('owin', v => { if (v && v.day === today() && Array.isArray(v.list)) { mergeWin(v.list); } });
  app.onEvent(ev => { if (ev.type === 'ofin' && ev.data && app.isHost()) addWinner(ev.data); });
  addEventListener('keydown', e => {
    if (/INPUT|TEXTAREA/.test(e.target.tagName) || w.inputLocked) return;
    if (e.code === 'Space' && !e.repeat) G.jp = performance.now();
    if (e.code === 'KeyR') die(true);
  });
  app.obby = { G, claim, die, respawn, finish, skip, plan, pose, player };
  w.snapshotStatic();
}

function started(app) {
  setTimeout(() => app.world.batchStatic(), 2500);
  if (G.cp >= 1) { respawn(); ui.banner(G.cp >= 37 ? '🏆 ' + L('Welcome back, champion! Play again from the trophy room.', 'С возвращением, чемпион! Сыграй ещё раз из комнаты трофеев.') : `🚩 ${L('Welcome back! You are on stage', 'С возвращением! Ты на этапе')} ${G.cp}`, 4500); }
  else ui.banner('🧗 ' + L('MEGA OBBY! 36 stages, 6 worlds. Run through the arch to start!', 'МЕГА ОББИ! 36 этапов, 6 миров. Беги в арку, чтобы начать!'), 5000);
  setTimeout(() => { if (!G.bots.length && app.isHost()) seedBots(); }, 2500);
  drawWalls(); paintFlags();
}

// ---------- HUD: stage card, leaderboard, skip and respawn buttons ----------
function hud(app) {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="ob-card" id="obCard"><div class="ob-zone" id="obZone"></div><div class="ob-st"><small>${L('STAGE', 'ЭТАП')}</small><b id="obN">0</b><i>/${LAST}</i></div>
      <div class="ob-row"><span id="obT">⏱ 0:00.0</span><span id="obD">💀 0</span></div><div class="ob-bar"><i id="obBar"></i></div></div>
    <div class="ob-board" id="obBoard"><h4><span id="obBT">🏁 ${L('Who is where', 'Кто где')}</span><button class="x-btn" id="obWin" title="${L('Winners today', 'Победители дня')}">🏆</button></h4><ol id="obList"></ol></div>`);
  app.skipBtn = Object.assign(document.createElement('button'), { className: 'x-act', title: L('Free skip (every 10 min)', 'Бесплатный пропуск (раз в 10 мин)') }); app.skipBtn.onclick = () => skip(); document.body.appendChild(app.skipBtn);
  app.resBtn = Object.assign(document.createElement('button'), { className: 'x-act x-act2', innerHTML: '🔄<small>R</small>', title: L('Back to checkpoint (R)', 'Назад на чекпоинт (R)') }); app.resBtn.onclick = () => die(true); document.body.appendChild(app.resBtn);
  $('#obWin').onclick = () => winnersModal();
  $('#obBT').onclick = () => $('#obBoard').classList.toggle('min');
}
function hudTick(app) {
  const w = app.world, n = Math.max(0, Math.min(G.cp, 37)), Z = ZONES[Math.max(0, Math.min(5, Math.floor((Math.max(1, Math.min(n, LAST)) - 1) / 6)))];
  $('#obCard').style.setProperty('--zc', Z.css);
  $('#obZone').textContent = n === 0 ? '🏠 ' + L('Lobby', 'Лобби') : n >= 37 ? '🏆 ' + L('Finished!', 'Пройдено!') : `${Z.icon} ${L(Z.en, Z.ru)}`;
  $('#obN').textContent = n >= 37 ? '🏆' : n;
  $('#obT').textContent = '⏱ ' + fmt(G.ms); $('#obD').textContent = '💀 ' + G.deaths;
  $('#obBar').style.width = (Math.min(n, LAST) / LAST * 100) + '%';
  // skip: free once every 10 minutes
  const left = SKIP_MS - (Date.now() - G.skipAt), ok = left <= 0 && G.cp >= 1 && G.cp < LAST;
  app.skipBtn.classList.toggle('ready', ok); app.skipBtn.innerHTML = `⏭<small>${ok ? L('Skip', 'Пропуск') : left > 0 ? fmt(left).slice(0, -2) : L('Skip', 'Пропуск')}</small>`;
  // the leaderboard: players and bots by stage
  const rows = [{ nm: app.me.name, st: G.cp, me: true }];
  for (const id in app.players) { const d = app.players[id] || {}, r = w.remotes[id]; rows.push({ nm: d.name || '?', st: (r && r.d && r.d.st) ?? d.st ?? 0 }); }
  for (const b of G.bots) rows.push({ nm: '🤖 ' + b.nm, st: b.n });
  rows.sort((a, b) => b.st - a.st || (a.me ? -1 : 1));
  const mi = rows.findIndex(r => r.me), show = rows.slice(0, 8); if (mi >= 8) show.push(rows[mi]);
  $('#obList').innerHTML = show.map(r => `<li class="${r.me ? 'me' : ''}"><span>${rows.indexOf(r) + 1}</span><b>${esc(r.nm)}</b><em>${r.st >= 37 ? '🏆' : r.st ? (ZONES[Math.floor((r.st - 1) / 6)]?.icon || '') + ' ' + r.st : '🏠'}</em></li>`).join('');
}
function winnersModal() {
  const list = [...G.win.list].sort((a, b) => a.t - b.t);
  ui.modal('🏆 ' + L('Winners today', 'Победители дня'), list.length ? `<ol class="ob-wins">${list.map((x, i) => `<li><span>${['🥇', '🥈', '🥉'][i] || i + 1}</span><b>${esc(x.nm)}</b><em>${fmt(x.t * 1000)}</em></li>`).join('')}</ol>` : `<p class="muted">${L('Nobody has finished today yet. Be the first!', 'Сегодня ещё никто не прошёл. Будь первым!')}</p>`);
}

// ---------- every frame ----------
function frame(dt, t, app) {
  const w = app.world, now = performance.now(), p = w.me.group.position;
  const fast = G.fastUntil > now, dck = dt * (fast ? 3 : 1);
  G.warp = (G.warp || 0) + (fast ? 2 * dt : 0);
  const ck = G.ck = (Date.now() - EPOCH) / 1000 + G.warp;
  // moving platforms carry you; turning discs turn you
  for (const b of G.movers) {
    if (!b.move) continue; const [x, y, z] = b.at(ck);
    if (G.stand === b) { p.x += x - b.x; p.z += z - b.z; }
    b.x = x; b.z = z; b.top = y; b.m.position.set(x, y - b.h / 2, z);
  }
  for (const b of G.spins) { b.m.rotation.y = b.spin * ck; if (G.stand === b) { const a = b.spin * dck, rx = p.x - b.x, rz = p.z - b.z; p.x = b.x + rx * Math.cos(a) + rz * Math.sin(a); p.z = b.z - rx * Math.sin(a) + rz * Math.cos(a); w.me.group.rotation.y += a; } }
  courseFx(app, dt, t, ck, now);
  if (!w.carrier) player(app, dt, ck, now);
  bots(app, dt, ck, now);
  if (app.isHost()) hostTick(app, ck);
  app.coins.update(dt, t); poofTick(dt);
  if (G.cp >= 1 && G.cp <= LAST && !document.hidden) G.ms += dt * 1000;
  if ((G._h = (G._h || 0) + dt) > 0.3) { G._h = 0; hudTick(app); }
  if ((G._s = (G._s || 0) + dt) > 3) { G._s = 0; save(); }
}

// the look of things: blinking, crumbling, spinning, lava, warnings
function courseFx(app, dt, t, ck, now) {
  const p = app.world.me.group.position;
  for (const H of G.hz) { if (H.t === 'bar') H.g.rotation.y = H.ph + H.sp * ck; else if (H.upd) H.upd(ck, dt); }
  for (const f of G.fx) f(ck, dt, p);
  for (const Lv of G.lavas) Lv.m.position.y = Lv.y(ck);
  M.lavaT.offset.set(t * 0.02, t * 0.03); if (G.lavaTex) G.lavaTex.offset.set(t * 0.01, t * 0.02);
  const safe = G.safeUntil > now, tramp = G.trampUntil > now;
  M.kill.color.setHex(safe ? 0x3ddc84 : tramp ? 0xb388ff : 0xff2a3a); M.kill.emissive.setHex(safe ? 0x0a6a30 : tramp ? 0x5a2aa0 : 0xff1020); M.kill.emissiveIntensity = 0.55 + Math.sin(t * 5) * 0.25;
  if (G.trophy) G.trophy.rotation.y += dt * 0.5;
  // blinking blocks fade out before they vanish
  for (const b of G.blinks) { const on = b.blink(ck), warn = on && !b.blink(ck + 0.7); b.on = on; b.m.material.opacity = G.vanish ? 0.12 : !on ? 0.13 : warn ? (Math.floor(ck * 10) % 2 ? 0.35 : 0.95) : 0.95; }
  // crumbling blocks: shake, fall, come back
  for (const b of G.falls) {
    if (!b.t) continue; const e = now - b.t, m = b.m;
    if (e < 550) m.position.set(b.bx + (Math.random() - 0.5) * 0.12, b.by - b.h / 2, b.bz + (Math.random() - 0.5) * 0.12);
    else if (e < 3500) { if (b.on) { b.on = false; m.material.transparent = true; app.sfx('pop'); } m.position.y -= dt * 9; m.material.opacity = Math.max(0, 1 - (e - 550) / 900); }
    else { b.on = true; b.t = 0; m.position.set(b.bx, b.by - b.h / 2, b.bz); m.material.opacity = 1; m.material.transparent = false; }
  }
  // 👻 admin: platforms flicker, then vanish for 10 s (checkpoints stay)
  const warn = G.vanishAt && now > G.vanishAt - 2500 && now < G.vanishAt, gone = G.vanishAt && now >= G.vanishAt && now < G.vanishAt + 10000;
  if (gone !== !!G.vanish) { G.vanish = gone; if (!gone) G.vanishAt = 0; }
  const fade = gone ? 0.13 : warn ? (Math.floor(now / 120) % 2 ? 0.4 : 1) : 1;
  if (fade !== G._fade) { G._fade = fade; fadeMats(fade); }
}
function fadeMats(a) {
  if (!G.fadeSet) { G.fadeSet = new Set(); for (const b of G.blocks) if (!b.keep && !b.blink && b.k !== 'fall') G.fadeSet.add(b.m.material); }
  for (const m of G.fadeSet) { const tr = a < 1; if (m.transparent !== tr) { m.transparent = tr; m.needsUpdate = true; } m.opacity = a; m.depthWrite = !tr; }
}

// ---------- the player: ground types, hazards, wind, ladders, wall jumps ----------
function standBlock(p) {
  let best = null;
  for (const list of [cellAt(p.x, p.z), G.movers]) for (const b of list) if (solidOn(b) && Math.abs(p.y - b.top) < 0.15 && inside(b, p.x, p.z) && (!best || b.top > best.top)) best = b;
  return best;
}
function player(app, dt, ck, now) {
  const w = app.world, p = w.me.group.position, v = w.vel, safe = G.safeUntil > now, tramp = G.trampUntil > now;
  // reverse controls (admin): swap the keys and flip the joystick
  const rev = G.revUntil > now;
  if (rev && !w.keys.__rev) { const k = w.keys; w.keys = new Proxy(k, { get: (o, n) => (n === '__rev' ? true : o[SWAP[n] || n]) }); }
  if (rev && !w.joy.__rev) { const j = w.joy; w.joy = new Proxy(j, { get: (o, n) => (n === '__rev' ? true : n === 'x' || n === 'y' ? -o[n] : o[n]) }); }
  if (!rev && w.keys.__rev) w.keys = {}; if (!rev && w.joy.__rev) w.joy = { x: 0, y: 0 };
  const b = standBlock(p); G.stand = b;
  const on = w.onGround && b;
  let slip = G.iceUntil > now && w.onGround;
  if (on) {
    if (b.cp) { if (b.cp === 37) finish(app); else claim(app, b.cp); }
    if (b.act === 'again') again(app); else if (b.act === 'home') home(app);
    if (b.k === 'bounce' || (b.k === 'kill' && tramp)) { v.y = b.k === 'kill' ? 16 : b.pow; w.onGround = false; app.sfx('boing'); b.m.scale.y = 0.6; setTimeout(() => (b.m.scale.y = 1), 140); }
    if (b.k === 'fall' && !b.t) { b.t = now; app.sfx('click'); }
    if (b.k === 'conv') { p.x += b.cv[0] * b.sp * dt; p.z += b.cv[1] * b.sp * dt; }
    if (b.k === 'ice') slip = true;
  }
  // ice: keep most of the speed you had (and correct this frame's move to match)
  if (slip) { const nx = G.pv[0] + (v.x - G.pv[0]) * 0.06, nz = G.pv[1] + (v.z - G.pv[1]) * 0.06; p.x += (nx - v.x) * dt; p.z += (nz - v.z) * dt; v.x = nx; v.z = nz; }
  // kill bricks hurt when you touch them (top or side)
  if (!safe && !tramp) for (const list of [cellAt(p.x, p.z), G.movers]) for (const k of list) {
    if (k.k !== 'kill' || !solidOn(k)) continue;
    if ((k.r ? Math.hypot(p.x - k.x, p.z - k.z) < k.r + 0.35 : Math.abs(p.x - k.x) < k.hw + 0.35 && Math.abs(p.z - k.z) < k.hd + 0.35) && p.y < k.top + 0.05 && p.y + 1.7 > k.top - k.h) return die();
  }
  // spinners, lasers, fire jets and swinging logs
  for (const H of G.hz) {
    if (Math.abs(H.x - p.x) > 13 || Math.abs(H.z - p.z) > 13) continue;
    if (H.t === 'bar') {
      if (p.y > H.y + 0.25 || p.y < H.y - 1.6) continue;
      const th = H.ph + H.sp * ck, dx = p.x - H.x, dz = p.z - H.z;
      for (let k = 0; k < H.arms; k++) {
        const be = th + k / H.arms * Math.PI * 2, ax = Math.cos(be), az = -Math.sin(be), s = Math.max(0, Math.min(H.len, dx * ax + dz * az));
        if (Math.hypot(dx - ax * s, dz - az * s) < 0.5) { const sg = Math.sign(H.sp); if (hit(app, H, [-Math.sin(be) * sg, -Math.cos(be) * sg], safe)) return; break; }
      }
    } else if (H.on(ck) && Math.abs(p.x - H.x) < H.hw + 0.3 && Math.abs(p.z - H.z) < H.hd + 0.3 && p.y < H.y1 && p.y + 1.7 > H.y0) { if (hit(app, H, H.kn || [0, 0], safe)) return; }
  }
  // wind and updrafts
  for (const Wd of G.winds) if (Math.abs(p.x - Wd.x) < Wd.hw && Math.abs(p.z - Wd.z) < Wd.hd && p.y >= Wd.y0 && p.y <= Wd.y1) {
    const [fx, fy, fz] = Wd.f(ck); p.x += fx * dt; p.z += fz * dt; if (fy) { v.y = Math.min(v.y + fy * dt, 6.5); w.onGround = false; }
  }
  // ladders: push towards them (or jump) to climb
  for (const Ld of G.ladders) if (Math.abs(p.x - Ld.x) < Ld.hw && Math.abs(p.z - Ld.z) < Ld.hd && p.y >= Ld.y0 && p.y <= Ld.y1) {
    const k = w.keys, input = k.KeyW || k.ArrowUp || k.Space || Math.hypot(w.joy.x, w.joy.y) > 0.3 || w.joyJump;
    v.y = input ? 4.4 : Math.max(v.y, -1.2); if (input) w.onGround = false;
  }
  // wall jumps: jump again while touching a wall in the air
  if (!w.onGround) for (const Wl of G.wj) {
    const dx = p.x - Wl.x, dz = p.z - Wl.z, ox = Math.abs(dx) - Wl.hw, oz = Math.abs(dz) - Wl.hd;
    if (ox > 0.75 || oz > 0.75 || p.y < Wl.y0 + 1.2 || p.y > Wl.y1) continue;
    if (v.y < -3) v.y = -3; // slide down slowly
    if (G.jp && now - G.jp < 220) { G.jp = 0; v.y = 8.4; if (ox > oz) v.x = Math.sign(dx) * 4.5; else v.z = Math.sign(dz) * 4.5; app.sfx('jump'); puff(p.x, p.y + 0.8, p.z, 0xffffff, 5); }
  }
  // the rising lava stage
  if (!safe) for (const Lv of G.lavas) if (Math.abs(p.x - Lv.x) < Lv.hw && Math.abs(p.z - Lv.z) < Lv.hd && p.y < Lv.y(ck) - 0.05) return die();
  // low gravity in space
  if (G.cp >= 25 && G.cp <= 30 && !w.onGround) v.y += 13 * dt;
  // 🌋 admin: lava rising for everyone
  if (G.alava) {
    const La = G.alava; if (now > La.until) { app.world.scene.remove(La.m); G.alava = null; }
    else { La.y += dt * 0.38; La.m.position.set(p.x, La.y, p.z); if (p.y < La.y - 0.05 && !safe) return die(); }
  }
  if (G.ball) ballTick(app, dt);
  // falling off: back to the checkpoint
  const st = G.stg[Math.min(Math.max(G.cp, 1), 37)];
  if ((G.cp >= 1 && p.y < st.minY - 6) || (p.y < 0.7 && Math.hypot(p.x, p.z) > LOBBY_R + 0.5)) return die();
  G.pv = [v.x, v.z];
}
function hit(app, H, kn, safe) {
  const w = app.world, now = performance.now();
  if (H.kill && !safe) { die(); return true; }
  if (now - G.knockT < 500) return false; G.knockT = now;
  w.vel.set(kn[0] * 10, 6.5, kn[1] * 10); w.onGround = false; app.sfx('bonk');
  const p = w.me.group.position; puff(p.x, p.y + 1, p.z, 0xffffff, 6);
  return false;
}

// ---------- checkpoints, deaths, finishing ----------
function claim(app, n) {
  if (n === G.cp) return;
  if (G.cp === 37 && n === 1) { G.ms = 0; G.deaths = 0; }
  else if (n < G.cp) return;
  if (G.cp === 0) { G.ms = 0; G.deaths = 0; }
  const was = G.cp; G.cp = n;
  if (G.alava) G.alava.y = G.stg[n].pad.top - 5;
  if (n > G.best) {
    // a reward for every new stage you reach (and a bigger one for each new world)
    const k = Math.min(5, n - Math.max(G.best, was)); G.best = n;
    if (k > 0) app.coins.bonus(10 * k, false);
    if ((n - 1) % 6 === 0 && n > 1) { app.coins.bonus(40, true); ui.toast(`🌟 ${L('New world bonus', 'Бонус за новый мир')} +${money(40)}`); }
  }
  const Z = ZONES[Math.floor((n - 1) / 6)];
  if ((n - 1) % 6 === 0) { ui.banner(`${Z.icon} ${L(Z.en, Z.ru)}!`, 2600); app.sfx('cheer'); } else { ui.toast(`🚩 ${L('Checkpoint', 'Чекпоинт')} ${n}/${LAST}`); app.sfx('ding'); }
  if (n === 25) setTimeout(() => ui.toast('🌙 ' + L('Low gravity here!', 'Здесь слабая гравитация!')), 1200);
  puff(G.stg[n].pad.x, G.stg[n].pad.top + 0.5, G.stg[n].pad.z, Z.c[2], 12);
  paintFlags(); save();
}
function paintFlags() { for (let n = 1; n <= LAST; n++) { const s = G.stg[n]; s.flag.material.color.setHex(n <= G.cp ? 0xffd34d : s.Z.c[2]); s.flag.material.emissive?.setHex(n <= G.cp ? 0x553800 : 0); } }
function respawn() {
  const w = A.world, p = w.me.group.position;
  if (G.cp < 1) { w.teleport(...SPAWN); return; }
  const s = G.stg[Math.min(G.cp, 37)], [x, z] = s.n === 37 ? G.fin.c : [s.pad.x, s.pad.z];
  w.teleport(x, z, yawFor(s.dir)); p.y = s.pad.top + 0.02; w.vel.set(0, 0, 0); G.pv = [0, 0]; G.stand = null;
}
function die(manual) {
  const w = A.world, p = w.me.group.position, now = performance.now();
  if (w.carrier || now - (G.deadT || 0) < 500) return; G.deadT = now;
  puff(p.x, p.y + 0.9, p.z, 0xffffff, 16); puff(p.x, p.y + 0.9, p.z, ZONES[Math.max(0, Math.floor((Math.min(Math.max(G.cp, 1), 36) - 1) / 6))].c[2], 8);
  A.sfx(manual ? 'teleport' : 'bonk'); if (!manual) { G.deaths++; if (G.deaths % 10 === 0) ui.toast('💪 ' + L('Never give up!', 'Не сдавайся!')); }
  if (G.alava) G.alava.y = (G.cp >= 1 ? G.stg[Math.min(G.cp, 37)].pad.top : 0) - 5;
  respawn();
}
function finish(app) {
  if (G.cp === 37) return;
  G.cp = 37; G.best = 37; G.wins++;
  const secs = G.ms / 1000, rec = !G.bt || secs < G.bt; if (rec) G.bt = secs;
  ui.banner(`🏆 ${L('YOU BEAT THE MEGA OBBY!', 'ТЫ ПРОШЁЛ МЕГА ОББИ!')} ⏱ ${fmt(G.ms)}${rec ? ' · ' + L('NEW RECORD!', 'НОВЫЙ РЕКОРД!') : ''}`, 6000);
  app.sfx('champions'); confetti(160); app.world.fireworks(10);
  // the big prize once every 30 minutes, a small one otherwise
  const big = Date.now() - G.paid > 30 * 60 * 1000; if (big) G.paid = Date.now();
  app.coins.bonus(big ? 300 : 30, true); ui.toast(`🏆 ${L('Prize', 'Приз')} +${money(big ? 300 : 30)}`);
  const me = { nm: app.me.name, t: +secs.toFixed(1) }; app.emit('ofin', me); if (app.isHost()) addWinner(me);
  paintFlags(); save();
}
function again(app) {
  if (G.cp !== 37 || G._ag > performance.now()) return; G._ag = performance.now() + 2000;
  G.cp = 1; G.ms = 0; G.deaths = 0; paintFlags(); respawn(); app.sfx('go'); ui.banner('🔁 ' + L('New run! Go go go!', 'Новый забег! Вперёд!'), 2500); save();
}
function home(app) { if (G._ag > performance.now()) return; G._ag = performance.now() + 2000; app.world.teleport(...SPAWN); app.sfx('teleport'); }
function skip() {
  const left = SKIP_MS - (Date.now() - G.skipAt);
  if (G.cp < 1) return ui.toast('🏁 ' + L('Start the course first!', 'Сначала начни трассу!'));
  if (G.cp >= LAST) return ui.toast('🏆 ' + L('No skipping the last stage!', 'Последний этап не пропустить!'));
  if (left > 0) return ui.toast(`⏳ ${L('Next free skip in', 'Следующий пропуск через')} ${fmt(left).slice(0, -2)}`);
  G.skipAt = Date.now(); G.cp++; G.best = Math.max(G.best, G.cp); paintFlags(); respawn(); A.sfx('whoosh'); ui.toast(`⏭ ${L('Skipped to stage', 'Пропуск: этап')} ${G.cp}`); save();
}

// ---------- 🤖 bots: they follow each stage's route, sometimes miss a jump, and respawn ----------
const rng = a => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const ptPos = (pt, t) => (pt.b ? pt.b.at(t) : pt.p);
function seedBots() {
  const ck = G.ck, r = Math.random;
  G.bots = BOTS.map(([nm, sk], i) => { const n = 1 + Math.floor(r() * (8 + sk * 14)); return { id: 'b' + i, nm, sk, sd: 1000 + Math.floor(r() * 1e6), n, att: 0, t: ck + i * 0.7, run: ck - n * 35 }; });
  pushBots();
}
function pushBots() { A.net.setState('obots', G.bots.map(b => ({ id: b.id, nm: b.nm, sk: b.sk, sd: b.sd, n: b.n, att: b.att, t: b.t, run: b.run }))); G._bp = performance.now(); }
// the whole attempt at one stage, worked out the same way on every screen
function plan(bot) {
  const key = `${bot.id}:${bot.n}:${bot.att}:${(+bot.t).toFixed(2)}`; if (bot._pk === key) return bot._plan;
  const st = G.stg[bot.n], r = rng(hash(key)), sk = bot.sk;
  let P;
  if (!st || bot.n >= 37 || !st.route) P = { legs: [], end: bot.t + 25, fin: true };
  else {
    const pts = [{ p: [st.pad.x, st.pad.top, st.pad.z] }, ...st.route], jumps = [];
    pts.forEach((q, i) => { if (i && (q.a === 'j' || q.a === 'b') && i < pts.length - 1) jumps.push(i); });
    const failAt = jumps.length && r() < (1 - sk) * 0.6 ? jumps[Math.floor(r() * jumps.length)] : -1;
    let t = bot.t + 0.3 + r() * 0.5; const legs = [];
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], ty = b.a;
      if (ty === 'j' || ty === 'b') t += 0.08 + (1 - sk) * 0.6 * r();
      if (b.ok) for (let k = 0; k < 600 && !b.ok(t); k++) t += 0.05;
      const A0 = ptPos(a, t), B0 = ptPos(b, t), hd = Math.hypot(B0[0] - A0[0], B0[2] - A0[2]), dy = B0[1] - A0[1];
      const dur = ty === 'w' ? hd / (3.4 + 2.6 * sk) + 0.05 : ty === 'c' ? Math.abs(dy) / 2.2 + 0.2 : ty === 'f' ? Math.abs(dy) / 5 + 0.3 : ty === 'r' ? (b.d || 0.5) : ty === 'b' ? 1.2 : Math.min(1.1, Math.max(0.45, hd / 5.5)) * (st.lowg ? 1.5 : 1);
      const fail = i === failAt; legs.push({ a, b, ty, t0: t, t1: t + dur, A: [...A0], fail });
      t += dur; if (fail) { t += 1.3; break; }
    }
    P = { legs, end: t + 0.15, fail: failAt >= 0 && legs.length && legs[legs.length - 1].fail };
  }
  bot._pk = key; bot._plan = P; return P;
}
// where a bot is at course time t: { x, y, z, h (facing), spd, air }
function pose(bot, t) {
  const P = plan(bot);
  if (P.fin) { const a = hash(bot.id) % 360 / 57.3, [cx, cz] = G.fin.c; return { x: cx + Math.cos(a) * 5, y: G.fin.pad.top, z: cz + Math.sin(a) * 5, h: a + Math.PI, spd: 0, fin: true }; }
  const st = G.stg[bot.n];
  let at = [st.pad.x, st.pad.top, st.pad.z], h = yawFor(st.dir) + Math.PI;
  for (const Lg of P.legs) {
    if (t < Lg.t0) { const q = ptPos(Lg.a, t); return { x: q[0], y: q[1], z: q[2], h: Lg.prevH ?? h, spd: 0 }; }
    const B = ptPos(Lg.b, Math.min(t, Lg.t1)), A0 = Lg.ty === 'r' ? B : Lg.A, dx = B[0] - A0[0], dz = B[2] - A0[2]; if (Math.hypot(dx, dz) > 0.05) h = Math.atan2(dx, dz); Lg.prevH = h;
    if (t <= Lg.t1 || Lg.fail) {
      const dur = Lg.t1 - Lg.t0, s = Math.min(1, (t - Lg.t0) / dur), H = Lg.ty === 'b' ? 3.2 : 0.8 + Math.max(0, B[1] - A0[1]) * 0.7;
      const arc = k => [A0[0] + dx * k, A0[1] + (B[1] - A0[1]) * k + 4 * H * k * (1 - k), A0[2] + dz * k];
      if (Lg.fail && s > 0.55) { const q = arc(0.55), ft = t - Lg.t0 - 0.55 * dur; return { x: q[0] + dx / dur * 0.4 * ft, y: q[1] + 2 * ft - 11 * ft * ft, z: q[2] + dz / dur * 0.4 * ft, h, spd: 2, air: true, fall: true }; }
      if (Lg.ty === 'j' || Lg.ty === 'b') { const q = arc(s); return { x: q[0], y: q[1], z: q[2], h, spd: 4, air: s > 0.05 && s < 0.97 }; }
      if (Lg.ty === 'r') return { x: B[0], y: B[1], z: B[2], h, spd: 0 };
      return { x: A0[0] + dx * s, y: A0[1] + (B[1] - A0[1]) * s, z: A0[2] + dz * s, h, spd: Lg.ty === 'w' ? Math.hypot(dx, dz) / dur : 1.5, climb: Lg.ty === 'c', air: Lg.ty === 'f' };
    }
    at = B;
  }
  return { x: at[0], y: at[1], z: at[2], h, spd: 0 };
}
function hostTick(app, ck) {
  let changed = false;
  for (const b of G.bots) {
    const P = plan(b); if (ck < P.end) continue;
    if (b.n >= 37) { b.n = 1; b.att = 0; b.run = ck; }
    else if (P.fail) b.att++;
    else { b.n++; b.att = 0; if (b.n === 37) addWinner({ nm: '🤖 ' + b.nm, t: +Math.max(60, ck - b.run).toFixed(1), bot: true }); }
    b.t = ck; changed = true;
  }
  const now = performance.now();
  if (G.bots.length && (changed || now - (G._bp || 0) > 5000)) pushBots();
  if (now - (G._wp || 0) > 6000) { G._wp = now; app.net.setState('owin', G.win); }
}
function bots(app, dt, ck, now) {
  const w = app.world, cam = w.camera.position, crazy = G.crazyUntil > now, seen = new Set();
  G.bots.forEach((b, i) => {
    seen.add(b.id);
    let B = G.botAv[b.id];
    if (!B) {
      // the same looks on every screen: a seeded random avatar
      const r0 = Math.random, rr = rng(b.sd); Math.random = rr; let av; try { av = new Avatar(randomAvatar(), '', 'bot'); } finally { Math.random = r0; }
      const lab = labelSprite('🤖 ' + b.nm, 0.34, { bg: 'rgba(90,79,207,0.85)' }); lab.position.y = 2.3; lab.userData.dynamic = true; av.group.add(lab);
      w.scene.add(av.group); B = G.botAv[b.id] = { av, att: b.att, n: b.n };
    }
    const q = pose(b, ck), g = B.av.group;
    if ((B.att !== b.att || B.n !== b.n) && B.last && B.att !== b.att && B.n === b.n) puff(B.last[0], B.last[1] + 0.9, B.last[2], 0xffffff, 10);
    B.att = b.att; B.n = b.n; B.last = [q.x, q.y, q.z];
    const far = g.position.distanceTo(cam) > (w.hq ? 140 : 90); g.visible = !far || crazy;
    let y = q.y;
    if (crazy) { y += Math.abs(Math.sin(ck * 4 + i)) * 4; g.rotation.y += dt * 9; g.scale.setScalar(1.6); if (!B.av.emote) B.av.play('dance'); }
    else { if (g.scale.x !== 1) g.scale.setScalar(1); let d = q.h - g.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); g.rotation.y += d * Math.min(1, dt * 10); if (q.fin && !B.av.emote && Math.random() < dt * 0.3) B.av.play(Math.random() < 0.5 ? 'dance' : 'cheer'); }
    g.position.set(q.x, y, q.z);
    if (!far) B.av.animate(q.climb ? 3 : q.spd, dt, !!q.air);
  });
  for (const id in G.botAv) if (!seen.has(id)) { w.scene.remove(G.botAv[id].av.group); delete G.botAv[id]; }
}

// ---------- 🏆 today's winners (the host keeps the list) ----------
function addWinner(x) {
  if (!x || !x.nm || typeof x.t !== 'number') return;
  if (G.win.day !== today()) G.win = { day: today(), list: [] };
  const old = G.win.list.find(y => y.nm === x.nm);
  if (old) { if (x.t < old.t) old.t = x.t; else return; } else G.win.list.push({ nm: String(x.nm).slice(0, 30), t: x.t, bot: !!x.bot });
  G.win.list.sort((a, b) => a.t - b.t); G.win.list = G.win.list.slice(0, 30);
  try { localStorage.setItem(SAVE + '_win', JSON.stringify(G.win)); } catch (e) {}
  A.net.setState('owin', G.win); G._wp = performance.now(); drawWalls();
}
function mergeWin(list) {
  if (G.win.day !== today()) G.win = { day: today(), list: [] };
  let ch = false; for (const x of list) { const o = G.win.list.find(y => y.nm === x.nm); if (!o) { G.win.list.push(x); ch = true; } else if (x.t < o.t) { o.t = x.t; ch = true; } }
  if (!ch) return; G.win.list.sort((a, b) => a.t - b.t);
  try { localStorage.setItem(SAVE + '_win', JSON.stringify(G.win)); } catch (e) {} drawWalls();
}
function drawWalls() {
  const list = G.win.list;
  for (const Wb of G.walls || []) {
    const g = Wb.g; g.fillStyle = '#16203a'; g.fillRect(0, 0, 1024, 640);
    const gr = g.createLinearGradient(0, 0, 1024, 0); gr.addColorStop(0, '#ffd34d'); gr.addColorStop(1, '#ff9f1c'); g.fillStyle = gr; g.fillRect(0, 0, 1024, 110);
    g.fillStyle = '#1b1b1b'; g.font = '900 62px Manrope, system-ui'; g.textBaseline = 'middle'; g.fillText('🏆 ' + L('Winners today', 'Победители дня'), 36, 58);
    g.font = '800 40px Manrope, system-ui';
    if (!list.length) { g.fillStyle = '#fff'; g.fillText(L('Nobody yet — be the first!', 'Пока никого — будь первым!'), 36, 200); }
    list.slice(0, 9).forEach((x, i) => { g.fillStyle = i === 0 ? '#ffd34d' : i < 3 ? '#e0e6ef' : '#9fb0c2'; g.fillText(`${['🥇', '🥈', '🥉'][i] || i + 1 + '.'} ${x.nm}`, 36, 160 + i * 53); g.textAlign = 'right'; g.fillText(fmt(x.t * 1000), 990, 160 + i * 53); g.textAlign = 'left'; });
    Wb.tex.needsUpdate = true;
  }
}

// ---------- poofs (when you fall or touch a kill brick) ----------
function poofSetup(w) { G.puffs = Array.from({ length: 60 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })); m.visible = false; m.userData.v = new THREE.Vector3(); w.scene.add(m); return m; }); G.pn = 0; }
function puff(x, y, z, color, n = 10) { for (let i = 0; i < n; i++) { const m = G.puffs[G.pn++ % G.puffs.length]; m.position.set(x, y, z); m.userData.v.set((Math.random() - 0.5) * 6, Math.random() * 5, (Math.random() - 0.5) * 6); m.userData.t = 0.7; m.material.color.setHex(color); m.material.opacity = 1; m.scale.setScalar(1); m.visible = true; } }
function poofTick(dt) { for (const m of G.puffs) { if (!m.visible) continue; const u = m.userData; u.t -= dt; u.v.y -= 9 * dt; m.position.addScaledVector(u.v, dt); m.scale.setScalar(0.6 + u.t); m.material.opacity = Math.max(0, u.t / 0.7); if (u.t <= 0) m.visible = false; } }

// ---------- admin abuse ----------
function onAdmin(a, d, app) {
  const w = app.world, now = performance.now();
  if (a === 'olava') {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(160, 160).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: M.lavaT, emissive: 0xff5a10, emissiveMap: M.lavaT, emissiveIntensity: 1.2, transparent: true, opacity: 0.92 }));
    if (G.alava) w.scene.remove(G.alava.m); w.scene.add(m);
    G.alava = { until: now + 45000, y: (G.cp >= 1 ? G.stg[Math.min(G.cp, 37)].pad.top : 0) - 5, m };
    ui.banner('🌋 ' + L('THE LAVA IS RISING! Climb!', 'ЛАВА ПОДНИМАЕТСЯ! Лезь выше!'), 3500); app.sfx('airhorn');
  }
  if (a === 'orestart') { if (G.cp !== 37) { G.cp = 1; paintFlags(); respawn(); save(); } if (app.isHost()) { G.bots.forEach(b => { b.n = 1; b.att = 0; b.t = G.ck; b.run = G.ck; }); pushBots(); } ui.banner('⏮️ ' + L('Everyone back to stage 1!', 'Все обратно на 1-й этап!'), 3000); app.sfx('aww'); }
  if (a === 'oskip') { if (G.cp < 37) { G.cp = Math.min(LAST, Math.max(1, G.cp) + 5); G.best = Math.max(G.best, G.cp); paintFlags(); respawn(); save(); } if (app.isHost()) { G.bots.forEach(b => { if (b.n < 37) { b.n = Math.min(LAST, b.n + 5); b.att = 0; b.t = G.ck; } }); pushBots(); } ui.banner('⏩ ' + L('Everyone skips 5 stages!', 'Все перепрыгивают 5 этапов!'), 3000); app.sfx('whoosh'); }
  if (a === 'ovanish') { G.vanishAt = now + 2500; ui.banner('👻 ' + L('Platforms vanish in 3… 2… 1… Get to a checkpoint!', 'Платформы исчезнут через 3… 2… 1… Беги на чекпоинт!'), 3000); app.sfx('drumroll'); }
  if (a === 'ofast') { G.fastUntil = now + 20000; ui.banner('🌀 ' + L('Everything spins 3× faster!', 'Всё крутится в 3 раза быстрее!'), 3000); app.sfx('zip'); }
  if (a === 'oreverse') { G.revUntil = now + 20000; ui.banner('🔀 ' + L('Controls are REVERSED!', 'Управление НАОБОРОТ!'), 3000); app.sfx('laugh'); }
  if (a === 'oice') { G.iceUntil = now + 30000; ui.banner('🧊 ' + L('Ice mode! Everything is slippery!', 'Режим льда! Всё скользит!'), 3000); app.sfx('scan'); }
  if (a === 'otramp') { G.trampUntil = now + 25000; ui.banner('🤸 ' + L('Kill bricks are trampolines now!', 'Красные блоки стали батутами!'), 3000); app.sfx('boing'); }
  if (a === 'osafe') { G.safeUntil = now + 30000; ui.banner('🛡️ ' + L('Safe mode: kill bricks and lava are off!', 'Безопасный режим: красные блоки и лава выключены!'), 3000); app.sfx('chime'); }
  if (a === 'obots') { G.crazyUntil = now + 20000; ui.banner('🤪 ' + L('The bots went crazy!', 'Боты сошли с ума!'), 3000); app.sfx('laugh'); }
  if (a === 'oball') giantBall(app);
  if (a === 'obridge') rainbowBridge(app);
}
// ⚽ a giant beach ball rolls back down the course towards you
function giantBall(app) {
  const w = app.world, s0 = Math.max(1, Math.min(G.cp, LAST)), pts = [];
  for (let n = Math.min(37, s0 + 2); n >= Math.max(1, s0 - 1); n--) { const s = G.stg[n], [x, z] = n === 37 ? G.fin.c : [s.pad.x, s.pad.z]; pts.push(new THREE.Vector3(x, s.pad.top, z)); }
  if (G.cp < 1) { pts.length = 0; pts.push(new THREE.Vector3(G.stg[2].pad.x, 1, 0), new THREE.Vector3(-14, 0, 0)); }
  const tx = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d'); ['#ff3b3b', '#ffffff', '#3a86ff', '#ffe14d', '#ffffff', '#3ddc84'].forEach((col, i) => { g.fillStyle = col; g.fillRect(i * 256 / 6, 0, 256 / 6 + 1, 128); }); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  if (G.ball) w.scene.remove(G.ball.m);
  const R = 2.8, m = new THREE.Mesh(new THREE.SphereGeometry(R, 32, 20), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.35 })); m.castShadow = true; w.scene.add(m);
  G.ball = { pts, i: 0, k: 0, m, R }; ui.banner('⚽ ' + L('GIANT BALL INCOMING! Dodge it!', 'ГИГАНТСКИЙ МЯЧ! Уворачивайся!'), 3000); app.sfx('drumroll');
}
function ballTick(app, dt) {
  const B = G.ball, w = app.world, p = w.me.group.position;
  const a = B.pts[B.i], b = B.pts[B.i + 1]; if (!b) { w.scene.remove(B.m); G.ball = null; return; }
  const len = a.distanceTo(b) || 1; B.k += dt * 9 / len; if (B.k >= 1) { B.k = 0; B.i++; return; }
  const c = a.clone().lerp(b, B.k); c.y += B.R + Math.abs(Math.sin(B.k * Math.PI * 3)) * 1.2; B.m.position.copy(c);
  const dir = b.clone().sub(a).setY(0).normalize(); B.m.rotateOnWorldAxis(new THREE.Vector3(dir.z, 0, -dir.x), dt * 9 / B.R);
  if (c.distanceTo(new THREE.Vector3(p.x, p.y + 0.9, p.z)) < B.R + 0.7 && performance.now() - G.knockT > 800) { G.knockT = performance.now(); w.vel.set(dir.x * 13, 9, dir.z * 13); w.onGround = false; app.sfx('crash'); puff(p.x, p.y + 1, p.z, 0xffffff, 10); }
}
// 🌈 a bridge of steps from your checkpoint to the next one, for 20 s
function rainbowBridge(app) {
  const w = app.world; if (G.cp >= 37) return;
  for (const b of G.bridge || []) w.scene.remove(b.m); G.movers = G.movers.filter(b => !b.bridge);
  const s1 = G.stg[Math.max(1, G.cp)], s2 = G.stg[Math.max(1, G.cp) + 1], a = s1.pad, b = s2.n === 37 ? { x: G.fin.c[0], z: G.fin.c[1], top: G.fin.pad.top } : s2.pad;
  const d = Math.hypot(b.x - a.x, b.z - a.z), dy = b.top - a.top, N = Math.max(Math.ceil(d / 1.6), Math.ceil(Math.abs(dy) / 0.45));
  G.bridge = [];
  for (let i = 0; i < N; i++) { const f = (i + 0.5) / N; G.bridge.push(blk(a.x + (b.x - a.x) * f, a.z + (b.z - a.z) * f, a.top + dy * f, 2.4, 2.4, 'd', s1.Z, { h: 0.35, nosolid: true, bridge: true, move: () => [0, 0, 0], mat: std(new THREE.Color().setHSL(i / N, 0.85, 0.6), { emissive: new THREE.Color().setHSL(i / N, 0.9, 0.3), emissiveIntensity: 0.6 }) })); }
  ui.banner('🌈 ' + L('A rainbow bridge to the next stage!', 'Радужный мост к следующему этапу!'), 3000); app.sfx('star');
  const mine = G.bridge; setTimeout(() => { if (G.bridge !== mine) return; for (const x of mine) w.scene.remove(x.m); G.movers = G.movers.filter(x => !x.bridge); G.bridge = null; }, 20000);
}
