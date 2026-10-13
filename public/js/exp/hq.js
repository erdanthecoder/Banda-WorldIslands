// 🏦 mBank Headquarters: the most beautiful building in Marbly.
// A glass atrium under a twisting skyscraper, a golden logo over a fountain, a waterfall wall,
// hundreds of people, and the desks where you open your 7-digit mBank card and switch on Hand Pay.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { experience, L, ui, std, mesh, canvasTexture, confetti, esc, money } from './core.js';
import { Building } from '../buildings.js';
import { TEX, labelSprite } from '../world.js';
import { Avatar } from '../avatar.js';
import { People } from './people.js';

const H = { x: 0, z: -25, w: 64, d: 40, fh: 18 }; // the atrium
const STYLES = [['Ocean', '#1e5bd8', '#6a2bd8', '#d82b8c'], ['Mint', '#0f9b8e', '#22c1a0', '#9be15d'], ['Sunset', '#ff6a3d', '#ff3d77', '#7b2cbf'], ['Gold', '#8a6d1f', '#d4af37', '#f7e08a'], ['Night', '#0b1530', '#23324a', '#3a86ff'], ['Candy', '#ff6fa8', '#ffb3d9', '#6ff3ff']];
const fmt = c => (c && c.length === 7 ? c.slice(0, 3) + ' ' + c.slice(3) : c || '••• ••••');
let A; // the running game

experience({
  id: 'hq', title: 'mBank Headquarters', titleRu: 'Штаб-квартира mBank', icon: '🏦', spawn: [0, 45, 0], sun: [16, 205],
  admin: [
    { a: 'goldrain', icon: '🪙', en: 'Gold coin rain', ru: 'Дождь из монет' },
    { a: 'lights', icon: '🌈', en: 'Light show', ru: 'Световое шоу' },
    { a: 'botdance', icon: '🕺', en: 'Everyone in the bank dances', ru: 'Весь банк танцует' },
    { a: 'spin', icon: '🌀', en: 'Spin the golden logo', ru: 'Крутить золотой логотип' },
    { a: 'fountain', icon: '⛲', en: 'Mega fountain', ru: 'Мега-фонтан' },
  ],
  build, frame, onAdmin,
});

