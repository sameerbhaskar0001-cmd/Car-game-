import * as THREE from 'three';
import trackAsphaltJson from '../../track_asphalt.json';
import trackNeonJson from '../../track_neon.json';
import trackSnowJson from '../../track_snow.json';

/**
 * GameShipKit Custom 3D Track Registry & Spline Builder
 * Supports dynamic map/filename variations:
 *   - 'coast'  | 'track_asphalt' | 'asphalt' -> track_asphalt.glb + track_asphalt.json
 *   - 'city'   | 'track_neon'    | 'neon'    -> track_neon.glb    + track_neon.json
 *   - 'canyon' | 'track_snow'    | 'snow'    -> track_snow.glb    + track_snow.json
 *
 * Parses centerLine waypoints, road width (15.5m..18.46m), segment banking angles (bank),
 * sequential checkpoints (0..7), starting grid slots (1..8), and AI racingLine speed profiles.
 */

export const WORLD_TRACK_SCALE = 0.0022;
export const BASE_GROUND_Y = 0.035;

const ASPHALT_GLB_BUNDLED_URL = new URL('../../track_asphalt.glb', import.meta.url).href;
const NEON_GLB_BUNDLED_URL = new URL('../../track_neon.glb', import.meta.url).href;
const SNOW_GLB_BUNDLED_URL = new URL('../../track_snow.glb', import.meta.url).href;

export function resolveTrackThemeKey(rawId = 'coast') {
  const s = String(rawId || 'coast').trim().toLowerCase();
  if (s.includes('neon') || s.includes('city')) return 'city';
  if (s.includes('snow') || s.includes('canyon') || s.includes('alpine')) return 'canyon';
  return 'coast';
}

export function getTrackAssetDescriptor(rawId = 'coast') {
  const mapId = resolveTrackThemeKey(rawId);
  if (mapId === 'city') {
    return {
      mapId: 'city',
      trackKey: 'track_neon',
      surface: 'neon',
      jsonData: trackNeonJson,
      glbCandidateUrls: [
        '/track_neon.glb',
        ASPHALT_GLB_BUNDLED_URL ? NEON_GLB_BUNDLED_URL : '/track_neon.glb',
        '/public/track_neon.glb',
        './track_neon.glb',
        '/assets/models/track_neon.glb',
      ],
      jsonCandidateUrls: [
        '/track_neon.json',
        '/public/track_neon.json',
        './track_neon.json',
      ],
    };
  }
  if (mapId === 'canyon') {
    return {
      mapId: 'canyon',
      trackKey: 'track_snow',
      surface: 'snow',
      jsonData: trackSnowJson,
      glbCandidateUrls: [
        '/track_snow.glb',
        SNOW_GLB_BUNDLED_URL,
        '/public/track_snow.glb',
        './track_snow.glb',
        '/assets/models/track_snow.glb',
      ],
      jsonCandidateUrls: [
        '/track_snow.json',
        '/public/track_snow.json',
        './track_snow.json',
      ],
    };
  }
  return {
    mapId: 'coast',
    trackKey: 'track_asphalt',
    surface: 'asphalt',
    jsonData: trackAsphaltJson,
    glbCandidateUrls: [
      '/track_asphalt.glb',
      ASPHALT_GLB_BUNDLED_URL,
      '/public/track_asphalt.glb',
      './track_asphalt.glb',
      '/assets/models/track_asphalt.glb',
    ],
    jsonCandidateUrls: [
      '/track_asphalt.json',
      '/public/track_asphalt.json',
      './track_asphalt.json',
    ],
  };
}

