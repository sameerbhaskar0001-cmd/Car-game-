import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const S64_BASE_PATH = '/models/S64Compact_v1_C';

const BODY_FILES = {
  kit1: `${S64_BASE_PATH}/Body/S64Compact_Body_1.fbx`,
  kit2: `${S64_BASE_PATH}/Body/S64Compact_Body_2.fbx`,
  kit3: `${S64_BASE_PATH}/Body/S64Compact_Body_3.fbx`,
};

const RIM_FILES = {
  rim0: {
    L: `${S64_BASE_PATH}/Rims/Rims_L.fbx`,
    R: `${S64_BASE_PATH}/Rims/Rims_R.fbx`,
  },
  rim1: {
    L: `${S64_BASE_PATH}/Rims/Rims_1_L.fbx`,
    R: `${S64_BASE_PATH}/Rims/Rims_1_R.fbx`,
  },
  rim2: {
    L: `${S64_BASE_PATH}/Rims/Rims_2_L.fbx`,
    R: `${S64_BASE_PATH}/Rims/Rims_2_R.fbx`,
  },
  rim3: {
    L: `${S64_BASE_PATH}/Rims/Rims_3_L.fbx`,
    R: `${S64_BASE_PATH}/Rims/Rims_3_R.fbx`,
  },
};

const SPOILER_FILES = {
  spoiler1: `${S64_BASE_PATH}/Spoiler/S64_Compact_Spoiler.fbx`,
  spoiler2: `${S64_BASE_PATH}/Spoiler/S64_Compact_Spoiler_2.fbx`,
};

// S64 Compact native FBX wheel well coordinates:
// Nose is +X (+176), Tail is -X (-158), Roof is +Y (+104), Left is -Z (-58), Right is +Z (+58)
const WHEEL_SLOTS = [
  { name: 'FL', x: 104.2, y: 24.0, z: -58.0, side: 'L', isFront: true },
  { name: 'FR', x: 104.2, y: 24.0, z: 58.0, side: 'R', isFront: true },
  { name: 'RL', x: -99.5, y: 24.0, z: -58.0, side: 'L', isFront: false },
  { name: 'RR', x: -99.5, y: 24.0, z: 58.0, side: 'R', isFront: false },
];

function attachReadabilityRimShader(mat, _cacheKey, _minFloorStrength, _topFillStrength, _rimStrength) {
  // Keep PBR material lighting natural without artificial emissive self-illumination
  // Emissive is strictly reserved for Headlights and Taillights!
}

function upgradeBodyMaterials(fbxObj, kitId) {
  fbxObj.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.geometry && !child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }

    const oldMats = Array.isArray(child.material) ? child.material : [child.material];
    const newMats = oldMats.map((oldMat, matIdx) => {
      const mName = (oldMat?.name || '').toLowerCase();

      if (mName.includes('headlight') || mName.includes('front_light')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_Headlights',
          color: 0xffffff,
          emissive: new THREE.Color(0xfff8e0),
          emissiveIntensity: 3.2,
          roughness: 0.05,
          metalness: 0.1,
          toneMapped: false,
        });
      }

      if (mName.includes('rear_light') || mName.includes('taillight') || mName.includes('brake')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_RearLights',
          color: 0xff0018,
          emissive: new THREE.Color(0xff0518),
          emissiveIntensity: 2.5,
          roughness: 0.08,
          metalness: 0.15,
          toneMapped: false,
        });
      }

      if (mName.includes('glass') || mName.includes('window') || mName.includes('windshield')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_Glass',
          color: 0x08101e,
          roughness: 0.05,
          metalness: 0.92,
          envMapIntensity: 2.2,
        });
      }

      if (mName.includes('exhaust') || mName.includes('muffler') || mName.includes('chrome')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_Exhaust',
          color: 0xe2e8f0,
          roughness: 0.12,
          metalness: 0.96,
          envMapIntensity: 2.5,
        });
      }

      if (mName.includes('det2') || mName.includes('accent') || mName.includes('stripe')) {
        const accentHex =
          kitId === 'kit2' ? 0x081220 : kitId === 'kit3' ? 0xffb800 : 0xffffff;
        return new THREE.MeshStandardMaterial({
          name: 'S64_Det2',
          color: accentHex,
          roughness: 0.16,
          metalness: kitId === 'kit3' ? 0.90 : 0.65,
          envMapIntensity: 2.0,
        });
      }

      if (mName.includes('det1') || mName.includes('under') || mName.includes('trim') || mName.includes('black')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_Trim',
          color: kitId === 'kit3' ? 0x1f232d : 0x12151c,
          roughness: 0.32,
          metalness: 0.55,
          envMapIntensity: 1.4,
        });
      }

      // Primary metallic paint coat per body kit
      const paintHex =
        kitId === 'kit2' ? 0x00d4ff : kitId === 'kit3' ? 0xffaa00 : 0xee1520;
      return new THREE.MeshStandardMaterial({
        name: `S64_CarPaint_${kitId}_${matIdx}`,
        color: paintHex,
        roughness: kitId === 'kit3' ? 0.14 : kitId === 'kit2' ? 0.10 : 0.12,
        metalness: kitId === 'kit2' ? 0.88 : kitId === 'kit3' ? 0.90 : 0.82,
        envMapIntensity: 2.5,
      });
    });

    child.material = Array.isArray(child.material) ? newMats : newMats[0];
  });
}

