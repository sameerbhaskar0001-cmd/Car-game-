import React, { useState } from 'react';
import {
  MAP_SPECS,
  MapId,
  RACE_MODES,
  RaceModeId,
  TrackRecord,
  WEATHER_SPECS,
  WeatherMode,
  formatRaceTime,
} from '../types/game';
import { WeatherIcon } from './WeatherIcon';

interface EventsScreenProps {
  coins: number;
  selectedMapId: MapId;
  selectedModeId: RaceModeId;
  weatherMode: WeatherMode;
  autoRotateMaps: boolean;
  trackRecords: Record<MapId, TrackRecord>;
  onSelectMap: (mapId: MapId) => void;
  onSelectMode: (modeId: RaceModeId) => void;
  onSelectWeather: (mode: WeatherMode) => void;
  onToggleAutoRotate: () => void;
  onOpenGarage: () => void;
  onBackToMenu: () => void;
  onStartRace: (mapId: MapId) => void;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({
  coins,
  selectedMapId,
  selectedModeId,
  weatherMode,
  autoRotateMaps,
  trackRecords,
  onSelectMap,
  onSelectMode,
  onSelectWeather,
  onToggleAutoRotate,
  onOpenGarage,
  onBackToMenu,
  onStartRace,
}) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const activeMap = MAP_SPECS.find((m) => m.id === selectedMapId) || MAP_SPECS[0];
  const activeMode = RACE_MODES.find((m) => m.id === selectedModeId) || RACE_MODES[0];

