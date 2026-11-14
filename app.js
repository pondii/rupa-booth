'use strict';

/* =====================================================================
   Photo Booth (web clone) — multi-window, WebGL effects, Dock,
   Wallpaper app, Desktop screenshot
   ===================================================================== */

const $ = (s, root = document) => root.querySelector(s);

// Shared hidden <video> that receives the camera stream (kept in DOM for Safari).
const video = document.createElement('video');
video.playsInline = true;
video.muted = true;
video.autoplay = true;
Object.assign(video.style, { position: 'absolute', width: '1px', height: '1px', opacity: 0, pointerEvents: 'none' });
document.body.appendChild(video);

/* ---------------------------- Effects ---------------------------- */
const EFFECTS = [
  // Page 1 — filters
  { id: 'normal',  name: 'Normal',         fx: 0 },
  { id: 'sepia',   name: 'Sepia',          fx: 1 },
  { id: 'bw',      name: 'Black & White',  fx: 2 },
  { id: 'glow',    name: 'Glow',           fx: 3 },
  { id: 'pencil',  name: 'Colored Pencil', fx: 4 },
  { id: 'thermal', name: 'Thermal Camera', fx: 5 },
  { id: 'xray',    name: 'X-Ray',          fx: 6 },
  { id: 'pop',     name: 'Pop Art',        fx: 7 },
  { id: 'comic',   name: 'Comic Book',     fx: 8 },
  // Page 2 — distortions
  { id: 'bulge',   name: 'Bulge',          fx: 9 },
  { id: 'dent',    name: 'Dent',           fx: 10 },
  { id: 'twirl',   name: 'Twirl',          fx: 11 },
  { id: 'squeeze', name: 'Squeeze',        fx: 12 },
  { id: 'mirror',  name: 'Mirror',         fx: 13 },
  { id: 'tunnel',  name: 'Light Tunnel',   fx: 14 },
  { id: 'fisheye', name: 'Fisheye',        fx: 15 },
  { id: 'stretch', name: 'Stretch',        fx: 16 },
  // Page 3 — more looks
  { id: 'kaleido', name: 'Kaleidoscope',   fx: 17 },
  { id: 'vintage', name: 'Vintage',        fx: 18 },
  { id: 'dreamy',  name: 'Dreamy',         fx: 19 },
  { id: 'pixel',   name: 'Pixelate',       fx: 20 },
  { id: 'negative',name: 'Negative',       fx: 21 },
  { id: 'duotone', name: 'Duotone',        fx: 22 },
  { id: 'neon',    name: 'Neon Edges',     fx: 23 },
  { id: 'halftone',name: 'Halftone',       fx: 24 },
];
const effectById = (id) => EFFECTS.find((e) => e.id === id) || EFFECTS[0];

const PAGES = [
  ['sepia', 'bw', 'glow', 'pencil', 'thermal', 'xray', 'pop', 'comic'],
  ['bulge', 'dent', 'twirl', 'squeeze', 'mirror', 'tunnel', 'fisheye', 'stretch'],
  ['kaleido', 'vintage', 'dreamy', 'pixel', 'negative', 'duotone', 'neon', 'halftone'],
];
const pageOf = (id) => PAGES.findIndex((p) => p.includes(id));

/* ---------------------------- Shared State ---------------------------- */
const appEl = $('#app');
const windowsEl = $('#windows');
const winTpl = $('#winTpl');
const dock = $('#dock');
const dockApp = $('#dockApp');
const dockWall = $('#dockWall');
const dockFiles = $('#dockFiles');
const dockSettings = $('#dockSettings');
const dockShot = $('#dockShot');
const dockDivider = $('#dockDivider');
const dockMin = $('#dockMin');

const windows = [];
let focusedWin = null;
let focusedEl = null;
let topZ = 10;
let winSeq = 0;
let cameraAR = 16 / 9;

let camStream = null;
let micStream = null;
let cameraMsg = null;
let sharedItems = [];
const PAGE_SESSION = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ----------------------------- Camera ----------------------------- */
function setCameraMessage(text) {
  cameraMsg = text;
  for (const w of windows) w.showMessage(text);
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return setCameraMessage('Camera access is not available in this browser.\nUse https:// or http://localhost.');
  }
  try {
    camStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      audio: false,
    });
    video.srcObject = camStream;
    await video.play();
    setCameraMessage(null);
  } catch (err) {
    console.error(err);
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    setCameraMessage(denied
      ? 'Photo Booth needs camera access.\nAllow the camera for this page in your browser, then reload.'
      : 'No camera found.\nConnect a camera and reload the page.');
  }
}

/* ---------------------------- Rendering (WebGL effects) ---------------------------- */
const VERT_SRC = `
attribute vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`;

const FRAG_SRC = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D uTex;
uniform vec2 uRes;
uniform vec2 uTexel;
uniform float uTime;
uniform int uFx;

vec3 S(vec2 uv) { return texture2D(uTex, clamp(uv, 0.001, 0.999)).rgb; }
float L(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
vec3 pal3(float t, vec3 a, vec3 b, vec3 c) {
  return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, (t - 0.5) * 2.0);
}

float edge(vec2 uv, float k) {
  vec2 t = uTexel * k;
  float tl = L(S(uv + vec2(-t.x, -t.y))), tc = L(S(uv + vec2(0.0, -t.y))), tr = L(S(uv + vec2(t.x, -t.y)));
  float ml = L(S(uv + vec2(-t.x, 0.0))),                                   mr = L(S(uv + vec2(t.x, 0.0)));
  float bl = L(S(uv + vec2(-t.x, t.y))),  bc = L(S(uv + vec2(0.0, t.y))),  br = L(S(uv + vec2(t.x, t.y)));
  float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
  float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
  return length(vec2(gx, gy));
}

vec3 blur(vec2 uv, float r) {
  float rx = r * uRes.y / uRes.x;
  vec3 s = S(uv);
  float tot = 1.0;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5235988;
    vec2 d = vec2(cos(a) * rx, sin(a) * r);
    s += S(uv + d) + S(uv + d * 0.5);
    tot += 2.0;
  }
  return s / tot;
}

vec3 thermal(float t) {
  vec3 c0 = vec3(0.0, 0.0, 0.35), c1 = vec3(0.45, 0.0, 0.75), c2 = vec3(1.0, 0.1, 0.1),
       c3 = vec3(1.0, 0.9, 0.1),  c4 = vec3(1.0, 1.0, 0.9);
  if (t < 0.25) return mix(c0, c1, t / 0.25);
  if (t < 0.5)  return mix(c1, c2, (t - 0.25) / 0.25);
  if (t < 0.75) return mix(c2, c3, (t - 0.5) / 0.25);
  return mix(c3, c4, (t - 0.75) / 0.25);
}

