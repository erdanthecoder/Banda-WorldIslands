// Bots: computer players. They walk around when the server is quiet and fill minigames
// so even one player can play. One client (the host) simulates them and shares their positions.
import * as THREE from 'three';
import { Avatar, SKINS, HAIR_COLORS, CLOTH, PANTS, SHOES, HAIRSTYLES, TOPS, FACES } from './avatar.js';
import { heightAt, isl, PITCH, COURT, RESTO, CAFE_SPOT, MALL, MALL_DOOR, labelSprite } from './world.js';
import { freshBall, step as bbStep, brain as bbBrain, shot as bbShot, attackSide } from './basket.js';
import { PLACES } from './jobs.js';
import { PIER } from './fishing.js';

const NAMES = ['Aru', 'Timur', 'Dana', 'Max', 'Lina', 'Emir', 'Sofia', 'Nurlan', 'Ali', 'Mira', 'Adel', 'Zara', 'Bek', 'Aya', 'Kanat', 'Saule', 'Erlan', 'Aidana', 'Daniyar', 'Malika', 'Ruslan', 'Asel', 'Islam', 'Kamila', 'Arman', 'Dilnaz', 'Murat', 'Ayim', 'Nursultan', 'Tomiris'];
// the way from the plaza to a place, along the paved paths
function routeTo(b, P) {
  const via = { coffee: [[0, -24], [0, -33.5], [-12, -33.5]], bank: [[0, -24], [0, -33.5]], resto: [[0, -24], [0, -33.5]], tower: [[0, -24]],
    market: [[-22, 10]], playground: [[22, 10]], stadium: [[0, 24]], court: [[0, 24], [0, 58]], pier: [[22, 10], [40, 30], [92, 30]], mall: [[-22, 10], [-42.5, 10], [-42.5, MALL_DOOR + 6.5], [MALL.x, MALL_DOOR + 6.5]] };
  const k = Object.keys(PLACES).find(n => PLACES[n] === P);
  return [...(via[k] || []).map(([x, z]) => [x + (Math.random() - 0.5), z]), [P.x, P.z]];
}
// things bots walk around instead of through (the plaza fountain)
const OBST = [{ x: 0, z: 0, r: 6.2 }];
const HUB = isl('hub');
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
export const WANT = { football: 6, basketball: 6, dodgeball: 4, hide: 5, starhunt: 4, impostor: 6, quiz: 4 };

export function botAvatar(seed) {
  let s = seed * 9301 + 49297; const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const p = a => a[Math.floor(r() * a.length)];
  return { skin: p(SKINS), face: p(FACES), hair: p(HAIRSTYLES), hairColor: p(HAIR_COLORS), top: p(TOPS), shirt: p(CLOTH), pants: p(PANTS), shoes: p(SHOES), hat: 'none', pet: 'none', height: 0.92 + r() * 0.14 };
}
export function makeBots(n, prefix) {
  const out = {}, used = new Set();
  for (let i = 0; i < n; i++) { let nm; do nm = pick(NAMES); while (used.has(nm) && used.size < NAMES.length); used.add(nm); out[`bot-${prefix}${i}`] = { name: prefix === 'a' ? nm : `Bot ${i + 1}`, avatar: botAvatar(Math.floor(Math.random() * 1e6)) }; }
  return out;
}

export class Bots {
  constructor(app) {
    this.app = app; this.b = {}; this.sent = 0; this.seen = {}; this.count = 10; this.hoop = freshBall(); this.bubbles = {};
    app.onEvent(ev => {
      const d = ev.data || {};
      if (ev.type === 'bots' && !this.amHost()) this.receive(ev.data);
      if (ev.type === 'hoop' && !this.amHost()) Object.assign(this.hoop, d);
      if (ev.type === 'botGuide' && this.amHost()) this.startGuide(d);
      if (ev.type === 'botSay') this.bubble(d.id, d.text, d.to === app.me.pid);
    });
    this.talkUI();
  }
  get mgs() { return this.app.mg; }
  humans() { return [this.app.me.pid, ...Object.keys(this.app.players)]; }
  amHost() { const m = this.mgs; if (m && m.running()) return m.isHost(); return this.humans().sort()[0] === this.app.me.pid; }
  name(id) { return this.b[id]?.name || this.seen[id]?.name; }
  setCount(n) { n = Math.max(0, Math.min(30, n | 0)); if (n === this.count) return; this.count = n; this.clear('bot-a'); }

  spawn(id, info, x, z, extra = {}) {
    const b = this.b[id] = { id, name: info.name, avatar: info.avatar, x, z, y: heightAt(x, z), ry: 0, speed: 0, wait: 0, tx: x, tz: z, ...extra };
    return b;
  }
  clear(prefix) { for (const id in this.b) if (!prefix || id.startsWith(prefix)) { const b = this.b[id]; if (b.seat) b.seat.taken = null; delete this.b[id]; this.app.world.upsertRemote(id, null); } }

