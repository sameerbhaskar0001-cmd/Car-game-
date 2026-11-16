import React, { useEffect, useState, useCallback, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  BODY_KITS,
  BodyKitId,
  BodyKitSpec,
  GameState,
  MAP_SPECS,
  MapId,
  MapSpec,
  RaceFinishResult,
  RaceTelemetry,
  RimId,
  SpoilerId,
  TheRaceEngineBridge,
  getNextRotatedMapId,
  normalizeCarId,
  normalizeMapId,
} from './types/game';
import { SplashScreen } from './components/SplashScreen';
import { MainMenu } from './components/MainMenu';
import { GarageScreen } from './components/GarageScreen';
import { RaceHUD } from './components/RaceHUD';
import { GameOverScreen } from './components/GameOverScreen';
import { SettingsModal } from './components/SettingsModal';

const STORAGE_COINS_KEY = 'the_race_3d_coins_v1';
const STORAGE_KIT_KEY = 'the_race_3d_equipped_kit_v1';
const STORAGE_RIM_KEY = 'the_race_3d_equipped_rim_v1';
const STORAGE_SPOILER_KEY = 'the_race_3d_equipped_spoiler_v1';
const STORAGE_PAINT_KEY = 'the_race_3d_equipped_paint_v1';
const STORAGE_UNLOCKED_KEY = 'the_race_3d_unlocked_kits_v1';
const STORAGE_MAP_KEY = 'the_race_3d_selected_map_v1';
const STORAGE_AUTO_ROTATE_KEY = 'the_race_3d_auto_rotate_v1';

const DEFAULT_COINS = 500;

