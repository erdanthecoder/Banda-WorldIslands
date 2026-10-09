// Banda Market: shelves -> basket -> mPAY palm-scanner checkout. Money lives on the server
// (cents); prices here are only for showing — the server charges its own prices.
export const PRICES = {
  apple: 100, banana: 100, juice: 150, soda: 150, chips: 150, chocolate: 200, icecream: 250, pizza: 300, burger: 400, cake: 500,
  coffee: 200, latte: 300, cocoa: 250, tea: 100, croissant: 200,
  ball: 800, balloon: 300, teddy: 1200, crown: 5000, headphones: 2500, tophat: 2000, dog: 4000, cat: 4000, bunny: 3500, dragon: 9000,
};
export const ICON = {
  apple: '🍎', banana: '🍌', juice: '🧃', soda: '🥤', chips: '🍟', chocolate: '🍫', icecream: '🍦', pizza: '🍕', burger: '🍔', cake: '🎂',
  coffee: '☕', latte: '🧋', cocoa: '🍫', tea: '🍵', croissant: '🥐',
  ball: '⚽', balloon: '🎈', teddy: '🧸', crown: '👑', headphones: '🎧', tophat: '🎩', dog: '🐶', cat: '🐱', bunny: '🐰', dragon: '🐲',
};
export const FOOD = ['coffee', 'latte', 'cocoa', 'tea', 'croissant', 'apple', 'banana', 'juice', 'soda', 'chips', 'chocolate', 'icecream', 'pizza', 'burger', 'cake'];
export const HAT_ITEMS = ['crown', 'headphones', 'tophat'];
export const PET_ITEMS = ['dog', 'cat', 'bunny', 'dragon'];
export const CAFE = ['coffee', 'latte', 'cocoa', 'tea', 'croissant', 'juice', 'icecream', 'cake'];
export const DRINKS = ['coffee', 'latte', 'cocoa', 'tea', 'croissant'];
export const money = c => '$' + (Math.max(0, c || 0) / 100).toFixed(2);

const $ = s => document.querySelector(s);
const el = html => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };

