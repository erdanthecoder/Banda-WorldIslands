// 🧗 Mega Obby course: 36 stages in six themed zones, the lobby and the trophy room.
// Every stage is written in its own frame (u = forward along the course, v = sideways, y = up from its checkpoint),
// so blocks, hazards, coins and the bot route all line up wherever the course turns.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { L, std, mesh, canvasTexture } from './core.js';
import { labelSprite } from '../world.js';

export const ZONES = [
  { k: 'candy', en: 'Candy Land', ru: 'Конфетная страна', icon: '🍭', dir: [1, 0], c: [0xff7eb6, 0x8fe3ff, 0xffe066, 0xb388ff], css: '#ff5fa2' },
  { k: 'lava', en: 'Lava Caves', ru: 'Лавовые пещеры', icon: '🌋', dir: [0, -1], c: [0x5e4a43, 0x80604f, 0xff7a1a, 0xffc44d], css: '#e2531c' },
  { k: 'ice', en: 'Frozen Peaks', ru: 'Ледяные вершины', icon: '❄️', dir: [1, 0], c: [0xf2fbff, 0x9fd4ff, 0x4fb6ff, 0xd6f0ff], css: '#3d9be0' },
  { k: 'jungle', en: 'Jungle Temple', ru: 'Храм джунглей', icon: '🌴', dir: [0, -1], c: [0xc29a5c, 0x6d9a3a, 0x3fbf5f, 0xe0c27a], css: '#3b8f3a' },
  { k: 'space', en: 'Space Station', ru: 'Космическая станция', icon: '🚀', dir: [1, 0], c: [0x454b78, 0x7a6ff0, 0x6ff3ff, 0xc9cff5], css: '#5a4fcf' },
  { k: 'sky', en: 'Sky Castle', ru: 'Небесный замок', icon: '☁️', dir: [0, -1], c: [0xffffff, 0xffe9a8, 0xffd34d, 0xa8dcff], css: '#e0a800' },
];
export const LOBBY_R = 19, START = { x: 20, y: 0.5, z: 0 };
// everything the game loop needs to know about the course
export const G = { blocks: [], movers: [], grid: new Map(), hz: [], winds: [], ladders: [], wj: [], lavas: [], stg: [], coins: [], fx: [], mats: [], ck: 0, w: null };
const tri = x => 1 - Math.abs(((x % 1) + 1) % 1 * 2 - 1); // 0 → 1 → 0 every 1
const fr = (t, P, ph = 0) => ((((t + ph) % P) + P) % P);  // where we are in a cycle of P seconds

// ---------- the spatial grid (fast ground lookups) ----------
const CELL = 10, EMPTY = [], key = (i, j) => (i + 500) * 4000 + (j + 500);
function addGrid(b) {
  for (let i = Math.floor((b.x - b.hw - 0.6) / CELL); i <= Math.floor((b.x + b.hw + 0.6) / CELL); i++)
    for (let j = Math.floor((b.z - b.hd - 0.6) / CELL); j <= Math.floor((b.z + b.hd + 0.6) / CELL); j++) { const k = key(i, j); if (!G.grid.has(k)) G.grid.set(k, []); G.grid.get(k).push(b); }
}
export const cellAt = (x, z) => G.grid.get(key(Math.floor(x / CELL), Math.floor(z / CELL))) || EMPTY;
export const inside = (b, x, z, m = 0.2) => (b.r ? Math.hypot(x - b.x, z - b.z) < b.r + m : Math.abs(x - b.x) < b.hw + m && Math.abs(z - b.z) < b.hd + m);
export const solidOn = b => b.on && !(G.vanish && !b.keep);

// ---------- materials and textures ----------
const M = {};
function tex(w, h, draw, rep) { const t = canvasTexture(w, h, draw); if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...rep); } return t; }
function materials() {
  for (const Z of ZONES) {
    const [a, b, c, d] = Z.c, rough = Z.k === 'ice' ? 0.25 : Z.k === 'space' ? 0.35 : 0.55, metal = Z.k === 'space' ? 0.45 : 0;
    Z.M = { a: std(a, { roughness: rough, metalness: metal }), b: std(b, { roughness: rough, metalness: metal }), c: std(c, { roughness: 0.35, emissive: c, emissiveIntensity: 0.25 }), d: std(d, { roughness: 0.5 }) };
    G.mats.push(...Object.values(Z.M));
  }
  M.kill = std(0xff2a3a, { emissive: 0xff1020, emissiveIntensity: 0.7, roughness: 0.35 });
  M.ice = std(0xcdf3ff, { roughness: 0.04, metalness: 0.2, emissive: 0x1a4a6a, emissiveIntensity: 0.25 });
  M.bounce = std(0x7dff4a, { emissive: 0x2a9a10, emissiveIntensity: 0.9, roughness: 0.3 });
  M.cp = std(0xf5f7fb, { roughness: 0.35 }); M.fin = std(0xffd34d, { metalness: 0.8, roughness: 0.25, emissive: 0x4a3200, emissiveIntensity: 0.35 });
  M.rope = std(0x9a6b3a, { roughness: 0.95 }); M.belt = std(0x2a2522, { roughness: 0.8 }); M.stone = std(0x8d8a7a, { roughness: 0.9 });
  M.crack = tex(128, 128, (g, W) => { g.fillStyle = '#ffb347'; g.fillRect(0, 0, W, W); g.strokeStyle = 'rgba(90,40,0,.75)'; g.lineWidth = 4; for (let k = 0; k < 6; k++) { g.beginPath(); let x = Math.random() * W, y = Math.random() * W; g.moveTo(x, y); for (let s = 0; s < 4; s++) { x += (Math.random() - 0.5) * 50; y += (Math.random() - 0.5) * 50; g.lineTo(x, y); } g.stroke(); } });
  M.fall = std(0xffffff, { map: M.crack, roughness: 0.8 });
  M.arrows = tex(64, 128, (g, W, H) => { g.fillStyle = '#3a312c'; g.fillRect(0, 0, W, H); g.strokeStyle = '#ffd34d'; g.lineWidth = 9; g.lineCap = 'round'; for (const y of [24, 88]) { g.beginPath(); g.moveTo(12, y + 26); g.lineTo(32, y); g.lineTo(52, y + 26); g.stroke(); } });
  M.arrows.wrapS = M.arrows.wrapT = THREE.RepeatWrapping;
  M.beltTop = new THREE.MeshStandardMaterial({ map: M.arrows, roughness: 0.6, emissive: 0x332200, emissiveIntensity: 0.4 });
  M.stripes = tex(256, 32, (g, W, H) => { for (let k = 0; k < 8; k++) { g.fillStyle = k % 2 ? '#ffffff' : '#ff2a4a'; g.fillRect(k * 32, 0, 32, H); } });
  M.bar = std(0xffffff, { map: M.stripes, roughness: 0.4 }); M.fire = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  M.laser = new THREE.MeshBasicMaterial({ color: 0xff2050, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  M.metal = std(0x9aa3ad, { metalness: 0.8, roughness: 0.3 }); M.dark = std(0x22252c, { roughness: 0.6 });
  M.lavaT = tex(256, 256, (g, W) => { g.fillStyle = '#ff4a00'; g.fillRect(0, 0, W, W); for (let k = 0; k < 70; k++) { const r = 6 + Math.random() * 26; g.fillStyle = `hsla(${20 + Math.random() * 30}, 100%, ${45 + Math.random() * 25}%, .8)`; g.beginPath(); g.arc(Math.random() * W, Math.random() * W, r, 0, 7); g.fill(); } g.fillStyle = 'rgba(80,10,0,.35)'; for (let k = 0; k < 30; k++) { g.beginPath(); g.arc(Math.random() * W, Math.random() * W, 4 + Math.random() * 10, 0, 7); g.fill(); } }, [1, 1]);
  M.lava = new THREE.MeshStandardMaterial({ map: M.lavaT, emissive: 0xff5a10, emissiveMap: M.lavaT, emissiveIntensity: 1.1, roughness: 0.6 });
  M.spots = tex(128, 128, (g, W) => { g.fillStyle = '#e8343c'; g.fillRect(0, 0, W, W); g.fillStyle = '#fff'; for (let k = 0; k < 9; k++) { g.beginPath(); g.arc(Math.random() * W, Math.random() * W, 7 + Math.random() * 8, 0, 7); g.fill(); } });
  M.mush = std(0xffffff, { map: M.spots, roughness: 0.5, emissive: 0x401010, emissiveIntensity: 0.3 });
  M.cloud = std(0xffffff, { roughness: 0.9, emissive: 0xbfd8ff, emissiveIntensity: 0.15 });
  M.swirl = tex(256, 256, (g, W) => { const c = W / 2; for (let a = 0; a < 40; a += 0.05) { g.fillStyle = Math.floor(a * 1.3) % 2 ? '#ff4f9a' : '#ffffff'; g.beginPath(); g.arc(c + Math.cos(a) * a * 3, c + Math.sin(a) * a * 3, 7 + a * 0.5, 0, 7); g.fill(); } });
}
function matFor(k, Z, o) {
  if (o.mat) return o.mat;
  if (Z.M[k]) return Z.M[k];
  if (k === 'fall') return M.fall.clone();
  if (k === 'blink') { const m = Z.M.c.clone(); m.transparent = true; return m; }
  return { kill: M.kill, ice: M.ice, bounce: M.bounce, conv: M.belt, cp: M.cp, fin: M.fin, rope: M.rope }[k] || Z.M.a;
}

// ---------- blocks: anything you can stand on ----------
const geoC = new Map();
function rbox(sx, h, sz) { const k = `${sx.toFixed(2)}|${h.toFixed(2)}|${sz.toFixed(2)}`; let g = geoC.get(k); if (!g) geoC.set(k, g = new RoundedBox(sx, h, sz, 2, Math.min(0.14, h / 3, sx / 4, sz / 4))); return g; }
// k: a b c d (zone colours) | kill | ice | bounce (pow) | conv (cv, sp) | fall | blink (blink: t → on) | cp | fin | rope
// o.move: t → [dx, dy, dz] world offset; o.spin: a turning disc (rad/s); o.r: round
export function blk(x, z, top, sx, sz, k, Z, o = {}) {
  const w = G.w, h = o.h ?? 0.6, mat = matFor(k, Z, o);
  const m = new THREE.Mesh(o.r ? new THREE.CylinderGeometry(o.r, o.r * 0.94, h, 40) : rbox(sx, h, sz), mat);
  m.position.set(x, top - h / 2, z); m.castShadow = m.receiveShadow = true; w.scene.add(m);
  const b = { ...o, x, z, top, bx: x, bz: z, by: top, hw: o.r || sx / 2, hd: o.r || sz / 2, r: o.r || 0, h, k, m, on: true, rot: 0 };
  Object.defineProperties(b, { y0: { get: () => (solidOn(b) ? b.top - b.h - 1.7 : 1e9) }, y1: { get: () => b.top - 0.65 } });
  b.at = t => { if (!b.move) return [b.bx, b.by, b.bz]; const [dx, dy, dz] = b.move(t); return [b.bx + dx, b.by + dy, b.bz + dz]; };
  if (b.move || k === 'fall' || k === 'blink' || b.spin) m.userData.dynamic = true;
  if (b.move) G.movers.push(b); else addGrid(b);
  if (!o.nosolid) w.solids.push(b);
  if (k === 'conv') {
    // arrows on the belt that scroll the way it pushes
    const len = Math.abs(b.cv[0]) ? sx : sz, wid = Math.abs(b.cv[0]) ? sz : sx, g = new THREE.PlaneGeometry(wid * 0.92, len * 0.98).rotateX(-Math.PI / 2);
    const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len / 1.6); uv.needsUpdate = true;
    const t = new THREE.Mesh(g, M.beltTop); t.position.set(x, top + 0.012, z); t.rotation.y = Math.atan2(-b.cv[0], -b.cv[1]); t.receiveShadow = true; w.scene.add(t);
  }
  if (o.cloud) for (let k = 0; k < 7; k++) { const a = k / 7 * Math.PI * 2, c = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 8), M.cloud); c.position.set(Math.cos(a) * b.r * 0.95, -0.1, Math.sin(a) * b.r * 0.95); c.scale.y = 0.6; m.add(c); }
  if (b.r && (o.lolli || b.spin)) { const d = new THREE.Mesh(new THREE.CircleGeometry(b.r * 0.97, 48).rotateX(-Math.PI / 2), o.lolli ? new THREE.MeshStandardMaterial({ map: M.swirl, roughness: 0.3 }) : std(0xffffff, { roughness: 0.4, map: M.stripes })); d.position.y = h / 2 + 0.01; m.add(d); }
  G.blocks.push(b); return b;
}

