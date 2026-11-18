'use strict';

/* ------------------------- Wallpaper Section (Settings) ------------------------- */
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
  tab: 'color',
  h: 0, s: 0, v: 100,
  color: localStorage.getItem('pb.bgColor') || '#FFFFFF',
  fit: 'cover',
  imgUrl: null,
  imgBlob: null,
  imgEl: null,
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

function hasRetroWallOverride() {
  try { return localStorage.getItem('pb.retroWallOverride') === '1'; } catch (_) { return false; }
}

function setRetroWallOverride(on) {
  try {
    if (on) localStorage.setItem('pb.retroWallOverride', '1');
    else localStorage.removeItem('pb.retroWallOverride');
  } catch (_) { /* ignore */ }
}

function getRetroGridColor(hex, skin = document.documentElement.dataset.skin) {
  const rgb = typeof hexToRgb === 'function' ? hexToRgb(hex) : null;
  if (!rgb) return skin === 'sweet-98' ? 'rgba(43, 70, 139, .12)' : 'rgba(9, 44, 41, .42)';
  const lum = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
  if (lum < 0.20) return 'rgba(255, 255, 255, .15)';
  if (lum > 0.72) return skin === 'sweet-98' ? 'rgba(43, 70, 139, .14)' : 'rgba(24, 24, 27, .20)';
  return skin === 'sweet-98' ? 'rgba(43, 70, 139, .14)' : 'rgba(9, 44, 41, .38)';
}
window.getRetroGridColor = getRetroGridColor;

function makeGridBgImage(lineCol) {
  return `linear-gradient(to right, ${lineCol} 1px, transparent 1px), linear-gradient(to bottom, ${lineCol} 1px, transparent 1px)`;
}

function applyWallpaper() {
  const skin = document.documentElement.dataset.skin;
  const isCustomSkin = skin === 'retro-pop' || skin === 'sweet-98';
  const mini = $('#wallMiniStage');
  const hasPhoto = wallState.tab === 'photo' && Boolean(wallState.imgUrl);

  if (isCustomSkin && !hasRetroWallOverride()) {
    delete appEl.dataset.customBg;
    delete appEl.dataset.wallPhoto;
    appEl.style.backgroundColor = '';
    appEl.style.backgroundImage = '';
    appEl.style.backgroundSize = '';
    appEl.style.backgroundRepeat = '';
    appEl.style.backgroundPosition = '';
    if (mini) {
      const defBg = skin === 'sweet-98' ? '#82A3C6' : '#1D7E75';
      const defGrid = skin === 'sweet-98' ? 'rgba(43,70,139,.14)' : 'rgba(9,44,41,.42)';
      mini.style.backgroundColor = defBg;
      mini.style.backgroundImage = makeGridBgImage(defGrid);
      mini.style.backgroundSize = skin === 'sweet-98' ? '12px 12px' : '16px 16px';
      mini.style.backgroundRepeat = 'repeat';
    }
    return;
  }

  if (isCustomSkin) appEl.dataset.customBg = '1';
  else delete appEl.dataset.customBg;

  appEl.style.backgroundColor = wallState.color;
  if (mini) mini.style.backgroundColor = wallState.color;

  if (hasPhoto) {
    if (isCustomSkin) appEl.dataset.wallPhoto = '1';
    else delete appEl.dataset.wallPhoto;
    appEl.style.backgroundImage = `url("${wallState.imgUrl}")`;
    appEl.style.backgroundSize = wallState.fit;
    appEl.style.backgroundRepeat = 'no-repeat';
    appEl.style.backgroundPosition = 'center';
    if (mini) {
      mini.style.backgroundImage = `url("${wallState.imgUrl}")`;
      mini.style.backgroundSize = wallState.fit;
      mini.style.backgroundRepeat = 'no-repeat';
    }
  } else if (isCustomSkin) {
    delete appEl.dataset.wallPhoto;
    const gridCol = getRetroGridColor(wallState.color, skin);
    const tileSz = skin === 'sweet-98' ? '24px 24px' : '38px 38px';
    appEl.style.backgroundImage = makeGridBgImage(gridCol);
    appEl.style.backgroundSize = tileSz;
    appEl.style.backgroundRepeat = 'repeat';
    appEl.style.backgroundPosition = '0 0';
    if (mini) {
      mini.style.backgroundImage = makeGridBgImage(gridCol);
      mini.style.backgroundSize = skin === 'sweet-98' ? '12px 12px' : '16px 16px';
      mini.style.backgroundRepeat = 'repeat';
    }
  } else {
    delete appEl.dataset.wallPhoto;
    appEl.style.backgroundImage = 'none';
    appEl.style.backgroundSize = '';
    appEl.style.backgroundRepeat = '';
    appEl.style.backgroundPosition = '';
    if (mini) {
      mini.style.backgroundImage = 'none';
      mini.style.backgroundSize = '';
      mini.style.backgroundRepeat = '';
    }
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
      setRetroWallOverride(true);
      setWallTab('color');
      syncColorUI();
    });
    colorPresetsEl.appendChild(b);
  });

  wallTabs.querySelectorAll('.wall-tab').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.tab === 'photo' && wallState.imgUrl) setRetroWallOverride(true);
    setWallTab(b.dataset.tab);
  }));

  const updateSVFromPointer = (e) => {
    const rect = svCanvas.getBoundingClientRect();
    wallState.s = Math.round(clampN((e.clientX - rect.left) / rect.width, 0, 1) * 100);
    wallState.v = Math.round((1 - clampN((e.clientY - rect.top) / rect.height, 0, 1)) * 100);
    setRetroWallOverride(true);
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

  hueSlider.addEventListener('input', () => { wallState.h = Number(hueSlider.value); setRetroWallOverride(true); setWallTab('color'); syncColorUI(); });
  satSlider.addEventListener('input', () => { wallState.s = Number(satSlider.value); setRetroWallOverride(true); setWallTab('color'); syncColorUI(); });
  valSlider.addEventListener('input', () => { wallState.v = Number(valSlider.value); setRetroWallOverride(true); setWallTab('color'); syncColorUI(); });

  hexInput.addEventListener('input', () => {
    const rgb = hexToRgb(hexInput.value);
    if (!rgb) return;
    const hsv = rgbToHsv(...rgb);
    if (hsv.s > 0) wallState.h = hsv.h;
    wallState.s = hsv.s;
    wallState.v = hsv.v;
    setRetroWallOverride(true);
    setWallTab('color');
    syncColorUI(true);
  });
  hexInput.addEventListener('blur', () => { hexInput.value = wallState.color; });
  hexInput.addEventListener('keydown', (e) => e.stopPropagation());

  wallUploadBtn.addEventListener('click', () => wallFile.click());
  wallDrop.addEventListener('click', () => wallFile.click());
  wallFile.addEventListener('change', () => {
    const f = wallFile.files && wallFile.files[0];
    if (f) { setRetroWallOverride(true); setWallImage(f); }
    wallFile.value = '';
  });
  wallDrop.addEventListener('dragover', (e) => { e.preventDefault(); wallDrop.classList.add('over'); });
  wallDrop.addEventListener('dragleave', () => wallDrop.classList.remove('over'));
  wallDrop.addEventListener('drop', (e) => {
    e.preventDefault();
    wallDrop.classList.remove('over');
    const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f && f.type.startsWith('image/')) { setRetroWallOverride(true); setWallImage(f); }
  });
  wallClearBtn.addEventListener('click', () => {
    setRetroWallOverride(false);
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
  defaultH: 444,
  onOpen() {
    if (settingsState.sec === 'wallpaper') {
      drawSV();
      updateSliderTracks();
    }
  },
});

