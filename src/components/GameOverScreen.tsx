import React from 'react';
import { BodyKitSpec, RaceFinishResult, formatRaceTime } from '../types/game';

interface GameOverScreenProps {
  result: RaceFinishResult;
  coins: number;
  equippedKit: BodyKitSpec;
  onRetryRace: () => void;
  onOpenGarage: () => void;
  onMainMenu: () => void;
}

export const GameOverScreen: React.FC<GameOverScreenProps> = ({
  result,
  coins,
  equippedKit,
  onRetryRace,
  onOpenGarage,
  onMainMenu,
}) => {
  const rank = result.finishRank || 1;
  const rankMeta = [
    { title: '1ST PLACE · GOLD CHAMPION', badge: '🥇 1ST', color: 'from-amber-400 to-yellow-300', text: 'text-amber-300', border: 'border-amber-400', glow: 'rgba(251, 191, 36, 0.4)' },
    { title: '2ND PLACE · SILVER PODIUM', badge: '🥈 2ND', color: 'from-slate-200 to-cyan-300', text: 'text-cyan-200', border: 'border-cyan-400', glow: 'rgba(56, 189, 248, 0.3)' },
    { title: '3RD PLACE · BRONZE PODIUM', badge: '🥉 3RD', color: 'from-amber-600 to-orange-400', text: 'text-orange-300', border: 'border-amber-600', glow: 'rgba(217, 119, 6, 0.3)' },
    { title: '4TH PLACE · RACER FINISHER', badge: '🏁 4TH', color: 'from-slate-400 to-slate-200', text: 'text-slate-300', border: 'border-slate-500', glow: 'rgba(148, 163, 184, 0.2)' },
  ][Math.min(3, Math.max(0, rank - 1))];

  return (
    <div
      className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center px-5 py-4 select-none"
      style={{
        background:
          'radial-gradient(ellipse 75% 70% at 50% 50%, rgba(6, 12, 26, 0.88) 0%, rgba(2, 4, 10, 0.98) 100%)',
      }}
    >
      <div
        className="w-full max-w-xl bg-slate-950/95 border-2 rounded-2xl p-5 sm:p-7 shadow-2xl text-center relative overflow-hidden"
        style={{ borderColor: rank === 1 ? '#f59e0b' : '#38bdf8', boxShadow: `0 0 35px ${rankMeta.glow}` }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-1.5"
          style={{
            background:
              rank === 1
                ? 'linear-gradient(90deg, #ffaa00 0%, #fff 50%, #ffaa00 100%)'
                : 'linear-gradient(90deg, #38bdf8 0%, #fff 50%, #00f0ff 100%)',
          }}
        />

        {/* Podium Finish Badge */}
        <div className="flex items-center justify-center gap-2 mb-1">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border ${rankMeta.border} font-['Orbitron'] font-black text-xs sm:text-sm tracking-wider uppercase ${rankMeta.text}`}>
            <span>{rankMeta.badge}</span>
            <span className="text-white/60">|</span>
            <span>{rankMeta.title}</span>
          </div>
        </div>

        <h1
          className="font-['Orbitron'] italic font-black text-2xl sm:text-4xl uppercase tracking-wider mt-1"
          style={{
            background: rank === 1 ? 'linear-gradient(95deg, #ffffff 0%, #ffe3a8 55%, #ffaa44 100%)' : 'linear-gradient(95deg, #ffffff 0%, #93c5fd 55%, #38bdf8 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          {rank === 1 ? 'VICTORY!' : 'RACE COMPLETE'}
        </h1>

        {/* Total Time & Best Lap Readout */}
        <div className="grid grid-cols-2 gap-3 my-4 bg-slate-900/90 border border-white/10 rounded-xl p-3.5">
          <div>
            <div className="text-[10px] font-['Orbitron'] tracking-[0.16em] text-slate-400 uppercase">
              TOTAL RACE TIME
            </div>
            <div className="font-['Orbitron'] italic font-black text-xl sm:text-3xl text-white tabular-nums mt-1">
              {formatRaceTime(result.totalTime)}
            </div>
          </div>

          <div>
            <div className="text-[10px] font-['Orbitron'] tracking-[0.16em] text-cyan-300 uppercase">
              BEST LAP TIME
            </div>
            <div className="font-['Orbitron'] italic font-black text-xl sm:text-3xl text-cyan-300 tabular-nums mt-1">
              {formatRaceTime(result.bestLap)}
            </div>
          </div>
        </div>

        {/* Individual Lap Splits & Coins Rewarded */}
        <div className="grid grid-cols-2 gap-3 mb-5 text-left">
          <div className="bg-slate-900/80 border border-white/10 rounded-xl p-3">
            <div className="text-[10px] font-['Orbitron'] tracking-[0.14em] text-slate-400 uppercase mb-1.5 truncate">
              LAP SPLITS · {equippedKit.name}
            </div>
            <div className="flex flex-col gap-1 text-xs font-mono tabular-nums">
              {[0, 1, 2].map((idx) => {
                const lapVal = result.lapTimes[idx] ?? result.totalTime / 3;
                return (
                  <div key={idx} className="flex justify-between text-slate-200">
                    <span>LAP {idx + 1}</span>
                    <span className="font-bold text-white">{formatRaceTime(lapVal)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-amber-500/10 border border-amber-400/40 rounded-xl p-3 flex flex-col justify-between">
            <div className="text-[10px] font-['Orbitron'] tracking-[0.14em] text-amber-300 uppercase">
              RACE REWARD
            </div>
            <div className="font-['Orbitron'] italic font-black text-xl sm:text-2xl text-amber-300 tabular-nums my-0.5">
              +{result.coinsEarned} COINS
            </div>
            <div className="text-[11px] font-mono text-slate-300 tabular-nums">
              BALANCE: <span className="text-white font-bold">{coins.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              onOpenGarage();
            }}
            onClick={onOpenGarage}
            className="flex-1 min-w-[160px] py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500/40 to-cyan-500/40 border-2 border-amber-400 hover:border-white font-['Orbitron'] italic font-black text-xs sm:text-sm text-white tracking-wider uppercase cursor-pointer transition-transform active:scale-95 shadow-lg"
          >
            RETURN TO GARAGE
          </button>

          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              onRetryRace();
            }}
            onClick={onRetryRace}
            className="py-3 px-5 rounded-xl bg-cyan-500/25 hover:bg-cyan-500/40 border-2 border-cyan-400 font-['Orbitron'] italic font-black text-xs sm:text-sm text-white tracking-wider uppercase cursor-pointer transition-transform active:scale-95"
          >
            RACE AGAIN ↻
          </button>

          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              onMainMenu();
            }}
            onClick={onMainMenu}
            className="py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/25 font-['Orbitron'] italic font-bold text-xs sm:text-sm text-slate-200 tracking-wider uppercase cursor-pointer transition-transform active:scale-95"
          >
            MENU
          </button>
        </div>
      </div>
    </div>
  );
};
