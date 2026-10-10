// 🎣 Fishing: a wooden pier on the east beach. Walk to the end, cast, wait for a bite, tap Reel,
// then stop the marker in the green zone. Collect every kind of fish — or take the Fisher job and get paid.
import * as THREE from 'three';
import { labelSprite } from './world.js';

export const PIER = { x0: 108, x1: 150, z: 10, w: 3.2, y: 4.25 };
// chance, how hard (smaller green zone, faster marker), pay with the Fisher job (cents)
export const FISH = [
  { id: 'sardine', icon: '🐟', p: 0.42, zone: 0.32, sp: 1.0, pay: 25 },
  { id: 'clown', icon: '🐠', p: 0.24, zone: 0.26, sp: 1.25, pay: 50 },
  { id: 'puffer', icon: '🐡', p: 0.13, zone: 0.22, sp: 1.5, pay: 75 },
  { id: 'squid', icon: '🦑', p: 0.08, zone: 0.18, sp: 1.8, pay: 100 },
  { id: 'octopus', icon: '🐙', p: 0.05, zone: 0.16, sp: 2.0, pay: 150 },
  { id: 'shark', icon: '🦈', p: 0.03, zone: 0.12, sp: 2.4, pay: 300 },
  { id: 'boot', icon: '👢', p: 0.05, zone: 0.4, sp: 0.8, pay: 0 },
];
const $ = s => document.querySelector(s);
const el = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };

