import * as THREE from 'three';

/**
 * 3 AI Rival Racers Controller with Adaptive Rubber-Banding, Lane Overtaking,
 * 3D Micro-Kart Visuals, Continuous Distance Ranking, and Vehicle-to-Vehicle Collisions.
 * Zero per-frame GC heap allocations.
 */
export function createRivalRacersController(splineData, scene) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'RivalRacersRoot';
  scene.add(rootGroup);

  const samples = splineData.samples;
  const N = samples.length;
  const totalLength = splineData.total_length_m || 3.8371;

  // Pre-allocated scratch vectors for zero-GC spline interpolation
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

  // -------------------------------------------------------------------------
  // BUILD 3 DISTINCT AI OPPONENT CARS (Scaled at 0.56x to match Player S64 Car)
  // Distinct metallic colors: Crimson Red, Lime Green, Deep Violet
  // -------------------------------------------------------------------------
  const RIVAL_CONFIGS = [
    {
      id: 'bot_blaze',
      name: 'Crimson Apex',
      color: '#e11d48',
      paintHex: 0xe11d48, // Metallic Crimson Red
      accentHex: 0xffffff,
      bodyId: 'kit1',
      rimId: 'rim1',
      spoilerId: 'spoiler1',
      startGridOffset: -0.018, // Grid position #2
      laneOffset: -0.0058,
      baseSpeed: 0.184,
      personality: 'aggressive',
    },
    {
      id: 'bot_viper',
      name: 'Venom GT',
      color: '#84cc16',
      paintHex: 0x84cc16, // Metallic Lime Green
      accentHex: 0x0f172a,
      bodyId: 'kit2',
      rimId: 'rim3',
      spoilerId: 'spoiler1',
      startGridOffset: -0.036, // Grid position #3
      laneOffset: 0.0058,
      baseSpeed: 0.18,
      personality: 'cornering',
    },
    {
      id: 'bot_phantom',
      name: 'Violet Specter',
      color: '#7c3aed',
      paintHex: 0x7c3aed, // Metallic Deep Violet
      accentHex: 0xfbbf24,
      bodyId: 'kit3',
      rimId: 'rim2',
      spoilerId: 'spoiler2',
      startGridOffset: -0.054, // Grid position #4
      laneOffset: -0.0024,
      baseSpeed: 0.188,
      personality: 'speed',
    },
  ];

  // Sculpted aerodynamic coupe profile (extruded side silhouette) as instant fallback until S64 FBX clones attach
  const coupeShape = new THREE.Shape();
  coupeShape.moveTo(-0.0085, 0.0012);
  coupeShape.lineTo(0.0088, 0.0012);
  coupeShape.lineTo(0.0092, 0.0028);
  coupeShape.lineTo(0.0042, 0.0036);
  coupeShape.lineTo(0.0018, 0.0058);
  coupeShape.lineTo(-0.0042, 0.0058);
  coupeShape.lineTo(-0.0072, 0.0038);
  coupeShape.lineTo(-0.0088, 0.0036);
  coupeShape.closePath();

  const fallbackChassisGeo = new THREE.ExtrudeGeometry(coupeShape, {
    depth: 0.0082,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.0004,
    bevelThickness: 0.0004,
  });
  fallbackChassisGeo.center();
  // Rotate so length (+X of shape) aligns with +Z forward
  fallbackChassisGeo.rotateY(-Math.PI / 2);

  const fallbackWheelGeo = new THREE.CylinderGeometry(0.0021, 0.0021, 0.0016, 16);
  fallbackWheelGeo.rotateZ(Math.PI / 2);
  const fallbackTireMat = new THREE.MeshStandardMaterial({
    color: 0x12151c,
    roughness: 0.75,
    metalness: 0.15,
  });

  function buildFallbackCarMesh(paintHex) {
    const carRoot = new THREE.Group();
    carRoot.scale.setScalar(0.56);

    const fallbackGroup = new THREE.Group();
    fallbackGroup.name = 'FallbackCoupeGroup';
    carRoot.add(fallbackGroup);

    const paintMat = new THREE.MeshStandardMaterial({
      color: paintHex,
      emissive: new THREE.Color(paintHex).multiplyScalar(0.15),
      roughness: 0.18,
      metalness: 0.74,
    });

    const bodyMesh = new THREE.Mesh(fallbackChassisGeo, paintMat);
    bodyMesh.position.set(0, 0.0034, 0);
    fallbackGroup.add(bodyMesh);

    const wheels = [];
    for (const [wx, wz] of [
      [-0.0044, 0.0054],
      [0.0044, 0.0054],
      [-0.0044, -0.0052],
      [0.0044, -0.0052],
    ]) {
      const w = new THREE.Mesh(fallbackWheelGeo, fallbackTireMat);
      w.position.set(wx, 0.0021, wz);
      fallbackGroup.add(w);
      wheels.push(w);
    }

    return {
      kart: carRoot,
      fallbackGroup,
      paintMat,
      wheels,
    };
  }

  const startFinishArc = samples[Math.min(646, N - 1)].arc_length_m;
  const gridStartBase = (startFinishArc - 0.025 + totalLength) % totalLength;

  const rivals = RIVAL_CONFIGS.map((cfg, idx) => {
    const { kart, fallbackGroup, paintMat, wheels } = buildFallbackCarMesh(cfg.paintHex);
    rootGroup.add(kart);

    const initS = (gridStartBase + cfg.startGridOffset + totalLength) % totalLength;

    return {
      id: cfg.id,
      name: cfg.name,
      color: cfg.color,
      cfg,
      mesh: kart,
      fallbackGroup,
      fallbackPaintMat: paintMat,
      wheels,
      s64WheelUpdater: null,
      s: initS,
      totalDistanceTraveled: cfg.startGridOffset, // Continuous distance from start grid!
      lateralOffset: cfg.laneOffset,
      targetLane: cfg.laneOffset,
      speed: 0.0,
      baseSpeed: cfg.baseSpeed,
      personality: cfg.personality,
      headingYaw: 0.0,
      lapCount: 1,
      spinoutTimer: 0.0,
      bumpCooldown: 0.0,
      hopVel: 0.0,
      hopHeight: 0.0,
      heldItem: null,
      itemCooldown: 4.5 + idx * 1.5,
      position: new THREE.Vector3(),
      rank: idx + 2,
    };
  });

  /**
   * Clones the player's S64 car chassis FBX model onto all 3 AI rivals with their distinct
   * metallic colors (Crimson Red, Lime Green, Deep Violet) and disposes fallback meshes.
   */
  function attachS64RivalModels(s64Car) {
    if (!s64Car || !s64Car.createRivalCarClone) return;
    for (let i = 0; i < rivals.length; i++) {
      const rival = rivals[i];
      const { carGroup, updateWheels } = s64Car.createRivalCarClone({
        bodyId: rival.cfg.bodyId,
        rimId: rival.cfg.rimId,
        spoilerId: rival.cfg.spoilerId,
        paintHex: rival.cfg.paintHex,
        accentHex: rival.cfg.accentHex,
      });

      if (rival.fallbackGroup) {
        rival.mesh.remove(rival.fallbackGroup);
        if (rival.fallbackPaintMat) {
          rival.fallbackPaintMat.dispose();
        }
        rival.fallbackGroup = null;
      }

      rival.mesh.add(carGroup);
      rival.s64WheelUpdater = updateWheels;
      rival.wheels = [];
    }
    fallbackChassisGeo.dispose();
    fallbackWheelGeo.dispose();
    fallbackTireMat.dispose();
  }

  // Reusable scratch vectors & ranking array
  const _left = new THREE.Vector3();
  const _rotMat = new THREE.Matrix4();
  const _baseQuat = new THREE.Quaternion();
  const _yawQuat = new THREE.Quaternion();
  const _LANES = [-0.0068, -0.0024, 0.0024, 0.0068];
  const _rankEntries = [
    { isPlayer: true, dist: 0, rival: null },
    { isPlayer: false, dist: 0, rival: rivals[0] },
    { isPlayer: false, dist: 0, rival: rivals[1] },
    { isPlayer: false, dist: 0, rival: rivals[2] },
  ];

  /**
   * Computes exact player rank (1..4) from continuous totalDistanceTraveled
   */
  function getPlayerRank(playerState) {
    const playerDist = playerState.totalDistanceTraveled ?? 0.0;
    _rankEntries[0].isPlayer = true;
    _rankEntries[0].dist = playerDist;
    _rankEntries[0].rival = null;

    for (let i = 0; i < rivals.length; i++) {
      _rankEntries[i + 1].isPlayer = false;
      _rankEntries[i + 1].dist = rivals[i].totalDistanceTraveled;
      _rankEntries[i + 1].rival = rivals[i];
    }

    _rankEntries.sort((a, b) => b.dist - a.dist);

    let playerRank = 1;
    for (let i = 0; i < _rankEntries.length; i++) {
      const entry = _rankEntries[i];
      if (entry.isPlayer) {
        playerRank = i + 1;
      } else if (entry.rival) {
        entry.rival.rank = i + 1;
      }
    }
    return playerRank;
  }

  /**
   * Updates all 3 AI rivals with rubber-banded movement, lane changes, and collisions
   */
  function update(dt, playerState, powerupManager, audioSynth) {
    const isRacing = !playerState.countdownLocked && !playerState.raceFinished;
    const playerDist = playerState.totalDistanceTraveled ?? 0.0;

    for (let idx = 0; idx < rivals.length; idx++) {
      const rival = rivals[idx];

      if (rival.bumpCooldown > 0) {
        rival.bumpCooldown = Math.max(0.0, rival.bumpCooldown - dt);
      }
      if (rival.boostTimer > 0) {
        rival.boostTimer = Math.max(0.0, rival.boostTimer - dt);
      }

      if (rival.hopHeight > 0 || rival.hopVel !== 0) {
        rival.hopHeight += rival.hopVel * dt;
        rival.hopVel -= 0.18 * dt;
        if (rival.hopHeight <= 0) {
          rival.hopHeight = 0;
          rival.hopVel = 0;
        }
      }

      if (isRacing) {
        if (rival.spinoutTimer > 0) {
          rival.spinoutTimer -= dt;
          rival.headingYaw += dt * 12.0;
          rival.speed = Math.max(0.02, rival.speed * 0.94);
        } else {
          // Exact continuous distance comparison against player
          const distToPlayer = playerDist - rival.totalDistanceTraveled;
          let targetSpeed = rival.baseSpeed;

          if (distToPlayer > 0.30) {
            targetSpeed = rival.baseSpeed * 1.25;
          } else if (distToPlayer > 0.12) {
            targetSpeed = rival.baseSpeed * 1.12;
          } else if (distToPlayer < -0.25) {
            targetSpeed = rival.baseSpeed * 0.65; // Slow down significantly when way ahead
          } else if (distToPlayer < -0.10) {
            targetSpeed = rival.baseSpeed * 0.80; // Moderate slowdown when ahead
          }

          if (rival.boostTimer > 0) {
            targetSpeed *= 1.24;
          }

          rival.speed = THREE.MathUtils.lerp(rival.speed, targetSpeed, dt * 1.8);
          rival.headingYaw = THREE.MathUtils.lerp(rival.headingYaw, 0.0, dt * 6.0);
        }

        const stepDist = rival.speed * dt;
        rival.totalDistanceTraveled += stepDist;
        rival.s = ((gridStartBase + rival.totalDistanceTraveled) % totalLength + totalLength) % totalLength;
        rival.lapCount = Math.min(
          3,
          Math.floor(Math.max(0, rival.totalDistanceTraveled) / totalLength) + 1
        );

        // Smart Overtaking & Lateral Lane Weaving across the widened 30.8mm track
        const aheadPlayerS = ((playerState.s - rival.s) % totalLength + totalLength) % totalLength;
        if (aheadPlayerS > 0.005 && aheadPlayerS < 0.045 && Math.abs(playerState.lateralOffset - rival.lateralOffset) < 0.0046) {
          // Steer to a wide open lane to overtake the player cleanly
          rival.targetLane = playerState.lateralOffset >= 0 ? -0.0066 : 0.0066;
        } else if (Math.random() < 0.015) {
          rival.targetLane = _LANES[Math.floor(Math.random() * _LANES.length)];
        }
        rival.lateralOffset = THREE.MathUtils.lerp(
          rival.lateralOffset,
          rival.targetLane,
          dt * 2.4
        );

        // Active AI Powerup Combat Triggering
        rival.itemCooldown -= dt;
        if (rival.heldItem && rival.itemCooldown <= 0 && rival.spinoutTimer <= 0) {
          rival.itemCooldown = 4.8 + Math.random() * 3.5;
          if (powerupManager && powerupManager.triggerRivalPowerup) {
            powerupManager.triggerRivalPowerup(rival, playerState, rivals, audioSynth);
          } else {
            if (rival.heldItem === 'ROCKET' || rival.heldItem === 'HYPER_NITRO') {
              rival.boostTimer = 1.6;
              rival.speed *= 1.24;
            }
            rival.heldItem = null;
          }
        }
      } else {
        rival.speed = 0.0;
      }

      // Update 3D World Transform on the track spline
      const frame = samplePoint(rival.s);
      rival.position
        .copy(frame.pos)
        .addScaledVector(frame.right, rival.lateralOffset)
        .addScaledVector(frame.normal, 0.0003 + rival.hopHeight);

      rival.mesh.position.copy(rival.position);

      _left.crossVectors(frame.normal, frame.tangent).normalize();
      _rotMat.makeBasis(_left, frame.normal, frame.tangent);
      _baseQuat.setFromRotationMatrix(_rotMat);
      _yawQuat.setFromAxisAngle(frame.normal, rival.headingYaw);
      rival.mesh.quaternion.copy(_yawQuat.multiply(_baseQuat));

      // Spin wheels & update AI exhaust flames
      if (rival.s64WheelUpdater) {
        rival.s64WheelUpdater(dt, rival.speed, (rival.boostTimer || 0) > 0);
      } else {
        const spinDelta = (rival.speed / 0.002) * dt;
        for (let wIdx = 0; wIdx < rival.wheels.length; wIdx++) {
          rival.wheels[wIdx].rotation.x += spinDelta;
        }
      }

      // Vehicle-to-Vehicle Collision: Player vs Rival (with 0.45s cooldown to prevent audio/speed spam)
      if (isRacing && rival.bumpCooldown <= 0) {
        const dSpline = Math.abs(
          ((playerState.s - rival.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dLat = Math.abs(playerState.lateralOffset - rival.lateralOffset);
        if (dSpline < 0.0095 && dLat < 0.0046) {
          rival.bumpCooldown = 0.45;
          const latDelta = playerState.lateralOffset - rival.lateralOffset;
          const pushDir = Math.sign(latDelta) || (idx % 2 === 0 ? 1 : -1);

          playerState.lateralOffset = THREE.MathUtils.clamp(
            playerState.lateralOffset + pushDir * 0.0024,
            -0.0116,
            0.0116
          );
          rival.lateralOffset = THREE.MathUtils.clamp(
            rival.lateralOffset - pushDir * 0.0024,
            -0.0116,
            0.0116
          );

          playerState.speed *= 0.94;
          rival.speed *= 0.92;

          if (audioSynth && audioSynth.playRailImpact) {
            audioSynth.playRailImpact(0.45);
          }
        }
      }
    }

    return getPlayerRank(playerState);
  }

  function reset() {
    for (let idx = 0; idx < rivals.length; idx++) {
      const rival = rivals[idx];
      const cfg = RIVAL_CONFIGS[idx];
      rival.totalDistanceTraveled = cfg.startGridOffset;
      rival.s = (gridStartBase + cfg.startGridOffset + totalLength) % totalLength;
      rival.lateralOffset = cfg.laneOffset;
      rival.targetLane = cfg.laneOffset;
      rival.speed = 0.0;
      rival.headingYaw = 0.0;
      rival.lapCount = 1;
      rival.spinoutTimer = 0.0;
      rival.bumpCooldown = 0.0;
      rival.boostTimer = 0.0;
      rival.hopHeight = 0.0;
      rival.hopVel = 0.0;
      rival.heldItem = null;
      rival.rank = idx + 2;

      const frame = samplePoint(rival.s);
      rival.position
        .copy(frame.pos)
        .addScaledVector(frame.right, rival.lateralOffset)
        .addScaledVector(frame.normal, 0.0003);
      rival.mesh.position.copy(rival.position);

      _left.crossVectors(frame.normal, frame.tangent).normalize();
      _rotMat.makeBasis(_left, frame.normal, frame.tangent);
      rival.mesh.quaternion.setFromRotationMatrix(_rotMat);
    }
  }

  return {
    rootGroup,
    rivals,
    update,
    reset,
    attachS64RivalModels,
    getPlayerRank,
    getRivalsData: () =>
      rivals.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        rank: r.rank,
        speedKmh: Math.round(Math.abs(r.speed) * 102.35 * 3.6),
        position: [r.position.x, r.position.y, r.position.z],
      })),
  };
}
