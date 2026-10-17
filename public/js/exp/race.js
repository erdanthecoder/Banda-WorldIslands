// 🏁 Island Raceway: buy a car at Island Motors with mBank (mPAY), step on the start pad and race
// against players and bots while a huge crowd watches from the grandstand. Two laps, prizes for the podium.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { experience, L, ui, std, mesh, canvasTexture, confetti, esc, money } from './core.js';
import { TEX, labelSprite } from '../world.js';
import { People } from './people.js';
import { surface } from './tex.js';
import { Coins } from './fun.js';

const CARS = {
  kart: { en: 'Go-kart', ru: 'Карт', price: 0, max: 22, acc: 11, turn: 2.6, color: 0x2ec4b6 },
  car_buggy: { en: 'Beach Buggy', ru: 'Багги', price: 800, max: 26, acc: 12, turn: 2.4, color: 0xff9f1c },
  car_sport: { en: 'Sport Coupe', ru: 'Спорткупе', price: 2500, max: 31, acc: 13, turn: 2.3, color: 0xe71d36 },
  car_muscle: { en: 'Muscle Car', ru: 'Маслкар', price: 4500, max: 34, acc: 14, turn: 2.0, color: 0x1f4b8f },
  car_f1: { en: 'Formula Racer', ru: 'Болид Формулы', price: 9000, max: 39, acc: 16, turn: 2.5, color: 0xd6457a },
  car_hyper: { en: 'Hypercar', ru: 'Гиперкар', price: 20000, max: 44, acc: 17, turn: 2.3, color: 0xffd34d },
};
const IDS = Object.keys(CARS), LAPS = 2, W = 16;
const BOT_NAMES = ['Turbo Timur', 'Speedy Aisha', 'Max Racer', 'Nitro Nurlan', 'Zara Zoom', 'Drift King', 'Lightning Lia', 'Rocket Ruslan'];
// the circuit (start/finish on the long straight in front of the grandstand)
const PTS = [[-20, -70], [40, -70], [90, -64], [116, -30], [112, 15], [80, 42], [40, 38], [10, 28], [-20, 50], [-60, 62], [-100, 48], [-115, 5], [-95, -50], [-60, -68]];
let A;

experience({
  id: 'race', title: 'Island Raceway', titleRu: 'Остров Гонок', icon: '🏁', spawn: [10, -42, Math.PI], sun: [32, 150],
  admin: [
    { a: 'startnow', icon: '🚦', en: 'Start a race now', ru: 'Начать гонку' },
    { a: 'boost', icon: '🚀', en: 'Turbo for everyone', ru: 'Турбо всем' },
    { a: 'giant', icon: '🦖', en: 'Giant cars', ru: 'Гигантские машины' },
    { a: 'rainbow', icon: '🌈', en: 'Rainbow road', ru: 'Радужная дорога' },
    { a: 'wave', icon: '🙌', en: 'Crowd goes wild', ru: 'Трибуны сходят с ума' },
    { a: 'bananarain', icon: '🍌', en: 'Banana rain on the track', ru: 'Банановый дождь' },
    { a: 'starall', icon: '⭐', en: 'Super star for everyone', ru: 'Звезда всем' },
    { a: 'itemall', icon: '🎁', en: 'Free item for everyone', ru: 'Предмет всем' },
    { a: 'jumpall', icon: '🦘', en: 'All cars jump', ru: 'Все машины прыгают' },
    { a: 'botspin', icon: '🌀', en: 'All bots spin out', ru: 'Все боты в занос' },
  ],
  build, frame, onAdmin, started, onJump: () => {},
});

// ---------- the track ----------
function trackData() {
  const curve = new THREE.CatmullRomCurve3(PTS.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const N = 600, pts = curve.getSpacedPoints(N).slice(0, N), s = [0];
  for (let i = 1; i <= N; i++) s.push(s[i - 1] + pts[i % N].distanceTo(pts[i - 1]));
  const len = s[N], tan = pts.map((p, i) => new THREE.Vector3().subVectors(pts[(i + 1) % N], pts[(i - 1 + N) % N]).normalize());
  return { curve, N, pts, s, len, tan };
}
// point on the track at distance d (wraps), with a sideways offset
function at(T, d, off = 0, out = new THREE.Vector3()) {
  d = ((d % T.len) + T.len) % T.len;
  let lo = 0, hi = T.N; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (T.s[m] <= d) lo = m; else hi = m; }
  const f = (d - T.s[lo]) / (T.s[lo + 1] - T.s[lo]), a = T.pts[lo], b = T.pts[(lo + 1) % T.N], tn = T.tan[lo];
  out.set(a.x + (b.x - a.x) * f - tn.z * off, 0, a.z + (b.z - a.z) * f + tn.x * off);
  return { p: out, h: Math.atan2(tn.x, tn.z), i: lo };
}