async function build(app) {
  A = app; const w = app.world, S = w.scene;
  w.scene.fog.density = 0.0022;
  // ---------- the plaza ----------
  const stone = w.texMat(TEX.cobble, 40, 40, { color: 0xe8e2d6, roughness: 0.7 });
  mesh(w, new THREE.CircleGeometry(78, 72).rotateX(-Math.PI / 2), stone, 0, 0.02, 10, { cast: false });
  mesh(w, new THREE.CircleGeometry(400, 48).rotateX(-Math.PI / 2), w.texMat(TEX.grass, 600, 600, { color: 0x7fb069 }), 0, -0.02, 0, { cast: false });
  // reflecting pool leading to the door, with fountain jets
  const water = new THREE.MeshStandardMaterial({ color: 0x2a7fb8, metalness: 0.6, roughness: 0.05, transparent: true, opacity: 0.85 });
  mesh(w, new THREE.BoxGeometry(14, 0.5, 34), std(0xf3efe8), 0, 0.25, 26, { solid: true });
  mesh(w, new THREE.PlaneGeometry(13, 33).rotateX(-Math.PI / 2), water, 0, 0.52, 26, { cast: false });
  app.jets = [];
  for (let i = 0; i < 8; i++) for (const sx of [-4, 4]) { const j = mesh(w, new THREE.CylinderGeometry(0.08, 0.2, 2.4, 8), new THREE.MeshStandardMaterial({ color: 0xcfefff, transparent: true, opacity: 0.6, emissive: 0x335577 }), sx, 1.7, 12 + i * 4, { cast: false }); app.jets.push(j); }
  // flags, lamps and palms round the plaza
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI * 0.42 + i / 11 * Math.PI * 0.84, x = Math.sin(a) * 60, z = 10 + Math.cos(a) * 60;
    mesh(w, new THREE.CylinderGeometry(0.12, 0.15, 12, 8), std(0xdddddd, { metalness: 0.8 }), x, 6, z);
    const fl = mesh(w, new THREE.PlaneGeometry(3, 1.8), new THREE.MeshStandardMaterial({ map: logoTex(i % 2), side: THREE.DoubleSide }), x + 1.5, 10.8, z, { ry: a }); fl.userData.dynamic = true; (app.flags ||= []).push(fl);
  }
  for (const [x, z] of [[-22, 30], [22, 30], [-30, 12], [30, 12], [-22, 48], [22, 48], [-40, 30], [40, 30]]) palm(w, x, z);
  for (let i = 0; i < 10; i++) for (const sx of [-1, 1]) { const x = sx * 10, z = 8 + i * 4.4; mesh(w, new THREE.CylinderGeometry(0.06, 0.08, 4, 8), std(0x23324a), x, 2, z); mesh(w, new THREE.SphereGeometry(0.3, 12, 8), std(0xffffff, { emissive: 0xfff1c8, emissiveIntensity: 2 }), x, 4.1, z, { cast: false }); }
  // ---------- the twisting tower behind the atrium ----------
  const glassT = new THREE.MeshStandardMaterial({ color: 0x5aa8e6, metalness: 0.9, roughness: 0.08, envMapIntensity: 1.4 }), slab = std(0xf7f7fb, { roughness: 0.3 });
  for (let i = 0; i < 38; i++) {
    const y = 18 + i * 3.6, r = i * 2.4 * Math.PI / 180;
    mesh(w, new THREE.BoxGeometry(26, 3.2, 26), glassT, 0, y + 1.8, -62, { ry: r });
    mesh(w, new THREE.BoxGeometry(27.4, 0.4, 27.4), slab, 0, y + 0.1, -62, { ry: r });
  }
  const crown = mesh(w, new THREE.TorusGeometry(10, 0.9, 16, 64), std(0xd4af37, { metalness: 1, roughness: 0.2, emissive: 0x6a4a00, emissiveIntensity: 0.6 }), 0, 18 + 38 * 3.6 + 8, -62); crown.rotation.x = Math.PI / 2;
  app.crown = crown;
  const logoBig = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), new THREE.MeshBasicMaterial({ map: wordmark(), transparent: true })); logoBig.position.set(0, 18 + 30 * 3.6, -48.5); S.add(logoBig);
  mesh(w, new THREE.BoxGeometry(30, 18, 30), glassT, 0, 9, -62);
  // ---------- the atrium ----------
  const B = app.bank = new Building(w, { x: H.x, z: H.z, w: H.w, d: H.d, floors: 1, fh: H.fh, base: 0, door: { side: 's', at: 0, width: 10 } });
  const { minX, maxX, minZ, maxZ } = B, cz = H.z;
  const glass = new THREE.MeshStandardMaterial({ color: 0xa8d4f0, metalness: 0.9, roughness: 0.04, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
  const fin = std(0xffffff, { roughness: 0.25, metalness: 0.2 });
  for (const [x0, x1] of [[minX, -5], [5, maxX]]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, H.fh), glass); g.position.set((x0 + x1) / 2, H.fh / 2, maxZ); S.add(g); }
  const top = new THREE.Mesh(new THREE.PlaneGeometry(10, H.fh - 5), glass); top.position.set(0, 5 + (H.fh - 5) / 2, maxZ); S.add(top);
  for (const x of [minX, maxX]) { const g = new THREE.Mesh(new THREE.PlaneGeometry(H.d, H.fh), glass); g.position.set(x, H.fh / 2, cz); g.rotation.y = Math.PI / 2; S.add(g); }
  for (let i = 0; i <= 16; i++) { const x = minX + i * H.w / 16; if (Math.abs(x) < 5.5) continue; mesh(w, new THREE.BoxGeometry(0.35, H.fh, 1.2), fin, x, H.fh / 2, maxZ); }
  for (let i = 0; i <= 10; i++) for (const x of [minX, maxX]) mesh(w, new THREE.BoxGeometry(1.2, H.fh, 0.35), fin, x, H.fh / 2, minZ + i * H.d / 10);
  // the sweeping white roof with a glass skylight
  mesh(w, new THREE.BoxGeometry(H.w + 6, 0.8, H.d + 6), fin, 0, H.fh + 0.4, cz);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(40, 22).rotateX(Math.PI / 2), glass); sky.position.set(0, H.fh + 0.85, cz); S.add(sky);
  mesh(w, new THREE.BoxGeometry(18, 0.6, 8), fin, 0, 5.6, maxZ + 3); // entrance canopy
  for (const sx of [-1, 1]) mesh(w, new THREE.CylinderGeometry(0.25, 0.25, 5.6, 12), std(0xd4af37, { metalness: 1, roughness: 0.2 }), sx * 8, 2.8, maxZ + 6);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(26, 4.5), new THREE.MeshBasicMaterial({ map: wordmark('mBank HEADQUARTERS'), transparent: true })); sign.position.set(0, H.fh + 3.2, maxZ + 0.5); S.add(sign);
  // floor: polished white stone with a gold inlay ring
  mesh(w, new THREE.BoxGeometry(H.w, 0.1, H.d), w.texMat(TEX.tile, H.w / 2, H.d / 2, { color: 0xf8f6f2, roughness: 0.12, metalness: 0.1 }), 0, 0.05, cz, { cast: false });
  mesh(w, new THREE.RingGeometry(8, 8.6, 64).rotateX(-Math.PI / 2), std(0xd4af37, { metalness: 1, roughness: 0.2 }), 0, 0.12, cz, { cast: false });
  // mezzanine balcony round three sides with a glass rail
  for (const [x, z, ww, dd] of [[0, minZ + 4, H.w - 2, 8], [minX + 4, cz + 2, 8, H.d - 12], [maxX - 4, cz + 2, 8, H.d - 12]]) {
    mesh(w, new THREE.BoxGeometry(ww, 0.6, dd), fin, x, 7, z);
    for (let k = 0; k < 8; k++) mesh(w, new THREE.BoxGeometry(ww / 8 - 0.2, 0.08, dd - 0.2), std(0xffffff, { emissive: 0xfff1c8, emissiveIntensity: 0.6 }), x - ww / 2 + (k + 0.5) * ww / 8, 6.68, z, { cast: false });
  }
  // the golden logo ring over a round fountain in the middle
  mesh(w, new THREE.CylinderGeometry(6, 6.4, 0.9, 48), std(0xf3efe8, { roughness: 0.3 }), 0, 0.45, cz, { solid: false });
  B.block(0, 0, cz, 5.4, 5.4);
  mesh(w, new THREE.CircleGeometry(5.6, 48).rotateX(-Math.PI / 2), water, 0, 0.92, cz, { cast: false });
  const ring = app.logo = new THREE.Group(); ring.position.set(0, 7, cz); S.add(ring);
  const gold = std(0xd4af37, { metalness: 1, roughness: 0.18, emissive: 0x4a3200, emissiveIntensity: 0.5 });
  const tor = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.45, 24, 96), gold); tor.castShadow = true; ring.add(tor);
  const lg = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.MeshBasicMaterial({ map: logoTex(0, true), transparent: true, side: THREE.DoubleSide })); ring.add(lg);
  mesh(w, new THREE.CylinderGeometry(0.15, 0.15, 6, 8), gold, 0, 3.6, cz);
  // waterfall wall behind the desks
  const fallTex = canvasTexture(64, 256, (g, W, Hh) => { for (let y = 0; y < Hh; y += 2) { g.fillStyle = `rgba(200,235,255,${0.25 + Math.random() * 0.5})`; g.fillRect(Math.random() * W, y, 2 + Math.random() * 6, 6 + Math.random() * 18); } });
  fallTex.wrapS = fallTex.wrapT = THREE.RepeatWrapping; fallTex.repeat.set(12, 1); app.fall = fallTex;
  mesh(w, new THREE.BoxGeometry(H.w - 4, 6.4, 0.3), std(0x2f6b3a, { roughness: 0.9 }), 0, 10.6, minZ + 0.4); // living green wall
  for (let i = 0; i < 60; i++) mesh(w, new THREE.SphereGeometry(0.5 + Math.random() * 0.4, 8, 6), std(new THREE.Color().setHSL(0.28 + Math.random() * 0.08, 0.6, 0.25 + Math.random() * 0.15)), minX + 3 + Math.random() * (H.w - 6), 8 + Math.random() * 5.2, minZ + 0.8, { cast: false });
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(20, 6.6), new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.85 })); fall.position.set(0, 3.4, minZ + 0.5); S.add(fall);
  mesh(w, new THREE.BoxGeometry(20, 0.5, 1.4), std(0xf3efe8), 0, 0.25, minZ + 0.9);
  // LED wall above the desks
  app.led = canvasTexture(1024, 256, () => {}); app.ledG = app.led.image.getContext('2d');
  const led = new THREE.Mesh(new THREE.PlaneGeometry(28, 7), new THREE.MeshBasicMaterial({ map: app.led })); led.position.set(0, 14.3, minZ + 0.7); S.add(led);
  // pendant lights
  for (let i = 0; i < 24; i++) { const x = minX + 6 + (i % 8) * 7.4, z = minZ + 8 + Math.floor(i / 8) * 11; mesh(w, new THREE.CylinderGeometry(0.01, 0.01, 6, 4), std(0x333333), x, H.fh - 3, z, { cast: false }); const b = mesh(w, new THREE.SphereGeometry(0.5, 16, 10), std(0xffffff, { emissive: 0xfff1c8, emissiveIntensity: 2.2 }), x, H.fh - 6, z, { cast: false }); b.userData.dynamic = true; (app.bulbs ||= []).push(b); }
  // palms in planters and sofas
  for (const [x, z] of [[minX + 5, maxZ - 5], [maxX - 5, maxZ - 5], [-14, cz], [14, cz]]) { mesh(w, new THREE.CylinderGeometry(1.4, 1.2, 1, 20), std(0xf3efe8), x, 0.5, z); B.block(0, x, z, 1.3, 1.3); palm(w, x, z, 1); }
  const sofaM = std(0x23324a, { roughness: 0.85 }), seats = [];
  for (const [x, z, ry] of [[-22, cz + 8, 0], [22, cz + 8, 0], [-22, cz + 13, Math.PI], [22, cz + 13, Math.PI]]) {
    mesh(w, new RoundedBox(5, 0.55, 1.2, 2, 0.15), sofaM, x, 0.35, z, { ry }); mesh(w, new RoundedBox(5, 0.9, 0.3, 2, 0.12), sofaM, x, 0.85, z - Math.cos(ry) * 0.5, { ry }); B.block(0, x, z, 2.5, 0.7);
    for (let k = -1; k <= 1; k++) if (Math.random() < 0.85) seats.push({ x: x + k * 1.5, y: 0.6, z: z + Math.cos(ry) * 0.1, ry, kind: 'sit' });
  }
  // ---------- the desks ----------
  const dz = minZ + 6, desks = [
    { x: -18, icon: '💳', en: 'New card', ru: 'Новая карта', col: 0x1e5bd8, fn: deskCard, staff: '#f2c49b' },
    { x: -6, icon: '✋', en: 'Hand Pay', ru: 'Оплата рукой', col: 0x22a06b, fn: deskHand, staff: '#d9a066' },
    { x: 6, icon: '🎨', en: 'Card style', ru: 'Дизайн карты', col: 0xd82b8c, fn: deskStyle, staff: '#ffd9b8' },
    { x: 18, icon: '📈', en: 'mPAY level', ru: 'Уровень mPAY', col: 0xd4af37, fn: deskLevel, staff: '#c68642' },
  ];
  for (const D of desks) {
    mesh(w, new RoundedBox(6, 1.15, 1.4, 2, 0.15), std(0xffffff, { roughness: 0.2 }), D.x, 0.58, dz); B.block(0, D.x, dz, 3, 0.8);
    mesh(w, new THREE.BoxGeometry(6.1, 0.3, 0.06), std(D.col, { emissive: D.col, emissiveIntensity: 0.8 }), D.x, 0.9, dz + 0.72, { cast: false });
    const st = new Avatar({ skin: D.staff, face: 'smile', hair: ['bun', 'short', 'long', 'curly'][desks.indexOf(D)], hairColor: '#2b1d14', top: 'plain', shirt: '#0f2a4a', pants: '#0f2a4a', shoes: '#111', hat: 'none', pet: 'none', height: 1 }, '', 'bot');
    st.group.position.set(D.x, 0, dz - 1.4); S.add(st.group); D.av = st;
    const lab = labelSprite(`${D.icon} ${L(D.en, D.ru)}`, 0.65, { bg: '#' + D.col.toString(16).padStart(6, '0') }); lab.position.set(D.x, 3.4, dz); S.add(lab);
    const ring2 = mesh(w, new THREE.RingGeometry(0.9, 1.2, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: D.col }), D.x, 0.13, dz + 2.2, { cast: false }); void ring2;
    w.zone({ test: (px, py, pz) => Math.hypot(px - D.x, pz - (dz + 2.2)) < 1.2 && py < 3, onEnter: () => { st.play('wave'); app.sfx('chime'); D.fn(app); } });
  }
  w.updaters.push((dt, t) => desks.forEach((D, i) => { D.av.animate(0, dt, false); if (!D.av.emote && Math.sin(t * 0.5 + i * 1.7) > 0.997) D.av.play('wave'); }));
  // ATMs along the side walls
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const x = sx * (H.w / 2 - 1), z = cz - 8 + i * 8;
    mesh(w, new RoundedBox(0.9, 2.3, 1.4, 2, 0.1), std(0x1b1f2a, { metalness: 0.6 }), x, 1.15, z); B.block(0, x, z, 0.5, 0.7);
    mesh(w, new THREE.PlaneGeometry(1.1, 0.7), std(0x0a0f14, { emissive: 0x3ac3ff, emissiveIntensity: 1.2 }), x - sx * 0.46, 1.6, z, { ry: -sx * Math.PI / 2, cast: false });
    const l = labelSprite('🏧 ATM', 0.38, { bg: 'rgba(15,42,74,0.9)' }); l.position.set(x - sx * 0.5, 2.8, z); S.add(l);
    w.zone({ test: (px, py, pz) => Math.hypot(px - (x - sx * 1.6), pz - z) < 0.9 && py < 3, onEnter: () => atm(app) });
  }
  // ---------- people ----------
  const stops = desks.map(D => ({ x: D.x, z: dz + 2.6, face: Math.PI })).concat([{ x: 0, z: cz + 7, face: Math.PI }, { x: -H.w / 2 + 2.6, z: cz, face: -Math.PI / 2 }, { x: H.w / 2 - 2.6, z: cz, face: Math.PI / 2 }]);
  app.people = new People(w, {
    rings: [{ cx: 0, cz: cz + 1, rx: 22, rz: 11, n: w.hq ? 80 : 55, stops }, { cx: 0, cz: 26, rx: 34, rz: 24, n: w.hq ? 90 : 60, stops: [{ x: 0, z: 9, face: Math.PI }, { x: -8, z: 30, face: Math.PI / 2 }, { x: 8, z: 30, face: -Math.PI / 2 }] }],
    seats: seats.concat(Array.from({ length: 10 }, (_, i) => ({ x: -7 + (i % 5) * 3.5, y: 0.5, z: 44 + Math.floor(i / 5) * 1.5, ry: Math.PI, kind: 'stand' }))),
    far: w.hq ? 140 : 95,
  });
  skyDeck(app);
  app.cardsToday = 1200 + Math.floor(Math.random() * 300);
  drawLed(app, 0);
}

