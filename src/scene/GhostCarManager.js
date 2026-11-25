import * as THREE from 'three';
import { createCosmoCarInstance } from './CosmoCarLoader.js';

const STORAGE_GHOST_PREFIX = 'the_race_3d_ghost_pb_v1_';
const SAMPLE_INTERVAL_SEC = 0.1;
const MAX_LAP_SAMPLES = 900; // Up to 90 seconds per lap
const GHOST_CAR_SCALE = 0.49;

/**
 * Records the player's fastest lap per map in localStorage and renders a sleek
 * translucent holographic real-car Ghost along the track spline in Time Attack
 * (and optionally in Circuit mode). Zero per-frame GC allocations.
 */
export function createGhostCarManager(
  scene,
  initialSplineData,
  initialMapId = 'coast',
  initialCarId = 'coupe'
) {
  let samples = initialSplineData?.samples || [];
  let N = samples.length;
  let totalLength = initialSplineData?.total_length_m || 3.2825;
  let mapId = initialMapId || 'coast';
  let currentCarId = initialCarId || 'coupe';
  let enabled = true;

  // Recorded samples for the current active lap: flat array of [t, s, lat, hop, drift]
  let recordingSamples = [];
  let recordAccum = 0.0;
  let lastRecordedLap = 1;

  // Loaded Personal Best lap for current map: { bestLapSec: number, samples: number[][] } | null
  let pbData = null;

  // Pre-allocated scratch vectors/matrices for zero-GC updates
  const _p0 = new THREE.Vector3();
  const _p1 = new THREE.Vector3();
  const _r0 = new THREE.Vector3();
  const _r1 = new THREE.Vector3();
  const _n0 = new THREE.Vector3();
  const _n1 = new THREE.Vector3();
  const _t0 = new THREE.Vector3();
  const _t1 = new THREE.Vector3();
  const _left = new THREE.Vector3();
  const _rotMat = new THREE.Matrix4();
  const _baseQuat = new THREE.Quaternion();
  const _driftQuat = new THREE.Quaternion();
  const _frame = {
    pos: new THREE.Vector3(),
    right: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
  };
  const ghostWorldPos = new THREE.Vector3();

  // ---------------------------------------------------------------------------
  // REAL 3D SUPERCAR HOLOGRAPHIC GHOST MODEL (Loaded from cached .glb via CosmoCarLoader)
  // ---------------------------------------------------------------------------
  const ghostRoot = new THREE.Group();
  ghostRoot.name = 'PersonalBestGhostCar';
  ghostRoot.visible = false;

  const carMount = new THREE.Group();
  carMount.scale.setScalar(GHOST_CAR_SCALE);
  ghostRoot.add(carMount);

  // Reusable holographic PBR materials for crisp, unmistakable visibility in day & night
  const holoBodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    emissive: 0x06b6d4,
    emissiveIntensity: 1.05,
    roughness: 0.16,
    metalness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.64,
    depthWrite: true,
    side: THREE.FrontSide,
  });

  const holoGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x082f49,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.5,
    roughness: 0.08,
    metalness: 0.1,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.78,
    depthWrite: true,
  });

  const holoWheelMat = new THREE.MeshStandardMaterial({
    color: 0x0e7490,
    emissive: 0x22d3ee,
    emissiveIntensity: 0.55,
    roughness: 0.35,
    metalness: 0.3,
    transparent: true,
    opacity: 0.72,
    depthWrite: true,
  });

  const holoGlowLightMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  // Subtle holographic cyan rim ring beneath the car so it tracks cleanly at high speed
  const haloGeo = new THREE.RingGeometry(0.0026, 0.0033, 28);
  haloGeo.rotateX(-Math.PI / 2);
  haloGeo.scale(0.72, 1.0, 1.48);
  const haloMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  const haloMesh = new THREE.Mesh(haloGeo, haloMat);
  haloMesh.position.y = 0.00025;
  haloMesh.renderOrder = 14;
  ghostRoot.add(haloMesh);

  let activeCarInstance = null;
  let loadGeneration = 0;

  function applyHolographicStyle(rootObj) {
    rootObj.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
      child.renderOrder = 16;

      const meshName = (child.name || '').toLowerCase();
      const origMats = Array.isArray(child.material) ? child.material : [child.material];
      const primaryMatName = (origMats[0]?.name || '').toLowerCase();
      const combined = `${meshName} ${primaryMatName}`;

      if (
        combined.includes('glass') ||
        combined.includes('window') ||
        combined.includes('windshield') ||
        combined.includes('canopy') ||
        combined.includes('interior')
      ) {
        child.material = holoGlassMat;
      } else if (
        combined.includes('wheel') ||
        combined.includes('tire') ||
        combined.includes('tyre') ||
        combined.includes('rim') ||
        combined.includes('brake')
      ) {
        child.material = holoWheelMat;
      } else if (
        combined.includes('light') ||
        combined.includes('lamp') ||
        combined.includes('head') ||
        combined.includes('tail') ||
        combined.includes('emissive') ||
        combined.includes('glow')
      ) {
        child.material = holoGlowLightMat;
      } else {
        child.material = holoBodyMat;
      }
    });
  }

  function loadGhostCarMesh(carId) {
    const targetId = carId || 'coupe';
    currentCarId = targetId;
    const gen = ++loadGeneration;

    createCosmoCarInstance(targetId)
      .then((instance) => {
        if (gen !== loadGeneration) {
          if (instance && instance.dispose) instance.dispose();
          return;
        }
        if (activeCarInstance) {
          if (activeCarInstance.assemblyRoot && activeCarInstance.assemblyRoot.parent) {
            activeCarInstance.assemblyRoot.parent.remove(activeCarInstance.assemblyRoot);
          }
          if (activeCarInstance.dispose) activeCarInstance.dispose();
          activeCarInstance = null;
        }
        applyHolographicStyle(instance.assemblyRoot);
        carMount.add(instance.assemblyRoot);
        activeCarInstance = instance;
      })
      .catch(() => {
        // Retry with starter coupe if custom car model failed
        if (targetId !== 'coupe' && gen === loadGeneration) {
          loadGhostCarMesh('coupe');
        }
      });
  }

  function setCarId(nextCarId) {
    const normalized = nextCarId || 'coupe';
    if (normalized === currentCarId && activeCarInstance) return;
    loadGhostCarMesh(normalized);
  }

  scene.add(ghostRoot);
  loadGhostCarMesh(currentCarId);

  // ---------------------------------------------------------------------------
  // STORAGE HELPERS
  // ---------------------------------------------------------------------------
  function getStorageKey(targetMapId) {
    return `${STORAGE_GHOST_PREFIX}${targetMapId || 'coast'}`;
  }

  function loadPersonalBest(targetMapId) {
    pbData = null;
    try {
      const raw = window.localStorage.getItem(getStorageKey(targetMapId));
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (
        parsed &&
        typeof parsed.bestLapSec === 'number' &&
        parsed.bestLapSec > 3.0 &&
        Array.isArray(parsed.samples) &&
        parsed.samples.length >= 6
      ) {
        pbData = parsed;
      }
    } catch {
      pbData = null;
    }
  }

  function savePersonalBest(targetMapId, bestLapSec, lapSamples) {
    if (!Array.isArray(lapSamples) || lapSamples.length < 6) return false;
    const compact = lapSamples.map((pt) => [
      Number(pt[0].toFixed(2)),
      Number(pt[1].toFixed(4)),
      Number(pt[2].toFixed(4)),
      Number(pt[3].toFixed(4)),
      Number(pt[4].toFixed(3)),
    ]);
    const payload = {
      bestLapSec: Number(bestLapSec.toFixed(3)),
      samples: compact,
    };
    pbData = payload;
    try {
      window.localStorage.setItem(getStorageKey(targetMapId), JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }

  function samplePoint(sVal, out = _frame) {
    if (N === 0) return out;
    const wrappedS = ((sVal % totalLength) + totalLength) % totalLength;
    let lo = 0;
    let hi = N - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (samples[mid].arc_length_m <= wrappedS) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    const s0 = samples[lo];
    const s1 = samples[(lo + 1) % N];
    const segLen = Math.max(
      1e-5,
      (lo + 1 === N ? totalLength : s1.arc_length_m) - s0.arc_length_m
    );
    const alpha = THREE.MathUtils.clamp((wrappedS - s0.arc_length_m) / segLen, 0, 1);

    out.pos.copy(_p0.fromArray(s0.position)).lerp(_p1.fromArray(s1.position), alpha);
    out.right
      .copy(_r0.fromArray(s0.right))
      .lerp(_r1.fromArray(s1.right), alpha)
      .normalize();
    out.normal
      .copy(_n0.fromArray(s0.normal))
      .lerp(_n1.fromArray(s1.normal), alpha)
      .normalize();
    out.tangent
      .copy(_t0.fromArray(s0.tangent))
      .lerp(_t1.fromArray(s1.tangent), alpha)
      .normalize();
    return out;
  }

  function setMap(nextMapId, newSplineData) {
    mapId = nextMapId || 'coast';
    if (newSplineData && Array.isArray(newSplineData.samples)) {
      samples = newSplineData.samples;
      N = samples.length;
      totalLength = newSplineData.total_length_m || 3.2825;
    }
    recordingSamples = [];
    recordAccum = 0.0;
    lastRecordedLap = 1;
    ghostRoot.visible = false;
    loadPersonalBest(mapId);
  }

  function resetRace() {
    recordingSamples = [];
    recordAccum = 0.0;
    lastRecordedLap = 1;
    ghostRoot.visible = false;
    loadPersonalBest(mapId);
  }

  function onLapComplete(lapTime) {
    if (
      typeof lapTime === 'number' &&
      lapTime > 4.0 &&
      recordingSamples.length >= 6 &&
      (!pbData || lapTime < pbData.bestLapSec)
    ) {
      savePersonalBest(mapId, lapTime, recordingSamples);
    }
    recordingSamples = [];
    recordAccum = 0.0;
  }

  function setEnabled(val) {
    enabled = Boolean(val);
    if (!enabled) {
      ghostRoot.visible = false;
    }
  }

  let ghostActiveThisFrame = false;
  let ghostDeltaSec = null;

  function update(dt, playerState, isRacing, modeId = 'circuit') {
    ghostActiveThisFrame = false;
    ghostDeltaSec = null;

    if (!playerState || !isRacing || N === 0) {
      ghostRoot.visible = false;
      return { active: false, position: null, deltaSec: null };
    }

    const lapNow = Math.max(1, playerState.lapCount || 1);
    if (lapNow !== lastRecordedLap) {
      lastRecordedLap = lapNow;
      recordingSamples = [];
      recordAccum = 0.0;
    }

    // 1. Record current player lap trace at 10Hz
    if (!playerState.countdownLocked && !playerState.raceFinished) {
      recordAccum += dt;
      if (
        (recordingSamples.length === 0 || recordAccum >= SAMPLE_INTERVAL_SEC) &&
        recordingSamples.length < MAX_LAP_SAMPLES
      ) {
        recordAccum = 0.0;
        recordingSamples.push([
          playerState.currentLapTime || 0.0,
          playerState.s || 0.0,
          playerState.lateralOffset || 0.0,
          playerState.hopHeight || 0.0,
          playerState.driftAngle || 0.0,
        ]);
      }
    }

    // 2. Render Ghost Car automatically in Time Attack, or when enabled in Circuit
    const showGhost =
      Boolean(activeCarInstance) &&
      Boolean(pbData && pbData.samples && pbData.samples.length >= 6) &&
      (modeId === 'time_attack' || (modeId === 'circuit' && enabled));

    if (!showGhost) {
      ghostRoot.visible = false;
      return { active: false, position: null, deltaSec: null };
    }

    const pbSamples = pbData.samples;
    const tQuery = Math.max(0.0, playerState.currentLapTime || 0.0);

    // Binary search ghost sample brackets for tQuery
    let lo = 0;
    let hi = pbSamples.length - 1;
    if (tQuery >= pbSamples[hi][0]) {
      lo = hi;
    } else {
      while (lo < hi - 1) {
        const mid = (lo + hi) >> 1;
        if (pbSamples[mid][0] <= tQuery) {
          lo = mid;
        } else {
          hi = mid;
        }
      }
    }

    const a = pbSamples[lo];
    const b = pbSamples[Math.min(lo + 1, pbSamples.length - 1)];
    const spanT = Math.max(1e-4, b[0] - a[0]);
    const alpha =
      lo === pbSamples.length - 1 ? 0.0 : THREE.MathUtils.clamp((tQuery - a[0]) / spanT, 0, 1);

    // Wrap-aware arc-length interpolation across start/finish seam
    let sA = a[1];
    let sB = b[1];
    let dS = sB - sA;
    if (dS < -totalLength * 0.5) dS += totalLength;
    if (dS > totalLength * 0.5) dS -= totalLength;
    const ghostS = ((sA + dS * alpha) % totalLength + totalLength) % totalLength;
    const ghostLat = THREE.MathUtils.lerp(a[2], b[2], alpha);
    const ghostHop = THREE.MathUtils.lerp(a[3], b[3], alpha);
    const ghostDrift = THREE.MathUtils.lerp(a[4], b[4], alpha);
    const estGhostSpeed = Math.abs(dS) / Math.max(0.05, spanT);

    const frame = samplePoint(ghostS, _frame);
    ghostWorldPos
      .copy(frame.pos)
      .addScaledVector(frame.right, ghostLat)
      .addScaledVector(frame.normal, 0.0002 + ghostHop);

    ghostRoot.position.copy(ghostWorldPos);
    _left.crossVectors(frame.normal, frame.tangent).normalize();
    _rotMat.makeBasis(_left, frame.normal, frame.tangent);
    _baseQuat.setFromRotationMatrix(_rotMat);
    _driftQuat.setFromAxisAngle(frame.normal, ghostDrift);
    ghostRoot.quaternion.copy(_driftQuat.multiply(_baseQuat));

    // Spin and steer the real 3D car's wheels cleanly
    if (activeCarInstance.spinWheels) {
      activeCarInstance.spinWheels(dt, Math.min(0.28, estGhostSpeed));
    }
    if (activeCarInstance.steerFrontWheels) {
      activeCarInstance.steerFrontWheels(THREE.MathUtils.clamp(-ghostDrift * 0.6, -0.35, 0.35));
    }

    // Vivid yet refined holographic glow shimmer
    const pulse = 0.58 + 0.09 * Math.sin(tQuery * 5.0);
    holoBodyMat.opacity = pulse;
    holoBodyMat.emissiveIntensity = 0.92 + 0.24 * Math.sin(tQuery * 5.0);
    haloMat.opacity = 0.34 + 0.12 * Math.sin(tQuery * 6.0);

    ghostRoot.visible = true;
    ghostActiveThisFrame = true;

    // Approximate time delta vs PB ghost (+ means behind PB, - means ahead of PB)
    let aheadS = (playerState.s || 0) - ghostS;
    if (aheadS > totalLength * 0.5) aheadS -= totalLength;
    if (aheadS < -totalLength * 0.5) aheadS += totalLength;
    const refSpeed = Math.max(0.08, Math.abs(playerState.speed || 0.12));
    ghostDeltaSec = Number((-aheadS / refSpeed).toFixed(2));

    return {
      active: true,
      position: ghostWorldPos,
      deltaSec: ghostDeltaSec,
    };
  }

  function dispose() {
    loadGeneration++;
    if (activeCarInstance) {
      if (activeCarInstance.assemblyRoot && activeCarInstance.assemblyRoot.parent) {
        activeCarInstance.assemblyRoot.parent.remove(activeCarInstance.assemblyRoot);
      }
      if (activeCarInstance.dispose) activeCarInstance.dispose();
      activeCarInstance = null;
    }
    if (ghostRoot.parent) {
      ghostRoot.parent.remove(ghostRoot);
    }
    haloGeo.dispose();
    haloMat.dispose();
    holoBodyMat.dispose();
    holoGlassMat.dispose();
    holoWheelMat.dispose();
    holoGlowLightMat.dispose();
  }

  loadPersonalBest(mapId);

  return {
    ghostRoot,
    setCarId,
    setMap,
    resetRace,
    onLapComplete,
    setEnabled,
    isEnabled: () => enabled,
    hasPersonalBest: () => Boolean(pbData),
    getBestLapSec: () => (pbData ? pbData.bestLapSec : null),
    isActive: () => ghostActiveThisFrame,
    getWorldPosition: () => (ghostActiveThisFrame ? ghostWorldPos : null),
    getDeltaSec: () => ghostDeltaSec,
    update,
    dispose,
  };
}