function build(app) {
  A = app; const w = app.world, S = w.scene, T = app.T = trackData();
  w.scene.fog.density = 0.0016;
  mesh(w, new THREE.CircleGeometry(500, 48).rotateX(-Math.PI / 2), surface('grass', [160, 160]), 0, -0.05, 0, { cast: false });
  // asphalt ribbon with red/white kerbs and a chequered start line
  const ribbon = (inner, outer, y, mat, colorFn) => {
    const pos = [], col = [], idx = [], uv = [];
    for (let i = 0; i <= T.N; i++) {
      const p = T.pts[i % T.N], tn = T.tan[i % T.N], nx = -tn.z, nz = tn.x;
      pos.push(p.x + nx * inner, y, p.z + nz * inner, p.x + nx * outer, y, p.z + nz * outer); uv.push(0, T.s[i] / W, (outer - inner) / W, T.s[i] / W);
      if (colorFn) { const c = colorFn(i); col.push(...c, ...c); }
      if (i < T.N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; S.add(m); return m;
  };
  app.roadMat = surface('asphalt', [1, 1], { side: THREE.DoubleSide });
  app.road = ribbon(-W / 2, W / 2, 0.03, app.roadMat);
  const kerb = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), rw = i => (Math.floor(i / 3) % 2 ? [0.9, 0.1, 0.1] : [0.95, 0.95, 0.95]);
  ribbon(W / 2, W / 2 + 1.2, 0.05, kerb, rw); ribbon(-W / 2 - 1.2, -W / 2, 0.05, kerb, rw);
  ribbon(-0.15, 0.15, 0.04, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), i => (Math.floor(i / 4) % 2 ? [0.23, 0.25, 0.27] : [0.95, 0.95, 0.9]));
  // walls: a low barrier on the outside of every corner
  const wall = new THREE.MeshStandardMaterial({ color: 0xdfe5ee, roughness: 0.6, side: THREE.DoubleSide });
  for (const sgn of [1, -1]) {
    const pos = [], idx = [], off = sgn * (W / 2 + 3.2);
    for (let i = 0; i <= T.N; i++) { const p = T.pts[i % T.N], tn = T.tan[i % T.N]; const x = p.x - tn.z * off, z = p.z + tn.x * off; pos.push(x, 0, z, x, 0.9, z); if (i < T.N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); S.add(new THREE.Mesh(g, wall));
  }
  const chk = canvasTexture(256, 64, (g, Wd, Hh) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 4; y++) { g.fillStyle = (x + y) % 2 ? '#111' : '#fff'; g.fillRect(x * 16, y * 16, 16, 16); } });
  const st = at(T, 0); const line = mesh(w, new THREE.PlaneGeometry(W, 3).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: chk }), st.p.x, 0.07, st.p.z, { ry: st.h + Math.PI / 2, cast: false }); void line;
  // start gantry with lights
  const gx = st.p.x, gz = st.p.z;
  for (const sz of [-1, 1]) mesh(w, new THREE.BoxGeometry(0.6, 8, 0.6), std(0x23324a), gx, 4, gz + sz * (W / 2 + 1.5));
  mesh(w, new THREE.BoxGeometry(1.2, 1.6, W + 3), std(0x23324a), gx, 8.2, gz);
  app.lights = [0, 1, 2, 3, 4].map(k => mesh(w, new THREE.SphereGeometry(0.45, 16, 10), std(0x330000, { emissive: 0x000000 }), gx - 0.7, 8.2, gz - 4 + k * 2, { cast: false }));
  const gb = labelSprite('🏁 ISLAND RACEWAY', 1.1, { bg: 'rgba(230,30,60,0.95)', weight: 800 }); gb.position.set(gx, 10, gz); S.add(gb);
  // ---------- the grandstand (you can walk up the rows) ----------
  const G = { x0: -70, x1: 50, z0: -82, rows: 12, dz: 1.3, dy: 0.55 };
  const conc = surface('concrete', [24, 1]), seatC = [0xe71d36, 0xffd34d, 0x1f4b8f];
  for (let r = 0; r < G.rows; r++) {
    const z = G.z0 - r * G.dz - G.dz / 2, y = (r + 1) * G.dy;
    mesh(w, new THREE.BoxGeometry(G.x1 - G.x0, y, G.dz), conc, (G.x0 + G.x1) / 2, y / 2, z);
    mesh(w, new THREE.BoxGeometry(G.x1 - G.x0 - 1, 0.25, 0.5), std(seatC[r % 3], { roughness: 0.5 }), (G.x0 + G.x1) / 2, y + 0.12, z + 0.25);
  }
  w.grounds.push((x, z) => (x > G.x0 && x < G.x1 && z < G.z0 && z > G.z0 - G.rows * G.dz ? Math.min(G.rows, Math.floor((G.z0 - z) / G.dz) + 1) * G.dy : null));
  // roof
  const roofY = G.rows * G.dy + 7;
  mesh(w, new THREE.BoxGeometry(G.x1 - G.x0 + 4, 0.5, G.rows * G.dz + 6), std(0xffffff, { roughness: 0.3 }), (G.x0 + G.x1) / 2, roofY, G.z0 - G.rows * G.dz / 2 + 1);
  for (let i = 0; i <= 6; i++) mesh(w, new THREE.CylinderGeometry(0.3, 0.3, roofY, 10), std(0x9aa3ad, { metalness: 0.7 }), G.x0 + i * (G.x1 - G.x0) / 6, roofY / 2, G.z0 - G.rows * G.dz - 1);
  // big screen over the grandstand
  app.scr = canvasTexture(1024, 512, () => {}); app.scrG = app.scr.image.getContext('2d');
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(24, 12), new THREE.MeshBasicMaterial({ map: app.scr })); scr.position.set(-10, roofY + 7.5, G.z0 - G.rows * G.dz); S.add(scr);
  mesh(w, new THREE.BoxGeometry(25, 13, 0.6), std(0x111111), -10, roofY + 7.5, G.z0 - G.rows * G.dz - 0.4);
  // fans fill the rows
  const seats = [];
  for (let r = 0; r < G.rows; r++) for (let x = G.x0 + 1; x < G.x1 - 1; x += 1.05) if (Math.random() < (w.hq ? 0.36 : 0.24)) seats.push({ x: x + Math.random() * 0.3, y: (r + 1) * G.dy + 0.25 - 0.43, z: G.z0 - r * G.dz - G.dz / 2 + 0.1, ry: 0, kind: 'fan', s: 0.9 });
  app.people = new People(w, { rings: [{ cx: -5, cz: -38, rx: 30, rz: 9, n: w.hq ? 40 : 26, stops: [{ x: -30, z: -30, face: 0 }, { x: 20, z: -45, face: 0 }] }], seats, far: w.hq ? 170 : 120 });
  // catch fence between the track and the grandstand, and floodlight towers round the circuit
  const wire = canvasTexture(128, 128, (g2, Wd) => { g2.clearRect(0, 0, Wd, Wd); g2.strokeStyle = 'rgba(200,205,212,0.9)'; g2.lineWidth = 3; for (let k = -Wd; k < Wd * 2; k += 32) { g2.beginPath(); g2.moveTo(k, 0); g2.lineTo(k + Wd, Wd); g2.stroke(); g2.beginPath(); g2.moveTo(k + Wd, 0); g2.lineTo(k, Wd); g2.stroke(); } });
  wire.wrapS = wire.wrapT = THREE.RepeatWrapping; wire.repeat.set(60, 2);
  const fz = -70 - W / 2 - 3.6; const fence = new THREE.Mesh(new THREE.PlaneGeometry(120, 3.2), new THREE.MeshStandardMaterial({ map: wire, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.4 })); fence.position.set(-5, 2.5, fz); S.add(fence);
  for (let x = -65; x <= 55; x += 6) mesh(w, new THREE.CylinderGeometry(0.06, 0.06, 4.2, 6), std(0x9aa3ad, { metalness: 0.8 }), x, 2.1, fz);
  for (const [x, z] of [[-130, -80], [130, -80], [-130, 70], [130, 70], [0, 85]]) { mesh(w, new THREE.CylinderGeometry(0.35, 0.5, 26, 10), std(0x9aa3ad, { metalness: 0.7 }), x, 13, z); const head = mesh(w, new THREE.BoxGeometry(5, 2.4, 0.6), std(0xeeeeee, { emissive: 0xffffff, emissiveIntensity: 0.9 }), x, 26.5, z); head.lookAt(0, 0, 0); }
  // flags and sponsor banners along the straight
  for (let i = 0; i < 10; i++) { const x = -60 + i * 12; const b = mesh(w, new THREE.PlaneGeometry(10, 1.2), new THREE.MeshBasicMaterial({ map: banner(i), side: THREE.DoubleSide }), x, 1.3, -70 - W / 2 - 3.35, { cast: false }); void b; }
  // ---------- Island Motors (car dealership) ----------
  const D = { x: -32, z: -32 };
  mesh(w, new THREE.BoxGeometry(22, 0.3, 14), std(0xf3efe8, { roughness: 0.2 }), D.x, 0.15, D.z, { cast: false });
  mesh(w, new THREE.BoxGeometry(24, 0.6, 16), std(0x111827), D.x, 6.3, D.z);
  for (const [x, z] of [[-11, -7], [11, -7], [-11, 7], [11, 7]]) mesh(w, new THREE.CylinderGeometry(0.25, 0.25, 6, 10), std(0xd4af37, { metalness: 1 }), D.x + x, 3.1, D.z + z);
  const ds = labelSprite('🚗 Island Motors', 1, { bg: 'rgba(17,24,39,0.95)', weight: 800 }); ds.position.set(D.x, 7.6, D.z); S.add(ds);
  app.showroom = [];
  IDS.forEach((id, k) => { const car = makeCar(id); car.position.set(D.x - 8 + (k % 3) * 8, 0.35, D.z - 3 + Math.floor(k / 3) * 6); car.rotation.y = 0.6; S.add(car); app.showroom.push(car); const l = labelSprite(`${L(CARS[id].en, CARS[id].ru)} · ${CARS[id].price ? money(CARS[id].price) : L('free', 'бесплатно')}`, 0.38); l.position.set(car.position.x, 2.4, car.position.z); S.add(l); });
  w.zone({ x: D.x, z: D.z + 8.5, r: 2.2, onEnter: () => dealer(app) });
  const dr = mesh(w, new THREE.RingGeometry(1.6, 2.1, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffd34d }), D.x, 0.32, D.z + 8.5, { cast: false }); void dr;
  const dl = labelSprite('🛒 ' + L('Buy a car (mPAY)', 'Купить машину (mPAY)'), 0.5, { bg: 'rgba(212,175,55,0.95)' }); dl.position.set(D.x, 2.6, D.z + 8.5); S.add(dl);
  // ---------- the start pad ----------
  const P = app.pad = { x: 18, z: -46 };
  mesh(w, new THREE.CylinderGeometry(2.4, 2.6, 0.3, 40), std(0x111111, { emissive: 0xe71d36, emissiveIntensity: 0.9 }), P.x, 0.15, P.z, { cast: false });
  app.padLab = labelSprite('🏁 ' + L('Join the next race', 'Участвовать в гонке'), 0.6, { bg: 'rgba(230,30,60,0.95)' }); app.padLab.position.set(P.x, 2.8, P.z); S.add(app.padLab);
  w.zone({ x: P.x, z: P.z, r: 2.4, onEnter: () => joinRace(app) });
  // trees round the outside
  for (let i = 0; i < 70; i++) { const a = Math.random() * Math.PI * 2, r = 150 + Math.random() * 120; tree(w, Math.cos(a) * r, Math.sin(a) * r); }
  // ---------- race state ----------
  app.cars = {}; app.race = { phase: 'lobby' }; app.joined = new Set(); app.fin = {}; app.joinRace = () => joinRace(app);
  app.mine = loadCar();
  app.net.onState('race', r => { if (r) setRace(app, r); });
  app.onEvent(ev => {
    if (ev.type === 'rjoin' && app.isHost()) { app.joined.add(JSON.stringify(ev.data)); }
    if (ev.type === 'rfin' && app.isHost() && app.race.phase === 'racing') { app.race.results = app.race.results || {}; if (!app.race.results[ev.data.pid]) { app.race.results[ev.data.pid] = ev.data.time; push(app); } }
  });
  fxSetup(app);
  // tyre walls on the outside of the corners and painted grid boxes
  const tyreGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.32, 14), tyres = new THREE.InstancedMesh(tyreGeo, std(0x15171c, { roughness: 0.9 }), 900), M4 = new THREE.Matrix4();
  let tn = 0;
  for (let i = 0; i < T.N; i += 3) { const a = T.tan[i], b = T.tan[(i + 6) % T.N], turn = a.x * b.z - a.z * b.x; if (Math.abs(turn) < 0.035) continue; const side = -Math.sign(turn), p = T.pts[i], off = side * (W / 2 + 4.1); for (let h = 0; h < 3 && tn < 900; h++) { M4.makeTranslation(p.x - a.z * off, 0.16 + h * 0.32, p.z + a.x * off); tyres.setMatrixAt(tn++, M4); } }
  tyres.count = tn; tyres.castShadow = true; S.add(tyres);
  const gbox = canvasTexture(128, 256, (g2, Wd, Hh) => { g2.clearRect(0, 0, Wd, Hh); g2.fillStyle = 'rgba(240,240,235,0.9)'; g2.fillRect(0, 0, Wd, 10); g2.fillRect(0, 0, 8, 70); g2.fillRect(Wd - 8, 0, 8, 70); });
  const gbm = new THREE.MeshBasicMaterial({ map: gbox, transparent: true, depthWrite: false });
  for (let k = 0; k < 8; k++) { const g = gridSpot(app, k); mesh(w, new THREE.PlaneGeometry(2.4, 4.6).rotateX(-Math.PI / 2), gbm, g.p.x, 0.045, g.p.z, { ry: g.h, cast: false }); }
  app.extraPos = () => (app.drive ? { car: app.drive.id, h: +app.drive.h.toFixed(2), cs: app.giantCars ? 2 : 1, rd: Math.round(app.drive.d) } : {});
  app.remoteD = {};
  trackFun(app);
  drawScreen(app);
}
function started(app) { ui.banner('🏁 ' + L('Island Raceway! Red pad = race, green pad = free drive. Hit ❔ boxes for items!', 'Остров Гонок! Красная площадка — гонка, зелёная — свободная езда. ❔ коробки дают предметы!'), 5000); }

// ---------- dealer ----------
async function dealer(app) {
  const inv = await app.net.inventory().catch(() => ({}));
  const owned = id => id === 'kart' || inv[id] > 0;
  const b = ui.modal('🚗 Island Motors', `<p class="muted">${L('Pick your car. Faster cars cost more. Pay with your mBank card (mPAY).', 'Выбери машину. Быстрее — дороже. Оплата картой mBank (mPAY).')}</p>
    <div class="menu-grid">${IDS.map(id => { const c = CARS[id]; return `<button class="tile${app.mine === id ? ' on' : ''}" data-c="${id}"><span>${L(c.en, c.ru)}</span><small>⚡ ${Math.round(c.max * 3.6)} km/h · ${owned(id) ? (app.mine === id ? '✅ ' + L('Driving', 'Выбрана') : L('Owned: tap to drive', 'Твоя: нажми')) : money(c.price)}</small></button>`; }).join('')}</div>`);
  b.querySelectorAll('[data-c]').forEach(x => x.onclick = () => {
    const id = x.dataset.c;
    if (owned(id)) { app.mine = id; try { localStorage.setItem('marbly_car', id); } catch (e) {} app.sfx('star'); dealer(app); return; }
    ui.close(); app.buy(id, () => { app.mine = id; try { localStorage.setItem('marbly_car', id); } catch (e) {} app.sfx('cheer'); confetti(80); ui.banner(`🔑 ${L('Your new', 'Твоя новая')} ${L(CARS[id].en, CARS[id].ru)}!`, 4000); });
  });
}
function loadCar() { try { const c = localStorage.getItem('marbly_car'); return CARS[c] ? c : 'kart'; } catch (e) { return 'kart'; } }

