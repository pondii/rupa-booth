'use strict';

/* ---------------- Share To Menu & E2E WebRTC QR Transfer ---------------- */
const shareMenuEl = $('#shareMenu');
const qrModalEl = $('#qrModal');
const qrCanvasEl = $('#qrCanvas');
const qrExpireBadgeEl = $('#qrExpireBadge');
const qrItemSummaryEl = $('#qrItemSummary');
const qrStatusEl = $('#qrStatus');
const qrLinkInputEl = $('#qrLinkInput');
const qrLocalHintEl = $('#qrLocalHint');
const qrCopyBtn = $('#qrCopyBtn');
const qrRefreshBtn = $('#qrRefreshBtn');
const qrCloseBtn = $('#qrCloseBtn');
const qrDoneBtn = $('#qrDoneBtn');

const RTC_ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
const QR_TTL_SEC = 180;
const CHUNK_BYTES = 32 * 1024;
const encUtf8 = new TextEncoder();
const decUtf8 = new TextDecoder();

let shareMenuItems = [];
let shareMenuAnchor = null;
let shareMenuOpenedAt = 0;

function formatBytes(n) {
  if (!n || n < 1024) return `${n || 0} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

function u8ToB64Url(u8) {
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64UrlToU8(s) {
  const pad = s.length % 4 ? '='.repeat(4 - (s.length % 4)) : '';
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randToken(len = 8) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function importAesKey(rawBytes, usages) {
  return crypto.subtle.importKey('raw', rawBytes, { name: 'AES-GCM' }, false, usages);
}

async function encryptPacket(cryptoKey, plainU8) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, plainU8));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv, 0);
  out.set(ct, 12);
  return out.buffer;
}

async function decryptPacket(cryptoKey, buf) {
  const u8 = new Uint8Array(buf);
  if (u8.byteLength < 28) throw new Error('Corrupt packet');
  const iv = u8.subarray(0, 12);
  const ct = u8.subarray(12);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, cryptoKey, ct));
}

function packJsonFrame(obj) {
  const json = encUtf8.encode(JSON.stringify(obj));
  const out = new Uint8Array(1 + json.length);
  out[0] = 0x01;
  out.set(json, 1);
  return out;
}

function packChunkFrame(fileIndex, chunkIndex, chunkU8) {
  const out = new Uint8Array(9 + chunkU8.length);
  out[0] = 0x02;
  const dv = new DataView(out.buffer);
  dv.setUint32(1, fileIndex, false);
  dv.setUint32(5, chunkIndex, false);
  out.set(chunkU8, 9);
  return out;
}

async function itemToPngBlob(item) {
  if (item.blob && item.blob.type === 'image/png') return item.blob;
  const url = URL.createObjectURL(item.blob);
  try {
    const img = await new Promise((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth || img.width;
    c.height = img.naturalHeight || img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    return await toBlob(c, 'image/png', 1);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function itemToFile(item) {
  return new File([item.blob], itemFileName(item), { type: item.mime || item.blob.type || 'image/jpeg' });
}

function closeShareMenu() {
  if (!shareMenuEl) return;
  shareMenuEl.hidden = true;
  shareMenuEl.style.display = 'none';
  shareMenuItems = [];
  shareMenuAnchor = null;
}

function openShareMenu(items, anchorEl) {
  if (!shareMenuEl || !items || !items.length) return;
  if (!shareMenuEl.hidden && shareMenuAnchor === anchorEl) {
    closeShareMenu();
    return;
  }
  shareMenuItems = items.slice();
  shareMenuAnchor = anchorEl || null;
  shareMenuOpenedAt = performance.now();
  const canCopySingleImage = items.length === 1 && items[0].type !== 'video';
  const copyBtn = shareMenuEl.querySelector('[data-sact="copy"]');
  if (copyBtn) copyBtn.disabled = !canCopySingleImage;

  if (shareMenuEl.parentElement !== document.body) {
    document.body.appendChild(shareMenuEl);
  }
  shareMenuEl.removeAttribute('hidden');
  shareMenuEl.hidden = false;
  shareMenuEl.style.display = 'flex';
  shareMenuEl.style.opacity = '1';
  shareMenuEl.style.visibility = 'visible';
  shareMenuEl.style.zIndex = '9500';

  const vw = document.documentElement.clientWidth || innerWidth;
  const vh = document.documentElement.clientHeight || innerHeight;
  const rawRect = anchorEl && typeof anchorEl.getBoundingClientRect === 'function' ? anchorEl.getBoundingClientRect() : null;
  const hasAnchorRect = Boolean(rawRect && rawRect.width > 0 && rawRect.height > 0);
  const mw = Math.max(244, shareMenuEl.offsetWidth || 244);
  const mh = Math.max(176, shareMenuEl.offsetHeight || 176);
  const rect = hasAnchorRect
    ? rawRect
    : { left: Math.round(vw / 2 - 20), right: Math.round(vw / 2 + mw / 2), top: Math.round(vh / 2 - mh / 2), bottom: Math.round(vh / 2 - mh / 2) };
  const left = clampN(Math.round(rect.right - mw), 8, Math.max(8, vw - mw - 8));
  const top = rect.bottom + 6 + mh <= vh - 8
    ? Math.max(8, Math.round(rect.bottom + 6))
    : clampN(Math.round(rect.top - mh - 6), 8, Math.max(8, vh - mh - 8));
  shareMenuEl.style.left = `${left}px`;
  shareMenuEl.style.top = `${top}px`;
}

function handleShareAction(act) {
  const items = shareMenuItems.slice();
  closeShareMenu();
  if (!items.length) return;

  if (act === 'qr') {
    openQrTransferModal(items);
    return;
  }
  if (act === 'native') {
    const files = items.map(itemToFile);
    const fallbackQr = () => {
      openQrTransferModal(items);
      showDesktopNotice('System Share unavailable here — opened QR Transfer.', 2600);
    };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare({ files }))) {
        navigator.share({ files, title: 'Rupa Booth' }).catch((err) => {
          if (err && err.name !== 'AbortError') fallbackQr();
        });
      } else {
        fallbackQr();
      }
    } catch (_) {
      fallbackQr();
    }
    return;
  }
  if (act === 'copy') {
    if (items.length !== 1 || items[0].type === 'video' || !navigator.clipboard || typeof ClipboardItem === 'undefined') {
      showDesktopNotice('Copy Image is only available for a single photo.', 2000);
      return;
    }
    navigator.clipboard.write([new ClipboardItem({ 'image/png': itemToPngBlob(items[0]) })])
      .then(() => showDesktopNotice('Image copied to clipboard!', 2000))
      .catch(() => showDesktopNotice('Clipboard blocked by browser — use Download or QR.', 2200));
    return;
  }

  const targets = {
    whatsapp: ['WhatsApp', 'https://web.whatsapp.com/'],
    instagram: ['Instagram', 'https://www.instagram.com/'],
    telegram: ['Telegram', 'https://web.telegram.org/'],
    x: ['X', 'https://x.com/compose/post'],
  };
  const target = targets[act];
  if (!target) return;
  const [label, url] = target;

  if (items.length === 1 && items[0].type !== 'video' && navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    let copyOk = true;
    try {
      navigator.clipboard.write([new ClipboardItem({ 'image/png': itemToPngBlob(items[0]) })]).catch(() => { copyOk = false; });
    } catch (_) {
      copyOk = false;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
    showDesktopNotice(
      copyOk
        ? `Image copied! Just Paste (Cmd/Ctrl+V) in ${label}.`
        : `Opened ${label} — use Download if Paste fails.`,
      3000
    );
  } else {
    items.forEach((it) => downloadFileItem(it));
    window.open(url, '_blank', 'noopener,noreferrer');
    showDesktopNotice(`Files downloaded! Upload or drag into ${label}.`, 3000);
  }
}

shareMenuEl?.querySelectorAll('[data-sact]').forEach((btn) => {
  btn.addEventListener('click', () => handleShareAction(btn.dataset.sact));
});

document.addEventListener('pointerdown', (e) => {
  if (performance.now() - shareMenuOpenedAt < 140) return;
  if (shareMenuEl && !shareMenuEl.hidden && !shareMenuEl.contains(e.target) && (!shareMenuAnchor || !shareMenuAnchor.contains(e.target))) {
    closeShareMenu();
  }
});

/* ---- Pure WebRTC P2P + E2E Signaling Helper (MQTT v3.1.1 WSS + BroadcastChannel) ---- */
function openSignalingChannel(selfId, roomChannel, onSignal) {
  const topic = `rupa-booth/qr/v1/${roomChannel}`;
  const brokers = ['wss://broker.emqx.io:8084/mqtt', 'wss://broker.hivemq.com:8884/mqtt'];
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel(`pb-qr-${roomChannel}`) : null;
  const enc = new TextEncoder();
  const dec = new TextDecoder();
  let ws = null;
  let wsReady = false;
  let hb = null;
  let closed = false;
  let brokerIdx = 0;
  const outQueue = [];

  const dispatch = (msg) => {
    if (!msg || closed || msg.src === selfId) return;
    if (msg.dst && msg.dst !== selfId) return;
    onSignal(msg);
  };

  const mqttStr = (str) => {
    const b = enc.encode(str);
    const out = new Uint8Array(2 + b.length);
    out[0] = (b.length >> 8) & 0xff;
    out[1] = b.length & 0xff;
    out.set(b, 2);
    return out;
  };
  const mqttPkt = (head, ...parts) => {
    const bodyLen = parts.reduce((n, p) => n + p.length, 0);
    const lenBytes = [];
    let x = bodyLen;
    do {
      let d = x % 128;
      x = Math.floor(x / 128);
      if (x > 0) d |= 128;
      lenBytes.push(d);
    } while (x > 0);
    const pkt = new Uint8Array(1 + lenBytes.length + bodyLen);
    pkt[0] = head;
    pkt.set(lenBytes, 1);
    let off = 1 + lenBytes.length;
    for (const p of parts) { pkt.set(p, off); off += p.length; }
    return pkt;
  };
  const mqttConnect = (cid) => mqttPkt(0x10, new Uint8Array([0x00, 0x04, 77, 81, 84, 84, 0x04, 0x02, 0x00, 60]), mqttStr(cid));
  const mqttSubscribe = (t) => mqttPkt(0x82, new Uint8Array([0x00, 0x01]), mqttStr(t), new Uint8Array([0x00]));
  const mqttPublish = (t, obj) => mqttPkt(0x30, mqttStr(t), enc.encode(JSON.stringify(obj)));

  if (bc) {
    bc.onmessage = (ev) => dispatch(ev.data);
  }

  const flushQueue = () => {
    while (outQueue.length && ws && wsReady && ws.readyState === 1) {
      ws.send(mqttPublish(topic, outQueue.shift()));
    }
  };

  const connectBroker = (idx) => {
    if (closed || idx >= brokers.length) return;
    let openedOnce = false;
    let rx = new Uint8Array(0);
    try {
      ws = new WebSocket(brokers[idx], 'mqtt');
      ws.binaryType = 'arraybuffer';
    } catch (_) {
      connectBroker(idx + 1);
      return;
    }
    const curWs = ws;
    curWs.onopen = () => {
      if (closed || ws !== curWs) return;
      openedOnce = true;
      curWs.send(mqttConnect(`rb_${selfId}_${randToken(6)}`));
      clearInterval(hb);
      hb = setInterval(() => {
        if (curWs.readyState === 1) curWs.send(new Uint8Array([0xc0, 0x00]));
      }, 25000);
    };
    curWs.onmessage = (ev) => {
      if (closed || ws !== curWs || !(ev.data instanceof ArrayBuffer)) return;
      const chunk = new Uint8Array(ev.data);
      const next = new Uint8Array(rx.length + chunk.length);
      next.set(rx); next.set(chunk, rx.length);
      rx = next;
      while (rx.length >= 2) {
        let mult = 1, rem = 0, i = 1, incomplete = false;
        while (true) {
          if (i >= rx.length) { incomplete = true; break; }
          const b = rx[i++];
          rem += (b & 127) * mult;
          if ((b & 128) === 0) break;
          mult *= 128;
          if (i > 5) { rx = new Uint8Array(0); return; }
        }
        if (incomplete || rx.length < i + rem) break;
        const head = rx[0];
        const body = rx.subarray(i, i + rem);
        rx = rx.subarray(i + rem);
        const type = head & 0xf0;
        if (type === 0x20) {
          curWs.send(mqttSubscribe(topic));
        } else if (type === 0x90) {
          wsReady = true;
          flushQueue();
        } else if (type === 0x30 && body.length >= 2) {
          const tLen = (body[0] << 8) | body[1];
          const qos = (head >> 1) & 0x03;
          const pOff = 2 + tLen + (qos > 0 ? 2 : 0);
          if (pOff <= body.length) {
            try { dispatch(JSON.parse(dec.decode(body.subarray(pOff)))); } catch (_) {}
          }
        }
      }
    };
    curWs.onerror = () => {};
    curWs.onclose = () => {
      if (ws === curWs) { wsReady = false; clearInterval(hb); }
      if (!closed && !openedOnce && idx + 1 < brokers.length) {
        brokerIdx = idx + 1;
        connectBroker(brokerIdx);
      }
    };
  };
  connectBroker(0);

  return {
    send(msg) {
      if (closed) return;
      const env = JSON.parse(JSON.stringify({ ...msg, src: selfId }));
      if (bc) try { bc.postMessage(env); } catch (_) {}
      if (ws && wsReady && ws.readyState === 1) ws.send(mqttPublish(topic, env));
      else outQueue.push(env);
    },
    close() {
      if (closed) return;
      closed = true;
      wsReady = false;
      clearInterval(hb);
      try { bc && bc.close(); } catch (_) {}
      try { ws && ws.close(); } catch (_) {}
    },
  };
}

/* ---- Desktop QR Host Session ---- */
let qrSession = null;

function stopQrHostSession() {
  if (!qrSession) return;
  const s = qrSession;
  qrSession = null;
  s.closed = true;
  clearInterval(s.tickTimer);
  for (const peer of s.peers.values()) {
    try { peer.dc && peer.dc.close(); } catch (_) {}
    try { peer.pc && peer.pc.close(); } catch (_) {}
  }
  s.peers.clear();
  try { s.sig && s.sig.close(); } catch (_) {}
}

let qrModalPrevFocus = null;
function closeQrModal() {
  stopQrHostSession();
  if (qrModalEl) qrModalEl.hidden = true;
  if (typeof syncModalInert === 'function') syncModalInert();
  if (qrModalPrevFocus && qrModalPrevFocus.isConnected && typeof qrModalPrevFocus.focus === 'function') {
    try { qrModalPrevFocus.focus({ preventScroll: true }); } catch (_) {}
  }
  qrModalPrevFocus = null;
}

async function waitDcDrain(dc) {
  if (dc.bufferedAmount <= 256 * 1024) return;
  await new Promise((resolve) => {
    dc.bufferedAmountLowThreshold = 64 * 1024;
    const done = () => {
      dc.removeEventListener('bufferedamountlow', done);
      dc.removeEventListener('close', done);
      resolve();
    };
    dc.addEventListener('bufferedamountlow', done);
    dc.addEventListener('close', done);
  });
}

async function streamEncryptedItems(dc, items, cryptoKey, session) {
  const manifest = {
    t: 'manifest',
    files: items.map((it) => ({
      name: itemFileName(it),
      type: it.type,
      mime: it.mime || it.blob.type || 'image/jpeg',
      size: it.blob.size,
    })),
  };
  dc.send(await encryptPacket(cryptoKey, packJsonFrame(manifest)));

  for (let fi = 0; fi < items.length; fi++) {
    if (session.closed || session.expired || dc.readyState !== 'open') return false;
    const buf = new Uint8Array(await items[fi].blob.arrayBuffer());
    let ci = 0;
    for (let off = 0; off < buf.length; off += CHUNK_BYTES) {
      if (session.closed || session.expired || dc.readyState !== 'open') return false;
      const slice = buf.subarray(off, Math.min(off + CHUNK_BYTES, buf.length));
      dc.send(await encryptPacket(cryptoKey, packChunkFrame(fi, ci, slice)));
      ci += 1;
      await waitDcDrain(dc);
    }
    dc.send(await encryptPacket(cryptoKey, packJsonFrame({ t: 'file-end', index: fi })));
  }
  dc.send(await encryptPacket(cryptoKey, packJsonFrame({ t: 'done' })));
  return true;
}

async function openQrTransferModal(items) {
  if (!qrModalEl || !items || !items.length) return;
  stopQrHostSession();
  closeShareMenu();

  const totalBytes = items.reduce((s, i) => s + (i.blob ? i.blob.size : 0), 0);
  if (qrItemSummaryEl) {
    const unit = items.length === 1 ? 'file' : 'files';
    qrItemSummaryEl.textContent = `${items.length} ${unit} · ${formatBytes(totalBytes)}`;
  }
  if (qrRefreshBtn) qrRefreshBtn.hidden = true;
  qrModalEl.querySelector('.qr-paper')?.classList.remove('expired');
  if (qrExpireBadgeEl) {
    qrExpireBadgeEl.classList.remove('warn', 'expired');
    qrExpireBadgeEl.textContent = '03:00';
  }
  if (qrStatusEl) qrStatusEl.textContent = 'Preparing…';
  qrModalPrevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  qrModalEl.hidden = false;
  if (typeof syncModalInert === 'function') syncModalInert();
  qrCloseBtn?.focus({ preventScroll: true });

  const roomId = `rb-${randToken(5)}`;
  const rawKey = crypto.getRandomValues(new Uint8Array(32));
  const cryptoKey = await importAesKey(rawKey, ['encrypt', 'decrypt']);
  const basePath = `${location.origin}${location.pathname}`;
  const shareUrl = `${basePath}?dl=${encodeURIComponent(roomId)}#k=${u8ToB64Url(rawKey)}`;
  if (qrCanvasEl && typeof drawQrCanvas === 'function') {
    drawQrCanvas(qrCanvasEl, shareUrl, 212);
  }

  const session = {
    roomId,
    shareUrl,
    items: items.slice(),
    cryptoKey,
    peers: new Map(),
    sentCount: 0,
    expired: false,
    closed: false,
    expiresAt: Date.now() + QR_TTL_SEC * 1000,
    sig: null,
    tickTimer: null,
  };
  qrSession = session;

  const updateExpiry = () => {
    if (session.closed) return;
    const rem = Math.max(0, Math.ceil((session.expiresAt - Date.now()) / 1000));
    const mm = String(Math.floor(rem / 60)).padStart(2, '0');
    const ss = String(rem % 60).padStart(2, '0');
    if (qrExpireBadgeEl) {
      qrExpireBadgeEl.textContent = rem > 0 ? `${mm}:${ss}` : 'Expired';
      qrExpireBadgeEl.classList.toggle('warn', rem > 0 && rem <= 30);
      qrExpireBadgeEl.classList.toggle('expired', rem === 0);
    }
    if (rem === 0 && !session.expired) {
      session.expired = true;
      clearInterval(session.tickTimer);
      qrModalEl.querySelector('.qr-paper')?.classList.add('expired');
      if (qrRefreshBtn) qrRefreshBtn.hidden = false;
      if (qrStatusEl) qrStatusEl.textContent = 'QR expired';
      session.peers.forEach(async (peer) => {
        if (peer.dc && peer.dc.readyState === 'open') {
          try { peer.dc.send(await encryptPacket(cryptoKey, packJsonFrame({ t: 'expired' }))); } catch (_) {}
        }
        try { peer.pc && peer.pc.close(); } catch (_) {}
      });
    }
  };
  session.tickTimer = setInterval(updateExpiry, 500);

  session.sig = openSignalingChannel(roomId, roomId, async (msg) => {
    if (session.closed || session.expired) return;
    const p = msg.payload || {};
    const key = `${msg.src}:${p.cid || '0'}`;

    if (msg.type === 'OFFER' && p.sdp) {
      let entry = session.peers.get(key);
      if (entry) return;
      const pc = new RTCPeerConnection({ iceServers: RTC_ICE });
      entry = { pc, dc: null, src: msg.src, cid: p.cid, sent: false, iceQueue: [], remoteSet: false };
      session.peers.set(key, entry);

      pc.onicecandidate = (ev) => {
        if (ev.candidate && !session.closed) {
          const cand = ev.candidate.toJSON ? ev.candidate.toJSON() : { candidate: ev.candidate.candidate, sdpMid: ev.candidate.sdpMid, sdpMLineIndex: ev.candidate.sdpMLineIndex };
          session.sig.send({ type: 'CANDIDATE', dst: msg.src, payload: { cid: p.cid, candidate: cand } });
        }
      };
      pc.ondatachannel = (ev) => {
        const dc = ev.channel;
        dc.binaryType = 'arraybuffer';
        entry.dc = dc;
        dc.onopen = async () => {
          if (entry.sent || session.closed || session.expired) return;
          entry.sent = true;
          if (qrStatusEl) qrStatusEl.textContent = 'Sending…';
          const ok = await streamEncryptedItems(dc, session.items, session.cryptoKey, session);
          if (ok && !session.closed) {
            session.sentCount += 1;
            const unit = session.sentCount === 1 ? 'device' : 'devices';
            if (qrStatusEl) qrStatusEl.textContent = `Sent to ${session.sentCount} ${unit}!`;
          }
        };
      };
      try {
        await pc.setRemoteDescription(p.sdp);
        entry.remoteSet = true;
        while (entry.iceQueue.length) {
          try { await pc.addIceCandidate(entry.iceQueue.shift()); } catch (_) {}
        }
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        const sdp = pc.localDescription.toJSON ? pc.localDescription.toJSON() : { type: pc.localDescription.type, sdp: pc.localDescription.sdp };
        session.sig.send({ type: 'ANSWER', dst: msg.src, payload: { cid: p.cid, sdp } });
      } catch (_) {
        session.peers.delete(key);
      }
    } else if (msg.type === 'CANDIDATE' && p.candidate) {
      const entry = session.peers.get(key);
      if (entry && entry.pc) {
        if (!entry.remoteSet) entry.iceQueue.push(p.candidate);
        else try { await entry.pc.addIceCandidate(p.candidate); } catch (_) {}
      }
    }
  });

  if (qrStatusEl) qrStatusEl.textContent = 'Ready to scan';
}

