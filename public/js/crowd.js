// 👥 The Pentagon Mall crowd: well over a hundred shoppers walking between the shops, browsing at the counters,
// eating at the food court and coming in and out of the door. They are drawn with a handful of instanced meshes
// (one draw call per body part for everyone), so a big crowd stays cheap even on phones.
import * as THREE from 'three';
import { SKINS, HAIR_COLORS, CLOTH, PANTS } from './avatar.js';

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

export class Crowd {
  // mall: needs x, z, base, ring [rMin, rMax], fronts (shop angles in degrees + front radius), seats [{a, r, face}], doorR
  constructor(world, mall, n) {
    this.w = world; this.m = mall; this.n = n;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.65 });
    const part = (geo, count, m = mat) => { const im = new THREE.InstancedMesh(geo, m, count); im.frustumCulled = false; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); world.scene.add(im); return im; };
    this.torso = part(new THREE.BoxGeometry(2 * S, 2 * S, S), n);
    this.head = part(new THREE.CylinderGeometry(0.62 * S, 0.62 * S, 1.55 * S, 10), n);
    this.face = part(new THREE.PlaneGeometry(1.0 * S, 1.0 * S), n, new THREE.MeshBasicMaterial({ map: faceTex(), transparent: true, depthWrite: false }));
    this.hair = part(new THREE.BoxGeometry(1.3 * S, 0.42 * S, 1.32 * S), n);
    this.arms = part(new THREE.BoxGeometry(0.95 * S, 2 * S, 0.95 * S).translate(0, -S, 0), n * 2);
    this.legs = part(new THREE.BoxGeometry(0.95 * S, 2 * S, 0.95 * S).translate(0, -S, 0), n * 2);
    this.bags = part(new THREE.BoxGeometry(0.75 * S, 0.9 * S, 0.3 * S), n);
    const col = new THREE.Color(), set = (im, i, hex) => im.setColorAt(i, col.set(hex));
    this.p = [];
    for (let i = 0; i < n; i++) {
      const shirt = pick(CLOTH), skin = pick(SKINS.slice(0, 6));
      set(this.torso, i, shirt); set(this.head, i, skin); set(this.hair, i, pick(HAIR_COLORS));
      const sleeve = Math.random() < 0.5 ? skin : shirt; set(this.arms, i * 2, sleeve); set(this.arms, i * 2 + 1, sleeve);
      const pants = pick(PANTS); set(this.legs, i * 2, pants); set(this.legs, i * 2 + 1, pants);
      set(this.bags, i, pick(['#ff6fa8', '#ffd34d', '#3a86ff', '#2ec4b6', '#e71d36', '#ffffff', '#8a5a3b']));
      const p = { i, s: rnd(0.78, 1.05), sp: rnd(1.1, 1.7), bag: Math.random() < 0.55, phase: rnd(0, TAU), a: rnd(-Math.PI, Math.PI), r: rnd(mall.ring[0], mall.ring[1]), path: [], state: 'walk', t: 0, ry: 0, seat: null, walk: 0 };
      this.p.push(p);
      // start the day already busy: some sitting, some browsing, the rest walking somewhere
      const roll = Math.random();
      if (roll < 0.18) { const seat = this.freeSeat(); if (seat) { seat.by = p; p.seat = seat; p.a = seat.a; p.r = seat.r; p.state = 'sit'; p.t = rnd(5, 40); p.ry = seat.face; continue; } }
      if (roll < 0.5) { const f = pick(mall.fronts); p.a = f.a + rnd(-0.16, 0.16); p.r = f.r + rnd(-0.2, 2.2); p.state = 'browse'; p.t = rnd(2, 12); p.ry = p.a + Math.PI; continue; }
      this.choose(p);
    }
    for (const im of [this.torso, this.head, this.hair, this.arms, this.legs, this.bags]) im.instanceColor.needsUpdate = true;
    this.M = new THREE.Matrix4(); this.L = new THREE.Matrix4(); this.R = new THREE.Matrix4(); this.T = new THREE.Matrix4();
    this.q = new THREE.Quaternion(); this.v = new THREE.Vector3(); this.sc = new THREE.Vector3(); this.up = new THREE.Vector3(0, 1, 0); this.e = new THREE.Euler();
    this.zero = new THREE.Matrix4().makeScale(0, 0, 0);
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
    const vis = d < 170; for (const im of [this.torso, this.head, this.face, this.hair, this.arms, this.legs, this.bags]) im.visible = vis;
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
      p.walk = moving ? p.walk + dt * p.sp * 5.2 : p.walk;
      this.pose(p, moving, now);
    }
    for (const im of [this.torso, this.head, this.face, this.hair, this.arms, this.legs, this.bags]) im.instanceMatrix.needsUpdate = true;
  }
  arrive(p) {
    const n = p.next;
    if (n === 'browse') { p.state = 'browse'; p.t = rnd(3, 12); }
    else if (n === 'sit' && p.seat) { p.state = 'sit'; p.a = p.seat.a; p.r = p.seat.r; p.t = rnd(10, 35); }
    else if (n === 'door') { p.state = 'idle'; p.t = rnd(0.5, 2); p.bag = Math.random() < 0.6; } // a "new" shopper comes in
    else { p.state = 'idle'; p.t = rnd(1, 5); }
  }
  pose(p, moving, now) {
    const M = this.m, x = M.x + Math.sin(p.a) * p.r, z = M.z + Math.cos(p.a) * p.r, sit = p.state === 'sit', i = p.i;
    const swing = moving ? Math.sin(p.walk) * 0.7 : 0, bob = moving ? Math.abs(Math.cos(p.walk)) * 0.05 : Math.sin(now * 1.6 + p.phase) * 0.008;
    const B = this.M.compose(this.v.set(x, M.base + (sit ? -0.24 * p.s : bob), z), this.q.setFromAxisAngle(this.up, p.ry), this.sc.setScalar(p.s));
    const put = (im, idx, lx, ly, lz, rx = 0, ry = 0) => { this.L.makeRotationFromEuler(this.e.set(rx, ry, 0)).setPosition(lx, ly, lz); this.T.multiplyMatrices(B, this.L); im.setMatrixAt(idx, this.T); };
    put(this.torso, i, 0, 3 * S, 0);
    const look = p.state === 'browse' ? Math.sin(now * 0.7 + p.phase) * 0.4 : sit ? Math.sin(now * 0.5 + p.phase) * 0.3 : 0;
    put(this.head, i, 0, 4.62 * S, 0, 0, look);
    put(this.face, i, Math.sin(look) * 0.63 * S, 4.62 * S, Math.cos(look) * 0.63 * S, 0, look);
    put(this.hair, i, 0, 5.3 * S, -0.03, 0, look);
    // arms swing opposite to legs; a hand that carries a bag swings less; browsers sometimes point at the shelves
    const point = p.state === 'browse' && Math.sin(now * 0.9 + p.phase * 3) > 0.85;
    const armL = sit ? -0.5 : swing, armR = sit ? -0.5 : point ? -1.9 : p.bag ? -swing * 0.3 : -swing;
    put(this.arms, i * 2, -1.5 * S, 4 * S, 0, armL);
    put(this.arms, i * 2 + 1, 1.5 * S, 4 * S, 0, armR);
    put(this.legs, i * 2, -0.5 * S, 2 * S, 0, sit ? -1.5 : -swing);
    put(this.legs, i * 2 + 1, 0.5 * S, 2 * S, 0, sit ? -1.5 : swing);
    if (p.bag && !sit && !point) { const c = Math.cos(armR), s = Math.sin(armR); put(this.bags, i, 1.5 * S, 4 * S - c * 2.25 * S, -s * 2.25 * S, armR); }
    else this.bags.setMatrixAt(i, this.zero);
  }
}