function frame(dt, t, app) {
  if (!app.logo) return;
  // clear air on the Sky Deck so you can see far
  const high = app.world.me.group.position.y > 100, fd = high ? 0.0005 : 0.0022; app.world.scene.fog.density += (fd - app.world.scene.fog.density) * Math.min(1, dt * 2);
  app.logo.rotation.y += dt * (app.spinUntil > t ? 6 : 0.4);
  app.crown.rotation.z += dt * 0.2;
  app.fall.offset.y -= dt * 0.9;
  app.flags.forEach((f, i) => { f.rotation.y += Math.sin(t * 2 + i) * 0.004; });
  const mega = app.megaUntil > t;
  app.jets.forEach((j, i) => { const h = (mega ? 9 : 2.4) + Math.sin(t * 3 + i) * (mega ? 2 : 0.3); j.scale.y = h / 2.4; j.position.y = 0.5 + h / 2; });
  if ((app._led = (app._led || 0) + dt) > 0.25) { app._led = 0; drawLed(app, t); }
  if (app.showUntil > t) app.bulbs.forEach((b, i) => b.material.emissive.setHSL((t * 0.3 + i * 0.04) % 1, 1, 0.55));
  else if (app._show) { app._show = false; app.bulbs.forEach(b => b.material.emissive.set(0xfff1c8)); }
  if (app.coins) { app.coins.forEach(c => { c.position.y -= dt * c.userData.v; c.rotation.y += dt * 5; if (c.position.y < 0.1) c.position.y = 16 + Math.random() * 4; }); if (app.coinsUntil < t) { app.coins.forEach(c => app.world.scene.remove(c)); app.coins = null; } }
}

