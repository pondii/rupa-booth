'use strict';

/* ----------------------------- Global Events ----------------------------- */
function bounceDock(btn) {
  btn.classList.remove('bouncing');
  void btn.offsetWidth;
  btn.classList.add('bouncing');
}

dockApp.addEventListener('click', () => {
  bounceDock(dockApp);
  const alive = windows.filter((w) => !w.closing);
  const visible = alive.filter((w) => !w.minimized);
  const minimized = alive.filter((w) => w.minimized);
  if (isPhoneViewport()) {
    if (visible.length === 0 && minimized.length > 0) {
      minimized[minimized.length - 1].restore();
      applyMobileLayoutToWindows();
      if (typeof syncSettingsUI === 'function') syncSettingsUI();
      return;
    }
    if (alive.length === 0) {
      mobileLayoutCount = 1;
      createWindow(computeMobileSpecs(1)[0]);
      if (typeof syncSettingsUI === 'function') syncSettingsUI();
      return;
    }
    if (alive.length === 1) {
      if (alive[0].minimized) {
        alive[0].restore();
        applyMobileLayoutToWindows(1);
      } else {
        mobileLayoutCount = 2;
        createWindow({ effectId: 'pop' });
        applyMobileLayoutToWindows(2);
      }
      if (typeof syncSettingsUI === 'function') syncSettingsUI();
      return;
    }
    // Max 2 windows on mobile: restore if minimized or cycle focus between the 2 windows
    if (minimized.length > 0) {
      minimized[minimized.length - 1].restore();
      applyMobileLayoutToWindows(2);
    } else {
      const idx = visible.indexOf(focusedWin);
      const next = visible[(idx + 1) % visible.length];
      if (next) focusElement(next.el, next);
      showDesktopNotice('Maximum 2 windows on mobile', 1600);
    }
    if (typeof syncSettingsUI === 'function') syncSettingsUI();
    return;
  }
  if (isTabletViewport()) {
    if (visible.length === 0 && minimized.length > 0) {
      minimized[minimized.length - 1].restore();
      return;
    }
    if (alive.length >= 4) {
      if (minimized.length > 0) {
        minimized[minimized.length - 1].restore();
      } else {
        const idx = visible.indexOf(focusedWin);
        const next = visible[(idx + 1) % visible.length];
        if (next) focusElement(next.el, next);
        showDesktopNotice('Maximum 4 windows on iPad', 1600);
      }
      return;
    }
    createWindow({ effectId: 'normal', cascaded: visible.length > 0 });
    return;
  }
  if (visible.length === 0 && minimized.length > 0) {
    minimized[minimized.length - 1].restore();
  } else {
    createWindow({ effectId: 'normal', cascaded: visible.length > 0 });
  }
});

dockFiles.addEventListener('click', () => { bounceDock(dockFiles); filesApp.open(); });
dockSettings.addEventListener('click', () => { bounceDock(dockSettings); settingsApp.open(); });
dockShot.addEventListener('click', () => {
  bounceDock(dockShot);
  if (shotRecStopFn) { stopDesktopVideoRecording(); return; }
  if (shotCtl) { triggerScreenshotCountdown(); return; }
  shotApp.open();
});

let lastResizePhone = isPhoneViewport();
addEventListener('resize', () => {
  const nowPhone = syncMobileBodyClass();
  if (nowPhone) {
    applyMobileLayoutToWindows();
  } else {
    if (lastResizePhone) {
      for (const w of windows) w.boxAR = null;
    }
    if (isTabletViewport()) trimExcessWindows(4);
    for (const w of windows) {
      if (!w.winFull && !w.minimized && !w.closing) w.applyWin('fit');
    }
  }
  lastResizePhone = nowPhone;
  for (const app of utilApps) {
    if (app.state.open && !app.state.minimized) {
      if (app.fitBounds) app.fitBounds(nowPhone);
    }
  }
  if (typeof syncSettingsUI === 'function') syncSettingsUI();
  updateFillLight();
});

