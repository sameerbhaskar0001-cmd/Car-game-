import * as THREE from 'three';
import { getPitGarageTextures } from './ProceduralTextures.js';

/**
 * Generates a Premium Dark Obsidian / Black Supercar Warehouse Hexagon LED Wall texture.
 * Deep charcoal-black recessed honeycomb cells with razor-sharp glowing LED hex tube outlines
 * and a soft slate silhouette halo behind the car so both bright AND stealth-black cars pop
 * without any harsh white glare on the eyes.
 */
function createHexagonLightWallTexture() {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Deep obsidian black warehouse backing
  const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
  bgGrad.addColorStop(0, '#070a10');
  bgGrad.addColorStop(0.5, '#0d131f');
  bgGrad.addColorStop(1, '#06090e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, w, h);

  // Subtle dark-slate silhouette halo behind the car (so even stealth-black cars like Le Mans LMP-X pop!)
  const radGlow = ctx.createRadialGradient(w * 0.5, h * 0.54, 24, w * 0.5, h * 0.54, w * 0.48);
  radGlow.addColorStop(0.0, 'rgba(56, 78, 110, 0.48)');
  radGlow.addColorStop(0.48, 'rgba(30, 44, 66, 0.30)');
  radGlow.addColorStop(0.82, 'rgba(15, 23, 36, 0.12)');
  radGlow.addColorStop(1.0, 'rgba(7, 10, 16, 0.0)');
  ctx.fillStyle = radGlow;
  ctx.fillRect(0, 0, w, h);

  // Draw dark recessed carbon honeycomb cells + crisp glowing LED hex tube outlines
  const radius = 36;
  const hexH = Math.sqrt(3) * radius;
  const dx = radius * 1.5;
  const dy = hexH;

  for (let col = -1; col < Math.ceil(w / dx) + 2; col++) {
    for (let row = -1; row < Math.ceil(h / dy) + 2; row++) {
      const cx = col * dx;
      const cy = row * dy + (col % 2 !== 0 ? dy * 0.5 : 0);

      const nx = (cx - w * 0.5) / (w * 0.55);
      const ny = (cy - h * 0.48) / (h * 0.62);
      const d = Math.min(1.0, Math.sqrt(nx * nx + ny * ny));
      const lum = Math.max(0.18, 1.0 - d * 0.72);

      // Inner dark matte acoustic warehouse cell
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i;
        const px = cx + Math.cos(ang) * (radius - 4.8);
        const py = cy + Math.sin(ang) * (radius - 4.8);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();

      const cellGrad = ctx.createRadialGradient(cx, cy, 3, cx, cy, radius - 4);
      const baseR = Math.round(14 + 18 * lum);
      const baseG = Math.round(20 + 26 * lum);
      const baseB = Math.round(30 + 38 * lum);
      cellGrad.addColorStop(0.0, `rgb(${baseR + 6}, ${baseG + 8}, ${baseB + 12})`);
      cellGrad.addColorStop(0.8, `rgb(${baseR}, ${baseG}, ${baseB})`);
      cellGrad.addColorStop(1.0, '#070a10');
      ctx.fillStyle = cellGrad;
      ctx.fill();

      // Razor-thin glowing Ice-Cyan / Warm-Platinum LED hexagon tube rim inside each cell
      ctx.lineWidth = 2.2;
      const ledAlpha = (0.28 + 0.64 * lum).toFixed(2);
      ctx.strokeStyle = `rgba(165, 228, 255, ${ledAlpha})`;
      ctx.stroke();

      // Heavy black structural steel frame separating cells
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i;
        const px = cx + Math.cos(ang) * (radius - 1.2);
        const py = cy + Math.sin(ang) * (radius - 1.2);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.lineWidth = 4.2;
      ctx.strokeStyle = 'rgba(8, 11, 18, 0.96)';
      ctx.stroke();
    }
  }

  // Dark steel horizontal warehouse truss beam near bottom
  ctx.fillStyle = '#070a11';
  ctx.fillRect(0, h - 24, w, 24);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Generates dark obsidian industrial warehouse ribbed steel & carbon-slate side-wall panels
 * with subtle architectural registration marks and deep vertical structural shadow seams.
 */
function createStudioPanelWallTexture() {
  const w = 512;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, '#161f2e');
  grad.addColorStop(0.5, '#101723');
  grad.addColorStop(1, '#090d15');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Industrial vertical corrugated warehouse steel ribbing
  for (let x = 0; x < w; x += 32) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    ctx.fillRect(x, 0, 10, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fillRect(x + 16, 0, 8, h);
  }

  // Subtle precision "+" registration marks
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.lineWidth = 1.5;
  for (let y = 48; y < h; y += 96) {
    for (let x = 48; x < w; x += 96) {
      ctx.beginPath();
      ctx.moveTo(x - 5, y);
      ctx.lineTo(x + 5, y);
      ctx.moveTo(x, y - 5);
      ctx.lineTo(x, y + 5);
      ctx.stroke();
    }
  }

  // Heavy black vertical steel I-beam seam lines dividing panels
  ctx.fillStyle = '#06080d';
  ctx.fillRect(0, 0, 8, h);
  ctx.fillRect(w * 0.5 - 4, 0, 8, h);
  ctx.fillRect(w - 8, 0, 8, h);

  // Horizontal base steel kick-plate
  ctx.fillStyle = '#070a10';
  ctx.fillRect(0, h - 40, w, 40);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(2, 1);
  tex.anisotropy = 8;
  return tex;
}

/**
 * Generates dark satin charcoal-slate epoxy warehouse floor graphics with subtle cyan bay rings.
 */
function createStudioFloorMarkingsTexture() {
  const s = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = s;
  canvas.height = s;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Dark satin charcoal-slate warehouse floor with soft spotlight pool around the turntable
  const floorGrad = ctx.createRadialGradient(s * 0.5, s * 0.5, 40, s * 0.5, s * 0.5, s * 0.56);
  floorGrad.addColorStop(0.0, '#253142');
  floorGrad.addColorStop(0.45, '#192230');
  floorGrad.addColorStop(0.78, '#101622');
  floorGrad.addColorStop(1.0, '#080b12');
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, 0, s, s);

  // Subtle dark polished epoxy expansion slab joints
  ctx.strokeStyle = 'rgba(5, 8, 14, 0.55)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 8; i++) {
    const p = (s / 8) * i;
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, s);
    ctx.moveTo(0, p);
    ctx.lineTo(s, p);
    ctx.stroke();
  }

  // Minimalist warehouse turntable target rings & crisp architectural hash ticks
  ctx.save();
  ctx.translate(s * 0.5, s * 0.5);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.20)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 210, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 14]);
  ctx.beginPath();
  ctx.arc(0, 0, 255, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(148, 163, 184, 0.14)';
  ctx.font = '900 italic 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('BLACK BAY // 01', 0, 298);
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/**
 * Builds a Premium Dark Obsidian / Black Supercar Warehouse Studio surrounding the central turntable.
 */
export function buildPitLaneGarage(scene, centerPos = new THREE.Vector3(0.0, 0.088, 0.22)) {
  const rootGroup = new THREE.Group();
  rootGroup.name = 'PitLaneGarageShowroomGroup';
  rootGroup.position.copy(centerPos);
  scene.add(rootGroup);

  const { concreteFloorTex } = getPitGarageTextures();
  if (concreteFloorTex) {
    concreteFloorTex.repeat.set(4, 4);
  }

  const hexWallTex = createHexagonLightWallTexture();
  const sidePanelTex = createStudioPanelWallTexture();
  const studioFloorTex = createStudioFloorMarkingsTexture();

  // ---------------------------------------------------------------------------
  // 1. DARK SATIN CHARCOAL-SLATE EPOXY WAREHOUSE FLOOR
  // ---------------------------------------------------------------------------
  const floorGeo = new THREE.PlaneGeometry(0.32, 0.28);
  const floorMat = new THREE.MeshPhysicalMaterial({
    map: studioFloorTex || concreteFloorTex,
    color: 0x94a3b8,
    roughness: 0.24,
    metalness: 0.25,
    clearcoat: 0.55,
    clearcoatRoughness: 0.20,
    reflectivity: 0.80,
    envMapIntensity: 0.78,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.set(0.0, -0.0022, -0.006);
  floorMesh.receiveShadow = true;
  rootGroup.add(floorMesh);

  // Dark warehouse architectural materials
  const brushedTitaniumMat = new THREE.MeshStandardMaterial({
    color: 0x263142,
    roughness: 0.26,
    metalness: 0.86,
    envMapIntensity: 1.15,
  });
  const charcoalFrameMat = new THREE.MeshStandardMaterial({
    color: 0x0b0f17,
    roughness: 0.38,
    metalness: 0.62,
    envMapIntensity: 0.75,
  });
  const sidePanelMat = new THREE.MeshStandardMaterial({
    map: sidePanelTex,
    color: 0x94a3b8,
    roughness: 0.44,
    metalness: 0.34,
    envMapIntensity: 0.72,
  });

  // Dark Obsidian Hex LED Wall material (crisp glowing hex tubes on deep black honeycomb, easy on the eyes!)
  const hexWallMat = new THREE.MeshStandardMaterial({
    map: hexWallTex,
    emissiveMap: hexWallTex,
    emissive: new THREE.Color(0x93c5fd),
    emissiveIntensity: 0.48,
    roughness: 0.34,
    metalness: 0.24,
    toneMapped: true,
  });

  // Studio accent LED strips (soft warm-white softbox + electric cyan + subtle amber-violet)
  const studioWhiteLedMat = new THREE.MeshBasicMaterial({
    color: 0xe2e8f0,
    toneMapped: true,
  });
  const cyanAccentLedMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    toneMapped: true,
  });
  const violetAccentLedMat = new THREE.MeshBasicMaterial({
    color: 0xa78bfa,
    toneMapped: true,
  });

  // ---------------------------------------------------------------------------
  // 2. ICONIC BACKLIT HEXAGON LIGHT WALL + ARCHITECTURAL STUDIO WINGS
  // ---------------------------------------------------------------------------
  // Main Backlit Hexagon Light Wall (Asphalt 9 FXX-K showroom centerpiece)
  const hexBackWall = new THREE.Mesh(new THREE.PlaneGeometry(0.118, 0.056), hexWallMat);
  hexBackWall.position.set(0.0, 0.025, -0.052);
  rootGroup.add(hexBackWall);

  // Sleek dark steel horizontal framing beams top & bottom of the hex light wall
  const rearTopBeam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.0045, 0.006), charcoalFrameMat);
  rearTopBeam.position.set(0.0, 0.0515, -0.050);
  rootGroup.add(rearTopBeam);

  const rearBasePlinth = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.0042, 0.009),
    charcoalFrameMat
  );
  rearBasePlinth.position.set(0.0, -0.0002, -0.049);
  rootGroup.add(rearBasePlinth);

  // Crisp studio cove light strip running along the floor-wall junction (highlights car rear silhouette)
  const rearBaseLed = new THREE.Mesh(
    new THREE.BoxGeometry(0.122, 0.00055, 0.0008),
    studioWhiteLedMat
  );
  rearBaseLed.position.set(0.0, 0.0021, -0.0442);
  rootGroup.add(rearBaseLed);

  // Angled Architectural Side Studio Walls (Brushed Perforated Light Concrete/Aluminum Panels!)
  const wingGeo = new THREE.BoxGeometry(0.095, 0.072, 0.004);
  const leftWing = new THREE.Mesh(wingGeo, sidePanelMat);
  leftWing.position.set(-0.076, 0.032, -0.018);
  leftWing.rotation.y = Math.PI * 0.34;

  const rightWing = new THREE.Mesh(wingGeo, sidePanelMat);
  rightWing.position.set(0.076, 0.032, -0.018);
  rightWing.rotation.y = -Math.PI * 0.34;
  rootGroup.add(leftWing, rightWing);

  // Architectural Framing Columns separating the central Hex Light Wall from the brushed side wings
  const colOuterGeo = new THREE.BoxGeometry(0.0048, 0.072, 0.0065);
  const colTrimGeo = new THREE.BoxGeometry(0.0012, 0.072, 0.0072);
  const colSlitGeo = new THREE.BoxGeometry(0.00065, 0.054, 0.0008);

  for (const px of [-0.056, 0.056]) {
    const col = new THREE.Mesh(colOuterGeo, charcoalFrameMat);
    col.position.set(px, 0.032, -0.0495);
    rootGroup.add(col);

    const trim = new THREE.Mesh(colTrimGeo, brushedTitaniumMat);
    trim.position.set(px + (px < 0 ? 0.0024 : -0.0024), 0.032, -0.0492);
    rootGroup.add(trim);

    // Subtle Asphalt Legends Unite color-temperature studio accents (cyan left, cool violet right)
    const slit = new THREE.Mesh(colSlitGeo, px < 0 ? cyanAccentLedMat : violetAccentLedMat);
    slit.position.set(px, 0.028, -0.0458);
    rootGroup.add(slit);
  }

  // Diagonal architectural light ribs on the side studio wings (clean modern showcase depth)
  const sideRibGeo = new THREE.BoxGeometry(0.0018, 0.068, 0.0036);
  const sideLedGeo = new THREE.BoxGeometry(0.0006, 0.046, 0.0008);
  for (const side of [-1, 1]) {
    for (let r = 0; r < 2; r++) {
      const dist = 0.062 + r * 0.015;
      const rz = -0.032 + r * 0.020;
      const rib = new THREE.Mesh(sideRibGeo, charcoalFrameMat);
      rib.position.set(side * dist, 0.031, rz);
      rib.rotation.y = side * -Math.PI * 0.34;
      rootGroup.add(rib);

      if (r === 0) {
        const sLed = new THREE.Mesh(sideLedGeo, side < 0 ? cyanAccentLedMat : violetAccentLedMat);
        sLed.position.set(side * (dist - 0.0014), 0.029, rz + 0.0012);
        sLed.rotation.y = side * -Math.PI * 0.34;
        rootGroup.add(sLed);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // 3. STUDIO OVERHEAD SKYLIGHT COFFER CEILING & LARGE PHOTOGRAPHY SOFTBOXES
  // ---------------------------------------------------------------------------
  const ceilingDeck = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.004, 0.105), charcoalFrameMat);
  ceilingDeck.position.set(0.0, 0.055, -0.012);
  rootGroup.add(ceilingDeck);

  // Structural studio ceiling beams
  const beamGeo = new THREE.BoxGeometry(0.14, 0.0020, 0.0024);
  for (const bz of [-0.036, -0.016, 0.004, 0.024]) {
    const beam = new THREE.Mesh(beamGeo, brushedTitaniumMat);
    beam.position.set(0.0, 0.0528, bz);
    rootGroup.add(beam);
  }

  // Wide Overhead Photography Studio Softbox Skylight Panels (creates authentic Asphalt roofline streaks!)
  const softboxHousingGeo = new THREE.BoxGeometry(0.052, 0.0012, 0.0068);
  const softboxLensGeo = new THREE.PlaneGeometry(0.050, 0.0056);
  for (const bz of [-0.026, -0.006, 0.014]) {
    const housing = new THREE.Mesh(softboxHousingGeo, charcoalFrameMat);
    housing.position.set(0.0, 0.0520, bz);
    rootGroup.add(housing);

    const lens = new THREE.Mesh(softboxLensGeo, studioWhiteLedMat);
    lens.rotation.x = Math.PI / 2;
    lens.position.set(0.0, 0.0513, bz);
    rootGroup.add(lens);
  }

  // Balanced Studio Ceiling Wash + Subtle Legends Unite Cool-Cyan / Soft-Violet Side Bounce
  const bayCeilingLight = new THREE.PointLight(0xf8fafc, 0.24, 0.28, 1.4);
  bayCeilingLight.position.set(0.0, 0.048, 0.010);
  rootGroup.add(bayCeilingLight);

  const leftCyanBounce = new THREE.PointLight(0x7dd3fc, 0.14, 0.16, 1.6);
  leftCyanBounce.position.set(-0.045, 0.022, -0.018);
  rootGroup.add(leftCyanBounce);

  const rightVioletBounce = new THREE.PointLight(0xc4b5fd, 0.11, 0.16, 1.6);
  rightVioletBounce.position.set(0.045, 0.022, -0.018);
  rootGroup.add(rightVioletBounce);

  function update(elapsedTime) {
    // Ultra-subtle studio accent breathing (never distracting or flickering)
    const cyanPulse = 0.93 + 0.07 * Math.sin(elapsedTime * 1.4);
    cyanAccentLedMat.color.setRGB(0.22 * cyanPulse, 0.74 * cyanPulse, 0.98 * cyanPulse);
    const vioPulse = 0.93 + 0.07 * Math.cos(elapsedTime * 1.2);
    violetAccentLedMat.color.setRGB(0.65 * vioPulse, 0.55 * vioPulse, 0.98 * vioPulse);
  }

  return {
    rootGroup,
    update,
  };
}
