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
}

export const MissionsScreen: React.FC<MissionsScreenProps> = ({
  coins,
  driverLevel,
  career,
  unlockedCount,
  onClaimMission,
  onBackToMenu,
  onOpenEvents,
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
    <div
      className="fixed inset-0 z-30 pointer-events-auto flex flex-col justify-between select-none overflow-hidden font-['Plus_Jakarta_Sans']"
      style={{
        background:
          'linear-gradient(180deg, rgba(5, 8, 16, 0.90) 0%, rgba(5, 8, 16, 0.78) 50%, rgba(4, 7, 14, 0.95) 100%)',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      {/* TOP BAR */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between gap-3 shrink-0 pb-3 border-b border-white/10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBackToMenu}
            style={{ touchAction: 'manipulation' }}
            className="h-9 px-3.5 rounded-lg bg-slate-900/90 hover:bg-slate-800 border border-white/15 text-xs font-semibold text-slate-200 flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
          >
            <span>←</span>
            <span>Lobby</span>
          </button>

          <div className="min-w-0">
            <h1 className="font-['Orbitron'] italic font-black text-base sm:text-xl text-white tracking-wider uppercase leading-none whitespace-nowrap">
              DRIVER MISSIONS
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              Complete racing goals to earn Credits and Driver Level XP
            </p>
          </div>
        </div>

        <div className="h-9 flex items-center gap-2 px-3 rounded-lg bg-slate-900/90 border border-amber-400/40 shrink-0">
          <span className="font-['Orbitron'] font-bold text-[10px] text-amber-400">CR</span>
          <span className="font-mono font-bold text-sm text-white tabular-nums">
            {coins.toLocaleString()}
          </span>
        </div>
      </header>

      {/* DRIVER PROFILE SUMMARY + FILTER TABS */}
      <div className="w-full max-w-5xl mx-auto py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-4 bg-[#080d1a]/85 border border-white/12 rounded-xl px-4 py-2.5 flex-1">
          <div className="w-11 h-11 rounded-lg bg-amber-400/15 border border-amber-400/50 flex flex-col items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-amber-300 uppercase leading-none">LVL</span>
            <span className="font-['Orbitron'] italic font-black text-lg text-white tabular-nums leading-none mt-0.5">
              {driverLevel.level}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-white truncate">{driverLevel.title}</span>
              <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                {driverLevel.currentXp} / {driverLevel.nextLevelXp} XP
              </span>
            </div>
            <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-cyan-400 transition-all duration-300"
                style={{ width: `${driverLevel.progressPct}%` }}
              />
            </div>
            <div className="text-[11px] text-slate-400 mt-1 font-mono tabular-nums">
              {career.totalRaces} Races · {career.totalWins} Wins · {completedCount}/{MISSIONS_LIST.length} Claimed
            </div>
          </div>
        </div>

        {/* Interactive Filter Segmented Control */}
        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/10 self-start sm:self-center shrink-0">
          {(['All', 'Daily', 'Career'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setFilter(tab)}
              style={{ touchAction: 'manipulation' }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                filter === tab
                  ? 'bg-cyan-400 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* MISSIONS GRID */}
      <main className="w-full max-w-5xl mx-auto flex-1 overflow-y-auto pb-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {evaluatedMissions.map(({ mission, progress, claimed, claimable }) => {
            const pct = Math.min(100, Math.round((progress / mission.target) * 100));
            return (
              <div
                key={mission.id}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-colors ${
                  claimable
                    ? 'bg-emerald-950/35 border-emerald-400/60'
                    : claimed
                      ? 'bg-[#070b14]/60 border-white/8 opacity-70'
                      : 'bg-[#080d1a]/88 border-white/12'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[11px] text-slate-400 font-medium">
                      {mission.category} Objective · +{mission.rewardXp} XP
                    </div>
                    <h3 className="font-['Orbitron'] italic font-bold text-sm text-white tracking-wide mt-0.5">
                      {mission.title}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1 leading-snug">
                      {mission.description}
                    </p>
                  </div>

                  <div className="text-right shrink-0 font-mono tabular-nums">
                    <div className="text-sm font-bold text-amber-300">
                      +{mission.rewardCoins} CR
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400 mb-1">
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
                      className="px-4 py-2 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
                    >
                      Claim
                    </button>
                  ) : claimed ? (
                    <span className="text-xs font-semibold text-slate-400 whitespace-nowrap shrink-0">
                      Claimed
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={onOpenEvents}
                      style={{ touchAction: 'manipulation' }}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-semibold text-slate-300 cursor-pointer whitespace-nowrap shrink-0"
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

      {/* BOTTOM BAR */}
      <footer className="w-full max-w-5xl mx-auto pt-3 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
        <span className="text-xs text-slate-400">
          Progress saves automatically after every race and upgrade.
        </span>
        <button
          type="button"
          onClick={onOpenEvents}
          style={{ touchAction: 'manipulation' }}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-amber-400 text-slate-950 font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wider uppercase cursor-pointer active:scale-95 whitespace-nowrap"
        >
          Go to Events →
        </button>
      </footer>
    </div>
  );
};
