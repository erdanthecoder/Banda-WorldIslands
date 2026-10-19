// 🛡️ Admin abuse that works in every Marbly game: launches, meteors, black holes, tornadoes, big heads,
// coin rain, upside-down screens and lots more. Everything is local to each player's screen, lasts a short
// while and then cleans itself up. core.js shows the buttons and calls abuse() when a command arrives.
import * as THREE from 'three';
import { labelSprite } from '../world.js';

export const MORE = [
  { a: 'launch', icon: '🚀', en: 'Launch everyone', ru: 'Запустить всех в небо' },
  { a: 'superjump', icon: '🦘', en: 'Super jump', ru: 'Супер прыжок' },
  { a: 'bouncy', icon: '🏀', en: 'Bouncy floor', ru: 'Пружинящий пол' },
  { a: 'balloon', icon: '🎈', en: 'Float away', ru: 'Улететь как шарик' },
  { a: 'freeze', icon: '🧊', en: 'Freeze everyone', ru: 'Заморозить всех' },
  { a: 'slowmo', icon: '🐌', en: 'Slow motion', ru: 'Замедление' },
  { a: 'spin', icon: '🌀', en: 'Spin everyone', ru: 'Всех закружить' },
  { a: 'bighead', icon: '🎃', en: 'Big heads', ru: 'Большие головы' },
  { a: 'invisible', icon: '👻', en: 'Invisible', ru: 'Невидимки' },
  { a: 'meteor', icon: '☄️', en: 'Meteor shower', ru: 'Метеоритный дождь' },
  { a: 'blackhole', icon: '🕳️', en: 'Black hole', ru: 'Чёрная дыра' },
  { a: 'tornado', icon: '🌪️', en: 'Tornado', ru: 'Торнадо' },
  { a: 'boom', icon: '💥', en: 'Explosion', ru: 'Взрыв' },
  { a: 'quake', icon: '📳', en: 'Earthquake', ru: 'Землетрясение' },
  { a: 'flip', icon: '🙃', en: 'Upside-down screen', ru: 'Экран вверх ногами' },
  { a: 'rainbow', icon: '🌈', en: 'Rainbow world', ru: 'Радужный мир' },
  { a: 'night', icon: '🌙', en: 'Night time', ru: 'Ночь' },
  { a: 'fog', icon: '🌫️', en: 'Spooky fog', ru: 'Жуткий туман' },
  { a: 'bubbles', icon: '🫧', en: 'Bubbles', ru: 'Пузыри' },
  { a: 'food', icon: '🍕', en: 'Food rain', ru: 'Дождь из еды' },
  { a: 'coinrain', icon: '🪙', en: 'Coin rain (catch them!)', ru: 'Дождь монет (лови!)' },
  { a: 'duck', icon: '🦆', en: 'Giant duck', ru: 'Гигантская утка' },
  { a: 'bring', icon: '🧲', en: 'Bring everyone to me', ru: 'Все ко мне' },
  { a: 'spawn', icon: '🏠', en: 'Everyone back to start', ru: 'Все на старт' },
];

const now = () => performance.now();
// something that lives in the scene for a while and updates every frame
function temp(app, obj, secs, tick) {
  const w = app.world, t0 = now(); if (obj) w.scene.add(obj);
  w.updaters.push((dt, t) => { const k = (now() - t0) / 1000; if (k > secs) { if (obj) w.scene.remove(obj); tick && tick(dt, t, k, true); return true; } tick && tick(dt, t, k, false); return false; });
}
const me = app => app.world.me.group.position;
function canvasFx(css, secs) { const c = document.querySelector('#scene'); c.style.transition = 'transform .6s, filter .6s'; Object.assign(c.style, css); setTimeout(() => { for (const k in css) c.style[k] = ''; }, secs * 1000); }

