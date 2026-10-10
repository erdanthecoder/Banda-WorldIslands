// 🔐 Admin (phone app). Unlocks with the admin password, which the server checks — it is not stored in the game.
// Admins can start shows, fun effects and powers on every server, give money to anyone, and set how many bots walk around.
import { SHOWS, V2_SHOWS, V2_FX } from './shows.js';
import { isV2 } from './launch.js';

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
    const fun = [['launch', '🚀'], ['dance', '💃'], ['candy', '🍬'], ['fish', '🐟'], ['chickens', '🐔'], ['barsik', '🐱'], ['tornado', '🌪️'], ['quake', '🌍'], ['rainbow', '🌈'], ['bubbles', '🫧'], ['tiny', '🐜'], ['freeze', '🧊'], ['shuffle', '🔀'], ['snow', '❄️'], ['meteors', '☄️'], ['confetti', '🎊']];
    const v2 = isV2(), showKeys = Object.keys(SHOWS).filter(k => v2 || !V2_SHOWS.includes(k)), funList = fun.filter(([k]) => v2 || !V2_FX.includes(k));
    const powers = [['night', '🌙'], ['lowGravity', '🪶'], ['speed', '⚡'], ['giant', '🦖']];
    const people = [{ uid: app.me.uid, name: app.me.name + ' (' + t('me') + ')' }, ...Object.values(app.players).filter((p, i, a) => p.uid && p.uid !== app.me.uid && a.findIndex(q => q.uid === p.uid) === i).map(p => ({ uid: p.uid, name: p.name }))];
    b.innerHTML = `${head('🔐 ' + t('appAdmin'))}<p class="ph-tip" style="margin-top:4px">🌍 ${t('adminAll')}</p>
      <h4>🎪 ${t('shows')}</h4><p class="ph-tip" style="margin:0 0 6px">${v2 ? t('showsHint') : ''} ${app.shows && app.shows.on ? '· ▶ ' + Object.keys(app.shows.active).map(k => SHOWS[k].icon).join(' ') : ''}</p><div class="adm-grid">
        ${v2 ? `<button data-act="mega" class="mega"><b>🎉</b>${t('megaParty')}</button>` : ''}
        ${showKeys.map(k => `<button data-show="${k}"><b>${SHOWS[k].icon}</b>${t('show_' + k)}</button>`).join('')}
        <button data-show="stop"><b>⏹</b>${t('stopShow')}</button>
        <button data-act="bigfoot"><b>⚽</b>${t('bigFootball')}</button>
        <button data-act="basket"><b>🏀</b>${t('mg_basketball')}</button>
        <button data-act="fireworks"><b>🎆</b>${t('ab_fireworks')}</button>
        <button data-act="summon"><b>🧲</b>${t('summonAll')}</button>
      </div>
      <h4>🎉 ${t('funAll')}</h4><div class="adm-grid">${funList.map(([k, i]) => `<button data-fx="${k}"><b>${i}</b>${t('fxn_' + k)}</button>`).join('')}</div>
      <h4>✨ ${t('powersAll')}</h4><div class="adm-grid">${powers.map(([k, i]) => `<button data-pow="${k}" class="${app.effects[k] ? 'on' : ''}"><b>${i}</b>${t('ab_' + k)}</button>`).join('')}</div>
      <h4>💰 ${t('giveMoney')}</h4>
      <div class="adm-money">
        <div class="ph-numin">$ <input id="admCash" type="number" inputmode="decimal" min="0.01" max="10000" step="0.01" value="10"></div>
        <div class="adm-chips">${[1, 5, 10, 50, 100, 1000].map(n => `<button data-cash="${n}">$${n}</button>`).join('')}</div>
        <select id="admWho">${people.map(p => `<option value="${esc(p.uid)}">${esc(p.name)}</option>`).join('')}<option value="phone">📞 ${t('byPhone')}</option><option value="all">🌍 ${t('everyoneOnline')}</option></select>
        <div class="ph-numin hidden" id="admPhoneRow">+0 <input id="admPhone" inputmode="numeric" maxlength="4"></div>
        <button class="ph-wide primary" id="admGive">💸 ${t('give')}</button>
      </div>
      <h4>🤖 ${t('botCount')}</h4>
      <div class="adm-bots"><button data-n="-5">−5</button><button data-n="-1">−1</button><b id="admN">${this.bots}</b><button data-n="1">+1</button><button data-n="5">+5</button></div>
      <button class="ph-wide primary" id="admBots">✓ ${t('apply')}</button>
      <h4>📣 ${t('announce')}</h4>
      <div class="ph-send"><input id="admAnn" maxlength="200" placeholder="${esc(t('announceHint'))}"><button id="admAnnGo">➤</button></div>
      <button class="ph-wide" id="admLock">🔒 ${t('lockAdmin')}</button>`;
    b.querySelectorAll('[data-show]').forEach(x => x.onclick = async () => { if (await this.cmd('show', { kind: x.dataset.show })) app.phone.close(); });
    b.querySelectorAll('[data-fx]').forEach(x => x.onclick = async () => { if (await this.cmd('fx', { type: x.dataset.fx })) app.sfx('click'); });
    b.querySelectorAll('[data-pow]').forEach(x => x.onclick = async () => { const k = x.dataset.pow, on = !app.effects[k]; if (await this.cmd('effects', { ...app.effects, [k]: on })) { x.classList.toggle('on', on); app.toast(`${t('ab_' + k)}: ${on ? t('on') : t('off')}`); } });
    b.querySelectorAll('[data-act]').forEach(x => x.onclick = async () => {
      const a = x.dataset.act;
      if (a === 'fireworks') return this.cmd('fireworks', {});
      if (a === 'mega') { for (const k of ['disco', 'ufo', 'foam']) if (!(await this.cmd('show', { kind: k }))) return; app.phone.close(); return; }
      if (a === 'summon') { const p = app.world.me.group.position; if (await this.cmd('summon', { x: p.x, z: p.z, y: p.y })) app.toast('🧲 ' + t('summoned2')); return; }
      if (await this.cmd('bigfootball', { type: a === 'basket' ? 'basketball' : 'football' })) app.phone.close();
    });
    b.querySelectorAll('[data-cash]').forEach(x => x.onclick = () => { $('#admCash').value = x.dataset.cash; });
    $('#admWho').onchange = () => $('#admPhoneRow').classList.toggle('hidden', $('#admWho').value !== 'phone');
    $('#admPhone').onkeydown = $('#admCash').onkeydown = e => e.stopPropagation();
    $('#admGive').onclick = async () => {
      const cents = Math.round(parseFloat($('#admCash').value) * 100), who = $('#admWho').value;
      if (!(cents >= 1 && cents <= 1000000)) return app.toast('💰 ' + t('badAmount'));
      $('#admGive').disabled = true;
      try {
        if (who === 'all') { if (await this.cmd('moneyall', { cents })) app.toast(`💸 $${(cents / 100).toFixed(2)} → ${t('everyoneOnline')}`); }
        else { const phone = who === 'phone' ? $('#admPhone').value.replace(/\D/g, '') : null; if (who === 'phone' && phone.length !== 4) throw new Error(t('contactBad'));
          await app.net.adminMoney(this.pw, cents, who === 'phone' ? null : who, phone); app.toast(`💸 $${(cents / 100).toFixed(2)} ✓`); }
      } catch (e) { app.toast('⚠️ ' + (/number/.test(e.message) ? t('noSuchNumber') : e.message)); }
      $('#admGive').disabled = false;
    };
    b.querySelectorAll('[data-n]').forEach(x => x.onclick = () => { this.bots = Math.max(0, Math.min(30, this.bots + +x.dataset.n)); $('#admN').textContent = this.bots; });
    $('#admBots').onclick = async () => { if (await this.cmd('botcount', { n: this.bots })) app.toast(`🤖 ${t('botCount')}: ${this.bots}`); };
    const ann = async () => { const text = $('#admAnn').value.trim(); if (!text) return; if (await this.cmd('announce', { text: text.slice(0, 200), name: '🔐 ' + app.me.name })) $('#admAnn').value = ''; };
    $('#admAnnGo').onclick = ann; $('#admAnn').onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') ann(); };
    $('#admLock').onclick = () => { this.lock(); this.render(b, head); };
  }
}
