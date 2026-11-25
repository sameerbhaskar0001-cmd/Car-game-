import * as THREE from 'three';

export const WEATHER_MODES = ['clear', 'dust', 'mist', 'drizzle'];

export function normalizeWeatherMode(id) {
  if (WEATHER_MODES.includes(id)) return id;
  return 'dust';
}

export function getNextWeatherMode(current) {
  const idx = WEATHER_MODES.indexOf(normalizeWeatherMode(current));
  return WEATHER_MODES[(idx + 1) % WEATHER_MODES.length];
}

/**
 * Lighting & atmospheric modifiers applied smoothly on top of each circuit's base preset.
 * Tuned so every mode preserves crisp track readability while transforming lighting mood.
 */
export const WEATHER_LIGHTING_PRESETS = {
  clear: {
    sunTint: 0xffffff,
    sunTintMix: 0.0,
    sunIntensityMult: 1.0,
    hemiSkyTint: 0xffffff,
    hemiSkyMix: 0.0,
    hemiGroundTint: 0xffffff,
    hemiGroundMix: 0.0,
    hemiIntensityMult: 1.0,
    fillTint: 0xffffff,
    fillMix: 0.0,
    fillIntensityMult: 1.0,
    rimTint: 0xffffff,
    rimMix: 0.0,
    rimIntensityMult: 1.0,
    bgTint: 0xffffff,
    bgMix: 0.0,
    fogTint: 0xffffff,
    fogMix: 0.0,
    fogDensityMult: 0.88,
    fogDensityAdd: 0.0,
    envIntensityMult: 1.02,
    exposureOffset: 0.02,
    dustWeight: 0.0,
    mistWeight: 0.0,
    drizzleWeight: 0.0,
  },
  dust: {
    // Warm sunlit golden-amber atmosphere with subtle suspended dust haze
    sunTint: 0xffb85c,
    sunTintMix: 0.42,
    sunIntensityMult: 1.14,
    hemiSkyTint: 0xfde68a,
    hemiSkyMix: 0.28,
    hemiGroundTint: 0xb45309,
    hemiGroundMix: 0.35,
    hemiIntensityMult: 0.96,
    fillTint: 0xfdba74,
    fillMix: 0.48,
    fillIntensityMult: 1.15,
    rimTint: 0xfef08a,
    rimMix: 0.45,
    rimIntensityMult: 1.22,
    bgTint: 0xd99b5e,
    bgMix: 0.32,
    fogTint: 0xd49a62,
    fogMix: 0.42,
    fogDensityMult: 1.12,
    fogDensityAdd: 0.018,
    envIntensityMult: 1.04,
    exposureOffset: 0.04,
    dustWeight: 1.0,
    mistWeight: 0.0,
    drizzleWeight: 0.0,
  },
  mist: {
    // Cool diffused morning mist: softened direct sun, lifted sky ambient, atmospheric horizon fog
    sunTint: 0xdbeafe,
    sunTintMix: 0.52,
    sunIntensityMult: 0.64,
    hemiSkyTint: 0xcbd5e1,
    hemiSkyMix: 0.56,
    hemiGroundTint: 0x475569,
    hemiGroundMix: 0.45,
    hemiIntensityMult: 1.18,
    fillTint: 0xbae6fd,
    fillMix: 0.52,
    fillIntensityMult: 0.88,
    rimTint: 0xe2e8f0,
    rimMix: 0.55,
    rimIntensityMult: 0.78,
    bgTint: 0x94a9bd,
    bgMix: 0.55,
    fogTint: 0x9fb4c7,
    fogMix: 0.62,
    fogDensityMult: 1.65,
    fogDensityAdd: 0.085,
    envIntensityMult: 0.84,
    exposureOffset: -0.02,
    dustWeight: 0.0,
    mistWeight: 1.0,
    drizzleWeight: 0.0,
  },
  drizzle: {
    // Moody storm overcast with crisp cyan rim highlights and fast slanted rain
    sunTint: 0x7db3f8,
    sunTintMix: 0.72,
    sunIntensityMult: 0.44,
    hemiSkyTint: 0x475569,
    hemiSkyMix: 0.72,
    hemiGroundTint: 0x0f172a,
    hemiGroundMix: 0.74,
    hemiIntensityMult: 0.86,
    fillTint: 0x38bdf8,
    fillMix: 0.62,
    fillIntensityMult: 0.96,
    rimTint: 0x7dd3fc,
    rimMix: 0.70,
    rimIntensityMult: 1.38,
    bgTint: 0x162236,
    bgMix: 0.76,
    fogTint: 0x22334c,
    fogMix: 0.74,
    fogDensityMult: 1.58,
    fogDensityAdd: 0.082,
    envIntensityMult: 0.68,
    exposureOffset: -0.08,
    dustWeight: 0.0,
    mistWeight: 0.36,
    drizzleWeight: 1.0,
  },
};