  // ---- movement helpers ----
  moveTo(b, tx, tz, sp, dt, floor) {
    const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
    if (d < 0.15) { b.speed = 0; return true; }
    let ux = dx / d, uz = dz / d;
    // steer around the fountain: if it is in the way, walk along its edge
    for (const o of OBST) {
      const ox = o.x - b.x, oz = o.z - b.z, od = Math.hypot(ox, oz);
      if (od > o.r + 4 || Math.hypot(tx - o.x, tz - o.z) < o.r) { b.side = 0; continue; }
      const ahead = ox * ux + oz * uz, side = ox * uz - oz * ux;
      // pick a side once and keep it until we're past, so we don't wobble back and forth
      if (ahead > 0 && Math.abs(side) < o.r + 0.3) { const s = b.side ||= side > 0 ? 1 : -1, tgx = oz / od * s, tgz = -ox / od * s; ux = ux * 0.25 + tgx; uz = uz * 0.25 + tgz; const l = Math.hypot(ux, uz); ux /= l; uz /= l; }
      else b.side = 0;
    }
    const step = Math.min(d, sp * dt); b.x += ux * step; b.z += uz * step; b.ry = Math.atan2(ux, uz); b.speed = sp;
    for (const o of OBST) { const ox = b.x - o.x, oz = b.z - o.z, od = Math.hypot(ox, oz); if (od < o.r - 0.6 && od > 0.01) { b.x = o.x + ox / od * (o.r - 0.6); b.z = o.z + oz / od * (o.r - 0.6); } }
    b.y = floor ?? heightAt(b.x, b.z);
    return d < 0.6;
  }
  wander(b, dt, cx, cz, rMin, rMax, sp = 2.2, floor) {
    if (b.wait > 0) { b.wait -= dt; b.speed = 0; return; }
    if (this.moveTo(b, b.tx, b.tz, sp, dt, floor)) { b.wait = rand(1.5, 6); const a = rand(0, 6.28), r = rand(rMin, rMax); b.tx = cx + Math.cos(a) * r; b.tz = cz + Math.sin(a) * r; }
  }
  // walk a list of points; returns true at the end
  path(b, dt, sp = 2.4) {
    const p = b.route && b.route[0]; if (!p) return true;
    if (this.moveTo(b, p[0], p[1], sp, dt, p[2]) || (b.rt = (b.rt || 0) + dt) > 30) { b.route.shift(); b.rt = 0; }
    return !b.route.length;
  }

  tick(dt) {
    const app = this.app, mg = this.mgs && this.mgs.mg, running = this.mgs && this.mgs.running() && this.mgs.active;
    this.bubbleTick(dt);
    if (!this.amHost()) { this.hoopDraw(dt, running); return; }
    // ambient bots: they live their own lives on the island (and help you if you talk to them)
    const ambient = !running;
    const ambIds = Object.keys(this.b).filter(id => id.startsWith('bot-a'));
    if (ambient && !ambIds.length && this.count) {
      const bs = makeBots(this.count, 'a');
      for (const id in bs) { const a = rand(0, 6.28), r = rand(8, 20); const b = this.spawn(id, bs[id], HUB.x + Math.cos(a) * r, HUB.z + Math.sin(a) * r); b.tx = b.x; b.tz = b.z; b.next = rand(2, 15); }
    }
    if (!ambient && ambIds.length) this.clear('bot-a');
    for (const id in this.b) {
      const b = this.b[id];
      if (id.startsWith('bot-a')) this.life(b, dt);
      else if (running && mg.bots && mg.bots[id]) this.play(b, mg, dt);
    }
    if (ambient) this.hoops(dt);
    // render locally and share with others ~6 times a second
    const w = app.world, list = Object.values(this.b).map(b => ({ id: b.id, name: b.name, role: 'bot', avatar: b.avatar, x: +b.x.toFixed(2), y: +b.y.toFixed(2), z: +b.z.toFixed(2), ry: +b.ry.toFixed(2), sh: b.sh || 0, team: b.team, em: b.em || '' }));
    list.forEach(d => { const r = w.remotes[d.id]; if (r) { r.d = d; r.pos.set(d.x, d.y, d.z); } else w.upsertRemote(d.id, d, dd => new Avatar(dd.avatar, dd.name, 'bot')); });
    for (const id in w.remotes) if (id.startsWith('bot-') && !this.b[id]) w.upsertRemote(id, null);
    if (performance.now() - this.sent > 170) {
      this.sent = performance.now(); if (list.length || this.hadBots) app.net.emit('bots', list); this.hadBots = list.length > 0;
      if (ambient && this.hoopOn) { const h = this.hoop; app.net.emit('hoop', { x: +h.x.toFixed(2), y: +h.y.toFixed(2), z: +h.z.toFixed(2) }); }
    }
    this.hoopDraw(dt, running);
  }
  receive(list) {
    const w = this.app.world, ids = new Set();
    (list || []).forEach(d => { ids.add(d.id); this.seen[d.id] = d; w.upsertRemote(d.id, d, dd => new Avatar(dd.avatar, dd.name, 'bot')); });
    for (const id in w.remotes) if (id.startsWith('bot-') && !ids.has(id)) w.upsertRemote(id, null);
  }
  emote(b, name) { b.em = name + ':' + Math.floor(performance.now()); }