export function abuse(app, a, d, { ui, L, sfx, flash, money }) {
  const w = app.world, p = me(app);
  switch (a) {
    case 'launch': w.vel.y = 28; w.onGround = false; sfx('whoosh'); ui.banner('🚀 ' + L('TO THE MOON!', 'НА ЛУНУ!')); return true;
    case 'superjump': app.superJumpUntil = now() + 30000; ui.banner('🦘 ' + L('Super jump for 30 s!', 'Супер прыжок на 30 с!')); sfx('boing'); return true;
    case 'bouncy': ui.banner('🏀 ' + L('The floor is bouncy!', 'Пол пружинит!')); temp(app, null, 20, () => { if (w.onGround && !w.carrier) { w.vel.y = 11; w.onGround = false; sfx('boing'); } }); return true;
    case 'balloon': { ui.banner('🎈 ' + L('You float away!', 'Ты улетаешь!')); const b = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff3d77, roughness: 0.3 })); temp(app, b, 7, (dt, t, k) => { if (!w.carrier) { w.vel.y = Math.max(w.vel.y, 2.2); w.onGround = false; } b.position.set(p.x, p.y + 3.4, p.z); }); return true; }
    case 'freeze': { w.frozenUntil = now() + 6000; ui.banner('🧊 ' + L('FROZEN!', 'ЗАМОРОЖЕНЫ!')); sfx('scan'); const ice = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.6, 1.6), new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.45, roughness: 0.05, metalness: 0.3 })); temp(app, ice, 6, () => ice.position.set(p.x, p.y + 1.2, p.z)); canvasFx({ filter: 'saturate(.4) hue-rotate(160deg) brightness(1.1)' }, 6); return true; }
    case 'slowmo': w.timeScale = 0.35; setTimeout(() => (w.timeScale = 1), 12000); ui.banner('🐌 ' + L('Sloooow motion…', 'Замеееедление…')); return true;
    case 'spin': ui.banner('🌀 ' + L('Everyone spins!', 'Все кружатся!')); temp(app, null, 8, (dt) => { w.me.group.rotation.y += dt * 14; for (const id in w.remotes) w.remotes[id].av.group.rotation.y += dt * 14; }); return true;
    case 'bighead': ui.banner('🎃 ' + L('BIG HEADS!', 'БОЛЬШИЕ ГОЛОВЫ!')); sfx('pop'); temp(app, null, 30, (dt, t, k, end) => { const s = end ? 1 : 2.4; [w.me, ...Object.values(w.remotes).map(r => r.av)].forEach(av => av.head && av.head.scale.setScalar(s)); }); return true;
    case 'invisible': ui.banner('👻 ' + L('Everyone is invisible!', 'Все невидимки!')); temp(app, null, 15, (dt, t, k, end) => { [w.me, ...Object.values(w.remotes).map(r => r.av)].forEach(av => (av.group.visible = end)); }); return true;
    case 'meteor': meteors(app, ui, L, sfx, flash); return true;
    case 'blackhole': blackHole(app, d, ui, L, sfx); return true;
    case 'tornado': tornado(app, ui, L, sfx); return true;
    case 'boom': { flash(); sfx('crash'); const ang = Math.random() * 6.28; w.vel.set(Math.cos(ang) * 16, 14, Math.sin(ang) * 16); w.onGround = false; ui.banner('💥 BOOM!', 1500); shake(app, 1.2, 0.8); return true; }
    case 'quake': ui.banner('📳 ' + L('EARTHQUAKE!', 'ЗЕМЛЕТРЯСЕНИЕ!')); sfx('crash'); shake(app, 8, 0.5); return true;
    case 'flip': canvasFx({ transform: 'rotate(180deg)' }, 12); ui.banner('🙃 ' + L('Upside down!', 'Вверх ногами!')); return true;
    case 'rainbow': { ui.banner('🌈 ' + L('Rainbow world!', 'Радужный мир!')); const c = document.querySelector('#scene'); temp(app, null, 20, (dt, t, k, end) => { c.style.filter = end ? '' : `hue-rotate(${(k * 180) % 360}deg) saturate(1.6)`; }); return true; }
    case 'night': {
      // the game worlds have no island night sky, so dim the sun, sky and fog ourselves and put it back after
      const r = w.renderer, f = w.scene.fog, bg = w.scene.background, keep = { e: r.toneMappingExposure, s: w.sun.intensity, h: w.hemi.intensity, f: f.color.clone(), bg: bg && bg.isColor ? bg.clone() : null };
      r.toneMappingExposure = keep.e * 0.55; w.sun.intensity = keep.s * 0.12; w.hemi.intensity = keep.h * 0.5; f.color.set(0x0b1222); if (keep.bg) bg.set(0x0b1222);
      const moon = labelSprite('🌕', 6, { bg: null }); moon.position.set(p.x + 60, p.y + 70, p.z - 80);
      temp(app, moon, 40, (dt, t, k, end) => { if (end) { r.toneMappingExposure = keep.e; w.sun.intensity = keep.s; w.hemi.intensity = keep.h; f.color.copy(keep.f); if (keep.bg) bg.copy(keep.bg); } });
      canvasFx({ filter: 'brightness(.5) saturate(.75) sepia(.15) hue-rotate(190deg)' }, 40);
      ui.banner('🌙 ' + L('Night falls…', 'Наступила ночь…')); return true;
    }
    case 'fog': { const f = w.scene.fog, d0 = f.density, c0 = f.color.clone(); f.density = 0.09; f.color.set(0x2a2f3a); sfx('aww'); ui.banner('🌫️ ' + L('Spooky fog…', 'Жуткий туман…')); setTimeout(() => { f.density = d0; f.color.copy(c0); }, 15000); return true; }
    case 'bubbles': rainOf(app, ['🫧'], 15, 0.9, -1.2, 120); ui.banner('🫧 ' + L('Bubbles!', 'Пузыри!')); return true;
    case 'food': rainOf(app, ['🍕', '🍩', '🍰', '🍔', '🍟', '🍦', '🍉', '🌮'], 15, 0.8, 4, 140); ui.banner('🍕 ' + L('It is raining food!', 'Дождь из еды!')); sfx('eat'); return true;
    case 'coinrain': coinRain(app, ui, L, sfx, money); return true;
    case 'duck': giantDuck(app, ui, L, sfx); return true;
    case 'bring': if (typeof d.x === 'number' && !w.carrier) { const a2 = Math.random() * 6.28; w.teleport(d.x + Math.cos(a2) * 3, d.z + Math.sin(a2) * 3); if (typeof d.y === 'number') p.y = d.y; sfx('teleport'); ui.banner('🧲 ' + L('Pulled to the admin!', 'Тебя притянул админ!'), 2000); } return true;
    case 'spawn': if (!w.carrier) { const s = (app.def && app.def.spawn) || [-13, 4, 0]; w.teleport(s[0], s[1], s[2]); sfx('teleport'); ui.banner('🏠 ' + L('Back to the start!', 'Все на старт!'), 2000); } return true;
  }
  return false;
}

