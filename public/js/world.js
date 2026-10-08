// 3D world: islands, ocean, sky, portals, avatars, effects.
import * as THREE from 'three';

// ---------- deterministic noise ----------
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, z) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < 5; i++) { s += a * vnoise(x * f, z * f); f *= 2.03; a *= 0.5; } return s; }
const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export const ISLANDS = [
  { id: 'hub', x: 0, z: 0, r: 75, h: 5, rough: 0.8, color: 0xffd34d },
  { id: 'math', x: 210, z: -30, r: 60, h: 10, rough: 1.4, color: 0x4da3ff },
  { id: 'lang', x: -210, z: -20, r: 60, h: 9, rough: 1.3, color: 0xff6b9a },
  { id: 'arcade', x: 20, z: 210, r: 60, h: 7, rough: 1.1, color: 0x7bff6b },
  { id: 'sports', x: 0, z: -235, r: 85, h: 3, rough: 0.5, color: 0xff9f43 },
  { id: 'teacher', x: 200, z: 200, r: 55, h: 8, rough: 1.0, color: 0xb36bff },
];
const isl = id => ISLANDS.find(i => i.id === id);

// Flat areas (plazas, pitch, court): {x,z,hw,hd,h}
export const PITCH = { x: 0, z: -215, hw: 30, hd: 18, h: 3 };   // football pitch, goals at x = ±30
export const COURT = { x: 0, z: -262, hw: 16, hd: 10, h: 3 };   // dodgeball, center line z = COURT.z
const FLATS = [
  { x: 0, z: 0, r: 26, h: 5 }, { x: 210, z: -30, r: 22, h: 6 }, { x: -210, z: -20, r: 22, h: 6 },
  { x: 20, z: 210, r: 22, h: 5 }, { x: 200, z: 200, r: 24, h: 6 },
  { ...PITCH, hw: PITCH.hw + 8, hd: PITCH.hd + 6 }, { ...COURT, hw: COURT.hw + 6, hd: COURT.hd + 6 }, { x: 0, z: -235, r: 14, h: 3 },
];

export function heightAt(x, z) {
  let best = -7;
  for (const I of ISLANDS) {
    const dx = x - I.x, dz = z - I.z, d = Math.sqrt(dx * dx + dz * dz) / I.r;
    if (d > 1.3) continue;
    const n = fbm(x * 0.025 + I.x, z * 0.025 + I.z);
    const fall = smooth(1.2, 0.55, d + (n - 0.5) * 0.35);
    let h = -7 + (I.h + 7) * fall + (fbm(x * 0.06, z * 0.06) - 0.5) * I.h * I.rough * fall;
    if (h > best) best = h;
  }
  for (const F of FLATS) {
    let w;
    if (F.r) { const d = Math.hypot(x - F.x, z - F.z); w = smooth(F.r + 8, F.r, d); }
    else { const ox = Math.abs(x - F.x) - F.hw, oz = Math.abs(z - F.z) - F.hd; w = smooth(8, 0, Math.max(ox, oz, 0)); }
    if (w > 0) best = best + (F.h - best) * w;
  }
  return best;
}

function textCanvas(text, { size = 48, color = '#fff', bg = 'rgba(0,0,0,0.45)', pad = 16, font = 'bold' } = {}) {
  const c = document.createElement('canvas'), g = c.getContext('2d');
  g.font = `${font} ${size}px system-ui, sans-serif`;
  const w = Math.ceil(g.measureText(text).width) + pad * 2, h = size + pad * 2;
  c.width = w; c.height = h;
  g.font = `${font} ${size}px system-ui, sans-serif`;
  if (bg) { g.fillStyle = bg; g.beginPath(); g.roundRect(0, 0, w, h, h / 2); g.fill(); }
  g.fillStyle = color; g.textBaseline = 'middle'; g.textAlign = 'center';
  g.fillText(text, w / 2, h / 2 + 2);
  return c;
}
export function textSprite(text, height = 0.6, opts) {
  const c = textCanvas(text, opts), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  s.scale.set(height * c.width / c.height, height, 1);
  s.renderOrder = 10;
  return s;
}