function syncSettingsUI() {
  if (!layoutGridEl) return;
  const phone = isPhoneViewport();
  const tablet = isTabletViewport();
  const port = isMobilePortrait();
  const curId = phone ? (mobileLayoutCount >= 2 ? '2-side' : '1-center') : activeLayoutId;
  layoutGridEl.querySelectorAll('.layout-card').forEach((card) => {
    const id = card.dataset.layout;
    const preset = LAYOUT_PRESETS.find((l) => l.id === id);
    const hideMobile = (phone && id !== '1-center' && id !== '2-side') || (tablet && preset && preset.count > 4);
    card.hidden = hideMobile;
    if (preset && !hideMobile) {
      let boxes = preset.boxes;
      let label = `${preset.name} (${preset.count} windows)`;
      if (phone) {
        if (id === '1-center') {
          boxes = port ? [[32, 10, 36, 80, 1]] : [[16, 18, 68, 64, 1]];
          label = port ? 'Portrait Single (1 window)' : 'Landscape Single (1 window)';
        } else if (id === '2-side') {
          boxes = port ? [[20, 6, 60, 41, 0], [20, 53, 60, 41, 1]] : [[6, 20, 42, 60, 0], [52, 20, 42, 60, 1]];
          label = port ? 'Top & Bottom (2 windows)' : 'Left & Right (2 windows)';
        }
      }
      card.title = label;
      card.setAttribute('aria-label', label);
      const previewEl = card.querySelector('.layout-preview');
      if (previewEl) {
        previewEl.innerHTML = boxes.map(([x, y, w, h, f]) =>
          `<span class="lp-win${f ? ' front' : ''}" style="left:${x}%;top:${y}%;width:${w}%;height:${h}%"></span>`
        ).join('');
      }
    }
    const active = id === curId;
    card.classList.toggle('active', active);
    card.setAttribute('aria-checked', String(active));
  });
}

function setSettingsSection(sec) {
  settingsState.sec = sec;
  const nav = $('#settingsNav');
  if (nav) {
    nav.querySelectorAll('.sb-nav-btn').forEach((b) => {
      const on = b.dataset.sec === sec;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', String(on));
    });
  }
  $('#setPaneLayout').hidden = sec !== 'layout';
  const themePane = $('#setPaneTheme');
  if (themePane) themePane.hidden = sec !== 'theme';
  const wallPane = $('#setPaneWallpaper');
  if (wallPane) wallPane.hidden = sec !== 'wallpaper';
  $('#setPaneFlash').hidden = sec !== 'flash';
  const timerPane = $('#setPaneTimer');
  if (timerPane) timerPane.hidden = sec !== 'timer';
  const permPane = $('#setPanePermissions');
  if (permPane) permPane.hidden = sec !== 'permissions';
  $('#setPaneAbout').hidden = sec !== 'about';
  const resetPane = $('#setPaneReset');
  if (resetPane) resetPane.hidden = sec !== 'reset';
  const titles = { layout: 'Layout', theme: 'Theme', wallpaper: 'Wallpaper', flash: 'Flash', timer: 'Timer', permissions: 'Permissions', about: 'About', reset: 'Reset' };
  $('#settingsPaneTitle').textContent = titles[sec] || 'Settings';
  if (sec === 'theme' && typeof syncThemeUI === 'function') syncThemeUI();
  if (sec === 'wallpaper') {
    drawSV();
    updateSliderTracks();
  }
  if (sec === 'permissions') {
    refreshPermissionsUI();
  }
  if (sec === 'about') {
    const stEl = $('#aboutStorageVal');
    if (stEl) stEl.textContent = `IndexedDB · ${sharedItems.length} item${sharedItems.length === 1 ? '' : 's'}`;
  }
  if (sec === 'reset') {
    const cntEl = $('#resetMediaCount');
    if (cntEl) cntEl.textContent = `${sharedItems.length} item${sharedItems.length === 1 ? '' : 's'}`;
    const startBtn = $('#resetStartBtn');
    const confirmBox = $('#resetConfirmBox');
    if (startBtn) startBtn.hidden = false;
    if (confirmBox) confirmBox.hidden = true;
  }
  updateFillLight();
}

function openSettingsFlash() {
  settingsApp.open();
  setSettingsSection('flash');
}

const SETTINGS_SEARCH_TERMS = {
  layout: 'layout window arrangement multi split center side grid camera',
  theme: 'theme appearance mode light dark auto system accent color ui custom retro pop sweet 98 dear os win98 pastel pink blue',
  wallpaper: 'wallpaper background color photo image hue saturation brightness hex fit cover contain',
  flash: 'flash fill light pre-flash brightness glow color screen',
  timer: 'timer countdown seconds delay instant 0s 3s 5s custom beep',
  permissions: 'permissions camera microphone mic access allow blocked privacy retry',
  about: 'about mac rupa booth creator instagram privacy encryption storage webgl version',
  reset: 'reset clear wipe erase reload storage cache fix broken data',
};

