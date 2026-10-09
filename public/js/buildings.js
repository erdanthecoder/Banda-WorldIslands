// Walk-in buildings: Banda Tower (8 floors, glass elevators) and the supermarket.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TEX, canvasTex, labelSprite, TOWER, MARKET } from './world.js';

const glassMat = () => new THREE.MeshStandardMaterial({ color: 0x9cc3d6, metalness: 0.9, roughness: 0.04, transparent: true, opacity: 0.26, envMapIntensity: 1.6, depthWrite: false, side: THREE.DoubleSide });
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

// A rectangular, axis-aligned building with floors you can walk on.
export class Building {
  constructor(world, { x, z, w, d, floors = 1, fh = 5, base, door }) {
    Object.assign(this, { world, x, z, w, d, floors, fh, base, door });
    this.minX = x - w / 2; this.maxX = x + w / 2; this.minZ = z - d / 2; this.maxZ = z + d / 2;
    this.walls = Array.from({ length: floors }, () => []);
    this.floorFns = Array.from({ length: floors }, () => null);
    this.dynamicWalls = [];
    this.lights = [];
    world.buildings.push(this);
    this.outerWalls();
  }
  outerWalls() {
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
  contains(px, pz) { return px > this.minX && px < this.maxX && pz > this.minZ && pz < this.maxZ; }
  levelAt(y) { return Math.max(0, Math.min(this.floors - 1, Math.floor((y - this.base + 1.2) / this.fh))); }
  floorY(lv) { return this.base + lv * this.fh; }
  interior(px, py, pz) {
    if (!this.contains(px, pz) || py < this.base - 3 || py > this.base + this.floors * this.fh + 2) return null;
    const lv = this.levelAt(py), fy = this.floorY(lv), fn = this.floorFns[lv];
    return { floor: fy, floorAt: fn ? (ax, az) => fn(ax, az) ?? fy : null, ceil: this.fh - 0.4, walls: this.walls[lv].concat(this.dynamicWalls.filter(w => w.lv === lv && w.on())), noClamp: true,
      minX: this.minX, maxX: this.maxX, minZ: this.minZ, maxZ: this.maxZ, level: lv, building: this };
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
    this.level = 0; this.y = b.floorY(0); this.target = 0; this.state = 'idle'; this.open = 1; this.speed = 5;
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
      const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.3, 0.2), std(0x1c1f24, { metalness: 0.6 })); frame.position.set(cx, y + 3.05, cz + 1.66); S.add(frame);
      const ind = labelSprite(String(lv + 1), 0.32, { bg: 'rgba(10,14,20,0.85)', color: '#5fd0ff' }); ind.position.set(cx, y + 3.45, cz + 1.7); S.add(ind);
      b.dynamicWalls.push({ lv, x: cx, z: cz + 1.62, hw: 1.6, hd: 0.12, on: () => !(this.level === lv && this.state === 'idle' && this.open > 0.6) });
      // call: walking up to closed doors calls the cab to this floor
      b.world.zone({ test: (px, py, pz) => Math.abs(px - cx) < 1.6 && pz > cz + 1.7 && pz < cz + 3.4 && Math.abs(py - y) < 1.2,
        onEnter: () => { if (this.level !== lv || this.state !== 'idle') { this.go(lv); b.world.onElevatorCall && b.world.onElevatorCall(); } } });
    }
    // stepping into the open cab shows the floor buttons
    b.world.zone({ test: (px, py, pz) => this.state === 'idle' && Math.abs(px - cx) < 1.3 && pz < cz + 1.2 && pz > cz - 1.4 && Math.abs(py - this.y) < 1, onEnter: () => this.onPanel(this) });
    b.world.updaters.push(dt => this.update(dt));
  }
  contains(p) { return Math.abs(p.x - this.cx) < 1.45 && Math.abs(p.z - this.cz) < 1.45 && Math.abs(p.y - this.y) < 1.2; }
  go(lv) {
    if (lv === this.level && this.state === 'idle') return;
    this.target = lv; this.state = 'closing';
  }
  // ride with the player inside
  ride(lv, onArrive) {
    const w = this.b.world;
    this.go(lv);
    w.carrier = { update: (dt, p, me) => { p.y = this.y; p.x = Math.max(this.cx - 1.1, Math.min(this.cx + 1.1, p.x)); p.z = Math.max(this.cz - 1.1, Math.min(this.cz + 1.0, p.z)); me.animate(0, dt, false); return this.state === 'idle' && this.open > 0.9; }, onEnd: onArrive };
  }
  update(dt) {
    if (this.state === 'closing') { this.open = Math.max(0, this.open - dt * 2.2); if (this.open === 0) this.state = 'moving'; }
    else if (this.state === 'moving') {
      const ty = this.b.floorY(this.target), d = ty - this.y, step = Math.sign(d) * Math.min(Math.abs(d), this.speed * dt * Math.min(1, 0.4 + Math.abs(d) / 3));
      this.y += step; this.level = this.b.levelAt(this.y + 0.01);
      if (Math.abs(ty - this.y) < 0.005) { this.y = ty; this.level = this.target; this.state = 'opening'; this.b.world.onElevatorDing && this.b.world.onElevatorDing(); }
    } else if (this.state === 'opening') { this.open = Math.min(1, this.open + dt * 2.2); if (this.open === 1) this.state = 'idle'; }
    this.cab.position.y = this.y;
    for (const d of this.doors) { const o = d.lv === this.level && this.state !== 'moving' ? this.open : 0; d.L.position.x = this.cx - 0.75 - o * 1.4; d.R.position.x = this.cx + 0.75 + o * 1.4; }
  }
}

