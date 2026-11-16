import React, { useState, useEffect, useCallback } from 'react';
import { BodyKitSpec, MapSpec, RaceTelemetry, formatRaceTime } from '../types/game';

interface RaceHUDProps {
  telemetry: RaceTelemetry;
  equippedKit: BodyKitSpec;
  currentMap?: MapSpec;
  onOpenMenu: () => void;
  onOpenSettings: () => void;
  onTriggerFinishDemo: () => void;
}

export const RaceHUD: React.FC<RaceHUDProps> = ({
  telemetry,
  equippedKit,
  currentMap,
  onOpenMenu,
  onOpenSettings,
}) => {
  const [activeControls, setActiveControls] = useState<{
    left: boolean;
    right: boolean;
    forward: boolean;
    backward: boolean;
    nitro: boolean;
  }>({
    left: false,
    right: false,
    forward: false,
    backward: false,
    nitro: false,
  });

  // Clear all touch controls when unmounting
  useEffect(() => {
    return () => {
      window.__theRaceEngine?.clearTouchControls();
    };
  }, []);

  const setDirectionState = useCallback(
    (dir: 'left' | 'right' | 'forward' | 'backward', isDown: boolean) => {
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
  const isHighSpeed = telemetry.speedKmh >= 85 || isBoosting;
  const driftCharge = telemetry.driftCharge ?? 0;
  const driftReady = driftCharge >= 0.38;
  const nitroPercent = Math.round(Math.min(1, Math.max(0, telemetry.boostCharge)) * 100);
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
      {/* NEON ARCADE SPEED LINES OVERLAY (High Speed >= 85 KM/H or Turbo Boost) */}
      {isHighSpeed && (
        <div
          className="fixed inset-0 pointer-events-none z-0 transition-opacity duration-200"
          style={{
            opacity: isBoosting ? 0.85 : Math.min(0.55, (telemetry.speedKmh - 80) / 45),
            background: isBoosting
              ? 'radial-gradient(circle at 50% 50%, transparent 56%, rgba(0, 240, 255, 0.22) 86%, rgba(56, 189, 248, 0.42) 100%)'
              : 'radial-gradient(circle at 50% 50%, transparent 64%, rgba(0, 240, 255, 0.12) 90%, rgba(251, 191, 36, 0.22) 100%)',
          }}
        >
          {/* Left & Right Neon Velocity Streaks */}
          <div className="absolute inset-y-8 left-2 w-16 flex flex-col justify-around opacity-80">
            <div className="h-[2px] w-14 bg-gradient-to-r from-cyan-400 to-transparent animate-pulse" />
            <div className="h-[2px] w-10 bg-gradient-to-r from-amber-300 to-transparent" />
            <div className="h-[2px] w-16 bg-gradient-to-r from-cyan-300 to-transparent animate-pulse" />
            <div className="h-[2px] w-12 bg-gradient-to-r from-sky-400 to-transparent" />
          </div>
          <div className="absolute inset-y-8 right-2 w-16 flex flex-col justify-around items-end opacity-80">
            <div className="h-[2px] w-14 bg-gradient-to-l from-cyan-400 to-transparent animate-pulse" />
            <div className="h-[2px] w-10 bg-gradient-to-l from-amber-300 to-transparent" />
            <div className="h-[2px] w-16 bg-gradient-to-l from-cyan-300 to-transparent animate-pulse" />
            <div className="h-[2px] w-12 bg-gradient-to-l from-sky-400 to-transparent" />
          </div>
        </div>
      )}

      {/* TOP BAR: Position Rank Badge (Left) | Streamlined Speedometer & Lap Counter (Right) */}
      <header className="flex items-start justify-between gap-2 w-full">
        {/* Top-Left: Menu, Settings & Live 1st-4th Position Badge */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.__theRaceEngine?.clearTouchControls();
              onOpenMenu();
            }}
            style={{ touchAction: 'manipulation' }}
            className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/25 active:border-cyan-400 font-['Orbitron'] italic font-bold text-[11px] text-white tracking-wider uppercase cursor-pointer shadow-lg active:scale-95"
          >
            ← MENU
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            style={{ touchAction: 'manipulation' }}
            aria-label="Settings"
            className="w-8 h-8 rounded-xl bg-slate-950/80 border border-white/20 active:border-cyan-400 text-slate-200 flex items-center justify-center cursor-pointer shadow-lg active:scale-95 text-sm"
          >
            ⚙
          </button>

          {/* DYNAMIC POSITION RANK BADGE (1ST, 2ND, 3RD, 4TH) */}
          <div
            className={`flex items-baseline gap-0.5 px-3 py-1 rounded-xl bg-gradient-to-r border-2 font-['Orbitron'] italic font-black shadow-lg ${rankBadgeColor}`}
          >
            <span className="text-lg sm:text-xl leading-none">{rank}</span>
            <span className="text-[9px] sm:text-[10px] font-black tracking-widest">
              {rankSuffix}
            </span>
          </div>

          <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-xl bg-slate-950/70 border border-white/10">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: currentMap?.accentHex || equippedKit.primaryColor }}
            />
            <span className="font-['Orbitron'] italic font-bold text-[10px] text-slate-200 tracking-wide">
              {currentMap ? `${currentMap.name} · ${equippedKit.name}` : equippedKit.name}
            </span>
          </div>
        </div>

        {/* Top-Right: Streamlined Speedometer & Lap Counter */}
        <div className="flex items-center gap-2.5 sm:gap-3.5 bg-slate-950/80 border border-white/15 rounded-xl px-2.5 py-1 sm:px-3 sm:py-1.5 shadow-lg">
          {/* Speedometer */}
          <div className="flex items-baseline gap-1">
            <span
              className="font-['Orbitron'] italic font-black text-2xl sm:text-3xl text-white tabular-nums leading-none"
              style={{
                textShadow: isBoosting
                  ? '0 0 14px rgba(0, 240, 255, 0.95)'
                  : '0 2px 6px rgba(0, 0, 0, 0.95)',
              }}
            >
              {telemetry.speedKmh}
            </span>
            <span className="font-['Orbitron'] italic font-extrabold text-[9px] text-cyan-300 tracking-wider">
              KM/H
            </span>
          </div>

          {/* Lap Counter & Timer */}
          <div className="flex flex-col items-end border-l border-white/15 pl-2.5 sm:pl-3">
            <div className="font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wider text-white leading-none">
              LAP <span className="text-cyan-400">{telemetry.lapCount}</span>/3
            </div>
            <div className="font-mono font-bold text-[10px] sm:text-xs text-amber-300 tabular-nums tracking-tight mt-0.5 leading-none">
              {formatRaceTime(telemetry.totalRaceTime || telemetry.currentLapTime)}
            </div>
          </div>
        </div>
      </header>

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

      {/* PURE ICON-ONLY RACING CONTROLS
          BOTTOM-LEFT: Left / Right Steering Arrows
          BOTTOM-RIGHT: Nitro + Brake Pedal (Left Column) & Ergonomic Gap + Throttle Pedal (Right Column) */}
      <div className="w-full flex items-end justify-between pb-1 sm:pb-1.5 pointer-events-none">
        {/* BOTTOM-LEFT: PURE SYMBOL STEERING CONTROLS */}
        <div
          className="pointer-events-auto flex items-center gap-3.5 sm:gap-4"
          role="group"
          aria-label="Steering Controls"
        >
          {/* STEER LEFT (ICON ONLY) */}
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
            className={`w-20 h-20 sm:w-22 sm:h-22 rounded-3xl flex items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer backdrop-blur-sm ${
              activeControls.left
                ? 'bg-cyan-400/45 border-cyan-200 text-white scale-95 shadow-[0_0_24px_rgba(0,240,255,0.8)]'
                : 'bg-slate-950/60 border-white/30 text-white/95 shadow-lg'
            }`}
          >
            <svg
              className="w-10 h-10 sm:w-11 sm:h-11"
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

          {/* STEER RIGHT (ICON ONLY) */}
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
            className={`w-20 h-20 sm:w-22 sm:h-22 rounded-3xl flex items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer backdrop-blur-sm ${
              activeControls.right
                ? 'bg-cyan-400/45 border-cyan-200 text-white scale-95 shadow-[0_0_24px_rgba(0,240,255,0.8)]'
                : 'bg-slate-950/60 border-white/30 text-white/95 shadow-lg'
            }`}
          >
            <svg
              className="w-10 h-10 sm:w-11 sm:h-11"
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

        {/* BOTTOM-CENTER: LIVE DRIFT-TURBO CHARGE METER */}
        {(telemetry.isDrifting || driftCharge > 0.05) && (
          <div className="pointer-events-none flex flex-col items-center mb-2">
            <div
              className={`px-3 py-0.5 rounded-full border font-['Orbitron'] italic font-black text-[10px] tracking-widest uppercase shadow-lg ${
                driftReady
                  ? 'bg-cyan-500/35 border-cyan-300 text-cyan-200 animate-pulse shadow-[0_0_16px_rgba(0,240,255,0.85)]'
                  : 'bg-amber-500/25 border-amber-400/80 text-amber-200'
              }`}
            >
              {driftReady ? '⚡ DRIFT TURBO READY!' : '💨 DRIFT CHARGING...'}
            </div>
            <div className="w-28 h-1.5 rounded-full bg-slate-950/85 border border-white/20 overflow-hidden mt-1">
              <div
                className={`h-full transition-all duration-75 ${
                  driftReady
                    ? 'bg-gradient-to-r from-cyan-400 via-sky-300 to-white'
                    : 'bg-gradient-to-r from-amber-500 to-yellow-300'
                }`}
                style={{ width: `${Math.min(100, Math.round(driftCharge * 100))}%` }}
              />
            </div>
          </div>
        )}

        {/* BOTTOM-RIGHT: PURE RACING ICON PEDALS + NITRO BOOST */}
        <div
          className="pointer-events-auto flex items-end gap-4 sm:gap-5"
          role="group"
          aria-label="Driving Controls"
        >
          {/* LEFT COLUMN: NITRO BOOST + BRAKE/REVERSE PEDAL */}
          <div className="flex flex-col items-center gap-2.5">
            {/* NITRO BOOST BUTTON — SLEEK FLAME/BOLT SYMBOL + CHARGE FILL (NO TEXT) */}
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
              aria-label="Nitro Boost"
              className={`relative overflow-hidden w-20 h-11 sm:w-22 sm:h-12 rounded-2xl flex items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer backdrop-blur-sm ${
                activeControls.nitro || isBoosting
                  ? 'bg-amber-400/90 border-white text-slate-950 scale-95 shadow-[0_0_24px_rgba(251,191,36,0.95)]'
                  : nitroReady
                    ? 'bg-slate-950/65 border-amber-400/85 text-amber-300 shadow-[0_0_16px_rgba(251,191,36,0.35)]'
                    : 'bg-slate-950/55 border-slate-500/50 text-slate-400 shadow-lg'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500/45 to-cyan-400/35 pointer-events-none transition-all duration-150"
                style={{ width: `${nitroPercent}%` }}
              />
              {/* Motorsport Turbo Flame + Lightning SVG */}
              <svg
                className="relative z-10 w-6 h-6 sm:w-7 sm:h-7 drop-shadow-[0_0_6px_rgba(251,191,36,0.75)]"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M13.5 2L5.5 13h5.5l-1.5 9 8.5-11.5h-5.5L13.5 2z" />
              </svg>
            </button>

            {/* BRAKE / REVERSE PEDAL — HORIZONTAL RIBBED BRAKE PEDAL SYMBOL (NO TEXT) */}
            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionState('backward', true);
              }}
              onTouchEnd={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionState('backward', false);
              }}
              onTouchCancel={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDirectionState('backward', false);
              }}
              onMouseDown={(e) => {
                e.preventDefault();
                setDirectionState('backward', true);
              }}
              onMouseUp={() => setDirectionState('backward', false)}
              onMouseLeave={() => setDirectionState('backward', false)}
              aria-label="Brake and Reverse"
              className={`w-20 h-16 sm:w-22 sm:h-18 rounded-2xl flex items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer backdrop-blur-sm ${
                activeControls.backward
                  ? 'bg-rose-500/55 border-rose-200 text-white scale-95 shadow-[0_0_24px_rgba(244,63,94,0.85)]'
                  : 'bg-slate-950/60 border-rose-400/70 text-rose-300 shadow-lg'
              }`}
            >
              {/* Distinct Wide Motorsport Brake Pedal Pad + Stop/Reverse Cue */}
              <svg
                className="w-11 h-9 sm:w-12 sm:h-10"
                viewBox="0 0 44 36"
                fill="none"
              >
                {/* Wide Pedal Body */}
                <rect
                  x="4"
                  y="6"
                  width="36"
                  height="24"
                  rx="6"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  fill="currentColor"
                  fillOpacity="0.16"
                />
                {/* Vertical Grip Ribs */}
                <line x1="12" y1="11" x2="12" y2="25" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
                <line x1="32" y1="11" x2="32" y2="25" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" opacity="0.65" />
                {/* Downward Reverse / Stop Chevron */}
                <path
                  d="M17 15.5L22 21L27 15.5"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>

          {/* RIGHT COLUMN: TALL MOTORSPORT THROTTLE / GAS PEDAL (NO TEXT) */}
          <div className="flex flex-col items-center">
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
              className={`w-20 h-24 sm:w-24 sm:h-28 rounded-3xl flex items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer backdrop-blur-sm ${
                activeControls.forward
                  ? 'bg-emerald-400/50 border-emerald-200 text-white scale-95 shadow-[0_0_28px_rgba(16,185,129,0.9)]'
                  : 'bg-slate-950/60 border-emerald-400/80 text-emerald-300 shadow-xl'
              }`}
            >
              {/* Tall Angled Motorsport Gas / Accelerator Pedal SVG */}
              <svg
                className="w-11 h-16 sm:w-12 sm:h-20"
                viewBox="0 0 40 60"
                fill="none"
              >
                {/* Pedal Plate */}
                <path
                  d="M9 10C9 6.68629 11.6863 4 15 4H27C30.3137 4 33 6.68629 33 10L31 50C31 53.3137 28.3137 56 25 56H13C9.68629 56 7 53.3137 7 50L9 10Z"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  fill="currentColor"
                  fillOpacity="0.16"
                />
                {/* Double Upward Thrust Chevrons */}
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
                {/* Lower Grip Treads */}
                <line x1="13" y1="39" x2="26" y2="39" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
                <line x1="12.5" y1="45" x2="25.5" y2="45" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
                <line x1="12" y1="51" x2="25" y2="51" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
