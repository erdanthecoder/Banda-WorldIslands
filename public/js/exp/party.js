// 🎉 Party Royale: a Fall-Guys-style minigame party in a candy stadium. The host runs rounds forever:
// a random minigame (Tile Fall, Color Block, Bomb Tag, King of the Hill, Spinner Jump, Coin Rush), points for
// everyone, and after five rounds a champion is crowned with fireworks and a coin prize. Players and bots play together.
import * as THREE from 'three';
import { RoundedBoxGeometry as RoundedBox } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { experience, L, ui, std, mesh, canvasTexture, confetti, flash, esc, money } from './core.js';
import { labelSprite } from '../world.js';
import { People } from './people.js';
import { Coins } from './fun.js';
import { Avatar, randomAvatar } from '../avatar.js';

const TAU = Math.PI * 2, Y0 = 12, Y1 = 6, R = 16, HS = 1.3, SQ = 3.45, ROUNDS = 5;
const T_LOBBY = 15000, T_INTRO = 6500, T_RES = 8000, T_CHAMP = 14000;
const GAMES = {
  tiles: { icon: '🔥', en: 'Tile Fall', ru: 'Падающие плитки', how: ['Tiles drop after you step on them. Keep moving!', 'Плитки падают, когда на них наступишь. Не стой!'], dur: 90, elim: true },
  color: { icon: '🟥', en: 'Color Block', ru: 'Цветные блоки', how: ['Stand on the called colour before the floor drops!', 'Встань на названный цвет, пока пол не упал!'], dur: 90, elim: true },
  bomb: { icon: '💣', en: 'Bomb Tag', ru: 'Бомба-салки', how: ['Got the bomb? Touch someone before it explodes!', 'У тебя бомба? Коснись кого-нибудь, пока не взорвалась!'], dur: 100, elim: true },
  koth: { icon: '👑', en: 'King of the Hill', ru: 'Царь горы', how: ['Stand on the golden top to score. F = shove!', 'Стой на золотой вершине — получай очки. F = толкнуть!'], dur: 60 },
  sweep: { icon: '🌀', en: 'Spinner Jump', ru: 'Крутилка', how: ['Jump over the spinning beam. It gets faster!', 'Прыгай через крутящуюся балку. Она ускоряется!'], dur: 75, elim: true },
  coins: { icon: '🪙', en: 'Coin Rush', ru: 'Монетная лихорадка', how: ['Grab the most coins! Gold ones are worth 5.', 'Собери больше всех монет! Золотые — по 5.'], dur: 60 },
};
const GIDS = Object.keys(GAMES), PTS = [10, 8, 6, 5, 4, 3, 2];
const COLORS = [['#ff4d6d', 'RED', 'КРАСНЫЙ'], ['#3a86ff', 'BLUE', 'СИНИЙ'], ['#2ec46b', 'GREEN', 'ЗЕЛЁНЫЙ'], ['#ffd23f', 'YELLOW', 'ЖЁЛТЫЙ'], ['#a65cff', 'PURPLE', 'ФИОЛЕТОВЫЙ'], ['#ff8c1a', 'ORANGE', 'ОРАНЖЕВЫЙ']];
const BOTS = ['Jelly Jam', 'Bean Bolt', 'Sir Wobble', 'Zara Zoom', 'Turbo Timur', 'Bouncy Bek', 'Aisha Ace', 'Noodle Nurlan', 'Pip Pop', 'Mega Max'];
const LOUNGE = { x0: -10, x1: 10, z0: 25, z1: 32 }, PADS = [0.8, 2.37, 3.94, 5.5].map(a => [Math.sin(a) * 9, Math.cos(a) * 9]);
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a)), isBot = id => id.startsWith('bot');
function rng(a) { return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
let A;

// ---------- hex tiles (two layers) and the colour grid ----------
const HEX = [], HEXK = {};
for (let r = -12; r <= 12; r++) for (let q = -12; q <= 12; q++) { const x = HS * Math.sqrt(3) * (q + r / 2), z = HS * 1.5 * r; if (Math.hypot(x, z) < R - 1.4) { HEXK[q + ',' + r] = HEX.length; HEX.push([x, z, Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r))]); } }
const NT = HEX.length;
const NB = HEX.map(([x, z], i) => HEX.map((h, j) => [j, Math.hypot(h[0] - x, h[1] - z)]).filter(([j, d]) => j !== i && d < 2.5).map(([j]) => j));
const NB2 = HEX.map(([x, z], i) => HEX.map((h, j) => [j, Math.hypot(h[0] - x, h[1] - z)]).filter(([, d]) => d > 2.5 && d < 4).map(([j]) => j));
function hexAt(x, z) {
  const fq = (Math.sqrt(3) / 3 * x - z / 3) / HS, fr = (2 / 3 * z) / HS, fs = -fq - fr; let q = Math.round(fq), r = Math.round(fr); const s = Math.round(fs);
  const dq = Math.abs(q - fq), dr = Math.abs(r - fr), ds = Math.abs(s - fs); if (dq > dr && dq > ds) q = -r - s; else if (dr > ds) r = -q - s;
  const i = HEXK[q + ',' + r]; return i === undefined ? -1 : i;
}
const sqXZ = i => [(i % 8 - 3.5) * SQ, (Math.floor(i / 8) - 3.5) * SQ];
function sqAt(x, z) { const ix = Math.floor(x / SQ + 4), iz = Math.floor(z / SQ + 4); return ix >= 0 && ix < 8 && iz >= 0 && iz < 8 ? iz * 8 + ix : -1; }
// Color Block waves: show the floor, call a colour, drop the rest, bring it back. The countdown gets shorter.
const CW = []; { let s = 0; for (let k = 0; k < 60; k++) { const call = s + 1.6, drop = call + Math.max(1.4, 4.6 - 0.4 * k), back = drop + 2.4; CW.push({ k, s, call, drop, back }); s = back + 0.4; } }
const cWave = t => { for (let i = CW.length - 1; i > 0; i--) if (t >= CW[i].s) return CW[i]; return CW[0]; };
function cLayout(app, P, k) {
  const key = P.seed + ':' + k + ':' + (P.cOver && P.cOver.k === k ? P.cOver.c : '');
  if (app._cl && app._cl.key === key) return app._cl.v;
  const r = rng(P.seed * 977 + k * 131), c = Math.floor(r() * 6), cols = [];
  for (let i = 0; i < 64; i++) cols.push((c + 1 + Math.floor(r() * 5)) % 6);
  const ids = [...Array(64).keys()]; for (let i = 63; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  ids.slice(0, Math.max(3, 13 - k)).forEach(i => (cols[i] = c));
  const v = { c: P.cOver && P.cOver.k === k ? P.cOver.c : c, cols }; app._cl = { key, v }; return v;
}
// Spinner: the beam angle is the same for everyone (worked out from the round clock)
const FW = t => 0.85 * t + 0.014 * t * t;
function beamAng(P, now) { const t = (now - P.start) / 1000, [ts, th, m] = P.beam || [0, 0, 1]; return th + m * (FW(Math.max(0, t)) - FW(ts)); }
const beamW = (P, now) => (P.beam ? P.beam[2] : 1) * (0.85 + 0.028 * (now - P.start) / 1000);
// Coin Rush: every coin's place and time comes from the round seed
function coinList(app, P) {
  if (app._co && app._co.seed === P.seed) return app._co.list;
  const r = rng(P.seed * 31 + 7), list = [];
  for (let i = 0; i < 150; i++) { const a = r() * TAU, d = 1.5 + Math.sqrt(r()) * 12; list.push({ x: Math.sin(a) * d, z: Math.cos(a) * d, t: i < 14 ? 0 : (i - 14) * 0.42, v: i % 8 === 7 ? 5 : 1 }); }
  app._co = { seed: P.seed, list }; return list;
}
const coinOn = (app, c, i, t) => t >= c.t && t < c.t + 22 && !app.taken.has(i);

experience({
  id: 'party', title: 'Party Royale', titleRu: 'Пати Рояль', icon: '🎉', spawn: [0, 9, 0], sun: [50, 140], ground: 0, sea: -3,
  admin: [
    { a: 'skip', icon: '⏭️', en: 'Next minigame now', ru: 'Следующая игра сейчас' },
    ...GIDS.map(g => ({ a: 'pick_' + g, icon: GAMES[g].icon, en: 'Next: ' + GAMES[g].en, ru: 'Дальше: ' + GAMES[g].ru })),
    { a: 'double', icon: '✖️', en: 'Double points', ru: 'Двойные очки' },
    { a: 'adminwins', icon: '👑', en: 'Everyone out except the admin', ru: 'Все вылетают, кроме админа' },
    { a: 'revive', icon: '💖', en: 'Revive everyone', ru: 'Воскресить всех' },
    { a: 'allbomb', icon: '💣', en: 'Bombs for everyone!', ru: 'Бомбы всем!' },
    { a: 'turbo', icon: '🌪️', en: 'Turbo spinner', ru: 'Турбо-крутилка' },
    { a: 'instant', icon: '⚡', en: 'Tiles fall instantly', ru: 'Плитки падают мгновенно' },
    { a: 'bounce', icon: '🦘', en: 'Trampoline floor', ru: 'Пол-батут' },
    { a: 'botdance', icon: '🕺', en: 'Bots dance instead of playing', ru: 'Боты танцуют вместо игры' },
    { a: 'cannons', icon: '🎉', en: 'Confetti cannons', ru: 'Конфетти-пушки' },
    { a: 'flip', icon: '🌈', en: 'Flip the arena colours', ru: 'Перекрасить арену' },
    { a: 'shoveall', icon: '💨', en: 'Mega shove wave', ru: 'Мега-толчок' },
    { a: 'crowd', icon: '🙌', en: 'Crowd goes wild', ru: 'Трибуны сходят с ума' },
  ],
  build, frame, onAdmin, started,
});

// ---------- build ----------
function build(app) {
  A = app; const w = app.world;
  w.scene.fog.density = 0.0011;
  Object.assign(app, { t0: Date.now(), P: null, fall: new Float64Array(NT * 2), tileAnim: new Set(), taken: new Set(), cred: new Set(), sim: {}, bv: {}, lay: '', spec: -1, outK: 0, fx: [], prevY: {} });
  stadium(app); arena(app); lounge(app); botsSetup(app); hudSetup(app);
  app.coins = new Coins(app);
  w.grounds.push((x, z, y) => groundY(app, x, z, y));
  // stay inside the stadium bowl (the stands are behind the slime pit)
  w.constrain = (x, z) => { if (w.me.group.position.y < 22) { const d = Math.hypot(x, z); if (d > 34.4) return [x / d * 34.4, z / d * 34.4]; } return [x, z]; };
  app.net.onState('party', v => { if (!v || (v.hp === app.me.pid && app.isHost())) return; setP(app, v); });
  app.onEvent(ev => onEv(app, ev));
  setLayout(app, 'lobby');
  // handles for tests and the admin
  app.party = { push: v => push(app, v), newRound: () => newRound(app, Date.now()), startPlay: () => startPlay(app, Date.now()), endPlay: () => endPlay(app, Date.now()), hostTick: dt => hostTick(app, Date.now(), dt || 0.05), botsHost: dt => botsHost(app, dt, Date.now()), myTick: () => myTick(app, Date.now()), GAMES, HEX, NT };
}
function started() { ui.banner('🎉 ' + L('Party Royale! Survive the minigames, score points, become the champion!', 'Пати Рояль! Переживи мини-игры, набери очки, стань чемпионом!'), 5000); }

// ---------- the stadium ----------
function stadium(app) {
  const w = app.world, S = w.scene;
  mesh(w, new THREE.CircleGeometry(420, 48).rotateX(-Math.PI / 2), std(0x6fbf4a, { roughness: 1 }), 0, -0.06, 0, { cast: false });
  // the slime pit everyone falls into
  app.slimeTex = canvasTexture(512, 512, (g, W) => {
    const gr = g.createLinearGradient(0, 0, W, W); gr.addColorStop(0, '#c13cff'); gr.addColorStop(1, '#ff3fa4'); g.fillStyle = gr; g.fillRect(0, 0, W, W);
    for (let i = 0; i < 70; i++) { const x = Math.random() * W, y = Math.random() * W, r = 8 + Math.random() * 40, c = g.createRadialGradient(x, y, 0, x, y, r); c.addColorStop(0, `rgba(255,${150 + Math.random() * 100},255,0.55)`); c.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = c; g.fillRect(x - r, y - r, r * 2, r * 2); }
    for (let i = 0; i < 40; i++) { g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2; g.beginPath(); g.arc(Math.random() * W, Math.random() * W, 3 + Math.random() * 7, 0, TAU); g.stroke(); }
  });
  app.slimeTex.wrapS = app.slimeTex.wrapT = THREE.RepeatWrapping; app.slimeTex.repeat.set(7, 7);
  mesh(w, new THREE.CircleGeometry(36, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: app.slimeTex, emissive: 0xff40c0, emissiveMap: app.slimeTex, emissiveIntensity: 0.45, roughness: 0.15, metalness: 0.1 }), 0, 0.12, 0, { cast: false });
  // stands: ten rows of rainbow benches all the way round (one merged mesh)
  const ST = app.ST = { r0: 35.6, d: 1.7, dh: 1.25, h0: 3, rows: 10 }, parts = [], SEC = ['#ff6fa8', '#ffd34d', '#4dd8ff', '#a66bff', '#5ee08a', '#ff8c42'], seats = [];
  for (let k = 0; k < ST.rows; k++) {
    const r = ST.r0 + k * ST.d, y = ST.h0 + k * ST.dh, yp = k ? y - ST.dh : 0, rb = r + ST.d * 0.62;
    if (k) parts.push(colorize(new THREE.CylinderGeometry(r, r, y - yp, 96, 1, true).translate(0, (y + yp) / 2, 0), '#e8e2f4'));
    parts.push(colorize(new THREE.RingGeometry(r, r + ST.d, 96, 1).rotateX(-Math.PI / 2).translate(0, y, 0), k % 2 ? '#f3eefb' : '#ffffff'));
    for (let s = 0; s < 24; s++) {
      const a0 = s / 24 * TAU, c = SEC[(s + k) % 6];
      parts.push(colorize(new THREE.CylinderGeometry(rb, rb, 0.42, 5, 1, true, a0 + Math.PI / 2, TAU / 24).translate(0, y + 0.21, 0), c));
      parts.push(colorize(new THREE.RingGeometry(rb - 0.02, rb + 0.42, 5, 1, a0, TAU / 24).rotateX(-Math.PI / 2).translate(0, y + 0.42, 0), c));
    }
    for (let a = 0; a < TAU; a += 1.05 / rb) if (Math.random() < (w.hq ? 0.24 : 0.11)) { const aa = a + Math.random() * 0.2 / rb, x = Math.cos(aa) * (rb + 0.18), z = -Math.sin(aa) * (rb + 0.18); seats.push({ x, y: y + 0.42 - 0.43, z, ry: Math.atan2(-x, -z), kind: 'fan', s: 0.9 }); }
  }
  const st = new THREE.Mesh(mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide })); st.receiveShadow = true; st.castShadow = w.hq; S.add(st);
  app.people = new People(w, { seats, far: w.hq ? 140 : 95 });
  // banner walls: the front of the pit and the back of the stands
  const ban = canvasTexture(1024, 128, (g, W, H) => { const c = ['#ff3d8b', '#7a2bd8', '#ffb31a', '#1fb6ff']; const t = ['🎉 PARTY ROYALE', 'MARBLY', '★ mBank ★', 'mPAY']; for (let i = 0; i < 4; i++) { g.fillStyle = c[i]; g.fillRect(i * W / 4, 0, W / 4, H); g.fillStyle = i === 2 ? '#3a1a00' : '#fff'; g.font = '900 42px Manrope, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t[i], i * W / 4 + W / 8, H / 2 + 2); } });
  ban.wrapS = THREE.RepeatWrapping; ban.repeat.set(10, 1);
  const front = new THREE.Mesh(new THREE.CylinderGeometry(ST.r0, ST.r0, ST.h0, 128, 1, true), new THREE.MeshStandardMaterial({ map: ban, side: THREE.DoubleSide, roughness: 0.5, emissive: 0xffffff, emissiveMap: ban, emissiveIntensity: 0.25 })); front.position.y = ST.h0 / 2; S.add(front);
  const rTop = ST.r0 + ST.rows * ST.d, yTop = ST.h0 + (ST.rows - 1) * ST.dh, ban2 = ban.clone(); ban2.repeat.set(12, 1); ban2.needsUpdate = true;
  const back = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop, 6, 128, 1, true), new THREE.MeshStandardMaterial({ map: ban2, side: THREE.DoubleSide, roughness: 0.5 })); back.position.y = yTop + 3; S.add(back);
  // the roof ring over the top rows, on slim columns
  const roof = new THREE.Mesh(new THREE.RingGeometry(45, rTop + 1.5, 128, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, side: THREE.DoubleSide })); roof.position.y = yTop + 8; roof.castShadow = w.hq; S.add(roof);
  const ribbon = new THREE.Mesh(new THREE.CylinderGeometry(45, 45, 1.2, 128, 1, true), std(0xff3d8b, { side: THREE.DoubleSide, emissive: 0xff3d8b, emissiveIntensity: 0.4 })); ribbon.position.y = yTop + 7.6; S.add(ribbon);
  const colG = new THREE.CylinderGeometry(0.25, 0.25, yTop + 8, 8), colM = std(0xdedcea, { metalness: 0.6, roughness: 0.3 }), cols = new THREE.InstancedMesh(colG, colM, 24), M = new THREE.Matrix4();
  for (let i = 0; i < 24; i++) { const a = i / 24 * TAU; M.makeTranslation(Math.sin(a) * (rTop + 1), (yTop + 8) / 2, Math.cos(a) * (rTop + 1)); cols.setMatrixAt(i, M); } S.add(cols);
  // floodlight towers
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.sin(a) * 60, z = Math.cos(a) * 60;
    mesh(w, new THREE.CylinderGeometry(0.5, 0.8, 38, 10), std(0xb8bfd0, { metalness: 0.7, roughness: 0.3 }), x, 19, z);
    const head = mesh(w, new THREE.BoxGeometry(7, 3.4, 0.8), std(0xffffff, { emissive: 0xfff6dd, emissiveIntensity: 1.4 }), x, 39, z, { cast: false }); head.lookAt(0, Y0, 0);
    if (w.hq) { const l = new THREE.PointLight(0xfff0dd, 40, 90, 1.6); l.position.set(x * 0.7, 30, z * 0.7); S.add(l); }
  }
  // the big screen floating over the pit, with jets underneath
  app.sb = canvasTexture(1024, 512, () => {}); app.sbG = app.sb.image.getContext('2d');
  const scr = new THREE.Group(); scr.position.set(0, 25, -30); S.add(scr);
  const frameM = std(0x2a1650, { metalness: 0.4, roughness: 0.4 });
  const fr = new THREE.Mesh(new RoundedBox(23.5, 12.5, 1.2, 3, 0.4), frameM); fr.position.z = -0.7; scr.add(fr);
  scr.add(new THREE.Mesh(new THREE.PlaneGeometry(22, 11), new THREE.MeshBasicMaterial({ map: app.sb, toneMapped: false })));
  const glow = new THREE.Mesh(new THREE.TorusGeometry(1.2, 0.25, 8, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6ff3ff }));
  for (const x of [-8, 0, 8]) { const g2 = glow.clone(); g2.position.set(x, -6.8, -0.7); scr.add(g2); }
  const back2 = new THREE.Mesh(new THREE.PlaneGeometry(22, 11), new THREE.MeshBasicMaterial({ map: app.sb, toneMapped: false })); back2.rotation.y = Math.PI; back2.position.z = -1.35; scr.add(back2);
  app.screen = scr;
  // giant balloons bobbing over the stands
  app.balloons = [];
  const bGeo = new THREE.SphereGeometry(2.2, 20, 14);
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU + 0.2, r = 30 + (i % 3) * 8, b = new THREE.Mesh(bGeo, std(new THREE.Color().setHSL(i / 12, 0.85, 0.6), { roughness: 0.25, metalness: 0.1 }));
    b.scale.set(1, 1.18, 1); b.position.set(Math.sin(a) * r, 30 + (i % 4) * 3, Math.cos(a) * r); S.add(b); app.balloons.push({ m: b, y: b.position.y, p: i });
  }
  // confetti cannons on the pit wall
  app.cannons = [];
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + Math.PI / 6, x = Math.sin(a) * 34.6, z = Math.cos(a) * 34.6, g = new THREE.Group(); g.position.set(x, ST.h0, z); g.rotation.y = a + Math.PI; S.add(g);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 16), std(0x2a1650)); base.position.y = 0.3; g.add(base);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 2.6, 16), std(0xffd34d, { metalness: 0.6, roughness: 0.3 })); barrel.position.set(0, 1.5, 0.5); barrel.rotation.x = 0.6; g.add(barrel);
    app.cannons.push(new THREE.Vector3(x - Math.sin(a) * 1.4, ST.h0 + 2.6, z - Math.cos(a) * 1.4));
  }
}
function colorize(g, hex) { const c = new THREE.Color(hex), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
// a round floor painted like a spinning top
function diskTex(cols, centre) {
  return canvasTexture(1024, 1024, (g, W) => {
    const c = W / 2;
    for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % cols.length]; g.beginPath(); g.moveTo(c, c); g.arc(c, c, c, i / 16 * TAU, (i + 1) / 16 * TAU); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 22; g.beginPath(); g.arc(c, c, c - 30, 0, TAU); g.stroke();
    g.lineWidth = 10; g.beginPath(); g.arc(c, c, c * 0.62, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.arc(c, c, c * 0.24, 0, TAU); g.fill();
    g.fillStyle = cols[0]; g.font = '900 150px Manrope, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(centre, c, c + 8);
    for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,0.18)'; g.beginPath(); g.arc(Math.random() * W, Math.random() * W, 4 + Math.random() * 10, 0, TAU); g.fill(); }
  });
}
function stripes(a, b, n = 8) { const t = canvasTexture(256, 64, (g, W, H) => { for (let k = -2; k < n + 2; k++) { g.fillStyle = k % 2 ? a : b; g.beginPath(); g.moveTo(k * W / n, 0); g.lineTo((k + 1) * W / n, 0); g.lineTo((k + 1) * W / n + H, H); g.lineTo(k * W / n + H, H); g.fill(); } }); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; }