void main() {
  vec2 uv = vec2(gl_FragCoord.x / uRes.x, 1.0 - gl_FragCoord.y / uRes.y);
  float asp = uRes.x / uRes.y;
  uv.x = 1.0 - uv.x;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float d = length(p);
  float vig = 1.0;
  int fx = uFx;

  if (fx == 9) {
    float r = 0.5;
    if (d < r) { p *= pow(max(d / r, 0.0001), 0.7); }
    uv = p / vec2(asp, 1.0) + 0.5;
  } else if (fx == 10) {
    float r = 0.5;
    if (d < r) { p *= pow(max(d / r, 0.0001), -0.4); }
    uv = p / vec2(asp, 1.0) + 0.5;
  } else if (fx == 11) {
    float r = 0.55;
    if (d < r) {
      float a = 3.4 * pow(1.0 - d / r, 2.0);
      float cs = cos(a), sn = sin(a);
      p = vec2(p.x * cs - p.y * sn, p.x * sn + p.y * cs);
    }
    uv = p / vec2(asp, 1.0) + 0.5;
  } else if (fx == 12) {
    float g = exp(-d * d / (2.0 * 0.2 * 0.2));
    p.x *= 1.0 + 1.5 * g;
    uv = p / vec2(asp, 1.0) + 0.5;
  } else if (fx == 16) {
    float g = exp(-d * d / (2.0 * 0.22 * 0.22));
    p.x *= 1.0 - 0.6 * g;
    uv = p / vec2(asp, 1.0) + 0.5;
  } else if (fx == 15) {
    vec2 pp = p * 2.0;
    p *= 0.55 + 0.45 * dot(pp, pp);
    uv = p / vec2(asp, 1.0) + 0.5;
    if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) vig = 0.0;
  } else if (fx == 13) {
    if (uv.x > 0.5) uv.x = 1.0 - uv.x;
  } else if (fx == 17) {
    vec2 k = abs(uv - 0.5) * 2.0;
    uv = 0.25 + 0.5 * (1.0 - k);
  } else if (fx == 20) {
    vec2 g = vec2(46.0 * asp, 46.0);
    uv = (floor(uv * g) + 0.5) / g;
  }

  vec3 c = S(uv);
  vec3 col = c;

  if (fx == 1) {
    col = vec3(dot(c, vec3(0.393, 0.769, 0.189)), dot(c, vec3(0.349, 0.686, 0.168)), dot(c, vec3(0.272, 0.534, 0.131)));
  } else if (fx == 2) {
    float g = (L(c) - 0.5) * 1.15 + 0.5;
    col = vec3(g);
  } else if (fx == 3) {
    vec3 b = blur(uv, 0.014);
    col = vec3(1.0) - (vec3(1.0) - c) * (vec3(1.0) - b * 1.25);
    col = col * 1.04 + 0.03;
  } else if (fx == 4) {
    float e = edge(uv, 1.6);
    vec3 base = floor(c * 6.0 + 0.5) / 6.0;
    vec3 paper = mix(vec3(0.97, 0.95, 0.9), base, 0.7);
    col = paper - vec3(smoothstep(0.12, 0.6, e)) * 0.85;
    col += (hash(uv * uRes) - 0.5) * 0.05;
  } else if (fx == 5) {
    col = thermal(clamp((L(c) - 0.1) * 1.25, 0.0, 1.0));
  } else if (fx == 6) {
    float l = 1.0 - L(c);
    l = clamp((l - 0.5) * 1.7 + 0.5, 0.0, 1.0);
    col = vec3(l * 0.78, l * 0.93, l * 1.08);
  } else if (fx == 7) {
    vec2 qi = floor(uv * 2.0);
    float idx = qi.x + 2.0 * qi.y;
    float t = floor(L(S(fract(uv * 2.0))) * 3.0) / 2.0;
    t = clamp(t, 0.0, 1.0);
    if (idx < 0.5)      col = pal3(t, vec3(0.10, 0.00, 0.35), vec3(0.90, 0.10, 0.50), vec3(1.00, 0.90, 0.20));
    else if (idx < 1.5) col = pal3(t, vec3(0.00, 0.20, 0.40), vec3(0.10, 0.70, 0.80), vec3(1.00, 0.95, 0.60));
    else if (idx < 2.5) col = pal3(t, vec3(0.30, 0.00, 0.10), vec3(1.00, 0.40, 0.10), vec3(1.00, 0.95, 0.50));
    else                col = pal3(t, vec3(0.00, 0.25, 0.15), vec3(0.20, 0.80, 0.40), vec3(0.95, 1.00, 0.70));
  } else if (fx == 8) {
    float e = edge(uv, 1.2);
    vec3 q = floor(c * 4.0 + 0.5) / 4.0;
    q = mix(vec3(L(q)), q, 1.5);
    col = q * (1.0 - smoothstep(0.2, 0.5, e));
  } else if (fx == 14) {
    float a = atan(p.y, p.x) / 3.14159265;
    float v = 0.18 / (d + 0.03) + uTime * 0.2;
    vec2 tuv = vec2(abs(a), abs(fract(v * 0.5) * 2.0 - 1.0));
    col = S(tuv);
    col += (1.0 - smoothstep(0.0, 0.3, d)) * vec3(1.0, 0.95, 0.8) * 0.85;
    col *= mix(0.55, 1.0, smoothstep(0.0, 0.5, d + 0.15));
  } else if (fx == 18) {
    vec3 s = vec3(dot(c, vec3(0.393, 0.769, 0.189)), dot(c, vec3(0.349, 0.686, 0.168)), dot(c, vec3(0.272, 0.534, 0.131)));
    col = mix(c, s, 0.55);
    col = (col - 0.5) * 1.1 + 0.5;
    col *= 0.92;
    col *= 1.0 - 0.55 * smoothstep(0.3, 0.85, length((uv - 0.5) * vec2(asp, 1.0)));
    col += (hash(uv * uRes + uTime) - 0.5) * 0.06;
  } else if (fx == 19) {
    vec3 b = blur(uv, 0.011);
    col = mix(c, b, 0.7) * 1.1 + 0.04;
    col = mix(vec3(L(col)), col, 1.3);
  } else if (fx == 21) {
    col = 1.0 - c;
  } else if (fx == 22) {
    col = pal3(clamp(L(c), 0.0, 1.0), vec3(0.10, 0.00, 0.35), vec3(0.90, 0.20, 0.50), vec3(1.00, 0.85, 0.40));
  } else if (fx == 23) {
    float e = edge(uv, 1.0);
    vec3 hue = 0.5 + 0.5 * cos(6.2831853 * (uv.x + uTime * 0.1) + vec3(0.0, 2.0, 4.0));
    col = vec3(0.02, 0.0, 0.06) + hue * smoothstep(0.1, 0.5, e) * 1.6 + c * 0.08;
  } else if (fx == 24) {
    float ca = cos(0.6), sa = sin(0.6);
    vec2 pos = vec2(uv.x * asp, uv.y) * 70.0;
    pos = vec2(pos.x * ca - pos.y * sa, pos.x * sa + pos.y * ca);
    float dist = length(fract(pos) - 0.5);
    float rad = sqrt(L(c)) * 0.72;
    float m = smoothstep(rad + 0.06, rad - 0.06, dist);
    col = mix(vec3(0.06), c * 1.2, m);
  }

  gl_FragColor = vec4(clamp(col, 0.0, 1.0) * vig, 1.0);
}`;

const FX = { ok: false, gl: null, canvas: null, u: {} };
const T0 = performance.now();

function initFX() {
  try {
    const c = document.createElement('canvas');
    c.width = 2; c.height = 2;
    const gl = c.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false }) ||
               c.getContext('experimental-webgl');
    if (!gl) return;
    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT_SRC));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
    gl.useProgram(prog);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    FX.u = {
      tex: gl.getUniformLocation(prog, 'uTex'),
      res: gl.getUniformLocation(prog, 'uRes'),
      texel: gl.getUniformLocation(prog, 'uTexel'),
      time: gl.getUniformLocation(prog, 'uTime'),
      fx: gl.getUniformLocation(prog, 'uFx'),
    };
    gl.uniform1i(FX.u.tex, 0);
    FX.gl = gl; FX.canvas = c; FX.ok = true;
  } catch (err) {
    console.warn('WebGL effects unavailable:', err);
    FX.ok = false;
  }
}

function uploadFrame() {
  if (!FX.ok || video.readyState < 2 || !video.videoWidth) return;
  const { gl, canvas: c } = FX;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (c.width !== vw || c.height !== vh) {
    c.width = vw; c.height = vh;
    gl.uniform2f(FX.u.texel, 1 / vw, 1 / vh);
  }
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  } catch (e) { /* frame not ready yet */ }
}

function renderEffect(c, x, y, w, h, effect) {
  w = Math.round(w); h = Math.round(h);
  if (!FX.ok || w > FX.canvas.width || h > FX.canvas.height) {
    c.save(); c.translate(x + w, y); c.scale(-1, 1); c.drawImage(video, 0, 0, w, h); c.restore();
    return;
  }
  const gl = FX.gl;
  gl.viewport(0, 0, w, h);
  gl.uniform2f(FX.u.res, w, h);
  gl.uniform1i(FX.u.fx, effect.fx);
  gl.uniform1f(FX.u.time, (performance.now() - T0) / 1000);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  c.drawImage(FX.canvas, 0, FX.canvas.height - h, w, h, x, y, w, h);
}

/* ------------------------------ Sound & Utils ------------------------------ */
let actx = null;
function beep(freq = 880, dur = 0.1, vol = 0.08) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = freq; g.gain.value = vol;
    o.connect(g); g.connect(actx.destination);
    o.start(); o.stop(actx.currentTime + dur);
  } catch (_) { /* ignore */ }
}

function flash() {
  const b = document.body;
  b.classList.remove('flash-fade'); b.classList.add('flash-on');
  beep(1400, 0.04, 0.1);
  requestAnimationFrame(() => requestAnimationFrame(() => { b.classList.remove('flash-on'); b.classList.add('flash-fade'); }));
  setTimeout(() => b.classList.remove('flash-fade'), 700);
}

const sleep = (ms, ctl) => new Promise((res, rej) => setTimeout(() => (ctl && ctl.cancelled ? rej('cancelled') : res()), ms));
const toBlob = (c, type = 'image/jpeg', q = 0.92) => new Promise((res) => c.toBlob(res, type, q));

async function makeThumb(source) {
  const t = document.createElement('canvas');
  t.width = 320; t.height = Math.round(320 * source.height / source.width);
  t.getContext('2d').drawImage(source, 0, 0, t.width, t.height);
  return toBlob(t, 'image/jpeg', 0.8);
}

function pickMime() {
  const list = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

function stamp(ts) {
  const d = new Date(ts), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} at ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
}

/* ----------------------------- IndexedDB (Library + Prefs) ----------------------------- */
const dbReady = new Promise((resolve, reject) => {
  const req = indexedDB.open('photobooth', 2);
  req.onupgradeneeded = () => {
    const db = req.result;
    if (!db.objectStoreNames.contains('items')) {
      db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
    }
    if (!db.objectStoreNames.contains('prefs')) {
      db.createObjectStore('prefs');
    }
  };
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

async function dbTx(storeName, mode, fn) {
  const db = await dbReady;
  return new Promise((resolve, reject) => {
    const t = db.transaction(storeName, mode);
    const rq = fn(t.objectStore(storeName));
    t.oncomplete = () => resolve(rq && rq.result);
    t.onerror = () => reject(t.error);
  });
}

const thumbUrls = new Map();
const thumbUrl = (item) => {
  if (!thumbUrls.has(item.id)) thumbUrls.set(item.id, URL.createObjectURL(item.thumb || item.blob));
  return thumbUrls.get(item.id);
};

async function loadItems() {
  try {
    sharedItems = (await dbTx('items', 'readonly', (s) => s.getAll())) || [];
    sharedItems.sort((a, b) => a.createdAt - b.createdAt);
  } catch (e) { console.error(e); sharedItems = []; }
  syncLibraries(true);
}

async function addItem(item) {
  const id = await dbTx('items', 'readwrite', (s) => s.add(item));
  item.id = id;
  item._new = true;
  sharedItems.push(item);
  syncLibraries(true);
  delete item._new;
  return item;
}

const photoItems = () => sharedItems.filter((i) => i.type !== 'screenshot');

async function deleteItem(id) {
  await dbTx('items', 'readwrite', (s) => s.delete(id));
  const u = thumbUrls.get(id);
  if (u) { URL.revokeObjectURL(u); thumbUrls.delete(id); }
  sharedItems = sharedItems.filter((i) => i.id !== id);
  for (const w of windows) {
    if (w.selectedId === id) w.closeItem();
  }
  syncLibraries(false);
}

function syncLibraries(scrollToEnd) {
  localStorage.setItem('pb.hasItems', photoItems().length ? '1' : '0');
  for (const w of windows) w.renderLibrary(scrollToEnd);
  if (typeof renderFiles === 'function') renderFiles();
}

/* ------------------------- Window Manager & Dock ------------------------- */
const DEFAULT_TITLE = 'Photo Booth';
const INNER = 10;
const CHROME_H = 100;
const DOCK_RESERVE = 84;
const winPad = () => (innerWidth <= 640 ? 8 : 16);
const zoomPad = () => Math.max(winPad() * 2, Math.round(Math.min(innerWidth, innerHeight) * 0.06));
const minW = () => Math.min(280, innerWidth);
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

const utilApps = [];

const stageAR = () => Math.min(cameraAR || 16 / 9, 1.54);
const chromeForW = () => CHROME_H;
const heightForWin = (w) => Math.round(CHROME_H + (w - INNER * 2) / stageAR());

function updateBodyFull() {
  document.body.classList.toggle('has-full', windows.some((w) => w.winFull && !w.minimized && !w.closing));
}

function focusElement(el, pbInst = null) {
  if (!el) return;
  focusedEl = el;
  focusedWin = pbInst;
  topZ += 1;
  el.style.zIndex = topZ;
  for (const w of windows) w.el.classList.toggle('focused', w.el === el);
  for (const app of utilApps) app.el.classList.toggle('focused', app.el === el);
  const hit = utilApps.find((a) => a.el === el);
  document.title = pbInst ? pbInst.title : (hit ? hit.title : DEFAULT_TITLE);
}

function focusTopVisible() {
  const candidates = [];
  for (const w of windows) {
    if (!w.minimized && !w.closing) candidates.push({ el: w.el, inst: w, z: Number(w.el.style.zIndex) || 0 });
  }
  for (const app of utilApps) {
    if (app.state.open && !app.state.minimized) {
      candidates.push({ el: app.el, inst: null, z: Number(app.el.style.zIndex) || 0 });
    }
  }
  if (!candidates.length) {
    focusedEl = null;
    focusedWin = null;
    document.title = DEFAULT_TITLE;
    return;
  }
  candidates.sort((a, b) => b.z - a.z);
  focusElement(candidates[0].el, candidates[0].inst);
}

function updateDock() {
  const alivePB = windows.filter((w) => !w.closing);
  dock.classList.toggle('pb-running', alivePB.length > 0);
  for (const app of utilApps) dock.classList.toggle(app.dockClass, app.state.open);

  const minPB = alivePB.filter((w) => w.minimized);
  const minUtils = utilApps.filter((a) => a.state.open && a.state.minimized);
  dockDivider.hidden = minPB.length === 0 && minUtils.length === 0;
  dockMin.innerHTML = '';

  for (const w of minPB) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dock-min-item';
    btn.setAttribute('aria-label', `Restore ${w.title}`);
    btn.innerHTML = (w.minThumb ? `<img alt="" src="${w.minThumb}">` : '') +
                    `<span class="dock-tip">${w.title.replace(/[<>&]/g, '')}</span>`;
    btn.addEventListener('click', () => w.restore());
    dockMin.appendChild(btn);
  }

  for (const app of minUtils) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dock-min-item';
    btn.setAttribute('aria-label', `Restore ${app.title}`);
    app.renderMinThumb(btn);
    btn.addEventListener('click', () => app.restore());
    dockMin.appendChild(btn);
  }

  updateBodyFull();
}

/* ------------------------- Photo Booth Window Factory ------------------------- */
function createWindow(opts = {}) {
  const seq = ++winSeq;
  const frag = winTpl.content.cloneNode(true);
  const el = frag.firstElementChild;
  windowsEl.appendChild(el);

  const $w = (s) => el.querySelector(s);
  const canvas = $w('.view');
  const ctx = canvas.getContext('2d');
  const stage = $w('.stage');
  const titlebar = $w('.titlebar');
  const titleInput = $w('.title-input');
  const fsBtn = $w('.light.max');
  const minBtn = $w('.light.min');
  const closeBtn = $w('.light.close');
  const fxTrack = $w('.fx-track');
  const fxDots = $w('.fx-dots');
  const fxPrev = $w('.fx-nav.prev');
  const fxNext = $w('.fx-nav.next');
  const shutter = $w('.shutter');
  const modesEl = $w('.modes');
  const effectsBtn = $w('.effects-btn');
  const viewerEl = $w('.viewer');
  const viewerImg = $w('.viewer-img');
  const viewerVideo = $w('.viewer-video');
  const dlBtn = $w('.dl-btn');
  const delBtn = $w('.del-btn');
  const viewerCloseBtn = $w('.viewer-close-btn');
  const effectsEl = $w('.effects');
  const countdownEl = $w('.countdown');
  const recBadgeEl = $w('.rec-badge');
  const recTimeEl = $w('.rec-time');
  const msgEl = $w('.message');
  const libEl = $w('.library');

  const inst = {
    id: seq,
    winKey: `${PAGE_SESSION}:${seq}`,
    el, canvas, ctx, stage,
    mode: opts.mode || 'photo',
    effect: effectById(opts.effectId || 'normal'),
    fxPage: 0,
    fxAnimUntil: 0,
    view: 'live',
    effectsOpen: false,
    busy: false,
    ctl: null,
    shots: [],
    recording: false,
    recorder: null,
    recTimer: null,
    recStart: 0,
    selectedId: null,
    viewerUrl: null,
    title: opts.title || DEFAULT_TITLE,
    WIN: { x: 0, y: 0, w: 640 },
    zoomPrev: null,
    winReady: false,
    winFull: false,
    minimized: false,
    closing: false,
    minThumb: '',
    fullCleanupTimer: null,
    tiles: [],
  };

  const arNow = stageAR;
  const chromeH = () => CHROME_H;
  const heightFor = (w) => heightForWin(w);
  const widthForHeight = (h) => Math.round((h - CHROME_H) * stageAR() + INNER * 2);
  const maxW = () => Math.max(minW(), Math.min(innerWidth, widthForHeight(innerHeight)));

  function applyWin(mode) {
    inst.WIN.w = clampN(inst.WIN.w, minW(), maxW());
    const h = heightFor(inst.WIN.w);
    inst.WIN.h = h;
    if (mode === 'fit') {
      inst.WIN.x = clampN(inst.WIN.x, 0, Math.max(0, innerWidth - inst.WIN.w));
      inst.WIN.y = clampN(inst.WIN.y, 0, Math.max(0, innerHeight - h));
    } else if (mode === 'loose') {
      inst.WIN.x = clampN(inst.WIN.x, 80 - inst.WIN.w, innerWidth - 80);
      inst.WIN.y = clampN(inst.WIN.y, 0, innerHeight - 40);
    }
    el.style.width = inst.WIN.w + 'px';
    if (!inst.winFull) el.style.height = h + 'px';
    el.style.left = inst.WIN.x + 'px';
    el.style.top = inst.WIN.y + 'px';
  }

  inst.showMessage = (text) => {
    msgEl.hidden = !text;
    msgEl.textContent = text || '';
  };
  if (cameraMsg) inst.showMessage(cameraMsg);

  /* ---- Effects UI ---- */
  PAGES.forEach((ids, pi) => {
    const page = document.createElement('div');
    page.className = 'fx-page';
    for (let k = 0; k < 9; k++) {
      const fx = effectById(k === 4 ? 'normal' : ids[k < 4 ? k : k - 1]);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'fx';
      btn.innerHTML = `<canvas></canvas><span>${fx.name}</span>`;
      btn.addEventListener('click', () => {
        inst.effect = fx;
        inst.toggleEffects(false);
      });
      page.appendChild(btn);
      const cv = btn.querySelector('canvas');
      inst.tiles.push({ fx, page: pi, btn, c: cv, x: cv.getContext('2d') });
    }
    fxTrack.appendChild(page);

    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', 'Effects page ' + (pi + 1));
    dot.addEventListener('click', () => inst.setFxPage(pi));
    fxDots.appendChild(dot);
  });

  inst.setFxPage = (i, animate = true) => {
    i = Math.max(0, Math.min(PAGES.length - 1, i));
    inst.fxPage = i;
    if (!animate) fxTrack.style.transition = 'none';
    fxTrack.style.transform = `translateX(${-i * 100}%)`;
    if (!animate) { void fxTrack.offsetWidth; fxTrack.style.transition = ''; }
    inst.fxAnimUntil = performance.now() + (animate ? 550 : 0);
    [...fxDots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    fxPrev.classList.toggle('off', i === 0);
    fxNext.classList.toggle('off', i === PAGES.length - 1);
  };

  fxPrev.addEventListener('click', () => inst.setFxPage(inst.fxPage - 1));
  fxNext.addEventListener('click', () => inst.setFxPage(inst.fxPage + 1));
  {
    let x0 = null;
    effectsEl.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
    effectsEl.addEventListener('touchend', (e) => {
      if (x0 == null) return;
      const dx = e.changedTouches[0].clientX - x0; x0 = null;
      if (Math.abs(dx) > 50) inst.setFxPage(inst.fxPage + (dx < 0 ? 1 : -1));
    });
  }

  inst.renderTiles = () => {
    const vw = video.videoWidth, vh = video.videoHeight;
    const tw = 200, th = Math.round(200 * vh / vw);
    const animating = performance.now() < inst.fxAnimUntil;
    for (const t of inst.tiles) {
      const visible = t.page === inst.fxPage || (animating && Math.abs(t.page - inst.fxPage) <= 1);
      if (!visible) continue;
      if (t.c.width !== tw || t.c.height !== th) { t.c.width = tw; t.c.height = th; }
      renderEffect(t.x, 0, 0, tw, th, t.fx);
      t.btn.classList.toggle('active', t.fx === inst.effect);
    }
  };

  inst.renderScene = (c, w, h) => {
    if (inst.mode === '4up') {
      const cw = w / 2, ch = h / 2;
      for (let i = 0; i < 4; i++) {
        const x = (i % 2) * cw, y = Math.floor(i / 2) * ch;
        if (inst.shots[i]) c.drawImage(inst.shots[i], x, y, cw, ch);
        else renderEffect(c, x, y, cw, ch, inst.effect);
      }
      c.fillStyle = '#000';
      c.fillRect(cw - 2, 0, 4, h);
      c.fillRect(0, ch - 2, w, 4);
    } else {
      renderEffect(c, 0, 0, w, h, inst.effect);
    }
  };

  /* ---- Capture & Recording ---- */
  async function runCountdown(n, ctl) {
    for (let i = n; i > 0; i--) {
      countdownEl.hidden = false;
      countdownEl.textContent = i;
      countdownEl.classList.remove('tick'); void countdownEl.offsetWidth; countdownEl.classList.add('tick');
      beep(i === 1 ? 1100 : 760, 0.09);
      await sleep(1000, ctl);
    }
    countdownEl.hidden = true;
  }

  async function savePhoto() {
    const blob = await toBlob(canvas);
    const thumb = await makeThumb(canvas);
    await addItem({ type: 'photo', blob, thumb, mime: 'image/jpeg', createdAt: Date.now(), winKey: inst.winKey });
  }

  async function captureSequence(skipCountdown) {
    const ctl = { cancelled: false };
    inst.ctl = ctl;
    inst.busy = true;
    try {
      const w = canvas.width, h = canvas.height;
      if (inst.mode === '4up') {
        inst.shots = [];
        for (let i = 0; i < 4; i++) {
          if (!skipCountdown) await runCountdown(i === 0 ? 3 : 2, ctl);
          const shot = document.createElement('canvas');
          shot.width = Math.round(w / 2); shot.height = Math.round(h / 2);
          renderEffect(shot.getContext('2d'), 0, 0, shot.width, shot.height, inst.effect);
          inst.shots.push(shot);
          flash();
          await sleep(skipCountdown ? 500 : 250, ctl);
        }
        await sleep(900, ctl);
        inst.renderScene(ctx, w, h);
        await savePhoto();
        inst.shots = [];
      } else {
        if (!skipCountdown) await runCountdown(3, ctl);
        inst.renderScene(ctx, w, h);
        flash();
        await savePhoto();
      }
    } catch (e) {
      if (e !== 'cancelled') console.error(e);
    } finally {
      inst.shots = [];
      inst.busy = false;
      inst.ctl = null;
      countdownEl.hidden = true;
    }
  }

  async function startRecording(skipCountdown) {
    if (!window.MediaRecorder) return inst.showMessage('Recording is not supported in this browser.');
    const ctl = { cancelled: false };
    inst.ctl = ctl; inst.busy = true;
    try {
      if (!micStream) {
        try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (_) { micStream = null; }
      }
      if (!skipCountdown) await runCountdown(3, ctl);
    } catch (e) {
      inst.busy = false; inst.ctl = null; countdownEl.hidden = true;
      return;
    }
    inst.ctl = null;

    const out = canvas.captureStream(30);
    if (micStream) micStream.getAudioTracks().forEach((t) => out.addTrack(t));
    const mime = pickMime();
    const chunks = [];
    const rec = new MediaRecorder(out, mime ? { mimeType: mime } : undefined);
    inst.recorder = rec;
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      if (!inst.closing) {
        const type = rec.mimeType || mime || 'video/webm';
        const blob = new Blob(chunks, { type });
        await addItem({ type: 'video', blob, thumb: rec.poster, mime: type, createdAt: Date.now(), winKey: inst.winKey });
      }
      inst.recorder = null;
    };
    rec.start(250);

    inst.recording = true;
    inst.busy = false;
    shutter.classList.add('recording');
    recBadgeEl.hidden = false;
    inst.recStart = Date.now();
    const tick = () => {
      const s = Math.floor((Date.now() - inst.recStart) / 1000);
      recTimeEl.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    };
    tick();
    inst.recTimer = setInterval(tick, 250);
  }

  async function stopRecording() {
    if (!inst.recorder) return;
    inst.recorder.poster = await makeThumb(canvas);
    inst.recorder.stop();
    clearInterval(inst.recTimer);
    inst.recording = false;
    shutter.classList.remove('recording');
    recBadgeEl.hidden = true;
  }

  /* ---- Library & Viewer ---- */
  inst.renderLibrary = (scrollToEnd) => {
    const items = photoItems().filter((i) => i.winKey === inst.winKey);
    el.classList.toggle('lib-empty', items.length === 0);
    libEl.innerHTML = '';
    for (const item of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'thumb' + (item.id === inst.selectedId ? ' active' : '') + (item._new ? ' new' : '');
      b.innerHTML = `<img alt="" src="${thumbUrl(item)}">` + (item.type === 'video' ? '<span class="badge">MOV</span>' : '');
      b.addEventListener('click', () => openItem(item.id));
      libEl.appendChild(b);
    }
    if (scrollToEnd) libEl.scrollLeft = libEl.scrollWidth;
  };

  function releaseViewer() {
    viewerVideo.pause(); viewerVideo.removeAttribute('src'); viewerVideo.load();
    viewerImg.removeAttribute('src');
    if (inst.viewerUrl) URL.revokeObjectURL(inst.viewerUrl);
    inst.viewerUrl = null;
  }

  inst.closeItem = () => {
    releaseViewer();
    inst.selectedId = null;
    inst.view = 'live';
    viewerEl.hidden = true;
    stage.classList.remove('viewing');
    inst.renderLibrary(false);
  };

  function openItem(id) {
    if (inst.recording || inst.busy) return;
    if (inst.selectedId === id && inst.view === 'item') return inst.closeItem();
    const item = sharedItems.find((i) => i.id === id);
    if (!item) return;
    inst.toggleEffects(false);
    releaseViewer();
    inst.viewerUrl = URL.createObjectURL(item.blob);
    viewerImg.hidden = item.type !== 'photo';
    viewerVideo.hidden = item.type !== 'video';
    if (item.type === 'photo') viewerImg.src = inst.viewerUrl;
    else { viewerVideo.src = inst.viewerUrl; viewerVideo.play().catch(() => {}); }
    inst.selectedId = id;
    inst.view = 'item';
    viewerEl.hidden = false;
    stage.classList.add('viewing');
    inst.renderLibrary(false);
  }

  dlBtn.addEventListener('click', () => {
    const item = sharedItems.find((i) => i.id === inst.selectedId);
    if (!item) return;
    const ext = item.type === 'photo' ? 'jpg' : (item.mime.includes('mp4') ? 'mp4' : 'webm');
    const a = document.createElement('a');
    a.href = inst.viewerUrl;
    a.download = `${item.type === 'photo' ? 'Photo' : 'Movie'} ${stamp(item.createdAt)}.${ext}`;
    a.click();
  });

  delBtn.addEventListener('click', () => {
    if (inst.selectedId != null) deleteItem(inst.selectedId);
  });
  if (viewerCloseBtn) viewerCloseBtn.addEventListener('click', () => inst.closeItem());

  /* ---- Mode, Effects, Shutter ---- */
  function setMode(mode) {
    if (inst.busy || inst.recording) return;
    inst.mode = mode;
    inst.shots = [];
    el.querySelectorAll('.mode').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    modesEl.dataset.active = ['4up', 'photo', 'video'].indexOf(mode);
    shutter.dataset.mode = mode;
    if (inst.view === 'item') inst.closeItem();
  }

  inst.toggleEffects = (open) => {
    if (inst.busy || inst.recording) return;
    inst.effectsOpen = open === undefined ? !inst.effectsOpen : open;
    effectsEl.hidden = !inst.effectsOpen;
    stage.classList.toggle('fx-open', inst.effectsOpen);
    effectsBtn.setAttribute('aria-pressed', String(inst.effectsOpen));
    effectsBtn.title = inst.effectsOpen ? 'Done' : 'Effects';
    effectsBtn.setAttribute('aria-label', inst.effectsOpen ? 'Done' : 'Effects');
    if (inst.effectsOpen) {
      if (inst.view === 'item') inst.closeItem();
      const pi = pageOf(inst.effect.id);
      inst.setFxPage(pi >= 0 ? pi : inst.fxPage, false);
    }
  };

  inst.onShutter = (e) => {
    if (!video.videoWidth) return;
    const skip = !!(e && e.altKey);
    if (inst.busy && inst.ctl) { inst.ctl.cancelled = true; return; }
    if (inst.busy) return;
    if (inst.recording) return stopRecording();
    if (inst.effectsOpen) inst.toggleEffects(false);
    if (inst.view === 'item') inst.closeItem();
    if (inst.mode === 'video') startRecording(skip);
    else captureSequence(skip);
  };

  el.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  shutter.addEventListener('click', (e) => { inst.onShutter(e); e.currentTarget.blur(); });
  effectsBtn.addEventListener('click', (e) => { inst.toggleEffects(); e.currentTarget.blur(); });

  /* ---- Title bar & Rename ---- */
  let committedTitle = inst.title;
  const fitTitle = () => { titleInput.style.width = Math.max(6, Math.ceil(titleInput.value.length * 1.3 + 2)) + 'ch'; };
  const applyTitle = (t) => {
    inst.title = t; titleInput.value = t; committedTitle = t; fitTitle();
    if (focusedWin === inst) document.title = t;
  };
  const commitTitle = () => {
    const t = titleInput.value.trim() || DEFAULT_TITLE;
    applyTitle(t);
  };
  titleInput.addEventListener('input', fitTitle);
  titleInput.addEventListener('focus', () => titleInput.select());
  titleInput.addEventListener('blur', commitTitle);
  titleInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') titleInput.blur();
    else if (e.key === 'Escape') { titleInput.value = committedTitle; titleInput.blur(); }
  });
  applyTitle(inst.title);

  /* ---- Traffic lights: Close, Minimize, Fullscreen ---- */
  inst.toggleWinFull = (force) => {
    const enter = force === undefined ? !inst.winFull : force;
    if (enter === inst.winFull) return;
    clearTimeout(inst.fullCleanupTimer);
    if (enter) {
      inst.winFull = true;
      el.style.height = el.offsetHeight + 'px';
      void el.offsetHeight;
      el.classList.add('win-full');
    } else {
      const startH = el.offsetHeight;
      inst.winFull = false;
      applyWin('fit');
      const targetH = inst.WIN.h;
      el.style.height = startH + 'px';
      el.classList.remove('win-full');
      void el.offsetHeight;
      el.style.height = targetH + 'px';
    }
    fsBtn.title = enter ? 'Exit full screen' : 'Full screen';
    updateBodyFull();
  };

  inst.minimize = () => {
    if (inst.minimized || inst.closing) return;
    if (inst.winFull) inst.toggleWinFull(false);
    try { inst.minThumb = canvas.width ? canvas.toDataURL('image/jpeg', 0.55) : ''; } catch (_) { inst.minThumb = ''; }
    el.classList.add('minimizing');
    setTimeout(() => {
      if (inst.closing) return;
      inst.minimized = true;
      el.classList.remove('minimizing');
      el.classList.add('minimized');
      focusTopVisible();
      updateDock();
    }, 280);
  };

  inst.restore = () => {
    if (!inst.minimized || inst.closing) return;
    inst.minimized = false;
    el.classList.remove('minimized');
    applyWin('fit');
    focusElement(el, inst);
    updateDock();
  };

  inst.close = () => {
    if (inst.closing) return;
    inst.closing = true;
    if (inst.ctl) inst.ctl.cancelled = true;
    if (inst.recording && inst.recorder) {
      clearInterval(inst.recTimer);
      inst.recording = false;
      try { inst.recorder.stop(); } catch (_) { /* ignore */ }
    }
    releaseViewer();
    el.classList.add('closing');
    setTimeout(() => {
      el.remove();
      const idx = windows.indexOf(inst);
      if (idx >= 0) windows.splice(idx, 1);
      focusTopVisible();
      updateDock();
    }, 200);
    updateDock();
  };

  fsBtn.addEventListener('click', () => inst.toggleWinFull());
  minBtn.addEventListener('click', () => inst.minimize());
  closeBtn.addEventListener('click', () => inst.close());

  /* ---- Move & Resize ---- */
  function startDrag(e, onMove) {
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = (ev) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!moved) {
        if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2) return;
        moved = true;
        inst.zoomPrev = null;
        el.classList.add('dragging');
        document.body.classList.add('win-dragging');
      }
      onMove(dx, dy);
    };
    const up = () => {
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
      if (moved) {
        el.classList.remove('dragging');
        document.body.classList.remove('win-dragging');
      }
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  }

  ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].forEach((dir) => {
    const h = document.createElement('i');
    h.className = 'rz ' + dir;
    h.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || inst.winFull) return;
      e.preventDefault();
      focusElement(el, inst);
      const sx = dir.includes('e') ? 1 : dir.includes('w') ? -1 : 0;
      const sy = dir.includes('s') ? 1 : dir.includes('n') ? -1 : 0;
      const s0 = { x: inst.WIN.x, y: inst.WIN.y, w: inst.WIN.w, h: el.offsetHeight, chrome: chromeH() };
      startDrag(e, (dx, dy) => {
        const fromX = sx ? s0.w + sx * dx : 0;
        const fromY = sy ? (s0.h + sy * dy - s0.chrome) * arNow() + INNER * 2 : 0;
        const availW = sx < 0 ? (s0.x + s0.w) : (innerWidth - Math.max(0, s0.x));
        const availH = sy < 0 ? (s0.y + s0.h) : (innerHeight - Math.max(0, s0.y));
        const maxFromH = (availH - s0.chrome) * arNow() + INNER * 2;
        const hi = Math.max(minW(), Math.min(maxW(), availW, maxFromH));
        inst.WIN.w = clampN(Math.max(fromX, fromY), minW(), hi);
        const hNew = s0.chrome + (inst.WIN.w - INNER * 2) / arNow();
        inst.WIN.x = sx < 0 ? s0.x + s0.w - inst.WIN.w : s0.x;
        inst.WIN.y = sy < 0 ? s0.y + s0.h - hNew : s0.y;
        inst.WIN.y = clampN(inst.WIN.y, 0, Math.max(0, innerHeight - hNew));
        inst.WIN.x = clampN(inst.WIN.x, 0, Math.max(0, innerWidth - inst.WIN.w));
        applyWin('none');
      });
    });
    el.appendChild(h);
  });

  let tapTrack = null;
  let lastTouchTap = null;
  let lastZoomAt = 0;

  function toggleZoom() {
    if (inst.winFull) return;
    lastZoomAt = performance.now();
    if (inst.zoomPrev) { Object.assign(inst.WIN, inst.zoomPrev); inst.zoomPrev = null; }
    else {
      inst.zoomPrev = { ...inst.WIN };
      const pad = zoomPad();
      const bottomClear = Math.max(pad, DOCK_RESERVE);
      inst.WIN.w = Math.min(innerWidth - pad * 2, widthForHeight(innerHeight - pad - bottomClear));
      inst.WIN.x = (innerWidth - inst.WIN.w) / 2;
      inst.WIN.y = Math.max(pad, (innerHeight - bottomClear + pad - heightFor(inst.WIN.w)) / 2);
    }
    applyWin('fit');
  }

  titlebar.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || inst.winFull || e.target.closest('.light') || e.target === titleInput) return;
    e.preventDefault();
    titleInput.blur();
    if (e.pointerType !== 'mouse') {
      tapTrack = { id: e.pointerId, x: e.clientX, y: e.clientY };
    }
    const x0 = inst.WIN.x, y0 = inst.WIN.y;
    startDrag(e, (dx, dy) => { inst.WIN.x = x0 + dx; inst.WIN.y = y0 + dy; applyWin('loose'); });
  });

  titlebar.addEventListener('pointermove', (e) => {
    if (!tapTrack || tapTrack.id !== e.pointerId) return;
    if (Math.hypot(e.clientX - tapTrack.x, e.clientY - tapTrack.y) > 8) tapTrack = null;
  });

  titlebar.addEventListener('pointerup', (e) => {
    if (!tapTrack || tapTrack.id !== e.pointerId) return;
    tapTrack = null;
    if (e.pointerType === 'mouse' || inst.winFull || e.target.closest('.light') || e.target === titleInput) return;
    const now = performance.now();
    if (lastTouchTap && now - lastTouchTap.t <= 360 && Math.hypot(e.clientX - lastTouchTap.x, e.clientY - lastTouchTap.y) <= 28) {
      lastTouchTap = null;
      toggleZoom();
    } else {
      lastTouchTap = { t: now, x: e.clientX, y: e.clientY };
    }
  });

  titlebar.addEventListener('pointercancel', (e) => {
    if (tapTrack && tapTrack.id === e.pointerId) tapTrack = null;
  });

  titlebar.addEventListener('dblclick', (e) => {
    if (inst.winFull || e.target.closest('.light') || e.target === titleInput) return;
    e.preventDefault();
    if (performance.now() - lastZoomAt < 450) return;
    toggleZoom();
  });

  el.addEventListener('pointerdown', () => focusElement(el, inst), true);

  /* ---- Initial geometry ---- */
  el.classList.toggle('lib-empty', sharedItems.length ? false : localStorage.getItem('pb.hasItems') !== '1');
  const pad = winPad();
  if (typeof opts.w === 'number' && typeof opts.x === 'number' && typeof opts.y === 'number') {
    inst.WIN.w = opts.w;
    inst.WIN.x = opts.x;
    inst.WIN.y = opts.y;
  } else {
    const availH = Math.max(280, innerHeight - pad - DOCK_RESERVE);
    const base = (focusedWin && !focusedWin.minimized && !focusedWin.closing)
      ? focusedWin
      : windows.find((w) => !w.minimized && !w.closing);
    if (base && opts.cascaded) {
      inst.WIN.w = Math.min(base.winFull ? 700 : base.WIN.w, innerWidth - pad * 2, widthForHeight(availH));
      const h = heightFor(inst.WIN.w);
      inst.WIN.x = clampN(base.WIN.x + 28, pad, Math.max(pad, innerWidth - inst.WIN.w - pad));
      inst.WIN.y = clampN(base.WIN.y + 28, pad, Math.max(pad, innerHeight - DOCK_RESERVE - h));
    } else {
      inst.WIN.w = Math.min(760, innerWidth - pad * 2, widthForHeight(availH));
      inst.WIN.x = (innerWidth - inst.WIN.w) / 2;
      inst.WIN.y = Math.max(pad, (innerHeight - DOCK_RESERVE - heightFor(inst.WIN.w)) / 2);
    }
  }
  applyWin('fit');
  inst.applyWin = applyWin;
  inst.heightFor = heightFor;

  inst.winReady = true;
  requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('anim')));

  windows.push(inst);
  inst.setFxPage(0, false);
  setMode(inst.mode);
  inst.renderLibrary(true);
  focusElement(el, inst);
  updateDock();
  return inst;
}

/* ------------------------- Window Layouts & Utility Helper ------------------------- */
const DEFAULT_LAYOUT_ID = '2-diag';

function computeLayoutSpecs(id) {
  const pad = winPad();
  const W = innerWidth;
  const H = Math.max(320, innerHeight - DOCK_RESERVE);
  const maxFitW = (availW, availH) => {
    let w = Math.floor(Math.min(availW, (availH - 80) * stageAR() + 18));
    while (w > minW() && heightForWin(w) > availH) w -= 2;
    return Math.max(minW(), Math.min(Math.floor(availW), w));
  };
  const estH = (w) => heightForWin(w);

  if (id === '1-center') {
    const w = maxFitW(Math.min(W * 0.84, 760), H * 0.86);
    const h = estH(w);
    return [
      { effectId: 'normal', x: Math.round((W - w) / 2), y: Math.max(pad, Math.round((H - h) / 2)), w },
    ];
  }

  if (id === '2-side') {
    const gap = Math.max(12, Math.round(W * 0.02));
    const w = maxFitW((W - pad * 2 - gap) / 2, H - pad * 2);
    const h = estH(w);
    const totalW = w * 2 + gap;
    const sx = Math.round((W - totalW) / 2);
    const y = Math.max(pad, Math.round((H - h) / 2));
    return [
      { effectId: 'pop', x: sx, y, w },
      { effectId: 'normal', x: sx + w + gap, y, w },
    ];
  }

  if (id === '3-trio') {
    const gap = Math.max(10, Math.round(W * 0.018));
    const w = maxFitW((W - pad * 2 - gap) / 2, (H - pad * 2 - gap) / 2);
    const h = estH(w);
    const totalW = w * 2 + gap;
    const totalH = h * 2 + gap;
    const sx = Math.round((W - totalW) / 2);
    const sy = Math.max(pad, Math.round((H - totalH) / 2));
    return [
      { effectId: 'pop', x: sx, y: sy, w },
      { effectId: 'comic', x: sx + w + gap, y: sy, w },
      { effectId: 'normal', x: Math.round((W - w) / 2), y: Math.min(H - h - pad, sy + h + gap), w },
    ];
  }

  if (id === '3-cascade') {
    const w = maxFitW(W * 0.44, H * 0.62);
    const h = estH(w);
    const stepX = Math.max(24, Math.round((W - pad * 2 - w) / 2));
    const stepY = Math.max(24, Math.round((H - pad * 2 - h) / 2));
    return [
      { effectId: 'pop', x: pad, y: pad, w },
      { effectId: 'thermal', x: pad + stepX, y: pad + stepY, w },
      { effectId: 'normal', x: pad + stepX * 2, y: pad + stepY * 2, w },
    ];
  }

  if (id === '4-grid') {
    const gap = Math.max(10, Math.round(W * 0.016));
    const w = maxFitW((W - pad * 2 - gap) / 2, (H - pad * 2 - gap) / 2);
    const h = estH(w);
    const totalW = w * 2 + gap;
    const totalH = h * 2 + gap;
    const sx = Math.round((W - totalW) / 2);
    const sy = Math.max(pad, Math.round((H - totalH) / 2));
    return [
      { effectId: 'pop', x: sx, y: sy, w },
      { effectId: 'xray', x: sx + w + gap, y: sy, w },
      { effectId: 'comic', x: sx, y: sy + h + gap, w },
      { effectId: 'normal', x: sx + w + gap, y: sy + h + gap, w },
    ];
  }

  if (id === '5-pentagon') {
    const gap = Math.max(8, Math.round(W * 0.014));
    const w = maxFitW((W - pad * 2 - gap * 2) / 3, (H - pad * 2 - gap) / 2);
    const h = estH(w);
    const topW = w * 3 + gap * 2;
    const botW = w * 2 + gap;
    const topX = Math.round((W - topW) / 2);
    const botX = Math.round((W - botW) / 2);
    const sy = Math.max(pad, Math.round((H - (h * 2 + gap)) / 2));
    return [
      { effectId: 'pop', x: topX, y: sy, w },
      { effectId: 'comic', x: topX + w + gap, y: sy, w },
      { effectId: 'xray', x: topX + (w + gap) * 2, y: sy, w },
      { effectId: 'thermal', x: botX, y: sy + h + gap, w },
      { effectId: 'normal', x: botX + w + gap, y: sy + h + gap, w },
    ];
  }

  // Default '2-diag': matches reference screenshot (Pop Art top-left, Normal bottom-right)
  const w = clampN(Math.round(W * 0.46), minW(), Math.max(minW(), W - pad * 2));
  const h = estH(w);
  const x1 = Math.round(W * 0.068);
  const y1 = Math.round(innerHeight * 0.055);
  const x2 = Math.max(pad, Math.round(W - w - W * 0.062));
  const y2 = clampN(Math.round(innerHeight * 0.34), pad, Math.max(pad, innerHeight - DOCK_RESERVE - h - 14));
  return [
    { effectId: 'pop', x: x1, y: y1, w },
    { effectId: 'normal', x: x2, y: y2, w },
  ];
}

const LAYOUT_PRESETS = [
  { id: '1-center', count: 1, name: 'Single Center', boxes: [[22, 16, 56, 68, 1]] },
  { id: '2-diag', count: 2, name: 'Diagonal Split', boxes: [[6, 8, 52, 52, 0], [42, 38, 52, 52, 1]] },
  { id: '2-side', count: 2, name: 'Side by Side', boxes: [[5, 22, 43, 56, 0], [52, 22, 43, 56, 1]] },
  { id: '3-trio', count: 3, name: 'Triangle Trio', boxes: [[8, 6, 40, 42, 0], [52, 6, 40, 42, 0], [30, 52, 40, 42, 1]] },
  { id: '3-cascade', count: 3, name: 'Cascade Fan', boxes: [[6, 8, 46, 48, 0], [27, 26, 46, 48, 0], [48, 44, 46, 48, 1]] },
  { id: '4-grid', count: 4, name: '2×2 Studio Grid', boxes: [[8, 6, 40, 42, 0], [52, 6, 40, 42, 0], [8, 52, 40, 42, 0], [52, 52, 40, 42, 1]] },
  { id: '5-pentagon', count: 5, name: 'Pentagon Showcase', boxes: [[5, 8, 28, 40, 0], [36, 8, 28, 40, 0], [67, 8, 28, 40, 0], [20, 52, 28, 40, 0], [52, 52, 28, 40, 1]] },
];

let activeLayoutId = localStorage.getItem('pb.layoutId') || DEFAULT_LAYOUT_ID;
if (!LAYOUT_PRESETS.some((l) => l.id === activeLayoutId)) activeLayoutId = DEFAULT_LAYOUT_ID;

function clearAllPhotoBoothWindows() {
  for (const inst of [...windows]) {
    inst.closing = true;
    if (inst.ctl) inst.ctl.cancelled = true;
    if (inst.recording && inst.recorder) {
      clearInterval(inst.recTimer);
      try { inst.recorder.stop(); } catch (_) { /* ignore */ }
    }
    inst.el.remove();
  }
  windows.length = 0;
  focusedWin = null;
}

function applyLayout(id, keepUtilFocus = false) {
  activeLayoutId = LAYOUT_PRESETS.some((l) => l.id === id) ? id : DEFAULT_LAYOUT_ID;
  localStorage.setItem('pb.layoutId', activeLayoutId);
  clearAllPhotoBoothWindows();
  const prevFocused = keepUtilFocus ? focusedEl : null;
  const specs = computeLayoutSpecs(activeLayoutId);
  for (const s of specs) createWindow(s);
  if (prevFocused && utilApps.some((a) => a.el === prevFocused && a.state.open)) {
    focusElement(prevFocused, null);
  }
  if (typeof syncSettingsUI === 'function') syncSettingsUI();
  updateDock();
}

function initDefaultWindows() {
  applyLayout(activeLayoutId);
}

function createUtilityApp({ el, state, title, dockClass, closeBtn, minBtn, defaultW, defaultH, onOpen, renderMinThumb }) {
  el.querySelectorAll('.titlebar').forEach((titlebar) => {
    titlebar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.light')) return;
      e.preventDefault();
      titlebar.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY;
      const x0 = state.x, y0 = state.y;
      const w = el.offsetWidth;
      el.classList.add('dragging');
      document.body.classList.add('win-dragging');
      const move = (ev) => {
        state.x = clampN(x0 + ev.clientX - sx, 80 - w, innerWidth - 80);
        state.y = clampN(y0 + ev.clientY - sy, 0, innerHeight - 40);
        el.style.left = state.x + 'px';
        el.style.top = state.y + 'px';
      };
      const up = () => {
        titlebar.removeEventListener('pointermove', move);
        titlebar.removeEventListener('pointerup', up);
        titlebar.removeEventListener('pointercancel', up);
        el.classList.remove('dragging');
        document.body.classList.remove('win-dragging');
      };
      titlebar.addEventListener('pointermove', move);
      titlebar.addEventListener('pointerup', up);
      titlebar.addEventListener('pointercancel', up);
    });
  });

  el.addEventListener('pointerdown', () => focusElement(el, null), true);

  const api = {
    el, state, title, dockClass,
    renderMinThumb: renderMinThumb || ((btn) => { btn.innerHTML = `<span class="dock-tip">${title}</span>`; }),
    open() {
      if (!state.open) {
        state.open = true;
        state.minimized = false;
        el.classList.remove('minimized', 'closing');
        el.hidden = false;
        if (!state.placed) {
          const w = el.offsetWidth || defaultW;
          const h = el.offsetHeight || defaultH;
          state.x = clampN(Math.round((innerWidth - w) / 2), 12, Math.max(12, innerWidth - w - 12));
          state.y = clampN(Math.round((innerHeight - DOCK_RESERVE - h) / 2), 16, Math.max(16, innerHeight - h - DOCK_RESERVE));
          state.placed = true;
        }
        el.style.left = state.x + 'px';
        el.style.top = state.y + 'px';
        if (onOpen) onOpen();
      } else if (state.minimized) {
        api.restore();
        return;
      }
      focusElement(el, null);
      updateDock();
    },
    close() {
      if (!state.open) return;
      el.classList.add('closing');
      setTimeout(() => {
        state.open = false;
        state.minimized = false;
        el.hidden = true;
        el.classList.remove('closing');
        focusTopVisible();
        updateDock();
      }, 200);
    },
    minimize() {
      if (!state.open || state.minimized) return;
      el.classList.add('minimizing');
      setTimeout(() => {
        state.minimized = true;
        el.classList.remove('minimizing');
        el.classList.add('minimized');
        focusTopVisible();
        updateDock();
      }, 280);
    },
    restore() {
      if (!state.open || !state.minimized) return;
      state.minimized = false;
      el.classList.remove('minimized');
      focusElement(el, null);
      updateDock();
    },
  };

  closeBtn.addEventListener('click', () => api.close());
  minBtn.addEventListener('click', () => api.minimize());
  utilApps.push(api);
  return api;
}

/* ------------------------- Wallpaper App ------------------------- */
const wallWin = $('#wallWin');
const wallClose = $('#wallClose');
const wallMin = $('#wallMin');
const wallTabs = $('.wall-tabs');
const wallColorPane = $('#wallColorPane');
const wallPhotoPane = $('#wallPhotoPane');
const svCanvas = $('#svCanvas');
const svCtx = svCanvas.getContext('2d');
const svKnob = $('#svKnob');
const hueSlider = $('#hueSlider');
const satSlider = $('#satSlider');
const valSlider = $('#valSlider');
const hueVal = $('#hueVal');
const satVal = $('#satVal');
const valVal = $('#valVal');
const colorSwatch = $('#colorSwatch');
const hexInput = $('#hexInput');
const colorPresetsEl = $('#colorPresets');
const wallDrop = $('#wallDrop');
const wallThumb = $('#wallThumb');
const wallDropMsg = $('#wallDropMsg');
const wallFile = $('#wallFile');
const wallUploadBtn = $('#wallUploadBtn');
const wallClearBtn = $('#wallClearBtn');

const PRESET_COLORS = ['#FFFFFF', '#F2F2F7', '#1C1C1E', '#DBEAFE', '#D1FAE5', '#FEF3C7', '#FCE7F3', '#EDE9FE'];

const wallState = {
  open: false,
  minimized: false,
  tab: 'color',
  h: 0, s: 0, v: 100,
  color: localStorage.getItem('pb.bgColor') || '#FFFFFF',
  fit: 'cover',
  imgUrl: null,
  imgBlob: null,
  imgEl: null,
  x: 0, y: 0,
  placed: false,
};

function hsvToRgb(h, s, v) {
  h = ((h % 360) + 360) % 360;
  s /= 100; v /= 100;
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function hexToRgb(str) {
  let h = str.trim().replace(/^#/, '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  const s = max ? Math.round((d / max) * 100) : 0;
  const v = Math.round(max * 100);
  return { h, s, v };
}

function drawSV() {
  const w = svCanvas.width, h = svCanvas.height;
  const [r, g, b] = hsvToRgb(wallState.h, 100, 100);
  svCtx.fillStyle = `rgb(${r},${g},${b})`;
  svCtx.fillRect(0, 0, w, h);

  const gw = svCtx.createLinearGradient(0, 0, w, 0);
  gw.addColorStop(0, '#fff');
  gw.addColorStop(1, 'rgba(255,255,255,0)');
  svCtx.fillStyle = gw;
  svCtx.fillRect(0, 0, w, h);

  const gb = svCtx.createLinearGradient(0, 0, 0, h);
  gb.addColorStop(0, 'rgba(0,0,0,0)');
  gb.addColorStop(1, '#000');
  svCtx.fillStyle = gb;
  svCtx.fillRect(0, 0, w, h);
}

function updateSliderTracks() {
  const [hr, hg, hb] = hsvToRgb(wallState.h, 100, 100);
  const [sr0, sg0, sb0] = hsvToRgb(wallState.h, 0, wallState.v);
  const [sr1, sg1, sb1] = hsvToRgb(wallState.h, 100, wallState.v);
  const [vr1, vg1, vb1] = hsvToRgb(wallState.h, wallState.s, 100);
  satSlider.style.background = `linear-gradient(90deg, rgb(${sr0},${sg0},${sb0}), rgb(${sr1},${sg1},${sb1}))`;
  valSlider.style.background = `linear-gradient(90deg, #000, rgb(${vr1},${vg1},${vb1}))`;
  svKnob.style.background = wallState.color;
  svKnob.style.left = wallState.s + '%';
  svKnob.style.top = (100 - wallState.v) + '%';
  void hr; void hg; void hb;
}

