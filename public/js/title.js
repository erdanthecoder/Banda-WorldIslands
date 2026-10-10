// The start screen: the live island slowly flying by behind the World Islands logo, a big Play button,
// How to play, and quick settings (language, graphics, sound). Shown every time the game starts.
import * as THREE from 'three';
import { isV2 } from './launch.js';

const $ = s => document.querySelector(s);
const HOW = {
  en: [
    ['🎮', 'Move', ['<b>Keyboard:</b> W A S D or arrows to walk · <b>Shift</b> run · <b>Space</b> jump', '<b>Mouse:</b> drag to look around · scroll to zoom', '<b>Phone/tablet:</b> joystick on the left, buttons on the right', '<b>1–9</b> emotes (dance, backflip, floss…) · <b>F11</b> full screen in the app']],
    ['💰', 'Earn money', ['Play <b>learning games</b> on World Tower floors 3 and 8 (math, English, Russian, science…)', 'Take a <b>job</b>: 📱 Phone → 💼 Jobs — barista, waiter, cashier, fisher, helper, cleaner', 'Get a free <b>mBank card</b> at mBank, then pay with your phone or your hand ✋']],
    ['🗺️', 'Places', ['🏢 <b>World Tower</b> (north): lifts, hotel, cinema, pool, arcade, games', '🛍️ <b>Pentagon Mall</b> & 🛒 <b>World Market</b> (west) · 🏦 <b>mBank</b>', '🍽️ <b>Restaurant</b> (east) · ☕ <b>Island Coffee</b> · 🎣 <b>Fishing pier</b> (east beach)', '⚽ <b>Stadium</b> & 🏀 <b>Basketball</b> (south) · 🎠 <b>Playground</b>']],
    ['📱', 'Your phone', ['📞 Call and 💬 message friends by their +0 number', '🙂 <b>Mood</b>: the camera copies your face onto your avatar (no video is sent)', '🙋 <b>Help</b>: ask for help · 💼 <b>Jobs</b> · 🏦 <b>mBank</b> app']],
    ['🤝', 'Play together', ['Stand on a glowing <b>game pad</b> for 3 seconds to start a match for everyone', 'Walk up to a bot and press <b>💬 Talk</b> — it can take you anywhere', 'Be kind in chat 💛 Teachers can join, run quizzes and start events']],
  ],
  ru: [
    ['🎮', 'Управление', ['<b>Клавиатура:</b> W A S D или стрелки — идти · <b>Shift</b> бег · <b>Пробел</b> прыжок', '<b>Мышь:</b> тяни, чтобы смотреть · колёсико — приблизить', '<b>Телефон/планшет:</b> джойстик слева, кнопки справа', '<b>1–9</b> эмоции (танец, сальто, флосс…) · <b>F11</b> полный экран в приложении']],
    ['💰', 'Как заработать', ['Играй в <b>обучающие игры</b> на 3 и 8 этажах Башни Мира (математика, английский, русский, наука…)', 'Найди <b>работу</b>: 📱 Телефон → 💼 Работа — бариста, официант, кассир, рыбак, помощник, уборщик', 'Получи бесплатную <b>карту mBank</b> в mBank и плати телефоном или рукой ✋']],
    ['🗺️', 'Места', ['🏢 <b>Башня Мира</b> (север): лифты, отель, кино, бассейн, аркада, игры', '🛍️ <b>Пентагон Молл</b> и 🛒 <b>World Market</b> (запад) · 🏦 <b>mBank</b>', '🍽️ <b>Ресторан</b> (восток) · ☕ <b>Island Coffee</b> · 🎣 <b>Пирс</b> (восточный пляж)', '⚽ <b>Стадион</b> и 🏀 <b>Баскетбол</b> (юг) · 🎠 <b>Площадка</b>']],
    ['📱', 'Твой телефон', ['📞 Звони и 💬 пиши друзьям по номеру +0', '🙂 <b>Настроение</b>: камера повторяет твоё лицо на аватаре (видео не отправляется)', '🙋 <b>Помощь</b> · 💼 <b>Работа</b> · 🏦 приложение <b>mBank</b>']],
    ['🤝', 'Вместе', ['Постой 3 секунды на светящейся <b>площадке игры</b> — матч начнётся для всех', 'Подойди к боту и нажми <b>💬 Поговорить</b> — он отведёт куда нужно', 'Будь добрым в чате 💛 Учителя могут заходить, проводить квизы и события']],
  ],
};

