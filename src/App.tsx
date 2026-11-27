import React, { useEffect, useState, useCallback, useRef } from 'react';
import { App as CapacitorApp } from '@capacitor/app';
import {
  BODY_KITS,
  BodyKitId,
  BodyKitSpec,
  CarUpgradeLevels,
  DAILY_STREAK_REWARDS,
  DEFAULT_CAREER_STATE,
  DEFAULT_CAR_UPGRADES,
  DailyStreakState,
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
  getUpgradeCost,
  normalizeCarId,
  normalizeMapId,
  normalizeWeatherMode,
  pickAutoWeatherForMap,
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
const STORAGE_ECONOMY_V2_KEY = 'the_race_3d_economy_v2';
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
const STORAGE_DAILY_STREAK_KEY = 'the_race_3d_daily_streak_v1';

const DEFAULT_COINS = 25000;

function getLocalDateStamp(dateObj: Date = new Date()): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getYesterdayDateStamp(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return getLocalDateStamp(d);
}

function loadDailyStreakState(): DailyStreakState {
  const today = getLocalDateStamp();
  const yesterday = getYesterdayDateStamp();
  try {
    const raw = window.localStorage.getItem(STORAGE_DAILY_STREAK_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const lastDate = typeof parsed?.lastClaimDate === 'string' ? parsed.lastClaimDate : null;
      const savedDay = Math.min(7, Math.max(1, Number(parsed?.streakDay) || 1));
      if (lastDate === today) {
        return {
          streakDay: savedDay,
          claimedToday: true,
          todayReward: DAILY_STREAK_REWARDS[savedDay - 1] ?? 100,
          lastClaimDate: lastDate,
        };
      }
      if (lastDate === yesterday) {
        const nextDay = savedDay >= 7 ? 1 : savedDay + 1;
        return {
          streakDay: nextDay,
          claimedToday: false,
          todayReward: DAILY_STREAK_REWARDS[nextDay - 1] ?? 100,
          lastClaimDate: lastDate,
        };
      }
    }
  } catch {
    // ignore storage errors
  }
  return {
    streakDay: 1,
    claimedToday: false,
    todayReward: DAILY_STREAK_REWARDS[0],
    lastClaimDate: null,
  };
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>('SPLASH');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);

  // Persistent Player Coins (Default 25,000 + one-time v2 economy migration for legacy small saves)
  const [coins, setCoins] = useState<number>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_COINS_KEY);
      const migrated = window.localStorage.getItem(STORAGE_ECONOMY_V2_KEY);
      if (saved !== null) {
        const parsed = parseInt(saved, 10);
        if (!Number.isNaN(parsed) && parsed >= 0) {
          if (!migrated) {
            const upgraded = parsed < 5000 ? Math.max(DEFAULT_COINS, parsed * 50) : parsed;
            window.localStorage.setItem(STORAGE_ECONOMY_V2_KEY, '1');
            window.localStorage.setItem(STORAGE_COINS_KEY, String(upgraded));
            return upgraded;
          }
          return parsed;
        }
      }
      window.localStorage.setItem(STORAGE_ECONOMY_V2_KEY, '1');
    } catch {
      // ignore storage errors
    }
    return DEFAULT_COINS;
  });

  // Persistent Unlocked Kits (always includes AAA showcase supercar 'ferrari' + starter 'coupe')
  const [unlockedKits, setUnlockedKits] = useState<BodyKitId[]>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_UNLOCKED_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const mapped = parsed.map((id) => normalizeCarId(id));
          if (!mapped.includes('coupe')) mapped.unshift('coupe');
          if (!mapped.includes('ferrari')) mapped.unshift('ferrari');
          return Array.from(new Set(mapped));
        }
      }
    } catch {
      // ignore
    }
    return ['ferrari', 'coupe', 's64'];
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

  // Persistent Career Progress, XP, Missions & Track Records (strictly separate PB per circuit)
  const [career, setCareer] = useState<PlayerCareerState>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_CAREER_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          const rawRecords = {
            ...DEFAULT_CAREER_STATE.trackRecords,
            ...(parsed.trackRecords || {}),
          };
          const mapIds: MapId[] = ['coast', 'city', 'canyon'];
          // Detect any legacy shared bestLap value (e.g. 12.35s leaked across multiple tracks)
          const lapCounts = new Map<string, number>();
          for (const id of mapIds) {
            const b = rawRecords[id]?.bestLap;
            if (typeof b === 'number' && b > 0) {
              const key = b.toFixed(2);
              lapCounts.set(key, (lapCounts.get(key) || 0) + 1);
            }
          }
          const sanitizedRecords: Record<MapId, typeof DEFAULT_CAREER_STATE.trackRecords.coast> = {
            coast: { ...DEFAULT_CAREER_STATE.trackRecords.coast, ...(rawRecords.coast || {}) },
            city: { ...DEFAULT_CAREER_STATE.trackRecords.city, ...(rawRecords.city || {}) },
            canyon: { ...DEFAULT_CAREER_STATE.trackRecords.canyon, ...(rawRecords.canyon || {}) },
          };
          for (const id of mapIds) {
            const rec = sanitizedRecords[id];
            const b = rec.bestLap;
            if (typeof b === 'number') {
              const key = b.toFixed(2);
              if (b <= 3.0 || (lapCounts.get(key) || 0) > 1 || (rec.racesCompleted || 0) === 0) {
                rec.bestLap = null;
              }
            }
          }
          return {
            ...DEFAULT_CAREER_STATE,
            ...parsed,
            trackRecords: sanitizedRecords,
          };
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_CAREER_STATE;
  });

  // Persistent Day 1–7 Daily Login Streak
  const [dailyStreak, setDailyStreak] = useState<DailyStreakState>(() => loadDailyStreakState());

  // Persistent Equipped Body Kit (defaults to AAA 'ferrari' showcase on first launch)
  const [equippedKitId, setEquippedKitId] = useState<BodyKitId>(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KIT_KEY) as BodyKitId | null;
      return saved ? normalizeCarId(saved) : 'ferrari';
    } catch {
      // ignore
    }
    return 'ferrari';
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

  // Automatic Environment / Weather State (dynamically chosen by system per circuit & race)
  const weatherSeedRef = useRef<number>(Math.floor(Math.random() * 6));
  const [weatherMode, setWeatherMode] = useState<WeatherMode>(() =>
    pickAutoWeatherForMap(selectedMapId, weatherSeedRef.current)
  );

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
    coinsEarned: 15000,
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
        const activeModeId = finishData.modeId || selectedModeIdRef.current;
        const activeMode =
          RACE_MODES.find((m) => m.id === activeModeId) || RACE_MODES[0];
        const completedMapId = normalizeMapId(
          engine.getMap?.() || selectedMapIdRef.current
        );
        const mapSpec =
          MAP_SPECS.find((m) => m.id === completedMapId) || MAP_SPECS[0];
        const driftScore = Math.round(finishData.driftScore || 0);
        const isEliminated = Boolean(finishData.eliminated);

        let effectiveRank = Math.min(4, Math.max(1, finishData.finishRank || 1));
        let starsEarned = 1;
        let isWin = false;

        if (activeMode.id === 'elimination') {
          if (isEliminated) {
            effectiveRank = Math.min(4, Math.max(2, finishData.finishRank || 4));
            starsEarned = effectiveRank === 2 ? 1 : 0;
            isWin = false;
          } else {
            effectiveRank = finishData.finishRank || 1;
            starsEarned = effectiveRank === 1 ? 3 : effectiveRank === 2 ? 2 : 1;
            isWin = effectiveRank === 1;
          }
        } else if (activeMode.id === 'drift') {
          if (driftScore >= 5000) {
            starsEarned = 3;
            effectiveRank = 1;
            isWin = true;
          } else if (driftScore >= 3000) {
            starsEarned = 2;
            effectiveRank = 2;
            isWin = false;
          } else if (driftScore >= 1500) {
            starsEarned = 1;
            effectiveRank = 3;
            isWin = false;
          } else {
            starsEarned = 0;
            effectiveRank = 4;
            isWin = false;
          }
        } else if (activeMode.id === 'time_attack') {
          const goldTarget = mapSpec.goldTargetSec;
          const silverTarget = goldTarget + 8;
          const bronzeTarget = goldTarget + 16;
          if (finishData.totalTime <= goldTarget) {
            starsEarned = 3;
            effectiveRank = 1;
            isWin = true;
          } else if (finishData.totalTime <= silverTarget) {
            starsEarned = 2;
            effectiveRank = 2;
            isWin = false;
          } else if (finishData.totalTime <= bronzeTarget) {
            starsEarned = 1;
            effectiveRank = 3;
            isWin = false;
          } else {
            starsEarned = 0;
            effectiveRank = 4;
            isWin = false;
          }
        } else {
          // Circuit Race
          starsEarned =
            effectiveRank === 1 && finishData.totalTime <= mapSpec.goldTargetSec + 10
              ? 3
              : effectiveRank <= 2
                ? 2
                : 1;
          isWin = effectiveRank === 1;
        }

        if (isWin) {
          engine.playVictoryVoice?.();
        } else if (isEliminated || starsEarned === 0 || effectiveRank >= 4) {
          engine.playGameOverVoice?.();
        }

        const rankReward =
          effectiveRank === 1
            ? 12000
            : effectiveRank === 2
              ? 8000
              : effectiveRank === 3
                ? 5000
                : 2500;
        const speedBonus =
          activeMode.id === 'drift'
            ? Math.min(4500, Math.floor(driftScore * 0.75))
            : finishData.totalTime < 55
              ? 3500
              : finishData.totalTime < 70
                ? 2000
                : 1000;
        const totalReward = Math.round(
          (rankReward + speedBonus) * activeMode.rewardMultiplier
        );
        const xpEarned =
          effectiveRank === 1 ? 140 : effectiveRank === 2 ? 105 : effectiveRank === 3 ? 80 : 55;

        const validRaceLaps = Array.isArray(finishData.lapTimes)
          ? finishData.lapTimes.filter((t) => typeof t === 'number' && Number.isFinite(t) && t > 3.0)
          : [];
        const currentRaceBestLap =
          validRaceLaps.length > 0
            ? Math.min(...validRaceLaps)
            : typeof finishData.bestLap === 'number' && finishData.bestLap > 3.0
              ? finishData.bestLap
              : 0;

        setCoins((prev) => prev + totalReward);
        setCareer((prev) => {
          const prevRec =
            prev.trackRecords[completedMapId] ||
            DEFAULT_CAREER_STATE.trackRecords[completedMapId];
          const nextBestLap =
            !isEliminated && currentRaceBestLap > 0
              ? prevRec.bestLap === null
                ? currentRaceBestLap
                : Math.min(prevRec.bestLap, currentRaceBestLap)
              : prevRec.bestLap;
          const nextBestTotal =
            !isEliminated && finishData.totalTime > 0
              ? prevRec.bestTotalTime === null
                ? finishData.totalTime
                : Math.min(prevRec.bestTotalTime, finishData.totalTime)
              : prevRec.bestTotalTime;
          const nextMapsRaced = prev.mapsRaced.includes(completedMapId)
            ? prev.mapsRaced
            : [...prev.mapsRaced, completedMapId];

          return {
            ...prev,
            xp: prev.xp + xpEarned,
            totalRaces: prev.totalRaces + 1,
            totalWins: prev.totalWins + (isWin ? 1 : 0),
            mapsRaced: nextMapsRaced,
            bestSingleRaceTime:
              !isEliminated && finishData.totalTime > 0
                ? prev.bestSingleRaceTime === null
                  ? finishData.totalTime
                  : Math.min(prev.bestSingleRaceTime, finishData.totalTime)
                : prev.bestSingleRaceTime,
            trackRecords: {
              ...prev.trackRecords,
              [completedMapId]: {
                bestLap: nextBestLap,
                bestTotalTime: nextBestTotal,
                bestStars: Math.max(prevRec.bestStars, starsEarned),
                racesCompleted: prevRec.racesCompleted + 1,
                wins: prevRec.wins + (isWin ? 1 : 0),
              },
            },
          };
        });

        setRaceResult({
          totalTime: finishData.totalTime,
          bestLap: currentRaceBestLap,
          lapTimes: finishData.lapTimes,
          coinsEarned: totalReward,
          xpEarned,
          starsEarned,
          finishRank: effectiveRank,
          mapId: completedMapId,
          modeId: activeMode.id,
          driftScore,
          eliminated: isEliminated,
        });

        if (autoRotateMapsRef.current) {
          const nextMapId = getNextRotatedMapId(completedMapId);
          setSelectedMapId(nextMapId);
          weatherSeedRef.current += 1;
          setWeatherMode(pickAutoWeatherForMap(nextMapId, weatherSeedRef.current));
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
      weatherSeedRef.current += 1;
      const autoWeather = pickAutoWeatherForMap(normalized, weatherSeedRef.current);
      setWeatherMode(autoWeather);
      const engine = getEngine();
      if (engine) {
        engine.playUiClick('click');
        if (engine.getMap?.() !== normalized) {
          engine.setMap?.(normalized);
        }
        engine.setWeather?.(autoWeather);
      }
    },
    [getEngine]
  );

  const handleSelectMode = useCallback(
    (modeId: RaceModeId) => {
      setSelectedModeId(modeId);
      const engine = getEngine();
      if (engine) {
        engine.playUiClick('click');
        engine.setRaceMode?.(modeId);
      }
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
      weatherSeedRef.current += 1;
      const autoWeather = pickAutoWeatherForMap(targetMapId, weatherSeedRef.current);
      setWeatherMode(autoWeather);
      if (engine) {
        if (engine.getMap?.() !== targetMapId) {
          engine.setMap?.(targetMapId);
        }
        engine.setWeather?.(autoWeather);
        engine.setRaceMode?.(selectedModeId);
        engine.startRace(selectedModeId);
      }
      setGameState('RACE');
    },
    [getEngine, selectedMapId, selectedModeId, requestLandscapeMode]
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
      let justUnlockedCar = false;
      if (!unlockedKits.includes(kit.id)) {
        if (coins < kit.unlockCost) {
          return;
        }
        setCoins((prev) => prev - kit.unlockCost);
        setUnlockedKits((prev) => [...prev, kit.id]);
        justUnlockedCar = true;
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
        if (justUnlockedCar) {
          engine.playUnlockOrStuntVoice?.();
        } else {
          engine.playCarRevPreview?.(kit.id);
        }
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

  const handleClaimDailyReward = useCallback(() => {
    if (dailyStreak.claimedToday) return;
    const today = getLocalDateStamp();
    const reward = DAILY_STREAK_REWARDS[dailyStreak.streakDay - 1] ?? 5000;
    const nextState: DailyStreakState = {
      streakDay: dailyStreak.streakDay,
      claimedToday: true,
      todayReward: reward,
      lastClaimDate: today,
    };
    setDailyStreak(nextState);
    setCoins((prev) => prev + reward);
    try {
      window.localStorage.setItem(
        STORAGE_DAILY_STREAK_KEY,
        JSON.stringify({ streakDay: nextState.streakDay, lastClaimDate: today })
      );
    } catch {
      // ignore storage errors
    }
    getEngine()?.playUiClick('equip');
  }, [dailyStreak, getEngine]);

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
          unlockedCount={unlockedKits.length}
          claimableMissionsCount={claimableMissionsCount}
          dailyStreak={dailyStreak}
          onClaimDailyReward={handleClaimDailyReward}
          selectedMapId={selectedMapId}
          selectedModeId={selectedModeId}
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
          onOpenGarage={handleOpenGarage}
        />
      )}

      {/* STATE 6: ACTIVE 3D RACE & LANDSCAPE HUD */}
      {gameState === 'RACE' && (
        <RaceHUD
          telemetry={telemetry}
          equippedKit={equippedKit}
          currentMap={activeMapSpec}
          raceMode={selectedModeId}
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
