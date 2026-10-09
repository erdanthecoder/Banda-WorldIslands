// Walk-in buildings: Banda Tower (8 floors, glass elevators) and the supermarket.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TEX, canvasTex, labelSprite, TOWER, MARKET, BANK } from './world.js';
import { Avatar } from './avatar.js';
import { CinemaShow } from './cinema.js';

const glassMat = () => new THREE.MeshStandardMaterial({ color: 0x9cc3d6, metalness: 0.9, roughness: 0.04, transparent: true, opacity: 0.26, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

// A rectangular, axis-aligned building with floors you can walk on.
export class Building {
  constructor(world, { x, z, w, d, floors = 1, fh = 5, base, door, round = 0 }) {
    Object.assign(this, { world, x, z, w, d, floors, fh, base, door, round });
    this.minX = x - w / 2; this.maxX = x + w / 2; this.minZ = z - d / 2; this.maxZ = z + d / 2;
    this.walls = Array.from({ length: floors }, () => []);
    this.floorFns = Array.from({ length: floors }, () => null);
    this.dynamicWalls = [];
    this.lights = [];
    world.buildings.push(this);
    this.outerWalls();
  }
  outerWalls() {
    if (this.round) {
      // a round building: a ring of posts outside (with a gap for the door); inside, you're kept within the circle
      const R = this.round + 0.15, gap = Math.asin(Math.min(1, (this.door.width / 2) / R));
      for (let i = 0; i < 160; i++) { const a = i / 160 * Math.PI * 2, rel = Math.atan2(Math.sin(a), Math.cos(a)); if (Math.abs(rel) < gap) continue; this.world.solids.push({ x: this.x + Math.sin(a) * R, z: this.z + Math.cos(a) * R, r: 0.55, y0: this.base - 2, y1: this.base + 3 }); }
      return;
    }
    const { x, z, w, d, minX, maxX, minZ, maxZ, door } = this, t = 0.15;
    const sides = { n: [x, minZ + t, w / 2, t], s: [x, maxZ - t, w / 2, t], w: [minX + t, z, t, d / 2], e: [maxX - t, z, t, d / 2] };
    for (const k in sides) {
      const [cx, cz, hw, hd] = sides[k];
      for (let lv = 0; lv < this.floors; lv++) {
        if (lv === 0 && door && door.side === k) {
          const along = hw > hd, c = along ? cx : cz, half = along ? hw : hd, a = door.at - door.width / 2, b = door.at + door.width / 2;
          const segs = [[c - half, a], [b, c + half]];
          for (const [s0, s1] of segs) { const m = (s0 + s1) / 2, hl = (s1 - s0) / 2; const r = along ? { x: m, z: cz, hw: hl, hd } : { x: cx, z: m, hw, hd: hl }; this.walls[0].push(r); this.world.solids.push({ ...r, rot: 0 }); }
        } else {
          const r = { x: cx, z: cz, hw, hd }; this.walls[lv].push(r);
          if (lv === 0) this.world.solids.push({ ...r, rot: 0 });
        }
      }
    }
  }
  contains(px, pz) { return this.round ? Math.hypot(px - this.x, pz - this.z) < this.round : px > this.minX && px < this.maxX && pz > this.minZ && pz < this.maxZ; }
  levelAt(y) { return Math.max(0, Math.min(this.floors - 1, Math.floor((y - this.base + 1.2) / this.fh))); }
  floorY(lv) { return this.base + lv * this.fh; }
  interior(px, py, pz) {
    if (!this.contains(px, pz) || py < this.base - 3 || py > this.base + this.floors * this.fh + 2) return null;
    const lv = this.levelAt(py), fy = this.floorY(lv), fn = this.floorFns[lv];
    return { floor: fy, floorAt: fn ? (ax, az) => fn(ax, az) ?? fy : null, ceil: this.fh - 0.4, walls: this.walls[lv].concat(this.dynamicWalls.filter(w => w.lv === lv && w.on())), noClamp: true,
      minX: this.round ? this.x - this.round : this.minX, maxX: this.round ? this.x + this.round : this.maxX, minZ: this.round ? this.z - this.round : this.minZ, maxZ: this.round ? this.z + this.round : this.maxZ,
      round: this.round ? { x: this.x, z: this.z, r: this.round - 0.45, door: lv === 0 ? this.door.width / 2 : 0 } : null, level: lv, building: this };
  }
  // furniture that blocks walking on one floor
  block(lv, cx, cz, hw, hd) { this.walls[lv].push({ x: cx, z: cz, hw, hd }); }
  add(mesh, cast = true) { mesh.castShadow = cast; mesh.receiveShadow = true; this.world.scene.add(mesh); return mesh; }
  box(lv, cx, y, cz, w, h, d, mat, solid = false, round = 0) {
    const g = round ? new RoundedBox(w, h, d, 2, round) : new THREE.BoxGeometry(w, h, d);
    const m = this.add(new THREE.Mesh(g, mat.isMaterial ? mat : std(mat))); m.position.set(cx, this.floorY(lv) + y, cz);
    if (solid) this.block(lv, cx, cz, w / 2, d / 2);
    return m;
  }
  // a walk-up spot: glowing pedestal + label; fires once when you step on it
  spot(lv, cx, cz, label, color, onEnter, { r = 1.1, pedestal = true } = {}) {
    const y = this.floorY(lv);
    if (pedestal) {
      const ped = this.add(new THREE.Mesh(new RoundedBox(0.9, 1.1, 0.6, 2, 0.08), std(0x22262c, { metalness: 0.6, roughness: 0.3 }))); ped.position.set(cx, y + 0.55, cz - 0.9);
      const scr = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.55, 0.05), std(0x060a10, { emissive: color, emissiveIntensity: 1.3 })), false); scr.position.set(cx, y + 1.35, cz - 0.75); scr.rotation.x = -0.4;
      this.block(lv, cx, cz - 0.9, 0.45, 0.3);
    }
    const ring = this.add(new THREE.Mesh(new THREE.RingGeometry(r * 0.75, r, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.8 })), false); ring.position.set(cx, y + 0.03, cz);
    const lab = labelSprite(label, 0.4); lab.position.set(cx, y + 2.1, cz - 0.9); this.world.scene.add(lab);
    this.world.zone({ test: (px, py, pz) => Math.hypot(px - cx, pz - cz) < r && Math.abs(py - y) < 1.2, onEnter });
    return { lab, ring, x: cx, z: cz, y };
  }
}