// ---------- the arena: one set of meshes per minigame, shown when it is played ----------
function arena(app) {
  const w = app.world, S = w.scene, G = app.G = {};
  const grp = name => { const g = new THREE.Group(); g.visible = false; S.add(g); G[name] = g; return g; };
  const add = (g, geo, mat, x, y, z, cast = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; g.add(m); return m; };
  // round floor (lobby, bomb, koth, coins, spinner) with a foam bumper
  app.diskTex = { lobby: diskTex(['#ff6fa8', '#ffd34d'], '🎉'), bomb: diskTex(['#ff4d4d', '#2b2b3a'], '💣'), koth: diskTex(['#3fcf6a', '#b8f05a'], '👑'), coins: diskTex(['#ffb31a', '#fff0a8'], '🪙'), sweep: diskTex(['#7a5cff', '#4dd8ff'], '🌀') };
  const disk = grp('disk');
  app.diskTop = add(disk, new THREE.CircleGeometry(R, 72).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: app.diskTex.lobby, roughness: 0.45 }), 0, Y0 + 0.005, 0, false);
  const side = stripes('#ff3d8b', '#ffffff'); side.repeat.set(24, 1);
  add(disk, new THREE.CylinderGeometry(R, R * 0.9, 1.6, 72, 1, true), new THREE.MeshStandardMaterial({ map: side, roughness: 0.5, side: THREE.DoubleSide }), 0, Y0 - 0.8, 0);
  add(disk, new THREE.CircleGeometry(R * 0.9, 72).rotateX(Math.PI / 2), std(0x5b2a86), 0, Y0 - 1.6, 0, false);
  const bump = stripes('#ffd34d', '#ff6fa8', 6); bump.repeat.set(40, 1);
  add(disk, new THREE.TorusGeometry(R, 0.32, 10, 96).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: bump, roughness: 0.4 }), 0, Y0 - 0.12, 0);
  // two layers of hex tiles
  G.tiles = new THREE.Group(); S.add(G.tiles); G.tiles.visible = false;
  const hexGeo = new THREE.CylinderGeometry(HS * 0.94, HS * 0.94, 0.45, 6), hexMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.05 });
  app.tileIM = [0, 1].map(L2 => { const im = new THREE.InstancedMesh(hexGeo, hexMat, NT); im.castShadow = im.receiveShadow = true; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); G.tiles.add(im); return im; });
  app.hexMat = hexMat; resetTiles(app);
  // the colour grid
  G.color = new THREE.Group(); S.add(G.color); G.color.visible = false;
  app.sqIM = new THREE.InstancedMesh(new RoundedBox(SQ - 0.15, 0.6, SQ - 0.15, 2, 0.12), new THREE.MeshStandardMaterial({ roughness: 0.3 }), 64); app.sqIM.castShadow = app.sqIM.receiveShadow = true; G.color.add(app.sqIM);
  for (let i = 0; i < 64; i++) app.sqIM.setColorAt(i, new THREE.Color(COLORS[i % 6][0]));
  // King of the Hill: three steps and a golden top, a crown floating above
  const hill = grp('koth');
  add(hill, new THREE.CylinderGeometry(8, 8.2, 0.9, 48), std(0x3fcf6a, { roughness: 0.5 }), 0, Y0 + 0.45, 0);
  add(hill, new THREE.CylinderGeometry(5.5, 5.6, 0.9, 40), std(0xb8f05a, { roughness: 0.5 }), 0, Y0 + 1.35, 0);
  add(hill, new THREE.CylinderGeometry(3, 3.1, 0.9, 32), std(0xffd34d, { metalness: 0.7, roughness: 0.25, emissive: 0x5a3a00, emissiveIntensity: 0.4 }), 0, Y0 + 2.25, 0);
  app.crown = makeCrown(); app.crown.position.set(0, Y0 + 6.5, 0); app.crown.scale.setScalar(2.2); hill.add(app.crown);
  // Bomb Tag: four striped pillars to hide behind
  const pil = grp('bomb'), pm = new THREE.MeshStandardMaterial({ map: stripes('#ff4d4d', '#ffffff', 4), roughness: 0.4 });
  app.pillars = [0, 1, 2, 3].map(i => { const a = i * Math.PI / 2 + Math.PI / 4, x = Math.sin(a) * 8, z = Math.cos(a) * 8; add(pil, new THREE.CylinderGeometry(1, 1, 2.6, 24), pm, x, Y0 + 1.3, z); add(pil, new THREE.SphereGeometry(1.05, 20, 10, 0, TAU, 0, Math.PI / 2), std(0xffd34d), x, Y0 + 2.6, z); const s = { x, z, r: 1, y0: 999, y1: -999 }; w.solids.push(s); return s; });
  // Spinner Jump: a hub and two padded beams
  const sw = grp('sweep');
  add(sw, new THREE.CylinderGeometry(1.2, 1.4, 3, 24), new THREE.MeshStandardMaterial({ map: stripes('#7a5cff', '#ffffff', 4), roughness: 0.4 }), 0, Y0 + 1.5, 0);
  app.hubSolid = { x: 0, z: 0, r: 1.2, y0: 999, y1: -999 }; w.solids.push(app.hubSolid);
  app.beams = [0, 1].map(k => {
    const b = new THREE.Group(); b.position.y = Y0; sw.add(b);
    const bt = stripes('#ff3d3d', '#ffffff', 6); bt.repeat.set(6, 1);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 11.8, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.35 })); pipe.position.set(0, 0.48, 7.1); pipe.castShadow = true; b.add(pipe);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 12), std(0xffd34d)); cap.position.set(0, 0.48, 13.1); b.add(cap);
    b.rotation.y = k * Math.PI; return b;
  });
  // Coin Rush: coins and four bounce pads
  const cg = grp('coins');
  app.coinIM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 20).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xffd34d, metalness: 1, roughness: 0.25, emissive: 0x7a5400, emissiveIntensity: 0.6 }), 150); app.coinIM.instanceMatrix.setUsage(THREE.DynamicDrawUsage); cg.add(app.coinIM);
  for (const [x, z] of PADS) { add(cg, new THREE.CylinderGeometry(1.2, 1.3, 0.2, 28), std(0x1b1d21, { emissive: 0x39d3ff, emissiveIntensity: 1.4 }), x, Y0 + 0.1, z, false); }
  // podium for the results
  const pod = grp('podium'); app.podSpots = [[0, 1.5], [-2.3, 1.0], [2.3, 0.6]];
  app.podSpots.forEach(([x, h], i) => { add(pod, new RoundedBox(2.2, h, 2.2, 2, 0.12), std([0xffd34d, 0xdfe5ee, 0xd08a4a][i], { metalness: 0.5, roughness: 0.3 }), x, Y0 + h / 2, 0); const l = labelSprite(String(i + 1), 0.7, { bg: null, color: '#3a1a5a', weight: 900 }); l.position.set(x, Y0 + h / 2, 1.15); pod.add(l); });
  // a glowing ring and jets under the arena
  app.ring = new THREE.Mesh(new THREE.TorusGeometry(13, 0.35, 10, 96).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6ff3ff })); app.ring.position.y = Y0 - 3.2; S.add(app.ring);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, j = mesh(w, new THREE.ConeGeometry(0.9, 2.4, 16, 1, true), new THREE.MeshBasicMaterial({ color: 0xff9ff3, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }), Math.sin(a) * 9, Y0 - 4.2, Math.cos(a) * 9, { cast: false }); j.rotation.x = Math.PI; }
  // the bomb you carry and the champion's crown
  app.bombPool = []; app.champCrown = makeCrown(); app.champCrown.visible = false; S.add(app.champCrown);
}
function makeCrown() {
  const g = new THREE.Group(), gold = std(0xffd34d, { metalness: 1, roughness: 0.2, emissive: 0x6a4a00, emissiveIntensity: 0.6 });
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.22, 16, 1, true), gold); band.material.side = THREE.DoubleSide; g.add(band);
  for (let i = 0; i < 6; i++) { const a = i / 6 * TAU, c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 6), gold); c.position.set(Math.sin(a) * 0.28, 0.2, Math.cos(a) * 0.28); g.add(c); const gem = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), std([0xff3d6d, 0x3a86ff][i % 2], { emissive: [0xff3d6d, 0x3a86ff][i % 2], emissiveIntensity: 0.8 })); gem.position.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3); g.add(gem); }
  return g;
}
function makeBomb(app) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.36, 18, 14), std(0x1d1d26, { roughness: 0.3, metalness: 0.3 })));
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.14, 10), std(0x666b78, { metalness: 0.8 })); neck.position.y = 0.38; g.add(neck);
  const spark = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd34d })); spark.position.y = 0.52; g.add(spark); g.userData.spark = spark;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.37, 0.03, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xff3d3d })); g.add(ring); g.userData.ring = ring;
  app.world.scene.add(g); return g;
}
function resetTiles(app) {
  const M = new THREE.Matrix4(), c = new THREE.Color(), top = ['#ff7eb6', '#ffd34d', '#ffffff'], low = ['#4dd8ff', '#7a8cff', '#c8f4ff'];
  for (let L2 = 0; L2 < 2; L2++) { const im = app.tileIM[L2]; HEX.forEach(([x, z, ring], i) => { M.makeTranslation(x, (L2 ? Y1 : Y0) - 0.225, z); im.setMatrixAt(i, M); im.setColorAt(i, c.set((L2 ? low : top)[ring % 3])); }); im.instanceMatrix.needsUpdate = true; im.instanceColor.needsUpdate = true; }
  app.fall.fill(0); app.tileAnim.clear();
}