  return (
    <div
      className="fixed inset-0 z-30 pointer-events-auto flex flex-col justify-between select-none overflow-hidden font-['Plus_Jakarta_Sans']"
      style={{
        background:
          'linear-gradient(180deg, rgba(5, 8, 16, 0.88) 0%, rgba(5, 8, 16, 0.72) 48%, rgba(4, 7, 14, 0.94) 100%)',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      {/* TOP BAR */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3 shrink-0 pb-3 border-b border-white/10">
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
              RACE EVENTS
            </h1>
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
              Choose your event format, circuit location, and weather conditions
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

      {/* MAIN SCROLLABLE CONTENT */}
      <main className="w-full max-w-6xl mx-auto flex-1 overflow-y-auto py-4 flex flex-col gap-5">
        {/* 1. RACE MODE SELECTOR */}
        <section>
          <div className="flex items-baseline justify-between gap-2 mb-2.5">
            <h2 className="font-['Orbitron'] italic font-bold text-xs sm:text-sm tracking-wider uppercase text-slate-200">
              01. Event Format
            </h2>
            <span className="text-xs text-slate-400 font-mono tabular-nums">
              {activeMode.ruleSummary} · {activeMode.rewardMultiplier.toFixed(2)}x CR
            </span>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
            {RACE_MODES.map((mode) => {
              const selected = mode.id === selectedModeId;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => onSelectMode(mode.id)}
                  style={{
                    touchAction: 'manipulation',
                    borderColor: selected ? mode.accentHex : undefined,
                  }}
                  className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.99] flex flex-col justify-between gap-1.5 ${
                    selected
                      ? 'bg-slate-900/95 text-white shadow-lg'
                      : 'bg-[#080d1a]/80 border-white/10 text-slate-300 hover:border-white/25'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-['Orbitron'] italic font-extrabold text-xs sm:text-sm tracking-wide uppercase whitespace-nowrap">
                      {mode.name}
                    </span>
                    <span
                      className="font-mono text-[11px] font-bold tabular-nums shrink-0"
                      style={{ color: selected ? mode.accentHex : '#94a3b8' }}
                    >
                      {mode.rewardMultiplier}x
                    </span>
                  </div>
                  <div className="text-[11px] font-medium text-slate-400">
                    {mode.ruleSummary}
                  </div>
                  <p className="text-xs text-slate-400 leading-snug hidden sm:block">
                    {mode.description}
                  </p>
                </button>
              );
            })}
          </div>
        </section>

        {/* 2. CIRCUIT SELECTION (3 BESPOKE GENERATED 16:9 ARTWORK CARDS) */}
        <section>
          <div className="flex items-baseline justify-between gap-2 mb-2.5">
            <h2 className="font-['Orbitron'] italic font-bold text-xs sm:text-sm tracking-wider uppercase text-slate-200">
              02. Select Circuit
            </h2>
            <span className="text-xs text-slate-400">
              Live 3D circuit updates immediately on selection
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            {MAP_SPECS.map((map) => {
              const isSelected = map.id === selectedMapId;
              const rec = trackRecords[map.id];
              const stars = rec?.bestStars || 0;
              const imgFailed = Boolean(failedImages[map.id]);

              return (
                <button
                  key={map.id}
                  type="button"
                  onClick={() => onSelectMap(map.id)}
                  style={{
                    touchAction: 'manipulation',
                    borderColor: isSelected ? map.accentHex : undefined,
                  }}
                  className={`group rounded-xl overflow-hidden border text-left transition-all cursor-pointer flex flex-col bg-[#080d1a]/90 ${
                    isSelected
                      ? 'ring-1 ring-white/20 shadow-2xl'
                      : 'border-white/12 hover:border-white/30'
                  }`}
                >
                  {/* 16:9 Circuit Artwork Banner with Measured Contrast Scrim */}
                  <div className="relative w-full aspect-video overflow-hidden bg-slate-900">
                    {!imgFailed ? (
                      <img
                        src={map.previewImage}
                        alt={`${map.name} - ${map.subtitle}`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [map.id]: true }))
                        }
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div
                        className="w-full h-full flex flex-col items-center justify-center p-4"
                        style={{
                          background: `linear-gradient(135deg, ${map.skyTopHex} 0%, ${map.skyHorizonHex} 100%)`,
                        }}
                      >
                        <span className="font-['Orbitron'] italic font-black text-lg text-white">
                          {map.name}
                        </span>
                      </div>
                    )}

                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background:
                          'linear-gradient(180deg, rgba(4, 7, 14, 0.15) 0%, rgba(4, 7, 14, 0.35) 55%, rgba(4, 7, 14, 0.94) 100%)',
                      }}
                    />

                    {/* Bottom overlay title & mastery stars */}
                    <div className="absolute inset-x-0 bottom-0 p-3 flex items-end justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-['Orbitron'] italic font-black text-sm sm:text-base text-white tracking-wide uppercase leading-none">
                          {map.name}
                        </div>
                        <div className="text-[11px] text-slate-300 mt-1 leading-none">
                          {map.subtitle}
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-0.5 text-sm shrink-0"
                        aria-label={`${stars} out of 3 stars`}
                      >
                        {[1, 2, 3].map((s) => (
                          <span
                            key={s}
                            className={s <= stars ? 'text-amber-400' : 'text-slate-600'}
                          >
                            ★
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Clean Unboxed Track Telemetry Footer */}
                  <div className="p-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono tabular-nums">
                      <span>{map.lengthLabel} · {map.laps} Laps</span>
                      <span style={{ color: isSelected ? map.accentHex : '#94a3b8' }}>
                        {isSelected ? 'Selected' : `Gold < ${map.goldTargetSec}s`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
                      <span className="text-slate-400">Best Lap</span>
                      <span className="font-mono font-semibold text-white tabular-nums">
                        {rec?.bestLap ? formatRaceTime(rec.bestLap) : '--:--.--'}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 3. CONDITIONS & SERIES OPTIONS */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* Weather Selector */}
          <div className="p-3.5 rounded-xl bg-[#080d1a]/85 border border-white/12 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-['Orbitron'] italic font-bold text-xs uppercase text-slate-200">
                Track Weather
              </span>
              <span className="text-xs text-slate-400">
                {WEATHER_SPECS.find((w) => w.id === weatherMode)?.label}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {WEATHER_SPECS.map((spec) => {
                const active = spec.id === weatherMode;
                return (
                  <button
                    key={spec.id}
                    type="button"
                    onClick={() => onSelectWeather(spec.id)}
                    style={{
                      touchAction: 'manipulation',
                      borderColor: active ? spec.accentHex : undefined,
                    }}
                    className={`py-2 px-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap ${
                      active
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-950/70 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span style={{ color: active ? spec.accentHex : undefined }}>
                      <WeatherIcon mode={spec.id} className="w-3.5 h-3.5" />
                    </span>
                    <span>{spec.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Series Auto-Rotate Setting */}
          <div className="p-3.5 rounded-xl bg-[#080d1a]/85 border border-white/12 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-['Orbitron'] italic font-bold text-xs uppercase text-slate-200">
                Championship Circuit Rotation
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Automatically queue the next circuit after finishing each race.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleAutoRotate}
              style={{ touchAction: 'manipulation' }}
              className={`px-4 py-2 rounded-lg border text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                autoRotateMaps
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                  : 'bg-slate-900 border-white/15 text-slate-400'
              }`}
            >
              {autoRotateMaps ? 'Enabled' : 'Off'}
            </button>
          </div>
        </section>
      </main>

      {/* BOTTOM ACTION BAR */}
      <footer className="w-full max-w-6xl mx-auto pt-3 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
        <button
          type="button"
          onClick={onOpenGarage}
          style={{ touchAction: 'manipulation' }}
          className="px-4 py-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800 border border-amber-400/45 text-xs sm:text-sm font-semibold text-amber-200 cursor-pointer active:scale-95 whitespace-nowrap"
        >
          Tune Car in Garage
        </button>

        <button
          type="button"
          onClick={() => onStartRace(activeMap.id)}
          style={{ touchAction: 'manipulation' }}
          className="px-6 sm:px-8 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-cyan-400 to-amber-400 hover:from-cyan-300 hover:to-amber-300 text-slate-950 font-['Orbitron'] italic font-black text-xs sm:text-base tracking-wider uppercase cursor-pointer active:scale-95 flex items-center gap-2.5 whitespace-nowrap shadow-xl"
        >
          <span>RACE {activeMap.shortName}</span>
          <span>→</span>
        </button>
      </footer>
    </div>
  );
};
