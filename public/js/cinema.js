// Island Cinema: "Барсик" — short cartoons about a silly orange cat. No words on screen: the cat and the narrator
// speak Russian (the cat in a squeaky voice), with cartoon sound effects and kids laughing at the funny bits.
import { voice } from './audio.js';

const EP = [];
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = k => { k = clamp(k); return k * k * (3 - 2 * k); };
const prog = (t, a, b) => clamp((t - a) / (b - a));
const lerp = (a, b, k) => a + (b - a) * k;
const ORANGE = '#f5a142', DARK = '#d27a22', CREAM = '#fff1d6', PINK = '#ff8fa3', INK = '#2b1d14';

// ---------- the cat ----------
// o: x, y (feet), s scale, flip (1 = faces right), face, talk 0..1, sx/sy squash, rot, poof 0..1, t (time), look, blink, tongue, extra
function cat(g, o) {
  const { x, y, s = 1, flip = 1, face = 'normal', talk = 0, sx = 1, sy = 1, rot = 0, poof = 0, t = 0, look = 0, lookY = 0 } = o;
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s * sx * flip, s * sy);
  g.lineCap = 'round'; g.lineJoin = 'round';
  // poofed fur (scared): a spiky outline behind the body
  if (poof > 0) {
    g.fillStyle = ORANGE; g.beginPath();
    for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2, r = (i % 2 ? 1 : 1 + 0.35 * poof); g.lineTo(Math.cos(a) * 52 * r, -55 + Math.sin(a) * 46 * r); }
    g.fill();
  }
  // tail
  const tw = Math.sin(t * 3.2) * 16;
  g.strokeStyle = ORANGE; g.lineWidth = 15 + poof * 10;
  g.beginPath(); g.moveTo(-36, -40); g.bezierCurveTo(-78, -48, -72 + tw, -108, -50 + tw, -122); g.stroke();
  g.strokeStyle = DARK; g.lineWidth = 4; for (const k of [0.4, 0.65, 0.85]) { const px = lerp(-36, -50 + tw, k) - 18 * Math.sin(k * 3), py = lerp(-40, -122, k); g.beginPath(); g.moveTo(px - 8, py); g.lineTo(px + 8, py); g.stroke(); }
  // legs
  g.fillStyle = ORANGE; for (const lx of [-28, -10, 14, 32]) { g.beginPath(); g.ellipse(lx, -7, 12, 9, 0, 0, 7); g.fill(); }
  g.fillStyle = CREAM; for (const lx of [-28, -10, 14, 32]) { g.beginPath(); g.ellipse(lx + 2, -3, 8, 4, 0, 0, 7); g.fill(); }
  // body
  g.fillStyle = ORANGE; g.beginPath(); g.ellipse(0, -48, 48, 38, 0, 0, 7); g.fill();
  g.fillStyle = CREAM; g.beginPath(); g.ellipse(14, -40, 26, 24, 0, 0, 7); g.fill();
  g.strokeStyle = DARK; g.lineWidth = 5; for (const k of [-24, -8, 8]) { g.beginPath(); g.arc(k, -48, 30, -2.1, -1.5); g.stroke(); }
  // head
  g.save(); g.translate(22, -104);
  g.fillStyle = ORANGE;
  g.beginPath(); g.moveTo(-34, -18); g.lineTo(-30, -58); g.lineTo(-6, -34); g.fill();
  g.beginPath(); g.moveTo(30, -18); g.lineTo(32, -58); g.lineTo(6, -34); g.fill();
  g.fillStyle = PINK; g.beginPath(); g.moveTo(-28, -26); g.lineTo(-27, -48); g.lineTo(-13, -34); g.fill(); g.beginPath(); g.moveTo(26, -26); g.lineTo(28, -48); g.lineTo(13, -34); g.fill();
  g.fillStyle = ORANGE; g.beginPath(); g.ellipse(0, 0, 42, 38, 0, 0, 7); g.fill();
  g.strokeStyle = DARK; g.lineWidth = 4; for (const k of [-10, 0, 10]) { g.beginPath(); g.moveTo(k, -36); g.lineTo(k * 0.8, -24); g.stroke(); }
  g.fillStyle = CREAM; g.beginPath(); g.ellipse(4, 14, 26, 18, 0, 0, 7); g.fill();
  // eyes
  const eye = (ex, kind) => {
    g.save(); g.translate(ex, -6);
    if (kind === 'happy') { g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.arc(0, 4, 9, Math.PI * 1.1, Math.PI * 1.9); g.stroke(); }
    else if (kind === 'closed' || kind === 'sleepy') { g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(-9, 2); g.quadraticCurveTo(0, 8, 9, 2); g.stroke(); }
    else if (kind === 'dizzy') { g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); for (let a = 0; a < 14; a += 0.3) g.lineTo(Math.cos(a + t * 8) * a * 0.8, Math.sin(a + t * 8) * a * 0.8); g.stroke(); }
    else {
      const big = kind === 'shock', r = big ? 15 : 11;
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, 0, r, r * 1.25, 0, 0, 7); g.fill(); g.strokeStyle = INK; g.lineWidth = 2; g.stroke();
      const px = kind === 'cross' ? (ex < 0 ? 5 : -5) : look * 5, py = kind === 'cross' ? 4 : lookY * 5, pr = big ? 4 : 7;
      g.fillStyle = '#2e7d32'; g.beginPath(); g.arc(px, py, pr + 1.5, 0, 7); g.fill();
      g.fillStyle = INK; g.beginPath(); g.ellipse(px, py, pr * 0.45, pr, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(px + 2.5, py - 3.5, 2.4, 0, 7); g.fill();
      if (kind === 'smug') { g.fillStyle = ORANGE; g.fillRect(-r - 1, -r * 1.3, r * 2 + 2, r * 1.15); g.strokeStyle = INK; g.lineWidth = 3; g.beginPath(); g.moveTo(-r, -r * 0.15); g.lineTo(r, -r * 0.15); g.stroke(); }
      if (kind === 'angry') { g.strokeStyle = INK; g.lineWidth = 5; g.beginPath(); g.moveTo(ex < 0 ? -14 : 14, -20); g.lineTo(ex < 0 ? 8 : -8, -12); g.stroke(); }
    }
    g.restore();
  };
  const blink = (Math.sin(t * 1.7) > 0.985) && !['happy', 'sleepy', 'dizzy', 'shock'].includes(face);
  const eyeKind = blink ? 'closed' : face === 'wink' ? 'normal' : face === 'tongue' || face === 'talk' ? 'normal' : face;
  eye(-14, eyeKind); eye(16, face === 'wink' ? 'happy' : eyeKind);
  // nose, mouth, whiskers
  g.fillStyle = PINK; g.beginPath(); g.moveTo(-1, 8); g.lineTo(9, 8); g.lineTo(4, 14); g.fill();
  g.strokeStyle = INK; g.lineWidth = 3;
  if (talk > 0.05 || face === 'shock') { const h = face === 'shock' ? 12 : 3 + talk * 12; g.fillStyle = '#7a1f2b'; g.beginPath(); g.ellipse(4, 24, 9, h, 0, 0, 7); g.fill(); g.fillStyle = PINK; g.beginPath(); g.ellipse(4, 24 + h * 0.5, 6, h * 0.4, 0, 0, 7); g.fill(); }
  else if (face === 'tongue') { g.beginPath(); g.moveTo(-6, 18); g.quadraticCurveTo(4, 24, 14, 18); g.stroke(); g.fillStyle = PINK; g.beginPath(); g.ellipse(4, 26, 6, 9, 0, 0, 7); g.fill(); }
  else if (face === 'angry' || face === 'sad') { g.beginPath(); g.moveTo(-4, 24); g.quadraticCurveTo(4, 16, 12, 24); g.stroke(); }
  else { g.beginPath(); g.moveTo(-6, 17); g.quadraticCurveTo(-1, 23, 4, 16); g.quadraticCurveTo(9, 23, 14, 17); g.stroke(); }
  g.strokeStyle = 'rgba(43,29,20,0.7)'; g.lineWidth = 1.8;
  for (const k of [-1, 1]) for (const a of [-0.15, 0.05, 0.25]) { g.beginPath(); g.moveTo(4 + k * 14, 12); g.lineTo(4 + k * 48, 12 + a * 40 * k * 0 + a * 30); g.stroke(); }
  if (face === 'happy' || face === 'smug' || face === 'wink') { g.fillStyle = 'rgba(255,110,110,0.45)'; g.beginPath(); g.arc(-22, 10, 7, 0, 7); g.arc(30, 10, 7, 0, 7); g.fill(); }
  if (o.extra) o.extra(g);
  g.restore();
  g.restore();
}

