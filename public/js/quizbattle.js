// Quiz Battle: everyone on the server answers the same questions live. Faster correct answers score more.
import { makeQuestion } from './games/learn.js';

const Q_MS = 15000, REVEAL_MS = 4500, TOTAL = 10;
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class QuizBattle {
  constructor(app, mgs) { this.app = app; this.mgs = mgs; this.pending = { subject: 'mixed', level: 2 }; }

  setup() {
    return { subject: this.pending.subject, level: this.pending.level, total: TOTAL, qIndex: -1, phase: 'wait', scores: {}, answers: {}, dur: 8 * 60000 };
  }
  name(id) { return this.mgs.nameOf(id); }

  enter() { this.box(); this.answered = -1; }
  box() {
    let el = document.getElementById('quizBox');
    if (!el) { el = document.createElement('div'); el.id = 'quizBox'; el.className = 'modal'; el.innerHTML = '<div class="sheet"><div id="qbBody"></div></div>'; document.body.appendChild(el); }
    return el.querySelector('#qbBody');
  }

  apply(mg) { this.render(mg); }

  render(mg) {
    const t = this.app.t, body = this.box(), pid = this.app.me.pid;
    const key = [mg.phase, mg.qIndex, this.answered === mg.qIndex].join('|');
    const left = Math.max(0, Math.ceil(((mg.qEnds || mg.start) - Date.now()) / 1000));
    if (body.dataset.key === key) { const tm = body.querySelector('.qb-time'); if (tm) tm.textContent = left + ' s'; return; }
    body.dataset.key = key;
    const subj = t('subj_' + mg.subject);
    if (mg.phase === 'wait') { body.innerHTML = `<h2>${t('mg_quiz')} · ${subj}</h2><p class="muted">${t('quizWait')}</p><p class="qb-time big-num">${left} s</p>`; return; }
    const q = mg.question;
    const top = `<div class="q-top"><span>${t('mg_quiz')} · ${subj}</span><span>${mg.qIndex + 1} / ${mg.total}</span><span class="qb-time">${left} s</span></div>`;
    if (mg.phase === 'question') {
      const done = this.answered === mg.qIndex;
      body.innerHTML = `${top}<div class="q-text">${q.html}</div>${done ? `<p class="center muted">${t('answerSent')}</p>` : `<div class="q-grid">${q.options.map((o, i) => `<button class="q-opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`}`;
      body.querySelectorAll('.q-opt').forEach(b => b.onclick = () => { this.answered = mg.qIndex; this.app.sfx('click'); this.app.net.emit('qb_answer', { q: mg.qIndex, i: +b.dataset.i }); this.render(this.mgs.mg); });
    } else {
      const mine = mg.answers[pid], right = mine && mine.ok;
      const rank = Object.entries(mg.scores).sort((a, b) => b[1] - a[1]).slice(0, 5);
      body.innerHTML = `${top}<div class="q-text">${q.html}</div><div class="q-grid">${q.options.map((o, i) => `<button class="q-opt ${i === q.answer ? 'ok' : mine && mine.i === i ? 'bad' : ''}" disabled>${esc(o)}</button>`).join('')}</div>
        <p class="center"><b>${mine ? (right ? '+' + mine.pts : t('wrong')) : t('noAnswer')}</b></p>
        <ol class="qb-rank">${rank.map(([id, s]) => `<li${id === pid ? ' class="me"' : ''}><span>${esc(this.name(id))}</span><b>${s}</b></li>`).join('')}</ol>`;
      if (!this.revealed || this.revealed !== mg.qIndex) { this.revealed = mg.qIndex; this.app.sfx(right ? 'correct' : 'wrong'); }
    }
  }

  tick(dt, mg) {
    this.render(mg);
    if (!this.mgs.isHost()) return;
    const now = Date.now();
    if (mg.phase === 'wait' && now > mg.start) return this.next(mg);
    if (mg.phase === 'question') {
      // bots answer after a few seconds, right about 60% of the time
      for (const id in mg.bots || {}) {
        if (mg.answers[id]) continue;
        const at = mg.qStart + 2500 + (id.charCodeAt(id.length - 1) * 977 + mg.qIndex * 1301) % 9000;
        if (now > at) { const right = Math.random() < 0.6, n = mg.question.options.length; this.event({ type: 'qb_answer', from: id, data: { q: mg.qIndex, i: right ? mg.question.answer : (mg.question.answer + 1 + Math.floor(Math.random() * (n - 1))) % n } }, mg); return; }
      }
      const players = [...this.mgs.ids(), ...Object.keys(mg.bots || {})];
      const all = players.every(id => mg.answers[id]);
      if (now > mg.qEnds || all) {
        const scores = { ...mg.scores };
        for (const [id, a] of Object.entries(mg.answers)) if (a.ok) scores[id] = (scores[id] || 0) + a.pts;
        this.mgs.sync({ ...mg, phase: 'reveal', scores, qEnds: now + REVEAL_MS });
      }
    } else if (mg.phase === 'reveal' && now > mg.qEnds) this.next(mg);
  }

  next(mg) {
    if (mg.qIndex + 1 >= mg.total) return this.mgs.end();
    const q = makeQuestion(mg.subject, mg.level, this.app.t);
    const answer = q.options.findIndex(o => String(o) === String(q.answer));
    this.mgs.sync({ ...mg, phase: 'question', qIndex: mg.qIndex + 1, question: { html: q.html, options: q.options.map(String), answer }, answers: {}, qEnds: Date.now() + Q_MS, qStart: Date.now() });
  }

  event(ev, mg) {
    if (ev.type !== 'qb_answer' || !this.mgs.isHost() || mg.phase !== 'question' || ev.data.q !== mg.qIndex || mg.answers[ev.from]) return;
    const ok = ev.data.i === mg.question.answer, frac = Math.max(0, (mg.qEnds - Date.now()) / Q_MS);
    this.mgs.sync({ ...mg, answers: { ...mg.answers, [ev.from]: { i: ev.data.i, ok, pts: ok ? 500 + Math.round(500 * frac) : 0 } } });
  }

  exit(mg, lines) {
    const el = document.getElementById('quizBox'); if (el) el.remove();
    const t = this.app.t, pid = this.app.me.pid;
    const rank = Object.entries(mg.scores || {}).sort((a, b) => b[1] - a[1]);
    rank.slice(0, 3).forEach(([id, s], i) => lines.push(`${i + 1}. ${this.name(id)} — ${s}`));
    const pos = rank.findIndex(([id]) => id === pid);
    if (pos >= 0) lines.push(`${t('yourPlace')}: ${pos + 1}`);
    return pos === 0 ? 8 : pos === 1 ? 6 : pos === 2 ? 4 : (mg.scores?.[pid] ? 2 : 0);
  }
}
