import * as THREE from 'three';
import { getPitGarageTextures } from './ProceduralTextures.js';

/**
 * Builds the Real-World Automotive Pit-Lane Garage Showroom surrounding the turntable at centerPos.
 * Shown strictly during SPLASH, MENU, and GARAGE states; hidden during active outdoor RACE.
 */
export function buildPitLaneGarage(scene, centerPos = new THREE.Vector3(0.0, 0.088, 0.22)) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'PitLaneGarageShowroomGroup';
  rootGroup.position.copy(centerPos);
  scene.add(rootGroup);

  const { concreteFloorTex } = getPitGarageTextures();

  // 1. Polished Dark Concrete Pit-Lane Floor Bay (sits flush right beneath the turntable base)
  const floorGeo = new THREE.PlaneGeometry(0.26, 0.22);
  const floorMat = new THREE.MeshStandardMaterial({
    map: concreteFloorTex,
    color: 0x7c8ea6,
    roughness: 0.42,
    metalness: 0.20,
    envMapIntensity: 0.40,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0.0, -0.0022, -0.01);
  floorMesh.receiveShadow = true;
  rootGroup.add(floorMesh);

  // Balanced Overhead Pit-Bay Illumination (keeps pit walls readable without washing out car shadows)
  const bayCeilingLight = new THREE.PointLight(0xe0f2fe, 0.14, 0.28, 1.6);
  bayCeilingLight.position.set(0.0, 0.056, 0.012);
  rootGroup.add(bayCeilingLight);

  // Subtle floor safety border strips (Left, Right, and Rear pit bay lines)
  const stripMatCyan = new THREE.MeshBasicMaterial({
    color: 0x06b6d4,
    toneMapped: true,
  });
  const stripMatAmber = new THREE.MeshBasicMaterial({
    color: 0xd97706,
    toneMapped: true,
  });
  const sideStripGeo = new THREE.PlaneGeometry(0.0014, 0.095);
  for (const sx of [-0.032, 0.032]) {
    const strip = new THREE.Mesh(sideStripGeo, stripMatCyan);
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(sx, -0.0020, -0.006);
    rootGroup.add(strip);
  }

  // 2. Rear Pit-Wall Architecture & Carbon Acoustic Panels
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x131b2b,
    roughness: 0.52,
    metalness: 0.38,
  });
  const darkSteelMat = new THREE.MeshStandardMaterial({
    color: 0x1f2b3d,
    roughness: 0.36,
    metalness: 0.68,
  });
  const crimsonCabinetMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    roughness: 0.26,
    metalness: 0.55,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.20,
    metalness: 0.88,
  });
  const tireRubberMat = new THREE.MeshStandardMaterial({
    color: 0x1e2530,
    roughness: 0.78,
    metalness: 0.12,
  });

  // Main back pit wall
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.068, 0.004), wallMat);
  backWall.position.set(0.0, 0.031, -0.052);
  backWall.receiveShadow = true;
  rootGroup.add(backWall);

  // Angled side wing walls
  const wingWallGeo = new THREE.BoxGeometry(0.055, 0.068, 0.004);
  const leftWing = new THREE.Mesh(wingWallGeo, wallMat);
  leftWing.position.set(-0.062, 0.031, -0.028);
  leftWing.rotation.y = Math.PI * 0.32;
  const rightWing = new THREE.Mesh(wingWallGeo, wallMat);
  rightWing.position.set(0.062, 0.031, -0.028);
  rightWing.rotation.y = -Math.PI * 0.32;
  rootGroup.add(leftWing, rightWing);

  // 4 Vertical Steel Gantry Pillars along the rear pit wall
  const pillarGeo = new THREE.BoxGeometry(0.0042, 0.068, 0.0055);
  const pillarLedGeo = new THREE.BoxGeometry(0.0008, 0.052, 0.0058);
  for (const px of [-0.044, -0.016, 0.016, 0.044]) {
    const pillar = new THREE.Mesh(pillarGeo, darkSteelMat);
    pillar.position.set(px, 0.031, -0.049);
    rootGroup.add(pillar);

    const ledStrip = new THREE.Mesh(
      pillarLedGeo,
      Math.abs(px) < 0.025 ? stripMatCyan : stripMatAmber
    );
    ledStrip.position.set(px, 0.031, -0.0488);
    rootGroup.add(ledStrip);
  }

  // 3. Overhead Pit-Bay Truss Ceiling & Studio LED Softbox Light Bars
  const ceilingTruss = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.0035, 0.072), darkSteelMat);
  ceilingTruss.position.set(0.0, 0.064, -0.015);
  rootGroup.add(ceilingTruss);

  const softboxMat = new THREE.MeshBasicMaterial({
    color: 0xcbd5e1,
    toneMapped: true,
  });
  const softboxGeo = new THREE.BoxGeometry(0.026, 0.0008, 0.0065);
  for (const bz of [-0.032, -0.014, 0.004]) {
    for (const bx of [-0.022, 0.022]) {
      const box = new THREE.Mesh(softboxGeo, softboxMat);
      box.position.set(bx, 0.062, bz);
      rootGroup.add(box);
    }
  }

  // 4. Motorsport Pit Tool Cabinets (Left & Right Rear Bays)
  const cabinetGeo = new THREE.BoxGeometry(0.018, 0.011, 0.008);
  const drawerGeo = new THREE.BoxGeometry(0.016, 0.0014, 0.0084);
  for (const cx of [-0.030, 0.030]) {
    const cab = new THREE.Mesh(cabinetGeo, crimsonCabinetMat);
    cab.position.set(cx, 0.0033, -0.044);
    rootGroup.add(cab);

    for (let d = 0; d < 4; d++) {
      const handle = new THREE.Mesh(drawerGeo, chromeMat);
      handle.position.set(cx, 0.0002 + d * 0.0022, -0.044);
      rootGroup.add(handle);
    }
  }

  // 5. Spare Slick Tire Racks (Left & Right Pit Corners)
  const slickTireGeo = new THREE.CylinderGeometry(0.0036, 0.0036, 0.0026, 20);
  slickTireGeo.rotateZ(Math.PI / 2);
  const slickRimGeo = new THREE.CylinderGeometry(0.0022, 0.0022, 0.0028, 16);
  slickRimGeo.rotateZ(Math.PI / 2);

  for (const side of [-1, 1]) {
    for (let t = 0; t < 3; t++) {
      const tx = side * (0.046 - t * 0.0032);
      const tz = -0.032 + t * 0.0055;
      const tire = new THREE.Mesh(slickTireGeo, tireRubberMat);
      tire.position.set(tx, 0.0014, tz);
      tire.rotation.y = side * -0.42;
      const rim = new THREE.Mesh(slickRimGeo, chromeMat);
      rim.position.copy(tire.position);
      rim.rotation.copy(tire.rotation);
      rootGroup.add(tire, rim);
    }
  }

  // 6. Center Rear Pit-Wall Illuminated Motorsport Emblem Banner
  const bannerBacking = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.012, 0.0015),
    darkSteelMat
  );
  bannerBacking.position.set(0.0, 0.026, -0.049);
  rootGroup.add(bannerBacking);

  const bannerFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.0275, 0.0132, 0.0008),
    stripMatCyan
  );
  bannerFrame.position.set(0.0, 0.026, -0.0495);
  rootGroup.add(bannerFrame);

  function update(elapsedTime) {
    const pulse = 0.88 + 0.12 * Math.sin(elapsedTime * 2.4);
    stripMatCyan.color.setRGB(0.0, 0.89 * pulse, 1.0 * pulse);
  }

  return {
    rootGroup,
    update,
  };
}