export class Fishing {
  constructor(app) {
    this.app = app; this.st = 'idle';
    this.build();
    document.body.append(el(`<div id="fishBox" class="modal hidden"><div class="sheet small fish-sheet"><div class="sheet-head"><h2>🎣 <span id="fishTitle"></span></h2><button class="ibtn light" data-x>✕</button></div>
      <canvas id="fishCv" width="560" height="300"></canvas><p id="fishMsg" class="fish-msg"></p>
      <div class="row"><button class="btn primary big" id="fishBtn"></button></div><div id="fishDex" class="fish-dex"></div></div></div>`));
    $('#fishBox [data-x]').onclick = () => this.close();
    $('#fishBtn').onpointerdown = e => { e.preventDefault(); this.press(); };
  }
  get t() { return this.app.t; }
  // the pier: deck, posts, rails, a little hut and a sign
  build() {
    const w = this.app.world, S = w.scene, P = PIER, len = P.x1 - P.x0, cx = (P.x0 + P.x1) / 2;
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a6b3f, roughness: 0.85 }), dark = new THREE.MeshStandardMaterial({ color: 0x5e3f22, roughness: 0.9 });
    const box = (x, y, z, sx, sy, sz, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; S.add(o); return o; };
    box(cx, P.y - 0.1, P.z, len, 0.2, P.w, mat);
    box(P.x1 + 2, P.y - 0.1, P.z, 6, 0.2, 7, mat); // platform at the end
    for (let x = P.x0 + 2; x <= P.x1 + 4; x += 4) for (const sz of [-1, 1]) box(x, P.y - 3, P.z + sz * (x > P.x1 ? 3.2 : 1.4), 0.3, 6, 0.3, dark);
    for (const sz of [-1, 1]) { box(cx + 2, P.y + 0.55, P.z + sz * 1.55, len + 4, 0.08, 0.08, dark); for (let x = P.x0 + 4; x <= P.x1; x += 3) box(x, P.y + 0.3, P.z + sz * 1.55, 0.1, 0.6, 0.1, dark); }
    for (const sz of [-1, 1]) box(P.x1 + 2, P.y + 0.55, P.z + sz * 3.45, 6, 0.08, 0.08, dark);
    box(P.x1 + 5, P.y + 0.55, P.z, 0.08, 0.08, 7, dark);
    // bait shack
    box(P.x0 + 3, P.y + 1.2, P.z - 3.4, 3, 2.4, 2.2, new THREE.MeshStandardMaterial({ color: 0x3a8fb7, roughness: 0.7 }));
    box(P.x0 + 3, P.y + 2.55, P.z - 3.4, 3.4, 0.3, 2.6, new THREE.MeshStandardMaterial({ color: 0xe8e8e8 }));
    const sign = labelSprite('🎣 ' + this.t('fishPier'), 0.6, { bg: 'rgba(58,143,183,0.95)' }); sign.position.set(P.x0 + 1, P.y + 3.4, P.z); S.add(sign);
    const spot = labelSprite('🎣 ⬇', 0.5, { bg: 'rgba(255,211,77,0.95)' }); spot.position.set(P.x1 + 3, P.y + 2.6, P.z); S.add(spot);
    w.updaters.push((dt, tt) => { spot.position.y = P.y + 2.6 + Math.sin(tt * 2) * 0.15; });
    // walkable deck
    w.grounds.push((x, z) => ((x > P.x0 - 1 && x < P.x1 && Math.abs(z - P.z) < P.w / 2) || (x >= P.x1 - 1 && x < P.x1 + 5 && Math.abs(z - P.z) < 3.5)) ? P.y : null);
    // keep you on the deck (the rails)
    w.zone({ test: (px, py, pz) => px > P.x1 - 0.5 && px < P.x1 + 5 && Math.abs(pz - P.z) < 3.4 && Math.abs(py - P.y) < 1.3, onEnter: () => this.open(), onLeave: () => {} });
  }
  open() {
    const w = this.app.world; if (w.inputLocked || (this.app.mg && this.app.mg.active)) return;
    w.inputLocked = true; w.keys = {};
    this.st = 'idle'; this.draw0(); this.setUI();
    $('#fishTitle').textContent = this.t('fishing'); $('#fishBox').classList.remove('hidden');
    this.loop();
  }
  close() { $('#fishBox').classList.add('hidden'); this.app.world.inputLocked = false; cancelAnimationFrame(this.raf); this.st = 'idle'; const p = this.app.world.me.group.position; p.x = PIER.x1 - 2; }
  dex() { try { return JSON.parse(localStorage.getItem('wi_fishdex') || '{}'); } catch (e) { return {}; } }
  setUI() {
    const t = this.t, b = $('#fishBtn'), d = this.dex();
    b.textContent = { idle: '🎣 ' + t('cast'), wait: '⏳ ' + t('waiting'), bite: '❗ ' + t('reel'), reel: '✋ ' + t('stop'), done: '🎣 ' + t('castAgain') }[this.st];
    b.disabled = this.st === 'wait';
    $('#fishDex').innerHTML = FISH.map(f => `<span class="${d[f.id] ? 'got' : ''}" title="${t('fish_' + f.id)}">${d[f.id] ? f.icon : '❔'}<small>${d[f.id] || 0}</small></span>`).join('');
  }
  msg(m) { $('#fishMsg').textContent = m; }
  press() {
    const now = performance.now(), app = this.app, t = this.t;
    if (this.st === 'idle' || this.st === 'done') { this.st = 'wait'; this.castAt = now; this.biteAt = now + 1500 + Math.random() * 3500; this.msg(t('fishWait')); app.sfx('whoosh'); }
    else if (this.st === 'bite') { this.st = 'reel'; this.fish = this.roll(); this.mark = 0; this.dir = 1; this.zoneAt = 0.2 + Math.random() * (0.8 - this.fish.zone); this.msg(t('fishReel')); app.sfx('zip'); }
    else if (this.st === 'reel') {
      const ok = this.mark >= this.zoneAt && this.mark <= this.zoneAt + this.fish.zone;
      this.st = 'done';
      if (ok) this.caught(this.fish); else { this.msg('💨 ' + t('fishLost')); app.sfx('wrong'); }
    }
    this.setUI();
  }
  roll() { let r = Math.random(); for (const f of FISH) { if ((r -= f.p) <= 0) return f; } return FISH[0]; }
  caught(f) {
    const app = this.app, t = this.t, d = this.dex(); d[f.id] = (d[f.id] || 0) + 1; try { localStorage.setItem('wi_fishdex', JSON.stringify(d)); } catch (e) {}
    this.show = { f, at: performance.now() };
    app.sfx(f.id === 'boot' ? 'bonk' : 'splash'); setTimeout(() => app.sfx(f.id === 'shark' ? 'champions' : f.id === 'boot' ? 'laugh' : 'coin'), 300);
    let line = `${f.icon} ${t('fish_' + f.id)}!`;
    if (f.id === 'boot') line += ' ' + t('fishBoot');
    if (app.jobs && app.jobs.job === 'fisher' && f.pay) { app.jobs.served++; app.jobs.pay(f.pay); line += ` +$${(f.pay / 100).toFixed(2)}`; }
    else if (f.pay && !(app.jobs && app.jobs.job === 'fisher')) line += ' · ' + t('fishJobTip');
    this.msg(line); if (f.id === 'shark') app.world.fireworks(4);
  }
  draw0() { this.loopT = performance.now(); }
  loop() {
    const cv = $('#fishCv'), g = cv.getContext('2d'), W = cv.width, H = cv.height, now = performance.now(), tt = now / 1000;
    if (this.st === 'wait' && now > this.biteAt) { this.st = 'bite'; this.biteEnd = now + 1100; this.msg('❗❗ ' + this.t('fishBite')); this.app.sfx('beep'); this.setUI(); }
    if (this.st === 'bite' && now > this.biteEnd) { this.st = 'done'; this.msg('💨 ' + this.t('fishSlow')); this.setUI(); }
    if (this.st === 'reel') { this.mark += this.dir * this.fish.sp * 0.016 * 1.1; if (this.mark > 1) { this.mark = 1; this.dir = -1; } if (this.mark < 0) { this.mark = 0; this.dir = 1; } }
    // sky, sea, waves
    const sky = g.createLinearGradient(0, 0, 0, H * 0.45); sky.addColorStop(0, '#7ec8ff'); sky.addColorStop(1, '#d9f2ff'); g.fillStyle = sky; g.fillRect(0, 0, W, H * 0.45);
    g.fillStyle = '#ffe28a'; g.beginPath(); g.arc(W * 0.85, H * 0.15, 26, 0, 7); g.fill();
    const sea = g.createLinearGradient(0, H * 0.45, 0, H); sea.addColorStop(0, '#2f9fd6'); sea.addColorStop(1, '#0b4a7a'); g.fillStyle = sea; g.fillRect(0, H * 0.45, W, H * 0.55);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2; for (let y = H * 0.5; y < H; y += 22) { g.beginPath(); for (let x = 0; x <= W; x += 10) g.lineTo(x, y + Math.sin(x / 30 + tt * 2 + y) * 3); g.stroke(); }
    // fish swimming under the water
    for (let i = 0; i < 5; i++) { const x = (tt * (30 + i * 9) + i * 140) % (W + 80) - 40, y = H * 0.62 + i * 22; g.globalAlpha = 0.35; g.font = '24px serif'; g.fillText(['🐟', '🐠', '🐟', '🐡', '🐟'][i], x, y); g.globalAlpha = 1; }
    // the rod and line
    g.strokeStyle = '#5e3f22'; g.lineWidth = 6; g.beginPath(); g.moveTo(40, H); g.lineTo(150, H * 0.2); g.stroke();
    const bx = W * 0.55, wob = this.st === 'wait' ? Math.sin(tt * 4) * 3 : 0, dip = this.st === 'bite' ? 10 + Math.sin(tt * 30) * 6 : 0, by = H * 0.47 + wob + dip;
    if (this.st !== 'idle') { g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(150, H * 0.2); g.quadraticCurveTo(bx * 0.8, H * 0.25, bx, by - 8); g.stroke();
      g.fillStyle = '#ff3b3b'; g.beginPath(); g.arc(bx, by - 6, 7, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(bx, by - 6, 7, 0, Math.PI); g.fill();
      if (this.st === 'bite') { g.fillStyle = '#ffd34d'; g.font = '900 48px Manrope'; g.textAlign = 'center'; g.fillText('!', bx, by - 30); g.textAlign = 'left'; } }
    // the reel bar
    if (this.st === 'reel') {
      const x0 = 40, x1 = W - 40, y = H - 46;
      g.fillStyle = 'rgba(0,0,0,0.5)'; g.beginPath(); g.roundRect(x0 - 8, y - 14, x1 - x0 + 16, 44, 14); g.fill();
      g.fillStyle = '#ff6b6b'; g.fillRect(x0, y, x1 - x0, 16);
      g.fillStyle = '#3ddc84'; g.fillRect(x0 + (x1 - x0) * this.zoneAt, y, (x1 - x0) * this.fish.zone, 16);
      g.fillStyle = '#fff'; g.fillRect(x0 + (x1 - x0) * this.mark - 3, y - 8, 6, 32);
    }
    // the catch
    if (this.show && now - this.show.at < 2200) { const k = Math.min(1, (now - this.show.at) / 400); g.font = `${Math.round(40 + 60 * k)}px serif`; g.textAlign = 'center'; g.fillText(this.show.f.icon, W / 2, H * 0.5 - Math.sin(k * Math.PI) * 60); g.textAlign = 'left'; }
    if (!$('#fishBox').classList.contains('hidden')) this.raf = requestAnimationFrame(() => this.loop());
  }
}
