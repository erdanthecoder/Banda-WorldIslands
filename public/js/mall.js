// 🛍️ Pentagon Mall: the biggest building on the island, a huge five-sided shopping centre west of the stadium.
// Inside, around a green atrium with a food court: eight shops (café with the Barista job, supermarket, toys,
// fashion, pets, sweets, pizza & burgers, Kyrgyz kitchen), the Job Center and an mBank ATM by the door,
// and a crowd of well over a hundred shoppers. Shops use the normal basket + mPAY checkout.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Building } from './buildings.js';
import { MALL, TEX, labelSprite, canvasTex } from './world.js';
import { Avatar } from './avatar.js';
import { CAFE } from './shop.js';
import { MallCrowd } from './crowd.js';

const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const glass = () => new THREE.MeshStandardMaterial({ color: 0x9cc3d6, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
const D = Math.PI / 180;
export const SHOPS = {
  cafe: { a: 54, icon: '☕', items: CAFE, cafe: true, color: 0x8a5a3b },
  market: { a: 90, icon: '🛒', items: ['apple', 'banana', 'juice', 'soda', 'chips', 'chocolate', 'pizza', 'burger', 'cake'], color: 0x2e9e5b },
  toys: { a: 126, icon: '🧸', items: ['ball', 'balloon', 'teddy'], color: 0xd6457a },
  fashion: { a: 162, icon: '👑', items: ['crown', 'headphones', 'tophat'], color: 0x7b2cbf },
  pets: { a: 198, icon: '🐶', items: ['dog', 'cat', 'bunny', 'dragon'], color: 0xe67e22 },
  sweets: { a: 234, icon: '🍦', items: ['icecream', 'chocolate', 'cake', 'juice', 'lemonade', 'pancakes'], cafe: true, color: 0x5b8def },
  pizza: { a: 270, icon: '🍕', items: ['pizza', 'burger', 'chips', 'soda', 'juice'], cafe: true, color: 0xe71d36 },
  kitchen: { a: 306, icon: '🍛', items: ['plov', 'lagman', 'manty', 'soup', 'salad', 'tea'], cafe: true, color: 0x16a085 },
};

export class Mall extends Building {
  constructor(world, h) {
    const M = MALL, ap = M.R * Math.cos(36 * D);
    super(world, { x: M.x, z: M.z, w: M.R * 2, d: M.R * 2, floors: 1, fh: 12, base: M.base, door: { width: 7 }, round: ap - 0.35 });
    this.h = h; this.ap = ap;
    // rings (distance from the centre): shop back walls, counters, where you stand to shop, the walking ring, the food court
    this.rb = ap - 2.4; this.rc = this.rb - 3.3; this.front = this.rc - 1.7; this.ring = [9.6, this.front - 1.2]; this.court = 6.8;
    this.build();
    this.fronts = Object.values(SHOPS).map(sh => ({ a: sh.a * D, r: this.front })).concat([{ a: -24 * D, r: this.front }, { a: 24 * D, r: this.front }]);
    this.crowd = new MallCrowd(world, { x: this.x, z: this.z, base: this.base, ring: this.ring, fronts: this.fronts, seats: this.seats, doorR: ap - 1.6 }, world.hq ? 140 : 112);
  }
  // a point at angle a (degrees, 0 = towards the door / south) and distance r from the centre
  at(a, r) { return [this.x + Math.sin(a * D) * r, this.z + Math.cos(a * D) * r]; }
  // waypoints from (a0, r0) to (a1, r1) that go round the walking ring instead of through the atrium
  route(a0, r0, a1, r1) {
    const rr = (this.ring[0] + this.ring[1]) / 2, pts = [this.at(a0, rr)], da = ((a1 - a0 + 540) % 360) - 180, n = Math.ceil(Math.abs(da) / 30);
    for (let k = 1; k < n; k++) pts.push(this.at(a0 + da * k / n, rr));
    pts.push(this.at(a1, rr), this.at(a1, r1)); return pts;
  }
  build() {
    const S = this.world.scene, t = this.h.t, base = this.base, H = 12, R = MALL.R, ap = this.ap, side = 2 * R * Math.sin(36 * D);
    const add = (geo, mat, x, y, z, ry = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = m.receiveShadow = true; S.add(m); return m; };
    const wallMat = this.world.texMat(TEX.plaster, side / 2, 4, { color: 0xf7f3ec, roughness: 0.85 }), band = std(0x1d2b3a, { metalness: 0.4, roughness: 0.4 });
    const stripes = [0xff9f1c, 0x2ec4b6, 0xe71d36, 0x7b2cbf, 0x3a86ff];
    // five walls: lower solid part, a coloured stripe, a tall glass band; the south wall has the entrance
    for (let i = 0; i < 5; i++) {
      const a = i * 72, [mx, mz] = this.at(a, ap), ry = a * D;
      const piece = (offset, len) => {
        const ox = mx + Math.cos(ry) * offset, oz = mz - Math.sin(ry) * offset;
        add(new THREE.BoxGeometry(len, 4.2, 0.5), wallMat, ox, base + 2.1, oz, ry);
        add(new THREE.BoxGeometry(len, 0.7, 0.6), new THREE.MeshStandardMaterial({ color: stripes[i], emissive: stripes[i], emissiveIntensity: 0.25 }), ox, base + 4.55, oz, ry);
      };
      if (i === 0) { const g = 3.5; piece(-(side / 2 + g) / 2, side / 2 - g); piece((side / 2 + g) / 2, side / 2 - g); }
      else piece(0, side);
      const gl = new THREE.Mesh(new THREE.PlaneGeometry(side, H - 4.9), glass()); gl.position.set(mx, base + 4.9 + (H - 4.9) / 2, mz); gl.rotation.y = ry; S.add(gl);
      // glass mullions
      for (let k = 1; k < 6; k++) { const off = -side / 2 + side * k / 6; add(new THREE.BoxGeometry(0.15, H - 4.9, 0.2), band, mx + Math.cos(ry) * off, base + 4.9 + (H - 4.9) / 2, mz - Math.sin(ry) * off, ry); }
      add(new THREE.BoxGeometry(side + 0.4, 0.6, 0.8), band, mx, base + H, mz, ry);
    }
    for (let i = 0; i < 5; i++) { const [vx, vz] = this.at(36 + i * 72, R); add(new THREE.CylinderGeometry(0.6, 0.6, H + 0.6, 12), band, vx, base + H / 2, vz); }
    // the roof: a pentagon ring with a big glass skylight in the middle
    const poly = r => { const sh = new THREE.Shape(); for (let i = 0; i < 5; i++) { const vx = Math.sin((36 + i * 72) * D) * r, vz = Math.cos((36 + i * 72) * D) * r; i ? sh.lineTo(vx, -vz) : sh.moveTo(vx, -vz); } return sh; };
    const shape = poly(R + 0.8), hole = new THREE.Path(poly(14).getPoints()); shape.holes.push(hole);
    add(new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false }).rotateX(-Math.PI / 2), std(0xe9e4da), this.x, base + H + 0.3, this.z);
    const sky = new THREE.Mesh(new THREE.ShapeGeometry(poly(14.2)).rotateX(-Math.PI / 2), glass()); sky.position.set(this.x, base + H + 0.9, this.z); S.add(sky);
    for (let i = 0; i < 5; i++) { const a = 36 + i * 72, [bx, bz] = this.at(a, 7); add(new THREE.BoxGeometry(0.3, 0.4, 14.2), band, bx, base + H + 0.85, bz, a * D); }
    // floor
    const fl = new THREE.Mesh(new THREE.CircleGeometry(R, 5, -54 * D).rotateX(-Math.PI / 2), this.world.texMat(TEX.tile, R * 1.4, R * 1.4, { color: 0xf1ede6, roughness: 0.3 })); fl.position.set(this.x, base + 0.04, this.z); fl.receiveShadow = true; S.add(fl);
    // a coloured walking ring on the floor
    const ringM = new THREE.Mesh(new THREE.RingGeometry(this.ring[0] - 0.4, this.ring[0], 60).rotateX(-Math.PI / 2), std(0xc9b48a, { roughness: 0.4 })); ringM.position.set(this.x, base + 0.05, this.z); ringM.receiveShadow = true; S.add(ringM);
    // entrance canopy + big sign
    const [ex, ez] = this.at(0, ap + 1.8);
    add(new THREE.BoxGeometry(11, 0.35, 3.8), band, ex, base + 5.4, ez);
    for (const sx of [-1, 1]) add(new THREE.CylinderGeometry(0.18, 0.18, 5.4, 10), band, ex + sx * 5.1, base + 2.7, ez + 1.6);
    const logo = canvasTex(1024, 256, (c, W, Hh) => {
      c.clearRect(0, 0, W, Hh); c.fillStyle = '#1d2b3a'; c.beginPath(); c.roundRect(8, 24, W - 16, Hh - 48, 40); c.fill();
      c.save(); c.translate(120, Hh / 2); for (let i = 0; i < 5; i++) { c.fillStyle = '#' + stripes[i].toString(16).padStart(6, '0'); c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 70, -Math.PI / 2 + i * 1.2566, -Math.PI / 2 + (i + 1) * 1.2566); c.fill(); } c.restore();
      c.fillStyle = '#fff'; c.font = '900 92px Manrope, system-ui'; c.textBaseline = 'middle'; c.fillText('PENTAGON', 220, Hh / 2 - 8); c.fillStyle = '#ffd34d'; c.font = '800 46px Manrope, system-ui'; c.fillText('MALL', 760, Hh / 2 + 4);
    });
    const sg = new THREE.Mesh(new THREE.PlaneGeometry(20, 5), new THREE.MeshBasicMaterial({ map: logo, transparent: true })); sg.position.set(ex, base + H + 3, ez - 1.6); S.add(sg);
    // the atrium: a big planter with a tree, and the food court around it
    const C = [this.x, this.z];
    add(new THREE.CylinderGeometry(4.2, 4.4, 0.9, 5), std(0xd8d2c6), C[0], base + 0.45, C[1]).rotation.y = 54 * D;
    add(new THREE.CylinderGeometry(4, 4, 0.1, 5), std(0x4a7d2a), C[0], base + 0.95, C[1]).rotation.y = 54 * D;
    add(new THREE.CylinderGeometry(0.45, 0.65, 8, 10), std(0x6b4a2b), C[0], base + 4.8, C[1]);
    for (let i = 0; i < 8; i++) { const l = add(new THREE.SphereGeometry(2.4, 12, 10), std(new THREE.Color().setHSL(0.3, 0.55, 0.28 + i * 0.02)), C[0] + Math.cos(i * 0.8) * 2, base + 8.4 + (i % 3) * 0.9, C[1] + Math.sin(i * 0.8) * 2); l.scale.y = 0.8; }
    this.block(0, C[0], C[1], 3.7, 3.7);
    // food court: ten round tables, each with two stools (the crowd sits here too)
    this.seats = [];
    const tableM = std(0xffffff, { roughness: 0.3 }), legM = std(0x333333), stoolM = std(0xff9f1c);
    for (let i = 0; i < 10; i++) {
      const a = 18 + i * 36, [tx, tz] = this.at(a, this.court);
      add(new THREE.CylinderGeometry(0.7, 0.7, 0.06, 18), tableM, tx, base + 0.8, tz); add(new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), legM, tx, base + 0.4, tz);
      this.block(0, tx, tz, 0.45, 0.45);
      for (const s of [-1, 1]) {
        // stools on either side of the table, along the ring
        const sa = a + s * (1.05 / this.court) / D, [sx, sz] = this.at(sa, this.court);
        add(new THREE.CylinderGeometry(0.28, 0.28, 0.5, 12), stoolM, sx, base + 0.25, sz);
        this.seats.push({ a: sa * D, r: this.court, face: Math.atan2(tx - sx, tz - sz) });
      }
    }
    // hanging lights and colourful banners from the skylight
    for (let i = 0; i < 15; i++) { const [lx, lz] = this.at(i * 24, 15.5); add(new THREE.SphereGeometry(0.42, 12, 8), std(0xffffff, { emissive: 0xfff1c8, emissiveIntensity: 2 }), lx, base + H - 2.8, lz); }
    for (let i = 0; i < 5; i++) { const a = 36 + i * 72, [bx, bz] = this.at(a, 12.5); const bn = add(new THREE.PlaneGeometry(1.6, 4), new THREE.MeshStandardMaterial({ color: stripes[i], side: THREE.DoubleSide, roughness: 0.8 }), bx, base + H - 2.6, bz, a * D + Math.PI / 2); bn.castShadow = false; }
    // shops
    for (const [id, sh] of Object.entries(SHOPS)) this.shop(id, sh);
    this.jobCenter();
    this.lab = labelSprite('🛍️ Pentagon Mall', 0.7, { bg: 'rgba(29,43,58,0.92)' }); this.lab.position.set(ex, base + 6.5, ez + 1); S.add(this.lab);
  }
  // a shop unit on the outer ring, facing the atrium, with its counter and sign
  shop(id, sh) {
    const S = this.world.scene, t = this.h.t, base = this.base, a = sh.a, ry = a * D + Math.PI, col = sh.color, rb = this.rb, rc = this.rc;
    const add = (geo, mat, x, y, z, r = ry) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = r; m.castShadow = m.receiveShadow = true; S.add(m); return m; };
    const [bx, bz] = this.at(a, rb), [cx, cz] = this.at(a, rc), [fx, fz] = this.at(a, this.front), [px, pz] = this.at(a, rb - 1.7);
    // back wall with a coloured panel and shelves
    add(new THREE.BoxGeometry(9, 5, 0.4), std(col, { roughness: 0.5 }), bx, base + 2.5, bz);
    for (let q = 0; q < 3; q++) add(new THREE.BoxGeometry(8, 0.12, 0.7), std(0xf4f1ea), ...this.at(a, rb - 0.4).flatMap((v, i) => i ? [base + 0.9 + q * 1.1, v] : [v]));
    // side walls so each shop is its own unit
    for (const s of [-1, 1]) { const sa = a + s * (4.6 / rb) / D, [wx, wz] = this.at(sa, rb - 1.6); add(new THREE.BoxGeometry(0.3, 4.4, 3.2), std(0xf7f3ec), wx, base + 2.2, wz, sa * D); }
    // goods on the shelves (little coloured boxes)
    for (let q = 0; q < 3; q++) for (let j = -3; j <= 3; j++) { const off = j * 1.05, [gx, gz] = this.at(a + off / rb / D, rb - 0.5); add(new THREE.BoxGeometry(0.5, 0.6, 0.4), std(new THREE.Color().setHSL((j * 0.13 + q * 0.3 + a / 360) % 1, 0.7, 0.55)), gx, base + 1.3 + q * 1.1, gz); }
    // counter
    add(new RoundedBox(5, 1.1, 1.1, 2, 0.12), std(0xffffff, { roughness: 0.3 }), cx, base + 0.55, cz);
    add(new THREE.BoxGeometry(5.2, 0.08, 1.3), std(0x23272d, { metalness: 0.6, roughness: 0.25 }), cx, base + 1.12, cz);
    add(new THREE.BoxGeometry(4.6, 0.7, 0.05), std(col, { emissive: col, emissiveIntensity: 0.4 }), ...this.at(a, rc - 0.57).flatMap((v, i) => i ? [base + 0.55, v] : [v]));
    this.block(0, cx, cz, 1.6, 1.6);
    // shopkeeper behind the counter
    const n = Object.keys(SHOPS).indexOf(id);
    const keeper = new Avatar({ skin: ['#f2c49b', '#d9a066', '#ffd9b8', '#c68642'][n % 4], face: 'smile', hair: ['short', 'bun', 'long', 'short', 'curly', 'spiky'][n % 6], hairColor: '#2b1d14', top: 'plain', shirt: '#' + col.toString(16).padStart(6, '0'), pants: '#22293a', shoes: '#1b1b1b', hat: 'none', pet: 'none', height: 1 }, '', 'bot');
    keeper.group.position.set(px, base, pz); keeper.group.rotation.y = ry; S.add(keeper.group);
    this.world.updaters.push((dt, tt) => { keeper.animate(0, dt, false); if (!keeper.emote && Math.sin(tt * 0.6 + sh.a) > 0.996) keeper.play('wave'); });
    sh.keeper = keeper;
    // sign over the shop
    const sign = labelSprite(`${sh.icon} ${t('mall_' + id)}`, 0.72, { bg: '#' + col.toString(16).padStart(6, '0') }); sign.position.set(bx, base + 5.8, bz); S.add(sign);
    // walk up to the counter to shop
    this.world.zone({ test: (x, y, z) => Math.hypot(x - fx, z - fz) < 1.5 && Math.abs(y - base) < 1.3, onEnter: () => { keeper.play('wave'); this.h.shop(id, sh); } });
    // café staff side (Barista job)
    if (id === 'cafe') { const [sx, sz] = this.at(a, rc + 1.4); this.baristaSpot = { x: sx, z: sz, front: { x: fx, z: fz }, a }; this.world.zone({ test: (x, y, z) => Math.hypot(x - sx, z - sz) < 1.6 && Math.abs(y - base) < 1.3, onEnter: () => this.h.barista && this.h.barista(true), onLeave: () => this.h.barista && this.h.barista(false) }); }
  }
  jobCenter() {
    const S = this.world.scene, base = this.base, t = this.h.t, a = -24, [x, z] = this.at(a, this.rc), ry = a * D + Math.PI;
    const desk = new THREE.Mesh(new RoundedBox(3.4, 1.1, 1.1, 2, 0.12), std(0x1d2b3a, { metalness: 0.3 })); desk.position.set(x, base + 0.55, z); desk.rotation.y = ry; desk.castShadow = true; S.add(desk); this.block(0, x, z, 1.2, 1.2);
    const lab = labelSprite('💼 ' + t('jobCenter'), 0.6, { bg: 'rgba(230,126,34,0.95)' }); lab.position.set(x, base + 3.2, z); S.add(lab);
    const [fx, fz] = this.at(a, this.front);
    this.world.zone({ test: (px, py, pz) => Math.hypot(px - fx, pz - fz) < 1.4 && Math.abs(py - base) < 1.3, onEnter: () => this.h.jobs && this.h.jobs() });
    const [ax, az] = this.at(24, this.rc + 0.5); const atm = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.2, 0.8), std(0x23272d, { metalness: 0.6 })); atm.position.set(ax, base + 1.1, az); atm.rotation.y = 24 * D + Math.PI; S.add(atm); this.block(0, ax, az, 0.6, 0.6);
    const al = labelSprite('🏧 mBank', 0.45, { bg: 'rgba(15,42,74,0.9)' }); al.position.set(ax, base + 2.7, az); S.add(al);
  }
}

// ☕ Barista job: make the drink the customer orders from the right ingredients.
export const RECIPES = {
  coffee: ['espresso'], latte: ['espresso', 'milk'], cocoa: ['choco', 'milk'], tea: ['leaves'],
  icedlatte: ['espresso', 'milk', 'ice'], honeytea: ['leaves', 'honey'], mocha: ['espresso', 'choco', 'milk'],
};
export const INGREDIENTS = { espresso: '☕', milk: '🥛', choco: '🍫', leaves: '🍃', ice: '🧊', honey: '🍯' };
export const DRINK_ICON = { coffee: '☕', latte: '🧋', cocoa: '🍫', tea: '🍵', icedlatte: '🥤', honeytea: '🍯', mocha: '🤎' };
