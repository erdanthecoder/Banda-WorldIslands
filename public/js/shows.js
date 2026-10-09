// Big events an admin can start for everyone on the server: 🪩 disco, 🦀 crab party, 🎤 concert.
// Everything is built on the plaza and removed when the show ends. Bots come and dance.
import * as THREE from 'three';
import { playSong, stopSong } from './audio.js';
import { labelSprite, canvasTex } from './world.js';
import { Avatar } from './avatar.js';
import { botAvatar } from './bots.js';

export const SHOWS = { disco: { song: 5, dur: 90, icon: '🪩' }, crabs: { song: 6, dur: 80, icon: '🦀' }, concert: { song: 7, dur: 120, icon: '🎤' } };
export const STAGE = { x: 0, z: 15 };
const BEAT = { disco: 60 / 120, crabs: 60 / 125, concert: 60 / 112 };
const std = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...extra });

export class Shows {
  constructor(app) {
    this.app = app; this.on = null; this.objs = []; this.anim = [];
    app.onEvent(ev => {
      if (!ev.trusted) return; const d = ev.data || {};
      if (ev.type === 'show') { if (d.kind === 'stop') this.stop(); else if (SHOWS[d.kind]) this.start(d.kind); }
      if (ev.type === 'botcount' && app.bots) app.bots.setCount(d.n);
    });
    app.world.updaters.push((dt, t) => this.tick(dt, t));
  }
  get w() { return this.app.world; }
  add(o) { this.w.scene.add(o); this.objs.push(o); return o; }

  start(kind) {
    this.stop(true);
    const S = SHOWS[kind], app = this.app, w = this.w, t = app.t;
    this.on = { kind, until: performance.now() + S.dur * 1000, t0: performance.now() };
    if (kind === 'disco') this.disco();
    if (kind === 'crabs') this.crabs();
    if (kind === 'concert') this.concert();
    app.showSpot = kind === 'concert' ? { x: STAGE.x, z: STAGE.z - 9, r: 6, kind } : { x: 0, z: 0, r: 11, kind };
    if (kind !== 'concert') w.setEffects({ ...app.effects, disco: true });
    playSong(S.song); app.sfx('airhorn'); w.fireworks(6);
    app.ui.banner(`${S.icon} ${t('show_' + kind)} ${S.icon} — ${t('showCome')}`, 5000);
    app.ui.chat(`<b>${S.icon} ${t('show_' + kind)}</b> · ${t('showCome')}`, 'sys');
  }
  stop(quiet) {
    if (!this.on) return;
    this.objs.forEach(o => o.parent && o.parent.remove(o)); this.objs = []; this.anim = [];
    this.on = null; this.app.showSpot = null;
    stopSong(); this.w.setEffects(this.app.effects);
    if (!quiet) this.app.ui.banner('👏 ' + this.app.t('showOver'), 2500);
  }
  tick(dt, t) {
    if (!this.on) return;
    if (performance.now() > this.on.until) return this.stop();
    const beat = BEAT[this.on.kind], ph = ((performance.now() - this.on.t0) / 1000) / beat;
    this.anim.forEach(f => f(dt, t, ph));
  }

