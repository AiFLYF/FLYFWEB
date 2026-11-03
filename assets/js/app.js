/* ============================================================
   FLYF® — PARTICLE FIELD
   One particle system, four states:
   00 sphere → 01 torus knot → 02 wave field → 03 the word FLYF
   ============================================================ */

import * as THREE from 'three';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
// framerate-independent damping
const damp = (a, b, l, dt) => lerp(a, b, 1 - Math.exp(-l * dt));

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = matchMedia('(pointer: fine)').matches;
const fontsSettled = Promise.race([
  document.fonts.ready,
  new Promise((resolve) => setTimeout(resolve, 2200)),
]);

history.scrollRestoration = 'manual';
let initialTarget = null;
try { initialTarget = location.hash ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null; }
catch { initialTarget = null; }
if (!initialTarget) window.scrollTo(0, 0);

/* ---------- clock ---------- */

const clockEl = document.getElementById('clock');
const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const tickClock = () => { clockEl.textContent = fmt.format(new Date()); };
tickClock();
let clockTimer = setInterval(tickClock, 1000);

/* ---------- smooth scroll (inertia via wheel hijack) ---------- */

class SmoothScroll {
  constructor() {
    this.enabled = !reduced && finePointer;
    this.t = 0;
    this.c = 0;
    this.max = 1;
    this.measure();
    window.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
    window.addEventListener('scroll', () => this.onScroll(), { passive: true });
  }
  measure() {
    this.max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    this.t = clamp(this.t, 0, this.max);
  }
  onWheel(e) {
    if (!this.enabled || e.ctrlKey) return;
    e.preventDefault();
    let d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= innerHeight;
    this.t = clamp(this.t + clamp(d, -190, 190), 0, this.max);
  }
  onScroll() {
    const y = window.scrollY;
    if (Math.abs(y - this.c) > 2) {         // external scroll (keyboard, hash, touch)
      this.t = clamp(y, 0, this.max);
      if (Math.abs(y - this.c) > 200) this.c = y;
    }
  }
  to(y) {
    this.t = clamp(y, 0, this.max);
    if (!this.enabled) window.scrollTo({ top: this.t, behavior: reduced ? 'auto' : 'smooth' });
  }
  update(dt) {
    if (!this.enabled) { this.c = window.scrollY; return this.c; }
    this.c = damp(this.c, this.t, 7.5, dt);
    if (Math.abs(this.c - this.t) < 0.05) this.c = this.t;
    if (Math.abs(window.scrollY - this.c) > 0.5) window.scrollTo(0, this.c); // skip no-op writes at rest
    return this.c;
  }
}
const smooth = new SmoothScroll();

/* ---------- sections / progress ---------- */

const sections = [...document.querySelectorAll('[data-sec]')];
let tops = [0, 0, 0, 0];
const measureSections = () => { tops = sections.map((s) => s.offsetTop); };
measureSections();

function progressFromY(y) {
  for (let i = 0; i < 3; i++) {
    if (y < tops[i + 1]) {
      const span = Math.max(1, tops[i + 1] - tops[i]);
      return i + clamp((y - tops[i]) / span, 0, 1);
    }
  }
  return 3;
}

// which chapter the nav should highlight: the last section whose top has
// passed the viewport mid-line. Height-agnostic, so a section taller than
// one screen keeps the highlight until the next one actually arrives.
function activeFromY(y) {
  const ref = y + innerHeight * 0.5;
  let idx = 0;
  for (let i = 0; i < tops.length; i++) if (ref >= tops[i]) idx = i;
  return idx;
}

/* ---------- chapter navigation ---------- */

const navLinks = [...document.querySelectorAll('.site-nav a')];
const sideBtns = [...document.querySelectorAll('.side-index a')];
document.querySelectorAll('[data-target]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const i = parseInt(el.dataset.target, 10);
    smooth.to(tops[i] + 2);
    const id = sections[i]?.id;
    if (id) history.replaceState(null, '', `#${id}`);
  });
});

