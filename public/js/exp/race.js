// 🏁 Island Raceway: buy a car at Island Motors with mBank (mPAY), step on the start pad and race
// against players and bots while a huge crowd watches from the grandstand. Two laps, prizes for the podium.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { experience, L, ui, std, mesh, canvasTexture, confetti, esc, money } from './core.js';
import { TEX, labelSprite } from '../world.js';
import { People } from './people.js';

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
  mesh(w, new THREE.CircleGeometry(500, 48).rotateX(-Math.PI / 2), w.texMat(TEX.grass, 500, 500, { color: 0x6faa4f }), 0, -0.05, 0, { cast: false });
  // asphalt ribbon with red/white kerbs and a chequered start line
  const ribbon = (inner, outer, y, mat, colorFn) => {
    const pos = [], col = [], idx = [];
    for (let i = 0; i <= T.N; i++) {
      const p = T.pts[i % T.N], tn = T.tan[i % T.N], nx = -tn.z, nz = tn.x;
      pos.push(p.x + nx * inner, y, p.z + nz * inner, p.x + nx * outer, y, p.z + nz * outer);
      if (colorFn) { const c = colorFn(i); col.push(...c, ...c); }
      if (i < T.N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); if (colorFn) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, mat); m.receiveShadow = true; S.add(m); return m;
  };
  app.roadMat = new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.85, side: THREE.DoubleSide });
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
  const conc = std(0xd8d4cc, { roughness: 0.85 }), seatC = [0xe71d36, 0xffd34d, 0x1f4b8f];
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
  for (let k = 0; k < 8; k++) { const g = gridSpot(app, k); mesh(w, new THREE.PlaneGeometry(2.6, 4.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }), g.p.x, 0.045, g.p.z, { ry: g.h, cast: false }); }
  app.extraPos = () => (app.drive ? { car: app.drive.id, h: +app.drive.h.toFixed(2), cs: app.giantCars ? 2 : 1, rd: Math.round(app.drive.d) } : {});
  app.remoteD = {};
  drawScreen(app);
}
function started(app) { ui.banner('🏁 ' + L('Island Raceway! Buy a car, then step on the red pad to race.', 'Остров Гонок! Купи машину и встань на красную площадку.'), 5000); }

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
  if (r.phase === 'countdown' && was !== 'countdown') { ui.banner('🚦 ' + L('Race starting! Drivers to the grid!', 'Гонка начинается! Пилоты на старт!'), 3000); app.sfx('drumroll'); if (mine) toGrid(app, mine, r); }
  if (r.phase === 'racing' && was !== 'racing') { app.sfx('go'); ui.banner('🟢 GO! GO! GO!', 1800); app.people.hype = 1; setTimeout(() => (app.people.hype = 0), 4000); app.people.wave = true; }
  if (r.phase === 'results' && was !== 'results') results(app, r);
  if (r.phase === 'lobby' && was !== 'lobby') { app.people.wave = false; endDrive(app); }
}
// bots drive a smooth, fair line: fast cars are faster, with a little randomness
function botSpeed(b) { return CARS[b.car].max * (0.8 + b.seed * 0.12); }
function botDist(b, t) { if (t <= 0) return 0; const v = botSpeed(b), te = t < 3 ? t * t / 6 : t - 1.5; return v * (0.94 * te - 0.06 / 0.7 * (Math.cos(0.7 * te + b.seed * 6) - Math.cos(b.seed * 6))); }
function botTime(app, b) { let lo = 0, hi = 400; const goal = LAPS * app.T.len; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (botDist(b, m) < goal) lo = m; else hi = m; } return hi; }
function gridSpot(app, slot) { return at(app.T, -6 - Math.floor(slot / 2) * 8, slot % 2 ? 3.5 : -3.5); }

