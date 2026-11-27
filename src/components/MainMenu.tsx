import React from 'react';
import { Check, Flame, Gift } from 'lucide-react';
import {
  BODY_KITS,
  DAILY_STREAK_REWARDS,
  DailyStreakState,
  MAP_SPECS,
  MapId,
  RACE_MODES,
  RaceModeId,
  formatCompactCoins,
} from '../types/game';

interface MainMenuProps {
  coins: number;
  unlockedCount: number;
  claimableMissionsCount: number;
  dailyStreak: DailyStreakState;
  onClaimDailyReward: () => void;
  selectedMapId: MapId;
  selectedModeId: RaceModeId;
  onStartRace: () => void;
  onOpenEvents: () => void;
  onOpenGarage: () => void;
  onOpenMissions: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  coins,
  unlockedCount,
  claimableMissionsCount,
  dailyStreak,
  onClaimDailyReward,
  selectedMapId,
  selectedModeId,
  onStartRace,
  onOpenEvents,
  onOpenGarage,
  onOpenMissions,
  onOpenSettings,
}) => {
  const activeMap = MAP_SPECS.find((m) => m.id === selectedMapId) || MAP_SPECS[0];
  const activeMode = RACE_MODES.find((m) => m.id === selectedModeId) || RACE_MODES[0];

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between select-none font-['Plus_Jakarta_Sans']"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      {/* Measured edge scrims — keeps central 3D car & live outdoor circuit crystal clear */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(5, 9, 18, 0.66) 0%, rgba(5, 9, 18, 0.06) 24%, rgba(5, 9, 18, 0.04) 70%, rgba(5, 9, 18, 0.78) 100%)',
        }}
      />

      {/* TOP BAR: Clean Title (Left) | Coins & Settings (Right) */}
      <header className="pointer-events-auto flex items-center justify-between gap-3 w-full">
        <div className="min-w-0">
          <h1
            className="font-['Orbitron'] italic font-black text-xl sm:text-3xl tracking-wider uppercase leading-none whitespace-nowrap"
            style={{
              background: 'linear-gradient(95deg, #ffffff 0%, #fde68a 58%, #f59e0b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            THE RACE 3D
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div
            className="h-10 flex items-center gap-1.5 px-3 rounded-lg bg-[#070b14]/88 border border-amber-400/45 backdrop-blur-md shrink-0 whitespace-nowrap"
            title="Coins Balance"
          >
            <span className="text-sm leading-none" aria-hidden="true">
              🪙
            </span>
            <span className="font-mono font-bold text-sm text-white tabular-nums">
              {coins.toLocaleString()}
            </span>
            <span className="font-['Orbitron'] font-bold text-[10px] tracking-wider text-amber-300 uppercase">
              COINS
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            style={{ touchAction: 'manipulation' }}
            aria-label="Settings"
            title="Settings"
            className="w-10 h-10 rounded-lg bg-[#070b14]/88 border border-white/15 hover:border-cyan-400/60 text-slate-200 hover:text-cyan-300 flex items-center justify-center transition-colors active:scale-95 cursor-pointer backdrop-blur-md shrink-0"
          >
            <svg
              className="w-[18px] h-[18px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* MIDDLE ROW: Compact Left Hub Rail + Daily Reward Banner (Auto-hides completely once claimed!) */}
      <div className="flex-1 flex items-center justify-between gap-3 my-auto py-3">
        <nav
          aria-label="Lobby Navigation"
          className="pointer-events-auto flex flex-col gap-2 w-48 sm:w-56 shrink-0"
        >
          <button
            type="button"
            onClick={onOpenEvents}
            style={{ touchAction: 'manipulation' }}
            className="group w-full px-3.5 py-2.5 rounded-lg bg-[#070b14]/82 hover:bg-[#0d1526]/92 border border-white/15 hover:border-cyan-400/60 backdrop-blur-md text-left transition-all active:scale-98 cursor-pointer flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="font-['Orbitron'] italic font-extrabold text-xs sm:text-sm text-white tracking-wider uppercase whitespace-nowrap">
                EVENTS
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap mt-0.5">
                {activeMode.shortName} · {activeMap.shortName}
              </div>
            </div>
            <span className="text-cyan-400 text-sm shrink-0 group-hover:translate-x-0.5 transition-transform">
              ›
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenGarage}
            style={{ touchAction: 'manipulation' }}
            className="group w-full px-3.5 py-2.5 rounded-lg bg-[#070b14]/82 hover:bg-[#0d1526]/92 border border-white/15 hover:border-amber-400/60 backdrop-blur-md text-left transition-all active:scale-98 cursor-pointer flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="font-['Orbitron'] italic font-extrabold text-xs sm:text-sm text-white tracking-wider uppercase whitespace-nowrap">
                GARAGE
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5 font-mono tabular-nums">
                {unlockedCount}/{BODY_KITS.length} Cars · Tune
              </div>
            </div>
            <span className="text-amber-400 text-sm shrink-0 group-hover:translate-x-0.5 transition-transform">
              ›
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenMissions}
            style={{ touchAction: 'manipulation' }}
            className="group w-full px-3.5 py-2.5 rounded-lg bg-[#070b14]/82 hover:bg-[#0d1526]/92 border border-white/15 hover:border-emerald-400/60 backdrop-blur-md text-left transition-all active:scale-98 cursor-pointer flex items-center justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="font-['Orbitron'] italic font-extrabold text-xs sm:text-sm text-white tracking-wider uppercase whitespace-nowrap">
                MISSIONS
              </div>
              <div className="text-[11px] truncate mt-0.5">
                {claimableMissionsCount > 0 ? (
                  <span className="text-emerald-400 font-semibold">
                    {claimableMissionsCount} Reward Ready
                  </span>
                ) : (
                  <span className="text-slate-400">Daily &amp; Career Goals</span>
                )}
              </div>
            </div>
            <span className="text-slate-300 text-sm shrink-0 group-hover:translate-x-0.5 transition-transform">
              ›
            </span>
          </button>
        </nav>

        {/* DAILY LOGIN REWARD BANNER — Disappears completely after claiming today's reward */}
        {!dailyStreak.claimedToday && (
          <aside
            aria-label="Daily Login Streak"
            className="pointer-events-auto self-start sm:self-center w-48 sm:w-60 rounded-xl bg-[#070b14]/88 border border-amber-400/35 backdrop-blur-md p-2.5 sm:p-3 shadow-2xl shrink-0"
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-['Orbitron'] italic font-extrabold text-[10px] sm:text-[11px] tracking-wider uppercase text-white truncate">
                  DAILY REWARD
                </span>
              </div>
              <span className="font-mono font-bold text-[10px] text-amber-300 tabular-nums shrink-0">
                DAY {dailyStreak.streakDay}/7
              </span>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2.5">
              {DAILY_STREAK_REWARDS.map((amt, idx) => {
                const dayNum = idx + 1;
                const isPast = dayNum < dailyStreak.streakDay;
                const isCurrent = dayNum === dailyStreak.streakDay;
                return (
                  <div
                    key={dayNum}
                    title={`Day ${dayNum}: +${amt.toLocaleString()} COINS`}
                    className={`flex flex-col items-center justify-center py-1 rounded border text-center leading-none ${
                      isPast
                        ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                        : isCurrent
                          ? 'bg-amber-400/25 border-amber-400 text-amber-200'
                          : 'bg-slate-900/75 border-white/10 text-slate-400'
                    }`}
                  >
                    <span className="font-mono font-bold text-[8px]">{dayNum}</span>
                    <span className="mt-0.5 text-[7px] font-mono tabular-nums">
                      {isPast ? (
                        <Check className="w-2.5 h-2.5 mx-auto" />
                      ) : (
                        formatCompactCoins(amt)
                      )}
                    </span>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              onClick={onClaimDailyReward}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-2 px-2.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-400 hover:from-amber-300 hover:to-orange-300 text-slate-950 font-['Orbitron'] italic font-black text-[10px] sm:text-[11px] tracking-wider uppercase flex items-center justify-center gap-1.5 cursor-pointer transition-transform active:scale-95 whitespace-nowrap"
            >
              <Gift className="w-3.5 h-3.5 shrink-0" />
              <span>CLAIM 🪙 +{dailyStreak.todayReward.toLocaleString()}</span>
            </button>
          </aside>
        )}
      </div>

      {/* BOTTOM DOCK: Unobstructed 3D Stage + Primary START RACE CTA (Right) */}
      <footer className="pointer-events-auto flex items-end justify-end gap-3 w-full">
        <button
          type="button"
          onClick={onStartRace}
          style={{
            touchAction: 'manipulation',
            boxShadow: '0 10px 28px rgba(0, 0, 0, 0.72), 0 0 24px rgba(6, 182, 212, 0.30)',
          }}
          className="group px-6 py-3 sm:px-8 sm:py-3.5 rounded-xl bg-gradient-to-r from-cyan-400 to-amber-400 hover:from-cyan-300 hover:to-amber-300 text-slate-950 transition-all duration-150 hover:-translate-y-0.5 active:scale-95 cursor-pointer flex items-center gap-3.5 whitespace-nowrap shrink-0"
        >
          <div className="text-left">
            <div className="font-['Orbitron'] italic font-black text-base sm:text-xl tracking-wider leading-none">
              START RACE
            </div>
            <div className="text-[10px] sm:text-[11px] font-bold text-slate-900/80 mt-1 leading-none">
              {activeMap.name} · {activeMode.shortName}
            </div>
          </div>
          <svg
            className="w-5 h-5 fill-slate-950 shrink-0 group-hover:translate-x-0.5 transition-transform"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M6 4l14 8-14 8V4z" />
          </svg>
        </button>
      </footer>
    </div>
  );
};