window.addEventListener('hashchange', () => {
  const target = document.getElementById(location.hash.slice(1));
  const i = sections.indexOf(target);
  if (i >= 0) smooth.to(tops[i] + 2);
});

/* ---------- keyboard chapter shortcuts (1–4) ---------- */

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.target instanceof Element && e.target.closest('input, textarea, [contenteditable]')) return;
  const n = parseInt(e.key, 10);
  if (n < 1 || n > 4) return;
  const i = n - 1;
  smooth.to(tops[i] + 2);
  const id = sections[i]?.id;
  if (id) history.replaceState(null, '', `#${id}`);
});

let activeIdx = -1;
const chapterNum = document.getElementById('chapterNum');
const chapterName = document.getElementById('chapterName');
function setActive(i) {
  if (i === activeIdx) return;
  activeIdx = i;
  navLinks.forEach((a, k) => {
    a.classList.toggle('active', k === i);
    if (k === i) a.setAttribute('aria-current', 'location');
    else a.removeAttribute('aria-current');
  });
  sideBtns.forEach((b, k) => {
    b.classList.toggle('active', k === i);
    if (k === i) b.setAttribute('aria-current', 'location');
    else b.removeAttribute('aria-current');
  });
  if (chapterNum) {
    chapterNum.textContent = String(i).padStart(2, '0');
    chapterNum.classList.remove('roll');
    void chapterNum.offsetWidth; // restart the roll animation
    chapterNum.classList.add('roll');
  }
  if (chapterName) {
    chapterName.textContent = sections[i]?.id.toUpperCase() || 'INDEX';
    chapterName.classList.remove('roll');
    void chapterName.offsetWidth;
    chapterName.classList.add('roll');
  }
}

/* ---------- reveal on scroll ---------- */

const io = new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (en.isIntersecting) { en.target.classList.add('in-view'); io.unobserve(en.target); }
  }
}, { threshold: 0.18 });
document.querySelectorAll('[data-reveal]').forEach((el) => io.observe(el));

/* ---------- marquee (duplicate for seamless loop) ---------- */

const marqueeGroup = document.getElementById('marqueeGroup');
if (marqueeGroup) {
  const clone = marqueeGroup.cloneNode(true);
  clone.removeAttribute('id'); // avoid duplicate IDs in the DOM
  marqueeGroup.parentElement.appendChild(clone);
}

/* ---------- per-char splitting (stagger reveals / hover ripple) ---------- */

function splitChars(el, baseDelay, step) {
  let i = 0;
  const wrap = (node) => {
    const frag = document.createDocumentFragment();
    for (const token of node.textContent.split(/(\s+)/)) {
      if (!token) continue;
      if (/^\s+$/.test(token)) { frag.appendChild(document.createTextNode(' ')); continue; }
      // keep each word unbreakable; only the gaps between words may wrap
      const w = document.createElement('span');
      w.className = 'wd';
      for (const c of token) {
        const s = document.createElement('span');
        s.className = 'ch';
        s.textContent = c;
        s.style.setProperty('--cd', `${(baseDelay + i * step).toFixed(3)}s`);
        w.appendChild(s);
        i++;
      }
      frag.appendChild(w);
    }
    node.replaceWith(frag);
  };
  [...el.childNodes].forEach((n) => {
    if (n.nodeType === Node.TEXT_NODE) wrap(n);
    else if (n.nodeType === Node.ELEMENT_NODE && !n.classList.contains('ht-sup') && !n.querySelector('svg')) {
      [...n.childNodes].forEach((cn) => { if (cn.nodeType === Node.TEXT_NODE) wrap(cn); });
    }
  });
  el.classList.add('split');
}

if (!reduced) {
  document.querySelectorAll('.ht-line').forEach((el, li) => splitChars(el, 0.05 + li * 0.16, 0.055));
  document.querySelectorAll('.st-line').forEach((el) => {
    splitChars(el, parseFloat(el.style.getPropertyValue('--d')) || 0, 0.028);
  });
}
// row hover ripple is harmless with reduced motion (disabled in CSS), split always
document.querySelectorAll('.row h3').forEach((el) => splitChars(el, 0, 0.018));