function drawLed(app, t) {
  const g = app.ledG, W = 1024, Hh = 256;
  const grd = g.createLinearGradient(0, 0, W, Hh); grd.addColorStop(0, '#0b1530'); grd.addColorStop(1, '#1e2b6a'); g.fillStyle = grd; g.fillRect(0, 0, W, Hh);
  g.fillStyle = '#ffd34d'; g.font = '800 70px Manrope, system-ui'; g.textBaseline = 'middle'; g.fillText('mBank', 40, 70);
  g.fillStyle = '#fff'; g.font = '700 34px Manrope, system-ui'; g.fillText(L('Cards opened today', 'Карт открыто сегодня') + ': ' + (app.cardsToday + Math.floor(t / 9)).toLocaleString(), 40, 150);
  g.fillStyle = '#7dffc6'; g.font = '700 30px Manrope, system-ui';
  const tick = L('★ 7-digit cards  ★ Hand Pay  ★ mPAY cashback up to 10%  ★ Scratch cards  ★ Welcome to mBank Headquarters  ', '★ Карты из 7 цифр  ★ Оплата рукой  ★ Кэшбэк mPAY до 10%  ★ Скретч-карты  ★ Добро пожаловать в mBank  ');
  const x = -((t * 120) % 1400); g.fillText(tick + tick, x + 40, 215);
  app.led.needsUpdate = true;
}

