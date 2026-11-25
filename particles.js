// DWM particle field.
// One set of particles travels the whole page. Each section with data-shape gives it a new form:
// mark, film, wave, frames, asterisk, word:TEXT or dust. Between sections it breaks into chaos and reforms.
// Cursor repels, click bursts, speed lights particles red.
import * as THREE from 'three';

const BONE = new THREE.Color('#e8e4dc');
const SIGNAL = new THREE.Color('#ff2b1c');
const ASH = new THREE.Color('#8c8a85');

// ?snap in the URL skips the physics so shapes can be checked on slow previews
const SNAP = /[?&]snap/.test(location.search);

export function initField(canvas, opts = {}) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance' }); }
  catch (e) { canvas.remove(); return null; }
  const dpr = Math.min(devicePixelRatio || 1, 2);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -10, 10);
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uDpr: { value: dpr }, uOpacity: { value: 1 } },
    vertexShader: `attribute float aSize; attribute vec3 aColor; varying vec3 vC; uniform float uDpr;
      void main(){ vC=aColor; gl_PointSize=aSize*uDpr; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `varying vec3 vC; uniform float uOpacity;
      void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor=vec4(vC, smoothstep(0.5,0.12,d)*uOpacity); }`,
  });

  const sections = [...document.querySelectorAll('[data-shape]')];
  let W = 0, H = 0, N = 0, mobile = false;
  let geo, pos, vel, col, base, size, phase, chaos, shapes = [], anchors = [], opac = [];
  const mouse = { x: 9e9, y: 9e9, r: 120, rT: 120 };

  // ---------- shape drawing ----------
  function draw(kind, g) {
    const cx = W / 2, cy = H / 2, m = Math.min(W, H);
    g.fillStyle = g.strokeStyle = '#fff'; g.lineCap = 'square';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (kind === 'mark') {
      const fs = Math.min(W * (mobile ? 0.22 : 0.18), H * (mobile ? 0.1 : 0.2));
      const y = H * (mobile ? 0.17 : 0.27);
      g.font = `${fs * 1.15}px "Anton", sans-serif`; g.fillText('DWM', cx, y);
      const tw = g.measureText('DWM').width, bw = tw / 2 + fs * 0.32, bh = fs * 0.78, L = fs * 0.24;
      g.lineWidth = Math.max(3, fs * 0.045);
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const x = cx + sx * bw, yy = y + sy * bh;
        g.beginPath(); g.moveTo(x - sx * L, yy); g.lineTo(x, yy); g.lineTo(x, yy - sy * L); g.stroke();
      }
      g.fillStyle = '#f00'; g.beginPath(); g.arc(cx, y, fs * 0.05, 0, 7); g.fill();
    } else if (kind === 'film') {
      g.save(); g.translate(cx, cy); g.rotate(-0.09);
      const len = W * 1.3, h = Math.min(H * 0.3, 260), fw = h * 1.3;
      g.lineWidth = 2; g.strokeRect(-len / 2, -h / 2, len, h);
      const hole = h * 0.07;
      for (let x = -len / 2 + hole; x < len / 2; x += hole * 2.4) {
        g.fillRect(x, -h / 2 + hole * 0.6, hole, hole * 1.3); g.fillRect(x, h / 2 - hole * 1.9, hole, hole * 1.3);
      }
      for (let x = -len / 2; x < len / 2; x += fw + 10) g.strokeRect(x, -h / 2 + hole * 2.6, fw, h - hole * 5.2);
      g.restore();
    } else if (kind === 'wave') {
      const bars = Math.floor(W / (mobile ? 6 : 7)), amp = H * 0.22;
      for (let i = 0; i < bars; i++) {
        const t = i / bars;
        const env = Math.sin(Math.PI * t) ** 0.6;
        const v = (0.25 + 0.75 * Math.abs(Math.sin(i * 0.37) * Math.cos(i * 0.113) + 0.3 * Math.sin(i * 1.7))) * env;
        g.fillRect(t * W, cy - v * amp, mobile ? 2 : 3, v * amp * 2);
      }
    } else if (kind === 'frames') {
      const h = Math.min(H * 0.48, W * (mobile ? 0.5 : 0.3));
      const rs = mobile ? [[9, 16]] : [[9, 16], [4, 3], [16, 9]];
      const ws = rs.map(([a, b]) => a / b * (b > a ? h : h * 0.62));
      const hs = rs.map(([a, b]) => b > a ? h : h * 0.62);
      const gap = W * 0.04, total = ws.reduce((a, b) => a + b, 0) + gap * (rs.length - 1);
      let x = cx - total / 2; g.lineWidth = 3;
      rs.forEach(([a, b], i) => {
        g.strokeRect(x, cy - hs[i] / 2, ws[i], hs[i]);
        g.font = `bold ${Math.max(16, h * 0.07)}px "Space Mono", monospace`;
        g.fillText(`${a}:${b}`, x + ws[i] / 2, cy + hs[i] / 2 + h * 0.09);
        x += ws[i] + gap;
      });
    } else if (kind === 'asterisk') {
      const r = m * 0.17, ay = H * (mobile ? 0.26 : 0.3), ax = mobile ? cx : W * 0.7; g.lineWidth = r * 0.17; g.strokeStyle = '#f00';
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4; g.beginPath(); g.moveTo(ax - Math.cos(a) * r, ay - Math.sin(a) * r); g.lineTo(ax + Math.cos(a) * r, ay + Math.sin(a) * r); g.stroke(); }
    } else if (kind.startsWith('word:')) {
      const txt = kind.slice(5); let fs = Math.min(H * 0.32, W * 0.9 / (txt.length * 0.48));
      g.font = `${fs}px "Anton", sans-serif`; g.fillText(txt, cx, H * 0.4);
    }
  }

  function samplePoints(kind) {
    if (kind === 'dust') return null;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true }); draw(kind, g);
    const d = g.getImageData(0, 0, W, H).data, pts = [], step = 2;
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      const k = (y * W + x) * 4; if (d[k + 3] < 128) continue;
      pts.push(x - W / 2 + (Math.random() - 0.5) * step, H / 2 - y + (Math.random() - 0.5) * step, d[k + 1] < 80 ? 1 : 0);
    }
    return pts;
  }

  function build() {
    W = innerWidth || document.documentElement.clientWidth; H = innerHeight || document.documentElement.clientHeight;
    if (!W || !H) { setTimeout(build, 250); return; }
    mobile = W < 760;
    renderer.setSize(W, H, false);
    camera.left = -W / 2; camera.right = W / 2; camera.top = H / 2; camera.bottom = -H / 2; camera.updateProjectionMatrix();
    N = Math.round((mobile ? 5500 : 11000) * (opts.density || 1));
    const DUST = Math.round(N * 0.14);
    const kinds = sections.map(s => s.dataset.shape);
    shapes = kinds.map(kind => {
      const pts = samplePoints(kind), out = new Float32Array(N * 2), red = new Uint8Array(N);
      const count = pts ? pts.length / 3 : 0;
      for (let i = 0; i < N; i++) {
        if (!pts || i >= N - DUST || !count) {
          out[i * 2] = (Math.random() - 0.5) * W * 1.15; out[i * 2 + 1] = (Math.random() - 0.5) * H * 1.15;
        } else {
          const j = (Math.random() * count | 0) * 3;
          out[i * 2] = pts[j]; out[i * 2 + 1] = pts[j + 1]; red[i] = pts[j + 2];
        }
      }
      return { xy: out, red };
    });
    opac = sections.map(s => parseFloat(s.dataset.op || '1'));
    pos = new Float32Array(N * 3); vel = new Float32Array(N * 2); col = new Float32Array(N * 3);
    base = new Float32Array(N * 3); size = new Float32Array(N); phase = new Float32Array(N); chaos = new Float32Array(N * 2);
    const s0 = shapes[0];
    for (let i = 0; i < N; i++) {
      const c = s0.red[i] || Math.random() < 0.025 ? SIGNAL : (Math.random() < 0.2 ? ASH : BONE);
      base.set([c.r, c.g, c.b], i * 3); col.set([c.r, c.g, c.b], i * 3);
      size[i] = (i >= N * 0.86 ? 0.8 + Math.random() * 1.4 : 1.4 + Math.random() * 1.2) * (mobile ? 0.9 : 1);
      phase[i] = Math.random() * 6.283;
      const a = Math.random() * 6.283, r = (0.25 + Math.random() * 0.75) * Math.max(W, H) * 0.55;
      chaos[i * 2] = Math.cos(a) * r; chaos[i * 2 + 1] = Math.sin(a) * r;
      pos[i * 3] = reduced ? s0.xy[i * 2] : (Math.random() - 0.5) * W * 1.6;
      pos[i * 3 + 1] = reduced ? s0.xy[i * 2 + 1] : (Math.random() - 0.5) * H * 1.6;
    }
    if (geo) { scene.remove(scene.children[0]); geo.dispose(); }
    geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    scene.add(new THREE.Points(geo, mat));
    measure();
  }

  function measure() {
    const max = document.documentElement.scrollHeight - innerHeight;
    anchors = sections.map((s, i) => i === 0 ? 0 : Math.min(max - 2, s.offsetTop + s.offsetHeight / 2 - innerHeight / 2));
  }
  setInterval(measure, 1500);

  // where are we on the journey: index a, next b, mix f (held near each anchor)
  function journey() {
    const y = scrollY;
    if (anchors.length < 2 || y <= anchors[0]) return [0, 0, 0];
    for (let i = 0; i < anchors.length - 1; i++) {
      if (y < anchors[i + 1]) {
        const f = (y - anchors[i]) / (anchors[i + 1] - anchors[i] || 1);
        const e = Math.min(1, Math.max(0, (f - 0.18) / 0.64));
        return [i, i + 1, e * e * (3 - 2 * e)];
      }
    }
    const l = anchors.length - 1; return [l, l, 0];
  }

  // input
  addEventListener('pointermove', e => { mouse.x = e.clientX - W / 2; mouse.y = H / 2 - e.clientY; }, { passive: true });
  document.addEventListener('mouseleave', () => { mouse.x = mouse.y = 9e9; });
  addEventListener('pointerdown', e => {
    if (e.target.closest('a,button,input,video,.tile,.product,summary')) return;
    const bx = e.clientX - W / 2, by = H / 2 - e.clientY;
    for (let i = 0; i < N; i++) {
      const dx = pos[i * 3] - bx, dy = pos[i * 3 + 1] - by, d = Math.hypot(dx, dy) + 1;
      if (d < 380) { const f = (1 - d / 380) * 42; vel[i * 2] += dx / d * f; vel[i * 2 + 1] += dy / d * f; }
    }
  });
  document.querySelectorAll('[data-disperse]').forEach(el => {
    el.addEventListener('pointerenter', () => mouse.rT = 240);
    el.addEventListener('pointerleave', () => mouse.rT = 120);
  });
  let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 220); });

  build();
  let t = 0, last = performance.now();
  function tick(now) {
    requestAnimationFrame(tick);
    if (!geo) return;
    const dt = Math.min(3, ((now || performance.now()) - last) / 16.67); last = now || performance.now();
    t += 0.016 * dt;
    const [a, b, f] = journey();
    const A = shapes[a].xy, B = shapes[b].xy, burst = Math.sin(Math.PI * f);
    mat.uniforms.uOpacity.value = opac[a] + (opac[b] - opac[a]) * f;
    mouse.r += (mouse.rT - mouse.r) * 0.1;
    const R = mouse.r, R2 = R * R, spring = 0.045 * dt, damp = Math.pow(0.84, dt);
    for (let i = 0; i < N; i++) {
      const i2 = i * 2, i3 = i * 3, ph = phase[i];
      const tx = A[i2] + (B[i2] - A[i2]) * f + chaos[i2] * burst + Math.sin(t * 0.7 + ph) * 1.4;
      const ty = A[i2 + 1] + (B[i2 + 1] - A[i2 + 1]) * f + chaos[i2 + 1] * burst + Math.cos(t * 0.6 + ph) * 1.4;
      let vx = vel[i2] + (tx - pos[i3]) * spring, vy = vel[i2 + 1] + (ty - pos[i3 + 1]) * spring;
      const dx = pos[i3] - mouse.x, dy = pos[i3 + 1] - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < R2) {
        const d = Math.sqrt(d2) + 0.01, k = (1 - d / R) ** 2 * 7.5 * dt;
        vx += (dx / d - dy / d * 0.35) * k; vy += (dy / d + dx / d * 0.35) * k;
      }
      if (SNAP) { pos[i3] = tx; pos[i3 + 1] = ty; continue; }
      vx *= damp; vy *= damp; vel[i2] = vx; vel[i2 + 1] = vy;
      pos[i3] += vx * dt; pos[i3 + 1] += vy * dt;
      const sp = Math.min(1, (vx * vx + vy * vy) / 50);
      col[i3] = base[i3] + (SIGNAL.r - base[i3]) * sp;
      col[i3 + 1] = base[i3 + 1] + (SIGNAL.g - base[i3 + 1]) * sp;
      col[i3 + 2] = base[i3 + 2] + (SIGNAL.b - base[i3 + 2]) * sp;
    }
    geo.attributes.position.needsUpdate = true; geo.attributes.aColor.needsUpdate = true;
    renderer.render(scene, camera);
  }
  requestAnimationFrame(tick);
  return { rebuild: build };
}