// ---------- driving ----------
function toGrid(app, me, r) {
  const slot = r.racers.indexOf(me), g = gridSpot(app, slot), w = app.world;
  const car = makeCar(me.car); w.scene.add(car);
  app.drive = { id: me.car, car, x: g.p.x, z: g.p.z, h: g.h, v: 0, d: -6 - Math.floor(slot / 2) * 8, lapD: 0, idx: g.i, steer: 0, done: false };
  w.me.play('sit'); app.emoteSig = 'sit:' + Date.now();
  w.carrier = { update: (dt, p, meAv) => { drive(app, dt, p, meAv); return false; }, onCancel: () => {} };
  w.cameraOverride = (cam, dt) => { const D = app.drive; if (!D) return; const back = 9 * (app.giantCars ? 1.8 : 1); const tx = D.x - Math.sin(D.h) * back, tz = D.z - Math.cos(D.h) * back; cam.position.lerp(new THREE.Vector3(tx, 4.2 * (app.giantCars ? 1.6 : 1), tz), Math.min(1, dt * 5)); cam.lookAt(D.x + Math.sin(D.h) * 6, 1.2, D.z + Math.cos(D.h) * 6); };
}
function drive(app, dt, p, meAv) {
  const D = app.drive, w = app.world, r = app.race, C = CARS[D.id], k = w.keys;
  const racing = r.phase === 'racing' && !D.done;
  const thr = racing ? ((k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + w.joy.y) : 0, st = (k.KeyA || k.ArrowLeft ? 1 : 0) - (k.KeyD || k.ArrowRight ? 1 : 0) - w.joy.x;
  const near = at(app.T, D.lapD), off = Math.hypot(D.x - near.p.x, D.z - near.p.z), onRoad = off < W / 2 + 1.2;
  const max = C.max * (app.boostUntil > performance.now() ? 1.6 : 1) * (onRoad ? 1 : 0.45);
  D.v += (thr > 0 ? C.acc * thr : thr < 0 ? 18 * thr : 0) * dt; D.v -= D.v * (onRoad ? 0.35 : 1.6) * dt;
  D.v = Math.max(-8, Math.min(max, D.v));
  D.steer += (Math.max(-1, Math.min(1, st)) - D.steer) * Math.min(1, dt * 8);
  D.h += D.steer * C.turn * Math.min(1, Math.abs(D.v) / 10) * Math.sign(D.v || 1) * dt;
  D.x += Math.sin(D.h) * D.v * dt; D.z += Math.cos(D.h) * D.v * dt;
  // walls: bounce back onto the track
  if (off > W / 2 + 2.6) { const nx = (near.p.x - D.x) / off, nz = (near.p.z - D.z) / off; D.x += nx * (off - W / 2 - 2.6); D.z += nz * (off - W / 2 - 2.6); D.v *= 0.5; if (!D.bonk || performance.now() - D.bonk > 600) { D.bonk = performance.now(); app.sfx('bonk'); } }
  // progress round the track: find the nearest point ahead of where we were
  let best = D.lapD, bestE = 1e9;
  for (let s = -12; s <= 24; s += 1.5) { const q = at(app.T, D.lapD + s).p, e = (q.x - D.x) ** 2 + (q.z - D.z) ** 2; if (e < bestE) { bestE = e; best = D.lapD + s; } }
  const before = D.d; D.d += best - D.lapD; D.lapD = best;
  if (racing && Math.floor(D.d / app.T.len) > Math.floor(before / app.T.len) && D.d > 0) { const lap = Math.floor(D.d / app.T.len) + 1; if (lap <= LAPS) { ui.banner(lap === LAPS ? '🔔 ' + L('Final lap!', 'Последний круг!') : `🏁 ${L('Lap', 'Круг')} ${lap}/${LAPS}`, 1800); app.sfx('ding'); } }
  if (racing && D.d >= LAPS * app.T.len) { D.done = true; const time = (Date.now() - r.start) / 1000; app.emit('rfin', { pid: app.me.pid, time }); if (app.isHost()) { r.results[app.me.pid] = time; push(app); } ui.banner(`🏁 ${L('Finished!', 'Финиш!')} ${time.toFixed(1)}s`, 3000); app.sfx('cheer'); }
  // bumping into other cars pushes you apart and costs speed
  for (const c of Object.values(app.cars)) { const dx = D.x - c.position.x, dz = D.z - c.position.z, dd = Math.hypot(dx, dz), min = 2.3 * (app.giantCars ? 2 : 1); if (dd < min && dd > 0.01) { D.x += dx / dd * (min - dd); D.z += dz / dd * (min - dd); D.v *= 0.82; if (!D.hit || performance.now() - D.hit > 500) { D.hit = performance.now(); app.sfx('bonk'); } } }
  // skid marks and smoke when you corner hard or brake, dust when you go off the road
  const slide = Math.abs(D.steer) * Math.abs(D.v) / C.max, braking = thr < 0 && D.v > 6;
  if ((slide > 0.55 || braking) && racing) { skid(app, D, 0.95); skid(app, D, -0.95); if (Math.random() < 0.5) puff(app, D.x - Math.sin(D.h) * 1.8, D.z - Math.cos(D.h) * 1.8, 0xdddddd); }
  if (!onRoad && Math.abs(D.v) > 4 && Math.random() < 0.6) puff(app, D.x - Math.sin(D.h) * 1.8, D.z - Math.cos(D.h) * 1.8, 0xb59a6a);
  const cam = app.world.camera, fov = 56 + Math.min(1, Math.abs(D.v) / 40) * 16; if (Math.abs(cam.fov - fov) > 0.2) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 3); cam.updateProjectionMatrix(); }
  const sc = app.giantCars ? 2 : 1, body = D.car.userData.body;
  // the body leans out of corners and dips when braking, like a real car
  const roll = -D.steer * Math.min(1, Math.abs(D.v) / C.max) * 0.09, pitch = (D.v - (D.pv ?? D.v)) / Math.max(dt, 0.001) * -0.004; D.pv = D.v;
  body.rotation.z += (roll - body.rotation.z) * Math.min(1, dt * 6); body.rotation.x += (Math.max(-0.05, Math.min(0.05, pitch)) - body.rotation.x) * Math.min(1, dt * 6);
  D.car.userData.front.forEach(f => (f.rotation.y = D.steer * 0.45));
  D.car.position.set(D.x, 0.05, D.z); D.car.rotation.y = D.h; D.car.scale.setScalar(sc); spin(D.car, D.v, dt);
  engine(app, Math.abs(D.v) / C.max, thr);
  p.set(D.x - Math.sin(D.h) * 0.2 * sc, 0.25 * sc, D.z - Math.cos(D.h) * 0.2 * sc); meAv.group.rotation.y = D.h; meAv.animate(0, dt, false);
}
function endDrive(app) {
  const D = app.drive, w = app.world; if (!D) return; engine(app, 0, 0, true); w.camera.fov = 56; w.camera.updateProjectionMatrix();
  w.scene.remove(D.car); app.drive = null; w.carrier = null; w.cameraOverride = null; w.me.emote = null;
  w.teleport(app.pad.x - 4, app.pad.z, Math.PI);
}
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
    if (x.bot) { const bt = botTime(app, x); return { ...x, done: bt <= t, time: bt, dist: botDist(x, t) }; }
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
    const slot = r.racers.indexOf(b), d = (-6 - Math.floor(slot / 2) * 8) + Math.min(botDist(b, t), LAPS * app.T.len + 30), lane = (slot % 2 ? 3.5 : -3.5) * Math.max(0, 1 - t / 6) + Math.sin(t * 0.5 + b.seed * 9) * 3 * Math.min(1, t / 6);
    const q = at(app.T, d, lane), dh = Math.atan2(Math.sin(q.h - (c.userData.ph ?? q.h)), Math.cos(q.h - (c.userData.ph ?? q.h))); c.userData.ph = q.h;
    const body = c.userData.body; body.rotation.z += (Math.max(-0.08, Math.min(0.08, -dh / Math.max(dt, 0.001) * 0.05)) - body.rotation.z) * Math.min(1, dt * 5); c.userData.front.forEach(f => (f.rotation.y = Math.max(-0.4, Math.min(0.4, dh / Math.max(dt, 0.001) * 0.3))));
    c.position.set(q.p.x, 0.05, q.p.z); c.rotation.y = q.h; c.scale.setScalar(app.giantCars ? 2 : 1); spin(c, r.phase === 'racing' ? botSpeed(b) : 0, dt);
  }
  // other players' cars follow their avatars
  for (const id in w.remotes) {
    const R = w.remotes[id], d = R.d || {}; if (d.rd !== undefined) app.remoteD[id] = d.rd; if (d.car) { live.add('p' + id); let c = app.cars['p' + id]; if (!c || c.userData.kind !== d.car) { if (c) w.scene.remove(c); c = app.cars['p' + id] = makeCar(d.car); w.scene.add(c); } c.position.set(R.av.group.position.x + Math.sin(d.h || 0) * 0.2, 0.05, R.av.group.position.z + Math.cos(d.h || 0) * 0.2); c.rotation.y = d.h || 0; c.scale.setScalar(d.cs || 1); spin(c, 20, dt); }
  }
  for (const k in app.cars) if (!live.has(k)) { w.scene.remove(app.cars[k]); delete app.cars[k]; }
  fxTick(app, dt);
  app.showroom.forEach((c, i) => (c.rotation.y += dt * 0.3 * (i % 2 ? 1 : -1)));
  if (app.rainbowUntil > tt) app.roadMat.color.setHSL((tt * 0.2) % 1, 0.7, 0.5); else if (app._rb) { app._rb = false; app.roadMat.color.set(0x3b3f46); }
  if ((app._scr = (app._scr || 0) + dt) > 0.3) { app._scr = 0; drawScreen(app); if (app.drive && r.phase === 'racing') { const order = standings(app, r), pos = order.findIndex(x => x.id === app.me.pid) + 1; ui.hud(app.drive.done ? `🏁 ${L('Finished', 'Финиш')} · P${pos}` : `P${pos}/${order.length} · ${L('Lap', 'Круг')} ${Math.min(LAPS, Math.floor(Math.max(0, app.drive.d) / app.T.len) + 1)}/${LAPS} · ${Math.round(Math.abs(app.drive.v) * 3.6)} km/h`); } else if (!(toGo > 0 && toGo < 5)) ui.hud(''); }
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
  if (a === 'wave') { app.people.wave = true; app.people.hype = 1; setTimeout(() => { app.people.hype = 0; if (app.race.phase !== 'racing') app.people.wave = false; }, 15000); app.sfx('cheer'); ui.banner('🙌 ' + L('The crowd goes wild!', 'Трибуны сходят с ума!')); }
}

