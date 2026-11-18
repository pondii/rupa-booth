'use strict';

/* ------------------------- Desktop Screenshot ------------------------- */
const svgCache = new Map();
function svgElementToImage(svgEl) {
  if (!svgEl) return Promise.resolve(null);
  const key = svgEl.outerHTML;
  if (svgCache.has(key)) return Promise.resolve(svgCache.get(key));
  return new Promise((resolve) => {
    const clone = svgEl.cloneNode(true);
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const vb = (svgEl.getAttribute('viewBox') || '').trim().split(/[\s,]+/);
    const w = Math.max(64, Math.round(svgEl.getBoundingClientRect().width || Number(vb[2]) || 120)) * 2;
    const h = Math.max(64, Math.round(svgEl.getBoundingClientRect().height || Number(vb[3]) || 120)) * 2;
    if (!clone.getAttribute('width')) clone.setAttribute('width', String(w));
    if (!clone.getAttribute('height')) clone.setAttribute('height', String(h));
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(clone));
    const img = new Image();
    img.onload = () => {
      const done = () => { svgCache.set(key, img); resolve(img); };
      if (typeof img.decode === 'function') img.decode().then(done, done);
      else done();
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

function addRoundedRectPath(c, x, y, w, h, r) {
  r = Math.max(0, Math.min(r || 0, w / 2, h / 2));
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function rrect(c, x, y, w, h, r) {
  c.beginPath();
  addRoundedRectPath(c, x, y, w, h, r);
}

function drawOuterShadow(c, x, y, w, h, radius, color, blur, offsetY = 0) {
  if (w <= 0 || h <= 0) return;
  const pad = blur + 28;
  c.save();
  c.beginPath();
  c.rect(x - pad, y - pad, w + pad * 2, h + pad * 2 + Math.abs(offsetY));
  addRoundedRectPath(c, x, y, w, h, radius);
  c.clip('evenodd');
  c.shadowColor = color;
  c.shadowBlur = blur;
  c.shadowOffsetY = offsetY;
  rrect(c, x, y, w, h, radius);
  c.fillStyle = '#000';
  c.fill();
  c.restore();
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

const SB_ICO_BG = {
  'sb-layout': '#0a84ff',
  'sb-theme': '#6366f1',
  'sb-wall': '#af52de',
  'sb-flash': '#ff9f0a',
  'sb-timer': '#30d158',
  'sb-perm': '#5e5ce6',
  'sb-about': '#8e8e93',
  'sb-reset': '#ff453a',
  'sb-shot': '#38bdf8',
  'sb-video': '#bf5af2',
  'sb-all': '#0a84ff',
  'sb-photo': '#30d158',
};

function shotIsLight() {
  return Boolean(window.__rupaTheme && window.__rupaTheme.resolved === 'light');
}
function shotIsRetro() {
  return Boolean(window.__rupaTheme && window.__rupaTheme.skin === 'retro-pop');
}
function shotIsSweet98() {
  return Boolean(window.__rupaTheme && window.__rupaTheme.skin === 'sweet-98');
}
function shotAccentHex() {
  return (window.__rupaTheme && window.__rupaTheme.accentHex) || '#0a84ff';
}
function shotPalette() {
  const retro = shotIsRetro();
  const sweet = shotIsSweet98();
  const light = shotIsLight();
  return {
    retro,
    sweet,
    light,
    accent: shotAccentHex(),
    text1: sweet ? '#2e2d34' : (retro ? '#18181b' : (light ? '#1d1d1f' : '#ffffff')),
    text2: sweet ? '#3d3b45' : (retro ? '#27272a' : (light ? 'rgba(29,29,31,0.78)' : 'rgba(255,255,255,0.86)')),
    text3: sweet ? '#66616e' : (retro ? '#52525b' : (light ? 'rgba(29,29,31,0.56)' : 'rgba(255,255,255,0.54)')),
    cardBg: sweet ? '#faf6ec' : (retro ? '#fffdf5' : (light ? 'rgba(255,255,255,0.78)' : 'rgba(255,255,255,0.06)')),
    cardBorder: sweet ? '#2e2d34' : (retro ? '#18181b' : (light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.09)')),
    rowSep: sweet ? 'rgba(46,45,52,0.2)' : (retro ? 'rgba(24,24,27,0.22)' : (light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.07)')),
    ctlBg: sweet ? '#d9d2c6' : (retro ? '#ebe5ce' : (light ? 'rgba(0,0,0,0.075)' : 'rgba(255,255,255,0.12)')),
    segBg: sweet ? '#d6cfc3' : (retro ? '#eae5d0' : (light ? 'rgba(0,0,0,0.075)' : 'rgba(255,255,255,0.10)')),
    segActive: sweet ? '#f2c2cf' : (retro ? '#f2da5e' : (light ? '#ffffff' : 'rgba(255,255,255,0.24)')),
    pillBg: sweet ? '#e4ded3' : (retro ? '#fffdf5' : (light ? 'rgba(0,0,0,0.075)' : 'rgba(255,255,255,0.12)')),
  };
}
function drawWin98Bevel(c, x, y, w, h, radius = 3, fill = '#e4ded3', inset = false) {
  rrect(c, x, y, w, h, radius);
  c.fillStyle = fill;
  c.fill();
  c.save();
  c.lineWidth = 1.5;
  c.strokeStyle = inset ? '#8f8980' : '#fbf7ee';
  c.beginPath(); c.moveTo(x + 1, y + h - 1); c.lineTo(x + 1, y + 1); c.lineTo(x + w - 1, y + 1); c.stroke();
  c.strokeStyle = inset ? '#fbf7ee' : '#8f8980';
  c.beginPath(); c.moveTo(x + w - 1, y + 1); c.lineTo(x + w - 1, y + h - 1); c.lineTo(x + 1, y + h - 1); c.stroke();
  rrect(c, x, y, w, h, radius);
  c.strokeStyle = '#2e2d34';
  c.lineWidth = 1.4;
  c.stroke();
  c.restore();
}
function drawRetroStackShadow(c, x, y, w, h, radius = 14) {
  const layers = [
    { dx: 8, dy: 8, fill: '#f2da5e' },
    { dx: 4, dy: 4, fill: '#ec5eb0' },
  ];
  for (const ly of layers) {
    rrect(c, x + ly.dx, y + ly.dy, w, h, radius);
    c.fillStyle = ly.fill;
    c.fill();
    c.strokeStyle = '#18181b';
    c.lineWidth = 2;
    c.stroke();
  }
}

function drawThemedBox(c, pal, x, y, w, h, opts = {}) {
  const rad = pal.sweet ? Math.min(opts.sweetR ?? 3, 4) : (opts.r ?? 12);
  if (pal.sweet) {
    if (opts.shadow) {
      rrect(c, x + opts.shadow, y + opts.shadow, w, h, rad);
      c.fillStyle = 'rgba(46,45,52,0.22)';
      c.fill();
    }
    drawWin98Bevel(c, x, y, w, h, rad, opts.sweetFill ?? '#faf6ec', Boolean(opts.inset));
    return;
  }
  if (pal.retro && opts.retroOffset) {
    rrect(c, x + opts.retroOffset, y + opts.retroOffset, w, h, rad);
    c.fillStyle = opts.retroShadow || '#18181b';
    c.fill();
    if (opts.retroShadowStroke) {
      c.strokeStyle = '#18181b';
      c.lineWidth = 2;
      c.stroke();
    }
  }
  rrect(c, x, y, w, h, rad);
  c.fillStyle = opts.fill ?? pal.cardBg;
  c.fill();
  if (pal.retro || opts.stroke || pal.light) {
    c.strokeStyle = opts.stroke ?? (pal.retro ? '#18181b' : pal.cardBorder);
    c.lineWidth = opts.lineWidth ?? (pal.retro ? 2 : 1);
    c.stroke();
  }
}

let wallBlurCache = { key: '', canvas: null, w: 0, h: 0 };
let frostScratch = null;
let frostDown = null;

// Pure-JS O(w*h) 2-pass separable box blur + saturation boost (works identically on Safari macOS & Chrome without ctx.filter)
function applyBoxBlurAndSaturate(ctx, w, h, radius = 6, sat = 1.65) {
  if (w < 2 || h < 2 || radius < 1) return false;
  let imgData;
  try {
    imgData = ctx.getImageData(0, 0, w, h);
  } catch (_) {
    return false;
  }
  const src = imgData.data;
  const n = w * h;
  const tmp = new Uint8ClampedArray(src.length);
  const rad = Math.max(1, Math.min(18, radius | 0));
  const win = rad * 2 + 1;

  for (let pass = 0; pass < 2; pass++) {
    // Horizontal pass: src -> tmp
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = -rad; i <= rad; i++) {
        const idx = (row + Math.max(0, Math.min(w - 1, i))) * 4;
        r += src[idx]; g += src[idx + 1]; b += src[idx + 2]; a += src[idx + 3];
      }
      for (let x = 0; x < w; x++) {
        const out = (row + x) * 4;
        tmp[out] = (r / win) | 0;
        tmp[out + 1] = (g / win) | 0;
        tmp[out + 2] = (b / win) | 0;
        tmp[out + 3] = (a / win) | 0;
        const addIdx = (row + Math.min(w - 1, x + rad + 1)) * 4;
        const remIdx = (row + Math.max(0, x - rad)) * 4;
        r += src[addIdx] - src[remIdx];
        g += src[addIdx + 1] - src[remIdx + 1];
        b += src[addIdx + 2] - src[remIdx + 2];
        a += src[addIdx + 3] - src[remIdx + 3];
      }
    }
    // Vertical pass: tmp -> src
    for (let x = 0; x < w; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let i = -rad; i <= rad; i++) {
        const idx = (Math.max(0, Math.min(h - 1, i)) * w + x) * 4;
        r += tmp[idx]; g += tmp[idx + 1]; b += tmp[idx + 2]; a += tmp[idx + 3];
      }
      for (let y = 0; y < h; y++) {
        const out = (y * w + x) * 4;
        src[out] = (r / win) | 0;
        src[out + 1] = (g / win) | 0;
        src[out + 2] = (b / win) | 0;
        src[out + 3] = (a / win) | 0;
        const addIdx = (Math.min(h - 1, y + rad + 1) * w + x) * 4;
        const remIdx = (Math.max(0, y - rad) * w + x) * 4;
        r += tmp[addIdx] - tmp[remIdx];
        g += tmp[addIdx + 1] - tmp[remIdx + 1];
        b += tmp[addIdx + 2] - tmp[remIdx + 2];
        a += tmp[addIdx + 3] - tmp[remIdx + 3];
      }
    }
  }

  if (sat !== 1) {
    for (let i = 0; i < n * 4; i += 4) {
      const rv = src[i], gv = src[i + 1], bv = src[i + 2];
      const lum = 0.2126 * rv + 0.7152 * gv + 0.0722 * bv;
      src[i] = Math.max(0, Math.min(255, lum + (rv - lum) * sat));
      src[i + 1] = Math.max(0, Math.min(255, lum + (gv - lum) * sat));
      src[i + 2] = Math.max(0, Math.min(255, lum + (bv - lum) * sat));
    }
  }
  ctx.putImageData(imgData, 0, 0);
  return true;
}

function getBlurredWallpaperCanvas(W, H) {
  if (wallState.tab !== 'photo' || !wallState.imgEl || !wallState.imgEl.complete || !wallState.imgEl.naturalWidth) {
    return null;
  }
  const src = wallState.imgEl.currentSrc || wallState.imgEl.src || '';
  const key = `${src}|${W}x${H}|${wallState.fit}|${wallState.color}`;
  if (wallBlurCache.key === key && wallBlurCache.canvas) return wallBlurCache;
  const bw = Math.max(96, Math.round(W * 0.22));
  const bh = Math.max(96, Math.round(H * 0.22));
  const blurred = document.createElement('canvas');
  blurred.width = bw; blurred.height = bh;
  const bc = blurred.getContext('2d');
  bc.fillStyle = wallState.color;
  bc.fillRect(0, 0, bw, bh);
  const img = wallState.imgEl, iw = img.naturalWidth, ih = img.naturalHeight;
  if (wallState.fit === 'cover') drawImageCover(bc, img, iw, ih, 0, 0, bw, bh);
  else if (wallState.fit === 'contain') drawImageContain(bc, img, iw, ih, 0, 0, bw, bh);
  else if (wallState.fit === '100% 100%') bc.drawImage(img, 0, 0, bw, bh);
  else bc.drawImage(img, (bw - iw * 0.22) / 2, (bh - ih * 0.22) / 2, iw * 0.22, ih * 0.22);

  applyBoxBlurAndSaturate(bc, bw, bh, 7, 1.65);
  wallBlurCache = { key, canvas: blurred, w: W, h: H };
  return wallBlurCache;
}

function drawFrostedSurface(c, x, y, w, h, radius, tintCss, blurInfo) {
  if (w <= 0 || h <= 0) return;
  c.save();
  rrect(c, x, y, w, h, radius);
  c.clip();

  // Live-backdrop sample of c.canvas (captures lower overlapping windows, camera feeds, and any wallpaper)
  let sampledLive = false;
  const srcCanvas = c.canvas;
  if (srcCanvas && srcCanvas.width > 0 && srcCanvas.height > 0) {
    const dpr = Math.max(0.5, c.getTransform().a || 1);
    const padPx = Math.round(12 * dpr);
    const sxPx = Math.max(0, Math.floor(x * dpr) - padPx);
    const syPx = Math.max(0, Math.floor(y * dpr) - padPx);
    const exPx = Math.min(srcCanvas.width, Math.ceil((x + w) * dpr) + padPx);
    const eyPx = Math.min(srcCanvas.height, Math.ceil((y + h) * dpr) + padPx);
    const swPx = exPx - sxPx;
    const shPx = eyPx - syPx;
    const cw = swPx / dpr;
    const ch = shPx / dpr;

    if (swPx > 2 && shPx > 2) {
      if (!frostScratch) frostScratch = document.createElement('canvas');
      const bw = Math.max(8, Math.round(cw * 0.22));
      const bh = Math.max(8, Math.round(ch * 0.22));
      if (frostScratch.width !== bw || frostScratch.height !== bh) {
        frostScratch.width = bw; frostScratch.height = bh;
      }
      const fc = frostScratch.getContext('2d', { willReadFrequently: true });
      fc.clearRect(0, 0, bw, bh);
      fc.imageSmoothingEnabled = true;
      fc.imageSmoothingQuality = 'high';
      fc.drawImage(srcCanvas, sxPx, syPx, swPx, shPx, 0, 0, bw, bh);

      if (!applyBoxBlurAndSaturate(fc, bw, bh, 6, 1.65)) {
        if (!frostDown) frostDown = document.createElement('canvas');
        const dw = Math.max(4, Math.round(bw * 0.38));
        const dh = Math.max(4, Math.round(bh * 0.38));
        if (frostDown.width !== dw || frostDown.height !== dh) {
          frostDown.width = dw; frostDown.height = dh;
        }
        const dc = frostDown.getContext('2d');
        dc.imageSmoothingEnabled = true;
        dc.drawImage(frostScratch, 0, 0, dw, dh);
        fc.clearRect(0, 0, bw, bh);
        fc.drawImage(frostDown, 0, 0, bw, bh);
      }

      const x0 = sxPx / dpr, y0 = syPx / dpr;
      const sx = Math.max(0, Math.min(bw - 1, ((x - x0) / cw) * bw));
      const sy = Math.max(0, Math.min(bh - 1, ((y - y0) / ch) * bh));
      const sw = Math.max(1, Math.min(bw - sx, (w / cw) * bw));
      const sh = Math.max(1, Math.min(bh - sy, (h / ch) * bh));
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(frostScratch, sx, sy, sw, sh, x, y, w, h);
      sampledLive = true;
    }
  }

  if (!sampledLive && blurInfo && blurInfo.canvas && blurInfo.w > 0 && blurInfo.h > 0) {
    const bw = blurInfo.canvas.width, bh = blurInfo.canvas.height;
    const sx = Math.max(0, (x / blurInfo.w) * bw);
    const sy = Math.max(0, (y / blurInfo.h) * bh);
    const sw = Math.max(1, (w / blurInfo.w) * bw);
    const sh = Math.max(1, (h / blurInfo.h) * bh);
    c.drawImage(blurInfo.canvas, sx, sy, sw, sh, x, y, w, h);
  }

  c.fillStyle = tintCss;
  c.fillRect(x, y, w, h);
  const sheen = c.createLinearGradient(0, y, 0, y + h * 0.36);
  sheen.addColorStop(0, 'rgba(255,255,255,0.08)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = sheen;
  c.fillRect(x, y, w, h * 0.36);
  c.restore();
}

function drawGlyph(c, kind, cx, cy, size = 16, color = '#fff', extra = null) {
  const s = size / 24;
  c.save();
  c.translate(cx, cy);
  c.scale(s, s);
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 1.9;
  c.lineCap = 'round';
  c.lineJoin = 'round';
  c.beginPath();
  if (kind === 'download') {
    c.moveTo(0, -8); c.lineTo(0, 3);
    c.moveTo(-4, -1); c.lineTo(0, 3); c.lineTo(4, -1);
    c.moveTo(-8, 5); c.lineTo(-8, 7); c.arcTo(-8, 9, -6, 9, 2);
    c.lineTo(6, 9); c.arcTo(8, 9, 8, 7, 2); c.lineTo(8, 5);
    c.stroke();
  } else if (kind === 'trash') {
    c.moveTo(-8, -5); c.lineTo(8, -5);
    c.moveTo(-2, -1); c.lineTo(-2, 5);
    c.moveTo(2, -1); c.lineTo(2, 5);
    c.moveTo(-6, -5); c.lineTo(-5, 7); c.arcTo(-5, 9, -3, 9, 2);
    c.lineTo(3, 9); c.arcTo(5, 9, 5, 7, 2); c.lineTo(6, -5);
    c.moveTo(-3, -5); c.lineTo(-3, -8); c.lineTo(3, -8); c.lineTo(3, -5);
    c.stroke();
  } else if (kind === 'close') {
    c.moveTo(-6, -6); c.lineTo(6, 6);
    c.moveTo(6, -6); c.lineTo(-6, 6);
    c.stroke();
  } else if (kind === 'back') {
    c.moveTo(3, -6); c.lineTo(-3, 0); c.lineTo(3, 6);
    c.stroke();
  } else if (kind === 'next') {
    c.moveTo(-3, -6); c.lineTo(3, 0); c.lineTo(-3, 6);
    c.stroke();
  } else if (kind === 'more') {
    c.arc(-6.5, 0, 1.6, 0, Math.PI * 2);
    c.arc(0, 0, 1.6, 0, Math.PI * 2);
    c.arc(6.5, 0, 1.6, 0, Math.PI * 2);
    c.fill();
  } else if (kind === 'full') {
    c.moveTo(-3, -7); c.lineTo(-7, -7); c.lineTo(-7, -3); c.moveTo(-7, -7); c.lineTo(-2, -2);
    c.moveTo(3, 7); c.lineTo(7, 7); c.lineTo(7, 3); c.moveTo(7, 7); c.lineTo(2, 2);
    c.stroke();
  } else if (kind === 'strip') {
    rrect(c, -9, -8, 18, 16, 2.6); c.stroke();
    c.beginPath(); c.arc(-3.5, -2.8, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath();
    c.moveTo(-8.5, 4.5); c.lineTo(-3.7, 0); c.lineTo(-1.6, 0);
    c.lineTo(1.5, 3); c.lineTo(3.7, 1); c.lineTo(8.5, 4);
    c.stroke();
  } else if (kind === 'flash') {
    c.moveTo(1, -9.5); c.lineTo(-7, 1.5); c.lineTo(-0.5, 1.5);
    c.lineTo(-1.5, 9.5); c.lineTo(7, -1.5); c.lineTo(0.5, -1.5);
    c.closePath();
    if (extra) { c.save(); c.fillStyle = extra; c.fill(); c.restore(); }
    c.stroke();
  } else if (kind === 'fx') {
    [[0, -3], [-3.2, 2.5], [3.2, 2.5]].forEach(([dx, dy]) => {
      c.beginPath(); c.arc(dx, dy, 4.5, 0, Math.PI * 2); c.stroke();
    });
  } else if (kind === 'check') {
    c.moveTo(-6.5, 0.5); c.lineTo(-2.3, 4.7); c.lineTo(6.5, -4.5);
    c.stroke();
  } else if (kind === 'play') {
    c.moveTo(-4, -6); c.lineTo(6, 0); c.lineTo(-4, 6); c.closePath(); c.fill();
  } else if (kind === 'pause') {
    rrect(c, -5, -6, 3.5, 12, 1); c.fill();
    rrect(c, 1.5, -6, 3.5, 12, 1); c.fill();
  } else if (kind === 'camera') {
    rrect(c, -8, -6, 16, 12, 2.4); c.stroke();
    c.beginPath(); c.arc(0, 0, 2.8, 0, Math.PI * 2); c.stroke();
  } else if (kind === 'video') {
    rrect(c, -9.5, -6, 13, 12, 2.5); c.stroke();
    c.beginPath(); c.moveTo(4.5, -1.6); c.lineTo(9.5, -4.8); c.lineTo(9.5, 4.8); c.lineTo(4.5, 1.6); c.closePath(); c.stroke();
  } else if (kind === 'search') {
    c.beginPath(); c.arc(-1, -1, 6.5, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.moveTo(4, 4); c.lineTo(8.2, 8.2); c.stroke();
  } else if (kind === 'grid') {
    [[-8, -8], [1.5, -8], [-8, 1.5], [1.5, 1.5]].forEach(([gx, gy]) => {
      rrect(c, gx, gy, 6.5, 6.5, 1.4); c.stroke();
    });
  } else if (kind === 'wall') {
    rrect(c, -9, -8, 18, 16, 2.5); c.stroke();
    c.beginPath(); c.arc(-3.5, -2.8, 1.4, 0, Math.PI * 2); c.fill();
    c.beginPath();
    c.moveTo(-8, 5); c.lineTo(-3.2, 0.5); c.lineTo(0, 3.5); c.lineTo(2.2, 1.5); c.lineTo(8, 4.5);
    c.stroke();
  } else if (kind === 'timer') {
    c.beginPath(); c.arc(0, 1, 8, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(0, -3); c.lineTo(0, 1); c.lineTo(2.8, 2.8);
    c.moveTo(-2.5, -9.5); c.lineTo(2.5, -9.5);
    c.stroke();
  } else if (kind === 'lock') {
    rrect(c, -7, -1, 14, 9, 2.2); c.stroke();
    c.beginPath(); c.arc(0, -1, 4, Math.PI, 0); c.stroke();
  } else if (kind === 'about') {
    c.beginPath(); c.arc(0, -3, 3.2, 0, Math.PI * 2); c.stroke();
    c.beginPath();
    c.moveTo(-5.5, 7);
    c.quadraticCurveTo(0, 0.2, 5.5, 7);
    c.stroke();
  } else if (kind === 'reset') {
    c.beginPath();
    c.arc(0, 0, 8.2, Math.PI * 1.15, Math.PI * 0.9, false);
    c.stroke();
    c.beginPath();
    c.moveTo(-8.5, -7.5); c.lineTo(-8.5, -3); c.lineTo(-4, -3);
    c.stroke();
  } else if (kind === 'all') {
    c.moveTo(-8, -5); c.lineTo(-8, 6); c.arcTo(-8, 8, -6, 8, 2);
    c.lineTo(6, 8); c.arcTo(8, 8, 8, 6, 2); c.lineTo(8, -3);
    c.arcTo(8, -5, 6, -5, 2); c.lineTo(0, -5); c.lineTo(-2, -7);
    c.lineTo(-6, -7); c.arcTo(-8, -7, -8, -5, 2);
    c.stroke();
  } else if (kind === 'shot') {
    c.moveTo(-6, -4); c.lineTo(-6, -6); c.lineTo(-4, -6);
    c.moveTo(4, -6); c.lineTo(6, -6); c.lineTo(6, -4);
    c.moveTo(6, 4); c.lineTo(6, 6); c.lineTo(4, 6);
    c.moveTo(-4, 6); c.lineTo(-6, 6); c.lineTo(-6, 4);
    c.stroke();
    c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.stroke();
  } else if (kind === 'list') {
    [-5.5, 0, 5.5].forEach((ly) => {
      c.beginPath(); c.arc(-7.5, ly, 1.2, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(-3.5, ly); c.lineTo(8, ly); c.stroke();
    });
  } else if (kind === 'share') {
    c.moveTo(0, 3); c.lineTo(0, -8);
    c.moveTo(-4, -4); c.lineTo(0, -8); c.lineTo(4, -4);
    c.moveTo(-7, 0); c.lineTo(-7, 7); c.arcTo(-7, 9, -5, 9, 2);
    c.lineTo(5, 9); c.arcTo(7, 9, 7, 7, 2); c.lineTo(7, 0);
    c.stroke();
  } else if (kind === 'ig') {
    rrect(c, -8.5, -8.5, 17, 17, 4.5); c.stroke();
    c.beginPath(); c.arc(0, 0, 3.8, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(5, -5, 1.1, 0, Math.PI * 2); c.fill();
  } else if (kind === 'qr') {
    rrect(c, -8, -8, 6, 6, 1); c.stroke();
    rrect(c, 2, -8, 6, 6, 1); c.stroke();
    rrect(c, -8, 2, 6, 6, 1); c.stroke();
    c.fillRect(2, 2, 2.2, 2.2); c.fillRect(6, 2, 2.2, 2.2);
    c.fillRect(2, 6, 2.2, 2.2); c.fillRect(6, 6, 2.2, 2.2);
  } else if (kind === 'sel-all') {
    rrect(c, -8.5, -8.5, 7, 7, 1.4); c.stroke();
    rrect(c, 1.5, -8.5, 7, 7, 1.4); c.stroke();
    rrect(c, -8.5, 1.5, 7, 7, 1.4); c.stroke();
    c.beginPath(); c.moveTo(1.5, 5); c.lineTo(3.7, 7.2); c.lineTo(8.5, 2.5); c.stroke();
  } else if (kind === 'exit-full') {
    c.moveTo(-3, -8); c.lineTo(-3, -3); c.lineTo(-8, -3); c.moveTo(-8, -8); c.lineTo(-3, -3);
    c.moveTo(3, 8); c.lineTo(3, 3); c.lineTo(8, 3); c.moveTo(8, 8); c.lineTo(3, 3);
    c.stroke();
  } else if (kind === 'copy') {
    rrect(c, -3, -3, 11, 11, 2); c.stroke();
    c.beginPath(); c.moveTo(-7, 3); c.lineTo(-8, 3); c.arcTo(-10, 3, -10, 1, 2);
    c.lineTo(-10, -8); c.arcTo(-10, -10, -8, -10, 2); c.lineTo(1, -10);
    c.arcTo(3, -10, 3, -8, 2); c.lineTo(3, -7); c.stroke();
  } else if (kind === 'upload') {
    c.moveTo(0, 4); c.lineTo(0, -7);
    c.moveTo(-4, -3); c.lineTo(0, -7); c.lineTo(4, -3);
    c.moveTo(-8, 5); c.lineTo(-8, 7); c.arcTo(-8, 9, -6, 9, 2);
    c.lineTo(6, 9); c.arcTo(8, 9, 8, 7, 2); c.lineTo(8, 5);
    c.stroke();
  } else if (kind === 'refresh') {
    c.arc(0, 0, 7.5, -Math.PI * 0.25, Math.PI * 0.85, false); c.stroke();
    c.beginPath(); c.arc(0, 0, 7.5, Math.PI * 0.75, Math.PI * 1.85, false); c.stroke();
    c.beginPath(); c.moveTo(-8, -8); c.lineTo(-8, -3); c.lineTo(-3, -3); c.stroke();
  } else if (kind === 'wa') {
    c.arc(0, -0.5, 8, Math.PI * 0.65, Math.PI * 2.45, false);
    c.lineTo(-8, 8); c.closePath(); c.stroke();
  } else if (kind === 'tg') {
    c.moveTo(9, -8); c.lineTo(-9, -1); c.lineTo(-2.5, 1.4); c.lineTo(5, -4.5);
    c.lineTo(-0.5, 3); c.lineTo(6, 7); c.closePath(); c.stroke();
  } else if (kind === 'x') {
    c.moveTo(-7, -8); c.lineTo(7, 8);
    c.moveTo(7, -8); c.lineTo(-7, 8);
    c.stroke();
  } else if (kind === 'sparkle') {
    c.moveTo(0, -9); c.lineTo(2, -2); c.lineTo(9, 0); c.lineTo(2, 2);
    c.lineTo(0, 9); c.lineTo(-2, 2); c.lineTo(-9, 0); c.lineTo(-2, -2); c.closePath();
    c.stroke();
  }
  c.restore();
}

function drawUvpBar(c, containerEl) {
  if (!containerEl) return;
  const bar = containerEl.querySelector('.uvp-bar');
  if (!bar || bar.hidden) return;
  const br = bar.getBoundingClientRect();
  if (!br.width || !br.height) return;
  c.save();
  rrect(c, br.left, br.top, br.width, br.height, 11);
  c.fillStyle = 'rgba(20,21,26,0.78)';
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.16)';
  c.lineWidth = 1;
  c.stroke();

  const playBtn = bar.querySelector('.uvp-play');
  if (playBtn) {
    const pr = playBtn.getBoundingClientRect();
    const vid = containerEl.querySelector('video');
    drawGlyph(c, vid && !vid.paused ? 'pause' : 'play', pr.left + pr.width / 2, pr.top + pr.height / 2, 14, '#fff');
  }
  const track = bar.querySelector('.uvp-track');
  if (track) {
    const tr = track.getBoundingClientRect();
    rrect(c, tr.left, tr.top + tr.height / 2 - 2, tr.width, 4, 2);
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.fill();
    const fill = track.querySelector('.uvp-fill');
    const fw = fill ? fill.getBoundingClientRect().width : 0;
    if (fw > 0) {
      rrect(c, tr.left, tr.top + tr.height / 2 - 2, Math.min(tr.width, fw), 4, 2);
      c.fillStyle = '#0a84ff';
      c.fill();
    }
  }
  const timeEl = bar.querySelector('.uvp-time');
  if (timeEl) {
    const tr = timeEl.getBoundingClientRect();
    c.font = '600 11px "JetBrains Mono", "JetBrains Mono", ui-monospace, Menlo, monospace';
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(timeEl.textContent || '0:00 / 0:00', tr.left + tr.width / 2, tr.top + tr.height / 2);
  }
  c.restore();
}

function drawWindowFrame(c, el, titleText, isFocused, radius = 18, blurInfo = null) {
  const r = el.getBoundingClientRect();
  const retro = shotIsRetro();
  const sweet = shotIsSweet98();
  const light = shotIsLight();

  if (sweet) {
    const sRad = radius > 0 ? 3 : 0;
    if (sRad > 0) {
      rrect(c, r.left + 4, r.top + 4, r.width, r.height, sRad);
      c.fillStyle = isFocused ? 'rgba(43,70,139,0.24)' : 'rgba(46,45,52,0.20)';
      c.fill();
    }
    drawWin98Bevel(c, r.left, r.top, r.width, r.height, sRad, '#e4ded3', false);
    if (el.classList.contains('window')) {
      const tb = el.querySelector('.titlebar')?.getBoundingClientRect();
      if (tb && tb.width) {
        const g = c.createLinearGradient(tb.left, 0, tb.right, 0);
        g.addColorStop(0, isFocused ? '#2b468b' : '#8b8780');
        g.addColorStop(1, isFocused ? '#5b7fc5' : '#b6b0a6');
        rrect(c, tb.left, tb.top, tb.width, tb.height, 2);
        c.fillStyle = g; c.fill();
        c.strokeStyle = '#2e2d34'; c.lineWidth = 1; c.stroke();
      }
    }
  } else if (retro) {
    const rRad = radius > 0 ? 14 : 0;
    if (rRad > 0) {
      if (isFocused) {
        drawRetroStackShadow(c, r.left, r.top, r.width, r.height, rRad);
      } else {
        rrect(c, r.left + 4, r.top + 4, r.width, r.height, rRad);
        c.fillStyle = '#18181b';
        c.fill();
      }
    }
    rrect(c, r.left, r.top, r.width, r.height, rRad);
    c.fillStyle = '#faf7ec';
    c.fill();
    if (rRad > 0) {
      c.strokeStyle = '#18181b';
      c.lineWidth = 2;
      c.stroke();
    }
  } else {
    if (radius > 0) {
      drawOuterShadow(
        c, r.left, r.top, r.width, r.height, radius,
        isFocused ? 'rgba(0,0,0,0.46)' : 'rgba(0,0,0,0.26)',
        isFocused ? 46 : 30,
        isFocused ? 16 : 9
      );
    }

    drawFrostedSurface(
      c, r.left, r.top, r.width, r.height, radius,
      light
        ? (isFocused ? 'rgba(255,255,255,0.86)' : 'rgba(244,245,248,0.78)')
        : (isFocused ? 'rgba(34,35,42,0.58)' : 'rgba(28,29,34,0.48)'),
      blurInfo
    );

    if (radius > 0) {
      c.save();
      rrect(c, r.left + 0.5, r.top + 0.5, r.width - 1, r.height - 1, radius);
      c.strokeStyle = light
        ? (isFocused ? 'rgba(0,0,0,0.16)' : 'rgba(0,0,0,0.11)')
        : (isFocused ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.14)');
      c.lineWidth = 1;
      c.stroke();
      // macOS top inner glass highlight
      c.beginPath();
      c.moveTo(r.left + radius, r.top + 1);
      c.lineTo(r.right - radius, r.top + 1);
      c.strokeStyle = light
        ? 'rgba(255,255,255,0.92)'
        : (isFocused ? 'rgba(255,255,255,0.34)' : 'rgba(255,255,255,0.2)');
      c.lineWidth = 1;
      c.stroke();
      c.restore();
    }
  }

  // Traffic lights
  const colors = retro
    ? { close: '#e5484d', min: '#2563eb', max: '#f2da5e' }
    : { close: '#ff5f57', min: '#febc2e', max: '#28c840' };
  el.querySelectorAll('.light').forEach((dot) => {
    const dr = dot.getBoundingClientRect();
    if (!dr.width) return;
    if (sweet) {
      drawWin98Bevel(c, dr.left, dr.top, dr.width, dr.height, 2, dot.classList.contains('close') ? '#f3cdd8' : '#e4ded3', false);
      const cx = dr.left + dr.width / 2, cy = dr.top + dr.height / 2;
      c.save();
      c.strokeStyle = '#2e2d34';
      c.lineWidth = 1.4;
      if (dot.classList.contains('close')) {
        c.beginPath();
        c.moveTo(cx - 2.6, cy - 2.6); c.lineTo(cx + 2.6, cy + 2.6);
        c.moveTo(cx + 2.6, cy - 2.6); c.lineTo(cx - 2.6, cy + 2.6);
        c.stroke();
      } else if (dot.classList.contains('min')) {
        c.beginPath(); c.moveTo(cx - 3, cy + 2.8); c.lineTo(cx + 3, cy + 2.8); c.stroke();
      } else {
        c.strokeRect(cx - 3, cy - 2.8, 6, 5.6);
      }
      c.restore();
      return;
    }
    const cx = dr.left + dr.width / 2, cy = dr.top + dr.height / 2, rad = dr.width / 2;
    c.beginPath();
    c.arc(cx, cy, rad, 0, Math.PI * 2);
    if (dot.classList.contains('disabled')) c.fillStyle = light ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.14)';
    else if (!isFocused && !retro) c.fillStyle = light ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.22)';
    else c.fillStyle = dot.classList.contains('close') ? colors.close : dot.classList.contains('min') ? colors.min : colors.max;
    c.fill();
    c.strokeStyle = retro
      ? '#18181b'
      : (isFocused && !dot.classList.contains('disabled') ? 'rgba(0,0,0,0.22)' : (light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)'));
    c.lineWidth = retro ? 1.5 : 0.7;
    c.stroke();
  });

  // Title
  const liveTitle = el.querySelector('.title-input')?.value || titleText;
  if (liveTitle) {
    const tb = el.querySelector('.titlebar')?.getBoundingClientRect();
    if (tb && tb.width) {
      c.save();
      c.font = sweet
        ? '700 12px "JetBrains Mono", ui-monospace, Menlo, monospace'
        : `${retro ? '700' : '600'} 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
      c.fillStyle = sweet
        ? '#faf6ec'
        : retro
          ? '#18181b'
          : light
            ? (isFocused ? 'rgba(29,29,31,0.9)' : 'rgba(29,29,31,0.48)')
            : (isFocused ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.46)');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(liveTitle, tb.left + tb.width / 2, tb.top + tb.height / 2);
      c.restore();
    }
  }
}

function drawPhotoBoothWindow(c, inst, blurInfo = null) {
  const isFocused = inst.el.classList.contains('focused');
  const pal = shotPalette();
  const retro = pal.retro;
  const sweet = pal.sweet;
  drawWindowFrame(c, inst.el, inst.title, isFocused, inst.winFull ? 0 : (sweet ? 3 : 18), blurInfo);

  // Stage
  const sr = inst.stage.getBoundingClientRect();
  const stageRad = inst.winFull ? 0 : (sweet ? 2 : (retro ? 12 : 16));
  c.save();
  rrect(c, sr.left, sr.top, sr.width, sr.height, stageRad);
  c.clip();
  c.fillStyle = '#000';
  c.fillRect(sr.left, sr.top, sr.width, sr.height);

  if (inst.effectsOpen) {
    const pageEl = inst.el.querySelectorAll('.fx-page')[inst.fxPage];
    if (pageEl) {
      pageEl.querySelectorAll('.fx').forEach((tile) => {
        const tr = tile.getBoundingClientRect();
        const cv = tile.querySelector('canvas');
        if (cv && cv.width && cv.height) drawImageCover(c, cv, cv.width, cv.height, tr.left, tr.top, tr.width, tr.height);
        const label = tile.querySelector('span')?.textContent || '';
        const g = c.createLinearGradient(0, tr.bottom - 28, 0, tr.bottom);
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(1, 'rgba(0,0,0,0.58)');
        c.fillStyle = g;
        c.fillRect(tr.left, tr.bottom - 28, tr.width, 28);
        c.font = '600 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
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
    // Effect navigation arrows & pagination dots
    ['prev', 'next'].forEach((dir) => {
      const nav = inst.el.querySelector(`.fx-nav.${dir}`);
      if (!nav || nav.classList.contains('off')) return;
      const nr = nav.getBoundingClientRect();
      if (!nr.width) return;
      c.beginPath();
      c.arc(nr.left + nr.width / 2, nr.top + nr.height / 2, nr.width / 2, 0, Math.PI * 2);
      c.fillStyle = 'rgba(30,30,34,0.68)';
      c.fill();
      drawGlyph(c, dir === 'prev' ? 'back' : 'next', nr.left + nr.width / 2, nr.top + nr.height / 2, 16, '#fff');
    });
    const catPill = inst.el.querySelector('.fx-cat-pill');
    if (catPill && catPill.textContent) {
      const cr = catPill.getBoundingClientRect();
      if (cr.width) {
        rrect(c, cr.left, cr.top, cr.width, cr.height, cr.height / 2);
        c.fillStyle = 'rgba(24,25,30,0.68)';
        c.fill();
        c.strokeStyle = 'rgba(255,255,255,0.14)';
        c.lineWidth = 1;
        c.stroke();
        c.font = '600 11px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = 'rgba(255,255,255,0.92)';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(catPill.textContent, cr.left + cr.width / 2, cr.top + cr.height / 2);
      }
    }
    const dotsWrap = inst.el.querySelector('.fx-dots');
    if (dotsWrap) {
      const dr = dotsWrap.getBoundingClientRect();
      if (dr.width) {
        rrect(c, dr.left, dr.top, dr.width, dr.height, dr.height / 2);
        c.fillStyle = 'rgba(30,30,34,0.68)';
        c.fill();
        dotsWrap.querySelectorAll('button').forEach((d) => {
          const br = d.getBoundingClientRect();
          c.beginPath();
          c.arc(br.left + br.width / 2, br.top + br.height / 2, (br.width / 2) * (d.classList.contains('on') ? 1.2 : 1), 0, Math.PI * 2);
          c.fillStyle = d.classList.contains('on') ? '#fff' : 'rgba(255,255,255,0.35)';
          c.fill();
        });
      }
    }
  } else if (inst.view === 'item') {
    const viewerEl = inst.el.querySelector('.viewer');
    const img = inst.el.querySelector('.viewer-img');
    const vid = inst.el.querySelector('.viewer-video');
    if (img && !img.hidden && img.naturalWidth) drawImageContain(c, img, img.naturalWidth, img.naturalHeight, sr.left, sr.top, sr.width, sr.height);
    else if (vid && !vid.hidden && vid.videoWidth) drawImageContain(c, vid, vid.videoWidth, vid.videoHeight, sr.left, sr.top, sr.width, sr.height);

    // Top-right viewer action pills
    const vaMap = [
      ['.dl-btn', 'download', '#fff'],
      ['.del-btn', 'trash', '#ff9a92'],
      ['.viewer-close-btn', 'close', '#fff'],
    ];
    for (const [sel, glyph, col] of vaMap) {
      const btn = viewerEl?.querySelector(sel);
      if (!btn || btn.hidden) continue;
      const br = btn.getBoundingClientRect();
      if (!br.width) continue;
      rrect(c, br.left, br.top, br.width, br.height, 8);
      c.fillStyle = 'rgba(20,21,26,0.72)';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 0.8;
      c.stroke();
      drawGlyph(c, glyph, br.left + br.width / 2, br.top + br.height / 2, 15, col);
    }
    if (vid && !vid.hidden) drawUvpBar(c, viewerEl);
  } else if (inst.canvas.width && inst.canvas.height) {
    drawImageCover(c, inst.canvas, inst.canvas.width, inst.canvas.height, sr.left, sr.top, sr.width, sr.height);
  }

  // Stage overlays: recording badge, countdown, stage toast, camera message
  const recBadge = inst.el.querySelector('.rec-badge');
  if (recBadge && !recBadge.hidden) {
    const rb = recBadge.getBoundingClientRect();
    if (rb.width) {
      rrect(c, rb.left, rb.top, rb.width, rb.height, rb.height / 2);
      c.fillStyle = 'rgba(0,0,0,0.6)';
      c.fill();
      c.beginPath();
      c.arc(rb.left + 18, rb.top + rb.height / 2, 5, 0, Math.PI * 2);
      c.fillStyle = '#ff453a';
      c.fill();
      c.font = '600 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = '#fff';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      c.fillText(recBadge.querySelector('.rec-time')?.textContent || '0:00', rb.left + 29, rb.top + rb.height / 2);
    }
  }
  const cdEl = inst.el.querySelector('.countdown');
  if (cdEl && !cdEl.hidden) {
    const numEl = cdEl.querySelector('.cd-num');
    const noteEl = cdEl.querySelector('.cd-note');
    if (numEl && numEl.textContent) {
      const nr = numEl.getBoundingClientRect();
      c.save();
      c.font = '700 ' + Math.round(Math.min(sr.height * 0.34, 140)) + 'px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = '#fff';
      c.shadowColor = 'rgba(255,59,48,0.55)';
      c.shadowBlur = 32;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(numEl.textContent, nr.left + nr.width / 2, nr.top + nr.height / 2);
      c.restore();
    }
    if (noteEl && noteEl.textContent) {
      const tr = noteEl.getBoundingClientRect();
      if (tr.width) {
        drawThemedBox(c, pal, tr.left, tr.top, tr.width, tr.height, {
          r: tr.height / 2, sweetR: 3, sweetFill: '#e4ded3', shadow: 2,
          fill: retro ? '#faf7ec' : 'rgba(24,25,30,0.78)',
          stroke: retro ? '#18181b' : 'rgba(255,255,255,0.16)', lineWidth: retro ? 2 : 1,
        });
        c.font = `${sweet ? '700' : '600'} 12px ${sweet ? '"JetBrains Mono", ui-monospace, Menlo, monospace' : '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'}`;
        c.fillStyle = (retro || sweet) ? '#2e2d34' : 'rgba(255,255,255,0.95)';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(noteEl.textContent, tr.left + tr.width / 2, tr.top + tr.height / 2);
      }
    }
  }
  const stToast = inst.el.querySelector('.stage-toast');
  if (stToast && !stToast.hidden && stToast.textContent) {
    const tr = stToast.getBoundingClientRect();
    if (tr.width) {
      drawThemedBox(c, pal, tr.left, tr.top, tr.width, tr.height, {
        r: tr.height / 2, sweetR: 3, sweetFill: '#e4ded3', shadow: 2,
        fill: retro ? '#faf7ec' : 'rgba(24,25,30,0.78)',
        stroke: retro ? '#18181b' : 'rgba(255,255,255,0.16)', lineWidth: retro ? 2 : 1,
      });
      c.font = `${sweet ? '700' : '600'} 12px ${sweet ? '"JetBrains Mono", ui-monospace, Menlo, monospace' : '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'}`;
      c.fillStyle = (retro || sweet) ? '#2e2d34' : '#fff';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(stToast.textContent, tr.left + tr.width / 2, tr.top + tr.height / 2);
    }
  }
  const msgEl = inst.el.querySelector('.message');
  if (msgEl && !msgEl.hidden && msgEl.textContent) {
    c.font = '500 15px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    c.fillStyle = 'rgba(255,255,255,0.78)';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(msgEl.textContent, sr.left + sr.width / 2, sr.top + sr.height / 2);
  }
  c.restore();

  // Subtle stage glass rim or skin ink outline
  if (stageRad > 0) {
    c.save();
    rrect(c, sr.left + ((retro || sweet) ? 0 : 0.5), sr.top + ((retro || sweet) ? 0 : 0.5), sr.width - ((retro || sweet) ? 0 : 1), sr.height - ((retro || sweet) ? 0 : 1), stageRad);
    c.strokeStyle = sweet ? '#2e2d34' : (retro ? '#18181b' : 'rgba(255,255,255,0.08)');
    c.lineWidth = (retro || sweet) ? 1.5 : 1;
    c.stroke();
    c.restore();
  }

  // Library thumbnails (respect strip-hidden as well as lib-empty)
  if (!inst.el.classList.contains('lib-empty') && !inst.el.classList.contains('strip-hidden')) {
    const libEl = inst.el.querySelector('.library');
    const lr = libEl?.getBoundingClientRect();
    if (lr && lr.width && lr.height) {
      c.save();
      c.beginPath();
      c.rect(lr.left, lr.top, lr.width, lr.height);
      c.clip();
      libEl.querySelectorAll('.thumb').forEach((th) => {
        const tr = th.getBoundingClientRect();
        const img = th.querySelector('img');
        const thRad = sweet ? 2 : 6;
        c.save();
        rrect(c, tr.left, tr.top, tr.width, tr.height, thRad);
        c.clip();
        c.fillStyle = '#000';
        c.fillRect(tr.left, tr.top, tr.width, tr.height);
        if (img && img.naturalWidth) drawImageContain(c, img, img.naturalWidth, img.naturalHeight, tr.left, tr.top, tr.width, tr.height);
        const badge = th.querySelector('.badge');
        if (badge && badge.textContent) {
          const br = badge.getBoundingClientRect();
          if (br.width) {
            rrect(c, br.left, br.top, br.width, br.height, br.height / 2);
            c.fillStyle = 'rgba(0,0,0,0.62)';
            c.fill();
            c.font = '700 9px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
            c.fillStyle = '#fff';
            c.textAlign = 'center';
            c.textBaseline = 'middle';
            c.fillText(badge.textContent, br.left + br.width / 2, br.top + br.height / 2);
          }
        }
        c.restore();
        if (th.classList.contains('active')) {
          c.save();
          rrect(c, tr.left, tr.top, tr.width, tr.height, thRad);
          c.strokeStyle = sweet ? '#d16d89' : (retro ? '#ec5eb0' : pal.accent);
          c.lineWidth = 2.5;
          c.stroke();
          c.restore();
        } else if (retro || sweet) {
          c.save();
          rrect(c, tr.left, tr.top, tr.width, tr.height, thRad);
          c.strokeStyle = sweet ? '#2e2d34' : '#18181b';
          c.lineWidth = sweet ? 1.2 : 1.5;
          c.stroke();
          c.restore();
        }
      });
      c.restore();
    }
  }

  // Segmented modes
  const mr = inst.el.querySelector('.modes').getBoundingClientRect();
  c.save();
  drawThemedBox(c, pal, mr.left, mr.top, mr.width, mr.height, {
    r: 7, sweetR: 3, sweetFill: '#e4ded3', retroOffset: 2, fill: pal.ctlBg, stroke: '#18181b', lineWidth: 1.75,
  });
  const ind = inst.el.querySelector('.modes .ind').getBoundingClientRect();
  rrect(c, ind.left, ind.top, ind.width, ind.height, sweet ? 2 : 5);
  c.fillStyle = pal.accent;
  c.fill();
  if (retro || sweet) {
    c.strokeStyle = sweet ? '#2e2d34' : '#18181b'; c.lineWidth = 1.25; c.stroke();
  }
  c.lineWidth = 1.5;
  inst.el.querySelectorAll('.mode').forEach((m) => {
    const br = m.getBoundingClientRect();
    const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
    const isAct = m.classList.contains('active');
    const col = isAct ? '#fff' : ((retro || sweet) ? '#2e2d34' : (pal.light ? 'rgba(29,29,31,0.72)' : 'rgba(255,255,255,0.75)'));
    if (m.dataset.mode === '4up') {
      c.strokeStyle = col;
      c.strokeRect(cx - 5.5, cy - 5.5, 4.5, 4.5); c.strokeRect(cx + 1, cy - 5.5, 4.5, 4.5);
      c.strokeRect(cx - 5.5, cy + 1, 4.5, 4.5); c.strokeRect(cx + 1, cy + 1, 4.5, 4.5);
    } else if (m.dataset.mode === 'photo') {
      c.strokeStyle = col;
      rrect(c, cx - 5.8, cy - 5.8, 11.6, 11.6, 1.8); c.stroke();
      c.beginPath(); c.arc(cx, cy - 1.3, 1.8, 0, Math.PI * 2); c.stroke();
      c.beginPath();
      c.moveTo(cx - 3.4, cy + 4.2);
      c.quadraticCurveTo(cx, cy + 0.6, cx + 3.4, cy + 4.2);
      c.stroke();
    } else {
      drawGlyph(c, 'video', cx, cy, 14, col);
    }
  });
  c.restore();

  // Red shutter (matte macOS Photo Booth style matching DOM)
  const shEl = inst.el.querySelector('.shutter');
  const sh = shEl.getBoundingClientRect();
  const scx = sh.left + sh.width / 2, scy = sh.top + sh.height / 2, srR = sh.width / 2;
  const isSq = inst.recording || shEl.classList.contains('counting') || inst.busy;
  const shRad = isSq ? Math.min(18, srR * 0.72) : srR;
  c.save();
  if (retro || sweet) {
    rrect(c, sh.left + 2, sh.top + 2, sh.width, sh.height, shRad);
    c.fillStyle = sweet ? 'rgba(46,45,52,0.24)' : '#18181b'; c.fill();
  }
  c.save();
  if (!retro && !sweet) {
    c.shadowColor = isSq ? 'rgba(255,59,48,0.72)' : 'rgba(0,0,0,0.32)';
    c.shadowBlur = isSq ? 16 : 6;
    c.shadowOffsetY = 2;
  }
  const sg = c.createLinearGradient(0, sh.top, 0, sh.bottom);
  sg.addColorStop(0, '#f2170f');
  sg.addColorStop(1, '#dc0f07');
  rrect(c, sh.left, sh.top, sh.width, sh.height, shRad);
  c.fillStyle = sg;
  c.fill();
  c.restore();
  rrect(c, sh.left + ((retro || sweet) ? 0 : 0.6), sh.top + ((retro || sweet) ? 0 : 0.6), sh.width - ((retro || sweet) ? 0 : 1.2), sh.height - ((retro || sweet) ? 0 : 1.2), shRad);
  c.strokeStyle = sweet ? '#2e2d34' : (retro ? '#18181b' : '#ff3b30');
  c.lineWidth = (retro || sweet) ? 1.75 : 1.25;
  c.stroke();

  c.fillStyle = '#fff';
  const icoScale = sh.width / 50;
  c.translate(scx, scy);
  c.scale(icoScale, icoScale);
  if (shEl.classList.contains('counting') || inst.busy) {
    drawGlyph(c, 'close', 0, 0, 18, '#fff');
  } else if (inst.recording) {
    rrect(c, -6, -6, 12, 12, 2.5);
    c.fill();
  } else if (inst.mode === 'video') {
    rrect(c, -9.5, -5.5, 13, 11, 2.4); c.fill();
    c.beginPath(); c.moveTo(4.5, -2); c.lineTo(9.5, -5); c.lineTo(9.5, 5); c.lineTo(4.5, 2); c.closePath(); c.fill();
  } else {
    rrect(c, -9.5, -5, 19, 13, 2.3); c.fill();
    c.beginPath(); c.moveTo(-4.4, -5); c.lineTo(-2.8, -7.2); c.lineTo(2.8, -7.2); c.lineTo(4.4, -5); c.fill();
    c.fillStyle = '#e2120a';
    c.beginPath(); c.arc(0, 1.3, 4.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(6.2, -2.1, 1.15, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.arc(0, 1.3, 2.2, 0, Math.PI * 2); c.fill();
  }
  c.restore();

  // Right segmented tray (.right) containing Strip, Flash, and Effects buttons
  const rightBox = inst.el.querySelector('.right');
  if (rightBox) {
    const rbr = rightBox.getBoundingClientRect();
    if (rbr.width) {
      const icoCol = (retro || sweet) ? '#2e2d34' : (pal.light ? 'rgba(29,29,31,0.72)' : 'rgba(255,255,255,0.78)');
      c.save();
      drawThemedBox(c, pal, rbr.left, rbr.top, rbr.width, rbr.height, {
        r: 7, sweetR: 3, sweetFill: '#e4ded3', retroOffset: 2, fill: pal.ctlBg, stroke: '#18181b', lineWidth: 1.75,
      });

      // 1) Gallery Strip button (.strip-btn)
      const sb = rightBox.querySelector('.strip-btn');
      if (sb) {
        const sbr = sb.getBoundingClientRect();
        const isOn = sb.classList.contains('on');
        const isEmpty = sb.classList.contains('is-empty');
        c.save();
        if (isEmpty && !isOn) c.globalAlpha = 0.62;
        if (isOn) {
          rrect(c, sbr.left, sbr.top, sbr.width, sbr.height, sweet ? 2 : 5);
          c.fillStyle = pal.accent;
          c.fill();
          if (retro || sweet) { c.strokeStyle = '#2e2d34'; c.lineWidth = 1.25; c.stroke(); }
        }
        drawGlyph(c, 'strip', sbr.left + sbr.width / 2, sbr.top + sbr.height / 2, 14, isOn ? '#fff' : icoCol);
        c.restore();
      }

      // 2) Flash button (.flash-btn)
      const fb = rightBox.querySelector('.flash-btn');
      if (fb) {
        const fr = fb.getBoundingClientRect();
        if (inst.flashOn) {
          rrect(c, fr.left, fr.top, fr.width, fr.height, sweet ? 2 : 5);
          c.fillStyle = (retro || sweet) ? '#f2da5e' : 'rgba(255,214,10,0.24)';
          c.fill();
          c.strokeStyle = (retro || sweet) ? '#2e2d34' : 'rgba(255,214,10,0.65)';
          c.lineWidth = (retro || sweet) ? 1.25 : 1;
          c.stroke();
        }
        drawGlyph(
          c, 'flash',
          fr.left + fr.width / 2, fr.top + fr.height / 2, 14,
          inst.flashOn ? (retro || sweet || pal.light ? '#b45309' : '#ffd60a') : icoCol,
          inst.flashOn && !retro && !sweet ? 'rgba(255,214,10,0.35)' : null
        );
      }

      // 3) Effects button (.effects-btn)
      const eb = rightBox.querySelector('.effects-btn');
      if (eb) {
        const er = eb.getBoundingClientRect();
        if (inst.effectsOpen) {
          rrect(c, er.left, er.top, er.width, er.height, sweet ? 2 : 5);
          c.fillStyle = pal.accent;
          c.fill();
          if (retro || sweet) { c.strokeStyle = '#2e2d34'; c.lineWidth = 1.25; c.stroke(); }
        }
        drawGlyph(
          c, inst.effectsOpen ? 'check' : 'fx',
          er.left + er.width / 2, er.top + er.height / 2, 14,
          inst.effectsOpen ? '#fff' : icoCol
        );
      }
      c.restore();
    }
  }
}

function drawMacSplitFrame(c, winEl, paneTitle, blurInfo = null) {
  const isFocused = winEl.classList.contains('focused');
  const wr = winEl.getBoundingClientRect();
  const pal = shotPalette();
  const retro = pal.retro;
  const sweet = pal.sweet;
  const rad = sweet ? 3 : (retro ? 14 : 18);
  drawWindowFrame(c, winEl, '', isFocused, rad, blurInfo);
  const sb = winEl.querySelector('.mac-sidebar').getBoundingClientRect();
  c.save();
  rrect(c, wr.left, wr.top, wr.width, wr.height, rad);
  c.clip();
  c.fillStyle = sweet ? '#e4ded3' : (retro ? '#ebe5ce' : (pal.light ? 'rgba(235,237,243,0.62)' : 'rgba(255,255,255,0.035)'));
  c.fillRect(sb.left, sb.top, sb.width, sb.height);
  c.strokeStyle = sweet ? '#8f8980' : (retro ? '#18181b' : (pal.light ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.09)'));
  c.lineWidth = retro ? 2 : (sweet ? 1.5 : 1);
  c.beginPath(); c.moveTo(sb.right, sb.top); c.lineTo(sb.right, sb.bottom); c.stroke();

  if (sweet) {
    const sbTop = winEl.querySelector('.mac-sb-top')?.getBoundingClientRect();
    if (sbTop && sbTop.height) {
      c.fillStyle = isFocused ? '#2b468b' : '#8b8780';
      c.fillRect(sb.left, sbTop.top, sb.width, sbTop.height);
      c.strokeStyle = '#2e2d34'; c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(sb.left, sbTop.bottom); c.lineTo(sb.right, sbTop.bottom); c.stroke();
      // Re-draw lights on top of Navy sbTop bar
      winEl.querySelectorAll('.light').forEach((dot) => {
        const dr = dot.getBoundingClientRect();
        if (!dr.width) return;
        drawWin98Bevel(c, dr.left, dr.top, dr.width, dr.height, 2, dot.classList.contains('close') ? '#f3cdd8' : '#e4ded3', false);
        const cx = dr.left + dr.width / 2, cy = dr.top + dr.height / 2;
        c.strokeStyle = '#2e2d34'; c.lineWidth = 1.3;
        if (dot.classList.contains('close')) {
          c.beginPath(); c.moveTo(cx - 2.5, cy - 2.5); c.lineTo(cx + 2.5, cy + 2.5); c.moveTo(cx + 2.5, cy - 2.5); c.lineTo(cx - 2.5, cy + 2.5); c.stroke();
        } else if (dot.classList.contains('min')) {
          c.beginPath(); c.moveTo(cx - 3, cy + 2.5); c.lineTo(cx + 3, cy + 2.5); c.stroke();
        } else {
          c.strokeRect(cx - 3, cy - 2.6, 6, 5.2);
        }
      });
    }
  }

  const searchWrap = winEl.querySelector('.mac-search-wrap');
  if (searchWrap) {
    const swr = searchWrap.getBoundingClientRect();
    if (swr.width && swr.height) {
      if (retro) {
        rrect(c, swr.left + 2, swr.top + 2, swr.width, swr.height, swr.height / 2);
        c.fillStyle = '#ec5eb0'; c.fill();
      }
      if (sweet) {
        drawWin98Bevel(c, swr.left, swr.top, swr.width, swr.height, 2, '#faf6ec', true);
      } else {
        rrect(c, swr.left, swr.top, swr.width, swr.height, retro ? swr.height / 2 : 8);
        c.fillStyle = retro ? '#fffdf5' : (pal.light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)');
        c.fill();
        c.strokeStyle = retro ? '#18181b' : (pal.light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.1)');
        c.lineWidth = retro ? 2 : 1;
        c.stroke();
      }
      drawGlyph(c, 'search', swr.left + 15, swr.top + swr.height / 2, 12.5, (retro || sweet) ? '#2e2d34' : (pal.light ? 'rgba(29,29,31,0.52)' : 'rgba(255,255,255,0.48)'));
      const inp = searchWrap.querySelector('.mac-search-input');
      const clr = searchWrap.querySelector('.mac-search-clear');
      const hasClr = clr && !clr.hidden;
      const val = inp?.value || '';
      c.font = '400 12.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = val ? pal.text1 : pal.text3;
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(val || inp?.placeholder || 'Search', swr.left + 26, swr.top + swr.height / 2, swr.width - (hasClr ? 54 : 36));
      if (hasClr) {
        const cr = clr.getBoundingClientRect();
        if (cr.width) {
          if (sweet) {
            drawWin98Bevel(c, cr.left, cr.top, cr.width, cr.height, 2, '#e89ab0', false);
          } else {
            c.beginPath(); c.arc(cr.left + cr.width / 2, cr.top + cr.height / 2, cr.width / 2, 0, Math.PI * 2);
            c.fillStyle = retro ? '#f2da5e' : pal.ctlBg; c.fill();
            if (retro) { c.strokeStyle = '#18181b'; c.lineWidth = 1.25; c.stroke(); }
          }
          drawGlyph(c, 'close', cr.left + cr.width / 2, cr.top + cr.height / 2, 9, (retro || sweet) ? '#2e2d34' : pal.text1);
        }
      }
    }
  }

  const sbLabel = winEl.querySelector('.mac-sb-label');
  if (sbLabel && sbLabel.textContent && !sbLabel.hidden) {
    const lr = sbLabel.getBoundingClientRect();
    c.font = sweet ? '700 11px "JetBrains Mono", ui-monospace, Menlo, monospace' : '700 11px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    c.fillStyle = pal.text3;
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(sbLabel.textContent, lr.left + 8, lr.top + lr.height / 2);
  }
  const noRes = winEl.querySelector('.mac-search-empty');
  if (noRes && !noRes.hidden && noRes.textContent) {
    const nr = noRes.getBoundingClientRect();
    if (nr.width) {
      c.font = '500 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text3;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(noRes.textContent.trim(), nr.left + nr.width / 2, nr.top + nr.height / 2);
    }
  }

  const topR = winEl.querySelector('.mac-main-top').getBoundingClientRect();
  if (sweet) {
    const g = c.createLinearGradient(topR.left, 0, topR.right, 0);
    g.addColorStop(0, isFocused ? '#2b468b' : '#8b8780');
    g.addColorStop(1, isFocused ? '#5b7fc5' : '#b6b0a6');
    c.fillStyle = g;
    c.fillRect(topR.left, topR.top, topR.width, topR.height);
  } else if (retro) {
    c.fillStyle = '#ebe5ce';
    c.fillRect(topR.left, topR.top, topR.width, topR.height);
  }
  c.strokeStyle = (retro || sweet) ? '#2e2d34' : (pal.light ? 'rgba(0,0,0,0.09)' : 'rgba(255,255,255,0.09)');
  c.lineWidth = (retro || sweet) ? 1.5 : 1;
  c.beginPath(); c.moveTo(topR.left, topR.bottom); c.lineTo(topR.right, topR.bottom); c.stroke();
  c.font = sweet ? '700 13px "JetBrains Mono", ui-monospace, Menlo, monospace' : `${retro ? '700' : '600'} 15px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
  c.fillStyle = sweet ? '#faf6ec' : (isFocused || retro ? pal.text1 : pal.text3);
  c.textAlign = 'left'; c.textBaseline = 'middle';
  c.fillText(paneTitle, topR.left + 18, topR.top + topR.height / 2);
  c.restore();
}

function drawWallpaperPane(c) {
  const pal = shotPalette();
  const pane = $('#setPaneWallpaper');
  const headBar = pane?.querySelector('.wall-head-bar')?.getBoundingClientRect();
  if (headBar && headBar.width) {
    drawThemedBox(c, pal, headBar.left, headBar.top, headBar.width, headBar.height, {
      r: 12, sweetR: 3, sweetFill: '#faf6ec', inset: true, retroOffset: 3, retroShadow: '#f2da5e', retroShadowStroke: true,
    });
  }
  const miniEl = $('#wallMiniStage');
  const mini = miniEl?.getBoundingClientRect();
  if (mini && mini.width) {
    c.save();
    rrect(c, mini.left, mini.top, mini.width, mini.height, pal.sweet ? 2 : 8);
    c.clip();
    if ((pal.retro || pal.sweet) && (appEl.dataset.wallPhoto !== '1')) {
      const skinKey = pal.sweet ? 'sweet-98' : 'retro-pop';
      const bgCol = appEl.dataset.customBg === '1' ? wallState.color : (pal.sweet ? '#82a3c6' : '#1d7e75');
      const gridCol = appEl.dataset.customBg === '1' && typeof getRetroGridColor === 'function'
        ? getRetroGridColor(bgCol, skinKey)
        : (pal.sweet ? 'rgba(43,70,139,0.14)' : 'rgba(9,44,41,0.42)');
      const step = pal.sweet ? 12 : 16;
      c.fillStyle = bgCol;
      c.fillRect(mini.left, mini.top, mini.width, mini.height);
      c.strokeStyle = gridCol;
      c.lineWidth = 1;
      for (let x = mini.left; x <= mini.right; x += step) {
        c.beginPath(); c.moveTo(x, mini.top); c.lineTo(x, mini.bottom); c.stroke();
      }
      for (let y = mini.top; y <= mini.bottom; y += step) {
        c.beginPath(); c.moveTo(mini.left, y); c.lineTo(mini.right, y); c.stroke();
      }
    } else {
      c.fillStyle = wallState.color;
      c.fillRect(mini.left, mini.top, mini.width, mini.height);
      if (wallState.tab === 'photo' && wallState.imgEl && wallState.imgEl.complete) {
        drawImageCover(c, wallState.imgEl, wallState.imgEl.naturalWidth, wallState.imgEl.naturalHeight, mini.left, mini.top, mini.width, mini.height);
      }
    }
    const mw = miniEl.querySelector('.mini-win');
    if (mw) {
      const mr = mw.getBoundingClientRect();
      if (mr.width) {
        rrect(c, mr.left, mr.top, mr.width, mr.height, pal.sweet ? 2 : 4);
        c.fillStyle = pal.sweet ? '#e4ded3' : (pal.retro ? '#faf7ec' : (pal.light ? 'rgba(255,255,255,0.88)' : 'rgba(28,30,36,0.88)'));
        c.fill();
        c.strokeStyle = (pal.retro || pal.sweet) ? '#2e2d34' : pal.cardBorder;
        c.lineWidth = 1;
        c.stroke();
        mw.querySelectorAll('i').forEach((dot, idx) => {
          const dr = dot.getBoundingClientRect();
          if (!dr.width) return;
          c.beginPath();
          c.arc(dr.left + dr.width / 2, dr.top + dr.height / 2, dr.width / 2, 0, Math.PI * 2);
          c.fillStyle = ['#ff5f57', '#febc2e', '#28c840'][idx] || '#ff5f57';
          c.fill();
        });
      }
    }
    const md = miniEl.querySelector('.mini-dock');
    if (md) {
      const mdr = md.getBoundingClientRect();
      if (mdr.width) {
        rrect(c, mdr.left, mdr.top, mdr.width, mdr.height, pal.sweet ? 2 : mdr.height / 2);
        c.fillStyle = (pal.retro || pal.sweet) ? '#faf6ec' : 'rgba(255,255,255,0.6)';
        c.fill();
      }
    }
    c.restore();
    rrect(c, mini.left, mini.top, mini.width, mini.height, pal.sweet ? 2 : 8);
    c.strokeStyle = (pal.retro || pal.sweet) ? '#2e2d34' : pal.cardBorder;
    c.lineWidth = (pal.retro || pal.sweet) ? 1.5 : 1;
    c.stroke();
  }
  const miniCap = pane?.querySelector('.mini-cap');
  if (miniCap && miniCap.textContent) {
    const cr = miniCap.getBoundingClientRect();
    c.font = '600 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    c.fillStyle = pal.text1;
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(miniCap.textContent.trim(), cr.left, cr.top + cr.height / 2);
  }
  c.save();
  const tr = wallTabs.getBoundingClientRect();
  if (tr.width) {
    drawThemedBox(c, pal, tr.left, tr.top, tr.width, tr.height, {
      r: 8, sweetR: 2, sweetFill: pal.segBg, inset: true, fill: pal.segBg, stroke: '#18181b', lineWidth: 1.5,
    });
  }
  c.font = '500 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  wallTabs.querySelectorAll('.wall-tab').forEach((tab) => {
    const r = tab.getBoundingClientRect();
    if (tab.classList.contains('active')) {
      if (pal.sweet) {
        drawWin98Bevel(c, r.left, r.top, r.width, r.height, 2, pal.segActive, false);
      } else {
        rrect(c, r.left, r.top, r.width, r.height, 6);
        c.fillStyle = pal.segActive; c.fill();
        if (pal.retro) { c.strokeStyle = '#18181b'; c.lineWidth = 1.25; c.stroke(); }
      }
    }
    c.fillStyle = tab.classList.contains('active') ? pal.text1 : pal.text2;
    c.fillText(tab.textContent.trim(), r.left + r.width / 2, r.top + r.height / 2);
  });
  c.restore();

  if (wallState.tab === 'color') {
    const svr = svCanvas.getBoundingClientRect();
    c.save();
    rrect(c, svr.left, svr.top, svr.width, svr.height, pal.sweet ? 2 : 10);
    c.clip();
    c.drawImage(svCanvas, svr.left, svr.top, svr.width, svr.height);
    const kr = $('#svKnob').getBoundingClientRect();
    c.beginPath();
    c.arc(kr.left + kr.width / 2, kr.top + kr.height / 2, 6, 0, Math.PI * 2);
    c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
    c.restore();
    if (pal.retro || pal.sweet) {
      rrect(c, svr.left, svr.top, svr.width, svr.height, pal.sweet ? 2 : 10);
      c.strokeStyle = pal.sweet ? '#2e2d34' : '#18181b'; c.lineWidth = 1.5; c.stroke();
    }

    ['.wall-sliders', '.swatches-group'].forEach((sel) => {
      const grpR = pane?.querySelector(sel)?.getBoundingClientRect();
      if (grpR && grpR.width) {
        drawThemedBox(c, pal, grpR.left, grpR.top, grpR.width, grpR.height, {
          r: 12, sweetR: 3, sweetFill: '#faf6ec', inset: true, retroOffset: 3, retroShadow: '#f2da5e', retroShadowStroke: true,
        });
      }
    });

    c.save();
    c.font = '12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    settingsWin.querySelectorAll('.slider-row').forEach((row) => {
      const label = row.querySelector('span')?.textContent || '';
      const rng = row.querySelector('input[type="range"]');
      const outEl = row.querySelector('output');
      const rr = row.getBoundingClientRect();
      const ir = rng.getBoundingClientRect();
      c.fillStyle = pal.text2;
      c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(label, rr.left + 12, rr.top + rr.height / 2);

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
      c.strokeStyle = (pal.retro || pal.sweet) ? '#2e2d34' : 'rgba(0,0,0,0.28)'; c.lineWidth = (pal.retro || pal.sweet) ? 1.5 : 1; c.stroke();

      c.fillStyle = pal.text3;
      c.textAlign = 'right';
      c.fillText(outEl ? outEl.textContent : '', rr.right - 12, rr.top + rr.height / 2);
    });
    const hexLbl = pane?.querySelector('.hex-row > span');
    if (hexLbl) {
      const hr = hexLbl.getBoundingClientRect();
      c.fillStyle = pal.text2; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(hexLbl.textContent.trim(), hr.left, hr.top + hr.height / 2);
    }

    const sw = colorSwatch.getBoundingClientRect();
    c.beginPath(); c.arc(sw.left + sw.width / 2, sw.top + sw.height / 2, sw.width / 2, 0, Math.PI * 2);
    c.fillStyle = wallState.color; c.fill();
    c.strokeStyle = (pal.retro || pal.sweet) ? '#2e2d34' : pal.cardBorder; c.stroke();
    const hx = $('.hex-field').getBoundingClientRect();
    drawThemedBox(c, pal, hx.left, hx.top, hx.width, hx.height, {
      r: 7, sweetR: 2, sweetFill: '#faf6ec', inset: true,
      fill: pal.retro ? '#fffdf5' : (pal.light ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.28)'), stroke: '#18181b', lineWidth: 1.5,
    });
    c.font = '12.5px "JetBrains Mono", ui-monospace, Menlo, monospace';
    c.fillStyle = pal.text1; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(wallState.color, hx.left + hx.width / 2, hx.top + hx.height / 2);
    colorPresetsEl.querySelectorAll('.preset').forEach((p) => {
      const pr = p.getBoundingClientRect();
      c.beginPath(); c.arc(pr.left + pr.width / 2, pr.top + pr.height / 2, pr.width / 2, 0, Math.PI * 2);
      c.fillStyle = p.dataset.color; c.fill();
      if (pal.retro || pal.sweet) { c.strokeStyle = '#2e2d34'; c.lineWidth = 1.25; c.stroke(); }
    });
    c.restore();
  } else {
    const dr = wallDrop.getBoundingClientRect();
    c.save();
    rrect(c, dr.left, dr.top, dr.width, dr.height, pal.sweet ? 2 : 10);
    if (wallState.imgEl && wallState.imgEl.complete) {
      c.clip();
      drawImageCover(c, wallState.imgEl, wallState.imgEl.naturalWidth, wallState.imgEl.naturalHeight, dr.left, dr.top, dr.width, dr.height);
    } else {
      c.fillStyle = pal.sweet ? '#faf6ec' : pal.ctlBg;
      c.fill();
      c.setLineDash([5, 4]);
      c.strokeStyle = (pal.retro || pal.sweet) ? '#2e2d34' : pal.cardBorder;
      c.stroke();
      c.setLineDash([]);
      drawGlyph(c, 'wall', dr.left + dr.width / 2, dr.top + dr.height / 2 - 14, 24, pal.text2);
      c.font = '13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text2;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText($('#wallDropMsg span')?.textContent?.trim() || 'Drop or upload image', dr.left + dr.width / 2, dr.top + dr.height / 2 + 14);
    }
    c.restore();

    const photoGrp = $('#wallPhotoPane')?.querySelector('.mac-group');
    if (photoGrp) {
      const pgr = photoGrp.getBoundingClientRect();
      if (pgr.width) {
        drawThemedBox(c, pal, pgr.left, pgr.top, pgr.width, pgr.height, {
          r: 12, sweetR: 3, sweetFill: '#faf6ec', inset: true, retroOffset: 3, retroShadow: '#f2da5e', retroShadowStroke: true,
        });
        const imgSpan = photoGrp.querySelector('.mac-row:first-child > span');
        if (imgSpan) {
          const isr = imgSpan.getBoundingClientRect();
          c.font = '500 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = pal.text1; c.textAlign = 'left'; c.textBaseline = 'middle';
          c.fillText(imgSpan.textContent.trim(), isr.left, isr.top + isr.height / 2);
        }
      }
    }

    c.save();
    c.font = '500 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    [wallUploadBtn, wallClearBtn].forEach((btn) => {
      if (!btn || btn.hidden) return;
      const br = btn.getBoundingClientRect();
      if (!br.width) return;
      const isPrim = btn.classList.contains('primary');
      if (pal.sweet) {
        drawWin98Bevel(c, br.left, br.top, br.width, br.height, 2, isPrim ? '#2b468b' : '#f8d4de', false);
      } else {
        rrect(c, br.left, br.top, br.width, br.height, 7);
        c.fillStyle = isPrim ? pal.accent : 'rgba(255,69,58,0.24)';
        c.fill();
        if (pal.retro) { c.strokeStyle = '#18181b'; c.lineWidth = 1.5; c.stroke(); }
      }
      c.strokeStyle = isPrim ? '#fff' : '#e12d24';
      c.lineWidth = 1.6;
      const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
      drawGlyph(c, btn === wallUploadBtn ? 'upload' : 'trash', cx, cy, 14, isPrim ? '#fff' : (pal.sweet ? '#9c2246' : '#e12d24'));
    });

    const fitRow = $('#wallFitRow');
    if (fitRow && !fitRow.hidden) {
      const lbl = fitRow.querySelector('span').getBoundingClientRect();
      c.font = '500 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text1;
      c.textAlign = 'left';
      c.fillText('Fit', lbl.left, lbl.top + lbl.height / 2);
      const seg = fitRow.querySelector('.fit-seg').getBoundingClientRect();
      drawThemedBox(c, pal, seg.left, seg.top, seg.width, seg.height, {
        r: 8, sweetR: 2, sweetFill: pal.segBg, inset: true, fill: pal.segBg, stroke: '#18181b', lineWidth: 1.5,
      });
      fitRow.querySelectorAll('button').forEach((b) => {
        const br = b.getBoundingClientRect();
        if (b.classList.contains('active')) {
          if (pal.sweet) {
            drawWin98Bevel(c, br.left, br.top, br.width, br.height, 2, pal.segActive, false);
          } else {
            rrect(c, br.left, br.top, br.width, br.height, 6);
            c.fillStyle = pal.segActive; c.fill();
            if (pal.retro) { c.strokeStyle = '#18181b'; c.lineWidth = 1.25; c.stroke(); }
          }
        }
        const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
        c.strokeStyle = b.classList.contains('active') ? pal.text1 : pal.text2;
        c.lineWidth = 1.4;
        rrect(c, cx - 5.5, cy - 4.5, 11, 9, 1.5); c.stroke();
      });
    }
    c.restore();
  }
  const wNote = pane?.querySelector('.mac-foot-note');
  if (wNote && wNote.textContent) {
    const nr = wNote.getBoundingClientRect();
    if (nr.width && nr.height) {
      c.font = '400 11.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text3;
      drawWrappedText(c, wNote.textContent.trim(), nr.left, nr.top, nr.width, 15.5, 'left');
    }
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
  const cat = itemCategory(lastShotItem);
  const tab = filesTabsEl?.querySelector(`.ftab[data-filter="${cat}"]`) || filesTabsEl?.querySelector('.ftab[data-filter="all"]');
  if (tab) tab.click();
  openFilePreview(lastShotItem.id);
}

function showShotToast(savedItem, previewBlob) {
  lastShotItem = savedItem;
  if (toastUrl) URL.revokeObjectURL(toastUrl);
  toastUrl = URL.createObjectURL(previewBlob);
  $('#shotPreview').src = toastUrl;
  if (shotToastEl) {
    shotToastEl.hidden = false;
    scheduleShotToastHide();
  }
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

async function ensureDockSvgsCached() {
  if (document.fonts && document.fonts.ready) {
    try { await document.fonts.ready; } catch (_) {}
  }
  const btns = [dockApp, dockFiles, dockSettings, dockShot];
  const logoImg = $('#settingsWin .about-logo-badge img');
  const logoTask = logoImg && typeof logoImg.decode === 'function'
    ? logoImg.decode().catch(() => {})
    : Promise.resolve();
  const svgTasks = [];
  for (const b of btns) {
    if (!b) continue;
    b.querySelectorAll('svg').forEach((s) => svgTasks.push(svgElementToImage(s)));
  }
  await Promise.all([logoTask, ...svgTasks]);
}

function drawDesktopComposition(c, W, H) {
  const retro = shotIsRetro();
  const sweet = shotIsSweet98();
  // 1. Wallpaper (Teal/Powder-Blue + Grid for custom skins unless photo wallpaper is set)
  if ((retro || sweet) && appEl.dataset.wallPhoto !== '1') {
    const skinKey = sweet ? 'sweet-98' : 'retro-pop';
    const bgCol = appEl.dataset.customBg === '1' ? wallState.color : (sweet ? '#82a3c6' : '#1d7e75');
    const gridCol = appEl.dataset.customBg === '1' && typeof getRetroGridColor === 'function'
      ? getRetroGridColor(bgCol, skinKey)
      : (sweet ? 'rgba(43,70,139,0.12)' : 'rgba(9,44,41,0.42)');
    const step = sweet ? 24 : 38;
    c.fillStyle = bgCol;
    c.fillRect(0, 0, W, H);
    c.save();
    c.strokeStyle = gridCol;
    c.lineWidth = 1;
    for (let x = 0; x <= W; x += step) {
      c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, H); c.stroke();
    }
    for (let y = 0; y <= H; y += step) {
      c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(W, y + 0.5); c.stroke();
    }
    c.restore();
  } else {
    c.fillStyle = wallState.color;
    c.fillRect(0, 0, W, H);
    if (wallState.tab === 'photo' && wallState.imgEl && wallState.imgEl.complete) {
      const img = wallState.imgEl, iw = img.naturalWidth, ih = img.naturalHeight;
      if (wallState.fit === 'cover') drawImageCover(c, img, iw, ih, 0, 0, W, H);
      else if (wallState.fit === 'contain') drawImageContain(c, img, iw, ih, 0, 0, W, H);
      else if (wallState.fit === '100% 100%') c.drawImage(img, 0, 0, W, H);
      else c.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
    }
  }

  const blurInfo = getBlurredWallpaperCanvas(W, H);

  // 2. Visible windows sorted back-to-front by zIndex (Flash & Fill Light overlays excluded)
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
    if (l.type === 'pb') drawPhotoBoothWindow(c, l.inst, blurInfo);
    else if (l.type === 'settings-running') drawSettingsWindow(c, blurInfo);
    else if (l.type === 'files-running') drawFilesWindow(c, blurInfo);
    else if (l.type === 'shot-running') drawShotWindow(c, blurInfo);
  }

  // 3. Dock (unless hidden by a fullscreen window)
  if (!document.body.classList.contains('has-full')) {
    const dr = dock.getBoundingClientRect();
    if (sweet) {
      rrect(c, dr.left + 4, dr.top + 4, dr.width, dr.height, 3);
      c.fillStyle = 'rgba(46,45,52,0.22)'; c.fill();
      drawWin98Bevel(c, dr.left, dr.top, dr.width, dr.height, 3, '#e4ded3', false);
    } else if (retro) {
      drawRetroStackShadow(c, dr.left, dr.top, dr.width, dr.height, 16);
      rrect(c, dr.left, dr.top, dr.width, dr.height, 16);
      c.fillStyle = '#faf7ec';
      c.fill();
      c.strokeStyle = '#18181b';
      c.lineWidth = 2;
      c.stroke();
    } else {
      drawOuterShadow(c, dr.left, dr.top, dr.width, dr.height, 20, 'rgba(0,0,0,0.20)', 28, 10);
      drawFrostedSurface(c, dr.left, dr.top, dr.width, dr.height, 20, 'rgba(235, 236, 240, 0.54)', blurInfo);

      c.save();
      rrect(c, dr.left + 0.5, dr.top + 0.5, dr.width - 1, dr.height - 1, 20);
      c.strokeStyle = 'rgba(0,0,0,0.09)';
      c.lineWidth = 1;
      c.stroke();
      c.beginPath();
      c.moveTo(dr.left + 20, dr.top + 1);
      c.lineTo(dr.right - 20, dr.top + 1);
      c.strokeStyle = 'rgba(255,255,255,0.88)';
      c.stroke();
      c.restore();
    }

    const icons = [
      { btn: dockApp, dot: dock.classList.contains('pb-running') },
      { btn: dockFiles, dot: dock.classList.contains('files-running') },
      { btn: dockSettings, dot: dock.classList.contains('settings-running') },
      { btn: dockShot, dot: dock.classList.contains('shot-running') },
    ];
    for (const item of icons) {
      const ir = item.btn.getBoundingClientRect();
      const iconCls = sweet ? '.dock-icon-sweet98' : (retro ? '.dock-icon-retro' : '.dock-icon-mac');
      const svgEl = item.btn.querySelector(iconCls) || item.btn.querySelector('svg');
      const svgImg = svgEl ? svgCache.get(svgEl.outerHTML) : null;
      if (svgImg) {
        c.save();
        if (!retro && !sweet) {
          c.shadowColor = 'rgba(0,0,0,0.24)';
          c.shadowBlur = 7;
          c.shadowOffsetY = 3;
        }
        c.drawImage(svgImg, ir.left, ir.top, ir.width, ir.height);
        c.restore();
      }
      if (item.dot) {
        c.beginPath();
        c.arc(ir.left + ir.width / 2, ir.bottom + (retro || sweet ? 5 : 4), (retro || sweet) ? 3 : 2, 0, Math.PI * 2);
        c.fillStyle = sweet ? '#e89ab0' : (retro ? '#ec5eb0' : 'rgba(0,0,0,0.68)');
        c.fill();
        if (retro || sweet) {
          c.strokeStyle = '#2e2d34';
          c.lineWidth = 1.2;
          c.stroke();
        }
      }
    }

    if (!dockDivider.hidden) {
      const divR = dockDivider.getBoundingClientRect();
      c.fillStyle = sweet ? '#8f8980' : (retro ? '#18181b' : 'rgba(0,0,0,0.16)');
      c.fillRect(divR.left, divR.top, (retro || sweet) ? 2 : 1, divR.height);
      dockMin.querySelectorAll('.dock-min-item').forEach((m) => {
        const mr = m.getBoundingClientRect();
        const mRad = sweet ? 3 : 7;
        c.save();
        if (retro || sweet) {
          rrect(c, mr.left + 2, mr.top + 2, mr.width, mr.height, mRad);
          c.fillStyle = sweet ? 'rgba(46,45,52,0.22)' : '#18181b'; c.fill();
        } else {
          c.shadowColor = 'rgba(0,0,0,0.22)';
          c.shadowBlur = 8;
          c.shadowOffsetY = 3;
        }
        rrect(c, mr.left, mr.top, mr.width, mr.height, mRad);
        c.fillStyle = m.style.background || '#333';
        c.fill();
        c.restore();
        const img = m.querySelector('img');
        if (img && img.complete && img.naturalWidth) {
          c.save(); rrect(c, mr.left, mr.top, mr.width, mr.height, mRad); c.clip();
          drawImageCover(c, img, img.naturalWidth, img.naturalHeight, mr.left, mr.top, mr.width, mr.height);
          c.restore();
        }
        rrect(c, mr.left + ((retro || sweet) ? 0 : 0.5), mr.top + ((retro || sweet) ? 0 : 0.5), mr.width - ((retro || sweet) ? 0 : 1), mr.height - ((retro || sweet) ? 0 : 1), mRad);
        c.strokeStyle = (retro || sweet) ? '#2e2d34' : 'rgba(255,255,255,0.35)';
        c.lineWidth = (retro || sweet) ? 1.5 : 1;
        c.stroke();
      });
    }
  }

  // 4. Active modals, popovers & overlays (Quick Look, QR Modal, Welcome Modal, Share Menu, Notices)
  drawQuickLookOverlay(c, W, H, blurInfo);
  drawQrModalOverlay(c, W, H, blurInfo);
  drawWelcomeModalOverlay(c, W, H, blurInfo);
  drawShareMenuOverlay(c, blurInfo);
  drawShotToastOverlay(c);
  const dn = $('#desktopNotice');
  if (dn && !dn.hidden && dn.textContent) {
    const dr = dn.getBoundingClientRect();
    if (dr.width) {
      c.save();
      if (retro || sweet) {
        rrect(c, dr.left + 4, dr.top + 4, dr.width, dr.height, sweet ? 3 : dr.height / 2);
        c.fillStyle = sweet ? 'rgba(46,45,52,0.22)' : '#ec5eb0'; c.fill();
        c.strokeStyle = sweet ? '#2e2d34' : '#18181b'; c.lineWidth = sweet ? 1.5 : 2; c.stroke();
      } else {
        c.shadowColor = 'rgba(0,0,0,0.38)';
        c.shadowBlur = 18;
        c.shadowOffsetY = 6;
      }
      if (sweet) {
        drawWin98Bevel(c, dr.left, dr.top, dr.width, dr.height, 3, '#e4ded3', false);
      } else {
        rrect(c, dr.left, dr.top, dr.width, dr.height, dr.height / 2);
        c.fillStyle = retro ? '#faf7ec' : (shotIsLight() ? 'rgba(248,249,252,0.92)' : 'rgba(24,25,30,0.82)');
        c.fill();
        c.strokeStyle = retro ? '#18181b' : (shotIsLight() ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.18)');
        c.lineWidth = retro ? 2 : 1;
        c.stroke();
      }
      c.restore();
      c.font = `${sweet ? '700' : (retro ? '700' : '600')} 12px ${sweet ? '"JetBrains Mono", ui-monospace, Menlo, monospace' : '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'}`;
      c.fillStyle = sweet ? '#2e2d34' : (retro || shotIsLight() ? '#18181b' : 'rgba(255,255,255,0.95)');
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(dn.textContent, dr.left + dr.width / 2, dr.top + dr.height / 2);
    }
  }
}

async function takeDesktopScreenshot(ctl) {
  await ensureDockSvgsCached();
  const W = innerWidth, H = innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const out = document.createElement('canvas');
  out.width = Math.round(W * dpr);
  out.height = Math.round(H * dpr);
  const c = out.getContext('2d');
  c.scale(dpr, dpr);

  // Flash illuminates face in webcam BEFORE composition capture without appearing in `out`
  if (shotState.flashOn) {
    await triggerPreFlash(ctl);
    for (const w of windows) {
      if (!w.minimized && !w.closing && w.view === 'live' && video.videoWidth && video.videoHeight) {
        uploadFrame();
        w.renderScene(w.ctx, video.videoWidth, video.videoHeight);
      }
    }
    drawDesktopComposition(c, W, H);
    endPreFlash();
  } else {
    drawDesktopComposition(c, W, H);
    flashBlink();
  }

  try {
    const now = Date.now();
    const framed = createWatermarkedCanvas(out, { tag: 'SCREENSHOT', timestamp: now });
    const blob = await toBlob(framed, 'image/png', 1);
    if (!blob) return;
    const baseName = `Rupa Booth Desktop ${stamp(now)}`;
    const thumb = await makeThumb(framed);
    const saved = await addItem({ type: 'screenshot', blob, thumb, mime: 'image/png', createdAt: now, name: baseName });
    showShotToast(saved, blob);
  } catch (err) {
    console.error('Screenshot export failed:', err);
  }
}

const SB_ICO_GLYPH = {
  'sb-layout': 'grid',
  'sb-theme': 'about',
  'sb-wall': 'wall',
  'sb-flash': 'flash',
  'sb-timer': 'timer',
  'sb-perm': 'lock',
  'sb-about': 'about',
  'sb-reset': 'reset',
  'sb-all': 'all',
  'sb-photo': 'wall',
  'sb-video': 'video',
  'sb-shot': 'shot',
};

function drawSidebarItems(c, winEl, sel) {
  const pal = shotPalette();
  const retro = pal.retro;
  const sweet = pal.sweet;
  winEl.querySelectorAll(sel).forEach((btn) => {
    if (btn.hidden) return;
    const r = btn.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const active = btn.classList.contains('active');
    if (active) {
      if (sweet) {
        drawWin98Bevel(c, r.left, r.top, r.width, r.height, 2, '#f2c2cf', false);
      } else {
        if (retro) {
          rrect(c, r.left + 2, r.top + 2, r.width, r.height, 9);
          c.fillStyle = '#ec5eb0'; c.fill();
        }
        rrect(c, r.left, r.top, r.width, r.height, 9);
        c.fillStyle = retro ? '#f2da5e' : pal.accent;
        c.fill();
        if (retro) { c.strokeStyle = '#18181b'; c.lineWidth = 1.5; c.stroke(); }
      }
    }
    const icoEl = btn.querySelector('.sb-ico');
    if (icoEl) {
      const ir = icoEl.getBoundingClientRect();
      const bgKey = [...icoEl.classList].find((k) => SB_ICO_BG[k]);
      rrect(c, ir.left, ir.top, ir.width, ir.height, sweet ? 3 : 6);
      c.fillStyle = (bgKey && SB_ICO_BG[bgKey]) || '#6366f1';
      c.fill();
      if (retro || sweet) { c.strokeStyle = '#2e2d34'; c.lineWidth = sweet ? 1 : 1.5; c.stroke(); }
      const glyph = (bgKey && SB_ICO_GLYPH[bgKey]) || 'about';
      drawGlyph(c, glyph, ir.left + ir.width / 2, ir.top + ir.height / 2, 12.5, '#fff');
    }
    const label = btn.querySelector('span')?.textContent?.trim() || btn.textContent.trim();
    c.font = `${(retro || sweet) && active ? '700' : '500'} 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
    c.fillStyle = active ? ((retro || sweet) ? '#2e2d34' : '#fff') : pal.text2;
    c.textAlign = 'left';
    c.textBaseline = 'middle';
    c.fillText(label, r.left + (icoEl ? 38 : 14), r.top + r.height / 2);

    const badge = btn.querySelector('em');
    if (badge && badge.textContent) {
      const br = badge.getBoundingClientRect();
      if (br.width) {
        rrect(c, br.left, br.top, br.width, br.height, sweet ? 2 : br.height / 2);
        c.fillStyle = sweet ? '#faf6ec' : (retro ? '#ec5eb0' : (active ? 'rgba(255,255,255,0.24)' : pal.ctlBg));
        c.fill();
        if (retro || sweet) { c.strokeStyle = '#2e2d34'; c.lineWidth = 1.1; c.stroke(); }
        c.font = '700 11px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = sweet ? '#2e2d34' : (active || retro ? '#fff' : pal.text2);
        c.textAlign = 'center';
        c.fillText(badge.textContent, br.left + br.width / 2, br.top + br.height / 2);
      }
    }
  });
}

function drawMacSwitch(c, swEl) {
  if (!swEl) return;
  const r = swEl.getBoundingClientRect();
  if (!r.width) return;
  const pal = shotPalette();
  const on = swEl.getAttribute('aria-checked') === 'true';
  if (pal.sweet) {
    drawWin98Bevel(c, r.left, r.top, r.width, r.height, 2, on ? '#e89ab0' : '#d6cfc3', true);
    const kw = Math.min(18, r.width * 0.45), kh = r.height - 4;
    const kx = on ? r.right - kw - 2 : r.left + 2;
    drawWin98Bevel(c, kx, r.top + 2, kw, kh, 2, '#e4ded3', false);
    return;
  }
  rrect(c, r.left, r.top, r.width, r.height, r.height / 2);
  c.fillStyle = on ? (pal.retro ? '#ec5eb0' : '#30d158') : (pal.retro ? '#e9e4ce' : pal.ctlBg);
  c.fill();
  if (pal.retro || !on) {
    c.strokeStyle = pal.retro ? '#18181b' : pal.cardBorder;
    c.lineWidth = pal.retro ? 2 : 1;
    c.stroke();
  }
  const knobR = (r.height - 6) / 2;
  const kx = on ? r.right - knobR - 3 : r.left + knobR + 3;
  c.beginPath();
  c.arc(kx, r.top + r.height / 2, knobR, 0, Math.PI * 2);
  c.fillStyle = '#fff';
  c.fill();
  if (pal.retro) { c.strokeStyle = '#18181b'; c.lineWidth = 1.5; c.stroke(); }
}

function drawSegControl(c, segEl) {
  if (!segEl) return;
  const sr = segEl.getBoundingClientRect();
  if (!sr.width || !sr.height) return;
  const pal = shotPalette();
  drawThemedBox(c, pal, sr.left, sr.top, sr.width, sr.height, {
    r: 8, sweetR: 2, sweetFill: pal.segBg, inset: true, fill: pal.segBg, stroke: '#18181b', lineWidth: 2,
  });
  segEl.querySelectorAll('button').forEach((b) => {
    const br = b.getBoundingClientRect();
    if (!br.width) return;
    const act = b.classList.contains('active');
    if (act) {
      if (pal.sweet) {
        drawWin98Bevel(c, br.left, br.top, br.width, br.height, 2, pal.segActive, false);
      } else {
        rrect(c, br.left, br.top, br.width, br.height, 6);
        c.fillStyle = pal.segActive;
        c.fill();
        if (pal.retro) { c.strokeStyle = '#18181b'; c.lineWidth = 1.5; c.stroke(); }
      }
    }
    c.font = `${act ? 600 : 500} 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
    c.fillStyle = act ? pal.text1 : pal.text2;
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(b.textContent.trim(), br.left + br.width / 2, br.top + br.height / 2, br.width - 8);
  });
}

function drawMacRangeRow(c, rngEl, outEl) {
  if (!rngEl) return;
  const rr = rngEl.getBoundingClientRect();
  if (!rr.width) return;
  const pal = shotPalette();
  const min = Number(rngEl.min || 0), max = Number(rngEl.max || 100), val = Number(rngEl.value || 0);
  const ratio = max > min ? Math.max(0, Math.min(1, (val - min) / (max - min))) : 0;
  const cy = rr.top + rr.height / 2;
  rrect(c, rr.left, cy - 2, rr.width, 4, 2);
  c.fillStyle = pal.ctlBg;
  c.fill();
  const fw = Math.max(4, rr.width * ratio);
  rrect(c, rr.left, cy - 2, fw, 4, 2);
  c.fillStyle = pal.accent;
  c.fill();
  c.beginPath();
  c.arc(rr.left + rr.width * ratio, cy, 6.5, 0, Math.PI * 2);
  c.fillStyle = '#fff';
  c.fill();
  c.strokeStyle = pal.retro ? '#18181b' : pal.cardBorder;
  c.lineWidth = pal.retro ? 1.5 : 1;
  c.stroke();
  if (outEl && outEl.textContent) {
    const or = outEl.getBoundingClientRect();
    if (or.width) {
      c.font = '500 12px "JetBrains Mono", ui-monospace, Menlo, monospace';
      c.fillStyle = pal.text2;
      c.textAlign = 'right'; c.textBaseline = 'middle';
      c.fillText(outEl.textContent.trim(), or.right, or.top + or.height / 2);
    }
  }
}

function drawWrappedText(c, text, x, y, maxWidth, lineHeight, align = 'left') {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  if (!words.length || maxWidth <= 0) return;
  const lines = [];
  let cur = words[0];
  for (let i = 1; i < words.length; i++) {
    const cand = cur + ' ' + words[i];
    if (c.measureText(cand).width <= maxWidth) cur = cand;
    else { lines.push(cur); cur = words[i]; }
  }
  lines.push(cur);
  c.textAlign = align === 'center' ? 'center' : 'left';
  c.textBaseline = 'top';
  const tx = align === 'center' ? x + maxWidth / 2 : x;
  lines.forEach((ln, idx) => c.fillText(ln, tx, y + idx * lineHeight));
}

function drawSettingsMacGroups(c, paneEl) {
  if (!paneEl) return;
  const pal = shotPalette();
  const retro = pal.retro;
  const paneRect = paneEl.getBoundingClientRect();
  c.save();
  if (paneRect.width && paneRect.height) {
    c.beginPath();
    c.rect(paneRect.left, paneRect.top, paneRect.width, paneRect.height);
    c.clip();
  }
  paneEl.querySelectorAll('.mac-group-label').forEach((gl) => {
    const gr = gl.getBoundingClientRect();
    if (!gr.width || !gr.height) return;
    c.font = '700 11px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    c.fillStyle = retro ? 'rgba(24,24,27,0.78)' : pal.text3;
    c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(gl.textContent.trim().toUpperCase(), gr.left, gr.top + gr.height / 2);
  });
  paneEl.querySelectorAll('.mac-group:not(.wall-head-bar):not(.wall-sliders):not(.flash-preview):not(.reset-hero)').forEach((grp) => {
    const gr = grp.getBoundingClientRect();
    if (!gr.width || !gr.height) return;
    drawThemedBox(c, pal, gr.left, gr.top, gr.width, gr.height, {
      r: 12, sweetR: 3, sweetFill: '#faf6ec', inset: true, retroOffset: 3, retroShadow: '#f2da5e', retroShadowStroke: true,
    });
    grp.querySelectorAll('.mac-row:not([hidden])').forEach((row, idx) => {
      const rr = row.getBoundingClientRect();
      if (!rr.height) return;
      if (idx > 0) {
        c.strokeStyle = pal.rowSep;
        c.lineWidth = 1;
        c.beginPath(); c.moveTo(rr.left + 14, rr.top); c.lineTo(rr.right - 14, rr.top); c.stroke();
      }
      const span = row.querySelector(':scope > span');
      if (span) {
        c.font = '500 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = pal.text1;
        c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(span.textContent.trim(), rr.left + 14, rr.top + rr.height / 2);
      }
      const muted = row.querySelector(':scope > .muted-val');
      if (muted && muted.textContent) {
        const mr = muted.getBoundingClientRect();
        c.font = '400 12.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = pal.text3;
        c.textAlign = 'right'; c.textBaseline = 'middle';
        c.fillText(muted.textContent.trim(), mr.right, mr.top + mr.height / 2, mr.width);
      }
      const sw = row.querySelector('.mac-switch');
      if (sw) drawMacSwitch(c, sw);
      const swRow = row.querySelector('.accent-swatches');
      if (swRow) {
        swRow.querySelectorAll('.accent-dot').forEach((dot) => {
          const dr = dot.getBoundingClientRect();
          if (!dr.width) return;
          const cx = dr.left + dr.width / 2, cy = dr.top + dr.height / 2, rad = dr.width / 2;
          const active = dot.classList.contains('active');
          if (pal.sweet) {
            if (active) {
              rrect(c, dr.left - 3, dr.top - 3, dr.width + 6, dr.height + 6, 3);
              c.strokeStyle = '#2e2d34'; c.lineWidth = 2; c.stroke();
            }
            drawWin98Bevel(c, dr.left, dr.top, dr.width, dr.height, 2, dot.style.background || pal.accent, false);
            if (active) {
              c.beginPath(); c.arc(cx, cy, 3, 0, Math.PI * 2); c.fillStyle = '#fff'; c.fill();
            }
            return;
          }
          if (active) {
            c.beginPath();
            c.arc(cx, cy, rad + 3, 0, Math.PI * 2);
            c.strokeStyle = pal.text1;
            c.lineWidth = 2;
            c.stroke();
          }
          c.beginPath();
          c.arc(cx, cy, rad, 0, Math.PI * 2);
          c.fillStyle = dot.style.background || pal.accent;
          c.fill();
          c.strokeStyle = retro ? '#18181b' : (pal.light ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.45)');
          c.lineWidth = retro ? 2 : 1.5;
          c.stroke();
          if (active) {
            c.beginPath();
            c.arc(cx, cy, 3.2, 0, Math.PI * 2);
            c.fillStyle = '#fff';
            c.fill();
          }
        });
      }
      const ig = row.querySelector('.ig-btn');
      if (ig) {
        const ir = ig.getBoundingClientRect();
        if (ir.width) {
          const g = c.createLinearGradient(ir.left, ir.top, ir.right, ir.bottom);
          g.addColorStop(0, '#f58529'); g.addColorStop(0.55, '#dd2a7b'); g.addColorStop(1, '#8134af');
          rrect(c, ir.left, ir.top, ir.width, ir.height, 8);
          c.fillStyle = g;
          c.fill();
          drawGlyph(c, 'ig', ir.left + 14, ir.top + ir.height / 2, 13, '#fff');
          const txt = ig.querySelector('span')?.textContent?.trim();
          if (txt) {
            c.font = '600 12.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
            c.fillStyle = '#fff';
            c.textAlign = 'left'; c.textBaseline = 'middle';
            c.fillText(txt, ir.left + 25, ir.top + ir.height / 2);
          }
        }
      }
      const seg = row.querySelector('.seg-ctrl');
      if (seg) drawSegControl(c, seg);
      const fcWrap = row.querySelector('.flash-colors');
      if (fcWrap) {
        fcWrap.querySelectorAll('.flash-swatch').forEach((swEl) => {
          const swr = swEl.getBoundingClientRect();
          if (!swr.width) return;
          c.beginPath();
          c.arc(swr.left + swr.width / 2, swr.top + swr.height / 2, swr.width / 2, 0, Math.PI * 2);
          c.fillStyle = swEl.style.backgroundColor || swEl.dataset.color || '#fff';
          c.fill();
          c.strokeStyle = swEl.classList.contains('active') ? pal.accent : pal.cardBorder;
          c.lineWidth = swEl.classList.contains('active') ? 2.5 : 1.5;
          c.stroke();
        });
        const customSw = fcWrap.querySelector('.fc-swatch');
        if (customSw) {
          const swr = customSw.getBoundingClientRect();
          if (swr.width) {
            c.beginPath();
            c.arc(swr.left + swr.width / 2, swr.top + swr.height / 2, swr.width / 2, 0, Math.PI * 2);
            c.fillStyle = getComputedStyle(customSw).backgroundColor || '#ff5f57';
            c.fill();
            c.strokeStyle = fcWrap.querySelector('.flash-custom-pick')?.classList.contains('active') ? pal.accent : pal.cardBorder;
            c.lineWidth = 1.5;
            c.stroke();
          }
        }
      }
      const pillBtn = row.querySelector('.mac-pill-btn');
      if (pillBtn) {
        const pr = pillBtn.getBoundingClientRect();
        if (pr.width) {
          const isPrimary = pillBtn.classList.contains('primary');
          const isDanger = pillBtn.classList.contains('danger');
          drawThemedBox(c, pal, pr.left, pr.top, pr.width, pr.height, {
            r: 7, sweetR: 2, sweetFill: isPrimary ? '#2b468b' : (isDanger ? '#f8d4de' : '#e4ded3'), retroOffset: 2,
            fill: isPrimary ? pal.accent : (isDanger && retro ? '#ffe5e5' : pal.pillBg), stroke: '#18181b', lineWidth: 2,
          });
          c.font = '600 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = isPrimary ? '#fff' : (isDanger && (retro || pal.sweet) ? '#9c2246' : pal.text1);
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(pillBtn.textContent.trim(), pr.left + pr.width / 2, pr.top + pr.height / 2);
        }
      }
      const permPill = row.querySelector('.perm-pill');
      if (permPill) {
        const pr = permPill.getBoundingClientRect();
        if (pr.width) {
          const st = permPill.dataset.state;
          rrect(c, pr.left, pr.top, pr.width, pr.height, pal.sweet ? 2 : pr.height / 2);
          c.fillStyle = st === 'granted' ? 'rgba(48,209,88,0.18)' : (st === 'denied' ? 'rgba(255,69,58,0.18)' : pal.ctlBg);
          c.fill();
          if (retro || pal.sweet || pal.light) {
            c.strokeStyle = (retro || pal.sweet) ? '#2e2d34' : pal.cardBorder;
            c.lineWidth = 1; c.stroke();
          }
          c.font = '600 11px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = st === 'granted' ? (pal.light ? '#1f9d45' : '#5ef278') : (st === 'denied' ? (pal.light ? '#e12d24' : '#ff7b72') : pal.text2);
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(permPill.textContent.trim(), pr.left + pr.width / 2, pr.top + pr.height / 2);
        }
      }
      const rng = row.querySelector('.rng');
      if (rng) drawMacRangeRow(c, rng, row.querySelector('output'));
      const numField = row.querySelector('.timer-num-field');
      if (numField) {
        const nr = numField.getBoundingClientRect();
        if (nr.width) {
          drawThemedBox(c, pal, nr.left, nr.top, nr.width, nr.height, {
            r: 7, sweetR: 2, sweetFill: '#faf6ec', inset: true, fill: retro ? '#fffdf5' : pal.ctlBg, stroke: '#18181b', lineWidth: 2,
          });
          const numVal = numField.querySelector('input')?.value || '';
          c.font = '600 12.5px "Inter", sans-serif';
          c.fillStyle = pal.text1;
          c.textAlign = 'right'; c.textBaseline = 'middle';
          c.fillText(`${numVal}s`, nr.right - 8, nr.top + nr.height / 2);
        }
      }
    });
  });

  const note = paneEl.querySelector('.mac-foot-note');
  if (note && note.textContent) {
    const nr = note.getBoundingClientRect();
    if (nr.width && nr.height) {
      const ta = getComputedStyle(note).textAlign;
      c.font = '400 11.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text3;
      drawWrappedText(c, note.textContent.trim(), nr.left, nr.top, nr.width, 15.5, ta === 'center' ? 'center' : 'left');
    }
  }
  c.restore();
}

function drawSettingsWindow(c, blurInfo = null) {
  drawMacSplitFrame(c, settingsWin, $('#settingsPaneTitle')?.textContent || 'Settings', blurInfo);
  c.save();
  drawSidebarItems(c, settingsWin, '.sb-nav-btn');

  const pal = shotPalette();
  const utilBody = settingsWin.querySelector('.util-body')?.getBoundingClientRect();
  if (utilBody && utilBody.width && utilBody.height) {
    c.beginPath();
    c.rect(utilBody.left, utilBody.top, utilBody.width, utilBody.height);
    c.clip();
  }
  const activePane = settingsWin.querySelector('.set-pane:not([hidden])');
  if (settingsState.sec === 'layout') {
    layoutGridEl.querySelectorAll('.layout-card').forEach((card) => {
      const cr = card.getBoundingClientRect();
      const act = card.classList.contains('active');
      drawThemedBox(c, pal, cr.left, cr.top, cr.width, cr.height, {
        r: 12, sweetR: 3, sweetFill: act ? '#f2c2cf' : '#faf6ec', inset: pal.sweet && act,
        retroOffset: 3, retroShadow: act ? '#ec5eb0' : '#18181b',
        fill: pal.retro ? (act ? '#f2da5e' : '#fffdf5') : (act ? 'rgba(10,132,255,0.18)' : pal.cardBg),
        stroke: pal.retro ? '#18181b' : (act ? pal.accent : pal.cardBorder), lineWidth: pal.retro ? 2 : 1.5,
      });
      const pv = card.querySelector('.layout-preview').getBoundingClientRect();
      rrect(c, pv.left, pv.top, pv.width, pv.height, pal.sweet ? 2 : 8);
      c.fillStyle = 'rgba(14,15,20,0.85)'; c.fill();
      card.querySelectorAll('.lp-win').forEach((box) => {
        const br = box.getBoundingClientRect();
        rrect(c, br.left, br.top, br.width, br.height, pal.sweet ? 2 : 3.5);
        c.fillStyle = box.classList.contains('front') ? pal.accent : 'rgba(255,255,255,0.22)';
        c.fill();
      });
      const lbl = card.querySelector('.layout-label');
      if (lbl) {
        const lr = lbl.getBoundingClientRect();
        c.font = `${pal.sweet && act ? '700' : '600'} 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
        c.fillStyle = pal.text1;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(lbl.textContent, lr.left + lr.width / 2, lr.top + lr.height / 2);
      }
    });
    drawSettingsMacGroups(c, activePane);
  } else if (settingsState.sec === 'theme') {
    const light = pal.light;
    const retro = pal.retro;
    const sweet = pal.sweet;
    const accent = pal.accent;
    const subHead = activePane?.querySelector('.theme-sub-head');
    if (subHead) {
      const sr = subHead.getBoundingClientRect();
      if (sr.width) {
        c.font = '700 11px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = (retro || sweet) ? 'rgba(46,45,52,0.82)' : pal.text3;
        c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(subHead.textContent.trim().toUpperCase(), sr.left, sr.top + sr.height / 2);
      }
    }
    settingsWin.querySelectorAll('.theme-card').forEach((card) => {
      const cr = card.getBoundingClientRect();
      if (!cr.width) return;
      const active = card.classList.contains('active');
      if (sweet) {
        drawWin98Bevel(c, cr.left, cr.top, cr.width, cr.height, 3, active ? '#f2c2cf' : '#faf6ec', active);
      } else {
        if (retro && active) {
          rrect(c, cr.left + 4, cr.top + 4, cr.width, cr.height, 14);
          c.fillStyle = '#ec5eb0'; c.fill();
          c.strokeStyle = '#18181b'; c.lineWidth = 2; c.stroke();
        } else if (retro) {
          rrect(c, cr.left + 3, cr.top + 3, cr.width, cr.height, 14);
          c.fillStyle = '#18181b'; c.fill();
        }
        rrect(c, cr.left, cr.top, cr.width, cr.height, 14);
        if (retro) {
          c.fillStyle = active ? '#f2da5e' : '#fffdf5';
          c.fill();
          c.strokeStyle = '#18181b';
          c.lineWidth = 2; c.stroke();
        } else {
          c.fillStyle = active ? (light ? 'rgba(10,132,255,0.14)' : 'rgba(10,132,255,0.18)') : pal.cardBg;
          c.fill();
          c.strokeStyle = active ? accent : pal.cardBorder;
          c.lineWidth = 1.5; c.stroke();
        }
      }
      const th = card.querySelector('.theme-thumb')?.getBoundingClientRect();
      if (th && th.width) {
        const tmode = card.dataset.tmode;
        rrect(c, th.left, th.top, th.width, th.height, sweet ? 2 : 9);
        if (tmode === 'retro-pop') {
          c.fillStyle = '#1d7e75'; c.fill();
          c.strokeStyle = '#18181b'; c.lineWidth = 1.5; c.stroke();
        } else if (tmode === 'sweet-98') {
          c.fillStyle = '#82a3c6'; c.fill();
          c.strokeStyle = '#2e2d34'; c.lineWidth = 1.2; c.stroke();
        } else if (tmode === 'light') {
          c.fillStyle = '#e8effb'; c.fill();
        } else if (tmode === 'dark') {
          c.fillStyle = '#14161e'; c.fill();
        } else {
          c.save(); c.clip();
          c.fillStyle = '#e8effb'; c.fillRect(th.left, th.top, th.width / 2, th.height);
          c.fillStyle = '#14161e'; c.fillRect(th.left + th.width / 2, th.top, th.width / 2, th.height);
          c.restore();
        }
        const mw = card.querySelector('.theme-mini-win')?.getBoundingClientRect();
        if (mw && mw.width) {
          if (tmode === 'retro-pop') {
            rrect(c, mw.left + 2, mw.top + 2, mw.width, mw.height, 5);
            c.fillStyle = '#ec5eb0'; c.fill();
            c.strokeStyle = '#18181b'; c.lineWidth = 1.2; c.stroke();
            rrect(c, mw.left, mw.top, mw.width, mw.height, 5);
            c.fillStyle = '#faf7ec'; c.fill();
            c.strokeStyle = '#18181b'; c.lineWidth = 1.5; c.stroke();
          } else if (tmode === 'sweet-98') {
            drawWin98Bevel(c, mw.left, mw.top, mw.width, mw.height, 2, '#e4ded3', false);
            c.fillStyle = '#2b468b';
            c.fillRect(mw.left + 1, mw.top + 1, mw.width - 2, Math.max(6, mw.height * 0.25));
          } else {
            rrect(c, mw.left, mw.top, mw.width, mw.height, 5);
            c.fillStyle = tmode === 'dark' ? 'rgba(34,36,44,0.95)' : 'rgba(255,255,255,0.92)';
            c.fill();
          }
          const barDots = card.querySelectorAll('.theme-mini-bar i');
          const dotCols = tmode === 'retro-pop'
            ? ['#e5484d', '#2563eb', '#f2da5e']
            : tmode === 'sweet-98'
              ? ['#e4ded3', '#e4ded3', '#f3cdd8']
              : ['#ff5f57', '#febc2e', '#28c840'];
          barDots.forEach((dot, idx) => {
            const dr = dot.getBoundingClientRect();
            if (!dr.width) return;
            c.beginPath();
            c.arc(dr.left + dr.width / 2, dr.top + dr.height / 2, dr.width / 2, 0, Math.PI * 2);
            c.fillStyle = dotCols[idx] || '#ff5f57';
            c.fill();
          });
          const pill = card.querySelector('.theme-mini-pill')?.getBoundingClientRect();
          if (pill && pill.width) {
            rrect(c, pill.left, pill.top, pill.width, pill.height, tmode === 'sweet-98' ? 2 : pill.height / 2);
            c.fillStyle = tmode === 'retro-pop' ? '#ec5eb0' : (tmode === 'sweet-98' ? '#e89ab0' : accent);
            c.fill();
          }
        }
      }
      if (card.classList.contains('theme-card-custom')) {
        const lblEl = card.querySelector('.theme-card-top span:first-child');
        const badgeEl = card.querySelector('.theme-badge');
        if (lblEl) {
          const lr = lblEl.getBoundingClientRect();
          c.font = `${active ? '600' : '500'} 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
          c.fillStyle = pal.text1;
          c.textAlign = 'left'; c.textBaseline = 'middle';
          c.fillText(lblEl.textContent, lr.left, lr.top + lr.height / 2);
        }
        if (badgeEl) {
          const br = badgeEl.getBoundingClientRect();
          rrect(c, br.left, br.top, br.width, br.height, sweet ? 2 : br.height / 2);
          c.fillStyle = sweet ? '#2b468b' : (retro ? '#ec5eb0' : pal.ctlBg); c.fill();
          if (retro || sweet) { c.strokeStyle = '#2e2d34'; c.lineWidth = 1.1; c.stroke(); }
          c.font = '700 9.5px "Inter", sans-serif';
          c.fillStyle = (retro || sweet) ? '#fff' : pal.accent;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(badgeEl.textContent.toUpperCase(), br.left + br.width / 2, br.top + br.height / 2);
        }
      } else {
        const lbl = card.querySelector('span:last-child')?.textContent || '';
        c.font = `${active ? '600' : '500'} 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif`;
        c.fillStyle = pal.text1;
        c.textAlign = 'center'; c.textBaseline = 'bottom';
        c.fillText(lbl, cr.left + cr.width / 2, cr.bottom - 8);
      }
    });
    const stEl = $('#themeModeStatus');
    if (stEl && stEl.textContent) {
      const sr = stEl.getBoundingClientRect();
      if (sr.width) {
        c.font = '400 11.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = pal.text3;
        c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(stEl.textContent, sr.left, sr.top + sr.height / 2, sr.width);
      }
    }
    drawSettingsMacGroups(c, activePane);
  } else if (settingsState.sec === 'wallpaper') {
    drawWallpaperPane(c);
  } else if (settingsState.sec === 'flash') {
    const pv = $('#flashPreviewBox')?.getBoundingClientRect();
    if (pv && pv.width) {
      rrect(c, pv.left, pv.top, pv.width, pv.height, 12);
      c.fillStyle = '#14151a'; c.fill();
      c.strokeStyle = flashCfg.color; c.lineWidth = 6; c.stroke();
      const lbl = $('#flashPreviewLabel');
      if (lbl) {
        c.font = '600 12px "JetBrains Mono", "JetBrains Mono", ui-monospace, Menlo, monospace';
        c.fillStyle = 'rgba(255,255,255,0.86)';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(lbl.textContent, pv.left + pv.width / 2, pv.top + pv.height / 2);
      }
    }
    drawSettingsMacGroups(c, activePane);
  } else if (settingsState.sec === 'timer') {
    const th = activePane?.querySelector('.timer-hero');
    if (th) {
      const tr = th.getBoundingClientRect();
      if (tr.width) {
        drawThemedBox(c, pal, tr.left, tr.top, tr.width, tr.height, {
          r: 12, sweetR: 3, sweetFill: '#faf6ec', inset: true, retroOffset: 3, retroShadow: '#f2da5e', retroShadowStroke: true,
        });
        const tb = $('#timerBadge')?.getBoundingClientRect();
        if (tb && tb.width) {
          rrect(c, tb.left, tb.top, tb.width, tb.height, pal.sweet ? 2 : 12);
          if (pal.sweet) {
            const tg = c.createLinearGradient(0, tb.top, 0, tb.bottom);
            tg.addColorStop(0, '#e89ab0'); tg.addColorStop(1, '#d16d89');
            c.fillStyle = tg;
          } else {
            c.fillStyle = '#ff9f0a';
          }
          c.fill();
          if (pal.retro || pal.sweet) { c.strokeStyle = '#2e2d34'; c.lineWidth = pal.sweet ? 1.2 : 2; c.stroke(); }
          c.font = '700 18px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = '#fff';
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText($('#timerBadge').textContent.trim(), tb.left + tb.width / 2, tb.top + tb.height / 2);
        }
        const tt = $('#timerSummaryTitle')?.getBoundingClientRect();
        if (tt) {
          c.font = '600 14px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = pal.text1;
          c.textAlign = 'left'; c.textBaseline = 'middle';
          c.fillText($('#timerSummaryTitle').textContent.trim(), tt.left, tt.top + tt.height / 2);
        }
        const td = $('#timerSummaryDesc')?.getBoundingClientRect();
        if (td) {
          c.font = '400 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = pal.text3;
          c.textAlign = 'left'; c.textBaseline = 'middle';
          c.fillText($('#timerSummaryDesc').textContent.trim(), td.left, td.top + td.height / 2, td.width);
        }
      }
    }
    drawSettingsMacGroups(c, activePane);
  } else if (settingsState.sec === 'permissions') {
    drawSettingsMacGroups(c, activePane);
    const pAll = $('#permAllBtn');
    if (pAll && !pAll.hidden) {
      const pr = pAll.getBoundingClientRect();
      if (pr.width) {
        drawThemedBox(c, pal, pr.left, pr.top, pr.width, pr.height, {
          r: 9, sweetR: 2, sweetFill: '#e4ded3', retroOffset: 2, fill: pal.pillBg, stroke: '#18181b', lineWidth: 2,
        });
        c.font = '600 12.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = pal.text1; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(pAll.textContent.trim(), pr.left + pr.width / 2, pr.top + pr.height / 2);
      }
    }
  } else if (settingsState.sec === 'about') {
    const hero = activePane?.querySelector('.about-mac-hero');
    if (hero) {
      const badge = hero.querySelector('.about-logo-badge');
      if (badge) {
        const br = badge.getBoundingClientRect();
        if (!pal.retro && !pal.sweet) drawOuterShadow(c, br.left, br.top, br.width, br.height, 15, 'rgba(0,0,0,0.38)', 22, 8);
        const bg = c.createLinearGradient(0, br.top, 0, br.bottom);
        bg.addColorStop(0, '#ffffff');
        bg.addColorStop(1, '#e6e9f0');
        rrect(c, br.left, br.top, br.width, br.height, pal.sweet ? 3 : 15);
        c.fillStyle = bg;
        c.fill();
        c.strokeStyle = (pal.retro || pal.sweet) ? '#2e2d34' : 'rgba(255,255,255,0.85)';
        c.lineWidth = (pal.retro || pal.sweet) ? 2 : 1;
        c.stroke();
        const pad = 9;
        const availW = Math.max(12, br.width - pad * 2);
        const availH = Math.max(8, br.height - pad * 2);
        if (typeof drawRupaBrandLogo === 'function' && typeof WM_LOGO_AR === 'number') {
          let lw = availW;
          let lh = lw / WM_LOGO_AR;
          if (lh > availH) { lh = availH; lw = lh * WM_LOGO_AR; }
          drawRupaBrandLogo(c, br.left + (br.width - lw) / 2, br.top + br.height / 2, lw, lh);
        } else {
          const img = badge.querySelector('img');
          if (img && img.complete && img.naturalWidth) {
            c.save(); rrect(c, br.left, br.top, br.width, br.height, pal.sweet ? 3 : 15); c.clip();
            drawImageContain(c, img, img.naturalWidth, img.naturalHeight, br.left + pad, br.top + pad, availW, availH);
            c.restore();
          }
        }
      }
      const h4 = hero.querySelector('h4');
      if (h4) {
        const hr = h4.getBoundingClientRect();
        c.font = '700 16px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = pal.text1;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(h4.textContent.trim(), hr.left + hr.width / 2, hr.top + hr.height / 2);
      }
      const p = hero.querySelector('p');
      if (p) {
        const pr = p.getBoundingClientRect();
        c.font = '400 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = pal.text3;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(p.textContent.trim(), pr.left + pr.width / 2, pr.top + pr.height / 2);
      }
    }
    drawSettingsMacGroups(c, activePane);
  } else if (settingsState.sec === 'reset') {
    const rh = activePane?.querySelector('.reset-hero');
    if (rh) {
      const rr = rh.getBoundingClientRect();
      if (rr.width) {
        drawThemedBox(c, pal, rr.left, rr.top, rr.width, rr.height, {
          r: 12, sweetR: 3, sweetFill: '#faf6ec', inset: true,
          fill: pal.retro ? '#fffdf5' : 'rgba(255,69,58,0.1)', stroke: '#18181b', lineWidth: 2,
        });
        const rb = rh.querySelector('.reset-badge')?.getBoundingClientRect();
        if (rb && rb.width) {
          rrect(c, rb.left, rb.top, rb.width, rb.height, pal.sweet ? 2 : 12);
          c.fillStyle = '#ff453a'; c.fill();
          if (pal.retro || pal.sweet) { c.strokeStyle = '#2e2d34'; c.lineWidth = 1.5; c.stroke(); }
          drawGlyph(c, 'reset', rb.left + rb.width / 2, rb.top + rb.height / 2, 20, '#fff');
        }
        const h4 = rh.querySelector('h4');
        if (h4) {
          const hr = h4.getBoundingClientRect();
          c.font = '600 14px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = pal.text1;
          c.textAlign = 'left'; c.textBaseline = 'middle';
          c.fillText(h4.textContent.trim(), hr.left, hr.top + hr.height / 2);
        }
        const p = rh.querySelector('p');
        if (p) {
          const pr = p.getBoundingClientRect();
          c.font = '400 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = pal.text3;
          c.textAlign = 'left'; c.textBaseline = 'middle';
          c.fillText(p.textContent.trim(), pr.left, pr.top + pr.height / 2, pr.width);
        }
      }
    }
    drawSettingsMacGroups(c, activePane);
    const rBtn = $('#resetStartBtn');
    if (rBtn && !rBtn.hidden) {
      const br = rBtn.getBoundingClientRect();
      if (br.width) {
        drawThemedBox(c, pal, br.left, br.top, br.width, br.height, {
          r: 10, sweetR: 2, sweetFill: '#f8d4de', fill: pal.retro ? '#ffe5e5' : 'rgba(255,69,58,0.18)',
          stroke: '#18181b', lineWidth: 2,
        });
        c.font = '600 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = pal.sweet ? '#9c2246' : (pal.light || pal.retro ? '#c81e24' : '#ff6961');
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(rBtn.textContent.trim(), br.left + br.width / 2, br.top + br.height / 2);
      }
    }
    const rBox = $('#resetConfirmBox');
    if (rBox && !rBox.hidden) {
      const rr = rBox.getBoundingClientRect();
      if (rr.width) {
        drawThemedBox(c, pal, rr.left, rr.top, rr.width, rr.height, {
          r: 10, sweetR: 3, sweetFill: '#f8d4de', inset: true,
          fill: pal.retro ? '#ffe5e5' : 'rgba(255,69,58,0.12)', stroke: '#18181b', lineWidth: 2,
        });
        const rSpan = rBox.querySelector(':scope > span');
        if (rSpan) {
          const sr = rSpan.getBoundingClientRect();
          c.font = '600 12.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = pal.text1; c.textAlign = 'left'; c.textBaseline = 'middle';
          c.fillText(rSpan.textContent.trim(), sr.left, sr.top + sr.height / 2, sr.width);
        }
        [
          [$('#resetCancelBtn'), false],
          [$('#resetConfirmBtn'), true],
        ].forEach(([btn, isDanger]) => {
          if (!btn) return;
          const br = btn.getBoundingClientRect();
          if (!br.width) return;
          drawThemedBox(c, pal, br.left, br.top, br.width, br.height, {
            r: 7, sweetR: 2, sweetFill: isDanger ? '#d93848' : '#e4ded3',
            fill: isDanger ? '#ff3b30' : pal.pillBg, stroke: '#18181b', lineWidth: 1.5,
          });
          c.font = '600 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = isDanger ? '#fff' : pal.text1;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(btn.textContent.trim(), br.left + br.width / 2, br.top + br.height / 2);
        });
      }
    }
  } else {
    drawSettingsMacGroups(c, activePane);
  }
  c.restore();
}

function drawWinCloseDot(c, el, pal) {
  if (!el) return;
  const r = el.getBoundingClientRect();
  if (!r.width) return;
  if (pal.sweet) {
    drawWin98Bevel(c, r.left, r.top, r.width, r.height, 2, '#f3cdd8', false);
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    c.strokeStyle = '#2e2d34'; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(cx - 2.6, cy - 2.6); c.lineTo(cx + 2.6, cy + 2.6);
    c.moveTo(cx + 2.6, cy - 2.6); c.lineTo(cx - 2.6, cy + 2.6); c.stroke();
    return;
  }
  c.beginPath();
  c.arc(r.left + r.width / 2, r.top + r.height / 2, r.width / 2, 0, Math.PI * 2);
  c.fillStyle = pal.retro ? '#e5484d' : '#ff5f57';
  c.fill();
  if (pal.retro) { c.strokeStyle = '#18181b'; c.lineWidth = 1.5; c.stroke(); }
}

function drawFilesWindow(c, blurInfo = null) {
  drawMacSplitFrame(c, filesWin, $('#filesPaneTitle')?.textContent || 'Files', blurInfo);
  c.save();
  drawSidebarItems(c, filesWin, '.ftab');

  const pal = shotPalette();
  const retro = pal.retro;
  const sweet = pal.sweet;

  if (filesSelectBtn && !filesSelectBtn.hidden) {
    const vSeg = $('#filesViewSeg');
    if (vSeg && !vSeg.hidden) {
      const vr = vSeg.getBoundingClientRect();
      if (vr.width) {
        drawThemedBox(c, pal, vr.left, vr.top, vr.width, vr.height, {
          r: 7, sweetR: 3, sweetFill: pal.segBg, inset: true, fill: pal.segBg, stroke: '#18181b', lineWidth: 2,
        });
        vSeg.querySelectorAll('.fview-btn').forEach((btn) => {
          const ar = btn.getBoundingClientRect();
          if (!ar.width) return;
          const act = btn.classList.contains('active');
          if (act) {
            if (sweet) {
              drawWin98Bevel(c, ar.left, ar.top, ar.width, ar.height, 2, pal.segActive, false);
            } else {
              rrect(c, ar.left, ar.top, ar.width, ar.height, 5);
              c.fillStyle = pal.segActive;
              c.fill();
              if (retro) { c.strokeStyle = '#18181b'; c.lineWidth = 1.5; c.stroke(); }
            }
          }
          drawGlyph(
            c,
            btn.dataset.fview === 'list' ? 'list' : 'grid',
            ar.left + ar.width / 2,
            ar.top + ar.height / 2,
            13,
            act ? pal.text1 : pal.text2
          );
        });
      }
    }
    const sr = filesSelectBtn.getBoundingClientRect();
    if (sr.width) {
      drawThemedBox(c, pal, sr.left, sr.top, sr.width, sr.height, {
        r: 6.5, sweetR: 2, sweetFill: filesState.selecting ? '#f2c2cf' : '#e4ded3',
        fill: filesState.selecting ? (retro ? '#f2da5e' : pal.accent) : pal.pillBg,
        stroke: '#18181b', lineWidth: 2,
      });
      c.font = '600 11.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = filesState.selecting && !retro && !sweet ? '#fff' : pal.text1;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(filesState.selecting ? 'Done' : 'Select', sr.left + sr.width / 2, sr.top + sr.height / 2);
    }
  }

  if (filesPreviewEl && !filesPreviewEl.hidden) {
    const pr = filesPreviewEl.getBoundingClientRect();
    if (retro) drawRetroStackShadow(c, pr.left, pr.top, pr.width, pr.height, 14);
    else if (sweet) {
      rrect(c, pr.left + 4, pr.top + 4, pr.width, pr.height, 3);
      c.fillStyle = 'rgba(46,45,52,0.22)'; c.fill();
    }
    drawThemedBox(c, pal, pr.left, pr.top, pr.width, pr.height, {
      r: 14, sweetR: 3, sweetFill: '#e4ded3',
      fill: retro ? '#faf7ec' : (pal.light ? '#f8f9fc' : 'rgba(22,23,28,0.96)'),
      stroke: retro ? '#18181b' : pal.cardBorder, lineWidth: retro ? 2 : 1,
    });

    const meta = $('#fpMeta');
    if (meta && meta.textContent) {
      const mr = meta.getBoundingClientRect();
      c.font = '500 12.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text1;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(meta.textContent, mr.left + mr.width / 2, mr.top + mr.height / 2);
    }
    [
      [fpBackBtn, 'back', pal.text1, false],
      [fpMoreBtn, 'more', pal.text1, false],
      [fpDelBtn, 'trash', pal.light || retro || sweet ? '#c81e24' : '#ff9a92', true],
    ].forEach(([btn, glyph, col, isDel]) => {
      if (!btn || btn.hidden) return;
      const br = btn.getBoundingClientRect();
      if (!br.width) return;
      drawThemedBox(c, pal, br.left, br.top, br.width, br.height, {
        r: 7, sweetR: 2, sweetFill: isDel ? '#f8d4de' : '#e4ded3', fill: pal.pillBg,
        stroke: retro ? '#18181b' : pal.cardBorder, lineWidth: retro ? 2 : 1,
      });
      drawGlyph(c, glyph, br.left + br.width / 2, br.top + br.height / 2, 14, col);
    });

    const mediaBox = filesPreviewEl.querySelector('.fp-media');
    if (mediaBox) {
      const mr = mediaBox.getBoundingClientRect();
      const mRad = sweet ? 2 : 9;
      c.save();
      rrect(c, mr.left, mr.top, mr.width, mr.height, mRad);
      c.clip();
      c.fillStyle = '#000';
      c.fillRect(mr.left, mr.top, mr.width, mr.height);
      if (fpImgEl && !fpImgEl.hidden && fpImgEl.naturalWidth) {
        drawImageContain(c, fpImgEl, fpImgEl.naturalWidth, fpImgEl.naturalHeight, mr.left, mr.top, mr.width, mr.height);
      } else if (fpVideoEl && !fpVideoEl.hidden && fpVideoEl.videoWidth) {
        drawImageContain(c, fpVideoEl, fpVideoEl.videoWidth, fpVideoEl.videoHeight, mr.left, mr.top, mr.width, mr.height);
      }
      if (fpVideoEl && !fpVideoEl.hidden) drawUvpBar(c, mediaBox);
      if (fpFullBtn && !fpFullBtn.hidden) {
        const fr = fpFullBtn.getBoundingClientRect();
        if (fr.width) {
          rrect(c, fr.left, fr.top, fr.width, fr.height, sweet ? 2 : 8);
          c.fillStyle = 'rgba(24,25,31,0.78)';
          c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.18)';
          c.lineWidth = 1;
          c.stroke();
          drawGlyph(c, 'full', fr.left + fr.width / 2, fr.top + fr.height / 2, 14, '#fff');
        }
      }
      c.restore();
      if (retro || sweet) {
        rrect(c, mr.left, mr.top, mr.width, mr.height, mRad);
        c.strokeStyle = sweet ? '#2e2d34' : '#18181b'; c.lineWidth = sweet ? 1.5 : 2; c.stroke();
      }
    }

    const moreMenu = $('#fpMoreMenu');
    if (moreMenu && !moreMenu.hidden) {
      const mmr = moreMenu.getBoundingClientRect();
      if (mmr.width) {
        drawThemedBox(c, pal, mmr.left, mmr.top, mmr.width, mmr.height, {
          r: 12, sweetR: 3, sweetFill: '#e4ded3', shadow: 4, retroOffset: 4,
          fill: retro ? '#faf7ec' : (pal.light ? 'rgba(255,255,255,0.96)' : 'rgba(30,32,38,0.96)'),
        });
        const mGlyphs = { fpQr: 'qr', fpShare: 'share', fpDl: 'download', fpWall: 'wall' };
        moreMenu.querySelectorAll('.fp-menu-item').forEach((mi) => {
          if (mi.hidden) return;
          const mir = mi.getBoundingClientRect();
          if (!mir.width) return;
          drawGlyph(c, mGlyphs[mi.id] || 'more', mir.left + 18, mir.top + mir.height / 2, 14, pal.text1);
          const lbl = mi.querySelector('span')?.textContent?.trim() || mi.textContent.trim();
          c.font = '500 12.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = pal.text1; c.textAlign = 'left'; c.textBaseline = 'middle';
          c.fillText(lbl, mir.left + 32, mir.top + mir.height / 2, mir.width - 40);
        });
      }
    }
  } else {
    const selBar = $('#filesSelBar');
    if (selBar && !selBar.hidden) {
      const sbr = selBar.getBoundingClientRect();
      if (sbr.width) {
        drawThemedBox(c, pal, sbr.left, sbr.top, sbr.width, sbr.height, {
          r: 10, sweetR: 2, sweetFill: '#f2c2cf',
          fill: retro ? '#f2da5e' : pal.cardBg, stroke: '#18181b', lineWidth: 2,
        });
        const cntEl = $('#filesSelCountNum');
        if (cntEl) {
          const cr = $('#filesSelCount').getBoundingClientRect();
          rrect(c, cr.left, cr.top, cr.width, cr.height, sweet ? 2 : cr.height / 2);
          c.fillStyle = (retro || sweet) ? '#faf6ec' : 'rgba(10,132,255,0.2)';
          c.fill();
          if (sweet) { c.strokeStyle = '#2e2d34'; c.lineWidth = 1; c.stroke(); }
          c.font = '600 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = pal.text1;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(cntEl.textContent, cr.left + cr.width / 2, cr.top + cr.height / 2);
        }
        [
          [$('#filesSelAllBtn'), 'sel-all', pal.pillBg, pal.text1, false],
          [$('#filesSelShareBtn'), 'share', pal.pillBg, pal.text1, false],
          [$('#filesSelQrBtn'), 'qr', sweet ? '#2b468b' : pal.accent, '#fff', true],
        ].forEach(([btn, glyph, bg, col, isPrim]) => {
          if (!btn || btn.hidden) return;
          const br = btn.getBoundingClientRect();
          if (!br.width) return;
          c.save();
          if (btn.disabled) c.globalAlpha = 0.4;
          drawThemedBox(c, pal, br.left, br.top, br.width, br.height, {
            r: 8, sweetR: 2, sweetFill: isPrim ? '#2b468b' : '#e4ded3', fill: bg,
            stroke: '#18181b', lineWidth: 1.5,
          });
          drawGlyph(c, glyph, br.left + br.width / 2, br.top + br.height / 2, 14, col);
          c.restore();
        });
        const qrCnt = $('#filesSelQrCount');
        if (qrCnt && !qrCnt.hidden && qrCnt.textContent) {
          const qcr = qrCnt.getBoundingClientRect();
          if (qcr.width) {
            rrect(c, qcr.left, qcr.top, qcr.width, qcr.height, qcr.height / 2);
            c.fillStyle = '#ff3b30'; c.fill();
            c.font = '700 10px "Inter", sans-serif'; c.fillStyle = '#fff';
            c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(qrCnt.textContent.trim(), qcr.left + qcr.width / 2, qcr.top + qcr.height / 2);
          }
        }
      }
    }

    const emptyEl = $('#filesEmpty');
    if (emptyEl && !emptyEl.hidden) {
      const er = emptyEl.getBoundingClientRect();
      drawGlyph(c, 'all', er.left + er.width / 2, er.top + er.height / 2 - 14, 28, pal.text3);
      c.font = '500 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text3;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('Empty Library', er.left + er.width / 2, er.top + er.height / 2 + 16);
    }

    const bodyR = filesWin.querySelector('.files-body')?.getBoundingClientRect();
    if (bodyR) {
      c.save();
      c.beginPath(); c.rect(bodyR.left, bodyR.top, bodyR.width, bodyR.height); c.clip();
    }
    filesGridEl.querySelectorAll('.file-card').forEach((card) => {
      const cr = card.getBoundingClientRect();
      if (!cr.width || !cr.height) return;
      const picked = card.classList.contains('picked') || card.classList.contains('active');
      if (sweet) {
        drawWin98Bevel(c, cr.left, cr.top, cr.width, cr.height, 3, picked ? '#f2c2cf' : '#faf6ec', picked);
      } else {
        if (retro) {
          rrect(c, cr.left + 3, cr.top + 3, cr.width, cr.height, 11);
          c.fillStyle = picked ? '#ec5eb0' : '#18181b'; c.fill();
        }
        rrect(c, cr.left, cr.top, cr.width, cr.height, 11);
        c.fillStyle = picked ? (retro ? '#f2da5e' : 'rgba(10,132,255,0.18)') : pal.cardBg;
        c.fill();
        if (retro || pal.light || picked) {
          c.strokeStyle = retro ? '#18181b' : (picked ? pal.accent : pal.cardBorder);
          c.lineWidth = retro ? 2 : (picked ? 1.5 : 1);
          c.stroke();
        }
      }
      const img = card.querySelector('img');
      const ir = card.querySelector('.file-thumb').getBoundingClientRect();
      const thRad = sweet ? 2 : 7;
      if (img && img.complete && img.naturalWidth) {
        c.save(); rrect(c, ir.left, ir.top, ir.width, ir.height, thRad); c.clip();
        drawImageCover(c, img, img.naturalWidth, img.naturalHeight, ir.left, ir.top, ir.width, ir.height);
        c.restore();
      }
      if (sweet) {
        rrect(c, ir.left, ir.top, ir.width, ir.height, thRad);
        c.strokeStyle = '#2e2d34'; c.lineWidth = 1; c.stroke();
      }
      const playBadge = card.querySelector('.fc-play');
      if (playBadge) {
        const pbr = playBadge.getBoundingClientRect();
        if (pbr.width) {
          c.beginPath();
          c.arc(pbr.left + pbr.width / 2, pbr.top + pbr.height / 2, pbr.width / 2, 0, Math.PI * 2);
          c.fillStyle = 'rgba(0,0,0,0.62)';
          c.fill();
          drawGlyph(c, 'play', pbr.left + pbr.width / 2 + 0.5, pbr.top + pbr.height / 2, 10, '#fff');
        }
      }
      if (filesState.selecting) {
        const chk = card.querySelector('.fc-check');
        if (chk) {
          const ckr = chk.getBoundingClientRect();
          c.beginPath();
          c.arc(ckr.left + ckr.width / 2, ckr.top + ckr.height / 2, ckr.width / 2, 0, Math.PI * 2);
          c.fillStyle = card.classList.contains('picked') ? pal.accent : 'rgba(0,0,0,0.5)';
          c.fill();
          c.strokeStyle = card.classList.contains('picked') ? pal.accent : 'rgba(255,255,255,0.65)';
          c.lineWidth = 1.5;
          c.stroke();
          if (card.classList.contains('picked')) drawGlyph(c, 'check', ckr.left + ckr.width / 2, ckr.top + ckr.height / 2, 11, '#fff');
        }
      }
      const kindEl = card.querySelector('.file-kind-txt');
      if (kindEl) {
        const kr = kindEl.getBoundingClientRect();
        if (kr.width > 0 && kr.height > 0) {
          rrect(c, kr.left, kr.top, kr.width, kr.height, sweet ? 2 : 5);
          c.fillStyle = pal.ctlBg;
          c.fill();
          c.font = '600 10.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = pal.text2;
          c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(kindEl.textContent, kr.left + kr.width / 2, kr.top + kr.height / 2);
        }
      }
      const nameEl = card.querySelector('.file-name');
      if (nameEl) {
        const nr = nameEl.getBoundingClientRect();
        if (nr.width) {
          c.font = '500 11.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = pal.text1;
          const isList = filesGridEl.classList.contains('list-view');
          c.textAlign = isList ? 'left' : 'center'; c.textBaseline = 'middle';
          c.fillText(nameEl.textContent, isList ? nr.left : nr.left + nr.width / 2, nr.top + nr.height / 2, nr.width);
        }
      }
      const dateEl = card.querySelector('.file-date');
      if (dateEl) {
        const dr = dateEl.getBoundingClientRect();
        if (dr.width > 0 && dr.height > 0) {
          c.font = '400 11px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
          c.fillStyle = pal.text3;
          c.textAlign = 'right'; c.textBaseline = 'middle';
          c.fillText(dateEl.textContent, dr.right, dr.top + dr.height / 2, dr.width);
        }
      }
    });
    if (bodyR) c.restore();
  }
  c.restore();
}

function drawShotWindow(c, blurInfo = null) {
  drawMacSplitFrame(c, shotWin, $('#shotPaneTitle')?.textContent || 'Screenshot', blurInfo);
  c.save();
  drawSidebarItems(c, shotWin, '.sb-nav-btn');

  const pal = shotPalette();
  const retro = pal.retro;
  const sweet = pal.sweet;
  const grp = shotWin.querySelector('.mac-group');
  if (grp) {
    const gr = grp.getBoundingClientRect();
    drawThemedBox(c, pal, gr.left, gr.top, gr.width, gr.height, {
      r: 12, sweetR: 3, sweetFill: '#faf6ec', inset: true, retroOffset: 3, retroShadow: '#f2da5e', retroShadowStroke: true,
    });
    grp.querySelectorAll('.mac-row:not([hidden])').forEach((row, idx) => {
      const rr = row.getBoundingClientRect();
      if (idx > 0) {
        c.strokeStyle = pal.rowSep; c.lineWidth = 1;
        c.beginPath(); c.moveTo(rr.left + 14, rr.top); c.lineTo(rr.right - 14, rr.top); c.stroke();
      }
      const lbl = row.querySelector('span');
      if (lbl) {
        c.font = '500 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = pal.text1;
        c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText(lbl.textContent, rr.left + 14, rr.top + rr.height / 2);
      }
      const mv = row.querySelector('.muted-val');
      if (mv) {
        c.font = '400 12.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = pal.text3;
        c.textAlign = 'right'; c.textBaseline = 'middle';
        c.fillText(mv.textContent, rr.right - 14, rr.top + rr.height / 2);
      }
    });
    drawMacSwitch(c, $('#shotFlashToggle'));
    const chip = $('#shotOpenFlashSet');
    if (chip) {
      const cr = chip.getBoundingClientRect();
      drawThemedBox(c, pal, cr.left, cr.top, cr.width, cr.height, {
        r: cr.height / 2, sweetR: 2, sweetFill: '#e4ded3', fill: pal.ctlBg, stroke: '#18181b', lineWidth: 1.5,
      });
      c.beginPath();
      c.arc(cr.left + 12, cr.top + cr.height / 2, 5, 0, Math.PI * 2);
      c.fillStyle = flashCfg.color;
      c.fill();
      if (retro || sweet || pal.light) { c.strokeStyle = pal.cardBorder; c.lineWidth = 1; c.stroke(); }
      const ct = $('#shotFlashChipText');
      if (ct) {
        c.font = '500 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
        c.fillStyle = pal.text1;
        c.textAlign = 'right'; c.textBaseline = 'middle';
        c.fillText(ct.textContent, cr.right - 10, cr.top + cr.height / 2);
      }
    }
  }

  const startBtn = $('#shotStartBtn');
  if (startBtn) {
    const br = startBtn.getBoundingClientRect();
    drawThemedBox(c, pal, br.left, br.top, br.width, br.height, {
      r: 9, sweetR: 2, sweetFill: '#2b468b', retroOffset: 2, fill: pal.accent, stroke: '#18181b', lineWidth: 2,
    });
    c.font = '600 13.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    c.fillStyle = '#fff';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText($('#shotStartLabel')?.textContent || 'Capture', br.left + br.width / 2 + 8, br.top + br.height / 2);
    drawGlyph(c, shotState.mode === 'video' ? 'video' : 'camera', br.left + br.width / 2 - 34, br.top + br.height / 2, 15, '#fff');
  }
  c.restore();
}

function drawQuickLookOverlay(c, W, H, blurInfo = null) {
  const ql = $('#quickLook');
  if (!ql || ql.hidden) return;
  const pal = shotPalette();
  const retro = pal.retro;
  const sweet = pal.sweet;
  c.save();
  c.fillStyle = retro ? 'rgba(17,68,63,0.62)' : (sweet ? 'rgba(43,70,139,0.42)' : 'rgba(10,12,18,0.58)');
  c.fillRect(0, 0, W, H);
  const win = ql.querySelector('.ql-win');
  if (win) {
    const wr = win.getBoundingClientRect();
    if (sweet) {
      rrect(c, wr.left + 4, wr.top + 4, wr.width, wr.height, 3);
      c.fillStyle = 'rgba(46,45,52,0.24)'; c.fill();
      drawWin98Bevel(c, wr.left, wr.top, wr.width, wr.height, 3, '#e4ded3', false);
    } else if (retro) {
      drawRetroStackShadow(c, wr.left, wr.top, wr.width, wr.height, 14);
      rrect(c, wr.left, wr.top, wr.width, wr.height, 14);
      c.fillStyle = '#faf7ec'; c.fill();
      c.strokeStyle = '#18181b'; c.lineWidth = 2; c.stroke();
    } else {
      drawOuterShadow(c, wr.left, wr.top, wr.width, wr.height, 14, 'rgba(0,0,0,0.48)', 44, 16);
      drawFrostedSurface(c, wr.left, wr.top, wr.width, wr.height, 14, pal.light ? 'rgba(248,249,252,0.96)' : 'rgba(26,27,34,0.68)', blurInfo);
      rrect(c, wr.left + 0.5, wr.top + 0.5, wr.width - 1, wr.height - 1, 14);
      c.strokeStyle = pal.cardBorder;
      c.lineWidth = 1;
      c.stroke();
    }

    drawWinCloseDot(c, $('#qlCloseBtn'), pal);
    const qt = $('#qlTitle');
    if (qt && qt.textContent) {
      const qtr = qt.getBoundingClientRect();
      c.font = '600 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text1;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(qt.textContent, qtr.left + qtr.width / 2, qtr.top + qtr.height / 2);
    }
    const qIdx = $('#qlIndex');
    if (qIdx && !qIdx.hidden && qIdx.textContent) {
      const qir = qIdx.getBoundingClientRect();
      c.font = '500 11.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text3;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(qIdx.textContent, qir.left + qir.width / 2, qir.top + qir.height / 2);
    }
    [
      [$('#qlShareBtn'), 'share'],
      [$('#qlDlBtn'), 'download'],
    ].forEach(([btn, glyph]) => {
      if (!btn || btn.hidden) return;
      const br = btn.getBoundingClientRect();
      if (!br.width) return;
      drawThemedBox(c, pal, br.left, br.top, br.width, br.height, {
        r: 7, sweetR: 2, sweetFill: '#e4ded3', fill: pal.pillBg,
        stroke: retro ? '#18181b' : pal.cardBorder, lineWidth: retro ? 1.5 : 1,
      });
      drawGlyph(c, glyph, br.left + br.width / 2, br.top + br.height / 2, 14, pal.text1);
    });

    const st = ql.querySelector('.ql-stage');
    if (st) {
      const sr = st.getBoundingClientRect();
      const sRad = sweet ? 2 : 10;
      c.save();
      rrect(c, sr.left, sr.top, sr.width, sr.height, sRad);
      c.clip();
      c.fillStyle = '#000';
      c.fillRect(sr.left, sr.top, sr.width, sr.height);
      const qi = $('#qlImg'), qv = $('#qlVideo');
      if (qi && !qi.hidden && qi.naturalWidth) drawImageContain(c, qi, qi.naturalWidth, qi.naturalHeight, sr.left, sr.top, sr.width, sr.height);
      else if (qv && !qv.hidden && qv.videoWidth) drawImageContain(c, qv, qv.videoWidth, qv.videoHeight, sr.left, sr.top, sr.width, sr.height);
      if (qv && !qv.hidden) drawUvpBar(c, st);
      [
        [$('#qlPrevBtn'), 'back'],
        [$('#qlNextBtn'), 'next'],
      ].forEach(([nav, glyph]) => {
        if (!nav || nav.hidden) return;
        const nr = nav.getBoundingClientRect();
        if (!nr.width) return;
        c.beginPath();
        c.arc(nr.left + nr.width / 2, nr.top + nr.height / 2, nr.width / 2, 0, Math.PI * 2);
        c.fillStyle = 'rgba(20,21,26,0.72)';
        c.fill();
        drawGlyph(c, glyph, nr.left + nr.width / 2, nr.top + nr.height / 2, 16, '#fff');
      });
      c.restore();
      if (sweet || retro) {
        rrect(c, sr.left, sr.top, sr.width, sr.height, sRad);
        c.strokeStyle = sweet ? '#2e2d34' : '#18181b'; c.lineWidth = 1.5; c.stroke();
      }
    }
  }
  c.restore();
}

function drawShareMenuOverlay(c, blurInfo = null) {
  const sm = $('#shareMenu');
  if (!sm || sm.hidden) return;
  const r = sm.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const pal = shotPalette();
  c.save();
  if (!pal.retro && !pal.sweet) {
    drawOuterShadow(c, r.left, r.top, r.width, r.height, 14, 'rgba(0,0,0,0.42)', 28, 10);
    drawFrostedSurface(c, r.left, r.top, r.width, r.height, 14, pal.light ? 'rgba(248,249,252,0.96)' : 'rgba(28,30,36,0.92)', blurInfo);
  }
  drawThemedBox(c, pal, r.left, r.top, r.width, r.height, {
    r: 14, sweetR: 3, sweetFill: '#e4ded3', shadow: 4, retroOffset: 4,
    fill: pal.retro ? '#faf7ec' : 'transparent',
  });
  const smGlyphs = { qr: ['qr', pal.accent], native: ['share', pal.text1], copy: ['copy', pal.text1], whatsapp: ['wa', '#22c55e'], instagram: ['ig', '#dd2a7b'], telegram: ['tg', '#38bdf8'], x: ['x', pal.text1] };
  sm.querySelectorAll('.sm-item').forEach((item) => {
    const ir = item.getBoundingClientRect();
    if (!ir.width) return;
    const ico = item.querySelector('.sm-ico')?.getBoundingClientRect();
    const [gl, bg] = smGlyphs[item.dataset.sact] || ['share', pal.accent];
    if (ico && ico.width) {
      rrect(c, ico.left, ico.top, ico.width, ico.height, pal.sweet ? 3 : 8);
      c.fillStyle = pal.sweet ? '#faf6ec' : bg; c.fill();
      if (pal.sweet || pal.retro) { c.strokeStyle = '#2e2d34'; c.lineWidth = 1.2; c.stroke(); }
      drawGlyph(c, gl, ico.left + ico.width / 2, ico.top + ico.height / 2, 14, pal.sweet ? bg : '#fff');
    }
    const lbl = item.querySelector('span')?.textContent?.trim();
    if (lbl) {
      c.font = '500 10.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text2; c.textAlign = 'center'; c.textBaseline = 'bottom';
      c.fillText(lbl, ir.left + ir.width / 2, ir.bottom - 2);
    }
  });
  c.restore();
}

function drawQrModalOverlay(c, W, H, blurInfo = null) {
  const qm = $('#qrModal');
  if (!qm || qm.hidden) return;
  const card = qm.querySelector('.qr-card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const pal = shotPalette();
  c.save();
  c.fillStyle = pal.retro ? 'rgba(17,68,63,0.62)' : (pal.sweet ? 'rgba(43,70,139,0.42)' : 'rgba(10,12,18,0.58)');
  c.fillRect(0, 0, W, H);
  if (!pal.retro && !pal.sweet) {
    drawOuterShadow(c, r.left, r.top, r.width, r.height, 14, 'rgba(0,0,0,0.48)', 44, 16);
    drawFrostedSurface(c, r.left, r.top, r.width, r.height, 14, pal.light ? 'rgba(248,249,252,0.96)' : 'rgba(26,27,34,0.88)', blurInfo);
  }
  drawThemedBox(c, pal, r.left, r.top, r.width, r.height, {
    r: 14, sweetR: 3, sweetFill: '#e4ded3', shadow: 4, retroOffset: 4,
    fill: pal.retro ? '#faf7ec' : 'transparent',
  });
  drawWinCloseDot(c, $('#qrCloseBtn'), pal);
  const titleEl = $('#qrTitle');
  if (titleEl && titleEl.textContent) {
    const tr = titleEl.getBoundingClientRect();
    c.font = '600 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    c.fillStyle = pal.text1; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(titleEl.textContent.trim(), tr.left + tr.width / 2, tr.top + tr.height / 2);
  }
  [
    [$('#qrRefreshBtn'), 'refresh', true],
    [$('#qrCopyBtn'), 'copy', false],
  ].forEach(([btn, gl, isPrim]) => {
    if (!btn || btn.hidden) return;
    const br = btn.getBoundingClientRect();
    if (!br.width) return;
    drawThemedBox(c, pal, br.left, br.top, br.width, br.height, {
      r: 7, sweetR: 2, sweetFill: isPrim ? '#2b468b' : '#e4ded3', fill: isPrim ? pal.accent : pal.pillBg,
    });
    drawGlyph(c, gl, br.left + br.width / 2, br.top + br.height / 2, 14, isPrim ? '#fff' : pal.text1);
  });
  const qPaper = qm.querySelector('.qr-paper')?.getBoundingClientRect();
  if (qPaper && qPaper.width) {
    rrect(c, qPaper.left, qPaper.top, qPaper.width, qPaper.height, pal.sweet ? 2 : 10);
    c.fillStyle = '#fff'; c.fill();
    if (pal.sweet || pal.retro) { c.strokeStyle = '#2e2d34'; c.lineWidth = 1.5; c.stroke(); }
    const qc = $('#qrCanvas');
    if (qc && qc.width && qc.height) {
      const qcr = qc.getBoundingClientRect();
      c.drawImage(qc, qcr.left, qcr.top, qcr.width, qcr.height);
    }
  }
  [$('#qrItemSummary'), $('#qrStatus'), $('#qrExpireBadge')].forEach((el) => {
    if (!el || el.hidden || !el.textContent) return;
    const er = el.getBoundingClientRect();
    if (!er.width) return;
    c.font = '500 11.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    c.fillStyle = pal.text2; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(el.textContent.trim(), er.left + er.width / 2, er.top + er.height / 2, er.width);
  });
  c.restore();
}

function drawWelcomeModalOverlay(c, W, H, blurInfo = null) {
  const wm = $('#welcomeModal');
  if (!wm || wm.hidden) return;
  const card = wm.querySelector('.welcome-card');
  if (!card) return;
  const r = card.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const pal = shotPalette();
  c.save();
  c.fillStyle = pal.retro ? 'rgba(17,68,63,0.62)' : (pal.sweet ? 'rgba(43,70,139,0.42)' : 'rgba(10,12,18,0.58)');
  c.fillRect(0, 0, W, H);
  if (!pal.retro && !pal.sweet) {
    drawOuterShadow(c, r.left, r.top, r.width, r.height, 16, 'rgba(0,0,0,0.48)', 44, 16);
    drawFrostedSurface(c, r.left, r.top, r.width, r.height, 16, pal.light ? 'rgba(248,249,252,0.96)' : 'rgba(26,27,34,0.9)', blurInfo);
  }
  drawThemedBox(c, pal, r.left, r.top, r.width, r.height, {
    r: 16, sweetR: 3, sweetFill: '#e4ded3', shadow: 4, retroOffset: 4,
    fill: pal.retro ? '#faf7ec' : 'transparent',
  });
  drawWinCloseDot(c, $('#welcomeCloseBtn'), pal);
  const tEl = $('#welcomeTitle');
  if (tEl && tEl.textContent) {
    const tr = tEl.getBoundingClientRect();
    c.font = '700 18px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    c.fillStyle = pal.text1; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(tEl.textContent.trim(), tr.left + tr.width / 2, tr.top + tr.height / 2);
  }
  const subP = wm.querySelector('.welcome-hero p');
  if (subP && subP.textContent) {
    const pr = subP.getBoundingClientRect();
    c.font = '400 12px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    c.fillStyle = pal.text3; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(subP.textContent.trim(), pr.left + pr.width / 2, pr.top + pr.height / 2, pr.width);
  }
  const wGlyphs = ['sparkle', 'lock', 'qr', 'camera'];
  wm.querySelectorAll('.welcome-list li').forEach((li, i) => {
    const ico = li.querySelector('.wl-ico')?.getBoundingClientRect();
    if (ico && ico.width) {
      drawThemedBox(c, pal, ico.left, ico.top, ico.width, ico.height, {
        r: 8, sweetR: 2, sweetFill: '#f2c2cf', fill: pal.ctlBg,
      });
      drawGlyph(c, wGlyphs[i] || 'sparkle', ico.left + ico.width / 2, ico.top + ico.height / 2, 14, pal.sweet ? '#2e2d34' : pal.accent);
    }
    const st = li.querySelector('strong')?.getBoundingClientRect();
    if (st) {
      c.font = '600 12.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text1; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(li.querySelector('strong').textContent.trim(), st.left, st.top + st.height / 2, st.width);
    }
    const desc = li.querySelector('p')?.getBoundingClientRect();
    if (desc) {
      c.font = '400 11.5px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
      c.fillStyle = pal.text3;
      drawWrappedText(c, li.querySelector('p').textContent.trim(), desc.left, desc.top, desc.width, 14.5, 'left');
    }
  });
  const cta = $('#welcomeStartBtn');
  if (cta) {
    const br = cta.getBoundingClientRect();
    drawThemedBox(c, pal, br.left, br.top, br.width, br.height, {
      r: 10, sweetR: 2, sweetFill: '#2b468b', retroOffset: 2, fill: pal.accent, stroke: '#18181b', lineWidth: 2,
    });
    c.font = '600 13px "Inter", -apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif';
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(cta.textContent.trim(), br.left + br.width / 2, br.top + br.height / 2);
  }
  c.restore();
}

function drawShotToastOverlay(c) {
  const st = $('#shotToast');
  if (!st || st.hidden) return;
  const r = st.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const pal = shotPalette();
  c.save();
  drawThemedBox(c, pal, r.left, r.top, r.width, r.height, {
    r: 10, sweetR: 3, sweetFill: '#e4ded3', shadow: 4, retroOffset: 3,
    fill: pal.retro ? '#faf7ec' : pal.cardBg,
  });
  const img = $('#shotPreview');
  if (img && img.complete && img.naturalWidth) {
    const ir = img.getBoundingClientRect();
    if (ir.width) {
      c.save(); rrect(c, ir.left, ir.top, ir.width, ir.height, pal.sweet ? 2 : 6); c.clip();
      drawImageCover(c, img, img.naturalWidth, img.naturalHeight, ir.left, ir.top, ir.width, ir.height);
      c.restore();
    }
  }
  c.restore();
}

/* --------------------- Screenshot App & Desktop Video (5s max) --------------------- */
const SHOT_VIDEO_MAX_MS = 5000;
const shotWin = $('#shotWin');
const shotCountdownEl = $('#shotCountdown');
const shotCountNumEl = $('#shotCountNum');
const shotRecPillEl = $('#shotRecPill');
const shotRecTimeEl = $('#shotRecTime');
const shotStopBtn = $('#shotStopBtn');
const shotState = { open: false, minimized: false, placed: false, x: 0, y: 0, mode: 'photo', flashOn: false };

const shotApp = createUtilityApp({
  el: shotWin,
  state: shotState,
  title: 'Screenshot',
  dockClass: 'shot-running',
  closeBtn: $('#shotClose'),
  minBtn: $('#shotMin'),
  defaultW: 500,
  defaultH: 292,
  onOpen() { updateShotUI(); },
});

function updateShotUI() {
  const isVideo = shotState.mode === 'video';
  $('#shotNav')?.querySelectorAll('.sb-nav-btn').forEach((b) => {
    const on = b.dataset.smode === shotState.mode;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  const paneTitle = $('#shotPaneTitle');
  if (paneTitle) paneTitle.textContent = isVideo ? 'Video' : 'Photo';
  const toggleBtn = $('#shotFlashToggle');
  if (toggleBtn) toggleBtn.setAttribute('aria-checked', String(shotState.flashOn));
  const dot = $('#shotFlashDot');
  if (dot) dot.style.background = flashCfg.color;
  const chipTxt = $('#shotFlashChipText');
  if (chipTxt) chipTxt.textContent = `${flashCfg.brightness}%`;
  const durRow = $('#shotDurRow');
  if (durRow) durRow.hidden = !isVideo;
  const startLbl = $('#shotStartLabel');
  if (startLbl) startLbl.textContent = isVideo ? 'Record 5s' : 'Capture';
}

function buildShotUI() {
  $('#shotNav')?.querySelectorAll('.sb-nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      shotState.mode = btn.dataset.smode === 'video' ? 'video' : 'photo';
      updateShotUI();
    });
  });
  $('#shotFlashToggle')?.addEventListener('click', () => {
    shotState.flashOn = !shotState.flashOn;
    updateShotUI();
  });
  $('#shotOpenFlashSet')?.addEventListener('click', openSettingsFlash);
  $('#shotStartBtn')?.addEventListener('click', () => {
    // Hide the Screenshot window before countdown/capture so it is not captured in output
    shotState.open = false;
    shotState.minimized = false;
    shotWin.hidden = true;
    focusTopVisible();
    updateDock();
    triggerScreenshotCountdown();
  });
  shotStopBtn?.addEventListener('click', () => stopDesktopVideoRecording());
  shotCountdownEl?.addEventListener('click', () => { if (shotCtl) cancelCtl(shotCtl); });
  updateShotUI();
}

let shotCtl = null;
let shotRecStopFn = null;

function stopDesktopVideoRecording() {
  if (shotRecStopFn) shotRecStopFn();
}

async function startDesktopVideoRecording() {
  if (!window.MediaRecorder || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
    showDesktopNotice('Screen video recording is not supported in this browser.', 2600);
    return;
  }
  await ensureDockSvgsCached();
  const W = innerWidth, H = innerHeight;
  const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  const out = document.createElement('canvas');
  out.width = evenDim(W * dpr);
  out.height = evenDim(H * dpr);
  const scaleX = out.width / W;
  const scaleY = out.height / H;
  const c = out.getContext('2d');
  c.scale(scaleX, scaleY);

  const recTs = Date.now();
  drawDesktopComposition(c, W, H);
  const barStamp = createWatermarkBarStamp(out.width, out.height, { tag: 'VIDEO', timestamp: recTs });
  const barH = evenDim(barStamp.height);
  const recOut = document.createElement('canvas');
  recOut.width = out.width;
  recOut.height = out.height + barH;
  const recCtx = recOut.getContext('2d');
  mountRecordingCanvas(recOut);
  recCtx.drawImage(out, 0, 0);
  recCtx.drawImage(barStamp, 0, out.height, out.width, barH);

  const thumb = await makeThumb(recOut);
  const stream = recOut.captureStream(30);
  const vTrack = stream.getVideoTracks()[0];
  const requestFrame = () => {
    try { if (vTrack && typeof vTrack.requestFrame === 'function') vTrack.requestFrame(); } catch (_) {}
  };
  requestFrame();

  const mime = pickMime(false);
  const chunks = [];
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };

  shotVideoActive = true;
  updateFillLight();
  if (shotRecPillEl) shotRecPillEl.hidden = false;

  const tStart = performance.now();
  let stopped = false;
  let rafId = 0;

  const finish = () => {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(rafId);
    clearTimeout(maxTimer);
    clearInterval(uiTimer);
    shotRecStopFn = null;
    shotVideoActive = false;
    updateFillLight();
    if (shotRecPillEl) shotRecPillEl.hidden = true;
    try { if (rec.state !== 'inactive') rec.stop(); } catch (_) { /* ignore */ }
  };

  shotRecStopFn = finish;

  const drawFrame = () => {
    if (stopped) return;
    c.setTransform(scaleX, 0, 0, scaleY, 0, 0);
    drawDesktopComposition(c, W, H);
    recCtx.drawImage(out, 0, 0);
    recCtx.drawImage(barStamp, 0, out.height, out.width, barH);
    requestFrame();
    if (performance.now() - tStart >= SHOT_VIDEO_MAX_MS) { finish(); return; }
    rafId = requestAnimationFrame(drawFrame);
  };

  const updateRecLabel = () => {
    const sec = Math.min(5, Math.floor((performance.now() - tStart) / 1000));
    if (shotRecTimeEl) shotRecTimeEl.textContent = `0:0${sec} / 0:05`;
  };
  updateRecLabel();
  const uiTimer = setInterval(updateRecLabel, 120);
  const maxTimer = setTimeout(finish, SHOT_VIDEO_MAX_MS);

  await new Promise((resolve) => {
    rec.onstop = async () => {
      unmountRecordingCanvas(recOut);
      try {
        const type = rec.mimeType || mime || 'video/mp4';
        const blob = new Blob(chunks, { type });
        if (blob.size > 0) {
          const now = Date.now();
          const saved = await addItem({
            type: 'video',
            blob,
            thumb,
            mime: type,
            createdAt: now,
            name: `Rupa Booth Video ${stamp(now)}`,
          });
          showShotToast(saved, thumb);
        }
      } catch (err) {
        console.error('Desktop video save failed:', err);
      }
      resolve();
    };
    requestAnimationFrame(() => {
      if (stopped) return;
      drawFrame();
      rec.start();
    });
  });
}

async function triggerScreenshotCountdown() {
  if (shotRecStopFn) { stopDesktopVideoRecording(); return; }
  if (shotCtl) {
    cancelCtl(shotCtl);
    return;
  }
  const ctl = { cancelled: false };
  const sec = getTimerSeconds();
  const modeLabel = shotState.mode === 'video' ? 'Video (5s)' : 'Photo';
  const noteEl = $('#shotCountNote');
  shotCtl = ctl;
  try {
    if (sec > 0) {
      shotCountdownEl.hidden = false;
      for (let i = sec; i >= 1; i--) {
        if (ctl.cancelled) throw 'cancelled';
        shotCountNumEl.textContent = String(i);
        if (noteEl) noteEl.textContent = `${modeLabel} in ${i}s · Click or press Space to cancel`;
        shotCountdownEl.classList.remove('tick');
        void shotCountdownEl.offsetWidth;
        shotCountdownEl.classList.add('tick');
        if (shouldCountdownBeep(sec, i)) beep(i === 1 ? 1100 : 760, 0.09);
        await sleep(1000, ctl);
      }
      shotCountdownEl.hidden = true;
    }
    await new Promise((r) => requestAnimationFrame(r));
    if (ctl.cancelled) throw 'cancelled';
    if (shotState.mode === 'video') await startDesktopVideoRecording();
    else await takeDesktopScreenshot(ctl);
  } catch (e) {
    if (e === 'cancelled') showDesktopNotice('Screenshot cancelled');
    else console.error(e);
  } finally {
    clearFlashOverlay();
    shotCountdownEl.hidden = true;
    shotCountdownEl.classList.remove('tick');
    if (shotCtl === ctl) shotCtl = null;
  }
}