// ---------------- Banda Tower ----------------
export const FLOORS = ['f_lobby', 'f_pool', 'f_lab', 'f_hotel', 'f_spa', 'f_cinema', 'f_arcade', 'f_games'];

export class Tower extends Building {
  constructor(world, h) {
    const T = TOWER;
    super(world, { x: T.x, z: T.z, w: T.w, d: T.d, floors: T.floors, fh: T.fh, base: T.base, door: { side: 's', at: T.x, width: 6 } });
    this.h = h; // hooks from main: { station(lv, kind, x, z), pad(lv, type, x, z), panel(elev), t }
    this.shell(); this.slabs();
    this.elevators = [new Elevator(this, T.x - 5, this.minZ + 1.9, e => h.panel(e)), new Elevator(this, T.x + 5, this.minZ + 1.9, e => h.panel(e))];
    for (const ex of [-5, 5]) for (let lv = 0; lv < this.floors; lv++) { this.block(lv, T.x + ex - 1.72, this.minZ + 1.9, 0.1, 1.8); this.block(lv, T.x + ex + 1.72, this.minZ + 1.9, 0.1, 1.8); }
    [this.lobby, this.pool, this.lab, this.hotel, this.spa, this.cinema, this.arcade, this.games].forEach((f, lv) => { f.call(this, lv); this.floorSign(lv); });
    // interior lights follow the floor you're on
    for (let i = 0; i < 3; i++) { const l = new THREE.PointLight(0xfff1dc, 0, 28, 1.5); world.scene.add(l); this.lights.push(l); }
  }
  // glass curtain wall, white floor bands, mullions, rooftop crown and sign
  shell() {
    const { x, z, w, d, base, fh, floors, minX, maxX, minZ, maxZ } = this, H = floors * fh, S = this.world.scene, glass = glassMat();
    const panel = (cx, cy, cz, pw, ph, rotY) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), glass); m.position.set(cx, cy, cz); m.rotation.y = rotY; m.renderOrder = 2; S.add(m); };
    panel(x, base + H / 2, minZ, w, H, 0); panel(minX, base + H / 2, z, d, H, Math.PI / 2); panel(maxX, base + H / 2, z, d, H, Math.PI / 2);
    panel(x, base + fh + (H - fh) / 2, maxZ, w, H - fh, 0);
    panel(x - 3 - (w / 2 - 3) / 2, base + fh / 2, maxZ, w / 2 - 3, fh, 0); panel(x + 3 + (w / 2 - 3) / 2, base + fh / 2, maxZ, w / 2 - 3, fh, 0);
    const white = std(0xeef0f2, { roughness: 0.4 }), dark = std(0x23272d, { metalness: 0.8, roughness: 0.3 });
    for (let lv = 1; lv <= floors; lv++) {
      const y = base + lv * fh;
      const band = new THREE.Mesh(new RoundedBox(w + 1.2, 0.55, d + 1.2, 2, 0.2), white); band.position.set(x, y - 0.1, z); band.castShadow = band.receiveShadow = true; S.add(band);
    }
    for (let k = 0; k <= 11; k++) { const mx = minX + k * w / 11; for (const mz of [minZ, maxZ]) { if (mz === maxZ && Math.abs(mx - x) < 3.2) continue; const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, H, 0.18), dark); m.position.set(mx, base + H / 2, mz); S.add(m); } }
    for (let k = 0; k <= 7; k++) { const mz = minZ + k * d / 7; for (const mx of [minX, maxX]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.18, H, 0.12), dark); m.position.set(mx, base + H / 2, mz); S.add(m); } }
    // crown: set-back penthouse, LED sign, antenna, helipad
    const top = base + H;
    const crown = new THREE.Mesh(new RoundedBox(w - 10, 4, d - 8, 3, 0.6), std(0x1d2128, { metalness: 0.7, roughness: 0.25 })); crown.position.set(x, top + 2.2, z); crown.castShadow = true; S.add(crown);
    const signT = canvasTex(1024, 192, (g, W, Hh) => { g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, W, Hh); g.font = '800 128px Manrope, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.shadowColor = '#36c2ff'; g.shadowBlur = 30; g.fillStyle = '#e9f8ff'; g.fillText('BANDA TOWER', W / 2, Hh / 2 + 6); });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.9), new THREE.MeshBasicMaterial({ map: signT, transparent: true, depthWrite: false })); sign.position.set(x, top + 2.4, z + (d - 8) / 2 + 0.05); S.add(sign);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.25, 12, 8), dark); ant.position.set(x + 10, top + 10, z - 6); S.add(ant);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), std(0xff2a2a, { emissive: 0xff0000, emissiveIntensity: 3 })); beacon.position.set(x + 10, top + 16.2, z - 6); S.add(beacon);
    this.world.updaters.push((dt, t) => { beacon.visible = Math.sin(t * 4) > 0; });
    const heli = new THREE.Mesh(new THREE.CircleGeometry(5, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, g => { g.fillStyle = '#2b2f36'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#ffd34d'; g.lineWidth = 10; g.beginPath(); g.arc(128, 128, 110, 0, 7); g.stroke(); g.fillStyle = '#fff'; g.font = '900 140px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('H', 128, 136); }) }));
    heli.position.set(x - 8, top + 4.25, z); S.add(heli);
    // entrance canopy and sliding glass doors
    const canopy = new THREE.Mesh(new RoundedBox(14, 0.4, 6, 2, 0.15), white); canopy.position.set(x, base + 4.4, maxZ + 3); canopy.castShadow = true; S.add(canopy);
    for (const sx of [-6.5, 6.5]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.4, 12), dark); p.position.set(x + sx, base + 2.2, maxZ + 5.6); S.add(p); this.world.solids.push({ x: x + sx, z: maxZ + 5.6, r: 0.25 }); }
    const dl = new THREE.Mesh(new THREE.BoxGeometry(3, 3.4, 0.08), glassMat()), dr = dl.clone(); S.add(dl, dr);
    const name = labelSprite('BANDA TOWER', 0.9, { bg: null, weight: 800 }); name.position.set(x, base + 5.2, maxZ + 6.05); S.add(name);
    this.world.updaters.push(() => {
      const p = this.world.me?.group.position, near = p && Math.abs(p.x - x) < 4 && Math.abs(p.z - maxZ) < 5 && p.y < base + 2 ? 1 : 0;
      this.doorOpen = (this.doorOpen || 0) + (near - (this.doorOpen || 0)) * 0.12;
      dl.position.set(x - 1.5 - this.doorOpen * 2.9, base + 1.7, maxZ); dr.position.set(x + 1.5 + this.doorOpen * 2.9, base + 1.7, maxZ);
    });
  }
  // floor slabs with openings for the two elevator shafts, ceilings with lights
  slabs() {
    const { x, w, d, minX, maxX, minZ, maxZ, floors } = this, S = this.world.scene;
    const floorMats = [TEX.tile, TEX.tile, TEX.wood, TEX.wood, TEX.wood, TEX.wood, TEX.tile, TEX.tile].map((t, i) => this.world.texMat(t, w, d, { color: [0xf2efe8, 0xd6eef5, 0xdcd3c4, 0xb08a64, 0xc9b49a, 0x6e4c38, 0x2a2440, 0x1e2a36][i], roughness: i === 6 || i === 7 ? 0.3 : 0.55 }));
    const lamp = std(0xffffff, { emissive: 0xfff4e4, emissiveIntensity: 1.8 });
    const shaftZ0 = minZ, shaftZ1 = minZ + 3.6;
    for (let lv = 0; lv <= floors; lv++) {
      const y = this.base + lv * this.fh, mat = lv < floors ? floorMats[lv] : std(0x8a8f96);
      const piece = (x0, x1, z0, z1) => { const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, 0.32, z1 - z0), mat); m.position.set((x0 + x1) / 2, y - 0.16, (z0 + z1) / 2); m.castShadow = lv > 0; m.receiveShadow = true; S.add(m); };
      piece(minX, maxX, shaftZ1, maxZ);
      if (lv === 0) piece(minX, maxX, shaftZ0, shaftZ1);
      else { piece(minX, x - 6.6, shaftZ0, shaftZ1); piece(x - 3.4, x + 3.4, shaftZ0, shaftZ1); piece(x + 6.6, maxX, shaftZ0, shaftZ1); }
      if (lv > 0) for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.06, 1.2), lamp); l.position.set(minX + 5.5 + i * 11, y - 0.35, minZ + 8 + k * 8); S.add(l); }
    }
    // glass shaft fronts above the doors
    for (const ex of [-5, 5]) for (const sx of [-1.72, 1.72]) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, floors * this.fh, 3.6), std(0x2b3038, { metalness: 0.7 })); m.position.set(x + ex + sx, this.base + floors * this.fh / 2, minZ + 1.9); S.add(m); }
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
  // 4: hotel corridor with rooms
  hotel(lv) {
    const { x, z, minX, maxX, minZ, maxZ } = this, y = this.floorY(lv), wallM = std(0xe8e1d6);
    for (let i = 0; i < 4; i++) {
      const rx = minX + 5.5 + i * 11;
      for (const side of [-1, 1]) {
        const rz = side < 0 ? minZ + 8 : maxZ - 5, wz = side < 0 ? minZ + 11 : maxZ - 8.6;
        if (side < 0 && Math.abs(rx - x) < 9) continue; // elevator lobby
        const wall = this.add(new THREE.Mesh(new THREE.BoxGeometry(11, 3.6, 0.2), wallM)); wall.position.set(rx, y + 1.8, wz);
        this.block(lv, rx - 3.3, wz, 2.2, 0.15); this.block(lv, rx + 3.3, wz, 2.2, 0.15);
        const sep = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 3.6, 6), wallM)); sep.position.set(rx + 5.5, y + 1.8, rz); this.block(lv, rx + 5.5, rz, 0.15, 3);
        const bed = this.add(new THREE.Mesh(new RoundedBox(2.4, 0.6, 3, 2, 0.12), std(0xffffff, { roughness: 0.9 }))); bed.position.set(rx - 2.5, y + 0.3, rz + side * -0.5);
        const blanket = this.add(new THREE.Mesh(new RoundedBox(2.45, 0.1, 1.8, 2, 0.05), std([0x3b5b8f, 0x8f3b5b, 0x3b8f6b, 0x8f7a3b][i]))); blanket.position.set(rx - 2.5, y + 0.62, rz + side * -0.5 + 0.5 * side);
        const lampG = this.add(new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 10), std(0xfff1cf, { emissive: 0xffd28a, emissiveIntensity: 2 }))); lampG.position.set(rx - 0.5, y + 1.0, rz);
        this.block(lv, rx - 2.5, rz + side * -0.5, 1.2, 1.5);
        this.world.zone({ test: (px, py, pz) => Math.abs(px - (rx - 2.5)) < 1.6 && Math.abs(pz - (rz + side * -0.5)) < 2.0 && Math.abs(py - y) < 1, onEnter: () => this.h.rest && this.h.rest() });
        const num = labelSprite(`${lv + 1}0${i * 2 + (side > 0 ? 2 : 1)}`, 0.3); num.position.set(rx, y + 2.9, wz + side * -0.15); this.world.scene.add(num);
      }
    }
  }
  // 5: spa & café
  spa(lv) {
    const { x, z, minX, maxX, maxZ } = this, y = this.floorY(lv);
    const tub = this.add(new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.8, 32), std(0xf2f2f2, { roughness: 0.3 }))); tub.position.set(x - 10, y + 0.4, z + 4);
    const tw = this.add(new THREE.Mesh(new THREE.CircleGeometry(2.7, 32).rotateX(-Math.PI / 2), std(0x7fd6e8, { transparent: true, opacity: 0.7, roughness: 0.05, emissive: 0x0a3a44 })), false); tw.position.set(x - 10, y + 0.82, z + 4);
    this.block(lv, x - 10, z + 4, 2.2, 2.2);
    this.world.zone({ test: (px, py, pz) => Math.hypot(px - (x - 10), pz - (z + 4)) < 3.6 && Math.abs(py - y) < 1, onEnter: () => this.h.rest && this.h.rest('spa') });
    this.box(lv, maxX - 7, 0.6, z + 2, 9, 1.2, 1.4, std(0x6b4a2f, { roughness: 0.5 }), true, 0.1);
    for (let i = 0; i < 3; i++) { const cup = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.2, 12), std(0xffffff))); cup.position.set(maxX - 9 + i * 2, y + 1.3, z + 2); }
    const menu = labelSprite('CAFÉ', 0.6, { bg: 'rgba(60,40,25,0.9)' }); menu.position.set(maxX - 7, y + 3, z + 0.5); this.world.scene.add(menu);
    this.world.zone({ test: (px, py, pz) => Math.abs(px - (maxX - 7)) < 4.5 && pz > z + 2.8 && pz < z + 5 && Math.abs(py - y) < 1, onEnter: () => this.h.cafe && this.h.cafe() });
    for (let i = 0; i < 3; i++) this.sofa(lv, x + 2 + i * 4, maxZ - 3, Math.PI, 0xc9b59a);
    this.plant(lv, minX + 1.5, maxZ - 1.5); this.plant(lv, x - 4, maxZ - 2);
  }
  // 6: cinema lounge
  cinema(lv) {
    const { x, z, minX, maxX } = this, y = this.floorY(lv);
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d'), tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = this.add(new THREE.Mesh(new THREE.PlaneGeometry(14, 7), new THREE.MeshBasicMaterial({ map: tex })), false); scr.position.set(minX + 0.3, y + 3.2, z + 1); scr.rotation.y = Math.PI / 2;
    let tt = 0; this.world.updaters.push(dt => { tt += dt; if ((tt * 10 | 0) % 2) return; const p = this.world.me?.group.position; if (!p || Math.abs(p.y - y) > 3) return;
      const gr = g.createLinearGradient(0, 0, 512, 256); gr.addColorStop(0, `hsl(${(tt * 30) % 360},70%,45%)`); gr.addColorStop(1, `hsl(${(tt * 30 + 120) % 360},70%,30%)`); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 6; i++) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(256 + Math.cos(tt + i) * 160, 128 + Math.sin(tt * 1.3 + i * 2) * 80, 18 + i * 4, 0, 7); g.fill(); }
      g.fillStyle = '#fff'; g.font = '700 34px Manrope, system-ui'; g.textAlign = 'center'; g.fillText('NOW SHOWING: OCEAN WONDERS', 256, 236); tex.needsUpdate = true; });
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
    ['impostor', 'quiz', 'hide', 'starhunt', 'football', 'dodgeball'].forEach((g, i) => this.h.pad(this, lv, g, x - 15 + (i % 3) * 15, z + (i < 3 ? -2 : 7)));
  }

  update(p) {
    // move the interior lights to the floor you're on
    const inside = this.contains(p.x, p.z) && p.y > this.base - 2 && p.y < this.base + this.floors * this.fh;
    const lv = this.levelAt(p.y), y = this.floorY(lv) + 3.8;
    this.lights.forEach((l, i) => { l.intensity = inside ? 22 : 0; l.position.set(this.x - 14 + i * 14, y, this.z); });
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
    const facade = this.world.texMat(TEX.concrete, w, H, { color: 0xf4f1ea });
    const box = (cx, cy, cz, ww, hh, dd, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), m); o.position.set(cx, cy, cz); o.castShadow = o.receiveShadow = true; S.add(o); return o; };
    box(x, base + H / 2, minZ, w, H, 0.3, facade); box(x, base + H / 2, maxZ, w, H, 0.3, facade); box(minX, base + H / 2, z, 0.3, H, d, facade);
    const g = glassMat(), da = this.door.at - 2.5, db = this.door.at + 2.5;
    const gp = (z0, z1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0, H - 1), g); m.position.set(maxX, base + (H - 1) / 2, (z0 + z1) / 2); m.rotation.y = Math.PI / 2; S.add(m); };
    gp(minZ, da); gp(db, maxZ); box(maxX, base + H - 0.5, z, 0.4, 1, d, std(0x2e8b57));
    const roof = box(x, base + H, z, w + 0.6, 0.4, d + 0.6, std(0x9aa0a6)); roof.castShadow = true;
    const floor = box(x, base - 0.05, z, w, 0.12, d, this.world.texMat(TEX.tile, w, d, { color: 0xf4f4f0, roughness: 0.3 }));
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
      const shelf = box(sx, base + 1.1, sz, 1.0, 2.2, 13, std(0xdedad2, { roughness: 0.5 }));
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
