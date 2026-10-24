import React, { useState, useEffect, useCallback } from 'react';
import { BodyKitSpec, PowerupType, RaceTelemetry, formatRaceTime } from '../types/game';

interface RaceHUDProps {
  telemetry: RaceTelemetry;
  equippedKit: BodyKitSpec;
  onOpenMenu: () => void;
  onOpenSettings: () => void;
  onTriggerFinishDemo: () => void;
}

const POWERUP_DETAILS: Record<
  PowerupType,
  { name: string; icon: string; color: string; bg: string; border: string }
> = {
  ROCKET: {
    name: 'MISSILE',
    icon: '🚀',
    color: '#ff3b30',
    bg: 'bg-rose-500/35',
    border: 'border-rose-400',
  },
  SHIELD: {
    name: 'SHIELD',
    icon: '🛡️',
    color: '#00e5ff',
    bg: 'bg-cyan-500/35',
    border: 'border-cyan-300',
  },
  OIL_SLICK: {
    name: 'OIL TRAP',
    icon: '🛢️',
    color: '#f59e0b',
    bg: 'bg-amber-500/35',
    border: 'border-amber-400',
  },
  HYPER_NITRO: {
    name: 'SUPER TURBO',
    icon: '⚡',
    color: '#38bdf8',
    bg: 'bg-sky-500/35',
    border: 'border-sky-300',
  },
  EMP: {
    name: 'EMP BLAST',
    icon: '💣',
    color: '#a855f7',
    bg: 'bg-purple-500/35',
    border: 'border-purple-400',
  },
};

