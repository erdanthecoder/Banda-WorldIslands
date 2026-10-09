// Multiplayer + save data.
// Online: Supabase Realtime (presence + broadcast per server) and Postgres (stars, teacher commands).
// Dev (?dev=1 on localhost): BroadcastChannel between tabs of one browser.
import { CONFIG, DEV } from './config.js';
import { sb } from './auth.js';
import { PRICES } from './shop.js';

const CLOCK_KEYS = ['start', 'phaseEnds', 'qEnds'];
function stamp(val) { return val && typeof val === 'object' && !Array.isArray(val) ? { ...val, _sent: Date.now() } : val; }
function unstamp(val) {
  if (!val || typeof val !== 'object' || !val._sent) return val;
  const d = Date.now() - val._sent, v = { ...val }; delete v._sent;
  for (const k of CLOCK_KEYS) if (typeof v[k] === 'number') v[k] += d;
  return v;
}

class Base {
  constructor() { this.players = {}; this.pcbs = []; this.ecbs = []; this.scbs = {}; this.ucbs = []; this.state = {}; this.users = {}; }
  now() { return Date.now(); }
  onPlayers(cb) { this.pcbs.push(cb); for (const id in this.players) cb(id, this.players[id]); }
  onEvent(cb) { this.ecbs.push(cb); }
  onState(key, cb) { (this.scbs[key] ||= []).push(cb); if (key in this.state) cb(this.state[key]); }
  onUsers(cb) { this.ucbs.push(cb); cb(this.users); }
  _player(id, d) {
    if (d) this.players[id] = { ...(this.players[id] || {}), ...d }; else delete this.players[id];
    this.pcbs.forEach(cb => cb(id, d ? this.players[id] : null));
  }
  _event(ev) {
    if (ev.type === '_state') { const v = unstamp(ev.data.val); this.state[ev.data.key] = v; (this.scbs[ev.data.key] || []).forEach(cb => cb(v)); return; }
    this.ecbs.forEach(cb => cb(ev));
  }
  _users(u) { this.users = u; this.ucbs.forEach(cb => cb(u)); }
  setState(key, val) { this.emit('_state', { key, val: stamp(val) }); }
}

// ---------------- Supabase ----------------
class SupaNet extends Base {
  constructor(account) { super(); this.kind = 'online'; this.c = sb(); this.uid = account.user.id; this.server = null; }

  // Live player counts for the server list. cb({s1: 3, ...})
  watchLobby(cb) {
    this.lobby = this.c.channel('banda-lobby', { config: { presence: { key: this.uid } } });
    const count = () => {
      const st = this.lobby.presenceState(), n = {};
      for (const k in st) { const s = st[k][0]?.server; if (s) n[s] = (n[s] || 0) + 1; }
      cb(n);
    };
    this.lobby.on('presence', { event: 'sync' }, count).subscribe(s => { if (s === 'SUBSCRIBED') this.lobby.track({ server: this.server }); });
  }