  // ---- what an ambient bot does: pick something useful, do it, pick the next thing ----
  life(b, dt) {
    // with several shows running, each bot picks one of them (and stays with it)
    const spots = this.app.showSpots || [], seed = b.id.charCodeAt(b.id.length - 1) + b.id.length;
    const show = spots.length ? spots[seed % spots.length] : null;
    if (show && b.spot && b.spotKind !== show.kind) { b.spot = null; b.em = ''; }
    if (b.guide) return this.guide(b, dt);
    // dance party: stop where you are and dance
    if (b.danceUntil > performance.now()) { b.speed = 0; if (!b.em || !b.em.startsWith('dance')) this.emote(b, 'dance'); return; }
    if (show && b.act !== 'show') { this.endAct(b); b.act = 'show'; b.route = null; }
    if (b.act === 'show') {
      if (!show) { b.act = null; b.em = ''; return; }
      if (!b.spot) { const a = rand(0, 6.28), r = rand(show.r * 0.6, show.r + 4); b.spot = [show.x + Math.cos(a) * r, show.z + Math.sin(a) * r]; b.spotKind = show.kind; }
      if (this.moveTo(b, b.spot[0], b.spot[1], 3.2, dt)) { b.speed = 0; b.ry = Math.atan2(show.x - b.x, (show.kind === 'concert' ? 15 : show.z) - b.z); if (!b.em || !b.em.startsWith('dance')) this.emote(b, 'dance'); }
      return;
    }
    if (!b.act) {
      if ((b.next -= dt) > 0) return this.wander(b, dt, HUB.x, HUB.z, 8, 21);
      const hoopers = Object.values(this.b).filter(o => o.act === 'hoops').length;
      const opts = ['tower', 'tower', 'bank', 'coffee', 'resto', 'resto', 'plaza', 'fish', 'mall', 'mall'];
      if (hoopers < 4) opts.push('hoops', 'hoops', 'hoops');
      b.act = pick(opts); b.route = null; b.step = 0; b.em = '';
      if (b.act === 'plaza') { b.act = null; b.next = rand(10, 25); return; }
    }
    const done = this['_' + b.act](b, dt);
    if (done) this.endAct(b);
  }
  endAct(b) { if (b.seat) { b.seat.taken = null; b.seat = null; } if (b.lift && b.lift.e) b.lift.e.botBusy = null; b.act = null; b.lift = null; b.route = null; b.em = ''; b.next = rand(8, 25); b.spot = null; b.y = heightAt(b.x, b.z); }

  // a coffee at Island Coffee
  _coffee(b, dt) {
    if (!b.route && !b.step) { b.route = [[rand(-1, 1), -24], [rand(-1, 1), -33.5], [-12, -33.5], [CAFE_SPOT.x + rand(1, 3), CAFE_SPOT.z + rand(1, 3)]]; b.step = 1; }
    if (b.step === 1) { if (this.path(b, dt)) { b.step = 2; b.t = rand(5, 9); this.emote(b, 'wave'); } return false; }
    if (b.step === 2) { b.speed = 0; if ((b.t -= dt) < 0) { b.route = [[-12, -33.5], [rand(-1, 1), -33.5], [rand(-1, 1), -24]]; b.step = 3; } return false; }
    return this.path(b, dt);
  }
  // lunch at the restaurant: find a free chair, sit, eat, leave
  _resto(b, dt) {
    const R = this.app.resto; if (!R) return true;
    if (!b.step) {
      const seat = R.seats.filter(s => !s.taken)[Math.floor(Math.random() * 12)] || R.seats.find(s => !s.taken); if (!seat) return true;
      seat.taken = b.id; b.seat = seat; b.step = 1;
      b.route = [[rand(-1, 1), -24], [rand(-1, 1), -33.5], [R.minX - 3, R.z], [R.minX + 2, R.z], [seat.x, R.z], [seat.x, seat.z]];
    }
    if (b.step === 1) { if (this.path(b, dt)) { b.step = 2; b.t = rand(18, 35); b.ry = b.seat.ry; this.emote(b, 'sit'); } return false; }
    if (b.step === 2) { b.speed = 0; b.ry = b.seat.ry; if ((b.t -= dt) < 0) { const s = b.seat; s.taken = null; b.seat = null; b.route = [[s.x, R.z], [R.minX + 2, R.z], [R.minX - 3, R.z], [rand(-1, 1), -33.5], [rand(-1, 1), -24]]; b.step = 3; b.em = ''; } return false; }
    return this.path(b, dt);
  }
  // a visit to mBank: walk there, wait in line at a desk, get served, walk back
  _bank(b, dt) {
    const B = this.app.mbank; if (!B) return true;
    if (!b.step) {
      b.desk = Math.floor(Math.random() * 3); const zz = B.z + rand(-1.2, 1.2);
      B.q ||= [[], [], []];
      b.there = [[rand(-1, 1), -24], [rand(-1.5, 1.5), -33.5], [B.maxX + 3, zz], [B.maxX - 2, zz]];
      b.route = b.there.slice(); b.step = 1;
    }
    if (b.step === 1) { if (this.path(b, dt)) { b.step = 2; b.t = 0; } return false; }
    if (b.step === 2) {
      const q = B.q[b.desk];
      for (let j = q.length - 1; j >= 0; j--) if (!this.b[q[j]]) q.splice(j, 1);
      if (!q.includes(b.id)) q.push(b.id);
      const k = q.indexOf(b.id), f = B.deskFront[b.desk], there = this.moveTo(b, f.x + k * 1.4, f.z, 1.6, dt);
      if (there) { b.speed = 0; b.ry = -Math.PI / 2; }
      b.t += dt;
      if (k === 0 && there) { b.served = (b.served || 0) + dt; if (b.served > 0.3 && !b.waved) { b.waved = 1; B.staff[b.desk].play('wave'); } if (b.served > 5) { q.splice(q.indexOf(b.id), 1); b.served = 0; b.waved = 0; b.step = 3; b.route = b.there.slice().reverse(); } }
      if (b.t > 90) { const j = q.indexOf(b.id); if (j >= 0) q.splice(j, 1); b.step = 3; b.route = b.there.slice().reverse(); }
      return false;
    }
    return this.path(b, dt);
  }

