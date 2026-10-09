// Bots: computer players. They walk around when the server is quiet and fill minigames
// so even one player can play. One client (the host) simulates them and shares their positions.
import { Avatar, SKINS, HAIR_COLORS, CLOTH, PANTS, SHOES, HAIRSTYLES, TOPS, FACES } from './avatar.js';
import { heightAt, isl, PITCH, COURT } from './world.js';

const NAMES = ['Aru', 'Timur', 'Dana', 'Max', 'Lina', 'Emir', 'Sofia', 'Nurlan', 'Ali', 'Mira', 'Adel', 'Zara', 'Bek', 'Aya'];
const HUB = isl('hub');
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
export const WANT = { football: 6, dodgeball: 4, hide: 5, starhunt: 4, impostor: 6, quiz: 4 };

export function botAvatar(seed) {
  let s = seed * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const p = a => a[Math.floor(r() * a.length)];
  return { skin: p(SKINS), face: p(FACES), hair: p(HAIRSTYLES), hairColor: p(HAIR_COLORS), top: p(TOPS), shirt: p(CLOTH), pants: p(PANTS), shoes: p(SHOES), hat: 'none', pet: 'none', height: 0.92 + r() * 0.14 };
}
export function makeBots(n, prefix) {
  const out = {}, used = new Set();
  for (let i = 0; i < n; i++) { let nm; do nm = pick(NAMES); while (used.has(nm) && used.size < NAMES.length); used.add(nm); out[`bot-${prefix}${i}`] = { name: `Bot ${i + 1}`, avatar: botAvatar(Math.floor(Math.random() * 1e6)) }; }
  return out;
}

export class Bots {
  constructor(app) {
    this.app = app; this.b = {}; this.sent = 0; this.seen = {};
    app.onEvent(ev => { if (ev.type === 'bots' && !this.amHost()) this.receive(ev.data); });
  }
  get mgs() { return this.app.mg; }
  humans() { return [this.app.me.pid, ...Object.keys(this.app.players)]; }
  amHost() { const m = this.mgs; if (m && m.running()) return m.isHost(); return this.humans().sort()[0] === this.app.me.pid; }
  name(id) { return this.b[id]?.name || this.seen[id]?.name; }

  spawn(id, info, x, z, extra = {}) {
    const b = this.b[id] = { id, name: info.name, avatar: info.avatar, x, z, y: heightAt(x, z), ry: 0, speed: 0, wait: 0, tx: x, tz: z, ...extra };
    return b;
  }
  clear(prefix) { for (const id in this.b) if (!prefix || id.startsWith(prefix)) { delete this.b[id]; this.app.world.upsertRemote(id, null); } }

  // ---- movement helpers ----
  moveTo(b, tx, tz, sp, dt, floor) {
    const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
    if (d < 0.15) { b.speed = 0; return true; }
    const step = Math.min(d, sp * dt); b.x += dx / d * step; b.z += dz / d * step; b.ry = Math.atan2(dx, dz); b.speed = sp;
    b.y = floor ?? heightAt(b.x, b.z);
    return d < 0.6;
  }
  wander(b, dt, cx, cz, rMin, rMax, sp = 2.2, floor) {
    if (b.wait > 0) { b.wait -= dt; b.speed = 0; return; }
    if (this.moveTo(b, b.tx, b.tz, sp, dt, floor)) { b.wait = rand(1.5, 6); const a = rand(0, 6.28), r = rand(rMin, rMax); b.tx = cx + Math.cos(a) * r; b.tz = cz + Math.sin(a) * r; }
  }