// ---------------- Elevator ----------------
class Elevator {
  constructor(b, cx, cz, onPanel) {
    Object.assign(this, { b, cx, cz, onPanel });
    this.level = 0; this.y = b.floorY(0); this.target = 0; this.state = 'idle'; this.open = 1; this.speed = 7; this.btns = []; this.q = []; this.dwell = 0; this.i = b.elevCount = (b.elevCount ?? -1) + 1;
    const S = b.world.scene, g = this.cab = new THREE.Group();
    const steel = std(0xb8bec6, { metalness: 0.9, roughness: 0.25 });
    const floor = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 3), std(0x2a2e34, { metalness: 0.5 })); floor.position.y = 0.06;
    const ceil = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 3), steel); ceil.position.y = 3.0;
    const light = new THREE.Mesh(new THREE.BoxGeometry(2, 0.04, 2), std(0xffffff, { emissive: 0xfff6e8, emissiveIntensity: 2.2 })); light.position.y = 2.92;
    const back = new THREE.Mesh(new THREE.BoxGeometry(3, 2.9, 0.06), glassMat()); back.position.set(0, 1.5, -1.47);
    const s1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.9, 3), steel); s1.position.set(-1.47, 1.5, 0);
    const s2 = s1.clone(); s2.position.x = 1.47;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.05, 0.05), steel); rail.position.set(0, 1.0, -1.38);
    this.panelLED = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.5, 0.03), std(0x0a0f14, { emissive: 0x3ac3ff, emissiveIntensity: 1.5 })); this.panelLED.position.set(1.42, 1.4, 0.9); this.panelLED.rotation.y = -Math.PI / 2;
    g.add(floor, ceil, light, back, s1, s2, rail, this.panelLED);
    g.traverse(o => { if (o.isMesh) { o.receiveShadow = true; } });
    g.position.set(cx, this.y, cz); S.add(g);
    // cables
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, b.floors * b.fh + 4, 6), steel); cable.position.set(cx, b.base + (b.floors * b.fh) / 2, cz); S.add(cable);
    // landing doors on every floor + the walls that keep you out of an empty shaft
    this.doors = [];
    for (let lv = 0; lv < b.floors; lv++) {
      const y = b.floorY(lv), L = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.9, 0.08), steel), R = L.clone();
      L.position.set(cx - 0.75, y + 1.45, cz + 1.62); R.position.set(cx + 0.75, y + 1.45, cz + 1.62);
      S.add(L, R); this.doors.push({ L, R, lv });
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 0.06), std(0x1c1f24, { metalness: 0.7 })); plate.position.set(cx + 2.05, y + 1.25, cz + 1.72); S.add(plate);
      const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.05, 20).rotateX(Math.PI / 2), std(0xdddddd, { emissive: 0x3ac3ff, emissiveIntensity: 0.2 })); btn.position.set(cx + 2.05, y + 1.25, cz + 1.77); S.add(btn); this.btns[lv] = btn;
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 0.2), std(0x1c1f24, { metalness: 0.6 })); frame.position.set(cx, y + 3.05, cz + 1.66); S.add(frame);
      const ind = labelSprite(String(lv + 1), 0.32, { bg: 'rgba(10,14,20,0.85)', color: '#5fd0ff' }); ind.position.set(cx, y + 3.45, cz + 1.7); S.add(ind);
      b.dynamicWalls.push({ lv, x: cx, z: cz + 1.62, hw: 1.6, hd: 0.12, on: () => !(this.level === lv && this.state === 'idle' && this.open > 0.6) });
      // call: walking up to closed doors calls the cab to this floor
      b.world.zone({ test: (px, py, pz) => Math.abs(px - cx) < 1.6 && pz > cz + 1.7 && pz < cz + 3.4 && Math.abs(py - y) < 1.2,
        onEnter: () => { if (this.level !== lv || this.state !== 'idle') { this.go(lv); b.world.onElevatorCall && b.world.onElevatorCall(); } } });
    }
    // stepping into the open cab shows the floor buttons
    b.world.zone({ test: (px, py, pz) => Math.abs(px - cx) < 1.3 && pz < cz + 1.2 && pz > cz - 1.4 && Math.abs(py - this.y) < 1.4, onEnter: () => { if (this.state === 'idle' && !b.world.carrier) this.onPanel(this); } });
    // runs every frame; a slow timer keeps it going when the tab is in the background
    b.world.updaters.push(dt => { this.lastTick = performance.now(); this.update(dt); });
    setInterval(() => { const now = performance.now(); if (now - (this.lastTick || 0) > 300) { this.update(Math.min(1, (now - (this.lastTick || now)) / 1000)); this.lastTick = now; } }, 250);
  }
  contains(p) { return Math.abs(p.x - this.cx) < 1.45 && Math.abs(p.z - this.cz) < 1.45 && Math.abs(p.y - this.y) < 1.2; }
  // Everyone shares the same elevators: one player (the host) runs them and the others send requests.
  go(lv) {
    const w = this.b.world;
    if (w.elevAuthority && !w.elevAuthority()) { w.elevRequest && w.elevRequest(this.i, lv); return; }
    this.enqueue(lv);
  }
  enqueue(lv) {
    if (lv === this.level && (this.state === 'idle' || this.state === 'opening')) { this.dwell = Math.max(this.dwell, 2.5); return; }
    if (this.target === lv && (this.state === 'closing' || this.state === 'moving')) return;
    if (!this.q.includes(lv)) this.q.push(lv);
  }
  // state from the host
  applyNet(s) {
    const was = this.state;
    if (Math.abs(s.y - this.y) > 0.3) this.y = s.y; else this.y += (s.y - this.y) * 0.5;
    this.level = s.l; this.target = s.t; this.state = s.s; this.q = s.q || []; this.dwell = s.d;
    if (Math.abs(s.o - this.open) > 0.15) this.open = s.o;
    if (was === 'moving' && s.s !== 'moving') this.ding();
  }
  snap() { return { y: +this.y.toFixed(3), l: this.level, t: this.target, s: this.state, o: +this.open.toFixed(2), q: this.q, d: +this.dwell.toFixed(2) }; }
  ding() { const now = performance.now(); if (now - (this.dingAt || 0) < 1500) return; this.dingAt = now; const p = this.b.world.me?.group.position; if (p && this.b.contains(p.x, p.z)) this.b.world.onElevatorDing && this.b.world.onElevatorDing(); }
  // ride with the player inside
  ride(lv, onArrive) {
    const w = this.b.world;
    this.go(lv);
    let out = 0, ask = 0;
    w.carrier = { elev: this, update: (dt, p, me) => {
      const here = this.state === 'idle' && this.open > 0.9;
      // doors open on your floor (or you jump to get off early): walk out onto the landing
      if (here && (this.level === lv || out > 0 || (w.keys.Space || w.joyJump))) {
        out += dt; p.y = this.y; me.group.rotation.y = 0;
        const tz = this.cz + 3; p.x += (this.cx - p.x) * Math.min(1, dt * 4); p.z = Math.min(tz, p.z + dt * 4); me.animate(4, dt, false);
        return p.z >= tz - 0.01 || out > 1.5;
      }
      // ask again now and then in case a request got lost
      if ((ask += dt) > 3) { ask = 0; if (this.level !== lv && this.target !== lv && !this.q.includes(lv)) this.go(lv); }
      p.y = this.y; p.x = Math.max(this.cx - 1.1, Math.min(this.cx + 1.1, p.x)); p.z = Math.max(this.cz - 1.1, Math.min(this.cz + 1.0, p.z)); me.animate(0, dt, false); return false;
    }, onEnd: onArrive };
  }
  update(dt) {
    const host = !this.b.world.elevAuthority || this.b.world.elevAuthority();
    if (this.state === 'idle') {
      this.dwell = Math.max(0, this.dwell - dt);
      // only the host decides where to go next; others follow its updates
      if (host && this.dwell <= 0 && this.q.length) { const n = this.q.shift(); if (n === this.level) this.dwell = 2.5; else { this.target = n; this.state = 'closing'; } }
    } else if (this.state === 'closing') { this.open = Math.max(0, this.open - dt * 2.2); if (this.open === 0) this.state = 'moving'; }
    else if (this.state === 'moving') {
      const ty = this.b.floorY(this.target), d = ty - this.y, step = Math.sign(d) * Math.min(Math.abs(d), this.speed * dt * Math.min(1, 0.4 + Math.abs(d) / 3));
      this.y += step; this.level = this.b.levelAt(this.y + 0.01);
      if (Math.abs(ty - this.y) < 0.005) { this.y = ty; this.level = this.target; this.state = 'opening'; this.ding(); }
    } else if (this.state === 'opening') { this.open = Math.min(1, this.open + dt * 2.2); if (this.open === 1) { this.state = 'idle'; this.dwell = 2.5; } }
    this.cab.position.y = this.y;
    this.btns.forEach((bt, lv) => { bt.material.emissiveIntensity = (this.target === lv && this.state !== 'idle') || this.q.includes(lv) ? 2.5 : 0.2; });
    for (const d of this.doors) { const o = d.lv === this.level && this.state !== 'moving' ? this.open : 0; d.L.position.x = this.cx - 0.75 - o * 1.4; d.R.position.x = this.cx + 0.75 + o * 1.4; }
  }
}

// ---------------- Banda Tower ----------------
export const FLOORS = ['f_lobby', 'f_pool', 'f_lab', 'f_hotel', 'f_spa', 'f_cinema', 'f_arcade', 'f_games'];

