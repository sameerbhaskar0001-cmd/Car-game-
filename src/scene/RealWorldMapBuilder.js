import * as THREE from 'three';
import { getMapTextures } from './ProceduralTextures.js';

/**
 * Builds a complete 3D Outdoor Racing World for the selected map ('coast' | 'city' | 'canyon'):
 * - 'coast' : Sunset Coastal Beach Highway (Animated ocean shader, sandy shore, instanced palms, cliffs, bay bridge)
 * - 'city'  : Midnight Neon City Circuit (Wet dark asphalt, instanced glowing skyscrapers, neon signs, streetlamps, tunnel)
 * - 'canyon': Alpine Mountain Canyon Pass (Granite canyon cliffs, instanced pine forest, gorge truss bridge, rock tunnel)
 *
 * Enforces:
 * 1. Explicit .computeBoundingSphere() on every InstancedMesh after setting instance matrices.
 * 2. Complete GPU memory disposal via dispose() when switching maps (keeping cached 256x256 textures pooled).
 */
export function buildRealWorldMap(mapId, splineData, scene) {
  const safeMapId = mapId === 'city' || mapId === 'canyon' ? mapId : 'coast';
  const rootGroup = new THREE.Group();
  rootGroup.name = `RealWorldMap_${safeMapId}`;
  scene.add(rootGroup);

  const disposableGeos = new Set();
  const disposableMats = new Set();

  function trackGeo(geo) {
    if (geo) disposableGeos.add(geo);
    return geo;
  }

  function trackMat(mat) {
    if (mat) disposableMats.add(mat);
    return mat;
  }

  const textures = getMapTextures(safeMapId);
  const samples = splineData.samples;
  const N = samples.length;
  const roadHalfW = (splineData.track_width_m || 0.024) * 0.5;
  const curbW = splineData.curb_width_m || 0.0026;
  const railH = splineData.rail_height_m || 0.0036;

  // -------------------------------------------------------------------------
  // 1. ATMOSPHERIC SKY DOME WITH SUN/MOON HALO SHADER
  // -------------------------------------------------------------------------
  const skyPresets = {
    coast: {
      zenith: new THREE.Color(0x0f172a),
      mid: new THREE.Color(0x1e3a5f),
      horizon: new THREE.Color(0xfb923c),
      nadir: new THREE.Color(0x082f49),
      sunColor: new THREE.Color(0xfef08a),
      sunDir: new THREE.Vector3(-0.45, 0.24, -0.86).normalize(),
      fogHex: 0x26293d,
      fogDensity: 0.28,
    },
    city: {
      zenith: new THREE.Color(0x03050c),
      mid: new THREE.Color(0x091024),
      horizon: new THREE.Color(0x162447),
      nadir: new THREE.Color(0x050811),
      sunColor: new THREE.Color(0x38bdf8),
      sunDir: new THREE.Vector3(0.35, 0.42, -0.84).normalize(),
      fogHex: 0x080d1d,
      fogDensity: 0.32,
    },
    canyon: {
      zenith: new THREE.Color(0x0b1324),
      mid: new THREE.Color(0x1e293b),
      horizon: new THREE.Color(0xf59e0b),
      nadir: new THREE.Color(0x0f172a),
      sunColor: new THREE.Color(0xfde68a),
      sunDir: new THREE.Vector3(-0.52, 0.30, -0.80).normalize(),
      fogHex: 0x1a2436,
      fogDensity: 0.30,
    },
  };
  const skyCfg = skyPresets[safeMapId];

  const skyGeo = trackGeo(new THREE.SphereGeometry(4.6, 32, 20));
  const skyMat = trackMat(
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        uZenith: { value: skyCfg.zenith },
        uMid: { value: skyCfg.mid },
        uHorizon: { value: skyCfg.horizon },
        uNadir: { value: skyCfg.nadir },
        uSunColor: { value: skyCfg.sunColor },
        uSunDir: { value: skyCfg.sunDir },
      },
      vertexShader: /* glsl */ `
        varying vec3 vWorldDir;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldDir = normalize(wp.xyz);
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uZenith;
        uniform vec3 uMid;
        uniform vec3 uHorizon;
        uniform vec3 uNadir;
        uniform vec3 uSunColor;
        uniform vec3 uSunDir;
        varying vec3 vWorldDir;
        void main() {
          vec3 d = normalize(vWorldDir);
          float h = d.y;
          vec3 col;
          if (h >= 0.0) {
            float t1 = smoothstep(0.0, 0.26, h);
            float t2 = smoothstep(0.22, 0.85, h);
            col = mix(uHorizon, uMid, t1);
            col = mix(col, uZenith, t2);
          } else {
            col = mix(uHorizon, uNadir, smoothstep(0.0, -0.35, h));
          }
          float sunDot = max(0.0, dot(d, normalize(uSunDir)));
          float sunHalo = pow(sunDot, 24.0) * 0.45 + pow(sunDot, 256.0) * 1.15;
          col += uSunColor * sunHalo;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
  );
  const skyMesh = new THREE.Mesh(skyGeo, skyMat);
  skyMesh.frustumCulled = false;
  rootGroup.add(skyMesh);

  const BASE_GROUND_Y = 0.0342;
  const bridgeRanges = Array.isArray(splineData.bridgeRanges) ? splineData.bridgeRanges : [];

  function getBridgeSpanMetrics(tFrac) {
    for (let b = 0; b < bridgeRanges.length; b++) {
      const [a, end] = bridgeRanges[b];
      if (tFrac >= a && tFrac <= end) {
        const u = (tFrac - a) / Math.max(1e-5, end - a);
        const isOpenSpan = u >= 0.22 && u <= 0.78;
        return { inBridge: true, isOpenSpan, isApproach: !isOpenSpan };
      }
    }
    return { inBridge: false, isOpenSpan: false, isApproach: false };
  }

  // Pre-collect strided grounded & open-bridge spline samples for O(1)-fast spatial terrain grounding
  const groundedSamples = [];
  const openBridgeSamples = [];
  for (let i = 0; i < N; i += 2) {
    const s = samples[i];
    const bm = getBridgeSpanMetrics(s.t);
    if (bm.isOpenSpan) {
      openBridgeSamples.push(s);
    } else if (!bm.inBridge) {
      groundedSamples.push(s);
    }
  }

  function smoothstep01(edge0, edge1, x) {
    const t = THREE.MathUtils.clamp((x - edge0) / Math.max(1e-5, edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function getCoastTerrainHeight(wx, wz) {
    let minGroundD2 = Infinity;
    for (let i = 0; i < groundedSamples.length; i++) {
      const p = groundedSamples[i].position;
      const dx = wx - p[0];
      const dz = wz - p[2];
      const d2 = dx * dx + dz * dz;
      if (d2 < minGroundD2) minGroundD2 = d2;
    }

    let minBridgeD2 = Infinity;
    for (let i = 0; i < openBridgeSamples.length; i++) {
      const p = openBridgeSamples[i].position;
      const dx = wx - p[0];
      const dz = wz - p[2];
      const d2 = dx * dx + dz * dz;
      if (d2 < minBridgeD2) minBridgeD2 = d2;
    }

    const dGround = Math.sqrt(minGroundD2);
    const dBridge = Math.sqrt(minBridgeD2);

    // Peninsula interior mask (keeps infield dry & sandy while leaving northern bay open water under bridge)
    const innerEllipse = (wx * wx) / (0.60 * 0.60) + ((wz - 0.05) * (wz - 0.05)) / (0.24 * 0.24);
    const insidePeninsula = wz > -0.145 && innerEllipse < 1.0;

    let h;
    if (insidePeninsula) {
      h = BASE_GROUND_Y;
    } else {
      const coastDrop = smoothstep01(0.042, 0.115, dGround);
      h = THREE.MathUtils.lerp(BASE_GROUND_Y, 0.004, coastDrop);
    }

    // Carve open turquoise ocean channel directly underneath Golden Bay Suspension Bridge span
    if (dBridge < 0.095 && dGround > 0.036) {
      const bayChannel = 1.0 - smoothstep01(0.045, 0.095, dBridge);
      const keepNearRoad = smoothstep01(0.036, 0.058, dGround);
      h = THREE.MathUtils.lerp(h, 0.004, bayChannel * keepNearRoad);
    }

    return h;
  }

  function getCanyonTerrainHeight(wx, wz) {
    let minGroundD2 = Infinity;
    let closestGroundY = BASE_GROUND_Y;
    let sumW = 0.0;
    let sumWY = 0.0;
    const invTwoSigmaSq = 1.0 / (2.0 * 0.038 * 0.038);

    for (let i = 0; i < groundedSamples.length; i++) {
      const p = groundedSamples[i].position;
      const dx = wx - p[0];
      const dz = wz - p[2];
      const d2 = dx * dx + dz * dz;
      if (d2 < minGroundD2) {
        minGroundD2 = d2;
        closestGroundY = p[1];
      }
      if (d2 < 0.052) {
        const w = Math.exp(-d2 * invTwoSigmaSq);
        sumW += w;
        sumWY += w * (p[1] - 0.0008);
      }
    }

    let minBridgeD2 = Infinity;
    for (let i = 0; i < openBridgeSamples.length; i++) {
      const p = openBridgeSamples[i].position;
      const dx = wx - p[0];
      const dz = wz - p[2];
      const d2 = dx * dx + dz * dz;
      if (d2 < minBridgeD2) minBridgeD2 = d2;
    }

    const dGround = Math.sqrt(minGroundD2);
    const dBridge = Math.sqrt(minBridgeD2);

    const roadBlendY = sumW > 1e-4 ? sumWY / sumW : BASE_GROUND_Y;
    const farFade = smoothstep01(0.046, 0.145, dGround);

    // Organic alpine mountain ridges surrounding the canyon circuit (kept clear of roadbed)
    const ridgeWave =
      0.5 +
      0.5 * Math.sin(wx * 5.2 + 0.7) * Math.cos(wz * 5.6 - 0.5) +
      0.28 * Math.sin((wx + wz) * 8.5);
    const outerRidgeH = 0.024 + Math.max(0, ridgeWave) * 0.046;

    let h = THREE.MathUtils.lerp(roadBlendY, outerRidgeH, farFade);

    // Carve deep misty gorge floor underneath Sector 3 Steel Truss Bridge span
    if (dBridge < 0.092 && dGround > 0.034) {
      const gorgeFactor = (1.0 - smoothstep01(0.038, 0.092, dBridge)) * smoothstep01(0.034, 0.060, dGround);
      h = THREE.MathUtils.lerp(h, 0.014, gorgeFactor);
    }

    // Strict roadbed lock: directly under grounded road & shoulders, never float below or poke above asphalt
    if (dGround < 0.028) {
      const lock = 1.0 - smoothstep01(0.012, 0.028, dGround);
      h = THREE.MathUtils.lerp(h, closestGroundY - 0.0008, lock);
    }

    return h;
  }

  function getTerrainHeightAt(wx, wz) {
    if (safeMapId === 'coast') return getCoastTerrainHeight(wx, wz);
    if (safeMapId === 'canyon') return getCanyonTerrainHeight(wx, wz);
    return BASE_GROUND_Y;
  }

  // -------------------------------------------------------------------------
  // 2. CONTINUOUS BANKED ASPHALT ROADBED, CURBS, SHOULDERS, EMBANKMENTS & RAILS
  // -------------------------------------------------------------------------
  const rings = N + 1;
  const roadPositions = new Float32Array(rings * 2 * 3);
  const roadNormals = new Float32Array(rings * 2 * 3);
  const roadUvs = new Float32Array(rings * 2 * 2);
  const roadIndices = [];

  const curbVerts = [];
  const curbNorms = [];
  const curbColors = [];
  const curbIndices = [];

  const railVerts = [];
  const railNorms = [];
  const railIndices = [];

  // Continuous Wide Ground Shoulders & Sub-Grade Skirt (zero air gaps beneath grounded road)
  const shoulderVerts = [];
  const shoulderNorms = [];
  const shoulderColors = [];
  const shoulderIndices = [];

  // Bridge Underside Box-Girder Deck & Solid Approach Retaining Embankments
  const underVerts = [];
  const underNorms = [];
  const underIndices = [];

  const _pos = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _norm = new THREE.Vector3();
  const _tang = new THREE.Vector3();
  const _flatRight = new THREE.Vector3();
  const _pL = new THREE.Vector3();
  const _pR = new THREE.Vector3();
  const _worldUp = new THREE.Vector3(0, 1, 0);

  const curbColorA =
    safeMapId === 'city'
      ? new THREE.Color(0x00e5ff)
      : safeMapId === 'canyon'
        ? new THREE.Color(0xfbbf24)
        : new THREE.Color(0xef4444);
  const curbColorB =
    safeMapId === 'city' ? new THREE.Color(0x1e293b) : new THREE.Color(0xf8fafc);

  const shoulderInnerCol =
    safeMapId === 'city'
      ? new THREE.Color(0x334155)
      : safeMapId === 'canyon'
        ? new THREE.Color(0x646b73)
        : new THREE.Color(0xcab998);
  const shoulderOuterCol =
    safeMapId === 'city'
      ? new THREE.Color(0x1e293b)
      : safeMapId === 'canyon'
        ? new THREE.Color(0x4b5548)
        : new THREE.Color(0xdcc292);

  const shoulderW = safeMapId === 'city' ? 0.022 : 0.020;
  const totalLen = splineData.total_length_m || 3.8;

  for (let i = 0; i < rings; i++) {
    const s = samples[i % N];
    _pos.fromArray(s.position);
    _right.fromArray(s.right);
    _norm.fromArray(s.normal);
    _tang.fromArray(s.tangent);

    _flatRight.crossVectors(_tang, _worldUp);
    if (_flatRight.lengthSq() < 1e-6) {
      _flatRight.set(1, 0, 0);
    } else {
      _flatRight.normalize();
    }

    const arc = i === N ? totalLen : s.arc_length_m;
    const vCoord = arc / totalLen;

    // Left and right asphalt edges
    _pL.copy(_pos).addScaledVector(_right, -roadHalfW);
    _pR.copy(_pos).addScaledVector(_right, roadHalfW);

    const vBase = i * 2;
    roadPositions[vBase * 3 + 0] = _pL.x;
    roadPositions[vBase * 3 + 1] = _pL.y;
    roadPositions[vBase * 3 + 2] = _pL.z;
    roadPositions[(vBase + 1) * 3 + 0] = _pR.x;
    roadPositions[(vBase + 1) * 3 + 1] = _pR.y;
    roadPositions[(vBase + 1) * 3 + 2] = _pR.z;

    roadNormals[vBase * 3 + 0] = _norm.x;
    roadNormals[vBase * 3 + 1] = _norm.y;
    roadNormals[vBase * 3 + 2] = _norm.z;
    roadNormals[(vBase + 1) * 3 + 0] = _norm.x;
    roadNormals[(vBase + 1) * 3 + 1] = _norm.y;
    roadNormals[(vBase + 1) * 3 + 2] = _norm.z;

    roadUvs[vBase * 2 + 0] = 0.0;
    roadUvs[vBase * 2 + 1] = vCoord;
    roadUvs[(vBase + 1) * 2 + 0] = 1.0;
    roadUvs[(vBase + 1) * 2 + 1] = vCoord;

    if (i < N) {
      const a = i * 2;
      const b = a + 1;
      const c = (i + 1) * 2;
      const d = c + 1;
      roadIndices.push(a, c, b, b, c, d);
    }

    // Left & Right raised curbs (2 vertices per side per ring)
    const cCol = Math.floor(i / 3) % 2 === 0 ? curbColorA : curbColorB;
    for (const side of [-1, 1]) {
      const innerR = side * roadHalfW;
      const outerR = side * (roadHalfW + curbW);
      const pIn = _pos
        .clone()
        .addScaledVector(_right, innerR)
        .addScaledVector(_norm, 0.0002);
      const pOut = _pos
        .clone()
        .addScaledVector(_right, outerR)
        .addScaledVector(_norm, 0.00055);
      curbVerts.push(pIn.x, pIn.y, pIn.z, pOut.x, pOut.y, pOut.z);
      curbNorms.push(_norm.x, _norm.y, _norm.z, _norm.x, _norm.y, _norm.z);
      curbColors.push(cCol.r, cCol.g, cCol.b, cCol.r, cCol.g, cCol.b);
    }

    if (i < N) {
      for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
        const r0 = i * 4 + sideIdx * 2;
        const r1 = (i + 1) * 4 + sideIdx * 2;
        if (sideIdx === 0) {
          curbIndices.push(r0 + 1, r1 + 1, r0, r0, r1 + 1, r1);
        } else {
          curbIndices.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1);
        }
      }
    }

    // Left & Right metallic guardrails along outer curb edge
    for (const side of [-1, 1]) {
      const railDist = side * (roadHalfW + curbW);
      const pBot = _pos
        .clone()
        .addScaledVector(_right, railDist)
        .addScaledVector(_norm, 0.0004);
      const pTop = _pos
        .clone()
        .addScaledVector(_right, railDist)
        .addScaledVector(_norm, railH);
      railVerts.push(pBot.x, pBot.y, pBot.z, pTop.x, pTop.y, pTop.z);
      railNorms.push(-side * _right.x, _norm.y, -side * _right.z);
      railNorms.push(-side * _right.x, _norm.y, -side * _right.z);
    }

    if (i < N) {
      for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
        const r0 = i * 4 + sideIdx * 2;
        const r1 = (i + 1) * 4 + sideIdx * 2;
        railIndices.push(r0, r1, r0 + 1, r0 + 1, r1, r1 + 1);
      }
    }

    // Wide Ground Shoulders + Sub-grade Retaining Skirt outside curbs (for all non-open-bridge rings)
    // 3 vertices per side: inner edge (flush under curb), outer shoulder bench, bottom underground skirt
    const bm = getBridgeSpanMetrics(s.t);
    const isElevatedGroundRamp = bm.inBridge || _pos.y > BASE_GROUND_Y + 0.002;
    for (const side of [-1, 1]) {
      const pCurbOuter = _pos
        .clone()
        .addScaledVector(_right, side * (roadHalfW + curbW * 0.7))
        .addScaledVector(_norm, 0.0001);

      // During open bridge spans, tuck shoulder neatly under deck so it doesn't stick into mid-air
      const effShoulderW = bm.isOpenSpan ? 0.001 : bm.isApproach ? 0.006 : shoulderW;
      const pMid = _pos
        .clone()
        .addScaledVector(_flatRight, side * (roadHalfW + curbW + effShoulderW));

      if (bm.isOpenSpan) {
        pMid.y = pCurbOuter.y - 0.0012;
      } else {
        const terrainY = getTerrainHeightAt(pMid.x, pMid.z);
        pMid.y = Math.min(pCurbOuter.y - 0.0004, Math.max(terrainY + 0.0002, pCurbOuter.y - 0.0018));
      }

      const skirtBottomY = bm.isOpenSpan
        ? pCurbOuter.y - 0.0036
        : Math.min(pMid.y - 0.012, BASE_GROUND_Y - 0.018);

      const pBot = new THREE.Vector3(
        pMid.x + _flatRight.x * side * (bm.isApproach ? 0.005 : 0.002),
        skirtBottomY,
        pMid.z + _flatRight.z * side * (bm.isApproach ? 0.005 : 0.002)
      );

      shoulderVerts.push(
        pCurbOuter.x,
        pCurbOuter.y,
        pCurbOuter.z,
        pMid.x,
        pMid.y,
        pMid.z,
        pBot.x,
        pBot.y,
        pBot.z
      );
      shoulderNorms.push(
        0, 1, 0,
        0, 1, 0,
        side * _flatRight.x, 0.25, side * _flatRight.z
      );
      shoulderColors.push(
        shoulderInnerCol.r,
        shoulderInnerCol.g,
        shoulderInnerCol.b,
        shoulderOuterCol.r,
        shoulderOuterCol.g,
        shoulderOuterCol.b,
        shoulderOuterCol.r * 0.72,
        shoulderOuterCol.g * 0.72,
        shoulderOuterCol.b * 0.72
      );
    }

    if (i < N) {
      for (let sideIdx = 0; sideIdx < 2; sideIdx++) {
        const s0 = i * 6 + sideIdx * 3;
        const s1 = (i + 1) * 6 + sideIdx * 3;
        if (sideIdx === 0) {
          shoulderIndices.push(
            s0 + 1, s1 + 1, s0, s0, s1 + 1, s1,
            s0 + 2, s1 + 2, s0 + 1, s0 + 1, s1 + 2, s1 + 1
          );
        } else {
          shoulderIndices.push(
            s0, s1, s0 + 1, s0 + 1, s1, s1 + 1,
            s0 + 1, s1 + 1, s0 + 2, s0 + 2, s1 + 1, s1 + 2
          );
        }
      }
    }

    // Solid Concrete Retaining Embankment Walls (for Bridge Approach Ramps) & Box-Girder Deck (for Bridges)
    // 4 vertices per ring: Left Top, Left Bottom, Right Bottom, Right Top
    const deckW = roadHalfW + curbW + 0.0008;
    const dropDepth = bm.isOpenSpan
      ? 0.0042
      : bm.isApproach || (safeMapId !== 'canyon' && isElevatedGroundRamp)
        ? Math.max(0.012, _pos.y - 0.008)
        : 0.0045;

    const uLT = _pos.clone().addScaledVector(_right, -deckW).addScaledVector(_norm, -0.0002);
    const uRT = _pos.clone().addScaledVector(_right, deckW).addScaledVector(_norm, -0.0002);
    const flare = bm.isApproach ? 0.0045 : bm.isOpenSpan ? -0.0018 : 0.0015;
    const uLB = new THREE.Vector3(
      uLT.x - _flatRight.x * flare,
      _pos.y - dropDepth,
      uLT.z - _flatRight.z * flare
    );
    const uRB = new THREE.Vector3(
      uRT.x + _flatRight.x * flare,
      _pos.y - dropDepth,
      uRT.z + _flatRight.z * flare
    );

    underVerts.push(
      uLT.x, uLT.y, uLT.z,
      uLB.x, uLB.y, uLB.z,
      uRB.x, uRB.y, uRB.z,
      uRT.x, uRT.y, uRT.z
    );
    underNorms.push(
      -_flatRight.x, -0.1, -_flatRight.z,
      -_flatRight.x, -0.6, -_flatRight.z,
      _flatRight.x, -0.6, _flatRight.z,
      _flatRight.x, -0.1, _flatRight.z
    );

    if (i < N) {
      const u0 = i * 4;
      const u1 = (i + 1) * 4;
      // Left retaining wall, underside soffit, right retaining wall
      underIndices.push(
        u0, u0 + 1, u1, u1, u0 + 1, u1 + 1,
        u0 + 1, u0 + 2, u1 + 1, u1 + 1, u0 + 2, u1 + 2,
        u0 + 2, u0 + 3, u1 + 2, u1 + 2, u0 + 3, u1 + 3
      );
    }
  }

  const roadGeo = trackGeo(new THREE.BufferGeometry());
  roadGeo.setAttribute('position', new THREE.BufferAttribute(roadPositions, 3));
  roadGeo.setAttribute('normal', new THREE.BufferAttribute(roadNormals, 3));
  roadGeo.setAttribute('uv', new THREE.BufferAttribute(roadUvs, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeBoundingSphere();

  const roadMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.asphaltTex,
      roughness: safeMapId === 'city' ? 0.34 : 0.68,
      metalness: safeMapId === 'city' ? 0.32 : 0.12,
      side: THREE.DoubleSide,
    })
  );
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  rootGroup.add(roadMesh);

  const curbGeo = trackGeo(new THREE.BufferGeometry());
  curbGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbVerts, 3));
  curbGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbNorms, 3));
  curbGeo.setAttribute('color', new THREE.Float32BufferAttribute(curbColors, 3));
  curbGeo.setIndex(curbIndices);
  curbGeo.computeBoundingSphere();

  const curbMat = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.45,
      metalness: 0.2,
      side: THREE.DoubleSide,
    })
  );
  const curbMesh = new THREE.Mesh(curbGeo, curbMat);
  curbMesh.receiveShadow = true;
  rootGroup.add(curbMesh);

  const shoulderGeo = trackGeo(new THREE.BufferGeometry());
  shoulderGeo.setAttribute('position', new THREE.Float32BufferAttribute(shoulderVerts, 3));
  shoulderGeo.setAttribute('normal', new THREE.Float32BufferAttribute(shoulderNorms, 3));
  shoulderGeo.setAttribute('color', new THREE.Float32BufferAttribute(shoulderColors, 3));
  shoulderGeo.setIndex(shoulderIndices);
  shoulderGeo.computeBoundingSphere();

  const shoulderMat = trackMat(
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: safeMapId === 'city' ? 0.58 : 0.88,
      metalness: safeMapId === 'city' ? 0.22 : 0.06,
      side: THREE.DoubleSide,
    })
  );
  const shoulderMesh = new THREE.Mesh(shoulderGeo, shoulderMat);
  shoulderMesh.receiveShadow = true;
  rootGroup.add(shoulderMesh);

  const underGeo = trackGeo(new THREE.BufferGeometry());
  underGeo.setAttribute('position', new THREE.Float32BufferAttribute(underVerts, 3));
  underGeo.setAttribute('normal', new THREE.Float32BufferAttribute(underNorms, 3));
  underGeo.setIndex(underIndices);
  underGeo.computeBoundingSphere();

  const underMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: safeMapId === 'city' ? 0x263142 : safeMapId === 'canyon' ? 0x545d68 : 0x9aa4b0,
      roughness: 0.72,
      metalness: 0.28,
      side: THREE.DoubleSide,
    })
  );
  const underMesh = new THREE.Mesh(underGeo, underMat);
  underMesh.receiveShadow = true;
  rootGroup.add(underMesh);

  const railGeo = trackGeo(new THREE.BufferGeometry());
  railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railVerts, 3));
  railGeo.setAttribute('normal', new THREE.Float32BufferAttribute(railNorms, 3));
  railGeo.setIndex(railIndices);
  railGeo.computeBoundingSphere();

  const railMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: safeMapId === 'city' ? 0x38bdf8 : safeMapId === 'canyon' ? 0x94a3b8 : 0xe2e8f0,
      emissive: safeMapId === 'city' ? new THREE.Color(0x0284c7) : new THREE.Color(0x000000),
      emissiveIntensity: safeMapId === 'city' ? 0.45 : 0.0,
      roughness: 0.35,
      metalness: 0.72,
      side: THREE.DoubleSide,
    })
  );
  const railMesh = new THREE.Mesh(railGeo, railMat);
  rootGroup.add(railMesh);

  // -------------------------------------------------------------------------
  // 3. BRIDGES, PYLONS & ILLUMINATED HIGHWAY TUNNELS ALONG SPLINE
  // -------------------------------------------------------------------------
  const structureMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: safeMapId === 'coast' ? 0xe2e8f0 : safeMapId === 'city' ? 0x1e293b : 0x64748b,
      roughness: 0.42,
      metalness: 0.68,
    })
  );
  const bridgeAccentMat = trackMat(
    new THREE.MeshBasicMaterial({
      color: safeMapId === 'coast' ? 0xfb923c : safeMapId === 'city' ? 0x00e5ff : 0xfbbf24,
      toneMapped: false,
    })
  );
  const tunnelWallMat = trackMat(
    new THREE.MeshStandardMaterial({
      color: safeMapId === 'city' ? 0x0f172a : 0x334155,
      roughness: 0.72,
      metalness: 0.25,
      side: THREE.DoubleSide,
    })
  );

  const pylonGeo = trackGeo(new THREE.CylinderGeometry(0.0026, 0.0034, 1.0, 10));
  const archTowerGeo = trackGeo(new THREE.BoxGeometry(0.0024, 0.036, 0.0024));
  const crossBeamGeo = trackGeo(new THREE.BoxGeometry(roadHalfW * 2.6, 0.0022, 0.0024));
  const topAccentGeo = trackGeo(new THREE.BoxGeometry(roadHalfW * 2.4, 0.0008, 0.0028));
  const tunnelArchGeo = trackGeo(
    new THREE.CylinderGeometry(roadHalfW * 1.48, roadHalfW * 1.48, 0.014, 14, 1, true, 0, Math.PI)
  );
  tunnelArchGeo.rotateZ(Math.PI / 2);
  tunnelArchGeo.rotateY(Math.PI / 2);
  const tunnelLightGeo = trackGeo(new THREE.BoxGeometry(0.0032, 0.0006, 0.009));

  const _left = new THREE.Vector3();
  const _rotMat = new THREE.Matrix4();

  for (let i = 0; i < N; i += 8) {
    const s = samples[i];
    _pos.fromArray(s.position);
    _right.fromArray(s.right);
    _norm.fromArray(s.normal);
    _tang.fromArray(s.tangent);
    _left.crossVectors(_norm, _tang).normalize();
    _rotMat.makeBasis(_left, _norm, _tang);
    const frameQuat = new THREE.Quaternion().setFromRotationMatrix(_rotMat);

    const bm = getBridgeSpanMetrics(s.t);

    // Architectural concrete/steel piers ONLY under open bridge spans (ramps sit on solid embankments)
    if (bm.isOpenSpan) {
      const h = Math.max(0.02, _pos.y + 0.008);
      const pylon = new THREE.Mesh(pylonGeo, structureMat);
      pylon.scale.set(1, h, 1);
      pylon.position.set(_pos.x, _pos.y - h * 0.5 - 0.002, _pos.z);
      rootGroup.add(pylon);
    }

    // Bridge suspension towers / canyon truss portals along bridge spans
    if (bm.isOpenSpan && i % 16 === 0) {
      const portalGroup = new THREE.Group();
      portalGroup.position.copy(_pos);
      portalGroup.quaternion.copy(frameQuat);

      const lTower = new THREE.Mesh(archTowerGeo, structureMat);
      lTower.position.set(-(roadHalfW + curbW + 0.0015), 0.016, 0);
      const rTower = new THREE.Mesh(archTowerGeo, structureMat);
      rTower.position.set(roadHalfW + curbW + 0.0015, 0.016, 0);
      const topBeam = new THREE.Mesh(crossBeamGeo, structureMat);
      topBeam.position.set(0, 0.032, 0);
      const topAccent = new THREE.Mesh(topAccentGeo, bridgeAccentMat);
      topAccent.position.set(0, 0.030, 0);

      portalGroup.add(lTower, rTower, topBeam, topAccent);
      rootGroup.add(portalGroup);
    }

    // Illuminated Tunnel Arches embedded cleanly onto grounded tunnel segments
    if (s.isTunnel && i % 6 === 0) {
      const tunnelSeg = new THREE.Group();
      tunnelSeg.position.copy(_pos);
      tunnelSeg.quaternion.copy(frameQuat);

      const arch = new THREE.Mesh(tunnelArchGeo, tunnelWallMat);
      arch.position.set(0, 0.0005, 0);
      tunnelSeg.add(arch);

      const ceilLight = new THREE.Mesh(tunnelLightGeo, bridgeAccentMat);
      ceilLight.position.set(0, roadHalfW * 1.42, 0);
      tunnelSeg.add(ceilLight);

      rootGroup.add(tunnelSeg);
    }
  }

  // -------------------------------------------------------------------------
  // 4. START / FINISH GANTRY & 5 FORMULA-1 COUNTDOWN RED LIGHT PODS
  // -------------------------------------------------------------------------
  const startIdx = splineData.startFinishIdx || Math.min(646, N - 1);
  const startSample = samples[startIdx];
  const gantryGroup = new THREE.Group();
  gantryGroup.name = 'StartFinishGantryGroup';

  const sPos = new THREE.Vector3().fromArray(startSample.position);
  const sNorm = new THREE.Vector3().fromArray(startSample.normal);
  const sTang = new THREE.Vector3().fromArray(startSample.tangent);
  const sLeft = new THREE.Vector3().crossVectors(sNorm, sTang).normalize();
  const sBasis = new THREE.Matrix4().makeBasis(sLeft, sNorm, sTang);

  gantryGroup.position.copy(sPos);
  gantryGroup.quaternion.setFromRotationMatrix(sBasis);
  rootGroup.add(gantryGroup);

  const gantrySpan = (roadHalfW + curbW) * 2.15;
  const gantryH = 0.024;
  const postGeo = trackGeo(new THREE.CylinderGeometry(0.0012, 0.0014, gantryH, 12));
  for (const gx of [-gantrySpan * 0.5, gantrySpan * 0.5]) {
    const post = new THREE.Mesh(postGeo, structureMat);
    post.position.set(gx, gantryH * 0.5 - 0.0006, 0);
    gantryGroup.add(post);
  }

  const bannerGeo = trackGeo(new THREE.BoxGeometry(gantrySpan + 0.004, 0.0068, 0.0024));
  const bannerMat = trackMat(
    new THREE.MeshStandardMaterial({
      map: textures.gantryTex,
      roughness: 0.3,
      metalness: 0.4,
    })
  );
  const bannerMesh = new THREE.Mesh(bannerGeo, bannerMat);
  bannerMesh.position.set(0, gantryH - 0.002, 0);
  gantryGroup.add(bannerMesh);

  // 5 F1 Countdown Light Pods mounted beneath the Start/Finish Banner
  const f1PodGeo = trackGeo(new THREE.SphereGeometry(0.00095, 12, 12));
  const f1LightMats = [];
  for (let l = 0; l < 5; l++) {
    const podMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0.0,
        roughness: 0.25,
        toneMapped: false,
      })
    );
    f1LightMats.push(podMat);
    const pod = new THREE.Mesh(f1PodGeo, podMat);
    const lx = (l - 2) * 0.0034;
    pod.position.set(lx, gantryH - 0.0064, 0.0014);
    gantryGroup.add(pod);
  }

  function setF1StartLights(activeRedCount = 0) {
    for (let i = 0; i < 5; i++) {
      const isLit = i < activeRedCount;
      const mat = f1LightMats[i];
      if (isLit) {
        mat.color.setHex(0xff1e26);
        mat.emissive.setHex(0xff1e26);
        mat.emissiveIntensity = 2.6;
      } else {
        mat.color.setHex(0x1e293b);
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0.0;
      }
    }
  }

  function attachTrafficLightGlb(glbScene) {
    if (!glbScene) return;
    const clone = glbScene.clone(true);
    clone.scale.setScalar(0.0038);
    clone.position.set(gantrySpan * 0.5 + 0.0025, -0.0005, 0.004);
    clone.rotation.y = Math.PI;
    gantryGroup.add(clone);
  }

  // -------------------------------------------------------------------------
  // 5. MAP-SPECIFIC GROUNDED TERRAIN & INSTANCEDMESH SCENERY
  // -------------------------------------------------------------------------
  let oceanUniforms = null;
  const dummy = new THREE.Object3D();

  // Helper to verify whether a candidate (x, z) point is safely clear of the road + wide shoulders
  function isClearOfTrack(wx, wz, minClearance = 0.042) {
    const minSq = minClearance * minClearance;
    for (let i = 0; i < N; i += 4) {
      const sp = samples[i].position;
      const dx = wx - sp[0];
      const dz = wz - sp[2];
      if (dx * dx + dz * dz < minSq) return false;
    }
    return true;
  }

  if (safeMapId === 'coast') {
    // A. Animated Turquoise-to-Navy Ocean Water Plane
    oceanUniforms = {
      uTime: { value: 0.0 },
      uWaterTex: { value: textures.detailTex },
    };
    const oceanGeo = trackGeo(new THREE.PlaneGeometry(5.2, 5.2, 48, 48));
    const oceanMat = trackMat(
      new THREE.ShaderMaterial({
        uniforms: oceanUniforms,
        vertexShader: /* glsl */ `
          uniform float uTime;
          varying vec2 vUv;
          varying float vWave;
          void main() {
            vUv = uv * 16.0;
            vec3 pos = position;
            float w = sin(pos.x * 14.0 + uTime * 1.8) * 0.0022
                    + cos(pos.y * 12.0 - uTime * 1.4) * 0.0018;
            pos.z += w;
            vWave = w;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: /* glsl */ `
          uniform float uTime;
          uniform sampler2D uWaterTex;
          varying vec2 vUv;
          varying float vWave;
          void main() {
            vec2 uvA = vUv + vec2(uTime * 0.03, uTime * 0.02);
            vec3 texCol = texture2D(uWaterTex, uvA).rgb;
            vec3 turquoise = vec3(0.04, 0.58, 0.78);
            vec3 deepNavy = vec3(0.02, 0.22, 0.42);
            float crest = smoothstep(-0.002, 0.0025, vWave);
            vec3 col = mix(deepNavy, turquoise, crest * 0.75 + 0.25) * 0.65 + texCol * 0.45;
            col += vec3(0.85, 0.96, 1.0) * smoothstep(0.0016, 0.0026, vWave) * 0.28;
            gl_FragColor = vec4(col, 1.0);
          }
        `,
      })
    );
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.rotation.x = -Math.PI / 2;
    oceanMesh.position.set(0.0, 0.012, 0.0);
    rootGroup.add(oceanMesh);

    // B. Sculpted Coastal Peninsula Terrain Mesh (flush y=0.0342 beneath land loop, dropping into bay water under bridge)
    const coastTerrainGeo = trackGeo(new THREE.PlaneGeometry(2.2, 1.9, 96, 96));
    coastTerrainGeo.rotateX(-Math.PI / 2);
    const ctPos = coastTerrainGeo.attributes.position;
    const ctColors = new Float32Array(ctPos.count * 3);
    const colSand = new THREE.Color(0xffffff);
    const colGrass = new THREE.Color(0x8fd67c);
    const colWetSand = new THREE.Color(0x9a8c78);
    const tmpCol = new THREE.Color();

    for (let v = 0; v < ctPos.count; v++) {
      const vx = ctPos.getX(v);
      const vz = ctPos.getZ(v) + 0.04;
      const vy = getCoastTerrainHeight(vx, vz);
      ctPos.setXYZ(v, vx, vy, vz);

      if (vy < 0.018) {
        tmpCol.copy(colWetSand);
      } else {
        const grassMix = smoothstep01(0.024, 0.0342, vy) * (isClearOfTrack(vx, vz, 0.065) ? 0.55 : 0.0);
        tmpCol.copy(colSand).lerp(colGrass, grassMix);
      }
      ctColors[v * 3 + 0] = tmpCol.r;
      ctColors[v * 3 + 1] = tmpCol.g;
      ctColors[v * 3 + 2] = tmpCol.b;
    }
    coastTerrainGeo.setAttribute('color', new THREE.BufferAttribute(ctColors, 3));
    coastTerrainGeo.computeVertexNormals();
    coastTerrainGeo.computeBoundingSphere();

    const sandMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.terrainTex,
        vertexColors: true,
        roughness: 0.86,
        metalness: 0.04,
      })
    );
    const coastTerrainMesh = new THREE.Mesh(coastTerrainGeo, sandMat);
    coastTerrainMesh.receiveShadow = true;
    rootGroup.add(coastTerrainMesh);

    // C. Instanced Swaying Palm Trees (110 Palms rooted directly onto dry peninsula sand)
    const palmCoords = [];
    for (let i = 0; i < 280 && palmCoords.length < 110; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const radius = 0.075 + ((i * 37) % 100) * 0.0068;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius * 0.72 + 0.04;
      const groundH = getCoastTerrainHeight(px, pz);
      if (groundH < 0.028) continue; // Only plant on dry peninsula land, never in ocean water
      if (isClearOfTrack(px, pz, 0.042)) {
        palmCoords.push([px, groundH - 0.001, pz, 0.75 + (i % 5) * 0.14, angle]);
      }
    }

    const palmCount = palmCoords.length;
    const trunkGeo = trackGeo(new THREE.CylinderGeometry(0.0014, 0.0024, 0.038, 7));
    trunkGeo.translate(0, 0.019, 0);
    const trunkMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x78553a, roughness: 0.85 })
    );
    const crownGeo = trackGeo(new THREE.ConeGeometry(0.013, 0.012, 7));
    crownGeo.translate(0, 0.040, 0);
    const crownMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.65 })
    );

    const instTrunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
    const instCrowns = new THREE.InstancedMesh(crownGeo, crownMat, palmCount);

    for (let i = 0; i < palmCount; i++) {
      const [px, py, pz, sc, rotY] = palmCoords[i];
      dummy.position.set(px, py, pz);
      dummy.rotation.set(0.08 * Math.sin(i), rotY, 0.06 * Math.cos(i));
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      instTrunks.setMatrixAt(i, dummy.matrix);
      instCrowns.setMatrixAt(i, dummy.matrix);
    }
    instTrunks.instanceMatrix.needsUpdate = true;
    instCrowns.instanceMatrix.needsUpdate = true;
    instTrunks.computeBoundingSphere();
    instCrowns.computeBoundingSphere();
    rootGroup.add(instTrunks, instCrowns);

    // D. Instanced Coastal Headland Cliffs (28 Boulders/Cliffs rooted cleanly on shore/waterline)
    const cliffGeo = trackGeo(new THREE.DodecahedronGeometry(0.038, 1));
    const cliffMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x64748b,
        roughness: 0.82,
        metalness: 0.12,
      })
    );
    const instCliffs = new THREE.InstancedMesh(cliffGeo, cliffMat, 28);
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      const r = 0.72 + (i % 3) * 0.09;
      const cx = Math.cos(a) * r;
      const cz = Math.sin(a) * r * 0.78;
      const ch = Math.max(0.010, getCoastTerrainHeight(cx, cz));
      dummy.position.set(cx, ch + 0.008 + (i % 3) * 0.008, cz);
      dummy.rotation.set(i * 0.4, i * 0.9, 0);
      dummy.scale.set(1.2 + (i % 3) * 0.4, 0.9 + (i % 4) * 0.45, 1.1);
      dummy.updateMatrix();
      instCliffs.setMatrixAt(i, dummy.matrix);
    }
    instCliffs.instanceMatrix.needsUpdate = true;
    instCliffs.computeBoundingSphere();
    rootGroup.add(instCliffs);
  } else if (safeMapId === 'city') {
    // A. Dark Midnight Urban Plaza Ground Grid (flush at BASE_GROUND_Y = 0.0342 beneath grounded streets)
    const cityFloorGeo = trackGeo(new THREE.PlaneGeometry(5.0, 5.0));
    const cityFloorMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.terrainTex,
        roughness: 0.42,
        metalness: 0.38,
      })
    );
    const cityFloor = new THREE.Mesh(cityFloorGeo, cityFloorMat);
    cityFloor.rotation.x = -Math.PI / 2;
    cityFloor.position.set(0.0, BASE_GROUND_Y, 0.0);
    cityFloor.receiveShadow = true;
    rootGroup.add(cityFloor);

    // B. Instanced Illuminated High-Rise Skyscrapers (88 Towers rooted cleanly on cityFloor)
    const towerCoords = [];
    for (let i = 0; i < 240 && towerCoords.length < 88; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const radius = 0.095 + ((i * 41) % 100) * 0.0082;
      const tx = Math.cos(angle) * radius;
      const tz = Math.sin(angle) * radius * 0.78;
      if (isClearOfTrack(tx, tz, 0.050)) {
        const w = 0.028 + (i % 4) * 0.008;
        const h = 0.075 + (i % 7) * 0.032;
        const d = 0.028 + ((i + 2) % 4) * 0.008;
        towerCoords.push([tx, BASE_GROUND_Y - 0.001, tz, w, h, d, (i % 4) * (Math.PI * 0.5)]);
      }
    }

    const towerCount = towerCoords.length;
    const towerGeo = trackGeo(new THREE.BoxGeometry(1, 1, 1));
    towerGeo.translate(0, 0.5, 0);
    const towerMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.detailTex,
        emissiveMap: textures.detailTex,
        emissive: new THREE.Color(0xffffff),
        emissiveIntensity: 0.92,
        roughness: 0.28,
        metalness: 0.65,
      })
    );

    const roofCrownGeo = trackGeo(new THREE.BoxGeometry(1.03, 0.025, 1.03));
    const roofCrownMat = trackMat(
      new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        toneMapped: false,
      })
    );

    const instTowers = new THREE.InstancedMesh(towerGeo, towerMat, towerCount);
    const instCrowns = new THREE.InstancedMesh(roofCrownGeo, roofCrownMat, towerCount);

    for (let i = 0; i < towerCount; i++) {
      const [tx, ty, tz, w, h, d, rotY] = towerCoords[i];
      dummy.position.set(tx, ty, tz);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(w, h, d);
      dummy.updateMatrix();
      instTowers.setMatrixAt(i, dummy.matrix);

      dummy.position.set(tx, ty + h, tz);
      dummy.scale.set(w, 0.08, d);
      dummy.updateMatrix();
      instCrowns.setMatrixAt(i, dummy.matrix);
    }
    instTowers.instanceMatrix.needsUpdate = true;
    instCrowns.instanceMatrix.needsUpdate = true;
    instTowers.computeBoundingSphere();
    instCrowns.computeBoundingSphere();
    rootGroup.add(instTowers, instCrowns);

    // C. Instanced Roadside Neon Streetlamps along the Circuit (rooted into sidewalk)
    const lampIndices = [];
    for (let i = 0; i < N; i += 12) {
      if (!samples[i].isTunnel) lampIndices.push(i);
    }
    const lampCount = lampIndices.length;
    const poleGeo = trackGeo(new THREE.CylinderGeometry(0.0005, 0.0007, 0.022, 6));
    poleGeo.translate(0, 0.0105, 0);
    const bulbGeo = trackGeo(new THREE.BoxGeometry(0.0038, 0.0008, 0.0014));
    bulbGeo.translate(-0.0014, 0.0215, 0);
    const bulbMat = trackMat(
      new THREE.MeshBasicMaterial({ color: 0x38bdf8, toneMapped: false })
    );

    const instPoles = new THREE.InstancedMesh(poleGeo, structureMat, lampCount);
    const instBulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, lampCount);

    for (let idx = 0; idx < lampCount; idx++) {
      const s = samples[lampIndices[idx]];
      const side = idx % 2 === 0 ? 1 : -1;
      _pos.fromArray(s.position);
      _right.fromArray(s.right);
      _norm.fromArray(s.normal);
      _tang.fromArray(s.tangent);
      _left.crossVectors(_norm, _tang).normalize();
      _rotMat.makeBasis(_left, _norm, _tang);

      dummy.position
        .copy(_pos)
        .addScaledVector(_right, side * (roadHalfW + curbW + 0.0022))
        .addScaledVector(_norm, -0.0004);
      dummy.quaternion.setFromRotationMatrix(_rotMat);
      if (side < 0) dummy.rotateY(Math.PI);
      dummy.scale.setScalar(1.0);
      dummy.updateMatrix();
      instPoles.setMatrixAt(idx, dummy.matrix);
      instBulbs.setMatrixAt(idx, dummy.matrix);
    }
    instPoles.instanceMatrix.needsUpdate = true;
    instBulbs.instanceMatrix.needsUpdate = true;
    instPoles.computeBoundingSphere();
    instBulbs.computeBoundingSphere();
    rootGroup.add(instPoles, instBulbs);
  } else {
    // 'canyon': Alpine Mountain Canyon Pass
    // A1. Outer Horizon Valley Floor beneath the sculpted mountain heightfield
    const outerFloorGeo = trackGeo(new THREE.PlaneGeometry(5.2, 5.2));
    const outerFloorMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.terrainTex,
        roughness: 0.9,
        metalness: 0.06,
      })
    );
    const outerFloor = new THREE.Mesh(outerFloorGeo, outerFloorMat);
    outerFloor.rotation.x = -Math.PI / 2;
    outerFloor.position.set(0.0, 0.015, 0.0);
    outerFloor.receiveShadow = true;
    rootGroup.add(outerFloor);

    // A2. Sculpted 3D Alpine Mountain Heightfield (raises terrain directly beneath hill climbs & switchbacks)
    const canyonTerrainGeo = trackGeo(new THREE.PlaneGeometry(2.3, 1.9, 112, 112));
    canyonTerrainGeo.rotateX(-Math.PI / 2);
    const cyPos = canyonTerrainGeo.attributes.position;
    const cyColors = new Float32Array(cyPos.count * 3);
    const colValleyMoss = new THREE.Color(0xb8d4b2);
    const colAlpineGranite = new THREE.Color(0xe2e8f0);
    const colPeakSlate = new THREE.Color(0xffffff);
    const tmpCyCol = new THREE.Color();

    for (let v = 0; v < cyPos.count; v++) {
      const vx = cyPos.getX(v);
      const vz = cyPos.getZ(v);
      const vy = getCanyonTerrainHeight(vx, vz);
      cyPos.setXYZ(v, vx, vy, vz);

      const altT = smoothstep01(0.025, 0.095, vy);
      tmpCyCol.copy(colValleyMoss).lerp(colAlpineGranite, Math.min(1, altT * 1.15));
      if (vy > 0.088) {
        tmpCyCol.lerp(colPeakSlate, smoothstep01(0.088, 0.125, vy) * 0.65);
      }
      cyColors[v * 3 + 0] = tmpCyCol.r;
      cyColors[v * 3 + 1] = tmpCyCol.g;
      cyColors[v * 3 + 2] = tmpCyCol.b;
    }
    canyonTerrainGeo.setAttribute('color', new THREE.BufferAttribute(cyColors, 3));
    canyonTerrainGeo.computeVertexNormals();
    canyonTerrainGeo.computeBoundingSphere();

    const valleyMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.terrainTex,
        vertexColors: true,
        roughness: 0.88,
        metalness: 0.08,
      })
    );
    const canyonTerrainMesh = new THREE.Mesh(canyonTerrainGeo, valleyMat);
    canyonTerrainMesh.receiveShadow = true;
    rootGroup.add(canyonTerrainMesh);

    // A3. Shimmering Canyon Gorge River beneath the Misty Gorge Steel Truss Bridge
    const gorgeRiverGeo = trackGeo(new THREE.PlaneGeometry(0.16, 0.72));
    const gorgeRiverMat = trackMat(
      new THREE.MeshStandardMaterial({
        color: 0x0e7490,
        roughness: 0.18,
        metalness: 0.65,
      })
    );
    const gorgeRiver = new THREE.Mesh(gorgeRiverGeo, gorgeRiverMat);
    gorgeRiver.rotation.x = -Math.PI / 2;
    gorgeRiver.position.set(0.0, 0.0175, -0.32);
    rootGroup.add(gorgeRiver);

    // B. Instanced Towering Granite Canyon Cliff Monoliths (56 Cliffs seated on raised mountain terrain)
    const cliffCoords = [];
    for (let i = 0; i < 180 && cliffCoords.length < 56; i++) {
      const angle = (i * 2.39996) % (Math.PI * 2);
      const radius = 0.11 + ((i * 53) % 100) * 0.0085;
      const cx = Math.cos(angle) * radius;
      const cz = Math.sin(angle) * radius * 0.82;
      if (isClearOfTrack(cx, cz, 0.056)) {
        const groundH = getCanyonTerrainHeight(cx, cz);
        const sx = 0.042 + (i % 4) * 0.018;
        const sy = 0.065 + (i % 6) * 0.036;
        const sz = 0.042 + ((i + 1) % 4) * 0.018;
        cliffCoords.push([cx, groundH - 0.004, cz, sx, sy, sz, i * 0.7]);
      }
    }

    const cliffCount = cliffCoords.length;
    const monolithGeo = trackGeo(new THREE.ConeGeometry(0.65, 1.0, 6));
    monolithGeo.translate(0, 0.45, 0);
    const monolithMat = trackMat(
      new THREE.MeshStandardMaterial({
        map: textures.detailTex,
        roughness: 0.86,
        metalness: 0.12,
        flatShading: true,
      })
    );
    const instMonoliths = new THREE.InstancedMesh(monolithGeo, monolithMat, cliffCount);
    for (let i = 0; i < cliffCount; i++) {
      const [cx, cy, cz, sx, sy, sz, rotY] = cliffCoords[i];
      dummy.position.set(cx, cy, cz);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.set(sx, sy, sz);
      dummy.updateMatrix();
      instMonoliths.setMatrixAt(i, dummy.matrix);
    }
    instMonoliths.instanceMatrix.needsUpdate = true;
    instMonoliths.computeBoundingSphere();
    rootGroup.add(instMonoliths);

    // C. Instanced Evergreen Alpine Pine Forest (140 Pine Trees rooted directly onto mountain terrain)
    const pineCoords = [];
    for (let i = 0; i < 300 && pineCoords.length < 140; i++) {
      const angle = (i * 1.61803) % (Math.PI * 2);
      const radius = 0.075 + ((i * 29) % 100) * 0.0075;
      const px = Math.cos(angle) * radius;
      const pz = Math.sin(angle) * radius * 0.76;
      if (isClearOfTrack(px, pz, 0.040)) {
        const groundH = getCanyonTerrainHeight(px, pz);
        if (groundH < 0.020) continue; // Keep deep water gorge bed clear of trees
        pineCoords.push([px, groundH - 0.001, pz, 0.8 + (i % 5) * 0.16, angle]);
      }
    }

    const pineCount = pineCoords.length;
    const pTrunkGeo = trackGeo(new THREE.CylinderGeometry(0.0012, 0.0018, 0.016, 6));
    pTrunkGeo.translate(0, 0.008, 0);
    const pTrunkMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 })
    );
    const pConeGeo = trackGeo(new THREE.ConeGeometry(0.011, 0.036, 7));
    pConeGeo.translate(0, 0.028, 0);
    const pConeMat = trackMat(
      new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.75 })
    );

    const instPineTrunks = new THREE.InstancedMesh(pTrunkGeo, pTrunkMat, pineCount);
    const instPineCones = new THREE.InstancedMesh(pConeGeo, pConeMat, pineCount);

    for (let i = 0; i < pineCount; i++) {
      const [px, py, pz, sc, rotY] = pineCoords[i];
      dummy.position.set(px, py, pz);
      dummy.rotation.set(0, rotY, 0);
      dummy.scale.setScalar(sc);
      dummy.updateMatrix();
      instPineTrunks.setMatrixAt(i, dummy.matrix);
      instPineCones.setMatrixAt(i, dummy.matrix);
    }
    instPineTrunks.instanceMatrix.needsUpdate = true;
    instPineCones.instanceMatrix.needsUpdate = true;
    instPineTrunks.computeBoundingSphere();
    instPineCones.computeBoundingSphere();
    rootGroup.add(instPineTrunks, instPineCones);
  }

  function update(elapsedTime) {
    if (oceanUniforms) {
      oceanUniforms.uTime.value = elapsedTime;
    }
  }

  function dispose() {
    for (const geo of disposableGeos) {
      geo.dispose();
    }
    disposableGeos.clear();

    for (const mat of disposableMats) {
      mat.dispose();
    }
    disposableMats.clear();

    if (rootGroup.parent) {
      rootGroup.parent.remove(rootGroup);
    }
  }

  return {
    mapId: safeMapId,
    rootGroup,
    roadGeo,
    skyCfg,
    setF1StartLights,
    attachTrafficLightGlb,
    update,
    dispose,
  };
}