// ---------- race flow (the host decides; everyone simulates the same race) ----------
function push(app, r = app.race) { app.net.setState('race', r); }
function joinRace(app) {
  const r = app.race;
  if (r.phase === 'racing' || r.phase === 'countdown' && r.racers?.some(x => x.id === app.me.pid)) return ui.toast('⏳ ' + L('A race is on. You are in the next one!', 'Идёт гонка. Ты в следующей!'));
  app.emit('rjoin', { id: app.me.pid, name: app.me.name, car: app.mine });
  if (app.isHost()) app.joined.add(JSON.stringify({ id: app.me.pid, name: app.me.name, car: app.mine }));
  app.sfx('beep'); ui.banner('🏁 ' + L('You are on the grid for the next race!', 'Ты в следующей гонке!'), 3000);
}
function hostTick(app, now) {
  const r = app.race;
  if (r.phase === 'lobby' && (app.joined.size || app.forceStart)) {
    const racers = [...app.joined].map(s => JSON.parse(s)).slice(0, 8);
    let k = 0; while (racers.length < Math.max(6, racers.length) && k < 8) { const id = IDS[1 + Math.floor(Math.random() * 5)]; racers.push({ id: 'bot' + k, name: '🤖 ' + BOT_NAMES[k], car: id, bot: true, seed: Math.random() }); k++; }
    app.joined.clear(); app.forceStart = false;
    push(app, { phase: 'countdown', start: now + 9000, racers, results: {}, n: (r.n || 0) + 1 });
  } else if (r.phase === 'countdown' && now >= r.start) push(app, { ...r, phase: 'racing' });
  else if (r.phase === 'racing') {
    const players = r.racers.filter(x => !x.bot), t = (now - r.start) / 1000, done = players.every(x => r.results[x.id]);
    const firstFin = Math.min(...Object.values(r.results).concat([Infinity]));
    if ((done && t > botTime(app, r.racers.find(x => x.bot) || r.racers[0]) * 0.5) || t > 240 || (firstFin < Infinity && t > firstFin + 45)) push(app, { ...r, phase: 'results', phaseEnds: now + 14000 });
  } else if (r.phase === 'results' && now >= r.phaseEnds) push(app, { phase: 'lobby', n: r.n });
  if ((app._re = (app._re || 0) + 1) % 120 === 0 && r.phase !== 'lobby') push(app);
}
function setRace(app, r) {
  const was = app.race.phase; app.race = r;
  const mine = r.racers && r.racers.find(x => x.id === app.me.pid);
  if (r.phase === 'countdown' && was !== 'countdown') { ui.banner('🚦 ' + L('Race starting! Drivers to the grid!', 'Гонка начинается! Пилоты на старт!'), 3000); app.sfx('drumroll'); if (mine) { if (app.drive) endDrive(app); toGrid(app, mine, r); } }
  if (r.phase === 'racing' && was !== 'racing') { app.sfx('go'); ui.banner('🟢 GO! GO! GO!', 1800); app.people.hype = 1; setTimeout(() => (app.people.hype = 0), 4000); app.people.wave = true; }
  if (r.phase === 'results' && was !== 'results') results(app, r);
  if (r.phase === 'lobby' && was !== 'lobby') { for (const id in app.bananas) app.world.scene.remove(app.bananas[id].m); app.bananas = {}; app.people.wave = false; if (app.drive && !app.drive.free) endDrive(app); }
}
// bots drive a smooth, fair line: fast cars are faster, with a little randomness
function botSpeed(b) { return CARS[b.car].max * (0.8 + b.seed * 0.12); }
function botDist(b, t) { if (t <= 0) return 0; const v = botSpeed(b), te = t < 3 ? t * t / 6 : t - 1.5; return v * (0.94 * te - 0.06 / 0.7 * (Math.cos(0.7 * te + b.seed * 6) - Math.cos(b.seed * 6))); }
// distance from a point to the line a car drove this frame (so a fast car can't skip over a banana)
function segDist(x, z, ax, az, bx, bz) { const dx = bx - ax, dz = bz - az, l = dx * dx + dz * dz, k = l ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l)) : 0; return Math.hypot(x - ax - dx * k, z - az - dz * k); }
// every hit (banana, star bump) stops a bot for a moment: the race clock it has really driven
const SPIN = 1.2;
function botT(r, b, t) { const hs = (r.hits && r.hits[b.id]) || []; let lost = 0; for (const h of hs) lost += Math.min(SPIN, Math.max(0, t - h)); return t - lost; }
function botHit(app, id, t) {
  const r = app.race; if (r.phase !== 'racing') return; r.hits = r.hits || {}; const hs = r.hits[id] = r.hits[id] || [];
  if (hs.length && t - hs[hs.length - 1] < SPIN + 0.4) return; hs.push(+t.toFixed(2)); push(app);
}
function botTime(app, b) { let lo = 0, hi = 400; const goal = LAPS * app.T.len; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (botDist(b, m) < goal) lo = m; else hi = m; } return hi; }
function gridSpot(app, slot) { return at(app.T, -6 - Math.floor(slot / 2) * 8, slot % 2 ? 3.5 : -3.5); }