  // shopping at the Pentagon Mall: a shop counter, then a rest on a bench in the atrium
  _mall(b, dt) {
    const M = this.app.mall; if (!M) return true;
    const out = [[-22, 10], [-42.5, 10], [-42.5, MALL_DOOR + 6.5], [M.x, MALL_DOOR + 6.5], [M.x, MALL_DOOR - 3]];
    if (!b.step) {
      const shop = pick(M.fronts).a / Math.PI * 180 + rand(-5, 5), free = M.seats.filter(s => !s.by), seat = free.length ? pick(free) : pick(M.seats), sa = seat.a / Math.PI * 180;
      b.route = [...out, ...M.route(0, M.ap - 3, shop, M.front + 0.4)]; b.bench = M.route(shop, M.front, sa, seat.r); b.back = [...M.route(sa, seat.r, 0, M.ap - 3)]; b.seat = seat; seat.by = b; b.step = 1;
    }
    if (b.step === 1) { if (this.path(b, dt)) { b.step = 2; b.t = rand(6, 14); this.emote(b, 'wave'); } return false; }
    if (b.step === 2) { b.speed = 0; if ((b.t -= dt) < 0) { b.step = 3; b.route = b.bench; b.em = ''; } return false; }
    if (b.step === 3) { if (this.path(b, dt)) { b.step = 4; b.t = rand(8, 18); this.emote(b, 'sit'); } return false; }
    if (b.step === 4) { b.speed = 0; if ((b.t -= dt) < 0) { b.step = 5; b.em = ''; if (b.seat && b.seat.by === b) b.seat.by = null; b.route = [...b.back, ...out.slice().reverse()]; } return false; }
    return this.path(b, dt);
  }
  // a little fishing at the end of the pier
  _fish(b, dt) {
    const P = PIER;
    if (!b.step) { b.route = [[22, 10], [40, 30], [92, 30], [P.x0 - 2, P.z], [P.x0 + 1, P.z, P.y], [P.x1 + rand(0, 3), P.z + rand(-2.5, 2.5), P.y]]; b.step = 1; }
    if (b.step === 1) { if (this.path(b, dt)) { b.step = 2; b.t = rand(20, 45); b.ry = Math.PI / 2; this.emote(b, 'sit'); } return false; }
    if (b.step === 2) { b.speed = 0; b.y = P.y; b.ry = Math.PI / 2; if ((b.t -= dt) < 0) { b.em = ''; b.step = 3; b.route = [[P.x0 + 1, P.z, P.y], [P.x0 - 2, P.z], [92, 30], [40, 30], [22, 10]]; } return false; }
    return this.path(b, dt);
  }
  // ---- World Tower: walk in, take the lift to a floor, look around, take it back down ----
  _tower(b, dt) {
    const T = this.app.tower; if (!T) return true;
    if (!b.step) {
      const e = T.elevators.slice().sort((a, c) => (a.botBusy ? 1 : 0) - (c.botBusy ? 1 : 0) || Math.random() - 0.5)[0];
      const fz = T.z + T.round, lv = 1 + Math.floor(Math.random() * (T.floors - 1));
      b.out = [[rand(-1.5, 1.5), -22], [rand(-1.5, 1.5), fz - 1], [rand(-1.5, 1.5), fz - 9]];
      b.tw = { e, lv }; b.route = [...b.out.map(([x, z]) => [x, z]), [e.cx + rand(-0.8, 0.8), e.cz + 3.3]]; b.step = 1;
    }
    const { e, lv } = b.tw;
    if (b.step === 1) { if (this.path(b, dt)) { b.step = 2; b.lift = { e, from: 0, to: lv, st: 'wait', t: 0 }; } return false; }
    if (b.step === 2) { if (this.lift(b, dt)) { b.step = 3; b.t = rand(15, 35); b.tx = b.x; b.tz = b.z; b.wait = 0; } return false; }
    if (b.step === 3) {
      const y = T.floorY(lv);
      if (b.wait > 0) { b.wait -= dt; b.speed = 0; }
      else if (this.moveTo(b, b.tx, b.tz, 2, dt, y)) { b.wait = rand(1, 4); const a = rand(0, 6.28), r = rand(4, T.round - 6); b.tx = T.x + Math.sin(a) * r; b.tz = Math.max(T.minZ + 6, T.z + Math.cos(a) * r); }
      b.y = y;
      if ((b.t -= dt) < 0) { b.step = 4; b.route = [[e.cx + rand(-0.8, 0.8), e.cz + 3.3, y]]; }
      return false;
    }
    if (b.step === 4) { if (this.path(b, dt)) { b.step = 5; b.lift = { e, from: lv, to: 0, st: 'wait', t: 0 }; } return false; }
    if (b.step === 5) { if (this.lift(b, dt)) { b.step = 6; b.route = b.out.slice().reverse().map(([x, z]) => [x, z, T.contains(x, z) ? T.floorY(0) : undefined]); } return false; }
    return this.path(b, dt);
  }
  // one lift ride: wait at the doors (calling the lift), hold the doors and step in, ride, step out
  lift(b, dt) {
    const L = b.lift, e = L.e, T = this.app.tower, here = lv => e.level === lv && e.state === 'idle' && e.open > 0.6;
    const landZ = e.cz + 3.3, fy = T.floorY(L.from);
    L.t += dt;
    if (L.st === 'wait') {
      b.y = fy; b.speed = 0; b.ry = Math.PI;
      if (here(L.from)) { e.dwell = Math.max(e.dwell, 1.5); L.st = 'board'; return false; }
      if (!L.called || L.t - L.called > 5) { L.called = L.t || 0.01; e.go(L.from); }
      if (L.t > 60) { // this lift seems stuck: try the other one
        const o = T.elevators.find(x => x !== e); if (o) { L.e = o; L.t = 0; L.called = 0; b.route = [[o.cx + rand(-0.8, 0.8), o.cz + 3.3, fy]]; L.st = 'walkover'; }
      }
      return false;
    }
    if (L.st === 'walkover') { if (this.path(b, dt)) L.st = 'wait'; return false; }
    if (L.st === 'board') {
      if (!here(L.from)) { L.st = 'back'; return false; } // doors closed before we got in
      e.dwell = Math.max(e.dwell, 1.2);
      if (this.moveTo(b, e.cx + (b.id.charCodeAt(b.id.length - 1) % 3 - 1) * 0.7, e.cz - 0.2, 2.6, dt, fy)) { L.st = 'ride'; L.t = 0; L.asked = 0; }
      return false;
    }
    if (L.st === 'back') { b.y = fy; if (this.moveTo(b, b.x, landZ, 2.4, dt, fy)) { L.st = 'wait'; L.t = 0; L.called = 0; } return false; }
    if (L.st === 'ride') {
      b.speed = 0; b.y = e.y; b.ry = 0;
      if ((L.asked -= dt) <= 0) { L.asked = 3; if (e.level !== L.to && e.target !== L.to && !e.q.includes(L.to)) e.go(L.to); }
      if (here(L.to) && L.t > 1) { L.st = 'out'; }
      return false;
    }
    if (L.st === 'out') {
      const ty = T.floorY(L.to); e.dwell = Math.max(e.dwell, 1.0); b.y = ty;
      if (this.moveTo(b, b.x, landZ, 2.6, dt, ty)) { b.lift = null; return true; }
      return false;
    }
    return false;
  }

