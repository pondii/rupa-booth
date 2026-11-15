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

function flashBlink() {
  const f = $('#flashOverlay');
  beep(1400, 0.04, 0.1);
  if (!f) return;
  clearTimeout(flashFadeTimer);
  f.classList.remove('fade');
  f.style.background = '#ffffff';
  f.style.opacity = '0.45';
  requestAnimationFrame(() => requestAnimationFrame(() => {
    f.classList.add('fade');
    f.style.opacity = '0';
  }));
}

let flashFadeTimer = null;
const FLASH_PRESETS = ['#FFFFFF', '#FFF1D6', '#FFD9E8', '#DCEEFF'];
const DEFAULT_FLASH_CFG = { mode: 'flash', color: '#FFFFFF', brightness: 92 };
let flashCfg = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem('pb.flashCfg') || 'null');
    if (raw && typeof raw === 'object') {
      return {
        mode: raw.mode === 'fill' ? 'fill' : 'flash',
        color: /^#[0-9a-fA-F]{6}$/.test(raw.color || '') ? raw.color.toUpperCase() : '#FFFFFF',
        brightness: Math.max(20, Math.min(100, Number(raw.brightness) || 92)),
      };
    }
  } catch (_) { /* ignore */ }
  return { ...DEFAULT_FLASH_CFG };
})();

