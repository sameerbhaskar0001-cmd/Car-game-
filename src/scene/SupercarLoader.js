import * as THREE from 'three';
import { getSharedGltfLoader } from './PbrAssetManager.js';

/**
 * Universal AAA High-Poly Supercar Loader (Draco GLB + Royal Asphalt Material Pipeline).
 *
 * Supports any Draco-compressed .glb supercar in /public/models/supercars/:
 *  - Decodes Draco geometry on a single shared WASM decoder
 *  - Applies yawPivot rotation BEFORE grounding & stance scaling (supports +Z, -Z, +X, -X source axes!)
 *  - Upgrades paint to high-contrast Dual-Clearcoat Metallic Physical PBR (preserving stock liveries when configured!)
 *  - Upgrades carbon fiber weave to glossy clearcoat carbon & glass to reflective tinted clearcoat
 *  - Neutralizes real-world brand badges & darkens chassis underbodies for authentic barrel-roll undersides
 *  - Sets white/ice-blue LED front headlights & dynamic brake-reactive crimson taillights (plus custom flush LED blades where source GLB lacks separate taillight mats)
 *  - Attaches rich procedural NormalBlending Contact Shadow flush beneath tires so cars sit heavy on asphalt
 *  - Auto-centers wheel axle pivots from geometry bounds for zero-wobble spin & front steering
 */
