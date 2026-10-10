// 👥 Crowds: hundreds of island people drawn with a handful of instanced meshes (one draw call per body part for
// everyone), so a busy island stays cheap even on phones.
//  - MallCrowd: shoppers in the Pentagon Mall walk between the shops, browse, eat at the food court, come and go.
//  - StreetCrowd: people walk along every path and across the plaza, friends stand and chat, and football fans
//    fill the stadium stands (and do a Mexican wave!).
import * as THREE from 'three';
import { SKINS, HAIR_COLORS, CLOTH, PANTS } from './avatar.js';
import { PATHS, PLAZA_R, PITCH, PLAYGROUND, heightAt } from './world.js';

const S = 0.36, TAU = Math.PI * 2;
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];

function faceTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = '#1b1b1b'; g.beginPath(); g.arc(22, 26, 5, 0, TAU); g.arc(42, 26, 5, 0, TAU); g.fill();
  g.strokeStyle = '#1b1b1b'; g.lineWidth = 4; g.lineCap = 'round'; g.beginPath(); g.arc(32, 34, 13, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
let FACE = null;

// n blocky people as instanced body parts
export class Bodies {
  constructor(world, n) {
    this.n = n;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
    FACE = FACE || new THREE.MeshBasicMaterial({ map: faceTex(), transparent: true, depthWrite: false });
    const part = (geo, count, m = mat) => { const im = new THREE.InstancedMesh(geo, m, count); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); world.scene.add(im); return im; };
    this.torso = part(new THREE.BoxGeometry(2 * S, 2 * S, S), n);
    this.head = part(new THREE.CylinderGeometry(0.62 * S, 0.62 * S, 1.55 * S, 10), n);
    this.face = part(new THREE.PlaneGeometry(1.0 * S, 1.0 * S), n, FACE);
    this.hair = part(new THREE.BoxGeometry(1.3 * S, 0.42 * S, 1.32 * S), n);
    this.arms = part(new THREE.BoxGeometry(0.95 * S, 2 * S, 0.95 * S).translate(0, -S, 0), n * 2);
    this.legs = part(new THREE.BoxGeometry(0.95 * S, 2 * S, 0.95 * S).translate(0, -S, 0), n * 2);
    this.bags = part(new THREE.BoxGeometry(0.75 * S, 0.9 * S, 0.3 * S), n);
    this.all = [this.torso, this.head, this.face, this.hair, this.arms, this.legs, this.bags];
    const col = new THREE.Color(), set = (im, i, hex) => im.setColorAt(i, col.set(hex));
    for (let i = 0; i < n; i++) {
      const shirt = pick(CLOTH), skin = pick(SKINS.slice(0, 6));
      set(this.torso, i, shirt); set(this.head, i, skin); set(this.hair, i, pick(HAIR_COLORS));
      const sleeve = Math.random() < 0.5 ? skin : shirt; set(this.arms, i * 2, sleeve); set(this.arms, i * 2 + 1, sleeve);
      const pants = pick(PANTS); set(this.legs, i * 2, pants); set(this.legs, i * 2 + 1, pants);
      set(this.bags, i, pick(['#ff6fa8', '#ffd34d', '#3a86ff', '#2ec4b6', '#e71d36', '#ffffff', '#8a5a3b']));
    }
    for (const im of this.all) if (im.instanceColor) im.instanceColor.needsUpdate = true;
    this.B = new THREE.Matrix4(); this.L = new THREE.Matrix4(); this.T = new THREE.Matrix4();
    this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0); this.e = new THREE.Euler();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
  }
  // o: { s, look, armL, armR, legL, legR, bag, drop (sitting), lift (jumping) }
  pose(i, x, y, z, ry, o) {
    const B = this.B.compose(this.v.set(x, y - (o.drop || 0) * o.s + (o.lift || 0), z), o.tilt ? this.q.setFromEuler(this.e.set(o.tilt, ry, 0, 'YXZ')) : this.q.setFromAxisAngle(this.up, ry), this.sc.setScalar(o.s));
    this.e.order = 'XYZ';
    const put = (im, idx, lx, ly, lz, rx = 0, rY = 0, rz = 0) => { this.L.makeRotationFromEuler(this.e.set(rx, rY, rz)).setPosition(lx, ly, lz); this.T.multiplyMatrices(B, this.L); im.setMatrixAt(idx, this.T); };
    const look = o.look || 0;
    put(this.torso, i, 0, 3 * S, 0);
    put(this.head, i, 0, 4.62 * S, 0, 0, look);
    put(this.face, i, Math.sin(look) * 0.63 * S, 4.62 * S, Math.cos(look) * 0.63 * S, 0, look);
    put(this.hair, i, 0, 5.3 * S, -0.03, 0, look);
    put(this.arms, i * 2, -1.5 * S, 4 * S, 0, o.armL || 0, 0, o.armLz || 0);
    put(this.arms, i * 2 + 1, 1.5 * S, 4 * S, 0, o.armR || 0, 0, o.armRz || 0);
    put(this.legs, i * 2, -0.5 * S, 2 * S, 0, o.legL || 0);
    put(this.legs, i * 2 + 1, 0.5 * S, 2 * S, 0, o.legR || 0);
    if (o.bag) { const a = o.armR || 0; put(this.bags, i, 1.5 * S, 4 * S - Math.cos(a) * 2.25 * S, -Math.sin(a) * 2.25 * S, a); }
    else this.bags.setMatrixAt(i, this.zero);
  }
  hide(i) { for (const im of [this.torso, this.head, this.face, this.hair, this.bags]) im.setMatrixAt(i, this.zero); for (const im of [this.arms, this.legs]) { im.setMatrixAt(i * 2, this.zero); im.setMatrixAt(i * 2 + 1, this.zero); } }
  flush() { for (const im of this.all) im.instanceMatrix.needsUpdate = true; }
  visible(v) { for (const im of this.all) im.visible = v; }
}