function buildSettingsUI() {
  const nav = $('#settingsNav');
  const searchInput = $('#settingsSearch');
  const searchClear = $('#settingsSearchClear');
  const noResultsEl = $('#settingsNoResults');

  const applySettingsFilter = () => {
    if (!nav) return;
    const q = (searchInput?.value || '').trim().toLowerCase();
    if (searchClear) searchClear.hidden = q.length === 0;
    let shown = 0;
    nav.querySelectorAll('.sb-nav-btn').forEach((btn) => {
      const sec = btn.dataset.sec || '';
      const label = btn.textContent.toLowerCase();
      const hay = `${label} ${SETTINGS_SEARCH_TERMS[sec] || ''}`;
      const match = !q || hay.includes(q);
      btn.hidden = !match;
      if (match) shown += 1;
    });
    if (noResultsEl) noResultsEl.hidden = shown > 0;
  };

  if (nav) {
    nav.querySelectorAll('.sb-nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => setSettingsSection(btn.dataset.sec));
    });
  }
  searchInput?.addEventListener('input', applySettingsFilter);
  searchInput?.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' && searchInput.value) {
      searchInput.value = '';
      applySettingsFilter();
    } else if (e.key === 'Enter' && nav) {
      if (e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      const first = nav.querySelector('.sb-nav-btn:not([hidden])');
      if (first) setSettingsSection(first.dataset.sec);
    }
  });
  searchClear?.addEventListener('click', () => {
    if (!searchInput) return;
    searchInput.value = '';
    applySettingsFilter();
    searchInput.focus();
  });

  const modeSeg = $('#flashModeSeg');
  const presetsEl = $('#flashPresets');
  const colorPicker = $('#flashColorPicker');
  const customWrap = colorPicker?.closest('.flash-custom-pick');
  const customSwatch = $('#flashCustomSwatch');
  const brightInput = $('#flashBright');
  const brightVal = $('#flashBrightVal');
  const previewBox = $('#flashPreviewBox');
  const previewLabel = $('#flashPreviewLabel');

  const syncFlashSettingsUI = () => {
    modeSeg?.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.fmode === flashCfg.mode);
    });
    const matchedPreset = FLASH_PRESETS.some((p) => p.toUpperCase() === flashCfg.color.toUpperCase());
    presetsEl?.querySelectorAll('.flash-swatch').forEach((s) => {
      s.classList.toggle('active', s.dataset.fcolor.toUpperCase() === flashCfg.color.toUpperCase());
    });
    if (customWrap) customWrap.classList.toggle('active', !matchedPreset);
    if (customSwatch && !matchedPreset) customSwatch.style.background = flashCfg.color;
    else if (customSwatch) customSwatch.style.background = '';
    if (colorPicker) colorPicker.value = flashCfg.color;
    if (brightInput) brightInput.value = String(flashCfg.brightness);
    if (brightVal) brightVal.textContent = `${flashCfg.brightness}%`;
    if (previewBox) {
      const m = flashLightMetrics();
      previewBox.style.setProperty('--fp-ring', `${Math.round(3 + m.t * 15)}px`);
      previewBox.style.setProperty('--fp-rad', `${Math.round(9 + m.t * 7)}px`);
      previewBox.style.setProperty('--fp-blur', `${Math.round(8 + m.t * 22)}px`);
      previewBox.style.setProperty('--fp-spread', `${Math.round(2 + m.t * 6)}px`);
      previewBox.style.setProperty('--fp-color', m.color);
      previewBox.style.setProperty('--fp-glow', m.glow);
    }
    if (previewLabel) {
      previewLabel.textContent = `${flashCfg.mode === 'fill' ? 'Fill Light' : 'Pre-Flash'} · ${flashCfg.brightness}% · ${flashCfg.color.toUpperCase()}`;
    }
    saveFlashCfg();
    updateFillLight();
    if (typeof updateShotUI === 'function') updateShotUI();
  };

  if (presetsEl) {
    presetsEl.replaceChildren();
    for (const hex of FLASH_PRESETS) {
      const sw = document.createElement('button');
      sw.type = 'button';
      sw.className = 'flash-swatch';
      sw.dataset.fcolor = hex;
      sw.style.background = hex;
      sw.title = hex;
      sw.setAttribute('aria-label', `Flash color ${hex}`);
      sw.addEventListener('click', () => {
        flashCfg.color = hex;
        syncFlashSettingsUI();
      });
      presetsEl.appendChild(sw);
    }
  }
  modeSeg?.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => {
      flashCfg.mode = b.dataset.fmode === 'fill' ? 'fill' : 'flash';
      syncFlashSettingsUI();
    });
  });
  colorPicker?.addEventListener('input', () => {
    flashCfg.color = colorPicker.value.toUpperCase();
    syncFlashSettingsUI();
  });
  brightInput?.addEventListener('input', () => {
    flashCfg.brightness = Math.max(20, Math.min(100, Number(brightInput.value) || 92));
    syncFlashSettingsUI();
  });
  syncFlashSettingsUI();

  const timerSeg = $('#timerPresetSeg');
  const timerRange = $('#timerCustomRange');
  const timerInput = $('#timerCustomInput');
  const timerCustomRow = $('#timerCustomRow');
  const timerBadge = $('#timerBadge');
  const timerSummaryTitle = $('#timerSummaryTitle');
  const timerSummaryDesc = $('#timerSummaryDesc');

  const syncTimerSettingsUI = (preserveTyping = false) => {
    const sec = getTimerSeconds();
    timerSeg?.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', b.dataset.tpreset === timerCfg.preset);
    });
    if (timerCustomRow) timerCustomRow.hidden = timerCfg.preset !== 'custom';
    if (timerRange) timerRange.value = String(timerCfg.custom);
    if (timerInput && !preserveTyping) timerInput.value = String(timerCfg.custom);
    if (timerBadge) timerBadge.textContent = `${sec}s`;
    if (timerSummaryTitle) {
      if (sec === 0) timerSummaryTitle.textContent = '0s (Instant)';
      else if (timerCfg.preset === 'custom') timerSummaryTitle.textContent = `${sec} Second${sec === 1 ? '' : 's'} (Custom)`;
      else timerSummaryTitle.textContent = `${sec} Seconds`;
    }
    if (timerSummaryDesc) {
      timerSummaryDesc.textContent = sec === 0
        ? 'Instant photo/video · 4-Up bursts every 0.5s'
        : (sec > 5
          ? `Photo Booth & Screenshot · Beep plays on last 3s`
          : 'Photo Booth (Photo, 4-Up & Video) and Screenshot');
    }
    saveTimerCfg();
  };

  timerSeg?.querySelectorAll('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.tpreset;
      timerCfg.preset = ['0', '3', '5', 'custom'].includes(p) ? p : '3';
      syncTimerSettingsUI();
      if (timerCfg.preset === 'custom' && timerInput) {
        timerInput.focus();
        timerInput.select();
      }
    });
  });
  timerRange?.addEventListener('input', () => {
    timerCfg.custom = clampCustomTimer(timerRange.value);
    timerCfg.preset = 'custom';
    syncTimerSettingsUI();
  });
  timerInput?.addEventListener('input', () => {
    const raw = timerInput.value.trim();
    if (raw === '') return;
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    timerCfg.custom = clampCustomTimer(n);
    timerCfg.preset = 'custom';
    syncTimerSettingsUI(true);
  });
  timerInput?.addEventListener('change', () => {
    timerCfg.custom = clampCustomTimer(timerInput.value);
    timerCfg.preset = 'custom';
    syncTimerSettingsUI(false);
  });
  syncTimerSettingsUI();

  const runPermAction = async (btn, busyLabel, task, restoreLabel = null) => {
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = busyLabel;
    await task();
    await refreshPermissionsUI();
    btn.disabled = false;
    if (restoreLabel) btn.textContent = restoreLabel;
  };
  const permCamBtn = $('#permCamBtn');
  const permMicBtn = $('#permMicBtn');
  const permAllBtn = $('#permAllBtn');
  permCamBtn?.addEventListener('click', () => runPermAction(
    permCamBtn,
    'Checking…',
    () => (typeof startCamera === 'function' ? startCamera(true) : Promise.resolve())
  ));
  permMicBtn?.addEventListener('click', () => runPermAction(
    permMicBtn,
    'Checking…',
    () => (typeof requestMicPermission === 'function' ? requestMicPermission() : Promise.resolve())
  ));
  permAllBtn?.addEventListener('click', () => runPermAction(
    permAllBtn,
    'Requesting…',
    async () => {
      if (typeof startCamera === 'function') await startCamera(true);
      if (typeof requestMicPermission === 'function') await requestMicPermission();
    },
    'Request Camera & Microphone'
  ));
  refreshPermissionsUI();

