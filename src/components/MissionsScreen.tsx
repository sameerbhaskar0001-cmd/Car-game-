import React, { useState } from 'react';
import {
  DriverLevelInfo,
  MISSIONS_LIST,
  MissionSpec,
  PlayerCareerState,
} from '../types/game';

interface MissionsScreenProps {
  coins: number;
  driverLevel: DriverLevelInfo;
  career: PlayerCareerState;
  unlockedCount: number;
  onClaimMission: (mission: MissionSpec) => void;
  onBackToMenu: () => void;
  onOpenEvents: () => void;
  onOpenGarage: () => void;
}

export const MissionsScreen: React.FC<MissionsScreenProps> = ({
  coins,
  driverLevel,
  career,
  unlockedCount,
  onClaimMission,
  onBackToMenu,
  onOpenEvents,
  onOpenGarage,
}) => {
  const [filter, setFilter] = useState<'All' | 'Daily' | 'Career'>('All');

  const evaluatedMissions = MISSIONS_LIST.map((m) => {
    const progress = Math.min(m.target, m.getProgress(career, unlockedCount));
    const claimed = career.claimedMissionIds.includes(m.id);
    const completed = progress >= m.target;
    const claimable = completed && !claimed;
    return { mission: m, progress, claimed, completed, claimable };
  })
    .filter((item) => filter === 'All' || item.mission.category === filter)
    .sort((a, b) => {
      if (a.claimable !== b.claimable) return a.claimable ? -1 : 1;
      if (a.claimed !== b.claimed) return a.claimed ? 1 : -1;
      return 0;
    });

  const completedCount = MISSIONS_LIST.filter((m) =>
    career.claimedMissionIds.includes(m.id)
  ).length;

  return (
    <div className="fixed inset-0 z-30 pointer-events-auto flex flex-col select-none overflow-hidden font-['Plus_Jakarta_Sans'] bg-[#050814]/94 backdrop-blur-sm">
      {/* OPAQUE TOP BAR + COMPACT DRIVER STRIP */}
      <header
        className="relative z-20 w-full shrink-0 bg-[#060a16] border-b border-white/12 shadow-md"
        style={{
          paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
          paddingBottom: '0.55rem',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onBackToMenu}
                style={{ touchAction: 'manipulation' }}
                className="h-8 sm:h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-semibold text-slate-100 flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
              >
                <span>←</span>
                <span>Lobby</span>
              </button>

              <div className="min-w-0">
                <h1 className="font-['Orbitron'] italic font-black text-sm sm:text-lg text-white tracking-wider uppercase leading-none whitespace-nowrap">
                  DRIVER MISSIONS
                </h1>
                <p className="text-[11px] text-slate-400 mt-0.5 truncate hidden sm:block">
                  Complete racing and garage goals to earn Coins and XP
                </p>
              </div>
            </div>

            <div className="h-8 sm:h-9 flex items-center gap-1.5 px-3 rounded-lg bg-slate-900 border border-amber-400/45 shrink-0 whitespace-nowrap">
              <span className="text-sm leading-none" aria-hidden="true">
                🪙
              </span>
              <span className="font-mono font-bold text-xs sm:text-sm text-white tabular-nums">
                {coins.toLocaleString()}
              </span>
              <span className="hidden sm:inline font-['Orbitron'] font-bold text-[10px] text-amber-300 uppercase">
                COINS
              </span>
            </div>
          </div>

          {/* COMPACT DRIVER PROFILE SUMMARY + FILTER TABS */}
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-3 bg-[#0a1020] border border-white/12 rounded-xl px-3 py-1.5 flex-1 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-amber-400/15 border border-amber-400/50 flex flex-col items-center justify-center shrink-0">
                <span className="text-[8px] font-bold text-amber-300 uppercase leading-none">
                  LVL
                </span>
                <span className="font-['Orbitron'] italic font-black text-sm text-white tabular-nums leading-none mt-0.5">
                  {driverLevel.level}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-semibold text-white truncate">{driverLevel.title}</span>
                  <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                    {driverLevel.currentXp}/{driverLevel.nextLevelXp} XP · {completedCount}/
                    {MISSIONS_LIST.length}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-cyan-400 transition-all duration-300"
                    style={{ width: `${driverLevel.progressPct}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Interactive Filter Segmented Control */}
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950 border border-white/10 shrink-0">
              {(['All', 'Daily', 'Career'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilter(tab)}
                  style={{ touchAction: 'manipulation' }}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    filter === tab
                      ? 'bg-cyan-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* SCROLLABLE MISSIONS GRID */}
      <main
        className="w-full min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          paddingTop: '0.7rem',
          paddingBottom: '0.85rem',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {evaluatedMissions.map(({ mission, progress, claimed, claimable }) => {
            const pct = Math.min(100, Math.round((progress / mission.target) * 100));
            const isGarageTask = mission.actionTarget === 'garage';

            return (
              <div
                key={mission.id}
                className={`p-3 sm:p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 transition-colors ${
                  claimable
                    ? 'bg-emerald-950/45 border-emerald-400/65'
                    : claimed
                      ? 'bg-[#070b14]/70 border-white/8 opacity-70'
                      : 'bg-[#090f1e] border-white/12'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] text-slate-400 font-medium">
                      {mission.category} Objective · +{mission.rewardXp} XP
                    </div>
                    <h3 className="font-['Orbitron'] italic font-bold text-xs sm:text-sm text-white tracking-wide mt-0.5">
                      {mission.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                      {mission.description}
                    </p>
                  </div>

                  <div className="text-right shrink-0 font-mono tabular-nums">
                    <div className="text-xs sm:text-sm font-bold text-amber-300 whitespace-nowrap">
                      +🪙 {mission.rewardCoins.toLocaleString()} COINS
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-400 mb-1">
                      <span>Progress</span>
                      <span className="text-slate-200">
                        {progress} / {mission.target}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          claimed
                            ? 'bg-slate-500'
                            : claimable
                              ? 'bg-emerald-400'
                              : isGarageTask
                                ? 'bg-amber-400'
                                : 'bg-cyan-400'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>

                  {claimable ? (
                    <button
                      type="button"
                      onClick={() => onClaimMission(mission)}
                      style={{ touchAction: 'manipulation' }}
                      className="px-4 py-1.5 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                    >
                      Claim
                    </button>
                  ) : claimed ? (
                    <span className="text-xs font-semibold text-slate-400 whitespace-nowrap shrink-0">
                      Claimed
                    </span>
                  ) : isGarageTask ? (
                    <button
                      type="button"
                      onClick={onOpenGarage}
                      style={{ touchAction: 'manipulation' }}
                      className="px-3.5 py-1.5 rounded-lg bg-amber-400/15 hover:bg-amber-400/25 border border-amber-400/50 text-xs font-semibold text-amber-200 cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                    >
                      Garage
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={onOpenEvents}
                      style={{ touchAction: 'manipulation' }}
                      className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-semibold text-slate-200 cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                    >
                      Race
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* OPAQUE BOTTOM BAR */}
      <footer
        className="relative z-20 w-full shrink-0 bg-[#060a16] border-t border-white/12 shadow-[0_-8px_24px_rgba(0,0,0,0.55)]"
        style={{
          paddingTop: '0.5rem',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div className="w-full max-w-5xl mx-auto flex items-center justify-between gap-3">
          <span className="text-[11px] text-slate-400 truncate">
            {career.totalRaces} Races · {career.totalWins} Wins · Progress saves automatically.
          </span>
          <button
            type="button"
            onClick={onOpenEvents}
            style={{ touchAction: 'manipulation' }}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-400 to-amber-400 text-slate-950 font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wider uppercase cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
          >
            Go to Events →
          </button>
        </div>
      </footer>
    </div>
  );
};
