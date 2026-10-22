import React, { useEffect, useState, useCallback } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  BODY_KITS,
  BodyKitId,
  BodyKitSpec,
  GameState,
  RaceFinishResult,
  RaceTelemetry,
  RimId,
  SpoilerId,
  TheRaceEngineBridge,
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
const STORAGE_UNLOCKED_KEY = 'the_race_3d_unlocked_kits_v1';

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
          return parsed as BodyKitId[];
        }
      }
    } catch {
      // ignore
    }
    return ['kit1'];
  });

  // Persistent Equipped Body Kit
  const [equippedKitId, setEquippedKitId] = useState<BodyKitId>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KIT_KEY) as BodyKitId | null;
      if (saved && BODY_KITS.some((k) => k.id === saved)) {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'kit1';
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
    heldPowerup: null,
    shieldActive: false,
    spinoutActive: false,
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

  // Persist equipped kit, rim, and spoiler
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KIT_KEY, equippedKitId);
      window.localStorage.setItem(STORAGE_RIM_KEY, equippedRimId);
      window.localStorage.setItem(STORAGE_SPOILER_KEY, equippedSpoilerId);
    } catch {
      // ignore
    }
  }, [equippedKitId, equippedRimId, equippedSpoilerId]);

  const getEngine = useCallback((): TheRaceEngineBridge | undefined => {
    return window.__theRaceEngine;
  }, []);

  // Synchronize GameState and Equipped Body Kit + Rims + Spoiler with the 3D Engine
  useEffect(() => {
    const syncWithEngine = () => {
      const engine = getEngine();
      if (!engine) return false;
      engine.setScreen(gameState);
      engine.setBodyKit(equippedKit.id, equippedKit.physics, {
        rimId: equippedRimId,
        spoilerId: equippedSpoilerId,
      });
      setAudioEnabled(engine.isAudioEnabled());
      return true;
    };

    if (!syncWithEngine()) {
      const interval = window.setInterval(() => {
        if (syncWithEngine()) {
          window.clearInterval(interval);
        }
      }, 100);
      return () => window.clearInterval(interval);
    }
  }, [gameState, equippedKit, equippedRimId, equippedSpoilerId, getEngine]);

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

        setCoins((prev) => prev + totalReward);
        setRaceResult({
          totalTime: finishData.totalTime,
          bestLap: finishData.bestLap,
          lapTimes: finishData.lapTimes,
          coinsEarned: totalReward,
          finishRank: rank,
        });
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
  }, [settingsOpen, gameState, equippedKit, equippedRimId, equippedSpoilerId, getEngine]);

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

  const handleStartRace = useCallback(() => {
    const engine = getEngine();
    setGameState('RACE');
    if (engine) {
      engine.setBodyKit(equippedKit.id, equippedKit.physics, {
        rimId: equippedRimId,
        spoilerId: equippedSpoilerId,
      });
      engine.startRace();
    }
  }, [equippedKit, equippedRimId, equippedSpoilerId, getEngine]);

  const handleOpenGarage = useCallback(() => {
    setGameState('GARAGE');
  }, []);

  const handlePreviewKit = useCallback(
    (kit: BodyKitSpec, rimId: RimId, spoilerId: SpoilerId) => {
      const engine = getEngine();
      if (engine) {
        engine.playUiClick('click');
        engine.setBodyKit(kit.id, kit.physics, { rimId, spoilerId });
      }
    },
    [getEngine]
  );

  const handleSelectKit = useCallback(
    (kit: BodyKitSpec, rimId: RimId, spoilerId: SpoilerId) => {
      const engine = getEngine();
      if (!unlockedKits.includes(kit.id)) {
        if (coins < kit.unlockCost) {
          return;
        }
        setCoins((prev) => prev - kit.unlockCost);
        setUnlockedKits((prev) => [...prev, kit.id]);
      }
      setEquippedKitId(kit.id);
      setEquippedRimId(rimId);
      setEquippedSpoilerId(spoilerId);
      if (engine) {
        engine.playUiClick('equip');
        engine.setBodyKit(kit.id, kit.physics, { rimId, spoilerId });
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

  return (
    <div className="relative w-screen h-screen overflow-hidden select-none pointer-events-none">
      {/* STATE 1: SPLASH SCREEN */}
      {gameState === 'SPLASH' && <SplashScreen onComplete={handleSplashComplete} />}

      {/* STATE 2: MAIN MENU & 3D SHOWROOM */}
      {gameState === 'MENU' && (
        <MainMenu
          coins={coins}
          equippedKit={equippedKit}
          onStartRace={handleStartRace}
          onOpenGarage={handleOpenGarage}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* STATE 3: GARAGE & CUSTOMIZATION SHELL (S64 COMPACT 13-FBX PACK) */}
      {gameState === 'GARAGE' && (
        <GarageScreen
          coins={coins}
          equippedKitId={equippedKitId}
          equippedRimId={equippedRimId}
          equippedSpoilerId={equippedSpoilerId}
          unlockedKits={unlockedKits}
          onSelectKit={handleSelectKit}
          onPreviewKit={handlePreviewKit}
          onBackToMenu={() => {
            const engine = getEngine();
            if (engine) {
              engine.setBodyKit(equippedKit.id, equippedKit.physics, {
                rimId: equippedRimId,
                spoilerId: equippedSpoilerId,
              });
            }
            setGameState('MENU');
          }}
          onStartRace={handleStartRace}
        />
      )}

      {/* STATE 4: ACTIVE 3D RACE & STRICT LANDSCAPE HUD */}
      {gameState === 'RACE' && (
        <RaceHUD
          telemetry={telemetry}
          equippedKit={equippedKit}
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
          onRetryRace={handleStartRace}
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
