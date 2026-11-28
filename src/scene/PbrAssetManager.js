import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';

/**
 * Shared AAA Asset Manager:
 * - Single shared DRACOLoader + GLTFLoader instance (zero duplicate WASM memory)
 * - Poly Haven CC0 1K Photoscanned PBR texture packs (Albedo + Normal GL + ARM)
 * - Poly Haven CC0 Photogrammetry 3D environment prop templates for single-draw-call InstancedMesh
 */

let sharedDracoLoader = null;
let sharedGltfLoader = null;

export function getSharedDracoLoader() {
  if (!sharedDracoLoader) {
    sharedDracoLoader = new DRACOLoader();
    sharedDracoLoader.setDecoderPath('/draco/gltf/');
    sharedDracoLoader.preload();
  }
  return sharedDracoLoader;
}

export function getSharedGltfLoader() {
  if (!sharedGltfLoader) {
    sharedGltfLoader = new GLTFLoader();
    sharedGltfLoader.setDRACOLoader(getSharedDracoLoader());
  }
  return sharedGltfLoader;
}

const textureLoader = new THREE.TextureLoader();
const pbrSetCache = new Map();
const envModelCache = new Map();
const envModelPromises = new Map();

let maxAnisotropyCap = 8;

export function configurePbrAnisotropy(maxAniso) {
  maxAnisotropyCap = Math.max(1, Math.min(8, Number(maxAniso) || 4));
}

function loadTiledTexture(url, isColor, repeatX, repeatY) {
  const tex = textureLoader.load(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = isColor ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = maxAnisotropyCap;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

/**
 * Returns a cached Poly Haven 1K PBR texture set: { map, normalMap, armMap }
 * armMap packs: R = Ambient Occlusion, G = Roughness, B = Metalness.
 */
export function getPhotoscannedPbrSet(setName, repeatX = 1, repeatY = 1) {
  const cacheKey = `${setName}:${repeatX.toFixed(2)}x${repeatY.toFixed(2)}`;
  if (pbrSetCache.has(cacheKey)) {
    return pbrSetCache.get(cacheKey);
  }

  const base = `/assets/pbr/${setName}`;
  const set = {
    map: loadTiledTexture(`${base}/diff.jpg`, true, repeatX, repeatY),
    normalMap: loadTiledTexture(`${base}/nor_gl.jpg`, false, repeatX, repeatY),
    armMap: loadTiledTexture(`${base}/arm.jpg`, false, repeatX, repeatY),
  };
  pbrSetCache.set(cacheKey, set);
  return set;
}

/**
 * Returns the photoscanned road PBR pack matching each circuit biome.
 */
export function getRoadPbrPackForMap(mapId) {
  if (mapId === 'city') {
    return getPhotoscannedPbrSet('asphalt_pit_lane', 1.6, 56.0);
  }
  if (mapId === 'canyon' || mapId === 'desert') {
    return getPhotoscannedPbrSet('asphalt_snow', 1.6, 56.0);
  }
  return getPhotoscannedPbrSet('asphalt_track', 1.6, 56.0);
}

/**
 * Returns the photoscanned cliff/rock PBR pack for terrain escarpments.
 */
export function getCliffPbrPack() {
  return getPhotoscannedPbrSet('cliff_side', 3.0, 3.0);
}

const ENV_MODEL_URLS = {
  boulder_01: '/models/env/boulder_01/boulder_01.gltf',
  concrete_road_barrier: '/models/env/concrete_road_barrier/concrete_road_barrier.gltf',
  canyon_cliff_01: '/models/env/canyon_cliff_01.glb',
  rock_face_01: '/models/env/rock_face_01.glb',
  desert_tree_01: '/models/env/desert_tree_01.glb',
  street_lamp_01: '/models/env/street_lamp_01.glb',
  forest_tree_01: '/models/env/forest_tree_01.glb',
  forest_trees_scene: '/models/env/forest_trees_scene.glb',
  snowy_mountain_scene: '/models/env/snowy_mountain_scene.glb',
  drift_race_track: '/models/env/drift_race_track.glb',
};

const multiPartPropCache = new Map();
const multiPartPropPromises = new Map();
const sceneGlbCache = new Map();
const sceneGlbPromises = new Map();

function upgradeEnvMaterial(rawMat) {
  const mat = rawMat ? rawMat.clone() : new THREE.MeshStandardMaterial({ color: 0x7a808a });
  mat.envMapIntensity = 0.9;
  if (mat.map) {
    mat.map.colorSpace = THREE.SRGBColorSpace;
    mat.map.anisotropy = maxAnisotropyCap;
  }
  const mName = String(mat.name || '').toLowerCase();
  if (
    mName.includes('leaf') ||
    mName.includes('leaves') ||
    mName.includes('tree') ||
    mName.includes('foliage') ||
    mat.transparent
  ) {
    mat.alphaTest = Math.max(mat.alphaTest || 0, 0.32);
    mat.transparent = false;
    mat.depthWrite = true;
    mat.side = THREE.DoubleSide;
  }
  mat.needsUpdate = true;
  return mat;
}

/**
 * Loads a Poly Haven photogrammetry GLTF/GLB prop and extracts its primary normalized
 * { geometry, material, size } ready for single-draw-call THREE.InstancedMesh rendering.
 */
export function loadPhotogrammetryPropTemplate(propId) {
  if (envModelCache.has(propId)) {
    return Promise.resolve(envModelCache.get(propId));
  }
  if (envModelPromises.has(propId)) {
    return envModelPromises.get(propId);
  }

  const url = ENV_MODEL_URLS[propId];
  if (!url) {
    return Promise.resolve(null);
  }

  const loader = getSharedGltfLoader();
  const promise = new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        let primaryMesh = null;
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((obj) => {
          if (!primaryMesh && obj.isMesh && obj.geometry) {
            primaryMesh = obj;
          }
        });
        if (!primaryMesh) {
          resolve(null);
          return;
        }

        const geo = primaryMesh.geometry.clone();
        geo.applyMatrix4(primaryMesh.matrixWorld);
        geo.computeBoundingBox();
        const box = geo.boundingBox;
        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        box.getSize(size);
        box.getCenter(center);

        // Ground pivot at bottom-center (x=0, y=0, z=0) and normalize longest horizontal span to 1.0
        const maxHoriz = Math.max(0.001, size.x, size.z);
        geo.translate(-center.x, -box.min.y, -center.z);
        geo.scale(1 / maxHoriz, 1 / maxHoriz, 1 / maxHoriz);
        geo.computeBoundingBox();
        geo.computeBoundingSphere();

        const rawMat = Array.isArray(primaryMesh.material)
          ? primaryMesh.material[0]
          : primaryMesh.material;
        const mat = upgradeEnvMaterial(rawMat);

        const template = {
          propId,
          geometry: geo,
          material: mat,
          aspectY: size.y / maxHoriz,
        };
        envModelCache.set(propId, template);
        resolve(template);
      },
      undefined,
      (err) => {
        console.warn(`[PBR] Failed loading photogrammetry prop ${propId}:`, err);
        resolve(null);
      }
    );
  }).finally(() => {
    envModelPromises.delete(propId);
  });

  envModelPromises.set(propId, promise);
  return promise;
}