// ---------- driving ----------
function toGrid(app, me, r) {
  const slot = r.racers.indexOf(me), g = gridSpot(app, slot);
  startDrive(app, me.car, g.p.x, g.p.z, g.h, -6 - Math.floor(slot / 2) * 8, false);
}
// free drive: take your car out on the track any time (not in a race): coins, ? boxes and the ramp
function freeDrive(app) {
  if (app.drive) return;
  const r = app.race, mine = r.racers && r.racers.some(x => x.id === app.me.pid);
  if (mine && (r.phase === 'countdown' || r.phase === 'racing')) return;
  const d = 30 + Math.random() * 20, s = at(app.T, d, (Math.random() - 0.5) * 8);
  startDrive(app, app.mine, s.p.x, s.p.z, s.h, d, true);
  ui.banner('🚗 ' + L('Free drive! Grab coins, hit ❔ boxes and jump the ramp. X = get out.', 'Свободная езда! Собирай монеты, ❔ коробки и прыгай с трамплина. X = выйти.'), 4500);
}
function startDrive(app, id, x, z, h, d, free) {
  const w = app.world, car = makeCar(id); car.rotation.order = 'YXZ'; w.scene.add(car);
  // a turbo flame and a star glow that switch on when you have them
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.6, 12).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x66c8ff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  flame.position.set(0, 0.55, -3); flame.visible = false; car.add(flame);
  const aura = new THREE.Mesh(new THREE.SphereGeometry(2.6, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffd34d, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })); aura.scale.set(0.9, 0.55, 1.2); aura.position.y = 0.7; aura.visible = false; car.add(aura);
  app.drive = { id, car, flame, aura, x, z, h, v: 0, d, lapD: d, steer: 0, done: false, free, y: 0, vy: 0, item: null, uses: 0, charge: 0 };
  w.me.play('sit'); app.emoteSig = 'sit:' + Date.now();
  w.carrier = { update: (dt, p, meAv) => { drive(app, dt, p, meAv); return false; }, onCancel: () => {} };
  w.cameraOverride = (cam, dt) => { const D = app.drive; if (!D) return; const back = 9 * (app.giantCars ? 1.8 : 1); const tx = D.x - Math.sin(D.h) * back, tz = D.z - Math.cos(D.h) * back; cam.position.lerp(new THREE.Vector3(tx, 4.2 * (app.giantCars ? 1.6 : 1) + D.y * 0.6, tz), Math.min(1, dt * 5)); cam.lookAt(D.x + Math.sin(D.h) * 6, 1.2 + D.y * 0.5, D.z + Math.cos(D.h) * 6); };
  itemBtn(app); app.exitBtn.classList.toggle('hidden', !free);
}
function drive(app, dt, p, meAv) {
  const D = app.drive, w = app.world, r = app.race, C = CARS[D.id], k = w.keys, now = performance.now(), T = app.T;
  const racing = !D.free && r.phase === 'racing' && !D.done, go = racing || D.free, spun = D.spinUntil > now;
  const thr = go && !spun ? ((k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + w.joy.y) : 0, st = spun ? 0 : (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0) - w.joy.x;
  const near = at(T, D.lapD), off = Math.hypot(D.x - near.p.x, D.z - near.p.z), onRoad = off < W / 2 + 1.2;
  const star = D.starUntil > now, boost = D.boostUntil > now || app.boostUntil > now;
  const max = C.max * (boost ? 1.45 : 1) * (star ? 1.25 : 1) * (onRoad || star ? 1 : 0.45);
  D.v += (thr > 0 ? C.acc * thr : thr < 0 ? 18 * thr : 0) * dt; D.v -= D.v * (onRoad || star ? 0.35 : 1.6) * dt;
  if (boost && go && D.v > -1) D.v += C.acc * 1.6 * dt; // turbo shoves you forward even off the throttle
  if (spun) D.v *= Math.max(0, 1 - dt * 3);
  D.v = Math.max(-8, Math.min(max, D.v));
  D.steer += (Math.max(-1, Math.min(1, st)) - D.steer) * Math.min(1, dt * 8);
  D.h += D.steer * C.turn * Math.min(1, Math.abs(D.v) / 10) * Math.sign(D.v || 1) * dt * (D.air ? 0.4 : 1);
  D.x += Math.sin(D.h) * D.v * dt; D.z += Math.cos(D.h) * D.v * dt;
  // walls: bounce back onto the track
  if (off > W / 2 + 2.6) { const nx = (near.p.x - D.x) / off, nz = (near.p.z - D.z) / off; D.x += nx * (off - W / 2 - 2.6); D.z += nz * (off - W / 2 - 2.6); D.v *= 0.5; if (!D.bonk || now - D.bonk > 600) { D.bonk = now; app.sfx('bonk'); } }
  // progress round the track: find the nearest point ahead of where we were
  let best = D.lapD, bestE = 1e9;
  for (let s = -12; s <= 24; s += 1.5) { const q = at(T, D.lapD + s).p, e = (q.x - D.x) ** 2 + (q.z - D.z) ** 2; if (e < bestE) { bestE = e; best = D.lapD + s; } }
  const before = D.d; D.d += best - D.lapD; D.lapD = best;
  if (go && Math.floor(D.d / T.len) > Math.floor(before / T.len) && D.d > 0) {
    // lap times: the first time over the line starts the clock, every next crossing is a lap
    const nowT = Date.now(); if (D.lapStart) { const lt = (nowT - D.lapStart) / 1000, bl = +(localStorage.getItem('marbly_bestlap') || 0); if (!bl || lt < bl) { try { localStorage.setItem('marbly_bestlap', lt.toFixed(2)); } catch (e) {} ui.toast(`⏱ ${L('New best lap', 'Лучший круг')}: ${lt.toFixed(2)}s 🏆`); app.sfx('star'); } else ui.toast(`⏱ ${L('Lap', 'Круг')}: ${lt.toFixed(2)}s`); } D.lapStart = nowT;
    const lap = Math.floor(D.d / T.len) + 1; if (racing && lap <= LAPS) { ui.banner(lap === LAPS ? '🔔 ' + L('Final lap!', 'Последний круг!') : `🏁 ${L('Lap', 'Круг')} ${lap}/${LAPS}`, 1800); app.sfx('ding'); } }
  if (racing && D.d >= LAPS * T.len) { D.done = true; const time = (Date.now() - r.start) / 1000; app.emit('rfin', { pid: app.me.pid, time }); if (app.isHost()) { r.results[app.me.pid] = time; push(app); } ui.banner(`🏁 ${L('Finished!', 'Финиш!')} ${time.toFixed(1)}s`, 3000); app.sfx('cheer'); }
  // bumping into other cars pushes you apart and costs speed (a star knocks them aside instead)
  for (const [ck, c] of Object.entries(app.cars)) { if (star && racing && ck.startsWith('bot')) { const dd0 = Math.hypot(D.x - c.position.x, D.z - c.position.z); if (dd0 < 2.6) { const rt = (Date.now() - r.start) / 1000; if (app.isHost()) botHit(app, ck, rt); else app.emit('bothit', { id: ck, t: rt }); } } const dx = D.x - c.position.x, dz = D.z - c.position.z, dd = Math.hypot(dx, dz), min = 2.3 * (app.giantCars ? 2 : 1); if (dd < min && dd > 0.01 && !D.air) { D.x += dx / dd * (min - dd); D.z += dz / dd * (min - dd); if (!star) D.v *= 0.82; if (!D.hit || now - D.hit > 500) { D.hit = now; app.sfx(star ? 'pop' : 'bonk'); } } }
  if (go) trackHits(app, D, now, dt);
  // drifting: hold a hard turn at speed to charge sparks (blue, then orange); straighten up for a mini-turbo
  const slide = Math.abs(D.steer) * Math.abs(D.v) / C.max, braking = thr < 0 && D.v > 6;
  if (go && !D.air && slide > 0.5 && D.v > 12) {
    D.charge += dt; const col = D.charge > 1.4 ? 0xff8a1c : D.charge > 0.6 ? 0x4aa3ff : 0;
    if (col && Math.random() < 0.7) for (const s of [0.9, -0.9]) spark(app, D.x - Math.sin(D.h) * 1.9 + Math.cos(D.h) * s, D.z - Math.cos(D.h) * 1.9 - Math.sin(D.h) * s, col);
  } else if (D.charge > 0 && slide < 0.35) {
    if (D.charge > 1.4) { D.boostUntil = now + 1100; ui.toast('🔥 ' + L('Super mini-turbo!', 'Супер мини-турбо!')); app.sfx('whoosh'); }
    else if (D.charge > 0.6) { D.boostUntil = now + 550; app.sfx('zip'); }
    D.charge = 0;
  } else if (slide < 0.35) D.charge = 0;
  // in the air off the ramp: press jump for a flip, land it for a turbo
  if (D.air) {
    D.y += D.vy * dt; D.vy -= 20 * dt; D.airT += dt;
    if ((k.Space || w.joyJump) && D.flip === undefined) { D.flip = 0; app.sfx('whoosh'); }
    if (D.flip !== undefined && D.flip < 1) D.flip = Math.min(1, D.flip + dt * 1.7);
    if (D.y <= 0) {
      D.y = 0; D.air = false; app.sfx('hit'); puff(app, D.x, D.z, 0xdddddd); puff(app, D.x, D.z, 0xdddddd);
      if (D.flip === 1) { D.boostUntil = now + 1600; ui.banner('🤸 ' + L('FLIP! Turbo!', 'САЛЬТО! Турбо!'), 1600); app.sfx('cheer'); app.people.hype = 1; setTimeout(() => (app.people.hype = 0), 2000); }
      else if (D.flip !== undefined) { D.spinUntil = now + 900; D.v *= 0.4; ui.toast('😵 ' + L('Crash landing!', 'Неудачное приземление!')); }
      else if (D.airT > 0.5) { D.boostUntil = now + 700; ui.toast('🛫 ' + L('Big air!', 'Полёт!')); }
      D.flip = undefined;
    }
  }
  w.joyJump = false;
  if ((slide > 0.55 || braking) && go && !D.air) { skid(app, D, 0.95); skid(app, D, -0.95); if (Math.random() < 0.5) puff(app, D.x - Math.sin(D.h) * 1.8, D.z - Math.cos(D.h) * 1.8, 0xdddddd); }
  if (!onRoad && !D.air && Math.abs(D.v) > 4 && Math.random() < 0.6) puff(app, D.x - Math.sin(D.h) * 1.8, D.z - Math.cos(D.h) * 1.8, 0xb59a6a);
  const cam = app.world.camera, fov = 56 + Math.min(1, Math.abs(D.v) / 40) * 16 + (boost ? 10 : 0); if (Math.abs(cam.fov - fov) > 0.2) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
  const sc = app.giantCars ? 2 : 1, body = D.car.userData.body;
  // the body leans out of corners and dips when braking, like a real car
  const roll = -D.steer * Math.min(1, Math.abs(D.v) / C.max) * 0.09, pitch = (D.v - (D.pv ?? D.v)) / Math.max(dt, 0.001) * -0.004; D.pv = D.v;
  body.rotation.z += (roll - body.rotation.z) * Math.min(1, dt * 6); body.rotation.x += (Math.max(-0.05, Math.min(0.05, pitch)) - body.rotation.x) * Math.min(1, dt * 6);
  D.car.userData.front.forEach(f => (f.rotation.y = D.steer * 0.45));
  if (D.car.userData.tail) D.car.userData.tail.emissiveIntensity = thr < 0 ? 3 : 0.6;
  D.flame.visible = boost; if (boost) { D.flame.scale.set(1, 1, 0.8 + Math.random() * 0.6); D.flame.material.color.setHex(star ? 0xffb020 : 0x66c8ff); if (Math.random() < 0.4) puff(app, D.x - Math.sin(D.h) * 2.6, D.z - Math.cos(D.h) * 2.6, 0x9fd8ff); }
  D.aura.visible = star; if (star) { D.aura.material.color.setHSL((now / 300) % 1, 1, 0.6); D.aura.material.opacity = 0.18 + Math.sin(now / 60) * 0.06; }
  boostFx(app, boost, star);
  const spinA = spun ? (D.spinUntil - now) / 1000 * Math.PI * 4 : 0;
  D.car.position.set(D.x, 0.05 + D.y, D.z); D.car.rotation.y = D.h + spinA; D.car.rotation.x = D.flip !== undefined ? -D.flip * Math.PI * 2 : D.air ? -Math.max(-0.25, Math.min(0.25, D.vy * 0.03)) : 0; D.car.scale.setScalar(sc); spin(D.car, D.v, dt);
  engine(app, Math.abs(D.v) / C.max * (boost ? 1.2 : 1), thr);
  p.set(D.x - Math.sin(D.h) * 0.2 * sc, 0.25 * sc + D.y, D.z - Math.cos(D.h) * 0.2 * sc); meAv.group.rotation.y = D.h + spinA; meAv.animate(0, dt, false);
}
function endDrive(app) {
  const D = app.drive, w = app.world; if (!D) return; engine(app, 0, 0, true); w.camera.fov = 56; w.camera.updateProjectionMatrix();
  w.scene.remove(D.car); app.drive = null; w.carrier = null; w.cameraOverride = null; w.me.emote = null;
  app.itemBtn.classList.add('hidden'); app.exitBtn.classList.add('hidden'); boostFx(app, false, false);
  w.teleport(app.pad.x - 4, app.pad.z, Math.PI);
}

// ---------- fun on the track: boost pads, ❔ item boxes, bananas, coins and a jump ramp ----------
const ITEMS = {
  turbo: { icon: '🚀', en: 'Turbo', ru: 'Турбо' },
  triple: { icon: '🍄', en: 'Triple turbo', ru: 'Тройное турбо' },
  star: { icon: '⭐', en: 'Super star', ru: 'Суперзвезда' },
  banana: { icon: '🍌', en: 'Banana', ru: 'Банан' },
  coins: { icon: '💰', en: 'Coin bag', ru: 'Мешок монет' },
};
function trackFun(app) {
  const w = app.world, S = w.scene, T = app.T;
  app.coins = new Coins(app, { respawn: 25, reach: 1.7 });
  // boost pads: glowing arrows on the road
  const chev = canvasTexture(128, 256, (g, Wd, Hh) => { g.clearRect(0, 0, Wd, Hh); g.strokeStyle = '#7fe7ff'; g.lineWidth = 16; g.lineCap = 'round'; for (let k = 0; k < 3; k++) { const y = 40 + k * 80; g.beginPath(); g.moveTo(16, y + 50); g.lineTo(64, y); g.lineTo(112, y + 50); g.stroke(); } });
  chev.wrapT = THREE.RepeatWrapping; app.chev = chev;
  const padM = new THREE.MeshBasicMaterial({ map: chev, transparent: true, color: 0xffffff, depthWrite: false, blending: THREE.AdditiveBlending });
  const baseM = new THREE.MeshStandardMaterial({ color: 0x0b2a4a, emissive: 0x1a6aff, emissiveIntensity: 0.8, roughness: 0.3 });
  app.pads = [0.1, 0.27, 0.45, 0.63, 0.8, 0.94].map((f, i) => {
    const d = f * T.len, off = i % 2 ? 3.5 : -3.5, q = at(T, d, off);
    mesh(w, new THREE.PlaneGeometry(3.4, 5.2).rotateX(-Math.PI / 2), baseM, q.p.x, 0.05, q.p.z, { ry: q.h, cast: false });
    mesh(w, new THREE.PlaneGeometry(3, 4.8).rotateX(-Math.PI / 2), padM, q.p.x, 0.07, q.p.z, { ry: q.h, cast: false });
    return { x: q.p.x, z: q.p.z, t: 0 };
  });
  // item boxes: rows of spinning rainbow ❔ cubes
  const qTex = canvasTexture(128, 128, (g, Wd) => { g.fillStyle = '#fff'; g.fillRect(0, 0, Wd, Wd); g.fillStyle = '#111'; g.font = '900 96px Manrope, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', Wd / 2, Wd / 2 + 6); });
  app.boxMat = new THREE.MeshStandardMaterial({ map: qTex, color: 0xffffff, emissive: 0xff66cc, emissiveIntensity: 0.45, transparent: true, opacity: 0.88, roughness: 0.15, metalness: 0.2 });
  const boxGeo = new RoundedBox(1.3, 1.3, 1.3, 3, 0.18);
  app.boxes = [];
  for (const f of [0.18, 0.52, 0.86]) for (const off of [-5.4, -1.8, 1.8, 5.4]) { const q = at(T, f * T.len, off), m = new THREE.Mesh(boxGeo, app.boxMat); m.position.set(q.p.x, 1.1, q.p.z); m.castShadow = true; S.add(m); app.boxes.push({ m, x: q.p.x, z: q.p.z, back: 0 }); }
  // coins along the racing line
  for (let k = 0; k < 14; k++) { const d0 = (0.04 + k * 0.069) * T.len, off = Math.sin(k * 2.3) * 4.5; for (let j = 0; j < 6; j++) { const q = at(T, d0 + j * 3.2, off); app.coins.add(q.p.x, 1, q.p.z, 10); } }
  // the jump ramp: on the straightest bit of the back half, covering the right half of the road
  let bestD = 0, bestK = 9;
  for (let d = 0.3 * T.len; d < 0.78 * T.len; d += 2) { const a = at(T, d - 18).h, b = at(T, d + 22).h, kk = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))); if (kk < bestK) { bestK = kk; bestD = d; } }
  const R = app.ramp = { d: bestD, off: W / 4, len: 7, hgt: 1.3, half: W / 4 - 0.3 };
  const shape = new THREE.Shape([new THREE.Vector2(0, 0), new THREE.Vector2(R.len, 0), new THREE.Vector2(R.len, R.hgt)]);
  const rg = new THREE.ExtrudeGeometry(shape, { depth: R.half * 2, bevelEnabled: false }); rg.translate(-R.len / 2, 0, -R.half);
  const stripes = canvasTexture(256, 256, (g, Wd) => { for (let k = -4; k < 8; k++) { g.fillStyle = k % 2 ? '#ffc21a' : '#1b1b1b'; g.beginPath(); g.moveTo(k * 40, 0); g.lineTo(k * 40 + 40, 0); g.lineTo(k * 40 + 40 + Wd, Wd); g.lineTo(k * 40 + Wd, Wd); g.fill(); } });
  stripes.wrapS = stripes.wrapT = THREE.RepeatWrapping; stripes.repeat.set(0.25, 0.25);
  const q = at(T, R.d, R.off), ramp = mesh(w, rg, std(0xffffff, { map: stripes, roughness: 0.5 }), q.p.x, 0.04, q.p.z, { ry: q.h - Math.PI / 2 });
  void ramp; const rl = labelSprite('🛫 ' + L('JUMP! (Space = flip)', 'ПРЫЖОК! (Пробел = сальто)'), 0.5, { bg: 'rgba(255,194,26,0.95)', color: '#111' }); const ql = at(T, R.d - 14, R.off); rl.position.set(ql.p.x, 3, ql.p.z); S.add(rl);
  // bananas other drivers dropped
  app.bananas = {};
  app.onEvent(ev => { if (ev.type === 'bothit' && app.isHost()) botHit(app, ev.data.id, ev.data.t); if (ev.type === 'banana') addBanana(app, ev.data); if (ev.type === 'bgone' && app.bananas[ev.data.id]) { S.remove(app.bananas[ev.data.id].m); delete app.bananas[ev.data.id]; } });
  // buttons: use your item, and get out of the car in free drive
  app.itemBtn = document.createElement('button'); app.itemBtn.className = 'x-act hidden'; app.itemBtn.onclick = () => useItem(app); document.body.appendChild(app.itemBtn);
  app.exitBtn = document.createElement('button'); app.exitBtn.className = 'x-act x-act2 hidden'; app.exitBtn.innerHTML = '🚪<small>X</small>'; app.exitBtn.onclick = () => { if (app.drive && app.drive.free) endDrive(app); }; document.body.appendChild(app.exitBtn);
  addEventListener('keydown', e => { if (/INPUT|TEXTAREA/.test(e.target.tagName)) return; if (e.code === 'KeyE') useItem(app); if (e.code === 'KeyX' && app.drive && app.drive.free) endDrive(app); });
  app.boostEl = document.createElement('div'); app.boostEl.className = 'r-boost'; document.body.appendChild(app.boostEl);
  // the free-drive pad
  const F = { x: 4, z: -46 };
  mesh(w, new THREE.CylinderGeometry(2.4, 2.6, 0.3, 40), std(0x111111, { emissive: 0x22a06b, emissiveIntensity: 0.9 }), F.x, 0.15, F.z, { cast: false });
  const fl = labelSprite('🚗 ' + L('Free drive', 'Свободная езда'), 0.6, { bg: 'rgba(34,160,107,0.95)' }); fl.position.set(F.x, 2.8, F.z); S.add(fl);
  w.zone({ x: F.x, z: F.z, r: 2.4, onEnter: () => freeDrive(app) });
  app.freeDrive = () => freeDrive(app);
}
function addBanana(app, b) {
  if (app.bananas[b.id]) return;
  const g = new THREE.Group(), m = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.14, 8, 16, Math.PI * 1.1), std(0xffd21f, { roughness: 0.5 }));
  m.rotation.set(Math.PI / 2, 0, 0.3); m.position.y = 0.25; g.add(m); g.position.set(b.x, 0, b.z); app.world.scene.add(g);
  app.bananas[b.id] = { m: g, x: b.x, z: b.z, owner: b.owner, t: performance.now() };
}
function trackHits(app, D, now, dt) {
  const T = app.T;
  for (const p of app.pads) if (Math.hypot(D.x - p.x, D.z - p.z) < 2.6 && now - p.t > 1000 && !D.air) { p.t = now; D.boostUntil = Math.max(D.boostUntil || 0, now + 1300); app.sfx('whoosh'); }
  for (const b of app.boxes) if (!b.back && Math.hypot(D.x - b.x, D.z - b.z) < 1.9) { b.back = now + 3000; b.m.visible = false; app.sfx('pop'); rollItem(app); }
  for (const id in app.bananas) { const b = app.bananas[id]; if (Math.hypot(D.x - b.x, D.z - b.z) < 1.5 && !D.air && !(b.owner === app.me.pid && now - b.t < 2000)) {
    app.world.scene.remove(b.m); delete app.bananas[id]; app.emit('bgone', { id });
    if (D.starUntil > now) { app.sfx('pop'); continue; }
    D.spinUntil = now + 1100; D.v *= 0.35; app.sfx('bonk'); ui.toast('🍌 ' + L('Slipped on a banana!', 'Поскользнулся на банане!')); } }
  // the ramp: ride up the slope, fly off the end
  const R = app.ramp, lp = ((D.lapD % T.len) + T.len) % T.len, s = lp - (R.d - R.len / 2);
  const q = at(T, D.lapD, 0), side = (D.x - q.p.x) * -Math.cos(q.h) + (D.z - q.p.z) * Math.sin(q.h);
  const onRamp = s >= 0 && s <= R.len && Math.abs(side - R.off) < R.half && D.v > 0;
  if (!D.air) {
    if (onRamp) { D.y = s / R.len * R.hgt; D.onRamp = true; }
    else if (D.onRamp) { D.onRamp = false; if (s > R.len - 1 && D.v > 6) { D.air = true; D.airT = 0; D.vy = D.v * R.hgt / R.len + 2.5; D.y = R.hgt; app.sfx('whoosh'); } else D.y = 0; }
  }
  void dt;
}
function rollItem(app) {
  const D = app.drive; if (!D || D.item || D.rolling) return;
  D.rolling = true; app.itemBtn.classList.add('roll');
  const keys = Object.keys(ITEMS); let n = 0;
  const tick = setInterval(() => { app.itemBtn.innerHTML = ITEMS[keys[n++ % keys.length]].icon; app.sfx('click'); }, 80);
  setTimeout(() => {
    clearInterval(tick); if (app.drive !== D) return;
    // drivers at the back get the best items
    let f = 0.5; if (!D.free && app.race.racers) { const o = standings(app, app.race), i = o.findIndex(x => x.id === app.me.pid); f = o.length > 1 ? i / (o.length - 1) : 0; }
    const bag = f > 0.6 ? ['star', 'triple', 'triple', 'turbo', 'star', 'coins'] : f > 0.25 ? ['turbo', 'triple', 'banana', 'coins', 'star', 'turbo'] : ['banana', 'banana', 'coins', 'turbo', 'coins', 'banana'];
    D.item = bag[Math.floor(Math.random() * bag.length)]; D.uses = D.item === 'triple' ? 3 : 1; D.rolling = false;
    app.itemBtn.classList.remove('roll'); itemBtn(app); app.sfx('star');
    ui.toast(`${ITEMS[D.item].icon} ${L(ITEMS[D.item].en, ITEMS[D.item].ru)}! ${L('Press E or tap the button', 'Жми E или кнопку')}`);
  }, 900);
}
function itemBtn(app) {
  const D = app.drive, b = app.itemBtn; if (!D) return;
  b.classList.remove('hidden'); b.classList.toggle('ready', !!D.item);
  b.innerHTML = D.item ? `${ITEMS[D.item].icon}<small>E${D.uses > 1 ? ' ×' + D.uses : ''}</small>` : '<span style="opacity:.35">❔</span>';
}
function useItem(app) {
  const D = app.drive, now = performance.now(); if (!D || !D.item) return;
  if (!D.free && app.race.phase !== 'racing') return;
  const it = D.item;
  if (it === 'turbo' || it === 'triple') { D.boostUntil = now + (it === 'turbo' ? 1800 : 1200); app.sfx('whoosh'); }
  if (it === 'star') { D.starUntil = now + 7000; D.boostUntil = now + 1500; app.sfx('champions'); ui.banner('⭐ ' + L('SUPER STAR! Nothing can stop you!', 'СУПЕРЗВЕЗДА! Тебя не остановить!'), 2000); }
  if (it === 'banana') { const id = app.me.pid + ':' + Date.now(), b = { id, x: D.x - Math.sin(D.h) * 3, z: D.z - Math.cos(D.h) * 3, owner: app.me.pid }; addBanana(app, b); app.emit('banana', b); app.sfx('place'); }
  if (it === 'coins') { app.coins.bonus(100); app.sfx('paid'); ui.toast('💰 +' + money(100)); }
  if (--D.uses <= 0) D.item = null;
  itemBtn(app);
}
// bots fly off the ramp too
function rampY(app, d, lane) {
  const R = app.ramp; if (!R || Math.abs(lane - R.off) > R.half) return 0;
  const s = (((d % app.T.len) + app.T.len) % app.T.len) - (R.d - R.len / 2), J = 16;
  if (s >= 0 && s <= R.len) return s / R.len * R.hgt;
  if (s > R.len && s < R.len + J) { const x = (s - R.len) / J; return R.hgt * (1 - x) + 8 * x * (1 - x); }
  return 0;
}
function funTick(app, dt, tt) {
  const now = performance.now();
  app.coins.update(dt, tt);
  app.chev.offset.y = (tt * 1.5) % 1;
  app.boxMat.emissive.setHSL((tt * 0.25) % 1, 0.9, 0.5);
  for (const b of app.boxes) {
    if (b.back && now > b.back) { b.back = 0; b.m.visible = true; b.m.scale.setScalar(0.05); }
    if (!b.m.visible) continue;
    b.m.rotation.y += dt * 1.2; b.m.rotation.x += dt * 0.7; b.m.position.y = 1.1 + Math.sin(tt * 2 + b.x) * 0.15; if (b.m.scale.x < 1) b.m.scale.setScalar(Math.min(1, b.m.scale.x + dt * 2));
    for (const k in app.cars) { const c = app.cars[k]; if (Math.abs(c.position.x - b.x) < 1.6 && Math.abs(c.position.z - b.z) < 1.6) { b.back = now + 3000; b.m.visible = false; break; } }
  }
}
function boostFx(app, boost, star) { const e = app.boostEl; if (!e) return; e.classList.toggle('on', boost || star); e.classList.toggle('star', star); }
function spark(app, x, z, color) { const p = app.puffs[app.puffN++ % app.puffs.length]; p.position.set(x, 0.25, z); p.scale.setScalar(0.12); p.material.color.setHex(color); p.material.opacity = 0.9; p.visible = true; p.userData.spark = 0.4; }
function results(app, r) {
  const order = standings(app, r);
  const mine = order.findIndex(x => x.id === app.me.pid);
  ui.banner(`🏆 ${order[0].name} ${L('wins!', 'побеждает!')}`, 5000); app.world.fireworks(10); app.people.hype = 1; setTimeout(() => (app.people.hype = 0), 6000);
  if (mine >= 0) {
    const prize = [500, 300, 100][mine] || 0;
    if (prize && r.results[app.me.pid]) app.net.earn(prize).then(bal => { app.setMoney(bal); ui.toast(`🏆 ${L('Prize', 'Приз')} +${money(prize)}`); app.sfx('paid'); }).catch(() => {});
    if (mine === 0) confetti();
  }
}
// everyone's place: finished players by time, bots by their finish time, the rest by distance
function standings(app, r) {
  const t = Math.max(0, (Date.now() - r.start) / 1000);
  return r.racers.map(x => {
    if (x.bot) { const n = ((r.hits && r.hits[x.id]) || []).length, bt = botTime(app, x) + n * SPIN; return { ...x, done: bt <= t, time: bt, dist: botDist(x, botT(r, x, t)) }; }
    const ft = r.results && r.results[x.id]; const d = x.id === app.me.pid && app.drive ? app.drive.d : (app.remoteD && app.remoteD[x.id]) || 0;
    return { ...x, done: !!ft, time: ft || 1e9, dist: ft ? 1e9 : d };
  }).sort((a, b) => (a.done && b.done ? a.time - b.time : a.done ? -1 : b.done ? 1 : b.dist - a.dist));
}

