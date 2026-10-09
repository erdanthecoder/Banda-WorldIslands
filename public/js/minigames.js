// Multiplayer minigames. Everyone on the server is moved to the arena, a timer runs, then everyone
// returns with results. The host (whoever started it) runs the authoritative logic.
import * as THREE from 'three';
import { PITCH, COURT, isl } from './world.js';
import { Impostor } from './impostor.js';
import { QuizBattle } from './quizbattle.js';
import { WANT, makeBots } from './bots.js';

const TEAM_COL = { red: 0xc0392b, blue: 0x2e6fd1 };
const HUB = isl('hub');
export const MIN_PLAYERS = { football: 1, dodgeball: 1, hide: 1, starhunt: 1, impostor: 1, quiz: 1 };

export class Minigames {
  constructor(app) {
    this.app = app; this.mg = null; this.active = null; this.ballSim = null; this.dballs = []; this.lastKick = 0; this.lastThrow = 0; this.lastSync = 0;
    this.impostor = new Impostor(app, this); this.quiz = new QuizBattle(app, this);
    app.net.onState('mg', mg => this.apply(mg));
    app.net.onState('ball', b => { if (b && this.ballSim && !this.isHost()) Object.assign(this.ballSim, b); });
    app.onEvent(ev => this.event(ev));
  }
  get me() { return this.app.me; }
  ids() { return [this.me.pid, ...Object.keys(this.app.players)]; }
  hostId() {
    const mg = this.mg; if (!mg) return null;
    if (this.app.players[mg.host] || mg.host === this.me.pid) return mg.host;
    return this.ids().sort()[0];
  }
  isHost() { return this.hostId() === this.me.pid; }
  running() { return !!(this.mg && !this.mg.ended && Date.now() < this.mg.start + this.mg.dur); }
  sync(mg) { this.mg = mg; this.app.net.setState('mg', mg); }

  start(type, minutes) {
    const { app } = this;
    if (this.running()) return app.toast(app.t('mgRunning'));
    const humans = this.ids().filter((v, i, a) => a.indexOf(v) === i);
    const bots = humans.length < WANT[type] ? makeBots(WANT[type] - humans.length, 'g') : {};
    const ids = [...humans, ...Object.keys(bots)];
    const shuffled = ids.slice().sort(() => Math.random() - 0.5), teams = {};
    shuffled.forEach((id, i) => teams[id] = i % 2 ? 'blue' : 'red');
    const mg = { type, id: Math.random().toString(36).slice(2, 8), start: Date.now() + 5000, dur: minutes * 60000, host: this.me.pid,
      teams, bots, scores: { red: 0, blue: 0 }, found: {}, seeker: type === 'hide' ? shuffled[0] : null, ended: false };
    if (type === 'impostor') Object.assign(mg, this.impostor.setup(shuffled));
    if (type === 'quiz') Object.assign(mg, this.quiz.setup());
    this.sync(mg);
    if (type === 'football') app.net.setState('ball', { x: PITCH.x, z: PITCH.z, y: PITCH.h + 0.3, vx: 0, vz: 0, vy: 0 });
  }
  end(winner) { if (this.mg && !this.mg.ended) this.sync({ ...this.mg, ended: true, winner: winner || this.mg.winner || null }); }

  nameOf(id) { return id === this.me.pid ? this.me.name : (this.app.players[id]?.name || this.mg?.bots?.[id]?.name || '?'); }
  isBot(id) { return !!this.mg?.bots?.[id]; }
  myTeam() { const mg = this.mg; if (!mg) return null; return mg.teams[this.me.pid] || (this.me.pid.charCodeAt(this.me.pid.length - 1) % 2 ? 'blue' : 'red'); }

  apply(mg) {
    if (!mg) return;
    this.mg = mg;
    const live = !mg.ended && Date.now() < mg.start + mg.dur + 4000;
    if (live && this.active !== mg.id) this.enter();
    else if (!live && this.active === mg.id) this.exit();
    if (this.active) { if (mg.type === 'impostor') this.impostor.apply(mg); if (mg.type === 'quiz') this.quiz.apply(mg); }
  }

