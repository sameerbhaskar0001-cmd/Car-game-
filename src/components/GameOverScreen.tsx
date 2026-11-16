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
  const rank = result.finishRank || 1;
  const isNextMapQueued = autoRotateMaps && nextMap.id !== currentMap.id;

  const rankMeta = [
    {
      pos: '1ST',
      headline: 'VICTORY!',
      badge: '🥇',
      text: 'text-amber-300',
      border: 'border-amber-400/70',
      accentHex: '#f59e0b',
      glow: 'rgba(251, 191, 36, 0.35)',
    },
    {
      pos: '2ND',
      headline: '2ND PLACE',
      badge: '🥈',
      text: 'text-cyan-200',
      border: 'border-cyan-400/70',
      accentHex: '#38bdf8',
      glow: 'rgba(56, 189, 248, 0.3)',
    },
    {
      pos: '3RD',
      headline: '3RD PLACE',
      badge: '🥉',
      text: 'text-orange-300',
      border: 'border-amber-500/70',
      accentHex: '#fb923c',
      glow: 'rgba(217, 119, 6, 0.28)',
    },
    {
      pos: '4TH',
      headline: 'FINISHED',
      badge: '🏁',
      text: 'text-slate-200',
      border: 'border-slate-500/70',
      accentHex: '#64748b',
      glow: 'rgba(148, 163, 184, 0.2)',
    },
  ][Math.min(3, Math.max(0, rank - 1))];

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center select-none"
      style={{
        background:
          'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(6, 12, 26, 0.88) 0%, rgba(2, 4, 10, 0.98) 100%)',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div
        className="w-full max-w-xl overflow-y-auto bg-slate-950/95 border-2 rounded-2xl p-4 sm:p-6 shadow-2xl relative"
        style={{
          maxHeight:
            'calc(100dvh - max(1.5rem, env(safe-area-inset-top) + env(safe-area-inset-bottom)))',
          borderColor: rankMeta.accentHex,
          boxShadow: `0 0 32px ${rankMeta.glow}`,
        }}
      >
        {/* Top Row: Podium Position + Headline (Left) | Coins Earned & Total (Right) */}
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`px-3 py-1.5 rounded-xl bg-slate-900 border ${rankMeta.border} flex items-center gap-1.5 shrink-0`}
            >
              <span className="text-base sm:text-lg leading-none">{rankMeta.badge}</span>
              <span
                className={`font-['Orbitron'] italic font-black text-sm sm:text-base leading-none ${rankMeta.text}`}
              >
                {rankMeta.pos}
              </span>
            </div>

            <div className="min-w-0">
              <h1
                className="font-['Orbitron'] italic font-black text-xl sm:text-3xl uppercase tracking-wider leading-none truncate"
                style={{
                  background:
                    rank === 1
                      ? 'linear-gradient(95deg, #ffffff 0%, #ffe3a8 55%, #ffaa44 100%)'
                      : 'linear-gradient(95deg, #ffffff 0%, #93c5fd 55%, #38bdf8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {rankMeta.headline}
              </h1>
              <div className="text-[10px] font-['Orbitron'] font-bold text-slate-400 tracking-widest uppercase mt-1 leading-none truncate">
                <span style={{ color: currentMap.accentHex }}>{currentMap.name}</span> ·{' '}
                <span className="text-cyan-300">{equippedKit.name}</span>
              </div>
            </div>
          </div>

          <div className="px-3.5 py-2 rounded-xl bg-amber-500/12 border border-amber-400/45 text-right shrink-0">
            <div className="font-['Orbitron'] italic font-black text-base sm:text-xl text-amber-300 tabular-nums leading-none">
              +{result.coinsEarned}
            </div>
            <div className="text-[10px] font-mono text-slate-300 tabular-nums mt-1 leading-none">
              BAL {coins.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Middle Row: Total & Best Time (Left) + 3 Lap Splits (Right) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-3.5">
          {/* Total Time & Best Lap */}
          <div className="grid grid-cols-2 gap-2.5 bg-slate-900/90 border border-white/10 rounded-xl p-3">
            <div className="flex flex-col justify-center">
              <span className="text-[9px] font-['Orbitron'] font-bold tracking-wider text-slate-400 uppercase leading-none">
                TOTAL TIME
              </span>
              <span className="font-['Orbitron'] italic font-black text-lg sm:text-2xl text-white tabular-nums mt-1.5 leading-none">
                {formatRaceTime(result.totalTime)}
              </span>
            </div>

            <div className="flex flex-col justify-center border-l border-white/10 pl-2.5">
              <span className="text-[9px] font-['Orbitron'] font-bold tracking-wider text-cyan-300 uppercase leading-none">
                BEST LAP
              </span>
              <span className="font-['Orbitron'] italic font-black text-lg sm:text-2xl text-cyan-300 tabular-nums mt-1.5 leading-none">
                {formatRaceTime(result.bestLap)}
              </span>
            </div>
          </div>

          {/* Compact Lap Splits */}
          <div className="bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 flex flex-col justify-center gap-1">
            {[0, 1, 2].map((idx) => {
              const lapVal = result.lapTimes[idx] ?? result.totalTime / 3;
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between text-xs font-mono tabular-nums leading-tight"
                >
                  <span className="text-slate-400 font-semibold">LAP {idx + 1}</span>
                  <span className="font-bold text-white">{formatRaceTime(lapVal)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Action Bar — strictly single-tap onClick handlers */}
        <div className="grid grid-cols-4 gap-2.5 pt-0.5">
          <button
            type="button"
            onClick={onMainMenu}
            style={{ touchAction: 'manipulation' }}
            className="col-span-1 py-2.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/25 font-['Orbitron'] italic font-bold text-xs sm:text-sm text-slate-200 tracking-wider uppercase cursor-pointer transition-transform active:scale-95"
          >
            MENU
          </button>

          <button
            type="button"
            onClick={onOpenGarage}
            style={{ touchAction: 'manipulation' }}
            className="col-span-1 py-2.5 px-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/35 border-2 border-amber-400/75 font-['Orbitron'] italic font-black text-xs sm:text-sm text-amber-200 tracking-wider uppercase cursor-pointer transition-transform active:scale-95"
          >
            GARAGE
          </button>

          <button
            type="button"
            onClick={onRetryRace}
            style={{
              touchAction: 'manipulation',
              borderColor: isNextMapQueued ? nextMap.accentHex : '#67e8f9',
            }}
            className="col-span-2 py-2 px-3.5 rounded-xl bg-cyan-500/30 hover:bg-cyan-500/45 border-2 font-['Orbitron'] italic font-black text-white tracking-wider uppercase cursor-pointer transition-transform active:scale-95 shadow-lg flex items-center justify-between gap-2"
          >
            <div className="text-left min-w-0">
              <div className="text-xs sm:text-sm leading-tight truncate">
                {isNextMapQueued ? `NEXT MAP · ${nextMap.name}` : 'RACE AGAIN'}
              </div>
              <div className="text-[9px] font-mono not-italic text-cyan-200/90 tracking-wide truncate leading-none mt-0.5">
                {isNextMapQueued ? `AUTO-ROTATE · ${nextMap.subtitle}` : currentMap.name}
              </div>
            </div>
            <span className="text-sm sm:text-base shrink-0">→</span>
          </button>
        </div>
      </div>
    </div>
  );
};