/* ---------- ghost watermark parallax ---------- */

const ghostEls = reduced ? [] : [...document.querySelectorAll('[data-ghost]')];

/* ---------- magnetic buttons (JS drives mag + lift + press on fine pointers) ---------- */

const magState = new Map();
if (finePointer && !reduced) {
  document.querySelectorAll('.btn, .hero-cta').forEach((el) => {
    const st = { mx: 0, my: 0, tx: 0, ty: 0, lift: 0, liftT: 0, press: 1, pressT: 1 };
    magState.set(el, st);
    el.addEventListener('pointerenter', () => { st.liftT = 3; });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      st.tx = clamp((e.clientX - (r.left + r.width / 2)) * 0.22, -10, 10);
      st.ty = clamp((e.clientY - (r.top + r.height / 2)) * 0.26, -8, 8);
    });
    el.addEventListener('pointerleave', () => { st.tx = 0; st.ty = 0; st.liftT = 0; st.pressT = 1; });
    el.addEventListener('pointerdown', () => { st.pressT = 0.96; });
    el.addEventListener('pointerup', () => { st.pressT = 1; });
  });
}

const dotEl = document.querySelector('.c-dot');
const ringEl = document.querySelector('.c-ring');
const cur = { x: innerWidth / 2, y: innerHeight / 2, dx: 0, dy: 0, rx: 0, ry: 0, on: false };
if (finePointer && !reduced) {
  window.addEventListener('pointermove', (e) => {
    cur.x = e.clientX; cur.y = e.clientY;
    if (!cur.on) {
      cur.on = true;
      cur.dx = cur.rx = cur.x; cur.dy = cur.ry = cur.y;
      document.body.classList.add('cursor-on');
    }
  });
  document.addEventListener('mouseover', (e) => {
    document.body.dataset.cursor = e.target.closest('a, button, [data-hover]') ? 'hover' : '';
  });
  // tactile press: ring squeezes while the pointer is down
  window.addEventListener('pointerdown', () => document.body.classList.add('cursor-press'));
  window.addEventListener('pointerup', () => document.body.classList.remove('cursor-press'));
}

/* ---------- external-link hints for assistive tech ---------- */

document.querySelectorAll('a[target="_blank"]').forEach((link) => {
  const hint = document.createElement('span');
  hint.className = 'sr-only';
  hint.textContent = '（在新窗口打开）';
  link.appendChild(hint);
});

/* ---------- pointer-tracked surface light ---------- */

