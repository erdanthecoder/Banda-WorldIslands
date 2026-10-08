// Multiplayer minigames: everyone is teleported to the arena, a 5–10 min timer runs,
// then everyone returns with scores. The host (whoever started it) runs the ball physics.
import * as THREE from 'three';
import { PITCH, COURT, heightAt, ISLANDS } from './world.js';

const TEAM_COL = { red: 0xe74c3c, blue: 0x3498db };
const HUB = ISLANDS[0];

export class Minigames {
  constructor(app) {
    this.app = app; this.mg = null; this.active = null; this.ballSim = null; this.dballs = []; this.lastKick = 0; this.lastThrow = 0;
    const { net } = app;
    net.onState('mg', mg => this.apply(mg));
    net.onState('ball', b => { if (b && this.ballSim && !this.isHost()) { const s = this.ballSim; Object.assign(s, b); } });
    app.onEvent(ev => this.event(ev));
  }

  get me() { return this.app.me; }
  hostId() {
    const mg = this.mg; if (!mg) return null;
    if (this.app.players[mg.host] || mg.host === this.me.pid) return mg.host;
    return [this.me.pid, ...Object.keys(this.app.players)].sort()[0];
  }
  isHost() { return this.hostId() === this.me.pid; }
  running() { return this.mg && !this.mg.ended && this.app.net.now() < this.mg.start + this.mg.dur; }

  start(type, minutes) {
    const { app } = this;
    if (this.running()) return app.toast(app.t('mgRunning'));
    const ids = [this.me.pid, ...Object.keys(app.players)].filter((v, i, a) => a.indexOf(v) === i);
    if (type !== 'starhunt' && ids.length < 2) return app.toast(app.t('need2'));
    const shuffled = ids.slice().sort(() => Math.random() - 0.5), teams = {};
    shuffled.forEach((id, i) => teams[id] = i % 2 ? 'blue' : 'red');
    const mg = { type, id: Math.random().toString(36).slice(2, 8), start: app.net.now() + 4000, dur: minutes * 60000, host: this.me.pid,
      teams, scores: { red: 0, blue: 0 }, found: {}, seeker: type === 'hide' ? shuffled[0] : null, ended: false };
    app.net.setState('mg', mg);
    if (type === 'football') app.net.setState('ball', { x: PITCH.x, z: PITCH.z, y: PITCH.h + 0.55, vx: 0, vz: 0, vy: 0 });
  }
  end() { if (this.mg && !this.mg.ended) this.app.net.setState('mg', { ...this.mg, ended: true }); }

  myTeam() { const mg = this.mg; if (!mg) return null; return mg.teams[this.me.pid] || (parseInt(this.me.pid.slice(-2), 36) % 2 ? 'blue' : 'red'); }

  apply(mg) {
    this.mg = mg;
    const live = mg && !mg.ended && this.app.net.now() < mg.start + mg.dur + 5000;
    if (live && this.active !== mg.id) this.enter();
    else if (!live && this.active) this.exit();
    if (live) this.app.ui.mgHud(this.hudText());
  }

  enter() {
    const { app } = this, w = app.world, mg = this.mg, team = this.myTeam();
    this.active = mg.id; this.sentFound = {}; this.shCount = 0; app.closeGame && app.closeGame();
    const p = w.me.group.position; this.back = { x: p.x, z: p.z };
    app.sfx('teleport'); app.sfx('whistle');
    app.ui.banner(app.t('mg_' + mg.type) + ' — ' + app.t('getReady'), 3500);
    const r = Math.random;
    if (mg.type === 'football') {
      const sx = team === 'red' ? -1 : 1;
      w.teleport(PITCH.x + sx * (8 + r() * 12), PITCH.z + (r() - 0.5) * 24, sx < 0 ? -Math.PI / 2 : Math.PI / 2);
      w.constrain = (x, z) => [Math.max(PITCH.x - PITCH.hw - 1, Math.min(PITCH.x + PITCH.hw + 1, x)), Math.max(PITCH.z - PITCH.hd - 1, Math.min(PITCH.z + PITCH.hd + 1, z))];
      this.ballSim = { x: PITCH.x, z: PITCH.z, y: PITCH.h + 0.55, vx: 0, vz: 0, vy: 0 };
    } else if (mg.type === 'dodgeball') {
      const sz = team === 'red' ? -1 : 1;
      w.teleport(COURT.x + (r() - 0.5) * 24, COURT.z + sz * (3 + r() * 5), sz < 0 ? 0 : Math.PI);
      w.constrain = (x, z) => {
        x = Math.max(COURT.x - COURT.hw + 0.5, Math.min(COURT.x + COURT.hw - 0.5, x));
        z = sz < 0 ? Math.max(COURT.z - COURT.hd + 0.5, Math.min(COURT.z - 0.6, z)) : Math.max(COURT.z + 0.6, Math.min(COURT.z + COURT.hd - 0.5, z));
        return [x, z];
      };
    } else {
      const seeker = mg.type === 'hide' && mg.seeker === this.me.pid;
      if (seeker) w.teleport(HUB.x + 2, HUB.z + 6); else { const a = r() * 6.28, d = 12 + r() * 40; w.teleport(HUB.x + Math.cos(a) * d, HUB.z + Math.sin(a) * d); }
      w.constrain = (x, z) => { const d = Math.hypot(x - HUB.x, z - HUB.z), R = HUB.r - 4; return d > R ? [HUB.x + (x - HUB.x) / d * R, HUB.z + (z - HUB.z) / d * R] : [x, z]; };
      if (mg.type === 'starhunt') { this.shCount = 0; w.spawnStars(45, HUB.x, HUB.z, HUB.r - 10, () => { this.shCount++; app.sfx('star'); app.award(1, true); }); }
    }
    w.frozenUntil = performance.now() + Math.max(0, mg.start - app.net.now()) + (mg.type === 'hide' && mg.seeker === this.me.pid ? 30000 : 0);
    if (mg.type === 'football' || mg.type === 'dodgeball') this.setTeamRing(w.me, team);
    app.ui.mgButtons(mg.type);
  }