// ---------- one stage's frame and its builders ----------
function frame(O, Z, st) {
  const [dx, dz] = Z.dir, P = (u, v) => [O.x + dx * u - dz * v, O.z + dz * u + dx * v], W = (su, sv) => (dx ? [su, sv] : [sv, su]);
  const V = (fu, fv) => [dx * fu - dz * fv, dz * fu + dx * fv], loc = (u, v, y) => { const [x, z] = P(u, v); return [x, O.y + y, z]; };
  const mv = f => f && (t => { const [du, dv, dy = 0] = f(t), [wx, wz] = V(du, dv); return [wx, dy, wz]; });
  const w = G.w, S = w.scene, add = (o, x, y, z) => { o.position.set(x, y, z); o.castShadow = true; S.add(o); return o; };
  const lateral = V(0, 1), along = V(1, 0);
  const F = {
    P, W, V, loc, Z, st,
    b(u, v, y, su, sv, k = 'a', o = {}) { const [x, z] = P(u, v), [sx, sz] = W(su, sv); return blk(x, z, O.y + y, sx, sz, k, Z, { ...o, cv: o.cv && V(...o.cv), move: mv(o.move), st: st.n }); },
    d(u, v, y, r, k = 'a', o = {}) { const [x, z] = P(u, v); return blk(x, z, O.y + y, 0, 0, k, Z, { ...o, r, move: mv(o.move), st: st.n }); },
    r(u, v, y, a = 'j', o = {}) { st.route.push({ p: loc(u, v, y), a, ...o }); },
    rb(b, a = 'j', o = {}) { st.route.push({ b, a, ...o }); },
    c(u, v, y, big) { G.coins.push([...loc(u, v, y), big ? 100 : 5, !!big]); },
    // a spinning bar (arms from the middle); kill = fire bar, otherwise it knocks you away
    bar(u, v, y, len, sp, { kill = false, arms = 2 } = {}) {
      const [x, z] = P(u, v), g = new THREE.Group(); g.position.set(x, O.y + y, z); g.userData.dynamic = true; S.add(g);
      const am = kill ? M.fire : M.bar;
      for (let a = 0; a < arms; a++) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, len, 12).rotateZ(Math.PI / 2).translate(len / 2, 0, 0), am); c.rotation.y = a / arms * Math.PI * 2; c.castShadow = !kill; g.add(c); if (kill) for (let k = 1; k < 5; k++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.fire); f.position.set(Math.cos(c.rotation.y) * len * k / 5, 0, -Math.sin(c.rotation.y) * len * k / 5); g.add(f); } }
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.2, 16), M.dark); hub.position.y = -0.3; g.add(hub);
      const H = { t: 'bar', x, z, y: O.y + y, len, arms, sp, kill, g, ph: Math.random() * 6 }; G.hz.push(H); return H;
    },
    // a box that hurts (or pushes) while on(t) — lasers, fire jets
    hb(u, v, y0, y1, su, sv, o) { const [x, z] = P(u, v), [sx, sz] = W(su, sv); const H = { t: 'box', x, z, hw: sx / 2, hd: sz / 2, y0: O.y + y0, y1: O.y + y1, kill: true, on: () => true, ...o }; G.hz.push(H); return H; },
    laser(u, v, y, wid, { on, move } = {}) {
      const [x, z] = P(u, v), [sx, sz] = W(0.12, wid), beam = add(new THREE.Mesh(new THREE.BoxGeometry(sx, 0.09, sz), M.laser), x, O.y + y, z); beam.castShadow = false; beam.userData.dynamic = true;
      for (const s of [-1, 1]) { const [px, pz] = P(u, v + s * (wid / 2 + 0.15)); add(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, 3, 10), M.dark), px, O.y + 1.5, pz); }
      const H = F.hb(u, v, y - 0.08, y + 0.08, 0.16, wid, { on: on || (() => true), m: beam, upd: t => { if (move) { const yy = O.y + move(t); H.y0 = yy - 0.08; H.y1 = yy + 0.08; beam.position.y = yy; } beam.visible = H.on(t); } }); return H;
    },
    curtain(u, v, wid, h, on) {
      const [x, z] = P(u, v), [sx, sz] = W(0.1, wid), g = new THREE.Group(); g.position.set(x, O.y, z); g.userData.dynamic = true; S.add(g);
      for (let k = 0; k < 6; k++) { const l = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.06, sz), M.laser); l.position.y = 0.2 + k * (h - 0.2) / 5; g.add(l); }
      const sheet = new THREE.Mesh(new THREE.BoxGeometry(sx * 0.5, h, sz), new THREE.MeshBasicMaterial({ color: 0xff2050, transparent: true, opacity: 0.18, depthWrite: false })); sheet.position.y = h / 2; g.add(sheet);
      for (const s of [-1, 1]) { const [px, pz] = P(u, v + s * (wid / 2 + 0.15)); add(new THREE.Mesh(new THREE.BoxGeometry(0.3, h + 0.4, 0.3), M.dark), px, O.y + h / 2, pz); }
      const H = F.hb(u, v, 0, h, 0.2, wid, { on, upd: t => { const o = H.on(t), warn = !o && H.on(t + 0.5); g.visible = o || (warn && Math.floor(t * 10) % 2 === 0); } }); return H;
    },
    jet(u, v, su, sv, on) {
      const [x, z] = P(u, v), [sx, sz] = W(su, sv); add(new THREE.Mesh(new THREE.BoxGeometry(sx, 0.1, sz), M.dark), x, O.y + 0.03, z).castShadow = false;
      const g = new THREE.Group(); g.position.set(x, O.y, z); g.userData.dynamic = true; S.add(g);
      for (let k = 0; k < 5; k++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.45, 2.6, 10), M.fire); const [ox, oz] = V(0, (k - 2) * sv / 5); f.position.set(ox, 1.3, oz); g.add(f); }
      const H = F.hb(u, v, 0, 2.6, su, sv, { on, upd: t => { const o = H.on(t); g.visible = o || H.on(t + 0.6); g.scale.set(1, o ? 0.9 + Math.random() * 0.2 : 0.15, 1); } }); return H;
    },
    // a log on ropes swinging sideways across the path
    pend(u, v, y, amp, sp, ph) {
      const [x, z] = P(u, v), R = 5.9, piv = O.y + y + 6.5, g = new THREE.Group(); g.position.set(x, piv, z); g.userData.dynamic = true; S.add(g);
      const log = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.6, 14), std(0x7a5230, { roughness: 0.9 })); if (dx) log.rotation.z = Math.PI / 2; else log.rotation.x = Math.PI / 2; log.position.y = -R; log.castShadow = true; g.add(log);
      for (const s of [-0.9, 0.9]) { const [ox, oz] = V(s, 0), rope = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, R, 6), M.rope); rope.position.set(ox, -R / 2, oz); g.add(rope); }
      const [bx, bz] = P(u, v), wood = std(0x5a3c22, { roughness: 0.9 });
      // a wooden frame beside the path: four posts, two cross beams and the pivot beam along the path
      for (const su of [-1.7, 1.7]) { for (const sv of [-2.1, 2.1]) { const [ax, az] = P(u + su, v + sv); add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 6.8, 10), wood), ax, O.y + y + 3.2, az); } const [cx, cz] = P(u + su, v), cr = add(new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 4.4, 8), wood), cx, piv, cz); if (dx) cr.rotation.x = Math.PI / 2; else cr.rotation.z = Math.PI / 2; }
      const beam = add(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3.6, 10), wood), bx, piv, bz); if (dx) beam.rotation.z = Math.PI / 2; else beam.rotation.x = Math.PI / 2;
      const H = { t: 'box', x, z, hw: dx ? 1.3 : 0.5, hd: dx ? 0.5 : 1.3, y0: 0, y1: 0, kill: false, on: () => true, kn: [0, 0], upd: tt => {
        const a = amp * Math.sin(tt * sp + ph), s = Math.sign(Math.cos(tt * sp + ph)), off = R * Math.sin(a), cy = piv - R * Math.cos(a);
        H.x = x + lateral[0] * off; H.z = z + lateral[1] * off; H.y0 = cy - 0.45; H.y1 = cy + 0.45; H.kn = [lateral[0] * s, lateral[1] * s];
        if (dx) g.rotation.x = -a; else g.rotation.z = a;
      } };
      G.hz.push(H); return H;
    },
    // a stone door that slides up and down across the path
    door(u, v, wid, P0, ph, open) {
      const [x, z] = P(u, v), [sx, sz] = W(0.5, wid), slab = add(new THREE.Mesh(rbox(sx, 2.6, sz), M.stone), x, O.y + 1.3, z); slab.userData.dynamic = true;
      for (const s of [-1, 1]) { const [px, pz] = P(u, v + s * (wid / 2 + 0.35)); add(new THREE.Mesh(new THREE.BoxGeometry(0.7, 4.2, 0.7), std(0xb59a6a, { roughness: 0.9 })), px, O.y + 2.1, pz); }
      const [lx, lz] = W(0.8, wid + 1.4); add(new THREE.Mesh(new THREE.BoxGeometry(lx, 0.6, lz), std(0xb59a6a, { roughness: 0.9 })), x, O.y + 4.5, z);
      const isOpen = t => fr(t, P0, ph) < open;
      const D = { x, z, hw: sx / 2, hd: sz / 2, rot: 0, get y0() { return isOpen(G.ck) ? 1e9 : O.y - 2; }, y1: O.y + 2.6, isOpen };
      w.solids.push(D); G.fx.push((t, dt) => { const ty = O.y + (isOpen(t) ? 4.0 : 1.3); slab.position.y += (ty - slab.position.y) * Math.min(1, dt * 8); });
      return D;
    },
    // wind (and updrafts) that push you while you are inside the box
    wind(u, v, y0, y1, su, sv, f, { snow = 0xffffff, up = false } = {}) {
      const [x, z] = P(u, v), [sx, sz] = W(su, sv), Wd = { x, z, hw: sx / 2, hd: sz / 2, y0: O.y + y0, y1: O.y + y1, f: t => { const [fu, fv, fy = 0] = f(t), [wx, wz] = V(fu, fv); return [wx, fy, wz]; } };
      G.winds.push(Wd);
      // streaks that fly with the wind so you can see it
      const n = 40, im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 0.9), new THREE.MeshBasicMaterial({ color: snow, transparent: true, opacity: 0.7, depthWrite: false }), n);
      im.frustumCulled = false; S.add(im); const pts = Array.from({ length: n }, () => [Math.random(), Math.random(), Math.random()]), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1), Z3 = new THREE.Vector3(0, 0, 1);
      G.fx.push((t, dt, me) => {
        if (Math.abs(me.x - x) > 70 || Math.abs(me.z - z) > 70) { im.visible = false; return; } im.visible = true;
        const [fx, fy, fz] = Wd.f(t), sp = Math.hypot(fx, fy, fz) || 1; e.set(fx / sp, fy / sp, fz / sp); q.setFromUnitVectors(Z3, e);
        pts.forEach((p, i) => {
          p[0] += fx * dt / sx * 1.6; p[1] += (up ? fy * 0.35 : 0.3 * Math.sin(t * 3 + i)) * dt / (y1 - y0); p[2] += fz * dt / sz * 1.6;
          for (let k = 0; k < 3; k++) p[k] = ((p[k] % 1) + 1) % 1;
          m4.compose(new THREE.Vector3(x - sx / 2 + p[0] * sx, O.y + y0 + p[1] * (y1 - y0), z - sz / 2 + p[2] * sz), q, sc); im.setMatrixAt(i, m4);
        }); im.instanceMatrix.needsUpdate = true;
      });
      return Wd;
    },
    // a ladder on the -u face of a pillar
    ladder(u, v, y0, y1) {
      const [x, z] = P(u - 0.25, v), [sx, sz] = W(0.9, 1.7);
      G.ladders.push({ x, z, hw: sx / 2 + 0.25, hd: sz / 2, y0: O.y + y0 - 0.3, y1: O.y + y1 + 0.2 });
      const wood = std(0xc9a46a, { roughness: 0.8 }), g = new THREE.Group(); g.position.set(x, O.y + y0, z); S.add(g);
      for (const s of [-0.6, 0.6]) { const [ox, oz] = V(0, s), r = new THREE.Mesh(new THREE.BoxGeometry(0.12, y1 - y0 + 0.4, 0.12), wood); r.position.set(ox, (y1 - y0) / 2, oz); g.add(r); }
      for (let yy = 0.3; yy < y1 - y0; yy += 0.45) { const [rx, rz] = W(0.08, 1.2), r = new THREE.Mesh(new THREE.BoxGeometry(rx, 0.08, rz), wood); r.position.y = yy; g.add(r); }
    },
    // a wall you can wall-jump off
    wj(u, v, y0, y1, su, sv) {
      const [x, z] = P(u, v), [sx, sz] = W(su, sv), Wl = { x, z, hw: sx / 2, hd: sz / 2, rot: 0, y0: O.y + y0 - 1.7, y1: O.y + y1 };
      w.solids.push(Wl); G.wj.push(Wl);
      add(new THREE.Mesh(rbox(sx, y1 - y0, sz), std(0x7f8f6a, { roughness: 0.95 })), x, O.y + (y0 + y1) / 2, z).receiveShadow = true;
      for (let yy = y0 + 1; yy < y1; yy += 1.6) { const [ox, oz] = W(su * 0.8, sv + 0.04), vine = add(new THREE.Mesh(new THREE.BoxGeometry(ox, 0.18, oz), std(0x3fbf5f, { roughness: 0.8 })), x, O.y + yy, z); vine.castShadow = false; }
    },
    wall(u0, v0, u1, v1, h = 2.2, mat = M.ice) {
      const [x, z] = P((u0 + u1) / 2, (v0 + v1) / 2), [sx, sz] = W(Math.abs(u1 - u0) || 0.5, Math.abs(v1 - v0) || 0.5);
      add(new THREE.Mesh(rbox(sx, h, sz), mat), x, O.y + h / 2, z).receiveShadow = true;
      w.solids.push({ x, z, hw: sx / 2, hd: sz / 2, rot: 0, y0: O.y - 1.7, y1: O.y + h - 0.2 });
    },
    // lava that rises and falls inside this box
    lava(u, v, su, sv, yf) {
      const [x, z] = P(u, v), [sx, sz] = W(su, sv), m = add(new THREE.Mesh(new THREE.BoxGeometry(sx, 8, sz).translate(0, -3.85, 0), M.lava), x, O.y, z); m.castShadow = false; m.userData.dynamic = true;
      const Lv = { x, z, hw: sx / 2, hd: sz / 2, y: t => O.y + yf(t), m }; G.lavas.push(Lv); return Lv;
    },
    // an updraft column
    lift(u, v, y0, y1, s) {
      const [x, z] = P(u, v); F.wind(u, v, y0, y1, s, s, () => [0, 0, 34], { snow: 0x9ff3ff, up: true });
      const col = add(new THREE.Mesh(new THREE.CylinderGeometry(s / 2, s / 2, y1 - y0, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0x6ff3ff, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending })), x, O.y + (y0 + y1) / 2, z); col.castShadow = false;
      const fan = add(new THREE.Mesh(new THREE.TorusGeometry(s / 2 - 0.1, 0.12, 8, 24).rotateX(Math.PI / 2), M.metal), x, O.y + y0 + 0.08, z); fan.userData.dynamic = true;
      const blades = add(new THREE.Mesh(new THREE.BoxGeometry(s - 0.4, 0.05, 0.3), M.dark), x, O.y + y0 + 0.06, z); blades.userData.dynamic = true; G.fx.push((t, dt) => (blades.rotation.y += dt * 12));
    },
    sign(u, v, y, text, bg = 'rgba(14,18,26,0.82)') { const s = labelSprite(text, 0.42, { bg }); s.position.set(...loc(u, v, y)); S.add(s); },
  };
  F.along = along; F.lateral = lateral;
  return F;
}

