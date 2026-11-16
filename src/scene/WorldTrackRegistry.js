import * as THREE from 'three';

/**
 * Deterministic C2 Closed-Loop Periodic Spline & Atmosphere Registry for all 3 Real-World Circuits:
 * - 'coast' : Sunset Coastal Beach Highway (Ocean sweepers, suspension bay bridge, palm beach straight)
 * - 'city'  : Midnight Neon City Circuit (Fast downtown boulevards, banked 90° corners, neon highway tunnel)
 * - 'canyon': Alpine Mountain Canyon Pass (High-altitude switchbacks, pine ridge climb, misty gorge truss bridge)
 *
 * Each map produces a 720-sample C2-smoothed periodic spline with Sector 6 anchored as a flat Start/Finish
 * straightaway around sample 646 so player Pole Position, AI Rivals, and the F1 Countdown Gantry align cleanly.
 */

const splineCache = new Map();

const MAP_CIRCUIT_DEFINITIONS = {
  coast: {
    mapId: 'coast',
    name: 'Sunset Coastal Beach Highway',
    track_width_m: 0.024,
    curb_width_m: 0.0026,
    rail_height_m: 0.0035,
    bridgeRanges: [[0.16, 0.31]],
    tunnelRanges: [],
    boostPadConfigs: [
      { sFrac: 0.14, latOffset: -0.0042, color: 0x00f0ff },
      { sFrac: 0.25, latOffset: 0.0040, color: 0xfb923c },
      { sFrac: 0.42, latOffset: -0.0040, color: 0x00f0ff },
      { sFrac: 0.58, latOffset: 0.0042, color: 0xfb923c },
      { sFrac: 0.74, latOffset: -0.0042, color: 0x00f0ff },
      { sFrac: 0.93, latOffset: 0.0, color: 0xfb923c },
    ],
    jumpRampConfigs: [
      { sFrac: 0.22, latOffset: 0.0 }, // Flat mid-span of Coastal Suspension Bridge
      { sFrac: 0.87, latOffset: 0.0 }, // Flat Front Beachfront Straightaway
    ],
    sectors: [
      { id: 1, name: 'Palm Cove Sweeper' },
      { id: 2, name: 'Golden Bay Suspension Bridge' },
      { id: 3, name: 'Headland Cliff Hairpin' },
      { id: 4, name: 'Turquoise Lagoon S-Curves' },
      { id: 5, name: 'Sunset Boardwalk Bend' },
      { id: 6, name: 'Oceanfront Start/Finish Straight' },
    ],
    // Control points: [x, y, z, bank_deg, sector]
    // Grounded baseline sits flush at y = 0.035; rises smoothly ONLY for Sector 2 Golden Bay Bridge
    controlPoints: [
      [-0.46, 0.035, 0.21, 4.0, 1],
      [-0.56, 0.035, 0.10, 6.0, 1],
      [-0.58, 0.035, -0.05, 6.0, 1],
      [-0.50, 0.050, -0.19, 4.0, 2],
      [-0.34, 0.068, -0.25, 0.0, 2],
      [-0.14, 0.072, -0.25, 0.0, 2],
      [0.06, 0.068, -0.25, 0.0, 2],
      [0.24, 0.048, -0.22, -4.0, 3],
      [0.42, 0.035, -0.18, -7.0, 3],
      [0.54, 0.035, -0.08, 7.0, 3],
      [0.52, 0.035, 0.04, 6.0, 4],
      [0.36, 0.035, 0.06, -6.0, 4],
      [0.26, 0.035, -0.04, -6.0, 4],
      [0.38, 0.035, -0.09, 6.0, 4],
      [0.54, 0.035, 0.02, 7.0, 5],
      [0.52, 0.035, 0.16, 6.0, 5],
      [0.38, 0.035, 0.24, 4.0, 5],
      [0.20, 0.035, 0.255, 0.0, 6],
      [0.0, 0.035, 0.255, 0.0, 6],
      [-0.20, 0.035, 0.255, 0.0, 6],
      [-0.36, 0.035, 0.248, 2.0, 6],
    ],
  },

  city: {
    mapId: 'city',
    name: 'Midnight Neon City Circuit',
    track_width_m: 0.024,
    curb_width_m: 0.0026,
    rail_height_m: 0.0038,
    bridgeRanges: [[0.14, 0.27]],
    tunnelRanges: [[0.44, 0.59]],
    boostPadConfigs: [
      { sFrac: 0.12, latOffset: 0.0040, color: 0x00e5ff },
      { sFrac: 0.21, latOffset: -0.0040, color: 0xec4899 },
      { sFrac: 0.37, latOffset: 0.0040, color: 0x00e5ff },
      { sFrac: 0.51, latOffset: 0.0, color: 0xec4899 },
      { sFrac: 0.71, latOffset: -0.0042, color: 0x00e5ff },
      { sFrac: 0.92, latOffset: 0.0, color: 0xec4899 },
    ],
    jumpRampConfigs: [
      { sFrac: 0.20, latOffset: 0.0 }, // Raised Neon Overpass Straightaway
      { sFrac: 0.86, latOffset: 0.0 }, // Downtown Main Boulevard Straightaway
    ],
    sectors: [
      { id: 1, name: 'Cyber Plaza 90° Corner' },
      { id: 2, name: 'Skyline Elevated Overpass' },
      { id: 3, name: 'Neon Tower Chicane' },
      { id: 4, name: 'Midtown Express Tunnel' },
      { id: 5, name: 'Harbor District Hairpin' },
      { id: 6, name: 'Downtown Start/Finish Boulevard' },
    ],
    // Grounded baseline sits flush at y = 0.035; rises smoothly ONLY for Sector 2 Skyline Overpass
    controlPoints: [
      [-0.45, 0.035, 0.22, 4.0, 1],
      [-0.54, 0.035, 0.12, 6.0, 1],
      [-0.54, 0.035, -0.06, 5.0, 1],
      [-0.48, 0.056, -0.21, 5.0, 2],
      [-0.28, 0.072, -0.24, 0.0, 2],
      [-0.04, 0.070, -0.24, 0.0, 2],
      [0.18, 0.048, -0.23, -4.0, 3],
      [0.28, 0.035, -0.12, -6.0, 3],
      [0.14, 0.035, -0.02, 6.0, 3],
      [0.02, 0.035, -0.12, 0.0, 4],
      [0.16, 0.035, -0.22, 0.0, 4],
      [0.38, 0.035, -0.20, 3.0, 4],
      [0.54, 0.035, -0.10, 6.0, 4],
      [0.56, 0.035, 0.06, 6.0, 5],
      [0.48, 0.035, 0.20, 6.0, 5],
      [0.34, 0.035, 0.25, 3.0, 5],
      [0.18, 0.035, 0.255, 0.0, 6],
      [0.0, 0.035, 0.255, 0.0, 6],
      [-0.18, 0.035, 0.255, 0.0, 6],
      [-0.35, 0.035, 0.248, 2.0, 6],
    ],
  },

  canyon: {
    mapId: 'canyon',
    name: 'Alpine Mountain Canyon Pass',
    track_width_m: 0.024,
    curb_width_m: 0.0026,
    rail_height_m: 0.0038,
    bridgeRanges: [[0.28, 0.43]],
    tunnelRanges: [[0.60, 0.70]],
    boostPadConfigs: [
      { sFrac: 0.15, latOffset: -0.0040, color: 0x34d399 },
      { sFrac: 0.34, latOffset: 0.0, color: 0xfbbf24 },
      { sFrac: 0.49, latOffset: 0.0042, color: 0x34d399 },
      { sFrac: 0.65, latOffset: -0.0040, color: 0xfbbf24 },
      { sFrac: 0.77, latOffset: 0.0040, color: 0x34d399 },
      { sFrac: 0.93, latOffset: 0.0, color: 0xfbbf24 },
    ],
    jumpRampConfigs: [
      { sFrac: 0.35, latOffset: 0.0 }, // Flat High Gorge Truss Bridge Span
      { sFrac: 0.87, latOffset: 0.0 }, // Flat Valley Straightaway
    ],
    sectors: [
      { id: 1, name: 'Timberline Ascent' },
      { id: 2, name: 'Eagle Ridge Crest' },
      { id: 3, name: 'Misty Gorge Steel Truss Bridge' },
      { id: 4, name: 'Granite Switchback Descent' },
      { id: 5, name: 'Rockfall Tunnel & Valley Bend' },
      { id: 6, name: 'Alpine Lodge Start/Finish Straight' },
    ],
    // Valley floor sits flush at y = 0.035; hill climb (Sectors 1-2 & 4) is matched by raised canyon terrain beneath it,
    // with Sector 3 Misty Gorge Bridge spanning across the deep canyon chasm.
    controlPoints: [
      [-0.46, 0.036, 0.20, 4.0, 1],
      [-0.57, 0.056, 0.06, 7.0, 1],
      [-0.55, 0.084, -0.10, 7.0, 2],
      [-0.42, 0.104, -0.22, 5.0, 2],
      [-0.22, 0.112, -0.25, 0.0, 3],
      [0.02, 0.114, -0.25, 0.0, 3],
      [0.24, 0.108, -0.23, -4.0, 3],
      [0.44, 0.092, -0.16, -7.0, 4],
      [0.52, 0.072, -0.02, 7.0, 4],
      [0.34, 0.056, 0.05, -6.0, 4],
      [0.24, 0.044, -0.05, -5.0, 5],
      [0.40, 0.038, -0.08, 5.0, 5],
      [0.55, 0.035, 0.04, 6.0, 5],
      [0.50, 0.035, 0.18, 5.0, 5],
      [0.36, 0.035, 0.245, 3.0, 5],
      [0.19, 0.035, 0.255, 0.0, 6],
      [0.0, 0.035, 0.255, 0.0, 6],
      [-0.19, 0.035, 0.255, 0.0, 6],
      [-0.35, 0.035, 0.245, 2.0, 6],
    ],
  },
};

