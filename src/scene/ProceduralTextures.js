import * as THREE from 'three';

/**
 * In-memory lazy cache for 256x256 procedural PBR canvas textures per map ('coast' | 'city' | 'canyon')
 * and Pit-Lane Garage Showroom, preventing mobile WebView startup lag and redundant GPU allocations.
 */
const mapTextureCache = new Map();
let pitGarageTextureCache = null;

function make256Canvas() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  return { canvas, ctx };
}

function finalizeCanvasTexture(canvas, { isSRGB = true, repeatX = 1, repeatY = 1 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  if (isSRGB) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 4;
  return tex;
}

/**
 * Generates and caches a 256x256 asphalt road texture tailored to each map's atmosphere:
 * - 'coast': Sun-warmed coastal highway asphalt with crisp white dashed lane lines & amber shoulders
 * - 'city': Dark wet-look midnight boulevard asphalt with cyan/magenta neon edge reflections
 * - 'canyon': Weathered alpine mountain pass tarmac with double-yellow centerlines & white edges
 */
function buildMapAsphaltTexture256(mapId) {
  const { canvas, ctx } = make256Canvas();
  const w = 256;
  const h = 256;

  const baseColor =
    mapId === 'city' ? '#121622' : mapId === 'canyon' ? '#1f242d' : '#242934';
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, w, h);

  // Dual tire racing grooves
  const grooveGrad = ctx.createLinearGradient(0, 0, w, 0);
  grooveGrad.addColorStop(0.0, 'rgba(38, 44, 56, 0.45)');
  grooveGrad.addColorStop(0.25, 'rgba(14, 17, 24, 0.72)');
  grooveGrad.addColorStop(0.5, 'rgba(26, 31, 42, 0.55)');
  grooveGrad.addColorStop(0.75, 'rgba(14, 17, 24, 0.72)');
  grooveGrad.addColorStop(1.0, 'rgba(38, 44, 56, 0.45)');
  ctx.fillStyle = grooveGrad;
  ctx.fillRect(0, 0, w, h);

  // Deterministic aggregate grain at 256x256
  for (let i = 0; i < 1800; i++) {
    const x = (i * 73) & 255;
    const y = (i * 151) & 255;
    const v = 22 + (i % 28);
    ctx.fillStyle = `rgb(${v}, ${v + 2}, ${v + 6})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Outer shoulder lines
  if (mapId === 'city') {
    ctx.fillStyle = '#00e5ff';
    ctx.fillRect(10, 0, 4, h);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(w - 14, 0, 4, h);
  } else if (mapId === 'canyon') {
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(10, 0, 4, h);
    ctx.fillRect(w - 14, 0, 4, h);
  } else {
    ctx.fillStyle = '#fb923c';
    ctx.fillRect(10, 0, 5, h);
    ctx.fillRect(w - 15, 0, 5, h);
  }

  // Centerline markings
  if (mapId === 'canyon') {
    // Alpine double yellow centerline with dashed passing breaks
    ctx.fillStyle = '#fbbf24';
    for (let y = 0; y < h; y += 32) {
      ctx.fillRect(w / 2 - 4, y + 3, 2, 22);
      ctx.fillRect(w / 2 + 2, y + 3, 2, 22);
    }
  } else {
    ctx.fillStyle = mapId === 'city' ? 'rgba(224, 242, 254, 0.85)' : 'rgba(255, 255, 255, 0.85)';
    for (let y = 0; y < h; y += 32) {
      ctx.fillRect(w / 2 - 2, y + 4, 4, 18);
    }
  }

  return finalizeCanvasTexture(canvas, { isSRGB: true, repeatX: 1, repeatY: 72 });
}

/**
 * Generates a 256x256 terrain/ground texture per map:
 * - 'coast': Golden coastal beach sand with wave-foam ripples
 * - 'city': Dark urban concrete plaza grid
 * - 'canyon': Slate-moss alpine rock & forest floor
 */
function buildMapTerrainTexture256(mapId) {
  const { canvas, ctx } = make256Canvas();
  const w = 256;
  const h = 256;

  if (mapId === 'coast') {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0.0, '#d6b27c');
    grad.addColorStop(0.5, '#c89f65');
    grad.addColorStop(1.0, '#b88c52');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 1200; i++) {
      const x = (i * 67) & 255;
      const y = (i * 131) & 255;
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,243,214,0.18)' : 'rgba(120,82,38,0.16)';
      ctx.fillRect(x, y, 2, 2);
    }
  } else if (mapId === 'city') {
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.14)';
    ctx.lineWidth = 2;
    for (let g = 0; g < 256; g += 32) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(w, g);
      ctx.stroke();
    }
  } else {
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0.0, '#1e293b');
    grad.addColorStop(0.55, '#273549');
    grad.addColorStop(1.0, '#172534');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 1100; i++) {
      const x = (i * 89) & 255;
      const y = (i * 173) & 255;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(52, 211, 153, 0.10)' : 'rgba(15, 23, 42, 0.32)';
      ctx.fillRect(x, y, 3, 3);
    }
  }

  return finalizeCanvasTexture(canvas, { isSRGB: true, repeatX: 18, repeatY: 18 });
}

/**
 * Generates a 256x256 secondary detail texture per map:
 * - 'coast': Ocean water wave pattern + turquoise foam
 * - 'city': Illuminated high-rise skyscraper window grid (warm gold & electric cyan lit offices)
 * - 'canyon': Layered granite cliff strata texture
 */
function buildMapDetailTexture256(mapId) {
  const { canvas, ctx } = make256Canvas();
  const w = 256;
  const h = 256;

  if (mapId === 'coast') {
    // Ocean wave caustics & turquoise ripples
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0.0, '#0284c7');
    grad.addColorStop(0.5, '#0369a1');
    grad.addColorStop(1.0, '#0c4a6e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.28)';
    ctx.lineWidth = 2;
    for (let y = 8; y < h; y += 16) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 16) {
        const wy = y + Math.sin((x / w) * Math.PI * 4 + y * 0.1) * 3;
        if (x === 0) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
    return finalizeCanvasTexture(canvas, { isSRGB: true, repeatX: 14, repeatY: 14 });
  }

  if (mapId === 'city') {
    // Skyscraper emissive window facade grid (256x256)
    ctx.fillStyle = '#070b14';
    ctx.fillRect(0, 0, w, h);

    const cols = 8;
    const rows = 16;
    const cellW = w / cols;
    const cellH = h / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const hash = ((r * 31 + c * 17) * 73) % 100;
        if (hash < 58) {
          if (hash < 22) {
            ctx.fillStyle = '#38bdf8';
          } else if (hash < 44) {
            ctx.fillStyle = '#fde047';
          } else {
            ctx.fillStyle = '#f472b6';
          }
          ctx.fillRect(c * cellW + 4, r * cellH + 3, cellW - 8, cellH - 6);
        } else {
          ctx.fillStyle = '#111827';
          ctx.fillRect(c * cellW + 4, r * cellH + 3, cellW - 8, cellH - 6);
        }
      }
    }
    return finalizeCanvasTexture(canvas, { isSRGB: true, repeatX: 2, repeatY: 4 });
  }

  // 'canyon': Layered alpine cliff rock strata
  ctx.fillStyle = '#334155';
  ctx.fillRect(0, 0, w, h);
  for (let y = 0; y < h; y += 12) {
    ctx.fillStyle = y % 24 === 0 ? 'rgba(71, 85, 105, 0.65)' : 'rgba(30, 41, 59, 0.65)';
    ctx.fillRect(0, y, w, 8);
  }
  for (let i = 0; i < 900; i++) {
    const x = (i * 53) & 255;
    const y = (i * 113) & 255;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(148, 163, 184, 0.2)' : 'rgba(15, 23, 42, 0.35)';
    ctx.fillRect(x, y, 4, 2);
  }
  return finalizeCanvasTexture(canvas, { isSRGB: true, repeatX: 6, repeatY: 4 });
}

/**
 * Returns lazily generated, in-memory cached 256x256 procedural textures for the requested mapId.
 */
export function getMapTextures(mapId = 'coast') {
  const safeId = mapId === 'city' || mapId === 'canyon' ? mapId : 'coast';
  if (mapTextureCache.has(safeId)) {
    return mapTextureCache.get(safeId);
  }

  const bundle = {
    asphaltTex: buildMapAsphaltTexture256(safeId),
    terrainTex: buildMapTerrainTexture256(safeId),
    detailTex: buildMapDetailTexture256(safeId),
    gantryTex: createCheckeredGantryTexture(safeId),
  };

  mapTextureCache.set(safeId, bundle);
  return bundle;
}

/**
 * Returns lazily generated, in-memory cached 256x256 textures for the Automotive Pit-Lane Garage Showroom.
 */
export function getPitGarageTextures() {
  if (pitGarageTextureCache) {
    return pitGarageTextureCache;
  }

  const { canvas, ctx } = make256Canvas();
  const w = 256;
  const h = 256;

  // Dark polished obsidian concrete base
  ctx.fillStyle = '#0b101b';
  ctx.fillRect(0, 0, w, h);

  // Subtle brushed concrete grain
  for (let i = 0; i < 1400; i++) {
    const x = (i * 61) & 255;
    const y = (i * 139) & 255;
    const v = 13 + (i % 14);
    ctx.fillStyle = `rgb(${v}, ${v + 4}, ${v + 11})`;
    ctx.fillRect(x, y, 2, 2);
  }

  // Pit bay expansion joints + cyan/amber safety lines
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.16)';
  ctx.lineWidth = 2;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.fillStyle = 'rgba(245, 158, 11, 0.32)';
  for (let x = 16; x < w; x += 32) {
    ctx.fillRect(x, 8, 14, 4);
    ctx.fillRect(x, h - 12, 14, 4);
  }

  const concreteFloorTex = finalizeCanvasTexture(canvas, {
    isSRGB: true,
    repeatX: 8,
    repeatY: 8,
  });

  pitGarageTextureCache = {
    concreteFloorTex,
  };
  return pitGarageTextureCache;
}

export function createOakWoodTextures() {
  const width = 256;
  const height = 256;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const baseGrad = ctx.createLinearGradient(0, 0, width, height);
  baseGrad.addColorStop(0.0, '#96633b');
  baseGrad.addColorStop(0.35, '#9d6a40');
  baseGrad.addColorStop(0.7, '#8f5d36');
  baseGrad.addColorStop(1.0, '#855530');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  for (let i = 0; i < 80; i++) {
    const fy = (i * 23) % height;
    const hBand = 4 + (i % 8);
    const alpha = 0.012 + (i % 5) * 0.003;
    ctx.fillStyle = i % 2 === 0 ? `rgba(60, 34, 14, ${alpha})` : `rgba(185, 130, 82, ${alpha})`;
    ctx.fillRect(0, fy, width, hBand);
  }

  const colorTex = finalizeCanvasTexture(canvas, { isSRGB: true, repeatX: 1, repeatY: 1 });
  const bumpTex = finalizeCanvasTexture(canvas, { isSRGB: false, repeatX: 1, repeatY: 1 });

  return { colorTex, bumpTex };
}

export function createAsphaltRoadTexture() {
  return getMapTextures('coast').asphaltTex;
}

export function createMonitorScreenTexture() {
  const { canvas, ctx } = make256Canvas();
  ctx.fillStyle = '#070c1a';
  ctx.fillRect(0, 0, 256, 256);
  return finalizeCanvasTexture(canvas, { isSRGB: true });
}

export function createCheckeredGantryTexture(mapId = 'coast') {
  const w = 256;
  const h = 64;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, w, h);

  const sq = 8;
  for (let r = 0; r < h / sq; r++) {
    for (let c = 0; c < 4; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#14171f';
      ctx.fillRect(c * sq, r * sq, sq, sq);
      ctx.fillRect(w - (c + 1) * sq, r * sq, sq, sq);
    }
  }

  const title =
    mapId === 'city'
      ? 'NEON CITY CIRCUIT'
      : mapId === 'canyon'
        ? 'ALPINE CANYON PASS'
        : 'SUNSET COASTAL GP';
  const accent =
    mapId === 'city' ? '#00e5ff' : mapId === 'canyon' ? '#34d399' : '#fb923c';

  ctx.fillStyle = accent;
  ctx.font = 'bold 13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('START · FINISH', w / 2, 26);
  ctx.fillStyle = '#f8fafc';
  ctx.font = 'bold 10px monospace';
  ctx.fillText(title, w / 2, 46);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
