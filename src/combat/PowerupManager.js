import * as THREE from 'three';

/**
 * Pure Arcade Track Boost Pads & Sleek Straightaway Speed-Jump Ramps Manager.
 * All combat weapons, mystery pods, projectiles, hazards, and spinouts have been removed
 * for clean, high-speed Nitro racing.
 * Supports dynamic map swapping via rebuildForSpline(newSplineData) and clean GPU disposal.
 */
export function createPowerupManager(initialSplineData, scene) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'TrackBoostAndRampsRoot';
  scene.add(rootGroup);

  let samples = initialSplineData.samples;
  let N = samples.length;
  let totalLength = initialSplineData.total_length_m || 3.8371;

  // Pre-allocated scratch vectors for zero-GC per-frame spline queries
  const _p0 = new THREE.Vector3();
  const _p1 = new THREE.Vector3();
  const _r0 = new THREE.Vector3();
  const _r1 = new THREE.Vector3();
  const _n0 = new THREE.Vector3();
  const _n1 = new THREE.Vector3();
  const _t0 = new THREE.Vector3();
  const _t1 = new THREE.Vector3();
  const _sampleFrame = {
    pos: new THREE.Vector3(),
    right: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
  };

  function samplePoint(sVal, out = _sampleFrame) {
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

  // Shared reusable geometries & materials across map swaps (embedded skirt so pads sit 100% flush on crowned asphalt)
  const padBaseGeo = new THREE.BoxGeometry(0.0066, 0.00064, 0.0162);
  const padBaseMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.3,
    metalness: 0.8,
  });
  const padChevronGeo = new THREE.BoxGeometry(0.0026, 0.00042, 0.00088);

  // Aerodynamic launch wedge with embedded sub-road foundation skirt (-0.45mm to +1.85mm lip height, 14.2mm length, 8.6mm width)
  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(-0.0071, -0.00045);
  wedgeShape.lineTo(0.0071, -0.00045);
  wedgeShape.lineTo(0.0071, 0.00185);
  wedgeShape.lineTo(-0.0071, 0.00005);
  wedgeShape.closePath();

  const rampWedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
    depth: 0.0086,
    bevelEnabled: false,
  });
  rampWedgeGeo.translate(0, 0, -0.0043);
  rampWedgeGeo.rotateY(-Math.PI / 2);

  const rampDeckMat = new THREE.MeshStandardMaterial({
    color: 0x131c2e,
    roughness: 0.25,
    metalness: 0.75,
  });
  const rampRailGeo = new THREE.BoxGeometry(0.00055, 0.00065, 0.0142);
  const rampRailMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    toneMapped: false,
  });
  const rampChevronGeo = new THREE.BoxGeometry(0.0028, 0.00028, 0.0009);
  const rampChevronMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    toneMapped: false,
  });
  const rampLipMat = new THREE.MeshBasicMaterial({
    color: 0xffbe0b,
    toneMapped: false,
  });

  const defaultBoostPadConfigs = [
    { sFrac: 0.22, latOffset: -0.0042, color: 0x00f0ff },
    { sFrac: 0.33, latOffset: 0.0042, color: 0xf59e0b },
    { sFrac: 0.46, latOffset: -0.0038, color: 0x00f0ff },
    { sFrac: 0.72, latOffset: 0.0042, color: 0xf59e0b },
    { sFrac: 0.81, latOffset: -0.0042, color: 0x00f0ff },
    { sFrac: 0.93, latOffset: 0.0, color: 0xf59e0b },
  ];

  const defaultJumpRampConfigs = [
    { sFrac: 0.39, latOffset: 0.0 },
    { sFrac: 0.86, latOffset: 0.0 },
  ];

  let boostPads = [];
  let jumpRamps = [];

  function clearMountedInstances() {
    for (let i = 0; i < boostPads.length; i++) {
      const mats = boostPads[i].chevronMats;
      for (let m = 0; m < mats.length; m++) {
        mats[m].dispose();
      }
    }
    while (rootGroup.children.length > 0) {
      rootGroup.remove(rootGroup.children[0]);
    }
    boostPads = [];
    jumpRamps = [];
  }

  function buildTrackFeatures(splineData) {
    clearMountedInstances();

    samples = splineData.samples;
    N = samples.length;
    totalLength = splineData.total_length_m || 3.8371;

    const activeBoostConfigs =
      Array.isArray(splineData.boostPadConfigs) && splineData.boostPadConfigs.length > 0
        ? splineData.boostPadConfigs
        : defaultBoostPadConfigs;

    const activeRampConfigs =
      Array.isArray(splineData.jumpRampConfigs) && splineData.jumpRampConfigs.length > 0
        ? splineData.jumpRampConfigs
        : defaultJumpRampConfigs;

    // 1. Build 6 Neon Chevron Track Boost Pads (Flush with roadbed)
    boostPads = activeBoostConfigs.map((cfg, idx) => {
      const padS = cfg.sFrac * totalLength;
      const frame = samplePoint(padS);
      const padGroup = new THREE.Group();

      const baseMesh = new THREE.Mesh(padBaseGeo, padBaseMat);
      baseMesh.position.y = -0.00018;
      padGroup.add(baseMesh);

      const chevronPairs = [];
      for (let c = 0; c < 3; c++) {
        const zOff = -0.0046 + c * 0.0046;
        const chevMat = new THREE.MeshBasicMaterial({
          color: cfg.color,
          toneMapped: false,
        });
        const leftWing = new THREE.Mesh(padChevronGeo, chevMat);
        leftWing.position.set(-0.0011, 0.00018, zOff);
        leftWing.rotation.y = -0.52;
        const rightWing = new THREE.Mesh(padChevronGeo, chevMat);
        rightWing.position.set(0.0011, 0.00018, zOff);
        rightWing.rotation.y = 0.52;
        padGroup.add(leftWing, rightWing);
        chevronPairs.push(chevMat);
      }

      padGroup.position
        .copy(frame.pos)
        .addScaledVector(frame.right, cfg.latOffset)
        .addScaledVector(frame.normal, 0.00004);

      const leftVec = new THREE.Vector3().crossVectors(frame.normal, frame.tangent).normalize();
      const rotMat = new THREE.Matrix4().makeBasis(leftVec, frame.normal, frame.tangent);
      padGroup.quaternion.setFromRotationMatrix(rotMat);
      rootGroup.add(padGroup);

      return {
        id: `boost_pad_${idx}`,
        s: padS,
        latOffset: cfg.latOffset,
        baseColor: new THREE.Color(cfg.color),
        chevronMats: chevronPairs,
        playerCooldown: 0.0,
      };
    });

    // 2. Build 2 Flush Straightaway Speed-Jump Ramps
    jumpRamps = activeRampConfigs.map((cfg, idx) => {
      const rampS = cfg.sFrac * totalLength;
      const frame = samplePoint(rampS);
      const rampGroup = new THREE.Group();

      const wedgeMesh = new THREE.Mesh(rampWedgeGeo, rampDeckMat);
      rampGroup.add(wedgeMesh);

      const slopeGroup = new THREE.Group();
      slopeGroup.position.set(0, 0.00095, 0);
      slopeGroup.rotation.x = -0.125;

      for (const rx of [-0.0040, 0.0040]) {
        const rail = new THREE.Mesh(rampRailGeo, rampRailMat);
        rail.position.set(rx, 0.00022, 0);
        slopeGroup.add(rail);
      }

      for (let c = 0; c < 3; c++) {
        const zOff = -0.0038 + c * 0.0038;
        const lWing = new THREE.Mesh(rampChevronGeo, c === 2 ? rampLipMat : rampChevronMat);
        lWing.position.set(-0.0011, 0.00020, zOff);
        lWing.rotation.y = -0.48;
        const rWing = new THREE.Mesh(rampChevronGeo, c === 2 ? rampLipMat : rampChevronMat);
        rWing.position.set(0.0011, 0.00020, zOff);
        rWing.rotation.y = 0.48;
        slopeGroup.add(lWing, rWing);
      }

      rampGroup.add(slopeGroup);

      rampGroup.position
        .copy(frame.pos)
        .addScaledVector(frame.right, cfg.latOffset)
        .addScaledVector(frame.normal, -0.00004);

      const leftVec = new THREE.Vector3().crossVectors(frame.normal, frame.tangent).normalize();
      const rotMat = new THREE.Matrix4().makeBasis(leftVec, frame.normal, frame.tangent);
      rampGroup.quaternion.setFromRotationMatrix(rotMat);
      rootGroup.add(rampGroup);

      return {
        id: `jump_ramp_${idx}`,
        s: rampS,
        latOffset: cfg.latOffset,
        playerCooldown: 0.0,
      };
    });
  }

  // Initial mount
  buildTrackFeatures(initialSplineData);

  /**
   * Main 60FPS update step for Neon Boost Pads & Straightaway Speed-Jump Ramps
   */
  function update(dt, playerState, rivalsList, audioSynth) {
    const tSec = performance.now() * 0.001;

    // 1. Update 6 Neon Chevron Track Boost Pads
    for (let pIdx = 0; pIdx < boostPads.length; pIdx++) {
      const pad = boostPads[pIdx];
      if (pad.playerCooldown > 0) {
        pad.playerCooldown = Math.max(0.0, pad.playerCooldown - dt);
      }

      const activeWave = Math.floor((tSec * 9.0 + pIdx) % 3);
      for (let c = 0; c < pad.chevronMats.length; c++) {
        const mat = pad.chevronMats[c];
        mat.color.copy(pad.baseColor).multiplyScalar(c === activeWave ? 1.5 : 0.65);
      }

      if (pad.playerCooldown <= 0 && !playerState.countdownLocked && playerState.speed > 0.01) {
        const dS = Math.abs(
          ((playerState.s - pad.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dLat = Math.abs(playerState.lateralOffset - pad.latOffset);
        if (dS < 0.015 && dLat < 0.0052) {
          pad.playerCooldown = 1.15;
          playerState.boostActive = Math.max(playerState.boostActive || 0, 1.45);
          playerState.boostCharge = Math.min(1.0, (playerState.boostCharge || 0) + 0.38);
          playerState.speed = Math.max(
            playerState.speed,
            0.184 * (playerState.topSpeedMultiplier || 1.0)
          );
          if (audioSynth && audioSynth.playNitroBoost) {
            audioSynth.playNitroBoost();
          }
        }
      }

      for (let rIdx = 0; rIdx < rivalsList.length; rIdx++) {
        const rival = rivalsList[rIdx];
        if (rival.eliminated) continue;
        const dS = Math.abs(
          ((rival.s - pad.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dLat = Math.abs(rival.lateralOffset - pad.latOffset);
        if (dS < 0.014 && dLat < 0.0045) {
          rival.boostTimer = 1.15;
          rival.speed = Math.max(rival.speed, rival.baseSpeed * 1.18);
        }
      }
    }

    // 2. Update 2 Straightaway Speed-Jump Ramps (Acts as automatic Ramp Accelerator!)
    playerState.onRampSurface = false;
    playerState.rampSurfaceHeight = 0.0;

    if (playerState.justLanded) {
      playerState.justLanded = false;
      if (audioSynth && audioSynth.playLandingThud) {
        audioSynth.playLandingThud(0.85);
      }
    }

    for (let jIdx = 0; jIdx < jumpRamps.length; jIdx++) {
      const ramp = jumpRamps[jIdx];
      if (ramp.playerCooldown > 0) {
        ramp.playerCooldown = Math.max(0.0, ramp.playerCooldown - dt);
      }

      if (!playerState.countdownLocked) {
        const signedDS =
          ((playerState.s - ramp.s + totalLength * 0.5) % totalLength) - totalLength * 0.5;
        const dLat = Math.abs(playerState.lateralOffset - ramp.latOffset);

        if (signedDS >= -0.0085 && signedDS <= 0.0095 && dLat < 0.0064) {
          const u = THREE.MathUtils.clamp((signedDS + 0.0071) / 0.0142, 0.0, 1.0);
          const wedgeH = 0.00010 + u * 0.00185;
          playerState.onRampSurface = true;
          playerState.rampSurfaceHeight = Math.max(playerState.rampSurfaceHeight || 0.0, wedgeH);
          playerState.hopHeight = Math.max(playerState.hopHeight || 0.0, wedgeH);
          playerState.rampPitch = -0.18 * u;

          const minLaunchSpeed = 0.185 * (playerState.topSpeedMultiplier || 1.0);
          if (playerState.speed < minLaunchSpeed) {
            playerState.speed = minLaunchSpeed;
          }
          playerState.boostActive = Math.max(playerState.boostActive || 0, 1.45);

          if (u >= 0.34 && ramp.playerCooldown <= 0) {
            ramp.playerCooldown = 1.15;
            playerState.hopVel = Math.max(playerState.hopVel || 0.0, 0.074);
            playerState.isAirborne = true;
            playerState.onRampSurface = false;
            playerState.rampPitch = -0.22;
            playerState.boostCharge = Math.min(1.0, (playerState.boostCharge || 0) + 0.52);
            playerState.stuntProgress = 0.01;
            if (
              playerState.isDrifting ||
              Math.abs(playerState.steerInput || 0) > 0.25 ||
              Math.abs(playerState.driftAngle || 0) > 0.15
            ) {
              playerState.stuntType = 'flatspin';
              playerState.actionBanner = '🌀 360° FLAT SPIN! +NITRO';
              playerState.actionBannerColor = '#38bdf8';
              playerState.actionBannerTimer = 1.65;
            } else {
              playerState.stuntType = 'barrel';
              playerState.actionBanner = '✈️ BARREL ROLL! +NITRO';
              playerState.actionBannerColor = '#fbbf24';
              playerState.actionBannerTimer = 1.65;
            }
            // Bonus Drift Challenge points for mid-air stunts
            playerState.driftScore = Math.round((playerState.driftScore || 0) + 450);
            if (audioSynth && audioSynth.playNitroBoost) {
              audioSynth.playNitroBoost();
            }
          }
        }
      }

      for (let rIdx = 0; rIdx < rivalsList.length; rIdx++) {
        const rival = rivalsList[rIdx];
        if (rival.eliminated) continue;
        const signedRivalDS =
          ((rival.s - ramp.s + totalLength * 0.5) % totalLength) - totalLength * 0.5;
        const dLat = Math.abs(rival.lateralOffset - ramp.latOffset);
        if (signedRivalDS >= -0.0075 && signedRivalDS <= 0.0080 && dLat < 0.0052) {
          const u = THREE.MathUtils.clamp((signedRivalDS + 0.0071) / 0.0142, 0.0, 1.0);
          const wedgeH = 0.00010 + u * 0.00185;
          rival.hopHeight = Math.max(rival.hopHeight || 0.0, wedgeH);
          if (u >= 0.42 && (rival.hopVel || 0) < 0.015) {
            rival.hopVel = 0.044;
            rival.boostTimer = 1.1;
          }
        }
      }
    }
  }

  function rebuildForSpline(newSplineData) {
    if (!newSplineData || !Array.isArray(newSplineData.samples)) return;
    buildTrackFeatures(newSplineData);
  }

  function reset() {
    for (let i = 0; i < boostPads.length; i++) {
      boostPads[i].playerCooldown = 0.0;
    }
    for (let i = 0; i < jumpRamps.length; i++) {
      jumpRamps[i].playerCooldown = 0.0;
    }
  }

  function dispose() {
    clearMountedInstances();
    padBaseGeo.dispose();
    padBaseMat.dispose();
    padChevronGeo.dispose();
    rampWedgeGeo.dispose();
    rampDeckMat.dispose();
    rampRailGeo.dispose();
    rampRailMat.dispose();
    rampChevronGeo.dispose();
    rampChevronMat.dispose();
    rampLipMat.dispose();
    if (rootGroup.parent) {
      rootGroup.parent.remove(rootGroup);
    }
  }

  return {
    rootGroup,
    update,
    rebuildForSpline,
    reset,
    dispose,
  };
}
