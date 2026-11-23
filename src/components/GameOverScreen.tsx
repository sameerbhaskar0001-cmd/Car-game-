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

  const statusMeta = [
    {
      posLabel: '1ST',
      title: 'Race Victory',
      subtitle: 'Checkered Flag Leader',
      accentHex: '#f59e0b',
    },
    {
      posLabel: '2ND',
      title: 'Runner-Up Finish',
      subtitle: 'Front Row Qualifier',
      accentHex: '#06b6d4',
    },
    {
      posLabel: '3RD',
      title: 'Podium Finish',
      subtitle: 'Top 3 Classification',
      accentHex: '#fb923c',
    },
    {
      posLabel: '4TH',
      title: 'Race Completed',
      subtitle: 'Official Classification',
      accentHex: '#94a3b8',
    },
  ][rank - 1];

  const playerTime = Math.max(12.0, result.totalTime || 54.0);
  const lapValues = [0, 1, 2].map((idx) => result.lapTimes[idx] ?? playerTime / 3);
  const fastestLapVal = Math.min(...lapValues);

  const aiRoster = [
    { driver: 'VIPER GT', carName: 'BOLT V12', accentHex: '#ef4444' },
    { driver: 'APEX R', carName: 'REDLINE GT', accentHex: '#06b6d4' },
    { driver: 'NOVA X', carName: 'BLAZE V8', accentHex: '#f59e0b' },
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
      className="fixed inset-0 z-50 pointer-events-auto flex flex-col justify-between select-none overflow-hidden font-['Plus_Jakarta_Sans']"
      style={{
        background:
          'linear-gradient(180deg, rgba(4, 7, 15, 0.90) 0%, rgba(4, 7, 15, 0.45) 35%, rgba(4, 7, 15, 0.65) 68%, rgba(3, 6, 14, 0.96) 100%)',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.85rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.85rem, env(safe-area-inset-right))',
      }}
    >
      {/* TOP BAR: Result Summary & Rewards */}
      <div className="w-full max-w-xl mx-auto">
        <div className="bg-[#070b14]/95 border border-white/15 rounded-2xl px-4 py-3 sm:px-5 sm:py-3.5 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              <div
                className="px-3.5 py-2 rounded-xl border flex flex-col items-center justify-center shrink-0 bg-slate-900/90"
                style={{ borderColor: statusMeta.accentHex }}
              >
                <span className="font-['Orbitron'] italic font-black text-xl sm:text-2xl text-white leading-none">
                  {statusMeta.posLabel}
                </span>
                <span
                  className="font-mono font-bold text-[10px] leading-none mt-1"
                  style={{ color: statusMeta.accentHex }}
                >
                  POS / 04
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <span style={{ color: currentMap.accentHex }}>{currentMap.name}</span>
                  <span aria-hidden="true">·</span>
                  <span>{modeSpec.name}</span>
                </div>
                <h1 className="font-['Orbitron'] italic font-black text-lg sm:text-2xl text-white tracking-wider uppercase leading-tight truncate mt-0.5">
                  {statusMeta.title}
                </h1>
                <div className="flex items-center gap-2 mt-1 text-xs">
                  <span className="tracking-wider">
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
                  <span className="font-mono font-semibold text-cyan-300 tabular-nums">
                    +{xpEarned} XP
                  </span>
                </div>
              </div>
            </div>

            <div className="px-3.5 py-2 rounded-xl bg-slate-900/90 border border-amber-400/40 text-right shrink-0">
              <div className="text-[10px] font-semibold text-amber-300 uppercase leading-none">
                Earned
              </div>
              <div className="font-['Orbitron'] italic font-black text-lg sm:text-xl text-amber-300 tabular-nums leading-none mt-1">
                +{result.coinsEarned} CR
              </div>
              <div className="text-[10px] font-mono text-slate-400 tabular-nums mt-1 leading-none">
                Total {coins.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CENTER: Official Standings Table */}
      <div className="w-full max-w-xl mx-auto my-auto py-2">
        <div className="bg-[#070b14]/92 border border-white/15 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md">
          <div className="px-4 py-2 bg-slate-900/90 border-b border-white/10 flex items-center justify-between text-[11px] font-semibold text-slate-400">
            <span>Official Standings</span>
            <span>Time / Gap</span>
          </div>

          <div className="divide-y divide-white/10">
            {standings.map((row) => (
              <div
                key={row.pos}
                className={`px-4 py-2.5 flex items-center justify-between gap-2 ${
                  row.isPlayer ? 'bg-white/[0.06]' : 'bg-transparent'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-6 font-['Orbitron'] italic font-black text-sm tabular-nums ${
                      row.isPlayer ? 'text-amber-300' : 'text-slate-400'
                    }`}
                  >
                    0{row.pos}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wide uppercase truncate ${
                          row.isPlayer ? 'text-white' : 'text-slate-200'
                        }`}
                      >
                        {row.driver}
                      </span>
                      {row.isPlayer && (
                        <span className="text-[11px] font-semibold text-amber-300">
                          · Player
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {row.carName}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono tabular-nums">
                  <div
                    className={`font-bold text-xs sm:text-sm leading-none ${
                      row.isPlayer ? 'text-white' : 'text-slate-300'
                    }`}
                  >
                    {formatRaceTime(row.totalTime)}
                  </div>
                  <div
                    className={`text-[11px] mt-1 leading-none ${
                      row.pos === 1 ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                    }`}
                  >
                    {row.gapText}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BOTTOM DECK: Lap Splits & Actions */}
      <div className="w-full max-w-xl mx-auto">
        <div className="bg-[#070b14]/95 border border-white/15 rounded-2xl p-3.5 sm:p-4 shadow-2xl backdrop-blur-md">
          <div className="grid grid-cols-4 gap-2 pb-3 mb-3 border-b border-white/10 text-center font-mono tabular-nums">
            <div className="bg-slate-900/90 border border-cyan-400/35 rounded-lg px-2 py-1.5">
              <div className="text-[10px] font-sans font-semibold text-cyan-300 leading-none">
                Best Lap
              </div>
              <div className="text-xs sm:text-sm font-bold text-white mt-1 leading-none">
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
                  <div className="text-[10px] font-sans font-medium text-slate-400 leading-none">
                    Lap {idx + 1} {isBest ? '★' : ''}
                  </div>
                  <div
                    className={`text-xs sm:text-sm font-bold mt-1 leading-none ${
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
              className="col-span-1 py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 font-['Orbitron'] italic font-bold text-xs text-slate-200 uppercase cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Lobby
            </button>

            <button
              type="button"
              onClick={onOpenGarage}
              style={{ touchAction: 'manipulation' }}
              className="col-span-1 py-2.5 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-400/50 font-['Orbitron'] italic font-bold text-xs text-amber-300 uppercase cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Garage
            </button>

            <button
              type="button"
              onClick={onRetryRace}
              style={{ touchAction: 'manipulation' }}
              className="col-span-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-amber-400 hover:from-cyan-300 hover:to-amber-300 text-slate-950 font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wider uppercase cursor-pointer active:scale-95 flex items-center justify-between gap-2 whitespace-nowrap"
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
