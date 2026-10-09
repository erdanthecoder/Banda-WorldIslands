// 3D world: islands, ocean, sky, buildings, metro stations, players, effects.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';

// ---------- deterministic noise ----------
export function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z, o = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const rnd = (() => { let s = 12345; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();

export const ISLANDS = [
  { id: 'hub', x: 0, z: 0, r: 165, h: 4, peak: 16 },   // Banda Island: tower, plaza, supermarket, playground, pitch
  { id: 'east', x: 470, z: 90, r: 110, h: 6, peak: 34 }, // the second island: nature only
];
export const isl = id => ISLANDS.find(i => i.id === id);

export const PITCH = { x: 0, z: 86, hw: 30, hd: 18, h: 4 };
export const COURT = { x: 78, z: 82, hw: 16, hd: 10, h: 4 };
export const TOWER = { x: 0, z: -58, w: 44, d: 30, floors: 8, fh: 5.2, base: 4 };
export const MARKET = { x: -70, z: 6, w: 32, d: 22, base: 4 };
export const PLAYGROUND = { x: 64, z: 10, w: 36, d: 30 };
export const HOUSES = [];
export const ROAD = { x: 0, z: 0, r: -1000, w: 0 };
const FLATS = [
  { x: 0, z: 0, r: 118, h: 4 },
  { x: 470, z: 90, r: 18, h: 6 },
];

export function heightAt(x, z) {
  let best = -10;
  for (const I of ISLANDS) {
    const dx = x - I.x, dz = z - I.z, d = Math.sqrt(dx * dx + dz * dz) / I.r;
    if (d > 1.35) continue;
    const n = fbm(x * 0.02 + I.x, z * 0.02 + I.z);
    const fall = smooth(1.22, 0.62, d + (n - 0.5) * 0.4);
    let h = -10 + (I.h + 10) * fall + (fbm(x * 0.05, z * 0.05) - 0.5) * 3.5 * fall;
    h += Math.pow(Math.max(0, fbm(x * 0.017 + 9, z * 0.017 - 4, 6) - 0.44) * 2.3, 1.7) * I.peak * smooth(1.02, 0.55, d) * smooth(0.3, 0.62, d);
    if (h > best) best = h;
  }
  for (const F of FLATS) {
    let w;
    if (F.r) w = smooth(F.r + 10, F.r, Math.hypot(x - F.x, z - F.z));
    else { const ox = Math.abs(x - F.x) - F.hw, oz = Math.abs(z - F.z) - F.hd; w = smooth(10, 0, Math.max(ox, oz, 0)); }
    if (w > 0) best = best + (F.h - best) * w;
  }
  return best;
}
const inFlat = (x, z, pad) => FLATS.some(F => F.r ? Math.hypot(x - F.x, z - F.z) < F.r + pad : Math.abs(x - F.x) < F.hw + pad && Math.abs(z - F.z) < F.hd + pad);
const slopeAt = (x, z) => { const h = heightAt(x, z); return Math.hypot(heightAt(x + 1, z) - h, heightAt(x, z + 1) - h); };

// ---------- procedural textures ----------
export function canvasTex(w, h, draw, repeat, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(...repeat);
  return t;
}
function speckle(g, w, h, amt, n, size = 2) {
  for (let i = 0; i < n; i++) { const v = (Math.random() - 0.5) * amt; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * size, 1 + Math.random() * size); }
}
// seamless value-noise image (tiles because the noise lattice wraps)
function noiseImage(g, S, cells, colA, colB, oct = 5) {
  const img = g.createImageData(S, S), A = new THREE.Color(colA), B = new THREE.Color(colB);
  const lat = (i, j, p) => hash(((i % p) + p) % p, ((j % p) + p) % p);
  const vn = (x, y, p) => { const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = lat(xi, yi, p), b = lat(xi + 1, yi, p), c = lat(xi, yi + 1, p), d = lat(xi + 1, yi + 1, p); return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v; };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let s = 0, a = 0.5, f = cells; for (let o = 0; o < oct; o++) { s += a * vn(x / S * f, y / S * f, f); f *= 2; a *= 0.5; }
    const i = (y * S + x) * 4; img.data[i] = (A.r + (B.r - A.r) * s) * 255; img.data[i + 1] = (A.g + (B.g - A.g) * s) * 255; img.data[i + 2] = (A.b + (B.b - A.b) * s) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
}
export const TEX = {};
function makeTextures() {
  TEX.grass = canvasTex(512, 512, (g, w, h) => {
    noiseImage(g, w, 4, '#2d4a1c', '#6a8a3a');
    for (let i = 0; i < 26000; i++) { const x = Math.random() * w, y = Math.random() * h, l = 3 + Math.random() * 7, a = -Math.PI / 2 + (Math.random() - 0.5) * 0.9;
      g.strokeStyle = `hsla(${70 + Math.random() * 40},${35 + Math.random() * 30}%,${18 + Math.random() * 30}%,0.7)`; g.lineWidth = 1 + Math.random(); g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  });
  TEX.rock = canvasTex(512, 512, (g, w, h) => {
    noiseImage(g, w, 6, '#4f4b45', '#9d968b', 6); speckle(g, w, h, 0.2, 12000);
    g.strokeStyle = 'rgba(30,26,22,0.45)'; for (let i = 0; i < 60; i++) { let x = Math.random() * w, y = Math.random() * h; g.lineWidth = 0.5 + Math.random() * 1.5; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (Math.random() - 0.5) * 40; y += Math.random() * 25; g.lineTo(x, y); } g.stroke(); }
  });
  TEX.sand = canvasTex(512, 512, (g, w, h) => { noiseImage(g, w, 8, '#a8936a', '#d9c69a', 4); speckle(g, w, h, 0.25, 30000, 1); });
  TEX.snow = canvasTex(256, 256, (g, w, h) => { noiseImage(g, w, 4, '#cfd8e2', '#ffffff', 4); });
  TEX.macro = canvasTex(256, 256, (g, w) => noiseImage(g, w, 3, '#000000', '#ffffff', 5), null, false);
  TEX.cobble = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5d5a54'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 12 - 12; x < w; x += 24) { g.fillStyle = `hsl(32,${5 + Math.random() * 6}%,${44 + Math.random() * 16}%)`; g.beginPath(); g.roundRect(x + 1.5, y + 1.5, 21, 13, 4); g.fill(); }
    speckle(g, w, h, 0.15, 5000, 1);
  });
  const facade = (wall, glass, cols, rows, frame) => canvasTex(512, 512, (g, w, h) => {
    noiseImage(g, w, 6, wall, new THREE.Color(wall).offsetHSL(0, 0, 0.08).getStyle(), 3);
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.15, y = r * rh + rh * 0.2, ww = cw * 0.7, hh = rh * 0.6;
      g.fillStyle = frame; g.fillRect(x - 5, y - 5, ww + 10, hh + 10);
      const gr = g.createLinearGradient(x, y, x + ww * 0.6, y + hh); gr.addColorStop(0, glass); gr.addColorStop(1, '#0a131c'); g.fillStyle = gr; g.fillRect(x, y, ww, hh);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + ww * 0.4, y); g.lineTo(x, y + hh * 0.6); g.fill();
      g.fillStyle = frame; g.fillRect(x + ww / 2 - 2, y, 4, hh);
      if (Math.random() < 0.3) { g.fillStyle = 'rgba(255,220,160,0.25)'; g.fillRect(x, y, ww, hh); }
    }
  });
  TEX.glass = facade('#aab3b9', '#5b7f99', 4, 4, '#353b41');
  TEX.stone = facade('#c2b8a3', '#465664', 3, 3, '#9a907c');
  TEX.concrete = facade('#9b9993', '#4a5d6c', 5, 3, '#6d6b66');
  TEX.brick = canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#5e3326'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 12) for (let x = (y / 12 % 2) * 12 - 12; x < w; x += 24) { g.fillStyle = `hsl(${8 + Math.random() * 10},${35 + Math.random() * 12}%,${26 + Math.random() * 12}%)`; g.fillRect(x + 1, y + 1, 22, 10); }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const x = c * 170 + 40, y = r * 170 + 30; g.fillStyle = '#d2cbbd'; g.fillRect(x - 8, y - 8, 106, 128); g.fillStyle = '#16212b'; g.fillRect(x, y, 90, 112); g.fillStyle = '#d2cbbd'; g.fillRect(x + 43, y, 5, 112); g.fillRect(x, y + 52, 90, 5); }
  });
  TEX.plaster = canvasTex(256, 256, (g, w) => noiseImage(g, w, 6, '#d8d0c0', '#efe8da', 4));
  TEX.roof = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6b2f24'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 10; x < w; x += 20) { g.fillStyle = `hsl(10,${40 + Math.random() * 15}%,${24 + Math.random() * 10}%)`; g.beginPath(); g.ellipse(x + 10, y + 12, 10, 9, 0, 0, Math.PI); g.fill(); } });
  TEX.wood = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#6e4f34'; g.fillRect(0, 0, w, h); for (let i = 0; i < 300; i++) { g.strokeStyle = `rgba(${Math.random() < 0.5 ? '40,26,15' : '150,115,80'},0.25)`; g.beginPath(); const y = Math.random() * h; g.moveTo(0, y); g.bezierCurveTo(w / 3, y + (Math.random() - 0.5) * 8, w * 2 / 3, y + (Math.random() - 0.5) * 8, w, y); g.stroke(); } for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y, w, 2); } });
  TEX.bark = canvasTex(128, 256, (g, w, h) => { g.fillStyle = '#4a3a2c'; g.fillRect(0, 0, w, h); for (let i = 0; i < 200; i++) { g.strokeStyle = `rgba(${Math.random() < 0.5 ? '20,14,8' : '110,92,72'},0.5)`; g.lineWidth = 1 + Math.random() * 2; const x = Math.random() * w; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (Math.random() - 0.5) * 10, h); g.stroke(); } });
  TEX.tile = canvasTex(256, 256, (g, w, h) => { noiseImage(g, w, 4, '#cfcac0', '#e2ded6', 3); g.strokeStyle = '#a9a49b'; g.lineWidth = 2; for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } });
  // foliage cards (alpha)
  TEX.leaves = canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < 420; i++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 110, x = w / 2 + Math.cos(a) * r, y = h / 2 + Math.sin(a) * r * 0.9;
      g.save(); g.translate(x, y); g.rotate(Math.random() * 6.28);
      g.fillStyle = `hsl(${85 + Math.random() * 35},${35 + Math.random() * 25}%,${16 + Math.random() * 22}%)`;
      g.beginPath(); g.ellipse(0, 0, 9 + Math.random() * 5, 4 + Math.random() * 2, 0, 0, 6.28); g.fill(); g.restore();
    }
  });
  TEX.needles = canvasTex(256, 256, (g, w, h) => {
    for (let i = 0; i < 900; i++) { const y = Math.random() * h, spread = (y / h) * w * 0.48, x = w / 2 + (Math.random() - 0.5) * 2 * spread;
      g.strokeStyle = `hsl(${120 + Math.random() * 25},${30 + Math.random() * 20}%,${12 + Math.random() * 16}%)`; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (Math.random() - 0.5) * 14, y + 6 + Math.random() * 10); g.stroke(); }
  });
  TEX.frond = canvasTex(128, 512, (g, w, h) => {
    g.strokeStyle = '#4d5a24'; g.lineWidth = 4; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
    for (let y = 10; y < h; y += 7) { const l = Math.sin(y / h * Math.PI) * 58; g.strokeStyle = `hsl(${80 + Math.random() * 20},45%,${22 + Math.random() * 10}%)`; g.lineWidth = 4;
      g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 - l, y + 18); g.moveTo(w / 2, y); g.lineTo(w / 2 + l, y + 18); g.stroke(); }
  });
}