  // ---- casual basketball on the court so you can see a game (and join with the 🏀 pad) ----
  _hoops(b, dt) {
    const C = COURT;
    if (!b.step) { b.route = [[rand(-1.5, 1.5), 22], [rand(-1.5, 1.5), 58], [C.x - C.hw - 2, C.z + rand(-5, 5)]]; b.step = 1; b.t = rand(60, 120); }
    if (b.step === 1) { if (this.path(b, dt, 3)) { b.step = 2; const n = Object.values(this.b).filter(o => o.act === 'hoops' && o.step === 2).length; b.hteam = n % 2 ? 'blue' : 'red'; } return false; }
    if (b.step === 2) {
      b.y = C.h;
      if ((b.t -= dt) < 0) { if (this.hoop.holder === b.id) this.hoop.holder = null; b.step = 3; b.route = [[C.x - C.hw - 2, C.z], [rand(-1.5, 1.5), 58], [rand(-1.5, 1.5), 22]]; b.hteam = null; return false; }
      return false; // the court game itself runs in hoops()
    }
    return this.path(b, dt, 3);
  }
  hoops(dt) {
    const players = Object.values(this.b).filter(o => o.act === 'hoops' && o.step === 2 && o.hteam);
    this.hoopOn = players.length > 0;
    const ball = this.hoop;
    if (!players.length) { if (ball.holder) ball.holder = null; return; }
    if (ball.holder && !players.some(p => p.id === ball.holder)) ball.holder = null;
    const all = players.map(p => ({ id: p.id, x: p.x, z: p.z, team: p.hteam }));
    for (const b of players) bbBrain(b, {
      ball, all, team: id => this.b[id]?.hteam,
      moveTo: (tx, tz, sp) => this.moveTo(b, Math.max(COURT.x - COURT.hw, Math.min(COURT.x + COURT.hw, tx)), Math.max(COURT.z - COURT.hd, Math.min(COURT.z + COURT.hd, tz)), sp, dt, COURT.h),
      grab: id => { if (!ball.holder) ball.holder = id; },
      shoot: (id, sx) => { const p = this.b[id]; Object.assign(ball, bbShot(p.x, p.z, sx, 0.4)); },
      pass: (id, to) => { const p = this.b[id], q = this.b[to]; if (!q) return; const T = 0.65, y0 = COURT.h + 1.4; Object.assign(ball, { holder: null, x: p.x, y: y0, z: p.z, vx: (q.x - p.x) / T, vz: (q.z - p.z) / T, vy: (COURT.h + 1.2 - y0 + 4.9 * T * T) / T }); },
      steal: (id, from) => { if (Math.random() < 0.35) ball.holder = id; },
    }, dt);
    const sc = bbStep(ball, dt, id => { const p = this.b[id]; return p ? { x: p.x, z: p.z, ry: p.ry } : null; }, performance.now() / 1000);
    if (sc) { setTimeout(() => { if (!ball.holder) Object.assign(ball, freshBall()); }, 1200); const me = this.app.world.me.group.position; if (Math.hypot(me.x - COURT.x, me.z - COURT.z) < 30) this.app.sfx('cheer'); }
  }
  hoopDraw(dt, running) {
    const w = this.app.world; if (!w.bball || (running && this.mgs.mg && this.mgs.mg.type === 'basketball')) return;
    const h = this.hoop; w.bball.position.lerp((this._v ||= new THREE.Vector3()).set(h.x, h.y, h.z), Math.min(1, dt * 12));
  }

