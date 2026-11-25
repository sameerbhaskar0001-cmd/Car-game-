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
 * with strong environment mapping so cars vividly reflect world, neon city, and garage lights.
 */
function upgradeCosmoMaterial(srcMat, normId = 'coupe') {
  const mName = (srcMat.name || '').toLowerCase();

  if (mName.includes('metallic') || mName.includes('body')) {
    // Starter 'coupe' has a very dark charcoal texture in coupe.glb that looks pitch-black in gameplay;
    // give it a vivid Asphalt-9 Candy Crimson Metallic Clearcoat finish by default while preserving
    // textured liveries on police/rally/etc. unless custom paint is applied.
    const isStarterCoupe = normId === 'coupe' || normId === 's64';
    const mat = new THREE.MeshPhysicalMaterial({
      name: srcMat.name,
      color: isStarterCoupe
        ? new THREE.Color(0xef1a2d)
        : srcMat.color
          ? srcMat.color.clone()
          : new THREE.Color(0xffffff),
      map: isStarterCoupe ? null : srcMat.map || null,
      normalMap: srcMat.normalMap || null,
      roughnessMap: srcMat.roughnessMap || null,
      metalnessMap: srcMat.metalnessMap || null,
      side: srcMat.side ?? THREE.FrontSide,
      metalness: 0.45,
      roughness: 0.22,
      clearcoat: 0.82,
      clearcoatRoughness: 0.12,
      reflectivity: 0.85,
      envMapIntensity: 0.92,
    });
    mat.userData.origMap = srcMat.map || null;
    mat.userData.isStarterCoupe = isStarterCoupe;
    return mat;
  }

  if (mName.includes('glass')) {
    return new THREE.MeshPhysicalMaterial({
      name: srcMat.name,
      color: new THREE.Color(0x050b18),
      map: null,
      side: srcMat.side ?? THREE.FrontSide,
      metalness: 0.22,
      roughness: 0.06,
      clearcoat: 0.85,
      clearcoatRoughness: 0.08,
      reflectivity: 0.9,
      envMapIntensity: 1.05,
    });
  }

  if (mName.includes('light')) {
    return new THREE.MeshStandardMaterial({
      name: srcMat.name,
      color: new THREE.Color(0xff1e2e),
      map: srcMat.map || null,
      emissive: new THREE.Color(0xff0a1e),
      emissiveMap: srcMat.map || null,
      emissiveIntensity: 1.35,
      roughness: 0.12,
      metalness: 0.12,
      toneMapped: true,
    });
  }

  // Wheel rims, tires & carbon trim with crisp metallic environment reflections
  return new THREE.MeshStandardMaterial({
    name: srcMat.name,
    color: srcMat.color ? srcMat.color.clone() : new THREE.Color(0xffffff),
    map: srcMat.map || null,
    normalMap: srcMat.normalMap || null,
    roughnessMap: srcMat.roughnessMap || null,
    metalnessMap: srcMat.metalnessMap || null,
    side: srcMat.side ?? THREE.FrontSide,
    metalness: 0.36,
    roughness: 0.38,
    envMapIntensity: 0.95,
  });
}

/**
 * Deep clones an Object3D hierarchy with upgraded unique PBR materials so that
 * instances (player and rivals) don't bleed custom colors into each other.
 */
function cloneCarHierarchy(source, normId = 'coupe') {
  const clone = source.clone(true);
  const matMap = new Map();

  clone.traverse((node) => {
    node.visible = true;
    node.userData.isCosmoCarMesh = true;
    if (node.isMesh && node.material) {
      if (Array.isArray(node.material)) {
        node.material = node.material.map((m) => {
          if (!matMap.has(m)) matMap.set(m, upgradeCosmoMaterial(m, normId));
          return matMap.get(m);
        });
      } else {
        if (!matMap.has(node.material)) {
          matMap.set(node.material, upgradeCosmoMaterial(node.material, normId));
        }
        node.material = matMap.get(node.material);
      }
    }
  });

  return clone;
}

/**
 * Builds a clean stylized coupe placeholder hierarchy with 4 separate wheel meshes
 * if an external GLTF asset fails to load.
 */
