// Human avatar model + avatar creator
import * as THREE from 'three';

export const SKINS = ['#f6d7c3', '#eac09c', '#d39b72', '#b07850', '#8a5a3b', '#5e3b26'];
export const HAIR_COLORS = ['#1c1410', '#3b2414', '#6b4423', '#a8743f', '#d9b36c', '#8f2f1f', '#9a9a9a'];
export const CLOTH = ['#1f3b5c', '#2e5e3a', '#7a1f2b', '#d9d4c7', '#2b2b2e', '#c46a1a', '#4b3a75', '#3f7fb5', '#c9a227', '#e6e6e6'];
export const PANTS = ['#22293a', '#3a3f4a', '#5a4632', '#6b6f78', '#1d1d1f', '#7b8a9c'];
export const SHOES = ['#f2f2f2', '#1b1b1b', '#6b3f22', '#b3312c'];
export const HAIRSTYLES = ['short', 'long', 'bun', 'curly', 'buzz'];
export const TOPS = ['tshirt', 'hoodie', 'jacket', 'shirt'];
export const HATS = ['none', 'cap', 'beanie'];

export function randomAvatar() {
  const p = a => a[Math.floor(Math.random() * a.length)];
  return { skin: p(SKINS), hair: p(HAIRSTYLES), hairColor: p(HAIR_COLORS), top: p(TOPS), shirt: p(CLOTH), pants: p(PANTS), shoes: p(SHOES), hat: 'none', glasses: false, height: 1 };
}