  // ---------- 🪩 disco: mirror ball, light beams and a flashing dance floor ----------
  disco() {
    const w = this.w, y0 = w.groundAt(0, 9);
    const ball = this.add(new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 2), std(0xdddddd, { metalness: 1, roughness: 0.08, flatShading: true, emissive: 0x333333 })));
    ball.position.set(0, y0 + 10, 0);
    const chain = this.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 6), std(0x999999, { metalness: 0.8 }))); chain.position.set(0, y0 + 14, 0);
    const beams = new THREE.Group(); beams.position.copy(ball.position); this.add(beams);
    const cols = [0xff3fa4, 0x3ac3ff, 0xffe14d, 0x5dff8a, 0xb36bff, 0xff7a2f];
    for (let i = 0; i < 12; i++) {
      const g = new THREE.ConeGeometry(1.4, 12, 16, 1, true); g.translate(0, -6, 0);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.set(0.5 + (i % 3) * 0.2, 0, 0); const holder = new THREE.Group(); holder.rotation.y = i / 12 * Math.PI * 2; holder.add(m); beams.add(holder);
    }
    this.floor(cols);
    this.anim.push((dt, t, ph) => { ball.rotation.y += dt * 0.8; beams.rotation.y -= dt * 0.6; beams.children.forEach((h, i) => { h.children[0].rotation.x = 0.5 + Math.sin(t * 1.5 + i) * 0.35; }); });
  }
  floor(cols) {
    const w = this.w, tiles = [], g = new THREE.PlaneGeometry(1.7, 1.7).rotateX(-Math.PI / 2);
    for (let x = -16; x <= 16; x += 1.8) for (let z = -16; z <= 16; z += 1.8) { const d = Math.hypot(x, z); if (d > 6.8 && d < 17) tiles.push([x, z]); }
    const im = new THREE.InstancedMesh(g, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.55 }), tiles.length);
    const m = new THREE.Matrix4(), c = new THREE.Color();
    tiles.forEach(([x, z], i) => { m.makeTranslation(x, w.groundAt(x, z) + 0.05, z); im.setMatrixAt(i, m); im.setColorAt(i, c.setHex(cols[i % cols.length])); });
    this.add(im); let last = -1;
    this.anim.push((dt, t, ph) => { const b = Math.floor(ph); if (b === last) return; last = b; tiles.forEach((_, i) => im.setColorAt(i, c.setHex(cols[(i * 7 + b * 3) % cols.length]))); im.instanceColor.needsUpdate = true; });
  }

  // ---------- 🦀 crab party: dancing crabs everywhere and a DJ crab on the fountain ----------
  crab(scale = 1) {
    const g = new THREE.Group(), shell = std(0xe8452c, { roughness: 0.4 }), dark = std(0xb02a18), white = std(0xffffff), black = std(0x111111);
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.5, 18, 12), shell); body.scale.set(1.3, 0.55, 1); body.position.y = 0.45; g.add(body);
    for (const sx of [-1, 1]) {
      const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3), dark); stalk.position.set(sx * 0.18, 0.75, 0.3); g.add(stalk);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), white); eye.position.set(sx * 0.18, 0.92, 0.3); g.add(eye);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), black); pupil.position.set(sx * 0.18, 0.93, 0.38); g.add(pupil);
      const arm = new THREE.Group(); arm.position.set(sx * 0.6, 0.5, 0.25); g.add(arm);
      const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.45, 0.12), dark); a1.position.y = 0.2; arm.add(a1);
      const claw = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), shell); claw.scale.set(1, 1.3, 0.7); claw.position.y = 0.5; arm.add(claw);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.25, 0.1), dark); pin.position.set(sx * 0.1, 0.72, 0); arm.add(pin);
      g.userData['arm' + (sx < 0 ? 'L' : 'R')] = arm;
      for (let k = 0; k < 3; k++) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.06), dark); leg.position.set(sx * 0.7, 0.25, -0.2 + k * 0.2); leg.rotation.z = sx * -0.6; g.add(leg); }
    }
    g.scale.setScalar(scale); return g;
  }
  crabs() {
    const w = this.w, list = [];
    for (let i = 0; i < 44; i++) {
      const a = i / 44 * Math.PI * 2 * 3 + Math.random(), r = 7 + (i % 4) * 2.6 + Math.random(), x = Math.cos(a) * r, z = Math.sin(a) * r;
      const c = this.add(this.crab(0.8 + Math.random() * 0.5)); c.position.set(x, w.groundAt(x, z), z); c.rotation.y = Math.atan2(-x, -z); c.userData.base = c.position.y; c.userData.k = Math.random() * 6; list.push(c);
    }
    const dj = this.add(this.crab(3)); dj.position.set(0, w.groundAt(0, 0) + 1.6, 0); dj.userData.base = dj.position.y; dj.userData.k = 0; list.push(dj);
    const sign = this.add(labelSprite('🦀 CRAB PARTY 🦀', 1.4, { bg: 'rgba(232,69,44,0.95)', weight: 900 })); sign.position.set(0, dj.position.y + 4.5, 0);
    this.floor([0xff3fa4, 0xffe14d, 0x3ac3ff, 0xe8452c]);
    this.anim.push((dt, t, ph) => list.forEach(c => {
      const b = ph * Math.PI * 2 + c.userData.k, u = c.userData;
      c.position.y = u.base + Math.abs(Math.sin(b / 2)) * 0.35 * c.scale.x;
      u.armL.rotation.z = 0.6 + Math.sin(b) * 0.7; u.armR.rotation.z = -0.6 - Math.sin(b) * 0.7;
      c.rotation.z = Math.sin(b / 2) * 0.15;
    }));
  }

  // ---------- 🎤 concert: a stage with a band, a big screen, speakers and moving lights ----------
  concert() {
    const w = this.w, { x, z } = STAGE, y = w.groundAt(x, z), S = new THREE.Group(); S.position.set(x, y, z); this.add(S);
    const box = (bx, by, bz, ww, hh, dd, mat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(ww, hh, dd), mat); m.position.set(bx, by, bz); S.add(m); return m; };
    box(0, 0.6, 0, 14, 1.2, 7, std(0x1b1d22, { roughness: 0.8 }));
    box(0, 1.22, -2.8, 14, 0.04, 0.2, std(0xffcc33, { emissive: 0xffaa00, emissiveIntensity: 1.5 }));
    for (const sx of [-1, 1]) { box(sx * 7, 4.5, 3, 0.3, 9, 0.3, std(0x777777, { metalness: 0.7 })); box(sx * 8.6, 2.6, 1, 1.8, 3.6, 1.6, std(0x111111)); for (const yy of [1.6, 3.4]) { const sp = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), std(0x333333, { metalness: 0.5 })); sp.position.set(sx * 8.6, yy, 0.19); sp.rotation.y = Math.PI; S.add(sp); } }
    box(0, 9, 3, 14.3, 0.3, 0.3, std(0x777777, { metalness: 0.7 }));
    // the big screen with a moving equalizer
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const g = cv.getContext('2d'); const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: tex })); scr.position.set(0, 4.6, 3.3); scr.rotation.y = Math.PI; S.add(scr);
    // the band faces the fountain (towards -z)
    const band = [['🎤', 0, -1.6], ['🎸', -3.5, -0.4], ['🎹', 3.5, -0.4], ['🥁', 0, 1.5]].map(([icon, bx, bz], i) => {
      const av = new Avatar(botAvatar(1000 + i * 77), '', 'bot'); av.group.position.set(bx, 1.2, bz); av.group.rotation.y = Math.PI; S.add(av.group);
      const tag = labelSprite(icon, 0.8, { bg: null }); tag.position.set(bx, 3.6, bz); S.add(tag);
      return av;
    });
    { const kit = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 16), std(0xc0392b)); kit.position.set(0, 1.5, 0.8); S.add(kit); const k2 = kit.clone(); k2.position.set(-0.8, 1.7, 1); k2.scale.setScalar(0.6); S.add(k2); const k3 = kit.clone(); k3.position.set(0.8, 1.7, 1); k3.scale.setScalar(0.6); S.add(k3); }
    { const kb = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 0.5), std(0x111111)); kb.position.set(3.5, 2.1, -0.9); S.add(kb); }
    // moving light beams from the top truss
    const cols = [0xff3fa4, 0x3ac3ff, 0xffe14d, 0x5dff8a, 0xffffff, 0xb36bff], beams = [];
    for (let i = 0; i < 6; i++) {
      const gg = new THREE.ConeGeometry(1.1, 16, 16, 1, true); gg.translate(0, -8, 0);
      const m = new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.position.set(-6 + i * 2.4, 9, 2.6); S.add(m); beams.push(m);
    }
    const title = labelSprite('🎤 LIVE · World Islands', 1.0, { bg: 'rgba(20,20,30,0.9)', weight: 900 }); title.position.set(0, 10.3, 3); S.add(title);
    let eq = 0;
    this.anim.push((dt, t, ph) => {
      band.forEach((av, i) => { if (!av.emote) av.play(i === 3 ? 'cheer' : 'dance'); av.animate(0, dt, false); });
      beams.forEach((b, i) => { b.rotation.x = -0.5 + Math.sin(t * 1.3 + i) * 0.45; b.rotation.z = Math.sin(t * 0.9 + i * 2) * 0.5; });
      if ((eq += dt) > 0.08) {
        eq = 0; const gr = g.createLinearGradient(0, 0, 512, 256); gr.addColorStop(0, '#1a0b2e'); gr.addColorStop(1, '#0b2a4a'); g.fillStyle = gr; g.fillRect(0, 0, 512, 256);
        for (let i = 0; i < 24; i++) { const h = 30 + Math.abs(Math.sin(ph * Math.PI + i * 0.7)) * 150 * (0.6 + Math.random() * 0.4); g.fillStyle = `hsl(${(i * 15 + t * 60) % 360},90%,60%)`; g.fillRect(12 + i * 20.5, 230 - h, 15, h); }
        g.fillStyle = '#fff'; g.font = '800 40px Manrope, system-ui'; g.textAlign = 'center'; g.fillText('🎶 World Islands LIVE 🎶', 256, 50); tex.needsUpdate = true;
      }
    });
  }
}
