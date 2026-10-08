// Blocky avatars (Roblox-style), pets, emotes and the avatar creator.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const SKINS = ['#ffd9b8', '#f2c49b', '#d9a066', '#b97a4b', '#8a5634', '#5c3a22', '#f5d24b'];
export const HAIR_COLORS = ['#1c1410', '#4a2c17', '#7a4a24', '#c48a3f', '#e8c56c', '#a3311f', '#3d5ad6', '#d64aa8', '#f2f2f2'];
export const CLOTH = ['#1f4b8f', '#2e8b57', '#c0392b', '#f2f2f2', '#262626', '#e67e22', '#8e44ad', '#16a085', '#f1c40f', '#ff6fa8'];
export const PANTS = ['#22293a', '#3a3f4a', '#5a4632', '#2d5aa0', '#1d1d1f', '#7b8a9c', '#2e8b57'];
export const SHOES = ['#f2f2f2', '#1b1b1b', '#6b3f22', '#c0392b', '#1f4b8f'];
export const FACES = ['smile', 'grin', 'cool', 'wink', 'wow', 'happy'];
export const HAIRSTYLES = ['short', 'spiky', 'long', 'bun', 'curly', 'none'];
export const TOPS = ['plain', 'stripes', 'star', 'hoodie', 'jersey'];
export const HATS = ['none', 'cap', 'beanie', 'crown', 'headphones', 'tophat'];
export const PETS = ['none', 'dog', 'cat', 'bunny', 'dragon'];
export const EMOTES = ['wave', 'dance', 'cheer', 'sit'];

export function randomAvatar() {
  const p = a => a[Math.floor(Math.random() * a.length)];
  return { skin: p(SKINS), face: p(FACES), hair: p(HAIRSTYLES), hairColor: p(HAIR_COLORS), top: p(TOPS), shirt: p(CLOTH), pants: p(PANTS), shoes: p(SHOES), hat: 'none', pet: 'none', height: 1 };
}

const mat = (color, rough = 0.55, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const rbox = (w, h, d, r = 0.06) => new RoundedBoxGeometry(w, h, d, 3, r);
const canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };

function faceTexture(face) {
  return canvas(128, 128, (g) => {
    g.fillStyle = '#141414'; g.strokeStyle = '#141414'; g.lineWidth = 6; g.lineCap = 'round';
    const eye = (x, y, r = 7) => { g.beginPath(); g.ellipse(x, y, r * 0.8, r * 1.2, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x + 2, y - 3, 2.2, 0, 7); g.fill(); g.fillStyle = '#141414'; };
    if (face === 'cool') { g.fillStyle = '#111'; g.beginPath(); g.roundRect(22, 40, 36, 20, 6); g.roundRect(70, 40, 36, 20, 6); g.fill(); g.fillRect(56, 44, 16, 5); g.strokeStyle = '#141414'; }
    else if (face === 'wink') { eye(44, 50); g.beginPath(); g.moveTo(74, 50); g.quadraticCurveTo(84, 44, 94, 50); g.stroke(); }
    else if (face === 'happy') { for (const x of [44, 84]) { g.beginPath(); g.arc(x, 54, 9, Math.PI, 0); g.stroke(); } }
    else eye(44, 50), eye(84, 50);
    if (face === 'wow') { g.beginPath(); g.ellipse(64, 88, 9, 12, 0, 0, 7); g.fill(); }
    else if (face === 'grin') { g.fillStyle = '#141414'; g.beginPath(); g.moveTo(38, 78); g.quadraticCurveTo(64, 112, 90, 78); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(46, 79, 36, 6); }
    else { g.beginPath(); g.moveTo(42, 82); g.quadraticCurveTo(64, 102, 86, 82); g.stroke(); }
    if (face === 'happy' || face === 'smile') { g.fillStyle = 'rgba(255,110,110,0.35)'; g.beginPath(); g.arc(30, 72, 8, 0, 7); g.arc(98, 72, 8, 0, 7); g.fill(); }
  });
}
function shirtTexture(top, color) {
  return canvas(128, 128, (g, w, h) => {
    if (top === 'stripes') { for (let y = 0; y < h; y += 24) { g.fillStyle = 'rgba(255,255,255,0.75)'; g.fillRect(0, y, w, 10); } }
    if (top === 'star') { g.fillStyle = '#ffd34d'; g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 14 : 34, a = i / 10 * Math.PI * 2 - Math.PI / 2; g.lineTo(64 + Math.cos(a) * r, 62 + Math.sin(a) * r); } g.fill(); }
    if (top === 'hoodie') { g.fillStyle = 'rgba(0,0,0,0.25)'; g.beginPath(); g.roundRect(30, 74, 68, 34, 10); g.fill(); g.strokeStyle = '#eee'; g.lineWidth = 4; g.beginPath(); g.moveTo(52, 4); g.lineTo(50, 40); g.moveTo(76, 4); g.lineTo(78, 40); g.stroke(); }
    if (top === 'jersey') { g.fillStyle = '#fff'; g.font = '900 64px Manrope, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(7 + (color.charCodeAt(2) % 20)), 64, 70); g.fillRect(0, 0, w, 8); }
  });
}