const THEME_MODES = [
  { id: 'system', name: 'Auto', cls: 'theme-thumb-system' },
  { id: 'light',  name: 'Light', cls: 'theme-thumb-light' },
  { id: 'dark',   name: 'Dark',  cls: 'theme-thumb-dark' },
];
const CUSTOM_THEMES = [
  { id: 'retro-pop', name: 'Retro Pop', cls: 'theme-thumb-retro', badge: 'Custom' },
  { id: 'sweet-98',  name: 'Sweet 98',  cls: 'theme-thumb-sweet98', badge: 'Custom' },
];
const ACCENT_PRESETS = [
  { id: 'blue',     name: 'Blue',     hex: '#0A84FF' },
  { id: 'purple',   name: 'Purple',   hex: '#AF52DE' },
  { id: 'pink',     name: 'Pink',     hex: '#FF2D55' },
  { id: 'orange',   name: 'Orange',   hex: '#FF9500' },
  { id: 'green',    name: 'Green',    hex: '#28CD41' },
  { id: 'graphite', name: 'Graphite', hex: '#6E6E73' },
];
const themeColorQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
const colorSchemeMeta = document.querySelector('meta[name="color-scheme"]');
const themeColorMeta = document.querySelector('meta[name="theme-color"]');

function getStoredThemeMode() {
  try {
    const v = localStorage.getItem('pb.theme');
    return v === 'light' || v === 'dark' || v === 'retro-pop' || v === 'sweet-98' ? v : 'system';
  } catch (_) {
    return 'system';
  }
}

function getStoredAccentId() {
  try {
    const v = localStorage.getItem('pb.accent');
    return ACCENT_PRESETS.some((a) => a.id === v) ? v : 'blue';
  } catch (_) {
    return 'blue';
  }
}

function getResolvedTheme(mode = getStoredThemeMode()) {
  if (mode === 'retro-pop' || mode === 'sweet-98') return 'light';
  if (mode === 'light' || mode === 'dark') return mode;
  return themeColorQuery && themeColorQuery.matches ? 'dark' : 'light';
}

function syncThemeDocument(mode = getStoredThemeMode(), accentId = getStoredAccentId()) {
  const isCustomSkin = mode === 'retro-pop' || mode === 'sweet-98';
  const resolved = getResolvedTheme(mode);
  if (colorSchemeMeta) {
    colorSchemeMeta.content = isCustomSkin ? 'light' : (mode === 'system' ? 'light dark' : mode);
  }
  if (isCustomSkin) {
    document.documentElement.dataset.theme = 'light';
    document.documentElement.dataset.skin = mode;
  } else {
    delete document.documentElement.dataset.skin;
    if (mode === 'light' || mode === 'dark') {
      document.documentElement.dataset.theme = mode;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }
  if (accentId && accentId !== 'blue') {
    document.documentElement.dataset.accent = accentId;
  } else {
    delete document.documentElement.dataset.accent;
  }
  if (themeColorMeta) {
    themeColorMeta.content = mode === 'retro-pop'
      ? '#1D7E75'
      : mode === 'sweet-98'
        ? '#82A3C6'
        : (resolved === 'dark' ? '#0b0b0f' : '#eef0f5');
  }
  const accentObj = ACCENT_PRESETS.find((a) => a.id === accentId) || ACCENT_PRESETS[0];
  let resolvedAccentHex = accentObj.hex;
  if (accentObj.id === 'blue') {
    if (mode === 'retro-pop') resolvedAccentHex = '#2563EB';
    else if (mode === 'sweet-98') resolvedAccentHex = '#2B468B';
  }
  window.__rupaTheme = {
    mode,
    resolved,
    skin: isCustomSkin ? mode : null,
    accentId: accentObj.id,
    accentHex: resolvedAccentHex,
  };
  if (typeof applyWallpaper === 'function') applyWallpaper();
}

function syncThemeUI() {
  const mode = getStoredThemeMode();
  const resolved = getResolvedTheme(mode);
  const accentId = getStoredAccentId();
  ['#themeModeGrid', '#customThemeGrid'].forEach((sel) => {
    const grid = $(sel);
    if (!grid) return;
    grid.querySelectorAll('.theme-card').forEach((card) => {
      const on = card.dataset.tmode === mode;
      card.classList.toggle('active', on);
      card.setAttribute('aria-checked', String(on));
    });
  });
  const statusEl = $('#themeModeStatus');
  if (statusEl) {
    const resLabel = resolved === 'dark' ? 'Dark' : 'Light';
    statusEl.textContent = mode === 'retro-pop'
      ? 'Custom theme: Retro Pop (Neo-Brutalist Teal & Cream).'
      : mode === 'sweet-98'
        ? 'Custom theme: Sweet 98 (Pastel Win98 Powder Blue & Cream).'
        : mode === 'system'
          ? `Following system preference (Currently ${resLabel}).`
          : `Pinned to ${mode === 'dark' ? 'Dark' : 'Light'} appearance.`;
  }
  const accentRow = $('#accentSwatchRow');
  if (accentRow) {
    accentRow.querySelectorAll('.accent-dot').forEach((btn) => {
      const on = btn.dataset.accent === accentId;
      btn.classList.toggle('active', on);
      btn.setAttribute('aria-checked', String(on));
    });
  }
}

function applyThemeMode(mode, persist = true) {
  const next = mode === 'light' || mode === 'dark' || mode === 'retro-pop' || mode === 'sweet-98' ? mode : 'system';
  if (persist) {
    if (next === 'retro-pop' || next === 'sweet-98') setRetroWallOverride(false);
    try {
      if (next === 'system') localStorage.removeItem('pb.theme');
      else localStorage.setItem('pb.theme', next);
    } catch (_) { /* ignore */ }
  }
  syncThemeDocument(next, getStoredAccentId());
  syncThemeUI();
}

function applyAccentColor(id, persist = true) {
  const next = ACCENT_PRESETS.some((a) => a.id === id) ? id : 'blue';
  if (persist) {
    try {
      if (next === 'blue') localStorage.removeItem('pb.accent');
      else localStorage.setItem('pb.accent', next);
    } catch (_) { /* ignore */ }
  }
  syncThemeDocument(getStoredThemeMode(), next);
  syncThemeUI();
}

function createThemeCardEl(item, isCustom) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = isCustom ? 'theme-card theme-card-custom' : 'theme-card';
  card.dataset.tmode = item.id;
  card.setAttribute('role', 'radio');
  card.setAttribute('aria-checked', 'false');
  card.setAttribute('aria-label', `${item.name} theme`);

  const thumb = document.createElement('div');
  thumb.className = `theme-thumb ${item.cls}`;
  const win = document.createElement('div');
  win.className = 'theme-mini-win';
  const bar = document.createElement('div');
  bar.className = 'theme-mini-bar';
  for (let i = 0; i < 3; i++) bar.appendChild(document.createElement('i'));
  const pill = document.createElement('span');
  pill.className = 'theme-mini-pill';
  win.append(bar, pill);
  thumb.appendChild(win);

  if (isCustom && item.badge) {
    const metaRow = document.createElement('div');
    metaRow.className = 'theme-card-top';
    const lbl = document.createElement('span');
    lbl.textContent = item.name;
    const badge = document.createElement('span');
    badge.className = 'theme-badge';
    badge.textContent = item.badge;
    metaRow.append(lbl, badge);
    card.append(thumb, metaRow);
  } else {
    const lbl = document.createElement('span');
    lbl.textContent = item.name;
    card.append(thumb, lbl);
  }
  card.addEventListener('click', () => applyThemeMode(item.id, true));
  return card;
}