const std = (color, rough = 0.75, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

function nameSprite(text, role) {
  const c = document.createElement('canvas'), g = c.getContext('2d'), fs = 40;
  g.font = `600 ${fs}px system-ui, sans-serif`;
  const label = (role === 'teacher' ? '★ ' : '') + text;
  const w = Math.ceil(g.measureText(label).width) + 28; c.width = w; c.height = fs + 20;
  g.font = `600 ${fs}px system-ui, sans-serif`;
  g.fillStyle = 'rgba(12,16,24,0.55)'; g.beginPath(); g.roundRect(0, 0, w, c.height, 12); g.fill();
  g.fillStyle = role === 'teacher' ? '#ffd76a' : '#ffffff'; g.textBaseline = 'middle'; g.fillText(label, 14, c.height / 2 + 1);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(0.32 * w / c.height, 0.32, 1); s.renderOrder = 10;
  return s;
}

export class Avatar {
  constructor(cfg, name = '', role = 'student') {
    cfg = { ...randomAvatar(), ...(cfg || {}) };
    this.cfg = cfg; this.group = new THREE.Group();
    const body = this.body = new THREE.Group(); this.group.add(body);
    const skin = std(cfg.skin, 0.6), shirt = std(cfg.shirt, 0.85), pants = std(cfg.pants, 0.9), shoes = std(cfg.shoes, 0.5), hairM = std(cfg.hairColor, 0.9);
    this.mats = [skin, shirt, pants, shoes, hairM];
    const add = (geo, mat, x, y, z, parent = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
    const cap = (r, l) => new THREE.CapsuleGeometry(r, l, 6, 12);

    // torso
    const torso = add(cap(0.19, 0.36), shirt, 0, 1.28, 0); torso.scale.set(1.12, 1, 0.68);
    add(cap(0.17, 0.08), pants, 0, 0.98, 0).scale.set(1.1, 1, 0.72);
    if (cfg.top === 'hoodie') { const hood = add(new THREE.TorusGeometry(0.13, 0.05, 8, 16, Math.PI), shirt, 0, 1.52, -0.08); hood.rotation.x = -0.4; }
    if (cfg.top === 'jacket') { add(new THREE.BoxGeometry(0.1, 0.42, 0.02), std('#e8e4dc', 0.8), 0, 1.3, 0.135); }
    if (cfg.top === 'shirt') { add(new THREE.ConeGeometry(0.07, 0.08, 3), std('#f4f4f4', 0.7), 0, 1.5, 0.11).rotation.x = Math.PI; }
    add(new THREE.CylinderGeometry(0.055, 0.06, 0.1, 10), skin, 0, 1.56, 0);
    // head
    const head = this.head = new THREE.Group(); head.position.set(0, 1.71, 0); body.add(head);
    add(new THREE.SphereGeometry(0.115, 24, 18), skin, 0, 0, 0, head).scale.set(0.92, 1.12, 1);
    add(new THREE.SphereGeometry(0.03, 8, 8), skin, 0, -0.01, 0.11, head).scale.set(0.7, 1, 0.8);
    for (const sx of [-1, 1]) {
      add(new THREE.SphereGeometry(0.014, 8, 8), std('#1a1a1a', 0.3), sx * 0.04, 0.025, 0.1, head);
      add(new THREE.SphereGeometry(0.028, 8, 8), skin, sx * 0.108, 0, 0, head).scale.set(0.5, 1, 0.8);
      add(new THREE.BoxGeometry(0.04, 0.008, 0.01), hairM, sx * 0.04, 0.055, 0.105, head);
    }
    add(new THREE.BoxGeometry(0.045, 0.008, 0.01), std('#a8504a', 0.6), 0, -0.055, 0.105, head);
    // hair
    const hs = cfg.hair;
    if (hs !== 'buzz') { const top = add(new THREE.SphereGeometry(0.125, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hairM, 0, 0.012, -0.008, head); top.scale.set(0.95, 1.15, 1.05); }
    else add(new THREE.SphereGeometry(0.118, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM, 0, 0.01, -0.004, head).scale.set(0.93, 1.13, 1.01);
    if (hs === 'long') { const b = add(cap(0.1, 0.18), hairM, 0, -0.1, -0.06, head); b.scale.set(1.1, 1, 0.55); }
    if (hs === 'bun') add(new THREE.SphereGeometry(0.055, 12, 10), hairM, 0, 0.1, -0.09, head);
    if (hs === 'curly') for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; add(new THREE.SphereGeometry(0.04, 8, 6), hairM, Math.cos(a) * 0.1, 0.07 + Math.sin(i * 1.7) * 0.02, Math.sin(a) * 0.09 - 0.01, head); }
    if (cfg.hat === 'cap') { add(new THREE.SphereGeometry(0.128, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), shirt, 0, 0.03, 0, head); add(new THREE.CylinderGeometry(0.09, 0.09, 0.01, 16, 1, false, -Math.PI / 2, Math.PI), shirt, 0, 0.035, 0.08, head); }
    if (cfg.hat === 'beanie') add(new THREE.SphereGeometry(0.13, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), std('#5a2a2a', 0.95), 0, 0.03, 0, head).scale.set(0.96, 1.2, 1.02);
    if (cfg.glasses) for (const sx of [-1, 1]) { const r = add(new THREE.TorusGeometry(0.026, 0.004, 6, 16), std('#111', 0.3), sx * 0.042, 0.022, 0.112, head); }
    if (role === 'teacher') { const lan = add(new THREE.BoxGeometry(0.06, 0.08, 0.01), std('#f2f2f2', 0.4), 0.08, 1.38, 0.13); lan.rotation.z = 0.1; }

    // limbs: pivot groups so we can swing them
    const limb = (x, y, upR, upL, loR, loL, upM, loM, end) => {
      const top = new THREE.Group(); top.position.set(x, y, 0); body.add(top);
      add(cap(upR, upL), upM, 0, -upL / 2 - upR, 0, top);
      const joint = new THREE.Group(); joint.position.y = -upL - upR * 1.6; top.add(joint);
      add(cap(loR, loL), loM, 0, -loL / 2 - loR, 0, joint);
      end(joint, -loL - loR * 2);
      return { top, joint };
    };
    const sleeveLo = cfg.top === 'tshirt' ? skin : shirt;
    this.armL = limb(-0.25, 1.48, 0.052, 0.22, 0.045, 0.2, shirt, sleeveLo, (j, y) => add(new THREE.SphereGeometry(0.045, 10, 8), skin, 0, y, 0.01, j));
    this.armR = limb(0.25, 1.48, 0.052, 0.22, 0.045, 0.2, shirt, sleeveLo, (j, y) => add(new THREE.SphereGeometry(0.045, 10, 8), skin, 0, y, 0.01, j));
    const foot = (j, y) => { const s = add(new THREE.BoxGeometry(0.1, 0.07, 0.24, 2, 2, 2), shoes, 0, y + 0.01, 0.05, j); };
    this.legL = limb(-0.095, 0.93, 0.072, 0.34, 0.06, 0.34, pants, pants, foot);
    this.legR = limb(0.095, 0.93, 0.072, 0.34, 0.06, 0.34, pants, pants, foot);
    this.armL.top.rotation.z = 0.08; this.armR.top.rotation.z = -0.08;

    body.scale.setScalar(cfg.height || 1);
    this.label = nameSprite(name, role); this.label.position.y = 2.15 * (cfg.height || 1); this.group.add(this.label);
    this.phase = 0;
  }
  animate(speed, dt, air) {
    const k = Math.min(1, speed / 7), run = speed > 8;
    this.phase += dt * (3 + speed * 1.1);
    const s = Math.sin(this.phase), amp = air ? 0.4 : (run ? 0.9 : 0.6) * k;
    this.legL.top.rotation.x = s * amp; this.legR.top.rotation.x = -s * amp;
    this.legL.joint.rotation.x = Math.max(0, -Math.cos(this.phase) * amp * 1.3) + (air ? 0.6 : 0);
    this.legR.joint.rotation.x = Math.max(0, Math.cos(this.phase) * amp * 1.3) + (air ? 0.6 : 0);
    this.armL.top.rotation.x = -s * amp * 0.8; this.armR.top.rotation.x = s * amp * 0.8;
    this.armL.joint.rotation.x = this.armR.joint.rotation.x = -(0.15 + k * (run ? 0.9 : 0.4));
    this.body.position.y = Math.abs(Math.cos(this.phase)) * 0.04 * k;
    this.body.rotation.x = run ? 0.12 : 0.03 * k;
    if (k < 0.05 && !air) { const b = Math.sin(performance.now() / 900) * 0.01; this.body.position.y = b; this.armL.top.rotation.x *= 0.9; this.armR.top.rotation.x *= 0.9; }
  }
  setGhost(on) { this.mats.forEach(m => { m.transparent = on; m.opacity = on ? 0.3 : 1; }); this.label.material.opacity = on ? 0.4 : 1; }
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
    ['skin', t('skin'), SKINS, 'swatch'], ['hair', t('hairStyle'), HAIRSTYLES, 'text'], ['hairColor', t('hairColor'), HAIR_COLORS, 'swatch'],
    ['top', t('top'), TOPS, 'text'], ['shirt', t('topColor'), CLOTH, 'swatch'], ['pants', t('pants'), PANTS, 'swatch'],
    ['shoes', t('shoes'), SHOES, 'swatch'], ['hat', t('hat'), HATS, 'text'], ['glasses', t('glasses'), [false, true], 'text'], ['height', t('height'), [0.9, 0.95, 1, 1.05, 1.1], 'text'],
  ];
  const label = (k, v) => k === 'glasses' ? (v ? t('yes') : t('no')) : k === 'height' ? Math.round(v * 165) + ' cm' : (t('opt_' + v) || v);
  const box = el.querySelector('#acRows');
  const draw = () => {
    box.innerHTML = rows.map(([k, title, vals, kind]) => `<div class="opt-row"><span>${title}</span><div class="opts">${vals.map((v, i) =>
      kind === 'swatch' ? `<button class="sw${cfg[k] === v ? ' on' : ''}" data-k="${k}" data-i="${i}" style="background:${v}" aria-label="${v}"></button>`
        : `<button class="chip${cfg[k] === v ? ' on' : ''}" data-k="${k}" data-i="${i}">${label(k, v)}</button>`).join('')}</div></div>`).join('');
  };
  draw();
  box.onclick = e => { const b = e.target.closest('button'); if (!b) return; const r = rows.find(x => x[0] === b.dataset.k); cfg[r[0]] = r[2][+b.dataset.i]; draw(); rebuild(); };

  const canvas = el.querySelector('#acCanvas');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  cam.position.set(0, 1.25, 4.2); cam.lookAt(0, 1.05, 0);
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x4a4036, 1.2));
  const key = new THREE.DirectionalLight(0xffffff, 2.2); key.position.set(2, 3, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 1.2); rim.position.set(-3, 2, -2); scene.add(rim);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.8, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x2a3140, roughness: 0.9 })); scene.add(floor);
  let av = null, rot = 0.4, drag = null, raf;
  const rebuild = () => { if (av) scene.remove(av.group); av = new Avatar(cfg, '', 'student'); av.label.visible = false; scene.add(av.group); };
  rebuild();
  canvas.addEventListener('pointerdown', e => { drag = e.clientX; });
  addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('pointermove', e => { if (drag !== null) { rot += (e.clientX - drag) * 0.01; drag = e.clientX; } });
  const loop = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio())) { renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (drag === null) rot += 0.004; av.group.rotation.y = rot; av.animate(0, 0.016, false);
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