  tick(dt) {
    const app = this.app, mg = this.mgs && this.mgs.mg, running = this.mgs && this.mgs.running() && this.mgs.active;
    if (!this.amHost()) return;
    // ambient bots when the server is quiet and nothing is running
    const ambient = !running && this.humans().length < 4;
    const ambIds = Object.keys(this.b).filter(id => id.startsWith('bot-a'));
    if (ambient && !ambIds.length) { const bs = makeBots(5, 'a'); for (const id in bs) { const a = rand(0, 6.28), r = rand(7, 20); const b = this.spawn(id, bs[id], HUB.x + Math.cos(a) * r, HUB.z + Math.sin(a) * r); b.tx = b.x; b.tz = b.z; if (+id.slice(5) < 3) { b.tripper = true; b.nextTrip = rand(2, 12); } } }
    if (!ambient && ambIds.length) this.clear('bot-a');
    for (const id in this.b) {
      const b = this.b[id];
      if (id.startsWith('bot-a')) { if (b.trip || (b.tripper && (b.nextTrip -= dt) < 0)) this.trip(b, dt); else this.wander(b, dt, HUB.x, HUB.z, 6, 21); }
      else if (running && mg.bots && mg.bots[id]) this.play(b, mg, dt);
    }
    // render locally and share with others ~6 times a second
    const w = app.world, list = Object.values(this.b).map(b => ({ id: b.id, name: b.name, role: 'bot', avatar: b.avatar, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2), ry: +b.ry.toFixed(2), sh: b.sh || 0, team: b.team }));
    list.forEach(d => w.upsertRemote(d.id, d, dd => new Avatar(dd.avatar, dd.name, 'bot')));
    for (const id in w.remotes) if (id.startsWith('bot-') && !this.b[id]) w.upsertRemote(id, null);
    if (performance.now() - this.sent > 170) { this.sent = performance.now(); if (list.length || this.hadBots) app.net.emit('bots', list); this.hadBots = list.length > 0; }
  }
  receive(list) {
    const w = this.app.world, ids = new Set();
    (list || []).forEach(d => { ids.add(d.id); this.seen[d.id] = d; w.upsertRemote(d.id, d, dd => new Avatar(dd.avatar, dd.name, 'bot')); });
    for (const id in w.remotes) if (id.startsWith('bot-') && !ids.has(id)) w.upsertRemote(id, null);
  }

  // ---- trips up Banda Tower: walk in, call an elevator, ride, look around, ride back down ----
  trip(b, dt) {
    const T = this.app.tower, w = this.app.world; if (!T) return;
    if (!b.trip) {
      const e = T.elevators.find(x => !x.botBusy) || T.elevators[b.id.length % 2];
      const lv = 1 + Math.floor(Math.random() * 7), land = [e.cx + rand(-0.6, 0.6), e.cz + 3.2];
      const out = [[rand(-2, 2), -22], [rand(-2, 2), -41], [rand(-2, 2), -49]];
      b.trip = { e, i: 0, t: 0, steps: [
        ...out.map(([x, z]) => ({ k: 'walk', x, z, lv: 0 })), { k: 'walk', x: land[0], z: land[1], lv: 0 },
        { k: 'call', lv: 0 }, { k: 'walk', x: e.cx + rand(-0.6, 0.6), z: e.cz - 0.3, lv: 0, cab: true }, { k: 'ride', lv },
        { k: 'walk', x: land[0], z: land[1], cab: true }, { k: 'wander', t: rand(15, 35) },
        { k: 'walk', x: land[0], z: land[1] }, { k: 'call' }, { k: 'walk', x: e.cx, z: e.cz - 0.3, cab: true }, { k: 'ride', lv: 0 },
        { k: 'walk', x: land[0], z: land[1], lv: 0, cab: true }, ...out.reverse().map(([x, z]) => ({ k: 'walk', x, z, lv: 0 })),
      ] };
    }
    const tr = b.trip, e = tr.e, st = tr.steps[tr.i];
    const next = () => { tr.i++; tr.t = 0; if (tr.i >= tr.steps.length) { b.trip = null; b.nextTrip = rand(20, 60); b.y = heightAt(b.x, b.z); b.tx = b.x; b.tz = b.z; e.botBusy = null; } };
    const playerIn = e.contains(w.me.group.position) || (w.carrier && w.carrier.elev === e);
    tr.t += dt;
    if (st.k === 'walk') {
      if (st.cab && (e.state !== 'idle' || e.open < 0.6)) { b.speed = 0; tr.t = Math.min(tr.t, 1); if (st.cab && T.contains(b.x, b.z) && Math.abs(b.z - e.cz) < 1.5) b.y = e.y; return; } // wait for the doors
      const y = st.cab && Math.abs(b.z - e.cz) < 1.5 ? e.y : st.lv === 0 && !T.contains(b.x, b.z) ? null : T.floorY(st.lv ?? tr.floor ?? 0);
      if (this.moveTo(b, st.x, st.z, 2.4, dt, y ?? undefined) || tr.t > 25) next();
    } else if (st.k === 'call') {
      b.speed = 0; e.botBusy = b.id;
      const lv = st.lv ?? tr.floor ?? 0;
      if (!playerIn && !(e.level === lv && e.state === 'idle')) { if (e.state === 'idle') e.go(lv); }
      if (e.level === lv && e.state === 'idle' && e.open > 0.9) next();
      if (tr.t > 40) { tr.i = tr.steps.length - 1; tr.t = 0; }
    } else if (st.k === 'ride') {
      b.speed = 0; b.y = e.y;
      if (tr.t < 0.2 && !playerIn) e.go(st.lv);
      if (e.state === 'idle' && e.open > 0.9 && tr.t > 1) { tr.floor = e.level; next(); }
    } else if (st.k === 'wander') {
      const y = T.floorY(tr.floor || 0);
      if (!st.init) { st.init = 1; b.wait = 0; b.tx = T.x + rand(-12, 12); b.tz = T.z + rand(0, 8); }
      if (b.wait > 0) { b.wait -= dt; b.speed = 0; } else if (this.moveTo(b, b.tx, b.tz, 2, dt, y)) { b.wait = rand(1, 4); b.tx = T.x + rand(-T.w / 2 + 3, T.w / 2 - 3); b.tz = T.z + rand(-T.d / 2 + 6, T.d / 2 - 3); }
      if (tr.t > st.t) next();
    }
  }

  // ---- minigames ----
  startGame(mg) {
    this.clear('bot-g');
    if (!this.amHost() || !mg.bots) return;
    for (const id in mg.bots) {
      const team = mg.teams[id], info = mg.bots[id];
      let x = HUB.x + rand(-20, 20), z = HUB.z + rand(8, 30), extra = { team, sh: 0, cd: rand(1, 3) };
      if (mg.type === 'football') { x = PITCH.x + (team === 'red' ? -1 : 1) * rand(5, 20); z = PITCH.z + rand(-14, 14); }
      if (mg.type === 'dodgeball') { x = COURT.x + rand(-12, 12); z = COURT.z + (team === 'red' ? -1 : 1) * rand(2, 8); }
      if (mg.type === 'impostor') { const S = this.mgs.impostor.station; x = S.x + rand(-4, 4); z = S.z - 10 + rand(-4, 4); extra.floor = S.y; }
      if (mg.type === 'hide' && mg.seeker !== id) { const a = rand(0, 6.28), r = rand(20, 55); extra.tx = HUB.x + Math.cos(a) * r; extra.tz = HUB.z + Math.sin(a) * r; }
      const b = this.spawn(id, info, x, z, extra);
      if (extra.floor !== undefined) b.y = extra.floor;
      if (extra.tx === undefined) { b.tx = x; b.tz = z; }
    }
  }
  endGame() { this.clear('bot-g'); }

  play(b, mg, dt) {
    const now = Date.now(); if (now < mg.start) return;
    const f = this['_' + mg.type]; if (f) f.call(this, b, mg, dt);
  }

  _football(b, mg, dt) {
    const ball = this.mgs.ballSim; if (!ball) return;
    const P = PITCH, dir = b.team === 'red' ? 1 : -1, goalX = P.x + dir * P.hw;
    const mates = Object.values(this.b).filter(o => o.team === b.team);
    const nearest = mates.sort((a, c) => Math.hypot(a.x - ball.x, a.z - ball.z) - Math.hypot(c.x - ball.x, c.z - ball.z))[0];
    if (nearest === b) {
      const gx = goalX - ball.x, gz = P.z - ball.z, gl = Math.hypot(gx, gz) || 1;
      const tx = ball.x - gx / gl * 0.7, tz = ball.z - gz / gl * 0.7;
      this.moveTo(b, tx, tz, 5.2, dt);
      b.cd -= dt;
      if (Math.hypot(ball.x - b.x, ball.z - b.z) < 1.0 && b.cd <= 0 && ball.y < P.h + 1.2) {
        b.cd = 0.5; const shoot = Math.abs(goalX - ball.x) < 18, sp = shoot ? 13 : 8;
        const aimZ = P.z + rand(-2.5, 2.5), ax = goalX - ball.x, az = aimZ - ball.z, al = Math.hypot(ax, az) || 1;
        Object.assign(ball, { vx: ax / al * sp + rand(-1, 1), vz: az / al * sp + rand(-1, 1), vy: shoot ? rand(1, 4) : 0.8 });
        this.app.net.emit('kick', { vx: ball.vx, vz: ball.vz, vy: ball.vy });
      }
    } else {
      const homeX = P.x - dir * 10 + (mates.indexOf(b) - 1) * dir * 6;
      this.moveTo(b, homeX * 0.5 + ball.x * 0.5, P.z + (ball.z - P.z) * 0.6 + (mates.indexOf(b) % 2 ? 6 : -6), 3.6, dt);
    }
    b.y = P.h;
  }

  _dodgeball(b, mg, dt) {
    const C = COURT, side = b.team === 'red' ? -1 : 1;
    if (b.frozen > 0) { b.frozen -= dt; return; }
    this.wander(b, dt, C.x, C.z + side * 5, 0, 5, 3.5, C.h);
    b.x = Math.max(C.x - C.hw + 0.6, Math.min(C.x + C.hw - 0.6, b.x));
    b.z = side < 0 ? Math.max(C.z - C.hd + 0.6, Math.min(C.z - 0.7, b.z)) : Math.max(C.z + 0.7, Math.min(C.z + C.hd - 0.6, b.z));
    b.cd -= dt;
    if (b.cd <= 0) {
      b.cd = rand(1.6, 3.2);
      const targets = this.targets(mg, id => mg.teams[id] && mg.teams[id] !== b.team);
      if (!targets.length) return;
      const t = pick(targets), dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz) || 1, sp = 18;
      const tt = d / sp, vy = 3 + 9 * tt * 0.5;
      this.app.net.emit('throw', { o: [b.x + dx / d, C.h + 1.4, b.z + dz / d], v: [dx / d * sp + rand(-1.5, 1.5), vy, dz / d * sp], team: b.team, bot: b.id });
    }
  }
  // positions of everyone (humans + bots) matching a filter
  targets(mg, filter) {
    const w = this.app.world, out = [];
    if (filter(this.app.me.pid)) out.push({ id: this.app.me.pid, ...w.me.group.position });
    for (const id in w.remotes) if (filter(id)) { const p = w.remotes[id].av.group.position; out.push({ id, x: p.x, y: p.y, z: p.z }); }
    return out;
  }

  _hide(b, mg, dt) {
    if (mg.seeker === b.id) {
      if (Date.now() < mg.start + 30000) return;
      const hiders = this.targets(mg, id => id !== b.id && mg.teams[id] && !mg.found[id]);
      const near = hiders.sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
      if (near && Math.hypot(near.x - b.x, near.z - b.z) < 9) { this.moveTo(b, near.x, near.z, 4.2, dt); if (Math.hypot(near.x - b.x, near.z - b.z) < 2.2 && !(b.sent ||= {})[near.id]) { b.sent[near.id] = 1; this.app.net.emit('found', { id: near.id, name: this.app.mg.nameOf(near.id), by: b.id }); } }
      else this.wander(b, dt, HUB.x, HUB.z, 5, 90, 3.4);
    } else this.moveTo(b, b.tx, b.tz, 3.4, dt);
  }

  _starhunt(b, mg, dt) {
    this.wander(b, dt, HUB.x, HUB.z, 5, 80, 3.2);
    b.cd -= dt; if (b.cd <= 0) { b.cd = rand(3, 7); b.sh = (b.sh || 0) + 1; }
  }

  _impostor(b, mg, dt) { this.mgs.impostor.botTick(b, mg, dt); }
  _quiz() {}
}