// ---------- every frame ----------
function frame(dt, tt, app) {
  if (!app.T) return;
  const r = app.race, now = Date.now(), w = app.world;
  if (app.isHost()) hostTick(app, now);
  // start lights: five reds, then all go out
  const toGo = r.phase === 'countdown' ? (r.start - now) / 1000 : -1;
  app.lights.forEach((l, k) => { const on = toGo > 0 && toGo < 5 && 5 - toGo > k; l.material.emissive.setHex(on ? 0xff1a1a : r.phase === 'racing' && (now - r.start) < 2000 ? 0x22ff55 : 0x000000); l.material.emissiveIntensity = 2.5; });
  if (toGo > 0 && toGo < 5) { const s = Math.ceil(toGo); if (s !== app._cd) { app._cd = s; app.sfx('countdown'); ui.hud(`🚦 ${s}`); } } else if (app._cd) { app._cd = 0; ui.hud(''); }
  // bot cars
  const racers = (r.phase === 'countdown' || r.phase === 'racing' || r.phase === 'results') ? r.racers : [];
  const t = r.phase === 'countdown' ? 0 : (now - r.start) / 1000;
  const live = new Set();
  for (const b of racers) {
    if (!b.bot) continue; live.add(b.id);
    let c = app.cars[b.id]; if (!c) { c = app.cars[b.id] = makeCar(b.car, true); w.scene.add(c); const nl = labelSprite(b.name, 0.4); nl.position.y = 2.2; c.add(nl); }
    const slot = r.racers.indexOf(b), bt = botT(r, b, t), d = (-6 - Math.floor(slot / 2) * 8) + Math.min(botDist(b, bt), LAPS * app.T.len + 30), lane = (slot % 2 ? 3.5 : -3.5) * Math.max(0, 1 - t / 6) + Math.sin(t * 0.5 + b.seed * 9) * 3 * Math.min(1, t / 6);
    const q = at(app.T, d, lane), dh = Math.atan2(Math.sin(q.h - (c.userData.ph ?? q.h)), Math.cos(q.h - (c.userData.ph ?? q.h))); c.userData.ph = q.h;
    const body = c.userData.body; body.rotation.z += (Math.max(-0.08, Math.min(0.08, -dh / Math.max(dt, 0.001) * 0.05)) - body.rotation.z) * Math.min(1, dt * 5); c.userData.front.forEach(f => (f.rotation.y = Math.max(-0.4, Math.min(0.4, dh / Math.max(dt, 0.001) * 0.3))));
    const lastHit = ((r.hits && r.hits[b.id]) || []).slice(-1)[0], sp = lastHit !== undefined && t - lastHit < SPIN ? (t - lastHit) / SPIN * Math.PI * 4 : 0;
    c.position.set(q.p.x, 0.05 + rampY(app, d, lane), q.p.z); c.rotation.y = q.h + sp;
    // the host checks bots against bananas, and now and then a bot drops one
    if (app.isHost() && r.phase === 'racing') {
      const px = c.userData.px ?? q.p.x, pz = c.userData.pz ?? q.p.z; c.userData.px = q.p.x; c.userData.pz = q.p.z;
      for (const id in app.bananas) { const bn = app.bananas[id]; if (bn.owner !== b.id && segDist(bn.x, bn.z, px, pz, q.p.x, q.p.z) < 1.6) { app.world.scene.remove(bn.m); delete app.bananas[id]; app.emit('bgone', { id }); botHit(app, b.id, t); } }
      if (t > 8 && Math.random() < dt * 0.025) { const bq = at(app.T, d - 4, lane), bb = { id: b.id + ':' + Date.now(), x: bq.p.x, z: bq.p.z, owner: b.id }; addBanana(app, bb); app.emit('banana', bb); }
    } c.scale.setScalar(app.giantCars ? 2 : 1); spin(c, r.phase === 'racing' ? botSpeed(b) : 0, dt);
  }
  // other players' cars follow their avatars
  for (const id in w.remotes) {
    const R = w.remotes[id], d = R.d || {}; if (d.rd !== undefined) app.remoteD[id] = d.rd; if (d.car) { live.add('p' + id); let c = app.cars['p' + id]; if (!c || c.userData.kind !== d.car) { if (c) w.scene.remove(c); c = app.cars['p' + id] = makeCar(d.car); w.scene.add(c); } c.position.set(R.av.group.position.x + Math.sin(d.h || 0) * 0.2, 0.05, R.av.group.position.z + Math.cos(d.h || 0) * 0.2); c.rotation.y = d.h || 0; c.scale.setScalar(d.cs || 1); spin(c, 20, dt); }
  }
  for (const k in app.cars) if (!live.has(k)) { w.scene.remove(app.cars[k]); delete app.cars[k]; }
  fxTick(app, dt); funTick(app, dt, tt);
  if ((app._mm = (app._mm || 0) + dt) > 0.2) { app._mm = 0; miniMap(app); }
  app.showroom.forEach((c, i) => (c.rotation.y += dt * 0.3 * (i % 2 ? 1 : -1)));
  if (app.rainbowUntil > tt) app.roadMat.color.setHSL((tt * 0.2) % 1, 0.7, 0.5); else if (app._rb) { app._rb = false; app.roadMat.color.set(0x3b3f46); }
  if ((app._scr = (app._scr || 0) + dt) > 0.3) { app._scr = 0; drawScreen(app); if (app.drive && app.drive.free) { const bl = localStorage.getItem('marbly_bestlap'); ui.hud(`🚗 ${L('Free drive', 'Свободная езда')} · ${Math.round(Math.abs(app.drive.v) * 3.6)} km/h${bl ? ` · 🏆 ${(+bl).toFixed(1)}s` : ''}`); } else if (app.drive && r.phase === 'racing') { const order = standings(app, r), pos = order.findIndex(x => x.id === app.me.pid) + 1; const el = Math.max(0, (Date.now() - r.start) / 1000), bl = localStorage.getItem('marbly_bestlap'); ui.hud(app.drive.done ? `🏁 ${L('Finished', 'Финиш')} · P${pos}` : `P${pos}/${order.length} · ${L('Lap', 'Круг')} ${Math.min(LAPS, Math.floor(Math.max(0, app.drive.d) / app.T.len) + 1)}/${LAPS} · ${Math.round(Math.abs(app.drive.v) * 3.6)} km/h · ⏱ ${Math.floor(el / 60)}:${(el % 60).toFixed(1).padStart(4, '0')}${bl ? ` · 🏆 ${(+bl).toFixed(1)}s` : ''}`); } else if (!(toGo > 0 && toGo < 5)) ui.hud(''); }
}
function drawScreen(app) {
  const g = app.scrG, r = app.race, W2 = 1024, H2 = 512;
  g.fillStyle = '#0b0f1a'; g.fillRect(0, 0, W2, H2); g.fillStyle = '#e71d36'; g.fillRect(0, 0, W2, 86);
  g.fillStyle = '#fff'; g.font = '900 54px Manrope, system-ui'; g.textBaseline = 'middle'; g.fillText('🏁 ISLAND RACEWAY', 30, 45);
  g.font = '700 34px Manrope, system-ui';
  if (r.phase === 'lobby') { g.fillText(L('Next race: step on the red pad!', 'Следующая гонка: встань на красную площадку!'), 30, 160); g.fillStyle = '#ffd34d'; g.fillText(L('Buy faster cars at Island Motors (mPAY)', 'Быстрые машины — в Island Motors (mPAY)'), 30, 230); return void (app.scr.needsUpdate = true); }
  if (r.phase === 'countdown') { g.fillText(L('Starting in', 'Старт через') + ' ' + Math.max(0, Math.ceil((r.start - Date.now()) / 1000)) + 's', 30, 140); }
  const order = standings(app, r);
  order.slice(0, 8).forEach((x, i) => { g.fillStyle = i === 0 ? '#ffd34d' : i < 3 ? '#e0e6ef' : '#9fb0c2'; g.fillText(`${i + 1}. ${x.name}`, 30, 190 + i * 40); g.fillText(L(CARS[x.car].en, CARS[x.car].ru), 600, 190 + i * 40); });
  app.scr.needsUpdate = true;
}

