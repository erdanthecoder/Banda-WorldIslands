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
      if (ev.type === 'fx') this.fx(d.type);
      if (ev.type === 'money' && d.uid === app.me.uid) this.gotMoney(d.cents);
      if (ev.type === 'moneyall') app.net.claimMoney(ev.id, d.cents).then(n => { if (n) this.gotMoney(n); }).catch(() => {});
      // a big match on every server: each server's host starts it there
      if (ev.type === 'bigfootball' && app.bots && app.bots.amHost() && !app.mg.running()) app.mg.start(d.type === 'basketball' ? 'basketball' : 'football', 5, { bots: d.type === 'basketball' ? 8 : 16 });
    });
    this.fxObjs = [];
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

  async gotMoney(cents) {
    const app = this.app; app.sfx('paid'); app.sfx('cheer'); this.w.fireworks(3);
    app.ui.banner(`🎁 +$${(cents / 100).toFixed(2)} · ${app.t('fromAdmin')}`, 4000); app.ui.floatMoney && app.ui.floatMoney(cents);
    try { const row = await app.net.myRow(); if (row && typeof row.money_cents === 'number') app.setMoney(row.money_cents); } catch (e) {}
  }

  // ---------- quick fun for everyone (admin) ----------
  fx(type) {
    const app = this.app, w = this.w, t = app.t, me = w.me.group.position, inGame = app.mg && app.mg.active;
    app.ui.banner(t('fx_' + type), 3000);
    if (type === 'launch') { if (inGame) return; w.vel.y = 26; w.onGround = false; app.sfx('slideUp'); app.sfx('boing'); }
    if (type === 'dance') { w.me.play('dance'); app.emoteSig = 'dance:' + Date.now(); if (app.bots) for (const id in app.bots.b) { const bb = app.bots.b[id]; if (!bb.team) { bb.danceUntil = performance.now() + 15000; app.bots.emote(bb, 'dance'); } } app.sfx('airhorn'); }
    if (type === 'confetti') { w.fireworks(14); app.sfx('cheer'); }
    if (type === 'candy') this.rain(['🍬', '🍭', '🍫', '🍩', '🧁', '🍪'], 45, true);
    if (type === 'fish') this.rain(['🐟', '🐠', '🐡'], 40, false);
    if (type === 'snow') this.snow();
    if (type === 'meteors') this.meteors();
    if (type === 'barsik') this.giantCat();
  }
  // things fall from the sky around you; touch them to eat them
  rain(icons, n, yum) {
    const w = this.w, me = w.me.group.position, list = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, r = Math.random() * 16, x = me.x + Math.cos(a) * r, z = me.z + Math.sin(a) * r;
      const sp = labelSprite(icons[i % icons.length], 0.8, { bg: null }); sp.position.set(x, me.y + 18 + Math.random() * 20, z); w.scene.add(sp);
      list.push({ sp, vy: 0, floor: w.groundAt(x, z) + 0.4, life: 25 });
    }
    w.updaters.push(dt => {
      const p = w.me.group.position;
      for (const c of list) {
        if (c.gone) continue;
        if (c.sp.position.y > c.floor) { c.vy -= 9.8 * dt; c.sp.position.y = Math.max(c.floor, c.sp.position.y + c.vy * dt * 0.6); }
        if ((c.life -= dt) < 0) { w.scene.remove(c.sp); c.gone = true; continue; }
        if (c.sp.position.distanceTo(p) < 1.6) { w.scene.remove(c.sp); c.gone = true; this.app.sfx(yum ? 'eat' : 'splash'); }
      }
      return list.every(c => c.gone);
    });
  }
  snow() {
    const w = this.w, N = 1500, g = new THREE.BufferGeometry(), pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) pos.set([(Math.random() - 0.5) * 80, Math.random() * 40, (Math.random() - 0.5) * 80], i * 3);
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 0.25, transparent: true, opacity: 0.9, depthWrite: false })); w.scene.add(pts);
    let life = 45;
    w.updaters.push(dt => {
      const me = w.me.group.position; pts.position.set(me.x, me.y - 5, me.z);
      for (let i = 0; i < N; i++) { pos[i * 3 + 1] -= dt * (2 + (i % 5) * 0.4); pos[i * 3] += Math.sin(life + i) * dt * 0.3; if (pos[i * 3 + 1] < 0) pos[i * 3 + 1] = 40; }
      g.attributes.position.needsUpdate = true;
      if ((life -= dt) < 0) { w.scene.remove(pts); return true; }
    });
  }
  meteors() {
    const w = this.w; let n = 0;
    const one = () => {
      if (n++ > 14) return;
      const me = w.me.group.position, tx = me.x + (Math.random() - 0.5) * 60, tz = me.z + (Math.random() - 0.5) * 60, ty = w.groundAt(tx, tz);
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffa040 }));
      const tail = new THREE.Mesh(new THREE.ConeGeometry(0.7, 6, 10, 1, true), new THREE.MeshBasicMaterial({ color: 0xff5a1f, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
      tail.rotation.x = Math.PI; tail.position.y = 3.2; m.add(tail);
      const from = new THREE.Vector3(tx + 30, ty + 70, tz - 20), to = new THREE.Vector3(tx, ty, tz); m.position.copy(from); w.scene.add(m);
      m.lookAt(to); m.rotateX(-Math.PI / 2);
      let k = 0; this.app.sfx('whoosh');
      w.updaters.push(dt => { k += dt / 1.4; m.position.lerpVectors(from, to, Math.min(1, k)); if (k >= 1) { w.scene.remove(m); w.fireworks(1, to); this.app.sfx('firework'); return true; } });
      setTimeout(one, 600 + Math.random() * 900);
    };
    one();
  }
  // a GIANT Barsik (the cinema cat) walks across the island and meows
  giantCat() {
    const w = this.w, g = new THREE.Group(), orange = std(0xf5a142), cream = std(0xfff1d6), dark = std(0xd27a22), black = std(0x111111), white = std(0xffffff), pink = std(0xff8fa3);
    const add = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); g.add(m); return m; };
    add(new THREE.SphereGeometry(1, 20, 14), orange, 0, 1.4, 0, 1.0, 0.85, 1.5);
    add(new THREE.SphereGeometry(1, 16, 12), cream, 0, 1.2, 0.6, 0.7, 0.6, 0.8);
    const legs = [[-0.55, 0.9], [0.55, 0.9], [-0.55, -0.9], [0.55, -0.9]].map(([x, z]) => add(new THREE.CylinderGeometry(0.25, 0.25, 1, 10), orange, x, 0.5, z));
    const head = new THREE.Group(); head.position.set(0, 2.5, 1.4); g.add(head);
    const hm = (geo, mat, x, y, z, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); head.add(m); return m; };
    hm(new THREE.SphereGeometry(0.9, 20, 14), orange, 0, 0, 0);
    for (const sx of [-1, 1]) { const ear = hm(new THREE.ConeGeometry(0.35, 0.7, 4), orange, sx * 0.5, 0.85, 0); ear.rotation.z = -sx * 0.3; hm(new THREE.SphereGeometry(0.22, 12, 8), white, sx * 0.32, 0.15, 0.75); hm(new THREE.SphereGeometry(0.12, 10, 8), black, sx * 0.32, 0.15, 0.93); }
    hm(new THREE.SphereGeometry(0.1, 8, 6), pink, 0, -0.1, 0.9);
    for (let i = 0; i < 3; i++) hm(new THREE.BoxGeometry(0.5, 0.06, 0.06), dark, 0, 0.55 - i * 0.12, 0.6).rotation.x = 0;
    const tail = add(new THREE.CylinderGeometry(0.15, 0.2, 2.2, 10), orange, 0, 2.2, -1.8); tail.rotation.x = -0.6;
    g.scale.setScalar(4.5); w.scene.add(g);
    const tag = labelSprite('🐱 БАРСИК', 2, { bg: 'rgba(245,161,66,0.95)', weight: 900 }); tag.position.set(0, 4.3, 0.8); tag.scale.multiplyScalar(1 / 4.5 * 1.6); g.add(tag);
    const x0 = -50, x1 = 50, z = -2; let t = 0, meow = 0;
    w.updaters.push(dt => {
      t += dt; const k = t / 32, x = x0 + (x1 - x0) * k;
      g.position.set(x, w.groundAt(x, z), z); g.rotation.y = Math.PI / 2;
      legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 6 + (i % 2 ? Math.PI : 0)) * 0.5; });
      head.rotation.z = Math.sin(t * 2) * 0.15; tail.rotation.z = Math.sin(t * 3) * 0.5;
      if ((meow -= dt) < 0) { meow = 3.5; const me = w.me.group.position; if (Math.hypot(me.x - x, me.z - z) < 60) this.app.sfx('meow'); }
      const me = w.me.group.position; if (Math.hypot(me.x - x, me.z - z) < 5 && w.onGround && !(this.app.mg && this.app.mg.active)) { w.vel.y = 18; w.onGround = false; this.app.sfx('boing'); }
      if (k >= 1) { w.scene.remove(g); return true; }
    });
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
