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
  { name: 'FL', x: 104.2, y: 24.0, z: -61.5, side: 'L', isFront: true },
  { name: 'FR', x: 104.2, y: 24.0, z: 61.5, side: 'R', isFront: true },
  { name: 'RL', x: -99.5, y: 24.0, z: -61.5, side: 'L', isFront: false },
  { name: 'RR', x: -99.5, y: 24.0, z: 61.5, side: 'R', isFront: false },
];

const RIM_STYLES = {
  rim0: {
    alloyHex: 0xe2e8f0, // Bright Brushed Silver
    accentHex: 0x94a3b8,
    caliperHex: 0xef4444,
    roughness: 0.14,
    metalness: 0.92,
  },
  rim1: {
    alloyHex: 0x00e5ff, // Electric Cyan 5-Spoke
    accentHex: 0xf8fafc,
    caliperHex: 0xfbbf24,
    roughness: 0.10,
    metalness: 0.90,
  },
  rim2: {
    alloyHex: 0xffb800, // 24K Deep-Dish Gold Mesh
    accentHex: 0xffffff,
    caliperHex: 0xef4444,
    roughness: 0.12,
    metalness: 0.95,
  },
  rim3: {
    alloyHex: 0xf8fafc, // Diamond-Cut White & Titanium Turbine
    accentHex: 0x38bdf8,
    caliperHex: 0x10b981,
    roughness: 0.08,
    metalness: 0.96,
  },
};

function attachReadabilityRimShader(_mat, _cacheKey, _minFloorStrength, _topFillStrength, _rimStrength) {
  // Natural studio & environment PBR lighting
}

function upgradeBodyMaterials(fbxObj, kitId, customPaintHex = null) {
  const defaultPaintHex =
    kitId === 'kit2' ? 0x00d4ff : kitId === 'kit3' ? 0xffb800 : 0xee1520;
  const paintHex = customPaintHex !== null ? customPaintHex : defaultPaintHex;

  fbxObj.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = false;
    if (child.geometry && !child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }

    const oldMats = Array.isArray(child.material) ? child.material : [child.material];
    const newMats = oldMats.map((oldMat, matIdx) => {
      const mName = (oldMat?.name || '').toLowerCase();

      if (mName.includes('headlight') || mName.includes('front_light')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_Headlights',
          color: 0xe0f7ff,
          emissive: new THREE.Color(0xbae6fd),
          emissiveIntensity: 2.4,
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
          emissiveIntensity: 2.2,
          roughness: 0.08,
          metalness: 0.15,
          toneMapped: false,
        });
      }

      if (mName.includes('glass') || mName.includes('window') || mName.includes('windshield')) {
        return new THREE.MeshPhysicalMaterial({
          name: 'S64_Glass',
          color: 0x04070f,
          roughness: 0.04,
          metalness: 0.38,
          clearcoat: 1.0,
          clearcoatRoughness: 0.04,
          reflectivity: 0.96,
          envMapIntensity: 1.35,
        });
      }

      if (mName.includes('exhaust') || mName.includes('muffler') || mName.includes('chrome')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_Exhaust',
          color: 0xcbd5e1,
          roughness: 0.16,
          metalness: 0.92,
          envMapIntensity: 1.15,
        });
      }

      if (mName.includes('det2') || mName.includes('accent') || mName.includes('stripe')) {
        const accentHex =
          kitId === 'kit2' ? 0x091326 : kitId === 'kit3' ? 0x111520 : 0xffffff;
        return new THREE.MeshStandardMaterial({
          name: 'S64_Det2',
          color: accentHex,
          roughness: 0.28,
          metalness: 0.30,
          envMapIntensity: 0.85,
        });
      }

      if (mName.includes('det1') || mName.includes('under') || mName.includes('trim') || mName.includes('black')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_Trim',
          color: 0x10141c,
          roughness: 0.68,
          metalness: 0.08,
          envMapIntensity: 0.35,
        });
      }

      return new THREE.MeshPhysicalMaterial({
        name: `S64_CarPaint_${kitId}_${matIdx}`,
        color: paintHex,
        roughness: 0.25,
        metalness: 0.65,
        clearcoat: 1.0,
        clearcoatRoughness: 0.12,
        reflectivity: 0.92,
        envMapIntensity: 1.15,
      });
    });

    child.material = Array.isArray(child.material) ? newMats : newMats[0];
  });
}