// ---------- scenery ----------
function room(g, W, H, wall = '#ffe8c7', dots = '#ffd59a') {
  g.fillStyle = wall; g.fillRect(0, 0, W, H);
  g.fillStyle = dots; for (let y = 20; y < H * 0.72; y += 40) for (let x = (y / 40 % 2) * 20 + 10; x < W; x += 40) { g.beginPath(); g.arc(x, y, 4, 0, 7); g.fill(); }
  g.fillStyle = '#c98b52'; g.fillRect(0, H * 0.74, W, H * 0.26);
  g.strokeStyle = '#a86d3a'; g.lineWidth = 2; for (let x = 0; x < W; x += 70) { g.beginPath(); g.moveTo(x, H * 0.74); g.lineTo(x - 30, H); g.stroke(); }
  g.fillStyle = '#fff'; g.fillRect(0, H * 0.72, W, H * 0.025);
}
function window_(g, x, y, w, h) {
  g.fillStyle = '#8fd3ff'; g.fillRect(x, y, w, h); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(x + w * 0.3, y + h * 0.35, w * 0.18, h * 0.1, 0, 0, 7); g.fill();
  g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(x, y, w, h); g.beginPath(); g.moveTo(x + w / 2, y); g.lineTo(x + w / 2, y + h); g.moveTo(x, y + h / 2); g.lineTo(x + w, y + h / 2); g.stroke();
}
function title(g, W, H, t, text) {
  if (t > 2) return;
  const a = t < 1.6 ? 1 : 1 - (t - 1.6) / 0.4;
  g.save(); g.globalAlpha = a; g.fillStyle = 'rgba(30,20,60,0.75)'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) { const ang = i / 14 * Math.PI * 2 + t; g.fillStyle = i % 2 ? '#ffd34d' : '#ff8fa3'; g.beginPath(); g.moveTo(W / 2, H / 2); g.arc(W / 2, H / 2, W, ang, ang + 0.12); g.fill(); }
  const sc = 0.6 + ease(t / 0.5) * 0.4 + Math.sin(t * 6) * 0.03;
  g.translate(W / 2, H / 2); g.scale(sc, sc);
  g.fillStyle = '#fff'; g.strokeStyle = '#3a1f5c'; g.lineWidth = 10; g.font = '900 74px Manrope, system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.strokeText('Барсик', 0, -38); g.fillText('Барсик', 0, -38);
  g.font = '800 40px Manrope, system-ui'; g.fillStyle = '#ffd34d'; g.strokeText(text, 0, 34); g.fillText(text, 0, 34);
  g.restore();
}
function cucumber(g, x, y, s = 1, rot = 0) {
  g.save(); g.translate(x, y); g.rotate(rot); g.scale(s, s);
  g.fillStyle = '#3f9b3a'; g.beginPath(); g.ellipse(0, 0, 46, 14, 0, 0, 7); g.fill();
  g.fillStyle = '#6cc24a'; g.beginPath(); g.ellipse(-4, -4, 38, 6, 0, 0, 7); g.fill();
  g.fillStyle = '#2d7a2a'; for (let i = -36; i < 40; i += 12) { g.beginPath(); g.arc(i, 4, 2, 0, 7); g.fill(); }
  g.restore();
}
function bowl(g, x, y, fish = true) {
  if (fish) { g.fillStyle = '#7fb3d5'; g.beginPath(); g.ellipse(x, y - 14, 22, 9, 0, 0, 7); g.fill(); g.beginPath(); g.moveTo(x + 18, y - 14); g.lineTo(x + 32, y - 22); g.lineTo(x + 32, y - 6); g.fill(); }
  g.fillStyle = '#e74c3c'; g.beginPath(); g.moveTo(x - 40, y - 12); g.lineTo(x + 40, y - 12); g.lineTo(x + 30, y + 6); g.lineTo(x - 30, y + 6); g.fill();
  g.fillStyle = '#ff7b6b'; g.fillRect(x - 40, y - 14, 80, 5);
}
function lines(g, x, y, dir, n = 4) { g.strokeStyle = 'rgba(80,60,40,0.6)'; g.lineWidth = 4; for (let i = 0; i < n; i++) { g.beginPath(); g.moveTo(x - dir * 20, y - 30 + i * 18); g.lineTo(x - dir * 70, y - 30 + i * 18); g.stroke(); } }
function stars(g, x, y, t) { for (let i = 0; i < 4; i++) { const a = t * 5 + i * 1.57; g.fillStyle = '#ffd34d'; g.font = '26px serif'; g.textAlign = 'center'; g.fillText('⭐', x + Math.cos(a) * 40, y + Math.sin(a) * 12); } }

