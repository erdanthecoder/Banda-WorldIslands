// 🔐 Admin (phone app). Unlocks with the admin password, which the server checks — it is not stored in the game.
// Admins can start shows for everyone, a big football match, a basketball match, fireworks, and set how many bots walk around.
import { SHOWS } from './shows.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Admin {
  constructor(app) { this.app = app; this.pw = null; try { this.pw = sessionStorage.getItem('wi_admin'); } catch (e) {} this.bots = app.bots ? app.bots.count : 10; }
  get t() { return this.app.t; }
  async cmd(kind, data) {
    try { const ok = await this.app.net.admin(this.pw, kind, data); if (!ok) { this.lock(); this.app.toast('🔐 ' + this.t('adminWrong')); } return ok; }
    catch (e) { this.app.toast('⚠️ ' + (e.message || 'error')); return false; }
  }
  lock() { this.pw = null; try { sessionStorage.removeItem('wi_admin'); } catch (e) {} }
  render(b, head) {
    const t = this.t, app = this.app;
    if (!this.pw) {
      b.innerHTML = `${head('🔐 ' + t('appAdmin'))}<p class="ph-tip">${t('adminIntro')}</p>
        <label class="ph-field">${t('password')}<input id="admPw" type="password" inputmode="numeric" autocomplete="off" maxlength="20"></label>
        <button class="ph-wide primary" id="admGo">🔓 ${t('unlock')}</button>`;
      const go = async () => {
        const pw = $('#admPw').value.trim(); if (!pw) return;
        $('#admGo').disabled = true;
        let ok = false; try { ok = await app.net.admin(pw, 'check'); } catch (e) {}
        if (!ok) { $('#admGo').disabled = false; app.sfx('wrong'); return app.toast('🔐 ' + t('adminWrong')); }
        this.pw = pw; try { sessionStorage.setItem('wi_admin', pw); } catch (e) {}
        app.sfx('paid'); this.render(b, head);
      };
      $('#admGo').onclick = go; $('#admPw').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') go(); };
      return;
    }
    this.bots = app.bots ? app.bots.count : this.bots;
    b.innerHTML = `${head('🔐 ' + t('appAdmin'))}<div class="adm-grid">
        ${Object.keys(SHOWS).map(k => `<button data-show="${k}"><b>${SHOWS[k].icon}</b>${t('show_' + k)}</button>`).join('')}
        <button data-show="stop"><b>⏹</b>${t('stopShow')}</button>
        <button data-act="bigfoot"><b>⚽</b>${t('bigFootball')}</button>
        <button data-act="basket"><b>🏀</b>${t('mg_basketball')}</button>
        <button data-act="fireworks"><b>🎆</b>${t('ab_fireworks')}</button>
      </div>
      <h4>🤖 ${t('botCount')}</h4>
      <div class="adm-bots"><button data-n="-5">−5</button><button data-n="-1">−1</button><b id="admN">${this.bots}</b><button data-n="1">+1</button><button data-n="5">+5</button></div>
      <button class="ph-wide primary" id="admBots">✓ ${t('apply')}</button>
      <h4>📣 ${t('announce')}</h4>
      <div class="ph-send"><input id="admAnn" maxlength="200" placeholder="${esc(t('announceHint'))}"><button id="admAnnGo">➤</button></div>
      <button class="ph-wide" id="admLock">🔒 ${t('lockAdmin')}</button>`;
    b.querySelectorAll('[data-show]').forEach(x => x.onclick = async () => { if (await this.cmd('show', { kind: x.dataset.show })) { app.phone.close(); } });
    b.querySelectorAll('[data-act]').forEach(x => x.onclick = async () => {
      const a = x.dataset.act;
      if (a === 'fireworks') return this.cmd('fireworks', {});
      if (!(await this.cmd('check'))) return;
      app.phone.close();
      if (a === 'bigfoot') app.mg.start('football', 5, { bots: 16 });
      if (a === 'basket') app.mg.start('basketball', 5, { bots: 8 });
    });
    b.querySelectorAll('[data-n]').forEach(x => x.onclick = () => { this.bots = Math.max(0, Math.min(30, this.bots + +x.dataset.n)); $('#admN').textContent = this.bots; });
    $('#admBots').onclick = async () => { if (await this.cmd('botcount', { n: this.bots })) app.toast(`🤖 ${t('botCount')}: ${this.bots}`); };
    const ann = async () => { const text = $('#admAnn').value.trim(); if (!text) return; if (await this.cmd('announce', { text: text.slice(0, 200), name: '🔐 ' + app.me.name })) $('#admAnn').value = ''; };
    $('#admAnnGo').onclick = ann; $('#admAnn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') ann(); };
    $('#admLock').onclick = () => { this.lock(); this.render(b, head); };
  }
}