// how a walking/standing person holds arms and legs
function walkPose(p, moving, now, extra = {}) {
  const swing = moving ? Math.sin(p.walk) * 0.7 : 0;
  return { s: p.s, armL: swing, armR: p.bag ? -swing * 0.3 : -swing, legL: -swing, legR: swing, bag: p.bag, lift: moving ? Math.abs(Math.cos(p.walk)) * 0.05 : Math.sin(now * 1.6 + p.phase) * 0.008, ...extra };
}

export class MallCrowd {
  // mall: needs x, z, base, ring [rMin, rMax], fronts (shop angles + front radius), seats [{a, r, face}], doorR
  constructor(world, mall, n) {
    this.w = world; this.m = mall; this.n = n; this.body = new Bodies(world, n);
    this.p = [];
    for (let i = 0; i < n; i++) {
      const p = { i, s: rnd(0.78, 1.05), sp: rnd(1.1, 1.7), bag: Math.random() < 0.55, phase: rnd(0, TAU), a: rnd(-Math.PI, Math.PI), r: rnd(mall.ring[0], mall.ring[1]), path: [], state: 'walk', t: 0, ry: 0, seat: null, walk: 0 };
      this.p.push(p);
      // start the day already busy: some sitting, some browsing, the rest walking somewhere
      const roll = Math.random();
      if (roll < 0.18) { const seat = this.freeSeat(); if (seat) { seat.by = p; p.seat = seat; p.a = seat.a; p.r = seat.r; p.state = 'sit'; p.t = rnd(5, 40); p.ry = seat.face; continue; } }
      if (roll < 0.5) { const f = pick(mall.fronts); p.a = f.a + rnd(-0.16, 0.16); p.r = f.r + rnd(-0.2, 2.2); p.state = 'browse'; p.t = rnd(2, 12); p.ry = p.a + Math.PI; continue; }
      this.choose(p);
    }
    this.acc = 0;
    world.updaters.push(dt => this.update(dt));
    this.update(0.016, true);
  }
  freeSeat() { const free = this.m.seats.filter(s => !s.by); return free.length ? pick(free) : null; }
  // plan a polar route that stays on the walking ring (around the food court, in front of the shops)
  go(p, a, r) {
    const [r0, r1] = this.m.ring, clamp = x => Math.min(r1, Math.max(r0, x)), path = [];
    if (Math.abs(clamp(p.r) - p.r) > 0.05) path.push([p.a, clamp(p.r)]);
    path.push([a, clamp(r)]);
    if (Math.abs(clamp(r) - r) > 0.05) path.push([a, r]);
    p.path = path; p.state = 'walk';
  }
  choose(p) {
    if (p.seat) { p.seat.by = null; p.seat = null; }
    const roll = Math.random(), M = this.m;
    if (roll < 0.45) { const f = pick(M.fronts); p.next = 'browse'; this.go(p, f.a + rnd(-0.16, 0.16), f.r + rnd(-0.2, 2.2)); }
    else if (roll < 0.62) { const seat = this.freeSeat(); if (seat) { seat.by = p; p.seat = seat; p.next = 'sit'; this.go(p, seat.a, seat.r); } else { p.next = 'stroll'; this.go(p, rnd(-Math.PI, Math.PI), rnd(M.ring[0], M.ring[1])); } }
    else if (roll < 0.72) { p.next = 'door'; this.go(p, rnd(-0.06, 0.06), M.doorR); }
    else { p.next = 'stroll'; this.go(p, p.a + rnd(-1.6, 1.6), rnd(M.ring[0], M.ring[1])); }
  }
  update(dt, force) {
    const w = this.w, M = this.m, me = w.me && w.me.group.position;
    // only animate when someone can see it; far away the crowd disappears entirely
    const cam = w.camera ? w.camera.position : me, d = cam ? Math.hypot(cam.x - M.x, cam.z - M.z) : 0;
    const vis = d < 170; this.body.visible(vis);
    if (!vis && !force) return;
    // farther away, update less often
    this.acc += dt; const every = d < 60 ? 0 : d < 110 ? 0.05 : 0.15; if (this.acc < every && !force) return; dt = Math.min(0.1, this.acc); this.acc = 0;
    const now = performance.now() / 1000;
    for (const p of this.p) {
      let moving = false;
      const x0 = M.x + Math.sin(p.a) * p.r, z0 = M.z + Math.cos(p.a) * p.r;
      if (p.state === 'walk') {
        const tgt = p.path[0];
        if (!tgt) { this.arrive(p); }
        else {
          const da = wrap(tgt[0] - p.a), dr = tgt[1] - p.r, rm = Math.max(p.r, 6), dist = Math.hypot(da * rm, dr), step = p.sp * dt;
          // politely stop for the player
          const blocked = me && Math.hypot(me.x - x0, me.z - z0) < 0.9 && Math.abs(me.y - M.base) < 2;
          if (blocked) { p.walk *= 0.9; }
          else if (dist <= step) { p.a = tgt[0]; p.r = tgt[1]; p.path.shift(); moving = true; }
          else { p.a += da * step / dist; p.r += dr * step / dist; moving = true; }
          if (moving) { const nx = M.x + Math.sin(p.a) * p.r, nz = M.z + Math.cos(p.a) * p.r; if (Math.abs(nx - x0) + Math.abs(nz - z0) > 1e-4) { const ty = Math.atan2(nx - x0, nz - z0); p.ry += wrap(ty - p.ry) * Math.min(1, dt * 8); } }
        }
      } else if ((p.t -= dt) <= 0) this.choose(p);
      else if (p.state === 'sit' && p.seat) p.ry += wrap(p.seat.face - p.ry) * Math.min(1, dt * 6);
      else if (p.state === 'browse') p.ry += wrap(p.a - p.ry) * Math.min(1, dt * 4);
      if (moving) p.walk += dt * p.sp * 5.2;
      const x = M.x + Math.sin(p.a) * p.r, z = M.z + Math.cos(p.a) * p.r;
      if (p.state === 'sit') this.body.pose(p.i, x, M.base, z, p.ry, { s: p.s, drop: 0.24, armL: -0.5, armR: -0.5, legL: -1.5, legR: -1.5, look: Math.sin(now * 0.5 + p.phase) * 0.3 });
      else {
        // browsers look around and sometimes point at the shelves
        const point = p.state === 'browse' && Math.sin(now * 0.9 + p.phase * 3) > 0.85;
        this.body.pose(p.i, x, M.base, z, p.ry, walkPose(p, moving, now, point ? { armR: -1.9, bag: false, look: Math.sin(now * 0.7 + p.phase) * 0.4 } : p.state === 'browse' ? { look: Math.sin(now * 0.7 + p.phase) * 0.4 } : {}));
      }
    }
    this.body.flush();
  }
  arrive(p) {
    const n = p.next;
    if (n === 'browse') { p.state = 'browse'; p.t = rnd(3, 12); }
    else if (n === 'sit' && p.seat) { p.state = 'sit'; p.a = p.seat.a; p.r = p.seat.r; p.t = rnd(10, 35); }
    else if (n === 'door') { p.state = 'idle'; p.t = rnd(0.5, 2); p.bag = Math.random() < 0.6; } // a "new" shopper comes in
    else { p.state = 'idle'; p.t = rnd(1, 5); }
  }
}

