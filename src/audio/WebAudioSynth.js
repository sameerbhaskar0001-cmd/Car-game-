/**
 * The Race: Car Driving 3D — Real MP3 AudioManager & WebAudio Engine
 * Drop-in upgrade for `src/audio/WebAudioSynth.js`
 *
 * Wires all 13 real MP3 sound effects, voice announcer lines, engine/drift loops,
 * rain ambience, and high-energy arcade BGM with:
 * - Zero harsh synthetic engine buzzers or placeholder drones
 * - Mobile WebView autoplay safety (fetch preloading + lazy decode after first tap)
 * - Streaming HTML5 Audio loops for long BGM & Rain tracks (low RAM on mobile)
 * - Pooled Web Audio decoded buffers for gapless engine/drift pitch modulation & SFX
 * - Cooldown timers to prevent overlapping audio spam
 * - Dedicated voice announcer channel with smooth BGM ducking
 * - Full 100% synchronization with the HUD Mute toggle (🔊 / 🔇)
 */

import { getCarAudioProfile } from './CarAudioProfiles.js';

const MP3_FILES = {
  bgm: '/audio/alex-morgan-car-car-music-545487.mp3',
  rain: '/audio/liecio-calming-rain-257596.mp3',
  engineRoar: '/audio/dragon-studio-car-engine-roaring-376881.mp3',
  engineThrottle: '/audio/tanweraman-car-throttle-static-337873.mp3',
  drift1: '/audio/poorartistt-car-drift-sound-effect-type-2-406999.mp3',
  drift2: '/audio/olenchic--110063.mp3',
  pass1: '/audio/moeeza3-fast-car-passing-sound-395038.mp3',
  pass2: '/audio/spinopel-passing-car-393073.mp3',
  crash: '/audio/dragon-studio-car-crash-sound-effect-376874.mp3',
  victory: '/audio/ribhavagrawal-victorymale-version-230553.mp3',
  gameOver: '/audio/universfield-game-over-deep-male-voice-clip-352695.mp3',
  evilLaugh: '/audio/phatphrogstudio-oni-demon-voice-demonic-laughter-477923.mp3',
  nothingToWorry:
    '/audio/freesound_community-075869_39there-is-nothing-to-worry-about39-robotic-voice-hd-80248.mp3',
};

const BONUS_WAV_FILES = {
  curb: 'curb_rumble_loop.wav',
  sputter: [
    'engine_sputter_burst_1.wav',
    'engine_sputter_burst_2.wav',
    'engine_sputter_burst_3.wav',
  ],
};

function computeCrispRegimeWeights(f0) {
  let wIdle = 0.0;
  let wCruise = 0.0;
  let wFlatout = 0.0;
  let wBoost = 0.0;

  if (f0 <= 86.0) {
    wIdle = 1.0;
  } else if (f0 < 108.0) {
    const u = (f0 - 86.0) / (108.0 - 86.0);
    wIdle = Math.cos(0.5 * Math.PI * u);
    wCruise = Math.sin(0.5 * Math.PI * u);
  } else if (f0 <= 146.0) {
    wCruise = 1.0;
  } else if (f0 < 178.0) {
    const u = (f0 - 146.0) / (178.0 - 146.0);
    wCruise = Math.cos(0.5 * Math.PI * u);
    wFlatout = Math.sin(0.5 * Math.PI * u);
  } else if (f0 <= 222.0) {
    wFlatout = 1.0;
  } else if (f0 < 252.0) {
    const u = (f0 - 222.0) / (252.0 - 222.0);
    wFlatout = Math.cos(0.5 * Math.PI * u);
    wBoost = Math.sin(0.5 * Math.PI * u);
  } else {
    wBoost = 1.0;
  }
  return { wIdle, wCruise, wFlatout, wBoost };
}

/**
 * Creates the Real-MP3 WebAudio + HTML5 AudioManager for The Race: Car Driving 3D.
 * @param {!Object=} options
 * @return {!Object}
 */