// ---------- the 36 stages ----------
// len: distance to the next checkpoint, dy: how much higher it is. Route letters: w walk, j jump, b bounce, c climb, f fly, r ride
const sinV = (a, f, ph = 0) => t => [0, a * Math.sin(t * f + ph)];
const STAGES = [
  // 🍭 Candy Land
  { en: 'Gumdrop Hops', ru: 'Прыжки по мармеладкам', tip: ['Jump! (Space / ⤒)', 'Прыгай! (Пробел / ⤒)'], len: 19.5, dy: 1, f(S) { [[5, 0, 0.3], [9.5, 1, 0.6], [14, -1, 0.9]].forEach(([u, v, y], i) => { S.b(u, v, y, 3.5, 3.5, i % 2 ? 'b' : 'a', { gum: true }); S.r(u, v, y); }); S.c(9.5, 1, 1.8); S.c(14, -1, 2.1); } },
  { en: 'Kill Brick Path', ru: 'Дорожка смерти', tip: ['🟥 Red bricks = OOF!', '🟥 Красные блоки = БОЛЬНО!'], len: 22, dy: 0, f(S) {
    S.b(11, 0, 0, 17, 5, 'd'); [[6, -1.2], [9.5, 1.2], [13, -1.2], [16.5, 1.2]].forEach(([u, v]) => S.b(u, v, 0.15, 2.2, 2.6, 'kill', { h: 0.4 }));
    [[4.4, 1.4], [6, 1.4], [7.8, 0], [9.5, -1.4], [11.2, 0], [13, 1.4], [14.8, 0], [16.5, -1.4], [18.6, 0]].forEach(([u, v]) => S.r(u, v, 0, 'w')); S.c(7.8, 0, 1); S.c(14.8, 0, 1); } },
  { en: 'Bouncy Gumdrop', ru: 'Пружинящий мармелад', tip: ['🟩 Green = BOING!', '🟩 Зелёный = БУМ-ПРЫГ!'], len: 15, dy: 4, f(S) { S.b(6, 0, 0, 3, 3, 'bounce', { pow: 13 }); S.b(10.5, 0, 3.5, 3, 3, 'b', { h: 1 }); S.r(6, 0, 0); S.r(10.5, 0, 3.5, 'b'); S.c(8.3, 0, 4.6); S.c(6, 0, 3.5); } },
  { en: 'Cookie Shuttles', ru: 'Печеньки-челноки', len: 21, dy: 0.5, f(S) {
    const sh = sinV(3.5, 0.9), m1 = S.b(6, 0, 0, 3, 3, 'c', { move: sh }), m2 = S.b(11, 0, 0, 3, 3, 'c', { move: sh }); S.b(16, 0, 0.25, 3, 3, 'a');
    const near = t => Math.abs(Math.sin(t * 0.9)) < 0.45; S.rb(m1, 'j', { ok: near }); S.rb(m1, 'r', { d: 0.3 }); S.rb(m2, 'j'); S.rb(m2, 'r', { d: 0.2 }); S.r(16, 0, 0.25, 'j', { ok: near }); S.c(16, 0, 1.4); } },
  { en: 'Lollipop Spinner', ru: 'Леденец-вертушка', tip: ['Jump over the bar!', 'Перепрыгни палку!'], len: 20, dy: 0, f(S) { S.d(10, 0, 0, 5.5, 'b', { h: 0.8, lolli: true }); S.bar(10, 0, 0.45, 5.3, 1.1); S.r(5.6, 0, 0); S.r(14.4, 0, 0, 'w'); S.c(10, 3.5, 1); S.c(10, -3.5, 1); } },
  { en: 'Chocolate Conveyors', ru: 'Шоколадные ленты', len: 24, dy: 1, f(S) {
    S.b(7, 0, 0, 6, 3.2, 'conv', { cv: [0, -1], sp: 2.4 }); S.b(14.5, 0, 0.3, 6, 3.2, 'conv', { cv: [0, 1], sp: 2.4 }); S.b(19.75, 0, 0.6, 1.5, 1.5, 'a');
    S.r(4.6, 1, 0); S.r(9.4, -0.2, 0, 'w'); S.r(12.1, -1, 0.3); S.r(17, 0.2, 0.3, 'w'); S.r(19.75, 0, 0.6); S.c(7, 0, 1); S.c(14.5, 0, 1.3); } },
  // 🌋 Lava Caves
  { en: 'Stepping Stones', ru: 'Камни над лавой', len: 23, dy: 0.5, f(S) { [[5, 0, 0.1], [8.5, 1.2, 0.2], [12, -0.8, 0.3], [15.5, 0.6, 0.4], [19, -0.4, 0.45]].forEach(([u, v, y], i) => { S.b(u, v, y, 2.2, 2.2, i % 2 ? 'b' : 'a'); S.r(u, v, y); }); S.c(8.5, 1.2, 1.3); S.c(15.5, 0.6, 1.5); } },
  { en: 'The Lava Is Rising', ru: 'Лава поднимается', tip: ['Climb before the lava gets you!', 'Забирайся, пока лава не догнала!'], len: 20, dy: 4, f(S) {
    const ly = t => { const c = fr(t, 14) / 14; return -2.5 + 5 * (c < 0.7 ? c / 0.7 : 1 - (c - 0.7) / 0.3); };
    [[5, 0, 0.8, 2.6], [8.5, 1.5, 1.6, 2.6], [12, -1, 2.4, 2.6], [15.5, 0.5, 3.2, 3]].forEach(([u, v, y, s], i) => { S.b(u, v, y, 3, s, i % 2 ? 'b' : 'a', { h: 1.2 }); S.r(u, v, y, 'j', i ? {} : { ok: t => { const c = fr(t, 14) / 14; return c > 0.88 || c < 0.04; } }); });
    S.lava(11, 0, 17, 10, ly); S.c(12, -1, 3.5); S.c(15.5, 0.5, 4.3); } },
  { en: 'Crumbling Bridge', ru: 'Рассыпающийся мост', tip: ['Keep moving — it crumbles!', 'Не стой — мост рассыпается!'], len: 21.5, dy: 0, f(S) { [5, 8, 11, 14, 17].forEach(u => { S.b(u, 0, 0, 2.5, 2.5, 'fall'); S.r(u, 0, 0); }); S.c(11, 0, 1.2); } },
  { en: 'Fire Jets', ru: 'Огненные струи', len: 22, dy: 0.5, f(S) {
    S.b(10.5, 0, 0, 16, 3.2, 'a'); S.r(4.5, 0, 0, 'w');
    [6, 9.5, 13, 16.5].forEach((u, i) => { const on = t => fr(t, 3.4, i * 0.85) < 1.8; S.jet(u, 0, 1.4, 3.2, on); S.r(u - 1.3, 0, 0, 'w'); S.r(u + 1.3, 0, 0, 'w', { ok: t => !on(t) && !on(t + 0.9) }); });
    S.c(7.8, 0, 1); S.c(14.8, 0, 1); } },
  { en: 'Fire Spinners', ru: 'Огненные вертушки', tip: ['Fire bars = OOF. Jump them!', 'Огненные палки жгутся. Прыгай!'], len: 23, dy: 1, f(S) {
    S.d(7, 0, 0, 4, 'a'); S.d(16.5, 0, 0.5, 4, 'b'); S.bar(7, 0, 0.45, 3.7, 1.0, { kill: true, arms: 1 }); S.bar(16.5, 0, 0.95, 3.7, -1.2, { kill: true, arms: 1 });
    S.r(3.6, 0, 0); S.r(10.4, 0, 0, 'w'); S.r(12.9, 0, 0.5); S.r(20, 0, 0.5, 'w'); S.c(7, 2.5, 1); S.c(16.5, -2.5, 1.5); } },
  { en: 'Lava Elevator', ru: 'Лавовый лифт', len: 10.5, dy: 5, endOk: t => tri(t / 7) > 0.94, f(S) {
    const el = S.b(6, 0, 0, 3, 3, 'c', { move: t => [0, 0, 5 * tri(t / 7)] }); S.rb(el, 'j', { ok: t => tri(t / 7) < 0.08 }); S.rb(el, 'r', { d: 0.3 }); S.c(6, 0, 7); } },
  // ❄️ Frozen Peaks
  { en: 'Slippery Slopes', ru: 'Скользкие склоны', tip: ['Ice is slippery!', 'Лёд скользкий!'], len: 21, dy: 0.5, f(S) { [[5, 0.1], [10.5, 0.2], [16, 0.3]].forEach(([u, y]) => { S.b(u, 0, y, 4, 3.2, 'ice'); S.r(u, 0, y); }); S.c(10.5, 0, 1.3); } },
  { en: 'Icicle Beams', ru: 'Ледяные балки', len: 21.5, dy: 0.5, f(S) {
    S.b(6, 0, 0, 7, 0.7, 'b'); S.b(9.85, 2, 0, 0.7, 4.7, 'b'); S.b(12.9, 4, 0, 6.8, 0.7, 'b'); S.b(16, 2, 0, 0.7, 4.7, 'b'); S.b(17.5, 0, 0, 3.4, 0.7, 'b');
    [[9.85, 0], [9.85, 4], [16, 4], [16, 0], [18.6, 0]].forEach(([u, v]) => S.r(u, v, 0, 'w')); S.c(12.9, 4, 1); } },
  { en: 'Ice Maze', ru: 'Ледяной лабиринт', len: 20.5, dy: 0, f(S) {
    S.b(10.25, 0, 0, 15.3, 12.4, 'a');
    S.wall(2.6, -6.2, 17.9, -6.2); S.wall(2.6, 6.2, 17.9, 6.2); S.wall(2.85, -6.2, 2.85, -1.6); S.wall(2.85, 1.6, 2.85, 6.2); S.wall(17.65, -6.2, 17.65, -1.6); S.wall(17.65, 1.6, 17.65, 6.2);
    S.wall(6.5, -6, 6.5, 3); S.wall(10, -3, 10, 6); S.wall(13.5, -6, 13.5, 3); S.b(11.8, 0, 0.12, 2.6, 2, 'kill', { h: 0.4 });
    [[4.5, 0], [4.5, 4.6], [8.3, 4.6], [8.3, -4.6], [11.8, -4.6], [11.8, -1.6], [11.8, 1.6, 'j'], [11.8, 4.6], [15.5, 4.6], [15.5, 0], [18.6, 0]].forEach(([u, v, a]) => S.r(u, v, 0, a || 'w'));
    S.c(8.3, 0, 1); S.c(15.5, 2.5, 1); S.c(15.6, -4.6, 1.2, true); } },
  { en: 'Blizzard Bridge', ru: 'Мост в метель', tip: ['The wind pushes you!', 'Ветер сдувает!'], len: 21, dy: 1, f(S) {
    S.b(10.5, 0, 0.5, 16, 1.8, 'a'); S.wind(10.5, 0, 0, 4, 16, 9, t => [0, 2.1 + 1.6 * Math.sin(t * 1.3)]);
    S.r(3.5, 0, 0.5); S.r(18, -0.3, 0.5, 'w'); S.c(8, -0.3, 1.5); S.c(13, -0.3, 1.5); } },
  { en: 'Blinking Ice', ru: 'Мигающий лёд', len: 20, dy: 1, f(S) {
    [5, 8.75, 12.5, 16.25].forEach((u, i) => { const on = t => fr(t, 4, i % 2 ? 2 : 0) < 2.2; S.b(u, 0, 0.2 + i * 0.2, 2.8, 2.8, 'blink', { blink: on }); S.r(u, 0, 0.2 + i * 0.2, 'j', { ok: t => on(t + 0.5) && on(t + 1.2) }); });
    S.c(8.75, 0, 1.6); } },
  { en: 'Icicle Tower', ru: 'Ледяная башня', tip: ['Climb the ladder!', 'Лезь по лестнице!'], len: 10.5, dy: 6, f(S) {
    S.b(3.5, 0, 0, 2, 2.4, 'a'); S.b(6, 0, 6, 3, 3, 'b', { h: 6.6 }); S.ladder(4.5, 0, 0, 6.1);
    S.r(4.1, 0, 0, 'w'); S.r(4.1, 0, 6, 'c'); S.r(5.6, 0, 6, 'w'); S.c(4.1, 0, 3.5); } },
  // 🌴 Jungle Temple
  { en: 'Vine Tightrope', ru: 'Канат из лиан', tip: ['Careful… it sways!', 'Осторожно… качает!'], len: 21, dy: 0, f(S) {
    S.b(6, 0, 0, 7, 0.35, 'rope', { h: 0.25 }); S.b(10.5, 0, 0, 2, 2.2, 'b'); S.b(15, 0, 0, 7, 0.35, 'rope', { h: 0.25 }); S.wind(10.5, 0, -0.5, 3, 16, 6, t => [0, 1.1 * Math.sin(t * 1.4)], { snow: 0x9fe08a });
    S.r(10.5, 0, 0, 'w'); S.r(18.6, 0, 0, 'w'); S.c(6, 0, 1); S.c(15, 0, 1); } },
  { en: 'Swinging Logs', ru: 'Качающиеся брёвна', len: 21, dy: 0.5, f(S) {
    S.b(10.5, 0, 0, 16, 3, 'a'); S.r(4, 0, 0, 'w');
    [6, 10.5, 15].forEach((u, i) => { const ph = i * 2, sp = 1.5; S.pend(u, 0, 0, 0.75, sp, ph); S.r(u - 1.8, 0, 0, 'w'); S.r(u + 1.8, 0, 0, 'w', { ok: t => Math.abs(Math.sin(t * sp + ph)) > 0.75 }); });
    S.c(8.2, 0, 1); S.c(12.7, 0, 1); } },
  { en: 'Wall Jump Canyon', ru: 'Каньон прыжков от стен', tip: ['Jump, touch a wall, jump again!', 'Прыгни, коснись стены, прыгни ещё!'], len: 11.5, dy: 6, f(S) {
    S.b(6, 0, 0, 6, 3, 'a'); S.wj(6.5, -1.55, 0, 7.5, 5, 0.6); S.wj(6.5, 1.55, 0, 7.5, 5, 0.6);
    S.b(5.5, -0.85, 1.6, 2, 0.8, 'c'); S.b(6.5, 0.85, 3.2, 2, 0.8, 'c'); S.b(8.2, -0.85, 5.0, 1.6, 0.8, 'c');
    S.r(5, 0, 0, 'w'); S.r(5.5, -0.75, 1.6); S.r(6.5, 0.75, 3.2); S.r(8.2, -0.75, 5.0); S.c(6.5, 0, 2.6); S.c(7.5, 0, 4.5); } },
  { en: 'Mushroom Trampolines', ru: 'Грибы-батуты', len: 20, dy: 3, f(S) {
    [[5, 0, -1], [10, 0.8, 0], [15, -0.6, 1]].forEach(([u, v, y], i) => { S.d(u, v, y, 1.6, 'bounce', { pow: 11, mat: M.mush, h: 0.7 }); S.r(u, v, y, i ? 'b' : 'j'); });
    S.c(7.5, 0, 2.5); S.c(12.5, 0, 3.5); S.c(10, 0.8, 4.5, true); } },
  { en: 'Temple Gates', ru: 'Ворота храма', tip: ['Wait for the gate to open', 'Жди, пока ворота откроются'], len: 21.5, dy: 0, endWalk: true, f(S) {
    S.b(10.75, 0, 0, 16.5, 3.2, 'a'); S.r(4.6, 0, 0, 'w');
    [6.5, 11, 15.5].forEach((u, i) => { const D = S.door(u, 0, 3.2, 5, i * 1.6, 2.4); S.r(u - 1.4, 0, 0, 'w'); S.r(u + 1.4, 0, 0, 'w', { ok: t => D.isOpen(t) && D.isOpen(t + 0.9) }); });
    S.c(8.8, 0, 1); S.c(13.3, 0, 1); } },
  { en: 'Tiny Jumps', ru: 'Крошечные прыжки', len: 20, dy: 2.8, f(S) { [[4.5, 0, 0.4], [7, 0.8, 0.8], [9.5, -0.6, 1.2], [12, 0, 1.6], [14.5, 0.7, 2], [17, -0.3, 2.4]].forEach(([u, v, y], i) => { S.b(u, v, y, 1, 1, i % 2 ? 'b' : 'c'); S.r(u, v, y); }); S.c(12, 0, 2.7); } },
  // 🚀 Space Station (low gravity)
  { en: 'Moon Hops', ru: 'Лунные прыжки', tip: ['🌙 Low gravity — huge jumps!', '🌙 Слабая гравитация — огромные прыжки!'], len: 28, dy: 2, lowg: true, f(S) { [[8, 0.5], [15, 1], [21.5, 1.5]].forEach(([u, y], i) => { S.b(u, 0, y, 3, 3, i % 2 ? 'b' : 'a'); S.r(u, 0, y); }); S.c(11.5, 0, 3.5); S.c(18.2, 0, 4); } },
  { en: 'Orbit Platforms', ru: 'Орбитальные платформы', len: 26, dy: 2, lowg: true, f(S) {
    [[7.5, 0.5, 0], [13.5, 1, 2.1], [19.5, 1.5, 4.2]].forEach(([u, y, ph]) => { const b = S.d(u, 0, y, 1.6, 'c', { move: t => [2.2 * Math.cos(t * 0.7 + ph), 2.2 * Math.sin(t * 0.7 + ph)] }); S.rb(b, 'j'); S.rb(b, 'r', { d: 0.4 }); });
    S.c(10.5, 0, 3); S.c(16.5, 0, 3.5); } },
  { en: 'Laser Corridor', ru: 'Лазерный коридор', tip: ['Jump the low lasers, wait for the walls', 'Прыгай через низкие лазеры, жди стены'], len: 24, dy: 0, lowg: true, endWalk: true, f(S) {
    S.b(12, 0, 0, 19, 4, 'a'); S.laser(6, 0, 0.4, 4); const c1 = t => fr(t, 3) < 1.6, c2 = t => fr(t, 3, 1.5) < 1.6; S.curtain(9.5, 0, 4, 3, c1);
    S.laser(13, 0, 0.4, 4, { move: t => 1.35 + 1.05 * Math.sin(t * 1.6) }); S.curtain(16.5, 0, 4, 3, c2); S.laser(19.5, 0, 0.4, 4);
    S.r(5, 0, 0, 'w'); S.r(7.2, 0, 0); S.r(8.5, 0, 0, 'w'); S.r(10.6, 0, 0, 'w', { ok: t => !c1(t) && !c1(t + 0.7) }); S.r(12, 0, 0, 'w'); S.r(14.2, 0, 0); S.r(15.5, 0, 0, 'w'); S.r(17.6, 0, 0, 'w', { ok: t => !c2(t) && !c2(t + 0.7) }); S.r(18.5, 0, 0, 'w'); S.r(20.7, 0, 0);
    S.c(11.2, 1.3, 1); S.c(18, -1.3, 1); } },
  { en: 'Turntables', ru: 'Карусели', tip: ['Spinning floors carry you around', 'Крутящийся пол везёт тебя'], len: 27.5, dy: 1, lowg: true, f(S) {
    [[6.5, 0.3, 0.8, 'b'], [14, 0.6, -0.9, 'c'], [21.5, 0.9, 0.7, 'b']].forEach(([u, y, sp, k]) => {
      S.d(u, 0, y, 3.2, k, { spin: sp }); const [x, z] = S.P(u, 0);
      blk(x, z, S.loc(0, 0, y + 0.5)[1], 1, 1, 'kill', S.Z, { h: 0.5, move: t => [2.1 * Math.cos(sp * t), 0, -2.1 * Math.sin(sp * t)] });
      S.r(u - 2.2, 0, y); S.r(u + 2.2, 0, y, 'w'); });
    S.c(14, 0, 1.6); } },
  { en: 'Anti-Gravity Lift', ru: 'Антигравитационный лифт', tip: ['Ride the air up!', 'Лети вверх по потоку!'], len: 10.5, dy: 7, lowg: true, f(S) { S.b(6, 0, 0, 3, 3, 'c'); S.lift(6, 0, 0, 9, 2.6); S.r(6, 0, 0); S.r(6, 0, 9.4, 'f'); S.c(6, 0, 5); S.c(6, 0, 8); } },
  { en: 'Asteroid Belt', ru: 'Пояс астероидов', len: 26, dy: 2, lowg: true, f(S) {
    const a1 = S.b(6.5, 0, 0.3, 2.6, 2.6, 'b', { move: sinV(2.5, 1.1) }), a2 = S.b(11.5, 0, 0.6, 2.6, 2.6, 'a', { move: t => [0, 0, 1.2 * Math.sin(t * 0.9)] }), a3 = S.b(16.5, 0, 1, 2.6, 2.6, 'b', { move: t => [1.2 * Math.cos(t * 1.3), 0] });
    S.b(21.5, 0, 1.5, 2.6, 2.6, 'a'); for (const a of [a1, a2, a3]) { S.rb(a, 'j'); S.rb(a, 'r', { d: 0.3 }); } S.r(21.5, 0, 1.5); S.c(11.5, 0, 3); S.c(21.5, 0, 3.6, true); } },
  // ☁️ Sky Castle
  { en: 'Cloud Trampolines', ru: 'Облака-батуты', len: 22, dy: 3, f(S) { [[6, -0.5], [11, 0.5], [16, 1.5]].forEach(([u, y], i) => { S.d(u, 0, y, 1.8, 'bounce', { pow: 12, mat: M.cloud, cloud: true }); S.r(u, 0, y, i ? 'b' : 'j'); }); S.c(8.5, 0, 3); S.c(13.5, 0, 4); } },
  { en: 'Rainbow Wave', ru: 'Радужная волна', tip: ['Follow the wave!', 'Беги за волной!'], len: 21.5, dy: 0, endWalk: true, f(S) {
    const on = i => t => Math.sin(t * 1.4 - i * 0.9) > -0.55;
    for (let i = 0; i < 8; i++) S.b(3.5 + i * 2.1, 0, 0, 2, 3, 'blink', { blink: on(i), mat: std(new THREE.Color().setHSL(i / 8, 0.85, 0.6), { roughness: 0.3, emissive: new THREE.Color().setHSL(i / 8, 0.9, 0.35), emissiveIntensity: 0.5, transparent: true }) });
    S.r(3.5, 0, 0, 'j', { ok: t => on(0)(t) && !on(0)(t - 0.35) }); S.r(18.2, 0, 0, 'w'); S.c(10.8, 0, 1); } },
  { en: 'Wind Tunnel', ru: 'Аэротруба', tip: ['Jump when the wind is calm', 'Прыгай, когда ветер стихнет'], len: 21, dy: 1, f(S) {
    S.b(6, 0, 0, 6, 3, 'a'); S.b(12, 0, 0.5, 4.5, 3, 'b'); S.b(17, 0, 1, 3.5, 3, 'a');
    const gust = t => 1.6 + 1.6 * Math.max(0, Math.sin(t * 1.1)); S.wind(10.5, 0, -0.5, 4, 17, 6, t => [-gust(t), 0], { snow: 0xdfefff });
    S.r(8.6, 0, 0, 'w'); S.r(10.4, 0, 0.5, 'j', { ok: t => gust(t) < 1.8 }); S.r(13.8, 0, 0.5, 'w'); S.r(15.6, 0, 1, 'j', { ok: t => gust(t) < 1.8 }); S.c(12, 0, 1.6); } },
  { en: 'Sky Sweepers', ru: 'Небесные мётлы', len: 18, dy: 1, f(S) {
    S.d(9, 0, 0, 6, 'a', { h: 0.8 }); S.bar(9, 0, 0.45, 5.8, 0.9, { arms: 3 }); [[45], [135], [225], [315]].forEach(([a]) => S.b(9 + Math.cos(a * Math.PI / 180) * 3.3, Math.sin(a * Math.PI / 180) * 3.3, 0.15, 0.9, 0.9, 'kill', { h: 0.4 }));
    S.r(3.6, 0, 0); S.r(14.4, 0, 0, 'w'); S.c(9, 0, 1.4, true); } },
  { en: 'The Gauntlet', ru: 'Испытание', len: 23, dy: 2, f(S) {
    S.b(6, 0, 0, 6, 3, 'conv', { cv: [-1, 0], sp: 2 }); S.b(10.5, 0, 0.4, 2.2, 2.2, 'fall'); S.b(13, 0, 0.8, 2.2, 2.2, 'fall'); S.b(17.5, 0, 1.2, 5, 4, 'b');
    S.b(17.5, 0, 1.7, 1, 1, 'kill', { h: 0.5, move: t => [0, 1.6 * Math.sin(t * 2)] });
    S.r(3.6, 0, 0); S.r(8.6, 0, 0, 'w'); S.r(10.5, 0, 0.4); S.r(13, 0, 0.8); S.r(15.6, 0, 1.2); S.r(19.6, 0, 1.2, 'w', { ok: t => Math.sin(t * 2) > 0.3 }); S.c(17.5, 1.6, 2.2); } },
  { en: 'Stairway to the Trophy', ru: 'Лестница к кубку', tip: ['Last stage! Go go go!', 'Последний этап! Вперёд!'], len: 23, dy: 5, f(S) { [4.5, 7.3, 10.1, 12.9, 15.7, 18.5].forEach((u, i) => { S.b(u, 0, 0.7 * (i + 1), 2, 2, 'fall'); S.r(u, 0, 0.7 * (i + 1)); }); S.c(12.9, 0, 3.9); } },
];

