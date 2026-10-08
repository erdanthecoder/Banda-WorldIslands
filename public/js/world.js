// 3D world: islands, ocean, sky, buildings, kiosks, metro stations, players, effects.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

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

export const ISLANDS = [
  { id: 'hub', x: 0, z: 0, r: 80, h: 6, peak: 10 },
  { id: 'math', x: 230, z: -40, r: 66, h: 8, peak: 26 },
  { id: 'lang', x: -230, z: -20, r: 66, h: 8, peak: 22 },
  { id: 'arcade', x: 20, z: 230, r: 66, h: 7, peak: 18 },
  { id: 'sports', x: 0, z: -250, r: 92, h: 3, peak: 6 },
  { id: 'teacher', x: 215, z: 215, r: 58, h: 8, peak: 20 },
];
export const isl = id => ISLANDS.find(i => i.id === id);

export const PITCH = { x: 0, z: -228, hw: 30, hd: 18, h: 3 };
export const COURT = { x: 0, z: -282, hw: 16, hd: 10, h: 3 };
const FLATS = [
  ...ISLANDS.filter(I => I.id !== 'sports').map(I => ({ x: I.x, z: I.z, r: 30, h: I.h })),
  { ...PITCH, hw: PITCH.hw + 9, hd: PITCH.hd + 7 }, { ...COURT, hw: COURT.hw + 6, hd: COURT.hd + 5 }, { x: 0, z: -258, r: 16, h: 3 },
];