export function createDeskRacerHybridAudio(options = {}) {
  const wavBaseUrl = (options.baseUrl || '/assets/audio').replace(/\/$/, '');
  const masterVolume = options.masterVolume ?? 0.62;
  const cacheBust = options.cacheBust || 'v=12';

  let ctx = null;
  let enabled = false;
  let userMuted = false;
  let stemsLoaded = false;
  let loadingPromise = null;
  let preloadPromise = null;

  // Master & Bus Nodes
  let masterGain = null;
  let sfxBus = null;
  let voiceBus = null;
  let engineBus = null;
  let misfireDuckGain = null;
  let lowShelfFilter = null;
  let engineBusFilter = null;
  let driftFilterBus = null;
  let turnPanner = null;

  // Decoded AudioBuffer Pool (11 real MP3s + optional curb/sputter WAVs)
  const decodedBuffers = {};
  const rawArrayBuffers = new Map();
  const oneShotSputters = [];

  // Active Looping WebAudio Nodes
  const loopNodes = {
    engineThrottle: null,
    drift1: null,
    drift2: null,
    turnTire: null,
    curb: null,
  };

  // Streamed HTML5 Audio Loops (low mobile RAM footprint for long BGM & 3.4MB Rain track)
  let bgmAudio = null;
  let rainAudio = null;
  let bgmCurrentVol = 0.0;
  let bgmTargetVol = 0.0;
  let rainCurrentVol = 0.0;
  let rainTargetVol = 0.0;
  let bgmDuckUntilMs = 0;
  let bgmDuckFactor = 1.0;
  let activeScreen = 'SPLASH';
  let streamTickInterval = null;

  // Active non-overlapping voice announcer channel
  let activeVoiceSource = null;

  // Car profile & dynamic telemetry state
  let currentCarId = 'coupe';
  let carProfile = getCarAudioProfile('coupe');
  let userRumbleAmount = options.rumbleAmount ?? 1.0;
  let userSputterAmount = options.sputterAmount ?? 1.0;

  let smoothNormSpeed = 0.0;
  let smoothAccelRate = 0.0;
  let smoothBoostBlend = 0.0;
  let smoothHillLoad = 0.0;
  let prevSpeed = 0.0;
  let prevTimeMs = performance.now();
  let lastGearIndex = 1;
  let gearShiftDipTimer = 0.0;
  let wasDrifting = false;
  let driftLeadIndex = 0;
  let passAltIndex = 0;
  let nextSputterTime = 0;
  let sputterCount = 0;

  // Cooldown timestamps (prevent overlapping audio spam)
  let lastRailImpactMs = 0;
  let lastUiClickMs = 0;
  let lastRevPreviewMs = 0;
  let lastGridRoarMs = 0;
  let lastFlybyMs = 0;
  let lastNitroMs = 0;
  let lastEvilLaughMs = 0;
  let lastUnlockStuntVoiceMs = 0;
  let lastVictoryVoiceMs = 0;
  let lastGameOverVoiceMs = 0;
  let lastRocketLaunchMs = 0;
  let lastRouletteTickMs = 0;
  let lastWarningBeepMs = 0;
  let lastExplosionMs = 0;

  let lastDiag = {};

  function withCacheBust(url) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}${cacheBust}`;
  }

  function fetchRawArrayBuffer(url) {
    const fullUrl = withCacheBust(url);
    if (!rawArrayBuffers.has(fullUrl)) {
      const p = fetch(fullUrl).then((resp) => {
        if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`);
        return resp.arrayBuffer();
      });
      rawArrayBuffers.set(fullUrl, p);
    }
    return rawArrayBuffers.get(fullUrl);
  }

  async function decodeUrl(url) {
    if (!ctx) return null;
    try {
      const arr = await fetchRawArrayBuffer(url);
      // Clone ArrayBuffer because decodeAudioData detaches the transferred buffer
      return await ctx.decodeAudioData(arr.slice(0));
    } catch (err) {
      console.warn(`[AudioManager] Failed to decode ${url}:`, err);
      return null;
    }
  }

  /**
   * Pre-fetches the 11 dynamic MP3 buffers into memory without triggering
   * AudioContext creation before the user's first tap (mobile WebView safe).
   */
  function preload() {
    if (preloadPromise) return preloadPromise;
    preloadPromise = (async () => {
      const urlsToFetch = [
        MP3_FILES.engineThrottle,
        MP3_FILES.engineRoar,
        MP3_FILES.drift1,
        MP3_FILES.drift2,
        MP3_FILES.pass1,
        MP3_FILES.pass2,
        MP3_FILES.crash,
        MP3_FILES.victory,
        MP3_FILES.gameOver,
        MP3_FILES.evilLaugh,
        MP3_FILES.nothingToWorry,
        `${wavBaseUrl}/${BONUS_WAV_FILES.curb}`,
      ];
      await Promise.all(
        urlsToFetch.map((url) =>
          fetchRawArrayBuffer(url).catch(() => null)
        )
      );
    })();
    return preloadPromise;
  }

  function createStreamedLoop(url) {
    try {
      const el = new Audio(withCacheBust(url));
      el.loop = true;
      el.preload = 'auto';
      el.volume = 0.0;
      el.muted = false;
      el.playsInline = true;
      return el;
    } catch (_err) {
      return null;
    }
  }

  function getScreenBgmTarget() {
    if (!enabled || userMuted) return 0.0;
    if (activeScreen === 'RACE') return 0.30;
    if (
      activeScreen === 'MENU' ||
      activeScreen === 'EVENTS' ||
      activeScreen === 'GARAGE' ||
      activeScreen === 'MISSIONS' ||
      activeScreen === 'GAMEOVER'
    ) {
      return 0.13;
    }
    return 0.0;
  }

  function duckBgm(durationMs = 1600, factor = 0.32) {
    const until = performance.now() + durationMs;
    if (until > bgmDuckUntilMs) {
      bgmDuckUntilMs = until;
    }
    bgmDuckFactor = Math.min(bgmDuckFactor, factor);
  }

  function syncStreamElement(audioEl, currentVol, targetVol, fadeAlpha) {
    if (!audioEl) return 0.0;
    const nextVol = currentVol + (targetVol - currentVol) * fadeAlpha;
    const clamped = Math.max(0.0, Math.min(1.0, nextVol));

    if (!enabled || userMuted) {
      audioEl.volume = 0.0;
      audioEl.muted = true;
      if (!audioEl.paused) {
        try {
          audioEl.pause();
        } catch (_e) {
          // ignore
        }
      }
      return 0.0;
    }

    audioEl.muted = false;
    if (targetVol > 0.004) {
      audioEl.volume = clamped;
      if (audioEl.paused) {
        const playPromise = audioEl.play();
        if (playPromise && typeof playPromise.catch === 'function') {
          playPromise.catch(() => {
            // Will auto-retry on next user tap / tick
          });
        }
      }
      return clamped;
    } else if (clamped < 0.005) {
      audioEl.volume = 0.0;
      if (!audioEl.paused) {
        try {
          audioEl.pause();
        } catch (_e) {
          // ignore
        }
      }
      return 0.0;
    } else {
      audioEl.volume = clamped;
      return clamped;
    }
  }

  function tickAmbientStreams(dtSec = 0.05) {
    const nowMs = performance.now();
    if (nowMs >= bgmDuckUntilMs) {
      bgmDuckFactor = 1.0;
    }
    const baseBgm = getScreenBgmTarget();
    bgmTargetVol = baseBgm * bgmDuckFactor;

    const fadeAlpha = 1.0 - Math.exp(-5.5 * Math.max(0.01, dtSec));
    bgmCurrentVol = syncStreamElement(bgmAudio, bgmCurrentVol, bgmTargetVol, fadeAlpha);
    rainCurrentVol = syncStreamElement(
      rainAudio,
      rainCurrentVol,
      enabled && !userMuted ? rainTargetVol : 0.0,
      fadeAlpha
    );
  }

  function startLoopNode(key, buffer, destination) {
    if (!ctx || !buffer || !destination) return null;
    if (loopNodes[key]) {
      try {
        loopNodes[key].src.stop();
      } catch (_e) {
        // ignore
      }
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;

    src.connect(gain);
    gain.connect(destination);
    src.start(0);

    const handle = { src, gain, buffer };
    loopNodes[key] = handle;
    return handle;
  }

  async function loadAllDecodedBuffers() {
    if (!ctx || loadingPromise) return loadingPromise;
    loadingPromise = (async () => {
      try {
        const mp3Keys = [
          'engineThrottle',
          'engineRoar',
          'drift1',
          'drift2',
          'pass1',
          'pass2',
          'crash',
          'victory',
          'gameOver',
          'evilLaugh',
          'nothingToWorry',
        ];

        await Promise.all(
          mp3Keys.map(async (key) => {
            const buf = await decodeUrl(MP3_FILES[key]);
            if (buf) {
              decodedBuffers[key] = buf;
            }
          })
        );

        // Wire continuous gapless WebAudio loops for engine throttle, dual drift, and cornering bite
        if (decodedBuffers.engineThrottle) {
          startLoopNode('engineThrottle', decodedBuffers.engineThrottle, misfireDuckGain);
        }
        if (decodedBuffers.drift1) {
          startLoopNode('drift1', decodedBuffers.drift1, driftFilterBus);
        }
        if (decodedBuffers.drift2) {
          startLoopNode('drift2', decodedBuffers.drift2, driftFilterBus);
          // Dedicated subtle stereo-panned left/right cornering tire bite channel using real rubber audio
          startLoopNode('turnTire', decodedBuffers.drift2, turnPanner || sfxBus);
        }

        // Optional bonus curb rumble & exhaust sputter WAVs (non-blocking)
        try {
          const curbBuf = await decodeUrl(`${wavBaseUrl}/${BONUS_WAV_FILES.curb}`);
          if (curbBuf) {
            startLoopNode('curb', curbBuf, sfxBus);
          }
        } catch (_e) {
          // optional
        }

        for (const f of BONUS_WAV_FILES.sputter) {
          try {
            const spBuf = await decodeUrl(`${wavBaseUrl}/${f}`);
            if (spBuf) oneShotSputters.push(spBuf);
          } catch (_e) {
            // optional
          }
        }

        stemsLoaded = Boolean(decodedBuffers.engineThrottle);
      } catch (err) {
        console.warn('[AudioManager] Error loading MP3 buffers:', err);
      }
    })();
    return loadingPromise;
  }

  function initAudio() {
    if (!bgmAudio) {
      bgmAudio = createStreamedLoop(MP3_FILES.bgm);
    }
    if (!rainAudio) {
      rainAudio = createStreamedLoop(MP3_FILES.rain);
    }
    if (!streamTickInterval) {
      streamTickInterval = window.setInterval(() => {
        tickAmbientStreams(0.06);
      }, 60);
    }

    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    ctx = new AudioCtx();

    // Master Gain (100% controlled by HUD Mute toggle)
    masterGain = ctx.createGain();
    masterGain.gain.value = enabled && !userMuted ? masterVolume : 0.0001;
    masterGain.connect(ctx.destination);

    // Subtle soft compressor prevents clipping when crash + nitro + voice fire together
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -6.0;
    limiter.knee.value = 12.0;
    limiter.ratio.value = 4.0;
    limiter.attack.value = 0.004;
    limiter.release.value = 0.14;
    limiter.connect(masterGain);

    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1.0;
    sfxBus.connect(limiter);

    voiceBus = ctx.createGain();
    voiceBus.gain.value = 1.15;
    voiceBus.connect(limiter);

    // Engine EQ Bus: warm low-shelf + smooth non-resonant lowpass (zero harsh buzzing!)
    engineBus = ctx.createGain();
    engineBus.gain.value = 0.92;
    engineBus.connect(limiter);

    engineBusFilter = ctx.createBiquadFilter();
    engineBusFilter.type = 'lowpass';
    engineBusFilter.frequency.value = 3400;
    engineBusFilter.Q.value = 0.707;
    engineBusFilter.connect(engineBus);

    lowShelfFilter = ctx.createBiquadFilter();
    lowShelfFilter.type = 'lowshelf';
    lowShelfFilter.frequency.value = 105;
    lowShelfFilter.gain.value = 3.2;
    lowShelfFilter.connect(engineBusFilter);

    misfireDuckGain = ctx.createGain();
    misfireDuckGain.gain.value = 1.0;
    misfireDuckGain.connect(lowShelfFilter);

    // Real Drift Tire Bus: gentle HP/LP shaping keeps rubber screech crisp without ear fatigue
    const driftHp = ctx.createBiquadFilter();
    driftHp.type = 'highpass';
    driftHp.frequency.value = 210;
    driftHp.Q.value = 0.707;

    const driftLp = ctx.createBiquadFilter();
    driftLp.type = 'lowpass';
    driftLp.frequency.value = 4600;
    driftLp.Q.value = 0.707;

    driftFilterBus = ctx.createGain();
    driftFilterBus.gain.value = 0.95;
    driftFilterBus.connect(driftHp);
    driftHp.connect(driftLp);
    driftLp.connect(sfxBus);

    // Dedicated Left/Right Turn Cornering Stereo Panner + Warm Filter
    const turnLp = ctx.createBiquadFilter();
    turnLp.type = 'lowpass';
    turnLp.frequency.value = 2250;
    turnLp.Q.value = 0.707;
    turnLp.connect(sfxBus);

    if (typeof ctx.createStereoPanner === 'function') {
      turnPanner = ctx.createStereoPanner();
      turnPanner.pan.value = 0.0;
      turnPanner.connect(turnLp);
    } else {
      turnPanner = turnLp;
    }

    loadAllDecodedBuffers();
  }

  function ensureRunningForPlayback() {
    if (!enabled || userMuted) return false;
    initAudio();
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return true;
  }

  /**
   * Helper: Plays a pooled one-shot AudioBuffer through `sfxBus` or `voiceBus`.
   */
  function playBufferOneShot(key, opts = {}) {
    if (!ensureRunningForPlayback()) return null;
    const buffer = decodedBuffers[key];
    if (!buffer || !ctx) return null;

    const {
      volume = 0.85,
      playbackRate = 1.0,
      bus = 'sfx',
      pan = 0.0,
      offset = 0.0,
      maxDuration = null,
      fadeOutSec = 0.0,
      duckMs = 0,
      duckFactor = 0.35,
      exclusiveVoice = false,
    } = opts;

    if (duckMs > 0) {
      duckBgm(duckMs, duckFactor);
    }

    if (exclusiveVoice && activeVoiceSource) {
      try {
        activeVoiceSource.stop();
      } catch (_e) {
        // ignore
      }
      activeVoiceSource = null;
    }

    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.setValueAtTime(
      Math.max(0.5, Math.min(2.0, playbackRate)),
      now
    );

    const gain = ctx.createGain();
    const safeVol = Math.max(0.0001, Math.min(1.6, volume));
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(safeVol, now + 0.014);

    const playDur = maxDuration
      ? Math.min(maxDuration, Math.max(0.05, (buffer.duration - offset) / playbackRate))
      : Math.max(0.05, (buffer.duration - offset) / playbackRate);

    if (fadeOutSec > 0.01 && playDur > fadeOutSec) {
      gain.gain.setValueAtTime(safeVol, now + Math.max(0.02, playDur - fadeOutSec));
      gain.gain.exponentialRampToValueAtTime(0.0001, now + playDur);
    }

    src.connect(gain);
    const dest = bus === 'voice' ? voiceBus : sfxBus;
    if (pan !== 0.0 && typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.85, Math.min(0.85, pan)), now);
      gain.connect(panner);
      panner.connect(dest);
    } else {
      gain.connect(dest);
    }

    if (exclusiveVoice) {
      activeVoiceSource = src;
      src.onended = () => {
        if (activeVoiceSource === src) {
          activeVoiceSource = null;
        }
      };
    }

    try {
      if (maxDuration) {
        src.start(now, offset, maxDuration * playbackRate + 0.04);
      } else {
        src.start(now, offset);
      }
    } catch (_e) {
      return null;
    }

    return src;
  }

  function setScreenContext(screen) {
    activeScreen = screen || 'MENU';
    tickAmbientStreams(0.05);
  }

  function setCarProfile(kitId) {
    currentCarId = kitId || 'coupe';
    carProfile = getCarAudioProfile(currentCarId);
  }

  function setEnabled(state, opts = {}) {
    const nextState = Boolean(state);
    const isUserInitiated = opts.userInitiated !== false;

    if (!isUserInitiated && userMuted && nextState) {
      return false;
    }
    if (isUserInitiated) {
      userMuted = !nextState;
    }

    enabled = nextState;
    if (enabled) {
      initAudio();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      if (masterGain && ctx) {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setTargetAtTime(masterVolume, ctx.currentTime, 0.04);
      }
      tickAmbientStreams(0.08);
    } else {
      stopEngine();
      if (activeVoiceSource) {
        try {
          activeVoiceSource.stop();
        } catch (_e) {
          // ignore
        }
        activeVoiceSource = null;
      }
      if (masterGain && ctx) {
        masterGain.gain.cancelScheduledValues(ctx.currentTime);
        masterGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.025);
      }
      tickAmbientStreams(0.1);
    }
    return enabled;
  }

  function toggle() {
    return setEnabled(!enabled, { userInitiated: true });
  }

  /**
   * Immediately silences continuous race loops (engine throttle, dual drift, cornering, curb)
   * when exiting RACE to Lobby, Garage, or GameOver.
   */
  function stopEngine() {
    smoothNormSpeed = 0.0;
    smoothAccelRate = 0.0;
    smoothBoostBlend = 0.0;
    smoothHillLoad = 0.0;
    prevSpeed = 0.0;
    wasDrifting = false;
    lastGearIndex = 1;
    gearShiftDipTimer = 0.0;

    if (!ctx) return;
    const now = ctx.currentTime;
    nextSputterTime = now + 99999;

    for (const key of ['engineThrottle', 'drift1', 'drift2', 'turnTire', 'curb']) {
      const node = loopNodes[key];
      if (node && node.gain && node.gain.gain) {
        node.gain.gain.cancelScheduledValues(now);
        node.gain.gain.setTargetAtTime(0.0001, now, 0.022);
      }
    }
  }

  /**
   * Per-frame racing audio modulation driven by KartPhysicsController telemetry.
   * - Primary engine: `tanweraman-car-throttle-static-337873.mp3` (0.75x idle -> 1.65x top speed/nitro)
   * - Drift screech: `poorartistt-car-drift-sound-effect-type-2-406999.mp3` + `olenchic--110063.mp3`
   * - Clean immediate stop when exiting drift onto straights
   */
  function update(state) {
    if (!enabled || userMuted || !ctx || ctx.state !== 'running') return;

    const nowMs = performance.now();
    const dt = Math.min(0.1, Math.max(0.004, (nowMs - prevTimeMs) * 0.001));
    prevTimeMs = nowMs;

    const rawSpeed = Math.abs(state.speed || 0.0);
    const targetNormSpeed = Math.min(1.45, rawSpeed / 0.204);
    const rawAccel = (targetNormSpeed - prevSpeed) / dt;
    prevSpeed = targetNormSpeed;

    const speedAlpha = 1.0 - Math.exp(-9.0 * dt);
    const accelAlpha = 1.0 - Math.exp(-6.0 * dt);
    const boostAlpha = 1.0 - Math.exp(-6.5 * dt);
    const loadAlpha = 1.0 - Math.exp(-7.0 * dt);

    smoothNormSpeed += (targetNormSpeed - smoothNormSpeed) * speedAlpha;
    smoothAccelRate += (rawAccel - smoothAccelRate) * accelAlpha;

    const isBoostActive = (state.boostActive || 0) > 0 || rawSpeed > 0.245;
    smoothBoostBlend += ((isBoostActive ? 1.0 : 0.0) - smoothBoostBlend) * boostAlpha;

    const slope =
      typeof state.slope === 'number'
        ? state.slope
        : state.tangent && typeof state.tangent.y === 'number'
          ? state.tangent.y
          : 0.0;
    const targetHillLoad = Math.max(-0.08, Math.min(0.22, slope * 0.52));
    smoothHillLoad += (targetHillLoad - smoothHillLoad) * loadAlpha;

    const clampedNorm = Math.min(1.15, Math.max(0.0, smoothNormSpeed));
    const throttleActive =
      !state.countdownLocked &&
      (state.throttle > 0.1 || rawSpeed > 0.012 || smoothAccelRate > 0.05);

    // Subtle multi-gear shift dip so real throttle MP3 breathes across gears
    const totalGears = carProfile.gears || 6;
    const rawGearFloat = Math.min(1.15, smoothNormSpeed) * (totalGears - 0.35);
    const gearIdx = Math.min(totalGears, Math.max(1, Math.floor(rawGearFloat) + 1));
    if (gearIdx > lastGearIndex && smoothNormSpeed > 0.22 && !state.countdownLocked) {
      gearShiftDipTimer = 0.085;
      if ((carProfile.sputterIntensity || 1.0) >= 1.05 && oneShotSputters.length > 0) {
        fireSingleRealSputterPop(0.0, 0.45, 'overrun');
      }
    }
    lastGearIndex = gearIdx;
    if (gearShiftDipTimer > 0) {
      gearShiftDipTimer = Math.max(0.0, gearShiftDipTimer - dt);
    }

    const now = ctx.currentTime;
    const timeConst = 0.038;

    // 1. DYNAMIC REAL ENGINE THROTTLE MP3 (`tanweraman-car-throttle-static-337873.mp3`)
    //    Smoothly maps idle (0.75x) -> cruise -> top speed / nitro (1.65x) with zero harsh drone!
    const carPitchBias = 1.0 + ((carProfile.stemPitchMult || 1.0) - 1.0) * 0.32;
    const speedCurve = Math.pow(Math.min(1.0, clampedNorm), 0.88);
    const accelPitchKick =
      smoothAccelRate > 0
        ? Math.min(0.07, smoothAccelRate * 0.04)
        : Math.max(-0.08, smoothAccelRate * 0.05);
    const shiftPitchDip = gearShiftDipTimer > 0 ? -0.065 : 0.0;

    const rawThrottleRate =
      (0.75 +
        speedCurve * 0.72 +
        smoothBoostBlend * 0.18 +
        accelPitchKick +
        shiftPitchDip -
        smoothHillLoad * 0.22) *
      carPitchBias;
    const targetThrottleRate = Math.max(0.75, Math.min(1.65, rawThrottleRate));

    if (loopNodes.engineThrottle) {
      const idleVol = state.countdownLocked ? 0.24 : 0.20;
      const driveVol =
        idleVol +
        0.46 * Math.min(1.0, clampedNorm) +
        (throttleActive ? 0.12 : 0.0) +
        0.16 * smoothBoostBlend;
      const finalEngineVol =
        Math.min(0.92, driveVol) * (gearShiftDipTimer > 0 ? 0.80 : 1.0);

      loopNodes.engineThrottle.gain.gain.setTargetAtTime(finalEngineVol, now, timeConst);
      loopNodes.engineThrottle.src.playbackRate.setTargetAtTime(
        targetThrottleRate,
        now,
        timeConst
      );
    }

    // Smooth formant lowpass & warm low-shelf EQ so pitched-up MP3 stays rich, never shrill
    if (engineBusFilter) {
      const targetCutoff = Math.max(
        1800,
        Math.min(4200, 2100 + 1850 * Math.min(1.0, clampedNorm) + 350 * smoothBoostBlend)
      );
      engineBusFilter.frequency.setTargetAtTime(targetCutoff, now, 0.05);
    }
    if (lowShelfFilter) {
      const shelfDb = Math.min(
        8.5,
        userRumbleAmount * (2.6 + 3.2 * Math.min(1.0, clampedNorm) + 1.4 * smoothBoostBlend)
      );
      lowShelfFilter.gain.setTargetAtTime(shelfDb, now, 0.05);
    }

    // 2. REAL RUBBER DRIFT TIRE SCREECH (`poorartistt-...` & `olenchic--110063`)
    //    Loops & crossfades cleanly while drifting; stops immediately on straights!
    const isDriftingNow = Boolean(state.isDrifting) && rawSpeed > 0.022 && !state.countdownLocked;
    if (isDriftingNow && !wasDrifting) {
      // Alternate primary/secondary rubber screech feel on each new drift entry
      driftLeadIndex = (driftLeadIndex + 1) % 2;
    }
    wasDrifting = isDriftingNow;

    const driftIntensity = isDriftingNow
      ? Math.min(
          1.0,
          Math.max(
            0.48,
            (Math.abs(state.driftAngle || 0.26) / 0.30) *
              Math.min(1.0, smoothNormSpeed / 0.22)
          )
        )
      : 0.0;

    const driftRate = Math.max(
      0.86,
      Math.min(1.26, 0.90 + 0.24 * Math.min(1.0, clampedNorm) + 0.10 * driftIntensity)
    );

    if (loopNodes.drift1 && loopNodes.drift2) {
      if (isDriftingNow) {
        // Crossfade smoothly between both real drift MP3s based on drift intensity & lead alternation
        const blend = Math.max(0.0, Math.min(1.0, (driftIntensity - 0.35) / 0.65));
        const w1 = driftLeadIndex === 0 ? 0.68 : 0.42 + 0.24 * (1.0 - blend);
        const w2 = driftLeadIndex === 0 ? 0.28 + 0.34 * blend : 0.58;
        const driftMaster = 0.42 + 0.40 * driftIntensity;

        loopNodes.drift1.gain.gain.setTargetAtTime(driftMaster * w1, now, 0.025);
        loopNodes.drift1.src.playbackRate.setTargetAtTime(driftRate, now, 0.04);

        loopNodes.drift2.gain.gain.setTargetAtTime(driftMaster * w2, now, 0.028);
        loopNodes.drift2.src.playbackRate.setTargetAtTime(driftRate * 1.04, now, 0.04);
      } else {
        // Immediately silence drift tires when exiting a drift onto straights
        loopNodes.drift1.gain.gain.setTargetAtTime(0.0001, now, 0.022);
        loopNodes.drift2.gain.gain.setTargetAtTime(0.0001, now, 0.022);
      }
    } else if (loopNodes.drift1) {
      loopNodes.drift1.gain.gain.setTargetAtTime(
        isDriftingNow ? 0.68 * driftIntensity : 0.0001,
        now,
        0.022
      );
      if (isDriftingNow) {
        loopNodes.drift1.src.playbackRate.setTargetAtTime(driftRate, now, 0.04);
      }
    }

    // 3. SUBTLE LEFT/RIGHT CORNERING TIRE SCRUB (stereo-panned using real rubber `olenchic` buffer)
    const steerVal =
      typeof state.steerSmooth === 'number'
        ? state.steerSmooth
        : typeof state.steerAngle === 'number'
          ? state.steerAngle * 2.2
          : 0.0;
    const absSteer = Math.min(1.0, Math.abs(steerVal));

    if (loopNodes.turnTire) {
      const cornerLoad =
        !isDriftingNow && !state.countdownLocked && rawSpeed > 0.048 && absSteer > 0.22
          ? Math.min(1.0, ((absSteer - 0.22) / 0.68) * Math.min(1.0, smoothNormSpeed / 0.55))
          : 0.0;
      const turnVol = cornerLoad > 0.03 ? 0.04 + 0.20 * cornerLoad : 0.0001;
      loopNodes.turnTire.gain.gain.setTargetAtTime(turnVol, now, 0.03);
      loopNodes.turnTire.src.playbackRate.setTargetAtTime(
        0.82 + 0.26 * Math.min(1.0, clampedNorm),
        now,
        0.04
      );
      if (turnPanner && turnPanner.pan) {
        const panTarget = Math.max(-0.45, Math.min(0.45, -steerVal * 0.40));
        turnPanner.pan.setTargetAtTime(panTarget, now, 0.04);
      }
    }

    // 4. OPTIONAL CURB RUMBLE LOOP
    const targetCurbGain =
      (state.curbRumble || 0) > 0.05 ? Math.min(0.42, state.curbRumble * 0.42) : 0.0001;
    if (loopNodes.curb) {
      loopNodes.curb.gain.gain.setTargetAtTime(targetCurbGain, now, 0.03);
      loopNodes.curb.src.playbackRate.setTargetAtTime(0.88 + 0.30 * clampedNorm, now, 0.04);
    }

    // 5. SUBTLE OVERRUN EXHAUST POPS ON HARD DECELERATION
    const decelFactor = Math.min(1.0, Math.max(0.0, (-smoothAccelRate - 0.14) / 0.55));
    if (userSputterAmount > 0.05 && now >= nextSputterTime && oneShotSputters.length > 0) {
      if (decelFactor > 0.30 && smoothNormSpeed > 0.28) {
        triggerSputterBurst(userSputterAmount * 0.65, 'overrun');
        nextSputterTime = now + (0.75 + 0.90 * Math.random());
      } else {
        nextSputterTime = now + 0.45;
      }
    }

    // Keep streamed BGM & Rain loops smoothly synced
    tickAmbientStreams(dt);

    const { wIdle, wCruise, wFlatout, wBoost } = computeCrispRegimeWeights(
      75.0 + 129.0 * Math.min(1.0, clampedNorm) + 64.0 * smoothBoostBlend
    );
    lastDiag = {
      stemsLoaded,
      normSpeed: Number(smoothNormSpeed.toFixed(2)),
      cruisePlaybackRate: Number(targetThrottleRate.toFixed(2)),
      weights: {
        idle: Number(wIdle.toFixed(2)),
        cruise: Number(Math.max(wCruise, 0.95).toFixed(2)),
        flatout: Number(wFlatout.toFixed(2)),
        decel: Number(decelFactor.toFixed(2)),
        f1Boost: Number(wBoost.toFixed(2)),
        rumble: Number(userRumbleAmount.toFixed(2)),
        drift: Number(driftIntensity.toFixed(2)),
        curb: Number(targetCurbGain.toFixed(2)),
      },
      sputterCount,
    };
  }

  /**
   * Real Car Ignition / Engine Roar (`dragon-studio-car-engine-roaring-376881.mp3`)
   * Played on car selection/preview in the 3D Garage turntable!
   */
  function playCarRevPreview(kitId) {
    const nowMs = performance.now();
    if (nowMs - lastRevPreviewMs < 450) return;
    lastRevPreviewMs = nowMs;

    if (kitId) setCarProfile(kitId);
    if (!ensureRunningForPlayback()) return;

    const pitch = Math.max(
      0.86,
      Math.min(1.18, 0.98 * (carProfile.stemPitchMult || 1.0))
    );
    const played = playBufferOneShot('engineRoar', {
      volume: 0.78,
      playbackRate: pitch,
      bus: 'sfx',
      maxDuration: 2.1,
      fadeOutSec: 0.35,
      duckMs: 1400,
      duckFactor: 0.45,
    });

    if (!played && ctx) {
      // Lightweight fallback while MP3 is still finishing initial decode
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(195, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(85, now + 0.45);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.18, now + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.48);
      osc.connect(g);
      g.connect(sfxBus);
      osc.start(now);
      osc.stop(now + 0.5);
    }
  }

  /**
   * Real Starting Grid Engine Roar (`dragon-studio-car-engine-roaring-376881.mp3`)
   * Fired on the starting grid (3-2-1 countdown & GO! launch).
   */
  function playGridEngineRoar(isLaunch = false) {
    const nowMs = performance.now();
    if (nowMs - lastGridRoarMs < 500) return;
    lastGridRoarMs = nowMs;
    if (!ensureRunningForPlayback()) return;

    const basePitch = 0.96 * (carProfile.stemPitchMult || 1.0);
    playBufferOneShot('engineRoar', {
      volume: isLaunch ? 0.95 : 0.68,
      playbackRate: isLaunch ? Math.min(1.24, basePitch * 1.12) : Math.max(0.84, basePitch * 0.95),
      bus: 'sfx',
      maxDuration: isLaunch ? 2.4 : 1.5,
      fadeOutSec: 0.35,
      duckMs: isLaunch ? 1100 : 700,
      duckFactor: 0.6,
    });
  }

  /**
   * Real High-Speed Car Flyby Whoosh (`moeeza3-fast-car-passing-sound-395038.mp3`
   * & `spinopel-passing-car-393073.mp3`) for Nitro/Shockwave & Close Near-Miss Overtakes!
   */
  function playFlybyWhoosh(opts = {}) {
    const nowMs = performance.now();
    const cooldown = opts.cooldownMs ?? 520;
    if (nowMs - lastFlybyMs < cooldown) return false;
    lastFlybyMs = nowMs;

    if (!ensureRunningForPlayback()) return false;

    const key =
      opts.preferredKey ||
      (passAltIndex++ % 2 === 0 ? 'pass1' : 'pass2');
    const fallbackKey = key === 'pass1' ? 'pass2' : 'pass1';
    const chosenKey = decodedBuffers[key] ? key : fallbackKey;

    const played = playBufferOneShot(chosenKey, {
      volume: opts.volume ?? 0.85,
      playbackRate: opts.playbackRate ?? (0.96 + Math.random() * 0.14),
      bus: 'sfx',
      pan: opts.pan ?? 0.0,
      maxDuration: opts.maxDuration ?? 1.45,
      fadeOutSec: 0.25,
    });
    return Boolean(played);
  }

  /**
   * Plays high-speed Near-Miss overtake flyby whoosh past an AI rival (stereo-panned!).
   */
  function playNearMissWhoosh(panSide = 0.0) {
    return playFlybyWhoosh({
      volume: 0.82,
      playbackRate: 1.04 + Math.random() * 0.12,
      pan: Math.max(-0.65, Math.min(0.65, panSide * 0.55)),
      cooldownMs: 580,
      maxDuration: 1.3,
    });
  }

  /**
   * Plays Nitro / Shockwave Boost ignition: real passing-car flyby MP3 + punchy sub-bass surge!
   */
  function playNitroBoost() {
    const nowMs = performance.now();
    if (nowMs - lastNitroMs < 420) return;
    lastNitroMs = nowMs;

    if (!ensureRunningForPlayback()) return;

    playFlybyWhoosh({
      volume: 0.90,
      playbackRate: 1.08 + Math.random() * 0.10,
      cooldownMs: 320,
      maxDuration: 1.5,
    });

    // Subtle deep sub-bass ignition punch underneath the real flyby whoosh
    if (ctx && sfxBus) {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(92, now);
      osc.frequency.exponentialRampToValueAtTime(195, now + 0.18);
      osc.frequency.exponentialRampToValueAtTime(70, now + 0.52);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.28, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      osc.connect(g);
      g.connect(sfxBus);
      osc.start(now);
      osc.stop(now + 0.58);
    }
  }

  /**
   * Plays Real Metallic Car Crash / Impact SFX (`dragon-studio-car-crash-sound-effect-376874.mp3`)
   * on hard guardrail impacts & rival Takedowns with anti-spam cooldown!
   */
  function playRailImpact(intensity = 1.0) {
    if (!ensureRunningForPlayback()) return;
    const nowMs = performance.now();
    if (nowMs - lastRailImpactMs < 360) return;
    lastRailImpactMs = nowMs;

    const strength = Math.max(0.30, Math.min(1.25, Number(intensity) || 1.0));
    const now = ctx.currentTime;

    if (misfireDuckGain) {
      misfireDuckGain.gain.cancelScheduledValues(now);
      misfireDuckGain.gain.setValueAtTime(1.0, now);
      misfireDuckGain.gain.linearRampToValueAtTime(
        Math.max(0.50, 1.0 - 0.30 * strength),
        now + 0.012
      );
      misfireDuckGain.gain.linearRampToValueAtTime(1.0, now + 0.14);
    }

    const played = playBufferOneShot('crash', {
      volume: Math.min(1.05, 0.58 + 0.42 * strength),
      playbackRate: 0.92 + Math.random() * 0.16,
      bus: 'sfx',
      maxDuration: 1.35,
      fadeOutSec: 0.18,
    });

    // Subtle low-end chassis thud for impact weight (or fallback if MP3 still decoding)
    if (ctx && sfxBus) {
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();
      thudOsc.type = 'sine';
      thudOsc.frequency.setValueAtTime(102, now);
      thudOsc.frequency.exponentialRampToValueAtTime(30, now + 0.12);
      thudGain.gain.setValueAtTime(0.0001, now);
      thudGain.gain.linearRampToValueAtTime((played ? 0.22 : 0.36) * strength, now + 0.005);
      thudGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
      thudOsc.connect(thudGain);
      thudGain.connect(sfxBus);
      thudOsc.start(now);
      thudOsc.stop(now + 0.15);
    }
  }

  /**
   * Voice Line 1: "VICTORY!" (`ribhavagrawal-victorymale-version-230553.mp3`)
   * Played on 1st place, winning Elimination ("Last Car Standing"), or beating Gold target!
   */
  function playVictoryVoice() {
    const nowMs = performance.now();
    if (nowMs - lastVictoryVoiceMs < 1500) return;
    lastVictoryVoiceMs = nowMs;

    if (!ensureRunningForPlayback()) return;
    playBufferOneShot('victory', {
      volume: 1.08,
      playbackRate: 1.0,
      bus: 'voice',
      duckMs: 2200,
      duckFactor: 0.28,
      exclusiveVoice: true,
    });
  }

  /**
   * Voice Line 2: "Game Over" (`universfield-game-over-deep-male-voice-clip-352695.mp3`)
   * Played when Eliminated, failing Time Attack/Drift target, or finishing last!
   */
  function playGameOverVoice() {
    const nowMs = performance.now();
    if (nowMs - lastGameOverVoiceMs < 1500) return;
    lastGameOverVoiceMs = nowMs;

    if (!ensureRunningForPlayback()) return;
    playBufferOneShot('gameOver', {
      volume: 1.05,
      playbackRate: 1.0,
      bus: 'voice',
      duckMs: 2200,
      duckFactor: 0.26,
      exclusiveVoice: true,
    });
  }

  /**
   * Voice Line 3: Rival Evil Laugh Taunt (`phatphrogstudio-oni-demon-voice-demonic-laughter-477923.mp3`)
   * Played when knocked out in Elimination or slammed/overtaken hard by a rival on the final lap!
   */
  function playEvilLaugh() {
    const nowMs = performance.now();
    if (nowMs - lastEvilLaughMs < 4500) return;
    lastEvilLaughMs = nowMs;

    if (!ensureRunningForPlayback()) return;
    playBufferOneShot('evilLaugh', {
      volume: 0.96,
      playbackRate: 1.0,
      bus: 'voice',
      duckMs: 2200,
      duckFactor: 0.30,
      exclusiveVoice: true,
    });
  }

  /**
   * Voice Line 4: "There is nothing to worry about" (`freesound_community-075869_39there-is-nothing-to-worry-about39-robotic-voice-hd-80248.mp3`)
   * Played when unlocking/purchasing a new car in the 3D Garage OR launching a major ramp stunt!
   */
  function playUnlockOrStuntVoice() {
    const nowMs = performance.now();
    if (nowMs - lastUnlockStuntVoiceMs < 3500) return;
    lastUnlockStuntVoiceMs = nowMs;

    if (!ensureRunningForPlayback()) return;
    playBufferOneShot('nothingToWorry', {
      volume: 0.96,
      playbackRate: 1.0,
      bus: 'voice',
      duckMs: 2100,
      duckFactor: 0.32,
      exclusiveVoice: true,
    });
  }

  /**
   * Smoothly controls real Rain Ambience MP3 (`liecio-calming-rain-257596.mp3`) volume (0..1)
   * whenever Drizzle / Rain weather is active during a race.
   */
  function setRainAmbience(intensity = 0.0) {
    const clamped =
      enabled && !userMuted ? Math.max(0.0, Math.min(1.0, Number(intensity) || 0.0)) : 0.0;
    rainTargetVol = clamped > 0.01 ? clamped * 0.42 : 0.0;
    tickAmbientStreams(0.06);
  }

  function fireSingleRealSputterPop(delayS = 0.0, intensity = 1.0, mode = 'overrun') {
    if (!enabled || userMuted || !ctx || ctx.state !== 'running') return;
    if (oneShotSputters.length === 0) return;
    const tPop = ctx.currentTime + delayS;
    const buf =
      oneShotSputters[Math.floor(Math.random() * oneShotSputters.length)];
    if (!buf) return;
    const sliceDur = 0.14 + 0.08 * Math.random();
    const maxOffset = Math.max(0.0, buf.duration - sliceDur - 0.04);
    const offset = Math.random() * maxOffset;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.94 + 0.12 * Math.random();

    const g = ctx.createGain();
    const gPeak = Math.min(0.42, (mode === 'overrun' ? 0.26 : 0.18) * intensity);
    g.gain.setValueAtTime(0.0001, tPop);
    g.gain.linearRampToValueAtTime(gPeak, tPop + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, tPop + sliceDur);

    src.connect(g);
    g.connect(sfxBus);
    src.start(tPop, offset, sliceDur + 0.02);
  }

  function triggerSputterBurst(intensity = 1.0, mode = 'overrun') {
    if (!enabled || userMuted || !ctx) return;
    sputterCount += 1;
    fireSingleRealSputterPop(0.0, intensity, mode);
  }

  function playDriftBoostPop(tier = 1) {
    if (!ensureRunningForPlayback()) return;
    const intensity = tier >= 3 ? 1.15 : tier === 2 ? 0.95 : 0.78;
    fireSingleRealSputterPop(0.0, intensity, 'overrun');
    if (tier >= 2) {
      playFlybyWhoosh({
        volume: 0.56 * intensity,
        playbackRate: 1.15,
        cooldownMs: 420,
        maxDuration: 0.95,
      });
    }
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    const fStart = tier >= 3 ? 210 : tier === 2 ? 165 : 135;
    osc.frequency.setValueAtTime(fStart, now);
    osc.frequency.exponentialRampToValueAtTime(fStart * 2.0, now + 0.16);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.16 * intensity, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
    osc.connect(g);
    g.connect(sfxBus);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  function playLapChime() {
    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.001, now + idx * 0.07);
      g.gain.exponentialRampToValueAtTime(0.14, now + idx * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.07 + 0.35);
      o.connect(g);
      g.connect(sfxBus);
      o.start(now + idx * 0.07);
      o.stop(now + idx * 0.07 + 0.38);
    });
  }

  function playF1CountdownBeep(isGo = false) {
    if (!ensureRunningForPlayback()) return;

    const now = ctx.currentTime;
    const baseFreq = isGo ? 1760.0 : 880.0;
    const dur = isGo ? 0.38 : 0.18;
    const peakGain = isGo ? 0.48 : 0.36;

    const toneFilter = ctx.createBiquadFilter();
    toneFilter.type = 'lowpass';
    toneFilter.frequency.value = isGo ? 4800 : 2800;
    toneFilter.Q.value = 0.707;
    toneFilter.connect(sfxBus);

    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(peakGain, now + 0.006);
    envGain.gain.setValueAtTime(peakGain * 0.88, now + dur * 0.65);
    envGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    envGain.connect(toneFilter);

    const oscMain = ctx.createOscillator();
    oscMain.type = 'sine';
    oscMain.frequency.setValueAtTime(baseFreq, now);
    oscMain.connect(envGain);

    const oscHarm = ctx.createOscillator();
    oscHarm.type = 'triangle';
    oscHarm.frequency.setValueAtTime(baseFreq, now);
    const harmGain = ctx.createGain();
    harmGain.gain.value = 0.28;
    oscHarm.connect(harmGain);
    harmGain.connect(envGain);

    oscMain.start(now);
    oscHarm.start(now);
    oscMain.stop(now + dur + 0.02);
    oscHarm.stop(now + dur + 0.02);

    // Pair GO! launch with real roaring supercar engine!
    if (isGo) {
      playGridEngineRoar(true);
    }
  }

  function playLandingThud(intensity = 0.9) {
    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    const strength = Math.max(0.35, Math.min(1.2, intensity));

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(96, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.16);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.38 * strength, now + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
    osc.connect(g);
    g.connect(sfxBus);
    osc.start(now);
    osc.stop(now + 0.19);
  }

  function playRaceFinishFanfare() {
    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, start: 0.0, dur: 0.30, gain: 0.12 },
      { freq: 659.25, start: 0.06, dur: 0.32, gain: 0.12 },
      { freq: 783.99, start: 0.12, dur: 0.36, gain: 0.13 },
      { freq: 1046.5, start: 0.20, dur: 0.72, gain: 0.15 },
    ];
    notes.forEach(({ freq, start, dur, gain }) => {
      const t0 = now + start;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t0);
      env.gain.linearRampToValueAtTime(gain, t0 + 0.015);
      env.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      env.connect(sfxBus);
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      osc.connect(env);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    });
  }

  function playSplashImpact() {
    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(115, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.9);
    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.45, now + 0.03);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
    subOsc.connect(subGain);
    subGain.connect(sfxBus);
    subOsc.start(now);
    subOsc.stop(now + 1.05);
  }

  function playUiClick(variant = 'click') {
    const nowMs = performance.now();
    if (nowMs - lastUiClickMs < 90) return;
    lastUiClickMs = nowMs;

    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.24, now);
    out.connect(sfxBus);

    if (variant === 'equip') {
      const freqs = [440, 587.33, 880];
      freqs.forEach((f, i) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + i * 0.05);
        g.gain.setValueAtTime(0.001, now + i * 0.05);
        g.gain.linearRampToValueAtTime(0.24, now + i * 0.05 + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.05 + 0.16);
        osc.connect(g);
        g.connect(out);
        osc.start(now + i * 0.05);
        osc.stop(now + i * 0.05 + 0.18);
      });
    } else {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.045);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.22, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(g);
      g.connect(out);
      osc.start(now);
      osc.stop(now + 0.055);
    }
  }

  function playPowerupBoxPickup() {
    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.exponentialRampToValueAtTime(880.0, now + 0.07);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    osc.connect(g);
    g.connect(sfxBus);
    osc.start(now);
    osc.stop(now + 0.17);
  }

  function playRocketLaunch() {
    const nowMs = performance.now();
    if (nowMs - lastRocketLaunchMs < 650) return;
    lastRocketLaunchMs = nowMs;
    if (!ensureRunningForPlayback()) return;

    playFlybyWhoosh({ volume: 0.65, playbackRate: 1.25, cooldownMs: 400, maxDuration: 0.85 });
  }

  function playExplosion() {
    const nowMs = performance.now();
    if (nowMs - lastExplosionMs < 380) return;
    lastExplosionMs = nowMs;
    if (!ensureRunningForPlayback()) return;

    playBufferOneShot('crash', {
      volume: 1.0,
      playbackRate: 0.84 + Math.random() * 0.12,
      bus: 'sfx',
      maxDuration: 1.45,
      fadeOutSec: 0.20,
    });

    const now = ctx.currentTime;
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(128, now);
    subOsc.frequency.exponentialRampToValueAtTime(28, now + 0.40);
    subGain.gain.setValueAtTime(0.45, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.44);
    subOsc.connect(subGain);
    subGain.connect(sfxBus);
    subOsc.start(now);
    subOsc.stop(now + 0.46);
  }

  function playShieldActivate() {
    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const g = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(330, now);
    osc1.frequency.exponentialRampToValueAtTime(520, now + 0.28);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.22, now + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    osc1.connect(g);
    g.connect(sfxBus);
    osc1.start(now);
    osc1.stop(now + 0.44);
  }

  function playOilSpinout() {
    if (!ensureRunningForPlayback()) return;
    playBufferOneShot('drift2', {
      volume: 0.65,
      playbackRate: 0.95,
      bus: 'sfx',
      maxDuration: 0.75,
      fadeOutSec: 0.18,
    });
  }

  function playEmpBlast() {
    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(360, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.36);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.30, now + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    osc.connect(g);
    g.connect(sfxBus);
    osc.start(now);
    osc.stop(now + 0.40);
  }

  function playRouletteTick(pitchFactor = 1.0) {
    const nowMs = performance.now();
    if (nowMs - lastRouletteTickMs < 55) return;
    lastRouletteTickMs = nowMs;
    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    const baseFreq = 520 * Math.max(0.7, Math.min(1.6, pitchFactor));
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.25, now + 0.035);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.14, now + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(g);
    g.connect(sfxBus);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  function playRouletteLock() {
    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    [659.25, 880.0, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.045);
      g.gain.setValueAtTime(0.001, now + i * 0.045);
      g.gain.linearRampToValueAtTime(0.18, now + i * 0.045 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.045 + 0.18);
      osc.connect(g);
      g.connect(sfxBus);
      osc.start(now + i * 0.045);
      osc.stop(now + i * 0.045 + 0.20);
    });
  }

  function playShieldDeflect() {
    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    [587.33, 880.0, 1318.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.65, now + 0.26);
      g.gain.setValueAtTime(0.001, now);
      g.gain.linearRampToValueAtTime(0.20 / (idx + 1), now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
      osc.connect(g);
      g.connect(sfxBus);
      osc.start(now);
      osc.stop(now + 0.30);
    });
  }

  function playIncomingWarningBeep(urgency = 0.5) {
    const nowMs = performance.now();
    const minInterval = 340 - Math.min(1.0, Math.max(0.0, urgency)) * 190;
    if (nowMs - lastWarningBeepMs < minInterval) return;
    lastWarningBeepMs = nowMs;
    if (!ensureRunningForPlayback()) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    const freq = 920 + Math.min(1.0, urgency) * 260;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.setValueAtTime(freq * 0.82, now + 0.045);
    g.gain.setValueAtTime(0.001, now);
    g.gain.linearRampToValueAtTime(0.16, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.095);
    osc.connect(g);
    g.connect(sfxBus);
    osc.start(now);
    osc.stop(now + 0.105);
  }

  return {
    preload,
    toggle,
    setEnabled,
    setScreenContext,
    setCarProfile,
    playCarRevPreview,
    playGridEngineRoar,
    playFlybyWhoosh,
    playNearMissWhoosh,
    playVictoryVoice,
    playGameOverVoice,
    playEvilLaugh,
    playUnlockOrStuntVoice,
    playDriftBoostPop,
    stopEngine,
    update,
    playLapChime,
    playRaceFinishFanfare,
    playRailImpact,
    playLandingThud,
    setRainAmbience,
    playF1CountdownBeep,
    playSplashImpact,
    playUiClick,
    playNitroBoost,
    playPowerupBoxPickup,
    playRocketLaunch,
    playExplosion,
    playShieldActivate,
    playShieldDeflect,
    playOilSpinout,
    playEmpBlast,
    playRouletteTick,
    playRouletteLock,
    playIncomingWarningBeep,
    triggerSputterBurst,
    setRumbleAmount: (v) => {
      userRumbleAmount = Math.max(0.0, Math.min(2.5, Number(v)));
    },
    setSputterAmount: (v) => {
      userSputterAmount = Math.max(0.0, Math.min(2.5, Number(v)));
    },
    isEnabled: () => enabled && !userMuted,
    getDiagnostics: () => lastDiag,
  };
}

// Export alias matching `src/audio/WebAudioSynth.js` signature for 1-line drop-in replacement
export const createWebAudioSynth = createDeskRacerHybridAudio;
