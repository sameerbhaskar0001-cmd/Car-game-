import React, { useEffect, useState, useCallback, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  BODY_KITS,
  BodyKitId,
  BodyKitSpec,
  CarUpgradeLevels,
  DEFAULT_CAREER_STATE,
  DEFAULT_CAR_UPGRADES,
  GameState,
  MAP_SPECS,
  MISSIONS_LIST,
  MapId,
  MapSpec,
  MissionSpec,
  PlayerCareerState,
  RACE_MODES,
  RaceFinishResult,
  RaceModeId,
  RaceTelemetry,
  RimId,
  SpoilerId,
  TheRaceEngineBridge,
  UpgradePartKey,
  WeatherMode,
  getDriverLevelInfo,
  getEffectiveCarPerformance,
  getNextRotatedMapId,
  getNextWeatherMode,
  getUpgradeCost,
  normalizeCarId,
  normalizeMapId,
  normalizeWeatherMode,
} from './types/game';
import { SplashScreen } from './components/SplashScreen';
import { MainMenu } from './components/MainMenu';
import { EventsScreen } from './components/EventsScreen';
import { GarageScreen } from './components/GarageScreen';
import { MissionsScreen } from './components/MissionsScreen';
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
const STORAGE_MODE_KEY = 'the_race_3d_selected_mode_v1';
const STORAGE_AUTO_ROTATE_KEY = 'the_race_3d_auto_rotate_v1';
const STORAGE_WEATHER_KEY = 'the_race_3d_weather_v1';
const STORAGE_UPGRADES_KEY = 'the_race_3d_car_upgrades_v1';
const STORAGE_CAREER_KEY = 'the_race_3d_career_v1';

const DEFAULT_COINS = 500;

