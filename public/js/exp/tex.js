// Realistic surfaces for Marbly games, painted once on canvases: asphalt, concrete, marble, painted plaster,
// wood, carpet and ceiling tiles. Each comes with a matching bump (normal) map so light catches the detail.
import * as THREE from 'three';

const cache = {};
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
function canvas(n = 512) { const c = document.createElement('canvas'); c.width = c.height = n; return [c, c.getContext('2d')]; }
// normal map from a greyscale height canvas
function normalFrom(hc, strength = 2) {
  const n = hc.width, src = hc.getContext('2d').getImageData(0, 0, n, n).data, [c, g] = canvas(n), img = g.createImageData(n, n), H = (x, y) => src[(((y + n) % n) * n + ((x + n) % n)) * 4] / 255;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength, l = Math.hypot(dx, dy, 1), i = (y * n + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255; img.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return c;
}
function tex(c, rep, srgb = true) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; }
function noise(g, n, r, amt, alpha = 1) { const img = g.getImageData(0, 0, n, n), d = img.data; for (let i = 0; i < d.length; i += 4) { const v = (r() - 0.5) * amt; d[i] += v; d[i + 1] += v; d[i + 2] += v; d[i + 3] = 255 * alpha; } g.putImageData(img, 0, 0); }

// each painter fills a colour canvas and a height canvas
const PAINT = {
  asphalt(g, h, n, r) {
    g.fillStyle = '#3b3e43'; g.fillRect(0, 0, n, n); h.fillStyle = '#808080'; h.fillRect(0, 0, n, n);
    for (let i = 0; i < 26000; i++) { const x = r() * n, y = r() * n, s = 0.6 + r() * 1.8, v = 40 + r() * 70; g.fillStyle = `rgb(${v},${v},${v + 4})`; g.fillRect(x, y, s, s); h.fillStyle = `rgb(${120 + r() * 120},0,0)`; h.fillRect(x, y, s, s); }
    for (let k = 0; k < 7; k++) { g.strokeStyle = 'rgba(20,20,22,0.55)'; g.lineWidth = 1; g.beginPath(); let x = r() * n, y = r() * n; g.moveTo(x, y); for (let s = 0; s < 14; s++) { x += (r() - 0.5) * 28; y += (r() - 0.5) * 28; g.lineTo(x, y); } g.stroke(); }
    for (let k = 0; k < 10; k++) { const x = r() * n, y = r() * n, rr = 20 + r() * 60, gr = g.createRadialGradient(x, y, 0, x, y, rr); gr.addColorStop(0, `rgba(${r() < 0.5 ? '25,25,28' : '80,80,84'},0.25)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
  },
  concrete(g, h, n, r) {
    g.fillStyle = '#b9b6ae'; g.fillRect(0, 0, n, n); h.fillStyle = '#808080'; h.fillRect(0, 0, n, n);
    for (let k = 0; k < 60; k++) { const x = r() * n, y = r() * n, rr = 10 + r() * 50, gr = g.createRadialGradient(x, y, 0, x, y, rr); const v = r() < 0.5 ? '150,146,138' : '205,201,193'; gr.addColorStop(0, `rgba(${v},0.35)`); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2); }
    for (let i = 0; i < 5000; i++) { const x = r() * n, y = r() * n; g.fillStyle = `rgba(${r() < 0.5 ? '90,88,84' : '235,232,226'},${0.3 + r() * 0.4})`; g.fillRect(x, y, 1.2, 1.2); h.fillStyle = `rgba(${r() < 0.5 ? 40 : 200},0,0,0.6)`; h.fillRect(x, y, 1.4, 1.4); }
    g.strokeStyle = 'rgba(80,78,72,0.5)'; g.lineWidth = 2; g.strokeRect(1, 1, n - 2, n - 2); h.strokeStyle = '#303030'; h.lineWidth = 3; h.strokeRect(1, 1, n - 2, n - 2);
  },
  marble(g, h, n, r) {
    const grd = g.createLinearGradient(0, 0, n, n); grd.addColorStop(0, '#f6f4f0'); grd.addColorStop(1, '#ece8e1'); g.fillStyle = grd; g.fillRect(0, 0, n, n); h.fillStyle = '#808080'; h.fillRect(0, 0, n, n);
    for (let k = 0; k < 22; k++) {
      let x = r() * n, y = r() * n, a = r() * 6.28; g.lineWidth = 0.6 + r() * 2.2; g.strokeStyle = `rgba(${150 + r() * 40},${150 + r() * 35},${150 + r() * 30},${0.25 + r() * 0.4})`; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 40; s++) { a += (r() - 0.5) * 0.7; x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); } g.stroke();
    }
    g.strokeStyle = 'rgba(160,150,140,0.6)'; g.lineWidth = 1.5; g.strokeRect(0.5, 0.5, n - 1, n - 1); h.strokeStyle = '#404040'; h.lineWidth = 2; h.strokeRect(0.5, 0.5, n - 1, n - 1);
  },
  plaster(g, h, n, r) {
    g.fillStyle = '#efe8db'; g.fillRect(0, 0, n, n); h.fillStyle = '#808080'; h.fillRect(0, 0, n, n);
    for (let i = 0; i < 9000; i++) { const x = r() * n, y = r() * n, s = 1 + r() * 3; g.fillStyle = `rgba(${r() < 0.5 ? '200,192,178' : '255,252,244'},0.25)`; g.fillRect(x, y, s, s); h.fillStyle = `rgba(${r() < 0.5 ? 60 : 190},0,0,0.5)`; h.fillRect(x, y, s, s); }
  },
  wood(g, h, n, r) {
    for (let p = 0; p < 8; p++) { // planks
      const y0 = p * n / 8, base = 120 + r() * 40; g.fillStyle = `rgb(${base + 40},${base - 5},${base - 50})`; g.fillRect(0, y0, n, n / 8);
      for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(${70 + r() * 40},${40 + r() * 20},${15},${0.15 + r() * 0.25})`; g.lineWidth = 0.5 + r() * 1.5; g.beginPath(); const yy = y0 + r() * n / 8; g.moveTo(0, yy); for (let x = 0; x <= n; x += 32) g.lineTo(x, yy + Math.sin(x * 0.02 + i) * 2); g.stroke(); }
      g.fillStyle = 'rgba(40,22,10,0.8)'; g.fillRect(0, y0, n, 1.5); h.fillStyle = '#202020'; h.fillRect(0, y0, n, 2); const cut = r() * n; g.fillRect(cut, y0, 1.5, n / 8); h.fillRect(cut, y0, 2, n / 8);
    }
  },
  carpet(g, h, n, r) { g.fillStyle = '#5a2232'; g.fillRect(0, 0, n, n); h.fillStyle = '#808080'; h.fillRect(0, 0, n, n); noise(g, n, r, 26); noise(h, n, r, 120); },
  ceiling(g, h, n, r) {
    g.fillStyle = '#f2f1ec'; g.fillRect(0, 0, n, n); h.fillStyle = '#909090'; h.fillRect(0, 0, n, n);
    for (let i = 0; i < 3000; i++) { const x = r() * n, y = r() * n; g.fillStyle = 'rgba(170,168,160,0.5)'; g.fillRect(x, y, 1.5, 1.5); h.fillStyle = '#505050'; h.fillRect(x, y, 1.5, 1.5); }
    g.fillStyle = '#c9c7bf'; for (const t of [0, n / 2]) { g.fillRect(t, 0, 4, n); g.fillRect(0, t, n, 4); } h.fillStyle = '#e0e0e0'; for (const t of [0, n / 2]) { h.fillRect(t, 0, 4, n); h.fillRect(0, t, n, 4); }
  },
  grass(g, h, n, r) {
    g.fillStyle = '#4f7f35'; g.fillRect(0, 0, n, n); h.fillStyle = '#808080'; h.fillRect(0, 0, n, n);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, n / 2, n); // mowing stripes
    for (let i = 0; i < 30000; i++) { const x = r() * n, y = r() * n; g.fillStyle = `rgba(${40 + r() * 60},${90 + r() * 70},${20 + r() * 30},0.6)`; g.fillRect(x, y, 1, 2 + r() * 3); h.fillStyle = `rgba(${100 + r() * 155},0,0,0.5)`; h.fillRect(x, y, 1, 3); }
  },
};

// a ready material: kind, how many repeats, extra material settings
export function surface(kind, rep = [1, 1], extra = {}) {
  if (!cache[kind]) {
    const [c, g] = canvas(512), [hc, h] = canvas(512), r = rng(kind.length * 7919 + 13);
    PAINT[kind](g, h, 512, r);
    cache[kind] = { c, n: normalFrom(hc, kind === 'asphalt' ? 3 : kind === 'wood' ? 2.5 : 1.6) };
  }
  const { c, n } = cache[kind];
  const rough = { asphalt: 0.92, concrete: 0.88, marble: 0.18, plaster: 0.9, wood: 0.55, carpet: 1, ceiling: 0.95, grass: 1 }[kind];
  return new THREE.MeshStandardMaterial({ map: tex(c, rep), normalMap: tex(n, rep, false), normalScale: new THREE.Vector2(0.6, 0.6), roughness: rough, ...extra });
}
