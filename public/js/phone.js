// The phone: your number (+0 XXXX), keypad, contacts, messages, mBank, and calls.
// Calls use your real microphone. The camera never sends video: it only reads your
// expression (laughing, angry, excited, sad) and your avatar shows that face.
import { drawFace } from './avatar.js';
import { money, ICON } from './shop.js';

const $ = s => document.querySelector(s);
const el = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = n => n ? `+0 ${n}` : '+0 ····';
const FACE_API = '/vendor/face-api/'; // hosted with the game (face-api 1.7.15, MIT)
const MOOD_BTNS = [['laugh', '😄'], ['excited', '🤩'], ['angry', '😠'], ['sad', '😢'], ['', '🙂']];
const ICE = [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }];

export class Phone {
  constructor(app) {
    this.app = app; this.screen = 'home'; this.thread = null; this.call = null; this.dial = '';
    document.body.append(el(`<div id="phoneBox" class="modal hidden"><div class="phone"><div class="phone-notch"></div><div class="phone-status"><span id="phTime"></span><span>📶 🔋</span></div><button class="phone-x" data-x>✕</button><div id="phoneBody"></div><button class="phone-home" id="phHome" aria-label="Home"></button></div></div>`));
    $('#phoneBox [data-x]').onclick = () => this.close();
    $('#phHome').onclick = () => this.go('home');
    setInterval(() => { const d = new Date(); $('#phTime').textContent = d.toTimeString().slice(0, 5); }, 1000);
  }
  get t() { return this.app.t; }
  get net() { return this.app.net; }
  async start() {
    try { this.num = await this.net.phone(); } catch (e) { this.num = null; }
    if (!this.num) return;
    const me = this.app.me;
    this.net.phoneJoin(this.num, { name: me.name, avatar: me.avatar, pid: me.pid }, r => this.onMessage(r), p => this.onSignal(p));
    this.msgs = await this.net.messages().catch(() => []) || [];
    this.badge();
  }
  lock(on) { this.app.world.inputLocked = on; this.app.world.keys = {}; }
  open(screen = 'home') { $('#phoneBox').classList.remove('hidden'); this.lock(true); this.app.sfx('click'); this.go(screen); }
  close() { if (this.call && this.call.state !== 'ended') { $('#phoneBox').classList.add('hidden'); this.lock(false); this.mini(true); return; } $('#phoneBox').classList.add('hidden'); this.lock(false); }
  isOpen() { return !$('#phoneBox').classList.contains('hidden'); }
  go(screen, arg) { this.screen = screen; if (arg !== undefined) this.thread = arg; this.render(); }

  // ---------- contacts (kept on this device) ----------
  key() { return 'banda_contacts_' + this.app.me.uid; }
  contacts() { try { return JSON.parse(localStorage.getItem(this.key())) || []; } catch (e) { return []; } }
  saveContacts(c) { try { localStorage.setItem(this.key(), JSON.stringify(c)); } catch (e) {} }
  nameOf(num) { const c = this.contacts().find(x => x.num === num); return c ? c.name : (this.net.online?.[num]?.name || fmt(num)); }
  online(num) { return !!(this.net.online && this.net.online[num]) && num !== this.num; }