function applyWallpaper() {
  appEl.style.backgroundColor = wallState.color;
  const mini = $('#wallMiniStage');
  if (mini) mini.style.backgroundColor = wallState.color;
  if (wallState.tab === 'photo' && wallState.imgUrl) {
    appEl.style.backgroundImage = `url("${wallState.imgUrl}")`;
    appEl.style.backgroundSize = wallState.fit;
    if (mini) { mini.style.backgroundImage = `url("${wallState.imgUrl}")`; mini.style.backgroundSize = wallState.fit; }
  } else {
    appEl.style.backgroundImage = 'none';
    if (mini) mini.style.backgroundImage = 'none';
  }
}

let wallSaveTimer = null;
function saveWallpaper() {
  localStorage.setItem('pb.bgColor', wallState.color);
  clearTimeout(wallSaveTimer);
  wallSaveTimer = setTimeout(() => {
    dbTx('prefs', 'readwrite', (s) => s.put({
      tab: wallState.tab,
      color: wallState.color,
      fit: wallState.fit,
      blob: wallState.imgBlob || null,
    }, 'wallpaper')).catch(() => {});
  }, 150);
}

function syncColorUI(skipHex = false) {
  const [r, g, b] = hsvToRgb(wallState.h, wallState.s, wallState.v);
  wallState.color = rgbToHex(r, g, b);
  hueSlider.value = wallState.h;
  satSlider.value = wallState.s;
  valSlider.value = wallState.v;
  hueVal.textContent = wallState.h + '°';
  satVal.textContent = wallState.s + '%';
  valVal.textContent = wallState.v + '%';
  colorSwatch.style.background = wallState.color;
  if (!skipHex) hexInput.value = wallState.color;
  [...colorPresetsEl.children].forEach((b) => b.classList.toggle('active', b.dataset.color === wallState.color));
  drawSV();
  updateSliderTracks();
  applyWallpaper();
  saveWallpaper();
}

