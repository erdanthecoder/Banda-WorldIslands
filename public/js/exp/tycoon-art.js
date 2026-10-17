// 🍦 Ice Cream Tycoon art: the candy plaza (giant ice cream statue, slide, gumdrop trees) and every
// building you can buy on a plot. Each bought thing is baked into a few meshes (one per material) so phones stay fast.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { std, canvasTexture } from './core.js';
import { surface } from './tex.js';

export const FLAVORS = [0xff8fb8, 0xfff1cc, 0x7a4a2a, 0x9df2d0, 0xa9b8ff, 0xffb347];
const TAU = Math.PI * 2;

// ---------- materials (shared, so baking merges them) ----------
const stripes = (a, b, n, diag) => { const t = canvasTexture(256, 256, (g, W) => { g.fillStyle = a; g.fillRect(0, 0, W, W); g.fillStyle = b; for (let k = -n; k < n * 2; k += 2) { g.beginPath(); const s = W / n, o = diag ? W : 0; g.moveTo(k * s, 0); g.lineTo(k * s + s, 0); g.lineTo(k * s + s + o, W); g.lineTo(k * s + o, W); g.fill(); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
const waffleT = canvasTexture(128, 128, (g, W) => { g.fillStyle = '#d99a52'; g.fillRect(0, 0, W, W); g.strokeStyle = '#9c5f25'; g.lineWidth = 7; for (let k = -W; k < W * 2; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + W, W); g.stroke(); g.beginPath(); g.moveTo(k + W, 0); g.lineTo(k, W); g.stroke(); } });
waffleT.wrapS = waffleT.wrapT = THREE.RepeatWrapping; waffleT.repeat.set(4, 2);
const candyT = stripes('#ffffff', '#ff4f8b', 6, true); candyT.repeat.set(1, 3);
const awnT = stripes('#ffffff', '#ff6fa8', 10, false);
const glow = (c, i = 1.4) => std(0x111111, { emissive: c, emissiveIntensity: i, roughness: 0.4 });
export const M = {
  white: std(0xeee8e2, { roughness: 0.5 }), pink: std(0xff8fb8, { roughness: 0.42 }), hot: std(0xff4f8b, { roughness: 0.38 }), mint: std(0x8fe3c8, { roughness: 0.45 }),
  choco: std(0x6b3f22, { roughness: 0.55 }), cream: std(0xfff1cc, { roughness: 0.5 }), sky: std(0xbfe6ff, { roughness: 0.3 }), blue: std(0x4f9dff, { roughness: 0.4 }),
  yellow: std(0xffd34d, { roughness: 0.4 }), red: std(0xe8304c, { roughness: 0.3 }), dark: std(0x2b2f38, { roughness: 0.5 }), purple: std(0xa070ff, { roughness: 0.4 }),
  metal: std(0xd5dbe2, { metalness: 0.85, roughness: 0.28 }), gold: std(0xffc93c, { metalness: 1, roughness: 0.22, emissive: 0x5a3a00, emissiveIntensity: 0.35 }),
  glass: new THREE.MeshStandardMaterial({ color: 0xd8f6ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.35 }),
  waffle: std(0xffffff, { map: waffleT, roughness: 0.8 }), candy: std(0xffffff, { map: candyT, roughness: 0.35 }), awning: std(0xffffff, { map: awnT, roughness: 0.6, side: THREE.DoubleSide }),
  water: std(0x5fd0ff, { roughness: 0.08, metalness: 0.2, emissive: 0x0b5a7a, emissiveIntensity: 0.5, transparent: true, opacity: 0.85 }),
  wood: surface('wood', [3, 3]), slab: surface('concrete', [6, 6], { color: 0xf0dde2 }), plaster: surface('plaster', [6, 1], { color: 0xc8f5e4 }),
  gG: glow(0x3dff7a), gY: glow(0xffd34d, 1.6), gP: glow(0xc070ff, 1.8), gB: glow(0x46c8ff, 1.8), gPink: glow(0xff5fa2, 1.6), gW: glow(0xfff6e0, 1.2),
  portal: [0x9df2d0, 0xff6fa8, 0xc070ff].map(c => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false })),
};
export const DOT = canvasTexture(32, 32, (c, W) => { const gr = c.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, W, W); });
export const FM = FLAVORS.map(c => std(c, { roughness: 0.45 }));