function onAdmin(a, d, app) {
  const w = app.world, t = w.clock.elapsedTime;
  if (a === 'goldrain') {
    if (!app.coins) { app.coins = []; const geo = new THREE.CylinderGeometry(0.35, 0.35, 0.08, 20).rotateX(Math.PI / 2), mat = std(0xffd34d, { metalness: 1, roughness: 0.2, emissive: 0x6a4a00 }); for (let i = 0; i < 160; i++) { const c = new THREE.Mesh(geo, mat); c.position.set((Math.random() - 0.5) * 60, 6 + Math.random() * 14, H.z + (Math.random() - 0.5) * 36); c.userData.v = 3 + Math.random() * 4; w.scene.add(c); app.coins.push(c); } }
    app.coinsUntil = t + 20; ui.banner('🪙 ' + L('It is raining gold!', 'Дождь из золота!')); app.sfx('coin'); setTimeout(() => app.sfx('cheer'), 300);
  }
  if (a === 'lights') { app.showUntil = t + 30; app._show = true; ui.banner('🌈 ' + L('Light show!', 'Световое шоу!')); }
  if (a === 'botdance') { app.people.mode = 'dance'; setTimeout(() => (app.people.mode = ''), 25000); ui.banner('🕺 ' + L('The whole bank is dancing!', 'Весь банк танцует!')); }
  if (a === 'spin') { app.spinUntil = t + 15; ui.banner('🌀 ' + L('The golden logo goes wild!', 'Золотой логотип крутится!')); }
  if (a === 'fountain') { app.megaUntil = t + 25; ui.banner('⛲ ' + L('Mega fountain!', 'Мега-фонтан!')); app.sfx('splash'); }
}