function buildThemeUI() {
  const modeGrid = $('#themeModeGrid');
  if (modeGrid) {
    modeGrid.replaceChildren();
    for (const m of THEME_MODES) modeGrid.appendChild(createThemeCardEl(m, false));
  }
  const customGrid = $('#customThemeGrid');
  if (customGrid) {
    customGrid.replaceChildren();
    for (const ct of CUSTOM_THEMES) customGrid.appendChild(createThemeCardEl(ct, true));
  }

  const accentRow = $('#accentSwatchRow');
  if (accentRow) {
    accentRow.replaceChildren();
    for (const ac of ACCENT_PRESETS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'accent-dot';
      btn.dataset.accent = ac.id;
      btn.style.background = ac.hex;
      btn.title = ac.name;
      btn.setAttribute('role', 'radio');
      btn.setAttribute('aria-checked', 'false');
      btn.setAttribute('aria-label', `${ac.name} accent color`);
      btn.addEventListener('click', () => applyAccentColor(ac.id, true));
      accentRow.appendChild(btn);
    }
  }

  syncThemeDocument();
  syncThemeUI();

  if (themeColorQuery) {
    const onSysChange = () => {
      syncThemeDocument();
      syncThemeUI();
    };
    if (typeof themeColorQuery.addEventListener === 'function') {
      themeColorQuery.addEventListener('change', onSysChange);
    } else if (typeof themeColorQuery.addListener === 'function') {
      themeColorQuery.addListener(onSysChange);
    }
  }
  window.addEventListener('storage', (e) => {
    if (e.key === 'pb.theme' || e.key === 'pb.accent' || e.key === 'pb.retroWallOverride' || e.key === null) {
      syncThemeDocument();
      syncThemeUI();
    }
  });
}

  buildThemeUI();
  layoutGridEl.replaceChildren();
  for (const preset of LAYOUT_PRESETS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'layout-card' + (preset.id === activeLayoutId ? ' active' : '');
    btn.dataset.layout = preset.id;
    btn.title = `${preset.name} (${preset.count} windows)`;
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-label', `${preset.name} (${preset.count} windows)`);
    btn.setAttribute('aria-checked', String(preset.id === activeLayoutId));
    const preview = document.createElement('div');
    preview.className = 'layout-preview';
    for (const [x, y, w, h, f] of preset.boxes) {
      const box = document.createElement('span');
      box.className = f ? 'lp-win front' : 'lp-win';
      box.style.left = `${x}%`;
      box.style.top = `${y}%`;
      box.style.width = `${w}%`;
      box.style.height = `${h}%`;
      preview.appendChild(box);
    }
    btn.appendChild(preview);
    btn.addEventListener('click', () => applyLayout(preset.id, true));
    layoutGridEl.appendChild(btn);
  }
  syncSettingsUI();

  const resetStartBtn = $('#resetStartBtn');
  const resetConfirmBox = $('#resetConfirmBox');
  const resetCancelBtn = $('#resetCancelBtn');
  const resetConfirmBtn = $('#resetConfirmBtn');

  resetStartBtn?.addEventListener('click', () => {
    resetStartBtn.hidden = true;
    if (resetConfirmBox) resetConfirmBox.hidden = false;
  });
  resetCancelBtn?.addEventListener('click', () => {
    if (resetConfirmBox) resetConfirmBox.hidden = true;
    if (resetStartBtn) resetStartBtn.hidden = false;
  });
  resetConfirmBtn?.addEventListener('click', async () => {
    resetConfirmBtn.disabled = true;
    if (resetCancelBtn) resetCancelBtn.disabled = true;
    resetConfirmBtn.textContent = 'Resetting…';
    await executeFullReset();
  });
}