document.addEventListener('keydown', (e) => {
  if (e.altKey && e.shiftKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyR' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
    e.preventDefault();
    if (typeof showEmergencyResetModal === 'function') showEmergencyResetModal();
    return;
  }
  if (e.key === 'Escape') {
    if (typeof closeEmergencyResetModal === 'function' && closeEmergencyResetModal()) return;
    if (typeof closeWelcomeModal === 'function' && closeWelcomeModal()) return;
    if (shareMenuEl && !shareMenuEl.hidden) { closeShareMenu(); return; }
    if (qrModalEl && !qrModalEl.hidden) { closeQrModal(); return; }
    if (typeof quickLookState !== 'undefined' && quickLookState.open) { closeQuickLook(); return; }
    if (shotRecStopFn) { stopDesktopVideoRecording(); return; }
    if (shotCtl) { cancelCtl(shotCtl); return; }
    if (shotToastEl && !shotToastEl.hidden) { hideShotToast(); return; }
    if (fpMoreMenuEl && !fpMoreMenuEl.hidden) { toggleFpMoreMenu(false); return; }
    if (focusedEl === filesWin && filesPreviewEl && !filesPreviewEl.hidden) { closeFilePreview(); return; }
  }
  if (typeof quickLookState !== 'undefined' && quickLookState.open) {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      stepQuickLook(e.key === 'ArrowRight' ? 1 : -1);
      return;
    }
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) {
      e.preventDefault();
      if (!e.repeat) closeQuickLook();
      return;
    }
  }
  if (e.code === 'Space' && focusedEl === filesWin && filesPreviewEl && !filesPreviewEl.hidden && !['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(e.target.tagName)) {
    e.preventDefault();
    if (!e.repeat && filesState.selectedId != null) openQuickLook(filesState.selectedId);
    return;
  }
  if (e.code === 'Space' && shotCtl && !['INPUT', 'TEXTAREA', 'SELECT', 'VIDEO'].includes(e.target.tagName)) {
    e.preventDefault();
    if (!e.repeat) cancelCtl(shotCtl);
    return;
  }
  const w = focusedWin;
  if (!w || w.minimized || w.closing) return;
  if (e.code === 'Space') {
    if (typeof welcomeModalEl !== 'undefined' && welcomeModalEl && !welcomeModalEl.hidden) return;
    if (['INPUT', 'TEXTAREA', 'SELECT', 'VIDEO', 'BUTTON'].includes(e.target.tagName)) return;
    e.preventDefault();
    if (!e.repeat) w.onShutter(e);
  } else if (w.effectsOpen && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
    w.setFxPage(w.fxPage + (e.key === 'ArrowRight' ? 1 : -1));
  } else if (e.key === 'Escape') {
    if (w.busy && w.ctl) cancelCtl(w.ctl);
    else if (w.effectsOpen) w.toggleEffects(false);
    else if (w.view === 'item') w.closeItem();
    else if (w.winFull) w.toggleWinFull(false);
  }
});
document.addEventListener('keyup', (e) => { if (e.code === 'Space') e.preventDefault(); });


/* ----------------------------- Render Loop ----------------------------- */
const IDLE_TIMEOUT_MS = 15000;
const IDLE_FRAME_INTERVAL_MS = 100; // ~10 FPS power-save cadence after 15s idle
let lastActivityAt = performance.now();
let lastIdleRenderAt = 0;
let isIdleMode = false;

function setIdlePowerMode(idle) {
  if (isIdleMode === idle) return;
  isIdleMode = idle;
  if (!idle) lastIdleRenderAt = 0;
  document.documentElement.dataset.powerMode = idle ? 'idle' : 'active';
}

function hasActiveCaptureWork(now) {
  if (typeof shotCtl !== 'undefined' && shotCtl) return true;
  if (typeof shotRecStopFn !== 'undefined' && shotRecStopFn) return true;
  return windows.some((w) => !w.closing && (w.recording || w.busy || (w.effectsOpen && now < (w.fxAnimUntil || 0))));
}

function noteUserActivity(force = false) {
  const now = performance.now();
  if (!force && !isIdleMode && now - lastActivityAt < 120) return;
  lastActivityAt = now;
  if (isIdleMode) setIdlePowerMode(false);
}

for (const evt of ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'wheel']) {
  document.addEventListener(evt, () => noteUserActivity(true), { passive: true, capture: true });
}
for (const evt of ['pointermove', 'mousemove']) {
  document.addEventListener(evt, () => noteUserActivity(false), { passive: true, capture: true });
}
window.addEventListener('focus', () => noteUserActivity(true));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) noteUserActivity(true);
});
document.documentElement.dataset.powerMode = 'active';

function loop(now = performance.now()) {
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

  if (hasActiveCaptureWork(now)) {
    lastActivityAt = now;
    if (isIdleMode) setIdlePowerMode(false);
  } else if (now - lastActivityAt >= IDLE_TIMEOUT_MS) {
    if (!isIdleMode) setIdlePowerMode(true);
    if (lastIdleRenderAt && now - lastIdleRenderAt < IDLE_FRAME_INTERVAL_MS) return;
    lastIdleRenderAt = now;
  } else if (isIdleMode) {
    setIdlePowerMode(false);
  }

  uploadFrame();
  if (typeof tickArDetection === 'function') tickArDetection(now);
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
syncMobileBodyClass();
let appBooted = false;
function bootPhotoBoothApp() {
  if (appBooted) return;
  appBooted = true;
  initFX();
  buildWallpaperUI();
  buildSettingsUI();
  buildFilesUI();
  buildShotUI();
  loadWallpaperPref();
  initDefaultWindows();
  loadItems();
  if (typeof openWelcomeModal === 'function' && openWelcomeModal()) {
    if (typeof setCameraMessage === 'function') {
      setCameraMessage('Click Continue on the Welcome prompt to allow Camera & Microphone access.');
    }
  } else {
    startCamera();
  }
  requestAnimationFrame(loop);
}

const dlRoomId = new URLSearchParams(location.search).get('dl');
if (dlRoomId) {
  startQrReceiverView(dlRoomId);
} else if (typeof hasResetQueryParam === 'function' && hasResetQueryParam()) {
  showEmergencyResetModal({ onCancel: bootPhotoBoothApp });
} else {
  bootPhotoBoothApp();
}
