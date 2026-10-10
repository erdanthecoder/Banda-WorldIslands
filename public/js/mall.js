// 🛍️ Pentagon Mall: a five-sided shopping centre south of World Market.
// Inside, around a green atrium: Pentagon Café (with the Barista job), a supermarket, a toy & fashion shop,
// a sweets & ice-cream bar, and the Job Center by the door. Shops use the normal basket + mPAY checkout.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Building } from './buildings.js';
import { MALL, TEX, labelSprite, canvasTex } from './world.js';
import { Avatar } from './avatar.js';
import { CAFE, FOOD } from './shop.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const glass = () => new THREE.MeshStandardMaterial({ color: 0x9cc3d6, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
const D = Math.PI / 180;
export const SHOPS = {
  cafe: { a: 72, icon: '☕', items: CAFE, cafe: true, color: 0x8a5a3b },
  market: { a: 144, icon: '🛒', items: ['apple', 'banana', 'juice', 'soda', 'chips', 'chocolate', 'pizza', 'burger', 'cake'], color: 0x2e9e5b },
  toys: { a: 216, icon: '🧸', items: ['ball', 'balloon', 'teddy', 'crown', 'headphones', 'tophat', 'dog', 'cat', 'bunny', 'dragon'], color: 0xd6457a },
  sweets: { a: 288, icon: '🍦', items: ['icecream', 'chocolate', 'cake', 'juice', 'lemonade', 'pancakes'], cafe: true, color: 0x5b8def },
};

