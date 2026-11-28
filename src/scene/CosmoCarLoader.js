import * as THREE from 'three';
import { BODY_KITS, normalizeCarId } from '../types/game';
import { getSharedGltfLoader } from './PbrAssetManager.js';
import {
  isSupercarId,
  loadSupercarGlb,
  createSupercarInstance,
} from './SupercarLoader.js';

const gltfLoader = getSharedGltfLoader();
const rawGlbCache = new Map();
const loadPromises = new Map();

/**
 * Loads a Cosmo or AAA Supercar GLB model with caching and Draco support.
 */
export function loadCosmoGlb(carId) {
  const normId = normalizeCarId(carId);
  if (isSupercarId(normId)) {
    return loadSupercarGlb(normId);
  }
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
        console.warn(`Failed to load ${url}, falling back to v12_goblin:`, err);
        if (normId !== 'v12_goblin') {
          loadCosmoGlb('v12_goblin').then(resolve).catch(reject);
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
      metalness: 0.65,
      roughness: 0.25,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      reflectivity: 0.92,
      envMapIntensity: 1.15,
    });
    mat.userData.origMap = srcMat.map || null;
    mat.userData.isStarterCoupe = isStarterCoupe;
    return mat;
  }

  if (mName.includes('glass')) {
    return new THREE.MeshPhysicalMaterial({
      name: srcMat.name,
      color: new THREE.Color(0x04070f),
      map: null,
      side: srcMat.side ?? THREE.FrontSide,
      metalness: 0.38,
      roughness: 0.04,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      reflectivity: 0.96,
      envMapIntensity: 1.35,
    });
  }

  if (mName.includes('light')) {
    // Default GLB light material to sleek glowing white/ice-blue LED for front headlights;
    // rear tail-light faces are dynamically split into a dedicated crimson rear-light material per mesh!
    return new THREE.MeshStandardMaterial({
      name: srcMat.name,
      color: new THREE.Color(0xe0f7ff),
      map: null,
      emissive: new THREE.Color(0x7dd3fc),
      emissiveIntensity: 2.1,
      roughness: 0.08,
      metalness: 0.15,
      toneMapped: false,
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
    metalness: 0.45,
    roughness: 0.34,
    envMapIntensity: 1.05,
  });
}

/**
 * Splits or assigns vertex-colored front (sleek white/ice-blue LED) vs rear (red LED lightbar)
 * lighting on any mesh that uses a 'light' material, so FRONT headlights are NEVER red!
 */
