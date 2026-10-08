// Banda Metro: one underground platform model reused for every station. Trains arrive on their own;
// walk into an open train to choose a stop, walk into the exit stairs to go up.
import * as THREE from 'three';
import { TEX, labelSprite, canvasTex } from './world.js';

export const METRO = { x: 900, z: 0, y: -60 };
const L = 50; // platform length

export class Metro {
  constructor(world, { title, stations, onBoard, onExit }) {
    this.w = world; this.onBoard = onBoard; this.onExit = onExit;
    const S = world.scene, { x, z, y } = METRO;
    this.interior = world.addInterior({ minX: x - L / 2, maxX: x + L / 2, minZ: z - 3.4, maxZ: z + 3.1, floor: y, ceil: 4.6 });
    const tile = world.texMat(TEX.tile, L, 6, { roughness: 0.35, metalness: 0.05 });
    const wallT = world.texMat(TEX.tile, L, 5, { color: 0xe9eef2, roughness: 0.3 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x24262a, roughness: 0.95 });
    const conc = world.texMat(TEX.concrete, 60, 6, { color: 0x55585c });
    const add = (geo, mat, px, py, pz, cast = false) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.receiveShadow = true; m.castShadow = cast; S.add(m); return m; };
    add(new THREE.BoxGeometry(L, 0.4, 7), tile, x, y - 0.2, z);
    add(new THREE.BoxGeometry(L, 0.06, 0.45), new THREE.MeshStandardMaterial({ color: 0xf2c200, roughness: 0.6 }), x, y + 0.01, z + 3.15);
    add(new THREE.BoxGeometry(L, 5, 0.3), wallT, x, y + 2.3, z - 3.6);
    add(new THREE.BoxGeometry(800, 0.3, 14), conc, x - 350, y + 4.8, z + 2);
    add(new THREE.BoxGeometry(800, 0.4, 7), dark, x - 350, y - 1.3, z + 7);
    add(new THREE.BoxGeometry(800, 6.5, 0.3), conc, x - 350, y + 1.6, z + 10.3);
    add(new THREE.BoxGeometry(800 - L, 6, 0.3), conc, x - 350 - L / 2, y + 1.6, z - 3.6);
    add(new THREE.BoxGeometry(0.3, 6.5, 14), conc, x + L / 2 + 0.2, y + 1.6, z + 3);
    for (const rz of [5.9, 7.4]) add(new THREE.BoxGeometry(800, 0.12, 0.1), new THREE.MeshStandardMaterial({ color: 0x8d8d8d, metalness: 0.95, roughness: 0.25 }), x - 350, y - 1.0, z + rz);
    for (let i = 0; i < 80; i++) add(new THREE.BoxGeometry(0.25, 0.1, 2.4), new THREE.MeshStandardMaterial({ color: 0x3b2e24 }), x + L / 2 - i * 10, y - 1.08, z + 6.65);
    // lights
    const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 3 });
    for (let i = -L / 2 + 3; i < L / 2; i += 5) add(new THREE.BoxGeometry(3, 0.08, 0.3), lampM, x + i, y + 4.55, z);
    const tunnelLamp = new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb860, emissiveIntensity: 4 });
    for (let i = 0; i < 65; i++) add(new THREE.BoxGeometry(0.5, 0.2, 0.2), tunnelLamp, x - L / 2 - 6 - i * 12, y + 3.6, z + 10.1);
    this.lights = [];
    for (const lx of [-16, 0, 16]) { const pl = new THREE.PointLight(0xfff2de, 0, 30, 1.6); pl.position.set(x + lx, y + 4, z); S.add(pl); this.lights.push(pl); }
    // benches, columns, ads, route map
    for (const bx of [-14, 8]) { world.box(x + bx, y + 0.45, z - 2.9, 3, 0.12, 0.6, { map: TEX.wood }); world.box(x + bx, y + 0.22, z - 2.9, 2.8, 0.45, 0.1, { color: 0x30343a, metalness: 0.6 }); this.interior.walls = (this.interior.walls || []).concat({ x: x + bx, z: z - 2.9, hw: 1.5, hd: 0.35 }); }
    for (let i = -L / 2 + 8; i < L / 2 - 6; i += 10) { add(new THREE.CylinderGeometry(0.3, 0.3, 4.6, 16), new THREE.MeshStandardMaterial({ color: 0xd5d8dc, roughness: 0.3, metalness: 0.2 }), x + i, y + 2.3, z + 0.4, true); this.interior.walls.push({ x: x + i, z: z + 0.4, hw: 0.32, hd: 0.32 }); }
    const map = canvasTex(1024, 256, (g, W) => {
      g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, W, 256); g.fillStyle = '#1b1d22'; g.font = '700 40px Manrope, system-ui'; g.fillText(title.toUpperCase(), 40, 60);
      g.strokeStyle = '#c8102e'; g.lineWidth = 14; g.beginPath(); g.moveTo(80, 160); g.lineTo(W - 80, 160); g.stroke();
      stations.forEach((s, i, a) => { const px = 80 + i * (W - 160) / (a.length - 1); g.fillStyle = '#fff'; g.strokeStyle = '#1b1d22'; g.lineWidth = 6; g.beginPath(); g.arc(px, 160, 16, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#1b1d22'; g.font = '500 24px Manrope, system-ui'; g.textAlign = 'center'; g.fillText(s, px, 215); });
    });
    add(new THREE.PlaneGeometry(8, 2), new THREE.MeshStandardMaterial({ map, roughness: 0.6 }), x - 4, y + 2.6, z - 3.44);
    this.signs = [-18, 16].map(sx => { const s = labelSprite('', 0.6); s.position.set(x + sx, y + 3.4, z - 3.3); S.add(s); return s; });
    // exit stairs at the east end
    const stairM = new THREE.MeshStandardMaterial({ color: 0x8e8b84, roughness: 0.85 });
    for (let i = 0; i < 10; i++) add(new THREE.BoxGeometry(0.5, 0.25 + i * 0.3, 3.2), stairM, x + L / 2 - 3.6 + i * 0.4, y + (0.25 + i * 0.3) / 2, z - 1.6);
    const exit = labelSprite('↑ EXIT', 0.55, { bg: 'rgba(20,120,60,0.95)' }); exit.position.set(x + L / 2 - 2.5, y + 3.6, z - 1.6); S.add(exit); this.exitSign = exit;
    world.zone({ test: (px, py, pz) => py < y + 5 && py > y - 2 && px > x + L / 2 - 3.8 && pz < z, onEnter: () => this.onExit() });
    // train
    const carT = canvasTex(512, 128, (g, W, H) => {
      const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#e9ecef'); gr.addColorStop(1, '#b9bec4'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      g.fillStyle = '#c8102e'; g.fillRect(0, 92, W, 12);
      for (let i = 0; i < 6; i++) { g.fillStyle = '#16202a'; g.fillRect(16 + i * 84, 20, 66, 54); g.fillStyle = 'rgba(255,240,210,0.35)'; g.fillRect(16 + i * 84, 20, 66, 54); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(16 + i * 84, 20, 18, 54); }
    }, null);
    carT.wrapS = carT.wrapT = THREE.ClampToEdgeWrapping;
    const bodyM = new THREE.MeshStandardMaterial({ map: carT, metalness: 0.5, roughness: 0.3 });
    const endM = new THREE.MeshStandardMaterial({ color: 0xc9cdd1, metalness: 0.5, roughness: 0.35 });
    const inner = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.7, side: THREE.BackSide });
    this.train = new THREE.Group();
    for (let c = 0; c < 3; c++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 3), [endM, endM, endM, endM, bodyM, bodyM]); car.position.set(c * 14.6, 0, 0); car.castShadow = true;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(13.6, 2.6, 2.6), inner); cab.position.copy(car.position);
      const seatM = new THREE.MeshStandardMaterial({ color: 0x2b4a7a, roughness: 0.7 });
      for (let s2 = -5; s2 <= 5; s2 += 2) { const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.5), seatM); seat.position.set(c * 14.6 + s2, -0.9, -0.95); this.train.add(seat); }
      const cl = new THREE.Mesh(new THREE.BoxGeometry(12, 0.05, 0.2), lampM); cl.position.set(c * 14.6, 1.25, 0); this.train.add(cl);
      this.train.add(car, cab);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff6d0, emissiveIntensity: 6 })); head.position.set(-7.1, -0.6, 0); this.train.add(head);
    this.dockX = x - 14.6; this.awayX = x + 220;
    this.train.position.set(this.awayX, y + 0.6, z + 6.6); S.add(this.train);
    this.trainLight = new THREE.PointLight(0xfff2de, 0, 18, 1.5); this.trainLight.position.set(14.6, 0.8, 0); this.train.add(this.trainLight);
    world.zone({ test: (px, py, pz) => this.state === 'docked' && py < y + 3 && py > y - 1 && pz > z + 2.7 && px > this.dockX - 7 && px < this.dockX + 36, onEnter: () => this.onBoard() });
    this.state = 'away'; this.t0 = performance.now(); this.active = false;
    world.updaters.push(() => this._cycle());
  }

  setLit(on) { this.active = on; this.lights.forEach(l => (l.intensity = on ? 28 : 0)); this.trainLight.intensity = on ? 8 : 0; }
  setStation(name) { this.signs.forEach(s => { const n = labelSprite('Ⓜ  ' + name, 0.6, { bg: 'rgba(200,16,46,0.95)' }); s.material = n.material; s.scale.copy(n.scale); }); }

  // automatic timetable: away 3 s → arriving 6 s → docked 14 s → leaving 5 s
  _cycle() {
    if (!this.active || this.riding) return;
    const t = (performance.now() - this.t0) / 1000, tr = this.train.position;
    const ease = k => 1 - Math.pow(1 - Math.min(1, k), 3);
    if (this.state === 'away' && t > 3) this.go('arriving');
    else if (this.state === 'arriving') { tr.x = this.awayX - ease(t / 6) * (this.awayX - this.dockX); if (t > 6) { this.go('docked'); this.onDocked && this.onDocked(); } }
    else if (this.state === 'docked' && t > 14) this.go('leaving');
    else if (this.state === 'leaving') { tr.x = this.dockX - Math.pow(t / 5, 2) * 200; if (t > 5) { tr.x = this.awayX; this.go('away'); } }
  }
  go(s) { this.state = s; this.t0 = performance.now(); }

  enter(stationName, atExit) {
    const { x, z, y } = METRO;
    this.setLit(true); this.setStation(stationName);
    if (atExit) this.w.teleport(x + L / 2 - 6, z - 1.6, -Math.PI / 2, y); // arriving from street level
    if (this.state === 'away' || this.state === 'leaving') { this.train.position.x = this.awayX; this.go('away'); }
  }
  leave() { this.setLit(false); }

  // Ride: camera inside the train through the tunnel, then done().
  ride(done) {
    const w = this.w, tr = this.train.position;
    this.riding = true; w.inputLocked = true; w.me.group.visible = false;
    const start = tr.x, t0 = performance.now();
    w.cameraOverride = cam => { cam.position.set(tr.x + 3, tr.y + 0.4, tr.z + 0.6); cam.lookAt(tr.x - 30, tr.y + 0.2, tr.z - 1.2); };
    w.updaters.push(() => {
      const t = (performance.now() - t0) / 1000;
      tr.x = start - (t < 2.5 ? 3.6 * t * t : 22.5 + (t - 2.5) * 40);
      if (t > 6.5) {
        w.cameraOverride = null; w.me.group.visible = true; w.inputLocked = false; this.riding = false;
        tr.x = this.dockX; this.go('docked'); done(); return true;
      }
    });
  }
}