function shake(app, secs, amt) { const cam = app.world.camera; temp(app, null, secs, (dt, t, k, end) => { if (end) return; const f = amt * (1 - k / secs); cam.position.x += (Math.random() - 0.5) * f; cam.position.y += (Math.random() - 0.5) * f; cam.position.z += (Math.random() - 0.5) * f; }); }

// emoji sprites falling (or rising when speed < 0) around you
function rainOf(app, list, secs, size, speed, n) {
  const w = app.world, p = me(app), g = new THREE.Group(), items = [];
  const mats = list.map(e => labelSprite(e, size, { bg: null }).material);
  for (let i = 0; i < n; i++) { const s = new THREE.Sprite(mats[i % mats.length]); s.scale.set(size, size, 1); s.userData.v = Math.abs(speed) * (0.6 + Math.random() * 0.8) * Math.sign(speed || 1); s.position.set(p.x + (Math.random() - 0.5) * 40, speed > 0 ? p.y + 5 + Math.random() * 20 : p.y + Math.random() * 3, p.z + (Math.random() - 0.5) * 40); items.push(s); g.add(s); }
  temp(app, g, secs, dt => items.forEach(s => { s.position.y -= s.userData.v * dt; if (speed > 0 && s.position.y < me(app).y - 1) s.position.y = me(app).y + 18; if (speed < 0 && s.position.y > me(app).y + 14) s.position.y = me(app).y; }));
}