// cues: [time, who, text]: who = 'cat' (squeaky), 'nar' (narrator) or 'sfx'
// 1. Barsik and the cucumber
EP.push({ name: 'и огурец', dur: 17, cues: [[1.9, 'cat', 'Ням-ням-ням! Обожаю рыбку!'], [4.6, 'sfx', 'zip'], [5.6, 'nar', 'Барсик... обернись.'], [8.0, 'sfx', 'slideUp'], [8.2, 'sfx', 'meow'], [9.0, 'cat', 'А-а-а! Зелёный монстр!'], [11.4, 'nar', 'Барсик, это просто огурец.'], [12.8, 'sfx', 'slideDown'], [13.4, 'sfx', 'splash'], [14.2, 'cat', 'Я не испугался. Я тренировался!'], [16.0, 'sfx', 'laugh']],
  draw(g, t, W, H, st) {
    room(g, W, H); window_(g, W * 0.68, 40, 130, 110);
    const fy = H * 0.86, bx = W * 0.62;
    const jump = prog(t, 8.1, 8.7), fall = prog(t, 12.8, 13.4);
    let cx = W * 0.48, cy = fy, rot = 0, face = 'happy', flip = 1, poof = 0, sy = 1;
    if (t < 8) { face = t < 4.5 ? 'happy' : 'normal'; cy = fy + Math.abs(Math.sin(t * 6)) * -4 * (t < 4.5 ? 1 : 0); }
    if (t >= 7.4 && t < 8.1) { flip = -1; face = 'shock'; poof = 1; }
    if (t >= 8.1 && t < 12.8) { flip = -1; face = 'shock'; poof = 1; cx = lerp(W * 0.48, W * 0.4, jump); cy = lerp(fy, 70, ease(jump)); rot = lerp(0, Math.PI, ease(jump)); if (jump >= 1) { cy = 70 + Math.sin(t * 9) * 3; face = t > 10.5 ? 'cross' : 'shock'; } }
    if (t >= 12.8) { flip = 1; rot = lerp(Math.PI, 0, ease(fall)); cx = lerp(W * 0.4, bx, fall); cy = lerp(70, fy, fall * fall); poof = 0; face = t < 14 ? 'dizzy' : 'smug'; sy = t > 13.4 && t < 13.7 ? 0.7 : 1; }
    if (t < 12.8 || fall < 1) bowl(g, bx, fy, t < 13.4);
    if (t > 4.6) cucumber(g, Math.max(W * 0.3, -60 + (t - 4.6) * 500), fy - 12, 1, 0);
    cat(g, { x: cx, y: cy, s: 0.95, flip, face, talk: st.talk, rot, poof, t, sy, look: t > 5.6 && t < 8 ? -1 : 0 });
    if (t >= 13.4 && t < 15) { g.fillStyle = '#7fd3ff'; for (let i = 0; i < 10; i++) { const a = -Math.PI * (i / 9), r = (t - 13.4) * 160; g.beginPath(); g.arc(bx + Math.cos(a) * r, fy - 10 + Math.sin(a) * r * 0.8 + (t - 13.4) ** 2 * 200, 6, 0, 7); g.fill(); } }
    if (t >= 13.4 && t < 14.2) stars(g, cx + 20, cy - 190, t);
    if (t >= 13.4) bowl(g, bx, fy, false);
    title(g, W, H, t, 'и огурец');
  } });