// ---------- little helpers ----------
function part(g, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); m.castShadow = m.receiveShadow = true; g.add(m); return m; }
const box = (g, w, h, d, m, x, y, z, ry = 0) => part(g, new THREE.BoxGeometry(w, h, d), m, x, y, z, 0, ry);
const rbox = (g, w, h, d, m, x, y, z, r = 0.08) => part(g, new RoundedBox(w, h, d, 2, r), m, x, y, z);
const cyl = (g, r1, r2, h, m, x, y, z, seg = 16) => part(g, new THREE.CylinderGeometry(r1, r2, h, seg), m, x, y, z);
const ball = (g, r, m, x, y, z, seg = 16) => part(g, new THREE.SphereGeometry(r, seg, Math.ceil(seg * 0.7)), m, x, y, z);
// a stick between two points (rails, ropes)
function stick(g, r, m, a, b) { const d = new THREE.Vector3().subVectors(b, a), o = part(g, new THREE.CylinderGeometry(r, r, d.length(), 8), m, (a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); return o; }
const V = (x, y, z) => new THREE.Vector3(x, y, z);
// an ice cream: waffle cone (tip at y) and stacked scoops with a cherry; s = size
export function icecream(g, x, y, z, s = 1, flav = [0, 3, 2]) {
  cyl(g, 0.9 * s, 0.05 * s, 2.4 * s, M.waffle, x, y + 1.2 * s, z, 20);
  part(g, new THREE.TorusGeometry(0.9 * s, 0.14 * s, 8, 24), M.waffle, x, y + 2.4 * s, z, Math.PI / 2);
  flav.forEach((f, k) => { const r = (0.95 - k * 0.1) * s, yy = y + (2.75 + k * 1.15) * s; ball(g, r, FM[f], x, yy, z, 20).scale.y = 0.92; part(g, new THREE.TorusGeometry(r * 0.9, r * 0.22, 8, 20), FM[f], x, yy - r * 0.45, z, Math.PI / 2); });
  const top = y + (2.75 + flav.length * 1.15) * s - 0.35 * s; ball(g, 0.24 * s, M.red, x, top, z, 12); stick(g, 0.03 * s, M.choco, V(x, top + 0.2 * s, z), V(x + 0.12 * s, top + 0.55 * s, z));
}
export function canvasPlane(w, h, cw, ch, draw, basic = true) { const t = canvasTexture(cw, ch, draw); const m = basic ? new THREE.MeshBasicMaterial({ map: t, transparent: true, side: THREE.DoubleSide }) : std(0xffffff, { map: t }); return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); }
function emojiText(g, text, x, y, size, color = '#fff', font = 900) { g.font = `${font} ${size}px Manrope, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = size / 6; g.strokeStyle = 'rgba(0,0,0,0.35)'; g.strokeText(text, x, y); g.fillStyle = color; g.fillText(text, x, y); }

// merges every mesh of a group by material (children marked userData.keep stay as they are, e.g. spinning fans)
export function bake(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), by = new Map(), drop = [], mm = new THREE.Matrix4();
  const walk = o => { for (const c of [...o.children]) { if (c.userData.keep) continue; if (c.isMesh && !c.isInstancedMesh && !Array.isArray(c.material)) { let geo = c.geometry.index ? c.geometry.toNonIndexed() : c.geometry.clone(); geo.applyMatrix4(mm.multiplyMatrices(inv, c.matrixWorld)); for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k); if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2)); if (!by.has(c.material)) by.set(c.material, []); by.get(c.material).push(geo); drop.push(c); } walk(c); } };
  walk(g);
  drop.forEach(c => c.parent.remove(c));
  for (const [m, list] of by) { const geo = mergeGeometries(list); list.forEach(x => x.dispose()); if (!geo) continue; const o = new THREE.Mesh(geo, m); o.castShadow = !m.transparent; o.receiveShadow = true; g.add(o); }
  return g;
}

// ---------- the plot (local frame: +z faces the plaza, the gate is at z = +15) ----------
export const BELTS = [-3, -7.5], BX0 = -8.5, BX1 = 12, ARCH = [-0.5, -3, -5.5];
export const DROPS = { drop1: [0, 8], drop2: [0, 5], drop3: [0, 2], drop4: [1, 8], drop5: [1, 5], drop6: [1, 2], golden: [0, 10.6] };
export const COLLECT = [-10.5, 0.9], CLAIM = [0, 17.6], COUNTER = [9, 14.3];
export const SLIDE_PTS = [[-13.5, 5.6, -2.3], [-13.5, 5.3, -0.6], [-13.7, 4.0, 1.4], [-13.0, 2.4, 3.6], [-13.6, 1.0, 5.9], [-13.4, 0.35, 8.0], [-13.3, 0.22, 9.5]];
const BL = BX1 - BX0, BC = (BX0 + BX1) / 2;
function belt(g, z, P) {
  box(g, BL, 0.12, 1.5, P.beltMat, BC, 0.98, z); box(g, BL, 0.35, 1.3, M.dark, BC, 0.75, z);
  for (const s of [-1, 1]) box(g, BL, 0.24, 0.12, M.metal, BC, 1.06, z + s * 0.81);
  for (let x = BX0 + 0.6; x < BX1; x += 3.4) for (const s of [-1, 1]) cyl(g, 0.07, 0.07, 0.62, M.metal, x, 0.31, z + s * 0.55, 8);
  for (const x of [BX0, BX1]) part(g, new THREE.CylinderGeometry(0.2, 0.2, 1.5, 14), M.metal, x, 0.95, z, Math.PI / 2);
  return [BC, z, BL / 2 + 0.2, 0.9, -2, 3];
}
function dropper(g, x, z, fm, gold) {
  const post = gold ? M.gold : M.metal;
  for (const s of [-1, 1]) cyl(g, 0.08, 0.08, 4.1, post, x, 2.05, z + s * 1.0, 8);
  box(g, 0.25, 0.25, 2.3, post, x, 4.05, z);
  cyl(g, 0.72, 0.62, 1.0, gold ? M.gold : fm, x, 3.45, z, 20); cyl(g, 0.74, 0.74, 0.18, gold ? M.white : M.white, x, 3.2, z, 20);
  ball(g, 0.62, gold ? M.gold : fm, x, 3.95, z, 18).scale.y = 0.8; ball(g, 0.16, M.red, x, 4.55, z, 10);
  cyl(g, 0.45, 0.14, 0.5, post, x, 2.7, z, 14);
  const noz = cyl(g, 0.17, 0.22, 0.25, gold ? M.gold : M.hot, x, 2.35, z, 12); noz.userData.keep = true; g.userData.noz = noz;
}
function arch(g, x, k) {
  const col = [M.mint, M.pink, M.purple][k];
  for (const z of [-1.3, -9.2]) rbox(g, 0.42, 3.6, 0.42, col, x, 1.8, z, 0.06);
  rbox(g, 0.75, 0.6, 8.4, col, x, 3.6, -5.25, 0.1); box(g, 0.78, 0.12, 8.45, M.white, x, 3.35, -5.25);
  for (const z of BELTS) { part(g, new THREE.PlaneGeometry(1.7, 1.3), M.portal[k], x, 1.75, z, 0, Math.PI / 2); box(g, 0.3, 0.14, 1.9, [M.gG, M.gPink, M.gP][k], x, 2.45, z); }
  if (k === 0) { cyl(g, 0.45, 0.04, 1.2, M.waffle, x, 4.5, -5.25, 14); ball(g, 0.45, FM[3], x, 5.2, -5.25, 14); }
  if (k === 1) { cyl(g, 0.55, 0.35, 0.5, M.glass, x, 4.15, -5.25, 16); ball(g, 0.45, FM[0], x, 4.6, -5.25, 14); ball(g, 0.15, M.red, x, 5.1, -5.25, 10); }
  if (k === 2) for (let i = 0; i < 7; i++) ball(g, 0.22, [M.red, M.yellow, M.mint, M.blue, M.purple, M.pink, M.hot][i], x, 4.1, -5.25 - 3 + i, 10);
  return [[x, -1.3, 0.25, 0.25, -2, 4], [x, -9.2, 0.25, 0.25, -2, 4]];
}
function nameTex(name) {
  return canvasTexture(1024, 256, (g, W, H) => { const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#ff6fa8'); gr.addColorStop(1, '#ffb36b'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.fillStyle = 'rgba(255,255,255,0.25)'; for (let i = 0; i < 40; i++) g.fillRect(Math.random() * W, Math.random() * H, 14, 5); emojiText(g, '🍦 ' + name, W / 2, H / 2 + 6, name.length > 18 ? 64 : 84); });
}

// the plot floor, belt A, the collector and its pad: every plot has these
export function plotBase(P) {
  const g = new THREE.Group();
  rbox(g, 30.4, 0.3, 30.4, M.slab, 0, -0.13, 0, 0.1);
  for (const [w, d, x, z] of [[30.8, 0.45, 0, 15.2], [30.8, 0.45, 0, -15.2], [0.45, 30.8, 15.2, 0], [0.45, 30.8, -15.2, 0]]) rbox(g, w, 0.34, d, M.pink, x, -0.06, z, 0.12);
  const sol = [belt(g, BELTS[0], P)];
  // the collector tub
  rbox(g, 3.4, 2.2, 7.4, M.pink, -10.6, 1.1, -5.25, 0.25); box(g, 3.45, 0.26, 7.45, M.white, -10.6, 1.55, -5.25); rbox(g, 3.0, 0.12, 7.0, M.gG, -10.6, 2.22, -5.25, 0.05);
  for (const z of BELTS) { box(g, 1.2, 1.0, 1.9, M.metal, -8.75, 1.35, z); box(g, 0.1, 0.7, 1.4, M.dark, -8.1, 1.35, z); }
  icecream(g, -10.6, 2.3, -5.25, 0.4, [0, 1]);
  sol.push([-10.6, -5.25, 1.75, 3.75, -2, 4.2]);
  // the collect pad
  const pad = canvasPlane(2.4, 2.4, 256, 256, (c, W) => { c.fillStyle = '#ffd34d'; c.beginPath(); c.arc(W / 2, W / 2, W / 2 - 4, 0, TAU); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 10; c.stroke(); emojiText(c, '💰', W / 2, W / 2 - 18, 90); emojiText(c, 'COLLECT', W / 2, W / 2 + 70, 40, '#5a3a00'); });
  pad.rotation.x = -Math.PI / 2; pad.position.set(COLLECT[0], 0.2, COLLECT[1]); pad.userData.keep = true; g.add(pad); g.userData.pad = pad;
  cyl(g, 1.35, 1.45, 0.18, M.gY, COLLECT[0], 0.09, COLLECT[1], 32);
  // claim pad in front of the gate
  cyl(g, 1.7, 1.8, 0.16, M.white, CLAIM[0], 0.08, CLAIM[1], 32);
  bake(g); g.userData.sol = sol; return g;
}

// every item you can buy: builds a group in plot space; userData.sol = solid boxes [x, z, hw, hd, y0, y1] or circles [x, z, r]
export const BUILD = {
  floor(P) {
    const g = new THREE.Group(), t = canvasTexture(128, 128, (c, W) => { for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { c.fillStyle = (i + j) % 2 ? '#ffd6e6' : '#fffaf2'; c.fillRect(i * 64, j * 64, 64, 64); } c.strokeStyle = 'rgba(200,150,170,0.5)'; c.lineWidth = 2; c.strokeRect(0, 0, W, W); });
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(14, 14);
    part(g, new THREE.PlaneGeometry(29.6, 29.6), std(0xe6dadd, { map: t, roughness: 0.5, metalness: 0.05 }), 0, 0.035, 0, -Math.PI / 2);
    part(g, new THREE.PlaneGeometry(3.2, 13), M.mint, 0, 0.045, 8.4, -Math.PI / 2);
    return bake(g);
  },
  walls(P) {
    const g = new THREE.Group(), sol = [];
    const seg = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2, along = x0 === x1;
      box(g, L, 3.0, 0.4, M.plaster, cx, 1.5, cz, ry); box(g, L + 0.1, 0.3, 0.55, M.pink, cx, 3.1, cz, ry); box(g, L + 0.05, 0.35, 0.5, M.hot, cx, 0.17, cz, ry);
      for (let k = 0.75; k < L; k += 2.5) ball(g, 0.3, M.cream, along ? cx : x0 + Math.sign(x1 - x0) * k, 3.4, along ? z0 + Math.sign(z1 - z0) * k : cz, 12);
      sol.push(along ? [cx, cz, 0.25, L / 2, -2, 3.6] : [cx, cz, L / 2, 0.25, -2, 3.6]); };
    seg(-15, -15, 15, -15); seg(-15, -15, -15, 15); seg(15, -15, 15, 15); seg(-15, 15, -2.6, 15); seg(2.6, 15, 6, 15); seg(12, 15, 15, 15);
    g.userData.sol = sol; return bake(g);
  },
  sign(P) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) { cyl(g, 0.38, 0.38, 6, M.candy, s * 2.95, 3, 15, 16); ball(g, 0.55, M.pink, s * 2.95, 6.3, 15, 16); }
    rbox(g, 7.2, 1.9, 0.35, M.white, 0, 6.5, 15, 0.12);
    const m = new THREE.MeshBasicMaterial({ map: nameTex(P.name || '?') }); g.userData.dispose = [m.map, m];
    part(g, new THREE.PlaneGeometry(6.8, 1.6), m, 0, 6.5, 15.19); part(g, new THREE.PlaneGeometry(6.8, 1.6), m, 0, 6.5, 14.81, 0, Math.PI);
    g.userData.sol = [[-2.95, 15, 0.45], [2.95, 15, 0.45]]; return bake(g);
  },
  lamps(P) {
    const g = new THREE.Group(), at = [[-13.4, 13.4], [13.4, 13.4], [-4.2, 14.1], [4.2, 14.1], [-13.4, -13.4], [13.4, -13.4]];
    for (const [x, z] of at) { cyl(g, 0.12, 0.16, 3.4, M.candy, x, 1.7, z, 10); cyl(g, 0.3, 0.3, 0.12, M.hot, x, 3.42, z, 14); ball(g, 0.36, M.gY, x, 3.8, z, 14); cyl(g, 0.08, 0.3, 0.22, M.hot, x, 4.2, z, 12); }
    g.userData.sol = at.map(([x, z]) => [x, z, 0.25]); return bake(g);
  },
  counter(P) {
    const g = new THREE.Group(), [cx, cz] = COUNTER;
    rbox(g, 5.6, 1.1, 1.1, M.white, cx, 0.55, cz, 0.08); box(g, 5.62, 0.6, 0.05, M.pink, cx, 0.55, cz + 0.56);
    rbox(g, 4.8, 0.5, 0.8, M.glass, cx, 1.36, cz, 0.06);
    for (let k = 0; k < 6; k++) part(g, new THREE.SphereGeometry(0.28, 12, 8, 0, TAU, 0, Math.PI / 2), FM[k], cx - 1.9 + k * 0.76, 1.12, cz);
    for (const s of [-1, 1]) cyl(g, 0.09, 0.09, 3.2, M.candy, cx + s * 2.7, 1.6, cz - 0.4, 8);
    part(g, new THREE.BoxGeometry(6.2, 0.1, 2.4), M.awning, cx, 3.35, cz + 0.2, 0.18);
    const menu = canvasPlane(3.2, 0.9, 512, 144, (c, W, H) => { c.fillStyle = '#3a2340'; c.fillRect(0, 0, W, H); emojiText(c, '🍦 🍨 🍧  ICE CREAM!', W / 2, H / 2 + 4, 52, '#ffd34d'); });
    menu.position.set(cx, 4.05, cz + 0.3); g.add(menu);
    // Robo-Scooper behind the counter
    cyl(g, 0.42, 0.5, 1.2, M.white, cx, 0.6, cz - 1.1, 18); ball(g, 0.42, M.sky, cx, 1.55, cz - 1.1, 18);
    for (const s of [-1, 1]) ball(g, 0.08, M.dark, cx + s * 0.15, 1.62, cz - 0.72, 8);
    stick(g, 0.03, M.metal, V(cx, 1.9, cz - 1.1), V(cx, 2.3, cz - 1.1)); ball(g, 0.1, M.hot, cx, 2.35, cz - 1.1, 10);
    g.userData.sol = [[cx, cz, 2.9, 0.62, -2, 3]]; return bake(g);
  },
  balloon(P) {
    const g = new THREE.Group(), t = stripes('#ff6fa8', '#ffffff', 8, false);
    const env = ball(g, 3, std(0xffffff, { map: t, roughness: 0.5 }), 0, 0, 0, 24); env.scale.y = 1.2;
    part(g, new THREE.ConeGeometry(1.4, 1.4, 20), M.hot, 0, -3.8, 0, Math.PI);
    rbox(g, 1.6, 1.0, 1.6, M.wood, 0, -5.6, 0, 0.1);
    for (const [x, z] of [[-0.7, -0.7], [0.7, -0.7], [-0.7, 0.7], [0.7, 0.7]]) stick(g, 0.03, M.choco, V(x, -5.1, z), V(x * 1.6, -3.2, z * 1.6));
    const ban = canvasPlane(5, 1.1, 512, 112, (c, W, H) => { c.fillStyle = '#ffd34d'; c.fillRect(0, 0, W, H); emojiText(c, 'ICE CREAM! 🍦', W / 2, H / 2 + 4, 64, '#e8304c'); });
    ban.position.set(0, -7, 0); g.add(ban); stick(g, 0.02, M.dark, V(-2.4, -6.5, 0), V(0, -6.1, 0)); stick(g, 0.02, M.dark, V(2.4, -6.5, 0), V(0, -6.1, 0));
    bake(g); g.position.set(-4, 16, 6); g.userData.bob = 16; return g;
  },
  stairs(P) {
    const g = new THREE.Group();
    for (let k = 0; k < 12; k++) { const top = (k + 1) * 5.5 / 12, z1 = 6 - k * 6.8 / 12, z0 = z1 - 6.8 / 12; box(g, 2.4, top, z1 - z0, k % 2 ? M.white : M.pink, 13.4, top / 2, (z0 + z1) / 2); }
    for (let k = 0; k <= 4; k++) { const z = 6 - k * 1.7, y = (6 - z) / 6.8 * 5.5; cyl(g, 0.05, 0.05, 1.1, M.metal, 12.25, y + 0.55, z, 8); }
    stick(g, 0.06, M.hot, V(12.25, 1.1, 6), V(12.25, 6.6, -0.8));
    g.userData.sol = [[13.4, 1.1, 1.2, 1.9, -2, 1.5]]; return bake(g);
  },
  floor2(P) {
    const g = new THREE.Group();
    rbox(g, 30.4, 0.3, 14.4, M.wood, 0, 5.35, -7.9, 0.05); box(g, 30.5, 0.2, 14.5, M.pink, 0, 5.12, -7.9);
    for (const x of [-14.7, -5, 5, 11.6]) cyl(g, 0.28, 0.28, 5.1, M.candy, x, 2.55, -1.15, 12);
    for (let x = -10; x <= 10; x += 5) for (const z of [-4, -11]) box(g, 2.2, 0.05, 0.5, M.gW, x, 5.0, z);
    box(g, 24.8, 1.0, 0.06, M.glass, -0.2, 6.0, -0.8); box(g, 24.8, 0.1, 0.12, M.hot, -0.2, 6.52, -0.8);
    for (const [w, d, x, z] of [[0.06, 14.2, -15, -7.9], [0.06, 14.2, 15, -7.9], [30, 0.06, 0, -15]]) { box(g, w, 1.0, d, M.glass, x, 6.0, z); box(g, w + 0.06, 0.1, d + 0.06, M.hot, x, 6.52, z); }
    g.userData.sol = [[-0.2, -0.8, 12.4, 0.1, 4.9, 8], [-15, -7.9, 0.1, 7.2, 4.9, 8], [15, -7.9, 0.1, 7.2, 4.9, 8], [0, -15, 15, 0.1, 4.9, 8], [-14.7, -1.15, 0.3, 0.3, -2, 5], [-5, -1.15, 0.3, 0.3, -2, 5], [5, -1.15, 0.3, 0.3, -2, 5], [11.6, -1.15, 0.3, 0.3, -2, 5]];
    return bake(g);
  },
  freezer(P) {
    const g = new THREE.Group(), y = 5.5;
    rbox(g, 4, 2.2, 2.2, M.sky, -7, y + 1.1, -10, 0.2); rbox(g, 3.6, 0.1, 1.8, M.gB, -7, y + 2.22, -10, 0.04);
    for (let i = 0; i < 9; i++) ball(g, 0.25 + Math.random() * 0.2, M.white, -8.8 + Math.random() * 3.6, y + 2.3, -10.8 + Math.random() * 1.6, 10);
    const sign = canvasPlane(3.4, 0.7, 512, 104, (c, W, H) => { c.fillStyle = '#1f6fd8'; c.fillRect(0, 0, W, H); emojiText(c, '❄️ MEGA FREEZER', W / 2, H / 2 + 4, 56); }); sign.position.set(-7, y + 1.3, -8.88); g.add(sign);
    const fan = new THREE.Group(); fan.userData.keep = true; fan.userData.spin = 6; fan.position.set(-4.95, y + 1.2, -10);
    for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.3), M.metal); b.rotation.x = k * Math.PI / 4 * 2; fan.add(b); } g.add(fan);
    g.userData.sol = [[-7, -10, 2.1, 1.2, 4.9, 9]]; return bake(g);
  },
  tables(P) {
    const g = new THREE.Group(), y = 5.5, at = [[-1.5, -9], [2.5, -12.5], [5, -6.5]];
    at.forEach(([x, z], i) => {
      cyl(g, 0.85, 0.85, 0.08, M.white, x, y + 0.8, z, 20); cyl(g, 0.07, 0.1, 0.8, M.metal, x, y + 0.4, z, 8); cyl(g, 0.05, 0.05, 2.4, M.metal, x, y + 1.6, z, 8);
      part(g, new THREE.ConeGeometry(1.7, 0.7, 16, 1, true), M.awning, x, y + 2.75, z);
      for (let k = 0; k < 3; k++) { const a = k * TAU / 3 + i, cx = x + Math.cos(a) * 1.25, cz = z + Math.sin(a) * 1.25; rbox(g, 0.5, 0.08, 0.5, [M.pink, M.mint, M.yellow][k], cx, y + 0.48, cz, 0.03); cyl(g, 0.04, 0.04, 0.45, M.metal, cx, y + 0.23, cz, 6); }
      ball(g, 0.2, FM[i + 2], x, y + 0.95, z, 10);
    });
    g.userData.sol = at.map(([x, z]) => [x, z, 0.9, 4.9, 9]); return bake(g);
  },
  slide(P) {
    const g = new THREE.Group(), curve = new THREE.CatmullRomCurve3(SLIDE_PTS.map(p => V(...p)));
    part(g, halfPipe(curve, 0.75, 60), std(0xffd34d, { roughness: 0.3, side: THREE.DoubleSide }), 0, 0, 0);
    for (let k = 2; k < 9; k++) { const p = curve.getPointAt(k / 9); if (p.y > 0.6) cyl(g, 0.07, 0.07, p.y - 0.6, M.metal, p.x, (p.y - 0.6) / 2, p.z, 8); }
    for (const s of [-1, 1]) cyl(g, 0.07, 0.07, 1.4, M.hot, -13.5 + s * 0.8, 6.2, -2.3, 8);
    box(g, 1.8, 0.35, 0.12, M.hot, -13.5, 6.9, -2.3);
    return bake(g);
  },
  topper(P) {
    const g = new THREE.Group(), y = 5.5;
    cyl(g, 1.5, 1.7, 0.6, M.white, -12, y + 0.3, -12.5, 24); icecream(g, -12, y + 0.6, -12.5, 1.5, [3, 0, 2]);
    g.userData.sol = [[-12, -12.5, 1.6, 4.9, 14]]; return bake(g);
  },
  fireworks(P) {
    const g = new THREE.Group(), y = 5.5, x = 11, z = -12;
    rbox(g, 1.8, 0.6, 1.8, M.red, x, y + 0.3, z, 0.1);
    [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]].forEach(([dx, dz], k) => { const t = part(g, new THREE.CylinderGeometry(0.2, 0.2, 1.5, 12), [M.blue, M.yellow, M.mint, M.purple][k], x + dx, y + 1.25, z + dz); t.rotation.set(dz * 0.35, 0, -dx * 0.35); });
    g.userData.sol = [[x, z, 1.1, 4.9, 9]]; return bake(g);
  },
  fountain(P) {
    const g = new THREE.Group(), x = -9.5, z = 10.5;
    cyl(g, 2.0, 2.1, 0.6, M.white, x, 0.3, z, 28); part(g, new THREE.TorusGeometry(2.0, 0.16, 8, 32), M.pink, x, 0.62, z, Math.PI / 2);
    cyl(g, 1.85, 1.85, 0.06, M.water, x, 0.56, z, 28); cyl(g, 0.3, 0.4, 1.4, M.cream, x, 1.0, z, 12); icecream(g, x, 1.5, z, 0.35, [0, 3]);
    const jet = new THREE.Mesh(new THREE.ConeGeometry(0.9, 1.6, 16, 1, true), M.water); jet.position.set(x, 3.2, z); jet.rotation.x = Math.PI; jet.userData.keep = true; jet.userData.pulse = true; g.add(jet);
    g.userData.sol = [[x, z, 2.1]]; return bake(g);
  },
  statue(P) {
    const g = new THREE.Group(), x = 3.5, z = 11.5, G = M.gold;
    rbox(g, 2.2, 1.0, 2.2, M.white, x, 0.5, z, 0.1);
    for (const s of [-1, 1]) rbox(g, 0.38, 0.9, 0.38, G, x + s * 0.22, 1.45, z, 0.05);
    rbox(g, 0.95, 0.95, 0.5, G, x, 2.35, z, 0.06); cyl(g, 0.3, 0.3, 0.6, G, x, 3.15, z, 16); ball(g, 0.3, G, x, 3.45, z, 14);
    rbox(g, 0.32, 0.85, 0.32, G, x - 0.62, 2.35, z, 0.05);
    const arm = rbox(g, 0.32, 0.85, 0.32, G, x + 0.66, 3.0, z, 0.05); arm.rotation.z = 0.5;
    cyl(g, 0.22, 0.03, 0.55, M.waffle, x + 0.95, 3.6, z, 10); ball(g, 0.25, FM[0], x + 0.95, 3.95, z, 12);
    g.userData.sol = [[x, z, 1.2]]; return bake(g);
  },
};
// droppers, upgraders, the second belt and the turbo strips
for (const id of ['drop1', 'drop2', 'drop3', 'drop4', 'drop5', 'drop6', 'golden']) BUILD[id] = P => { const g = new THREE.Group(), [b, x] = DROPS[id]; dropper(g, x, BELTS[b], FM[(+id.slice(4) || 1) - 1], id === 'golden'); const noz = g.userData.noz; bake(g); g.userData.noz = noz; return g; };
['cone', 'sundae', 'sprinkles'].forEach((id, k) => { BUILD[id] = P => { const g = new THREE.Group(); g.userData.sol = arch(g, ARCH[k], k); return bake(g); }; });
BUILD.belt2 = P => { const g = new THREE.Group(); g.userData.sol = [belt(g, BELTS[1], P)]; return bake(g); };
BUILD.fast1 = P => { const g = new THREE.Group(); for (const z of BELTS) for (const s of [-1, 1]) box(g, BL, 0.07, 0.07, M.gB, BC, 1.21, z + s * 0.84); for (const z of BELTS) rbox(g, 0.8, 0.8, 1.6, M.blue, BX1 + 0.6, 0.9, z, 0.1); return bake(g); };
BUILD.fast2 = P => { const g = new THREE.Group(); for (const z of BELTS) for (const s of [-1, 1]) box(g, BL, 0.07, 0.07, M.gP, BC, 0.62, z + s * 0.68); for (const z of BELTS) { rbox(g, 0.5, 0.5, 1.2, M.purple, BX1 + 0.6, 1.55, z, 0.08); cyl(g, 0.12, 0.12, 0.8, M.metal, BX1 + 0.6, 2.1, z, 8); } return bake(g); };

// an open half tube along a curve (slides)
export function halfPipe(curve, r, n) {
  const pos = [], idx = [], uv = [], m = 12, up = V(0, 1, 0);
  for (let i = 0; i <= n; i++) {
    const p = curve.getPointAt(i / n), t = curve.getTangentAt(i / n), s = new THREE.Vector3().crossVectors(t, up).normalize(), d = new THREE.Vector3().crossVectors(s, t).normalize().negate();
    for (let j = 0; j <= m; j++) { const a = j / m * Math.PI, v = p.clone().addScaledVector(s, Math.cos(a) * r).addScaledVector(d, Math.sin(a) * r * 0.8).addScaledVector(d, -r * 0.8 + 0.05); pos.push(v.x, v.y, v.z); uv.push(j / m, i / n); }
    if (i < n) for (let j = 0; j < m; j++) { const a = i * (m + 1) + j, b = a + m + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// ---------- the plaza ----------
export function plaza(w) {
  const S = w.scene; let g = new THREE.Group();
  const grass = new THREE.Mesh(new THREE.CircleGeometry(320, 64).rotateX(-Math.PI / 2), surface('grass', [100, 100])); grass.position.y = -0.05; grass.receiveShadow = true; S.add(grass);
  const tiles = canvasTexture(1024, 1024, (c, W) => {
    const C = W / 2; c.fillStyle = '#fff4ea'; c.fillRect(0, 0, W, W);
    for (let r = 14; r > 0; r--) { c.fillStyle = r % 2 ? '#ffe0ec' : '#fff7ef'; c.beginPath(); c.arc(C, C, r * C / 14, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(220,170,190,0.55)'; c.lineWidth = 2; for (let k = 0; k < 48; k++) { const a = k / 48 * TAU; c.beginPath(); c.moveTo(C + Math.cos(a) * 70, C + Math.sin(a) * 70); c.lineTo(C + Math.cos(a) * C, C + Math.sin(a) * C); c.stroke(); }
    for (let r = 1; r <= 14; r++) { c.beginPath(); c.arc(C, C, r * C / 14, 0, TAU); c.stroke(); }
    for (let i = 0; i < 260; i++) { const a = Math.random() * TAU, d = 80 + Math.random() * (C - 90); c.fillStyle = ['#ff6fa8', '#6fd6ff', '#ffd34d', '#8fe3c8', '#b38bff'][i % 5]; c.save(); c.translate(C + Math.cos(a) * d, C + Math.sin(a) * d); c.rotate(Math.random() * 6); c.fillRect(-7, -2.5, 14, 5); c.restore(); }
  });
  const pz = new THREE.Mesh(new THREE.CircleGeometry(35, 72).rotateX(-Math.PI / 2), std(0xd8cdc8, { map: tiles, roughness: 0.6 })); pz.position.y = 0.01; pz.receiveShadow = true; S.add(pz);
  const rim = new THREE.Mesh(new THREE.RingGeometry(34.6, 35.6, 96).rotateX(-Math.PI / 2), M.hot); rim.position.y = 0.025; S.add(rim);
  // ---------- the giant ice cream statue and its fountain ----------
  cyl(g, 7.8, 8.0, 0.9, M.white, 0, 0.45, 0, 48); part(g, new THREE.TorusGeometry(7.8, 0.3, 10, 64), M.pink, 0, 0.92, 0, Math.PI / 2);
  cyl(g, 7.4, 7.4, 0.1, M.water, 0, 0.78, 0, 48); cyl(g, 3.6, 4.2, 1.6, M.mint, 0, 0.8, 0, 32); cyl(g, 3.7, 3.7, 0.25, M.white, 0, 1.65, 0, 32);
  bake(g); S.add(g);
  const ic = new THREE.Group(); g = ic; // the ice cream itself (it can come alive)
  cyl(g, 3.3, 0.25, 8.5, M.waffle, 0, 1.6 + 4.25, 0, 32); part(g, new THREE.TorusGeometry(3.3, 0.45, 12, 40), M.waffle, 0, 10.1, 0, Math.PI / 2);
  [[0, 3.4, 11.6], [3, 3.0, 15.4], [2, 2.6, 18.7]].forEach(([f, r, y]) => { ball(g, r, FM[f], 0, y, 0, 32).scale.y = 0.9; part(g, new THREE.TorusGeometry(r * 0.9, r * 0.24, 10, 32), FM[f], 0, y - r * 0.42, 0, Math.PI / 2); for (let k = 0; k < 7; k++) { const a = k / 7 * TAU + f, d = ball(g, r * 0.2, FM[f], Math.cos(a) * r * 0.92, y - r * 0.55 - (k % 3) * 0.25, Math.sin(a) * r * 0.92, 10); d.scale.y = 1.6; } });
  part(g, new THREE.ConeGeometry(1.5, 2.2, 16), M.white, 0, 22.0, 0); ball(g, 0.95, M.red, 0, 23.6, 0, 20); stick(g, 0.1, M.choco, V(0, 24.4, 0), V(0.5, 25.6, 0));
  bake(g); S.add(g);
  // sprinkles all over the scoops
  const spr = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.07, 0.35, 2, 6), std(0xffffff, { roughness: 0.4 }), 260), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), col = new THREE.Color();
  for (let i = 0; i < 260; i++) { const k = i % 3, r = [3.4, 3.0, 2.6][k] * 0.98, y = [11.6, 15.4, 18.7][k], a = Math.random() * TAU, e = Math.random() * 1.1 + 0.15, n = V(Math.cos(a) * Math.cos(e), Math.sin(e) * 0.9, Math.sin(a) * Math.cos(e)); q.setFromEuler(new THREE.Euler(Math.random() * 3, Math.random() * 3, Math.random() * 3)); m4.compose(V(n.x * r, y + n.y * r, n.z * r), q, V(1, 1, 1)); spr.setMatrixAt(i, m4); spr.setColorAt(i, col.set(['#ff3d7f', '#3da5ff', '#ffd34d', '#4fdc8a', '#b36bff', '#ffffff'][i % 6])); }
  ic.add(spr); w.solids.push({ x: 0, z: 0, r: 7.9 });
  // water jets arcing from the fountain rim into the cone
  const N = 240, jg = new THREE.BufferGeometry(), jp = new Float32Array(N * 3), js = Array.from({ length: N }, (_, i) => ({ a: (i % 12) / 12 * TAU, t: Math.random() }));
  jg.setAttribute('position', new THREE.BufferAttribute(jp, 3)); const dot = canvasTexture(32, 32, (c, W) => { const gr = c.createRadialGradient(W / 2, W / 2, 0, W / 2, W / 2, W / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, W, W); });
  const jets = new THREE.Points(jg, new THREE.PointsMaterial({ color: 0xc8f2ff, map: DOT, size: 0.3, transparent: true, opacity: 0.85, depthWrite: false })); jets.frustumCulled = false; S.add(jets);
  w.updaters.push(dt => { for (let i = 0; i < N; i++) { const s = js[i]; s.t = (s.t + dt * 0.6) % 1; const r = 7.2 - s.t * 3.4; jp[i * 3] = Math.cos(s.a) * r; jp[i * 3 + 1] = 0.9 + Math.sin(s.t * Math.PI) * 4.2; jp[i * 3 + 2] = Math.sin(s.a) * r; } jg.attributes.position.needsUpdate = true; });
  // gumdrop trees all round, and candy lamps on the plaza rim
  const T = 90, trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.25, 0.4, 3.2, 8), std(0x8a5a3b, { roughness: 0.9 }), T), puffs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), std(0xffffff, { roughness: 0.55 }), T * 3);
  let ti = 0;
  for (let i = 0; i < T; i++) {
    const near = i < 30, a = near ? (Math.floor(i / 5) * 60 + 30 + (Math.random() - 0.5) * 16) * Math.PI / 180 : Math.random() * TAU, r = near ? 42 + (i % 5) * 7 + Math.random() * 3 : 78 + Math.random() * 110, x = Math.sin(a) * r, z = Math.cos(a) * r, s = 0.8 + Math.random() * 0.6;
    m4.compose(V(x, 1.6 * s, z), q.identity(), V(s, s, s)); trunks.setMatrixAt(i, m4);
    const hue = ['#ff8fb8', '#8fe3c8', '#ffd34d', '#b8a4ff', '#ffb36b', '#7fd0ff'][i % 6];
    for (let k = 0; k < 3; k++) { const ps = s * (1.8 - k * 0.45); m4.compose(V(x + (k - 1) * 0.5 * s, (3.6 + k * 1.3) * s, z + ((k * 7) % 3 - 1) * 0.3 * s), q, V(ps, ps * 0.85, ps)); puffs.setMatrixAt(ti, m4); puffs.setColorAt(ti++, col.set(hue).offsetHSL(0, 0, (k - 1) * 0.05)); }
    if (near) w.solids.push({ x, z, r: 0.5 * s });
  }
  for (const im of [trunks, puffs]) { im.castShadow = true; im.receiveShadow = true; S.add(im); }
  const L = [], lamps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.16, 3.6, 8), M.candy, 24), globes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 14, 10), M.gY, 24);
  for (let k = 0; k < 36; k++) { const deg = k * 10; if (Math.min(deg % 60, 60 - deg % 60) < 12 || L.length >= 24) continue; const a = deg * Math.PI / 180; L.push([Math.sin(a) * 33.6, Math.cos(a) * 33.6]); }
  L.forEach(([x, z], i) => { m4.compose(V(x, 1.8, z), q.identity(), V(1, 1, 1)); lamps.setMatrixAt(i, m4); m4.compose(V(x, 3.9, z), q, V(1, 1, 1)); globes.setMatrixAt(i, m4); w.solids.push({ x, z, r: 0.2 }); });
  lamps.count = globes.count = L.length; lamps.castShadow = true; S.add(lamps, globes);
  return ic;
}

// the plaza slide: a tower with stairs and a twisting yellow slide (local frame like a plot)
export const PSLIDE = [[-1.2, 6.1, 0], [-2.6, 5.5, 1.6], [-5, 4.4, 2.4], [-7.4, 3.0, 1.0], [-8.0, 1.7, -1.8], [-6.4, 0.7, -4.2], [-3.8, 0.25, -5.2], [-2.2, 0.22, -5.2]];
export function plazaSlide() {
  const g = new THREE.Group();
  for (const [x, z] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) cyl(g, 0.14, 0.14, 6, M.candy, x, 3, z, 10);
  rbox(g, 2.8, 0.3, 2.8, M.pink, 0, 5.85, 0, 0.08);
  for (const s of [-1, 1]) { box(g, 2.8, 0.9, 0.08, M.glass, 0, 6.45, s * 1.4); box(g, 2.86, 0.1, 0.14, M.hot, 0, 6.95, s * 1.4); }
  for (let k = 0; k < 13; k++) { const top = (k + 1) * 6 / 13, x1 = 8.6 - k * 7.3 / 13, x0 = x1 - 7.3 / 13; box(g, x1 - x0, 0.25, 1.8, k % 2 ? M.white : M.mint, (x0 + x1) / 2, top - 0.125, 0); if (k % 3 === 0) cyl(g, 0.08, 0.08, top - 0.25, M.metal, (x0 + x1) / 2, (top - 0.25) / 2, 0.8, 6); }
  const curve = new THREE.CatmullRomCurve3(PSLIDE.map(p => V(...p)));
  part(g, halfPipe(curve, 0.8, 70), std(0xffd34d, { roughness: 0.3, side: THREE.DoubleSide }), 0, 0, 0);
  for (let k = 2; k < 10; k++) { const p = curve.getPointAt(k / 11); if (p.y > 0.6) cyl(g, 0.08, 0.08, p.y - 0.6, M.metal, p.x, (p.y - 0.6) / 2, p.z, 6); }
  return bake(g);
}
