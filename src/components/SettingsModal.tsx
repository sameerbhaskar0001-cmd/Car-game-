import React, { useState } from 'react';

interface SettingsModalProps {
  audioEnabled: boolean;
  onToggleAudio: () => void;
  onResetCoins: () => void;
  onBackToMenu: () => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  audioEnabled,
  onToggleAudio,
  onBackToMenu,
  onClose,
}) => {
  const initialGfx = window.__theRaceEngine?.getGraphicsSettings();
  const [visualQuality, setVisualQuality] = useState<'performance' | 'ultra'>(() => {
    if (initialGfx?.visualQuality) return initialGfx.visualQuality;
    return initialGfx && initialGfx.bloomStrength > 0.06 ? 'ultra' : 'performance';
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

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      className="fixed inset-0 flex items-center justify-center select-none pointer-events-auto"
      style={{
        zIndex: 99999,
        backgroundColor: 'rgba(2, 6, 18, 0.86)',
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1.25rem, env(safe-area-inset-left))',
        paddingRight: 'max(1.25rem, env(safe-area-inset-right))',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md max-h-[92vh] overflow-y-auto bg-slate-950/95 border-2 border-cyan-400/55 rounded-2xl p-5 sm:p-6 shadow-2xl text-left pointer-events-auto relative"
        style={{ zIndex: 100000, touchAction: 'manipulation' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-['Orbitron'] italic font-black text-lg sm:text-2xl text-white uppercase leading-none">
            SETTINGS
          </h2>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              window.__theRaceEngine?.playUiClick('click');
              onClose();
            }}
            aria-label="Close Settings"
            style={{ touchAction: 'manipulation' }}
            className="w-9 h-9 rounded-xl bg-slate-900 border border-white/25 hover:border-cyan-400 active:bg-rose-500/40 text-white font-black text-sm flex items-center justify-center cursor-pointer shadow-md active:scale-95 shrink-0"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* 1. Sound FX */}
          <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-slate-900/90 border border-white/15">
            <div>
              <div className="font-['Orbitron'] italic font-bold text-xs sm:text-sm text-white uppercase leading-tight">
                SOUND FX
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5 leading-tight">
                Engine roar, tire drift &amp; nitro audio
              </div>
            </div>
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleAudio();
              }}
              style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
              className={`min-w-[84px] px-4 py-2 rounded-xl font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer border-2 transition-transform active:scale-95 shrink-0 ${
                audioEnabled
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.3)]'
                  : 'bg-slate-800 border-white/25 text-slate-300'
              }`}
            >
              {audioEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* 2. Visual Quality */}
          <div className="px-4 py-3 rounded-xl bg-slate-900/90 border border-white/15 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="font-['Orbitron'] italic font-bold text-xs sm:text-sm text-white uppercase">
                GRAPHICS
              </span>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                {visualQuality === 'performance' ? '60 FPS SMOOTH' : 'HIGH DETAIL'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSetQuality('performance');
                }}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                className={`py-2.5 px-3 rounded-xl font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer border-2 transition-transform active:scale-95 flex items-center justify-center ${
                  visualQuality === 'performance'
                    ? 'bg-cyan-500/30 border-cyan-300 text-white shadow-[0_0_14px_rgba(34,211,238,0.3)]'
                    : 'bg-slate-950/80 border-white/15 text-slate-400'
                }`}
              >
                PERFORMANCE
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSetQuality('ultra');
                }}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                className={`py-2.5 px-3 rounded-xl font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer border-2 transition-transform active:scale-95 flex items-center justify-center ${
                  visualQuality === 'ultra'
                    ? 'bg-amber-500/30 border-amber-300 text-white shadow-[0_0_14px_rgba(251,191,36,0.3)]'
                    : 'bg-slate-950/80 border-white/15 text-slate-400'
                }`}
              >
                ULTRA
              </button>
            </div>
          </div>

          {/* 3. Clean 2-Button Action Footer */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.__theRaceEngine?.playUiClick('click');
                onBackToMenu();
              }}
              style={{ touchAction: 'manipulation' }}
              className="py-2.5 px-4 rounded-xl bg-slate-800/95 border border-white/25 active:bg-slate-700 font-['Orbitron'] italic font-bold text-xs sm:text-sm text-white uppercase tracking-wider cursor-pointer shadow-md active:scale-95"
            >
              MAIN MENU
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                window.__theRaceEngine?.playUiClick('click');
                onClose();
              }}
              style={{ touchAction: 'manipulation' }}
              className="py-2.5 px-4 rounded-xl bg-cyan-500/35 border-2 border-cyan-300 active:bg-cyan-500/60 font-['Orbitron'] italic font-black text-xs sm:text-sm text-white uppercase tracking-wider cursor-pointer shadow-md active:scale-95"
            >
              RESUME
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