export class Tower extends Building {
  constructor(world, h) {
    const T = TOWER;
    super(world, { x: T.x, z: T.z, w: T.w, d: T.d, floors: T.floors, fh: T.fh, base: T.base, door: { side: 's', at: T.x, width: 6.4 }, round: T.R });
    this.h = h; // hooks from main: { station(lv, kind, x, z), pad(lv, type, x, z), panel(elev), t }
    this.shell(); this.slabs();
    this.elevators = [new Elevator(this, T.x - 5, this.minZ + 1.9, e => h.panel(e)), new Elevator(this, T.x + 5, this.minZ + 1.9, e => h.panel(e))];
    for (const ex of [-5, 5]) for (let lv = 0; lv < this.floors; lv++) { this.block(lv, T.x + ex - 1.72, this.minZ + 1.9, 0.1, 1.8); this.block(lv, T.x + ex + 1.72, this.minZ + 1.9, 0.1, 1.8); this.block(lv, T.x + ex, this.minZ + 0.05, 1.8, 0.15); }
    [this.lobby, this.pool, this.lab, this.hotel, this.spa, this.cinema, this.arcade, this.games].forEach((f, lv) => { f.call(this, lv); this.floorSign(lv); });
    // interior lights follow the floor you're on
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xfff1dc, 0, 28, 1.5); world.scene.add(l); this.lights.push(l); }
  }
  // a round glass tower: floor rings, twin LED helixes, a crown with the name and a floating halo
  shell() {
    const { x, z, base, fh, floors } = this, R = this.round, H = floors * fh, S = this.world.scene, top = base + H;
    const glass = glassMat(); glass.opacity = 0.22; glass.color.set(0x8fd3ff);
    const gap = Math.asin((this.door.width / 2 + 0.4) / R);
    const ground = new THREE.Mesh(new THREE.CylinderGeometry(R, R, fh, 120, 1, true, gap, Math.PI * 2 - gap * 2), glass); ground.position.set(x, base + fh / 2, z); ground.renderOrder = 2; S.add(ground);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(R, R, H - fh, 120, 1, true), glass); upper.position.set(x, base + fh + (H - fh) / 2, z); upper.renderOrder = 2; S.add(upper);
    const white = std(0xf4f6f8, { roughness: 0.25, metalness: 0.3 }), dark = std(0x1a1f27, { metalness: 0.85, roughness: 0.25 });
    // floor rings: a white edge with a thin cyan light line
    for (let lv = 1; lv <= floors; lv++) {
      const y = base + lv * fh;
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.9, R + 0.9, 0.55, 120, 1, true), white); ring.position.set(x, y - 0.1, z); S.add(ring);
      const lid = new THREE.Mesh(new THREE.RingGeometry(R - 0.05, R + 0.9, 120).rotateX(-Math.PI / 2), white); lid.position.set(x, y + 0.18, z); S.add(lid);
      const under = lid.clone(); under.rotation.x = Math.PI; under.position.y = y - 0.38; S.add(under);
      const led = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.92, R + 0.92, 0.06, 120, 1, true), std(0x5fd0ff, { emissive: 0x36c2ff, emissiveIntensity: 2.2 })); led.position.set(x, y - 0.32, z); S.add(led);
    }
    // slim vertical fins
    const finG = new THREE.BoxGeometry(0.12, H, 0.5);
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < gap + 0.05) continue; const f = new THREE.Mesh(finG, dark); f.position.set(x + Math.sin(a) * (R + 0.25), base + H / 2, z + Math.cos(a) * (R + 0.25)); f.rotation.y = a; S.add(f); }
    // two glowing helixes wrapping the tower
    for (const [col, ph] of [[0x36c2ff, 0], [0xff4fd8, Math.PI]]) {
      const pts = []; for (let i = 0; i <= 200; i++) { const k = i / 200, a = ph + k * Math.PI * 4; pts.push(new THREE.Vector3(x + Math.sin(a) * (R + 0.6), base + fh + k * (H - fh), z + Math.cos(a) * (R + 0.6))); }
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 400, 0.09, 8), std(col, { emissive: col, emissiveIntensity: 2.6 })); S.add(tube);
    }
    // crown: a tapered band with the name all around, a halo ring and a spire
    const nameT = canvasTex(2048, 128, (g, W, Hh) => { g.fillStyle = '#0d1420'; g.fillRect(0, 0, W, Hh); g.font = '800 84px Manrope, system-ui'; g.textBaseline = 'middle'; g.shadowColor = '#36c2ff'; g.shadowBlur = 24; g.fillStyle = '#e9f8ff'; for (let i = 0; i < 3; i++) g.fillText('BANDA TOWER  ✦', i * W / 3 + 30, Hh / 2 + 4); });
    const crown = new THREE.Mesh(new THREE.CylinderGeometry(R - 3, R + 0.9, 3.4, 120, 1, true), new THREE.MeshStandardMaterial({ map: nameT, emissive: 0xffffff, emissiveMap: nameT, emissiveIntensity: 0.9, side: THREE.DoubleSide, metalness: 0.5, roughness: 0.3 }));
    crown.position.set(x, top + 1.7, z); S.add(crown);
    const roof = new THREE.Mesh(new THREE.CircleGeometry(R - 3, 96).rotateX(-Math.PI / 2), dark); roof.position.set(x, top + 3.4, z); S.add(roof);
    const halo = new THREE.Mesh(new THREE.TorusGeometry(R - 8, 0.35, 12, 120), std(0x5fd0ff, { emissive: 0x36c2ff, emissiveIntensity: 3 })); halo.rotation.x = Math.PI / 2; halo.position.set(x, top + 8, z); S.add(halo);
    for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, st = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.6, 8), dark); st.position.set(x + Math.sin(a) * (R - 8), top + 5.7, z + Math.cos(a) * (R - 8)); S.add(st); }
    const spire = new THREE.Mesh(new THREE.ConeGeometry(1.2, 18, 24), std(0xdfe6ee, { metalness: 0.9, roughness: 0.15 })); spire.position.set(x, top + 12.4, z); S.add(spire);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), std(0xff2a2a, { emissive: 0xff0000, emissiveIntensity: 4 })); beacon.position.set(x, top + 21.6, z); S.add(beacon);
    this.world.updaters.push((dt, t) => { beacon.visible = Math.sin(t * 4) > 0; halo.position.y = top + 8 + Math.sin(t * 0.8) * 0.4; halo.rotation.z = t * 0.2; });
    // plinth, entrance canopy and sliding doors
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(R + 3, R + 3.4, 0.3, 120), std(0xd7d9dc, { roughness: 0.6 })); plinth.position.set(x, base - 0.14, z); plinth.receiveShadow = true; S.add(plinth);
    const cz = z + R;
    const canopy = new THREE.Mesh(new THREE.CylinderGeometry(R + 6, R + 6, 0.35, 64, 1, false, -0.26, 0.52), white); canopy.position.set(x, base + 4.6, z); canopy.castShadow = true; S.add(canopy);
    const canGlow = new THREE.Mesh(new THREE.CylinderGeometry(R + 6.02, R + 6.02, 0.08, 64, 1, true, -0.26, 0.52), std(0x5fd0ff, { emissive: 0x36c2ff, emissiveIntensity: 2.5 })); canGlow.position.set(x, base + 4.5, z); S.add(canGlow);
    for (const sx of [-5.5, 5.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 4.6, 16), dark); p.position.set(x + sx, base + 2.3, cz + 5.2); S.add(p); this.world.solids.push({ x: x + sx, z: cz + 5.2, r: 0.3 }); }
    const dl = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.6, 0.08), glassMat()), dr = dl.clone(); S.add(dl, dr);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(7.2, 0.4, 0.3), dark); frame.position.set(x, base + 3.8, cz - 0.1); S.add(frame);
    const name = labelSprite('BANDA TOWER', 0.9, { bg: null, weight: 800 }); name.position.set(x, base + 5.6, cz + 5.6); S.add(name);
    this.world.updaters.push(() => {
      const p = this.world.me?.group.position, near = p && Math.abs(p.x - x) < 4 && Math.abs(p.z - cz) < 5 && p.y < base + 2 ? 1 : 0;
      this.doorOpen = (this.doorOpen || 0) + (near - (this.doorOpen || 0)) * 0.12;
      dl.position.set(x - 1.6 - this.doorOpen * 3, base + 1.8, cz - 0.1); dr.position.set(x + 1.6 + this.doorOpen * 3, base + 1.8, cz - 0.1);
    });
  }
  // round floor slabs with openings for the two elevator shafts (and the pool), ceilings with lights
  slabs() {
    const { x, z, minZ, floors } = this, R = this.round, S = this.world.scene;
    const cols = [0xf2efe8, 0xd6eef5, 0xdcd3c4, 0xb08a64, 0xc9b49a, 0x6e4c38, 0x2a2440, 0x1e2a36];
    const lamp = std(0xffffff, { emissive: 0xfff4e4, emissiveIntensity: 1.8 });
    const rect = (x0, x1, z0, z1) => { const p = new THREE.Path(); p.moveTo(x0, -z0); p.lineTo(x0, -z1); p.lineTo(x1, -z1); p.lineTo(x1, -z0); p.closePath(); return p; };
    for (let lv = 0; lv <= floors; lv++) {
      const y = this.base + lv * this.fh, sh = new THREE.Shape(); sh.absarc(0, 0, R - 0.02, 0, Math.PI * 2, false);
      const lz = minZ - z;
      if (lv > 0) { sh.holes.push(rect(-6.6, -3.4, lz, lz + 3.6), rect(3.4, 6.6, lz, lz + 3.6)); }
      if (lv === 1) sh.holes.push(rect(-12, 12, -5, 9));
      const geo = new THREE.ExtrudeGeometry(sh, { depth: 0.32, bevelEnabled: false, curveSegments: 96 }); geo.rotateX(-Math.PI / 2);
      const tex = (lv === 2 || lv === 3 || lv === 4 || lv === 5 ? TEX.wood : TEX.tile).clone(); tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(0.125, 0.125); tex.needsUpdate = true;
      const mat = lv < floors ? new THREE.MeshStandardMaterial({ map: tex, color: cols[lv], roughness: lv >= 6 ? 0.45 : 0.6 }) : std(0x8a8f96);
      const m = new THREE.Mesh(geo, mat); m.position.set(x, y - 0.32 + (lv === 0 ? 0.05 : 0), z); m.castShadow = lv > 0; m.receiveShadow = true; S.add(m);
      // round ceiling lights in rings
      if (lv > 0) for (const [rr, n] of [[8, 8], [17, 14]]) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, lx = x + Math.sin(a) * rr, lz2 = z + Math.cos(a) * rr; if (lz2 < minZ + 4) continue; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 20), lamp); l.position.set(lx, y - 0.35, lz2); S.add(l); }
    }
    // elevator core: dark glass shaft walls through every floor
    for (const ex of [-5, 5]) for (const sx of [-1.72, 1.72]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, floors * this.fh, 3.6), std(0x2b3038, { metalness: 0.7 })); m.position.set(x + ex + sx, this.base + floors * this.fh / 2, minZ + 1.9); S.add(m); }
    for (const ex of [-5, 5]) { const m = new THREE.Mesh(new THREE.BoxGeometry(3.5, floors * this.fh, 0.1), std(0x2b3038, { metalness: 0.7 })); m.position.set(x + ex, this.base + floors * this.fh / 2, minZ); S.add(m); }
  }
  floorSign(lv) {
    const y = this.floorY(lv), t = this.h.t;
    const s = labelSprite(`${lv + 1} · ${t(FLOORS[lv])}`, 0.55, { bg: 'rgba(12,16,22,0.8)' }); s.position.set(this.x, y + 3.9, this.minZ + 4.2); this.world.scene.add(s);
  }
  plant(lv, px, pz) {
    const y = this.floorY(lv);
    const pot = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.8, 16), std(0xe8e4dc))); pot.position.set(px, y + 0.4, pz);
    for (let i = 0; i < 7; i++) { const leaf = this.add(new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), std(new THREE.Color().setHSL(0.28 + i * 0.01, 0.5, 0.25 + i * 0.02)))); leaf.position.set(px + Math.cos(i) * 0.3, y + 1.1 + (i % 3) * 0.35, pz + Math.sin(i) * 0.3); leaf.scale.set(1, 1.4, 1); }
    this.block(lv, px, pz, 0.45, 0.45);
  }
  sofa(lv, px, pz, rot = 0, color = 0x3b4a6b) {
    const g = new THREE.Group(), m = std(color, { roughness: 0.85 });
    const seat = new THREE.Mesh(new RoundedBox(3, 0.5, 1.1, 2, 0.15), m); seat.position.y = 0.45;
    const back = new THREE.Mesh(new RoundedBox(3, 0.8, 0.3, 2, 0.12), m); back.position.set(0, 0.9, -0.45);
    g.add(seat, back); g.traverse(o => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    g.position.set(px, this.floorY(lv), pz); g.rotation.y = rot; this.world.scene.add(g);
    this.block(lv, px, pz, Math.abs(Math.cos(rot)) * 1.5 + Math.abs(Math.sin(rot)) * 0.55, Math.abs(Math.sin(rot)) * 1.5 + Math.abs(Math.cos(rot)) * 0.55);
  }

  // 1: lobby with reception and the learning games
  lobby(lv) {
    const { x, minX, maxX, maxZ } = this, y = this.floorY(lv);
    this.box(lv, minX + 7, 0.55, maxZ - 9, 8, 1.1, 1.4, std(0xf4f1ea, { roughness: 0.35 }), true, 0.2);
    this.box(lv, minX + 7, 1.12, maxZ - 9, 8.2, 0.06, 1.6, std(0x2a2e34, { metalness: 0.6, roughness: 0.2 }));
    const wall = canvasTex(1024, 512, (g, W, H) => { const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#0d3a5c'); gr.addColorStop(1, '#3aa0d8'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.font = '800 120px Manrope, system-ui'; g.textAlign = 'center'; g.fillText('BANDA', W / 2, H / 2); g.font = '500 48px Manrope, system-ui'; g.fillText('Learn · Play · Explore', W / 2, H / 2 + 90); });
    const screen = this.add(new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshStandardMaterial({ map: wall, emissive: 0xffffff, emissiveMap: wall, emissiveIntensity: 0.6 })), false);
    screen.position.set(minX + 0.35, y + 2.8, this.z); screen.rotation.y = Math.PI / 2;
    this.sofa(lv, maxX - 6, maxZ - 7, -Math.PI / 2); this.sofa(lv, maxX - 6, maxZ - 12, -Math.PI / 2, 0x6b3b3b);
    [[minX + 1.5, maxZ - 1.5], [maxX - 1.5, maxZ - 1.5], [minX + 1.5, this.minZ + 5], [maxX - 1.5, this.minZ + 5]].forEach(([a, b]) => this.plant(lv, a, b));
    const games = ['math', 'english', 'russian', 'speed', 'times', 'match'];
    games.forEach((g, i) => { const cx = x - 10 + (i % 3) * 10, cz = this.z + (i < 3 ? -2 : 5); this.h.station(this, lv, g, cx, cz); });
  }
  // 2: indoor pool with a diving board
  pool(lv) {
    const { x, z, minX, maxX } = this, y = this.floorY(lv), P = { x0: x - 12, x1: x + 12, z0: z - 5, z1: z + 9 };
    this.floorFns[lv] = (px, pz) => (px > P.x0 && px < P.x1 && pz > P.z0 && pz < P.z1) ? y - 1.25 : null;
    const tileT = canvasTex(256, 256, (g, W) => { g.fillStyle = '#4fb6d8'; g.fillRect(0, 0, W, W); g.strokeStyle = '#2f8fb3'; g.lineWidth = 2; for (let i = 0; i <= W; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, W); g.moveTo(0, i); g.lineTo(W, i); g.stroke(); } }, [6, 4]);
    const basin = this.add(new THREE.Mesh(new THREE.BoxGeometry(24, 0.1, 14), new THREE.MeshStandardMaterial({ map: tileT, roughness: 0.2 })), false); basin.position.set(x, y - 1.3, (P.z0 + P.z1) / 2);
    for (const [cx, cz, ww, dd] of [[x, P.z0, 24, 0.1], [x, P.z1, 24, 0.1], [P.x0, (P.z0 + P.z1) / 2, 0.1, 14], [P.x1, (P.z0 + P.z1) / 2, 0.1, 14]]) { const m = this.add(new THREE.Mesh(new THREE.BoxGeometry(ww, 1.3, dd), new THREE.MeshStandardMaterial({ map: tileT })), false); m.position.set(cx, y - 0.65, cz); }
    const water = this.add(new THREE.Mesh(new THREE.PlaneGeometry(24, 14, 48, 28).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x3fc3e8, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.2 })), false);
    water.position.set(x, y - 0.25, (P.z0 + P.z1) / 2);
    const wp = water.geometry.attributes.position;
    this.world.updaters.push((dt, t) => { for (let i = 0; i < wp.count; i++) wp.setY(i, Math.sin(t * 2 + wp.getX(i) * 0.6) * 0.03 + Math.cos(t * 1.6 + wp.getZ(i) * 0.8) * 0.03); wp.needsUpdate = true; water.geometry.computeVertexNormals(); });
    for (let i = 0; i < 4; i++) { const ch = this.add(new THREE.Mesh(new RoundedBox(0.8, 0.35, 2, 2, 0.1), std(0xffffff))); ch.position.set(maxX - 3, y + 0.35, z - 6 + i * 3.5); this.block(lv, maxX - 3, z - 6 + i * 3.5, 0.4, 1); }
    const board = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 3), std(0xf2f2f2))); board.position.set(x - 8, y + 0.9, P.z1 - 1.2);
    this.world.zone({ test: (px, py, pz) => Math.abs(px - (x - 8)) < 0.5 && pz > P.z1 - 2.6 && pz < P.z1 && Math.abs(py - y) < 1, onEnter: () => { this.world.vel.y = 9; this.world.onGround = false; this.h.boing && this.h.boing(); } });
    const slideT = this.add(new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.5, 10, 30, Math.PI * 1.2), std(0xffc94d, { roughness: 0.3 }))); slideT.position.set(minX + 3, y + 2.2, z + 2); slideT.rotation.set(0, 0, -0.4);
    this.plant(lv, minX + 1.5, this.maxZ - 1.5); this.plant(lv, maxX - 1.5, this.maxZ - 1.5);
  }
  // 3: discovery lab — more learning games
  lab(lv) {
    const { x, z, minX, maxX } = this, y = this.floorY(lv);
    ['geo', 'science', 'spelling', 'logic'].forEach((g, i) => this.h.station(this, lv, g, x - 12 + i * 8, z + 3));
    const globe = this.add(new THREE.Mesh(new THREE.SphereGeometry(1.1, 32, 24), new THREE.MeshStandardMaterial({ map: canvasTex(512, 256, (g, W, H) => { g.fillStyle = '#2b6fb3'; g.fillRect(0, 0, W, H); g.fillStyle = '#5aa34a'; for (let i = 0; i < 26; i++) { g.beginPath(); g.ellipse(Math.random() * W, H * 0.2 + Math.random() * H * 0.6, 20 + Math.random() * 60, 12 + Math.random() * 40, Math.random(), 0, 7); g.fill(); } }), roughness: 0.4 })));
    globe.position.set(minX + 5, y + 2, z - 6); this.box(lv, minX + 5, 0.45, z - 6, 1.2, 0.9, 1.2, std(0x2a2e34), true);
    this.world.updaters.push(dt => { globe.rotation.y += dt * 0.3; });
    for (let i = 0; i < 3; i++) { this.box(lv, maxX - 6, 0.5, z - 8 + i * 6, 5, 1, 1.6, std(0xe9eef2), true, 0.08); const mic = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.6, 10), std(0x333a44, { metalness: 0.7 }))); mic.position.set(maxX - 6, y + 1.3, z - 8 + i * 6); }
    this.plant(lv, minX + 1.5, this.maxZ - 1.5);
  }
  // 4: hotel — reception, a carpeted corridor and furnished rooms (check in to get your own room)
  hotel(lv) {
    const { x, z, minX, maxX, minZ, maxZ } = this, y = this.floorY(lv), wallM = std(0xece4d6, { roughness: 0.8 }), wood = std(0x6b4a2f, { roughness: 0.55 }), dark = std(0x23272d, { metalness: 0.5, roughness: 0.35 });
    // carpet runner along the corridor
    const carpetT = canvasTex(256, 64, (g, W, H) => { g.fillStyle = '#6d1f2c'; g.fillRect(0, 0, W, H); g.strokeStyle = '#c9a24a'; g.lineWidth = 3; g.strokeRect(4, 4, W - 8, H - 8); for (let i = 16; i < W; i += 32) { g.beginPath(); g.moveTo(i, H / 2 - 8); g.lineTo(i + 8, H / 2); g.lineTo(i, H / 2 + 8); g.lineTo(i - 8, H / 2); g.closePath(); g.stroke(); } }, [6, 1]);
    const runner = this.add(new THREE.Mesh(new THREE.PlaneGeometry(40, 3.2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: carpetT, roughness: 0.95 })), false); runner.position.set(x, y + 0.02, z + 1.5);
    // reception desk by the elevators with a concierge
    this.box(lv, x - 10, 0.55, minZ + 7, 6, 1.1, 1.2, std(0xf4efe6, { roughness: 0.3 }), true, 0.2);
    this.box(lv, x - 10, 1.13, minZ + 7, 6.2, 0.06, 1.4, wood);
    const bell = this.add(new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(0xd4af37, { metalness: 0.9, roughness: 0.2 }))); bell.position.set(x - 9, y + 1.17, minZ + 7.3);
    const con = new Avatar({ skin: '#f2c49b', face: 'smile', hair: 'short', hairColor: '#1c1410', top: 'plain', shirt: '#6d1f2c', pants: '#1d1d1f', shoes: '#1b1b1b', hat: 'none', pet: 'none', height: 1.05 }, '', 'bot');
    con.group.position.set(x - 10, y, minZ + 5.8); this.world.scene.add(con.group); this.world.updaters.push(dt => con.animate(0, dt, false));
    const hs = labelSprite('🛎️ Banda Hotel', 0.5, { bg: 'rgba(109,31,44,0.92)' }); hs.position.set(x - 10, y + 3.2, minZ + 7); this.world.scene.add(hs);
    this.world.zone({ test: (px, py, pz) => Math.abs(px - (x - 10)) < 3 && pz > minZ + 7.7 && pz < minZ + 9.6 && Math.abs(py - y) < 1, onEnter: () => { con.play('wave'); this.h.hotelDesk && this.h.hotelDesk(); } });
    // luggage cart
    const cart = new THREE.Group(); const brass = std(0xd4af37, { metalness: 0.9, roughness: 0.25 });
    const basePl = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.7), std(0x8a1c2c)); basePl.position.y = 0.25; cart.add(basePl);
    for (const sx of [-0.55, 0.55]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 8), brass); p.position.set(sx, 1.05, 0); cart.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.15, 8).rotateZ(Math.PI / 2), brass); bar.position.y = 1.85; cart.add(bar);
    for (const [c, h, sx] of [[0x2f5f9e, 0.6, -0.25], [0x9b59b6, 0.45, 0.28]]) { const sui = new THREE.Mesh(new RoundedBox(0.5, h, 0.4, 2, 0.06), std(c)); sui.position.set(sx, 0.3 + h / 2, 0); cart.add(sui); }
    cart.position.set(x - 15.5, y, minZ + 7.5); this.world.scene.add(cart); this.block(lv, x - 15.5, minZ + 7.5, 0.6, 0.4);
    // rooms along the south side (and two beside the elevators)
    const rooms = [];
    for (let i = 0; i < 4; i++) rooms.push({ rx: minX + 5.5 + i * 11, side: 1 });
    rooms.push({ rx: minX + 5.5 + 3 * 11, side: -1 });
    rooms.forEach((r, k) => {
      const { rx, side } = r, wz = side < 0 ? minZ + 11 : maxZ - 8.6, back = side < 0 ? minZ + 4.5 : maxZ + 1.5, rz = (wz + back) / 2, num = `${lv + 1}0${k + 1}`;
      // front wall with a door gap, side walls
      const wl = this.add(new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.6, 0.2), wallM)); wl.position.set(rx - 3.3, y + 1.8, wz); this.block(lv, rx - 3.3, wz, 2.2, 0.15);
      const wr = this.add(new THREE.Mesh(new THREE.BoxGeometry(4.4, 3.6, 0.2), wallM)); wr.position.set(rx + 3.3, y + 1.8, wz); this.block(lv, rx + 3.3, wz, 2.2, 0.15);
      const lintel = this.add(new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.9, 0.2), wallM)); lintel.position.set(rx, y + 3.15, wz);
      const depth = Math.abs(back - wz);
      for (const ex of [rx - 5.5, rx + 5.5]) { const sw = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, depth), wallM)); sw.position.set(ex, y + 1.8, rz); this.block(lv, ex, rz, 0.15, depth / 2); }
      // door plate with the room number and a key-card light
      const plate = labelSprite(num, 0.28, { bg: 'rgba(30,30,30,0.85)', color: '#ffd76a' }); plate.position.set(rx + 1.5, y + 2.2, wz + side * -0.15); this.world.scene.add(plate);
      const lock = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.2, 0.05), std(0x111111, { emissive: 0xff3b3b, emissiveIntensity: 1.5 })), false); lock.position.set(rx + 1.3, y + 1.3, wz + side * -0.13);
      r.lock = lock; r.num = num;
      // bed with headboard, pillows and blanket
      const bz = back - side * 1.7, bx = rx - 2.2, col = [0x3b5b8f, 0x8f3b5b, 0x3b8f6b, 0x8f7a3b, 0x5b3b8f][k];
      const head = this.add(new THREE.Mesh(new RoundedBox(2.8, 1.4, 0.2, 2, 0.08), wood)); head.position.set(bx, y + 0.9, back - side * 0.2);
      const bed = this.add(new THREE.Mesh(new RoundedBox(2.6, 0.55, 3, 2, 0.12), std(0xffffff, { roughness: 0.9 }))); bed.position.set(bx, y + 0.3, bz);
      const blanket = this.add(new THREE.Mesh(new RoundedBox(2.65, 0.12, 1.8, 2, 0.05), std(col, { roughness: 0.9 }))); blanket.position.set(bx, y + 0.6, bz + side * 0.55);
      for (const px of [-0.6, 0.6]) { const pil = this.add(new THREE.Mesh(new RoundedBox(0.9, 0.22, 0.5, 2, 0.1), std(0xf7f7f2))); pil.position.set(bx + px, y + 0.68, back - side * 0.65); }
      this.block(lv, bx, bz, 1.3, 1.5);
      // nightstand + lamp, TV on the side wall, wardrobe, rug, window plant
      this.box(lv, bx + 1.9, 0.3, back - side * 0.6, 0.7, 0.6, 0.6, wood, true);
      const lamp = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.35, 16), std(0xfff1cf, { emissive: 0xffd28a, emissiveIntensity: 1.6 }))); lamp.position.set(bx + 1.9, y + 0.85, back - side * 0.6);
      const tv = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 1.7), dark), false); tv.position.set(rx + 5.35, y + 1.7, bz);
      const scr = this.add(new THREE.Mesh(new THREE.PlaneGeometry(1.55, 0.88), std(0x0a1a2a, { emissive: [0x1a8cff, 0xff6b3b, 0x2ecc71, 0xffc94d, 0x9b59b6][k], emissiveIntensity: 0.6 })), false); scr.position.set(rx + 5.3, y + 1.7, bz); scr.rotation.y = -Math.PI / 2;
      this.box(lv, rx + 4.6, 1.2, wz - side * 0.9, 1.4, 2.4, 0.9, wood, true);
      const rug = this.add(new THREE.Mesh(new THREE.CircleGeometry(1.2, 32).rotateX(-Math.PI / 2), std(0xd8c7a6, { roughness: 1 })), false); rug.position.set(rx + 1.5, y + 0.02, rz);
      // rest in bed
      const zzz = labelSprite('💤', 0.6, { bg: null }); zzz.position.set(bx, y + 1.8, bz); zzz.visible = false; this.world.scene.add(zzz);
      this.world.updaters.push((dt, t) => { if (zzz.visible) zzz.position.y = y + 1.7 + Math.sin(t * 2) * 0.15; });
      this.world.zone({ test: (px, py, pz) => Math.abs(px - bx) < 1.6 && Math.abs(pz - bz) < 2.0 && Math.abs(py - y) < 1, onEnter: () => { zzz.visible = true; this.h.rest && this.h.rest('hotel', num); }, onLeave: () => { zzz.visible = false; } });
    });
    this.hotelRooms = (this.hotelRooms || []).concat(rooms.map(r => ({ ...r, lv })));
    // wall sconces along the corridor
    for (let i = 0; i < 6; i++) { const sc = this.add(new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8), std(0xfff1cf, { emissive: 0xffd28a, emissiveIntensity: 2 })), false); sc.position.set(minX + 4 + i * 7.2, y + 2.6, maxZ - 8.75); }
    this.plant(lv, maxX - 2, z - 2); this.plant(lv, minX + 2, z - 2);
  }
  // show which hotel room is yours (green light on the door)
  setMyRoom(num) { (this.hotelRooms || []).forEach(r => { const mine = r.num === num; r.lock.material.emissive.setHex(mine ? 0x2ecc71 : 0xff3b3b); }); }
  // 5: spa & café
  spa(lv) {
    const { x, z, minX, maxX, maxZ } = this, y = this.floorY(lv);
    const tub = this.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.8, 32), std(0xf2f2f2, { roughness: 0.3 }))); tub.position.set(x - 10, y + 0.4, z + 4);
    const tw = this.add(new THREE.Mesh(new THREE.CircleGeometry(2.7, 32).rotateX(-Math.PI / 2), std(0x7fd6e8, { transparent: true, opacity: 0.7, roughness: 0.05, emissive: 0x0a3a44 })), false); tw.position.set(x - 10, y + 0.82, z + 4);
    this.block(lv, x - 10, z + 4, 2.2, 2.2);
    this.world.zone({ test: (px, py, pz) => Math.hypot(px - (x - 10), pz - (z + 4)) < 3.6 && Math.abs(py - y) < 1, onEnter: () => this.h.rest && this.h.rest('spa') });
    this.box(lv, maxX - 7, 0.6, z + 2, 9, 1.2, 1.4, std(0x6b4a2f, { roughness: 0.5 }), true, 0.1);
    for (let i = 0; i < 3; i++) { const cup = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.2, 12), std(0xffffff))); cup.position.set(maxX - 9 + i * 2, y + 1.3, z + 2); }
    const menu = labelSprite('☕ COFFEE · CAFÉ', 0.6, { bg: 'rgba(60,40,25,0.9)' }); menu.position.set(maxX - 7, y + 3, z + 0.5); this.world.scene.add(menu);
    this.world.zone({ test: (px, py, pz) => Math.abs(px - (maxX - 7)) < 4.5 && pz > z + 2.8 && pz < z + 5 && Math.abs(py - y) < 1, onEnter: () => this.h.cafe && this.h.cafe() });
    for (let i = 0; i < 3; i++) this.sofa(lv, x + 2 + i * 4, maxZ - 3, Math.PI, 0xc9b59a);
    this.plant(lv, minX + 1.5, maxZ - 1.5); this.plant(lv, x - 4, maxZ - 2);
  }
  // 6: cinema lounge
  cinema(lv) {
    const { x, z, minX, maxX } = this, y = this.floorY(lv);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 288; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = this.add(new THREE.Mesh(new THREE.PlaneGeometry(8.4, 4.72), new THREE.MeshBasicMaterial({ map: tex })), false); scr.position.set(minX + 0.6, y + 2.6, z + 1); scr.rotation.y = Math.PI / 2;
    const backing = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.1, 8.8), std(0x0a0a0c)), false); backing.position.set(minX + 0.4, y + 2.6, z + 1);
    const show = new CinemaShow(cv, (txt, l) => this.h.say && this.h.say(txt, l), n => this.h.sfx && this.h.sfx(n));
    let acc = 0, was = false;
    this.world.updaters.push(dt => {
      const p = this.world.me?.group.position, watching = !!p && this.contains(p.x, p.z) && Math.abs(p.y - y) < 2.5;
      if (was && !watching && window.speechSynthesis) speechSynthesis.cancel(); was = watching;
      acc += dt; if (acc < 1 / 15) return; const step = acc; acc = 0;
      show.update(step, watching); if (watching) tex.needsUpdate = true;
    });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { const sx = minX + 9 + r * 4, sz = z - 6 + c * 3; const seat = this.add(new THREE.Mesh(new RoundedBox(1.4, 0.9, 1.2, 2, 0.15), std(0x8f1f2b, { roughness: 0.8 }))); seat.position.set(sx, y + 0.45, sz); }
    this.world.zone({ test: (px, py, pz) => px > minX + 7 && px < minX + 19 && pz > z - 8 && pz < z + 8 && Math.abs(py - y) < 1, onEnter: () => this.h.rest && this.h.rest('cinema') });
    for (let i = 0; i < 4; i++) { const bb = this.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), std([0xe74c3c, 0xf1c40f, 0x3498db, 0x2ecc71][i], { roughness: 0.9 }))); bb.scale.y = 0.6; bb.position.set(maxX - 4, y + 0.45, z - 6 + i * 3.5); }
  }
  // 7: arcade
  arcade(lv) {
    const { x, z, minX, maxX } = this, y = this.floorY(lv);
    ['flappy', 'snake', 'craft', 'breaker', 'dodger'].forEach((g, i) => this.h.station(this, lv, g, x - 14 + i * 7, z + 2, true));
    const neon = (cx, cz, col) => { const m = this.add(new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 0.08), std(col, { emissive: col, emissiveIntensity: 3 })), false); m.position.set(cx, y + 4.2, cz); };
    neon(x - 8, z - 4, 0xff3fa4); neon(x + 8, z - 4, 0x36c2ff); neon(x - 8, z + 8, 0x7bff6b); neon(x + 8, z + 8, 0xffc94d);
    const sign = labelSprite('ARCADE', 1.0, { bg: 'rgba(30,10,40,0.85)', color: '#ff7bd5', weight: 800 }); sign.position.set(x, y + 3.6, this.maxZ - 1); this.world.scene.add(sign);
  }
  // 8: game center — popular multiplayer games
  games(lv) {
    const { x, z } = this;
    const y = this.floorY(lv), cols = [0xff3b3b, 0xffc94d, 0x7b6bff, 0xffe066, 0x39d353, 0x36c2ff];
    ['impostor', 'quiz', 'hide', 'starhunt', 'football', 'dodgeball'].forEach((g, i) => {
      const px = x - 15 + (i % 3) * 15, pz = z + (i < 3 ? -2 : 7);
      this.h.pad(this, lv, g, px, pz);
      // glowing stage under each game pad
      const stage = this.add(new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.3, 0.08, 48), std(0x111620, { metalness: 0.6, roughness: 0.35 })), false); stage.position.set(px, y + 0.02, pz);
      const ring = this.add(new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.06, 8, 64).rotateX(Math.PI / 2), std(cols[i], { emissive: cols[i], emissiveIntensity: 2.5 })), false); ring.position.set(px, y + 0.08, pz);
    });
    // LED wall + neon ceiling strips
    const T = canvasTex(1024, 256, (g, W, H) => { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#2a0b4d'); gr.addColorStop(1, '#0b2a4d'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.font = '900 120px Manrope, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#ff4fd8'; g.shadowBlur = 30; g.fillStyle = '#fff'; g.fillText('GAME CENTER', W / 2, H / 2 + 6); });
    const wall = this.add(new THREE.Mesh(new THREE.PlaneGeometry(16, 4), new THREE.MeshBasicMaterial({ map: T })), false); wall.position.set(x, y + 2.6, this.maxZ - 0.35); wall.rotation.y = Math.PI;
    for (let k = 0; k < 5; k++) { const c = cols[k % 6], m = this.add(new THREE.Mesh(new THREE.BoxGeometry(this.w - 4, 0.06, 0.12), std(c, { emissive: c, emissiveIntensity: 2 })), false); m.position.set(x, y + this.fh - 0.45, this.minZ + 6 + k * 5.5); }
    for (let i = 0; i < 4; i++) { const bb = this.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 16, 12), std(cols[i + 1], { roughness: 0.9 }))); bb.scale.y = 0.6; bb.position.set(this.minX + 2.5, y + 0.45, z - 6 + i * 4); this.block(lv, this.minX + 2.5, z - 6 + i * 4, 0.7, 0.7); }
  }

  // the best elevator to call to floor lv (idle and close beats busy and far)
  nearest(lv, px = this.x) { return this.elevators.slice().sort((a, b) => (Math.abs(a.level - lv) + (a.state === 'idle' ? 0 : 4) + Math.abs(a.cx - px) * 0.1) - (Math.abs(b.level - lv) + (b.state === 'idle' ? 0 : 4) + Math.abs(b.cx - px) * 0.1))[0]; }
  call(p) { const lv = this.levelAt(p.y), e = this.nearest(lv, p.x); e.go(lv); return e; }
  update(p) {
    // move the interior lights to the floor you're on
    const inside = this.contains(p.x, p.z) && p.y > this.base - 2 && p.y < this.base + this.floors * this.fh;
    const lv = this.levelAt(p.y), y = this.floorY(lv) + 3.8;
    this.lights.forEach((l, i) => { l.intensity = inside ? 12 : 0; l.position.set(this.x - 14 + i * 14, y, this.z); });
  }
}