// ---------- the spectator lounge (eliminated players and resting bots watch from here) ----------
function lounge(app) {
  const w = app.world, Lz = (LOUNGE.z0 + LOUNGE.z1) / 2, Lx = LOUNGE.x1 - LOUNGE.x0, Ld = LOUNGE.z1 - LOUNGE.z0;
  mesh(w, new RoundedBox(Lx, 0.8, Ld, 2, 0.15), std(0x3a1d6e, { roughness: 0.5 }), 0, Y0 - 0.4, Lz);
  mesh(w, new THREE.PlaneGeometry(Lx - 0.6, Ld - 0.6).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: stripes('#ff9ccc', '#ffc3e0', 10), roughness: 0.9 }), 0, Y0 + 0.01, Lz, { cast: false });
  for (const x of [-8, 8]) mesh(w, new THREE.CylinderGeometry(0.5, 0.7, Y0 - 0.5, 12), std(0x2a1650), x, (Y0 - 0.5) / 2, Lz);
  // glass rail along the front and sides
  const glass = new THREE.MeshStandardMaterial({ color: 0xbfe9ff, transparent: true, opacity: 0.3, roughness: 0.05, metalness: 0.2 });
  for (const [x, z, sx, sz] of [[0, LOUNGE.z0 + 0.1, Lx, 0.1], [LOUNGE.x0 + 0.1, Lz, 0.1, Ld], [LOUNGE.x1 - 0.1, Lz, 0.1, Ld]]) { mesh(w, new THREE.BoxGeometry(sx, 1.1, sz), glass, x, Y0 + 0.55, z, { cast: false }); w.solids.push({ x, z, hw: sx / 2, hd: sz / 2, rot: 0, y0: Y0 - 1, y1: Y0 + 3 }); }
  // two long sofas
  const sofa = std(0xff3d8b, { roughness: 0.8 });
  for (const x of [-5, 5]) { mesh(w, new RoundedBox(8.6, 0.5, 1, 2, 0.15), sofa, x, Y0 + 0.25, 30.6); mesh(w, new RoundedBox(8.6, 1, 0.35, 2, 0.12), sofa, x, Y0 + 0.75, 31.25); }
  w.grounds.push((x, z, y) => (Math.abs(Math.abs(x) - 5) < 4.3 && Math.abs(z - 30.6) < 0.5 && y > Y0 - 0.6 ? Y0 + 0.5 : null));
  const lab = labelSprite('🍿 ' + L('Spectator Lounge', 'Зрительская ложа'), 0.7, { bg: 'rgba(122,40,200,0.92)', weight: 800 }); lab.position.set(0, Y0 + 3.4, 32); w.scene.add(lab);
}

// ---------- where you can stand ----------
function groundY(app, x, z, y) {
  if (x > LOUNGE.x0 && x < LOUNGE.x1 && z > LOUNGE.z0 && z < LOUNGE.z1 && y > Y0 - 0.6) return Y0;
  const r = Math.hypot(x, z), L2 = app.lay, now = Date.now();
  if (L2 === 'tiles') {
    const i = hexAt(x, z); if (i < 0) return null;
    if (y >= Y0 - 1.2 && !(app.fall[i] && now >= app.fall[i])) return Y0;
    if (y >= Y1 - 1.2 && !(app.fall[NT + i] && now >= app.fall[NT + i])) return Y1;
    return null;
  }
  if (L2 === 'color') { const i = sqAt(x, z); return i >= 0 && sqSolid(app, i, now) ? Y0 : null; }
  if (L2 === 'sweep') return r < 13 ? Y0 : null;
  if (r >= R) return null;
  if (L2 === 'koth') return r < 3 ? Y0 + 2.7 : r < 5.5 ? Y0 + 1.8 : r < 8 ? Y0 + 0.9 : Y0;
  if (L2 === 'podium') for (const [px, h] of app.podSpots) if (Math.abs(x - px) < 1.1 && Math.abs(z) < 1.1) return Y0 + h;
  return Y0;
}
function sqSolid(app, i, now) {
  const P = app.P; if (!P || P.ph !== 'play') return true;
  const t = (now - P.start) / 1000, W = cWave(t); if (t < W.drop || t >= W.back) return true;
  return cLayout(app, P, W.k).cols[i] === cLayout(app, P, W.k).c;
}
function setLayout(app, name) {
  if (app.lay === name) return; app.lay = name; const G = app.G;
  G.disk.visible = !['tiles', 'color'].includes(name);
  G.disk.scale.set(name === 'sweep' ? 13 / R : 1, 1, name === 'sweep' ? 13 / R : 1);
  app.diskTop.material.map = app.diskTex[name] || app.diskTex.lobby; app.diskTop.material.needsUpdate = true;
  for (const k of ['tiles', 'color', 'koth', 'bomb', 'sweep', 'coins', 'podium']) G[k].visible = k === name;
  for (const s of app.pillars) { s.y0 = name === 'bomb' ? Y0 - 1 : 999; s.y1 = name === 'bomb' ? Y0 + 2.6 : -999; }
  app.hubSolid.y0 = name === 'sweep' ? Y0 - 1 : 999; app.hubSolid.y1 = name === 'sweep' ? Y0 + 3 : -999;
  app.world.renderer.shadowMap.needsUpdate = true;
}

// ---------- the host runs the party ----------
function push(app, nv) { nv.hp = app.me.pid; setP(app, nv); app.net.setState('party', nv); app._kp = Date.now(); }
const freshMatch = (app, now, m) => ({ ph: 'lobby', m, r: 0, start: now, phaseEnds: now + T_LOBBY, sc: {}, nm: {}, who: {}, alive: [], out: [], used: [], rp: {}, hold: [], pt: {} });
function hostTick(app, now, dt) {
  let P = app.P;
  if (!P) { if (now - app.t0 > 2500) push(app, freshMatch(app, now, 1)); return; }
  if (P.ph === 'lobby' && now >= P.phaseEnds) newRound(app, now);
  else if (P.ph === 'intro' && now >= P.phaseEnds) startPlay(app, now);
  else if (P.ph === 'play') playTick(app, now);
  else if (P.ph === 'results' && now >= P.phaseEnds) { if (P.r >= ROUNDS) champ(app, now); else newRound(app, now); }
  else if (P.ph === 'champ' && now >= P.phaseEnds) push(app, freshMatch(app, now, P.m + 1));
  P = app.P;
  if (now - (app._kp || 0) > 1500) { app.net.setState('party', { ...P, hp: app.me.pid }); app._kp = now; }
  botsHost(app, dt, now);
}
function newRound(app, now) {
  const P = app.P, used = P.r >= ROUNDS || !P.r ? [] : P.used || [];
  let g = P.next && GAMES[P.next] ? P.next : null;
  if (!g) { const pool = GIDS.filter(x => !used.includes(x)), from = pool.length ? pool : GIDS; g = from[Math.floor(Math.random() * from.length)]; }
  const who = { [app.me.pid]: app.me.name };
  for (const id in app.players) if (app.players[id] && app.players[id].name) who[id] = app.players[id].name;
  const nb = Math.max(5, BOTS.length - (Object.keys(who).length - 1));
  BOTS.slice(0, nb).forEach((n, i) => (who['bot' + i] = '🤖 ' + n));
  app.endAt = 0; app.cred.clear();
  push(app, { ...P, ph: 'intro', g, r: P.r >= ROUNDS ? 1 : (P.r || 0) + 1, start: now, phaseEnds: now + T_INTRO, who, alive: Object.keys(who), out: [], rp: {}, seed: Math.floor(Math.random() * 1e9), x2: !!P.x2n, x2n: false, next: null, used: [...used, g], hold: [], fuse: 0, boom: 0, pt: {}, beam: [0, 0, P.turboN ? 1.8 : 1], turboN: false, cOver: null, gain: null, place: null, pod: null });
}
function startPlay(app, now) { const P = app.P; push(app, { ...P, ph: 'play', start: now, phaseEnds: now + GAMES[P.g].dur * 1000 }); }
function hostOut(app, ids) {
  const P = app.P; if (!P || P.ph !== 'play') return;
  const set = new Set(ids.filter(id => P.alive.includes(id))); if (!set.size) return;
  push(app, { ...P, alive: P.alive.filter(id => !set.has(id)), out: [...P.out, ...set] });
}
function playTick(app, now) {
  let P = app.P; const t = now - P.start, G = GAMES[P.g];
  const gone = P.alive.filter(id => !isBot(id) && id !== app.me.pid && !app.players[id]);
  if (gone.length) { hostOut(app, gone); P = app.P; }
  if (P.g === 'bomb') bombTick(app, now, t);
  if (P.g === 'koth' && now - (app._kt || 0) > 500) {
    app._kt = now; const rp = { ...P.rp }; let ch = false;
    for (const id of P.alive) { const p = hostPos(app, id); if (p && Math.hypot(p.x, p.z) < 3.1 && p.y > Y0 + 2.4) { rp[id] = (rp[id] || 0) + 1; ch = true; } }
    if (ch) push(app, { ...app.P, rp });
  }
  P = app.P;
  if (G.elim && ((P.alive.length <= 1 && Object.keys(P.who).length > 1) || !P.alive.length)) app.endAt = app.endAt || now + 1800;
  if (t >= G.dur * 1000 || (app.endAt && now >= app.endAt)) endPlay(app, now);
}
function bombTick(app, now, t) {
  let P = app.P;
  // a bomb whose holder fell off goes to someone else
  const lost = P.hold.filter(h => !P.alive.includes(h));
  if (lost.length && P.hold.length) { const free = P.alive.filter(id => !P.hold.includes(id)); P = { ...P, hold: P.hold.map(h => (P.alive.includes(h) ? h : free.splice(Math.floor(Math.random() * free.length), 1)[0])).filter(Boolean) }; push(app, P); }
  if (!P.hold.length || t >= P.fuse) {
    let alive = P.alive, out = P.out, boom = P.boom || 0;
    if (P.hold.length) { alive = alive.filter(id => !P.hold.includes(id)); out = [...out, ...P.hold]; boom++; }
    const n = alive.length, hold = n > 1 ? [...alive].sort(() => Math.random() - 0.5).slice(0, Math.max(1, Math.min(n - 1, Math.floor(n / 4)))) : [];
    push(app, { ...P, alive, out, hold, boom, fuse: t + Math.max(9, 17 - boom * 2) * 1000, pt: {}, booms: P.hold.length ? P.hold : null });
    return;
  }
  for (const h of P.hold) {
    if (t - (P.pt[h] ?? -9999) < 700) continue;
    const hp = hostPos(app, h); if (!hp) continue;
    let best = null, bd = 1.35;
    for (const o of P.alive) { if (P.hold.includes(o)) continue; const op = hostPos(app, o); if (!op || Math.abs(op.y - hp.y) > 1.8) continue; const d = Math.hypot(op.x - hp.x, op.z - hp.z); if (d < bd) { bd = d; best = o; } }
    if (best) { push(app, { ...P, hold: P.hold.map(x => (x === h ? best : x)), pt: { ...P.pt, [best]: t }, pass: [h, best, t] }); return; }
  }
}
function endPlay(app, now) {
  const P = app.P, G = GAMES[P.g], ids = Object.keys(P.who), place = {};
  if (G.elim) { P.alive.forEach(id => (place[id] = 0)); [...P.out].reverse().forEach((id, i) => (place[id] = P.alive.length + i)); ids.forEach(id => { if (place[id] === undefined) place[id] = ids.length - 1; }); }
  else { const s = ids.map(id => [id, P.rp[id] || 0]).sort((a, b) => b[1] - a[1]); s.forEach(([id, v], i) => (place[id] = i && v === s[i - 1][1] ? place[s[i - 1][0]] : i)); }
  const gain = {}, sc = { ...P.sc }, nm = { ...P.nm };
  for (const id of ids) { gain[id] = (!G.elim && !(P.rp[id] > 0) ? 1 : PTS[place[id]] ?? 1) * (P.x2 ? 2 : 1); sc[id] = (sc[id] || 0) + gain[id]; nm[id] = P.who[id]; }
  const pod = ids.slice().sort((a, b) => place[a] - place[b]).slice(0, 3);
  app.endAt = 0;
  push(app, { ...P, ph: 'results', start: now, phaseEnds: now + T_RES, gain, place, sc, nm, pod, hold: [] });
}
function champ(app, now) {
  const P = app.P, top = Object.entries(P.sc).sort((a, b) => b[1] - a[1]);
  push(app, { ...P, ph: 'champ', start: now, phaseEnds: now + T_CHAMP, pod: top.slice(0, 3).map(x => x[0]), champ: top[0] ? top[0][0] : null });
}
function hostPos(app, id) { if (id === app.me.pid) return app.world.me.group.position; if (isBot(id)) return app.sim[id] || app.botAv[id]?.group.position; const r = app.world.remotes[id]; return r ? r.pos : null; }
function posOf(app, id) { if (id === app.me.pid) return app.world.me.group.position; if (app.botAv[id]) return app.botAv[id].group.position; const r = app.world.remotes[id]; return r ? r.av.group.position : null; }
const keyOf = P => (P ? P.m * 100 + P.r : 0);