  // ---- talk to a bot: it can show you the way, play with you, or give a tip ----
  talkUI() {
    const btn = document.createElement('button'); btn.id = 'bTalk'; btn.className = 'glass hidden'; document.body.appendChild(btn); this.talkBtn = btn;
    btn.onclick = () => this.talkMenu(this.near);
    this.app.world.updaters.push(dt => {
      const w = this.app.world, me = w.me.group.position; if ((this.tt = (this.tt || 0) + dt) < 0.25) return; this.tt = 0;
      let best = null, bd = 2.6;
      if (!w.inputLocked && !(this.mgs && this.mgs.active)) for (const id in w.remotes) { if (!id.startsWith('bot-a')) continue; const d = w.remotes[id].av.group.position.distanceTo(me); if (d < bd) { bd = d; best = id; } }
      this.near = best; btn.classList.toggle('hidden', !best);
      if (best) { const nm = this.name(best) || 'Bot'; const txt = `💬 ${this.app.t('talkTo')} ${nm}`; if (btn.textContent !== txt) btn.textContent = txt; }
    });
  }
  talkMenu(id) {
    if (!id) return; const app = this.app, t = app.t, nm = this.name(id) || 'Bot', $ = s => document.querySelector(s);
    app.world.inputLocked = true; app.world.keys = {};
    $('#bankTitle').textContent = `🤖 ${nm}`;
    $('#bankBody').innerHTML = `<div class="staff"><span class="face">🙂</span><div class="bubble">${t('botHello')}</div></div>
      <h4>🧭 ${t('takeMeTo')}</h4><div class="menu-grid">${Object.keys(PLACES).map(k => `<button class="tile" data-place="${k}"><span>${PLACES[k].icon} ${t('place_' + k)}</span></button>`).join('')}</div>
      <div class="row"><button class="btn" id="botPlay">🏀 ${t('playWithMe')}</button><button class="btn" id="botTip">💡 ${t('giveTip')}</button></div>`;
    $('#bankBox').classList.remove('hidden');
    const close = () => app.bankUI.close();
    document.querySelectorAll('#bankBody [data-place]').forEach(x => x.onclick = () => {
      close(); const k = x.dataset.place;
      app.net.emit('botGuide', { id, pid: app.me.pid, place: k });
      app.sfx('chime');
      this.mark(PLACES[k]);
    });
    $('#botPlay').onclick = () => { close(); if (app.mg.running()) return app.toast(t('mgRunning')); app.mg.start('basketball', 5); };
    $('#botTip').onclick = () => { close(); const tip = t('tip_' + (1 + Math.floor(Math.random() * 8))); this.bubble(id, tip, true); };
  }
  // where the guide is taking you: a glowing ring there
  mark(P) {
    const w = this.app.world; if (this.markObj) w.scene.remove(this.markObj);
    const m = this.markObj = labelSprite(`${P.icon} ⬇`, 1, { bg: 'rgba(255,211,77,0.95)' }); m.position.set(P.x, w.groundAt(P.x, P.z) + 3.5, P.z); w.scene.add(m);
    const at = { x: P.x, z: P.z }, stop = setInterval(() => { const p = w.me.group.position; if (Math.hypot(p.x - at.x, p.z - at.z) < 4) { w.scene.remove(m); clearInterval(stop); this.app.sfx('star'); } }, 500);
    setTimeout(() => { w.scene.remove(m); clearInterval(stop); }, 120000);
  }
  startGuide(d) {
    const b = this.b[d.id], P = PLACES[d.place]; if (!b || !P) return;
    this.endAct(b); b.guide = { pid: d.pid, P, t: 0 };
    this.app.net.emit('botSay', { id: b.id, to: d.pid, text: `${this.app.t('followMe')} ${P.icon}` });
  }
  guide(b, dt) {
    const g = b.guide, w = this.app.world, P = g.P; g.t += dt;
    const who = g.pid === this.app.me.pid ? w.me.group.position : w.remotes[g.pid]?.av.group.position;
    if (!who || g.t > 150) { b.guide = null; return; }
    const far = Math.hypot(who.x - b.x, who.z - b.z) > 7;
    if (far) { b.speed = 0; b.ry = Math.atan2(who.x - b.x, who.z - b.z); if ((g.wv = (g.wv || 0) - dt) < 0) { g.wv = 6; this.emote(b, 'wave'); } return; }
    // stay on the paved paths: go via the plaza ends
    g.route ||= routeTo(b, P);
    const p = g.route[0];
    if (p) { if (this.moveTo(b, p[0], p[1], 3.2, dt)) g.route.shift(); return; }
    b.speed = 0; this.emote(b, 'cheer');
    this.app.net.emit('botSay', { id: b.id, to: g.pid, text: `${this.app.t('hereItIs')} ${P.icon}` });
    b.guide = null; b.next = rand(5, 10);
  }
  // a short speech bubble over a bot (and a toast for the person it talks to)
  bubble(id, text, toMe) {
    const r = this.app.world.remotes[id]; if (toMe) this.app.toast(`${this.name(id) || 'Bot'}: ${text}`);
    if (!r) return;
    if (this.bubbles[id]) r.av.group.remove(this.bubbles[id].sp);
    const sp = labelSprite(text, 0.4, { bg: 'rgba(255,255,255,0.95)', color: '#222' }); sp.position.y = 2.6; r.av.group.add(sp);
    this.bubbles[id] = { sp, t: 4, r };
  }
  bubbleTick(dt) { for (const id in this.bubbles) { const bb = this.bubbles[id]; if ((bb.t -= dt) < 0) { bb.r.av.group.remove(bb.sp); delete this.bubbles[id]; } } }