// ---------- build everything ----------
export function buildCourse(w) {
  G.w = w; materials();
  let O = { ...START }, n = 1, zi = 0;
  const flagGeo = new THREE.PlaneGeometry(1.3, 0.8).translate(0.65, 0, 0), poleGeo = new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8);
  for (const def of STAGES) {
    zi = Math.floor((n - 1) / 6); const Z = ZONES[zi], st = { n, ...def, Z, zi, O: { ...O }, route: [], dir: Z.dir };
    G.stg[n] = st;
    padAt(st, O, Z, flagGeo, poleGeo);
    def.f(frame(O, Z, st));
    const [dx, dz] = Z.dir; O = { x: O.x + dx * def.len, y: O.y + def.dy, z: O.z + dz * def.len };
    st.route.push({ p: [O.x, O.y, O.z], a: def.endWalk ? 'w' : 'j', ok: def.endOk });
    st.minY = Math.min(st.O.y, ...st.route.map(r => (r.p ? r.p[1] : r.b.by))) ;
    n++;
  }
  // the trophy room sits where checkpoint 37 would be
  G.fin = { n: 37, O: { ...O }, Z: ZONES[5], dir: ZONES[5].dir, minY: O.y };
  G.stg[37] = G.fin;
  trophyRoom(w, O);
  zoneScenery(w);
  lobby(w);
}