function nameSprite(text, role) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 40;
  g.font = `700 ${fs}px Manrope, system-ui, sans-serif`;
  const label = (role === 'teacher' ? '★ ' : '') + text;
  const w = Math.ceil(g.measureText(label).width) + 28; c.width = w; c.height = fs + 20;
  g.font = `700 ${fs}px Manrope, system-ui, sans-serif`;
  g.fillStyle = 'rgba(12,16,24,0.5)'; g.beginPath(); g.roundRect(0, 0, w, c.height, 12); g.fill();
  g.fillStyle = role === 'teacher' ? '#ffd76a' : '#ffffff'; g.textBaseline = 'middle'; g.fillText(label, 14, c.height / 2 + 1);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(0.3 * w / c.height, 0.3, 1); s.renderOrder = 10;
  return s;
}

export class Avatar {
  constructor(cfg, name = '', role = 'student') {
    cfg = { ...randomAvatar(), ...(cfg || {}) };
    if (!FACES.includes(cfg.face)) cfg.face = 'smile';
    if (!TOPS.includes(cfg.top)) cfg.top = 'plain';
    this.cfg = cfg; this.group = new THREE.Group();
    const body = this.body = new THREE.Group(); this.group.add(body);
    const skin = mat(cfg.skin, 0.5), shirt = mat(cfg.shirt, 0.65), pants = mat(cfg.pants, 0.7), shoes = mat(cfg.shoes, 0.45), hairM = mat(cfg.hairColor, 0.6);
    this.mats = [skin, shirt, pants, shoes, hairM];
    const add = (geo, m, x, y, z, parent = body) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o); return o; };
    const S = 0.36; // one "stud"
    // torso with shirt design on the front
    add(rbox(2 * S, 2 * S, S, 0.05), shirt, 0, 3 * S, 0);
    if (cfg.top !== 'plain') { const dec = new THREE.Mesh(new THREE.PlaneGeometry(1.8 * S, 1.8 * S), new THREE.MeshStandardMaterial({ map: shirtTexture(cfg.top, cfg.shirt), transparent: true, roughness: 0.65 })); dec.position.set(0, 3 * S, S / 2 + 0.003); body.add(dec); this.mats.push(dec.material); }
    if (cfg.top === 'hoodie') add(rbox(1.6 * S, 0.5 * S, 0.6 * S, 0.08), shirt, 0, 4.05 * S, -0.35 * S);
    // head (rounded, a bit like a cylinder) with face
    const head = this.head = new THREE.Group(); head.position.set(0, 4.62 * S, 0); body.add(head);
    add(new THREE.CylinderGeometry(0.62 * S, 0.62 * S, 1.2 * S, 24), skin, 0, 0, 0, head);
    add(new THREE.SphereGeometry(0.62 * S, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), skin, 0, 0.6 * S, 0, head).scale.y = 0.35;
    add(new THREE.SphereGeometry(0.62 * S, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), skin, 0, -0.6 * S, 0, head).scale.y = 0.35;
    add(new THREE.CylinderGeometry(0.28 * S, 0.3 * S, 0.3 * S, 12), skin, 0, -0.75 * S, 0, head);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0 * S, 1.0 * S), new THREE.MeshStandardMaterial({ map: faceTexture(cfg.face), transparent: true, roughness: 0.5 }));
    face.position.set(0, 0.02 * S, 0.625 * S); head.add(face); this.mats.push(face.material);
    // hair
    const hs = cfg.hair, top = (h, back = 0) => add(rbox(1.36 * S, h * S, (1.36 + back) * S, 0.12), hairM, 0, (0.66 - h / 2 + 0.25) * S, -back / 2 * S, head);
    if (hs === 'short') top(0.55, 0.05);
    if (hs === 'spiky') { top(0.4); for (let i = 0; i < 7; i++) { const c = add(new THREE.ConeGeometry(0.16 * S, 0.6 * S, 6), hairM, (i % 4 - 1.5) * 0.3 * S, 0.95 * S, (Math.floor(i / 4) - 0.3) * 0.4 * S, head); c.rotation.z = (i % 4 - 1.5) * 0.25; } }
    if (hs === 'long') { top(0.5, 0.1); add(rbox(1.3 * S, 1.5 * S, 0.3 * S, 0.1), hairM, 0, -0.25 * S, -0.62 * S, head); }
    if (hs === 'bun') { top(0.45); add(new THREE.SphereGeometry(0.3 * S, 12, 10), hairM, 0, 0.95 * S, -0.35 * S, head); }
    if (hs === 'curly') for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; add(new THREE.SphereGeometry(0.24 * S, 10, 8), hairM, Math.cos(a) * 0.52 * S, (0.55 + (i % 3) * 0.1) * S, Math.sin(a) * 0.52 * S - 0.05 * S, head); }
    // hats
    const hatM = mat(cfg.hat === 'crown' ? '#f5c518' : cfg.shirt, cfg.hat === 'crown' ? 0.25 : 0.6, cfg.hat === 'crown' ? { metalness: 0.9 } : {});
    if (cfg.hat === 'cap') { add(new THREE.CylinderGeometry(0.66 * S, 0.66 * S, 0.4 * S, 24), hatM, 0, 0.75 * S, 0, head); add(rbox(1.0 * S, 0.08 * S, 0.7 * S, 0.03), hatM, 0, 0.58 * S, 0.8 * S, head); }
    if (cfg.hat === 'beanie') { add(new THREE.SphereGeometry(0.68 * S, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#8e2b2b', 0.9), 0, 0.5 * S, 0, head); add(new THREE.SphereGeometry(0.16 * S, 10, 8), mat('#f2f2f2', 0.9), 0, 1.2 * S, 0, head); }
    if (cfg.hat === 'crown') { const cr = add(new THREE.CylinderGeometry(0.55 * S, 0.5 * S, 0.45 * S, 8, 1, true), hatM, 0, 0.95 * S, 0, head); cr.material.side = THREE.DoubleSide; for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; add(new THREE.ConeGeometry(0.08 * S, 0.3 * S, 4), hatM, Math.cos(a) * 0.52 * S, 1.3 * S, Math.sin(a) * 0.52 * S, head); } }
    if (cfg.hat === 'headphones') { const hp = mat('#222', 0.4, { metalness: 0.5 }); add(new THREE.TorusGeometry(0.66 * S, 0.06 * S, 8, 24, Math.PI), hp, 0, 0.1 * S, 0, head); for (const sx of [-1, 1]) add(rbox(0.25 * S, 0.5 * S, 0.5 * S, 0.06), mat(cfg.shirt, 0.5), sx * 0.68 * S, 0.05 * S, 0, head); }
    if (cfg.hat === 'tophat') { add(new THREE.CylinderGeometry(0.5 * S, 0.5 * S, 0.9 * S, 20), mat('#1a1a1a', 0.5), 0, 1.15 * S, 0, head); add(new THREE.CylinderGeometry(0.85 * S, 0.85 * S, 0.06 * S, 24), mat('#1a1a1a', 0.5), 0, 0.72 * S, 0, head); }
    // arms and legs pivot at the top so they can swing
    const limb = (x, y, m, endM) => {
      const p = new THREE.Group(); p.position.set(x, y, 0); body.add(p);
      add(rbox(S * 0.98, 2 * S, S * 0.98, 0.05), m, 0, -S, 0, p);
      if (endM) add(rbox(S * 1.0, 0.35 * S, S * 1.08, 0.04), endM, 0, -1.85 * S, 0.04 * S, p);
      return p;
    };
    const sleeve = cfg.top === 'plain' || cfg.top === 'stripes' ? skin : shirt;
    this.armL = limb(-1.5 * S, 4 * S, sleeve); this.armR = limb(1.5 * S, 4 * S, sleeve);
    if (sleeve === skin) for (const a of [this.armL, this.armR]) add(rbox(S * 1.02, 0.6 * S, S * 1.02, 0.04), shirt, 0, -0.3 * S, 0, a);
    this.legL = limb(-0.5 * S, 2 * S, pants, shoes); this.legR = limb(0.5 * S, 2 * S, pants, shoes);
    const k = cfg.height || 1; body.scale.setScalar(k);
    if (role !== 'bot') { this.label = nameSprite(name, role); this.label.position.y = 2.25 * k; this.group.add(this.label); }
    if (cfg.pet && cfg.pet !== 'none') this.pet = makePet(cfg.pet);
    this.phase = 0; this.emote = null; this.emoteT = 0;
  }
  play(emote) { this.emote = emote; this.emoteT = 0; }
  animate(speed, dt, air) {
    const k = Math.min(1, speed / 6), run = speed > 6.5;
    this.phase += dt * (4 + speed * 1.3);
    const s = Math.sin(this.phase), amp = air ? 0.5 : (run ? 1.0 : 0.75) * k;
    const reset = () => { this.body.rotation.set(0, 0, 0); this.head.rotation.set(0, 0, 0); this.armL.rotation.set(0, 0, 0); this.armR.rotation.set(0, 0, 0); this.legL.rotation.set(0, 0, 0); this.legR.rotation.set(0, 0, 0); };
    if (this.emote && (speed > 0.5 || air)) this.emote = null;
    if (this.emote) {
      this.emoteT += dt; const t = this.emoteT; reset(); this.body.position.y = 0;
      if (this.emote === 'wave') { this.armR.rotation.z = 2.6 + Math.sin(t * 10) * 0.35; this.head.rotation.z = Math.sin(t * 3) * 0.08; if (t > 3) this.emote = null; }
      if (this.emote === 'dance') { const b = Math.sin(t * 8); this.armL.rotation.z = -1.2 - b * 0.9; this.armR.rotation.z = 1.2 - b * 0.9; this.legL.rotation.z = Math.max(0, b) * 0.35; this.legR.rotation.z = Math.min(0, b) * 0.35; this.body.position.y = Math.abs(b) * 0.08; this.body.rotation.y = Math.sin(t * 2) * 0.6; this.head.rotation.x = Math.sin(t * 16) * 0.12; }
      if (this.emote === 'cheer') { this.armL.rotation.z = -2.8; this.armR.rotation.z = 2.8; this.body.position.y = Math.abs(Math.sin(t * 7)) * 0.35; if (t > 3) this.emote = null; }
      if (this.emote === 'sit') { this.legL.rotation.x = this.legR.rotation.x = -1.5; this.body.position.y = -0.62; this.armL.rotation.x = this.armR.rotation.x = -0.4; }
      return;
    }
    reset();
    this.legL.rotation.x = s * amp; this.legR.rotation.x = -s * amp;
    this.armL.rotation.x = -s * amp * 0.9; this.armR.rotation.x = s * amp * 0.9;
    if (air) { this.armL.rotation.z = -0.5; this.armR.rotation.z = 0.5; }
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.05 * k;
    if (k < 0.05 && !air) { this.body.position.y = 0; this.armL.rotation.z = -0.04; this.armR.rotation.z = 0.04; }
  }
  // pets follow their owner; call every frame with the owner's world position
  updatePet(scene, dt) {
    if (!this.pet) return;
    if (!this.pet.parent) { scene.add(this.pet); this.pet.position.copy(this.group.position); }
    const g = this.group.position, ry = this.group.rotation.y, tx = g.x - Math.sin(ry) * 1.3 + Math.cos(ry) * 0.9, tz = g.z - Math.cos(ry) * 1.3 - Math.sin(ry) * 0.9;
    const p = this.pet.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d > 25) p.set(tx, g.y, tz);
    else if (d > 0.3) { const sp = Math.min(d * 3, 12) * dt; p.x += dx / d * sp; p.z += dz / d * sp; this.pet.rotation.y = Math.atan2(dx, dz); this.pet.userData.hop = (this.pet.userData.hop || 0) + dt * 12; }
    p.y += ((g.y) + (this.pet.userData.fly ? 1.4 + Math.sin(performance.now() / 300) * 0.2 : Math.abs(Math.sin(this.pet.userData.hop || 0)) * (d > 0.3 ? 0.12 : 0)) - p.y) * Math.min(1, dt * 10);
    this.pet.visible = this.group.visible;
  }
  removePet() { if (this.pet && this.pet.parent) this.pet.parent.remove(this.pet); }
  setGhost(on) { this.mats.forEach(m => { m.transparent = true; m.opacity = on ? 0.3 : 1; }); if (this.label) this.label.material.opacity = on ? 0.4 : 1; }
}

