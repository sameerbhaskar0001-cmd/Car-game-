import * as THREE from 'three';

/**
 * Zero-GC Mobile-Optimized 60 FPS VFX Manager:
 * 1. Drift Tire Smoke Pool (InstancedMesh, 96 instances) - expands & fades smoothly
 * 2. Flush Road Skid-Mark Ring Buffer (InstancedMesh, 360 segments) - fixed memory, wraps cleanly
 * 3. Collision Sparks & Nitro Exhaust Flame Particles (InstancedMesh, 160 instances) - velocity-aligned HDR streaks
 *
 * Zero per-frame `new THREE.Mesh` or `new THREE.Vector3` allocations.
 * Supports clean `.reset()` on restart and `.dispose()` on map swap.
 */
export function createVFXManager(scene) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'VFXManagerRoot';
  scene.add(rootGroup);

  // Module-local pre-allocated scratch objects (Zero per-frame GC)
  const _dummy = new THREE.Object3D();
  const _v0 = new THREE.Vector3();
  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const _v3 = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _quat = new THREE.Quaternion();
  const _rotMat = new THREE.Matrix4();
  const _color = new THREE.Color();

  // =========================================================================
  // 1. DRIFT TIRE SMOKE POOL (InstancedMesh with per-instance alpha fading)
  // =========================================================================
  const MAX_SMOKE = 96;
  const smokeGeo = new THREE.IcosahedronGeometry(0.00105, 1);
  const smokeAlphaArr = new Float32Array(MAX_SMOKE);
  const smokeAlphaAttr = new THREE.InstancedBufferAttribute(smokeAlphaArr, 1);
  smokeAlphaAttr.setUsage(THREE.DynamicDrawUsage);
  smokeGeo.setAttribute('aInstanceAlpha', smokeAlphaAttr);

  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
  });
  smokeMat.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
      attribute float aInstanceAlpha;
      varying float vInstanceAlpha;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>
      vInstanceAlpha = aInstanceAlpha;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
      varying float vInstanceAlpha;`
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `gl_FragColor.a *= vInstanceAlpha;
      if (gl_FragColor.a < 0.01) discard;
      #include <dithering_fragment>`
    );
  };
  smokeMat.customProgramCacheKey = () => 'vfx-instanced-alpha-v1';

  const smokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, MAX_SMOKE);
  smokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  smokeMesh.frustumCulled = false;
  smokeMesh.name = 'VFXDriftSmokePool';
  rootGroup.add(smokeMesh);

  const smokePosX = new Float32Array(MAX_SMOKE);
  const smokePosY = new Float32Array(MAX_SMOKE);
  const smokePosZ = new Float32Array(MAX_SMOKE);
  const smokeVelX = new Float32Array(MAX_SMOKE);
  const smokeVelY = new Float32Array(MAX_SMOKE);
  const smokeVelZ = new Float32Array(MAX_SMOKE);
  const smokeAge = new Float32Array(MAX_SMOKE);
  const smokeMaxAge = new Float32Array(MAX_SMOKE);
  const smokeStartScale = new Float32Array(MAX_SMOKE);
  let smokeCursor = 0;
  let smokeEmitAccum = 0;

  for (let i = 0; i < MAX_SMOKE; i++) {
    smokeAge[i] = 999.0;
    smokeMaxAge[i] = 0.55;
    smokeAlphaArr[i] = 0.0;
    _dummy.position.set(0, -20, 0);
    _dummy.scale.setScalar(0.0001);
    _dummy.updateMatrix();
    smokeMesh.setMatrixAt(i, _dummy.matrix);
  }
  smokeMesh.instanceMatrix.needsUpdate = true;
  smokeAlphaAttr.needsUpdate = true;

  function spawnSmokePuff(wx, wy, wz, vx, vy, vz, baseScale = 1.0) {
    const idx = smokeCursor;
    smokeCursor = (smokeCursor + 1) % MAX_SMOKE;
    smokePosX[idx] = wx;
    smokePosY[idx] = wy;
    smokePosZ[idx] = wz;
    smokeVelX[idx] = vx;
    smokeVelY[idx] = vy;
    smokeVelZ[idx] = vz;
    smokeAge[idx] = 0.0;
    smokeMaxAge[idx] = 0.44 + Math.random() * 0.22;
    smokeStartScale[idx] = baseScale * (0.72 + Math.random() * 0.36);
    smokeAlphaArr[idx] = 0.46;
  }

  // =========================================================================
  // 2. FLUSH ROAD SKID-MARK RING BUFFER (InstancedMesh, 360 segments)
  // =========================================================================
  const MAX_SKIDS = 360;
  const skidGeo = new THREE.PlaneGeometry(0.00135, 1.0);
  skidGeo.rotateX(-Math.PI / 2);

  const skidAlphaArr = new Float32Array(MAX_SKIDS);
  const skidAlphaAttr = new THREE.InstancedBufferAttribute(skidAlphaArr, 1);
  skidAlphaAttr.setUsage(THREE.DynamicDrawUsage);
  skidGeo.setAttribute('aInstanceAlpha', skidAlphaAttr);

  const skidMat = new THREE.MeshBasicMaterial({
    color: 0x0b0d12,
    transparent: true,
    opacity: 1.0,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -7,
    polygonOffsetUnits: -7,
  });
  skidMat.onBeforeCompile = smokeMat.onBeforeCompile;
  skidMat.customProgramCacheKey = () => 'vfx-instanced-alpha-v1';

  const skidMesh = new THREE.InstancedMesh(skidGeo, skidMat, MAX_SKIDS);
  skidMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  skidMesh.frustumCulled = false;
  skidMesh.name = 'VFXSkidMarkRingBuffer';
  rootGroup.add(skidMesh);

  const skidAge = new Float32Array(MAX_SKIDS);
  const skidActive = new Uint8Array(MAX_SKIDS);
  const SKID_MAX_LIFETIME = 7.5;
  let skidCursor = 0;

  let hasPrevSkid = false;
  const prevLeftTirePos = new THREE.Vector3();
  const prevRightTirePos = new THREE.Vector3();
  const currLeftTirePos = new THREE.Vector3();
  const currRightTirePos = new THREE.Vector3();

  for (let i = 0; i < MAX_SKIDS; i++) {
    skidAge[i] = SKID_MAX_LIFETIME + 1.0;
    skidActive[i] = 0;
    skidAlphaArr[i] = 0.0;
    _dummy.position.set(0, -20, 0);
    _dummy.scale.setScalar(0.0001);
    _dummy.updateMatrix();
    skidMesh.setMatrixAt(i, _dummy.matrix);
  }
  skidMesh.instanceMatrix.needsUpdate = true;
  skidAlphaAttr.needsUpdate = true;

  function stampSkidSegment(pA, pB, trackNormal, widthScale = 1.0) {
    _dir.subVectors(pB, pA);
    const segLen = _dir.length();
    if (segLen < 0.0004 || segLen > 0.025) return;
    _dir.divideScalar(segLen);

    const idx = skidCursor;
    skidCursor = (skidCursor + 1) % MAX_SKIDS;

    // Build orthonormal basis aligned with road normal (+Y) and segment forward (+Z)
    _v3.crossVectors(trackNormal, _dir);
    if (_v3.lengthSq() < 1e-8) return;
    _v3.normalize();
    _rotMat.makeBasis(_v3, trackNormal, _dir);

    _v2.copy(pA).add(pB).multiplyScalar(0.5);
    _dummy.position.copy(_v2);
    _dummy.quaternion.setFromRotationMatrix(_rotMat);
    _dummy.scale.set(widthScale, 1.0, segLen * 1.15);
    _dummy.updateMatrix();

    skidMesh.setMatrixAt(idx, _dummy.matrix);
    skidAge[idx] = 0.0;
    skidActive[idx] = 1;
    skidAlphaArr[idx] = 0.62;
  }

  // =========================================================================
  // 3. POOLED SPARK & NITRO EXHAUST PARTICLES (InstancedMesh, 160 instances)
  // =========================================================================
  const MAX_SPARKS = 160;
  const sparkGeo = new THREE.BoxGeometry(0.00024, 0.00024, 0.00145);
  const sparkAlphaArr = new Float32Array(MAX_SPARKS);
  const sparkAlphaAttr = new THREE.InstancedBufferAttribute(sparkAlphaArr, 1);
  sparkAlphaAttr.setUsage(THREE.DynamicDrawUsage);
  sparkGeo.setAttribute('aInstanceAlpha', sparkAlphaAttr);

  const sparkMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 1.0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
  });
  sparkMat.onBeforeCompile = smokeMat.onBeforeCompile;
  sparkMat.customProgramCacheKey = () => 'vfx-instanced-alpha-v1';

  const sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, MAX_SPARKS);
  sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  sparkMesh.frustumCulled = false;
  sparkMesh.name = 'VFXSparkAndFlamePool';
  rootGroup.add(sparkMesh);

  const sparkPosX = new Float32Array(MAX_SPARKS);
  const sparkPosY = new Float32Array(MAX_SPARKS);
  const sparkPosZ = new Float32Array(MAX_SPARKS);
  const sparkVelX = new Float32Array(MAX_SPARKS);
  const sparkVelY = new Float32Array(MAX_SPARKS);
  const sparkVelZ = new Float32Array(MAX_SPARKS);
  const sparkAge = new Float32Array(MAX_SPARKS);
  const sparkMaxAge = new Float32Array(MAX_SPARKS);
  const sparkFloorY = new Float32Array(MAX_SPARKS);
  const sparkScale = new Float32Array(MAX_SPARKS);
  const sparkGravity = new Float32Array(MAX_SPARKS);
  let sparkCursor = 0;

  for (let i = 0; i < MAX_SPARKS; i++) {
    sparkAge[i] = 999.0;
    sparkMaxAge[i] = 0.3;
    sparkAlphaArr[i] = 0.0;
    _color.setHex(0xffaa00);
    sparkMesh.setColorAt(i, _color);
    _dummy.position.set(0, -20, 0);
    _dummy.scale.setScalar(0.0001);
    _dummy.updateMatrix();
    sparkMesh.setMatrixAt(i, _dummy.matrix);
  }
  sparkMesh.instanceMatrix.needsUpdate = true;
  if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
  sparkAlphaAttr.needsUpdate = true;

  /**
   * Spawn a burst of bright orange/yellow collision sparks at `contactPos`.
   */
  function spawnCollisionSparks(contactPos, contactNormal, count = 24, intensity = 1.0) {
    if (!contactPos) return;
    const nVec = contactNormal || _up;
    const burstCount = Math.min(40, Math.max(8, count));
    const speedMag = 0.14 + 0.16 * THREE.MathUtils.clamp(intensity, 0.3, 1.5);

    for (let i = 0; i < burstCount; i++) {
      const idx = sparkCursor;
      sparkCursor = (sparkCursor + 1) % MAX_SPARKS;

      sparkPosX[idx] = contactPos.x + (Math.random() - 0.5) * 0.0014;
      sparkPosY[idx] = contactPos.y + Math.random() * 0.0010;
      sparkPosZ[idx] = contactPos.z + (Math.random() - 0.5) * 0.0014;

      const spreadX = (Math.random() - 0.5) * 2.0;
      const spreadY = 0.45 + Math.random() * 1.35;
      const spreadZ = (Math.random() - 0.5) * 2.0;
      _v0
        .set(
          nVec.x * 0.9 + spreadX,
          Math.abs(nVec.y) * 0.5 + spreadY,
          nVec.z * 0.9 + spreadZ
        )
        .normalize()
        .multiplyScalar(speedMag * (0.6 + Math.random() * 0.85));

      sparkVelX[idx] = _v0.x;
      sparkVelY[idx] = _v0.y;
      sparkVelZ[idx] = _v0.z;
      sparkAge[idx] = 0.0;
      sparkMaxAge[idx] = 0.24 + Math.random() * 0.22;
      sparkFloorY[idx] = contactPos.y - 0.0012;
      sparkScale[idx] = 0.85 + Math.random() * 0.75;
      sparkGravity[idx] = 0.72;
      sparkAlphaArr[idx] = 1.0;

      // Bright orange / gold / white-hot spark palette
      const rPick = Math.random();
      if (rPick < 0.35) {
        _color.setRGB(1.4, 1.15, 0.45); // hot yellow-white
      } else if (rPick < 0.75) {
        _color.setRGB(1.45, 0.68, 0.08); // electric orange
      } else {
        _color.setRGB(1.35, 0.35, 0.04); // fiery amber-red
      }
      sparkMesh.setColorAt(idx, _color);
    }
    if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
  }

  /**
   * Spawn a high-arcing celebratory fountain of Gold, Cyan, Magenta & Emerald sparks
   * around the winning car and finish gantry during the Victory Finish & Podium screen.
   */
  function spawnVictoryCelebrationBurst(originPos, upNormal, count = 42) {
    if (!originPos) return;
    const nVec = upNormal || _up;
    const burstCount = Math.min(64, Math.max(12, count));

    for (let i = 0; i < burstCount; i++) {
      const idx = sparkCursor;
      sparkCursor = (sparkCursor + 1) % MAX_SPARKS;

      const ringAngle = (i / burstCount) * Math.PI * 2.0 + Math.random() * 0.4;
      const ringRadius = 0.0022 + Math.random() * 0.0055;
      sparkPosX[idx] = originPos.x + Math.cos(ringAngle) * ringRadius;
      sparkPosY[idx] = originPos.y + 0.0012 + Math.random() * 0.0025;
      sparkPosZ[idx] = originPos.z + Math.sin(ringAngle) * ringRadius;

      const outSpeed = 0.045 + Math.random() * 0.095;
      const upSpeed = 0.14 + Math.random() * 0.18;
      sparkVelX[idx] = Math.cos(ringAngle) * outSpeed + nVec.x * upSpeed * 0.25;
      sparkVelY[idx] = Math.abs(nVec.y) * upSpeed;
      sparkVelZ[idx] = Math.sin(ringAngle) * outSpeed + nVec.z * upSpeed * 0.25;

      sparkAge[idx] = 0.0;
      sparkMaxAge[idx] = 0.48 + Math.random() * 0.38;
      sparkFloorY[idx] = originPos.y - 0.0008;
      sparkScale[idx] = 1.15 + Math.random() * 0.95;
      sparkGravity[idx] = 0.36;
      sparkAlphaArr[idx] = 1.0;

      const cPick = i % 4;
      if (cPick === 0) {
        _color.setRGB(1.6, 1.28, 0.22); // Championship Gold
      } else if (cPick === 1) {
        _color.setRGB(0.18, 1.38, 1.65); // Electric Cyan
      } else if (cPick === 2) {
        _color.setRGB(1.55, 0.32, 1.05); // Neon Magenta
      } else {
        _color.setRGB(0.25, 1.5, 0.72); // Podium Emerald
      }
      sparkMesh.setColorAt(idx, _color);
    }
    if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
  }

  /**
   * Spawn twin cyan/orange nitro exhaust flame particles from the rear tailpipes.
   */
  function spawnNitroFlameEmbers(kartPos, state, kScale) {
    _v1.copy(state.tangent).multiplyScalar(-1); // rear direction
    const sideOffset = 0.0022 * kScale;
    const rearOffset = 0.0102 * kScale;
    const upOffset = 0.0017 * kScale;

    for (let pipe = 0; pipe < 2; pipe++) {
      const sideSign = pipe === 0 ? -1 : 1;
      const idx = sparkCursor;
      sparkCursor = (sparkCursor + 1) % MAX_SPARKS;

      _v0
        .copy(kartPos)
        .addScaledVector(state.right, sideSign * sideOffset + (Math.random() - 0.5) * 0.0004)
        .addScaledVector(_v1, rearOffset)
        .addScaledVector(state.normal, upOffset + (Math.random() - 0.5) * 0.0003);

      sparkPosX[idx] = _v0.x;
      sparkPosY[idx] = _v0.y;
      sparkPosZ[idx] = _v0.z;

      const jetSpeed = (0.16 + Math.random() * 0.14) * (0.7 + 0.3 * kScale);
      sparkVelX[idx] = _v1.x * jetSpeed + (Math.random() - 0.5) * 0.02;
      sparkVelY[idx] = _v1.y * jetSpeed + 0.01 + Math.random() * 0.015;
      sparkVelZ[idx] = _v1.z * jetSpeed + (Math.random() - 0.5) * 0.02;

      sparkAge[idx] = 0.0;
      sparkMaxAge[idx] = 0.11 + Math.random() * 0.08;
      sparkFloorY[idx] = _v0.y - 0.002;
      sparkScale[idx] = 0.70 + Math.random() * 0.55;
      sparkGravity[idx] = 0.04;
      sparkAlphaArr[idx] = 0.95;

      // Alternate vibrant electric cyan & fiery afterburner orange
      if (Math.random() < 0.52) {
        _color.setRGB(0.15, 1.15, 1.45); // electric cyan
      } else {
        _color.setRGB(1.45, 0.62, 0.10); // hot orange
      }
      sparkMesh.setColorAt(idx, _color);
    }
    if (sparkMesh.instanceColor) sparkMesh.instanceColor.needsUpdate = true;
  }

  let nitroEmitAccum = 0;

  /**
   * Advances all pooled VFX systems cleanly at 60 FPS (scaled by `dt`).
   */
  function update(dt, state, kartRoot, isRaceScreen = true) {
    if (!isRaceScreen || !state || !kartRoot) {
      hasPrevSkid = false;
      return;
    }

    const clampedDt = Math.min(Math.max(dt, 0.0), 0.05);
    const kScale = kartRoot.scale.x || 0.56;
    const speedMag = Math.abs(state.speed || 0);
    const isAirborne = (state.hopHeight || 0) > 0.0005;
    const isDriftingActive =
      Boolean(state.isDrifting) && speedMag > 0.035 && !state.countdownLocked && !isAirborne;

    // ---------------------------------------------------------------------
    // A. Compute Rear Tire Ground Contact Points & Stamp Skid Marks + Smoke
    // ---------------------------------------------------------------------
    if (isDriftingActive) {
      const tireHalfW = 0.00275 * kScale;
      const rearWheelZ = 0.0052 * kScale;
      const tireRadiusY = 0.00038;

      _v0
        .copy(state.position)
        .addScaledVector(state.tangent, -rearWheelZ)
        .addScaledVector(state.normal, tireRadiusY);

      currLeftTirePos.copy(_v0).addScaledVector(state.right, -tireHalfW);
      currRightTirePos.copy(_v0).addScaledVector(state.right, tireHalfW);

      if (hasPrevSkid) {
        stampSkidSegment(prevLeftTirePos, currLeftTirePos, state.normal, kScale * 1.12);
        stampSkidSegment(prevRightTirePos, currRightTirePos, state.normal, kScale * 1.12);
      }
      prevLeftTirePos.copy(currLeftTirePos);
      prevRightTirePos.copy(currRightTirePos);
      hasPrevSkid = true;

      // Emit expanding tire smoke puffs smoothly from rear wheels (~35 puffs/sec)
      smokeEmitAccum += clampedDt;
      if (smokeEmitAccum >= 0.026) {
        smokeEmitAccum = 0;
        const backVx = -state.tangent.x * 0.022;
        const backVy = -state.tangent.y * 0.022 + 0.016;
        const backVz = -state.tangent.z * 0.022;

        spawnSmokePuff(
          currLeftTirePos.x,
          currLeftTirePos.y + 0.0008,
          currLeftTirePos.z,
          backVx + (Math.random() - 0.5) * 0.016,
          backVy + Math.random() * 0.010,
          backVz + (Math.random() - 0.5) * 0.016,
          kScale
        );
        spawnSmokePuff(
          currRightTirePos.x,
          currRightTirePos.y + 0.0008,
          currRightTirePos.z,
          backVx + (Math.random() - 0.5) * 0.016,
          backVy + Math.random() * 0.010,
          backVz + (Math.random() - 0.5) * 0.016,
          kScale
        );
      }
    } else {
      hasPrevSkid = false;
      smokeEmitAccum = 0.026;
    }

    // ---------------------------------------------------------------------
    // B. Nitro Boost Exhaust Flame Particles & Jump Landing Tire Dust Burst
    // ---------------------------------------------------------------------
    if ((state.boostActive || 0) > 0 && !state.countdownLocked && speedMag > 0.02) {
      nitroEmitAccum += clampedDt;
      if (nitroEmitAccum >= 0.018) {
        nitroEmitAccum = 0;
        spawnNitroFlameEmbers(state.position, state, kScale);
      }
    }

    if ((state.landingCompression || 0) > 0.72) {
      const tireHalfW = 0.0029 * kScale;
      for (let side = -1; side <= 1; side += 2) {
        _v0
          .copy(state.position)
          .addScaledVector(state.right, side * tireHalfW)
          .addScaledVector(state.normal, 0.0005);
        spawnSmokePuff(
          _v0.x,
          _v0.y,
          _v0.z,
          state.right.x * side * 0.025 + (Math.random() - 0.5) * 0.015,
          0.012 + Math.random() * 0.010,
          state.right.z * side * 0.025 + (Math.random() - 0.5) * 0.015,
          kScale * 0.85
        );
      }
    }

    // ---------------------------------------------------------------------
    // C. Step Pooled Drift Smoke Puffs (Expand & Fade Smoothly)
    // ---------------------------------------------------------------------
    let anySmokeDirty = false;
    for (let i = 0; i < MAX_SMOKE; i++) {
      const maxA = smokeMaxAge[i];
      if (smokeAge[i] < maxA) {
        anySmokeDirty = true;
        smokeAge[i] += clampedDt;
        const t = THREE.MathUtils.clamp(smokeAge[i] / maxA, 0.0, 1.0);

        smokePosX[i] += smokeVelX[i] * clampedDt;
        smokePosY[i] += smokeVelY[i] * clampedDt;
        smokePosZ[i] += smokeVelZ[i] * clampedDt;

        const damp = Math.exp(-3.5 * clampedDt);
        smokeVelX[i] *= damp;
        smokeVelY[i] = smokeVelY[i] * damp + 0.010 * clampedDt;
        smokeVelZ[i] *= damp;

        const scaleNow = smokeStartScale[i] * (0.65 + t * 1.85);
        smokeAlphaArr[i] = 0.16 * (1.0 - t) * (1.0 - t * 0.45);

        _dummy.position.set(smokePosX[i], smokePosY[i], smokePosZ[i]);
        _dummy.rotation.set(t * 1.4, t * 2.1, 0);
        _dummy.scale.set(scaleNow * 1.25, scaleNow * 0.55, scaleNow * 1.25);
        _dummy.updateMatrix();
        smokeMesh.setMatrixAt(i, _dummy.matrix);
      } else if (smokeAlphaArr[i] > 0.0) {
        anySmokeDirty = true;
        smokeAlphaArr[i] = 0.0;
        _dummy.position.set(0, -20, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        smokeMesh.setMatrixAt(i, _dummy.matrix);
      }
    }
    if (anySmokeDirty) {
      smokeMesh.instanceMatrix.needsUpdate = true;
      smokeAlphaAttr.needsUpdate = true;
    }

    // ---------------------------------------------------------------------
    // D. Fade Aged Skid Marks smoothly in the Fixed Ring Buffer
    // ---------------------------------------------------------------------
    let anySkidDirty = hasPrevSkid;
    for (let i = 0; i < MAX_SKIDS; i++) {
      if (skidActive[i]) {
        anySkidDirty = true;
        skidAge[i] += clampedDt;
        if (skidAge[i] >= SKID_MAX_LIFETIME) {
          skidActive[i] = 0;
          skidAlphaArr[i] = 0.0;
          _dummy.position.set(0, -20, 0);
          _dummy.scale.setScalar(0.0001);
          _dummy.updateMatrix();
          skidMesh.setMatrixAt(i, _dummy.matrix);
        } else {
          const lifeFrac = skidAge[i] / SKID_MAX_LIFETIME;
          // Hold crisp dark tread for first 45% of life, then fade smoothly to 0
          const fade = lifeFrac < 0.45 ? 1.0 : 1.0 - (lifeFrac - 0.45) / 0.55;
          skidAlphaArr[i] = 0.62 * fade;
        }
      }
    }
    if (anySkidDirty) {
      skidMesh.instanceMatrix.needsUpdate = true;
      skidAlphaAttr.needsUpdate = true;
    }

    // ---------------------------------------------------------------------
    // E. Step Pooled Collision & Nitro Exhaust Sparks
    // ---------------------------------------------------------------------
    let anySparkDirty = false;
    for (let i = 0; i < MAX_SPARKS; i++) {
      const maxA = sparkMaxAge[i];
      if (sparkAge[i] < maxA) {
        anySparkDirty = true;
        sparkAge[i] += clampedDt;
        const t = THREE.MathUtils.clamp(sparkAge[i] / maxA, 0.0, 1.0);

        sparkPosX[i] += sparkVelX[i] * clampedDt;
        sparkPosY[i] += sparkVelY[i] * clampedDt;
        sparkPosZ[i] += sparkVelZ[i] * clampedDt;

        sparkVelY[i] -= sparkGravity[i] * clampedDt;
        if (sparkPosY[i] < sparkFloorY[i] && sparkVelY[i] < 0) {
          sparkPosY[i] = sparkFloorY[i];
          sparkVelY[i] = -sparkVelY[i] * 0.42;
          sparkVelX[i] *= 0.78;
          sparkVelZ[i] *= 0.78;
        }

        const drag = Math.exp(-2.8 * clampedDt);
        sparkVelX[i] *= drag;
        sparkVelZ[i] *= drag;

        sparkAlphaArr[i] = 1.0 - t * t;

        _v0.set(sparkVelX[i], sparkVelY[i], sparkVelZ[i]);
        const speedLen = _v0.length();
        _dummy.position.set(sparkPosX[i], sparkPosY[i], sparkPosZ[i]);
        if (speedLen > 1e-4) {
          _v0.divideScalar(speedLen);
          _quat.setFromUnitVectors(_v1.set(0, 0, 1), _v0);
          _dummy.quaternion.copy(_quat);
        }
        const stretchZ = THREE.MathUtils.clamp(speedLen * 8.0, 0.7, 2.6);
        const s = sparkScale[i] * (1.0 - t * 0.45);
        _dummy.scale.set(s, s, s * stretchZ);
        _dummy.updateMatrix();
        sparkMesh.setMatrixAt(i, _dummy.matrix);
      } else if (sparkAlphaArr[i] > 0.0) {
        anySparkDirty = true;
        sparkAlphaArr[i] = 0.0;
        _dummy.position.set(0, -20, 0);
        _dummy.scale.setScalar(0.0001);
        _dummy.updateMatrix();
        sparkMesh.setMatrixAt(i, _dummy.matrix);
      }
    }
    if (anySparkDirty) {
      sparkMesh.instanceMatrix.needsUpdate = true;
      sparkAlphaAttr.needsUpdate = true;
    }
  }

  function reset() {
    hasPrevSkid = false;
    smokeEmitAccum = 0;
    nitroEmitAccum = 0;

    for (let i = 0; i < MAX_SMOKE; i++) {
      smokeAge[i] = 999.0;
      smokeAlphaArr[i] = 0.0;
      _dummy.position.set(0, -20, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      smokeMesh.setMatrixAt(i, _dummy.matrix);
    }
    smokeMesh.instanceMatrix.needsUpdate = true;
    smokeAlphaAttr.needsUpdate = true;

    for (let i = 0; i < MAX_SKIDS; i++) {
      skidActive[i] = 0;
      skidAge[i] = SKID_MAX_LIFETIME + 1.0;
      skidAlphaArr[i] = 0.0;
      _dummy.position.set(0, -20, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      skidMesh.setMatrixAt(i, _dummy.matrix);
    }
    skidMesh.instanceMatrix.needsUpdate = true;
    skidAlphaAttr.needsUpdate = true;

    for (let i = 0; i < MAX_SPARKS; i++) {
      sparkAge[i] = 999.0;
      sparkAlphaArr[i] = 0.0;
      _dummy.position.set(0, -20, 0);
      _dummy.scale.setScalar(0.0001);
      _dummy.updateMatrix();
      sparkMesh.setMatrixAt(i, _dummy.matrix);
    }
    sparkMesh.instanceMatrix.needsUpdate = true;
    sparkAlphaAttr.needsUpdate = true;
  }

  function setVisible(vis) {
    rootGroup.visible = Boolean(vis);
  }

  function dispose() {
    scene.remove(rootGroup);
    smokeGeo.dispose();
    smokeMat.dispose();
    skidGeo.dispose();
    skidMat.dispose();
    sparkGeo.dispose();
    sparkMat.dispose();
  }

  return {
    rootGroup,
    spawnCollisionSparks,
    update,
    reset,
    setVisible,
    dispose,
  };
}