  enter() {
    const { app } = this, w = app.world, mg = this.mg, team = this.myTeam();
    this.active = mg.id; this.sentFound = {}; this.shCount = 0;
    app.bots && app.bots.startGame(mg);
    app.closeGame && app.closeGame();
    if (mg.type !== 'quiz') { const p = w.me.group.position; this.back = { x: p.x, z: p.z, y: p.y }; app.sfx('teleport'); app.sfx('whistle'); }
    app.ui.banner(app.t('mg_' + mg.type) + ' — ' + app.t('getReady'), 3500);
    const r = Math.random;
    if (mg.type === 'football') {
      const sx = team === 'red' ? -1 : 1;
      w.teleport(PITCH.x + sx * (6 + r() * 14), PITCH.z + (r() - 0.5) * 24, sx < 0 ? -Math.PI / 2 : Math.PI / 2);
      w.constrain = (x, z) => [Math.max(PITCH.x - PITCH.hw - 1.5, Math.min(PITCH.x + PITCH.hw + 1.5, x)), Math.max(PITCH.z - PITCH.hd - 1.5, Math.min(PITCH.z + PITCH.hd + 1.5, z))];
      this.ballSim = { x: PITCH.x, z: PITCH.z, y: PITCH.h + 0.3, vx: 0, vz: 0, vy: 0 };
    } else if (mg.type === 'dodgeball') {
      const sz = team === 'red' ? -1 : 1;
      w.teleport(COURT.x + (r() - 0.5) * 24, COURT.z + sz * (3 + r() * 5), sz < 0 ? 0 : Math.PI);
      w.constrain = (x, z) => [Math.max(COURT.x - COURT.hw + 0.5, Math.min(COURT.x + COURT.hw - 0.5, x)),
        sz < 0 ? Math.max(COURT.z - COURT.hd + 0.5, Math.min(COURT.z - 0.6, z)) : Math.max(COURT.z + 0.6, Math.min(COURT.z + COURT.hd - 0.5, z))];
    } else if (mg.type === 'hide' || mg.type === 'starhunt') {
      const seeker = mg.type === 'hide' && mg.seeker === this.me.pid; w.noFence = true;
      if (seeker) w.teleport(HUB.x + 2, HUB.z + 8); else { const a = r() * 6.28, d = 12 + r() * 40; w.teleport(HUB.x + Math.cos(a) * d, HUB.z + Math.sin(a) * d); }
      w.constrain = (x, z) => { const d = Math.hypot(x - HUB.x, z - HUB.z), R = 95; return d > R ? [HUB.x + (x - HUB.x) / d * R, HUB.z + (z - HUB.z) / d * R] : [x, z]; };
      if (mg.type === 'starhunt') w.spawnStars(45, HUB.x, HUB.z, 80, () => { this.shCount++; app.sfx('star'); app.award(1, true); });
    } else if (mg.type === 'impostor') this.impostor.enter(mg);
    else if (mg.type === 'quiz') this.quiz.enter(mg);
    w.frozenUntil = performance.now() + Math.max(0, mg.start - Date.now()) + (mg.type === 'hide' && mg.seeker === this.me.pid ? 30000 : 0);
    if (mg.type === 'football' || mg.type === 'dodgeball') this.setTeamRing(w.me, team);
    app.ui.mgButtons(mg.type);
  }