function hexToRgba(hex, a) {
  const [r, g, b] = hexToRgb(hex) || [255, 255, 255];
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

function saveFlashCfg() {
  try { localStorage.setItem('pb.flashCfg', JSON.stringify(flashCfg)); } catch (_) { /* ignore */ }
}

function clearFlashOverlay() {
  const f = $('#flashOverlay');
  if (!f) return;
  clearTimeout(flashFadeTimer);
  f.classList.remove('fade');
  f.style.opacity = '0';
}

async function triggerPreFlash(ctl) {
  const f = $('#flashOverlay');
  if (!f) return;
  clearTimeout(flashFadeTimer);
  f.classList.remove('fade');
  f.style.background = flashCfg.color;
  f.style.opacity = String(Math.max(0.2, Math.min(1, flashCfg.brightness / 100)));
  await sleep(380, ctl);
}

function endPreFlash() {
  const f = $('#flashOverlay');
  beep(1400, 0.04, 0.1);
  if (!f) return;
  clearTimeout(flashFadeTimer);
  f.classList.add('fade');
  f.style.opacity = '0';
  flashFadeTimer = setTimeout(() => f.classList.remove('fade'), 450);
}

function flashLightMetrics() {
  const b = Math.max(20, Math.min(100, flashCfg.brightness));
  const t = (b - 20) / 80; // 0 at 20%, 1 at 100%
  const maxRing = Math.round(Math.min(76, Math.max(28, Math.min(innerWidth, innerHeight) * 0.095)));
  const minRing = 10;
  return {
    t,
    ring: Math.round(minRing + t * (maxRing - minRing)),
    rad: Math.round(16 + t * 22),
    blur: Math.round(22 + t * 108),
    spread: Math.round(6 + t * 30),
    color: hexToRgba(flashCfg.color, 0.50 + t * 0.48),
    glow: hexToRgba(flashCfg.color, 0.18 + t * 0.60),
  };
}

let shotVideoActive = false;
function updateFillLight() {
  const el = $('#fillLightOverlay');
  if (!el) return;
  const anyPBRec = windows.some((w) => w.recording && w.flashOn && !w.closing);
  const focusedPB = focusedWin && !focusedWin.minimized && !focusedWin.closing && focusedWin.flashOn && flashCfg.mode === 'fill';
  const settingsPreview = settingsState.open && !settingsState.minimized && settingsState.sec === 'flash' && flashCfg.mode === 'fill';
  const active = (shotVideoActive && shotState.flashOn) || anyPBRec || Boolean(focusedPB) || settingsPreview;
  el.hidden = !active;
  if (active) {
    const m = flashLightMetrics();
    el.style.setProperty('--fl-ring', `${m.ring}px`);
    el.style.setProperty('--fl-rad', `${m.rad}px`);
    el.style.setProperty('--fl-blur', `${m.blur}px`);
    el.style.setProperty('--fl-spread', `${m.spread}px`);
    el.style.setProperty('--fl-color', m.color);
    el.style.setProperty('--fl-glow', m.glow);
  }
}

function cancelCtl(ctl) {
  if (!ctl || ctl.cancelled) return;
  ctl.cancelled = true;
  if (typeof ctl.abort === 'function') ctl.abort();
}

const DEFAULT_TIMER_CFG = { preset: '3', custom: 10 };
const clampCustomTimer = (n) => Math.max(1, Math.min(30, Math.round(Number(n) || 10)));
let timerCfg = (() => {
  try {
    const raw = JSON.parse(localStorage.getItem('pb.timerCfg') || 'null');
    if (raw && typeof raw === 'object') {
      const preset = ['0', '3', '5', 'custom'].includes(String(raw.preset)) ? String(raw.preset) : '3';
      return { preset, custom: clampCustomTimer(raw.custom) };
    }
  } catch (_) { /* ignore */ }
  return { ...DEFAULT_TIMER_CFG };
})();

function saveTimerCfg() {
  try { localStorage.setItem('pb.timerCfg', JSON.stringify(timerCfg)); } catch (_) { /* ignore */ }
}

function getTimerSeconds() {
  if (timerCfg.preset === '0') return 0;
  if (timerCfg.preset === '3') return 3;
  if (timerCfg.preset === '5') return 5;
  return clampCustomTimer(timerCfg.custom);
}

function shouldCountdownBeep(totalSec, tick) {
  return totalSec <= 5 ? true : tick <= 3;
}

let desktopNoticeTimer = null;
function showDesktopNotice(text, ms = 1600) {
  const el = $('#desktopNotice');
  if (!el) return;
  clearTimeout(desktopNoticeTimer);
  el.textContent = text;
  el.hidden = false;
  desktopNoticeTimer = setTimeout(() => { el.hidden = true; }, ms);
}

const sleep = (ms, ctl) => new Promise((res, rej) => {
  if (ctl && ctl.cancelled) return rej('cancelled');
  let prevAbort;
  const tid = setTimeout(() => {
    if (ctl && ctl.abort === abort) ctl.abort = prevAbort;
    if (ctl && ctl.cancelled) rej('cancelled');
    else res();
  }, ms);
  const abort = () => {
    clearTimeout(tid);
    if (prevAbort) prevAbort();
    rej('cancelled');
  };
  if (ctl) {
    prevAbort = ctl.abort;
    ctl.abort = abort;
  }
});
const toBlob = (c, type = 'image/jpeg', q = 0.92) => new Promise((res) => c.toBlob(res, type, q));

async function makeThumb(source) {
  const t = document.createElement('canvas');
  t.width = 320; t.height = Math.round(320 * source.height / source.width);
  t.getContext('2d').drawImage(source, 0, 0, t.width, t.height);
  return toBlob(t, 'image/jpeg', 0.8);
}

function evenDim(n) {
  return Math.max(2, Math.floor(Math.round(n) / 2) * 2);
}

function mountRecordingCanvas(c) {
  if (!c || c.isConnected) return;
  c.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:0.001;pointer-events:none;z-index:-1;';
  c.setAttribute('aria-hidden', 'true');
  document.body.appendChild(c);
}

function unmountRecordingCanvas(c) {
  if (c && c.parentNode) c.parentNode.removeChild(c);
}

function pickMime(hasAudio = true) {
  const list = hasAudio
    ? [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a.40.2',
        'video/mp4',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
      ]
    : [
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp8',
        'video/webm;codecs=vp9',
        'video/webm',
      ];
  return list.find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
}

function stamp(ts) {
  const d = new Date(ts), p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} at ${p(d.getHours())}.${p(d.getMinutes())}.${p(d.getSeconds())}`;
}

/* --------------------- Unified Custom Video Player UI --------------------- */
const UVP_PLAY_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="7,5 19,12 7,19" fill="currentColor" stroke="none"/></svg>';
const UVP_PAUSE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/></svg>';
const UVP_VOL_ON_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="4,9 9,9 14,5 14,19 9,15 4,15" fill="currentColor" stroke="none"/><path d="M17 9.5a4 4 0 0 1 0 5M19.5 7a7.5 7.5 0 0 1 0 10"/></svg>';
const UVP_VOL_OFF_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="4,9 9,9 14,5 14,19 9,15 4,15" fill="currentColor" stroke="none"/><path d="M17.5 9.5l4 5m0-5l-4 5"/></svg>';

function formatUvpTime(sec) {
  if (!Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Attach a consistent macOS-style video player HUD across desktop and mobile browsers. */
function createUnifiedVideoPlayer(videoEl, opts = {}) {
  const host = opts.hostEl || videoEl.parentElement;
  videoEl.controls = false;
  videoEl.removeAttribute('controls');
  videoEl.playsInline = true;
  videoEl.setAttribute('playsinline', '');
  videoEl.setAttribute('webkit-playsinline', '');
  videoEl.preload = 'auto';

  const ui = document.createElement('div');
  ui.className = 'uvp-layer' + (opts.compact ? ' compact' : '');
  ui.hidden = true;

  const posterImg = document.createElement('img');
  posterImg.className = 'uvp-poster';
  posterImg.alt = '';
  posterImg.hidden = true;

  const bigPlayBtn = document.createElement('button');
  bigPlayBtn.type = 'button';
  bigPlayBtn.className = 'uvp-big-play';
  bigPlayBtn.title = 'Play Video';
  bigPlayBtn.setAttribute('aria-label', 'Play Video');
  bigPlayBtn.innerHTML = UVP_PLAY_SVG;

  const errBadge = document.createElement('div');
  errBadge.className = 'uvp-error';
  errBadge.hidden = true;
  errBadge.textContent = 'Video picture unsupported in this browser — try Download';

  const bar = document.createElement('div');
  bar.className = 'uvp-bar';
  bar.innerHTML = `
    <button type="button" class="uvp-btn uvp-play" title="Play / Pause" aria-label="Play / Pause">${UVP_PLAY_SVG}</button>
    <span class="uvp-time">0:00</span>
    <input type="range" class="uvp-seek" min="0" max="1000" value="0" aria-label="Seek video" />
    <button type="button" class="uvp-btn uvp-mute" title="Mute / Unmute" aria-label="Mute / Unmute">${UVP_VOL_ON_SVG}</button>
  `;

  ui.append(posterImg, bigPlayBtn, errBadge, bar);
  if (host) host.appendChild(ui);

  const playBtn = bar.querySelector('.uvp-play');
  const timeEl = bar.querySelector('.uvp-time');
  const seekEl = bar.querySelector('.uvp-seek');
  const muteBtn = bar.querySelector('.uvp-mute');

  let active = false;
  let hasPoster = false;
  let seeking = false;

  const getDuration = () => {
    if (Number.isFinite(videoEl.duration) && videoEl.duration > 0) return videoEl.duration;
    if (videoEl.seekable && videoEl.seekable.length) {
      const end = videoEl.seekable.end(videoEl.seekable.length - 1);
      if (Number.isFinite(end) && end > 0) return end;
    }
    return 0;
  };

  const sync = () => {
    if (!active) return;
    const paused = videoEl.paused || videoEl.ended;
    playBtn.innerHTML = paused ? UVP_PLAY_SVG : UVP_PAUSE_SVG;
    bigPlayBtn.hidden = !paused || !errBadge.hidden;

    const muted = videoEl.muted || videoEl.volume === 0;
    muteBtn.innerHTML = muted ? UVP_VOL_OFF_SVG : UVP_VOL_ON_SVG;

    const cur = videoEl.currentTime || 0;
    const dur = getDuration();
    timeEl.textContent = dur > 0 ? `${formatUvpTime(cur)} / ${formatUvpTime(dur)}` : formatUvpTime(cur);
    if (!seeking) {
      const ratio = dur > 0 ? clampN(cur / dur, 0, 1) : 0;
      seekEl.value = String(Math.round(ratio * 1000));
      seekEl.style.setProperty('--uvp-pct', `${(ratio * 100).toFixed(1)}%`);
    }

    if (videoEl.videoWidth > 0 && videoEl.readyState >= 2) {
      posterImg.hidden = true;
      errBadge.hidden = true;
    }
  };

  const togglePlay = () => {
    if (!active) return;
    if (videoEl.paused || videoEl.ended) videoEl.play().catch(() => {});
    else videoEl.pause();
  };

  playBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
  bigPlayBtn.addEventListener('click', (e) => { e.stopPropagation(); togglePlay(); });
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    videoEl.muted = !videoEl.muted;
    sync();
  });
  bar.addEventListener('click', (e) => e.stopPropagation());
  bar.addEventListener('pointerdown', (e) => e.stopPropagation());
  videoEl.addEventListener('click', (e) => {
    if (!active) return;
    e.stopPropagation();
    togglePlay();
  });

  seekEl.addEventListener('pointerdown', () => { seeking = true; });
  seekEl.addEventListener('input', () => {
    const dur = getDuration();
    const ratio = Number(seekEl.value) / 1000;
    seekEl.style.setProperty('--uvp-pct', `${(ratio * 100).toFixed(1)}%`);
    if (dur > 0) {
      videoEl.currentTime = ratio * dur;
      timeEl.textContent = `${formatUvpTime(videoEl.currentTime)} / ${formatUvpTime(dur)}`;
    }
  });
  seekEl.addEventListener('change', () => { seeking = false; sync(); });

  const checkVideoFrames = () => {
    if (!active) return;
    if (videoEl.error || (videoEl.readyState >= 1 && videoEl.videoWidth === 0 && (videoEl.currentTime > 0 || videoEl.paused === false))) {
      errBadge.hidden = false;
      if (hasPoster) posterImg.hidden = false;
    }
    sync();
  };

  videoEl.addEventListener('loadedmetadata', sync);
  videoEl.addEventListener('loadeddata', checkVideoFrames);
  videoEl.addEventListener('canplay', sync);
  videoEl.addEventListener('durationchange', sync);
  videoEl.addEventListener('timeupdate', sync);
  videoEl.addEventListener('play', sync);
  videoEl.addEventListener('pause', sync);
  videoEl.addEventListener('ended', sync);
  videoEl.addEventListener('volumechange', sync);
  videoEl.addEventListener('error', checkVideoFrames);

  return {
    el: ui,
    setMedia(url, posterUrl) {
      active = true;
      ui.hidden = false;
      errBadge.hidden = true;
      hasPoster = !!posterUrl;
      if (posterUrl) {
        posterImg.src = posterUrl;
        posterImg.hidden = false;
      } else {
        posterImg.removeAttribute('src');
        posterImg.hidden = true;
      }
      videoEl.hidden = false;
      videoEl.src = url;
      videoEl.load();
      sync();
    },
    reset() {
      active = false;
      seeking = false;
      ui.hidden = true;
      errBadge.hidden = true;
      hasPoster = false;
      posterImg.hidden = true;
      posterImg.removeAttribute('src');
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
      videoEl.hidden = true;
      timeEl.textContent = '0:00';
      seekEl.value = '0';
      seekEl.style.setProperty('--uvp-pct', '0%');
    },
    sync,
  };
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

let resettingClientState = false;

function syncLibraries(scrollToEnd) {
  if (resettingClientState) return;
  localStorage.setItem('pb.hasItems', photoItems().length ? '1' : '0');
  for (const w of windows) w.renderLibrary(scrollToEnd);
  if (typeof renderFiles === 'function') renderFiles();
}

async function wipeAllClientStorage() {
  resettingClientState = true;
  try { localStorage.clear(); } catch (_) { /* ignore */ }
  try { sessionStorage.clear(); } catch (_) { /* ignore */ }
  try {
    if (document.cookie) {
      for (const part of document.cookie.split(';')) {
        const name = part.split('=')[0].trim();
        if (name) document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      }
    }
  } catch (_) { /* ignore */ }

  // Clear IndexedDB stores cleanly, close open connection, and delete DB
  try {
    const db = await Promise.race([dbReady, new Promise((r) => setTimeout(() => r(null), 500))]);
    if (db) {
      await new Promise((resolve) => {
        try {
          const names = Array.from(db.objectStoreNames || []);
          if (!names.length) { resolve(); return; }
          const tx = db.transaction(names, 'readwrite');
          for (const s of names) tx.objectStore(s).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
          tx.onabort = () => resolve();
        } catch (_) {
          resolve();
        }
      });
      try { db.close(); } catch (_) { /* ignore */ }
    }
    await new Promise((resolve) => {
      const del = indexedDB.deleteDatabase('photobooth');
      const done = () => resolve();
      del.onsuccess = done;
      del.onerror = done;
      del.onblocked = done;
      setTimeout(done, 500);
    });
  } catch (_) { /* ignore */ }

  // Clear CacheStorage entries if any exist
  try {
    if (window.caches && caches.keys) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (_) { /* ignore */ }

  // Final sweep so nothing written mid-cleanup survives reload
  try { localStorage.clear(); } catch (_) { /* ignore */ }
  try { sessionStorage.clear(); } catch (_) { /* ignore */ }
}

/** Check if emergency reset query parameter (?reset=1) is present. */
function hasResetQueryParam() {
  try {
    const p = new URLSearchParams(location.search);
    return p.get('reset') === '1' || p.get('reset') === 'true';
  } catch (_) {
    return false;
  }
}

/** Stop active capture/modals, wipe all client storage, and reload cleanly. */
async function executeFullReset() {
  try {
    if (typeof windows !== 'undefined') {
      for (const w of windows) {
        if (w.stopRecPump) w.stopRecPump();
        if (w.recording && w.recorder) { try { w.recorder.stop(); } catch (_) {} }
      }
    }
    if (typeof closeQrModal === 'function') closeQrModal();
    if (typeof shotRecStopFn === 'function') shotRecStopFn();
  } catch (_) { /* ignore */ }
  await wipeAllClientStorage();
  if (location.protocol === 'file:') {
    try {
      const clean = location.href.split('?')[0].split('#')[0];
      if (location.search) location.replace(clean);
      else location.reload();
    } catch (_) {
      location.reload();
    }
  } else {
    location.replace(`${location.origin}${location.pathname}`);
  }
}

let emergencyResetOverlayEl = null;

/** Close the emergency reset confirmation overlay if visible. */
function closeEmergencyResetModal() {
  if (!emergencyResetOverlayEl) return false;
  const cb = emergencyResetOverlayEl._onCancel;
  emergencyResetOverlayEl.remove();
  emergencyResetOverlayEl = null;
  if (typeof cb === 'function') cb();
  return true;
}

/** Show a standalone high-priority confirmation overlay for emergency total reset. */
function showEmergencyResetModal(opts = {}) {
  if (emergencyResetOverlayEl) return;
  const overlay = document.createElement('div');
  overlay.id = 'emergencyResetOverlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Emergency Total Reset');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(15,15,20,0.62);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif;';

  const card = document.createElement('div');
  card.style.cssText = 'width:100%;max-width:380px;background:rgba(32,32,36,0.96);color:#f5f5f7;border:1px solid rgba(255,255,255,0.16);border-radius:16px;padding:22px;box-shadow:0 24px 60px rgba(0,0,0,0.5);text-align:center;';

  const title = document.createElement('h3');
  title.textContent = 'Reset App & Clear All Data?';
  title.style.cssText = 'margin:0 0 8px;font-size:17px;font-weight:600;color:#fff;';

  const desc = document.createElement('p');
  desc.textContent = 'This will erase all saved photos, videos, screenshots, wallpaper, and preferences stored in this browser, then reload the page cleanly.';
  desc.style.cssText = 'margin:0 0 18px;font-size:13px;line-height:1.45;color:rgba(255,255,255,0.74);';

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:10px;justify-content:center;';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.id = 'emResetCancelBtn';
  cancelBtn.textContent = 'Cancel';
  cancelBtn.style.cssText = 'flex:1;padding:9px 14px;border-radius:10px;border:1px solid rgba(255,255,255,0.16);background:rgba(255,255,255,0.1);color:#fff;font-size:13px;font-weight:500;cursor:pointer;';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.id = 'emResetConfirmBtn';
  confirmBtn.textContent = 'Confirm Reset';
  confirmBtn.style.cssText = 'flex:1;padding:9px 14px;border-radius:10px;border:0;background:#ff3b30;color:#fff;font-size:13px;font-weight:600;cursor:pointer;';

  const stripResetParam = () => {
    try {
      if (hasResetQueryParam() && window.history?.replaceState) {
        history.replaceState(null, '', `${location.pathname}`);
      }
    } catch (_) { /* ignore */ }
  };

  overlay._onCancel = () => {
    stripResetParam();
    if (typeof opts.onCancel === 'function') opts.onCancel();
  };

  cancelBtn.addEventListener('click', () => closeEmergencyResetModal());
  confirmBtn.addEventListener('click', async () => {
    cancelBtn.disabled = true;
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Resetting…';
    await executeFullReset();
  });

  row.append(cancelBtn, confirmBtn);
  card.append(title, desc, row);
  overlay.appendChild(card);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && !confirmBtn.disabled) closeEmergencyResetModal();
  });

  emergencyResetOverlayEl = overlay;
  document.body.appendChild(overlay);
  confirmBtn.focus();
}