// ---------- the island outside ----------
// a walking network: points along the middle of every path and a ring round the plaza fountain
function network() {
  const nodes = [], link = (a, b) => { if (a !== b && !a.n.includes(b)) { a.n.push(b); b.n.push(a); } };
  const node = (x, z, g) => { const o = { x, z, g, n: [], y: heightAt(x, z) }; nodes.push(o); return o; };
  const ring = [];
  for (let k = 0; k < 16; k++) { const a = k / 16 * TAU, r = PLAZA_R - 7; ring.push(node(Math.sin(a) * r, Math.cos(a) * r, 'plaza')); }
  ring.forEach((o, k) => link(o, ring[(k + 1) % 16]));
  for (const P of PATHS) {
    const along = P.x1 - P.x0 > P.z1 - P.z0, len = along ? P.x1 - P.x0 : P.z1 - P.z0, n = Math.max(1, Math.round(len / 6)), cx = (P.x0 + P.x1) / 2, cz = (P.z0 + P.z1) / 2;
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const f = k / n, x = along ? P.x0 + 1.2 + (len - 2.4) * f : cx, z = along ? cz : P.z0 + 1.2 + (len - 2.4) * f;
      if (Math.hypot(x, z) < PLAZA_R - 2) continue; // the plaza ring takes over inside
      const o = node(x, z, P.id); if (prev) link(prev, o); prev = o;
    }
  }
  // junctions: join nodes of different paths (and the plaza) that are close together
  for (const a of nodes) for (const b of nodes) if (a.g !== b.g && Math.hypot(a.x - b.x, a.z - b.z) < 8.5) link(a, b);
  return nodes;
}
// the shortest hop route on the network (breadth-first)
function route(from, to) {
  const prev = new Map([[from, null]]), q = [from];
  while (q.length) { const c = q.shift(); if (c === to) break; for (const n of c.n) if (!prev.has(n)) { prev.set(n, c); q.push(n); } }
  if (!prev.has(to)) return [];
  const out = []; for (let c = to; c; c = prev.get(c)) out.unshift(c); return out;
}

