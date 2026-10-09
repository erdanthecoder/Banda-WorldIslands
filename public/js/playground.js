// Outdoor playground next to Banda Tower: swings, a slide, a merry-go-round, a seesaw,
// a sandpit and trampolines. Rides move you with world.carrier; jump (Space) to hop off.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { heightAt, labelSprite, canvasTex, PLAYGROUND, TOWER, MARKET, PITCH } from './world.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, ...extra });
const metal = c => std(c, { metalness: 0.7, roughness: 0.3 });

export class Playground {
  constructor(world, h) {
    this.w = world; this.h = h; const P = PLAYGROUND;
    this.y = heightAt(P.x, P.z);
    this.ground(); this.fence();
    this.swings(P.x - 9, P.z - 8);
    this.slide(P.x + 8, P.z - 7);
    this.carousel(P.x - 8, P.z + 6);
    this.seesaw(P.x + 9, P.z + 7);
    this.sandpit(P.x + 1, P.z + 1);
    world.trampoline(P.x - 15, P.z + 11, h.boing); world.trampoline(P.x + 15, P.z - 1, h.boing);
    const sign = labelSprite('PLAYGROUND', 0.9, { bg: 'rgba(230,80,60,0.92)', weight: 800 }); sign.position.set(P.x - P.w / 2 - 0.5, this.y + 3.3, P.z); world.scene.add(sign);
    this.post = paths(world);
  }
  add(m, x, y, z) { m.position.set(x, this.y + y, z); m.castShadow = true; m.receiveShadow = true; this.w.scene.add(m); return m; }

