// 💳 mPAY rewards: every payment gives cashback (more as your mPAY level grows: Blue → Silver → Gold → Diamond),
// a rain of coins, and a scratch card for each payment of $1 or more. Scratch it to win up to $10.
// The server decides everything (cashback, tickets, prizes); this file only makes it fun to watch.
import { money } from './shop.js';

const $ = s => document.querySelector(s);
const el = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };
export const LEVELS = [
  { min: 0, k: 'blue', icon: '🔵', pct: 3, color: '#3a86ff' },
  { min: 5000, k: 'silver', icon: '🥈', pct: 5, color: '#c9d3df' },
  { min: 20000, k: 'gold', icon: '🥇', pct: 7, color: '#ffc23a' },
  { min: 100000, k: 'diamond', icon: '💎', pct: 10, color: '#6ff3ff' },
];
export const levelOf = spent => LEVELS.reduce((a, L, i) => (spent >= L.min ? i : a), 0);

export class MPay {
  constructor(app) {
    this.app = app; this.st = { spent: 0, tickets: 0, pct: 3 };
    document.body.append(el(`<div id="scratchBox" class="modal hidden"><div class="mpay scratch-sheet"><button class="mpay-x" data-x>✕</button>
      <div class="mpay-brand"><img src="/img/mbank.svg" class="mb-logo" alt="">mPAY <span class="sc-t" id="scTitle"></span></div>
      <div id="scBody"></div></div></div>`));
    $('#scratchBox [data-x]').onclick = () => this.close();
    this.refresh();
  }
  get t() { return this.app.t; }
  async refresh() { try { const s = await this.app.net.mpayStatus(); if (s) this.st = s; } catch (e) {} return this.st; }
  level() { return LEVELS[levelOf(this.st.spent)]; }
  // a small card for the mBank app: your level, progress to the next one and your scratch cards
  html() {
    const t = this.t, i = levelOf(this.st.spent), L = LEVELS[i], N = LEVELS[i + 1];
    const k = N ? Math.min(1, (this.st.spent - L.min) / (N.min - L.min)) : 1;
    return `<div class="mp-level" style="--lv:${L.color}"><div class="mp-badge">${L.icon}</div><div class="mp-info"><b>mPAY ${t('mp_' + L.k)}</b><small>${t('mpCashback').replace('{p}', L.pct)}</small>
      <div class="mp-bar"><i style="width:${(k * 100).toFixed(0)}%"></i></div><small>${N ? t('mpNext').replace('{m}', money(N.min - this.st.spent)).replace('{l}', N.icon + ' ' + t('mp_' + N.k)) : t('mpTop')}</small></div></div>
      <button class="ph-wide primary" id="mpScratch">🎟️ ${t('mpScratch')} · ${this.st.tickets}</button>`;
  }
  bind(root, before) { const b = root.querySelector('#mpScratch'); if (b) b.onclick = () => { before && before(); this.scratch(); }; }

  // after a payment: cashback, coin rain, a new scratch card, maybe a new level
  async celebrate(total, box, onScratch) {
    const t = this.t, before = { ...this.st }, back = Math.floor(total * before.pct / 100);
    const after = await this.refresh();
    const ticket = after.tickets > before.tickets || (total >= 100 && before.tickets >= 5);
    const up = levelOf(after.spent) > levelOf(before.spent), L = LEVELS[levelOf(after.spent)];
    const party = el(`<div class="mp-party">
      <div class="mp-rain">${Array.from({ length: 18 }, (_, i) => `<i style="left:${(i * 5.6 + Math.random() * 4).toFixed(1)}%;animation-delay:${(Math.random() * 0.9).toFixed(2)}s;font-size:${18 + Math.random() * 16 | 0}px">${['🪙', '💰', '✨', '💵'][i % 4]}</i>`).join('')}</div>
      ${back > 0 ? `<div class="mp-back">💸 ${t('mpBack')} <b>+${money(back)}</b> <small>${before.pct}%</small></div>` : ''}
      ${up ? `<div class="mp-up" style="--lv:${L.color}">${L.icon} ${t('mpLevelUp').replace('{l}', t('mp_' + L.k)).replace('{p}', L.pct)}</div>` : ''}
      ${ticket ? `<button class="mp-ticket" id="mpGoScratch">🎟️ ${t('mpGotTicket')} <b>${t('mpScratchNow')} →</b></button>` : ''}
    </div>`);
    box.querySelector('.mp-party')?.remove(); box.append(party);
    this.app.sfx('coin'); setTimeout(() => this.app.sfx('coin'), 180); setTimeout(() => this.app.sfx('correct'), 380);
    if (up) { this.app.world.fireworks(3); setTimeout(() => this.app.sfx('cheer'), 300); }
    const go = party.querySelector('#mpGoScratch'); if (go) go.onclick = () => onScratch && onScratch();
    setTimeout(() => party.querySelector('.mp-rain')?.remove(), 2600);
  }