function padAt(st, O, Z, flagGeo, poleGeo) {
  const w = G.w, S = w.scene, pad = blk(O.x, O.z, O.y, 5, 5, 'cp', Z, { h: 0.7, cp: st.n, keep: true });
  st.pad = pad;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.09, 8, 40).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: Z.c[2] })); ring.position.set(O.x, O.y + 0.03, O.z); S.add(ring);
  const [dx, dz] = Z.dir, px = O.x - dz * 2.1, pz = O.z + dx * 2.1;
  mesh(w, poleGeo, M.metal, px, O.y + 1.6, pz);
  st.flag = new THREE.Mesh(flagGeo, new THREE.MeshStandardMaterial({ color: Z.c[2], side: THREE.DoubleSide, roughness: 0.6 })); st.flag.position.set(px, O.y + 2.75, pz); st.flag.userData.dynamic = true; S.add(st.flag);
  const lab = labelSprite(`${Z.icon} ${st.n} · ${L(st.en, st.ru)}`, 0.5, { bg: Z.css + 'ee', weight: 800 }); lab.position.set(O.x, O.y + 3.6, O.z); S.add(lab);
  if (st.tip) { const tip = labelSprite(L(...st.tip), 0.36, { bg: 'rgba(14,18,26,0.8)' }); tip.position.set(O.x, O.y + 3.0, O.z); S.add(tip); }
}