// ---------- everyone follows the state ----------
function setP(app, nv) {
  const old = app.P || {}; app.P = nv;
  const me = app.me.pid, k = keyOf(nv), ok = keyOf(old);
  if (nv.ph !== old.ph || k !== ok) enter(app, nv, old);
  else if (nv.ph === 'play') {
    const was = new Set(old.alive || []), oldOut = new Set(old.out || []);
    for (const id of nv.out) if (!oldOut.has(id)) outFx(app, id, nv);
    if (was.has(me) && !nv.alive.includes(me)) meOut(app, nv, nv.booms && nv.booms.includes(me) ? 'boom' : '');
    if (!was.has(me) && nv.alive.includes(me)) revived(app, nv);
    if (nv.pass && String(nv.pass) !== String(old.pass)) { app.sfx('pop'); if (nv.pass[1] === me) big(app, '💣 ' + L('YOU HAVE THE BOMB!', 'У ТЕБЯ БОМБА!') + `<small>${L('Touch someone to pass it!', 'Коснись кого-нибудь, чтобы передать!')}</small>`, 'bomb', 2200); else if (nv.pass[0] === me) ui.toast('😅 ' + L('Passed it on!', 'Передал!')); }
    if (nv.hold && String(nv.hold) !== String(old.hold) && !nv.pass && nv.hold.includes(me)) big(app, '💣 ' + L('YOU HAVE THE BOMB!', 'У ТЕБЯ БОМБА!'), 'bomb', 2200);
    if (nv.booms && String(nv.booms) !== String(old.booms)) { nv.booms.forEach(id => { const p = posOf(app, id); if (p) boomFx(app, p); }); if (nv.hold.includes(me)) big(app, '💣 ' + L('YOU HAVE THE BOMB!', 'У ТЕБЯ БОМБА!'), 'bomb', 2200); }
  }
}
function enter(app, P, old) {
  const w = app.world, me = app.me.pid, k = keyOf(P), inR = !!(P.who && P.who[me]);
  w.frozenUntil = 0; app.champCrown.visible = false;
  if (P.ph === 'intro' || P.ph === 'play') {
    if (app.roundK !== k) { // a new minigame: build its arena and line everyone up
      app.roundK = k; app.outK = 0; resetTiles(app); app.taken.clear(); app._mth = undefined; setLayout(app, P.g);
      if (inR) { const [x, z] = slot(P, me); w.teleport(x, z, Math.atan2(x, z)); specOff(app); } else { toLounge(app); specOn(app); }
    }
    if (P.ph === 'intro') { w.frozenUntil = performance.now() + Math.max(0, P.phaseEnds - Date.now()); roulette(app, P); app.sfx('drumroll'); }
    else { big(app, L('GO!', 'ВПЕРЁД!'), 'huge', 1100); app.sfx('go'); hype(app, 3000); if (inR && !P.alive.includes(me)) { app.outK = k; toLounge(app); specOn(app); } }
    return;
  }
  app.roundK = 0; specOff(app);
  if (P.ph === 'lobby') {
    setLayout(app, 'lobby'); toLobby(app);
    ui.banner(`🎉 ${L('Match', 'Матч')} ${P.m}! ${L('5 minigames, the most points wins!', '5 мини-игр, побеждает больше всех очков!')}`, 3500);
    return;
  }
  // results / champion: everyone gathers round the podium
  setLayout(app, 'podium');
  const pi = (P.pod || []).indexOf(me);
  if (pi >= 0) { const [x] = app.podSpots[pi]; w.teleport(x, 0, 0); } else toLobby(app, 5);
  if (P.ph === 'results') {
    const G = GAMES[P.g], g = P.gain && P.gain[me], top = P.pod && P.pod[0];
    ui.banner(`${G.icon} ${top ? (P.nm[top] || '') + ' ' + L('wins the round!', 'выигрывает раунд!') : L('Round over!', 'Раунд окончен!')}`, 3500);
    if (g) { big(app, `+${g} ⭐<small>${L('points this round', 'очков за раунд')}${P.x2 ? ' ✖️2' : ''}</small>`, '', 2600); const prize = [30, 20, 10][P.place[me]] || 5; app.coins.bonus(prize); }
    app.sfx(pi === 0 ? 'cheer' : 'ding'); hype(app, 3000);
  } else {
    const c = P.champ, mine = c === me, pl = (P.pod || []).indexOf(me);
    big(app, `🏆 ${esc((P.nm && P.nm[c]) || '?')}<small>${L('is the PARTY CHAMPION!', '— ЧЕМПИОН ВЕЧЕРИНКИ!')}</small>`, '', 5000);
    app.sfx('champions'); w.fireworks(14, new THREE.Vector3(0, Y0, 0)); fireCannons(app); hype(app, 10000); app.people.wave = true; setTimeout(() => (app.people.wave = false), 12000);
    if (pl >= 0 && P.who && P.sc[me]) { const prize = [300, 150, 75][pl]; app.coins.bonus(prize); ui.toast(`🏆 ${L('Prize', 'Приз')} +${money(prize)}`); }
    if (mine) confetti(160);
    // a slow camera orbit round the podium
    const t0 = performance.now();
    w.cameraOverride = (cam, dt) => { const tt = (performance.now() - t0) / 1000; if (tt > 7 || app.P.ph !== 'champ') { w.cameraOverride = null; return; } const a = tt * 0.45; cam.position.lerp(new THREE.Vector3(Math.sin(a) * 9, Y0 + 4, Math.cos(a) * 9 + 1), Math.min(1, dt * 3)); cam.lookAt(0, Y0 + 2, 0); };
  }
}
function slot(P, id) { const ids = Object.keys(P.who), i = Math.max(0, ids.indexOf(id)), a = i / ids.length * TAU + 0.3, r = { tiles: 9, color: 8, bomb: 11, koth: 13.5, sweep: 8.5, coins: 11 }[P.g] || 10; return [Math.sin(a) * r, Math.cos(a) * r]; }
function toLobby(app, rmin = 0) { const a = Math.random() * TAU, d = rmin + Math.random() * (12 - rmin), x = Math.sin(a) * d, z = Math.cos(a) * d; app.world.teleport(x, z, 0); }
function toLounge(app) { app.world.teleport(-8 + Math.random() * 16, 27 + Math.random() * 2, 0); }
function meOut(app, P, why) {
  const k = keyOf(P); if (app.outK === k) return; app.outK = k;
  const place = P.alive.length + 1;
  big(app, `💥 ${L('ELIMINATED!', 'ВЫБЫЛ!')}<small>${L('You finished', 'Твоё место')} #${place} · ${L('watch from the lounge', 'смотри из ложи')} 🎥</small>`, '', 3000);
  app.sfx('aww');
  if (why === 'boom') { const p = app.world.me.group.position; fling(app, (Math.random() - 0.5) * 6, 14, (Math.random() - 0.5) * 6, 1.2); boomFx(app, p); }
  setTimeout(() => { if (keyOf(app.P) === k && app.P.ph === 'play' && !app.P.alive.includes(app.me.pid)) { toLounge(app); specOn(app); } }, 1800);
}
function revived(app, P) { app.outK = 0; specOff(app); const [x, z] = safeSpot(app, P, app.me.pid); app.world.teleport(x, z, Math.atan2(x, z)); big(app, '💖 ' + L('REVIVED!', 'ВОСКРЕШЁН!'), '', 1500); app.sfx('star'); }
function safeSpot(app, P, id) {
  if (P.g === 'tiles') { const ok = HEX.map((h, i) => i).filter(i => !app.fall[i] || !app.fall[NT + i]); const i = ok[Math.floor(Math.random() * ok.length)]; if (i !== undefined) return [HEX[i][0], HEX[i][1]]; }
  return slot(P, id);
}
function outFx(app, id, P) {
  const n = P.alive.length, name = (P.who && P.who[id]) || '?';
  if (id !== app.me.pid) ui.toast(`💥 ${name} ${L('is out!', 'выбыл!')} · ${n} ${L('left', 'осталось')}`);
  hype(app, 1500);
}

// ---------- events ----------
function onEv(app, ev) {
  const d = ev.data || {}, P = app.P; if (!P) return; const k = keyOf(P);
  if (ev.type === 'pb') { if (!app.isHost() && d.b) botsIn(app, d); }
  else if (ev.type === 'pt') { if (d.k === k && d.i) d.i.forEach(i => markTile(app, i)); }
  else if (ev.type === 'pout') { if (app.isHost() && d.k === k) hostOut(app, [d.id]); }
  else if (ev.type === 'pshove') { if (d.id !== app.me.pid && !(app.isHost() && isBot(d.id))) applyShove(app, d); }
  else if (ev.type === 'pcoin') { if (d.k === k) coinIn(app, d); }
}
function markTile(app, gi) {
  if (app.fall[gi]) return;
  app.fall[gi] = Date.now() + (app.instantUntil > Date.now() ? 120 : 1200); app.tileAnim.add(gi);
  const L2 = gi >= NT ? 1 : 0; app.tileIM[L2].setColorAt(gi % NT, new THREE.Color(0xff6a2a)); app.tileIM[L2].instanceColor.needsUpdate = true;
}
function coinIn(app, d) {
  app.taken.add(d.i);
  if (app.isHost() && !app.cred.has(d.i) && app.P.ph === 'play' && app.P.g === 'coins') { app.cred.add(d.i); const c = coinList(app, app.P)[d.i]; push(app, { ...app.P, rp: { ...app.P.rp, [d.id]: (app.P.rp[d.id] || 0) + (c ? c.v : 1) } }); }
}
// a shove pushes everyone near the shover away (players push themselves, the host pushes the bots)
function shove(app) {
  const P = app.P, w = app.world, p = w.me.group.position, now = Date.now();
  if (!P || now < (app.shoveCd || 0) || w.inputLocked || performance.now() < w.frozenUntil) return;
  if (P.ph === 'play' && !P.alive.includes(app.me.pid)) return;
  app.shoveCd = now + 1200; const d = { k: keyOf(P), id: app.me.pid, x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2) };
  app.emit('pshove', d); applyShove(app, d); w.me.play('cheer'); app.emoteSig = 'cheer:' + now;
}
function applyShove(app, d) {
  const w = app.world, P = app.P;
  ringFx(app, d.x, d.y, d.z); app.sfx('boing');
  if (P && P.ph === 'play' && !P.alive.includes(d.id)) return;
  const p = w.me.group.position;
  if (d.id !== app.me.pid) { const dx = p.x - d.x, dz = p.z - d.z, dd = Math.hypot(dx, dz); if (dd < 2.6 && Math.abs(p.y - d.y) < 1.6) { w.vel.x += dx / (dd || 1) * 9.5; w.vel.z += dz / (dd || 1) * 9.5; w.vel.y = 5.5; w.onGround = false; ui.toast('💨 ' + L('Shoved!', 'Толкнули!')); } }
  if (app.isHost()) for (const id in app.sim) { if (id === d.id) continue; const b = app.sim[id], dx = b.x - d.x, dz = b.z - d.z, dd = Math.hypot(dx, dz); if (dd < 2.6 && Math.abs(b.y - d.y) < 1.6 && !b.bench) { b.vx += dx / (dd || 1) * 9.5; b.vz += dz / (dd || 1) * 9.5; b.vy = 5.5; b.ground = false; } }
}
// thrown through the air (swept by the beam, blown up by a bomb)
function fling(app, vx, vy, vz, dur) {
  const w = app.world, v = { x: vx, y: vy, z: vz }; let t = 0;
  w.carrier = { update: (dt, p, meAv) => { t += dt; p.x += v.x * dt; p.y += v.y * dt; p.z += v.z * dt; v.y -= 22 * dt; meAv.group.rotation.y += dt * 12; meAv.animate(0, dt, true); return t > dur; }, onCancel: () => {} };
}