// ---------- Avatar ----------
export class Avatar {
  constructor(color, name, role) {
    this.group = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xffd7b0, roughness: 0.7 });
    const cloth = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x2b3a67, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.55, 4, 12), cloth); body.position.y = 1.05;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), skin); head.position.y = 1.78;
    const eyeM = new THREE.MeshBasicMaterial({ color: 0x111111 });
    for (const sx of [-0.12, 0.12]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), eyeM); e.position.set(sx, 1.82, 0.3); this.group.add(e); }
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.36, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), new THREE.MeshStandardMaterial({ color: 0x3a2412 }));
    hair.position.y = 1.82; hair.rotation.x = -0.25;
    this.group.add(body, head, hair);
    if (role === 'teacher') {
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.3, 0.22, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.25, side: THREE.DoubleSide }));
      crown.position.y = 2.18; this.group.add(crown);
    }
    const limb = (r, l, m, x, y) => { const p = new THREE.Group(); const g = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 4, 8), m); g.position.y = -l / 2 - r; p.add(g); p.position.set(x, y, 0); this.group.add(p); return p; };
    this.armL = limb(0.11, 0.45, cloth, -0.5, 1.4); this.armR = limb(0.11, 0.45, cloth, 0.5, 1.4);
    this.legL = limb(0.14, 0.4, pants, -0.18, 0.7); this.legR = limb(0.14, 0.4, pants, 0.18, 0.7);
    this.group.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
    this.label = textSprite((role === 'teacher' ? '👑 ' : '') + name, 0.42);
    this.label.position.y = 2.65; this.group.add(this.label);
    this.phase = 0;
  }
  animate(speed, dt, airborne) {
    this.phase += dt * speed * 1.6;
    const a = airborne ? 0.6 : Math.sin(this.phase) * Math.min(1, speed / 6) * 0.9;
    this.legL.rotation.x = a; this.legR.rotation.x = -a; this.armL.rotation.x = -a; this.armR.rotation.x = a;
  }
  setName(name, role) {
    this.group.remove(this.label);
    this.label = textSprite((role === 'teacher' ? '👑 ' : '') + name, 0.42);
    this.label.position.y = 2.65; this.group.add(this.label);
  }
}

