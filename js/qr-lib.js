/* Minimal pure-JS ISO/IEC 18004 QR Code encoder (Byte mode, ECC Level M, Versions 1-10) */
(() => {
  'use strict';

  const ALIGN_POS = [
    [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
    [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50],
  ];

  // [version]: [ecCwPerBlock, [[groupCount, dataCwPerBlock], ...]] for ECC Level M
  const RS_M = {
    1:  [10, [[1, 16]]],
    2:  [16, [[1, 28]]],
    3:  [26, [[1, 44]]],
    4:  [18, [[2, 32]]],
    5:  [24, [[2, 43]]],
    6:  [16, [[4, 27]]],
    7:  [18, [[4, 31]]],
    8:  [22, [[2, 38], [2, 39]]],
    9:  [22, [[3, 36], [2, 37]]],
    10: [26, [[4, 43], [1, 44]]],
  };

  // GF(256) with primitive polynomial 0x11d
  const EXP = new Uint8Array(512);
  const LOG = new Uint8Array(256);
  (() => {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x = (x << 1) ^ (x & 0x80 ? 0x11d : 0);
    }
    for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();

  function gfMul(a, b) {
    return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]];
  }

  function rsGenerator(deg) {
    let poly = [1];
    for (let i = 0; i < deg; i++) {
      const next = new Array(poly.length + 1).fill(0);
      const root = EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], root);
      }
      poly = next;
    }
    return poly;
  }

  function rsCompute(data, ecLen) {
    const gen = rsGenerator(ecLen);
    const buf = new Uint8Array(data.length + ecLen);
    buf.set(data, 0);
    for (let i = 0; i < data.length; i++) {
      const coef = buf[i];
      if (coef !== 0) {
        for (let j = 0; j < gen.length; j++) buf[i + j] ^= gfMul(gen[j], coef);
      }
    }
    return buf.slice(data.length);
  }

  function totalDataCodewords(ver) {
    const [, groups] = RS_M[ver];
    return groups.reduce((s, [cnt, dc]) => s + cnt * dc, 0);
  }

  function pickVersion(byteLen) {
    for (let v = 1; v <= 10; v++) {
      const hdrBits = 4 + (v >= 10 ? 16 : 8);
      const maxBytes = Math.floor((totalDataCodewords(v) * 8 - hdrBits) / 8);
      if (byteLen <= maxBytes) return v;
    }
    throw new Error('QR payload too long');
  }

  function encodeData(bytes, ver) {
    const maxCw = totalDataCodewords(ver);
    const bits = [];
    const pushBits = (val, len) => {
      for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
    };
    pushBits(0b0100, 4); // Byte mode
    pushBits(bytes.length, ver >= 10 ? 16 : 8);
    for (let i = 0; i < bytes.length; i++) pushBits(bytes[i], 8);
    const term = Math.min(4, maxCw * 8 - bits.length);
    pushBits(0, term);
    while (bits.length % 8 !== 0) bits.push(0);

    const dataCw = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let k = 0; k < 8; k++) b = (b << 1) | bits[i + k];
      dataCw.push(b);
    }
    let padToggle = 0;
    while (dataCw.length < maxCw) {
      dataCw.push(padToggle ? 0x11 : 0xec);
      padToggle ^= 1;
    }

    const [ecLen, groups] = RS_M[ver];
    const dataBlocks = [];
    const ecBlocks = [];
    let offset = 0;
    for (const [cnt, dc] of groups) {
      for (let i = 0; i < cnt; i++) {
        const blk = Uint8Array.from(dataCw.slice(offset, offset + dc));
        offset += dc;
        dataBlocks.push(blk);
        ecBlocks.push(rsCompute(blk, ecLen));
      }
    }

    const out = [];
    const maxDc = Math.max(...dataBlocks.map((b) => b.length));
    for (let i = 0; i < maxDc; i++) {
      for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
    }
    for (let i = 0; i < ecLen; i++) {
      for (const b of ecBlocks) out.push(b[i]);
    }
    return out;
  }

  function bchFormatInfo(maskId) {
    const data = (0b00 << 3) | maskId; // ECC M = 00
    let rem = data << 10;
    for (let i = 14; i >= 10; i--) {
      if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
    }
    return ((data << 10) | rem) ^ 0x5412;
  }

  function bchVersionInfo(ver) {
    let rem = ver << 12;
    for (let i = 17; i >= 12; i--) {
      if ((rem >>> i) & 1) rem ^= 0x1f25 << (i - 12);
    }
    return (ver << 12) | rem;
  }

  function buildBaseMatrix(ver) {
    const n = ver * 4 + 17;
    const mat = Array.from({ length: n }, () => new Int8Array(n).fill(-1));
    const fixed = Array.from({ length: n }, () => new Uint8Array(n));

    const set = (r, c, v) => {
      if (r < 0 || c < 0 || r >= n || c >= n) return;
      mat[r][c] = v ? 1 : 0;
      fixed[r][c] = 1;
    };

    const drawFinder = (tr, tc) => {
      for (let r = -1; r <= 7; r++) {
        for (let c = -1; c <= 7; c++) {
          const rr = tr + r, cc = tc + c;
          if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
          const on = (r >= 0 && r <= 6 && c >= 0 && c <= 6) &&
            (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
          set(rr, cc, on ? 1 : 0);
        }
      }
    };
    drawFinder(0, 0);
    drawFinder(0, n - 7);
    drawFinder(n - 7, 0);

    // Timing patterns
    for (let i = 8; i < n - 8; i++) {
      set(6, i, i % 2 === 0 ? 1 : 0);
      set(i, 6, i % 2 === 0 ? 1 : 0);
    }

    // Alignment patterns
    const pos = ALIGN_POS[ver];
    for (const cr of pos) {
      for (const cc of pos) {
        if (fixed[cr][cc]) continue;
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            const on = Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
            set(cr + r, cc + c, on ? 1 : 0);
          }
        }
      }
    }

    // Dark module & reserve format info areas
    set(4 * ver + 9, 8, 1);
    for (let i = 0; i < 9; i++) {
      if (!fixed[8][i]) { fixed[8][i] = 1; mat[8][i] = 0; }
      if (!fixed[i][8]) { fixed[i][8] = 1; mat[i][8] = 0; }
    }
    for (let i = 0; i < 8; i++) {
      if (!fixed[8][n - 1 - i]) { fixed[8][n - 1 - i] = 1; mat[8][n - 1 - i] = 0; }
      if (i < 7 && !fixed[n - 1 - i][8]) { fixed[n - 1 - i][8] = 1; mat[n - 1 - i][8] = 0; }
    }

    // Version info areas (Version 7+)
    if (ver >= 7) {
      const vbits = bchVersionInfo(ver);
      for (let i = 0; i < 18; i++) {
        const bit = (vbits >>> i) & 1;
        const a = Math.floor(i / 3), b = n - 11 + (i % 3);
        set(a, b, bit);
        set(b, a, bit);
      }
    }

    return { n, mat, fixed };
  }

  function applyFormatInfo(mat, n, maskId) {
    const fbits = bchFormatInfo(maskId);
    for (let i = 0; i < 15; i++) {
      const bit = (fbits >>> i) & 1;
      // Vertical strip left & bottom
      if (i < 6) mat[i][8] = bit;
      else if (i < 8) mat[i + 1][8] = bit;
      else mat[n - 15 + i][8] = bit;
      // Horizontal strip top-right & top-left
      if (i < 8) mat[8][n - 1 - i] = bit;
      else if (i < 9) mat[8][7] = bit;
      else mat[8][14 - i] = bit;
    }
  }

  const MASKS = [
    (r, c) => (r + c) % 2 === 0,
    (r) => r % 2 === 0,
    (_, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
    (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
    (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
  ];

  function penaltyScore(mat, n) {
    let score = 0;
    // Rule 1: 5+ consecutive modules in row/col
    for (let r = 0; r < n; r++) {
      let runR = 1, runC = 1;
      for (let i = 1; i < n; i++) {
        if (mat[r][i] === mat[r][i - 1]) runR += 1;
        else { if (runR >= 5) score += 3 + (runR - 5); runR = 1; }
        if (mat[i][r] === mat[i - 1][r]) runC += 1;
        else { if (runC >= 5) score += 3 + (runC - 5); runC = 1; }
      }
      if (runR >= 5) score += 3 + (runR - 5);
      if (runC >= 5) score += 3 + (runC - 5);
    }
    // Rule 2: 2x2 blocks
    for (let r = 0; r < n - 1; r++) {
      for (let c = 0; c < n - 1; c++) {
        const v = mat[r][c];
        if (v === mat[r][c + 1] && v === mat[r + 1][c] && v === mat[r + 1][c + 1]) score += 3;
      }
    }
    // Rule 3: finder-like patterns 10111010000 or 00001011101
    const pat1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const pat2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (let r = 0; r < n; r++) {
      for (let c = 0; c <= n - 11; c++) {
        let m1r = true, m2r = true, m1c = true, m2c = true;
        for (let k = 0; k < 11; k++) {
          if (mat[r][c + k] !== pat1[k]) m1r = false;
          if (mat[r][c + k] !== pat2[k]) m2r = false;
          if (mat[c + k][r] !== pat1[k]) m1c = false;
          if (mat[c + k][r] !== pat2[k]) m2c = false;
        }
        if (m1r) score += 40;
        if (m2r) score += 40;
        if (m1c) score += 40;
        if (m2c) score += 40;
      }
    }
    // Rule 4: dark ratio
    let dark = 0;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (mat[r][c]) dark += 1;
    const pct = (dark * 100) / (n * n);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return score;
  }

  function makeQrMatrix(text) {
    const bytes = new TextEncoder().encode(String(text));
    const ver = pickVersion(bytes.length);
    const codewords = encodeData(bytes, ver);
    const { n, mat: base, fixed } = buildBaseMatrix(ver);

    // Place data bits zig-zag right-to-left skipping col 6
    let bitIdx = 0;
    const totalBits = codewords.length * 8;
    let up = true;
    for (let col = n - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1;
      for (let i = 0; i < n; i++) {
        const r = up ? n - 1 - i : i;
        for (let d = 0; d < 2; d++) {
          const c = col - d;
          if (!fixed[r][c]) {
            let bit = 0;
            if (bitIdx < totalBits) {
              bit = (codewords[bitIdx >> 3] >>> (7 - (bitIdx & 7))) & 1;
              bitIdx += 1;
            }
            base[r][c] = bit;
          }
        }
      }
      up = !up;
    }

    let bestMat = null;
    let bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      const cand = base.map((row) => Int8Array.from(row));
      const fn = MASKS[m];
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          if (!fixed[r][c] && fn(r, c)) cand[r][c] ^= 1;
        }
      }
      applyFormatInfo(cand, n, m);
      const s = penaltyScore(cand, n);
      if (s < bestScore) { bestScore = s; bestMat = cand; }
    }
    return bestMat;
  }

  function drawQrCanvas(canvas, text, size = 220) {
    const mat = makeQrMatrix(text);
    const n = mat.length;
    const quiet = 4;
    const total = n + quiet * 2;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const px = Math.round(size * dpr);
    canvas.width = px;
    canvas.height = px;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const c = canvas.getContext('2d');
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, px, px);
    c.fillStyle = '#0b0c10';
    const cell = px / total;
    for (let r = 0; r < n; r++) {
      for (let col = 0; col < n; col++) {
        if (mat[r][col]) {
          const x = Math.floor((col + quiet) * cell);
          const y = Math.floor((r + quiet) * cell);
          const x2 = Math.ceil((col + quiet + 1) * cell);
          const y2 = Math.ceil((r + quiet + 1) * cell);
          c.fillRect(x, y, x2 - x, y2 - y);
        }
      }
    }
    return mat;
  }

  window.makeQrMatrix = makeQrMatrix;
  window.drawQrCanvas = drawQrCanvas;
})();
