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
} from './PbrAssetManager.js';

/**
 * Custom 3D Track & AAA Multi-Layered 3D Environment Builder
 * - Uses shared Draco-enabled GLTFLoader for track GLBs and Poly Haven photogrammetry props.
 * - Upgrades road surfaces with Poly Haven 1K photoscanned PBR normal/roughness maps and a
 *   single-pass wet-puddle roughness sheen shader (zero double-render mirror cost -> 60 FPS!).
 * - Scatters real 3D-scanned photogrammetry boulders & concrete road barriers via InstancedMesh.
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
  // Ensure consistent attribute set (position + normal) for safe mergeGeometries
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

      // 2D Simplex Noise (Ashima / Gustavson) — zero square/diagonal bilinear grid artifacts
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

        // Smooth 3-stop atmospheric sky gradient
        vec3 skyCol = mix(uBottomColor, uMidColor, smoothstep(-0.04, 0.24, h));
        skyCol = mix(skyCol, uTopColor, smoothstep(0.24, 0.85, h));

        // Sun / Moon disc + atmospheric corona scattering
        float sunDot = max(0.0, dot(dir, normalize(uSunDir)));
        float sunGlow = pow(sunDot, 7.0) * 0.42 + pow(sunDot, 48.0) * 0.55;
        float sunDisc = smoothstep(0.9965, 0.9988, sunDot) * 1.45;
        skyCol += uSunColor * (sunGlow + sunDisc);

        // Optional night stars for Neon City
        if (uStarsIntensity > 0.01 && h > 0.08) {
          vec2 starUv = floor(dir.xz / max(0.15, dir.y + 0.35) * 180.0);
          float st = hash21(starUv);
          if (st > 0.994) {
            float twinkle = 0.65 + 0.35 * sin(uTime * 2.2 + st * 90.0);
            skyCol += vec3(0.75, 0.88, 1.0) * uStarsIntensity * twinkle * smoothstep(0.08, 0.45, h);
          }
        }

        // Silky, artifact-free wispy Simplex clouds above horizon
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

        // Subtle warm/cool horizon mist band so distant 3D mountains melt smoothly into the sky
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
 * High-resolution 1024x1024 PBR racing road texture with dark specular Asphalt 9 / NFS tarmac,
 * high-contrast dual rubberized racing grooves, metallic shoulder stripes, and crisp lane markers.
 */
function createHighResRoadTexture(safeMapId) {
  const size = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  if (safeMapId === 'city') {
    ctx.fillStyle = '#0b101d';
  } else if (safeMapId === 'canyon') {
    ctx.fillStyle = '#1e293b';
  } else {
    ctx.fillStyle = '#121620';
  }
  ctx.fillRect(0, 0, size, size);

  let seed = 4242;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  // Fine high-frequency mineral aggregate micro-grain
  for (let i = 0; i < 18000; i++) {
    const x = Math.floor(rand() * size);
    const y = Math.floor(rand() * size);
    const w = 1 + Math.floor(rand() * 2);
    const h = 2 + Math.floor(rand() * 5);
    if (safeMapId === 'city') {
      ctx.fillStyle = rand() > 0.55 ? 'rgba(148, 163, 184, 0.07)' : 'rgba(2, 6, 15, 0.42)';
    } else if (safeMapId === 'canyon') {
      ctx.fillStyle = rand() > 0.48 ? 'rgba(226, 232, 240, 0.14)' : 'rgba(9, 14, 24, 0.36)';
    } else {
      ctx.fillStyle = rand() > 0.52 ? 'rgba(203, 213, 225, 0.08)' : 'rgba(4, 7, 15, 0.38)';
    }
    ctx.fillRect(x, y, w, h);
  }

  // Subtle frost-dusted outer shoulders on Alpine Canyon track
  if (safeMapId === 'canyon') {
    const leftGrad = ctx.createLinearGradient(0, 0, 120, 0);
    leftGrad.addColorStop(0.0, 'rgba(226, 232, 240, 0.55)');
    leftGrad.addColorStop(0.55, 'rgba(203, 213, 225, 0.18)');
    leftGrad.addColorStop(1.0, 'rgba(203, 213, 225, 0.0)');
    ctx.fillStyle = leftGrad;
    ctx.fillRect(0, 0, 120, size);

    const rightGrad = ctx.createLinearGradient(size, 0, size - 120, 0);
    rightGrad.addColorStop(0.0, 'rgba(226, 232, 240, 0.55)');
    rightGrad.addColorStop(0.55, 'rgba(203, 213, 225, 0.18)');
    rightGrad.addColorStop(1.0, 'rgba(203, 213, 240, 0.0)');
    ctx.fillStyle = rightGrad;
    ctx.fillRect(size - 120, 0, 120, size);
  }

  // Deep polished rubberized racing wheel tracks (Left & Right lanes)
  const grooveGradL = ctx.createLinearGradient(180, 0, 410, 0);
  grooveGradL.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
  grooveGradL.addColorStop(0.35, 'rgba(2, 4, 10, 0.42)');
  grooveGradL.addColorStop(0.65, 'rgba(2, 4, 10, 0.42)');
  grooveGradL.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grooveGradL;
  ctx.fillRect(180, 0, 230, size);

  const grooveGradR = ctx.createLinearGradient(size - 410, 0, size - 180, 0);
  grooveGradR.addColorStop(0.0, 'rgba(0, 0, 0, 0.0)');
  grooveGradR.addColorStop(0.35, 'rgba(2, 4, 10, 0.42)');
  grooveGradR.addColorStop(0.65, 'rgba(2, 4, 10, 0.42)');
  grooveGradR.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grooveGradR;
  ctx.fillRect(size - 410, 0, 230, size);

  // Crisp continuous outer shoulder boundary stripes (Asphalt 9 dual-line signature)
  if (safeMapId === 'city') {
    ctx.fillStyle = '#00f0ff';
    ctx.fillRect(26, 0, 14, size);
    ctx.fillRect(size - 40, 0, 14, size);
    ctx.fillStyle = '#f43f5e';
    ctx.fillRect(46, 0, 6, size);
    ctx.fillRect(size - 52, 0, 6, size);
  } else if (safeMapId === 'canyon') {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(26, 0, 14, size);
    ctx.fillRect(size - 40, 0, 14, size);
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(46, 0, 6, size);
    ctx.fillRect(size - 52, 0, 6, size);
  } else {
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(26, 0, 14, size);
    ctx.fillRect(size - 40, 0, 14, size);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(46, 0, 7, size);
    ctx.fillRect(size - 53, 0, 7, size);
  }

  // Sleek dashed center & subtle lane lines
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
 * Metallic Armco Crash Barrier & Racing Chevron Texture for GLB `Walls` mesh.
 * Replaces the flat untextured gray ribbon with a realistic multi-rail steel barrier.
 */
function createRacingBarrierWallTexture(safeMapId) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Dark gunmetal steel base
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, 512, 128);

  // Corrugated horizontal W-beam steel rail shading
  const beamGrad = ctx.createLinearGradient(0, 0, 0, 128);
  beamGrad.addColorStop(0.0, '#334155');
  beamGrad.addColorStop(0.18, '#0f172a');
  beamGrad.addColorStop(0.45, '#475569');
  beamGrad.addColorStop(0.55, '#1e293b');
  beamGrad.addColorStop(0.82, '#334155');
  beamGrad.addColorStop(1.0, '#090d16');
  ctx.fillStyle = beamGrad;
  ctx.fillRect(0, 0, 512, 128);

  // Bold diagonal racing hazard chevrons along the central band
  const accentColor =
    safeMapId === 'city' ? '#00f0ff' : safeMapId === 'canyon' ? '#38bdf8' : '#f59e0b';
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

  // Top & bottom high-visibility reflective safety trim
  ctx.fillStyle = safeMapId === 'city' ? '#f43f5e' : '#ef4444';
  ctx.fillRect(0, 6, 512, 10);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 112, 512, 8);

  // Vertical steel stanchion seam lines
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

