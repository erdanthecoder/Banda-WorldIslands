// All sound is synthesized with WebAudio — no audio files to download.
let ctx, master, musicGain, sfxGain, noiseBuf;
let muted = false;

function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
    musicGain = ctx.createGain(); musicGain.gain.value = 0.35; musicGain.connect(master);
    sfxGain = ctx.createGain(); sfxGain.gain.value = 0.7; sfxGain.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

function tone(freq, t, dur, { type = 'sine', vol = 0.3, out = sfxGain, slide = 0, attack = 0.005, cutoff = 0 } = {}) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; o.connect(f); node = f; }
  node.connect(g); g.connect(out);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise(t, dur, { vol = 0.3, type = 'highpass', freq = 6000, out = sfxGain, q = 1 } = {}) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(out);
  s.start(t, Math.random()); s.stop(t + dur + 0.05);
  return g;
}

const kick = (t, out) => tone(150, t, 0.25, { vol: 0.9, slide: 0.3, out });
const snare = (t, out) => { noise(t, 0.15, { vol: 0.4, type: 'bandpass', freq: 1800, out }); tone(200, t, 0.08, { vol: 0.2, type: 'triangle', out }); };
const hat = (t, out, v = 0.12) => noise(t, 0.04, { vol: v, out });

function crowd(t, dur, vol = 0.35) {
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = noiseBuf; s.loop = true; f.type = 'bandpass'; f.frequency.value = 1100; f.Q.value = 0.6;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.4);
  for (let i = 0.6; i < dur; i += 0.35) g.gain.linearRampToValueAtTime(vol * (0.6 + Math.random() * 0.5), t + i);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxGain); s.start(t); s.stop(t + dur + 0.1);
}

export function say(text, lang = 'en') {
  if (muted || !window.speechSynthesis) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang === 'ru' ? 'ru-RU' : 'en-US'; u.rate = 0.95; u.pitch = 1.1;
    speechSynthesis.speak(u);
  } catch (e) {}
}