  setTeamRing(av, team) {
    if (av.ring) { av.group.remove(av.ring); av.ring = null; }
    if (!team) return;
    av.ring = new THREE.Mesh(new THREE.TorusGeometry(0.7, 0.08, 8, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: TEAM_COL[team] }));
    av.ring.position.y = 0.08; av.group.add(av.ring);
  }

  exit() {
    const { app } = this, w = app.world, mg = this.mg || {}, team = this.myTeam();
    this.active = null; w.constrain = null; w.frozenUntil = 0; w.clearStars();
    app.ui.blind(false); app.ui.mgHud(null); app.ui.mgButtons(null);
    this.setTeamRing(w.me, null); for (const id in w.remotes) this.setTeamRing(w.remotes[id].av, null);
    this.dballs.forEach(b => w.scene.remove(b.m)); this.dballs = [];
    this.ballSim = null;
    // results + rewards
    let reward = 1, lines = [];
    if (mg.type === 'football' || mg.type === 'dodgeball') {
      const s = mg.scores || { red: 0, blue: 0 };
      lines.push(`🔴 ${app.t('red')} ${s.red} : ${s.blue} ${app.t('blue')} 🔵`);
      const win = s.red === s.blue ? null : s.red > s.blue ? 'red' : 'blue';
      lines.push(win ? `🏆 ${app.t(win)} ${app.t('wins')}!` : app.t('draw'));
      reward += win === team ? 5 : win ? 0 : 2;
    } else if (mg.type === 'hide') {
      const found = Object.keys(mg.found || {}).length;
      if (mg.seeker === this.me.pid) { reward += found; lines.push(`🔎 ${app.t('youFound')} ${found}`); }
      else if (mg.found && mg.found[this.me.pid]) lines.push(`🙈 ${app.t('youWereFound')}`);
      else { reward += 5; lines.push(`🥷 ${app.t('neverFound')}`); }
    } else if (mg.type === 'starhunt') {
      lines.push(`⭐ ${app.t('youCollected')} ${this.shCount || 0}`);
      const best = Math.max(this.shCount || 0, ...Object.values(app.players).map(p => p.sh || 0));
      if (this.shCount && this.shCount >= best) { reward += 5; lines.push('🏆 ' + app.t('topCollector')); }
    }
    lines.push(`⭐ +${reward}`);
    app.award(reward, true);
    app.ui.results(app.t('mg_' + mg.type), lines);
    app.sfx(reward > 3 ? 'champions' : 'cheer');
    w.fireworks(6);
    if (this.back) w.teleport(this.back.x, this.back.z);
  }

  hudText() {
    const mg = this.mg, app = this.app; if (!mg) return null;
    const now = app.net.now(), left = Math.max(0, mg.start + mg.dur - now), pre = mg.start - now;
    const mm = Math.floor(left / 60000), ss = String(Math.floor(left / 1000) % 60).padStart(2, '0');
    let s = `${app.t('mg_' + mg.type)} · ⏱ ${pre > 0 ? app.t('startsIn') + ' ' + Math.ceil(pre / 1000) : mm + ':' + ss}`;
    if (mg.type === 'football' || mg.type === 'dodgeball') s += ` · 🔴 ${mg.scores.red} : ${mg.scores.blue} 🔵 · ${app.t('yourTeam')}: ${app.t(this.myTeam())}`;
    if (mg.type === 'hide') s += ` · ${mg.seeker === this.me.pid ? '🔎 ' + app.t('youSeek') : '🙈 ' + app.t('youHide')} · ${app.t('found')}: ${Object.keys(mg.found || {}).length}`;
    if (mg.type === 'starhunt') s += ` · ⭐ ${this.shCount || 0}`;
    return s;
  }

  event(ev) {
    const { app } = this, mg = this.mg, d = ev.data || {};
    if (!this.active || !mg) return;
    if (ev.type === 'kick' && mg.type === 'football' && this.ballSim) {
      if (ev.from !== this.me.pid) Object.assign(this.ballSim, { vx: d.vx, vz: d.vz, vy: d.vy });
    } else if (ev.type === 'goal') {
      app.sfx('goal'); app.ui.banner(`⚽ ${app.t('goal')}! ${app.t(d.team)} ${mg.scores.red}:${mg.scores.blue}`, 3000);
      app.world.fireworks(4, new THREE.Vector3(d.x, PITCH.h, PITCH.z));
    } else if (ev.type === 'throw' && mg.type === 'dodgeball') {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshStandardMaterial({ color: TEAM_COL[d.team], roughness: 0.4 }));
      m.castShadow = true; m.position.set(...d.o); app.world.scene.add(m);
      this.dballs.push({ m, v: new THREE.Vector3(...d.v), team: d.team, from: ev.from, live: true, life: 3 });
      app.sfx('kick');
    } else if (ev.type === 'dbhit') {
      app.sfx('hit');
      if (d.by === this.me.pid) app.toast('🎯 ' + app.t('hit') + '!');
      if (this.isHost()) { const sc = { ...mg.scores }; sc[d.team] = (sc[d.team] || 0) + 1; app.net.setState('mg', { ...mg, scores: sc }); }
    } else if (ev.type === 'found' && mg.type === 'hide') {
      app.sfx('whistle'); app.toast(`🔎 ${d.name} ${app.t('wasFound')}`);
      if (this.isHost() && !mg.found[d.id]) {
        const found = { ...(mg.found || {}), [d.id]: 1 }, hiders = Object.keys(mg.teams).filter(id => id !== mg.seeker && (app.players[id] || id === this.me.pid));
        app.net.setState('mg', { ...mg, found, ended: hiders.every(id => found[id]) });
      }
    }
  }

  action() { // kick hard / throw
    const mg = this.mg, w = this.app.world; if (!this.active || !mg || performance.now() < w.frozenUntil) return;
    if (mg.type === 'dodgeball') {
      if (performance.now() - this.lastThrow < 700) return; this.lastThrow = performance.now();
      const p = w.me.group.position, dir = new THREE.Vector3(); w.camera.getWorldDirection(dir); dir.y = 0; dir.normalize();
      const v = dir.clone().multiplyScalar(22); v.y = 3.5;
      this.app.net.emit('throw', { o: [p.x + dir.x, p.y + 1.5, p.z + dir.z], v: [v.x, v.y, v.z], team: this.myTeam() }, this.me.pid);
    } else if (mg.type === 'football') this.kickPower = performance.now();
  }

  tick(dt) {
    const mg = this.mg, app = this.app, w = app.world;
    if (!mg) return;
    if (this.active) app.ui.mgHud(this.hudText());
    if (!this.active) { if (mg && !mg.ended && app.net.now() < mg.start + mg.dur) this.apply(mg); return; }
    const now = app.net.now();
    if (now > mg.start + mg.dur + 500 && this.isHost() && !mg.ended) { app.net.setState('mg', { ...mg, ended: true }); mg.ended = true; }
    if (now > mg.start + mg.dur + 6000) { this.exit(); return; } // safety if host vanished
    // team rings for others
    if (mg.type === 'football' || mg.type === 'dodgeball') for (const id in w.remotes) { const av = w.remotes[id].av, tm = mg.teams[id] || w.remotes[id].d.team; if (tm && !av.ring) this.setTeamRing(av, tm); }
    const me = w.me.group.position;
    if (mg.type === 'hide') {
      const seeker = mg.seeker === this.me.pid;
      app.ui.blind(seeker && performance.now() < w.frozenUntil, Math.ceil((w.frozenUntil - performance.now()) / 1000));
      if (seeker && performance.now() > w.frozenUntil && now > mg.start) for (const id in w.remotes) {
        if (mg.found[id] || id === mg.seeker) continue;
        if (w.remotes[id].av.group.position.distanceTo(me) < 2.6 && !(this.sentFound ||= {})[id]) { this.sentFound[id] = 1; app.net.emit('found', { id, name: w.remotes[id].d.name }, this.me.pid); }
      }
    }
    if (mg.type === 'football' && this.ballSim) this.football(dt, me);
    if (mg.type === 'dodgeball') this.dodge(dt, me);
  }

  football(dt, me) {
    const b = this.ballSim, w = this.app.world, P = PITCH, host = this.isHost();
    // local kick detection -> immediate local response + network
    const dx = b.x - me.x, dz = b.z - me.z, d = Math.hypot(dx, dz);
    if (d < 1.25 && b.y < P.h + 2 && performance.now() - this.lastKick > 250 && this.app.net.now() > this.mg.start) {
      this.lastKick = performance.now();
      const power = performance.now() - (this.kickPower || 0) < 600 ? 2 : 1;
      const sp = Math.max(4, (w.speedNow || 0) * 1.3) * (power > 1 ? 2.2 : 1);
      const nx = dx / (d || 1), nz = dz / (d || 1);
      Object.assign(b, { vx: nx * sp, vz: nz * sp, vy: power > 1 ? 6 : 1.5 });
      b.x = me.x + nx * 1.3; b.z = me.z + nz * 1.3;
      this.app.sfx('kick');
      this.app.net.emit('kick', { vx: b.vx, vz: b.vz, vy: b.vy }, this.me.pid);
      this.kickPower = 0;
    }
    // physics (all clients simulate; host is authoritative)
    b.vy -= 20 * dt; b.x += b.vx * dt; b.z += b.vz * dt; b.y += b.vy * dt;
    const floor = P.h + 0.55; if (b.y < floor) { b.y = floor; b.vy = Math.abs(b.vy) > 2 ? -b.vy * 0.5 : 0; }
    const fr = b.y <= floor + 0.01 ? Math.pow(0.55, dt) : Math.pow(0.95, dt); b.vx *= fr; b.vz *= fr;
    if (Math.abs(b.z - P.z) > P.hd) { b.z = P.z + Math.sign(b.z - P.z) * P.hd; b.vz *= -0.7; }
    if (Math.abs(b.x - P.x) > P.hw) {
      const inGoal = Math.abs(b.z - P.z) < 4 && b.y < P.h + 2.6;
      if (inGoal && host) {
        const team = b.x > P.x ? 'red' : 'blue', mg = this.mg, sc = { ...mg.scores }; sc[team]++;
        this.app.net.setState('mg', { ...mg, scores: sc }); mg.scores = sc;
        this.app.net.emit('goal', { team, x: b.x }, this.me.pid);
        Object.assign(b, { x: P.x, z: P.z, y: P.h + 4, vx: 0, vz: 0, vy: 0 });
      } else if (!inGoal) { b.x = P.x + Math.sign(b.x - P.x) * P.hw; b.vx *= -0.7; }
    }
    if (host && (this.bt = (this.bt || 0) + dt) > 0.07) { this.bt = 0; this.app.net.setState('ball', { x: b.x, z: b.z, y: b.y, vx: b.vx, vz: b.vz, vy: b.vy }); }
    const m = w.ball; m.position.lerp(new THREE.Vector3(b.x, b.y, b.z), Math.min(1, dt * 20));
    m.rotation.x += b.vz * dt / 0.55; m.rotation.z -= b.vx * dt / 0.55;
  }

  dodge(dt, me) {
    const w = this.app.world, my = this.myTeam(), C = COURT;
    this.dballs = this.dballs.filter(b => {
      b.life -= dt; b.v.y -= 18 * dt; b.m.position.addScaledVector(b.v, dt);
      if (b.m.position.y < C.h + 0.4) { b.m.position.y = C.h + 0.4; b.v.y *= -0.5; b.v.multiplyScalar(0.7); b.live = false; }
      if (b.live && b.team !== my && performance.now() > (this.invuln || 0)) {
        const dx = b.m.position.x - me.x, dz = b.m.position.z - me.z, dy = b.m.position.y - (me.y + 1);
        if (dx * dx + dz * dz + dy * dy < 1.3) {
          b.live = false; this.invuln = performance.now() + 2000;
          this.app.net.emit('dbhit', { victim: this.me.pid, by: b.from, team: b.team }, this.me.pid);
          this.app.ui.flash();
          const sz = my === 'red' ? -1 : 1; w.teleport(C.x + (Math.random() - 0.5) * 20, C.z + sz * (C.hd - 1.5)); w.frozenUntil = performance.now() + 1200;
        }
      }
      if (b.life <= 0) { w.scene.remove(b.m); return false; }
      return true;
    });
  }
}