// ---------- art ----------
function makeCar(id, bot) {
  const C = CARS[id] || CARS.kart, root = new THREE.Group(), g = new THREE.Group(); root.add(g); root.userData.kind = id; root.userData.body = g;
  const paint = new THREE.MeshPhysicalMaterial({ color: bot ? new THREE.Color().setHSL(Math.random(), 0.75, 0.5) : C.color, metalness: 0.55, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 }), dark = std(0x15171c, { roughness: 0.5 }), glass = std(0x1d2b3a, { metalness: 0.8, roughness: 0.1 });
  const add = (geo, m, x, y, z) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
  // wheels hang from the root (not the leaning body); the front pair can steer
  const wheels = [], front = []; const wheel = (x, z, r = 0.38, wd = 0.3) => { const hub = new THREE.Group(); hub.position.set(x, r, z); const wh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, wd, 18).rotateZ(Math.PI / 2), dark); wh.castShadow = true; const rim = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.55, r * 0.55, wd + 0.02, 12).rotateZ(Math.PI / 2), std(0xc9d1db, { metalness: 0.9, roughness: 0.25 })); hub.add(wh, rim); root.add(hub); wheels.push(wh, rim); if (z > 0) front.push(hub); };
  if (id === 'kart') { add(new THREE.BoxGeometry(1.3, 0.2, 2.2), paint, 0, 0.3, 0); add(new THREE.BoxGeometry(0.7, 0.5, 0.5), dark, 0, 0.55, -0.4); add(new THREE.BoxGeometry(1.3, 0.25, 0.3), paint, 0, 0.45, 1.05); [[-0.75, 0.75], [0.75, 0.75], [-0.75, -0.8], [0.75, -0.8]].forEach(([x, z]) => wheel(x, z, 0.28, 0.25)); }
  else if (id === 'car_f1') { add(new RoundedBox(0.9, 0.45, 4.2, 2, 0.15), paint, 0, 0.45, 0.2); add(new THREE.BoxGeometry(2.1, 0.08, 0.6), paint, 0, 0.25, 2.3); add(new THREE.BoxGeometry(1.8, 0.1, 0.5), paint, 0, 1.15, -1.8); add(new THREE.BoxGeometry(0.1, 0.5, 0.4), dark, 0, 0.85, -1.8); [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.3], [0.95, -1.3]].forEach(([x, z]) => wheel(x, z, 0.42, 0.45)); }
  else {
    const low = id === 'car_hyper' ? 0.55 : id === 'car_sport' ? 0.65 : 0.8, len = id === 'car_buggy' ? 3.2 : 4.2;
    add(new RoundedBox(1.9, low, len, 3, 0.25), paint, 0, 0.35 + low / 2, 0);
    add(new RoundedBox(1.5, 0.55, len * 0.42, 3, 0.2), glass, 0, 0.35 + low + 0.25, -0.2);
    if (id === 'car_buggy') { for (const sx of [-0.7, 0.7]) add(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 6), dark, sx, 1.5, -0.2); add(new THREE.BoxGeometry(1.5, 0.08, 1.2), dark, 0, 2.05, -0.2); }
    if (id === 'car_muscle') add(new THREE.BoxGeometry(0.35, low + 0.02, len + 0.02), std(0xffffff), 0, 0.35 + low / 2, 0);
    if (id === 'car_sport' || id === 'car_hyper') { add(new THREE.BoxGeometry(1.8, 0.08, 0.4), dark, 0, 0.35 + low + 0.35, -len / 2 + 0.2); for (const sx of [-0.6, 0.6]) add(new THREE.BoxGeometry(0.08, 0.35, 0.08), dark, sx, 0.35 + low + 0.15, -len / 2 + 0.2); }
    if (id === 'car_hyper') add(new THREE.BoxGeometry(1.9, 0.06, 0.2), std(0x6ff3ff, { emissive: 0x6ff3ff, emissiveIntensity: 2 }), 0, 0.5, -len / 2 - 0.02);
    for (const sx of [-0.7, 0.7]) add(new THREE.BoxGeometry(0.4, 0.15, 0.05), std(0xffffff, { emissive: 0xfff1c8, emissiveIntensity: 1.5 }), sx, 0.35 + low * 0.6, len / 2 + 0.01);
    [[-0.95, len * 0.32], [0.95, len * 0.32], [-0.95, -len * 0.32], [0.95, -len * 0.32]].forEach(([x, z]) => wheel(x, z, id === 'car_buggy' ? 0.5 : 0.4, id === 'car_buggy' ? 0.45 : 0.32));
  }
  root.userData.wheels = wheels; root.userData.front = front; return root;
}
function spin(car, v, dt) { for (const wh of car.userData.wheels) wh.rotation.x += v * dt / 0.4; }
function banner(i) { return canvasTexture(512, 64, (g, W2, Hh) => { const c = ['#e71d36', '#1e5bd8', '#ffd34d', '#22a06b'][i % 4]; g.fillStyle = c; g.fillRect(0, 0, W2, Hh); g.fillStyle = i % 4 === 2 ? '#111' : '#fff'; g.font = '900 40px Manrope, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(['mBank', 'MARBLY', 'mPAY', 'ISLAND MOTORS'][i % 4], W2 / 2, Hh / 2 + 2); }); }
function tree(w, x, z) { mesh(w, new THREE.CylinderGeometry(0.3, 0.45, 4, 8), std(0x6b4a2b), x, 2, z); mesh(w, new THREE.ConeGeometry(2.4, 6, 10), std(new THREE.Color().setHSL(0.3, 0.5, 0.25 + Math.random() * 0.1)), x, 6.5, z); }

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
  app.puffs = Array.from({ length: 40 }, () => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, roughness: 1 })); m.visible = false; S.add(m); return m; });
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
function puff(app, x, z, color) { const p = app.puffs[app.puffN++ % app.puffs.length]; p.position.set(x + (Math.random() - 0.5), 0.4, z + (Math.random() - 0.5)); p.scale.setScalar(0.4); p.material.color.setHex(color); p.material.opacity = 0.55; p.visible = true; p.userData.t = 0; }
function fxTick(app, dt) { for (const p of app.puffs) { if (!p.visible) continue; p.userData.t += dt; p.position.y += dt * 0.8; p.scale.setScalar(0.4 + p.userData.t * 2.2); p.material.opacity = Math.max(0, 0.55 - p.userData.t * 0.6); if (p.material.opacity <= 0) p.visible = false; } }