// ---------- my part of each minigame ----------
function myTick(app, now) {
  const P = app.P, w = app.world, p = w.me.group.position, me = app.me.pid; if (!P) return;
  const k = keyOf(P), alive = P.ph === 'play' && P.alive.includes(me), t = (now - P.start) / 1000, G = GAMES[P.g] || {};
  if (p.y < 4 && !w.carrier) {
    if (alive && G.elim) { if (app.outK !== k) { app.emit('pout', { k, id: me }); if (app.isHost()) hostOut(app, [me]); meOut(app, P); } }
    else if (!app._resp || now > app._resp) { app._resp = now + 1500; setTimeout(() => respawnMe(app), 900); }
  }
  if (app.bounceUntil > now && w.onGround && p.y > 5) { w.vel.y = 11; w.onGround = false; }
  if (!alive) return;
  if (P.g === 'tiles' && w.onGround) {
    const L2 = Math.abs(p.y - Y0) < 0.4 ? 0 : Math.abs(p.y - Y1) < 0.4 ? 1 : -1, i = L2 >= 0 ? hexAt(p.x, p.z) : -1;
    if (i >= 0 && !app.fall[L2 * NT + i]) { markTile(app, L2 * NT + i); app.emit('pt', { k, i: [L2 * NT + i] }); }
  }
  if (P.g === 'sweep' && t > 0) {
    const th = beamAng(P, now), prev = app._mth ?? th; app._mth = th;
    const r = Math.hypot(p.x, p.z), phi = Math.atan2(p.x, p.z);
    if (p.y - Y0 < 0.75 && r > 1.3 && r < 13.4 && !w.carrier) for (let a = 0; a < (t > 25 ? 2 : 1); a++) if (crossed(phi, prev + a * Math.PI, th + a * Math.PI, r)) {
      const bt = th + a * Math.PI, tx = Math.cos(bt), tz = -Math.sin(bt);
      fling(app, tx * 10 + p.x / r * 7, 7, tz * 10 + p.z / r * 7, 1.1); app.sfx('bonk'); big(app, '🌀 ' + L('SWEPT!', 'СБИЛО!'), '', 1200); break;
    }
  }
  if (P.g === 'coins') {
    coinList(app, P).forEach((c, i) => { if (coinOn(app, c, i, t) && Math.abs(p.x - c.x) < 1.1 && Math.abs(p.z - c.z) < 1.1 && Math.abs(p.y - Y0) < 1.8) { const d = { k, i, id: me }; coinIn(app, d); app.emit('pcoin', d); app.coins.bonus(c.v, false); app.sfx('coin'); } });
    for (const [x, z] of PADS) if (w.onGround && Math.hypot(p.x - x, p.z - z) < 1.3 && Math.abs(p.y - Y0) < 0.3) { w.vel.y = 13; w.onGround = false; app.sfx('boing'); }
  }
}
// did the beam pass over this angle since last frame? (it spins the +angle way)
function crossed(phi, a0, a1, r) { const d0 = wrap(phi - a0), d1 = wrap(phi - a1); return (d0 >= 0 && d1 <= 0 && d0 - d1 < 1.5) || Math.abs(d1) * r < 0.4; }
function respawnMe(app) {
  const P = app.P, me = app.me.pid; if (!P) return; if (app.world.me.group.position.y > 4) return;
  if (P.ph === 'play' && P.who[me]) { if (P.alive.includes(me)) { const a = Math.random() * TAU; app.world.teleport(Math.sin(a) * 13.5, Math.cos(a) * 13.5, a); } else toLounge(app); }
  else if (P.ph === 'intro' && P.who[me]) { const [x, z] = slot(P, me); app.world.teleport(x, z, Math.atan2(x, z)); }
  else if (P.ph === 'play' || P.ph === 'intro') toLounge(app);
  else toLobby(app);
}