const SFX = {
  click: t => tone(880, t, 0.06, { type: 'triangle', vol: 0.2 }),
  star: t => { tone(1318, t, 0.12, { type: 'triangle' }); tone(1760, t + 0.07, 0.2, { type: 'triangle' }); },
  correct: t => { tone(660, t, 0.1, { type: 'triangle' }); tone(990, t + 0.09, 0.2, { type: 'triangle' }); },
  wrong: t => tone(220, t, 0.3, { type: 'sawtooth', vol: 0.15, slide: 0.6, cutoff: 1200 }),
  jump: t => tone(300, t, 0.15, { type: 'square', vol: 0.08, slide: 2.2 }),
  flap: t => tone(500, t, 0.08, { type: 'square', vol: 0.07, slide: 1.6 }),
  hit: t => { noise(t, 0.2, { vol: 0.5, type: 'lowpass', freq: 900 }); tone(120, t, 0.2, { vol: 0.5, slide: 0.5 }); },
  kick: t => { tone(180, t, 0.1, { vol: 0.5, slide: 0.4 }); noise(t, 0.05, { vol: 0.2, type: 'lowpass', freq: 2000 }); },
  place: t => noise(t, 0.08, { vol: 0.3, type: 'lowpass', freq: 600 }),
  teleport: t => { tone(300, t, 0.6, { type: 'sine', vol: 0.25, slide: 4 }); tone(450, t + 0.05, 0.6, { type: 'triangle', vol: 0.12, slide: 3 }); },
  chime: t => [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.12, 0.6, { type: 'sine', vol: 0.25 })),
  whistle: t => {
    const o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain();
    o.frequency.value = 2400; l.frequency.value = 30; lg.gain.value = 120; l.connect(lg); lg.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
    g.gain.setValueAtTime(0.25, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    o.connect(g); g.connect(sfxGain); o.start(t); l.start(t); o.stop(t + 0.7); l.stop(t + 0.7);
  },
  goal: t => { crowd(t, 3, 0.5); [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.1, 0.5, { type: 'square', vol: 0.12, cutoff: 3000 })); },
  boing: t => { tone(180, t, 0.35, { type: 'sine', vol: 0.35, slide: 2.6 }); tone(360, t + 0.02, 0.25, { type: 'triangle', vol: 0.1, slide: 2 }); },
  countdown: t => tone(660, t, 0.15, { type: 'square', vol: 0.12 }),
  go: t => tone(1320, t, 0.4, { type: 'square', vol: 0.15 }),
  cheer: t => crowd(t, 3, 0.45),
  champions: t => {
    crowd(t, 4.5, 0.5);
    [[60, 64, 67], [65, 69, 72], [67, 71, 74], [72, 76, 79]].forEach((ch, i) =>
      ch.forEach(m => tone(mtof(m), t + i * 0.45, i === 3 ? 1.6 : 0.42, { type: 'sawtooth', vol: 0.07, cutoff: 2500, attack: 0.03 })));
    for (let i = 0; i < 4; i++) kick(t + i * 0.45, sfxGain);
    setTimeout(() => say('Champions! Champions!', 'en'), 1900);
  },
  daidai: t => {
    for (let i = 0; i < 8; i++) { kick(t + i * 0.25, sfxGain); if (i % 2) snare(t + i * 0.25, sfxGain); }
    crowd(t, 2.5, 0.35);
    say('Дай! Дай! Дай-дай-дай!', 'ru');
  },
  drumroll: t => { for (let i = 0; i < 30; i++) snare(t + i * 0.05, sfxGain); kick(t + 1.55, sfxGain); noise(t + 1.55, 1, { vol: 0.4, freq: 4000 }); },
  airhorn: t => [0, 0.35, 0.7].forEach(d => [415, 466, 554].forEach(f => tone(f, t + d, d === 0.7 ? 0.9 : 0.25, { type: 'sawtooth', vol: 0.08, cutoff: 3000 }))),
  whoosh: t => noise(t, 0.7, { vol: 0.35, type: 'bandpass', freq: 900 }),
  ding: t => { tone(1318, t, 0.9, { type: 'sine', vol: 0.25 }); tone(1046, t + 0.25, 1.1, { type: 'sine', vol: 0.22 }); },
  beep: t => tone(1760, t, 0.08, { type: 'square', vol: 0.08 }),
  scan: t => tone(400, t, 1.4, { type: 'sine', vol: 0.12, slide: 3 }),
  paid: t => { tone(1046, t, 0.12, { type: 'triangle', vol: 0.25 }); tone(1568, t + 0.1, 0.35, { type: 'triangle', vol: 0.25 }); },
  coin: t => { tone(988, t, 0.08, { type: 'square', vol: 0.1 }); tone(1318, t + 0.07, 0.25, { type: 'square', vol: 0.1 }); },
  eat: t => [0, 0.12, 0.24].forEach(d => noise(t + d, 0.07, { vol: 0.3, type: 'lowpass', freq: 1800 })),
  splash: t => noise(t, 0.8, { vol: 0.5, type: 'lowpass', freq: 1200 }),
  firework: t => { tone(800, t, 0.6, { vol: 0.08, slide: 3 }); noise(t + 0.6, 0.8, { vol: 0.4, type: 'lowpass', freq: 1500 }); },
};

export function sfx(name) {
  if (muted || !SFX[name]) return;
  try { ac(); SFX[name](ctx.currentTime + 0.01); } catch (e) {}
}

// ---------- Music: 5 original procedural songs ----------
export const SONGS = [
  { name: 'Champions Anthem', bpm: 100, root: 60, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 4, 5, 3], drums: 'anthem', lead: 'sawtooth', seed: 3 },
  { name: 'Dai Dai Dance', bpm: 128, root: 57, scale: [0, 2, 3, 5, 7, 8, 10], prog: [0, 5, 2, 6], drums: 'four', lead: 'square', seed: 7 },
  { name: 'Island Party', bpm: 116, root: 62, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 4, 3], drums: 'party', lead: 'triangle', seed: 11 },
  { name: 'Victory March', bpm: 140, root: 58, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 3, 0, 4], drums: 'march', lead: 'square', seed: 19 },
  { name: 'Chill Waves', bpm: 84, root: 64, scale: [0, 2, 4, 5, 7, 9, 11], prog: [0, 5, 1, 4], drums: 'chill', lead: 'sine', seed: 23 },
];

