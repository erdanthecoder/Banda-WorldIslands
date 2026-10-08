// Fun games: Flappy, Snake, Mini-Craft (3D voxel builder)
import * as THREE from 'three';

function canvasIn(el, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; c.className = 'game-canvas';
  el.innerHTML = ''; el.appendChild(c); return c;
}

export function flappy(ctx) {
  const c = canvasIn(ctx.el, 480, 640), g = c.getContext('2d');
  let bird, pipes, score, best = +localStorage.getItem('banda_flappy') || 0, state = 'ready', raf, last = performance.now(), clouds = [];
  for (let i = 0; i < 6; i++) clouds.push({ x: Math.random() * 480, y: 40 + Math.random() * 200, s: 0.5 + Math.random() });
  const reset = () => { bird = { y: 300, v: 0 }; pipes = []; score = 0; state = 'ready'; };
  const flap = e => { e && e.preventDefault && e.preventDefault(); if (state === 'dead') { reset(); return; } state = 'play'; bird.v = -380; ctx.sfx('flap'); };
  const key = e => { if (e.code === 'Space' || e.code === 'ArrowUp') flap(e); };
  c.addEventListener('pointerdown', flap); addEventListener('keydown', key);
  reset();
  const loop = now => {
    const dt = Math.min(0.033, (now - last) / 1000); last = now;
    if (state === 'play') {
      bird.v += 1150 * dt; bird.y += bird.v * dt;
      if (!pipes.length || pipes[pipes.length - 1].x < 480 - 210) pipes.push({ x: 500, gap: 120 + Math.random() * 300, pass: false });
      pipes.forEach(p => { p.x -= 170 * dt; if (!p.pass && p.x + 70 < 120) { p.pass = true; score++; ctx.sfx('star'); } });
      pipes = pipes.filter(p => p.x > -80);
      const hit = bird.y > 600 || bird.y < 0 || pipes.some(p => 120 + 16 > p.x && 120 - 16 < p.x + 70 && (bird.y - 14 < p.gap - 80 || bird.y + 14 > p.gap + 80));
      if (hit) { state = 'dead'; ctx.sfx('hit'); if (score > best) { best = score; localStorage.setItem('banda_flappy', best); } }
    }
    const sky = g.createLinearGradient(0, 0, 0, 640); sky.addColorStop(0, '#4fb3ff'); sky.addColorStop(1, '#c9f0ff');
    g.fillStyle = sky; g.fillRect(0, 0, 480, 640);
    g.fillStyle = 'rgba(255,255,255,.9)';
    clouds.forEach(cl => { cl.x -= 20 * cl.s * dt; if (cl.x < -80) cl.x = 520; g.beginPath(); g.ellipse(cl.x, cl.y, 40 * cl.s, 18 * cl.s, 0, 0, 7); g.ellipse(cl.x + 25 * cl.s, cl.y - 8, 28 * cl.s, 16 * cl.s, 0, 0, 7); g.fill(); });
    pipes.forEach(p => {
      const grd = g.createLinearGradient(p.x, 0, p.x + 70, 0); grd.addColorStop(0, '#3fae3a'); grd.addColorStop(0.5, '#8ee35a'); grd.addColorStop(1, '#2e8a2a');
      g.fillStyle = grd; g.fillRect(p.x, 0, 70, p.gap - 80); g.fillRect(p.x, p.gap + 80, 70, 640);
      g.fillRect(p.x - 6, p.gap - 104, 82, 24); g.fillRect(p.x - 6, p.gap + 80, 82, 24);
    });
    g.fillStyle = '#e3c27a'; g.fillRect(0, 600, 480, 40); g.fillStyle = '#7ccf4a'; g.fillRect(0, 596, 480, 8);
    g.save(); g.translate(120, bird.y); g.rotate(Math.max(-0.5, Math.min(1.2, bird.v / 600)));
    g.fillStyle = '#ffd23f'; g.beginPath(); g.ellipse(0, 0, 20, 15, 0, 0, 7); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(8, -5, 6, 0, 7); g.fill(); g.fillStyle = '#000'; g.beginPath(); g.arc(10, -5, 3, 0, 7); g.fill();
    g.fillStyle = '#ff7b2e'; g.beginPath(); g.moveTo(16, 0); g.lineTo(28, 4); g.lineTo(16, 8); g.fill();
    g.fillStyle = '#f5b301'; g.beginPath(); g.ellipse(-6, 4, 10, 6, Math.sin(now / 80) * 0.5, 0, 7); g.fill(); g.restore();
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 5; g.font = 'bold 52px system-ui'; g.textAlign = 'center';
    g.strokeText(score, 240, 80); g.fillText(score, 240, 80);
    g.font = 'bold 24px system-ui';
    if (state === 'ready') { g.strokeText(ctx.t('tapToFly'), 240, 400); g.fillText(ctx.t('tapToFly'), 240, 400); }
    if (state === 'dead') { const s = `${ctx.t('gameOver')} · ${ctx.t('best')}: ${best}`; g.strokeText(s, 240, 330); g.fillText(s, 240, 330); g.strokeText(ctx.t('tapToRetry'), 240, 370); g.fillText(ctx.t('tapToRetry'), 240, 370); }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => { cancelAnimationFrame(raf); removeEventListener('keydown', key); };
}

export function snake(ctx) {
  const N = 20, S = 24, c = canvasIn(ctx.el, N * S, N * S), g = c.getContext('2d');
  let sn, dir, nd, food, score, dead, timer;
  const place = () => { do food = { x: Math.floor(Math.random() * N), y: Math.floor(Math.random() * N) }; while (sn.some(p => p.x === food.x && p.y === food.y)); };
  const reset = () => { sn = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }]; dir = nd = { x: 1, y: 0 }; score = 0; dead = false; place(); };
  const setDir = (x, y) => { if (x !== -dir.x || y !== -dir.y) nd = { x, y }; };
  const key = e => { const m = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] }[e.code]; if (m) { e.preventDefault(); setDir(...m); } if (dead && e.code === 'Space') reset(); };
  addEventListener('keydown', key);
  let sx, sy; c.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; if (dead) reset(); });
  c.addEventListener('pointerup', e => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) + Math.abs(dy) < 20) return; Math.abs(dx) > Math.abs(dy) ? setDir(Math.sign(dx), 0) : setDir(0, Math.sign(dy)); });
  reset();
  timer = setInterval(() => {
    if (!dead) {
      dir = nd; const hd = { x: sn[0].x + dir.x, y: sn[0].y + dir.y };
      if (hd.x < 0 || hd.y < 0 || hd.x >= N || hd.y >= N || sn.some(p => p.x === hd.x && p.y === hd.y)) { dead = true; ctx.sfx('hit'); }
      else { sn.unshift(hd); if (hd.x === food.x && hd.y === food.y) { score++; ctx.sfx('star'); place(); } else sn.pop(); }
    }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { g.fillStyle = (x + y) % 2 ? '#a8d86a' : '#b5e27a'; g.fillRect(x * S, y * S, S, S); }
    g.font = `${S - 2}px serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🍎', food.x * S + S / 2, food.y * S + S / 2 + 1);
    sn.forEach((p, i) => { g.fillStyle = i ? `hsl(${220 - i * 3},70%,${45 + (i % 2) * 6}%)` : '#2445a8'; g.beginPath(); g.roundRect(p.x * S + 1, p.y * S + 1, S - 2, S - 2, 7); g.fill(); });
    g.fillStyle = '#fff'; g.fillRect(sn[0].x * S + 6, sn[0].y * S + 6, 5, 5); g.fillRect(sn[0].x * S + 13, sn[0].y * S + 6, 5, 5);
    g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(0, 0, N * S, 30); g.fillStyle = '#fff'; g.font = 'bold 18px system-ui'; g.fillText(`🍎 ${score}`, N * S / 2, 16);
    if (dead) { g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(0, 0, N * S, N * S); g.fillStyle = '#fff'; g.font = 'bold 30px system-ui'; g.fillText(ctx.t('gameOver'), N * S / 2, N * S / 2 - 20); g.font = '20px system-ui'; g.fillText(ctx.t('tapToRetry'), N * S / 2, N * S / 2 + 20); }
  }, 120);
  return () => { clearInterval(timer); removeEventListener('keydown', key); };
}

// ---------- Mini-Craft ----------
export function minicraft(ctx) {
  const el = ctx.el; el.innerHTML = '';
  const wrap = document.createElement('div'); wrap.className = 'craft'; el.appendChild(wrap);
  const canvas = document.createElement('canvas'); wrap.appendChild(canvas);
  const hud = document.createElement('div'); hud.className = 'craft-hud'; wrap.appendChild(hud);
  const help = document.createElement('div'); help.className = 'craft-help'; help.innerHTML = ctx.t('craftHelp'); wrap.appendChild(help);
  const cross = document.createElement('div'); cross.className = 'crosshair'; wrap.appendChild(cross);

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5)); renderer.shadowMap.enabled = true;
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0x8fd0ff); scene.fog = new THREE.Fog(0x8fd0ff, 20, 60);
  const cam = new THREE.PerspectiveCamera(70, 1, 0.05, 200);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x557744, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(20, 40, 10); scene.add(sun);

  const tex = (draw) => { const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d'); draw(g); const t = new THREE.CanvasTexture(c); t.magFilter = THREE.NearestFilter; t.colorSpace = THREE.SRGBColorSpace; return t; };
  const speck = (base, dots) => g => { g.fillStyle = base; g.fillRect(0, 0, 16, 16); for (let i = 0; i < 40; i++) { g.fillStyle = dots[i % dots.length]; g.fillRect(Math.random() * 16 | 0, Math.random() * 16 | 0, 1 + (Math.random() * 2 | 0), 1); } };
  const TYPES = [
    { n: '🌱', tex: tex(g => { speck('#7a5230', ['#5e3d22', '#8c6239'])(g); g.fillStyle = '#5fb43a'; g.fillRect(0, 0, 16, 5); for (let i = 0; i < 16; i += 2) g.fillRect(i, 5, 1, Math.random() * 3 | 0); }) },
    { n: '🟫', tex: tex(speck('#7a5230', ['#5e3d22', '#8c6239'])) },
    { n: '🪨', tex: tex(speck('#8a8a8a', ['#6e6e6e', '#a0a0a0'])) },
    { n: '🪵', tex: tex(g => { g.fillStyle = '#a27b4a'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#7d5a31'; for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 1, 16); }) },
    { n: '🍃', tex: tex(speck('#3f9a2e', ['#2f7a22', '#57b843'])) },
    { n: '🧱', tex: tex(g => { g.fillStyle = '#b5482f'; g.fillRect(0, 0, 16, 16); g.fillStyle = '#ddd'; for (let y = 0; y < 16; y += 4) { g.fillRect(0, y, 16, 1); for (let x = (y / 4 % 2) * 4; x < 16; x += 8) g.fillRect(x, y, 1, 4); } }) },
    { n: '💎', tex: tex(speck('#8a8a8a', ['#4fe3e3', '#6e6e6e', '#2cc'])) },
    { n: '🟨', tex: tex(speck('#e6d38a', ['#d4bf6e', '#f1e3a6'])) },
    { n: '🪟', tex: tex(g => { g.fillStyle = 'rgba(200,240,255,0.35)'; g.fillRect(0, 0, 16, 16); g.strokeStyle = '#fff'; g.strokeRect(0.5, 0.5, 15, 15); }), glass: true },
  ];
  const W = 32, Hh = 16, blocks = new Map(), key = (x, y, z) => `${x},${y},${z}`;
  const mats = TYPES.map(T => new THREE.MeshLambertMaterial({ map: T.tex, transparent: !!T.glass, opacity: T.glass ? 0.6 : 1 }));
  const box = new THREE.BoxGeometry(1, 1, 1);
  const meshes = mats.map(m => { const im = new THREE.InstancedMesh(box, m, 12000); im.count = 0; scene.add(im); return im; });
  const n2 = (x, z) => Math.sin(x * 0.3) * Math.cos(z * 0.25) * 2 + Math.sin((x + z) * 0.15) * 2;
  for (let x = 0; x < W; x++) for (let z = 0; z < W; z++) {
    const top = Math.round(4 + n2(x, z));
    for (let y = 0; y <= top; y++) blocks.set(key(x, y, z), y === top ? (top <= 2 ? 7 : 0) : y > top - 3 ? 1 : (Math.random() < 0.04 ? 6 : 2));
  }
  for (let i = 0; i < 7; i++) {
    const x = 3 + (Math.random() * (W - 6) | 0), z = 3 + (Math.random() * (W - 6) | 0); let y = 0; while (blocks.has(key(x, y + 1, z))) y++;
    for (let k = 1; k <= 4; k++) blocks.set(key(x, y + k, z), 3);
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 3; dy <= 5; dy++) if (Math.abs(dx) + Math.abs(dz) + (dy - 3) < 4 && !blocks.has(key(x + dx, y + dy, z + dz))) blocks.set(key(x + dx, y + dy, z + dz), 4);
  }
  const lookup = [];
  const rebuild = () => {
    meshes.forEach(m => m.count = 0); lookup.length = 0; mats.forEach(() => lookup.push([]));
    const m4 = new THREE.Matrix4();
    for (const [k, t] of blocks) {
      const [x, y, z] = k.split(',').map(Number);
      if (blocks.has(key(x + 1, y, z)) && blocks.has(key(x - 1, y, z)) && blocks.has(key(x, y + 1, z)) && blocks.has(key(x, y - 1, z)) && blocks.has(key(x, y, z + 1)) && blocks.has(key(x, y, z - 1))) continue;
      const im = meshes[t]; m4.makeTranslation(x + 0.5, y + 0.5, z + 0.5); im.setMatrixAt(im.count, m4); lookup[t][im.count] = [x, y, z]; im.count++;
    }
    meshes.forEach(m => { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); });
  };
  rebuild();

  const pl = { x: W / 2, y: 14, z: W / 2, vy: 0, yaw: 0, pitch: -0.3, ground: false };
  let sel = 0, placed = 0, keys = {}, raf, last = performance.now();
  const drawHud = () => { hud.innerHTML = TYPES.map((T, i) => `<span class="${i === sel ? 'sel' : ''}" data-i="${i}">${T.n}<small>${i + 1}</small></span>`).join(''); };
  hud.onclick = e => { const s = e.target.closest('span'); if (s) { sel = +s.dataset.i; drawHud(); } };
  drawHud();
  const solid = (x, y, z) => blocks.has(key(Math.floor(x), Math.floor(y), Math.floor(z)));
  const collides = (x, y, z) => { for (const dx of [-0.3, 0.3]) for (const dz of [-0.3, 0.3]) for (const dy of [0, 0.9, 1.6]) if (solid(x + dx, y + dy, z + dz)) return true; return false; };

  const ray = new THREE.Raycaster(); ray.far = 7;
  const act = place => {
    ray.setFromCamera({ x: 0, y: 0 }, cam);
    const hit = ray.intersectObjects(meshes)[0]; if (!hit) return;
    const t = meshes.indexOf(hit.object), [x, y, z] = lookup[t][hit.instanceId];
    if (place) {
      const n = hit.face.normal, nx = x + n.x, ny = y + n.y, nz = z + n.z;
      if (ny >= 0 && ny < 30 && !blocks.has(key(nx, ny, nz))) {
        blocks.set(key(nx, ny, nz), sel);
        if (collides(pl.x, pl.y, pl.z)) { blocks.delete(key(nx, ny, nz)); return; }
        placed++; if (placed % 25 === 0) ctx.award(1);
        ctx.sfx('place');
      }
    } else if (y > 0) { blocks.delete(key(x, y, z)); ctx.sfx('place'); if (t === 6) { ctx.award(1); ctx.sfx('star'); } }
    rebuild();
  };
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('mousedown', e => { if (document.pointerLockElement !== canvas) { canvas.requestPointerLock(); return; } act(e.button === 2); });
  const mm = e => { if (document.pointerLockElement === canvas) { pl.yaw -= e.movementX * 0.0025; pl.pitch = Math.max(-1.5, Math.min(1.5, pl.pitch - e.movementY * 0.0025)); } };
  const kd = e => { keys[e.code] = true; const d = +e.key; if (d >= 1 && d <= TYPES.length) { sel = d - 1; drawHud(); } };
  const ku = e => { keys[e.code] = false; };
  addEventListener('mousemove', mm); addEventListener('keydown', kd); addEventListener('keyup', ku);
  // touch: drag to look, buttons
  const tb = document.createElement('div'); tb.className = 'craft-touch';
  tb.innerHTML = '<button data-k="KeyW">▲</button><button data-k="KeyA">◀</button><button data-k="KeyS">▼</button><button data-k="KeyD">▶</button><button data-k="Space">⤒</button><button data-a="0">⛏</button><button data-a="1">🧱</button>';
  wrap.appendChild(tb);
  tb.querySelectorAll('button').forEach(b => {
    b.addEventListener('pointerdown', e => { e.stopPropagation(); if (b.dataset.k) keys[b.dataset.k] = true; else act(b.dataset.a === '1'); });
    b.addEventListener('pointerup', () => { if (b.dataset.k) keys[b.dataset.k] = false; });
    b.addEventListener('pointerleave', () => { if (b.dataset.k) keys[b.dataset.k] = false; });
  });
  let tl = null;
  canvas.addEventListener('touchstart', e => { tl = e.touches[0]; }, { passive: true });
  canvas.addEventListener('touchmove', e => { const t = e.touches[0]; if (tl) { pl.yaw -= (t.clientX - tl.clientX) * 0.006; pl.pitch = Math.max(-1.5, Math.min(1.5, pl.pitch - (t.clientY - tl.clientY) * 0.006)); } tl = t; }, { passive: true });

  const resize = () => { const w = wrap.clientWidth, h = wrap.clientHeight; renderer.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); };
  const ro = new ResizeObserver(resize); ro.observe(wrap); resize();
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const f = (keys.KeyW ? 1 : 0) - (keys.KeyS ? 1 : 0), s = (keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0), sp = 5;
    const dx = (-Math.sin(pl.yaw) * f + Math.cos(pl.yaw) * s) * sp * dt, dz = (-Math.cos(pl.yaw) * f - Math.sin(pl.yaw) * s) * sp * dt;
    if (!collides(pl.x + dx, pl.y, pl.z)) pl.x += dx;
    if (!collides(pl.x, pl.y, pl.z + dz)) pl.z += dz;
    pl.vy -= 25 * dt; if (keys.Space && pl.ground) { pl.vy = 8.5; pl.ground = false; }
    const ny = pl.y + pl.vy * dt;
    if (collides(pl.x, ny, pl.z)) { if (pl.vy < 0) pl.ground = true; pl.vy = 0; } else { pl.y = ny; pl.ground = false; }
    if (pl.y < -10) { pl.x = W / 2; pl.y = 20; pl.z = W / 2; }
    cam.position.set(pl.x, pl.y + 1.6, pl.z); cam.rotation.set(pl.pitch, pl.yaw, 0, 'YXZ');
    renderer.render(scene, cam);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return () => {
    cancelAnimationFrame(raf); ro.disconnect(); removeEventListener('mousemove', mm); removeEventListener('keydown', kd); removeEventListener('keyup', ku);
    if (document.pointerLockElement) document.exitPointerLock();
    renderer.dispose(); meshes.forEach(m => m.dispose());
  };
}