  setTeamRing(av, team) {
    if (av.ring) { av.group.remove(av.ring); av.ring = null; }
    if (!team) return;
    av.ring = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.05, 8, 28).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: TEAM_COL[team] }));
    av.ring.position.y = 0.06; av.group.add(av.ring);
  }

  exit() {
    const { app } = this, w = app.world, mg = this.mg || {}, team = this.myTeam();
    this.active = null; w.constrain = null; w.noFence = false; w.frozenUntil = 0; w.clearStars();
    app.ui.blind(false); app.ui.mgHud(null); app.ui.mgButtons(null);
    this.setTeamRing(w.me, null); for (const id in w.remotes) { this.setTeamRing(w.remotes[id].av, null); w.remotes[id].hidden = false; }
    this.dballs.forEach(b => w.scene.remove(b.m)); this.dballs = []; this.ballSim = null;
    app.bots && app.bots.endGame();
    let reward = 1; const lines = [];
    if (mg.type === 'football' || mg.type === 'dodgeball') {
      const s = mg.scores || { red: 0, blue: 0 };
      lines.push(`${app.t('red')} ${s.red} : ${s.blue} ${app.t('blue')}`);
      const win = s.red === s.blue ? null : s.red > s.blue ? 'red' : 'blue';
      lines.push(win ? `${app.t(win)} ${app.t('wins')}` : app.t('draw'));
      reward += win === team ? 5 : win ? 0 : 2;
    } else if (mg.type === 'hide') {
      const found = Object.keys(mg.found || {}).length;
      if (mg.seeker === this.me.pid) { reward += found; lines.push(`${app.t('youFound')} ${found}`); }
      else if (mg.found && mg.found[this.me.pid]) lines.push(app.t('youWereFound'));
      else { reward += 5; lines.push(app.t('neverFound')); }
    } else if (mg.type === 'starhunt') {
      lines.push(`${app.t('youCollected')} ${this.shCount || 0} ★`);
      const best = Math.max(this.shCount || 0, ...Object.values(app.players).map(p => p.sh || 0), ...Object.values(w.remotes).map(r => r.d?.sh || 0));
      if (this.shCount && this.shCount >= best) { reward += 5; lines.push(app.t('topCollector')); }
    } else if (mg.type === 'impostor') reward += this.impostor.exit(mg, lines);
    else if (mg.type === 'quiz') reward += this.quiz.exit(mg, lines);
    lines.push(`+${reward} ★`);
    app.award(Math.min(10, reward), true);
    app.ui.results(app.t('mg_' + mg.type), lines);
    app.sfx(reward > 4 ? 'champions' : 'cheer');
    w.noFence = false;
    if (mg.type !== 'quiz') { w.fireworks(5); if (this.back) w.teleport(this.back.x, this.back.z, undefined, this.back.y); }
  }

  hudText() {
    const mg = this.mg, app = this.app; if (!mg) return null;
    const now = Date.now(), left = Math.max(0, mg.start + mg.dur - now), pre = mg.start - now;
    const mm = Math.floor(left / 60000), ss = String(Math.floor(left / 1000) % 60).padStart(2, '0');
    let s = `${app.t('mg_' + mg.type)} · ${pre > 0 ? app.t('startsIn') + ' ' + Math.ceil(pre / 1000) : mm + ':' + ss}`;
    if (mg.type === 'football' || mg.type === 'dodgeball') s += ` · ${app.t('red')} ${mg.scores.red} : ${mg.scores.blue} ${app.t('blue')} · ${app.t('yourTeam')}: ${app.t(this.myTeam())}`;
    if (mg.type === 'hide') s += ` · ${mg.seeker === this.me.pid ? app.t('youSeek') : app.t('youHide')} · ${app.t('found')}: ${Object.keys(mg.found || {}).length}`;
    if (mg.type === 'starhunt') s += ` · ★ ${this.shCount || 0}`;
    if (mg.type === 'impostor') s += this.impostor.hud(mg);
    if (mg.type === 'quiz') return null;
    return s;
  }

  event(ev) {
    const { app } = this, mg = this.mg, d = ev.data || {};
    if (ev.type === 'mgReq' && this.isHost() && this.running()) { this.sync(this.mg); return; }
    if (!this.active || !mg) return;
    if (mg.type === 'impostor') return this.impostor.event(ev, mg);
    if (mg.type === 'quiz') return this.quiz.event(ev, mg);
    if (ev.type === 'kick' && mg.type === 'football' && this.ballSim) {
      if (ev.from !== this.me.pid) Object.assign(this.ballSim, { vx: d.vx, vz: d.vz, vy: d.vy });
    } else if (ev.type === 'goal') {
      app.sfx('goal'); app.ui.banner(`${app.t('goal')}! ${app.t(d.team)} ${d.red}:${d.blue}`, 3000);
      app.world.fireworks(4, new THREE.Vector3(d.x, PITCH.h, PITCH.z));
    } else if (ev.type === 'throw' && mg.type === 'dodgeball') {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshStandardMaterial({ color: TEAM_COL[d.team], roughness: 0.5 }));
      m.castShadow = true; m.position.set(...d.o); app.world.scene.add(m);
      this.dballs.push({ m, v: new THREE.Vector3(...d.v), team: d.team, from: d.bot || ev.from, live: true, life: 3 });
      app.sfx('kick');
    } else if (ev.type === 'dbhit') {
      app.sfx('hit');
      if (d.by === this.me.pid) app.toast(app.t('hit') + '!');
      if (this.isBot(d.victim) && app.bots.b[d.victim]) { const bb = app.bots.b[d.victim], sz = bb.team === 'red' ? -1 : 1; bb.z = COURT.z + sz * (COURT.hd - 1.5); bb.frozen = 1.2; }
      if (this.isHost()) { const sc = { ...mg.scores }; sc[d.team] = (sc[d.team] || 0) + 1; this.sync({ ...mg, scores: sc }); }
    } else if (ev.type === 'found' && mg.type === 'hide') {
      app.sfx('whistle'); app.toast(`${d.name} ${app.t('wasFound')}`);
      if (d.id === this.me.pid) app.ui.banner(app.t('youWereFound'), 2000);
      if (this.isHost() && !mg.found[d.id]) {
        const found = { ...(mg.found || {}), [d.id]: 1 }, hiders = Object.keys(mg.teams).filter(id => id !== mg.seeker && (app.players[id] || id === this.me.pid || this.isBot(id)));
        this.sync({ ...mg, found, ended: hiders.every(id => found[id]) });
      }
    }
  }

  action() {
    const mg = this.mg, w = this.app.world; if (!this.active || !mg || performance.now() < w.frozenUntil) return;
    if (mg.type === 'impostor') return this.impostor.action(mg);
    if (mg.type === 'dodgeball') {
      if (performance.now() - this.lastThrow < 700) return; this.lastThrow = performance.now();
      const p = w.me.group.position, dir = new THREE.Vector3(); w.camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
      const v = dir.clone().multiplyScalar(20); v.y = 3;
      this.app.net.emit('throw', { o: [p.x + dir.x, p.y + 1.4, p.z + dir.z], v: [v.x, v.y, v.z], team: this.myTeam() });
    } else if (mg.type === 'football') this.kickPower = performance.now();
  }

  tick(dt) {
    const mg = this.mg, app = this.app, w = app.world;
    if (!mg) { if (!this.asked) { this.asked = true; app.net.emit('mgReq'); } return; }
    if (!this.active) { if (this.running()) this.apply(mg); return; }
    app.ui.mgHud(this.hudText());
    const now = Date.now();
    if (this.isHost()) {
      if (now > mg.start + mg.dur + 300 && !mg.ended) { this.end(); return; }
      if (now - this.lastSync > 3000) { this.lastSync = now; this.sync(this.mg); }
    }
    if (now > mg.start + mg.dur + 5000) { this.exit(); return; }
    if (mg.type === 'football' || mg.type === 'dodgeball') for (const id in w.remotes) { const av = w.remotes[id].av, tm = mg.teams[id]; if (tm && !av.ring) this.setTeamRing(av, tm); }
    const me = w.me.group.position;
    if (mg.type === 'hide') {
      const seeker = mg.seeker === this.me.pid;
      app.ui.blind(seeker && performance.now() < w.frozenUntil, Math.ceil((w.frozenUntil - performance.now()) / 1000));
      if (seeker && performance.now() > w.frozenUntil && now > mg.start) for (const id in w.remotes) {
        if (mg.found[id] || id === mg.seeker || this.sentFound[id]) continue;
        if (w.remotes[id].av.group.position.distanceTo(me) < 2.4) { this.sentFound[id] = 1; app.net.emit('found', { id, name: w.remotes[id].d.name }); }
      }
    }
    if (mg.type === 'football' && this.ballSim) this.football(dt, me);
    if (mg.type === 'dodgeball') this.dodge(dt, me);
    if (mg.type === 'impostor') this.impostor.tick(dt, mg);
    if (mg.type === 'quiz') this.quiz.tick(dt, mg);
  }

  football(dt, me) {
    const b = this.ballSim, w = this.app.world, P = PITCH, host = this.isHost(), R = 0.3;
    const dx = b.x - me.x, dz = b.z - me.z, d = Math.hypot(dx, dz);
    if (d < 0.9 && b.y < P.h + 1.5 && performance.now() - this.lastKick > 220 && Date.now() > this.mg.start) {
      this.lastKick = performance.now();
      const power = performance.now() - (this.kickPower || 0) < 600;
      const sp = Math.max(3.5, (w.speedNow || 0) * 1.35) * (power ? 2.6 : 1);
      const nx = dx / (d || 1), nz = dz / (d || 1);
      Object.assign(b, { vx: nx * sp, vz: nz * sp, vy: power ? 5 : 0.8, x: me.x + nx * 0.95, z: me.z + nz * 0.95 });
      this.app.sfx('kick'); this.app.net.emit('kick', { vx: b.vx, vz: b.vz, vy: b.vy });
      this.kickPower = 0;
    }
    b.vy -= 20 * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
    const floor = P.h + R; if (b.y < floor) { b.y = floor; b.vy = Math.abs(b.vy) > 2 ? -b.vy * 0.45 : 0; }
    const fr = b.y <= floor + 0.01 ? Math.pow(0.5, dt) : Math.pow(0.95, dt); b.vx *= fr; b.vz *= fr;
    if (Math.abs(b.z - P.z) > P.hd) { b.z = P.z + Math.sign(b.z - P.z) * P.hd; b.vz *= -0.6; }
    if (Math.abs(b.x - P.x) > P.hw) {
      const inGoal = Math.abs(b.z - P.z) < 3.6 && b.y < P.h + 2.4;
      if (inGoal && host) {
        const team = b.x > P.x ? 'red' : 'blue', mg = this.mg, sc = { ...mg.scores }; sc[team]++;
        this.sync({ ...mg, scores: sc });
        this.app.net.emit('goal', { team, x: b.x, red: sc.red, blue: sc.blue });
        Object.assign(b, { x: P.x, z: P.z, y: P.h + 4, vx: 0, vz: 0, vy: 0 });
      } else if (!inGoal) { b.x = P.x + Math.sign(b.x - P.x) * P.hw; b.vx *= -0.6; }
    }
    if (host && (this.bt = (this.bt || 0) + dt) > 0.12) { this.bt = 0; this.app.net.setState('ball', { x: +b.x.toFixed(2), z: +b.z.toFixed(2), y: +b.y.toFixed(2), vx: +b.vx.toFixed(2), vz: +b.vz.toFixed(2), vy: +b.vy.toFixed(2) }); }
    const m = w.ball; m.position.lerp(new THREE.Vector3(b.x, b.y, b.z), Math.min(1, dt * 20));
    m.rotation.x += b.vz * dt / R; m.rotation.z -= b.vx * dt / R;
  }

  dodge(dt, me) {
    const w = this.app.world, my = this.myTeam(), C = COURT;
    this.dballs = this.dballs.filter(b => {
      b.life -= dt; b.v.y -= 18 * dt; b.m.position.addScaledVector(b.v, dt);
      if (b.m.position.y < C.h + 0.3) { b.m.position.y = C.h + 0.3; b.v.y *= -0.5; b.v.multiplyScalar(0.7); b.live = false; }
      if (b.live && b.team !== my && performance.now() > (this.invuln || 0)) {
        const dx = b.m.position.x - me.x, dz = b.m.position.z - me.z, dy = b.m.position.y - (me.y + 1);
        if (dx * dx + dz * dz + dy * dy < 0.8) {
          b.live = false; this.invuln = performance.now() + 2000;
          this.app.net.emit('dbhit', { victim: this.me.pid, by: b.from, team: b.team });
          this.app.ui.flash();
          const sz = my === 'red' ? -1 : 1; w.teleport(C.x + (Math.random() - 0.5) * 20, C.z + sz * (C.hd - 1.5)); w.frozenUntil = performance.now() + 1200;
        }
      }
      if (b.live && this.isHost()) for (const id in this.app.bots.b) {
        const bb = this.app.bots.b[id]; if (!bb.team || bb.team === b.team || bb.frozen > 0) continue;
        const dx = b.m.position.x - bb.x, dz = b.m.position.z - bb.z, dy = b.m.position.y - (C.h + 1);
        if (dx * dx + dz * dz + dy * dy < 0.8) { b.live = false; this.app.net.emit('dbhit', { victim: id, by: b.from, team: b.team }); }
      }
      if (b.life <= 0) { w.scene.remove(b.m); return false; }
      return true;
    });
  }
}
