import React, { useState } from 'react';
import { WEATHER_SPECS, WeatherMode } from '../types/game';
import { WeatherIcon } from './WeatherIcon';

interface SettingsModalProps {
  weatherMode: WeatherMode;
  onBackToMenu: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  weatherMode,
  onBackToMenu,
  onClose,
}) => {
  const activeWeather =
    WEATHER_SPECS.find((w) => w.id === weatherMode) || WEATHER_SPECS[0];
  const initialGfx = window.__theRaceEngine?.getGraphicsSettings();
  const [visualQuality, setVisualQuality] = useState<'performance' | 'ultra'>(() => {
    if (initialGfx?.visualQuality) return initialGfx.visualQuality;
    return initialGfx && initialGfx.bloomStrength > 0.06 ? 'ultra' : 'performance';
  });

  const [autoGas, setAutoGas] = useState<boolean>(() => {
    return window.__theRaceEngine?.getAutoGas ? window.__theRaceEngine.getAutoGas() : true;
  });

  const handleSetQuality = (quality: 'performance' | 'ultra') => {
    setVisualQuality(quality);
    window.__theRaceEngine?.playUiClick('click');
    if (quality === 'performance') {
      window.__theRaceEngine?.setGraphicsSettings({
        visualQuality: 'performance',
        bloomStrength: 0.02,
        dofStrength: 0.0,
        lampIntensity: 1.05,
      });
    } else {
      window.__theRaceEngine?.setGraphicsSettings({
        visualQuality: 'ultra',
        bloomStrength: 0.045,
        dofStrength: 0.12,
        lampIntensity: 1.15,
      });
    }
  };

  const handleSetAutoGas = (enabled: boolean) => {
    setAutoGas(enabled);
    window.__theRaceEngine?.playUiClick('click');
    window.__theRaceEngine?.setAutoGas?.(enabled);
  };

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 flex items-center justify-center select-none pointer-events-auto font-['Plus_Jakarta_Sans']"
      style={{
        zIndex: 99999,
        backgroundColor: 'rgba(3, 6, 14, 0.84)',
        paddingTop: 'max(0.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.85rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.85rem, env(safe-area-inset-right))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[90dvh] flex flex-col overflow-hidden bg-[#070b14] border border-white/15 rounded-2xl shadow-2xl text-left pointer-events-auto relative"
        style={{ zIndex: 100000 }}
      >
        {/* Opaque Header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-[#080d1a] border-b border-white/10 shrink-0">
          <div>
            <h2 className="font-['Orbitron'] italic font-black text-base sm:text-lg text-white uppercase leading-none">
              SETTINGS
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Driving controls, track weather, and visual fidelity
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.__theRaceEngine?.playUiClick('click');
              onClose();
            }}
            aria-label="Close Settings"
            style={{ touchAction: 'manipulation' }}
            className="w-8 h-8 rounded-lg bg-slate-900 border border-white/15 hover:border-cyan-400 text-slate-200 font-bold text-sm flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Settings Body */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 flex flex-col gap-3"
          style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
        >
          {/* 1. Throttle Controls */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-['Orbitron'] italic font-bold text-xs text-white uppercase">
                Throttle Control
              </span>
              <span className="text-[11px] text-slate-400">
                {autoGas ? 'Auto-Accelerate' : 'Manual Pedal'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSetAutoGas(true)}
                style={{ touchAction: 'manipulation' }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border cursor-pointer transition-colors whitespace-nowrap ${
                  autoGas
                    ? 'bg-cyan-500/20 border-cyan-400 text-white'
                    : 'bg-slate-950/70 border-white/10 text-slate-400'
                }`}
              >
                Auto-Gas
              </button>
              <button
                type="button"
                onClick={() => handleSetAutoGas(false)}
                style={{ touchAction: 'manipulation' }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold border cursor-pointer transition-colors whitespace-nowrap ${
                  !autoGas
                    ? 'bg-amber-500/20 border-amber-400 text-white'
                    : 'bg-slate-950/70 border-white/10 text-slate-400'
                }`}
              >
                Manual Pedal
              </button>
            </div>
          </div>

          {/* 2. Automatic Dynamic Environment */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className="w-8 h-8 rounded-lg bg-slate-950 border border-white/10 flex items-center justify-center shrink-0"
                style={{ color: activeWeather.accentHex }}
              >
                <WeatherIcon mode={weatherMode} className="w-4 h-4" />
              </span>
              <div className="min-w-0">
                <div className="font-['Orbitron'] italic font-bold text-xs text-white uppercase">
                  Dynamic Environment
                </div>
                <p className="text-[11px] text-slate-400 leading-snug truncate">
                  Auto-selected: <span style={{ color: activeWeather.accentHex }}>{activeWeather.label}</span>
                </p>
              </div>
            </div>
            <span className="font-mono text-[10px] font-bold text-cyan-300 uppercase shrink-0">
              AUTO
            </span>
          </div>

          {/* 3. Visual Quality */}
          <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="font-['Orbitron'] italic font-bold text-xs text-white uppercase">
                Graphics
              </span>
              <span className="text-[11px] text-cyan-300 font-medium">
                {visualQuality === 'performance' ? '60 FPS Smooth' : 'High Detail'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSetQuality('performance');
                }}
                style={{ touchAction: 'manipulation' }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer border transition-colors active:scale-95 whitespace-nowrap ${
                  visualQuality === 'performance'
                    ? 'bg-cyan-500/20 border-cyan-400 text-white'
                    : 'bg-slate-950/70 border-white/10 text-slate-400'
                }`}
              >
                Performance
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSetQuality('ultra');
                }}
                style={{ touchAction: 'manipulation' }}
                className={`py-2 px-3 rounded-lg text-xs font-semibold cursor-pointer border transition-colors active:scale-95 whitespace-nowrap ${
                  visualQuality === 'ultra'
                    ? 'bg-amber-500/20 border-amber-400 text-white'
                    : 'bg-slate-950/70 border-white/10 text-slate-400'
                }`}
              >
                Ultra
              </button>
            </div>
          </div>
        </div>

        {/* Opaque Footer Buttons */}
        <div className="grid grid-cols-2 gap-2.5 px-4 py-3 bg-[#080d1a] border-t border-white/10 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.__theRaceEngine?.playUiClick('click');
              onBackToMenu();
            }}
            style={{ touchAction: 'manipulation' }}
            className="py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/15 font-['Orbitron'] italic font-bold text-xs text-slate-200 uppercase tracking-wider cursor-pointer active:scale-95 whitespace-nowrap"
          >
            Lobby
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.__theRaceEngine?.playUiClick('click');
              onClose();
            }}
            style={{ touchAction: 'manipulation' }}
            className="py-2.5 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-['Orbitron'] italic font-black text-xs uppercase tracking-wider cursor-pointer active:scale-95 whitespace-nowrap"
          >
            Resume
          </button>
        </div>
      </div>
    </div>
  );
};