export function howToHtml(lang) {
  const L = HOW[lang] || HOW.en;
  return `<div class="how">${L.map(([i, h, list]) => `<section><h3><span>${i}</span>${h}</h3><ul>${list.map(x => `<li>${x}</li>`).join('')}</ul></section>`).join('')}</div>`;
}

export function titleScreen(app, { lang, setLang, quality, toggleQuality, muted, toggleMute, onPlay }) {
  const w = app.world, t = app.t;
  let el = $('#title');
  if (!el) { el = document.createElement('div'); el.id = 'title'; document.body.appendChild(el); }
  const draw = () => {
    const v2 = isV2();
    el.innerHTML = `<div class="ttl-shade"></div>
      <div class="ttl-main">
        <img class="ttl-logo" src="/img/logo.png" alt="">
        <h1>World Islands${v2 ? ' <span class="v2">2.0</span>' : ''}</h1>
        <p class="ttl-sub">${t('titleSub')}</p>
        <button class="ttl-play" id="ttlPlay">▶ ${t('play')}</button>
        <div class="ttl-row">
          <button id="ttlHow">📖 ${t('howBtn')}</button>
          <button id="ttlLang">🌐 ${lang() === 'ru' ? 'Русский' : 'English'}</button>
          <button id="ttlGfx">🖥️ ${quality() ? t('qHigh') : t('qLow')}</button>
          <button id="ttlSnd">${muted() ? '🔇' : '🔊'}</button>
        </div>
        <p class="ttl-hello">👋 ${t('hello')}, <b>${(app.me.name || '').replace(/[<>&]/g, '')}</b> · ${app.server ? app.server.name : ''}</p>
      </div>
      <footer class="ttl-foot"><a href="/privacy.html" target="_blank" rel="noopener">${t('privacy')}</a> · <a href="https://flexihub.web.app/" target="_blank" rel="noopener">FlexiHub</a> · ${v2 ? 'v2.0' : 'v1'}</footer>
      <div class="ttl-how hidden" id="ttlHowBox"><div class="sheet"><div class="sheet-head"><h2>📖 ${t('howBtn')}</h2><button class="ibtn light" id="ttlHowX">✕</button></div>${howToHtml(lang())}<div class="row"><button class="btn primary big" id="ttlHowPlay">▶ ${t('play')}</button></div></div></div>`;
    $('#ttlPlay').onclick = play;
    $('#ttlHow').onclick = () => { app.sfx('click'); $('#ttlHowBox').classList.remove('hidden'); };
    $('#ttlHowX').onclick = () => $('#ttlHowBox').classList.add('hidden');
    $('#ttlHowPlay').onclick = play;
    $('#ttlLang').onclick = () => { setLang(); draw(); };
    $('#ttlGfx').onclick = () => toggleQuality();
    $('#ttlSnd').onclick = () => { toggleMute(); draw(); };
  };
  // the camera glides around the island while the title is showing
  let a = 0.6; const look = new THREE.Vector3(0, 12, -18);
  w.inputLocked = true;
  w.cameraOverride = (cam, dt) => { a += dt * 0.045; cam.position.set(Math.sin(a) * 95, 42 + Math.sin(a * 0.7) * 8, -18 + Math.cos(a) * 95); cam.lookAt(look); };
  function play() {
    app.sfx('chime'); el.classList.add('out');
    setTimeout(() => { el.remove(); }, 450);
    w.cameraOverride = null; w.inputLocked = false;
    onPlay && onPlay();
  }
  draw();
  setTimeout(() => $('#ttlPlay') && $('#ttlPlay').focus(), 50);
  const key = e => { if (!document.body.contains(el)) return removeEventListener('keydown', key); if (e.key === 'Enter' && $('#ttlHowBox').classList.contains('hidden')) { e.preventDefault(); play(); removeEventListener('keydown', key); } };
  addEventListener('keydown', key);
}
