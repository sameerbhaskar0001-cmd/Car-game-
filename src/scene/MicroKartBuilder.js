import * as THREE from 'three';
import { createCosmoCarInstance } from './CosmoCarLoader.js';
import { normalizeCarId } from '../types/game';

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
  kartShadowQuad.position.set(0, 0.00048, -0.0002);
  kartShadowQuad.castShadow = false;
  kartShadowQuad.receiveShadow = false;
  kartRoot.add(kartShadowQuad);

  // Clean low-poly coupe placeholder (only visible if GLTF hasn't finished loading yet)
  const placeholderGroup = new THREE.Group();
  placeholderGroup.name = 'PlaceholderCoupeFallback';
  placeholderGroup.visible = false;
  const placeholderBody = new THREE.Mesh(
    new THREE.BoxGeometry(0.0088, 0.0036, 0.0195),
    redFairingMat
  );
  placeholderBody.position.set(0, 0.0028, 0);
  placeholderGroup.add(placeholderBody);
  chassisGroup.add(placeholderGroup);

  // Twin Rear Exhaust Pipes + Realistic Volumetric Mach-Diamond Afterburner Jet
  // Plumes (Zero FPS impact!)
  function createExhaustFlameMaterial(pipePhase) {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: {value: 0.0},
        uIntensity: {value: 1.0},
        uPhase: {value: pipePhase},
        uBoostMix: {value: 0.0},
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
          float flutter = u * u * 0.00024;
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
        uniform float uBoostMix;
        varying float vPlumeU;
        varying float vRadialR;
        varying vec3 vLocalPos;
        varying vec3 vViewNormal;
        varying vec3 vViewPos;
        void main() {
          float u = clamp(vPlumeU, 0.0, 1.0);

          vec3 viewDir = normalize(vViewPos);
          float ndotv = abs(dot(normalize(vViewNormal), viewDir));
          float viewWeight = 0.58 + 0.42 * sqrt(clamp(ndotv, 0.0, 1.0));
          float radialCore = exp(-vRadialR * vRadialR * (2.1 + u * 2.4));
          float radialMask = radialCore * viewWeight;

          float angle = atan(vLocalPos.y, vLocalPos.x);
          float turb1 = sin(u * 22.0 - uTime * 56.0 + angle * 2.0 + uPhase);
          float turb2 = cos(u * 35.0 - uTime * 74.0 - angle * 3.0 + uPhase * 1.3);
          float turbulence = 0.80 + 0.20 * (turb1 * 0.6 + turb2 * 0.4);

          float machWave = max(0.0, cos(u * 15.5 - uTime * 34.0 + uPhase * 0.5));
          float machDiamond = pow(machWave, 3.2) * smoothstep(0.85, 0.04, u) * exp(-vRadialR * vRadialR * 3.6);

          float tipCut = clamp(1.0 - u + (turb1 * 0.11 + turb2 * 0.07) * u, 0.0, 1.0);
          float axialEnv = (0.35 + 0.65 * smoothstep(0.0, 0.08, u)) * pow(tipCut, 1.45);

          // Nitro Boost Cyan/Orange afterburner palette + normal golden-orange flame
          vec3 nitroCyan = vec3(0.12, 1.15, 1.65);
          vec3 butaneBlue = vec3(0.32, 0.76, 1.35);
          vec3 whiteHot = vec3(1.55, 1.45, 1.10);
          vec3 goldenAmber = vec3(1.55, 0.72, 0.12);
          vec3 fieryCrimson = vec3(1.30, 0.26, 0.03);

          vec3 nozzleCol = mix(butaneBlue, nitroCyan, uBoostMix);
          vec3 outerTailCol = mix(fieryCrimson, goldenAmber, uBoostMix * 0.65);
          vec3 baseCol = mix(nozzleCol, goldenAmber, smoothstep(0.04, mix(0.34, 0.54, uBoostMix), u));
          baseCol = mix(baseCol, outerTailCol, smoothstep(0.42, 0.88, u));
          float coreHotness = clamp(radialCore * (1.0 - u * 0.52) + machDiamond * 0.90, 0.0, 1.0);
          vec3 flameRgb = mix(baseCol, mix(whiteHot, nitroCyan * 1.15, uBoostMix * 0.45), pow(coreHotness, 1.35));

          float alpha = clamp(axialEnv * radialMask * turbulence * uIntensity * 1.45, 0.0, 1.0);
          if (alpha < 0.01) discard;
          gl_FragColor = vec4(flameRgb * alpha * 1.4, alpha);
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
  const exhaustPipes = [];
  for (let i = 0; i < 2; i++) {
    const ex = i === 0 ? -0.0022 : 0.0022;
    const pipe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.00056, 0.00062, 0.0032, 16),
      chromeMat
    );
    pipe.rotation.x = Math.PI / 2 + 0.12;
    pipe.position.set(ex, 0.00175, -0.0094);
    chassisGroup.add(pipe);
    exhaustPipes.push(pipe);

    const plumeGroup = new THREE.Group();
    // Anchor cleanly at the rear bumper exhaust outlets so twin cyan/orange afterburner jets shoot back visibly
    plumeGroup.position.set(ex, 0.00168, -0.0102);
    plumeGroup.rotation.x = 0.14;
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

  // -------------------------------------------------------------------------
  // 2. BRAKING TAILLIGHTS (EMISSIVE RED MESHES + HALO PLANES + REAR POINTLIGHT)
  // -------------------------------------------------------------------------
  const tailGlowCanvas = document.createElement('canvas');
  tailGlowCanvas.width = 128;
  tailGlowCanvas.height = 128;
  const tgCtx = tailGlowCanvas.getContext('2d');
  const tgGrad = tgCtx.createRadialGradient(64, 64, 4, 64, 64, 62);
  tgGrad.addColorStop(0.0, 'rgba(255, 16, 38, 0.95)');
  tgGrad.addColorStop(0.32, 'rgba(255, 0, 24, 0.65)');
  tgGrad.addColorStop(0.68, 'rgba(220, 0, 18, 0.24)');
  tgGrad.addColorStop(1.0, 'rgba(180, 0, 12, 0.0)');
  tgCtx.fillStyle = tgGrad;
  tgCtx.fillRect(0, 0, 128, 128);
  const tailGlowTex = new THREE.CanvasTexture(tailGlowCanvas);

  const tailGlowGeo = new THREE.PlaneGeometry(0.0036, 0.0022);
  const tailGlowMat = new THREE.MeshBasicMaterial({
    map: tailGlowTex,
    transparent: true,
    opacity: 0.45,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const tailLampGeo = new THREE.BoxGeometry(0.0018, 0.00065, 0.00045);
  const tailLampMat = new THREE.MeshStandardMaterial({
    color: 0xff0a18,
    emissive: new THREE.Color(0xff0018),
    emissiveIntensity: 1.4,
    roughness: 0.12,
    metalness: 0.1,
    toneMapped: false,
  });

  const tailLightGlowPlanes = [];
  const tailLampMeshes = [];
  for (const tx of [-0.0031, 0.0031]) {
    const lampMesh = new THREE.Mesh(tailLampGeo, tailLampMat);
    lampMesh.position.set(tx, 0.00285, -0.0096);
    lampMesh.castShadow = false;
    lampMesh.receiveShadow = false;
    chassisGroup.add(lampMesh);
    tailLampMeshes.push(lampMesh);

    const tailGlowPlane = new THREE.Mesh(tailGlowGeo, tailGlowMat);
    tailGlowPlane.position.set(tx, 0.00285, -0.0099);
    tailGlowPlane.rotation.y = Math.PI;
    tailGlowPlane.castShadow = false;
    tailGlowPlane.receiveShadow = false;
    chassisGroup.add(tailGlowPlane);
    tailLightGlowPlanes.push(tailGlowPlane);
  }

  // Subtle rear red PointLight with quadratic decay (no bright light blobs washing out the asphalt)
  const brakeTailLight = new THREE.PointLight(0xff1024, 0.0, 0.022, 2.0);
  brakeTailLight.position.set(0, 0.0032, -0.0108);
  chassisGroup.add(brakeTailLight);

  // Subtle warm ember light under rear exhaust when sparks emit (quadratic decay)
  const sparkFireLight = new THREE.PointLight(0xff6818, 0.0, 0.018, 2.0);
  sparkFireLight.position.set(0, 0.0028, -0.009);
  chassisGroup.add(sparkFireLight);

  let fireLightMultiplier = 0.06;
  let fireLightPreviewTimer = 0.0;
  function setFireLightMultiplier(val, triggerPreview = true) {
    fireLightMultiplier = Math.max(0.0, Number(val) || 0.0);
    if (triggerPreview) {
      fireLightPreviewTimer = 0.85;
    }
  }

  // Empty wheel arrays retained for compatibility if custom GLB attaches raw wheel nodes
  const frontPivots = [];
  const wheelMeshes = [];

  // -------------------------------------------------------------------------
  // 3. TWIN FORWARD-FACING 3D SPOTLIGHT HEADLIGHTS (Crucial for Neon City & Canyon)
  // -------------------------------------------------------------------------
  const headlightLensGeo = new THREE.BoxGeometry(0.0016, 0.0006, 0.0004);
  const headlightLensMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: new THREE.Color(0xe0f2fe),
    emissiveIntensity: 2.2,
    roughness: 0.08,
    toneMapped: false,
  });

  const headlightSpotLights = [];
  const headlightLenses = [];
  for (const hx of [-0.0033, 0.0033]) {
    const lensMesh = new THREE.Mesh(headlightLensGeo, headlightLensMat);
    lensMesh.position.set(hx, 0.0028, 0.0098);
    lensMesh.castShadow = false;
    lensMesh.visible = false;
    chassisGroup.add(lensMesh);
    headlightLenses.push(lensMesh);

    const targetObj = new THREE.Object3D();
    targetObj.position.set(hx * 1.15, 0.0018, 0.22);
    chassisGroup.add(targetObj);

    const spot = new THREE.SpotLight(0xf0f9ff, 0.0, 0.24, Math.PI * 0.22, 0.98, 2.0);
    spot.position.set(hx, 0.0046, 0.0092);
    spot.target = targetObj;
    spot.visible = false;
    chassisGroup.add(spot);
    headlightSpotLights.push(spot);
  }

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
  let hadActiveSparks = false;
  let brakeVisualLerp = 0.0;
  let smoothDriftYaw = 0.0;
  let smoothBodyRoll = 0.0;
  let smoothChassisPitch = 0.0;
  chassisGroup.rotation.order = 'YXZ';
  const _worldPos = new THREE.Vector3();
  const _backDir = new THREE.Vector3();
  const _spawnPos = new THREE.Vector3();

  /**
   * Spins all 4 wheels proportional to forward velocity (`speed` in m/s)
   * and steers front wheel pivots to `steerAngle` (`+0.45` for Left `A`, `-0.45` for Right `D`).
   */
  function updateWheels(dt, speed, steerAngle = 0.0) {
    const wheelSpinDelta = (speed / 0.002) * dt;
    for (const w of wheelMeshes) {
      w.rotation.x += wheelSpinDelta;
    }

    const targetSteerRad = THREE.MathUtils.clamp(steerAngle, -0.52, 0.52);
    for (const p of frontPivots) {
      p.rotation.y = THREE.MathUtils.lerp(p.rotation.y, targetSteerRad, Math.min(1, dt * 16));
    }
    if (attachedCosmoCar && attachedCosmoCar.assemblyRoot && attachedCosmoCar.assemblyRoot.visible) {
      attachedCosmoCar.spinWheels(speed * dt);
      attachedCosmoCar.steerFrontWheels(steerAngle);
    }
    if (attachedS64Car && attachedS64Car.carAssemblyRoot && attachedS64Car.carAssemblyRoot.visible && attachedS64Car.updateWheels) {
      attachedS64Car.updateWheels(dt, speed, steerAngle);
    }
  }

  function updateKartVisuals(dt, state) {
    const steerAngle =
      state.steerAngle !== undefined
        ? state.steerAngle - (state.driftAngle || 0.0) * 0.35
        : -(state.steerInput || 0.0) * 0.45 - (state.driftAngle || 0.0) * 0.35;

    updateWheels(dt, state.speed, steerAngle);

    // Dynamic Braking Taillight Emissive & Rear Brake PointLight Response
    const isBraking = Boolean(state.isBraking);
    brakeVisualLerp = THREE.MathUtils.lerp(
      brakeVisualLerp,
      isBraking ? 1.0 : 0.0,
      Math.min(1.0, dt * 18.0)
    );
    tailLampMat.emissiveIntensity = THREE.MathUtils.lerp(1.2, 3.6, brakeVisualLerp);
    tailGlowMat.opacity = THREE.MathUtils.lerp(0.32, 0.85, brakeVisualLerp);
    const haloScale = THREE.MathUtils.lerp(1.0, 1.32, brakeVisualLerp);
    for (let i = 0; i < tailLightGlowPlanes.length; i++) {
      tailLightGlowPlanes[i].scale.set(haloScale, haloScale, 1.0);
    }
    brakeTailLight.intensity = cockpitRoadOnly
      ? 0.0
      : THREE.MathUtils.lerp(0.0, 0.06, brakeVisualLerp);
    if (attachedCosmoCar && attachedCosmoCar.setBraking) {
      attachedCosmoCar.setBraking(isBraking);
    }

    // 3. Apply drift slip-angle yaw + suspension roll/hop + terrain pitch + 360° Mid-Air Stunt Rotations to chassisGroup
    const spinT = state.spinoutTimer || 0.0;
    const tumblePhase = performance.now() * 0.024;
    const tumbleRoll = spinT > 0 ? Math.sin(tumblePhase) * 0.42 * Math.min(1.0, spinT * 1.8) : 0.0;
    const tumblePitch = spinT > 0 ? Math.cos(tumblePhase * 1.3) * 0.28 * Math.min(1.0, spinT * 1.8) : 0.0;

    const landingComp = Math.max(0.0, state.landingCompression || 0.0);
    const landingSquatPitch = Math.sin(landingComp * Math.PI) * 0.065;

    const stuntSpin = state.stuntSpinAngle || 0.0;
    const stuntRoll = state.stuntRollAngle || 0.0;

    smoothDriftYaw = THREE.MathUtils.lerp(
      smoothDriftYaw,
      state.driftAngle || 0.0,
      Math.min(1, dt * 14)
    );
    smoothBodyRoll = THREE.MathUtils.lerp(
      smoothBodyRoll,
      (state.steerInput || 0.0) * 0.11 + (state.driftAngle || 0.0) * 0.13 + tumbleRoll,
      Math.min(1, dt * 14)
    );
    smoothChassisPitch = THREE.MathUtils.lerp(
      smoothChassisPitch,
      (state.terrainPitch || 0.0) + (state.rampPitch || 0.0) + landingSquatPitch + tumblePitch,
      Math.min(1, dt * 18)
    );

    chassisGroup.rotation.y = smoothDriftYaw + stuntSpin;
    chassisGroup.rotation.z = smoothBodyRoll + stuntRoll;
    chassisGroup.rotation.x = smoothChassisPitch;

    const idleBob =
      Math.abs(state.speed) > 0.005 ? Math.sin(performance.now() * 0.06) * 0.00018 : 0.0;
    const landingSquashY = Math.sin(landingComp * Math.PI) * 0.00095;
    chassisGroup.position.y = idleBob + (state.rumbleLift || 0.0) - landingSquashY;
    const squashFactor = Math.sin(landingComp * Math.PI);
    chassisGroup.scale.set(
      1.0 + squashFactor * 0.055,
      1.0 - squashFactor * 0.095,
      1.0 + squashFactor * 0.035
    );

    // Keep radial contact shadow aligned with car yaw and fade out cleanly when airborne
    const kScaleCurrent = kartRoot.scale.y || 0.56;
    const hopH = Math.max(0.0, state.hopHeight || 0.0);
    kartShadowQuad.position.y = 0.00028 - hopH / kScaleCurrent;
    kartShadowQuad.rotation.z = -smoothDriftYaw;
    if (kartShadowQuad.material) {
      kartShadowQuad.material.opacity = Math.max(0.0, 0.48 - hopH * 95.0);
    }

    // 4. Volumetric Twin Nitro Exhaust Flames:
    // Ignite dynamically with cyan/orange flickering afterburners ONLY while actively moving in RACE (never at 0 KM/H or idle showroom!)
    const absSpeed = Math.abs(state.speed || 0);
    const isMoving = absSpeed > 0.015 && !state.countdownLocked;
    const isBoosting = !isIdleShowroom && isMoving && state.boostActive > 0;
    const isShockwave = !isIdleShowroom && isMoving && (state.shockwaveTimer || 0) > 0;
    const isHighSpeed = !isIdleShowroom && absSpeed > 0.115 && !state.countdownLocked;
    const showFlames = !isIdleShowroom && isMoving && (isBoosting || isHighSpeed);
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
      const rScale =
        (isShockwave ? 1.62 : isBoosting ? 1.32 : 0.65) + 0.10 * Math.sin(tSec * 44.0 + phase);
      const zScale = isShockwave
        ? Math.max(1.25, 1.75 + 0.50 * crackle)
        : isBoosting
          ? Math.max(0.95, 1.35 + 0.40 * crackle)
          : Math.max(0.28, 0.40 + 0.15 * crackle);
      pGroup.scale.set(rScale, rScale, zScale);
      if (pGroup.userData.jetMat) {
        pGroup.userData.jetMat.uniforms.uTime.value = tSec;
        pGroup.userData.jetMat.uniforms.uBoostMix.value = isBoosting ? 1.0 : 0.12;
        pGroup.userData.jetMat.uniforms.uIntensity.value = isShockwave
          ? Math.min(1.85, 1.48 * crackle)
          : isBoosting
            ? Math.min(1.55, 1.20 * crackle)
            : Math.min(0.62, 0.42 * crackle);
      }
    }

    // 5. Emit & step subtle glowing fire sparks during genuine corner drifts or Nitro boosts
    // (Oversized white low-poly smoke spheres disabled so view behind car stays 100% clean)
    const kScale = kartRoot.scale.x || 0.58;
    sparkMat.uniforms.uSparkScale.value = kScale;

    const isSpinOrImpact = !isIdleShowroom && (state.carImpactTimer || 0) > 0;
    const isEmitting =
      !isIdleShowroom &&
      !state.countdownLocked &&
      (isSpinOrImpact ||
        ((state.isDrifting || isBoosting) && absSpeed > 0.05));
    const emitCount = isShockwave ? 6 : isSpinOrImpact ? 5 : isEmitting ? 4 : 0;

    if (driftSmokeMesh.visible) {
      driftSmokeMesh.visible = false;
    }

    // Flicker warm orange firelight onto the roadbed/desk when sparks are flying,
    // scaled by the Settings "Fire Downcast Light" slider (fireLightMultiplier, default 0.12x)
    if (fireLightPreviewTimer > 0) {
      fireLightPreviewTimer = Math.max(0.0, fireLightPreviewTimer - dt);
    }
    const showFireLight = isEmitting || fireLightPreviewTimer > 0;
    const baseFireIntensity = 0.05 + Math.random() * 0.03;
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
        sparkSizes[idx] = (isShockwave ? 0.9 : 0.65) + Math.random() * 1.15;

        // Neon Arcade Spark Palette: electric purple/magenta during Shockwave, cyan during boost, amber-gold during drift!
        if (isShockwave) {
          sparkColors[idx * 3 + 0] = 0.92 + Math.random() * 0.08;
          sparkColors[idx * 3 + 1] = 0.22 + Math.random() * 0.30;
          sparkColors[idx * 3 + 2] = 1.0;
        } else if (isBoosting) {
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

  const proceduralParts = [placeholderGroup, ...exhaustPipes];
  for (const part of proceduralParts) {
    if (part) part.visible = false;
  }

  const aeroBeastGroup = new THREE.Group();
  aeroBeastGroup.visible = false;
  const cyberPhantomGroup = new THREE.Group();
  cyberPhantomGroup.visible = false;

  let currentBodyKit = 'kit1';
  let currentRimId = 'rim0';
  let currentSpoilerId = 'spoiler0';
  let currentPaintHex = null;
  let attachedGlbScene = null;
  let attachedS64Car = null;
  let cockpitRoadOnly = false;
  let isIdleShowroom = true;

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
        }
      }
    });
  }

  function applyProceduralRimAndSpoiler() {
    if (currentRimId === 'rim1') {
      goldRimMat.color.setHex(0x00e5ff);
    } else if (currentRimId === 'rim2') {
      goldRimMat.color.setHex(0xffc72c);
    } else if (currentRimId === 'rim3') {
      goldRimMat.color.setHex(0xe2e8f0);
    } else {
      goldRimMat.color.setHex(0xffbb44);
    }
    goldRimMat.needsUpdate = true;
  }

  let attachedCosmoCar = null;
  let cosmoLoadReqId = 0;
  let s64LazyLoaderFn = null;
  let s64LazyLoadRequested = false;

  function setS64LazyLoader(loaderFn) {
    s64LazyLoaderFn = loaderFn;
  }

  function syncActiveCarVisibility() {
    const hasAnyCarModel = Boolean(attachedCosmoCar || attachedS64Car || attachedGlbScene);
    kartShadowQuad.visible = !cockpitRoadOnly && hasAnyCarModel;
    const isS64Selected =
      currentBodyKit === 's64' ||
      currentBodyKit === 'kit1' ||
      currentBodyKit === 'kit2' ||
      currentBodyKit === 'kit3';

    if (isS64Selected && attachedS64Car) {
      attachedS64Car.carAssemblyRoot.visible = !cockpitRoadOnly;
      if (attachedCosmoCar) {
        attachedCosmoCar.assemblyRoot.visible = false;
      }
      if (attachedGlbScene) {
        attachedGlbScene.visible = false;
      }
      placeholderGroup.visible = false;
    } else if (attachedCosmoCar) {
      attachedCosmoCar.assemblyRoot.visible = !cockpitRoadOnly;
      attachedCosmoCar.assemblyRoot.traverse((c) => {
        c.visible = true;
      });
      if (attachedS64Car) {
        attachedS64Car.carAssemblyRoot.visible = false;
      }
      if (attachedGlbScene) {
        attachedGlbScene.visible = false;
      }
      placeholderGroup.visible = false;
    } else if (attachedS64Car) {
      attachedS64Car.carAssemblyRoot.visible = !cockpitRoadOnly;
      if (attachedGlbScene) {
        attachedGlbScene.visible = false;
      }
      placeholderGroup.visible = false;
    } else if (attachedGlbScene) {
      attachedGlbScene.visible = !cockpitRoadOnly;
      placeholderGroup.visible = false;
    } else {
      placeholderGroup.visible = false;
    }

    const showLights = !cockpitRoadOnly && hasAnyCarModel && !isIdleShowroom;
    // Keep procedural box meshes (tailLampMeshes & headlightLenses) hidden whenever a 3D car model is attached
    // so they never float in front of or behind the sculpted car bumpers!
    for (const lamp of tailLampMeshes) {
      if (lamp) lamp.visible = false;
    }
    for (const plane of tailLightGlowPlanes) {
      if (plane) plane.visible = false;
    }
    for (const lens of headlightLenses) {
      if (lens) lens.visible = false;
    }
    for (const spot of headlightSpotLights) {
      if (spot) spot.visible = false;
    }
  }

  function setIdleShowroomMode(idle) {
    const nextIdle = Boolean(idle);
    const changed = nextIdle !== isIdleShowroom;
    isIdleShowroom = nextIdle;

    if (nextIdle) {
      for (const pGroup of flameCones) {
        if (pGroup) pGroup.visible = false;
      }
      sparkFireLight.intensity = 0.0;
      brakeTailLight.intensity = 0.0;
      driftSmokeMesh.visible = false;
      if (hadActiveSparks || sparkPoints.visible) {
        sparkLifeAttr.fill(0.0);
        for (let i = 0; i < sparkCount; i++) {
          sparkAges[i] = 999;
          sparkPositions[i * 3 + 1] = -10.0;
        }
        sparkGeo.attributes.position.needsUpdate = true;
        sparkGeo.attributes.aLife.needsUpdate = true;
        hadActiveSparks = false;
      }
      sparkPoints.visible = false;
      if (attachedCosmoCar && attachedCosmoCar.setBraking) {
        attachedCosmoCar.setBraking(false);
      }
    }

    if (changed || nextIdle) {
      for (const spot of headlightSpotLights) {
        if (spot) spot.visible = false;
      }
    }
  }

  async function attachCosmoCar(carId = 'coupe', paintHex = null) {
    const normId = normalizeCarId(carId);
    const reqId = ++cosmoLoadReqId;

    if (normId === 's64') {
      if (attachedS64Car) {
        attachedS64Car.setConfiguration({
          bodyId: 'kit1',
          rimId: currentRimId,
          spoilerId: currentSpoilerId,
          paintHex: paintHex !== undefined ? paintHex : currentPaintHex,
        });
        syncActiveCarVisibility();
        return;
      }
      if (s64LazyLoaderFn && !s64LazyLoadRequested) {
        s64LazyLoadRequested = true;
        s64LazyLoaderFn();
      }
    }

    const targetCarId = normId === 's64' ? 'coupe' : normId;

    // Fast synchronous reuse if this exact Cosmo car is already attached
    if (attachedCosmoCar && attachedCosmoCar.carId === targetCarId) {
      attachedCosmoCar.setPaint(paintHex !== undefined ? paintHex : currentPaintHex);
      syncActiveCarVisibility();
      return attachedCosmoCar;
    }

    try {
      const cosmoInstance = await createCosmoCarInstance(
        targetCarId,
        paintHex !== undefined ? paintHex : currentPaintHex
      );
      if (reqId !== cosmoLoadReqId) {
        if (cosmoInstance.dispose) cosmoInstance.dispose();
        return;
      }
      if (attachedCosmoCar) {
        chassisGroup.remove(attachedCosmoCar.assemblyRoot);
        if (attachedCosmoCar.dispose) attachedCosmoCar.dispose();
      }
      attachedCosmoCar = cosmoInstance;
      chassisGroup.add(cosmoInstance.assemblyRoot);
      syncActiveCarVisibility();
      return cosmoInstance;
    } catch (err) {
      console.warn('attachCosmoCar error:', err);
    }
  }

  function setCustomParts({ bodyId, rimId, spoilerId, paintHex } = {}) {
    if (bodyId) currentBodyKit = bodyId;
    if (rimId) currentRimId = rimId;
    if (spoilerId !== undefined) currentSpoilerId = spoilerId;
    if (paintHex !== undefined) currentPaintHex = paintHex;

    applyProceduralRimAndSpoiler();
    attachCosmoCar(currentBodyKit, currentPaintHex);

    if (attachedS64Car) {
      attachedS64Car.setConfiguration({
        bodyId: currentBodyKit === 's64' ? 'kit1' : currentBodyKit,
        rimId: currentRimId,
        spoilerId: currentSpoilerId,
        paintHex: currentPaintHex,
      });
    } else if (attachedGlbScene) {
      applyBodyKitToGlb(attachedGlbScene, currentBodyKit);
    }
    syncActiveCarVisibility();
  }

  function setBodyKit(kitId, customOverrides) {
    const nextKit = kitId || 'coupe';
    const def = KIT_DEFAULT_PARTS[nextKit] || KIT_DEFAULT_PARTS.kit1;
    const nextRim = customOverrides?.rimId || def?.rimId || 'rim0';
    const nextSpoiler =
      customOverrides?.spoilerId !== undefined ? customOverrides.spoilerId : (def?.spoilerId || 'spoiler0');
    const nextPaint =
      customOverrides?.paintHex !== undefined ? customOverrides.paintHex : currentPaintHex;

    const targetNorm = normalizeCarId(nextKit);
    const alreadyLoadedTarget =
      (targetNorm === 's64' && attachedS64Car) ||
      (targetNorm !== 's64' && attachedCosmoCar && attachedCosmoCar.carId === targetNorm);

    if (
      alreadyLoadedTarget &&
      currentBodyKit === nextKit &&
      currentRimId === nextRim &&
      currentSpoilerId === nextSpoiler &&
      currentPaintHex === nextPaint
    ) {
      syncActiveCarVisibility();
      return;
    }

    currentBodyKit = nextKit;
    currentRimId = nextRim;
    currentSpoilerId = nextSpoiler;
    currentPaintHex = nextPaint;

    attachCosmoCar(currentBodyKit, currentPaintHex);

    if (currentPaintHex) {
      redFairingMat.color.set(currentPaintHex);
      redFairingMat.metalness = 0.68;
      redFairingMat.roughness = 0.16;
      whiteStripeMat.color.setHex(0x111827);
    } else if (currentBodyKit === 'kit2' || currentBodyKit === 'kamaro') {
      redFairingMat.color.setHex(0x00e5ff);
      redFairingMat.metalness = 0.62;
      redFairingMat.roughness = 0.16;
      whiteStripeMat.color.setHex(0x0d1726);
    } else if (currentBodyKit === 'kit3' || currentBodyKit === 'ghini') {
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
        bodyId: currentBodyKit === 's64' ? 'kit1' : currentBodyKit,
        rimId: currentRimId,
        spoilerId: currentSpoilerId,
        paintHex: currentPaintHex,
      });
    } else if (attachedGlbScene) {
      applyBodyKitToGlb(attachedGlbScene, currentBodyKit);
    }
    syncActiveCarVisibility();
  }

  function setCockpitRoadOnly(isRoadOnly) {
    cockpitRoadOnly = Boolean(isRoadOnly);
    syncActiveCarVisibility();
  }

  function attachS64ModularCar(s64Car) {
    attachedS64Car = s64Car;
    chassisGroup.add(s64Car.carAssemblyRoot);
    s64Car.setConfiguration({
      bodyId: currentBodyKit === 's64' ? 'kit1' : currentBodyKit,
      rimId: currentRimId,
      spoilerId: currentSpoilerId,
      paintHex: currentPaintHex,
    });
    syncActiveCarVisibility();
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
    setIdleShowroomMode,
    setBodyKit,
    setCustomParts,
    setS64LazyLoader,
    updateWheels,
    updateKartVisuals,
    attachGlbKart,
    attachS64ModularCar,
    attachCosmoCar,
  };
}