const PERM_LABELS = { granted: 'Allowed', denied: 'Blocked', prompt: 'Not Asked', unavailable: 'Unavailable' };
async function refreshPermissionsUI() {
  const st = typeof queryPermissionStates === 'function'
    ? await queryPermissionStates()
    : { camera: 'prompt', microphone: 'prompt' };
  const applyRow = (state, pillEl, btnEl) => {
    const s = PERM_LABELS[state] ? state : 'prompt';
    if (pillEl) {
      pillEl.dataset.state = s;
      pillEl.textContent = PERM_LABELS[s];
    }
    if (btnEl && !btnEl.disabled) {
      btnEl.textContent = s === 'granted' ? 'Re-check' : (s === 'denied' ? 'Retry' : 'Request');
    }
  };
  applyRow(st.camera, $('#permCamStatus'), $('#permCamBtn'));
  applyRow(st.microphone, $('#permMicStatus'), $('#permMicBtn'));
}

/* ------------------------- Startup Welcome Sheet ------------------------- */
const welcomeModalEl = $('#welcomeModal');
const welcomeCloseBtn = $('#welcomeCloseBtn');
const welcomeStartBtn = $('#welcomeStartBtn');
const aboutWelcomeBtn = $('#aboutWelcomeBtn');

let welcomePrevFocus = null;
function openWelcomeModal() {
  if (!welcomeModalEl) return false;
  welcomePrevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  welcomeModalEl.hidden = false;
  if (typeof syncModalInert === 'function') syncModalInert();
  welcomeStartBtn?.focus({ preventScroll: true });
  return true;
}

function closeWelcomeModal() {
  if (!welcomeModalEl || welcomeModalEl.hidden) return false;
  welcomeModalEl.hidden = true;
  if (typeof syncModalInert === 'function') syncModalInert();
  if (welcomePrevFocus && welcomePrevFocus.isConnected && typeof welcomePrevFocus.focus === 'function') {
    try { welcomePrevFocus.focus({ preventScroll: true }); } catch (_) {}
  }
  welcomePrevFocus = null;
  if (typeof requestInitialMediaPermissions === 'function') {
    requestInitialMediaPermissions();
  }
  return true;
}

welcomeCloseBtn?.addEventListener('click', closeWelcomeModal);
welcomeStartBtn?.addEventListener('click', closeWelcomeModal);
welcomeModalEl?.addEventListener('click', (e) => {
  if (e.target === welcomeModalEl) closeWelcomeModal();
});
aboutWelcomeBtn?.addEventListener('click', openWelcomeModal);

/* ------------------------- Files App ------------------------- */
const filesWin = $('#filesWin');
const filesTabsEl = $('#filesTabs');
const filesGridEl = $('#filesGrid');
const filesEmptyEl = $('#filesEmpty');
const filesPreviewEl = $('#filesPreview');
const fpMetaEl = $('#fpMeta');
const fpMediaBoxEl = $('#fpMediaBox');
const fpImgEl = $('#fpImg');
const fpVideoEl = $('#fpVideo');
const fpMoreBtn = $('#fpMoreBtn');
const fpMoreMenuEl = $('#fpMoreMenu');
const fpQrBtn = $('#fpQr');
const fpShareBtn = $('#fpShare');
const fpDlBtn = $('#fpDl');
const fpWallBtn = $('#fpWall');
const fpDelBtn = $('#fpDel');
const fpBackBtn = $('#fpBack');
const fpFullBtn = $('#fpFullBtn');
const quickLookEl = $('#quickLook');
const qlCloseBtn = $('#qlCloseBtn');
const qlTitleEl = $('#qlTitle');
const qlIndexEl = $('#qlIndex');
const qlShareBtn = $('#qlShareBtn');
const qlDlBtn = $('#qlDlBtn');
const qlImgEl = $('#qlImg');
const qlVideoEl = $('#qlVideo');
const qlStageEl = $('#qlStage');
const qlPrevBtn = $('#qlPrevBtn');
const qlNextBtn = $('#qlNextBtn');
const fpVideoUI = fpVideoEl ? createUnifiedVideoPlayer(fpVideoEl, { hostEl: fpMediaBoxEl, compact: true }) : null;
const qlVideoUI = qlVideoEl ? createUnifiedVideoPlayer(qlVideoEl, { hostEl: qlStageEl }) : null;
const filesTopTools = $('#filesTopTools');
const filesViewSeg = $('#filesViewSeg');
const filesSelectBtn = $('#filesSelectBtn');
const filesSelBar = $('#filesSelBar');
const filesSelCountNumEl = $('#filesSelCountNum');
const filesSelAllBtn = $('#filesSelAllBtn');
const filesSelShareBtn = $('#filesSelShareBtn');
const filesSelQrBtn = $('#filesSelQrBtn');
const filesSelQrCountEl = $('#filesSelQrCount');

const filesState = {
  open: false, minimized: false, placed: false, x: 0, y: 0,
  filter: 'all', selectedId: null, previewUrl: null,
  selecting: false, selectedIds: new Set(),
  view: (() => { try { return localStorage.getItem('pb_files_view') === 'list' ? 'list' : 'grid'; } catch (_) { return 'grid'; } })(),
};

const quickLookState = { open: false, id: null, url: null };

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
  onClose() { closeQuickLook(); toggleFpMoreMenu(false); closeShareMenu(); },
});

function itemCategory(item) {
  if (item.type === 'screenshot') return 'screenshot';
  if (item.type === 'video') return 'video';
  return 'photo';
}

function itemKindShort(item) {
  if (item.type === 'screenshot') return 'Shot';
  if (item.type === 'video') return 'Video';
  if (item.type === '4up') return '4-Up';
  return 'Photo';
}

function itemDisplayName(item) {
  if (item.name) return item.name;
  if (item.type === 'video') return `Video ${stamp(item.createdAt)}`;
  if (item.type === 'screenshot') return `Screenshot ${stamp(item.createdAt)}`;
  return `Photo ${stamp(item.createdAt)}`;
}

function itemShortTitle(item) {
  const d = new Date(item.createdAt || Date.now());
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${itemKindShort(item)} ${hh}:${mm}`;
}

function formatShortDate(ts) {
  const d = new Date(ts || Date.now());
  const m = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${m} ${d.getDate()}, ${hh}:${mm}`;
}

function toggleFpMoreMenu(force) {
  if (!fpMoreMenuEl || !fpMoreBtn) return;
  const open = force === undefined ? fpMoreMenuEl.hidden : Boolean(force);
  fpMoreMenuEl.hidden = !open;
  fpMoreBtn.setAttribute('aria-expanded', String(open));
}