// ---------- the trophy room at the very top ----------
function trophyRoom(w, O) {
  const S = w.scene, Z = ZONES[5], [dx, dz] = Z.dir, P = (u, v) => [O.x + dx * u - dz * v, O.z + dz * u + dx * v], gold = M.fin;
  const [fx, fz] = P(6.5, 0);
  G.fin.pad = blk(fx, fz, O.y, 18, 18, 'fin', Z, { h: 1.2, keep: true, cp: 37 });
  G.fin.c = [fx, fz];
  const marble = std(0xf7f3ea, { roughness: 0.25 });
  for (const [u, v] of [[-1.5, -7.5], [-1.5, 7.5], [14.5, -7.5], [14.5, 7.5], [6.5, -7.5], [6.5, 7.5]]) { const [x, z] = P(u, v); mesh(w, new THREE.CylinderGeometry(0.55, 0.65, 7, 20), marble, x, O.y + 3.5, z); w.solids.push({ x, z, r: 0.6 }); mesh(w, new THREE.BoxGeometry(1.6, 0.4, 1.6), gold, x, O.y + 7.1, z); }
  const [rx, rz] = P(6.5, 0); const roof = mesh(w, new THREE.TorusGeometry(10.4, 0.5, 12, 48).rotateX(Math.PI / 2), gold, rx, O.y + 7.4, rz); void roof;
  // the giant trophy on a podium
  const [tx, tz] = P(12.5, 0);
  mesh(w, new THREE.CylinderGeometry(2.2, 2.5, 1.4, 32), marble, tx, O.y + 0.7, tz); w.solids.push({ x: tx, z: tz, r: 2.3 });
  const cup = new THREE.LatheGeometry([[0, 0], [1.1, 0], [1.1, 0.25], [0.35, 0.45], [0.3, 1.4], [0.5, 1.7], [1.5, 2.2], [1.9, 3.6], [1.95, 4.3], [1.75, 4.3], [1.6, 3.5], [0.2, 2.6], [0, 2.6]].map(([a, b]) => new THREE.Vector2(a, b)), 40);
  G.trophy = mesh(w, cup, gold, tx, O.y + 1.4, tz); G.trophy.userData.dynamic = true;
  for (const s of [-1, 1]) { const h = mesh(w, new THREE.TorusGeometry(0.8, 0.14, 10, 24, Math.PI), gold, tx, O.y + 4.7, tz); h.rotation.z = s * Math.PI / 2; h.position.x += (dx ? 0 : s * 1.9); h.position.z += (dx ? s * 1.9 : 0); h.rotation.y = dx ? Math.PI / 2 : 0; G.trophy.attach(h); }
  const tl = labelSprite('🏆 ' + L('YOU BEAT THE MEGA OBBY!', 'ТЫ ПРОШЁЛ МЕГА ОББИ!'), 0.8, { bg: 'rgba(212,160,23,0.95)', color: '#1b1b1b', weight: 800 }); tl.position.set(tx, O.y + 7.6, tz); S.add(tl);
  // podium steps 1-2-3
  [[0, 1.0, 0xffd34d], [-2.2, 0.7, 0xdfe5ec], [2.2, 0.45, 0xcd7f32]].forEach(([v, h, c]) => { const [x, z] = P(8.5, v); blk(x, z, O.y + h, 2, 2, 'd', Z, { h: h + 0.3, mat: std(c, { metalness: 0.6, roughness: 0.3 }) }); });
  // play again and back to the lobby pads
  const padM = (c) => std(0x111111, { emissive: c, emissiveIntensity: 0.9, roughness: 0.3 });
  const [ax, az] = P(2, -5.5), [hx, hz] = P(2, 5.5);
  G.again = blk(ax, az, O.y + 0.15, 3, 3, 'd', Z, { h: 0.3, mat: padM(0x22c55e), act: 'again', nosolid: true });
  G.home = blk(hx, hz, O.y + 0.15, 3, 3, 'd', Z, { h: 0.3, mat: padM(0x3a86ff), act: 'home', nosolid: true });
  const la = labelSprite('🔁 ' + L('Play again', 'Ещё раз'), 0.5, { bg: 'rgba(34,197,94,0.95)' }); la.position.set(ax, O.y + 2.4, az); S.add(la);
  const lh = labelSprite('🏠 ' + L('Back to the lobby', 'В лобби'), 0.5, { bg: 'rgba(58,134,255,0.95)' }); lh.position.set(hx, O.y + 2.4, hz); S.add(lh);
  // the winners wall behind the trophy
  const [bx, bz] = P(16.8, 0);
  G.walls = G.walls || []; G.walls.push(board(w, bx, O.y + 4.2, bz, dx ? -Math.PI / 2 : 0, 9, 5.6));
  // a few castle towers around it
  for (const [u, v] of [[-4, -16], [18, -14], [20, 14], [-6, 15]]) { const [x, z] = P(u, v); mesh(w, new THREE.CylinderGeometry(2.4, 2.8, 16, 20), std(0xf3efe8, { roughness: 0.6 }), x, O.y - 6, z); mesh(w, new THREE.ConeGeometry(3.2, 5, 20), std(0x3a6fd8, { roughness: 0.5 }), x, O.y + 4.5, z); }
}