  ground() {
    const P = PLAYGROUND;
    const tex = canvasTex(512, 512, (g, W) => {
      const cols = ['#d9533f', '#2f8fce', '#3fae5a', '#f0b92e'];
      for (let i = 0; i < 4; i++) { g.fillStyle = cols[i]; g.fillRect((i % 2) * W / 2, (i >> 1) * W / 2, W / 2, W / 2); }
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.12})`; g.fillRect(Math.random() * W, Math.random() * W, 2, 2); }
    }, [3, 3]);
    const mat = new THREE.Mesh(new THREE.BoxGeometry(P.w, 0.1, P.d), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    mat.receiveShadow = true; mat.position.set(P.x, this.y + 0.05, P.z); this.w.scene.add(mat);
  }
  fence() {
    const P = PLAYGROUND, wood = std(0xf2f2ee), x0 = P.x - P.w / 2, x1 = P.x + P.w / 2, z0 = P.z - P.d / 2, z1 = P.z + P.d / 2;
    const rail = (ax, az, bx, bz) => {
      const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az);
      for (const y of [0.45, 0.9]) { const r = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, L), wood), (ax + bx) / 2, y, (az + bz) / 2); r.rotation.y = ang; }
      for (let s = 0; s <= L; s += 1.5) { const p = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.1, 0.12), wood), ax + (bx - ax) * s / L, 0.55, az + (bz - az) * s / L); }
      this.w.solids.push({ x: (ax + bx) / 2, z: (az + bz) / 2, hw: Math.abs(bx - ax) / 2 + 0.06, hd: Math.abs(bz - az) / 2 + 0.06, rot: 0 });
    };
    // gates in the middle of the west side (towards the plaza) and the south side
    rail(x0, z0, x1, z0); rail(x1, z0, x1, z1);
    rail(x0, z1, P.x - 2.5, z1); rail(P.x + 2.5, z1, x1, z1);
    rail(x0, z0, x0, P.z - 2.5); rail(x0, P.z + 2.5, x0, z1);
    for (const [bx, bz, r] of [[x1 - 2, P.z + 2, -Math.PI / 2], [P.x, z0 + 1.4, 0]]) { // benches
      const g = new THREE.Group(), w = std(0x8a5a35, { roughness: 0.8 });
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2, 0.08, 0.5), w); seat.position.y = 0.45;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2, 0.45, 0.06), w); back.position.set(0, 0.75, -0.25);
      g.add(seat, back); g.rotation.y = r; this.add(g, bx, 0, bz); this.w.solids.push({ x: bx, z: bz, r: 0.6 });
    }
  }

  // a ride: the carrier calls step(t) each frame until it returns true or you jump
  ride(dur, step, done) {
    const w = this.w; w.me.play('sit'); let t = 0;
    w.carrier = {
      update: (dt, p, me) => { t += dt; const fin = step(t, p, me, dt) === true || t > dur || (t > 0.8 && (w.keys.Space || w.joyJump)); me.animate(0, dt, false); return fin; },
      onEnd: () => { w.me.emote = null; w.joyJump = false; done && done(false); },
      onCancel: () => { w.me.emote = null; done && done(true); },
    };
  }

  swings(cx, cz) {
    const frame = metal(0x2f5f9e);
    for (const sx of [-4.2, 4.2]) for (const sz of [-1, 1]) { const leg = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.4, 10), frame), cx + sx, 1.6, cz + sz * 0.9); leg.rotation.x = sz * 0.3; }
    const top = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 8.6, 10), frame), cx, 3.2, cz); top.rotation.z = Math.PI / 2;
    for (const sx of [-4.2, 4.2]) this.w.solids.push({ x: cx + sx, z: cz, r: 0.3 });
    [-2.4, 0, 2.4].forEach((ox, i) => {
      const piv = new THREE.Group(); this.add(piv, cx + ox, 3.2, cz);
      const seat = new THREE.Mesh(new RoundedBox(0.9, 0.08, 0.4, 2, 0.03), std([0xe74c3c, 0xf1c40f, 0x2ecc71][i])); seat.position.y = -2.6; seat.castShadow = true;
      for (const s of [-0.4, 0.4]) { const ch = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.6, 4), metal(0x999999)); ch.position.set(s, -1.3, 0); piv.add(ch); }
      piv.add(seat);
      let busy = false;
      this.w.updaters.push((dt, t) => { if (!busy) piv.rotation.x = Math.sin(t * 1.3 + i) * 0.04; });
      this.w.zone({ test: (px, py, pz) => Math.abs(px - (cx + ox)) < 0.6 && Math.abs(pz - cz) < 0.6 && Math.abs(py - this.y) < 1, onEnter: () => {
        if (this.w.carrier) return; busy = true; this.h.sfx('click');
        this.ride(9, (t, p, me) => {
          const amp = Math.min(1, t / 3) * 0.95 * (t > 7 ? Math.max(0, (9 - t) / 2) : 1), a = Math.sin(t * 2.1) * amp;
          piv.rotation.x = a;
          p.set(cx + ox, this.y + 3.2 - Math.cos(a) * 2.6 - 0.35, cz + Math.sin(a) * 2.6);
          me.group.rotation.y = 0;
          if (Math.abs(a) > 0.85 && !this._wee) { this._wee = 1; this.h.sfx('whoosh'); } if (Math.abs(a) < 0.2) this._wee = 0;
        }, c => { busy = false; piv.rotation.x = 0; if (c) return; const p = this.w.me.group.position; p.set(cx + ox, this.y, cz + 1.6); this.h.earn && this.h.earn('swing'); });
      } });
    });
  }

  slide(cx, cz) {
    const red = std(0xe74c3c, { roughness: 0.35 }), yel = std(0xf6c445, { roughness: 0.35 }), H = 3;
    const deck = this.add(new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 2), yel), cx, H, cz);
    for (const sx of [-0.9, 0.9]) for (const sz of [-0.9, 0.9]) this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, H + 1.2, 10), metal(0x2f5f9e)), cx + sx, (H + 1.2) / 2, cz + sz);
    const roof = this.add(new THREE.Mesh(new THREE.ConeGeometry(1.7, 1.2, 4), red), cx, H + 1.8, cz); roof.rotation.y = Math.PI / 4;
    // ladder on the north side
    for (const sx of [-0.45, 0.45]) { const r = this.add(new THREE.Mesh(new THREE.BoxGeometry(0.08, H + 0.4, 0.08), metal(0xcccccc)), cx + sx, H / 2, cz - 1.5); r.rotation.x = -0.25; }
    for (let k = 0; k < 7; k++) this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.9, 6).rotateZ(Math.PI / 2), metal(0xcccccc)), cx, 0.3 + k * 0.45, cz - 1.75 + k * 0.08);
    // the slide: a curved chute heading south
    const pts = []; for (let i = 0; i <= 20; i++) { const k = i / 20; pts.push(new THREE.Vector3(cx + Math.sin(k * 2.2) * 1.4, this.y + H - k * (H - 0.35) + Math.sin(k * Math.PI) * 0.15, cz + 1 + k * 6)); }
    const curve = new THREE.CatmullRomCurve3(pts);
    const chute = new THREE.Mesh(new THREE.TubeGeometry(curve, 60, 0.55, 12, false), new THREE.MeshStandardMaterial({ color: 0x2f8fce, roughness: 0.25, side: THREE.DoubleSide }));
    chute.scale.y = 1; chute.castShadow = true; this.w.scene.add(chute);
    this.w.solids.push({ x: cx, z: cz, hw: 1, hd: 1, rot: 0 });
    this.w.zone({ test: (px, py, pz) => Math.abs(px - cx) < 0.8 && pz > cz - 2.8 && pz < cz - 1.4 && Math.abs(py - this.y) < 1, onEnter: () => {
      if (this.w.carrier) return;
      this.ride(5, (t, p, me) => {
        if (t < 1.4) { const k = t / 1.4; p.set(cx, this.y + k * H, cz - 1.9 + k * 0.6); me.group.rotation.y = 0; me.emote = null; me.phase += 0.25; return; }
        if (t < 1.8) { const k = (t - 1.4) / 0.4; p.set(cx, this.y + H, cz - 1.3 + k * 2.2); me.group.rotation.y = 0; if (!me.emote) { me.play('sit'); this.h.sfx('whoosh'); } return; }
        const k = Math.min(1, (t - 1.8) / 1.6), q = curve.getPointAt(k * k * 0.6 + k * 0.4), tg = curve.getTangentAt(Math.min(0.999, k));
        p.set(q.x, q.y - 0.45, q.z); me.group.rotation.y = Math.atan2(tg.x, tg.z);
        if (k >= 1) return true;
      }, c => { if (c) return; const p = this.w.me.group.position, e = curve.getPointAt(1); p.set(e.x, this.y, e.z + 1.2); this.w.vel.set(0, 0, 4); this.h.earn && this.h.earn('slide'); });
    } });
    const lab = labelSprite('SLIDE', 0.4); lab.position.set(cx, this.y + 1.4, cz - 2.6); this.w.scene.add(lab);
  }

  carousel(cx, cz) {
    const g = new THREE.Group(); this.add(g, cx, 0, cz);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.6, 0.18, 40), new THREE.MeshStandardMaterial({ color: 0xf6c445, roughness: 0.4, metalness: 0.2 })); disc.position.y = 0.25; disc.castShadow = disc.receiveShadow = true; g.add(disc);
    const cols = [0xe74c3c, 0x2f8fce, 0x3fae5a, 0x9b59b6];
    for (let i = 0; i < 4; i++) { const sec = new THREE.Mesh(new THREE.CylinderGeometry(2.62, 2.62, 0.05, 10, 1, false, i * Math.PI / 2, Math.PI / 2), std(cols[i])); sec.position.y = 0.36; g.add(sec); }
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.6, 10), metal(0xcccccc)); pole.position.y = 1.1; g.add(pole);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, bar = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.04, 6, 20, Math.PI), metal(0xcccccc)); bar.position.set(Math.cos(a) * 1.3, 0.38, Math.sin(a) * 1.3); bar.rotation.y = -a; g.add(bar); }
    let spin = 0.4, riding = false;
    this.w.updaters.push(dt => { g.rotation.y += spin * dt; if (!riding) spin += (0.4 - spin) * dt * 0.5; });
    this.w.zone({ test: (px, py, pz) => Math.hypot(px - cx, pz - cz) < 2.4 && Math.abs(py - this.y) < 1, onEnter: () => {
      if (this.w.carrier) return; riding = true; this.h.sfx('whoosh');
      const p0 = this.w.me.group.position, r0 = Math.max(1.2, Math.min(2.1, Math.hypot(p0.x - cx, p0.z - cz))), a0 = Math.atan2(p0.z - cz, p0.x - cx) + g.rotation.y;
      this.ride(10, (t, p, me) => {
        spin = Math.min(4.5, 0.4 + t * 1.2) * (t > 8 ? (10 - t) / 2 : 1);
        const a = a0 - g.rotation.y; p.set(cx + Math.cos(a) * r0, this.y + 0.35, cz + Math.sin(a) * r0); me.group.rotation.y = -a;
      }, c => { riding = false; if (c) return; const p = this.w.me.group.position, a = Math.atan2(p.z - cz, p.x - cx); p.set(cx + Math.cos(a) * 3.4, this.y, cz + Math.sin(a) * 3.4); this.h.earn && this.h.earn('carousel'); });
    } });
  }

  seesaw(cx, cz) {
    const base = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 0.7, 3), metal(0x2f5f9e)), cx, 0.35, cz); base.rotation.z = Math.PI / 2; base.rotation.y = Math.PI / 2;
    const plank = new THREE.Group(); this.add(plank, cx, 0.75, cz);
    const board = new THREE.Mesh(new RoundedBox(0.5, 0.12, 5.4, 2, 0.04), std(0xe74c3c)); board.castShadow = true; plank.add(board);
    for (const s of [-1, 1]) { const hnd = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 14, Math.PI), metal(0xcccccc)); hnd.position.set(0, 0.25, s * 2.2); plank.add(hnd); }
    this.w.solids.push({ x: cx, z: cz, r: 0.35 });
    let busy = false;
    this.w.updaters.push((dt, t) => { if (!busy) plank.rotation.x = Math.sin(t * 0.8) * 0.05 + 0.18; });
    this.w.zone({ test: (px, py, pz) => Math.abs(px - cx) < 0.7 && Math.abs(pz - cz) > 1.6 && Math.abs(pz - cz) < 3 && Math.abs(py - this.y) < 1, onEnter: () => {
      if (this.w.carrier) return; busy = true;
      const s = Math.sign(this.w.me.group.position.z - cz);
      this.ride(8, (t, p, me) => {
        const a = Math.sin(t * 2.4) * 0.3; plank.rotation.x = a;
        p.set(cx, this.y + 0.85 - Math.sin(a) * 2.4 * s - 0.3, cz + Math.cos(a) * 2.4 * s); me.group.rotation.y = s > 0 ? Math.PI : 0;
        if (Math.abs(Math.cos(t * 2.4)) < 0.05 && !this._bump) { this._bump = 1; this.h.sfx('boing'); } if (Math.abs(Math.cos(t * 2.4)) > 0.3) this._bump = 0;
      }, c => { busy = false; if (c) return; const p = this.w.me.group.position; p.set(cx + 1.4, this.y, cz + s * 2.4); this.h.earn && this.h.earn('seesaw'); });
    } });
  }

  sandpit(cx, cz) {
    const sand = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.3, 40), std(0xe8d3a0, { roughness: 1 })); this.add(sand, cx, 0.15, cz);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(3, 0.15, 8, 40).rotateX(Math.PI / 2), std(0x8a5a35)); this.add(rim, cx, 0.3, cz);
    const castle = new THREE.Group();
    for (const [x, z, s] of [[0, 0, 1], [0.6, 0.3, 0.6], [-0.6, 0.3, 0.6], [0, -0.6, 0.6]]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * s, 0.4 * s, 0.7 * s, 10), std(0xd9bf85, { roughness: 1 })); t.position.set(x, 0.35 * s, z); castle.add(t); }
    this.add(castle, cx + 0.8, 0.3, cz - 0.5);
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 12, 1, true), std(0x2f8fce, { side: THREE.DoubleSide })); this.add(bucket, cx - 1.2, 0.45, cz + 0.8);
    this.w.grounds.push((x, z) => Math.hypot(x - cx, z - cz) < 3 ? this.y + 0.3 : null);
  }
}

// paved walkways from the plaza to each place, so it's obvious where to go
export function paths(world) {
  const y0 = heightAt(0, 0), S = world.scene;
  const mat = new THREE.MeshStandardMaterial({ color: 0xcfc6b4, roughness: 0.85 });
  const strip = (ax, az, bx, bz, w = 4) => {
    const L = Math.hypot(bx - ax, bz - az), m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, L), mat);
    m.position.set((ax + bx) / 2, y0 + 0.03, (az + bz) / 2); m.rotation.y = Math.atan2(bx - ax, bz - az); m.receiveShadow = true; S.add(m);
  };
  strip(0, -24, 0, TOWER.z + TOWER.d / 2 + 6, 7);
  strip(-24, 0, MARKET.x + MARKET.w / 2 + 6, MARKET.z + 4, 5);
  strip(24, 0, PLAYGROUND.x - PLAYGROUND.w / 2, PLAYGROUND.z, 5);
  strip(0, 24, PITCH.x, PITCH.z - PITCH.hd - 3, 5);
  // signposts at the plaza
  const post = (x, z, text) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.6, 8), metal(0x30343a)); p.position.set(x, y0 + 1.3, z); S.add(p); const l = labelSprite(text, 0.36, { bg: 'rgba(20,90,60,0.9)' }); l.position.set(x, y0 + 2.8, z); S.add(l); world.solids.push({ x, z, r: 0.15 }); };
  return post;
}
