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
        // Fallback to coupe if specific car fails
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
 * Deep clones an Object3D hierarchy along with unique materials so that
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
          if (!matMap.has(m)) matMap.set(m, m.clone());
          return matMap.get(m);
        });
      } else {
        if (!matMap.has(node.material)) {
          matMap.set(node.material, node.material.clone());
        }
        node.material = matMap.get(node.material);
      }
    }
  });

  return clone;
}

/**
 * Creates a playable, steerable 3D instance of any of the 12 Cosmo low-poly cars.
 * Scaled to 1:87 HO micro-scale (~20mm length) and normalized so wheel contact sits at Y=0.
 */
export async function createCosmoCarInstance(carId = 'coupe', customPaintHex = null) {
  const normId = normalizeCarId(carId);
  const gltf = await loadCosmoGlb(normId);

  // Outer assembly root in kart space (+Z forward, +Y up, -X right)
  const assemblyRoot = new THREE.Group();
  assemblyRoot.name = `CosmoCar_${normId}_Assembly`;

  // Clone the GLTF scene
  const carScene = cloneCarHierarchy(gltf.scene);
  carScene.name = `CosmoCar_${normId}_Scene`;

  // Measure bounding box to compute scale and ground alignment
  const rawBox = new THREE.Box3().setFromObject(carScene);
  const rawSize = new THREE.Vector3();
  const rawCenter = new THREE.Vector3();
  rawBox.getSize(rawSize);
  rawBox.getCenter(rawCenter);

  // Standard HO micro-scale target length is 0.021m (21mm)
  const targetLength = 0.021;
  const scaleFactor = targetLength / Math.max(rawSize.z, 4.0);

  // Container to apply scale, centering, and ground offset
  const modelContainer = new THREE.Group();
  modelContainer.name = `CosmoCar_${normId}_Container`;
  modelContainer.scale.setScalar(scaleFactor);

  // Center horizontally & longitudinally, align lowest point (wheel bottom) to Y=0
  modelContainer.position.set(
    -rawCenter.x * scaleFactor,
    -rawBox.min.y * scaleFactor,
    -rawCenter.z * scaleFactor
  );

  modelContainer.add(carScene);
  assemblyRoot.add(modelContainer);

  // Identify wheels and body meshes
  let bodyMesh = null;
  const wheelNodes = [];
  const frontWheels = [];
  const rearWheels = [];
  const materials = [];

  carScene.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;

      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (!materials.includes(m)) materials.push(m);

        const mName = (m.name || '').toLowerCase();
        if (mName.includes('metallic') || mName.includes('body')) {
          m.metalness = 0.55;
          m.roughness = 0.18;
          m.envMapIntensity = 2.0;
        } else if (mName.includes('glass')) {
          m.metalness = 0.85;
          m.roughness = 0.04;
          m.envMapIntensity = 2.5;
        } else if (mName.includes('light')) {
          m.emissiveIntensity = 3.0;
          m.toneMapped = false;
        }
      }

      // Check if this is a wheel or the car body
      const name = (child.name || '').toLowerCase();
      const parentName = (child.parent?.name || '').toLowerCase();
      const isWheel =
        name.includes('wheel') ||
        name.includes('cylinder') ||
        parentName.includes('wheel');

      if (isWheel) {
        // Find the pivot node for this wheel (either the mesh itself or its parent)
        const wheelPivot = parentName.includes('wheel') ? child.parent : child;
        if (!wheelNodes.includes(wheelPivot)) {
          wheelNodes.push(wheelPivot);
        }
      } else if (!bodyMesh) {
        bodyMesh = child;
      }
    }
  });

  // Categorize front vs rear wheels based on Z coordinate
  // In our models, front wheels have positive Z relative to car center
  wheelNodes.forEach((w) => {
    w.rotation.order = 'YXZ';
    const worldPos = new THREE.Vector3();
    w.getWorldPosition(worldPos);
    // Compare relative to car center
    if (w.position.z >= 0) {
      frontWheels.push(w);
    } else {
      rearWheels.push(w);
    }
  });

  // Function to apply paint color
  function setPaint(hex) {
    for (const m of materials) {
      const mName = (m.name || '').toLowerCase();
      if (mName.includes('metallic') || mName.includes('body')) {
        if (hex !== null && hex !== undefined) {
          m.color.set(hex);
        } else {
          // Reset to native palette white tint
          m.color.set(0xffffff);
        }
      }
    }
  }

  if (customPaintHex) {
    setPaint(customPaintHex);
  }

  // Wheel rotation accumulator
  let wheelRotX = 0;
  // Estimated wheel radius in model units (~0.40m * scaleFactor)
  const wheelRadius = 0.40 * scaleFactor;

  /**
   * Rolls all wheels forward based on distance traveled in world units.
   */
  function spinWheels(distDelta) {
    if (wheelNodes.length === 0 || Math.abs(distDelta) < 1e-6) return;
    const angleDelta = distDelta / wheelRadius;
    wheelRotX += angleDelta;
    for (let i = 0; i < wheelNodes.length; i++) {
      wheelNodes[i].rotation.x = wheelRotX;
    }
  }

  /**
   * Steers the front wheels left/right.
   */
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
      // Do NOT dispose obj.geometry because BufferGeometries are shared across clones in rawGlbCache!
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
 * Preloads all 12 cars in parallel so switching in garage is instant.
 */
export function preloadAllCosmoCars() {
  return Promise.all(
    BODY_KITS.map((spec) =>
      loadCosmoGlb(spec.id).catch((err) => {
        console.warn(`Preload ${spec.id} error:`, err);
      })
    )
  );
}
