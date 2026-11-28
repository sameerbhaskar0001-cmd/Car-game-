import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  WORLD_TRACK_SCALE,
  BASE_GROUND_Y,
  resolveTrackThemeKey,
  getTrackAssetDescriptor,
} from './WorldTrackRegistry.js';
import {
  getSharedGltfLoader,
  getRoadPbrPackForMap,
  loadPhotogrammetryPropTemplate,
  loadMultiPartPropTemplate,
  loadEnvironmentSceneGlb,
} from './PbrAssetManager.js';

/**
 * Custom 3D Track & AAA Multi-Layered 3D Environment Builder (6 Distinct World Circuits)
 * - Supports all 6 maps:
 *   1. 'coast'  (Amalfi Riviera)
 *   2. 'city'   (Shibuya Metropolis)
 *   3. 'canyon' (Chamonix Glacier — with user's 3D Snowy Mountain Road Scene & 3D Mountain Massifs)
 *   4. 'drift'  (Autodrome Arena — user's full 3D Drift Race Track Circuit GLB aligned 1:1)
 *   5. 'desert' (Mojave Red Canyon — Poly Haven 3D Photogrammetry Canyon Cliffs, Rock Faces & Desert Trees)
 *   6. 'forest' (Hakone Touge Pass — user's 3D Forest Grove Island + 3D Normal-Mapped Forest Trees)
 * - Zero toy cone mountains or low-poly placeholder trees: uses real 3D GLB assets and
 *   Poly Haven 3D photogrammetry via InstancedMesh to sustain 60 FPS on mobile and desktop.
 */

const sharedGltfLoader = getSharedGltfLoader();

/**
 * Attaches a lightweight single-pass Asphalt-style wet puddle modulation to any road PBR material.
 * Modulates roughness smoothly in world space so damp patches catch rich 360° HDRI reflections
 * without double-rendering the scene (60 FPS safe on mobile WebGL).
 */
function attachWetPuddleSheenShader(mat, wetnessUniform, cacheKey) {
  mat.customProgramCacheKey = () => cacheKey;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uRoadWetness = wetnessUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vRoadWorldPos;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vRoadWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uRoadWetness;
        varying vec3 vRoadWorldPos;
        float roadPuddleHash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float roadPuddleNoise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          vec2 u = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(roadPuddleHash(i), roadPuddleHash(i + vec2(1.0, 0.0)), u.x),
            mix(roadPuddleHash(i + vec2(0.0, 1.0)), roadPuddleHash(i + vec2(1.0, 1.0)), u.x),
            u.y
          );
        }`
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        if (uRoadWetness > 0.01) {
          float pN1 = roadPuddleNoise(vRoadWorldPos.xz * 26.0);
          float pN2 = roadPuddleNoise(vRoadWorldPos.xz * 62.0 + vec2(4.2, -2.7));
          float puddleMask = smoothstep(0.46, 0.72, pN1 * 0.68 + pN2 * 0.32) * uRoadWetness;
          roughnessFactor = mix(roughnessFactor, 0.14, puddleMask * 0.72);
        }`
      );
  };
  mat.needsUpdate = true;
}

function normalizeGeometryForMerge(geo) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  if (!g.attributes.normal) {
    g.computeVertexNormals();
  }
  const pos = g.attributes.position;
  const norm = g.attributes.normal;
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', pos.clone());
  out.setAttribute('normal', norm.clone());
  return out;
}

function mergeNormalizedParts(parts) {
  const normalized = parts.map((p) => normalizeGeometryForMerge(p));
  const merged = mergeGeometries(normalized, false);
  for (const p of normalized) p.dispose();
  return merged;
}

/**
 * Rich Atmospheric Sky Dome Shader with Sun/Moon Corona Halo, Horizon Haze & Drifting FBM Clouds
 */