function createRoadMicroNormalTexture(repeatX = 4, repeatY = 120) {
  const size = 128;
  const data = new Uint8Array(size * size * 4);
  let seed = 90210;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < size * size; i++) {
    const nx = Math.floor(128 + (rand() - 0.5) * 26);
    const ny = Math.floor(128 + (rand() - 0.5) * 26);
    data[i * 4 + 0] = nx;
    data[i * 4 + 1] = ny;
    data[i * 4 + 2] = 255;
    data[i * 4 + 3] = 255;
  }

  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

function createCurbStripeTexture(safeMapId) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  const c1 = safeMapId === 'city' ? '#00f0ff' : safeMapId === 'canyon' ? '#0284c7' : '#dc2626';
  const c2 = safeMapId === 'city' ? '#0f172a' : '#f8fafc';

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

  // Horizontal floor bands
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

/**
 * Ensures any GLB mesh whose vertex normals point downward (`-Y`) has its
 * normals negated and triangle winding flipped so it faces upward (`+Y`).
 */
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
 * Builds a high-density 192x192 3D Heightmap Terrain around the entire track loop:
 * - Uses a 4-corner quad corridor safety clamp so ZERO terrain triangles can ever
 *   bridge across or poke through the road surface, curbs, or walls on any map.
 * - Dips cleanly underneath elevated bridges so concrete viaduct piers stand tall.
 * - Rises smoothly into multi-layered coastal headlands & cliffs (`coast`), jagged alpine
 *   ridges & snowy mountains (`canyon`), or terraced waterfront blocks (`city`).
 * - Returns `{ terrainMesh, getTerrainHeightAt }` so trees, villas, chalets, and towers
 *   sit organically on the 3D hills and slopes at multiple elevations.
 */
