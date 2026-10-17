// ⛏️ Marbly Craft world: the blocks, a pixel-art texture atlas painted on a canvas, the seeded island generator
// (every player builds the same island from the same seed), instanced rendering (one draw call for all solid blocks)
// and voxel ray casting for mining, placing and the camera.
import * as THREE from 'three';

export const N = 64, H = 40, Y0 = -5, OFF = 32, TOTAL = N * N * H;
export const idx = (i, k, j) => (k * N + j) * N + i;
export const ci = c => c % N, cj = c => ((c / N) | 0) % N, ck = c => (c / (N * N)) | 0;
export const inb = (i, k, j) => i >= 0 && i < N && j >= 0 && j < N && k >= 0 && k < H;
export const cellOf = (x, y, z) => { const i = Math.floor(x + OFF), k = Math.floor(y - Y0), j = Math.floor(z + OFF); return inb(i, k, j) ? idx(i, k, j) : -1; };
export const center = c => [ci(c) - OFF + 0.5, ck(c) + Y0 + 0.5, cj(c) - OFF + 0.5];

// ---------- the texture atlas (16×16 pixel tiles, 16 per row) ----------
const TILES = ['grass_top', 'grass_side', 'dirt', 'stone', 'sand', 'log_side', 'log_top', 'leaves', 'planks', 'coal_ore', 'iron_ore', 'gold_ore', 'diamond_ore', 'bedrock', 'glass', 'bricks',
  'furnace_front', 'furnace_top', 'table_top', 'table_side', 'torch', 'torch_top', 'lamp', 'tnt_side', 'tnt_top', 'tnt_bottom', 'tramp_top', 'tramp_side', 'gold_block', 'snow', 'snow_side', 'ice',
  'pumpkin_side', 'pumpkin_top', 'jack', 'ladder', 'lava', 'water', 'diamond_block', 'stick', 'coal', 'iron', 'gold', 'diamond', 'pick_wood', 'pick_stone', 'pick_iron', 'pick_diamond'];
export const T = {}; TILES.forEach((n, i) => (T[n] = i));