export class StreetCrowd {
  constructor(world, { walkers, chatters, fans }) {
    this.w = world; this.nodes = network();
    const main = this.nodes.filter(n => n.n.length); // only connected nodes
    const n = walkers + chatters + fans; this.body = new Bodies(world, n); this.p = [];
    let i = 0;
    for (let k = 0; k < walkers; k++) {
      const at = pick(main), p = { i: i++, kind: 'walk', s: rnd(0.75, 1.05), sp: rnd(1.0, 1.6), bag: Math.random() < 0.3, phase: rnd(0, TAU), walk: 0, ox: rnd(-1.3, 1.3), oz: rnd(-1.3, 1.3), at, x: at.x, z: at.z, y: at.y, ry: rnd(0, TAU), path: [], t: rnd(0, 3) };
      this.p.push(p);
    }
    // friends chatting in little circles round the plaza, by the playground and outside the shops
    const spots = [[-14, 16], [15, -15], [16, 14], [-17, -12], [PLAYGROUND.x - 22, PLAYGROUND.z + 4], [-30, 14], [24, -30], [-30, -30], [6, 30], [-6, 48]];
    for (let k = 0; k < chatters;) {
      const [sx, sz] = spots[(k / 4 | 0) % spots.length], g = Math.min(chatters - k, 3 + (Math.random() * 3 | 0)), cx = sx + rnd(-2, 2), cz = sz + rnd(-2, 2);
      for (let j = 0; j < g; j++, k++) {
        const a = j / g * TAU + rnd(-0.2, 0.2), x = cx + Math.sin(a) * 0.95, z = cz + Math.cos(a) * 0.95;
        this.p.push({ i: i++, kind: 'chat', s: rnd(0.75, 1.05), bag: Math.random() < 0.25, phase: rnd(0, TAU), walk: 0, x, z, y: heightAt(x, z), ry: Math.atan2(cx - x, cz - z) });
      }
    }
    // football fans on the stadium stands (seat rows on both long sides)
    const P = PITCH;
    for (let k = 0; k < fans; k++) {
      const sz = Math.random() < 0.5 ? -1 : 1, row = Math.floor(Math.random() * 7), x = P.x + rnd(-P.hw - 1, P.hw + 1), z = P.z + sz * (P.hd + 4 + row * 0.9);
      const s = rnd(0.75, 1.05);
      this.p.push({ i: i++, kind: 'fan', s, phase: rnd(0, TAU), walk: 0, x, z, y: P.h + 0.75 + row * 1.2 - 0.48 * s, ry: sz < 0 ? 0 : Math.PI, bag: false, team: x < P.x ? 0 : 1 });
    }
    this.acc = 0; this.k = 0;
    world.updaters.push(dt => this.update(dt));
    this.update(0.016, true);
  }
  next(p) {
    const to = pick(this.nodes.filter(n => n.n.length && n !== p.at));
    p.path = route(p.at, to).slice(1); p.t = 0;
  }
  update(dt, force) {
    const w = this.w, me = w.me && w.me.group.position, cam = w.camera ? w.camera.position : me;
    if (!cam) return;
    this.acc += dt; if (this.acc < 0.016 && !force) return; dt = Math.min(0.1, this.acc); this.acc = 0;
    const now = performance.now() / 1000, far = w.hq ? 120 : 85;
    for (const p of this.p) {
      let moving = false;
      if (p.kind === 'walk') {
        if (!p.path.length) { if ((p.t -= dt) <= 0) this.next(p); }
        else {
          const tg = p.path[0], tx = tg.x + p.ox, tz = tg.z + p.oz, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz), step = p.sp * dt;
          const blocked = me && Math.hypot(me.x - p.x, me.z - p.z) < 0.9 && Math.abs(me.y - p.y) < 2;
          if (!blocked) {
            moving = true;
            if (d <= step) { p.x = tx; p.z = tz; p.at = tg; p.path.shift(); if (!p.path.length) p.t = Math.random() < 0.3 ? rnd(3, 10) : rnd(0, 1); }
            else { p.x += dx / d * step; p.z += dz / d * step; p.y += ((tg.y) - p.y) * Math.min(1, dt * 2); p.ry += wrap(Math.atan2(dx, dz) - p.ry) * Math.min(1, dt * 8); }
          }
          if (moving) p.walk += dt * p.sp * 5.2;
        }
      }
      const dist = Math.hypot(p.x - cam.x, p.z - cam.z);
      if (dist > far) { this.body.hide(p.i); continue; }
      if (p.kind === 'fan') {
        // a Mexican wave travels round the stands; fans jump with arms up as it passes
        const wave = Math.max(0, Math.sin(now * 1.4 - p.x * 0.12 + (p.z > PITCH.z ? Math.PI : 0)));
        const hype = wave > 0.85 ? (wave - 0.85) / 0.15 : 0, clap = Math.sin(now * 9 + p.phase) * 0.25;
        this.body.pose(p.i, p.x, p.y, p.z, p.ry, hype > 0.05
          ? { s: p.s, drop: 0.24 * (1 - hype), lift: hype * 0.35, armL: -2.9 * hype, armR: -2.9 * hype, legL: -1.5 * (1 - hype), legR: -1.5 * (1 - hype) }
          : { s: p.s, drop: 0.24, armL: -0.9 + clap, armR: -0.9 - clap, legL: -1.5, legR: -1.5, look: Math.sin(now * 0.4 + p.phase) * 0.5 });
      } else if (p.kind === 'chat') {
        // talking with hands, nodding, now and then a big laugh
        const talk = Math.sin(now * 0.8 + p.phase) > 0.4, laugh = Math.sin(now * 0.3 + p.phase * 2) > 0.97;
        this.body.pose(p.i, p.x, p.y, p.z, p.ry, walkPose(p, false, now, { look: Math.sin(now * 0.6 + p.phase) * 0.35, armR: talk ? -0.6 + Math.sin(now * 6 + p.phase) * 0.35 : 0, armL: laugh ? -2.6 : 0, lift: laugh ? Math.abs(Math.sin(now * 12)) * 0.08 : 0 }));
      } else this.body.pose(p.i, p.x, p.y, p.z, p.ry, walkPose(p, moving, now, moving ? {} : { look: Math.sin(now * 0.7 + p.phase) * 0.5 }));
    }
    this.body.flush();
  }
}