// ---------- desks ----------
function cardHtml(app) {
  const st = STYLES[+(localStorage.getItem('marbly_card_style') || 0)] || STYLES[0];
  return `<div class="x-card7" style="background:linear-gradient(135deg,${st[1]},${st[2]} 60%,${st[3]})"><b>mBank</b><span>${fmt(app.bank.card)}</span><small>${esc(app.me.name)} · ${L('7-digit Marbly card', 'Карта Marbly из 7 цифр')}</small></div>`;
}
function deskCard(app) {
  if (app.bank.card && app.bank.card.length === 7) { ui.modal('💳 ' + L('Your mBank card', 'Твоя карта mBank'), `${cardHtml(app)}<p class="center">${L('This is your card. Pay with it everywhere in Marbly with mPAY.', 'Это твоя карта. Плати ей везде в Marbly через mPAY.')}</p><div class="row"><button class="btn primary" id="hOk">OK</button></div>`); document.querySelector('#hOk').onclick = () => ui.close(); return; }
  ui.modal('💳 ' + L('Open your mBank card', 'Открой карту mBank'), `<p>👩‍💼 ${L('Welcome to mBank! Your new card is free. Its number has only <b>7 digits</b>, so nobody mistakes it for a real bank card.', 'Добро пожаловать в mBank! Карта бесплатная. В её номере всего <b>7 цифр</b>, чтобы её не перепутали с настоящей.')}</p><div class="row"><button class="btn primary big" id="hOpen">💳 ${L('Open my card', 'Открыть карту')}</button></div>`);
  document.querySelector('#hOpen').onclick = async e => {
    e.target.disabled = true;
    try { const c = await app.net.bankOpen(); app.bank.card = c; } catch (er) { ui.toast('⚠️ ' + L('Could not open the card. Try again.', 'Не получилось. Попробуй ещё.')); e.target.disabled = false; return; }
    app.sfx('paid'); confetti(); app.world.fireworks(3);
    ui.modal('🎉 ' + L('Your card is ready!', 'Карта готова!'), `${cardHtml(app)}<p class="center">${L('Next: switch on Hand Pay at the green desk.', 'Дальше: включи оплату рукой у зелёной стойки.')}</p><div class="row"><button class="btn primary" id="hOk">OK</button></div>`);
    document.querySelector('#hOk').onclick = () => ui.close();
  };
}
function deskHand(app) {
  if (!app.bank.card) { ui.modal('✋ Hand Pay', `<p>${L('Open your card at the blue desk first.', 'Сначала открой карту у синей стойки.')}</p>`); return; }
  if (app.bank.hand) { ui.modal('✋ Hand Pay', `<p class="center" style="font-size:44px">✋✅</p><p class="center">${L('Hand Pay is on. Hold your hand on any mPAY scanner to pay.', 'Оплата рукой включена. Приложи руку к сканеру mPAY.')}</p>`); return; }
  const b = ui.modal('✋ Hand Pay', `<p>${L('Press and hold your hand on the scanner.', 'Приложи и держи руку на сканере.')}</p><div id="hPalm" class="palm small-palm"><svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="54"/><circle class="arc" cx="60" cy="60" r="54" pathLength="100"/></svg><span class="hand">🖐️</span><i class="scanline"></i></div>`);
  const P = b.querySelector('#hPalm'), arc = P.querySelector('.arc'); let t0 = 0, raf = 0, on = false;
  const tick = () => { const k = Math.min(1, (performance.now() - t0) / 1200); arc.style.strokeDashoffset = 100 - k * 100; if (k >= 1) { on = false; done(); return; } raf = requestAnimationFrame(tick); };
  const done = async () => { P.classList.add('done'); try { await app.net.handSetup(); } catch (e) {} app.bank.hand = true; app.sfx('paid'); confetti(60); setTimeout(() => deskHand(app), 600); };
  P.addEventListener('pointerdown', e => { e.preventDefault(); if (on) return; on = true; t0 = performance.now(); P.classList.add('scanning'); app.sfx('scan'); tick(); });
  const up = () => { if (!on) return; on = false; cancelAnimationFrame(raf); P.classList.remove('scanning'); arc.style.strokeDashoffset = 100; };
  P.addEventListener('pointerup', up); P.addEventListener('pointerleave', up);
}
function deskStyle(app) {
  if (!app.bank.card) { ui.modal('🎨 ' + L('Card style', 'Дизайн карты'), `<p>${L('Open your card at the blue desk first.', 'Сначала открой карту у синей стойки.')}</p>`); return; }
  const draw = () => {
    const b = ui.modal('🎨 ' + L('Card style', 'Дизайн карты'), `${cardHtml(app)}<div class="menu-grid">${STYLES.map((s, i) => `<button class="tile" data-i="${i}" style="background:linear-gradient(135deg,${s[1]},${s[3]});color:#fff"><span>${s[0]}</span></button>`).join('')}</div>`);
    b.querySelectorAll('[data-i]').forEach(x => x.onclick = () => { try { localStorage.setItem('marbly_card_style', x.dataset.i); } catch (e) {} app.sfx('star'); draw(); });
  };
  draw();
}
async function deskLevel(app) {
  await app.mpay.refresh();
  const b = ui.modal('📈 mPAY', `<div class="mpay" style="width:100%">${app.mpay.html()}</div><p class="muted">${L('Every mPAY payment gives cashback and a scratch card. Spend more to reach Silver, Gold and Diamond.', 'Каждая оплата mPAY даёт кэшбэк и скретч-карту. Трать больше — получишь Серебро, Золото и Бриллиант.')}</p>`);
  app.mpay.bind(b, () => ui.close());
}
async function atm(app) {
  await app.refreshMoney(); await app.mpay.refresh();
  const b = ui.modal('🏧 ATM', `<div class="mpay" style="width:100%"><div class="mpay-brand">mBank</div>${app.bank.card ? cardHtml(app) : `<p>${L('No card yet: open one at the blue desk.', 'Карты нет: открой у синей стойки.')}</p>`}<div class="mpay-total"><span>${L('Balance', 'Баланс')}</span><b>${money(app.money)}</b></div>${app.mpay.html()}</div>`);
  app.mpay.bind(b, () => ui.close());
}

