// 🎮 The Marbly menu (like Roblox): every experience with how many people are playing right now,
// the players in your server, and settings. Used on the home screen, in World Island and in every game.
import { getLang, setLang } from './i18n.js';
import { setMuted, isMuted, sfx } from './audio.js';
import { CONFIG } from './config.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const X = (en, ru) => (getLang() === 'ru' ? ru : en);

export const EXPERIENCES = [
  { id: 'world', icon: '🏝️', name: 'World Island', en: 'Tower, mall, hotel, jobs, minigames', ru: 'Башня, молл, отель, работа, мини-игры', bg: 'linear-gradient(135deg,#1e8fd8,#22c1a0)', href: '/', servers: CONFIG.servers.map(s => s.id) },
  { id: 'race', icon: '🏁', name: 'Island Raceway', en: 'Race with turbos, stars, bananas and a jump ramp', ru: 'Гонки с турбо, звёздами, бананами и трамплином', bg: 'linear-gradient(135deg,#e71d36,#ff9f1c)', href: '/race.html', servers: ['race-1'] },
  { id: 'hq', icon: '🏦', name: 'mBank HQ', en: 'Gold Vault Climb, coin hunt, your 7-digit card', ru: 'Восхождение к сейфу, охота за монетами, карта', bg: 'linear-gradient(135deg,#1e5bd8,#6a2bd8)', href: '/hq.html', servers: ['hq-1'] },
  { id: 'craft', icon: '⛏️', name: 'Marbly Craft', en: 'Mine, craft and build together. TNT!', ru: 'Добывай, крафти и строй вместе. TNT!', bg: 'linear-gradient(135deg,#4f7f35,#8a6d1f)', href: '/craft.html', servers: ['craft-1'] },
  { id: 'obby', icon: '🧗', name: 'Mega Obby', en: '30+ stages of lava, spinners and jumps', ru: '30+ этапов: лава, вертушки, прыжки', bg: 'linear-gradient(135deg,#ff3d77,#ffb020)', href: '/obby.html', servers: ['obby-1'] },
  { id: 'party', icon: '🎉', name: 'Party Royale', en: 'Minigame party: last one standing wins', ru: 'Мини-игры: побеждает последний', bg: 'linear-gradient(135deg,#7b2cbf,#22c1a0)', href: '/party.html', servers: ['party-1'] },
  { id: 'tycoon', icon: '🍦', name: 'Ice Cream Tycoon', en: 'Build your own ice cream empire', ru: 'Построй империю мороженого', bg: 'linear-gradient(135deg,#ff6fa8,#6ff3ff)', href: '/tycoon.html', servers: ['tycoon-1'] },
  { id: 'school', icon: '📚', name: 'Quiz Day', en: 'iPad quiz, power-ups, paper fights. Lose = push-ups!', ru: 'Викторина, бонусы, бумажный бой. Проиграл — отжимайся!', bg: 'linear-gradient(135deg,#46178f,#d82b8c)', href: '/school.html', servers: ['school-1'] },
];
export const playing = (lobby, e) => e.servers.reduce((n, s) => n + ((lobby || {})[s] || 0), 0);

// settings saved in this browser
export const settings = {
  get sens() { try { return +(localStorage.getItem('marbly_sens') || 1); } catch (e) { return 1; } },
  set sens(v) { try { localStorage.setItem('marbly_sens', v); } catch (e) {} },
  get quality() { try { return localStorage.getItem('banda_quality') || (matchMedia('(pointer: coarse)').matches ? 'low' : 'high'); } catch (e) { return 'high'; } },
};
try { if (localStorage.getItem('marbly_muted') === '1') setMuted(true); } catch (e) {}