// a big canvas board (the winners wall); returns { tex, g, W, H }
export function board(w, x, y, z, ry, sw, sh) {
  const tx = canvasTexture(1024, 640, () => {}); const g = tx.image.getContext('2d');
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), new THREE.MeshBasicMaterial({ map: tx, side: THREE.DoubleSide })); m.position.set(x, y, z); m.rotation.y = ry; w.scene.add(m);
  const fr2 = new THREE.Mesh(new THREE.BoxGeometry(sw + 0.5, sh + 0.5, 0.3), M.fin); fr2.position.set(x, y, z); fr2.rotation.y = ry; fr2.translateZ(-0.2); w.scene.add(fr2);
  return { tex: tx, g, W: 1024, H: 640 };
}

// ---------- scenery: each zone gets its own floor and decorations (instanced, cheap on phones) ----------
function inst(w, geo, mat, list, color) {
  const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length)), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  list.forEach((d, i) => { e.set(d.rx || 0, d.ry || 0, d.rz || 0); q.setFromEuler(e); m4.compose(new THREE.Vector3(d.x, d.y, d.z), q, new THREE.Vector3(d.sx ?? d.s, d.sy ?? d.s, d.sz ?? d.s)); im.setMatrixAt(i, m4); if (color) im.setColorAt(i, new THREE.Color(d.c)); });
  im.count = list.length; im.castShadow = true; im.receiveShadow = true; w.scene.add(im); return im;
}
function zoneScenery(w) {
  const S = w.scene, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  ZONES.forEach((Z, zi) => {
    const a = G.stg[zi * 6 + 1].O, b = G.stg[zi * 6 + 7].O, [dx, dz] = Z.dir, len = Math.hypot(b.x - a.x, b.z - a.z), y0 = a.y, y1 = b.y;
    // points beside the course: t along it, side offset s
    const spot = (t, s) => [a.x + dx * t - dz * s, a.z + dz * t + dx * s];
    const side = (lo, hi) => (Math.random() < 0.5 ? -1 : 1) * rnd(lo, hi);
    const t0 = zi ? -35 : 2, t1 = len + 35, [cx, cz] = spot((t0 + t1) / 2, 0), fw = dx ? t1 - t0 : 90, fd = dx ? 90 : t1 - t0;
    const floor = (mat, y = 0.02 + zi * 0.012) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(fw, fd).rotateX(-Math.PI / 2), mat); m.position.set(cx, y, cz); m.receiveShadow = true; S.add(m); return m; };
    const N = w.hq ? 1 : 0.6, list = [];
    if (Z.k === 'candy') {
      floor(std(0xffb6d9, { roughness: 0.15, metalness: 0.1 }));
      const sticks = [], pops = [], drops = [];
      for (let i = 0; i < 26 * N; i++) { const [x, z] = spot(rnd(-10, len + 10), side(9, 38)), h = rnd(4, 13); sticks.push({ x, y: h / 2, z, sx: 1, sy: h, sz: 1, s: 1 }); pops.push({ x, y: h + 1.6, z, s: rnd(1.4, 2.6), ry: rnd(0, 6), rz: Math.PI / 2, c: pick([0xff4f9a, 0x6ff3ff, 0xffd34d, 0x9b6bff, 0x7dff4a]) }); }
      for (let i = 0; i < 40 * N; i++) { const [x, z] = spot(rnd(-10, len + 10), side(7, 40)); drops.push({ x, y: 0, z, s: rnd(0.8, 2.4), c: pick([0xff6fa8, 0x8fe3ff, 0xffe066, 0xb388ff, 0x7dff4a]) }); }
      inst(w, new THREE.CylinderGeometry(0.18, 0.18, 1, 8), std(0xffffff, { roughness: 0.4 }), sticks);
      inst(w, new THREE.CylinderGeometry(1, 1, 0.35, 28), new THREE.MeshStandardMaterial({ map: M.swirl, roughness: 0.3 }), pops, true);
      inst(w, new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), std(0xffffff, { roughness: 0.25, emissive: 0x222222 }), drops, true);
      for (let i = 0; i < 3; i++) { const [x, z] = spot(len * (0.2 + i * 0.3), side(14, 22)); const d = mesh(w, new THREE.TorusGeometry(5, 2.2, 16, 40), std(pick([0xff8fc6, 0xffd08a, 0xa98bff]), { roughness: 0.4 }), x, 5, z); d.rotation.y = rnd(0, 3); }
    }
    if (Z.k === 'lava') {
      const lt = M.lavaT.clone(); lt.repeat.set(fw / 14, fd / 14); lt.needsUpdate = true; G.lavaTex = lt; const lv = floor(new THREE.MeshStandardMaterial({ map: lt, emissive: 0xff5a10, emissiveMap: lt, emissiveIntensity: 1.1, roughness: 0.6 })); lv.userData.dynamic = true; G.lavaFloor = lv;
      for (let i = 0; i < 34 * N; i++) { const [x, z] = spot(rnd(-10, len + 10), side(8, 40)), h = rnd(3, y0 + 10); list.push({ x, y: h / 2 - 1, z, sx: rnd(2, 5), sy: h, sz: rnd(2, 5), s: 1, ry: rnd(0, 6) }); }
      inst(w, new THREE.DodecahedronGeometry(0.6, 0), std(0x3b2f2b, { roughness: 1, flatShading: true }), list);
      for (const s of [-1, 1]) { const [x, z] = spot(len * 0.5, s * 55); mesh(w, new THREE.ConeGeometry(28, 34, 24, 1, true), std(0x4a3a36, { roughness: 1, flatShading: true }), x, 16, z, { cast: false }); mesh(w, new THREE.CircleGeometry(7, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff6a10 }), x, 30.5, z, { cast: false }); }
    }
    if (Z.k === 'ice') {
      floor(std(0x2b6ea8, { roughness: 0.08, metalness: 0.3 }));
      for (let i = 0; i < 30 * N; i++) { const [x, z] = spot(rnd(-10, len + 10), side(8, 40)), h = rnd(8, y0 + 14); list.push({ x, y: h / 2, z, sx: rnd(2, 5), sy: h, sz: rnd(2, 5), s: 1, ry: rnd(0, 6), c: pick([0xe8f7ff, 0xbfe6ff, 0x9fd4ff]) }); }
      inst(w, new THREE.ConeGeometry(1, 1, 6), std(0xffffff, { roughness: 0.1, metalness: 0.1, flatShading: true }), list, true);
      const floes = []; for (let i = 0; i < 40 * N; i++) { const [x, z] = spot(rnd(-15, len + 15), side(5, 44)); floes.push({ x, y: 0.1, z, sx: rnd(1.5, 4), sy: 1, sz: rnd(1.5, 4), s: 1, ry: rnd(0, 6) }); }
      inst(w, new THREE.CylinderGeometry(1, 1, 0.3, 7), std(0xf5fbff, { roughness: 0.3 }), floes);
    }
    if (Z.k === 'jungle') {
      floor(std(0x2f4a24, { roughness: 0.4, metalness: 0.15 }));
      const trunks = [], tops = [];
      for (let i = 0; i < 26 * N; i++) { const [x, z] = spot(rnd(-10, len + 10), side(8, 36)), h = rnd(y0 - 6, y0 + 12); trunks.push({ x, y: h / 2, z, sx: 1.4, sy: h, sz: 1.4, s: 1 }); for (let k = 0; k < 3; k++) tops.push({ x: x + rnd(-3, 3), y: h + rnd(-1, 2), z: z + rnd(-3, 3), s: rnd(3, 5.5), c: pick([0x2f7d32, 0x3fa34d, 0x4caf50, 0x2e6b2a]) }); }
      inst(w, new THREE.CylinderGeometry(0.6, 1, 1, 9), std(0x5b4030, { roughness: 1 }), trunks);
      inst(w, new THREE.IcosahedronGeometry(1, 1), std(0xffffff, { roughness: 0.9, flatShading: true }), tops, true);
      const pads = []; for (let i = 0; i < 40 * N; i++) { const [x, z] = spot(rnd(-10, len + 10), side(4, 40)); pads.push({ x, y: 0.08, z, s: rnd(0.8, 1.8), ry: rnd(0, 6) }); }
      inst(w, new THREE.CylinderGeometry(1, 1, 0.08, 14, 1, false, 0, 5.6), std(0x4caf50, { roughness: 0.6 }), pads);
      for (let i = 0; i < 4; i++) { const [x, z] = spot(len * (0.15 + i * 0.25), side(16, 26)); for (let k = 0; k < 4; k++) mesh(w, new THREE.BoxGeometry(12 - k * 2.6, 3, 12 - k * 2.6), std(0x9a8a6a, { roughness: 1 }), x, 1.5 + k * 3, z); }
    }
    if (Z.k === 'space') {
      const sp = floor(new THREE.MeshBasicMaterial({ color: 0x120a2a })); void sp;
      const stars = new THREE.BufferGeometry(), pos = []; for (let i = 0; i < 900; i++) { const [x, z] = spot(rnd(-40, len + 40), rnd(-70, 70)); pos.push(x, rnd(0.1, y0 + 40), z); }
      stars.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); S.add(new THREE.Points(stars, new THREE.PointsMaterial({ color: 0xffffff, size: 0.35, sizeAttenuation: true })));
      for (let i = 0; i < 36 * N; i++) { const [x, z] = spot(rnd(-10, len + 10), side(9, 40)); list.push({ x, y: rnd(y0 - 15, y0 + 15), z, s: rnd(0.8, 3), rx: rnd(0, 6), ry: rnd(0, 6) }); }
      inst(w, new THREE.IcosahedronGeometry(1, 0), std(0x8a8494, { roughness: 1, flatShading: true }), list);
      [[0.25, -45, 9, 0xff8a5c], [0.6, 50, 14, 0x6ad0ff], [0.9, -38, 6, 0xc49bff]].forEach(([t, s, r, c]) => { const [x, z] = spot(len * t, s), pl = mesh(w, new THREE.SphereGeometry(r, 32, 20), std(c, { roughness: 0.7, emissive: c, emissiveIntensity: 0.15 }), x, y0 + 8, z); const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.6, r * 0.12, 4, 48).rotateX(1.2), std(0xffe0a0, { roughness: 0.5 })); pl.add(ring); });
    }
    if (Z.k === 'sky') {
      const puffs = [];
      for (let i = 0; i < 70 * N; i++) { const [x, z] = spot(rnd(-15, len + 25), side(5, 45)); const yy = y0 - rnd(9, 13); for (let k = 0; k < 3; k++) puffs.push({ x: x + rnd(-3, 3), y: yy + rnd(-0.5, 1.2), z: z + rnd(-3, 3), sx: rnd(3, 6), sy: rnd(1.4, 2.4), sz: rnd(3, 6), s: 1 }); }
      for (let i = 0; i < 14 * N; i++) { const [x, z] = spot(rnd(0, len), side(12, 40)); const yy = rnd(y0, y1 + 8); for (let k = 0; k < 4; k++) puffs.push({ x: x + rnd(-2.5, 2.5), y: yy + rnd(-0.6, 0.8), z: z + rnd(-2.5, 2.5), sx: rnd(2, 3.5), sy: rnd(1.2, 2), sz: rnd(2, 3.5), s: 1 }); }
      inst(w, new THREE.SphereGeometry(1, 14, 10), std(0xffffff, { roughness: 1, emissive: 0xdfe9ff, emissiveIntensity: 0.25 }), puffs);
      const [rx, rz] = spot(len * 0.45, -30); const rb = new THREE.Group(); rb.position.set(rx, y0 - 8, rz); rb.rotation.y = dx ? 0 : Math.PI / 2; S.add(rb);
      ['#ff3b3b', '#ff9f1c', '#ffe14d', '#3ddc84', '#3a86ff', '#9b5de5'].forEach((c, k) => rb.add(new THREE.Mesh(new THREE.TorusGeometry(26 - k * 1.1, 0.55, 8, 64, Math.PI), new THREE.MeshBasicMaterial({ color: c }))));
    }
  });
}