let musicTimer = null, current = -1;

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function buildMelody(song) {
  const r = rng(song.seed * 9973 + 1), mel = [];
  const chordTones = [0, 2, 4, 7, 9, 11];
  let k = 2;
  for (let i = 0; i < 32; i++) {
    if (r() < 0.25) { mel.push(null); continue; }
    k = Math.max(0, Math.min(5, k + Math.floor(r() * 3) - 1));
    mel.push(i % 4 === 0 ? chordTones[k] : chordTones[k] + (r() < 0.3 ? 1 : 0));
  }
  return mel;
}

function degToMidi(song, deg, oct = 0) {
  const s = song.scale, o = Math.floor(deg / 7);
  return song.root + s[((deg % 7) + 7) % 7] + 12 * (o + oct);
}

export function playSong(i) {
  ac(); stopSong();
  const song = SONGS[i]; if (!song) return;
  current = i;
  const mel = buildMelody(song), step = 60 / song.bpm / 4;
  let n = 0, next = ctx.currentTime + 0.1;
  musicTimer = setInterval(() => {
    while (next < ctx.currentTime + 0.2) {
      const t = next, bar = Math.floor(n / 16) % 4, s = n % 16, chordDeg = song.prog[bar];
      if (!muted) {
        const d = song.drums;
        if (d === 'four' || d === 'party') { if (s % 4 === 0) kick(t, musicGain); if (s % 8 === 4) snare(t, musicGain); if (s % 2 === 0) hat(t, musicGain, s % 4 === 2 ? 0.15 : 0.07); }
        else if (d === 'anthem') { if (s === 0 || s === 8) kick(t, musicGain); if (s === 4 || s === 12) { snare(t, musicGain); } }
        else if (d === 'march') { if (s % 4 === 0) kick(t, musicGain); if (s % 2 === 1 || s === 14) snare(t, musicGain); }
        else if (d === 'chill') { if (s === 0 || s === 10) kick(t, musicGain); if (s === 8) snare(t, musicGain); if (s % 4 === 2) hat(t, musicGain, 0.05); }
        // bass
        if (s % 4 === 0 || (song.drums === 'four' && s % 4 === 2))
          tone(mtof(degToMidi(song, chordDeg, -2)), t, step * 3.5, { type: 'triangle', vol: 0.35, out: musicGain });
        // chord pad
        if (s === 0) [0, 2, 4].forEach(k => tone(mtof(degToMidi(song, chordDeg + k, 0)), t, step * 15, { type: 'sawtooth', vol: 0.035, out: musicGain, attack: 0.15, cutoff: 1400 }));
        // lead
        if (s % 2 === 0) {
          const m = mel[(n / 2) % 32];
          if (m !== null) tone(mtof(degToMidi(song, chordDeg + m, 0)),
            t, step * 1.8, { type: song.lead, vol: song.lead === 'sine' ? 0.12 : 0.06, out: musicGain, cutoff: 3500 });
        }
      }
      next += step; n++;
    }
  }, 30);
}

export function stopSong() { if (musicTimer) clearInterval(musicTimer); musicTimer = null; current = -1; }
export function currentSong() { return current; }
export function setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.8; if (m && window.speechSynthesis) speechSynthesis.cancel(); }
export function isMuted() { return muted; }
export function unlockAudio() { try { ac(); } catch (e) {} }

// ---------- Ambience: ocean waves, wind and birds ----------
let amb = null;
export function ambience(on, { underground = false } = {}) {
  try { ac(); } catch (e) { return; }
  if (!amb) {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(master);
    const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const wave = ctx.createGain(); wave.gain.value = 0.25;
    const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.12; lfoG.gain.value = 0.18; lfo.connect(lfoG); lfoG.connect(wave.gain);
    src.connect(lp); lp.connect(wave); wave.connect(g); src.start(); lfo.start();
    amb = { g, lp, birdT: null };
  }
  amb.g.gain.setTargetAtTime(on ? (underground ? 0.08 : 0.32) : 0, ctx.currentTime, 0.8);
  amb.lp.frequency.setTargetAtTime(underground ? 180 : 520, ctx.currentTime, 0.5);
  clearInterval(amb.birdT);
  if (on && !underground) amb.birdT = setInterval(() => {
    if (muted || Math.random() < 0.5) return;
    const t = ctx.currentTime, f = 2200 + Math.random() * 1800, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) tone(f * (1 + Math.random() * 0.2), t + i * 0.12, 0.09, { type: 'sine', vol: 0.025, slide: 1.3 });
  }, 2500);
}
