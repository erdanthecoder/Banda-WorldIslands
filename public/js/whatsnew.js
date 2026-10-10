// World Islands 2.0 — everything that is new, shown once after an update (and from Menu → What's new).
export const VERSION = '2.0';
const NEW = [
  ['🎪', 'Up to 3 admin shows at the same time, plus 2 new shows: 👽 UFO invasion (its beam lifts you!) and 🫧 Foam party on the stadium.', 'До 3 шоу одновременно и 2 новых шоу: 👽 Нашествие НЛО (луч поднимает тебя!) и 🫧 Пенная вечеринка на стадионе.'],
  ['🌪️', 'More admin fun: tornado, earthquake, chicken rain, bubbles, rainbow, everyone tiny, freeze, shuffle and a MEGA party button.', 'Больше веселья у админа: торнадо, землетрясение, дождь из кур, пузыри, радуга, все маленькие, заморозка, перемешка и МЕГА-вечеринка.'],
  ['💻', 'World Islands for Windows — a safe app for your computer (Menu → Windows app).', 'World Islands для Windows — безопасное приложение для компьютера (Меню → Приложение для Windows).'],
  ['🎣', 'Fishing pier on the east beach and the Fisher job. Can you catch the shark?', 'Рыбацкий пирс на восточном пляже и работа Рыбак. Поймаешь акулу?'],
  ['🛹', 'Hoverboard and new emotes: backflip, floss, laugh, spin, sleep.', 'Ховерборд и новые эмоции: сальто, флосс, смех, кружиться, спать.'],
  ['🙂', 'Mood camera: your avatar copies your face, with a big emoji over your head.', 'Камера настроения: аватар повторяет твоё лицо, над головой — большой смайлик.'],
  ['🎬', 'Cinema: funny cartoons about Barsik the cat, in Russian.', 'Кинотеатр: смешные мультики про кота Барсика.'],
  ['🏀', 'Basketball 3 vs 3 with bots, and bots play on the court by themselves.', 'Баскетбол 3 на 3 с ботами, и боты играют на площадке сами.'],
  ['🍽️', 'Island Restaurant: sit down, order plov or lagman, the waiter brings it.', 'Ресторан Island: садись, заказывай плов или лагман — официант принесёт.'],
  ['💼', 'Jobs on your phone: cashier, cleaner, helper, waiter, fisher — real money.', 'Работа в телефоне: кассир, уборщик, помощник, официант, рыбак — настоящие деньги.'],
  ['🤖', 'Smart bots: they ride lifts, visit places, dance at shows and can take you anywhere (press 💬).', 'Умные боты: ездят на лифтах, ходят по местам, танцуют на шоу и отведут тебя куда угодно (жми 💬).'],
  ['⚽', 'Better football: team shirts, coloured goals, own goals, kick-off.', 'Футбол лучше: формы команд, цветные ворота, автоголы, разыгрывание с центра.'],
  ['🏢', 'Round World Tower, mBank with card, phone and hand pay, phone calls and messages, better hotel.', 'Круглая Башня Мира, mBank с картой, оплатой телефоном и рукой, звонки и сообщения, отель лучше.'],
  ['📱', 'Faster on phones.', 'Быстрее на телефонах.'],
];
export function whatsNew(app, force) {
  let seen = ''; try { seen = localStorage.getItem('wi_seen_version') || ''; } catch (e) {}
  if (!force && seen === VERSION) return;
  try { localStorage.setItem('wi_seen_version', VERSION); } catch (e) {}
  const ru = app.t('loading') && /[а-я]/i.test(app.t('letsGo')), $ = s => document.querySelector(s);
  let box = $('#newBox');
  if (!box) { box = document.createElement('div'); box.id = 'newBox'; box.className = 'modal'; document.body.appendChild(box); }
  box.innerHTML = `<div class="sheet small new-sheet"><div class="new-head"><img src="/img/logo-192.png" alt=""><div><b>World Islands <span class="v2">2.0</span></b><small>${app.t('whatsNew')}</small></div></div>
    <ul class="new-list">${NEW.map(([i, en, r]) => `<li><span>${i}</span>${ru ? r : en}</li>`).join('')}</ul>
    <div class="row"><button class="btn primary big" id="newGo">${app.t('letsGo')}</button></div></div>`;
  box.classList.remove('hidden'); app.world.inputLocked = true;
  $('#newGo').onclick = () => { box.classList.add('hidden'); app.world.inputLocked = false; app.sfx('chime'); app.world.fireworks(4); };
}