function configureFrontAndRearLightMesh(mesh, centerZ, rearTailLightMat) {
  if (!mesh || !mesh.geometry) return;
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const hasLightMat = mats.some((m) => (m?.name || '').toLowerCase().includes('light'));
  if (!hasLightMat) return;

  // Ensure unique cloned geometry so we can safely split or vertex-color front vs rear light faces
  const geo = mesh.geometry.clone();
  mesh.geometry = geo;
  const posAttr = geo.attributes.position;
  if (!posAttr) return;

  // Compute mesh local Z threshold relative to car center
  const invWorld = new THREE.Matrix4();
  mesh.updateMatrixWorld(true);
  invWorld.copy(mesh.matrixWorld).invert();

  if (Array.isArray(mesh.material) && geo.groups && geo.groups.length > 0) {
    // Multi-material mesh: check each group's triangles; if a group uses 'light', split it into
    // front headlights (white/ice-blue LED) vs rear taillights (red LED) based on triangle centroid Z!
    const newMats = mesh.material.slice();
    const rearMatIdx = newMats.length;
    newMats.push(rearTailLightMat);

    if (geo.index) {
      const idxArr = geo.index.array;
      const newGroups = [];
      const rebuiltIndices = [];

      for (const grp of geo.groups) {
        const grpMat = newMats[grp.materialIndex];
        const mName = (grpMat?.name || '').toLowerCase();
        if (!mName.includes('light')) {
          const start = rebuiltIndices.length;
          for (let k = 0; k < grp.count; k++) {
            rebuiltIndices.push(idxArr[grp.start + k]);
          }
          newGroups.push({ start, count: grp.count, materialIndex: grp.materialIndex });
        } else {
          const frontTris = [];
          const rearTris = [];
          for (let k = 0; k + 2 < grp.count; k += 3) {
            const i0 = idxArr[grp.start + k];
            const i1 = idxArr[grp.start + k + 1];
            const i2 = idxArr[grp.start + k + 2];
            const avgLocalZ = (posAttr.getZ(i0) + posAttr.getZ(i1) + posAttr.getZ(i2)) / 3.0;
            if (avgLocalZ >= centerZ) {
              frontTris.push(i0, i1, i2);
            } else {
              rearTris.push(i0, i1, i2);
            }
          }
          if (frontTris.length > 0) {
            const start = rebuiltIndices.length;
            rebuiltIndices.push(...frontTris);
            newGroups.push({ start, count: frontTris.length, materialIndex: grp.materialIndex });
          }
          if (rearTris.length > 0) {
            const start = rebuiltIndices.length;
            rebuiltIndices.push(...rearTris);
            newGroups.push({ start, count: rearTris.length, materialIndex: rearMatIdx });
          }
        }
      }
      geo.setIndex(rebuiltIndices);
      geo.clearGroups();
      for (const g of newGroups) {
        geo.addGroup(g.start, g.count, g.materialIndex);
      }
      mesh.material = newMats;
    }
  } else {
    // Single-material 'light' mesh: check if its bounding box sits in the rear half
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    if (bb) {
      const midZ = (bb.min.z + bb.max.z) * 0.5;
      if (midZ < centerZ) {
        mesh.material = rearTailLightMat;
      }
    }
  }
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
    new THREE.BoxGeometry(1.88, 0.62, 4.16),
    new THREE.MeshPhysicalMaterial({
      name: 'metallic',
      color: 0x38bdf8,
      metalness: 0.65,
      roughness: 0.25,
      clearcoat: 1.0,
      clearcoatRoughness: 0.12,
      envMapIntensity: 1.25,
    })
  );
  bodyRoot.name = 'placeholder_coupe';
  bodyRoot.position.set(0, 0.54, 0);

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.26, 18);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheelMat = new THREE.MeshStandardMaterial({
    name: 'texture',
    color: 0x1e293b,
    metalness: 0.45,
    roughness: 0.48,
  });

  const wheelOffsets = [
    ['wheels.FL', -0.94, -0.24, 1.32],
    ['wheels.FR', 0.94, -0.24, 1.32],
    ['wheels.RL', -0.94, -0.24, -1.28],
    ['wheels.RR', 0.94, -0.24, -1.28],
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
 * Scaled to 1:87 HO micro-scale (~21mm length) with a lowered, wider sports coupe stance
 * and normalized so wheel contact sits flush at Y=0.
 */
export async function createCosmoCarInstance(carId = 'ferrari', customPaintHex = null) {
  const normId = normalizeCarId(carId);
  if (isSupercarId(normId)) {
    return createSupercarInstance(normId, customPaintHex);
  }
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

  const targetLength = 0.0214;
  const scaleFactor = targetLength / Math.max(rawSize.z, 4.0);

  // Lower chassis stance (-14% height) and widen track (+14% width) so the silhouette looks
  // like a sleek, aggressive widebody sports coupe instead of a tall narrow box.
  const scaleX = scaleFactor * 1.14;
  const scaleY = scaleFactor * 0.86;
  const scaleZ = scaleFactor * 1.02;

  const modelContainer = new THREE.Group();
  modelContainer.name = `CosmoCar_${normId}_Container`;
  modelContainer.scale.set(scaleX, scaleY, scaleZ);

  modelContainer.position.set(
    -rawCenter.x * scaleX,
    -rawBox.min.y * scaleY,
    -rawCenter.z * scaleZ
  );

  modelContainer.add(carScene);
  assemblyRoot.add(modelContainer);

  // Dedicated crimson rear tail-light material (strictly for REAR lights — never front!)
  const rearTailLightMat = new THREE.MeshStandardMaterial({
    name: 'Cosmo_RearTailLight_LED',
    color: new THREE.Color(0xff1024),
    emissive: new THREE.Color(0xff0518),
    emissiveIntensity: 1.55,
    roughness: 0.1,
    metalness: 0.12,
    toneMapped: false,
  });

  let bodyMesh = null;
  const wheelNodes = [];
  const frontWheels = [];
  const rearWheels = [];
  const materials = [];
  const rearBrakeMaterials = [rearTailLightMat];

  carScene.traverse((child) => {
    if (child.isMesh) {
      // Cast clean contact shadows onto turntable/track, but disable receiveShadow on 2cm sub-meshes
      // to eliminate shadow-map acne dark blotches on doors, roofs, and hoods.
      child.castShadow = true;
      child.receiveShadow = false;

      if (child.geometry && !child.geometry.attributes.normal) {
        child.geometry.computeVertexNormals();
      }

      // Split any shared 'light' material so front headlights are glowing white/ice-blue LED
      // and rear lights are crimson red LED!
      configureFrontAndRearLightMesh(child, rawCenter.z, rearTailLightMat);

      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const m of mats) {
        if (m && !materials.includes(m)) materials.push(m);
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

  // Lower body shell stance slightly relative to the wheel axles and push wheels slightly outward
  // for a planted, wide-track sports coupe stance.
  if (bodyMesh && wheelNodes.length > 0 && bodyMesh.children.includes(wheelNodes[0])) {
    bodyMesh.position.y -= 0.045;
    for (let i = 0; i < wheelNodes.length; i++) {
      wheelNodes[i].position.y += 0.045;
      wheelNodes[i].position.x *= 1.07;
    }
  } else {
    for (let i = 0; i < wheelNodes.length; i++) {
      wheelNodes[i].position.x *= 1.07;
    }
  }

  // Attach sleek flush front white/ice-blue LED strips and rear red LED lightbar
  // so front vs rear lighting is 100% unmistakable from every camera angle.
  const frontLedMat = new THREE.MeshStandardMaterial({
    name: 'Cosmo_FrontHeadlight_LED',
    color: new THREE.Color(0xe0f7ff),
    emissive: new THREE.Color(0xbae6fd),
    emissiveIntensity: 2.35,
    roughness: 0.06,
    metalness: 0.1,
    toneMapped: false,
  });
  materials.push(frontLedMat, rearTailLightMat);

  const halfCarW = Math.max(0.75, rawSize.x * 0.44);
  const frontZ = rawBox.max.z - 0.05;
  const rearZ = rawBox.min.z + 0.05;
  const headlampY = rawBox.min.y + rawSize.y * 0.42;
  const taillampY = rawBox.min.y + rawSize.y * 0.48;

  const frontStripGeo = new THREE.BoxGeometry(halfCarW * 0.42, 0.065, 0.09);
  for (const side of [-1, 1]) {
    const fStrip = new THREE.Mesh(frontStripGeo, frontLedMat);
    fStrip.position.set(rawCenter.x + side * (halfCarW * 0.58), headlampY, frontZ);
    fStrip.rotation.y = side * -0.14;
    carScene.add(fStrip);
  }

  const rearBarGeo = new THREE.BoxGeometry(halfCarW * 1.48, 0.075, 0.08);
  const rearBarMesh = new THREE.Mesh(rearBarGeo, rearTailLightMat);
  rearBarMesh.position.set(rawCenter.x, taillampY, rearZ);
  carScene.add(rearBarMesh);

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
    const targetEmissive = isBraking ? 2.85 : 1.55;
    for (let i = 0; i < rearBrakeMaterials.length; i++) {
      const lm = rearBrakeMaterials[i];
      lm.emissiveIntensity = targetEmissive;
    }
  }

  if (customPaintHex) {
    setPaint(customPaintHex);
  }

  let wheelRotX = 0;
  let currentSteerY = 0;
  const wheelRadius = Math.max(0.0008, measuredWheelRadiusLocal * scaleY);

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
export function preloadCoreCosmoCars(equippedCarId = 'v12_goblin') {
  const coreIds = Array.from(
    new Set([normalizeCarId(equippedCarId), 'v12_goblin', 'apex_g82', 'razor_f82'])
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
