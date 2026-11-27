import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/**
 * Real 360° Photographic HDRI Environment Manager (Poly Haven CC0).
 * Bakes 1K .hdr files into compact GPU PMREM cubemaps and immediately disposes
 * raw equirectangular float buffers so mobile WebGL VRAM stays lean and crash-free.
 */
const HDRI_URLS = {
  coast: '/assets/hdri/coast.hdr',
  city: '/assets/hdri/city.hdr',
  canyon: '/assets/hdri/canyon.hdr',
};

const BASE_ENV_INTENSITY = {
  coast: 1.05,
  city: 1.18,
  canyon: 1.02,
};

export function createHdriEnvironmentManager(renderer, scene, fallbackEnvTex = null) {
  let pmremGenerator = new THREE.PMREMGenerator(renderer);
  pmremGenerator.compileEquirectangularShader();

  const rgbeLoader = new RGBELoader();
  // Keep HDRI in HalfFloatType for 50% lower VRAM bandwidth on mobile GPUs
  rgbeLoader.setDataType(THREE.HalfFloatType);

  const pmremCache = new Map();
  const inflight = new Map();
  let activeMapId = null;
  let activeWeather = 'sunny';
  let disposed = false;

  function computeIntensity(mapId, weather) {
    const base = BASE_ENV_INTENSITY[mapId] ?? 1.05;
    if (weather === 'rain') return base * 0.94;
    if (weather === 'night') return base * 0.88;
    if (weather === 'fog') return base * 0.84;
    return base;
  }

  function applyCachedEnv(mapId) {
    const rt = pmremCache.get(mapId);
    if (rt && rt.texture) {
      scene.environment = rt.texture;
      scene.environmentIntensity = computeIntensity(mapId, activeWeather);
      return true;
    }
    return false;
  }

  function loadMapHdri(mapId) {
    const safeId = HDRI_URLS[mapId] ? mapId : 'coast';
    if (pmremCache.has(safeId)) {
      return Promise.resolve(pmremCache.get(safeId));
    }
    if (inflight.has(safeId)) {
      return inflight.get(safeId);
    }

    const url = HDRI_URLS[safeId];
    const promise = new Promise((resolve) => {
      rgbeLoader.load(
        url,
        (rawEquirect) => {
          if (disposed) {
            rawEquirect.dispose();
            resolve(null);
            return;
          }
          try {
            rawEquirect.mapping = THREE.EquirectangularReflectionMapping;
            const pmremRT = pmremGenerator.fromEquirectangular(rawEquirect);
            // Immediately free the large raw float equirectangular texture from VRAM!
            rawEquirect.dispose();
            pmremCache.set(safeId, pmremRT);

            if (activeMapId === safeId) {
              applyCachedEnv(safeId);
            }
            resolve(pmremRT);
          } catch (err) {
            console.warn(`[HDRI] PMREM bake failed for ${safeId}:`, err);
            rawEquirect.dispose();
            resolve(null);
          }
        },
        undefined,
        (err) => {
          console.warn(`[HDRI] Failed loading ${url}, keeping fallback environment:`, err);
          if (fallbackEnvTex && activeMapId === safeId && !scene.environment) {
            scene.environment = fallbackEnvTex;
          }
          resolve(null);
        }
      );
    }).finally(() => {
      inflight.delete(safeId);
    });

    inflight.set(safeId, promise);
    return promise;
  }

  function setMapAndWeather(mapId, weather = 'sunny') {
    const safeId = HDRI_URLS[mapId] ? mapId : 'coast';
    activeMapId = safeId;
    activeWeather = weather;

    if (!applyCachedEnv(safeId)) {
      if (fallbackEnvTex && !scene.environment) {
        scene.environment = fallbackEnvTex;
      }
      scene.environmentIntensity = computeIntensity(safeId, weather);
      loadMapHdri(safeId);
    }
  }

  function setShowroomBoost(isShowroom) {
    const base = computeIntensity(activeMapId || 'coast', activeWeather);
    scene.environmentIntensity = isShowroom ? Math.min(1.38, base * 1.18) : base;
  }

  function handleContextRestored() {
    for (const rt of pmremCache.values()) {
      rt?.dispose?.();
    }
    pmremCache.clear();
    inflight.clear();
    try {
      pmremGenerator.dispose();
    } catch {
      // ignore old context disposal errors
    }
    pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    if (activeMapId) {
      loadMapHdri(activeMapId);
    }
  }

  function dispose() {
    disposed = true;
    for (const rt of pmremCache.values()) {
      rt?.dispose?.();
    }
    pmremCache.clear();
    inflight.clear();
    try {
      pmremGenerator.dispose();
    } catch {
      // ignore
    }
  }

  return {
    setMapAndWeather,
    setShowroomBoost,
    preloadMapHdri: loadMapHdri,
    handleContextRestored,
    dispose,
  };
}