// 2. The red dot
EP.push({ name: 'Красная точка', dur: 17, cues: [[2.0, 'cat', 'Что это? Точка! Моя точка!'], [5.8, 'sfx', 'zip'], [6.5, 'sfx', 'bonk'], [8.4, 'nar', 'Барсик, точка у тебя на носу.'], [11.0, 'cat', 'Поймал!'], [11.2, 'sfx', 'slideUp'], [13.4, 'sfx', 'bonk'], [13.8, 'cat', 'Ой... это был мой нос.'], [15.6, 'sfx', 'laugh']],
  draw(g, t, W, H, st) {
    room(g, W, H, '#e6f2ff', '#cfe4ff');
    const fy = H * 0.86;
    let dx = W * 0.5 + Math.sin(t * 2.3) * 160, dy = fy - 10 - Math.abs(Math.sin(t * 3.1)) * 60;
    let cx = W * 0.25, cy = fy, sx = 1, sy = 1, rot = 0, face = 'normal', flip = 1;
    const look = clamp((dx - cx) / 200, -1, 1);
    if (t > 4.4 && t < 5.8) { face = 'angry'; cx += Math.sin(t * 30) * 4; sy = 0.92; }
    const p = prog(t, 5.8, 6.5);
    if (t >= 5.8) { dx = W * 0.95; dy = H * 0.3; }
    if (t >= 5.8 && t < 8.2) { cx = lerp(W * 0.25, W * 0.93, p); cy = fy - Math.sin(p * Math.PI) * 140; face = p < 1 ? 'shock' : 'dizzy'; if (p >= 1) { sx = 0.45; rot = 0; cy = lerp(fy - 60, fy, prog(t, 6.6, 8.2)); } }
    if (t >= 8.2) { cx = W * 0.7; cy = fy; flip = -1; face = t < 11 ? 'cross' : 'shock'; }
    if (t >= 8.4) { dx = null; }
    if (t >= 11.2 && t < 13.4) { const k = prog(t, 11.2, 13.4); rot = k * Math.PI * 4; cy = fy - Math.sin(k * Math.PI) * 120; face = 'dizzy'; }
    if (t >= 13.4) { face = t < 13.8 ? 'dizzy' : 'happy'; sy = t < 13.7 ? 0.6 : 1; }
    cat(g, { x: cx, y: cy, s: 0.95, flip, face, talk: st.talk, rot, sx, sy, t, look: t < 5.8 ? look : 0, extra: t >= 8.4 && !(t >= 11.2 && t < 13.4) ? gg => { gg.fillStyle = 'rgba(255,0,0,0.35)'; gg.beginPath(); gg.arc(4, 10, 10, 0, 7); gg.fill(); gg.fillStyle = '#ff1a1a'; gg.beginPath(); gg.arc(4, 10, 4, 0, 7); gg.fill(); } : null });
    if (dx !== null) { g.fillStyle = 'rgba(255,0,0,0.3)'; g.beginPath(); g.arc(dx, dy, 14, 0, 7); g.fill(); g.fillStyle = '#ff1a1a'; g.beginPath(); g.arc(dx, dy, 6, 0, 7); g.fill(); }
    if (t >= 6.5 && t < 8.2) stars(g, W * 0.9, fy - 200, t);
    if (t >= 13.4 && t < 14.5) stars(g, cx + 20, fy - 190, t);
    title(g, W, H, t, 'Красная точка');
  } });