function upgradeRimMaterials(fbxObj, rimId) {
  const style = RIM_STYLES[rimId] || RIM_STYLES.rim0;
  fbxObj.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = false;
    if (child.geometry && !child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }

    const oldMats = Array.isArray(child.material) ? child.material : [child.material];
    const newMats = oldMats.map((oldMat) => {
      const mName = (oldMat?.name || '').toLowerCase();

      if (mName.includes('tire')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_TireRubber',
          color: 0x12151c,
          roughness: 0.82,
          metalness: 0.04,
          envMapIntensity: 0.30,
        });
      }

      if (mName.includes('disc')) {
        return new THREE.MeshStandardMaterial({
          name: 'S64_BrakeDisc',
          color: 0x64748b,
          roughness: 0.24,
          metalness: 0.88,
        });
      }

      return new THREE.MeshStandardMaterial({
        name: 'S64_RimAlloy',
        color: style.alloyHex,
        roughness: Math.max(0.16, style.roughness),
        metalness: style.metalness,
        envMapIntensity: 1.25,
      });
    });

    child.material = Array.isArray(child.material) ? newMats : newMats[0];
  });
}

/**
 * Builds a coaxial 3D Custom Rim Insert (in the X-Y wheel plane, axle along Z)
 * so each rim option (rim0..rim3) has a dramatically different 3D spoke pattern,
 * outer alloy flange, and center lock cap — with ZERO sideways tire clipping!
 */
function buildCoaxialCustomRimInsert(rimId, side) {
  const style = RIM_STYLES[rimId] || RIM_STYLES.rim0;
  const group = new THREE.Group();
  group.name = `CustomRimInsert_${rimId}_${side}`;

  // Offset slightly outward along wheel axle (+Z on right, -Z on left) so custom spokes sit flush in the wheel dish
  const zSign = side === 'L' ? -1 : 1;
  group.position.z = zSign * 1.4;

  const alloyMat = new THREE.MeshStandardMaterial({
    color: style.alloyHex,
    roughness: style.roughness,
    metalness: style.metalness,
    envMapIntensity: 2.8,
  });

  const accentMat = new THREE.MeshStandardMaterial({
    color: style.accentHex,
    roughness: 0.12,
    metalness: 0.92,
    envMapIntensity: 2.5,
  });

  const capMat = new THREE.MeshStandardMaterial({
    color: style.caliperHex,
    roughness: 0.18,
    metalness: 0.80,
  });

  // 1. Coaxial Outer Rim Barrel Flange (lies in X-Y plane, normal along Z axle — never intersects tire tread!)
  const flangeRing = new THREE.Mesh(
    new THREE.TorusGeometry(14.6, 1.35, 10, 28),
    rimId === 'rim2' ? accentMat : alloyMat
  );
  flangeRing.position.z = zSign * 1.6;
  group.add(flangeRing);

  // 2. Center Lock Hub Cap (cylinder aligned with Z axle via rotateX(Math.PI/2))
  const hubGeo = new THREE.CylinderGeometry(4.2, 4.2, 3.2, 16);
  hubGeo.rotateX(Math.PI / 2);
  const hubMesh = new THREE.Mesh(hubGeo, capMat);
  hubMesh.position.z = zSign * 1.2;
  group.add(hubMesh);

  // 3. Distinct 3D Spoke Geometry per Rim ID
  if (rimId === 'rim0') {
    // Stock Silver 6-Spoke Classic Star
    const spokeGeo = new THREE.BoxGeometry(2.4, 26.5, 2.0);
    for (let i = 0; i < 3; i++) {
      const spoke = new THREE.Mesh(spokeGeo, alloyMat);
      spoke.rotation.z = (i * Math.PI) / 3;
      spoke.position.z = zSign * 0.8;
      group.add(spoke);
    }
  } else if (rimId === 'rim1') {
    // Neon Cyan 5-Spoke Directional Twin Blades
    const spokeGeo = new THREE.BoxGeometry(2.8, 13.5, 2.4);
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5;
      const spoke = new THREE.Mesh(spokeGeo, alloyMat);
      spoke.position.set(Math.cos(angle) * 7.2, Math.sin(angle) * 7.2, zSign * 1.1);
      spoke.rotation.z = angle - Math.PI / 2 + 0.18;
      group.add(spoke);
    }
  } else if (rimId === 'rim2') {
    // 24K Gold Deep-Dish Multi-Spoke BBS Mesh + Chrome Step Lip
    const innerStepRing = new THREE.Mesh(
      new THREE.TorusGeometry(12.2, 1.1, 8, 24),
      alloyMat
    );
    innerStepRing.position.z = zSign * 0.6;
    group.add(innerStepRing);

    const meshSpokeGeo = new THREE.BoxGeometry(1.5, 25.0, 1.8);
    for (let i = 0; i < 4; i++) {
      const spokeA = new THREE.Mesh(meshSpokeGeo, alloyMat);
      spokeA.rotation.z = (i * Math.PI) / 4 + 0.12;
      spokeA.position.z = zSign * 0.5;
      const spokeB = new THREE.Mesh(meshSpokeGeo, alloyMat);
      spokeB.rotation.z = (i * Math.PI) / 4 - 0.12;
      spokeB.position.z = zSign * 0.5;
      group.add(spokeA, spokeB);
    }
  } else if (rimId === 'rim3') {
    // Titanium GT 10-Blade Aero Turbine + Aero Ring
    const aeroDiscGeo = new THREE.CylinderGeometry(11.8, 11.8, 1.4, 24);
    aeroDiscGeo.rotateX(Math.PI / 2);
    const aeroDisc = new THREE.Mesh(aeroDiscGeo, alloyMat);
    aeroDisc.position.z = zSign * 0.4;
    group.add(aeroDisc);

    const bladeGeo = new THREE.BoxGeometry(1.6, 8.5, 2.2);
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8;
      const blade = new THREE.Mesh(bladeGeo, accentMat);
      blade.position.set(Math.cos(angle) * 8.8, Math.sin(angle) * 8.8, zSign * 1.2);
      blade.rotation.z = angle - Math.PI / 2 + 0.38;
      group.add(blade);
    }
  }

  return group;
}

