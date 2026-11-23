import React, { useState, useEffect, useCallback } from 'react';
import {
  BodyKitSpec,
  MapSpec,
  RaceTelemetry,
  WEATHER_SPECS,
  WeatherMode,
  formatRaceTime,
} from '../types/game';
import { WeatherIcon } from './WeatherIcon';

interface RaceHUDProps {
  telemetry: RaceTelemetry;
  equippedKit: BodyKitSpec;
  currentMap?: MapSpec;
  weatherMode?: WeatherMode;
  onCycleWeather?: () => void;
  onOpenMenu: () => void;
  onOpenSettings: () => void;
  onTriggerFinishDemo: () => void;
}

export const RaceHUD: React.FC<RaceHUDProps> = ({
  telemetry,
  weatherMode = 'dust',
  onCycleWeather,
  onOpenMenu,
  onOpenSettings,
}) => {
  const activeWeather =
    WEATHER_SPECS.find((w) => w.id === weatherMode) || WEATHER_SPECS[0];
  const [activeControls, setActiveControls] = useState<{
    left: boolean;
    right: boolean;
    forward: boolean;
    backward: boolean;
    drift: boolean;
    nitro: boolean;
  }>({
    left: false,
    right: false,
    forward: false,
    backward: false,
    drift: false,
    nitro: false,
  });

  // Clear all touch controls when unmounting
  useEffect(() => {
    return () => {
      window.__theRaceEngine?.clearTouchControls();
    };
  }, []);

  const setDirectionState = useCallback(
    (dir: 'left' | 'right' | 'forward' | 'backward' | 'drift', isDown: boolean) => {
      setActiveControls((prev) => {
        if (prev[dir] === isDown) return prev;
        return { ...prev, [dir]: isDown };
      });
      window.__theRaceEngine?.setTouchControl(dir, isDown);
    },
    []
  );

  const handleNitroTrigger = useCallback((isDown: boolean) => {
    setActiveControls((prev) => ({ ...prev, nitro: isDown }));
    if (isDown) {
      window.__theRaceEngine?.triggerNitro();
    }
  }, []);

  const isBoosting = telemetry.boostActive > 0.05;
  const isShockwave = Boolean(telemetry.shockwaveActive);
  const isSlipstreaming = Boolean(telemetry.slipstreamActive);
  const autoGasEnabled = telemetry.autoGas ?? true;
  const isHighSpeed = telemetry.speedKmh >= 85 || isBoosting;
  const driftCharge = telemetry.driftCharge ?? 0;
  const driftBoostTier = telemetry.driftBoostTier ?? (driftCharge >= 1.55 ? 3 : driftCharge >= 0.90 ? 2 : driftCharge >= 0.36 ? 1 : 0);
  const driftFillPct = Math.min(100, Math.round((driftCharge / 1.65) * 100));
  const nitroPercent = Math.round(Math.min(1, Math.max(0, telemetry.boostCharge)) * 100);
  const shockwaveReady = nitroPercent >= 75;
  const nitroReady = nitroPercent >= 15;
  const rank = telemetry.positionRank || 1;

  const rankBadgeColor =
    rank === 1
      ? 'from-amber-400 to-yellow-500 border-amber-300 text-slate-950 shadow-[0_0_16px_rgba(251,191,36,0.55)]'
      : rank === 2
        ? 'from-slate-200 to-slate-400 border-white text-slate-950'
        : rank === 3
          ? 'from-amber-700 to-amber-800 border-amber-500 text-white'
          : 'from-slate-800 to-slate-900 border-slate-600 text-slate-300';

  const rankSuffix = rank === 1 ? 'ST' : rank === 2 ? 'ND' : rank === 3 ? 'RD' : 'TH';

  return (
    <div
      className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between select-none touch-none"
      style={{
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.85rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.85rem, env(safe-area-inset-right))',
      }}
    >
      {/* NEON ARCADE SPEED LINES OVERLAY (High Speed >= 85 KM/H or Turbo/Shockwave Boost) */}
      {isHighSpeed && (
        <div
          className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-200"
          style={{
            opacity: isShockwave ? 0.95 : isBoosting ? 0.85 : Math.min(0.55, (telemetry.speedKmh - 80) / 45),
            background: isShockwave
              ? 'radial-gradient(circle at 50% 50%, transparent 52%, rgba(232, 121, 249, 0.28) 84%, rgba(168, 85, 247, 0.48) 100%)'
              : isBoosting
                ? 'radial-gradient(circle at 50% 50%, transparent 56%, rgba(0, 240, 255, 0.22) 86%, rgba(56, 189, 248, 0.42) 100%)'
                : 'radial-gradient(circle at 50% 50%, transparent 64%, rgba(0, 240, 255, 0.12) 90%, rgba(251, 191, 36, 0.22) 100%)',
          }}
        >
          {/* Left & Right Neon Velocity Streaks */}
          <div className="absolute inset-y-8 left-2 w-16 flex flex-col justify-around opacity-80">
            <div className="h-[2px] w-14 bg-gradient-to-r from-cyan-400 to-transparent animate-pulse" />
            <div className="h-[2px] w-10 bg-gradient-to-r from-fuchsia-400 to-transparent" />
            <div className="h-[2px] w-16 bg-gradient-to-r from-cyan-300 to-transparent animate-pulse" />
            <div className="h-[2px] w-12 bg-gradient-to-r from-sky-400 to-transparent" />
          </div>
          <div className="absolute inset-y-8 right-2 w-16 flex flex-col justify-around items-end opacity-80">
            <div className="h-[2px] w-14 bg-gradient-to-l from-cyan-400 to-transparent animate-pulse" />
            <div className="h-[2px] w-10 bg-gradient-to-l from-fuchsia-400 to-transparent" />
            <div className="h-[2px] w-16 bg-gradient-to-l from-cyan-300 to-transparent animate-pulse" />
            <div className="h-[2px] w-12 bg-gradient-to-l from-sky-400 to-transparent" />
          </div>
        </div>
      )}

      {/* TOP BAR: Single-Line Sleek Asphalt HUD (Never wraps or blocks track!) */}
      <header className="flex items-center justify-between gap-2 w-full">
        {/* Top-Left: Compact Menu, Settings, Audio, Auto-Gas Toggle & Position Rank */}
        <div className="pointer-events-auto flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.__theRaceEngine?.clearTouchControls();
              onOpenMenu();
            }}
            style={{ touchAction: 'manipulation' }}
            aria-label="Menu"
            className="w-8 h-8 sm:w-auto sm:px-2.5 rounded-xl bg-slate-950/75 border border-white/20 active:border-cyan-400 font-['Orbitron'] italic font-bold text-[11px] text-white flex items-center justify-center cursor-pointer shadow-lg active:scale-95"
          >
            <span>←</span>
            <span className="hidden sm:inline ml-1">MENU</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            style={{ touchAction: 'manipulation' }}
            aria-label="Settings"
            className="w-8 h-8 rounded-xl bg-slate-950/75 border border-white/20 active:border-cyan-400 text-slate-200 flex items-center justify-center cursor-pointer shadow-lg active:scale-95 text-sm"
          >
            ⚙
          </button>

          {/* Compact Live Weather Toggle */}
          {onCycleWeather && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onCycleWeather();
              }}
              style={{
                touchAction: 'manipulation',
                borderColor: `${activeWeather.accentHex}75`,
              }}
              aria-label={`Weather: ${activeWeather.label}. Tap to cycle weather.`}
              title={`Weather: ${activeWeather.label} (T)`}
              className="h-8 px-2 rounded-xl bg-slate-950/80 border text-slate-100 flex items-center justify-center gap-1 cursor-pointer shadow-lg active:scale-95 transition-colors whitespace-nowrap shrink-0"
            >
              <span style={{ color: activeWeather.accentHex }} className="shrink-0">
                <WeatherIcon mode={weatherMode} className="w-3.5 h-3.5" />
              </span>
              <span className="hidden sm:inline font-['Orbitron'] italic font-extrabold text-[9px] tracking-wider uppercase leading-none">
                {activeWeather.shortLabel}
              </span>
            </button>
          )}

          {/* Compact Auto-Gas / Manual Pedal Toggle */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.__theRaceEngine?.setAutoGas(!autoGasEnabled);
            }}
            style={{ touchAction: 'manipulation' }}
            title="Switch between Asphalt Auto-Gas & Manual Gas Pedal"
            className={`px-2 py-1.5 rounded-xl border font-['Orbitron'] italic font-extrabold text-[9px] tracking-wider uppercase cursor-pointer shadow-lg active:scale-95 transition-colors whitespace-nowrap ${
              autoGasEnabled
                ? 'bg-emerald-950/80 border-emerald-400/70 text-emerald-300'
                : 'bg-slate-950/80 border-amber-400/60 text-amber-300'
            }`}
          >
            {autoGasEnabled ? 'AUTO' : 'PEDAL'}
          </button>

          {/* DYNAMIC POSITION RANK BADGE */}
          <div
            className={`flex items-baseline gap-0.5 px-2.5 py-1 rounded-xl bg-gradient-to-r border font-['Orbitron'] italic font-black shadow-lg ${rankBadgeColor}`}
          >
            <span className="text-base sm:text-lg leading-none">{rank}</span>
            <span className="text-[8px] sm:text-[9px] font-black tracking-widest">
              {rankSuffix}
            </span>
          </div>
        </div>

        {/* Top-Right: Streamlined Speedometer & Lap Counter */}
        <div className="flex items-center gap-2 sm:gap-3 bg-slate-950/75 border border-white/15 rounded-xl px-2.5 py-1 shadow-lg shrink-0">
          <div className="flex items-baseline gap-0.5">
            <span
              className="font-['Orbitron'] italic font-black text-xl sm:text-2xl text-white tabular-nums leading-none"
              style={{
                textShadow: isShockwave
                  ? '0 0 18px rgba(232, 121, 249, 0.98)'
                  : isBoosting
                    ? '0 0 14px rgba(0, 240, 255, 0.95)'
                    : '0 2px 6px rgba(0, 0, 0, 0.95)',
              }}
            >
              {telemetry.speedKmh}
            </span>
            <span className="font-['Orbitron'] italic font-extrabold text-[8px] text-cyan-300 tracking-wider">
              KM/H
            </span>
          </div>

          <div className="flex flex-col items-end border-l border-white/15 pl-2">
            <div className="font-['Orbitron'] italic font-black text-[10px] sm:text-xs tracking-wider text-white leading-none">
              LAP <span className="text-cyan-400">{telemetry.lapCount}</span>/3
            </div>
            <div className="font-mono font-bold text-[9px] sm:text-[11px] text-amber-300 tabular-nums tracking-tight mt-0.5 leading-none">
              {formatRaceTime(telemetry.totalRaceTime || telemetry.currentLapTime)}
            </div>
          </div>
        </div>
      </header>

      {/* SLEEK ASPHALT KINETIC ACTION CALLOUT (No overlapping bounce) */}
      {(telemetry.actionBanner || isSlipstreaming) && telemetry.countdownStep === 0 && (
        <div className="fixed top-12 sm:top-14 inset-x-0 pointer-events-none flex justify-center z-40 px-4">
          <div
            className="px-3.5 py-0.5 rounded-lg bg-slate-950/80 border font-['Orbitron'] italic font-black text-[11px] sm:text-xs tracking-widest uppercase shadow-xl backdrop-blur-sm"
            style={{
              borderColor: telemetry.actionBannerColor || '#00f0ff',
              color: telemetry.actionBannerColor || '#00f0ff',
              boxShadow: `0 0 16px ${telemetry.actionBannerColor || '#00f0ff'}55`,
            }}
          >
            {telemetry.actionBanner || '💨 SLIPSTREAM DRAFT'}
          </div>
        </div>
      )}

      {/* CENTER F1 START COUNTDOWN OVERLAY */}
      {telemetry.countdownStep > 0 && (
        <div className="fixed inset-0 pointer-events-none flex items-center justify-center z-40">
          <div
            className="font-['Orbitron'] italic font-black text-7xl sm:text-8xl text-white animate-pulse"
            style={{
              textShadow:
                '0 0 32px rgba(255, 59, 48, 0.9), 0 6px 20px rgba(0, 0, 0, 0.95)',
            }}
          >
            {telemetry.countdownStep}
          </div>
        </div>
      )}

      {/* ASPHALT 9 CLEAN ERGONOMIC MOBILE CONTROLS (ZERO OVERLAP EVEN ON 340PX PORTRAIT!) */}
      <div className="w-full flex items-end justify-between pb-1.5 sm:pb-2 pointer-events-none">
        {/* BOTTOM-LEFT: CLEAN STEERING ARROWS */}
        <div
          className="pointer-events-auto flex items-center gap-2 sm:gap-3"
          role="group"
          aria-label="Steering Controls"
        >
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDirectionState('left', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDirectionState('left', false);
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDirectionState('left', false);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setDirectionState('left', true);
            }}
            onMouseUp={() => setDirectionState('left', false)}
            onMouseLeave={() => setDirectionState('left', false)}
            aria-label="Steer Left"
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer backdrop-blur-sm ${
              activeControls.left
                ? 'bg-cyan-400/50 border-cyan-200 text-white scale-95 shadow-[0_0_24px_rgba(0,240,255,0.85)]'
                : 'bg-slate-950/45 border-white/25 text-white/95 shadow-lg'
            }`}
          >
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15.5 18.5L8.5 12l7-6.5" />
            </svg>
          </button>

          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDirectionState('right', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDirectionState('right', false);
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDirectionState('right', false);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setDirectionState('right', true);
            }}
            onMouseUp={() => setDirectionState('right', false)}
            onMouseLeave={() => setDirectionState('right', false)}
            aria-label="Steer Right"
            className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer backdrop-blur-sm ${
              activeControls.right
                ? 'bg-cyan-400/50 border-cyan-200 text-white scale-95 shadow-[0_0_24px_rgba(0,240,255,0.85)]'
                : 'bg-slate-950/45 border-white/25 text-white/95 shadow-lg'
            }`}
          >
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8.5 18.5L15.5 12l-7-6.5" />
            </svg>
          </button>
        </div>

        {/* BOTTOM-CENTER: COMPACT 3-TIER LIVE AUTO-DRIFT TURBO METER */}
        {(telemetry.isDrifting || driftCharge > 0.05) && (
          <div className="pointer-events-none flex flex-col items-center mb-1">
            <div
              className={`px-2.5 py-0.5 rounded-full border font-['Orbitron'] italic font-black text-[9px] tracking-wider uppercase shadow-lg ${
                driftBoostTier >= 3
                  ? 'bg-fuchsia-500/40 border-fuchsia-300 text-fuchsia-100 shadow-[0_0_14px_rgba(232,121,249,0.7)]'
                  : driftBoostTier === 2
                    ? 'bg-amber-500/40 border-amber-300 text-amber-100 shadow-[0_0_12px_rgba(251,191,36,0.65)]'
                    : driftBoostTier === 1
                      ? 'bg-cyan-500/35 border-cyan-300 text-cyan-100 shadow-[0_0_10px_rgba(34,211,238,0.6)]'
                      : 'bg-slate-950/75 border-white/30 text-slate-200'
              }`}
            >
              {driftBoostTier >= 3
                ? 'ULTRA DRIFT!'
                : driftBoostTier === 2
                  ? 'SUPER DRIFT!'
                  : driftBoostTier === 1
                    ? 'DRIFT BOOST'
                    : 'DRIFTING'}
            </div>
            <div className="w-20 sm:w-28 h-1.5 rounded-full bg-slate-950/85 border border-white/20 overflow-hidden mt-0.5">
              <div
                className={`h-full transition-all duration-75 ${
                  driftBoostTier >= 3
                    ? 'bg-gradient-to-r from-fuchsia-500 via-pink-400 to-white'
                    : driftBoostTier === 2
                      ? 'bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-200'
                      : driftBoostTier === 1
                        ? 'bg-gradient-to-r from-cyan-400 via-sky-300 to-white'
                        : 'bg-gradient-to-r from-amber-500 to-yellow-300'
                }`}
                style={{ width: `${driftFillPct}%` }}
              />
            </div>
          </div>
        )}

        {/* BOTTOM-RIGHT: AUTO-CARVE DRIFT MEANS ZERO DRIFT BUTTON REQUIRED — SLEEK BRAKE + PROMINENT NITRO/SHOCKWAVE */}
        <div
          className="pointer-events-auto flex items-end gap-2 sm:gap-3"
          role="group"
          aria-label="Driving Controls"
        >
          {/* OPTIONAL COMPACT BRAKE / HAIRPIN FLICK BUTTON */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDirectionState('drift', true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDirectionState('drift', false);
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDirectionState('drift', false);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              setDirectionState('drift', true);
            }}
            onMouseUp={() => setDirectionState('drift', false)}
            onMouseLeave={() => setDirectionState('drift', false)}
            aria-label="Brake or Tight Hairpin Flick"
            className={`w-13 h-13 sm:w-16 sm:h-16 rounded-2xl flex flex-col items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer backdrop-blur-sm ${
              activeControls.drift
                ? 'bg-rose-500/55 border-rose-200 text-white scale-95 shadow-[0_0_20px_rgba(244,63,94,0.85)]'
                : 'bg-slate-950/45 border-white/25 text-slate-300 shadow-lg'
            }`}
          >
            <span className="font-['Orbitron'] italic font-black text-[9px] sm:text-[10px] tracking-wider uppercase leading-none">
              BRAKE
            </span>
          </button>

          {/* NITRO / PURPLE SHOCKWAVE BUTTON */}
          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNitroTrigger(true);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNitroTrigger(false);
            }}
            onTouchCancel={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleNitroTrigger(false);
            }}
            onMouseDown={(e) => {
              e.preventDefault();
              handleNitroTrigger(true);
            }}
            onMouseUp={() => handleNitroTrigger(false)}
            onMouseLeave={() => handleNitroTrigger(false)}
            aria-label="Nitro and Shockwave Boost"
            className={`relative overflow-hidden w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex flex-col items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer backdrop-blur-sm ${
              isShockwave
                ? 'bg-fuchsia-500/90 border-white text-white scale-95 shadow-[0_0_28px_rgba(232,121,249,0.98)]'
                : activeControls.nitro || isBoosting
                  ? 'bg-amber-400/90 border-white text-slate-950 scale-95 shadow-[0_0_24px_rgba(251,191,36,0.95)]'
                  : shockwaveReady
                    ? 'bg-fuchsia-950/75 border-fuchsia-400 text-fuchsia-200 shadow-[0_0_18px_rgba(232,121,249,0.6)] animate-pulse'
                    : nitroReady
                      ? 'bg-slate-950/55 border-cyan-400/80 text-cyan-300 shadow-[0_0_14px_rgba(34,211,238,0.35)]'
                      : 'bg-slate-950/45 border-slate-500/50 text-slate-400 shadow-lg'
            }`}
          >
            <div
              className={`absolute inset-x-0 bottom-0 pointer-events-none transition-all duration-150 ${
                shockwaveReady || isShockwave
                  ? 'bg-gradient-to-t from-fuchsia-500/60 via-purple-500/50 to-cyan-400/40'
                  : 'bg-gradient-to-t from-cyan-500/45 to-amber-400/30'
              }`}
              style={{ height: `${nitroPercent}%` }}
            />
            <svg
              className="relative z-10 w-6 h-6 sm:w-7 sm:h-7"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M13.5 2L5.5 13h5.5l-1.5 9 8.5-11.5h-5.5L13.5 2z" />
            </svg>
            <span className="relative z-10 font-['Orbitron'] italic font-black text-[8px] sm:text-[9px] tracking-wider uppercase mt-0.5">
              {shockwaveReady || isShockwave ? 'SHOCK' : `${nitroPercent}%`}
            </span>
          </button>

          {/* OPTIONAL MANUAL GAS PEDAL (ONLY SHOWN WHEN AUTO GAS IS OFF) */}
          {!autoGasEnabled && (
            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionState('forward', true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionState('forward', false);
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionState('forward', false);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                setDirectionState('forward', true);
              }}
              onMouseUp={() => setDirectionState('forward', false)}
              onMouseLeave={() => setDirectionState('forward', false)}
              aria-label="Accelerate"
              className={`w-14 h-20 sm:w-18 sm:h-24 rounded-2xl flex items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer backdrop-blur-sm ${
                activeControls.forward
                  ? 'bg-emerald-400/55 border-emerald-200 text-white scale-95 shadow-[0_0_24px_rgba(16,185,129,0.9)]'
                  : 'bg-slate-950/50 border-emerald-400/75 text-emerald-300 shadow-lg'
              }`}
            >
              <svg
                className="w-8 h-12 sm:w-10 sm:h-16"
                viewBox="0 0 40 60"
                fill="none"
              >
                <path
                  d="M9 10C9 6.68629 11.6863 4 15 4H27C30.3137 4 33 6.68629 33 10L31 50C31 53.3137 28.3137 56 25 56H13C9.68629 56 7 53.3137 7 50L9 10Z"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  fill="currentColor"
                  fillOpacity="0.16"
                />
                <path
                  d="M14.5 22L20 15.5L25.5 22"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M14.5 31L20 24.5L25.5 31"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity="0.85"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