function createAtmosphericSkyDomeMaterial(cfg) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0.0 },
      uTopColor: { value: new THREE.Color(cfg.top) },
      uMidColor: { value: new THREE.Color(cfg.mid) },
      uBottomColor: { value: new THREE.Color(cfg.bottom) },
      uSunDir: { value: new THREE.Vector3(...cfg.sunDir).normalize() },
      uSunColor: { value: new THREE.Color(cfg.sunColor) },
      uCloudColor: { value: new THREE.Color(cfg.cloudColor) },
      uCloudShadow: { value: new THREE.Color(cfg.cloudShadow) },
      uCloudDensity: { value: cfg.cloudDensity },
      uStarsIntensity: { value: cfg.starsIntensity || 0.0 },
    },
    vertexShader: /* glsl */ `
      precision highp float;
      varying vec3 vWorldDir;
      void main() {
        vec4 worldPos = modelMatrix * vec4(position, 1.0);
        vWorldDir = normalize(worldPos.xyz);
        gl_Position = projectionMatrix * viewMatrix * worldPos;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform float uTime;
      uniform vec3 uTopColor;
      uniform vec3 uMidColor;
      uniform vec3 uBottomColor;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uCloudColor;
      uniform vec3 uCloudShadow;
      uniform float uCloudDensity;
      uniform float uStarsIntensity;
      varying vec3 vWorldDir;

      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

      float snoise(vec2 v) {
        const vec4 C = vec4(
          0.211324865405187,
          0.366025403784439,
          -0.577350269189626,
          0.024390243902439
        );
        vec2 i = floor(v + dot(v, C.yy));
        vec2 x0 = v - i + dot(i, C.xx);
        vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
        vec4 x12 = x0.xyxy + C.xxzz;
        x12.xy -= i1;
        i = mod289(i);
        vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
        vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
        m = m * m;
        m = m * m;
        vec3 x = 2.0 * fract(p * C.www) - 1.0;
        vec3 h = abs(x) - 0.5;
        vec3 ox = floor(x + 0.5);
        vec3 a0 = x - ox;
        m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
        vec3 g;
        g.x = a0.x * x0.x + h.x * x0.y;
        g.yz = a0.yz * x12.xz + h.yz * x12.yw;
        return 0.5 + 0.5 * (130.0 * dot(m, g));
      }

      float fbmSmooth(vec2 p) {
        float v = 0.0;
        float amp = 0.52;
        mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
        for (int i = 0; i < 4; i++) {
          v += amp * snoise(p);
          p = rot * p * 2.04 + vec2(3.1, 1.7);
          amp *= 0.48;
        }
        return clamp(v, 0.0, 1.0);
      }

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float h = clamp(dir.y, -0.15, 1.0);

        vec3 skyCol = mix(uBottomColor, uMidColor, smoothstep(-0.04, 0.24, h));
        skyCol = mix(skyCol, uTopColor, smoothstep(0.24, 0.85, h));

        float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
        float sunGlow = pow(sunDot, 7.0) * 0.42 + pow(sunDot, 48.0) * 0.55;
        float sunDisc = smoothstep(0.9965, 0.9988, sunDot) * 1.45;
        skyCol += uSunColor * (sunGlow + sunDisc);

        if (uStarsIntensity > 0.01 && h > 0.08) {
          vec2 starUv = floor(dir.xz / max(0.15, dir.y + 0.35) * 180.0);
          float st = hash21(starUv);
          if (st > 0.994) {
            float twinkle = 0.65 + 0.35 * sin(uTime * 2.2 + st * 90.0);
            skyCol += vec3(0.75, 0.88, 1.0) * uStarsIntensity * twinkle * smoothstep(0.08, 0.45, h);
          }
        }

        if (h > 0.01 && uCloudDensity > 0.01) {
          vec2 cloudUv = dir.xz / (h + 0.22) * 1.15 + vec2(uTime * 0.008, uTime * 0.003);
          float c1 = fbmSmooth(cloudUv * 1.45);
          float c2 = fbmSmooth(cloudUv * 2.9 - vec2(uTime * 0.004, 0.0));
          float cloudMask = smoothstep(0.49, 0.82, c1 * 0.72 + c2 * 0.28) * uCloudDensity;
          cloudMask *= smoothstep(0.01, 0.16, h) * smoothstep(0.96, 0.38, h);
          float litFactor = clamp(0.48 + 0.52 * sunDot + c2 * 0.22, 0.0, 1.0);
          vec3 cloudCol = mix(uCloudShadow, uCloudColor, litFactor);
          skyCol = mix(skyCol, cloudCol, clamp(cloudMask, 0.0, 0.88));
        }

        float horizonMist = exp(-abs(h) * 14.0) * 0.28;
        skyCol = mix(skyCol, uBottomColor, horizonMist);

        gl_FragColor = vec4(skyCol, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  });
}

function createCheckeredBannerTexture(accentHex) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 0, 512, 128);

  const sq = 32;
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      const isLight = (x / sq + y / sq) % 2 === 0;
      ctx.fillStyle = isLight ? '#f8fafc' : '#0f172a';
      ctx.fillRect(x, y, sq, sq);
    }
  }

  ctx.fillStyle = accentHex;
  ctx.fillRect(0, 0, 512, 14);
  ctx.fillRect(0, 114, 512, 14);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * High-resolution 1024x1024 PBR racing road texture customized per biome for all 6 tracks.
 */
function createHighResRoadTexture(safeMapId) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (safeMapId === 'city') {
    ctx.fillStyle = '#070a13';
  } else if (safeMapId === 'canyon') {
    ctx.fillStyle = '#141c28';
  } else if (safeMapId === 'desert') {
    ctx.fillStyle = '#191412';
  } else if (safeMapId === 'forest') {
    ctx.fillStyle = '#0e1513';
  } else if (safeMapId === 'drift') {
    ctx.fillStyle = '#10151f';
  } else {
    ctx.fillStyle = '#0d1118';
  }
  ctx.fillRect(0, 0, size, size);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 18000; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const w = 1 + Math.floor(rand() * 2);
    const h = 2 + Math.floor(rand() * 5);
    if (safeMapId === 'city') {
      ctx.fillStyle = rand() > 0.55 ? 'rgba(148, 163, 184, 0.07)' : 'rgba(2, 6, 15, 0.42)';
    } else if (safeMapId === 'canyon') {
      ctx.fillStyle = rand() > 0.48 ? 'rgba(226, 232, 240, 0.14)' : 'rgba(9, 14, 24, 0.36)';
    } else if (safeMapId === 'desert') {
      ctx.fillStyle = rand() > 0.50 ? 'rgba(251, 146, 60, 0.08)' : 'rgba(12, 8, 6, 0.38)';
    } else {
      ctx.fillStyle = rand() > 0.52 ? 'rgba(203, 213, 225, 0.08)' : 'rgba(4, 7, 15, 0.38)';
    }
    ctx.fillRect(x, y, w, h);
  }

  // Subtle frost-dusted or sand-dusted outer shoulders on Canyon / Desert tracks
  if (safeMapId === 'canyon' || safeMapId === 'desert') {
    const dustRgb = safeMapId === 'canyon' ? '226, 232, 240' : '217, 119, 66';
    const leftGrad = ctx.createLinearGradient(0, 0, 125, 0);
    leftGrad.addColorStop(0.0, `rgba(${dustRgb}, 0.52)`);
    leftGrad.addColorStop(0.55, `rgba(${dustRgb}, 0.18)`);
    leftGrad.addColorStop(1.0, `rgba(${dustRgb}, 0.0)`);
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, 125, size);

    const rightGrad = ctx.createLinearGradient(size, 0, size - 125, 0);
    rightGrad.addColorStop(0.0, `rgba(${dustRgb}, 0.52)`);
    rightGrad.addColorStop(0.55, `rgba(${dustRgb}, 0.18)`);
    rightGrad.addColorStop(1.0, `rgba(${dustRgb}, 0.0)`);
    ctx.fillStyle = rightGrad;
    ctx.fillRect(size - 125, 0, 125, size);
  }

  // Deep polished rubberized racing wheel tracks
  const grooveGradL = ctx.createLinearGradient(180, 0, 410, 0);
  grooveGradL.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
  grooveGradL.addColorStop(0.35, 'rgba(2, 4, 10, 0.44)');
  grooveGradL.addColorStop(0.65, 'rgba(2, 4, 10, 0.44)');
  grooveGradL.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grooveGradL;
  ctx.fillRect(180, 0, 230, size);

  const grooveGradR = ctx.createLinearGradient(size - 410, 0, size - 180, 0);
  grooveGradR.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
  grooveGradR.addColorStop(0.35, 'rgba(2, 4, 10, 0.44)');
  grooveGradR.addColorStop(0.65, 'rgba(2, 4, 10, 0.44)');
  grooveGradR.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grooveGradR;
  ctx.fillRect(size - 410, 0, 230, size);

  // Outer shoulder boundary stripes
  const outerPrimary =
    safeMapId === 'city' ? '#00f0ff' : '#f8fafc';
  const outerAccent =
    safeMapId === 'city'
      ? '#f43f5e'
      : safeMapId === 'canyon'
        ? '#38bdf8'
        : safeMapId === 'drift'
          ? '#ef4444'
          : safeMapId === 'desert'
            ? '#f97316'
            : safeMapId === 'forest'
              ? '#10b981'
              : '#f59e0b';

  ctx.fillStyle = outerPrimary;
  ctx.fillRect(26, 0, 14, size);
  ctx.fillRect(size - 40, 0, 14, size);
  ctx.fillStyle = outerAccent;
  ctx.fillRect(46, 0, 7, size);
  ctx.fillRect(size - 53, 0, 7, size);

  // Sleek dashed center & lane lines
  ctx.fillStyle = safeMapId === 'city' ? '#38bdf8' : 'rgba(248, 250, 252, 0.88)';
  for (let y = 36; y < size; y += 256) {
    ctx.fillRect(size * 0.5 - 7, y, 14, 118);
  }
  ctx.fillStyle =
    safeMapId === 'city' ? 'rgba(0, 240, 255, 0.32)' : 'rgba(248, 250, 252, 0.24)';
  for (let y = 148; y < size; y += 256) {
    ctx.fillRect(284, y, 6, 72);
    ctx.fillRect(size - 290, y, 6, 72);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 16;
  return tex;
}

/**
 * Metallic Armco Crash Barrier & Racing Chevron Texture for GLB and extruded `Walls` mesh.
 */
function createRacingBarrierWallTexture(safeMapId) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 512, 128);

  const beamGrad = ctx.createLinearGradient(0, 0, 0, 128);
  beamGrad.addColorStop(0.0, '#334155');
  beamGrad.addColorStop(0.18, '#0f172a');
  beamGrad.addColorStop(0.45, '#475569');
  beamGrad.addColorStop(0.55, '#1e293b');
  beamGrad.addColorStop(0.82, '#334155');
  beamGrad.addColorStop(1.0, '#090d16');
  ctx.fillStyle = beamGrad;
  ctx.fillRect(0, 0, 512, 128);

  const accentColor =
    safeMapId === 'city'
      ? '#00f0ff'
      : safeMapId === 'canyon'
        ? '#38bdf8'
        : safeMapId === 'drift'
          ? '#ef4444'
          : safeMapId === 'desert'
            ? '#f97316'
            : safeMapId === 'forest'
              ? '#10b981'
              : '#f59e0b';

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 34, 512, 60);
  ctx.clip();

  ctx.fillStyle = '#090d16';
  ctx.fillRect(0, 34, 512, 60);

  ctx.fillStyle = accentColor;
  const stripeW = 48;
  for (let x = -128; x < 640; x += stripeW * 2) {
    ctx.beginPath();
    ctx.moveTo(x, 94);
    ctx.lineTo(x + stripeW, 94);
    ctx.lineTo(x + stripeW + 38, 34);
    ctx.lineTo(x + 38, 34);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.fillStyle = safeMapId === 'city' ? '#f43f5e' : '#ef4444';
  ctx.fillRect(0, 6, 512, 10);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 112, 512, 8);

  ctx.fillStyle = 'rgba(2, 6, 23, 0.75)';
  for (let x = 0; x < 512; x += 128) {
    ctx.fillRect(x, 0, 6, 128);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(42, 1);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

function createCurbStripeTexture(safeMapId) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const c1 =
    safeMapId === 'city'
      ? '#00f0ff'
      : safeMapId === 'canyon'
        ? '#0284c7'
        : safeMapId === 'desert'
          ? '#ea580c'
          : safeMapId === 'forest'
            ? '#059669'
            : '#dc2626';
  const c2 = safeMapId === 'city' ? '#0f172a' : safeMapId === 'desert' ? '#fef3c7' : '#f8fafc';

  for (let y = 0; y < 256; y += 64) {
    ctx.fillStyle = (y / 64) % 2 === 0 ? c1 : c2;
    ctx.fillRect(0, y, 128, 64);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createCityBuildingFacadeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#070d1f';
  ctx.fillRect(0, 0, 256, 512);

  ctx.fillStyle = '#0f172a';
  for (let y = 0; y < 512; y += 22) {
    ctx.fillRect(0, y, 256, 4);
  }

  const cols = 8;
  const rows = 24;
  const padX = 5;
  const padY = 5;
  const winW = 256 / cols - padX * 2;
  const winH = 512 / rows - padY * 2;

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const p = rand();
      if (p < 0.34) {
        ctx.fillStyle = '#0b1326';
      } else if (p < 0.68) {
        ctx.fillStyle = '#00f0ff';
      } else if (p < 0.85) {
        ctx.fillStyle = '#38bdf8';
      } else if (p < 0.94) {
        ctx.fillStyle = '#f472b6';
      } else {
        ctx.fillStyle = '#fef08a';
      }
      ctx.fillRect(c * (256 / cols) + padX, r * (512 / rows) + padY, winW, winH);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function ensureUpwardMeshNormalsAndWinding(geometry) {
  if (!geometry || !geometry.attributes || !geometry.attributes.normal) return;
  const normAttr = geometry.attributes.normal;
  if (normAttr.count === 0) return;

  let avgNy = 0;
  const step = Math.max(1, Math.floor(normAttr.count / 32));
  let samples = 0;
  for (let i = 0; i < normAttr.count; i += step) {
    avgNy += normAttr.getY(i);
    samples++;
  }
  avgNy /= Math.max(1, samples);

  if (avgNy < -0.15) {
    for (let i = 0; i < normAttr.count; i++) {
      normAttr.setXYZ(i, -normAttr.getX(i), -normAttr.getY(i), -normAttr.getZ(i));
    }
    normAttr.needsUpdate = true;

    if (geometry.index) {
      const idxArr = geometry.index.array;
      for (let i = 0; i + 2 < idxArr.length; i += 3) {
        const tmp = idxArr[i + 1];
        idxArr[i + 1] = idxArr[i + 2];
        idxArr[i + 2] = tmp;
      }
      geometry.index.needsUpdate = true;
    }
  }
}

/**
 * Builds a high-density 192x192 3D Heightmap Terrain around the entire track loop for all 6 biomes.
 * Uses a 4-corner quad corridor safety clamp so ZERO terrain triangles can ever bridge across or
 * poke through the road surface, curbs, or walls.
 */
function buildSculpted3DTerrainMesh(samples, safeMapId, trackGeo, trackMat) {
  const N = samples.length;
  const gridSegs = 192;
  const size = 2.85;
  const halfSize = size * 0.5;
  const geo = trackGeo(new THREE.PlaneGeometry(size, size, gridSegs, gridSegs));
  geo.rotateX(-Math.PI / 2);

  const posAttr = geo.attributes.position;
  const vCount = posAttr.count;
  const colors = new Float32Array(vCount * 3);

  const lutCount = N;
  const lutX = new Float32Array(lutCount);
  const lutY = new Float32Array(lutCount);
  const lutZ = new Float32Array(lutCount);
  const lutHw = new Float32Array(lutCount);
  for (let k = 0; k < lutCount; k++) {
    const s = samples[k];
    lutX[k] = s.position[0];
    lutY[k] = s.position[1];
    lutZ[k] = s.position[2];
    lutHw[k] = s.half_width_m || 0.0175;
  }

  const colLow = new THREE.Color(
    safeMapId === 'city'
      ? 0x060b18
      : safeMapId === 'canyon'
        ? 0x64748b
        : safeMapId === 'desert'
          ? 0x3b1d11
          : safeMapId === 'forest'
            ? 0x0d1b14
            : safeMapId === 'drift'
              ? 0x111915
              : 0x161d2a
  );
  const colMid = new THREE.Color(
    safeMapId === 'city'
      ? 0x0f172a
      : safeMapId === 'canyon'
        ? 0x94a3b8
        : safeMapId === 'desert'
          ? 0x7c3419
          : safeMapId === 'forest'
            ? 0x163022
            : safeMapId === 'drift'
              ? 0x1c2b21
              : 0x162e22
  );
  const colPeak = new THREE.Color(
    safeMapId === 'city'
      ? 0x1e293b
      : safeMapId === 'canyon'
        ? 0xe2e8f0
        : safeMapId === 'desert'
          ? 0xb45328
          : safeMapId === 'forest'
            ? 0x25422e
            : safeMapId === 'drift'
              ? 0x2b3a2e
              : 0x3b302a
  );
  const colTopCap = new THREE.Color(
    safeMapId === 'desert' ? 0xd97742 : safeMapId === 'forest' ? 0x3f523a : 0xf8fafc
  );
  const tmpCol = new THREE.Color();

  const fbmHeight = (x, z) => {
    const n1 = Math.sin(x * 3.1 + z * 2.4) * Math.cos(z * 2.9 - x * 1.7);
    const n2 = Math.sin(x * 6.8 - z * 5.2) * Math.cos(x * 5.9 + z * 6.3) * 0.5;
    const n3 = Math.abs(Math.sin(x * 11.4 + z * 9.7)) * 0.28;
    return n1 * 0.55 + n2 * 0.35 + n3;
  };

  const vertexClearMargin = new Float32Array(vCount);
  const vertexSafeFloorY = new Float32Array(vCount);

  for (let i = 0; i < vCount; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);

    let minDistSq = Infinity;
    let nearestY = BASE_GROUND_Y;
    let nearestHw = 0.0175;
    for (let k = 0; k < lutCount; k++) {
      const dx = vx - lutX[k];
      const dz = vz - lutZ[k];
      const dSq = dx * dx + dz * dz;
      if (dSq < minDistSq) {
        minDistSq = dSq;
        nearestY = lutY[k];
        nearestHw = lutHw[k];
      }
    }

    const dist = Math.sqrt(minDistSq);
    const margin = dist - (nearestHw + 0.044);
    vertexClearMargin[i] = margin;

    const safeFloor = Math.min(BASE_GROUND_Y - 0.0028, nearestY - 0.0042);
    vertexSafeFloorY[i] = safeFloor;

    const hillBlend = THREE.MathUtils.smoothstep(margin, 0.004, 0.115);
    const radialDist = Math.hypot(vx, vz);

    let finalY = safeFloor;

    if (safeMapId === 'coast') {
      const rawRidge = Math.max(-0.15, fbmHeight(vx, vz));
      const islandMask = THREE.MathUtils.smoothstep(radialDist, 1.18, 0.58);
      const cliffRise = (0.014 + Math.max(0.0, rawRidge) * 0.095) * hillBlend * islandMask;
      const seaDrop = (1.0 - islandMask) * -0.0065 * hillBlend;
      finalY = THREE.MathUtils.lerp(safeFloor, BASE_GROUND_Y + cliffRise + seaDrop, hillBlend);
    } else if (safeMapId === 'canyon' || safeMapId === 'forest') {
      const ridge = Math.abs(fbmHeight(vx * 1.15, vz * 1.15));
      const valleyFloor = safeFloor + Math.sin(vx * 7.0 + vz * 6.0) * 0.0022 * hillBlend;
      const mountainWall =
        Math.pow(THREE.MathUtils.clamp((margin - 0.008) / 0.16, 0.0, 1.35), 1.35) *
        (0.044 + ridge * 0.145);
      finalY = THREE.MathUtils.lerp(safeFloor, valleyFloor + mountainWall, hillBlend);
    } else if (safeMapId === 'desert') {
      // Stepped Mojave Red Canyon flat-topped mesas & deep badland gorges
      const rawMesa = Math.abs(fbmHeight(vx * 1.05, vz * 1.05));
      const steppedMesa = Math.floor(rawMesa * 4.5) / 4.5;
      const canyonWall =
        Math.pow(THREE.MathUtils.clamp((margin - 0.008) / 0.15, 0.0, 1.3), 1.25) *
        (0.038 + steppedMesa * 0.125);
      finalY = THREE.MathUtils.lerp(safeFloor, safeFloor + canyonWall, hillBlend);
    } else if (safeMapId === 'drift') {
      // Gentle stadium bowl around the Drift Autodrome
      const ridge = Math.max(0, fbmHeight(vx * 0.9, vz * 0.9));
      const bowlRise =
        Math.pow(THREE.MathUtils.clamp((margin - 0.012) / 0.22, 0.0, 1.2), 1.3) *
        (0.022 + ridge * 0.065);
      finalY = THREE.MathUtils.lerp(safeFloor, BASE_GROUND_Y - 0.0015 + bowlRise, hillBlend);
    } else {
      const stepTerrace = Math.floor(Math.max(0, fbmHeight(vx * 1.6, vz * 1.6)) * 3.0) * 0.0042;
      finalY = THREE.MathUtils.lerp(safeFloor, BASE_GROUND_Y - 0.0018 + stepTerrace, hillBlend);
    }

    posAttr.setY(i, finalY);
  }

  // 4-Corner Quad Safety Clamp: prevents any diagonal triangle edge from bridging across the road
  const stride = gridSegs + 1;
  for (let gz = 0; gz < gridSegs; gz++) {
    for (let gx = 0; gx < gridSegs; gx++) {
      const i00 = gz * stride + gx;
      const i10 = i00 + 1;
      const i01 = (gz + 1) * stride + gx;
      const i11 = i01 + 1;
      if (
        vertexClearMargin[i00] < 0.006 ||
        vertexClearMargin[i10] < 0.006 ||
        vertexClearMargin[i01] < 0.006 ||
        vertexClearMargin[i11] < 0.006
      ) {
        const clampY = Math.min(
          vertexSafeFloorY[i00],
          vertexSafeFloorY[i10],
          vertexSafeFloorY[i01],
          vertexSafeFloorY[i11]
        );
        if (posAttr.getY(i00) > clampY) posAttr.setY(i00, clampY);
        if (posAttr.getY(i10) > clampY) posAttr.setY(i10, clampY);
        if (posAttr.getY(i01) > clampY) posAttr.setY(i01, clampY);
        if (posAttr.getY(i11) > clampY) posAttr.setY(i11, clampY);
      }
    }
  }

  for (let i = 0; i < vCount; i++) {
    const finalY = posAttr.getY(i);
    if (safeMapId === 'coast' || safeMapId === 'drift') {
      const hNorm = THREE.MathUtils.clamp((finalY - BASE_GROUND_Y) / 0.068, 0, 1);
      if (hNorm < 0.25) {
        tmpCol.lerpColors(colLow, colMid, hNorm / 0.25);
      } else {
        tmpCol.lerpColors(colMid, colPeak, (hNorm - 0.25) / 0.75);
      }
    } else if (safeMapId === 'canyon' || safeMapId === 'desert' || safeMapId === 'forest') {
      const hNorm = THREE.MathUtils.clamp((finalY - BASE_GROUND_Y) / 0.115, 0, 1);
      if (hNorm < 0.28) {
        tmpCol.lerpColors(colLow, colMid, hNorm / 0.28);
      } else if (hNorm < 0.65) {
        tmpCol.lerpColors(colMid, colPeak, (hNorm - 0.28) / 0.37);
      } else {
        tmpCol.lerpColors(colPeak, colTopCap, (hNorm - 0.65) / 0.35);
      }
    } else {
      const tNorm = THREE.MathUtils.clamp((finalY - (BASE_GROUND_Y - 0.002)) / 0.012, 0, 1);
      tmpCol.lerpColors(colLow, colPeak, tNorm);
    }
    colors[i * 3 + 0] = tmpCol.r;
    colors[i * 3 + 1] = tmpCol.g;
    colors[i * 3 + 2] = tmpCol.b;
  }

  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();

  const mat = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness:
        safeMapId === 'city' ? 0.42 : safeMapId === 'canyon' ? 0.72 : safeMapId === 'desert' ? 0.88 : 0.84,
      metalness: safeMapId === 'city' ? 0.32 : 0.06,
      flatShading: safeMapId === 'canyon' || safeMapId === 'desert',
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: 6,
      polygonOffsetUnits: 6,
    })
  );

  const terrainMesh = new THREE.Mesh(geo, mat);
  terrainMesh.name = `SculptedTerrain3D_${safeMapId}`;
  terrainMesh.receiveShadow = true;

  function getTerrainHeightAt(wx, wz) {
    const u = THREE.MathUtils.clamp((wx + halfSize) / size, 0, 1) * gridSegs;
    const v = THREE.MathUtils.clamp((wz + halfSize) / size, 0, 1) * gridSegs;
    const gx = Math.min(gridSegs - 1, Math.floor(u));
    const gz = Math.min(gridSegs - 1, Math.floor(v));
    const tx = u - gx;
    const tz = v - gz;
    const i00 = gz * stride + gx;
    const y00 = posAttr.getY(i00);
    const y10 = posAttr.getY(i00 + 1);
    const y01 = posAttr.getY(i00 + stride);
    const y11 = posAttr.getY(i00 + stride + 1);
    const y0 = y00 + (y10 - y00) * tx;
    const y1 = y01 + (y11 - y01) * tx;
    return y0 + (y1 - y0) * tz;
  }

  return { terrainMesh, getTerrainHeightAt };
}

/**
 * Multi-part 3D Tropical Palm Tree Geometry (Curved Segmented Trunk + 8 Arched Leaf Fronds)
 */
function build3DPalmTreeGeometries(trackGeo) {
  const trunkParts = [];
  let curY = 0;
  let curX = 0;
  const segCount = 5;
  const segH = 0.0048;
  for (let s = 0; s < segCount; s++) {
    const t0 = s / segCount;
    const t1 = (s + 1) / segCount;
    const rBot = THREE.MathUtils.lerp(0.0014, 0.0006, t0);
    const rTop = THREE.MathUtils.lerp(0.0014, 0.0006, t1);
    const seg = new THREE.CylinderGeometry(rTop, rBot, segH * 1.08, 6);
    const leanAngle = t0 * 0.28;
    seg.rotateZ(-leanAngle);
    const dx = Math.sin(leanAngle) * segH * 0.5;
    seg.translate(curX + dx, curY + segH * 0.5, 0);
    trunkParts.push(seg);
    curX += Math.sin(leanAngle) * segH;
    curY += Math.cos(leanAngle) * segH;
  }
  const trunkGeo = trackGeo(mergeNormalizedParts(trunkParts));
  trunkParts.forEach((p) => p.dispose());

  const frondParts = [];
  const frondCount = 8;
  for (let f = 0; f < frondCount; f++) {
    const yaw = (f / frondCount) * Math.PI * 2 + (f % 2) * 0.14;
    const pitchBase = f % 2 === 0 ? 0.32 : 0.08;
    const innerBlade = new THREE.BoxGeometry(0.0028, 0.00035, 0.0085);
    innerBlade.translate(0, 0, 0.0045);
    innerBlade.rotateX(-pitchBase);

    const outerBlade = new THREE.ConeGeometry(0.0018, 0.0085, 4);
    outerBlade.rotateX(Math.PI * 0.62);
    outerBlade.scale(1.2, 0.35, 1.0);
    outerBlade.translate(0, 0.0012 - pitchBase * 0.004, 0.011);

    for (const part of [innerBlade, outerBlade]) {
      part.rotateY(yaw);
      part.translate(curX, curY, 0);
      frondParts.push(part);
    }
  }
  const frondGeo = trackGeo(mergeNormalizedParts(frondParts));
  frondParts.forEach((p) => p.dispose());

  return { trunkGeo, frondGeo };
}

/**
 * Multi-part 3D Cyberpunk Stepped Skyscraper Geometry (Podium + Tower + Upper Spire + Neon Trim)
 */
function build3DCyberTowerGeometries(trackGeo) {
  const bodyParts = [];
  const podium = new THREE.BoxGeometry(1.18, 0.22, 1.18);
  podium.translate(0, 0.11, 0);
  bodyParts.push(podium);
  const midShaft = new THREE.BoxGeometry(0.92, 0.56, 0.92);
  midShaft.translate(0, 0.50, 0);
  bodyParts.push(midShaft);
  const upperSpire = new THREE.BoxGeometry(0.64, 0.24, 0.64);
  upperSpire.translate(0, 0.90, 0);
  bodyParts.push(upperSpire);
  const mast = new THREE.CylinderGeometry(0.02, 0.04, 0.18, 5);
  mast.translate(0, 1.11, 0);
  bodyParts.push(mast);

  const bodyGeo = trackGeo(mergeNormalizedParts(bodyParts));
  bodyParts.forEach((p) => p.dispose());

  const trimParts = [];
  const b1 = new THREE.BoxGeometry(1.20, 0.022, 1.20);
  b1.translate(0, 0.22, 0);
  trimParts.push(b1);
  const b2 = new THREE.BoxGeometry(0.95, 0.022, 0.95);
  b2.translate(0, 0.78, 0);
  trimParts.push(b2);
  const b3 = new THREE.BoxGeometry(0.67, 0.025, 0.67);
  b3.translate(0, 1.02, 0);
  trimParts.push(b3);

  const trimGeo = trackGeo(mergeNormalizedParts(trimParts));
  trimParts.forEach((p) => p.dispose());

  return { bodyGeo, trimGeo };
}

/**
 * Complete 3D Spline-Extruded Roadbed + Raised FIA Curbs + Metallic Armco Crash Barrier Walls
 * Used both as synchronous fallback for GLB tracks AND as the high-precision banked 3D road
 * for Mojave Red Canyon ('desert') and Hakone Touge Pass ('forest').
 */
function buildSynchronousFallbackTrack(
  splineData,
  safeMapId,
  roadSurfaceTex,
  curbTex,
  barrierWallTex,
  trackGeo,
  trackMat
) {
  const group = new THREE.Group();
  group.name = 'SynchronousFallbackTrackGroup';

  const samples = splineData.samples;
  const N = samples.length;
  if (N < 3) return { group, roadGeo: new THREE.BufferGeometry() };

  const roadPos = new Float32Array((N + 1) * 2 * 3);
  const roadNorm = new Float32Array((N + 1) * 2 * 3);
  const roadUv = new Float32Array((N + 1) * 2 * 2);
  const roadIndices = new Uint32Array(N * 6);

  const curbWidth = 0.0026;
  const curbPos = new Float32Array((N + 1) * 4 * 3);
  const curbNorm = new Float32Array((N + 1) * 4 * 3);
  const curbUv = new Float32Array((N + 1) * 4 * 2);
  const curbIndices = new Uint32Array(N * 12);

  const wallHeight = 0.0028;
  const wallPos = new Float32Array((N + 1) * 4 * 3);
  const wallNorm = new Float32Array((N + 1) * 4 * 3);
  const wallUv = new Float32Array((N + 1) * 4 * 2);
  const wallIndices = new Uint32Array(N * 12);

  for (let i = 0; i <= N; i++) {
    const s = samples[i % N];
    const px = s.position[0];
    const py = s.position[1];
    const pz = s.position[2];
    const rx = s.right[0];
    const ry = s.right[1];
    const rz = s.right[2];
    const nx = s.normal[0];
    const ny = s.normal[1];
    const nz = s.normal[2];
    const hw = s.half_width_m || 0.0175;
    const vCoord = (i / N) * 145.0;

    const vL = i * 2;
    const vR = i * 2 + 1;
    roadPos[vL * 3 + 0] = px - rx * hw;
    roadPos[vL * 3 + 1] = py - ry * hw;
    roadPos[vL * 3 + 2] = pz - rz * hw;
    roadPos[vR * 3 + 0] = px + rx * hw;
    roadPos[vR * 3 + 1] = py + ry * hw;
    roadPos[vR * 3 + 2] = pz + rz * hw;

    roadNorm[vL * 3 + 0] = nx;
    roadNorm[vL * 3 + 1] = ny;
    roadNorm[vL * 3 + 2] = nz;
    roadNorm[vR * 3 + 0] = nx;
    roadNorm[vR * 3 + 1] = ny;
    roadNorm[vR * 3 + 2] = nz;

    roadUv[vL * 2 + 0] = 0.0;
    roadUv[vL * 2 + 1] = vCoord;
    roadUv[vR * 2 + 0] = 1.0;
    roadUv[vR * 2 + 1] = vCoord;

    const cBase = i * 4;
    const ch = 0.00035;
    const outerDist = hw + curbWidth;
    curbPos[(cBase + 0) * 3 + 0] = px - rx * hw + nx * ch;
    curbPos[(cBase + 0) * 3 + 1] = py - ry * hw + ny * ch;
    curbPos[(cBase + 0) * 3 + 2] = pz - rz * hw + nz * ch;

    curbPos[(cBase + 1) * 3 + 0] = px - rx * outerDist + nx * ch * 1.4;
    curbPos[(cBase + 1) * 3 + 1] = py - ry * outerDist + ny * ch * 1.4;
    curbPos[(cBase + 1) * 3 + 2] = pz - rz * outerDist + nz * ch * 1.4;

    curbPos[(cBase + 2) * 3 + 0] = px + rx * hw + nx * ch;
    curbPos[(cBase + 2) * 3 + 1] = py + ry * hw + ny * ch;
    curbPos[(cBase + 2) * 3 + 2] = pz + rz * hw + nz * ch;

    curbPos[(cBase + 3) * 3 + 0] = px + rx * outerDist + nx * ch * 1.4;
    curbPos[(cBase + 3) * 3 + 1] = py + ry * outerDist + ny * ch * 1.4;
    curbPos[(cBase + 3) * 3 + 2] = pz + rz * outerDist + nz * ch * 1.4;

    for (let k = 0; k < 4; k++) {
      curbNorm[(cBase + k) * 3 + 0] = nx;
      curbNorm[(cBase + k) * 3 + 1] = ny;
      curbNorm[(cBase + k) * 3 + 2] = nz;
      curbUv[(cBase + k) * 2 + 0] = k % 2;
      curbUv[(cBase + k) * 2 + 1] = (i / N) * 220.0;
    }

    // 3D Armco Crash Barrier Walls along outer edge of curbs
    const wallDist = outerDist + 0.0003;
    const wU = i * 0.28;
    // Left wall bottom & top
    wallPos[(cBase + 0) * 3 + 0] = px - rx * wallDist;
    wallPos[(cBase + 0) * 3 + 1] = py - ry * wallDist;
    wallPos[(cBase + 0) * 3 + 2] = pz - rz * wallDist;
    wallPos[(cBase + 1) * 3 + 0] = px - rx * wallDist + nx * wallHeight;
    wallPos[(cBase + 1) * 3 + 1] = py - ry * wallDist + ny * wallHeight;
    wallPos[(cBase + 1) * 3 + 2] = pz - rz * wallDist + nz * wallHeight;
    // Right wall bottom & top
    wallPos[(cBase + 2) * 3 + 0] = px + rx * wallDist;
    wallPos[(cBase + 2) * 3 + 1] = py + ry * wallDist;
    wallPos[(cBase + 2) * 3 + 2] = pz + rz * wallDist;
    wallPos[(cBase + 3) * 3 + 0] = px + rx * wallDist + nx * wallHeight;
    wallPos[(cBase + 3) * 3 + 1] = py + ry * wallDist + ny * wallHeight;
    wallPos[(cBase + 3) * 3 + 2] = pz + rz * wallDist + nz * wallHeight;

    wallNorm[(cBase + 0) * 3 + 0] = rx;
    wallNorm[(cBase + 0) * 3 + 1] = ry;
    wallNorm[(cBase + 0) * 3 + 2] = rz;
    wallNorm[(cBase + 1) * 3 + 0] = rx;
    wallNorm[(cBase + 1) * 3 + 1] = ry;
    wallNorm[(cBase + 1) * 3 + 2] = rz;
    wallNorm[(cBase + 2) * 3 + 0] = -rx;
    wallNorm[(cBase + 2) * 3 + 1] = -ry;
    wallNorm[(cBase + 2) * 3 + 2] = -rz;
    wallNorm[(cBase + 3) * 3 + 0] = -rx;
    wallNorm[(cBase + 3) * 3 + 1] = -ry;
    wallNorm[(cBase + 3) * 3 + 2] = -rz;

    wallUv[(cBase + 0) * 2 + 0] = wU;
    wallUv[(cBase + 0) * 2 + 1] = 0.0;
    wallUv[(cBase + 1) * 2 + 0] = wU;
    wallUv[(cBase + 1) * 2 + 1] = 1.0;
    wallUv[(cBase + 2) * 2 + 0] = wU;
    wallUv[(cBase + 2) * 2 + 1] = 0.0;
    wallUv[(cBase + 3) * 2 + 0] = wU;
    wallUv[(cBase + 3) * 2 + 1] = 1.0;

    if (i < N) {
      const a = i * 2;
      const b = i * 2 + 1;
      const c = (i + 1) * 2;
      const d = (i + 1) * 2 + 1;
      const idx = i * 6;
      roadIndices[idx + 0] = a;
      roadIndices[idx + 1] = c;
      roadIndices[idx + 2] = b;
      roadIndices[idx + 3] = b;
      roadIndices[idx + 4] = c;
      roadIndices[idx + 5] = d;

      const cIdx = i * 12;
      const c0 = i * 4;
      const c1 = (i + 1) * 4;
      curbIndices[cIdx + 0] = c0 + 1;
      curbIndices[cIdx + 1] = c1 + 1;
      curbIndices[cIdx + 2] = c0 + 0;
      curbIndices[cIdx + 3] = c0 + 0;
      curbIndices[cIdx + 4] = c1 + 1;
      curbIndices[cIdx + 5] = c1 + 0;
      curbIndices[cIdx + 6] = c0 + 2;
      curbIndices[cIdx + 7] = c1 + 2;
      curbIndices[cIdx + 8] = c0 + 3;
      curbIndices[cIdx + 9] = c0 + 3;
      curbIndices[cIdx + 10] = c1 + 2;
      curbIndices[cIdx + 11] = c1 + 3;

      wallIndices[cIdx + 0] = c0 + 0;
      wallIndices[cIdx + 1] = c1 + 0;
      wallIndices[cIdx + 2] = c0 + 1;
      wallIndices[cIdx + 3] = c0 + 1;
      wallIndices[cIdx + 4] = c1 + 0;
      wallIndices[cIdx + 5] = c1 + 1;
      wallIndices[cIdx + 6] = c0 + 2;
      wallIndices[cIdx + 7] = c0 + 3;
      wallIndices[cIdx + 8] = c1 + 2;
      wallIndices[cIdx + 9] = c0 + 3;
      wallIndices[cIdx + 10] = c1 + 3;
      wallIndices[cIdx + 11] = c1 + 2;
    }
  }

  const roadGeo = trackGeo(new THREE.BufferGeometry());
  roadGeo.setAttribute('position', new THREE.BufferAttribute(roadPos, 3));
  roadGeo.setAttribute('normal', new THREE.BufferAttribute(roadNorm, 3));
  roadGeo.setAttribute('uv', new THREE.BufferAttribute(roadUv, 2));
  roadGeo.setIndex(new THREE.BufferAttribute(roadIndices, 1));
  roadGeo.computeBoundingSphere();

  const roadMat = trackMat(
    new THREE.MeshPhysicalMaterial({
      color: safeMapId === 'desert' ? 0xb5aba3 : 0xadb8c6,
      map: roadSurfaceTex,
      roughness: safeMapId === 'city' ? 0.42 : safeMapId === 'desert' ? 0.58 : 0.52,
      metalness: safeMapId === 'city' ? 0.18 : 0.12,
      clearcoat: safeMapId === 'city' ? 0.24 : 0.16,
      clearcoatRoughness: 0.44,
      reflectivity: 0.50,
      envMapIntensity: 0.68,
      side: THREE.DoubleSide,
    })
  );

  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.castShadow = true;
  roadMesh.receiveShadow = true;
  group.add(roadMesh);

  const curbGeo = trackGeo(new THREE.BufferGeometry());
  curbGeo.setAttribute('position', new THREE.BufferAttribute(curbPos, 3));
  curbGeo.setAttribute('normal', new THREE.BufferAttribute(curbNorm, 3));
  curbGeo.setAttribute('uv', new THREE.BufferAttribute(curbUv, 2));
  curbGeo.setIndex(new THREE.BufferAttribute(curbIndices, 1));
  curbGeo.computeBoundingSphere();

  const curbMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: curbTex,
      roughness: 0.32,
      metalness: 0.22,
      side: THREE.DoubleSide,
    })
  );
  const curbMesh = new THREE.Mesh(curbGeo, curbMat);
  curbMesh.castShadow = true;
  curbMesh.receiveShadow = true;
  group.add(curbMesh);

  const wallGeo = trackGeo(new THREE.BufferGeometry());
  wallGeo.setAttribute('position', new THREE.BufferAttribute(wallPos, 3));
  wallGeo.setAttribute('normal', new THREE.BufferAttribute(wallNorm, 3));
  wallGeo.setAttribute('uv', new THREE.BufferAttribute(wallUv, 2));
  wallGeo.setIndex(new THREE.BufferAttribute(wallIndices, 1));
  wallGeo.computeBoundingSphere();

  const wallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: barrierWallTex,
      roughness: 0.28,
      metalness: 0.64,
      envMapIntensity: 1.25,
      emissive: new THREE.Color(safeMapId === 'city' ? 0x004466 : 0x1a0c02),
      emissiveIntensity: safeMapId === 'city' ? 0.55 : 0.25,
      side: THREE.DoubleSide,
    })
  );
  const wallMesh = new THREE.Mesh(wallGeo, wallMat);
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  group.add(wallMesh);

  return { group, roadGeo, roadMat };
}

export function buildRealWorldMap(mapId = 'coast', splineData, scene) {
  const safeMapId = resolveTrackThemeKey(mapId);
  const descriptor = getTrackAssetDescriptor(safeMapId);

  const rootGroup = new THREE.Group();
  rootGroup.name = `RealWorldMap_${safeMapId}`;
  scene.add(rootGroup);

  let isDisposed = false;
  const disposableGeos = new Set();
  const disposableMats = new Set();
  const disposableTexs = new Set();

  const trackGeo = (g) => {
    if (g) disposableGeos.add(g);
    return g;
  };
  const trackMat = (m) => {
    if (m) disposableMats.add(m);
    return m;
  };
  const trackTex = (t) => {
    if (t) disposableTexs.add(t);
    return t;
  };

  // -------------------------------------------------------------------------
  // 1. VIBRANT 3D ATMOSPHERIC SKY DOME FOR ALL 6 TRACK BIOMES
  // -------------------------------------------------------------------------
  const skyConfigs = {
    coast: {
      top: 0x1d4ed8,
      mid: 0x9333ea,
      bottom: 0xfdba74,
      sunDir: [-0.55, 0.28, 0.78],
      sunColor: 0xffd27d,
      cloudColor: 0xffedd5,
      cloudShadow: 0x7c3aed,
      cloudDensity: 0.78,
      starsIntensity: 0.0,
      accent: '#fb923c',
    },
    city: {
      top: 0x090f26,
      mid: 0x1e1b4b,
      bottom: 0x0f4c81,
      sunDir: [0.45, 0.34, 0.82],
      sunColor: 0x7dd3fc,
      cloudColor: 0x38bdf8,
      cloudShadow: 0x1e1b4b,
      cloudDensity: 0.38,
      starsIntensity: 0.85,
      accent: '#00e5ff',
    },
    canyon: {
      top: 0x0284c7,
      mid: 0x60a5fa,
      bottom: 0xe0f2fe,
      sunDir: [-0.48, 0.42, 0.76],
      sunColor: 0xfff7ed,
      cloudColor: 0xffffff,
      cloudShadow: 0x94a3b8,
      cloudDensity: 0.65,
      starsIntensity: 0.0,
      accent: '#38bdf8',
    },
    drift: {
      top: 0x0f294a,
      mid: 0x2563eb,
      bottom: 0xfde68a,
      sunDir: [0.52, 0.38, -0.76],
      sunColor: 0xfff3c4,
      cloudColor: 0xffffff,
      cloudShadow: 0x64748b,
      cloudDensity: 0.62,
      starsIntensity: 0.0,
      accent: '#f43f5e',
    },
    desert: {
      top: 0x23153c,
      mid: 0xc2410c,
      bottom: 0xfdba74,
      sunDir: [-0.62, 0.24, -0.74],
      sunColor: 0xffedd5,
      cloudColor: 0xfed7aa,
      cloudShadow: 0x7c2d12,
      cloudDensity: 0.54,
      starsIntensity: 0.0,
      accent: '#f97316',
    },
    forest: {
      top: 0x0d2b2e,
      mid: 0x0f766e,
      bottom: 0xa7f3d0,
      sunDir: [0.44, 0.36, 0.82],
      sunColor: 0xfef3c7,
      cloudColor: 0xecfdf5,
      cloudShadow: 0x115e59,
      cloudDensity: 0.68,
      starsIntensity: 0.0,
      accent: '#10b981',
    },
  };
  const skyCfg = skyConfigs[safeMapId] || skyConfigs.coast;

  const skyGeo = trackGeo(new THREE.SphereGeometry(7.2, 64, 36));
  const skyMat = trackMat(createAtmosphericSkyDomeMaterial(skyCfg));
  const skyDome = new THREE.Mesh(skyGeo, skyMat);
  skyDome.name = 'AtmosphericSkyDome3D';
  rootGroup.add(skyDome);

  const samples = splineData.samples;
  const N = samples.length;

  // -------------------------------------------------------------------------
  // 2. SCULPTED 3D HEIGHTMAP TERRAIN MESH (ROLLING HILLS, CANYONS & VALLEYS)
  // -------------------------------------------------------------------------
  const { terrainMesh: sculptedTerrain, getTerrainHeightAt } = buildSculpted3DTerrainMesh(
    samples,
    safeMapId,
    trackGeo,
    trackMat
  );
  rootGroup.add(sculptedTerrain);

  // High-res PBR road textures: sharp racing lanes + Poly Haven 1K photoscanned Normal/ARM depth
  const procRoadTex = trackTex(createHighResRoadTexture(safeMapId));
  const roadPbrPack = getRoadPbrPackForMap(safeMapId);
  const roadWetnessUniform = {
    value: safeMapId === 'city' ? 0.55 : safeMapId === 'forest' ? 0.25 : 0.0,
  };
  const procCurbTex = trackTex(createCurbStripeTexture(safeMapId));
  const procBarrierWallTex = trackTex(createRacingBarrierWallTexture(safeMapId));
  procBarrierWallTex.repeat.set(1, 1);

  const { group: fallbackTrackGroup, roadGeo, roadMat } = buildSynchronousFallbackTrack(
    splineData,
    safeMapId,
    procRoadTex,
    procCurbTex,
    procBarrierWallTex,
    trackGeo,
    trackMat
  );
  if (roadMat) {
    roadMat.normalMap = roadPbrPack.normalMap;
    roadMat.normalScale = new THREE.Vector2(0.78, 0.78);
    roadMat.roughnessMap = roadPbrPack.armMap;
    attachWetPuddleSheenShader(roadMat, roadWetnessUniform, `road_puddle_fallback_${safeMapId}`);
  }
  rootGroup.add(fallbackTrackGroup);
  let glbRoadMat = null;

  // -------------------------------------------------------------------------
  // 3. SLEEK OPEN-TRUSS F1 START / FINISH GANTRY ARCH OVER `StartLine`
  // -------------------------------------------------------------------------
  const startIdx = Math.min(splineData.startFinishIdx || 1, N - 1);
  const startSample = samples[startIdx];

  const gantryAnchor = new THREE.Group();
  gantryAnchor.name = 'StartFinishGantryArch';

  function positionGantryAt(worldPosArr, dirArr) {
    gantryAnchor.position.set(worldPosArr[0], worldPosArr[1], worldPosArr[2]);
    const tang = new THREE.Vector3(dirArr[0], dirArr[1] || 0, dirArr[2]).normalize();
    const norm = new THREE.Vector3(0, 1, 0);
    const left = new THREE.Vector3().crossVectors(norm, tang).normalize();
    const rotMat = new THREE.Matrix4().makeBasis(left, norm, tang);
    gantryAnchor.quaternion.setFromRotationMatrix(rotMat);
  }

  positionGantryAt(
    splineData.startLineWorldPos || startSample.position,
    splineData.startLineDir || startSample.tangent
  );

  const gantryHalfSpan = 0.0315;
  const gantryHeight = 0.0265;

  const gantryMetalMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.28,
      metalness: 0.85,
    })
  );
  const gantryPillarGeo = trackGeo(new THREE.CylinderGeometry(0.001, 0.0014, gantryHeight, 10));
  for (const side of [-1, 1]) {
    const pMesh = new THREE.Mesh(gantryPillarGeo, gantryMetalMat);
    pMesh.position.set(side * gantryHalfSpan, gantryHeight * 0.5 - 0.001, 0);
    pMesh.castShadow = true;
    gantryAnchor.add(pMesh);
  }

  const crossBeamWidth = gantryHalfSpan * 2 + 0.003;
  const crossBeamGeo = trackGeo(new THREE.BoxGeometry(crossBeamWidth, 0.0024, 0.0022));
  const bannerTex = trackTex(createCheckeredBannerTexture(skyCfg.accent));
  const bannerMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: bannerTex,
      roughness: 0.3,
      metalness: 0.2,
    })
  );
  const crossBeam = new THREE.Mesh(crossBeamGeo, bannerMat);
  crossBeam.position.set(0, gantryHeight - 0.001, 0);
  gantryAnchor.add(crossBeam);

  const topBarGeo = trackGeo(new THREE.BoxGeometry(crossBeamWidth, 0.0006, 0.0026));
  const topBarMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(skyCfg.accent),
      toneMapped: false,
    })
  );
  const topBar = new THREE.Mesh(topBarGeo, topBarMat);
  topBar.position.set(0, gantryHeight + 0.0005, 0);
  gantryAnchor.add(topBar);

  const f1PodGeo = trackGeo(new THREE.SphereGeometry(0.00085, 10, 10));
  const f1PodHousingGeo = trackGeo(new THREE.BoxGeometry(0.002, 0.0024, 0.0018));
  const f1PodMats = [];
  for (let i = 0; i < 5; i++) {
    const xOff = (i - 2) * 0.0042;
    const housing = new THREE.Mesh(f1PodHousingGeo, gantryMetalMat);
    housing.position.set(xOff, gantryHeight - 0.0032, -0.0012);
    gantryAnchor.add(housing);

    const podMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x2a0a0a,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.0,
        roughness: 0.2,
      })
    );
    const pod = new THREE.Mesh(f1PodGeo, podMat);
    pod.position.set(xOff, gantryHeight - 0.0032, -0.0022);
    gantryAnchor.add(pod);
    f1PodMats.push(podMat);
  }

  rootGroup.add(gantryAnchor);

  function setF1StartLights(litCount = 0) {
    for (let i = 0; i < 5; i++) {
      const mat = f1PodMats[i];
      if (!mat) continue;
      if (i < litCount) {
        mat.color.setHex(0xff1e1e);
        mat.emissive.setHex(0xff1111);
        mat.emissiveIntensity = 3.2;
      } else {
        mat.color.setHex(0x2a0a0a);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      }
    }
  }

  function attachTrafficLightGlb(glbScene) {
    if (!glbScene || isDisposed) return;
    const clone = glbScene.clone(true);
    clone.scale.setScalar(0.0032);
    clone.position.set(-gantryHalfSpan - 0.0024, 0.0, 0.002);
    clone.rotation.y = Math.PI;
    gantryAnchor.add(clone);
  }

  // -------------------------------------------------------------------------
  // 4. DYNAMIC TRACK GLB ASSET LOADING (`coast`, `city`, `canyon`, AND `drift_race_track.glb`)
  // -------------------------------------------------------------------------
  const glbMountGroup = new THREE.Group();
  glbMountGroup.name = `CustomTrackGLB_${descriptor.trackKey}`;
  glbMountGroup.scale.setScalar(descriptor.customGlbScale || WORLD_TRACK_SCALE);
  glbMountGroup.position.set(0, BASE_GROUND_Y, 0);
  rootGroup.add(glbMountGroup);

  function configureLoadedTrackGlb(gltfScene) {
    if (isDisposed) return;

    gltfScene.traverse((child) => {
      if (child.geometry) disposableGeos.add(child.geometry);
      if (child.material) {
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const m of mats) {
          if (!m) continue;
          disposableMats.add(m);
          if (m.map) disposableTexs.add(m.map);
          if (m.normalMap) disposableTexs.add(m.normalMap);
          if (m.roughnessMap) disposableTexs.add(m.roughnessMap);
          if (m.metalnessMap) disposableTexs.add(m.metalnessMap);
          if (m.emissiveMap) disposableTexs.add(m.emissiveMap);
        }
      }
    });

    // Special handling for the user's complete 3D Drift Race Track GLB (`/models/env/drift_race_track.glb`)
    if (descriptor.isCustomDriftGlb) {
      gltfScene.traverse((child) => {
        if (!child.isMesh) return;
        const nodeName = (child.name || '').trim();
        const lowerName = nodeName.toLowerCase();
        const srcMat = Array.isArray(child.material) ? child.material[0] : child.material;
        const matName = ((srcMat && srcMat.name) || '').toLowerCase();

        child.castShadow = true;
        child.receiveShadow = true;

        if (lowerName === 'object_0' || lowerName.includes('terrain') || matName === 'grass') {
          // Hide the flat GLB grass plane near y=0 so our sculpted 3D stadium terrain renders cleanly without z-fighting
          child.visible = false;
        } else if (lowerName === 'object_1' || lowerName.includes('road') || matName === 'asphalt') {
          // Upgrade the 3D Drift Circuit Road with our 1K photoscanned Normal/ARM maps & wet-puddle shader
          glbRoadMat = trackMat(
            new THREE.MeshPhysicalMaterial({
              color: 0xd8e0ea,
              map: (srcMat && srcMat.map) || procRoadTex,
              normalMap: (srcMat && srcMat.normalMap) || roadPbrPack.normalMap,
              normalScale: new THREE.Vector2(0.82, 0.82),
              roughnessMap: roadPbrPack.armMap,
              roughness: 0.50,
              metalness: 0.14,
              clearcoat: 0.18,
              clearcoatRoughness: 0.44,
              reflectivity: 0.50,
              envMapIntensity: 0.72,
              side: THREE.DoubleSide,
            })
          );
          attachWetPuddleSheenShader(glbRoadMat, roadWetnessUniform, 'road_puddle_glb_drift');
          child.material = glbRoadMat;
        } else if (matName.includes('leaf') || lowerName.includes('bush')) {
          // 93 3D Trees inside `drift_race_track.glb`: enforce crisp alpha-cutout foliage
          if (srcMat) {
            srcMat.alphaTest = 0.35;
            srcMat.transparent = false;
            srcMat.depthWrite = true;
            srcMat.side = THREE.DoubleSide;
            srcMat.roughness = 0.58;
            srcMat.needsUpdate = true;
          }
        } else if (srcMat) {
          // Guardrails (`Rails_03`), sponsor arches (`Banners`), racing flags (`Flags`), arrows, barriers, cones
          srcMat.side = THREE.DoubleSide;
          srcMat.envMapIntensity = 1.25;
        }
      });

      glbMountGroup.add(gltfScene);
      fallbackTrackGroup.visible = false;
      return;
    }

    gltfScene.traverse((child) => {
      const nodeName = (child.name || '').trim();
      const lowerName = nodeName.toLowerCase();

      if (
        lowerName.includes('racingline') ||
        child.isLine ||
        child.isLineStrip ||
        child.isLineSegments ||
        child.isLineLoop
      ) {
        child.visible = false;
        return;
      }

      if (!child.isMesh) return;

      if (
        (lowerName === 'road' ||
          lowerName === 'curbs' ||
          lowerName === 'walls' ||
          lowerName === 'startline') &&
        child.geometry &&
        child.geometry.attributes.position &&
        !child.geometry.userData._widened40
      ) {
        child.geometry.userData._widened40 = true;
        const posAttr = child.geometry.attributes.position;
        const vCount = posAttr.count;
        const invScale = 1.0 / WORLD_TRACK_SCALE;
        for (let vi = 0; vi < vCount; vi++) {
          const rx = posAttr.getX(vi);
          const rz = posAttr.getZ(vi);
          const wx = rx * WORLD_TRACK_SCALE;
          const wz = rz * WORLD_TRACK_SCALE;

          let bestIdx = 0;
          let bestDistSq = Infinity;
          for (let si = 0; si < N; si += 10) {
            const sp = samples[si].position;
            const dx = wx - sp[0];
            const dz = wz - sp[2];
            const dSq = dx * dx + dz * dz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestIdx = si;
            }
          }
          const searchCenter = bestIdx;
          for (let offset = -10; offset <= 10; offset++) {
            const si = (searchCenter + offset + N) % N;
            const sp = samples[si].position;
            const dx = wx - sp[0];
            const dz = wz - sp[2];
            const dSq = dx * dx + dz * dz;
            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestIdx = si;
            }
          }

          const sNear = samples[bestIdx];
          const sp = sNear.position;
          const sr = sNear.right;
          const dx = wx - sp[0];
          const dy = BASE_GROUND_Y + posAttr.getY(vi) * WORLD_TRACK_SCALE - sp[1];
          const dz = wz - sp[2];
          const latDot = dx * sr[0] + dy * sr[1] + dz * sr[2];
          const extraLatRaw = latDot * 0.4 * invScale;
          posAttr.setXYZ(
            vi,
            rx + sr[0] * extraLatRaw,
            posAttr.getY(vi) + sr[1] * extraLatRaw,
            rz + sr[2] * extraLatRaw
          );
        }
        posAttr.needsUpdate = true;
        child.geometry.computeBoundingBox();
        child.geometry.computeBoundingSphere();
      }

      ensureUpwardMeshNormalsAndWinding(child.geometry);
      const srcMat = Array.isArray(child.material) ? child.material[0] : child.material;
      if (srcMat) srcMat.side = THREE.DoubleSide;

      if (lowerName === 'road') {
        child.castShadow = true;
        child.receiveShadow = true;

        if (safeMapId === 'city') {
          glbRoadMat = trackMat(
            new THREE.MeshPhysicalMaterial({
              color: 0xaab4c4,
              map: procRoadTex,
              normalMap: roadPbrPack.normalMap,
              normalScale: new THREE.Vector2(0.80, 0.80),
              roughnessMap: roadPbrPack.armMap,
              roughness: 0.44,
              metalness: 0.18,
              clearcoat: 0.24,
              clearcoatRoughness: 0.42,
              reflectivity: 0.54,
              envMapIntensity: 0.74,
              side: THREE.DoubleSide,
            })
          );
        } else if (safeMapId === 'canyon') {
          glbRoadMat = trackMat(
            new THREE.MeshPhysicalMaterial({
              color: 0xb2bcc9,
              map: procRoadTex,
              normalMap: roadPbrPack.normalMap,
              normalScale: new THREE.Vector2(0.72, 0.72),
              roughnessMap: roadPbrPack.armMap,
              roughness: 0.56,
              metalness: 0.12,
              clearcoat: 0.14,
              clearcoatRoughness: 0.50,
              reflectivity: 0.45,
              envMapIntensity: 0.65,
              side: THREE.DoubleSide,
            })
          );
        } else {
          glbRoadMat = trackMat(
            new THREE.MeshPhysicalMaterial({
              color: 0xadb8c6,
              map: procRoadTex,
              normalMap: roadPbrPack.normalMap,
              normalScale: new THREE.Vector2(0.82, 0.82),
              roughnessMap: roadPbrPack.armMap,
              roughness: 0.54,
              metalness: 0.12,
              clearcoat: 0.16,
              clearcoatRoughness: 0.46,
              reflectivity: 0.48,
              envMapIntensity: 0.68,
              side: THREE.DoubleSide,
            })
          );
        }
        attachWetPuddleSheenShader(glbRoadMat, roadWetnessUniform, `road_puddle_glb_${safeMapId}`);
        child.material = glbRoadMat;
      } else if (lowerName === 'curbs') {
        child.castShadow = true;
        child.receiveShadow = true;
        if (srcMat) {
          srcMat.side = THREE.DoubleSide;
          srcMat.roughness = safeMapId === 'city' ? 0.20 : 0.28;
          srcMat.metalness = safeMapId === 'city' ? 0.48 : 0.22;
          srcMat.envMapIntensity = 1.15;
          if (safeMapId === 'city' && srcMat.emissive) {
            srcMat.emissive.setHex(0x004466);
            srcMat.emissiveIntensity = 0.8;
          }
        }
      } else if (lowerName === 'walls') {
        child.castShadow = true;
        child.receiveShadow = true;
        const posAttr = child.geometry.attributes.position;
        if (posAttr) {
          const vCount = posAttr.count;
          const uvArr = new Float32Array(vCount * 2);
          for (let i = 0; i < vCount; i++) {
            const y = posAttr.getY(i);
            const pairIdx = Math.min(vCount - 1, i ^ 1);
            const yPair = posAttr.getY(pairIdx);
            uvArr[i * 2 + 0] = Math.floor(i / 2) * 0.28;
            uvArr[i * 2 + 1] = y >= yPair ? 1.0 : 0.0;
          }
          child.geometry.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));
        }
        child.material = trackMat(
          new THREE.MeshStandardMaterial({
            color: 0xffffff,
            map: procBarrierWallTex,
            roughness: safeMapId === 'city' ? 0.22 : 0.28,
            metalness: safeMapId === 'city' ? 0.72 : 0.62,
            envMapIntensity: safeMapId === 'city' ? 1.35 : 1.25,
            emissive: new THREE.Color(safeMapId === 'city' ? 0x004466 : 0x1a0c02),
            emissiveIntensity: safeMapId === 'city' ? 0.55 : 0.25,
            side: THREE.DoubleSide,
          })
        );
      } else if (lowerName.startsWith('pillar')) {
        child.castShadow = true;
        child.receiveShadow = true;
        if (srcMat) {
          srcMat.side = THREE.DoubleSide;
          srcMat.roughness = 0.48;
          srcMat.metalness = 0.42;
        }
      } else if (lowerName === 'startline') {
        child.castShadow = false;
        child.receiveShadow = true;
        if (srcMat) {
          srcMat.side = THREE.DoubleSide;
          srcMat.polygonOffset = true;
          srcMat.polygonOffsetFactor = -6;
          srcMat.polygonOffsetUnits = -6;
          srcMat.roughness = 0.34;
        }
      } else if (lowerName === 'ground') {
        child.visible = false;
      }
    });

    glbMountGroup.add(gltfScene);
    fallbackTrackGroup.visible = false;
  }

  const candidateUrls = descriptor.glbCandidateUrls || [];
  function tryLoadCandidateGlb(urlIdx) {
    if (isDisposed || urlIdx >= candidateUrls.length) return;
    sharedGltfLoader.load(
      candidateUrls[urlIdx],
      (gltf) => {
        if (isDisposed) {
          gltf.scene.traverse((c) => {
            if (c.geometry) c.geometry.dispose();
          });
          return;
        }
        configureLoadedTrackGlb(gltf.scene);
      },
      undefined,
      () => {
        tryLoadCandidateGlb(urlIdx + 1);
      }
    );
  }
  if (candidateUrls.length > 0) {
    tryLoadCandidateGlb(0);
  }

  // -------------------------------------------------------------------------
  // 5. DUAL-SIDED 3D TRACKSIDE ARCHITECTURE, VIADUCT PIERS & GRANDSTANDS
  // -------------------------------------------------------------------------
  const trackPts2D = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const s = samples[i];
    trackPts2D[i * 3 + 0] = s.position[0];
    trackPts2D[i * 3 + 1] = s.position[2];
    trackPts2D[i * 3 + 2] = (s.half_width_m || 0.0175) + 0.0028;
  }

  function isClearOfTrack(wx, wz, propRadius = 0.005) {
    for (let i = 0; i < N; i += 2) {
      const tx = trackPts2D[i * 3 + 0];
      const tz = trackPts2D[i * 3 + 1];
      const minClear = trackPts2D[i * 3 + 2] + propRadius;
      const dx = wx - tx;
      const dz = wz - tz;
      if (dx * dx + dz * dz < minClear * minClear) {
        return false;
      }
    }
    return true;
  }

  const dummy = new THREE.Object3D();
  const _pos = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _norm = new THREE.Vector3();
  const _tang = new THREE.Vector3();
  const _left = new THREE.Vector3();
  const _rotMat = new THREE.Matrix4();

  const chevronPlacements = [];
  const viaductPlacements = [];
  for (let i = 0; i < N; i += 3) {
    const s = samples[i];
    const hw = s.half_width_m || 0.0175;
    const isElevated = s.position[1] > BASE_GROUND_Y + 0.0045;
    if (isElevated && i % 9 === 0 && s.position[1] > BASE_GROUND_Y + 0.0065) {
      viaductPlacements.push(s);
    }
    const iPrev = (i - 4 + N) % N;
    const iNext = (i + 4) % N;
    const dotTang =
      samples[iPrev].tangent[0] * samples[iNext].tangent[0] +
      samples[iPrev].tangent[2] * samples[iNext].tangent[2];
    // Skip extra procedural chevrons on 'drift' since `drift_race_track.glb` already has 17 3D Arrow signs + 52 barriers
    if (safeMapId !== 'drift' && dotTang < 0.955 && i % 9 === 0 && !isElevated) {
      const crossY =
        samples[iPrev].tangent[0] * samples[iNext].tangent[2] -
        samples[iPrev].tangent[2] * samples[iNext].tangent[0];
      const outerSide = crossY > 0 ? 1 : -1;
      chevronPlacements.push({ sample: s, side: outerSide, outDist: hw + 0.0056 });
    }
  }

  if (viaductPlacements.length > 0) {
    const pierColGeo = trackGeo(new THREE.CylinderGeometry(0.0018, 0.0024, 1.0, 8));
    pierColGeo.translate(0, -0.5, 0);
    const pierCapGeo = trackGeo(new THREE.BoxGeometry(0.032, 0.0024, 0.0048));
    pierCapGeo.translate(0, -0.0014, 0);
    const pierMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: safeMapId === 'city' ? 0x0f172a : safeMapId === 'desert' ? 0x573b26 : 0x334155,
        roughness: 0.55,
        metalness: 0.35,
      })
    );
    const instPierCols = new THREE.InstancedMesh(
      pierColGeo,
      pierMat,
      viaductPlacements.length * 2
    );
    const instPierCaps = new THREE.InstancedMesh(pierCapGeo, pierMat, viaductPlacements.length);

    for (let idx = 0; idx < viaductPlacements.length; idx++) {
      const s = viaductPlacements[idx];
      _pos.fromArray(s.position);
      _right.fromArray(s.right);
      _norm.fromArray(s.normal);
      _tang.fromArray(s.tangent);
      _left.crossVectors(_norm, _tang).normalize();
      _rotMat.makeBasis(_left, _norm, _tang);

      const pierHeight = Math.max(0.008, s.position[1] - (BASE_GROUND_Y - 0.006));
      dummy.position.copy(_pos);
      dummy.quaternion.setFromRotationMatrix(_rotMat);
      dummy.scale.setScalar(1.0);
      dummy.updateMatrix();
      instPierCaps.setMatrixAt(idx, dummy.matrix);

      for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
        const side = sideIdx === 0 ? -1 : 1;
        dummy.position.copy(_pos).addScaledVector(_right, side * 0.011);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1.0, pierHeight, 1.0);
        dummy.updateMatrix();
        instPierCols.setMatrixAt(idx * 2 + sideIdx, dummy.matrix);
      }
    }
    instPierCols.instanceMatrix.needsUpdate = true;
    instPierCaps.instanceMatrix.needsUpdate = true;
    instPierCols.computeBoundingSphere();
    instPierCaps.computeBoundingSphere();
    rootGroup.add(instPierCols, instPierCaps);
  }

  if (chevronPlacements.length > 0) {
    const chevBoardGeo = trackGeo(new THREE.BoxGeometry(0.0005, 0.0038, 0.0064));
    chevBoardGeo.translate(0, 0.0044, 0);
    const chevMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(skyCfg.accent),
        emissive: new THREE.Color(skyCfg.accent),
        emissiveIntensity: safeMapId === 'city' ? 1.35 : 0.75,
        roughness: 0.25,
        metalness: 0.5,
      })
    );
    const instChev = new THREE.InstancedMesh(chevBoardGeo, chevMat, chevronPlacements.length);
    for (let idx = 0; idx < chevronPlacements.length; idx++) {
      const { sample: s, side, outDist } = chevronPlacements[idx];
      _pos.fromArray(s.position);
      _right.fromArray(s.right);
      _norm.fromArray(s.normal);
      _tang.fromArray(s.tangent);
      _left.crossVectors(_norm, _tang).normalize();
      _rotMat.makeBasis(_left, _norm, _tang);

      dummy.position.copy(_pos).addScaledVector(_right, side * outDist);
      dummy.quaternion.setFromRotationMatrix(_rotMat);
      dummy.rotateY(side > 0 ? -0.35 : 0.35);
      dummy.scale.setScalar(1.0);
      dummy.updateMatrix();
      instChev.setMatrixAt(idx, dummy.matrix);
    }
    instChev.instanceMatrix.needsUpdate = true;
    instChev.computeBoundingSphere();
    rootGroup.add(instChev);
  }

  // Tiered Spectator Grandstands on Start Straight
  const grandstandPlacements = [];
  for (const idx of [722, 734, 8, 20]) {
    const s = samples[((idx % N) + N) % N];
    const hw = s.half_width_m || 0.02;
    for (const side of [-1, 1]) {
      const distOut = hw + 0.024;
      const gx = s.position[0] + s.right[0] * side * distOut;
      const gz = s.position[2] + s.right[2] * side * distOut;
      if (isClearOfTrack(gx, gz, 0.011)) {
        const yaw =
          Math.atan2(s.tangent[0], s.tangent[2]) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        const gy = Math.max(BASE_GROUND_Y - 0.001, getTerrainHeightAt(gx, gz));
        grandstandPlacements.push([gx, gy, gz, yaw]);
      }
    }
  }
  if (grandstandPlacements.length > 0) {
    const tier1 = new THREE.BoxGeometry(0.016, 0.003, 0.004);
    tier1.translate(0, 0.0015, 0.0025);
    const tier2 = new THREE.BoxGeometry(0.016, 0.006, 0.004);
    tier2.translate(0, 0.003, -0.001);
    const tier3 = new THREE.BoxGeometry(0.016, 0.009, 0.004);
    tier3.translate(0, 0.0045, -0.0045);
    const gsBodyGeo = trackGeo(mergeNormalizedParts([tier1, tier2, tier3]));
    tier1.dispose();
    tier2.dispose();
    tier3.dispose();

    const gsBodyMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: safeMapId === 'city' ? 0x090f1d : 0x1e293b,
        roughness: 0.38,
        metalness: 0.55,
      })
    );

    const roofGeo = trackGeo(new THREE.BoxGeometry(0.017, 0.0012, 0.012));
    roofGeo.rotateX(0.18);
    roofGeo.translate(0, 0.0125, -0.001);
    const gsRoofMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(skyCfg.accent),
        emissive: new THREE.Color(skyCfg.accent),
        emissiveIntensity: safeMapId === 'city' ? 1.15 : 0.35,
        roughness: 0.26,
      })
    );

    const instGsBody = new THREE.InstancedMesh(gsBodyGeo, gsBodyMat, grandstandPlacements.length);
    const instGsRoof = new THREE.InstancedMesh(roofGeo, gsRoofMat, grandstandPlacements.length);
    for (let i = 0; i < grandstandPlacements.length; i++) {
      const [gx, gy, gz, yaw] = grandstandPlacements[i];
      dummy.position.set(gx, gy, gz);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.setScalar(1.0);
      dummy.updateMatrix();
      instGsBody.setMatrixAt(i, dummy.matrix);
      instGsRoof.setMatrixAt(i, dummy.matrix);
    }
    instGsBody.instanceMatrix.needsUpdate = true;
    instGsRoof.instanceMatrix.needsUpdate = true;
    instGsBody.computeBoundingSphere();
    instGsRoof.computeBoundingSphere();
    rootGroup.add(instGsBody, instGsRoof);
  }

  // -------------------------------------------------------------------------
  // 6. MULTI-LAYERED 3D ENVIRONMENT WORLDS & ANIMATED 3D HORIZON LANDMARKS
  // -------------------------------------------------------------------------
  let oceanUniforms = null;
  let snowPoints = null;
  let lighthouseBeamGroup = null;
  let yachtGroupList = [];
  let gondolaCabins = [];
  let gondolaSpanStart = null;
  let gondolaSpanEnd = null;
  let cyberSearchlights = [];
  let cyberBlimps = [];

  if (safeMapId === 'coast') {
    // 1. Deep Golden-Hour Specular Ocean Horizon Plane
    oceanUniforms = {
      uTime: { value: 0.0 },
      uDeepColor: { value: new THREE.Color(0x040d1a) },
      uShallowColor: { value: new THREE.Color(0x0b2239) },
      uSunGlintColor: { value: new THREE.Color(0xffb347) },
    };
    const oceanGeo = trackGeo(new THREE.PlaneGeometry(8.5, 8.5, 56, 56));
    const oceanMat = trackMat(
      new THREE.ShaderMaterial({
        uniforms: oceanUniforms,
        side: THREE.DoubleSide,
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;
          void main() {
            vUv = uv;
            vec3 pos = position;
            float w = sin(pos.x * 22.0 + uTime * 2.1) * cos(pos.y * 18.0 + uTime * 1.5) * 0.00095;
            pos.z += w;
            vWave = w;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uDeepColor;
          uniform vec3 uShallowColor;
          uniform vec3 uSunGlintColor;
          varying vec2 vUv;
          varying float vWave;
          void main() {
            float radial = length(vUv - vec2(0.5)) * 2.0;
            vec3 base = mix(uShallowColor, uDeepColor, clamp(radial, 0.0, 1.0));
            float glint = smoothstep(0.00012, 0.00082, vWave);
            vec3 col = mix(base, uSunGlintColor, glint * 0.68);
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.position.set(0, BASE_GROUND_Y - 0.0038, 0);
    rootGroup.add(oceanMesh);

    // 2. Tropical Coastal Palm Trees + Modern Dark-Glass Resort Towers
    const palmPlacements = [];
    const resortPlacements = [];
    for (let i = 0; i < N; i += 10) {
      const s = samples[i];
      const hw = s.half_width_m || 0.0175;
      for (const side of [-1, 1]) {
        const distOut = hw + 0.032 + ((i * 17 + (side > 0 ? 3 : 0)) % 6) * 0.008;
        const px = s.position[0] + s.right[0] * side * distOut;
        const pz = s.position[2] + s.right[2] * side * distOut;
        if (isClearOfTrack(px, pz, 0.018)) {
          const py = Math.max(BASE_GROUND_Y - 0.0015, getTerrainHeightAt(px, pz) - 0.0006);
          const sc = 0.96 + ((i * 3) % 5) * 0.16;
          palmPlacements.push([px, py, pz, sc, i * 1.15 + side]);
        }

        if (i % 20 === 0) {
          const towerDist = hw + 0.058 + ((i * 11) % 4) * 0.018;
          const vx = s.position[0] + s.right[0] * side * towerDist;
          const vz = s.position[2] + s.right[2] * side * towerDist;
          if (isClearOfTrack(vx, vz, 0.025)) {
            const vy = Math.max(BASE_GROUND_Y - 0.001, getTerrainHeightAt(vx, vz) - 0.0008);
            const sc = 0.95 + (i % 4) * 0.22;
            const yaw =
              Math.atan2(s.tangent[0], s.tangent[2]) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
            resortPlacements.push([vx, vy, vz, sc, yaw]);
          }
        }
      }
    }

    if (palmPlacements.length > 0) {
      const { trunkGeo, frondGeo } = build3DPalmTreeGeometries(trackGeo);
      const trunkMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.78 })
      );
      const frondMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x143822,
          roughness: 0.42,
          metalness: 0.12,
        })
      );
      const instTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmPlacements.length);
      const instFronds = new THREE.InstancedMesh(frondGeo, frondMat, palmPlacements.length);
      for (let i = 0; i < palmPlacements.length; i++) {
        const [px, py, pz, sc, rotY] = palmPlacements[i];
        dummy.position.set(px, py, pz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        instTrunks.setMatrixAt(i, dummy.matrix);
        instFronds.setMatrixAt(i, dummy.matrix);
      }
      instTrunks.instanceMatrix.needsUpdate = true;
      instFronds.instanceMatrix.needsUpdate = true;
      instTrunks.computeBoundingSphere();
      instFronds.computeBoundingSphere();
      rootGroup.add(instTrunks, instFronds);
    }

    if (resortPlacements.length > 0) {
      const vLower = new THREE.BoxGeometry(0.024, 0.028, 0.016);
      vLower.translate(0, 0.014, 0);
      const vUpper = new THREE.BoxGeometry(0.016, 0.022, 0.013);
      vUpper.translate(-0.002, 0.039, 0);
      const resortBodyGeo = trackGeo(mergeNormalizedParts([vLower, vUpper]));
      vLower.dispose();
      vUpper.dispose();

      const b1 = new THREE.BoxGeometry(0.0246, 0.0018, 0.0166);
      b1.translate(0, 0.012, 0);
      const b2 = new THREE.BoxGeometry(0.0246, 0.0018, 0.0166);
      b2.translate(0, 0.024, 0);
      const b3 = new THREE.BoxGeometry(0.0166, 0.0018, 0.0136);
      b3.translate(-0.002, 0.044, 0);
      const resortGlowGeo = trackGeo(mergeNormalizedParts([b1, b2, b3]));
      b1.dispose();
      b2.dispose();
      b3.dispose();

      const resortMat = trackMat(
        new THREE.MeshPhysicalMaterial({
          color: 0x0f172a,
          roughness: 0.16,
          metalness: 0.72,
          clearcoat: 0.85,
          envMapIntensity: 1.65,
        })
      );
      const resortGlowMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0xffb347,
          toneMapped: false,
        })
      );
      const instResorts = new THREE.InstancedMesh(resortBodyGeo, resortMat, resortPlacements.length);
      const instResortGlow = new THREE.InstancedMesh(
        resortGlowGeo,
        resortGlowMat,
        resortPlacements.length
      );
      for (let i = 0; i < resortPlacements.length; i++) {
        const [vx, vy, vz, sc, yaw] = resortPlacements[i];
        dummy.position.set(vx, vy, vz);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        instResorts.setMatrixAt(i, dummy.matrix);
        instResortGlow.setMatrixAt(i, dummy.matrix);
      }
      instResorts.instanceMatrix.needsUpdate = true;
      instResortGlow.instanceMatrix.needsUpdate = true;
      instResorts.computeBoundingSphere();
      instResortGlow.computeBoundingSphere();
      rootGroup.add(instResorts, instResortGlow);
    }

    // 3. Iconic 3D Coastal Headland Lighthouse with Rotating Volumetric Beacon Beam
    const lhGroup = new THREE.Group();
    const lhX = 0.34;
    const lhZ = -0.38;
    const lhBaseY = Math.max(BASE_GROUND_Y + 0.012, getTerrainHeightAt(lhX, lhZ));
    lhGroup.position.set(lhX, lhBaseY, lhZ);

    const lhTowerGeo = trackGeo(new THREE.CylinderGeometry(0.0055, 0.0095, 0.068, 12));
    lhTowerGeo.translate(0, 0.034, 0);
    const lhTowerMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 })
    );
    lhGroup.add(new THREE.Mesh(lhTowerGeo, lhTowerMat));

    const lhBandGeo = trackGeo(new THREE.CylinderGeometry(0.0074, 0.0084, 0.018, 12));
    lhBandGeo.translate(0, 0.036, 0);
    const lhBandMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.45 })
    );
    lhGroup.add(new THREE.Mesh(lhBandGeo, lhBandMat));

    const lhLanternGeo = trackGeo(new THREE.CylinderGeometry(0.0052, 0.0052, 0.012, 10));
    lhLanternGeo.translate(0, 0.072, 0);
    const lhLanternMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xfef08a, toneMapped: false })
    );
    lhGroup.add(new THREE.Mesh(lhLanternGeo, lhLanternMat));

    const lhDomeGeo = trackGeo(new THREE.ConeGeometry(0.0068, 0.011, 10));
    lhDomeGeo.translate(0, 0.082, 0);
    lhGroup.add(new THREE.Mesh(lhDomeGeo, lhBandMat));

    lighthouseBeamGroup = new THREE.Group();
    lighthouseBeamGroup.position.set(0, 0.072, 0);
    const beamConeGeo = trackGeo(new THREE.ConeGeometry(0.032, 0.24, 12, 1, true));
    beamConeGeo.rotateX(Math.PI * 0.5);
    beamConeGeo.translate(0, 0, 0.12);
    const beamConeMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xfde047,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    lighthouseBeamGroup.add(new THREE.Mesh(beamConeGeo, beamConeMat));
    lhGroup.add(lighthouseBeamGroup);
    rootGroup.add(lhGroup);

    // 4. 10 3D Sunset Racing Yachts Floating on the Outer Bay
    const yachtHullGeo = trackGeo(new THREE.BoxGeometry(0.007, 0.003, 0.022));
    const yachtSailGeo = trackGeo(new THREE.ConeGeometry(0.0085, 0.028, 3));
    yachtSailGeo.translate(0, 0.015, 0);
    const yachtHullMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 })
    );
    const yachtSailMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xfff7ed,
        emissive: new THREE.Color(0xfdba74),
        emissiveIntensity: 0.25,
        roughness: 0.4,
      })
    );
    for (let yIdx = 0; yIdx < 10; yIdx++) {
      const ang = (yIdx / 10) * Math.PI * 2.0 + 0.4;
      const rad = 0.64 + (yIdx % 3) * 0.11;
      const yx = Math.cos(ang) * rad;
      const yz = Math.sin(ang) * rad;
      if (!isClearOfTrack(yx, yz, 0.08)) continue;
      const yGroup = new THREE.Group();
      yGroup.position.set(yx, BASE_GROUND_Y - 0.0025, yz);
      yGroup.rotation.y = ang + Math.PI * 0.5;
      yGroup.add(
        new THREE.Mesh(yachtHullGeo, yachtHullMat),
        new THREE.Mesh(yachtSailGeo, yachtSailMat)
      );
      rootGroup.add(yGroup);
      yachtGroupList.push({ group: yGroup, basePhase: yIdx * 0.9 });
    }
  } else if (safeMapId === 'city') {
    // Shibuya Metropolis: Stepped Cyberpunk Skyscrapers + Neon Portals + Sky Searchlights
    const buildingTex = trackTex(createCityBuildingFacadeTexture());
    const towerPlacements = [];

    for (let i = 0; i < N; i += 6) {
      const s = samples[i];
      const hw = s.half_width_m || 0.0175;
      const yaw = Math.atan2(s.tangent[0], s.tangent[2]);
      for (const side of [-1, 1]) {
        const dist0 = hw + 0.024 + ((i * 7 + (side > 0 ? 2 : 0)) % 4) * 0.006;
        const bx0 = s.position[0] + s.right[0] * side * dist0;
        const bz0 = s.position[2] + s.right[2] * side * dist0;
        if (isClearOfTrack(bx0, bz0, 0.015)) {
          const by0 = Math.max(BASE_GROUND_Y - 0.002, getTerrainHeightAt(bx0, bz0));
          const w = 0.016 + (i % 3) * 0.004;
          const h = 0.056 + ((i * 5) % 6) * 0.024;
          const d = 0.016 + ((i + 1) % 3) * 0.004;
          towerPlacements.push([bx0, by0, bz0, w, h, d, yaw]);
        }

        if (i % 12 === 0) {
          const dist1 = hw + 0.058 + ((i * 13) % 5) * 0.012;
          const bx1 = s.position[0] + s.right[0] * side * dist1;
          const bz1 = s.position[2] + s.right[2] * side * dist1;
          if (isClearOfTrack(bx1, bz1, 0.022)) {
            const by1 = Math.max(BASE_GROUND_Y - 0.002, getTerrainHeightAt(bx1, bz1));
            const w = 0.028 + (i % 3) * 0.007;
            const h = 0.105 + ((i * 7) % 6) * 0.036;
            const d = 0.028 + ((i + 1) % 3) * 0.007;
            towerPlacements.push([bx1, by1, bz1, w, h, d, yaw]);
          }
        }
      }
    }

    for (let m = 0; m < 24; m++) {
      const ang = (m / 24) * Math.PI * 2.0 + 0.11;
      const rad = 0.78 + (m % 3) * 0.16;
      const mx = Math.cos(ang) * rad;
      const mz = Math.sin(ang) * rad;
      if (isClearOfTrack(mx, mz, 0.05)) {
        const w = 0.042 + (m % 4) * 0.01;
        const h = 0.18 + ((m * 5) % 6) * 0.038;
        const d = 0.042 + ((m + 2) % 4) * 0.01;
        towerPlacements.push([mx, BASE_GROUND_Y - 0.002, mz, w, h, d, ang]);
      }
    }

    if (towerPlacements.length > 0) {
      const { bodyGeo, trimGeo } = build3DCyberTowerGeometries(trackGeo);
      const towerMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x0f172a,
          map: buildingTex,
          emissive: new THREE.Color(0x38bdf8),
          emissiveMap: buildingTex,
          emissiveIntensity: 1.55,
          roughness: 0.24,
          metalness: 0.72,
        })
      );
      const trimMat = trackMat(
        new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          toneMapped: false,
        })
      );

      const instTowers = new THREE.InstancedMesh(bodyGeo, towerMat, towerPlacements.length);
      const instTrims = new THREE.InstancedMesh(trimGeo, trimMat, towerPlacements.length);

      for (let i = 0; i < towerPlacements.length; i++) {
        const [bx, by, bz, w, h, d, rotY] = towerPlacements[i];
        dummy.position.set(bx, by, bz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(w, h, d);
        dummy.updateMatrix();
        instTowers.setMatrixAt(i, dummy.matrix);
        instTrims.setMatrixAt(i, dummy.matrix);
      }
      instTowers.instanceMatrix.needsUpdate = true;
      instTrims.instanceMatrix.needsUpdate = true;
      instTowers.computeBoundingSphere();
      instTrims.computeBoundingSphere();
      rootGroup.add(instTowers, instTrims);
    }

    const archBeamGeo = trackGeo(new THREE.BoxGeometry(0.068, 0.0016, 0.002));
    archBeamGeo.translate(0, 0.025, 0);
    const archPillarGeo = trackGeo(new THREE.BoxGeometry(0.0016, 0.025, 0.002));
    archPillarGeo.translate(0, 0.0125, 0);
    const portalMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0xf472b6, toneMapped: false })
    );
    for (const frac of [0.18, 0.42, 0.68, 0.88]) {
      const idx = Math.floor(frac * N) % N;
      const s = samples[idx];
      const portalGroup = new THREE.Group();
      portalGroup.position.set(s.position[0], s.position[1], s.position[2]);
      _norm.fromArray(s.normal);
      _tang.fromArray(s.tangent);
      _left.crossVectors(_norm, _tang).normalize();
      _rotMat.makeBasis(_left, _norm, _tang);
      portalGroup.quaternion.setFromRotationMatrix(_rotMat);
      const span = (s.half_width_m || 0.024) + 0.0055;
      for (const side of [-1, 1]) {
        const p = new THREE.Mesh(archPillarGeo, gantryMetalMat);
        p.position.x = side * span;
        portalGroup.add(p);
      }
      portalGroup.add(new THREE.Mesh(archBeamGeo, portalMat));
      rootGroup.add(portalGroup);
    }

    const laserConeGeo = trackGeo(new THREE.ConeGeometry(0.026, 0.42, 10, 1, true));
    laserConeGeo.translate(0, 0.21, 0);
    const cyanLaserMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    const magLaserMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0xf472b6,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        toneMapped: false,
      })
    );
    for (let lIdx = 0; lIdx < 6; lIdx++) {
      const ang = (lIdx / 6) * Math.PI * 2.0;
      const beamMesh = new THREE.Mesh(laserConeGeo, lIdx % 2 === 0 ? cyanLaserMat : magLaserMat);
      beamMesh.position.set(Math.cos(ang) * 0.55, BASE_GROUND_Y + 0.02, Math.sin(ang) * 0.55);
      rootGroup.add(beamMesh);
      cyberSearchlights.push({ mesh: beamMesh, phase: lIdx * 1.05 });
    }

    const blimpHullGeo = trackGeo(new THREE.SphereGeometry(0.018, 12, 10));
    blimpHullGeo.scale(1.0, 0.85, 2.8);
    const blimpGlowGeo = trackGeo(new THREE.BoxGeometry(0.038, 0.006, 0.055));
    const blimpHullMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.8 })
    );
    for (let bIdx = 0; bIdx < 2; bIdx++) {
      const bGroup = new THREE.Group();
      const bMat = bIdx === 0 ? portalMat : topBarMat;
      bGroup.add(
        new THREE.Mesh(blimpHullGeo, blimpHullMat),
        new THREE.Mesh(blimpGlowGeo, bMat)
      );
      rootGroup.add(bGroup);
      cyberBlimps.push({
        group: bGroup,
        radius: 0.42 + bIdx * 0.16,
        height: BASE_GROUND_Y + 0.16 + bIdx * 0.04,
        speed: 0.14 - bIdx * 0.04,
        phase: bIdx * Math.PI,
      });
    }
  } else if (safeMapId === 'canyon') {
    // Chamonix Glacier: Moving Alpine Gondola Cable-Car + Gentle Snowflakes
    // (Real 3D Snowy Mountain Ranges & 3D Forest Trees are mounted in Section 8 below!)
    gondolaSpanStart = new THREE.Vector3(-0.36, BASE_GROUND_Y + 0.135, -0.22);
    gondolaSpanEnd = new THREE.Vector3(0.38, BASE_GROUND_Y + 0.165, 0.24);
    const pylonGeo = trackGeo(new THREE.CylinderGeometry(0.0022, 0.0045, 0.16, 6));
    pylonGeo.translate(0, -0.08, 0);
    for (const pPt of [gondolaSpanStart, gondolaSpanEnd]) {
      const pMesh = new THREE.Mesh(pylonGeo, gantryMetalMat);
      pMesh.position.copy(pPt);
      rootGroup.add(pMesh);
    }
    const cableLen = gondolaSpanStart.distanceTo(gondolaSpanEnd);
    const cableGeo = trackGeo(new THREE.CylinderGeometry(0.0004, 0.0004, cableLen, 6));
    cableGeo.rotateX(Math.PI * 0.5);
    const cableMesh = new THREE.Mesh(cableGeo, gantryMetalMat);
    cableMesh.position.lerpVectors(gondolaSpanStart, gondolaSpanEnd, 0.5);
    cableMesh.lookAt(gondolaSpanEnd);
    rootGroup.add(cableMesh);

    const gondolaBodyGeo = trackGeo(new THREE.BoxGeometry(0.009, 0.007, 0.012));
    const gondolaHangerGeo = trackGeo(new THREE.CylinderGeometry(0.0003, 0.0003, 0.007, 4));
    gondolaHangerGeo.translate(0, 0.005, 0);
    const gondolaMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: new THREE.Color(0xfbbf24),
        emissiveIntensity: 0.35,
        roughness: 0.35,
      })
    );
    for (let gIdx = 0; gIdx < 4; gIdx++) {
      const gGroup = new THREE.Group();
      const body = new THREE.Mesh(gondolaBodyGeo, gondolaMat);
      body.position.y = -0.007;
      gGroup.add(body, new THREE.Mesh(gondolaHangerGeo, gantryMetalMat));
      rootGroup.add(gGroup);
      gondolaCabins.push({ group: gGroup, offset: gIdx / 4 });
    }

    const snowCount = 320;
    const snowPos = new Float32Array(snowCount * 3);
    for (let i = 0; i < snowCount; i++) {
      snowPos[i * 3 + 0] = (Math.random() - 0.5) * 1.4;
      snowPos[i * 3 + 1] = BASE_GROUND_Y + Math.random() * 0.28;
      snowPos[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
    }
    const snowGeo = trackGeo(new THREE.BufferGeometry());
    snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
    const snowMat = trackMat(
      new THREE.PointsMaterial({
        color: 0xffffff,
        size: 0.0022,
        transparent: true,
        opacity: 0.72,
        depthWrite: false,
      })
    );
    snowPoints = new THREE.Points(snowGeo, snowMat);
    rootGroup.add(snowPoints);
  }

  // -------------------------------------------------------------------------
  // 8. AAA 3D GLB ENVIRONMENT SCENES & PHOTOGRAMMETRY 3D HERO PROPS
  // -------------------------------------------------------------------------
  const photogrammetryGroup = new THREE.Group();
  photogrammetryGroup.name = 'PhotogrammetryHeroProps';
  rootGroup.add(photogrammetryGroup);

  const heroDummy = new THREE.Object3D();

  // Helper to spawn a multi-part 3D GLB prop template as 1 InstancedMesh per sub-part
  function spawnMultiPartInstancedProp(tplOrParts, placements, opts = {}) {
    const parts = Array.isArray(tplOrParts) ? tplOrParts : tplOrParts?.parts;
    if (!Array.isArray(parts) || parts.length === 0 || placements.length === 0) return;
    for (const part of parts) {
      let mat = part.material;
      if (opts.materialOverride) {
        mat = opts.materialOverride(part.material, part.name);
      }
      const inst = new THREE.InstancedMesh(part.geometry, mat, placements.length);
      inst.castShadow = Boolean(opts.castShadow);
      inst.receiveShadow = true;
      for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        heroDummy.position.set(p.x, p.y, p.z);
        heroDummy.rotation.set(p.rotX || 0, p.yaw || 0, p.rotZ || 0);
        if (p.scaleXYZ) {
          heroDummy.scale.set(p.scaleXYZ[0], p.scaleXYZ[1], p.scaleXYZ[2]);
        } else {
          heroDummy.scale.setScalar(p.scale);
        }
        heroDummy.updateMatrix();
        inst.setMatrixAt(i, heroDummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      photogrammetryGroup.add(inst);
    }
  }

  // 1) Photogrammetry Weathered Concrete Road Barriers lining start/finish pit & apexes
  if (safeMapId !== 'drift') {
    loadPhotogrammetryPropTemplate('concrete_road_barrier').then((tpl) => {
      if (isDisposed || !tpl) return;
      const placements = [];
      const barrierFractions = [0.02, 0.045, 0.07, 0.26, 0.285, 0.54, 0.565, 0.78, 0.805, 0.94, 0.965];
      for (let i = 0; i < barrierFractions.length; i++) {
        const idx = Math.floor(barrierFractions[i] * N) % N;
        const s = samples[idx];
        if (!s) continue;
        const hw = s.half_width_m || 0.024;
        const side = i % 2 === 0 ? 1 : -1;
        const lat = side * (hw + 0.0085);
        const bx = s.position[0] + s.right[0] * lat;
        const bz = s.position[2] + s.right[2] * lat;
        const by = Math.max(getTerrainHeightAt(bx, bz), s.position[1] - 0.0025);
        const yaw = Math.atan2(s.tangent[0], s.tangent[2]);
        placements.push({ x: bx, y: by, z: bz, yaw, scale: 0.014 });
      }
      if (placements.length === 0) return;
      const inst = new THREE.InstancedMesh(tpl.geometry, tpl.material, placements.length);
      inst.castShadow = false;
      inst.receiveShadow = true;
      for (let i = 0; i < placements.length; i++) {
        const p = placements[i];
        heroDummy.position.set(p.x, p.y, p.z);
        heroDummy.rotation.set(0, p.yaw, 0);
        heroDummy.scale.setScalar(p.scale);
        heroDummy.updateMatrix();
        inst.setMatrixAt(i, heroDummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      photogrammetryGroup.add(inst);
    });
  }

  // 2) Real 3D Multi-Part Normal-Mapped Forest Trees (`forest_tree_01.glb` from user's uploaded Forest Scene)
  if (
    safeMapId === 'forest' ||
    safeMapId === 'coast' ||
    safeMapId === 'drift' ||
    safeMapId === 'canyon'
  ) {
    loadMultiPartPropTemplate('forest_tree_01').then((parts) => {
      if (isDisposed || !parts) return;
      const treePlacements = [];
      const strideStep = safeMapId === 'forest' ? 5 : safeMapId === 'canyon' ? 7 : 10;
      const maxRows = safeMapId === 'forest' ? 3 : 2;

      for (let i = 0; i < N; i += strideStep) {
        const s = samples[i];
        const hw = s.half_width_m || 0.022;
        for (const side of [-1, 1]) {
          for (let row = 0; row < maxRows; row++) {
            if (row === 1 && i % (strideStep * 2) !== 0) continue;
            if (row === 2 && i % (strideStep * 3) !== 0) continue;
            const distOut =
              hw +
              (safeMapId === 'drift' ? 0.042 : 0.026) +
              row * 0.032 +
              ((i * 19 + (side > 0 ? 4 : 0) + row * 3) % 6) * 0.0075;
            const tx = s.position[0] + s.right[0] * side * distOut;
            const tz = s.position[2] + s.right[2] * side * distOut;
            if (isClearOfTrack(tx, tz, 0.016)) {
              const ty = Math.max(BASE_GROUND_Y - 0.0018, getTerrainHeightAt(tx, tz) - 0.0012);
              const sc = 0.026 + row * 0.007 + ((i + row * 2) % 5) * 0.0045;
              treePlacements.push({
                x: tx,
                y: ty,
                z: tz,
                yaw: i * 1.37 + side + row,
                scale: sc,
              });
            }
          }
        }
      }

      spawnMultiPartInstancedProp(parts, treePlacements, {
        castShadow: true,
        materialOverride: (baseMat) => {
          if (safeMapId === 'canyon') {
            // Frost-dusted alpine evergreen tint for Chamonix Glacier
            const frostyMat = baseMat.clone();
            frostyMat.color.lerp(new THREE.Color(0xdbeafe), 0.38);
            trackMat(frostyMat);
            return frostyMat;
          }
          return baseMat;
        },
      });
    });
  }

  // 3) User's 22-Tree 3D Forest Grove Island Scene (`forest_trees_scene.glb`) on Hakone Touge & Amalfi Riviera
  if (safeMapId === 'forest' || safeMapId === 'coast') {
    loadEnvironmentSceneGlb('forest_trees_scene').then((sceneTemplate) => {
      if (isDisposed || !sceneTemplate) return;
      const groveSpots =
        safeMapId === 'forest'
          ? [
              { x: 0.0, z: 0.0, scale: 0.011, yaw: 0.3 },
              { x: -0.26, z: 0.14, scale: 0.0095, yaw: 1.8 },
              { x: 0.24, z: -0.16, scale: 0.0095, yaw: -1.1 },
            ]
          : [{ x: -0.18, z: 0.12, scale: 0.0085, yaw: 0.75 }];

      for (const spot of groveSpots) {
        if (!isClearOfTrack(spot.x, spot.z, 0.075)) continue;
        const groveClone = sceneTemplate.clone(true);
        const gy = Math.max(BASE_GROUND_Y - 0.002, getTerrainHeightAt(spot.x, spot.z) - 0.002);
        groveClone.position.set(spot.x, gy, spot.z);
        groveClone.rotation.y = spot.yaw;
        groveClone.scale.setScalar(spot.scale);
        photogrammetryGroup.add(groveClone);
      }
    });
  }

  // 4) User's 3D Snowy Mountain Road Scene & 360° 3D Mountain Massifs (`snowy_mountain_scene.glb`)
  // Replaces ALL old 6-sided ConeGeometry pyramid mountains across outdoor tracks!
  if (safeMapId !== 'city') {
    loadEnvironmentSceneGlb('snowy_mountain_scene').then((snowScene) => {
      if (isDisposed || !snowScene) return;

      // On Chamonix Glacier ('canyon'), mount the detailed 3D Snowy Mountain Road Pass diorama in the alpine valley
      if (safeMapId === 'canyon') {
        const passClone = snowScene.clone(true);
        passClone.scale.setScalar(0.00145);
        passClone.position.set(-0.08, BASE_GROUND_Y - 0.004, 0.04);
        passClone.rotation.y = 0.42;
        photogrammetryGroup.add(passClone);
      }

      // Extract the massive 3D `SnowyMountainMassif` (535m x 955m x 196m) & `SnowyMountainForest`
      let massifMesh = null;
      let forestMesh = null;
      snowScene.traverse((child) => {
        if (!child.isMesh) return;
        const n = (child.name || '').toLowerCase();
        if (n.includes('mountainmassif') || n.includes('mountain_mountain')) {
          massifMesh = child;
        } else if (n.includes('mountainforest') || n === 'background_trees_background_trees_0') {
          forestMesh = child;
        }
      });

      if (massifMesh && massifMesh.geometry) {
        const ringCount = 6;
        let massifMat = massifMesh.material;

        // Re-theme the 3D mountain range PBR material for non-snow biomes (Mojave Red Canyon, Hakone Forest, Amalfi Coast, Autodrome)
        if (safeMapId === 'desert') {
          massifMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: 0xb45328,
              normalMap: massifMesh.material?.normalMap || null,
              roughness: 0.86,
              metalness: 0.06,
            })
          );
        } else if (safeMapId === 'forest') {
          massifMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: 0x1e3f2b,
              normalMap: massifMesh.material?.normalMap || null,
              roughness: 0.82,
              metalness: 0.06,
            })
          );
        } else if (safeMapId === 'coast' || safeMapId === 'drift') {
          massifMat = trackMat(
            new THREE.MeshStandardMaterial({
              color: safeMapId === 'coast' ? 0x243447 : 0x263829,
              normalMap: massifMesh.material?.normalMap || null,
              roughness: 0.84,
              metalness: 0.08,
            })
          );
        }

        const instMassifs = new THREE.InstancedMesh(massifMesh.geometry, massifMat, ringCount);
        instMassifs.receiveShadow = true;

        const instForest =
          safeMapId === 'canyon' && forestMesh && forestMesh.geometry
            ? new THREE.InstancedMesh(forestMesh.geometry, forestMesh.material, ringCount)
            : null;

        for (let i = 0; i < ringCount; i++) {
          const ang = (i / ringCount) * Math.PI * 2.0 + 0.25;
          const rad = 1.08 + (i % 2) * 0.16;
          const sc = 0.00145 + (i % 3) * 0.00022;
          heroDummy.position.set(
            Math.cos(ang) * rad,
            BASE_GROUND_Y + 0.075,
            Math.sin(ang) * rad
          );
          heroDummy.rotation.set(0, ang + Math.PI * 0.5, 0);
          heroDummy.scale.set(sc, sc * (0.95 + (i % 2) * 0.18), sc);
          heroDummy.updateMatrix();
          instMassifs.setMatrixAt(i, heroDummy.matrix);
          if (instForest) instForest.setMatrixAt(i, heroDummy.matrix);
        }
        instMassifs.instanceMatrix.needsUpdate = true;
        instMassifs.computeBoundingSphere();
        photogrammetryGroup.add(instMassifs);

        if (instForest) {
          instForest.instanceMatrix.needsUpdate = true;
          instForest.computeBoundingSphere();
          photogrammetryGroup.add(instForest);
        }
      }
    });
  }

  // 5) Poly Haven 3D Photogrammetry Canyon Cliffs (`canyon_cliff_01.glb`) & Rock Faces (`rock_face_01.glb`)
  if (
    safeMapId === 'desert' ||
    safeMapId === 'coast' ||
    safeMapId === 'canyon' ||
    safeMapId === 'forest'
  ) {
    loadMultiPartPropTemplate('canyon_cliff_01').then((parts) => {
      if (isDisposed || !parts) return;
      const cliffPlacements = [];
      const stride = safeMapId === 'desert' ? 14 : 26;
      for (let i = 6; i < N; i += stride) {
        const s = samples[i];
        const hw = s.half_width_m || 0.022;
        for (const side of [-1, 1]) {
          if (safeMapId !== 'desert' && side < 0 && i % (stride * 2) !== 6) continue;
          const distOut = hw + (safeMapId === 'desert' ? 0.048 : 0.058) + ((i * 7) % 4) * 0.015;
          const cx = s.position[0] + s.right[0] * side * distOut;
          const cz = s.position[2] + s.right[2] * side * distOut;
          if (isClearOfTrack(cx, cz, 0.028)) {
            const cy = Math.max(BASE_GROUND_Y - 0.004, getTerrainHeightAt(cx, cz) - 0.003);
            const sc = (safeMapId === 'desert' ? 0.068 : 0.052) + (i % 4) * 0.016;
            const yaw =
              Math.atan2(s.tangent[0], s.tangent[2]) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
            cliffPlacements.push({
              x: cx,
              y: cy,
              z: cz,
              yaw,
              scaleXYZ: [sc * 1.25, sc * (0.95 + (i % 3) * 0.25), sc],
            });
          }
        }
      }
      spawnMultiPartInstancedProp(parts, cliffPlacements, { castShadow: true });
    });

    loadMultiPartPropTemplate('rock_face_01').then((parts) => {
      if (isDisposed || !parts) return;
      const rockPlacements = [];
      const stride = safeMapId === 'desert' ? 16 : 24;
      for (let i = 12; i < N; i += stride) {
        const s = samples[i];
        const hw = s.half_width_m || 0.022;
        const side = (i / stride) % 2 === 0 ? 1 : -1;
        const distOut = hw + 0.036 + ((i * 11) % 5) * 0.012;
        const rx = s.position[0] + s.right[0] * side * distOut;
        const rz = s.position[2] + s.right[2] * side * distOut;
        if (isClearOfTrack(rx, rz, 0.022)) {
          const ry = Math.max(BASE_GROUND_Y - 0.003, getTerrainHeightAt(rx, rz) - 0.002);
          const sc = 0.042 + (i % 3) * 0.014;
          const yaw = Math.atan2(s.tangent[0], s.tangent[2]) + i * 0.7;
          rockPlacements.push({ x: rx, y: ry, z: rz, yaw, scale: sc });
        }
      }
      spawnMultiPartInstancedProp(parts, rockPlacements, { castShadow: false });
    });
  }

  // 6) Poly Haven 3D Photogrammetry Desert Trees (`desert_tree_01.glb` — Quiver Trees) for Mojave Red Canyon
  if (safeMapId === 'desert') {
    loadMultiPartPropTemplate('desert_tree_01').then((parts) => {
      if (isDisposed || !parts) return;
      const desertTreePlacements = [];
      for (let i = 0; i < N; i += 8) {
        const s = samples[i];
        const hw = s.half_width_m || 0.022;
        for (const side of [-1, 1]) {
          const distOut = hw + 0.025 + ((i * 13 + (side > 0 ? 3 : 0)) % 6) * 0.009;
          const tx = s.position[0] + s.right[0] * side * distOut;
          const tz = s.position[2] + s.right[2] * side * distOut;
          if (isClearOfTrack(tx, tz, 0.015)) {
            const ty = Math.max(BASE_GROUND_Y - 0.0015, getTerrainHeightAt(tx, tz) - 0.001);
            const sc = 0.022 + ((i * 5) % 5) * 0.0045;
            desertTreePlacements.push({
              x: tx,
              y: ty,
              z: tz,
              yaw: i * 1.4 + side,
              scale: sc,
            });
          }
        }
      }
      spawnMultiPartInstancedProp(parts, desertTreePlacements, { castShadow: true });
    });
  }

  // 7) Poly Haven 3D Photogrammetry Street Lamps (`street_lamp_01.glb`) along trackside
  loadMultiPartPropTemplate('street_lamp_01').then((parts) => {
    if (isDisposed || !parts) return;
    const lampPlacements = [];
    const lampStride = safeMapId === 'city' ? 16 : 24;
    for (let i = 8; i < N; i += lampStride) {
      const s = samples[i];
      if (s.position[1] > BASE_GROUND_Y + 0.0045) continue;
      const hw = s.half_width_m || 0.0175;
      for (const side of [-1, 1]) {
        const outDist = hw + (safeMapId === 'drift' ? 0.014 : 0.0068);
        const lx = s.position[0] + s.right[0] * side * outDist;
        const lz = s.position[2] + s.right[2] * side * outDist;
        const ly = s.position[1] - 0.0005;
        const yaw =
          Math.atan2(s.tangent[0], s.tangent[2]) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
        lampPlacements.push({ x: lx, y: ly, z: lz, yaw, scale: 0.022 });
      }
    }
    spawnMultiPartInstancedProp(parts, lampPlacements, { castShadow: false });
  });

  // 8) Photogrammetry Coastal / Alpine / Desert Boulders flanking outer turns
  if (safeMapId !== 'city') {
    loadPhotogrammetryPropTemplate('boulder_01').then((tpl) => {
      if (isDisposed || !tpl) return;
      const boulderFractions = [0.11, 0.19, 0.34, 0.43, 0.62, 0.71, 0.85, 0.91];
      const inst = new THREE.InstancedMesh(tpl.geometry, tpl.material, boulderFractions.length);
      inst.castShadow = false;
      inst.receiveShadow = true;
      for (let i = 0; i < boulderFractions.length; i++) {
        const idx = Math.floor(boulderFractions[i] * N) % N;
        const s = samples[idx];
        const hw = s.half_width_m || 0.024;
        const side = i % 2 === 0 ? -1 : 1;
        const lat = side * (hw + 0.042 + (i % 3) * 0.016);
        const bx = s.position[0] + s.right[0] * lat;
        const bz = s.position[2] + s.right[2] * lat;
        const by = getTerrainHeightAt(bx, bz) - 0.004;
        const sc = 0.038 + (i % 3) * 0.014;
        heroDummy.position.set(bx, by, bz);
        heroDummy.rotation.set(0, i * 1.37, 0);
        heroDummy.scale.set(sc * 1.15, sc * 0.92, sc);
        heroDummy.updateMatrix();
        inst.setMatrixAt(i, heroDummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
      photogrammetryGroup.add(inst);
    });
  }

  function setDetailLevel(lowPowerMode = false) {
    photogrammetryGroup.visible = !lowPowerMode;
  }

  function update(elapsedTime) {
    if (skyMat && skyMat.uniforms && skyMat.uniforms.uTime) {
      skyMat.uniforms.uTime.value = elapsedTime;
    }
    if (oceanUniforms) {
      oceanUniforms.uTime.value = elapsedTime;
    }
    if (lighthouseBeamGroup) {
      lighthouseBeamGroup.rotation.y = elapsedTime * 0.85;
    }
    for (let i = 0; i < yachtGroupList.length; i++) {
      const yItem = yachtGroupList[i];
      yItem.group.rotation.z = Math.sin(elapsedTime * 1.6 + yItem.basePhase) * 0.06;
      yItem.group.position.y =
        BASE_GROUND_Y - 0.0025 + Math.cos(elapsedTime * 1.3 + yItem.basePhase) * 0.0004;
    }
    if (gondolaSpanStart && gondolaSpanEnd && gondolaCabins.length > 0) {
      for (let i = 0; i < gondolaCabins.length; i++) {
        const gItem = gondolaCabins[i];
        const rawT = (elapsedTime * 0.045 + gItem.offset) % 1.0;
        const pingPongT = rawT < 0.5 ? rawT * 2.0 : (1.0 - rawT) * 2.0;
        gItem.group.position.lerpVectors(gondolaSpanStart, gondolaSpanEnd, pingPongT);
        gItem.group.lookAt(gondolaSpanEnd);
      }
    }
    for (let i = 0; i < cyberSearchlights.length; i++) {
      const sItem = cyberSearchlights[i];
      sItem.mesh.rotation.x = Math.sin(elapsedTime * 0.75 + sItem.phase) * 0.38;
      sItem.mesh.rotation.z = Math.cos(elapsedTime * 0.62 + sItem.phase) * 0.38;
    }
    for (let i = 0; i < cyberBlimps.length; i++) {
      const bItem = cyberBlimps[i];
      const ang = elapsedTime * bItem.speed + bItem.phase;
      const bx = Math.cos(ang) * bItem.radius;
      const bz = Math.sin(ang) * bItem.radius;
      bItem.group.position.set(bx, bItem.height + Math.sin(elapsedTime * 1.2 + i) * 0.004, bz);
      bItem.group.rotation.y = -ang;
    }
    if (snowPoints) {
      snowPoints.rotation.y = elapsedTime * 0.025;
      snowPoints.position.y = -((elapsedTime * 0.015) % 0.04);
    }
  }

  const baseRoadRoughness = roadMat ? roadMat.roughness : 0.54;
  const baseRoadMetalness = roadMat ? roadMat.metalness : 0.12;
  const baseRoadEnvIntensity = roadMat ? (roadMat.envMapIntensity ?? 0.68) : 0.68;
  const dryRoadColor = new THREE.Color(0xadb8c6);
  const wetRoadColor = new THREE.Color(0x7c8ea4);
  const baseSkyTop = new THREE.Color(skyCfg.top);
  const baseSkyMid = new THREE.Color(skyCfg.mid);
  const baseSkyBottom = new THREE.Color(skyCfg.bottom);
  const baseCloudColor = new THREE.Color(skyCfg.cloudColor);
  const stormSkyTop = new THREE.Color(0x0b1222);
  const stormSkyMid = new THREE.Color(0x1b2940);
  const stormSkyBottom = new THREE.Color(0x2a3b55);
  const stormCloudColor = new THREE.Color(0x64748b);
  let lastAppliedWetness = -1;

  function setWetness(wet01 = 0) {
    const w = THREE.MathUtils.clamp(Number(wet01) || 0, 0, 1);
    if (Math.abs(w - lastAppliedWetness) < 0.004) return;
    lastAppliedWetness = w;

    roadWetnessUniform.value =
      safeMapId === 'city' ? Math.max(0.55, w) : safeMapId === 'forest' ? Math.max(0.25, w) : w;

    const activeRoadMats = [roadMat, glbRoadMat].filter(Boolean);
    for (let i = 0; i < activeRoadMats.length; i++) {
      const rm = activeRoadMats[i];
      const targetWetRough = safeMapId === 'city' ? 0.36 : 0.42;
      const targetWetMetal = safeMapId === 'city' ? 0.22 : 0.16;
      const targetWetEnv = safeMapId === 'city' ? 0.85 : 0.78;
      rm.roughness = THREE.MathUtils.lerp(baseRoadRoughness, targetWetRough, w);
      rm.metalness = THREE.MathUtils.lerp(baseRoadMetalness, targetWetMetal, w);
      rm.envMapIntensity = THREE.MathUtils.lerp(baseRoadEnvIntensity, targetWetEnv, w);
      rm.color.copy(dryRoadColor).lerp(wetRoadColor, w * 0.88);
    }

    if (skyMat && skyMat.uniforms) {
      if (skyMat.uniforms.uTopColor) {
        skyMat.uniforms.uTopColor.value.copy(baseSkyTop).lerp(stormSkyTop, w * 0.82);
      }
      if (skyMat.uniforms.uMidColor) {
        skyMat.uniforms.uMidColor.value.copy(baseSkyMid).lerp(stormSkyMid, w * 0.84);
      }
      if (skyMat.uniforms.uBottomColor) {
        skyMat.uniforms.uBottomColor.value.copy(baseSkyBottom).lerp(stormSkyBottom, w * 0.82);
      }
      if (skyMat.uniforms.uCloudColor) {
        skyMat.uniforms.uCloudColor.value.copy(baseCloudColor).lerp(stormCloudColor, w * 0.72);
      }
      if (skyMat.uniforms.uCloudDensity) {
        skyMat.uniforms.uCloudDensity.value = THREE.MathUtils.lerp(
          skyCfg.cloudDensity ?? 0.65,
          0.95,
          w
        );
      }
    }
  }

  function dispose() {
    isDisposed = true;

    for (const geo of disposableGeos) {
      if (geo && typeof geo.dispose === 'function') geo.dispose();
    }
    disposableGeos.clear();

    for (const mat of disposableMats) {
      if (mat && typeof mat.dispose === 'function') mat.dispose();
    }
    disposableMats.clear();

    for (const tex of disposableTexs) {
      if (tex && typeof tex.dispose === 'function') tex.dispose();
    }
    disposableTexs.clear();

    if (rootGroup.parent) {
      rootGroup.parent.remove(rootGroup);
    }
  }

  return {
    mapId: safeMapId,
    rootGroup,
    roadGeo,
    skyCfg,
    setF1StartLights,
    attachTrafficLightGlb,
    setWetness,
    setDetailLevel,
    update,
    dispose,
  };
}
