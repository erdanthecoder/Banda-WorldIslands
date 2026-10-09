// Banda Metro lines above the sea: a bridge from Central Square to every island, trains that really
// run on them, and the passenger ride (the camera follows your train across the water).
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ISLANDS, isl, heightAt, TEX, canvasTex } from './world.js';

const DECK = 4.2;

export function makeTrain(cars = 3) {
  const g = new THREE.Group();
  const side = canvasTex(512, 128, (c, W, H) => {
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#eef1f4'); gr.addColorStop(1, '#b8bec5'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.fillStyle = '#c8102e'; c.fillRect(0, 90, W, 12);
    for (let i = 0; i < 6; i++) { c.fillStyle = '#16202a'; c.fillRect(16 + i * 84, 22, 66, 52); c.fillStyle = 'rgba(255,240,210,0.3)'; c.fillRect(16 + i * 84, 22, 66, 52); c.fillStyle = 'rgba(255,255,255,0.2)'; c.fillRect(16 + i * 84, 22, 16, 52); }
  });
  side.wrapS = side.wrapT = THREE.ClampToEdgeWrapping;
  const body = new THREE.MeshStandardMaterial({ map: side, metalness: 0.5, roughness: 0.3 });
  const end = new THREE.MeshStandardMaterial({ color: 0xd2d6da, metalness: 0.5, roughness: 0.3 });
  const nose = new THREE.MeshStandardMaterial({ color: 0xc8102e, metalness: 0.4, roughness: 0.35 });
  for (let k = 0; k < cars; k++) {
    const car = new THREE.Mesh(new THREE.BoxGeometry(3, 3, 14), [body, body, end, end, end, end]); car.position.set(0, 1.9, -k * 14.6); car.castShadow = true; car.receiveShadow = true; g.add(car);
    const roof = new THREE.Mesh(new RoundedBox(2.9, 0.4, 13.6, 3, 0.15), end); roof.position.set(0, 3.5, -k * 14.6); g.add(roof);
    for (const z of [-5, 5]) { const bogie = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 2.6), new THREE.MeshStandardMaterial({ color: 0x2a2c30 })); bogie.position.set(0, 0.35, -k * 14.6 + z); g.add(bogie); }
  }
  const front = new THREE.Mesh(new RoundedBox(3, 2.6, 1.4, 4, 0.5), nose); front.position.set(0, 1.9, 7.4); front.castShadow = true; g.add(front);
  const win = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.0, 0.1), new THREE.MeshStandardMaterial({ color: 0x0e161e, metalness: 0.9, roughness: 0.05 })); win.position.set(0, 2.5, 8.1); g.add(win);
  for (const x of [-0.9, 0.9]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 4 })); l.position.set(x, 1.2, 8.1); g.add(l); }
  return g;
}

