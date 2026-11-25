import React from 'react';
import {
  BodyKitSpec,
  MapSpec,
  RACE_MODES,
  RaceFinishResult,
  formatRaceTime,
} from '../types/game';

interface GameOverScreenProps {
  result: RaceFinishResult;
  coins: number;
  equippedKit: BodyKitSpec;
  currentMap: MapSpec;
  nextMap: MapSpec;
  autoRotateMaps: boolean;
  onRetryRace: () => void;
  onOpenGarage: () => void;
  onMainMenu: () => void;
}

interface StandingsEntry {
  pos: number;
  driver: string;
  carName: string;
  totalTime: number;
  gapText: string;
  isPlayer: boolean;
  accentHex: string;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  result,
  coins,
  equippedKit,
  currentMap,
  nextMap,
  autoRotateMaps,
  onRetryRace,
  onOpenGarage,
  onMainMenu,
}) => {
  const rank = Math.min(4, Math.max(1, result.finishRank || 1));
  const isNextMapQueued = autoRotateMaps && nextMap.id !== currentMap.id;
  const modeSpec =
    RACE_MODES.find((m) => m.id === result.modeId) || RACE_MODES[0];
  const starsEarned = result.starsEarned ?? (rank === 1 ? 3 : rank === 2 ? 2 : 1);
  const xpEarned = result.xpEarned ?? (rank === 1 ? 120 : rank === 2 ? 90 : 65);
  const driftScore = Math.round(result.driftScore ?? 0);
  const isEliminated = Boolean(result.eliminated);
  const goldTargetSec = currentMap.goldTargetSec;
  const silverTargetSec = goldTargetSec + 8;
  const bronzeTargetSec = goldTargetSec + 16;

  let statusMeta = [
    {
      posLabel: '1ST',
      badgeSub: 'POS / 04',
      title: 'Race Victory',
      subtitle: 'Checkered Flag Leader',
      accentHex: '#f59e0b',
    },
    {
      posLabel: '2ND',
      badgeSub: 'POS / 04',
      title: 'Runner-Up Finish',
      subtitle: 'Front Row Qualifier',
      accentHex: '#06b6d4',
    },
    {
      posLabel: '3RD',
      badgeSub: 'POS / 04',
      title: 'Podium Finish',
      subtitle: 'Top 3 Classification',
      accentHex: '#fb923c',
    },
    {
      posLabel: '4TH',
      badgeSub: 'POS / 04',
      title: 'Race Completed',
      subtitle: 'Official Classification',
      accentHex: '#94a3b8',
    },
  ][rank - 1];

  if (modeSpec.id === 'elimination') {
    if (isEliminated) {
      statusMeta = {
        posLabel: 'OUT',
        badgeSub: `RANK #${rank}`,
        title: 'Eliminated!',
        subtitle: 'Knocked Out in Elimination',
        accentHex: '#f43f5e',
      };
    } else if (rank === 1) {
      statusMeta = {
        posLabel: '1ST',
        badgeSub: 'SURVIVOR',
        title: 'Last Car Standing',
        subtitle: 'Elimination Champion',
        accentHex: '#f59e0b',
      };
    }
  } else if (modeSpec.id === 'drift') {
    if (driftScore >= 5000) {
      statusMeta = {
        posLabel: 'GOLD',
        badgeSub: 'DRIFT PRO',
        title: 'Drift Master',
        subtitle: 'Gold Drift Target Smashed',
        accentHex: '#f59e0b',
      };
    } else if (driftScore >= 3000) {
      statusMeta = {
        posLabel: 'SLV',
        badgeSub: 'DRIFT TIER',
        title: 'Silver Drift Run',
        subtitle: 'Strong Angle & Chains',
        accentHex: '#38bdf8',
      };
    } else if (driftScore >= 1500) {
      statusMeta = {
        posLabel: 'BRZ',
        badgeSub: 'DRIFT TIER',
        title: 'Bronze Drift Run',
        subtitle: 'Solid Drift Score',
        accentHex: '#fb923c',
      };
    } else {
      statusMeta = {
        posLabel: 'RUN',
        badgeSub: 'DRIFT TIER',
        title: 'Drift Run Complete',
        subtitle: 'Reach 1,500 PTS for Bronze',
        accentHex: '#94a3b8',
      };
    }
  } else if (modeSpec.id === 'time_attack') {
    if (result.totalTime <= goldTargetSec) {
      statusMeta = {
        posLabel: 'GOLD',
        badgeSub: 'SOLO PACE',
        title: 'Gold Medal Time',
        subtitle: 'Track Record Pace',
        accentHex: '#f59e0b',
      };
    } else if (result.totalTime <= silverTargetSec) {
      statusMeta = {
        posLabel: 'SLV',
        badgeSub: 'SOLO PACE',
        title: 'Silver Medal Time',
        subtitle: 'Fast Solo Pace',
        accentHex: '#38bdf8',
      };
    } else if (result.totalTime <= bronzeTargetSec) {
      statusMeta = {
        posLabel: 'BRZ',
        badgeSub: 'SOLO PACE',
        title: 'Bronze Medal Time',
        subtitle: 'Target Time Cleared',
        accentHex: '#fb923c',
      };
    } else {
      statusMeta = {
        posLabel: 'SOLO',
        badgeSub: 'PACE RUN',
        title: 'Time Trial Finished',
        subtitle: 'Beat Target Clock for Medals',
        accentHex: '#94a3b8',
      };
    }
  }

  const playerTime = Math.max(1.0, result.totalTime || 54.0);
  const lapValues = [0, 1, 2].map((idx) => result.lapTimes[idx] ?? playerTime / 3);
  const fastestLapVal = Math.min(...lapValues);

  const aiRoster = [
    { driver: 'VIPER', carName: 'BOLT V12', accentHex: '#ef4444' },
    { driver: 'KIRA', carName: 'BLAZE V8', accentHex: '#06b6d4' },
    { driver: 'REAPER', carName: 'PATROL GT', accentHex: '#a855f7' },
  ];

  const standings: StandingsEntry[] = [];
  let aiCursor = 0;
  for (let p = 1; p <= 4; p++) {
    if (p === rank) {
      standings.push({
        pos: p,
        driver: 'YOU',
        carName: equippedKit.name,
        totalTime: playerTime,
        gapText: '',
        isPlayer: true,
        accentHex: statusMeta.accentHex,
      });
    } else {
      const ai = aiRoster[aiCursor++];
      const relPos = p - rank;
      const computedTime =
        relPos < 0
          ? Math.max(10.0, playerTime + relPos * 1.14 - aiCursor * 0.19)
          : playerTime + relPos * 1.28 + aiCursor * 0.23;
      standings.push({
        pos: p,
        driver: ai.driver,
        carName: ai.carName,
        totalTime: computedTime,
        gapText: '',
        isPlayer: false,
        accentHex: ai.accentHex,
      });
    }
  }

  const leaderTime = standings[0].totalTime;
  for (let i = 0; i < standings.length; i++) {
    if (i === 0) {
      standings[i].gapText = 'LEADER';
    } else {
      const diff = Math.max(0.05, standings[i].totalTime - leaderTime);
      standings[i].gapText = `+${diff.toFixed(2)}s`;
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-auto overflow-y-auto overscroll-contain select-none font-['Plus_Jakarta_Sans']"
      style={{
        touchAction: 'pan-y',
        WebkitOverflowScrolling: 'touch',
        background:
          'linear-gradient(180deg, rgba(4, 7, 15, 0.92) 0%, rgba(4, 7, 15, 0.72) 45%, rgba(3, 6, 14, 0.96) 100%)',
        paddingTop: 'max(0.55rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.55rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.85rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.85rem, env(safe-area-inset-right))',
      }}
    >
      <div className="min-h-full w-full max-w-2xl mx-auto flex flex-col justify-between gap-2.5">
        {/* TOP BAR: Result Summary & Rewards */}
        <div className="bg-[#070b14]/96 border border-white/15 rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1 overflow-hidden">
              <div
                className="px-3 py-1.5 rounded-xl border flex flex-col items-center justify-center shrink-0 bg-slate-900"
                style={{ borderColor: statusMeta.accentHex }}
              >
                <span className="font-['Orbitron'] italic font-black text-lg sm:text-xl text-white leading-none">
                  {statusMeta.posLabel}
                </span>
                <span
                  className="font-mono font-bold text-[9px] leading-none mt-1"
                  style={{ color: statusMeta.accentHex }}
                >
                  {statusMeta.badgeSub}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] font-medium text-slate-400 truncate">
                  <span style={{ color: currentMap.accentHex }} className="shrink-0">
                    {currentMap.name}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="truncate">{modeSpec.name}</span>
                </div>
                <h1 className="font-['Orbitron'] italic font-black text-base sm:text-xl text-white tracking-wider uppercase leading-tight truncate mt-0.5">
                  {statusMeta.title}
                </h1>
                <div className="flex items-center gap-2 mt-0.5 text-[11px]">
                  <span className="tracking-wider shrink-0">
                    {[1, 2, 3].map((s) => (
                      <span
                        key={s}
                        className={s <= starsEarned ? 'text-amber-400' : 'text-slate-600'}
                      >
                        ★
                      </span>
                    ))}
                  </span>
                  <span className="text-slate-500" aria-hidden="true">·</span>
                  <span className="font-mono font-semibold text-cyan-300 tabular-nums whitespace-nowrap">
                    +{xpEarned} XP
                  </span>
                </div>
              </div>
            </div>

            <div className="min-w-[132px] px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-400/45 flex flex-col items-end justify-center gap-0.5 shrink-0">
              <span className="text-[9px] font-bold tracking-wider text-amber-300 uppercase leading-none whitespace-nowrap">
                Reward Earned
              </span>
              <span className="font-['Orbitron'] italic font-black text-sm sm:text-base text-amber-300 tabular-nums leading-tight whitespace-nowrap">
                +🪙 {result.coinsEarned.toLocaleString()} COINS
              </span>
              <span className="text-[10px] font-mono text-slate-300 tabular-nums leading-none whitespace-nowrap">
                Total 🪙 {coins.toLocaleString()}
              </span>
            </div>
          </div>
        </div>

        {/* CENTER: Mode-Specific Result Breakdown */}
        {modeSpec.id === 'drift' ? (
          <div className="bg-[#070b14]/94 border border-white/15 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
            <div className="px-4 py-1.5 bg-slate-900/95 border-b border-white/10 flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-slate-400">
              <span>Drift Challenge Scorecard</span>
              <span>Target Tiers</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                    Total Drift Score
                  </div>
                  <div className="font-['Orbitron'] italic font-black text-3xl sm:text-4xl text-white tabular-nums leading-none mt-1">
                    {driftScore.toLocaleString()}{' '}
                    <span className="text-sm text-amber-300">PTS</span>
                  </div>
                </div>
                <div className="text-right font-mono text-xs text-slate-300 tabular-nums">
                  <div>Time {formatRaceTime(playerTime)}</div>
                  <div className="text-slate-400 text-[10px]">{equippedKit.name}</div>
                </div>
              </div>

              <div className="relative h-2.5 rounded-full bg-slate-800 overflow-hidden border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 via-amber-400 to-yellow-200"
                  style={{ width: `${Math.min(100, Math.round((driftScore / 5000) * 100))}%` }}
                />
                <div className="absolute inset-y-0 left-[30%] w-[2px] bg-white/50" />
                <div className="absolute inset-y-0 left-[60%] w-[2px] bg-white/60" />
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
                <div
                  className={`rounded-xl border px-2 py-1.5 ${
                    driftScore >= 1500
                      ? 'bg-orange-950/50 border-orange-400/60 text-orange-200'
                      : 'bg-slate-900/70 border-white/10 text-slate-400'
                  }`}
                >
                  <div className="font-['Orbitron'] italic font-bold text-[10px]">BRONZE ★</div>
                  <div className="font-bold mt-0.5">1,500 PTS</div>
                </div>
                <div
                  className={`rounded-xl border px-2 py-1.5 ${
                    driftScore >= 3000
                      ? 'bg-sky-950/50 border-sky-400/60 text-sky-200'
                      : 'bg-slate-900/70 border-white/10 text-slate-400'
                  }`}
                >
                  <div className="font-['Orbitron'] italic font-bold text-[10px]">SILVER ★★</div>
                  <div className="font-bold mt-0.5">3,000 PTS</div>
                </div>
                <div
                  className={`rounded-xl border px-2 py-1.5 ${
                    driftScore >= 5000
                      ? 'bg-amber-950/50 border-amber-400/70 text-amber-200'
                      : 'bg-slate-900/70 border-white/10 text-slate-400'
                  }`}
                >
                  <div className="font-['Orbitron'] italic font-bold text-[10px]">GOLD ★★★</div>
                  <div className="font-bold mt-0.5">5,000 PTS</div>
                </div>
              </div>
            </div>
          </div>
        ) : modeSpec.id === 'time_attack' ? (
          <div className="bg-[#070b14]/94 border border-white/15 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
            <div className="px-4 py-1.5 bg-slate-900/95 border-b border-white/10 flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-slate-400">
              <span>Solo Time Attack Pace</span>
              <span>Target Clocks</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-sky-300">
                    Official Run Time
                  </div>
                  <div className="font-['Orbitron'] italic font-black text-3xl sm:text-4xl text-white tabular-nums leading-none mt-1">
                    {formatRaceTime(playerTime)}
                  </div>
                </div>
                <div className="text-right font-mono text-xs text-slate-300 tabular-nums">
                  <div>
                    vs Gold:{' '}
                    <span
                      className={
                        playerTime <= goldTargetSec ? 'text-emerald-400 font-bold' : 'text-amber-300'
                      }
                    >
                      {playerTime <= goldTargetSec
                        ? `-${(goldTargetSec - playerTime).toFixed(2)}s`
                        : `+${(playerTime - goldTargetSec).toFixed(2)}s`}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[10px]">{equippedKit.name}</div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
                <div
                  className={`rounded-xl border px-2 py-1.5 ${
                    playerTime <= goldTargetSec
                      ? 'bg-amber-950/55 border-amber-400/75 text-amber-200'
                      : 'bg-slate-900/70 border-white/10 text-slate-400'
                  }`}
                >
                  <div className="font-['Orbitron'] italic font-bold text-[10px]">GOLD ★★★</div>
                  <div className="font-bold mt-0.5">{formatRaceTime(goldTargetSec)}</div>
                </div>
                <div
                  className={`rounded-xl border px-2 py-1.5 ${
                    playerTime <= silverTargetSec
                      ? 'bg-sky-950/50 border-sky-400/60 text-sky-200'
                      : 'bg-slate-900/70 border-white/10 text-slate-400'
                  }`}
                >
                  <div className="font-['Orbitron'] italic font-bold text-[10px]">SILVER ★★</div>
                  <div className="font-bold mt-0.5">{formatRaceTime(silverTargetSec)}</div>
                </div>
                <div
                  className={`rounded-xl border px-2 py-1.5 ${
                    playerTime <= bronzeTargetSec
                      ? 'bg-orange-950/50 border-orange-400/60 text-orange-200'
                      : 'bg-slate-900/70 border-white/10 text-slate-400'
                  }`}
                >
                  <div className="font-['Orbitron'] italic font-bold text-[10px]">BRONZE ★</div>
                  <div className="font-bold mt-0.5">{formatRaceTime(bronzeTargetSec)}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#070b14]/94 border border-white/15 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
            <div className="px-4 py-1.5 bg-slate-900/95 border-b border-white/10 flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-slate-400">
              <span>
                {modeSpec.id === 'elimination' ? 'Elimination Classification' : 'Official Standings'}
              </span>
              <span>{modeSpec.id === 'elimination' ? 'Status / Time' : 'Time / Gap'}</span>
            </div>

            <div className="divide-y divide-white/10">
              {standings.map((row) => {
                const rowEliminated =
                  modeSpec.id === 'elimination' &&
                  ((row.isPlayer && isEliminated) || (!row.isPlayer && row.pos > 1 && (!isEliminated || row.pos > rank)));
                return (
                  <div
                    key={row.pos}
                    className={`px-4 py-1.5 sm:py-2 flex items-center justify-between gap-2 ${
                      row.isPlayer ? 'bg-white/[0.06]' : 'bg-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-6 font-['Orbitron'] italic font-black text-xs sm:text-sm tabular-nums ${
                          row.isPlayer ? 'text-amber-300' : 'text-slate-400'
                        }`}
                      >
                        0{row.pos}
                      </span>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`font-['Orbitron'] italic font-black text-xs tracking-wide uppercase truncate ${
                              row.isPlayer ? 'text-white' : 'text-slate-200'
                            }`}
                          >
                            {row.driver}
                          </span>
                          {row.isPlayer && (
                            <span className="text-[10px] font-semibold text-amber-300 shrink-0">
                              · Player
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 truncate hidden sm:inline">
                            ({row.carName})
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0 font-mono tabular-nums">
                      <span
                        className={`font-bold text-xs leading-none ${
                          row.isPlayer ? 'text-white' : 'text-slate-300'
                        }`}
                      >
                        {formatRaceTime(row.totalTime)}
                      </span>
                      <span
                        className={`text-[10px] w-16 text-right leading-none ${
                          rowEliminated
                            ? 'text-rose-400 font-bold'
                            : row.pos === 1
                              ? 'text-emerald-400 font-semibold'
                              : 'text-slate-400'
                        }`}
                      >
                        {rowEliminated ? 'OUT' : row.gapText}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* BOTTOM DECK: Lap Splits & Actions */}
        <div className="bg-[#070b14]/96 border border-white/15 rounded-2xl p-3 sm:p-3.5 shadow-2xl backdrop-blur-md">
          <div className="grid grid-cols-4 gap-2 pb-2.5 mb-2.5 border-b border-white/10 text-center font-mono tabular-nums">
            <div className="bg-slate-900 border border-cyan-400/35 rounded-lg px-2 py-1.5">
              <div className="text-[9px] sm:text-[10px] font-sans font-semibold text-cyan-300 leading-none">
                Best Lap
              </div>
              <div className="text-[11px] sm:text-xs font-bold text-white mt-1 leading-none">
                {formatRaceTime(result.bestLap)}
              </div>
            </div>

            {lapValues.map((lapVal, idx) => {
              const isBest = Math.abs(lapVal - fastestLapVal) < 0.005;
              return (
                <div
                  key={idx}
                  className={`bg-slate-900/80 border rounded-lg px-2 py-1.5 ${
                    isBest ? 'border-amber-400/50' : 'border-white/10'
                  }`}
                >
                  <div className="text-[9px] sm:text-[10px] font-sans font-medium text-slate-400 leading-none">
                    Lap {idx + 1} {isBest ? '★' : ''}
                  </div>
                  <div
                    className={`text-[11px] sm:text-xs font-bold mt-1 leading-none ${
                      isBest ? 'text-amber-300' : 'text-slate-200'
                    }`}
                  >
                    {formatRaceTime(lapVal)}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={onMainMenu}
              style={{ touchAction: 'manipulation' }}
              className="col-span-1 py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 font-['Orbitron'] italic font-bold text-xs text-slate-200 uppercase cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Lobby
            </button>

            <button
              type="button"
              onClick={onOpenGarage}
              style={{ touchAction: 'manipulation' }}
              className="col-span-1 py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-400/50 font-['Orbitron'] italic font-bold text-xs text-amber-300 uppercase cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Garage
            </button>

            <button
              type="button"
              onClick={onRetryRace}
              style={{ touchAction: 'manipulation' }}
              className="col-span-2 py-2 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-amber-400 hover:from-cyan-300 hover:to-amber-300 text-slate-950 font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wider uppercase cursor-pointer active:scale-95 flex items-center justify-between gap-2 whitespace-nowrap"
            >
              <span className="truncate">
                {isNextMapQueued ? `Next · ${nextMap.shortName}` : 'Race Again'}
              </span>
              <span className="shrink-0">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