  render() {
    const t = this.t, b = $('#phoneBody');
    const head = (title, back = 'home') => `<div class="ph-head"><button class="ph-back" data-go="${back}">‹</button><b>${title}</b><span></span></div>`;
    if (this.screen === 'home') {
      const unread = this.unread();
      b.innerHTML = `<div class="ph-me"><div class="ph-num">${fmt(this.num)}</div><small>${t('myNumber')}</small></div>
        <div class="ph-apps">
          <button data-go="keypad"><i style="background:#2ecc71">📞</i><span>${t('appCall')}</span></button>
          <button data-go="contacts"><i style="background:#3498db">👥</i><span>${t('appContacts')}</span></button>
          <button data-go="messages"><i style="background:#9b59b6">💬</i>${unread ? `<em>${unread}</em>` : ''}<span>${t('appMessages')}</span></button>
          <button data-go="bank"><i class="mb"><img src="/img/mbank.svg" alt=""></i><span>mBank</span></button>
          <button data-go="jobs"><i style="background:#e67e22">💼</i><span>${t('jobs')}</span></button>
          <button data-go="mood"><i style="background:#f1c40f">${this.camOn ? '📷' : '🙂'}</i><span>${t('appMood')}</span></button>
          <button data-go="help"><i style="background:#e74c3c">🙋</i><span>${t('appHelp')}</span></button>
          <button data-go="admin"><i style="background:#2c3e50">🔐</i><span>${t('appAdmin')}</span></button>
        </div>
        <p class="ph-tip">${t('phoneTip')}</p>`;
    } else if (this.screen === 'keypad') {
      b.innerHTML = `${head(t('appCall'))}<div class="ph-dial">+0 <b>${esc(this.dial.padEnd(4, '·'))}</b></div><div class="ph-who">${this.dial.length === 4 ? (this.online(this.dial) ? `🟢 ${esc(this.nameOf(this.dial))}` : `⚪ ${t('offline')}`) : ''}</div>
        <div class="ph-keys">${['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map(k => `<button data-k="${k}"${k ? '' : ' disabled'}>${k}</button>`).join('')}</div>
        <div class="ph-actions"><button class="ph-msg" data-act="msg" ${this.dial.length === 4 ? '' : 'disabled'}>💬</button><button class="ph-call" data-act="call" ${this.dial.length === 4 ? '' : 'disabled'}>📞</button><button class="ph-add" data-act="add" ${this.dial.length === 4 ? '' : 'disabled'}>👤+</button></div>`;
      b.querySelectorAll('[data-k]').forEach(x => x.onclick = () => { const k = x.dataset.k; if (k === '⌫') this.dial = this.dial.slice(0, -1); else if (this.dial.length < 4) this.dial += k; this.app.sfx('beep'); this.render(); });
      b.querySelectorAll('[data-act]').forEach(x => x.onclick = () => { const a = x.dataset.act; if (a === 'call') this.startCall(this.dial); if (a === 'msg') this.go('thread', this.dial); if (a === 'add') this.go('addContact'); });
    } else if (this.screen === 'contacts') {
      const list = this.contacts().sort((a, c) => (this.online(c.num) - this.online(a.num)) || a.name.localeCompare(c.name));
      const near = Object.entries(this.net.online || {}).filter(([n]) => n !== this.num && !list.some(c => c.num === n)).slice(0, 8);
      b.innerHTML = `${head(t('appContacts'))}<button class="ph-wide" data-go="addContact">＋ ${t('addContact')}</button>
        <div class="ph-list">${list.map(c => `<div class="ph-row"><span class="dot ${this.online(c.num) ? 'on' : ''}"></span><div><b>${esc(c.name)}</b><small>${fmt(c.num)}</small></div><button data-msg="${c.num}">💬</button><button data-call="${c.num}">📞</button></div>`).join('') || `<p class="muted">${t('noContacts')}</p>`}</div>
        ${near.length ? `<h4>${t('onlineNow')}</h4><div class="ph-list">${near.map(([n, m]) => `<div class="ph-row"><span class="dot on"></span><div><b>${esc(m.name)}</b><small>${fmt(n)}</small></div><button data-save="${n}" data-name="${esc(m.name)}">👤+</button><button data-call="${n}">📞</button></div>`).join('')}</div>` : ''}`;
      b.querySelectorAll('[data-call]').forEach(x => x.onclick = () => this.startCall(x.dataset.call));
      b.querySelectorAll('[data-msg]').forEach(x => x.onclick = () => this.go('thread', x.dataset.msg));
      b.querySelectorAll('[data-save]').forEach(x => x.onclick = () => { const c = this.contacts(); c.push({ name: x.dataset.name, num: x.dataset.save }); this.saveContacts(c); this.app.sfx('star'); this.render(); });
    } else if (this.screen === 'addContact') {
      b.innerHTML = `${head(t('addContact'), 'contacts')}<label class="ph-field">${t('contactName')}<input id="acN" maxlength="20"></label><label class="ph-field">${t('contactNumber')}<div class="ph-numin">+0 <input id="acP" inputmode="numeric" maxlength="4" value="${esc(this.dial)}"></div></label><button class="ph-wide primary" id="acSave2">${t('save')}</button>`;
      $('#acN').focus();
      $('#acSave2').onclick = () => {
        const name = $('#acN').value.replace(/[<>]/g, '').trim(), num = $('#acP').value.replace(/\D/g, '');
        if (!name || num.length !== 4) return this.app.toast(t('contactBad'));
        const c = this.contacts().filter(x => x.num !== num); c.push({ name, num }); this.saveContacts(c); this.app.sfx('star'); this.go('contacts');
      };
    } else if (this.screen === 'messages') {
      const threads = {};
      for (const m of this.msgs) { const other = m.from_phone === this.num ? m.to_phone : m.from_phone; (threads[other] ||= []).push(m); }
      const seen = this.seen();
      b.innerHTML = `${head(t('appMessages'))}<button class="ph-wide" data-go="keypad">✏️ ${t('newMessage')}</button><div class="ph-list">${Object.entries(threads).map(([n, ms]) => { const last = ms[0], un = ms.filter(m => m.to_phone === this.num && m.id > (seen[n] || 0)).length; return `<button class="ph-row th" data-th="${n}"><span class="dot ${this.online(n) ? 'on' : ''}"></span><div><b>${esc(this.nameOf(n))}</b><small>${esc(last.body).slice(0, 34)}</small></div>${un ? `<em>${un}</em>` : ''}</button>`; }).join('') || `<p class="muted">${t('noMessages')}</p>`}</div>`;
      b.querySelectorAll('[data-th]').forEach(x => x.onclick = () => this.go('thread', x.dataset.th));
    } else if (this.screen === 'thread') {
      const n = this.thread, ms = this.msgs.filter(m => m.from_phone === n || m.to_phone === n).slice().reverse();
      const seen = this.seen(); seen[n] = Math.max(0, ...ms.map(m => m.id)); try { localStorage.setItem(this.seenKey(), JSON.stringify(seen)); } catch (e) {} this.badge();
      b.innerHTML = `${head(esc(this.nameOf(n)), 'messages')}<div class="ph-sub">${fmt(n)} · ${this.online(n) ? '🟢 ' + t('onlineWord') : t('offline')} <button data-call="${n}">📞</button></div>
        <div class="ph-chat" id="phChat">${ms.map(m => `<div class="bub ${m.from_phone === this.num ? 'me' : ''}">${esc(m.body)}<small>${new Date(m.created_at).toTimeString().slice(0, 5)}</small></div>`).join('') || `<p class="muted center">${t('sayHi')}</p>`}</div>
        <div class="ph-send"><input id="phIn" maxlength="300" placeholder="${t('typeMessage')}"><button id="phSend">➤</button></div>`;
      const chat = $('#phChat'); chat.scrollTop = 1e9;
      const send = async () => {
        const body = $('#phIn').value.trim(); if (!body) return; $('#phIn').value = '';
        try { await this.net.sendMessage(n, this.num, this.app.me.name, body.slice(0, 300)); } catch (e) { return this.app.toast(t('msgFailed')); }
        this.msgs.unshift({ id: Date.now(), to_phone: n, from_phone: this.num, from_name: this.app.me.name, body, created_at: new Date().toISOString() }); this.app.sfx('flap'); this.render(); $('#phIn').focus();
      };
      $('#phSend').onclick = send; $('#phIn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') send(); };
      b.querySelectorAll('[data-call]').forEach(x => x.onclick = () => this.startCall(x.dataset.call));
    } else if (this.screen === 'bank') {
      b.innerHTML = `${head('mBank')}${this.app.bankUI.appHtml()}`;
      this.app.bankUI.bindApp(b);
    } else if (this.screen === 'jobs') {
      const J = this.app.jobs; b.innerHTML = `${head('💼 ' + t('jobs'))}<div class="ph-jobs">${J.listHtml()}</div>`; J.bindList(b, () => this.close());
    } else if (this.screen === 'help') {
      b.innerHTML = `${head('🙋 ' + t('appHelp'))}<p class="ph-tip">${t('helpWhat')}</p><button class="ph-wide primary" id="phHelp">🙋 ${t('askHelp')}</button><p class="ph-tip">${t('helpTalkBot')}</p>`;
      $('#phHelp').onclick = () => { this.app.jobs.askHelp(); this.close(); };
    } else if (this.screen === 'mood') {
      b.innerHTML = `${head('🙂 ' + t('appMood'))}<div class="ph-mood"><canvas id="faceMood" width="160" height="160"></canvas><div id="camSpot"></div></div>
        <p class="ph-tip">${this.camOn ? '📷 ' + t('camReading') : t('moodTip')}</p>
        <button class="ph-wide ${this.camOn ? '' : 'primary'}" id="phCam">${this.camOn ? '⏹ ' + t('camStop') : '📷 ' + t('camStart')}</button>
        <div class="ph-moods">${MOOD_BTNS.map(([m, e]) => `<button data-mood="${m}" class="${(this.app.mood || '') === m ? 'on' : ''}">${e}</button>`).join('')}</div>`;
      $('#phCam').onclick = () => this.camera(!this.camOn);
      b.querySelectorAll('[data-mood]').forEach(x => x.onclick = () => { if (this.camOn) this.camera(false); this.setMood(x.dataset.mood); this.render(); });
      if (this.camOn && this.camVideo) $('#camSpot').appendChild(this.camVideo);
      this.drawFaces();
    } else if (this.screen === 'admin') this.app.admin.render(b, head);
    else if (this.screen === 'call') this.renderCall();
    b.querySelectorAll('[data-go]').forEach(x => x.onclick = () => this.go(x.dataset.go));
    if (this.camOn && this.camVideo && !this.camVideo.isConnected) document.body.appendChild(this.camVideo);
  }

  // ---------- messages ----------
  seenKey() { return 'banda_seen_' + this.app.me.uid; }
  seen() { try { return JSON.parse(localStorage.getItem(this.seenKey())) || {}; } catch (e) { return {}; } }
  unread() { const s = this.seen(); return (this.msgs || []).filter(m => m.to_phone === this.num && m.id > (s[m.from_phone] || 0)).length; }
  badge() { const n = this.unread(), b = $('#bPhone'); if (b) b.dataset.badge = n ? String(n) : ''; }
  onMessage(r) {
    if (!this.msgs) this.msgs = [];
    if (this.msgs.some(m => m.id === r.id)) return;
    this.msgs.unshift(r); this.app.sfx('chime'); this.badge();
    if (this.isOpen() && this.screen === 'thread' && this.thread === r.from_phone) this.render();
    else this.app.toast(`💬 ${this.nameOf(r.from_phone)}: ${r.body.slice(0, 50)}`);
    if (this.isOpen() && this.screen === 'messages') this.render();
  }

  // ---------- calls ----------
  async startCall(num) {
    const t = this.t;
    if (this.call) return;
    if (num === this.num) return this.app.toast(t('callSelf'));
    if (!this.online(num)) return this.app.toast(`${fmt(num)} · ${t('notOnline')}`);
    const m = this.net.online[num];
    this.call = { num, name: this.nameOf(num), avatar: m.avatar, state: 'calling', out: true, mood: '' };
    this.net.phoneSend(num, 'ring', { name: this.app.me.name, avatar: this.app.me.avatar });
    this.ring(true); this.open('call');
    this.call.timer = setTimeout(() => { if (this.call && this.call.state === 'calling') { this.app.toast(t('noAnswer')); this.hangup(true); } }, 30000);
  }
  async onSignal(p) {
    const c = this.call, t = this.t;
    if (p.type === 'ring') {
      if (c) return this.net.phoneSend(p.from, 'busy');
      this.call = { num: p.from, name: this.nameOf(p.from) === fmt(p.from) ? p.data.name : this.nameOf(p.from), avatar: p.data.avatar, state: 'ringing', out: false, mood: '' };
      this.ring(true); this.open('call'); return;
    }
    if (!c || p.from !== c.num) return;
    if (p.type === 'busy') { this.app.toast(t('busy')); return this.hangup(true); }
    if (p.type === 'decline' || p.type === 'hangup') { this.app.toast(p.type === 'decline' ? t('declined') : t('callEnded')); return this.hangup(true); }
    if (p.type === 'accept') { clearTimeout(c.timer); this.ring(false); await this.connect(true); }
    if (p.type === 'offer' && c.pc) { await c.pc.setRemoteDescription(p.data); this.flushIce(c); const ans = await c.pc.createAnswer(); await c.pc.setLocalDescription(ans); this.net.phoneSend(c.num, 'answer', { type: ans.type, sdp: ans.sdp }); }
    if (p.type === 'answer' && c.pc) { await c.pc.setRemoteDescription(p.data); this.flushIce(c); }
    if (p.type === 'ice' && p.data) { if (c.pc && c.pc.remoteDescription) { try { await c.pc.addIceCandidate(p.data); } catch (e) {} } else (c.iceQ ||= []).push(p.data); }
    if (p.type === 'fx') { c.mood = p.data || ''; this.drawFaces(); }
  }
  flushIce(c) { (c.iceQ || []).forEach(x => c.pc.addIceCandidate(x).catch(() => {})); c.iceQ = []; }
  async accept() { const c = this.call; if (!c) return; this.ring(false); await this.connect(false); this.net.phoneSend(c.num, 'accept'); }
  decline() { if (!this.call) return; this.net.phoneSend(this.call.num, 'decline'); this.hangup(true); }
  // microphone audio over WebRTC; both sides wait for the other's offer/answer through the phone channel
  async connect(caller) {
    const c = this.call; c.state = 'talking'; c.t0 = Date.now(); this.render();
    try { c.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch (e) { this.app.toast(this.t('noMic')); }
    const pc = c.pc = new RTCPeerConnection({ iceServers: ICE });
    if (c.stream) c.stream.getTracks().forEach(tr => pc.addTrack(tr, c.stream));
    else pc.addTransceiver('audio', { direction: 'recvonly' });
    pc.onicecandidate = e => e.candidate && this.net.phoneSend(c.num, 'ice', e.candidate.toJSON());
    pc.ontrack = e => { let a = $('#callAudio'); if (!a) { a = document.createElement('audio'); a.id = 'callAudio'; a.autoplay = true; document.body.appendChild(a); } a.srcObject = e.streams[0]; a.play().catch(() => {}); };
    pc.onconnectionstatechange = () => { if (['failed', 'closed'].includes(pc.connectionState) && this.call === c) { this.app.toast(this.t('callEnded')); this.hangup(false); } };
    if (caller) { const off = await pc.createOffer(); await pc.setLocalDescription(off); this.net.phoneSend(c.num, 'offer', { type: off.type, sdp: off.sdp }); }
    c.tick = setInterval(() => { const d = $('#callTime'); if (d && c.t0) { const s = Math.floor((Date.now() - c.t0) / 1000); d.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; } }, 500);
  }
  hangup(silent) {
    const c = this.call; if (!c) return;
    if (!silent) this.net.phoneSend(c.num, 'hangup');
    c.state = 'ended'; clearTimeout(c.timer); clearInterval(c.tick); this.ring(false); this.camera(false);
    try { c.pc && c.pc.close(); } catch (e) {} if (c.stream) c.stream.getTracks().forEach(tr => tr.stop());
    const a = $('#callAudio'); if (a) a.srcObject = null;
    this.call = null; this.mini(false); this.app.sfx('hit');
    if (this.isOpen()) this.go('home');
  }
  ring(on) { clearInterval(this.ringT); if (on) { const r = () => this.app.sfx('chime'); r(); this.ringT = setInterval(r, 2200); } }
  mute() { const c = this.call; if (!c || !c.stream) return; c.muted = !c.muted; c.stream.getAudioTracks().forEach(tr => tr.enabled = !c.muted); this.render(); }
  mini(show) { let m = $('#callMini'); if (!show) { m && m.remove(); return; } if (!m) { m = el(`<button id="callMini">📞 <span></span></button>`); document.body.appendChild(m); m.onclick = () => this.open('call'); } m.querySelector('span').textContent = this.call ? this.call.name : ''; }

  renderCall() {
    const c = this.call, t = this.t, b = $('#phoneBody');
    if (!c) return this.go('home');
    const status = c.state === 'calling' ? t('calling') : c.state === 'ringing' ? t('incoming') : '';
    b.innerHTML = `<div class="call">
      <canvas id="faceThem" width="256" height="256"></canvas>
      <b class="call-name">${esc(c.name)}</b><small>${fmt(c.num)}</small>
      <div class="call-status">${status}<span id="callTime"></span></div>
      ${c.state === 'talking' ? `<div class="call-me"><canvas id="faceMe" width="128" height="128"></canvas><small>${this.camOn ? '😀 ' + t('camReading') : t('camOff')}</small></div>` : ''}
      <div class="call-btns">${c.state === 'ringing'
        ? `<button class="c-no" id="cNo">✕</button><button class="c-yes" id="cYes">📞</button>`
        : `${c.state === 'talking' ? `<button id="cMute" class="${c.muted ? 'on' : ''}">${c.muted ? '🔇' : '🎙️'}</button><button id="cCam" class="${this.camOn ? 'on' : ''}">📷</button>` : ''}<button class="c-no" id="cEnd">✕</button>`}</div>
      <p class="call-note">${t('camPrivacy')}</p></div>`;
    const on = (id, f) => { const x = $(id); if (x) x.onclick = f; };
    on('#cYes', () => this.accept()); on('#cNo', () => this.decline()); on('#cEnd', () => this.hangup(false));
    on('#cMute', () => this.mute()); on('#cCam', () => this.camera(!this.camOn));
    this.drawFaces();
  }
  // a cartoon head of each person; the face follows the mood read from their camera
  drawFaces() {
    const c = this.call; if (!c) return;
    const head = (cv, av, mood) => {
      if (!cv) return; const g = cv.getContext('2d'), W = cv.width, s = W / 128;
      g.clearRect(0, 0, W, W); g.save(); g.scale(s, s);
      g.fillStyle = av?.skin || '#f2c49b'; g.beginPath(); g.roundRect(14, 18, 100, 104, 30); g.fill();
      g.fillStyle = av?.hairColor || '#4a2c17'; if ((av?.hair || 'short') !== 'none') { g.beginPath(); g.roundRect(10, 8, 108, 34, [26, 26, 8, 8]); g.fill(); }
      g.translate(0, 8); drawFace(g, mood || av?.face || 'smile'); g.restore();
    };
    head($('#faceThem'), c.avatar, c.mood);
    head($('#faceMe'), this.app.me.avatar, this.app.mood);
    head($('#faceMood'), this.app.me.avatar, this.app.mood);
  }

  // ---------- camera → expression → avatar face ----------
  async camera(on) {
    const t = this.t;
    if (!on) { this.camOn = false; clearInterval(this.camT); if (this.camStream) this.camStream.getTracks().forEach(tr => tr.stop()); this.camStream = null; if (this.camVideo) this.camVideo.remove(); this.setMood(''); if (this.screen === 'call' || this.screen === 'mood') this.render(); return; }
    try {
      if (!window.faceapi) {
        this.app.toast(t('camLoading'));
        await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = FACE_API + 'dist/face-api.js'; s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
        await faceapi.nets.tinyFaceDetector.loadFromUri(FACE_API + 'model/');
        await faceapi.nets.faceExpressionNet.loadFromUri(FACE_API + 'model/');
      }
      this.camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240, facingMode: 'user' } });
    } catch (e) { this.app.toast(t('camFailed')); return; }
    // the video has to be in the page for some phones to give us frames; it is tiny unless the Mood app shows it
    const v = this.camVideo ||= Object.assign(document.createElement('video'), { muted: true, playsInline: true, autoplay: true, className: 'cam-preview' });
    v.setAttribute('playsinline', ''); if (!v.isConnected) document.body.appendChild(v);
    v.srcObject = this.camStream; await v.play().catch(() => {});
    this.camOn = true; if (this.screen === 'call' || this.screen === 'mood') this.render();
    this.app.toast('📷 ' + t('camReading'));
    const opts = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 });
    let busy = false;
    this.camT = setInterval(async () => {
      if (busy || !this.camOn) return; busy = true;
      try {
        const r = await faceapi.detectSingleFace(v, opts).withFaceExpressions();
        if (r) {
          // the strongest feeling that isn't "neutral"; small smiles count too
          const e = r.expressions, top = Object.entries(e).filter(([k]) => k !== 'neutral').sort((a, b) => b[1] - a[1])[0];
          const mood = !top || top[1] < 0.3 ? '' : { happy: 'laugh', angry: 'angry', disgusted: 'angry', surprised: 'excited', sad: 'sad', fearful: 'sad' }[top[0]] || '';
          if (mood === this.lastRead) this.setMood(mood); this.lastRead = mood;
        }
      } catch (er) {}
      busy = false;
    }, 300);
  }
  setMood(m) {
    if (this.app.mood === m) return;
    this.app.mood = m; this.app.world.me.setMood(m);
    if (this.call && this.call.state === 'talking') this.net.phoneSend(this.call.num, 'fx', m);
    this.drawFaces();
  }
}