/**
 * Builds distinct 3D Sculpted Chassis & Aero Bodywork Attachments in native S64 FBX coordinates
 * (+X Nose +176, -X Tail -158, +Y Roof +104, ±Z Left/Right ±58) so Kit 1, Kit 2, and Kit 3
 * have unmistakably different 3D silhouettes (Street Coupe vs Widebody Muscle vs Le Mans Hypercar).
 */
function buildBespokeBodyKitAttachments(kitId, customPaintHex = null) {
  const group = new THREE.Group();
  group.name = `BespokeBodyKit_${kitId}`;

  const defaultPaintHex =
    kitId === 'kit2' ? 0x00d4ff : kitId === 'kit3' ? 0xffb800 : 0xee1520;
  const paintHex = customPaintHex !== null ? customPaintHex : defaultPaintHex;

  const paintMat = new THREE.MeshStandardMaterial({
    name: `S64_KitPaint_${kitId}`,
    color: paintHex,
    roughness: 0.12,
    metalness: 0.85,
    envMapIntensity: 2.5,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    name: 'S64_CarbonAero',
    color: 0x11151f,
    roughness: 0.26,
    metalness: 0.65,
    envMapIntensity: 1.8,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    name: 'S64_ChromeHardware',
    color: 0xe2e8f0,
    roughness: 0.10,
    metalness: 0.96,
    envMapIntensity: 2.8,
  });

  const accentGlowMat = new THREE.MeshStandardMaterial({
    name: 'S64_AeroAccent',
    color: kitId === 'kit2' ? 0x00f0ff : kitId === 'kit3' ? 0xffc72c : 0xff2b1e,
    emissive: new THREE.Color(
      kitId === 'kit2' ? 0x00a8cc : kitId === 'kit3' ? 0x996600 : 0x880808
    ),
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.78,
  });

  if (kitId === 'kit1') {
    // KIT 1: STREET TUNER (JDM Coupe — Carbon Chin Lip, Hood Vents, Angled Titanium Exhaust)
    const frontLip = new THREE.Mesh(new THREE.BoxGeometry(18, 4.5, 124), carbonMat);
    frontLip.position.set(172, 11, 0);
    frontLip.castShadow = true;
    group.add(frontLip);

    // Front lip accent strip
    const lipAccent = new THREE.Mesh(new THREE.BoxGeometry(4, 2.2, 126), accentGlowMat);
    lipAccent.position.set(180, 10.5, 0);
    group.add(lipAccent);

    // JDM Vented Carbon Hood Slats
    for (let i = 0; i < 3; i++) {
      const vent = new THREE.Mesh(new THREE.BoxGeometry(8, 2.5, 56), carbonMat);
      vent.position.set(95 + i * 16, 68.5 - i * 1.8, 0);
      vent.rotation.z = -0.10;
      group.add(vent);
    }

    // Sleek Carbon Side Skirts
    for (const zSign of [-1, 1]) {
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(132, 4.5, 6), carbonMat);
      skirt.position.set(4, 11.5, zSign * 59.5);
      group.add(skirt);
    }
  } else if (kitId === 'kit2') {
    // KIT 2: AERO BEAST (Widebody Muscle GT — Flared Overfenders, V8 Supercharger Hood Blower, Rear Louvers)
    // 1. Massive Bolted Widebody Fender Flares over all 4 wheel wells (+16 units wider!)
    const archPositions = [
      { x: 104.2, y: 34, z: -61, isFront: true },
      { x: 104.2, y: 34, z: 61, isFront: true },
      { x: -99.5, y: 36, z: -62, isFront: false },
      { x: -99.5, y: 36, z: 62, isFront: false },
    ];
    for (const arch of archPositions) {
      const flare = new THREE.Mesh(
        new THREE.BoxGeometry(arch.isFront ? 58 : 64, 22, 14),
        paintMat
      );
      flare.position.set(arch.x, arch.y, arch.z);
      flare.castShadow = true;
      group.add(flare);

      const archTrim = new THREE.Mesh(
        new THREE.BoxGeometry(arch.isFront ? 60 : 66, 6, 15.5),
        carbonMat
      );
      archTrim.position.set(arch.x, arch.y - 8, arch.z);
      group.add(archTrim);
    }

    // 2. Towering Chrome V8 Supercharger Hood Blower Scoop
    const blowerBase = new THREE.Mesh(new THREE.BoxGeometry(52, 12, 36), carbonMat);
    blowerBase.position.set(102, 72, 0);
    blowerBase.castShadow = true;
    group.add(blowerBase);

    const blowerHousing = new THREE.Mesh(new THREE.BoxGeometry(44, 13, 30), chromeMat);
    blowerHousing.position.set(106, 80, 0);
    blowerHousing.castShadow = true;
    group.add(blowerHousing);

    const intakeValve = new THREE.Mesh(new THREE.BoxGeometry(6, 9, 26), accentGlowMat);
    intakeValve.position.set(127, 80, 0);
    group.add(intakeValve);

    // 3. Widebody Side-Skirts & Twin Side-Exit Exhaust Pipes
    for (const zSign of [-1, 1]) {
      const wideSkirt = new THREE.Mesh(new THREE.BoxGeometry(142, 7, 13), carbonMat);
      wideSkirt.position.set(2, 12, zSign * 62);
      wideSkirt.castShadow = true;
      group.add(wideSkirt);

      const skirtAccent = new THREE.Mesh(new THREE.BoxGeometry(138, 2.4, 14.5), accentGlowMat);
      skirtAccent.position.set(2, 9.5, zSign * 62);
      group.add(skirtAccent);
    }

    // 4. Aggressive Front Time-Attack Splitter & Twin Dive-Plane Canards
    const beastSplitter = new THREE.Mesh(new THREE.BoxGeometry(28, 5, 138), carbonMat);
    beastSplitter.position.set(174, 10, 0);
    beastSplitter.castShadow = true;
    group.add(beastSplitter);

    for (const zSign of [-1, 1]) {
      const canard = new THREE.Mesh(new THREE.BoxGeometry(24, 12, 5), accentGlowMat);
      canard.position.set(172, 20, zSign * 64);
      canard.rotation.z = 0.25;
      group.add(canard);
    }

    // 5. Muscle Fastback Rear Window Slatted Louvers
    for (let i = 0; i < 4; i++) {
      const louver = new THREE.Mesh(new THREE.BoxGeometry(10, 2.5, 78), carbonMat);
      louver.position.set(-72 - i * 14, 96 - i * 4.5, 0);
      louver.rotation.z = 0.28;
      group.add(louver);
    }
  } else if (kitId === 'kit3') {
    // KIT 3: CYBER PHANTOM (Exotic Le Mans Hypercar — Extended Aero Nose, Roof Airbox, LMP1 Shark Fin, Rear Diffuser)
    // 1. Elongated Hypercar Front Aero Nose Cone & Dual-Blade Front Wing
    const hyperNose = new THREE.Mesh(new THREE.BoxGeometry(32, 14, 112), paintMat);
    hyperNose.position.set(176, 22, 0);
    hyperNose.rotation.z = -0.18;
    hyperNose.castShadow = true;
    group.add(hyperNose);

    const frontWingBlade = new THREE.Mesh(new THREE.BoxGeometry(34, 4.5, 142), carbonMat);
    frontWingBlade.position.set(180, 9.5, 0);
    frontWingBlade.castShadow = true;
    group.add(frontWingBlade);

    const frontWingEdge = new THREE.Mesh(new THREE.BoxGeometry(8, 3.0, 144), accentGlowMat);
    frontWingEdge.position.set(194, 9.5, 0);
    group.add(frontWingEdge);

    // Front wing endplates
    for (const zSign of [-1, 1]) {
      const endplate = new THREE.Mesh(new THREE.BoxGeometry(36, 18, 4), paintMat);
      endplate.position.set(176, 16, zSign * 70);
      group.add(endplate);
    }

    // 2. Formula-1 Overhead Roof Snorkel Airbox Scoop
    const roofScoop = new THREE.Mesh(new THREE.BoxGeometry(58, 14, 22), paintMat);
    roofScoop.position.set(-8, 108, 0);
    roofScoop.castShadow = true;
    group.add(roofScoop);

    const scoopInlet = new THREE.Mesh(new THREE.BoxGeometry(6, 10, 18), accentGlowMat);
    scoopInlet.position.set(20, 108, 0);
    group.add(scoopInlet);

    // 3. Iconic LMP1 Dorsal Shark-Fin Aero Spine along the rear deck
    const sharkFin = new THREE.Mesh(new THREE.BoxGeometry(92, 26, 3.5), carbonMat);
    sharkFin.position.set(-76, 96, 0);
    sharkFin.rotation.z = 0.14;
    sharkFin.castShadow = true;
    group.add(sharkFin);

    const sharkFinTrim = new THREE.Mesh(new THREE.BoxGeometry(90, 4, 4.5), accentGlowMat);
    sharkFinTrim.position.set(-76, 108, 0);
    sharkFinTrim.rotation.z = 0.14;
    group.add(sharkFinTrim);

    // 4. Sculpted Hypercar Side-Pod Air Tunnels & Bargeboards
    for (const zSign of [-1, 1]) {
      const sidePod = new THREE.Mesh(new THREE.BoxGeometry(118, 22, 14), paintMat);
      sidePod.position.set(-6, 24, zSign * 62);
      sidePod.castShadow = true;
      group.add(sidePod);

      const podBlade = new THREE.Mesh(new THREE.BoxGeometry(148, 5, 18), carbonMat);
      podBlade.position.set(0, 10, zSign * 64);
      group.add(podBlade);
    }

    // 5. Rear Ground-Effect Venturi Diffuser with 5 Vertical Aero Strakes
    const diffuserBase = new THREE.Mesh(new THREE.BoxGeometry(24, 6, 132), carbonMat);
    diffuserBase.position.set(-160, 12, 0);
    group.add(diffuserBase);

    for (const zPos of [-52, -26, 0, 26, 52]) {
      const strake = new THREE.Mesh(new THREE.BoxGeometry(28, 14, 3.2), accentGlowMat);
      strake.position.set(-162, 14, zPos);
      group.add(strake);
    }
  }

  return group;
}

