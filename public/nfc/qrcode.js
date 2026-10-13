/**
 * Gerador de QR Code SVG 100% Offline (ISO/IEC 18004 — Byte Mode, EC Level M)
 * Sem dependências externas. Funciona no navegador e em Node.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LojinhaQR = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Tabelas para EC Level M (versões 1 a 10):
  // [totalCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsGroup1, numBlocksGroup2, dataCodewordsGroup2]
  const VERSION_TABLE_M = [
    null,
    [26, 10, 1, 16, 0, 0],   // v1 (max 14 bytes)
    [44, 16, 1, 28, 0, 0],   // v2 (max 26 bytes)
    [70, 26, 1, 44, 0, 0],   // v3 (max 42 bytes)
    [100, 18, 2, 32, 0, 0],  // v4 (max 62 bytes)
    [134, 24, 2, 43, 0, 0],  // v5 (max 84 bytes)
    [172, 16, 4, 27, 0, 0],  // v6 (max 106 bytes)
    [196, 18, 4, 31, 0, 0],  // v7 (max 122 bytes)
    [242, 22, 2, 38, 2, 39], // v8 (max 152 bytes)
    [292, 22, 3, 36, 2, 37], // v9 (max 180 bytes)
    [346, 26, 4, 43, 1, 44], // v10 (max 213 bytes)
  ];

  const ALIGNMENT_POSITIONS = [
    null,
    [],
    [6, 18],
    [6, 22],
    [6, 26],
    [6, 30],
    [6, 34],
    [6, 22, 38],
    [6, 24, 42],
    [6, 26, 46],
    [6, 28, 50],
  ];

  // Galois Field GF(256)
  const GF_EXP = new Uint8Array(512);
  const GF_LOG = new Uint8Array(256);
  (function initGalois() {
    let x = 1;
    for (let i = 0; i < 255; i++) {
      GF_EXP[i] = x;
      GF_LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;
    }
    for (let i = 255; i < 512; i++) {
      GF_EXP[i] = GF_EXP[i - 255];
    }
  })();

  function gfMul(a, b) {
    if (a === 0 || b === 0) return 0;
    return GF_EXP[GF_LOG[a] + GF_LOG[b]];
  }

  function rsGeneratorPoly(degree) {
    let poly = new Uint8Array([1]);
    for (let i = 0; i < degree; i++) {
      const next = new Uint8Array(poly.length + 1);
      const factor = GF_EXP[i];
      for (let j = 0; j < poly.length; j++) {
        next[j] ^= poly[j];
        next[j + 1] ^= gfMul(poly[j], factor);
      }
      poly = next;
    }
    return poly;
  }

  function rsEncode(data, ecLen) {
    const gen = rsGeneratorPoly(ecLen);
    const rem = new Uint8Array(ecLen);
    for (let i = 0; i < data.length; i++) {
      const factor = data[i] ^ rem[0];
      rem.copyWithin(0, 1);
      rem[ecLen - 1] = 0;
      for (let j = 0; j < ecLen; j++) {
        rem[j] ^= gfMul(gen[j + 1], factor);
      }
    }
    return rem;
  }

  function utf8Bytes(str) {
    if (typeof TextEncoder !== 'undefined') {
      return Array.from(new TextEncoder().encode(str));
    }
    const out = [];
    for (let i = 0; i < str.length; i++) {
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return out;
  }

  function selectVersion(byteLen) {
    for (let v = 1; v < VERSION_TABLE_M.length; v++) {
      const [, , b1, d1, b2, d2] = VERSION_TABLE_M[v];
      const totalDataCap = b1 * d1 + b2 * d2;
      const countBits = v <= 9 ? 8 : 16;
      const maxBytes = totalDataCap - Math.ceil((4 + countBits) / 8);
      if (byteLen <= maxBytes) return v;
    }
    throw new Error('Texto muito longo para o gerador de QR Code (máx ~213 bytes).');
  }

  function buildDataCodewords(bytes, version) {
    const [, , b1, d1, b2, d2] = VERSION_TABLE_M[version];
    const totalDataCodewords = b1 * d1 + b2 * d2;
    const countBits = version <= 9 ? 8 : 16;

    const bits = [];
    function pushBits(val, len) {
      for (let i = len - 1; i >= 0; i--) {
        bits.push((val >>> i) & 1);
      }
    }

    // Mode indicator: Byte mode = 0100 (4)
    pushBits(0b0100, 4);
    pushBits(bytes.length, countBits);
    for (const b of bytes) pushBits(b, 8);

    const maxBits = totalDataCodewords * 8;
    const terminator = Math.min(4, maxBits - bits.length);
    pushBits(0, terminator);

    while (bits.length % 8 !== 0) bits.push(0);

    const codewords = [];
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
      codewords.push(byte);
    }

    let padToggle = true;
    while (codewords.length < totalDataCodewords) {
      codewords.push(padToggle ? 0xec : 0x11);
      padToggle = !padToggle;
    }
    return codewords;
  }

  function interleaveBlocks(dataCodewords, version) {
    const [, ecLen, b1, d1, b2, d2] = VERSION_TABLE_M[version];
    const blocks = [];
    let offset = 0;

    for (let i = 0; i < b1; i++) {
      const data = dataCodewords.slice(offset, offset + d1);
      offset += d1;
      blocks.push({ data, ec: Array.from(rsEncode(data, ecLen)) });
    }
    for (let i = 0; i < b2; i++) {
      const data = dataCodewords.slice(offset, offset + d2);
      offset += d2;
      blocks.push({ data, ec: Array.from(rsEncode(data, ecLen)) });
    }

    const result = [];
    const maxDataLen = Math.max(d1, d2);
    for (let i = 0; i < maxDataLen; i++) {
      for (const blk of blocks) {
        if (i < blk.data.length) result.push(blk.data[i]);
      }
    }
    for (let i = 0; i < ecLen; i++) {
      for (const blk of blocks) {
        result.push(blk.ec[i]);
      }
    }
    return result;
  }

  function createEmptyGrid(size) {
    const modules = Array.from({ length: size }, () => new Array(size).fill(false));
    const isFunc = Array.from({ length: size }, () => new Array(size).fill(false));
    return { modules, isFunc };
  }

  function setFunctionModule(grid, r, c, dark) {
    grid.modules[r][c] = Boolean(dark);
    grid.isFunc[r][c] = true;
  }

  function drawFinderPattern(grid, size, r, c) {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const rr = r + dy;
        const cc = c + dx;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;
        const inOuter =
          dy >= 0 &&
          dy <= 6 &&
          dx >= 0 &&
          dx <= 6 &&
          (dy === 0 || dy === 6 || dx === 0 || dx === 6);
        const inInner = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
        setFunctionModule(grid, rr, cc, inOuter || inInner);
      }
    }
  }

  function drawAlignmentPattern(grid, centerR, centerC) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const dist = Math.max(Math.abs(dy), Math.abs(dx));
        setFunctionModule(grid, centerR + dy, centerC + dx, dist !== 1);
      }
    }
  }

  function drawFormatBits(grid, size, mask) {
    // EC Level M = 00
    const data = (0b00 << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) {
      rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    }
    const bits = ((data << 10) | rem) ^ 0x5412;

    // First copy (top-left finder perimeter): r = row (y), c = col (x)
    for (let i = 0; i <= 5; i++) setFunctionModule(grid, i, 8, ((bits >>> i) & 1) !== 0);
    setFunctionModule(grid, 7, 8, ((bits >>> 6) & 1) !== 0);
    setFunctionModule(grid, 8, 8, ((bits >>> 7) & 1) !== 0);
    setFunctionModule(grid, 8, 7, ((bits >>> 8) & 1) !== 0);
    for (let i = 9; i < 15; i++) {
      setFunctionModule(grid, 8, 14 - i, ((bits >>> i) & 1) !== 0);
    }

    // Second copy (top-right horizontal & bottom-left vertical)
    for (let i = 0; i < 8; i++) {
      setFunctionModule(grid, 8, size - 1 - i, ((bits >>> i) & 1) !== 0);
    }
    for (let i = 8; i < 15; i++) {
      setFunctionModule(grid, size - 15 + i, 8, ((bits >>> i) & 1) !== 0);
    }
    // Dark module (always dark at row = size - 8, col = 8)
    setFunctionModule(grid, size - 8, 8, true);
  }

  function drawFunctionPatterns(grid, version) {
    const size = grid.modules.length;

    // Timing patterns
    for (let i = 0; i < size; i++) {
      setFunctionModule(grid, 6, i, i % 2 === 0);
      setFunctionModule(grid, i, 6, i % 2 === 0);
    }

    // Finder patterns
    drawFinderPattern(grid, size, 0, 0);
    drawFinderPattern(grid, size, 0, size - 7);
    drawFinderPattern(grid, size, size - 7, 0);

    // Alignment patterns
    const pos = ALIGNMENT_POSITIONS[version] || [];
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        if (
          (i === 0 && j === 0) ||
          (i === 0 && j === pos.length - 1) ||
          (i === pos.length - 1 && j === 0)
        ) {
          continue;
        }
        drawAlignmentPattern(grid, pos[i], pos[j]);
      }
    }

    // Reserve format areas
    drawFormatBits(grid, size, 0);
  }

  function placeCodewords(grid, codewords) {
    const size = grid.modules.length;
    let bitIdx = 0;
    const totalBits = codewords.length * 8;

    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const c = right - j;
          const upward = ((right + 1) & 2) === 0;
          const r = upward ? size - 1 - vert : vert;
          if (!grid.isFunc[r][c] && bitIdx < totalBits) {
            const byte = codewords[bitIdx >>> 3];
            const bit = (byte >>> (7 - (bitIdx & 7))) & 1;
            grid.modules[r][c] = bit !== 0;
            bitIdx++;
          }
        }
      }
    }
  }

  function maskBit(mask, r, c) {
    switch (mask) {
      case 0:
        return (r + c) % 2 === 0;
      case 1:
        return r % 2 === 0;
      case 2:
        return c % 3 === 0;
      case 3:
        return (r + c) % 3 === 0;
      case 4:
        return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5:
        return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6:
        return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      case 7:
        return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
      default:
        return false;
    }
  }

  function applyMask(grid, mask) {
    const size = grid.modules.length;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!grid.isFunc[r][c] && maskBit(mask, r, c)) {
          grid.modules[r][c] = !grid.modules[r][c];
        }
      }
    }
  }

  function penaltyScore(modules) {
    const size = modules.length;
    let score = 0;

    for (let r = 0; r < size; r++) {
      let runColor = modules[r][0];
      let runLen = 1;
      for (let c = 1; c < size; c++) {
        if (modules[r][c] === runColor) {
          runLen++;
          if (runLen === 5) score += 3;
          else if (runLen > 5) score += 1;
        } else {
          runColor = modules[r][c];
          runLen = 1;
        }
      }
    }

    for (let c = 0; c < size; c++) {
      let runColor = modules[0][c];
      let runLen = 1;
      for (let r = 1; r < size; r++) {
        if (modules[r][c] === runColor) {
          runLen++;
          if (runLen === 5) score += 3;
          else if (runLen > 5) score += 1;
        } else {
          runColor = modules[r][c];
          runLen = 1;
        }
      }
    }
    return score;
  }

  function generateQrMatrix(text) {
    const bytes = utf8Bytes(String(text || ''));
    const version = selectVersion(bytes.length);
    const size = version * 4 + 17;
    const dataCw = buildDataCodewords(bytes, version);
    const allCw = interleaveBlocks(dataCw, version);

    const grid = createEmptyGrid(size);
    drawFunctionPatterns(grid, version);
    placeCodewords(grid, allCw);

    let bestMask = 0;
    let bestScore = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(grid, m);
      drawFormatBits(grid, size, m);
      const score = penaltyScore(grid.modules);
      if (score < bestScore) {
        bestScore = score;
        bestMask = m;
      }
      applyMask(grid, m); // revert
    }

    applyMask(grid, bestMask);
    drawFormatBits(grid, size, bestMask);
    return grid.modules;
  }

  function generateQrSvg(text, options = {}) {
    const matrix = generateQrMatrix(text);
    const margin = options.margin ?? 4;
    const size = options.size ?? 240;
    const fg = options.fg ?? '#141414';
    const bg = options.bg ?? '#ffffff';
    const dim = matrix.length + margin * 2;

    let pathData = '';
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix.length; c++) {
        if (matrix[r][c]) {
          const x = c + margin;
          const y = r + margin;
          pathData += `M${x},${y}h1v1h-1z`;
        }
      }
    }

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" width="${size}" height="${size}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="100%" height="100%" fill="${bg}" rx="1.5"/><path d="${pathData}" fill="${fg}"/></svg>`;
  }

  function generateQrPngDataUrl(text, options = {}) {
    const matrix = generateQrMatrix(text);
    const margin = options.margin ?? 4;
    const scale = options.scale ?? 8;
    const fg = options.fg ?? '#141414';
    const bg = options.bg ?? '#ffffff';
    const modules = matrix.length + margin * 2;
    const pxSize = modules * scale;

    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas');
      canvas.width = pxSize;
      canvas.height = pxSize;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, pxSize, pxSize);
        ctx.fillStyle = fg;
        for (let r = 0; r < matrix.length; r++) {
          for (let c = 0; c < matrix.length; c++) {
            if (matrix[r][c]) {
              ctx.fillRect((c + margin) * scale, (r + margin) * scale, scale, scale);
            }
          }
        }
        return canvas.toDataURL('image/png');
      }
    }

    const svg = generateQrSvg(text, options);
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  return {
    generateQrMatrix,
    generateQrSvg,
    generateQrPngDataUrl,
  };
});
