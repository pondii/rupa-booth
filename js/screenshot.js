'use strict';

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

  // Flash button (icon)
  const fb = inst.el.querySelector('.flash-btn');
  if (fb) {
    const fr = fb.getBoundingClientRect();
    const fcx = fr.left + fr.width / 2, fcy = fr.top + fr.height / 2;
    c.save();
    rrect(c, fr.left, fr.top, fr.width, fr.height, 8);
    c.fillStyle = inst.flashOn ? 'rgba(255,214,10,0.24)' : 'rgba(255,255,255,0.14)';
    c.fill();
    c.strokeStyle = inst.flashOn ? '#ffd60a' : '#fff';
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(fcx + 1, fcy - 6.5);
    c.lineTo(fcx - 4.5, fcy + 0.5);
    c.lineTo(fcx - 0.3, fcy + 0.5);
    c.lineTo(fcx - 1, fcy + 6.5);
    c.lineTo(fcx + 4.5, fcy - 0.5);
    c.lineTo(fcx + 0.3, fcy - 0.5);
    c.closePath();
    if (inst.flashOn) { c.fillStyle = 'rgba(255,214,10,0.38)'; c.fill(); }
    c.stroke();
    c.restore();
  }

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

function drawWallpaperPane(c) {
  const mini = $('#wallMiniStage')?.getBoundingClientRect();
  if (mini && mini.width) {
    c.save();
    rrect(c, mini.left, mini.top, mini.width, mini.height, 8);
    c.clip();
    c.fillStyle = wallState.color;
    c.fillRect(mini.left, mini.top, mini.width, mini.height);
    if (wallState.tab === 'photo' && wallState.imgEl && wallState.imgEl.complete) {
      drawImageCover(c, wallState.imgEl, wallState.imgEl.naturalWidth, wallState.imgEl.naturalHeight, mini.left, mini.top, mini.width, mini.height);
    }
    c.restore();
  }
  c.save();
  const tr = wallTabs.getBoundingClientRect();
  if (tr.width) {
    rrect(c, tr.left, tr.top, tr.width, tr.height, 8);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fill();
  }
  c.font = '500 12px -apple-system, BlinkMacSystemFont, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  wallTabs.querySelectorAll('.wall-tab').forEach((tab) => {
    const r = tab.getBoundingClientRect();
    if (tab.classList.contains('active')) {
      rrect(c, r.left, r.top, r.width, r.height, 6);
      c.fillStyle = 'rgba(255,255,255,0.24)'; c.fill();
    }
    c.fillStyle = tab.classList.contains('active') ? '#fff' : 'rgba(255,255,255,0.74)';
    c.fillText(tab.textContent.trim(), r.left + r.width / 2, r.top + r.height / 2);
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
    settingsWin.querySelectorAll('.slider-row').forEach((row) => {
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
  const btns = [dockApp, dockFiles, dockSettings, dockShot];
  await Promise.all(btns.map((b) => svgElementToImage(b?.querySelector('svg'))));
}

function drawDesktopComposition(c, W, H) {
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
    if (l.type === 'pb') drawPhotoBoothWindow(c, l.inst);
    else if (l.type === 'settings-running') drawSettingsWindow(c);
    else if (l.type === 'files-running') drawFilesWindow(c);
    else if (l.type === 'shot-running') drawMacSplitFrame(c, shotWin, $('#shotPaneTitle')?.textContent || 'Screenshot');
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
      { btn: dockFiles, dot: dock.classList.contains('files-running') },
      { btn: dockSettings, dot: dock.classList.contains('settings-running') },
      { btn: dockShot, dot: dock.classList.contains('shot-running') },
    ];
    for (const item of icons) {
      const ir = item.btn.getBoundingClientRect();
      const svgEl = item.btn.querySelector('svg');
      const svgImg = svgEl ? svgCache.get(svgEl.outerHTML) : null;
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
  if (settingsState.sec === 'layout') {
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
  } else if (settingsState.sec === 'wallpaper') {
    c.restore();
    drawWallpaperPane(c);
    return;
  } else if (settingsState.sec === 'flash') {
    const pv = $('#flashPreviewBox')?.getBoundingClientRect();
    if (pv && pv.width) {
      rrect(c, pv.left, pv.top, pv.width, pv.height, 12);
      c.fillStyle = '#14151a'; c.fill();
      c.strokeStyle = flashCfg.color; c.lineWidth = 6; c.stroke();
    }
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
  if (!window.MediaRecorder) return;
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