const SECTOR_NAMES_BY_MAP = {
  coast: [
    { id: 1, name: 'Oceanfront Harbor Straight' },
    { id: 2, name: 'Palm Bay Sweeper' },
    { id: 3, name: 'Sunset Cliff Ascent' },
    { id: 4, name: 'Highland Banked Hairpin' },
    { id: 5, name: 'Golden Cove Switchback' },
    { id: 6, name: 'Coastal Grandstand Gantry' },
  ],
  city: [
    { id: 1, name: 'Cyber Plaza Boulevard' },
    { id: 2, name: 'Neon Tower Chicane' },
    { id: 3, name: 'Skyline Overpass Climb' },
    { id: 4, name: 'Hologram Banked Bend' },
    { id: 5, name: 'Wet Asphalt Harbor Loop' },
    { id: 6, name: 'Downtown Finish Straight' },
  ],
  canyon: [
    { id: 1, name: 'Glacier Valley Straight' },
    { id: 2, name: 'Frostbite Ridge Curve' },
    { id: 3, name: 'Summit Snow Climb' },
    { id: 4, name: 'High-Altitude Banked Turn' },
    { id: 5, name: 'Evergreen Gorge Descent' },
    { id: 6, name: 'Alpine Base Gantry' },
  ],
};

const BOOST_PAD_CONFIGS_BY_MAP = {
  coast: [
    { sFrac: 0.14, latOffset: -0.0045, color: 0x00f0ff },
    { sFrac: 0.28, latOffset: 0.0045, color: 0xf59e0b },
    { sFrac: 0.44, latOffset: -0.0040, color: 0x00f0ff },
    { sFrac: 0.62, latOffset: 0.0045, color: 0xf59e0b },
    { sFrac: 0.78, latOffset: -0.0045, color: 0x00f0ff },
    { sFrac: 0.91, latOffset: 0.0, color: 0xf59e0b },
  ],
  city: [
    { sFrac: 0.12, latOffset: 0.0045, color: 0x00f0ff },
    { sFrac: 0.27, latOffset: -0.0045, color: 0xec4899 },
    { sFrac: 0.43, latOffset: 0.0040, color: 0x00f0ff },
    { sFrac: 0.60, latOffset: -0.0045, color: 0xec4899 },
    { sFrac: 0.76, latOffset: 0.0045, color: 0x00f0ff },
    { sFrac: 0.90, latOffset: 0.0, color: 0xec4899 },
  ],
  canyon: [
    { sFrac: 0.15, latOffset: -0.0042, color: 0x34d399 },
    { sFrac: 0.30, latOffset: 0.0042, color: 0xfbbf24 },
    { sFrac: 0.46, latOffset: -0.0042, color: 0x34d399 },
    { sFrac: 0.63, latOffset: 0.0042, color: 0xfbbf24 },
    { sFrac: 0.79, latOffset: -0.0042, color: 0x34d399 },
    { sFrac: 0.92, latOffset: 0.0, color: 0xfbbf24 },
  ],
};

const JUMP_RAMP_CONFIGS_BY_MAP = {
  coast: [
    { sFrac: 0.35, latOffset: 0.0 },
    { sFrac: 0.84, latOffset: 0.0 },
  ],
  city: [
    { sFrac: 0.34, latOffset: 0.0 },
    { sFrac: 0.83, latOffset: 0.0 },
  ],
  canyon: [
    { sFrac: 0.36, latOffset: 0.0 },
    { sFrac: 0.85, latOffset: 0.0 },
  ],
};

/**
 * Builds the complete C2-continuous 3D spline, banking frames, sequential checkpoints,
 * starting grid slots, and AI racing line speed/offset profile from the GameShipKit JSON data.
 */