qrCloseBtn?.addEventListener('click', closeQrModal);
qrDoneBtn?.addEventListener('click', closeQrModal);
qrModalEl?.addEventListener('click', (e) => { if (e.target === qrModalEl) closeQrModal(); });
qrRefreshBtn?.addEventListener('click', () => {
  if (qrSession && qrSession.items.length) openQrTransferModal(qrSession.items.slice());
});
qrCopyBtn?.addEventListener('click', () => {
  if (!qrSession) return;
  navigator.clipboard?.writeText(qrSession.shareUrl)
    .then(() => {
      qrCopyBtn.classList.add('copied');
      setTimeout(() => qrCopyBtn.classList.remove('copied'), 1400);
      showDesktopNotice('QR link copied!', 1800);
    })
    .catch(() => showDesktopNotice('Failed to copy QR link.', 1800));
});
qrLinkInputEl?.addEventListener('focus', () => qrLinkInputEl.select());

/* ---- Phone QR Receiver Page (?dl=ROOM_ID#k=KEY) ---- */
async function startQrReceiverView(roomId) {
  const appEl = $('#app');
  const dlView = $('#dlView');
  const statusEl = $('#dlStatusText');
  const progWrap = $('#dlProgressWrap');
  const progBar = $('#dlProgressBar');
  const progLbl = $('#dlProgressLabel');
  const cardsEl = $('#dlCards');
  const dlAllBtn = $('#dlAllBtn');
  const retryBtn = $('#dlRetryBtn');

  if (appEl) appEl.hidden = true;
  if (dlView) dlView.hidden = false;
  document.title = 'Rupa Booth — Receive Photos';

  const hashParams = new URLSearchParams(location.hash.replace(/^#/, ''));
  const keyB64 = hashParams.get('k') || '';
  if (!keyB64) {
    if (statusEl) statusEl.textContent = 'Encryption key (#k) missing from QR link.';
    if (progWrap) progWrap.hidden = true;
    return;
  }

  let cryptoKey;
  try {
    cryptoKey = await importAesKey(b64UrlToU8(keyB64), ['decrypt']);
  } catch (_) {
    if (statusEl) statusEl.textContent = 'Invalid QR encryption key.';
    if (progWrap) progWrap.hidden = true;
    return;
  }

  let activeCleanup = null;
  const connect = () => {
    if (activeCleanup) activeCleanup();
    if (cardsEl) cardsEl.replaceChildren();
    if (dlAllBtn) dlAllBtn.hidden = true;
    if (retryBtn) retryBtn.hidden = true;
    if (progWrap) progWrap.hidden = false;
    if (progBar) progBar.style.width = '0%';
    if (progLbl) progLbl.textContent = '0%';
    if (statusEl) statusEl.textContent = 'Connecting to computer…';

    const selfId = `rc-${randToken(5)}`;
    const cid = randToken(4);
    const pc = new RTCPeerConnection({ iceServers: RTC_ICE });
    const dc = pc.createDataChannel('rb', { ordered: true });
    dc.binaryType = 'arraybuffer';

    let gotAnswer = false;
    let remoteSet = false;
    const iceQueue = [];
    let finished = false;
    let offerSdp = null;
    let retries = 0;
    let retryTimer = null;
    let timeoutTimer = null;
    const receivedFiles = [];
    const incoming = new Map();
    let totalExpectedBytes = 0;
    let totalReceivedBytes = 0;
    let manifestFiles = [];

    const sig = openSignalingChannel(selfId, roomId, async (msg) => {
      const p = msg.payload || {};
      if (msg.src !== roomId || p.cid !== cid) return;
      if (msg.type === 'ANSWER' && p.sdp && !gotAnswer) {
        gotAnswer = true;
        clearInterval(retryTimer);
        try {
          await pc.setRemoteDescription(p.sdp);
          remoteSet = true;
          while (iceQueue.length) {
            try { await pc.addIceCandidate(iceQueue.shift()); } catch (_) {}
          }
        } catch (_) {}
      } else if (msg.type === 'CANDIDATE' && p.candidate) {
        if (!remoteSet) iceQueue.push(p.candidate);
        else try { await pc.addIceCandidate(p.candidate); } catch (_) {}
      }
    });

    const fail = (msg) => {
      if (finished) return;
      finished = true;
      clearInterval(retryTimer);
      clearTimeout(timeoutTimer);
      if (statusEl) statusEl.textContent = msg;
      if (retryBtn) retryBtn.hidden = false;
    };

    const addFileCard = (fileObj) => {
      receivedFiles.push(fileObj);
      const card = document.createElement('div');
      card.className = 'dl-item';
      const url = URL.createObjectURL(fileObj.blob);
      const isVid = fileObj.type === 'video';
      let mediaNode;
      if (isVid) {
        const box = document.createElement('div');
        box.className = 'dl-media-box';
        const videoEl = document.createElement('video');
        box.appendChild(videoEl);
        const ui = createUnifiedVideoPlayer(videoEl, { hostEl: box, compact: true });
        ui.setMedia(url, '');
        mediaNode = box;
      } else {
        const imgEl = document.createElement('img');
        imgEl.alt = fileObj.name;
        imgEl.src = url;
        mediaNode = imgEl;
      }

      const foot = document.createElement('div');
      foot.className = 'dl-item-foot';
      const meta = document.createElement('div');
      meta.className = 'dl-item-meta';
      meta.textContent = `${fileObj.name} · ${formatBytes(fileObj.blob.size)}`;
      const acts = document.createElement('div');
      acts.className = 'dl-item-acts';

      const dlBtn = document.createElement('button');
      dlBtn.type = 'button';
      dlBtn.className = 'btn icon-btn primary';
      dlBtn.title = 'Download';
      dlBtn.setAttribute('aria-label', 'Download');
      dlBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11m0 0l-4-4m4 4l4-4"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/></svg>';
      dlBtn.addEventListener('click', () => {
        const a = document.createElement('a');
        a.href = url;
        a.download = fileObj.name;
        a.click();
      });
      acts.appendChild(dlBtn);

      if (navigator.share) {
        const fObj = new File([fileObj.blob], fileObj.name, { type: fileObj.mime });
        if (!navigator.canShare || navigator.canShare({ files: [fObj] })) {
          const svBtn = document.createElement('button');
          svBtn.type = 'button';
          svBtn.className = 'btn icon-btn';
          svBtn.title = 'Save / Share';
          svBtn.setAttribute('aria-label', 'Save / Share');
          svBtn.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V4m0 0l-4 4m4-4l4 4"/><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7"/></svg>';
          svBtn.addEventListener('click', () => navigator.share({ files: [fObj], title: fileObj.name }).catch(() => {}));
          acts.appendChild(svBtn);
        }
      }

      foot.append(meta, acts);
      card.append(mediaNode, foot);
      cardsEl?.appendChild(card);
    };

    pc.onicecandidate = (ev) => {
      if (ev.candidate && !finished) {
        const cand = ev.candidate.toJSON ? ev.candidate.toJSON() : { candidate: ev.candidate.candidate, sdpMid: ev.candidate.sdpMid, sdpMLineIndex: ev.candidate.sdpMLineIndex };
        sig.send({ type: 'CANDIDATE', dst: roomId, payload: { cid, candidate: cand } });
      }
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' && !finished) {
        fail('P2P connection failed or blocked by Wi-Fi. Retry or switch network.');
      }
    };

    dc.onopen = () => {
      clearTimeout(timeoutTimer);
      if (statusEl) statusEl.textContent = 'Encrypted link connected! Downloading…';
    };

    dc.onmessage = async (ev) => {
      let plain;
      try {
        plain = await decryptPacket(cryptoKey, ev.data);
      } catch (_) {
        fail('Decryption failed — check that the QR link is complete.');
        return;
      }
      const tag = plain[0];
      if (tag === 0x01) {
        const msg = JSON.parse(decUtf8.decode(plain.subarray(1)));
        if (msg.t === 'manifest') {
          manifestFiles = msg.files || [];
          totalExpectedBytes = manifestFiles.reduce((s, f) => s + (f.size || 0), 0);
          if (statusEl) statusEl.textContent = `Receiving ${manifestFiles.length} encrypted ${manifestFiles.length === 1 ? 'file' : 'files'}…`;
        } else if (msg.t === 'file-end') {
          const meta = manifestFiles[msg.index] || { name: `rupa-${msg.index + 1}`, type: 'photo', mime: 'image/jpeg' };
          const chunks = incoming.get(msg.index) || [];
          incoming.delete(msg.index);
          addFileCard({ ...meta, blob: new Blob(chunks, { type: meta.mime }) });
        } else if (msg.t === 'done') {
          finished = true;
          clearTimeout(timeoutTimer);
          if (progBar) progBar.style.width = '100%';
          if (progLbl) progLbl.textContent = '100%';
          const unit = receivedFiles.length === 1 ? 'file' : 'files';
          if (statusEl) statusEl.textContent = `Ready to download (${receivedFiles.length} ${unit} · AES-256-GCM)!`;
          if (dlAllBtn && receivedFiles.length > 1) dlAllBtn.hidden = false;
        } else if (msg.t === 'expired') {
          fail('QR session on host expired (3 min). Regenerate QR on host computer.');
        }
      } else if (tag === 0x02) {
        const dv = new DataView(plain.buffer, plain.byteOffset, plain.byteLength);
        const fi = dv.getUint32(1, false);
        const chunk = plain.subarray(9);
        if (!incoming.has(fi)) incoming.set(fi, []);
        incoming.get(fi).push(chunk);
        totalReceivedBytes += chunk.length;
        const pct = totalExpectedBytes > 0 ? Math.min(99, Math.round((totalReceivedBytes / totalExpectedBytes) * 100)) : 50;
        if (progBar) progBar.style.width = `${pct}%`;
        if (progLbl) progLbl.textContent = `${pct}%`;
      }
    };

    pc.createOffer().then(async (offer) => {
      await pc.setLocalDescription(offer);
      offerSdp = pc.localDescription.toJSON ? pc.localDescription.toJSON() : { type: pc.localDescription.type, sdp: pc.localDescription.sdp };
      const pushOffer = () => {
        if (!gotAnswer && !finished && offerSdp) {
          sig.send({ type: 'OFFER', dst: roomId, payload: { cid, sdp: offerSdp } });
        }
      };
      pushOffer();
      retryTimer = setInterval(() => {
        retries += 1;
        if (gotAnswer || retries >= 4) clearInterval(retryTimer);
        else pushOffer();
      }, 2200);
    }).catch(() => fail('Browser does not support WebRTC.'));

    timeoutTimer = setTimeout(() => {
      if (!gotAnswer && !finished) {
        fail('Host computer did not respond (QR modal may be closed or P2P blocked by Wi-Fi).');
      }
    }, 15000);

    dlAllBtn.onclick = () => {
      receivedFiles.forEach((f, idx) => {
        setTimeout(() => {
          const a = document.createElement('a');
          const u = URL.createObjectURL(f.blob);
          a.href = u;
          a.download = f.name;
          a.click();
          setTimeout(() => URL.revokeObjectURL(u), 2000);
        }, idx * 240);
      });
    };

    activeCleanup = () => {
      finished = true;
      clearInterval(retryTimer);
      clearTimeout(timeoutTimer);
      try { dc.close(); } catch (_) {}
      try { pc.close(); } catch (_) {}
      sig.close();
    };
  };

  if (retryBtn) retryBtn.addEventListener('click', connect);
  connect();
}