  async joinServer(server, meta) {
    this.server = server; this.meta = meta;
    if (this.lobby) this.lobby.track({ server });
    const ch = this.ch = this.c.channel('banda-' + server, { config: { broadcast: { self: true }, presence: { key: meta.pid } } });
    let known = new Set();
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState(), now = new Set();
      for (const pid in st) { if (pid === meta.pid) continue; now.add(pid); this._player(pid, st[pid][0]); }
      for (const pid of known) if (!now.has(pid)) this._player(pid, null);
      known = now;
    });
    ch.on('broadcast', { event: 'pos' }, ({ payload: p }) => { if (p.id !== meta.pid && this.players[p.id]) this._player(p.id, p); });
    ch.on('broadcast', { event: 'ev' }, ({ payload }) => this._event({ ...payload, trusted: false }));
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'banda_commands', filter: `server=eq.${server}` }, ({ new: r }) => this._command(r));
    // admin commands go to every server
    ch.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'banda_commands', filter: 'server=eq.all' }, ({ new: r }) => this._command(r));
    await new Promise(ok => ch.subscribe(s => { if (s === 'SUBSCRIBED') { ch.track(meta); ok(); } }));
    // current teacher effects for late joiners
    const { data } = await this.c.from('banda_commands').select('*').in('server', [server, 'all']).eq('kind', 'effects').order('id', { ascending: false }).limit(1);
    if (data && data[0]) this._command(data[0], true);
    this.loadUsers(); setInterval(() => this.loadUsers(), 20000);
  }
  _command(r, quiet) {
    if (r.kind === 'effects') { this.state.effects = r.data; (this.scbs.effects || []).forEach(cb => cb(r.data)); return; }
    if (!quiet) this._event({ type: r.kind, data: r.data, from: r.created_by, ts: Date.parse(r.created_at), id: r.id, trusted: true });
  }
  updateMeta(meta) { this.meta = { ...this.meta, ...meta }; this.ch && this.ch.track(this.meta); }
  sendPos(p) { this.ch && this.ch.send({ type: 'broadcast', event: 'pos', payload: { id: this.meta.pid, ...p } }); }
  emit(type, data) { this.ch && this.ch.send({ type: 'broadcast', event: 'ev', payload: { type, data: data ?? null, from: this.meta.pid, ts: Date.now() } }); }
  async command(kind, data) {
    const { error } = await this.c.from('banda_commands').insert({ server: this.server, kind, data: data || {} });
    if (error) throw error;
  }
  // admin commands: the password is checked on the server; the command then reaches everyone like a teacher command
  async admin(pw, kind, data) { const { data: ok, error } = await this.c.rpc('banda_admin', { pw, srv: this.server, k: kind, d: data || {} }); if (error) throw error; return !!ok; }
  async adminMoney(pw, cents, target, phone) { const { data, error } = await this.c.rpc('banda_admin_money', { pw, cents, target: target || null, phone: phone || null }); if (error) throw error; return data; }
  async claimMoney(cmd) { const { data } = await this.c.rpc('banda_claim_money', { cmd }); return data || 0; }
  async loadUsers() {
    const { data } = await this.c.from('banda_players').select('id, name, stars, points, avatar').order('stars', { ascending: false }).limit(300);
    if (data) { const u = {}; data.forEach(r => u[r.id] = r); this._users(u); }
  }
  async myRow() { const { data } = await this.c.from('banda_players').select('*').eq('id', this.uid).maybeSingle(); return data; }
  async saveProfile(name, avatar) {
    const { data } = await this.c.from('banda_players').update({ name, avatar, updated_at: new Date().toISOString() }).eq('id', this.uid).select('id');
    if (!data || !data.length) await this.c.from('banda_players').insert({ id: this.uid, name, avatar });
  }
  async award(n) { const { data, error } = await this.c.rpc('banda_award', { n }); if (!error) { this._bump(this.uid, { stars: data }); } return data; }
  async give(uid, stars, points) { const { error } = await this.c.rpc('banda_give', { target: uid, d_stars: stars, d_points: points }); if (error) throw error; this.loadUsers(); }
  async claim(id) { const { data } = await this.c.rpc('banda_claim', { cmd: id }); this.loadUsers(); return data || 0; }
  // mPAY money (cents) and the supermarket; prices are checked on the server
  async earn(cents) { const { data, error } = await this.c.rpc('banda_earn', { cents: Math.round(cents) }); if (error) throw error; return data; }
  async buy(items) { const { data, error } = await this.c.rpc('banda_buy', { items }); if (error) throw error; return data; }
  async use(item) { const { data, error } = await this.c.rpc('banda_use', { what: item }); if (error) throw error; return data; }
  async bankOpen() { const { data, error } = await this.c.rpc('banda_bank_open'); if (error) throw error; return data; }
  async handSetup() { const { data, error } = await this.c.rpc('banda_hand_setup'); if (error) throw error; return data; }
  // ---- phone: number, messages, calls (calls go over one channel shared by all servers) ----
  async phone() { const { data, error } = await this.c.rpc('banda_phone'); if (error) throw error; return data; }
  async sendMessage(to, from, name, body) { const { error } = await this.c.from('banda_messages').insert({ to_phone: to, from_phone: from, from_name: name, body }); if (error) throw error; }
  async messages() { const { data } = await this.c.from('banda_messages').select('*').order('created_at', { ascending: false }).limit(200); return data || []; }
  phoneJoin(num, meta, onMsg, onSig) {
    this.c.channel('banda-msg-' + num).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'banda_messages', filter: `to_phone=eq.${num}` }, ({ new: r }) => onMsg(r)).subscribe();
    const ch = this.pch = this.c.channel('banda-phone', { config: { presence: { key: num } } });
    this.online = {};
    ch.on('presence', { event: 'sync' }, () => { const st = ch.presenceState(), o = {}; for (const k in st) o[k] = st[k][0]; this.online = o; });
    ch.on('broadcast', { event: 'ph' }, ({ payload: p }) => { if (p.to === num) onSig(p); });
    ch.subscribe(s => { if (s === 'SUBSCRIBED') ch.track(meta); });
    this.myNum = num;
  }
  phoneSend(to, type, data) { this.pch && this.pch.send({ type: 'broadcast', event: 'ph', payload: { to, from: this.myNum, type, data } }); }
  async inventory() { const { data } = await this.c.from('banda_inventory').select('item, qty').eq('user_id', this.uid); const o = {}; (data || []).forEach(r => { if (r.qty > 0) o[r.item] = r.qty; }); return o; }
  _bump(uid, patch) { this.users = { ...this.users, [uid]: { ...(this.users[uid] || { stars: 0, points: 0 }), ...patch } }; this._users(this.users); }
  leave() { if (this.ch) this.c.removeChannel(this.ch); }
}