export class Shop {
  constructor(app) {
    this.app = app; this.basket = {}; this.inv = {};
    const t = app.t;
    document.body.append(
      el(`<div id="shopBox" class="modal hidden"><div class="sheet small"><div class="sheet-head"><h2 id="shopTitle"></h2><button class="ibtn light" data-x>✕</button></div><div id="shopList" class="shop-grid"></div><div class="row shop-foot"><span id="shopBasket"></span><button class="btn primary" id="shopGo"></button></div></div></div>`),
      el(`<div id="payBox" class="modal hidden"><div class="mpay"><button class="mpay-x" data-x>✕</button>
        <div class="mpay-brand"><img src="/img/mbank.svg" class="mb-logo" alt="">mPAY</div>
        <div id="payLines" class="mpay-lines"></div>
        <div class="mpay-total"><span>${t('total')}</span><b id="payTotal"></b></div>
        <div class="mpay-bal"><span>${t('balance')}</span><b id="payBal"></b></div>
        <div id="payNeed" class="mpay-need hidden"></div>
        <div class="paytabs" id="payTabs"><button data-m="phone">📱 <span>${t('payPhone')}</span></button><button data-m="hand">✋ <span>${t('payHand')}</span></button></div>
        <div id="payPhone" class="mphone hidden"><div class="mphone-top">mBank</div><div class="bankcard small"><b><img src="/img/mbank.svg" alt="">mBank</b><span class="cardno"></span><small class="cardname"></small></div><button class="btn primary big" id="phonePay"></button></div>
        <div id="palm" class="palm hidden"><svg viewBox="0 0 120 120" class="ring"><circle cx="60" cy="60" r="54"/><circle id="palmArc" cx="60" cy="60" r="54" pathLength="100"/></svg><span class="hand">🖐️</span><i class="scanline"></i></div>
        <p id="payMsg" class="mpay-msg"></p></div></div>`),
      el(`<div id="bagBox" class="modal hidden"><div class="sheet small"><div class="sheet-head"><h2>${t('bag')}</h2><button class="ibtn light" data-x>✕</button></div><p class="muted" id="bagMoney"></p><div id="bagList" class="shop-grid"></div></div></div>`),
      el(`<button id="basketChip" class="glass hidden"></button>`),
    );
    document.querySelectorAll('#shopBox [data-x], #payBox [data-x], #bagBox [data-x]').forEach(b => b.onclick = () => this.close());
    $('#basketChip').onclick = () => this.openBasket();
    this.palm();
    document.querySelectorAll('#payTabs button').forEach(b => b.onclick = () => this.method(b.dataset.m));
    $('#phonePay').onclick = () => { if (this.paying) return; this.app.sfx('beep'); this.pay(); };
  }
  // pick how to pay: the mBank app on your phone, or your hand on the scanner
  method(m) {
    const t = this.app.t, bank = this.app.bank || {};
    document.querySelectorAll('#payTabs button').forEach(b => b.classList.toggle('on', b.dataset.m === m));
    $('#payPhone').classList.toggle('hidden', m !== 'phone'); $('#palm').classList.toggle('hidden', m !== 'hand');
    $('#payMsg').className = 'mpay-msg';
    if (m === 'phone') { $('.mphone .cardno').textContent = bank.card || ''; $('.mphone .cardname').textContent = this.app.me.name; $('#phonePay').textContent = `${t('payBtn')} ${money(this.total())}`; $('#payMsg').textContent = t('phoneHint'); }
    if (m === 'hand') {
      if (!bank.hand) { $('#palm').classList.add('hidden'); $('#payMsg').innerHTML = `✋ ${t('handNotSet')}`; $('#payMsg').className = 'mpay-msg bad'; return; }
      $('#payMsg').textContent = t('holdHand');
    }
    this.m = m;
  }
  get w() { return this.app.world; }
  lock(on) { this.w.inputLocked = on; this.w.keys = {}; }
  close() { ['#shopBox', '#payBox', '#bagBox'].forEach(s => $(s).classList.add('hidden')); this.lock(false); this.scanning = false; }
  count() { return Object.values(this.basket).reduce((a, b) => a + b, 0); }
  total() { return Object.entries(this.basket).reduce((a, [k, n]) => a + PRICES[k] * n, 0); }
  chip() {
    const n = this.count(), c = $('#basketChip'); c.classList.toggle('hidden', !n);
    c.innerHTML = `🛒 <b>${n}</b> · ${money(this.total())}`;
  }