// ---------- bots (the host thinks for them and tells everyone where they are) ----------
function botsSetup(app) {
  app.botAv = {};
  BOTS.forEach((n, i) => {
    const av = new Avatar(randomAvatar(), n, 'bot'), lab = labelSprite('🤖 ' + n, 0.3, { bg: 'rgba(40,16,80,0.75)', weight: 700 }); lab.position.y = 2.35; av.group.add(lab);
    const a = i / BOTS.length * TAU; av.group.position.set(Math.sin(a) * 9, Y0, Math.cos(a) * 9); app.world.scene.add(av.group); app.botAv['bot' + i] = av;
  });
}
function simNew(app, id) { const g = app.botAv[id].group.position, i = +id.slice(3); return { id, i, x: g.x, y: g.y, z: g.z, vx: 0, vy: 0, vz: 0, wx: 0, wz: 0, ry: 0, ground: false, skill: 0.45 + ((i * 37) % 50) / 100, think: 0, tx: 0, tz: 0, tgt: -1, anim: 0, spd: 0 }; }
function botsHost(app, dt, now) {
  const P = app.P; if (!P) return; const ph = P.ph, inPlay = ph === 'intro' || ph === 'play', t = (now - P.start) / 1000, k = keyOf(P);
  if (app.simK !== k + ph) { // a new phase: line the bots up
    app.simK = k + ph;
    for (const id in app.botAv) { const b = app.sim[id] ||= simNew(app, id); b.tgt = -1; b.react = null; b.ck = -1; b.fling = 0; b.resp = 0;
      if (ph === 'intro' && P.who[id]) { [b.x, b.z] = slot(P, id); b.y = Y0 + 0.3; b.bench = false; b.ry = Math.atan2(-b.x, -b.z); }
      else if (ph === 'results' || ph === 'champ') { const pi = (P.pod || []).indexOf(id); b.bench = false; if (pi >= 0) { b.x = app.podSpots[pi][0]; b.z = 0; b.y = Y0 + app.podSpots[pi][1]; b.ry = 0; } else { const a = Math.random() * TAU, d = 5 + Math.random() * 8; b.x = Math.sin(a) * d; b.z = Math.cos(a) * d; b.y = Y0 + 0.3; } }
      else if (ph === 'lobby') { if (b.bench || b.y < Y0 - 1) { const a = Math.random() * TAU; b.x = Math.sin(a) * 8; b.z = Math.cos(a) * 8; b.y = Y0 + 0.3; } b.bench = false; } }
  }
  const sweeping = ph === 'play' && P.g === 'sweep', th = sweeping ? beamAng(P, now) : 0, prevTh = app._hth ?? th; app._hth = th;
  for (const id in app.botAv) {
    const b = app.sim[id] ||= simNew(app, id), part = inPlay && P.who[id], alive = part && (ph === 'intro' || P.alive.includes(id));
    if (inPlay && !alive) { if (!b.outAt) b.outAt = now; if (!part || now - b.outAt > 1600) { bench(b, now); continue; } }
    else b.outAt = 0;
    if (b.bench) { b.bench = false; const [x, z] = alive ? safeSpot(app, P, id) : [0, 8]; b.x = x; b.z = z; b.y = Y0 + 0.5; b.vy = 0; }
    b.think -= dt;
    if (ph === 'intro' || b.resp > now) { b.wx = b.wz = 0; b.anim = 0; }
    else brain(app, b, id, t, now, dt);
    botPhys(app, b, dt, now);
    if (sweeping && alive && !(b.fling > 0) && b.y - Y0 < 0.75) { const r = Math.hypot(b.x, b.z), phi = Math.atan2(b.x, b.z); if (r > 1.3 && r < 13.4) for (let a = 0; a < (t > 25 ? 2 : 1); a++) if (crossed(phi, prevTh + a * Math.PI, th + a * Math.PI, r)) { const bt = th + a * Math.PI; b.fling = 1.1; b.vx = Math.cos(bt) * 10 + b.x / r * 7; b.vz = -Math.sin(bt) * 10 + b.z / r * 7; b.vy = 7; break; } }
    // fell into the slime
    if (b.y < 3 && !b.resp && (alive || !inPlay)) {
      if (ph === 'play' && alive && GAMES[P.g].elim) hostOut(app, [id]);
      else { b.resp = now + 1200; }
    }
    if (b.resp && now > b.resp) { b.resp = 0; b.vx = b.vy = b.vz = 0; if (ph === 'play' && alive) { const a = Math.random() * TAU; b.x = Math.sin(a) * 13.5; b.z = Math.cos(a) * 13.5; } else { const a = Math.random() * TAU; b.x = Math.sin(a) * 8; b.z = Math.cos(a) * 8; } b.y = Y0 + 1; }
    // stepping on tiles and grabbing coins
    if (ph === 'play' && alive && P.g === 'tiles' && b.ground) { const L2 = Math.abs(b.y - Y0) < 0.4 ? 0 : Math.abs(b.y - Y1) < 0.4 ? 1 : -1, i = L2 >= 0 ? hexAt(b.x, b.z) : -1; if (i >= 0 && !app.fall[L2 * NT + i]) { markTile(app, L2 * NT + i); (app.tq ||= []).push(L2 * NT + i); } }
    if (ph === 'play' && P.g === 'coins') coinList(app, P).forEach((c, i) => { if (coinOn(app, c, i, t) && Math.abs(b.x - c.x) < 1.1 && Math.abs(b.z - c.z) < 1.1) { const d = { k, i, id }; coinIn(app, d); app.emit('pcoin', d); } });
  }
  // bots don't walk through each other or through players
  const ids = Object.keys(app.sim), others = [app.world.me.group.position, ...Object.values(app.world.remotes).map(r => r.pos)];
  for (let a = 0; a < ids.length; a++) { const b = app.sim[ids[a]]; if (b.bench || b.fling > 0) continue;
    for (let c = a + 1; c < ids.length; c++) { const o = app.sim[ids[c]]; if (o.bench || o.fling > 0) continue; const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz); if (d < 0.8 && d > 0.001 && Math.abs(b.y - o.y) < 1.5) { const s = (0.8 - d) / 2; b.x += dx / d * s; b.z += dz / d * s; o.x -= dx / d * s; o.z -= dz / d * s; } }
    for (const o of others) { const dx = b.x - o.x, dz = b.z - o.z, d = Math.hypot(dx, dz); if (d < 0.8 && d > 0.001 && Math.abs(b.y - o.y) < 1.5) { b.x += dx / d * (0.8 - d); b.z += dz / d * (0.8 - d); } } }
  if (now - (app._pb || 0) > 150) {
    app._pb = now; app.emit('pb', { b: Object.keys(app.botAv).map(id => { const b = app.sim[id]; return [+b.x.toFixed(2), +b.y.toFixed(2), +b.z.toFixed(2), +b.ry.toFixed(2), b.anim, b.ground ? 0 : 1]; }) });
    if (app.tq && app.tq.length) { app.emit('pt', { k, i: app.tq }); app.tq = []; }
  }
}
function bench(b, now) { b.bench = true; b.x = -9 + b.i * 2; b.z = 30.7; b.y = Y0 + 0.4; b.ry = Math.PI; b.vx = b.vy = b.vz = 0; b.anim = Math.sin(now / 900 + b.i * 2) > 0.85 ? 2 : 3; b.ground = true; }
function go(b, x, z, sp) { const dx = x - b.x, dz = z - b.z, d = Math.hypot(dx, dz); if (d < 0.2) { b.wx = b.wz = 0; return d; } const s = Math.min(sp, d * 5); b.wx = dx / d * s; b.wz = dz / d * s; return d; }
function wander(b, rad, sp) { if (b.think <= 0) { const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * rad; b.tx = Math.sin(a) * d; b.tz = Math.cos(a) * d; b.think = 2 + Math.random() * 3; } if (go(b, b.tx, b.tz, sp) < 0.3) b.wx = b.wz = 0; }
function brain(app, b, id, t, now, dt) {
  const P = app.P; b.anim = 0;
  if (app.danceUntil > now) { b.wx = b.wz = 0; b.anim = 1; return; }
  if (P.ph !== 'play') {
    if ((P.pod || []).includes(id) && (P.ph === 'results' || P.ph === 'champ')) { b.wx = b.wz = 0; b.anim = 2; return; }
    wander(b, 11, 2.2); if (Math.hypot(b.wx, b.wz) < 0.1 && (b.i + Math.floor(now / 4000)) % 5 === 0) b.anim = P.ph === 'lobby' ? 4 : 1; return;
  }
  const r = Math.hypot(b.x, b.z);
  if (P.g === 'tiles') {
    const L2 = b.y > (Y0 + Y1) / 2 - 1 ? 0 : 1, i = hexAt(b.x, b.z), base = L2 * NT;
    if (!b.ground) { if (b.tgt >= 0) go(b, HEX[b.tgt][0], HEX[b.tgt][1], b.far ? 6.2 : 5.2); return; }
    if (b.tgt >= 0) { const [x, z] = HEX[b.tgt], f = app.fall[base + b.tgt]; if (f && f - now < 250) b.tgt = -1; else { if (go(b, x, z, b.far ? 6.2 : 5.2) < 0.35) b.tgt = -1; return; } }
    if (i < 0) { go(b, 0, 0, 4); return; }
    b.wx = b.wz = 0;
    if (app.fall[base + i]) {
      if (b.react == null || b.rt !== base + i) b.rt = base + i, b.react = app.fall[base + i] - (0.28 + b.skill * 0.3 - (Math.random() < 0.015 ? 0.5 : 0)) * 1000; // wait until the tile is about to go
      if (now >= b.react) { b.react = null; let c = NB[i].filter(j => !app.fall[base + j]); b.far = false; if (!c.length && Math.random() < b.skill) { c = NB2[i].filter(j => !app.fall[base + j]); b.far = true; } if (c.length) { const free = j => NB[j].filter(m => !app.fall[base + m]).length + Math.random() * 2 * (1 - b.skill); c.sort((x, y) => free(y) - free(x)); b.tgt = c[0]; go(b, HEX[b.tgt][0], HEX[b.tgt][1], b.far ? 6.2 : 5.2); if (b.far) b.jump = true; } }
    }
    return;
  }
  if (P.g === 'color') {
    const W = cWave(t), lay = cLayout(app, P, W.k);
    if (t >= W.call && t < W.back) {
      if (b.ck !== W.k) { b.ck = W.k; b.react = now + (0.2 + (1 - b.skill) * 2 + Math.random() * 0.3) * 1000; b.wrong = Math.random() < 0.03 + 0.2 * (1 - b.skill); b.tgt = -1; }
      if (now < b.react) { b.wx *= 0.9; b.wz *= 0.9; return; }
      const want = b.wrong ? (lay.c + 1) % 6 : lay.c, cur = sqAt(b.x, b.z);
      if (b.tgt < 0 || lay.cols[b.tgt] !== want) { let best = -1, bd = 1e9; for (let i = 0; i < 64; i++) if (lay.cols[i] === want) { const [x, z] = sqXZ(i), d = Math.hypot(x - b.x, z - b.z) + Math.random() * 0.8; if (d < bd) { bd = d; best = i; } } b.tgt = best; b.off = [(Math.random() - 0.5) * 1.6, (Math.random() - 0.5) * 1.6]; }
      if (b.tgt >= 0) { const [x, z] = sqXZ(b.tgt); if (cur === b.tgt && Math.hypot(x - b.x, z - b.z) < 1.2) b.wx = b.wz = 0; else go(b, x + b.off[0], z + b.off[1], 5.6); }
    } else wander(b, 10, 2);
    return;
  }
  if (P.g === 'bomb') {
    const holder = P.hold.includes(id);
    if (holder) { let best = null, bd = 1e9; for (const o of P.alive) { if (P.hold.includes(o)) continue; const p = hostPos(app, o); if (!p) continue; const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < bd) { bd = d; best = p; } } if (best) go(b, best.x, best.z, 5.3 + b.skill * 0.7); return; }
    let hp = null, hd = 1e9; for (const h of P.hold) { const p = hostPos(app, h); if (!p) continue; const d = Math.hypot(p.x - b.x, p.z - b.z); if (d < hd) { hd = d; hp = p; } }
    if (hp && hd < 8) { let ax = (b.x - hp.x) / (hd || 1), az = (b.z - hp.z) / (hd || 1); if (r > 10.5) { const k2 = (r - 10.5) * 0.6; ax -= b.x / r * k2; az -= b.z / r * k2; } const l = Math.hypot(ax, az) || 1, sp = 4.5 + b.skill * 0.8; b.wx = ax / l * sp; b.wz = az / l * sp; if (b.ground && hd < 2 && Math.random() < dt * 2) b.jump = true; }
    else wander(b, 12, 2.4);
    return;
  }
  if (P.g === 'koth') {
    const top = r < 3 && b.y > Y0 + 2.4;
    if (top) { wander(b, 2.2, 1.4); if (now > (b.shCd || 0) && Math.random() < dt * 1.2) { const near = Object.keys(P.who).some(o => { if (o === id) return false; const p = hostPos(app, o); return p && Math.hypot(p.x - b.x, p.z - b.z) < 2 && Math.abs(p.y - b.y) < 1; }); if (near) { b.shCd = now + 2500; botShove(app, b, id); } } }
    else { const a = Math.atan2(b.x, b.z) + Math.sin(now / 1000 + b.i) * 0.3, tr = 1.5; go(b, Math.sin(a) * tr, Math.cos(a) * tr, 4.4 + b.skill * 0.5); if (b.blocked && b.ground && Math.random() < 0.3 + b.skill * 0.5) b.jump = true; if (r < 8.5 && now > (b.shCd || 0) && Math.random() < dt * 0.5) { b.shCd = now + 3000; botShove(app, b, id); } }
    return;
  }
  if (P.g === 'sweep') {
    if (b.think <= 0) { const a = Math.random() * TAU, d = 3 + Math.random() * 7; b.tx = Math.sin(a) * d; b.tz = Math.cos(a) * d; b.think = 3 + Math.random() * 4; }
    if (go(b, b.tx, b.tz, 1.8) < 0.3) b.wx = b.wz = 0;
    if (b.ground && now > (b.jcd || 0) && r > 1.3) {
      const th = beamAng(P, now), w = beamW(P, now), phi = Math.atan2(b.x, b.z);
      for (let a = 0; a < (t > 25 ? 2 : 1); a++) { let d = wrap(phi - th - a * Math.PI); if (d < 0) continue; const tt = d / w; if (tt > 0.06 && tt < 0.3) { b.jcd = now + 700; const p = Math.max(0.3, Math.min(0.98, 0.985 - (1 - b.skill) * 0.35 - Math.max(0, w - 1.8) * 0.12)); if (Math.random() < p) b.jump = true; break; } }
    }
    return;
  }
  if (P.g === 'coins') {
    const list = coinList(app, P);
    if (b.tgt < 0 || !coinOn(app, list[b.tgt], b.tgt, t) || b.think <= 0) { const vis = []; list.forEach((c, i) => { if (coinOn(app, c, i, t)) vis.push([i, Math.hypot(c.x - b.x, c.z - b.z) - c.v * 0.6]); }); vis.sort((a, c) => a[1] - c[1]); const pick = vis[Math.min(vis.length - 1, Math.floor(Math.random() * (1 + (1 - b.skill) * 4)))]; b.tgt = pick ? pick[0] : -1; b.think = 2; }
    if (b.tgt >= 0) go(b, list[b.tgt].x, list[b.tgt].z, 4.8 + b.skill * 0.7); else wander(b, 10, 2);
    for (const [x, z] of PADS) if (b.ground && Math.hypot(b.x - x, b.z - z) < 1.3) { b.vy = 13; b.ground = false; }
  }
}
function botShove(app, b, id) { const d = { k: keyOf(app.P), id, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2) }; app.emit('pshove', d); applyShove(app, d); b.anim = 2; }
function botPhys(app, b, dt, now) {
  if (b.fling > 0) { b.fling = Math.max(0, b.fling - dt); b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.vy -= 22 * dt; b.ry += dt * 12; b.ground = false; return; }
  const acc = b.ground ? 12 : 3; b.vx += (b.wx - b.vx) * Math.min(1, dt * acc); b.vz += (b.wz - b.vz) * Math.min(1, dt * acc);
  if (b.jump && b.ground) { b.vy = 7.2; b.ground = false; } b.jump = false;
  if (app.bounceUntil > now && b.ground && b.y > 5) { b.vy = 11; b.ground = false; }
  b.vy -= 22 * dt;
  const g0 = groundY(app, b.x, b.z, b.y) ?? 0.15; let nx = b.x + b.vx * dt, nz = b.z + b.vz * dt;
  for (const s of app.world.solids) if (s.r && s.y0 !== undefined && b.y > s.y0 && b.y < s.y1) { const dx = nx - s.x, dz = nz - s.z, d = Math.hypot(dx, dz); if (d < s.r + 0.35 && d > 0.001) { nx = s.x + dx / d * (s.r + 0.35); nz = s.z + dz / d * (s.r + 0.35); } }
  const g1 = groundY(app, nx, nz, b.y) ?? 0.15;
  b.blocked = b.ground && g1 - g0 > 0.6; if (b.blocked) { nx = b.x; nz = b.z; }
  b.x = nx; b.z = nz; b.y += b.vy * dt;
  const fl = groundY(app, b.x, b.z, b.y + 0.05) ?? 0.15;
  if (b.y <= fl && b.y > fl - 1.4) { b.y = fl; b.vy = Math.max(0, b.vy); b.ground = true; } else if (b.y > fl + 0.35) b.ground = false; else if (b.vy <= 0 && b.y >= fl) { b.y = fl; b.vy = 0; b.ground = true; }
  const hs = Math.hypot(b.vx, b.vz); if (hs > 0.4) b.ry += wrap(Math.atan2(b.vx, b.vz) - b.ry) * Math.min(1, dt * 10); b.spd = hs;
}
function botsIn(app, d) { Object.keys(app.botAv).forEach((id, i) => { if (d.b[i]) app.bv[id] = d.b[i]; }); }
const EMO = ['', 'dance', 'cheer', 'sit', 'wave'];
function botsDraw(app, dt) {
  const host = app.isHost();
  for (const id in app.botAv) {
    const av = app.botAv[id], g = av.group; let anim = 0, air = false, spd = 0;
    if (host) { const b = app.sim[id]; if (!b) continue; g.position.set(b.x, b.y, b.z); g.rotation.y = b.ry; anim = b.anim; air = !b.ground; spd = b.spd; }
    else { const v = app.bv[id]; if (!v) continue; const bx = g.position.x, bz = g.position.z; if (Math.hypot(v[0] - bx, v[1] - g.position.y, v[2] - bz) > 6) g.position.set(v[0], v[1], v[2]); else { const k = Math.min(1, dt * 10); g.position.x += (v[0] - bx) * k; g.position.y += (v[1] - g.position.y) * k; g.position.z += (v[2] - bz) * k; } g.rotation.y += wrap(v[3] - g.rotation.y) * Math.min(1, dt * 10); anim = v[4]; air = !!v[5]; spd = Math.hypot(g.position.x - bx, g.position.z - bz) / Math.max(dt, 0.001); }
    const em = EMO[anim] || '';
    if (em !== av._em || (em && !av.emote)) { av._em = em; if (em) av.play(em); else av.emote = null; }
    av.animate(em ? 0 : spd, dt, air && !em);
  }
}

