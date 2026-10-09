// mBank: get a free card (desk 1), switch on Hand Pay (desk 2), learn how to pay (desk 3),
// and the mBank app on your phone.
import { money, ICON } from './shop.js';

const $ = s => document.querySelector(s);
const el = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STAFF = ['👩‍💼', '🧑‍💼', '👨‍💼'];

export class BankUI {
  constructor(app) {
    this.app = app;
    document.body.append(
      el(`<div id="bankBox" class="modal hidden"><div class="sheet small bank-sheet"><div class="sheet-head"><h2 id="bankTitle"></h2><button class="ibtn light" data-x>✕</button></div><div id="bankBody"></div></div></div>`),
      el(`<div id="phoneBox" class="modal hidden"><div class="phone"><div class="phone-notch"></div><button class="phone-x" data-x>✕</button><div id="phoneBody"></div></div></div>`),
    );
    document.querySelectorAll('#bankBox [data-x], #phoneBox [data-x]').forEach(b => b.onclick = () => this.close());
  }
  get t() { return this.app.t; }
  lock(on) { this.app.world.inputLocked = on; this.app.world.keys = {}; }
  close() { $('#bankBox').classList.add('hidden'); $('#phoneBox').classList.add('hidden'); this.lock(false); }
  card(small = false) {
    const b = this.app.bank || {};
    return `<div class="bankcard${small ? ' small' : ''}"><b>mBank</b><i class="chip-gold"></i><span class="cardno">${esc(b.card || '•••• •••• •••• ••••')}</span><small class="cardname">${esc(this.app.me.name)}</small>${b.hand ? '<em>✋ Hand Pay</em>' : ''}</div>`;
  }
  say(i, html, actions = '') {
    $('#bankTitle').textContent = this.t('bankDesk' + i);
    $('#bankBody').innerHTML = `<div class="staff"><span class="face">${STAFF[i]}</span><div class="bubble">${html}</div></div>${actions}`;
    $('#bankBox').classList.remove('hidden'); this.lock(true);
  }

  desk(i) {
    const t = this.t, b = this.app.bank || {};
    this.app.sfx('chime');
    if (i === 0) {
      if (b.card) return this.say(0, `${t('bankHaveCard')}`, `${this.card()}<div class="row"><button class="btn primary" id="bkOk">${t('done')}</button></div>`), this.ok();
      this.say(0, t('bankOffer'), `<div class="row"><button class="btn primary big" id="bkGet">💳 ${t('bankGetCard')}</button></div>`);
      $('#bkGet').onclick = async () => {
        $('#bkGet').disabled = true;
        try { const card = await this.app.net.bankOpen(); this.app.bank = { ...b, card }; } catch (e) { this.app.toast(t('payFailed')); $('#bkGet').disabled = false; return; }
        this.app.sfx('paid'); this.app.world.fireworks(2);
        this.say(0, `${t('bankCardReady')}`, `<div class="card-pop">${this.card()}</div><div class="row"><button class="btn primary" id="bkNext">${t('bankNextHand')} →</button></div>`);
        $('#bkNext').onclick = () => this.close();
      };
    } else if (i === 1) {
      if (!b.card) return this.say(1, t('bankNeedCardFirst'), `<div class="row"><button class="btn primary" id="bkOk">OK</button></div>`), this.ok();
      if (b.hand) return this.say(1, t('bankHandOn'), `<div class="row"><button class="btn primary" id="bkOk">${t('done')}</button></div>`), this.ok();
      this.say(1, t('bankHandHow'), `<div id="setupPalm" class="palm small-palm"><svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="54"/><circle class="arc" cx="60" cy="60" r="54" pathLength="100"/></svg><span class="hand">🖐️</span><i class="scanline"></i></div><p class="center muted" id="setupMsg">${t('holdHand')}</p>`);
      this.scanner($('#setupPalm'), async () => {
        try { await this.app.net.handSetup(); } catch (e) {}
        this.app.bank = { ...this.app.bank, hand: true }; this.app.sfx('paid');
        this.say(1, t('bankHandDone'), `${this.card()}<div class="row"><button class="btn primary" id="bkOk">${t('done')}</button></div>`); this.ok();
      });
    } else {
      this.say(2, t('bankHelp'), `<div class="row"><button class="btn primary" id="bkOk">${t('gotIt')}</button></div>`); this.ok();
    }
  }
  ok() { const o = $('#bkOk'); if (o) o.onclick = () => this.close(); }
  scanner(P, done) {
    let t0 = 0, raf = 0, on = false; const arc = P.querySelector('.arc');
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / 1200); arc.style.strokeDashoffset = 100 - k * 100; if (k >= 1) { on = false; P.classList.remove('scanning'); P.classList.add('done'); done(); return; } raf = requestAnimationFrame(tick); };
    P.addEventListener('pointerdown', e => { e.preventDefault(); if (on || P.classList.contains('done')) return; on = true; t0 = performance.now(); P.classList.add('scanning'); this.app.sfx('scan'); tick(); });
    const up = () => { if (!on) return; on = false; cancelAnimationFrame(raf); P.classList.remove('scanning'); arc.style.strokeDashoffset = 100; };
    P.addEventListener('pointerup', up); P.addEventListener('pointerleave', up); P.addEventListener('pointercancel', up);
  }

  // the phone: mBank app
  phone() {
    const t = this.t, b = this.app.bank || {};
    const log = this.app.payLog ? this.app.payLog() : [];
    $('#phoneBody').innerHTML = `
      <div class="app-head"><span class="mpay-logo">m</span><b>mBank</b></div>
      ${b.card ? this.card(true) : `<div class="nocard">🏦<b>${t('needCard')}</b><span>${t('needCardHow')}</span></div>`}
      <div class="app-bal"><small>${t('balance')}</small><b>${money(this.app.money)}</b></div>
      <div class="app-row"><span>✋ Hand Pay</span><b class="${b.hand ? 'ok' : 'off'}">${b.hand ? t('on') : t('off')}</b></div>
      <h4>${t('recent')}</h4>
      <div class="app-log">${log.length ? log.map(l => `<div><span>${l.items.map(i => ICON[i.item] || '').join(' ')} ${l.how === 'hand' ? '✋' : '📱'}</span><b>−${money(l.total)}</b></div>`).join('') : `<p class="muted">${t('noPayments')}</p>`}</div>
      <p class="app-tip">${t('earnTip')}</p>`;
    $('#phoneBox').classList.remove('hidden'); this.lock(true); this.app.sfx('click');
  }
}