/**
 * Loads a multi-part 3D GLB prop (e.g. `forest_tree_01` with separate Bark + Leaves meshes,
 * or `desert_tree_01`, `street_lamp_01`, `canyon_cliff_01`, `rock_face_01`) and normalizes all parts
 * around a shared bottom-center pivot (0,0,0) with unit height (1.0).
 */
export function loadMultiPartPropTemplate(propId) {
  if (multiPartPropCache.has(propId)) {
    return Promise.resolve(multiPartPropCache.get(propId));
  }
  if (multiPartPropPromises.has(propId)) {
    return multiPartPropPromises.get(propId);
  }

  const url = ENV_MODEL_URLS[propId];
  if (!url) {
    return Promise.resolve(null);
  }

  const loader = getSharedGltfLoader();
  const promise = new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        const rawParts = [];
        const totalBox = new THREE.Box3();

        gltf.scene.traverse((obj) => {
          if (obj.isMesh && obj.geometry) {
            const geo = obj.geometry.clone();
            geo.applyMatrix4(obj.matrixWorld);
            geo.computeBoundingBox();
            totalBox.union(geo.boundingBox);
            const rawMat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
            rawParts.push({ geometry: geo, material: upgradeEnvMaterial(rawMat) });
          }
        });

        if (rawParts.length === 0 || totalBox.isEmpty()) {
          resolve(null);
          return;
        }

        const size = new THREE.Vector3();
        const center = new THREE.Vector3();
        totalBox.getSize(size);
        totalBox.getCenter(center);
        const normSpan = Math.max(0.001, size.y, size.x, size.z);

        for (const part of rawParts) {
          part.geometry.translate(-center.x, -totalBox.min.y, -center.z);
          part.geometry.scale(1 / normSpan, 1 / normSpan, 1 / normSpan);
          part.geometry.computeBoundingBox();
          part.geometry.computeBoundingSphere();
        }

        const tpl = {
          propId,
          parts: rawParts,
          size,
          normSpan,
        };
        multiPartPropCache.set(propId, tpl);
        resolve(tpl);
      },
      undefined,
      (err) => {
        console.warn(`[PBR] Failed loading multi-part prop ${propId}:`, err);
        resolve(null);
      }
    );
  }).finally(() => {
    multiPartPropPromises.delete(propId);
  });

  multiPartPropPromises.set(propId, promise);
  return promise;
}

/**
 * Loads a complete 3D environment scene GLB (`snowy_mountain_scene`, `forest_trees_scene`, `drift_race_track`)
 * and returns a cached root Group whose materials are upgraded for PBR + alpha-cutout rendering.
 */
export function loadEnvironmentSceneGlb(sceneId) {
  if (sceneGlbCache.has(sceneId)) {
    return Promise.resolve(sceneGlbCache.get(sceneId));
  }
  if (sceneGlbPromises.has(sceneId)) {
    return sceneGlbPromises.get(sceneId);
  }

  const url = ENV_MODEL_URLS[sceneId];
  if (!url) {
    return Promise.resolve(null);
  }

  const loader = getSharedGltfLoader();
  const promise = new Promise((resolve) => {
    loader.load(
      url,
      (gltf) => {
        gltf.scene.updateMatrixWorld(true);
        gltf.scene.traverse((obj) => {
          if (obj.isMesh) {
            const rawMat = Array.isArray(obj.material) ? obj.material[0] : obj.material;
            obj.material = upgradeEnvMaterial(rawMat);
            obj.castShadow = false;
            obj.receiveShadow = true;
          }
        });
        sceneGlbCache.set(sceneId, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      (err) => {
        console.warn(`[PBR] Failed loading environment scene ${sceneId}:`, err);
        resolve(null);
      }
    );
  }).finally(() => {
    sceneGlbPromises.delete(sceneId);
  });

  sceneGlbPromises.set(sceneId, promise);
  return promise;
}