export const SUPERCAR_CATALOG = {
  v12_goblin: {
    id: 'v12_goblin',
    modelFile: '/models/supercars/v12_goblin.glb',
    defaultPaintHex: '#02593e', // Deep Venom Emerald metallic (rich deep tone with razor-sharp specular gleam!)
    paintMetalness: 0.86,
    paintRoughness: 0.14,
    targetLength: 0.0212,
    stanceWidthScale: 1.03,
    stanceHeightScale: 1.0,
    yawOffsetRad: Math.PI, // nose faces -Z in source GLB -> rotate PI to +Z forward
    wheelNodeNames: {
      fl: 'car_wheel_FL',
      fr: 'car_wheel_FR',
      rl: 'car_wheel_BL',
      rr: 'car_wheel_BR',
    },
    bodyMaterialMatchers: ['clearcoat'],
    texturedBodyMatchers: ['car_body'],
    glassMaterialMatchers: ['car_glass'],
    headlightMaterialMatchers: [],
    taillightMaterialMatchers: [],
    brakeRotorMatchers: [],
    darkUnderbodyMatchers: [],
    debadgeMaterialMatchers: [],
  },
  apex_g82: {
    id: 'apex_g82',
    modelFile: '/models/supercars/apex_g82.glb',
    defaultPaintHex: '#0284c7',
    paintMetalness: 0.82,
    paintRoughness: 0.17,
    targetLength: 0.0214,
    stanceWidthScale: 1.04,
    stanceHeightScale: 0.96,
    yawOffsetRad: 0, // nose already faces +Z
    wheelNodeNames: {},
    bodyMaterialMatchers: ['painttnr_material'],
    texturedBodyMatchers: ['coloured_material'],
    glassMaterialMatchers: ['window_material'],
    headlightMaterialMatchers: [],
    taillightMaterialMatchers: ['phong1'],
    brakeRotorMatchers: ['brakedisc', 'calliper'],
    darkUnderbodyMatchers: ['base_material'],
    debadgeMaterialMatchers: [],
  },
  solstice_ie: {
    id: 'solstice_ie',
    modelFile: '/models/supercars/solstice_ie.glb',
    defaultPaintHex: null, // preserves Sketchfab Blue-to-Gold Iridescent Carbon design by default; custom Garage paint recolors cleanly
    preserveTextureWhenDefaultPaint: true,
    sketchfabIridescentPreset: 'apollo_ie',
    chameleonGlassColorHex: 0xff1e78,
    paintMetalness: 0.78,
    paintRoughness: 0.17,
    targetLength: 0.0218,
    stanceWidthScale: 1.03,
    stanceHeightScale: 1.0,
    yawOffsetRad: 0, // nose already faces +Z
    wheelNodeNames: {},
    bodyMaterialMatchers: ['apollo_body', 'carbon1_material', 'carbon1m_material'],
    texturedBodyMatchers: ['coloured_material', 'lighta_material', 'interiora_material'],
    matteTrimMatchers: ['grille1a_material', 'grille2a_material', 'black1'],
    glassMaterialMatchers: ['glass', 'windowinside'],
    headlightMaterialMatchers: ['hud_leds'],
    taillightMaterialMatchers: ['glass_red'],
    brakeRotorMatchers: ['ext_disc', 'brake_caliper', 'ext_caliper'],
    darkUnderbodyMatchers: ['base_material', 'logo_belt', 'logo_seats'],
    debadgeMaterialMatchers: [],
  },
  valkyr_aero: {
    id: 'valkyr_aero',
    modelFile: '/models/supercars/valkyr_aero.glb',
    defaultPaintHex: '#046342', // Deep British Racing Emerald metallic across both upper fenders AND side doors!
    paintMetalness: 0.85,
    paintRoughness: 0.15,
    targetLength: 0.0218,
    stanceWidthScale: 1.04,
    stanceHeightScale: 1.0,
    yawOffsetRad: -Math.PI / 2, // nose faces +X in source GLB -> rotate -PI/2 to +Z forward
    wheelNodeNames: {},
    bodyMaterialMatchers: ['ethanol_silver', 'textured2a_material'],
    texturedBodyMatchers: ['textureda_material', 'lighta_material'],
    matteTrimMatchers: ['grille1a_material', 'grille2a_material', 'grille3a_material', 'grille4a_material'],
    glassMaterialMatchers: ['window_material', 'windowinside_material'],
    headlightMaterialMatchers: [],
    taillightMaterialMatchers: [],
    brakeRotorMatchers: ['calliper'],
    darkUnderbodyMatchers: ['base_material'],
    debadgeMaterialMatchers: [],
  },
  razor_f82: {
    id: 'razor_f82',
    modelFile: '/models/supercars/razor_f82.glb',
    defaultPaintHex: null, // preserves custom Razor widebody livery by default; custom Garage paint recolors cleanly
    preserveTextureWhenDefaultPaint: true,
    paintMetalness: 0.80,
    paintRoughness: 0.18,
    targetLength: 0.0214,
    stanceWidthScale: 1.03,
    stanceHeightScale: 0.96,
    yawOffsetRad: Math.PI, // front lights at -Z, rear at +Z -> rotate PI to +Z forward
    wheelNodeNames: {},
    bodyMaterialMatchers: ['chassis.009'],
    texturedBodyMatchers: [],
    glassMaterialMatchers: ['glass.002', 'glass.003'],
    headlightMaterialMatchers: ['left_front_light', 'right_front_light'],
    taillightMaterialMatchers: ['left_rear_light', 'right_rear_light'],
    brakeRotorMatchers: ['bluepad'],
    darkUnderbodyMatchers: [],
    debadgeMaterialMatchers: ['spoon'], // Strips trunk, hood, and wheel-hub OEM roundel texture cleanly
  },
  ferrari: {
    id: 'ferrari',
    modelFile: '/models/supercars/ferrari.glb',
    defaultPaintHex: '#c80828',
    paintMetalness: 0.82,
    paintRoughness: 0.16,
    targetLength: 0.0206,
    stanceWidthScale: 1.04,
    stanceHeightScale: 0.98,
    // ferrari.glb nose points toward -Z; rotate PI to face +Z track forward
    yawOffsetRad: Math.PI,
    wheelNodeNames: {
      fl: 'wheel_fl',
      fr: 'wheel_fr',
      rl: 'wheel_rl',
      rr: 'wheel_rr',
    },
    steeringWheelNodeName: 'steering_wheel',
    bodyMaterialMatchers: ['body_color', 'body', 'paint', 'carpaint', 'metallic'],
    texturedBodyMatchers: [],
    glassMaterialMatchers: ['glass', 'windshield', 'window'],
    headlightMaterialMatchers: ['projector', 'headlight', 'turn_signal', 'drl'],
    taillightMaterialMatchers: ['taillight', 'rear_light', 'brake_light'],
    brakeRotorMatchers: ['brake', 'disc', 'rotor', 'caliper'],
    darkUnderbodyMatchers: [],
    debadgeMaterialMatchers: [],
  },
  silver_arrow: {
    id: 'silver_arrow',
    modelFile: '/models/supercars/silver_arrow.glb',
    defaultPaintHex: null, // preserves Sketchfab Crimson/Silver-Azure/Gold-Cyan F1 design livery by default
    preserveTextureWhenDefaultPaint: true,
    sketchfabIridescentPreset: 'amg_one',
    paintMetalness: 0.82,
    paintRoughness: 0.15,
    targetLength: 0.0218,
    stanceWidthScale: 1.04,
    stanceHeightScale: 1.0,
    yawOffsetRad: 0, // runninglight at +Z, taillight at -Z -> nose already faces +Z
    wheelNodeNames: {},
    bodyMaterialMatchers: ['amgprojone_paint'],
    texturedBodyMatchers: ['amgprojone_headlight', 'amgprojone_lightsnormal'],
    matteTrimMatchers: ['amgprojone_coloured', 'amgprojone_plastic', 'amgprojone_decal_grill1'],
    clearGlassMaterialMatchers: ['amgprojone_clearglass', 'amgprojone_clearglass2'],
    glassMaterialMatchers: ['amgprojone_glass.005'],
    headlightMaterialMatchers: ['amgprojone_runninglight'],
    taillightMaterialMatchers: ['amgprojone_taillight', 'amgprojone_redglass'],
    brakeRotorMatchers: ['amgprojone_wheels'],
    darkUnderbodyMatchers: ['amgprojone_detail_underbody'],
    debadgeMaterialMatchers: [],
  },
  lemans_proto: {
    id: 'lemans_proto',
    modelFile: '/models/supercars/lemans_proto.glb',
    defaultPaintHex: '#12151c', // Authentic Sketchfab Stealth Carbon Obsidian Black
    paintMetalness: 0.72,
    paintRoughness: 0.18,
    glassOpacity: 0.88,
    targetLength: 0.0222,
    stanceWidthScale: 1.03,
    stanceHeightScale: 1.0,
    yawOffsetRad: -Math.PI / 2, // H._Light at +X, Brakelamp/Exhaust at -X -> rotate -PI/2 to +Z
    wheelNodeNames: {},
    bodyMaterialMatchers: ['main_color'],
    texturedBodyMatchers: [],
    clearGlassMaterialMatchers: ['headlamp_glass'],
    glassMaterialMatchers: ['window'],
    headlightMaterialMatchers: ['h._light', 'headlamp'],
    taillightMaterialMatchers: ['brakelamp'],
    brakeRotorMatchers: ['rims'],
    darkUnderbodyMatchers: ['dark', 'black'],
    debadgeMaterialMatchers: [],
  },
  scion_gt: {
    id: 'scion_gt',
    modelFile: '/models/supercars/scion_gt.glb',
    defaultPaintHex: '#d81b24', // Vibrant Sketchfab Glossy Crimson Red
    paintMetalness: 0.76,
    paintRoughness: 0.15,
    targetLength: 0.0210,
    stanceWidthScale: 1.04,
    stanceHeightScale: 0.96,
    yawOffsetRad: 0, // reverse_light & redglass at -Z -> nose already faces +Z
    wheelNodeNames: {},
    bodyMaterialMatchers: ['body'],
    texturedBodyMatchers: ['lights_lod0', 'interior_lod0'],
    matteTrimMatchers: ['nodamage_lod0', 'grille', 'black', 'plastic.002', 'plastic2', 'material.002', 'rk_rubber_black'],
    clearGlassMaterialMatchers: ['glass2.001'],
    glassMaterialMatchers: ['window.001', 'black_glass'],
    headlightMaterialMatchers: ['reflector'],
    taillightMaterialMatchers: ['detail_glass_red', 'redglass'],
    brakeRotorMatchers: ['brakes'],
    darkUnderbodyMatchers: ['undercarriage', 'bottom'],
    debadgeMaterialMatchers: [],
  },
};