export function heightAt(x, z) {
  let best = -9;
  for (const I of ISLANDS) {
    const dx = x - I.x, dz = z - I.z, d = Math.sqrt(dx * dx + dz * dz) / I.r;
    if (d > 1.35) continue;
    const n = fbm(x * 0.02 + I.x, z * 0.02 + I.z);
    const fall = smooth(1.22, 0.6, d + (n - 0.5) * 0.4);
    let h = -9 + (I.h + 9) * fall + (fbm(x * 0.05, z * 0.05) - 0.5) * 4 * fall;
    h += Math.pow(Math.max(0, fbm(x * 0.018 + 9, z * 0.018 - 4, 6) - 0.45) * 2.2, 1.6) * I.peak * smooth(1.0, 0.5, d) * smooth(0.25, 0.6, d);
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

// ---------- canvas textures ----------
export function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); }
  return t;
}
function speckle(g, w, h, amt, n) {
  for (let i = 0; i < n; i++) { const v = (Math.random() - 0.5) * amt; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
}
export const TEX = {};
function makeTextures() {
  TEX.detail = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#e6e6e6'; g.fillRect(0, 0, w, h); speckle(g, w, h, 0.25, 9000); }, [1, 1]);
  TEX.cobble = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6f6c66'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16 % 2) * 12 - 12; x < w; x += 24) { g.fillStyle = `hsl(35,6%,${52 + Math.random() * 16}%)`; g.beginPath(); g.roundRect(x + 1, y + 1, 22, 14, 4); g.fill(); }
    speckle(g, w, h, 0.12, 3000);
  }, [1, 1]);
  const facade = (wall, glass, cols, rows, frame) => canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = wall; g.fillRect(0, 0, w, h); speckle(g, w, h, 0.08, 2500);
    const cw = w / cols, rh = h / rows;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = c * cw + cw * 0.14, y = r * rh + rh * 0.18, ww = cw * 0.72, hh = rh * 0.62;
      g.fillStyle = frame; g.fillRect(x - 3, y - 3, ww + 6, hh + 6);
      const gr = g.createLinearGradient(x, y, x + ww, y + hh); gr.addColorStop(0, glass); gr.addColorStop(1, '#0d1824'); g.fillStyle = gr; g.fillRect(x, y, ww, hh);
      g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(x, y, ww * 0.35, hh);
    }
  });
  TEX.glass = facade('#b9c2c9', '#5f86a3', 4, 4, '#3a4148');
  TEX.stone = facade('#cbc3b2', '#4a5a66', 3, 3, '#a59c8a');
  TEX.brick = canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#6e3b2c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) for (let x = (y / 8 % 2) * 8 - 8; x < w; x += 16) { g.fillStyle = `hsl(${10 + Math.random() * 8},${38 + Math.random() * 10}%,${30 + Math.random() * 10}%)`; g.fillRect(x + 1, y + 1, 14, 6); }
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const x = c * 85 + 22, y = r * 85 + 18; g.fillStyle = '#d8d2c4'; g.fillRect(x - 4, y - 4, 48, 60); g.fillStyle = '#1d2a36'; g.fillRect(x, y, 40, 52); g.fillStyle = '#d8d2c4'; g.fillRect(x + 18, y, 4, 52); g.fillRect(x, y + 24, 40, 4); }
  });
  TEX.concrete = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#a7a59f'; g.fillRect(0, 0, w, h); speckle(g, w, h, 0.12, 5000); });
  TEX.tile = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#d9d6cf'; g.fillRect(0, 0, w, h); speckle(g, w, h, 0.05, 2000); g.strokeStyle = '#b4b0a7'; g.lineWidth = 2; for (let i = 0; i <= w; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); } }, [1, 1]);
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
  g.font = `${weight} ${fs}px system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + 36; c.width = w; c.height = fs + 26;
  g.font = `${weight} ${fs}px system-ui, sans-serif`;
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
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, this.hq ? 1.5 : 1));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 0.55;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 6000);
    this.clock = new THREE.Clock();
    this.updaters = []; this.portals = []; this.remotes = {}; this.effects = {}; this.keys = {}; this.joy = { x: 0, y: 0 };
    this.solids = []; this.interiors = [];
    this.yaw = Math.PI; this.pitch = 0.3; this.dist = 6.5;
    this.vel = new THREE.Vector3(); this.onGround = false;
    this.frozenUntil = 0; this.constrain = null; this.inputLocked = false; this.stars = [];
    makeTextures();
    this._build();
    this._input();
    addEventListener('resize', () => this.resize()); this.resize();
  }
  resize() { const w = innerWidth, h = innerHeight; this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }

  _build() {
    const S = this.scene;
    const sky = this.sky = new Sky(); sky.scale.setScalar(5000); S.add(sky);
    const su = sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.4; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.82;
    this.sunDir = new THREE.Vector3();
    this.hemi = new THREE.HemisphereLight(0xbfd6ff, 0x50483a, 0.55); S.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff0dc, 3.2);
    sun.castShadow = true; sun.shadow.mapSize.set(this.hq ? 2048 : 1024, this.hq ? 2048 : 1024);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -45; sc.right = sc.top = 45; sc.near = 1; sc.far = 400;
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    S.add(sun, sun.target);
    S.fog = new THREE.FogExp2(0xa9c3dc, 0.0016);
    this.pmrem = new THREE.PMREMGenerator(this.renderer);

    if (this.hq) {
      const water = this.water = new Water(new THREE.PlaneGeometry(6000, 6000), {
        textureWidth: 512, textureHeight: 512, waterNormals: waterNormals(), sunDirection: new THREE.Vector3(0, 1, 0), sunColor: 0xfff2dc,
        waterColor: 0x0c3446, distortionScale: 2.2, fog: true,
      });
      water.rotation.x = -Math.PI / 2; water.material.uniforms.size.value = 6; S.add(water);
    } else {
      this.water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x14465c, roughness: 0.12, metalness: 0.2 }));
      S.add(this.water);
    }
    this._setSun(32, 205);
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8c8466 })); bed.position.y = -9; S.add(bed);

    const sand = new THREE.Color(0xc8b48a), wetSand = new THREE.Color(0x9d8b67), grassA = new THREE.Color(0x3b5524), grassB = new THREE.Color(0x5d7434), dry = new THREE.Color(0x857a48), rock = new THREE.Color(0x6b665e), rock2 = new THREE.Color(0x857f74), snow = new THREE.Color(0xe9edf2);
    const tmp = new THREE.Color();
    this.grassSpots = [];
    for (const I of ISLANDS) {
      const size = I.r * 2.8, seg = this.hq ? 180 : 110;
      const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
      const pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + I.x, z = pos.getZ(i) + I.z, h = heightAt(x, z);
        pos.setY(i, h);
        const slope = Math.hypot(heightAt(x + 1, z) - h, heightAt(x, z + 1) - h);
        const n = fbm(x * 0.08, z * 0.08, 3), n2 = vnoise(x * 0.5, z * 0.5);
        if (h < 0.3) tmp.copy(wetSand).lerp(sand, Math.max(0, (h + 2) / 2.3));
        else if (h < 1.5) tmp.copy(sand).lerp(grassB, (h - 0.3) / 1.2);
        else { tmp.copy(grassA).lerp(grassB, n); if (n > 0.62) tmp.lerp(dry, (n - 0.62) * 2); }
        if (slope > 0.75) tmp.lerp(n2 > 0.5 ? rock : rock2, Math.min(1, (slope - 0.75) * 1.4));
        if (h > 20) tmp.lerp(snow, Math.min(1, (h - 20) / 4) * (slope < 1.2 ? 1 : 0.4));
        tmp.multiplyScalar(0.9 + n2 * 0.2);
        cols.set([tmp.r, tmp.g, tmp.b], i * 3);
        if (h > 1.6 && h < 18 && slope < 0.5 && i % 3 === 0) this.grassSpots.push(x, z);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
      const det = TEX.detail.clone(); det.wrapS = det.wrapT = THREE.RepeatWrapping; det.repeat.set(size / 5, size / 5); det.needsUpdate = true;
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, map: det, roughness: 0.97 }));
      m.position.set(I.x, 0, I.z); m.receiveShadow = true; S.add(m);
      if (I.id !== 'sports') {
        const ct = TEX.cobble.clone(); ct.wrapS = ct.wrapT = THREE.RepeatWrapping; ct.repeat.set(10, 10); ct.needsUpdate = true;
        const plaza = new THREE.Mesh(new THREE.CircleGeometry(24, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: ct, roughness: 0.9 }));
        plaza.position.set(I.x, I.h + 0.03, I.z); plaza.receiveShadow = true; S.add(plaza);
      }
    }
    this._grass(); this._trees(); this._town(); this._sportsArena(); this._clouds(); this._nightStars();
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
    const spots = this.grassSpots, N = this.hq ? 60000 : 18000;
    const blade = new THREE.BufferGeometry();
    blade.setAttribute('position', new THREE.Float32BufferAttribute([-0.05, 0, 0, 0.05, 0, 0, 0.0, 0.55, 0, -0.04, 0, 0.03, 0.04, 0, -0.03, 0.01, 0.45, 0.02], 3));
    blade.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0.5, 1, 0, 0, 1, 0, 0.5, 1], 2));
    blade.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide });
    this.grassU = { uTime: { value: 0 } };
    mat.onBeforeCompile = sh => {
      sh.uniforms.uTime = this.grassU.uTime;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        vec4 ip = instanceMatrix[3];
        float sway = sin(uTime * 1.7 + ip.x * 0.35 + ip.z * 0.27) * 0.12 + sin(uTime * 3.1 + ip.x) * 0.03;
        transformed.x += sway * uv.y * uv.y; transformed.z += sway * 0.5 * uv.y * uv.y;`)
        .replace('#include <color_vertex>', '#include <color_vertex>\n#ifdef USE_INSTANCING_COLOR\n vColor *= mix(0.45, 1.05, uv.y);\n#endif');
    };
    const im = new THREE.InstancedMesh(blade, mat, N);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    const n2 = spots.length / 2;
    for (let i = 0; i < N; i++) {
      const k = Math.floor(Math.random() * n2) * 2;
      const x = spots[k] + (Math.random() - 0.5) * 3, z = spots[k + 1] + (Math.random() - 0.5) * 3, h = heightAt(x, z);
      if (!n2 || inFlat(x, z, -3)) { m.makeScale(0, 0, 0); im.setMatrixAt(i, m); im.setColorAt(i, c); continue; }
      q.setFromAxisAngle(up, Math.random() * 6.28); const sc = 0.7 + Math.random() * 0.8;
      m.compose(p.set(x, h - 0.05, z), q, s.set(sc, sc * (0.8 + Math.random() * 0.6), sc)); im.setMatrixAt(i, m);
      im.setColorAt(i, c.setHSL(0.2 + Math.random() * 0.06, 0.45 + Math.random() * 0.15, 0.24 + Math.random() * 0.1));
    }
    im.receiveShadow = true; im.frustumCulled = false; this.scene.add(im);
  }

  _trees() {
    const S = this.scene, spots = [];
    for (const I of ISLANDS) {
      const n = I.id === 'sports' ? 90 : 230;
      for (let i = 0, tries = 0; i < n && tries < 4000; tries++) {
        const a = hash(tries, I.r) * Math.PI * 2, d = Math.sqrt(hash(I.x + tries, 7)) * I.r;
        const x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = heightAt(x, z);
        if (h < 1.8 || h > 19) continue;
        if (Math.hypot(heightAt(x + 1, z) - h, heightAt(x, z + 1) - h) > 0.9) continue;
        if (inFlat(x, z, 7)) continue;
        spots.push([x, h, z, hash(x, z)]); i++;
      }
    }
    const lumpy = (geo, amt) => { const p = geo.attributes.position, v = new THREE.Vector3(); for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const n = vnoise(v.x * 2.1 + 5, v.z * 2.1 + v.y * 1.7); v.multiplyScalar(1 + (n - 0.5) * amt); p.setXYZ(i, v.x, v.y, v.z); } geo.computeVertexNormals(); return geo; };
    const trunkG = new THREE.CylinderGeometry(0.16, 0.32, 3.4, 8).translate(0, 1.7, 0);
    const crown = mergeGeometries([
      lumpy(new THREE.IcosahedronGeometry(1.7, 3), 0.5).translate(0, 4.4, 0),
      lumpy(new THREE.IcosahedronGeometry(1.3, 2), 0.5).translate(1.0, 3.8, 0.4),
      lumpy(new THREE.IcosahedronGeometry(1.2, 2), 0.5).translate(-0.9, 3.9, -0.5),
      lumpy(new THREE.IcosahedronGeometry(1.1, 2), 0.5).translate(0.2, 5.3, -0.2),
    ]);
    const pineG = mergeGeometries([0, 1, 2, 3].map(k => lumpy(new THREE.ConeGeometry(2.0 - k * 0.42, 2.4, 10, 2), 0.25).translate(0, 2.6 + k * 1.25, 0)));
    const leafM = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 1 }), spots.length);
    const isPine = s => s[1] > 9 || s[3] < 0.35;
    const pines = spots.filter(isPine), broad = spots.filter(s => !isPine(s));
    const pine = new THREE.InstancedMesh(pineG, leafM, pines.length), round = new THREE.InstancedMesh(crown, leafM, broad.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
    spots.forEach((s, i) => { const k = 0.8 + s[3] * 0.7; q.setFromAxisAngle(up, s[3] * 40); m.compose(p.set(s[0], s[1] - 0.2, s[2]), q, sc.set(k, k, k)); trunk.setMatrixAt(i, m); this.solids.push({ x: s[0], z: s[2], r: 0.4 * k }); });
    pines.forEach((s, i) => { const k = 0.8 + s[3] * 0.8; q.setFromAxisAngle(up, s[3] * 40); m.compose(p.set(s[0], s[1] - 0.2, s[2]), q, sc.set(k, k * (1 + s[3] * 0.4), k)); pine.setMatrixAt(i, m); pine.setColorAt(i, c.setHSL(0.3 + s[3] * 0.05, 0.38, 0.13 + s[3] * 0.06)); });
    broad.forEach((s, i) => { const k = 0.75 + s[3] * 0.6; q.setFromAxisAngle(up, s[3] * 40); m.compose(p.set(s[0], s[1] - 0.2, s[2]), q, sc.set(k, k, k)); round.setMatrixAt(i, m); round.setColorAt(i, c.setHSL(0.21 + s[3] * 0.09, 0.42, 0.17 + s[3] * 0.08)); });
    for (const im of [trunk, pine, round]) { im.castShadow = true; im.receiveShadow = true; S.add(im); }
    const rockG = lumpy(new THREE.DodecahedronGeometry(1, 1), 0.45), bushG = lumpy(new THREE.IcosahedronGeometry(0.8, 2), 0.5);
    const rs = [], bs = [];
    for (let i = 0; i < 700; i++) {
      const I = ISLANDS[i % ISLANDS.length], a = hash(i, 3) * 6.28, d = (0.2 + hash(i, 9) * 0.9) * I.r;
      const x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = heightAt(x, z);
      if (h < 0.2 || inFlat(x, z, 3)) continue;
      (i % 3 ? bs : rs).push([x, h, z, hash(x, i)]);
    }
    const rocks = new THREE.InstancedMesh(rockG, new THREE.MeshStandardMaterial({ color: 0x7b766d, roughness: 0.95 }), rs.length);
    rs.forEach((s, i) => { const k = 0.3 + s[3] * 1.6; q.setFromEuler(new THREE.Euler(s[3] * 3, s[3] * 7, 0)); m.compose(p.set(s[0], s[1] - 0.2, s[2]), q, sc.set(k, k * 0.6, k)); rocks.setMatrixAt(i, m); if (k > 1) this.solids.push({ x: s[0], z: s[2], r: k * 0.8 }); });
    const bushes = new THREE.InstancedMesh(bushG, leafM, bs.length);
    bs.forEach((s, i) => { const k = 0.5 + s[3]; m.compose(p.set(s[0], s[1], s[2]), q.identity(), sc.set(k, k * 0.7, k)); bushes.setMatrixAt(i, m); bushes.setColorAt(i, c.setHSL(0.24 + s[3] * 0.06, 0.4, 0.16 + s[3] * 0.06)); });
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

  // A building on the edge of an island's plaza, facing the centre. Returns a spot in front of its door.
  building(I, angle, dist, { w = 22, d = 12, h = 12, tex = 'glass', name = '' } = {}) {
    const x = I.x + Math.cos(angle) * dist, z = I.z + Math.sin(angle) * dist, base = I.h, rot = -angle - Math.PI / 2;
    const ext = tex === 'glass' ? { metalness: 0.35, roughness: 0.35 } : {};
    const facade = this.texMat(TEX[tex], w, h, ext), side = this.texMat(TEX[tex], d, h, ext);
    const roof = new THREE.MeshStandardMaterial({ color: 0x4b4d52, roughness: 0.9 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h + 6, d), [side, side, roof, roof, facade, facade]);
    b.position.set(x, base + (h - 6) / 2, z); b.rotation.y = rot; b.castShadow = b.receiveShadow = true; this.scene.add(b);
    this.solids.push({ x, z, hw: w / 2, hd: d / 2, rot });
    this.box(x, base + h - 0.3, z, w + 0.4, 0.6, d + 0.4, { color: 0x5a5c61, roughness: 0.8 }, { rot });
    const ox = Math.cos(angle), oz = Math.sin(angle);
    const front = k => [x - ox * (d / 2 + k), z - oz * (d / 2 + k)];
    const steel = { color: 0x2f3236, metalness: 0.6, roughness: 0.4 };
    const [cx, cz] = front(1.5);
    this.box(cx, base + 3.4, cz, 6, 0.25, 3, steel, { rot });
    for (const s of [-1, 1]) this.box(cx + Math.cos(rot) * s * 2.8, base + 1.7, cz - Math.sin(rot) * s * 2.8, 0.18, 3.4, 0.18, steel, { rot });
    const [dx, dz] = front(0.05);
    this.box(dx, base + 1.4, dz, 2.6, 2.8, 0.1, { color: 0x101820, metalness: 0.7, roughness: 0.15 }, { rot, shadow: false });
    if (name) { const s = labelSprite(name, 1.1, { bg: null, weight: 700 }); const [sx, sz] = front(0.3); s.position.set(sx, base + h - 1.8, sz); this.scene.add(s); }
    const [ex, ez] = front(4.5);
    return { x: ex, z: ez, rot, angle };
  }

  // Info terminal you walk up to (press E). action: {game} | {mg} | {metro}
  kiosk(x, z, label, action, rot = 0) {
    const h = heightAt(x, z), g = new THREE.Group();
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.35), new THREE.MeshStandardMaterial({ color: 0x2c3036, metalness: 0.5, roughness: 0.4 }));
    post.position.y = 0.55; post.castShadow = true;
    const screen = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.62, 0.06), new THREE.MeshStandardMaterial({ color: 0x0a1018, emissive: 0x2a7bd6, emissiveIntensity: 0.9, roughness: 0.2 }));
    screen.position.set(0, 1.35, 0.05); screen.rotation.x = -0.35; screen.castShadow = true;
    const lab = labelSprite(label, 0.42); lab.position.y = 2.15;
    g.add(post, screen, lab); g.position.set(x, h, z); g.rotation.y = rot; this.scene.add(g);
    this.solids.push({ x, z, r: 0.4 });
    const p = { x, z, y: h, label, action, group: g, lab };
    this.portals.push(p);
    return p;
  }
  setKioskLabel(p, label) { p.group.remove(p.lab); p.lab = labelSprite(label, 0.42); p.lab.position.y = p.metro ? 3.6 : 2.15; if (p.metro) p.lab.position.z = 3.6; p.group.add(p.lab); p.label = label; }

  // Metro entrance pavilion with the red M sign. Returns the interact point.
  metroEntrance(x, z, rot, label, action) {
    const h = heightAt(x, z), g = new THREE.Group(), steel = new THREE.MeshStandardMaterial({ color: 0x3a3f46, metalness: 0.7, roughness: 0.35 });
    const glass = new THREE.MeshStandardMaterial({ color: 0x9ec3d8, metalness: 0.2, roughness: 0.05, transparent: true, opacity: 0.35 });
    const add = (geo, mat, px, py, pz) => { const m = new THREE.Mesh(geo, mat); m.position.set(px, py, pz); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };
    add(new THREE.BoxGeometry(5, 0.2, 7), steel, 0, 2.9, 0);
    for (const sx of [-2.4, 2.4]) { add(new THREE.BoxGeometry(0.1, 2.8, 7), glass, sx, 1.45, 0); add(new THREE.BoxGeometry(0.15, 2.8, 0.15), steel, sx, 1.45, 3.4); add(new THREE.BoxGeometry(0.15, 2.8, 0.15), steel, sx, 1.45, -3.4); }
    add(new THREE.BoxGeometry(4.6, 2.8, 0.1), glass, 0, 1.45, -3.45);
    const stairM = new THREE.MeshStandardMaterial({ color: 0x8b8a85, roughness: 0.9 });
    for (let i = 0; i < 8; i++) add(new THREE.BoxGeometry(3.6, 0.2, 0.7), stairM, 0, 0.02 - i * 0.28, 2.2 - i * 0.7);
    add(new THREE.BoxGeometry(3.8, 0.05, 6.5), new THREE.MeshBasicMaterial({ color: 0x050607 }), 0, -2.3, -0.5);
    add(new THREE.CylinderGeometry(0.07, 0.07, 4.2, 10), steel, 3.2, 2.1, 3.6);
    const sign = canvasTex(128, 128, c => { c.fillStyle = '#c8102e'; c.beginPath(); c.arc(64, 64, 60, 0, 7); c.fill(); c.fillStyle = '#fff'; c.font = 'bold 84px system-ui'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('M', 64, 70); });
    add(new THREE.CircleGeometry(0.55, 32), new THREE.MeshStandardMaterial({ map: sign, emissive: 0x330000, side: THREE.DoubleSide }), 3.2, 4.4, 3.6);
    const lab = labelSprite(label, 0.42); lab.position.set(0, 3.6, 3.6); g.add(lab);
    g.position.set(x, h, z); g.rotation.y = rot; this.scene.add(g);
    this.solids.push({ x, z, hw: 2.6, hd: 3.6, rot });
    const fx = x + Math.sin(rot) * 4.8, fz = z + Math.cos(rot) * 4.8;
    const p = { x: fx, z: fz, y: h, label, action, group: g, lab, metro: true };
    this.portals.push(p);
    return p;
  }

  _town() {
    const S = this.scene, h0 = isl('hub').h;
    const stone = new THREE.MeshStandardMaterial({ color: 0xbdb6a8, roughness: 0.8 });
    const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(...p)), seg);
    const basin = new THREE.Mesh(lathe([[0, 0], [5.2, 0], [5.2, 0.7], [4.8, 0.7], [4.8, 0.25], [0, 0.25]], 48), stone);
    basin.position.set(0, h0, 0); basin.castShadow = basin.receiveShadow = true; S.add(basin);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(4.8, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2c6a80, roughness: 0.05, metalness: 0.3 }));
    pool.position.set(0, h0 + 0.55, 0); S.add(pool);
    const tier = new THREE.Mesh(lathe([[0, 0], [0.5, 0], [0.4, 2.2], [1.8, 2.4], [1.8, 2.7], [0.3, 2.7], [0.25, 3.6], [0, 3.8]], 32), stone);
    tier.position.set(0, h0, 0); tier.castShadow = true; S.add(tier);
    this.solids.push({ x: 0, z: 0, r: 5.4 });
    const N = 500, pg = new THREE.BufferGeometry(), pp = new Float32Array(N * 3), pv = [];
    for (let i = 0; i < N; i++) pv.push({ a: Math.random() * 6.28, t: Math.random() * 1.2, s: 1 + Math.random() * 0.6 });
    pg.setAttribute('position', new THREE.BufferAttribute(pp, 3));
    S.add(new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xdff4ff, size: 0.09, transparent: true, opacity: 0.75, depthWrite: false })));
    this.updaters.push(dt => { for (let i = 0; i < N; i++) { const q = pv[i]; q.t += dt; if (q.t > 1.2) q.t = 0; const r = q.t * 1.4 * q.s; pp[i * 3] = Math.cos(q.a) * r; pp[i * 3 + 1] = h0 + 3.8 + q.t * 3.2 - q.t * q.t * 5.6; pp[i * 3 + 2] = Math.sin(q.a) * r; } pg.attributes.position.needsUpdate = true; });
    const lampM = new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.7, roughness: 0.4 });
    this.bulbM = new THREE.MeshStandardMaterial({ color: 0xfff1cf, emissive: 0xffd28a, emissiveIntensity: 0 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5233, roughness: 0.8 });
    for (const I of ISLANDS) {
      if (I.id === 'sports') continue;
      for (let k = 0; k < 10; k++) {
        const a = k / 10 * Math.PI * 2 + 0.31, x = I.x + Math.cos(a) * 21, z = I.z + Math.sin(a) * 21, y = I.h;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 4, 8), lampM); pole.position.set(x, y + 2, z); pole.castShadow = true; S.add(pole);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), this.bulbM); bulb.position.set(x, y + 4.1, z); S.add(bulb);
        this.solids.push({ x, z, r: 0.2 });
        if (k % 2) { const bx = I.x + Math.cos(a + 0.15) * 22.5, bz = I.z + Math.sin(a + 0.15) * 22.5, r = -a - 0.15 + Math.PI / 2; this.box(bx, y + 0.45, bz, 1.8, 0.1, 0.5, wood, { rot: r }); this.box(bx, y + 0.22, bz, 1.6, 0.44, 0.08, lampM, { rot: r }); }
      }
    }
  }

  _sportsArena() {
    const S = this.scene, P = PITCH;
    const c = document.createElement('canvas'); c.width = 1024; c.height = 640; const g = c.getContext('2d');
    for (let i = 0; i < 14; i++) { g.fillStyle = i % 2 ? '#3d7a2f' : '#448534'; g.fillRect(i * c.width / 14, 0, c.width / 14 + 1, c.height); }
    speckle(g, 1024, 640, 0.08, 20000);
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 5; const W = c.width, Hh = c.height, m = 14;
    g.strokeRect(m, m, W - 2 * m, Hh - 2 * m); g.beginPath(); g.moveTo(W / 2, m); g.lineTo(W / 2, Hh - m); g.stroke();
    g.beginPath(); g.arc(W / 2, Hh / 2, 80, 0, 7); g.stroke();
    g.strokeRect(m, Hh / 2 - 150, 150, 300); g.strokeRect(W - m - 150, Hh / 2 - 150, 150, 300); g.strokeRect(m, Hh / 2 - 70, 55, 140); g.strokeRect(W - m - 55, Hh / 2 - 70, 55, 140);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const field = new THREE.Mesh(new THREE.PlaneGeometry(P.hw * 2 + 2, P.hd * 2 + 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95 }));
    field.position.set(P.x, P.h + 0.03, P.z); field.receiveShadow = true; S.add(field);
    const white = { color: 0xf2f2f2, roughness: 0.4 };
    for (const sx of [-1, 1]) {
      const gx = P.x + sx * P.hw;
      this.box(gx, P.h + 1.22, P.z - 3.66, 0.12, 2.44, 0.12, white); this.box(gx, P.h + 1.22, P.z + 3.66, 0.12, 2.44, 0.12, white);
      this.box(gx, P.h + 2.44, P.z, 0.12, 0.12, 7.44, white);
      const net = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.44, 7.32), new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.3 }));
      net.position.set(gx + sx * 0.85, P.h + 1.22, P.z); S.add(net);
    }
    const conc = this.texMat(TEX.concrete, 60, 4), seat = new THREE.MeshStandardMaterial({ color: 0x1f4d8c, roughness: 0.6 });
    for (const sz of [-1, 1]) for (let k = 0; k < 6; k++) {
      this.box(P.x, P.h + 0.3 + k * 0.6, P.z + sz * (P.hd + 4 + k * 0.9), P.hw * 2 + 6, 0.6 + k * 1.2, 0.9, conc, { solid: true });
      this.box(P.x, P.h + 0.65 + k * 1.2, P.z + sz * (P.hd + 4 + k * 0.9), P.hw * 2 + 4, 0.2, 0.45, seat);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const x = P.x + sx * (P.hw + 6), z = P.z + sz * (P.hd + 10);
      this.box(x, P.h + 9, z, 0.4, 18, 0.4, { color: 0x6b6f75, metalness: 0.6 }, { solid: true });
      this.box(x, P.h + 18, z, 3, 1.4, 0.4, { color: 0xeeeeee, emissive: 0xffffff, emissiveIntensity: 0.6 });
    }
    const C = COURT;
    const court = new THREE.Mesh(new THREE.PlaneGeometry(C.hw * 2, C.hd * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.45 }));
    court.position.set(C.x, C.h + 0.03, C.z); court.receiveShadow = true; S.add(court);
    for (const [sz, col] of [[-1, 0x9c2b2b], [1, 0x24508f]]) { const mm = new THREE.Mesh(new THREE.PlaneGeometry(C.hw * 2 - 1, C.hd - 0.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.35 })); mm.position.set(C.x, C.h + 0.05, C.z + sz * C.hd / 2); S.add(mm); }
    this.box(C.x, C.h + 0.06, C.z, C.hw * 2, 0.02, 0.15, white);
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 128; const bg = bc.getContext('2d');
    bg.fillStyle = '#f4f4f4'; bg.fillRect(0, 0, 256, 128); bg.fillStyle = '#1a1a1a';
    for (let i = 0; i < 12; i++) { bg.beginPath(); const x = (i % 6) * 46 + (i > 5 ? 23 : 0), y = i > 5 ? 90 : 38; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; bg.lineTo(x + Math.cos(a) * 13, y + Math.sin(a) * 13); } bg.fill(); }
    const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), new THREE.MeshStandardMaterial({ map: btex, roughness: 0.45 }));
    this.ball.castShadow = true; this.ball.position.set(P.x, P.h + 0.3, P.z); S.add(this.ball);
  }

  _clouds() {
    const tex = canvasTex(128, 128, g => { const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.8 });
    this.clouds = [];
    for (let i = 0; i < 40; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 9; k++) { const s = new THREE.Sprite(mat); const sz = 40 + hash(i, k) * 60; s.scale.set(sz * 1.6, sz * 0.7, 1); s.position.set((hash(k, i) - 0.5) * 120, hash(i * 3, k) * 15, (hash(k, i * 7) - 0.5) * 50); g.add(s); }
      g.position.set((hash(i, 1) - 0.5) * 3000, 180 + hash(i, 2) * 120, (hash(i, 3) - 0.5) * 3000);
      this.scene.add(g); this.clouds.push(g);
    }
    this.cloudMat = mat;
    this.updaters.push(dt => this.clouds.forEach(c => { c.position.x += dt * 4; if (c.position.x > 1500) c.position.x = -1500; }));
  }
  _nightStars() {
    const N = 2500, g = new THREE.BufferGeometry(), p = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { const v = new THREE.Vector3().randomDirection(); v.y = Math.abs(v.y); v.multiplyScalar(3000); p.set([v.x, v.y, v.z], i * 3); }
    g.setAttribute('position', new THREE.BufferAttribute(p, 3));
    this.starsPts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }));
    this.scene.add(this.starsPts);
  }

  // ---------- interiors (metro platform, research station) ----------
  addInterior(def) { this.interiors.push(def); return def; }
  interiorAt(x, y, z) { return this.interiors.find(I => y < I.floor + 8 && y > I.floor - 3 && x >= I.minX && x <= I.maxX && z >= I.minZ && z <= I.maxZ); }

  // ---------- player ----------
  setPlayer(avatar) { this.me = avatar; this.scene.add(avatar.group); this.teleport(0, 14); }
  replacePlayer(avatar) { const old = this.me.group; avatar.group.position.copy(old.position); avatar.group.rotation.y = old.rotation.y; this.scene.remove(old); this.me = avatar; this.scene.add(avatar.group); }
  teleport(x, z, yaw, y) {
    const p = this.me.group.position, I = y !== undefined ? this.interiorAt(x, y, z) : null;
    p.set(x, I ? I.floor : heightAt(x, z) + 0.3, z); this.vel.set(0, 0, 0);
    if (yaw !== undefined) { this.yaw = yaw; this.me.group.rotation.y = yaw + Math.PI; }
    this.camera.position.set(p.x + Math.sin(this.yaw) * 5, p.y + 2.5, p.z + Math.cos(this.yaw) * 5);
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

  _collide(nx, nz) {
    for (const s of this.solids) {
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
    const inside = this.interiorAt(p.x, p.y, p.z);
    const ground0 = inside ? inside.floor : heightAt(p.x, p.z), swim = !inside && ground0 < -1.2;
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
      nx = Math.min(inside.maxX - 0.4, Math.max(inside.minX + 0.4, nx)); nz = Math.min(inside.maxZ - 0.4, Math.max(inside.minZ + 0.4, nz));
      for (const w of inside.walls || []) { const ex = w.hw + 0.3, ez = w.hd + 0.3, dx = nx - w.x, dz = nz - w.z; if (Math.abs(dx) < ex && Math.abs(dz) < ez) { if (ex - Math.abs(dx) < ez - Math.abs(dz)) nx = w.x + Math.sign(dx) * ex; else nz = w.z + Math.sign(dz) * ez; } }
    } else {
      [nx, nz] = this._collide(nx, nz);
      const R = 1400, dc = Math.hypot(nx, nz); if (dc > R) { nx *= R / dc; nz *= R / dc; }
      if (heightAt(nx, nz) - ground0 > 0.45 && this.onGround) { nx = p.x; nz = p.z; } // too steep to climb
    }
    if (this.constrain) [nx, nz] = this.constrain(nx, nz);
    p.x = nx; p.z = nz; p.y += this.vel.y * dt;
    const floor = inside ? inside.floor : Math.max(heightAt(p.x, p.z), swim ? -1.45 + Math.sin(now / 500) * 0.06 : -99);
    if (p.y <= floor) { p.y = floor; this.vel.y = Math.max(0, this.vel.y); this.onGround = true; } else if (p.y > floor + 0.25) this.onGround = false; else if (this.vel.y <= 0) p.y = floor;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.4) { const target = Math.atan2(this.vel.x, this.vel.z); let d = target - me.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); me.group.rotation.y += d * Math.min(1, dt * 10); }
    me.animate(hs, dt, !this.onGround && !swim);
    const sc = E.giant ? 2.2 : 1; me.group.scale.setScalar(me.group.scale.x + (sc - me.group.scale.x) * Math.min(1, dt * 4));
    this.speedNow = hs; this.inside = inside;
  }

  _camera(dt) {
    const p = this.me.group.position;
    this.sun.position.set(p.x + this.sunDir.x * 150, p.y + this.sunDir.y * 150, p.z + this.sunDir.z * 150); this.sun.target.position.copy(p);
    if (this.cameraOverride) { this.cameraOverride(this.camera, dt); return; }
    const s = this.me.group.scale.x, I = this.inside;
    const d = (I ? Math.min(this.dist, 4.5) : this.dist) * (0.75 + s * 0.25), cp = Math.cos(this.pitch);
    const target = new THREE.Vector3(p.x + Math.sin(this.yaw) * cp * d, p.y + 1.6 * s + Math.sin(this.pitch) * d, p.z + Math.cos(this.yaw) * cp * d);
    if (I) { target.y = Math.min(I.floor + (I.ceil || 4.5) - 0.3, Math.max(I.floor + 0.6, target.y)); target.x = Math.min(I.maxX - 0.3, Math.max(I.minX + 0.3, target.x)); target.z = Math.min(I.maxZ - 0.3, Math.max(I.minZ + 0.3, target.z)); }
    else { const gh = heightAt(target.x, target.z) + 0.5; if (target.y < gh) target.y = gh; if (target.y < -0.6) target.y = -0.6; }
    this.camera.position.lerp(target, Math.min(1, dt * 10));
    this.camera.lookAt(p.x, p.y + 1.45 * s, p.z);
  }

  // ---------- remote players ----------
  upsertRemote(id, d, makeAvatar) {
    let r = this.remotes[id];
    if (!d) { if (r) { this.scene.remove(r.av.group); delete this.remotes[id]; } return; }
    const sig = JSON.stringify([d.name, d.role, d.avatar]);
    if (r && r.sig !== sig) { this.scene.remove(r.av.group); delete this.remotes[id]; r = null; }
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
      r.av.animate(before.distanceTo(g.position) / Math.max(dt, 0.001), dt, false);
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
      this._setSun(night ? -10 : 32, 205);
      this.renderer.toneMappingExposure = night ? 0.4 : 0.55;
      this.sun.intensity = night ? 0.3 : 3.2; this.sun.color.set(night ? 0x8fa6ff : 0xfff0dc);
      this.hemi.intensity = night ? 0.3 : 0.55;
      this.scene.fog.color.set(night ? 0x0b1222 : 0xa9c3dc);
      this.starsPts.material.opacity = night ? 1 : 0;
      this.cloudMat.opacity = night ? 0.15 : 0.8;
      this.bulbM.emissiveIntensity = night ? 4 : 0;
    }
  }

  fireworks(n = 8, at) {
    const center = at || this.me.group.position;
    for (let k = 0; k < n; k++) setTimeout(() => {
      const cnt = 160, geo = new THREE.BufferGeometry(), pos = new Float32Array(cnt * 3), vel = [];
      const ox = center.x + (Math.random() - 0.5) * 50, oy = center.y + 25 + Math.random() * 15, oz = center.z + (Math.random() - 0.5) * 50;
      for (let i = 0; i < cnt; i++) { pos.set([ox, oy, oz], i * 3); vel.push(new THREE.Vector3().randomDirection().multiplyScalar(9 + Math.random() * 5)); }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: new THREE.Color().setHSL(Math.random(), 0.9, 0.65), size: 0.5, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
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
    const geo = new THREE.OctahedronGeometry(0.35, 0), mat = new THREE.MeshStandardMaterial({ color: 0xffd447, emissive: 0xffa200, emissiveIntensity: 1.4, metalness: 0.8, roughness: 0.25 });
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

  nearestPortal() {
    const p = this.me.group.position; let best = null, bd = 3;
    for (const q of this.portals) { if (Math.abs(p.y - q.y) > 6) continue; const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  islandAt(x, z) { let best = null, bd = 1e9; for (const I of ISLANDS) { const d = Math.hypot(x - I.x, z - I.z) / I.r; if (d < 1.25 && d < bd) { bd = d; best = I; } } return best; }

  start(onFrame) {
    this._onFrame = onFrame;
    const loop = () => {
      const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
      if (this.me) { this._physics(dt); this._camera(dt); this._stars(dt); }
      this._remotes(dt);
      if (this.water.material.uniforms?.time) this.water.material.uniforms.time.value += dt * 0.6;
      this.grassU.uTime.value = t;
      this.updaters = this.updaters.filter(u => !u(dt, t));
      if (this.effects.disco) { this.hemi.color.setHSL((t * 0.25) % 1, 0.9, 0.55); this.hemi.intensity = 1.2; } else this.hemi.color.set(0xbfd6ff);
      onFrame && onFrame(dt, t);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }
  pause(p) { if (p) { cancelAnimationFrame(this.raf); this.raf = null; } else if (!this.raf) { this.clock.getDelta(); this.start(this._onFrame); } }
}