function setWallTab(tab) {
  wallState.tab = tab;
  wallTabs.dataset.tab = tab === 'photo' ? '1' : '0';
  wallTabs.querySelectorAll('.wall-tab').forEach((b) => {
    const on = b.dataset.tab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  wallColorPane.hidden = tab !== 'color';
  wallPhotoPane.hidden = tab !== 'photo';
  const pt = $('#wallPaneTitle');
  if (pt) pt.textContent = tab === 'photo' ? 'Wallpaper — Photo' : 'Wallpaper — Color';
  applyWallpaper();
  saveWallpaper();
}

function setWallImage(blob) {
  if (wallState.imgUrl) URL.revokeObjectURL(wallState.imgUrl);
  if (!blob) {
    wallState.imgBlob = null;
    wallState.imgUrl = null;
    wallState.imgEl = null;
    wallThumb.hidden = true;
    wallThumb.removeAttribute('src');
    wallDropMsg.hidden = false;
    wallClearBtn.hidden = true;
    applyWallpaper();
    saveWallpaper();
    updateDock();
    return;
  }
  wallState.imgBlob = blob;
  wallState.imgUrl = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => { wallState.imgEl = img; };
  img.src = wallState.imgUrl;
  wallThumb.src = wallState.imgUrl;
  wallThumb.hidden = false;
  wallDropMsg.hidden = true;
  wallClearBtn.hidden = false;
  setWallTab('photo');
  updateDock();
}

function buildWallpaperUI() {
  PRESET_COLORS.forEach((hex) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'preset';
    b.dataset.color = hex;
    b.style.background = hex;
    b.title = hex;
    b.addEventListener('click', () => {
      const rgb = hexToRgb(hex);
      if (!rgb) return;
      const hsv = rgbToHsv(...rgb);
      if (hsv.s > 0) wallState.h = hsv.h;
      wallState.s = hsv.s;
      wallState.v = hsv.v;
      setWallTab('color');
      syncColorUI();
    });
    colorPresetsEl.appendChild(b);
  });

  wallTabs.querySelectorAll('.wall-tab').forEach((b) => b.addEventListener('click', () => setWallTab(b.dataset.tab)));

  const updateSVFromPointer = (e) => {
    const rect = svCanvas.getBoundingClientRect();
    wallState.s = Math.round(clampN((e.clientX - rect.left) / rect.width, 0, 1) * 100);
    wallState.v = Math.round((1 - clampN((e.clientY - rect.top) / rect.height, 0, 1)) * 100);
    setWallTab('color');
    syncColorUI();
  };
  const svWrap = $('.sv-wrap');
  svWrap.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    svWrap.setPointerCapture(e.pointerId);
    updateSVFromPointer(e);
    const move = (ev) => updateSVFromPointer(ev);
    const up = () => {
      svWrap.removeEventListener('pointermove', move);
      svWrap.removeEventListener('pointerup', up);
      svWrap.removeEventListener('pointercancel', up);
    };
    svWrap.addEventListener('pointermove', move);
    svWrap.addEventListener('pointerup', up);
    svWrap.addEventListener('pointercancel', up);
  });

  hueSlider.addEventListener('input', () => { wallState.h = Number(hueSlider.value); setWallTab('color'); syncColorUI(); });
  satSlider.addEventListener('input', () => { wallState.s = Number(satSlider.value); setWallTab('color'); syncColorUI(); });
  valSlider.addEventListener('input', () => { wallState.v = Number(valSlider.value); setWallTab('color'); syncColorUI(); });

  hexInput.addEventListener('input', () => {
    const rgb = hexToRgb(hexInput.value);
    if (!rgb) return;
    const hsv = rgbToHsv(...rgb);
    if (hsv.s > 0) wallState.h = hsv.h;
    wallState.s = hsv.s;
    wallState.v = hsv.v;
    setWallTab('color');
    syncColorUI(true);
  });
  hexInput.addEventListener('blur', () => { hexInput.value = wallState.color; });
  hexInput.addEventListener('keydown', (e) => e.stopPropagation());

  wallUploadBtn.addEventListener('click', () => wallFile.click());
  wallDrop.addEventListener('click', () => wallFile.click());
  wallFile.addEventListener('change', () => {
    const f = wallFile.files && wallFile.files[0];
    if (f) setWallImage(f);
    wallFile.value = '';
  });
  wallDrop.addEventListener('dragover', (e) => { e.preventDefault(); wallDrop.classList.add('over'); });
  wallDrop.addEventListener('dragleave', () => wallDrop.classList.remove('over'));
  wallDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    wallDrop.classList.remove('over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) setWallImage(f);
  });
  wallClearBtn.addEventListener('click', () => {
    setWallImage(null);
    setWallTab('color');
  });

  $('.fit-seg').querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      wallState.fit = b.dataset.fit;
      $('.fit-seg').querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
      applyWallpaper();
      saveWallpaper();
    });
  });

}

