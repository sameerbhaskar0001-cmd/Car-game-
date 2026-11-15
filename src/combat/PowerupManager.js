import * as THREE from 'three';

/**
 * Beach Buggy Style 3D Mystery Pod, Roulette Roll & Combat Weapon System (Phase 1)
 * Manages:
 * - Floating 3D Mystery Energy Pods with dual neon rings & pickup burst
 * - Slot-Machine Weapon Roulette Roll with audio ticks & lock chime
 * - 3D Target Lock-On Crosshair Reticle over targeted rival ahead
 * - Homing Fireball Missiles with 3D fins & live smoke/fire trail
 * - Chain Lightning / EMP Shockwave with 3D jagged electric arcs
 * - Geodesic Bubble Shield dome with explosive deflection
 * - Glowing Toxic/Oil Hazard Traps & Nitro Afterburner Surges
 * Optimized for 60 FPS mobile landscape with shared geometries.
 */
export function createPowerupManager(splineData, scene) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'CombatPowerupRoot';
  scene.add(rootGroup);

  const samples = splineData.samples;
  const N = samples.length;
  const totalLength = splineData.total_length_m || 3.8371;

  const POWERUP_POOL = ['ROCKET', 'SHIELD', 'OIL_SLICK', 'HYPER_NITRO', 'EMP'];

  // Pre-allocated scratch vectors for zero-GC per-frame spline queries
  const _p0 = new THREE.Vector3();
  const _p1 = new THREE.Vector3();
  const _r0 = new THREE.Vector3();
  const _r1 = new THREE.Vector3();
  const _n0 = new THREE.Vector3();
  const _n1 = new THREE.Vector3();
  const _t0 = new THREE.Vector3();
  const _t1 = new THREE.Vector3();
  const _upZ = new THREE.Vector3(0, 0, 1);
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
  // 1. BEACH BUGGY STYLE FLOATING 3D MYSTERY ENERGY PODS (4 SECTORS x 3 LANES)
  // -------------------------------------------------------------------------
  const boxSectorsS = [
    totalLength * 0.14, // West Sweeper exit into Back Straightaway
    totalLength * 0.36, // Mid Back Straightaway
    totalLength * 0.64, // East Carousel exit into Front Straightaway
    totalLength * 0.88, // Front Straightaway approaching Start/Finish
  ];

  // Outer crystalline energy pod shell
  const podShellGeo = new THREE.OctahedronGeometry(0.0022, 1);
  const podPalette = [
    { shell: 0xff2a85, emissive: 0xff0055, ring: 0x00f0ff },
    { shell: 0x00f0ff, emissive: 0x0088ff, ring: 0xffbe0b },
    { shell: 0xa855f7, emissive: 0x7e22ce, ring: 0x00f0ff },
  ];

  // Inner glowing core
  const coreGeo = new THREE.OctahedronGeometry(0.00125, 0);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    toneMapped: false,
  });

  // Orbiting energy ring around each mystery pod
  const podRingGeo = new THREE.TorusGeometry(0.0027, 0.00022, 8, 24);

  const mysteryBoxes = [];

  boxSectorsS.forEach((baseS, secIdx) => {
    [-0.0062, 0.0, 0.0062].forEach((latOffset, sideIdx) => {
      const frame = samplePoint(baseS);
      const pal = podPalette[(secIdx + sideIdx) % podPalette.length];

      const podGroup = new THREE.Group();

      const shellMat = new THREE.MeshStandardMaterial({
        color: pal.shell,
        emissive: new THREE.Color(pal.emissive),
        emissiveIntensity: 1.15,
        roughness: 0.15,
        metalness: 0.3,
        transparent: true,
        opacity: 0.82,
      });
      const shellMesh = new THREE.Mesh(podShellGeo, shellMat);
      podGroup.add(shellMesh);

      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      podGroup.add(coreMesh);

      const ringMat = new THREE.MeshBasicMaterial({
        color: pal.ring,
        toneMapped: false,
      });
      const ringMesh = new THREE.Mesh(podRingGeo, ringMat);
      ringMesh.rotation.x = Math.PI * 0.35;
      podGroup.add(ringMesh);

      const worldPos = frame.pos
        .clone()
        .addScaledVector(frame.right, latOffset)
        .addScaledVector(frame.normal, 0.0030);

      podGroup.position.copy(worldPos);
      rootGroup.add(podGroup);

      mysteryBoxes.push({
        id: `box_${secIdx}_${sideIdx}`,
        s: baseS,
        latOffset,
        mesh: podGroup,
        coreMesh,
        ringMesh,
        basePos: worldPos,
        normal: frame.normal.clone(),
        active: true,
        respawnTimer: 0.0,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 1B. 6 NEON CHEVRON TRACK BOOST PADS & 3 ARCADE JUMP RAMPS
  // -------------------------------------------------------------------------
  const boostPadConfigs = [
    { sFrac: 0.22, latOffset: -0.0045, color: 0x00f0ff },
    { sFrac: 0.33, latOffset: 0.0045, color: 0xf59e0b },
    { sFrac: 0.44, latOffset: -0.0038, color: 0x00f0ff },
    { sFrac: 0.72, latOffset: 0.0045, color: 0xf59e0b },
    { sFrac: 0.83, latOffset: -0.0045, color: 0x00f0ff },
    { sFrac: 0.94, latOffset: 0.0, color: 0xf59e0b },
  ];

  const padBaseGeo = new THREE.BoxGeometry(0.0068, 0.00035, 0.018);
  const padBaseMat = new THREE.MeshStandardMaterial({
    color: 0x090d16,
    roughness: 0.3,
    metalness: 0.8,
  });
  const padChevronGeo = new THREE.BoxGeometry(0.0028, 0.00048, 0.0009);

  const boostPads = boostPadConfigs.map((cfg, idx) => {
    const padS = cfg.sFrac * totalLength;
    const frame = samplePoint(padS);
    const padGroup = new THREE.Group();

    const baseMesh = new THREE.Mesh(padBaseGeo, padBaseMat);
    padGroup.add(baseMesh);

    const chevMat = new THREE.MeshBasicMaterial({
      color: cfg.color,
      toneMapped: false,
    });

    const chevronPairs = [];
    for (let c = 0; c < 3; c++) {
      const zOff = -0.0052 + c * 0.0052;
      const leftWing = new THREE.Mesh(padChevronGeo, chevMat.clone());
      leftWing.position.set(-0.0012, 0.00018, zOff);
      leftWing.rotation.y = -0.52;
      const rightWing = new THREE.Mesh(padChevronGeo, leftWing.material);
      rightWing.position.set(0.0012, 0.00018, zOff);
      rightWing.rotation.y = 0.52;
      padGroup.add(leftWing, rightWing);
      chevronPairs.push(leftWing.material);
    }

    padGroup.position
      .copy(frame.pos)
      .addScaledVector(frame.right, cfg.latOffset)
      .addScaledVector(frame.normal, 0.00032);

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

  // 3 Sculpted 3D Wedge Arcade Jump Ramps
  const jumpRampConfigs = [
    { sFrac: 0.28, latOffset: 0.0 },
    { sFrac: 0.40, latOffset: 0.0042 },
    { sFrac: 0.78, latOffset: 0.0 },
  ];

  const wedgeShape = new THREE.Shape();
  wedgeShape.moveTo(-0.0095, 0.0);
  wedgeShape.lineTo(0.0095, 0.0);
  wedgeShape.lineTo(0.0095, 0.0036);
  wedgeShape.lineTo(-0.0095, 0.0003);
  wedgeShape.closePath();

  const rampWedgeGeo = new THREE.ExtrudeGeometry(wedgeShape, {
    depth: 0.0086,
    bevelEnabled: false,
  });
  rampWedgeGeo.translate(0, 0, -0.0043);
  rampWedgeGeo.rotateY(-Math.PI / 2);

  const rampDeckMat = new THREE.MeshStandardMaterial({
    color: 0x151e32,
    roughness: 0.22,
    metalness: 0.78,
  });
  const rampRailGeo = new THREE.BoxGeometry(0.00065, 0.0012, 0.0192);
  const rampRailMat = new THREE.MeshBasicMaterial({
    color: 0xff2a85,
    toneMapped: false,
  });
  const rampChevronGeo = new THREE.BoxGeometry(0.0032, 0.00035, 0.0010);
  const rampChevronMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    toneMapped: false,
  });
  const rampLipMat = new THREE.MeshBasicMaterial({
    color: 0xffbe0b,
    toneMapped: false,
  });

  const jumpRamps = jumpRampConfigs.map((cfg, idx) => {
    const rampS = cfg.sFrac * totalLength;
    const frame = samplePoint(rampS);
    const rampGroup = new THREE.Group();

    const wedgeMesh = new THREE.Mesh(rampWedgeGeo, rampDeckMat);
    rampGroup.add(wedgeMesh);

    const slopeGroup = new THREE.Group();
    slopeGroup.position.set(0, 0.00195, 0);
    slopeGroup.rotation.x = -0.172;

    for (const rx of [-0.0042, 0.0042]) {
      const rail = new THREE.Mesh(rampRailGeo, rampRailMat);
      rail.position.set(rx, 0.0004, 0);
      slopeGroup.add(rail);
    }

    for (let c = 0; c < 3; c++) {
      const zOff = -0.0052 + c * 0.0048;
      const lWing = new THREE.Mesh(rampChevronGeo, c === 2 ? rampLipMat : rampChevronMat);
      lWing.position.set(-0.0013, 0.00022, zOff);
      lWing.rotation.y = -0.48;
      const rWing = new THREE.Mesh(rampChevronGeo, c === 2 ? rampLipMat : rampChevronMat);
      rWing.position.set(0.0013, 0.00022, zOff);
      rWing.rotation.y = 0.48;
      slopeGroup.add(lWing, rWing);
    }

    rampGroup.add(slopeGroup);

    rampGroup.position
      .copy(frame.pos)
      .addScaledVector(frame.right, cfg.latOffset)
      .addScaledVector(frame.normal, 0.00015);

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

  // -------------------------------------------------------------------------
  // 2. SHARED GEOMETRIES & MATERIALS FOR BEACH BUGGY WEAPONS & LOCK-ON
  // -------------------------------------------------------------------------
  // 2A. 3D Target Lock-On Crosshair Ring (hovers over targeted rival ahead!)
  const targetReticleGroup = new THREE.Group();
  targetReticleGroup.visible = false;
  const reticleOuterRing = new THREE.Mesh(
    new THREE.RingGeometry(0.0048, 0.0062, 24),
    new THREE.MeshBasicMaterial({
      color: 0xff2a2a,
      side: THREE.DoubleSide,
      toneMapped: false,
      depthWrite: false,
    })
  );
  reticleOuterRing.rotation.x = -Math.PI / 2;
  targetReticleGroup.add(reticleOuterRing);

  const reticleDiamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.0014, 0),
    new THREE.MeshBasicMaterial({
      color: 0xffbe0b,
      wireframe: true,
      toneMapped: false,
    })
  );
  reticleDiamond.position.y = 0.0065;
  targetReticleGroup.add(reticleDiamond);
  rootGroup.add(targetReticleGroup);

  // 2B. Finned Homing Fireball Missiles + Smoke/Flame Trail Puffs
  const activeRockets = [];
  const rocketBodyGeo = new THREE.CylinderGeometry(0.0009, 0.0014, 0.0058, 12);
  rocketBodyGeo.rotateX(Math.PI / 2);
  const rocketNoseGeo = new THREE.ConeGeometry(0.0014, 0.0024, 12);
  rocketNoseGeo.rotateX(Math.PI / 2);
  rocketNoseGeo.translate(0, 0, 0.0038);
  const rocketFinGeo = new THREE.BoxGeometry(0.0038, 0.00035, 0.0018);
  rocketFinGeo.translate(0, 0, -0.0022);

  const rocketBodyMat = new THREE.MeshStandardMaterial({
    color: 0xff1e26,
    emissive: new THREE.Color(0xff4500),
    emissiveIntensity: 1.4,
    roughness: 0.2,
    metalness: 0.7,
  });
  const rocketNoseMat = new THREE.MeshBasicMaterial({
    color: 0xffbe0b,
    toneMapped: false,
  });

  function createRocketMesh() {
    const grp = new THREE.Group();
    const body = new THREE.Mesh(rocketBodyGeo, rocketBodyMat);
    const nose = new THREE.Mesh(rocketNoseGeo, rocketNoseMat);
    const finH = new THREE.Mesh(rocketFinGeo, rocketNoseMat);
    const finV = new THREE.Mesh(rocketFinGeo, rocketNoseMat);
    finV.rotation.z = Math.PI / 2;
    grp.add(body, nose, finH, finV);
    return grp;
  }

  // Rocket Smoke & Flame Trail Puffs
  const rocketTrailPuffs = [];
  const trailPuffGeo = new THREE.DodecahedronGeometry(0.0012, 0);
  const trailFireMat = new THREE.MeshBasicMaterial({
    color: 0xff7700,
    transparent: true,
    opacity: 0.85,
    toneMapped: false,
  });

  // 2C. Active Oil / Toxic Slick Traps on Track
  const activeOilSlicks = [];
  const oilGeo = new THREE.CircleGeometry(0.0062, 20);
  oilGeo.rotateX(-Math.PI / 2);
  const oilMat = new THREE.MeshStandardMaterial({
    color: 0x090b10,
    emissive: new THREE.Color(0x581c87),
    emissiveIntensity: 0.85,
    roughness: 0.05,
    metalness: 0.95,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const oilRingGeo = new THREE.RingGeometry(0.0054, 0.0068, 24);
  oilRingGeo.rotateX(-Math.PI / 2);
  const oilRingMat = new THREE.MeshBasicMaterial({
    color: 0xc084fc,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
  const oilCoreRingGeo = new THREE.RingGeometry(0.0022, 0.0032, 16);
  oilCoreRingGeo.rotateX(-Math.PI / 2);
  const oilCoreRingMat = new THREE.MeshBasicMaterial({
    color: 0x22c55e,
    side: THREE.DoubleSide,
    toneMapped: false,
  });

  // 2D. Active EMP Shockwaves & 3D Chain Lightning Bolts
  const activeEmpWaves = [];
  const empGeo = new THREE.RingGeometry(0.0024, 0.0042, 28);
  empGeo.rotateX(-Math.PI / 2);
  const activeLightningBolts = [];

  // 2E. Multi-Stage Explosion Fireballs & Flying Debris Sparks
  const explosionSparks = [];
  const shockwaveGeo = new THREE.IcosahedronGeometry(0.0026, 1);
  const debrisGeo = new THREE.OctahedronGeometry(0.00085, 0);

  // 2F. Geodesic Bubble Shield Dome (Dual-Layer Beach Buggy Energy Shield)
  const playerShieldGroup = new THREE.Group();
  playerShieldGroup.visible = false;

  const shieldSphereGeo = new THREE.SphereGeometry(0.0076, 18, 14);
  const shieldSphereMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: new THREE.Color(0x00c8e0),
    emissiveIntensity: 0.75,
    roughness: 0.12,
    metalness: 0.2,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const shieldInnerMesh = new THREE.Mesh(shieldSphereGeo, shieldSphereMat);
  playerShieldGroup.add(shieldInnerMesh);

  const shieldWireGeo = new THREE.IcosahedronGeometry(0.0079, 1);
  const shieldWireMat = new THREE.MeshBasicMaterial({
    color: 0x7dd3fc,
    wireframe: true,
    transparent: true,
    opacity: 0.65,
    toneMapped: false,
    depthWrite: false,
  });
  const shieldWireMesh = new THREE.Mesh(shieldWireGeo, shieldWireMat);
  playerShieldGroup.add(shieldWireMesh);
  rootGroup.add(playerShieldGroup);

  // Player Powerup & Roulette State
  let playerHeldPowerup = null;
  let pendingPowerup = null;
  let rouletteTimer = 0.0;
  let rouletteCycleIdx = 0;
  let roulettePreview = null;
  let playerPickupCooldown = 0.0;
  let playerShieldTimer = 0.0;
  let playerSpinoutTimer = 0.0;
  let playerSpinoutReason = null;

  // Combat Feed Toast & Target Lock Info
  let combatFeedMessage = null;
  let combatFeedTimer = 0.0;
  let lockedTargetInfo = { name: null, distM: null };
  let incomingThreatInfo = { active: false, attackerName: null, urgency: 0.0 };

  function setCombatFeed(msg, duration = 2.4) {
    combatFeedMessage = msg;
    combatFeedTimer = duration;
  }

  /**
   * Rolls a weighted mystery pod powerup based on rank (1st = defense/traps, 2nd-4th = offensive/boost)
   */
  function rollPowerup(rank = 1) {
    const roll = Math.random();
    if (rank >= 4) {
      if (roll < 0.46) return 'ROCKET';
      if (roll < 0.76) return 'HYPER_NITRO';
      if (roll < 0.92) return 'EMP';
      return 'SHIELD';
    } else if (rank >= 2) {
      if (roll < 0.40) return 'ROCKET';
      if (roll < 0.64) return 'HYPER_NITRO';
      if (roll < 0.84) return 'EMP';
      return 'SHIELD';
    } else {
      if (roll < 0.36) return 'SHIELD';
      if (roll < 0.68) return 'OIL_SLICK';
      if (roll < 0.86) return 'ROCKET';
      return 'HYPER_NITRO';
    }
  }

  /**
   * Spawns a multi-layered Beach Buggy explosion fireball + flying debris embers at a 3D location
   */
  function triggerExplosion(pos, audioSynth, colorHex = 0xff6600) {
    if (audioSynth && audioSynth.playExplosion) {
      audioSynth.playExplosion();
    }
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: colorHex,
      transparent: true,
      opacity: 0.95,
      wireframe: true,
      toneMapped: false,
    });
    const shockMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    shockMesh.position.copy(pos);
    rootGroup.add(shockMesh);

    const debrisParticles = [];
    for (let d = 0; d < 8; d++) {
      const dMat = new THREE.MeshBasicMaterial({
        color: d % 2 === 0 ? 0xffbe0b : 0xff2a2a,
        transparent: true,
        opacity: 1.0,
        toneMapped: false,
      });
      const dMesh = new THREE.Mesh(debrisGeo, dMat);
      dMesh.position.copy(pos);
      rootGroup.add(dMesh);
      const angle = (d / 8) * Math.PI * 2 + Math.random() * 0.4;
      const spd = 0.035 + Math.random() * 0.045;
      debrisParticles.push({
        mesh: dMesh,
        vel: new THREE.Vector3(
          Math.cos(angle) * spd,
          0.035 + Math.random() * 0.04,
          Math.sin(angle) * spd
        ),
      });
    }

    explosionSparks.push({
      mesh: shockMesh,
      debris: debrisParticles,
      scale: 1.0,
      timer: 0.45,
      maxTimer: 0.45,
    });
  }

  /**
   * Spawns a 3D jagged electric lightning bolt between two 3D world positions
   */
  function spawnLightningBolt(startPos, endPos) {
    const segments = 8;
    const points = [];
    const diff = new THREE.Vector3().subVectors(endPos, startPos);
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const pt = new THREE.Vector3().copy(startPos).addScaledVector(diff, t);
      if (i > 0 && i < segments) {
        pt.x += (Math.random() - 0.5) * 0.0065;
        pt.y += (Math.random() - 0.5) * 0.0065 + 0.0025;
        pt.z += (Math.random() - 0.5) * 0.0065;
      }
      points.push(pt);
    }
    const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 1.0,
      toneMapped: false,
    });
    const lineMesh = new THREE.Line(lineGeo, lineMat);
    rootGroup.add(lineMesh);

    activeLightningBolts.push({
      mesh: lineMesh,
      timer: 0.38,
    });
  }

  /**
   * Drops a glowing oil/toxic hazard trap behind the given track position
   */
  function spawnOilSlick(sVal, latOffset, ownerId) {
    const behindS = ((sVal - 0.018) % totalLength + totalLength) % totalLength;
    const frame = samplePoint(behindS);
    const oilGroup = new THREE.Group();
    const oilMesh = new THREE.Mesh(oilGeo, oilMat);
    const ringMesh = new THREE.Mesh(oilRingGeo, oilRingMat);
    const coreRing = new THREE.Mesh(oilCoreRingGeo, oilCoreRingMat);
    ringMesh.position.y = 0.00012;
    coreRing.position.y = 0.00018;
    oilGroup.add(oilMesh, ringMesh, coreRing);

    oilGroup.position
      .copy(frame.pos)
      .addScaledVector(frame.right, latOffset)
      .addScaledVector(frame.normal, 0.0005);
    oilGroup.quaternion.setFromUnitVectors(_upZ, frame.tangent);
    rootGroup.add(oilGroup);

    activeOilSlicks.push({
      s: behindS,
      latOffset,
      ownerId,
      ownerGraceTimer: 3.0,
      mesh: oilGroup,
      timer: 18.0,
    });
  }

  /**
   * Fires a finned homing fireball missile along the spline toward the locked target ahead
   */
  function fireRocket(startS, startLat, targetRacer, ownerId, ownerName, audioSynth) {
    if (audioSynth && audioSynth.playRocketLaunch) {
      audioSynth.playRocketLaunch();
    }
    const spawnS = (startS + 0.015) % totalLength;
    const frame = samplePoint(spawnS);
    const rocketMesh = createRocketMesh();
    rocketMesh.position
      .copy(frame.pos)
      .addScaledVector(frame.right, startLat)
      .addScaledVector(frame.normal, 0.0036);
    rocketMesh.quaternion.setFromUnitVectors(_upZ, frame.tangent);
    rootGroup.add(rocketMesh);

    activeRockets.push({
      s: spawnS,
      latOffset: startLat,
      ownerId,
      ownerName: ownerName || 'RIVAL',
      mesh: rocketMesh,
      targetRacer,
      speed: 0.46,
      lifeTimer: 4.2,
      trailAccum: 0.0,
    });
  }

  /**
   * Triggers an expanding EMP shockwave ring
   */
  function triggerEmp(startPos, sourceId, audioSynth) {
    if (audioSynth && audioSynth.playEmpBlast) {
      audioSynth.playEmpBlast();
    }
    const empMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    });
    const empMesh = new THREE.Mesh(empGeo, empMat);
    empMesh.position.copy(startPos);
    rootGroup.add(empMesh);

    activeEmpWaves.push({
      mesh: empMesh,
      sourceId,
      radius: 0.004,
      timer: 0.58,
    });
  }

  /**
   * Finds the nearest rival ahead of the player for weapon lock-on
   */
  function findNearestRivalAhead(playerState, rivalsList, maxAheadM = 0.95) {
    let nearestTarget = null;
    let minAheadDist = Infinity;
    for (let i = 0; i < rivalsList.length; i++) {
      const r = rivalsList[i];
      const aheadDist = ((r.s - playerState.s) % totalLength + totalLength) % totalLength;
      if (aheadDist > 0.006 && aheadDist < maxAheadM && aheadDist < minAheadDist) {
        minAheadDist = aheadDist;
        nearestTarget = r;
      }
    }
    return { target: nearestTarget, distM: nearestTarget ? minAheadDist : null };
  }

  /**
   * AI Rival triggers its held powerup (Rockets, Oil Slicks, EMPs, or Hyper Nitro)
   */
  function triggerRivalPowerup(rival, playerState, rivalsList, audioSynth) {
    if (!rival || !rival.heldItem || rival.spinoutTimer > 0) return false;
    const item = rival.heldItem;

    // Opening 8.0s grace period on Lap 1: AI only uses speed boosts, never offensive spinout weapons
    if ((playerState.totalRaceTime || 0) < 8.0 && item !== 'HYPER_NITRO') {
      return false;
    }

    rival.heldItem = null;

    if (item === 'HYPER_NITRO') {
      rival.boostTimer = 2.0;
      rival.speed = Math.max(rival.speed, rival.baseSpeed * 1.28);
      return true;
    }

    if (item === 'OIL_SLICK') {
      spawnOilSlick(rival.s, rival.lateralOffset, rival.id);
      return true;
    }

    if (item === 'ROCKET') {
      let nearestTarget = null;
      let minAheadDist = Infinity;

      const playerAheadDist = ((playerState.s - rival.s) % totalLength + totalLength) % totalLength;
      if (playerAheadDist > 0.018 && playerAheadDist < 0.68) {
        minAheadDist = playerAheadDist;
        nearestTarget = {
          isPlayer: true,
          get s() {
            return playerState.s;
          },
          get lateralOffset() {
            return playerState.lateralOffset;
          },
        };
      }

      for (let i = 0; i < rivalsList.length; i++) {
        const other = rivalsList[i];
        if (other.id === rival.id) continue;
        const aheadDist = ((other.s - rival.s) % totalLength + totalLength) % totalLength;
        if (aheadDist > 0.012 && aheadDist < minAheadDist) {
          minAheadDist = aheadDist;
          nearestTarget = other;
        }
      }

      const dToPlayer = rival.position.distanceTo(playerState.position);
      fireRocket(
        rival.s,
        rival.lateralOffset,
        nearestTarget,
        rival.id,
        rival.name,
        dToPlayer < 0.28 ? audioSynth : null
      );
      return true;
    }

    if (item === 'EMP') {
      const dPlayer = rival.position.distanceTo(playerState.position);
      const dSpline = Math.abs(
        ((rival.s - playerState.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
      );
      triggerEmp(rival.position, rival.id, dPlayer < 0.26 ? audioSynth : null);
      if (dPlayer < 0.045 && dSpline < 0.048) {
        spawnLightningBolt(rival.position, playerState.position);
        if (playerShieldTimer > 0) {
          playerShieldTimer = 0.0;
          playerShieldGroup.visible = false;
          triggerExplosion(playerState.position, audioSynth, 0x00f0ff);
          if (audioSynth && audioSynth.playShieldDeflect) {
            audioSynth.playShieldDeflect();
          }
          setCombatFeed('🛡️ SHIELD BLOCKED EMP SHOCKWAVE!');
        } else {
          playerSpinoutTimer = 0.78;
          playerSpinoutReason = `⚡ ZAPPED BY ${rival.name}'S EMP!`;
          playerState.spinoutTimer = 0.78;
          playerState.spinoutDir = Math.random() < 0.5 ? 1 : -1;
          playerState.speed *= 0.48;
          playerState.boostActive = 0.0;
          playerState.hopVel = 0.036;
          playerState.cameraShake = 0.28;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Player triggers held powerup (or fast-locks roulette if tapped during spin!)
   */
  function triggerPlayerPowerup(playerState, rivalsList, audioSynth) {
    if (playerSpinoutTimer > 0) return false;

    // If roulette is still spinning and player taps fire, immediately lock in the weapon!
    if (rouletteTimer > 0 && pendingPowerup) {
      playerHeldPowerup = pendingPowerup;
      pendingPowerup = null;
      rouletteTimer = 0.0;
      roulettePreview = null;
    }

    if (!playerHeldPowerup) return false;

    const currentItem = playerHeldPowerup;
    playerHeldPowerup = null;
    playerPickupCooldown = Math.max(playerPickupCooldown, 0.55);

    if (currentItem === 'SHIELD') {
      playerShieldTimer = 7.5;
      playerShieldGroup.visible = true;
      if (audioSynth && audioSynth.playShieldActivate) {
        audioSynth.playShieldActivate();
      }
      setCombatFeed('🛡️ BUBBLE SHIELD ACTIVATED!');
      return true;
    }

    if (currentItem === 'HYPER_NITRO') {
      playerState.boostActive = Math.max(playerState.boostActive || 0, 2.25);
      playerState.boostCharge = 1.0;
      playerState.speed = Math.max(
        playerState.speed,
        0.305 * (playerState.topSpeedMultiplier || 1.0)
      );
      playerState.cameraShake = Math.max(playerState.cameraShake || 0, 0.14);
      if (audioSynth && audioSynth.playNitroBoost) {
        audioSynth.playNitroBoost();
      }
      setCombatFeed('⚡ HYPER NITRO UNLEASHED!');
      return true;
    }

    if (currentItem === 'OIL_SLICK') {
      spawnOilSlick(playerState.s, playerState.lateralOffset, 'player');
      if (audioSynth && audioSynth.playOilSpinout) {
        audioSynth.playOilSpinout();
      }
      setCombatFeed('🛢️ OIL HAZARD TRAP DEPLOYED!');
      return true;
    }

    if (currentItem === 'ROCKET') {
      const { target: nearestTarget } = findNearestRivalAhead(playerState, rivalsList, 1.25);
      fireRocket(
        playerState.s,
        playerState.lateralOffset,
        nearestTarget,
        'player',
        'YOU',
        audioSynth
      );
      if (nearestTarget) {
        setCombatFeed(`🚀 HOMING MISSILE LOCKED ON ${nearestTarget.name}!`);
      } else {
        setCombatFeed('🚀 FIREBALL MISSILE LAUNCHED!');
      }
      return true;
    }

    if (currentItem === 'EMP') {
      triggerEmp(playerState.position, 'player', audioSynth);
      const zappedNames = [];
      for (let i = 0; i < rivalsList.length; i++) {
        const r = rivalsList[i];
        const d3d = playerState.position.distanceTo(r.position);
        const dSpline = Math.abs(
          ((r.s - playerState.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        if (d3d < 0.16 || dSpline < 0.24) {
          spawnLightningBolt(playerState.position, r.position);
          triggerExplosion(r.position, null, 0x00f0ff);
          r.speed *= 0.22;
          r.spinoutTimer = 1.45;
          r.hopVel = 0.058;
          zappedNames.push(r.name);
        }
      }
      playerState.cameraShake = Math.max(playerState.cameraShake || 0, 0.30);
      if (zappedNames.length > 0) {
        setCombatFeed(`⚡ CHAIN LIGHTNING ZAPPED ${zappedNames.join(' & ')}!`);
      } else {
        setCombatFeed('⚡ EMP SHOCKWAVE DISCHARGED!');
      }
      return true;
    }

    return false;
  }

  /**
   * Main 60FPS update step for Mystery Pods, Roulette, Target Lock, Boost Pads, Jump Ramps, Rockets, Oil, Shields & EMPs
   */
  function update(dt, playerState, rivalsList, audioSynth, currentRank = 1) {
    const tSec = performance.now() * 0.001;
    if (playerPickupCooldown > 0) {
      playerPickupCooldown = Math.max(0.0, playerPickupCooldown - dt);
    }
    if (combatFeedTimer > 0) {
      combatFeedTimer = Math.max(0.0, combatFeedTimer - dt);
      if (combatFeedTimer <= 0) {
        combatFeedMessage = null;
      }
    }

    // 0. Update Beach Buggy Slot-Machine Powerup Roulette Roll
    if (rouletteTimer > 0) {
      const prevTickBucket = Math.floor(rouletteTimer * 14.0);
      rouletteTimer = Math.max(0.0, rouletteTimer - dt);
      const nextTickBucket = Math.floor(rouletteTimer * 14.0);

      if (prevTickBucket !== nextTickBucket) {
        rouletteCycleIdx = (rouletteCycleIdx + 1) % POWERUP_POOL.length;
        roulettePreview = POWERUP_POOL[rouletteCycleIdx];
        if (audioSynth && audioSynth.playRouletteTick) {
          const progress = 1.0 - rouletteTimer / 0.82;
          audioSynth.playRouletteTick(0.85 + progress * 0.55);
        }
      }

      if (rouletteTimer <= 0 && pendingPowerup) {
        playerHeldPowerup = pendingPowerup;
        pendingPowerup = null;
        roulettePreview = null;
        if (audioSynth && audioSynth.playRouletteLock) {
          audioSynth.playRouletteLock();
        }
      }
    }

    // 0A. Update 6 Neon Chevron Track Boost Pads
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

      if (pad.playerCooldown <= 0 && !playerState.countdownLocked && playerState.speed > 0.02) {
        const dS = Math.abs(
          ((playerState.s - pad.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dLat = Math.abs(playerState.lateralOffset - pad.latOffset);
        if (dS < 0.015 && dLat < 0.0048) {
          pad.playerCooldown = 1.5;
          playerState.boostActive = Math.max(playerState.boostActive || 0, 1.45);
          playerState.boostCharge = Math.min(1.0, (playerState.boostCharge || 0) + 0.35);
          playerState.speed = Math.max(
            playerState.speed,
            0.275 * (playerState.topSpeedMultiplier || 1.0)
          );
          if (audioSynth && audioSynth.playNitroBoost) {
            audioSynth.playNitroBoost();
          }
        }
      }

      for (let rIdx = 0; rIdx < rivalsList.length; rIdx++) {
        const rival = rivalsList[rIdx];
        const dS = Math.abs(
          ((rival.s - pad.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dLat = Math.abs(rival.lateralOffset - pad.latOffset);
        if (dS < 0.014 && dLat < 0.0045) {
          rival.boostTimer = 1.25;
          rival.speed = Math.max(rival.speed, rival.baseSpeed * 1.24);
        }
      }
    }

    // 0B. Update 3 Sculpted 3D Wedge Arcade Jump Ramps
    playerState.onRampSurface = false;
    playerState.rampSurfaceHeight = 0.0;

    for (let jIdx = 0; jIdx < jumpRamps.length; jIdx++) {
      const ramp = jumpRamps[jIdx];
      if (ramp.playerCooldown > 0) {
        ramp.playerCooldown = Math.max(0.0, ramp.playerCooldown - dt);
      }

      if (!playerState.countdownLocked) {
        const signedDS =
          ((playerState.s - ramp.s + totalLength * 0.5) % totalLength) - totalLength * 0.5;
        const dLat = Math.abs(playerState.lateralOffset - ramp.latOffset);

        if (signedDS >= -0.0105 && signedDS <= 0.0110 && dLat < 0.0068) {
          const u = THREE.MathUtils.clamp((signedDS + 0.0095) / 0.019, 0.0, 1.0);
          const wedgeH = 0.0003 + u * 0.0034;
          playerState.onRampSurface = true;
          playerState.rampSurfaceHeight = Math.max(playerState.rampSurfaceHeight || 0.0, wedgeH);
          playerState.hopHeight = Math.max(playerState.hopHeight || 0.0, wedgeH);
          playerState.rampPitch = -0.16 * u;

          if (u >= 0.55 && ramp.playerCooldown <= 0 && playerState.speed > 0.02) {
            ramp.playerCooldown = 1.15;
            playerState.hopVel = Math.max(
              playerState.hopVel || 0.0,
              Math.min(0.048, 0.034 + Math.abs(playerState.speed) * 0.045)
            );
            playerState.rampPitch = -0.16;
            playerState.boostActive = Math.max(playerState.boostActive || 0, 1.55);
            playerState.boostCharge = Math.min(1.0, (playerState.boostCharge || 0) + 0.35);
            playerState.speed = Math.max(
              playerState.speed,
              0.285 * (playerState.topSpeedMultiplier || 1.0)
            );
            if (audioSynth && audioSynth.playNitroBoost) {
              audioSynth.playNitroBoost();
            }
          }
        }
      }

      for (let rIdx = 0; rIdx < rivalsList.length; rIdx++) {
        const rival = rivalsList[rIdx];
        const signedRivalDS =
          ((rival.s - ramp.s + totalLength * 0.5) % totalLength) - totalLength * 0.5;
        const dLat = Math.abs(rival.lateralOffset - ramp.latOffset);
        if (signedRivalDS >= -0.0105 && signedRivalDS <= 0.0110 && dLat < 0.0060) {
          const u = THREE.MathUtils.clamp((signedRivalDS + 0.0095) / 0.019, 0.0, 1.0);
          const wedgeH = 0.0003 + u * 0.0036;
          rival.hopHeight = Math.max(rival.hopHeight || 0.0, wedgeH);
          if (u >= 0.35 && (rival.hopVel || 0) < 0.02) {
            rival.hopVel = 0.062;
            rival.boostTimer = 1.25;
          }
        }
      }
    }

    // 1. Update Floating 3D Mystery Energy Pods
    for (let bIdx = 0; bIdx < mysteryBoxes.length; bIdx++) {
      const box = mysteryBoxes[bIdx];
      if (!box.active) {
        box.respawnTimer -= dt;
        if (box.respawnTimer <= 0) {
          box.active = true;
          box.mesh.visible = true;
        }
        continue;
      }

      const bob = Math.sin(tSec * 4.5 + box.s * 12) * 0.00065;
      box.mesh.position.copy(box.basePos).addScaledVector(box.normal, bob);
      box.mesh.rotation.y += dt * 2.6;
      box.coreMesh.rotation.x += dt * 3.8;
      box.coreMesh.rotation.z += dt * 2.4;
      box.ringMesh.rotation.z -= dt * 4.2;

      const playerDistS = Math.abs(
        ((playerState.s - box.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
      );
      const playerDistLat = Math.abs(playerState.lateralOffset - box.latOffset);

      if (!playerHeldPowerup && !pendingPowerup && playerPickupCooldown <= 0) {
        if (playerDistS < 0.028 && playerDistLat < 0.0082) {
          playerState.lateralOffset = THREE.MathUtils.lerp(
            playerState.lateralOffset,
            box.latOffset,
            dt * 3.5
          );
          box.active = false;
          box.mesh.visible = false;
          box.respawnTimer = 4.8;

          // Start Beach Buggy Slot-Machine Roulette Roll!
          pendingPowerup = rollPowerup(currentRank);
          rouletteTimer = 0.78;
          rouletteCycleIdx = Math.floor(Math.random() * POWERUP_POOL.length);
          roulettePreview = POWERUP_POOL[rouletteCycleIdx];
          playerPickupCooldown = 1.15;

          // Spawn glowing pickup burst at pod position
          triggerExplosion(box.mesh.position, null, 0x00f0ff);
          if (audioSynth && audioSynth.playPowerupBoxPickup) {
            audioSynth.playPowerupBoxPickup();
          }
          continue;
        }
      }

      // Check AI Rivals Pickup
      for (let rIdx = 0; rIdx < rivalsList.length; rIdx++) {
        const rival = rivalsList[rIdx];
        const rivalDistS = Math.abs(
          ((rival.s - box.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const rivalDistLat = Math.abs(rival.lateralOffset - box.latOffset);
        if (rivalDistS < 0.015 && rivalDistLat < 0.0044) {
          box.active = false;
          box.mesh.visible = false;
          box.respawnTimer = 4.8;
          if (!rival.heldItem) {
            rival.heldItem = rollPowerup(rival.rank || 2);
            rival.itemCooldown = Math.max(rival.itemCooldown || 0, 2.4);
          }
          break;
        }
      }
    }

    // 1C. Update 3D Target Lock-On Crosshair Reticle when player holds ROCKET or EMP
    const activeOffensiveWeapon =
      playerHeldPowerup === 'ROCKET' ||
      playerHeldPowerup === 'EMP' ||
      (rouletteTimer > 0 && pendingPowerup === 'ROCKET');
    if (activeOffensiveWeapon) {
      const { target, distM } = findNearestRivalAhead(playerState, rivalsList, 1.15);
      if (target) {
        targetReticleGroup.visible = true;
        targetReticleGroup.position.copy(target.position);
        targetReticleGroup.rotation.y += dt * 5.5;
        const pulseScale = 0.92 + Math.sin(tSec * 14.0) * 0.14;
        reticleOuterRing.scale.setScalar(pulseScale);
        reticleDiamond.rotation.y -= dt * 8.0;
        lockedTargetInfo.name = target.name;
        lockedTargetInfo.distM = Math.round(distM * 100);
      } else {
        targetReticleGroup.visible = false;
        lockedTargetInfo.name = null;
        lockedTargetInfo.distM = null;
      }
    } else {
      targetReticleGroup.visible = false;
      lockedTargetInfo.name = null;
      lockedTargetInfo.distM = null;
    }

    // 2. Update Active Player Geodesic Bubble Shield
    if (playerShieldTimer > 0) {
      playerShieldTimer -= dt;
      playerShieldGroup.visible = true;
      playerShieldGroup.position
        .copy(playerState.position)
        .addScaledVector(playerState.normal, 0.0028);
      shieldInnerMesh.rotation.y += dt * 3.2;
      shieldWireMesh.rotation.y -= dt * 4.8;
      shieldWireMesh.rotation.x += dt * 2.4;
      shieldSphereMat.opacity = 0.30 + Math.sin(tSec * 14.0) * 0.08;
      if (playerShieldTimer <= 0) {
        playerShieldGroup.visible = false;
      }
    } else {
      playerShieldGroup.visible = false;
    }

    // 3. Synchronize Player Spinout Recovery State with Physics Controller
    if (playerSpinoutTimer > 0) {
      playerSpinoutTimer = Math.max(0.0, playerSpinoutTimer - dt);
      playerState.spinoutTimer = Math.max(playerState.spinoutTimer || 0.0, playerSpinoutTimer);
      if (playerSpinoutTimer <= 0) {
        playerSpinoutReason = null;
      }
    } else if ((playerState.spinoutTimer || 0) > 0) {
      playerSpinoutTimer = playerState.spinoutTimer;
    } else {
      playerSpinoutReason = null;
    }

    // 4. Update Active Homing Fireball Rockets & Incoming Threat Radar
    incomingThreatInfo.active = false;
    incomingThreatInfo.attackerName = null;
    incomingThreatInfo.urgency = 0.0;

    for (let i = activeRockets.length - 1; i >= 0; i--) {
      const rocket = activeRockets[i];
      rocket.lifeTimer -= dt;
      rocket.s = (rocket.s + rocket.speed * dt) % totalLength;

      // Home in laterally on target racer if locked
      if (rocket.targetRacer) {
        rocket.latOffset = THREE.MathUtils.lerp(
          rocket.latOffset,
          rocket.targetRacer.lateralOffset,
          Math.min(1.0, dt * 9.5)
        );
      }

      const frame = samplePoint(rocket.s);
      rocket.mesh.position
        .copy(frame.pos)
        .addScaledVector(frame.right, rocket.latOffset)
        .addScaledVector(frame.normal, 0.0035);
      rocket.mesh.quaternion.setFromUnitVectors(_upZ, frame.tangent);
      rocket.mesh.RotateZ ? rocket.mesh.rotateZ(dt * 18.0) : (rocket.mesh.rotation.z += dt * 18.0);

      // Emit 3D Fire & Smoke Trail Puff behind the missile
      rocket.trailAccum += dt;
      if (rocket.trailAccum >= 0.028) {
        rocket.trailAccum = 0.0;
        const puffMat = trailFireMat.clone();
        const puffMesh = new THREE.Mesh(trailPuffGeo, puffMat);
        puffMesh.position.copy(rocket.mesh.position);
        rootGroup.add(puffMesh);
        rocketTrailPuffs.push({
          mesh: puffMesh,
          timer: 0.24,
          maxTimer: 0.24,
        });
      }

      // Check if this rival rocket is homing in on the player
      if (rocket.ownerId !== 'player' && rocket.targetRacer && rocket.targetRacer.isPlayer) {
        const distToPlayer =
          ((playerState.s - rocket.s) % totalLength + totalLength) % totalLength;
        if (distToPlayer < 0.75) {
          incomingThreatInfo.active = true;
          incomingThreatInfo.attackerName = rocket.ownerName || 'RIVAL';
          const urg = THREE.MathUtils.clamp(1.0 - distToPlayer / 0.65, 0.15, 1.0);
          incomingThreatInfo.urgency = Math.max(incomingThreatInfo.urgency, urg);
          if (audioSynth && audioSynth.playIncomingWarningBeep) {
            audioSynth.playIncomingWarningBeep(incomingThreatInfo.urgency);
          }
        }
      }

      let hit = false;

      // Check collision against all rivals (unless fired by that rival)
      for (let rIdx = 0; rIdx < rivalsList.length; rIdx++) {
        const rival = rivalsList[rIdx];
        if (rocket.ownerId === rival.id) continue;
        const dSpline = Math.abs(
          ((rocket.s - rival.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dLat = Math.abs(rocket.latOffset - rival.lateralOffset);
        if (dSpline < 0.016 && dLat < 0.0062) {
          hit = true;
          triggerExplosion(rocket.mesh.position, audioSynth, 0xff5500);
          rival.spinoutTimer = 1.45;
          rival.speed *= 0.18;
          rival.hopVel = 0.064;
          rival.lateralVel = (Math.random() < 0.5 ? -1 : 1) * 0.042;
          if (rocket.ownerId === 'player') {
            setCombatFeed(`🎯 DIRECT HIT! ${rival.name} BLASTED!`);
            playerState.cameraShake = Math.max(playerState.cameraShake || 0, 0.18);
          }
          break;
        }
      }

      // If fired by an AI rival, check collision against player
      if (!hit && rocket.ownerId !== 'player') {
        const dSpline = Math.abs(
          ((rocket.s - playerState.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dLat = Math.abs(rocket.latOffset - playerState.lateralOffset);
        if (dSpline < 0.016 && dLat < 0.0062) {
          hit = true;
          if (playerShieldTimer > 0) {
            playerShieldTimer = 0.0;
            playerShieldGroup.visible = false;
            triggerExplosion(rocket.mesh.position, null, 0x00f0ff);
            if (audioSynth && audioSynth.playShieldDeflect) {
              audioSynth.playShieldDeflect();
            }
            playerState.cameraShake = Math.max(playerState.cameraShake || 0, 0.18);
            setCombatFeed(`🛡️ SHIELD BLOCKED ${rocket.ownerName}'S MISSILE!`);
          } else {
            triggerExplosion(rocket.mesh.position, audioSynth, 0xff3300);
            playerSpinoutTimer = 0.85;
            playerSpinoutReason = `🚀 BLASTED BY ${rocket.ownerName}'S MISSILE!`;
            playerState.spinoutTimer = 0.85;
            playerState.spinoutDir = Math.random() < 0.5 ? 1 : -1;
            playerState.speed *= 0.45;
            playerState.boostActive = 0.0;
            playerState.hopVel = 0.044;
            playerState.cameraShake = 0.32;
          }
        }
      }

      if (hit || rocket.lifeTimer <= 0) {
        rootGroup.remove(rocket.mesh);
        activeRockets.splice(i, 1);
      }
    }

    // 4B. Update Rocket Trail Puffs
    for (let i = rocketTrailPuffs.length - 1; i >= 0; i--) {
      const puff = rocketTrailPuffs[i];
      puff.timer -= dt;
      const u = Math.max(0, puff.timer / puff.maxTimer);
      puff.mesh.scale.setScalar(1.0 + (1.0 - u) * 2.2);
      puff.mesh.material.opacity = u * 0.75;
      if (puff.timer <= 0) {
        rootGroup.remove(puff.mesh);
        puff.mesh.material.dispose();
        rocketTrailPuffs.splice(i, 1);
      }
    }

    // 5. Update Active Oil Slick Traps
    for (let i = activeOilSlicks.length - 1; i >= 0; i--) {
      const oil = activeOilSlicks[i];
      oil.timer -= dt;
      if (oil.ownerGraceTimer > 0) {
        oil.ownerGraceTimer -= dt;
      }

      if (!(oil.ownerId === 'player' && oil.ownerGraceTimer > 0)) {
        const dPlayer = Math.abs(
          ((playerState.s - oil.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dPlayerLat = Math.abs(playerState.lateralOffset - oil.latOffset);
        if (dPlayer < 0.0090 && dPlayerLat < 0.0048) {
          if (playerShieldTimer > 0) {
            playerShieldTimer = 0.0;
            playerShieldGroup.visible = false;
            if (audioSynth && audioSynth.playShieldDeflect) {
              audioSynth.playShieldDeflect();
            }
            setCombatFeed('🛡️ SHIELD CLEARED OIL HAZARD!');
          } else if (playerSpinoutTimer <= 0) {
            playerSpinoutTimer = 0.72;
            playerSpinoutReason = '🛢️ SPUN OUT ON OIL TRAP!';
            playerState.spinoutTimer = 0.72;
            playerState.spinoutDir = Math.random() < 0.5 ? 1 : -1;
            playerState.speed *= 0.52;
            playerState.boostActive = 0.0;
            playerState.hopVel = 0.022;
            playerState.cameraShake = 0.20;
            if (audioSynth && audioSynth.playOilSpinout) {
              audioSynth.playOilSpinout();
            }
          }
          oil.timer = 0;
        }
      }

      for (let rIdx = 0; rIdx < rivalsList.length; rIdx++) {
        const rival = rivalsList[rIdx];
        if (oil.ownerId === rival.id && oil.ownerGraceTimer > 0) continue;
        const dRival = Math.abs(
          ((rival.s - oil.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dRivalLat = Math.abs(rival.lateralOffset - oil.latOffset);
        if (dRival < 0.010 && dRivalLat < 0.0052 && rival.spinoutTimer <= 0) {
          rival.spinoutTimer = 1.25;
          rival.speed *= 0.28;
          rival.hopVel = 0.036;
          if (oil.ownerId === 'player') {
            setCombatFeed(`🛢️ ${rival.name} SLIPPED ON YOUR OIL TRAP!`);
          }
          oil.timer = 0;
          break;
        }
      }

      if (oil.timer <= 0) {
        rootGroup.remove(oil.mesh);
        activeOilSlicks.splice(i, 1);
      }
    }

    // 6. Update EMP Shockwaves & 3D Chain Lightning Bolts
    for (let i = activeEmpWaves.length - 1; i >= 0; i--) {
      const emp = activeEmpWaves[i];
      emp.timer -= dt;
      emp.radius += dt * 0.095;
      emp.mesh.scale.setScalar(emp.radius / 0.0042);
      emp.mesh.material.opacity = Math.max(0, emp.timer / 0.58);

      if (emp.timer <= 0) {
        rootGroup.remove(emp.mesh);
        emp.mesh.material.dispose();
        activeEmpWaves.splice(i, 1);
      }
    }

    for (let i = activeLightningBolts.length - 1; i >= 0; i--) {
      const bolt = activeLightningBolts[i];
      bolt.timer -= dt;
      bolt.mesh.material.opacity = Math.max(0, bolt.timer / 0.38);
      if (bolt.timer <= 0) {
        rootGroup.remove(bolt.mesh);
        bolt.mesh.geometry.dispose();
        bolt.mesh.material.dispose();
        activeLightningBolts.splice(i, 1);
      }
    }

    // 7. Update Explosion Fireballs & Flying Debris Embers
    for (let i = explosionSparks.length - 1; i >= 0; i--) {
      const exp = explosionSparks[i];
      exp.timer -= dt;
      exp.scale += dt * 15.0;
      exp.mesh.scale.setScalar(exp.scale);
      exp.mesh.rotation.y += dt * 8.0;
      const alpha = Math.max(0, exp.timer / exp.maxTimer);
      exp.mesh.material.opacity = alpha;

      for (let d = 0; d < exp.debris.length; d++) {
        const deb = exp.debris[d];
        deb.mesh.position.addScaledVector(deb.vel, dt);
        deb.vel.y -= 0.12 * dt;
        deb.mesh.rotation.x += dt * 14.0;
        deb.mesh.rotation.z += dt * 11.0;
        deb.mesh.material.opacity = alpha;
      }

      if (exp.timer <= 0) {
        rootGroup.remove(exp.mesh);
        exp.mesh.material.dispose();
        for (let d = 0; d < exp.debris.length; d++) {
          rootGroup.remove(exp.debris[d].mesh);
          exp.debris[d].mesh.material.dispose();
        }
        explosionSparks.splice(i, 1);
      }
    }
  }

  function isIncomingAttack() {
    return incomingThreatInfo.active;
  }

  function reset() {
    playerHeldPowerup = null;
    pendingPowerup = null;
    rouletteTimer = 0.0;
    roulettePreview = null;
    playerPickupCooldown = 0.0;
    playerShieldTimer = 0.0;
    playerSpinoutTimer = 0.0;
    playerSpinoutReason = null;
    combatFeedMessage = null;
    combatFeedTimer = 0.0;
    lockedTargetInfo.name = null;
    lockedTargetInfo.distM = null;
    incomingThreatInfo.active = false;
    incomingThreatInfo.attackerName = null;
    incomingThreatInfo.urgency = 0.0;
    playerShieldGroup.visible = false;
    targetReticleGroup.visible = false;

    for (let i = 0; i < boostPads.length; i++) {
      boostPads[i].playerCooldown = 0.0;
    }
    for (let i = 0; i < jumpRamps.length; i++) {
      jumpRamps[i].playerCooldown = 0.0;
    }

    for (let i = 0; i < activeRockets.length; i++) {
      rootGroup.remove(activeRockets[i].mesh);
    }
    activeRockets.length = 0;

    for (let i = 0; i < rocketTrailPuffs.length; i++) {
      rootGroup.remove(rocketTrailPuffs[i].mesh);
      rocketTrailPuffs[i].mesh.material.dispose();
    }
    rocketTrailPuffs.length = 0;

    for (let i = 0; i < activeOilSlicks.length; i++) {
      rootGroup.remove(activeOilSlicks[i].mesh);
    }
    activeOilSlicks.length = 0;

    for (let i = 0; i < activeEmpWaves.length; i++) {
      rootGroup.remove(activeEmpWaves[i].mesh);
      activeEmpWaves[i].mesh.material.dispose();
    }
    activeEmpWaves.length = 0;

    for (let i = 0; i < activeLightningBolts.length; i++) {
      rootGroup.remove(activeLightningBolts[i].mesh);
      activeLightningBolts[i].mesh.geometry.dispose();
      activeLightningBolts[i].mesh.material.dispose();
    }
    activeLightningBolts.length = 0;

    for (let i = 0; i < explosionSparks.length; i++) {
      rootGroup.remove(explosionSparks[i].mesh);
      explosionSparks[i].mesh.material.dispose();
      for (let d = 0; d < explosionSparks[i].debris.length; d++) {
        rootGroup.remove(explosionSparks[i].debris[d].mesh);
        explosionSparks[i].debris[d].mesh.material.dispose();
      }
    }
    explosionSparks.length = 0;

    for (let i = 0; i < mysteryBoxes.length; i++) {
      mysteryBoxes[i].active = true;
      mysteryBoxes[i].respawnTimer = 0.0;
      mysteryBoxes[i].mesh.visible = true;
    }
  }

  return {
    rootGroup,
    update,
    triggerPlayerPowerup,
    triggerRivalPowerup,
    getHeldPowerup: () => playerHeldPowerup,
    isRouletteActive: () => rouletteTimer > 0,
    getRoulettePreview: () => roulettePreview,
    getLockedTargetInfo: () => lockedTargetInfo,
    getIncomingThreatInfo: () => incomingThreatInfo,
    getCombatFeedMessage: () => combatFeedMessage,
    isShieldActive: () => playerShieldTimer > 0,
    isSpinoutActive: () => playerSpinoutTimer > 0,
    getSpinoutReason: () => playerSpinoutReason,
    isIncomingAttack,
    reset,
  };
}
