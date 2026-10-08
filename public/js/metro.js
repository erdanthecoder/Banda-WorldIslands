// Banda Metro: underground platform, train, and rides between island stations.
import * as THREE from 'three';
import { TEX, labelSprite, canvasTex } from './world.js';

export const METRO = { x: 900, z: 0, y: -60 };

export class Metro {
  constructor(world, label) {
    this.w = world; const S = world.scene, { x, z, y } = METRO;
    const L = 46; // platform length
    this.interior = world.addInterior({ minX: x - L / 2, maxX: x + L / 2, minZ: z - 3.4, maxZ: z + 3.1, floor: y, ceil: 4.6 });
    const tile = world.texMat(TEX.tile, L, 6, { roughness: 0.5 });
    const wallT = world.texMat(TEX.tile, L, 5, { color: 0xe7ecef, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.95 });
    const add = (geo, mat, px, py, pz, cast = false) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.receiveShadow = true; m.castShadow = cast; S.add(m); return m; };
    add(new THREE.BoxGeometry(L, 0.4, 7), tile, x, y - 0.2, z);                    // platform
    add(new THREE.BoxGeometry(L, 0.06, 0.4), new THREE.MeshStandardMaterial({ color: 0xf2c200 }), x, y + 0.01, z + 3.2); // safety line
    add(new THREE.BoxGeometry(L, 5, 0.3), wallT, x, y + 2.3, z - 3.6);            // back wall
    add(new THREE.BoxGeometry(700, 0.3, 14), dark, x - 300, y + 4.8, z + 2);      // ceiling (runs over the tunnel)
    add(new THREE.BoxGeometry(700, 0.4, 7), dark, x - 300, y - 1.3, z + 7);       // track bed
    add(new THREE.BoxGeometry(700, 6.5, 0.3), dark, x - 300, y + 1.6, z + 10.3);  // far tunnel wall
    add(new THREE.BoxGeometry(700 - L, 6, 0.3), dark, x - 300 - L / 2, y + 1.6, z - 3.6);
    for (const s of [-1, 1]) add(new THREE.BoxGeometry(0.3, 6.5, 14), dark, x + s * (s > 0 ? 50 : 650), y + 1.6, z + 3);
    for (const rz of [5.9, 7.4]) add(new THREE.BoxGeometry(700, 0.12, 0.1), new THREE.MeshStandardMaterial({ color: 0x8d8d8d, metalness: 0.9, roughness: 0.3 }), x - 300, y - 1.0, z + rz);
    // lights: ceiling strips + tunnel lamps every 12 m
    const lampM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 2.5 });
    for (let i = -L / 2 + 3; i < L / 2; i += 6) add(new THREE.BoxGeometry(3, 0.08, 0.3), lampM, x + i, y + 4.55, z);
    for (let i = 0; i < 55; i++) add(new THREE.BoxGeometry(0.5, 0.2, 0.2), new THREE.MeshStandardMaterial({ color: 0xffd9a0, emissive: 0xffb860, emissiveIntensity: 3 }), x - L / 2 - 6 - i * 12, y + 3.6, z + 10.1);
    this.lights = [];
    for (const lx of [-14, 0, 14]) { const pl = new THREE.PointLight(0xfff2de, 0, 30, 1.6); pl.position.set(x + lx, y + 4, z); S.add(pl); this.lights.push(pl); }
    // benches, signs, route map
    for (const bx of [-12, 12]) { world.box(x + bx, y + 0.45, z - 2.9, 3, 0.12, 0.6, { color: 0x6b4a2f }); world.box(x + bx, y + 0.22, z - 2.9, 2.8, 0.45, 0.1, { color: 0x30343a }); }
    const map = canvasTex(1024, 256, (g, W, H) => {
      g.fillStyle = '#f7f7f5'; g.fillRect(0, 0, W, H); g.fillStyle = '#1b1d22'; g.font = '600 40px system-ui'; g.fillText('BANDA METRO', 40, 60);
      g.strokeStyle = '#c8102e'; g.lineWidth = 14; g.beginPath(); g.moveTo(80, 160); g.lineTo(W - 80, 160); g.stroke();
      label.stations.forEach((s, i, a) => { const px = 80 + i * (W - 160) / (a.length - 1); g.fillStyle = '#fff'; g.strokeStyle = '#1b1d22'; g.lineWidth = 6; g.beginPath(); g.arc(px, 160, 16, 0, 7); g.fill(); g.stroke(); g.fillStyle = '#1b1d22'; g.font = '500 26px system-ui'; g.textAlign = 'center'; g.fillText(s, px, 215); });
    });
    add(new THREE.PlaneGeometry(8, 2), new THREE.MeshStandardMaterial({ map, roughness: 0.6 }), x, y + 2.6, z - 3.44);
    const mSign = labelSprite('Ⓜ  ' + label.title, 0.6, { bg: 'rgba(200,16,46,0.95)' }); mSign.position.set(x - 16, y + 3.6, z - 3.3); S.add(mSign);
    // train
    const carT = canvasTex(512, 128, (g, W, H) => {
      g.fillStyle = '#d8dcdf'; g.fillRect(0, 0, W, H); g.fillStyle = '#c8102e'; g.fillRect(0, 88, W, 14);
      for (let i = 0; i < 6; i++) { g.fillStyle = '#1b2530'; g.fillRect(20 + i * 82, 22, 64, 50); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(20 + i * 82, 22, 20, 50); }
    });
    const bodyM = new THREE.MeshStandardMaterial({ map: carT, metalness: 0.4, roughness: 0.35 });
    const endM = new THREE.MeshStandardMaterial({ color: 0xc9cdd1, metalness: 0.4, roughness: 0.4 });
    const inner = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.7, side: THREE.BackSide });
    this.train = new THREE.Group();
    for (let c = 0; c < 3; c++) {
      const car = new THREE.Mesh(new THREE.BoxGeometry(14, 3, 3), [endM, endM, endM, endM, bodyM, bodyM]); car.position.set(c * 14.6, 0, 0); car.castShadow = true;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(13.6, 2.6, 2.6), inner); cab.position.copy(car.position);
      const seatM = new THREE.MeshStandardMaterial({ color: 0x2b4a7a });
      for (let s = -5; s <= 5; s += 2) { const seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.4, 0.5), seatM); seat.position.set(c * 14.6 + s, -0.9, -0.95); this.train.add(seat); }
      const cl = new THREE.Mesh(new THREE.BoxGeometry(12, 0.05, 0.2), lampM); cl.position.set(c * 14.6, 1.25, 0); this.train.add(cl);
      this.train.add(car, cab);
    }
    this.train.position.set(x + 200, y + 0.6, z + 6.6); S.add(this.train);
    this.trainLight = new THREE.PointLight(0xfff2de, 0, 18, 1.5); this.trainLight.position.set(14.6, 0.8, 0); this.train.add(this.trainLight);
    this.boardPoint = { x: x, z: z + 2.6, y, label: label.board, action: { board: true }, group: new THREE.Group() };
    { const bl = labelSprite(label.board, 0.45); bl.position.set(0, 2.4, 0); this.boardPoint.group.add(bl); }
    this.boardPoint.group.position.set(x, y, z + 2.6); S.add(this.boardPoint.group);
    world.portals.push(this.boardPoint);
    this.state = 'away';
  }

  setLit(on) { this.lights.forEach(l => (l.intensity = on ? 25 : 0)); this.trainLight.intensity = on ? 8 : 0; }

  // Walk down from a station: arrive on the platform, train pulls in.
  enter() {
    const { x, z, y } = METRO;
    this.setLit(true);
    this.w.teleport(x + 8, z - 1, Math.PI / 2, y);
    this.train.position.x = x + 180; this.state = 'arriving';
    const t0 = performance.now();
    this.w.updaters.push(() => { const t = (performance.now() - t0) / 1000; const k = Math.min(1, t / 6), e = 1 - Math.pow(1 - k, 3); this.train.position.x = x + 180 - e * (180 + 14.6); if (k >= 1) { this.state = 'docked'; this.onDocked && this.onDocked(); return true; } });
  }

  // Ride to a destination; calls done() when it's time to come up at the destination.
  ride(done) {
    const w = this.w, { x, y, z } = METRO;
    w.inputLocked = true; w.me.group.visible = false;
    const start = this.train.position.x, t0 = performance.now();
    w.cameraOverride = (cam) => { cam.position.set(this.train.position.x + 3, this.train.position.y + 0.4, this.train.position.z + 0.6); cam.lookAt(this.train.position.x - 30, this.train.position.y + 0.2, this.train.position.z - 1.2); };
    w.updaters.push(() => {
      const t = (performance.now() - t0) / 1000, a = Math.min(t, 2.5) / 2.5;
      this.train.position.x = start - (t < 2.5 ? 18 * a * t / 2 : 22.5 + (t - 2.5) * 40);
      if (t > 6.2) {
        w.cameraOverride = null; w.me.group.visible = true; w.inputLocked = false; this.setLit(false);
        this.train.position.x = x + 200; this.state = 'away'; done(); return true;
      }
    });
  }
}
