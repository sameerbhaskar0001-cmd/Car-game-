import React from 'react';
import {
  BODY_KITS,
  BodyKitSpec,
  DriverLevelInfo,
  MAP_SPECS,
  MapId,
  RACE_MODES,
  RaceModeId,
  WEATHER_SPECS,
  WeatherMode,
} from '../types/game';
import { WeatherIcon } from './WeatherIcon';

interface MainMenuProps {
  coins: number;
  driverLevel: DriverLevelInfo;
  equippedKit: BodyKitSpec;
  equippedCarClass: 'D' | 'C' | 'B' | 'A' | 'S';
  equippedCarPR: number;
  unlockedCount: number;
  claimableMissionsCount: number;
  selectedMapId: MapId;
  selectedModeId: RaceModeId;
  weatherMode: WeatherMode;
  onCycleWeather: () => void;
  onStartRace: () => void;
  onOpenEvents: () => void;
  onOpenGarage: () => void;
  onOpenMissions: () => void;
  onOpenSettings: () => void;
}

export const MainMenu: React.FC<MainMenuProps> = ({
  coins,
  driverLevel,
  equippedKit,
  equippedCarClass,
  equippedCarPR,
  unlockedCount,
  claimableMissionsCount,
  selectedMapId,
  selectedModeId,
  weatherMode,
  onCycleWeather,
  onStartRace,
  onOpenEvents,
  onOpenGarage,
  onOpenMissions,
  onOpenSettings,
}) => {
  const activeMap = MAP_SPECS.find((m) => m.id === selectedMapId) || MAP_SPECS[0];
  const activeMode = RACE_MODES.find((m) => m.id === selectedModeId) || RACE_MODES[0];
  const activeWeather =
    WEATHER_SPECS.find((w) => w.id === weatherMode) || WEATHER_SPECS[0];

  const classColorMap: Record<'D' | 'C' | 'B' | 'A' | 'S', string> = {
    D: 'bg-slate-600 text-white',
    C: 'bg-sky-500 text-slate-950',
    B: 'bg-emerald-400 text-slate-950',
    A: 'bg-amber-400 text-slate-950',
    S: 'bg-rose-500 text-white',
  };

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
            'linear-gradient(180deg, rgba(5, 9, 18, 0.72) 0%, rgba(5, 9, 18, 0.08) 24%, rgba(5, 9, 18, 0.04) 68%, rgba(5, 9, 18, 0.82) 100%)',
        }}
      />

      {/* TOP BAR: Brand + Driver Rank (Left) | Weather, Credits, Settings (Right) */}
      <header className="pointer-events-auto flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-4 min-w-0">
          <div className="min-w-0">
            <h1
              className="font-['Orbitron'] italic font-black text-lg sm:text-2xl tracking-wider uppercase leading-none whitespace-nowrap"
              style={{
                background: 'linear-gradient(95deg, #ffffff 0%, #fde68a 58%, #f59e0b 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              THE RACE 3D
            </h1>
            <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-300 leading-none whitespace-nowrap">
              <span className="font-mono font-bold text-amber-300 tabular-nums">
                LVL {driverLevel.level}
              </span>
              <span className="text-slate-500" aria-hidden="true">·</span>
              <span className="font-medium text-slate-200 truncate">{driverLevel.title}</span>
              <div className="hidden sm:block w-16 h-1 bg-white/15 rounded-full overflow-hidden ml-1">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${driverLevel.progressPct}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onCycleWeather}
            style={{ touchAction: 'manipulation' }}
            aria-label={`Weather: ${activeWeather.label}. Click to cycle.`}
            title={`Weather: ${activeWeather.label} (Press T)`}
            className="h-10 px-3 rounded-lg bg-[#070b14]/85 border border-white/15 hover:border-white/35 text-slate-100 flex items-center gap-2 transition-colors active:scale-95 cursor-pointer backdrop-blur-md whitespace-nowrap shrink-0"
          >
            <span style={{ color: activeWeather.accentHex }} className="shrink-0">
              <WeatherIcon mode={weatherMode} className="w-4 h-4" />
            </span>
            <span className="hidden sm:inline text-xs font-semibold text-slate-200">
              {activeWeather.shortLabel}
            </span>
          </button>

          <div
            className="h-10 flex items-center gap-2 px-3 rounded-lg bg-[#070b14]/85 border border-amber-400/40 backdrop-blur-md shrink-0"
            title="Credits"
          >
            <span className="font-['Orbitron'] font-bold text-[10px] tracking-wider text-amber-400">
              CR
            </span>
            <span className="font-mono font-bold text-sm text-white tabular-nums">
              {coins.toLocaleString()}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            style={{ touchAction: 'manipulation' }}
            aria-label="Settings"
            title="Settings"
            className="w-10 h-10 rounded-lg bg-[#070b14]/85 border border-white/15 hover:border-cyan-400/60 text-slate-200 hover:text-cyan-300 flex items-center justify-center transition-colors active:scale-95 cursor-pointer backdrop-blur-md shrink-0"
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

      {/* MIDDLE ROW: Compact Left Hub Rail (Asphalt Legends / Forza Horizon style) */}
      <div className="flex-1 flex items-center justify-start my-auto py-3">
        <nav
          aria-label="Lobby Navigation"
          className="pointer-events-auto flex flex-col gap-2 w-44 sm:w-52"
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
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
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
      </div>

      {/* BOTTOM DOCK: Equipped Car Telemetry Strip (Left) | Primary START RACE CTA (Right) */}
      <footer className="pointer-events-auto flex items-end justify-between gap-3 w-full">
        {/* Equipped Machine Info */}
        <button
          type="button"
          onClick={onOpenGarage}
          style={{ touchAction: 'manipulation' }}
          className="hidden sm:flex items-center gap-3.5 px-4 py-3 rounded-xl bg-[#070b14]/85 hover:bg-[#0c1324]/92 border border-white/15 hover:border-amber-400/50 backdrop-blur-md transition-colors cursor-pointer text-left"
        >
          <div
            className={`w-10 h-10 rounded-lg font-['Orbitron'] italic font-black text-lg flex items-center justify-center shrink-0 ${classColorMap[equippedCarClass]}`}
          >
            {equippedCarClass}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-['Orbitron'] italic font-black text-base text-white tracking-wide leading-none whitespace-nowrap">
                {equippedKit.name}
              </span>
              <span className="text-slate-500 text-xs" aria-hidden="true">·</span>
              <span className="font-mono font-bold text-xs text-amber-300 tabular-nums whitespace-nowrap">
                PR {equippedCarPR}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-1 whitespace-nowrap">
              {equippedKit.subtitle} · Tap to upgrade or customize
            </div>
          </div>
        </button>

        {/* Mobile Compact Car Chip */}
        <button
          type="button"
          onClick={onOpenGarage}
          style={{ touchAction: 'manipulation' }}
          className="flex sm:hidden items-center gap-2.5 px-3 py-2.5 rounded-xl bg-[#070b14]/88 border border-white/15 backdrop-blur-md text-left cursor-pointer"
        >
          <span
            className={`w-8 h-8 rounded-md font-['Orbitron'] italic font-black text-sm flex items-center justify-center shrink-0 ${classColorMap[equippedCarClass]}`}
          >
            {equippedCarClass}
          </span>
          <div className="min-w-0">
            <div className="font-['Orbitron'] italic font-black text-xs text-white leading-none">
              {equippedKit.name}
            </div>
            <div className="font-mono text-[10px] text-amber-300 tabular-nums mt-1 leading-none">
              PR {equippedCarPR}
            </div>
          </div>
        </button>

        {/* Primary Launch Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenEvents}
            style={{ touchAction: 'manipulation' }}
            className="hidden md:flex flex-col items-end justify-center px-4 py-2.5 rounded-xl bg-[#070b14]/85 hover:bg-[#0d1526]/92 border border-white/15 hover:border-cyan-400/50 backdrop-blur-md transition-colors cursor-pointer text-right"
          >
            <span className="text-[11px] font-semibold text-cyan-300 whitespace-nowrap leading-none">
              {activeMode.name}
            </span>
            <span className="font-['Orbitron'] italic font-bold text-xs text-white mt-1 whitespace-nowrap leading-none">
              {activeMap.name} · {activeMap.laps} Laps
            </span>
          </button>

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
              <div className="text-[10px] sm:text-[11px] font-bold text-slate-900/80 mt-0.5 leading-none">
                {activeMap.shortName} · {activeMode.shortName}
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
        </div>
      </footer>
    </div>
  );
};
