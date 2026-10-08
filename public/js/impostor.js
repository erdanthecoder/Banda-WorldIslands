// "Impostor": crewmates finish learning tasks around the research station; impostors secretly
// eliminate crewmates. Bodies can be reported, meetings vote someone out.
import * as THREE from 'three';
import { Avatar } from './avatar.js';
import { labelSprite, TEX } from './world.js';
import { makeQuestion } from './games/learn.js';

export const STATION = { x: -900, z: 0, y: -60 };
const ROOMS = [
  ['lab', -20, -10], ['cafeteria', 0, -10], ['library', 20, -10],
  ['engine', -20, 10], ['navigation', 0, 10], ['reactor', 20, 10],
];
const KILL_CD = 25000, MEETING_MS = 50000, TASKS_EACH = 4;

export class Impostor {
  constructor(app, mgs) {
    this.app = app; this.mgs = mgs; this.bodies = {}; this.lastKill = 0; this.taskCd = 0;
    this.build();
  }

  build() {
    const w = this.app.world, S = w.scene, { x, z, y } = STATION;
    const walls = [], H = 4;
    const floorT = w.texMat(TEX.tile, 60, 40, { color: 0xb9c3c9, roughness: 0.55 });
    const wallM = new THREE.MeshStandardMaterial({ color: 0xd5dbe0, roughness: 0.6, metalness: 0.1 });
    const trim = new THREE.MeshStandardMaterial({ color: 0x31404d, roughness: 0.5, metalness: 0.4 });
    const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.receiveShadow = true; S.add(m); return m; };
    add(new THREE.BoxGeometry(60, 0.4, 40), floorT, x, y - 0.2, z);
    add(new THREE.BoxGeometry(60, 0.3, 40), new THREE.MeshStandardMaterial({ color: 0x3b444d }), x, y + H + 0.15, z);
    const wall = (cx, cz, hw, hd) => { add(new THREE.BoxGeometry(hw * 2, H, hd * 2), wallM, x + cx, y + H / 2, z + cz); add(new THREE.BoxGeometry(hw * 2 + 0.02, 0.25, hd * 2 + 0.02), trim, x + cx, y + 0.12, z + cz); walls.push({ x: x + cx, z: z + cz, hw, hd }); };
    // outer walls
    wall(0, -20, 30, 0.2); wall(0, 20, 30, 0.2); wall(-30, 0, 0.2, 20); wall(30, 0, 0.2, 20);
    // inner walls with doorways
    const line = (axis, at, from, to, gaps) => {
      let s = from;
      for (const [g0, g1] of [...gaps, [to, to]]) { if (g0 > s) { const c = (s + g0) / 2, half = (g0 - s) / 2; axis === 'x' ? wall(at, c, 0.2, half) : wall(c, at, half, 0.2); } s = g1; }
    };
    line('x', -10, -20, 20, [[-12, -8], [8, 12]]); line('x', 10, -20, 20, [[-12, -8], [8, 12]]);
    line('z', 0, -30, 30, [[-22, -18], [-2.5, 2.5], [18, 22]]);
    this.interior = w.addInterior({ minX: x - 29.6, maxX: x + 29.6, minZ: z - 19.6, maxZ: z + 19.6, floor: y, ceil: H, walls });
    // lights
    const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xe8f4ff, emissiveIntensity: 2.2 });
    for (const [, rx, rz] of ROOMS) add(new THREE.BoxGeometry(4, 0.08, 0.6), lampM, x + rx, y + H - 0.02, z + rz);
    this.lights = [];
    for (const [lx, lz] of [[-14, 0], [14, 0]]) { const l = new THREE.PointLight(0xe8f2ff, 0, 45, 1.3); l.position.set(x + lx, y + 3.5, z + lz); S.add(l); this.lights.push(l); }
    // room signs
    this.roomSigns = ROOMS.map(([id, rx, rz]) => { const s = labelSprite(id, 0.5, { bg: 'rgba(20,30,40,0.6)' }); s.position.set(x + rx, y + 3.4, z + rz - 7); S.add(s); return { id, s, rx, rz }; });
    // meeting table + emergency button (cafeteria)
    const table = add(new THREE.CylinderGeometry(3, 3, 0.15, 32), new THREE.MeshStandardMaterial({ color: 0x8a9299, metalness: 0.5, roughness: 0.3 }), x, y + 0.85, z - 10); table.castShadow = true;
    add(new THREE.CylinderGeometry(0.4, 0.6, 0.85, 16), trim, x, y + 0.42, z - 10);
    const btn = add(new THREE.CylinderGeometry(0.35, 0.35, 0.18, 24), new THREE.MeshStandardMaterial({ color: 0xd11f2f, emissive: 0x550000 }), x, y + 1.0, z - 10);
    walls.push({ x, z: z - 10, hw: 2.9, hd: 2.9 });
    this.emergency = { x, z: z - 13.6, y, label: 'Emergency', action: { emergency: true }, group: btn };
    // task consoles: two per room
    this.consoles = [];
    const consM = new THREE.MeshStandardMaterial({ color: 0x24303a, metalness: 0.5, roughness: 0.4 });
    ROOMS.forEach(([, rx, rz]) => [[-6, -6], [6, 6]].forEach(([ox, oz]) => {
      const cx = x + rx + ox, cz = z + rz + oz;
      add(new THREE.BoxGeometry(1.2, 1, 0.6), consM, cx, y + 0.5, cz).castShadow = true;
      const scr = add(new THREE.BoxGeometry(1.0, 0.6, 0.05), new THREE.MeshStandardMaterial({ color: 0x050a10, emissive: 0x1d6bd6, emissiveIntensity: 0.8 }), cx, y + 1.25, cz - 0.15);
      scr.rotation.x = -0.4;
      walls.push({ x: cx, z: cz, hw: 0.6, hd: 0.3 });
      const idx = this.consoles.length;
      this.consoles.push({ x: cx, z: cz + 1.1, y, label: 'Task', action: { task: idx }, group: scr, scr });
    }));
  }

  setLit(on) { this.lights.forEach(l => (l.intensity = on ? 40 : 0)); }

  setup(ids) {
    const nImp = ids.length >= 7 ? 2 : 1, impostors = ids.slice(0, nImp), tasks = {};
    ids.forEach(id => { const all = this.consoles.map((_, i) => i).sort(() => Math.random() - 0.5); tasks[id] = all.slice(0, TASKS_EACH); });
    return { impostors, tasks, done: {}, dead: {}, ejected: {}, reported: {}, phase: 'play', votes: {}, emergencyUsed: {} };
  }

  role(mg, id = this.app.me.pid) { return mg.impostors.includes(id) ? 'impostor' : 'crew'; }
  alive(mg, id) { return !mg.dead[id] && !mg.ejected[id]; }
  present(id) { return id === this.app.me.pid || !!this.app.players[id]; }
  name(id) { return id === this.app.me.pid ? this.app.me.name : (this.app.players[id]?.name || '?'); }

  enter(mg) {
    const w = this.app.world, { x, z, y } = STATION, t = this.app.t;
    this.setLit(true); this.lastKill = Date.now(); this.phase = 'play'; this.ghost = false;
    const a = Math.random() * 6.28; w.teleport(x + Math.cos(a) * 5, z - 10 + Math.sin(a) * 5, Math.PI, y);
    w.portals.push(this.emergency, ...this.consoles);
    this.refreshConsoles(mg);
    const imp = this.role(mg) === 'impostor';
    this.app.ui.banner(imp ? t('youImpostor') : t('youCrew'), 4500);
    if (imp && mg.impostors.length > 1) this.app.toast(t('otherImpostor') + ': ' + mg.impostors.filter(i => i !== this.app.me.pid).map(i => this.name(i)).join(', '));
    this.roomSigns.forEach(r => { r.s.material.map.dispose(); const n = labelSprite(t('room_' + r.id), 0.5, { bg: 'rgba(20,30,40,0.6)' }); r.s.material = n.material; r.s.scale.copy(n.scale); });
    this.emergency.label = t('emergency'); this.consoles.forEach(c => (c.label = t('task')));
  }

  refreshConsoles(mg) {
    const mine = new Set(mg.tasks[this.app.me.pid] || []), doneN = mg.done[this.app.me.pid] || 0;
    this.myDone ||= new Set();
    this.consoles.forEach((c, i) => c.scr.material.emissive.setHex(mine.has(i) && !this.myDone.has(i) ? 0xf2b705 : 0x1d6bd6));
    return doneN;
  }

  apply(mg) {
    const w = this.app.world, me = this.app.me.pid, t = this.app.t, meAlive = this.alive(mg, me);
    if (!meAlive && !this.ghost) { this.ghost = true; w.me.setGhost(true); this.app.ui.banner(mg.ejected[me] ? t('youEjected') : t('youDied'), 4000); this.app.sfx('hit'); }
    for (const id in w.remotes) {
      const dead = !this.alive(mg, id), r = w.remotes[id];
      r.hidden = dead && meAlive; r.av.setGhost(dead);
    }
    // bodies
    for (const id in mg.dead) if (!this.bodies[id] && !mg.reported[id]) {
      const av = new Avatar(this.app.players[id]?.avatar || (id === me ? this.app.me.avatar : null), '', 'student'); av.label.visible = false;
      av.group.rotation.set(-Math.PI / 2, 0, Math.random() * 6); av.group.position.set(mg.dead[id].x, STATION.y + 0.15, mg.dead[id].z);
      w.scene.add(av.group); this.bodies[id] = av;
    }
    for (const id in this.bodies) if (mg.reported[id]) { w.scene.remove(this.bodies[id].group); delete this.bodies[id]; }
    // meeting phase changes
    if (mg.phase !== this.phase) {
      this.phase = mg.phase;
      if (mg.phase === 'meeting') {
        this.app.sfx('airhorn'); this.app.ui.banner(`${t('meeting')} — ${mg.meetingBy || ''}`, 2500);
        if (meAlive) { const a = Math.random() * 6.28; w.teleport(STATION.x + Math.cos(a) * 4, STATION.z - 10 + Math.sin(a) * 4, undefined, STATION.y); }
        w.frozenUntil = performance.now() + 1e9;
      } else {
        w.frozenUntil = 0; this.closeVote();
        if (mg.lastEjected) this.app.ui.banner(mg.lastEjected.id ? `${mg.lastEjected.name} ${t('wasEjected')} — ${mg.lastEjected.imp ? t('wasImpostor') : t('wasNotImpostor')}` : t('noEjection'), 4500);
        this.lastKill = Date.now();
      }
    }
    if (mg.phase === 'meeting') this.voteUI(mg);
  }

  hud(mg) {
    const t = this.app.t, all = Object.values(mg.tasks).length ? Object.entries(mg.tasks).filter(([id]) => !mg.impostors.includes(id)).reduce((s, [, l]) => s + l.length, 0) : 1;
    const done = Object.entries(mg.done).filter(([id]) => !mg.impostors.includes(id)).reduce((s, [, n]) => s + n, 0);
    const imp = this.role(mg) === 'impostor';
    let s = ` · ${imp ? t('impostor') : t('crew')} · ${t('tasks')} ${Math.round(done / all * 100)}%`;
    if (imp && this.alive(mg, this.app.me.pid)) { const cd = Math.max(0, Math.ceil((KILL_CD - (Date.now() - this.lastKill)) / 1000)); s += ` · ${cd ? t('killIn') + ' ' + cd + 's' : t('killReady')}`; }
    return s;
  }

  tick(dt, mg) {
    const w = this.app.world, me = w.me.group.position, t = this.app.t, pid = this.app.me.pid;
    // report prompt
    this.nearBody = null;
    if (this.alive(mg, pid) && mg.phase === 'play') for (const id in this.bodies) { const b = this.bodies[id].group.position; if (Math.hypot(b.x - me.x, b.z - me.z) < 2.5) this.nearBody = id; }
    this.app.ui.impostorButtons(mg.phase === 'play' && this.alive(mg, pid) ? { report: !!this.nearBody, kill: this.role(mg) === 'impostor' && !!this.target(mg) && Date.now() - this.lastKill > KILL_CD } : null);
    if (!this.mgs.isHost()) return;
    if (mg.phase === 'meeting' && Date.now() > mg.phaseEnds) this.resolve(mg);
    const win = this.winner(mg); if (win) this.mgs.end(win);
  }

  target(mg) {
    const w = this.app.world, me = w.me.group.position; let best = null, bd = 1.8;
    for (const id in w.remotes) { if (!this.alive(mg, id) || mg.impostors.includes(id)) continue; const d = w.remotes[id].av.group.position.distanceTo(me); if (d < bd) { bd = d; best = id; } }
    return best;
  }
  action(mg) { this.kill(mg); }
  kill(mg) {
    const v = this.target(mg); if (!v || Date.now() - this.lastKill < KILL_CD || mg.phase !== 'play') return;
    this.lastKill = Date.now();
    const p = this.app.world.remotes[v].av.group.position;
    this.app.net.emit('imp_kill', { victim: v, x: p.x, z: p.z });
  }
  report() { if (this.nearBody) this.app.net.emit('imp_meeting', { by: this.app.me.name, body: this.nearBody }); }
  callEmergency(mg) {
    if (!this.alive(mg, this.app.me.pid) || mg.phase !== 'play') return;
    if (mg.emergencyUsed[this.app.me.pid]) return this.app.toast(this.app.t('emergencyUsed'));
    this.app.net.emit('imp_meeting', { by: this.app.me.name, emergency: true });
  }

  doTask(i, mg) {
    const t = this.app.t, pid = this.app.me.pid;
    if (!(mg.tasks[pid] || []).includes(i) || this.myDone?.has(i)) return this.app.toast(t('notYourTask'));
    if (Date.now() < this.taskCd) return this.app.toast(t('wait'));
    if (this.role(mg) === 'impostor') { this.app.toast(t('fakeTask')); return; }
    const q = makeQuestion('mixed', 2 + Math.floor(Math.random() * 2), t);
    this.app.ui.question(t('task') + ' · ' + t('room_' + ROOMS[Math.floor(i / 2)][0]), q, ok => {
      if (ok) { this.myDone.add(i); this.refreshConsoles(mg); this.app.net.emit('imp_task', { i }); this.app.award(1); }
      else { this.taskCd = Date.now() + 4000; this.app.toast(t('tryAgainSoon')); }
    });
  }

  event(ev, mg) {
    const d = ev.data || {}, host = this.mgs.isHost();
    if (!host) return;
    const from = ev.from;
    if (ev.type === 'imp_task' && (mg.tasks[from] || []).includes(d.i)) {
      const done = { ...mg.done, [from]: Math.min(TASKS_EACH, (mg.done[from] || 0) + 1) };
      this.mgs.sync({ ...mg, done });
    } else if (ev.type === 'imp_kill' && mg.phase === 'play' && mg.impostors.includes(from) && this.alive(mg, from) && this.alive(mg, d.victim) && !mg.impostors.includes(d.victim)) {
      this.mgs.sync({ ...mg, dead: { ...mg.dead, [d.victim]: { x: d.x, z: d.z } } });
    } else if (ev.type === 'imp_meeting' && mg.phase === 'play' && this.alive(mg, from)) {
      if (d.emergency && mg.emergencyUsed[from]) return;
      const reported = { ...mg.reported }; for (const id in mg.dead) reported[id] = 1;
      this.mgs.sync({ ...mg, phase: 'meeting', phaseEnds: Date.now() + MEETING_MS, votes: {}, meetingBy: d.by, reported, emergencyUsed: d.emergency ? { ...mg.emergencyUsed, [from]: 1 } : mg.emergencyUsed });
    } else if (ev.type === 'imp_vote' && mg.phase === 'meeting' && this.alive(mg, from) && !mg.votes[from]) {
      const votes = { ...mg.votes, [from]: d.target }, next = { ...mg, votes };
      const voters = Object.keys(mg.teams).filter(id => this.alive(mg, id) && this.present(id));
      if (voters.every(id => votes[id])) this.resolve(next); else this.mgs.sync(next);
    }
  }

  resolve(mg) {
    const tally = {}; Object.values(mg.votes).forEach(v => (tally[v] = (tally[v] || 0) + 1));
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    let out = null; if (sorted.length && sorted[0][0] !== 'skip' && (!sorted[1] || sorted[1][1] < sorted[0][1])) out = sorted[0][0];
    const ejected = out ? { ...mg.ejected, [out]: 1 } : mg.ejected;
    this.mgs.sync({ ...mg, phase: 'play', votes: {}, ejected, lastEjected: out ? { id: out, name: this.name(out), imp: mg.impostors.includes(out) } : { id: null } });
  }

  winner(mg) {
    if (mg.ended) return null;
    const ids = Object.keys(mg.teams).filter(id => this.present(id));
    const imps = ids.filter(id => mg.impostors.includes(id) && this.alive(mg, id)).length;
    const crew = ids.filter(id => !mg.impostors.includes(id) && this.alive(mg, id)).length;
    if (imps === 0) return 'crew';
    if (imps >= crew) return 'impostor';
    const need = ids.filter(id => !mg.impostors.includes(id)).reduce((s, id) => s + (mg.tasks[id] || []).length, 0);
    const done = ids.filter(id => !mg.impostors.includes(id)).reduce((s, id) => s + (mg.done[id] || 0), 0);
    if (need && done >= need) return 'crew';
    if (Date.now() > mg.start + mg.dur) return 'impostor';
    return null;
  }

  voteUI(mg) {
    const t = this.app.t, pid = this.app.me.pid;
    let el = document.getElementById('voteBox');
    if (!el) { el = document.createElement('div'); el.id = 'voteBox'; el.className = 'modal'; document.body.appendChild(el); }
    const ids = Object.keys(mg.teams).filter(id => this.present(id));
    const left = Math.max(0, Math.ceil((mg.phaseEnds - Date.now()) / 1000));
    const canVote = this.alive(mg, pid) && !mg.votes[pid];
    const key = JSON.stringify([mg.votes, canVote]);
    if (el.dataset.key === key) { el.querySelector('.vote-time').textContent = left + ' s'; return; }
    el.dataset.key = key;
    el.innerHTML = `<div class="sheet small"><div class="sheet-head"><h2>${t('meeting')}</h2><span class="vote-time">${left} s</span></div>
      <p class="muted">${t('voteHelp')}</p><div class="vote-list">${ids.map(id => {
        const dead = !this.alive(mg, id), voted = !!mg.votes[id];
        return `<button class="vote-row" data-id="${id}" ${dead || !canVote ? 'disabled' : ''}><span>${this.name(id)}${id === pid ? ' (' + t('you') + ')' : ''}</span><span>${dead ? t('dead') : voted ? '✓ ' + t('voted') : ''}</span></button>`;
      }).join('')}</div><button class="btn ghost vote-skip" ${canVote ? '' : 'disabled'}>${t('skipVote')}</button></div>`;
    el.querySelectorAll('.vote-row').forEach(b => b.onclick = () => this.app.net.emit('imp_vote', { target: b.dataset.id }));
    el.querySelector('.vote-skip').onclick = () => this.app.net.emit('imp_vote', { target: 'skip' });
  }
  closeVote() { const el = document.getElementById('voteBox'); if (el) el.remove(); }

  exit(mg, lines) {
    const w = this.app.world, t = this.app.t, pid = this.app.me.pid;
    this.closeVote(); this.setLit(false); this.app.ui.impostorButtons(null);
    w.portals = w.portals.filter(p => p !== this.emergency && !this.consoles.includes(p));
    for (const id in this.bodies) w.scene.remove(this.bodies[id].group); this.bodies = {};
    w.me.setGhost(false); for (const id in w.remotes) w.remotes[id].av.setGhost(false);
    this.myDone = new Set(); w.frozenUntil = 0;
    const win = mg.winner || 'impostor', mine = this.role(mg) === 'impostor' ? 'impostor' : 'crew';
    lines.push(win === 'crew' ? t('crewWins') : t('impostorWins'));
    lines.push(`${t('impostorWas')}: ${mg.impostors.map(i => this.name(i)).join(', ')}`);
    return win === mine ? 6 : 0;
  }
}