export class Mall extends Building {
  constructor(world, h) {
    const M = MALL;
    super(world, { x: M.x, z: M.z, w: M.R * 2, d: M.R * 2, floors: 1, fh: 9, base: M.base, door: { width: 6 }, round: 15.9 });
    this.h = h; this.build();
  }
  // a point at angle a (degrees, 0 = towards the door / south) and distance r from the centre
  at(a, r) { return [this.x + Math.sin(a * D) * r, this.z + Math.cos(a * D) * r]; }
  build() {
    const S = this.world.scene, t = this.h.t, base = this.base, H = 9, R = MALL.R, ap = R * Math.cos(36 * D), side = 2 * R * Math.sin(36 * D);
    const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; S.add(m); return m; };
    const wallMat = this.world.texMat(TEX.plaster, side, H, { color: 0xf7f3ec, roughness: 0.85 }), band = std(0x1d2b3a, { metalness: 0.4, roughness: 0.4 });
    const stripes = [0xff9f1c, 0x2ec4b6, 0xe71d36, 0x7b2cbf, 0x3a86ff];
    // five walls: lower solid part, a glass band, a coloured stripe; the south wall has the entrance
    for (let i = 0; i < 5; i++) {
      const a = i * 72, [mx, mz] = this.at(a, ap), ry = a * D;
      const piece = (offset, len) => {
        const ox = mx + Math.cos(ry) * offset, oz = mz - Math.sin(ry) * offset;
        add(new THREE.BoxGeometry(len, 3.2, 0.5), wallMat, ox, base + 1.6, oz, ry);
        add(new THREE.BoxGeometry(len, 0.6, 0.6), new THREE.MeshStandardMaterial({ color: stripes[i], emissive: stripes[i], emissiveIntensity: 0.25 }), ox, base + 3.5, oz, ry);
      };
      if (i === 0) { const g = 3; piece(-(side / 2 + g) / 2, side / 2 - g); piece((side / 2 + g) / 2, side / 2 - g); }
      else piece(0, side);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(side, H - 4.4), glass()); gl.position.set(mx, base + 3.8 + (H - 4.4) / 2, mz); gl.rotation.y = ry; S.add(gl);
      add(new THREE.BoxGeometry(side + 0.4, 0.5, 0.7), band, mx, base + H, mz, ry);
    }
    for (let i = 0; i < 5; i++) { const [vx, vz] = this.at(36 + i * 72, R); add(new THREE.CylinderGeometry(0.45, 0.45, H + 0.5, 12), band, vx, base + H / 2, vz); }
    // the roof: a pentagon ring with a glass skylight in the middle
    const shape = new THREE.Shape(); for (let i = 0; i < 5; i++) { const [vx, vz] = [Math.sin((36 + i * 72) * D) * (R + 0.6), Math.cos((36 + i * 72) * D) * (R + 0.6)]; i ? shape.lineTo(vx, -vz) : shape.moveTo(vx, -vz); }
    const hole = new THREE.Path(); for (let i = 0; i < 5; i++) { const [vx, vz] = [Math.sin((36 + i * 72) * D) * 9, Math.cos((36 + i * 72) * D) * 9]; i ? hole.lineTo(vx, -vz) : hole.moveTo(vx, -vz); } shape.holes.push(hole);
    const roof = add(new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: false }).rotateX(-Math.PI / 2), std(0xe9e4da), this.x, base + H + 0.25, this.z);
    const skyShape = new THREE.Shape(); for (let i = 0; i < 5; i++) { const [vx, vz] = [Math.sin((36 + i * 72) * D) * 9.2, Math.cos((36 + i * 72) * D) * 9.2]; i ? skyShape.lineTo(vx, -vz) : skyShape.moveTo(vx, -vz); }
    const sky = new THREE.Mesh(new THREE.ShapeGeometry(skyShape).rotateX(-Math.PI / 2), glass()); sky.position.set(this.x, base + H + 0.7, this.z); S.add(sky);
    // floor
    const fl = new THREE.Mesh(new THREE.CircleGeometry(R, 5, -54 * D).rotateX(-Math.PI / 2), this.world.texMat(TEX.tile, R * 2, R * 2, { color: 0xf1ede6, roughness: 0.3 })); fl.position.set(this.x, base + 0.04, this.z); fl.receiveShadow = true; S.add(fl);
    // entrance canopy + big sign
    const [ex, ez] = this.at(0, ap + 1.6);
    add(new THREE.BoxGeometry(9, 0.3, 3.4), band, ex, base + 4.4, ez);
    for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.15, 0.15, 4.4, 10), band, ex + sx * 4.2, base + 2.2, ez + 1.4);
    const logo = canvasTex(1024, 256, (c, W, Hh) => {
      c.clearRect(0, 0, W, Hh); c.fillStyle = '#1d2b3a'; c.beginPath(); c.roundRect(8, 24, W - 16, Hh - 48, 40); c.fill();
      c.save(); c.translate(120, Hh / 2); for (let i = 0; i < 5; i++) { c.fillStyle = '#' + stripes[i].toString(16).padStart(6, '0'); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 70, -Math.PI / 2 + i * 1.2566, -Math.PI / 2 + (i + 1) * 1.2566); c.fill(); } c.restore();
      c.fillStyle = '#fff'; c.font = '900 92px Manrope, system-ui'; c.textBaseline = 'middle'; c.fillText('PENTAGON', 220, Hh / 2 - 8); c.fillStyle = '#ffd34d'; c.font = '800 46px Manrope, system-ui'; c.fillText('MALL', 760, Hh / 2 + 4);
    });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: logo, transparent: true })); sg.position.set(ex, base + H + 2.2, ez - 1.2); S.add(sg);
    // the atrium: a planter with a tree and a ring of benches
    const C = [this.x, this.z];
    add(new THREE.CylinderGeometry(3, 3.2, 0.8, 5), std(0xd8d2c6), C[0], base + 0.4, C[1]).rotation.y = 54 * D;
    add(new THREE.CylinderGeometry(2.8, 2.8, 0.1, 5), std(0x4a7d2a), C[0], base + 0.85, C[1]).rotation.y = 54 * D;
    add(new THREE.CylinderGeometry(0.35, 0.5, 6, 10), std(0x6b4a2b), C[0], base + 3.6, C[1]);
    for (let i = 0; i < 6; i++) { const l = add(new THREE.SphereGeometry(1.8, 12, 10), std(new THREE.Color().setHSL(0.3, 0.55, 0.3 + i * 0.02)), C[0] + Math.cos(i) * 1.5, base + 6.4 + (i % 3) * 0.7, C[1] + Math.sin(i) * 1.5); l.scale.y = 0.8; }
    this.block(0, C[0], C[1], 2.6, 2.6);
    for (let i = 0; i < 5; i++) { const a = 36 + i * 72, [bx, bz] = this.at(a, 4.6); const b = add(new RoundedBox(2.4, 0.45, 0.8, 2, 0.12), std(0x8a5a3b), bx, base + 0.45, bz, a * D); this.block(0, bx, bz, 0.9, 0.9); }
    // hanging lights
    for (let i = 0; i < 10; i++) { const [lx, lz] = this.at(i * 36, 10.5); add(new THREE.SphereGeometry(0.35, 12, 8), std(0xffffff, { emissive: 0xfff1c8, emissiveIntensity: 2 }), lx, base + H - 2.4, lz); }
    // shops
    for (const [id, sh] of Object.entries(SHOPS)) this.shop(id, sh);
    this.jobCenter();
    this.lab = labelSprite('🛍️ Pentagon Mall', 0.6, { bg: 'rgba(29,43,58,0.92)' }); this.lab.position.set(ex, base + 5.4, ez + 1); S.add(this.lab);
  }
  // a shop unit on the outer ring, facing the atrium, with its counter and sign
  shop(id, sh) {
    const S = this.world.scene, t = this.h.t, base = this.base, a = sh.a, ry = a * D + Math.PI, col = sh.color;
    const add = (geo, mat, x, y, z, r = ry) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = r; m.castShadow = m.receiveShadow = true; S.add(m); return m; };
    const [bx, bz] = this.at(a, 14.3), [cx, cz] = this.at(a, 11), [fx, fz] = this.at(a, 9.3), [px, pz] = this.at(a, 12.6);
    // back wall with a coloured panel and shelves
    add(new THREE.BoxGeometry(8, 4.2, 0.4), std(col, { roughness: 0.5 }), bx, base + 2.1, bz);
    for (let k = 0; k < 3; k++) add(new THREE.BoxGeometry(7, 0.12, 0.7), std(0xf4f1ea), ...this.at(a, 13.9).flatMap((v, i) => i ? [base + 0.9 + k * 1.1, v] : [v]));
    // goods on the shelves (little coloured boxes)
    for (let k = 0; k < 3; k++) for (let j = -3; j <= 3; j++) { const off = j * 0.95, [gx, gz] = this.at(a + off * 4.1, 13.8); add(new THREE.BoxGeometry(0.5, 0.6, 0.4), std(new THREE.Color().setHSL((j * 0.13 + k * 0.3 + a / 360) % 1, 0.7, 0.55)), gx, base + 1.3 + k * 1.1, gz); }
    // counter
    add(new RoundedBox(5, 1.1, 1.1, 2, 0.12), std(0xffffff, { roughness: 0.3 }), cx, base + 0.55, cz);
    add(new THREE.BoxGeometry(5.2, 0.08, 1.3), std(0x23272d, { metalness: 0.6, roughness: 0.25 }), cx, base + 1.12, cz);
    add(new THREE.BoxGeometry(4.6, 0.7, 0.05), std(col, { emissive: col, emissiveIntensity: 0.4 }), ...this.at(a, 10.43).flatMap((v, i) => i ? [base + 0.55, v] : [v]));
    this.block(0, cx, cz, 1.6, 1.6);
    // shopkeeper behind the counter
    const keeper = new Avatar({ skin: ['#f2c49b', '#d9a066', '#ffd9b8', '#c68642'][Object.keys(SHOPS).indexOf(id)], face: 'smile', hair: ['short', 'bun', 'long', 'short'][Object.keys(SHOPS).indexOf(id)], hairColor: '#2b1d14', top: 'plain', shirt: '#' + col.toString(16).padStart(6, '0'), pants: '#22293a', shoes: '#1b1b1b', hat: 'none', pet: 'none', height: 1 }, '', 'bot');
    keeper.group.position.set(px, base, pz); keeper.group.rotation.y = ry; S.add(keeper.group);
    this.world.updaters.push((dt, tt) => { keeper.animate(0, dt, false); if (!keeper.emote && Math.sin(tt * 0.6 + sh.a) > 0.996) keeper.play('wave'); });
    sh.keeper = keeper;
    // sign over the shop
    const sign = labelSprite(`${sh.icon} ${t('mall_' + id)}`, 0.62, { bg: '#' + col.toString(16).padStart(6, '0') }); sign.position.set(bx, base + 5, bz); S.add(sign);
    // café: a few tables and chairs in front
    if (id === 'cafe') for (const off of [-16, 0, 16]) { const [tx, tz] = this.at(a + off, 7.2); add(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 16), std(0xffffff), tx, base + 0.75, tz); add(new THREE.CylinderGeometry(0.06, 0.06, 0.75, 8), std(0x333333), tx, base + 0.37, tz); this.block(0, tx, tz, 0.4, 0.4); }
    // walk up to the counter to shop
    this.world.zone({ test: (x, y, z) => Math.hypot(x - fx, z - fz) < 1.5 && Math.abs(y - base) < 1.3, onEnter: () => { keeper.play('wave'); this.h.shop(id, sh); } });
    // café staff side (Barista job)
    if (id === 'cafe') { const [sx, sz] = this.at(a, 12.4); this.baristaSpot = { x: sx, z: sz, front: { x: fx, z: fz }, a }; this.world.zone({ test: (x, y, z) => Math.hypot(x - sx, z - sz) < 1.6 && Math.abs(y - base) < 1.3, onEnter: () => this.h.barista && this.h.barista(true), onLeave: () => this.h.barista && this.h.barista(false) }); }
  }
  jobCenter() {
    const S = this.world.scene, base = this.base, t = this.h.t, a = -28, [x, z] = this.at(a, 11), ry = a * D + Math.PI;
    const desk = new THREE.Mesh(new RoundedBox(3.4, 1.1, 1.1, 2, 0.12), std(0x1d2b3a, { metalness: 0.3 })); desk.position.set(x, base + 0.55, z); desk.rotation.y = ry; desk.castShadow = true; S.add(desk); this.block(0, x, z, 1.2, 1.2);
    const lab = labelSprite('💼 ' + t('jobCenter'), 0.55, { bg: 'rgba(230,126,34,0.95)' }); lab.position.set(x, base + 3, z); S.add(lab);
    const [fx, fz] = this.at(a, 9.2);
    this.world.zone({ test: (px, py, pz) => Math.hypot(px - fx, pz - fz) < 1.4 && Math.abs(py - base) < 1.3, onEnter: () => this.h.jobs && this.h.jobs() });
    const [ax, az] = this.at(28, 11.5); const atm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.8), std(0x23272d, { metalness: 0.6 })); atm.position.set(ax, base + 1.1, az); atm.rotation.y = 28 * D + Math.PI; S.add(atm); this.block(0, ax, az, 0.6, 0.6);
    const al = labelSprite('🏧 mBank', 0.4, { bg: 'rgba(15,42,74,0.9)' }); al.position.set(ax, base + 2.7, az); S.add(al);
  }
}

// ☕ Barista job: make the drink the customer orders from the right ingredients.
export const RECIPES = {
  coffee: ['espresso'], latte: ['espresso', 'milk'], cocoa: ['choco', 'milk'], tea: ['leaves'],
  icedlatte: ['espresso', 'milk', 'ice'], honeytea: ['leaves', 'honey'], mocha: ['espresso', 'choco', 'milk'],
};
export const INGREDIENTS = { espresso: '☕', milk: '🥛', choco: '🍫', leaves: '🍃', ice: '🧊', honey: '🍯' };
export const DRINK_ICON = { coffee: '☕', latte: '🧋', cocoa: '🍫', tea: '🍵', icedlatte: '🥤', honeytea: '🍯', mocha: '🤎' };