// ---------------- Supermarket ----------------
export const AISLES = [
  { id: 'fruit', items: ['apple', 'banana'], color: 0x2ecc71 },
  { id: 'drinks', items: ['juice', 'soda'], color: 0x3498db },
  { id: 'snacks', items: ['chips', 'chocolate', 'icecream'], color: 0xe67e22 },
  { id: 'meals', items: ['pizza', 'burger', 'cake'], color: 0xe74c3c },
  { id: 'toys', items: ['ball', 'balloon', 'teddy'], color: 0x9b59b6 },
  { id: 'style', items: ['crown', 'headphones', 'tophat'], color: 0xf1c40f },
  { id: 'pets', items: ['dog', 'cat', 'bunny', 'dragon'], color: 0xff6fa8 },
];

export class Market extends Building {
  constructor(world, h) {
    const M = MARKET;
    super(world, { x: M.x, z: M.z, w: M.w, d: M.d, floors: 1, fh: 5, base: M.base, door: { side: 'e', at: M.z + 4, width: 5 } });
    this.h = h; this.build();
  }
  build() {
    const { x, z, w, d, base, minX, maxX, minZ, maxZ } = this, S = this.world.scene, H = 5.5;
    const facade = this.world.texMat(TEX.plaster, w, H, { color: 0xffffff, roughness: 0.9 });
    const box = (cx, cy, cz, ww, hh, dd, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), m); o.position.set(cx, cy, cz); o.castShadow = o.receiveShadow = true; S.add(o); return o; };
    box(x, base + H / 2, minZ, w, H, 0.3, facade); box(x, base + H / 2, maxZ, w, H, 0.3, facade); box(minX, base + H / 2, z, 0.3, H, d, facade);
    const g = glassMat(), da = this.door.at - 2.5, db = this.door.at + 2.5;
    const gp = (z0, z1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, H - 1), g); m.position.set(maxX, base + (H - 1) / 2, (z0 + z1) / 2); m.rotation.y = Math.PI / 2; S.add(m); };
    gp(minZ, da); gp(db, maxZ); box(maxX, base + H - 0.5, z, 0.4, 1, d, std(0x2e8b57));
    const roof = box(x, base + H, z, w + 0.6, 0.4, d + 0.6, std(0x9aa0a6)); roof.castShadow = true;
    const floor = box(x, base - 0.01, z, w, 0.12, d, this.world.texMat(TEX.tile, w, d, { color: 0xf4f4f0, roughness: 0.3 }));
    const signT = canvasTex(1024, 256, (c, W, Hh) => { c.fillStyle = '#2e8b57'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#fff'; c.font = '800 120px Manrope, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('Banda Market', W / 2, Hh / 2 + 6); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshStandardMaterial({ map: signT, emissive: 0xffffff, emissiveMap: signT, emissiveIntensity: 0.4 })); sign.position.set(maxX + 0.25, base + H + 1.6, z); sign.rotation.y = Math.PI / 2; S.add(sign);
    for (let i = 0; i < 4; i++) for (let k = 0; k < 2; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(5, 0.06, 0.6), std(0xffffff, { emissive: 0xffffff, emissiveIntensity: 1.6 })); l.position.set(minX + 5 + i * 7.5, base + H - 0.25, minZ + 6 + k * 10); S.add(l); }
    const ml = new THREE.PointLight(0xffffff, 0, 30, 1.4); ml.position.set(x, base + 4.5, z); S.add(ml); this.lights.push(ml);
    // automatic sliding doors
    const dl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3, 2.5), glassMat()), dr = dl.clone(); S.add(dl, dr);
    this.world.updaters.push(() => {
      const p = this.world.me?.group.position, near = p && Math.abs(p.x - maxX) < 4 && Math.abs(p.z - this.door.at) < 4 ? 1 : 0;
      this.o = (this.o || 0) + (near - (this.o || 0)) * 0.12;
      dl.position.set(maxX, base + 1.5, this.door.at - 1.25 - this.o * 2.4); dr.position.set(maxX, base + 1.5, this.door.at + 1.25 + this.o * 2.4);
      if (p) ml.intensity = this.contains(p.x, p.z) ? 20 : 0;
    });
    // shelves: one aisle per category
    const productColors = [0xe74c3c, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6, 0xe67e22, 0xffffff];
    AISLES.forEach((a, i) => {
      const sx = minX + 3 + i * 3.3, sz = z - 1.5;
      const shelf = box(sx, base + 1.1, sz, 0.5, 2.2, 13, std(0x59606a, { metalness: 0.5, roughness: 0.45 }));
      for (let lvl = 0; lvl < 4; lvl++) box(sx, base + 0.18 + lvl * 0.55, sz, 1.0, 0.04, 13, std(0xd9dde2, { metalness: 0.6, roughness: 0.3 }));
      for (const e of [-6.6, 6.6]) box(sx, base + 1.1, sz + e, 1.1, 2.3, 0.12, std(a.color, { roughness: 0.4 }));
      this.block(0, sx, sz, 0.55, 6.5);
      for (let lvl = 0; lvl < 4; lvl++) for (let k = 0; k < 10; k++) for (const side of [-1, 1]) {
        const pr = new THREE.Mesh(i === 1 ? new THREE.CylinderGeometry(0.12, 0.12, 0.38, 8) : new THREE.BoxGeometry(0.22, 0.3, 0.28), std(productColors[(i + k + lvl) % productColors.length], { roughness: 0.5 }));
        pr.position.set(sx + side * 0.38, base + 0.35 + lvl * 0.55, sz - 5.8 + k * 1.3); S.add(pr);
      }
      const lab = labelSprite(this.h.t('aisle_' + a.id), 0.45, { bg: `#${a.color.toString(16).padStart(6, '0')}` }); lab.position.set(sx, base + 3.2, sz + 6.8); S.add(lab);
      this.world.zone({ test: (px, py, pz) => px > sx - 1.6 && px < sx + 1.6 && Math.abs(pz - sz) < 7 && Math.abs(px - sx) > 0.55 && Math.abs(py - base) < 1.5, onEnter: () => this.h.aisle(a) });
    });
    // checkout counter with the mPAY palm scanner
    const cx = maxX - 4.5, cz = z - 5;
    box(cx, base + 0.5, cz, 1.6, 1.0, 5, std(0x2b2f36, { metalness: 0.4, roughness: 0.3 }));
    this.block(0, cx, cz, 0.8, 2.5);
    const scanner = new THREE.Mesh(new RoundedBox(0.7, 0.12, 0.7, 2, 0.05), std(0x101418, { metalness: 0.6, roughness: 0.2, emissive: 0x00a0ff, emissiveIntensity: 0.6 })); scanner.position.set(cx, base + 1.08, cz + 1.2); S.add(scanner);
    const palm = labelSprite('✋ mPAY', 0.45, { bg: 'rgba(0,120,255,0.9)' }); palm.position.set(cx, base + 1.9, cz + 1.2); S.add(palm);
    this.world.updaters.push((dt, t) => { scanner.material.emissiveIntensity = 0.5 + Math.sin(t * 3) * 0.3; });
    this.world.zone({ test: (px, py, pz) => px > cx - 3 && px < cx - 0.8 && Math.abs(pz - (cz + 1)) < 2.5 && Math.abs(py - base) < 1.5, onEnter: () => this.h.checkout() });
    const cl = labelSprite(this.h.t('checkout'), 0.45); cl.position.set(cx, base + 3, cz); S.add(cl);
  }
}

