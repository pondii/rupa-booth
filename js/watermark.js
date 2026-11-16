'use strict';

/* ---------------------- Camera-Style Bottom Watermark (Leica / ZEISS inspired) ---------------------- */
const WM_BRAND = 'Rupa Booth';
const WM_FONT_STACK = '"Inter", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif';

function formatWatermarkDate(ts = Date.now()) {
  const d = new Date(ts);
  const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function getWatermarkFooterHeight(w, h) {
  // Even height keeps canvas video dimensions compatible with MP4/H.264 & mobile encoders
  const raw = clampN(Math.round(Math.min(w, h) * 0.115), 34, 112);
  return Math.max(34, Math.floor(raw / 2) * 2);
}

function measureTrackedText(ctx, text, trackingPx) {
  if (!text) return 0;
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${trackingPx.toFixed(2)}px`;
    const w = ctx.measureText(text).width;
    ctx.letterSpacing = '0px';
    return w;
  }
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    total += ctx.measureText(text[i]).width + (i < text.length - 1 ? trackingPx : 0);
  }
  return total;
}

function drawTrackedText(ctx, text, x, y, trackingPx) {
  if (!text) return;
  if ('letterSpacing' in ctx) {
    ctx.letterSpacing = `${trackingPx.toFixed(2)}px`;
    ctx.fillText(text, x, y);
    ctx.letterSpacing = '0px';
    return;
  }
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    ctx.fillText(text[i], cx, y);
    cx += ctx.measureText(text[i]).width + trackingPx;
  }
}

const WM_LOGO_VW = 230.5;
const WM_LOGO_VH = 99.0;
const WM_LOGO_AR = WM_LOGO_VW / WM_LOGO_VH;
const WM_LOGO_PATH_STRS = [
  'M80.25 49.25C80.25 49.25 85.38 48.92 88.25 48.25C91.12 47.58 95.12 46.25 97.50 45.25C99.88 44.25 101.00 43.46 102.50 42.25C104.00 41.04 105.27 40.32 106.50 38.00C108.00 35.17 110.12 31.26 111.50 25.25C112.96 18.92 115.25 0.00 115.25 0.00C115.25 0.00 115.67 7.79 116.25 12.00C116.83 16.21 117.50 20.92 118.75 25.25C120.00 29.58 122.25 35.17 123.75 38.00C124.98 40.32 126.25 41.04 127.75 42.25C129.25 43.46 130.38 44.25 132.75 45.25C135.12 46.25 139.12 47.54 142.00 48.25C144.88 48.96 150.00 49.50 150.00 49.50C150.00 49.50 144.88 49.83 142.00 50.50C139.12 51.17 135.12 52.50 132.75 53.50C130.38 54.50 129.25 55.29 127.75 56.50C126.25 57.71 124.98 58.43 123.75 60.75C122.25 63.58 120.13 67.49 118.75 73.50C117.29 79.83 115.00 98.75 115.00 98.75C115.00 98.75 114.58 90.96 114.00 86.75C113.42 82.54 112.75 77.83 111.50 73.50C110.25 69.17 108.00 63.58 106.50 60.75C105.27 58.43 104.00 57.71 102.50 56.50C101.00 55.29 99.88 54.50 97.50 53.50C95.12 52.50 91.12 51.21 88.25 50.50C85.38 49.79 80.25 49.25 80.25 49.25Z',
  'M0.00 43.50C0.00 43.50 21.29 29.58 27.75 25.75C32.47 22.95 34.58 22.25 38.75 20.50C42.92 18.75 47.50 16.88 52.75 15.25C58.00 13.62 64.21 11.96 70.25 10.75C76.29 9.54 83.50 8.54 89.00 8.00C94.50 7.46 100.50 7.25 103.25 7.50C104.60 7.62 105.12 8.75 105.50 9.50C105.88 10.25 105.75 11.29 105.50 12.00C105.25 12.71 104.96 13.36 104.00 13.75C102.75 14.25 100.00 14.38 98.00 15.00C96.00 15.62 94.33 16.12 92.00 17.50C89.67 18.88 86.29 21.08 84.00 23.25C81.71 25.42 79.75 28.08 78.25 30.50C76.75 32.92 75.88 36.12 75.00 37.75C74.32 39.02 74.04 39.38 73.00 40.25C71.96 41.12 70.04 42.42 68.75 43.00C67.46 43.58 66.86 43.74 65.25 43.75C53.79 43.83 0.00 43.50 0.00 43.50Z',
  'M124.75 9.75C125.17 9.00 125.74 7.66 127.25 7.50C130.00 7.21 135.96 7.50 141.25 8.00C146.54 8.50 152.96 9.29 159.00 10.50C165.04 11.71 172.08 13.58 177.50 15.25C182.92 16.92 187.33 18.75 191.50 20.50C195.67 22.25 197.92 23.21 202.50 25.75C207.08 28.29 214.38 32.75 219.00 35.75C223.62 38.75 230.25 43.75 230.25 43.75C230.25 43.75 176.46 43.88 165.00 43.75C163.39 43.73 162.79 43.58 161.50 43.00C160.21 42.42 158.29 41.12 157.25 40.25C156.21 39.38 155.93 39.02 155.25 37.75C154.38 36.12 153.50 32.92 152.00 30.50C150.50 28.08 148.54 25.42 146.25 23.25C143.96 21.08 140.58 18.88 138.25 17.50C135.92 16.12 134.17 15.58 132.25 15.00C130.33 14.42 128.00 14.50 126.75 14.00C125.57 13.53 125.08 12.71 124.75 12.00C124.42 11.29 124.33 10.50 124.75 9.75Z',
  'M0.00 56.50C0.00 56.50 0.71 55.02 1.75 55.00C12.67 54.75 54.29 54.88 65.50 55.00C67.11 55.02 67.71 55.17 69.00 55.75C70.29 56.33 71.89 56.67 73.25 58.50C74.79 60.58 76.46 65.42 78.25 68.25C80.04 71.08 81.71 73.33 84.00 75.50C86.29 77.67 89.67 79.88 92.00 81.25C94.33 82.62 96.08 83.17 98.00 83.75C99.92 84.33 102.25 84.25 103.50 84.75C104.68 85.22 105.17 86.04 105.50 86.75C105.83 87.46 105.92 88.25 105.50 89.00C105.08 89.75 104.51 91.15 103.00 91.25C99.25 91.50 89.42 91.00 83.00 90.50C76.58 90.00 71.54 89.50 64.50 88.25C57.46 87.00 47.29 84.79 40.75 83.00C34.21 81.21 30.00 79.58 25.25 77.50C20.50 75.42 15.88 72.92 12.25 70.50C8.62 68.08 5.54 65.33 3.50 63.00C1.46 60.67 0.00 56.50 0.00 56.50Z',
  'M124.75 86.75C125.08 86.04 125.57 85.22 126.75 84.75C128.00 84.25 130.33 84.33 132.25 83.75C134.17 83.17 136.25 82.33 138.25 81.25C140.25 80.17 142.21 79.04 144.25 77.25C146.29 75.46 148.38 73.62 150.50 70.50C152.62 67.38 155.21 60.96 157.00 58.50C158.34 56.66 159.96 56.33 161.25 55.75C162.54 55.17 163.14 55.02 164.75 55.00C175.96 54.88 217.58 54.75 228.50 55.00C229.54 55.02 230.25 56.50 230.25 56.50C230.25 56.50 228.79 60.67 226.75 63.00C224.71 65.33 221.62 68.08 218.00 70.50C214.38 72.92 209.75 75.42 205.00 77.50C200.25 79.58 196.04 81.21 189.50 83.00C182.96 84.79 173.75 86.92 165.75 88.25C157.75 89.58 148.08 90.54 141.50 91.00C134.92 91.46 126.25 91.00 126.25 91.00C126.25 91.00 125.00 89.71 124.75 89.00C124.50 88.29 124.42 87.46 124.75 86.75Z',
];

let wmPath2DCache = null;
function getLogoPath2Ds() {
  if (wmPath2DCache || typeof Path2D !== 'function') return wmPath2DCache;
  wmPath2DCache = WM_LOGO_PATH_STRS.map((d) => new Path2D(d));
  return wmPath2DCache;
}

function drawRupaBrandLogo(ctx, x, midY, logoW, logoH) {
  const paths = getLogoPath2Ds();
  ctx.save();
  ctx.translate(x, midY - logoH / 2);
  ctx.scale(logoW / WM_LOGO_VW, logoH / WM_LOGO_VH);
  ctx.fillStyle = '#111111';
  if (paths) {
    for (const p of paths) ctx.fill(p);
  }
  ctx.restore();
}

function drawWatermarkFooterBar(ctx, w, yTop, footerH, opts = {}) {
  const tag = opts.tag || 'PHOTO';
  const ts = opts.timestamp || Date.now();
  const fullSubtext = `${tag} · ${formatWatermarkDate(ts)}`;

  // Solid clean white Leica-style footer with zero gap under media
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, yTop, w, footerH);

  // Proportional spacing (~5% horizontal, dead-center vertical)
  const padX = Math.max(12, Math.round(w * 0.05));
  const midY = yTop + footerH / 2;

  // Typography sizing tuned to bar height, clamped cleanly for readability & narrow frames
  let brandPx = clampN(Math.round(footerH * 0.33), 11, 32);
  const trackingPx = () => brandPx * 0.04;
  let capH = brandPx * 0.72;
  let logoH = clampN(Math.round(capH * 1.55), 14, Math.round(footerH * 0.56));
  let logoW = Math.round(logoH * WM_LOGO_AR);

  // Scale down gently if extremely narrow capture (never wrap or overlap logo)
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.font = `700 ${brandPx}px ${WM_FONT_STACK}`;
  let brandW = measureTrackedText(ctx, WM_BRAND, trackingPx());
  const minClearGap = Math.max(10, Math.round(brandPx * 0.85));

  while (brandPx > 9 && padX * 2 + brandW + minClearGap + logoW > w) {
    brandPx -= 1;
    capH = brandPx * 0.72;
    logoH = clampN(Math.round(capH * 1.55), 12, Math.round(footerH * 0.56));
    logoW = Math.round(logoH * WM_LOGO_AR);
    ctx.font = `700 ${brandPx}px ${WM_FONT_STACK}`;
    brandW = measureTrackedText(ctx, WM_BRAND, trackingPx());
  }

  // Fit optional divider + subtext cleanly without wrapping or touching right logo
  const subPx = Math.max(8, Math.round(brandPx * 0.80));
  const groupGap = Math.max(6, Math.round(brandPx * 0.52));
  const divW = Math.max(1, Math.round(brandPx * 0.055));
  const divH = Math.round(brandPx * 0.92);
  const availLeftW = w - padX * 2 - logoW - minClearGap;

  let chosenSub = '';
  for (const candidate of [fullSubtext, tag]) {
    if (!candidate) continue;
    ctx.font = `400 ${subPx}px ${WM_FONT_STACK}`;
    const subW = measureTrackedText(ctx, candidate, subPx * 0.03);
    if (brandW + groupGap * 2 + divW + subW <= availLeftW) {
      chosenSub = candidate;
      break;
    }
  }

  // Draw Left Group: Brand Name + [optional Divider + Subtext]
  const textY = midY + Math.max(0.5, brandPx * 0.03);
  ctx.font = `700 ${brandPx}px ${WM_FONT_STACK}`;
  ctx.fillStyle = '#111111';
  drawTrackedText(ctx, WM_BRAND, padX, textY, trackingPx());

  if (chosenSub) {
    const divX = Math.round(padX + brandW + groupGap);
    ctx.fillStyle = '#D1D5DB';
    ctx.fillRect(divX, Math.round(midY - divH / 2), divW, divH);

    ctx.font = `400 ${subPx}px ${WM_FONT_STACK}`;
    ctx.fillStyle = '#6B7280';
    drawTrackedText(ctx, chosenSub, divX + divW + groupGap, midY + Math.max(0.5, subPx * 0.03), subPx * 0.03);
  }

  // Draw Right Group: Black vector Brand Logo aligned flush right & dead-center vertically
  const logoX = w - padX - logoW;
  drawRupaBrandLogo(ctx, logoX, midY, logoW, logoH);

  ctx.restore();
}

function createWatermarkedCanvas(source, opts = {}) {
  const w = source.width;
  const h = source.height;
  const footerH = getWatermarkFooterHeight(w, h);
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h + footerH;
  const c = out.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  // Paint solid white backdrop first so zero gap/hairline appears between image and bar
  c.fillStyle = '#FFFFFF';
  c.fillRect(0, 0, out.width, out.height);
  c.drawImage(source, 0, 0, w, h);
  drawWatermarkFooterBar(c, w, h, footerH, opts);
  return out;
}

function createWatermarkBarStamp(w, h, opts = {}) {
  const footerH = getWatermarkFooterHeight(w, h);
  const bar = document.createElement('canvas');
  bar.width = w;
  bar.height = footerH;
  const c = bar.getContext('2d');
  c.imageSmoothingEnabled = true;
  c.imageSmoothingQuality = 'high';
  drawWatermarkFooterBar(c, w, 0, footerH, opts);
  return bar;
}
