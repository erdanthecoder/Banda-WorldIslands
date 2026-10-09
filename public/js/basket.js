// Basketball on the court by the stadium. Red attacks the east hoop (x > court centre), blue the west one.
// The same ball physics and bot brain run the real match and the casual game bots play when nobody is around.
import { COURT } from './world.js';

const G = 9.8, RIM_R = 0.42;
export const RIM_Y = COURT.h + 3.05;
export const hoop = sx => ({ x: COURT.x + sx * (COURT.hw - 1.0), y: RIM_Y, z: COURT.z });
export const attackSide = team => team === 'red' ? 1 : -1;
const rand = (a, b) => a + Math.random() * (b - a);

export function freshBall() { return { x: COURT.x, y: COURT.h + 0.3, z: COURT.z, vx: 0, vy: 0, vz: 0, holder: null }; }

// a shot from (x, z) at the hoop on side sx. skill 0..1: higher means fewer misses.
export function shot(x, z, sx, skill = 0.5) {
  const H = hoop(sx), D = Math.hypot(H.x - x, H.z - z), y0 = COURT.h + 2.1;
  const chance = Math.max(0.2, Math.min(0.92, 0.95 - D * 0.06 + skill * 0.15));
  let tx = H.x - sx * 0.05, tz = H.z;
  if (Math.random() > chance) { const a = rand(0, 6.28), m = rand(0.45, 0.9); tx += Math.cos(a) * m; tz += Math.sin(a) * m; }
  const T = 0.55 + D * 0.07, ty = RIM_Y + 0.05;
  return { x, y: y0, z, vx: (tx - x) / T, vz: (tz - z) / T, vy: (ty - y0 + 0.5 * G * T * T) / T, holder: null, pts: D > 7 ? 3 : 2 };
}

// moves the ball one step. posOf(id) -> {x, z, ry} of whoever holds it. Returns the hoop side (±1) when it goes in.
export function step(b, dt, posOf, t) {
  const C = COURT;
  if (b.holder) {
    const p = posOf(b.holder);
    if (p) { b.x = p.x + Math.sin(p.ry) * 0.55; b.z = p.z + Math.cos(p.ry) * 0.55; b.y = C.h + 0.3 + Math.abs(Math.sin(t * 8)) * 0.75; b.vx = b.vy = b.vz = 0; return 0; }
    b.holder = null;
  }
  const py = b.y;
  b.vy -= G * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
  let scored = 0;
  for (const sx of [-1, 1]) {
    const H = hoop(sx), bx = C.x + sx * (C.hw - 0.45);
    // backboard
    if ((b.x - bx) * sx > 0 && (b.x - b.vx * dt - bx) * sx <= 0 && Math.abs(b.z - H.z) < 0.95 && b.y > RIM_Y - 0.25 && b.y < RIM_Y + 1.15) { b.x = bx - sx * 0.02; b.vx *= -0.45; }
    // through the rim, going down
    if (b.vy < 0 && py >= RIM_Y && b.y < RIM_Y) {
      const d = Math.hypot(b.x - H.x, b.z - H.z);
      if (d < RIM_R) { scored = sx; b.vx *= 0.2; b.vz *= 0.2; }
      else if (d < RIM_R + 0.18) { b.vy = Math.abs(b.vy) * 0.4; b.vx += (b.x - H.x) * 2; b.vz += (b.z - H.z) * 2; } // off the rim
    }
  }
  const floor = C.h + 0.2;
  if (b.y < floor) { b.y = floor; b.vy = Math.abs(b.vy) > 1.2 ? -b.vy * 0.62 : 0; b.vx *= 0.8; b.vz *= 0.8; }
  if (Math.abs(b.x - C.x) > C.hw + 1.5) { b.x = C.x + Math.sign(b.x - C.x) * (C.hw + 1.5); b.vx *= -0.5; }
  if (Math.abs(b.z - C.z) > C.hd + 1.5) { b.z = C.z + Math.sign(b.z - C.z) * (C.hd + 1.5); b.vz *= -0.5; }
  return scored;
}

// The bot brain. ctx: { ball, team(id), me: bot, all: [{id, x, z, team}], grab(id), shoot(id, sx), steal(id, from), moveTo(tx, tz, sp) }
export function brain(b, ctx, dt) {
  const ball = ctx.ball, my = ctx.team(b.id), sx = attackSide(my), H = hoop(sx), own = hoop(-sx);
  b.cd = (b.cd || 0) - dt;
  const players = ctx.all, mates = players.filter(p => p.team === my), foes = players.filter(p => p.team && p.team !== my);
  const holder = ball.holder ? players.find(p => p.id === ball.holder) : null;
  if (ball.holder === b.id) {
    b.hold = (b.hold || 0) + dt;
    const D = Math.hypot(H.x - b.x, H.z - b.z);
    b.range ||= rand(2.5, 7.5);
    if ((D < b.range && b.cd <= 0) || b.hold > 6) { b.hold = 0; b.range = 0; b.cd = 1.2; return ctx.shoot(b.id, sx); }
    // pass now and then to a teammate who is closer to the hoop
    const open = mates.filter(m => m.id !== b.id && Math.hypot(H.x - m.x, H.z - m.z) < D - 2)[0];
    if (open && b.hold > 1.5 && Math.random() < dt * 0.8) { b.hold = 0; return ctx.pass(b.id, open.id); }
    b.lane ??= rand(-3.5, 3.5);
    return ctx.moveTo(H.x - sx * 3, H.z + b.lane, 4.2);
  }
  if (!holder) { // loose ball: the closest player of each team goes for it
    const mine = mates.slice().sort((p, q) => Math.hypot(p.x - ball.x, p.z - ball.z) - Math.hypot(q.x - ball.x, q.z - ball.z))[0];
    if (mine && mine.id === b.id) { ctx.moveTo(ball.x, ball.z, 5); if (Math.hypot(ball.x - b.x, ball.z - b.z) < 1.0 && ball.y < COURT.h + 1.8 && b.cd <= 0) ctx.grab(b.id); return; }
  } else if (holder.team !== my) { // defend: the closest one presses and tries to steal
    const presser = mates.slice().sort((p, q) => Math.hypot(p.x - holder.x, p.z - holder.z) - Math.hypot(q.x - holder.x, q.z - holder.z))[0];
    if (presser && presser.id === b.id) {
      ctx.moveTo(holder.x + (own.x - holder.x) * 0.15, holder.z + (own.z - holder.z) * 0.15, 4.6);
      if (Math.hypot(holder.x - b.x, holder.z - b.z) < 1.3 && b.cd <= 0) { b.cd = 1; ctx.steal(b.id, holder.id); }
      return;
    }
    const k = mates.findIndex(m => m.id === b.id);
    return ctx.moveTo(own.x - sx * (4 + k), own.z + (k % 2 ? 3 : -3), 3.6);
  }
  // our ball or someone else is going for it: get open near the hoop
  const k = mates.findIndex(m => m.id === b.id);
  ctx.moveTo(H.x - sx * (3 + (k % 3) * 1.5), H.z + (k % 2 ? 1 : -1) * (2 + k), 3.8);
}
