import * as THREE from 'three';
import { getSharedGltfLoader } from './PbrAssetManager.js';

/**
 * Universal AAA High-Poly Supercar Loader (Draco GLB + Royal Asphalt Material Pipeline).
 *
 * Drop-in ready for Phase 2 Sketchfab CC-BY supercars (e.g. V12 Goblin, Hypercars):
 * Just drop any 40K-120K triangle .glb into /public/models/supercars/ and add an entry
 * to SUPERCAR_CATALOG below. The loader automatically:
 *  - Decodes Draco geometry on a single shared WASM decoder
 *  - Auto-orients forward (+Z), bottom-grounds (y = 0), and scales to exact 1:87 wheelbase
 *  - Upgrades paint to Dual-Clearcoat Metallic Physical PBR (live Garage Paint compatible!)
 *  - Upgrades glass to reflective tinted clearcoat glass showing the 3D cockpit interior
 *  - Sets white/ice-blue LED front headlights & dynamic crimson rear brake lights
 *  - Attaches baked ground Contact AO shadow flush beneath the chassis
 *  - Hooks spinning wheels, steerable front hubs, and cockpit steering wheel
 */
export const SUPERCAR_CATALOG = {
  ferrari: {
    id: 'ferrari',
    modelFile: '/models/supercars/ferrari.glb',
    aoTextureFile: '/models/supercars/ferrari_ao.png',
    defaultPaintHex: '#d90429',
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
    glassMaterialMatchers: ['glass', 'windshield', 'window'],
    headlightMaterialMatchers: ['projector', 'headlight', 'turn_signal', 'drl'],
    taillightMaterialMatchers: ['taillight', 'rear_light', 'brake_light'],
    brakeRotorMatchers: ['brake', 'disc', 'rotor', 'caliper'],
  },
};

export function isSupercarId(carId) {
  if (!carId) return false;
  return Boolean(SUPERCAR_CATALOG[String(carId).trim().toLowerCase()]);
}

const rawSupercarCache = new Map();
const loadPromises = new Map();
const aoTextureCache = new Map();
const texLoader = new THREE.TextureLoader();

