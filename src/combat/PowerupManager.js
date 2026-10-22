import * as THREE from 'three';

/**
 * Beach Buggy & Mario Kart-style 3D Mystery Box Powerup & Combat Weapon System
 * Manages floating pickup cubes, homing rockets, shields, oil slicks, and EMP shockwaves.
 * Optimized for 0 per-frame GC allocations and shared geometry reuse.
 */
export function createPowerupManager(splineData, scene) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'CombatPowerupRoot';
  scene.add(rootGroup);

  const samples = splineData.samples;
  const N = samples.length;
  const totalLength = splineData.total_length_m || 3.8371;

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
  // 1. FLOATING 3D MYSTERY ITEM BOXES (4 TRACK LOCATIONS x 2 LANES)
  // -------------------------------------------------------------------------
  const boxSectorsS = [
    totalLength * 0.12, // After start/finish straight
    totalLength * 0.38, // Before Cat Helix
    totalLength * 0.62, // Valley after Lamp Corkscrew
    totalLength * 0.86, // Razer Mousepad entry
  ];

  const boxGeo = new THREE.BoxGeometry(0.0052, 0.0052, 0.0052);
  const boxMat = new THREE.MeshStandardMaterial({
    color: 0xffaa00,
    emissive: new THREE.Color(0xff7700),
    emissiveIntensity: 0.95,
    roughness: 0.18,
    metalness: 0.25,
    transparent: true,
    opacity: 0.9,
  });

  // Inner spinning diamond core
  const coreGeo = new THREE.OctahedronGeometry(0.0024);
  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    wireframe: true,
  });

  const mysteryBoxes = [];

  boxSectorsS.forEach((baseS, secIdx) => {
    [-0.0040, 0.0040].forEach((latOffset, sideIdx) => {
      const frame = samplePoint(baseS);
      const boxMesh = new THREE.Mesh(boxGeo, boxMat);
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      boxMesh.add(coreMesh);

      const worldPos = frame.pos
        .clone()
        .addScaledVector(frame.right, latOffset)
        .addScaledVector(frame.normal, 0.0044);

      boxMesh.position.copy(worldPos);
      rootGroup.add(boxMesh);

      mysteryBoxes.push({
        id: `box_${secIdx}_${sideIdx}`,
        s: baseS,
        latOffset,
        mesh: boxMesh,
        coreMesh,
        basePos: worldPos,
        normal: frame.normal.clone(),
        active: true,
        respawnTimer: 0.0,
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. SHARED GEOMETRIES & MATERIALS FOR PROJECTILES & HAZARDS
  // -------------------------------------------------------------------------
  // Active Homing Rockets
  const activeRockets = [];
  const rocketGeo = new THREE.CylinderGeometry(0.001, 0.0015, 0.0056, 10);
  rocketGeo.rotateX(Math.PI / 2);
  const rocketMat = new THREE.MeshStandardMaterial({
    color: 0xff1e26,
    emissive: new THREE.Color(0xff5500),
    emissiveIntensity: 1.1,
    roughness: 0.2,
    metalness: 0.7,
  });

  // Active Oil Slicks on Track
  const activeOilSlicks = [];
  const oilGeo = new THREE.CircleGeometry(0.0058, 16);
  oilGeo.rotateX(-Math.PI / 2);
  const oilMat = new THREE.MeshStandardMaterial({
    color: 0x060810,
    emissive: new THREE.Color(0x1a1025),
    emissiveIntensity: 0.35,
    roughness: 0.08,
    metalness: 0.92,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  // Active EMP Shockwaves
  const activeEmpWaves = [];
  const empGeo = new THREE.RingGeometry(0.0022, 0.0038, 24);
  empGeo.rotateX(-Math.PI / 2);

  // Explosion Shockwave Sphere
  const explosionSparks = [];
  const shockwaveGeo = new THREE.SphereGeometry(0.0024, 12, 10);

  // Player Shield Mesh (Cyan energy bubble sized for 0.56x kart scale)
  const shieldGeo = new THREE.SphereGeometry(0.0075, 16, 12);
  const shieldMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: new THREE.Color(0x00c8e0),
    emissiveIntensity: 0.7,
    roughness: 0.15,
    metalness: 0.2,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const playerShieldMesh = new THREE.Mesh(shieldGeo, shieldMat);
  playerShieldMesh.visible = false;
  rootGroup.add(playerShieldMesh);

  // Player Powerup State (Strictly single-use consumable: 1 pickup = 1 fire)
  let playerHeldPowerup = null;
  let playerPickupCooldown = 0.0;
  let playerShieldTimer = 0.0;
  let playerSpinoutTimer = 0.0;

  /**
   * Rolls a weighted mystery box powerup based on rank (1st = defense/oil, 4th = rockets/nitro)
   */
  function rollPowerup(rank = 1) {
    const roll = Math.random();
    if (rank >= 4) {
      if (roll < 0.45) return 'ROCKET';
      if (roll < 0.78) return 'HYPER_NITRO';
      if (roll < 0.92) return 'EMP';
      return 'SHIELD';
    } else if (rank >= 2) {
      if (roll < 0.38) return 'ROCKET';
      if (roll < 0.62) return 'HYPER_NITRO';
      if (roll < 0.82) return 'SHIELD';
      return 'EMP';
    } else {
      if (roll < 0.42) return 'SHIELD';
      if (roll < 0.78) return 'OIL_SLICK';
      return 'HYPER_NITRO';
    }
  }

  /**
   * Spawns an explosion blast at a 3D location
   */
  function triggerExplosion(pos, audioSynth) {
    if (audioSynth && audioSynth.playExplosion) {
      audioSynth.playExplosion();
    }
    const shockwaveMat = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.95,
      wireframe: true,
    });
    const shockMesh = new THREE.Mesh(shockwaveGeo, shockwaveMat);
    shockMesh.position.copy(pos);
    rootGroup.add(shockMesh);

    explosionSparks.push({
      mesh: shockMesh,
      scale: 1.0,
      timer: 0.35,
    });
  }

  /**
   * Drops an oil slick behind the given track position so the dropper never hits it
   */
  function spawnOilSlick(sVal, latOffset, ownerId) {
    const behindS = ((sVal - 0.018) % totalLength + totalLength) % totalLength;
    const frame = samplePoint(behindS);
    const oilMesh = new THREE.Mesh(oilGeo, oilMat);
    oilMesh.position
      .copy(frame.pos)
      .addScaledVector(frame.right, latOffset)
      .addScaledVector(frame.normal, 0.0005);
    oilMesh.quaternion.setFromUnitVectors(_upZ, frame.tangent);
    rootGroup.add(oilMesh);

    activeOilSlicks.push({
      s: behindS,
      latOffset,
      ownerId,
      ownerGraceTimer: 3.0,
      mesh: oilMesh,
      timer: 18.0,
    });
  }

  /**
   * Fires a homing rocket along the spline toward the next target ahead
   */
  function fireRocket(startS, startLat, targetRacer, ownerId, audioSynth) {
    if (audioSynth && audioSynth.playRocketLaunch) {
      audioSynth.playRocketLaunch();
    }
    const spawnS = (startS + 0.015) % totalLength;
    const frame = samplePoint(spawnS);
    const rocketMesh = new THREE.Mesh(rocketGeo, rocketMat);
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
      mesh: rocketMesh,
      targetRacer,
      speed: 0.46,
      lifeTimer: 4.5,
    });
  }

  /**
   * Triggers an expanding EMP shockwave
   */
  function triggerEmp(startPos, sourceId, audioSynth) {
    if (audioSynth && audioSynth.playEmpBlast) {
      audioSynth.playEmpBlast();
    }
    const empMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const empMesh = new THREE.Mesh(empGeo, empMat);
    empMesh.position.copy(startPos);
    rootGroup.add(empMesh);

    activeEmpWaves.push({
      mesh: empMesh,
      sourceId,
      radius: 0.004,
      timer: 0.55,
    });
  }

  /**
   * Player triggers held powerup (Strictly single-use: empties slot immediately upon firing)
   */
  function triggerPlayerPowerup(playerState, rivalsList, audioSynth) {
    if (!playerHeldPowerup || playerSpinoutTimer > 0) return false;

    const currentItem = playerHeldPowerup;
    playerHeldPowerup = null;
    playerPickupCooldown = Math.max(playerPickupCooldown, 0.65);

    if (currentItem === 'SHIELD') {
      playerShieldTimer = 7.0;
      playerShieldMesh.visible = true;
      if (audioSynth && audioSynth.playShieldActivate) {
        audioSynth.playShieldActivate();
      }
      return true;
    }

    if (currentItem === 'HYPER_NITRO') {
      playerState.boostActive = Math.max(playerState.boostActive || 0, 2.1);
      playerState.boostCharge = 1.0;
      playerState.speed = Math.max(
        playerState.speed,
        0.295 * (playerState.topSpeedMultiplier || 1.0)
      );
      if (audioSynth && audioSynth.playNitroBoost) {
        audioSynth.playNitroBoost();
      }
      return true;
    }

    if (currentItem === 'OIL_SLICK') {
      spawnOilSlick(playerState.s, playerState.lateralOffset, 'player');
      if (audioSynth && audioSynth.playOilSpinout) {
        audioSynth.playOilSpinout();
      }
      return true;
    }

    if (currentItem === 'ROCKET') {
      let nearestTarget = null;
      let minAheadDist = Infinity;
      for (let i = 0; i < rivalsList.length; i++) {
        const r = rivalsList[i];
        const aheadDist = ((r.s - playerState.s) % totalLength + totalLength) % totalLength;
        if (aheadDist > 0.008 && aheadDist < minAheadDist) {
          minAheadDist = aheadDist;
          nearestTarget = r;
        }
      }
      fireRocket(
        playerState.s,
        playerState.lateralOffset,
        nearestTarget,
        'player',
        audioSynth
      );
      return true;
    }

    if (currentItem === 'EMP') {
      triggerEmp(playerState.position, 'player', audioSynth);
      for (let i = 0; i < rivalsList.length; i++) {
        const r = rivalsList[i];
        const d3d = playerState.position.distanceTo(r.position);
        const dSpline = Math.abs(
          ((r.s - playerState.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        if (d3d < 0.12 || dSpline < 0.18) {
          r.speed *= 0.32;
          r.spinoutTimer = 1.1;
          r.hopVel = 0.025;
        }
      }
      return true;
    }

    return false;
  }

  /**
   * Main 60FPS update step for Mystery Boxes, Rockets, Oil, Shields & EMPs
   */
  function update(dt, playerState, rivalsList, audioSynth, currentRank = 1) {
    const tSec = performance.now() * 0.001;
    if (playerPickupCooldown > 0) {
      playerPickupCooldown = Math.max(0.0, playerPickupCooldown - dt);
    }

    // 1. Update Mystery Item Boxes
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

      const bob = Math.sin(tSec * 4.2 + box.s * 10) * 0.0006;
      box.mesh.position.copy(box.basePos).addScaledVector(box.normal, bob);
      box.mesh.rotation.y += dt * 2.4;
      box.coreMesh.rotation.x += dt * 3.2;
      box.coreMesh.rotation.z += dt * 2.1;

      // Check Player Pickup (Generous magnetic hitbox when slot is empty)
      const playerDistS = Math.abs(
        ((playerState.s - box.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
      );
      const playerDistLat = Math.abs(playerState.lateralOffset - box.latOffset);

      if (!playerHeldPowerup && playerPickupCooldown <= 0) {
        if (playerDistS < 0.028 && playerDistLat < 0.008) {
          playerState.lateralOffset = THREE.MathUtils.lerp(
            playerState.lateralOffset,
            box.latOffset,
            dt * 3.5
          );
          box.active = false;
          box.mesh.visible = false;
          box.respawnTimer = 5.0;
          playerHeldPowerup = rollPowerup(currentRank);
          playerPickupCooldown = 1.25; // Prevents double-pickup from adjacent box in the same row
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
        if (rivalDistS < 0.015 && rivalDistLat < 0.0042) {
          box.active = false;
          box.mesh.visible = false;
          box.respawnTimer = 5.0;
          if (!rival.heldItem) {
            rival.heldItem = rollPowerup(rival.rank || 2);
          }
          break;
        }
      }
    }

    // 2. Update Active Player Shield
    if (playerShieldTimer > 0) {
      playerShieldTimer -= dt;
      playerShieldMesh.visible = true;
      playerShieldMesh.position
        .copy(playerState.position)
        .addScaledVector(playerState.normal, 0.0028);
      playerShieldMesh.rotation.y += dt * 4.0;
      shieldMat.opacity = 0.34 + Math.sin(tSec * 16.0) * 0.1;
      if (playerShieldTimer <= 0) {
        playerShieldMesh.visible = false;
      }
    } else {
      playerShieldMesh.visible = false;
    }

    // 3. Update Player Spinout Recovery
    if (playerSpinoutTimer > 0) {
      playerSpinoutTimer -= dt;
      playerState.headingYaw += dt * 13.0;
      playerState.speed = Math.max(0.02, playerState.speed * 0.95);
    }

    // 4. Update Active Homing Rockets
    for (let i = activeRockets.length - 1; i >= 0; i--) {
      const rocket = activeRockets[i];
      rocket.lifeTimer -= dt;
      rocket.s = (rocket.s + rocket.speed * dt) % totalLength;

      // Home in laterally on target racer if locked
      if (rocket.targetRacer) {
        rocket.latOffset = THREE.MathUtils.lerp(
          rocket.latOffset,
          rocket.targetRacer.lateralOffset,
          Math.min(1.0, dt * 8.5)
        );
      }

      const frame = samplePoint(rocket.s);
      rocket.mesh.position
        .copy(frame.pos)
        .addScaledVector(frame.right, rocket.latOffset)
        .addScaledVector(frame.normal, 0.0035);
      rocket.mesh.quaternion.setFromUnitVectors(_upZ, frame.tangent);

      let hit = false;

      // Check collision against all rivals (unless fired by that rival)
      for (let rIdx = 0; rIdx < rivalsList.length; rIdx++) {
        const rival = rivalsList[rIdx];
        if (rocket.ownerId === rival.id) continue;
        const dSpline = Math.abs(
          ((rocket.s - rival.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dLat = Math.abs(rocket.latOffset - rival.lateralOffset);
        if (dSpline < 0.015 && dLat < 0.0055) {
          hit = true;
          triggerExplosion(rocket.mesh.position, audioSynth);
          rival.spinoutTimer = 1.25;
          rival.speed *= 0.25;
          rival.hopVel = 0.032;
          break;
        }
      }

      // If fired by an AI rival, check collision against player
      if (!hit && rocket.ownerId !== 'player') {
        const dSpline = Math.abs(
          ((rocket.s - playerState.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dLat = Math.abs(rocket.latOffset - playerState.lateralOffset);
        if (dSpline < 0.015 && dLat < 0.0055) {
          hit = true;
          triggerExplosion(rocket.mesh.position, audioSynth);
          if (playerShieldTimer > 0) {
            playerShieldTimer = 0.0;
            playerShieldMesh.visible = false;
          } else {
            playerSpinoutTimer = 1.1;
            playerState.speed *= 0.3;
            playerState.hopVel = 0.03;
          }
        }
      }

      if (hit || rocket.lifeTimer <= 0) {
        rootGroup.remove(rocket.mesh);
        activeRockets.splice(i, 1);
      }
    }

    // 5. Update Active Oil Slicks
    for (let i = activeOilSlicks.length - 1; i >= 0; i--) {
      const oil = activeOilSlicks[i];
      oil.timer -= dt;
      if (oil.ownerGraceTimer > 0) {
        oil.ownerGraceTimer -= dt;
      }

      // Player contact (skip if player just dropped it)
      if (!(oil.ownerId === 'player' && oil.ownerGraceTimer > 0)) {
        const dPlayer = Math.abs(
          ((playerState.s - oil.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dPlayerLat = Math.abs(playerState.lateralOffset - oil.latOffset);
        if (dPlayer < 0.009 && dPlayerLat < 0.0046) {
          if (playerShieldTimer > 0) {
            playerShieldTimer = 0.0;
            playerShieldMesh.visible = false;
          } else if (playerSpinoutTimer <= 0) {
            playerSpinoutTimer = 0.95;
            playerState.speed *= 0.45;
            if (audioSynth && audioSynth.playOilSpinout) {
              audioSynth.playOilSpinout();
            }
          }
          oil.timer = 0; // Consume oil slick on hit
        }
      }

      // Rival contact
      for (let rIdx = 0; rIdx < rivalsList.length; rIdx++) {
        const rival = rivalsList[rIdx];
        if (oil.ownerId === rival.id && oil.ownerGraceTimer > 0) continue;
        const dRival = Math.abs(
          ((rival.s - oil.s + totalLength * 0.5) % totalLength) - totalLength * 0.5
        );
        const dRivalLat = Math.abs(rival.lateralOffset - oil.latOffset);
        if (dRival < 0.009 && dRivalLat < 0.0046 && rival.spinoutTimer <= 0) {
          rival.spinoutTimer = 1.05;
          rival.speed *= 0.4;
          oil.timer = 0;
          break;
        }
      }

      if (oil.timer <= 0) {
        rootGroup.remove(oil.mesh);
        activeOilSlicks.splice(i, 1);
      }
    }

    // 6. Update EMP Shockwaves
    for (let i = activeEmpWaves.length - 1; i >= 0; i--) {
      const emp = activeEmpWaves[i];
      emp.timer -= dt;
      emp.radius += dt * 0.085;
      emp.mesh.scale.setScalar(emp.radius / 0.0038);
      emp.mesh.material.opacity = Math.max(0, emp.timer / 0.55);

      if (emp.timer <= 0) {
        rootGroup.remove(emp.mesh);
        emp.mesh.material.dispose();
        activeEmpWaves.splice(i, 1);
      }
    }

    // 7. Update Explosion Shockwave Dispersal
    for (let i = explosionSparks.length - 1; i >= 0; i--) {
      const exp = explosionSparks[i];
      exp.timer -= dt;
      exp.scale += dt * 14.0;
      exp.mesh.scale.setScalar(exp.scale);
      exp.mesh.material.opacity = Math.max(0, exp.timer / 0.35);

      if (exp.timer <= 0) {
        rootGroup.remove(exp.mesh);
        exp.mesh.material.dispose();
        explosionSparks.splice(i, 1);
      }
    }
  }

  function reset() {
    playerHeldPowerup = null;
    playerPickupCooldown = 0.0;
    playerShieldTimer = 0.0;
    playerSpinoutTimer = 0.0;
    playerShieldMesh.visible = false;

    for (let i = 0; i < activeRockets.length; i++) {
      rootGroup.remove(activeRockets[i].mesh);
    }
    activeRockets.length = 0;

    for (let i = 0; i < activeOilSlicks.length; i++) {
      rootGroup.remove(activeOilSlicks[i].mesh);
    }
    activeOilSlicks.length = 0;

    for (let i = 0; i < activeEmpWaves.length; i++) {
      rootGroup.remove(activeEmpWaves[i].mesh);
      activeEmpWaves[i].mesh.material.dispose();
    }
    activeEmpWaves.length = 0;

    for (let i = 0; i < explosionSparks.length; i++) {
      rootGroup.remove(explosionSparks[i].mesh);
      explosionSparks[i].mesh.material.dispose();
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
    getHeldPowerup: () => playerHeldPowerup,
    isShieldActive: () => playerShieldTimer > 0,
    isSpinoutActive: () => playerSpinoutTimer > 0,
    reset,
  };
}