function meteors(app, ui, L, sfx, flash) {
  ui.banner('☄️ ' + L('METEOR SHOWER! Run!', 'МЕТЕОРИТНЫЙ ДОЖДЬ! Беги!')); sfx('airhorn');
  const w = app.world, geo = new THREE.IcosahedronGeometry(1.1, 1), mat = new THREE.MeshStandardMaterial({ color: 0x5a3a28, emissive: 0xff5a1a, emissiveIntensity: 1.4, roughness: 0.8, flatShading: true });
  const ring = new THREE.RingGeometry(0.2, 2.4, 32).rotateX(-Math.PI / 2), ringM = new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.8 });
  let n = 0; const iv = setInterval(() => {
    if (++n > 18) return clearInterval(iv);
    const p = me(app), tx = p.x + (Math.random() - 0.5) * 30, tz = p.z + (Math.random() - 0.5) * 30, gy = w.groundAt(tx, tz, p.y + 2);
    const m = new THREE.Mesh(geo, mat), warn = new THREE.Mesh(ring, ringM.clone()); warn.position.set(tx, gy + 0.08, tz); w.scene.add(warn);
    const sx = tx + 30, sy = gy + 60; m.position.set(sx, sy, tz);
    temp(app, m, 1.4, (dt, t, k, end) => {
      m.position.set(sx + (tx - sx) * k / 1.4, sy + (gy - sy) * k / 1.4, tz); m.rotation.x += dt * 6; warn.material.opacity = 0.4 + Math.sin(k * 20) * 0.3;
      if (end) { w.scene.remove(warn); sfx('crash'); const q = me(app), dd = Math.hypot(q.x - tx, q.z - tz); if (dd < 4 && !w.carrier) { w.vel.set((q.x - tx) / (dd || 1) * 12, 13, (q.z - tz) / (dd || 1) * 12); w.onGround = false; flash(); } if (dd < 25) shake(app, 0.5, 0.5); boomFx(app, tx, gy, tz); }
    });
  }, 450);
}
function boomFx(app, x, y, z) { const s = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9 })); s.position.set(x, y + 0.5, z); temp(app, s, 0.6, (dt, t, k) => { s.scale.setScalar(1 + k * 8); s.material.opacity = 0.9 * (1 - k / 0.6); }); }

function blackHole(app, d, ui, L, sfx) {
  const w = app.world, p = me(app), c = new THREE.Vector3(typeof d.x === 'number' ? d.x : p.x + 12, p.y + 3, typeof d.z === 'number' ? d.z : p.z);
  const g = new THREE.Group(); g.position.copy(c);
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1.6, 24, 16), new THREE.MeshBasicMaterial({ color: 0x000000 })));
  const disk = new THREE.Mesh(new THREE.RingGeometry(1.8, 5, 64), new THREE.MeshBasicMaterial({ color: 0x9b5cff, transparent: true, opacity: 0.7, side: THREE.DoubleSide, blending: THREE.AdditiveBlending })); disk.rotation.x = -1.2; g.add(disk);
  ui.banner('🕳️ ' + L('A BLACK HOLE! Hold on!', 'ЧЁРНАЯ ДЫРА! Держись!')); sfx('vacuum');
  temp(app, g, 10, (dt, t, k, end) => {
    disk.rotation.z += dt * 3; g.scale.setScalar(Math.min(1, k) * (end ? 0 : 1));
    if (end || w.carrier) return; const q = me(app), dx = c.x - q.x, dz = c.z - q.z, dist = Math.hypot(dx, dz) || 1;
    const pull = Math.min(14, 140 / dist); w.vel.x = dx / dist * pull - dz / dist * 4; w.vel.z = dz / dist * pull + dx / dist * 4;
    if (dist < 3) { w.vel.y = 6; w.onGround = false; }
  });
  setTimeout(() => { if (!w.carrier) { w.vel.set((Math.random() - 0.5) * 20, 18, (Math.random() - 0.5) * 20); w.onGround = false; sfx('crash'); } }, 10000);
}

function tornado(app, ui, L, sfx) {
  const w = app.world, p = me(app), g = new THREE.Group(), parts = [];
  const mat = new THREE.MeshBasicMaterial({ color: 0xb8c2cc, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  for (let i = 0; i < 14; i++) { const r = 0.8 + i * 0.55, m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.25 + i * 0.05, 6, 24), mat); m.rotation.x = Math.PI / 2; m.position.y = i * 1.4; g.add(m); parts.push(m); }
  const c = { x: p.x + 20, z: p.z }; ui.banner('🌪️ ' + L('TORNADO!', 'ТОРНАДО!')); sfx('whoosh');
  temp(app, g, 16, (dt, t, k) => {
    const q = me(app); c.x += ((q.x - c.x) * 0.25 + Math.sin(t * 0.7) * 3) * dt; c.z += ((q.z - c.z) * 0.25 + Math.cos(t * 0.6) * 3) * dt;
    g.position.set(c.x, w.groundAt(c.x, c.z, q.y + 2), c.z); parts.forEach((m, i) => { m.rotation.z += dt * (4 + i * 0.3); m.position.x = Math.sin(t * 3 + i * 0.5) * 0.4; });
    const dx = q.x - c.x, dz = q.z - c.z, dd = Math.hypot(dx, dz);
    if (dd < 5 && !w.carrier) { w.vel.x = -dz / (dd || 1) * 10; w.vel.z = dx / (dd || 1) * 10; w.vel.y = Math.max(w.vel.y, 5); w.onGround = false; if (Math.random() < dt) sfx('whoosh'); }
  });
}

