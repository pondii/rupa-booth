'use strict';

/* ------------------------- Window Manager & Dock ------------------------- */
const DEFAULT_TITLE = 'Photo Booth';
const INNER = 10;
const CHROME_H = 100;
const DOCK_RESERVE = 84;
const isPhoneViewport = () => Math.min(innerWidth, innerHeight) <= 540;
const isIpadHardware = () => {
  const ua = navigator.userAgent || '';
  const touchPts = navigator.maxTouchPoints || 0;
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const sMin = Math.min(innerWidth, innerHeight);
  const sMax = Math.max(innerWidth, innerHeight);
  return /iPad/i.test(ua)
    || (navigator.platform === 'MacIntel' && touchPts > 1)
    || (sMin > 540 && sMax <= 1400 && (touchPts > 1 || coarse));
};
const isTabletViewport = () => {
  if (isPhoneViewport()) return false;
  const sMin = Math.min(innerWidth, innerHeight);
  const sMax = Math.max(innerWidth, innerHeight);
  if (isIpadHardware()) return true;
  if (sMin > 540 && sMin <= 1024 && innerHeight > innerWidth) return true;
  return sMin > 540 && sMax <= 1368 && (sMax / sMin) <= 1.54;
};
const isMobilePortrait = () => isPhoneViewport() && innerHeight >= innerWidth;
const isMobileLandscape = () => isPhoneViewport() && innerWidth > innerHeight;
const winPad = () => (isPhoneViewport() ? 6 : (innerWidth <= 640 ? 8 : 16));
const dockReserveNow = () => (isMobileLandscape() ? 52 : (isMobilePortrait() ? 64 : DOCK_RESERVE));
const innerPadNow = () => (isPhoneViewport() ? 6 : INNER);
const chromeHNow = () => (isMobileLandscape() ? 78 : (isMobilePortrait() ? 86 : CHROME_H));
const zoomPad = () => (isPhoneViewport() ? 6 : Math.max(winPad() * 2, Math.round(Math.min(innerWidth, innerHeight) * 0.06)));
const minW = () => Math.min(isPhoneViewport() ? 196 : 280, Math.max(160, innerWidth - winPad() * 2));
const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

function syncMobileBodyClass() {
  const phone = isPhoneViewport();
  document.body.classList.toggle('is-mobile', phone);
  document.body.classList.toggle('is-mobile-land', phone && innerWidth > innerHeight);
  return phone;
}

const utilApps = [];