// 3. The tiny box
EP.push({ name: 'Коробка', dur: 17, cues: [[1.9, 'cat', 'Коробка! Она моя!'], [4.4, 'nar', 'Барсик, она слишком маленькая.'], [6.6, 'cat', 'Я кот. Коты — это жидкость.'], [8.8, 'sfx', 'zip'], [9.4, 'sfx', 'zip'], [10.0, 'sfx', 'zip'], [11.3, 'cat', 'Видите? Идеально!'], [13.4, 'sfx', 'pop'], [13.5, 'sfx', 'crash'], [14.6, 'nar', 'Нужна коробка побольше.'], [16.0, 'sfx', 'laugh']],
  draw(g, t, W, H, st) {
    room(g, W, H, '#fff0f5', '#ffd6e5');
    const fy = H * 0.86, bx = W * 0.6, bw = 90, bh = 60;
    const sq = prog(t, 8.6, 10.8), burst = t >= 13.4;
    let cx = W * 0.3, cy = fy, sy = 1, sx = 1, face = t < 4.4 ? 'happy' : t < 6.6 ? 'sad' : 'smug';
    if (t > 7.6 && t < 8.6) { cx = lerp(W * 0.3, bx - 10, prog(t, 7.6, 8.6)); }
    if (t >= 8.6 && !burst) { cx = bx - 10; sy = lerp(1, 0.35, ease(sq)); sx = lerp(1, 0.75, ease(sq)); cy = fy - 6 + Math.sin(t * 20) * (sq < 1 ? 3 : 0); face = sq < 1 ? 'shock' : 'happy'; }
    if (burst) { cx = bx; sy = lerp(0.35, 1, ease(prog(t, 13.4, 14))); sx = lerp(1.6, 1, ease(prog(t, 13.4, 14.4))); face = t < 14.5 ? 'dizzy' : 'happy'; }
    const wob = !burst && sq >= 1 ? Math.sin(t * 14) * 0.05 : 0;
    // box back
    if (!burst) { g.fillStyle = '#b07a3e'; g.fillRect(bx - bw / 2, fy - bh, bw, bh); }
    cat(g, { x: cx, y: cy, s: 0.95, face, talk: st.talk, sx, sy, t });
    if (!burst) {
      g.save(); g.translate(bx, fy); g.rotate(wob);
      g.fillStyle = '#d29a5a'; g.fillRect(-bw / 2, -bh * (sq > 0.3 ? 0.85 : 1), bw, bh * (sq > 0.3 ? 0.85 : 1));
      g.fillStyle = '#c08447'; g.beginPath(); g.moveTo(-bw / 2, -bh); g.lineTo(-bw / 2 - 26, -bh - 22); g.lineTo(-bw / 2 + 10, -bh - 6); g.fill(); g.beginPath(); g.moveTo(bw / 2, -bh); g.lineTo(bw / 2 + 26, -bh - 22); g.lineTo(bw / 2 - 10, -bh - 6); g.fill();
      g.strokeStyle = '#8a5a2b'; g.lineWidth = 3; g.strokeRect(-bw / 2, -bh, bw, bh);
      g.restore();
    } else {
      const k = prog(t, 13.4, 14.4);
      g.fillStyle = '#d29a5a'; for (const [ax, ay, r] of [[-1, -1, 1], [1, -1, -1], [-0.5, -1.4, 2], [0.6, -1.3, -2]]) { g.save(); g.translate(bx + ax * k * 180, fy - 40 + ay * k * 120 + k * k * 160); g.rotate(r * k * 3); g.fillRect(-30, -20, 60, 40); g.restore(); }
    }
    title(g, W, H, t, 'Коробка');
  } });