function rng(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const px = (d, x, y, c, a = 255) => { if (x < 0 || y < 0 || x > 15 || y > 15) return; const o = (y * 16 + x) * 4; d[o] = c[0]; d[o + 1] = c[1]; d[o + 2] = c[2]; d[o + 3] = a; };
const sh = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const fill = (d, R, c, v) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(d, x, y, sh(c, 1 + (R() - 0.5) * v)); };
const specks = (d, R, n, c) => { for (let i = 0; i < n; i++) px(d, R() * 16 | 0, R() * 16 | 0, c); };
const STONE = [128, 128, 128], DIRT = [134, 96, 67], GRASS = [92, 158, 52], PLANK = [168, 134, 82];
const stone = (d, R) => { fill(d, R, STONE, 0.18); for (let i = 0; i < 9; i++) { const x = R() * 15 | 0, y = R() * 16 | 0; px(d, x, y, [100, 100, 100]); px(d, x + 1, y, [104, 104, 104]); } };
const dirt = (d, R) => { fill(d, R, DIRT, 0.32); specks(d, R, 16, [104, 74, 52]); specks(d, R, 7, [162, 122, 88]); };
const planks = (d, R) => { for (let y = 0; y < 16; y++) { const p = y >> 2, s = [1, 0.92, 1.05, 0.96][p]; for (let x = 0; x < 16; x++) px(d, x, y, y % 4 === 3 || x === (p * 7 + 3) % 16 ? [112, 86, 52] : sh(PLANK, s * (1 + (R() - 0.5) * 0.12))); } };
const ore = (c1, c2) => (d, R) => { stone(d, R); for (let i = 0; i < 4; i++) { const x = 1 + R() * 12 | 0, y = 1 + R() * 12 | 0; px(d, x, y, c1); px(d, x + 1, y, c1); px(d, x, y + 1, c1); px(d, x + 1, y + 1, sh(c1, 0.75)); px(d, x, y, c2); } };
const ingot = (c, hi, lo) => d => { for (let y = 6; y <= 10; y++) for (let x = 2 + (y - 6); x <= 12 + (y - 6); x++) px(d, x, y, y === 6 ? hi : y === 10 || x === 12 + (y - 6) ? lo : c); };
const pick = c => d => {
  for (let t = 0; t < 9; t++) { px(d, 3 + t, 13 - t, [120, 88, 50]); px(d, 4 + t, 13 - t, [86, 62, 34]); }
  [[4, 2], [5, 2], [6, 2], [7, 2], [8, 2], [9, 3], [10, 3], [11, 4], [12, 5], [12, 6], [13, 7], [13, 8], [13, 9], [13, 10]].forEach(([x, y], i) => { px(d, x, y, i % 3 ? c : sh(c, 1.25)); px(d, x, y + 1, sh(c, 0.7)); });
};
const PAINT = {
  grass_top: (d, R) => { fill(d, R, GRASS, 0.3); specks(d, R, 20, [68, 122, 38]); specks(d, R, 8, [120, 186, 70]); },
  dirt,
  grass_side: (d, R) => { dirt(d, R); for (let x = 0; x < 16; x++) { const l = 3 + (R() * 3 | 0); for (let y = 0; y < l; y++) px(d, x, y, sh(GRASS, 0.85 + R() * 0.3)); } },
  stone,
  sand: (d, R) => { fill(d, R, [222, 210, 160], 0.12); specks(d, R, 12, [198, 184, 134]); },
  log_side: (d, R) => { for (let x = 0; x < 16; x++) { const k = 0.82 + R() * 0.3; for (let y = 0; y < 16; y++) px(d, x, y, x % 5 === 0 ? [70, 52, 32] : sh([105, 80, 50], k * (1 + (R() - 0.5) * 0.18))); } },
  log_top: (d, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)); px(d, x, y, sh(r > 6.5 ? [105, 80, 50] : Math.floor(r) % 2 ? [184, 148, 92] : [158, 124, 76], 1 + (R() - 0.5) * 0.1)); } },
  leaves: (d, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (R() < 0.18) px(d, x, y, [40, 90, 30], 0); else px(d, x, y, sh([58, 128, 40], 0.6 + R() * 0.65)); } },
  planks,
  coal_ore: ore([34, 34, 34], [80, 80, 80]), iron_ore: ore([214, 172, 140], [245, 215, 185]), gold_ore: ore([250, 212, 50], [255, 246, 160]), diamond_ore: ore([80, 228, 218], [210, 255, 252]),
  bedrock: (d, R) => { fill(d, R, [68, 68, 70], 0.75); },
  glass: (d, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const edge = !x || !y || x === 15 || y === 15; px(d, x, y, edge ? [205, 232, 242] : [200, 230, 240], edge ? 255 : 0); } for (let t = 0; t < 4; t++) { px(d, 3 + t, 7 - t, [245, 252, 255]); px(d, 9 + t, 12 - t, [245, 252, 255]); px(d, 10 + t, 12 - t, [235, 248, 252]); } },
  bricks: (d, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const row = y >> 2, xx = (x + (row % 2 ? 4 : 0)) % 8, yy = y % 4; px(d, x, y, yy === 3 || xx === 7 ? [92, 92, 94] : yy === 0 || xx === 0 ? [168, 168, 170] : sh([138, 138, 140], 1 + (R() - 0.5) * 0.12)); } },
  furnace_top: (d, R) => { fill(d, R, [118, 118, 120], 0.14); for (let i = 0; i < 16; i++) { px(d, i, 0, [86, 86, 88]); px(d, i, 15, [86, 86, 88]); px(d, 0, i, [86, 86, 88]); px(d, 15, i, [86, 86, 88]); } },
  furnace_front: (d, R, e) => {
    PAINT.furnace_top(d, R); for (let x = 3; x < 13; x++) { px(d, x, 3, [70, 70, 72]); px(d, x, 5, [70, 70, 72]); }
    for (let y = 8; y < 14; y++) for (let x = 4; x < 12; x++) { const fire = y > 10 && R() < 0.8, c = fire ? (R() < 0.5 ? [255, 140, 30] : [255, 214, 80]) : [28, 26, 26]; px(d, x, y, c); if (fire) px(e, x, y, c); }
  },
  table_top: (d, R) => { planks(d, R); for (let i = 0; i < 16; i++) { px(d, i, 0, [96, 66, 38]); px(d, i, 15, [96, 66, 38]); px(d, 0, i, [96, 66, 38]); px(d, 15, i, [96, 66, 38]); px(d, 5, i, [124, 94, 58]); px(d, 10, i, [124, 94, 58]); px(d, i, 5, [124, 94, 58]); px(d, i, 10, [124, 94, 58]); } },
  table_side: (d, R) => { planks(d, R); for (let x = 2; x < 8; x++) { px(d, x, 4, [190, 190, 196]); px(d, x, 5, [150, 150, 156]); } for (let y = 3; y < 7; y++) px(d, 1, y, [96, 66, 38]); for (let y = 3; y < 13; y++) px(d, 11, y, [96, 66, 38]); for (let x = 9; x < 14; x++) { px(d, x, 3, [110, 110, 116]); px(d, x, 4, [90, 90, 96]); } },
  torch: (d, R, e) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { if (y < 5) { const c = y < 2 ? [255, 240, 150] : [255, 168, 40]; px(d, x, y, c); px(e, x, y, c); } else px(d, x, y, x < 3 || x > 12 ? [86, 62, 34] : sh([128, 94, 54], 1 + (R() - 0.5) * 0.15)); } },
  torch_top: (d, R, e) => { fill(d, R, [255, 216, 100], 0.15); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(e, x, y, [255, 220, 120]); },
  lamp: (d, R, e) => { fill(d, R, [214, 172, 82], 0.25); specks(d, R, 22, [255, 236, 150]); for (let i = 0; i < 16; i++) { px(d, i, 0, [140, 100, 40]); px(d, i, 15, [140, 100, 40]); px(d, 0, i, [140, 100, 40]); px(d, 15, i, [140, 100, 40]); } for (let i = 0; i < 1024; i += 4) { e[i] = d[i]; e[i + 1] = d[i + 1]; e[i + 2] = d[i + 2]; } },
  tnt_side: (d, R) => {
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(d, x, y, y >= 5 && y <= 10 ? [236, 236, 230] : x % 4 < 2 ? [204, 42, 30] : [172, 30, 24]);
    const G = { T: ['xxx', '.x.', '.x.', '.x.'], N: ['x..x', 'xx.x', 'x.xx', 'x..x'] };
    [['T', 1], ['N', 5], ['T', 11]].forEach(([ch, x0]) => G[ch].forEach((row, r) => [...row].forEach((c, k) => c === 'x' && px(d, x0 + k, 6 + r, [30, 30, 30]))));
  },
  tnt_top: (d, R) => { fill(d, R, [190, 40, 30], 0.12); for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(d, x, y, [150, 150, 150]); px(d, 7, 7, [30, 30, 30]); px(d, 8, 8, [30, 30, 30]); },
  tnt_bottom: (d, R) => fill(d, R, [168, 34, 28], 0.12),
  tramp_top: (d, R) => { fill(d, R, [110, 215, 90], 0.12); for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const r = Math.hypot(x - 7.5, y - 7.5); if (!x || !y || x === 15 || y === 15) px(d, x, y, [56, 136, 48]); else if (r > 3.5 && r < 5) px(d, x, y, [190, 255, 170]); } },
  tramp_side: (d, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(d, x, y, y < 4 ? sh([110, 215, 90], 1 + (R() - 0.5) * 0.1) : (x + y) % 6 === 0 || (x - y + 32) % 6 === 0 ? [250, 200, 40] : [60, 60, 70]); },
  gold_block: (d, R) => { fill(d, R, [248, 208, 60], 0.08); for (let i = 0; i < 16; i++) { px(d, i, 15, [200, 150, 30]); px(d, 15, i, [200, 150, 30]); px(d, i, 0, [255, 240, 150]); px(d, 0, i, [255, 240, 150]); } for (let t = 0; t < 4; t++) px(d, 3 + t, 6 - t, [255, 250, 200]); },
  snow: (d, R) => { fill(d, R, [244, 248, 255], 0.05); specks(d, R, 10, [218, 228, 244]); },
  snow_side: (d, R) => { dirt(d, R); for (let x = 0; x < 16; x++) { const l = 3 + (R() * 2 | 0); for (let y = 0; y < l; y++) px(d, x, y, sh([244, 248, 255], 1 - R() * 0.06)); } },
  ice: (d, R) => { fill(d, R, [158, 198, 245], 0.08); for (let k = 0; k < 3; k++) { let x = R() * 16 | 0, y = R() * 16 | 0; for (let s = 0; s < 7; s++) { px(d, x, y, [236, 246, 255]); x += R() < 0.5 ? 1 : 0; y += R() < 0.5 ? 1 : -1; } } },
  pumpkin_side: (d, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) px(d, x, y, x % 4 === 0 ? [188, 98, 18] : sh([232, 140, 30], 1 + (R() - 0.5) * 0.1)); },
  pumpkin_top: (d, R) => { PAINT.pumpkin_side(d, R); for (let y = 6; y < 10; y++) for (let x = 6; x < 10; x++) px(d, x, y, [96, 120, 40]); px(d, 7, 7, [70, 90, 30]); },
  jack: (d, R, e) => {
    PAINT.pumpkin_side(d, R); const F = [255, 214, 70], f = (x, y) => { px(d, x, y, F); px(e, x, y, F); };
    for (const x0 of [3, 10]) { f(x0 + 1, 4); f(x0, 5); f(x0 + 1, 5); f(x0 + 2, 5); }
    for (let x = 3; x < 13; x++) { f(x, 10); if (x % 3) f(x, 11); } f(3, 9); f(12, 9);
  },
  ladder: d => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const rail = x === 2 || x === 3 || x === 12 || x === 13, rung = y % 4 === 1 && x > 1 && x < 14; px(d, x, y, rail ? [124, 90, 52] : [150, 112, 66], rail || rung ? 255 : 0); } },
  lava: (d, R, e) => { fill(d, R, [236, 100, 20], 0.22); specks(d, R, 22, [255, 206, 70]); specks(d, R, 12, [176, 46, 12]); for (let i = 0; i < 1024; i += 4) { e[i] = d[i]; e[i + 1] = d[i + 1]; e[i + 2] = d[i + 2]; } },
  water: (d, R) => { fill(d, R, [48, 108, 214], 0.1); for (let i = 0; i < 6; i++) { const x = R() * 12 | 0, y = R() * 16 | 0; for (let t = 0; t < 4; t++) px(d, x + t, y, [110, 160, 240]); } },
  diamond_block: (d, R) => { fill(d, R, [104, 226, 216], 0.06); for (let i = 0; i < 16; i++) { px(d, i, 15, [48, 160, 150]); px(d, 15, i, [48, 160, 150]); px(d, i, 0, [214, 255, 252]); px(d, 0, i, [214, 255, 252]); } for (let t = 0; t < 5; t++) px(d, 3 + t, 8 - t, [230, 255, 255]); },
  stick: d => { for (let t = 0; t < 11; t++) { px(d, 3 + t, 13 - t, [138, 100, 58]); px(d, 4 + t, 13 - t, [96, 70, 40]); } },
  coal: (d, R) => { for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (((x - 8) / 5.5) ** 2 + ((y - 8.5) / 4.5) ** 2 < 1) px(d, x, y, x + y < 13 ? [92, 92, 96] : sh([40, 40, 44], 0.8 + R() * 0.4)); },
  iron: ingot([216, 216, 222], [250, 250, 255], [150, 150, 160]),
  gold: ingot([250, 206, 60], [255, 245, 170], [196, 140, 30]),
  diamond: d => { [[6, 9], [4, 11], [3, 12], [4, 11], [5, 10], [6, 9], [7, 8]].forEach(([a, b], r) => { for (let x = a; x <= b; x++) px(d, x, 4 + r, r === 0 || x === a ? [210, 255, 252] : x > b - 2 ? [40, 170, 160] : [100, 236, 226]); }); },
  pick_wood: pick([168, 134, 82]), pick_stone: pick([140, 140, 142]), pick_iron: pick([228, 228, 234]), pick_diamond: pick([90, 230, 220]),
};