function closeQuickLook() {
  if (!quickLookEl) return;
  if (qlVideoUI) qlVideoUI.reset();
  if (qlImgEl) {
    qlImgEl.removeAttribute('src');
    qlImgEl.hidden = true;
  }
  if (quickLookState.url) {
    URL.revokeObjectURL(quickLookState.url);
    quickLookState.url = null;
  }
  quickLookState.open = false;
  quickLookState.id = null;
  quickLookEl.hidden = true;
  if (typeof syncModalInert === 'function') syncModalInert();
  const prev = quickLookState.prevFocus;
  quickLookState.prevFocus = null;
  if (prev && prev.isConnected && typeof prev.focus === 'function') {
    try { prev.focus({ preventScroll: true }); } catch (_) {}
  }
}

function openQuickLook(id) {
  if (!quickLookEl) return;
  const list = getVisibleFilesList();
  const item = sharedItems.find((i) => i.id === id);
  if (!item) return;
  if (fpVideoEl && !fpVideoEl.paused) fpVideoEl.pause();
  toggleFpMoreMenu(false);

  if (quickLookState.url) { URL.revokeObjectURL(quickLookState.url); quickLookState.url = null; }
  if (!quickLookState.open) {
    quickLookState.prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }
  quickLookState.open = true;
  quickLookState.id = id;
  quickLookState.url = URL.createObjectURL(item.blob);

  if (qlTitleEl) qlTitleEl.textContent = itemDisplayName(item);
  const idx = list.findIndex((x) => x.id === id);
  if (qlIndexEl) {
    qlIndexEl.hidden = list.length <= 1 || idx < 0;
    if (!qlIndexEl.hidden) qlIndexEl.textContent = `${idx + 1} / ${list.length}`;
  }
  const hasNav = list.length > 1 && idx >= 0;
  if (qlPrevBtn) qlPrevBtn.hidden = !hasNav;
  if (qlNextBtn) qlNextBtn.hidden = !hasNav;

  const isVideo = item.type === 'video';
  if (isVideo) {
    qlImgEl.hidden = true;
    if (qlVideoUI) qlVideoUI.setMedia(quickLookState.url, thumbUrl(item));
    if (qlVideoEl) qlVideoEl.play().catch(() => {});
  } else {
    if (qlVideoUI) qlVideoUI.reset();
    qlImgEl.hidden = false;
    qlImgEl.src = quickLookState.url;
  }
  quickLookEl.hidden = false;
  if (typeof syncModalInert === 'function') syncModalInert();
  qlCloseBtn?.focus({ preventScroll: true });
}

function stepQuickLook(delta) {
  if (!quickLookState.open) return;
  const list = getVisibleFilesList();
  if (list.length <= 1) return;
  const cur = list.findIndex((x) => x.id === quickLookState.id);
  const nextIdx = cur < 0 ? 0 : (cur + delta + list.length) % list.length;
  const nextItem = list[nextIdx];
  if (!nextItem) return;
  openFilePreview(nextItem.id);
  openQuickLook(nextItem.id);
}

function closeFilePreview() {
  closeQuickLook();
  toggleFpMoreMenu(false);
  if (fpVideoUI) fpVideoUI.reset();
  fpImgEl.removeAttribute('src');
  if (filesState.previewUrl) { URL.revokeObjectURL(filesState.previewUrl); filesState.previewUrl = null; }
  filesState.selectedId = null;
  if (fpWallBtn) fpWallBtn.classList.remove('applied');
  if (fpMediaBoxEl) fpMediaBoxEl.classList.remove('is-video');
  filesPreviewEl.hidden = true;
  closeShareMenu();
  syncFilesSelectionUI();
}

function openFilePreview(id) {
  const item = sharedItems.find((i) => i.id === id);
  if (!item) return;
  closeFilePreview();
  filesState.selectedId = id;
  filesState.previewUrl = URL.createObjectURL(item.blob);
  fpMetaEl.textContent = itemDisplayName(item);
  const isVideo = item.type === 'video';
  if (fpMediaBoxEl) fpMediaBoxEl.classList.toggle('is-video', isVideo);
  if (fpWallBtn) {
    fpWallBtn.hidden = isVideo;
    fpWallBtn.classList.remove('applied');
  }
  if (isVideo) {
    fpImgEl.hidden = true;
    if (fpVideoUI) fpVideoUI.setMedia(filesState.previewUrl, thumbUrl(item));
  } else {
    if (fpVideoUI) fpVideoUI.reset();
    fpImgEl.hidden = false;
    fpImgEl.src = filesState.previewUrl;
  }
  filesPreviewEl.hidden = false;
  syncFilesSelectionUI();
}

function itemExtension(item) {
  if (item.type === 'video') return item.mime && item.mime.includes('mp4') ? 'mp4' : 'webm';
  return item.type === 'screenshot' ? 'png' : 'jpg';
}

function itemFileName(item) {
  return `${itemDisplayName(item)}.${itemExtension(item)}`;
}

function downloadFileItem(item) {
  const a = document.createElement('a');
  const u = URL.createObjectURL(item.blob);
  a.href = u;
  a.download = itemFileName(item);
  a.click();
  setTimeout(() => URL.revokeObjectURL(u), 2000);
}

function getVisibleFilesList() {
  return sharedItems
    .filter((item) => filesState.filter === 'all' || itemCategory(item) === filesState.filter)
    .toSorted((a, b) => b.createdAt - a.createdAt);
}

function syncFilesSelectionUI() {
  const list = getVisibleFilesList();
  const visibleIds = new Set(list.map((i) => i.id));
  for (const id of [...filesState.selectedIds]) {
    if (!visibleIds.has(id)) filesState.selectedIds.delete(id);
  }
  if (list.length === 0 && filesState.selecting) filesState.selecting = false;
  filesWin.classList.toggle('selecting', filesState.selecting);
  if (filesSelectBtn) {
    const inPreview = Boolean(filesPreviewEl && !filesPreviewEl.hidden);
    const hideTools = inPreview || list.length === 0;
    if (filesTopTools) filesTopTools.hidden = hideTools;
    filesSelectBtn.hidden = hideTools;
    if (filesViewSeg) filesViewSeg.hidden = hideTools;
    filesSelectBtn.classList.toggle('active', filesState.selecting);
    const lbl = filesState.selecting ? 'Done' : 'Select';
    filesSelectBtn.textContent = lbl;
    filesSelectBtn.title = lbl;
    filesSelectBtn.setAttribute('aria-label', lbl);
  }
  if (filesSelBar) filesSelBar.hidden = !filesState.selecting;
  const n = filesState.selectedIds.size;
  if (filesSelCountNumEl) filesSelCountNumEl.textContent = String(n);
  if (filesSelAllBtn) {
    const isAll = n > 0 && n === list.length;
    filesSelAllBtn.classList.toggle('all', isAll);
    const allLbl = isAll ? 'Clear' : 'Select All';
    filesSelAllBtn.title = allLbl;
    filesSelAllBtn.setAttribute('aria-label', allLbl);
  }
  if (filesSelShareBtn) filesSelShareBtn.disabled = n === 0;
  if (filesSelQrBtn) filesSelQrBtn.disabled = n === 0;
  if (filesSelQrCountEl) {
    filesSelQrCountEl.textContent = String(n);
    filesSelQrCountEl.hidden = n <= 1;
  }
}

