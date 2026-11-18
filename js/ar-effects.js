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
  faces: [],
  lastSeenAt: 0,
  statusElCache: new WeakMap(),
  allowShadow: true,
};

function setArShadow(c, color, blur) {
  if (!AR.allowShadow) return;
  c.shadowColor = color;
  c.shadowBlur = blur;
}

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
        numFaces: 3,
        minFaceDetectionConfidence: 0.45,
        minFacePresenceConfidence: 0.45,
        minTrackingConfidence: 0.45,
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

function poseCenter(pose) {
  return {
    x: (pose.leftEye.x + pose.rightEye.x) * 0.5,
    y: (pose.leftEye.y + pose.rightEye.y) * 0.5,
  };
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
    const list = (res && Array.isArray(res.faceLandmarks) ? res.faceLandmarks : []).slice(0, 3);
    const nextPoses = [];
    for (const lm of list) {
      const p = extractFacePose(lm);
      if (p) nextPoses.push(p);
    }

    if (nextPoses.length) {
      const usedPrev = new Set();
      const updated = [];
      for (const np of nextPoses) {
        const nc = poseCenter(np);
        let bestIdx = -1;
        let bestDist = 0.28;
        for (let i = 0; i < AR.faces.length; i++) {
          if (usedPrev.has(i)) continue;
          const prev = AR.faces[i];
          const d = Math.hypot(nc.x - prev.cx, nc.y - prev.cy);
          if (d < bestDist) {
            bestDist = d;
            bestIdx = i;
          }
        }
        if (bestIdx >= 0) {
          usedPrev.add(bestIdx);
          const sm = smoothFacePose(AR.faces[bestIdx].pose, np, 0.54);
          const sc = poseCenter(sm);
          updated.push({ pose: sm, cx: sc.x, cy: sc.y, seenAt: now });
        } else {
          updated.push({ pose: np, cx: nc.x, cy: nc.y, seenAt: now });
        }
      }
      // Keep recently lost tracked faces briefly (up to 3 total) to avoid flicker
      for (let i = 0; i < AR.faces.length && updated.length < 3; i++) {
        if (!usedPrev.has(i) && now - AR.faces[i].seenAt <= 320) {
          updated.push(AR.faces[i]);
        }
      }
      AR.faces = updated;
      AR.face = updated[0]?.pose || null;
      AR.lastSeenAt = now;
    } else {
      AR.faces = AR.faces.filter((f) => now - f.seenAt <= 350);
      AR.face = AR.faces[0]?.pose || null;
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
  c.moveTo(cx, cy + size * 0.52);
  c.bezierCurveTo(cx - size * 0.66, cy + size * 0.14, cx - size * 0.72, cy - size * 0.34, cx - size * 0.38, cy - size * 0.56);
  c.bezierCurveTo(cx - size * 0.18, cy - size * 0.7, cx - size * 0.03, cy - size * 0.52, cx, cy - size * 0.3);
  c.bezierCurveTo(cx + size * 0.03, cy - size * 0.52, cx + size * 0.18, cy - size * 0.7, cx + size * 0.38, cy - size * 0.56);
  c.bezierCurveTo(cx + size * 0.72, cy - size * 0.34, cx + size * 0.66, cy + size * 0.14, cx, cy + size * 0.52);
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
  const cy = m.forehead.y - m.ed * 0.7;
  const rx = m.ed * 1.12;
  const ry = m.ed * 0.27;

  // Faint dotted dizzy ring
  c.save();
  c.strokeStyle = 'rgba(170, 225, 255, 0.32)';
  c.lineWidth = Math.max(1, m.ed * 0.028);
  c.setLineDash([m.ed * 0.08, m.ed * 0.09]);
  c.beginPath();
  c.ellipse(0, cy, rx, ry, 0, 0, Math.PI * 2);
  c.stroke();
  c.restore();

  const items = [];
  for (let i = 0; i < 3; i++) {
    const a = t * 2.75 + (i * Math.PI * 2) / 3;
    items.push({ kind: 'bird', a, bx: Math.cos(a) * rx, by: cy + Math.sin(a) * ry, depth: Math.sin(a), dir: -Math.sin(a) >= 0 ? 1 : -1 });
    const sa = a + Math.PI / 3;
    items.push({ kind: 'star', a: sa, bx: Math.cos(sa) * rx * 0.92, by: cy + Math.sin(sa) * ry * 0.9, depth: Math.sin(sa) });
  }
  items.sort((p, q) => p.depth - q.depth);

  for (const it of items) {
    const scale = (0.76 + (it.depth + 1) * 0.16) * (m.ed / 54);
    c.save();
    c.translate(it.bx, it.by);
    c.scale(scale, scale);
    if (it.kind === 'star') {
      drawStar(c, 0, 0, 8, 2.8, 4, t * 2.6 + it.a);
      c.fillStyle = '#fff5ad';
      setArShadow(c, 'rgba(165, 225, 255, 0.75)', 7);
      c.fill();
    } else {
      c.scale(it.dir, 1);
      const flap = Math.sin(t * 17 + it.a * 2);
      // Far swept wing
      c.fillStyle = '#1b6be0';
      c.beginPath();
      c.moveTo(-2, -1);
      c.quadraticCurveTo(-5, -10 + flap * 5, -13, -7 + flap * 7);
      c.quadraticCurveTo(-6, -2 + flap * 2, 1, 0);
      c.closePath();
      c.fill();

      // Slender forked bluebird tail
      c.fillStyle = '#195ec7';
      c.beginPath();
      c.moveTo(-8, -0.5);
      c.lineTo(-17.5, -4);
      c.lineTo(-13.5, 0.5);
      c.lineTo(-17, 3.2);
      c.lineTo(-8, 1.8);
      c.closePath();
      c.fill();

      // Slim streamlined blue body
      const bg = c.createLinearGradient(0, -5, 0, 5);
      bg.addColorStop(0, '#72d2ff');
      bg.addColorStop(0.55, '#2b8ef7');
      bg.addColorStop(1, '#195ec7');
      c.fillStyle = bg;
      c.beginPath();
      c.ellipse(0, 0.4, 9.8, 4.1, -0.1, 0, Math.PI * 2);
      c.fill();

      // Pale sky underbelly highlight
      c.fillStyle = 'rgba(225, 246, 255, 0.78)';
      c.beginPath();
      c.ellipse(1.5, 2.3, 5.4, 1.6, -0.05, 0, Math.PI * 2);
      c.fill();

      // Small sleek head
      c.fillStyle = '#38a3ff';
      c.beginPath();
      c.arc(7.8, -1.8, 3.7, 0, Math.PI * 2);
      c.fill();

      // Slim pointed orange beak
      c.fillStyle = '#ff9f1a';
      c.beginPath();
      c.moveTo(10.8, -2.5);
      c.lineTo(15.6, -1.3);
      c.lineTo(10.8, -0.2);
      c.closePath();
      c.fill();

      // Near swept flapping wing
      c.fillStyle = '#6ad0ff';
      c.beginPath();
      c.moveTo(-1, -0.5);
      c.quadraticCurveTo(-2, -11 - flap * 6, -12, -8.5 - flap * 7.5);
      c.quadraticCurveTo(-5, -2.5 - flap * 2, 2.5, 0.4);
      c.closePath();
      c.fill();

      // Crisp eye
      c.fillStyle = '#111622';
      c.beginPath(); c.arc(8.9, -2.3, 1.15, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff';
      c.beginPath(); c.arc(9.2, -2.6, 0.4, 0, Math.PI * 2); c.fill();
    }
    c.restore();
  }
}

function drawLovestruck(c, m, t) {
  // Mac-inspired translucent symmetric hearts floating gently above & around crown
  const baseY = m.forehead.y - m.ed * 0.24;
  const slots = AR.allowShadow ? 14 : 6;
  for (let i = 0; i < slots; i++) {
    const speed = 0.40 + (i % 4) * 0.055;
    const phase = (t * speed + i / slots) % 1;
    const grow = 0.25 + 0.78 * (1 - Math.pow(1 - phase, 2.0));
    const fadeIn = Math.min(1, phase / 0.16);
    const fadeOut = phase > 0.58 ? Math.max(0, 1 - (phase - 0.58) / 0.42) : 1;
    const alpha = fadeIn * fadeOut * 0.64; // slightly translucent like macOS Photo Booth
    if (alpha <= 0.02) continue;

    const seed = Math.sin(i * 12.9898 + 4.1414) * 43758.5453;
    const rand = seed - Math.floor(seed);
    const laneX = (rand * 2 - 1) * m.ed * 1.24;
    const sway = Math.sin(t * 1.9 + i * 1.6) * m.ed * 0.07;
    const hx = laneX + sway;
    const hy = baseY - phase * m.ed * (1.3 + (i % 3) * 0.2);
    const sz = m.ed * (0.24 + (i % 3) * 0.07) * grow;
    const tilt = Math.sin(t * 1.5 + i) * 0.09; // consistent upright gentle sway

    c.save();
    c.globalAlpha = alpha;
    c.translate(hx, hy);
    c.rotate(tilt);
    drawHeartPath(c, 0, 0, sz);
    const hg = c.createLinearGradient(0, -sz * 0.55, 0, sz * 0.5);
    hg.addColorStop(0, '#ff6b98');
    hg.addColorStop(1, '#e62e6b');
    setArShadow(c, 'rgba(230, 46, 107, 0.28)', m.ed * 0.06);
    c.fillStyle = hg;
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(255, 255, 255, 0.36)';
    c.beginPath();
    c.ellipse(-sz * 0.22, -sz * 0.22, sz * 0.11, sz * 0.06, -0.5, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

function drawBunnyEars(c, m, t) {
  // Bunny Ears only (no blush cheeks, no nose)
  const wiggle = Math.sin(t * 2.4) * 0.04;
  const earBaseY = m.forehead.y - m.ed * 0.3;
  [-1, 1].forEach((side) => {
    c.save();
    c.translate(side * m.ed * 0.56, earBaseY);
    c.rotate(side * (0.16 + wiggle));
    const ew = m.ed * 0.38, eh = m.ed * 1.35;
    setArShadow(c, 'rgba(0,0,0,0.28)', m.ed * 0.16);
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
  // Exact Snapchat Puppy Dog style (folded caramel + pink inner ears, spotted tan snout pad, glossy brown nose; tongue on open mouth)
  const earBounce = Math.sin(t * 2.5) * 0.025;
  [-1, 1].forEach((side) => {
    const anchorX = side * m.ed * 0.84;
    const anchorY = m.forehead.y - m.ed * 0.30;
    const s = m.ed * 0.92;
    c.save();
    c.translate(anchorX, anchorY);
    c.rotate(side * (0.56 + earBounce));
    c.scale(side, 1);
    setArShadow(c, 'rgba(38, 18, 6, 0.32)', m.ed * 0.14);

    // 1) Pink inner ear triangle sitting flush against upper forehead diagonal
    const pg = c.createLinearGradient(0, -s * 0.95, 0, s * 0.05);
    pg.addColorStop(0, '#f0b6b7');
    pg.addColorStop(1, '#c97e80');
    c.fillStyle = pg;
    c.beginPath();
    c.moveTo(-s * 0.44, 0);
    c.quadraticCurveTo(-s * 0.24, -s * 0.72, -s * 0.02, -s * 0.98);
    c.quadraticCurveTo(s * 0.22, -s * 0.60, s * 0.44, 0);
    c.closePath();
    c.fill();

    // Inner furry brown rim on forehead-facing edge
    c.shadowBlur = 0;
    const rimG = c.createLinearGradient(-s * 0.48, 0, -s * 0.02, -s * 0.98);
    rimG.addColorStop(0, '#784c24');
    rimG.addColorStop(1, '#a5723e');
    c.fillStyle = rimG;
    c.beginPath();
    c.moveTo(-s * 0.48, 0);
    c.quadraticCurveTo(-s * 0.32, -s * 0.68, -s * 0.02, -s * 1.02);
    c.quadraticCurveTo(s * 0.06, -s * 0.96, s * 0.04, -s * 0.72);
    c.quadraticCurveTo(-s * 0.20, -s * 0.42, -s * 0.32, 0);
    c.closePath();
    c.fill();

    // 2) Folded caramel-brown floppy outer ear lobe arching over peak & drooping outward
    setArShadow(c, 'rgba(28, 12, 4, 0.36)', m.ed * 0.10);
    const fg = c.createLinearGradient(-s * 0.06, -s * 1.08, s * 0.92, s * 0.36);
    fg.addColorStop(0, '#ad7842');
    fg.addColorStop(0.55, '#86572b');
    fg.addColorStop(1, '#613b19');
    c.fillStyle = fg;
    c.beginPath();
    c.moveTo(-s * 0.04, -s * 0.96);
    c.bezierCurveTo(s * 0.14, -s * 1.18, s * 0.56, -s * 0.96, s * 0.86, -s * 0.48);
    c.bezierCurveTo(s * 1.12, -s * 0.06, s * 1.02, s * 0.36, s * 0.64, s * 0.40);
    c.bezierCurveTo(s * 0.34, s * 0.42, s * 0.18, s * 0.12, s * 0.12, -s * 0.36);
    c.bezierCurveTo(s * 0.08, -s * 0.66, s * 0.04, -s * 0.84, -s * 0.04, -s * 0.96);
    c.closePath();
    c.fill();

    // Soft fold highlight & deep crease along fold edge
    c.shadowBlur = 0;
    c.fillStyle = 'rgba(242, 200, 148, 0.24)';
    c.beginPath();
    c.ellipse(s * 0.48, -s * 0.42, s * 0.26, s * 0.40, -0.58, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(42, 20, 6, 0.36)';
    c.lineWidth = Math.max(1.2, m.ed * 0.028);
    c.beginPath();
    c.moveTo(s * 0.02, -s * 0.88);
    c.quadraticCurveTo(s * 0.12, -s * 0.35, s * 0.24, s * 0.10);
    c.stroke();
    c.restore();
  });

  // Animated pink tongue appears smoothly when mouth opens (clean snout-only at rest matching reference)
  const mouthGap = Math.max(0, m.lipBot.y - m.lipTop.y);
  const openRatio = Math.max(0, Math.min(1, (mouthGap - m.ed * 0.13) / (m.ed * 0.24)));
  if (openRatio > 0.04) {
    const pant = Math.sin(t * 11) * m.ed * 0.028 * openRatio;
    const tongueW = m.ed * (0.22 + openRatio * 0.06);
    const tongueLen = m.ed * (0.18 + openRatio * 0.42) + pant;
    const tx = m.mouth.x;
    const ty = m.lipTop.y * 0.35 + m.lipBot.y * 0.65;

    c.save();
    c.globalAlpha = Math.min(1, openRatio * 1.25);
    setArShadow(c, 'rgba(60, 10, 25, 0.28)', m.ed * 0.1);
    const tg = c.createLinearGradient(tx, ty, tx, ty + tongueLen);
    tg.addColorStop(0, '#e84a76');
    tg.addColorStop(0.4, '#ff749c');
    tg.addColorStop(1, '#ff9ebb');
    c.fillStyle = tg;
    c.beginPath();
    c.moveTo(tx - tongueW, ty);
    c.quadraticCurveTo(tx, ty - m.ed * 0.03, tx + tongueW, ty);
    c.bezierCurveTo(tx + tongueW * 1.12, ty + tongueLen * 1.05, tx - tongueW * 1.12, ty + tongueLen * 1.05, tx - tongueW, ty);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(150, 26, 62, 0.42)';
    c.lineWidth = Math.max(1.2, m.ed * 0.026);
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(tx, ty + tongueLen * 0.14);
    c.lineTo(tx, ty + tongueLen * 0.72);
    c.stroke();
    c.restore();
  }

  // Tan spotted dog snout / muzzle pad (matching reference)
  const snX = m.nose.x;
  const snY = m.nose.y + m.ed * 0.08;
  const mw = m.ed * 0.64;
  const mh = m.ed * 0.32;

  c.save();
  c.translate(snX, snY);
  setArShadow(c, 'rgba(35, 16, 4, 0.28)', m.ed * 0.10);
  const mg = c.createRadialGradient(0, -mh * 0.15, m.ed * 0.06, 0, mh * 0.1, mw * 1.05);
  mg.addColorStop(0, '#e6be91');
  mg.addColorStop(0.55, '#c7925b');
  mg.addColorStop(1, '#8c5a2e');
  c.fillStyle = mg;
  c.beginPath();
  c.moveTo(0, -mh * 0.92);
  c.bezierCurveTo(mw * 0.56, -mh * 0.92, mw * 1.04, -mh * 0.28, mw, mh * 0.42);
  c.bezierCurveTo(mw * 0.96, mh * 0.94, mw * 0.44, mh * 1.02, 0, mh * 0.68);
  c.bezierCurveTo(-mw * 0.44, mh * 1.02, -mw * 0.96, mh * 0.94, -mw, mh * 0.42);
  c.bezierCurveTo(-mw * 1.04, -mh * 0.28, -mw * 0.56, -mh * 0.92, 0, -mh * 0.92);
  c.closePath();
  c.fill();

  // Soft cheek highlights + whisker freckle spots on both snout pads
  c.shadowBlur = 0;
  [-1, 1].forEach((side) => {
    c.fillStyle = 'rgba(255, 232, 204, 0.24)';
    c.beginPath();
    c.ellipse(side * mw * 0.46, mh * 0.22, mw * 0.28, mh * 0.36, side * 0.18, 0, Math.PI * 2);
    c.fill();

    c.fillStyle = 'rgba(64, 34, 14, 0.55)';
    [
      [0.44, 0.12, 0.032],
      [0.58, 0.02, 0.026],
      [0.64, 0.24, 0.030],
      [0.48, 0.34, 0.028],
      [0.74, 0.14, 0.024],
      [0.72, 0.40, 0.026],
      [0.34, 0.28, 0.022],
    ].forEach(([fx, fy, fr]) => {
      c.beginPath();
      c.arc(side * mw * fx, mh * fy, m.ed * fr, 0, Math.PI * 2);
      c.fill();
    });
  });

  // Subtle vertical philtrum line below nose center
  c.strokeStyle = 'rgba(58, 28, 10, 0.50)';
  c.lineWidth = Math.max(1.1, m.ed * 0.024);
  c.beginPath();
  c.moveTo(0, mh * 0.32);
  c.lineTo(0, mh * 0.66);
  c.stroke();

  // Glossy brown dog nose centered on upper snout
  const nw = m.ed * 0.31, nh = m.ed * 0.22;
  c.translate(0, -mh * 0.28);
  setArShadow(c, 'rgba(20, 8, 2, 0.36)', m.ed * 0.09);
  const ng = c.createRadialGradient(-nw * 0.1, -nh * 0.38, m.ed * 0.02, 0, 0, nw * 1.15);
  ng.addColorStop(0, '#96654d');
  ng.addColorStop(0.42, '#5a3120');
  ng.addColorStop(1, '#261109');
  c.fillStyle = ng;
  c.beginPath();
  c.moveTo(0, nh * 0.96);
  c.bezierCurveTo(-nw * 0.68, nh * 0.86, -nw * 1.06, -nh * 0.08, -nw * 0.72, -nh * 0.64);
  c.bezierCurveTo(-nw * 0.38, -nh * 0.96, nw * 0.38, -nh * 0.96, nw * 0.72, -nh * 0.64);
  c.bezierCurveTo(nw * 1.06, -nh * 0.08, nw * 0.68, nh * 0.86, 0, nh * 0.96);
  c.closePath();
  c.fill();

  // Dark nostrils & luminous top bridge highlight
  c.shadowBlur = 0;
  c.fillStyle = '#150703';
  [-1, 1].forEach((side) => {
    c.beginPath();
    c.ellipse(side * nw * 0.42, nh * 0.12, nw * 0.17, nh * 0.24, side * 0.46, 0, Math.PI * 2);
    c.fill();
  });
  c.fillStyle = 'rgba(255, 244, 238, 0.52)';
  c.beginPath();
  c.ellipse(0, -nh * 0.42, nw * 0.38, nh * 0.20, 0, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255, 255, 255, 0.55)';
  c.beginPath();
  c.ellipse(-nw * 0.08, -nh * 0.46, nw * 0.16, nh * 0.09, -0.1, 0, Math.PI * 2);
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

  setArShadow(c, 'rgba(0,0,0,0.42)', m.ed * 0.25);
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
  // Elegant sculpted feline ears with soft rose-champagne inner ear
  const earY = m.forehead.y - m.ed * 0.06;
  [-1, 1].forEach((side) => {
    c.save();
    c.translate(side * m.ed * 0.68, earY);
    c.rotate(side * 0.28);
    const s = m.ed * 0.56;
    setArShadow(c, 'rgba(0,0,0,0.28)', m.ed * 0.12);
    const eg = c.createLinearGradient(0, -s * 1.2, 0, 0);
    eg.addColorStop(0, '#36303d');
    eg.addColorStop(1, '#18151d');
    c.fillStyle = eg;
    c.beginPath();
    c.moveTo(-s * 0.58, 0);
    c.bezierCurveTo(-s * 0.44, -s * 0.72, -s * 0.12, -s * 1.24, side * s * 0.04, -s * 1.28);
    c.bezierCurveTo(s * 0.22, -s * 1.08, s * 0.52, -s * 0.58, s * 0.58, 0);
    c.closePath();
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = 'rgba(235, 200, 185, 0.35)';
    c.lineWidth = Math.max(1, m.ed * 0.02);
    c.stroke();

    const ig = c.createLinearGradient(0, -s * 0.9, 0, -s * 0.1);
    ig.addColorStop(0, '#f3c1d2');
    ig.addColorStop(1, '#c97b95');
    c.fillStyle = ig;
    c.beginPath();
    c.moveTo(-s * 0.28, -s * 0.1);
    c.quadraticCurveTo(0, -s * 0.95, s * 0.02, -s * 0.92);
    c.quadraticCurveTo(s * 0.22, -s * 0.55, s * 0.28, -s * 0.1);
    c.closePath();
    c.fill();
    c.restore();
  });

  // Subtle winged cat-eye eyeliner flicks
  c.save();
  c.strokeStyle = 'rgba(24, 18, 28, 0.85)';
  c.lineCap = 'round';
  c.lineWidth = Math.max(1.4, m.ed * 0.036);
  [-1, 1].forEach((side) => {
    const ex = side * m.ed * 0.56;
    c.beginPath();
    c.moveTo(ex - side * m.ed * 0.14, m.ed * 0.01);
    c.quadraticCurveTo(ex + side * m.ed * 0.06, -m.ed * 0.02, ex + side * m.ed * 0.18, -m.ed * 0.11);
    c.stroke();
  });
  c.restore();

  // Delicate minimal rose-petal nose
  c.save();
  const nw = m.ed * 0.105, nh = m.ed * 0.072;
  c.translate(m.nose.x, m.nose.y);
  const ng = c.createLinearGradient(0, -nh, 0, nh);
  ng.addColorStop(0, '#f4a4be');
  ng.addColorStop(1, '#d6688d');
  c.fillStyle = ng;
  c.beginPath();
  c.moveTo(0, nh);
  c.bezierCurveTo(-nw, nh * 0.2, -nw * 1.1, -nh * 0.8, 0, -nh * 0.55);
  c.bezierCurveTo(nw * 1.1, -nh * 0.8, nw, nh * 0.2, 0, nh);
  c.closePath();
  c.fill();
  c.restore();

  // Fine silky tapered whiskers
  c.save();
  c.strokeStyle = 'rgba(255, 246, 242, 0.58)';
  c.lineWidth = Math.max(1, m.ed * 0.022);
  c.lineCap = 'round';
  [-1, 1].forEach((side) => {
    const bx = m.nose.x + side * m.ed * 0.42;
    const by = m.nose.y + m.ed * 0.06;
    [-0.18, 0.04, 0.24].forEach((ang, idx) => {
      const len = m.ed * (idx === 1 ? 0.68 : 0.58);
      c.beginPath();
      c.moveTo(bx, by + (idx - 1) * m.ed * 0.065);
      c.quadraticCurveTo(
        bx + side * len * 0.52,
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
  setArShadow(c, 'rgba(0,0,0,0.42)', m.ed * 0.18);

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
  setArShadow(c, 'rgba(0,0,0,0.45)', m.ed * 0.22);

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

  const faces = AR.faces && AR.faces.length
    ? AR.faces.map((f) => f.pose)
    : (AR.face ? [AR.face] : []);

  if (!faces.length) {
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
        : (AR.state === 'ready' ? 'Center face in frame' : 'Loading Face AR…');
      c.fillText(txt, x + w / 2, py + pillH / 2, pillW - 16);
      c.restore();
    }
    return;
  }

  const t = (performance.now() - T0) / 1000;
  const prevShadow = AR.allowShadow;
  AR.allowShadow = !isTile;

  c.save();
  c.beginPath();
  c.rect(x, y, w, h);
  c.clip();

  try {
    for (const face of faces) {
      const m = getHeadMetrics(face, x, y, w, h);
      c.save();
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
  } finally {
    AR.allowShadow = prevShadow;
    c.restore();
  }
}