const wallApp = createUtilityApp({
  el: wallWin,
  state: wallState,
  title: 'Wallpaper',
  dockClass: 'wall-running',
  closeBtn: wallClose,
  minBtn: wallMin,
  defaultW: 590,
  defaultH: 438,
  onOpen() {
    drawSV();
    updateSliderTracks();
  },
  renderMinThumb(btn) {
    if (wallState.tab === 'photo' && wallState.imgUrl) {
      btn.innerHTML = `<img alt="" src="${wallState.imgUrl}"><span class="dock-tip">Wallpaper</span>`;
    } else {
      btn.style.background = wallState.color;
      btn.innerHTML = `<span class="dock-tip">Wallpaper</span>`;
    }
  },
});

/* ------------------------- Settings App ------------------------- */
const settingsWin = $('#settingsWin');
const layoutGridEl = $('#layoutGrid');
const settingsState = { open: false, minimized: false, placed: false, x: 0, y: 0, sec: 'layout' };

const settingsApp = createUtilityApp({
  el: settingsWin,
  state: settingsState,
  title: 'Settings',
  dockClass: 'settings-running',
  closeBtn: $('#settingsClose'),
  minBtn: $('#settingsMin'),
  defaultW: 640,
  defaultH: 420,
});

function syncSettingsUI() {
  if (!layoutGridEl) return;
  layoutGridEl.querySelectorAll('.layout-card').forEach((card) => {
    const active = card.dataset.layout === activeLayoutId;
    card.classList.toggle('active', active);
    card.setAttribute('aria-checked', String(active));
  });
}

function buildSettingsUI() {
  const nav = $('#settingsNav');
  if (nav) {
    nav.querySelectorAll('.sb-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        settingsState.sec = btn.dataset.sec;
        nav.querySelectorAll('.sb-nav-btn').forEach((b) => {
          const on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-selected', String(on));
        });
        $('#setPaneLayout').hidden = settingsState.sec !== 'layout';
        $('#setPaneAbout').hidden = settingsState.sec !== 'about';
        $('#settingsPaneTitle').textContent = settingsState.sec === 'about' ? 'About' : 'Layout';
      });
    });
  }

  layoutGridEl.innerHTML = '';
  for (const preset of LAYOUT_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layout-card' + (preset.id === activeLayoutId ? ' active' : '');
    btn.dataset.layout = preset.id;
    btn.title = `${preset.name} (${preset.count} windows)`;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', `${preset.name} (${preset.count} windows)`);
    btn.setAttribute('aria-checked', String(preset.id === activeLayoutId));
    const boxesHtml = preset.boxes.map(([x, y, w, h, f]) =>
      `<span class="lp-win${f ? ' front' : ''}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"></span>`
    ).join('');
    btn.innerHTML = `<div class="layout-preview">${boxesHtml}</div>`;
    btn.addEventListener('click', () => applyLayout(preset.id, true));
    layoutGridEl.appendChild(btn);
  }
}

