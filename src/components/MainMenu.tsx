import React from 'react';
import { BodyKitSpec, MAP_SPECS, MapId } from '../types/game';

interface MainMenuProps {
  coins: number;
  equippedKit: BodyKitSpec;
  selectedMapId: MapId;
  autoRotateMaps: boolean;
  onSelectMap: (mapId: MapId) => void;
  onToggleAutoRotate: () => void;
  onStartRace: () => void;
  onOpenGarage: () => void;
  onOpenSettings: () => void;
}

const MAP_CARD_LABELS: Record<MapId, { line1: string; line2: string; vibe: string }> = {
  coast: { line1: 'SUNSET', line2: 'COAST', vibe: 'BEACH' },
  city: { line1: 'NEON', line2: 'CITY', vibe: 'NIGHT' },
  canyon: { line1: 'ALPINE', line2: 'PASS', vibe: 'CANYON' },
};

export const MainMenu: React.FC<MainMenuProps> = ({
  coins,
  equippedKit,
  selectedMapId,
  autoRotateMaps,
  onSelectMap,
  onToggleAutoRotate,
  onStartRace,
  onOpenGarage,
  onOpenSettings,
}) => {
  const activeMap = MAP_SPECS.find((m) => m.id === selectedMapId) || MAP_SPECS[0];

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between select-none"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.95rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.95rem, env(safe-area-inset-right))',
      }}
    >
      {/* Clean top & bottom scrims so center Pit-Lane Garage car stays 100% clear */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(6, 10, 20, 0.62) 0%, rgba(6, 10, 20, 0.0) 24%, rgba(6, 10, 20, 0.0) 58%, rgba(6, 10, 20, 0.78) 100%)',
        }}
      />

      {/* Top Bar: Clean Unclipped Title (Left) | Coins & Settings (Right) */}
      <header className="pointer-events-auto flex items-center justify-between gap-2 w-full">
        <div className="min-w-0">
          <h1
            className="font-['Orbitron'] italic font-black text-lg sm:text-3xl tracking-wider uppercase leading-none whitespace-nowrap"
            style={{
              background: 'linear-gradient(95deg, #ffffff 0%, #ffe3a8 55%, #ffaa44 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 10px rgba(0, 0, 0, 0.9))',
            }}
          >
            THE RACE 3D
          </h1>
          <div className="text-[10px] sm:text-xs font-['Orbitron'] font-bold tracking-widest text-slate-300 uppercase mt-1 leading-none">
            {equippedKit.name} · {activeMap.name}
          </div>
        </div>

        {/* Right Zone: Coin Balance + Settings Button */}
        <div className="flex items-center gap-2 shrink-0">
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-slate-950/85 border border-amber-400/50 shadow-lg backdrop-blur-sm"
            title="Coins"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0"
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
            <div className="flex flex-col justify-center gap-0.5">
              <span className="text-[8px] sm:text-[9px] font-['Orbitron'] font-bold tracking-widest text-amber-300/90 uppercase leading-none">
                COINS
              </span>
              <span className="font-mono font-bold text-xs sm:text-base text-white tabular-nums leading-none">
                {coins.toLocaleString()}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            style={{ touchAction: 'manipulation' }}
            aria-label="Settings"
            title="Settings"
            className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-slate-950/85 border border-cyan-400/45 hover:border-cyan-300 text-slate-100 hover:text-cyan-300 flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-lg backdrop-blur-sm"
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

      {/* Bottom Dock: Compact Zero-Truncation Track Picker + Crisp Action Controls */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2.5 w-full mt-auto">
        {/* Track Picker + Auto-Rotate Card */}
        <section
          aria-label="Circuit Selector"
          className="pointer-events-auto w-full sm:max-w-[355px] rounded-2xl bg-slate-950/78 border border-white/15 backdrop-blur-md p-2.5 shadow-2xl"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[10px] font-['Orbitron'] font-bold tracking-widest text-slate-200 uppercase leading-none">
              TRACK · <span style={{ color: activeMap.accentHex }}>{activeMap.lengthLabel}</span> · {activeMap.laps} LAPS
            </div>

            <button
              type="button"
              onClick={onToggleAutoRotate}
              style={{ touchAction: 'manipulation' }}
              aria-pressed={autoRotateMaps}
              className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-['Orbitron'] font-bold tracking-wider uppercase cursor-pointer transition-colors active:scale-95 ${
                autoRotateMaps
                  ? 'bg-cyan-500/20 border-cyan-400/75 text-cyan-200'
                  : 'bg-slate-900/90 border-white/20 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  autoRotateMaps ? 'bg-cyan-400 shadow-[0_0_8px_#00e5ff]' : 'bg-slate-500'
                }`}
              />
              AUTO {autoRotateMaps ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
            {MAP_SPECS.map((map) => {
              const isSelected = map.id === selectedMapId;
              const labels = MAP_CARD_LABELS[map.id];
              return (
                <button
                  key={map.id}
                  type="button"
                  onClick={() => onSelectMap(map.id)}
                  style={{
                    touchAction: 'manipulation',
                    borderColor: isSelected ? map.accentHex : 'rgba(255,255,255,0.14)',
                    boxShadow: isSelected ? `0 0 14px ${map.accentHex}38` : undefined,
                  }}
                  aria-pressed={isSelected}
                  className={`text-left rounded-xl px-2.5 py-2 border transition-all cursor-pointer active:scale-95 ${
                    isSelected
                      ? 'bg-slate-900/95 text-white'
                      : 'bg-slate-950/70 text-slate-300 hover:bg-slate-900/80 hover:text-white'
                  }`}
                >
                  <div
                    className="h-1 w-full rounded-full mb-1.5"
                    style={{
                      background: `linear-gradient(90deg, ${map.accentHex}, ${map.secondaryHex})`,
                      opacity: isSelected ? 1 : 0.4,
                    }}
                  />
                  <div className="font-['Orbitron'] italic font-black text-[11px] sm:text-xs tracking-wide leading-tight">
                    <div>{labels.line1}</div>
                    <div>{labels.line2}</div>
                  </div>
                  <div className="text-[9px] font-mono tracking-wider text-slate-400 mt-1 leading-none">
                    {labels.vibe}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Action Stack: Start Race | Garage & Settings */}
        <div className="pointer-events-auto flex flex-col gap-2 w-full sm:max-w-[280px]">
          <button
            type="button"
            onClick={onStartRace}
            className="group relative w-full py-2.5 px-4 sm:py-3.5 sm:px-5 rounded-xl border-2 border-cyan-400 bg-gradient-to-r from-cyan-500/40 via-blue-600/40 to-amber-500/40 hover:from-cyan-400/55 hover:to-amber-400/55 transition-all duration-150 hover:-translate-y-0.5 active:scale-95 cursor-pointer shadow-xl backdrop-blur-sm"
            style={{
              touchAction: 'manipulation',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.8), 0 0 20px rgba(0, 229, 255, 0.28)',
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-left">
                <div className="font-['Orbitron'] italic font-black text-base sm:text-xl text-white tracking-wider leading-none">
                  START RACE
                </div>
                <div className="text-[10px] font-['Orbitron'] font-bold text-cyan-200 tracking-widest uppercase mt-1 leading-none">
                  {activeMap.name} · {activeMap.laps} LAPS
                </div>
              </div>
              <span className="w-9 h-9 rounded-lg bg-cyan-400/20 border border-cyan-300/60 flex items-center justify-center text-cyan-200 shrink-0 group-hover:translate-x-0.5 transition-transform">
                <svg className="w-4 h-4 fill-current ml-0.5" viewBox="0 0 24 24">
                  <path d="M6 4l14 8-14 8V4z" />
                </svg>
              </span>
            </div>
          </button>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onOpenGarage}
              style={{ touchAction: 'manipulation' }}
              className="group w-full py-2.5 px-3.5 rounded-xl border border-amber-400/65 bg-slate-950/85 hover:bg-slate-900 hover:border-amber-300 transition-all duration-150 active:scale-95 cursor-pointer shadow-lg backdrop-blur-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-['Orbitron'] italic font-extrabold text-xs sm:text-base text-white tracking-wider">
                  GARAGE
                </span>
                <span className="text-amber-300 text-sm shrink-0 group-hover:translate-x-0.5 transition-transform">
                  →
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              style={{ touchAction: 'manipulation' }}
              className="group w-full py-2.5 px-3.5 rounded-xl border border-white/25 bg-slate-950/82 hover:bg-slate-900 hover:border-cyan-400/60 transition-all duration-150 active:scale-95 cursor-pointer shadow-lg backdrop-blur-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-['Orbitron'] italic font-bold text-xs sm:text-sm text-slate-200 tracking-wider">
                  SETTINGS
                </span>
                <span className="text-slate-400 group-hover:text-cyan-300 text-sm shrink-0">
                  ⚙
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