function upgradeRimMaterials(fbxObj, rimId, kitId) {
  fbxObj.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.geometry && !child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }

    const oldMats = Array.isArray(child.material) ? child.material : [child.material];
    const newMats = oldMats.map((oldMat) => {
      const mName = (oldMat?.name || '').toLowerCase();

      if (mName.includes('tire')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_TireRubber',
          color: 0x11141a,
          roughness: 0.82,
          metalness: 0.05,
          envMapIntensity: 0.8,
        });
      }

      if (mName.includes('disc')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_BrakeDisc',
          color: 0x586274,
          roughness: 0.28,
          metalness: 0.88,
        });
      }

      // Alloy rim spokes & lip
      let rimColor = 0xe2eaf5;
      if (rimId === 'rim1') {
        rimColor = kitId === 'kit2' ? 0x00d4ff : 0x222834;
      } else if (rimId === 'rim2') {
        rimColor = 0xffb800; // Deep dish gold
      } else if (rimId === 'rim3') {
        rimColor = kitId === 'kit2' ? 0x38bdf8 : 0xf8fafc;
      }

      return new THREE.MeshStandardMaterial({
        name: 'S64_RimAlloy',
        color: rimColor,
        roughness: 0.08,
        metalness: 0.94,
        envMapIntensity: 2.8,
      });
    });

    child.material = Array.isArray(child.material) ? newMats : newMats[0];
  });
}

function upgradeSpoilerMaterials(fbxObj, spoilerId, kitId) {
  fbxObj.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    if (child.geometry && !child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }

    const wingColor =
      kitId === 'kit2'
        ? 0x00d4ff
        : kitId === 'kit3'
          ? 0xffaa00
          : spoilerId === 'spoiler2'
            ? 0x151922
            : 0xee1520;

    child.material = new THREE.MeshStandardMaterial({
      name: 'S64_SpoilerWing',
      color: wingColor,
      roughness: 0.12,
      metalness: 0.80,
      envMapIntensity: 2.2,
    });
  });
}

/**
 * Loads all 13 FBX files from S64Compact_v1_C (3 Bodies, 4 Left/Right Rim sets, 2 Spoilers)
 * and builds a complete modular 3D vehicle assembly that swaps body kits, wheels, and spoilers in real time.
 */
