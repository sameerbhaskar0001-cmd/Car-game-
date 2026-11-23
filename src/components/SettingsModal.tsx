import React, { useState } from 'react';
import { WEATHER_SPECS, WeatherMode } from '../types/game';
import { WeatherIcon } from './WeatherIcon';

interface SettingsModalProps {
  weatherMode: WeatherMode;
  onChangeWeather: (mode: WeatherMode) => void;
  onResetCoins: () => void;
  onBackToMenu: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  weatherMode,
  onChangeWeather,
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
        bloomStrength: 0.04,
        dofStrength: 0.0,
        lampIntensity: 1.15,
      });
    } else {
      window.__theRaceEngine?.setGraphicsSettings({
        visualQuality: 'ultra',
        bloomStrength: 0.11,
        dofStrength: 0.25,
        lampIntensity: 1.35,
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
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-[#070b14]/96 border border-white/15 rounded-2xl p-5 sm:p-6 shadow-2xl text-left pointer-events-auto relative backdrop-blur-md"
        style={{ zIndex: 100000, touchAction: 'manipulation' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-4 border-b border-white/10">
          <div>
            <h2 className="font-['Orbitron'] italic font-black text-lg sm:text-xl text-white uppercase leading-none">
              SETTINGS
            </h2>
            <p className="text-xs text-slate-400 mt-1">
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
            className="w-9 h-9 rounded-lg bg-slate-900 border border-white/15 hover:border-cyan-400 text-slate-200 font-bold text-sm flex items-center justify-center cursor-pointer active:scale-95 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3.5">
          {/* 1. Throttle Controls */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-['Orbitron'] italic font-bold text-xs text-white uppercase">
                Throttle Control
              </span>
              <span className="text-xs text-slate-400">
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

          {/* 2. Weather & Track Atmosphere */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-['Orbitron'] italic font-bold text-xs text-white uppercase">
                Weather
              </span>
              <span
                className="text-xs font-semibold"
                style={{ color: activeWeather.accentHex }}
              >
                {activeWeather.label}
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-snug -mt-1">
              {activeWeather.description}
            </p>

            <div className="grid grid-cols-4 gap-1.5">
              {WEATHER_SPECS.map((spec) => {
                const isSelected = spec.id === weatherMode;
                return (
                  <button
                    key={spec.id}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onChangeWeather(spec.id);
                    }}
                    style={{
                      touchAction: 'manipulation',
                      borderColor: isSelected ? spec.accentHex : undefined,
                    }}
                    className={`py-2 px-1.5 rounded-lg text-[11px] font-semibold cursor-pointer border transition-colors active:scale-95 flex flex-col items-center justify-center gap-1 whitespace-nowrap ${
                      isSelected
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-950/70 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span style={{ color: isSelected ? spec.accentHex : undefined }}>
                      <WeatherIcon mode={spec.id} className="w-4 h-4" />
                    </span>
                    <span className="leading-none">{spec.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Visual Quality */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-['Orbitron'] italic font-bold text-xs text-white uppercase">
                Graphics
              </span>
              <span className="text-xs text-cyan-300 font-medium">
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

          {/* Footer Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-2">
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
    </div>
  );
};