// ---------------- mBank ----------------
// Three desks with staff. Each has a big screen behind it that explains, step by step, what to do.
export class Bank extends Building {
  constructor(world, h) {
    const B = BANK;
    super(world, { x: B.x, z: B.z, w: B.w, d: B.d, floors: 1, fh: 5.5, base: B.base, door: { side: 'e', at: B.z, width: 5 } });
    this.h = h; this.staff = []; this.screens = []; this.deskFront = []; this.build();
  }
  build() {
    const { x, z, w, d, base, minX, maxX, minZ, maxZ } = this, S = this.world.scene, H = 6, t = this.h.t;
    const box = (cx, cy, cz, ww, hh, dd, m, cast = true) => { const o = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), m); o.position.set(cx, cy, cz); o.castShadow = cast; o.receiveShadow = true; S.add(o); return o; };
    const stone = this.world.texMat(TEX.plaster, w, H, { color: 0xf6f4ef, roughness: 0.85 }), navy = std(0x0f2a4a, { roughness: 0.4, metalness: 0.3 });
    box(x, base + H / 2, minZ, w, H, 0.4, stone); box(x, base + H / 2, maxZ, w, H, 0.4, stone); box(minX, base + H / 2, z, 0.4, H, d, stone);
    // glass front with navy frame
    const g = glassMat(), da = this.door.at - 2.5, db = this.door.at + 2.5;
    for (const [z0, z1] of [[minZ, da], [db, maxZ]]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, H - 1.2), g); m.position.set(maxX, base + (H - 1.2) / 2, (z0 + z1) / 2); m.rotation.y = Math.PI / 2; S.add(m); }
    box(maxX, base + H - 0.6, z, 0.5, 1.2, d + 0.4, navy);
    for (let k = 0; k <= 6; k++) box(maxX, base + (H - 1.2) / 2, minZ + k * d / 6, 0.16, H - 1.2, 0.16, navy);
    box(x, base + H + 0.2, z, w + 0.8, 0.4, d + 0.8, std(0xe9e6df));
    box(x, base - 0.01, z, w, 0.12, d, this.world.texMat(TEX.tile, w, d, { color: 0xf3f1ec, roughness: 0.25, metalness: 0.05 }), false);
    // sign
    const logo = canvasTex(1024, 256, (c, W, Hh) => {
      c.clearRect(0, 0, W, Hh); const gr = c.createLinearGradient(0, 0, 220, 220); gr.addColorStop(0, '#34e0a1'); gr.addColorStop(1, '#1a8cff');
      c.fillStyle = gr; c.beginPath(); c.roundRect(40, 28, 200, 200, 44); c.fill();
      c.fillStyle = '#04203f'; c.font = '900 170px Manrope, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('m', 140, 120);
      c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.font = '800 150px Manrope, system-ui'; c.fillText('mBank', 280, 132);
    });
    { const img = new Image(); img.onload = () => { const c = logo.image.getContext('2d'); c.clearRect(30, 18, 220, 220); c.drawImage(img, 36, 24, 210, 210); logo.needsUpdate = true; }; img.src = '/img/mbank.svg'; }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(12, 3), new THREE.MeshBasicMaterial({ map: logo, transparent: true })); sign.position.set(maxX + 0.3, base + H + 1.9, z); sign.rotation.y = Math.PI / 2; S.add(sign);
    const signBack = box(maxX + 0.15, base + H + 1.9, z, 0.2, 3.4, 12.6, navy); signBack.castShadow = false;
    for (const sz of [-1, 1]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, H, 16), std(0xf2f2f2, { roughness: 0.3 })); p.position.set(maxX + 2, base + H / 2, z + sz * 3.4); S.add(p); this.world.solids.push({ x: maxX + 2, z: z + sz * 3.4, r: 0.3 }); }
    const canopy = box(maxX + 1.6, base + H - 0.1, z, 3.4, 0.25, 8, navy);
    // sliding doors + lights while inside
    const dl = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.2, 2.5), glassMat()), dr = dl.clone(); S.add(dl, dr);
    const light = new THREE.PointLight(0xfff6ea, 0, 32, 1.4); light.position.set(x, base + 4.8, z); S.add(light);
    this.world.updaters.push(() => {
      const p = this.world.me?.group.position, near = p && Math.abs(p.x - maxX) < 4 && Math.abs(p.z - this.door.at) < 4 ? 1 : 0;
      this.o = (this.o || 0) + (near - (this.o || 0)) * 0.12;
      dl.position.set(maxX, base + 1.6, this.door.at - 1.25 - this.o * 2.4); dr.position.set(maxX, base + 1.6, this.door.at + 1.25 + this.o * 2.4);
      if (p) light.intensity = this.contains(p.x, p.z) ? 16 : 0;
    });
    for (let i = 0; i < 3; i++) for (let k = 0; k < 2; k++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 24), std(0xffffff, { emissive: 0xfff4e4, emissiveIntensity: 1.8 })); l.position.set(minX + 6 + i * 7, base + H - 0.1, minZ + 5 + k * 8); S.add(l); }
    // welcome wall
    const wel = canvasTex(1024, 300, (c, W, Hh) => { const gr = c.createLinearGradient(0, 0, W, Hh); gr.addColorStop(0, '#0f2a4a'); gr.addColorStop(1, '#14629e'); c.fillStyle = gr; c.fillRect(0, 0, W, Hh); c.fillStyle = '#fff'; c.font = '800 96px Manrope, system-ui'; c.textAlign = 'center'; c.fillText(t('bankWelcome'), W / 2, 130); c.font = '600 46px Manrope, system-ui'; c.fillStyle = '#9fe8c9'; c.fillText(t('bankWelcomeSub'), W / 2, 220); });
    const wm = new THREE.Mesh(new THREE.PlaneGeometry(10, 3), new THREE.MeshBasicMaterial({ map: wel })); wm.position.set(x + 2, base + 3.2, maxZ - 0.25); wm.rotation.y = Math.PI; S.add(wm);
    // three desks along the west wall, each with a member of staff and a step-by-step screen
    const uniforms = [0x0f2a4a, 0x14629e, 0x1d7a57];
    [0, 1, 2].forEach(i => {
      const dz = minZ + 3.6 + i * 5.4, dx = minX + 4.2;
      box(dx, base + 0.55, dz, 1.2, 1.1, 3.4, std(0xffffff, { roughness: 0.3 })).castShadow = true;
      box(dx, base + 1.13, dz, 1.4, 0.06, 3.6, std(0x23272d, { metalness: 0.6, roughness: 0.25 }));
      box(dx + 0.62, base + 0.55, dz, 0.04, 0.8, 3.0, std([0x34e0a1, 0x1a8cff, 0xffc94d][i], { emissive: [0x34e0a1, 0x1a8cff, 0xffc94d][i], emissiveIntensity: 0.6 }), false);
      this.block(0, dx, dz, 0.7, 1.8);
      // hand scanner on desk 2
      if (i === 1) { const sc = new THREE.Mesh(new RoundedBox(0.6, 0.1, 0.6, 2, 0.04), std(0x101418, { emissive: 0x00a0ff, emissiveIntensity: 0.8, metalness: 0.5 })); sc.position.set(dx + 0.3, base + 1.2, dz); S.add(sc); this.world.updaters.push((dt, tt) => { sc.material.emissiveIntensity = 0.6 + Math.sin(tt * 3) * 0.3; }); }
      const av = new Avatar({ skin: ['#f2c49b', '#d9a066', '#ffd9b8'][i], face: 'smile', hair: ['bun', 'short', 'long'][i], hairColor: ['#1c1410', '#4a2c17', '#7a4a24'][i], top: 'plain', shirt: '#' + uniforms[i].toString(16).padStart(6, '0'), pants: '#22293a', shoes: '#1b1b1b', hat: 'none', pet: 'none', height: 1.05 }, '', 'bot');
      av.group.position.set(minX + 2.4, base, dz); av.group.rotation.y = Math.PI / 2; S.add(av.group); this.staff.push(av);
      const tag = labelSprite(t('bankDesk' + i), 0.42, { bg: 'rgba(15,42,74,0.92)' }); tag.position.set(dx, base + 2.9, dz); S.add(tag);
      // the screen behind the desk
      const cv = document.createElement('canvas'); cv.width = 768; cv.height = 512; const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.8), new THREE.MeshBasicMaterial({ map: tex })); scr.position.set(minX + 0.3, base + 3.3, dz); scr.rotation.y = Math.PI / 2; S.add(scr);
      const frame = box(minX + 0.24, base + 3.3, dz, 0.08, 3.0, 4.4, std(0x111418, { metalness: 0.6 }), false);
      this.screens.push({ cv, tex, i }); this.drawScreen(i);
      // queue lane with posts and a rope in front of each desk
      for (const k of [1, 2, 3, 4]) for (const side of [-0.9, 0.9]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 1, 10), std(0xd4af37, { metalness: 0.9, roughness: 0.2 })); p.position.set(dx + 1.6 + k * 1.4, base + 0.5, dz + side); S.add(p); }
      for (const side of [-0.9, 0.9]) { const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 4.2, 6).rotateZ(Math.PI / 2), std(0x8a1c2c)); rope.position.set(dx + 1.6 + 2.5 * 1.4, base + 0.85, dz + side); S.add(rope); }
      this.deskFront.push({ x: dx + 1.8, z: dz });
      // you're served when nobody is standing at the desk; otherwise wait in line
      let opened = false, told = false;
      this.world.zone({ test: (px, py, pz) => px > dx + 0.7 && px < dx + 2.8 && Math.abs(pz - dz) < 1.7 && Math.abs(py - base) < 1.5,
        onEnter: () => { opened = false; told = false; },
        onStay: () => { if (opened) return; const busy = this.h.someoneAt && this.h.someoneAt(dx + 1.8, dz); if (busy) { if (!told) { told = true; this.h.wait && this.h.wait(); } return; } opened = true; av.play('wave'); this.h.desk(i); } });
    });
    this.world.updaters.push((dt, tt) => this.staff.forEach((a, i) => { a.animate(0, dt, false); if (!a.emote && Math.sin(tt * 0.5 + i * 2) > 0.995) a.play('wave'); }));
    // waiting area, plants, ATMs
    for (let i = 0; i < 2; i++) { const g2 = new THREE.Group(), m = std(0x2f4f6f, { roughness: 0.85 }); const seat = new THREE.Mesh(new RoundedBox(3, 0.5, 1.1, 2, 0.15), m); seat.position.y = 0.45; const back = new THREE.Mesh(new RoundedBox(3, 0.8, 0.3, 2, 0.12), m); back.position.set(0, 0.9, -0.45); g2.add(seat, back); g2.position.set(x + 3 + i * 4.5, base, maxZ - 2); g2.rotation.y = Math.PI; S.add(g2); this.block(0, x + 3 + i * 4.5, maxZ - 2, 1.5, 0.55); }
    for (let i = 0; i < 2; i++) { const ax = x - 2 + i * 2.4, atm = box(ax, base + 1.1, minZ + 0.6, 1.6, 2.2, 0.8, std(0x23272d, { metalness: 0.6, roughness: 0.3 })); const s2 = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), std(0x0a1a2a, { emissive: 0x1a8cff, emissiveIntensity: 1 })); s2.position.set(ax, base + 1.5, minZ + 1.01); S.add(s2); this.block(0, ax, minZ + 0.6, 0.8, 0.4); }
    const atmL = labelSprite('ATM', 0.35, { bg: 'rgba(15,42,74,0.9)' }); atmL.position.set(x - 0.8, base + 2.6, minZ + 0.8); S.add(atmL);
    // job window: a cashier counter you can work at, and the job board
    const jx = maxX - 6.5, jz = minZ + 2.4;
    box(jx, base + 0.55, jz, 4.2, 1.1, 1.0, std(0xffffff, { roughness: 0.3 })); box(jx, base + 1.13, jz, 4.4, 0.06, 1.2, std(0x23272d, { metalness: 0.6, roughness: 0.25 }));
    box(jx, base + 0.55, jz + 0.52, 3.8, 0.8, 0.04, std(0xffc94d, { emissive: 0xffc94d, emissiveIntensity: 0.5 }), false);
    this.block(0, jx, jz, 2.1, 0.5);
    const till = new THREE.Mesh(new RoundedBox(0.7, 0.35, 0.5, 2, 0.05), std(0x2b2f36, { metalness: 0.5 })); till.position.set(jx - 1, base + 1.35, jz); S.add(till);
    const jl = labelSprite('4 · ' + t('cashierWindow'), 0.42, { bg: 'rgba(180,120,0,0.92)' }); jl.position.set(jx, base + 2.9, jz); S.add(jl);
    this.cashier = { x: jx, z: jz, standZ: jz - 1.1, custZ: jz + 1.3 };
    this.world.zone({ test: (px, py, pz) => Math.abs(px - jx) < 2 && pz < jz - 0.4 && pz > minZ + 0.3 && Math.abs(py - base) < 1.5, onEnter: () => this.h.cashierIn && this.h.cashierIn(), onLeave: () => this.h.cashierOut && this.h.cashierOut() });
    const board = canvasTex(512, 384, (c, W, Hh) => { c.fillStyle = '#0f2a4a'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#ffc94d'; c.font = '800 54px Manrope, system-ui'; c.fillText('💼 ' + t('jobs'), 30, 70); c.fillStyle = '#fff'; c.font = '600 32px Manrope, system-ui'; c.fillText('🏦 ' + t('job_cashier'), 30, 160); c.fillText('🧹 ' + t('job_cleaner'), 30, 230); c.fillStyle = '#9fe8c9'; c.font = '600 26px Manrope, system-ui'; c.fillText(t('jobsHint'), 30, 320); });
    const bm = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.8), new THREE.MeshBasicMaterial({ map: board })); bm.position.set(maxX - 1.2, base + 2, z + 5.5); bm.rotation.y = -Math.PI / 2; S.add(bm);
    const stand = box(maxX - 1.1, base + 0.6, z + 5.5, 0.3, 1.2, 0.4, std(0x23272d), false); this.block(0, maxX - 1.1, z + 5.5, 0.3, 0.3);
    this.world.zone({ test: (px, py, pz) => px > maxX - 3.2 && px < maxX - 1.4 && Math.abs(pz - (z + 5.5)) < 1.3 && Math.abs(py - base) < 1.5, onEnter: () => this.h.jobs && this.h.jobs() });
    for (const [px, pz] of [[maxX - 1.5, minZ + 1.5], [maxX - 1.5, maxZ - 1.5], [minX + 1.2, maxZ - 1.2]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.8, 16), std(0xe8e4dc)); pot.position.set(px, base + 0.4, pz); S.add(pot);
      for (let i = 0; i < 7; i++) { const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), std(new THREE.Color().setHSL(0.3, 0.5, 0.25 + i * 0.02))); leaf.position.set(px + Math.cos(i) * 0.3, base + 1.1 + (i % 3) * 0.35, pz + Math.sin(i) * 0.3); leaf.scale.set(1, 1.4, 1); S.add(leaf); }
      this.block(0, px, pz, 0.45, 0.45);
    }
  }
  drawScreen(i) {
    const { cv, tex } = this.screens[i], g = cv.getContext('2d'), t = this.h.t, W = cv.width, H = cv.height;
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, '#0f2a4a'); gr.addColorStop(1, '#0b4f7f'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = ['#34e0a1', '#5fc0ff', '#ffc94d'][i]; g.font = '800 54px Manrope, system-ui'; g.textAlign = 'left'; g.fillText(t('bankDesk' + i), 40, 80);
    const steps = t('bankSteps' + i).split('|');
    steps.forEach((s, k) => {
      const y = 160 + k * 110;
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.beginPath(); g.roundRect(30, y - 60, W - 60, 92, 18); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(84, y - 14, 30, 0, 7); g.fill();
      g.fillStyle = '#0f2a4a'; g.font = '800 36px Manrope, system-ui'; g.textAlign = 'center'; g.fillText(String(k + 1), 84, y - 2);
      g.fillStyle = '#fff'; g.font = '600 34px Manrope, system-ui'; g.textAlign = 'left'; g.fillText(s, 134, y - 2);
    });
    tex.needsUpdate = true;
  }
}