function onAdmin(a, d, app) {
  const t = app.world.clock.elapsedTime;
  if (a === 'startnow') { if (app.isHost() && app.race.phase === 'lobby') app.forceStart = true; ui.banner('🚦 ' + L('Admin starts a race!', 'Админ запускает гонку!')); }
  if (a === 'boost') { app.boostUntil = performance.now() + 15000; ui.banner('🚀 ' + L('TURBO for everyone!', 'ТУРБО всем!')); app.sfx('whoosh'); }
  if (a === 'giant') { app.giantCars = true; setTimeout(() => (app.giantCars = false), 30000); ui.banner('🦖 ' + L('Giant cars!', 'Гигантские машины!')); }
  if (a === 'rainbow') { app.rainbowUntil = t + 30; app._rb = true; ui.banner('🌈 ' + L('Rainbow road!', 'Радужная дорога!')); }
  const D = app.drive, pn = performance.now();
  if (a === 'bananarain') { if (app.isHost()) for (let k = 0; k < 30; k++) { const q = at(app.T, Math.random() * app.T.len, (Math.random() - 0.5) * (W - 3)), b = { id: 'adm' + k + ':' + Date.now(), x: q.p.x, z: q.p.z, owner: 'admin' }; addBanana(app, b); app.emit('banana', b); } ui.banner('🍌 ' + L('Banana rain! Watch out!', 'Банановый дождь! Осторожно!')); app.sfx('place'); }
  if (a === 'starall') { if (D) { D.starUntil = pn + 10000; D.boostUntil = pn + 1500; } ui.banner('⭐ ' + L('SUPER STAR for everyone!', 'ЗВЕЗДА всем!')); app.sfx('champions'); }
  if (a === 'itemall') { if (D) { D.item = null; D.rolling = false; rollItem(app); } ui.banner('🎁 ' + L('Free item for every driver!', 'Предмет каждому!')); }
  if (a === 'jumpall') { if (D && !D.air) { D.air = true; D.airT = 0; D.vy = 13; D.y = Math.max(D.y, 0.1); app.sfx('boing'); } ui.banner('🦘 ' + L('Every car JUMPS! Press jump to flip!', 'Все машины ПРЫГАЮТ! Жми прыжок для сальто!')); }
  if (a === 'botspin') { const r = app.race; if (app.isHost() && r.phase === 'racing') { const rt = (Date.now() - r.start) / 1000; r.racers.filter(x => x.bot).forEach(x => botHit(app, x.id, rt)); } ui.banner('🌀 ' + L('All the bots spin out!', 'Все боты в заносе!')); app.sfx('bonk'); }
  if (a === 'wave') { app.people.wave = true; app.people.hype = 1; setTimeout(() => { app.people.hype = 0; if (app.race.phase !== 'racing') app.people.wave = false; }, 15000); app.sfx('cheer'); ui.banner('🙌 ' + L('The crowd goes wild!', 'Трибуны сходят с ума!')); }
}