// ---------- art ----------
function logoTex(alt = 0, round = false) {
  return canvasTexture(256, 256, (g, W) => {
    if (!round) { g.fillStyle = alt ? '#0f2a4a' : '#1e5bd8'; g.fillRect(0, 0, W, W); }
    g.fillStyle = round ? '#ffd34d' : '#fff'; g.font = '900 170px Manrope, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('m', W / 2, W / 2 - 10);
  });
}
function wordmark(text = 'mBank') {
  return canvasTexture(1024, 256, (g, W, Hh) => {
    g.clearRect(0, 0, W, Hh); g.fillStyle = 'rgba(15,42,74,0.85)'; g.beginPath(); g.roundRect(8, 30, W - 16, Hh - 60, 40); g.fill();
    g.fillStyle = '#ffd34d'; g.font = `900 ${text.length > 8 ? 76 : 130}px Manrope, system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, Hh / 2 + 4);
  });
}
function palm(w, x, z, y0 = 0) {
  const trunk = std(0x8a6a44, { roughness: 0.9 }), leaf = std(0x2f8f3a, { roughness: 0.8, side: THREE.DoubleSide });
  mesh(w, new THREE.CylinderGeometry(0.22, 0.35, 7, 8), trunk, x, y0 + 3.5, z);
  for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2, l = mesh(w, new THREE.PlaneGeometry(1.1, 4.2), leaf, x + Math.sin(a) * 1.6, y0 + 7, z + Math.cos(a) * 1.6, { ry: a }); l.rotation.x = -1.0; }
  if (!y0) w.solids.push({ x, z, r: 0.4 });
}

// ---------- 🌆 the Sky Deck on top of the tower ----------
function skyDeck(app) {
  const w = app.world, S = w.scene, Y = 18 + 38 * 3.6 + 0.2, cx = 0, cz = -62, R = 13.5;
  // the floor, a glass rail all round (you can't fall off), benches, telescopes and a few visitors
  mesh(w, new THREE.BoxGeometry(R * 2, 0.4, R * 2), std(0xf3efe8, { roughness: 0.35 }), cx, Y - 0.2, cz);
  w.grounds.push((x, z, y) => (Math.abs(x - cx) < R && Math.abs(z - cz) < R && y > Y - 6 ? Y : null));
  const rail = new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.3, metalness: 0.6, roughness: 0.05, side: THREE.DoubleSide, depthWrite: false });
  for (const [x, z, ry] of [[cx, cz - R, 0], [cx, cz + R, 0], [cx - R, cz, Math.PI / 2], [cx + R, cz, Math.PI / 2]]) {
    const g = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, 1.3), rail); g.position.set(x, Y + 0.65, z); g.rotation.y = ry; S.add(g);
    mesh(w, new THREE.BoxGeometry(R * 2, 0.1, 0.12), std(0xd4af37, { metalness: 1, roughness: 0.2 }), x, Y + 1.3, z, { ry, cast: false });
    w.solids.push({ x, z, hw: ry ? 0.15 : R, hd: ry ? R : 0.15, rot: 0, y0: Y - 3, y1: Y + 6 });
  }
  for (const [x, z, ry] of [[cx - 8, cz + 8, Math.PI * 0.75], [cx + 8, cz + 8, -Math.PI * 0.75], [cx - 8, cz - 8, Math.PI / 4], [cx + 8, cz - 8, -Math.PI / 4]]) {
    mesh(w, new THREE.CylinderGeometry(0.08, 0.12, 1.2, 8), std(0x23324a, { metalness: 0.7 }), x, Y + 0.6, z);
    const tube = mesh(w, new THREE.CylinderGeometry(0.12, 0.18, 0.9, 10), std(0xd4af37, { metalness: 1, roughness: 0.2 }), x, Y + 1.3, z, { ry }); tube.rotation.x = 1.2;
    w.zone({ test: (px, py, pz) => Math.hypot(px - x, pz - z) < 1.1 && py > Y - 1, onEnter: () => { ui.banner('🔭 ' + L('What a view! You can see the whole of Marbly.', 'Какой вид! Видно весь Marbly.'), 3000); app.sfx('star'); } });
  }
  for (const [x, z] of [[cx, cz + 10.5], [cx, cz - 10.5]]) mesh(w, new RoundedBox(5, 0.45, 0.9, 2, 0.12), std(0x23324a), x, Y + 0.3, z);
  const sign = labelSprite('🌆 mBank SKY DECK', 0.9, { bg: 'rgba(15,42,74,0.92)', weight: 800 }); sign.position.set(cx, Y + 4, cz); S.add(sign);
  // the glass lift: a pad in the lobby and one up here
  const lift = (x, z, y, label, toUp) => {
    mesh(w, new THREE.CylinderGeometry(1.4, 1.5, 0.2, 36), std(0x111827, { emissive: 0x3a86ff, emissiveIntensity: 0.8 }), x, y + 0.1, z, { cast: false });
    const glassTube = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 3, 24, 1, true), new THREE.MeshStandardMaterial({ color: 0x9fd4ff, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false })); glassTube.position.set(x, y + 1.6, z); S.add(glassTube);
    const l = labelSprite(label, 0.5, { bg: 'rgba(58,134,255,0.95)' }); l.position.set(x, y + 3.6, z); S.add(l);
    w.zone({ test: (px, py, pz) => Math.hypot(px - x, pz - z) < 1.2 && Math.abs(py - y) < 2, onEnter: () => ride(app, toUp) });
  };
  lift(9, -12, 0, '🌆 ' + L('Sky Deck lift', 'Лифт на крышу'), true);
  lift(cx + 6, cz, Y, '⬇ ' + L('Back to the lobby', 'Вниз в лобби'), false);
  app.deckPeople = new People(w, { rings: [], seats: [[cx - 9, cz + 12.2, 0], [cx - 3, cz + 12.2, 0], [cx + 4, cz - 12.2, Math.PI], [cx + 10, cz - 12.2, Math.PI], [cx - 12.2, cz + 2, -Math.PI / 2], [cx + 12.2, cz - 4, Math.PI / 2]].map(([x, z, ry]) => ({ x, y: Y, z, ry, kind: 'stand' })), far: 80 });
  app.deck = { cx, cz, Y };
}
function ride(app, up) {
  const w = app.world, D = app.deck; if (app._riding) return; app._riding = true;
  app.sfx('ding'); ui.banner(up ? '🛗 ' + L('Going up to the Sky Deck…', 'Едем на крышу…') : '🛗 ' + L('Going down…', 'Едем вниз…'), 1600);
  const f = document.querySelector('#xFlash'); f.style.background = '#000'; f.classList.remove('on'); f.offsetHeight; f.classList.add('on');
  setTimeout(() => { if (up) w.teleport(D.cx + 3, D.cz + 3, Math.PI, D.Y + 0.1); else w.teleport(9, -9, Math.PI); app.sfx('ding'); f.style.background = ''; app._riding = false; }, 380);
}
