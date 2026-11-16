'use strict';

/* ---------------- Self-Hosted Lazy Face AR Engine (MediaPipe Face Landmarker) ---------------- */
const AR = {
  state: 'idle', // 'idle' | 'loading' | 'ready' | 'error'
  errorMsg: '',
  landmarker: null,
  initPromise: null,
  lastVideoTime: -1,
  lastInferAt: 0,
  face: null,
  lastSeenAt: 0,
  statusElCache: new WeakMap(),
};

const AR_ASSETS_BASE = new URL('assets/ar/', location.href).href;

function isArWindowActive(w) {
  if (!w || w.minimized || w.closing) return false;
  return (w.effect && w.effect.fx >= 100) || (w.effectsOpen && w.fxPage === 3);
}

function isArNeeded() {
  return windows.some(isArWindowActive);
}

async function initArEngine() {
  if (AR.state === 'ready') return true;
  if (AR.initPromise) return AR.initPromise;
  AR.state = 'loading';
  AR.errorMsg = '';

  AR.initPromise = (async () => {
    try {
      const vision = await import(`${AR_ASSETS_BASE}vision_bundle.mjs`);
      const { FilesetResolver, FaceLandmarker } = vision;
      const fileset = await FilesetResolver.forVisionTasks(`${AR_ASSETS_BASE}wasm`);
      const modelUrl = `${AR_ASSETS_BASE}face_landmarker.task`;
      const baseOpts = {
        runningMode: 'VIDEO',
        numFaces: 1,
        minFaceDetectionConfidence: 0.48,
        minFacePresenceConfidence: 0.48,
        minTrackingConfidence: 0.48,
      };
      try {
        AR.landmarker = await FaceLandmarker.createFromOptions(fileset, {
          ...baseOpts,
          baseOptions: { modelAssetPath: modelUrl, delegate: 'GPU' },
        });
      } catch (_) {
        AR.landmarker = await FaceLandmarker.createFromOptions(fileset, {
          ...baseOpts,
          baseOptions: { modelAssetPath: modelUrl, delegate: 'CPU' },
        });
      }
      AR.state = 'ready';
      return true;
    } catch (err) {
      console.warn('AR engine failed to initialize:', err);
      AR.state = 'error';
      AR.errorMsg = 'Face AR unavailable on this browser.';
      return false;
    }
  })();

  return AR.initPromise;
}

function mirrorLandmarkAvg(lm, indices) {
  let sx = 0, sy = 0, n = 0;
  for (const idx of indices) {
    const p = lm[idx];
    if (!p) continue;
    sx += 1 - p.x; // mirror X to match mirrored camera stage
    sy += p.y;
    n += 1;
  }
  return n ? { x: sx / n, y: sy / n } : null;
}