// opts: { here, lobby(), players(), onWorld(), onAvatar(), world }
export function openMenu(opts, tab = 'exp') {
  let el = $('#mbMenu');
  if (!el) { el = document.createElement('div'); el.id = 'mbMenu'; el.className = 'mbm'; document.body.appendChild(el); }
  const tabs = [['exp', '🎮', X('Experiences', 'Игры')], ['ppl', '👥', X('Players', 'Игроки')], ['set', '⚙️', X('Settings', 'Настройки')]];
  const draw = () => {
    const lobby = opts.lobby ? opts.lobby() : {}, total = Object.values(lobby).reduce((a, b) => a + b, 0);
    let body = '';
    if (tab === 'exp') body = `<p class="mbm-sub">🟢 ${total} ${X('playing in Marbly now', 'сейчас играют в Marbly')}</p><div class="mbm-exps">${EXPERIENCES.map(e => `<button class="mbm-exp${e.id === opts.here ? ' here' : ''}" data-x="${e.id}" style="--bg:${e.bg}"><span class="ic">${e.icon}</span><div><b>${e.name}</b><small>${X(e.en, e.ru)}</small></div><em>👥 ${playing(lobby, e)}</em><i>${e.id === opts.here ? X('You are here', 'Ты здесь') : '▶ ' + X('Play', 'Играть')}</i></button>`).join('')}</div>`;
    if (tab === 'ppl') { const ps = opts.players ? opts.players() : []; body = `<p class="mbm-sub">${ps.length} ${X('in your server', 'на твоём сервере')}</p><div class="mbm-ppl">${ps.map(p => `<div><span class="av" style="background:${p.color || '#3a86ff'}">${esc((p.name || '?')[0])}</span><b>${esc(p.name)}</b>${p.me ? `<small>${X('you', 'ты')}</small>` : ''}${p.role === 'teacher' ? '<small>👩‍🏫</small>' : ''}</div>`).join('')}</div>`; }
    if (tab === 'set') {
      const q = settings.quality;
      body = `<div class="mbm-set">
        <label>🖥️ ${X('Graphics', 'Графика')}<span class="seg"><button data-q="high" class="${q === 'high' ? 'on' : ''}">${X('Beautiful', 'Красиво')}</button><button data-q="low" class="${q === 'low' ? 'on' : ''}">${X('Fast', 'Быстро')}</button></span></label>
        <label>🔊 ${X('Sound', 'Звук')}<span class="seg"><button data-s="1" class="${!isMuted() ? 'on' : ''}">${X('On', 'Вкл')}</button><button data-s="0" class="${isMuted() ? 'on' : ''}">${X('Off', 'Выкл')}</button></span></label>
        <label>🌐 ${X('Language', 'Язык')}<span class="seg"><button data-l="en" class="${getLang() === 'en' ? 'on' : ''}">English</button><button data-l="ru" class="${getLang() === 'ru' ? 'on' : ''}">Русский</button></span></label>
        <label>🖱️ ${X('Camera sensitivity', 'Чувствительность камеры')}<input type="range" id="mbSens" min="0.4" max="2.2" step="0.1" value="${settings.sens}"></label>
        <label>⛶ ${X('Full screen', 'Полный экран')}<span class="seg"><button id="mbFull">${document.fullscreenElement ? X('Exit', 'Выйти') : X('Go full screen', 'Включить')}</button></span></label>
        ${opts.onAvatar ? `<label>👕 ${X('Avatar', 'Аватар')}<span class="seg"><button id="mbAv">${X('Change my avatar', 'Изменить аватар')}</button></span></label>` : ''}
      </div>`;
    }
    el.innerHTML = `<div class="mbm-box"><div class="mbm-head"><b class="mbm-logo">Marbly</b><nav>${tabs.map(([k, i, n]) => `<button data-t="${k}" class="${k === tab ? 'on' : ''}">${i} <span>${n}</span></button>`).join('')}</nav><button class="mbm-x" id="mbX">✕</button></div><div class="mbm-body">${body}</div>
      ${opts.here && opts.here !== 'home' ? `<div class="mbm-foot"><button id="mbHome">🏠 ${X('Marbly home', 'Главная Marbly')}</button><button id="mbResume" class="go">▶ ${X('Resume', 'Продолжить')}</button></div>` : ''}</div>`;
    el.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { tab = b.dataset.t; sfx('click'); draw(); });
    el.querySelectorAll('[data-x]').forEach(b => b.onclick = () => {
      const e = EXPERIENCES.find(x => x.id === b.dataset.x); if (e.id === opts.here) return close();
      sfx('chime'); if (e.id === 'world' && opts.onWorld) { close(); opts.onWorld(); } else location.href = e.href;
    });
    el.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { try { localStorage.setItem('banda_quality', b.dataset.q); } catch (e) {} location.reload(); });
    el.querySelectorAll('[data-s]').forEach(b => b.onclick = () => { const m = b.dataset.s === '0'; setMuted(m); try { localStorage.setItem('marbly_muted', m ? '1' : '0'); } catch (e) {} draw(); opts.onSound && opts.onSound(); });
    el.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { setLang(b.dataset.l); location.reload(); });
    const sens = el.querySelector('#mbSens'); if (sens) sens.oninput = () => { settings.sens = +sens.value; if (opts.world) opts.world.sens = +sens.value; };
    const fs = el.querySelector('#mbFull'); if (fs) fs.onclick = () => { (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {}); setTimeout(draw, 300); };
    const av = el.querySelector('#mbAv'); if (av) av.onclick = () => { close(); opts.onAvatar(); };
    $('#mbX').onclick = close;
    const home = el.querySelector('#mbHome'); if (home) home.onclick = () => { location.href = '/'; };
    const res = el.querySelector('#mbResume'); if (res) res.onclick = close;
  };
  const close = () => { el.classList.add('hidden'); clearInterval(el._t); if (opts.world) opts.world.inputLocked = false; };
  el.classList.remove('hidden'); if (opts.world) { opts.world.inputLocked = true; opts.world.keys = {}; }
  draw(); clearInterval(el._t); el._t = setInterval(() => { if (tab !== 'set') draw(); }, 2500);
  return { close };
}