  // a shelf or the café counter: tap items to put them in the basket
  openAisle(title, items, { cafe = false } = {}) {
    const t = this.app.t; this.lock(true); this.app.sfx('click');
    $('#shopTitle').textContent = title;
    const draw = () => {
      $('#shopList').innerHTML = items.map(k => `<button class="item" data-k="${k}"><span class="ic">${ICON[k]}</span><span>${t('it_' + k)}</span><b>${money(PRICES[k])}</b>${this.basket[k] ? `<i>${this.basket[k]}</i>` : ''}${this.owned(k) ? `<small>✓ ${t('owned')}</small>` : ''}</button>`).join('');
      $('#shopBasket').textContent = `🛒 ${this.count()} · ${money(this.total())}`;
      $('#shopGo').textContent = cafe ? `✋ ${t('payMpay')}` : t('done');
      $('#shopGo').disabled = cafe && !this.count();
      document.querySelectorAll('#shopList .item').forEach(b => b.onclick = () => {
        const k = b.dataset.k;
        if (this.owned(k)) return this.app.toast(t('alreadyOwn'));
        if ((HAT_ITEMS.includes(k) || PET_ITEMS.includes(k)) && this.basket[k]) return;
        this.basket[k] = (this.basket[k] || 0) + 1; this.app.sfx('beep'); this.chip(); draw();
      });
    };
    $('#shopGo').onclick = () => { if (cafe) { $('#shopBox').classList.add('hidden'); this.checkout(); } else this.close(); };
    draw(); $('#shopBox').classList.remove('hidden');
  }
  owned(k) { return (HAT_ITEMS.includes(k) || PET_ITEMS.includes(k)) && this.inv[k] > 0; }
  openBasket() {
    const t = this.app.t, items = Object.keys(this.basket);
    if (!items.length) return;
    this.lock(true); $('#shopTitle').textContent = t('basket');
    const draw = () => {
      const ks = Object.keys(this.basket);
      $('#shopList').innerHTML = ks.map(k => `<button class="item" data-k="${k}"><span class="ic">${ICON[k]}</span><span>${t('it_' + k)} × ${this.basket[k]}</span><b>${money(PRICES[k] * this.basket[k])}</b><small>− ${t('remove')}</small></button>`).join('') || `<p class="muted">${t('basketEmpty')}</p>`;
      $('#shopBasket').textContent = `${t('total')}: ${money(this.total())}`;
      $('#shopGo').textContent = t('payAtCheckout'); $('#shopGo').disabled = false;
      document.querySelectorAll('#shopList .item').forEach(b => b.onclick = () => { const k = b.dataset.k; if (--this.basket[k] <= 0) delete this.basket[k]; this.chip(); draw(); });
    };
    $('#shopGo').onclick = () => this.close();
    draw(); $('#shopBox').classList.remove('hidden');
  }