// ---------- the lobby: a round candy island where everyone starts ----------
function lobby(w) {
  const S = w.scene;
  mesh(w, new THREE.CylinderGeometry(LOBBY_R, LOBBY_R + 1.5, 3, 64), std(0x6fcf6a, { roughness: 0.9 }), 0, -1.5, 0, { cast: false });
  mesh(w, new THREE.TorusGeometry(LOBBY_R, 0.35, 10, 80).rotateX(Math.PI / 2), std(0xffffff, { roughness: 0.4 }), 0, 0.05, 0, { cast: false });
  mesh(w, new THREE.CircleGeometry(6, 48).rotateX(-Math.PI / 2), std(0xff7eb6, { roughness: 0.4 }), -4, 0.02, 0, { cast: false });
  // the start arch over checkpoint 1
  const arch = std(0xff4f9a, { roughness: 0.4 }), ax = START.x - 3.2;
  for (const s of [-1, 1]) mesh(w, new THREE.CylinderGeometry(0.45, 0.55, 7, 16), arch, ax, 3.5, s * 3.4);
  mesh(w, new THREE.BoxGeometry(1, 1.6, 8.2), arch, ax, 7.3, 0);
  const sign = canvasTexture(512, 128, (g, W, H) => { const gr = g.createLinearGradient(0, 0, W, 0); ['#ff3b3b', '#ff9f1c', '#ffe14d', '#3ddc84', '#3a86ff', '#9b5de5'].forEach((c, i) => gr.addColorStop(i / 5, c)); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.strokeStyle = '#1b1b1b'; g.lineWidth = 10; g.font = '900 78px Manrope, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.strokeText('MEGA OBBY', W / 2, H / 2 + 4); g.fillText('MEGA OBBY', W / 2, H / 2 + 4); });
  const sm = new THREE.Mesh(new THREE.PlaneGeometry(7.6, 1.9), new THREE.MeshBasicMaterial({ map: sign, side: THREE.DoubleSide })); sm.position.set(ax - 0.52, 7.3, 0); sm.rotation.y = -Math.PI / 2; S.add(sm);
  const go = labelSprite('▶ ' + L('Start the course here!', 'Начни трассу здесь!'), 0.6, { bg: 'rgba(34,197,94,0.95)', weight: 800 }); go.position.set(START.x - 6, 2.6, 0); S.add(go);
  // the winners wall and a how-to-play board
  G.walls = G.walls || []; G.walls.push(board(w, -13.5, 3.3, -9, Math.PI / 4, 8, 5));
  for (const [x, z] of [[-16.3, -6], [-10.7, -11.7]]) mesh(w, new THREE.CylinderGeometry(0.2, 0.2, 6, 10), M.metal, x, 3, z);
  const how = board(w, -13.5, 3.3, 9, Math.PI * 3 / 4, 8, 5); const g = how.g;
  g.fillStyle = '#16203a'; g.fillRect(0, 0, 1024, 640); g.fillStyle = '#ffd34d'; g.font = '900 64px Manrope, system-ui'; g.fillText('🧗 ' + L('How to play', 'Как играть'), 40, 90);
  g.fillStyle = '#fff'; g.font = '700 38px Manrope, system-ui';
  [L('🏁 36 stages, 6 worlds. Reach the trophy!', '🏁 36 этапов, 6 миров. Доберись до кубка!'), L('🚩 Checkpoints save your stage', '🚩 Чекпоинты сохраняют этап'), L('🟥 Red = OOF  🟩 Green = bounce', '🟥 Красный = БОЛЬНО  🟩 Зелёный = прыжок'), L('🧊 Ice slides · 🟧 orange crumbles', '🧊 Лёд скользит · 🟧 оранжевый рушится'), L('⏭ Free skip every 10 minutes', '⏭ Бесплатный пропуск раз в 10 минут'), L('🔄 R = back to checkpoint', '🔄 R = назад на чекпоинт')].forEach((s, i) => g.fillText(s, 40, 175 + i * 74));
  how.tex.needsUpdate = true;
  for (const [x, z] of [[-16.3, 6], [-10.7, 11.7]]) mesh(w, new THREE.CylinderGeometry(0.2, 0.2, 6, 10), M.metal, x, 3, z);
  // lollipops round the edge
  const cols = [0xff4f9a, 0x6ff3ff, 0xffd34d, 0x9b6bff];
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3, x = Math.cos(a) * (LOBBY_R - 1.5), z = Math.sin(a) * (LOBBY_R - 1.5); if (x > 12) continue; mesh(w, new THREE.CylinderGeometry(0.12, 0.12, 4, 8), std(0xffffff), x, 2, z); const p = mesh(w, new THREE.CylinderGeometry(1.1, 1.1, 0.3, 28), new THREE.MeshStandardMaterial({ map: M.swirl, color: cols[i % 4], roughness: 0.3 }), x, 4.9, z); p.rotation.x = Math.PI / 2; p.rotation.z = a; }
}
export { M, tri, fr };
