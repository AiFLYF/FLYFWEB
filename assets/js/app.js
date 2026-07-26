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

history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

if (window.lucide) window.lucide.createIcons();

/* ---------- clock ---------- */

const clockEl = document.getElementById('clock');
const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const tickClock = () => { clockEl.textContent = fmt.format(new Date()); };
tickClock();
setInterval(tickClock, 1000);

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
    window.scrollTo(0, this.c);
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

/* ---------- chapter navigation ---------- */

const navLinks = [...document.querySelectorAll('.site-nav a')];
const sideBtns = [...document.querySelectorAll('.side-index button')];
document.querySelectorAll('[data-target]').forEach((el) => {
  el.addEventListener('click', (e) => {
    e.preventDefault();
    const i = parseInt(el.dataset.target, 10);
    smooth.to(tops[i] + 2);
  });
});

let activeIdx = -1;
function setActive(i) {
  if (i === activeIdx) return;
  activeIdx = i;
  navLinks.forEach((a, k) => a.classList.toggle('active', k === i));
  sideBtns.forEach((b, k) => b.classList.toggle('active', k === i));
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
  marqueeGroup.parentElement.appendChild(marqueeGroup.cloneNode(true));
  if (window.lucide) window.lucide.createIcons();
}

/* ---------- custom cursor ---------- */

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
}

/* ---------- velocity skew ---------- */

const skewEls = [...document.querySelectorAll('[data-skew]')];
let skewCur = 0;

/* ---------- hero parallax / misc ---------- */

const heroInner = document.querySelector('.hero-inner');

/* ============================================================
   THREE.JS — the particle field
   ============================================================ */

const glState = { ok: false };

const CHAPTERS = [
  { rx: 0.18, ry: 0.0, rz: 0.0, z: 4.8, noise: 0.10, mouseF: 1.0, op: 0.9 },   // 00 sphere
  { rx: 0.55, ry: 0.9, rz: -0.14, z: 5.6, noise: 0.16, mouseF: 1.0, op: 0.85 }, // 01 torus knot
  { rx: -1.02, ry: 0.0, rz: 0.06, z: 4.3, noise: 0.10, mouseF: 0.7, op: 0.58 },  // 02 wave field
  { rx: 0.0, ry: 0.0, rz: 0.0, z: 4.7, noise: 0.035, mouseF: 0.9, op: 0.95 },   // 03 FLYF
];

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
  return { p0, p1, p2, p3, rnd };
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
uniform float uTime;
uniform float uProg;
uniform float uNoise;
uniform vec3  uMouse;
uniform float uMouseF;
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

  vec3 pos = mix(position, aT1, s1);
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

  // cursor repulsion in world space
  vec4 wp = modelMatrix * vec4(pos, 1.0);
  vec3 dm = wp.xyz - uMouse;
  float f = smoothstep(0.95, 0.0, length(dm)) * uMouseF;
  wp.xyz += normalize(dm + 0.0001) * f * 0.34;

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
let progT = 0, progC = 0, glTime = 0;
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
  const { p0, p1, p2, p3, rnd } = buildTargets(COUNT);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(p0, 3));
  geo.setAttribute('aT1', new THREE.BufferAttribute(p1, 3));
  geo.setAttribute('aT2', new THREE.BufferAttribute(p2, 3));
  geo.setAttribute('aT3', new THREE.BufferAttribute(p3, 3));
  geo.setAttribute('aRand', new THREE.BufferAttribute(rnd, 4));

  uni = {
    uTime: { value: 0 },
    uProg: { value: 0 },
    uNoise: { value: CHAPTERS[0].noise },
    uMouse: { value: mouseW },
    uMouseF: { value: finePointer ? 1 : 0 },
    uSize: { value: (small ? 5.2 : 4.1) * dpr },
    uColA: { value: new THREE.Color('#EDEAE2') },
    uColB: { value: new THREE.Color('#C6FF4A') },
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
  glTime += dt;
  progC = damp(progC, progT, 4.5, dt);

  const i = clamp(Math.floor(progC), 0, 2);
  const f = progC - i;
  const sf = f * f * (3 - 2 * f);
  const A = CHAPTERS[i], B = CHAPTERS[i + 1];

  const textW = clamp(progC - 2.2, 0, 0.8) / 0.8; // keep FLYF stable & readable
  const idle = Math.sin(glTime * 0.1) * 0.14 * (1 - textW);

  points.rotation.set(
    lerp(A.rx, B.rx, sf),
    lerp(A.ry, B.ry, sf) + idle,
    lerp(A.rz, B.rz, sf)
  );
  const zoomOut = camera.aspect < 0.8 ? 1.45 : 1; // portrait: pull back so shapes fit the narrow view
  camera.position.z = lerp(A.z, B.z, sf) * zoomOut;
  camera.position.x = damp(camera.position.x, mouseT.x * 0.22, 3, dt);
  camera.position.y = damp(camera.position.y, mouseT.y * 0.16, 3, dt);
  camera.lookAt(0, 0, 0);

  uni.uNoise.value = lerp(A.noise, B.noise, sf) * (reduced ? 0.5 : 1);
  uni.uOpacity.value = lerp(A.op, B.op, sf);
  uni.uMouseF.value = finePointer ? lerp(A.mouseF, B.mouseF, sf) : 0;
  uni.uProg.value = progC;
  uni.uTime.value = glTime;

  computeHalfExtents();
  if (hasPointer) {
    mouseW.x = damp(mouseW.x, mouseT.x * halfW, 5, dt);
    mouseW.y = damp(mouseW.y, mouseT.y * halfH, 5, dt);
  }

  renderer.render(scene, camera);
}

try {
  initGL();
} catch (err) {
  document.body.classList.add('no-webgl');
  console.warn('WebGL unavailable:', err);
}

// debug handle (harmless in production)
window.__FLYF__ = {
  glState,
  get prog() { return progC; },
  get renderCalls() { return renderer ? renderer.info.render.calls : -1; },
  get frame() { return renderer ? renderer.info.render.frame : -1; },
};

/* ---------- preloader ---------- */

const preCount = document.getElementById('preCount');
const preBar = document.getElementById('preBar');
const LOAD_MS = reduced ? 200 : 1700;
const loadStart = performance.now();
let loaderDone = false;

function loaderTick(now) {
  const p = clamp((now - loadStart) / LOAD_MS, 0, 1);
  const eased = 1 - Math.pow(1 - p, 3);
  preCount.textContent = String(Math.floor(eased * 100)).padStart(2, '0');
  preBar.style.transform = `scaleX(${eased})`;
  if (p < 1) { requestAnimationFrame(loaderTick); return; }
  Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2200))]).then(() => {
    loaderDone = true;
    document.body.classList.add('is-loaded');
    measureSections();
    smooth.measure();
  });
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
  setActive(clamp(Math.round(progressFromY(y + innerHeight * 0.25)), 0, 3));
  document.body.classList.toggle('scrolled', y > 80);

  if (!reduced) {
    // velocity skew on big type
    const target = clamp(vel * 0.0032, -3, 3);
    skewCur = damp(skewCur, target, 8, dt);
    const sk = Math.abs(skewCur) < 0.01 ? 0 : skewCur;
    for (const el of skewEls) el.style.transform = `skewY(${sk}deg)`;
    // hero parallax
    if (heroInner && y < innerHeight * 1.2) {
      heroInner.style.transform = `translate3d(0, ${y * 0.22}px, 0)`;
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
  } else {
    last = performance.now();
    rafId = requestAnimationFrame(frame);
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
