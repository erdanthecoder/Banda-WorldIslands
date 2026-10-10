// World Islands 2.0 — everything that is new, shown once after an update (and from Menu → What's new).
export const VERSION = '2.0';
const NEW = [
  ['🛍️', 'The Pentagon Mall is now the biggest building on the island, full of 100+ shoppers! 8 shops: café, supermarket, toys, hats & fashion, pet shop, sweets, pizza & burgers and Kyrgyz kitchen, plus a food court.', 'Пентагон Молл теперь самое большое здание на острове, и в нём больше 100 покупателей! 8 магазинов: кафе, супермаркет, игрушки, шляпы и мода, зоомагазин, сладости, пицца и бургеры, кыргызская кухня и фуд-корт.'],
  ['🚧', 'Fences fixed: no more gaps, and you can no longer slip through them, even on a hoverboard.', 'Заборы исправлены: без дыр, и сквозь них больше не пройти, даже на ховерборде.'],
  ['📲', 'World Islands apps: download for Windows and Android right from the website (Menu → Apps).', 'Приложения World Islands: скачай для Windows и Android прямо с сайта (Меню → Приложения).'],
  ['▶️', 'New start screen with Play, How to play (controls, money, places, phone) and quick settings. Find How to play in the menu too.', 'Новый стартовый экран: Играть, Как играть (управление, деньги, места, телефон) и быстрые настройки. «Как играть» есть и в меню.'],
  ['🛍️', 'Pentagon Mall: a five-sided mall with a supermarket, Pentagon Café, toys & fashion, sweets & ice cream and a Job Center. New job: Barista!', 'Пентагон Молл: пятиугольный торговый центр с супермаркетом, Кафе Пентагон, игрушками и модой, сладостями и Центром занятости. Новая работа: Бариста!'],
  ['⚡', 'Smoother and faster: the island is drawn in far fewer pieces, far labels hide, and soft shadows under everyone on phones.', 'Плавнее и быстрее: остров рисуется гораздо меньшим числом частей, дальние надписи скрываются, на телефонах — мягкие тени под всеми.'],
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
  let seen = ''; try { seen = localStorage.getItem('wi_seen_v2') || ''; } catch (e) {}
  if (!force && seen === VERSION) return;
  try { localStorage.setItem('wi_seen_v2', VERSION); } catch (e) {}
  const ru = app.t('loading') && /[а-я]/i.test(app.t('letsGo')), $ = s => document.querySelector(s);
  let box = $('#newBox');
  if (!box) { box = document.createElement('div'); box.id = 'newBox'; box.className = 'modal'; document.body.appendChild(box); }
  box.innerHTML = `<div class="sheet small new-sheet"><div class="new-head"><img src="/img/logo-192.png" alt=""><div><b>World Islands <span class="v2">2.0</span></b><small>${app.t('whatsNew')}</small></div></div>
    <ul class="new-list">${NEW.map(([i, en, r]) => `<li><span>${i}</span>${ru ? r : en}</li>`).join('')}</ul>
    <div class="row"><button class="btn primary big" id="newGo">${app.t('letsGo')}</button></div></div>`;
  box.classList.remove('hidden'); app.world.inputLocked = true;
  $('#newGo').onclick = () => { box.classList.add('hidden'); app.world.inputLocked = false; app.sfx('chime'); app.world.fireworks(4); };
}
