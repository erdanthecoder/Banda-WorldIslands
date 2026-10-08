// Multiplayer layer. Firebase Realtime Database when configured, otherwise
// BroadcastChannel between tabs of the same browser (handy for testing).
import { CONFIG } from './config.js';

const FB = 'https://www.gstatic.com/firebasejs/10.12.2/';

function loadScript(src) {
  return new Promise((ok, fail) => {
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
}

const rid = () => Math.random().toString(36).slice(2, 10);

class FirebaseNet {
  constructor() {
    this.kind = 'online';
    firebase.initializeApp(CONFIG.firebase);
    this.db = firebase.database();
    this.root = this.db.ref('banda');
    this.offset = 0;
    this.db.ref('.info/serverTimeOffset').on('value', s => (this.offset = s.val() || 0));
    this.presReady = {};
  }
  now() { return Date.now() + this.offset; }
  setPresence(id, data) {
    const r = this.root.child('players/' + id);
    if (!this.presReady[id]) { r.onDisconnect().remove(); this.presReady[id] = 1; }
    r.set(data);
  }
  removePresence(id) { this.root.child('players/' + id).remove(); }
  onPlayers(cb) {
    const r = this.root.child('players');
    r.on('child_added', s => cb(s.key, s.val()));
    r.on('child_changed', s => cb(s.key, s.val()));
    r.on('child_removed', s => cb(s.key, null));
  }
  emit(type, data, from) {
    this.root.child('events').push({ type, data: data ?? null, from: from || '', ts: firebase.database.ServerValue.TIMESTAMP });
  }
  onEvent(cb) {
    const seen = new Set();
    this.root.child('events').orderByChild('ts').startAt(this.now() - 4000).on('child_added', s => {
      if (seen.has(s.key)) return; seen.add(s.key);
      cb(s.val());
    });
  }
  cleanupEvents() {
    this.root.child('events').orderByChild('ts').endAt(this.now() - 60000).once('value', s => {
      const upd = {}; s.forEach(c => { upd[c.key] = null; }); this.root.child('events').update(upd);
    });
  }
  setState(key, val) { this.root.child('state/' + key).set(val ?? null); }
  onState(key, cb) { this.root.child('state/' + key).on('value', s => cb(s.val())); }
  _tx(uid, fn) { this.root.child('users/' + uid).transaction(u => fn(u || { stars: 0, points: 0 })); }
  ensureUser(uid, name, role) { this._tx(uid, u => ({ ...u, name, role, seen: Date.now() })); }
  addStars(uid, n, name) { this._tx(uid, u => { u.stars = Math.max(0, (u.stars || 0) + n); if (name) u.name = name; return u; }); }
  addPoints(uid, n, name) { this._tx(uid, u => { u.points = Math.max(0, (u.points || 0) + n); if (name) u.name = name; return u; }); }
  onUsers(cb) { this.root.child('users').on('value', s => cb(s.val() || {})); }
}

class LocalNet {
  constructor() {
    this.kind = 'local';
    this.bc = new BroadcastChannel('banda-worldislands');
    this.players = {}; this.pcbs = []; this.ecbs = []; this.scbs = {}; this.ucbs = [];
    this.bc.onmessage = e => this._recv(e.data);
    setInterval(() => {
      const t = Date.now();
      for (const id in this.players) if (t - this.players[id]._t > 5000) this._recv({ k: 'p', id, d: null });
    }, 1000);
  }
  _send(m) { this._recv(m); this.bc.postMessage(m); }
  _recv(m) {
    if (m.k === 'p') {
      if (m.d) this.players[m.id] = m.d; else delete this.players[m.id];
      this.pcbs.forEach(cb => cb(m.id, m.d));
    } else if (m.k === 'e') this.ecbs.forEach(cb => cb(m.ev));
    else if (m.k === 's') (this.scbs[m.key] || []).forEach(cb => cb(m.val));
    else if (m.k === 'u') { const u = this._users(); this.ucbs.forEach(cb => cb(u)); }
  }
  now() { return Date.now(); }
  setPresence(id, d) { this._send({ k: 'p', id, d: { ...d, _t: Date.now() } }); }
  removePresence(id) { this._send({ k: 'p', id, d: null }); }
  onPlayers(cb) { this.pcbs.push(cb); for (const id in this.players) cb(id, this.players[id]); }
  emit(type, data, from) { this._send({ k: 'e', ev: { type, data: data ?? null, from: from || '', ts: Date.now(), id: rid() } }); }
  onEvent(cb) { this.ecbs.push(cb); }
  cleanupEvents() {}
  setState(key, val) {
    try { localStorage.setItem('banda_s_' + key, JSON.stringify(val ?? null)); } catch (e) {}
    this._send({ k: 's', key, val: val ?? null });
  }
  onState(key, cb) {
    (this.scbs[key] ||= []).push(cb);
    let v = null; try { v = JSON.parse(localStorage.getItem('banda_s_' + key)); } catch (e) {}
    cb(v);
  }
  _users() { try { return JSON.parse(localStorage.getItem('banda_users')) || {}; } catch (e) { return {}; } }
  _tx(uid, fn) {
    const all = this._users(); all[uid] = fn(all[uid] || { stars: 0, points: 0 });
    try { localStorage.setItem('banda_users', JSON.stringify(all)); } catch (e) {}
    this._send({ k: 'u' });
  }
  ensureUser(uid, name, role) { this._tx(uid, u => ({ ...u, name, role, seen: Date.now() })); }
  addStars(uid, n, name) { this._tx(uid, u => { u.stars = Math.max(0, (u.stars || 0) + n); if (name) u.name = name; return u; }); }
  addPoints(uid, n, name) { this._tx(uid, u => { u.points = Math.max(0, (u.points || 0) + n); if (name) u.name = name; return u; }); }
  onUsers(cb) { this.ucbs.push(cb); cb(this._users()); }
}

export async function createNet() {
  if (CONFIG.firebase && CONFIG.firebase.databaseURL) {
    try {
      await loadScript(FB + 'firebase-app-compat.js');
      await loadScript(FB + 'firebase-database-compat.js');
      return new FirebaseNet();
    } catch (e) { console.warn('Firebase unavailable, using local mode', e); }
  }
  return new LocalNet();
}