export const RaceHUD: React.FC<RaceHUDProps> = ({
  telemetry,
  equippedKit,
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

  const [justFired, setJustFired] = useState(false);

  // Clear all touch controls when unmounting
  useEffect(() => {
    return () => {
      window.__theRaceEngine?.clearTouchControls();
    };
  }, []);

  // Reset optimistic consumed flag whenever telemetry powerup updates
  useEffect(() => {
    setJustFired(false);
  }, [telemetry.heldPowerup]);

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

  const handlePowerupTrigger = useCallback(() => {
    const fired = window.__theRaceEngine?.triggerPowerup();
    if (fired !== false) {
      setJustFired(true);
    }
  }, []);

  const isBoosting = telemetry.boostActive > 0.05;
  const isHighSpeed = telemetry.speedKmh >= 85 || isBoosting;
  const driftCharge = telemetry.driftCharge ?? 0;
  const driftReady = driftCharge >= 0.38;
  const nitroPercent = Math.round(Math.min(1, Math.max(0, telemetry.boostCharge)) * 100);
  const rank = telemetry.positionRank || 1;
  const held =
    telemetry.heldPowerup && !justFired
      ? POWERUP_DETAILS[telemetry.heldPowerup]
      : null;

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

      {/* SHIELD ACTIVE ENERGY HUD BORDER */}
      {telemetry.shieldActive && (
        <div
          className="fixed inset-0 pointer-events-none z-10 animate-pulse border-4 border-cyan-400/50 shadow-[inset_0_0_40px_rgba(0,229,255,0.4)]"
          style={{ boxSizing: 'border-box' }}
        />
      )}

      {/* INCOMING AI RIVAL MISSILE LOCK WARNING */}
      {telemetry.incomingAttack && !telemetry.spinoutActive && (
        <div className="fixed top-14 inset-x-0 pointer-events-none z-20 flex justify-center">
          <div className="px-4 py-1 rounded-full bg-rose-950/90 border border-rose-400 text-rose-200 font-['Orbitron'] italic font-black text-xs tracking-widest uppercase animate-pulse shadow-[0_0_20px_rgba(244,63,94,0.85)]">
            🚀 INCOMING MISSILE!
          </div>
        </div>
      )}

      {/* SPINOUT WARNING OVERLAY */}
      {telemetry.spinoutActive && (
        <div className="fixed inset-0 pointer-events-none z-20 flex items-center justify-center">
          <div className="px-5 py-2 rounded-2xl bg-rose-950/90 border-2 border-rose-500 text-white font-['Orbitron'] italic font-black text-base sm:text-xl tracking-widest animate-bounce shadow-2xl">
            ⚠️ SPINOUT!
          </div>
        </div>
      )}

      {/* TOP BAR: Position Rank Badge (Left) | Streamlined Speedometer & Lap Counter (Right) */}
      <header className="flex items-start justify-between gap-2 w-full">
        {/* Top-Left: Menu, Settings & Live 1st-4th Position Badge */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              window.__theRaceEngine?.clearTouchControls();
              onOpenMenu();
            }}
            onClick={(e) => {
              e.stopPropagation();
              window.__theRaceEngine?.clearTouchControls();
              onOpenMenu();
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-white/25 active:border-cyan-400 font-['Orbitron'] italic font-bold text-[11px] text-white tracking-wider uppercase cursor-pointer shadow-lg active:scale-95"
          >
            ← MENU
          </button>

          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
            onClick={(e) => {
              e.stopPropagation();
              onOpenSettings();
            }}
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
              style={{ backgroundColor: equippedKit.primaryColor }}
            />
            <span className="font-['Orbitron'] italic font-bold text-[10px] text-slate-200 tracking-wide">
              {equippedKit.name}
            </span>
          </div>
        </div>

        {/* Top-Right: Streamlined Speedometer & Lap Counter with Reduced Padding */}
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

      {/* MOBILE CONTROLS & DOCKED ROUND FIRE BADGE
          BOTTOM-LEFT: Steering Pads ( < and > )
          BOTTOM-RIGHT: Brake/Nitro + Throttle Pedal with Round Fire Badge Docked Directly Above Throttle */}
      <div className="w-full flex items-end justify-between pb-0.5 sm:pb-1 pointer-events-none">
        {/* BOTTOM-LEFT: STEERING CONTROLS */}
        <div
          className="pointer-events-auto flex items-center gap-3 sm:gap-4"
          role="group"
          aria-label="Steering Controls"
        >
          {/* STEER LEFT */}
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
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex flex-col items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer ${
              activeControls.left
                ? 'bg-cyan-400/40 border-cyan-200 text-white scale-95 shadow-[0_0_24px_rgba(0,240,255,0.75)]'
                : 'bg-slate-950/60 border-white/30 text-white/90 shadow-lg'
            }`}
          >
            <svg
              className="w-9 h-9 sm:w-11 sm:h-11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
            <span className="font-['Orbitron'] font-bold text-[9px] tracking-widest uppercase mt-0.5 opacity-80">
              LEFT
            </span>
          </button>

          {/* STEER RIGHT */}
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
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-3xl flex flex-col items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer ${
              activeControls.right
                ? 'bg-cyan-400/40 border-cyan-200 text-white scale-95 shadow-[0_0_24px_rgba(0,240,255,0.75)]'
                : 'bg-slate-950/60 border-white/30 text-white/90 shadow-lg'
            }`}
          >
            <svg
              className="w-9 h-9 sm:w-11 sm:h-11"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
            <span className="font-['Orbitron'] font-bold text-[9px] tracking-widest uppercase mt-0.5 opacity-80">
              RIGHT
            </span>
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

        {/* BOTTOM-RIGHT: NITRO + BRAKE/REV (LEFT COLUMN) & ROUND FIRE BADGE DOCKED ABOVE THROTTLE PEDAL (RIGHT COLUMN) */}
        <div
          className="pointer-events-auto flex items-end gap-3 sm:gap-4"
          role="group"
          aria-label="Weapons and Driving Controls"
        >
          {/* LEFT COLUMN: NITRO BOOST + BRAKE/REVERSE */}
          <div className="flex flex-col items-end gap-2">
            {/* NITRO BOOST BUTTON */}
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
              className={`relative overflow-hidden w-20 h-11 sm:w-24 sm:h-12 rounded-2xl font-['Orbitron'] italic font-black text-[11px] sm:text-xs tracking-wider uppercase flex items-center justify-center gap-1 border-2 transition-transform select-none touch-none cursor-pointer ${
                activeControls.nitro || isBoosting
                  ? 'bg-amber-400/80 border-white text-slate-950 scale-95 shadow-[0_0_20px_rgba(251,191,36,0.95)]'
                  : 'bg-slate-950/60 border-amber-400/70 text-amber-300 shadow-lg'
              }`}
            >
              <div
                className="absolute inset-y-0 left-0 bg-amber-400/25 pointer-events-none transition-all duration-150"
                style={{ width: `${nitroPercent}%` }}
              />
              <span className="relative z-10 text-sm leading-none">⚡</span>
              <span className="relative z-10 font-mono text-[10px]">
                {nitroPercent}%
              </span>
            </button>

            {/* BRAKE / SMOOTH REVERSE */}
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
              className={`w-20 h-18 sm:w-24 sm:h-20 rounded-2xl font-['Orbitron'] italic font-black text-xs tracking-wider uppercase flex flex-col items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer ${
                activeControls.backward
                  ? 'bg-rose-500/50 border-rose-200 text-white scale-95 shadow-[0_0_24px_rgba(244,63,94,0.8)]'
                  : 'bg-slate-950/55 border-rose-400/60 text-rose-200 shadow-lg'
              }`}
            >
              <span className="text-xs sm:text-sm font-black">BRAKE</span>
              <span className="text-[9px] font-bold text-rose-300/85 tracking-widest mt-0.5">
                REV
              </span>
            </button>
          </div>

          {/* RIGHT COLUMN: NEAT ROUND FIRE BADGE DOCKED DIRECTLY ABOVE THROTTLE PEDAL */}
          <div className="flex flex-col items-center gap-2">
            {/* SINGLE-USE ROUND FIRE BADGE (Appears ONLY when an item is in inventory) */}
            {held && (
              <button
                type="button"
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePowerupTrigger();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handlePowerupTrigger();
                }}
                aria-label={`Fire ${held.name}`}
                className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex flex-col items-center justify-center border-2 transition-all select-none touch-none cursor-pointer active:scale-90 animate-pulse shadow-2xl ${held.bg} ${held.border} text-white`}
                style={{
                  boxShadow: `0 0 22px ${held.color}88`,
                }}
              >
                <span className="text-xl sm:text-2xl leading-none">{held.icon}</span>
                <span className="font-['Orbitron'] italic font-black text-[8px] tracking-widest uppercase mt-0.5">
                  FIRE
                </span>
              </button>
            )}

            {/* LARGE PRIMARY ACCELERATE (THROTTLE) PEDAL */}
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
              className={`w-24 h-22 sm:w-28 sm:h-26 rounded-3xl font-['Orbitron'] italic font-black text-sm sm:text-base tracking-wider uppercase flex flex-col items-center justify-center border-2 transition-transform select-none touch-none cursor-pointer ${
                activeControls.forward
                  ? 'bg-emerald-400/45 border-emerald-200 text-white scale-95 shadow-[0_0_28px_rgba(16,185,129,0.85)]'
                  : 'bg-slate-950/55 border-emerald-400/75 text-emerald-200 shadow-xl'
              }`}
            >
              <svg
                className="w-7 h-7 sm:w-8 sm:h-8 mb-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 15l-6-6-6 6" />
              </svg>
              <span>ACCEL</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