function getAoTexture(url) {
  if (!url) return null;
  if (aoTextureCache.has(url)) return aoTextureCache.get(url);
  const tex = texLoader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  aoTextureCache.set(url, tex);
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
  if (!str || !matchers) return false;
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
  const key = String(carId || 'ferrari').trim().toLowerCase();
  const cfg = SUPERCAR_CATALOG[key] || SUPERCAR_CATALOG.ferrari;
  const gltf = await loadSupercarGlb(key);

  const assemblyRoot = new THREE.Group();
  assemblyRoot.name = `Supercar_${key}`;

  const modelContainer = new THREE.Group();
  modelContainer.name = `SupercarContainer_${key}`;
  assemblyRoot.add(modelContainer);

  const clonedScene = gltf.scene.clone(true);
  modelContainer.add(clonedScene);

  // Measure bounds before rotation/scaling so we ground cleanly at Y = 0
  clonedScene.updateMatrixWorld(true);
  const rawBox = new THREE.Box3().setFromObject(clonedScene);
  const rawSize = new THREE.Vector3();
  const rawCenter = new THREE.Vector3();
  rawBox.getSize(rawSize);
  rawBox.getCenter(rawCenter);

  const maxHorizSpan = Math.max(0.001, rawSize.z, rawSize.x);
  const scaleBase = (cfg.targetLength || 0.0206) / maxHorizSpan;
  const scaleX = scaleBase * (cfg.stanceWidthScale || 1.0);
  const scaleY = scaleBase * (cfg.stanceHeightScale || 1.0);
  const scaleZ = scaleBase;

  // Center X/Z and snap bottom of tires cleanly to Y = 0
  clonedScene.position.set(-rawCenter.x, -rawBox.min.y, -rawCenter.z);
  modelContainer.rotation.y = cfg.yawOffsetRad ?? Math.PI;
  modelContainer.scale.set(scaleX, scaleY, scaleZ);

  // Upgrade materials to Royal Asphalt 9 Showroom PBR
  const bodyMaterials = [];
  const rearBrakeMaterials = [];
  const rotorMaterials = [];
  const ownedMaterials = [];
  const materialCloneMap = new Map();

  const initialPaintColor = new THREE.Color(customPaintHex || cfg.defaultPaintHex || '#d90429');

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

      if (matchesAny(mName, cfg.bodyMaterialMatchers)) {
        upgraded = new THREE.MeshPhysicalMaterial({
          name: mName,
          color: initialPaintColor.clone(),
          metalness: 0.72,
          roughness: 0.22,
          clearcoat: 1.0,
          clearcoatRoughness: 0.055,
          reflectivity: 0.98,
          envMapIntensity: 1.55,
          side: srcMat.side ?? THREE.FrontSide,
        });
        bodyMaterials.push(upgraded);
      } else if (matchesAny(mName, cfg.glassMaterialMatchers)) {
        upgraded = new THREE.MeshPhysicalMaterial({
          name: mName,
          color: new THREE.Color(0x0b1220),
          metalness: 0.22,
          roughness: 0.04,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          reflectivity: 0.98,
          transparent: true,
          opacity: 0.56,
          envMapIntensity: 1.65,
          depthWrite: false,
        });
      } else if (matchesAny(mName, cfg.taillightMaterialMatchers)) {
        upgraded = new THREE.MeshStandardMaterial({
          name: mName,
          color: new THREE.Color(0xff1428),
          emissive: new THREE.Color(0xff0a20),
          emissiveIntensity: 2.25,
          roughness: 0.1,
          metalness: 0.2,
          toneMapped: false,
        });
        rearBrakeMaterials.push(upgraded);
      } else if (matchesAny(mName, cfg.headlightMaterialMatchers)) {
        upgraded = new THREE.MeshStandardMaterial({
          name: mName,
          color: new THREE.Color(0xf0f9ff),
          emissive: new THREE.Color(0xbae6fd),
          emissiveIntensity: 2.35,
          roughness: 0.08,
          metalness: 0.15,
          toneMapped: false,
        });
      } else if (matchesAny(mName, ['tire', 'rubber'])) {
        upgraded = srcMat.clone();
        upgraded.roughness = 0.82;
        upgraded.metalness = 0.05;
        upgraded.envMapIntensity = 0.5;
      } else if (matchesAny(mName, ['chrome', 'metal'])) {
        upgraded = srcMat.clone();
        upgraded.metalness = 0.92;
        upgraded.roughness = 0.16;
        upgraded.envMapIntensity = 1.45;
      } else if (matchesAny(mName, ['carbon'])) {
        upgraded = srcMat.clone();
        upgraded.metalness = 0.35;
        upgraded.roughness = 0.28;
        upgraded.envMapIntensity = 1.15;
      } else {
        upgraded = srcMat.clone();
        upgraded.envMapIntensity = 1.0;
      }

      // Check brake rotor/caliper node names for subtle thermal brake glow on hard braking
      if (matchesAny(obj.name, cfg.brakeRotorMatchers) && !matchesAny(mName, ['tire', 'rubber'])) {
        if (upgraded.emissive) {
          rotorMaterials.push(upgraded);
        }
      }

      materialCloneMap.set(srcMat, upgraded);
      ownedMaterials.push(upgraded);
      return upgraded;
    });

    obj.material = Array.isArray(obj.material) ? nextMats : nextMats[0];
  });

  // Grounded Baked Contact AO Shadow flush under the supercar
  let aoShadowMesh = null;
  if (cfg.aoTextureFile) {
    const aoTex = getAoTexture(cfg.aoTextureFile);
    const aoMat = new THREE.MeshBasicMaterial({
      map: aoTex,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
      blending: THREE.MultiplyBlending,
      premultipliedAlpha: true,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    });
    const carWidth = rawSize.x * scaleX;
    const carLen = rawSize.z * scaleZ;
    const aoGeo = new THREE.PlaneGeometry(carWidth * 1.24, carLen * 1.16);
    aoShadowMesh = new THREE.Mesh(aoGeo, aoMat);
    aoShadowMesh.rotation.x = -Math.PI / 2;
    aoShadowMesh.position.set(0, 0.00035, 0);
    aoShadowMesh.renderOrder = 1;
    assemblyRoot.add(aoShadowMesh);
    ownedMaterials.push(aoMat);
  }

  // Locate front/rear wheels & wrap each in a clean steer + spin rig preserving initial GLTF rotation
  const wheelRecords = [];
  const frontSteerPivots = [];
  const wheelNames = cfg.wheelNodeNames || {};
  const explicitNames = new Set(
    Object.values(wheelNames)
      .filter(Boolean)
      .map((n) => n.toLowerCase())
  );

  const foundWheels = [];
  clonedScene.traverse((node) => {
    const low = (node.name || '').toLowerCase();
    if (explicitNames.size > 0) {
      if (explicitNames.has(low)) {
        foundWheels.push(node);
      }
    } else if (low.includes('wheel') && !low.includes('steering')) {
      foundWheels.push(node);
    }
  });

  const flName = (wheelNames.fl || '').toLowerCase();
  const frName = (wheelNames.fr || '').toLowerCase();

  for (const wNode of foundWheels) {
    if (!wNode.parent) continue;
    const low = (wNode.name || '').toLowerCase();
    const isFront =
      (flName && low === flName) ||
      (frName && low === frName) ||
      low.includes('_fl') ||
      low.includes('_fr') ||
      low.includes('front');

    const steerPivot = new THREE.Group();
    steerPivot.name = `${wNode.name}_SteerPivot`;
    steerPivot.position.copy(wNode.position);

    const spinPivot = new THREE.Group();
    spinPivot.name = `${wNode.name}_SpinPivot`;
    steerPivot.add(spinPivot);

    wNode.parent.add(steerPivot);
    wNode.position.set(0, 0, 0);
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
  // If model was rotated PI on Y, spinning forward around local X flips sign
  const spinSign = Math.abs(Math.cos(cfg.yawOffsetRad ?? Math.PI)) > 0.5 && Math.cos(cfg.yawOffsetRad ?? Math.PI) < 0 ? -1 : 1;

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
    const targetHex = hex || cfg.defaultPaintHex || '#d90429';
    for (let i = 0; i < bodyMaterials.length; i++) {
      bodyMaterials[i].color.set(targetHex);
      bodyMaterials[i].needsUpdate = true;
    }
  }

  function setBraking(isBraking) {
    const targetEmissive = isBraking ? 4.2 : 2.15;
    for (let i = 0; i < rearBrakeMaterials.length; i++) {
      rearBrakeMaterials[i].emissiveIntensity = targetEmissive;
    }
    // Smooth thermal orange-red glow on brake discs when hard braking
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
      if (aoShadowMesh?.geometry) aoShadowMesh.geometry.dispose();
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
