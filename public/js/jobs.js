// Jobs: earn real money by working.
//  🏦 mBank cashier — customers line up at window 4 and ask money questions; $1 for each one served right.
//  🧹 Tower cleaner — litter appears on World Tower floors; $0.50 for each piece picked up.
import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { botAvatar } from './bots.js';
import { labelSprite } from './world.js';
import { money } from './shop.js';

const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[rnd(0, a.length - 1)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cents = c => '$' + (c / 100).toFixed(2);

// a money question a customer asks the cashier
function moneyQ(t) {
  const k = rnd(0, 3);
  let q, ans;
  if (k === 0) { const a = rnd(5, 60), b = rnd(5, 40); q = t('q_deposit').replace('{a}', '$' + a).replace('{b}', '$' + b); ans = a + b; }
  else if (k === 1) { const price = rnd(3, 18) * 100 + pick([0, 25, 50, 75]), paid = price < 1000 ? 1000 : 2000; q = t('q_change').replace('{p}', cents(price)).replace('{g}', cents(paid)); ans = (paid - price) / 100; }
  else if (k === 2) { const n = rnd(2, 9), v = pick([5, 10, 20]); q = t('q_bills').replace('{n}', n).replace('{v}', '$' + v); ans = n * v; }
  else { const has = rnd(30, 120), take = rnd(5, has - 5); q = t('q_withdraw').replace('{a}', '$' + has).replace('{b}', '$' + take); ans = has - take; }
  const fmtA = v => Number.isInteger(v) ? '$' + v : '$' + v.toFixed(2);
  const opts = new Set([fmtA(ans)]); while (opts.size < 4) { const d = pick([-10, -5, -1, 1, 5, 10, 0.5, -0.5, 2]); const v = ans + d; if (v > 0) opts.add(fmtA(v)); }
  return { q, answer: fmtA(ans), options: shuffle([...opts]) };
}

export class Jobs {
  constructor(app) {
    this.app = app; this.job = null; this.earned = 0;
    const hud = document.createElement('div'); hud.id = 'jobHud'; hud.className = 'glass hidden'; document.body.appendChild(hud); this.hud = hud;
    app.world.updaters.push(dt => this.tick(dt));
  }
  get t() { return this.app.t; }
  // the job board in mBank
  board() {
    const t = this.t, ui = this.app.ui; this.app.world.inputLocked = true; this.app.world.keys = {};
    $('#bankTitle').textContent = '💼 ' + t('jobs');
    $('#bankBody').innerHTML = `<p class="muted">${t('jobsIntro')}</p><div class="menu-grid">
      <button class="tile" data-j="cashier"><span>🏦 ${t('job_cashier')}</span><small>${t('job_cashier_d')}</small></button>
      <button class="tile" data-j="cleaner"><span>🧹 ${t('job_cleaner')}</span><small>${t('job_cleaner_d')}</small></button></div>
      ${this.job ? `<div class="row"><button class="btn danger" id="jobQuit">${t('quitJob')}</button></div>` : ''}`;
    $('#bankBox').classList.remove('hidden');
    document.querySelectorAll('#bankBody [data-j]').forEach(b => b.onclick = () => { this.app.bankUI.close(); this.start(b.dataset.j); });
    const q = $('#jobQuit'); if (q) q.onclick = () => { this.app.bankUI.close(); this.quit(); };
  }
  start(kind) {
    if (this.job) this.quit(true);
    const t = this.t; this.job = kind; this.earned = 0; this.served = 0;
    this.app.sfx('chime');
    if (kind === 'cashier') { this.customers = []; this.spawnT = 1; this.app.ui.banner(t('cashierStart'), 4000); }
    if (kind === 'cleaner') { this.spawnLitter(8); this.app.ui.banner(t('cleanerStart'), 4000); }
    this.draw();
  }
  quit(silent) {
    if (!this.job) return;
    const kind = this.job; this.job = null;
    (this.customers || []).forEach(c => this.app.world.scene.remove(c.av.group)); this.customers = [];
    (this.litter || []).forEach(l => { this.app.world.scene.remove(l.m); if (l.m.userData.glow) this.app.world.scene.remove(l.m.userData.glow); l.zone.off = true; }); this.litter = [];
    this.hud.classList.add('hidden'); this.closeQ();
    if (!silent) { this.app.ui.banner(`${this.t('shiftDone')} · ${money(this.earned)}`, 3000); setTimeout(() => this.app.settle(), 600); }
  }
  pay(c) { this.earned += c; this.app.earn(c); this.draw(); }
  draw() {
    if (!this.job) return this.hud.classList.add('hidden');
    const t = this.t, extra = this.job === 'cleaner' ? ` · 🧹 ${this.litter.filter(l => !l.got).length} ${t('left')} ${this.floorsHint()}` : ` · 👥 ${this.served}`;
    this.hud.innerHTML = `💼 <b>${t('job_' + this.job)}</b> · ${money(this.earned)}${extra} <button id="jobEnd">${t('endShift')}</button>`;
    this.hud.classList.remove('hidden'); $('#jobEnd').onclick = () => this.quit();
  }

  // ---------- cashier ----------
  cashierIn() { this.atWindow = true; if (this.job !== 'cashier') this.app.toast(this.t('cashierHint')); }
  cashierOut() { this.atWindow = false; this.closeQ(); }
  tick(dt) {
    if (this.job !== 'cashier') return;
    const B = this.app.mbank, C = B.cashier, w = this.app.world;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.customers.filter(c => c.state !== 'leave').length < 3) {
      this.spawnT = 7 + Math.random() * 6;
      const av = new Avatar(botAvatar(Math.floor(Math.random() * 1e6)), '', 'bot'); av.group.position.set(B.maxX + 1, B.base, B.z); w.scene.add(av.group);
      this.customers.push({ av, x: B.maxX + 1, z: B.z, state: 'walk' });
    }
    let qi = 0;
    this.customers.forEach(c => {
      const i = c.state === 'leave' ? -1 : qi++, tx = C.x - 0.5, tz = C.custZ + Math.max(0, i) * 1.4;
      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
      if (c.state === 'leave') { const ex = B.maxX + 2, ez = B.z, ld = Math.hypot(ex - c.x, ez - c.z); if (ld < 0.3) { w.scene.remove(c.av.group); c.gone = true; } else { c.x += (ex - c.x) / ld * 2.4 * dt; c.z += (ez - c.z) / ld * 2.4 * dt; c.av.group.rotation.y = Math.atan2(ex - c.x, ez - c.z); c.av.animate(2.4, dt, false); } }
      else if (d > 0.1) { const sp = Math.min(d, 2.2 * dt); c.x += dx / d * sp; c.z += dz / d * sp; c.av.group.rotation.y = Math.atan2(dx, dz); c.av.animate(2.2, dt, false); }
      else { c.av.group.rotation.y = Math.PI; c.av.animate(0, dt, false); if (i === 0 && c.state === 'walk') { c.state = 'ready'; } }
      c.av.group.position.set(c.x, B.base, c.z);
    });
    this.customers = this.customers.filter(c => !c.gone);
    const first = this.customers.find(c => c.state !== 'leave');
    if (first && first.state === 'ready' && this.atWindow && !this.qOpen) this.ask(first);
  }
  ask(c) {
    const t = this.t, q = moneyQ(t); this.qOpen = c; c.av.play('wave');
    const box = $('#qModal'); $('#qTitle').textContent = '🏦 ' + t('customerSays');
    $('#qBody').innerHTML = `<div class="q-text"><div class="emoji">🧑</div><div class="sentence">${q.q}</div></div><div class="q-grid">${q.options.map((o, i) => `<button class="q-opt" data-i="${i}">${o}</button>`).join('')}</div>`;
    box.classList.remove('hidden');
    document.querySelectorAll('#qBody .q-opt').forEach(b => b.onclick = () => {
      const ok = q.options[+b.dataset.i] === q.answer;
      b.classList.add(ok ? 'ok' : 'bad'); this.app.sfx(ok ? 'paid' : 'wrong');
      if (!ok) document.querySelectorAll('#qBody .q-opt').forEach(x => { if (x.textContent === q.answer) x.classList.add('ok'); });
      setTimeout(() => {
        box.classList.add('hidden'); this.qOpen = null;
        c.state = 'leave'; c.av.setMood(ok ? 'laugh' : 'angry');
        if (ok) { this.served++; this.pay(100); } else this.draw();
      }, 900);
    });
  }
  closeQ() { if (this.qOpen) { $('#qModal').classList.add('hidden'); this.qOpen = null; } }

  // ---------- cleaner ----------
  spawnLitter(n) {
    const T = this.app.tower, w = this.app.world; this.litter = [];
    const kinds = ['🥤', '📄', '🍌', '🧃', '🍬'];
    for (let i = 0; i < n; i++) {
      const lv = 1 + Math.floor(Math.random() * (T.floors - 1)), y = T.floorY(lv);
      let x, z; do { const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (T.round - 7); x = T.x + Math.sin(a) * r; z = T.z + Math.cos(a) * r; } while (z < T.minZ + 5);
      const m = labelSprite(pick(kinds), 0.55, { bg: null }); m.position.set(x, y + 0.35, z); w.scene.add(m);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.8 })); glow.position.set(x, y + 0.04, z); m.userData.glow = glow; w.scene.add(glow);
      const l = { m, lv, got: false };
      l.zone = w.zone({ test: (px, py, pz) => Math.hypot(px - x, pz - z) < 1.1 && Math.abs(py - y) < 1.2, onEnter: () => {
        if (l.got || this.job !== 'cleaner') return; l.got = true; l.zone.off = true; w.scene.remove(m); w.scene.remove(glow); this.app.sfx('coin'); this.pay(50);
        if (this.litter.every(q => q.got)) { this.app.ui.banner(this.t('allClean'), 3000); setTimeout(() => this.quit(), 1500); }
      } });
      this.litter.push(l);
    }
  }
  floorsHint() { const f = [...new Set(this.litter.filter(l => !l.got).map(l => l.lv + 1))].sort((a, b) => a - b); return f.length ? `· ${this.t('floor')} ${f.join(', ')}` : ''; }
}