export function makePet(type) {
  const g = new THREE.Group(), S = 0.22;
  const col = { dog: '#c08a4f', cat: '#8a8f99', bunny: '#f2efe9', dragon: '#3fa34d' }[type] || '#c08a4f';
  const m = mat(col, 0.6), dark = mat('#1a1a1a', 0.4), pink = mat('#ff9eb5', 0.5);
  const add = (geo, mm, x, y, z) => { const o = new THREE.Mesh(geo, mm); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  add(rbox(1.4 * S, 1.1 * S, 2.0 * S, 0.06), m, 0, 1.0 * S, 0);
  add(rbox(1.2 * S, 1.1 * S, 1.1 * S, 0.06), m, 0, 1.9 * S, 1.0 * S);
  for (const sx of [-0.3, 0.3]) add(new THREE.SphereGeometry(0.1 * S, 8, 6), dark, sx * S, 2.05 * S, 1.57 * S);
  add(new THREE.SphereGeometry(0.13 * S, 8, 6), type === 'cat' || type === 'bunny' ? pink : dark, 0, 1.8 * S, 1.6 * S);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(rbox(0.4 * S, 0.6 * S, 0.4 * S, 0.04), m, sx * 0.45 * S, 0.3 * S, sz * 0.65 * S);
  if (type === 'dog') { for (const sx of [-1, 1]) add(rbox(0.3 * S, 0.7 * S, 0.5 * S, 0.04), mat('#7a5230', 0.6), sx * 0.65 * S, 1.8 * S, 0.9 * S); add(rbox(0.25 * S, 0.25 * S, 0.8 * S, 0.04), m, 0, 1.45 * S, -1.2 * S).rotation.x = 0.6; }
  if (type === 'cat') { for (const sx of [-1, 1]) add(new THREE.ConeGeometry(0.22 * S, 0.5 * S, 4), m, sx * 0.4 * S, 2.65 * S, 1.0 * S); add(rbox(0.2 * S, 1.2 * S, 0.2 * S, 0.04), m, 0, 1.6 * S, -1.1 * S).rotation.x = -0.4; }
  if (type === 'bunny') { for (const sx of [-1, 1]) add(rbox(0.25 * S, 1.1 * S, 0.2 * S, 0.06), m, sx * 0.3 * S, 2.9 * S, 0.9 * S); add(new THREE.SphereGeometry(0.3 * S, 10, 8), m, 0, 1.1 * S, -1.1 * S); }
  if (type === 'dragon') { g.userData.fly = true; for (const sx of [-1, 1]) { const wg = add(new THREE.ConeGeometry(0.6 * S, 1.6 * S, 3), mat('#2b7a3a', 0.6), sx * 1.0 * S, 1.6 * S, 0); wg.rotation.z = sx * 1.4; } add(new THREE.ConeGeometry(0.15 * S, 0.4 * S, 6), mat('#f5d24b'), 0, 2.6 * S, 1.0 * S); }
  return g;
}

// ---------------- Avatar creator ----------------
export function avatarCreator(el, { t, cfg, name, onSave, onCancel }) {
  cfg = { ...randomAvatar(), ...(cfg || {}) };
  el.innerHTML = `
    <div class="creator">
      <div class="creator-view"><canvas id="acCanvas"></canvas><button class="btn ghost" id="acRandom">${t('randomize')}</button></div>
      <div class="creator-opts">
        <label class="field"><span>${t('displayName')}</span><input id="acName" maxlength="20" value=""></label>
        <div id="acRows"></div>
        <div class="row"><button class="btn primary" id="acSave">${t('saveAvatar')}</button>${onCancel ? `<button class="btn ghost" id="acCancel">${t('cancel')}</button>` : ''}</div>
      </div>
    </div>`;
  el.querySelector('#acName').value = name || '';
  const rows = [
    ['skin', t('skin'), SKINS, 'swatch'], ['face', t('face'), FACES, 'text'], ['hair', t('hairStyle'), HAIRSTYLES, 'text'], ['hairColor', t('hairColor'), HAIR_COLORS, 'swatch'],
    ['top', t('top'), TOPS, 'text'], ['shirt', t('topColor'), CLOTH, 'swatch'], ['pants', t('pants'), PANTS, 'swatch'], ['shoes', t('shoes'), SHOES, 'swatch'],
    ['hat', t('hat'), HATS, 'text'], ['pet', t('pet'), PETS, 'text'], ['height', t('height'), [0.9, 0.95, 1, 1.05, 1.1], 'text'],
  ];
  const label = (k, v) => k === 'height' ? Math.round(v * 165) + ' cm' : t('opt_' + v);
  const box = el.querySelector('#acRows');
  const draw = () => {
    box.innerHTML = rows.map(([k, title, vals, kind]) => `<div class="opt-row"><span>${title}</span><div class="opts">${vals.map((v, i) =>
      kind === 'swatch' ? `<button class="sw${cfg[k] === v ? ' on' : ''}" data-k="${k}" data-i="${i}" style="background:${v}" aria-label="${v}"></button>`
        : `<button class="chip${cfg[k] === v ? ' on' : ''}" data-k="${k}" data-i="${i}">${label(k, v)}</button>`).join('')}</div></div>`).join('');
  };
  draw();
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; const r = rows.find(x => x[0] === b.dataset.k); cfg[r[0]] = r[2][+b.dataset.i]; draw(); rebuild(); };

  const cv = el.querySelector('#acCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 1.3, 4.6); cam.lookAt(0, 1.05, 0);
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x4a4036, 1.3));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(2, 3, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 1.3); rim.position.set(-3, 2, -2); scene.add(rim);
  scene.add(new THREE.Mesh(new THREE.CircleGeometry(1.1, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.9 })));
  let av = null, rot = 0.4, drag = null, raf, emoteT = 0;
  const rebuild = () => { if (av) { scene.remove(av.group); if (av.pet) scene.remove(av.pet); } av = new Avatar(cfg, '', 'bot'); scene.add(av.group); if (av.pet) { av.pet.position.set(0.9, 0, 0.4); scene.add(av.pet); } av.play('wave'); };
  rebuild();
  cv.addEventListener('pointerdown', e => { drag = e.clientX; });
  addEventListener('pointerup', () => { drag = null; });
  cv.addEventListener('pointermove', e => { if (drag !== null) { rot += (e.clientX - drag) * 0.01; drag = e.clientX; } });
  const loop = () => {
    const w = cv.clientWidth, h = cv.clientHeight;
    if (cv.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (drag === null) rot += 0.004; av.group.rotation.y = rot; av.animate(0, 0.016, false);
    if ((emoteT += 0.016) > 6) { emoteT = 0; av.play(['wave', 'dance', 'cheer'][Math.floor(Math.random() * 3)]); }
    if (av.pet) av.pet.rotation.y = rot + 0.6;
    renderer.render(scene, cam); raf = requestAnimationFrame(loop);
  };
  loop();
  const close = () => { cancelAnimationFrame(raf); renderer.dispose(); };
  el.querySelector('#acRandom').onclick = () => { cfg = randomAvatar(); draw(); rebuild(); };
  el.querySelector('#acSave').onclick = () => {
    const n = el.querySelector('#acName').value.replace(/[<>]/g, '').trim();
    if (n.length < 2) { el.querySelector('#acName').focus(); el.querySelector('#acName').classList.add('bad'); return; }
    close(); onSave(cfg, n);
  };
  if (onCancel) el.querySelector('#acCancel').onclick = () => { close(); onCancel(); };
}