  startGame(mg) {
    this.clear('bot-g');
    if (!this.amHost() || !mg.bots) return;
    for (const id in mg.bots) {
      const team = mg.teams[id], info = mg.bots[id];
      let x = HUB.x + rand(-20, 20), z = HUB.z + rand(8, 30), extra = { team, sh: 0, cd: rand(1, 3) };
      if (mg.type === 'football') { x = PITCH.x + (team === 'red' ? -1 : 1) * rand(5, 20); z = PITCH.z + rand(-14, 14); }
      if (mg.type === 'basketball') { x = COURT.x - attackSide(team) * rand(3, 10); z = COURT.z + rand(-7, 7); }
      if (mg.type === 'dodgeball') { x = COURT.x + rand(-12, 12); z = COURT.z + (team === 'red' ? -1 : 1) * rand(2, 8); }
      if (mg.type === 'impostor') { const S = this.mgs.impostor.station; x = S.x + rand(-4, 4); z = S.z - 10 + rand(-4, 4); extra.floor = S.y; }
      if (mg.type === 'hide' && mg.seeker !== id) { const a = rand(0, 6.28), r = rand(20, 55); extra.tx = HUB.x + Math.cos(a) * r; extra.tz = HUB.z + Math.sin(a) * r; }
      const b = this.spawn(id, info, x, z, extra);
      if (extra.floor !== undefined) b.y = extra.floor;
      if (extra.tx === undefined) { b.tx = x; b.tz = z; }
    }
  }
  endGame() { this.clear('bot-g'); }

  play(b, mg, dt) {
    const now = Date.now(); if (now < mg.start) return;
    const f = this['_' + mg.type]; if (f) f.call(this, b, mg, dt);
  }

  // Football bots: one goalkeeper per team, one player goes for the ball (from behind it, so it never
  // kicks towards its own goal), the others hold positions. Shots only from close range; otherwise pass or dribble.
  _football(b, mg, dt) {
    const ball = this.mgs.ballSim; if (!ball) return;
    const P = PITCH, dir = b.team === 'red' ? 1 : -1, goalX = P.x + dir * P.hw, ownX = P.x - dir * P.hw;
    const mates = Object.values(this.b).filter(o => o.team === b.team).sort((a, c) => a.id < c.id ? -1 : 1);
    const keeper = mates[0], field = mates.slice(1);
    b.y = P.h; b.cd = (b.cd || 0) - dt;
    const kick = (vx, vz, vy) => { b.cd = 0.6; Object.assign(ball, { vx, vz, vy }); this.mgs.lastTouch = b.team; this.app.net.emit('kick', { vx, vz, vy, team: b.team }); };
    const dist = Math.hypot(ball.x - b.x, ball.z - b.z), canKick = dist < 1.0 && b.cd <= 0 && ball.y < P.h + 1.2;
    if (b === keeper && mates.length > 1) {
      // stay on the goal line, follow the ball sideways, clear it when it comes close
      const near = Math.abs(ball.x - ownX) < 9;
      const tx = near && Math.abs(ball.x - ownX) < 4 ? ball.x : ownX + dir * 1.6, tz = P.z + Math.max(-3.2, Math.min(3.2, ball.z - P.z));
      this.moveTo(b, tx, tz, 4.6, dt); b.ry = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      if (canKick) kick(dir * 11 + rand(-1, 1), rand(-4, 4), 3);
      return;
    }
    const chaser = field.slice().sort((a, c) => Math.hypot(a.x - ball.x, a.z - ball.z) - Math.hypot(c.x - ball.x, c.z - ball.z))[0] || b;
    if (chaser === b) {
      const behind = (ball.x - b.x) * dir > 0.2; // standing on our side of the ball, facing the right goal
      if (!behind) { this.moveTo(b, ball.x - dir * 1.3, ball.z + (b.z > ball.z ? 1.3 : -1.3), 5, dt); return; } // go around it
      const gx = goalX - ball.x, gz = P.z - ball.z, gl = Math.hypot(gx, gz) || 1;
      this.moveTo(b, ball.x - gx / gl * 0.6, ball.z - gz / gl * 0.6, 4.8, dt);
      if (!canKick) return;
      if (Math.abs(goalX - ball.x) < 14) { // shoot, not always perfectly
        const aimZ = P.z + rand(-3.4, 3.4), ax = goalX - ball.x, az = aimZ - ball.z, al = Math.hypot(ax, az) || 1, sp = rand(9, 12);
        return kick(ax / al * sp, az / al * sp + rand(-1.5, 1.5), rand(0.8, 3));
      }
      // pass to a teammate further up the pitch, or dribble forward
      const mate = this.targets(mg, id => id !== b.id && mg.teams[id] === b.team).filter(m => (m.x - ball.x) * dir > 2).sort((m1, m2) => Math.hypot(m1.x - ball.x, m1.z - ball.z) - Math.hypot(m2.x - ball.x, m2.z - ball.z))[0];
      if (mate && Math.random() < 0.6) { const ax = mate.x - ball.x, az = mate.z - ball.z, al = Math.hypot(ax, az) || 1, sp = Math.min(9, 3 + al * 0.5); return kick(ax / al * sp, az / al * sp, 0.4); }
      const ax = goalX - ball.x, az = (P.z - ball.z) * 0.3, al = Math.hypot(ax, az) || 1; kick(ax / al * 5, az / al * 5 + rand(-1, 1), 0.3);
    } else {
      // hold a spot: one defender, one forward, following the ball a little
      const k = field.indexOf(b), lane = (k % 2 ? 1 : -1) * 6;
      const hx = k === 0 ? P.x - dir * 8 : P.x + dir * 6;
      this.moveTo(b, hx * 0.6 + ball.x * 0.4, P.z + lane + (ball.z - P.z) * 0.4, 3.4, dt);
    }
  }
  // after a goal: bots walk back into their own half
  kickoff() {
    for (const id in this.b) { const b = this.b[id]; if (!b.team || !this.mgs.ballSim) continue; const dir = b.team === 'red' ? 1 : -1; b.x = PITCH.x - dir * rand(4, 16); b.z = PITCH.z + rand(-12, 12); b.cd = 1.5; }
  }