  // the checkout: receipt + press and hold your hand on the scanner
  checkout() {
    const t = this.app.t, bank = this.app.bank || {};
    if (!this.count()) { this.app.ui.banner(t('basketEmpty'), 2200); return; }
    this.lock(true); this.app.sfx('click'); this.paying = false;
    $('#payLines').innerHTML = Object.entries(this.basket).map(([k, n]) => `<div><span>${ICON[k]} ${t('it_' + k)} × ${n}</span><b>${money(PRICES[k] * n)}</b></div>`).join('');
    $('#payTotal').textContent = money(this.total()); $('#payBal').textContent = money(this.app.money);
    $('#palm').className = 'palm hidden'; $('#payPhone').classList.add('hidden'); $('#payMsg').textContent = '';
    const noCard = !bank.card;
    $('#payNeed').classList.toggle('hidden', !noCard); $('#payTabs').classList.toggle('hidden', noCard);
    if (noCard) $('#payNeed').innerHTML = `<b>🏦 ${t('needCard')}</b><span>${t('needCardHow')}</span>`;
    else this.method(bank.hand ? 'hand' : 'phone');
    $('#payBox').classList.remove('hidden');
  }
  palm() {
    const P = $('#palm'), arc = () => $('#palmArc');
    let t0 = 0, raf = 0;
    const stop = ok => { cancelAnimationFrame(raf); this.scanning = false; P.classList.remove('scanning'); if (!ok) { arc().style.strokeDashoffset = 100; if (!P.classList.contains('done')) $('#payMsg').textContent = this.app.t('holdHand'); } };
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0) / 1600); arc().style.strokeDashoffset = 100 - k * 100;
      if (k >= 1) { stop(true); this.pay(); return; }
      raf = requestAnimationFrame(tick);
    };
    P.addEventListener('pointerdown', e => {
      e.preventDefault(); if (this.scanning || P.classList.contains('done') || P.classList.contains('paying')) return;
      try { P.setPointerCapture(e.pointerId); } catch (er) {}
      this.scanning = true; t0 = performance.now(); P.classList.add('scanning'); P.classList.remove('fail');
      $('#payMsg').textContent = this.app.t('scanning'); this.app.sfx('scan'); tick();
    });
    const up = () => { if (this.scanning) stop(false); };
    P.addEventListener('pointerup', up); P.addEventListener('pointercancel', up); P.addEventListener('pointerleave', up);
  }
  async pay() {
    const t = this.app.t, P = $('#palm'), items = Object.entries(this.basket).map(([item, qty]) => ({ item, qty }));
    if (this.paying) return; this.paying = true;
    P.classList.add('paying'); $('#phonePay').disabled = true; $('#payMsg').textContent = t('processing');
    try {
      const bal = await this.app.net.buy(items);
      const served = items.filter(i => DRINKS.includes(i.item));
      this.app.setMoney(bal); this.basket = {}; this.chip(); await this.loadInv();
      P.classList.remove('paying'); P.classList.add('done'); $('#phonePay').disabled = false; this.paying = false;
      this.app.logPay && this.app.logPay(items, this.m);
      $('#payMsg').textContent = `✓ ${t('approved')} · ${t('balance')} ${money(bal)}`; $('#payMsg').className = 'mpay-msg ok';
      $('#payBal').textContent = money(bal); this.app.sfx('paid');
      const hasWear = items.some(i => HAT_ITEMS.includes(i.item) || PET_ITEMS.includes(i.item));
      setTimeout(async () => {
        this.close();
        if (served.length) { for (const i of served) for (let k = 0; k < i.qty; k++) await this.app.net.use(i.item).catch(() => {}); await this.loadInv(); this.app.useItem(served[0].item); }
        else this.app.ui.banner(hasWear ? t('boughtWear') : t('boughtFood'), 3200);
      }, 1500);
    } catch (e) {
      P.classList.remove('paying'); P.classList.add('fail'); this.app.sfx('wrong'); $('#phonePay').disabled = false; this.paying = false;
      $('#payMsg').textContent = /money/i.test(e.message || '') ? t('notEnough') : t('payFailed'); $('#payMsg').className = 'mpay-msg bad';
      arc().style.strokeDashoffset = 100;
    }
    function arc() { return document.querySelector('#palmArc'); }
  }

  async loadInv() { this.inv = await this.app.net.inventory().catch(() => this.inv) || {}; return this.inv; }

  // your bag: eat food, play with toys, wear hats, walk pets
  async openBag() {
    const t = this.app.t; this.lock(true);
    await this.loadInv();
    const draw = () => {
      $('#bagMoney').textContent = `mPAY · ${money(this.app.money)}`;
      const ks = Object.keys(this.inv);
      const cfg = this.app.me.avatar || {};
      $('#bagList').innerHTML = ks.map(k => {
        const wear = HAT_ITEMS.includes(k), pet = PET_ITEMS.includes(k), on = (wear && cfg.hat === k) || (pet && cfg.pet === k);
        const act = wear ? (on ? t('takeOff') : t('wear')) : pet ? (on ? t('sendHome') : t('walkPet')) : FOOD.includes(k) ? t('eat') : t('play');
        return `<button class="item${on ? ' on' : ''}" data-k="${k}"><span class="ic">${ICON[k]}</span><span>${t('it_' + k)}${wear || pet ? '' : ' × ' + this.inv[k]}</span><small>${act}</small></button>`;
      }).join('') || `<p class="muted">${t('bagEmpty')}</p>`;
      document.querySelectorAll('#bagList .item').forEach(b => b.onclick = async () => {
        const k = b.dataset.k;
        if (HAT_ITEMS.includes(k) || PET_ITEMS.includes(k)) {
          const key = HAT_ITEMS.includes(k) ? 'hat' : 'pet', a = { ...(this.app.me.avatar || {}) }; a[key] = a[key] === k ? 'none' : k;
          await this.app.setAvatar(a); this.app.sfx('star'); draw(); return;
        }
        const left = await this.app.net.use(k).catch(() => -1);
        if (left < 0) return;
        if (left === 0) delete this.inv[k]; else this.inv[k] = left;
        this.close(); this.app.useItem(k);
      });
    };
    draw(); $('#bagBox').classList.remove('hidden');
  }
}
