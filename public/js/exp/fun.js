// 🎉 Fun things the Marbly games share: coins to collect (they turn into real mBank money),
// platforms you can stand on for parkour, bounce pads, and a little coin counter on the HUD.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { ui, L, money } from './core.js';

// a block you can stand on (outdoors). move(t) lets it slide about: it returns the new [x, z]
export function platform(w, x, top, z, sx, sz, mat, { h = 0.5, move } = {}) {
  const m = new THREE.Mesh(new RoundedBox(sx, h, sz, 2, Math.min(0.12, h / 3)), mat);
  m.position.set(x, top - h / 2, z); m.castShadow = m.receiveShadow = true; w.scene.add(m);
  const P = { x, z, top, m };
  w.grounds.push((wx, wz, wy) => Math.abs(wx - P.x) < sx / 2 + 0.2 && Math.abs(wz - P.z) < sz / 2 + 0.2 && wy >= top - 0.6 ? top : null);
  if (move) w.updaters.push((dt, t) => {
    const [nx, nz] = move(t), dx = nx - P.x, dz = nz - P.z; P.x = nx; P.z = nz; m.position.x = nx; m.position.z = nz;
    // carry the player along when they stand on it
    const p = w.me.group.position; if (w.onGround && Math.abs(p.y - top) < 0.08 && Math.abs(p.x - (nx - dx)) < sx / 2 + 0.2 && Math.abs(p.z - (nz - dz)) < sz / 2 + 0.2) { p.x += dx; p.z += dz; }
  });
  return P;
}

// a glowing pad that throws you into the air
export function bouncePad(w, x, z, power = 16, onBounce, { y = 0, color = 0x39d353, r = 1.3 } = {}) {
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r + 0.1, 0.22, 32), new THREE.MeshStandardMaterial({ color: 0x1b1d21, emissive: color, emissiveIntensity: 1.5, roughness: 0.3 }));
  pad.position.set(x, y + 0.11, z); pad.receiveShadow = true; w.scene.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 0.7, 0.06, 8, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color })); ring.position.set(x, y + 0.3, z); w.scene.add(ring);
  w.updaters.push((dt, t) => { const k = (t * 1.5) % 1; ring.position.y = y + 0.3 + k * 1.6; ring.scale.setScalar(1 + k * 0.4); ring.material.opacity = 1 - k; ring.material.transparent = true; });
  w.zone({ test: (px, py, pz) => Math.hypot(px - x, pz - z) < r && py < y + 0.5, onEnter: () => { w.vel.y = power; w.onGround = false; onBounce && onBounce(); } });
  return pad;
}

// spinning coins: walk (or drive) through them to collect. They come back after a while.
const coinGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 24).rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({ color: 0xffd34d, metalness: 1, roughness: 0.25, emissive: 0x7a5400, emissiveIntensity: 0.6 });
const barGeo = new RoundedBox(0.9, 0.35, 0.45, 2, 0.06);
export class Coins {
  constructor(app, { respawn = 40, reach = 1.1 } = {}) {
    this.app = app; this.list = []; this.respawn = respawn; this.reach = reach; this.n = 0; this.pending = 0; this.total = 0;
    this.el = document.createElement('div'); this.el.className = 'x-coins'; this.el.innerHTML = '🪙 <b>0</b>'; document.body.appendChild(this.el);
    setInterval(() => this.flush(), 6000);
  }
  // value is in cents. big = a gold bar worth much more
  add(x, y, z, value = 5, big = false) {
    const m = new THREE.Mesh(big ? barGeo : coinGeo, coinMat); m.position.set(x, y, z); m.castShadow = true; this.app.world.scene.add(m);
    const c = { m, x, y, z, value, big, gone: 0 }; this.list.push(c); return c;
  }
  line(pts, value) { pts.forEach(([x, y, z]) => this.add(x, y, z, value)); }
  update(dt, t) {
    const p = this.app.world.me.group.position;
    for (const c of this.list) {
      if (c.gone) { if (t > c.gone) { c.gone = 0; c.m.visible = true; c.m.scale.setScalar(0.01); } continue; }
      if (c.m.scale.x < 1) c.m.scale.setScalar(Math.min(1, c.m.scale.x + dt * 3));
      c.m.rotation.y += dt * (c.big ? 1.5 : 3); c.m.position.y = c.y + Math.sin(t * 2.5 + c.x) * 0.12;
      if (Math.abs(p.x - c.x) < this.reach && Math.abs(p.z - c.z) < this.reach && p.y > c.y - 2.2 && p.y < c.y + 0.8) this.take(c, t);
    }
  }
  take(c, t) {
    c.gone = t + (c.big ? this.respawn * 4 : this.respawn); c.m.visible = false;
    this.n++; this.pending += c.value; this.total += c.value;
    this.el.querySelector('b').textContent = money(this.total); this.el.classList.remove('pop'); this.el.offsetHeight; this.el.classList.add('pop');
    this.app.sfx(c.big ? 'paid' : 'coin');
    if (c.big) ui.toast(`🥇 ${L('Gold bar!', 'Золотой слиток!')} +${money(c.value)}`);
    if (this.pending >= 60 || c.big) this.flush();
  }
  // bonus coins (from a coin bag or a prize) count too
  bonus(cents, now = true) { this.pending += cents; this.total += cents; this.el.querySelector('b').textContent = money(this.total); this.el.classList.remove('pop'); this.el.offsetHeight; this.el.classList.add('pop'); if (now || this.pending >= 60) this.flush(); }
  flush() {
    if (this.pending <= 0 || this._busy) return; const c = Math.min(500, this.pending); this.pending -= c; this._busy = true;
    this.app.net.earn(c).then(b => this.app.setMoney(b)).catch(() => {}).finally(() => (this._busy = false));
  }
}