// ---------------- Dev (one browser) ----------------
class LocalNet extends Base {
  constructor(account) {
    super(); this.kind = 'local'; this.uid = account.user.id;
    this.bc = new BroadcastChannel('banda-dev');
    this.bc.onmessage = e => this._recv(e.data);
    this.seen = {};
    setInterval(() => { const t = Date.now(); for (const id in this.seen) if (t - this.seen[id] > 60000) { delete this.seen[id]; this._player(id, null); } }, 1000);
    this._users(this._load());
  }
  _load() { try { return JSON.parse(localStorage.getItem('banda_dev_users')) || {}; } catch (e) { return {}; } }
  _save(u) { localStorage.setItem('banda_dev_users', JSON.stringify(u)); this._users(u); this.bc.postMessage({ k: 'u' }); }
  _recv(m) {
    if (m.server && m.server !== this.server) return;
    if (m.k === 'p') { this.seen[m.id] = Date.now(); this._player(m.id, m.d); }
    else if (m.k === 'e') this._event(m.ev);
    else if (m.k === 'u') this._users(this._load());
    else if (m.k === 'hello' && this.meta) this.bc.postMessage({ k: 'p', server: this.server, id: this.meta.pid, d: { ...this.meta, ...this.lastPos } });
  }
  watchLobby(cb) {
    const counts = {}; const tick = () => { const n = {}; for (const k in counts) if (Date.now() - counts[k].t < 4000) n[counts[k].s] = (n[counts[k].s] || 0) + 1; cb(n); };
    const lb = new BroadcastChannel('banda-dev-lobby');
    lb.onmessage = e => { counts[e.data.id] = { s: e.data.s, t: Date.now() }; tick(); };
    setInterval(() => { if (this.server) { counts[this.uid] = { s: this.server, t: Date.now() }; lb.postMessage({ id: this.uid, s: this.server }); } tick(); }, 1500);
  }
  async joinServer(server, meta) {
    this.server = server; this.meta = meta; this.lastPos = {};
    this.bc.postMessage({ k: 'hello', server });
    setInterval(() => this.bc.postMessage({ k: 'p', server, id: meta.pid, d: { ...this.meta, ...this.lastPos } }), 2000);
    try { const e = JSON.parse(localStorage.getItem('banda_dev_effects_' + server)); if (e) { this.state.effects = e; } } catch (e) {}
  }
  updateMeta(meta) { this.meta = { ...this.meta, ...meta }; }
  sendPos(p) { this.lastPos = p; this.bc.postMessage({ k: 'p', server: this.server, id: this.meta.pid, d: { ...this.meta, ...p } }); }
  emit(type, data, trusted = false) {
    const ev = { type, data: data ?? null, from: trusted ? this.uid : this.meta.pid, ts: Date.now(), trusted, id: Math.floor(Math.random() * 1e9) };
    this._event(ev); this.bc.postMessage({ k: 'e', server: this.server, ev });
  }
  async command(kind, data) {
    if (this.meta.role !== 'teacher') throw new Error('teachers only');
    if (kind === 'effects') {
      localStorage.setItem('banda_dev_effects_' + this.server, JSON.stringify(data));
      const ev = { type: '_state', data: { key: 'effects', val: data } }; this._event(ev); this.bc.postMessage({ k: 'e', server: this.server, ev }); return;
    }
    this.emit(kind, data, true);
  }
  async admin(pw, kind, data) {
    const h = [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pw || '')))].map(b => b.toString(16).padStart(2, '0')).join('');
    if (h !== 'eff3fdd3f486565f12baf0df16bd88f07f5652e3489aa047b92d78c57b9cac8c') return false;
    if (kind === 'effects') { localStorage.setItem('banda_dev_effects_' + this.server, JSON.stringify(data)); const ev = { type: '_state', data: { key: 'effects', val: data } }; this._event(ev); this.bc.postMessage({ k: 'e', server: this.server, ev }); return true; }
    if (kind !== 'check') this.emit(kind, data, true); return true;
  }
  async adminMoney(pw, cents, target, phone) {
    if (!(await this.admin(pw, 'check'))) throw new Error('wrong password');
    const u = this._load(); let who = target || this.uid; if (phone) who = Object.keys(u).find(k => u[k].phone === phone); if (!who) throw new Error('no such number');
    const r = u[who] ||= { id: who, stars: 0, points: 0, money_cents: 10000 }; r.money_cents = (r.money_cents ?? 10000) + cents; this._save(u);
    this.emit('money', { uid: who, cents, name: r.name }, true); return r.money_cents;
  }
  async claimMoney(cmd, cents) { const k = 'banda_dev_mclaim_' + cmd; if (sessionStorage.getItem(k)) return 0; sessionStorage.setItem(k, 1); const [u, r] = this._me(); r.money_cents += cents; this._save(u); return cents; }
  loadUsers() { this._users(this._load()); }
  async saveProfile(name, avatar) { const u = this._load(); u[this.uid] = { stars: 0, points: 0, ...(u[this.uid] || {}), id: this.uid, name, avatar }; this._save(u); }
  async award(n) { const u = this._load(), r = u[this.uid] ||= { id: this.uid, stars: 0, points: 0 }; r.stars += Math.min(10, n); this._save(u); return r.stars; }
  async give(uid, stars, points) { const u = this._load(), r = u[uid] ||= { id: uid, stars: 0, points: 0 }; r.stars = Math.max(0, r.stars + stars); r.points = Math.max(0, r.points + points); this._save(u); }
  async claim(id) { const k = 'banda_dev_claim_' + id; if (sessionStorage.getItem(k)) return 0; sessionStorage.setItem(k, 1); return null; }
  _me() { const u = this._load(); const r = u[this.uid] ||= { id: this.uid, stars: 0, points: 0 }; if (r.money_cents === undefined) r.money_cents = 10000; r.inv ||= {}; return [u, r]; }
  async earn(cents) { const [u, r] = this._me(); r.money_cents += Math.max(1, Math.min(500, Math.round(cents))); this._save(u); return r.money_cents; }
  async buy(items) {
    const [u, r] = this._me(); let total = 0;
    for (const { item, qty } of items) { if (!(item in PRICES)) throw new Error('unknown item'); total += PRICES[item] * qty; }
    if (total > r.money_cents) throw new Error('not enough money');
    r.money_cents -= total; for (const { item, qty } of items) r.inv[item] = (r.inv[item] || 0) + qty; this._save(u); return r.money_cents;
  }
  async use(item) { const [u, r] = this._me(); if (!r.inv[item] || ['crown', 'headphones', 'tophat', 'dog', 'cat', 'bunny', 'dragon'].includes(item)) return -1; r.inv[item]--; this._save(u); return r.inv[item]; }
  async inventory() { const [, r] = this._me(); const o = {}; for (const k in r.inv) if (r.inv[k] > 0) o[k] = r.inv[k]; return o; }
  async myRow() { const [u, r] = this._me(); this._save(u); return r; }
  async bankOpen() { const [u, r] = this._me(); r.bank_card ||= '4400 ' + [0, 0, 0].map(() => String(Math.floor(Math.random() * 1e4)).padStart(4, '0')).join(' '); this._save(u); return r.bank_card; }
  async handSetup() { const [u, r] = this._me(); if (!r.bank_card) return false; r.hand_pay = true; this._save(u); return true; }
  async phone() { const [u, r] = this._me(); if (!r.phone) { const used = new Set(Object.values(u).map(x => x.phone)); do r.phone = String(1000 + Math.floor(Math.random() * 9000)); while (used.has(r.phone)); this._save(u); } return r.phone; }
  _msgs() { try { return JSON.parse(localStorage.getItem('banda_dev_msgs')) || []; } catch (e) { return []; } }
  async sendMessage(to, from, name, body) { const m = this._msgs(); const r = { id: Date.now(), to_phone: to, from_phone: from, from_name: name, body, created_at: new Date().toISOString() }; m.unshift(r); localStorage.setItem('banda_dev_msgs', JSON.stringify(m.slice(0, 300))); this.phc && this.phc.postMessage({ k: 'msg', r }); }
  async messages() { return this._msgs().filter(r => r.to_phone === this.myNum || r.from_phone === this.myNum); }
  phoneJoin(num, meta, onMsg, onSig) {
    this.myNum = num; this.online = {}; const seen = {};
    const ch = this.phc = new BroadcastChannel('banda-phone-dev');
    ch.onmessage = e => { const m = e.data; if (m.k === 'here') { seen[m.num] = Date.now(); this.online[m.num] = m.meta; } else if (m.k === 'msg' && m.r.to_phone === num) onMsg(m.r); else if (m.k === 'ph' && m.p.to === num) onSig(m.p); };
    const beat = () => { ch.postMessage({ k: 'here', num, meta }); for (const k in seen) if (Date.now() - seen[k] > 6000) { delete seen[k]; delete this.online[k]; } };
    beat(); setInterval(beat, 2000);
  }
  phoneSend(to, type, data) { this.phc && this.phc.postMessage({ k: 'ph', p: { to, from: this.myNum, type, data } }); }
  leave() {}
}

export function createNet(account) { return DEV ? new LocalNet(account) : new SupaNet(account); }