  // basketball match bots use the same brain as the casual game, with the real (shared) ball
  _basketball(b, mg, dt) {
    const M = this.mgs, ball = M.ballSim; if (!ball) return;
    const all = Object.keys(mg.teams).map(id => { const p = M.posOf(id); return p && { id, x: p.x, z: p.z, team: mg.teams[id] }; }).filter(Boolean);
    b.y = COURT.h;
    bbBrain(b, {
      ball, all, team: id => mg.teams[id],
      moveTo: (tx, tz, sp) => this.moveTo(b, Math.max(COURT.x - COURT.hw - 1, Math.min(COURT.x + COURT.hw + 1, tx)), Math.max(COURT.z - COURT.hd - 1, Math.min(COURT.z + COURT.hd + 1, tz)), sp, dt, COURT.h),
      grab: id => M.bbGrab(id), shoot: (id, sx) => M.bbShoot(id, sx, 0.35), pass: (id, to) => M.bbShoot(id, 0, 0, to), steal: (id, from) => M.bbSteal(id, from),
    }, dt);
  }

  _dodgeball(b, mg, dt) {
    const C = COURT, side = b.team === 'red' ? -1 : 1;
    if (b.frozen > 0) { b.frozen -= dt; return; }
    this.wander(b, dt, C.x, C.z + side * 5, 0, 5, 3.5, C.h);
    b.x = Math.max(C.x - C.hw + 0.6, Math.min(C.x + C.hw - 0.6, b.x));
    b.z = side < 0 ? Math.max(C.z - C.hd + 0.6, Math.min(C.z - 0.7, b.z)) : Math.max(C.z + 0.7, Math.min(C.z + C.hd - 0.6, b.z));
    b.cd -= dt;
    if (b.cd <= 0) {
      b.cd = rand(1.6, 3.2);
      const targets = this.targets(mg, id => mg.teams[id] && mg.teams[id] !== b.team);
      if (!targets.length) return;
      const t = pick(targets), dx = t.x - b.x, dz = t.z - b.z, d = Math.hypot(dx, dz) || 1, sp = 18;
      const tt = d / sp, vy = 3 + 9 * tt * 0.5;
      this.app.net.emit('throw', { o: [b.x + dx / d, C.h + 1.4, b.z + dz / d], v: [dx / d * sp + rand(-1.5, 1.5), vy, dz / d * sp], team: b.team, bot: b.id });
    }
  }
  // positions of everyone (humans + bots) matching a filter
  targets(mg, filter) {
    const w = this.app.world, out = [];
    if (filter(this.app.me.pid)) out.push({ id: this.app.me.pid, ...w.me.group.position });
    for (const id in w.remotes) if (filter(id)) { const p = w.remotes[id].av.group.position; out.push({ id, x: p.x, y: p.y, z: p.z }); }
    return out;
  }

  _hide(b, mg, dt) {
    if (mg.seeker === b.id) {
      if (Date.now() < mg.start + 30000) return;
      const hiders = this.targets(mg, id => id !== b.id && mg.teams[id] && !mg.found[id]);
      const near = hiders.sort((a, c) => Math.hypot(a.x - b.x, a.z - b.z) - Math.hypot(c.x - b.x, c.z - b.z))[0];
      if (near && Math.hypot(near.x - b.x, near.z - b.z) < 9) { this.moveTo(b, near.x, near.z, 4.2, dt); if (Math.hypot(near.x - b.x, near.z - b.z) < 2.2 && !(b.sent ||= {})[near.id]) { b.sent[near.id] = 1; this.app.net.emit('found', { id: near.id, name: this.app.mg.nameOf(near.id), by: b.id }); } }
      else this.wander(b, dt, HUB.x, HUB.z, 5, 90, 3.4);
    } else this.moveTo(b, b.tx, b.tz, 3.4, dt);
  }

  _starhunt(b, mg, dt) {
    this.wander(b, dt, HUB.x, HUB.z, 5, 80, 3.2);
    b.cd -= dt; if (b.cd <= 0) { b.cd = rand(3, 7); b.sh = (b.sh || 0) + 1; }
  }

  _impostor(b, mg, dt) { this.mgs.impostor.botTick(b, mg, dt); }
  _quiz() {}
}