export class Rail {
  constructor(world) {
    this.w = world; this.lines = {};
    const hub = isl('hub');
    for (const I of ISLANDS) {
      if (I.id === 'hub') continue;
      const ux = (I.x - hub.x), uz = (I.z - hub.z), L = Math.hypot(ux, uz), u = [ux / L, uz / L];
      const a = this.portalPoint(hub, u), b = this.portalPoint(I, [-u[0], -u[1]]);
      this.lines[I.id] = this.build(a, b);
    }
    world.updaters.push((dt, t) => this.shuttle(t));
  }
  // walk outward from an island's centre until the ground is low enough for the bridge deck
  portalPoint(I, u) {
    const limit = Math.min(I.h - 0.6, DECK - 1.6);
    for (let r = 20; r < I.r * 1.3; r += 1) { const x = I.x + u[0] * r, z = I.z + u[1] * r; if (heightAt(x, z) < limit) return [x, z]; }
    return [I.x + u[0] * I.r, I.z + u[1] * I.r];
  }
  build(a, b) {
    const S = this.w.scene, dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz), ang = Math.atan2(dx, dz);
    const conc = this.w.texMat(TEX.concrete, 6, 6, { color: 0xb9b6ae });
    const deck = new THREE.Mesh(new THREE.BoxGeometry(6, 0.8, L), conc); deck.position.set((a[0] + b[0]) / 2, DECK - 0.4, (a[1] + b[1]) / 2); deck.rotation.y = ang; deck.castShadow = deck.receiveShadow = true; S.add(deck);
    const steel = new THREE.MeshStandardMaterial({ color: 0x7d8288, metalness: 0.9, roughness: 0.3 });
    for (const off of [-0.75, 0.75]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, L), steel); r.position.set((a[0] + b[0]) / 2 + Math.cos(ang) * off, DECK + 0.08, (a[1] + b[1]) / 2 - Math.sin(ang) * off); r.rotation.y = ang; S.add(r); }
    for (const off of [-2.9, 2.9]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.15, 1.0, L), steel); p.position.set((a[0] + b[0]) / 2 + Math.cos(ang) * off, DECK + 0.5, (a[1] + b[1]) / 2 - Math.sin(ang) * off); p.rotation.y = ang; S.add(p); }
    for (let s = 12; s < L - 6; s += 22) {
      const x = a[0] + dx / L * s, z = a[1] + dz / L * s, gh = heightAt(x, z); if (gh > DECK - 2) continue;
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, DECK - gh + 0.2, 14), conc); col.position.set(x, (DECK + gh) / 2 - 0.4, z); col.castShadow = true; S.add(col);
    }
    // tunnel portals at both ends
    for (const [p, dir] of [[a, ang], [b, ang + Math.PI]]) {
      const g = new THREE.Group(), stone = this.w.texMat(TEX.rock, 8, 8, { color: 0xb0a99c });
      const back = new THREE.Mesh(new THREE.BoxGeometry(11, 9, 8), stone); back.position.set(0, 3.5, -4.6); back.castShadow = true; g.add(back);
      const hole = new THREE.Mesh(new THREE.BoxGeometry(5, 5.2, 0.4), new THREE.MeshBasicMaterial({ color: 0x050607 })); hole.position.set(0, DECK + 2.4 - p.h, -0.5); g.add(hole);
      const sign = canvasTex(128, 128, c => { c.fillStyle = '#c8102e'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 84px Manrope, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', 64, 70); });
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 32), new THREE.MeshStandardMaterial({ map: sign })); m.position.set(0, DECK + 6, -0.39); g.add(m);
      p.h = heightAt(p[0], p[1]);
      g.position.set(p[0], 0, p[1]); g.rotation.y = dir; g.children.forEach(c => { if (c !== back) c.position.y = c === m ? DECK + 6 : DECK + 2.4; }); back.position.y = Math.max(DECK, p.h) + 0.2;
      S.add(g);
      this.w.solids.push({ x: p[0] - Math.sin(dir) * 4.6, z: p[1] - Math.cos(dir) * 4.6, hw: 5.5, hd: 4, rot: dir });
    }
    const train = makeTrain(3); S.add(train);
    return { a, b, L, ang, train, phase: Math.random() * 100 };
  }
  pos(line, s) { const { a, b, L } = line; return [a[0] + (b[0] - a[0]) * s / L, a[1] + (b[1] - a[1]) * s / L]; }

  // trains shuttle back and forth and disappear into the tunnels at each end
  shuttle(t) {
    for (const id in this.lines) {
      const ln = this.lines[id]; if (ln.busy) continue;
      const run = ln.L / 24 + 3, cyc = (t + ln.phase) % (run * 2 + 12);
      let s, fwd = true, vis = true;
      if (cyc < run) s = ease(cyc / run) * (ln.L + 50) - 25;
      else if (cyc < run + 6) vis = false;
      else if (cyc < run * 2 + 6) { s = ln.L + 25 - ease((cyc - run - 6) / run) * (ln.L + 50); fwd = false; }
      else vis = false;
      ln.train.visible = vis && s > -24 && s < ln.L + 24;
      if (ln.train.visible) this.place(ln, ln.train, s, fwd);
    }
  }
  place(ln, train, s, fwd) {
    const [x, z] = this.pos(ln, s); train.position.set(x, DECK, z); train.rotation.y = ln.ang + (fwd ? 0 : Math.PI);
  }

  // Ride from one island to another: via Central Square when neither end is the hub.
  ride(from, to, fade, done) {
    const legs = [];
    if (from !== 'hub') legs.push([this.lines[from], false]); // island -> hub runs b -> a
    if (to !== 'hub') legs.push([this.lines[to], true]);      // hub -> island runs a -> b
    const w = this.w, train = makeTrain(3); w.scene.add(train);
    let i = 0;
    const next = () => {
      if (i >= legs.length) { w.scene.remove(train); w.cameraOverride = null; done(); return; }
      const [ln, fwd] = legs[i++]; ln.busy = true; ln.train.visible = false;
      const T = ln.L / 26 + 4, t0 = performance.now(), cam = new THREE.Vector3(), look = new THREE.Vector3();
      let first = true;
      w.cameraOverride = (camera, dt) => {
        const k = Math.min(1, (performance.now() - t0) / 1000 / T), s = fwd ? -20 + ease(k) * (ln.L + 40) : ln.L + 20 - ease(k) * (ln.L + 40);
        this.place(ln, train, s, fwd);
        const dir = fwd ? 1 : -1, sx = Math.sin(ln.ang) * dir, sz = Math.cos(ln.ang) * dir;
        // side-on tracking shot over the water, a little ahead of the train
        cam.set(train.position.x + sx * 6 + sz * 18, DECK + 5, train.position.z + sz * 6 - sx * 18);
        look.set(train.position.x + sx * 3, DECK + 2, train.position.z + sz * 3);
        if (first) { camera.position.copy(cam); first = false; } else camera.position.lerp(cam, Math.min(1, dt * 3));
        camera.lookAt(look);
        if (k >= 1) { w.cameraOverride = () => {}; ln.busy = false; fade(true); setTimeout(() => { fade(false); next(); }, 450); }
      };
    };
    next();
  }
}
const ease = k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