// 4. The vacuum cleaner
EP.push({ name: 'Пылесос', dur: 17, cues: [[2.0, 'nar', 'Барсик спит. Тихо-тихо...'], [5.0, 'sfx', 'vacuum'], [5.5, 'sfx', 'meow'], [5.6, 'sfx', 'slideUp'], [7.0, 'cat', 'Монстр! Он ест пыль и котов!'], [7.4, 'sfx', 'vacuum'], [10.4, 'sfx', 'bonk'], [12.0, 'cat', 'Теперь я — король пылесоса!'], [14.3, 'sfx', 'drum'], [15.4, 'sfx', 'laugh']],
  draw(g, t, W, H, st) {
    room(g, W, H, '#eef9e6', '#d6f0c7'); window_(g, 60, 40, 120, 100);
    const fy = H * 0.86;
    // the vacuum
    let vx = t < 5 ? W + 120 : Math.max(W * 0.62, W + 120 - (t - 5) * 400), shake = t > 5 && t < 10.4 ? Math.sin(t * 50) * 2 : 0;
    if (t > 12) vx = W * 0.62 - (t - 12) * 25;
    g.save(); g.translate(vx, fy + shake);
    g.fillStyle = '#3d7bd9'; g.beginPath(); g.roundRect(-60, -70, 120, 62, 20); g.fill();
    g.fillStyle = '#1e3f75'; g.beginPath(); g.arc(-36, -6, 12, 0, 7); g.arc(36, -6, 12, 0, 7); g.fill();
    g.fillStyle = t > 5 && t < 10.4 ? (Math.sin(t * 20) > 0 ? '#ff4d4d' : '#ffd34d') : '#555'; g.beginPath(); g.arc(40, -50, 7, 0, 7); g.fill();
    g.strokeStyle = '#444'; g.lineWidth = 8; g.beginPath(); g.moveTo(-60, -40); g.quadraticCurveTo(-120, -90, -140, -10); g.stroke();
    g.fillStyle = '#444'; g.fillRect(-170, -16, 50, 14);
    g.restore();
    // the cat
    let cx = W * 0.35, cy = fy, rot = 0, face = 'sleepy', poof = 0, flip = 1, s = 0.9, sy = 1;
    if (t < 5.5) { sy = 0.85 + Math.sin(t * 2) * 0.03; if (t > 2) { g.fillStyle = '#5b6b8c'; g.font = '800 28px Manrope'; g.fillText('Z', cx + 70 + Math.sin(t) * 8, fy - 160 - (t * 20 % 40)); g.fillText('z', cx + 95, fy - 190 - (t * 20 % 40)); } }
    if (t >= 5.5 && t < 10.4) {
      const k = prog(t, 5.8, 10.4), per = 2 * (W + H) * 0.75, d = k * per * 1.2, top = 50, left = 40, right = W - 40, bottom = fy;
      face = 'shock'; poof = 1;
      if (t < 5.8) { cy = fy - prog(t, 5.5, 5.8) * 100; }
      else { // run around the room: floor -> right wall -> ceiling -> left wall -> floor
        const seg = [[left, bottom, right, bottom, 0], [right, bottom, right, top, -Math.PI / 2], [right, top, left, top, Math.PI], [left, top, left, bottom, Math.PI / 2]];
        let rest = d % (2 * (right - left) + 2 * (bottom - top));
        for (const [x0, y0, x1, y1, r] of seg) { const L = Math.hypot(x1 - x0, y1 - y0); if (rest <= L) { cx = lerp(x0, x1, rest / L); cy = lerp(y0, y1, rest / L); rot = r; break; } rest -= L; }
        lines(g, cx, cy, 1);
      }
    }
    if (t >= 10.4) { cx = Math.min(W * 0.62, vx) - 10; cy = fy - 64; face = t < 11.6 ? 'dizzy' : 'happy'; flip = -1; if (t > 12) face = 'smug'; }
    cat(g, { x: cx, y: cy, s, flip, face, talk: st.talk, rot, poof, t, sy });
    if (t > 12) { g.save(); g.translate(cx - 22, cy - 180); g.fillStyle = '#ffd34d'; g.beginPath(); g.moveTo(-28, 0); g.lineTo(-28, -30); g.lineTo(-14, -14); g.lineTo(0, -36); g.lineTo(14, -14); g.lineTo(28, -30); g.lineTo(28, 0); g.fill(); g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(0, -10, 5, 0, 7); g.fill(); g.restore(); }
    title(g, W, H, t, 'Пылесос');
  } });