// ---------- art ----------
// side profiles (length along z, height) for the real-looking bodies; the cabin is tinted glass
const SHAPES = {
  car_sport: { W: 1.9, low: [[-2.1, 0.35], [-2.18, 0.78], [-1.6, 0.93], [0.4, 0.92], [1.3, 0.86], [2.08, 0.66], [2.2, 0.42], [2.1, 0.35]], cab: [[-1.55, 0.9], [-0.75, 1.3], [0.25, 1.33], [1.15, 0.9]] },
  car_muscle: { W: 1.95, low: [[-2.3, 0.35], [-2.32, 0.95], [-1.4, 0.98], [1.3, 0.98], [2.3, 0.88], [2.36, 0.42], [2.3, 0.35]], cab: [[-1.35, 0.96], [-0.95, 1.4], [0.35, 1.42], [1.05, 0.96]] },
  car_hyper: { W: 2.0, low: [[-2.25, 0.3], [-2.3, 0.76], [-1.0, 0.86], [0.6, 0.82], [1.6, 0.66], [2.35, 0.42], [2.38, 0.3]], cab: [[-1.05, 0.84], [-0.3, 1.13], [0.45, 1.13], [1.45, 0.7]] },
  car_buggy: { W: 1.8, low: [[-1.6, 0.5], [-1.62, 0.92], [-0.9, 0.95], [1.1, 0.86], [1.7, 0.62], [1.62, 0.5]], cab: null },
};
function profile(pts, width, mat) {
  const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); sh.splineThru(pts.slice(1).map(([x, y]) => new THREE.Vector2(x, y))); sh.lineTo(pts[0][0], pts[0][1]);
  const g = new THREE.ExtrudeGeometry(sh, { depth: width - 0.2, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.08, bevelSegments: 3, curveSegments: 20 });
  g.rotateY(-Math.PI / 2); g.translate((width - 0.2) / 2, 0, 0); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
