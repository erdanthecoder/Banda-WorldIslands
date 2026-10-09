// Jobs: earn real money by working. Take a job from the 💼 Jobs app on your phone (or the board in mBank).
//  🏦 mBank cashier — customers line up at window 4 and ask money questions; $1 for each one served right.
//  🧹 Tower cleaner — litter appears on World Tower floors; $0.50 for each piece picked up.
//  🙋 Helper — lost visitors on the plaza ask the way; real players can call for help from their phone. $1 each.
//  🍽️ Waiter — take dishes from the kitchen pass to the right table in the restaurant; $1 each.
import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { botAvatar } from './bots.js';
import { labelSprite, CAFE_SPOT, BANK, RESTO, TOWER, MARKET, COURT, PITCH, PLAYGROUND } from './world.js';
import { money, ICON } from './shop.js';

const $ = s => document.querySelector(s);
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const pick = a => a[rnd(0, a.length - 1)];
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cents = c => '$' + (c / 100).toFixed(2);
export const JOBS = ['cashier', 'cleaner', 'helper', 'waiter'];
const JOB_ICON = { cashier: '🏦', cleaner: '🧹', helper: '🙋', waiter: '🍽️' };

// places on the island, for the helper job and for bots that show you the way
export const PLACES = {
  coffee: { icon: '☕', x: CAFE_SPOT.x + 3, z: CAFE_SPOT.z + 3 },
  bank: { icon: '🏦', x: BANK.x + BANK.w / 2 + 3, z: BANK.z },
  resto: { icon: '🍽️', x: RESTO.x - RESTO.w / 2 - 3, z: RESTO.z },
  tower: { icon: '🏢', x: 0, z: -37 },
  market: { icon: '🛒', x: MARKET.x + MARKET.w / 2 + 3, z: 10 },
  court: { icon: '🏀', x: COURT.x - COURT.hw - 4, z: COURT.z },
  stadium: { icon: '⚽', x: PITCH.x, z: PITCH.z - PITCH.hd - 4 },
  playground: { icon: '🎠', x: PLAYGROUND.x - PLAYGROUND.w / 2 - 3, z: 10 },
};
const ASKS = { coffee: 'ask_coffee', bank: 'ask_bank', resto: 'ask_resto', tower: 'ask_tower', market: 'ask_market', court: 'ask_court', stadium: 'ask_stadium', playground: 'ask_playground' };

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
    this.app = app; this.job = null; this.earned = 0; this.helpReqs = {};
    const hud = document.createElement('div'); hud.id = 'jobHud'; hud.className = 'glass hidden'; document.body.appendChild(hud); this.hud = hud;
    app.world.updaters.push(dt => this.tick(dt));
    app.onEvent(ev => this.event(ev));
  }
  get t() { return this.app.t; }
  get w() { return this.app.world; }

  // the list of jobs (phone app, or the board in mBank)
  listHtml() {
    const t = this.t;
    return `<p class="muted">${t('jobsIntro')}</p><div class="menu-grid">${JOBS.map(j => `<button class="tile${this.job === j ? ' on' : ''}" data-j="${j}"><span>${JOB_ICON[j]} ${t('job_' + j)}</span><small>${t('job_' + j + '_d')}</small></button>`).join('')}</div>
      ${this.job ? `<div class="row"><button class="btn danger" id="jobQuit">${t('quitJob')}</button></div>` : ''}`;
  }
  bindList(root, close) {
    root.querySelectorAll('[data-j]').forEach(b => b.onclick = () => { close(); this.start(b.dataset.j); });
    const q = root.querySelector('#jobQuit'); if (q) q.onclick = () => { close(); this.quit(); };
  }
  board() {
    const t = this.t; this.w.inputLocked = true; this.w.keys = {};
    $('#bankTitle').textContent = '💼 ' + t('jobs');
    $('#bankBody').innerHTML = this.listHtml();
    $('#bankBox').classList.remove('hidden');
    this.bindList($('#bankBody'), () => this.app.bankUI.close());
  }
  start(kind) {
    if (this.job) this.quit(true);
    const t = this.t; this.job = kind; this.earned = 0; this.served = 0;
    this.app.sfx('chime');
    if (kind === 'cashier') { const C = this.app.mbank.cashier; this.customers = []; this.spawnT = 1; this.beacon(C.x, C.standZ, this.app.mbank.base, '🏦 ' + t('cashierWindow')); this.app.ui.banner(t('cashierStart'), 5000); }
    if (kind === 'cleaner') { this.spawnLitter(8); this.app.ui.banner(t('cleanerStart'), 5000); }
    if (kind === 'helper') { this.lost = []; this.spawnT = 1; this.beacon(0, 8, null, '🙋 ' + t('plaza')); this.app.ui.banner(t('helperStart'), 5000); }
    if (kind === 'waiter') { const R = this.app.resto; this.guests = []; this.carry = null; this.spawnT = 1; this.beacon(R.pass.x, R.pass.z, R.base, '🛎️ ' + t('pickUp')); this.app.ui.banner(t('waiterStart'), 5000); }
    this.draw();
  }
  quit(silent) {
    if (!this.job) return;
    const w = this.w; this.job = null;
    (this.customers || []).forEach(c => w.scene.remove(c.av.group)); this.customers = [];
    (this.litter || []).forEach(l => { w.scene.remove(l.m); if (l.m.userData.glow) w.scene.remove(l.m.userData.glow); l.zone.off = true; }); this.litter = [];
    (this.lost || []).forEach(c => w.scene.remove(c.av.group)); this.lost = [];
    (this.guests || []).forEach(g => { w.scene.remove(g.av.group); if (g.seat) { g.seat.taken = null; this.app.resto.clearDish(g.seat); } }); this.guests = [];
    this.setCarry(null); this.beacon(null);
    this.hud.classList.add('hidden'); this.closeQ();
    if (!silent) { this.app.ui.banner(`${this.t('shiftDone')} · ${money(this.earned)}`, 3000); setTimeout(() => this.app.settle(), 600); }
  }
  pay(c) { this.earned += c; this.app.earn(c); this.app.sfx('coin'); this.app.ui.floatMoney && this.app.ui.floatMoney(c); this.draw(); }
  draw() {
    if (!this.job) return this.hud.classList.add('hidden');
    const t = this.t, j = this.job;
    const extra = j === 'cleaner' ? ` · 🧹 ${this.litter.filter(l => !l.got).length} ${t('left')} ${this.floorsHint()}` : j === 'waiter' && this.carry ? ` · ${t('carrying')} ${this.carry.icon} → ${t('table')} ${this.carry.guest.seat.table + 1}` : ` · 👥 ${this.served}`;
    this.hud.innerHTML = `💼 <b>${t('job_' + j)}</b> · ${money(this.earned)}${extra} <button id="jobEnd">${t('endShift')}</button>`;
    this.hud.classList.remove('hidden'); $('#jobEnd').onclick = () => this.quit();
  }

  // a glowing column that shows where to go
  beacon(x, z, y, label) {
    const w = this.w;
    if (this.bc) { w.scene.remove(this.bc); this.bc = null; }
    if (x === null || x === undefined) return;
    const g = new THREE.Group(), base = y ?? w.groundAt(x, z);
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 30, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide }));
    col.position.y = 15; g.add(col);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.7, 1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.8 })); ring.position.y = 0.06; g.add(ring);
    if (label) { const sp = labelSprite(label, 0.5, { bg: 'rgba(30,30,30,0.85)' }); sp.position.y = 3.2; g.add(sp); }
    g.position.set(x, base, z); w.scene.add(g); this.bc = g; this.bcAt = { x, z };
  }
  beaconCheck() { if (!this.bc) return; const p = this.w.me.group.position; if (Math.hypot(p.x - this.bcAt.x, p.z - this.bcAt.z) < 2.5) this.beacon(null); }

  tick(dt) {
    if (!this.job) return;
    this.beaconCheck();
    if (this.job === 'cashier') this.cashierTick(dt);
    if (this.job === 'helper') this.helperTick(dt);
    if (this.job === 'waiter') this.waiterTick(dt);
  }

  // ---------- cashier ----------
  cashierIn() { this.inZone = true; if (this.job !== 'cashier') this.app.toast(this.t('cashierHint')); }
  cashierOut() { this.inZone = false; }
  cashierTick(dt) {
    const B = this.app.mbank, C = B.cashier, w = this.w, p = w.me.group.position;
    // you are "at the window" when you stand behind the counter, or right next to it
    this.atWindow = this.inZone || (Math.abs(p.x - C.x) < 2.6 && Math.abs(p.z - C.z) < 2.2 && Math.abs(p.y - B.base) < 1.5);
    if (!this.atWindow) this.closeQ();
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.customers.filter(c => c.state !== 'leave').length < 3) {
      this.spawnT = 6 + Math.random() * 5;
      const av = new Avatar(botAvatar(Math.floor(Math.random() * 1e6)), '', 'bot'); av.group.position.set(B.maxX + 1, B.base, B.z); w.scene.add(av.group);
      this.customers.push({ av, x: B.maxX + 1, z: B.z, state: 'walk' });
    }
    let qi = 0;
    this.customers.forEach(c => {
      const i = c.state === 'leave' ? -1 : qi++, tx = C.x - 0.5, tz = C.custZ + Math.max(0, i) * 1.4;
      const dx = tx - c.x, dz = tz - c.z, d = Math.hypot(dx, dz);
      if (c.state === 'leave') { const ex = B.maxX + 2, ez = B.z, ld = Math.hypot(ex - c.x, ez - c.z); if (ld < 0.3) { w.scene.remove(c.av.group); c.gone = true; } else { c.x += (ex - c.x) / ld * 2.4 * dt; c.z += (ez - c.z) / ld * 2.4 * dt; c.av.group.rotation.y = Math.atan2(ex - c.x, ez - c.z); c.av.animate(2.4, dt, false); } }
      else if (d > 0.1) { const sp = Math.min(d, 2.2 * dt); c.x += dx / d * sp; c.z += dz / d * sp; c.av.group.rotation.y = Math.atan2(dx, dz); c.av.animate(2.2, dt, false); }
      else { c.av.group.rotation.y = Math.PI; c.av.animate(0, dt, false); if (i === 0 && c.state === 'walk') c.state = 'ready'; }
      c.av.group.position.set(c.x, B.base, c.z);
    });
    this.customers = this.customers.filter(c => !c.gone);
    const first = this.customers.find(c => c.state !== 'leave');
    if (first && first.state === 'ready' && this.atWindow && !this.qOpen && !this.w.inputLocked) this.ask(first);
  }
  ask(c) {
    const t = this.t, q = moneyQ(t); this.qOpen = c; c.av.play('wave');
    this.question('🏦 ' + t('customerSays'), '🧑', q.q, q.options, q.answer, ok => {
      c.state = 'leave'; c.av.setMood(ok ? 'laugh' : 'angry');
      if (ok) { this.served++; this.pay(100); } else this.draw();
    });
  }
  question(title, face, text, options, answer, done) {
    const box = $('#qModal'); $('#qTitle').textContent = title;
    $('#qBody').innerHTML = `<div class="q-text"><div class="emoji">${face}</div><div class="sentence">${text}</div></div><div class="q-grid">${options.map((o, i) => `<button class="q-opt" data-i="${i}">${o}</button>`).join('')}</div>`;
    box.classList.remove('hidden');
    document.querySelectorAll('#qBody .q-opt').forEach(b => b.onclick = () => {
      const ok = options[+b.dataset.i] === answer;
      b.classList.add(ok ? 'ok' : 'bad'); this.app.sfx(ok ? 'paid' : 'wrong');
      if (!ok) document.querySelectorAll('#qBody .q-opt').forEach(x => { if (x.textContent === answer) x.classList.add('ok'); });
      setTimeout(() => { box.classList.add('hidden'); this.qOpen = null; done(ok); }, 900);
    });
  }
  closeQ() { if (this.qOpen) { $('#qModal').classList.add('hidden'); this.qOpen = null; } }

  // ---------- cleaner ----------
  spawnLitter(n) {
    const T = this.app.tower, w = this.w; this.litter = [];
    const kinds = ['🥤', '📄', '🍌', '🧃', '🍬'];
    for (let i = 0; i < n; i++) {
      const lv = 1 + Math.floor(Math.random() * (T.floors - 1)), y = T.floorY(lv);
      let x, z; do { const a = Math.random() * Math.PI * 2, r = 4 + Math.random() * (T.round - 7); x = T.x + Math.sin(a) * r; z = T.z + Math.cos(a) * r; } while (z < T.minZ + 5);
      const m = labelSprite(pick(kinds), 0.55, { bg: null }); m.position.set(x, y + 0.35, z); w.scene.add(m);
      const glow = new THREE.Mesh(new THREE.RingGeometry(0.35, 0.5, 24).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffc94d, transparent: true, opacity: 0.8 })); glow.position.set(x, y + 0.04, z); m.userData.glow = glow; w.scene.add(glow);
      const l = { m, lv, got: false };
      l.zone = w.zone({ test: (px, py, pz) => Math.hypot(px - x, pz - z) < 1.1 && Math.abs(py - y) < 1.2, onEnter: () => {
        if (l.got || this.job !== 'cleaner') return; l.got = true; l.zone.off = true; w.scene.remove(m); w.scene.remove(glow); this.pay(50);
        if (this.litter.every(q => q.got)) { this.app.ui.banner(this.t('allClean'), 3000); setTimeout(() => this.quit(), 1500); }
      } });
      this.litter.push(l);
    }
  }
  floorsHint() { const f = [...new Set(this.litter.filter(l => !l.got).map(l => l.lv + 1))].sort((a, b) => a - b); return f.length ? `· ${this.t('floor')} ${f.join(', ')}` : ''; }

  // ---------- helper ----------
  helperTick(dt) {
    const w = this.w, me = w.me.group.position;
    this.spawnT -= dt;
    if (this.spawnT <= 0 && this.lost.filter(c => !c.going).length < 3) {
      this.spawnT = 8 + Math.random() * 6;
      const a = Math.random() * 6.28, r = 9 + Math.random() * 12, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const av = new Avatar(botAvatar(Math.floor(Math.random() * 1e6)), '', 'bot'); av.group.position.set(x, w.groundAt(x, z), z); w.scene.add(av.group);
      const q = labelSprite('❓', 0.7, { bg: 'rgba(255,200,40,0.95)' }); q.position.y = 2.6; av.group.add(q);
      const place = pick(Object.keys(PLACES));
      this.lost.push({ av, q, x, z, place, ry: rnd(0, 6) });
    }
    for (const c of this.lost) {
      const g = c.av.group;
      if (c.going) { const P = PLACES[c.place], dx = P.x - c.x, dz = P.z - c.z, d = Math.hypot(dx, dz); if (d < 1 || (c.going += dt) > 20) { w.scene.remove(g); c.gone = true; continue; } c.x += dx / d * 3 * dt; c.z += dz / d * 3 * dt; g.rotation.y = Math.atan2(dx, dz); g.position.set(c.x, w.groundAt(c.x, c.z), c.z); c.av.animate(3, dt, false); continue; }
      g.rotation.y = Math.atan2(me.x - c.x, me.z - c.z); c.av.animate(0, dt, false);
      c.q.position.y = 2.6 + Math.sin(performance.now() / 300) * 0.1;
      if (!this.qOpen && !w.inputLocked && Math.hypot(me.x - c.x, me.z - c.z) < 1.8) this.helpLost(c);
    }
    this.lost = this.lost.filter(c => !c.gone);
    // real players who asked for help
    for (const id in this.helpReqs) {
      const r = this.helpReqs[id], rem = w.remotes[r.pid];
      if (Date.now() - r.at > 120000 || !rem) { this.dropHelp(id); continue; }
      if (!r.mark) { r.mark = labelSprite('🙋 ' + this.t('needsHelp'), 0.5, { bg: 'rgba(255,90,60,0.95)' }); r.mark.position.y = 3; rem.av.group.add(r.mark); }
      if (rem.av.group.position.distanceTo(me) < 2.2) { this.app.net.emit('helped', { id, to: r.pid, by: this.app.me.name }); this.dropHelp(id); this.served++; this.pay(100); this.app.ui.banner(`🙋 ${this.t('youHelped')} ${r.name}`, 3000); }
    }
  }
  helpLost(c) {
    const t = this.t, keys = shuffle(Object.keys(PLACES)).filter(k => k !== c.place).slice(0, 3).concat(c.place), opts = shuffle(keys.map(k => `${PLACES[k].icon} ${t('place_' + k)}`));
    const ans = `${PLACES[c.place].icon} ${t('place_' + c.place)}`;
    this.qOpen = c; c.av.play('wave');
    this.question('🙋 ' + t('visitorAsks'), '🧳', t(ASKS[c.place]), opts, ans, ok => {
      c.av.group.remove(c.q); c.going = 0.001; c.av.setMood(ok ? 'laugh' : 'sad');
      if (ok) { this.served++; this.pay(100); } else this.draw();
    });
  }
  dropHelp(id) { const r = this.helpReqs[id]; if (r && r.mark && r.mark.parent) r.mark.parent.remove(r.mark); delete this.helpReqs[id]; }
  // anyone can ask for help from their phone; helpers on duty see a marker over you
  askHelp() {
    const id = Math.random().toString(36).slice(2, 8);
    this.app.net.emit('helpReq', { id, pid: this.app.me.pid, name: this.app.me.name });
    this.app.ui.banner('🙋 ' + this.t('helpAsked'), 3500);
  }
  event(ev) {
    const d = ev.data || {};
    if (ev.type === 'helpReq' && d.pid !== this.app.me.pid) {
      if (this.job === 'helper') { this.helpReqs[d.id] = { pid: d.pid, name: d.name, at: Date.now() }; this.app.sfx('beep'); this.app.toast(`🙋 ${d.name} ${this.t('needsHelp')}`); }
    }
    if (ev.type === 'helped') { this.dropHelp(d.id); if (d.to === this.app.me.pid) { this.app.ui.banner(`🙋 ${d.by} ${this.t('cameToHelp')}`, 3500); this.app.sfx('chime'); } }
  }

  // ---------- waiter ----------
  waiterTick(dt) {
    const R = this.app.resto, w = this.w, me = w.me.group.position;
    this.spawnT -= dt;
    const free = R.seats.filter(s => !s.taken);
    if (this.spawnT <= 0 && this.guests.length < 4 && free.length) {
      this.spawnT = 9 + Math.random() * 6;
      const seat = pick(free), av = new Avatar(botAvatar(Math.floor(Math.random() * 1e6)), '', 'bot');
      av.group.position.set(R.minX - 2, R.base, R.z); w.scene.add(av.group);
      const g = { av, seat, x: R.minX - 2, z: R.z, state: 'in', dish: pick(['plov', 'lagman', 'manty', 'soup', 'salad', 'pancakes', 'pizza', 'burger']), path: [[R.minX + 2, R.z], [seat.x, R.z], [seat.x, seat.z]] };
      seat.taken = g; this.guests.push(g);
    }
    for (const g of this.guests) {
      const grp = g.av.group;
      if (g.state === 'in' || g.state === 'out') {
        const [tx, tz] = g.path[0], dx = tx - g.x, dz = tz - g.z, d = Math.hypot(dx, dz);
        if (d < 0.1) { g.path.shift(); if (!g.path.length) { if (g.state === 'out') { w.scene.remove(grp); g.gone = true; g.seat.taken = null; } else { g.state = 'order'; grp.rotation.y = g.seat.ry; g.av.play('sit'); g.bub = labelSprite(ICON[g.dish], 0.55, { bg: 'rgba(255,255,255,0.95)' }); g.bub.position.y = 2.2; grp.add(g.bub); g.ready = performance.now() + 3000; } } }
        else { const st = Math.min(d, 2.4 * dt); g.x += dx / d * st; g.z += dz / d * st; grp.rotation.y = Math.atan2(dx, dz); g.av.animate(2.4, dt, false); }
        grp.position.set(g.x, R.base, g.z);
      } else if (g.state === 'eat') {
        g.av.animate(0, dt, false);
        if ((g.t -= dt) <= 0) { g.state = 'out'; R.clearDish(g.seat); g.path = [[g.seat.x, R.z], [R.minX + 2, R.z], [R.minX - 3, R.z]]; }
      } else {
        g.av.animate(0, dt, false); if (g.av.emote !== 'sit') g.av.play('sit');
        // deliver: walk up to the table with the right dish
        if (this.carry && this.carry.guest === g && Math.hypot(me.x - g.seat.dish.x, me.z - g.seat.dish.z) < 1.9) {
          R.putDish(g.seat, ICON[g.dish]); grp.remove(g.bub); g.state = 'eat'; g.t = 18; g.av.setMood('laugh');
          this.setCarry(null); this.served++; this.pay(100); this.app.ui.banner(`🍽️ ${this.t('served')} +$1`, 1800);
        }
      }
    }
    this.guests = this.guests.filter(g => !g.gone);
  }
  // the kitchen pass: pick up the oldest order that is ready
  pass() {
    if (this.job !== 'waiter') return;
    if (this.carry) return this.app.toast(`${this.t('carrying')} ${this.carry.icon} → ${this.t('table')} ${this.carry.guest.seat.table + 1}`);
    const g = this.guests.find(x => x.state === 'order' && !x.taken && performance.now() > x.ready);
    if (!g) return this.app.toast('👨‍🍳 ' + this.t('noOrders'));
    g.taken = true; this.app.resto.chef.play('wave'); this.app.sfx('ding');
    this.setCarry({ guest: g, icon: ICON[g.dish] });
    this.beacon(g.seat.dish.x, g.seat.dish.z, this.app.resto.base, `${this.t('table')} ${g.seat.table + 1}`);
    this.app.ui.banner(`${ICON[g.dish]} → ${this.t('table')} ${g.seat.table + 1}`, 2500);
  }
  setCarry(c) {
    const me = this.w.me.group;
    if (this.carrySp) { me.remove(this.carrySp); this.carrySp = null; }
    this.carry = c;
    if (c) { this.carrySp = labelSprite('🍽️' + c.icon, 0.6, { bg: null }); this.carrySp.position.y = 2.7; me.add(this.carrySp); }
    this.draw();
  }
}
