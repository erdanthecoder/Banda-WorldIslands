// Crowds for Marbly games, drawn with the shared instanced bodies (cheap even with hundreds of people).
//  ring walkers: stroll round an oval (a lobby, a plaza) and stop at points of interest
//  seated: sit still and react (fans cheering, students listening)
import { Bodies, walkPose } from '../crowd.js';

const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));

export class People {
  // rings: [{ cx, cz, rx, rz, y, n, stops: [{ x, z, face }] }]; seats: [{ x, y, z, ry, kind }]
  constructor(world, { rings = [], seats = [], far = 120 }) {
    this.w = world; this.far = far; this.mode = ''; this.wave = false;
    this.p = []; let i = 0;
    for (const R of rings) for (let k = 0; k < R.n; k++) this.p.push({ i: i++, R, kind: 'walk', a: rnd(0, TAU), k: rnd(0.75, 1.05), ta: rnd(0, TAU), sp: rnd(0.9, 1.5), s: rnd(0.78, 1.05), phase: rnd(0, TAU), walk: 0, bag: Math.random() < 0.3, t: 0, ry: 0 });
    for (const S of seats) this.p.push({ i: i++, kind: S.kind || 'sit', s: S.s || rnd(0.78, 1.05), phase: rnd(0, TAU), walk: 0, x: S.x, y: S.y, z: S.z, ry: S.ry, bag: false, team: S.team });
    this.body = new Bodies(world, this.p.length);
    world.updaters.push(dt => this.update(dt));
  }
  pos(p) { const R = p.R; return [R.cx + Math.sin(p.a) * R.rx * p.k, R.cz + Math.cos(p.a) * R.rz * p.k]; }
  update(dt) {
    const w = this.w, cam = w.camera.position, me = w.me && w.me.group.position, now = performance.now() / 1000;
    for (const p of this.p) {
      let x, y, z, moving = false;
      if (p.kind === 'walk') {
        const R = p.R; y = R.y || 0;
        if (p.stop) {
          // walking to or standing at a stop (a desk, a screen, an ATM)
          [x, z] = [p.x, p.z];
          if (p.t > 0) { p.t -= dt; p.ry += wrap(p.stop.face - p.ry) * Math.min(1, dt * 4); if (p.t <= 0) { p.stop = null; const ux = (p.x - R.cx) / R.rx, uz = (p.z - R.cz) / R.rz; p.k = Math.min(1.1, Math.max(0.6, Math.hypot(ux, uz))); p.a = Math.atan2(ux, uz); p.ta = p.a + rnd(-2, 2); } }
          else { const dx = p.stop.x - p.x, dz = p.stop.z - p.z, d = Math.hypot(dx, dz); if (d < 0.1) p.t = rnd(4, 12); else { const st = Math.min(d, p.sp * dt); p.x += dx / d * st; p.z += dz / d * st; p.ry += wrap(Math.atan2(dx, dz) - p.ry) * Math.min(1, dt * 8); moving = true; } }
          x = p.x; z = p.z;
        } else {
          const [x0, z0] = this.pos(p), da = wrap(p.ta - p.a), step = p.sp * dt / Math.max(4, (R.rx + R.rz) / 2 * p.k);
          if (me && Math.hypot(me.x - x0, me.z - z0) < 0.9) moving = false;
          else if (Math.abs(da) < step) { p.a = p.ta; if (R.stops && R.stops.length && Math.random() < 0.45) { p.stop = pick(R.stops); p.stop = { x: p.stop.x + rnd(-1.2, 1.2), z: p.stop.z + rnd(-0.6, 0.6), face: p.stop.face }; p.x = x0; p.z = z0; p.t = 0; } else p.ta = p.a + rnd(-2.5, 2.5); }
          else { p.a += Math.sign(da) * step; moving = true; }
          [x, z] = this.pos(p);
          if (moving) { const ty = Math.atan2(x - x0, z - z0); p.ry += wrap(ty - p.ry) * Math.min(1, dt * 8); }
        }
        if (moving) p.walk += dt * p.sp * 5.2;
      } else { x = p.x; y = p.y; z = p.z; }
      if (Math.hypot(x - cam.x, z - cam.z) > this.far) { this.body.hide(p.i); continue; }
      if (this.mode === 'dance') { const sw = Math.sin(now * 5 + p.phase); this.body.pose(p.i, x, y, z, (p.ry || 0) + Math.sin(now * 2 + p.phase) * 0.6, { s: p.s, lift: Math.abs(Math.sin(now * 5 + p.phase)) * 0.15 + (p.kind === 'walk' ? 0 : 0.2), armL: -2.4 + sw, armR: -2.4 - sw, legL: sw * 0.3, legR: -sw * 0.3 }); continue; }
      if (p.kind === 'fan') {
        // cheering; a Mexican wave passes round the stands when this.wave is on
        const wv = this.wave ? Math.max(0, Math.sin(now * 2 - x * 0.08)) : 0, hype = (this.hype || 0) + (wv > 0.8 ? 1 : 0), clap = Math.sin(now * 9 + p.phase) * 0.25;
        if (hype > 0.5 || Math.sin(now * 0.7 + p.phase * 3) > 0.93) this.body.pose(p.i, x, y, z, p.ry, { s: p.s, lift: 0.25 + Math.abs(Math.sin(now * 8 + p.phase)) * 0.2, armL: -2.9, armR: -2.9 });
        else this.body.pose(p.i, x, y, z, p.ry, { s: p.s, drop: 0.24, armL: -0.9 + clap, armR: -0.9 - clap, legL: -1.5, legR: -1.5, look: Math.sin(now * 0.4 + p.phase) * 0.5 });
      } else if (p.kind === 'sit') this.body.pose(p.i, x, y, z, p.ry, { s: p.s, drop: 0.24, armL: -0.4, armR: -0.4 + (Math.sin(now * 0.6 + p.phase) > 0.85 ? -1.2 : 0), legL: -1.5, legR: -1.5, look: Math.sin(now * 0.5 + p.phase) * 0.35 });
      else if (p.kind === 'stand') this.body.pose(p.i, x, y, z, p.ry, walkPose(p, false, now, { look: Math.sin(now * 0.6 + p.phase) * 0.4, armR: Math.sin(now * 0.8 + p.phase) > 0.3 ? -0.6 + Math.sin(now * 6 + p.phase) * 0.35 : 0 }));
      else this.body.pose(p.i, x, y, z, p.ry, walkPose(p, moving, now, p.stop && p.t > 0 ? { look: Math.sin(now * 0.7 + p.phase) * 0.4 } : {}));
    }
    this.body.flush();
  }
}