// ---------- every frame ----------
function frame(dt, tt, app) {
  const now = Date.now(), P = app.P, w = app.world;
  if (app.isHost()) hostTick(app, now, dt);
  myTick(app, now);
  botsDraw(app, dt);
  if (app.lay === 'tiles') tilesTick(app, now);
  if (app.lay === 'color') colorTick(app, now);
  if (app.lay === 'sweep' && P) { const th = P.ph === 'play' ? beamAng(P, now) : 0; app.beams[0].rotation.y = th; app.beams[1].rotation.y = th + Math.PI; app.beams[1].visible = P.ph === 'play' && now - P.start > 25000; }
  if (app.lay === 'coins' && P) coinsTick(app, now, tt);
  if (app.lay === 'koth') { app.crown.rotation.y = tt; app.crown.position.y = Y0 + 6.5 + Math.sin(tt * 2) * 0.3; }
  bombsTick(app, now, tt);
  // the slime bubbles, balloons bob, the ring glows
  app.slimeTex.offset.set(Math.sin(tt * 0.1) * 0.2, tt * 0.02);
  app.balloons.forEach(b => { b.m.position.y = b.y + Math.sin(tt * 0.8 + b.p) * 0.8; b.m.rotation.y = tt * 0.2 + b.p; });
  app.ring.rotation.y = tt * 0.3;
  if (!(P && P.g === 'color' && P.ph === 'play')) app.ring.material.color.setHSL((tt * 0.08) % 1, 0.9, 0.65);
  if (app.flipUntil > now) { const h = (tt * 0.4) % 1; app.diskTop.material.color.setHSL(h, 0.9, 0.7); app.hexMat.color.setHSL((h + 0.5) % 1, 0.9, 0.75); } else if (app._flip) { app._flip = false; app.diskTop.material.color.set(0xffffff); app.hexMat.color.set(0xffffff); }
  if (P && P.ph === 'champ' && P.champ) { const p = posOf(app, P.champ); if (p) { app.champCrown.visible = true; app.champCrown.position.set(p.x, p.y + 2.25, p.z); app.champCrown.rotation.y = tt; app.champCrown.scale.setScalar(1.4); } }
  splashWatch(app);
  fxTick(app, dt);
  if (app.allBombUntil && now >= app.allBombUntil) allBoom(app);
  if ((app._hud = (app._hud || 0) + dt) > 0.2) { app._hud = 0; hud(app, now); }
  if ((app._sb = (app._sb || 0) + dt) > 0.33) { app._sb = 0; drawBoard(app, now); }
}
function tilesTick(app, now) {
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
  for (const gi of app.tileAnim) {
    const f = app.fall[gi], L2 = gi >= NT ? 1 : 0, i = gi % NT, [x, z] = HEX[i], im = app.tileIM[L2]; let y = (L2 ? Y1 : Y0) - 0.225, sc = 1, ox = 0, oz = 0;
    if (now < f) { const k = 1 - Math.min(1, (f - now) / 1200); ox = Math.sin(now * 0.09 + i) * 0.06 * k; oz = Math.cos(now * 0.11 + i) * 0.06 * k; }
    else { const t = (now - f) / 1000; y -= 11 * t * t; sc = Math.max(0, 1 - t * 0.6); if (t > 1.6) { sc = 0; app.tileAnim.delete(gi); } }
    M.compose(v.set(x + ox, y, z + oz), q, s.setScalar(sc || 0.0001)); if (!sc) M.makeScale(0, 0, 0); im.setMatrixAt(i, M); im.instanceMatrix.needsUpdate = true;
  }
}
function colorTick(app, now) {
  const P = app.P; if (!P) return; const play = P.ph === 'play', t = play ? (now - P.start) / 1000 : -1, W = play ? cWave(t) : CW[0], lay = cLayout(app, P, W.k);
  const M = new THREE.Matrix4(), c = new THREE.Color(), dark = new THREE.Color(0x222233), white = new THREE.Color(0xffffff);
  for (let i = 0; i < 64; i++) {
    const [x, z] = sqXZ(i), mine = lay.cols[i] === lay.c; let y = Y0 - 0.3, sc = 1; c.set(COLORS[lay.cols[i]][0]);
    if (play && t >= W.call && t < W.drop) { const left = W.drop - t; if (mine) c.lerp(white, 0.25 + Math.sin(now / 90) * 0.15); else if (Math.sin(now / (40 + left * 60)) > 0) c.lerp(dark, 0.55); }
    if (play && t >= W.drop && t < W.back && !mine) { const ft = t - W.drop; y -= 10 * ft * ft; if (ft > 1.5) sc = 0; }
    const prev = W.k > 0 ? CW[W.k - 1] : null;
    if (play && prev && t - W.s < 0.4 && t >= W.s) { const pl = cLayout(app, P, prev.k); if (pl.cols[i] !== pl.c) y -= (1 - (t - W.s) / 0.4) * 6; }
    if (sc) M.makeTranslation(x, y, z); else M.makeScale(0, 0, 0);
    app.sqIM.setMatrixAt(i, M); app.sqIM.setColorAt(i, c);
  }
  app.sqIM.instanceMatrix.needsUpdate = true; app.sqIM.instanceColor.needsUpdate = true;
  if (play) app.ring.material.color.set(COLORS[lay.c][0]);
}
function coinsTick(app, now, tt) {
  const P = app.P, t = P.ph === 'play' ? (now - P.start) / 1000 : -1, M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), s = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  coinList(app, P).forEach((c, i) => {
    if (t >= 0 && coinOn(app, c, i, t)) { const k = Math.min(1, (t - c.t) * 3) * (c.v > 1 ? 1.6 : 1); M.compose(v.set(c.x, Y0 + 0.8 + Math.sin(tt * 3 + i) * 0.12, c.z), q.setFromAxisAngle(up, tt * 3 + i), s.setScalar(k)); }
    else M.makeScale(0, 0, 0);
    app.coinIM.setMatrixAt(i, M);
  });
  app.coinIM.instanceMatrix.needsUpdate = true;
}
// bombs ride on the heads of whoever holds one
function bombsTick(app, now, tt) {
  const P = app.P; let ids = [];
  if (P && P.ph === 'play' && P.g === 'bomb') ids = P.hold.slice();
  if (app.allBombUntil) ids = [app.me.pid, ...Object.keys(app.botAv), ...Object.keys(app.world.remotes)];
  while (app.bombPool.length < ids.length) app.bombPool.push(makeBomb(app));
  const left = app.allBombUntil ? (app.allBombUntil - now) / 1000 : P && P.fuse ? (P.fuse - (now - P.start)) / 1000 : 9;
  app.bombPool.forEach((b, i) => {
    const p = ids[i] && posOf(app, ids[i]); b.visible = !!p; if (!p) return;
    const sc = ids[i] === app.me.pid ? app.world.me.group.scale.x : 1;
    b.position.set(p.x, p.y + 2.6 * sc, p.z); b.scale.setScalar(1 + Math.max(0, 1 - left / 5) * 0.4 * (0.5 + 0.5 * Math.sin(now / (60 + left * 30))));
    b.userData.spark.scale.setScalar(0.7 + Math.random() * 0.8); b.userData.ring.material.color.setHex(Math.sin(now / (50 + Math.max(0, left) * 40)) > 0 ? 0xff2222 : 0xffd34d);
  });
}
function allBoom(app) {
  app.allBombUntil = 0; const w = app.world, p = w.me.group.position;
  boomFx(app, p); for (const id in app.botAv) boomFx(app, app.botAv[id].group.position);
  if (p.y > 5) { w.vel.set((Math.random() - 0.5) * 6, 15, (Math.random() - 0.5) * 6); w.onGround = false; }
  if (app.isHost()) for (const id in app.sim) { const b = app.sim[id]; if (!b.bench) { b.vy = 15; b.vx = (Math.random() - 0.5) * 6; b.vz = (Math.random() - 0.5) * 6; b.ground = false; } }
  flash(); ui.banner('💥 ' + L('KABOOM! Everyone flies!', 'БАБАХ! Все летят!'), 2500);
}

// ---------- effects: splashes, explosions, shove rings, confetti ----------
function splashWatch(app) {
  const all = [['me', app.world.me.group.position], ...Object.entries(app.botAv).map(([id, a]) => [id, a.group.position]), ...Object.entries(app.world.remotes).map(([id, r]) => [id, r.av.group.position])];
  for (const [id, p] of all) { const py = app.prevY[id]; app.prevY[id] = p.y; if (py !== undefined && py >= 1 && p.y < 1 && Math.hypot(p.x, p.z) < 35) { burst(app, p.x, 0.5, p.z, 60, [0xff4fd8, 0xc13cff, 0xffffff], 7); if (id === 'me' || Math.random() < 0.5) app.sfx('splash'); } }
}
function boomFx(app, p) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: 0xffa020, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending })); m.position.set(p.x, p.y + 1.2, p.z); app.world.scene.add(m);
  app.fx.push({ m, t: 0, life: 0.6, kind: 'boom' }); burst(app, p.x, p.y + 1.2, p.z, 80, [0xff6a00, 0xffd34d, 0x333333], 10); app.sfx('crash');
  const me = app.world.me.group.position; if (Math.hypot(me.x - p.x, me.z - p.z) < 6) flash();
}
function ringFx(app, x, y, z) { const m = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.08, 6, 32).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true })); m.position.set(x, y + 0.6, z); app.world.scene.add(m); app.fx.push({ m, t: 0, life: 0.45, kind: 'ring' }); }
function burst(app, x, y, z, n, cols, sp, up = 1) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = [], c = new THREE.Color();
  for (let i = 0; i < n; i++) { pos.set([x, y, z], i * 3); c.set(cols[i % cols.length]); col.set([c.r, c.g, c.b], i * 3); const v = new THREE.Vector3().randomDirection().multiplyScalar(sp * (0.4 + Math.random() * 0.6)); v.y = Math.abs(v.y) * up + sp * 0.3; vel.push(v); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const m = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, depthWrite: false })); app.world.scene.add(m);
  app.fx.push({ m, t: 0, life: 2.4, kind: 'pts', vel });
}
function fxTick(app, dt) {
  app.fx = app.fx.filter(f => {
    f.t += dt; const k = f.t / f.life;
    if (f.kind === 'boom') { f.m.scale.setScalar(1 + k * 4); f.m.material.opacity = 0.9 * (1 - k); }
    if (f.kind === 'ring') { f.m.scale.setScalar(1 + k * 4); f.m.material.opacity = 1 - k; }
    if (f.kind === 'pts') { const a = f.m.geometry.attributes.position; f.vel.forEach((v, i) => { v.y -= 9 * dt; v.multiplyScalar(0.985); a.setXYZ(i, a.getX(i) + v.x * dt, a.getY(i) + v.y * dt, a.getZ(i) + v.z * dt); }); a.needsUpdate = true; f.m.material.opacity = Math.min(1, (1 - k) * 2); }
    if (k >= 1) { app.world.scene.remove(f.m); f.m.geometry.dispose(); f.m.material.dispose(); return false; }
    return true;
  });
}
function fireCannons(app) { app.cannons.forEach((c, i) => setTimeout(() => { const g = new THREE.Vector3(-c.x, 0, -c.z).normalize(), n = app.world.hq ? 220 : 120; burst(app, c.x, c.y, c.z, n, ['#ff3d8b', '#ffd34d', '#4dd8ff', '#a66bff', '#5ee08a'].map(h => new THREE.Color(h).getHex()), 9, 1.6); const f = app.fx[app.fx.length - 1]; f.life = 3.5; f.vel.forEach(v => { v.x += g.x * 9; v.z += g.z * 9; v.y += 8; }); app.sfx('pop'); }, i * 150)); }
function hype(app, ms) { app.people.hype = 1; clearTimeout(app._hy); app._hy = setTimeout(() => (app.people.hype = 0), ms); }

// ---------- spectating ----------
function specOn(app) {
  const w = app.world; app.spec = 0; app.specBtn.classList.remove('hidden');
  w.cameraOverride = (cam, dt) => {
    const P = app.P, ids = P && P.alive ? P.alive : [], id = ids.length && app.spec >= 0 ? ids[app.spec % ids.length] : null, p = id ? posOf(app, id) : null;
    const c = p || new THREE.Vector3(0, Y0, 0), d = p ? 8 : 30, cp = Math.cos(w.pitch);
    cam.position.lerp(new THREE.Vector3(c.x + Math.sin(w.yaw) * cp * d, c.y + 2.5 + Math.sin(w.pitch) * d + (p ? 0 : 10), c.z + Math.cos(w.yaw) * cp * d), Math.min(1, dt * 4)); cam.lookAt(c.x, c.y + 1, c.z);
    app.specName = id ? (P.who[id] || '') : '';
  };
}
function specOff(app, keepBtn) { app.spec = -1; app.specName = ''; if (app.specBtn && !keepBtn) app.specBtn.classList.add('hidden'); if (app.world.cameraOverride && app.P && app.P.ph !== 'champ') app.world.cameraOverride = null; }
// 🎥 / C: watch the next player still in, and after the last one go back to your own camera
function specCycle(app) { const P = app.P; if (!P || !(P.ph === 'play' || P.ph === 'intro') || (P.alive || []).includes(app.me.pid)) return; if (app.spec < 0) specOn(app); else if (++app.spec >= (P.alive || []).length) specOff(app, true); }

