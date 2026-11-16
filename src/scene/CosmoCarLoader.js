import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { BODY_KITS, normalizeCarId } from '../types/game';

const gltfLoader = new GLTFLoader();
const rawGlbCache = new Map();
const loadPromises = new Map();

/**
 * Loads a Cosmo GLB model from /models/cosmo/{carId}.glb with caching.
 */
export function loadCosmoGlb(carId) {
  const normId = normalizeCarId(carId);
  if (rawGlbCache.has(normId)) {
    return Promise.resolve(rawGlbCache.get(normId));
  }
  if (loadPromises.has(normId)) {
    return loadPromises.get(normId);
  }

  const spec = BODY_KITS.find((k) => k.id === normId) || BODY_KITS[0];
  const url = spec.modelFile || `/models/cosmo/${normId}.glb`;

  const p = new Promise((resolve, reject) => {
    gltfLoader.load(
      url,
      (gltf) => {
        rawGlbCache.set(normId, gltf);
        resolve(gltf);
      },
      undefined,
      (err) => {
        console.warn(`Failed to load ${url}, falling back to coupe:`, err);
        if (normId !== 'coupe') {
          loadCosmoGlb('coupe').then(resolve).catch(reject);
        } else {
          reject(err);
        }
      }
    );
  });

  loadPromises.set(normId, p);
  return p;
}

/**
 * Upgrades a source GLTF material into a clearcoat automotive PBR material
 * so cars look richly 3D, dimensional, and glossy instead of flat or dark.
 */
function upgradeCosmoMaterial(srcMat) {
  const mName = (srcMat.name || '').toLowerCase();

  if (mName.includes('metallic') || mName.includes('body')) {
    return new THREE.MeshPhysicalMaterial({
      name: srcMat.name,
      color: srcMat.color ? srcMat.color.clone() : new THREE.Color(0xffffff),
      map: srcMat.map || null,
      normalMap: srcMat.normalMap || null,
      roughnessMap: srcMat.roughnessMap || null,
      metalnessMap: srcMat.metalnessMap || null,
      side: srcMat.side ?? THREE.FrontSide,
      metalness: 0.22,
      roughness: 0.28,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      reflectivity: 0.90,
      envMapIntensity: 0.95,
    });
  }

  if (mName.includes('glass')) {
    return new THREE.MeshPhysicalMaterial({
      name: srcMat.name,
      color: new THREE.Color(0x040812),
      map: srcMat.map || null,
      side: srcMat.side ?? THREE.FrontSide,
      metalness: 0.10,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      reflectivity: 0.92,
      envMapIntensity: 1.0,
    });
  }

  const cloned = srcMat.clone();
  if (mName.includes('light')) {
    cloned.emissiveIntensity = 2.0;
    cloned.toneMapped = false;
  } else {
    // Deep matte rubber & carbon trim contrast against glossy clearcoat bodywork
    cloned.metalness = 0.04;
    cloned.roughness = 0.78;
    cloned.envMapIntensity = 0.35;
  }
  return cloned;
}

/**
 * Deep clones an Object3D hierarchy with upgraded unique PBR materials so that
 * instances (player and rivals) don't bleed custom colors into each other.
 */
function cloneCarHierarchy(source) {
  const clone = source.clone(true);
  const matMap = new Map();

  clone.traverse((node) => {
    node.visible = true;
    node.userData.isCosmoCarMesh = true;
    if (node.isMesh && node.material) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map((m) => {
          if (!matMap.has(m)) matMap.set(m, upgradeCosmoMaterial(m));
          return matMap.get(m);
        });
      } else {
        if (!matMap.has(node.material)) {
          matMap.set(node.material, upgradeCosmoMaterial(node.material));
        }
        node.material = matMap.get(node.material);
      }
    }
  });

  return clone;
}

/**
 * Creates a playable, steerable 3D instance of any of the Cosmo 3D cars.
 * Scaled to 1:87 HO micro-scale (~21mm length) and normalized so wheel contact sits at Y=0.
 */
