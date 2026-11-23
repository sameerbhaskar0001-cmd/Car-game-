import * as THREE from 'three';
import { createCosmoCarInstance } from '../scene/CosmoCarLoader.js';

/**
 * 3 AI Rival Racers Controller with Adaptive Rubber-Banding, Lane Overtaking,
 * 3D Micro-Kart Visuals, Continuous Distance Ranking, and Vehicle-to-Vehicle Collisions.
 * Zero per-frame GC heap allocations.
 */
export function createRivalRacersController(splineData, scene) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'RivalRacersRoot';
  scene.add(rootGroup);

  let samples = splineData.samples;
  let N = samples.length;
  let totalLength = splineData.total_length_m || 3.2825;
  let gridSlots = Array.isArray(splineData.gridSlots) ? splineData.gridSlots : [];

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
    halfWidth: 0.01705,
    racingLineOffset: 0.0,
    racingLineSpeedFactor: 1.0,
  };
  const _lookAheadFrame = {
    pos: new THREE.Vector3(),
    right: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    halfWidth: 0.01705,
    racingLineOffset: 0.0,
    racingLineSpeedFactor: 1.0,
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
    out.halfWidth = THREE.MathUtils.lerp(
      s0.half_width_m || 0.01705,
      s1.half_width_m || 0.01705,
      alpha
    );
    out.racingLineOffset = THREE.MathUtils.lerp(
      s0.racing_line_offset_m || 0.0,
      s1.racing_line_offset_m || 0.0,
      alpha
    );
    out.racingLineSpeedFactor = THREE.MathUtils.lerp(
      s0.racing_line_speed_factor || 1.0,
      s1.racing_line_speed_factor || 1.0,
      alpha
    );
    return out;
  }

  // -------------------------------------------------------------------------
  // BUILD 3 DISTINCT AI OPPONENT CARS:
  // 1. Interceptor 911 (Police car with roof beacons)
  // 2. Kamaro V8 (Raw American Muscle V8)
  // 3. Ghini Super V12 (Wedge Italian Supercar)
  // -------------------------------------------------------------------------
  const RIVAL_CONFIGS = [
    {
      id: 'bot_police',
      name: 'PATROL',
      color: '#3b82f6',
      paintHex: null, // Authentic Police Interceptor
      carId: 'police',
      bodyId: 'police',
      startGridOffset: 0.018, // Ahead of player on left lane
      laneOffset: -0.0068,
      baseSpeed: 0.156,
      personality: 'aggressive',
    },
    {
      id: 'bot_kamaro',
      name: 'BLAZE',
      color: '#f97316',
      paintHex: 0xf97316,
      carId: 'kamaro',
      bodyId: 'kamaro',
      startGridOffset: 0.038, // Ahead of player on right lane
      laneOffset: 0.0068,
      baseSpeed: 0.160,
      personality: 'speed',
    },
    {
      id: 'bot_ghini',
      name: 'BOLT',
      color: '#eab308',
      paintHex: 0xeab308,
      carId: 'ghini',
      bodyId: 'ghini',
      startGridOffset: 0.058, // Pole position pack leader ahead of player
      laneOffset: -0.0042,
      baseSpeed: 0.165,
      personality: 'cornering',
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

  // Soft radial gradient contact shadow shared across all 3 AI rival cars
  const rivalShadowCanvas = document.createElement('canvas');
  rivalShadowCanvas.width = 128;
  rivalShadowCanvas.height = 128;
  const rsCtx = rivalShadowCanvas.getContext('2d');
  rsCtx.translate(64, 64);
  rsCtx.scale(0.76, 1.05);
  const rsGrad = rsCtx.createRadialGradient(0, 0, 6, 0, 0, 56);
  rsGrad.addColorStop(0.0, 'rgba(1, 1, 3, 0.94)');
  rsGrad.addColorStop(0.55, 'rgba(2, 2, 6, 0.74)');
  rsGrad.addColorStop(0.84, 'rgba(4, 4, 10, 0.28)');
  rsGrad.addColorStop(1.0, 'rgba(4, 4, 10, 0.0)');
  rsCtx.fillStyle = rsGrad;
  rsCtx.beginPath();
  rsCtx.arc(0, 0, 56, 0, Math.PI * 2);
  rsCtx.fill();
  const rivalShadowTex = new THREE.CanvasTexture(rivalShadowCanvas);
  const rivalShadowGeo = new THREE.PlaneGeometry(0.0165, 0.0235);
  const rivalShadowMat = new THREE.MeshBasicMaterial({
    map: rivalShadowTex,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -6,
    polygonOffsetUnits: -6,
  });

  function buildFallbackCarMesh(cfg) {
    const carRoot = new THREE.Group();
    carRoot.scale.setScalar(0.56);

    const shadowQuad = new THREE.Mesh(rivalShadowGeo, rivalShadowMat);
    shadowQuad.rotation.x = -Math.PI / 2;
    shadowQuad.position.set(0, 0.00045, 0);
    shadowQuad.castShadow = false;
    shadowQuad.receiveShadow = false;
    carRoot.add(shadowQuad);

    const fallbackGroup = new THREE.Group();
    fallbackGroup.name = 'FallbackCoupeGroup';
    carRoot.add(fallbackGroup);

    const paintMat = new THREE.MeshStandardMaterial({
      color: cfg.paintHex,
      emissive: new THREE.Color(cfg.paintHex).multiplyScalar(0.15),
      roughness: 0.18,
      metalness: 0.74,
    });
    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0f131d,
      roughness: 0.35,
      metalness: 0.65,
    });

    const bodyMesh = new THREE.Mesh(fallbackChassisGeo, paintMat);
    bodyMesh.position.set(0, 0.0034, 0);
    fallbackGroup.add(bodyMesh);

    if (cfg.bodyId === 'kit2') {
      // Widebody Muscle V8 Blower & GT Wing
      const blower = new THREE.Mesh(new THREE.BoxGeometry(0.0028, 0.0016, 0.0036), darkMat);
      blower.position.set(0, 0.0052, 0.0032);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.0098, 0.0005, 0.0022), darkMat);
      wing.position.set(0, 0.0066, -0.0072);
      fallbackGroup.add(blower, wing);
    } else if (cfg.bodyId === 'kit3') {
      // Le Mans Hypercar Dorsal Shark-Fin & Dual Wing
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.0004, 0.0022, 0.0062), darkMat);
      fin.position.set(0, 0.0064, -0.0042);
      const wing = new THREE.Mesh(new THREE.BoxGeometry(0.0106, 0.0006, 0.0026), paintMat);
      wing.position.set(0, 0.0072, -0.0076);
      fallbackGroup.add(fin, wing);
    }

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

  let startFinishArc = samples[Math.min(splineData.startFinishIdx ?? 1, N - 1)].arc_length_m;
  let gridStartBase = startFinishArc;

  function resolveRivalGridSlot(idx, cfg) {
    // Place rivals in gridSlots[2], [1], [0] (AHEAD of player at gridSlots[3])!
    const slotIdx = Math.max(0, 2 - idx);
    const slot = gridSlots[slotIdx];
    if (slot) {
      return {
        s: slot.s,
        signedOffsetFromStart: slot.signedOffsetFromStart,
        lateralOffset: slot.lateralOffset,
        headingYaw: slot.headingYaw || 0.0,
      };
    }
    const fallbackS = (startFinishArc - 0.025 + cfg.startGridOffset + totalLength) % totalLength;
    return {
      s: fallbackS,
      signedOffsetFromStart: -0.025 + cfg.startGridOffset,
      lateralOffset: cfg.laneOffset,
      headingYaw: 0.0,
    };
  }

  const rivals = RIVAL_CONFIGS.map((cfg, idx) => {
    const { kart, fallbackGroup, paintMat, wheels } = buildFallbackCarMesh(cfg);
    rootGroup.add(kart);

    const gridSlot = resolveRivalGridSlot(idx, cfg);
    const laneBias = idx === 0 ? -0.0028 : idx === 1 ? 0.0028 : 0.0;

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
      s: gridSlot.s,
      totalDistanceTraveled: gridSlot.signedOffsetFromStart, // Continuous distance relative to StartLine!
      lateralOffset: gridSlot.lateralOffset,
      lateralVel: 0.0,
      targetLane: gridSlot.lateralOffset,
      laneBias,
      speed: 0.0,
      baseSpeed: cfg.baseSpeed,
      personality: cfg.personality,
      headingYaw: gridSlot.headingYaw,
      lapCount: 1,
      spinoutTimer: 0.0,
      bumpCooldown: 0.0,
      hopVel: 0.0,
      hopHeight: 0.0,
      heldItem: null,
      itemCooldown: 6.5 + idx * 2.0,
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

  async function attachCosmoRivalModels() {
    for (let i = 0; i < rivals.length; i++) {
      const rival = rivals[i];
      try {
        const carInst = await createCosmoCarInstance(rival.cfg.carId, rival.cfg.paintHex);
        if (rival.fallbackGroup) {
          rival.mesh.remove(rival.fallbackGroup);
          if (rival.fallbackPaintMat) rival.fallbackPaintMat.dispose();
          rival.fallbackGroup = null;
        }
        rival.mesh.add(carInst.assemblyRoot);
        rival.cosmoCar = carInst;
        rival.wheels = carInst.wheelNodes || [];
      } catch (err) {
        console.warn(`Failed to attach Cosmo car ${rival.cfg.carId} to rival:`, err);
      }
    }
  }

  // Reusable scratch vectors & ranking array
  const _left = new THREE.Vector3();
  const _rotMat = new THREE.Matrix4();
  const _baseQuat = new THREE.Quaternion();
  const _yawQuat = new THREE.Quaternion();
  const _tumbleEuler = new THREE.Euler();
  const _tumbleQuat = new THREE.Quaternion();
  const _contactPos = new THREE.Vector3();
  const _contactNorm = new THREE.Vector3();
  const _LANES = [-0.0096, -0.0034, 0.0034, 0.0096];
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
      if ((rival.spinoutTimer || 0) > 0) {
        rival.spinoutTimer = Math.max(0.0, rival.spinoutTimer - dt);
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
        const currFrame = samplePoint(rival.s, _sampleFrame);
        const lookAheadFrame = samplePoint(rival.s + 0.028, _lookAheadFrame);
        const safeHalfW = Math.max(0.0125, (currFrame.halfWidth || 0.01705) - 0.0024);

        // Dynamic Continuous Rubber-Band AI System (Bumper-to-Bumper Racing, Zero Teleporting):
        const deltaS = playerDist - rival.totalDistanceTraveled;
        let rubberBandMultiplier = 1.0;

        if (deltaS > 0.0) {
          const catchUpT = THREE.MathUtils.clamp(deltaS / 0.26, 0.0, 1.0);
          rubberBandMultiplier = THREE.MathUtils.lerp(1.0, 1.25, catchUpT);
        } else if (deltaS < 0.0) {
          const dragT = THREE.MathUtils.clamp(-deltaS / 0.20, 0.0, 1.0);
          rubberBandMultiplier = THREE.MathUtils.lerp(1.0, 0.85, dragT);
        }

        const playerTierScale = THREE.MathUtils.lerp(
          1.0,
          playerState.topSpeedMultiplier || 1.0,
          0.75
        );
        const racingLineSpeedScale = THREE.MathUtils.lerp(
          1.0,
          currFrame.racingLineSpeedFactor || 1.0,
          0.52
        );
        let targetSpeed =
          rival.baseSpeed * playerTierScale * racingLineSpeedScale * rubberBandMultiplier;

        if (rival.boostTimer > 0) {
          targetSpeed *= 1.15;
        }

        if ((rival.spinoutTimer || 0) > 0) {
          // Rival is spinning out after a Player Takedown!
          rival.speed = Math.max(0.025, rival.speed * Math.exp(-3.2 * dt));
          rival.headingYaw += 14.0 * dt;
        } else {
          const accelRate = rival.speed < rival.baseSpeed * 0.82 ? 0.95 : 2.25;
          rival.speed = THREE.MathUtils.lerp(
            rival.speed,
            targetSpeed,
            Math.min(1.0, dt * accelRate)
          );
        }

        const stepDist = rival.speed * dt;
        rival.totalDistanceTraveled += stepDist;
        rival.s =
          ((gridStartBase + rival.totalDistanceTraveled) % totalLength + totalLength) %
          totalLength;
        rival.lapCount = Math.min(
          3,
          Math.floor(Math.max(0, rival.totalDistanceTraveled) / totalLength) + 1
        );

        const desiredRacingLane = THREE.MathUtils.clamp(
          (lookAheadFrame.racingLineOffset || 0.0) + (rival.laneBias || 0.0),
          -safeHalfW * 0.78,
          safeHalfW * 0.78
        );

        const aheadPlayerS = ((playerState.s - rival.s) % totalLength + totalLength) % totalLength;
        if (
          aheadPlayerS > 0.005 &&
          aheadPlayerS < 0.055 &&
          Math.abs(playerState.lateralOffset - rival.lateralOffset) < 0.0056
        ) {
          rival.targetLane = playerState.lateralOffset >= 0 ? -0.0092 : 0.0092;
        } else {
          rival.targetLane = desiredRacingLane;
        }

        const prevLat = rival.lateralOffset;
        if (Math.abs(rival.lateralVel || 0.0) > 0.0002) {
          rival.lateralOffset += rival.lateralVel * dt;
          rival.lateralVel *= Math.exp(-9.5 * dt);
          rival.lateralOffset = THREE.MathUtils.clamp(rival.lateralOffset, -safeHalfW, safeHalfW);
        } else {
          rival.lateralVel = 0.0;
          rival.lateralOffset = THREE.MathUtils.lerp(
            rival.lateralOffset,
            rival.targetLane,
            dt * 3.2
          );
          rival.lateralOffset = THREE.MathUtils.clamp(rival.lateralOffset, -safeHalfW, safeHalfW);
        }

        if ((rival.spinoutTimer || 0) <= 0) {
          const latSteerRate = (rival.lateralOffset - prevLat) / Math.max(1e-4, dt);
          const targetHeadingYaw = THREE.MathUtils.clamp(-latSteerRate * 1.4, -0.18, 0.18);
          rival.headingYaw = THREE.MathUtils.lerp(rival.headingYaw, targetHeadingYaw, dt * 8.5);
        }

        // Rival-vs-Rival solid separation so AI cars never overlap each other
        for (let otherIdx = 0; otherIdx < idx; otherIdx++) {
          const other = rivals[otherIdx];
          const dS = Math.abs(
            ((rival.s - other.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
          );
          const dLat = rival.lateralOffset - other.lateralOffset;
          if (dS < 0.012 && Math.abs(dLat) < 0.0056) {
            const sepSign = dLat >= 0 ? 1 : -1;
            const sepPush = (0.0056 - Math.abs(dLat)) * 0.55;
            rival.lateralOffset = THREE.MathUtils.clamp(
              rival.lateralOffset + sepSign * sepPush,
              -safeHalfW,
              safeHalfW
            );
            other.lateralOffset = THREE.MathUtils.clamp(
              other.lateralOffset - sepSign * sepPush,
              -safeHalfW,
              safeHalfW
            );
          }
        }
      } else if (playerState.victoryCruise) {
        rival.speed = Math.max(0.0, rival.speed * Math.exp(-0.9 * dt));
        rival.s = ((rival.s + rival.speed * dt) % totalLength + totalLength) % totalLength;
      } else {
        rival.speed = 0.0;
      }

      // Aerodynamic Slipstream Drafting + Asphalt Takedown & Bumper Physics
      if (isRacing) {
        const signedDS =
          ((playerState.s - rival.s + totalLength * 0.5) % totalLength) - totalLength * 0.5;
        const absDS = Math.abs(signedDS);
        const latDelta = playerState.lateralOffset - rival.lateralOffset;
        const absDLat = Math.abs(latDelta);
        const absDHop = Math.abs((playerState.hopHeight || 0.0) - (rival.hopHeight || 0.0));

        // 1. Aerodynamic Slipstream Draft (when tucked closely behind a rival at high speed)
        if (
          signedDS < -0.0135 &&
          signedDS > -0.068 &&
          absDLat < 0.0046 &&
          playerState.speed > 0.085 &&
          (rival.spinoutTimer || 0) <= 0
        ) {
          playerState.slipstreamTimer = 0.25;
          playerState.boostCharge = Math.min(1.0, (playerState.boostCharge || 0) + dt * 0.28);
          if (!playerState.actionBanner) {
            playerState.actionBanner = '💨 SLIPSTREAM DRAFT +NITRO';
            playerState.actionBannerColor = '#38bdf8';
            playerState.actionBannerTimer = 0.35;
          }
        }

        // Solid car bounding box in spline space (~13.2mm length x ~5.4mm width)
        const minDS = 0.0132;
        const minDLat = 0.0054;

        if (absDS < minDS && absDLat < minDLat && absDHop < 0.0040) {
          const pushDir =
            Math.abs(latDelta) > 0.0004
              ? Math.sign(latDelta)
              : Math.abs(rival.lateralOffset) > 0.0050
                ? -Math.sign(rival.lateralOffset)
                : idx % 2 === 0
                  ? 1
                  : -1;

          const isLongitudinalRam = absDLat < 0.0034 && absDS > 0.0048;

          if (isLongitudinalRam) {
            const overlapS = minDS - absDS + 0.0006;
            if (signedDS < 0) {
              const pushRivalS = overlapS * 0.82;
              const pushPlayerBackS = overlapS * 0.18;
              rival.totalDistanceTraveled += pushRivalS;
              rival.s = ((gridStartBase + rival.totalDistanceTraveled) % totalLength + totalLength) % totalLength;

              playerState.s = ((playerState.s - pushPlayerBackS) % totalLength + totalLength) % totalLength;
              playerState.totalDistanceTraveled = Math.max(0.0, (playerState.totalDistanceTraveled || 0.0) - pushPlayerBackS);
              playerState.lapDistanceTraveled = Math.max(0.0, (playerState.lapDistanceTraveled || 0.0) - pushPlayerBackS);

              playerState.knockbackLateralVel = pushDir * 0.018;
              rival.lateralVel = -pushDir * 0.022;
              rival.targetLane = THREE.MathUtils.clamp(
                rival.lateralOffset - pushDir * 0.0072,
                -0.0096,
                0.0096
              );
              rival.speed = Math.max(rival.speed, playerState.speed * 1.06);
            } else {
              const pushPlayerS = overlapS * 0.75;
              const pushRivalBackS = overlapS * 0.25;
              playerState.s = (playerState.s + pushPlayerS) % totalLength;
              playerState.totalDistanceTraveled = (playerState.totalDistanceTraveled || 0.0) + pushPlayerS;
              playerState.lapDistanceTraveled = (playerState.lapDistanceTraveled || 0.0) + pushPlayerS;

              rival.totalDistanceTraveled -= pushRivalBackS;
              rival.s = ((gridStartBase + rival.totalDistanceTraveled) % totalLength + totalLength) % totalLength;
              playerState.knockbackLateralVel = pushDir * 0.012;
              rival.lateralVel = -pushDir * 0.018;
              rival.targetLane = -pushDir * 0.0088;

              playerState.speed = Math.max(playerState.speed, rival.speed * 1.04);
              rival.speed *= 0.94;
            }
          } else {
            const overlapLat = minDLat - absDLat + 0.0008;
            playerState.lateralOffset = THREE.MathUtils.clamp(
              playerState.lateralOffset + pushDir * overlapLat * 0.48,
              -0.0148,
              0.0148
            );
            rival.lateralOffset = THREE.MathUtils.clamp(
              rival.lateralOffset - pushDir * overlapLat * 0.52,
              -0.0144,
              0.0144
            );
            playerState.knockbackLateralVel = pushDir * 0.022;
            rival.lateralVel = -pushDir * 0.025;
            rival.targetLane = THREE.MathUtils.clamp(
              rival.lateralOffset - pushDir * 0.0056,
              -0.0096,
              0.0096
            );
          }

          // Check for Asphalt TAKEDOWN! (Boosting/Shockwave collision OR slamming rival into outer guardrail)
          const isBoostAttack =
            (playerState.boostActive || 0) > 0.05 || (playerState.shockwaveTimer || 0) > 0.0;
          const isWallSlam = Math.abs(rival.lateralOffset) >= 0.0102;
          const canTakedown = (isBoostAttack || isWallSlam) && (rival.spinoutTimer || 0) <= 0.0;

          playerState.carImpactTimer = 0.24;
          if (canTakedown) {
            rival.spinoutTimer = 1.25;
            rival.bumpCooldown = 0.65;
            rival.hopVel = 0.016;
            rival.lateralVel = -pushDir * 0.032;
            playerState.boostCharge = Math.min(1.0, (playerState.boostCharge || 0) + 0.50);
            playerState.boostActive = Math.max(playerState.boostActive || 0, 1.35);
            playerState.speed = Math.max(playerState.speed, 0.168 * (playerState.topSpeedMultiplier || 1.0));
            playerState.cameraShake = 0.95;
            playerState.actionBanner = `💥 TAKEDOWN! (${rival.name}) +50% NITRO`;
            playerState.actionBannerColor = '#f43f5e';
            playerState.actionBannerTimer = 1.85;
            if (
              playerState.pendingImpacts &&
              playerState.pendingImpactCount < playerState.pendingImpacts.length
            ) {
              const contactFrame = samplePoint(rival.s);
              _contactPos
                .copy(rival.position)
                .addScaledVector(contactFrame.normal, 0.0022);
              _contactNorm.copy(contactFrame.normal);
              const slot = playerState.pendingImpacts[playerState.pendingImpactCount++];
              slot.pos.copy(_contactPos);
              slot.normal.copy(_contactNorm);
              slot.severity = 1.0;
            }
            if (audioSynth) {
              if (audioSynth.playExplosion) audioSynth.playExplosion();
              if (audioSynth.playRailImpact) audioSynth.playRailImpact(1.1);
            }
          } else if (rival.bumpCooldown <= 0) {
            rival.bumpCooldown = 0.24;
            playerState.headingYaw = THREE.MathUtils.clamp(
              playerState.headingYaw - pushDir * 0.035,
              -0.24,
              0.24
            );
            rival.headingYaw = THREE.MathUtils.clamp(
              rival.headingYaw + pushDir * 0.085,
              -0.22,
              0.22
            );
            playerState.cameraShake = Math.max(playerState.cameraShake || 0.0, 0.62);
            playerState.speed = Math.max(playerState.speed * 0.985, rival.speed * 0.94);
            rival.speed *= 0.97;
            if (
              playerState.pendingImpacts &&
              playerState.pendingImpactCount < playerState.pendingImpacts.length
            ) {
              const contactFrame = samplePoint(rival.s);
              _contactPos
                .copy(playerState.position)
                .add(rival.position)
                .multiplyScalar(0.5)
                .addScaledVector(contactFrame.normal, 0.0018);
              _contactNorm
                .copy(contactFrame.right)
                .multiplyScalar(pushDir)
                .addScaledVector(contactFrame.normal, 0.45)
                .normalize();
              const slot = playerState.pendingImpacts[playerState.pendingImpactCount++];
              slot.pos.copy(_contactPos);
              slot.normal.copy(_contactNorm);
              slot.severity = isLongitudinalRam ? 0.95 : 0.82;
            }
            if (audioSynth && audioSynth.playRailImpact) {
              audioSynth.playRailImpact(0.75);
            }
          }
        }
      }

      // Update 3D World Transform on the track spline (using resolved collision coordinates)
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
      if (rival.cosmoCar) {
        rival.cosmoCar.spinWheels(rival.speed * dt);
        rival.cosmoCar.steerFrontWheels(rival.headingYaw);
      } else if (rival.s64WheelUpdater) {
        rival.s64WheelUpdater(dt, rival.speed, (rival.boostTimer || 0) > 0);
      } else {
        const spinDelta = (rival.speed / 0.002) * dt;
        for (let wIdx = 0; wIdx < rival.wheels.length; wIdx++) {
          rival.wheels[wIdx].rotation.x += spinDelta;
        }
      }
    }

    return getPlayerRank(playerState);
  }

  function reset() {
    for (let idx = 0; idx < rivals.length; idx++) {
      const rival = rivals[idx];
      const cfg = RIVAL_CONFIGS[idx];
      const gridSlot = resolveRivalGridSlot(idx, cfg);
      rival.totalDistanceTraveled = gridSlot.signedOffsetFromStart;
      rival.s = gridSlot.s;
      rival.lateralOffset = gridSlot.lateralOffset;
      rival.lateralVel = 0.0;
      rival.targetLane = gridSlot.lateralOffset;
      rival.speed = 0.0;
      rival.headingYaw = gridSlot.headingYaw || 0.0;
      rival.lapCount = 1;
      rival.spinoutTimer = 0.0;
      rival.bumpCooldown = 0.0;
      rival.boostTimer = 0.0;
      rival.hopHeight = 0.0;
      rival.hopVel = 0.0;
      rival.heldItem = null;
      rival.itemCooldown = 6.5 + idx * 2.0;
      rival.rank = idx + 2;

      const frame = samplePoint(rival.s);
      rival.position
        .copy(frame.pos)
        .addScaledVector(frame.right, rival.lateralOffset)
        .addScaledVector(frame.normal, 0.0003);
      rival.mesh.position.copy(rival.position);

      _left.crossVectors(frame.normal, frame.tangent).normalize();
      _rotMat.makeBasis(_left, frame.normal, frame.tangent);
      _baseQuat.setFromRotationMatrix(_rotMat);
      _yawQuat.setFromAxisAngle(frame.normal, rival.headingYaw);
      rival.mesh.quaternion.copy(_yawQuat.multiply(_baseQuat));
    }
  }

  function setSplineData(newSplineData) {
    if (!newSplineData || !Array.isArray(newSplineData.samples)) return;
    samples = newSplineData.samples;
    N = samples.length;
    totalLength = newSplineData.total_length_m || 3.2825;
    gridSlots = Array.isArray(newSplineData.gridSlots) ? newSplineData.gridSlots : [];
    startFinishArc = samples[Math.min(newSplineData.startFinishIdx ?? 1, N - 1)].arc_length_m;
    gridStartBase = startFinishArc;
    reset();
  }

  // Initialize exact starting grid transforms at boot
  reset();

  return {
    rootGroup,
    rivals,
    update,
    reset,
    setSplineData,
    attachS64RivalModels,
    attachCosmoRivalModels,
    getPlayerRank,
    getRivalsData: () =>
      rivals.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        rank: r.rank,
        speedKmh: Math.round(Math.abs(r.speed) * 240.0 * 3.6),
        position: [r.position.x, r.position.y, r.position.z],
      })),
  };
}