/* ------------------------- Files App ------------------------- */
const filesWin = $('#filesWin');
const filesTabsEl = $('#filesTabs');
const filesGridEl = $('#filesGrid');
const filesEmptyEl = $('#filesEmpty');
const filesPreviewEl = $('#filesPreview');
const fpMetaEl = $('#fpMeta');
const fpImgEl = $('#fpImg');
const fpVideoEl = $('#fpVideo');
const fpDlBtn = $('#fpDl');
const fpWallBtn = $('#fpWall');
const fpDelBtn = $('#fpDel');
const fpBackBtn = $('#fpBack');

const filesState = { open: false, minimized: false, placed: false, x: 0, y: 0, filter: 'all', selectedId: null, previewUrl: null };

const filesApp = createUtilityApp({
  el: filesWin,
  state: filesState,
  title: 'Files',
  dockClass: 'files-running',
  closeBtn: $('#filesClose'),
  minBtn: $('#filesMin'),
  defaultW: 690,
  defaultH: 460,
  onOpen() { renderFiles(); },
});

function itemCategory(item) {
  if (item.type === 'screenshot') return 'screenshot';
  if (item.type === 'video') return 'video';
  return 'photo';
}

function itemBadgeLabel(item) {
  if (item.type === 'screenshot') return 'SCREENSHOT';
  if (item.type === 'video') return 'MOV';
  if (item.type === '4up') return '4-UP';
  return 'PHOTO';
}

function itemDisplayName(item) {
  if (item.name) return item.name;
  if (item.type === 'video') return `Video ${stamp(item.createdAt)}`;
  if (item.type === 'screenshot') return `Screenshot ${stamp(item.createdAt)}`;
  return `Photo ${stamp(item.createdAt)}`;
}

function closeFilePreview() {
  fpVideoEl.pause();
  fpVideoEl.removeAttribute('src');
  fpVideoEl.load();
  fpImgEl.removeAttribute('src');
  if (filesState.previewUrl) { URL.revokeObjectURL(filesState.previewUrl); filesState.previewUrl = null; }
  filesState.selectedId = null;
  if (fpWallBtn) fpWallBtn.classList.remove('applied');
  filesPreviewEl.hidden = true;
}

function openFilePreview(id) {
  const item = sharedItems.find((i) => i.id === id);
  if (!item) return;
  closeFilePreview();
  filesState.selectedId = id;
  filesState.previewUrl = URL.createObjectURL(item.blob);
  fpMetaEl.textContent = itemDisplayName(item);
  const isVideo = item.type === 'video';
  if (fpWallBtn) {
    fpWallBtn.hidden = isVideo;
    fpWallBtn.classList.remove('applied');
  }
  if (isVideo) {
    fpImgEl.hidden = true;
    fpVideoEl.hidden = false;
    fpVideoEl.src = filesState.previewUrl;
  } else {
    fpVideoEl.hidden = true;
    fpImgEl.hidden = false;
    fpImgEl.src = filesState.previewUrl;
  }
  filesPreviewEl.hidden = false;
}

