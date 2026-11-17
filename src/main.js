import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/addons/shaders/FXAAShader.js';

import { buildMicroKart } from './scene/MicroKartBuilder.js';
import { preloadCoreCosmoCars, preloadAllCosmoCars } from './scene/CosmoCarLoader.js';
import { loadS64ModularCar } from './scene/S64CarLoader.js';
import { normalizeCarId, normalizeMapId } from './types/game';
import { buildGoldenHourAtmosphere } from './scene/GoldenHourAtmosphere.js';
import { getTrackSplineForMap } from './scene/WorldTrackRegistry.js';
import { buildPitLaneGarage } from './scene/PitLaneGarageBuilder.js';
import { buildRealWorldMap } from './scene/RealWorldMapBuilder.js';
import { createKartPhysicsController } from './physics/KartPhysicsController.js';
import { createWebAudioSynth } from './audio/WebAudioSynth.js';
import { createPowerupManager } from './combat/PowerupManager.js';
import { createRivalRacersController } from './combat/RivalRacersController.js';
import { createVFXManager } from './scene/VFXManager.js';

async function initApp() {
  const container = document.getElementById('canvas-container');

  // -------------------------------------------------------------------------
  // 1. THREE.JS SCENE, RENDERER & ACES FILMIC + UNREAL BLOOM POST-PROCESSING
  // -------------------------------------------------------------------------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x181312);
  scene.fog = new THREE.FogExp2(0x181312, 0.018);

  const camera = new THREE.PerspectiveCamera(
    54,
    window.innerWidth / window.innerHeight,
    0.002, // 2mm near plane for 1:87 HO micro-scale closeups!
    12.0
  );

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  const urlParams = new URLSearchParams(window.location.search);
  const isScreenshotUrl = urlParams.get('screenshot') === '1';
  const isScreenshotMode = isScreenshotUrl;

  // Immediately initialize Welcome Button warmup state & grab keyboard focus into the iframe
  // so pressing Enter never triggers a parent-frame toolbar Reload button or flashes prematurely
  const earlyBtnWelcomeStart = document.getElementById('btn-welcome-start');
  const earlyWelcomeStartText = document.getElementById('welcome-start-text');
  const earlyWelcomeEnterKbd = document.getElementById('welcome-enter-kbd');
  const earlyWelcomeProgressFill = document.getElementById('welcome-btn-progress-fill');
  if (!isScreenshotMode && earlyBtnWelcomeStart) {
    earlyBtnWelcomeStart.classList.add('is-warming-up');
    if (earlyWelcomeProgressFill) earlyWelcomeProgressFill.style.width = '8%';
    if (earlyWelcomeStartText) earlyWelcomeStartText.textContent = 'PREPARING CIRCUIT...';
    if (earlyWelcomeEnterKbd) earlyWelcomeEnterKbd.textContent = '8%';
    try {
      window.focus();
      earlyBtnWelcomeStart.focus({ preventScroll: true });
    } catch (_e) {
      // Ignore cross-origin focus restrictions
    }
  }

  const pixelRatio = isScreenshotUrl ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.35);
  renderer.setPixelRatio(pixelRatio);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.78 + 0.08 * 1.15;
  renderer.debug.checkShaderErrors = false;
  container.appendChild(renderer.domElement);

  // Balanced Automotive Studio & Sky Horizon PMREM: luminous sky-slate dome + soft horizon ring
  // + studio softbox strips so metallic bodywork catches rich sky/horizon highlights instead of crushing into black.
  function createAutomotiveStudioEnv() {
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x334b72);

    const studioAmbient = new THREE.HemisphereLight(0xdbeafe, 0x475569, 1.35);
    envScene.add(studioAmbient);

    // Subtle 360° luminous horizon band so side panels and rear fenders catch clean sky reflections
    const horizonGeo = new THREE.CylinderGeometry(16, 16, 4.5, 24, 1, true);
    const horizonRing = new THREE.Mesh(
      horizonGeo,
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(1.35, 1.48, 1.72),
        side: THREE.BackSide,
      })
    );
    horizonRing.position.set(0, 2.0, 0);
    envScene.add(horizonRing);

    const stripGeo = new THREE.BoxGeometry(1, 1, 1);

    // 1. Overhead slender softbox ribbon (draws crisp highlight down hood, glass & roof)
    const topStrip = new THREE.Mesh(
      stripGeo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(5.2, 5.2, 5.2) })
    );
    topStrip.position.set(0, 12, 0);
    topStrip.scale.set(2.8, 0.2, 18.0);
    envScene.add(topStrip);

    // 2. Front-right cool ice-blue accent strip (sculpts fenders & wheel rims)
    const keyStrip = new THREE.Mesh(
      stripGeo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 3.4, 4.0) })
    );
    keyStrip.position.set(12, 5.5, 10);
    keyStrip.lookAt(0, 0, 0);
    keyStrip.scale.set(5.0, 1.6, 0.2);
    envScene.add(keyStrip);

    // 3. Rear-left warm golden rim strip (highlights rear haunches & spoiler silhouette)
    const rimStrip = new THREE.Mesh(
      stripGeo,
      new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 2.6, 1.8) })
    );
    rimStrip.position.set(-12, 6.0, -10);
    rimStrip.lookAt(0, 0, 0);
    rimStrip.scale.set(5.4, 1.4, 0.2);
    envScene.add(rimStrip);

    return envScene;
  }

  const pmremGenerator = new THREE.PMREMGenerator(renderer);
  const studioEnvScene = createAutomotiveStudioEnv();
  scene.environment = pmremGenerator.fromScene(studioEnvScene, 0.03).texture;
  studioEnvScene.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry?.dispose();
      obj.material?.dispose();
    }
  });
  scene.environmentIntensity = 0.65;

  const composer = new EffectComposer(renderer);
  const rtSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  composer.renderTarget1.depthTexture = new THREE.DepthTexture(rtSize.x, rtSize.y, THREE.FloatType);
  composer.renderTarget2.depthTexture = new THREE.DepthTexture(rtSize.x, rtSize.y, THREE.FloatType);

  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  const bokehPass = new BokehPass(scene, camera, {
    focus: 0.12,
    aperture: 0.0065 * 0.35,
    maxblur: 0.0045 * 0.35,
  });
  const unusedDepthTarget = bokehPass._renderTargetDepth || bokehPass.renderTargetDepth;
  if (unusedDepthTarget) {
    unusedDepthTarget.dispose();
  }
  bokehPass.setSize = function (width, height) {
    this.materialBokeh.uniforms['aspect'].value = width / height;
  };

  // Single-pass hardware-depth BokehPass with a 25-tap Golden-Angle Vogel Spiral disc kernel:
  // - Reads hardware DepthTexture directly (DEPTH_PACKING = 0 -> zero MeshDepthMaterial geometry pass)
  // - Single render target pass (no extra downsample pass or dual-sampler branching)
  // - Uniform disc coverage at 40% fewer texture fetches than the stock 41-tap concentric ring shader
  bokehPass.materialBokeh.defines.DEPTH_PACKING = 0;
  bokehPass.materialBokeh.fragmentShader = /* glsl */ `
    #include <common>
    varying vec2 vUv;
    uniform sampler2D tColor;
    uniform sampler2D tDepth;
    uniform float maxblur;
    uniform float aperture;
    uniform float nearClip;
    uniform float farClip;
    uniform float focus;
    uniform float aspect;
    #include <packing>

    float getDepth( const in vec2 screenPosition ) {
      return texture2D( tDepth, screenPosition ).x;
    }

    float getViewZ( const in float depth ) {
      #if PERSPECTIVE_CAMERA == 1
        return perspectiveDepthToViewZ( depth, nearClip, farClip );
      #else
        return orthographicDepthToViewZ( depth, nearClip, farClip );
      #endif
    }

    void main() {
      vec2 aspectcorrect = vec2( 1.0, aspect );
      float viewZ = getViewZ( getDepth( vUv ) );
      float rawFactor = focus + viewZ;
      // Keep a generous crystal-sharp focal band (>= ±11mm in macro close-ups) so the entire 13mm
      // kart body, wheels, and helmet stay 100% tack-sharp while background props melt into bokeh
      float deadzone = max( 0.011, focus * 0.095 );
      float absDiff = max( 0.0, abs( rawFactor ) - deadzone );
      // Relative optical circle-of-confusion scaling so close-up macro shots (focus ~ 0.06m) and
      // wide shots (focus ~ 0.50m) both transition smoothly without sudden foreground clipping
      float normScale = 1.0 / max( 0.22, focus * 1.15 );
      float signedFactor = sign( rawFactor ) * absDiff * ( 0.42 + 0.16 * normScale );
      vec2 dofblur = vec2( clamp( signedFactor * aperture, -maxblur, maxblur ) );
      vec2 radius = dofblur * aspectcorrect;

      vec4 col = texture2D( tColor, vUv );
      float centerBlurMag = abs( dofblur.x );
      if ( centerBlurMag < 0.00020 ) {
        gl_FragColor = vec4( col.rgb, 1.0 );
        return;
      }

      // Lightweight 12-tap Golden-Angle Vogel spiral for mobile 60 FPS performance
      float ign = fract( 52.9829189 * fract( dot( gl_FragCoord.xy, vec2( 0.06711056, 0.00583715 ) ) ) );
      float thetaJitter = ( ign - 0.5 ) * 0.45;
      float cj = cos( thetaJitter );
      float sj = sin( thetaJitter );
      mat2 rotMat = mat2( cj, -sj, sj, cj );

      vec4 acc = col;
      float totalWeight = 1.0;
      for ( int i = 1; i <= 12; i++ ) {
        float fi = float( i );
        float r = sqrt( fi / 12.5 );
        float theta = fi * 2.39996323;
        vec2 offset = rotMat * ( vec2( cos( theta ), sin( theta ) ) * r );
        vec2 sampleUv = vUv + offset * radius;
        acc += texture2D( tColor, sampleUv );
        totalWeight += 1.0;
      }

      gl_FragColor = vec4( acc.rgb / totalWeight, 1.0 );
    }
  `;
  bokehPass.materialBokeh.needsUpdate = true;
  bokehPass.enabled = false;

  composer.addPass(bokehPass);

  const bloomPass = new UnrealBloomPass(
    new THREE.Vector2(
      Math.max(1, Math.floor(window.innerWidth * 0.5)),
      Math.max(1, Math.floor(window.innerHeight * 0.5))
    ),
    0.04, // toned-down mobile-friendly bloom strength for smooth 60 FPS
    0.18, // radius
    1.20  // threshold
  );
  composer.addPass(bloomPass);
  composer.addPass(new OutputPass());

  const fxaaPass = new ShaderPass(FXAAShader);
  const drawSize = renderer.getDrawingBufferSize(new THREE.Vector2());
  fxaaPass.material.uniforms['resolution'].value.set(1.0 / drawSize.x, 1.0 / drawSize.y);
  composer.addPass(fxaaPass);

  const orbitControls = new OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.06;
  orbitControls.minDistance = 0.015;
  orbitControls.maxDistance = 2.2;
  orbitControls.target.set(0.0, 0.075, -0.03);
  orbitControls.enabled = false;

  // -------------------------------------------------------------------------
  // 2. INITIALIZE REAL-WORLD MAP REGISTRY & SPLINE DATA ('coast' | 'city' | 'canyon')
  // -------------------------------------------------------------------------
  let currentMapId = 'coast';
  let initialSavedKitId = 'coupe';
  let initialSavedPaintHex = null;
  try {
    const savedMap = window.localStorage.getItem('the_race_3d_selected_map_v1');
    if (savedMap) currentMapId = normalizeMapId(savedMap);
    const savedKit = window.localStorage.getItem('the_race_3d_equipped_kit_v1');
    if (savedKit) initialSavedKitId = normalizeCarId(savedKit);
    const savedPaint = window.localStorage.getItem('the_race_3d_equipped_paint_v1');
    if (savedPaint && savedPaint.startsWith('#')) initialSavedPaintHex = savedPaint;
  } catch (_e) {
    // ignore storage read error
  }

  let splineData = getTrackSplineForMap(currentMapId);
  const sectorNames = {};
  function syncSectorNames(sData) {
    for (const k of Object.keys(sectorNames)) {
      delete sectorNames[k];
    }
    for (const sec of sData.sectors || []) {
      sectorNames[sec.id] = sec.name;
    }
  }
  syncSectorNames(splineData);

  // -------------------------------------------------------------------------
  // 3. BUILD OUTDOOR ATMOSPHERE, PIT-LANE GARAGE SHOWROOM & ACTIVE REAL-WORLD MAP
  // -------------------------------------------------------------------------
  const settings = {
    sunIntensity: 0.0,
    sunbeamIntensity: 0.0,
    lampIntensity: 1.15,
    trackGlowIntensity: 1.00,
    micGlowIntensity: 0.85,
    bloomStrength: 0.04,
    dofStrength: 0.0,
    toneMappingExposure: 0.76,
    showDustMotes: false,
    droneKartScale: false,
    panoKart100: true,
  };
  scene.environmentIntensity = 0.72;

  const atmosphere = buildGoldenHourAtmosphere(scene);
  const pitGarage = buildPitLaneGarage(scene, new THREE.Vector3(0.0, 0.088, 0.22));
  pitGarage.rootGroup.visible = false; // Shown strictly in GARAGE workshop mode
  let activeWorldMap = buildRealWorldMap(currentMapId, splineData, scene);
  activeWorldMap.rootGroup.visible = true; // Shown live on HOME Start-Grid & during RACE

  const microKart = buildMicroKart();
  microKart.kartRoot.scale.setScalar(0.56);
  scene.add(microKart.kartRoot);
  if (microKart.driftSmokeMesh) {
    scene.add(microKart.driftSmokeMesh);
  }

  // -------------------------------------------------------------------------
  // 3A. 3x AI OPPONENT CARS, BOOST PADS & STRAIGHTAWAY LAUNCH RAMPS
  // -------------------------------------------------------------------------
  const powerupManager = createPowerupManager(splineData, scene);
  const rivalsController = createRivalRacersController(splineData, scene);
  let vfxManager = createVFXManager(scene);
  vfxManager.setVisible(false);

  // -------------------------------------------------------------------------
  // 3B. 3D SHOWROOM TURNTABLE PEDESTAL (FOR 'SPLASH', 'MENU', AND 'GARAGE' STATES)
  // -------------------------------------------------------------------------
  const showroomGroup = new THREE.Group();
  showroomGroup.name = 'ShowroomTurntableGroup';
  showroomGroup.position.set(0.0, 0.088, 0.22);
  scene.add(showroomGroup);

  const showroomPlatform = new THREE.Group();
  showroomGroup.add(showroomPlatform);

  const pedestalMat = new THREE.MeshStandardMaterial({
    color: 0x0c101a,
    roughness: 0.22,
    metalness: 0.82,
  });
  const pedestalBase = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0155, 0.0178, 0.0022, 64),
    pedestalMat
  );
  pedestalBase.position.y = -0.0011;
  showroomPlatform.add(pedestalBase);

  const topPlateMat = new THREE.MeshStandardMaterial({
    color: 0x1a2336,
    roughness: 0.22,
    metalness: 0.62,
  });
  const topPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0138, 0.0142, 0.0005, 64),
    topPlateMat
  );
  topPlate.position.y = 0.0001;
  topPlate.receiveShadow = true;
  pedestalBase.receiveShadow = true;
  showroomPlatform.add(topPlate);

  // Studio Overhead Contact-Shadow Disc under the Car on the Turntable Plate
  const srShadowCanvas = document.createElement('canvas');
  srShadowCanvas.width = 256;
  srShadowCanvas.height = 256;
  const srCtx = srShadowCanvas.getContext('2d');
  if (srCtx) {
    srCtx.clearRect(0, 0, 256, 256);
    srCtx.save();
    srCtx.translate(128, 128);
    srCtx.scale(0.72, 1.08);
    const gOuter = srCtx.createRadialGradient(0, 0, 12, 0, 0, 114);
    gOuter.addColorStop(0.0, 'rgba(0, 0, 0, 0.96)');
    gOuter.addColorStop(0.45, 'rgba(1, 3, 8, 0.88)');
    gOuter.addColorStop(0.75, 'rgba(2, 6, 14, 0.45)');
    gOuter.addColorStop(1.0, 'rgba(2, 6, 14, 0.0)');
    srCtx.fillStyle = gOuter;
    srCtx.beginPath();
    srCtx.arc(0, 0, 114, 0, Math.PI * 2);
    srCtx.fill();
    srCtx.restore();
  }
  const srShadowTex = new THREE.CanvasTexture(srShadowCanvas);
  const showroomCarShadowDisc = new THREE.Mesh(
    new THREE.PlaneGeometry(0.022, 0.026),
    new THREE.MeshBasicMaterial({
      map: srShadowTex,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
    })
  );
  showroomCarShadowDisc.rotation.x = -Math.PI / 2;
  showroomCarShadowDisc.position.set(0, 0.00042, 0);
  showroomGroup.add(showroomCarShadowDisc);

  // Outer Glowing Cyan Neon Ring
  const outerRingMat = new THREE.MeshStandardMaterial({
    color: 0x00f0ff,
    emissive: new THREE.Color(0x00e5ff),
    emissiveIntensity: 1.75,
    roughness: 0.1,
    metalness: 0.2,
    toneMapped: false,
  });
  const outerNeonRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.0156, 0.00038, 16, 72),
    outerRingMat
  );
  outerNeonRing.rotation.x = Math.PI / 2;
  outerNeonRing.position.y = 0.00015;
  showroomPlatform.add(outerNeonRing);

  // Inner Glowing Amber/Gold Accent Ring
  const innerRingMat = new THREE.MeshStandardMaterial({
    color: 0xffb830,
    emissive: new THREE.Color(0xff9900),
    emissiveIntensity: 1.35,
    roughness: 0.15,
    metalness: 0.3,
    toneMapped: false,
  });
  const innerNeonRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.0114, 0.00024, 16, 64),
    innerRingMat
  );
  innerNeonRing.rotation.x = Math.PI / 2;
  innerNeonRing.position.y = 0.00036;
  showroomPlatform.add(innerNeonRing);

  // 12 radial tick bars on the turntable surface so rotation is visually unmistakable
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(0.00045, 0.00018, 0.0024),
      i % 2 === 0 ? outerRingMat : innerRingMat
    );
    tick.position.set(
      Math.sin(angle) * 0.0132,
      0.00038,
      Math.cos(angle) * 0.0132
    );
    tick.rotation.y = angle;
    showroomPlatform.add(tick);
  }

  // Dedicated 3-Point Showroom Studio Lighting Rig + Overhead Spotlight aimed directly at the car
  const showroomLightTarget = new THREE.Object3D();
  showroomLightTarget.position.set(0.0, 0.0025, 0.0);
  showroomGroup.add(showroomLightTarget);

  // 1. Direct Overhead Studio Directional Light + Crisp Contact Shadow Mapping
  const showroomOverheadDirLight = new THREE.DirectionalLight(0xffffff, 0.38);
  showroomOverheadDirLight.position.set(0.0, 0.095, 0.002);
  showroomOverheadDirLight.target = showroomLightTarget;
  showroomOverheadDirLight.castShadow = true;
  showroomOverheadDirLight.shadow.mapSize.set(1024, 1024);
  showroomOverheadDirLight.shadow.camera.near = 0.005;
  showroomOverheadDirLight.shadow.camera.far = 0.18;
  showroomOverheadDirLight.shadow.camera.left = -0.024;
  showroomOverheadDirLight.shadow.camera.right = 0.024;
  showroomOverheadDirLight.shadow.camera.top = 0.024;
  showroomOverheadDirLight.shadow.camera.bottom = -0.024;
  showroomOverheadDirLight.shadow.bias = -0.0005;
  showroomOverheadDirLight.shadow.normalBias = 0.0008;
  showroomGroup.add(showroomOverheadDirLight);

  // 2. Front-Right Warm Key Light (sculpts 3D hood bevels & side character lines)
  const showroomKeyLight = new THREE.DirectionalLight(0xfff7ed, 0.58);
  showroomKeyLight.position.set(0.024, 0.036, 0.032);
  showroomKeyLight.target = showroomLightTarget;
  showroomGroup.add(showroomKeyLight);

  // 3. Front-Left Cool Sky Fill Light (shadow side stays deeply 3D)
  const showroomFillLight = new THREE.DirectionalLight(0x93c5fd, 0.18);
  showroomFillLight.position.set(-0.026, 0.024, 0.026);
  showroomFillLight.target = showroomLightTarget;
  showroomGroup.add(showroomFillLight);

  // 4. Rear-Top Golden Rim Backlight (crisp edge silhouette along roofline & rear spoiler)
  const showroomRimLight = new THREE.DirectionalLight(0xfde68a, 0.34);
  showroomRimLight.position.set(0.0, 0.032, -0.030);
  showroomRimLight.target = showroomLightTarget;
  showroomGroup.add(showroomRimLight);

  // 5. Subtle Cyan Bounce Light from glowing turntable ring
  const showroomUnderFill = new THREE.PointLight(0x38bdf8, 0.07, 0.055, 1.4);
  showroomUnderFill.position.set(0.0, 0.0045, 0.018);
  showroomGroup.add(showroomUnderFill);

  let currentAppScreen = 'SPLASH';
  let turntableAngle = 0.45;
  let manualTurntableCooldown = 0.0;
  const telemetryListeners = new Set();
  const raceFinishListeners = new Set();

  // Dedicated post-Bokeh scene for 3D Drift & Boost Sparks so airborne sparks
  // flying off the edge of the track in front of distant background walls use
  // their OWN 3D view-space depth (mvPosition.z) rather than being blurred by
  // the background wall's depth in readBuffer.depthTexture!
  const sparkScene = new THREE.Scene();
  sparkScene.add(microKart.sparkPoints);

  function syncKartScaleForCamera(mode) {
    const is1P = mode === 1 || mode === 2;
    const targetScale = is1P
      ? 0.56
      : settings.panoKart100
        ? 1.00
        : settings.droneKartScale
          ? 0.78
          : 0.58;
    microKart.kartRoot.scale.setScalar(targetScale);
  }

  // ZERO-GEOMETRY-PASS BOKEHPASS RENDER:
  // Because RenderPass already renders the opaque scene with a hardware DepthTexture attached to
  // readBuffer.depthTexture (and transparent sunbeams/dust/sparks/AO decals have depthWrite: false),
  // BokehPass reads readBuffer.depthTexture directly without re-rendering any 3D meshes!
  const renderBokehFullscreenQuad = (pass, rendererArg, mat) => {
    const fsQuad = pass._fsQuad || pass.fsQuad;
    if (fsQuad) {
      fsQuad.material = mat;
      fsQuad.render(rendererArg);
    } else if (pass.quad2 && pass.scene2 && pass.camera2) {
      pass.quad2.material = mat;
      rendererArg.render(pass.scene2, pass.camera2);
    }
  };

  bokehPass.render = function (rendererArg, writeBuffer, readBuffer /*, deltaTime, maskActive */) {
    this.uniforms['tColor'].value = readBuffer.texture;
    this.uniforms['tDepth'].value = readBuffer.depthTexture;
    this.uniforms['nearClip'].value = this.camera.near;
    this.uniforms['farClip'].value = this.camera.far;

    if (this.renderToScreen) {
      rendererArg.setRenderTarget(null);
      renderBokehFullscreenQuad(this, rendererArg, this.materialBokeh);
    } else {
      rendererArg.setRenderTarget(writeBuffer);
      if (this.clear) rendererArg.clear();
      renderBokehFullscreenQuad(this, rendererArg, this.materialBokeh);
    }

    if (microKart && microKart.sparkPoints && microKart.sparkPoints.visible) {
      const sMat = microKart.sparkPoints.material;
      if (sMat && sMat.uniforms) {
        sMat.uniforms.tSceneDepth.value = readBuffer.depthTexture;
        sMat.uniforms.uNearClip.value = this.camera.near;
        sMat.uniforms.uFarClip.value = this.camera.far;
        sMat.uniforms.uFocus.value = this.uniforms['focus'].value;
        sMat.uniforms.uAperture.value = this.uniforms['aperture'].value;
        sMat.uniforms.uMaxBlur.value = this.uniforms['maxblur'].value;
        sMat.uniforms.uResolution.value.set(
            readBuffer.width, readBuffer.height);
      }
      const prevAutoClear = rendererArg.autoClear;
      rendererArg.autoClear = false;
      rendererArg.render(sparkScene, this.camera);
      rendererArg.autoClear = prevAutoClear;
    }
  };

  // Helper to free GPU geometry buffers of hidden procedural fallback groups once a GLB replaces them
  function disposeGroupGeometries(group) {
    if (!group) return;
    group.traverse((child) => {
      if (child.isMesh && child.geometry) {
        child.geometry.dispose();
      }
    });
  }

  // Optional GLB Loader (Hybrid Architecture: seamlessly loads GLBs if/when present)
  const gltfLoader = new GLTFLoader();
  const loadedGlbStatus = {
    desk: false,
    track: false,
    kart: false,
    room: false,
  };
  const loadingGlbInProgress = {
    desk: false,
    track: false,
    kart: false,
    room: false,
  };
  const glbContainerGroup = new THREE.Group();
  glbContainerGroup.name = 'LoadedGLBAssetsGroup';
  scene.add(glbContainerGroup);

  // Bedroom furniture nodes (NeatUpholsteredBed, BoucleDeskChair, WalnutDresserAndGemini4Vignette,
  // BedroomDoorAndThermostat) are kept visible in ALL camera modes (1..8) with Three.js frustum culling
  // enabled so the bed, chair, dresser, and door are always visible when the kart turns toward them in
  // 1P Views 1 & 2, while only inside-volume GodRayCurtain planes are hidden in 1P.
  const highPolyRoomFurnitureNodes = [];

  function sync1PRoomAndCurtainVisibility(mode) {
    const is1P = mode === 1 || mode === 2;
    if (atmosphere.godRayCurtainGroup) {
      atmosphere.godRayCurtainGroup.visible = !is1P;
    }
  }

  function updateGlbBadge() {
    const badge = document.getElementById('glb-status-badge');
    if (!badge) return;
    const count =
      (loadedGlbStatus.desk ? 1 : 0) +
      (loadedGlbStatus.track ? 1 : 0) +
      (loadedGlbStatus.kart ? 1 : 0) +
      (loadedGlbStatus.room ? 1 : 0);
    if (count === 4) {
      badge.textContent = '4/4 GLB + HYBRID SHADERS ACTIVE';
    } else if (count > 0) {
      badge.textContent = `${count}/4 GLB + PROCEDURAL HYBRID`;
    } else {
      badge.textContent = 'HYBRID PROCEDURAL + GLB READY';
    }
  }

  let activeCameraMode = 1; // Default: 1:150 Low Chase Cam
  let glbPollInterval = null;
  const settledGlbStatus = {
    desk: false,
    track: false,
    kart: false,
    room: false,
  };
  const glbDownloadProgress = {
    desk: 0.0,
    track: 0.0,
    kart: 0.0,
    room: 0.0,
  };
  const expectedGlbBytes = {
    desk: 4185040,
    track: 5303580,
    kart: 197544,
    room: 4537988,
  };
  let audioPreloadProgress = 0.0;
  let isCircuitReady = isScreenshotMode;
  let pendingRaceStartAfterWarmup = false;
  let onCircuitWarmupProgressCallback = null;
  let onCircuitReadyCallback = null;

  const texPropNames = [
    'map',
    'normalMap',
    'roughnessMap',
    'metalnessMap',
    'emissiveMap',
    'aoMap',
    'alphaMap',
    'lightMap',
    'bumpMap',
    'envMap',
  ];
  const initializedTextures = new Set();

  function tryInitTex(tex) {
    if (tex && tex.isTexture && !initializedTextures.has(tex)) {
      initializedTextures.add(tex);
      try {
        renderer.initTexture(tex);
      } catch (_e) {
        // Ignore fallback texture init warnings
      }
    }
  }

  function initObjectTextures(rootObj) {
    if (isScreenshotMode || !rootObj) return;
    rootObj.traverse((obj) => {
      if (!obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const prop of texPropNames) {
          if (mat[prop]) tryInitTex(mat[prop]);
        }
        if (mat.uniforms) {
          for (const uKey of Object.keys(mat.uniforms)) {
            const uVal = mat.uniforms[uKey] && mat.uniforms[uKey].value;
            if (uVal && uVal.isTexture) tryInitTex(uVal);
          }
        }
      }
    });
  }

  /**
   * Forces WebGL to upload all textures, vertex/index buffers (VBOs/IBOs), and compile + link
   * all active shader variants across all 360° sectors of the desk & room using a single
   * lightweight 64x64 off-screen render pass with frustum culling temporarily disabled.
   * Restores 100.0% of scene/camera state so Lap 1 has zero stutters and zero GPU spike.
   */
  function warmUpSceneOnGpu() {
    if (isScreenshotMode) return;
    let warmupTarget = null;
    try {
      if (scene.environment) {
        tryInitTex(scene.environment);
      }

      // Temporarily reveal race-time dynamic meshes (F1 start light pods, boost exhaust cones,
      // drift/boost sparks) so their shaders & VBOs are resident before Lap 1 begins
      const prevSparkVis = microKart.sparkPoints ? microKart.sparkPoints.visible : true;
      if (microKart.sparkPoints) {
        microKart.sparkPoints.visible = true;
      }

      const tempShownObjects = [];
      if (microKart.chassisGroup) {
        microKart.chassisGroup.traverse((c) => {
          if (c.userData && c.userData.jetMat && !c.visible) {
            tempShownObjects.push(c);
            c.visible = true;
          }
        });
      }
      if (atmosphere.godRayCurtainGroup && !atmosphere.godRayCurtainGroup.visible) {
        tempShownObjects.push(atmosphere.godRayCurtainGroup);
        atmosphere.godRayCurtainGroup.visible = true;
      }
      const isCountdownCurrentlyActive =
        typeof f1CountdownState !== 'undefined' && f1CountdownState && f1CountdownState.active;
      if (activeWorldMap && activeWorldMap.setF1StartLights && !isCountdownCurrentlyActive) {
        activeWorldMap.setF1StartLights(5);
      }

      const savedFrustumCulled = new Map();
      const prepareActiveTree = (rootObj) => {
        if (!rootObj || !rootObj.visible) return;
        savedFrustumCulled.set(rootObj, rootObj.frustumCulled);
        rootObj.frustumCulled = false;

        if (rootObj.material) {
          const mats = Array.isArray(rootObj.material) ? rootObj.material : [rootObj.material];
          for (const mat of mats) {
            if (!mat) continue;
            for (const prop of texPropNames) {
              if (mat[prop]) tryInitTex(mat[prop]);
            }
            if (mat.uniforms) {
              for (const uKey of Object.keys(mat.uniforms)) {
                const uVal = mat.uniforms[uKey] && mat.uniforms[uKey].value;
                if (uVal && uVal.isTexture) tryInitTex(uVal);
              }
            }
          }
        }

        if (rootObj.children) {
          for (let i = 0; i < rootObj.children.length; i++) {
            prepareActiveTree(rootObj.children[i]);
          }
        }
      };

      prepareActiveTree(scene);
      prepareActiveTree(sparkScene);

      const prevTarget = renderer.getRenderTarget();
      const prevAutoClear = renderer.autoClear;
      const prevLampShadowUpdate = atmosphere.lampKeyLight
        ? atmosphere.lampKeyLight.shadow.needsUpdate
        : false;
      const prevSunShadowUpdate = atmosphere.sunLight
        ? atmosphere.sunLight.shadow.needsUpdate
        : false;
      if (atmosphere.lampKeyLight) atmosphere.lampKeyLight.shadow.needsUpdate = false;
      if (atmosphere.sunLight) atmosphere.sunLight.shadow.needsUpdate = false;

      // Single 64x64 off-screen draw pass with frustumCulled=false compiles all visible shaders
      // and uploads all VBOs/IBOs across 360° with negligible fragment cost
      warmupTarget = new THREE.WebGLRenderTarget(64, 64);
      renderer.setRenderTarget(warmupTarget);
      renderer.autoClear = true;
      renderer.render(scene, camera);

      if (
        microKart.sparkPoints &&
        microKart.sparkPoints.material &&
        microKart.sparkPoints.material.uniforms
      ) {
        const sMat = microKart.sparkPoints.material;
        const prevDepthTex = sMat.uniforms.tSceneDepth.value;
        sMat.uniforms.tSceneDepth.value = composer.renderTarget2.depthTexture;
        sMat.uniforms.uNearClip.value = camera.near;
        sMat.uniforms.uFarClip.value = camera.far;
        sMat.uniforms.uFocus.value = 0.12;
        sMat.uniforms.uAperture.value = 0.002;
        sMat.uniforms.uMaxBlur.value = 0.002;
        renderer.autoClear = false;
        renderer.render(sparkScene, camera);
        sMat.uniforms.tSceneDepth.value = prevDepthTex;
      }

      // Restore all saved states so the visible scene is 100.0% untouched
      for (const [obj, wasCulled] of savedFrustumCulled.entries()) {
        obj.frustumCulled = wasCulled;
      }
      for (const obj of tempShownObjects) {
        obj.visible = false;
      }
      if (microKart.sparkPoints) {
        microKart.sparkPoints.visible = prevSparkVis;
      }
      if (activeWorldMap && activeWorldMap.setF1StartLights && !isCountdownCurrentlyActive) {
        activeWorldMap.setF1StartLights(0);
      }
      sync1PRoomAndCurtainVisibility(activeCameraMode);

      if (atmosphere.lampKeyLight) {
        atmosphere.lampKeyLight.shadow.needsUpdate = prevLampShadowUpdate || true;
      }
      if (atmosphere.sunLight) {
        atmosphere.sunLight.shadow.needsUpdate = prevSunShadowUpdate;
      }

      renderer.autoClear = prevAutoClear;
      renderer.setRenderTarget(prevTarget);
    } catch (err) {
      console.warn('GPU warmup warning:', err);
    } finally {
      if (warmupTarget) {
        warmupTarget.dispose();
      }
    }
  }

  function notifyWarmupProgress() {
    if (onCircuitWarmupProgressCallback) {
      onCircuitWarmupProgressCallback();
    }
  }

  function checkCircuitReady() {
    if (isCircuitReady) return;
    if (
      settledGlbStatus.desk &&
      settledGlbStatus.track &&
      settledGlbStatus.kart &&
      settledGlbStatus.room
    ) {
      warmUpSceneOnGpu();
      isCircuitReady = true;
      if (onCircuitReadyCallback) {
        onCircuitReadyCallback();
      }
    }
  }

  const REMOTE_GLB_BASE_URL = 'https://www.gstatic.com/aistudio/starter-apps/desk-racer/models';
  const PROXY_GLB_BASE_URL = '/api/gstatic-models';
  const ASSETS_GLB_BASE_URL = '/assets/models';

  function tryLoadGlbAsset(fileName, key, onLoaded) {
    if (loadedGlbStatus[key] || loadingGlbInProgress[key]) return;
    loadingGlbInProgress[key] = true;

    const candidateUrls = [
      `${ASSETS_GLB_BASE_URL}/${fileName}`,
      `${PROXY_GLB_BASE_URL}/${fileName}`,
      `${REMOTE_GLB_BASE_URL}/${fileName}`,
    ];

    const handleLoaded = (gltf) => {
      loadingGlbInProgress[key] = false;
      if (loadedGlbStatus[key]) return;
      loadedGlbStatus[key] = true;
      settledGlbStatus[key] = true;
      glbDownloadProgress[key] = 1.0;
      gltf.scene.traverse((child) => {
        if (child.isMesh) {
          child.castShadow = key !== 'room' && key !== 'kart';
          child.receiveShadow = key !== 'kart';
        }
      });
      try {
        onLoaded(gltf.scene);
        initObjectTextures(gltf.scene);
      } catch (err) {
        console.error(`GLB onLoaded warning for ${key}:`, err);
      }
      if (atmosphere.requestShadowMapUpdate) {
        atmosphere.requestShadowMapUpdate();
      }
      updateGlbBadge();
      notifyWarmupProgress();
      if (
        loadedGlbStatus.desk &&
        loadedGlbStatus.track &&
        loadedGlbStatus.kart &&
        loadedGlbStatus.room
      ) {
        if (glbPollInterval) {
          clearInterval(glbPollInterval);
          glbPollInterval = null;
        }
      }
      if (isCircuitReady) {
        // If the user started early before this GLB settled, warm up the newly added GLB now
        warmUpSceneOnGpu();
      } else {
        checkCircuitReady();
      }
    };

    const handleProgress = (xhr) => {
      if (xhr && xhr.loaded > 0) {
        const totalBytes = xhr.total > 0 ? xhr.total : (expectedGlbBytes[key] || 4000000);
        glbDownloadProgress[key] = Math.min(0.95, xhr.loaded / totalBytes);
        notifyWarmupProgress();
      }
    };

    const loadFromCandidateIndex = (idx) => {
      if (idx >= candidateUrls.length) {
        console.warn(`GLB load fallback for ${key}`);
        loadingGlbInProgress[key] = false;
        settledGlbStatus[key] = true;
        glbDownloadProgress[key] = 1.0;
        notifyWarmupProgress();
        checkCircuitReady();
        return;
      }
      gltfLoader.load(
        candidateUrls[idx],
        handleLoaded,
        handleProgress,
        () => loadFromCandidateIndex(idx + 1)
      );
    };

    loadFromCandidateIndex(0);
  }

  function checkAndLoadGlbModels() {
    settledGlbStatus.desk = true;
    settledGlbStatus.track = true;
    settledGlbStatus.room = true;
    settledGlbStatus.kart = true;
    glbDownloadProgress.desk = 1.0;
    glbDownloadProgress.track = 1.0;
    glbDownloadProgress.room = 1.0;
    glbDownloadProgress.kart = 1.0;
    isCircuitReady = true;
  }

  const audioSynth = createWebAudioSynth();
  if (audioSynth.preload) {
    audioSynth.preload().finally(() => {
      audioPreloadProgress = 1.0;
      notifyWarmupProgress();
    });
  }

  checkAndLoadGlbModels();

  // Lazy S64 FBX Loader (loads 13 FBX files only when user picks 's64' or during idle after boot)
  let s64CarPromise = null;
  function ensureS64Loaded() {
    if (s64CarPromise) return s64CarPromise;
    s64CarPromise = loadS64ModularCar()
      .then((s64Car) => {
        if (microKart.attachS64ModularCar) {
          microKart.attachS64ModularCar(s64Car);
        }
        loadedGlbStatus.kart = true;
        settledGlbStatus.kart = true;
        glbDownloadProgress.kart = 1.0;
        syncKartScaleForCamera(activeCameraMode);
        updateGlbBadge();
        return s64Car;
      })
      .catch((err) => {
        console.warn('S64 FBX load fallback:', err);
      });
    return s64CarPromise;
  }

  if (microKart.setS64LazyLoader) {
    microKart.setS64LazyLoader(ensureS64Loaded);
  }

  // Fast startup preload: ONLY load the player's equipped car + 3 rival cars cleanly before Menu opens!
  await Promise.all([
    preloadCoreCosmoCars(initialSavedKitId),
    initialSavedKitId === 's64' ? ensureS64Loaded() : Promise.resolve(),
  ]);

  if (microKart.setBodyKit) {
    microKart.setBodyKit(initialSavedKitId, { paintHex: initialSavedPaintHex });
  }
  await microKart.attachCosmoCar(initialSavedKitId, initialSavedPaintHex);
  loadedGlbStatus.kart = true;
  settledGlbStatus.kart = true;
  glbDownloadProgress.kart = 1.0;
  syncKartScaleForCamera(activeCameraMode);
  updateGlbBadge();

  if (rivalsController && rivalsController.attachCosmoRivalModels) {
    await rivalsController.attachCosmoRivalModels();
  }

  // Pre-compile BOTH Showroom and Race shaders once during startup so neither Garage open nor Match start stutters!
  try {
    if (powerupManager && powerupManager.rootGroup) powerupManager.rootGroup.visible = true;
    if (rivalsController && rivalsController.rootGroup) rivalsController.rootGroup.visible = true;
    if (vfxManager) vfxManager.setVisible(true);
    showroomGroup.visible = true;
    pitGarage.rootGroup.visible = true;
    renderer.compile(scene, camera);
    showroomGroup.visible = false;
    pitGarage.rootGroup.visible = false;
    if (vfxManager) vfxManager.setVisible(false);
    if (powerupManager && powerupManager.rootGroup) powerupManager.rootGroup.visible = false;
    if (rivalsController && rivalsController.rootGroup) rivalsController.rootGroup.visible = false;
  } catch (_err) {
    // Ignore shader precompile warnings
  }

  // Stream remaining Garage car GLBs lazily in background after Menu settles
  setTimeout(() => {
    preloadAllCosmoCars().catch(() => {});
  }, 1800);

  // Load the PLUS Modular Roads 3D Traffic Light Signal Gantry GLB at the Starting Line
  let cachedTrafficLightGlb = null;
  gltfLoader.load(
    '/models/PLUS/gltf/traffic_light_3.glb',
    (gltf) => {
      cachedTrafficLightGlb = gltf.scene;
      if (activeWorldMap && activeWorldMap.attachTrafficLightGlb) {
        activeWorldMap.attachTrafficLightGlb(cachedTrafficLightGlb);
      }
    },
    undefined,
    () => {
      // Optional prop fallback
    }
  );

  // -------------------------------------------------------------------------
  // 4. INITIALIZE 60FPS BANKED SPLINE VEHICLE CONTROLLER
  // -------------------------------------------------------------------------
  const physics = await createKartPhysicsController(
    splineData,
    null,
    activeWorldMap.roadGeo
  );

  let camShakeTimer = 0.0;
  let camShakeIntensity = 0.0;

  // Asphalt 9 / NFS Slow-Motion Finish Pass state (~0.35x timeScale over 1.25s side-tracking pass)
  const cinematicFinishState = {
    active: false,
    elapsed: 0.0,
    duration: 1.25,
    timeScale: 1.0,
    sweepSide: 1,
    finalTotal: 0.0,
    bestLap: 0.0,
    payload: null,
  };

  function cancelCinematicFinish() {
    cinematicFinishState.active = false;
    cinematicFinishState.elapsed = 0.0;
    cinematicFinishState.timeScale = 1.0;
    cinematicFinishState.payload = null;
    if (microKart && microKart.setCockpitRoadOnly) {
      microKart.setCockpitRoadOnly(activeCameraMode === 2);
    }
  }

  if (physics.onRailImpact) {
    physics.onRailImpact((severity = 0.7) => {
      if (audioSynth.playRailImpact) {
        audioSynth.playRailImpact(severity);
      }
      camShakeTimer = 0.16;
      camShakeIntensity = THREE.MathUtils.clamp(severity, 0.42, 1.0);
    });
  }

  // -------------------------------------------------------------------------
  // 5. CAMERA MODES (1-4, WITH 6 ALIAS -> 4) & SMOOTH CHASE / POV / DIORAMA / HELI INTERPOLATION
  // -------------------------------------------------------------------------
  const initSt = physics.state;
  const camCurrentPos = initSt.position
    .clone()
    .addScaledVector(initSt.tangent, -0.0112)
    .addScaledVector(initSt.normal, 0.0068);
  const camCurrentLookAt = initSt.position
    .clone()
    .addScaledVector(initSt.tangent, 0.0165)
    .addScaledVector(initSt.normal, 0.0018);
  const camCurrentUp = new THREE.Vector3(0, 1, 0);
  const camForward = initSt.tangent.clone();
  const _camTargetForward = new THREE.Vector3();
  const _camSplineAhead = new THREE.Vector3();
  const _camBehindDelta = new THREE.Vector3();
  const _camBehindSample = {
    position: new THREE.Vector3(),
    tangent: new THREE.Vector3(),
    right: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    halfWidth: 0.01705,
  };

  const visorOverlay = document.getElementById('helmet-visor-overlay');
  const hudCornerVignette = document.getElementById('hud-corner-vignette');
  const hudBrandLogo = document.getElementById('hud-brand-logo');
  const chkHideLogoEl = document.getElementById('chk-hide-logo');
  const hudBottomBar = document.querySelector('.hud-bottom-bar');
  const hudMinimapWidget = document.querySelector('.hud-minimap-widget');
  const hudSpeedoGauge = document.querySelector('.hud-speedo-gauge');
  const hudLapWidget = document.getElementById('hud-lap-widget');
  const camButtons = document.querySelectorAll('.cam-pill');
  let coursePanElapsed = 0.0;

  // -------------------------------------------------------------------------
  // CINEMATIC COURSE PAN (MODE 6, HOTKEY 6) — C2-SMOOTH 64-SAMPLE CRANE LOOP
  // -------------------------------------------------------------------------
  // 8 wide, graceful cinema crane waypoints staying 100% inside obstacle-free airspace
  // (Z >= +0.058m across the middle of the desk and high above the side monuments)
  const rawCoursePanPos = [
    new THREE.Vector3(-0.08, 0.125, 0.295), // 0: Front Keyboard Viaduct & Start/Finish Grid
    new THREE.Vector3(-0.34, 0.165, 0.245), // 1: Sweeping West past the G915 Keyboard
    new THREE.Vector3(-0.44, 0.235, 0.125), // 2: Ascending smoothly in front of BoYata Laptop Stand
    new THREE.Vector3(-0.28, 0.255, 0.060), // 3: High open airspace framing BoYata & Ginger Cat Helix
    new THREE.Vector3( 0.00, 0.245, 0.058), // 4: Center-high crane sweep framing Cat Helix & Blue Mic
    new THREE.Vector3( 0.28, 0.255, 0.065), // 5: High open airspace framing White Lamp 360° Corkscrew
    new THREE.Vector3( 0.44, 0.205, 0.165), // 6: Descending gracefully around the outer Lamp Spiral
    new THREE.Vector3( 0.26, 0.145, 0.275), // 7: Sweeping around the Razer Mousepad C-Turn back to Start
  ];
  const rawCoursePanLook = [
    new THREE.Vector3(-0.12, 0.035, 0.145), // 0: Start/Finish Gantry & Keyboard Viaduct
    new THREE.Vector3(-0.30, 0.085, 0.045), // 1: Sector 1 BoYata Climb
    new THREE.Vector3(-0.32, 0.135, -0.055), // 2: BoYata Laptop Stand Summit
    new THREE.Vector3(-0.16, 0.105, -0.115), // 3: Giant Ginger Cat 360° Helix
    new THREE.Vector3(-0.01, 0.105, -0.110), // 4: Glowing Blue Microphone Valley
    new THREE.Vector3( 0.23, 0.125, -0.125), // 5: White Key-Light Lamp 360° Corkscrew
    new THREE.Vector3( 0.31, 0.055, 0.065), // 6: Lamp Exit Ramp to Mousepad
    new THREE.Vector3( 0.18, 0.032, 0.145), // 7: Gaming Mouse C-Turn & Front Straight
  ];

  // Sample closed CatmullRomCurve3 at 64 uniform periodic points and apply 4 passes of circular
  // [0.25, 0.5, 0.25] Gaussian smoothing so the camera path has zero curvature spikes or kinks.
  function buildSmoothedClosedCatmullCurve(rawWaypoints, sampleCount = 64, passes = 4) {
    const baseCurve = new THREE.CatmullRomCurve3(rawWaypoints, true, 'centripetal', 0.5);
    let pts = [];
    for (let i = 0; i < sampleCount; i++) {
      pts.push(baseCurve.getPointAt(i / sampleCount));
    }
    for (let p = 0; p < passes; p++) {
      const nextPts = new Array(sampleCount);
      for (let i = 0; i < sampleCount; i++) {
        const prev = pts[(i - 1 + sampleCount) % sampleCount];
        const curr = pts[i];
        const next = pts[(i + 1) % sampleCount];
        nextPts[i] = new THREE.Vector3(
          0.25 * prev.x + 0.5 * curr.x + 0.25 * next.x,
          0.25 * prev.y + 0.5 * curr.y + 0.25 * next.y,
          0.25 * prev.z + 0.5 * curr.z + 0.25 * next.z
        );
      }
      pts = nextPts;
    }
    return new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
  }

  const coursePanPosCurve = buildSmoothedClosedCatmullCurve(rawCoursePanPos, 64, 4);
  const coursePanLookCurve = buildSmoothedClosedCatmullCurve(rawCoursePanLook, 64, 4);

  const _camDesiredPos = new THREE.Vector3();
  const _camDesiredLook = new THREE.Vector3();
  const _camBlendedUp = new THREE.Vector3();
  const _camRoadAnchor = new THREE.Vector3();

  // Initialize 1P room & curtain visibility for default Mode 1
  sync1PRoomAndCurtainVisibility(activeCameraMode);

  function setCameraMode(rawMode) {
    const mode = rawMode === 6 ? 4 : rawMode;
    activeCameraMode = mode;
    sync1PRoomAndCurtainVisibility(mode);
    syncKartScaleForCamera(mode);
    if (microKart.setCockpitRoadOnly) {
      microKart.setCockpitRoadOnly(mode === 2);
    }
    if (hudBrandLogo) {
      const userHidLogo = (chkHideLogoEl && chkHideLogoEl.checked) ||
          urlParams.get('hidelogo') === '1';
      hudBrandLogo.classList.toggle('hidden', userHidLogo || mode === 8);
    }

    const targetNear = mode === 3 || mode === 8 ? 0.0004 :
        mode === 1 || mode === 2                ? 0.0012 :
                                                  0.025;
    const targetFov = mode === 1 ? 70.0 : mode === 2 ? 48.0 : 46.0;
    if (
      Math.abs(camera.near - targetNear) > 1e-6 ||
      Math.abs(camera.fov - targetFov) > 1e-3
    ) {
      camera.near = targetNear;
      camera.fov = targetFov;
      camera.updateProjectionMatrix();
    }

    camButtons.forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.cam) === mode);
    });

    if (visorOverlay) {
      visorOverlay.classList.add('hidden');
    }
    const hideRacingHud = mode !== 1 && mode !== 2;
    if (hudCornerVignette)
      hudCornerVignette.classList.toggle('hidden', hideRacingHud);
    if (hudBottomBar) hudBottomBar.classList.toggle('hidden', hideRacingHud);
    if (hudMinimapWidget) hudMinimapWidget.classList.toggle('hidden', hideRacingHud);
    if (hudSpeedoGauge) hudSpeedoGauge.classList.toggle('hidden', hideRacingHud);
    if (hudLapWidget) hudLapWidget.classList.toggle('hidden', hideRacingHud);

    if (mode === 4) {
      // Mode 4: Helicopter Cam (Obstacle-Free Keyboard Heli 2 — Kart-Locked Aerial Heli in 100% obstacle-free front-upper airspace)
      orbitControls.enabled = false;
      camCurrentPos.set(0.08, 0.255, 0.305);
      camCurrentLookAt.copy(physics.state.position);
      camCurrentUp.set(0, 1, 0);
      camera.up.set(0, 1, 0);
      camera.position.copy(camCurrentPos);
      camera.lookAt(camCurrentLookAt);
    } else if (mode === 9) {
      // Mode 9: Smooth Keyboard Helicopter Cam — Spins over the Logitech G915 Keyboard in 100% obstacle-free airspace
      orbitControls.enabled = false;
      camCurrentPos.set(-0.12 + 0.175, 0.235, 0.255);
      camCurrentLookAt.set(-0.02, 0.075, -0.055);
      camCurrentUp.set(0, 1, 0);
      camera.up.set(0, 1, 0);
      camera.position.copy(camCurrentPos);
      camera.lookAt(camCurrentLookAt);
    } else if (mode === 3) {
      // Mode 3: Full Desk Diorama Cam (1.0mm near plane so zooming right into the road never clips!)
      orbitControls.enabled = true;
      orbitControls.minDistance = 0.003;
      orbitControls.maxDistance = 3.2;
      camera.up.set(0, 1, 0);
      camera.position.set(0.015, 0.43, 0.55);
      orbitControls.target.set(0.0, 0.075, -0.045);
      orbitControls.update();
    } else if (mode === 5) {
      // Mode 5: Free Orbit & Chair/Bed Inspector Cam (Matches V5.5 Chair & Bed Close-Up!)
      orbitControls.enabled = true;
      orbitControls.maxDistance = 3.8;
      camera.up.set(0, 1, 0);
      camera.position.set(0.52, 0.22, 1.28);
      orbitControls.target.set(-0.52, -0.22, 0.34);
      orbitControls.update();
      camCurrentPos.copy(camera.position);
      camCurrentLookAt.copy(orbitControls.target);
    } else if (mode === 7) {
      // Mode 7: Room Panorama Cam (V5.5 Wide North-West corner overview capturing Grey Bed + Organic Duvet, Desk + Coaster Track, Smooth Bouclé Chair, 3D Rectangular Wardrobe, and South Wall Walnut Cabinet + Door)
      orbitControls.enabled = true;
      orbitControls.maxDistance = 3.8;
      camera.up.set(0, 1, 0);
      camera.position.set(-1.86, 0.72, -0.18);
      orbitControls.target.set(0.18, -0.08, 1.28);
      orbitControls.update();
      camCurrentPos.copy(camera.position);
      camCurrentLookAt.copy(orbitControls.target);
    } else if (mode === 8) {
      // Mode 8: Monitor High Scores Cam — Faces the turned-on LG 27" computer
      // monitor screen straight-on with full OrbitControls pan/orbit/zoom
      // enabled just like Mode 3!
      orbitControls.enabled = true;
      orbitControls.minDistance = 0.003;
      orbitControls.maxDistance = 3.2;
      camera.up.set(0, 1, 0);
      camera.position.set(0.010, 0.265, 0.185);
      orbitControls.target.set(0.010, 0.258, -0.233);
      orbitControls.update();
      camCurrentPos.copy(camera.position);
      camCurrentLookAt.copy(orbitControls.target);
    } else {
      orbitControls.enabled = false;
    }
  }

  camButtons.forEach((btn) => {
    btn.addEventListener('click', () => setCameraMode(Number(btn.dataset.cam)));
  });

  const heldNonDigitKeys = new Set();
  let lastNonDigitKeyTime = 0;

  window.addEventListener('keyup', (e) => {
    heldNonDigitKeys.delete(e.code);
  });

  window.addEventListener('blur', () => {
    heldNonDigitKeys.clear();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName) && !e.target.readOnly) return;

    const isDigitKey = /^(Digit|Numpad)[1-9]$/.test(e.code);
    if (!isDigitKey) {
      heldNonDigitKeys.add(e.code);
      lastNonDigitKeyTime = performance.now();
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.code === 'KeyM') {
        const on = audioSynth.toggle();
        updateAudioButtonUI(on);
      }
      return;
    }

    // Reconcile OS-swallowed modifier keyups (e.g. after macOS Cmd+Shift+3 screenshot shortcut)
    if (!e.metaKey) {
      heldNonDigitKeys.delete('MetaLeft');
      heldNonDigitKeys.delete('MetaRight');
    }
    if (!e.shiftKey) {
      heldNonDigitKeys.delete('ShiftLeft');
      heldNonDigitKeys.delete('ShiftRight');
    }
    if (!e.ctrlKey) {
      heldNonDigitKeys.delete('ControlLeft');
      heldNonDigitKeys.delete('ControlRight');
    }
    if (!e.altKey) {
      heldNonDigitKeys.delete('AltLeft');
      heldNonDigitKeys.delete('AltRight');
    }

    // Only switch cameras when keys 1, 2, 3, 4 (or 6 alias -> 4) are pressed in complete isolation
    if (
      e.metaKey ||
      e.ctrlKey ||
      e.altKey ||
      e.shiftKey ||
      e.repeat ||
      (e.getModifierState &&
        (e.getModifierState('Meta') ||
          e.getModifierState('Shift') ||
          e.getModifierState('Control') ||
          e.getModifierState('Alt') ||
          e.getModifierState('OS'))) ||
      heldNonDigitKeys.size > 0 ||
      performance.now() - lastNonDigitKeyTime < 300 ||
      !/^[12346]$/.test(e.key)
    ) {
      return;
    }

    const keyNum = Number(e.key);
    setCameraMode(keyNum === 6 ? 4 : keyNum);
  });

  function updateCamera(dt, elapsedTime, st) {
    if (
      activeCameraMode === 3 ||
      activeCameraMode === 5 ||
      activeCameraMode === 7 ||
      activeCameraMode === 8
    ) {
      orbitControls.maxDistance = 3.8;
      camera.up.set(0, 1, 0);
      orbitControls.update();
      // Clamp OrbitControls camera position inside the V5.5 bedroom walls and outside the 3D wardrobe box
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -2.02, 1.28);
      camera.position.y = THREE.MathUtils.clamp(camera.position.y, -0.64, 1.65);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -0.30, 2.48);
      if (camera.position.x > 0.68 && camera.position.z < 1.46) {
        camera.position.x = 0.68;
      }
      camCurrentPos.copy(camera.position);
      camCurrentLookAt.copy(orbitControls.target);
      return;
    }

    if (activeCameraMode === 4 || activeCameraMode === 6) {
      // Mode 4 (and alias 6): Smooth Keyboard Helicopter Cam 2 —
      // 1) NEVER loses sight of the car (keeps camera Z >= 0.268m strictly in front of the frontmost
      //    track straightaway Z = 0.255m so the kart never passes behind/under the lens, and locks
      //    lookAt 78% onto st.position so the kart stays centered inside the frame on every turn).
      // 2) NEVER collides with objects (flies inside the 100% obstacle-free front-upper airspace
      //    X in [-0.26m, +0.24m], Y in [0.248m, 0.285m], Z in [+0.268m, +0.360m], high above the
      //    keyboard/mousepad/cat and well in front of the LG monitor and mic stand).
      const heliAngle = elapsedTime * 0.34;
      const desiredX = THREE.MathUtils.clamp(
        -0.04 + st.position.x * 0.38 + Math.cos(heliAngle) * 0.13,
        -0.26,
        0.24
      );
      const desiredY =
        0.252 +
        Math.sin(heliAngle * 2.0) * 0.011 +
        Math.max(0.0, st.position.y - 0.065) * 0.35;
      const desiredZ = THREE.MathUtils.clamp(
        Math.max(0.268, st.position.z + 0.135) + Math.sin(heliAngle) * 0.038,
        0.268,
        0.360
      );
      _camDesiredPos.set(desiredX, desiredY, desiredZ);

      // Lock lookAt 78% onto the kart's live 3D position so we never lose sight of the car
      // at the far left (books/lamp) or far right (cat helix) extremes of the track
      _camDesiredLook.set(
        THREE.MathUtils.lerp(-0.015, st.position.x, 0.78),
        THREE.MathUtils.lerp(0.072, st.position.y + 0.01, 0.78),
        THREE.MathUtils.lerp(-0.045, st.position.z, 0.78)
      );

      const smoothPos = isScreenshotMode ? 1.0 : 1.0 - Math.exp(-dt * 6.5);
      const smoothLook = isScreenshotMode ? 1.0 : 1.0 - Math.exp(-dt * 9.5);
      camCurrentPos.lerp(_camDesiredPos, smoothPos);
      camCurrentLookAt.lerp(_camDesiredLook, smoothLook);
      camera.up.set(0, 1, 0);
      camera.position.copy(camCurrentPos);
      camera.lookAt(camCurrentLookAt);
      return;
    }

    // Compute kart-anchored forward unit vector from C2-smoothed st.tangent + 65% of st.headingYaw
    // and smoothly damp camForward so steering and collisions never snap the camera!
    _camTargetForward
      .copy(st.tangent)
      .applyAxisAngle(st.normal, (st.headingYaw || 0.0) * 0.65)
      .normalize();
    if (isScreenshotMode) {
      camForward.copy(_camTargetForward);
    } else {
      camForward.lerp(_camTargetForward, 1.0 - Math.exp(-dt * 14.0)).normalize();
    }

    const carViewMode = urlParams.get('carview');
    if (carViewMode) {
      const stRight = _camDesiredPos.crossVectors(camForward, st.normal).normalize();
      if (carViewMode === 'front') {
        _camDesiredPos
          .copy(st.position)
          .addScaledVector(camForward, 0.0155)
          .addScaledVector(stRight, 0.0055)
          .addScaledVector(st.normal, 0.0082);
        _camDesiredLook
          .copy(st.position)
          .addScaledVector(camForward, 0.0005)
          .addScaledVector(st.normal, 0.0028);
      } else if (carViewMode === 'rear') {
        _camDesiredPos
          .copy(st.position)
          .addScaledVector(camForward, -0.0145)
          .addScaledVector(stRight, 0.0045)
          .addScaledVector(st.normal, 0.0072);
        _camDesiredLook
          .copy(st.position)
          .addScaledVector(camForward, -0.0012)
          .addScaledVector(st.normal, 0.0030);
      } else {
        _camDesiredPos
          .copy(st.position)
          .addScaledVector(camForward, 0.0110)
          .addScaledVector(stRight, -0.0115)
          .addScaledVector(st.normal, 0.0068);
        _camDesiredLook
          .copy(st.position)
          .addScaledVector(st.normal, 0.0028);
      }
      camera.up.copy(st.normal);
      camera.position.copy(_camDesiredPos);
      camera.lookAt(_camDesiredLook);
      return;
    }

    // Subtle 1P guardrail/rival impact camera shake (punchy 0.16s burst)
    let shakeRight = 0.0;
    let shakeUp = 0.0;
    if (camShakeTimer > 0.0 && !isScreenshotMode) {
      camShakeTimer = Math.max(0.0, camShakeTimer - dt);
      const shakeDecay = (camShakeTimer / 0.16) * camShakeIntensity;
      shakeRight = Math.sin(elapsedTime * 108.0) * 0.00105 * shakeDecay;
      shakeUp = Math.cos(elapsedTime * 136.0) * 0.00095 * shakeDecay;
    }

    const isVictoryCameraActive =
      cinematicFinishState.active && (activeCameraMode === 1 || activeCameraMode === 2);

    if (isVictoryCameraActive) {
      if (microKart.setCockpitRoadOnly) {
        microKart.setCockpitRoadOnly(false);
      }
      const u = THREE.MathUtils.clamp(
        cinematicFinishState.elapsed / Math.max(0.1, cinematicFinishState.duration),
        0.0,
        1.0
      );
      const easeU = 1.0 - Math.pow(1.0 - u, 3.0);

      // Asphalt 9 / NFS low-slung dynamic side-tracking finish camera (no cheesy podium turntable spin)
      const passAngle = THREE.MathUtils.lerp(Math.PI, 0.64 * Math.PI, easeU);
      const passRadius = THREE.MathUtils.lerp(0.0124, 0.0102, easeU);
      const passHeight = THREE.MathUtils.lerp(0.0058, 0.0032, easeU);

      const forwardComp = Math.cos(passAngle) * passRadius;
      const sideComp =
        Math.sin(passAngle) * passRadius * (cinematicFinishState.sweepSide || 1);

      _camDesiredPos
        .copy(st.position)
        .addScaledVector(camForward, forwardComp)
        .addScaledVector(st.right, sideComp)
        .addScaledVector(st.normal, passHeight);

      _camDesiredLook
        .copy(st.position)
        .addScaledVector(camForward, 0.0035)
        .addScaledVector(st.normal, 0.0018);

      const heroFov = THREE.MathUtils.lerp(camera.fov, 54.0, 1.0 - Math.exp(-dt * 5.0));
      if (Math.abs(camera.fov - heroFov) > 0.05) {
        camera.fov = heroFov;
        camera.updateProjectionMatrix();
      }

      const smoothPos = 1.0 - Math.exp(-dt * 9.5);
      const smoothLook = 1.0 - Math.exp(-dt * 11.5);
      camCurrentPos.lerp(_camDesiredPos, smoothPos);
      camCurrentLookAt.lerp(_camDesiredLook, smoothLook);
      _camBlendedUp.set(0, 0.92, 0).addScaledVector(st.normal, 0.08).normalize();
      camCurrentUp.lerp(_camBlendedUp, 1.0 - Math.exp(-dt * 8.0)).normalize();

      camera.up.copy(camCurrentUp);
      camera.position.copy(camCurrentPos);
      camera.lookAt(camCurrentLookAt);
      return;
    }

    if (activeCameraMode === 1) {
      // Dynamic Sense-of-Speed Arcade Chase Cam:
      // Tracks st.position (which already includes hopHeight) directly so when the car
      // climbs a ramp or jumps, the camera rises 1:1 with the car and NEVER clips into the roof/trunk!
      const maxRefSpeed = 0.142 * (st.topSpeedMultiplier || 1.0);
      const speedNorm = THREE.MathUtils.clamp(Math.abs(st.speed) / maxRefSpeed, 0.0, 1.35);
      const isBoostingNow = (st.boostActive || 0.0) > 0.0;

      // Subtle high-frequency Perlin/composite-sine camera target vibration that intensifies at top speed
      let speedShakeRight = 0.0;
      let speedShakeUp = 0.0;
      if (!isScreenshotMode && speedNorm > 0.42) {
        const highSpeedIntensity =
          THREE.MathUtils.smoothstep(speedNorm, 0.42, 1.15) * (isBoostingNow ? 1.35 : 1.0);
        const noiseX =
          Math.sin(elapsedTime * 67.0) * 0.50 +
          Math.sin(elapsedTime * 113.0 + 1.7) * 0.35 +
          Math.cos(elapsedTime * 157.0) * 0.15;
        const noiseY =
          Math.cos(elapsedTime * 79.0 + 0.8) * 0.50 +
          Math.sin(elapsedTime * 131.0 + 2.3) * 0.35 +
          Math.sin(elapsedTime * 173.0) * 0.15;
        speedShakeRight = noiseX * 0.00042 * highSpeedIntensity;
        speedShakeUp = noiseY * 0.00036 * highSpeedIntensity;
      }

      const totalShakeRight = shakeRight + speedShakeRight;
      const totalShakeUp = shakeUp + speedShakeUp;

      const isPortraitCam = camera.aspect < 0.95;
      const portraitPull = isPortraitCam ? -0.0024 : 0.0;
      const portraitLift = isPortraitCam ? 0.0014 : 0.0;
      const lookNormalLift = isPortraitCam ? 0.0029 : 0.0024;
      const boostPullback = isBoostingNow ? -0.0012 : 0.0;
      const followDist = 0.0126 - boostPullback - portraitPull;
      const camLift = 0.0068 + portraitLift;

      _camDesiredPos
        .copy(st.position)
        .addScaledVector(camForward, -followDist)
        .addScaledVector(st.normal, camLift);
      if (totalShakeRight !== 0.0 || totalShakeUp !== 0.0) {
        _camDesiredPos
          .addScaledVector(st.right, totalShakeRight * 0.35)
          .addScaledVector(st.normal, totalShakeUp * 0.25);
      }

      // Corridor safety clamp: prevent the chase camera from ever swinging outside the curved
      // track guardrails (`Walls`) when the car hugs a wall on tight corners (especially in portrait view).
      const hopH = Math.max(0.0, st.hopHeight || 0.0);
      if (physics.sampleTrackAtArcLength) {
        physics.sampleTrackAtArcLength(st.s - followDist, _camBehindSample);
        const behindHalfW = _camBehindSample.halfWidth || 0.01705;
        const safeCamMaxLat = Math.max(0.0065, behindHalfW - 0.0038);
        _camBehindDelta.subVectors(_camDesiredPos, _camBehindSample.position);
        const latProj = _camBehindDelta.dot(_camBehindSample.right);
        if (Math.abs(latProj) > safeCamMaxLat) {
          const clampedLat = THREE.MathUtils.clamp(latProj, -safeCamMaxLat, safeCamMaxLat);
          _camDesiredPos.addScaledVector(_camBehindSample.right, clampedLat - latProj);
        }
        // Keep camera safely above the behind-track roadbed normal as well
        const normalProj = _camBehindDelta.dot(_camBehindSample.normal);
        const minCamHeightAboveBehind = 0.0052 + hopH;
        if (normalProj < minCamHeightAboveBehind) {
          _camDesiredPos.addScaledVector(
            _camBehindSample.normal,
            minCamHeightAboveBehind - normalProj
          );
        }
      }

      // Sample 16.5mm ahead on the track spline for smooth corner anticipation
      const aheadSample = physics.sampleTrackAtArcLength
        ? physics.sampleTrackAtArcLength(st.s + 0.0165)
        : null;
      if (aheadSample && aheadSample.position) {
        _camSplineAhead.copy(aheadSample.position).addScaledVector(st.normal, hopH);
        _camDesiredLook
          .copy(st.position)
          .addScaledVector(camForward, 0.0165)
          .lerp(_camSplineAhead, 0.35)
          .addScaledVector(st.normal, lookNormalLift);
      } else {
        _camDesiredLook
          .copy(st.position)
          .addScaledVector(camForward, 0.0165)
          .addScaledVector(st.normal, lookNormalLift);
      }

      // Apply high-frequency speed vibration directly onto the camera target for visceral 200+ KM/H feel
      if (speedShakeRight !== 0.0 || speedShakeUp !== 0.0) {
        _camDesiredLook
          .addScaledVector(st.right, speedShakeRight)
          .addScaledVector(st.normal, speedShakeUp);
      }

      // Dynamic FOV Sense of Speed: resting FOV of 70°, stretching smoothly to 95°+ at top speed / boost
      const speedFovGain = THREE.MathUtils.clamp(Math.pow(speedNorm, 1.15) * 21.0, 0.0, 24.0);
      const boostFovBonus = isBoostingNow ? 5.5 : 0.0;
      const targetArcadeFov = THREE.MathUtils.clamp(70.0 + speedFovGain + boostFovBonus, 70.0, 97.0);
      if (Math.abs(camera.fov - targetArcadeFov) > 0.05) {
        camera.fov = THREE.MathUtils.lerp(camera.fov, targetArcadeFov, 1.0 - Math.exp(-dt * 8.5));
        camera.updateProjectionMatrix();
      }

      const smoothUp = isScreenshotMode ? 1.0 : 1.0 - Math.exp(-dt * 12.0);
      _camBlendedUp
        .set(0, 0.88, 0)
        .addScaledVector(st.normal, 0.12)
        .normalize();
      camCurrentUp.lerp(_camBlendedUp, smoothUp).normalize();

      const smoothPos = isScreenshotMode ? 1.0 : 1.0 - Math.exp(-dt * 20.0);
      const smoothLook = isScreenshotMode ? 1.0 : 1.0 - Math.exp(-dt * 24.0);
      camCurrentPos.lerp(_camDesiredPos, smoothPos);
      camCurrentLookAt.lerp(_camDesiredLook, smoothLook);

      // Hard Car-Exclusion Sphere: guarantee camera never clips into the roof, trunk, or side mirrors
      _camBehindDelta.subVectors(camCurrentPos, st.position);
      const distToCar = _camBehindDelta.length();
      const minCamCarDist = 0.0132;
      if (distToCar < minCamCarDist) {
        if (distToCar > 1e-5) {
          _camBehindDelta.divideScalar(distToCar);
        } else {
          _camBehindDelta.copy(camForward).multiplyScalar(-1).addScaledVector(st.normal, 0.45).normalize();
        }
        camCurrentPos.copy(st.position).addScaledVector(_camBehindDelta, minCamCarDist);
      }

      camera.up.copy(camCurrentUp);
      camera.position.copy(camCurrentPos);
      camera.lookAt(camCurrentLookAt);
    } else if (activeCameraMode === 2) {
      // 1:150 N-Scale Pure Road Cockpit POV Cam (41.5° FOV, positioned at +2.2mm forward in front of the helmet visor
      // and 3.4mm above track surface, looking 32mm ahead and 2.6mm up — kart mesh hidden so only the road is visible!)
      _camDesiredPos
        .copy(st.position)
        .addScaledVector(camForward, 0.0022)
        .addScaledVector(st.normal, 0.0034 + st.hopHeight * 0.38);
      if (shakeRight !== 0.0 || shakeUp !== 0.0) {
        _camDesiredPos
          .addScaledVector(st.right, shakeRight)
          .addScaledVector(st.normal, shakeUp);
      }
      _camDesiredLook
        .copy(st.position)
        .addScaledVector(camForward, 0.032)
        .addScaledVector(st.normal, 0.0026);

      const smoothVisor = isScreenshotMode ? 1.0 : 1.0 - Math.exp(-dt * 24.0);
      camCurrentUp.lerp(st.normal, smoothVisor).normalize();

      camCurrentPos.copy(_camDesiredPos);
      camCurrentLookAt.copy(_camDesiredLook);

      camera.up.copy(camCurrentUp);
      camera.position.copy(_camDesiredPos);
      camera.lookAt(_camDesiredLook);
    } else if (activeCameraMode === 9) {
      // Mode 9: Smooth Keyboard Helicopter Cam — Spins smoothly in obstacle-free airspace
      // over the Logitech G915 Keyboard (Z in [+0.18m, +0.33m], X in [-0.295m, +0.055m], Y ~ 0.235m),
      // 100% clear of the LG Monitor Screen (Z < -0.16m) and Microphone Stand (Z < -0.045m)!
      const heliAngle = elapsedTime * 0.36;
      const kbCenterX = -0.12;
      const kbCenterZ = 0.255;
      const radiusX = 0.175;
      const radiusZ = 0.075;
      _camDesiredPos.set(
        kbCenterX + Math.cos(heliAngle) * radiusX,
        0.235 + Math.sin(heliAngle * 2.0) * 0.012,
        kbCenterZ + Math.sin(heliAngle) * radiusZ
      );
      // Smoothly frame the keyboard, central coaster track, and moving kart without pitching into the numpad
      _camDesiredLook.set(
        THREE.MathUtils.lerp(-0.02, st.position.x, 0.34),
        THREE.MathUtils.lerp(0.075, st.position.y + 0.012, 0.34),
        THREE.MathUtils.lerp(-0.055, st.position.z, 0.34)
      );
      const smoothPos = isScreenshotMode ? 1.0 : 1.0 - Math.exp(-dt * 6.0);
      const smoothLook = isScreenshotMode ? 1.0 : 1.0 - Math.exp(-dt * 7.5);
      camCurrentPos.lerp(_camDesiredPos, smoothPos);
      camCurrentLookAt.lerp(_camDesiredLook, smoothLook);
      camera.up.set(0, 1, 0);
      camera.position.copy(camCurrentPos);
      camera.lookAt(camCurrentLookAt);
    }
  }

  // -------------------------------------------------------------------------
  // 6. HUD TELEMETRY BINDINGS, TWEAKER CONTROLS & 2D SPLINE RADAR
  // -------------------------------------------------------------------------

  // Autopilot & Audio buttons
  const btnAutopilot = document.getElementById('btn-toggle-autopilot');
  const txtAutopilot = document.getElementById('autopilot-btn-text');
  const elDriveMode = document.getElementById('hud-drive-mode');

  function syncAutopilotUI(isAuto) {
    if (btnAutopilot) btnAutopilot.classList.toggle('autopilot-active', isAuto);
    if (txtAutopilot) {
      txtAutopilot.textContent = isAuto ? 'AI Coaster Cruise: ON' : 'Manual WASD Racing';
    }
    if (elDriveMode) {
      elDriveMode.textContent = isAuto
        ? 'COASTER AUTOPILOT'
        : 'MANUAL DRIVE — PRESS W / UP TO ACCELERATE';
      elDriveMode.classList.toggle('manual', !isAuto);
    }
  }

  physics.onModeChange(syncAutopilotUI);
  syncAutopilotUI(physics.state.autopilot);
  if (btnAutopilot) {
    btnAutopilot.addEventListener('click', () => {
      physics.setAutopilot(!physics.state.autopilot);
    });
  }

  const btnAudio = document.getElementById('btn-toggle-audio');
  const txtAudio = document.getElementById('audio-btn-text');
  const chkEngineAudio = document.getElementById('chk-engine-audio');
  const btnMuteSound = document.getElementById('btn-mute-sound');
  const iconSoundOn = document.getElementById('icon-sound-on');
  const iconSoundOff = document.getElementById('icon-sound-off');
  function updateAudioButtonUI(on) {
    const enabled = Boolean(on);
    if (btnAudio) btnAudio.classList.toggle('autopilot-active', enabled);
    if (txtAudio)
      txtAudio.textContent = enabled ? 'Engine Audio: ON' : 'Engine Audio: OFF';
    if (chkEngineAudio) chkEngineAudio.checked = enabled;
    if (btnMuteSound) {
      btnMuteSound.classList.toggle('is-muted', !enabled);
      btnMuteSound.setAttribute('aria-pressed', enabled ? 'false' : 'true');
      btnMuteSound.title = enabled ? 'Mute Sound' : 'Unmute Sound';
    }
    if (iconSoundOn) iconSoundOn.classList.toggle('hidden', !enabled);
    if (iconSoundOff) iconSoundOff.classList.toggle('hidden', enabled);
  }
  if (btnAudio) {
    btnAudio.addEventListener('click', () => {
      const on = audioSynth.toggle();
      updateAudioButtonUI(on);
    });
  }
  if (btnMuteSound) {
    btnMuteSound.addEventListener('click', (e) => {
      e.stopPropagation();
      const on = audioSynth.toggle();
      updateAudioButtonUI(on);
      btnMuteSound.blur();
    });
  }
  if (chkEngineAudio) {
    chkEngineAudio.addEventListener('change', (e) => {
      const on = audioSynth.setEnabled(e.target.checked);
      updateAudioButtonUI(on);
    });
  }

  // Sector Teleport Buttons (①-⑥)
  document.querySelectorAll('.tp-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sec = Number(btn.dataset.sector);
      physics.teleportToSector(sec);
    });
  });

  // Collapsible Top-Right Settings Popover (Toggled with Escape key)
  const btnSettingsCog = document.getElementById('btn-settings-cog');
  const settingsPopover = document.getElementById('settings-popover');
  if (settingsPopover) {
    if (btnSettingsCog) {
      btnSettingsCog.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = settingsPopover.classList.toggle('hidden');
        btnSettingsCog.classList.toggle('active', !isHidden);
      });
    }

    window.addEventListener('pointerdown', (e) => {
      if (
        !settingsPopover.classList.contains('hidden') &&
        !settingsPopover.contains(e.target) &&
        (!btnSettingsCog || !btnSettingsCog.contains(e.target))
      ) {
        settingsPopover.classList.add('hidden');
        if (btnSettingsCog) btnSettingsCog.classList.remove('active');
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Escape') {
        e.preventDefault();
        const isHidden = settingsPopover.classList.toggle('hidden');
        if (btnSettingsCog) btnSettingsCog.classList.toggle('active', !isHidden);
      }
    });
  }

  // Tweaker Sliders
  const sliderSun = document.getElementById('slider-sunbeams');
  const valSun = document.getElementById('val-sunbeams');
  if (sliderSun) {
    sliderSun.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      settings.sunIntensity = v;
      settings.sunbeamIntensity = v;
      scene.environmentIntensity = 0.46 + 0.45 * v;
      settings.toneMappingExposure = 0.68 + 0.08 * settings.lampIntensity + 0.14 * v;
      renderer.toneMappingExposure = settings.toneMappingExposure;
      if (valSun) valSun.textContent = `${v.toFixed(2)}x`;
    });
  }

  const sliderLamp = document.getElementById('slider-lamplight');
  const valLamp = document.getElementById('val-lamplight');
  if (sliderLamp) {
    sliderLamp.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      settings.lampIntensity = v;
      settings.toneMappingExposure = 0.68 + 0.08 * v + 0.14 * settings.sunIntensity;
      renderer.toneMappingExposure = settings.toneMappingExposure;
      if (valLamp) valLamp.textContent = `${v.toFixed(2)}x`;
    });
  }

  const sliderTrackGlow = document.getElementById('slider-trackglow');
  const valTrackGlow = document.getElementById('val-trackglow');
  if (sliderTrackGlow) {
    sliderTrackGlow.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      settings.trackGlowIntensity = v;
      if (valTrackGlow) valTrackGlow.textContent = `${v.toFixed(2)}x`;
    });
  }

  const sliderMic = document.getElementById('slider-micglow');
  const valMic = document.getElementById('val-micglow');
  if (sliderMic) {
    sliderMic.addEventListener('input', (e) => {
      settings.micGlowIntensity = parseFloat(e.target.value);
      if (valMic) valMic.textContent = `${settings.micGlowIntensity.toFixed(2)}x`;
    });
  }

  const sliderBloom = document.getElementById('slider-bloom');
  const valBloom = document.getElementById('val-bloom');
  if (sliderBloom) {
    sliderBloom.addEventListener('input', (e) => {
      settings.bloomStrength = parseFloat(e.target.value);
      bloomPass.strength = settings.bloomStrength;
      if (valBloom) valBloom.textContent = settings.bloomStrength.toFixed(2);
    });
  }

  const sliderFireLight = document.getElementById('slider-firelight');
  const valFireLight = document.getElementById('val-firelight');
  if (sliderFireLight) {
    sliderFireLight.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      if (microKart && typeof microKart.setFireLightMultiplier === 'function') {
        microKart.setFireLightMultiplier(v, true);
      }
      if (valFireLight) valFireLight.textContent = `${v.toFixed(2)}x`;
    });
  }

  const sliderDof = document.getElementById('slider-dof');
  const valDof = document.getElementById('val-dof');
  if (sliderDof) {
    sliderDof.addEventListener('input', (e) => {
      settings.dofStrength = parseFloat(e.target.value);
      if (valDof) valDof.textContent = `${settings.dofStrength.toFixed(2)}x`;
      bokehPass.enabled = settings.dofStrength > 0.01;
    });
  }

  const sliderSpeed = document.getElementById('slider-topspeed');
  const valSpeed = document.getElementById('val-topspeed');
  if (sliderSpeed) {
    sliderSpeed.addEventListener('input', (e) => {
      physics.state.topSpeedMultiplier = parseFloat(e.target.value);
      if (valSpeed) valSpeed.textContent = `${physics.state.topSpeedMultiplier.toFixed(2)}x`;
    });
  }

  const chkDust = document.getElementById('chk-dust-motes');
  if (chkDust) {
    chkDust.addEventListener('change', (e) => {
      settings.showDustMotes = e.target.checked;
    });
  }

  const chkDroneKartScale = document.getElementById('chk-drone-kart-scale');
  const chkPanoKart100 = document.getElementById('chk-pano-kart-100');
  if (chkDroneKartScale) {
    chkDroneKartScale.addEventListener('change', (e) => {
      settings.droneKartScale = e.target.checked;
      if (settings.droneKartScale) {
        settings.panoKart100 = false;
        if (chkPanoKart100) chkPanoKart100.checked = false;
      }
      syncKartScaleForCamera(activeCameraMode);
    });
  }
  if (chkPanoKart100) {
    chkPanoKart100.addEventListener('change', (e) => {
      settings.panoKart100 = e.target.checked;
      if (settings.panoKart100) {
        settings.droneKartScale = false;
        if (chkDroneKartScale) chkDroneKartScale.checked = false;
      }
      syncKartScaleForCamera(activeCameraMode);
    });
  }

  const chkHideLogo = document.getElementById('chk-hide-logo');
  const elBrandLogo = document.getElementById('hud-brand-logo');
  if (chkHideLogo && elBrandLogo) {
    if (urlParams.get('hidelogo') === '1') {
      chkHideLogo.checked = true;
      elBrandLogo.classList.add('hidden');
    }
    chkHideLogo.addEventListener('change', (e) => {
      elBrandLogo.classList.toggle('hidden', e.target.checked);
    });
  }

  const chkDofNearest = document.getElementById('chk-dof-nearest');
  settings.dofFocusNearest = urlParams.get('doffocus') === 'nearest';
  if (chkDofNearest) {
    chkDofNearest.checked = settings.dofFocusNearest;
    chkDofNearest.addEventListener('change', (e) => {
      settings.dofFocusNearest = e.target.checked;
    });
  }

  const btnReloadGlb = document.getElementById('btn-reload-glb');
  if (btnReloadGlb) {
    btnReloadGlb.addEventListener('click', () => {
      loadedGlbStatus.desk = false;
      loadedGlbStatus.track = false;
      loadedGlbStatus.kart = false;
      loadedGlbStatus.room = false;
      checkAndLoadGlbModels();
    });
  }

  // Initialize Sleek Angled 18-Segment Speedometer Bar (6 left-riser ticks + 12 upper-bar ticks)
  const ticksGroup = document.getElementById('speedo-ticks-group');
  const speedoCasing = document.getElementById('speedo-bar-casing');
  const speedoSegEls = [];
  const SPEEDO_SEG_COLORS = [
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#ffffff',
    '#f6feff',
    '#e8fcff',
    '#d4f9ff',
    '#bcf5ff',
    '#a0f1ff',
    '#82ecff',
    '#62e7ff',
    '#44e3ff',
    '#28dfff',
    '#12dcff',
    '#00d9ff',
    '#00e4ff',
    '#00f0ff',
  ];

  if (ticksGroup) {
    // Outer knee vertex K = (66, 36)
    const kx = 66.0;
    const ky = 36.0;
    // Left riser unit step (6 steps from bottom-left up-right to knee K)
    const ux = 7.2;
    const uy = -10.8;
    // Upper bar unit step (12 steps from knee K up-right across above speed digits & KM/H)
    const vx = 16.4;
    const vy = -2.25;
    // Shared inward thickness offset vector at the knee so riser and top bar meet at an exact miter edge
    const wx = 10.5;
    const wy = 11.2;

    if (speedoCasing) {
      const c0x = kx - 6.28 * ux - 2.4;
      const c0y = ky - 6.28 * uy + 2.2;
      const c1x = kx - 1.6;
      const c1y = ky - 2.8;
      const c2x = kx + 12.22 * vx + 2.8;
      const c2y = ky + 12.22 * vy - 2.6;
      const c3x = kx + 12.22 * vx + wx + 3.2;
      const c3y = ky + 12.22 * vy + wy + 2.2;
      const c4x = kx + wx + 2.0;
      const c4y = ky + wy + 2.4;
      const c5x = kx - 6.28 * ux + wx + 0.4;
      const c5y = ky - 6.28 * uy + wy + 2.8;
      speedoCasing.setAttribute(
        'points',
        `${c0x.toFixed(1)},${c0y.toFixed(1)} ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${c3x.toFixed(1)},${c3y.toFixed(1)} ${c4x.toFixed(1)},${c4y.toFixed(1)} ${c5x.toFixed(1)},${c5y.toFixed(1)}`
      );
    }

    let svgMarkup = '';
    const pad = 0.13;
    // 6 segments along the left diagonal riser (s = 0..5)
    for (let s = 0; s < 6; s++) {
      const s0 = s + pad;
      const s1 = s + 1.0 - pad;
      const p0x = kx - (6.0 - s0) * ux;
      const p0y = ky - (6.0 - s0) * uy;
      const p1x = kx - (6.0 - s1) * ux;
      const p1y = ky - (6.0 - s1) * uy;
      const q1x = p1x + wx;
      const q1y = p1y + wy;
      const q0x = p0x + wx;
      const q0y = p0y + wy;
      svgMarkup += `<polygon id="speedo-seg-${s}" class="speedo-seg" points="${p0x.toFixed(2)},${p0y.toFixed(2)} ${p1x.toFixed(2)},${p1y.toFixed(2)} ${q1x.toFixed(2)},${q1y.toFixed(2)} ${q0x.toFixed(2)},${q0y.toFixed(2)}" />`;
    }
    // 12 segments along the upper bar (t = 0..11, seg index 6..17)
    for (let t = 0; t < 12; t++) {
      const idx = 6 + t;
      const t0 = t + pad;
      const t1 = t + 1.0 - pad;
      const p0x = kx + t0 * vx;
      const p0y = ky + t0 * vy;
      const p1x = kx + t1 * vx;
      const p1y = ky + t1 * vy;
      const q1x = p1x + wx;
      const q1y = p1y + wy;
      const q0x = p0x + wx;
      const q0y = p0y + wy;
      svgMarkup += `<polygon id="speedo-seg-${idx}" class="speedo-seg" points="${p0x.toFixed(2)},${p0y.toFixed(2)} ${p1x.toFixed(2)},${p1y.toFixed(2)} ${q1x.toFixed(2)},${q1y.toFixed(2)} ${q0x.toFixed(2)},${q0y.toFixed(2)}" />`;
    }
    ticksGroup.innerHTML = svgMarkup;
    for (let i = 0; i < 18; i++) {
      speedoSegEls.push(document.getElementById(`speedo-seg-${i}`));
    }
  }

  // 2x Retina 3D Isometric-Tilted Track Minimap Renderer (Bottom-Left Racetrack
  // & Cyan Glowing Dot) Uses a tall 3D oblique projection:
  //   X2d = x - y * 0.08 + z * 0.04
  //   Y2d = z * 1.05 - y * 1.58
  // Exaggerating vertical elevation y by 1.58x (paired with z * 1.05 so each
  // loop stays wide open) expands vertical spiral height to fill the 600x390
  // canvas so the BoYata climb, Cat Helix, and multi-coil Lamp Corkscrew read
  // immediately as tall 3D rollercoaster spirals rather than a flat map.
  let radarBgCanvas = document.createElement('canvas');
  radarBgCanvas.width = 600;
  radarBgCanvas.height = 390;

  const projMinimapRawX = (x, y, z) => x - y * 0.36 + z * 0.08;
  const projMinimapRawY = (_x, y, z) => z * 1.08 - y * 1.48;
  let mapMinimapX = (x, _y, _z) => x;
  let mapMinimapY = (_x, _y, z) => z;

  function rebuildMinimapForSpline(activeSplineData) {
    const bgCtx = radarBgCanvas.getContext('2d');
    const w = radarBgCanvas.width;
    const h = radarBgCanvas.height;
    bgCtx.clearRect(0, 0, w, h);

    const pts = activeSplineData.samples;
    const nPts = pts.length;
    let minPX = Infinity;
    let maxPX = -Infinity;
    let minPY = Infinity;
    let maxPY = -Infinity;
    for (let i = 0; i < nPts; i++) {
      const pos = pts[i].position;
      const px = projMinimapRawX(pos[0], pos[1], pos[2]);
      const py = projMinimapRawY(pos[0], pos[1], pos[2]);
      if (px < minPX) minPX = px;
      if (px > maxPX) maxPX = px;
      if (py < minPY) minPY = py;
      if (py > maxPY) maxPY = py;
    }
    const padX = 44;
    const padY = 38;
    const spanX = Math.max(1e-4, maxPX - minPX);
    const spanY = Math.max(1e-4, maxPY - minPY);
    const scale = Math.min((w - padX * 2) / spanX, (h - padY * 2) / spanY);
    const offsetX = (w - spanX * scale) * 0.5 - minPX * scale;
    const offsetY = (h - spanY * scale) * 0.5 - minPY * scale;

    mapMinimapX = (x, y, z) => projMinimapRawX(x, y, z) * scale + offsetX;
    mapMinimapY = (x, y, z) => projMinimapRawY(x, y, z) * scale + offsetY;

    const p2d = new Array(nPts);
    for (let i = 0; i < nPts; i++) {
      const pos = pts[i].position;
      p2d[i] = {
        x: mapMinimapX(pos[0], pos[1], pos[2]),
        y: mapMinimapY(pos[0], pos[1], pos[2]),
        elev: pos[1],
      };
    }

    const traceSmoothClosedPath = (ctx, arr, yOffsetPx = 0.0) => {
      ctx.beginPath();
      const mid0x = (arr[nPts - 1].x + arr[0].x) * 0.5;
      const mid0y = (arr[nPts - 1].y + arr[0].y) * 0.5 + yOffsetPx;
      ctx.moveTo(mid0x, mid0y);
      for (let i = 0; i < nPts; i++) {
        const curr = arr[i];
        const next = arr[(i + 1) % nPts];
        const midX = (curr.x + next.x) * 0.5;
        const midY = (curr.y + next.y) * 0.5 + yOffsetPx;
        ctx.quadraticCurveTo(curr.x, curr.y + yOffsetPx, midX, midY);
      }
      ctx.closePath();
    };

    bgCtx.lineJoin = 'round';
    bgCtx.lineCap = 'round';

    bgCtx.save();
    bgCtx.shadowColor = 'rgba(0, 0, 0, 0.90)';
    bgCtx.shadowBlur = 20;
    bgCtx.shadowOffsetX = 0;
    bgCtx.shadowOffsetY = 9;
    bgCtx.strokeStyle = 'rgba(0, 0, 0, 0.68)';
    bgCtx.lineWidth = 17.5;
    traceSmoothClosedPath(bgCtx, p2d, 2.5);
    bgCtx.stroke();
    bgCtx.restore();

    bgCtx.strokeStyle = 'rgba(0, 0, 0, 0.82)';
    bgCtx.lineWidth = 19.0;
    traceSmoothClosedPath(bgCtx, p2d, 2.2);
    bgCtx.stroke();

    bgCtx.strokeStyle = '#52637a';
    bgCtx.lineWidth = 12.2;
    traceSmoothClosedPath(bgCtx, p2d, 4.0);
    bgCtx.stroke();

    bgCtx.strokeStyle = '#cdd8e8';
    bgCtx.lineWidth = 12.0;
    traceSmoothClosedPath(bgCtx, p2d, 0.0);
    bgCtx.stroke();
  }
  rebuildMinimapForSpline(splineData);

  function drawMinimapRadar(st) {
    const radarCanvas = document.getElementById('minimap-canvas');
    if (!radarCanvas) return;
    const radarCtx = radarCanvas.getContext('2d');
    if (!radarCtx) return;
    const w = radarCanvas.width;
    const h = radarCanvas.height;
    radarCtx.clearRect(0, 0, w, h);
    if (radarBgCanvas) {
      radarCtx.drawImage(radarBgCanvas, 0, 0, w, h);
    }

    const kx = mapMinimapX(st.position.x, st.position.y, st.position.z);
    const ky = mapMinimapY(st.position.x, st.position.y, st.position.z);

    radarCtx.save();
    const haloGrad = radarCtx.createRadialGradient(kx, ky, 3.0, kx, ky, 26.0);
    haloGrad.addColorStop(0.0, 'rgba(0, 240, 255, 0.90)');
    haloGrad.addColorStop(0.45, 'rgba(0, 224, 255, 0.44)');
    haloGrad.addColorStop(1.0, 'rgba(0, 210, 255, 0.0)');
    radarCtx.fillStyle = haloGrad;
    radarCtx.beginPath();
    radarCtx.arc(kx, ky, 26.0, 0, Math.PI * 2);
    radarCtx.fill();

    radarCtx.fillStyle = 'rgba(0, 12, 22, 0.55)';
    radarCtx.beginPath();
    radarCtx.arc(kx, ky, 12.2, 0, Math.PI * 2);
    radarCtx.fill();

    radarCtx.fillStyle = '#00e8ff';
    radarCtx.beginPath();
    radarCtx.arc(kx, ky, 10.2, 0, Math.PI * 2);
    radarCtx.fill();

    radarCtx.fillStyle = '#dcfdff';
    radarCtx.beginPath();
    radarCtx.arc(kx, ky, 4.8, 0, Math.PI * 2);
    radarCtx.fill();
    radarCtx.restore();
  }

  // Cache HUD DOM elements
  const elScaleSpeed = document.getElementById('hud-scale-speed');
  const elLapCurr = document.getElementById('hud-lap-curr');
  const elLapTimer = document.getElementById('hud-lap-timer');
  const elLapSplit = document.getElementById('hud-lap-split');
  const lapDigitEls = [
    document.getElementById('lap-d0'),
    document.getElementById('lap-d1'),
    document.getElementById('lap-d2'),
    document.getElementById('lap-d3'),
    document.getElementById('lap-d4'),
    document.getElementById('lap-d5'),
  ];
  const elF1Countdown = document.getElementById('hud-f1-countdown');
  const elFinishOverlay = document.getElementById('hud-finish-overlay');
  const elFinishTime = document.getElementById('hud-finish-time');
  const elFinishSub = document.getElementById('hud-finish-sub');
  const elVisorInline = document.getElementById('visor-telem-inline');

  function formatLapTimerMMSSCC(seconds) {
    const totalCentis = Math.max(0, Math.floor((seconds || 0) * 100));
    const mins = Math.floor(totalCentis / 6000);
    const secs = Math.floor((totalCentis % 6000) / 100);
    const centis = totalCentis % 100;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(centis).padStart(2, '0')}`;
  }

  let lapSplitTimeout = null;
  let finishOverlayShown = false;

  function hideLapSplit() {
    if (lapSplitTimeout) {
      clearTimeout(lapSplitTimeout);
      lapSplitTimeout = null;
    }
    if (elLapSplit) {
      elLapSplit.classList.add('hidden');
    }
  }

  function showLapSplit(completedLapNum, lapTime) {
    if (!elLapSplit) return;
    if (lapSplitTimeout) {
      clearTimeout(lapSplitTimeout);
    }
    elLapSplit.textContent = `LAP ${completedLapNum}  ${formatLapTimerMMSSCC(lapTime)}`;
    elLapSplit.classList.remove('hidden');
    lapSplitTimeout = setTimeout(() => {
      elLapSplit.classList.add('hidden');
      lapSplitTimeout = null;
    }, 2400);
  }

  function hideFinishOverlay() {
    finishOverlayShown = false;
    if (elFinishOverlay) {
      elFinishOverlay.classList.add('hidden');
    }
    if (typeof syncMobileTouchControlsVisibility === 'function') {
      syncMobileTouchControlsVisibility();
    }
  }

  function showFinishOverlay(totalTime, bestLap, playAudio = true) {
    hideLapSplit();
    if (elFinishTime) {
      elFinishTime.textContent = formatLapTimerMMSSCC(totalTime);
    }
    if (elFinishSub) {
      const bestVal = bestLap != null ? bestLap : (totalTime || 0) / 3;
      elFinishSub.textContent = `BEST LAP ${formatLapTimerMMSSCC(bestVal)}`;
    }
    if (elFinishOverlay) {
      elFinishOverlay.classList.remove('hidden');
    }
    if (typeof syncMobileTouchControlsVisibility === 'function') {
      syncMobileTouchControlsVisibility();
    }
    if (playAudio && !finishOverlayShown) {
      if (audioSynth.playRaceFinishFanfare) {
        audioSynth.playRaceFinishFanfare();
      } else {
        audioSynth.playLapChime();
      }
    }
    finishOverlayShown = true;
  }

  function finalizeVictoryFinish() {
    const p = cinematicFinishState.payload;
    const totalVal = cinematicFinishState.finalTotal;
    const bestVal = cinematicFinishState.bestLap;
    cancelCinematicFinish();

    // Engage smooth AI highway cruise after crossing the finish line (Asphalt / NFS post-race rolling cruise)
    physics.state.raceFinished = false;
    physics.state.autopilot = true;

    if (raceFinishListeners.size === 0 || isScreenshotMode) {
      showFinishOverlay(totalVal, bestVal, false);
    }
    if (p) {
      for (const cb of raceFinishListeners) {
        cb(p);
      }
    }
  }

  physics.onLapComplete((lapTime, bestLap, completedLapNum, totalTime, isFinish) => {
    if (isFinish) {
      if (audioSynth.stopEngine) {
        audioSynth.stopEngine();
      }
      if (audioSynth.playRaceFinishFanfare) {
        audioSynth.playRaceFinishFanfare();
      } else {
        audioSynth.playLapChime();
      }
      const finalTotal =
        totalTime ?? physics.state.finishTotalTime ?? physics.state.totalRaceTime ?? lapTime;
      const rank = rivalsController.getPlayerRank
        ? rivalsController.getPlayerRank(physics.state)
        : 1;
      const payload = {
        totalTime: finalTotal,
        bestLap: bestLap ?? lapTime,
        lapTimes: physics.state.lapTimes.slice(),
        finishRank: rank,
      };

      // Ignite twin nitro exhaust flames across the line (no cheesy confetti fireworks)
      physics.state.boostActive = Math.max(physics.state.boostActive || 0.0, 2.5);

      if (isScreenshotMode) {
        if (raceFinishListeners.size === 0) {
          showFinishOverlay(finalTotal, bestLap ?? lapTime, false);
        }
        for (const cb of raceFinishListeners) {
          cb(payload);
        }
      } else {
        // Trigger 1.85s Cinematic Slow-Motion Victory Finish sweep before presenting Finish overlay
        hideLapSplit();
        cinematicFinishState.active = true;
        cinematicFinishState.elapsed = 0.0;
        cinematicFinishState.timeScale = 1.0;
        cinematicFinishState.sweepSide = physics.state.lateralOffset >= 0 ? -1 : 1;
        cinematicFinishState.finalTotal = finalTotal;
        cinematicFinishState.bestLap = bestLap ?? lapTime;
        cinematicFinishState.payload = payload;
      }
    } else {
      audioSynth.playLapChime();
      const lapNum = completedLapNum || Math.max(1, (physics.state.lapCount || 2) - 1);
      showLapSplit(lapNum, lapTime);
    }
  });

  physics.onModeChange((isAuto) => {
    syncAutopilotUI(isAuto);
    if (isAuto) {
      cancelCinematicFinish();
      hideFinishOverlay();
      hideLapSplit();
      cancelF1StartCountdown();
    }
  });

  // Formula 1 5-Light Start Sequence State (Triggered by pressing Enter or START RACE)
  const f1CountdownState = {
    active: false,
    elapsed: 0.0,
    stepDuration: 0.45, // Snappy 5-light sequence (2.25s total before Lights Out!)
    lastStepIndex: -1,
  };

  function cancelF1StartCountdown() {
    f1CountdownState.active = false;
    f1CountdownState.elapsed = 0.0;
    f1CountdownState.lastStepIndex = -1;
    physics.state.countdownLocked = false;
    if (activeWorldMap && activeWorldMap.setF1StartLights) {
      activeWorldMap.setF1StartLights(0);
    }
    if (elF1Countdown) {
      elF1Countdown.classList.add('hidden');
    }
  }

  function startF1StartCountdown() {
    hideFinishOverlay();
    hideLapSplit();
    physics.setAutopilot(false);
    const btnAutoText = document.getElementById('autopilot-btn-text');
    if (btnAutoText) btnAutoText.textContent = 'Manual WASD Racing';
    physics.resetToStart();
    physics.state.countdownLocked = true;
    physics.state.raceClockActive = false;

    f1CountdownState.active = true;
    f1CountdownState.elapsed = 0.0;
    f1CountdownState.lastStepIndex = 1;

    if (activeWorldMap && activeWorldMap.setF1StartLights) {
      activeWorldMap.setF1StartLights(1);
    }
    if (audioSynth.playF1CountdownBeep) {
      audioSynth.playF1CountdownBeep(false);
    }
    if (elF1Countdown) {
      elF1Countdown.textContent = '5';
      elF1Countdown.classList.remove('hidden');
    }
  }

  function stepF1StartCountdown(dt) {
    if (!f1CountdownState.active) return;
    f1CountdownState.elapsed += dt;
    const stepIdx = Math.floor(f1CountdownState.elapsed / f1CountdownState.stepDuration) + 1;

    if (stepIdx <= 5) {
      if (stepIdx !== f1CountdownState.lastStepIndex) {
        f1CountdownState.lastStepIndex = stepIdx;
        if (activeWorldMap && activeWorldMap.setF1StartLights) {
          activeWorldMap.setF1StartLights(stepIdx);
        }
        if (audioSynth.playF1CountdownBeep) {
          audioSynth.playF1CountdownBeep(false);
        }
        if (elF1Countdown) {
          elF1Countdown.textContent = String(6 - stepIdx);
          elF1Countdown.classList.remove('hidden');
        }
      }
    } else {
      f1CountdownState.active = false;
      f1CountdownState.lastStepIndex = -1;
      if (activeWorldMap && activeWorldMap.setF1StartLights) {
        activeWorldMap.setF1StartLights(0);
      }
      if (audioSynth.playF1CountdownBeep) {
        audioSynth.playF1CountdownBeep(true);
      }
      if (elF1Countdown) {
        elF1Countdown.classList.add('hidden');
      }
      physics.state.countdownLocked = false;
      physics.state.raceClockActive = true;
      if (physics.notifyLightsOut) {
        physics.notifyLightsOut();
      }
    }
  }

  // -------------------------------------------------------------------------
  // WELCOME DIALOG & START RACE BUTTON (SHOWN ON LAUNCH)
  // -------------------------------------------------------------------------
  const elWelcomeOverlay = document.getElementById('welcome-dialog-overlay');
  const btnWelcomeStart = document.getElementById('btn-welcome-start');
  const elWelcomeStartText = document.getElementById('welcome-start-text');
  const elWelcomeEnterKbd = document.getElementById('welcome-enter-kbd');
  const elWelcomeProgressFill = document.getElementById('welcome-btn-progress-fill');
  const btnFinishRaceAgain = document.getElementById('btn-finish-race-again');
  const btnFinishAutopilot = document.getElementById('btn-finish-autopilot');

  function focusWelcomeStartButton() {
    if (isScreenshotMode) return;
    if (elWelcomeOverlay && !elWelcomeOverlay.classList.contains('hidden') && btnWelcomeStart) {
      try {
        window.focus();
        btnWelcomeStart.focus({ preventScroll: true });
      } catch (_e) {
        // Ignore cross-origin focus restrictions
      }
    }
  }

  function updateWelcomeWarmupUI() {
    if (isScreenshotMode || !btnWelcomeStart) return;
    if (isCircuitReady) {
      btnWelcomeStart.classList.remove('is-warming-up', 'is-queued');
      if (elWelcomeProgressFill) elWelcomeProgressFill.style.width = '100%';
      if (elWelcomeStartText) elWelcomeStartText.textContent = 'START TIME TRIAL';
      if (elWelcomeEnterKbd) elWelcomeEnterKbd.textContent = 'ENTER ↵';
      focusWelcomeStartButton();
      return;
    }

    const weightedFraction =
      glbDownloadProgress.desk * 0.26 +
      glbDownloadProgress.track * 0.32 +
      glbDownloadProgress.room * 0.28 +
      glbDownloadProgress.kart * 0.06 +
      audioPreloadProgress * 0.08;
    const pct = Math.max(8, Math.min(99, Math.round(weightedFraction * 100)));

    btnWelcomeStart.classList.add('is-warming-up');
    btnWelcomeStart.classList.toggle('is-queued', pendingRaceStartAfterWarmup);
    if (elWelcomeProgressFill) {
      elWelcomeProgressFill.style.width = `${pct}%`;
    }
    if (elWelcomeStartText) {
      elWelcomeStartText.textContent = pendingRaceStartAfterWarmup
        ? 'STARTING TIME TRIAL...'
        : 'PREPARING CIRCUIT...';
    }
    if (elWelcomeEnterKbd) {
      elWelcomeEnterKbd.textContent = `${pct}%`;
    }
  }

  onCircuitWarmupProgressCallback = updateWelcomeWarmupUI;
  onCircuitReadyCallback = () => {
    updateWelcomeWarmupUI();
    if (pendingRaceStartAfterWarmup) {
      pendingRaceStartAfterWarmup = false;
      dismissWelcomeAndStartRace();
    }
  };
  updateWelcomeWarmupUI();
  focusWelcomeStartButton();

  // Ensure moving the cursor into the preview iframe while Welcome Dialog is open pulls keyboard
  // focus away from any parent toolbar button (e.g. Reload) so Enter always starts the race
  window.addEventListener(
    'pointermove',
    () => {
      if (
        elWelcomeOverlay &&
        !elWelcomeOverlay.classList.contains('hidden') &&
        document.activeElement !== btnWelcomeStart
      ) {
        focusWelcomeStartButton();
      }
    },
    { passive: true }
  );

  // Hide welcome dialog in headless screenshot mode unless ?welcome=1 is explicitly requested
  if (
    elWelcomeOverlay &&
    urlParams.get('screenshot') === '1' &&
    urlParams.get('welcome') !== '1'
  ) {
    elWelcomeOverlay.classList.add('hidden');
  }
  if (urlParams.get('finish') === '1') {
    if (elWelcomeOverlay) elWelcomeOverlay.classList.add('hidden');
    showFinishOverlay(51.42, 16.84, false);
  }

  const elMobileTouchControls = document.getElementById('mobile-touch-controls');
  const mobileControlButtons = elMobileTouchControls
    ? Array.from(elMobileTouchControls.querySelectorAll('.mobile-ctrl-btn'))
    : [];
  const activeTouchDirs = new Set();
  const activePointerDirs = new Map();

  function applyMobileTouchState() {
    const allDirs = ['left', 'right', 'forward', 'backward'];
    for (const dir of allDirs) {
      let isPressed = activeTouchDirs.has(dir);
      if (!isPressed) {
        for (const pDir of activePointerDirs.values()) {
          if (pDir === dir) {
            isPressed = true;
            break;
          }
        }
      }
      if (physics.setTouchKey) {
        physics.setTouchKey(dir, isPressed);
      }
    }
    for (const btn of mobileControlButtons) {
      const dir = btn.dataset.control;
      const isPressed = Boolean(dir && physics.keys[dir]);
      btn.classList.toggle('is-pressed', isPressed);
      btn.setAttribute('aria-pressed', isPressed ? 'true' : 'false');
    }
  }

  function releaseAllMobileTouchControls() {
    activeTouchDirs.clear();
    activePointerDirs.clear();
    if (physics.clearTouchKeys) {
      physics.clearTouchKeys();
    }
    for (const btn of mobileControlButtons) {
      btn.classList.remove('is-pressed');
      btn.setAttribute('aria-pressed', 'false');
    }
  }

  function syncMobileTouchControlsVisibility() {
    if (!elMobileTouchControls) return;
    const isWelcomeOpen =
      elWelcomeOverlay && !elWelcomeOverlay.classList.contains('hidden');
    const isFinishOpen =
      elFinishOverlay && !elFinishOverlay.classList.contains('hidden');
    const shouldHide = Boolean(isWelcomeOpen || isFinishOpen);
    elMobileTouchControls.classList.toggle('hidden', shouldHide);
    if (shouldHide) {
      releaseAllMobileTouchControls();
    }
  }

  if (elMobileTouchControls && mobileControlButtons.length > 0) {
    const updateFromTouches = (e) => {
      if (e.cancelable) {
        e.preventDefault();
      }
      activeTouchDirs.clear();
      const touches = e.touches || [];
      for (let i = 0; i < touches.length; i++) {
        const t = touches[i];
        const hitEl = document.elementFromPoint(t.clientX, t.clientY);
        const btn = hitEl && hitEl.closest ? hitEl.closest('.mobile-ctrl-btn') : null;
        if (btn && btn.dataset.control) {
          activeTouchDirs.add(btn.dataset.control);
        }
      }
      applyMobileTouchState();
    };

    elMobileTouchControls.addEventListener('touchstart', updateFromTouches, {
      passive: false,
    });
    elMobileTouchControls.addEventListener('touchmove', updateFromTouches, {
      passive: false,
    });
    elMobileTouchControls.addEventListener('touchend', updateFromTouches, {
      passive: false,
    });
    elMobileTouchControls.addEventListener('touchcancel', updateFromTouches, {
      passive: false,
    });
    elMobileTouchControls.addEventListener('contextmenu', (e) => {
      e.preventDefault();
    });

    for (const btn of mobileControlButtons) {
      const dir = btn.dataset.control;
      if (!dir) continue;

      btn.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'touch') return;
        e.preventDefault();
        e.stopPropagation();
        try {
          btn.setPointerCapture(e.pointerId);
        } catch (_err) {
          // Ignore pointer capture errors
        }
        activePointerDirs.set(e.pointerId, dir);
        applyMobileTouchState();
      });

      const releasePointer = (e) => {
        if (e.pointerType === 'touch') return;
        if (activePointerDirs.has(e.pointerId)) {
          activePointerDirs.delete(e.pointerId);
          applyMobileTouchState();
        }
      };

      btn.addEventListener('pointerup', releasePointer);
      btn.addEventListener('pointercancel', releasePointer);
      btn.addEventListener('lostpointercapture', releasePointer);
    }

    window.addEventListener('blur', releaseAllMobileTouchControls);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        releaseAllMobileTouchControls();
      }
    });
  }

  syncMobileTouchControlsVisibility();

  function showWelcomeDialog() {
    if (elWelcomeOverlay) {
      elWelcomeOverlay.classList.remove('hidden');
      focusWelcomeStartButton();
    }
    syncMobileTouchControlsVisibility();
  }

  function hideWelcomeDialog() {
    if (elWelcomeOverlay && !elWelcomeOverlay.classList.contains('hidden')) {
      elWelcomeOverlay.classList.add('hidden');
    }
    syncMobileTouchControlsVisibility();
  }

  if (elBrandLogo) {
    elBrandLogo.addEventListener('click', (e) => {
      e.stopPropagation();
      showWelcomeDialog();
    });
    elBrandLogo.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        showWelcomeDialog();
      }
    });
  }

  function snapChaseCameraToStartGrid() {
    const st = physics.state;
    camShakeTimer = 0.0;
    camShakeIntensity = 0.0;
    if (activeCameraMode === 1) {
      camera.fov = 70.0;
      camera.updateProjectionMatrix();
    }
    camForward.copy(st.tangent).normalize();
    camCurrentUp.set(0, 1, 0);
    camCurrentPos
      .copy(st.position)
      .addScaledVector(st.tangent, -0.0124)
      .addScaledVector(st.normal, 0.0068);
    camCurrentLookAt
      .copy(st.position)
      .addScaledVector(st.tangent, 0.0165)
      .addScaledVector(st.normal, 0.0024);
    camera.up.copy(camCurrentUp);
    camera.position.copy(camCurrentPos);
    camera.lookAt(camCurrentLookAt);
  }

  function dismissWelcomeAndStartRace() {
    if (audioSynth.setEnabled && !audioSynth.isEnabled?.()) {
      const on = audioSynth.setEnabled(true);
      updateAudioButtonUI(on);
    }
    isCircuitReady = true;
    pendingRaceStartAfterWarmup = false;
    cancelCinematicFinish();
    hideWelcomeDialog();
    hideFinishOverlay();
    hideLapSplit();
    if (vfxManager) vfxManager.reset();
    if (powerupManager) powerupManager.reset();
    if (rivalsController) rivalsController.reset();
    startF1StartCountdown();
    // Hard-snap chase camera & damping directly onto the start grid so it never interpolates across empty space
    snapChaseCameraToStartGrid();
  }

  if (btnWelcomeStart) {
    btnWelcomeStart.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissWelcomeAndStartRace();
      btnWelcomeStart.blur();
    });
    btnWelcomeStart.addEventListener('keydown', (e) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter' || e.key === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        e.stopPropagation();
        dismissWelcomeAndStartRace();
        btnWelcomeStart.blur();
      }
    });
  }

  if (btnFinishRaceAgain) {
    btnFinishRaceAgain.addEventListener('click', (e) => {
      e.stopPropagation();
      dismissWelcomeAndStartRace();
      btnFinishRaceAgain.blur();
    });
  }

  if (btnFinishAutopilot) {
    btnFinishAutopilot.addEventListener('click', (e) => {
      e.stopPropagation();
      hideWelcomeDialog();
      hideFinishOverlay();
      hideLapSplit();
      cancelF1StartCountdown();
      physics.setAutopilot(true);
      btnFinishAutopilot.blur();
    });
  }

  camButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      hideWelcomeDialog();
    });
  });

  window.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName) && !e.target.readOnly) return;
    if (e.repeat) return;
    if (currentAppScreen !== 'RACE') return;
    if (e.code === 'KeyR') {
      cancelCinematicFinish();
      hideWelcomeDialog();
      hideFinishOverlay();
      hideLapSplit();
      cancelF1StartCountdown();
      if (vfxManager) vfxManager.reset();
    } else if (e.code === 'KeyP') {
      cancelCinematicFinish();
      hideWelcomeDialog();
      hideFinishOverlay();
      hideLapSplit();
      cancelF1StartCountdown();
      if (vfxManager) vfxManager.reset();
    }
  });

  let lastScaleKmh = -1;
  let lastActiveSegs = -1;
  let lastLapCurr = -1;
  let lastLapTimerStr = '';
  let lastVisorStr = '';

  function updateHUD(st) {
    if (!isScreenshotMode) return;
    if (activeCameraMode !== 1 && activeCameraMode !== 2) return;
    // 1:150 N-Scale Speed in km/h (calibrated so 0.204 m/s cruise = 75 km/h, 0.289 m/s boost = 106 km/h)
    const absSpeed = Math.abs(st.speed);
    const scaleKmh = Math.round(absSpeed * 102.35 * 3.6);

    if (elScaleSpeed && scaleKmh !== lastScaleKmh) {
      lastScaleKmh = scaleKmh;
      elScaleSpeed.textContent = String(scaleKmh);
    }

    // Light up 0..18 angled speed segments (white -> ice-cyan -> electric cyan)
    const activeSegs =
      scaleKmh <= 0 ? 0 : Math.min(18, Math.max(1, Math.round((scaleKmh / 104.0) * 18)));
    if (activeSegs !== lastActiveSegs && speedoSegEls.length === 18) {
      lastActiveSegs = activeSegs;
      for (let i = 0; i < 18; i++) {
        const segEl = speedoSegEls[i];
        if (!segEl) continue;
        if (i < activeSegs) {
          segEl.style.fill = SPEEDO_SEG_COLORS[i];
          if (i >= 10) {
            segEl.setAttribute('filter', 'url(#speedoCyanGlow)');
          } else {
            segEl.removeAttribute('filter');
          }
        } else {
          segEl.style.fill = 'rgba(255, 255, 255, 0.12)';
          segEl.removeAttribute('filter');
        }
      }
    }

    // Top-Right Lap Counter (LAP 1/3) & Continuous 3-Lap Total Timer (MM:SS.CC with rock-solid fixed-width digit spans)
    const isPAutoMode = Boolean(st.autopilot && !st.victoryCruise);
    const lapDisplay = isPAutoMode ? 1 : Math.min(3, Math.max(1, st.lapCount || 1));
    if (elLapCurr && lapDisplay !== lastLapCurr) {
      lastLapCurr = lapDisplay;
      elLapCurr.textContent = String(lapDisplay);
    }
    if (elLapTimer) {
      const displayTime = isPAutoMode
        ? 0.0
        : st.raceFinished && st.finishTotalTime != null
          ? st.finishTotalTime
          : st.totalRaceTime !== undefined
            ? st.totalRaceTime
            : st.currentLapTime;
      const timerStr = formatLapTimerMMSSCC(displayTime);
      if (timerStr !== lastLapTimerStr) {
        lastLapTimerStr = timerStr;
        // timerStr format: "MM:SS.CC" -> indices [0, 1, 3, 4, 6, 7]
        const digitIndices = [0, 1, 3, 4, 6, 7];
        for (let d = 0; d < 6; d++) {
          const spanEl = lapDigitEls[d];
          const ch = timerStr[digitIndices[d]];
          if (spanEl && spanEl.textContent !== ch) {
            spanEl.textContent = ch;
          }
        }
        elLapTimer.setAttribute('aria-label', timerStr);
      }
    }

    if (elVisorInline && activeCameraMode === 2) {
      const visorStr = `${scaleKmh} KM/H | BANK ${st.bankDeg.toFixed(1)}° | ${st.downforceG.toFixed(2)}G`;
      if (visorStr !== lastVisorStr) {
        lastVisorStr = visorStr;
        elVisorInline.textContent = visorStr;
      }
    }

    drawMinimapRadar(st);
  }

  // -------------------------------------------------------------------------
  // URL QUERY PARAMETERS (?cam=1..4/6, ?sector=1..6, ?s=..., ?finish=1, ?dof=..., and ?screenshot=1)
  // -------------------------------------------------------------------------
  if (urlParams.has('sector')) {
    const requestedSector = parseInt(urlParams.get('sector'), 10);
    if (requestedSector >= 1 && requestedSector <= 6) {
      physics.teleportToSector(requestedSector);
    }
  }
  if (urlParams.has('s')) {
    const requestedS = parseFloat(urlParams.get('s'));
    if (!Number.isNaN(requestedS)) {
      physics.state.s = requestedS;
    }
  }
  if (urlParams.has('speed')) {
    const requestedSpeed = parseFloat(urlParams.get('speed'));
    if (!Number.isNaN(requestedSpeed)) {
      physics.state.speed = requestedSpeed;
    }
  }
  if (urlParams.get('boost') === '1') {
    physics.state.boostActive = 1.5;
  }
  if (urlParams.has('laptime')) {
    const requestedLapTime = parseFloat(urlParams.get('laptime'));
    if (!Number.isNaN(requestedLapTime)) {
      physics.state.currentLapTime = requestedLapTime;
      physics.state.totalRaceTime = requestedLapTime;
    }
  }
  if (urlParams.get('finish') === '1') {
    physics.state.raceFinished = true;
    physics.state.finishTotalTime = 64.28;
    physics.state.totalRaceTime = 64.28;
    physics.state.bestLapTime = 20.84;
    physics.state.lapCount = 3;
    showFinishOverlay(64.28, 20.84, false);
  }
  if (urlParams.has('f1step')) {
    const f1Step = parseInt(urlParams.get('f1step'), 10);
    if (f1Step >= 1 && f1Step <= 5) {
      startF1StartCountdown();
      f1CountdownState.elapsed = (f1Step - 1) * f1CountdownState.stepDuration;
      f1CountdownState.lastStepIndex = -1;
      stepF1StartCountdown(0.0);
    }
  }
  if (urlParams.has('cam')) {
    const requestedCam = parseInt(urlParams.get('cam'), 10);
    if (requestedCam >= 1 && requestedCam <= 9) {
      setCameraMode(requestedCam === 6 ? 4 : requestedCam);
    }
  } else {
    setCameraMode(activeCameraMode);
  }
  if (urlParams.get('sparks') === '1') {
    physics.setAutopilot(true);
    physics.state.speed = 0.215;
    physics.state.isDrifting = true;
    physics.state.boostActive = 1.2;
    for (let step = 0; step < 26; step++) {
      const preSt = physics.stepPhysics(1 / 60);
      microKart.kartRoot.position.copy(preSt.position);
      microKart.kartRoot.quaternion.copy(preSt.quaternion);
      microKart.updateWheels(1 / 60, preSt.speed, preSt.steerAngle);
      microKart.updateKartVisuals(1 / 60, preSt);
    }
  }
  if (urlParams.has('dof')) {
    const requestedDof = parseFloat(urlParams.get('dof'));
    if (!Number.isNaN(requestedDof)) {
      settings.dofStrength = requestedDof;
      if (sliderDof) sliderDof.value = String(requestedDof);
      if (valDof) valDof.textContent = `${requestedDof.toFixed(2)}x`;
    }
  }
  if (urlParams.has('campose')) {
    const parts = urlParams.get('campose').split(',').map((v) => parseFloat(v));
    if (parts.length >= 6 && parts.every((n) => !Number.isNaN(n))) {
      camera.position.set(parts[0], parts[1], parts[2]);
      orbitControls.target.set(parts[3], parts[4], parts[5]);
      orbitControls.update();
      camCurrentPos.copy(camera.position);
      camCurrentLookAt.copy(orbitControls.target);
    }
  }
  const requestedTimeOffset = urlParams.has('t') ? parseFloat(urlParams.get('t')) || 0.0 : 0.0;
  const appInitTimestamp = performance.now();
  let screenshotFrameCounter = 0;

  // -------------------------------------------------------------------------
  // 7. WINDOW RESIZE & 60FPS ANIMATION LOOP
  // -------------------------------------------------------------------------
  window.addEventListener('resize', () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    composer.setSize(w, h);
    const newDrawSize = renderer.getDrawingBufferSize(new THREE.Vector2());
    fxaaPass.material.uniforms['resolution'].value.set(
      1.0 / newDrawSize.x,
      1.0 / newDrawSize.y
    );
  });

  const clock = new THREE.Clock();
  let currentFocusDistance = activeCameraMode === 7 ? 1.85 : activeCameraMode === 8 ? 0.42 : 0.12;

  // Pre-allocated vectors & 3D probe points for zero-GC exact view-space DOF
  // autofocus
  const _dofCamDir = new THREE.Vector3();
  const _dofVec = new THREE.Vector3();
  const _dofKartPos = new THREE.Vector3();
  const _dofNdc = new THREE.Vector3();
  const deskDofProbePoints = [
    new THREE.Vector3(-0.16, 0.024, 0.23),     // G915 Keyboard front-center
    new THREE.Vector3(-0.28, 0.024, 0.23),     // G915 Keyboard front-left
    new THREE.Vector3(-0.02, 0.024, 0.23),     // G915 Keyboard front-right
    new THREE.Vector3(-0.16, 0.028, 0.15),     // G915 Keyboard rear
    new THREE.Vector3(0.325, 0.032, 0.135),    // Gaming Mouse top
    new THREE.Vector3(0.24, 0.004, 0.24),      // Mousepad front-left corner
    new THREE.Vector3(0.42, 0.004, 0.24),      // Mousepad front-right corner
    new THREE.Vector3(-0.158, 0.068, -0.118),  // Ginger Cat figurine
    new THREE.Vector3(-0.025, 0.105, -0.045),  // Fifine AM8 Microphone head
    new THREE.Vector3(0.355, 0.125, -0.098),   // White Key-Light Lamp column
    new THREE.Vector3(-0.34, 0.145, -0.045),   // BoYata Laptop Stand
    new THREE.Vector3(-0.42, 0.045, 0.12),     // Stacked Art Books
  ];

  function computeExactViewDepth(worldPt) {
    return _dofVec.subVectors(worldPt, camera.position).dot(_dofCamDir);
  }

  function computeNearestVisibleObjectDepth(kartWorldPt) {
    camera.updateMatrixWorld();
    const minValidZ = camera.near + 0.003;
    let bestZ = Infinity;

    const testCandidate = (pt) => {
      const vz = _dofVec.subVectors(pt, camera.position).dot(_dofCamDir);
      if (vz <= minValidZ || vz >= bestZ) return;
      _dofNdc.copy(pt).project(camera);
      if (Math.abs(_dofNdc.x) <= 0.88 && Math.abs(_dofNdc.y) <= 0.88) {
        bestZ = vz;
      }
    };

    // 1. Test the kart itself
    testCandidate(kartWorldPt);

    // 2. Test 360 points along the 3D coaster track spline
    const samples = splineData.samples;
    for (let i = 0; i < samples.length; i += 2) {
      const p = samples[i].position;
      _dofKartPos.set(p[0], p[1], p[2]);
      testCandidate(_dofKartPos);
    }

    // 3. Test key surface points on the desk monuments
    for (let i = 0; i < deskDofProbePoints.length; i++) {
      testCandidate(deskDofProbePoints[i]);
    }

    return bestZ < Infinity ? bestZ : computeExactViewDepth(kartWorldPt);
  }

  const _showroomCamTarget = new THREE.Vector3();
  const _showroomLookTarget = new THREE.Vector3();
  let showroomPreviewBounce = 0.0;
  let lastStageMode = '';

  function snapHomeStartGridCamera() {
    const stHome = physics.state;
    // Front-3/4 hero shot from ahead & outer edge looking diagonally across the car down the open highway
    _showroomCamTarget
      .copy(stHome.position)
      .addScaledVector(stHome.tangent, 0.0125)
      .addScaledVector(stHome.right, -0.0085)
      .addScaledVector(stHome.normal, 0.0042);
    _showroomLookTarget
      .copy(stHome.position)
      .addScaledVector(stHome.tangent, -0.0035)
      .addScaledVector(stHome.right, 0.0005)
      .addScaledVector(stHome.normal, 0.0014);
    camCurrentPos.copy(_showroomCamTarget);
    camCurrentLookAt.copy(_showroomLookTarget);
    camera.up.set(0, 1, 0);
    camera.position.copy(camCurrentPos);
    camera.lookAt(camCurrentLookAt);
  }

  function switchActiveWorldMap(nextRawMapId) {
    const nextMapId = normalizeMapId(nextRawMapId);
    cancelCinematicFinish();
    if (nextMapId === currentMapId && activeWorldMap) {
      // Even if same map, ensure clean physics/camera hard-snap when requested
      physics.clearTouchKeys();
      physics.resetToStart();
      if (vfxManager) vfxManager.reset();
      if (rivalsController) rivalsController.reset();
      if (powerupManager) powerupManager.reset();
      if (currentAppScreen === 'MENU' || currentAppScreen === 'SPLASH') {
        snapHomeStartGridCamera();
      } else {
        snapChaseCameraToStartGrid();
      }
      return;
    }

    currentMapId = nextMapId;
    try {
      window.localStorage.setItem('the_race_3d_selected_map_v1', currentMapId);
    } catch (_e) {
      // ignore storage write error
    }

    // 1. Dispose outgoing outdoor map geometries, materials, InstancedMesh buffers & VFX pools cleanly
    if (activeWorldMap && activeWorldMap.dispose) {
      activeWorldMap.dispose();
    }
    if (vfxManager && vfxManager.dispose) {
      vfxManager.dispose();
    }
    vfxManager = createVFXManager(scene);
    vfxManager.setVisible(currentAppScreen === 'RACE');

    // 2. Build new map spline & 3D outdoor world
    splineData = getTrackSplineForMap(currentMapId);
    syncSectorNames(splineData);
    activeWorldMap = buildRealWorldMap(currentMapId, splineData, scene);
    if (cachedTrafficLightGlb && activeWorldMap.attachTrafficLightGlb) {
      activeWorldMap.attachTrafficLightGlb(cachedTrafficLightGlb);
    }

    const isGarage = currentAppScreen === 'GARAGE';
    activeWorldMap.rootGroup.visible = !isGarage;

    // 3. Re-bind physics, AI rivals, boost pads/ramps & minimap radar
    if (physics.setSplineData) {
      physics.setSplineData(splineData);
    }
    if (rivalsController && rivalsController.setSplineData) {
      rivalsController.setSplineData(splineData);
    }
    if (powerupManager && powerupManager.rebuildForSpline) {
      powerupManager.rebuildForSpline(splineData);
    }
    rebuildMinimapForSpline(splineData);

    // 4. Hard-snap camera directly onto the new start grid (Home showcase or Race grid)
    if (currentAppScreen === 'MENU' || currentAppScreen === 'SPLASH') {
      snapHomeStartGridCamera();
    } else if (currentAppScreen === 'RACE') {
      snapChaseCameraToStartGrid();
    }
    if (atmosphere.applyMapAtmospherePreset) {
      atmosphere.applyMapAtmospherePreset(currentMapId, isGarage, scene, renderer);
    }
  }

  // Expose clean engine API for React multi-screen UI ("The Race: Car Driving 3D")
  window.__theRaceEngine = {
    setScreen(screen) {
      const prev = currentAppScreen;
      currentAppScreen = screen;
      if (screen === 'RACE' && prev !== 'RACE') {
        showroomGroup.visible = false;
        pitGarage.rootGroup.visible = false;
        if (activeWorldMap) activeWorldMap.rootGroup.visible = true;
        if (vfxManager) vfxManager.setVisible(true);
        syncKartScaleForCamera(activeCameraMode);
        dismissWelcomeAndStartRace();
      } else if (screen !== 'RACE') {
        if (audioSynth.stopEngine) {
          audioSynth.stopEngine();
        }
        cancelCinematicFinish();
        cancelF1StartCountdown();
        if (vfxManager) {
          vfxManager.reset();
          vfxManager.setVisible(false);
        }
        physics.setAutopilot(false);
        physics.clearTouchKeys();
        physics.state.speed = 0;
        physics.state.boostActive = 0;
        physics.state.isDrifting = false;
        physics.state.curbRumble = 0;
        if (screen === 'MENU' || screen === 'SPLASH') {
          if (prev === 'RACE' || prev === 'GAMEOVER') {
            physics.resetToStart();
          }
          showroomGroup.visible = false;
          pitGarage.rootGroup.visible = false;
          if (activeWorldMap) activeWorldMap.rootGroup.visible = true;
          if (atmosphere.applyMapAtmospherePreset) {
            atmosphere.applyMapAtmospherePreset(currentMapId, false, scene, renderer);
          }
          snapHomeStartGridCamera();
        } else if (screen === 'GARAGE') {
          showroomGroup.visible = true;
          pitGarage.rootGroup.visible = true;
          if (activeWorldMap) activeWorldMap.rootGroup.visible = false;
          if (atmosphere.applyMapAtmospherePreset) {
            atmosphere.applyMapAtmospherePreset(currentMapId, true, scene, renderer);
          }
        }
      }
    },
    getScreen() {
      return currentAppScreen;
    },
    setMap(mapId) {
      switchActiveWorldMap(mapId);
    },
    getMap() {
      return currentMapId;
    },
    startRace() {
      currentAppScreen = 'RACE';
      showroomGroup.visible = false;
      pitGarage.rootGroup.visible = false;
      if (activeWorldMap) activeWorldMap.rootGroup.visible = true;
      setCameraMode(1);
      syncKartScaleForCamera(1);
      dismissWelcomeAndStartRace();
    },
    setBodyKit(kitId, stats, customOverrides) {
      if (microKart.setBodyKit) {
        microKart.setBodyKit(kitId, customOverrides);
      }
      if (stats && physics.setVehicleStats) {
        physics.setVehicleStats(stats);
      }
      showroomPreviewBounce = 1.0;
    },
    setCustomParts(parts) {
      if (microKart.setCustomParts) {
        microKart.setCustomParts(parts);
      }
      showroomPreviewBounce = 1.0;
    },
    rotateShowroom(deltaRad) {
      if (typeof deltaRad === 'number' && !Number.isNaN(deltaRad)) {
        turntableAngle += deltaRad;
        manualTurntableCooldown = 2.5;
      }
    },
    setTouchControl(dir, isDown) {
      if (physics.setTouchKey) {
        physics.setTouchKey(dir, isDown);
      }
    },
    clearTouchControls() {
      if (physics.clearTouchKeys) {
        physics.clearTouchKeys();
      }
    },
    triggerNitro() {
      if (physics.triggerNitroBoost) {
        const fired = physics.triggerNitroBoost();
        if (fired && audioSynth.playNitroBoost) {
          audioSynth.playNitroBoost();
        }
        return fired;
      }
      return false;
    },
    setCameraMode(mode) {
      setCameraMode(mode);
    },
    getCameraMode() {
      return activeCameraMode;
    },
    setAutopilot(val) {
      physics.setAutopilot(val);
    },
    toggleAudio() {
      const on = audioSynth.toggle();
      updateAudioButtonUI(on);
      return on;
    },
    setAudioEnabled(val) {
      const on = audioSynth.setEnabled(val);
      updateAudioButtonUI(on);
      return on;
    },
    isAudioEnabled() {
      return audioSynth.isEnabled ? audioSynth.isEnabled() : false;
    },
    playSplashImpact() {
      if (audioSynth.playSplashImpact) {
        audioSynth.playSplashImpact();
      }
    },
    playUiClick(variant = 'click') {
      if (audioSynth.playUiClick) {
        audioSynth.playUiClick(variant);
      }
    },
    setGraphicsSettings(newSettings) {
      if (newSettings.visualQuality === 'performance' || newSettings.visualQuality === 'ultra') {
        settings.visualQuality = newSettings.visualQuality;
        const targetDpr =
          newSettings.visualQuality === 'ultra'
            ? Math.min(window.devicePixelRatio || 1, 2.0)
            : Math.min(window.devicePixelRatio || 1, 1.35);
        renderer.setPixelRatio(targetDpr);
      }
      if (typeof newSettings.bloomStrength === 'number') {
        settings.bloomStrength = newSettings.bloomStrength;
        bloomPass.strength = newSettings.bloomStrength;
        bloomPass.enabled = newSettings.bloomStrength > 0.005;
      }
      if (typeof newSettings.dofStrength === 'number') {
        settings.dofStrength = newSettings.dofStrength;
        bokehPass.enabled = newSettings.dofStrength > 0.01;
      }
      if (typeof newSettings.lampIntensity === 'number') {
        settings.lampIntensity = newSettings.lampIntensity;
        renderer.toneMappingExposure = 0.68 + 0.08 * settings.lampIntensity;
      }
    },
    getGraphicsSettings() {
      return {
        bloomStrength: settings.bloomStrength,
        dofStrength: settings.dofStrength,
        lampIntensity: settings.lampIntensity,
        visualQuality: settings.visualQuality || 'performance',
      };
    },
    completeRaceDemo() {
      if (audioSynth.stopEngine) {
        audioSynth.stopEngine();
      }
      const l1 = 18.42;
      const l2 = 17.85;
      const l3 = 17.34;
      const total = l1 + l2 + l3;
      physics.state.lapTimes = [l1, l2, l3];
      physics.state.bestLapTime = l3;
      physics.state.totalRaceTime = total;
      physics.state.finishTotalTime = total;
      physics.state.raceFinished = true;
      physics.state.raceFinished = false;
      physics.state.autopilot = true;
      physics.state.raceClockActive = false;
      physics.state.boostActive = 2.0;
      if (audioSynth.playRaceFinishFanfare) {
        audioSynth.playRaceFinishFanfare();
      }
      for (const cb of raceFinishListeners) {
        cb({
          totalTime: total,
          bestLap: l3,
          lapTimes: [l1, l2, l3],
          finishRank: 1,
        });
      }
    },
    onTelemetry(cb) {
      telemetryListeners.add(cb);
      return () => telemetryListeners.delete(cb);
    },
    onRaceFinish(cb) {
      raceFinishListeners.add(cb);
      return () => raceFinishListeners.delete(cb);
    },
  };

  let lastTelemetryEmitMs = 0;
  let lastEmittedCountdownStep = -1;
  let lastEmittedLap = -1;

  function animate() {
    const dt = isScreenshotMode ? 1 / 60 : Math.min(clock.getDelta(), 0.05);
    const elapsedTime =
      (isScreenshotMode ? screenshotFrameCounter / 60 : clock.getElapsedTime()) +
      requestedTimeOffset;

    const isGarageMode = !isScreenshotMode && currentAppScreen === 'GARAGE';
    const isHomeOutdoorMode =
      !isScreenshotMode &&
      (currentAppScreen === 'SPLASH' || currentAppScreen === 'MENU');

    if (isGarageMode) {
      // GARAGE BACKGROUND: Indoor Automotive Pit-Lane Workshop Bay & Spinning Turntable
      scene.environmentIntensity = 0.36;
      showroomGroup.visible = true;
      pitGarage.rootGroup.visible = true;
      if (activeWorldMap) activeWorldMap.rootGroup.visible = false;
      if (powerupManager && powerupManager.rootGroup) powerupManager.rootGroup.visible = false;
      if (rivalsController && rivalsController.rootGroup) rivalsController.rootGroup.visible = false;
      if (vfxManager) vfxManager.setVisible(false);

      if (manualTurntableCooldown > 0) {
        manualTurntableCooldown = Math.max(0.0, manualTurntableCooldown - dt);
      } else {
        turntableAngle += dt * 0.58;
      }
      showroomPlatform.rotation.y = turntableAngle;
      showroomCarShadowDisc.rotation.z = -(turntableAngle + Math.PI * 0.22);

      if (showroomPreviewBounce > 0) {
        showroomPreviewBounce = Math.max(0.0, showroomPreviewBounce - dt * 4.5);
      }
      const bounceOffset = Math.sin(showroomPreviewBounce * Math.PI) * 0.0012;

      microKart.setCockpitRoadOnly(false);
      microKart.kartRoot.scale.setScalar(0.94);
      microKart.kartRoot.position.set(0.0, 0.0884 + bounceOffset, 0.22);
      microKart.kartRoot.rotation.set(0, turntableAngle + Math.PI * 0.22, 0);
      microKart.chassisGroup.rotation.set(0, 0, 0);
      microKart.chassisGroup.position.y = Math.sin(elapsedTime * 2.5) * 0.00012;
      microKart.updateWheels(dt, 0.032, Math.sin(elapsedTime * 1.1) * 0.22);
      if (microKart.sparkPoints) microKart.sparkPoints.visible = false;
      if (microKart.driftSmokeMesh) microKart.driftSmokeMesh.visible = false;

      orbitControls.enabled = false;
      const isPortraitScreen = camera.aspect < 0.95;
      const targetGarageFov = isPortraitScreen ? 48.0 : 44.0;
      if (Math.abs(camera.fov - targetGarageFov) > 0.2) {
        camera.fov = targetGarageFov;
        camera.updateProjectionMatrix();
      }
      if (isPortraitScreen) {
        const portraitPull = THREE.MathUtils.clamp((0.95 - camera.aspect) / 0.55, 0.0, 1.0);
        _showroomCamTarget.set(0.0, 0.0975, 0.260 + portraitPull * 0.024);
        _showroomLookTarget.set(0.0, 0.0885, 0.220);
      } else {
        _showroomCamTarget.set(0.0, 0.0975, 0.250);
        _showroomLookTarget.set(0.0, 0.0892, 0.220);
      }

      if (lastStageMode !== 'GARAGE') {
        camCurrentPos.copy(_showroomCamTarget);
        camCurrentLookAt.copy(_showroomLookTarget);
        lastStageMode = 'GARAGE';
      } else {
        const camLerp = 1.0 - Math.exp(-dt * 8.0);
        camCurrentPos.lerp(_showroomCamTarget, camLerp);
        camCurrentLookAt.lerp(_showroomLookTarget, camLerp);
      }
      camera.up.set(0, 1, 0);
      camera.position.copy(camCurrentPos);
      camera.lookAt(camCurrentLookAt);

      pitGarage.update(elapsedTime);
      if (atmosphere.applyMapAtmospherePreset) {
        atmosphere.applyMapAtmospherePreset(currentMapId, true, scene, renderer);
      }

      const activeShowroomDof = (settings.dofStrength ?? 0.0) > 0.01;
      bokehPass.enabled = activeShowroomDof;
      if (activeShowroomDof && bokehPass.uniforms) {
        camera.getWorldDirection(_dofCamDir);
        const showroomDepth = computeExactViewDepth(showroomGroup.position);
        currentFocusDistance = THREE.MathUtils.lerp(
          currentFocusDistance,
          Math.max(0.015, showroomDepth),
          0.25
        );
        bokehPass.uniforms['focus'].value = currentFocusDistance;
        bokehPass.uniforms['aperture'].value = 0.0035 * (settings.dofStrength ?? 0.0);
        bokehPass.uniforms['maxblur'].value = 0.0028;
      }
    } else if (isHomeOutdoorMode) {
      // HOME SCREEN BACKGROUND: Live Outdoor Real-World Circuit Start Grid of Selected Map
      scene.environmentIntensity = currentMapId === 'city' ? 0.72 : 0.88;
      showroomGroup.visible = false;
      pitGarage.rootGroup.visible = false;
      if (activeWorldMap) {
        activeWorldMap.rootGroup.visible = true;
        activeWorldMap.update(elapsedTime);
      }
      if (powerupManager && powerupManager.rootGroup) powerupManager.rootGroup.visible = true;
      if (rivalsController && rivalsController.rootGroup) rivalsController.rootGroup.visible = false;
      if (vfxManager) vfxManager.setVisible(false);

      if (showroomPreviewBounce > 0) {
        showroomPreviewBounce = Math.max(0.0, showroomPreviewBounce - dt * 4.5);
      }
      const bounceOffset = Math.sin(showroomPreviewBounce * Math.PI) * 0.0008;

      const stHome = physics.state;
      microKart.setCockpitRoadOnly(false);
      microKart.kartRoot.scale.setScalar(0.56);
      microKart.kartRoot.position.copy(stHome.position).addScaledVector(stHome.normal, bounceOffset);
      microKart.kartRoot.quaternion.copy(stHome.quaternion);
      microKart.chassisGroup.rotation.set(0, 0, 0);
      microKart.chassisGroup.position.y = Math.sin(elapsedTime * 2.2) * 0.00005;
      microKart.updateWheels(dt, 0.0, 0.0);
      if (microKart.sparkPoints) microKart.sparkPoints.visible = false;
      if (microKart.driftSmokeMesh) microKart.driftSmokeMesh.visible = false;

      orbitControls.enabled = false;
      const isPortraitScreen = camera.aspect < 0.95;
      const targetHomeFov = isPortraitScreen ? 48.0 : 44.0;
      if (Math.abs(camera.fov - targetHomeFov) > 0.2) {
        camera.fov = targetHomeFov;
        camera.updateProjectionMatrix();
      }

      const sway = Math.sin(elapsedTime * 0.32) * 0.0014;
      const lift = Math.cos(elapsedTime * 0.25) * 0.00035;
      const distAhead = isPortraitScreen ? 0.0145 : 0.0125;
      const sidePull = isPortraitScreen ? -0.0096 : -0.0085;
      _showroomCamTarget
        .copy(stHome.position)
        .addScaledVector(stHome.tangent, distAhead)
        .addScaledVector(stHome.right, sidePull + sway)
        .addScaledVector(stHome.normal, 0.0042 + lift);
      _showroomLookTarget
        .copy(stHome.position)
        .addScaledVector(stHome.tangent, -0.0035)
        .addScaledVector(stHome.right, 0.0005)
        .addScaledVector(stHome.normal, isPortraitScreen ? 0.0008 : 0.0014);

      if (lastStageMode !== 'HOME') {
        camCurrentPos.copy(_showroomCamTarget);
        camCurrentLookAt.copy(_showroomLookTarget);
        lastStageMode = 'HOME';
      } else {
        const camLerp = 1.0 - Math.exp(-dt * 6.0);
        camCurrentPos.lerp(_showroomCamTarget, camLerp);
        camCurrentLookAt.lerp(_showroomLookTarget, camLerp);
      }
      camera.up.set(0, 1, 0);
      camera.position.copy(camCurrentPos);
      camera.lookAt(camCurrentLookAt);

      if (atmosphere.applyMapAtmospherePreset) {
        atmosphere.applyMapAtmospherePreset(currentMapId, false, scene, renderer);
      }
      bokehPass.enabled = false;
    } else {
      lastStageMode = 'RACE';
      scene.environmentIntensity = currentMapId === 'city' ? 0.72 : 0.88;
      showroomGroup.visible = false;
      pitGarage.rootGroup.visible = false;
      if (activeWorldMap) {
        activeWorldMap.rootGroup.visible = true;
        activeWorldMap.update(elapsedTime);
      }
      if (powerupManager && powerupManager.rootGroup) powerupManager.rootGroup.visible = true;
      if (rivalsController && rivalsController.rootGroup) rivalsController.rootGroup.visible = true;
      if (vfxManager) vfxManager.setVisible(true);
      if (microKart.sparkPoints) {
        microKart.sparkPoints.visible = true;
      }
      if (microKart.driftSmokeMesh) {
        microKart.driftSmokeMesh.visible = false;
      }

      // Compute simulation timeScale (1.0 normally, easing smoothly to ~0.3x during Cinematic Victory Finish)
      let simTimeScale = 1.0;
      if (cinematicFinishState.active) {
        cinematicFinishState.elapsed += dt;
        const finishProgress = THREE.MathUtils.clamp(
          cinematicFinishState.elapsed / Math.max(0.1, cinematicFinishState.duration),
          0.0,
          1.0
        );
        const slowT = THREE.MathUtils.smoothstep(finishProgress, 0.0, 0.28);
        simTimeScale = THREE.MathUtils.lerp(1.0, 0.30, slowT);
        cinematicFinishState.timeScale = simTimeScale;
      }
      const simDt = dt * simTimeScale;

      // 0. Step Formula 1 5-Light Start Countdown if active
      stepF1StartCountdown(isScreenshotMode ? 0.0 : dt);

      // 1. Step 60FPS Banked Spline Physics
      const st = physics.stepPhysics(simDt);

      // 1B. Step 3 AI rivals and Track Boost Pads / Ramps
      const currentRank = rivalsController.update(simDt, st, powerupManager, audioSynth);
      powerupManager.update(simDt, st, rivalsController.rivals, audioSynth, currentRank);

      // Re-sync 3D world pose & quaternion after rival collisions and jump ramps
      if (physics.syncPoseFromSpline) {
        physics.syncPoseFromSpline();
      }

      // Drain collision impact queue -> spawn bright orange/yellow contact sparks & punchy micro shake
      if (st.pendingImpactCount > 0 && st.pendingImpacts) {
        for (let i = 0; i < st.pendingImpactCount; i++) {
          const imp = st.pendingImpacts[i];
          if (vfxManager) {
            vfxManager.spawnCollisionSparks(imp.pos, imp.normal, 26, imp.severity);
          }
          camShakeTimer = Math.max(camShakeTimer, 0.16);
          camShakeIntensity = Math.max(
            camShakeIntensity,
            THREE.MathUtils.clamp(imp.severity, 0.42, 1.0)
          );
        }
        st.pendingImpactCount = 0;
      }

      if ((st.cameraShake || 0) > 0) {
        camShakeTimer = Math.max(camShakeTimer, 0.16);
        camShakeIntensity = Math.max(
          camShakeIntensity,
          THREE.MathUtils.clamp(st.cameraShake, 0.35, 1.0)
        );
        st.cameraShake = 0.0;
      }

      // 2. Sync Micro-Kart Transform, Wheels, Exhaust Flames & Pooled Drift/Skid/Spark VFX
      if (cinematicFinishState.active) {
        st.boostActive = Math.max(st.boostActive || 0.0, 0.85);
      }
      microKart.kartRoot.position.copy(st.position);
      microKart.kartRoot.quaternion.copy(st.quaternion);
      microKart.updateWheels(simDt, st.speed, st.steerAngle);
      microKart.updateKartVisuals(simDt, st);
      if (vfxManager) {
        const vfxDt = currentAppScreen === 'GAMEOVER' ? dt : simDt;
        vfxManager.update(vfxDt, st, microKart.kartRoot, true);
      }

      // 3. Apply Active Real-World Map Outdoor Atmosphere & Sky/Fog Preset
      if (atmosphere.applyMapAtmospherePreset) {
        atmosphere.applyMapAtmospherePreset(currentMapId, false, scene, renderer);
      }

      // 4. Update Camera (always uses real `dt` so slow-motion hero sweep glides smoothly at 60 FPS)
      updateCamera(dt, elapsedTime, st);

      // Trigger Finish/Victory UI overlay once the 1.85s cinematic hero camera sweep completes
      if (
        cinematicFinishState.active &&
        cinematicFinishState.elapsed >= cinematicFinishState.duration
      ) {
        finalizeVictoryFinish();
      }

      // 4b. Dynamically Autofocus Depth of Field (BokehPass) only when enabled
      const urlDofParam = urlParams.get('dof');
      const dofScale =
        urlDofParam !== null ? parseFloat(urlDofParam) : (settings.dofStrength ?? 0.0);
      const isRoomCam = activeCameraMode === 5 || activeCameraMode === 7 || activeCameraMode === 8;
      const activeDofScale = dofScale > 0.01 && !isRoomCam ? dofScale : 0.0;
      bokehPass.enabled = activeDofScale > 0.01;

      if (bokehPass.enabled && bokehPass.uniforms) {
        camera.getWorldDirection(_dofCamDir);
        _dofKartPos.copy(st.position).addScaledVector(st.normal, 0.0030);
        const kartViewDepth = computeExactViewDepth(_dofKartPos);
        const safeKartDepth = THREE.MathUtils.clamp(
          kartViewDepth > camera.near + 0.002
            ? kartViewDepth
            : camera.position.distanceTo(_dofKartPos),
          0.003,
          2.2
        );
        const targetFocusDist = activeCameraMode === 2 ? 0.042 : safeKartDepth;
        currentFocusDistance = isScreenshotMode
          ? targetFocusDist
          : THREE.MathUtils.lerp(currentFocusDistance, targetFocusDist, 0.38);

        const is1PCam = activeCameraMode === 1 || activeCameraMode === 2;
        bokehPass.uniforms['focus'].value = currentFocusDistance;
        bokehPass.uniforms['aperture'].value = is1PCam
          ? 0.0032 * activeDofScale
          : 0.006 * activeDofScale;
        bokehPass.uniforms['maxblur'].value = is1PCam
          ? 0.0024 * Math.min(1.5, activeDofScale)
          : 0.0032 * activeDofScale;
      }

      // Update 3D spark uniforms when BokehPass is disabled
      if (!bokehPass.enabled && microKart && microKart.sparkPoints && microKart.sparkPoints.visible) {
        const sMat = microKart.sparkPoints.material;
        if (sMat && sMat.uniforms) {
          sMat.uniforms.uNearClip.value = camera.near;
          sMat.uniforms.uFarClip.value = camera.far;
          sMat.uniforms.uFocus.value = 0.12;
          sMat.uniforms.uAperture.value = 0.0;
          sMat.uniforms.uMaxBlur.value = 0.0;
          const drawSz = renderer.getDrawingBufferSize(_dofVec);
          sMat.uniforms.uResolution.value.set(drawSz.x, drawSz.y);
        }
      }

      // 5. Update WebAudio Synth & HUD (Strictly silence engine when not in RACE)
      if (currentAppScreen === 'RACE') {
        audioSynth.update(st);
      } else if (audioSynth.stopEngine) {
        audioSynth.stopEngine();
      }
      updateHUD(st);

      // Emit telemetry to React HUD at ~15Hz (every 65ms) or immediately when countdown/lap state changes
      if (telemetryListeners.size > 0) {
        const nowMs = performance.now();
        const countdownStep = f1CountdownState.active
          ? Math.max(1, 6 - (Math.floor(f1CountdownState.elapsed / f1CountdownState.stepDuration) + 1))
          : 0;
        const lapNow = Math.min(3, Math.max(1, st.lapCount || 1));

        if (
          nowMs - lastTelemetryEmitMs >= 65 ||
          countdownStep !== lastEmittedCountdownStep ||
          lapNow !== lastEmittedLap
        ) {
          lastTelemetryEmitMs = nowMs;
          lastEmittedCountdownStep = countdownStep;
          lastEmittedLap = lapNow;

          const absSpeed = Math.abs(st.speed);
          const speedKmh = Math.round(absSpeed * 240.0 * 3.6);

          const payload = {
            speedKmh,
            lapCount: lapNow,
            currentLapTime: st.currentLapTime || 0,
            totalRaceTime: st.totalRaceTime || 0,
            bestLapTime: st.bestLapTime,
            boostCharge: st.boostCharge ?? 1.0,
            boostActive: st.boostActive ?? 0.0,
            isDrifting: Boolean(st.isDrifting),
            driftCharge: st.driftChargeTimer || 0.0,
            countdownStep,
            cameraMode: activeCameraMode,
            autopilot: Boolean(st.autopilot),
            audioEnabled: audioSynth.isEnabled ? audioSynth.isEnabled() : false,
            positionRank: currentRank,
            rivals: rivalsController.getRivalsData(),
          };
          for (const cb of telemetryListeners) {
            cb(payload);
          }
        }
      }
    }

    if (isScreenshotMode) {
      if (window.__deskRacerFontsReady === undefined) {
        window.__deskRacerFontsReady = false;
        if (document.fonts && document.fonts.ready) {
          Promise
              .all([
                document.fonts.load('italic 900 48px "Orbitron"'),
                document.fonts.load('italic 900 84px "Orbitron"'),
                document.fonts.load('44px "Press Start 2P"'),
                document.fonts.load('38px "Press Start 2P"'),
                document.fonts.ready,
              ])
              .then(() => {
                window.__deskRacerFontsReady = true;
              })
              .catch(() => {
                window.__deskRacerFontsReady = true;
              });
        } else {
          window.__deskRacerFontsReady = true;
        }
      }
      const allFourGlbsLoaded =
        loadedGlbStatus.desk &&
        loadedGlbStatus.track &&
        loadedGlbStatus.kart &&
        loadedGlbStatus.room;
      const elapsedMs = performance.now() - appInitTimestamp;

      if ((!allFourGlbsLoaded && elapsedMs < 15000) ||
          (!window.__deskRacerFontsReady && elapsedMs < 3500)) {
        requestAnimationFrame(animate);
        return;
      }

      renderer.info.autoReset = false;
      renderer.info.reset();
      composer.render();
      window.__deskRacerStats = {
        calls: renderer.info.render.calls,
        triangles: renderer.info.render.triangles,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
      };
      screenshotFrameCounter++;
      if (screenshotFrameCounter >= 2 || elapsedMs >= 20000) {
        document.body.id = 'screenshot-ready';
        return;
      }
      requestAnimationFrame(animate);
      return;
    }

    // 6. Fast Single-Pass Direct WebGL Rendering for 60 FPS Mobile Performance
    // (Falls back to EffectComposer only if user explicitly enabled high DOF or Bloom in Settings)
    renderer.info.autoReset = false;
    renderer.info.reset();
    const usePostComposer = bokehPass.enabled || (settings.bloomStrength ?? 0) > 0.12;
    if (usePostComposer) {
      composer.render();
    } else {
      renderer.setRenderTarget(null);
      renderer.autoClear = true;
      renderer.render(scene, camera);
      if (!isGarageMode && !isHomeOutdoorMode && microKart && microKart.sparkPoints && microKart.sparkPoints.visible) {
        const prevAutoClear = renderer.autoClear;
        renderer.autoClear = false;
        renderer.render(sparkScene, camera);
        renderer.autoClear = prevAutoClear;
      }
    }
    window.__deskRacerStats = {
      calls: renderer.info.render.calls,
      triangles: renderer.info.render.triangles,
      geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures,
    };

    requestAnimationFrame(animate);
  }

  animate();
}

initApp().catch((err) => {
  console.error('Failed to initialize The Race: Car Driving 3D:', err);
});