/**
 * Subtle GPU-wrapped weather particle system calibrated specifically for the
 * miniature desk-coaster track scale (car ~0.01m, chase cam ~0.012m).
 *
 * Uses zero per-frame JS allocations and wraps particle volumes seamlessly around
 * the active car/camera focus point inside vertex shaders.
 */
export function buildWeatherSystem(scene) {
  const weatherGroup = new THREE.Group();
  weatherGroup.name = 'WeatherParticlesGroup';

  let currentWeather = 'dust';
  let dustAlpha = 1.0;
  let mistAlpha = 0.0;
  let drizzleAlpha = 0.0;
  let globalVisible = true;

  // ---------------------------------------------------------------------------
  // 1. GOLDEN DUST MOTES (320 subtle sunlit bokeh particles swirling over track)
  // ---------------------------------------------------------------------------
  const dustCount = 320;
  const dustOffsets = new Float32Array(dustCount * 3);
  const dustPhases = new Float32Array(dustCount);
  const dustScales = new Float32Array(dustCount);

  for (let i = 0; i < dustCount; i++) {
    dustOffsets[i * 3 + 0] = Math.random();
    dustOffsets[i * 3 + 1] = Math.random();
    dustOffsets[i * 3 + 2] = Math.random();
    dustPhases[i] = Math.random() * Math.PI * 2.0;
    dustScales[i] = 0.55 + Math.random() * 1.15;
  }

  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustOffsets, 3));
  dustGeo.setAttribute('aPhase', new THREE.BufferAttribute(dustPhases, 1));
  dustGeo.setAttribute('aScale', new THREE.BufferAttribute(dustScales, 1));

  const dustUniforms = {
    uTime: { value: 0.0 },
    uAnchor: { value: new THREE.Vector3(0, 0.04, 0) },
    uBoxSize: { value: new THREE.Vector3(0.14, 0.052, 0.14) },
    uOpacity: { value: 0.0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2.0) },
    uColorWarm: { value: new THREE.Color(0xffdfa0) },
    uColorGold: { value: new THREE.Color(0xf59e0b) },
  };

  const dustMat = new THREE.ShaderMaterial({
    uniforms: dustUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aScale;
      uniform float uTime;
      uniform vec3 uAnchor;
      uniform vec3 uBoxSize;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vTint;

      void main() {
        // Gentle sunlit thermal drift in normalized box space
        vec3 base = position * uBoxSize;
        vec3 drift = vec3(
          uTime * 0.0045 + sin(uTime * 0.55 + aPhase) * 0.0045,
          sin(uTime * 0.42 + aPhase * 1.7) * 0.0032 + uTime * 0.0012,
          uTime * 0.0032 + cos(uTime * 0.48 + aPhase * 0.9) * 0.0045
        );

        vec3 anchorOrigin = uAnchor + vec3(0.0, uBoxSize.y * 0.28, 0.0);
        vec3 localPos = mod(base + drift - anchorOrigin, uBoxSize) - (uBoxSize * 0.5);
        vec3 worldPos = anchorOrigin + localPos;

        // Soft edge fade near volume boundaries so particles never pop
        vec3 edgeDist = 1.0 - abs(localPos) / (uBoxSize * 0.5);
        float boxFade = smoothstep(0.0, 0.26, min(edgeDist.x, min(edgeDist.y, edgeDist.z)));

        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        float viewDist = max(0.001, -mvPosition.z);

        // Near-lens fade keeps camera clear, far fade blends smoothly into horizon
        float nearFade = smoothstep(0.0045, 0.012, viewDist);
        float farFade = smoothstep(0.095, 0.032, viewDist);
        float twinkle = 0.58 + 0.42 * sin(uTime * 1.9 + aPhase * 3.1);

        vAlpha = boxFade * nearFade * farFade * twinkle;
        vTint = 0.5 + 0.5 * sin(aPhase * 2.3);

        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp((0.155 * aScale * uPixelRatio) / max(0.012, viewDist), 1.5, 7.5 * uPixelRatio);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uColorWarm;
      uniform vec3 uColorGold;
      varying float vAlpha;
      varying float vTint;

      void main() {
        vec2 uv = gl_PointCoord - vec2(0.5);
        float d = length(uv);
        if (d > 0.5) discard;

        float core = smoothstep(0.5, 0.05, d);
        float softDisc = core * core;
        vec3 col = mix(uColorGold, uColorWarm, clamp(vTint * 0.65 + core * 0.35, 0.0, 1.0));
        float alpha = softDisc * vAlpha * uOpacity * 0.46;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(col, alpha);
      }
    `,
  });

  const dustPoints = new THREE.Points(dustGeo, dustMat);
  dustPoints.name = 'CoasterWeatherDust';
  dustPoints.frustumCulled = false;
  dustPoints.renderOrder = 14;
  weatherGroup.add(dustPoints);

  // ---------------------------------------------------------------------------
  // 2. LIGHT MIST WISPS (150 ultra-soft low-lying drifting fog puffs over track)
  // ---------------------------------------------------------------------------
  const mistCount = 150;
  const mistOffsets = new Float32Array(mistCount * 3);
  const mistPhases = new Float32Array(mistCount);
  const mistScales = new Float32Array(mistCount);

  for (let i = 0; i < mistCount; i++) {
    mistOffsets[i * 3 + 0] = Math.random();
    mistOffsets[i * 3 + 1] = Math.random();
    mistOffsets[i * 3 + 2] = Math.random();
    mistPhases[i] = Math.random() * Math.PI * 2.0;
    mistScales[i] = 0.75 + Math.random() * 1.15;
  }

  const mistGeo = new THREE.BufferGeometry();
  mistGeo.setAttribute('position', new THREE.BufferAttribute(mistOffsets, 3));
  mistGeo.setAttribute('aPhase', new THREE.BufferAttribute(mistPhases, 1));
  mistGeo.setAttribute('aScale', new THREE.BufferAttribute(mistScales, 1));

  const mistUniforms = {
    uTime: { value: 0.0 },
    uAnchor: { value: new THREE.Vector3(0, 0.04, 0) },
    uBoxSize: { value: new THREE.Vector3(0.22, 0.038, 0.22) },
    uOpacity: { value: 0.0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2.0) },
    uMistColor: { value: new THREE.Color(0xdce8f5) },
  };

  const mistMat = new THREE.ShaderMaterial({
    uniforms: mistUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aScale;
      uniform float uTime;
      uniform vec3 uAnchor;
      uniform vec3 uBoxSize;
      uniform float uPixelRatio;
      varying float vAlpha;
      varying float vPhase;

      void main() {
        vec3 base = position * uBoxSize;
        // Slow prevailing cross-breeze hugging the coaster track surface
        vec3 drift = vec3(
          uTime * 0.0085 + sin(uTime * 0.25 + aPhase) * 0.004,
          sin(uTime * 0.30 + aPhase * 1.4) * 0.0018,
          uTime * 0.0055 + cos(uTime * 0.22 + aPhase) * 0.004
        );

        vec3 anchorOrigin = uAnchor + vec3(0.0, uBoxSize.y * 0.22, 0.0);
        vec3 localPos = mod(base + drift - anchorOrigin, uBoxSize) - (uBoxSize * 0.5);
        vec3 worldPos = anchorOrigin + localPos;

        vec3 edgeDist = 1.0 - abs(localPos) / (uBoxSize * 0.5);
        float boxFade = smoothstep(0.0, 0.34, min(edgeDist.x, min(edgeDist.y, edgeDist.z)));

        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        float viewDist = max(0.001, -mvPosition.z);

        // Keep immediate foreground crystal clear so racing line stays sharp
        float nearFade = smoothstep(0.012, 0.028, viewDist);
        float farFade = smoothstep(0.145, 0.045, viewDist);

        vAlpha = boxFade * nearFade * farFade;
        vPhase = aPhase;

        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp((1.05 * aScale * uPixelRatio) / max(0.018, viewDist), 10.0, 48.0 * uPixelRatio);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uMistColor;
      varying float vAlpha;
      varying float vPhase;

      void main() {
        // Organic billowy wisp silhouette from dual shifted radial lobes
        vec2 uv = gl_PointCoord - vec2(0.5);
        float c = cos(vPhase);
        float s = sin(vPhase);
        vec2 rotUv = vec2(uv.x * c - uv.y * s, uv.x * s + uv.y * c);
        rotUv.y *= 1.35;

        float d1 = length(rotUv - vec2(0.06, 0.02));
        float d2 = length(rotUv + vec2(0.07, -0.03));
        float wisp = max(smoothstep(0.46, 0.04, d1), smoothstep(0.42, 0.06, d2) * 0.85);
        float soft = pow(wisp, 1.85);

        float alpha = soft * vAlpha * uOpacity * 0.145;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(uMistColor, alpha);
      }
    `,
  });

  const mistPoints = new THREE.Points(mistGeo, mistMat);
  mistPoints.name = 'CoasterWeatherMist';
  mistPoints.frustumCulled = false;
  mistPoints.renderOrder = 13;
  weatherGroup.add(mistPoints);

  // ---------------------------------------------------------------------------
  // 3. WIND-SLANTED FAST RAIN STREAKS (560 dynamic slanted streaks around camera/car)
  // ---------------------------------------------------------------------------
  const drizzleCount = 560;
  const drizzleOffsets = new Float32Array(drizzleCount * 3);
  const drizzlePhases = new Float32Array(drizzleCount);
  const drizzleScales = new Float32Array(drizzleCount);

  for (let i = 0; i < drizzleCount; i++) {
    drizzleOffsets[i * 3 + 0] = Math.random();
    drizzleOffsets[i * 3 + 1] = Math.random();
    drizzleOffsets[i * 3 + 2] = Math.random();
    drizzlePhases[i] = Math.random() * Math.PI * 2.0;
    drizzleScales[i] = 0.8 + Math.random() * 1.1;
  }

  const drizzleGeo = new THREE.BufferGeometry();
  drizzleGeo.setAttribute('position', new THREE.BufferAttribute(drizzleOffsets, 3));
  drizzleGeo.setAttribute('aPhase', new THREE.BufferAttribute(drizzlePhases, 1));
  drizzleGeo.setAttribute('aScale', new THREE.BufferAttribute(drizzleScales, 1));

  const drizzleUniforms = {
    uTime: { value: 0.0 },
    uAnchor: { value: new THREE.Vector3(0, 0.04, 0) },
    uBoxSize: { value: new THREE.Vector3(0.115, 0.068, 0.115) },
    uOpacity: { value: 0.0 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2.0) },
    uDropColor: { value: new THREE.Color(0xcbe8ff) },
  };

  const drizzleMat = new THREE.ShaderMaterial({
    uniforms: drizzleUniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */ `
      attribute float aPhase;
      attribute float aScale;
      uniform float uTime;
      uniform vec3 uAnchor;
      uniform vec3 uBoxSize;
      uniform float uPixelRatio;
      varying float vAlpha;

      void main() {
        vec3 base = position * uBoxSize;
        float speedScale = 0.88 + 0.36 * fract(aPhase * 1.73);
        // Fast wind-driven rain velocity slanted across the windshield/chase view
        vec3 fall = vec3(
          uTime * 0.072 * speedScale,
          -uTime * 0.255 * speedScale,
          uTime * 0.036 * speedScale
        );

        vec3 anchorOrigin = uAnchor + vec3(0.0, uBoxSize.y * 0.28, 0.0);
        vec3 localPos = mod(base + fall - anchorOrigin, uBoxSize) - (uBoxSize * 0.5);
        vec3 worldPos = anchorOrigin + localPos;

        vec3 edgeDist = 1.0 - abs(localPos) / (uBoxSize * 0.5);
        float boxFade = smoothstep(0.0, 0.20, min(edgeDist.x, min(edgeDist.y, edgeDist.z)));

        vec4 mvPosition = modelViewMatrix * vec4(worldPos, 1.0);
        float viewDist = max(0.001, -mvPosition.z);

        float nearFade = smoothstep(0.004, 0.011, viewDist);
        float farFade = smoothstep(0.095, 0.028, viewDist);
        vAlpha = boxFade * nearFade * farFade;

        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp((0.36 * aScale * uPixelRatio) / max(0.012, viewDist), 4.5, 22.0 * uPixelRatio);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uOpacity;
      uniform vec3 uDropColor;
      varying float vAlpha;

      void main() {
        // Crisp wind-slanted (~19 deg) thin rain streak
        vec2 uv = gl_PointCoord - vec2(0.5);
        vec2 r = vec2(uv.x * 0.945 + uv.y * 0.326, -uv.x * 0.326 + uv.y * 0.945);
        float streakX = smoothstep(0.075, 0.0, abs(r.x));
        float streakY = smoothstep(0.49, 0.04, abs(r.y));
        float alpha = streakX * streakY * vAlpha * uOpacity * 0.52;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(uDropColor, alpha);
      }
    `,
  });

  const drizzlePoints = new THREE.Points(drizzleGeo, drizzleMat);
  drizzlePoints.name = 'CoasterWeatherDrizzle';
  drizzlePoints.frustumCulled = false;
  drizzlePoints.renderOrder = 15;
  weatherGroup.add(drizzlePoints);

  scene.add(weatherGroup);

  function setWeather(mode) {
    currentWeather = normalizeWeatherMode(mode);
    return currentWeather;
  }

  function getWeather() {
    return currentWeather;
  }

  function setVisible(visible) {
    globalVisible = Boolean(visible);
    weatherGroup.visible = globalVisible;
  }

  function update(dt, elapsedTime, anchorPos, mapId = 'coast', renderer = null) {
    if (!globalVisible) {
      weatherGroup.visible = false;
      return;
    }

    const preset = WEATHER_LIGHTING_PRESETS[currentWeather] || WEATHER_LIGHTING_PRESETS.clear;
    const dampT = dt > 0 ? 1.0 - Math.exp(-Math.min(dt, 0.1) * 5.2) : 1.0;

    dustAlpha = THREE.MathUtils.lerp(dustAlpha, preset.dustWeight, dampT);
    mistAlpha = THREE.MathUtils.lerp(mistAlpha, preset.mistWeight, dampT);
    drizzleAlpha = THREE.MathUtils.lerp(drizzleAlpha, preset.drizzleWeight, dampT);

    const anyActive = dustAlpha > 0.004 || mistAlpha > 0.004 || drizzleAlpha > 0.004;
    weatherGroup.visible = anyActive;
    if (!anyActive) return;

    const dpr = renderer ? renderer.getPixelRatio() : Math.min(window.devicePixelRatio || 1, 2.0);

    // Subtle map-harmonized particle tinting so particles feel native to Coast, City, and Canyon
    if (dustAlpha > 0.004) {
      dustPoints.visible = true;
      dustUniforms.uTime.value = elapsedTime;
      dustUniforms.uOpacity.value = dustAlpha;
      dustUniforms.uPixelRatio.value = dpr;
      if (anchorPos) dustUniforms.uAnchor.value.copy(anchorPos);
      if (mapId === 'city') {
        dustUniforms.uColorWarm.value.setHex(0xfde68a);
        dustUniforms.uColorGold.value.setHex(0xfb923c);
      } else if (mapId === 'canyon') {
        dustUniforms.uColorWarm.value.setHex(0xfffbeb);
        dustUniforms.uColorGold.value.setHex(0xfcd34d);
      } else {
        dustUniforms.uColorWarm.value.setHex(0xffdfa0);
        dustUniforms.uColorGold.value.setHex(0xf59e0b);
      }
    } else {
      dustPoints.visible = false;
    }

    if (mistAlpha > 0.004) {
      mistPoints.visible = true;
      mistUniforms.uTime.value = elapsedTime;
      mistUniforms.uOpacity.value = mistAlpha;
      mistUniforms.uPixelRatio.value = dpr;
      if (anchorPos) mistUniforms.uAnchor.value.copy(anchorPos);
      if (mapId === 'city') {
        mistUniforms.uMistColor.value.setHex(0x94b8d8);
      } else if (mapId === 'canyon') {
        mistUniforms.uMistColor.value.setHex(0xeaf4fc);
      } else {
        mistUniforms.uMistColor.value.setHex(0xdce8f2);
      }
    } else {
      mistPoints.visible = false;
    }

    if (drizzleAlpha > 0.004) {
      drizzlePoints.visible = true;
      drizzleUniforms.uTime.value = elapsedTime;
      drizzleUniforms.uOpacity.value = drizzleAlpha;
      drizzleUniforms.uPixelRatio.value = dpr;
      if (anchorPos) drizzleUniforms.uAnchor.value.copy(anchorPos);
      if (mapId === 'city') {
        drizzleUniforms.uDropColor.value.setHex(0x7dd3fc);
      } else {
        drizzleUniforms.uDropColor.value.setHex(0xcbe8ff);
      }
    } else {
      drizzlePoints.visible = false;
    }
  }

  function dispose() {
    dustGeo.dispose();
    dustMat.dispose();
    mistGeo.dispose();
    mistMat.dispose();
    drizzleGeo.dispose();
    drizzleMat.dispose();
    if (weatherGroup.parent) {
      weatherGroup.parent.remove(weatherGroup);
    }
  }

  return {
    weatherGroup,
    dustPoints,
    mistPoints,
    drizzlePoints,
    setWeather,
    getWeather,
    getRainWeight: () => drizzleAlpha,
    setVisible,
    update,
    dispose,
  };
}