export default function App() {
  const [gameState, setGameState] = useState<GameState>('SPLASH');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

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

  // Persistent Car Performance Upgrades (per BodyKitId)
  const [carUpgradesMap, setCarUpgradesMap] = useState<
    Partial<Record<BodyKitId, CarUpgradeLevels>>
  >(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_UPGRADES_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') return parsed;
      }
    } catch {
      // ignore
    }
    return {};
  });

  // Persistent Career Progress, XP, Missions & Track Records
  const [career, setCareer] = useState<PlayerCareerState>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_CAREER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          return {
            ...DEFAULT_CAREER_STATE,
            ...parsed,
            trackRecords: {
              ...DEFAULT_CAREER_STATE.trackRecords,
              ...(parsed.trackRecords || {}),
            },
          };
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_CAREER_STATE;
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

  const equippedPerformance = getEffectiveCarPerformance(
    equippedKit,
    carUpgradesMap[equippedKit.id] || DEFAULT_CAR_UPGRADES
  );

  // Persistent Equipped Rim, Spoiler & Paint
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

  // Persistent Selected Race Mode
  const [selectedModeId, setSelectedModeId] = useState<RaceModeId>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_MODE_KEY) as RaceModeId | null;
      if (saved && RACE_MODES.some((m) => m.id === saved)) return saved;
    } catch {
      // ignore
    }
    return 'circuit';
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

  // Persistent Weather Preset
  const [weatherMode, setWeatherMode] = useState<WeatherMode>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_WEATHER_KEY);
      if (saved) return normalizeWeatherMode(saved);
    } catch {
      // ignore
    }
    return 'dust';
  });

  const selectedMapIdRef = useRef<MapId>(selectedMapId);
  const selectedModeIdRef = useRef<RaceModeId>(selectedModeId);
  const autoRotateMapsRef = useRef<boolean>(autoRotateMaps);
  selectedMapIdRef.current = selectedMapId;
  selectedModeIdRef.current = selectedModeId;
  autoRotateMapsRef.current = autoRotateMaps;

  const activeMapSpec: MapSpec =
    MAP_SPECS.find((m) => m.id === selectedMapId) || MAP_SPECS[0];

  const driverLevel = getDriverLevelInfo(career.xp);
  const claimableMissionsCount = MISSIONS_LIST.filter((m) => {
    if (career.claimedMissionIds.includes(m.id)) return false;
    return m.getProgress(career, unlockedKits.length) >= m.target;
  }).length;

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
    audioEnabled: true,
    positionRank: 1,
    rivals: [],
  });

  // Last Completed Race Result
  const [raceResult, setRaceResult] = useState<RaceFinishResult>({
    totalTime: 52.45,
    bestLap: 16.82,
    lapTimes: [18.12, 17.51, 16.82],
    coinsEarned: 250,
    xpEarned: 120,
    starsEarned: 3,
    finishRank: 1,
    modeId: 'circuit',
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

  // Persist car upgrades
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_UPGRADES_KEY, JSON.stringify(carUpgradesMap));
    } catch {
      // ignore
    }
  }, [carUpgradesMap]);

  // Persist career state
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_CAREER_KEY, JSON.stringify(career));
    } catch {
      // ignore
    }
  }, [career]);

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

  // Persist selected race mode
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_MODE_KEY, selectedModeId);
    } catch {
      // ignore
    }
  }, [selectedModeId]);

  // Persist auto-rotate toggle
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_AUTO_ROTATE_KEY, String(autoRotateMaps));
    } catch {
      // ignore
    }
  }, [autoRotateMaps]);

  // Persist weather preset and synchronize with 3D engine
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_WEATHER_KEY, weatherMode);
    } catch {
      // ignore
    }

    const syncWeather = () => {
      const engine = getEngine();
      if (!engine || !engine.setWeather) return false;
      if (engine.getWeather?.() !== weatherMode) {
        engine.setWeather(weatherMode);
      }
      return true;
    };

    if (!syncWeather()) {
      const interval = window.setInterval(() => {
        if (syncWeather()) {
          window.clearInterval(interval);
        }
      }, 100);
      return () => window.clearInterval(interval);
    }
  }, [weatherMode, getEngine]);

  // Keep React weather state in sync when toggled via keyboard shortcut (T)
  useEffect(() => {
    const onExternalWeather = (e: Event) => {
      const detail = (e as CustomEvent<string>).detail;
      if (detail) {
        setWeatherMode(normalizeWeatherMode(detail));
      }
    };
    window.addEventListener('the-race-weather-change', onExternalWeather);
    return () => {
      window.removeEventListener('the-race-weather-change', onExternalWeather);
    };
  }, []);

  // Synchronize GameState with 3D Engine
  useEffect(() => {
    const syncScreen = () => {
      const engine = getEngine();
      if (!engine) return false;
      engine.setScreen(gameState);
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

  // Synchronize Equipped Car Kit / Upgraded Physics / Visual Parts
  useEffect(() => {
    const syncKit = () => {
      const engine = getEngine();
      if (!engine) return false;
      const perf = getEffectiveCarPerformance(
        equippedKit,
        carUpgradesMap[equippedKit.id] || DEFAULT_CAR_UPGRADES
      );
      engine.setBodyKit(equippedKit.id, perf.physics, {
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
  }, [
    equippedKit,
    equippedRimId,
    equippedSpoilerId,
    equippedPaintHex,
    carUpgradesMap,
    getEngine,
  ]);

  // Subscribe to 3D Engine Telemetry & Race Finish Events
  useEffect(() => {
    let unsubscribeTelemetry: (() => void) | null = null;
    let unsubscribeFinish: (() => void) | null = null;

    const attachListeners = () => {
      const engine = getEngine();
      if (!engine) return false;

      unsubscribeTelemetry = engine.onTelemetry((data) => {
        setTelemetry(data);
      });

      unsubscribeFinish = engine.onRaceFinish((finishData) => {
        const rank = finishData.finishRank || 1;
        const activeMode =
          RACE_MODES.find((m) => m.id === selectedModeIdRef.current) || RACE_MODES[0];
        const rankReward = rank === 1 ? 300 : rank === 2 ? 200 : rank === 3 ? 120 : 60;
        const speedBonus =
          finishData.totalTime < 55 ? 50 : finishData.totalTime < 70 ? 25 : 10;
        const totalReward = Math.round(
          (rankReward + speedBonus) * activeMode.rewardMultiplier
        );
        const xpEarned = rank === 1 ? 140 : rank === 2 ? 105 : rank === 3 ? 80 : 55;
        const completedMapId = normalizeMapId(
          engine.getMap?.() || selectedMapIdRef.current
        );
        const mapSpec =
          MAP_SPECS.find((m) => m.id === completedMapId) || MAP_SPECS[0];
        const starsEarned =
          rank === 1 && finishData.totalTime <= mapSpec.goldTargetSec + 10
            ? 3
            : rank <= 2
              ? 2
              : 1;

        setCoins((prev) => prev + totalReward);
        setCareer((prev) => {
          const prevRec =
            prev.trackRecords[completedMapId] ||
            DEFAULT_CAREER_STATE.trackRecords[completedMapId];
          const nextBestLap =
            prevRec.bestLap === null
              ? finishData.bestLap
              : Math.min(prevRec.bestLap, finishData.bestLap);
          const nextBestTotal =
            prevRec.bestTotalTime === null
              ? finishData.totalTime
              : Math.min(prevRec.bestTotalTime, finishData.totalTime);
          const nextMapsRaced = prev.mapsRaced.includes(completedMapId)
            ? prev.mapsRaced
            : [...prev.mapsRaced, completedMapId];

          return {
            ...prev,
            xp: prev.xp + xpEarned,
            totalRaces: prev.totalRaces + 1,
            totalWins: prev.totalWins + (rank === 1 ? 1 : 0),
            mapsRaced: nextMapsRaced,
            bestSingleRaceTime:
              prev.bestSingleRaceTime === null
                ? finishData.totalTime
                : Math.min(prev.bestSingleRaceTime, finishData.totalTime),
            trackRecords: {
              ...prev.trackRecords,
              [completedMapId]: {
                bestLap: nextBestLap,
                bestTotalTime: nextBestTotal,
                bestStars: Math.max(prevRec.bestStars, starsEarned),
                racesCompleted: prevRec.racesCompleted + 1,
                wins: prevRec.wins + (rank === 1 ? 1 : 0),
              },
            },
          };
        });

        setRaceResult({
          totalTime: finishData.totalTime,
          bestLap: finishData.bestLap,
          lapTimes: finishData.lapTimes,
          coinsEarned: totalReward,
          xpEarned,
          starsEarned,
          finishRank: rank,
          mapId: completedMapId,
          modeId: activeMode.id,
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

  // Hardware Back Button Listener on Android + Escape key
  useEffect(() => {
    let listenerPromise: ReturnType<typeof CapacitorApp.addListener> | null = null;

    const handleBackAction = () => {
      if (settingsOpen) {
        setSettingsOpen(false);
        return;
      }
      if (
        gameState === 'EVENTS' ||
        gameState === 'GARAGE' ||
        gameState === 'MISSIONS' ||
        gameState === 'RACE' ||
        gameState === 'GAMEOVER'
      ) {
        const engine = getEngine();
        if (engine) {
          engine.clearTouchControls();
          const perf = getEffectiveCarPerformance(
            equippedKit,
            carUpgradesMap[equippedKit.id] || DEFAULT_CAR_UPGRADES
          );
          engine.setBodyKit(equippedKit.id, perf.physics, {
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
  }, [
    settingsOpen,
    gameState,
    equippedKit,
    equippedRimId,
    equippedSpoilerId,
    equippedPaintHex,
    carUpgradesMap,
    getEngine,
  ]);

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
      // Ignore fullscreen/orientation lock rejections
    }
  }, []);

  // Prevent browser gesture scrolling during gameplay
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

  const handleSelectMode = useCallback(
    (modeId: RaceModeId) => {
      setSelectedModeId(modeId);
      getEngine()?.playUiClick('click');
    },
    [getEngine]
  );

  const handleToggleAutoRotate = useCallback(() => {
    setAutoRotateMaps((prev) => !prev);
    getEngine()?.playUiClick('click');
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

  const handleOpenEvents = useCallback(() => {
    getEngine()?.playUiClick('click');
    setGameState('EVENTS');
  }, [getEngine]);

  const handleOpenGarage = useCallback(() => {
    getEngine()?.playUiClick('click');
    setGameState('GARAGE');
  }, [getEngine]);

  const handleOpenMissions = useCallback(() => {
    getEngine()?.playUiClick('click');
    setGameState('MISSIONS');
  }, [getEngine]);

  const handlePreviewKit = useCallback(
    (
      kit: BodyKitSpec,
      rimId: RimId,
      spoilerId: SpoilerId,
      paintHex?: string | null
    ) => {
      const engine = getEngine();
      if (engine) {
        const perf = getEffectiveCarPerformance(
          kit,
          carUpgradesMap[kit.id] || DEFAULT_CAR_UPGRADES
        );
        engine.playUiClick('click');
        engine.setBodyKit(kit.id, perf.physics, {
          rimId,
          spoilerId,
          paintHex: paintHex !== undefined ? paintHex : null,
        });
        engine.playCarRevPreview?.(kit.id);
      }
    },
    [carUpgradesMap, getEngine]
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
        const perf = getEffectiveCarPerformance(
          kit,
          carUpgradesMap[kit.id] || DEFAULT_CAR_UPGRADES
        );
        engine.playUiClick('equip');
        engine.setBodyKit(kit.id, perf.physics, {
          rimId,
          spoilerId,
          paintHex: nextPaint,
        });
        engine.playCarRevPreview?.(kit.id);
      }
    },
    [coins, unlockedKits, carUpgradesMap, getEngine]
  );

  const handleUpgradePart = useCallback(
    (kit: BodyKitSpec, part: UpgradePartKey) => {
      if (!unlockedKits.includes(kit.id)) return;
      const currentLevels = carUpgradesMap[kit.id] || DEFAULT_CAR_UPGRADES;
      const currentLvl = currentLevels[part] || 1;
      const cost = getUpgradeCost(currentLvl);
      if (cost === null || coins < cost) return;

      const nextLevels: CarUpgradeLevels = {
        ...currentLevels,
        [part]: Math.min(5, currentLvl + 1),
      };

      setCoins((prev) => prev - cost);
      setCarUpgradesMap((prev) => ({
        ...prev,
        [kit.id]: nextLevels,
      }));
      setCareer((prev) => ({
        ...prev,
        totalUpgrades: prev.totalUpgrades + 1,
        xp: prev.xp + 35,
      }));

      const engine = getEngine();
      if (engine) {
        engine.playUiClick('equip');
        engine.playCarRevPreview?.(kit.id);
      }
    },
    [unlockedKits, carUpgradesMap, coins, getEngine]
  );

  const handleClaimMission = useCallback(
    (mission: MissionSpec) => {
      if (career.claimedMissionIds.includes(mission.id)) return;
      if (mission.getProgress(career, unlockedKits.length) < mission.target) return;
      setCoins((prev) => prev + mission.rewardCoins);
      setCareer((prev) => ({
        ...prev,
        xp: prev.xp + mission.rewardXp,
        claimedMissionIds: [...prev.claimedMissionIds, mission.id],
      }));
      getEngine()?.playUiClick('equip');
    },
    [career, unlockedKits.length, getEngine]
  );

  const handleSelectWeather = useCallback(
    (mode: WeatherMode) => {
      const normalized = normalizeWeatherMode(mode);
      setWeatherMode(normalized);
      const engine = getEngine();
      if (engine) {
        engine.playUiClick('click');
        engine.setWeather?.(normalized);
      }
    },
    [getEngine]
  );

  const handleCycleWeather = useCallback(() => {
    setWeatherMode((prev) => {
      const next = getNextWeatherMode(prev);
      const engine = getEngine();
      if (engine) {
        engine.playUiClick('click');
        engine.setWeather?.(next);
      }
      return next;
    });
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

      {/* STATE 2: MAIN RACING LOBBY HUB */}
      {gameState === 'MENU' && (
        <MainMenu
          coins={coins}
          driverLevel={driverLevel}
          equippedKit={equippedKit}
          equippedCarClass={equippedPerformance.carClass}
          equippedCarPR={equippedPerformance.pr}
          unlockedCount={unlockedKits.length}
          claimableMissionsCount={claimableMissionsCount}
          selectedMapId={selectedMapId}
          selectedModeId={selectedModeId}
          weatherMode={weatherMode}
          onCycleWeather={handleCycleWeather}
          onStartRace={() => handleStartRace()}
          onOpenEvents={handleOpenEvents}
          onOpenGarage={handleOpenGarage}
          onOpenMissions={handleOpenMissions}
          onOpenSettings={() => setSettingsOpen(true)}
        />
      )}

      {/* STATE 3: RACE EVENTS & CIRCUIT SELECTOR */}
      {gameState === 'EVENTS' && (
        <EventsScreen
          coins={coins}
          selectedMapId={selectedMapId}
          selectedModeId={selectedModeId}
          weatherMode={weatherMode}
          autoRotateMaps={autoRotateMaps}
          trackRecords={career.trackRecords}
          onSelectMap={handleSelectMap}
          onSelectMode={handleSelectMode}
          onSelectWeather={handleSelectWeather}
          onToggleAutoRotate={handleToggleAutoRotate}
          onOpenGarage={handleOpenGarage}
          onBackToMenu={() => setGameState('MENU')}
          onStartRace={(mapId) => handleStartRace(mapId)}
        />
      )}

      {/* STATE 4: 3D GARAGE, PERFORMANCE UPGRADES & CUSTOMIZATION */}
      {gameState === 'GARAGE' && (
        <GarageScreen
          coins={coins}
          equippedKitId={equippedKitId}
          equippedRimId={equippedRimId}
          equippedSpoilerId={equippedSpoilerId}
          equippedPaintHex={equippedPaintHex}
          unlockedKits={unlockedKits}
          carUpgradesMap={carUpgradesMap}
          onSelectKit={handleSelectKit}
          onPreviewKit={handlePreviewKit}
          onUpgradePart={handleUpgradePart}
          onBackToMenu={() => {
            const engine = getEngine();
            if (engine) {
              engine.setBodyKit(equippedKit.id, equippedPerformance.physics, {
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

      {/* STATE 5: DRIVER MISSIONS & CAREER PROGRESSION */}
      {gameState === 'MISSIONS' && (
        <MissionsScreen
          coins={coins}
          driverLevel={driverLevel}
          career={career}
          unlockedCount={unlockedKits.length}
          onClaimMission={handleClaimMission}
          onBackToMenu={() => setGameState('MENU')}
          onOpenEvents={handleOpenEvents}
        />
      )}

      {/* STATE 6: ACTIVE 3D RACE & LANDSCAPE HUD */}
      {gameState === 'RACE' && (
        <RaceHUD
          telemetry={telemetry}
          equippedKit={equippedKit}
          currentMap={activeMapSpec}
          weatherMode={weatherMode}
          onCycleWeather={handleCycleWeather}
          onOpenMenu={() => setGameState('MENU')}
          onOpenSettings={() => setSettingsOpen(true)}
          onTriggerFinishDemo={handleTriggerFinishDemo}
        />
      )}

      {/* STATE 7: POST-RACE STANDINGS & REWARDS */}
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
          weatherMode={weatherMode}
          onChangeWeather={handleSelectWeather}
          onResetCoins={handleResetCoins}
          onBackToMenu={() => {
            setSettingsOpen(false);
            const engine = getEngine();
            if (engine) {
              engine.clearTouchControls();
              engine.setBodyKit(equippedKit.id, equippedPerformance.physics, {
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