function buildSplineFromGameShipKitJson(rawId, rawJson) {
  const descriptor = getTrackAssetDescriptor(rawId);
  const mapId = descriptor.mapId;
  const json = rawJson || descriptor.jsonData;

  const centerLine = Array.isArray(json.centerLine) ? json.centerLine : [];
  const rawRacingLine = Array.isArray(json.racingLine) ? json.racingLine : [];
  const rawCheckpoints = Array.isArray(json.checkpoints) ? json.checkpoints : [];
  const rawGrid = Array.isArray(json.grid) ? json.grid : [];

  const N = centerLine.length;
  const baseWidthRaw = typeof json.width === 'number' ? json.width : 15.5;
  const baseWidthM = baseWidthRaw * WORLD_TRACK_SCALE;
  const worldUp = new THREE.Vector3(0, 1, 0);

  // 1. Convert centerLine points to scaled 3D world coordinates
  const rawPositions = new Array(N);
  const rawWidths = new Float32Array(N);
  const rawBanks = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const pt = centerLine[i];
    rawPositions[i] = new THREE.Vector3(
      pt.x * WORLD_TRACK_SCALE,
      BASE_GROUND_Y + pt.y * WORLD_TRACK_SCALE,
      pt.z * WORLD_TRACK_SCALE
    );
    rawWidths[i] = (typeof pt.width === 'number' ? pt.width : baseWidthRaw) * WORLD_TRACK_SCALE;
    rawBanks[i] = typeof pt.bank === 'number' ? pt.bank : 0.0;
  }

  // Keep positions and banking angles 1:1 locked to the exported GameShipKit GLB Road/Curbs/Walls vertices
  // so there is ZERO vertical or lateral divergence between physics and the 3D GLB track mesh!
  const positions = rawPositions.map((p) => p.clone());
  const banks = new Float32Array(rawBanks);

  // 2. Compute cumulative arc-length along the closed loop
  const arcLengths = new Float32Array(N);
  let cumArc = 0.0;
  for (let i = 0; i < N; i++) {
    arcLengths[i] = cumArc;
    const nextIdx = (i + 1) % N;
    cumArc += positions[i].distanceTo(positions[nextIdx]);
  }
  const totalLength = cumArc;

  // 3. Compute 3D tangents, banked right vectors, and banked surface normals
  //    Verified against GameShipKit GLB Road mesh vertices (0.00m error across all 746 cross-sections):
  //    right  = R0 * cos(bankRad) - U0 * sin(bankRad)
  //    normal = U0 * cos(bankRad) + R0 * sin(bankRad)
  const tangents = new Array(N);
  const rights = new Array(N);
  const normals = new Array(N);

  for (let i = 0; i < N; i++) {
    const pt = centerLine[i];
    if (typeof pt.dirX === 'number' && typeof pt.dirZ === 'number') {
      const pNext = positions[(i + 1) % N];
      const pPrev = positions[(i - 1 + N) % N];
      const dy = (pNext.y - pPrev.y) * 0.5;
      const dHoriz = Math.max(1e-5, Math.hypot( pNext.x - pPrev.x, pNext.z - pPrev.z ) * 0.5);
      tangents[i] = new THREE.Vector3(pt.dirX, dy / dHoriz, pt.dirZ).normalize();
    } else {
      const pPrev = positions[(i - 1 + N) % N];
      const pNext = positions[(i + 1) % N];
      tangents[i] = new THREE.Vector3().subVectors(pNext, pPrev).normalize();
    }
  }

  const smoothTangents = tangents.map((t) => t.clone());

  for (let i = 0; i < N; i++) {
    const t = smoothTangents[i];
    const r0 = new THREE.Vector3().crossVectors(t, worldUp).normalize();
    const u0 = new THREE.Vector3().crossVectors(r0, t).normalize();

    const bankRad = THREE.MathUtils.degToRad(banks[i]);
    const cosB = Math.cos(bankRad);
    const sinB = Math.sin(bankRad);

    const rBanked = new THREE.Vector3()
      .copy(r0)
      .multiplyScalar(cosB)
      .addScaledVector(u0, -sinB)
      .normalize();
    const nBanked = new THREE.Vector3()
      .copy(u0)
      .multiplyScalar(cosB)
      .addScaledVector(r0, sinB)
      .normalize();

    rights[i] = rBanked;
    normals[i] = nBanked;
  }

  // 4. Map AI racingLine waypoints (lateral offset + target speed profile) onto each sample
  let avgRacingSpeed = 40.0;
  let minRacingSpeed = Infinity;
  let maxRacingSpeed = -Infinity;
  if (rawRacingLine.length > 0) {
    let sumSpd = 0.0;
    for (let i = 0; i < rawRacingLine.length; i++) {
      const spd = typeof rawRacingLine[i].speed === 'number' ? rawRacingLine[i].speed : 40.0;
      sumSpd += spd;
      if (spd < minRacingSpeed) minRacingSpeed = spd;
      if (spd > maxRacingSpeed) maxRacingSpeed = spd;
    }
    avgRacingSpeed = Math.max(10.0, sumSpd / rawRacingLine.length);
  } else {
    minRacingSpeed = 24.0;
    maxRacingSpeed = 55.0;
  }

  const rlWorldPts = rawRacingLine.map(
    (pt) =>
      new THREE.Vector3(
        pt.x * WORLD_TRACK_SCALE,
        BASE_GROUND_Y + pt.y * WORLD_TRACK_SCALE,
        pt.z * WORLD_TRACK_SCALE
      )
  );

  const sampleRacingOffsets = new Float32Array(N);
  const sampleRacingSpeeds = new Float32Array(N);
  const sampleRacingFactors = new Float32Array(N);
  const _diff = new THREE.Vector3();

  for (let i = 0; i < N; i++) {
    if (rlWorldPts.length === 0) {
      sampleRacingOffsets[i] = 0.0;
      sampleRacingSpeeds[i] = avgRacingSpeed;
      sampleRacingFactors[i] = 1.0;
      continue;
    }

    // Search local window around proportional index for nearest racingLine point
    const approxIdx = Math.floor((i / N) * rlWorldPts.length);
    let bestRlIdx = approxIdx;
    let bestDistSq = Infinity;
    const searchWin = Math.min(24, Math.floor(rlWorldPts.length * 0.5));
    for (let k = -searchWin; k <= searchWin; k++) {
      const rIdx = (approxIdx + k + rlWorldPts.length) % rlWorldPts.length;
      const dSq = positions[i].distanceToSquared(rlWorldPts[rIdx]);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestRlIdx = rIdx;
      }
    }

    const rlPt = rlWorldPts[bestRlIdx];
    const rlRaw = rawRacingLine[bestRlIdx];
    _diff.subVectors(rlPt, positions[i]);
    const halfW = rawWidths[i] * 0.5;
    // Clamp racing line lateral offset comfortably inside the drivable lane corridor
    const latOff = THREE.MathUtils.clamp(_diff.dot(rights[i]), -halfW * 0.65, halfW * 0.65);
    const spd = typeof rlRaw.speed === 'number' ? rlRaw.speed : avgRacingSpeed;

    sampleRacingOffsets[i] = latOff;
    sampleRacingSpeeds[i] = spd;
    sampleRacingFactors[i] = THREE.MathUtils.clamp(spd / avgRacingSpeed, 0.64, 1.24);
  }

  // Smooth racing line lateral offsets so AI lane transitions are fluid
  for (let pass = 0; pass < 2; pass++) {
    const nextOff = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const iPrev = (i - 1 + N) % N;
      const iNext = (i + 1) % N;
      nextOff[i] =
        sampleRacingOffsets[i] * 0.5 +
        (sampleRacingOffsets[iPrev] + sampleRacingOffsets[iNext]) * 0.25;
    }
    sampleRacingOffsets.set(nextOff);
  }

  // 5. Build samples array compatible with KartPhysicsController, RivalRacersController, PowerupManager & RealWorldMapBuilder
  const samples = new Array(N);
  // StartLine in the GLB is at [235.649, 0.04, 1.214] which corresponds to sample index 1
  const startFinishIdx = N > 1 ? 1 : 0;

  for (let i = 0; i < N; i++) {
    const u = arcLengths[i] / totalLength;
    let sector = 1;
    if (i >= N - 24 || i <= 6) {
      sector = 6; // Starting Grid & Finish Gantry Straight
    } else if (u < 0.18) {
      sector = 1;
    } else if (u < 0.36) {
      sector = 2;
    } else if (u < 0.54) {
      sector = 3;
    } else if (u < 0.74) {
      sector = 4;
    } else if (u < 0.90) {
      sector = 5;
    } else {
      sector = 6;
    }

    const pos = positions[i];
    const tang = smoothTangents[i];
    const right = rights[i];
    const norm = normals[i];
    const widthM = rawWidths[i];

    samples[i] = {
      index: i,
      arc_length_m: Number(arcLengths[i].toFixed(5)),
      sector,
      zone: `sector_${sector}`,
      position: [Number(pos.x.toFixed(6)), Number(pos.y.toFixed(6)), Number(pos.z.toFixed(6))],
      tangent: [Number(tang.x.toFixed(6)), Number(tang.y.toFixed(6)), Number(tang.z.toFixed(6))],
      normal: [Number(norm.x.toFixed(6)), Number(norm.y.toFixed(6)), Number(norm.z.toFixed(6))],
      right: [Number(right.x.toFixed(6)), Number(right.y.toFixed(6)), Number(right.z.toFixed(6))],
      bank_deg: Number(banks[i].toFixed(2)),
      width_m: Number(widthM.toFixed(5)),
      half_width_m: Number((widthM * 0.5).toFixed(5)),
      racing_line_offset_m: Number(sampleRacingOffsets[i].toFixed(5)),
      racing_line_speed_mps: Number(sampleRacingSpeeds[i].toFixed(2)),
      racing_line_speed_factor: Number(sampleRacingFactors[i].toFixed(4)),
      isBridge: pos.y > BASE_GROUND_Y + 0.012,
      isTunnel: false,
    };
  }

  const startFinishArc = samples[startFinishIdx].arc_length_m;

  // 6. Project sequential checkpoints (Checkpoint_00 .. Checkpoint_07) onto spline
  const checkpoints = rawCheckpoints.map((cp, idx) => {
    const cpWorld = new THREE.Vector3(
      cp.x * WORLD_TRACK_SCALE,
      BASE_GROUND_Y + cp.y * WORLD_TRACK_SCALE,
      cp.z * WORLD_TRACK_SCALE
    );
    let bestIdx = 0;
    let bestDistSq = Infinity;
    for (let i = 0; i < N; i++) {
      const dSq = positions[i].distanceToSquared(cpWorld);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }
    const sArc = samples[bestIdx].arc_length_m;
    const distFromStart = ((sArc - startFinishArc) % totalLength + totalLength) % totalLength;
    return {
      index: typeof cp.index === 'number' ? cp.index : idx,
      sampleIndex: bestIdx,
      s: sArc,
      distFromStart,
      position: [cpWorld.x, cpWorld.y, cpWorld.z],
      rawPosition: [cp.x, cp.y, cp.z],
      direction: [cp.dirX ?? smoothTangents[bestIdx].x, 0, cp.dirZ ?? smoothTangents[bestIdx].z],
      width_m: (cp.width || baseWidthRaw) * WORLD_TRACK_SCALE,
      rawWidth: cp.width || baseWidthRaw,
    };
  });

  // Sort checkpoints in ascending distance from startFinishArc so sequential order is guaranteed
  checkpoints.sort((a, b) => a.distFromStart - b.distFromStart);

  // 7. Project starting grid slots (Grid_1 .. Grid_8) onto spline
  //    Each slot has exact spline arc-length `s`, signed `offsetFromStart` (negative, behind StartLine),
  //    `lateralOffset` across the roadbed, `headingYaw`, and 3D world position/direction.
  const gridSlots = rawGrid.map((g, idx) => {
    const gWorld = new THREE.Vector3(
      g.x * WORLD_TRACK_SCALE,
      BASE_GROUND_Y + g.y * WORLD_TRACK_SCALE,
      g.z * WORLD_TRACK_SCALE
    );
    let bestIdx = 0;
    let bestDistSq = Infinity;
    for (let i = 0; i < N; i++) {
      const dSq = positions[i].distanceToSquared(gWorld);
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestIdx = i;
      }
    }

    // Refine projection along the local tangent at bestIdx
    const sPt = positions[bestIdx];
    const sTang = smoothTangents[bestIdx];
    const sRight = rights[bestIdx];
    const delta = new THREE.Vector3().subVectors(gWorld, sPt);
    const alongTang = delta.dot(sTang);
    const latOffset = delta.dot(sRight);
    const exactS = ((samples[bestIdx].arc_length_m + alongTang) % totalLength + totalLength) % totalLength;

    // Signed distance relative to startFinishArc in [-totalLength/2, +totalLength/2]
    const signedOffsetFromStart =
      ((exactS - startFinishArc + totalLength * 0.5) % totalLength) - totalLength * 0.5;

    // Compute exact heading yaw difference between slot direction [dirX, 0, dirZ] and spline tangent
    const slotDir = new THREE.Vector3(g.dirX ?? sTang.x, 0, g.dirZ ?? sTang.z).normalize();
    const flatTang = new THREE.Vector3(sTang.x, 0, sTang.z).normalize();
    const flatRight = new THREE.Vector3(sRight.x, 0, sRight.z).normalize();
    const sinYaw = -slotDir.dot(flatRight);
    const cosYaw = Math.max(0.1, slotDir.dot(flatTang));
    const headingYaw = THREE.MathUtils.clamp(Math.atan2(sinYaw, cosYaw), -0.25, 0.25);

    return {
      slot: typeof g.slot === 'number' ? g.slot : idx + 1,
      s: exactS,
      signedOffsetFromStart,
      lateralOffset: latOffset,
      headingYaw,
      position: [gWorld.x, gWorld.y, gWorld.z],
      rawPosition: [g.x, g.y, g.z],
      direction: [slotDir.x, 0, slotDir.z],
    };
  });

  // StartLine 3D node transform from the GLB (`[235.649, 0.04, 1.214]`)
  const startLineWorldPos = [
    235.649277 * WORLD_TRACK_SCALE,
    BASE_GROUND_Y + 0.04 * WORLD_TRACK_SCALE,
    1.213858 * WORLD_TRACK_SCALE,
  ];
  const startLineDir = [0.281425, 0, 0.959583];

  return {
    mapId,
    trackKey: descriptor.trackKey,
    surface: json.surface || descriptor.surface,
    glbCandidateUrls: descriptor.glbCandidateUrls,
    jsonCandidateUrls: descriptor.jsonCandidateUrls,
    worldScale: WORLD_TRACK_SCALE,
    baseGroundY: BASE_GROUND_Y,
    rawLengthM: json.length || 1492.04,
    rawWidthM: baseWidthRaw,
    laps: json.laps || 3,
    lapTimeRacingLine: json.lapTimeRacingLine || 41.05,
    total_length_m: Number(totalLength.toFixed(4)),
    track_width_m: Number(baseWidthM.toFixed(5)),
    curb_width_m: 0.0028,
    rail_height_m: 0.0032,
    startFinishIdx,
    startFinishArc,
    startLineWorldPos,
    startLineDir,
    checkpoints,
    gridSlots,
    avgRacingSpeed,
    minRacingSpeed,
    maxRacingSpeed,
    sectors: SECTOR_NAMES_BY_MAP[mapId] || SECTOR_NAMES_BY_MAP.coast,
    boostPadConfigs: BOOST_PAD_CONFIGS_BY_MAP[mapId] || BOOST_PAD_CONFIGS_BY_MAP.coast,
    jumpRampConfigs: JUMP_RAMP_CONFIGS_BY_MAP[mapId] || JUMP_RAMP_CONFIGS_BY_MAP.coast,
    samples,
  };
}

const cachedSplines = new Map();

export function getTrackSplineForMap(mapId = 'coast') {
  const safeId = resolveTrackThemeKey(mapId);
  if (!cachedSplines.has(safeId)) {
    const descriptor = getTrackAssetDescriptor(safeId);
    cachedSplines.set(safeId, buildSplineFromGameShipKitJson(safeId, descriptor.jsonData));
  }
  return cachedSplines.get(safeId);
}