const AR_FACE_OVAL_IDX = [
  10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
  397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

function extractFacePose(lm) {
  const eA = mirrorLandmarkAvg(lm, [33, 133, 159, 145]);
  const eB = mirrorLandmarkAvg(lm, [362, 263, 386, 374]);
  if (!eA || !eB) return null;
  const leftEye = eA.x <= eB.x ? eA : eB;
  const rightEye = eA.x <= eB.x ? eB : eA;

  const noseTip = mirrorLandmarkAvg(lm, [1]) || mirrorLandmarkAvg(lm, [4]);
  const forehead = mirrorLandmarkAvg(lm, [10]);
  const chin = mirrorLandmarkAvg(lm, [152]);
  const lipTop = mirrorLandmarkAvg(lm, [13]);
  const lipBot = mirrorLandmarkAvg(lm, [14]);
  const mA = mirrorLandmarkAvg(lm, [61]);
  const mB = mirrorLandmarkAvg(lm, [291]);
  const tA = mirrorLandmarkAvg(lm, [127]);
  const tB = mirrorLandmarkAvg(lm, [356]);
  const cA = mirrorLandmarkAvg(lm, [205]);
  const cB = mirrorLandmarkAvg(lm, [425]);

  if (!noseTip || !forehead || !chin || !lipTop || !lipBot || !mA || !mB || !tA || !tB) return null;

  const leftMouth = mA.x <= mB.x ? mA : mB;
  const rightMouth = mA.x <= mB.x ? mB : mA;
  const leftTemple = tA.x <= tB.x ? tA : tB;
  const rightTemple = tA.x <= tB.x ? tB : tA;
  const leftCheek = cA && cB ? (cA.x <= cB.x ? cA : cB) : leftTemple;
  const rightCheek = cA && cB ? (cA.x <= cB.x ? cB : cA) : rightTemple;

  const oval = [];
  for (const idx of AR_FACE_OVAL_IDX) {
    const p = lm[idx];
    if (p) oval.push({ x: 1 - p.x, y: p.y });
  }

  return {
    leftEye, rightEye, noseTip, forehead, chin,
    mouthCenter: { x: (lipTop.x + lipBot.x) * 0.5, y: (lipTop.y + lipBot.y) * 0.5 },
    lipTop, lipBot, leftMouth, rightMouth,
    leftTemple, rightTemple, leftCheek, rightCheek, oval,
  };
}

function lerpPt(a, b, t) {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function smoothFacePose(prev, next, alpha = 0.5) {
  if (!prev) return next;
  const out = {};
  for (const k of Object.keys(next)) {
    if (k === 'oval') {
      out.oval = next.oval.map((pt, i) => (prev.oval && prev.oval[i] ? lerpPt(prev.oval[i], pt, alpha) : pt));
    } else {
      out[k] = prev[k] ? lerpPt(prev[k], next[k], alpha) : next[k];
    }
  }
  return out;
}

function tickArDetection(now) {
  if (!isArNeeded()) return;
  if (AR.state === 'idle') {
    initArEngine();
    return;
  }
  if (AR.state !== 'ready' || !AR.landmarker) return;
  if (video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;

  const minGap = isIdleMode ? 120 : 28;
  if (now - AR.lastInferAt < minGap) return;
  if (video.currentTime === AR.lastVideoTime && now - AR.lastInferAt < 180) return;

  AR.lastInferAt = now;
  AR.lastVideoTime = video.currentTime;

  try {
    const res = AR.landmarker.detectForVideo(video, now);
    const lm = res && res.faceLandmarks && res.faceLandmarks[0];
    const next = lm ? extractFacePose(lm) : null;
    if (next) {
      AR.face = smoothFacePose(AR.face, next, 0.52);
      AR.lastSeenAt = now;
    } else if (now - AR.lastSeenAt > 350) {
      AR.face = null;
    }
  } catch (_) { /* ignore transient video frame mismatch */ }
}

/* ---------------- AR Head Geometry Helpers & Vector Illustrators ---------------- */
function getHeadMetrics(face, x, y, w, h) {
  const px = (pt) => ({ x: x + pt.x * w, y: y + pt.y * h });
  const L = px(face.leftEye);
  const R = px(face.rightEye);
  const cx = (L.x + R.x) * 0.5;
  const cy = (L.y + R.y) * 0.5;
  const ed = Math.max(12, Math.hypot(R.x - L.x, R.y - L.y));
  const roll = Math.atan2(R.y - L.y, R.x - L.x);
  const cos = Math.cos(-roll), sin = Math.sin(-roll);
  const toLocal = (pt) => {
    const p = px(pt);
    const dx = p.x - cx, dy = p.y - cy;
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
  };
  return {
    L, R, cx, cy, ed, roll, px, toLocal,
    forehead: toLocal(face.forehead),
    chin: toLocal(face.chin),
    nose: toLocal(face.noseTip),
    mouth: toLocal(face.mouthCenter),
    lipTop: toLocal(face.lipTop),
    lipBot: toLocal(face.lipBot),
    leftMouth: toLocal(face.leftMouth),
    rightMouth: toLocal(face.rightMouth),
    leftTemple: toLocal(face.leftTemple),
    rightTemple: toLocal(face.rightTemple),
    leftCheek: toLocal(face.leftCheek),
    rightCheek: toLocal(face.rightCheek),
  };
}

function drawHeartPath(c, cx, cy, size) {
  c.beginPath();
  c.moveTo(cx, cy + size * 0.35);
  c.bezierCurveTo(cx - size * 0.65, cy - size * 0.1, cx - size * 0.6, cy - size * 0.72, cx, cy - size * 0.3);
  c.bezierCurveTo(cx + size * 0.6, cy - size * 0.72, cx + size * 0.65, cy - size * 0.1, cx, cy + size * 0.35);
  c.closePath();
}

function drawStar(c, cx, cy, rOuter, rInner, pts = 4, rot = 0) {
  c.beginPath();
  for (let i = 0; i < pts * 2; i++) {
    const rad = i % 2 === 0 ? rOuter : rInner;
    const a = rot + (i * Math.PI) / pts;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    if (i === 0) c.moveTo(px, py);
    else c.lineTo(px, py);
  }
  c.closePath();
}

function drawDizzyBirds(c, m, t) {
  const cy = m.forehead.y - m.ed * 0.72;
  const rx = m.ed * 1.12;
  const ry = m.ed * 0.28;

  // Faint dotted dizzy ring
  c.save();
  c.strokeStyle = 'rgba(255, 240, 140, 0.35)';
  c.lineWidth = Math.max(1, m.ed * 0.03);
  c.setLineDash([m.ed * 0.08, m.ed * 0.09]);
  c.beginPath();
  c.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();

  const items = [];
  for (let i = 0; i < 3; i++) {
    const a = t * 2.8 + (i * Math.PI * 2) / 3;
    items.push({ kind: 'bird', a, bx: Math.cos(a) * rx, by: cy + Math.sin(a) * ry, depth: Math.sin(a), dir: -Math.sin(a) >= 0 ? 1 : -1 });
    const sa = a + Math.PI / 3;
    items.push({ kind: 'star', a: sa, bx: Math.cos(sa) * rx * 0.92, by: cy + Math.sin(sa) * ry * 0.9, depth: Math.sin(sa) });
  }
  items.sort((p, q) => p.depth - q.depth);

  for (const it of items) {
    const scale = (0.78 + (it.depth + 1) * 0.16) * (m.ed / 54);
    c.save();
    c.translate(it.bx, it.by);
    c.scale(scale, scale);
    if (it.kind === 'star') {
      drawStar(c, 0, 0, 9, 3.6, 5, t * 3 + it.a);
      c.fillStyle = '#fff3a1';
      c.shadowColor = '#ffd43b';
      c.shadowBlur = 8;
      c.fill();
    } else {
      c.scale(it.dir, 1);
      const flap = Math.sin(t * 16 + it.a * 2) * 8;
      // Wing behind
      c.fillStyle = '#f59f00';
      c.beginPath();
      c.ellipse(-2, -6 + flap * 0.35, 8, 5, -0.5, 0, Math.PI * 2);
      c.fill();
      // Body & head
      c.fillStyle = '#ffd43b';
      c.beginPath();
      c.ellipse(0, 0, 11, 8, 0, 0, Math.PI * 2);
      c.fill();
      // Tail feathers
      c.beginPath();
      c.moveTo(-9, 0); c.lineTo(-17, -4); c.lineTo(-15, 2); c.closePath();
      c.fill();
      // Beak
      c.fillStyle = '#ff6b00';
      c.beginPath();
      c.moveTo(9, -1); c.lineTo(16, 1.5); c.lineTo(9, 4); c.closePath();
      c.fill();
      // Front wing flapping
      c.fillStyle = '#ffe066';
      c.beginPath();
      c.ellipse(-1, -4 - flap * 0.45, 7.5, 4.5, 0.35, 0, Math.PI * 2);
      c.fill();
      // Eye
      c.fillStyle = '#1a1b1f';
      c.beginPath(); c.arc(5, -2.5, 1.8, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}

function drawLovestruck(c, m, t) {
  // Classic macOS Photo Booth Lovestruck: clean eyes/face + lots of hearts above head growing from small and fading away
  const baseY = m.forehead.y - m.ed * 0.25;
  const slots = 16;
  for (let i = 0; i < slots; i++) {
    const speed = 0.42 + (i % 5) * 0.06;
    const phase = (t * speed + i / slots) % 1;
    // Grow from small (0.2) to full (1.08) smoothly
    const grow = 0.2 + 0.88 * (1 - Math.pow(1 - phase, 2.2));
    // Fade in fast, stay bright while expanding, fade out cleanly near top
    const fadeIn = Math.min(1, phase / 0.14);
    const fadeOut = phase > 0.62 ? Math.max(0, 1 - (phase - 0.62) / 0.38) : 1;
    const alpha = fadeIn * fadeOut * 0.94;
    if (alpha <= 0.02) continue;

    // Deterministic spread across & above head crown
    const seed = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
    const rand = seed - Math.floor(seed);
    const laneX = (rand * 2 - 1) * m.ed * 1.32;
    const sway = Math.sin(t * 2.2 + i * 1.7) * m.ed * 0.09;
    const hx = laneX + sway;
    const hy = baseY - phase * m.ed * (1.35 + (i % 3) * 0.22);
    const maxSize = m.ed * (0.24 + (i % 4) * 0.085);
    const sz = maxSize * grow;
    const tilt = Math.sin(t * 1.8 + i) * 0.18 + (rand - 0.5) * 0.22;

    c.save();
    c.globalAlpha = alpha;
    c.translate(hx, hy);
    c.rotate(tilt);
    drawHeartPath(c, 0, 0, sz);
    const hg = c.createLinearGradient(0, -sz * 0.45, 0, sz * 0.35);
    if (i % 3 === 0) {
      hg.addColorStop(0, '#ff85b3');
      hg.addColorStop(1, '#ff2e74');
    } else if (i % 3 === 1) {
      hg.addColorStop(0, '#ff4d6d');
      hg.addColorStop(1, '#c9184a');
    } else {
      hg.addColorStop(0, '#ffa3c7');
      hg.addColorStop(1, '#f72585');
    }
    c.shadowColor = 'rgba(255, 46, 116, 0.36)';
    c.shadowBlur = m.ed * 0.08;
    c.fillStyle = hg;
    c.fill();
    // Crisp glossy highlight
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(255, 255, 255, 0.5)';
    c.beginPath();
    c.ellipse(-sz * 0.2, -sz * 0.2, sz * 0.11, sz * 0.06, -0.5, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

function drawBunnyEars(c, m, t) {
  const wiggle = Math.sin(t * 2.4) * 0.04;
  // Soft rosy cheeks + bunny nose
  for (const ck of [m.leftCheek, m.rightCheek]) {
    const g = c.createRadialGradient(ck.x, ck.y, 0, ck.x, ck.y, m.ed * 0.36);
    g.addColorStop(0, 'rgba(255, 130, 172, 0.42)');
    g.addColorStop(1, 'rgba(255, 130, 172, 0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(ck.x, ck.y, m.ed * 0.36, 0, Math.PI * 2); c.fill();
  }
  c.save();
  c.fillStyle = '#ff7eb3';
  c.beginPath();
  c.ellipse(m.nose.x, m.nose.y, m.ed * 0.13, m.ed * 0.09, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();

  const earBaseY = m.forehead.y - m.ed * 0.3;
  [-1, 1].forEach((side) => {
    c.save();
    c.translate(side * m.ed * 0.56, earBaseY);
    c.rotate(side * (0.16 + wiggle));
    const ew = m.ed * 0.38, eh = m.ed * 1.35;
    c.shadowColor = 'rgba(0,0,0,0.28)';
    c.shadowBlur = m.ed * 0.16;
    const eg = c.createLinearGradient(0, -eh, 0, 0);
    eg.addColorStop(0, '#ffffff');
    eg.addColorStop(1, '#e8ecf4');
    c.fillStyle = eg;
    c.beginPath();
    c.ellipse(0, -eh * 0.52, ew, eh * 0.55, side * 0.08, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
    const pg = c.createLinearGradient(0, -eh * 0.9, 0, -eh * 0.15);
    pg.addColorStop(0, '#ffb3cf');
    pg.addColorStop(1, '#ff77aa');
    c.fillStyle = pg;
    c.beginPath();
    c.ellipse(0, -eh * 0.5, ew * 0.56, eh * 0.42, side * 0.08, 0, Math.PI * 2);
    c.fill();
    c.restore();
  });
}

function drawPuppyDog(c, m, t) {
  // Floppy ears at left & right temples
  const earFlop = Math.sin(t * 2.8) * 0.05;
  [
    { p: m.leftTemple, side: -1 },
    { p: m.rightTemple, side: 1 },
  ].forEach(({ p, side }) => {
    c.save();
    c.translate(p.x - side * m.ed * 0.08, m.forehead.y * 0.45 + p.y * 0.35);
    c.rotate(side * (0.36 + earFlop));
    c.shadowColor = 'rgba(0,0,0,0.34)';
    c.shadowBlur = m.ed * 0.14;
    const g = c.createLinearGradient(0, 0, 0, m.ed * 1.45);
    g.addColorStop(0, '#7c4a26');
    g.addColorStop(1, '#b5723c');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.bezierCurveTo(side * m.ed * 0.72, m.ed * 0.12, side * m.ed * 0.85, m.ed * 1.15, side * m.ed * 0.38, m.ed * 1.42);
    c.bezierCurveTo(side * m.ed * 0.05, m.ed * 1.5, -side * m.ed * 0.18, m.ed * 0.88, 0, 0);
    c.fill();
    c.restore();
  });

  // Panting animated tongue (grows when user opens mouth)
  const mouthGap = Math.max(0, m.lipBot.y - m.lipTop.y);
  const openBoost = Math.min(1, mouthGap / (m.ed * 0.35));
  const pant = Math.sin(t * 11) * m.ed * 0.035;
  const tw = m.ed * 0.26;
  const th = m.ed * (0.42 + openBoost * 0.28) + pant;
  c.save();
  const tx = m.mouth.x;
  const ty = m.lipBot.y - m.ed * 0.02;
  c.shadowColor = 'rgba(0,0,0,0.28)';
  c.shadowBlur = m.ed * 0.1;
  const tg = c.createLinearGradient(tx, ty, tx, ty + th);
  tg.addColorStop(0, '#ff6b8b');
  tg.addColorStop(1, '#ff9ebb');
  c.fillStyle = tg;
  c.beginPath();
  c.moveTo(tx - tw, ty);
  c.lineTo(tx + tw, ty);
  c.bezierCurveTo(tx + tw * 1.08, ty + th * 0.95, tx - tw * 1.08, ty + th * 0.95, tx - tw, ty);
  c.closePath();
  c.fill();
  c.strokeStyle = 'rgba(180, 32, 74, 0.42)';
  c.lineWidth = Math.max(1.2, m.ed * 0.03);
  c.beginPath();
  c.moveTo(tx, ty + th * 0.12);
  c.lineTo(tx, ty + th * 0.74);
  c.stroke();
  c.restore();

  // Shiny puppy nose on noseTip
  c.save();
  const nw = m.ed * 0.3, nh = m.ed * 0.21;
  c.translate(m.nose.x, m.nose.y);
  c.shadowColor = 'rgba(0,0,0,0.34)';
  c.shadowBlur = m.ed * 0.12;
  const ng = c.createLinearGradient(0, -nh, 0, nh);
  ng.addColorStop(0, '#443229');
  ng.addColorStop(1, '#1a120f');
  c.fillStyle = ng;
  c.beginPath();
  c.moveTo(0, nh * 0.95);
  c.bezierCurveTo(-nw * 1.1, nh * 0.2, -nw * 0.95, -nh * 0.9, 0, -nh * 0.75);
  c.bezierCurveTo(nw * 0.95, -nh * 0.9, nw * 1.1, nh * 0.2, 0, nh * 0.95);
  c.closePath();
  c.fill();
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(255,255,255,0.45)';
  c.beginPath();
  c.ellipse(-nw * 0.28, -nh * 0.28, nw * 0.22, nh * 0.14, -0.35, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

function drawPotatoHead(c, face, m, x, y, w, h) {
  const topY = m.forehead.y - m.ed * 0.56;
  const botY = m.chin.y + m.ed * 0.24;
  const midY = (topY + botY) * 0.52;
  const potatoH = Math.max(m.ed * 2.2, botY - topY);
  const topW = Math.max(m.ed * 1.1, Math.abs(m.rightTemple.x - m.leftTemple.x) * 0.58);
  const botW = topW * 1.14;

  // 1. Potato Head silhouette (Mr. Potato lumpy russet contour + cute potato ears)
  c.save();
  // Little side potato ears
  c.fillStyle = '#b47b44';
  [-1, 1].forEach((side) => {
    c.beginPath();
    c.ellipse(side * (topW * 1.04), -m.ed * 0.02, m.ed * 0.18, m.ed * 0.28, side * 0.12, 0, Math.PI * 2);
    c.fill();
  });

  c.shadowColor = 'rgba(0,0,0,0.42)';
  c.shadowBlur = m.ed * 0.25;
  const pg = c.createRadialGradient(-topW * 0.22, topY + potatoH * 0.3, m.ed * 0.2, 0, midY, Math.max(botW, potatoH * 0.65));
  pg.addColorStop(0, '#e0b074');
  pg.addColorStop(0.58, '#b87f44');
  pg.addColorStop(1, '#7e4c21');
  c.fillStyle = pg;

  c.beginPath();
  c.moveTo(0, topY);
  c.bezierCurveTo(topW * 0.92, topY, topW * 1.02, midY - potatoH * 0.16, botW, midY + potatoH * 0.14);
  c.bezierCurveTo(botW * 1.04, botY - potatoH * 0.06, botW * 0.55, botY, 0, botY);
  c.bezierCurveTo(-botW * 0.55, botY, -botW * 1.04, botY - potatoH * 0.06, -botW, midY + potatoH * 0.14);
  c.bezierCurveTo(-topW * 1.02, midY - potatoH * 0.16, -topW * 0.92, topY, 0, topY);
  c.closePath();
  c.fill();

  // Subtle russet skin dimples (outside eye/mouth zones)
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(78, 42, 14, 0.34)';
  [
    [-topW * 0.38, topY + potatoH * 0.16, 0.045],
    [topW * 0.34, topY + potatoH * 0.19, 0.038],
    [-botW * 0.56, m.chin.y - m.ed * 0.18, 0.048],
    [botW * 0.52, m.chin.y - m.ed * 0.12, 0.042],
    [0, topY + potatoH * 0.12, 0.032],
  ].forEach(([sx, sy, sr]) => {
    c.beginPath(); c.arc(sx, sy, m.ed * sr, 0, Math.PI * 2); c.fill();
  });

  // 2. Real Live Eyes & Mouth Cutouts directly from mirrored camera feed!
  const mouthW = Math.max(m.ed * 0.44, (m.rightMouth.x - m.leftMouth.x) * 0.66);
  const mouthH = Math.max(m.ed * 0.28, (m.lipBot.y - m.lipTop.y) * 0.8 + m.ed * 0.22);
  const cutouts = [
    { cx: -m.ed * 0.48, cy: 0, rx: m.ed * 0.29, ry: m.ed * 0.17 },
    { cx: m.ed * 0.48, cy: 0, rx: m.ed * 0.29, ry: m.ed * 0.17 },
    { cx: m.mouth.x, cy: m.mouth.y, rx: mouthW, ry: mouthH },
  ];

  // Recessed shadow rim around each cutout
  c.strokeStyle = 'rgba(72, 38, 12, 0.58)';
  c.lineWidth = Math.max(1.5, m.ed * 0.045);
  for (const co of cutouts) {
    c.beginPath();
    c.ellipse(co.cx, co.cy, co.rx, co.ry, 0, 0, Math.PI * 2);
    c.stroke();
  }

  // Composite mirrored video inside eye + mouth oval cutouts
  c.save();
  c.beginPath();
  for (const co of cutouts) {
    c.moveTo(co.cx + co.rx, co.cy);
    c.ellipse(co.cx, co.cy, co.rx, co.ry, 0, 0, Math.PI * 2);
  }
  c.clip();
  // Undo local head rotation/translation to draw world-space mirrored video aligned pixel-for-pixel
  c.rotate(-m.roll);
  c.translate(-m.cx, -m.cy);
  c.translate(x + w, y);
  c.scale(-1, 1);
  if (video.readyState >= 2) c.drawImage(video, 0, 0, w, h);
  c.restore();
  c.restore();
}

function drawKittyCat(c, m) {
  // Pointed cat ears
  const earY = m.forehead.y - m.ed * 0.04;
  [-1, 1].forEach((side) => {
    c.save();
    c.translate(side * m.ed * 0.72, earY);
    c.rotate(side * 0.34);
    const s = m.ed * 0.62;
    c.shadowColor = 'rgba(0,0,0,0.32)';
    c.shadowBlur = m.ed * 0.14;
    c.fillStyle = '#25262e';
    c.beginPath();
    c.moveTo(-s * 0.65, 0);
    c.quadraticCurveTo(0, -s * 1.45, 0, -s * 1.25);
    c.quadraticCurveTo(s * 0.28, -s * 0.9, s * 0.65, 0);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#ff9ec4';
    c.beginPath();
    c.moveTo(-s * 0.34, -s * 0.12);
    c.lineTo(0, -s * 0.88);
    c.lineTo(s * 0.34, -s * 0.12);
    c.closePath();
    c.fill();
    c.restore();
  });

  // Pink kitty nose
  c.save();
  c.fillStyle = '#ff6fa5';
  const nw = m.ed * 0.16, nh = m.ed * 0.11;
  c.beginPath();
  c.moveTo(m.nose.x, m.nose.y + nh);
  c.lineTo(m.nose.x - nw, m.nose.y - nh * 0.6);
  c.lineTo(m.nose.x + nw, m.nose.y - nh * 0.6);
  c.closePath();
  c.fill();

  // Whiskers
  c.strokeStyle = 'rgba(255, 255, 255, 0.88)';
  c.lineWidth = Math.max(1.2, m.ed * 0.032);
  c.lineCap = 'round';
  c.shadowColor = 'rgba(0,0,0,0.45)';
  c.shadowBlur = 3;
  [-1, 1].forEach((side) => {
    const bx = m.nose.x + side * m.ed * 0.38;
    const by = m.nose.y + m.ed * 0.08;
    [-0.22, 0, 0.24].forEach((ang, idx) => {
      const len = m.ed * (0.72 + (idx === 1 ? 0.1 : 0));
      c.beginPath();
      c.moveTo(bx, by + idx * m.ed * 0.08 - m.ed * 0.08);
      c.quadraticCurveTo(
        bx + side * len * 0.5,
        by + Math.sin(ang) * len * 0.35,
        bx + side * len,
        by + Math.sin(ang) * len
      );
      c.stroke();
    });
  });
  c.restore();
}

function drawRoyalCrown(c, m, t) {
  // Positioned top-right on forehead & tilted slightly ("atas kanan kepala agak mereng")
  c.save();
  c.translate(m.ed * 0.64, m.forehead.y - m.ed * 0.34);
  c.rotate(0.36); // jaunty right-side tilt
  const s = m.ed * 0.85;
  c.shadowColor = 'rgba(0,0,0,0.42)';
  c.shadowBlur = m.ed * 0.18;

  const cg = c.createLinearGradient(-s, -s * 0.8, s, s * 0.2);
  cg.addColorStop(0, '#fff099');
  cg.addColorStop(0.45, '#ffc107');
  cg.addColorStop(1, '#b87400');
  c.fillStyle = cg;

  c.beginPath();
  c.moveTo(-s * 0.72, 0);
  c.lineTo(-s * 0.85, -s * 0.62);
  c.lineTo(-s * 0.38, -s * 0.34);
  c.lineTo(0, -s * 0.86);
  c.lineTo(s * 0.38, -s * 0.34);
  c.lineTo(s * 0.85, -s * 0.62);
  c.lineTo(s * 0.72, 0);
  c.closePath();
  c.fill();

  c.strokeStyle = '#ffdf70';
  c.lineWidth = Math.max(1.2, s * 0.035);
  c.stroke();
  c.shadowBlur = 0;

  // Base band + gems + tip pearls
  c.fillStyle = '#a46400';
  c.fillRect(-s * 0.72, -s * 0.14, s * 1.44, s * 0.14);

  [
    [0, -s * 0.42, s * 0.11, '#ff3b5c'],
    [-s * 0.42, -s * 0.24, s * 0.08, '#0a84ff'],
    [s * 0.42, -s * 0.24, s * 0.08, '#30d158'],
  ].forEach(([gx, gy, gr, col]) => {
    c.fillStyle = col;
    c.beginPath(); c.arc(gx, gy, gr, 0, Math.PI * 2); c.fill();
    c.fillStyle = 'rgba(255,255,255,0.6)';
    c.beginPath(); c.arc(gx - gr * 0.3, gy - gr * 0.3, gr * 0.3, 0, Math.PI * 2); c.fill();
  });

  [
    [-s * 0.85, -s * 0.65],
    [0, -s * 0.9],
    [s * 0.85, -s * 0.65],
  ].forEach(([px, py]) => {
    c.fillStyle = '#fff8cf';
    c.beginPath(); c.arc(px, py, s * 0.075, 0, Math.PI * 2); c.fill();
  });

  // Subtle animated shimmer star on center peak
  const glint = 0.55 + 0.45 * Math.sin(t * 4);
  c.globalAlpha = glint;
  c.fillStyle = '#fff';
  drawStar(c, -s * 0.12, -s * 0.72, s * 0.12, s * 0.03, 4, t);
  c.fill();
  c.restore();
}

function drawCowboyHat(c, m) {
  c.save();
  c.translate(0, m.forehead.y - m.ed * 0.26);
  const w = m.ed * 2.85;
  const h = m.ed * 1.15;
  c.shadowColor = 'rgba(0,0,0,0.45)';
  c.shadowBlur = m.ed * 0.22;

  // Under-brim back shadow
  c.fillStyle = '#3b2110';
  c.beginPath();
  c.ellipse(0, m.ed * 0.06, w * 0.52, m.ed * 0.28, 0, 0, Math.PI * 2);
  c.fill();

  // Western pinched crown
  const cg = c.createLinearGradient(0, -h, 0, 0);
  cg.addColorStop(0, '#9e6234');
  cg.addColorStop(0.65, '#73421e');
  cg.addColorStop(1, '#4f2c12');
  c.fillStyle = cg;
  c.beginPath();
  c.moveTo(-w * 0.27, 0);
  c.bezierCurveTo(-w * 0.26, -h * 0.9, -w * 0.14, -h * 1.02, -w * 0.06, -h * 0.88);
  c.quadraticCurveTo(0, -h * 0.72, w * 0.06, -h * 0.88);
  c.bezierCurveTo(w * 0.14, -h * 1.02, w * 0.26, -h * 0.9, w * 0.27, 0);
  c.closePath();
  c.fill();

  // Leather band & brass buckle
  c.shadowBlur = 0;
  c.fillStyle = '#241409';
  c.fillRect(-w * 0.268, -m.ed * 0.16, w * 0.536, m.ed * 0.18);
  c.strokeStyle = '#d4a64a';
  c.lineWidth = Math.max(1.5, m.ed * 0.045);
  c.strokeRect(-m.ed * 0.14, -m.ed * 0.15, m.ed * 0.28, m.ed * 0.16);

  // Curved rolled front brim
  const bg = c.createLinearGradient(0, -m.ed * 0.14, 0, m.ed * 0.34);
  bg.addColorStop(0, '#8b5329');
  bg.addColorStop(1, '#583115');
  c.fillStyle = bg;
  c.beginPath();
  c.moveTo(-w * 0.55, -m.ed * 0.22);
  c.quadraticCurveTo(0, m.ed * 0.24, w * 0.55, -m.ed * 0.22);
  c.quadraticCurveTo(w * 0.44, m.ed * 0.28, 0, m.ed * 0.26);
  c.quadraticCurveTo(-w * 0.44, m.ed * 0.28, -w * 0.55, -m.ed * 0.22);
  c.closePath();
  c.fill();
  c.restore();
}

function drawArOverlay(c, x, y, w, h, effect, isTile = false) {
  if (!effect || effect.fx < 100) return;

  if (AR.state === 'idle') {
    initArEngine();
  }

  const face = AR.face;
  if (!face) {
    if (!isTile) {
      c.save();
      const pillW = Math.min(w - 24, 178), pillH = 26;
      const px = x + (w - pillW) / 2, py = y + h - pillH - Math.max(12, Math.round(h * 0.04));
      c.fillStyle = 'rgba(20, 21, 26, 0.74)';
      c.beginPath();
      if (c.roundRect) c.roundRect(px, py, pillW, pillH, 13);
      else c.rect(px, py, pillW, pillH);
      c.fill();
      c.strokeStyle = 'rgba(255, 255, 255, 0.14)';
      c.lineWidth = 1;
      c.stroke();
      c.font = '600 11.5px "Inter", -apple-system, BlinkMacSystemFont, sans-serif';
      c.fillStyle = 'rgba(255,255,255,0.92)';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      const txt = AR.state === 'error'
        ? (AR.errorMsg || 'Face AR unavailable')
        : (AR.state === 'ready' ? 'Center your face in frame' : 'Loading Face AR…');
      c.fillText(txt, x + w / 2, py + pillH / 2, pillW - 16);
      c.restore();
    }
    return;
  }

  const t = (performance.now() - T0) / 1000;
  const m = getHeadMetrics(face, x, y, w, h);

  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();
  c.translate(m.cx, m.cy);
  c.rotate(m.roll);

  switch (effect.fx) {
    case 101: drawDizzyBirds(c, m, t); break;
    case 102: drawLovestruck(c, m, t); break;
    case 103: drawBunnyEars(c, m, t); break;
    case 104: drawPuppyDog(c, m, t); break;
    case 105: drawPotatoHead(c, face, m, x, y, w, h); break;
    case 106: drawKittyCat(c, m); break;
    case 107: drawRoyalCrown(c, m, t); break;
    case 108: drawCowboyHat(c, m); break;
  }
  c.restore();
}