// a few people placed by hand (hotel lobby, pool, ...): they sit, chat, lie in the sun or swim
export class Guests {
  constructor(world, list, { near = 70 } = {}) {
    this.w = world; this.list = list.map((g, i) => ({ i, s: rnd(0.8, 1.05), phase: rnd(0, TAU), walk: 0, bag: false, ...g }));
    this.body = new Bodies(world, list.length); this.near = near;
    world.updaters.push(() => this.update());
  }
  update() {
    const w = this.w, cam = w.camera && w.camera.position; if (!cam) return;
    const now = performance.now() / 1000; let any = false;
    for (const g of this.list) {
      if (Math.hypot(g.x - cam.x, g.z - cam.z) > this.near || Math.abs(g.y - cam.y) > 14) { this.body.hide(g.i); continue; }
      any = true; const sw = Math.sin(now * 2 + g.phase);
      if (g.kind === 'sit') this.body.pose(g.i, g.x, g.y, g.z, g.ry, { s: g.s, drop: 0.24, armL: -0.5, armR: -0.5 + (Math.sin(now * 0.7 + g.phase) > 0.7 ? -0.9 : 0), legL: -1.5, legR: -1.5, look: Math.sin(now * 0.5 + g.phase) * 0.4 });
      else if (g.kind === 'lie') this.body.pose(g.i, g.x, g.y, g.z, g.ry, { s: g.s, tilt: -Math.PI / 2, lift: 0.25, armL: -2.9, armR: -2.9, look: 0 });
      else if (g.kind === 'swim') this.body.pose(g.i, g.x + Math.sin(now * 0.3 + g.phase) * 1.5, g.y, g.z + Math.cos(now * 0.25 + g.phase) * 1.2, g.ry + now * 0.2, { s: g.s, tilt: 1.2, armL: -2.4 + sw, armR: -2.4 - sw, legL: sw * 0.4, legR: -sw * 0.4 });
      else if (g.kind === 'dance') this.body.pose(g.i, g.x, g.y, g.z, g.ry + Math.sin(now * 2 + g.phase) * 0.5, { s: g.s, lift: Math.abs(Math.sin(now * 5 + g.phase)) * 0.15, armL: -2.4 + sw, armR: -2.4 - sw, legL: sw * 0.3, legR: -sw * 0.3 });
      else { const talk = Math.sin(now * 0.8 + g.phase) > 0.3; this.body.pose(g.i, g.x, g.y, g.z, g.ry, walkPose(g, false, now, { look: Math.sin(now * 0.6 + g.phase) * 0.35, armR: talk ? -0.6 + Math.sin(now * 6 + g.phase) * 0.35 : 0 })); }
    }
    this.body.visible(any); this.body.flush();
  }
}