export default function App() {
  const [gameState, setGameState] = useState<GameState>('SPLASH');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);

  // Persistent Player Coins (Default 500)
  const [coins, setCoins] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_COINS_KEY);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) return parsed;
      }
    } catch {
      // ignore storage errors
    }
    return DEFAULT_COINS;
  });

  // Persistent Unlocked Kits
  const [unlockedKits, setUnlockedKits] = useState<BodyKitId[]>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_UNLOCKED_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped = parsed.map((id) => normalizeCarId(id));
          if (!mapped.includes('coupe')) mapped.unshift('coupe');
          return Array.from(new Set(mapped));
        }
      }
    } catch {
      // ignore
    }
    return ['coupe', 's64'];
  });

  // Persistent Equipped Body Kit
  const [equippedKitId, setEquippedKitId] = useState<BodyKitId>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KIT_KEY) as BodyKitId | null;
      return normalizeCarId(saved);
    } catch {
      // ignore
    }
    return 'coupe';
  });

  const equippedKit: BodyKitSpec =
    BODY_KITS.find((k) => k.id === equippedKitId) || BODY_KITS[0];

  // Persistent Equipped Rim & Spoiler
  const [equippedRimId, setEquippedRimId] = useState<RimId>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_RIM_KEY) as RimId | null;
      if (saved) return saved;
    } catch {
      // ignore
    }
    return equippedKit.defaultRimId;
  });

  const [equippedSpoilerId, setEquippedSpoilerId] = useState<SpoilerId>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_SPOILER_KEY) as SpoilerId | null;
      if (saved) return saved;
    } catch {
      // ignore
    }
    return equippedKit.defaultSpoilerId;
  });

  const [equippedPaintHex, setEquippedPaintHex] = useState<string | null>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_PAINT_KEY);
      if (saved && saved.startsWith('#')) return saved;
    } catch {
      // ignore
    }
    return null;
  });

  // Persistent Selected Circuit Map ('coast' | 'city' | 'canyon')
  const [selectedMapId, setSelectedMapId] = useState<MapId>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_MAP_KEY);
      return normalizeMapId(saved);
    } catch {
      // ignore
    }
    return 'coast';
  });

  // Persistent Post-Race Auto-Rotate Setting
  const [autoRotateMaps, setAutoRotateMaps] = useState<boolean>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_AUTO_ROTATE_KEY);
      if (saved === 'false') return false;
      if (saved === 'true') return true;
    } catch {
      // ignore
    }
    return true;
  });

  const selectedMapIdRef = useRef<MapId>(selectedMapId);
  const autoRotateMapsRef = useRef<boolean>(autoRotateMaps);
  selectedMapIdRef.current = selectedMapId;
  autoRotateMapsRef.current = autoRotateMaps;

  const activeMapSpec: MapSpec =
    MAP_SPECS.find((m) => m.id === selectedMapId) || MAP_SPECS[0];

  // Live Race Telemetry State
  const [telemetry, setTelemetry] = useState<RaceTelemetry>({
    speedKmh: 0,
    lapCount: 1,
    currentLapTime: 0,
    totalRaceTime: 0,
    bestLapTime: null,
    boostCharge: 1.0,
    boostActive: 0,
    isDrifting: false,
    countdownStep: 3,
    cameraMode: 1,
    autopilot: false,
    audioEnabled: false,
    positionRank: 1,
    rivals: [],
  });

  // Last Completed Race Result
  const [raceResult, setRaceResult] = useState<RaceFinishResult>({
    totalTime: 52.45,
    bestLap: 16.82,
    lapTimes: [18.12, 17.51, 16.82],
    coinsEarned: 250,
    finishRank: 1,
  });

  // Persist coins
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_COINS_KEY, String(coins));
    } catch {
      // ignore
    }
  }, [coins]);

  // Persist unlocked kits
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_UNLOCKED_KEY, JSON.stringify(unlockedKits));
    } catch {
      // ignore
    }
  }, [unlockedKits]);

  // Persist equipped kit, rim, spoiler, and paint
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KIT_KEY, equippedKitId);
      window.localStorage.setItem(STORAGE_RIM_KEY, equippedRimId);
      window.localStorage.setItem(STORAGE_SPOILER_KEY, equippedSpoilerId);
      if (equippedPaintHex) {
        window.localStorage.setItem(STORAGE_PAINT_KEY, equippedPaintHex);
      } else {
        window.localStorage.removeItem(STORAGE_PAINT_KEY);
      }
    } catch {
      // ignore
    }
  }, [equippedKitId, equippedRimId, equippedSpoilerId, equippedPaintHex]);

  const getEngine = useCallback((): TheRaceEngineBridge | undefined => {
    return window.__theRaceEngine;
  }, []);

  // Persist selected map and synchronize 3D engine map
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_MAP_KEY, selectedMapId);
    } catch {
      // ignore
    }

    const syncMap = () => {
      const engine = getEngine();
      if (!engine || !engine.setMap) return false;
      if (engine.getMap?.() !== selectedMapId) {
        engine.setMap(selectedMapId);
      }
      return true;
    };

    if (!syncMap()) {
      const interval = window.setInterval(() => {
        if (syncMap()) {
          window.clearInterval(interval);
        }
      }, 100);
      return () => window.clearInterval(interval);
    }
  }, [selectedMapId, getEngine]);

  // Persist auto-rotate toggle
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_AUTO_ROTATE_KEY, String(autoRotateMaps));
    } catch {
      // ignore
    }
  }, [autoRotateMaps]);

  // Synchronize GameState with 3D Engine without re-triggering heavy vehicle model swaps on screen flip
  useEffect(() => {
    const syncScreen = () => {
      const engine = getEngine();
      if (!engine) return false;
      engine.setScreen(gameState);
      setAudioEnabled(engine.isAudioEnabled());
      return true;
    };

    if (!syncScreen()) {
      const interval = window.setInterval(() => {
        if (syncScreen()) {
          window.clearInterval(interval);
        }
      }, 100);
      return () => window.clearInterval(interval);
    }
  }, [gameState, getEngine]);

  // Synchronize Equipped Car Kit / Parts / Paint only when vehicle customization changes
  useEffect(() => {
    const syncKit = () => {
      const engine = getEngine();
      if (!engine) return false;
      engine.setBodyKit(equippedKit.id, equippedKit.physics, {
        rimId: equippedRimId,
        spoilerId: equippedSpoilerId,
        paintHex: equippedPaintHex,
      });
      return true;
    };

    if (!syncKit()) {
      const interval = window.setInterval(() => {
        if (syncKit()) {
          window.clearInterval(interval);
        }
      }, 100);
      return () => window.clearInterval(interval);
    }
  }, [equippedKit, equippedRimId, equippedSpoilerId, equippedPaintHex, getEngine]);

  // Subscribe to 3D Engine Telemetry & Race Finish Events
  useEffect(() => {
    let unsubscribeTelemetry: (() => void) | null = null;
    let unsubscribeFinish: (() => void) | null = null;

    const attachListeners = () => {
      const engine = getEngine();
      if (!engine) return false;

      unsubscribeTelemetry = engine.onTelemetry((data) => {
        setTelemetry(data);
        setAudioEnabled(data.audioEnabled);
      });

      unsubscribeFinish = engine.onRaceFinish((finishData) => {
        const rank = finishData.finishRank || 1;
        const rankReward = rank === 1 ? 300 : rank === 2 ? 200 : rank === 3 ? 120 : 60;
        const speedBonus =
          finishData.totalTime < 55 ? 50 : finishData.totalTime < 70 ? 25 : 10;
        const totalReward = rankReward + speedBonus;
        const completedMapId = normalizeMapId(engine.getMap?.() || selectedMapIdRef.current);

        setCoins((prev) => prev + totalReward);
        setRaceResult({
          totalTime: finishData.totalTime,
          bestLap: finishData.bestLap,
          lapTimes: finishData.lapTimes,
          coinsEarned: totalReward,
          finishRank: rank,
          mapId: completedMapId,
        });

        if (autoRotateMapsRef.current) {
          const nextMapId = getNextRotatedMapId(completedMapId);
          setSelectedMapId(nextMapId);
        }

        setGameState('GAMEOVER');
      });

      return true;
    };

    if (!attachListeners()) {
      const poll = window.setInterval(() => {
        if (attachListeners()) {
          window.clearInterval(poll);
        }
      }, 100);
      return () => {
        window.clearInterval(poll);
        if (unsubscribeTelemetry) unsubscribeTelemetry();
        if (unsubscribeFinish) unsubscribeFinish();
      };
    }

    return () => {
      if (unsubscribeTelemetry) unsubscribeTelemetry();
      if (unsubscribeFinish) unsubscribeFinish();
    };
  }, [getEngine]);

  // Integrate @capacitor/app Hardware Back Button Listener on Android + Escape key
  useEffect(() => {
    let listenerPromise: ReturnType<typeof CapacitorApp.addListener> | null = null;

    const handleBackAction = () => {
      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      if (gameState === 'GARAGE' || gameState === 'RACE' || gameState === 'GAMEOVER') {
        const engine = getEngine();
        if (engine) {
          engine.clearTouchControls();
          engine.setBodyKit(equippedKit.id, equippedKit.physics, {
            rimId: equippedRimId,
            spoilerId: equippedSpoilerId,
            paintHex: equippedPaintHex,
          });
        }
        setGameState('MENU');
      }
    };

    try {
      listenerPromise = CapacitorApp.addListener('backButton', () => {
        handleBackAction();
      });
    } catch {
      // Fallback for web browser environment
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        handleBackAction();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (listenerPromise) {
        listenerPromise.then((handle) => handle.remove()).catch(() => {});
      }
    };
  }, [settingsOpen, gameState, equippedKit, equippedRimId, equippedSpoilerId, equippedPaintHex, getEngine]);

  const requestLandscapeMode = useCallback(async () => {
    try {
      const docEl = document.documentElement as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void>;
      };
      if (!document.fullscreenElement) {
        if (docEl.requestFullscreen) {
          await docEl.requestFullscreen();
        } else if (docEl.webkitRequestFullscreen) {
          await docEl.webkitRequestFullscreen();
        }
      }
      const orientation = screen.orientation as ScreenOrientation & {
        lock?: (orientation: string) => Promise<void>;
      };
      if (orientation && typeof orientation.lock === 'function') {
        await orientation.lock('landscape');
      }
    } catch {
      // Browser/iframe may block programmatic orientation lock until user rotates device
    }
  }, []);

  // Prevent browser pull-to-refresh or gesture scrolling during gameplay
  useEffect(() => {
    const preventDefaultTouch = (e: TouchEvent) => {
      if (gameState === 'RACE' && e.touches.length > 1) {
        e.preventDefault();
      }
    };
    document.addEventListener('touchmove', preventDefaultTouch, { passive: false });
    return () => {
      document.removeEventListener('touchmove', preventDefaultTouch);
    };
  }, [gameState]);

  // Handlers
  const handleSplashComplete = useCallback(() => {
    setGameState('MENU');
  }, []);

  const handleSelectMap = useCallback(
    (mapId: MapId) => {
      const normalized = normalizeMapId(mapId);
      setSelectedMapId(normalized);
      const engine = getEngine();
      if (engine) {
        engine.playUiClick('click');
        if (engine.getMap?.() !== normalized) {
          engine.setMap?.(normalized);
        }
      }
    },
    [getEngine]
  );

  const handleToggleAutoRotate = useCallback(() => {
    setAutoRotateMaps((prev) => !prev);
    const engine = getEngine();
    engine?.playUiClick('click');
  }, [getEngine]);

  const handleStartRace = useCallback(
    (overrideMapId?: MapId) => {
      requestLandscapeMode();
      const engine = getEngine();
      const targetMapId = normalizeMapId(overrideMapId ?? selectedMapId);
      if (targetMapId !== selectedMapId) {
        setSelectedMapId(targetMapId);
      }
      if (engine) {
        if (engine.getMap?.() !== targetMapId) {
          engine.setMap?.(targetMapId);
        }
        engine.startRace();
      }
      setGameState('RACE');
    },
    [getEngine, selectedMapId, requestLandscapeMode]
  );

  const handleOpenGarage = useCallback(() => {
    setGameState('GARAGE');
  }, []);

  const handlePreviewKit = useCallback(
    (
      kit: BodyKitSpec,
      rimId: RimId,
      spoilerId: SpoilerId,
      paintHex?: string | null
    ) => {
      const engine = getEngine();
      if (engine) {
        engine.playUiClick('click');
        engine.setBodyKit(kit.id, kit.physics, {
          rimId,
          spoilerId,
          paintHex: paintHex !== undefined ? paintHex : null,
        });
      }
    },
    [getEngine]
  );

  const handleSelectKit = useCallback(
    (
      kit: BodyKitSpec,
      rimId: RimId,
      spoilerId: SpoilerId,
      paintHex?: string | null
    ) => {
      const engine = getEngine();
      if (!unlockedKits.includes(kit.id)) {
        if (coins < kit.unlockCost) {
          return;
        }
        setCoins((prev) => prev - kit.unlockCost);
        setUnlockedKits((prev) => [...prev, kit.id]);
      }
      const nextPaint = paintHex !== undefined ? paintHex : null;
      setEquippedKitId(kit.id);
      setEquippedRimId(rimId);
      setEquippedSpoilerId(spoilerId);
      setEquippedPaintHex(nextPaint);
      if (engine) {
        engine.playUiClick('equip');
        engine.setBodyKit(kit.id, kit.physics, {
          rimId,
          spoilerId,
          paintHex: nextPaint,
        });
      }
    },
    [coins, unlockedKits, getEngine]
  );

  const handleToggleAudio = useCallback(() => {
    const engine = getEngine();
    if (engine) {
      const nextState = engine.toggleAudio();
      setAudioEnabled(nextState);
    }
  }, [getEngine]);

  const handleResetCoins = useCallback(() => {
    setCoins((prev) => Math.max(prev, DEFAULT_COINS));
  }, []);

  const handleTriggerFinishDemo = useCallback(() => {
    const engine = getEngine();
    if (engine) {
      engine.completeRaceDemo();
    }
  }, [getEngine]);

  const completedMapSpec: MapSpec =
    MAP_SPECS.find((m) => m.id === (raceResult.mapId || selectedMapId)) || MAP_SPECS[0];
  const nextMapSpec: MapSpec = autoRotateMaps ? activeMapSpec : completedMapSpec;

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none pointer-events-none">
      {/* STATE 1: SPLASH SCREEN */}
      {gameState === 'SPLASH' && <SplashScreen onComplete={handleSplashComplete} />}

      {/* STATE 2: MAIN MENU & 3D SHOWROOM */}
      {gameState === 'MENU' && (
        <MainMenu
          coins={coins}
          equippedKit={equippedKit}
          selectedMapId={selectedMapId}
          autoRotateMaps={autoRotateMaps}
          onSelectMap={handleSelectMap}
          onToggleAutoRotate={handleToggleAutoRotate}
          onStartRace={() => handleStartRace()}
          onOpenGarage={handleOpenGarage}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* STATE 3: GARAGE & CUSTOMIZATION SHELL */}
      {gameState === 'GARAGE' && (
        <GarageScreen
          coins={coins}
          equippedKitId={equippedKitId}
          equippedRimId={equippedRimId}
          equippedSpoilerId={equippedSpoilerId}
          equippedPaintHex={equippedPaintHex}
          unlockedKits={unlockedKits}
          onSelectKit={handleSelectKit}
          onPreviewKit={handlePreviewKit}
          onBackToMenu={() => {
            const engine = getEngine();
            if (engine) {
              engine.setBodyKit(equippedKit.id, equippedKit.physics, {
                rimId: equippedRimId,
                spoilerId: equippedSpoilerId,
                paintHex: equippedPaintHex,
              });
            }
            setGameState('MENU');
          }}
          onStartRace={() => handleStartRace()}
        />
      )}

      {/* STATE 4: ACTIVE 3D RACE & STRICT LANDSCAPE HUD */}
      {gameState === 'RACE' && (
        <RaceHUD
          telemetry={telemetry}
          equippedKit={equippedKit}
          currentMap={activeMapSpec}
          onOpenMenu={() => setGameState('MENU')}
          onOpenSettings={() => setSettingsOpen(true)}
          onTriggerFinishDemo={handleTriggerFinishDemo}
        />
      )}

      {/* STATE 5: GAMEOVER / RACE RESULTS */}
      {gameState === 'GAMEOVER' && (
        <GameOverScreen
          result={raceResult}
          coins={coins}
          equippedKit={equippedKit}
          currentMap={completedMapSpec}
          nextMap={nextMapSpec}
          autoRotateMaps={autoRotateMaps}
          onRetryRace={() => handleStartRace(nextMapSpec.id)}
          onOpenGarage={handleOpenGarage}
          onMainMenu={() => setGameState('MENU')}
        />
      )}

      {/* GLOBAL SETTINGS MODAL */}
      {settingsOpen && (
        <SettingsModal
          audioEnabled={audioEnabled}
          onToggleAudio={handleToggleAudio}
          onResetCoins={handleResetCoins}
          onBackToMenu={() => {
            setSettingsOpen(false);
            const engine = getEngine();
            if (engine) {
              engine.clearTouchControls();
              engine.setBodyKit(equippedKit.id, equippedKit.physics, {
                rimId: equippedRimId,
                spoilerId: equippedSpoilerId,
                paintHex: equippedPaintHex,
              });
            }
            setGameState('MENU');
          }}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </div>
  );
}
