// Banda Cinema: short funny cartoons. No words on screen — the characters speak Russian.
const EP = [];
const ease = k => k < 0 ? 0 : k > 1 ? 1 : k * k * (3 - 2 * k);
const sky = (g, W, H, a = '#7ec8ff', b = '#e6f7ff') => { const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, W, H); };
const ground = (g, W, H, c = '#6cc46a') => { g.fillStyle = c; g.fillRect(0, H * 0.78, W, H * 0.22); };
const emo = (g, e, x, y, size, rot = 0, sx = 1) => { g.save(); g.translate(x, y); g.rotate(rot); g.scale(sx, 1); g.font = `${size}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(e, 0, 0); g.restore(); };
const kitchen = (g, W, H) => { sky(g, W, H, '#ffe9c7', '#fff6e8'); g.fillStyle = '#c99a6b'; g.fillRect(0, H * 0.72, W, H * 0.28); for (let i = 0; i < W; i += 40) { g.fillStyle = i / 40 % 2 ? '#f4f4f4' : '#dfe7ef'; g.fillRect(i, 0, 40, 40); } };

// 1. The cat and the cucumber
EP.push({ dur: 12, lines: [[0.5, 'Какой чудесный день. Сейчас покушаю рыбку.'], [4.6, 'Ой! Что это?! Зелёный монстр!'], [8.5, 'Ах, это просто огурец... Я совсем не испугался. Честно!']],
  draw(g, t, W, H) {
    kitchen(g, W, H);
    emo(g, '🐟', W * 0.55, H * 0.66, 34);
    const jump = t > 4.2 && t < 7 ? Math.sin((t - 4.2) / 2.8 * Math.PI) : 0;
    emo(g, t > 4.2 && t < 8 ? '🙀' : '🐱', W * 0.4 - jump * 30, H * 0.62 - jump * H * 0.45, 80, jump * 0.6);
    const cx = t < 3.6 ? W + 60 : W * 0.48 - Math.min(0, 0);
    if (t > 3.6) emo(g, '🥒', Math.max(W * 0.5, W + 60 - (t - 3.6) * 400), H * 0.7, 46, 0.3);
    if (t > 8) emo(g, '😅', W * 0.82, H * 0.25, 30);
  } });
// 2. Dog chef and the flying pancake
EP.push({ dur: 12, lines: [[0.5, 'Здравствуйте! Я шеф-повар Шарик. Сейчас я подброшу идеальный блин!'], [5.2, 'Раз, два... Опа!'], [8.6, 'Блин! Он прилип к потолку. Ну что ж... это блин на завтра.']],
  draw(g, t, W, H) {
    kitchen(g, W, H);
    emo(g, '🐶', W * 0.42, H * 0.6, 84); emo(g, '👨‍🍳', W * 0.42, H * 0.33, 36);
    g.fillStyle = '#333'; g.fillRect(W * 0.5, H * 0.66, 80, 10); // pan
    let py = H * 0.62, px = W * 0.5 + 40;
    if (t > 5.6 && t < 7) { const k = (t - 5.6) / 1.4; py = H * 0.62 - ease(k) * H * 0.6; px += k * 30; }
    else if (t >= 7) { py = H * 0.03; px += 30; }
    g.fillStyle = '#f2c26b'; g.beginPath(); g.ellipse(px, py, 36, t >= 7 ? 8 : 12, 0, 0, 7); g.fill();
    if (t > 7.4) emo(g, '😳', W * 0.42, H * 0.6, 40);
  } });
// 3. Penguin figure skater
EP.push({ dur: 12, lines: [[0.4, 'Дамы и господа! Великий фигурист Пингвин Пётр!'], [4.4, 'Сейчас будет тройной прыжок... Ай!'], [8.2, 'Всё по плану. Это был специальный приём. Называется — бух!']],
  draw(g, t, W, H) {
    sky(g, W, H, '#9fd8ff', '#ffffff'); g.fillStyle = '#d9f1ff'; g.fillRect(0, H * 0.7, W, H * 0.3);
    for (let i = 0; i < 8; i++) emo(g, '❄️', (i * 97 + t * 30) % W, (i * 53 + t * 40) % (H * 0.6), 18);
    const x = W * 0.2 + ((t * 120) % (W * 0.6)), fall = t > 4.8 && t < 8;
    const spin = t > 4 && t < 4.8 ? (t - 4) * 20 : 0;
    emo(g, '🐧', x, H * 0.62 - (t > 4 && t < 4.8 ? Math.sin((t - 4) / 0.8 * Math.PI) * 60 : 0), 76, fall ? Math.PI / 2 : 0, spin ? Math.cos(spin) : 1);
    if (fall) emo(g, '💫', x, H * 0.45, 30);
    if (t > 8) emo(g, '👏', W * 0.85, H * 0.3, 34);
  } });
// 4. Super Banana
EP.push({ dur: 12, lines: [[0.4, 'Не бойтесь! Я — Супер-Банан! Я спасу всех от скуки!'], [5, 'Лечу на помощь! Ура-а-а!'], [8.4, 'Ой... Я поскользнулся на собственной кожуре. Супергерои тоже падают!']],
  draw(g, t, W, H) {
    sky(g, W, H, '#5aa8ff', '#cfeaff'); ground(g, W, H);
    for (let i = 0; i < 3; i++) emo(g, '☁️', (i * 200 - t * 25 + 600) % (W + 100) - 50, 40 + i * 30, 44);
    let x = W * 0.3, y = H * 0.62, r = 0;
    if (t > 4.6 && t < 8) { const k = (t - 4.6) / 3.4; x = W * 0.3 + k * W * 0.45; y = H * 0.62 - Math.sin(k * Math.PI) * H * 0.45; r = -0.6; }
    if (t >= 8) { x = W * 0.75; y = H * 0.7; r = Math.min(Math.PI / 2, (t - 8) * 4); }
    emo(g, '🍌', x, y, 80, r); if (t < 8) emo(g, '🦸', x - 6, y - 50, 30);
    if (t > 7.6) emo(g, '🍌', W * 0.68, H * 0.82, 26, 1.2);
    if (t > 8.3) emo(g, '⭐', x + 30, y - 40, 26);
  } });
// 5. The robot at school
EP.push({ dur: 12, lines: [[0.5, 'Робот, скажи нам: сколько будет два плюс два?'], [3.8, 'Вычисляю... Пип-пип... Пять!'], [7, 'Нет, робот, четыре!'], [9, 'Ошибка! Перезагрузка... Пип... Привет! Я снова умный!']],
  draw(g, t, W, H) {
    g.fillStyle = '#1f4d3a'; g.fillRect(0, 0, W, H); g.fillStyle = '#2f6b52'; g.fillRect(20, 20, W - 40, H * 0.55);
    g.strokeStyle = '#fff'; g.lineWidth = 4; g.beginPath(); g.moveTo(W * 0.3, 70); g.lineTo(W * 0.3, 110); g.moveTo(W * 0.27, 90); g.lineTo(W * 0.33, 90); g.stroke(); // a plus sign only
    g.fillStyle = '#c99a6b'; g.fillRect(0, H * 0.8, W, H * 0.2);
    emo(g, '👩‍🏫', W * 0.18, H * 0.66, 70);
    const shake = t > 7.4 && t < 9 ? Math.sin(t * 60) * 6 : 0;
    emo(g, '🤖', W * 0.7 + shake, H * 0.64, 84);
    if (t > 7.4 && t < 9) emo(g, '💥', W * 0.7, H * 0.38, 40);
    if (t > 9.4) emo(g, '😎', W * 0.78, H * 0.4, 30);
    for (let i = 0; i < 3; i++) if (t > 3.6 && t < 7) emo(g, '⚙️', W * 0.7 + Math.cos(t * 4 + i * 2) * 50, H * 0.4 + Math.sin(t * 4 + i * 2) * 20, 20);
  } });

// A player bound to a canvas texture; speaks lines with the Russian voice only while you're watching.
export class CinemaShow {
  constructor(canvas, say, sfx) { this.cv = canvas; this.g = canvas.getContext('2d'); this.say = say; this.sfx = sfx; this.i = 0; this.t = 0; this.spoken = new Set(); }
  update(dt, watching) {
    const ep = EP[this.i], W = this.cv.width, H = this.cv.height;
    this.t += dt;
    if (this.t > ep.dur) { this.i = (this.i + 1) % EP.length; this.t = 0; this.spoken.clear(); if (watching) this.sfx('chime'); return true; }
    if (watching) ep.lines.forEach(([at, text], k) => { if (this.t >= at && !this.spoken.has(k)) { this.spoken.add(k); this.say(text, 'ru'); } });
    else ep.lines.forEach(([at], k) => { if (this.t >= at) this.spoken.add(k); });
    if (!watching) return false;
    ep.draw(this.g, this.t, W, H);
    // a soft vignette, like a cinema projector
    const vg = this.g.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.7); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.45)'); this.g.fillStyle = vg; this.g.fillRect(0, 0, W, H);
    return true;
  }
}