// ---------- World ----------
export class World {
  constructor(canvas) {
    this.canvas = canvas;
    const r = this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 2500);
    this.clock = new THREE.Clock();
    this.updaters = [];
    this.portals = [];
    this.remotes = {};
    this.effects = {};
    this.keys = {};
    this.joy = { x: 0, y: 0 };
    this.yaw = Math.PI; this.pitch = 0.35; this.dist = 9;
    this.vel = new THREE.Vector3(); this.onGround = false;
    this.frozenUntil = 0; this.constrain = null; this.inputLocked = false;
    this.stars = [];
    this._build();
    this._input();
    addEventListener('resize', () => this.resize()); this.resize();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  _build() {
    const S = this.scene;
    // sky dome
    this.skyU = { top: { value: new THREE.Color(0x2f7fe0) }, bottom: { value: new THREE.Color(0xcfe8ff) }, sunDir: { value: new THREE.Vector3(0.4, 0.55, -0.6).normalize() }, night: { value: 0 } };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, uniforms: this.skyU,
      vertexShader: 'varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: `uniform vec3 top,bottom,sunDir; uniform float night; varying vec3 vD;
        float h(vec3 p){ return fract(sin(dot(p,vec3(12.9898,78.233,45.5)))*43758.5); }
        void main(){ float y=max(vD.y,0.); vec3 c=mix(bottom,top,pow(y,0.55));
          float s=max(dot(vD,sunDir),0.); c+=vec3(1.,0.85,0.6)*(pow(s,600.)*3.+pow(s,8.)*0.25)*(1.-night);
          vec3 q=floor(vD*300.); float st=step(0.997,h(q))*night*smoothstep(0.,0.3,vD.y); c+=vec3(st);
          c+=vec3(0.9,0.9,1.)*pow(s,900.)*night*2.; gl_FragColor=vec4(c,1.); }`,
    }));
    S.add(sky); this.sky = sky;
    S.fog = new THREE.Fog(0xcfe8ff, 120, 900);

    this.hemi = new THREE.HemisphereLight(0xcfe8ff, 0x6b8f4e, 0.9); S.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera; sc.left = sc.bottom = -60; sc.right = sc.top = 60; sc.near = 1; sc.far = 300;
    sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.03;
    S.add(sun, sun.target);

    // ocean
    this.waterU = { uTime: { value: 0 }, uSun: { value: this.skyU.sunDir.value }, fogColor: { value: new THREE.Color(0xcfe8ff) }, night: { value: 0 } };
    const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000, 220, 220).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({
      uniforms: this.waterU, transparent: true,
      vertexShader: `uniform float uTime; varying vec3 vW;
        void main(){ vec4 w=modelMatrix*vec4(position,1.);
          w.y+=sin(w.x*0.05+uTime)*0.25+sin(w.z*0.07+uTime*1.3)*0.2+sin((w.x+w.z)*0.15+uTime*2.)*0.08;
          vW=w.xyz; gl_Position=projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform float uTime,night; uniform vec3 uSun,fogColor; varying vec3 vW;
        void main(){ vec3 n=normalize(cross(dFdx(vW),dFdy(vW))); if(n.y<0.) n=-n;
          n=normalize(n+vec3(sin(vW.x*0.9+uTime*2.1)+sin(vW.z*1.7-uTime*1.4),0.,cos(vW.z*0.8+uTime*1.8)+cos(vW.x*1.3+uTime))*0.06);
          vec3 v=normalize(cameraPosition-vW); float fr=pow(1.-max(dot(n,v),0.),3.);
          vec3 deep=mix(vec3(0.02,0.25,0.42),vec3(0.01,0.04,0.1),night), shal=mix(vec3(0.1,0.6,0.7),vec3(0.03,0.1,0.2),night);
          vec3 c=mix(shal,deep,clamp(length(vW.xz)/1200.,0.,1.)*0.4+0.4);
          c=mix(c,fogColor,fr*0.6);
          vec3 h=normalize(uSun+v); c+=vec3(1.,0.9,0.7)*pow(max(dot(n,h),0.),180.)*1.5*(1.-night);
          float d=length(cameraPosition-vW); c=mix(c,fogColor,smoothstep(150.,1000.,d));
          gl_FragColor=vec4(c,0.92); }`,
    }));
    water.renderOrder = 1; S.add(water); this.water = water;
    const bed = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0xc9b98a }));
    bed.position.y = -7; S.add(bed);

    // islands
    const sand = new THREE.Color(0xe3d29b), grass1 = new THREE.Color(0x4f8a35), grass2 = new THREE.Color(0x7bb34a), rock = new THREE.Color(0x7d7468), snow = new THREE.Color(0xf4f6ff), dirt = new THREE.Color(0x8a6a44);
    const tmp = new THREE.Color();
    for (const I of ISLANDS) {
      const size = I.r * 2.7, seg = 150;
      const g = new THREE.PlaneGeometry(size, size, seg, seg).rotateX(-Math.PI / 2);
      const pos = g.attributes.position, cols = new Float32Array(pos.count * 3);
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i) + I.x, z = pos.getZ(i) + I.z, h = heightAt(x, z);
        pos.setY(i, h);
        const slope = Math.abs(heightAt(x + 1, z) - h) + Math.abs(heightAt(x, z + 1) - h);
        const n = vnoise(x * 0.15, z * 0.15);
        if (h < 0.8) tmp.copy(sand);
        else if (h < 1.4) tmp.copy(sand).lerp(grass2, (h - 0.8) / 0.6);
        else tmp.copy(grass1).lerp(grass2, n);
        if (slope > 1.1) tmp.lerp(rock, Math.min(1, (slope - 1.1) * 1.5));
        if (h > I.h * 1.25 && h > 9) tmp.lerp(snow, Math.min(1, (h - I.h * 1.25) / 2));
        if (n > 0.8 && h > 1.4 && slope < 0.5) tmp.lerp(dirt, 0.3);
        cols.set([tmp.r, tmp.g, tmp.b], i * 3);
      }
      g.setAttribute('color', new THREE.BufferAttribute(cols, 3)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
      m.position.set(I.x, 0, I.z); m.receiveShadow = true; S.add(m);
      // name sign
      const sign = textSprite('', 3); sign.visible = false; I.sign = sign;
      // plaza ring
      const plaza = new THREE.Mesh(new THREE.CircleGeometry(9, 48).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd9d2c3, roughness: 0.8 }));
      plaza.position.set(I.x, heightAt(I.x, I.z) + 0.03, I.z); plaza.receiveShadow = true; S.add(plaza);
    }
    this._trees(); this._props(); this._sportsArena(); this._clouds();
  }

  _trees() {
    const S = this.scene, spots = [];
    for (const I of ISLANDS) {
      const n = I.id === 'sports' ? 70 : 140;
      for (let i = 0, tries = 0; i < n && tries < 2000; tries++) {
        const a = hash(tries, I.r) * Math.PI * 2, d = Math.sqrt(hash(I.x + tries, 7)) * I.r * 0.95;
        const x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d, h = heightAt(x, z);
        if (h < 1.6) continue;
        if (FLATS.some(F => F.r ? Math.hypot(x - F.x, z - F.z) < F.r + 6 : Math.abs(x - F.x) < F.hw + 4 && Math.abs(z - F.z) < F.hd + 4)) continue;
        spots.push([x, h, z, hash(x, z)]); i++;
      }
    }
    const trunkG = new THREE.CylinderGeometry(0.22, 0.35, 2.4, 7).translate(0, 1.2, 0);
    const pineG = new THREE.ConeGeometry(1.6, 4.2, 9).translate(0, 4, 0);
    const roundG = new THREE.IcosahedronGeometry(1.8, 1).translate(0, 3.6, 0);
    const trunk = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 }), spots.length);
    const pines = spots.filter(s => s[3] < 0.5), rounds = spots.filter(s => s[3] >= 0.5);
    const pine = new THREE.InstancedMesh(pineG, new THREE.MeshStandardMaterial({ color: 0x2f6b34, roughness: 0.9, flatShading: true }), pines.length);
    const round = new THREE.InstancedMesh(roundG, new THREE.MeshStandardMaterial({ color: 0x5aa03c, roughness: 0.9, flatShading: true }), rounds.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
    spots.forEach((s, i) => { const k = 0.8 + s[3] * 0.6; q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), s[3] * 6.28); m.compose(p.set(s[0], s[1] - 0.2, s[2]), q, sc.set(k, k, k)); trunk.setMatrixAt(i, m); });
    pines.forEach((s, i) => { const k = 0.8 + s[3] * 0.8; m.compose(p.set(s[0], s[1] - 0.2, s[2]), q.identity(), sc.set(k, k, k)); pine.setMatrixAt(i, m); pine.setColorAt(i, c.setHSL(0.33 + s[3] * 0.06, 0.5, 0.22 + s[3] * 0.12)); });
    rounds.forEach((s, i) => { const k = 0.7 + (s[3] - 0.5) * 1.2; m.compose(p.set(s[0], s[1] - 0.2, s[2]), q.identity(), sc.set(k, k, k)); round.setMatrixAt(i, m); round.setColorAt(i, c.setHSL(0.22 + s[3] * 0.1, 0.55, 0.32 + (s[3] - 0.5) * 0.2)); });
    for (const im of [trunk, pine, round]) { im.castShadow = true; im.receiveShadow = true; S.add(im); }
    // rocks
    const rockSpots = [];
    for (let i = 0; i < 160; i++) {
      const I = ISLANDS[i % ISLANDS.length], a = hash(i, 3) * 6.28, d = (0.4 + hash(i, 9) * 0.6) * I.r;
      const x = I.x + Math.cos(a) * d, z = I.z + Math.sin(a) * d; const h = heightAt(x, z);
      if (h > 0.3 && !FLATS.some(F => F.r ? Math.hypot(x - F.x, z - F.z) < F.r + 4 : Math.abs(x - F.x) < F.hw + 3 && Math.abs(z - F.z) < F.hd + 3)) rockSpots.push([x, h, z, hash(x, i)]);
    }
    const rocks = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.9, 0), new THREE.MeshStandardMaterial({ color: 0x8c877d, roughness: 0.95, flatShading: true }), rockSpots.length);
    rockSpots.forEach((s, i) => { const k = 0.4 + s[3] * 1.4; q.setFromEuler(new THREE.Euler(s[3] * 3, s[3] * 7, 0)); m.compose(p.set(s[0], s[1], s[2]), q, sc.set(k, k * 0.7, k)); rocks.setMatrixAt(i, m); });
    rocks.castShadow = rocks.receiveShadow = true; S.add(rocks);
  }

  _box(x, y, z, w, h, d, color, opts = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...opts }));
    m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; this.scene.add(m); return m;
  }

  _props() {
    const S = this.scene;
    // hub: giant spinning star monument + fountain
    const h0 = heightAt(0, 0);
    const shape = new THREE.Shape();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 1.2 : 2.8, a = i / 10 * Math.PI * 2 + Math.PI / 2; i ? shape.lineTo(Math.cos(a) * r, Math.sin(a) * r) : shape.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
    const star = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.8, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15 }).center(),
      new THREE.MeshStandardMaterial({ color: 0xffcc22, metalness: 0.7, roughness: 0.25, emissive: 0x553300 }));
    star.position.set(0, h0 + 7, 0); star.castShadow = true; S.add(star);
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 4, 1.2, 32), new THREE.MeshStandardMaterial({ color: 0xe8e2d4 }));
    pillar.position.set(0, h0 + 0.6, 0); pillar.receiveShadow = pillar.castShadow = true; S.add(pillar);
    const pool = new THREE.Mesh(new THREE.CylinderGeometry(3.1, 3.1, 0.2, 32), new THREE.MeshStandardMaterial({ color: 0x3fb7e8, metalness: 0.3, roughness: 0.1 }));
    pool.position.set(0, h0 + 1.15, 0); S.add(pool);
    this.updaters.push((dt, t) => { star.rotation.y = t * 0.8; star.position.y = h0 + 7 + Math.sin(t * 1.5) * 0.4; });
    this.solids = [{ x: 0, z: 0, r: 4.2 }];

    // math island: giant number & symbol blocks
    const I = isl('math');
    '1+2×3÷4=7−9'.split('').forEach((ch, i) => {
      const a = i / 11 * Math.PI * 2, x = I.x + Math.cos(a) * 36, z = I.z + Math.sin(a) * 36, h = heightAt(x, z);
      const c = new THREE.Color().setHSL(i / 11, 0.7, 0.55);
      const b = this._box(x, h + 1.5, z, 3, 3, 3, c);
      const s = textSprite(ch, 2.4, { bg: null, size: 96 }); s.position.set(x, h + 4.6, z); S.add(s);
      this.solids.push({ x, z, r: 2.2 });
      this.updaters.push((dt, t) => { s.position.y = h + 4.6 + Math.sin(t * 2 + i) * 0.3; });
    });
    // language island: letter blocks
    const L = isl('lang');
    'ABCАБВDEГД'.split('').forEach((ch, i) => {
      const a = i / 10 * Math.PI * 2, x = L.x + Math.cos(a) * 36, z = L.z + Math.sin(a) * 36, h = heightAt(x, z);
      this._box(x, h + 1.2, z, 2.4, 2.4, 2.4, new THREE.Color().setHSL(0.9 - i / 25, 0.7, 0.6));
      const s = textSprite(ch, 2, { bg: null, size: 96 }); s.position.set(x, h + 3.8, z); S.add(s);
      this.solids.push({ x, z, r: 1.8 });
    });
    // arcade island: voxel towers
    const A = isl('arcade');
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * Math.PI * 2, x = A.x + Math.cos(a) * 38, z = A.z + Math.sin(a) * 38, h = heightAt(x, z);
      const cols = [0x5d9c3b, 0x8b5a2b, 0x9a9a9a, 0x3a7bd5, 0xe0c060];
      for (let k = 0; k < 2 + (i % 4); k++) this._box(x, h + 0.75 + k * 1.5, z, 1.5, 1.5, 1.5, cols[(i + k) % 5], { flatShading: true });
      this.solids.push({ x, z, r: 1.3 });
    }
    // teacher island: castle
    const T = isl('teacher'), th = heightAt(T.x, T.z - 16);
    this._box(T.x, th + 3, T.z - 18, 22, 6, 6, 0xd8cfc0);
    for (const dx of [-11, 11]) {
      const tw = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 11, 16), new THREE.MeshStandardMaterial({ color: 0xcfc4b2 }));
      tw.position.set(T.x + dx, th + 5.5, T.z - 18); tw.castShadow = tw.receiveShadow = true; S.add(tw);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(3, 4, 16), new THREE.MeshStandardMaterial({ color: 0x7b3fc4 }));
      roof.position.set(T.x + dx, th + 13, T.z - 18); roof.castShadow = true; S.add(roof);
      this.solids.push({ x: T.x + dx, z: T.z - 18, r: 2.8 });
    }
    for (let x = -10; x <= 10; x += 2.5) this.solids.push({ x: T.x + x, z: T.z - 18, r: 3 });
    const stage = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.5, 0.8, 32), new THREE.MeshStandardMaterial({ color: 0x8e5bd6 }));
    stage.position.set(T.x, heightAt(T.x, T.z) + 0.4, T.z); stage.receiveShadow = true; S.add(stage);
    const ts = textSprite('🏰', 3, { bg: null, size: 96 }); ts.position.set(T.x, th + 9, T.z - 18); S.add(ts);
  }

  _sportsArena() {
    const S = this.scene, P = PITCH;
    const c = document.createElement('canvas'); c.width = 1024; c.height = 620; const g = c.getContext('2d');
    for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? '#3f9a3a' : '#48a843'; g.fillRect(i * c.width / 12, 0, c.width / 12 + 1, c.height); }
    g.strokeStyle = '#fff'; g.lineWidth = 6; const W = c.width, H = c.height, m = 14;
    g.strokeRect(m, m, W - 2 * m, H - 2 * m); g.beginPath(); g.moveTo(W / 2, m); g.lineTo(W / 2, H - m); g.stroke();
    g.beginPath(); g.arc(W / 2, H / 2, 80, 0, 7); g.stroke();
    g.strokeRect(m, H / 2 - 150, 140, 300); g.strokeRect(W - m - 140, H / 2 - 150, 140, 300);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const field = new THREE.Mesh(new THREE.PlaneGeometry(P.hw * 2 + 2, P.hd * 2 + 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    field.position.set(P.x, P.h + 0.03, P.z); field.receiveShadow = true; S.add(field);
    const white = 0xffffff;
    for (const sx of [-1, 1]) {
      const gx = P.x + sx * P.hw;
      this._box(gx, P.h + 1.3, P.z - 4, 0.25, 2.6, 0.25, white); this._box(gx, P.h + 1.3, P.z + 4, 0.25, 2.6, 0.25, white);
      this._box(gx, P.h + 2.6, P.z, 0.25, 0.25, 8.2, white);
      const net = new THREE.Mesh(new THREE.PlaneGeometry(8, 2.6), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide }));
      net.rotation.y = Math.PI / 2; net.position.set(gx + sx * 1.2, P.h + 1.3, P.z); S.add(net);
    }
    // stands
    for (const sz of [-1, 1]) for (let k = 0; k < 3; k++) this._box(P.x, P.h + 0.4 + k * 0.8, P.z + sz * (P.hd + 3 + k * 1.2), P.hw * 2, 0.8, 1.2, [0xe74c3c, 0xffffff, 0x3498db][k]);
    // dodgeball court
    const C = COURT;
    const court = new THREE.Mesh(new THREE.PlaneGeometry(C.hw * 2, C.hd * 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc98b4f, roughness: 0.6 }));
    court.position.set(C.x, C.h + 0.03, C.z); court.receiveShadow = true; S.add(court);
    const half = (sz, col) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(C.hw * 2 - 1, C.hd - 0.5).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: col, transparent: true, opacity: 0.35 })); m.position.set(C.x, C.h + 0.05, C.z + sz * C.hd / 2); S.add(m); };
    half(-1, 0xe74c3c); half(1, 0x3498db);
    this._box(C.x, C.h + 0.06, C.z, C.hw * 2, 0.04, 0.3, 0xffffff);
    // football mesh
    const bc = document.createElement('canvas'); bc.width = 256; bc.height = 128; const bg = bc.getContext('2d');
    bg.fillStyle = '#fff'; bg.fillRect(0, 0, 256, 128); bg.fillStyle = '#111';
    for (let i = 0; i < 12; i++) { bg.beginPath(); const x = (i % 6) * 46 + (i > 5 ? 23 : 0), y = i > 5 ? 90 : 38; for (let k = 0; k < 5; k++) { const a = k / 5 * 6.28; bg.lineTo(x + Math.cos(a) * 14, y + Math.sin(a) * 14); } bg.fill(); }
    const btex = new THREE.CanvasTexture(bc); btex.colorSpace = THREE.SRGBColorSpace;
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.55, 24, 16), new THREE.MeshStandardMaterial({ map: btex, roughness: 0.5 }));
    this.ball.castShadow = true; this.ball.position.set(P.x, P.h + 0.55, P.z); S.add(this.ball);
  }

  _clouds() {
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
    const geo = new THREE.IcosahedronGeometry(1, 2);
    this.clouds = [];
    for (let i = 0; i < 26; i++) {
      const g = new THREE.Group();
      for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(geo, mat); const s = 5 + hash(i, k) * 7; m.scale.set(s * 1.4, s * 0.7, s); m.position.set((k - 3) * 6 + hash(k, i) * 4, hash(i * 3, k) * 3, hash(k, i * 7) * 6); g.add(m); }
      g.position.set((hash(i, 1) - 0.5) * 1400, 70 + hash(i, 2) * 50, (hash(i, 3) - 0.5) * 1400);
      this.scene.add(g); this.clouds.push(g);
    }
    this.updaters.push(dt => this.clouds.forEach(c => { c.position.x += dt * 3; if (c.position.x > 700) c.position.x = -700; }));
  }

  // ---------- portals ----------
  addPortal(x, z, label, color, action) {
    const h = heightAt(x, z), g = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.7, 0.22, 16, 48), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.6, metalness: 0.4, roughness: 0.3 }));
    ring.position.y = 2.1; ring.castShadow = true;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.ShaderMaterial({
      transparent: true, side: THREE.DoubleSide, depthWrite: false,
      uniforms: { t: { value: 0 }, c: { value: new THREE.Color(color) } },
      vertexShader: 'varying vec2 vU; void main(){ vU=uv-0.5; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }',
      fragmentShader: 'uniform float t; uniform vec3 c; varying vec2 vU; void main(){ float r=length(vU)*2.; float a=atan(vU.y,vU.x); float s=0.5+0.5*sin(a*5.+r*12.-t*4.); gl_FragColor=vec4(mix(c,vec3(1.),s*0.5*(1.-r)),(0.35+0.4*s)*(1.-r*0.6)); }',
    }));
    disc.position.y = 2.1;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.4, 0.3, 32), new THREE.MeshStandardMaterial({ color: 0x555a66, metalness: 0.5, roughness: 0.4 }));
    base.position.y = 0.15; base.receiveShadow = true;
    const lab = textSprite(label, 1.1); lab.position.y = 4.6;
    g.add(ring, disc, base, lab); g.position.set(x, h, z);
    g.lookAt(0, h, 0); // face island center by default
    this.scene.add(g);
    const p = { x, z, y: h, label, action, group: g, lab, ring, disc };
    this.portals.push(p);
    this.updaters.push((dt, t) => { disc.material.uniforms.t.value = t; ring.rotation.z = t * 0.6; });
    return p;
  }
  facePortal(p, tx, tz) { p.group.lookAt(tx, p.y, tz); }
  setPortalLabel(p, label) { p.group.remove(p.lab); p.lab = textSprite(label, 1.1); p.lab.position.y = 4.6; p.group.add(p.lab); p.label = label; }

  // ---------- local player ----------
  setPlayer(avatar) {
    this.me = avatar; this.scene.add(avatar.group);
    this.teleport(0, 12);
  }
  teleport(x, z, yaw) {
    const p = this.me.group.position; p.set(x, heightAt(x, z) + 0.5, z); this.vel.set(0, 0, 0);
    if (yaw !== undefined) { this.yaw = yaw; this.me.group.rotation.y = yaw + Math.PI; }
  }
  teleportIsland(id) { const I = isl(id); this.teleport(I.x + 4, I.z + 12, Math.PI); }

  _input() {
    addEventListener('keydown', e => { if (this.inputLocked || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; this.keys[e.code] = true; if (e.code === 'Space') e.preventDefault(); });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    let drag = null;
    const c = this.canvas;
    c.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; });
    addEventListener('pointerup', e => { if (drag && drag.id === e.pointerId) drag = null; });
    addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      this.yaw -= (e.clientX - drag.x) * 0.006; this.pitch = Math.min(1.3, Math.max(-0.2, this.pitch + (e.clientY - drag.y) * 0.004));
      drag.x = e.clientX; drag.y = e.clientY;
    });
    c.addEventListener('wheel', e => { this.dist = Math.min(22, Math.max(4, this.dist + e.deltaY * 0.01)); }, { passive: true });
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
    let speed = (this.keys.ShiftLeft || this.keys.ShiftRight || this.joyRun ? 11 : 7) * (E.speed ? 1.8 : 1);
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw); // camera forward on ground
    const mx = (fx * iz - fz * ix) * speed, mz = (fz * iz + fx * ix) * speed;
    const ground = heightAt(p.x, p.z), swim = ground < -0.6;
    if (swim) { speed *= 0.6; }
    this.vel.x += (mx * (swim ? 0.6 : 1) - this.vel.x) * Math.min(1, dt * 10);
    this.vel.z += (mz * (swim ? 0.6 : 1) - this.vel.z) * Math.min(1, dt * 10);
    const grav = E.lowGravity ? 7 : 26;
    if ((this.keys.Space || this.joyJump) && (this.onGround || swim) && !this.inputLocked && now > this.frozenUntil) { this.vel.y = E.lowGravity ? 11 : 10; this.onGround = false; this.onJump && this.onJump(); this.joyJump = false; }
    this.vel.y -= grav * dt;
    let nx = p.x + this.vel.x * dt, nz = p.z + this.vel.z * dt;
    for (const s of this.solids) { const dx = nx - s.x, dz = nz - s.z, d = Math.hypot(dx, dz), r = s.r + 0.4; if (d < r && d > 0.001) { nx = s.x + dx / d * r; nz = s.z + dz / d * r; } }
    const R = 1100; const dc = Math.hypot(nx, nz); if (dc > R) { nx *= R / dc; nz *= R / dc; }
    if (this.constrain) [nx, nz] = this.constrain(nx, nz);
    p.x = nx; p.z = nz; p.y += this.vel.y * dt;
    const floor = Math.max(heightAt(p.x, p.z), swim ? -0.9 + Math.sin(performance.now() / 400) * 0.1 : -99);
    if (p.y <= floor) { p.y = floor; this.vel.y = Math.max(0, this.vel.y); this.onGround = true; } else if (p.y > floor + 0.15) this.onGround = false;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    if (hs > 0.5) { const target = Math.atan2(this.vel.x, this.vel.z); let d = target - me.group.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); me.group.rotation.y += d * Math.min(1, dt * 12); }
    me.animate(hs, dt, !this.onGround && !swim);
    const sc = E.giant ? 2.2 : 1; me.group.scale.setScalar(me.group.scale.x + (sc - me.group.scale.x) * Math.min(1, dt * 4));
    this.speedNow = hs;
  }

  _camera(dt) {
    const p = this.me.group.position, s = this.me.group.scale.x;
    const d = this.dist * (0.7 + s * 0.3), cp = Math.cos(this.pitch);
    const target = new THREE.Vector3(p.x + Math.sin(this.yaw) * cp * d, p.y + 1.6 * s + Math.sin(this.pitch) * d, p.z + Math.cos(this.yaw) * cp * d);
    const gh = heightAt(target.x, target.z) + 0.6; if (target.y < gh) target.y = gh; if (target.y < 0.4) target.y = 0.4;
    this.camera.position.lerp(target, Math.min(1, dt * 8));
    this.camera.lookAt(p.x, p.y + 1.5 * s, p.z);
    this.sun.position.set(p.x + 60, p.y + 90, p.z - 50); this.sun.target.position.copy(p);
  }

  // ---------- remote players ----------
  upsertRemote(id, d, makeAvatar) {
    let r = this.remotes[id];
    if (!d) { if (r) { this.scene.remove(r.av.group); delete this.remotes[id]; } return; }
    if (!r) { r = this.remotes[id] = { av: makeAvatar(d), name: d.name }; r.av.group.position.set(d.x, d.y, d.z); this.scene.add(r.av.group); }
    if (r.name !== d.name) { r.av.setName(d.name, d.role); r.name = d.name; }
    r.d = d;
  }
  _remotes(dt) {
    for (const id in this.remotes) {
      const r = this.remotes[id], g = r.av.group, d = r.d;
      const before = g.position.clone();
      g.position.lerp(new THREE.Vector3(d.x, d.y, d.z), Math.min(1, dt * 10));
      let dr = (d.ry || 0) - g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); g.rotation.y += dr * Math.min(1, dt * 10);
      const sp = before.distanceTo(g.position) / Math.max(dt, 0.001);
      r.av.animate(sp, dt, false);
      const sc = d.giant ? 2.2 : 1; g.scale.setScalar(g.scale.x + (sc - g.scale.x) * Math.min(1, dt * 4));
    }
  }

  // ---------- effects ----------
  setEffects(E) {
    this.effects = E || {};
    const night = this.effects.night || this.effects.disco ? 1 : 0;
    this.skyU.night.value = night;
    this.skyU.top.value.set(night ? 0x050a24 : 0x2f7fe0); this.skyU.bottom.value.set(night ? 0x1a2350 : 0xcfe8ff);
    this.scene.fog.color.set(night ? 0x0d1430 : 0xcfe8ff); this.waterU.fogColor.value.copy(this.scene.fog.color); this.waterU.night.value = night;
    this.sun.intensity = night ? 0.35 : 2.4; this.hemi.intensity = night ? 0.35 : 0.9;
    this.sun.color.set(night ? 0x8899ff : 0xfff1d6);
  }

  fireworks(n = 8, at) {
    const center = at || this.me.group.position;
    for (let k = 0; k < n; k++) setTimeout(() => {
      const cnt = 120, geo = new THREE.BufferGeometry(), pos = new Float32Array(cnt * 3), vel = [];
      const ox = center.x + (Math.random() - 0.5) * 40, oy = center.y + 18 + Math.random() * 12, oz = center.z + (Math.random() - 0.5) * 40;
      for (let i = 0; i < cnt; i++) { pos.set([ox, oy, oz], i * 3); const v = new THREE.Vector3().randomDirection().multiplyScalar(8 + Math.random() * 6); vel.push(v); }
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({ color: new THREE.Color().setHSL(Math.random(), 1, 0.6), size: 0.6, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
      const pts = new THREE.Points(geo, mat); this.scene.add(pts);
      let life = 0;
      const up = dt => {
        life += dt; const a = geo.attributes.position;
        for (let i = 0; i < cnt; i++) { vel[i].y -= 6 * dt; vel[i].multiplyScalar(0.985); a.setXYZ(i, a.getX(i) + vel[i].x * dt, a.getY(i) + vel[i].y * dt, a.getZ(i) + vel[i].z * dt); }
        a.needsUpdate = true; mat.opacity = Math.max(0, 1 - life / 2.2);
        if (life > 2.2) { this.scene.remove(pts); geo.dispose(); mat.dispose(); return true; }
      };
      this.updaters.push(up);
      this.onFirework && this.onFirework();
    }, k * 350);
  }

  // collectible stars around (x,z)
  spawnStars(count, cx, cz, radius, onCollect) {
    const geo = new THREE.OctahedronGeometry(0.5, 0), mat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffa000, emissiveIntensity: 1.2, metalness: 0.6, roughness: 0.3 });
    for (let i = 0; i < count; i++) {
      const a = Math.random() * 6.28, d = 3 + Math.random() * radius, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
      const m = new THREE.Mesh(geo, mat); m.position.set(x, 40 + Math.random() * 30, z); m.scale.y = 1.6;
      this.scene.add(m); this.stars.push({ m, ground: Math.max(heightAt(x, z), 0) + 1, onCollect, t: Math.random() * 6 });
    }
  }
  clearStars() { this.stars.forEach(s => this.scene.remove(s.m)); this.stars = []; }
  _stars(dt) {
    const p = this.me.group.position;
    this.stars = this.stars.filter(s => {
      s.t += dt; const m = s.m;
      if (m.position.y > s.ground) m.position.y = Math.max(s.ground, m.position.y - dt * 14); else m.position.y = s.ground + Math.sin(s.t * 3) * 0.25;
      m.rotation.y += dt * 3;
      if (m.position.distanceTo(p) < 1.8 * this.me.group.scale.x + 0.4) { this.scene.remove(m); s.onCollect(); return false; }
      return true;
    });
  }

  nearestPortal() {
    const p = this.me.group.position; let best = null, bd = 4.2;
    for (const q of this.portals) { const d = Math.hypot(p.x - q.x, p.z - q.z); if (d < bd) { bd = d; best = q; } }
    return best;
  }
  islandAt(x, z) { let best = null, bd = 1e9; for (const I of ISLANDS) { const d = Math.hypot(x - I.x, z - I.z) / I.r; if (d < 1.25 && d < bd) { bd = d; best = I; } } return best; }

  start(onFrame) {
    this._onFrame = onFrame;
    const loop = () => {
      const dt = Math.min(0.05, this.clock.getDelta()), t = this.clock.elapsedTime;
      if (this.me) { this._physics(dt); this._camera(dt); this._stars(dt); }
      this._remotes(dt);
      this.waterU.uTime.value = t;
      this.updaters = this.updaters.filter(u => !u(dt, t));
      if (this.effects.disco) { this.hemi.color.setHSL((t * 0.3) % 1, 1, 0.6); this.hemi.intensity = 1.4; } else this.hemi.color.set(0xcfe8ff);
      onFrame && onFrame(dt, t);
      this.renderer.render(this.scene, this.camera);
      this.raf = requestAnimationFrame(loop);
    };
    loop();
  }
  pause(p) { if (p) { cancelAnimationFrame(this.raf); this.raf = null; } else if (!this.raf) { this.clock.getDelta(); this.start(this._onFrame); } }
}