  close() { $('#scratchBox').classList.add('hidden'); this.app.world.inputLocked = false; }
  // the scratch card: rub the silver layer off to see what you won
  async scratch() {
    const t = this.t; await this.refresh();
    this.app.world.inputLocked = true; this.app.world.keys = {};
    $('#scratchBox').classList.remove('hidden'); $('#scTitle').textContent = '🎟️ ' + t('mpScratchTitle');
    const body = $('#scBody');
    if (this.st.tickets < 1) { body.innerHTML = `<p class="mpay-msg">${t('mpNoTicket')}</p><div class="sc-how">${this.html().replace(/<button[\s\S]*<\/button>/, '')}</div>`; return; }
    body.innerHTML = `<p class="sc-left">${t('mpTickets').replace('{n}', this.st.tickets)}</p>
      <div class="sc-card"><div class="sc-prize" id="scPrize"><span>🎁</span><b>?</b></div><canvas id="scCanvas" width="560" height="300"></canvas></div>
      <p class="mpay-msg" id="scMsg">${t('mpRub')}</p><div class="row"><button class="btn primary" id="scAgain" hidden></button></div>`;
    const cv = $('#scCanvas'), g = cv.getContext('2d', { willReadFrequently: true });
    // the silver layer with sparkles and a hint
    const grd = g.createLinearGradient(0, 0, 560, 300); grd.addColorStop(0, '#b9c2cc'); grd.addColorStop(0.5, '#eef2f6'); grd.addColorStop(1, '#a3adb8');
    g.fillStyle = grd; g.fillRect(0, 0, 560, 300);
    for (let i = 0; i < 260; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.6})`; g.fillRect(Math.random() * 560, Math.random() * 300, 3, 3); }
    g.fillStyle = '#5b6672'; g.font = '800 40px Manrope, system-ui'; g.textAlign = 'center'; g.fillText('✋ ' + t('mpRubShort'), 280, 140); g.font = '700 26px Manrope, system-ui'; g.fillText('mPAY · 🪙 🪙 🪙', 280, 190);
    let prize = null, asked = false, done = false, moves = 0, down = false;
    const ask = async () => {
      if (asked) return; asked = true;
      try {
        const r = await this.app.net.mpayScratch(); prize = r; this.st.tickets = r.tickets;
        $('#scPrize').innerHTML = `<span>${r.prize >= 500 ? '💎' : r.prize >= 200 ? '🤑' : r.prize >= 100 ? '💰' : '🪙'}</span><b>${money(r.prize)}</b>`;
        $('#scPrize').classList.toggle('big', r.prize >= 200);
      } catch (e) { $('#scMsg').textContent = /limit/.test(e.message || '') ? t('mpLimit') : t('payFailed'); $('#scMsg').className = 'mpay-msg bad'; }
    };
    const pos = e => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) / r.width * 560, (e.clientY - r.top) / r.height * 300]; };
    const rub = e => {
      if (!down || done) return; const [x, y] = pos(e);
      g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.arc(x, y, 30, 0, 7); g.fill(); g.globalCompositeOperation = 'source-over';
      if (++moves % 6 === 0) { this.app.sfx('zip'); check(); }
    };
    const check = () => {
      if (!prize) return; const d = g.getImageData(0, 0, 560, 300).data; let clear = 0, n = 0;
      for (let i = 3; i < d.length; i += 4 * 37) { n++; if (d[i] < 40) clear++; }
      if (clear / n > 0.5) reveal();
    };
    const reveal = () => {
      if (done) return; done = true; g.clearRect(0, 0, 560, 300); cv.style.opacity = 0;
      this.app.setMoney(prize.balance); this.app.sfx('paid'); const left = document.querySelector('.sc-left'); if (left) left.textContent = t('mpTickets').replace('{n}', this.st.tickets); setTimeout(() => this.app.sfx(prize.prize >= 200 ? 'cheer' : 'star'), 200);
      if (prize.prize >= 200) this.app.world.fireworks(4);
      $('#scMsg').innerHTML = `🎉 ${t('mpWon').replace('{m}', money(prize.prize))}`; $('#scMsg').className = 'mpay-msg ok';
      const again = $('#scAgain'); again.hidden = false;
      if (this.st.tickets > 0) { again.textContent = `🎟️ ${t('mpAnother')} (${this.st.tickets})`; again.onclick = () => this.scratch(); }
      else { again.textContent = t('done'); again.onclick = () => this.close(); }
    };
    cv.addEventListener('pointerdown', e => { e.preventDefault(); down = true; try { cv.setPointerCapture(e.pointerId); } catch (er) {} ask(); rub(e); });
    cv.addEventListener('pointermove', rub);
    const up = () => { down = false; if (prize && !done) check(); };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  }
}