export function isSupercarId(carId) {
  if (!carId) return false;
  return Boolean(SUPERCAR_CATALOG[String(carId).trim().toLowerCase()]);
}

const rawSupercarCache = new Map();
const loadPromises = new Map();
let sharedContactShadowTex = null;

/**
 * Injects the exact Sketchfab multi-tone iridescent design color look for:
 *  - 'amg_one' (Screenshot 3: Neon Crimson-Magenta nose/hood center + Electric Cyan border contour +
 *    Metallic Steel-Azure fenders with topographic Cyan/Amber contour rings + Golden-Amber roof/rear)
 *  - 'apollo_ie' (Screenshot 5: Metallic Cobalt-Azure Blue front nose/fenders transitioning smoothly
 *    into Fiery Amber-Gold / Copper-Bronze rear deck & wing over woven carbon + Orange/Blue ridge contours)
 * Easily toggled off via uniform uUseStockLivery when the player chooses a custom solid paint color in Garage!
 */
function attachSketchfabDesignShader(material, preset) {
  if (!preset) return;
  material.userData.uUseStockLivery = { value: 1.0 };
  material.customProgramCacheKey = () => `sketchfab_design_${preset}`;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uUseStockLivery = material.userData.uUseStockLivery;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
varying vec3 vDesignLocalPos;
varying vec3 vDesignLocalNorm;`
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vDesignLocalPos = position;
vDesignLocalNorm = normal;`
      );

    if (preset === 'amg_one') {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uUseStockLivery;
varying vec3 vDesignLocalPos;
varying vec3 vDesignLocalNorm;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
if (uUseStockLivery > 0.5) {
  vec3 rawCol = diffuseColor.rgb;
  float redness = rawCol.r - max(rawCol.g, rawCol.b);
  float luma = dot(rawCol, vec3(0.299, 0.587, 0.114));

  // 1. Vibrant Neon Crimson-Magenta nose & center hood panel
  vec3 crimsonNeon = vec3(1.0, 0.07, 0.30);
  // 2. Metallic Steel-Azure Silver front fenders & doors
  vec3 steelAzure = vec3(0.48, 0.62, 0.80);
  // 3. Warm Golden-Amber roof & upper rear engine deck
  vec3 goldenAmber = vec3(0.92, 0.58, 0.14);
  // 4. Electric Cyan contour accent line
  vec3 electricCyan = vec3(0.0, 0.90, 1.0);

  float redMask = smoothstep(0.05, 0.18, redness);
  float cyanBorder = smoothstep(0.02, 0.06, redness) * (1.0 - smoothstep(0.07, 0.13, redness));

  // Longitudinal + height blend between Steel-Azure front fenders and Golden-Amber roof/rear
  vec3 nNorm = normalize(vDesignLocalNorm + vec3(0.0, 0.0001, 0.0));
  float roofRearMix = smoothstep(0.15, 0.72, nNorm.y * 0.65 + (1.0 - luma) * 0.55);
  vec3 basePanel = mix(steelAzure, goldenAmber, roofRearMix);

  // Topographic contour rings across fenders & roof (matching Screenshot 3!)
  float topoPhase = sin(vDesignLocalPos.x * 26.0 + vDesignLocalPos.y * 22.0 + vDesignLocalPos.z * 14.0);
  float topoLine = smoothstep(0.76, 0.95, topoPhase);
  vec3 topoColor = mix( crimsonNeon, electricCyan, smoothstep(-0.2, 0.6, nNorm.x) );
  basePanel = mix(basePanel, topoColor, topoLine * 0.42 * (1.0 - redMask));

  vec3 finalLivery = mix(basePanel, crimsonNeon, redMask);
  finalLivery = mix(finalLivery, electricCyan, cyanBorder * 0.92);
  diffuseColor.rgb = finalLivery;
}`
        );
    } else if (preset === 'apollo_ie') {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform float uUseStockLivery;
varying vec3 vDesignLocalPos;
varying vec3 vDesignLocalNorm;`
        )
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
if (uUseStockLivery > 0.5) {
  // Preserve subtle woven carbon fiber micro-contrast from diffuseColor
  float carbonWeave = clamp(dot(diffuseColor.rgb, vec3(0.333)) * 1.45 + 0.52, 0.55, 1.15);
  vec3 nNorm = normalize(vDesignLocalNorm + vec3(0.0, 0.0001, 0.0));

  // Smooth transition from Metallic Cobalt-Azure Blue front to Fiery Amber-Gold rear & side aero (Screenshot 5!)
  float rearGoldMix = smoothstep(-0.35, 0.55, -vDesignLocalPos.z * 0.85 + abs(vDesignLocalPos.x) * 0.35);
  vec3 cobaltAzure = vec3(0.18, 0.46, 0.88);
  vec3 amberGold = vec3(0.88, 0.44, 0.08);
  vec3 bodyGrad = mix(cobaltAzure, amberGold, rearGoldMix) * carbonWeave;

  // Crisp Golden-Orange & Electric Blue aerodynamic crease / ridge contour lines
  float ridgeContour = smoothstep(0.68, 0.94, abs(sin(nNorm.x * 7.5 + nNorm.y * 5.5)));
  vec3 ridgeCol = mix(vec3(1.0, 0.58, 0.05), vec3(0.22, 0.68, 1.0), rearGoldMix);
  diffuseColor.rgb = mix(bodyGrad, ridgeCol, ridgeContour * 0.38);
}`
        );
    }
  };
}

/**
 * Generates a rich, soft elliptical tire + under-chassis Contact Shadow texture
 * designed for NormalBlending (never washes out on asphalt, wet roads, or dark obsidian floors!).
 */
function getRichContactShadowTexture() {
  if (sharedContactShadowTex) return sharedContactShadowTex;
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, 256, 256);

    // Outer ambient shadow falloff
    ctx.save();
    ctx.translate(128, 128);
    ctx.scale(0.86, 1.0);
    const outerGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, 120);
    outerGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.96)');
    outerGrad.addColorStop(0.42, 'rgba(2, 4, 8, 0.88)');
    outerGrad.addColorStop(0.68, 'rgba(2, 4, 10, 0.50)');
    outerGrad.addColorStop(0.88, 'rgba(2, 4, 10, 0.14)');
    outerGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = outerGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 120, 0, Math.PI * 2);
    ctx.fill();

    // Extra-dense under-body rectangular core so the car sits heavy & grounded on sunlit tarmac
    const coreGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 74);
    coreGrad.addColorStop(0.0, 'rgba(0, 0, 0, 0.92)');
    coreGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.65)');
    coreGrad.addColorStop(1.0, 'rgba(0, 0, 0, 0.0)');
    ctx.fillStyle = coreGrad;
    ctx.scale(0.76, 1.08);
    ctx.beginPath();
    ctx.arc(0, 0, 74, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedContactShadowTex = tex;
  return tex;
}

export function loadSupercarGlb(carId) {
  const key = String(carId || '').trim().toLowerCase();
  const cfg = SUPERCAR_CATALOG[key];
  if (!cfg) {
    return Promise.reject(new Error(`Unknown supercar id: ${carId}`));
  }
  if (rawSupercarCache.has(key)) {
    return Promise.resolve(rawSupercarCache.get(key));
  }
  if (loadPromises.has(key)) {
    return loadPromises.get(key);
  }

  const loader = getSharedGltfLoader();
  const p = new Promise((resolve, reject) => {
    loader.load(
      cfg.modelFile,
      (gltf) => {
        rawSupercarCache.set(key, gltf);
        resolve(gltf);
      },
      undefined,
      (err) => reject(err)
    );
  }).finally(() => {
    loadPromises.delete(key);
  });

  loadPromises.set(key, p);
  return p;
}

function matchesAny(str, matchers) {
  if (!str || !matchers || matchers.length === 0) return false;
  const low = str.toLowerCase();
  for (let i = 0; i < matchers.length; i++) {
    if (low.includes(matchers[i])) return true;
  }
  return false;
}

/**
 * Instantiates an AAA high-poly supercar compatible with MicroKartBuilder's
 * Cosmo/Supercar interface: { carId, assemblyRoot, spinWheels, steerFrontWheels, setPaint, setBraking, dispose }
 */
export async function createSupercarInstance(carId, customPaintHex = null) {
  const key = String(carId || 'v12_goblin').trim().toLowerCase();
  const cfg = SUPERCAR_CATALOG[key] || SUPERCAR_CATALOG.v12_goblin;
  const gltf = await loadSupercarGlb(key);

  const assemblyRoot = new THREE.Group();
  assemblyRoot.name = `Supercar_${key}`;

  const modelContainer = new THREE.Group();
  modelContainer.name = `SupercarContainer_${key}`;
  assemblyRoot.add(modelContainer);

  // Rotate to track-forward (+Z) FIRST inside yawPivot so width (X), height (Y), length (Z)
  // are identical regardless of whether the source GLB pointed +Z, -Z, +X, or -X.
  const yawPivot = new THREE.Group();
  yawPivot.name = `SupercarYaw_${key}`;
  yawPivot.rotation.y = cfg.yawOffsetRad ?? 0;
  modelContainer.add(yawPivot);

  const clonedScene = gltf.scene.clone(true);
  yawPivot.add(clonedScene);

  // Measure world bounds AFTER yaw alignment so X=width, Y=height, Z=length
  assemblyRoot.updateMatrixWorld(true);
  const alignedBox = new THREE.Box3().setFromObject(yawPivot);
  const alignedSize = new THREE.Vector3();
  const alignedCenter = new THREE.Vector3();
  alignedBox.getSize(alignedSize);
  alignedBox.getCenter(alignedCenter);

  const lengthSpan = Math.max(0.0001, alignedSize.z, alignedSize.x);
  const scaleBase = (cfg.targetLength || 0.0212) / lengthSpan;
  const scaleX = scaleBase * (cfg.stanceWidthScale || 1.0);
  const scaleY = scaleBase * (cfg.stanceHeightScale || 1.0);
  const scaleZ = scaleBase;

  // Center X/Z and snap bottom of tires cleanly to Y = 0 in aligned space
  yawPivot.position.set(-alignedCenter.x, -alignedBox.min.y, -alignedCenter.z);
  modelContainer.scale.set(scaleX, scaleY, scaleZ);

  const carWidth = alignedSize.x * scaleX;
  const carHeight = alignedSize.y * scaleY;
  const carLen = alignedSize.z * scaleZ;

  // Upgrade materials to Royal Asphalt 9 Showroom PBR
  const bodyMaterials = [];
  const rearBrakeMaterials = [];
  const rotorMaterials = [];
  const ownedMaterials = [];
  const ownedGeometries = [];
  const materialCloneMap = new Map();

  const hasCustomPaint = customPaintHex !== null && customPaintHex !== undefined && customPaintHex !== '';
  const resolvedPaintHex = hasCustomPaint ? customPaintHex : cfg.defaultPaintHex;
  const keepStockLivery = Boolean(cfg.preserveTextureWhenDefaultPaint && !hasCustomPaint);
  const paintMetalness = cfg.paintMetalness ?? 0.80;
  const paintRoughness = cfg.paintRoughness ?? 0.17;

  clonedScene.traverse((obj) => {
    if (!obj.isMesh) return;
    obj.castShadow = false;
    obj.receiveShadow = false;

    const srcMats = Array.isArray(obj.material) ? obj.material : [obj.material];
    const nextMats = srcMats.map((srcMat) => {
      if (!srcMat) return srcMat;
      if (materialCloneMap.has(srcMat)) return materialCloneMap.get(srcMat);

      const mName = srcMat.name || '';
      let upgraded = null;

      if (matchesAny(mName, cfg.debadgeMaterialMatchers)) {
        // Neutralize OEM roundels (trunk, hood, wheel hubs) into sleek stealth dark brushed titanium
        upgraded = new THREE.MeshStandardMaterial({
          name: `${mName}_stealth`,
          color: new THREE.Color(0x161c26),
          map: null,
          metalness: 0.82,
          roughness: 0.24,
          envMapIntensity: 1.25,
          side: srcMat.side ?? THREE.FrontSide,
        });
      } else if (matchesAny(mName, cfg.darkUnderbodyMatchers)) {
        // Authentic matte dark carbon underbody / diffuser tray (looks clean during 360° barrel rolls!)
        upgraded = new THREE.MeshStandardMaterial({
          name: `${mName}_carbonbase`,
          color: new THREE.Color(0x11151d),
          map: null,
          metalness: 0.24,
          roughness: 0.72,
          envMapIntensity: 0.45,
          side: srcMat.side ?? THREE.FrontSide,
        });
      } else if (matchesAny(mName, cfg.bodyMaterialMatchers)) {
        const origMap = srcMat.map || null;
        const useOrigLivery = Boolean(keepStockLivery && (origMap || cfg.sketchfabIridescentPreset));
        const hasIridescentPreset = Boolean(cfg.sketchfabIridescentPreset);
        upgraded = new THREE.MeshPhysicalMaterial({
          name: mName,
          color: useOrigLivery
            ? new THREE.Color(0xffffff)
            : new THREE.Color(resolvedPaintHex || '#c80828'),
          map: useOrigLivery ? origMap : null,
          normalMap: srcMat.normalMap || null,
          metalness: useOrigLivery ? (hasIridescentPreset ? 0.56 : 0.48) : paintMetalness,
          roughness: useOrigLivery ? (hasIridescentPreset ? 0.18 : 0.22) : paintRoughness,
          clearcoat: 1.0,
          clearcoatRoughness: 0.04,
          reflectivity: 1.0,
          iridescence: hasIridescentPreset && useOrigLivery ? 0.92 : 0.0,
          iridescenceIOR: 1.85,
          iridescenceThicknessRange: [160, 420],
          envMapIntensity: 1.65,
          side: srcMat.side ?? THREE.FrontSide,
        });
        if (hasIridescentPreset) {
          attachSketchfabDesignShader(upgraded, cfg.sketchfabIridescentPreset);
          upgraded.userData.uUseStockLivery.value = useOrigLivery ? 1.0 : 0.0;
        }
        upgraded.userData.origMap = origMap;
        upgraded.userData.hasIridescentPreset = hasIridescentPreset;
        upgraded.userData.preserveStockLivery = Boolean(cfg.preserveTextureWhenDefaultPaint);
        bodyMaterials.push(upgraded);
      } else if (matchesAny(mName, cfg.taillightMaterialMatchers)) {
        // Check taillights BEFORE glass so materials like 'glass_red' always glow crimson!
        upgraded = new THREE.MeshStandardMaterial({
          name: mName,
          color: new THREE.Color(0xff1428),
          emissive: new THREE.Color(0xff0a20),
          emissiveIntensity: 2.45,
          roughness: 0.1,
          metalness: 0.2,
          toneMapped: false,
        });
        rearBrakeMaterials.push(upgraded);
      } else if (matchesAny(mName, cfg.headlightMaterialMatchers)) {
        upgraded = new THREE.MeshStandardMaterial({
          name: mName,
          color: new THREE.Color(0xf8fafc),
          emissive: new THREE.Color(0xe0f2fe),
          emissiveIntensity: 2.6,
          roughness: 0.06,
          metalness: 0.15,
          toneMapped: false,
        });
      } else if (matchesAny(mName, cfg.clearGlassMaterialMatchers)) {
        // Crystal-clear optical polycarbonate headlight/lamp cover glass (never dark cabin tint!)
        upgraded = new THREE.MeshPhysicalMaterial({
          name: mName,
          color: new THREE.Color(0xf8fafc),
          metalness: 0.05,
          roughness: 0.02,
          clearcoat: 1.0,
          clearcoatRoughness: 0.02,
          reflectivity: 1.0,
          transparent: true,
          opacity: 0.18,
          envMapIntensity: 1.6,
          depthWrite: false,
        });
      } else if (matchesAny(mName, cfg.glassMaterialMatchers)) {
        const isChameleonGlass = Boolean(cfg.chameleonGlassColorHex);
        upgraded = new THREE.MeshPhysicalMaterial({
          name: mName,
          color: new THREE.Color(isChameleonGlass ? cfg.chameleonGlassColorHex : 0x050912),
          emissive: new THREE.Color(isChameleonGlass ? cfg.chameleonGlassColorHex : 0x000000),
          emissiveIntensity: isChameleonGlass ? 0.42 : 0.0,
          metalness: isChameleonGlass ? 0.38 : 0.25,
          roughness: 0.03,
          clearcoat: 1.0,
          clearcoatRoughness: 0.02,
          reflectivity: 1.0,
          iridescence: isChameleonGlass ? 0.95 : 0.0,
          iridescenceIOR: 1.9,
          transparent: true,
          opacity: cfg.glassOpacity ?? (isChameleonGlass ? 0.74 : 0.68),
          envMapIntensity: 1.75,
          depthWrite: false,
        });
      } else if (matchesAny(mName, cfg.matteTrimMatchers)) {
        // Authentic satin/matte black grilles, hood vents, splitters & aero trim (never white clearcoat washout!)
        upgraded = new THREE.MeshStandardMaterial({
          name: mName,
          color: srcMat.map ? new THREE.Color(0xffffff) : new THREE.Color(0x12161f),
          map: srcMat.map || null,
          normalMap: srcMat.normalMap || null,
          metalness: 0.12,
          roughness: 0.56,
          envMapIntensity: 0.65,
          side: srcMat.side ?? THREE.FrontSide,
        });
      } else if (matchesAny(mName, cfg.texturedBodyMatchers)) {
        // Clamp runaway Blender metalness=1.0 on textured lights/interiors without adding hazy clearcoat glare
        const safeMetalness = srcMat.map
          ? Math.min(0.24, srcMat.metalness ?? 0.18)
          : Math.min(0.38, srcMat.metalness ?? 0.25);
        upgraded = new THREE.MeshStandardMaterial({
          name: mName,
          color: srcMat.color ? srcMat.color.clone() : new THREE.Color(0xffffff),
          map: srcMat.map || null,
          normalMap: srcMat.normalMap || null,
          roughnessMap: srcMat.roughnessMap || null,
          metalnessMap: srcMat.metalnessMap || null,
          metalness: safeMetalness,
          roughness: Math.min(0.42, Math.max(0.18, srcMat.roughness ?? 0.28)),
          envMapIntensity: 1.15,
          side: srcMat.side ?? THREE.FrontSide,
        });
      } else if (matchesAny(mName, ['tire', 'tyre', 'rubber', 'padanga'])) {
        upgraded = srcMat.clone();
        if (!upgraded.map && upgraded.color && upgraded.color.r < 0.04 && upgraded.color.g < 0.04 && upgraded.color.b < 0.04) {
          upgraded.color.setHex(0x14171e);
        }
        upgraded.roughness = 0.86;
        upgraded.metalness = 0.04;
        upgraded.envMapIntensity = 0.42;
      } else if (matchesAny(mName, ['mirror'])) {
        upgraded = new THREE.MeshStandardMaterial({
          name: mName,
          color: new THREE.Color(0xe2e8f0),
          metalness: 0.96,
          roughness: 0.05,
          envMapIntensity: 1.6,
          side: srcMat.side ?? THREE.FrontSide,
        });
      } else if (matchesAny(mName, ['second_color'])) {
        // Sleek glossy forged obsidian secondary aero accent (Le Mans LMP-X)
        upgraded = new THREE.MeshPhysicalMaterial({
          name: mName,
          color: new THREE.Color(0x141922),
          metalness: 0.58,
          roughness: 0.22,
          clearcoat: 0.92,
          clearcoatRoughness: 0.08,
          envMapIntensity: 1.35,
          side: srcMat.side ?? THREE.FrontSide,
        });
      } else if (matchesAny(mName, ['chrome', 'metal', 'rim', 'disc', 'wheel', 'exhaust'])) {
        upgraded = srcMat.clone();
        if (!upgraded.map) {
          const isBlackBase =
            upgraded.color &&
            upgraded.color.r < 0.05 &&
            upgraded.color.g < 0.05 &&
            upgraded.color.b < 0.05;
          if (isBlackBase) {
            upgraded.color.setHex(matchesAny(mName, ['wheel', 'rim']) ? 0x64748b : 0xd8e0ea);
          } else if (matchesAny(mName, ['rims']) && upgraded.color.r < 0.35) {
            upgraded.color.setHex(0xa8b8cc);
          }
          upgraded.metalness = Math.max(0.84, upgraded.metalness ?? 0.88);
          upgraded.roughness = Math.min(0.20, upgraded.roughness ?? 0.16);
        }
        upgraded.envMapIntensity = 1.55;
      } else if (matchesAny(mName, ['carbon'])) {
        upgraded = new THREE.MeshPhysicalMaterial({
          name: mName,
          color: srcMat.color ? srcMat.color.clone() : new THREE.Color(0x1a2028),
          map: srcMat.map || null,
          normalMap: srcMat.normalMap || null,
          metalness: 0.30,
          roughness: 0.26,
          clearcoat: 0.82,
          clearcoatRoughness: 0.10,
          envMapIntensity: 1.35,
          side: srcMat.side ?? THREE.FrontSide,
        });
      } else {
        upgraded = srcMat.clone();
        upgraded.envMapIntensity = 1.08;
      }

      // Check brake rotor/caliper node or material names for subtle thermal glow on hard braking
      if (
        (matchesAny(obj.name, cfg.brakeRotorMatchers) || matchesAny(mName, cfg.brakeRotorMatchers)) &&
        !matchesAny(mName, ['tire', 'tyre', 'rubber'])
      ) {
        if (upgraded.emissive) {
          rotorMaterials.push(upgraded);
        }
      }

      // Sharpen all supercar textures at grazing angles (fixes blurry hood/roof liveries!)
      const texSlots = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'];
      for (let t = 0; t < texSlots.length; t++) {
        const tex = upgraded[texSlots[t]];
        if (tex) {
          tex.anisotropy = Math.max(tex.anisotropy || 1, 8);
        }
      }

      materialCloneMap.set(srcMat, upgraded);
      ownedMaterials.push(upgraded);
      return upgraded;
    });

    obj.material = Array.isArray(obj.material) ? nextMats : nextMats[0];
  });

  // ---------------------------------------------------------------------------
  // Grounded Rich Charcoal Contact Shadow flush under the supercar (Race Track only!)
  // Automatically hidden on the Garage turntable via userData.isContactShadow so
  // no double shadow plane ever overlaps or cuts across the bottom of the tires!
  // ---------------------------------------------------------------------------
  const contactTex = getRichContactShadowTexture();
  const aoMat = new THREE.MeshBasicMaterial({
    map: contactTex,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    polygonOffset: false,
  });
  const aoGeo = new THREE.PlaneGeometry(carWidth * 1.16, carLen * 1.10);
  const aoShadowMesh = new THREE.Mesh(aoGeo, aoMat);
  aoShadowMesh.name = 'SupercarContactShadow';
  aoShadowMesh.userData.isContactShadow = true;
  aoShadowMesh.rotation.x = -Math.PI / 2;
  aoShadowMesh.position.set(0, 0.000015, 0);
  assemblyRoot.add(aoShadowMesh);
  ownedMaterials.push(aoMat);
  ownedGeometries.push(aoGeo);

  // Locate front/rear wheels & wrap each in an auto-centered steer + spin rig
  // (works even when Sketchfab models leave wheel node origin at [0,0,0]!)
  const wheelRecords = [];
  const frontSteerPivots = [];
  const wheelNames = cfg.wheelNodeNames || {};
  const explicitNames = new Set(
    Object.values(wheelNames)
      .filter(Boolean)
      .map((n) => n.toLowerCase())
  );

  const foundWheels = [];
  if (explicitNames.size > 0) {
    clonedScene.traverse((node) => {
      const low = (node.name || '').toLowerCase();
      if (explicitNames.has(low)) {
        foundWheels.push(node);
      }
    });
  }

  const flName = (wheelNames.fl || '').toLowerCase();
  const frName = (wheelNames.fr || '').toLowerCase();
  const _invParentMat = new THREE.Matrix4();
  const _wBox = new THREE.Box3();
  const _wCenterWorld = new THREE.Vector3();
  const _wCenterLocal = new THREE.Vector3();

  assemblyRoot.updateMatrixWorld(true);
  for (const wNode of foundWheels) {
    if (!wNode.parent) continue;
    const low = (wNode.name || '').toLowerCase();
    const isFront =
      (flName && low === flName) ||
      (frName && low === frName) ||
      low.includes('_fl') ||
      low.includes('_fr') ||
      low.includes('front');

    // Compute true geometric center of the wheel in parent local coordinates
    _wBox.setFromObject(wNode);
    if (_wBox.isEmpty()) continue;
    _wBox.getCenter(_wCenterWorld);
    _invParentMat.copy(wNode.parent.matrixWorld).invert();
    _wCenterLocal.copy(_wCenterWorld).applyMatrix4(_invParentMat);

    const steerPivot = new THREE.Group();
    steerPivot.name = `${wNode.name}_SteerPivot`;
    steerPivot.position.copy(_wCenterLocal);

    const spinPivot = new THREE.Group();
    spinPivot.name = `${wNode.name}_SpinPivot`;
    steerPivot.add(spinPivot);

    wNode.parent.add(steerPivot);
    wNode.position.sub(_wCenterLocal);
    spinPivot.add(wNode);

    wheelRecords.push({ spinPivot, steerPivot, isFront });
    if (isFront) {
      frontSteerPivots.push(steerPivot);
    }
  }

  let steeringWheelNode = null;
  let steeringWheelBaseZ = 0;
  if (cfg.steeringWheelNodeName) {
    steeringWheelNode = clonedScene.getObjectByName(cfg.steeringWheelNodeName) || null;
    if (steeringWheelNode) {
      steeringWheelBaseZ = steeringWheelNode.rotation.z;
    }
  }

  let wheelRotX = 0;
  let currentSteerY = 0;
  let brakeHeat = 0;
  const wheelRadius = Math.max(0.0011, 0.35 * scaleY);
  const spinSign =
    Math.abs(Math.cos(cfg.yawOffsetRad ?? 0)) > 0.5 && Math.cos(cfg.yawOffsetRad ?? 0) < 0 ? -1 : 1;

  function spinWheels(distDelta) {
    if (wheelRecords.length === 0 || Math.abs(distDelta) < 1e-7) return;
    const angleDelta = (distDelta / wheelRadius) * spinSign;
    wheelRotX = (wheelRotX + angleDelta) % (Math.PI * 200);
    for (let i = 0; i < wheelRecords.length; i++) {
      wheelRecords[i].spinPivot.rotation.x = wheelRotX;
    }
  }

  function steerFrontWheels(angleRad) {
    const clamped = THREE.MathUtils.clamp(angleRad, -0.46, 0.46);
    currentSteerY = THREE.MathUtils.lerp(currentSteerY, clamped, 0.35);
    for (let i = 0; i < frontSteerPivots.length; i++) {
      frontSteerPivots[i].rotation.y = currentSteerY;
    }
    if (steeringWheelNode) {
      steeringWheelNode.rotation.z = steeringWheelBaseZ - currentSteerY * 2.2;
    }
  }

  function setPaint(hex) {
    const hasHex = hex !== null && hex !== undefined && hex !== '';
    for (let i = 0; i < bodyMaterials.length; i++) {
      const m = bodyMaterials[i];
      if (!hasHex && m.userData?.preserveStockLivery && (m.userData?.origMap || m.userData?.hasIridescentPreset)) {
        m.map = m.userData.origMap || null;
        m.color.set(0xffffff);
        m.metalness = m.userData.hasIridescentPreset ? 0.56 : 0.48;
        m.roughness = m.userData.hasIridescentPreset ? 0.18 : 0.22;
        if (m.userData.hasIridescentPreset) {
          m.iridescence = 0.92;
          if (m.userData.uUseStockLivery) m.userData.uUseStockLivery.value = 1.0;
        }
      } else {
        m.map = null;
        m.color.set(hasHex ? hex : cfg.defaultPaintHex || '#c80828');
        m.metalness = paintMetalness;
        m.roughness = paintRoughness;
        if (m.userData?.hasIridescentPreset) {
          m.iridescence = 0.0;
          if (m.userData.uUseStockLivery) m.userData.uUseStockLivery.value = 0.0;
        }
      }
      m.needsUpdate = true;
    }
  }

  function setBraking(isBraking) {
    const targetEmissive = isBraking ? 4.8 : 2.35;
    for (let i = 0; i < rearBrakeMaterials.length; i++) {
      rearBrakeMaterials[i].emissiveIntensity = targetEmissive;
    }
    brakeHeat = THREE.MathUtils.lerp(brakeHeat, isBraking ? 1.0 : 0.0, isBraking ? 0.25 : 0.08);
    if (rotorMaterials.length > 0) {
      for (let i = 0; i < rotorMaterials.length; i++) {
        const rm = rotorMaterials[i];
        rm.emissive.setRGB(brakeHeat * 1.15, brakeHeat * 0.22, 0.02 * brakeHeat);
        rm.emissiveIntensity = brakeHeat * 1.4;
      }
    }
  }

  return {
    carId: key,
    isSupercar: true,
    assemblyRoot,
    modelContainer,
    wheelNodes: wheelRecords.map((r) => r.spinPivot),
    frontWheels: frontSteerPivots,
    rearWheels: wheelRecords.filter((r) => !r.isFront).map((r) => r.spinPivot),
    spinWheels,
    steerFrontWheels,
    setPaint,
    setBraking,
    dispose() {
      for (let i = 0; i < ownedGeometries.length; i++) {
        ownedGeometries[i]?.dispose?.();
      }
      for (let i = 0; i < ownedMaterials.length; i++) {
        ownedMaterials[i]?.dispose?.();
      }
    },
  };
}

export function preloadSupercars() {
  return Promise.all(
    Object.keys(SUPERCAR_CATALOG).map((id) =>
      loadSupercarGlb(id).catch((err) => {
        console.warn(`[Supercar] Preload ${id} failed:`, err);
      })
    )
  );
}
