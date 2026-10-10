// 🏨 Island Grand Hotel: a real five-storey hotel north-east of the plaza.
//  1 Lobby — reception (book a room with mPAY), lounge, piano, luggage cart, elevator
//  2–3 Rooms 201–208 and 301–308 — your key opens only your room: bed you can bounce on, TV, mini-bar, room service
//  4 Sky Suites 401–402 — big bed, sofa, giant TV and a jacuzzi
//  5 Roof — swimming pool, a twisty water slide, sun loungers, a DJ and the Roof Bar
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { Building } from './buildings.js';
import { HOTEL, TEX, labelSprite, canvasTex } from './world.js';
import { Avatar } from './avatar.js';
import { Guests } from './crowd.js';

const $ = s => document.querySelector(s);
const el = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });
const glass = () => new THREE.MeshStandardMaterial({ color: 0x9cc3d6, metalness: 0.9, roughness: 0.05, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
const DAY = 24 * 3600 * 1000;
// the elevator shaft (same spot on every floor) and where you step out
const LIFT = { x0: 55.2, x1: 58.8, z: -70, out: { x: 60.2, z: -70 } };

export class Hotel extends Building {
  constructor(world, h) {
    const H = HOTEL;
    super(world, { x: H.x, z: H.z, w: H.w, d: H.d, floors: H.floors, fh: H.fh, base: H.base, door: { side: 'w', at: H.door, width: 3.4 } });
    this.h = h; this.rooms = [];
    this.M = {
      wall: world.texMat(TEX.plaster, 6, 4, { color: 0xf6efe4, roughness: 0.85 }), band: std(0x23324a, { metalness: 0.35, roughness: 0.45 }), gold: std(0xd4af37, { metalness: 0.85, roughness: 0.25 }),
      carpet: std(0x8c1d3a, { roughness: 0.95 }), wood: std(0x6b4226, { roughness: 0.5 }), white: std(0xffffff, { roughness: 0.45 }), sheet: std(0xf7f7fb, { roughness: 0.9 }),
      dark: std(0x1b1d22, { roughness: 0.4 }), glow: std(0xffffff, { emissive: 0xfff1c8, emissiveIntensity: 1.8 }), slab: world.texMat(TEX.concrete, 8, 6, { color: 0xe9e4da }),
      marble: world.texMat(TEX.tile, 10, 8, { color: 0xf3efe8, roughness: 0.25 }), floor: world.texMat(TEX.wood, 8, 6, { color: 0xc49a6c, roughness: 0.5 }),
      green: std(0x2f7d3a), pot: std(0xe8e4dc), water: new THREE.MeshStandardMaterial({ color: 0x3fc6ff, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.72, depthWrite: false }),
      tile: std(0x9fe3ff, { roughness: 0.3 }),
    };
    this.ui(); this.shell(); this.lift(); this.lobby(); [1, 2].forEach(lv => this.roomFloor(lv)); this.suites(); this.roof();
    this.refreshDoors();
  }
  get t() { return this.h.t; }
  // ---------- small helpers ----------
  mesh(geo, mat, x, y, z, ry = 0, cast = true) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.castShadow = cast; m.receiveShadow = true; this.world.scene.add(m); return m; }
  bx(lv, x, y, z, w, h, d, mat, solid = false, ry = 0) { const m = this.mesh(new THREE.BoxGeometry(w, h, d), mat, x, this.floorY(lv) + y, z, ry); if (solid) this.block(lv, x, z, ry ? d / 2 : w / 2, ry ? w / 2 : d / 2); return m; }
  plant(lv, x, z) {
    this.bx(lv, x, 0.4, z, 0.8, 0.8, 0.8, this.M.pot, true);
    for (let i = 0; i < 5; i++) this.mesh(new THREE.SphereGeometry(0.45, 10, 8), this.M.green, x + Math.cos(i * 1.3) * 0.25, this.floorY(lv) + 1.1 + (i % 3) * 0.3, z + Math.sin(i * 1.3) * 0.25);
  }
  label(text, x, y, z, size = 0.45, bg = 'rgba(35,50,74,0.92)') { const l = labelSprite(text, size, { bg }); l.position.set(x, y, z); this.world.scene.add(l); return l; }
  zoneAt(lv, test, onEnter, onLeave) { const y = this.floorY(lv); this.world.zone({ test: (px, py, pz) => Math.abs(py - y) < 1.5 && test(px, pz, py - y), onEnter, onLeave }); }

  // ---------- outside: glass bands, balconies of light, a big sign, entrance canopy, doorman ----------
  shell() {
    const { x, z, w, d, minX, maxX, minZ, maxZ, fh, M } = this, S = this.world.scene, door = this.door.at;
    for (let lv = 0; lv < 4; lv++) {
      const y = this.floorY(lv);
      const side = (cx, cz, len, ry, gap) => {
        const segs = gap ? [[-len / 2, gap[0]], [gap[1], len / 2]] : [[-len / 2, len / 2]];
        for (const [a, b] of segs) {
          const L = b - a, o = (a + b) / 2, ox = cx + Math.cos(ry) * o, oz = cz - Math.sin(ry) * o;
          this.mesh(new THREE.BoxGeometry(L, 0.9, 0.35), M.wall, ox, y + 0.45, oz, ry);
          const g = new THREE.Mesh(new THREE.PlaneGeometry(L, 2.5), glass()); g.position.set(ox, y + 2.15, oz); g.rotation.y = ry; S.add(g);
        }
        this.mesh(new THREE.BoxGeometry(len, 1.0, 0.4), M.wall, cx, y + 3.9, cz, ry);
        for (let k = 0; k <= Math.round(len / 3); k++) { const o = -len / 2 + k * len / Math.round(len / 3), ox = cx + Math.cos(ry) * o, oz = cz - Math.sin(ry) * o; if (gap && o > gap[0] - 0.1 && o < gap[1] + 0.1) continue; this.mesh(new THREE.BoxGeometry(0.14, 2.5, 0.16), M.band, ox, y + 2.15, oz, ry); }
      };
      side(x, minZ, w, 0); side(x, maxZ, w, 0); side(maxX, z, d, Math.PI / 2);
      // west side: the entrance on the ground floor (ry = -90° runs along z from south to north)
      side(minX, z, d, -Math.PI / 2, lv === 0 ? [door - z - 1.7, door - z + 1.7] : null);
    }
    // floor slabs (each is the ceiling of the floor below) with glowing ceiling panels
    this.mesh(new THREE.BoxGeometry(w, 0.12, d), M.marble, x, this.base + 0.0, z, 0, false);
    for (let lv = 1; lv < 5; lv++) {
      this.mesh(new THREE.BoxGeometry(w + 0.6, 0.3, d + 0.6), M.slab, x, this.floorY(lv) - 0.15, z);
      for (let i = 0; i < 4; i++) for (const sz of [-1, 1]) this.mesh(new THREE.BoxGeometry(2.2, 0.04, 0.8), M.glow, minX + 7 + i * 6.6, this.floorY(lv) - 0.32, z + sz * 5, 0, false);
    }
    // roof parapet: a low glass rail and a gold edge
    const ry4 = this.floorY(4);
    for (const [cx, cz, len, ry] of [[x, minZ, w, 0], [x, maxZ, w, 0], [minX, z, d, Math.PI / 2], [maxX, z, d, Math.PI / 2]]) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(len, 1.1), glass()); g.position.set(cx, ry4 + 0.55, cz); g.rotation.y = ry; S.add(g);
      this.mesh(new THREE.BoxGeometry(len + 0.3, 0.12, 0.2), M.gold, cx, ry4 + 1.12, cz, ry);
    }
    // the big sign on the roof, facing the plaza (west) and the road (south)
    const sign = canvasTex(1024, 256, (c, W, Hh) => {
      c.clearRect(0, 0, W, Hh); c.fillStyle = '#23324a'; c.beginPath(); c.roundRect(8, 30, W - 16, Hh - 60, 36); c.fill(); c.strokeStyle = '#d4af37'; c.lineWidth = 8; c.stroke();
      c.fillStyle = '#ffd34d'; c.font = '900 84px Manrope, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ISLAND GRAND HOTEL', W / 2, Hh / 2 - 14);
      c.font = '700 40px Manrope, system-ui'; c.fillStyle = '#fff'; c.fillText('★ ★ ★ ★ ★', W / 2, Hh / 2 + 46);
    });
    const sm = new THREE.MeshBasicMaterial({ map: sign, transparent: true, side: THREE.DoubleSide });
    const s1 = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), sm); s1.position.set(minX - 0.2, ry4 + 3.4, z); s1.rotation.y = -Math.PI / 2; S.add(s1);
    const s2 = new THREE.Mesh(new THREE.PlaneGeometry(18, 4.5), sm); s2.position.set(x, ry4 + 3.4, maxZ + 0.2); S.add(s2);
    for (const k of [-1, 1]) this.mesh(new THREE.BoxGeometry(0.2, 3.2, 0.2), M.band, minX + 0.2, ry4 + 1.6, z + k * 7);
    // entrance canopy with gold posts, a red carpet and the doorman
    this.mesh(new THREE.BoxGeometry(4.2, 0.3, 5), M.band, minX - 2, this.base + 3.6, door);
    for (const k of [-1, 1]) this.mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.6, 10), M.gold, minX - 3.8, this.base + 1.8, door + k * 2.2);
    this.mesh(new THREE.BoxGeometry(5, 0.04, 2.4), M.carpet, minX - 2.2, this.base + 0.04, door, 0, false);
    this.mesh(new THREE.BoxGeometry(22, 0.03, 2.2), M.carpet, minX + 11, this.base + 0.08, door, 0, false);
    const dm = new Avatar({ skin: '#d9a066', face: 'smile', hair: 'short', hairColor: '#1c1410', top: 'plain', shirt: '#8c1d3a', pants: '#1d1d1f', shoes: '#111', hat: 'cap', pet: 'none', height: 1.05 }, '', 'bot');
    dm.group.position.set(minX - 3, this.base, door - 2.9); dm.group.rotation.y = -Math.PI / 2; S.add(dm.group);
    this.world.solids.push({ x: minX - 3, z: door - 2.9, r: 0.4 });
    this.world.zone({ x: minX - 3, z: door - 2.9, r: 4, onEnter: () => { dm.play('wave'); this.h.sfx('chime'); } });
    this.world.updaters.push((dt, tt) => { dm.animate(0, dt, false); if (!dm.emote && Math.sin(tt * 0.5) > 0.995) dm.play('wave'); });
    this.label('🏨 Island Grand Hotel', minX - 2.4, this.base + 4.5, door, 0.6, 'rgba(140,29,58,0.92)');
  }

  // ---------- the elevator: same shaft on every floor; step in and choose a floor ----------
  lift() {
    const { M } = this, cz = LIFT.z, steel = std(0xb8bec6, { metalness: 0.9, roughness: 0.25 });
    for (let lv = 0; lv < 5; lv++) {
      const y = lv === 4 ? 3.1 : this.fh - 0.3;
      for (const k of [-1, 1]) this.bx(lv, (LIFT.x0 + LIFT.x1) / 2, y / 2, cz + k * 1.65, LIFT.x1 - LIFT.x0, y, 0.2, M.band, true);
      this.bx(lv, LIFT.x1, 2.75, cz, 0.25, 0.4, 3.5, M.gold);
      this.bx(lv, LIFT.x0 + 0.15, 1.4, cz, 0.1, 2.8, 3.0, steel);
      this.bx(lv, (LIFT.x0 + LIFT.x1) / 2, 0.06, cz, 3.4, 0.08, 3.0, M.dark);
      if (lv === 4) this.bx(lv, (LIFT.x0 + LIFT.x1) / 2, 3.2, cz, 3.8, 0.25, 3.6, M.band);
      this.label(['🛎️', '2', '3', '🌟 4', '🌴 5'][lv] + ' · ' + this.t('hotelLift'), LIFT.x1 + 0.2, this.floorY(lv) + 3.2, cz, 0.32);
      this.zoneAt(lv, (px, pz) => px > LIFT.x0 && px < LIFT.x1 - 0.2 && Math.abs(pz - cz) < 1.4, () => this.liftPanel(lv));
    }
  }
  liftPanel(cur) {
    const t = this.t, names = [t('hotelF1'), t('hotelF2'), t('hotelF3'), t('hotelF4'), t('hotelF5')];
    this.h.sfx('ding');
    this.open('🛗 ' + t('hotelLift'), `<div class="lift-grid">${names.map((n, lv) => `<button class="lift-btn${lv === cur ? ' here' : ''}" data-lv="${lv}"><b>${lv === 4 ? '🌴' : lv + 1}</b><span>${n}</span></button>`).join('')}</div>`);
    document.querySelectorAll('#hotelBody .lift-btn').forEach(b => b.onclick = () => {
      const lv = +b.dataset.lv; this.close(); if (lv === cur) return this.stepOut(cur);
      // doors close, a little ride, ding — and you're there
      const f = $('#hotelFade'); f.classList.add('on'); this.h.sfx('whoosh');
      setTimeout(() => { this.stepOut(lv); this.h.sfx('ding'); f.classList.remove('on'); this.h.banner(`🛗 ${names[lv]}`, 1800); }, 650);
    });
  }
  stepOut(lv) { this.world.teleport(LIFT.out.x, LIFT.out.z, -Math.PI / 2, this.floorY(lv) + 0.05); }

  // ---------- 1: the lobby ----------
  lobby() {
    const { M, minX, maxX, minZ, maxZ, z } = this, lv = 0, S = this.world.scene, t = this.t;
    // reception desk along the east wall, the receptionist and a bell
    const dx = maxX - 6;
    this.mesh(new RoundedBox(1.2, 1.15, 7, 2, 0.1), M.wood, dx, this.base + 0.58, z); this.block(lv, dx, z, 0.65, 3.5);
    this.bx(lv, dx, 1.2, z, 1.4, 0.08, 7.2, M.gold);
    this.mesh(new THREE.SphereGeometry(0.14, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.gold, dx - 0.3, this.base + 1.24, z + 1.5);
    const rc = new Avatar({ skin: '#f2c49b', face: 'smile', hair: 'bun', hairColor: '#4a2c17', top: 'plain', shirt: '#8c1d3a', pants: '#1d1d1f', shoes: '#111', hat: 'none', pet: 'none', height: 1 }, '', 'bot');
    rc.group.position.set(dx + 1.6, this.base, z); rc.group.rotation.y = -Math.PI / 2; S.add(rc.group);
    this.world.updaters.push((dt, tt) => { rc.animate(0, dt, false); if (!rc.emote && Math.sin(tt * 0.7) > 0.996) rc.play('wave'); });
    const logo = canvasTex(1024, 256, (c, W, Hh) => { c.fillStyle = '#23324a'; c.fillRect(0, 0, W, Hh); c.fillStyle = '#d4af37'; c.font = '900 90px Manrope, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('ISLAND GRAND', W / 2, Hh / 2 - 20); c.font = '700 44px Manrope, system-ui'; c.fillText('H O T E L', W / 2, Hh / 2 + 56); });
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(8, 2), new THREE.MeshBasicMaterial({ map: logo })); lg.position.set(maxX - 0.25, this.base + 2.8, z); lg.rotation.y = -Math.PI / 2; S.add(lg);
    this.label('🛎️ ' + t('hotelDesk'), dx - 0.6, this.base + 2.4, z, 0.5, 'rgba(140,29,58,0.95)');
    this.zoneAt(lv, (px, pz) => px > dx - 2.4 && px < dx - 0.6 && Math.abs(pz - z) < 2.2, () => { rc.play('wave'); this.desk(); });
    // lounge: two sofas and a coffee table (south-east), piano (north-west), luggage cart, plants, chandelier
    const sofa = (x, zz, ry) => { const g = new THREE.Group(), red = std(0x2b4c7e, { roughness: 0.85 }); const seat = new THREE.Mesh(new RoundedBox(3, 0.5, 1, 2, 0.12), red); seat.position.y = 0.35; const back = new THREE.Mesh(new RoundedBox(3, 0.8, 0.3, 2, 0.1), red); back.position.set(0, 0.85, -0.4); g.add(seat, back); g.position.set(x, this.base, zz); g.rotation.y = ry; g.traverse(o => { o.castShadow = o.receiveShadow = true; }); S.add(g); this.block(lv, x, zz, ry ? 0.55 : 1.5, ry ? 1.5 : 0.55); };
    sofa(71, minZ + 1.2, 0); sofa(71, minZ + 5.6, Math.PI);
    this.mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.45, 20), M.wood, 71, this.base + 0.22, minZ + 3.4); this.block(lv, 71, minZ + 3.4, 0.8, 0.8);
    this.bx(lv, minX + 7, 0.55, minZ + 2, 2.4, 1.1, 1.4, M.dark, true); this.bx(lv, minX + 7, 1.15, minZ + 2.6, 2.4, 0.3, 0.3, M.dark);
    this.bx(lv, minX + 7, 0.3, minZ + 3.6, 1.2, 0.6, 0.5, M.dark);
    this.label('🎹', minX + 7, this.base + 2, minZ + 2, 0.5, null);
    this.bx(lv, dx - 2.5, 0.45, z + 5, 1.4, 0.1, 0.8, M.gold); for (const [cx, col] of [[-0.3, 0x2e6fd1], [0.35, 0xc0392b]]) this.bx(lv, dx - 2.5 + cx, 0.85, z + 5, 0.5, 0.7, 0.5, std(col));
    for (const [px, pz] of [[minX + 1, minZ + 1], [maxX - 1, minZ + 1], [maxX - 1, maxZ - 1], [minX + 1, maxZ - 1], [dx - 1.5, z - 4.5]]) this.plant(lv, px, pz);
    for (let i = 0; i < 8; i++) this.mesh(new THREE.SphereGeometry(0.22, 10, 8), M.glow, 70 + Math.cos(i / 8 * 6.28) * 1.2, this.base + 3.3, z + Math.sin(i / 8 * 6.28) * 1.2, 0, false);
    this.mesh(new THREE.TorusGeometry(1.2, 0.06, 8, 32).rotateX(Math.PI / 2), M.gold, 70, this.base + 3.45, z);
    this.mesh(new THREE.BoxGeometry(18, 0.02, 2.2), M.carpet, minX + 12, this.base + 0.07, this.door.at, 0, false);
  }

  // ---------- 2–3: rooms ----------
  roomFloor(lv) {
    const { M, z, maxX } = this, H = this.fh - 0.3;
    this.mesh(new THREE.BoxGeometry(maxX - 59, 0.03, 3), M.carpet, (59 + maxX) / 2, this.floorY(lv) + 0.05, z, 0, false);
    for (let i = 0; i < 4; i++) for (const sg of [-1, 1]) this.room(lv, i, sg, (lv + 1) * 100 + i * 2 + (sg > 0 ? 2 : 1));
    this.bx(lv, maxX - 0.3, H / 2, z, 0.2, H, 3, M.wall); this.plant(lv, maxX - 1.1, z);
    for (let i = 0; i < 4; i++) this.mesh(new THREE.BoxGeometry(0.8, 0.04, 0.8), M.glow, 61 + i * 6.4, this.floorY(lv) + this.fh - 0.36, z, 0, false);
  }
  room(lv, i, sg, num, wide = false) {
    const { M } = this, y0 = this.floorY(lv), H = this.fh - 0.3, x0 = wide ? 59 : 59 + i * 6.4, x1 = wide ? 84.7 : x0 + 6.4, xc = (x0 + x1) / 2;
    const zc = this.z + sg * 1.5, zo = this.z + sg * 10.8, zm = (zc + zo) / 2, dz = Math.abs(zo - zc), doorX = x0 + 1.4, tvRot = sg > 0 ? 0 : Math.PI;
    this.mesh(new THREE.BoxGeometry(x1 - x0, 0.04, dz), M.floor, xc, y0 + 0.02, zm, 0, false);
    // walls: corridor side with a door opening, and the side walls
    for (const [a, b] of [[x0, doorX - 0.75], [doorX + 0.75, x1]]) this.bx(lv, (a + b) / 2, H / 2, zc, b - a, H, 0.2, M.wall, true);
    this.bx(lv, doorX, H - 0.45, zc, 1.5, 0.9, 0.2, M.wall);
    this.bx(lv, x0, H / 2, zm, 0.2, H, dz, M.wall, true);
    // the door: open (and green) only for your room
    const door = this.bx(lv, doorX, 1.15, zc, 1.4, 2.3, 0.08, M.wood); door.userData.dynamic = true;
    const lock = this.bx(lv, doorX + 0.55, 1.25, zc - sg * 0.07, 0.1, 0.18, 0.04, std(0xff3b3b, { emissive: 0xff3b3b, emissiveIntensity: 1.5 })); lock.userData.dynamic = true;
    const tag = this.label(`🚪 ${num}`, doorX, y0 + 2.75, zc - sg * 0.4, 0.3);
    const R = { num, lv, door, lock, tag, x: doorX, z: zc, suite: wide, inside: { x: xc, z: zm } };
    this.rooms.push(R);
    this.dynamicWalls.push({ lv, x: doorX, z: zc, hw: 0.75, hd: 0.15, on: () => !this.mine(num) });
    // furniture: bed (bouncy!), nightstand + lamp, TV, armchair, rug, mini-bar
    const bw = wide ? 2.6 : 1.9, bl = 2.2, bxC = wide ? x1 - 4 : xc + 0.9, bzC = zo - sg * (bl / 2 + 0.25);
    this.bx(lv, bxC, 0.25, bzC, bw, 0.5, bl, M.wood);
    this.bx(lv, bxC, 0.55, bzC, bw - 0.1, 0.2, bl - 0.1, M.sheet);
    this.bx(lv, bxC, 0.55, bzC - sg * 0.2, bw - 0.08, 0.22, bl * 0.55, std([0x2e6fd1, 0x8c1d3a, 0x2e9e5b, 0xff9f1c][num % 4], { roughness: 0.9 }));
    for (const k of [-1, 1]) this.bx(lv, bxC + k * bw / 4, 0.72, zo - sg * 0.5, bw / 2 - 0.15, 0.18, 0.4, M.white);
    this.bx(lv, bxC, 0.9, zo - sg * 0.12, bw + 0.2, 1.8, 0.12, M.wood);
    const top = y0 + 0.66;
    this.floorFns[lv] = this.chain(this.floorFns[lv], (ax, az) => (Math.abs(ax - bxC) < bw / 2 && Math.abs(az - bzC) < bl / 2 ? top : null));
    this.zoneAt(lv, (px, pz, dy) => Math.abs(px - bxC) < bw / 2 - 0.1 && Math.abs(pz - bzC) < bl / 2 - 0.1 && dy > 0.5 && dy < 0.75 && this.world.onGround,
      () => { if (!this.mine(num)) return; this.world.vel.y = 10; this.world.onGround = false; this.h.sfx('boing'); });
    this.bx(lv, bxC + bw / 2 + 0.45, 0.3, zo - sg * 0.4, 0.5, 0.6, 0.5, M.wood, true);
    this.mesh(new THREE.CylinderGeometry(0.15, 0.2, 0.35, 12), M.glow, bxC + bw / 2 + 0.45, y0 + 0.8, zo - sg * 0.4);
    // TV on the corridor wall, facing the bed
    const tvW = wide ? 3.2 : 1.6;
    this.bx(lv, bxC, 1.7, zc + sg * 0.14, tvW + 0.1, tvW * 0.58, 0.06, M.dark);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(tvW, tvW * 0.55), this.tvMat()); scr.position.set(bxC, y0 + 1.7, zc + sg * 0.18); scr.rotation.y = tvRot; this.world.scene.add(scr);
    // armchair, rug, mini-bar (free juice!) and the room phone (room service)
    this.bx(lv, x0 + 1.1, 0.3, zm + sg * 0.6, 1, 0.6, 1, std(0xd8c3a5, { roughness: 0.9 }), true); this.bx(lv, x0 + 1.1, 0.85, zm + sg * 1.05, 1, 0.6, 0.2, std(0xd8c3a5, { roughness: 0.9 }));
    this.mesh(new THREE.BoxGeometry(wide ? 8 : 3, 0.02, 2.6), std([0xe3c16f, 0x6fb6e3, 0xe36f9c][num % 3], { roughness: 1 }), wide ? xc - 2 : xc, y0 + 0.04, zm, 0, false);
    const fx = x1 - 0.55, fz = zc + sg * 0.6;
    this.bx(lv, fx, 0.45, fz, 0.6, 0.9, 0.6, M.white, true); this.label('🧃', fx, y0 + 1.3, fz, 0.3, null);
    this.zoneAt(lv, (px, pz) => Math.hypot(px - fx, pz - (fz + sg * 0.9)) < 0.9, () => { if (this.mine(num)) this.h.minibar(); });
    const phx = bxC + bw / 2 + 0.45, phz = zo - sg * 0.4;
    this.label('☎️', phx, y0 + 1.25, phz, 0.28, null);
    this.zoneAt(lv, (px, pz) => Math.hypot(px - phx, pz - (phz - sg * 0.9)) < 0.8, () => { if (this.mine(num)) this.h.roomService(); });
    if (wide) {
      // suites: an L-sofa, a dining table and a bubbling jacuzzi
      this.bx(lv, x0 + 6, 0.35, zm, 3.2, 0.7, 1, std(0x2b2b33, { roughness: 0.85 }), true); this.bx(lv, x0 + 7.1, 0.35, zm - sg * 1.3, 1, 0.7, 1.8, std(0x2b2b33, { roughness: 0.85 }), true);
      this.mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.06, 20), M.white, x0 + 11, y0 + 0.78, zm); this.bx(lv, x0 + 11, 0.39, zm, 0.12, 0.78, 0.12, M.dark); this.block(lv, x0 + 11, zm, 0.7, 0.7);
      const jx = x0 + 15.5, jz = zm, jr = 1.6;
      this.mesh(new THREE.CylinderGeometry(jr + 0.25, jr + 0.25, 0.5, 28), M.white, jx, y0 + 0.25, jz);
      const wat = this.mesh(new THREE.CircleGeometry(jr, 28).rotateX(-Math.PI / 2), M.water, jx, y0 + 0.42, jz, 0, false); wat.userData.dynamic = true;
      this.zoneAt(lv, (px, pz) => Math.hypot(px - jx, pz - jz) < jr - 0.2, () => { this.h.sfx('splash'); this.bubbles(jx, y0 + 0.45, jz); });
      this.plant(lv, x1 - 1, zm); this.plant(lv, x0 + 3, zo - sg * 0.8);
    }
  }
  chain(prev, fn) { return (x, z) => { const v = fn(x, z); return v !== null && v !== undefined ? v : prev ? prev(x, z) : null; }; }
  // one shared cartoon screen for every TV (cheap: redrawn a few times a second, only when you're in the hotel)
  tvMat() {
    if (this._tv) return this._tv;
    const c = document.createElement('canvas'); c.width = 256; c.height = 144; const g = c.getContext('2d');
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this._tv = new THREE.MeshBasicMaterial({ map: tex });
    let acc = 0, f = 0;
    const draw = () => {
      f++; const sky = ['#7fd3ff', '#ffb3d9', '#b8f08c'][Math.floor(f / 60) % 3];
      g.fillStyle = sky; g.fillRect(0, 0, 256, 144); g.fillStyle = '#5cbf4a'; g.fillRect(0, 108, 256, 36);
      const x = (f * 6) % 300 - 30, hop = Math.abs(Math.sin(f / 3)) * 26;
      g.font = '46px serif'; g.textBaseline = 'middle'; g.fillText('🐱', x, 92 - hop); g.fillText('🐭', x + 60 + Math.sin(f / 2) * 6, 98);
      g.font = '28px serif'; g.fillText('☀️', 210, 26); g.fillStyle = '#fff'; g.font = '700 14px system-ui'; g.fillText('Барсик TV', 8, 14);
      tex.needsUpdate = true;
    };
    draw();
    this.world.updaters.push(dt => { const p = this.world.me && this.world.me.group.position; if (!p || !this.contains(p.x, p.z)) return; if ((acc += dt) > 0.12) { acc = 0; draw(); } });
    return this._tv;
  }
  bubbles(x, y, z) {
    const S = this.world.scene, list = [];
    for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.08 + Math.random() * 0.08, 8, 6), std(0xffffff, { transparent: true, opacity: 0.7 })); b.position.set(x + (Math.random() - 0.5) * 2, y, z + (Math.random() - 0.5) * 2); b.userData.dynamic = true; S.add(b); list.push(b); }
    let t = 0; const up = dt => { t += dt; list.forEach(b => { b.position.y += dt * (0.6 + Math.random()); }); if (t > 1.6) { list.forEach(b => S.remove(b)); this.world.updaters.splice(this.world.updaters.indexOf(up), 1); } };
    this.world.updaters.push(up);
  }

  // ---------- 4: two Sky Suites ----------
  suites() {
    const { M, z, maxX } = this, lv = 3;
    this.mesh(new THREE.BoxGeometry(maxX - 59, 0.03, 3), M.gold, (59 + maxX) / 2, this.floorY(lv) + 0.05, z, 0, false);
    this.room(lv, 0, -1, 401, true); this.room(lv, 0, 1, 402, true);
    this.bx(lv, maxX - 0.3, (this.fh - 0.3) / 2, z, 0.2, this.fh - 0.3, 3, M.wall);
  }

  // ---------- 5: the roof ----------
  roof() {
    const { M, minX, maxX, minZ, maxZ, z } = this, lv = 4, y = this.floorY(lv), S = this.world.scene, t = this.t;
    // the pool (1 m deep: you can walk in and splash) and a wooden deck all round it
    const P = { x0: 68, x1: 81, z0: -76, z1: -64 }, px = (P.x0 + P.x1) / 2, pz = (P.z0 + P.z1) / 2, pw = P.x1 - P.x0, pd = P.z1 - P.z0;
    const deck = this.world.texMat(TEX.wood, 6, 6, { color: 0xb98a5a, roughness: 0.6 }), a0 = minX + 0.2, a1 = maxX - 0.2, b0 = minZ + 0.2, b1 = maxZ - 0.2;
    for (const [x0, x1, z0, z1] of [[a0, P.x0, b0, b1], [P.x1, a1, b0, b1], [P.x0, P.x1, b0, P.z0], [P.x0, P.x1, P.z1, b1]]) this.mesh(new THREE.BoxGeometry(x1 - x0, 0.06, z1 - z0), deck, (x0 + x1) / 2, y + 0.02, (z0 + z1) / 2, 0, false);
    for (const [cx, cz, ww, dd] of [[px, P.z0, pw, 0.1], [px, P.z1, pw, 0.1], [P.x0, pz, 0.1, pd], [P.x1, pz, 0.1, pd]]) this.mesh(new THREE.BoxGeometry(ww, 1.0, dd), M.tile, cx, y - 0.48, cz, 0, false);
    this.mesh(new THREE.BoxGeometry(pw, 0.05, pd), M.tile, px, y - 0.98, pz, 0, false);
    for (const [cx, cz, ww, dd] of [[px, P.z0, pw + 0.6, 0.3], [px, P.z1, pw + 0.6, 0.3], [P.x0, pz, 0.3, pd], [P.x1, pz, 0.3, pd]]) this.mesh(new THREE.BoxGeometry(ww, 0.25, dd), M.white, cx, y + 0.1, cz, 0, false);
    const water = this.mesh(new THREE.PlaneGeometry(pw, pd).rotateX(-Math.PI / 2), M.water, px, y - 0.2, pz, 0, false); water.userData.dynamic = true;
    this.world.updaters.push((dt, tt) => { water.position.y = y - 0.2 + Math.sin(tt * 1.5) * 0.02; });
    this.floorFns[lv] = this.chain(this.floorFns[lv], (ax, az) => (ax > P.x0 + 0.15 && ax < P.x1 - 0.15 && az > P.z0 + 0.15 && az < P.z1 - 0.15 ? y - 0.95 : null)); // not deeper: 1.2 m down would count as the floor below
    this.zoneAt(lv, (qx, qz, dy) => qx > P.x0 && qx < P.x1 && qz > P.z0 && qz < P.z1 && dy < 0.3, () => { this.h.sfx('splash'); this.splash(px, y, pz); }, null);
    this.label('🏊 ' + t('hotelPool'), px, y + 3, P.z0 - 0.5, 0.5, 'rgba(30,140,200,0.92)');
    // sun loungers and umbrellas
    for (let i = 0; i < 5; i++) {
      const lx = P.x0 + 1 + i * 2.6, lz = maxZ - 2.6;
      this.bx(lv, lx, 0.3, lz, 0.8, 0.12, 2, M.white, true); this.bx(lv, lx, 0.55, lz + 0.8, 0.8, 0.5, 0.12, M.white);
      if (i % 2 === 0) { this.mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), M.dark, lx + 1.3, y + 1.3, lz); this.mesh(new THREE.ConeGeometry(1.4, 0.6, 8), std([0xff6fa8, 0xffd34d, 0x2ec4b6][i / 2], { side: THREE.DoubleSide }), lx + 1.3, y + 2.7, lz); }
    }
    // the Roof Bar
    const barX = maxX - 1.6;
    this.mesh(new RoundedBox(1, 1.1, 5, 2, 0.1), M.wood, barX - 0.6, y + 0.55, minZ + 4); this.block(lv, barX - 0.6, minZ + 4, 0.55, 2.5);
    const bt = new Avatar({ skin: '#c68642', face: 'smile', hair: 'curly', hairColor: '#1c1410', top: 'plain', shirt: '#ff9f1c', pants: '#22293a', shoes: '#111', hat: 'none', pet: 'none', height: 1 }, '', 'bot');
    bt.group.position.set(barX + 0.4, y, minZ + 4); bt.group.rotation.y = -Math.PI / 2; S.add(bt.group);
    this.world.updaters.push((dt, tt) => { const p = this.world.me && this.world.me.group.position; if (!p || Math.abs(p.y - y) > 3) return; bt.animate(0, dt, false); if (!bt.emote && Math.sin(tt * 0.8) > 0.995) bt.play('dance'); });
    this.label('🍹 ' + t('hotelBar'), barX - 0.6, y + 2.6, minZ + 4, 0.5, 'rgba(255,120,40,0.92)');
    this.zoneAt(lv, (qx, qz) => qx > barX - 2.6 && qx < barX - 1.1 && Math.abs(qz - (minZ + 4)) < 2, () => { bt.play('wave'); this.h.bar(); });
    // DJ booth with a disco ball
    this.bx(lv, 75, 0.6, minZ + 1.6, 3, 1.2, 1.2, M.dark, true);
    const ball = this.mesh(new THREE.IcosahedronGeometry(0.45, 1), std(0xdddddd, { metalness: 1, roughness: 0.15, flatShading: true }), 75, y + 3.4, minZ + 1.8); ball.userData.dynamic = true;
    this.world.updaters.push(dt => { ball.rotation.y += dt * 1.5; });
    this.label('🎧 DJ', 75, y + 2.2, minZ + 1.6, 0.4, 'rgba(120,40,200,0.92)');
    // string lights
    for (let i = 0; i < 14; i++) this.mesh(new THREE.SphereGeometry(0.12, 8, 6), std(0xffffff, { emissive: [0xff5a5a, 0xffd34d, 0x5affc8, 0x5aa8ff][i % 4], emissiveIntensity: 2 }), minX + 2 + i * 2, y + 3 - Math.sin(i / 13 * Math.PI) * 0.6, maxZ - 0.6, 0, false);
    this.waterSlide(lv, P);
  }
  splash(x, y, z) {
    const S = this.world.scene, p = this.world.me.group.position, list = [];
    for (let i = 0; i < 16; i++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 5), this.M.water); d.position.set(p.x, y - 0.1, p.z); d.userData.v = new THREE.Vector3((Math.random() - 0.5) * 3, 3 + Math.random() * 3, (Math.random() - 0.5) * 3); d.userData.dynamic = true; S.add(d); list.push(d); }
    let t = 0; const up = dt => { t += dt; list.forEach(d => { d.userData.v.y -= 12 * dt; d.position.addScaledVector(d.userData.v, dt); }); if (t > 0.9) { list.forEach(d => S.remove(d)); this.world.updaters.splice(this.world.updaters.indexOf(up), 1); } };
    this.world.updaters.push(up);
  }
  // a twisty tube slide from a tower in the corner down into the pool
  waterSlide(lv, P) {
    const y = this.floorY(lv), { M } = this, S = this.world.scene, sx = this.minX + 4, sz = this.minZ + 3.5, top = y + 5.5;
    const pts = [];
    for (let k = 0; k <= 40; k++) { const f = k / 40, a = f * Math.PI * 3.2, r = 2.2 + f * 1.2; pts.push(new THREE.Vector3(sx + 3 + Math.cos(a) * r * (1 - f) + f * (P.x0 + 2 - sx - 3), top - f * (top - (y - 0.1)), sz + 3 + Math.sin(a) * r * (1 - f) + f * ((P.z0 + P.z1) / 2 - sz - 3))); }
    const curve = new THREE.CatmullRomCurve3(pts);
    this.mesh(new THREE.TubeGeometry(curve, 120, 0.55, 12, false), new THREE.MeshStandardMaterial({ color: 0xff3fa4, roughness: 0.3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), 0, 0, 0, 0, false);
    // the tower with a ladder pad at the bottom
    this.bx(lv, sx, top / 2 - y / 2, sz, 0.3, top - y, 0.3, M.band); this.bx(lv, sx + 2, top / 2 - y / 2, sz, 0.3, top - y, 0.3, M.band);
    this.bx(lv, sx + 1, top - y, sz + 1, 3, 0.2, 3, std(0x2ec4b6));
    this.label('🌀 ' + this.t('hotelSlide'), sx + 1, top + 1.4, sz + 1, 0.5, 'rgba(255,63,164,0.92)');
    this.mesh(new THREE.RingGeometry(0.7, 0.95, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3fa4 }), sx + 1, y + 0.05, sz + 2.8, 0, false);
    this.zoneAt(lv, (qx, qz) => Math.hypot(qx - (sx + 1), qz - (sz + 2.8)) < 0.95, () => this.slide(curve, top));
  }
  slide(curve, top) {
    const w = this.world; if (w.carrier) return;
    this.h.sfx('whoosh'); let t = 0, phase = 0;
    const start = curve.getPoint(0), p0 = w.me.group.position.clone(), tan = new THREE.Vector3();
    w.carrier = { update: (dt, p, me) => {
      t += dt;
      if (phase === 0) { const k = Math.min(1, t / 1.2); p.set(p0.x + (start.x - p0.x) * k, p0.y + (top - p0.y) * k, p0.z + (start.z - p0.z) * k); me.animate(3, dt, false); if (k >= 1) { phase = 1; t = 0; this.h.sfx('slideDown'); } return false; }
      const k = Math.min(1, t / 4.2), e = k * k * (3 - 2 * k), q = curve.getPoint(e); p.copy(q); curve.getTangent(e, tan); me.group.rotation.y = Math.atan2(tan.x, tan.z);
      me.animate(0, dt, true);
      if (k >= 1) { this.h.sfx('splash'); this.splash(p.x, p.y, p.z); return true; }
      return false;
    }, onEnd: () => { w.vel.set(0, 0, 0); }, onCancel: () => {} };
  }

  // ---------- booking ----------
  booking() { try { const b = JSON.parse(localStorage.getItem('wi_hotel_' + this.h.uid())); return b && b.until > Date.now() ? b : null; } catch (e) { return null; } }
  mine(num) { const b = this.booking(); return !!b && b.num === num; }
  refreshDoors() {
    const b = this.booking();
    for (const R of this.rooms) { const m = b && b.num === R.num; R.door.visible = !m; R.lock.material.color.setHex(m ? 0x2ecc71 : 0xff3b3b); R.lock.material.emissive.setHex(m ? 0x2ecc71 : 0xff3b3b); }
  }
  floorOf(num) { return Math.floor(num / 100) - 1; }
  desk() {
    const t = this.t, b = this.booking();
    if (b) {
      const left = Math.max(1, Math.round((b.until - Date.now()) / 3600000));
      this.open('🛎️ Island Grand Hotel', `<div class="hotel-key"><div class="key-card"><b>ISLAND GRAND</b><span>${b.num}</span><small>${t('hotelKeyFor').replace('{h}', left)}</small></div>
        <p>${t('hotelYourRoom').replace('{r}', b.num).replace('{f}', this.floorOf(b.num) + 1)}</p></div>
        <div class="row"><button class="btn primary" id="htGo">🛗 ${t('hotelTakeMe')}</button><button class="btn" id="htOut">${t('hotelCheckout')}</button></div>`);
      $('#htGo').onclick = () => { this.close(); const R = this.rooms.find(r => r.num === b.num); this.world.teleport(R.inside.x, R.inside.z, 0, this.floorY(R.lv) + 0.05); this.h.sfx('ding'); };
      $('#htOut').onclick = () => { try { localStorage.removeItem('wi_hotel_' + this.h.uid()); } catch (e) {} this.refreshDoors(); this.close(); this.h.banner('👋 ' + t('hotelBye'), 2500); };
      return;
    }
    this.open('🛎️ Island Grand Hotel', `<p class="muted">${t('hotelWelcome')}</p>
      <div class="hotel-offers">
        <button class="hotel-offer" data-k="hotelroom"><span>🛏️</span><b>${t('hotelRoom')}</b><small>${t('hotelRoomD')}</small><em>$15</em></button>
        <button class="hotel-offer gold" data-k="suite"><span>🌟</span><b>${t('hotelSuite')}</b><small>${t('hotelSuiteD')}</small><em>$40</em></button>
      </div><p class="muted small">✋ ${t('hotelPayHint')}</p>`);
    document.querySelectorAll('#hotelBody .hotel-offer').forEach(btn => btn.onclick = () => {
      const k = btn.dataset.k; this.close();
      this.h.buy(k, () => {
        const pool = this.rooms.filter(r => (k === 'suite') === r.suite), R = pool[Math.floor(Math.random() * pool.length)];
        try { localStorage.setItem('wi_hotel_' + this.h.uid(), JSON.stringify({ num: R.num, until: Date.now() + DAY })); } catch (e) {}
        this.refreshDoors(); this.h.sfx('cheer'); this.h.fireworks(2);
        this.h.banner(`🔑 ${t('hotelGotRoom').replace('{r}', R.num).replace('{f}', R.lv + 1)}`, 5000);
      });
    });
  }
  // a little modal for the desk and the elevator
  ui() {
    document.body.append(el(`<div id="hotelBox" class="modal hidden"><div class="sheet small hotel-sheet"><div class="sheet-head"><h2 id="hotelTitle"></h2><button class="ibtn light" data-x>✕</button></div><div id="hotelBody"></div></div></div>`));
    document.body.append(el(`<div id="hotelFade"></div>`));
    $('#hotelBox [data-x]').onclick = () => this.close();
  }
  open(title, html) { $('#hotelTitle').textContent = title; $('#hotelBody').innerHTML = html; $('#hotelBox').classList.remove('hidden'); this.world.inputLocked = true; this.world.keys = {}; }
  close() { $('#hotelBox').classList.add('hidden'); this.world.inputLocked = false; }

  // people in the lobby and on the roof
  guests() {
    const y0 = this.floorY(0), y4 = this.floorY(4), z = this.z, maxZ = this.maxZ, minX = this.minX, minZ = this.minZ;
    new Guests(this.world, [
      { kind: 'sit', x: 70, y: y0 + 0.24, z: minZ + 1.5, ry: 0 }, { kind: 'sit', x: 72, y: y0 + 0.24, z: minZ + 1.5, ry: 0 },
      { kind: 'sit', x: 70.4, y: y0 + 0.24, z: minZ + 5.3, ry: Math.PI }, { kind: 'sit', x: minX + 7, y: y0 + 0.2, z: minZ + 3.6, ry: Math.PI },
      { kind: 'chat', x: 65, y: y0, z: z + 2.5, ry: 0.6 }, { kind: 'chat', x: 66.2, y: y0, z: z + 3.3, ry: -2.4 }, { kind: 'chat', x: 64.6, y: y0, z: z + 3.6, ry: 2.6 },
      { kind: 'chat', x: 74, y: y0, z: z - 4, ry: Math.PI / 2 },
      { kind: 'lie', x: 69, y: y4 + 0.38, z: maxZ - 3.4, ry: Math.PI }, { kind: 'lie', x: 74.2, y: y4 + 0.38, z: maxZ - 3.4, ry: Math.PI }, { kind: 'lie', x: 79.4, y: y4 + 0.38, z: maxZ - 3.4, ry: Math.PI },
      { kind: 'swim', x: 72, y: y4 - 0.75, z: -71, ry: 0 }, { kind: 'swim', x: 77, y: y4 - 0.75, z: -68, ry: 2 }, { kind: 'swim', x: 75, y: y4 - 0.75, z: -73, ry: 4 },
      { kind: 'dance', x: 73, y: y4, z: minZ + 3.4, ry: Math.PI }, { kind: 'dance', x: 75, y: y4, z: minZ + 3.8, ry: Math.PI }, { kind: 'dance', x: 77, y: y4, z: minZ + 3.4, ry: Math.PI }, { kind: 'dance', x: 76, y: y4, z: minZ + 4.4, ry: Math.PI },
    ], { near: 60 });
  }
}