function coinRain(app, ui, L, sfx, money) {
  ui.banner('🪙 ' + L('COIN RAIN! Catch them!', 'ДОЖДЬ МОНЕТ! Лови!')); sfx('coin');
  const w = app.world, geo = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 18).rotateX(Math.PI / 2), mat = new THREE.MeshStandardMaterial({ color: 0xffd34d, metalness: 1, roughness: 0.25, emissive: 0x6a4a00 });
  const coins = new THREE.InstancedMesh(geo, mat, 90), list = [], M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(1, 1, 1), E = new THREE.Euler();
  const drop = c => { const p = me(app); c.x = p.x + (Math.random() - 0.5) * 24; c.z = p.z + (Math.random() - 0.5) * 24; c.y = p.y + 8 + Math.random() * 12; c.v = 3 + Math.random() * 3; };
  for (let i = 0; i < 90; i++) { const c = {}; drop(c); list.push(c); }
  coins.frustumCulled = false; let got = 0, pending = 0;
  const pay = () => { if (pending <= 0) return; const c = Math.min(500, pending); pending -= c; app.net.earn(c).then(b => app.setMoney(b)).catch(() => {}); };
  const iv = setInterval(pay, 2500);
  temp(app, coins, 20, (dt, t, k, end) => {
    if (end) { clearInterval(iv); pay(); if (got) ui.toast(`🪙 ${L('You caught', 'Ты поймал')} ${got} → +${money(got * 5)}`); return; }
    const p = me(app);
    list.forEach((c, i) => { c.y -= c.v * dt; if (c.y < p.y - 2) drop(c); if (Math.abs(c.x - p.x) < 1 && Math.abs(c.z - p.z) < 1 && c.y > p.y - 0.2 && c.y < p.y + 2.2) { got++; pending += 5; sfx('coin'); drop(c); } E.set(0, t * 4 + i, 0); Q.setFromEuler(E); M.compose(new THREE.Vector3(c.x, c.y, c.z), Q, S); coins.setMatrixAt(i, M); });
    coins.instanceMatrix.needsUpdate = true;
  });
}

function giantDuck(app, ui, L, sfx) {
  const w = app.world, p = me(app), g = new THREE.Group(), yel = new THREE.MeshStandardMaterial({ color: 0xffd21f, roughness: 0.35 }), org = new THREE.MeshStandardMaterial({ color: 0xff8a1c, roughness: 0.4 }), blk = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(4, 32, 24), yel); body.scale.set(1.3, 0.9, 1); body.position.y = 3.4; g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(2.4, 32, 24), yel); head.position.set(3.6, 7.4, 0); g.add(head);
  const beak = new THREE.Mesh(new THREE.SphereGeometry(1.2, 20, 12), org); beak.scale.set(1.6, 0.5, 1); beak.position.set(6, 7, 0); g.add(beak);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8), blk); e.position.set(5.2, 8.2, s * 1.2); g.add(e); }
  const tail = new THREE.Mesh(new THREE.ConeGeometry(1.4, 2.4, 16), yel); tail.rotation.z = 1.1; tail.position.set(-5.2, 5, 0); g.add(tail);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const a0 = Math.random() * 6.28; g.position.set(p.x + Math.cos(a0) * 14, w.groundAt(p.x + Math.cos(a0) * 14, p.z + Math.sin(a0) * 14, p.y + 2), p.z + Math.sin(a0) * 14);
  ui.banner('🦆 ' + L('QUACK! A giant duck appears!', 'КРЯ! Появилась гигантская утка!')); sfx('boing');
  w.solids.push(g.userData.solid = { x: g.position.x, z: g.position.z, r: 5 });
  temp(app, g, 30, (dt, t, k, end) => { g.rotation.y = Math.sin(t * 0.8) * 0.6 + a0; body.position.y = 3.4 + Math.abs(Math.sin(t * 2)) * 0.4; head.rotation.z = Math.sin(t * 3) * 0.15; if (Math.random() < dt * 0.5) sfx('boing'); if (end) { const i = w.solids.indexOf(g.userData.solid); if (i >= 0) w.solids.splice(i, 1); } });
}