function downloadFileItem(item) {
  const ext = item.type === 'video' ? (item.mime && item.mime.includes('mp4') ? 'mp4' : 'webm')
    : item.type === 'screenshot' ? 'png' : 'jpg';
  const a = document.createElement('a');
  const u = URL.createObjectURL(item.blob);
  a.href = u;
  a.download = `${itemDisplayName(item)}.${ext}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}

function renderFiles() {
  if (!filesTabsEl) return;
  const counts = { all: sharedItems.length, photo: 0, video: 0, screenshot: 0 };
  for (const item of sharedItems) counts[itemCategory(item)] += 1;
  filesTabsEl.querySelectorAll('em[data-count]').forEach((em) => {
    em.textContent = String(counts[em.dataset.count] || 0);
  });

  if (filesState.selectedId && !sharedItems.some((i) => i.id === filesState.selectedId)) {
    closeFilePreview();
  }

  const list = sharedItems
    .filter((item) => filesState.filter === 'all' || itemCategory(item) === filesState.filter)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);

  filesGridEl.innerHTML = '';
  filesEmptyEl.hidden = list.length > 0;
  for (const item of list) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'file-card';
    const isSS = item.type === 'screenshot';
    const thumbBox = document.createElement('div');
    thumbBox.className = 'file-thumb';
    const imgEl = document.createElement('img');
    imgEl.alt = '';
    imgEl.src = thumbUrl(item);
    const badgeEl = document.createElement('span');
    badgeEl.className = 'file-kind' + (isSS ? ' ss' : '');
    badgeEl.textContent = itemBadgeLabel(item);
    thumbBox.append(imgEl, badgeEl);
    const nameEl = document.createElement('div');
    nameEl.className = 'file-name';
    nameEl.textContent = itemDisplayName(item);
    const dateEl = document.createElement('div');
    dateEl.className = 'file-date';
    dateEl.textContent = stamp(item.createdAt);
    card.append(thumbBox, nameEl, dateEl);
    card.addEventListener('click', () => openFilePreview(item.id));
    filesGridEl.appendChild(card);
  }
}

function buildFilesUI() {
  filesTabsEl.querySelectorAll('.ftab').forEach((tab) => {
    tab.addEventListener('click', () => {
      filesState.filter = tab.dataset.filter;
      filesTabsEl.querySelectorAll('.ftab').forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
      });
      const fpt = $('#filesPaneTitle');
      if (fpt) fpt.textContent = tab.querySelector('span')?.textContent || 'Files';
      closeFilePreview();
      renderFiles();
    });
  });
  fpBackBtn.addEventListener('click', closeFilePreview);
  if (fpWallBtn) {
    fpWallBtn.addEventListener('click', () => {
      const item = sharedItems.find((i) => i.id === filesState.selectedId);
      if (!item || item.type === 'video') return;
      setWallImage(item.blob);
      fpWallBtn.classList.add('applied');
      setTimeout(() => fpWallBtn.classList.remove('applied'), 1200);
    });
  }
  fpDlBtn.addEventListener('click', () => {
    const item = sharedItems.find((i) => i.id === filesState.selectedId);
    if (item) downloadFileItem(item);
  });
  fpDelBtn.addEventListener('click', () => {
    if (filesState.selectedId != null) deleteItem(filesState.selectedId);
  });
}

async function loadWallpaperPref() {
  const initColor = hexToRgb(wallState.color) || [255, 255, 255];
  const hsv = rgbToHsv(...initColor);
  wallState.h = hsv.h; wallState.s = hsv.s; wallState.v = hsv.v;
  syncColorUI();

  try {
    const saved = await dbTx('prefs', 'readonly', (s) => s.get('wallpaper'));
    if (saved) {
      if (saved.color) {
        const rgb = hexToRgb(saved.color);
        if (rgb) {
          const h2 = rgbToHsv(...rgb);
          wallState.h = h2.h; wallState.s = h2.s; wallState.v = h2.v;
          wallState.color = saved.color;
        }
      }
      if (saved.fit) {
        wallState.fit = saved.fit;
        $('.fit-seg').querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.fit === saved.fit));
      }
      if (saved.blob) setWallImage(saved.blob);
      setWallTab(saved.tab === 'photo' && saved.blob ? 'photo' : 'color');
      syncColorUI();
    }
  } catch (_) { /* ignore */ }
}

/* ------------------------- Desktop Screenshot ------------------------- */
const svgCache = new Map();
function svgElementToImage(svgEl) {
  const key = svgEl.outerHTML;
  if (svgCache.has(key)) return Promise.resolve(svgCache.get(key));
  return new Promise((resolve) => {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    const img = new Image();
    img.onload = () => { svgCache.set(key, img); resolve(img); };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function rrect(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function drawImageCover(c, img, iw, ih, dx, dy, dw, dh) {
  if (!iw || !ih) return;
  const s = Math.max(dw / iw, dh / ih);
  const sw = dw / s, sh = dh / s;
  c.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, dx, dy, dw, dh);
}

function drawImageContain(c, img, iw, ih, dx, dy, dw, dh) {
  if (!iw || !ih) return;
  const s = Math.min(dw / iw, dh / ih);
  const rw = iw * s, rh = ih * s;
  c.drawImage(img, dx + (dw - rw) / 2, dy + (dh - rh) / 2, rw, rh);
}

function drawWindowFrame(c, el, titleText, isFocused, radius = 18) {
  const r = el.getBoundingClientRect();
  c.save();
  if (radius > 0) {
    c.shadowColor = isFocused ? 'rgba(0,0,0,0.44)' : 'rgba(0,0,0,0.28)';
    c.shadowBlur = isFocused ? 46 : 32;
    c.shadowOffsetY = isFocused ? 16 : 10;
  }
  rrect(c, r.left, r.top, r.width, r.height, radius);
  c.fillStyle = isFocused ? 'rgba(34,35,42,0.88)' : 'rgba(30,31,36,0.84)';
  c.fill();
  c.restore();

  if (radius > 0) {
    c.save();
    rrect(c, r.left + 0.5, r.top + 0.5, r.width - 1, r.height - 1, radius);
    c.strokeStyle = isFocused ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.18)';
    c.lineWidth = 1;
    c.stroke();
    c.restore();
  }

  // Traffic lights
  const colors = { close: '#ff5f57', min: '#febc2e', max: '#28c840' };
  el.querySelectorAll('.light').forEach((dot) => {
    const dr = dot.getBoundingClientRect();
    c.beginPath();
    c.arc(dr.left + dr.width / 2, dr.top + dr.height / 2, dr.width / 2, 0, Math.PI * 2);
    if (dot.classList.contains('disabled')) c.fillStyle = 'rgba(255,255,255,0.16)';
    else if (!isFocused) c.fillStyle = 'rgba(255,255,255,0.22)';
    else c.fillStyle = dot.classList.contains('close') ? colors.close : dot.classList.contains('min') ? colors.min : colors.max;
    c.fill();
  });

  // Title
  const tb = el.querySelector('.titlebar').getBoundingClientRect();
  c.save();
  c.font = '600 13px -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
  c.fillStyle = isFocused ? 'rgba(255,255,255,0.82)' : 'rgba(255,255,255,0.45)';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(titleText, tb.left + tb.width / 2, tb.top + tb.height / 2);
  c.restore();
}

function drawPhotoBoothWindow(c, inst) {
  const isFocused = inst.el.classList.contains('focused');
  drawWindowFrame(c, inst.el, inst.title, isFocused, inst.winFull ? 0 : 18);

  // Stage
  const sr = inst.stage.getBoundingClientRect();
  c.save();
  rrect(c, sr.left, sr.top, sr.width, sr.height, 16);
  c.clip();
  c.fillStyle = '#000';
  c.fillRect(sr.left, sr.top, sr.width, sr.height);

  if (inst.effectsOpen) {
    const pageEl = inst.el.querySelectorAll('.fx-page')[inst.fxPage];
    if (pageEl) {
      pageEl.querySelectorAll('.fx').forEach((tile) => {
        const tr = tile.getBoundingClientRect();
        const cv = tile.querySelector('canvas');
        if (cv.width && cv.height) drawImageCover(c, cv, cv.width, cv.height, tr.left, tr.top, tr.width, tr.height);
        const label = tile.querySelector('span').textContent;
        const g = c.createLinearGradient(0, tr.bottom - 28, 0, tr.bottom);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.55)');
        c.fillStyle = g;
        c.fillRect(tr.left, tr.bottom - 28, tr.width, 28);
        c.font = '600 12px -apple-system, BlinkMacSystemFont, sans-serif';
        c.fillStyle = '#fff';
        c.textAlign = 'center';
        c.textBaseline = 'bottom';
        c.fillText(label, tr.left + tr.width / 2, tr.bottom - 6);
        if (tile.classList.contains('active')) {
          c.strokeStyle = '#0a84ff';
          c.lineWidth = 3;
          c.strokeRect(tr.left + 1.5, tr.top + 1.5, tr.width - 3, tr.height - 3);
        }
      });
    }
  } else if (inst.view === 'item') {
    const img = inst.el.querySelector('.viewer-img');
    const vid = inst.el.querySelector('.viewer-video');
    if (!img.hidden && img.naturalWidth) drawImageContain(c, img, img.naturalWidth, img.naturalHeight, sr.left, sr.top, sr.width, sr.height);
    else if (!vid.hidden && vid.videoWidth) drawImageContain(c, vid, vid.videoWidth, vid.videoHeight, sr.left, sr.top, sr.width, sr.height);
  } else if (inst.canvas.width && inst.canvas.height) {
    drawImageCover(c, inst.canvas, inst.canvas.width, inst.canvas.height, sr.left, sr.top, sr.width, sr.height);
  }
  c.restore();

  // Library thumbnails
  if (!inst.el.classList.contains('lib-empty')) {
    const lr = inst.el.querySelector('.library').getBoundingClientRect();
    c.save();
    c.beginPath();
    c.rect(lr.left, lr.top, lr.width, lr.height);
    c.clip();
    inst.el.querySelectorAll('.thumb').forEach((th) => {
      const tr = th.getBoundingClientRect();
      const img = th.querySelector('img');
      c.save();
      rrect(c, tr.left, tr.top, tr.width, tr.height, 6);
      c.clip();
      if (img && img.naturalWidth) drawImageCover(c, img, img.naturalWidth, img.naturalHeight, tr.left, tr.top, tr.width, tr.height);
      c.restore();
      if (th.classList.contains('active')) {
        c.save();
        rrect(c, tr.left, tr.top, tr.width, tr.height, 6);
        c.strokeStyle = '#0a84ff';
        c.lineWidth = 2.5;
        c.stroke();
        c.restore();
      }
    });
    c.restore();
  }

  // Segmented modes
  const mr = inst.el.querySelector('.modes').getBoundingClientRect();
  c.save();
  rrect(c, mr.left, mr.top, mr.width, mr.height, 7);
  c.fillStyle = 'rgba(255,255,255,0.12)';
  c.fill();
  const ind = inst.el.querySelector('.modes .ind').getBoundingClientRect();
  rrect(c, ind.left, ind.top, ind.width, ind.height, 5);
  c.fillStyle = '#0a7aff';
  c.fill();
  c.strokeStyle = '#fff';
  c.lineWidth = 1.5;
  inst.el.querySelectorAll('.mode').forEach((m) => {
    const br = m.getBoundingClientRect();
    const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
    c.strokeStyle = m.classList.contains('active') ? '#fff' : 'rgba(255,255,255,0.75)';
    if (m.dataset.mode === '4up') {
      c.strokeRect(cx - 6, cy - 6, 5, 5); c.strokeRect(cx + 1, cy - 6, 5, 5);
      c.strokeRect(cx - 6, cy + 1, 5, 5); c.strokeRect(cx + 1, cy + 1, 5, 5);
    } else if (m.dataset.mode === 'photo') {
      rrect(c, cx - 6.5, cy - 6.5, 13, 13, 2); c.stroke();
      c.beginPath(); c.arc(cx, cy - 1.5, 2, 0, Math.PI * 2); c.stroke();
    } else {
      rrect(c, cx - 7, cy - 4.5, 9.5, 9, 2); c.stroke();
      c.beginPath(); c.moveTo(cx + 3.5, cy - 1.5); c.lineTo(cx + 7, cy - 4); c.lineTo(cx + 7, cy + 4); c.lineTo(cx + 3.5, cy + 1.5); c.closePath(); c.stroke();
    }
  });
  c.restore();

  // Red shutter
  const sh = inst.el.querySelector('.shutter').getBoundingClientRect();
  const scx = sh.left + sh.width / 2, scy = sh.top + sh.height / 2, srR = sh.width / 2;
  c.save();
  c.beginPath(); c.arc(scx, scy, srR + 3, 0, Math.PI * 2);
  c.fillStyle = 'rgba(255,255,255,0.14)'; c.fill();
  const sg = c.createRadialGradient(scx, scy - srR * 0.4, 2, scx, scy, srR);
  sg.addColorStop(0, '#ff6d61');
  sg.addColorStop(0.6, '#e3170b');
  sg.addColorStop(1, '#b50d04');
  c.beginPath(); c.arc(scx, scy, srR, 0, Math.PI * 2);
  c.fillStyle = sg; c.fill();
  c.fillStyle = '#fff';
  if (inst.recording) {
    rrect(c, scx - 7, scy - 7, 14, 14, 3); c.fill();
  } else if (inst.mode === 'video') {
    rrect(c, scx - 10, scy - 6, 13, 12, 2.5); c.fill();
    c.beginPath(); c.moveTo(scx + 4, scy - 2.5); c.lineTo(scx + 10, scy - 6); c.lineTo(scx + 10, scy + 6); c.lineTo(scx + 4, scy + 2.5); c.fill();
  } else {
    rrect(c, scx - 10, scy - 6, 20, 14, 2.5); c.fill();
    c.beginPath(); c.moveTo(scx - 4.5, scy - 6); c.lineTo(scx - 3, scy - 8.5); c.lineTo(scx + 3, scy - 8.5); c.lineTo(scx + 4.5, scy - 6); c.fill();
    c.fillStyle = '#d4190e';
    c.beginPath(); c.arc(scx, scy + 1, 3.8, 0, Math.PI * 2); c.fill();
  }
  c.restore();

  // Effects button (icon)
  const er = inst.el.querySelector('.effects-btn').getBoundingClientRect();
  const ecx = er.left + er.width / 2, ecy = er.top + er.height / 2;
  c.save();
  rrect(c, er.left, er.top, er.width, er.height, 8);
  c.fillStyle = inst.effectsOpen ? '#0a84ff' : 'rgba(255,255,255,0.14)';
  c.fill();
  c.strokeStyle = '#fff';
  c.lineWidth = 1.6;
  if (inst.effectsOpen) {
    c.beginPath();
    c.moveTo(ecx - 4.5, ecy);
    c.lineTo(ecx - 1, ecy + 3.5);
    c.lineTo(ecx + 5, ecy - 3.5);
    c.stroke();
  } else {
    const r0 = 3.4, off = 2.5;
    [[0, -off], [-off * 0.9, off * 0.7], [off * 0.9, off * 0.7]].forEach(([dx, dy]) => {
      c.beginPath(); c.arc(ecx + dx, ecy + dy, r0, 0, Math.PI * 2); c.stroke();
    });
  }
  c.restore();
}

function drawMacSplitFrame(c, winEl, paneTitle) {
  const isFocused = winEl.classList.contains('focused');
  const wr = winEl.getBoundingClientRect();
  drawWindowFrame(c, winEl, '', isFocused, 18);
  const sb = winEl.querySelector('.mac-sidebar').getBoundingClientRect();
  c.save();
  rrect(c, wr.left, wr.top, wr.width, wr.height, 18);
  c.clip();
  c.fillStyle = 'rgba(255,255,255,0.04)';
  c.fillRect(sb.left, sb.top, sb.width, sb.height);
  c.strokeStyle = 'rgba(255,255,255,0.1)';
  c.beginPath(); c.moveTo(sb.right, sb.top); c.lineTo(sb.right, sb.bottom); c.stroke();
  const topR = winEl.querySelector('.mac-main-top').getBoundingClientRect();
  c.beginPath(); c.moveTo(topR.left, topR.bottom); c.lineTo(topR.right, topR.bottom); c.stroke();
  c.font = '600 15px -apple-system, BlinkMacSystemFont, sans-serif';
  c.fillStyle = isFocused ? 'rgba(255,255,255,0.94)' : 'rgba(255,255,255,0.55)';
  c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(paneTitle, topR.left + 18, topR.top + topR.height / 2);
  c.restore();
}

function drawWallpaperWindow(c) {
  drawMacSplitFrame(c, wallWin, $('#wallPaneTitle')?.textContent || 'Wallpaper');
  const mini = $('#wallMiniStage')?.getBoundingClientRect();
  if (mini && mini.width) {
    c.save();
    rrect(c, mini.left, mini.top, mini.width, mini.height, 9);
    c.clip();
    c.fillStyle = wallState.color;
    c.fillRect(mini.left, mini.top, mini.width, mini.height);
    if (wallState.tab === 'photo' && wallState.imgEl && wallState.imgEl.complete) {
      drawImageCover(c, wallState.imgEl, wallState.imgEl.naturalWidth, wallState.imgEl.naturalHeight, mini.left, mini.top, mini.width, mini.height);
    }
    c.restore();
  }
  c.save();
  c.font = '500 13px -apple-system, BlinkMacSystemFont, sans-serif';
  c.textAlign = 'left'; c.textBaseline = 'middle';
  wallTabs.querySelectorAll('.wall-tab').forEach((tab) => {
    const r = tab.getBoundingClientRect();
    if (tab.classList.contains('active')) {
      rrect(c, r.left, r.top, r.width, r.height, 9);
      c.fillStyle = '#0a84ff'; c.fill();
    }
    c.fillStyle = tab.classList.contains('active') ? '#fff' : 'rgba(255,255,255,0.8)';
    c.fillText(tab.textContent.trim(), r.left + 38, r.top + r.height / 2);
  });
  c.restore();

  if (wallState.tab === 'color') {
    const svr = svCanvas.getBoundingClientRect();
    c.save();
    rrect(c, svr.left, svr.top, svr.width, svr.height, 10);
    c.clip();
    c.drawImage(svCanvas, svr.left, svr.top, svr.width, svr.height);
    const kr = $('#svKnob').getBoundingClientRect();
    c.beginPath();
    c.arc(kr.left + kr.width / 2, kr.top + kr.height / 2, 6, 0, Math.PI * 2);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    c.restore();

    c.save();
    c.font = '12px -apple-system, BlinkMacSystemFont, sans-serif';
    wallWin.querySelectorAll('.slider-row').forEach((row) => {
      const label = row.querySelector('span')?.textContent || '';
      const rng = row.querySelector('input[type="range"]');
      const outEl = row.querySelector('output');
      const rr = row.getBoundingClientRect();
      const ir = rng.getBoundingClientRect();
      c.fillStyle = 'rgba(255,255,255,0.78)';
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(label, rr.left, rr.top + rr.height / 2);

      const ty = ir.top + ir.height / 2 - 4;
      rrect(c, ir.left, ty, ir.width, 8, 4);
      if (rng.id === 'hueSlider') {
        const g = c.createLinearGradient(ir.left, 0, ir.right, 0);
        ['#ff0000', '#ffff00', '#00ff00', '#00ffff', '#0000ff', '#ff00ff', '#ff0000'].forEach((col, i) => g.addColorStop(i / 6, col));
        c.fillStyle = g;
      } else if (rng.id === 'satSlider') {
        const g = c.createLinearGradient(ir.left, 0, ir.right, 0);
        g.addColorStop(0, rgbToHex(...hsvToRgb(wallState.h, 0, wallState.v)));
        g.addColorStop(1, rgbToHex(...hsvToRgb(wallState.h, 100, wallState.v)));
        c.fillStyle = g;
      } else {
        const g = c.createLinearGradient(ir.left, 0, ir.right, 0);
        g.addColorStop(0, '#000000');
        g.addColorStop(1, rgbToHex(...hsvToRgb(wallState.h, wallState.s, 100)));
        c.fillStyle = g;
      }
      c.fill();

      const frac = (+rng.value - +rng.min) / (+rng.max - +rng.min || 1);
      const kx = ir.left + 8 + frac * (ir.width - 16);
      c.beginPath(); c.arc(kx, ir.top + ir.height / 2, 7.5, 0, Math.PI * 2);
      c.fillStyle = '#fff'; c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.28)'; c.lineWidth = 1; c.stroke();

      c.fillStyle = 'rgba(255,255,255,0.72)';
      c.textAlign = 'right';
      c.fillText(outEl ? outEl.textContent : '', rr.right, rr.top + rr.height / 2);
    });

    const sw = colorSwatch.getBoundingClientRect();
    c.beginPath(); c.arc(sw.left + sw.width / 2, sw.top + sw.height / 2, sw.width / 2, 0, Math.PI * 2);
    c.fillStyle = wallState.color; c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.32)'; c.stroke();
    const hx = $('.hex-field').getBoundingClientRect();
    rrect(c, hx.left, hx.top, hx.width, hx.height, 7);
    c.fillStyle = 'rgba(0,0,0,0.28)'; c.fill();
    c.font = '12.5px ui-monospace, Menlo, monospace';
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(wallState.color, hx.left + hx.width / 2, hx.top + hx.height / 2);
    colorPresetsEl.querySelectorAll('.preset').forEach((p) => {
      const pr = p.getBoundingClientRect();
      c.beginPath(); c.arc(pr.left + pr.width / 2, pr.top + pr.height / 2, pr.width / 2, 0, Math.PI * 2);
      c.fillStyle = p.dataset.color; c.fill();
    });
    c.restore();
  } else {
    const dr = wallDrop.getBoundingClientRect();
    c.save();
    rrect(c, dr.left, dr.top, dr.width, dr.height, 10);
    if (wallState.imgEl && wallState.imgEl.complete) {
      c.clip();
      drawImageCover(c, wallState.imgEl, wallState.imgEl.naturalWidth, wallState.imgEl.naturalHeight, dr.left, dr.top, dr.width, dr.height);
    } else {
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.fill();
      c.setLineDash([5, 4]);
      c.strokeStyle = 'rgba(255,255,255,0.28)';
      c.stroke();
      c.setLineDash([]);
      c.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
      c.fillStyle = 'rgba(255,255,255,0.72)';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('Drop or upload a photo', dr.left + dr.width / 2, dr.top + dr.height / 2);
    }
    c.restore();

    c.save();
    c.font = '500 13px -apple-system, BlinkMacSystemFont, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    [wallUploadBtn, wallClearBtn].forEach((btn) => {
      if (!btn || btn.hidden) return;
      const br = btn.getBoundingClientRect();
      if (!br.width) return;
      rrect(c, br.left, br.top, br.width, br.height, 7);
      c.fillStyle = btn.classList.contains('primary') ? '#0a84ff' : 'rgba(255,69,58,0.24)';
      c.fill();
      c.strokeStyle = btn.classList.contains('primary') ? '#fff' : '#ff8a80';
      c.lineWidth = 1.6;
      const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
      c.beginPath();
      if (btn === wallUploadBtn) {
        c.moveTo(cx, cy + 3); c.lineTo(cx, cy - 5);
        c.moveTo(cx - 3.5, cy - 1.5); c.lineTo(cx, cy - 5); c.lineTo(cx + 3.5, cy - 1.5);
        c.moveTo(cx - 5, cy + 5); c.lineTo(cx + 5, cy + 5);
      } else {
        c.moveTo(cx - 4.5, cy - 3); c.lineTo(cx + 4.5, cy - 3);
        c.moveTo(cx - 3, cy - 3); c.lineTo(cx - 2.5, cy + 4.5); c.lineTo(cx + 2.5, cy + 4.5); c.lineTo(cx + 3, cy - 3);
      }
      c.stroke();
    });

    const fitRow = $('#wallFitRow');
    if (fitRow && !fitRow.hidden) {
      const lbl = fitRow.querySelector('span').getBoundingClientRect();
      c.font = '12.5px -apple-system, BlinkMacSystemFont, sans-serif';
      c.fillStyle = 'rgba(255,255,255,0.78)';
      c.textAlign = 'left';
      c.fillText('Fit', lbl.left, lbl.top + lbl.height / 2);
      const seg = fitRow.querySelector('.fit-seg').getBoundingClientRect();
      rrect(c, seg.left, seg.top, seg.width, seg.height, 8);
      c.fillStyle = 'rgba(255,255,255,0.12)'; c.fill();
      fitRow.querySelectorAll('button').forEach((b) => {
        const br = b.getBoundingClientRect();
        if (b.classList.contains('active')) {
          rrect(c, br.left, br.top, br.width, br.height, 6);
          c.fillStyle = 'rgba(255,255,255,0.24)'; c.fill();
        }
        const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
        c.strokeStyle = b.classList.contains('active') ? '#fff' : 'rgba(255,255,255,0.72)';
        c.lineWidth = 1.4;
        rrect(c, cx - 5.5, cy - 4.5, 11, 9, 1.5); c.stroke();
      });
    }
    c.restore();
  }
}

let toastTimer = null;
let toastUrl = null;
let lastShotItem = null;
const shotToastEl = $('#shotToast');

function hideShotToast() {
  clearTimeout(toastTimer);
  if (shotToastEl) shotToastEl.hidden = true;
}

function scheduleShotToastHide() {
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideShotToast, 4500);
}

function openLastShotInFiles() {
  hideShotToast();
  if (!lastShotItem) return;
  filesApp.open();
  const shotTab = filesTabsEl?.querySelector('.ftab[data-filter="screenshot"]');
  if (shotTab) shotTab.click();
  openFilePreview(lastShotItem.id);
}

if (shotToastEl) {
  shotToastEl.addEventListener('mouseenter', () => clearTimeout(toastTimer));
  shotToastEl.addEventListener('mouseleave', () => {
    if (!shotToastEl.hidden) scheduleShotToastHide();
  });
  shotToastEl.addEventListener('click', (e) => {
    if (e.target.closest('.shot-toast-act')) return;
    openLastShotInFiles();
  });
  shotToastEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.code === 'Space') {
      e.preventDefault();
      e.stopPropagation();
      openLastShotInFiles();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      hideShotToast();
    }
  });
  $('#shotToastClose')?.addEventListener('click', (e) => {
    e.stopPropagation();
    hideShotToast();
  });
  $('#shotToastDl')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (lastShotItem) downloadFileItem(lastShotItem);
    hideShotToast();
  });
}

async function takeDesktopScreenshot() {
  const W = innerWidth, H = innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const out = document.createElement('canvas');
  out.width = Math.round(W * dpr);
  out.height = Math.round(H * dpr);
  const c = out.getContext('2d');
  c.scale(dpr, dpr);

  // 1. Wallpaper
  c.fillStyle = wallState.color;
  c.fillRect(0, 0, W, H);
  if (wallState.tab === 'photo' && wallState.imgEl && wallState.imgEl.complete) {
    const img = wallState.imgEl, iw = img.naturalWidth, ih = img.naturalHeight;
    if (wallState.fit === 'cover') drawImageCover(c, img, iw, ih, 0, 0, W, H);
    else if (wallState.fit === 'contain') drawImageContain(c, img, iw, ih, 0, 0, W, H);
    else if (wallState.fit === '100% 100%') c.drawImage(img, 0, 0, W, H);
    else c.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
  }

  // 2. Visible windows sorted back-to-front by zIndex
  const layers = [];
  for (const w of windows) {
    if (!w.minimized && !w.closing) layers.push({ type: 'pb', inst: w, z: Number(w.el.style.zIndex) || 0 });
  }
  for (const app of utilApps) {
    if (app.state.open && !app.state.minimized && !app.el.hidden) {
      layers.push({ type: app.dockClass, z: Number(app.el.style.zIndex) || 0 });
    }
  }
  layers.sort((a, b) => a.z - b.z);
  for (const l of layers) {
    if (l.type === 'pb') drawPhotoBoothWindow(c, l.inst);
    else if (l.type === 'wall-running') drawWallpaperWindow(c);
    else if (l.type === 'settings-running') drawSettingsWindow(c);
    else if (l.type === 'files-running') drawFilesWindow(c);
  }

  // 3. Dock (unless hidden by a fullscreen window)
  if (!document.body.classList.contains('has-full')) {
    const dr = dock.getBoundingClientRect();
    c.save();
    c.shadowColor = 'rgba(0,0,0,0.18)';
    c.shadowBlur = 24;
    c.shadowOffsetY = 8;
    rrect(c, dr.left, dr.top, dr.width, dr.height, 20);
    c.fillStyle = 'rgba(235, 236, 240, 0.78)';
    c.fill();
    c.restore();

    const icons = [
      { btn: dockApp, dot: dock.classList.contains('pb-running') },
      { btn: dockWall, dot: dock.classList.contains('wall-running') },
      { btn: dockFiles, dot: dock.classList.contains('files-running') },
      { btn: dockSettings, dot: dock.classList.contains('settings-running') },
      { btn: dockShot, dot: false },
    ];
    for (const item of icons) {
      const ir = item.btn.getBoundingClientRect();
      const svgImg = await svgElementToImage(item.btn.querySelector('svg'));
      if (svgImg) c.drawImage(svgImg, ir.left, ir.top, ir.width, ir.height);
      if (item.dot) {
        c.beginPath();
        c.arc(ir.left + ir.width / 2, ir.bottom + 4, 2, 0, Math.PI * 2);
        c.fillStyle = 'rgba(0,0,0,0.65)';
        c.fill();
      }
    }

    if (!dockDivider.hidden) {
      const divR = dockDivider.getBoundingClientRect();
      c.fillStyle = 'rgba(0,0,0,0.16)';
      c.fillRect(divR.left, divR.top, 1, divR.height);
      dockMin.querySelectorAll('.dock-min-item').forEach((m) => {
        const mr = m.getBoundingClientRect();
        rrect(c, mr.left, mr.top, mr.width, mr.height, 7);
        c.fillStyle = m.style.background || '#333';
        c.fill();
        const img = m.querySelector('img');
        if (img && img.complete && img.naturalWidth) {
          c.save(); rrect(c, mr.left, mr.top, mr.width, mr.height, 7); c.clip();
          drawImageCover(c, img, img.naturalWidth, img.naturalHeight, mr.left, mr.top, mr.width, mr.height);
          c.restore();
        }
      });
    }
  }

  flash();
  try {
    const blob = await toBlob(out, 'image/png', 1);
    if (!blob) return;
    const now = Date.now();
    const baseName = `Photo Booth Desktop ${stamp(now)}`;
    const thumb = await makeThumb(out);
    const saved = await addItem({ type: 'screenshot', blob, thumb, mime: 'image/png', createdAt: now, name: baseName });
    lastShotItem = saved;

    if (toastUrl) URL.revokeObjectURL(toastUrl);
    toastUrl = URL.createObjectURL(blob);
    $('#shotPreview').src = toastUrl;
    if (shotToastEl) {
      shotToastEl.hidden = false;
      scheduleShotToastHide();
    }
  } catch (err) {
    console.error('Screenshot export failed:', err);
  }
}

function drawSettingsWindow(c) {
  drawMacSplitFrame(c, settingsWin, $('#settingsPaneTitle')?.textContent || 'Settings');
  c.save();
  settingsWin.querySelectorAll('.sb-nav-btn').forEach((btn) => {
    const r = btn.getBoundingClientRect();
    if (btn.classList.contains('active')) {
      rrect(c, r.left, r.top, r.width, r.height, 9);
      c.fillStyle = '#0a84ff'; c.fill();
    }
    c.font = '500 13px -apple-system, BlinkMacSystemFont, sans-serif';
    c.fillStyle = btn.classList.contains('active') ? '#fff' : 'rgba(255,255,255,0.82)';
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(btn.textContent.trim(), r.left + 38, r.top + r.height / 2);
  });
  if (settingsState.sec !== 'about') {
    layoutGridEl.querySelectorAll('.layout-card').forEach((card) => {
      const cr = card.getBoundingClientRect();
      rrect(c, cr.left, cr.top, cr.width, cr.height, 12);
      c.fillStyle = card.classList.contains('active') ? 'rgba(10,132,255,0.18)' : 'rgba(255,255,255,0.06)';
      c.fill();
      c.strokeStyle = card.classList.contains('active') ? '#0a84ff' : 'rgba(255,255,255,0.1)';
      c.lineWidth = 1.5; c.stroke();
      const pv = card.querySelector('.layout-preview').getBoundingClientRect();
      rrect(c, pv.left, pv.top, pv.width, pv.height, 8);
      c.fillStyle = 'rgba(14,15,20,0.85)'; c.fill();
      card.querySelectorAll('.lp-win').forEach((box) => {
        const br = box.getBoundingClientRect();
        rrect(c, br.left, br.top, br.width, br.height, 3.5);
        c.fillStyle = box.classList.contains('front') ? 'rgba(10,132,255,0.45)' : 'rgba(255,255,255,0.22)';
        c.fill();
      });
    });
  }
  c.restore();
}

function drawFilesWindow(c) {
  drawMacSplitFrame(c, filesWin, $('#filesPaneTitle')?.textContent || 'Files');
  c.save();
  c.font = '500 13px -apple-system, BlinkMacSystemFont, sans-serif';
  c.textAlign = 'left'; c.textBaseline = 'middle';
  filesTabsEl.querySelectorAll('.ftab').forEach((tab) => {
    const tr = tab.getBoundingClientRect();
    if (tab.classList.contains('active')) {
      rrect(c, tr.left, tr.top, tr.width, tr.height, 9);
      c.fillStyle = '#0a84ff'; c.fill();
    }
    c.fillStyle = tab.classList.contains('active') ? '#fff' : 'rgba(255,255,255,0.82)';
    c.fillText(tab.querySelector('span').textContent, tr.left + 38, tr.top + tr.height / 2);
  });
  filesGridEl.querySelectorAll('.file-card').forEach((card) => {
    const cr = card.getBoundingClientRect();
    rrect(c, cr.left, cr.top, cr.width, cr.height, 11);
    c.fillStyle = 'rgba(255,255,255,0.06)'; c.fill();
    const img = card.querySelector('img');
    const ir = card.querySelector('.file-thumb').getBoundingClientRect();
    if (img && img.complete && img.naturalWidth) {
      c.save(); rrect(c, ir.left, ir.top, ir.width, ir.height, 7); c.clip();
      drawImageCover(c, img, img.naturalWidth, img.naturalHeight, ir.left, ir.top, ir.width, ir.height);
      c.restore();
    }
  });
  c.restore();
}

/* --------------------- Desktop Screenshot Countdown --------------------- */
const shotCountdownEl = $('#shotCountdown');
const shotCountNumEl = $('#shotCountNum');
let shotCtl = null;

async function triggerScreenshotCountdown() {
  if (shotCtl) {
    shotCtl.cancelled = true;
    shotCtl = null;
    shotCountdownEl.hidden = true;
    return;
  }
  const ctl = { cancelled: false };
  shotCtl = ctl;
  try {
    shotCountdownEl.hidden = false;
    for (let i = 3; i >= 1; i--) {
      if (ctl.cancelled) return;
      shotCountNumEl.textContent = String(i);
      shotCountdownEl.classList.remove('tick');
      void shotCountdownEl.offsetWidth;
      shotCountdownEl.classList.add('tick');
      beep(i === 1 ? 1100 : 760, 0.09);
      await sleep(850, ctl);
    }
    shotCountdownEl.hidden = true;
    await new Promise((r) => requestAnimationFrame(r));
    if (!ctl.cancelled) await takeDesktopScreenshot();
  } catch (e) {
    if (e !== 'cancelled') console.error(e);
  } finally {
    shotCountdownEl.hidden = true;
    shotCountdownEl.classList.remove('tick');
    if (shotCtl === ctl) shotCtl = null;
  }
}

/* ----------------------------- Global Events ----------------------------- */
function bounceDock(btn) {
  btn.classList.remove('bouncing');
  void btn.offsetWidth;
  btn.classList.add('bouncing');
}

dockApp.addEventListener('click', () => {
  bounceDock(dockApp);
  const visible = windows.filter((w) => !w.minimized && !w.closing);
  const minimized = windows.filter((w) => w.minimized && !w.closing);
  if (visible.length === 0 && minimized.length > 0) {
    minimized[minimized.length - 1].restore();
  } else {
    createWindow({ effectId: 'normal', cascaded: visible.length > 0 });
  }
});

dockWall.addEventListener('click', () => { bounceDock(dockWall); wallApp.open(); });
dockFiles.addEventListener('click', () => { bounceDock(dockFiles); filesApp.open(); });
dockSettings.addEventListener('click', () => { bounceDock(dockSettings); settingsApp.open(); });
dockShot.addEventListener('click', () => { bounceDock(dockShot); triggerScreenshotCountdown(); });

addEventListener('resize', () => {
  for (const w of windows) {
    if (!w.winFull && !w.minimized) w.applyWin('fit');
  }
  for (const app of utilApps) {
    if (app.state.open && !app.state.minimized) {
      const w = app.el.offsetWidth;
      app.state.x = clampN(app.state.x, 0, Math.max(0, innerWidth - w));
      app.state.y = clampN(app.state.y, 0, Math.max(0, innerHeight - 40));
      app.el.style.left = app.state.x + 'px';
      app.el.style.top = app.state.y + 'px';
    }
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (shotCtl) { shotCtl.cancelled = true; return; }
    if (shotToastEl && !shotToastEl.hidden) { hideShotToast(); return; }
    if (focusedEl === filesWin && filesPreviewEl && !filesPreviewEl.hidden) { closeFilePreview(); return; }
  }
  const w = focusedWin;
  if (!w || w.minimized || w.closing) return;
  if (e.code === 'Space') {
    if (['INPUT', 'TEXTAREA', 'SELECT', 'VIDEO'].includes(e.target.tagName)) return;
    e.preventDefault();
    if (!e.repeat) w.onShutter(e);
  } else if (w.effectsOpen && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    w.setFxPage(w.fxPage + (e.key === 'ArrowRight' ? 1 : -1));
  } else if (e.key === 'Escape') {
    if (w.busy && w.ctl) w.ctl.cancelled = true;
    else if (w.effectsOpen) w.toggleEffects(false);
    else if (w.view === 'item') w.closeItem();
    else if (w.winFull) w.toggleWinFull(false);
  }
});
document.addEventListener('keyup', (e) => { if (e.code === 'Space') e.preventDefault(); });

/* ----------------------------- Render Loop ----------------------------- */
function loop() {
  requestAnimationFrame(loop);
  if (document.hidden) return;
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return;
  if (cameraAR !== vw / vh) {
    cameraAR = vw / vh;
    document.documentElement.style.setProperty('--ar', cameraAR.toFixed(4));
    for (const w of windows) {
      if (w.winReady && !w.winFull && !w.minimized) w.applyWin('fit');
    }
  }
  const needsLive = windows.some((w) => !w.minimized && !w.closing && (w.effectsOpen || w.view === 'live'));
  if (!needsLive) return;
  uploadFrame();
  for (const w of windows) {
    if (w.minimized || w.closing) continue;
    if (w.canvas.width !== vw || w.canvas.height !== vh) {
      w.canvas.width = vw; w.canvas.height = vh;
    }
    if (w.effectsOpen) w.renderTiles();
    else if (w.view === 'live') w.renderScene(w.ctx, vw, vh);
  }
}

/* -------------------------------- Init -------------------------------- */
initFX();
buildWallpaperUI();
buildSettingsUI();
buildFilesUI();
loadWallpaperPref();
initDefaultWindows();
loadItems();
startCamera();
requestAnimationFrame(loop);