function buildPlaceholderCarScene() {
  const scene = new THREE.Group();
  const bodyRoot = new THREE.Mesh(
    new THREE.BoxGeometry(1.75, 0.72, 4.10),
    new THREE.MeshStandardMaterial({
      name: 'metallic',
      color: 0x38bdf8,
      metalness: 0.38,
      roughness: 0.20,
      envMapIntensity: 1.35,
    })
  );
  bodyRoot.name = 'placeholder_coupe';
  bodyRoot.position.set(0, 0.62, 0);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({
    name: 'texture',
    color: 0x1e293b,
    metalness: 0.35,
    roughness: 0.55,
  });

  const wheelOffsets = [
    ['wheels.FL', -0.86, -0.30, 1.32],
    ['wheels.FR', 0.86, -0.30, 1.32],
    ['wheels.RL', -0.86, -0.30, -1.28],
    ['wheels.RR', 0.86, -0.30, -1.28],
  ];
  for (const [wName, wx, wy, wz] of wheelOffsets) {
    const wMesh = new THREE.Mesh(wheelGeo, wheelMat);
    wMesh.name = wName;
    wMesh.position.set(wx, wy, wz);
    bodyRoot.add(wMesh);
  }
  scene.add(bodyRoot);
  return scene;
}

/**
 * Creates a playable, steerable 3D instance of any of the Cosmo 3D cars.
 * Scaled to 1:87 HO micro-scale (~21mm length) and normalized so wheel contact sits at Y=0.
 */
export async function createCosmoCarInstance(carId = 'coupe', customPaintHex = null) {
  const normId = normalizeCarId(carId);
  let gltfSceneSource = null;
  try {
    const gltf = await loadCosmoGlb(normId);
    gltfSceneSource = gltf.scene;
  } catch (err) {
    console.warn('Using placeholder car scene fallback:', err);
    gltfSceneSource = buildPlaceholderCarScene();
  }

  // Outer assembly root in kart space (+Z forward, +Y up, -X right)
  const assemblyRoot = new THREE.Group();
  assemblyRoot.name = `CosmoCar_${normId}_Assembly`;

  const carScene = cloneCarHierarchy(gltfSceneSource, normId);
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
  const lightMaterials = [];

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
        const mName = (m?.name || '').toLowerCase();
        if (mName.includes('light') && !lightMaterials.includes(m)) {
          lightMaterials.push(m);
        }
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

  // Sort & classify the 4 extracted wheel meshes into front (steerable + spinning) and rear (spinning)
  let avgZ = 0;
  if (wheelNodes.length > 0) {
    for (let i = 0; i < wheelNodes.length; i++) {
      avgZ += wheelNodes[i].position.z;
    }
    avgZ /= wheelNodes.length;
  }

  let measuredWheelRadiusLocal = 0.25;
  wheelNodes.forEach((w) => {
    w.rotation.order = 'YXZ';
    if (w.geometry) {
      if (!w.geometry.boundingBox) w.geometry.computeBoundingBox();
      if (w.geometry.boundingBox) {
        const h = w.geometry.boundingBox.max.y - w.geometry.boundingBox.min.y;
        if (h > 0.08 && h < 1.5) {
          measuredWheelRadiusLocal = h * 0.5;
        }
      }
    }
    if (w.position.z >= avgZ) {
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
          m.map = null;
          m.color.set(hex);
          m.needsUpdate = true;
        } else if (m.userData?.isStarterCoupe) {
          m.map = null;
          m.color.setHex(0xef1a2d);
          m.needsUpdate = true;
        } else {
          m.map = m.userData?.origMap || null;
          m.color.set(0xffffff);
          m.needsUpdate = true;
        }
      }
    }
  }

  function setBraking(isBraking) {
    const targetEmissive = isBraking ? 2.6 : 1.35;
    for (let i = 0; i < lightMaterials.length; i++) {
      const lm = lightMaterials[i];
      lm.emissiveIntensity = targetEmissive;
    }
  }

  if (customPaintHex) {
    setPaint(customPaintHex);
  }

  let wheelRotX = 0;
  let currentSteerY = 0;
  const wheelRadius = Math.max(0.0008, measuredWheelRadiusLocal * scaleFactor);

  function spinWheels(distDelta) {
    if (wheelNodes.length === 0 || Math.abs(distDelta) < 1e-7) return;
    const angleDelta = distDelta / wheelRadius;
    wheelRotX = (wheelRotX + angleDelta) % (Math.PI * 200);
    for (let i = 0; i < wheelNodes.length; i++) {
      wheelNodes[i].rotation.x = wheelRotX;
    }
  }

  function steerFrontWheels(angleRad) {
    const clampedAngle = THREE.MathUtils.clamp(angleRad, -0.52, 0.52);
    currentSteerY = THREE.MathUtils.lerp(currentSteerY, clampedAngle, 0.35);
    for (let i = 0; i < frontWheels.length; i++) {
      frontWheels[i].rotation.y = currentSteerY;
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
    setBraking,
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