export const ATLAS = {};
function makeAtlas() {
  if (ATLAS.tex) return ATLAS;
  const c = document.createElement('canvas'), ce = document.createElement('canvas'); c.width = c.height = ce.width = ce.height = 256;
  const g = c.getContext('2d'), ge = ce.getContext('2d'); ge.fillStyle = '#000'; ge.fillRect(0, 0, 256, 256);
  ATLAS.tiles = []; ATLAS.avg = [];
  TILES.forEach((name, i) => {
    const img = g.createImageData(16, 16), em = ge.createImageData(16, 16); for (let k = 3; k < 1024; k += 4) em.data[k] = 255;
    PAINT[name](img.data, rng(i * 7919 + 17), em.data);
    const x = (i % 16) * 16, y = Math.floor(i / 16) * 16; g.putImageData(img, x, y); ge.putImageData(em, x, y);
    const tc = document.createElement('canvas'); tc.width = tc.height = 16; tc.getContext('2d').putImageData(img, 0, 0); ATLAS.tiles.push(tc);
    let r = 0, gg = 0, b = 0, n = 0; for (let k = 0; k < 1024; k += 4) if (img.data[k + 3] > 100) { r += img.data[k]; gg += img.data[k + 1]; b += img.data[k + 2]; n++; }
    ATLAS.avg.push(new THREE.Color().setRGB(r / n / 255, gg / n / 255, b / n / 255, THREE.SRGBColorSpace));
  });
  const mk = (cv, srgb) => { const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestMipmapLinearFilter; t.anisotropy = 4; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  ATLAS.tex = mk(c, true); ATLAS.etex = mk(ce, true); ATLAS.canvas = c;
  // crack overlays for mining (8 stages)
  const R = rng(99), path = []; for (let s = 0; s < 6; s++) { let x = 8, y = 8; for (let k = 0; k < 11; k++) { path.push([x, y]); x += Math.round((R() - 0.5) * 2.4); y += Math.round((R() - 0.5) * 2.4); } }
  path.sort((a, b) => Math.hypot(a[0] - 8, a[1] - 8) - Math.hypot(b[0] - 8, b[1] - 8));
  ATLAS.cracks = [...Array(8)].map((_, s) => { const cv = document.createElement('canvas'); cv.width = cv.height = 16; const cg = cv.getContext('2d'); cg.fillStyle = 'rgba(0,0,0,0.78)'; path.slice(0, 6 + s * 8).forEach(([x, y]) => cg.fillRect(x, y, 1, 1)); const t = new THREE.CanvasTexture(cv); t.magFilter = THREE.NearestFilter; t.minFilter = THREE.NearestFilter; return t; });
  return ATLAS;
}

// ---------- blocks ----------
// hard = seconds to mine by hand, tier = pickaxe needed (2 stone, 3 iron), drop = what you get (default: the block itself)
export const BLOCKS = [null,
  { k: 'grass', en: 'Grass', ru: 'Трава', t: ['grass_top', 'grass_side', 'dirt'], hard: 0.6, drop: 'dirt' },
  { k: 'dirt', en: 'Dirt', ru: 'Земля', t: 'dirt', hard: 0.5 },
  { k: 'stone', en: 'Stone', ru: 'Камень', t: 'stone', hard: 2.2, rock: 1 },
  { k: 'sand', en: 'Sand', ru: 'Песок', t: 'sand', hard: 0.5 },
  { k: 'log', en: 'Log', ru: 'Бревно', t: ['log_top', 'log_side', 'log_top'], hard: 1.4 },
  { k: 'leaves', en: 'Leaves', ru: 'Листва', t: 'leaves', hard: 0.25, cut: 1 },
  { k: 'planks', en: 'Planks', ru: 'Доски', t: 'planks', hard: 1.1 },
  { k: 'coal_ore', en: 'Coal ore', ru: 'Угольная руда', t: 'coal_ore', hard: 2.6, rock: 1, drop: 'coal' },
  { k: 'iron_ore', en: 'Iron ore', ru: 'Железная руда', t: 'iron_ore', hard: 3, rock: 1, tier: 2 },
  { k: 'gold_ore', en: 'Gold ore', ru: 'Золотая руда', t: 'gold_ore', hard: 3, rock: 1, tier: 3 },
  { k: 'diamond_ore', en: 'Diamond ore', ru: 'Алмазная руда', t: 'diamond_ore', hard: 3.4, rock: 1, tier: 3, drop: 'diamond' },
  { k: 'bedrock', en: 'Bedrock', ru: 'Бедрок', t: 'bedrock', hard: Infinity, noPlace: 1 },
  { k: 'glass', en: 'Glass', ru: 'Стекло', t: 'glass', hard: 0.3, cut: 1 },
  { k: 'bricks', en: 'Stone bricks', ru: 'Каменные кирпичи', t: 'bricks', hard: 2.2, rock: 1 },
  { k: 'furnace', en: 'Furnace', ru: 'Печь', t: ['furnace_top', 'furnace_front', 'furnace_top'], hard: 2.2, rock: 1 },
  { k: 'table', en: 'Crafting table', ru: 'Верстак', t: ['table_top', 'table_side', 'planks'], hard: 1.1 },
  { k: 'torch', en: 'Torch', ru: 'Факел', t: ['torch_top', 'torch', 'torch_top'], hard: 0.05, cut: 1, soft: 1, glow: 1, shape: 'torch' },
  { k: 'lamp', en: 'Lamp', ru: 'Лампа', t: 'lamp', hard: 0.3, glow: 1 },
  { k: 'tnt', en: 'TNT', ru: 'Динамит', t: ['tnt_top', 'tnt_side', 'tnt_bottom'], hard: 0.05 },
  { k: 'tramp', en: 'Trampoline', ru: 'Батут', t: ['tramp_top', 'tramp_side', 'planks'], hard: 0.5 },
  { k: 'gold_block', en: 'Gold block', ru: 'Золотой блок', t: 'gold_block', hard: 2.5, rock: 1 },
  { k: 'snow', en: 'Snowy grass', ru: 'Снег', t: ['snow', 'snow_side', 'dirt'], hard: 0.5 },
  { k: 'ice', en: 'Ice', ru: 'Лёд', t: 'ice', hard: 0.5 },
  { k: 'pumpkin', en: 'Pumpkin', ru: 'Тыква', t: ['pumpkin_top', 'pumpkin_side', 'pumpkin_top'], hard: 0.7 },
  { k: 'jack', en: "Jack-o'-lantern", ru: 'Тыква-фонарь', t: ['pumpkin_top', 'jack', 'pumpkin_top'], hard: 0.7, glow: 1 },
  { k: 'ladder', en: 'Ladder', ru: 'Лестница', t: 'ladder', hard: 0.4, cut: 1, soft: 1, climb: 1 },
  { k: 'water', en: 'Water', ru: 'Вода', t: 'water', hard: Infinity, soft: 1, grp: 2, noPlace: 1, noMine: 1 },
  { k: 'lava', en: 'Lava', ru: 'Лава', t: 'lava', hard: Infinity, soft: 1, grp: 3, noPlace: 1, noMine: 1, glow: 1 },
  { k: 'diamond_block', en: 'Diamond block', ru: 'Алмазный блок', t: 'diamond_block', hard: 2.5, rock: 1 },
];
export const ID = {}; BLOCKS.forEach((b, i) => b && (ID[b.k] = i));
const NB = BLOCKS.length;
export const SOLID = new Uint8Array(NB), OPAQUE = new Uint8Array(NB), TARGET = new Uint8Array(NB), TL = [];
BLOCKS.forEach((b, i) => { if (!b) return; SOLID[i] = b.soft ? 0 : 1; OPAQUE[i] = b.cut || b.soft && !b.grp || b.grp === 2 ? 0 : 1; TARGET[i] = b.noMine ? 0 : 1; const t = Array.isArray(b.t) ? b.t : [b.t, b.t, b.t]; TL[i] = t.map(n => T[n]); });

// things you can hold that are not blocks
export const ITEMS = {
  stick: { en: 'Stick', ru: 'Палка' }, coal: { en: 'Coal', ru: 'Уголь' }, iron: { en: 'Iron ingot', ru: 'Железный слиток' }, gold: { en: 'Gold ingot', ru: 'Золотой слиток' }, diamond: { en: 'Diamond', ru: 'Алмаз' },
  pick_wood: { en: 'Wooden pickaxe', ru: 'Деревянная кирка', tier: 1, mult: 2 }, pick_stone: { en: 'Stone pickaxe', ru: 'Каменная кирка', tier: 2, mult: 3.2 },
  pick_iron: { en: 'Iron pickaxe', ru: 'Железная кирка', tier: 3, mult: 4.8 }, pick_diamond: { en: 'Diamond pickaxe', ru: 'Алмазная кирка', tier: 4, mult: 7.5 },
};
BLOCKS.forEach(b => b && !b.noPlace && (ITEMS[b.k] = { en: b.en, ru: b.ru, block: ID[b.k] }));

// a little picture of an item for the hotbar and the crafting panel: blocks are drawn as 3D cubes
const ICONS = {};
export function icon(key) {
  if (ICONS[key]) return ICONS[key];
  makeAtlas(); const c = document.createElement('canvas'); c.width = c.height = 48; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const id = ID[key], b = BLOCKS[id];
  if (b && !b.shape && !b.climb) {
    const [top, side] = TL[id];
    // each face on its own layer so the shading only darkens that face
    const c2 = document.createElement('canvas'); c2.width = c2.height = 48; const g2 = c2.getContext('2d'); g2.imageSmoothingEnabled = false;
    const lay = (tile, m, dark) => { const l = document.createElement('canvas'); l.width = l.height = 48; const gl = l.getContext('2d'); gl.imageSmoothingEnabled = false; gl.setTransform(...m); gl.drawImage(ATLAS.tiles[tile], 0, 0); gl.setTransform(1, 0, 0, 1, 0, 0); if (dark) { gl.globalCompositeOperation = 'source-atop'; gl.fillStyle = `rgba(0,0,0,${dark})`; gl.fillRect(0, 0, 48, 48); } g2.drawImage(l, 0, 0); };
    lay(top, [20 / 16, 10 / 16, -20 / 16, 10 / 16, 24, 3]); lay(side, [20 / 16, 10 / 16, 0, 23 / 16, 4, 13], 0.2); lay(side, [20 / 16, -10 / 16, 0, 23 / 16, 24, 23], 0.4);
    return (ICONS[key] = c2.toDataURL());
  }
  const tile = b ? TL[id][1] : T[key];
  if (b && b.shape === 'torch') g.drawImage(ATLAS.tiles[tile], 0, 0, 16, 16, 19, 4, 10, 40); else g.drawImage(ATLAS.tiles[tile], 0, 0, 16, 16, 4, 4, 40, 40);
  return (ICONS[key] = c.toDataURL());
}

// ---------- the island generator (same seed = same island everywhere) ----------
function hash(a, b, c, s) { let h = Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1440662683) + Math.imul(s, 1274126177) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; }
function vnoise(x, z, s) { const x0 = Math.floor(x), z0 = Math.floor(z), fx = x - x0, fz = z - z0, u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz); const a = hash(x0, z0, 0, s), b = hash(x0 + 1, z0, 0, s), c = hash(x0, z0 + 1, 0, s), d = hash(x0 + 1, z0 + 1, 0, s); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; }
const fbm = (x, z, s) => vnoise(x / 14, z / 14, s) * 0.55 + vnoise(x / 7, z / 7, s + 1) * 0.3 + vnoise(x / 3.5, z / 3.5, s + 2) * 0.15;