function makeCar(id, bot) {
  const C = CARS[id] || CARS.kart, root = new THREE.Group(), g = new THREE.Group(); root.add(g); root.userData.kind = id; root.userData.body = g;
  const paint = new THREE.MeshPhysicalMaterial({ color: bot ? new THREE.Color().setHSL(Math.random(), 0.75, 0.45) : C.color, metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06 }), dark = std(0x111317, { roughness: 0.6 }),
    glass = new THREE.MeshPhysicalMaterial({ color: 0x10161f, metalness: 0.2, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.88 }), chrome = std(0xdfe5ec, { metalness: 1, roughness: 0.15 });
  const tail = std(0x550000, { emissive: 0xff1010, emissiveIntensity: 0.6 }), head = std(0xffffff, { emissive: 0xfff4d6, emissiveIntensity: 1.8 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  // tyres with tread, alloy rims with spokes; the front pair steers
  const wheels = [], front = []; const wheel = (x, z, r = 0.38, wd = 0.3) => {
    const hub = new THREE.Group(); hub.position.set(x, r, z);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(r, r, wd, 28).rotateZ(Math.PI / 2), std(0x15161a, { roughness: 0.95 })); tyre.castShadow = true;
    const side = new THREE.Mesh(new THREE.TorusGeometry(r * 0.86, r * 0.16, 8, 28).rotateY(Math.PI / 2), std(0x1c1d22, { roughness: 0.9 })); side.position.x = Math.sign(x) * wd / 2;
    const rim = new THREE.Group(); rim.add(new THREE.Mesh(new THREE.CylinderGeometry(r * 0.62, r * 0.62, wd + 0.03, 20).rotateZ(Math.PI / 2), std(0x2a2d33, { metalness: 0.7, roughness: 0.35 })));
    for (let k = 0; k < 5; k++) { const sp = new THREE.Mesh(new THREE.BoxGeometry(wd + 0.05, r * 1.1, 0.07), chrome); sp.rotation.x = k / 5 * Math.PI; rim.add(sp); }
    hub.add(tyre, side, rim); root.add(hub); wheels.push(tyre, rim); if (z > 0) front.push(hub);
  };
  if (id === 'kart') { add(new THREE.BoxGeometry(1.3, 0.12, 2.2), paint, 0, 0.28, 0); add(new RoundedBox(0.7, 0.55, 0.5, 2, 0.12), dark, 0, 0.6, -0.45); add(new RoundedBox(1.3, 0.25, 0.35, 2, 0.08), paint, 0, 0.42, 1.05); add(new THREE.CylinderGeometry(0.18, 0.18, 0.05, 16), dark, 0, 0.95, 0.35).rotation.x = 1.1; [[-0.75, 0.75], [0.75, 0.75], [-0.75, -0.8], [0.75, -0.8]].forEach(([x, z]) => wheel(x, z, 0.28, 0.25)); }
  else if (id === 'car_f1') {
    g.add(Object.assign(profile([[-2.2, 0.25], [-2.1, 0.75], [-0.6, 0.85], [0.6, 0.7], [2.3, 0.35], [2.4, 0.25]], 0.95, paint), {}));
    add(new THREE.BoxGeometry(2.2, 0.06, 0.6), paint, 0, 0.22, 2.35); add(new THREE.BoxGeometry(2.0, 0.08, 0.5), paint, 0, 1.15, -2.0); for (const sx of [-0.9, 0.9]) add(new THREE.BoxGeometry(0.06, 0.6, 0.6), paint, sx, 0.9, -2.0);
    add(new THREE.TorusGeometry(0.35, 0.05, 8, 16, Math.PI), dark, 0, 0.95, -0.2).rotation.y = Math.PI / 2;
    [[-0.98, 1.45], [0.98, 1.45], [-0.98, -1.35], [0.98, -1.35]].forEach(([x, z]) => wheel(x, z, 0.42, 0.48));
  } else {
    const P = SHAPES[id], len = P.low[P.low.length - 2][0] - P.low[0][0];
    g.add(profile(P.low, P.W, paint));
    if (P.cab) { g.add(profile(P.cab, P.W - 0.32, glass)); const [a1, a2] = [P.cab[1], P.cab[2]]; add(new RoundedBox(P.W - 0.36, 0.07, a2[0] - a1[0] + 0.25, 2, 0.03), paint, 0, Math.max(a1[1], a2[1]) + 0.08, (a1[0] + a2[0]) / 2); }
    else { for (const sx of [-0.7, 0.7]) for (const sz of [-0.9, 0.5]) add(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 8), chrome, sx, 1.55, sz); add(new THREE.BoxGeometry(1.5, 0.06, 1.6), chrome, 0, 2.2, -0.2); }
    const zf = P.low[P.low.length - 2][0], zr = P.low[0][0];
    for (const sx of [-0.65, 0.65]) { add(new THREE.BoxGeometry(0.42, 0.13, 0.06), head, sx, 0.62, zf + 0.06); add(new THREE.BoxGeometry(0.46, 0.12, 0.06), tail, sx, 0.72, zr - 0.06); }
    add(new THREE.BoxGeometry(0.9, 0.18, 0.05), dark, 0, 0.45, zf + 0.08); // grille
    for (const sx of [-0.4, 0.4]) add(new THREE.CylinderGeometry(0.06, 0.06, 0.2, 10).rotateX(Math.PI / 2), chrome, sx, 0.38, zr - 0.08); // exhausts
    for (const sx of [-1, 1]) add(new THREE.BoxGeometry(0.16, 0.1, 0.22), paint, sx * (P.W / 2 + 0.02), 1.0, 0.75); // mirrors
    if (id === 'car_muscle') add(new THREE.BoxGeometry(0.4, 0.02, len * 0.98), std(0xffffff, { roughness: 0.3 }), 0, 0.99, 0);
    if (id === 'car_sport' || id === 'car_hyper') { add(new THREE.BoxGeometry(1.7, 0.06, 0.35), dark, 0, 1.12, zr + 0.25); for (const sx of [-0.6, 0.6]) add(new THREE.BoxGeometry(0.06, 0.32, 0.12), dark, sx, 0.95, zr + 0.25); }
    if (id === 'car_hyper') add(new THREE.BoxGeometry(1.9, 0.05, 0.08), std(0x6ff3ff, { emissive: 0x6ff3ff, emissiveIntensity: 2.5 }), 0, 0.55, zr - 0.04);
    const wz = len * 0.31, r = id === 'car_buggy' ? 0.5 : 0.38;
    [[-P.W / 2 + 0.05, wz], [P.W / 2 - 0.05, wz], [-P.W / 2 + 0.05, -wz], [P.W / 2 - 0.05, -wz]].forEach(([x, z]) => wheel(x, z, r, id === 'car_buggy' ? 0.45 : 0.3));
  }
  root.userData.wheels = wheels; root.userData.front = front; root.userData.tail = tail; return root;
}
function spin(car, v, dt) { for (const wh of car.userData.wheels) wh.rotation.x += v * dt / 0.4; }
function banner(i) { return canvasTexture(512, 64, (g, W2, Hh) => { const c = ['#e71d36', '#1e5bd8', '#ffd34d', '#22a06b'][i % 4]; g.fillStyle = c; g.fillRect(0, 0, W2, Hh); g.fillStyle = i % 4 === 2 ? '#111' : '#fff'; g.font = '900 40px Manrope, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['mBank', 'MARBLY', 'mPAY', 'ISLAND MOTORS'][i % 4], W2 / 2, Hh / 2 + 2); }); }
function tree(w, x, z) {
  const s = 0.8 + Math.random() * 0.7, bark = std(0x5b4030, { roughness: 1 });
  if (Math.random() < 0.5) { mesh(w, new THREE.CylinderGeometry(0.25 * s, 0.4 * s, 3 * s, 8), bark, x, 1.5 * s, z); for (let k = 0; k < 3; k++) mesh(w, new THREE.ConeGeometry((2.6 - k * 0.6) * s, 2.8 * s, 12), std(new THREE.Color().setHSL(0.33, 0.45, 0.2 + Math.random() * 0.06), { roughness: 0.9 }), x, (3.4 + k * 1.6) * s, z); }
  else { mesh(w, new THREE.CylinderGeometry(0.3 * s, 0.45 * s, 3.4 * s, 8), bark, x, 1.7 * s, z); for (let k = 0; k < 5; k++) mesh(w, new THREE.IcosahedronGeometry((1.5 + Math.random()) * s, 1), std(new THREE.Color().setHSL(0.27 + Math.random() * 0.06, 0.5, 0.25 + Math.random() * 0.1), { roughness: 0.9, flatShading: true }), x + (Math.random() - 0.5) * 2.4 * s, (4 + Math.random() * 2) * s, z + (Math.random() - 0.5) * 2.4 * s); }
}

// engine sound: a low hum whose pitch follows the speed (only while you drive)
function engine(app, k, thr, stop) {
  try {
    if (stop) { if (app.eng) { app.eng.g.gain.value = 0; } return; }
    if (!app.eng) {
      const ac = new (window.AudioContext || window.webkitAudioContext)(), o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
      o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 700; g.gain.value = 0;
      o.connect(f); o2.connect(f); f.connect(g); g.connect(ac.destination); o.start(); o2.start(); app.eng = { ac, o, o2, f, g };
    }
    const E = app.eng, rpm = 55 + k * 170 + (thr > 0 ? 18 : 0);
    E.o.frequency.setTargetAtTime(rpm, E.ac.currentTime, 0.05); E.o2.frequency.setTargetAtTime(rpm * 0.5, E.ac.currentTime, 0.05);
    E.f.frequency.setTargetAtTime(500 + k * 1600, E.ac.currentTime, 0.08); E.g.gain.setTargetAtTime(document.hidden ? 0 : 0.035 + k * 0.035, E.ac.currentTime, 0.1);
  } catch (e) {}
}

// ---------- skid marks, smoke and dust ----------
function fxSetup(app) {
  const S = app.world.scene;
  app.skids = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.32, 0.9).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false }), 600);
  app.skids.count = 0; app.skids.frustumCulled = false; app.skidN = 0; S.add(app.skids);
  app.puffs = Array.from({ length: 90 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })); m.visible = false; S.add(m); return m; });
  app.puffN = 0;
}
function skid(app, D, side) {
  // each mark joins up with the last one, so the tyres leave one long line
  const m = new THREE.Matrix4(), x = D.x - Math.sin(D.h) * 1.3 + Math.cos(D.h) * side, z = D.z - Math.cos(D.h) * 1.3 - Math.sin(D.h) * side;
  const last = (D.sk ||= {})[side], now = performance.now(); D.sk[side] = { x, z, t: now };
  if (!last || now - last.t > 250) return;
  const dx = x - last.x, dz = z - last.z, len = Math.hypot(dx, dz); if (len < 0.05 || len > 4) return;
  m.compose(new THREE.Vector3((x + last.x) / 2, 0.05, (z + last.z) / 2), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(dx, dz)), new THREE.Vector3(1, 1, len / 0.9));
  app.skids.setMatrixAt(app.skidN % 600, m); app.skidN++; app.skids.count = Math.min(600, app.skidN); app.skids.instanceMatrix.needsUpdate = true;
}
function puff(app, x, z, color) { const p = app.puffs[app.puffN++ % app.puffs.length]; p.position.set(x + (Math.random() - 0.5), 0.4, z + (Math.random() - 0.5)); p.scale.setScalar(0.3); p.material.color.setHex(color); p.material.opacity = 0.32; p.visible = true; p.userData.t = 0; p.userData.spark = 0; }
function fxTick(app, dt) { for (const p of app.puffs) { if (!p.visible) continue; if (p.userData.spark) { p.userData.spark -= dt; p.position.y += dt * 1.5; p.material.opacity = Math.max(0, p.userData.spark * 2.2); if (p.userData.spark <= 0) { p.visible = false; p.userData.spark = 0; } continue; } p.userData.t += dt; p.position.y += dt * 0.8; p.scale.setScalar(0.3 + p.userData.t * 3); p.material.opacity = Math.max(0, 0.32 - p.userData.t * 0.45); if (p.material.opacity <= 0) p.visible = false; } }

// ---------- the track map in the corner: every car as a dot ----------
function miniMap(app) {
  let c = document.querySelector('#rMap');
  if (!c) {
    c = document.createElement('canvas'); c.id = 'rMap'; c.width = c.height = 300; c.className = 'r-map'; document.body.appendChild(c);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9; for (const p of app.T.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    const k = 260 / Math.max(x1 - x0, z1 - z0); app.mapF = (x, z) => [150 + (x - (x0 + x1) / 2) * k, 150 + (z - (z0 + z1) / 2) * k];
  }
  const g = c.getContext('2d'), F = app.mapF; g.clearRect(0, 0, 300, 300);
  g.lineWidth = 14; g.strokeStyle = 'rgba(20,24,32,0.85)'; g.lineJoin = 'round'; g.beginPath(); app.T.pts.forEach((p, i) => { const [x, y] = F(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); g.stroke();
  g.lineWidth = 2; g.strokeStyle = 'rgba(255,255,255,0.6)'; g.stroke();
  const st = at(app.T, 0), [sx, sy] = F(st.p.x, st.p.z); g.fillStyle = '#fff'; g.fillRect(sx - 2, sy - 9, 4, 18);
  const dot = (x, z, col, r = 7) => { const [px, py] = F(x, z); g.fillStyle = col; g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); g.strokeStyle = '#000'; g.lineWidth = 2; g.stroke(); };
  for (const id in app.cars) { const car = app.cars[id]; dot(car.position.x, car.position.z, id.startsWith('p') ? '#ffffff' : '#ff6fa8', 6); }
  if (app.drive) dot(app.drive.x, app.drive.z, '#ffd34d', 9); else { const p = app.world.me.group.position; dot(p.x, p.z, '#ffd34d', 7); }
}
