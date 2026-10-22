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
  onResetCoins,
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

  const handleCloseModal = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      onClick={handleCloseModal}
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
        onTouchStart={(e) => e.stopPropagation()}
        className="w-full max-w-md bg-slate-950/95 border-2 border-cyan-400/60 rounded-2xl p-4 sm:p-5 shadow-2xl text-left pointer-events-auto relative"
        style={{ zIndex: 100000 }}
      >
        {/* Header with Responsive Close Button */}
        <div className="flex items-center justify-between mb-3.5">
          <div>
            <h2 className="font-['Orbitron'] italic font-black text-xl sm:text-2xl text-white uppercase leading-none">
              SETTINGS
            </h2>
            <p className="text-[11px] text-slate-400 mt-1">
              Mobile audio &amp; performance options
            </p>
          </div>

          <button
            type="button"
            onTouchStart={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            aria-label="Close Settings"
            className="w-10 h-10 rounded-xl bg-slate-900 border border-white/25 active:bg-rose-500/40 text-white font-black text-base flex items-center justify-center cursor-pointer shadow-lg active:scale-95"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* 1. Music & Sound FX (Toggle) */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900/95 border border-white/15">
            <div>
              <div className="font-['Orbitron'] italic font-black text-xs sm:text-sm text-white uppercase">
                MUSIC &amp; SOUND FX
              </div>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Engine roar, tire drift, powerups &amp; UI audio
              </div>
            </div>
            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onToggleAudio();
              }}
              onClick={onToggleAudio}
              className={`min-w-[104px] px-4 py-2.5 rounded-xl font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer border-2 transition-all active:scale-95 ${
                audioEnabled
                  ? 'bg-emerald-500/25 border-emerald-400 text-emerald-200 shadow-[0_0_14px_rgba(52,211,153,0.3)]'
                  : 'bg-slate-800 border-white/25 text-slate-300'
              }`}
            >
              {audioEnabled ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* 2. Visual Quality (Performance 60FPS / Ultra) */}
          <div className="p-3.5 rounded-xl bg-slate-900/95 border border-white/15 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <div className="font-['Orbitron'] italic font-black text-xs sm:text-sm text-white uppercase">
                VISUAL QUALITY
              </div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-cyan-300">
                {visualQuality === 'performance' ? 'LOCKED 60 FPS' : 'HIGH BLOOM + FX'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSetQuality('performance');
                }}
                onClick={() => handleSetQuality('performance')}
                className={`py-2.5 px-3 rounded-xl font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer border-2 transition-all active:scale-95 flex flex-col items-center gap-0.5 ${
                  visualQuality === 'performance'
                    ? 'bg-cyan-500/30 border-cyan-300 text-white shadow-[0_0_15px_rgba(34,211,238,0.35)]'
                    : 'bg-slate-950/80 border-white/15 text-slate-400'
                }`}
              >
                <span>PERFORMANCE</span>
                <span className="text-[9px] font-mono font-bold text-cyan-300">
                  60 FPS
                </span>
              </button>

              <button
                type="button"
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSetQuality('ultra');
                }}
                onClick={() => handleSetQuality('ultra')}
                className={`py-2.5 px-3 rounded-xl font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer border-2 transition-all active:scale-95 flex flex-col items-center gap-0.5 ${
                  visualQuality === 'ultra'
                    ? 'bg-amber-500/30 border-amber-300 text-white shadow-[0_0_15px_rgba(251,191,36,0.35)]'
                    : 'bg-slate-950/80 border-white/15 text-slate-400'
                }`}
              >
                <span>ULTRA</span>
                <span className="text-[9px] font-mono font-bold text-amber-300">
                  MAX FX
                </span>
              </button>
            </div>
          </div>

          {/* 3. Action Buttons: Back to Menu + Resume */}
          <div className="flex items-center gap-2.5 pt-1">
            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onResetCoins();
              }}
              onClick={onResetCoins}
              className="px-3 py-3 rounded-xl bg-amber-500/15 border border-amber-400/50 active:bg-amber-500/35 text-[11px] font-mono font-bold text-amber-300 cursor-pointer active:scale-95"
            >
              +500 CR
            </button>

            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBackToMenu();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onBackToMenu();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-slate-800/95 border-2 border-white/30 active:bg-slate-700 font-['Orbitron'] italic font-black text-xs sm:text-sm text-white uppercase tracking-wider cursor-pointer shadow-lg active:scale-95"
            >
              BACK TO MENU
            </button>

            <button
              type="button"
              onTouchStart={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onClose();
              }}
              className="flex-1 py-3 px-4 rounded-xl bg-cyan-500/35 border-2 border-cyan-300 active:bg-cyan-500/60 font-['Orbitron'] italic font-black text-xs sm:text-sm text-white uppercase tracking-wider cursor-pointer shadow-lg active:scale-95"
            >
              RESUME
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