// 5. The mirror
EP.push({ name: 'Зеркало', dur: 18, cues: [[1.9, 'cat', 'Кто этот красивый котик?'], [7.0, 'cat', 'Эй! Ты меня повторяешь?!'], [10.6, 'sfx', 'meow'], [10.7, 'sfx', 'slideUp'], [11.6, 'cat', 'Он... мне подмигнул?!'], [13.4, 'nar', 'Барсик, это просто зеркало.'], [15.0, 'sfx', 'zip'], [15.6, 'cat', 'Никого нет...'], [16.8, 'sfx', 'laugh']],
  draw(g, t, W, H, st) {
    room(g, W, H, '#f3ecff', '#e0d2ff');
    const fy = H * 0.86, mx = W * 0.64, mw = 200, mh = 230;
    let face = t < 4.5 ? 'happy' : t < 6 ? 'normal' : t < 9 ? 'angry' : t < 10.5 ? 'tongue' : 'shock', poof = t > 10.5 && t < 12.5 ? 1 : 0;
    const paw = t > 4.5 && t < 6 ? Math.sin((t - 4.5) * 8) : 0;
    const cx = t < 14.8 ? W * 0.28 : lerp(W * 0.28, mx + mw * 0.55, prog(t, 14.8, 15.4));
    // mirror frame + glass + reflection
    g.fillStyle = '#d4af37'; g.beginPath(); g.ellipse(mx, fy - mh / 2 - 10, mw / 2 + 14, mh / 2 + 14, 0, 0, 7); g.fill();
    g.save(); g.beginPath(); g.ellipse(mx, fy - mh / 2 - 10, mw / 2, mh / 2, 0, 0, 7); g.clip();
    g.fillStyle = '#dff3ff'; g.fillRect(mx - mw, fy - mh - 40, mw * 2, mh + 60);
    if (t < 14.8) { const rface = t > 10.2 && t < 10.9 ? 'wink' : face; cat(g, { x: mx + 20, y: fy + 4, s: 0.8, flip: -1, face: rface, talk: t > 10.2 && t < 10.9 ? 0 : st.talk, poof: 0, t, extra: paw ? gg => { gg.fillStyle = ORANGE; gg.beginPath(); gg.ellipse(40, 30 - paw * 30, 12, 9, 0, 0, 7); gg.fill(); } : null }); }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(mx - 60, fy - mh); g.lineTo(mx - 20, fy - mh); g.lineTo(mx - 90, fy - 30); g.lineTo(mx - 120, fy - 30); g.fill();
    g.restore();
    // the real cat (and later, peeking behind the mirror)
    if (t < 15.4) cat(g, { x: cx, y: fy, s: 0.95, face, talk: st.talk, poof, t, extra: paw ? gg => { gg.fillStyle = ORANGE; gg.beginPath(); gg.ellipse(40, 30 - paw * 30, 12, 9, 0, 0, 7); gg.fill(); } : null });
    else cat(g, { x: mx + mw / 2 + 50, y: fy, s: 0.95, flip: -1, face: t < 16.5 ? 'cross' : 'sad', talk: st.talk, t });
    title(g, W, H, t, 'Зеркало');
  } });