export function generate(seed) {
  const v = new Uint8Array(TOTAL), top = new Int16Array(N * N), info = { seed };
  const set = (i, k, j, b) => { if (inb(i, k, j)) v[idx(i, k, j)] = b; }, get = (i, k, j) => (inb(i, k, j) ? v[idx(i, k, j)] : 0);
  const R = rng(seed * 31 + 7), mx = 40 + R() * 8 | 0, mz = 18 + R() * 8 | 0, lx = 18 + R() * 6 | 0, lz = 22 + R() * 6 | 0;
  // height map: an island with hills, a mountain and a little lake
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const d = Math.hypot(i - 31.5, j - 31.5) / 26 + (fbm(i, j, seed) - 0.5) * 0.45;
    let h;
    if (d > 1) h = Math.max(-3, -2 - Math.round((d - 1) * 6));
    else h = Math.round(Math.pow(1 - d, 1.1) * (3 + fbm(i * 1.3, j * 1.3, seed + 7) * 8) + 10 * Math.exp(-((i - mx) ** 2 + (j - mz) ** 2) / 55) * Math.min(1, (1 - d) * 3));
    const ld = Math.hypot(i - lx, j - lz); if (ld < 4.2 && d < 0.8) h = Math.min(h, ld < 3.2 ? -1 : 0);
    top[j * N + i] = h;
    const kt = h - Y0 - 1, beach = h <= 1 || d > 0.8, surf = h < 0 ? ID.sand : h >= 12 ? ID.snow : beach ? ID.sand : h >= 9 && hash(i, j, 3, seed) < 0.5 ? ID.stone : ID.grass;
    for (let k = 0; k <= kt; k++) {
      const depth = kt - k, y = k + Y0;
      let b = ID.stone;
      if (k === 0) b = ID.bedrock;
      else if (depth === 0) b = surf;
      else if (depth <= 3 && surf !== ID.stone) b = surf === ID.sand ? ID.sand : ID.dirt;
      else {
        const vein = hash(i >> 1, k >> 1, j >> 1, seed + 5), r = hash(i, k, j, seed + 9);
        if (vein < 0.045 && y <= -1 && r < 0.55) b = ID.diamond_ore;
        else if (vein < 0.1 && y <= 2 && r < 0.55) b = ID.gold_ore;
        else if (vein < 0.19 && y <= 7 && r < 0.55) b = ID.iron_ore;
        else if (vein < 0.33 && r < 0.55) b = ID.coal_ore;
      }
      v[idx(i, k, j)] = b;
    }
    if (ld < 3.2 && d < 0.8) set(i, -Y0 - 1, j, ID.water);
  }
  const H0 = (i, j) => top[j * N + i];
  // a cave tunnel into the mountain, lit by torches, with diamonds at the end
  let x = mx - 9, z = mz + 5, y = H0(Math.round(x), Math.round(z)) + 0.5, a = Math.atan2(mz - z, mx - x);
  const cave = [];
  for (let s = 0; s < 30; s++) {
    for (let di = -2; di <= 2; di++) for (let dk = -2; dk <= 2; dk++) for (let dj = -2; dj <= 2; dj++) {
      if (di * di + dk * dk * 1.3 + dj * dj > 3.2) continue; const i = Math.round(x) + di, k = Math.round(y - Y0) + dk, j = Math.round(z) + dj;
      if (inb(i, k, j) && k > 0 && v[idx(i, k, j)] !== ID.water) v[idx(i, k, j)] = 0;
    }
    cave.push([Math.round(x), Math.round(y - Y0), Math.round(z)]);
    a += (R() - 0.5) * 0.7; x += Math.cos(a); z += Math.sin(a); if (y > -2.5) y -= 0.45;
    x = Math.max(4, Math.min(N - 5, x)); z = Math.max(4, Math.min(N - 5, z));
  }
  const floor = (i, k, j) => { while (k > 1 && !get(i, k - 1, j)) k--; return k; };
  cave.forEach(([i, k, j], s) => { if (s % 6 === 3) { const f = floor(i, k, j); if (!get(i, f, j)) set(i, f, j, ID.torch); } });
  const [ei, ek, ej] = cave[cave.length - 1];
  [[2, 0, 0, ID.diamond_ore], [-2, 0, 1, ID.diamond_ore], [0, 0, 2, ID.gold_ore], [1, -1, -2, ID.gold_ore], [-1, 1, -2, ID.iron_ore], [2, 1, 1, ID.diamond_ore]].forEach(([di, dk, dj, b]) => { if (get(ei + di, ek + dk, ej + dj)) set(ei + di, ek + dk, ej + dj, b); });
  info.cave = [cave[0][0] - OFF, cave[0][2] - OFF];
  // spawn: a grassy spot near the middle
  let sp = null;
  for (let r = 0; r < 20 && !sp; r++) for (let t = 0; t < 24 && !sp; t++) { const i = Math.round(32 + Math.cos(t / 24 * 6.28) * r), j = Math.round(36 + Math.sin(t / 24 * 6.28) * r); if (inb(i, 1, j) && H0(i, j) >= 2 && H0(i, j) <= 6 && v[idx(i, H0(i, j) - Y0 - 1, j)] === ID.grass) sp = [i, j]; }
  sp = sp || [32, 36]; info.spawn = [sp[0] - OFF + 0.5, sp[1] - OFF + 0.5];
  // the sky island floats high above, with a ladder tower up to it
  const si = mx - 22 < 6 ? 14 : mx - 22, sj = Math.min(N - 12, mz + 26), sk = 26;
  for (let dk = 0; dk < 5; dk++) { const r = 4.6 - dk * 1.0; for (let di = -5; di <= 5; di++) for (let dj = -5; dj <= 5; dj++) if (Math.hypot(di, dj) < r + hash(si + di, sk - dk, sj + dj, seed) * 0.8) set(si + di, sk - dk, sj + dj, dk === 0 ? ID.grass : dk < 2 ? ID.dirt : hash(di, dk, dj, seed) < 0.15 ? ID.gold_ore : ID.stone); }
  info.sky = [si - OFF + 0.5, sk + Y0 + 1, sj - OFF + 0.5];
  const tree = (i, j, k0, th) => {
    for (let t = 0; t < th; t++) set(i, k0 + t, j, ID.log);
    for (let dy = th - 2; dy <= th + 1; dy++) { const r = dy >= th ? 1 : 2; for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) { if (Math.abs(di) === r && Math.abs(dj) === r && (r === 1 && dy === th + 1 || hash(i + di, dy, j + dj, seed) < 0.6)) continue; if (!get(i + di, k0 + dy, j + dj)) set(i + di, k0 + dy, j + dj, ID.leaves); } }
  };
  tree(si, sj, sk + 1, 4); set(si + 2, sk + 1, sj - 1, ID.lamp);
  const ti = si + 5, tj = sj; let tk = 1; while (tk < H && get(ti, tk, tj)) tk++;
  for (let k = tk; k <= sk; k++) { set(ti, k, tj, ID.planks); set(ti + 1, k, tj, ID.ladder); }
  set(ti + 1, sk + 1, tj, ID.ladder);
  info.ladder = [ti + 1 - OFF + 0.5, tj - OFF + 0.5];
  // trees and pumpkins on the grass
  for (let gj = 0; gj < N; gj += 5) for (let gi = 0; gi < N; gi += 5) {
    const i = gi + (hash(gi, gj, 1, seed) * 4 | 0), j = gj + (hash(gi, gj, 2, seed) * 4 | 0); if (!inb(i, 1, j)) continue;
    const h = H0(i, j), k0 = h - Y0, near = (p, r) => Math.hypot(i - p[0] - OFF, j - p[1] - OFF) < r;
    if (v[idx(i, k0 - 1, j)] !== ID.grass || near(info.spawn, 6) || near(info.cave, 4) || Math.hypot(i - ti, j - tj) < 3 || get(i, k0, j)) continue;
    if (hash(gi, gj, 4, seed) < 0.72) tree(i, j, k0, 4 + (hash(gi, gj, 5, seed) < 0.4 ? 1 : 0));
    else if (hash(gi, gj, 6, seed) < 0.5) set(i, k0, j, ID.pumpkin);
  }
  return { v, info };
}