const stageAR = () => Math.min(cameraAR || 16 / 9, 1.54);
const chromeForW = () => chromeHNow();
const heightForWin = (w, ar = stageAR()) => Math.round(chromeHNow() + (w - innerPadNow() * 2) / ar);

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
  if (typeof updateFillLight === 'function') updateFillLight();
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
  if (typeof updateFillLight === 'function') updateFillLight();
  if (typeof syncCameraHardware === 'function') syncCameraHardware();

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
  const stripBtn = $w('.strip-btn');
  const flashBtn = $w('.flash-btn');
  const effectsBtn = $w('.effects-btn');
  const viewerEl = $w('.viewer');
  const viewerImg = $w('.viewer-img');
  const viewerVideo = $w('.viewer-video');
  const viewerVideoUI = createUnifiedVideoPlayer(viewerVideo, { hostEl: viewerEl, compact: true });
  const dlBtn = $w('.dl-btn');
  const delBtn = $w('.del-btn');
  const viewerCloseBtn = $w('.viewer-close-btn');
  const effectsEl = $w('.effects');
  const countdownEl = $w('.countdown');
  const countdownNumEl = $w('.cd-num');
  const countdownNoteEl = $w('.cd-note');
  const stageToastEl = $w('.stage-toast');
  const recBadgeEl = $w('.rec-badge');
  const recTimeEl = $w('.rec-time');
  const msgEl = $w('.message');
  const libEl = $w('.library');

  const inst = {
    id: seq,
    winKey: `${PAGE_SESSION}:${seq}`,
    el, canvas, ctx, stage,
    mode: opts.mode || 'photo',
    flashOn: Boolean(opts.flashOn),
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
    stripHidden: false,
    title: opts.title || DEFAULT_TITLE,
    boxAR: typeof opts.ar === 'number' ? opts.ar : null,
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

  const arNow = () => ((isPhoneViewport() && inst.boxAR) ? inst.boxAR : stageAR());
  const innerNow = innerPadNow;
  const chromeH = chromeHNow;
  const heightFor = (w) => heightForWin(w, arNow());
  const widthForHeight = (h) => Math.round((h - chromeH()) * arNow() + innerNow() * 2);
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
    const catName = EFFECT_CATEGORIES[pi] || ('Page ' + (pi + 1));
    dot.title = catName;
    dot.setAttribute('aria-label', catName);
    dot.addEventListener('click', () => inst.setFxPage(pi));
    fxDots.appendChild(dot);
  });

  const fxCatPill = el.querySelector('.fx-cat-pill');
  inst.setFxPage = (i, animate = true) => {
    i = Math.max(0, Math.min(PAGES.length - 1, i));
    inst.fxPage = i;
    if (!animate) fxTrack.style.transition = 'none';
    fxTrack.style.transform = `translateX(${-i * 100}%)`;
    if (!animate) { void fxTrack.offsetWidth; fxTrack.style.transition = ''; }
    inst.fxAnimUntil = performance.now() + (animate ? 550 : 0);
    if (fxCatPill) fxCatPill.textContent = EFFECT_CATEGORIES[i] || '';
    [...fxDots.children].forEach((d, k) => d.classList.toggle('on', k === i));
    fxPrev.classList.toggle('off', i === 0);
    fxNext.classList.toggle('off', i === PAGES.length - 1);
    if (i === 3 && typeof initArEngine === 'function') initArEngine();
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
      renderEffect(t.x, 0, 0, tw, th, t.fx, true);
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
  let stageToastTimer = null;
  function showStageToast(text, ms = 1500) {
    if (!stageToastEl) return;
    clearTimeout(stageToastTimer);
    stageToastEl.textContent = text;
    stageToastEl.hidden = false;
    stageToastTimer = setTimeout(() => { stageToastEl.hidden = true; }, ms);
  }

  function syncShutterUI(counting = false) {
    shutter.classList.toggle('counting', counting);
    if (counting) {
      shutter.title = 'Cancel countdown (Space)';
      shutter.setAttribute('aria-label', 'Cancel countdown');
    } else if (inst.recording) {
      shutter.title = 'Stop recording (Space)';
      shutter.setAttribute('aria-label', 'Stop recording');
    } else if (inst.mode === 'video') {
      shutter.title = 'Record video (Space) — Option-click to skip countdown';
      shutter.setAttribute('aria-label', 'Record video');
    } else if (inst.mode === '4up') {
      shutter.title = 'Take 4-up photos (Space) — Option-click to skip countdown';
      shutter.setAttribute('aria-label', 'Take 4-up photos');
    } else {
      shutter.title = 'Take photo (Space) — Option-click to skip countdown';
      shutter.setAttribute('aria-label', 'Take photo');
    }
  }

  async function runCountdown(n, ctl, label = '') {
    if (n <= 0) return;
    for (let i = n; i > 0; i--) {
      if (ctl && ctl.cancelled) throw 'cancelled';
      countdownEl.hidden = false;
      if (countdownNumEl) countdownNumEl.textContent = String(i);
      if (countdownNoteEl) {
        const prefix = label ? `${label} · ` : '';
        countdownNoteEl.textContent = `${prefix}${n}s timer · Click Shutter or Space to cancel`;
      }
      countdownEl.classList.remove('tick'); void countdownEl.offsetWidth; countdownEl.classList.add('tick');
      if (shouldCountdownBeep(n, i)) beep(i === 1 ? 1100 : 760, 0.09);
      await sleep(1000, ctl);
    }
    countdownEl.hidden = true;
  }

  async function savePhoto() {
    const now = Date.now();
    const tag = inst.mode === '4up' ? '4-UP' : 'PHOTO';
    const framed = createWatermarkedCanvas(canvas, { tag, timestamp: now });
    const blob = await toBlob(framed);
    const thumb = await makeThumb(framed);
    await addItem({ type: 'photo', blob, thumb, mime: 'image/jpeg', createdAt: now, winKey: inst.winKey });
  }

  async function captureShotWithFlash(drawFn, ctl) {
    if (inst.flashOn) {
      await triggerPreFlash(ctl);
      drawFn();
      endPreFlash();
    } else {
      drawFn();
      flashBlink();
    }
  }

  async function captureSequence(skipCountdown) {
    const ctl = { cancelled: false };
    const delaySec = skipCountdown ? 0 : getTimerSeconds();
    inst.ctl = ctl;
    inst.busy = true;
    syncShutterUI(true);
    try {
      const w = canvas.width, h = canvas.height;
      if (inst.mode === '4up') {
        inst.shots = [];
        for (let i = 0; i < 4; i++) {
          if (delaySec === 0) {
            countdownEl.hidden = false;
            if (countdownNumEl) countdownNumEl.textContent = '';
            if (countdownNoteEl) countdownNoteEl.textContent = `Shot ${i + 1} of 4 · 0.5s burst · Click Shutter or Space to cancel`;
            await sleep(500, ctl);
            countdownEl.hidden = true;
          } else {
            await runCountdown(delaySec, ctl, `Shot ${i + 1} of 4`);
          }
          const shot = document.createElement('canvas');
          shot.width = Math.round(w / 2); shot.height = Math.round(h / 2);
          await captureShotWithFlash(() => {
            renderEffect(shot.getContext('2d'), 0, 0, shot.width, shot.height, inst.effect);
          }, ctl);
          inst.shots.push(shot);
          if (delaySec > 0 && i < 3) await sleep(250, ctl);
        }
        await sleep(delaySec === 0 ? 450 : 750, ctl);
        inst.renderScene(ctx, w, h);
        syncShutterUI(false);
        await savePhoto();
        inst.shots = [];
      } else {
        if (delaySec > 0) await runCountdown(delaySec, ctl);
        await captureShotWithFlash(() => inst.renderScene(ctx, w, h), ctl);
        syncShutterUI(false);
        await savePhoto();
      }
    } catch (e) {
      if (e === 'cancelled') showStageToast('Countdown cancelled');
      else console.error(e);
    } finally {
      clearFlashOverlay();
      inst.shots = [];
      inst.busy = false;
      inst.ctl = null;
      countdownEl.hidden = true;
      if (countdownNumEl) countdownNumEl.textContent = '';
      if (countdownNoteEl) countdownNoteEl.textContent = '';
      syncShutterUI(false);
    }
  }

  async function startRecording(skipCountdown) {
    if (!window.MediaRecorder || typeof HTMLCanvasElement.prototype.captureStream !== 'function') {
      return inst.showMessage('Video recording is not supported in this browser.');
    }
    const ctl = { cancelled: false };
    const delaySec = skipCountdown ? 0 : getTimerSeconds();
    inst.ctl = ctl; inst.busy = true;
    syncShutterUI(true);
    try {
      if (!micStream || !micStream.getAudioTracks().some((t) => t.readyState === 'live')) {
        try { micStream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (_) { micStream = null; }
      }
      if (ctl.cancelled) throw 'cancelled';
      if (delaySec > 0) await runCountdown(delaySec, ctl, 'Video');
    } catch (e) {
      if (e === 'cancelled') showStageToast('Recording cancelled');
      inst.busy = false; inst.ctl = null; countdownEl.hidden = true;
      if (countdownNumEl) countdownNumEl.textContent = '';
      if (countdownNoteEl) countdownNoteEl.textContent = '';
      syncShutterUI(false);
      return;
    }
    inst.ctl = null;

    // Compose camera canvas + white watermark footer bar on an even-sized DOM-mounted canvas
    const recTs = Date.now();
    let recSrcW = evenDim(canvas.width || video.videoWidth || 640);
    let recSrcH = evenDim(canvas.height || video.videoHeight || 480);
    let barStamp = createWatermarkBarStamp(recSrcW, recSrcH, { tag: 'VIDEO', timestamp: recTs });
    let barH = evenDim(barStamp.height);
    const recCanvas = document.createElement('canvas');
    recCanvas.width = recSrcW;
    recCanvas.height = recSrcH + barH;
    const recCtx = recCanvas.getContext('2d');
    mountRecordingCanvas(recCanvas);

    const drawRecFrame = () => {
      if (canvas.width && canvas.height) {
        const nw = evenDim(canvas.width);
        const nh = evenDim(canvas.height);
        if (nw !== recSrcW || nh !== recSrcH) {
          recSrcW = nw;
          recSrcH = nh;
          barStamp = createWatermarkBarStamp(recSrcW, recSrcH, { tag: 'VIDEO', timestamp: recTs });
          barH = evenDim(barStamp.height);
          recCanvas.width = recSrcW;
          recCanvas.height = recSrcH + barH;
        }
      }
      recCtx.drawImage(canvas, 0, 0, recSrcW, recSrcH);
      recCtx.drawImage(barStamp, 0, recSrcH, recSrcW, barH);
    };

    drawRecFrame();
    const out = recCanvas.captureStream(30);
    const vTrack = out.getVideoTracks()[0];
    const requestFrame = () => {
      try { if (vTrack && typeof vTrack.requestFrame === 'function') vTrack.requestFrame(); } catch (_) {}
    };
    requestFrame();

    let pumpAlive = true;
    const pumpRecFrame = () => {
      if (!pumpAlive || inst.closing) return;
      drawRecFrame();
      requestFrame();
      inst.recRaf = requestAnimationFrame(pumpRecFrame);
    };
    inst.recRaf = requestAnimationFrame(pumpRecFrame);

    // Wait one painted animation frame so Safari/mobile encoders receive real dimensions & pixels before audio chunks
    await new Promise((r) => requestAnimationFrame(r));
    drawRecFrame();
    requestFrame();

    const audioTracks = micStream ? micStream.getAudioTracks().filter((t) => t.readyState === 'live') : [];
    audioTracks.forEach((t) => out.addTrack(t));
    const mime = pickMime(audioTracks.length > 0);
    const chunks = [];
    const rec = new MediaRecorder(out, mime ? { mimeType: mime } : undefined);
    inst.recorder = rec;
    inst.recCanvas = recCanvas;
    inst.stopRecPump = () => {
      pumpAlive = false;
      cancelAnimationFrame(inst.recRaf);
    };
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = async () => {
      if (inst.stopRecPump) inst.stopRecPump();
      unmountRecordingCanvas(recCanvas);
      if (!inst.closing && chunks.length) {
        const type = rec.mimeType || mime || 'video/mp4';
        const blob = new Blob(chunks, { type });
        if (blob.size > 0) {
          await addItem({ type: 'video', blob, thumb: rec.poster, mime: type, createdAt: Date.now(), winKey: inst.winKey });
        }
      }
      inst.recorder = null;
      inst.recCanvas = null;
      inst.stopRecPump = null;
    };
    rec.start();

    inst.recording = true;
    inst.busy = false;
    shutter.classList.add('recording');
    syncShutterUI(false);
    recBadgeEl.hidden = false;
    updateFillLight();
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
    if (inst.stopRecPump) inst.stopRecPump();
    inst.recorder.poster = await makeThumb(inst.recCanvas || canvas);
    try { if (inst.recorder.state !== 'inactive') inst.recorder.stop(); } catch (_) {}
    clearInterval(inst.recTimer);
    inst.recording = false;
    shutter.classList.remove('recording');
    syncShutterUI(false);
    recBadgeEl.hidden = true;
    updateFillLight();
  }

  /* ---- Library & Viewer ---- */
  const syncStripBtn = (itemCount) => {
    el.classList.toggle('strip-hidden', inst.stripHidden);
    if (!stripBtn) return;
    const active = itemCount > 0 && !inst.stripHidden;
    stripBtn.classList.toggle('on', active);
    stripBtn.classList.toggle('is-empty', itemCount === 0);
    stripBtn.setAttribute('aria-pressed', String(active));
    const tip = itemCount === 0
      ? (inst.stripHidden ? 'Gallery Strip (Hidden)' : 'Gallery Strip')
      : (inst.stripHidden ? 'Show Gallery Strip' : 'Hide Gallery Strip');
    stripBtn.title = tip;
    stripBtn.setAttribute('aria-label', tip);
  };

  inst.renderLibrary = (scrollToEnd) => {
    const items = photoItems().filter((i) => i.winKey === inst.winKey);
    el.classList.toggle('lib-empty', items.length === 0);
    syncStripBtn(items.length);
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
    viewerVideoUI.reset();
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
    if (item.type === 'photo') viewerImg.src = inst.viewerUrl;
    else {
      viewerVideoUI.setMedia(inst.viewerUrl, thumbUrl(item));
      viewerVideo.play().catch(() => {});
    }
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
    syncShutterUI(false);
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
    if (inst.busy && inst.ctl) { cancelCtl(inst.ctl); return; }
    if (inst.busy) return;
    if (inst.recording) return stopRecording();
    if (inst.effectsOpen) inst.toggleEffects(false);
    if (inst.view === 'item') inst.closeItem();
    if (inst.mode === 'video') startRecording(skip);
    else captureSequence(skip);
  };

  el.querySelectorAll('.mode').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.mode)));
  shutter.addEventListener('click', (e) => { inst.onShutter(e); e.currentTarget.blur(); });
  if (stripBtn) {
    stripBtn.addEventListener('click', (e) => {
      inst.stripHidden = !inst.stripHidden;
      const count = photoItems().filter((i) => i.winKey === inst.winKey).length;
      syncStripBtn(count);
      if (!inst.stripHidden && count > 0) requestAnimationFrame(() => { libEl.scrollLeft = libEl.scrollWidth; });
      else if (count === 0) showStageToast(inst.stripHidden ? 'Gallery strip hidden' : 'Gallery strip shown', 1200);
      e.currentTarget.blur();
    });
  }
  if (flashBtn) {
    const syncFlashBtn = () => {
      flashBtn.classList.toggle('on', inst.flashOn);
      flashBtn.setAttribute('aria-pressed', String(inst.flashOn));
    };
    syncFlashBtn();
    flashBtn.addEventListener('click', (e) => {
      inst.flashOn = !inst.flashOn;
      syncFlashBtn();
      updateFillLight();
      e.currentTarget.blur();
    });
  }
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
    if (inst.ctl) cancelCtl(inst.ctl);
    if (inst.stopRecPump) inst.stopRecPump();
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
        const fromY = sy ? (s0.h + sy * dy - s0.chrome) * arNow() + innerNow() * 2 : 0;
        const availW = sx < 0 ? (s0.x + s0.w) : (innerWidth - Math.max(0, s0.x));
        const availH = sy < 0 ? (s0.y + s0.h) : (innerHeight - Math.max(0, s0.y));
        const maxFromH = (availH - s0.chrome) * arNow() + innerNow() * 2;
        const hi = Math.max(minW(), Math.min(maxW(), availW, maxFromH));
        inst.WIN.w = clampN(Math.max(fromX, fromY), minW(), hi);
        const hNew = s0.chrome + (inst.WIN.w - innerNow() * 2) / arNow();
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
      const bottomClear = Math.max(pad, dockReserveNow());
      inst.WIN.w = Math.min(innerWidth - pad * 2, widthForHeight(innerHeight - pad - bottomClear));
      inst.WIN.x = (innerWidth - inst.WIN.w) / 2;
      inst.WIN.y = Math.max(pad, (innerHeight - bottomClear + pad - heightFor(inst.WIN.w)) / 2);
    }
    applyWin('fit');
  }

  titlebar.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || inst.winFull || e.target.closest('.light, button, a, input, select, textarea') || e.target === titleInput) return;
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
  const dockRes = dockReserveNow();
  if (typeof opts.w === 'number' && typeof opts.x === 'number' && typeof opts.y === 'number') {
    inst.WIN.w = opts.w;
    inst.WIN.x = opts.x;
    inst.WIN.y = opts.y;
  } else if (isPhoneViewport()) {
    const [mSpec] = computeMobileSpecs(1, [opts.effectId || 'normal']);
    inst.boxAR = mSpec.ar;
    inst.WIN.w = mSpec.w;
    inst.WIN.x = mSpec.x;
    inst.WIN.y = mSpec.y;
  } else {
    const availH = Math.max(280, innerHeight - pad - dockRes);
    const base = (focusedWin && !focusedWin.minimized && !focusedWin.closing)
      ? focusedWin
      : windows.find((w) => !w.minimized && !w.closing);
    if (base && opts.cascaded) {
      inst.WIN.w = Math.min(base.winFull ? 700 : base.WIN.w, innerWidth - pad * 2, widthForHeight(availH));
      const h = heightFor(inst.WIN.w);
      inst.WIN.x = clampN(base.WIN.x + 28, pad, Math.max(pad, innerWidth - inst.WIN.w - pad));
      inst.WIN.y = clampN(base.WIN.y + 28, pad, Math.max(pad, innerHeight - dockRes - h));
    } else {
      inst.WIN.w = Math.min(760, innerWidth - pad * 2, widthForHeight(availH));
      inst.WIN.x = (innerWidth - inst.WIN.w) / 2;
      inst.WIN.y = Math.max(pad, (innerHeight - dockRes - heightFor(inst.WIN.w)) / 2);
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

let mobileLayoutCount = 1;

function computeMobileSpecs(count, existingEffects = null) {
  const pad = winPad();
  const W = innerWidth;
  const H = Math.max(240, innerHeight - dockReserveNow());
  const chrome = chromeHNow();
  const inn = innerPadNow();
  const n = count >= 2 ? 2 : 1;
  const effects = existingEffects && existingEffects.length
    ? existingEffects
    : (n === 1 ? ['normal'] : ['pop', 'normal']);

  if (isMobilePortrait()) {
    if (n === 1) {
      const availW = Math.max(minW(), W - pad * 2);
      const availH = Math.max(240, H - pad * 2);
      const targetH = Math.max(260, Math.round(availH * 0.88));
      let w = Math.min(availW, Math.round(W * 0.90), Math.round(targetH * 0.68));
      w = Math.max(minW(), w);
      const h = clampN(Math.round(Math.max(w * 1.32, Math.min(targetH, availH))), Math.min(availH, w + 24), availH);
      const ar = Math.max(0.42, (w - inn * 2) / Math.max(100, h - chrome));
      return [{
        effectId: effects[0] || 'normal',
        x: Math.round((W - w) / 2),
        y: Math.max(pad, Math.round((H - h) / 2)),
        w,
        ar,
      }];
    }
    // Max 2 windows stacked top & bottom
    const gap = 8;
    const availW = Math.max(minW(), W - pad * 2);
    const slotH = Math.max(150, Math.floor((H - pad * 2 - gap) / 2));
    const w = clampN(Math.round(slotH * 0.90), minW(), availW);
    const ar = Math.max(0.55, (w - inn * 2) / Math.max(70, slotH - chrome));
    const sx = Math.round((W - w) / 2);
    const sy = Math.max(pad, Math.round((H - (slotH * 2 + gap)) / 2));
    return [
      { effectId: effects[0] || 'pop', x: sx, y: sy, w, ar },
      { effectId: effects[1] || 'normal', x: sx, y: sy + slotH + gap, w, ar },
    ];
  }

  // Phone landscape orientation
  if (n === 1) {
    const availW = Math.max(minW(), W - pad * 2);
    const availH = Math.max(170, H - pad * 2);
    const ar = Math.min(1.68, Math.max(1.42, stageAR()));
    const targetH = Math.min(availH, Math.round(availH * 0.94));
    let w = Math.min(availW, Math.round((targetH - chrome) * ar + inn * 2));
    w = Math.max(minW(), w);
    const h = Math.round(chrome + (w - inn * 2) / ar);
    return [{
      effectId: effects[0] || 'normal',
      x: Math.round((W - w) / 2),
      y: Math.max(pad, Math.round((H - h) / 2)),
      w,
      ar,
    }];
  }
  // Max 2 windows arranged left & right
  const gap = 8;
  const availEachW = Math.max(minW(), Math.floor((W - pad * 2 - gap) / 2));
  const availH = Math.max(170, H - pad * 2);
  const ar = Math.min(1.62, Math.max(1.34, stageAR()));
  let w = Math.min(availEachW, Math.round((availH - chrome) * ar + inn * 2));
  w = Math.max(minW(), w);
  let h = Math.round(chrome + (w - inn * 2) / ar);
  if (h > availH) {
    h = availH;
    w = Math.min(availEachW, Math.max(minW(), Math.round((h - chrome) * ar + inn * 2)));
  }
  const useAr = Math.max(1.2, (w - inn * 2) / Math.max(70, h - chrome));
  const totalW = w * 2 + gap;
  const sx = Math.round((W - totalW) / 2);
  const sy = Math.max(pad, Math.round((H - h) / 2));
  return [
    { effectId: effects[0] || 'pop', x: sx, y: sy, w, ar: useAr },
    { effectId: effects[1] || 'normal', x: sx + w + gap, y: sy, w, ar: useAr },
  ];
}

function trimExcessWindows(maxCount) {
  const alive = windows.filter((w) => !w.closing);
  if (alive.length <= maxCount) return;
  const keep = [];
  if (focusedWin && !focusedWin.closing) keep.push(focusedWin);
  for (const w of alive) {
    if (keep.length >= maxCount) break;
    if (!keep.includes(w)) keep.push(w);
  }
  for (const w of alive) {
    if (!keep.includes(w)) w.close();
  }
}

function applyMobileLayoutToWindows(targetCount = null) {
  // Enforce max 2 windows on phone viewports; drop oldest non-focused extras if shrinking from desktop
  trimExcessWindows(2);
  const active = windows.filter((w) => !w.closing);
  const visible = active.filter((w) => !w.minimized);
  const n = targetCount || (visible.length >= 2 ? 2 : 1);
  mobileLayoutCount = n;
  const specs = computeMobileSpecs(n, visible.map((w) => w.effect?.id || 'normal'));
  visible.forEach((w, idx) => {
    const s = specs[Math.min(idx, specs.length - 1)];
    if (!s) return;
    if (w.winFull) w.toggleWinFull(false);
    w.zoomPrev = null;
    w.boxAR = s.ar;
    w.WIN.w = s.w;
    w.WIN.x = s.x;
    w.WIN.y = s.y;
    w.applyWin('fit');
  });
}

let activeLayoutId = localStorage.getItem('pb.layoutId') || DEFAULT_LAYOUT_ID;
if (!LAYOUT_PRESETS.some((l) => l.id === activeLayoutId)) activeLayoutId = DEFAULT_LAYOUT_ID;

function clearAllPhotoBoothWindows() {
  for (const inst of [...windows]) {
    inst.closing = true;
    if (inst.ctl) inst.ctl.cancelled = true;
    if (inst.stopRecPump) inst.stopRecPump();
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
  syncMobileBodyClass();
  const prevFocused = keepUtilFocus ? focusedEl : null;
  if (isPhoneViewport()) {
    const preset = LAYOUT_PRESETS.find((l) => l.id === id);
    mobileLayoutCount = (preset && preset.count >= 2) ? 2 : 1;
    clearAllPhotoBoothWindows();
    const specs = computeMobileSpecs(mobileLayoutCount);
    for (const s of specs) createWindow(s);
    if (prevFocused && utilApps.some((a) => a.el === prevFocused && a.state.open)) {
      focusElement(prevFocused, null);
    }
    if (typeof syncSettingsUI === 'function') syncSettingsUI();
    updateDock();
    return;
  }
  const tablet = isTabletViewport();
  let nextId = LAYOUT_PRESETS.some((l) => l.id === id) ? id : DEFAULT_LAYOUT_ID;
  if (tablet) {
    const picked = LAYOUT_PRESETS.find((l) => l.id === nextId);
    if (picked && picked.count > 4) nextId = '4-grid';
  }
  activeLayoutId = nextId;
  if (!tablet) localStorage.setItem('pb.layoutId', activeLayoutId);
  clearAllPhotoBoothWindows();
  const specs = computeLayoutSpecs(activeLayoutId);
  for (const s of specs) createWindow(s);
  if (prevFocused && utilApps.some((a) => a.el === prevFocused && a.state.open)) {
    focusElement(prevFocused, null);
  }
  if (typeof syncSettingsUI === 'function') syncSettingsUI();
  updateDock();
}

function initDefaultWindows() {
  syncMobileBodyClass();
  if (isPhoneViewport()) {
    applyLayout('1-center');
  } else if (isTabletViewport()) {
    const picked = LAYOUT_PRESETS.find((l) => l.id === activeLayoutId);
    applyLayout(picked && picked.count <= 4 ? activeLayoutId : '4-grid');
  } else {
    applyLayout(activeLayoutId);
  }
}

function createUtilityApp({ el, state, title, dockClass, closeBtn, minBtn, defaultW, defaultH, onOpen, onClose, renderMinThumb }) {
  el.querySelectorAll('.titlebar').forEach((titlebar) => {
    titlebar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.light, button, a, input, select, textarea, [role="button"]')) return;
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

  const fitBounds = (forceCenter = false) => {
    const pad = winPad();
    const dockRes = dockReserveNow();
    if (isPhoneViewport()) {
      const maxUW = Math.max(240, innerWidth - pad * 2);
      const maxUH = Math.max(220, innerHeight - dockRes - pad * 2);
      const w = Math.min(defaultW, maxUW);
      const h = Math.min(defaultH, maxUH);
      el.style.width = w + 'px';
      el.style.height = h + 'px';
      if (forceCenter || !state.placed) {
        state.x = Math.round((innerWidth - w) / 2);
        state.y = Math.max(pad, Math.round((innerHeight - dockRes - h) / 2));
        state.placed = true;
      } else {
        state.x = clampN(state.x, pad, Math.max(pad, innerWidth - w - pad));
        state.y = clampN(state.y, pad, Math.max(pad, innerHeight - dockRes - h));
      }
    } else {
      el.style.width = '';
      el.style.height = '';
      const w = el.offsetWidth || defaultW;
      const h = el.offsetHeight || defaultH;
      if (forceCenter || !state.placed) {
        state.x = clampN(Math.round((innerWidth - w) / 2), 12, Math.max(12, innerWidth - w - 12));
        state.y = clampN(Math.round((innerHeight - dockRes - h) / 2), 16, Math.max(16, innerHeight - h - dockRes));
        state.placed = true;
      } else {
        state.x = clampN(state.x, 0, Math.max(0, innerWidth - w));
        state.y = clampN(state.y, 0, Math.max(0, innerHeight - 40));
      }
    }
    el.style.left = state.x + 'px';
    el.style.top = state.y + 'px';
  };

  const api = {
    el, state, title, dockClass,
    fitBounds,
    renderMinThumb: renderMinThumb || ((btn) => { btn.innerHTML = `<span class="dock-tip">${title}</span>`; }),
    open() {
      if (!state.open) {
        state.open = true;
        state.minimized = false;
        el.classList.remove('minimized', 'closing');
        el.hidden = false;
        fitBounds(!state.placed || isPhoneViewport());
        if (onOpen) onOpen();
      } else if (state.minimized) {
        api.restore();
        return;
      } else if (isPhoneViewport()) {
        fitBounds(false);
      }
      focusElement(el, null);
      updateDock();
    },
    close() {
      if (!state.open) return;
      if (onClose) onClose();
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
      if (onClose) onClose();
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
      if (isPhoneViewport()) fitBounds(false);
      focusElement(el, null);
      updateDock();
    },
  };

  closeBtn.addEventListener('click', () => api.close());
  minBtn.addEventListener('click', () => api.minimize());
  utilApps.push(api);
  return api;
}