function buildSculpted3DTerrainMesh(samples, safeMapId, trackGeo, trackMat) {
  const N = samples.length;
  const gridSegs = 192;
  const size = 2.65;
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
    safeMapId === 'city' ? 0x060b18 : safeMapId === 'canyon' ? 0x94a3b8 : 0x161d2a
  );
  const colMid = new THREE.Color(
    safeMapId === 'city' ? 0x0f172a : safeMapId === 'canyon' ? 0x64748b : 0x162e22
  );
  const colPeak = new THREE.Color(
    safeMapId === 'city' ? 0x1e293b : safeMapId === 'canyon' ? 0xe2e8f0 : 0x3b302a
  );
  const colSnowCap = new THREE.Color(0xf8fafc);
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
    } else if (safeMapId === 'canyon') {
      const ridge = Math.abs(fbmHeight(vx * 1.15, vz * 1.15));
      const valleyFloor = safeFloor + Math.sin(vx * 7.0 + vz * 6.0) * 0.0022 * hillBlend;
      const mountainWall =
        Math.pow(THREE.MathUtils.clamp((margin - 0.008) / 0.16, 0.0, 1.35), 1.35) *
        (0.046 + ridge * 0.155);
      finalY = THREE.MathUtils.lerp(safeFloor, valleyFloor + mountainWall, hillBlend);
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
    if (safeMapId === 'coast') {
      const hNorm = THREE.MathUtils.clamp((finalY - BASE_GROUND_Y) / 0.068, 0, 1);
      if (hNorm < 0.25) {
        tmpCol.lerpColors(colLow, colMid, hNorm / 0.25);
      } else {
        tmpCol.lerpColors(colMid, colPeak, (hNorm - 0.25) / 0.75);
      }
    } else if (safeMapId === 'canyon') {
      const hNorm = THREE.MathUtils.clamp((finalY - BASE_GROUND_Y) / 0.115, 0, 1);
      if (hNorm < 0.28) {
        tmpCol.lerpColors(colLow, colMid, hNorm / 0.28);
      } else if (hNorm < 0.62) {
        tmpCol.lerpColors(colMid, colPeak, (hNorm - 0.28) / 0.34);
      } else {
        tmpCol.lerpColors(colPeak, colSnowCap, (hNorm - 0.62) / 0.38);
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
      roughness: safeMapId === 'city' ? 0.42 : safeMapId === 'canyon' ? 0.72 : 0.85,
      metalness: safeMapId === 'city' ? 0.32 : 0.06,
      flatShading: safeMapId === 'canyon',
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
  // 1. Curved segmented palm trunk (5 tapered tilted segments)
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

  // 2. Crown of 8 arched 3D palm frond blades fanning outward + drooping tips
  const frondParts = [];
  const frondCount = 8;
  for (let f = 0; f < frondCount; f++) {
    const yaw = (f / frondCount) * Math.PI * 2 + (f % 2) * 0.14;
    const pitchBase = f % 2 === 0 ? 0.32 : 0.08;
    // Inner leaf stem + outer drooping blade tip
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
 * Multi-part 3D Alpine Spruce/Pine Tree Geometry (4 staggered irregular bough tiers + snow caps)
 */
function build3DAlpinePineGeometries(trackGeo) {
  const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.0007, 0.0013, 0.011, 6));
  trunkGeo.translate(0, 0.0055, 0);

  const boughParts = [];
  const snowCapParts = [];
  const tiers = [
    { y: 0.010, r: 0.0068, h: 0.0095 },
    { y: 0.016, r: 0.0054, h: 0.0085 },
    { y: 0.021, r: 0.0040, h: 0.0075 },
    { y: 0.025, r: 0.0026, h: 0.0065 },
  ];

  tiers.forEach((t, idx) => {
    const bough = new THREE.ConeGeometry(t.r, t.h, 7);
    bough.rotateY(idx * 0.55);
    bough.translate(0, t.y, 0);
    boughParts.push(bough);

    const cap = new THREE.ConeGeometry(t.r * 0.74, t.h * 0.48, 7);
    cap.rotateY(idx * 0.55);
    cap.translate(0, t.y + t.h * 0.28, 0);
    snowCapParts.push(cap);
  });

  const boughsGeo = trackGeo(mergeNormalizedParts(boughParts));
  const snowCapsGeo = trackGeo(mergeNormalizedParts(snowCapParts));
  boughParts.forEach((p) => p.dispose());
  snowCapParts.forEach((p) => p.dispose());

  return { trunkGeo, boughsGeo, snowCapsGeo };
}

/**
 * Multi-part 3D Cyberpunk Stepped Skyscraper Geometry (Podium + Tower + Upper Spire + Neon Trim)
 */
function build3DCyberTowerGeometries(trackGeo) {
  const bodyParts = [];
  // Wide street-level podium
  const podium = new THREE.BoxGeometry(1.18, 0.22, 1.18);
  podium.translate(0, 0.11, 0);
  bodyParts.push(podium);
  // Main tower shaft
  const midShaft = new THREE.BoxGeometry(0.92, 0.56, 0.92);
  midShaft.translate(0, 0.50, 0);
  bodyParts.push(midShaft);
  // Setback upper spire
  const upperSpire = new THREE.BoxGeometry(0.64, 0.24, 0.64);
  upperSpire.translate(0, 0.90, 0);
  bodyParts.push(upperSpire);
  // Rooftop comms antenna mast
  const mast = new THREE.CylinderGeometry(0.02, 0.04, 0.18, 5);
  mast.translate(0, 1.11, 0);
  bodyParts.push(mast);

  const bodyGeo = trackGeo(mergeNormalizedParts(bodyParts));
  bodyParts.forEach((p) => p.dispose());

  // Glowing neon bands around podium top, mid-crown, and upper spire top
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
 * Synchronous 3D Roadbed + Curbs fallback until GLB finishes parsing
 */
function buildSynchronousFallbackTrack(splineData, safeMapId, roadSurfaceTex, curbTex, trackGeo, trackMat) {
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
    curbPos[(cBase + 0) * 3 + 0] = px - rx * hw + nx * ch;
    curbPos[(cBase + 0) * 3 + 1] = py - ry * hw + ny * ch;
    curbPos[(cBase + 0) * 3 + 2] = pz - rz * hw + nz * ch;

    curbPos[(cBase + 1) * 3 + 0] = px - rx * (hw + curbWidth) + nx * ch * 1.4;
    curbPos[(cBase + 1) * 3 + 1] = py - ry * (hw + curbWidth) + ny * ch * 1.4;
    curbPos[(cBase + 1) * 3 + 2] = pz - rz * (hw + curbWidth) + nz * ch * 1.4;

    curbPos[(cBase + 2) * 3 + 0] = px + rx * hw + nx * ch;
    curbPos[(cBase + 2) * 3 + 1] = py + ry * hw + ny * ch;
    curbPos[(cBase + 2) * 3 + 2] = pz + rz * hw + nz * ch;

    curbPos[(cBase + 3) * 3 + 0] = px + rx * (hw + curbWidth) + nx * ch * 1.4;
    curbPos[(cBase + 3) * 3 + 1] = py + ry * (hw + curbWidth) + ny * ch * 1.4;
    curbPos[(cBase + 3) * 3 + 2] = pz + rz * (hw + curbWidth) + nz * ch * 1.4;

    for (let k = 0; k < 4; k++) {
      curbNorm[(cBase + k) * 3 + 0] = nx;
      curbNorm[(cBase + k) * 3 + 1] = ny;
      curbNorm[(cBase + k) * 3 + 2] = nz;
      curbUv[(cBase + k) * 2 + 0] = k % 2;
      curbUv[(cBase + k) * 2 + 1] = (i / N) * 220.0;
    }

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
    }
  }

  const roadGeo = trackGeo(new THREE.BufferGeometry());
  roadGeo.setAttribute('position', new THREE.BufferAttribute(roadPos, 3));
  roadGeo.setAttribute('normal', new THREE.BufferAttribute(roadNorm, 3));
  roadGeo.setAttribute('uv', new THREE.BufferAttribute(roadUv, 2));
  roadGeo.setIndex(new THREE.BufferAttribute(roadIndices, 1));
  roadGeo.computeBoundingSphere();

  const roadMat = trackMat(
    safeMapId === 'city'
      ? new THREE.MeshPhysicalMaterial({
          color: 0xffffff,
          map: roadSurfaceTex,
          roughness: 0.34,
          metalness: 0.22,
          clearcoat: 0.32,
          clearcoatRoughness: 0.36,
          reflectivity: 0.55,
          envMapIntensity: 0.72,
          side: THREE.DoubleSide,
        })
      : new THREE.MeshStandardMaterial({
          color: 0xffffff,
          map: roadSurfaceTex,
          roughness: safeMapId === 'canyon' ? 0.42 : 0.48,
          metalness: 0.15,
          envMapIntensity: 0.68,
          side: THREE.DoubleSide,
        })
  );

  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
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
      roughness: 0.35,
      metalness: 0.2,
      side: THREE.DoubleSide,
    })
  );
  const curbMesh = new THREE.Mesh(curbGeo, curbMat);
  curbMesh.receiveShadow = true;
  group.add(curbMesh);

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
  // 1. VIBRANT 3D ATMOSPHERIC SKY DOME (SUN/MOON HALO + DRIFTING 3D CLOUDS)
  // -------------------------------------------------------------------------
  const skyConfigs = {
    coast: {
      top: 0x1d4ed8, // Rich cobalt zenith (no pitch-black roof!)
      mid: 0x9333ea, // Twilight violet-rose mid sky
      bottom: 0xfdba74, // Warm golden-apricot horizon
      sunDir: [-0.55, 0.28, 0.78],
      sunColor: 0xffd27d,
      cloudColor: 0xffedd5,
      cloudShadow: 0x7c3aed,
      cloudDensity: 0.78,
      starsIntensity: 0.0,
      accent: '#fb923c',
    },
    city: {
      top: 0x090f26, // Deep midnight metropolis blue
      mid: 0x1e1b4b, // Indigo neon glow
      bottom: 0x0f4c81, // Cyber cyan/magenta skyline haze
      sunDir: [0.45, 0.34, 0.82],
      sunColor: 0x7dd3fc,
      cloudColor: 0x38bdf8,
      cloudShadow: 0x1e1b4b,
      cloudDensity: 0.38,
      starsIntensity: 0.85,
      accent: '#00e5ff',
    },
    canyon: {
      top: 0x0284c7, // Crisp alpine mountain blue sky
      mid: 0x60a5fa, // Clear bright daylight blue
      bottom: 0xe0f2fe, // Crisp snowy mountain horizon mist
      sunDir: [-0.48, 0.42, 0.76],
      sunColor: 0xfff7ed,
      cloudColor: 0xffffff,
      cloudShadow: 0x94a3b8,
      cloudDensity: 0.65,
      starsIntensity: 0.0,
      accent: '#34d399',
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
  const roadWetnessUniform = { value: safeMapId === 'city' ? 0.55 : 0.0 };
  const procCurbTex = trackTex(createCurbStripeTexture(safeMapId));
  const procBarrierWallTex = trackTex(createRacingBarrierWallTexture(safeMapId));
  procBarrierWallTex.repeat.set(1, 1);

  const { group: fallbackTrackGroup, roadGeo, roadMat } = buildSynchronousFallbackTrack(
    splineData,
    safeMapId,
    procRoadTex,
    procCurbTex,
    trackGeo,
    trackMat
  );
  if (roadMat) {
    roadMat.normalMap = roadPbrPack.normalMap;
    roadMat.normalScale = new THREE.Vector2(0.45, 0.45);
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

  // Raised & sleek open-truss F1 arch so it frames the sky and track cleanly on mobile portrait screens
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

  // Compact 5 F1 Start Light Pods suspended cleanly under the beam
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
  // 4. DYNAMIC TRACK GLB ASSET LOADING (`track_asphalt.glb`, `track_neon.glb`, `track_snow.glb`)
  // -------------------------------------------------------------------------
  const glbMountGroup = new THREE.Group();
  glbMountGroup.name = `CustomTrackGLB_${descriptor.trackKey}`;
  glbMountGroup.scale.setScalar(WORLD_TRACK_SCALE);
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

      // Widen loaded GLB road, curbs, walls, and startline laterally by +40% along the nearest spline right vector
      // so the visual 3D track matches the +40% widened physics bounds seamlessly.
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

          // Coarse + fine search for closest spline sample
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
          const dy = (BASE_GROUND_Y + posAttr.getY(vi) * WORLD_TRACK_SCALE) - sp[1];
          const dz = wz - sp[2];
          const latDot = dx * sr[0] + dy * sr[1] + dz * sr[2];
          // Expand lateral distance from centerline by +40% (delta = +0.40 * latDot)
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
              color: 0xffffff,
              map: procRoadTex,
              normalMap: roadPbrPack.normalMap,
              normalScale: new THREE.Vector2(0.48, 0.48),
              roughnessMap: roadPbrPack.armMap,
              roughness: 0.42,
              metalness: 0.22,
              clearcoat: 0.36,
              clearcoatRoughness: 0.32,
              reflectivity: 0.62,
              envMapIntensity: 0.85,
              side: THREE.DoubleSide,
            })
          );
        } else if (safeMapId === 'canyon') {
          glbRoadMat = trackMat(
            new THREE.MeshPhysicalMaterial({
              color: 0xffffff,
              map: procRoadTex,
              normalMap: roadPbrPack.normalMap,
              normalScale: new THREE.Vector2(0.42, 0.42),
              roughnessMap: roadPbrPack.armMap,
              roughness: 0.52,
              metalness: 0.14,
              clearcoat: 0.24,
              clearcoatRoughness: 0.42,
              reflectivity: 0.52,
              envMapIntensity: 0.78,
              side: THREE.DoubleSide,
            })
          );
        } else {
          // Balanced racing asphalt with Poly Haven photoscanned normal/roughness & zero glare blobs
          glbRoadMat = trackMat(
            new THREE.MeshPhysicalMaterial({
              color: 0xffffff,
              map: procRoadTex,
              normalMap: roadPbrPack.normalMap,
              normalScale: new THREE.Vector2(0.50, 0.50),
              roughnessMap: roadPbrPack.armMap,
              roughness: 0.48,
              metalness: 0.16,
              clearcoat: 0.28,
              clearcoatRoughness: 0.38,
              reflectivity: 0.56,
              envMapIntensity: 0.80,
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
        // Generate clean strip UVs along the barrier wall so the Armco chevron texture maps crisply
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
        // Hide the flat 2D GLB ground plane so our sculpted 3D heightmap terrain shines cleanly!
        child.visible = false;
      }
    });

    glbMountGroup.add(gltfScene);
    fallbackTrackGroup.visible = false;
  }

  const candidateUrls = descriptor.glbCandidateUrls || [`/${descriptor.trackKey}.glb`];
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
  tryLoadCandidateGlb(0);

  // -------------------------------------------------------------------------
  // 5. DUAL-SIDED 3D TRACKSIDE ARCHITECTURE, PARALLAX POSTS & OPEN VISTAS
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

  // A. Corner Chevron Turn Boards + 3D Bridge Viaduct Piers (No curb-crowding stanchion boxes)
  const chevronPlacements = [];
  const viaductPlacements = [];
  for (let i = 0; i < N; i += 3) {
    const s = samples[i];
    const hw = s.half_width_m || 0.0175;
    const isElevated = s.position[1] > BASE_GROUND_Y + 0.0045;
    if (isElevated && i % 9 === 0 && s.position[1] > BASE_GROUND_Y + 0.0065) {
      viaductPlacements.push(s);
    }
    // Place angled corner chevron warning signs on outer bend of sharp turns, safely outside the barrier wall
    const iPrev = (i - 4 + N) % N;
    const iNext = (i + 4) % N;
    const dotTang =
      samples[iPrev].tangent[0] * samples[iNext].tangent[0] +
      samples[iPrev].tangent[2] * samples[iNext].tangent[2];
    if (dotTang < 0.955 && i % 9 === 0 && !isElevated) {
      const crossY =
        samples[iPrev].tangent[0] * samples[iNext].tangent[2] -
        samples[iPrev].tangent[2] * samples[iNext].tangent[0];
      const outerSide = crossY > 0 ? 1 : -1;
      chevronPlacements.push({ sample: s, side: outerSide, outDist: hw + 0.0056 });
    }
  }

  // 3D Concrete Highway Overpass Viaduct Support Piers under Elevated Track Spans
  if (viaductPlacements.length > 0) {
    const pierColGeo = trackGeo(new THREE.CylinderGeometry(0.0018, 0.0024, 1.0, 8));
    pierColGeo.translate(0, -0.5, 0);
    const pierCapGeo = trackGeo(new THREE.BoxGeometry(0.032, 0.0024, 0.0048));
    pierCapGeo.translate(0, -0.0014, 0);
    const pierMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: safeMapId === 'city' ? 0x0f172a : 0x334155,
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
        color: safeMapId === 'city' ? 0x00f0ff : 0xf59e0b,
        emissive: new THREE.Color(safeMapId === 'city' ? 0x00b4d8 : 0xd97706),
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

  // B. Tiered Spectator Grandstands (Merged 3-Step Bleachers + Canopy Roof) on Start Straight
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

  // C. Sleek Dual-Sided Highway Luminaire Streetlamps (set well outside guardrails)
  const dualLampPlacements = [];
  for (let i = 8; i < N; i += 20) {
    const s = samples[i];
    if (s.position[1] > BASE_GROUND_Y + 0.0045) continue;
    const hw = s.half_width_m || 0.0175;
    for (const side of [-1, 1]) {
      dualLampPlacements.push({ sample: s, side, outDist: hw + 0.0064 });
    }
  }
  if (dualLampPlacements.length > 0) {
    const poleGeo = trackGeo(new THREE.CylinderGeometry(0.00035, 0.0005, 0.021, 6));
    poleGeo.translate(0, 0.0105, 0);
    const poleMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.25, metalness: 0.88 })
    );
    const bulbGeo = trackGeo(new THREE.BoxGeometry(0.0042, 0.0006, 0.0011));
    bulbGeo.translate(-0.0018, 0.021, 0);
    const bulbColor =
      safeMapId === 'city' ? 0x00f0ff : safeMapId === 'canyon' ? 0xe0f2fe : 0xffb347;
    const bulbMat = trackMat(new THREE.MeshBasicMaterial({ color: bulbColor, toneMapped: false }));

    const instPoles = new THREE.InstancedMesh(poleGeo, poleMat, dualLampPlacements.length);
    const instBulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, dualLampPlacements.length);

    for (let idx = 0; idx < dualLampPlacements.length; idx++) {
      const { sample: s, side, outDist } = dualLampPlacements[idx];
      _pos.fromArray(s.position);
      _right.fromArray(s.right);
      _norm.fromArray(s.normal);
      _tang.fromArray(s.tangent);
      _left.crossVectors(_norm, _tang).normalize();
      _rotMat.makeBasis(_left, _norm, _tang);

      dummy.position.copy(_pos).addScaledVector(_right, side * outDist);
      dummy.quaternion.setFromRotationMatrix(_rotMat);
      if (side < 0) dummy.rotateY(Math.PI);
      dummy.scale.setScalar(1.0);
      dummy.updateMatrix();
      instPoles.setMatrixAt(idx, dummy.matrix);
      instBulbs.setMatrixAt(idx, dummy.matrix);
    }
    instPoles.instanceMatrix.needsUpdate = true;
    instBulbs.instanceMatrix.needsUpdate = true;
    instPoles.computeBoundingSphere();
    instBulbs.computeBoundingSphere();
    rootGroup.add(instPoles, instBulbs);
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
    // 1. Deep Golden-Hour Specular Ocean Horizon Plane (Asphalt 9 / Horizon twilight water)
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

    // 2. Natural Deep-Olive Tropical Palm Trees (set back from the road so the track feels wide and fast)
    const palmPlacements = [];
    for (let i = 0; i < N; i += 8) {
      const s = samples[i];
      const hw = s.half_width_m || 0.0175;
      for (const side of [-1, 1]) {
        for (let tier = 0; tier < 2; tier++) {
          if (tier === 1 && i % 16 !== 0) continue;
          const distOut =
            hw +
            (tier === 0 ? 0.032 : 0.076) +
            ((i * 17 + (side > 0 ? 3 : 0) + tier * 5) % 6) * (tier === 0 ? 0.0075 : 0.015);
          const px = s.position[0] + s.right[0] * side * distOut;
          const pz = s.position[2] + s.right[2] * side * distOut;
          if (isClearOfTrack(px, pz, 0.018)) {
            const py = Math.max(BASE_GROUND_Y - 0.0015, getTerrainHeightAt(px, pz) - 0.0006);
            const sc = (tier === 0 ? 0.92 : 1.25) + ((i * 3 + tier) % 5) * 0.16;
            palmPlacements.push([px, py, pz, sc, i * 1.15 + side + tier]);
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

    // 3. Rugged 3D Coastal Basalt Cliff Outcrops & Modern Dark-Glass Resort Towers (Replaces toy huts)
    const cliffRockPlacements = [];
    const resortPlacements = [];
    for (let i = 6; i < N; i += 10) {
      const s = samples[i];
      const hw = s.half_width_m || 0.0175;
      for (const side of [-1, 1]) {
        const rockDist = hw + 0.022 + ((i * 7 + (side > 0 ? 2 : 0)) % 5) * 0.008;
        const rx = s.position[0] + s.right[0] * side * rockDist;
        const rz = s.position[2] + s.right[2] * side * rockDist;
        if (isClearOfTrack(rx, rz, 0.014)) {
          const ry = Math.max(BASE_GROUND_Y - 0.002, getTerrainHeightAt(rx, rz) - 0.001);
          const rScale = 0.85 + ((i * 5) % 6) * 0.24;
          cliffRockPlacements.push([rx, ry, rz, rScale, i * 0.9 + side]);
        }

        if (i % 20 === 6) {
          const towerDist = hw + 0.056 + ((i * 11) % 4) * 0.018;
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

    if (cliffRockPlacements.length > 0) {
      const rockGeo = trackGeo(new THREE.DodecahedronGeometry(0.011, 1));
      rockGeo.scale(1.35, 0.95, 1.15);
      rockGeo.translate(0, 0.006, 0);
      const rockMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x263142,
          roughness: 0.76,
          metalness: 0.18,
          flatShading: true,
        })
      );
      const instRocks = new THREE.InstancedMesh(rockGeo, rockMat, cliffRockPlacements.length);
      for (let i = 0; i < cliffRockPlacements.length; i++) {
        const [rx, ry, rz, rScale, rotY] = cliffRockPlacements[i];
        dummy.position.set(rx, ry, rz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(rScale, rScale * (0.8 + (i % 3) * 0.35), rScale);
        dummy.updateMatrix();
        instRocks.setMatrixAt(i, dummy.matrix);
      }
      instRocks.instanceMatrix.needsUpdate = true;
      instRocks.computeBoundingSphere();
      rootGroup.add(instRocks);
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

    // 4. Far-Horizon 3D Volcanic/Coastal Mountain Massifs Ring (Deep Parallax Silhouette Backdrop)
    const islandPeakCount = 14;
    const islandGeo = trackGeo(new THREE.ConeGeometry(0.16, 0.24, 7));
    islandGeo.translate(0, 0.11, 0);
    const islandMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x172030,
        roughness: 0.84,
        metalness: 0.12,
        flatShading: true,
      })
    );
    const instIslands = new THREE.InstancedMesh(islandGeo, islandMat, islandPeakCount);
    for (let i = 0; i < islandPeakCount; i++) {
      const ang = (i / islandPeakCount) * Math.PI * 2.0 + 0.18;
      const rad = 0.96 + (i % 3) * 0.22;
      const sx = 0.85 + (i % 4) * 0.32;
      const sy = 0.65 + ((i * 3) % 5) * 0.28;
      dummy.position.set(Math.cos(ang) * rad, BASE_GROUND_Y - 0.006, Math.sin(ang) * rad);
      dummy.rotation.set(0, i * 1.1, 0);
      dummy.scale.set(sx, sy, sx * 0.9);
      dummy.updateMatrix();
      instIslands.setMatrixAt(i, dummy.matrix);
    }
    instIslands.instanceMatrix.needsUpdate = true;
    instIslands.computeBoundingSphere();
    rootGroup.add(instIslands);

    // 5. Iconic 3D Coastal Headland Lighthouse with Rotating Volumetric Beacon Beam
    const lhGroup = new THREE.Group();
    const lhX = 0.34;
    const lhZ = -0.38;
    const lhBaseY = Math.max(BASE_GROUND_Y + 0.012, getTerrainHeightAt(lhX, lhZ));
    lhGroup.position.set(lhX, lhBaseY, lhZ);

    const lhRockGeo = trackGeo(new THREE.DodecahedronGeometry(0.028, 1));
    const lhRockMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.88, flatShading: true })
    );
    const lhRock = new THREE.Mesh(lhRockGeo, lhRockMat);
    lhRock.scale.set(1.4, 0.65, 1.3);
    lhGroup.add(lhRock);

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

    // 6. 10 3D Sunset Racing Yachts / Sailboats Floating on the Outer Bay
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
    // 1. Multi-Tiered 3D Cyberpunk Stepped Skyscrapers (Near Street + Mid District + Mega Skyline Ring)
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

    // Outer 3D Mega-Metropolis Skyline Ring (24 monumental futuristic horizon towers)
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

    // 2. Overhead Neon Expressway Portal Arches framing the street canyon
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

    // 3. 6 Animated Sky-Slicing Neon Searchlight Beams + 2 Orbiting Cyber Blimps
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
  } else {
    // 'canyon' / 'track_snow': Sunlit Alpine Snow Pass
    // 1. Multi-Tier Snow-Dusted 3D Alpine Spruce Forest climbing up the 3D Valley Slopes
    const pinePlacements = [];
    for (let i = 0; i < N; i += 5) {
      const s = samples[i];
      const hw = s.half_width_m || 0.0175;
      for (const side of [-1, 1]) {
        for (let row = 0; row < 3; row++) {
          if (row === 1 && i % 10 !== 0) continue;
          if (row === 2 && i % 15 !== 0) continue;
          const distOut =
            hw +
            (row === 0 ? 0.022 : row === 1 ? 0.048 : 0.088) +
            ((i * 19 + (side > 0 ? 4 : 0) + row * 3) % 6) * 0.0065;
          const px = s.position[0] + s.right[0] * side * distOut;
          const pz = s.position[2] + s.right[2] * side * distOut;
          if (isClearOfTrack(px, pz, 0.013)) {
            const py = Math.max(BASE_GROUND_Y - 0.0015, getTerrainHeightAt(px, pz) - 0.0008);
            const sc = (0.76 + row * 0.18) + ((i + row * 2) % 5) * 0.14;
            pinePlacements.push([px, py, pz, sc, i * 1.1 + side + row]);
          }
        }
      }
    }

    if (pinePlacements.length > 0) {
      const { trunkGeo, boughsGeo, snowCapsGeo } = build3DAlpinePineGeometries(trackGeo);
      const pTrunkMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x4a3525, roughness: 0.9 })
      );
      const pBoughMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0x166534,
          roughness: 0.72,
          flatShading: true,
        })
      );
      const pSnowMat = trackMat(
        new THREE.MeshStandardMaterial({
          color: 0xf8fafc,
          roughness: 0.45,
          metalness: 0.08,
          flatShading: true,
        })
      );

      const instTrunks = new THREE.InstancedMesh(trunkGeo, pTrunkMat, pinePlacements.length);
      const instBoughs = new THREE.InstancedMesh(boughsGeo, pBoughMat, pinePlacements.length);
      const instCaps = new THREE.InstancedMesh(snowCapsGeo, pSnowMat, pinePlacements.length);

      for (let i = 0; i < pinePlacements.length; i++) {
        const [px, py, pz, sc, rotY] = pinePlacements[i];
        dummy.position.set(px, py, pz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        instTrunks.setMatrixAt(i, dummy.matrix);
        instBoughs.setMatrixAt(i, dummy.matrix);
        instCaps.setMatrixAt(i, dummy.matrix);
      }
      instTrunks.instanceMatrix.needsUpdate = true;
      instBoughs.instanceMatrix.needsUpdate = true;
      instCaps.instanceMatrix.needsUpdate = true;
      instTrunks.computeBoundingSphere();
      instBoughs.computeBoundingSphere();
      instCaps.computeBoundingSphere();
      rootGroup.add(instTrunks, instBoughs, instCaps);
    }

    // 2. 3D Wooden Alpine Ski Chalets perched on the 3D Snow Slopes
    const chaletPlacements = [];
    for (let i = 10; i < N; i += 20) {
      const s = samples[i];
      const hw = s.half_width_m || 0.0175;
      for (const side of [-1, 1]) {
        const distOut = hw + 0.036 + ((i * 7) % 4) * 0.012;
        const cx = s.position[0] + s.right[0] * side * distOut;
        const cz = s.position[2] + s.right[2] * side * distOut;
        if (isClearOfTrack(cx, cz, 0.018)) {
          const cy = Math.max(BASE_GROUND_Y - 0.001, getTerrainHeightAt(cx, cz) - 0.0008);
          const yaw =
            Math.atan2(s.tangent[0], s.tangent[2]) + (side > 0 ? -Math.PI / 2 : Math.PI / 2);
          chaletPlacements.push([cx, cy, cz, 0.92 + (i % 3) * 0.18, yaw]);
        }
      }
    }
    if (chaletPlacements.length > 0) {
      const cabinBodyGeo = trackGeo(new THREE.BoxGeometry(0.016, 0.009, 0.013));
      cabinBodyGeo.translate(0, 0.0045, 0);
      const cabinMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 })
      );

      const roofGeo = trackGeo(new THREE.ConeGeometry(0.014, 0.009, 4));
      roofGeo.rotateY(Math.PI / 4);
      roofGeo.translate(0, 0.013, 0);
      const roofMat = trackMat(
        new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 })
      );

      const glowWinGeo = trackGeo(new THREE.BoxGeometry(0.004, 0.003, 0.0134));
      glowWinGeo.translate(0, 0.0048, 0);
      const glowWinMat = trackMat(
        new THREE.MeshBasicMaterial({ color: 0xfbbf24, toneMapped: false })
      );

      const instCabins = new THREE.InstancedMesh(cabinBodyGeo, cabinMat, chaletPlacements.length);
      const instRoofs = new THREE.InstancedMesh(roofGeo, roofMat, chaletPlacements.length);
      const instWins = new THREE.InstancedMesh(glowWinGeo, glowWinMat, chaletPlacements.length);
      for (let i = 0; i < chaletPlacements.length; i++) {
        const [cx, cy, cz, sc, yaw] = chaletPlacements[i];
        dummy.position.set(cx, cy, cz);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.setScalar(sc);
        dummy.updateMatrix();
        instCabins.setMatrixAt(i, dummy.matrix);
        instRoofs.setMatrixAt(i, dummy.matrix);
        instWins.setMatrixAt(i, dummy.matrix);
      }
      instCabins.instanceMatrix.needsUpdate = true;
      instRoofs.instanceMatrix.needsUpdate = true;
      instWins.instanceMatrix.needsUpdate = true;
      instCabins.computeBoundingSphere();
      instRoofs.computeBoundingSphere();
      instWins.computeBoundingSphere();
      rootGroup.add(instCabins, instRoofs, instWins);
    }

    // 3. Outer Ring of 18 Monumental 3D Jagged Alpine Matterhorn Snow Peaks
    const peakCount = 18;
    const peakBaseGeo = trackGeo(new THREE.ConeGeometry(0.16, 0.28, 6));
    peakBaseGeo.translate(0, 0.13, 0);
    const peakCapGeo = trackGeo(new THREE.ConeGeometry(0.095, 0.165, 6));
    peakCapGeo.translate(0, 0.215, 0);
    const peakBaseMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x475569,
        roughness: 0.78,
        flatShading: true,
      })
    );
    const peakCapMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.42,
        flatShading: true,
      })
    );
    const instPeakBases = new THREE.InstancedMesh(peakBaseGeo, peakBaseMat, peakCount);
    const instPeakCaps = new THREE.InstancedMesh(peakCapGeo, peakCapMat, peakCount);
    for (let i = 0; i < peakCount; i++) {
      const ang = (i / peakCount) * Math.PI * 2.0 + 0.08;
      const rad = 0.88 + (i % 3) * 0.22;
      const sx = 0.85 + (i % 4) * 0.26;
      const sy = 0.78 + ((i * 5) % 5) * 0.26;
      dummy.position.set(Math.cos(ang) * rad, BASE_GROUND_Y - 0.008, Math.sin(ang) * rad);
      dummy.rotation.set(0, i * 0.9, 0);
      dummy.scale.set(sx, sy, sx * 0.92);
      dummy.updateMatrix();
      instPeakBases.setMatrixAt(i, dummy.matrix);
      instPeakCaps.setMatrixAt(i, dummy.matrix);
    }
    instPeakBases.instanceMatrix.needsUpdate = true;
    instPeakCaps.instanceMatrix.needsUpdate = true;
    instPeakBases.computeBoundingSphere();
    instPeakCaps.computeBoundingSphere();
    rootGroup.add(instPeakBases, instPeakCaps);

    // 4. 3D Moving Alpine Gondola / Cable-Car Lift Spanning High Across the Valley
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

    // 5. Gentle Drifting 3D Alpine Snowflakes
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
  // 8. POLY HAVEN PHOTOGRAMMETRY 3D HERO PROPS (SINGLE-DRAW-CALL INSTANCEDMESH)
  // -------------------------------------------------------------------------
  const photogrammetryGroup = new THREE.Group();
  photogrammetryGroup.name = 'PhotogrammetryHeroProps';
  rootGroup.add(photogrammetryGroup);

  const heroDummy = new THREE.Object3D();
  // 1) Photogrammetry weathered Concrete Road Barriers lining start/finish pit & apexes (1 draw call)
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

  // 2) Photogrammetry Coastal / Alpine Boulders flanking outer turns (1 draw call, coast & canyon)
  if (safeMapId === 'coast' || safeMapId === 'canyon') {
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

  // Base dry road & sky color snapshots for smooth rain/wetness modulation
  const baseRoadRoughness = roadMat ? roadMat.roughness : 0.45;
  const baseRoadMetalness = roadMat ? roadMat.metalness : 0.15;
  const baseRoadEnvIntensity = roadMat ? (roadMat.envMapIntensity ?? 1.2) : 1.2;
  const dryRoadColor = new THREE.Color(0xffffff);
  const wetRoadColor = new THREE.Color(0xb8c7d9);
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

    // Drive single-pass wet-puddle roughness modulation on BOTH fallback & GLB road shaders
    roadWetnessUniform.value = safeMapId === 'city' ? Math.max(0.55, w) : w;

    // Subtle wet-road sheen: darker damp tarmac with controlled low roughness & zero blinding glare hotspots
    const activeRoadMats = [roadMat, glbRoadMat].filter(Boolean);
    for (let i = 0; i < activeRoadMats.length; i++) {
      const rm = activeRoadMats[i];
      const targetWetRough = safeMapId === 'city' ? 0.34 : 0.38;
      const targetWetMetal = safeMapId === 'city' ? 0.24 : 0.18;
      const targetWetEnv = safeMapId === 'city' ? 0.95 : 0.86;
      rm.roughness = THREE.MathUtils.lerp(baseRoadRoughness, targetWetRough, w);
      rm.metalness = THREE.MathUtils.lerp(baseRoadMetalness, targetWetMetal, w);
      rm.envMapIntensity = THREE.MathUtils.lerp(baseRoadEnvIntensity, targetWetEnv, w);
      rm.color.copy(dryRoadColor).lerp(wetRoadColor, w * 0.85);
    }

    // Moody darkened storm sky dome with denser overcast cloud deck
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