// ---------- HUD and the big screen ----------
function hudSetup(app) {
  document.body.insertAdjacentHTML('beforeend', `<div id="pHud" class="p-hud"><div class="p-row"><span class="p-rnd" id="pRnd"></span><b class="p-name" id="pName"></b><span class="p-time" id="pTime"></span></div><div class="p-how" id="pHow"></div><div class="p-row p-stats" id="pStats"></div></div><div id="pBoard" class="p-board"></div><div id="pBig" class="p-big hidden"></div>`);
  const $ = s => document.querySelector(s); app.el = { rnd: $('#pRnd'), name: $('#pName'), time: $('#pTime'), how: $('#pHow'), stats: $('#pStats'), board: $('#pBoard'), big: $('#pBig') };
  app.shoveBtn = document.createElement('button'); app.shoveBtn.className = 'x-act'; app.shoveBtn.innerHTML = '✋<small>F · ' + L('Shove', 'Толкнуть') + '</small>'; app.shoveBtn.onclick = () => shove(app); document.body.appendChild(app.shoveBtn);
  app.specBtn = document.createElement('button'); app.specBtn.className = 'x-act x-act2 hidden'; app.specBtn.innerHTML = '🎥<small>C</small>'; app.specBtn.onclick = () => specCycle(app); document.body.appendChild(app.specBtn);
  addEventListener('keydown', e => { if (/INPUT|TEXTAREA/.test(e.target.tagName) || app.world.inputLocked) return; if (e.code === 'KeyF') shove(app); if (e.code === 'KeyC') specCycle(app); });
}
function big(app, html, cls = '', ms = 2000) { const e = app.el.big; e.innerHTML = html; e.className = 'p-big ' + cls; e.style.background = ''; e.style.animation = 'none'; e.offsetHeight; e.style.animation = ''; app.bigUntil = Date.now() + ms; app.bigPersist = false; }
function roulette(app, P) {
  const G = GAMES[P.g]; let n = 0; clearInterval(app._rl);
  app._rl = setInterval(() => { n++; if (n < 14) { const g = GAMES[GIDS[n % GIDS.length]]; big(app, `${g.icon} ${L(g.en, g.ru)}`, '', 400); app.sfx('click'); } else { clearInterval(app._rl); big(app, `${G.icon} ${L(G.en, G.ru)}<small>${L(...G.how)}</small>`, '', 2200); app.sfx('star'); } }, 110);
}
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
function hud(app, now) {
  const P = app.P, E = app.el; if (!P) { E.name.textContent = '🎉 Party Royale'; E.how.textContent = L('Getting the party ready…', 'Готовим вечеринку…'); return; }
  const me = app.me.pid, G = GAMES[P.g] || {}, left = Math.max(0, (P.phaseEnds - now) / 1000), alive = (P.alive || []).includes(me), total = Object.keys(P.who || {}).length, t = (now - P.start) / 1000;
  const st = []; let name = '🎉 ' + L('Party Royale', 'Пати Рояль'), how = '';
  E.rnd.textContent = P.r ? `${L('Round', 'Раунд')} ${P.r}/${ROUNDS}` : `${L('Match', 'Матч')} ${P.m}`;
  E.time.textContent = fmt(Math.ceil(left)); E.time.classList.toggle('hurry', P.ph === 'play' && left < 10);
  if (P.ph === 'lobby') how = L('Next match starts soon. Warm up! (F = shove)', 'Скоро новый матч. Разминайся! (F = толкнуть)');
  else if (P.ph === 'intro' || P.ph === 'play') {
    name = `${G.icon} ${L(G.en, G.ru)}`; how = L(...G.how);
    if (G.elim) st.push(`👥 ${P.alive.length}/${total} ${L('left', 'в игре')}`);
    else st.push(`⭐ ${L('Round', 'Раунд')}: ${(P.rp || {})[me] || 0}`);
    if (P.ph === 'play' && P.who[me] && !alive && G.elim) st.push(`💀 ${L('Out', 'Выбыл')}`);
    if (app.specName) st.push(`🎥 ${esc(app.specName)}`);
  } else if (P.ph === 'results') { name = '🏁 ' + L('Round results', 'Итоги раунда'); how = `${G.icon} ${L(G.en, G.ru)} · ${L('next round soon', 'скоро следующий раунд')}`; }
  else if (P.ph === 'champ') { name = '🏆 ' + L('Champion', 'Чемпион') + ': ' + ((P.nm && P.nm[P.champ]) || '?'); how = L('A new match starts soon!', 'Скоро новый матч!'); }
  st.push(`🏅 ${(P.sc || {})[me] || 0} ${L('pts', 'очк.')}`); if (P.x2) st.push('✖️2');
  E.name.textContent = name; E.how.textContent = how; E.stats.innerHTML = st.map(s => `<span>${s}</span>`).join('');
  // the leaderboard: round points while they matter, match points otherwise
  const roundPts = (P.ph === 'play' || P.ph === 'intro') && !G.elim, src = roundPts ? P.rp || {} : P.sc || {}, ids = roundPts ? Object.keys(P.who) : Object.keys({ ...P.sc, ...(P.who || {}) });
  const rows = ids.map(id => [id, src[id] || 0]).sort((a, b) => b[1] - a[1]); let show = rows.slice(0, 6); const mi = rows.findIndex(r => r[0] === me); if (mi >= 6) show = [...rows.slice(0, 5), rows[mi]];
  const nmOf = id => (P.who && P.who[id]) || (P.nm && P.nm[id]) || '?', isOut = id => P.ph === 'play' && G.elim && P.who[id] && !P.alive.includes(id);
  E.board.innerHTML = `<h5>${roundPts ? '⭐ ' + L('THIS ROUND', 'ЭТОТ РАУНД') : '🏅 ' + L('MATCH POINTS', 'ОЧКИ МАТЧА')}</h5>` + show.map(([id, v]) => `<div class="${id === me ? 'me' : ''} ${isOut(id) ? 'out' : ''}"><b>${rows.indexOf(rows.find(r => r[0] === id)) + 1}</b><span>${esc(nmOf(id))}</span><b>${v}</b></div>`).join('');
  // the shove button only when it makes sense
  app.shoveBtn.classList.toggle('hidden', P.ph === 'play' && !alive);
  // countdown, colour calls, bomb warnings in the big card
  const e = E.big;
  if (Date.now() < (app.bigUntil || 0)) return;
  if (P.ph === 'intro' && left <= 3 && left > 0) { const n = Math.ceil(left); if (n !== app._cd) { app._cd = n; app.sfx('countdown'); } e.className = 'p-big huge'; e.style.background = ''; e.textContent = n; return; }
  app._cd = 0;
  if (P.ph === 'play' && P.g === 'color') { const W = cWave(t), lay = cLayout(app, P, W.k); if (t >= W.call && t < W.drop) { const [hex, en, ru] = COLORS[lay.c]; e.className = 'p-big call'; e.style.background = hex; e.innerHTML = `${L(en, ru)}!<small>${L('Drop in', 'Падение через')} ${(W.drop - t).toFixed(1)}s</small>`; if (app._ck !== W.k) { app._ck = W.k; app.sfx('whistle'); } return; } }
  if (P.ph === 'play' && P.g === 'bomb' && P.hold.includes(me)) { e.className = 'p-big bomb'; e.style.background = ''; e.innerHTML = `💣 ${Math.max(0, (P.fuse / 1000 - t)).toFixed(1)}s<small>${L('Touch someone to pass the bomb!', 'Коснись кого-нибудь, чтобы передать бомбу!')}</small>`; if (Math.ceil(P.fuse / 1000 - t) !== app._bt) { app._bt = Math.ceil(P.fuse / 1000 - t); if (app._bt <= 5) app.sfx('beep'); } return; }
  e.className = 'p-big hidden'; e.style.background = '';
}
function drawBoard(app, now) {
  const g = app.sbG, P = app.P || { ph: 'lobby', sc: {} }, W2 = 1024, H2 = 512, G = GAMES[P.g], left = Math.max(0, Math.ceil(((P.phaseEnds || now) - now) / 1000)), t = (now - (P.start || now)) / 1000;
  const bg = g.createLinearGradient(0, 0, 0, H2); bg.addColorStop(0, '#24104f'); bg.addColorStop(1, '#3d0f4f'); g.fillStyle = bg; g.fillRect(0, 0, W2, H2);
  const hd = g.createLinearGradient(0, 0, W2, 0); hd.addColorStop(0, '#ff3d8b'); hd.addColorStop(1, '#7a2bd8'); g.fillStyle = hd; g.fillRect(0, 0, W2, 84);
  g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.textAlign = 'left'; g.font = '900 50px Manrope, system-ui'; g.fillText('🎉 PARTY ROYALE', 26, 44);
  g.textAlign = 'right'; g.font = '800 30px Manrope, system-ui'; g.fillText(P.r ? `${L('ROUND', 'РАУНД')} ${P.r}/${ROUNDS}` : `${L('MATCH', 'МАТЧ')} ${P.m || 1}`, W2 - 26, 44); g.textAlign = 'left';
  g.font = '900 54px Manrope, system-ui';
  if (P.ph === 'lobby') { g.fillText(L('NEXT MATCH IN', 'НОВЫЙ МАТЧ ЧЕРЕЗ'), 30, 160); g.fillStyle = '#ffd34d'; g.font = '900 150px Manrope, system-ui'; g.fillText(left, 30, 300); }
  else if ((P.ph === 'intro' || P.ph === 'play') && G) {
    g.fillText(`${G.icon} ${L(G.en, G.ru)}`, 30, 150); g.fillStyle = '#ffd34d'; g.font = '900 110px Manrope, system-ui'; g.fillText(P.ph === 'intro' ? L('READY', 'ГОТОВЬСЯ') : fmt(left), 30, 275);
    g.fillStyle = '#fff'; g.font = '800 40px Manrope, system-ui';
    if (G.elim) g.fillText(`👥 ${P.alive.length} / ${Object.keys(P.who).length} ${L('left', 'в игре')}`, 30, 380);
    if (P.ph === 'play' && P.g === 'color') { const W = cWave(t), lay = cLayout(app, P, W.k); if (t >= W.call && t < W.drop) { g.fillStyle = COLORS[lay.c][0]; g.fillRect(30, 420, 520, 70); g.fillStyle = '#fff'; g.font = '900 46px Manrope, system-ui'; g.fillText(L(COLORS[lay.c][1], COLORS[lay.c][2]) + '!', 50, 457); } }
    if (P.ph === 'play' && P.g === 'bomb' && P.fuse) { g.fillStyle = '#ff6a6a'; g.font = '900 46px Manrope, system-ui'; g.fillText(`💣 ${Math.max(0, P.fuse / 1000 - t).toFixed(1)}s`, 30, 455); }
  } else if (P.ph === 'results') { g.fillText(L('ROUND RESULTS', 'ИТОГИ РАУНДА'), 30, 150); (P.pod || []).forEach((id, i) => { g.fillStyle = ['#ffd34d', '#dfe5ee', '#e0a26a'][i]; g.font = '800 42px Manrope, system-ui'; g.fillText(`${i + 1}. ${(P.nm[id] || '').slice(0, 16)}  +${P.gain[id]}`, 30, 240 + i * 70); }); }
  else if (P.ph === 'champ') { g.fillStyle = '#ffd34d'; g.fillText('🏆 ' + L('CHAMPION', 'ЧЕМПИОН'), 30, 160); g.fillStyle = '#fff'; g.font = '900 64px Manrope, system-ui'; g.fillText(((P.nm || {})[P.champ] || '').slice(0, 14), 30, 270); }
  // leaderboard on the right
  g.fillStyle = 'rgba(255,255,255,0.08)'; g.fillRect(600, 104, 400, 390); g.fillStyle = '#ffd34d'; g.font = '900 30px Manrope, system-ui'; g.fillText(L('LEADERBOARD', 'ТАБЛИЦА'), 620, 135);
  Object.entries(P.sc || {}).sort((a, b) => b[1] - a[1]).slice(0, 7).forEach(([id, v], i) => { g.fillStyle = id === app.me.pid ? '#ffd34d' : '#fff'; g.font = '800 30px Manrope, system-ui'; g.textAlign = 'left'; g.fillText(`${i + 1}. ${((P.nm || {})[id] || '').slice(0, 15)}`, 620, 185 + i * 44); g.textAlign = 'right'; g.fillText(v, 985, 185 + i * 44); g.textAlign = 'left'; });
  app.sb.needsUpdate = true;
}

// ---------- admin abuse ----------
function onAdmin(a, d, app) {
  const host = app.isHost(), P = app.P, now = Date.now(); if (!P) return;
  if (a === 'skip') { ui.banner('⏭️ ' + L('Skipping ahead!', 'Пропускаем!')); if (host) { if (P.ph === 'play') endPlay(app, now); else if (P.ph === 'intro') startPlay(app, now); else push(app, { ...P, phaseEnds: now }); } }
  if (a.startsWith('pick_') && GAMES[a.slice(5)]) { const g = a.slice(5); ui.banner(`${GAMES[g].icon} ${L('Next game', 'Следующая игра')}: ${L(GAMES[g].en, GAMES[g].ru)}`); if (host) push(app, { ...P, next: g }); }
  if (a === 'double') { ui.banner('✖️2 ' + L('DOUBLE POINTS!', 'ДВОЙНЫЕ ОЧКИ!')); app.sfx('star'); if (host) push(app, P.ph === 'intro' || P.ph === 'play' ? { ...P, x2: true } : { ...P, x2n: true }); }
  if (a === 'adminwins') { ui.banner(`👑 ${d.by || 'Admin'} ${L('knocks everyone out!', 'выбивает всех!')}`, 3500); app.sfx('laugh'); if (host && P.ph === 'play') { const keep = P.alive.filter(id => !isBot(id) && P.who[id] === d.by); push(app, { ...P, alive: keep, out: [...P.out, ...P.alive.filter(id => !keep.includes(id))] }); } }
  if (a === 'revive') { ui.banner('💖 ' + L('Everyone is back in the game!', 'Все снова в игре!')); app.sfx('star'); if (host && P.ph === 'play') push(app, { ...P, alive: Object.keys(P.who), out: [] }); }
  if (a === 'allbomb') { app.allBombUntil = now + 8000; ui.banner('💣 ' + L('BOMBS FOR EVERYONE! 8 seconds…', 'БОМБЫ ВСЕМ! 8 секунд…'), 3000); app.sfx('drumroll'); }
  if (a === 'turbo') { ui.banner('🌪️ ' + L('TURBO SPINNER!', 'ТУРБО-КРУТИЛКА!')); app.sfx('whoosh'); if (host) { if (P.ph === 'play' && P.g === 'sweep') { const ts = (now - P.start) / 1000; push(app, { ...P, beam: [ts, beamAng(P, now), Math.min(4, P.beam[2] * 2)] }); } else push(app, { ...P, next: 'sweep', turboN: true }); } }
  if (a === 'instant') { app.instantUntil = now + 30000; ui.banner('⚡ ' + L('Tiles fall INSTANTLY!', 'Плитки падают МГНОВЕННО!')); if (host && !(P.g === 'tiles' && (P.ph === 'play' || P.ph === 'intro'))) push(app, { ...P, next: 'tiles' }); }
  if (a === 'bounce') { app.bounceUntil = now + 20000; ui.banner('🦘 ' + L('The floor is a trampoline!', 'Пол — батут!')); app.sfx('boing'); }
  if (a === 'botdance') { app.danceUntil = now + 20000; ui.banner('🕺 ' + L('The bots forgot the game and DANCE!', 'Боты забыли про игру и ТАНЦУЮТ!')); }
  if (a === 'cannons') { fireCannons(app); confetti(120); hype(app, 4000); }
  if (a === 'flip') {
    if (P.ph === 'play' && P.g === 'color') { ui.banner('🌈 ' + L('The colour changed!', 'Цвет поменялся!')); if (host) { const W = cWave((now - P.start) / 1000), c = cLayout(app, P, W.k).c; push(app, { ...P, cOver: { k: W.k, c: (c + 1 + Math.floor(Math.random() * 5)) % 6 } }); } }
    else { app.flipUntil = now + 20000; app._flip = true; ui.banner('🌈 ' + L('Rainbow arena!', 'Радужная арена!')); }
  }
  if (a === 'shoveall') {
    ui.banner('💨 ' + L('MEGA SHOVE!', 'МЕГА-ТОЛЧОК!')); app.sfx('whoosh'); const w = app.world, p = w.me.group.position, r = Math.hypot(p.x, p.z);
    if (r < 17 && p.y > 8) { w.vel.x += p.x / (r || 1) * 9; w.vel.z += p.z / (r || 1) * 9; w.vel.y = 6; w.onGround = false; }
    if (host) for (const id in app.sim) { const b = app.sim[id], br = Math.hypot(b.x, b.z); if (!b.bench) { b.vx += b.x / (br || 1) * 9; b.vz += b.z / (br || 1) * 9; b.vy = 6; b.ground = false; } }
    ringFx(app, 0, Y0, 0);
  }
  if (a === 'crowd') { app.people.wave = true; hype(app, 15000); setTimeout(() => (app.people.wave = false), 15000); app.sfx('cheer'); ui.banner('🙌 ' + L('The crowd goes wild!', 'Трибуны сходят с ума!')); }
}