export async function loadS64ModularCar() {
  const loader = new FBXLoader();
  const loadFbx = (url) =>
    new Promise((resolve, reject) => {
      loader.load(url, resolve, undefined, reject);
    });

  const [
    body1,
    body2,
    body3,
    rim0L,
    rim0R,
    rim1L,
    rim1R,
    rim2L,
    rim2R,
    rim3L,
    rim3R,
    spoiler1,
    spoiler2,
  ] = await Promise.all([
    loadFbx(BODY_FILES.kit1),
    loadFbx(BODY_FILES.kit2),
    loadFbx(BODY_FILES.kit3),
    loadFbx(RIM_FILES.rim0.L),
    loadFbx(RIM_FILES.rim0.R),
    loadFbx(RIM_FILES.rim1.L),
    loadFbx(RIM_FILES.rim1.R),
    loadFbx(RIM_FILES.rim2.L),
    loadFbx(RIM_FILES.rim2.R),
    loadFbx(RIM_FILES.rim3.L),
    loadFbx(RIM_FILES.rim3.R),
    loadFbx(SPOILER_FILES.spoiler1),
    loadFbx(SPOILER_FILES.spoiler2),
  ]);

  // Root group in kart chassis coordinates (+Z forward, +Y up, -X right)
  const carAssemblyRoot = new THREE.Group();
  carAssemblyRoot.name = 'S64CompactModularAssembly';

  // Inner group in native S64 FBX coordinates (+X forward, +Y up, +Z right)
  // Scale 0.0000565 maps 328.4 FBX length units -> 0.01855m (18.55mm), matching the 1:87 track & showroom!
  const fbxSpaceGroup = new THREE.Group();
  fbxSpaceGroup.name = 'S64FbxSpaceRoot';
  const s64Scale = 0.0000565;
  fbxSpaceGroup.scale.setScalar(s64Scale);
  // Rotate -90 deg around Y so native +X (Headlights) points along +Z (Kart Forward)
  fbxSpaceGroup.rotation.y = -Math.PI / 2;
  // Center longitudinally so front/rear overhang is balanced on the turntable and spline
  fbxSpaceGroup.position.set(0, 0.0001, -0.00035);
  carAssemblyRoot.add(fbxSpaceGroup);

  // 1. Prepare 3 Body Meshes
  const bodies = {
    kit1: body1,
    kit2: body2,
    kit3: body3,
  };
  for (const [kId, bObj] of Object.entries(bodies)) {
    upgradeBodyMaterials(bObj, kId);
    bObj.visible = kId === 'kit1';
    fbxSpaceGroup.add(bObj);
  }

  // 2. Prepare 2 Spoilers mounted on the rear trunk decklid (X = -134, Y = 75.5, Z = 0 in native FBX space)
  const spoilers = {
    spoiler1,
    spoiler2,
  };
  spoiler1.position.set(-134.0, 74.5, 0.0);
  spoiler2.position.set(-136.0, 75.0, 0.0);
  for (const [sId, sObj] of Object.entries(spoilers)) {
    upgradeSpoilerMaterials(sObj, sId, 'kit1');
    sObj.visible = false;
    fbxSpaceGroup.add(sObj);
  }

  // 3. Prepare 4 Wheel Slots (FL, FR, RL, RR), each holding all 4 Rim Variants (rim0..rim3)
  const rawRims = {
    rim0: { L: rim0L, R: rim0R },
    rim1: { L: rim1L, R: rim1R },
    rim2: { L: rim2L, R: rim2R },
    rim3: { L: rim3L, R: rim3R },
  };

  const frontSteerPivots = [];
  const wheelSpinGroups = [];
  const slotRimMeshes = {
    rim0: [],
    rim1: [],
    rim2: [],
    rim3: [],
  };

  const playerLipMat = new THREE.MeshBasicMaterial({
    color: 0xff1e26,
    toneMapped: false,
  });
  const playerLipGeo = new THREE.TorusGeometry(21.5, 1.35, 8, 24);
  playerLipGeo.rotateY(Math.PI / 2);

  for (const slot of WHEEL_SLOTS) {
    const steerPivot = new THREE.Group();
    steerPivot.name = `S64_WheelPivot_${slot.name}`;
    steerPivot.position.set(slot.x, slot.y, slot.z);

    const spinGroup = new THREE.Group();
    spinGroup.name = `S64_WheelSpin_${slot.name}`;
    steerPivot.add(spinGroup);

    for (const rId of ['rim0', 'rim1', 'rim2', 'rim3']) {
      const template = rawRims[rId][slot.side];
      const clonedRim = template.clone(true);
      upgradeRimMaterials(clonedRim, rId, 'kit1');
      clonedRim.visible = rId === 'rim0';
      spinGroup.add(clonedRim);
      slotRimMeshes[rId].push(clonedRim);
    }

    const lipRing = new THREE.Mesh(playerLipGeo, playerLipMat);
    lipRing.position.z = slot.side === 'L' ? -9.5 : 9.5;
    spinGroup.add(lipRing);

    fbxSpaceGroup.add(steerPivot);
    wheelSpinGroups.push(spinGroup);
    if (slot.isFront) {
      frontSteerPivots.push(steerPivot);
    }
  }

  let activeBodyId = 'kit1';
  let activeRimId = 'rim0';
  let activeSpoilerId = 'spoiler0';

  function setConfiguration({ bodyId, rimId, spoilerId } = {}) {
    if (bodyId && bodies[bodyId]) {
      activeBodyId = bodyId;
    }
    if (rimId && slotRimMeshes[rimId]) {
      activeRimId = rimId;
    }
    if (spoilerId !== undefined) {
      activeSpoilerId = spoilerId;
    }

    // Update Neon Arcade Rim Lip Ring color to match vehicle kit/rim
    if (activeRimId === 'rim2' || activeBodyId === 'kit3') {
      playerLipMat.color.setHex(0xffb800);
    } else if (activeBodyId === 'kit2' || activeRimId === 'rim1') {
      playerLipMat.color.setHex(0x00f0ff);
    } else {
      playerLipMat.color.setHex(0xff1e26);
    }

    // Toggle active body mesh
    for (const [kId, bObj] of Object.entries(bodies)) {
      bObj.visible = kId === activeBodyId;
    }

    // Toggle active rim set across all 4 wheels and tint for current kit
    for (const [rId, clones] of Object.entries(slotRimMeshes)) {
      const isVis = rId === activeRimId;
      for (const c of clones) {
        c.visible = isVis;
        if (isVis) {
          upgradeRimMaterials(c, rId, activeBodyId);
        }
      }
    }

    // Toggle active spoiler and tint for current kit
    for (const [sId, sObj] of Object.entries(spoilers)) {
      const isVis = sId === activeSpoilerId;
      sObj.visible = isVis;
      if (isVis) {
        upgradeSpoilerMaterials(sObj, sId, activeBodyId);
      }
    }
  }

  function updateWheels(dt, speed, steerAngle = 0.0) {
    // In native S64 FBX coordinates (+X forward, +Z right), forward rolling is negative rotation around Z
    const spinDelta = (speed / 0.002) * dt;
    for (const spinGrp of wheelSpinGroups) {
      spinGrp.rotation.z -= spinDelta;
    }
    const clampedSteer = THREE.MathUtils.clamp(steerAngle, -0.52, 0.52);
    for (const pivot of frontSteerPivots) {
      pivot.rotation.y = THREE.MathUtils.lerp(
        pivot.rotation.y,
        clampedSteer,
        Math.min(1, dt * 16)
      );
    }
  }

  function createRivalCarClone({
    bodyId = 'kit1',
    rimId = 'rim1',
    spoilerId = 'spoiler1',
    paintHex = 0xe11d48,
    accentHex = 0x1e293b,
  } = {}) {
    const rivalCarRoot = new THREE.Group();
    rivalCarRoot.name = `S64RivalCar_${bodyId}`;

    const rivalFbxGroup = new THREE.Group();
    rivalFbxGroup.scale.setScalar(s64Scale);
    rivalFbxGroup.rotation.y = -Math.PI / 2;
    rivalFbxGroup.position.set(0, 0.0001, -0.00035);
    rivalCarRoot.add(rivalFbxGroup);

    // 1. Clone the S64 FBX Body Chassis and apply metallic paint
    const srcBody = bodies[bodyId] || bodies.kit1;
    const clonedBody = srcBody.clone(true);
    clonedBody.visible = true;

    clonedBody.traverse((child) => {
      if (!child.isMesh) return;
      child.castShadow = false;
      child.receiveShadow = false;
      const oldMats = Array.isArray(child.material) ? child.material : [child.material];
      const newMats = oldMats.map((oldMat) => {
        const mName = (oldMat?.name || '').toLowerCase();
        if (mName.includes('headlight') || mName.includes('rearlight') || mName.includes('glass') || mName.includes('exhaust')) {
          return oldMat;
        }
        if (mName.includes('det2') || mName.includes('accent') || mName.includes('stripe')) {
          const accMat = new THREE.MeshStandardMaterial({
            name: 'S64_RivalAccent',
            color: accentHex,
            roughness: 0.22,
            metalness: 0.68,
            envMapIntensity: 1.35,
          });
          attachReadabilityRimShader(accMat, `s64_rival_acc_${accentHex}`, 0.26, 0.32, 0.26);
          return accMat;
        }
        if (mName.includes('trim') || mName.includes('det1')) {
          return oldMat;
        }
        const rivalPaintMat = new THREE.MeshStandardMaterial({
          name: 'S64_RivalMetallicPaint',
          color: paintHex,
          roughness: 0.16,
          metalness: 0.74,
          envMapIntensity: 1.6,
        });
        attachReadabilityRimShader(rivalPaintMat, `s64_rival_paint_${paintHex}`, 0.34, 0.4, 0.34);
        return rivalPaintMat;
      });
      child.material = Array.isArray(child.material) ? newMats : newMats[0];
    });
    rivalFbxGroup.add(clonedBody);

    // 2. Clone Spoiler if specified
    if (spoilerId && spoilers[spoilerId]) {
      const clonedSpoiler = spoilers[spoilerId].clone(true);
      clonedSpoiler.visible = true;
      clonedSpoiler.traverse((child) => {
        if (!child.isMesh) return;
        const wingMat = new THREE.MeshStandardMaterial({
          name: 'S64_RivalWing',
          color: paintHex,
          roughness: 0.18,
          metalness: 0.72,
          envMapIntensity: 1.4,
        });
        attachReadabilityRimShader(wingMat, `s64_rival_wing_${paintHex}`, 0.28, 0.32, 0.28);
        child.material = wingMat;
      });
      rivalFbxGroup.add(clonedSpoiler);
    }

      // 3. Clone 4 Wheels + Neon Arcade Rim Lip Ring
    const rivalWheelSpinGroups = [];
    const chosenRimSet = rawRims[rimId] || rawRims.rim1;
    const rivalNeonLipMat = new THREE.MeshBasicMaterial({
      color: paintHex,
      toneMapped: false,
    });
    const rivalLipGeo = new THREE.TorusGeometry(21.5, 1.35, 8, 24);
    rivalLipGeo.rotateY(Math.PI / 2);

    for (const slot of WHEEL_SLOTS) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(slot.x, slot.y, slot.z);

      const spinGroup = new THREE.Group();
      steerPivot.add(spinGroup);

      const templateRim = chosenRimSet[slot.side];
      const clonedRim = templateRim.clone(true);
      upgradeRimMaterials(clonedRim, rimId, bodyId);
      clonedRim.visible = true;
      spinGroup.add(clonedRim);

      const lipMesh = new THREE.Mesh(rivalLipGeo, rivalNeonLipMat);
      lipMesh.position.z = slot.side === 'L' ? -9.5 : 9.5;
      spinGroup.add(lipMesh);

      rivalFbxGroup.add(steerPivot);
      rivalWheelSpinGroups.push(spinGroup);
    }

    // 4. Twin Rear Exhaust Nitro Flame Cones for AI Rival Cars
    const rivalFlameGeo = new THREE.ConeGeometry(8.5, 62.0, 10, 1, true);
    rivalFlameGeo.rotateZ(Math.PI / 2);
    rivalFlameGeo.translate(-31.0, 0, 0);
    const rivalFlameMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      toneMapped: false,
    });
    const rivalFlames = [];
    for (const zOff of [-24.0, 24.0]) {
      const fMesh = new THREE.Mesh(rivalFlameGeo, rivalFlameMat);
      fMesh.position.set(-156.0, 19.5, zOff);
      fMesh.visible = false;
      rivalFbxGroup.add(fMesh);
      rivalFlames.push(fMesh);
    }

    function updateRivalWheels(dt, speed, isBoosting = false) {
      const spinDelta = (speed / 0.002) * dt;
      for (let i = 0; i < rivalWheelSpinGroups.length; i++) {
        rivalWheelSpinGroups[i].rotation.z -= spinDelta;
      }
      const showFlame = isBoosting || speed > 0.195;
      const pulse = 0.82 + Math.random() * 0.38;
      for (let i = 0; i < rivalFlames.length; i++) {
        const f = rivalFlames[i];
        f.visible = showFlame;
        if (showFlame) {
          f.scale.set(isBoosting ? 1.35 * pulse : 0.65 * pulse, 1.0, 1.0);
        }
      }
    }

    return {
      carGroup: rivalCarRoot,
      updateWheels: updateRivalWheels,
    };
  }

  return {
    carAssemblyRoot,
    setConfiguration,
    updateWheels,
    createRivalCarClone,
    getActiveConfig: () => ({
      bodyId: activeBodyId,
      rimId: activeRimId,
      spoilerId: activeSpoilerId,
    }),
  };
}