function waterNormals() {
  const S = 256, hgt = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let v = 0, a = 1, f = 3;
    for (let o = 0; o < 4; o++) { v += a * (Math.sin((x / S) * Math.PI * 2 * f + Math.cos((y / S) * Math.PI * 2 * (f + 1)) * 1.7) + Math.sin((y / S) * Math.PI * 2 * f + Math.sin((x / S) * Math.PI * 2 * 2) * 1.3)); a *= 0.55; f *= 2; }
    hgt[y * S + x] = v;
  }
  const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'), img = g.createImageData(S, S), n = new THREE.Vector3();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = hgt[y * S + (x + 1) % S] - hgt[y * S + (x - 1 + S) % S], dy = hgt[((y + 1) % S) * S + x] - hgt[((y - 1 + S) % S) * S + x];
    n.set(-dx, -dy, 2).normalize(); const i = (y * S + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export function labelSprite(text, height = 0.5, { color = '#fff', bg = 'rgba(14,18,26,0.72)', weight = 600 } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 44;
  g.font = `${weight} ${fs}px Manrope, system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 36; c.width = w; c.height = fs + 26;
  g.font = `${weight} ${fs}px Manrope, system-ui, sans-serif`;
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, c.height, 10); g.fill(); }
  g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'center'; g.fillText(text, w / 2, c.height / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(height * w / c.height, height, 1); s.renderOrder = 10;
  return s;
}

// ---------- World ----------
export class World {
  constructor(canvas, { quality = 'high' } = {}) {
    this.hq = quality === 'high';
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !this.hq, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, this.hq ? 1.5 : 1));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.5;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(56, 1, 0.1, 6000);
    this.clock = new THREE.Clock();
    this.updaters = []; this.portals = []; this.remotes = {}; this.effects = {}; this.keys = {}; this.joy = { x: 0, y: 0 };
    this.timeU = { value: 0 }; this.buildings = []; this.carrier = null;
    this.solids = []; this.interiors = []; this.zones = []; this.grounds = []; this.holes = []; this.holeMats = [];
    this.yaw = Math.PI; this.pitch = 0.28; this.dist = 6.5;
    this.vel = new THREE.Vector3(); this.onGround = false;
    this.frozenUntil = 0; this.constrain = null; this.inputLocked = false; this.stars = [];
    makeTextures();
    this._build();
    if (this.hq) {
      const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(r, rt);
      this.composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.22, 0.5, 0.92);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
    this._input();
    addEventListener('resize', () => this.resize()); this.resize();
  }
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); this.composer && this.composer.setSize(w, h); }

  // Ground material that blends grass/rock/sand/snow textures and can cut holes (metro stairwells).
  terrainMaterial(extra = {}) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.96, color: 0xffffff, ...extra });
    const holes = this.holes;
    mat.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, { tGrass: { value: TEX.grass }, tRock: { value: TEX.rock }, tSand: { value: TEX.sand }, tSnow: { value: TEX.snow }, tMacro: { value: TEX.macro },
        uHoles: { value: holes.map(h => h.v) }, uHoleRot: { value: holes.map(h => h.rot) }, uTime: this.timeU });
      sh.uniforms.uHoles.value.length = 8; sh.uniforms.uHoleRot.value.length = 8;
      for (let i = 0; i < 8; i++) { sh.uniforms.uHoles.value[i] ||= new THREE.Vector4(1e9, 1e9, 0, 0); sh.uniforms.uHoleRot.value[i] ||= 0; }
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 splat; varying vec4 vSplat; varying vec3 vWP;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n vSplat = splat; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D tGrass, tRock, tSand, tSnow, tMacro; uniform float uTime; uniform vec4 uHoles[8]; uniform float uHoleRot[8]; varying vec4 vSplat; varying vec3 vWP;`)
        .replace('#include <map_fragment>', `
        for (int i = 0; i < 8; i++) { vec4 hl = uHoles[i]; float c = cos(uHoleRot[i]), s = sin(uHoleRot[i]); vec2 d = vWP.xz - hl.xy;
          vec2 l = vec2(d.x * c - d.y * s, d.x * s + d.y * c); if (abs(l.x) < hl.z && abs(l.y) < hl.w) discard; }
        vec2 u = vWP.xz;
        vec3 g = texture2D(tGrass, u * 0.22).rgb * 0.55 + texture2D(tGrass, u * 0.047).rgb * 0.45;
        vec3 r = mix(texture2D(tRock, u * 0.09).rgb, texture2D(tRock, vec2(vWP.x + vWP.z, vWP.y) * 0.09).rgb, 0.5);
        vec3 sa = texture2D(tSand, u * 0.18).rgb; vec3 sn = texture2D(tSnow, u * 0.08).rgb;
        vec4 w = vSplat / max(0.001, dot(vSplat, vec4(1.0)));
        vec3 col = g * w.x + r * w.y + sa * w.z + sn * w.w;
        float m = texture2D(tMacro, u * 0.0032).r; col *= 0.72 + 0.56 * m;
        col *= mix(0.62, 1.0, smoothstep(-0.6, 0.5, vWP.y));
        float wave = 0.14 * sin(uTime * 0.9 + (vWP.x + vWP.z) * 0.04);
        float foam = (1.0 - smoothstep(0.0, 0.28, abs(vWP.y + 0.08 - wave))) * smoothstep(0.35, 0.75, texture2D(tMacro, u * 0.06 + vec2(uTime * 0.01)).r + 0.25);
        col = mix(col, vec3(0.93, 0.95, 0.96), foam * 0.75);
        diffuseColor.rgb *= col;`);
    };
    this.holeMats.push(mat);
    return mat;
  }
  addHole(x, z, hw, hd, rot) { this.holes.push({ v: new THREE.Vector4(x, z, hw, hd), rot }); }

  _build() {
    const S = this.scene;
    const sky = this.sky = new Sky(); sky.scale.setScalar(5000); S.add(sky);
    const su = sky.material.uniforms; su.turbidity.value = 7; su.rayleigh.value = 1.7; su.mieCoefficient.value = 0.005; su.mieDirectionalG.value = 0.86;
    this.sunDir = new THREE.Vector3();
    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x4a4234, 0.45); S.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xffe2bf, 3.6);
    sun.castShadow = true; sun.shadow.mapSize.set(this.hq ? 4096 : 1024, this.hq ? 4096 : 1024);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.near = 1; sc.far = 450;
    sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05;
    S.add(sun, sun.target);
    S.fog = new THREE.FogExp2(0xc4cdd6, 0.0013);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    if (this.hq) {
      const water = this.water = new Water(new THREE.PlaneGeometry(6000, 6000), {
        textureWidth: 512, textureHeight: 512, waterNormals: waterNormals(), sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xfff2dc,
        waterColor: 0x0b3346, distortionScale: 1.1, fog: true, alpha: 0.96,
      });
      water.rotation.x = -Math.PI / 2; water.material.uniforms.size.value = 5; S.add(water);
    } else {
      this.water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15485e, roughness: 0.1, metalness: 0.25 }));
      S.add(this.water);
    }
    this._setSun(25, 228);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x6d6650 })); bed.position.y = -10; S.add(bed);
    this.islandMeshes = [];
    this.grassSpots = [];
    for (const I of ISLANDS) {
      const size = I.r * 2.8, seg = this.hq ? 200 : 120;
      const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
      const pos = g.attributes.position, sp = new Float32Array(pos.count * 4);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + I.x, z = pos.getZ(i) + I.z, h = heightAt(x, z);
        pos.setY(i, h);
        const slope = slopeAt(x, z);
        let sand = 1 - smooth(0.6, 1.8, h), rock = smooth(0.55, 1.1, slope), snow = smooth(19, 24, h) * (1 - smooth(1.1, 1.6, slope));
        let grass = Math.max(0, 1 - sand - rock - snow);
        sp.set([grass, rock, sand, snow], i * 4);
        if (h > 1.8 && h < 18 && slope < 0.45 && i % 2 === 0) this.grassSpots.push(x, z);
      }
      g.setAttribute('splat', new THREE.BufferAttribute(sp, 4)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, this.terrainMaterial());
      m.position.set(I.x, 0, I.z); m.receiveShadow = true; S.add(m); this.islandMeshes.push(m);
      if (I.id === 'hub') {
        const ct = TEX.cobble.clone(); ct.repeat.set(12, 12); ct.needsUpdate = true;
        const plaza = new THREE.Mesh(new THREE.CircleGeometry(25, 64).rotateX(-Math.PI / 2), this.terrainMaterial({ map: ct, roughness: 0.85 }));
        plaza.geometry.setAttribute('splat', new THREE.BufferAttribute(new Float32Array(plaza.geometry.attributes.position.count * 4).fill(0), 4));
        plaza.material.onBeforeCompile = ((orig) => sh => { orig(sh); sh.fragmentShader = sh.fragmentShader.replace('diffuseColor.rgb *= col;', 'diffuseColor *= texture2D(map, vMapUv);'); })(plaza.material.onBeforeCompile);
        plaza.position.set(I.x, I.h + 0.04, I.z); plaza.receiveShadow = true; S.add(plaza);
      }
    }
    this._grass(); this._flowers(); this._trees(); this._town(); this._coast(); this._sportsArena(); this._clouds(); this._nightStars(); this._wildlife(); this._horizon();
  }

  _setSun(elev, azim) {
    this.sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(azim));
    this.sky.material.uniforms.sunPosition.value.copy(this.sunDir);
    if (this.water?.material?.uniforms?.sunDirection) this.water.material.uniforms.sunDirection.value.copy(this.sunDir).normalize();
    const skyScene = new THREE.Scene(), s2 = new Sky(); s2.scale.setScalar(1000);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG', 'sunPosition']) s2.material.uniforms[k].value = this.sky.material.uniforms[k].value;
    skyScene.add(s2);
    if (this.envRT) this.envRT.dispose();
    this.envRT = this.pmrem.fromScene(skyScene);
    this.scene.environment = this.envRT.texture;
  }

  _grass() {
    const spots = this.grassSpots, N = this.hq ? 160000 : 40000;
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.03, 0, 0, 0.03, 0, 0, 0.0, 0.3, 0, -0.025, 0, 0.02, 0.025, 0, -0.02, 0.015, 0.26, 0.015], 3));
    blade.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1], 2));
    blade.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0.3, 0, 1, 0.3, 0, 1, 0.3, 0, 1, -0.3, 0, 1, -0.3, 0, 1, -0.3], 3));
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, side: THREE.DoubleSide });
    this.grassU = { uTime: { value: 0 } };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = this.grassU.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 ip = instanceMatrix[3];
        float sway = sin(uTime * 1.6 + ip.x * 0.31 + ip.z * 0.23) * 0.13 + sin(uTime * 3.3 + ip.x * 1.7) * 0.03;
        transformed.x += sway * uv.y * uv.y; transformed.z += sway * 0.5 * uv.y * uv.y;`)
        .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n vColor *= mix(0.4, 0.95, uv.y);\n#endif');
    };
    const im = new THREE.InstancedMesh(blade, mat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    const n2 = spots.length / 2;
    for (let i = 0; i < N; i++) {
      const k = Math.floor(rnd() * n2) * 2;
      const x = spots[k] + (rnd() - 0.5) * 2.5, z = spots[k + 1] + (rnd() - 0.5) * 2.5, h = heightAt(x, z);
      if (!n2 || inFlat(x, z, -2) || Math.abs(Math.hypot(x - ROAD.x, z - ROAD.z) - ROAD.r) < ROAD.w / 2 + 2) { m.makeScale(0, 0, 0); im.setMatrixAt(i, m); im.setColorAt(i, c.set(0)); continue; }
      q.setFromAxisAngle(up, rnd() * 6.28); const sc = 0.7 + rnd() * 0.7;
      m.compose(p.set(x, h - 0.04, z), q, s.set(sc, sc * (0.7 + rnd() * 0.8), sc)); im.setMatrixAt(i, m);
      const dry = vnoise(x * 0.05, z * 0.05);
      im.setColorAt(i, c.setHSL(0.19 + rnd() * 0.05 + (1 - dry) * 0.03, 0.38 + rnd() * 0.12, 0.15 + rnd() * 0.07 + dry * 0.04));
    }
    im.receiveShadow = true; im.frustumCulled = false; this.scene.add(im); this.grassMesh = im;
  }

  _flowers() {
    const spots = this.grassSpots, N = this.hq ? 9000 : 3000, g = new THREE.PlaneGeometry(0.22, 0.22); g.translate(0, 0.16, 0);
    const geo = mergeGeometries([g, g.clone().rotateY(Math.PI / 2)]);
    const tex = canvasTex(64, 64, (c) => { for (let i = 0; i < 5; i++) { const a = i / 5 * 6.28; c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(32 + Math.cos(a) * 12, 32 + Math.sin(a) * 12, 10, 6, a, 0, 6.28); c.fill(); } c.fillStyle = '#f2c230'; c.beginPath(); c.arc(32, 32, 7, 0, 6.28); c.fill(); });
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.7 }), N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    const hues = [0.0, 0.13, 0.15, 0.62, 0.8, 0.95];
    for (let i = 0; i < N; i++) {
      const k = Math.floor(rnd() * spots.length / 2) * 2, x = spots[k] + (rnd() - 0.5) * 3, z = spots[k + 1] + (rnd() - 0.5) * 3;
      if (vnoise(x * 0.04, z * 0.04) < 0.55 || inFlat(x, z, -2) || Math.abs(Math.hypot(x - ROAD.x, z - ROAD.z) - ROAD.r) < ROAD.w / 2 + 2) { m.makeScale(0, 0, 0); im.setMatrixAt(i, m); continue; } // meadows only
      const sz = 0.7 + rnd() * 0.8; m.compose(p.set(x, heightAt(x, z) - 0.03, z), q.setFromAxisAngle(up, rnd() * 6.28), sc.set(sz, sz, sz)); im.setMatrixAt(i, m);
      im.setColorAt(i, c.setHSL(hues[Math.floor(rnd() * hues.length)], 0.75, 0.65));
    }
    im.receiveShadow = true; this.scene.add(im);
  }

  // ring road with sidewalks around the town, and cars driving on it
  _roads() {
    const R = ROAD, seg = 160, S = this.scene;
    const strip = (r0, r1, y0, mat) => {
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= seg; i++) { const a = i / seg * Math.PI * 2; for (const [r, v] of [[r0, 0], [r1, 1]]) { const x = R.x + Math.cos(a) * r, z = R.z + Math.sin(a) * r; pos.push(x, heightAt(x, z) + y0, z); uv.push(i / seg * (2 * Math.PI * R.r / 6), v); } }
      for (let i = 0; i < seg; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; S.add(m); return m;
    };
    const asphalt = canvasTex(256, 256, (g, w, h) => { noiseImage(g, w, 16, '#2b2c2f', '#45464a', 3); speckle(g, w, h, 0.2, 8000, 1); g.fillStyle = '#e8e2c8'; g.fillRect(0, h / 2 - 3, w * 0.5, 6); g.fillStyle = '#d8d8d8'; g.fillRect(0, 6, w, 5); g.fillRect(0, h - 11, w, 5); });
    asphalt.wrapS = THREE.RepeatWrapping;
    strip(R.r - R.w / 2, R.r + R.w / 2, 0.06, new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.85 }));
    const walk = this.texMat(TEX.tile, 4, 4, { color: 0xb5b0a6 });
    strip(R.r - R.w / 2 - 1.6, R.r - R.w / 2, 0.12, walk); strip(R.r + R.w / 2, R.r + R.w / 2 + 1.6, 0.12, walk);
    // paths from the square to each house
    const pathM = new THREE.MeshStandardMaterial({ color: 0x9b8f7c, roughness: 0.95 });
    for (const [hx, hz, , hh] of HOUSES) {
      if (Math.abs(hx) > 80 || Math.abs(hz) > 80) continue; // town houses only
      const d = Math.hypot(hx, hz), ux = hx / d, uz = hz / d, from = R.r + R.w / 2 + 1.6, to = d - 4;
      if (to <= from) continue;
      const g = new THREE.PlaneGeometry(1.6, to - from, 1, 8).rotateX(-Math.PI / 2), p2 = g.attributes.position;
      for (let i = 0; i < p2.count; i++) { const lx = p2.getX(i), lz = p2.getZ(i) + (from + to) / 2, x = ux * lz - uz * lx, z = uz * lz + ux * lx; p2.setXYZ(i, x, heightAt(x, z) + 0.1, z); }
      g.computeVertexNormals(); const m = new THREE.Mesh(g, pathM); m.receiveShadow = true; S.add(m);
    }
    // cars
    const carColors = [0xc0392b, 0x1f4b8f, 0xf2f2f2, 0x262626, 0xf1c40f, 0x2e8b57];
    const glass = new THREE.MeshStandardMaterial({ color: 0x1b2632, metalness: 0.8, roughness: 0.1 });
    const tyre = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 });
    const wheelG = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 16).rotateZ(Math.PI / 2);
    this.cars = [];
    for (let i = 0; i < 5; i++) {
      const car = new THREE.Group(), paint = new THREE.MeshStandardMaterial({ color: carColors[i % carColors.length], metalness: 0.6, roughness: 0.3 });
      const body = new THREE.Mesh(new RoundedBox(1.8, 0.7, 4.1, 3, 0.15), paint); body.position.y = 0.65;
      const cab = new THREE.Mesh(new RoundedBox(1.6, 0.6, 2.1, 3, 0.15), glass); cab.position.set(0, 1.25, -0.2);
      const roof = new THREE.Mesh(new RoundedBox(1.55, 0.08, 1.9, 2, 0.04), paint); roof.position.set(0, 1.56, -0.2);
      car.add(body, cab, roof);
      for (const [x, z] of [[-0.85, 1.3], [0.85, 1.3], [-0.85, -1.3], [0.85, -1.3]]) { const w = new THREE.Mesh(wheelG, tyre); w.position.set(x, 0.36, z); car.add(w); }
      for (const x of [-0.6, 0.6]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d0, emissiveIntensity: 1 })); l.position.set(x, 0.75, 2.06); car.add(l); }
      car.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      S.add(car);
      const dir = i % 2 ? 1 : -1, lane = R.r + dir * 1.5;
      this.cars.push({ car, a: i / 5 * Math.PI * 2, dir, lane, sp: 7 + rnd() * 3 });
    }
    this.updaters.push(dt => {
      const p = this.me?.group.position;
      for (const c of this.cars) {
        const x = Math.cos(c.a) * c.lane, z = Math.sin(c.a) * c.lane;
        const blocked = p && Math.hypot(p.x - (x + -Math.sin(c.a) * c.dir * 3), p.z - (z + Math.cos(c.a) * c.dir * 3)) < 2.6;
        c.v = (c.v ?? c.sp) + ((blocked ? 0 : c.sp) - (c.v ?? c.sp)) * Math.min(1, dt * (blocked ? 6 : 1.2));
        c.a += c.dir * c.v * dt / c.lane;
        c.car.position.set(x, heightAt(x, z), z); c.car.rotation.y = -c.a + (c.dir > 0 ? 0 : Math.PI);
      }
    });
  }

  // far-away mountain ranges on the horizon: two rings with a natural, noisy skyline
  _horizon() {
    this.horizonMats = [];
    [[2600, 0x9aa8b6, 260, 0.004], [2350, 0x7f8f9f, 170, 0.007]].forEach(([R, col, H, f], k) => {
      const seg = 720, pos = [], idx = [];
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2, x = Math.cos(a) * R, z = Math.sin(a) * R;
        const n = fbm(Math.cos(a) * R * f + k * 50, Math.sin(a) * R * f, 6), h = Math.max(8, Math.pow(n, 2.2) * H * 2.2 * (0.6 + 0.4 * Math.sin(a * 3 + k)));
        pos.push(x, -15, z, x, h, z);
      }
      for (let i = 0; i < seg; i++) { const v = i * 2; idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
      const m = new THREE.MeshBasicMaterial({ color: col, fog: false, side: THREE.DoubleSide }); this.horizonMats.push(m);
      this.scene.add(new THREE.Mesh(g, m));
    });
  }

  _foliageMat(tex) {
    const mat = new THREE.MeshStandardMaterial({ map: tex, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.8 });
    const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.42 });
    return { mat, depth };
  }

  _trees() {
    const S = this.scene, spots = [];
    for (const I of ISLANDS) {
      const n = I.id === 'sports' ? 120 : 300;
      for (let i = 0, tries = 0; i < n && tries < 6000; tries++) {
        const a = hash(tries, I.r) * Math.PI * 2, d = Math.sqrt(hash(I.x + tries, 7)) * I.r * 1.05;
        const x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = heightAt(x, z);
        if (h < 0.6 || h > 20 || slopeAt(x, z) > 0.8 || inFlat(x, z, 6)) continue;
        if (I.id === 'hub' && d < I.r * 0.74 && h > 1.8) continue; // keep the town open
        // clusters: skip some spots based on forest noise
        if (h > 1.8 && vnoise(x * 0.03 + 3, z * 0.03) < 0.35) continue;
        spots.push([x, h, z, hash(x, z)]); i++;
      }
    }
    // geometry builders
    const cards = (centers, size, cy) => {
      const geos = [];
      for (const [cx, cyy, cz, sc] of centers) for (let k = 0; k < 3; k++) {
        const pl = new THREE.PlaneGeometry(size * sc, size * sc);
        pl.rotateY(k * Math.PI / 3 + rnd()); pl.rotateX((rnd() - 0.5) * 0.6); pl.translate(cx, cyy, cz);
        geos.push(pl);
      }
      const g = mergeGeometries(geos), p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.set(p.getX(i), (p.getY(i) - cy) * 1.4, p.getZ(i)).normalize(); n.setXYZ(i, v.x, v.y + 0.25, v.z); }
      return g;
    };
    const broadCenters = []; for (let i = 0; i < 9; i++) { const a = rnd() * 6.28, r = rnd() * 1.4; broadCenters.push([Math.cos(a) * r, 4.2 + (rnd() - 0.3) * 2.2, Math.sin(a) * r, 0.8 + rnd() * 0.5]); }
    const broadG = cards(broadCenters, 3.0, 4.6);
    const pineG = (() => {
      const geos = [];
      for (let l = 0; l < 7; l++) { const y = 2.2 + l * 0.85, rad = 2.3 - l * 0.3; for (let k = 0; k < 5; k++) { const pl = new THREE.PlaneGeometry(rad * 2, 1.6); pl.translate(0, -0.3, rad * 0.5); pl.rotateX(0.45); pl.rotateY(k / 5 * 6.28 + l); pl.translate(0, y, 0); geos.push(pl); } }
      const g = mergeGeometries(geos), p = g.attributes.position, n = g.attributes.normal, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) { v.set(p.getX(i), 0.5, p.getZ(i)).normalize(); n.setXYZ(i, v.x, v.y, v.z); }
      return g;
    })();
    const palmFronds = (() => {
      const geos = [];
      for (let k = 0; k < 9; k++) { const pl = new THREE.PlaneGeometry(1.0, 3.6, 1, 6); const p = pl.attributes.position;
        for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 1.8; p.setXYZ(i, p.getX(i), -0.18 * y * y + 0.4 * y, y); }
        pl.rotateY(k / 9 * 6.28 + rnd() * 0.3); pl.translate(0.6, 6.2, 0); geos.push(pl); }
      return mergeGeometries(geos);
    })();
    const trunkG = new THREE.CylinderGeometry(0.13, 0.3, 4.2, 7).translate(0, 2.1, 0);
    const palmTrunkG = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 3.2, 0), new THREE.Vector3(0.6, 6.2, 0)), 8, 0.16, 6);
    const barkM = new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 1 });
    const leaves = this._foliageMat(TEX.leaves), needles = this._foliageMat(TEX.needles), fronds = this._foliageMat(TEX.frond);
    const kind = s => s[1] < 1.8 ? 'palm' : (s[1] > 11 || s[3] < 0.38) ? 'pine' : 'broad';
    const groups = { palm: spots.filter(s => kind(s) === 'palm'), pine: spots.filter(s => kind(s) === 'pine'), broad: spots.filter(s => kind(s) === 'broad') };
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    const inst = (geo, mat, list, scaleFn, colorFn, depth) => {
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach((s, i) => { const k = scaleFn(s); q.setFromAxisAngle(up, s[3] * 40); m.compose(p.set(s[0], s[1] - 0.15, s[2]), q, sc.set(k, k * (0.9 + s[3] * 0.3), k)); im.setMatrixAt(i, m); if (colorFn) im.setColorAt(i, colorFn(s)); });
      im.castShadow = true; im.receiveShadow = true; if (depth) im.customDepthMaterial = depth; S.add(im); return im;
    };
    const kB = s => 0.8 + s[3] * 0.6, kP = s => 0.85 + s[3] * 0.7, kPa = s => 0.8 + s[3] * 0.4;
    inst(trunkG, barkM, [...groups.broad, ...groups.pine], s => groups.pine.includes(s) ? kP(s) : kB(s));
    inst(broadG, leaves.mat, groups.broad, kB, s => c.setHSL(0, 0, 0.75 + s[3] * 0.4), leaves.depth);
    inst(pineG, needles.mat, groups.pine, kP, s => c.setHSL(0, 0, 0.8 + s[3] * 0.3), needles.depth);
    inst(palmTrunkG, barkM, groups.palm, kPa);
    inst(palmFronds, fronds.mat, groups.palm, kPa, null, fronds.depth);
    spots.forEach(s => this.solids.push({ x: s[0], z: s[2], r: 0.4 }));
    // rocks and bushes
    const lumpy = (geo, amt) => { const p2 = geo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p2.count; i++) { v.fromBufferAttribute(p2, i); const n = vnoise(v.x * 2.1 + 5, v.z * 2.1 + v.y * 1.7); v.multiplyScalar(1 + (n - 0.5) * amt); p2.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals(); return geo; };
    const rockM = new THREE.MeshStandardMaterial({ map: TEX.rock, roughness: 0.95 });
    const rs = [], bs = [];
    for (let i = 0; i < 900; i++) {
      const I = ISLANDS[i % ISLANDS.length], a = hash(i, 3) * 6.28, d = (0.2 + hash(i, 9) * 1.0) * I.r;
      const x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = heightAt(x, z);
      if (h < -0.8 || inFlat(x, z, 3)) continue;
      (i % 3 && h > 1.5 ? bs : rs).push([x, h, z, hash(x, i)]);
    }
    const rocks = new THREE.InstancedMesh(lumpy(new THREE.DodecahedronGeometry(1, 2), 0.5), rockM, rs.length);
    rs.forEach((s, i) => { const k = 0.3 + s[3] * 1.8; q.setFromEuler(new THREE.Euler(s[3] * 3, s[3] * 7, 0)); m.compose(p.set(s[0], s[1] - 0.25 * k, s[2]), q, sc.set(k, k * 0.65, k)); rocks.setMatrixAt(i, m); if (k > 1) this.solids.push({ x: s[0], z: s[2], r: k * 0.8 }); });
    const bushes = new THREE.InstancedMesh(cards([[0, 0.5, 0, 1], [0.5, 0.6, 0.3, 0.8], [-0.4, 0.55, -0.3, 0.8]], 1.6, 0.5), leaves.mat, bs.length);
    bs.forEach((s, i) => { const k = 0.6 + s[3]; m.compose(p.set(s[0], s[1] - 0.1, s[2]), q.setFromAxisAngle(up, s[3] * 9), sc.set(k, k * 0.8, k)); bushes.setMatrixAt(i, m); bushes.setColorAt(i, c.setHSL(0, 0, 0.7 + s[3] * 0.4)); });
    bushes.customDepthMaterial = leaves.depth;
    for (const im of [rocks, bushes]) { im.castShadow = im.receiveShadow = true; S.add(im); }
  }

  // ---------- architecture ----------
  box(x, y, z, w, h, d, mat, { rot = 0, solid = false, shadow = true } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat.isMaterial ? mat : new THREE.MeshStandardMaterial(mat));
    m.position.set(x, y, z); m.rotation.y = rot; m.castShadow = shadow; m.receiveShadow = true; this.scene.add(m);
    if (solid) this.solids.push({ x, z, hw: w / 2, hd: d / 2, rot });
    return m;
  }
  texMat(tex, w, h, extra = {}) { const t = tex.clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, Math.round(w / 8)), Math.max(1, Math.round(h / 8))); t.needsUpdate = true; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8, ...extra }); }

  // A building on the edge of an island's plaza, facing the centre, with a real doorway.
  building(I, angle, dist, { w = 22, d = 12, h = 12, tex = 'glass', name = '' } = {}) {
    const x = I.x + Math.cos(angle) * dist, z = I.z + Math.sin(angle) * dist, base = I.h, rot = -angle - Math.PI / 2;
    const ext = tex === 'glass' ? { metalness: 0.4, roughness: 0.3 } : {};
    const facade = this.texMat(TEX[tex], w, h, ext), side = this.texMat(TEX[tex], d, h, ext);
    const roof = new THREE.MeshStandardMaterial({ color: 0x45474c, roughness: 0.9 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h + 6, d), [side, side, roof, roof, facade, facade]);
    b.position.set(x, base + (h - 6) / 2, z); b.rotation.y = rot; b.castShadow = b.receiveShadow = true; this.scene.add(b);
    this.solids.push({ x, z, hw: w / 2, hd: d / 2, rot });
    const ox = Math.cos(angle), oz = Math.sin(angle), tx = -Math.sin(angle), tz = Math.cos(angle);
    const front = (k, t = 0) => [x - ox * (d / 2 + k) + tx * t, z - oz * (d / 2 + k) + tz * t];
    const steel = new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.7, roughness: 0.35 });
    this.box(x, base + h - 0.3, z, w + 0.5, 0.6, d + 0.5, { color: 0x55575c, roughness: 0.85 }, { rot });
    // roof units
    for (let k = -1; k <= 1; k += 2) this.box(x + tx * k * w * 0.25, base + h + 0.6, z + tz * k * w * 0.25, 2.4, 1.2, 1.8, { color: 0x8a8d92, metalness: 0.5, roughness: 0.5 }, { rot });
    // entrance: canopy, columns, glass doors, steps
    const [cx, cz] = front(1.6);
    this.box(cx, base + 3.6, cz, 7, 0.3, 3.2, steel, { rot });
    for (const s of [-1, 1]) { const [px, pz] = front(2.9, s * 3.2); this.box(px, base + 1.8, pz, 0.22, 3.6, 0.22, steel, { rot }); }
    const [dx, dz] = front(0.06);
    this.box(dx, base + 1.5, dz, 3.2, 3, 0.12, { color: 0x0f1820, metalness: 0.8, roughness: 0.1, envMapIntensity: 1.5 }, { rot, shadow: false });
    const [sx2, sz2] = front(0.8); this.box(sx2, base + 0.08, sz2, 7, 0.16, 1.6, { color: 0x9e9a92, roughness: 0.9 }, { rot });
    if (name) { const s = labelSprite(name, 1.0, { bg: null, weight: 700 }); const [nx, nz] = front(0.35); s.position.set(nx, base + h - 1.9, nz); this.scene.add(s); }
    const [ex, ez] = front(1.4);
    return { x: ex, z: ez, rot, angle };
  }

  // A glowing floor pad: stand on it to start a minigame.
  pad(x, z, label, color = 0x4aa8ff) {
    const h = heightAt(x, z), g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.5, 1.8, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.5, 48).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false }));
    ring.position.y = disc.position.y = 0.06;
    const lab = labelSprite(label, 0.5); lab.position.y = 2.4;
    g.add(ring, disc, lab); g.position.set(x, h, z); this.scene.add(g);
    this.updaters.push((dt, t) => { disc.material.opacity = 0.14 + Math.sin(t * 3) * 0.06; });
    return { x, z, y: h, group: g, lab, ring, disc };
  }
  setLabel(p, label, y = 2.4) { p.group.remove(p.lab); p.lab = labelSprite(label, 0.5); p.lab.position.y = y; p.group.add(p.lab); p.label = label; }

  // trigger areas: {x, z, r} or {test(x,y,z)}; onEnter fires once until the player leaves
  zone(def) { this.zones.push({ inside: false, ...def }); return def; }
  _zones() {
    const p = this.me.group.position;
    for (const zn of this.zones) {
      if (zn.off) continue;
      const inside = zn.test ? zn.test(p.x, p.y, p.z) : (Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r && Math.abs(p.y - (zn.y ?? p.y)) < 4);
      if (inside && !zn.inside) { zn.inside = true; zn.onEnter && zn.onEnter(zn); }
      else if (!inside && zn.inside) { zn.inside = false; zn.onLeave && zn.onLeave(zn); }
      if (inside && zn.onStay) zn.onStay(zn);
    }
  }
  groundAt(x, z, y = 1e9) { let best = null; for (const g of this.grounds) { const v = g(x, z, y); if (v !== null && (best === null || v > best)) best = v; } return best ?? heightAt(x, z); }

  // Metro entrance: a canopy over real stairs going down. Walk down to reach the platform.
  metroEntrance(x, z, rot, label, onBottom) {
    const h = heightAt(x, z), g = new THREE.Group();
    const steel = new THREE.MeshStandardMaterial({ color: 0x33383f, metalness: 0.75, roughness: 0.3 });
    const glass = new THREE.MeshStandardMaterial({ color: 0xa8c6d6, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.28 });
    const wallM = this.texMat(TEX.tile, 8, 4, { roughness: 0.5 });
    const add = (geo, mat, px, py, pz, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
    const D = 3.4; // stair depth
    add(new THREE.BoxGeometry(5.2, 0.18, 8), steel, 0, 3.1, -0.4);
    add(new THREE.BoxGeometry(5.0, 0.04, 7.8), glass, 0, 3.0, -0.4, false);
    for (const sx of [-2.5, 2.5]) for (const sz of [3.4, -4.2]) add(new THREE.BoxGeometry(0.16, 3.1, 0.16), steel, sx, 1.55, sz);
    for (const sx of [-2.05, 2.05]) { add(new THREE.BoxGeometry(0.06, 1.0, 6.6), glass, sx, 0.5, 0, false); add(new THREE.BoxGeometry(0.08, 0.06, 6.6), steel, sx, 1.02, 0); }
    add(new THREE.BoxGeometry(4.1, 1.0, 0.06), glass, 0, 0.5, -3.3, false);
    // stairwell walls below ground
    for (const sx of [-1.95, 1.95]) add(new THREE.BoxGeometry(0.1, D + 0.4, 7.2), wallM, sx, -D / 2, 0, false);
    add(new THREE.BoxGeometry(4, D + 0.4, 0.1), wallM, 0, -D / 2, -3.55, false);
    add(new THREE.BoxGeometry(4, 0.1, 1.2), new THREE.MeshBasicMaterial({ color: 0x0b0d10 }), 0, -D - 0.05, -2.9, false);
    const stairM = new THREE.MeshStandardMaterial({ color: 0x8e8b84, roughness: 0.85 });
    for (let i = 0; i < 14; i++) add(new THREE.BoxGeometry(3.8, 0.24, 0.5), stairM, 0, -0.12 - i * (D / 14), 3.05 - i * 0.43, false);
    const light = add(new THREE.BoxGeometry(3, 0.05, 0.2), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4e0, emissiveIntensity: 2 }), 0, -0.2, -3.45, false);
    // sign
    const sign = canvasTex(128, 128, c => { c.fillStyle = '#c8102e'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 84px Manrope, system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', 64, 70); });
    add(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 10), steel, 3.2, 2.2, 3.8);
    add(new THREE.CircleGeometry(0.55, 32), new THREE.MeshStandardMaterial({ map: sign, emissive: 0x220000, side: THREE.DoubleSide }), 3.2, 4.6, 3.8);
    const lab = labelSprite(label, 0.45); lab.position.set(0, 3.8, 3.6); g.add(lab);
    g.position.set(x, h, z); g.rotation.y = rot; this.scene.add(g);
    // terrain hole, stairs ground, side walls, bottom trigger
    const c = Math.cos(rot), s = Math.sin(rot);
    const toLocal = (wx, wz) => { const dx = wx - x, dz = wz - z; return [dx * c - dz * s, dx * s + dz * c]; };
    this.addHole(x, z, 1.9, 3.5, rot);
    this.grounds.push((wx, wz) => { const [lx, lz] = toLocal(wx, wz); if (Math.abs(lx) > 1.95 || lz > 3.3 || lz < -3.5) return null; return h - Math.min(D, Math.max(0, (3.2 - lz) / 6.2 * D)); });
    const wall = (lx, lz, hw, hd) => this.solids.push({ x: x + lx * c + lz * s, z: z - lx * s + lz * c, hw, hd, rot });
    wall(-2.05, 0, 0.1, 3.5); wall(2.05, 0, 0.1, 3.5); wall(0, -3.6, 2.1, 0.1);
    this.zone({ test: (wx, wy, wz) => { const [lx, lz] = toLocal(wx, wz); return Math.abs(lx) < 1.95 && lz < -2.5 && lz > -3.6 && wy < h - 2; }, onEnter: onBottom });
    const p = { x, z, y: h, rot, group: g, lab, metro: true, toWorld: (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c] };
    this.portals.push(p);
    return p;
  }

  _house([x, z, rot], i) {
    const base = heightAt(x, z), w = 7 + (i % 3), d = 6 + (i % 2), hgt = 3.2 + (i % 2) * 2.8;
    const walls = this.texMat(TEX.plaster, w, hgt, { color: new THREE.Color().setHSL(0.08 + (i * 0.07) % 0.1, 0.25, 0.8) });
    const body = this.box(x, base + hgt / 2 - 0.3, z, w, hgt + 0.6, d, walls, { rot });
    this.solids.push({ x, z, hw: w / 2, hd: d / 2, rot });
    const roofShape = new THREE.Shape(); roofShape.moveTo(-d / 2 - 0.5, 0); roofShape.lineTo(0, 2.4); roofShape.lineTo(d / 2 + 0.5, 0); roofShape.lineTo(-d / 2 - 0.5, 0);
    const rg = new THREE.ExtrudeGeometry(roofShape, { depth: w + 0.8, bevelEnabled: false }); rg.translate(0, 0, -(w + 0.8) / 2); rg.rotateY(Math.PI / 2);
    const rt = TEX.roof.clone(); rt.repeat.set(0.25, 0.25); rt.needsUpdate = true;
    const roof = new THREE.Mesh(rg, new THREE.MeshStandardMaterial({ map: rt, roughness: 0.8 })); roof.position.set(x, base + hgt, z); roof.rotation.y = rot; roof.castShadow = roof.receiveShadow = true; this.scene.add(roof);
    // windows + door on the front (+z local)
    const c = Math.cos(rot), s = Math.sin(rot), at = (lx, lz) => [x + lx * c + lz * s, z - lx * s + lz * c];
    const win = new THREE.MeshStandardMaterial({ color: 0x1a2733, metalness: 0.6, roughness: 0.1 }); this.windowMats ||= []; this.windowMats.push(win);
    for (const lx of [-w / 4, w / 4]) { const [wx, wz] = at(lx, d / 2 + 0.03); this.box(wx, base + 1.7, wz, 1.3, 1.1, 0.06, win, { rot, shadow: false }); if (hgt > 4) { const [ux, uz] = at(lx, d / 2 + 0.03); this.box(ux, base + 4.5, uz, 1.3, 1.1, 0.06, win, { rot, shadow: false }); } }
    const [ddx, ddz] = at(0, d / 2 + 0.03); this.box(ddx, base + 1.05, ddz, 1.1, 2.1, 0.08, { color: 0x4a2e1c, roughness: 0.7 }, { rot, shadow: false });
    const [chx, chz] = at(w / 3, -d / 4); this.box(chx, base + hgt + 2.2, chz, 0.6, 1.6, 0.6, { color: 0x6e5f55 }, { rot });
  }

  _town() {
    const S = this.scene, h0 = isl('hub').h;
    const stone = new THREE.MeshStandardMaterial({ map: TEX.rock, color: 0xd8d0c0, roughness: 0.75 });
    const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(...p)), seg);
    const basin = new THREE.Mesh(lathe([[0, 0], [5.4, 0], [5.4, 0.75], [5.0, 0.75], [5.0, 0.25], [0, 0.25]], 64), stone);
    basin.position.set(0, h0, 0); basin.castShadow = basin.receiveShadow = true; S.add(basin);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(5, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1f5566, roughness: 0.02, metalness: 0.6 }));
    pool.position.set(0, h0 + 0.58, 0); S.add(pool);
    const tier = new THREE.Mesh(lathe([[0, 0], [0.55, 0], [0.42, 2.2], [1.9, 2.4], [1.9, 2.75], [0.32, 2.75], [0.26, 3.7], [0, 3.9]], 48), stone);
    tier.position.set(0, h0, 0); tier.castShadow = true; S.add(tier);
    this.solids.push({ x: 0, z: 0, r: 5.6 });
    const N = 700, pg = new THREE.BufferGeometry(), pp = new Float32Array(N * 3), pv = [];
    for (let i = 0; i < N; i++) pv.push({ a: rnd() * 6.28, t: rnd() * 1.2, s: 1 + rnd() * 0.6 });
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    S.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xe6f6ff, size: 0.07, transparent: true, opacity: 0.7, depthWrite: false })));
    this.updaters.push(dt => { for (let i = 0; i < N; i++) { const q = pv[i]; q.t += dt; if (q.t > 1.2) q.t = 0; const r = q.t * 1.5 * q.s; pp[i * 3] = Math.cos(q.a) * r; pp[i * 3 + 1] = h0 + 3.9 + q.t * 3.2 - q.t * q.t * 5.6; pp[i * 3 + 2] = Math.sin(q.a) * r; } pg.attributes.position.needsUpdate = true; });
    const lampM = new THREE.MeshStandardMaterial({ color: 0x1f2226, metalness: 0.8, roughness: 0.35 });
    this.bulbM = new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd28a, emissiveIntensity: 0 });
    const wood = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.8 });
    for (const I of ISLANDS) {
      if (I.id !== 'hub') continue;
      for (let k = 0; k < 12; k++) {
        const a = k / 12 * Math.PI * 2 + 0.26, x = I.x + Math.cos(a) * 22.5, z = I.z + Math.sin(a) * 22.5, y = I.h;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.2, 8), lampM); pole.position.set(x, y + 2.1, z); pole.castShadow = true; S.add(pole);
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.06), lampM); arm.position.set(x, y + 4.15, z); arm.rotation.y = -a; S.add(arm);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), this.bulbM); bulb.position.set(x, y + 4.0, z); S.add(bulb);
        this.solids.push({ x, z, r: 0.2 });
        if (k % 3 === 1) { const bx = I.x + Math.cos(a + 0.12) * 23.6, bz = I.z + Math.sin(a + 0.12) * 23.6, r = -a - 0.12 + Math.PI / 2; this.box(bx, y + 0.45, bz, 1.8, 0.08, 0.5, wood, { rot: r }); this.box(bx, y + 0.75, bz + 0, 1.8, 0.5, 0.06, wood, { rot: r }); this.box(bx, y + 0.22, bz, 1.6, 0.44, 0.06, lampM, { rot: r }); }
      }
      // planters with flowers
      for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28 + 0.8, x = I.x + Math.cos(a) * 12, z = I.z + Math.sin(a) * 12; this.box(x, I.h + 0.35, z, 2.4, 0.7, 2.4, stone); this.solids.push({ x, z, r: 1.6 });
        for (let f = 0; f < 18; f++) { const fl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 6, 4), new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(rnd(), 0.7, 0.6) })); fl.position.set(x + (rnd() - 0.5) * 2, I.h + 0.8, z + (rnd() - 0.5) * 2); S.add(fl); } }
    }
    HOUSES.forEach((hs, i) => this._house(hs, i));
    // lighthouse on the hub's south-west point
    const lx = 470 + 70, lz = 90 + 60, lh = heightAt(lx, lz);
    const stripes = canvasTex(64, 256, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#b8241c' : '#f2efe8'; g.fillRect(0, i * h / 8, w, h / 8); } });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 2.2, 16, 24), new THREE.MeshStandardMaterial({ map: stripes, roughness: 0.6 })); tower.position.set(lx, lh + 8, lz); tower.castShadow = true; S.add(tower);
    const lamp = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.6, 16), new THREE.MeshStandardMaterial({ color: 0xfff6d0, emissive: 0xffe9a0, emissiveIntensity: 1.5, transparent: true, opacity: 0.9 })); lamp.position.set(lx, lh + 16.8, lz); S.add(lamp);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.6, 16), new THREE.MeshStandardMaterial({ color: 0x22262b, metalness: 0.6 })); cap.position.set(lx, lh + 18.4, lz); S.add(cap);
    this.solids.push({ x: lx, z: lz, r: 2.4 });
    this.beam = new THREE.Mesh(new THREE.ConeGeometry(4, 60, 24, 1, true).translate(0, -30, 0).rotateZ(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xfff2c0, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    this.beam.position.set(lx, lh + 16.8, lz); S.add(this.beam);
    this.updaters.push((dt, t) => { this.beam.rotation.y = t * 0.6; });
  }

  // piers and boats on each island's shore
  _coast() {
    const S = this.scene, wood = new THREE.MeshStandardMaterial({ map: TEX.wood, roughness: 0.85 });
    this.boats = [];
    const hullG = (() => { const sh = new THREE.Shape(); sh.moveTo(-2.2, 0); sh.quadraticCurveTo(-2.2, -0.9, 0, -1.0); sh.quadraticCurveTo(2.2, -0.9, 2.2, 0); sh.lineTo(-2.2, 0); const g = new THREE.ExtrudeGeometry(sh, { depth: 1.8, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.3, bevelSegments: 3 }); g.translate(0, 0, -0.9); g.rotateY(Math.PI / 2); return g; })();
    for (const I of ISLANDS) {
      const a = Math.atan2(-I.z, -I.x) + (I.id === 'hub' ? 2.2 : 0.7);
      let r = I.r * 0.5; while (heightAt(I.x + Math.cos(a) * r, I.z + Math.sin(a) * r) > 0.2 && r < I.r * 1.4) r += 1;
      const sx = I.x + Math.cos(a) * (r - 4), sz = I.z + Math.sin(a) * (r - 4), rot = -a + Math.PI / 2, L = 26;
      const cx = sx + Math.cos(a) * L / 2, cz = sz + Math.sin(a) * L / 2;
      this.box(cx, 0.9, cz, 2.6, 0.18, L, wood, { rot });
      for (let k = 0; k <= L; k += 4) for (const side of [-1.1, 1.1]) { const px = sx + Math.cos(a) * k - Math.sin(a) * side, pz = sz + Math.sin(a) * k + Math.cos(a) * side; this.box(px, -1, pz, 0.22, 4, 0.22, wood); }
      this.grounds.push((wx, wz) => { const dx = wx - cx, dz = wz - cz, c = Math.cos(rot), s = Math.sin(rot), lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) < 1.3 && Math.abs(lz) < L / 2 ? Math.max(1.0, heightAt(wx, wz)) : null; });
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(hullG, new THREE.MeshStandardMaterial({ color: [0xf2f0ea, 0x1f3b5c, 0x9c2b2b][ISLANDS.indexOf(I) % 3], roughness: 0.5 })); hull.castShadow = true; boat.add(hull);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 6, 8), wood); mast.position.y = 3; boat.add(mast);
      const sail = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 4.6), new THREE.MeshStandardMaterial({ color: 0xf6f3ea, side: THREE.DoubleSide, roughness: 0.9 })); sail.position.set(0, 3.4, 1.2); sail.rotation.y = Math.PI / 2; boat.add(sail);
      const bx = sx + Math.cos(a) * (L - 2) - Math.sin(a) * 3.2, bz = sz + Math.sin(a) * (L - 2) + Math.cos(a) * 3.2;
      boat.position.set(bx, 0.2, bz); boat.rotation.y = rot; S.add(boat); this.boats.push({ g: boat, y: 0.2, p: rnd() * 6 });
    }
    // sailboats out at sea
    for (let i = 0; i < 6; i++) {
      const boat = this.boats[i % this.boats.length].g.clone(); const R = 380 + i * 60, sp = 0.01 + rnd() * 0.01, ph = rnd() * 6.28;
      this.scene.add(boat); this.boats.push({ g: boat, y: 0.2, p: rnd() * 6, orbit: { R, sp, ph } });
    }
    this.updaters.push((dt, t) => this.boats.forEach(b => {
      if (b.orbit) { const a = b.orbit.ph + t * b.orbit.sp; b.g.position.set(Math.cos(a) * b.orbit.R, b.y, Math.sin(a) * b.orbit.R); b.g.rotation.y = -a; }
      b.g.position.y = b.y + Math.sin(t * 1.3 + b.p) * 0.12; b.g.rotation.z = Math.sin(t * 0.9 + b.p) * 0.04;
    }));
  }

  _sportsArena() {
    const S = this.scene, P = PITCH;
    const c = document.createElement('canvas'); c.width = 2048; c.height = 1280; const g = c.getContext('2d');
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#356e29' : '#3e7c30'; g.fillRect(i * c.width / 16, 0, c.width / 16 + 1, c.height); }
    speckle(g, 2048, 1280, 0.08, 60000);
    g.strokeStyle = 'rgba(255,255,255,0.88)'; g.lineWidth = 9; const W = c.width, Hh = c.height, m = 28;
    g.strokeRect(m, m, W - 2 * m, Hh - 2 * m); g.beginPath(); g.moveTo(W / 2, m); g.lineTo(W / 2, Hh - m); g.stroke();
    g.beginPath(); g.arc(W / 2, Hh / 2, 160, 0, 7); g.stroke();
    g.strokeRect(m, Hh / 2 - 300, 300, 600); g.strokeRect(W - m - 300, Hh / 2 - 300, 300, 600); g.strokeRect(m, Hh / 2 - 140, 110, 280); g.strokeRect(W - m - 110, Hh / 2 - 140, 110, 280);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const field = new THREE.Mesh(new THREE.PlaneGeometry(P.hw * 2 + 2, P.hd * 2 + 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    field.position.set(P.x, P.h + 0.03, P.z); field.receiveShadow = true; S.add(field);
    const white = { color: 0xf2f2f2, roughness: 0.4 };
    for (const sx of [-1, 1]) {
      const gx = P.x + sx * P.hw;
      this.box(gx, P.h + 1.22, P.z - 3.66, 0.12, 2.44, 0.12, white); this.box(gx, P.h + 1.22, P.z + 3.66, 0.12, 2.44, 0.12, white);
      this.box(gx, P.h + 2.44, P.z, 0.12, 0.12, 7.44, white);
      const net = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.44, 7.32), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.25 }));
      net.position.set(gx + sx * 0.85, P.h + 1.22, P.z); S.add(net);
    }
    const conc = this.texMat(TEX.concrete, 60, 4), seat = new THREE.MeshStandardMaterial({ color: 0x1f4d8c, roughness: 0.55 });
    for (const sz of [-1, 1]) for (let k = 0; k < 7; k++) {
      this.box(P.x, P.h + 0.3 + k * 0.6, P.z + sz * (P.hd + 4 + k * 0.9), P.hw * 2 + 6, 0.6 + k * 1.2, 0.9, conc, { solid: true });
      this.box(P.x, P.h + 0.65 + k * 1.2, P.z + sz * (P.hd + 4 + k * 0.9), P.hw * 2 + 4, 0.2, 0.45, seat);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = P.x + sx * (P.hw + 6), z = P.z + sz * (P.hd + 11);
      this.box(x, P.h + 10, z, 0.45, 20, 0.45, { color: 0x6b6f75, metalness: 0.6 }, { solid: true });
      this.box(x, P.h + 20, z, 3.4, 1.6, 0.4, { color: 0xeeeeee, emissive: 0xffffff, emissiveIntensity: 0.8 });
    }
    const C = COURT;
    const court = new THREE.Mesh(new THREE.PlaneGeometry(C.hw * 2, C.hd * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: this.texMat(TEX.wood, C.hw * 2, C.hd * 2).map, color: 0xd9a066, roughness: 0.35 }));
    court.position.set(C.x, C.h + 0.03, C.z); court.receiveShadow = true; S.add(court);
    for (const [sz, col] of [[-1, 0x9c2b2b], [1, 0x24508f]]) { const mm = new THREE.Mesh(new THREE.PlaneGeometry(C.hw * 2 - 1, C.hd - 0.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.3 })); mm.position.set(C.x, C.h + 0.05, C.z + sz * C.hd / 2); S.add(mm); }
    this.box(C.x, C.h + 0.06, C.z, C.hw * 2, 0.02, 0.15, white);
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 128; const bg = bc.getContext('2d');
    bg.fillStyle = '#f4f4f4'; bg.fillRect(0, 0, 256, 128); bg.fillStyle = '#1a1a1a';
    for (let i = 0; i < 12; i++) { bg.beginPath(); const x = (i % 6) * 46 + (i > 5 ? 23 : 0), y = i > 5 ? 90 : 38; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; bg.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); } bg.fill(); }
    const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshStandardMaterial({ map: btex, roughness: 0.45 }));
    this.ball.castShadow = true; this.ball.position.set(P.x, P.h + 0.3, P.z); S.add(this.ball);
  }

  _clouds() {
    const tex = canvasTex(256, 256, g => { for (let i = 0; i < 40; i++) { const x = 128 + (rnd() - 0.5) * 120, y = 128 + (rnd() - 0.5) * 50, r = 30 + rnd() * 50; const gr = g.createRadialGradient(x, y, 2, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 256, 256); } });
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 });
    this.clouds = [];
    for (let i = 0; i < 45; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 6; k++) { const s = new THREE.Sprite(mat); const sz = 80 + hash(i, k) * 90; s.scale.set(sz * 1.8, sz * 0.8, 1); s.position.set((hash(k, i) - 0.5) * 150, hash(i * 3, k) * 18, (hash(k, i * 7) - 0.5) * 60); g.add(s); }
      g.position.set((hash(i, 1) - 0.5) * 3400, 220 + hash(i, 2) * 140, (hash(i, 3) - 0.5) * 3400);
      this.scene.add(g); this.clouds.push(g);
    }
    this.cloudMat = mat;
    this.updaters.push(dt => this.clouds.forEach(c => { c.position.x += dt * 4; if (c.position.x > 1700) c.position.x = -1700; }));
  }
  _nightStars() {
    const N = 2500, g = new THREE.BufferGeometry(), p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y); v.multiplyScalar(3000); p.set([v.x, v.y, v.z], i * 3); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.starsPts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }));
    this.scene.add(this.starsPts);
  }
  _wildlife() {
    // seagulls circling the islands
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.3, 0, 0, -0.3, -1, 0.15, 0, 0, 0, 0.3, 0, 0, -0.3, 1, 0.15, 0], 3)); wing.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, side: THREE.DoubleSide, roughness: 0.8 });
    this.birds = [];
    for (let i = 0; i < 24; i++) {
      const I = ISLANDS[i % ISLANDS.length], b = new THREE.Mesh(wing.clone(), mat); b.scale.setScalar(0.7);
      this.scene.add(b); this.birds.push({ b, I, R: 30 + rnd() * 50, h: 22 + rnd() * 25, sp: 0.15 + rnd() * 0.15, ph: rnd() * 6.28 });
    }
    this.updaters.push((dt, t) => this.birds.forEach(o => {
      const a = o.ph + t * o.sp; o.b.position.set(o.I.x + Math.cos(a) * o.R, o.h + Math.sin(t + o.ph) * 2, o.I.z + Math.sin(a) * o.R); o.b.rotation.y = -a;
      const p = o.b.geometry.attributes.position, f = Math.sin(t * 8 + o.ph) * 0.35; p.setY(2, f); p.setY(5, f); p.needsUpdate = true;
    }));
  }

  // ---------- fun: trampolines, jump pads, obby tower, hidden stars ----------
  trampoline(x, z, onBounce) {
    const h = heightAt(x, z), g = new THREE.Group(), top = h + 0.7;
    const frame = new THREE.Mesh(new THREE.TorusGeometry(2, 0.12, 10, 40).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2e6fd1, roughness: 0.4 })); frame.position.y = 0.7;
    const matt = new THREE.Mesh(new THREE.CircleGeometry(1.9, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.6 })); matt.position.y = 0.66;
    g.add(frame, matt);
    for (let k = 0; k < 6; k++) { const a = k / 6 * 6.28, leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.7 })); leg.position.set(Math.cos(a) * 1.9, 0.35, Math.sin(a) * 1.9); g.add(leg); }
    g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    g.position.set(x, h, z); this.scene.add(g);
    this.grounds.push((wx, wz, wy) => Math.hypot(wx - x, wz - z) < 2.05 && wy >= top - 0.6 ? top : null);
    this.zone({ test: (px, py, pz) => Math.hypot(px - x, pz - z) < 1.9 && py <= top + 0.05 && py >= top - 0.3 && this.onGround,
      onEnter: () => { this.vel.y = 15; this.onGround = false; matt.position.y = 0.45; setTimeout(() => (matt.position.y = 0.66), 150); onBounce && onBounce(); } });
  }
  jumpPad(x, z, onJump, power = 20) {
    const h = heightAt(x, z), pad = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.3, 0.25, 32), new THREE.MeshStandardMaterial({ color: 0x1b1d21, emissive: 0x39d353, emissiveIntensity: 1.6, roughness: 0.3 }));
    pad.position.set(x, h + 0.12, z); pad.receiveShadow = true; this.scene.add(pad);
    const arrow = labelSprite('▲', 0.8, { bg: null, color: '#39d353' }); arrow.position.set(x, h + 1.2, z); this.scene.add(arrow);
    this.updaters.push((dt, t) => { arrow.position.y = h + 1.1 + Math.sin(t * 4) * 0.25; });
    this.zone({ x, z, r: 1.2, y: h, onEnter: () => { this.vel.y = power; this.onGround = false; onJump && onJump(); } });
  }
  // A spiral parkour tower. Returns the chest position at the top.
  obby(cx, cz, onWin) {
    const base = heightAt(cx, cz), S = this.scene, steps = 30, R = 8;
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, steps * 0.9 + 4, 24), this.texMat(TEX.concrete, 14, 30)); pillar.position.set(cx, base + (steps * 0.9 + 4) / 2, cz); pillar.castShadow = pillar.receiveShadow = true; S.add(pillar);
    this.solids.push({ x: cx, z: cz, r: 2.6 });
    const colors = [0xe74c3c, 0xf39c12, 0xf1c40f, 0x2ecc71, 0x3498db, 0x9b59b6];
    let top = base;
    for (let i = 0; i < steps; i++) {
      const a = i * 0.56, x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R, y = base + 0.9 + i * 0.9, w = i % 5 === 4 ? 1.4 : 2.2;
      const plat = new THREE.Mesh(new RoundedBox(w, 0.4, w), new THREE.MeshStandardMaterial({ color: colors[i % 6], roughness: 0.35 }));
      plat.position.set(x, y - 0.2, z); plat.castShadow = plat.receiveShadow = true; S.add(plat);
      this.grounds.push((wx, wz, wy) => Math.abs(wx - x) < w / 2 + 0.15 && Math.abs(wz - z) < w / 2 + 0.15 && wy >= y - 0.6 ? y : null);
      top = y;
    }
    const tY = base + steps * 0.9 + 4, deck = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 0.4, 32), new THREE.MeshStandardMaterial({ color: 0xd9d4c7, roughness: 0.6 }));
    deck.position.set(cx, tY - 0.2, cz); deck.castShadow = deck.receiveShadow = true; S.add(deck);
    // last platform to the deck
    const la = steps * 0.56, lx = cx + Math.cos(la) * 5.6, lz = cz + Math.sin(la) * 5.6;
    this.grounds.push((wx, wz, wy) => Math.hypot(wx - cx, wz - cz) < 4.1 && wy >= tY - 0.6 ? tY : null);
    const chest = new THREE.Group();
    const cb = new THREE.Mesh(new RoundedBox(1.2, 0.8, 0.8), new THREE.MeshStandardMaterial({ color: 0x8a5a2b, roughness: 0.6 })); cb.position.y = 0.4;
    const lid = new THREE.Mesh(new RoundedBox(1.25, 0.3, 0.85), new THREE.MeshStandardMaterial({ color: 0xf5c518, metalness: 0.8, roughness: 0.25, emissive: 0x553300 })); lid.position.y = 0.95;
    chest.add(cb, lid); chest.position.set(cx, tY, cz); chest.traverse(o => { if (o.isMesh) o.castShadow = true; }); S.add(chest);
    const flag = labelSprite('🏆', 1.2, { bg: null }); flag.position.set(cx, tY + 2.4, cz); S.add(flag);
    this.updaters.push((dt, t) => { flag.position.y = tY + 2.3 + Math.sin(t * 2) * 0.2; lid.rotation.x = Math.max(0, Math.sin(t)) * -0.3; });
    this.zone({ x: cx, z: cz, r: 2.2, test: (px, py, pz) => Math.hypot(px - cx, pz - cz) < 2.4 && py > tY - 0.5, onEnter: () => onWin && onWin() });
    const sign = labelSprite('OBBY TOWER', 0.9, { bg: 'rgba(14,18,26,0.75)', weight: 800 }); sign.position.set(cx + R + 1, base + 3, cz); S.add(sign);
    return { x: cx, z: cz, top: tY };
  }
  hiddenStars(points, isTaken, onCollect) {
    const geo = new THREE.OctahedronGeometry(0.45, 0), mat = new THREE.MeshStandardMaterial({ color: 0xffd447, emissive: 0xffa200, emissiveIntensity: 2.2, metalness: 0.8, roughness: 0.2 });
    points.forEach(([x, z], i) => {
      if (isTaken(i)) return;
      const y = heightAt(x, z) + 1.1, m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.y = 1.4; this.scene.add(m);
      this.updaters.push((dt, t) => { if (!m.parent) return true; m.rotation.y = t * 2 + i; m.position.y = y + Math.sin(t * 2 + i) * 0.2; });
      const zn = this.zone({ x, z, r: 1.4, onEnter: () => { this.scene.remove(m); zn.off = true; onCollect(i); } });
    });
  }

  // ---------- interiors (metro platform, research station) ----------
  addInterior(def) { this.interiors.push(def); return def; }
  interiorAt(x, y, z) { for (const b of this.buildings) { const I = b.interior(x, y, z); if (I) return I; } return this.interiors.find(I => y < I.floor + 8 && y > I.floor - 3 && x >= I.minX && x <= I.maxX && z >= I.minZ && z <= I.maxZ); }

  // ---------- player ----------
  setPlayer(avatar) { this.me = avatar; this.scene.add(avatar.group); this.teleport(-13, 4, -Math.PI / 2 + 0.3); }
  replacePlayer(avatar) { this.me.removePet(); const old = this.me.group; avatar.group.position.copy(old.position); avatar.group.rotation.y = old.rotation.y; this.scene.remove(old); this.me = avatar; this.scene.add(avatar.group); }
  teleport(x, z, yaw, y) {
    const p = this.me.group.position, I = y !== undefined ? this.interiorAt(x, y, z) : null;
    p.set(x, I ? I.floor : (y !== undefined && y < 0 ? y : this.groundAt(x, z) + 0.2), z); this.vel.set(0, 0, 0);
    if (yaw !== undefined) { this.yaw = yaw; this.me.group.rotation.y = yaw + Math.PI; }
    this.camera.position.set(p.x + Math.sin(this.yaw) * 5, p.y + 2.5, p.z + Math.cos(this.yaw) * 5);
    this.zones.forEach(zn => { zn.inside = zn.test ? zn.test(p.x, p.y, p.z) : Math.hypot(p.x - zn.x, p.z - zn.z) < zn.r; });
  }

  _input() {
    addEventListener('keydown', e => { if (this.inputLocked || /INPUT|TEXTAREA/.test(e.target.tagName)) return; this.keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    let drag = null; const c = this.renderer.domElement;
    c.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    addEventListener('pointerup', e => { if (drag && drag.id === e.pointerId) drag = null; });
    addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      this.yaw -= (e.clientX - drag.x) * 0.005; this.pitch = Math.min(1.2, Math.max(-0.35, this.pitch + (e.clientY - drag.y) * 0.004));
      drag.x = e.clientX; drag.y = e.clientY;
    });
    c.addEventListener('wheel', e => { this.dist = Math.min(18, Math.max(2.5, this.dist + e.deltaY * 0.008)); }, { passive: true });
  }

  _collide(nx, nz, py = 0) {
    for (const s of this.solids) {
      if (s.y0 !== undefined && (py < s.y0 || py > s.y1)) continue;
      if (s.r) { const dx = nx - s.x, dz = nz - s.z; if (Math.abs(dx) > s.r + 1 || Math.abs(dz) > s.r + 1) continue; const d = Math.hypot(dx, dz), r = s.r + 0.3; if (d < r && d > 0.0001) { nx = s.x + dx / d * r; nz = s.z + dz / d * r; } continue; }
      if (Math.abs(nx - s.x) > s.hw + s.hd + 2 || Math.abs(nz - s.z) > s.hw + s.hd + 2) continue;
      const c = Math.cos(s.rot || 0), sn = Math.sin(s.rot || 0), dx = nx - s.x, dz = nz - s.z;
      let lx = dx * c - dz * sn, lz = dx * sn + dz * c; const ex = s.hw + 0.3, ez = s.hd + 0.3;
      if (Math.abs(lx) < ex && Math.abs(lz) < ez) {
        if (ex - Math.abs(lx) < ez - Math.abs(lz)) lx = Math.sign(lx) * ex; else lz = Math.sign(lz) * ez;
        nx = s.x + lx * c + lz * sn; nz = s.z - lx * sn + lz * c;
      }
    }
    return [nx, nz];
  }

  _physics(dt) {
    const me = this.me, p = me.group.position, E = this.effects, now = performance.now();
    let ix = 0, iz = 0;
    if (!this.inputLocked && now > this.frozenUntil) {
      const k = this.keys;
      iz = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + this.joy.y;
      ix = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + this.joy.x;
    }
    const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
    if (this.carrier) { const c = this.carrier; if (c.update(dt, p, me) === true) { this.carrier = null; c.onEnd && c.onEnd(); } this.vel.set(0, 0, 0); this.inside = this.interiorAt(p.x, p.y, p.z); this.speedNow = 0; return; }
    const inside = this.interiorAt(p.x, p.y, p.z);
    const ground0 = inside ? (inside.floorAt ? inside.floorAt(p.x, p.z) : inside.floor) : this.groundAt(p.x, p.z, p.y), swim = !inside && ground0 < -1.2;
    const speed = (this.keys.ShiftLeft || this.keys.ShiftRight || this.joyRun ? 7.5 : 4.2) * (E.speed ? 1.9 : 1) * (swim ? 0.55 : 1);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    const mx = (fx * iz - fz * ix) * speed, mz = (fz * iz + fx * ix) * speed;
    const acc = this.onGround || swim ? 12 : 3;
    this.vel.x += (mx - this.vel.x) * Math.min(1, dt * acc); this.vel.z += (mz - this.vel.z) * Math.min(1, dt * acc);
    if ((this.keys.Space || this.joyJump) && (this.onGround || swim) && !this.inputLocked && now > this.frozenUntil) { this.vel.y = E.lowGravity ? 8 : 7.2; this.onGround = false; this.onJump && this.onJump(); }
    this.joyJump = false;
    this.vel.y -= (E.lowGravity ? 5 : 22) * dt;
    let nx = p.x + this.vel.x * dt, nz = p.z + this.vel.z * dt;
    if (inside) {
      if (!inside.noClamp) { nx = Math.min(inside.maxX - 0.4, Math.max(inside.minX + 0.4, nx)); nz = Math.min(inside.maxZ - 0.4, Math.max(inside.minZ + 0.4, nz)); }
      for (const w of inside.walls || []) { const ex = w.hw + 0.3, ez = w.hd + 0.3, dx = nx - w.x, dz = nz - w.z; if (Math.abs(dx) < ex && Math.abs(dz) < ez) { if (ex - Math.abs(dx) < ez - Math.abs(dz)) nx = w.x + Math.sign(dx) * ex; else nz = w.z + Math.sign(dz) * ez; } }
    } else {
      [nx, nz] = this._collide(nx, nz, p.y);
      const R = 1400, dc = Math.hypot(nx, nz); if (dc > R) { nx *= R / dc; nz *= R / dc; }
      if (this.groundAt(nx, nz, p.y) - ground0 > 0.6 && this.onGround) { nx = p.x; nz = p.z; }
    }
    if (this.constrain) [nx, nz] = this.constrain(nx, nz);
    p.x = nx; p.z = nz; p.y += this.vel.y * dt;
    const floor = inside ? (inside.floorAt ? inside.floorAt(p.x, p.z) : inside.floor) : Math.max(this.groundAt(p.x, p.z, p.y + 0.05), swim ? -1.45 + Math.sin(now / 500) * 0.06 : -99);
    if (p.y <= floor) { p.y = floor; this.vel.y = Math.max(0, this.vel.y); this.onGround = true; }
    else if (p.y > floor + 0.35) this.onGround = false; else if (this.vel.y <= 0) { p.y = floor; this.onGround = true; }
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.4) { const target = Math.atan2(this.vel.x, this.vel.z); let d = target - me.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); me.group.rotation.y += d * Math.min(1, dt * 10); }
    me.animate(hs, dt, !this.onGround && !swim); me.updatePet(this.scene, dt);
    const sc = E.giant ? 2.2 : 1; me.group.scale.setScalar(me.group.scale.x + (sc - me.group.scale.x) * Math.min(1, dt * 4));
    this.speedNow = hs; this.inside = inside;
  }

  _camera(dt) {
    const p = this.cameraOverride ? this.camera.position : this.me.group.position;
    this.sun.position.set(p.x + this.sunDir.x * 180, p.y + this.sunDir.y * 180, p.z + this.sunDir.z * 180); this.sun.target.position.copy(p);
    if (this.cameraOverride) { this.cameraOverride(this.camera, dt); return; }
    const s = this.me.group.scale.x, I = this.inside, under = !I && p.y < heightAt(p.x, p.z) - 0.8;
    const d = (I || under ? Math.min(this.dist, 4) : this.dist) * (0.75 + s * 0.25), cp = Math.cos(this.pitch);
    const target = new THREE.Vector3(p.x + Math.sin(this.yaw) * cp * d, p.y + 1.6 * s + Math.sin(this.pitch) * d, p.z + Math.cos(this.yaw) * cp * d);
    if (I) { target.y = Math.min(I.floor + (I.ceil || 4.5) - 0.3, Math.max(I.floor + 0.6, target.y)); target.x = Math.min(I.maxX - 0.3, Math.max(I.minX + 0.3, target.x)); target.z = Math.min(I.maxZ - 0.3, Math.max(I.minZ + 0.3, target.z)); }
    else if (!under) { const gh = this.groundAt(target.x, target.z) + 0.5; if (target.y < gh) target.y = gh; if (target.y < -0.6) target.y = -0.6; }
    this.camera.position.lerp(target, Math.min(1, dt * 10));
    this.camera.lookAt(p.x, p.y + 1.45 * s, p.z);
  }

  // ---------- remote players ----------
  upsertRemote(id, d, makeAvatar) {
    let r = this.remotes[id];
    if (!d) { if (r) { this.scene.remove(r.av.group); r.av.removePet(); delete this.remotes[id]; } return; }
    const sig = JSON.stringify([d.name, d.role, d.avatar]);
    if (r && r.sig !== sig) { this.scene.remove(r.av.group); r.av.removePet(); delete this.remotes[id]; r = null; }
    if (!r) {
      r = this.remotes[id] = { av: makeAvatar(d), sig, pos: new THREE.Vector3(d.x || 0, d.y ?? -500, d.z || 0) };
      r.av.group.position.copy(r.pos); this.scene.add(r.av.group);
    }
    r.d = d; if (d.x !== undefined) r.pos.set(d.x, d.y, d.z);
  }
  _remotes(dt) {
    for (const id in this.remotes) {
      const r = this.remotes[id], g = r.av.group, d = r.d;
      const before = g.position.clone();
      if (g.position.distanceTo(r.pos) > 25) g.position.copy(r.pos); else g.position.lerp(r.pos, Math.min(1, dt * 6));
      let dr = (d.ry || 0) - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 8);
      if (d.em && d.em !== r.em) { r.em = d.em; r.av.play(d.em.split(':')[0]); }
      r.av.animate(before.distanceTo(g.position) / Math.max(dt, 0.001), dt, false); r.av.updatePet(this.scene, dt);
      const sc = d.giant ? 2.2 : 1; g.scale.setScalar(g.scale.x + (sc - g.scale.x) * Math.min(1, dt * 4));
      g.visible = !r.hidden;
    }
  }

  // ---------- effects ----------
  setEffects(E) {
    this.effects = E || {};
    const night = !!(this.effects.night || this.effects.disco);
    if (night !== this._night) {
      this._night = night;
      this._setSun(night ? -10 : 25, 228);
      this.renderer.toneMappingExposure = night ? 0.42 : 0.5;
      this.sun.intensity = night ? 0.3 : 3.6; this.sun.color.set(night ? 0x8fa6ff : 0xffe2bf);
      this.hemi.intensity = night ? 0.25 : 0.45;
      this.scene.fog.color.set(night ? 0x0b1222 : 0xc4cdd6);
      this.starsPts.material.opacity = night ? 1 : 0;
      this.cloudMat.opacity = night ? 0.12 : 0.85;
      this.bulbM.emissiveIntensity = night ? 5 : 0;
      this.beam.material.opacity = night ? 0.18 : 0;
      (this.horizonMats || []).forEach((m, i) => m.color.set(night ? 0x141a26 : [0x9aa8b6, 0x7f8f9f][i]));
      (this.windowMats || []).forEach((m, i) => m.emissive.setHex(night && i % 3 ? 0xffc983 : 0x000000));
    }
  }

  fireworks(n = 8, at) {
    const center = at || this.me.group.position;
    for (let k = 0; k < n; k++) setTimeout(() => {
      const cnt = 180, geo = new THREE.BufferGeometry(), pos = new Float32Array(cnt * 3), vel = [];
      const ox = center.x + (Math.random() - 0.5) * 50, oy = center.y + 28 + Math.random() * 15, oz = center.z + (Math.random() - 0.5) * 50;
      for (let i = 0; i < cnt; i++) { pos.set([ox, oy, oz], i * 3); vel.push(new THREE.Vector3().randomDirection().multiplyScalar(9 + Math.random() * 5)); }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.9, 0.65).multiplyScalar(3), size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const pts = new THREE.Points(geo, mat); this.scene.add(pts);
      let life = 0;
      this.updaters.push(dt => {
        life += dt; const a = geo.attributes.position;
        for (let i = 0; i < cnt; i++) { vel[i].y -= 7 * dt; vel[i].multiplyScalar(0.985); a.setXYZ(i, a.getX(i) + vel[i].x * dt, a.getY(i) + vel[i].y * dt, a.getZ(i) + vel[i].z * dt); }
        a.needsUpdate = true; mat.opacity = Math.max(0, 1 - life / 2.4);
        if (life > 2.4) { this.scene.remove(pts); geo.dispose(); mat.dispose(); return true; }
      });
      this.onFirework && this.onFirework();
    }, k * 380);
  }

  spawnStars(count, cx, cz, radius, onCollect) {
    const geo = new THREE.OctahedronGeometry(0.35, 0), mat = new THREE.MeshStandardMaterial({ color: 0xffd447, emissive: 0xffa200, emissiveIntensity: 2, metalness: 0.8, roughness: 0.25 });
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.28, d = 3 + Math.random() * radius, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const m = new THREE.Mesh(geo, mat); m.position.set(x, 45 + Math.random() * 30, z); m.scale.y = 1.5;
      this.scene.add(m); this.stars.push({ m, ground: Math.max(heightAt(x, z), 0) + 1, onCollect, t: Math.random() * 6 });
    }
  }
  clearStars() { this.stars.forEach(s => this.scene.remove(s.m)); this.stars = []; }
  _stars(dt) {
    const p = this.me.group.position;
    this.stars = this.stars.filter(s => {
      s.t += dt; const m = s.m;
      if (m.position.y > s.ground) m.position.y = Math.max(s.ground, m.position.y - dt * 14); else m.position.y = s.ground + Math.sin(s.t * 3) * 0.2;
      m.rotation.y += dt * 3;
      if (m.position.distanceTo(p) < 1.6 * this.me.group.scale.x + 0.3) { this.scene.remove(m); s.onCollect(); return false; }
      return true;
    });
  }

  islandAt(x, z) { let best = null, bd = 1e9; for (const I of ISLANDS) { const d = Math.hypot(x - I.x, z - I.z) / I.r; if (d < 1.25 && d < bd) { bd = d; best = I; } } return best; }

  start(onFrame) {
    this._onFrame = onFrame;
    const loop = () => {
      const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
      if (this.me) { this._physics(dt); this._camera(dt); this._stars(dt); this._zones(); }
      this._remotes(dt);
      if (this.water.material.uniforms?.time) this.water.material.uniforms.time.value += dt * 0.5;
      this.grassU.uTime.value = t; this.timeU.value = t;
      this.updaters = this.updaters.filter(u => !u(dt, t));
      if (this.effects.disco) { this.hemi.color.setHSL((t * 0.25) % 1, 0.9, 0.55); this.hemi.intensity = 1.2; } else this.hemi.color.set(0xbfd6ff);
      onFrame && onFrame(dt, t);
      if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }
  // lighter settings for slow computers (no reload needed)
  lighten() {
    if (this.light) return; this.light = true;
    this.composer = null; this.renderer.setPixelRatio(1); this.resize();
    this.grassMesh.count = Math.floor(this.grassMesh.count / 3);
    const sh = this.sun.shadow; sh.mapSize.set(1024, 1024); if (sh.map) { sh.map.dispose(); sh.map = null; }
  }
  pause(p) { if (p) { cancelAnimationFrame(this.raf); this.raf = null; } else if (!this.raf) { this.clock.getDelta(); this.start(this._onFrame); } }
}
