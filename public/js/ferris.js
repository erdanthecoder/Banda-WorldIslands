// 🎡 The Ferris wheel: buy a $2 ticket with mPAY at the gate, ride a gondola all the way round
// and look out over the whole island. Jump (Space) to hop off early.
import * as THREE from 'three';
import { FERRIS, heightAt, labelSprite } from './world.js';
import { Bodies } from './crowd.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });
const N = 12, LAP = 55; // gondolas, seconds per turn
const COLORS = [0xff3fa4, 0xffd34d, 0x2ec4b6, 0x3a86ff, 0xff9f1c, 0x7b2cbf];

export class Ferris {
  constructor(world, h) {
    this.w = world; this.h = h; const F = FERRIS, S = world.scene;
    this.y0 = heightAt(F.x, F.z); this.hub = new THREE.Vector3(F.x, this.y0 + F.hub, F.z); this.rot = 0;
    const steel = std(0xe8edf2, { metalness: 0.7, roughness: 0.3 });
    const beam = (a, b, r, m) => { const d = new THREE.Vector3().subVectors(b, a), c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), m); c.position.copy(a).addScaledVector(d, 0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); c.castShadow = true; S.add(c); return c; };
    // A-frame legs on both sides, a base and the axle
    // the wheel faces the path (west), so it turns round an east-west axle
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) beam(new THREE.Vector3(F.x + sx * 2.6, this.y0, F.z + sz * 7), new THREE.Vector3(F.x + sx * 1.1, this.hub.y, F.z), 0.28, steel);
    beam(new THREE.Vector3(F.x - 1.4, this.hub.y, F.z), new THREE.Vector3(F.x + 1.4, this.hub.y, F.z), 0.5, std(0x23324a, { metalness: 0.6 }));
    const base = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.3, 16), std(0x9aa3ad, { roughness: 0.8 })); base.position.set(F.x, this.y0 + 0.15, F.z); base.receiveShadow = true; S.add(base);
    for (const sz of [-1, 1]) world.solids.push({ x: F.x, z: F.z + sz * 7, hw: 3, hd: 0.5, rot: 0 });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.85, 3.2), std(0x23324a, { roughness: 0.7 })); deck.position.set(F.x, this.y0 + 0.42, F.z); deck.receiveShadow = true; S.add(deck);
    world.solids.push({ x: F.x, z: F.z, hw: 1.7, hd: 1.6, rot: 0 });
    // the spinning wheel: two rims, spokes and a ring of coloured lights
    const holder = new THREE.Group(); holder.position.copy(this.hub); holder.rotation.y = Math.PI / 2; S.add(holder);
    const g = this.wheel = new THREE.Group(); holder.add(g);
    for (const sz of [-0.9, 0.9]) { const rim = new THREE.Mesh(new THREE.TorusGeometry(F.R, 0.18, 8, 72), steel); rim.position.z = sz; g.add(rim); const inner = new THREE.Mesh(new THREE.TorusGeometry(F.R * 0.55, 0.12, 6, 48), steel); inner.position.z = sz; g.add(inner); }
    for (let i = 0; i < N * 2; i++) { const a = i / (N * 2) * Math.PI * 2; for (const sz of [-0.9, 0.9]) { const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, F.R, 5), steel); s.position.set(Math.sin(a) * F.R / 2, -Math.cos(a) * F.R / 2, sz); s.rotation.z = a; g.add(s); } }
    this.bulbs = [];
    for (let i = 0; i < 48; i++) { const a = i / 48 * Math.PI * 2, b = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), std(0xffffff, { emissive: COLORS[i % COLORS.length], emissiveIntensity: 2.2 })); b.position.set(Math.sin(a) * (F.R + 0.25), -Math.cos(a) * (F.R + 0.25), 0); g.add(b); this.bulbs.push(b); }
    g.traverse(o => { if (o.isMesh) o.userData.dynamic = true; });
    // gondolas (they always hang upright)
    this.cars = [];
    for (let i = 0; i < N; i++) {
      const c = new THREE.Group(), col = COLORS[i % COLORS.length];
      const floor = new THREE.Mesh(new THREE.BoxGeometry(2, 0.15, 1.7), std(0x23324a)); floor.position.y = -1.6;
      const low = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 1.7), std(col)); low.position.y = -1.2; low.material.side = THREE.DoubleSide;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(1.4, 0.6, 4), std(col)); roof.position.y = 0.4; roof.rotation.y = Math.PI / 4;
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.6, 6), steel); bar.position.y = -0.4;
      for (const sx of [-0.95, 0.95]) for (const sz of [-0.8, 0.8]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.4, 5), steel); p.position.set(sx, -0.5, sz); c.add(p); }
      c.add(floor, low, roof, bar); c.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.dynamic = true; } });
      S.add(c); this.cars.push({ g: c, i });
    }
    // riders: island people in some of the gondolas
    this.riders = new Bodies(world, 14); this.seats = [];
    for (let k = 0; k < 14; k++) this.seats.push({ car: (k * 5) % N, off: k % 2 ? 0.45 : -0.45, s: 0.8 + Math.random() * 0.25, ph: Math.random() * 6 });
    // the ticket gate at the end of the path
    const gx = F.x - 5.5, gz = F.z;
    const booth = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.4, 1.4), std(0xff3fa4)); booth.position.set(gx, this.y0 + 1.2, gz - 2.2); booth.castShadow = true; S.add(booth);
    world.solids.push({ x: gx, z: gz - 2.2, hw: 0.8, hd: 0.8, rot: 0 });
    const lab = labelSprite('🎡 ' + h.t('ferris') + ' · $2 · mPAY', 0.55, { bg: 'rgba(255,63,164,0.92)' }); lab.position.set(gx, this.y0 + 3.4, gz - 2.2); S.add(lab);
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.8, 1.05, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3fa4 })); ring.position.set(gx, this.y0 + 0.06, gz); S.add(ring);
    world.zone({ test: (px, py, pz) => Math.hypot(px - gx, pz - gz) < 1.05 && Math.abs(py - this.y0) < 1.5, onEnter: () => { if (!world.carrier) { h.banner('🎡 ' + h.t('ferrisHow'), 2600); h.buy('ferris', () => this.ride()); } } });
    this.gate = { x: gx - 1.8, z: gz };
    world.updaters.push(dt => this.update(dt));
  }
  carPos(i, out) {
    const F = FERRIS, a = i / N * Math.PI * 2 + this.rot;
    return out.set(this.hub.x, this.hub.y - Math.cos(a) * F.R, this.hub.z - Math.sin(a) * F.R);
  }
  update(dt) {
    const cam = this.w.camera && this.w.camera.position; if (!cam) return;
    this.rot += dt * Math.PI * 2 / LAP; this.wheel.rotation.z = this.rot;
    const v = this._v || (this._v = new THREE.Vector3());
    for (const c of this.cars) { this.carPos(c.i, v); c.g.position.copy(v); c.g.rotation.x = Math.sin(performance.now() / 900 + c.i) * 0.04; }
    // twinkling lights
    const t = performance.now() / 1000;
    this.bulbs.forEach((b, i) => { b.material.emissiveIntensity = 1.2 + Math.max(0, Math.sin(t * 3 - i * 0.4)) * 2; });
    const far = Math.hypot(cam.x - this.hub.x, cam.z - this.hub.z) > 160;
    this.riders.visible(!far);
    if (!far) {
      this.seats.forEach((s, k) => { this.carPos(s.car, v); const wave = Math.sin(t * 1.3 + s.ph) > 0.6; this.riders.pose(k, v.x + 0.15, v.y - 1.08 - 0.48 * s.s, v.z + s.off, -Math.PI / 2, { s: s.s, drop: 0.24, legL: -1.5, legR: -1.5, armL: wave ? -2.8 : -0.4, armR: -0.4, look: Math.sin(t * 0.5 + s.ph) * 0.6 }); });
      this.riders.flush();
    }
  }
  // ride: take the gondola nearest the ground and go once round
  ride() {
    const w = this.w, h = this.h; if (w.carrier) return;
    let best = 0, low = 1e9; const v = new THREE.Vector3();
    for (let i = 0; i < N; i++) { this.carPos(i, v); if (v.y < low) { low = v.y; best = i; } }
    const startRot = this.rot; let t = 0;
    w.me.play('sit'); h.sfx('chime'); h.banner('🎡 ' + h.t('ferrisGo'), 3000);
    w.carrier = {
      update: (dt, p, me) => {
        t += dt; this.carPos(best, v); p.set(v.x - 0.2, v.y - 1.53, v.z); me.group.rotation.y = -Math.PI / 2; me.animate(0, dt, false);
        const jump = t > 1 && (w.keys.Space || w.joyJump), done = this.rot - startRot >= Math.PI * 2;
        return jump || done;
      },
      onEnd: () => { w.me.emote = null; w.joyJump = false; w.teleport(this.gate.x, this.gate.z, Math.PI / 2); h.sfx('cheer'); },
      onCancel: () => { w.me.emote = null; },
    };
  }
}
