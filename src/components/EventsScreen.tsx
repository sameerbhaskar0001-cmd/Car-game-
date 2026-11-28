import React, { useState } from 'react';
import { Sparkles, Trophy, Zap } from 'lucide-react';
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
  onToggleAutoRotate,
  onOpenGarage,
  onBackToMenu,
  onStartRace,
}) => {
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const activeMap = MAP_SPECS.find((m) => m.id === selectedMapId) || MAP_SPECS[0];
  const activeMode = RACE_MODES.find((m) => m.id === selectedModeId) || RACE_MODES[0];
  const activeWeather =
    WEATHER_SPECS.find((w) => w.id === weatherMode) || WEATHER_SPECS[0];

  const getEstimatedTopPrize = (multiplier: number) =>
    Math.round(15500 * multiplier);

  const totalStars = MAP_SPECS.reduce(
    (sum, m) => sum + (trackRecords[m.id]?.bestStars || 0),
    0
  );

  return (
    <div className="fixed inset-0 z-30 pointer-events-auto flex flex-col select-none overflow-hidden font-['Plus_Jakarta_Sans'] bg-[#050814]/94 backdrop-blur-md">
      {/* TOP BAR */}
      <header
        className="relative z-20 w-full shrink-0 bg-[#060a16] border-b border-white/12 shadow-md"
        style={{
          paddingTop: 'max(0.55rem, env(safe-area-inset-top))',
          paddingBottom: '0.55rem',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBackToMenu}
              style={{ touchAction: 'manipulation' }}
              className="h-9 px-3.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-white/15 text-xs font-semibold text-slate-100 flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap shrink-0"
            >
              <span>←</span>
              <span>Lobby</span>
            </button>

            <div className="min-w-0">
              <h1 className="font-['Orbitron'] italic font-black text-base sm:text-xl text-white tracking-wider uppercase leading-none whitespace-nowrap">
                RACE EVENTS
              </h1>
              <p className="text-[11px] text-slate-400 mt-0.5 truncate hidden sm:block">
                Championship series · Dynamic track conditions chosen automatically
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="hidden md:flex items-center gap-1.5 px-3 h-9 rounded-lg bg-slate-900/90 border border-white/10 text-xs font-mono text-slate-200 tabular-nums whitespace-nowrap">
              <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{totalStars}/{MAP_SPECS.length * 3} ★</span>
            </div>

            <div className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-slate-900 border border-amber-400/45 shrink-0 whitespace-nowrap">
              <span className="text-sm leading-none" aria-hidden="true">
                🪙
              </span>
              <span className="font-mono font-bold text-xs sm:text-sm text-white tabular-nums">
                {coins.toLocaleString()}
              </span>
              <span className="hidden sm:inline font-['Orbitron'] font-bold text-[10px] text-amber-300 uppercase">
                COINS
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN SCROLLABLE CHAMPIONSHIP HUB */}
      <main
        className="w-full min-h-0 flex-1 overflow-y-auto overscroll-contain"
        style={{
          touchAction: 'pan-y',
          WebkitOverflowScrolling: 'touch',
          paddingTop: '0.65rem',
          paddingBottom: '0.85rem',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div className="w-full max-w-6xl mx-auto flex flex-col gap-3 sm:gap-3.5">
          {/* 01. EVENT FORMAT CARDS */}
          <section>
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <h2 className="font-['Orbitron'] italic font-extrabold text-xs sm:text-sm tracking-wider uppercase text-white">
                01. Event Format
              </h2>
              <span className="text-[11px] text-amber-300 font-mono font-semibold tabular-nums whitespace-nowrap">
                Top Prize 🪙 {getEstimatedTopPrize(activeMode.rewardMultiplier).toLocaleString()} COINS
              </span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {RACE_MODES.map((mode) => {
                const selected = mode.id === selectedModeId;
                const topPrize = getEstimatedTopPrize(mode.rewardMultiplier);
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onSelectMode(mode.id)}
                    style={{
                      touchAction: 'manipulation',
                      borderColor: selected ? mode.accentHex : undefined,
                      boxShadow: selected
                        ? `0 8px 24px -8px ${mode.accentHex}55`
                        : undefined,
                    }}
                    className={`relative overflow-hidden px-3 py-2 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.99] flex flex-col justify-between gap-1.5 ${
                      selected
                        ? 'bg-gradient-to-b from-slate-900 to-[#0a1224] text-white'
                        : 'bg-[#080d1a]/92 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-[3px]"
                      style={{
                        backgroundColor: selected ? mode.accentHex : 'rgba(255,255,255,0.06)',
                      }}
                    />

                    <div>
                      <div className="flex items-center justify-between gap-1.5">
                        <span className="font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wide uppercase">
                          {mode.name}
                        </span>
                        <span
                          className="font-mono text-[11px] font-bold tabular-nums shrink-0"
                          style={{ color: selected ? mode.accentHex : '#94a3b8' }}
                        >
                          {mode.rewardMultiplier.toFixed(2)}x
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1 leading-snug">
                        {mode.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-white/10 text-[10px] font-mono tabular-nums">
                      <span className="text-slate-400">{mode.ruleSummary}</span>
                      <span className="text-amber-300 font-bold shrink-0 whitespace-nowrap">
                        🪙 {topPrize.toLocaleString()}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 02. ELEVATED CIRCUIT SHOWCASE CARDS */}
          <section className="pt-0.5">
            <div className="flex items-baseline justify-between gap-2 mb-1.5">
              <h2 className="font-['Orbitron'] italic font-extrabold text-xs sm:text-sm tracking-wider uppercase text-white leading-tight">
                02. Select Circuit
              </h2>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Tap a circuit to preview its live 3D track &amp; automatic atmosphere
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
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
                      boxShadow: isSelected
                        ? `0 12px 32px -10px ${map.accentHex}55`
                        : undefined,
                    }}
                    className={`group rounded-2xl overflow-hidden border text-left transition-all cursor-pointer flex flex-col bg-[#080e1c] ${
                      isSelected
                        ? 'ring-1 ring-white/25'
                        : 'border-white/12 hover:border-white/30'
                    }`}
                  >
                    {/* Circuit Artwork */}
                    <div className="relative w-full h-28 sm:h-32 lg:h-36 overflow-hidden bg-slate-900">
                      {!imgFailed ? (
                        <img
                          src={map.previewImage}
                          alt={`${map.name} - ${map.subtitle}`}
                          onError={() =>
                            setFailedImages((prev) => ({ ...prev, [map.id]: true }))
                          }
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex flex-col items-center justify-center p-3"
                          style={{
                            background: `linear-gradient(135deg, ${map.skyTopHex} 0%, ${map.skyHorizonHex} 100%)`,
                          }}
                        >
                          <span className="font-['Orbitron'] italic font-black text-base text-white">
                            {map.name}
                          </span>
                        </div>
                      )}

                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          background:
                            'linear-gradient(180deg, rgba(4, 7, 15, 0.36) 0%, rgba(4, 7, 15, 0.16) 40%, rgba(4, 7, 15, 0.94) 100%)',
                        }}
                      />

                      {/* Top metadata bar */}
                      <div className="absolute inset-x-0 top-0 px-3 py-1.5 flex items-center justify-between gap-2 text-[10px] font-mono tabular-nums">
                        <span className="text-slate-200 font-semibold drop-shadow">
                          {map.lengthLabel} · {map.laps} LAPS
                        </span>
                        <div
                          className="flex items-center gap-0.5 text-sm drop-shadow"
                          aria-label={`${stars} out of 3 stars`}
                        >
                          {[1, 2, 3].map((s) => (
                            <span
                              key={s}
                              className={s <= stars ? 'text-amber-400' : 'text-slate-500/80'}
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Bottom circuit identity — never truncates circuit names */}
                      <div className="absolute inset-x-0 bottom-0 px-3 py-2 flex items-end justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-['Orbitron'] italic font-black text-xs sm:text-sm lg:text-base text-white tracking-wide uppercase leading-tight whitespace-nowrap">
                            {map.name}
                          </div>
                          <div className="text-[11px] text-slate-300 mt-0.5 leading-tight whitespace-nowrap">
                            {map.subtitle}
                          </div>
                        </div>
                        {isSelected && (
                          <span
                            className="font-['Orbitron'] italic font-black text-[10px] uppercase tracking-wider shrink-0"
                            style={{ color: map.accentHex }}
                          >
                            SELECTED
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Circuit Telemetry Footer */}
                    <div className="px-3 py-2 flex flex-col gap-1">
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-1">
                        {map.description}
                      </p>
                      <div className="flex items-center justify-between text-[11px] pt-1.5 mt-0.5 border-t border-white/10 font-mono tabular-nums">
                        <span className="text-slate-400">
                          Gold <span className="text-amber-300 font-semibold">&lt;{map.goldTargetSec}s</span>
                        </span>
                        <span className="text-slate-200 font-semibold">
                          PB {rec?.bestLap ? formatRaceTime(rec.bestLap) : '--:--.--'}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 03. FEATURED EVENT BRIEF + AUTOMATIC ATMOSPHERE + ROTATION */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl bg-[#080e1c] border border-white/12 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div
                  className="w-9 h-9 rounded-xl bg-slate-900 border border-white/10 flex items-center justify-center shrink-0"
                  style={{ color: activeWeather.accentHex }}
                >
                  <WeatherIcon mode={weatherMode} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center flex-wrap gap-1.5 font-['Orbitron'] italic font-bold text-[11px] sm:text-xs uppercase text-white leading-tight">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span>Auto Atmosphere · {activeWeather.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                    Environment lighting &amp; weather adapt automatically every race.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#080e1c] border border-white/12 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-['Orbitron'] italic font-bold text-[11px] sm:text-xs uppercase text-white leading-tight">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Auto Circuit Rotation</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">
                  Automatically advance to the next circuit after finishing each race.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleAutoRotate}
                style={{ touchAction: 'manipulation' }}
                className={`px-3.5 py-1.5 rounded-lg border text-xs font-bold cursor-pointer whitespace-nowrap shrink-0 transition-colors ${
                  autoRotateMaps
                    ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200'
                    : 'bg-slate-900 border-white/15 text-slate-400'
                }`}
              >
                {autoRotateMaps ? 'On' : 'Off'}
              </button>
            </div>
          </section>
        </div>
      </main>

      {/* BOTTOM ACTION BAR */}
      <footer
        className="relative z-20 w-full shrink-0 bg-[#060a16] border-t border-white/12 shadow-[0_-8px_24px_rgba(0,0,0,0.55)]"
        style={{
          paddingTop: '0.6rem',
          paddingBottom: 'max(0.6rem, env(safe-area-inset-bottom))',
          paddingLeft: 'max(1rem, env(safe-area-inset-left))',
          paddingRight: 'max(1rem, env(safe-area-inset-right))',
        }}
      >
        <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onOpenGarage}
            style={{ touchAction: 'manipulation' }}
            className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-amber-400/50 text-xs sm:text-sm font-semibold text-amber-200 cursor-pointer active:scale-95 whitespace-nowrap"
          >
            Garage &amp; Tune
          </button>

          <button
            type="button"
            onClick={() => onStartRace(activeMap.id)}
            style={{ touchAction: 'manipulation' }}
            className="px-6 sm:px-8 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-amber-400 hover:from-cyan-300 hover:to-amber-300 text-slate-950 font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wider uppercase cursor-pointer active:scale-95 flex items-center gap-2 whitespace-nowrap shadow-xl"
          >
            <span>RACE {activeMap.shortName}</span>
            <span>→</span>
          </button>
        </div>
      </footer>
    </div>
  );
};