function isFractionInRanges(t, ranges) {
  if (!ranges || ranges.length === 0) return false;
  for (let i = 0; i < ranges.length; i++) {
    const [a, b] = ranges[i];
    if (t >= a && t <= b) return true;
  }
  return false;
}

/**
 * Builds a 720-sample C2-smoothed periodic spline from the circuit definition.
 */
function generateCircuitSplineData(def) {
  const N = 720;
  const ctrl = def.controlPoints;
  const numCtrl = ctrl.length;

  const pts = ctrl.map((c) => new THREE.Vector3(c[0], c[1], c[2]));
  const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);

  // Sample positions and interpolate bank & sector along the closed loop
  const rawPositions = [];
  const rawBanks = new Float32Array(N);
  const rawSectors = new Int32Array(N);

  for (let i = 0; i < N; i++) {
    const u = i / N;
    const p = curve.getPointAt(u);
    rawPositions.push(p);

    const scaled = u * numCtrl;
    const idx0 = Math.floor(scaled) % numCtrl;
    const idx1 = (idx0 + 1) % numCtrl;
    const frac = scaled - Math.floor(scaled);
    const smoothFrac = frac * frac * (3 - 2 * frac);

    rawBanks[i] = THREE.MathUtils.lerp(ctrl[idx0][3], ctrl[idx1][3], smoothFrac);
    rawSectors[i] = ctrl[idx0][4];
  }

  // 3-pass periodic C2 position & bank smoothing filter
  for (let pass = 0; pass < 3; pass++) {
    const nextP = rawPositions.map((v) => v.clone());
    const nextB = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const prev = (i - 1 + N) % N;
      const next = (i + 1) % N;
      nextP[i]
        .copy(rawPositions[i])
        .multiplyScalar(0.6)
        .addScaledVector(rawPositions[prev], 0.2)
        .addScaledVector(rawPositions[next], 0.2);
      nextB[i] = rawBanks[i] * 0.6 + rawBanks[prev] * 0.2 + rawBanks[next] * 0.2;
    }
    for (let i = 0; i < N; i++) {
      rawPositions[i].copy(nextP[i]);
      rawBanks[i] = nextB[i];
    }
  }

  // Compute cumulative arc length and orthonormal banked frames
  const arcLengths = new Float32Array(N);
  let totalLength = 0;
  for (let i = 0; i < N; i++) {
    arcLengths[i] = totalLength;
    const next = (i + 1) % N;
    totalLength += rawPositions[i].distanceTo(rawPositions[next]);
  }

  const worldUp = new THREE.Vector3(0, 1, 0);
  const samples = [];

  for (let i = 0; i < N; i++) {
    const prev = (i - 1 + N) % N;
    const next = (i + 1) % N;
    const tangent = new THREE.Vector3()
      .subVectors(rawPositions[next], rawPositions[prev])
      .normalize();

    const flatRight = new THREE.Vector3().crossVectors(tangent, worldUp);
    if (flatRight.lengthSq() < 1e-6) {
      flatRight.set(1, 0, 0);
    } else {
      flatRight.normalize();
    }
    const baseNormal = new THREE.Vector3().crossVectors(flatRight, tangent).normalize();

    const bankRad = THREE.MathUtils.degToRad(rawBanks[i]);
    const bankQuat = new THREE.Quaternion().setFromAxisAngle(tangent, bankRad);
    const right = flatRight.clone().applyQuaternion(bankQuat).normalize();
    const normal = baseNormal.clone().applyQuaternion(bankQuat).normalize();

    const tFrac = i / N;
    samples.push({
      index: i,
      t: Number(tFrac.toFixed(6)),
      sector: rawSectors[i],
      position: [
        Number(rawPositions[i].x.toFixed(5)),
        Number(rawPositions[i].y.toFixed(5)),
        Number(rawPositions[i].z.toFixed(5)),
      ],
      tangent: [
        Number(tangent.x.toFixed(5)),
        Number(tangent.y.toFixed(5)),
        Number(tangent.z.toFixed(5)),
      ],
      right: [
        Number(right.x.toFixed(5)),
        Number(right.y.toFixed(5)),
        Number(right.z.toFixed(5)),
      ],
      normal: [
        Number(normal.x.toFixed(5)),
        Number(normal.y.toFixed(5)),
        Number(normal.z.toFixed(5)),
      ],
      bank_deg: Number(rawBanks[i].toFixed(2)),
      arc_length_m: Number(arcLengths[i].toFixed(5)),
      isBridge: isFractionInRanges(tFrac, def.bridgeRanges),
      isTunnel: isFractionInRanges(tFrac, def.tunnelRanges),
    });
  }

  return {
    mapId: def.mapId,
    name: def.name,
    is_closed_periodic_loop: true,
    track_width_m: def.track_width_m,
    curb_width_m: def.curb_width_m,
    rail_height_m: def.rail_height_m,
    total_length_m: Number(totalLength.toFixed(4)),
    scale_equivalent_length_m: Number((totalLength * 87.0).toFixed(1)),
    num_control_points: numCtrl,
    num_samples: N,
    startFinishIdx: 646,
    sectors: def.sectors,
    bridgeRanges: def.bridgeRanges,
    tunnelRanges: def.tunnelRanges,
    boostPadConfigs: def.boostPadConfigs,
    jumpRampConfigs: def.jumpRampConfigs,
    samples,
  };
}

/**
 * Returns the cached 720-sample C2 spline data for the requested mapId ('coast' | 'city' | 'canyon').
 */
export function getTrackSplineForMap(mapId = 'coast') {
  const safeId = mapId === 'city' || mapId === 'canyon' ? mapId : 'coast';
  if (splineCache.has(safeId)) {
    return splineCache.get(safeId);
  }
  const def = MAP_CIRCUIT_DEFINITIONS[safeId] || MAP_CIRCUIT_DEFINITIONS.coast;
  const splineData = generateCircuitSplineData(def);
  splineCache.set(safeId, splineData);
  return splineData;
}

/**
 * Returns the static circuit definition metadata for the requested mapId.
 */
export function getMapCircuitDefinition(mapId = 'coast') {
  const safeId = mapId === 'city' || mapId === 'canyon' ? mapId : 'coast';
  return MAP_CIRCUIT_DEFINITIONS[safeId] || MAP_CIRCUIT_DEFINITIONS.coast;
}
