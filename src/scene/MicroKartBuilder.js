import * as THREE from 'three';

/**
 * Builds the 1:87 HO Micro-Coaster Racing Go-Kart (18mm x 12mm x 8mm)
 * with 4 steerable/spinning wheels, helmeted driver, steering wheel,
 * twin turbo exhaust flames, headlights, and a 120-particle drift spark emitter.
 */
export function buildMicroKart() {
  const kartRoot = new THREE.Group();
  kartRoot.name = 'Kart1to87Root';

  // Inner suspension/drift yaw-roll body group
  const chassisGroup = new THREE.Group();
  chassisGroup.name = 'KartChassisBody';
  kartRoot.add(chassisGroup);

  const redFairingMat = new THREE.MeshStandardMaterial({
    color: 0xff2b1e,
    roughness: 0.22,
    metalness: 0.35,
  });

  const whiteStripeMat = new THREE.MeshStandardMaterial({
    color: 0xf7f9fc,
    roughness: 0.25,
    metalness: 0.1,
  });

  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x181b22,
    roughness: 0.42,
    metalness: 0.45,
  });

  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xdce4f0,
    roughness: 0.15,
    metalness: 0.92,
  });

  const goldRimMat = new THREE.MeshStandardMaterial({
    color: 0xffbb44,
    roughness: 0.25,
    metalness: 0.85,
  });

  const tireRubberMat = new THREE.MeshStandardMaterial({
    color: 0x121419,
    roughness: 0.82,
    metalness: 0.05,
  });

  // Soft multi-layered local contact-shadow decal directly under the kart chassis & 4 tires
  // Positioned at Y = 0.00072m (0.42mm in 0.58x world space) with polygonOffset -8 so it always
  // renders cleanly above the crowned CoasterRoadwayMesh surface without depth-buffer occlusion.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d');
  sCtx.clearRect(0, 0, 256, 256);

  // 1. Wide soft ambient-occlusion penumbra across the entire kart footprint
  sCtx.save();
  sCtx.translate(128, 128);
  sCtx.scale(0.86, 1.08);
  const penumbraGrad = sCtx.createRadialGradient(0, 0, 14, 0, 0, 112);
  penumbraGrad.addColorStop(0.0, 'rgba(2, 2, 5, 0.92)');
  penumbraGrad.addColorStop(0.48, 'rgba(3, 3, 7, 0.76)');
  penumbraGrad.addColorStop(0.76, 'rgba(5, 5, 10, 0.34)');
  penumbraGrad.addColorStop(1.0, 'rgba(6, 6, 12, 0.0)');
  sCtx.fillStyle = penumbraGrad;
  sCtx.beginPath();
  sCtx.arc(0, 0, 112, 0, Math.PI * 2);
  sCtx.fill();
  sCtx.restore();

  // 2. Deep under-chassis floorpan, nose splitter & rear diffuser umbra core
  sCtx.save();
  sCtx.translate(128, 128);
  sCtx.scale(0.58, 0.92);
  const coreGrad = sCtx.createRadialGradient(0, 0, 10, 0, 0, 96);
  coreGrad.addColorStop(0.0, 'rgba(1, 1, 3, 0.96)');
  coreGrad.addColorStop(0.62, 'rgba(2, 2, 5, 0.88)');
  coreGrad.addColorStop(0.88, 'rgba(4, 4, 8, 0.38)');
  coreGrad.addColorStop(1.0, 'rgba(4, 4, 8, 0.0)');
  sCtx.fillStyle = coreGrad;
  sCtx.beginPath();
  sCtx.arc(0, 0, 96, 0, Math.PI * 2);
  sCtx.fill();
  sCtx.restore();

  // 3. Four dark elliptical wheel-contact shadow blobs at (±0.32, ±0.28) in UV space
  for (const [wx, wz] of [
    [-0.28, -0.22],
    [+0.28, -0.22],
    [-0.28, +0.23],
    [+0.28, +0.23],
  ]) {
    const cx = 128 + wx * 256;
    const cy = 128 + wz * 256;
    sCtx.save();
    sCtx.translate(cx, cy);
    sCtx.scale(0.82, 1.28);
    const wGrad = sCtx.createRadialGradient(0, 0, 4, 0, 0, 34);
    wGrad.addColorStop(0.0, 'rgba(1, 1, 3, 0.95)');
    wGrad.addColorStop(0.55, 'rgba(2, 2, 5, 0.72)');
    wGrad.addColorStop(1.0, 'rgba(4, 4, 8, 0.0)');
    sCtx.fillStyle = wGrad;
    sCtx.beginPath();
    sCtx.arc(0, 0, 34, 0, Math.PI * 2);
    sCtx.fill();
    sCtx.restore();
  }

  const kartShadowTex = new THREE.CanvasTexture(shadowCanvas);
  const kartShadowQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(0.0175, 0.0240),
    new THREE.MeshBasicMaterial({
      map: kartShadowTex,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -8,
      polygonOffsetUnits: -8,
    })
  );
  kartShadowQuad.rotation.x = -Math.PI / 2;
  kartShadowQuad.position.set(0, 0.00072, -0.0002);
  kartShadowQuad.castShadow = false;
  kartShadowQuad.receiveShadow = false;
  kartRoot.add(kartShadowQuad);

  // -------------------------------------------------------------------------
  // 1. FLOOR PAN, TUBULAR FRAME, NOSE CONE & SIDE PODS (18mm long x 12mm wide)
  //    Kart local forward is +Z (aligned with spline tangent)
  // -------------------------------------------------------------------------
  const floorPan = new THREE.Mesh(
    new THREE.BoxGeometry(0.0082, 0.0009, 0.0155),
    carbonMat
  );
  floorPan.position.set(0, 0.0014, 0);
  floorPan.castShadow = false;
  chassisGroup.add(floorPan);

  // Front aerodynamic nose fairing (+Z front)
  const noseCone = new THREE.Mesh(
    new THREE.BoxGeometry(0.0086, 0.0021, 0.0044),
    redFairingMat
  );
  noseCone.position.set(0, 0.0023, 0.0068);
  noseCone.rotation.x = 0.22;
  noseCone.castShadow = false;
  chassisGroup.add(noseCone);

  // White #87 Nose Number Plate
  const numberPlate = new THREE.Mesh(
    new THREE.BoxGeometry(0.0048, 0.0004, 0.0028),
    whiteStripeMat
  );
  numberPlate.position.set(0, 0.0033, 0.0066);
  numberPlate.rotation.x = 0.22;
  chassisGroup.add(numberPlate);

  // Left & Right Side Pods
  for (const sx of [-0.0044, 0.0044]) {
    const sidePod = new THREE.Mesh(
      new THREE.BoxGeometry(0.0024, 0.0024, 0.0076),
      redFairingMat
    );
    sidePod.position.set(sx, 0.0024, -0.0004);
    sidePod.castShadow = false;
    chassisGroup.add(sidePod);
  }

  // Rear Engine Block (right-rear kart motor + cooling fins) & Rear Wing
  const engineBlock = new THREE.Mesh(
    new THREE.BoxGeometry(0.0034, 0.0036, 0.0042),
    chromeMat
  );
  engineBlock.position.set(0.0022, 0.0036, -0.0048);
  engineBlock.castShadow = false;
  chassisGroup.add(engineBlock);

  const rearWing = new THREE.Mesh(
    new THREE.BoxGeometry(0.0096, 0.0007, 0.0024),
    carbonMat
  );
  rearWing.position.set(0, 0.0068, -0.0076);
  rearWing.rotation.x = -0.18;
  rearWing.castShadow = false;
  chassisGroup.add(rearWing);

  // Twin Rear Exhaust Pipes + Realistic Volumetric Mach-Diamond Afterburner Jet
  // Plumes (Zero FPS impact!)
  function createExhaustFlameMaterial(pipePhase) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: {value: 0.0},
        uIntensity: {value: 1.0},
        uPhase: {value: pipePhase},
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      vertexShader: /* glsl */ `
        uniform float uTime;
        uniform float uPhase;
        varying float vPlumeU;
        varying float vRadialR;
        varying vec3 vLocalPos;
        varying vec3 vViewNormal;
        varying vec3 vViewPos;
        void main() {
          // Local coordinates: nozzle exit is at z = 0, jet extends backward along -Z to z = -0.0052
          float u = clamp(-position.z / 0.0052, 0.0, 1.0);
          vPlumeU = u;
          vRadialR = clamp(length(position.xy) / 0.00078, 0.0, 1.0);
          vLocalPos = position;

          // High-frequency turbulent jet flutter along the tail (zero displacement at nozzle u=0)
          float flutter = u * u * 0.00022;
          vec3 displaced = position;
          displaced.x += sin(u * 18.0 - uTime * 48.0 + uPhase) * flutter;
          displaced.y += cos(u * 15.0 - uTime * 42.0 + uPhase * 1.7) * flutter * 0.85;

          vec4 mvPos = modelViewMatrix * vec4(displaced, 1.0);
          vViewPos = -mvPos.xyz;
          vViewNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform float uIntensity;
        uniform float uPhase;
        varying float vPlumeU;
        varying float vRadialR;
        varying vec3 vLocalPos;
        varying vec3 vViewNormal;
        varying vec3 vViewPos;
        void main() {
          float u = clamp(vPlumeU, 0.0, 1.0);

          // Coaxial-safe radial core falloff so the flame stays vivid from 1P Chase Cam directly behind the car
          // while still having a soft Gaussian outer edge with zero hard cone/egg silhouette
          vec3 viewDir = normalize(vViewPos);
          float ndotv = abs(dot(normalize(vViewNormal), viewDir));
          float viewWeight = 0.58 + 0.42 * sqrt(clamp(ndotv, 0.0, 1.0));
          float radialCore = exp(-vRadialR * vRadialR * (2.1 + u * 2.4));
          float radialMask = radialCore * viewWeight;

          // High-frequency advected combustion turbulence & Mach shock diamonds
          float angle = atan(vLocalPos.y, vLocalPos.x);
          float turb1 = sin(u * 22.0 - uTime * 56.0 + angle * 2.0 + uPhase);
          float turb2 = cos(u * 35.0 - uTime * 74.0 - angle * 3.0 + uPhase * 1.3);
          float turbulence = 0.82 + 0.18 * (turb1 * 0.6 + turb2 * 0.4);

          // Crisp internal Mach shock diamond nodes near the nozzle & mid-plume
          float machWave = max(0.0, cos(u * 15.5 - uTime * 34.0 + uPhase * 0.5));
          float machDiamond = pow(machWave, 3.2) * smoothstep(0.85, 0.04, u) * exp(-vRadialR * vRadialR * 3.6);

          // Longitudinal envelope: bright inside the nozzle bore (u=0) with shredded flame tongues at the tip
          float tipCut = clamp(1.0 - u + (turb1 * 0.11 + turb2 * 0.07) * u, 0.0, 1.0);
          float axialEnv = (0.35 + 0.65 * smoothstep(0.0, 0.08, u)) * pow(tipCut, 1.45);

          // Physically inspired motorsport exhaust temperature gradient:
          // 1. Nozzle ring (u = 0..0.22): hot butane-blue plasma + white-yellow Mach core
          // 2. Mid-plume (u = 0.18..0.68): luminous golden-amber afterburner fire
          // 3. Outer sheath & tail (u = 0.48..1.0): rich fiery orange-red
          vec3 butaneBlue = vec3(0.32, 0.76, 1.35);
          vec3 whiteHot = vec3(1.55, 1.38, 0.96);
          vec3 goldenAmber = vec3(1.45, 0.68, 0.12);
          vec3 fieryCrimson = vec3(1.25, 0.22, 0.02);

          vec3 baseCol = mix(butaneBlue, goldenAmber, smoothstep(0.04, 0.34, u));
          baseCol = mix(baseCol, fieryCrimson, smoothstep(0.38, 0.86, u));
          float coreHotness = clamp(radialCore * (1.0 - u * 0.52) + machDiamond * 0.90, 0.0, 1.0);
          vec3 flameRgb = mix(baseCol, whiteHot, pow(coreHotness, 1.35));

          float alpha = clamp(axialEnv * radialMask * turbulence * uIntensity * 1.45, 0.0, 1.0);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(flameRgb * alpha * 1.35, alpha);
        }
      `,
    });
  }

  // Build multi-layered open-ended jet cone + crossed axial flame fins + nozzle
  // bore glow disc
  function buildExhaustJetGeometry() {
    // 1. Outer tapered open-ended cone from z = 0 (r = 0.72mm) to z = -5.2mm (r
    // = 0.22mm)
    const outerCone =
        new THREE.CylinderGeometry(0.00072, 0.00022, 0.0052, 16, 8, true);
    outerCone.rotateX(Math.PI / 2);
    outerCone.translate(0, 0, -0.0026);

    // 2. Inner high-velocity Mach core tube from z = 0 (r = 0.46mm) to z =
    // -4.0mm (r = 0.12mm)
    const innerCore =
        new THREE.CylinderGeometry(0.00046, 0.00012, 0.0040, 14, 6, true);
    innerCore.rotateX(Math.PI / 2);
    innerCore.translate(0, 0, -0.0020);

    // 3. Crossed longitudinal flame fins (+38 deg and -38 deg) so the jet is
    // lush from every angle
    const finA = new THREE.PlaneGeometry(0.00145, 0.0050, 1, 6);
    finA.rotateX(Math.PI / 2);
    finA.rotateZ(0.66);
    finA.translate(0, 0, -0.0025);

    const finB = new THREE.PlaneGeometry(0.00145, 0.0050, 1, 6);
    finB.rotateX(Math.PI / 2);
    finB.rotateZ(-0.66);
    finB.translate(0, 0, -0.0025);

    // 4. Head-on nozzle bore glow disc at z = -0.00025 facing -Z (directly
    // toward 1P Chase Cam!)
    const nozzleDisc = new THREE.CircleGeometry(0.00074, 16);
    nozzleDisc.rotateY(Math.PI);
    nozzleDisc.translate(0, 0, -0.00025);

    return {outerCone, innerCore, finA, finB, nozzleDisc};
  }
  const sharedJetGeos = buildExhaustJetGeometry();

  const flameCones = [];
  for (let i = 0; i < 2; i++) {
    const ex = i === 0 ? -0.00108 : 0.00108;
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.00056, 0.00062, 0.0032, 16),
      chromeMat
    );
    pipe.rotation.x = Math.PI / 2 + 0.12;
    pipe.position.set(ex, 0.00215, -0.0076);
    chassisGroup.add(pipe);

    const plumeGroup = new THREE.Group();
    // Anchor right inside the hollow grey/aluminium muffler bore exit and angle
    // slightly upward (+0.18 rad) to match the upswept hot-rod muffler tips so
    // the flames shoot cleanly out of the barrels in 1P Chase Cam
    plumeGroup.position.set(ex, 0.00208, -0.00895);
    plumeGroup.rotation.x = 0.18;
    plumeGroup.visible = false;

    const jetMat = createExhaustFlameMaterial(i * 2.15);
    for (const geo
             of [sharedJetGeos.outerCone,
                 sharedJetGeos.innerCore,
                 sharedJetGeos.finA,
                 sharedJetGeos.finB,
                 sharedJetGeos.nozzleDisc,
    ]) {
      const m = new THREE.Mesh(geo, jetMat);
      m.frustumCulled = false;
      plumeGroup.add(m);
    }

    plumeGroup.userData.jetMat = jetMat;
    plumeGroup.userData.pipeIndex = i;
    chassisGroup.add(plumeGroup);
    flameCones.push(plumeGroup);
  }

  // Soft additive ruby-red tail-light optical glow halo planes (tailGlowL & tailGlowR)
  // Positioned directly in front of the left & right 2x3 tail-light clusters so the rear lamps
  // emit a true ruby-red optical bloom halo instead of looking like flat orange rectangles.
  const tailGlowCanvas = document.createElement('canvas');
  tailGlowCanvas.width = 128;
  tailGlowCanvas.height = 128;
  const tgCtx = tailGlowCanvas.getContext('2d');
  const tgGrad = tgCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  tgGrad.addColorStop(0.0, 'rgba(255, 10, 34, 0.88)');
  tgGrad.addColorStop(0.32, 'rgba(255, 0, 24, 0.56)');
  tgGrad.addColorStop(0.68, 'rgba(220, 0, 18, 0.20)');
  tgGrad.addColorStop(1.0, 'rgba(180, 0, 12, 0.0)');
  tgCtx.fillStyle = tgGrad;
  tgCtx.fillRect(0, 0, 128, 128);
  const tailGlowTex = new THREE.CanvasTexture(tailGlowCanvas);

  const tailGlowGeo = new THREE.PlaneGeometry(0.0038, 0.0024);
  const tailGlowMat = new THREE.MeshBasicMaterial({
    map: tailGlowTex,
    transparent: true,
    opacity: 0.90,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });
  const tailLightGlowPlanes = [];
  for (const tx of [-0.00320, 0.00320]) {
    const tailGlowPlane = new THREE.Mesh(tailGlowGeo, tailGlowMat);
    tailGlowPlane.position.set(tx, 0.00275, -0.00906);
    tailGlowPlane.rotation.y = Math.PI;
    tailGlowPlane.castShadow = false;
    tailGlowPlane.receiveShadow = false;
    chassisGroup.add(tailGlowPlane);
    tailLightGlowPlanes.push(tailGlowPlane);
  }

  // Warm flickering fire light under rear exhaust/tires when sparks emit
  // Controlled by the "Fire Downcast Light" slider in Settings (default 0.12x for subtle realism)
  const sparkFireLight = new THREE.PointLight(0xff6818, 0.0, 0.045, 0.0);
  sparkFireLight.position.set(0, 0.0028, -0.009);
  chassisGroup.add(sparkFireLight);

  let fireLightMultiplier = 0.12;
  let fireLightPreviewTimer = 0.0;
  function setFireLightMultiplier(val, triggerPreview = true) {
    fireLightMultiplier = Math.max(0.0, Number(val) || 0.0);
    if (triggerPreview) {
      fireLightPreviewTimer = 0.85;
    }
  }

  // -------------------------------------------------------------------------
  // 2. 1:87 HELMETED DRIVER + STEERING WHEEL
  // -------------------------------------------------------------------------
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(0.0042, 0.0044, 0.0038),
    carbonMat
  );
  seat.position.set(0, 0.0036, -0.0015);
  seat.rotation.x = -0.22;
  chassisGroup.add(seat);

  // Driver Torso in Pearl White & Electric Blue Racing Suit
  const suitMat = new THREE.MeshStandardMaterial({
    color: 0xf0f4fa,
    roughness: 0.35,
    metalness: 0.08,
  });
  const torso = new THREE.Mesh(
    new THREE.BoxGeometry(0.0036, 0.0038, 0.0028),
    suitMat
  );
  torso.position.set(0, 0.0048, -0.0008);
  torso.rotation.x = 0.14;
  torso.castShadow = false;
  chassisGroup.add(torso);

  // Articulated Driver Helmet Group (tilts into corners!)
  const driverHead = new THREE.Group();
  driverHead.position.set(0, 0.0078, -0.0004);

  const helmetShell = new THREE.Mesh(
    new THREE.SphereGeometry(0.0022, 20, 18),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.14,
      metalness: 0.25,
    })
  );
  helmetShell.scale.set(0.95, 1.0, 1.08);
  helmetShell.castShadow = false;
  driverHead.add(helmetShell);

  // Iridescent Gold/Blue Visor
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(0.00225, 16, 12, -0.9, 1.8, 1.05, 0.75),
    new THREE.MeshStandardMaterial({
      color: 0x1e6bff,
      emissive: new THREE.Color(0x1e6bff),
      emissiveIntensity: 0.65,
      roughness: 0.08,
      metalness: 0.9,
    })
  );
  visor.rotation.y = Math.PI / 2;
  driverHead.add(visor);
  chassisGroup.add(driverHead);

  // Steering Column & Rotating Steering Wheel
  const steeringWheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.0014, 0.00032, 8, 18),
    carbonMat
  );
  steeringWheel.position.set(0, 0.0054, 0.0028);
  steeringWheel.rotation.x = -0.55;
  chassisGroup.add(steeringWheel);

  // -------------------------------------------------------------------------
  // 3. 4 RUBBER SLICK WHEELS (Front Steerable Pivots + All 4 Spinning)
  // -------------------------------------------------------------------------
  const frontPivots = [];
  const wheelMeshes = [];

  function createWheelMesh(isRear = false) {
    const wRadius = isRear ? 0.00215 : 0.00185;
    const wWidth = isRear ? 0.0022 : 0.0017;
    const wGroup = new THREE.Group();

    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(wRadius, wRadius, wWidth, 20),
      tireRubberMat
    );
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = false;
    wGroup.add(tire);

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(wRadius * 0.62, wRadius * 0.62, wWidth * 1.04, 14),
      goldRimMat
    );
    rim.rotation.z = Math.PI / 2;
    wGroup.add(rim);

    return wGroup;
  }

  // Front Left & Front Right Steerable Wheels
  for (const sx of [-0.0056, 0.0056]) {
    const pivot = new THREE.Group();
    pivot.position.set(sx, 0.00185, 0.0054);
    const wheel = createWheelMesh(false);
    pivot.add(wheel);
    chassisGroup.add(pivot);
    frontPivots.push(pivot);
    wheelMeshes.push(wheel);
  }

  // Rear Left & Rear Right Drive Wheels
  for (const sx of [-0.0059, 0.0059]) {
    const wheel = createWheelMesh(true);
    wheel.position.set(sx, 0.00215, -0.0054);
    chassisGroup.add(wheel);
    wheelMeshes.push(wheel);
  }

  // -------------------------------------------------------------------------
  // 4. MICRO-KART HIGH-INTENSITY 3D LED HEADLIGHT BEAM
  // -------------------------------------------------------------------------
  const headlightTarget = new THREE.Object3D();
  headlightTarget.position.set(0, -0.008, 0.072);
  chassisGroup.add(headlightTarget);

  // Elevated 3D SpotLight origin (y = 0.016, decay = 0.0, intensity = 9.5,
  // distance = 0.22) Using decay = 0.0 prevents d^-1.25 close-range blowout at
  // millimeter scale while casting a bright warm-white xenon cone across curved
  // ramps, spirals, curbs, rails, and desk props!
  const headlight =
      new THREE.SpotLight(0xfff4dc, 9.5, 0.22, Math.PI * 0.34, 0.78, 0.0);
  headlight.position.set(0, 0.016, 0.0085);
  headlight.target = headlightTarget;
  chassisGroup.add(headlight);

  // -------------------------------------------------------------------------
  // 5. REALISTIC GLOWING FIRE SPARKS EMITTER (Zero Lines, Soft Radial Fire Glow!)
  // -------------------------------------------------------------------------
  const sparkCount = 160;
  const sparkPositions = new Float32Array(sparkCount * 3);
  const sparkColors = new Float32Array(sparkCount * 3);
  const sparkLifeAttr = new Float32Array(sparkCount); // 1.0 = fresh hot ember, 0.0 = expired
  const sparkSizes = new Float32Array(sparkCount);
  const sparkVelocities = [];
  const sparkAges = new Float32Array(sparkCount);
  const sparkMaxAges = new Float32Array(sparkCount);

  for (let i = 0; i < sparkCount; i++) {
    sparkPositions[i * 3 + 1] = -10; // hidden initially
    sparkVelocities.push(new THREE.Vector3());
    sparkAges[i] = 999;
    sparkMaxAges[i] = 0.30;
    sparkLifeAttr[i] = 0.0;
    sparkSizes[i] = 0.65 + Math.random() * 1.15;
    sparkColors[i * 3 + 0] = 1.0;
    sparkColors[i * 3 + 1] = 0.48;
    sparkColors[i * 3 + 2] = 0.08;
  }

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));
  sparkGeo.setAttribute('color', new THREE.BufferAttribute(sparkColors, 3));
  sparkGeo.setAttribute('aLife', new THREE.BufferAttribute(sparkLifeAttr, 1));
  sparkGeo.setAttribute('aSize', new THREE.BufferAttribute(sparkSizes, 1));

  const sparkMat = new THREE.ShaderMaterial({
    uniforms: {
      uSparkScale: {value: 0.58},
      tSceneDepth: {value: null},
      uNearClip: {value: 0.0015},
      uFarClip: {value: 12.0},
      uFocus: {value: 0.12},
      uAperture: {value: 0.0},
      uMaxBlur: {value: 0.0},
      uResolution: {value: new THREE.Vector2(1440, 900)},
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      uniform float uSparkScale;
      uniform float uFocus;
      uniform float uAperture;
      uniform float uMaxBlur;
      uniform vec2 uResolution;
      attribute vec3 color;
      attribute float aLife;
      attribute float aSize;
      varying vec3 vColor;
      varying float vLife;
      varying float vViewZ;
      varying float vDofFactor;
      void main() {
        vColor = color;
        vLife = aLife;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vViewZ = mvPosition.z;
        gl_Position = projectionMatrix * mvPosition;

        // Smooth ember size curve: blooms quickly then shrinks as the ember cools
        float lifeScale = smoothstep(0.0, 0.12, aLife) * (0.38 + 0.62 * pow(aLife, 0.7));
        float basePointSize = clamp((4.8 * uSparkScale * aSize * lifeScale) / max(0.05, -mvPosition.z), 0.0, 16.0);

        // Evaluate optical Depth of Field from the spark's OWN 3D view-space depth (mvPosition.z)
        // instead of the background wall behind it! Keep a generous 65mm in-focus sweet-spot around uFocus
        // so whenever the car is in focus, the entire trailing spark plume stays 100% tack-sharp.
        float rawFactor = uFocus + mvPosition.z;
        float deadzone = max(0.065, uFocus * 0.28);
        float absDiff = max(0.0, abs(rawFactor) - deadzone);
        float normScale = 1.0 / max(0.22, uFocus * 1.15);
        float cocUv = clamp(absDiff * (0.42 + 0.16 * normScale) * uAperture, 0.0, uMaxBlur);
        float cocPx = cocUv * uResolution.y * 0.50;
        vDofFactor = clamp(cocPx / max(1.0, basePointSize), 0.0, 4.0);

        gl_PointSize = aLife > 0.01 ? clamp(basePointSize + cocPx, 0.0, 26.0) : 0.0;
      }
    `,
    fragmentShader: /* glsl */ `
      #include <common>
      #include <packing>
      uniform sampler2D tSceneDepth;
      uniform float uNearClip;
      uniform float uFarClip;
      uniform vec2 uResolution;
      varying vec3 vColor;
      varying float vLife;
      varying float vViewZ;
      varying float vDofFactor;
      void main() {
        if (vLife <= 0.01) discard;
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;

        // Hardware depth occlusion against closer opaque 3D geometry (kart body, track, lamp column)
        vec2 screenUv = gl_FragCoord.xy / max(vec2(1.0), uResolution);
        float rawSceneDepth = texture2D(tSceneDepth, screenUv).x;
        float sceneViewZ = perspectiveDepthToViewZ(rawSceneDepth, uNearClip, uFarClip);
        if (sceneViewZ > vViewZ + 0.0015) discard;

        // Soft circular radial fire-ember profile:
        // When in focus (vDofFactor == 0.0), renders a razor-sharp incandescent core + tight ember glow.
        float blurLerp = clamp(vDofFactor * 0.35, 0.0, 1.0);
        float core = exp(-d * d * mix(34.0, 8.0, blurLerp));
        float midFire = exp(-d * d * mix(10.5, 4.5, blurLerp)) * smoothstep(0.5, 0.08, d);
        float outerHalo = pow(max(0.0, 1.0 - d * 2.0), mix(2.2, 1.3, blurLerp)) * 0.65;

        // Temperature color shift as the spark cools over its lifetime (white-yellow -> fiery orange -> deep ember red)
        vec3 deepEmber = vec3(0.92, 0.16, 0.02);
        vec3 midFlame = mix(deepEmber, vColor, clamp(vLife * 1.25, 0.0, 1.0));
        vec3 hotCenter = vec3(1.0, 0.96, 0.82);

        vec3 emberColor = mix(midFlame, hotCenter, clamp(core * 1.2, 0.0, 1.0));
        float energyNorm = 1.0 / (1.0 + vDofFactor * 0.85);
        // HDR intensity > 1.0 at center so UnrealBloomPass gives each spark a soft natural fire glow
        vec3 finalRgb = emberColor * (1.85 * core + 1.15 * midFire + 0.65 * outerHalo) * energyNorm;

        float alpha = clamp((core * 1.1 + midFire * 0.85 + outerHalo * 0.55) * vLife * energyNorm, 0.0, 1.0);
        if (alpha < 0.015) discard;
        gl_FragColor = vec4(finalRgb, alpha);
      }
    `,
  });

  const sparkPoints = new THREE.Points(sparkGeo, sparkMat);
  sparkPoints.frustumCulled = false;
  sparkPoints.name = 'KartDriftSparks';

  // -------------------------------------------------------------------------
  // 5B. 64-INSTANCE REAR-TIRE DRIFT SMOKE RING BUFFER (Zero-GC InstancedMesh)
  // -------------------------------------------------------------------------
  const smokeCount = 64;
  const smokeGeo = new THREE.IcosahedronGeometry(0.0014, 1);
  const smokeMat = new THREE.MeshBasicMaterial({
    color: 0xdbeafe,
    transparent: true,
    opacity: 0.36,
    depthWrite: false,
  });
  const driftSmokeMesh = new THREE.InstancedMesh(smokeGeo, smokeMat, smokeCount);
  driftSmokeMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  driftSmokeMesh.frustumCulled = false;
  driftSmokeMesh.name = 'KartDriftSmokeInstanced';

  const smokePositions = [];
  const smokeVelocities = [];
  const smokeAges = new Float32Array(smokeCount);
  const smokeMaxAges = new Float32Array(smokeCount);
  const _smokeDummy = new THREE.Object3D();
  let nextSmokeIdx = 0;
  let hadActiveSmoke = false;

  for (let i = 0; i < smokeCount; i++) {
    smokePositions.push(new THREE.Vector3(0, -10, 0));
    smokeVelocities.push(new THREE.Vector3());
    smokeAges[i] = 999;
    smokeMaxAges[i] = 0.42;
    _smokeDummy.position.set(0, -10, 0);
    _smokeDummy.scale.setScalar(0.0001);
    _smokeDummy.updateMatrix();
    driftSmokeMesh.setMatrixAt(i, _smokeDummy.matrix);
  }
  driftSmokeMesh.instanceMatrix.needsUpdate = true;

  let nextSparkIdx = 0;
  let lastWheelUpdateTime = -1;
  let hadActiveSparks = false;
  const _worldPos = new THREE.Vector3();
  const _backDir = new THREE.Vector3();
  const _spawnPos = new THREE.Vector3();

  /**
   * Spins all 4 wheels proportional to forward velocity (`speed` in m/s)
   * and steers front wheel pivots to `steerAngle` (`+0.45` for Left `A`, `-0.45` for Right `D`).
   */
  function updateWheels(dt, speed, steerAngle = 0.0) {
    const now = performance.now();
    if (Math.abs(now - lastWheelUpdateTime) < 1e-4) {
      return;
    }
    lastWheelUpdateTime = now;

    const wheelSpinDelta = (speed / 0.002) * dt;
    for (const w of wheelMeshes) {
      w.rotation.x += wheelSpinDelta;
    }

    const targetSteerRad = THREE.MathUtils.clamp(steerAngle, -0.52, 0.52);
    for (const p of frontPivots) {
      p.rotation.y = THREE.MathUtils.lerp(p.rotation.y, targetSteerRad, Math.min(1, dt * 16));
    }
    steeringWheel.rotation.z = targetSteerRad * 1.6;
    driverHead.rotation.z = -targetSteerRad * 0.45;
    driverHead.rotation.y = targetSteerRad * 0.55;
    if (attachedS64Car && attachedS64Car.updateWheels) {
      attachedS64Car.updateWheels(dt, speed, steerAngle);
    }
  }

  function updateKartVisuals(dt, state) {
    const steerAngle =
      state.steerAngle !== undefined
        ? state.steerAngle - (state.driftAngle || 0.0) * 0.35
        : -(state.steerInput || 0.0) * 0.45 - (state.driftAngle || 0.0) * 0.35;

    updateWheels(dt, state.speed, steerAngle);

    // 3. Apply drift slip-angle yaw + suspension roll/hop to chassisGroup
    chassisGroup.rotation.y = THREE.MathUtils.lerp(
      chassisGroup.rotation.y,
      state.driftAngle || 0.0,
      Math.min(1, dt * 14)
    );
    chassisGroup.rotation.z = THREE.MathUtils.lerp(
      chassisGroup.rotation.z,
      (state.steerInput || 0.0) * 0.09,
      Math.min(1, dt * 12)
    );
    const idleBob =
      Math.abs(state.speed) > 0.005 ? Math.sin(performance.now() * 0.06) * 0.00018 : 0.0;
    chassisGroup.position.y = (state.hopHeight || 0.0) + idleBob;

    // 4. Volumetric Mach-Diamond Exhaust Flames:
    // Compact flickering afterburner at high speed (> 60 km/h) and massive electric-cyan/white-hot
    // hyper-plume during Nitro Boost or Track Boost Pad surges!
    const isBoosting = state.boostActive > 0;
    const isHighSpeed = Math.abs(state.speed) > 0.075 && !state.countdownLocked;
    const showFlames = isBoosting || isHighSpeed;
    const tSec = performance.now() * 0.001;

    for (const pGroup of flameCones) {
      pGroup.visible = showFlames && !cockpitRoadOnly;
      if (!pGroup.visible) continue;
      const pIdx = pGroup.userData.pipeIndex || 0;
      const phase = pIdx * 1.85;
      const crackle =
        0.82 +
        0.18 * Math.sin(tSec * 58.0 + phase) +
        0.12 * Math.cos(tSec * 93.0 - phase * 1.4);
      const rScale = (isBoosting ? 1.18 : 0.78) + 0.08 * Math.sin(tSec * 44.0 + phase);
      const zScale = isBoosting
        ? Math.max(0.85, 1.18 + 0.34 * crackle)
        : Math.max(0.32, 0.46 + 0.20 * crackle);
      pGroup.scale.set(rScale, rScale, zScale);
      if (pGroup.userData.jetMat) {
        pGroup.userData.jetMat.uniforms.uTime.value = tSec;
        pGroup.userData.jetMat.uniforms.uIntensity.value = isBoosting
          ? Math.min(1.45, 1.08 * crackle)
          : Math.min(0.75, 0.52 * crackle);
      }
    }

    // 5. Emit & step realistic glowing fire sparks + Rear-Tire Drift Smoke Clouds
    const kScale = kartRoot.scale.x || 0.58;
    sparkMat.uniforms.uSparkScale.value = kScale;

    const isEmitting =
      (state.isDrifting || isBoosting || state.curbRumble > 0.2 || Math.abs(state.steerInput || 0) > 0.26) &&
      Math.abs(state.speed) > 0.03;
    const emitCount = isEmitting ? 6 : 0;

    // Emit Rear-Tire Drift Smoke puffs when drifting, boosting off the line, or hard cornering
    const isSmokeEmitting =
      (state.isDrifting || (Math.abs(state.steerInput || 0) > 0.28 && Math.abs(state.speed) > 0.08)) &&
      !cockpitRoadOnly;

    if (isSmokeEmitting) {
      kartRoot.getWorldPosition(_worldPos);
      _backDir.copy(state.tangent).multiplyScalar(-1);
      for (let side of [-1, 1]) {
        const sIdx = nextSmokeIdx % smokeCount;
        nextSmokeIdx++;
        smokePositions[sIdx]
          .copy(_worldPos)
          .addScaledVector(state.right, side * 0.0046 * kScale)
          .addScaledVector(_backDir, 0.0056 * kScale)
          .addScaledVector(state.normal, 0.0012 * kScale);
        smokeVelocities[sIdx]
          .copy(_backDir)
          .multiplyScalar(0.025 + Math.random() * 0.025)
          .addScaledVector(state.normal, 0.014 + Math.random() * 0.012)
          .addScaledVector(state.right, (Math.random() - 0.5) * 0.018);
        smokeAges[sIdx] = 0.0;
        smokeMaxAges[sIdx] = 0.36 + Math.random() * 0.16;
      }
    }

    let activeSmokeNow = false;
    if (isSmokeEmitting || hadActiveSmoke) {
      for (let i = 0; i < smokeCount; i++) {
        const maxAge = smokeMaxAges[i] || 0.42;
        if (smokeAges[i] < maxAge) {
          activeSmokeNow = true;
          smokeAges[i] += dt;
          const lifeRatio = smokeAges[i] / maxAge;
          smokePositions[i].addScaledVector(smokeVelocities[i], dt);
          smokeVelocities[i].multiplyScalar(Math.max(0.85, 1.0 - 3.2 * dt));
          _smokeDummy.position.copy(smokePositions[i]);
          // Expand puff early then shrink smoothly as it dissipates
          const puffScale =
            lifeRatio < 0.35
              ? THREE.MathUtils.lerp(0.55, 1.85, lifeRatio / 0.35)
              : THREE.MathUtils.lerp(1.85, 0.05, (lifeRatio - 0.35) / 0.65);
          _smokeDummy.scale.setScalar(Math.max(0.01, puffScale * kScale));
          _smokeDummy.rotation.set(smokeAges[i] * 3.0, smokeAges[i] * 2.2, 0);
          _smokeDummy.updateMatrix();
          driftSmokeMesh.setMatrixAt(i, _smokeDummy.matrix);
        } else if (smokePositions[i].y > -5.0) {
          smokePositions[i].y = -10.0;
          _smokeDummy.position.set(0, -10, 0);
          _smokeDummy.scale.setScalar(0.0001);
          _smokeDummy.updateMatrix();
          driftSmokeMesh.setMatrixAt(i, _smokeDummy.matrix);
        }
      }
      driftSmokeMesh.instanceMatrix.needsUpdate = true;
      hadActiveSmoke = activeSmokeNow;
    }

    // Flicker warm orange firelight onto the roadbed/desk when sparks are flying,
    // scaled by the Settings "Fire Downcast Light" slider (fireLightMultiplier, default 0.12x)
    if (fireLightPreviewTimer > 0) {
      fireLightPreviewTimer = Math.max(0.0, fireLightPreviewTimer - dt);
    }
    const showFireLight = isEmitting || fireLightPreviewTimer > 0;
    const baseFireIntensity = 0.35 + Math.random() * 0.20;
    sparkFireLight.intensity = showFireLight
      ? baseFireIntensity * fireLightMultiplier
      : THREE.MathUtils.lerp(sparkFireLight.intensity, 0.0, Math.min(1, dt * 12));

    if (emitCount > 0) {
      kartRoot.getWorldPosition(_worldPos);
      _backDir.copy(state.tangent).multiplyScalar(-1);

      for (let e = 0; e < emitCount; e++) {
        const idx = nextSparkIdx % sparkCount;
        nextSparkIdx++;
        const sideSign = e % 2 === 0 ? -1 : 1;
        _spawnPos
          .copy(_worldPos)
          .addScaledVector(state.right, sideSign * (0.0044 + Math.random() * 0.0018) * kScale)
          .addScaledVector(_backDir, (0.0060 + Math.random() * 0.0028) * kScale)
          .addScaledVector(state.normal, (0.0009 + Math.random() * 0.0009) * kScale);

        sparkPositions[idx * 3 + 0] = _spawnPos.x;
        sparkPositions[idx * 3 + 1] = _spawnPos.y;
        sparkPositions[idx * 3 + 2] = _spawnPos.z;

        const vScale = 0.65 + 0.35 * kScale;
        sparkVelocities[idx]
          .copy(_backDir)
          .multiplyScalar((0.12 + Math.random() * 0.22) * vScale)
          .addScaledVector(state.normal, (0.045 + Math.random() * 0.11) * vScale)
          .addScaledVector(state.right, (Math.random() - 0.5) * 0.12 * vScale);

        sparkAges[idx] = 0.0;
        sparkMaxAges[idx] = 0.20 + Math.random() * 0.18;
        sparkLifeAttr[idx] = 1.0;
        sparkSizes[idx] = 0.65 + Math.random() * 1.15;

        // Neon Arcade Spark Palette: electric cyan during boost, fiery amber-gold during drift!
        if (isBoosting) {
          sparkColors[idx * 3 + 0] = 0.10 + Math.random() * 0.25;
          sparkColors[idx * 3 + 1] = 0.85 + Math.random() * 0.15;
          sparkColors[idx * 3 + 2] = 1.0;
        } else {
          sparkColors[idx * 3 + 0] = 1.0;
          sparkColors[idx * 3 + 1] = 0.36 + Math.random() * 0.46;
          sparkColors[idx * 3 + 2] = 0.04 + Math.random() * 0.14;
        }
      }
    }

    let activeSparksNow = false;
    if (emitCount > 0 || hadActiveSparks) {
      for (let i = 0; i < sparkCount; i++) {
        const maxAge = sparkMaxAges[i] || 0.28;
        if (sparkAges[i] < maxAge) {
          activeSparksNow = true;
          sparkAges[i] += dt;
          sparkLifeAttr[i] = Math.max(0.0, 1.0 - sparkAges[i] / maxAge);

          sparkPositions[i * 3 + 0] += sparkVelocities[i].x * dt;
          sparkPositions[i * 3 + 1] += sparkVelocities[i].y * dt;
          sparkPositions[i * 3 + 2] += sparkVelocities[i].z * dt;
          // Gentle air drag + micro-gravity + subtle turbulence flutter
          sparkVelocities[i].multiplyScalar(Math.max(0.88, 1.0 - 2.4 * dt));
          sparkVelocities[i].y -= 0.36 * dt;
        } else {
          sparkLifeAttr[i] = 0.0;
          sparkPositions[i * 3 + 1] = -10.0;
        }
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkGeo.attributes.color.needsUpdate = true;
      sparkGeo.attributes.aLife.needsUpdate = true;
      hadActiveSparks = activeSparksNow;
    }
  }

  // Group holding the procedural meshes so they can be hidden cleanly when kart_1to87.glb attaches
  const proceduralParts = [
    floorPan,
    noseCone,
    numberPlate,
    engineBlock,
    rearWing,
    seat,
    torso,
    driverHead,
    steeringWheel,
    ...frontPivots,
    wheelMeshes[2],
    wheelMeshes[3],
  ];

  // -------------------------------------------------------------------------
  // 6. ICEMAAN 3-BODY KIT PACK ATTACHMENTS (KIT 1 / KIT 2 / KIT 3)
  // -------------------------------------------------------------------------
  const aeroBeastGroup = new THREE.Group();
  aeroBeastGroup.name = 'Kit2_AeroBeast_Attachments';
  aeroBeastGroup.visible = false;
  chassisGroup.add(aeroBeastGroup);

  const neonCyanMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: new THREE.Color(0x00a8cc),
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.65,
  });

  // Kit 2: Widebody Fender Flares over all 4 wheels + Front Aero Splitter + Tall GT Dual-Plane Rear Wing Spoiler
  for (const [fx, fz] of [
    [-0.0056, 0.0054],
    [0.0056, 0.0054],
    [-0.0061, -0.0054],
    [0.0061, -0.0054],
  ]) {
    const flare = new THREE.Mesh(
      new THREE.BoxGeometry(0.0022, 0.0014, 0.0046),
      neonCyanMat
    );
    flare.position.set(fx, 0.0033, fz);
    aeroBeastGroup.add(flare);
  }
  const gtWingUpper = new THREE.Mesh(
    new THREE.BoxGeometry(0.0128, 0.0006, 0.0032),
    neonCyanMat
  );
  gtWingUpper.position.set(0, 0.0086, -0.0082);
  gtWingUpper.rotation.x = -0.24;
  aeroBeastGroup.add(gtWingUpper);

  for (const wx of [-0.0062, 0.0062]) {
    const endplate = new THREE.Mesh(
      new THREE.BoxGeometry(0.0005, 0.0032, 0.0042),
      carbonMat
    );
    endplate.position.set(wx, 0.0078, -0.0080);
    aeroBeastGroup.add(endplate);
  }
  const frontCanard = new THREE.Mesh(
    new THREE.BoxGeometry(0.0114, 0.0005, 0.0026),
    neonCyanMat
  );
  frontCanard.position.set(0, 0.0014, 0.0088);
  aeroBeastGroup.add(frontCanard);

  // Kit 3: Cyber Phantom (Aggressive Tuner + Deep Dish Rims - Matte Gold)
  const cyberPhantomGroup = new THREE.Group();
  cyberPhantomGroup.name = 'Kit3_CyberPhantom_Attachments';
  cyberPhantomGroup.visible = false;
  chassisGroup.add(cyberPhantomGroup);

  const matteGoldMat = new THREE.MeshStandardMaterial({
    color: 0xffc72c,
    emissive: new THREE.Color(0x553800),
    emissiveIntensity: 0.25,
    roughness: 0.26,
    metalness: 0.88,
  });

  // Aggressive Front Cyber Splitter & Side Skirts + Rear Diffuser Fins + Deep Dish Gold Rim Rings
  const cyberSplitter = new THREE.Mesh(
    new THREE.BoxGeometry(0.0118, 0.0007, 0.0034),
    matteGoldMat
  );
  cyberSplitter.position.set(0, 0.0013, 0.0091);
  cyberPhantomGroup.add(cyberSplitter);

  for (const sx of [-0.0058, 0.0058]) {
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(0.0012, 0.0010, 0.0092),
      matteGoldMat
    );
    skirt.position.set(sx, 0.0015, 0.0);
    cyberPhantomGroup.add(skirt);
  }

  for (const [rx, ry, rz, rad] of [
    [-0.0066, 0.00185, 0.0054, 0.00175],
    [0.0066, 0.00185, 0.0054, 0.00175],
    [-0.0071, 0.00215, -0.0054, 0.00205],
    [0.0071, 0.00215, -0.0054, 0.00205],
  ]) {
    const deepDishRing = new THREE.Mesh(
      new THREE.TorusGeometry(rad * 0.72, 0.00032, 10, 20),
      matteGoldMat
    );
    deepDishRing.rotation.y = Math.PI / 2;
    deepDishRing.position.set(rx, ry, rz);
    cyberPhantomGroup.add(deepDishRing);
  }

  const cyberLouvers = new THREE.Mesh(
    new THREE.BoxGeometry(0.0116, 0.0008, 0.0030),
    matteGoldMat
  );
  cyberLouvers.position.set(0, 0.0076, -0.0078);
  cyberLouvers.rotation.x = -0.22;
  cyberPhantomGroup.add(cyberLouvers);

  let currentBodyKit = 'kit1';
  let currentRimId = 'rim0';
  let currentSpoilerId = 'spoiler0';
  let attachedGlbScene = null;
  let attachedS64Car = null;
  let cockpitRoadOnly = false;

  const KIT_DEFAULT_PARTS = {
    kit1: { bodyId: 'kit1', rimId: 'rim0', spoilerId: 'spoiler0' },
    kit2: { bodyId: 'kit2', rimId: 'rim1', spoilerId: 'spoiler1' },
    kit3: { bodyId: 'kit3', rimId: 'rim2', spoilerId: 'spoiler2' },
  };

  function applyBodyKitToGlb(glbRoot, kitId) {
    if (!glbRoot) return;
    glbRoot.traverse((child) => {
      if (!child.isMesh) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      for (const mat of mats) {
        if (!mat || !mat.color) continue;
        const mName = (mat.name || '').toLowerCase();
        if (mName.includes('crimson') || mName.includes('red')) {
          if (kitId === 'kit2') {
            mat.color.setHex(0x00e5ff);
            mat.metalness = 0.62;
            mat.roughness = 0.16;
          } else if (kitId === 'kit3') {
            mat.color.setHex(0x16181f);
            mat.metalness = 0.78;
            mat.roughness = 0.28;
          } else {
            mat.color.setHex(0xe01b24);
            mat.metalness = 0.48;
            mat.roughness = 0.20;
          }
          mat.needsUpdate = true;
        } else if (mName.includes('helmet') || mName.includes('white')) {
          if (kitId === 'kit2') {
            mat.color.setHex(0x0b1322);
          } else if (kitId === 'kit3') {
            mat.color.setHex(0xf2bf36);
          } else {
            mat.color.setHex(0xf4f6fa);
          }
          mat.needsUpdate = true;
        } else if (mName.includes('gold')) {
          if (kitId === 'kit2') {
            mat.color.setHex(0x00f0ff);
          } else if (kitId === 'kit3') {
            mat.color.setHex(0xffd044);
          } else {
            mat.color.setHex(0xf0be3c);
          }
          mat.needsUpdate = true;
        }
      }
    });
  }

  function applyProceduralRimAndSpoiler() {
    // Rim color styling across procedural/GLB wheels
    if (currentRimId === 'rim1') {
      goldRimMat.color.setHex(0x00e5ff);
      goldRimMat.metalness = 0.85;
      goldRimMat.roughness = 0.18;
    } else if (currentRimId === 'rim2') {
      goldRimMat.color.setHex(0xffc72c);
      goldRimMat.metalness = 0.92;
      goldRimMat.roughness = 0.20;
    } else if (currentRimId === 'rim3') {
      goldRimMat.color.setHex(0xe2e8f0);
      goldRimMat.metalness = 0.95;
      goldRimMat.roughness = 0.12;
    } else {
      goldRimMat.color.setHex(
        currentBodyKit === 'kit2' ? 0x00f0ff : currentBodyKit === 'kit3' ? 0xffd24c : 0xffbb44
      );
      goldRimMat.metalness = 0.85;
      goldRimMat.roughness = 0.25;
    }
    goldRimMat.needsUpdate = true;

    // Procedural rear wing visibility/scale based on spoiler selection
    if (rearWing && !attachedS64Car && !cockpitRoadOnly) {
      if (currentSpoilerId === 'spoiler0') {
        rearWing.visible = false;
      } else if (currentSpoilerId === 'spoiler1') {
        rearWing.visible = true;
        rearWing.scale.set(1.05, 1.1, 1.1);
      } else {
        rearWing.visible = true;
        rearWing.scale.set(1.28, 1.45, 1.35);
      }
    }
  }

  function setCustomParts({ bodyId, rimId, spoilerId } = {}) {
    if (bodyId) currentBodyKit = bodyId;
    if (rimId) currentRimId = rimId;
    if (spoilerId !== undefined) currentSpoilerId = spoilerId;

    applyProceduralRimAndSpoiler();

    if (attachedS64Car) {
      attachedS64Car.setConfiguration({
        bodyId: currentBodyKit,
        rimId: currentRimId,
        spoilerId: currentSpoilerId,
      });
    } else if (attachedGlbScene) {
      applyBodyKitToGlb(attachedGlbScene, currentBodyKit);
    }
  }

  function setBodyKit(kitId, customOverrides) {
    currentBodyKit = kitId || 'kit1';
    const def = KIT_DEFAULT_PARTS[currentBodyKit] || KIT_DEFAULT_PARTS.kit1;
    currentRimId = customOverrides?.rimId || def.rimId;
    currentSpoilerId =
      customOverrides?.spoilerId !== undefined ? customOverrides.spoilerId : def.spoilerId;

    const showProceduralKits = !cockpitRoadOnly && !attachedS64Car;
    aeroBeastGroup.visible = showProceduralKits && currentBodyKit === 'kit2';
    cyberPhantomGroup.visible = showProceduralKits && currentBodyKit === 'kit3';

    if (currentBodyKit === 'kit2') {
      redFairingMat.color.setHex(0x00e5ff);
      redFairingMat.metalness = 0.62;
      redFairingMat.roughness = 0.16;
      whiteStripeMat.color.setHex(0x0d1726);
    } else if (currentBodyKit === 'kit3') {
      redFairingMat.color.setHex(0xffc72c);
      redFairingMat.metalness = 0.78;
      redFairingMat.roughness = 0.24;
      whiteStripeMat.color.setHex(0x161820);
    } else {
      redFairingMat.color.setHex(0xff2b1e);
      redFairingMat.metalness = 0.35;
      redFairingMat.roughness = 0.22;
      whiteStripeMat.color.setHex(0xf7f9fc);
    }
    redFairingMat.needsUpdate = true;
    whiteStripeMat.needsUpdate = true;

    applyProceduralRimAndSpoiler();

    if (attachedS64Car) {
      attachedS64Car.setConfiguration({
        bodyId: currentBodyKit,
        rimId: currentRimId,
        spoilerId: currentSpoilerId,
      });
    } else if (attachedGlbScene) {
      applyBodyKitToGlb(attachedGlbScene, currentBodyKit);
    }
  }

  function setCockpitRoadOnly(isRoadOnly) {
    cockpitRoadOnly = Boolean(isRoadOnly);
    kartShadowQuad.visible = !cockpitRoadOnly;
    const showProceduralKits = !cockpitRoadOnly && !attachedS64Car;
    aeroBeastGroup.visible = showProceduralKits && currentBodyKit === 'kit2';
    cyberPhantomGroup.visible = showProceduralKits && currentBodyKit === 'kit3';

    if (attachedS64Car) {
      attachedS64Car.carAssemblyRoot.visible = !cockpitRoadOnly;
      if (attachedGlbScene) attachedGlbScene.visible = false;
    } else if (attachedGlbScene) {
      attachedGlbScene.visible = !cockpitRoadOnly;
    } else {
      for (const part of proceduralParts) {
        if (part) part.visible = !cockpitRoadOnly;
      }
    }
    for (const plane of tailLightGlowPlanes) {
      if (plane) plane.visible = !cockpitRoadOnly;
    }
  }

  function attachS64ModularCar(s64Car) {
    attachedS64Car = s64Car;
    // Hide procedural kart parts, procedural kit boxes, and any older GLB kart
    for (const part of proceduralParts) {
      if (part) part.visible = false;
    }
    aeroBeastGroup.visible = false;
    cyberPhantomGroup.visible = false;
    if (attachedGlbScene) {
      attachedGlbScene.visible = false;
    }
    chassisGroup.traverse((c) => {
      if (
        c.isMesh &&
        !flameCones.includes(c) &&
        !flameCones.includes(c.parent) &&
        !tailLightGlowPlanes.includes(c)
      ) {
        c.visible = false;
      }
    });

    s64Car.carAssemblyRoot.visible = !cockpitRoadOnly;
    chassisGroup.add(s64Car.carAssemblyRoot);
    s64Car.setConfiguration({
      bodyId: currentBodyKit,
      rimId: currentRimId,
      spoilerId: currentSpoilerId,
    });
  }

  function attachGlbKart(glbScene) {
    attachedGlbScene = glbScene;
    if (attachedS64Car) {
      // S64 Modular FBX Car takes priority over generic GLB kart
      glbScene.visible = false;
      return;
    }
    // Ensure zero extra rotation on glbScene so +Z nose (Z_three = +0.0090) faces straight down +tangent
    glbScene.position.set(0, 0, 0);
    glbScene.rotation.set(0, 0, 0);
    glbScene.visible = !cockpitRoadOnly;
    kartShadowQuad.visible = !cockpitRoadOnly;

    // Hide procedural body/wheels while keeping headlights, tail-light glow halo planes, turbo flame cones, and bodykit groups
    for (const part of proceduralParts) {
      if (part) part.visible = false;
    }
    chassisGroup.traverse((c) => {
      if (
        c.isMesh &&
        !flameCones.includes(c) &&
        !flameCones.includes(c.parent) &&
        !tailLightGlowPlanes.includes(c) &&
        c.parent !== aeroBeastGroup &&
        c.parent !== cyberPhantomGroup
      ) {
        c.visible = false;
      }
    });

    function attachKartReadabilityRimShader(mat, cacheKey, minFloorStrength, topFillStrength, rimStrength) {
      mat.customProgramCacheKey = () => cacheKey;
      mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `
          vec3 kViewDir = normalize( vViewPosition );
          float kNdotV = clamp( abs( dot( normal, kViewDir ) ), 0.0, 1.0 );
          float kGrazing = pow( 1.0 - kNdotV, 2.15 );
          float kTopFill = clamp( normal.y * 0.65 + normal.z * 0.35, 0.0, 1.0 );
          vec3 minFloorRgb = diffuseColor.rgb * (${minFloorStrength.toFixed(3)} + ${topFillStrength.toFixed(3)} * kTopFill);
          vec3 rimHighlightRgb = mix(diffuseColor.rgb, vec3(1.0, 0.97, 0.92), 0.48) * (kGrazing * ${rimStrength.toFixed(3)});
          gl_FragColor.rgb = max(gl_FragColor.rgb, minFloorRgb) + rimHighlightRgb * (0.45 + 0.55 * kTopFill);
          #include <dithering_fragment>
          `
        );
      };
    }

    const glbFrontWheels = [];
    const glbAllWheels = [];
    glbScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        if (child.geometry && !child.geometry.attributes.normal) {
          child.geometry.computeVertexNormals();
        }
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        for (const mat of mats) {
          if (!mat) continue;
          const mName = (mat.name || '').toLowerCase();
          if (mName.includes('visor')) {
            if (mat.color) mat.color.setHex(0x050608);
            mat.roughness = 0.14;
            mat.metalness = 0.08;
            mat.envMapIntensity = 0.22;
            if (mat.emissive) mat.emissive.setHex(0x000000);
            mat.emissiveIntensity = 0.0;
            mat.needsUpdate = true;
          } else if (mName.includes('helmet') || mName.includes('white')) {
            if (mat.color) mat.color.setHex(0xf4f6fa);
            mat.roughness = 0.20;
            mat.metalness = 0.08;
            mat.envMapIntensity = 0.95;
            if (mat.emissive) mat.emissive.setHex(0x181c24);
            mat.emissiveIntensity = 0.12;
            attachKartReadabilityRimShader(mat, 'kart_white_rim_v1', 0.22, 0.28, 0.18);
            mat.needsUpdate = true;
          } else if (mName.includes('crimson') || mName.includes('red')) {
            if (mat.color) mat.color.setHex(0xe01b24);
            mat.roughness = 0.20;
            mat.metalness = 0.48;
            mat.envMapIntensity = 1.35;
            attachKartReadabilityRimShader(mat, 'kart_crimson_rim_v1', 0.28, 0.34, 0.26);
            mat.needsUpdate = true;
          } else if (mName.includes('gold')) {
            if (mat.color) mat.color.setHex(0xf0be3c);
            mat.roughness = 0.24;
            mat.metalness = 0.78;
            mat.envMapIntensity = 1.15;
            attachKartReadabilityRimShader(mat, 'kart_gold_rim_v1', 0.24, 0.30, 0.24);
            mat.needsUpdate = true;
          } else if (mName.includes('gunmetal')) {
            if (mat.color) mat.color.setHex(0x3e4756);
            mat.roughness = 0.26;
            mat.metalness = 0.58;
            mat.envMapIntensity = 1.30;
            attachKartReadabilityRimShader(mat, 'kart_gunmetal_rim_v1', 0.28, 0.36, 0.30);
            mat.needsUpdate = true;
          } else if (mName.includes('suit')) {
            if (mat.color) mat.color.setHex(0x2a303c);
            mat.roughness = 0.50;
            mat.metalness = 0.12;
            mat.envMapIntensity = 0.85;
            attachKartReadabilityRimShader(mat, 'kart_suit_rim_v1', 0.20, 0.24, 0.16);
            mat.needsUpdate = true;
          } else if (mName.includes('tire') || mName.includes('rubber')) {
            if (mat.color) mat.color.setHex(0x16191e);
            mat.roughness = 0.72;
            mat.metalness = 0.06;
            mat.envMapIntensity = 0.65;
            attachKartReadabilityRimShader(mat, 'kart_tire_rim_v1', 0.14, 0.18, 0.14);
            mat.needsUpdate = true;
          } else if (mName.includes('headlight')) {
            if (mat.color) mat.color.setHex(0xffffff);
            if (mat.emissive) mat.emissive.setHex(0xfff4d8);
            mat.emissiveIntensity = 2.2;
            mat.roughness = 0.08;
            mat.needsUpdate = true;
          } else if (mName.includes('rainlight') || mName.includes('taillight')) {
            if (mat.color) mat.color.setHex(0xff0010);
            if (mat.emissive) mat.emissive.setHex(0xff0018);
            mat.emissiveIntensity = 1.35;
            mat.roughness = 0.08;
            mat.toneMapped = false;
            mat.needsUpdate = true;
          } else if (mName.includes('chrome')) {
            if (mat.color) mat.color.setHex(0x7d8796);
            mat.roughness = 0.30;
            mat.metalness = 0.82;
            mat.envMapIntensity = 0.65;
            attachKartReadabilityRimShader(mat, 'kart_chrome_rim_v2', 0.14, 0.18, 0.12);
            mat.needsUpdate = true;
          }
        }
      }
      if (child.name === 'Wheel_FL' || child.name === 'Wheel_FR') {
        glbFrontWheels.push(child);
        glbAllWheels.push(child);
      } else if (child.name === 'Wheel_RL' || child.name === 'Wheel_RR') {
        glbAllWheels.push(child);
      }
    });

    chassisGroup.add(glbScene);
    applyBodyKitToGlb(glbScene, currentBodyKit);
    // Register GLB wheels for 60FPS spin & steering
    if (glbAllWheels.length > 0) {
      wheelMeshes.push(...glbAllWheels);
    }
    if (glbFrontWheels.length > 0) {
      frontPivots.push(...glbFrontWheels);
    }
  }

  return {
    kartRoot,
    chassisGroup,
    sparkPoints,
    driftSmokeMesh,
    sparkFireLight,
    setFireLightMultiplier,
    setCockpitRoadOnly,
    setBodyKit,
    setCustomParts,
    updateWheels,
    updateKartVisuals,
    attachGlbKart,
    attachS64ModularCar,
  };
}