// 6. The cup
EP.push({ name: 'Чашка', dur: 16, cues: [[2.6, 'nar', 'Барсик, не делай этого.'], [5.2, 'cat', 'Мяу.'], [7.0, 'nar', 'Барсик! Нет!'], [8.6, 'sfx', 'whoosh'], [9.4, 'sfx', 'crash'], [10.6, 'cat', 'Это не я. Она сама упала.'], [13.0, 'sfx', 'laugh'], [14.4, 'sfx', 'meow']],
  draw(g, t, W, H, st) {
    room(g, W, H, '#fff7e0', '#ffe9a8'); window_(g, W * 0.08, 40, 120, 100);
    const fy = H * 0.86, ty = fy - 130, tx0 = W * 0.28, tx1 = W * 0.72;
    // table
    g.fillStyle = '#8a5a2b'; g.fillRect(tx0, ty, tx1 - tx0, 16); g.fillRect(tx0 + 14, ty, 14, fy - ty); g.fillRect(tx1 - 28, ty, 14, fy - ty);
    // the cup slides to the edge in little pushes, then falls
    const pushes = [[1.6, 0.35], [4.0, 0.62], [8.4, 1.15]];
    let off = 0; for (const [at, to] of pushes) if (t > at) off = lerp(off, to, ease(prog(t, at, at + 0.4)));
    let cupX = tx1 - 120 + off * 120;
    let cupY = ty, cupR = 0;
    if (t > 8.8) { const k = prog(t, 8.8, 9.4); cupY = lerp(ty, fy, k * k); cupR = k * 2.5; cupX += k * 30; }
    if (t < 9.4) {
      g.save(); g.translate(cupX, cupY); g.rotate(cupR);
      g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect(-18, -34, 36, 34, 6); g.fill(); g.strokeStyle = '#ccc'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.arc(20, -18, 9, -1.4, 1.4); g.stroke();
      g.fillStyle = '#e74c3c'; g.beginPath(); g.arc(0, -18, 6, 0, 7); g.fill();
      if (cupR === 0) { g.strokeStyle = 'rgba(150,150,150,0.6)'; g.lineWidth = 3; for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(-6 + i * 10, -40); g.quadraticCurveTo(-12 + i * 10 + Math.sin(t * 3) * 4, -55, -4 + i * 10, -70); g.stroke(); } }
      g.restore();
    } else { g.fillStyle = '#fff'; for (let i = 0; i < 7; i++) { const k = prog(t, 9.4, 10); g.save(); g.translate(cupX + (i - 3) * 22 * k, fy - 6 - Math.sin(i) * 10 * (1 - k)); g.rotate(i); g.fillRect(-6, -4, 12, 8); g.restore(); } }
    // the cat on the table, looking right at us while pushing
    const pushing = pushes.some(([at]) => t > at && t < at + 0.5);
    const lookAtUs = t > 1 && t < 10.4;
    const face = t < 10.4 ? (t > 5 && t < 6 ? 'smug' : lookAtUs ? 'normal' : 'happy') : 'happy';
    cat(g, { x: cupX - 95, y: ty, s: 0.85, face, talk: st.talk, t, lookY: lookAtUs ? 0.3 : 0, look: lookAtUs ? -0.2 : 0,
      extra: gg => { if (pushing) { gg.fillStyle = ORANGE; gg.beginPath(); gg.ellipse(66, 86, 16, 10, 0, 0, 7); gg.fill(); } if (t > 10.4) { gg.strokeStyle = '#ffd34d'; gg.lineWidth = 5; gg.beginPath(); gg.ellipse(0, -62 + Math.sin(t * 3) * 3, 30, 8, 0, 0, 7); gg.stroke(); } } });
    title(g, W, H, t, 'Чашка');
  } });

// A player bound to a canvas texture; plays the voices and sounds only while you're watching.
export class CinemaShow {
  constructor(canvas, say, sfx) { this.cv = canvas; this.g = canvas.getContext('2d'); this.sfx = sfx; this.i = 0; this.t = 0; this.done = new Set(); this.talking = false; this.clock = 0; }
  update(dt, watching) {
    const ep = EP[this.i], W = this.cv.width, H = this.cv.height;
    this.t += dt; this.clock += dt;
    if (this.t > ep.dur) { this.i = (this.i + 1) % EP.length; this.t = 0; this.done.clear(); this.talking = false; if (window.speechSynthesis && watching) speechSynthesis.cancel(); return true; }
    ep.cues.forEach(([at, who, text], k) => {
      if (this.t < at || this.done.has(k)) return; this.done.add(k);
      if (!watching) return;
      if (who === 'sfx') this.sfx(text);
      else if (who === 'cat') voice(text, 'ru', { pitch: 1.9, rate: 1.12, onTalk: v => { this.talking = v; } });
      else voice(text, 'ru', { pitch: 0.75, rate: 0.92 });
    });
    if (!watching) return false;
    const st = { talk: this.talking ? 0.5 + 0.5 * Math.sin(this.clock * 26) : 0 };
    this.g.save(); ep.draw(this.g, this.t, W, H, st); this.g.restore();
    // a soft vignette, like a cinema projector
    const vg = this.g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.35)'); this.g.fillStyle = vg; this.g.fillRect(0, 0, W, H);
    return true;
  }
}