function getSelectedFileItems() {
  return getVisibleFilesList().filter((i) => filesState.selectedIds.has(i.id));
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

  const list = getVisibleFilesList();
  syncFilesSelectionUI();
  const isList = filesState.view === 'list';
  filesGridEl.classList.toggle('list-view', isList);
  if (filesViewSeg) {
    filesViewSeg.querySelectorAll('.fview-btn').forEach((b) => {
      const on = b.dataset.fview === filesState.view;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    });
  }

  filesGridEl.replaceChildren();
  filesEmptyEl.hidden = list.length > 0;
  for (const item of list) {
    const picked = filesState.selecting && filesState.selectedIds.has(item.id);
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'file-card' + (picked ? ' picked' : '');
    const chk = document.createElement('span');
    chk.className = 'fc-check';
    chk.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5 9.5-9.5"/></svg>';
    const thumbBox = document.createElement('div');
    thumbBox.className = 'file-thumb';
    const imgEl = document.createElement('img');
    imgEl.alt = '';
    imgEl.loading = 'lazy';
    imgEl.decoding = 'async';
    imgEl.src = thumbUrl(item);
    thumbBox.append(chk, imgEl);
    if (item.type === 'video') {
      const playEl = document.createElement('span');
      playEl.className = 'fc-play';
      playEl.innerHTML = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.2 2.2L9.8 6 3.2 9.8z"/></svg>';
      thumbBox.appendChild(playEl);
    }
    const nameEl = document.createElement('div');
    nameEl.className = 'file-name';
    nameEl.textContent = isList ? itemDisplayName(item) : itemShortTitle(item);
    const kindEl = document.createElement('span');
    kindEl.className = 'file-kind-txt';
    kindEl.textContent = itemKindShort(item);
    const dateEl = document.createElement('div');
    dateEl.className = 'file-date';
    dateEl.textContent = formatShortDate(item.createdAt);
    if (isList) card.append(chk, thumbBox, nameEl, kindEl, dateEl);
    else card.append(thumbBox, nameEl, kindEl, dateEl);
    card.addEventListener('click', () => {
      if (filesState.selecting) {
        if (filesState.selectedIds.has(item.id)) filesState.selectedIds.delete(item.id);
        else filesState.selectedIds.add(item.id);
        card.classList.toggle('picked', filesState.selectedIds.has(item.id));
        syncFilesSelectionUI();
      } else {
        openFilePreview(item.id);
      }
    });
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
  filesViewSeg?.querySelectorAll('.fview-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextView = btn.dataset.fview === 'list' ? 'list' : 'grid';
      if (filesState.view === nextView) return;
      filesState.view = nextView;
      try { localStorage.setItem('pb_files_view', nextView); } catch (_) {}
      renderFiles();
    });
  });
  filesSelectBtn?.addEventListener('click', () => {
    filesState.selecting = !filesState.selecting;
    if (!filesState.selecting) {
      filesState.selectedIds.clear();
      closeShareMenu();
    }
    renderFiles();
  });
  filesSelAllBtn?.addEventListener('click', () => {
    const list = getVisibleFilesList();
    if (filesState.selectedIds.size === list.length) filesState.selectedIds.clear();
    else list.forEach((i) => filesState.selectedIds.add(i.id));
    renderFiles();
  });
  filesSelShareBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const items = getSelectedFileItems();
    if (items.length) openShareMenu(items, e.currentTarget);
  });
  filesSelQrBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const items = getSelectedFileItems();
    if (items.length) openQrTransferModal(items);
  });
  fpBackBtn.addEventListener('click', closeFilePreview);
  fpMoreBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFpMoreMenu();
  });
  document.addEventListener('pointerdown', (e) => {
    if (fpMoreMenuEl && !fpMoreMenuEl.hidden && !e.target.closest('.fp-more-wrap')) {
      toggleFpMoreMenu(false);
    }
  });
  fpQrBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFpMoreMenu(false);
    const item = sharedItems.find((i) => i.id === filesState.selectedId);
    if (item) openQrTransferModal([item]);
  });
  fpShareBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFpMoreMenu(false);
    const item = sharedItems.find((i) => i.id === filesState.selectedId);
    if (item) openShareMenu([item], fpMoreBtn || fpShareBtn);
  });
  if (fpWallBtn) {
    fpWallBtn.addEventListener('click', () => {
      const item = sharedItems.find((i) => i.id === filesState.selectedId);
      if (!item || item.type === 'video') return;
      setRetroWallOverride(true);
      setWallImage(item.blob);
      fpWallBtn.classList.add('applied');
      setTimeout(() => {
        fpWallBtn.classList.remove('applied');
        toggleFpMoreMenu(false);
      }, 650);
    });
  }
  fpDlBtn.addEventListener('click', () => {
    toggleFpMoreMenu(false);
    const item = sharedItems.find((i) => i.id === filesState.selectedId);
    if (item) downloadFileItem(item);
  });
  fpDelBtn.addEventListener('click', () => {
    toggleFpMoreMenu(false);
    if (filesState.selectedId != null) deleteItem(filesState.selectedId);
  });
  fpFullBtn?.addEventListener('click', () => {
    if (filesState.selectedId != null) openQuickLook(filesState.selectedId);
  });
  fpImgEl?.addEventListener('dblclick', () => {
    if (filesState.selectedId != null) openQuickLook(filesState.selectedId);
  });

  // macOS Finder Quick Look listeners
  qlCloseBtn?.addEventListener('click', closeQuickLook);
  quickLookEl?.addEventListener('click', (e) => {
    if (e.target === quickLookEl) closeQuickLook();
  });
  qlPrevBtn?.addEventListener('click', () => stepQuickLook(-1));
  qlNextBtn?.addEventListener('click', () => stepQuickLook(1));
  qlShareBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const item = sharedItems.find((i) => i.id === quickLookState.id);
    if (item) openShareMenu([item], e.currentTarget);
  });
  qlDlBtn?.addEventListener('click', () => {
    const item = sharedItems.find((i) => i.id === quickLookState.id);
    if (item) downloadFileItem(item);
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