function upgradeSpoilerMaterials(fbxObj, spoilerId, kitId, customPaintHex = null) {
  const defaultWingColor =
    kitId === 'kit2'
      ? 0x00d4ff
      : kitId === 'kit3'
        ? 0xffb800
        : spoilerId === 'spoiler2'
          ? 0x151922
          : 0xee1520;
  const wingColor = customPaintHex !== null ? customPaintHex : defaultWingColor;

  fbxObj.traverse((child) => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = false;
    if (child.geometry && !child.geometry.attributes.normal) {
      child.geometry.computeVertexNormals();
    }

    child.material = new THREE.MeshPhysicalMaterial({
      name: 'S64_SpoilerWing',
      color: wingColor,
      roughness: 0.28,
      metalness: 0.22,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 0.95,
    });
  });
}

/**
 * Loads all 13 FBX files from S64Compact_v1_C (3 Bodies, 4 Left/Right Rim sets, 2 Spoilers)
 * and builds a complete modular 3D vehicle assembly with distinct 3D bodykits, coaxial custom rims, and spoilers.
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
  const fbxSpaceGroup = new THREE.Group();
  fbxSpaceGroup.name = 'S64FbxSpaceRoot';
  const s64Scale = 0.0000565;
  fbxSpaceGroup.scale.set(s64Scale * 1.03, s64Scale * 0.88, s64Scale * 1.14);
  fbxSpaceGroup.rotation.y = -Math.PI / 2;
  fbxSpaceGroup.position.set(0, 0.00005, -0.00035);
  carAssemblyRoot.add(fbxSpaceGroup);

  // 1. Prepare 3 Body Meshes + Bespoke 3D Bodykit Sculptures so each car has a truly distinct 3D silhouette
  const bodies = {
    kit1: body1,
    kit2: body2,
    kit3: body3,
  };
  const bespokeKitGroups = {};

  for (const [kId, bObj] of Object.entries(bodies)) {
    upgradeBodyMaterials(bObj, kId);
    bObj.visible = kId === 'kit1';
    fbxSpaceGroup.add(bObj);
  }

  // 2. Prepare 2 Spoilers mounted on the rear trunk decklid + Custom Swan-Neck Pylons for spoiler2
  const spoilers = {
    spoiler1,
    spoiler2,
  };
  spoiler1.position.set(-134.0, 74.5, 0.0);
  spoiler2.position.set(-138.0, 78.0, 0.0);
  spoiler2.scale.set(1.15, 1.22, 1.18);

  for (const [sId, sObj] of Object.entries(spoilers)) {
    upgradeSpoilerMaterials(sObj, sId, 'kit1');
    sObj.visible = false;
    fbxSpaceGroup.add(sObj);
  }

  // 3. Prepare 4 Wheel Slots (FL, FR, RL, RR), each holding all 4 Rim Variants (rim0..rim3) + Coaxial 3D Custom Rim Inserts
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

  for (const slot of WHEEL_SLOTS) {
    const steerPivot = new THREE.Group();
    steerPivot.name = `S64_WheelPivot_${slot.name}`;
    steerPivot.position.set(slot.x, slot.y, slot.z);

    const spinGroup = new THREE.Group();
    spinGroup.name = `S64_WheelSpin_${slot.name}`;
    steerPivot.add(spinGroup);

    for (const rId of ['rim0', 'rim1', 'rim2', 'rim3']) {
      const rimContainer = new THREE.Group();
      rimContainer.name = `S64_RimVariant_${rId}_${slot.name}`;

      const template = rawRims[rId][slot.side];
      const clonedRim = template.clone(true);
      upgradeRimMaterials(clonedRim, rId);
      rimContainer.add(clonedRim);

      // Attach coaxial 3D spoke/flange insert so switching rims is 100% unmistakable
      const customInsert = buildCoaxialCustomRimInsert(rId, slot.side);
      rimContainer.add(customInsert);

      rimContainer.visible = rId === 'rim0';
      spinGroup.add(rimContainer);
      slotRimMeshes[rId].push(rimContainer);
    }

    fbxSpaceGroup.add(steerPivot);
    wheelSpinGroups.push(spinGroup);
    if (slot.isFront) {
      frontSteerPivots.push(steerPivot);
    }
  }

  let activeBodyId = 'kit1';
  let activeRimId = 'rim0';
  let activeSpoilerId = 'spoiler0';
  let activePaintHex = null;

  function setConfiguration({ bodyId, rimId, spoilerId, paintHex } = {}) {
    const mappedBody = bodyId === 's64' ? 'kit1' : bodyId;
    if (mappedBody && bodies[mappedBody]) {
      activeBodyId = mappedBody;
    }
    if (rimId && slotRimMeshes[rimId]) {
      activeRimId = rimId;
    }
    if (spoilerId !== undefined) {
      activeSpoilerId = spoilerId;
    }
    if (paintHex !== undefined) {
      activePaintHex = paintHex;
    }

    fbxSpaceGroup.visible = true;

    // Toggle active body mesh & update paint if overridden
    for (const [kId, bObj] of Object.entries(bodies)) {
      const isVis = kId === activeBodyId;
      bObj.visible = isVis;
      if (isVis) {
        bObj.traverse((c) => {
          c.visible = true;
        });
        upgradeBodyMaterials(bObj, kId, activePaintHex);
        if (bespokeKitGroups[kId]) {
          bespokeKitGroups[kId].traverse((c) => {
            c.visible = true;
            if (c.isMesh && c.material && c.material.name?.startsWith('S64_KitPaint_')) {
              const defaultHex =
                kId === 'kit2' ? 0x00d4ff : kId === 'kit3' ? 0xffb800 : 0xee1520;
              c.material.color.setHex(activePaintHex !== null ? activePaintHex : defaultHex);
            }
          });
        }
      }
    }

    // Toggle active rim set across all 4 wheels
    for (const [rId, containers] of Object.entries(slotRimMeshes)) {
      const isVis = rId === activeRimId;
      for (const c of containers) {
        c.visible = isVis;
        if (isVis) {
          c.traverse((node) => {
            node.visible = true;
          });
        }
      }
    }

    // Toggle active spoiler and tint for current kit
    for (const [sId, sObj] of Object.entries(spoilers)) {
      const isVis = sId === activeSpoilerId;
      sObj.visible = isVis;
      if (isVis) {
        sObj.traverse((node) => {
          node.visible = true;
        });
        upgradeSpoilerMaterials(sObj, sId, activeBodyId, activePaintHex);
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

    // 1. Clone the S64 FBX Body Chassis + Bespoke Bodykit Sculpture and apply metallic paint
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
        if (
          mName.includes('headlight') ||
          mName.includes('rearlight') ||
          mName.includes('rear_light') ||
          mName.includes('glass') ||
          mName.includes('exhaust') ||
          mName.includes('chromehardware') ||
          mName.includes('carbonaero')
        ) {
          return oldMat;
        }
        if (mName.includes('det2') || mName.includes('accent') || mName.includes('stripe') || mName.includes('aeroaccent')) {
          return new THREE.MeshStandardMaterial({
            name: 'S64_RivalAccent',
            color: accentHex,
            roughness: 0.20,
            metalness: 0.72,
            envMapIntensity: 1.5,
          });
        }
        if (mName.includes('trim') || mName.includes('det1')) {
          return oldMat;
        }
        return new THREE.MeshStandardMaterial({
          name: 'S64_RivalMetallicPaint',
          color: paintHex,
          roughness: 0.14,
          metalness: 0.78,
          envMapIntensity: 1.8,
        });
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
        child.material = new THREE.MeshStandardMaterial({
          name: 'S64_RivalWing',
          color: paintHex,
          roughness: 0.16,
          metalness: 0.76,
          envMapIntensity: 1.6,
        });
      });
      rivalFbxGroup.add(clonedSpoiler);
    }

    // 3. Clone 4 Wheels + Coaxial Custom 3D Rim Inserts (zero sideways torus artifact!)
    const rivalWheelSpinGroups = [];
    const chosenRimSet = rawRims[rimId] || rawRims.rim1;

    for (const slot of WHEEL_SLOTS) {
      const steerPivot = new THREE.Group();
      steerPivot.position.set(slot.x, slot.y, slot.z);

      const spinGroup = new THREE.Group();
      steerPivot.add(spinGroup);

      const templateRim = chosenRimSet[slot.side];
      const clonedRim = templateRim.clone(true);
      upgradeRimMaterials(clonedRim, rimId);
      clonedRim.visible = true;
      spinGroup.add(clonedRim);

      const customInsert = buildCoaxialCustomRimInsert(rimId, slot.side);
      spinGroup.add(customInsert);

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
      paintHex: activePaintHex,
    }),
  };
}