// ---------- rendering: every visible block is one instance ----------
function patch(m) {
  m.onBeforeCompile = s => {
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec3 aTile;').replace('#include <uv_vertex>', `#include <uv_vertex>
      { float tl = normal.y > 0.5 ? aTile.x : (normal.y < -0.5 ? aTile.z : aTile.y);
        vec2 tuv = vec2((mod(tl, 16.0) + 0.02 + uv.x * 0.96) / 16.0, 1.0 - (floor(tl / 16.0) + 0.98 - uv.y * 0.96) / 16.0);
        #ifdef USE_MAP
        vMapUv = tuv;
        #endif
        #ifdef USE_EMISSIVEMAP
        vEmissiveMapUv = tuv;
        #endif
      }`);
  };
  m.customProgramCacheKey = () => 'voxel';
  return m;
}
export const voxMat = p => patch(new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...p }));
// a single block mesh (held in the hand, falling from the sky, ...)
export function blockGeo(v, s = 1) { const g = new THREE.BoxGeometry(s, s, s), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(TL[v], i * 3); g.setAttribute('aTile', new THREE.BufferAttribute(a, 3)); return g; }

export class Voxels {
  constructor(world, seed) {
    this.w = world; makeAtlas();
    this.mat = voxMat({ map: ATLAS.tex, emissiveMap: ATLAS.etex, emissive: 0xffffff, emissiveIntensity: 1.25, alphaTest: 0.5 });
    const water = voxMat({ map: ATLAS.tex, transparent: true, opacity: 0.68, roughness: 0.1, depthWrite: false }), lava = voxMat({ map: ATLAS.tex, emissiveMap: ATLAS.tex, emissive: 0xffffff, emissiveIntensity: 1.1 });
    this.lavaMat = lava;
    this.depth = patch(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: ATLAS.tex, alphaTest: 0.5 }));
    this.G = [null, { mat: this.mat, cap: 24000, shadow: true }, { mat: water, cap: 512 }, { mat: lava, cap: 2048 }];
    for (const G of this.G) if (G) { G.count = 0; G.m = new Float32Array(G.cap * 16); G.t = new Float32Array(G.cap * 3); G.col = new Float32Array(G.cap * 3); G.cells = new Int32Array(G.cap); G.lo = 1e9; G.hi = -1; this.makeMesh(G); }
    this.slot = new Int32Array(TOTAL); this.cg = new Uint8Array(TOTAL); this.glow = new Set();
    this.load(seed, 0);
  }
  makeMesh(G) {
    if (G.mesh) { this.w.scene.remove(G.mesh); G.mesh.geometry.dispose(); }
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.setAttribute('aTile', new THREE.InstancedBufferAttribute(G.t, 3).setUsage(THREE.DynamicDrawUsage));
    const m = G.mesh = new THREE.InstancedMesh(geo, G.mat, G.cap);
    m.instanceMatrix = new THREE.InstancedBufferAttribute(G.m, 16).setUsage(THREE.DynamicDrawUsage); m.instanceColor = new THREE.InstancedBufferAttribute(G.col, 3).setUsage(THREE.DynamicDrawUsage);
    m.count = G.count; m.frustumCulled = false; m.castShadow = !!G.shadow; m.receiveShadow = true; if (G.shadow) m.customDepthMaterial = this.depth;
    if (G.mat.transparent) m.renderOrder = 2;
    this.w.scene.add(m); G.lo = 0; G.hi = G.count - 1; G.full = true;
  }
  grow(G) {
    const cap = Math.ceil(G.cap * 1.5) + 1024, cp = (a, n) => { const b = new a.constructor(cap * n); b.set(a); return b; };
    G.m = cp(G.m, 16); G.t = cp(G.t, 3); G.col = cp(G.col, 3); G.cells = cp(G.cells, 1); G.cap = cap; this.makeMesh(G);
  }
  load(seed, gen) {
    const g = generate(seed); this.seed = seed; this.gen = gen; this.base = g.v; this.info = g.info; this.vox = g.v.slice(); this.changes = new Map(); this.rebuild();
  }
  rebuild() {
    for (const G of this.G) if (G) { G.count = 0; G.full = true; }
    this.slot.fill(-1); this.cg.fill(0); this.glow.clear();
    const v = this.vox; for (let c = 0; c < TOTAL; c++) if (v[c]) this.refresh(c);
  }
  exposed(c, v) {
    const i = ci(c), j = cj(c), k = ck(c), w = v === ID.water, x = this.vox;
    const see = n => { const b = x[n]; return !b || (w ? b !== ID.water && !OPAQUE[b] : !OPAQUE[b]); };
    return i === 0 || i === N - 1 || j === 0 || j === N - 1 || k === H - 1 || see(c - 1) || see(c + 1) || see(c - N) || see(c + N) || see(c + N * N) || (k > 0 && see(c - N * N));
  }
  refresh(c) {
    const v = this.vox[c], want = v && this.exposed(c, v) ? BLOCKS[v].grp || 1 : 0, cur = this.cg[c];
    if (cur && cur !== want) this.remove(cur, c);
    if (want) this.put(want, c, v);
    if (v && BLOCKS[v].glow && v !== ID.lava) this.glow.add(c); else this.glow.delete(c);
  }
  put(g, c, v) {
    const G = this.G[g]; let s = this.slot[c];
    if (this.cg[c] !== g || s < 0) { if (G.count >= G.cap) this.grow(G); s = G.count++; G.cells[s] = c; this.slot[c] = s; this.cg[c] = g; }
    const [x, y, z] = center(c), B = BLOCKS[v], h = hash(c, 1, 2, 3);
    let sx = 1, sy = 1, ty = y;
    if (B.shape === 'torch') { sx = 0.16; sy = 0.62; ty = y - 0.19; } else if (g === 2) { sy = 0.88; ty = y - 0.06; }
    G.m.set([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sx, 0, x, ty, z, 1], s * 16); G.t.set(TL[v], s * 3);
    const b = B.glow || g > 1 ? 1 : 0.88 + h * 0.12; G.col[s * 3] = b; G.col[s * 3 + 1] = b; G.col[s * 3 + 2] = b;
    if (s < G.lo) G.lo = s; if (s > G.hi) G.hi = s;
  }
  remove(g, c) {
    const G = this.G[g], s = this.slot[c], last = --G.count;
    if (s !== last) { G.m.copyWithin(s * 16, last * 16, last * 16 + 16); G.t.copyWithin(s * 3, last * 3, last * 3 + 3); G.col.copyWithin(s * 3, last * 3, last * 3 + 3); const mc = G.cells[last]; G.cells[s] = mc; this.slot[mc] = s; if (s < G.lo) G.lo = s; if (s > G.hi) G.hi = s; }
    this.slot[c] = -1; this.cg[c] = 0;
  }
  // upload only what changed since the last frame
  flush() {
    for (const G of this.G) {
      if (!G) continue; const m = G.mesh; m.count = G.count;
      if (G.hi < G.lo && !G.full) continue;
      const lo = G.full ? 0 : G.lo, n = (G.full ? G.count : G.hi - lo + 1);
      for (const [a, k] of [[m.instanceMatrix, 16], [m.geometry.attributes.aTile, 3], [m.instanceColor, 3]]) { a.clearUpdateRanges(); if (n > 0) a.addUpdateRange(lo * k, n * k); a.needsUpdate = true; }
      G.lo = 1e9; G.hi = -1; G.full = false;
    }
  }
  // change one block (and redraw it and its neighbours)
  set(c, v) {
    if (c < 0 || c >= TOTAL || this.vox[c] === v) return false;
    this.vox[c] = v;
    this.changes.delete(c); if (v !== this.base[c]) this.changes.set(c, v);
    this.refresh(c); const i = ci(c), j = cj(c), k = ck(c);
    if (i > 0) this.refresh(c - 1); if (i < N - 1) this.refresh(c + 1); if (j > 0) this.refresh(c - N); if (j < N - 1) this.refresh(c + N); if (k > 0) this.refresh(c - N * N); if (k < H - 1) this.refresh(c + N * N);
    return true;
  }
  at(x, y, z) { const c = cellOf(x, y, z); return c < 0 ? 0 : this.vox[c]; }
  solid(x, y, z) { return SOLID[this.at(x, y, z)] === 1; }
  // the highest block top at or below y (+ a little step), or null
  ground(x, z, y) {
    const i = Math.floor(x + OFF), j = Math.floor(z + OFF); if (i < 0 || j < 0 || i >= N || j >= N) return null;
    let k = Math.min(H - 1, Math.floor(y + 0.5 - Y0 - 1)); const base = j * N + i;
    for (; k >= 0; k--) if (SOLID[this.vox[k * N * N + base]]) return k + Y0 + 1;
    return null;
  }
  colTop(i, j) { for (let k = H - 1; k >= 0; k--) { const v = this.vox[idx(i, k, j)]; if (v && v !== ID.torch && v !== ID.ladder) return k; } return -1; }
  // walk the grid along a ray (Amanatides & Woo); mask says which blocks stop it
  ray(o, d, max, mask = TARGET) {
    let x = o.x + OFF, y = o.y - Y0, z = o.z + OFF, i = Math.floor(x), k = Math.floor(y), j = Math.floor(z);
    const si = Math.sign(d.x), sk = Math.sign(d.y), sj = Math.sign(d.z), dx = Math.abs(1 / d.x), dy = Math.abs(1 / d.y), dz = Math.abs(1 / d.z);
    let tx = si > 0 ? (i + 1 - x) * dx : si < 0 ? (x - i) * dx : Infinity, ty = sk > 0 ? (k + 1 - y) * dy : sk < 0 ? (y - k) * dy : Infinity, tz = sj > 0 ? (j + 1 - z) * dz : sj < 0 ? (z - j) * dz : Infinity;
    let t = 0, n = [0, 0, 0];
    for (let s = 0; s < 400 && t <= max; s++) {
      if (inb(i, k, j)) { const c = idx(i, k, j), v = this.vox[c]; if (v && mask[v]) return { c, v, n, t }; }
      if (tx < ty && tx < tz) { i += si; t = tx; tx += dx; n = [-si, 0, 0]; } else if (ty < tz) { k += sk; t = ty; ty += dy; n = [0, -sk, 0]; } else { j += sj; t = tz; tz += dz; n = [0, 0, -sj]; }
    }
    return null;
  }
  // compact form of every changed block for late joiners: 4 characters per block
  encode(max) {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; let s = '', n = 0;
    for (const [c, v] of this.changes) { if (n++ >= max) break; const x = c * 64 + v; s += A[(x >> 18) & 63] + A[(x >> 12) & 63] + A[(x >> 6) & 63] + A[x & 63]; }
    return s;
  }
  static decode(s) {
    const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/', out = new Map();
    for (let p = 0; p + 3 < s.length; p += 4) { const x = (A.indexOf(s[p]) << 18) | (A.indexOf(s[p + 1]) << 12) | (A.indexOf(s[p + 2]) << 6) | A.indexOf(s[p + 3]); out.set(x >> 6, x & 63); }
    return out;
  }
}
