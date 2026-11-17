import React from 'react';
import { BodyKitSpec, MapSpec, RaceFinishResult, formatRaceTime } from '../types/game';

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

  const statusMeta = [
    {
      posLabel: '1ST',
      title: 'RACE VICTORY',
      subtitle: 'CHECKERED FLAG LEADER',
      accentHex: '#f59e0b',
      borderClass: 'border-amber-400/80',
      textClass: 'text-amber-400',
    },
    {
      posLabel: '2ND',
      title: 'RUNNER-UP FINISH',
      subtitle: 'FRONT ROW QUALIFIER',
      accentHex: '#00f0ff',
      borderClass: 'border-cyan-400/80',
      textClass: 'text-cyan-300',
    },
    {
      posLabel: '3RD',
      title: 'PODIUM FINISH',
      subtitle: 'TOP 3 CLASSIFICATION',
      accentHex: '#fb923c',
      borderClass: 'border-orange-400/80',
      textClass: 'text-orange-300',
    },
    {
      posLabel: '4TH',
      title: 'RACE COMPLETED',
      subtitle: 'OFFICIAL CLASSIFICATION',
      accentHex: '#94a3b8',
      borderClass: 'border-slate-400/70',
      textClass: 'text-slate-300',
    },
  ][rank - 1];

  const playerTime = Math.max(12.0, result.totalTime || 54.0);
  const lapValues = [0, 1, 2].map((idx) => result.lapTimes[idx] ?? playerTime / 3);
  const fastestLapVal = Math.min(...lapValues);

  // Build 4-Racer Asphalt / NFS Final Standings Leaderboard anchored to the player's actual finishRank & totalTime
  const aiRoster = [
    { driver: 'VIPER GT', carName: '911 TURBO S', accentHex: '#ef4444', deltaFromSlot: 0.92 },
    { driver: 'APEX R', carName: '300SL GULLWING', accentHex: '#00f0ff', deltaFromSlot: 2.18 },
    { driver: 'NOVA X', carName: 'CAMARO SS', accentHex: '#a855f7', deltaFromSlot: 3.64 },
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
          ? Math.max(10.0, playerTime + relPos * 1.14 - (aiCursor * 0.19))
          : playerTime + relPos * 1.28 + (aiCursor * 0.23);
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

  const basePurse = rank === 1 ? 650 : rank === 2 ? 450 : rank === 3 ? 320 : 220;
  const paceBonus = Math.max(0, result.coinsEarned - basePurse);

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-auto flex flex-col justify-between select-none overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, rgba(4, 7, 15, 0.90) 0%, rgba(4, 7, 15, 0.28) 28%, rgba(4, 7, 15, 0.42) 64%, rgba(3, 6, 14, 0.96) 100%)',
        paddingTop: 'max(0.65rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.65rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      {/* TOP BAR: ASPHALT / NFS SLANTED POSITION HEADER & CREDITS */}
      <div className="w-full max-w-xl mx-auto">
        <div
          className={`relative bg-[#070b14]/95 border-l-4 border-r border-y border-white/15 px-4 py-2.5 sm:px-5 sm:py-3 shadow-2xl`}
          style={{
            borderLeftColor: statusMeta.accentHex,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              {/* Slanted Rank Number Block */}
              <div
                className="px-3 py-1.5 -skew-x-12 border flex flex-col items-center justify-center shrink-0"
                style={{
                  borderColor: statusMeta.accentHex,
                  background: 'rgba(15, 23, 42, 0.92)',
                }}
              >
                <span className="skew-x-12 font-['Orbitron'] italic font-black text-xl sm:text-2xl text-white leading-none">
                  {statusMeta.posLabel}
                </span>
                <span
                  className="skew-x-12 font-mono font-bold text-[9px] tracking-widest uppercase leading-none mt-0.5"
                  style={{ color: statusMeta.accentHex }}
                >
                  POS / 04
                </span>
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[10px] font-['Orbitron'] font-bold tracking-widest uppercase text-slate-400">
                  <span style={{ color: currentMap.accentHex }}>{currentMap.name}</span>
                  <span>·</span>
                  <span>{statusMeta.subtitle}</span>
                </div>
                <h1 className="font-['Orbitron'] italic font-black text-xl sm:text-2xl text-white tracking-wider uppercase leading-tight truncate">
                  {statusMeta.title}
                </h1>
              </div>
            </div>

            {/* Credits Earned Box */}
            <div className="px-3 py-1.5 bg-slate-900/95 border border-amber-400/50 text-right shrink-0">
              <div className="text-[9px] font-['Orbitron'] font-bold text-amber-300/90 tracking-widest uppercase leading-none">
                CREDITS
              </div>
              <div className="font-['Orbitron'] italic font-black text-lg sm:text-xl text-amber-300 tabular-nums leading-none mt-1">
                +{result.coinsEarned}
              </div>
              <div className="text-[9px] font-mono text-slate-400 tabular-nums mt-0.5 leading-none">
                CR {coins.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CENTER: 4-RACER ASPHALT / NFS STANDINGS LEADERBOARD */}
      <div className="w-full max-w-xl mx-auto my-auto py-2">
        <div className="bg-[#060a12]/90 border border-white/15 shadow-2xl overflow-hidden">
          <div className="px-3.5 py-1.5 bg-slate-900/95 border-b border-white/10 flex items-center justify-between text-[9px] font-['Orbitron'] font-bold tracking-widest text-slate-400 uppercase">
            <span>OFFICIAL STANDINGS</span>
            <span>TIME / GAP</span>
          </div>

          <div className="divide-y divide-white/10">
            {standings.map((row) => (
              <div
                key={row.pos}
                className={`px-3.5 py-2 sm:py-2.5 flex items-center justify-between gap-2 transition-colors ${
                  row.isPlayer ? 'bg-slate-900/95' : 'bg-[#070b14]/80'
                }`}
                style={{
                  borderLeft: row.isPlayer
                    ? `4px solid ${row.accentHex}`
                    : '4px solid transparent',
                }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-6 font-['Orbitron'] italic font-black text-sm sm:text-base tabular-nums ${
                      row.isPlayer ? 'text-amber-300' : 'text-slate-400'
                    }`}
                  >
                    0{row.pos}
                  </span>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wider uppercase truncate ${
                          row.isPlayer ? 'text-white' : 'text-slate-200'
                        }`}
                      >
                        {row.driver}
                      </span>
                      {row.isPlayer && (
                        <span
                          className="px-1.5 py-0.5 text-[8px] font-['Orbitron'] font-black uppercase text-slate-950 leading-none"
                          style={{ backgroundColor: row.accentHex }}
                        >
                          PLAYER
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] font-mono text-slate-400 uppercase truncate">
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
                    className={`text-[10px] mt-1 leading-none ${
                      row.pos === 1 ? 'text-emerald-400 font-bold' : 'text-slate-400'
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

      {/* BOTTOM DECK: TELEMETRY SPLITS & ACTION BUTTONS */}
      <div className="w-full max-w-xl mx-auto">
        <div className="bg-[#070b14]/95 border border-white/15 p-3 sm:p-4 shadow-2xl">
          {/* Lap Splits & Best Lap Inline Bar */}
          <div className="grid grid-cols-4 gap-1.5 pb-2.5 mb-3 border-b border-white/10 text-center font-mono tabular-nums">
            <div className="bg-slate-900/90 border border-cyan-400/40 px-2 py-1.5">
              <div className="text-[8px] font-['Orbitron'] font-bold text-cyan-300 uppercase leading-none">
                BEST LAP
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
                  className={`bg-slate-900/80 border px-2 py-1.5 ${
                    isBest ? 'border-amber-400/60' : 'border-white/10'
                  }`}
                >
                  <div className="text-[8px] font-['Orbitron'] font-bold text-slate-400 uppercase leading-none">
                    LAP {idx + 1} {isBest ? '★' : ''}
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

          {/* Reward Sub-strip */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 mb-2.5">
            <div>
              PURSE <span className="text-amber-300 font-bold">+{basePurse}</span>
              {paceBonus > 0 && (
                <>
                  {' '}
                  · PACE BONUS <span className="text-cyan-300 font-bold">+{paceBonus}</span>
                </>
              )}
            </div>
            <div className="uppercase tracking-wider font-['Orbitron'] text-[9px] text-slate-400">
              HIGHWAY CRUISE ACTIVE
            </div>
          </div>

          {/* Action Row */}
          <div className="grid grid-cols-4 gap-2">
            <button
              type="button"
              onClick={onMainMenu}
              style={{ touchAction: 'manipulation' }}
              className="col-span-1 py-2.5 px-2 bg-slate-900 hover:bg-slate-800 border border-white/25 font-['Orbitron'] italic font-bold text-xs sm:text-sm text-slate-200 tracking-wider uppercase cursor-pointer transition-transform active:scale-95"
            >
              MENU
            </button>

            <button
              type="button"
              onClick={onOpenGarage}
              style={{ touchAction: 'manipulation' }}
              className="col-span-1 py-2.5 px-2 bg-amber-500/20 hover:bg-amber-500/35 border-2 border-amber-400/80 font-['Orbitron'] italic font-black text-xs sm:text-sm text-amber-200 tracking-wider uppercase cursor-pointer transition-transform active:scale-95"
            >
              GARAGE
            </button>

            <button
              type="button"
              onClick={onRetryRace}
              style={{
                touchAction: 'manipulation',
                borderColor: isNextMapQueued ? nextMap.accentHex : statusMeta.accentHex,
              }}
              className="col-span-2 py-2 px-3.5 bg-gradient-to-r from-amber-500/30 via-rose-500/25 to-cyan-500/30 hover:from-amber-500/45 hover:to-cyan-500/45 border-2 font-['Orbitron'] italic font-black text-white tracking-wider uppercase cursor-pointer transition-transform active:scale-95 flex items-center justify-between gap-2"
            >
              <div className="text-left min-w-0">
                <div className="text-xs sm:text-sm leading-tight truncate">
                  {isNextMapQueued ? `NEXT · ${nextMap.name}` : 'RACE AGAIN'}
                </div>
                <div className="text-[9px] font-mono not-italic text-slate-300 tracking-wide truncate leading-none mt-0.5">
                  {isNextMapQueued ? nextMap.subtitle : currentMap.name}
                </div>
              </div>
              <span className="text-sm sm:text-base shrink-0">→</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