if (finePointer && !reduced) {
  document.querySelectorAll('.row, .cap-card').forEach((el) => {
    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - rect.left}px`);
      el.style.setProperty('--my', `${e.clientY - rect.top}px`);
    });
  });
}

/* ---------- velocity skew ---------- */

const skewEls = [...document.querySelectorAll('[data-skew]')];
let skewCur = 0, skewApplied = 0;

/* ---------- hero parallax / misc ---------- */

const heroInner = document.querySelector('.hero-inner');
const progressBar = document.getElementById('scrollProgress');
let heroFaded = false, heroFadeApplied = '', heroShiftApplied = -1, glowApplied = 1;

/* ============================================================
   THREE.JS — the particle field
   ============================================================ */

const glState = { ok: false };

const CHAPTERS = [
  { rx: 0.18, ry: 0.0, rz: 0.0, z: 4.8, noise: 0.10, mouseF: 1.0, op: 0.9, cb: '#C6FF4A' },   // 00 sphere — acid
  { rx: 0.55, ry: 0.9, rz: -0.14, z: 5.6, noise: 0.16, mouseF: 1.0, op: 0.85, cb: '#9A8CFF' }, // 01 torus knot — violet
  { rx: -1.02, ry: 0.0, rz: 0.06, z: 4.3, noise: 0.09, mouseF: 0.7, op: 0.36, cb: '#6FE3FF' },  // 02 wave field — cyan
  { rx: 0.0, ry: 0.0, rz: 0.0, z: 4.7, noise: 0.035, mouseF: 0.9, op: 0.95, cb: '#C6FF4A' },   // 03 FLYF — acid
];
CHAPTERS.forEach((c) => { c.colB = new THREE.Color(c.cb); });

function buildTargets(count) {
  const p0 = new Float32Array(count * 3);
  const p1 = new Float32Array(count * 3);
  const p2 = new Float32Array(count * 3);
  const p3 = new Float32Array(count * 3);
  const rnd = new Float32Array(count * 4);

  // 00 — fibonacci sphere shell
  const GA = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const th = GA * i;
    const s = 1.55 * (0.92 + Math.random() * 0.16);
    p0[i * 3] = Math.cos(th) * r * s;
    p0[i * 3 + 1] = y * s;
    p0[i * 3 + 2] = Math.sin(th) * r * s;
  }

  // 01 — torus knot (p=2, q=3) with fuzzy tube
  for (let i = 0; i < count; i++) {
    const u = Math.random() * Math.PI * 2;
    const cr = 0.44 * (2 + Math.cos(3 * u));
    const tube = 0.13 * Math.cbrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(2 * Math.random() - 1);
    p1[i * 3] = cr * Math.cos(2 * u) + tube * Math.sin(b) * Math.cos(a);
    p1[i * 3 + 1] = cr * Math.sin(2 * u) + tube * Math.sin(b) * Math.sin(a);
    p1[i * 3 + 2] = 0.52 * Math.sin(3 * u) + tube * Math.cos(b);
  }

  // 02 — undulating field
  for (let i = 0; i < count; i++) {
    const x = (Math.random() - 0.5) * 5.8;
    const z = (Math.random() - 0.5) * 3.6;
    p2[i * 3] = x;
    p2[i * 3 + 1] = Math.sin(x * 1.35) * Math.cos(z * 1.15) * 0.22 + (Math.random() - 0.5) * 0.1;
    p2[i * 3 + 2] = z;
  }

  // 03 — the word FLYF sampled from a canvas
  const pts = sampleText('FLYF');
  for (let i = 0; i < count; i++) {
    const p = pts[i % pts.length];
    p3[i * 3] = p[0] + 0.55 + (Math.random() - 0.5) * 0.03;      // shifted right-low to clear the heading
    p3[i * 3 + 1] = p[1] - 0.22 + (Math.random() - 0.5) * 0.03;
    p3[i * 3 + 2] = (Math.random() - 0.5) * 0.42;
  }

  for (let i = 0; i < count; i++) {
    rnd[i * 4] = Math.random();
    rnd[i * 4 + 1] = Math.random();
    rnd[i * 4 + 2] = Math.random();
    rnd[i * 4 + 3] = Math.random();
  }

  // intro — particles start as a distant star shell and collapse into chapter 00
  const start = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 11 + Math.random() * 9;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    start[i * 3] = r * Math.sin(ph) * Math.cos(th);
    start[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
    start[i * 3 + 2] = r * Math.cos(ph);
  }

  return { p0, p1, p2, p3, rnd, start };
}

function sampleText(str) {
  const cw = 1200, ch = 400;
  const cv = document.createElement('canvas');
  cv.width = cw; cv.height = ch;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  let size = 300;
  cx.font = `900 ${size}px Arial, "Arial Black", sans-serif`;
  const w = cx.measureText(str).width;
  size = Math.floor(size * Math.min((cw * 0.92) / w, (ch * 0.9) / size));
  cx.font = `900 ${size}px Arial, "Arial Black", sans-serif`;
  cx.textAlign = 'center';
  cx.textBaseline = 'middle';
  cx.fillStyle = '#fff';
  cx.fillText(str, cw / 2, ch / 2 + size * 0.05);
  const img = cx.getImageData(0, 0, cw, ch).data;
  const pts = [];
  const worldW = 4.9, worldH = worldW * (ch / cw);
  for (let py = 0; py < ch; py += 3) {
    for (let px = 0; px < cw; px += 3) {
      if (img[(py * cw + px) * 4 + 3] > 128) {
        pts.push([(px / cw - 0.5) * worldW, -(py / ch - 0.5) * worldH]);
      }
    }
  }
  return pts.length ? pts : [[0, 0]];
}

const VERT = /* glsl */ `
attribute vec3 aT1;
attribute vec3 aT2;
attribute vec3 aT3;
attribute vec4 aRand;
attribute vec3 aStart;
uniform float uTime;
uniform float uProg;
uniform float uIntro;
uniform float uNoise;
uniform vec3  uMouse;
uniform float uMouseF;
uniform float uSwirl;
uniform float uSize;
varying float vMix;
varying float vFade;
varying float vTw;

vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

void main(){
  float s1 = smoothstep(0.0, 1.0, clamp(uProg,       0.0, 1.0));
  float s2 = smoothstep(0.0, 1.0, clamp(uProg - 1.0, 0.0, 1.0));
  float s3 = smoothstep(0.0, 1.0, clamp(uProg - 2.0, 0.0, 1.0));

  vec3 base = mix(aStart, position, uIntro);
  vec3 pos = mix(base, aT1, s1);
  pos = mix(pos, aT2, s2);
  pos = mix(pos, aT3, s3);

  // turbulence — swells during morph transitions
  float trans = s1*(1.0-s1) + s2*(1.0-s2) + s3*(1.0-s3);
  float amp = uNoise * (1.0 + trans * 9.0);
  float t = uTime * (0.22 + aRand.z * 0.18);
  vec3 n = vec3(
    snoise(pos * 0.85 + vec3(t, 0.0, aRand.y * 7.1)),
    snoise(pos * 0.85 + vec3(0.0, t + 13.7, aRand.y * 3.3)),
    snoise(pos * 0.85 + vec3(t * 0.7, aRand.y * 5.2, 0.0))
  );
  pos += n * amp;

  // rolling swell for the wave chapter
  float waveW = s2 * (1.0 - s3);
  pos.y += waveW * sin(pos.x * 2.1 + uTime * 1.1) * cos(pos.z * 1.7 + uTime * 0.8) * 0.24;

  // cursor repulsion + orbital swirl in world space
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vec3 dm = wp.xyz - uMouse;
  float dl = length(dm);
  float f = smoothstep(0.95, 0.0, dl) * uMouseF;
  vec3 dn = dm / max(dl, 0.0001);
  vec3 sw = cross(vec3(0.0, 0.0, 1.0), dn);
  wp.xyz += (dn * 0.34 + sw * 0.26 * uSwirl) * f;

  vec4 mv = viewMatrix * wp;
  gl_Position = projectionMatrix * mv;

  float dist = max(0.1, -mv.z);
  gl_PointSize = uSize * (0.55 + aRand.x * 1.15) * (4.2 / dist);

  vMix = smoothstep(0.82, 0.96, aRand.w);
  vFade = smoothstep(9.5, 3.4, dist);
  vTw = 0.55 + 0.45 * sin(uTime * 2.0 + aRand.y * 43.0);
}
`;

const FRAG = /* glsl */ `
uniform vec3 uColA;
uniform vec3 uColB;
uniform float uOpacity;
varying float vMix;
varying float vFade;
varying float vTw;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float disc = smoothstep(0.5, 0.14, d);
  if (disc < 0.02) discard;
  vec3 col = mix(uColA, uColB, vMix);
  gl_FragColor = vec4(col, disc * vFade * vTw * uOpacity);
}
`;

let renderer, scene, camera, points, uni;
let progT = 0, progC = 0, glTime = 0, introT = reduced ? 1 : 0;
let lastRenderSig = '';
let firstFrameDone = false; // real readiness signal for the preloader
let hasPointer = false;
const mouseW = new THREE.Vector3(999, 999, 0); // repulsion parked off-field until first pointer move
const mouseT = new THREE.Vector3(0, 0, 0);
let halfW = 1, halfH = 1;

function initGL() {
  const canvas = document.getElementById('gl');
  renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  const dpr = clamp(devicePixelRatio || 1, 1, 1.75);
  renderer.setPixelRatio(dpr);
  renderer.setSize(innerWidth, innerHeight);
  renderer.setClearColor(0x000000, 0);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 0.1, 30);
  camera.position.z = CHAPTERS[0].z;

  const small = Math.min(innerWidth, innerHeight) < 720 || !finePointer;
  const COUNT = small ? 26000 : 70000;
  const { p0, p1, p2, p3, rnd, start } = buildTargets(COUNT);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p0, 3));
  geo.setAttribute('aT1', new THREE.BufferAttribute(p1, 3));
  geo.setAttribute('aT2', new THREE.BufferAttribute(p2, 3));
  geo.setAttribute('aT3', new THREE.BufferAttribute(p3, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));
  geo.setAttribute('aStart', new THREE.BufferAttribute(start, 3));

  uni = {
    uTime: { value: 0 },
    uProg: { value: 0 },
    uIntro: { value: reduced ? 1 : 0 },
    uNoise: { value: CHAPTERS[0].noise },
    uMouse: { value: mouseW },
    uMouseF: { value: finePointer ? 1 : 0 },
    uSwirl: { value: reduced ? 0 : 1 },
    uSize: { value: (small ? 5.2 : 4.1) * dpr },
    uColA: { value: new THREE.Color('#EDEAE2') },
    uColB: { value: new THREE.Color(CHAPTERS[0].cb) },
    uOpacity: { value: 0.9 },
  };

  const mat = new THREE.ShaderMaterial({
    uniforms: uni,
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });

  points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  computeHalfExtents();
  glState.ok = true;

  const statEl = document.getElementById('statParticles');
  if (statEl) statEl.textContent = COUNT.toLocaleString('en-US');
}

function computeHalfExtents() {
  halfH = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z;
  halfW = halfH * camera.aspect;
}

if (finePointer) {
  window.addEventListener('pointermove', (e) => {
    hasPointer = true;
    mouseT.x = (e.clientX / innerWidth) * 2 - 1;
    mouseT.y = -((e.clientY / innerHeight) * 2 - 1);
  });
}

function renderGL(dt) {
  if (!glState.ok) return;
  if (!reduced) glTime += dt;
  progC = reduced ? progT : damp(progC, progT, 4.5, dt);

  // reduced motion: nothing animates on its own — only redraw when scroll progress changes
  if (reduced) {
    const sig = `${progC.toFixed(4)}|${innerWidth}x${innerHeight}`;
    if (sig === lastRenderSig) return;
    lastRenderSig = sig;
  }

  // big-bang intro: collapse the star shell once the preloader lifts
  if (introT < 1 && document.body.classList.contains('is-loaded')) {
    introT = Math.min(1, introT + dt / 1.7);
  }
  const introEase = 1 - Math.pow(1 - introT, 3);
  uni.uIntro.value = introEase;

  const i = clamp(Math.floor(progC), 0, 2);
  const f = progC - i;
  const sf = f * f * (3 - 2 * f);
  const A = CHAPTERS[i], B = CHAPTERS[i + 1];

  const textW = clamp(progC - 2.2, 0, 0.8) / 0.8; // keep FLYF stable & readable
  const idle = Math.sin(glTime * 0.1) * 0.14 * (1 - textW);

  points.rotation.set(
    lerp(A.rx, B.rx, sf),
    lerp(A.ry, B.ry, sf) + idle + (1 - introEase) * 0.55,
    lerp(A.rz, B.rz, sf)
  );
  const zoomOut = camera.aspect < 0.8 ? 1.45 : 1; // portrait: pull back so shapes fit the narrow view
  camera.position.z = lerp(A.z, B.z, sf) * zoomOut + (1 - introEase) * 2.4;
  camera.position.x = damp(camera.position.x, mouseT.x * 0.22, 3, dt);
  camera.position.y = damp(camera.position.y, mouseT.y * 0.16, 3, dt);
  camera.lookAt(0, 0, 0);

  uni.uNoise.value = lerp(A.noise, B.noise, sf) * (reduced ? 0.5 : 1);
  uni.uOpacity.value = lerp(A.op, B.op, sf);
  uni.uMouseF.value = finePointer && !reduced ? lerp(A.mouseF, B.mouseF, sf) : 0;
  uni.uColB.value.lerpColors(A.colB, B.colB, sf);
  uni.uProg.value = progC;
  uni.uTime.value = glTime;

  computeHalfExtents();
  if (hasPointer) {
    mouseW.x = damp(mouseW.x, mouseT.x * halfW, 5, dt);
    mouseW.y = damp(mouseW.y, mouseT.y * halfH, 5, dt);
  }

  renderer.render(scene, camera);
  firstFrameDone = true;
}

try {
  initGL();
} catch (err) {
  document.body.classList.add('no-webgl');
  firstFrameDone = true; // nothing will render, don't hold the preloader hostage
  console.warn('WebGL unavailable:', err);
}

// debug handle (harmless in production)
window.__FLYF__ = {
  glState,
  get prog() { return progC; },
  get renderCalls() { return renderer ? renderer.info.render.calls : -1; },
  get frame() { return renderer ? renderer.info.render.frame : -1; },
  get intro() { return uni ? uni.uIntro.value : -1; },
  get colB() { return uni ? uni.uColB.value.getHexString() : null; },
};

/* ---------- preloader ---------- */

const preCount = document.getElementById('preCount');
const preBar = document.getElementById('preBar');
const prePhase = document.getElementById('prePhase');
// First visit gets the full intro; repeat visits in the same session fast-forward.
let seenBefore = false;
try { seenBefore = sessionStorage.getItem('flyf-seen') === '1'; } catch { /* storage blocked */ }
const MIN_MS = reduced ? 200 : seenBefore ? 550 : 1700;
const loadStart = performance.now();

// The counter reports real boot milestones, never a simulated percentage:
// 35 = GL booted, +35 = fonts settled, +30 = first frame drawn (or GL unavailable → static).
let fontsDone = false;
fontsSettled.then(() => { fontsDone = true; });

function bootMarks() {
  const pct = 35 + (fontsDone ? 35 : 0) + (firstFrameDone ? 30 : 0);
  return { pct, glFailed: !glState.ok };
}

function phaseLabel(glFailed) {
  if (glFailed) return 'WEBGL UNAVAILABLE · STATIC MODE<br>粒子场不可用，改为静态展示';
  if (!fontsDone) return 'LOADING FONTS<br>加载字体';
  if (!firstFrameDone) return 'BUILDING PARTICLE FIELD<br>构建粒子场';
  return 'READY<br>就绪';
}

let phaseApplied = '';
function loaderTick() {
  const { pct, glFailed } = bootMarks();
  const phase = phaseLabel(glFailed);
  if (phase !== phaseApplied) { prePhase.innerHTML = phase; phaseApplied = phase; }
  preCount.textContent = String(pct).padStart(2, '0');
  preBar.style.transform = `scaleX(${pct / 100})`;
  if (pct < 100 || performance.now() - loadStart < MIN_MS) { requestAnimationFrame(loaderTick); return; }
  try { sessionStorage.setItem('flyf-seen', '1'); } catch { /* storage blocked */ }
  clearTimeout(window.__flyfBootFallback);
  document.body.classList.add('is-loaded');
  measureSections();
  smooth.measure();
  if (initialTarget) {
    const i = sections.indexOf(initialTarget);
    if (i >= 0) {
      window.scrollTo(0, tops[i]);
      smooth.t = smooth.c = tops[i];
    }
  }
}
requestAnimationFrame(loaderTick);

/* ---------- main loop ---------- */

let last = performance.now();
let rafId = 0;

function frame(now) {
  rafId = requestAnimationFrame(frame);
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;

  const y = smooth.update(dt);
  const vel = smooth.enabled ? (smooth.t - smooth.c) : 0;

  progT = progressFromY(y);
  setActive(activeFromY(y));
  document.body.classList.toggle('scrolled', y > 80);
  if (progressBar) {
    progressBar.style.transform = `scaleX(${clamp(y / smooth.max, 0, 1)})`;
    if (!reduced) {
      // scroll velocity makes the progress line flare up, then settle
      const b = 1 + Math.min(Math.abs(vel) * 0.008, 1.6);
      if (Math.abs(b - glowApplied) > 0.03 || (b === 1 && glowApplied !== 1)) { progressBar.style.filter = `brightness(${b.toFixed(2)})`; glowApplied = b; }
    }
  }

  if (!reduced) {
    // velocity skew on big type — write only while actually skewing
    const target = clamp(vel * 0.0032, -3, 3);
    skewCur = damp(skewCur, target, 8, dt);
    const sk = Math.abs(skewCur) < 0.01 ? 0 : skewCur;
    if (sk !== 0 || skewApplied !== 0) {
      for (const el of skewEls) el.style.transform = `skewY(${sk}deg)`;
      skewApplied = sk;
    }
    // hero parallax + early fade so it never ghosts into the next chapter
    if (heroInner) {
      const fade = clamp(1 - Math.max(0, y - innerHeight * 0.03) / (innerHeight * 0.48), 0, 1);
      const faded = fade <= 0.01;
      const fadeStr = fade === 1 ? '' : fade.toFixed(3);
      if (fadeStr !== heroFadeApplied) { heroInner.style.opacity = fadeStr; heroFadeApplied = fadeStr; }
      heroInner.classList.toggle('is-faded', faded);
      if (faded !== heroFaded) {
        heroFaded = faded;
        heroInner.querySelectorAll('a, button').forEach((el) => { el.tabIndex = faded ? -1 : 0; });
      }
      if (y < innerHeight * 1.2) {
        const ty = Math.round(y * 22) / 100;
        if (ty !== heroShiftApplied) { heroInner.style.transform = `translate3d(0, ${ty}px, 0)`; heroShiftApplied = ty; }
      }
    }
    // ghost watermark parallax — drifts against scroll for depth
    for (const g of ghostEls) {
      const r = g.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) continue;
      const rel = (r.top + r.height / 2 - innerHeight / 2) / innerHeight;
      g.style.transform = `translate3d(0, ${(rel * -110).toFixed(1)}px, 0)`;
    }
    // magnetic buttons — compose the whole transform in JS so it truly tracks
    for (const [el, st] of magState) {
      st.mx = damp(st.mx, st.tx, 18, dt);
      st.my = damp(st.my, st.ty, 18, dt);
      st.lift = damp(st.lift, st.liftT, 12, dt);
      st.press = damp(st.press, st.pressT, 16, dt);
      const engaged = Math.abs(st.mx) > 0.05 || Math.abs(st.my) > 0.05 || st.lift > 0.05 ||
        Math.abs(st.press - 1) > 0.002 || st.tx !== 0 || st.ty !== 0 || st.liftT !== 0 || st.pressT !== 1;
      if (engaged) {
        el.style.transform = `translate(${st.mx.toFixed(2)}px, ${st.my.toFixed(2)}px) translateY(${(-st.lift).toFixed(2)}px) scale(${st.press.toFixed(3)})`;
      } else if (el.style.transform) {
        el.style.transform = '';
      }
    }
    // cursor
    if (cur.on) {
      cur.dx = damp(cur.dx, cur.x, 30, dt);
      cur.dy = damp(cur.dy, cur.y, 30, dt);
      cur.rx = damp(cur.rx, cur.x, 12, dt);
      cur.ry = damp(cur.ry, cur.y, 12, dt);
      dotEl.style.transform = `translate(${cur.dx - 3}px, ${cur.dy - 3}px)`;
      ringEl.style.transform = `translate(${cur.rx}px, ${cur.ry}px) translate(-50%, -50%)`;
    }
  }

  renderGL(dt);
}
rafId = requestAnimationFrame(frame);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    cancelAnimationFrame(rafId);
    clearInterval(clockTimer);
  } else {
    last = performance.now();
    rafId = requestAnimationFrame(frame);
    tickClock();
    clockTimer = setInterval(tickClock, 1000);
  }
});

/* ---------- resize ---------- */

let resizeT = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeT);
  resizeT = setTimeout(() => {
    measureSections();
    smooth.measure();
    if (glState.ok) {
      camera.aspect = innerWidth / innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight);
      computeHalfExtents();
    }
  }, 120);
});
