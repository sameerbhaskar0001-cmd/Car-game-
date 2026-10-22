import React from 'react';
import { BodyKitSpec } from '../types/game';

interface MainMenuProps {
  coins: number;
  equippedKit: BodyKitSpec;
  onStartRace: () => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  coins,
  onStartRace,
  onOpenGarage,
  onOpenSettings,
}) => {
  return (
    <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between px-6 py-5 sm:px-10 sm:py-7 select-none">
      {/* Subtle Right Vignette so 3D Rotating Turntable shines on the left/center */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, rgba(4, 7, 15, 0.25) 0%, rgba(4, 7, 15, 0.05) 45%, rgba(4, 7, 15, 0.82) 100%)',
        }}
      />

      {/* Top Bar: Main Title (Left) | Coin Balance & Settings (Right) */}
      <header className="pointer-events-auto flex items-center justify-between gap-6 w-full">
        <h1
          className="font-['Orbitron'] italic font-black text-xl sm:text-3xl tracking-wider uppercase whitespace-nowrap"
          style={{
            background: 'linear-gradient(95deg, #ffffff 0%, #ffe3a8 55%, #ffaa44 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 3px 12px rgba(0, 0, 0, 0.85))',
          }}
        >
          The Race: Car Driving 3D
        </h1>

        {/* Right Zone: Coin Balance + Settings Button */}
        <div className="flex items-center gap-3 shrink-0">
          <div
            className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-slate-950/85 border border-amber-400/50 shadow-lg"
            title="Coins"
          >
            <svg
              className="w-5 h-5 text-amber-400 shrink-0"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" fill="#f59e0b" />
              <circle cx="12" cy="12" r="7.5" fill="#fbbf24" />
              <path
                d="M12 7.5v9M9.5 10h5a1.5 1.5 0 0 1 0 3h-5a1.5 1.5 0 0 0 0 3h5"
                stroke="#78350f"
                strokeWidth="1.8"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
            <div className="flex flex-col leading-none">
              <span className="text-[9px] font-['Orbitron'] tracking-widest text-amber-300/80 uppercase">
                COINS
              </span>
              <span className="font-mono font-bold text-base sm:text-lg text-white tabular-nums">
                {coins.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            title="Settings"
            className="w-11 h-11 rounded-lg bg-slate-950/85 border border-cyan-400/45 hover:border-cyan-300 text-slate-100 hover:text-cyan-300 flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-lg"
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.1"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Middle Row: Unobstructed 3D Showroom (Left) + Clean Core Navigation Buttons (Right) */}
      <div className="flex items-center justify-end w-full my-auto">
        <div className="pointer-events-auto flex flex-col gap-3.5 w-full max-w-[280px] sm:max-w-[320px]">
          {/* Start Race Button */}
          <button
            type="button"
            onClick={onStartRace}
            className="group relative w-full py-4 px-6 rounded-lg border-2 border-cyan-400 bg-gradient-to-r from-cyan-500/35 via-blue-600/35 to-amber-500/35 hover:from-cyan-400/50 hover:to-amber-400/50 transition-all duration-150 hover:-translate-y-0.5 active:scale-98 cursor-pointer shadow-xl"
            style={{
              transform: 'skewX(-10deg)',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.85), 0 0 24px rgba(0, 229, 255, 0.35)',
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{ transform: 'skewX(10deg)' }}
            >
              <span className="font-['Orbitron'] italic font-black text-xl sm:text-2xl text-white tracking-wider">
                START RACE
              </span>
              <span className="w-10 h-10 rounded-md bg-cyan-400/20 border border-cyan-300/60 flex items-center justify-center text-cyan-200 group-hover:translate-x-1 transition-transform">
                ▶
              </span>
            </div>
          </button>

          {/* Garage Button */}
          <button
            type="button"
            onClick={onOpenGarage}
            className="group relative w-full py-3.5 px-6 rounded-lg border border-amber-400/60 bg-slate-950/85 hover:bg-slate-900 hover:border-amber-300 transition-all duration-150 hover:-translate-y-0.5 active:scale-98 cursor-pointer shadow-lg"
            style={{
              transform: 'skewX(-10deg)',
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{ transform: 'skewX(10deg)' }}
            >
              <span className="font-['Orbitron'] italic font-extrabold text-lg sm:text-xl text-white tracking-wider">
                GARAGE
              </span>
              <span className="text-amber-300 text-base group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
          </button>

          {/* Settings Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="group relative w-full py-3 px-6 rounded-lg border border-white/20 bg-slate-950/80 hover:bg-slate-900 hover:border-cyan-400/60 transition-all duration-150 hover:-translate-y-0.5 active:scale-98 cursor-pointer shadow-lg"
            style={{
              transform: 'skewX(-10deg)',
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{ transform: 'skewX(10deg)' }}
            >
              <span className="font-['Orbitron'] italic font-bold text-base sm:text-lg text-slate-200 tracking-wider">
                SETTINGS
              </span>
              <span className="text-slate-400 group-hover:text-cyan-300 text-sm">
                ⚙
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Bottom spacer (clean empty footer to keep the 3D turntable visible) */}
      <div className="h-4" />
    </div>
  );
};