export async function createCosmoCarInstance(carId = 'coupe', customPaintHex = null) {
  const normId = normalizeCarId(carId);
  const gltf = await loadCosmoGlb(normId);

  // Outer assembly root in kart space (+Z forward, +Y up, -X right)
  const assemblyRoot = new THREE.Group();
  assemblyRoot.name = `CosmoCar_${normId}_Assembly`;

  const carScene = cloneCarHierarchy(gltf.scene);
  carScene.name = `CosmoCar_${normId}_Scene`;

  // Measure bounding box to compute scale and ground alignment
  const rawBox = new THREE.Box3().setFromObject(carScene);
  const rawSize = new THREE.Vector3();
  const rawCenter = new THREE.Vector3();
  rawBox.getSize(rawSize);
  rawBox.getCenter(rawCenter);

  const targetLength = 0.021;
  const scaleFactor = targetLength / Math.max(rawSize.z, 4.0);

  const modelContainer = new THREE.Group();
  modelContainer.name = `CosmoCar_${normId}_Container`;
  modelContainer.scale.setScalar(scaleFactor);

  modelContainer.position.set(
    -rawCenter.x * scaleFactor,
    -rawBox.min.y * scaleFactor,
    -rawCenter.z * scaleFactor
  );

  modelContainer.add(carScene);
  assemblyRoot.add(modelContainer);

  let bodyMesh = null;
  const wheelNodes = [];
  const frontWheels = [];
  const rearWheels = [];
  const materials = [];

  carScene.traverse((child) => {
    if (child.isMesh) {
      // Cast clean contact shadows onto turntable/track, but disable receiveShadow on 2cm sub-meshes
      // to eliminate shadow-map acne dark blotches on doors, roofs, and hoods.
      child.castShadow = true;
      child.receiveShadow = false;

      if (child.geometry && !child.geometry.attributes.normal) {
        child.geometry.computeVertexNormals();
      }

      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!materials.includes(m)) materials.push(m);
      }

      const name = (child.name || '').toLowerCase();
      const parentName = (child.parent?.name || '').toLowerCase();
      const isWheel =
        name.includes('wheel') ||
        name.includes('cylinder') ||
        parentName.includes('wheel');

      if (isWheel) {
        const wheelPivot = parentName.includes('wheel') ? child.parent : child;
        if (!wheelNodes.includes(wheelPivot)) {
          wheelNodes.push(wheelPivot);
        }
      } else if (!bodyMesh) {
        bodyMesh = child;
      }
    }
  });

  wheelNodes.forEach((w) => {
    w.rotation.order = 'YXZ';
    if (w.position.z >= 0) {
      frontWheels.push(w);
    } else {
      rearWheels.push(w);
    }
  });

  function setPaint(hex) {
    for (const m of materials) {
      const mName = (m.name || '').toLowerCase();
      if (mName.includes('metallic') || mName.includes('body')) {
        if (hex !== null && hex !== undefined) {
          m.color.set(hex);
        } else {
          m.color.set(0xffffff);
        }
      }
    }
  }

  if (customPaintHex) {
    setPaint(customPaintHex);
  }

  let wheelRotX = 0;
  const wheelRadius = 0.40 * scaleFactor;

  function spinWheels(distDelta) {
    if (wheelNodes.length === 0 || Math.abs(distDelta) < 1e-6) return;
    const angleDelta = distDelta / wheelRadius;
    wheelRotX += angleDelta;
    for (let i = 0; i < wheelNodes.length; i++) {
      wheelNodes[i].rotation.x = wheelRotX;
    }
  }

  function steerFrontWheels(angleRad) {
    const clampedAngle = THREE.MathUtils.clamp(angleRad, -0.48, 0.48);
    for (let i = 0; i < frontWheels.length; i++) {
      frontWheels[i].rotation.y = clampedAngle;
    }
  }

  return {
    carId: normId,
    assemblyRoot,
    modelContainer,
    bodyMesh,
    wheelNodes,
    frontWheels,
    rearWheels,
    spinWheels,
    steerFrontWheels,
    setPaint,
    scaleFactor,
    dispose() {
      assemblyRoot.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });
    },
  };
}

/**
 * Fast startup preload: loads ONLY the player's equipped car and the 3 rival cars
 * so initial boot is snappy with zero multi-megabyte parse stalls.
 */
export function preloadCoreCosmoCars(equippedCarId = 'coupe') {
  const coreIds = Array.from(
    new Set([normalizeCarId(equippedCarId), 'police', 'kamaro', 'ghini'])
  );
  return Promise.all(
    coreIds.map((id) =>
      loadCosmoGlb(id).catch((err) => {
        console.warn(`Preload ${id} error:`, err);
      })
    )
  );
}

/**
 * Staggered background preload of remaining Garage cars so scrolling in the Garage
 * is smooth without blocking app startup.
 */
let lazyStarted = false;
export function preloadAllCosmoCars() {
  if (lazyStarted) return Promise.resolve();
  lazyStarted = true;

  const remaining = BODY_KITS.map((k) => normalizeCarId(k.id)).filter(
    (id, idx, arr) => arr.indexOf(id) === idx && !rawGlbCache.has(id)
  );

  return (async () => {
    for (const id of remaining) {
      await loadCosmoGlb(id).catch(() => {});
      await new Promise((r) => setTimeout(r, 90));
    }
  })();
}
