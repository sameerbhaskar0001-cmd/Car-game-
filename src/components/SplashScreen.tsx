import React, { useEffect, useRef, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({ onComplete }) => {
  const [progress, setProgress] = useState(0);
  const completedRef = useRef(false);
  const audioFiredRef = useRef(false);

  const triggerBassImpact = () => {
    if (audioFiredRef.current) return;
    audioFiredRef.current = true;
    if (window.__theRaceEngine?.playSplashImpact) {
      window.__theRaceEngine.playSplashImpact();
    } else {
      try {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const now = ctx.currentTime;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(110, now);
          osc.frequency.exponentialRampToValueAtTime(28, now + 1.1);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.45, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.25);
        }
      } catch (_e) {
        // Ignore autoplay restrictions until user interaction
      }
    }
  };

  const finishSplash = () => {
    if (completedRef.current) return;
    completedRef.current = true;
    triggerBassImpact();
    onComplete();
  };

  useEffect(() => {
    const soundTimer = setTimeout(() => {
      triggerBassImpact();
    }, 180);

    const start = performance.now();
    const duration = 2600;

    const interval = setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (elapsed >= duration) {
        clearInterval(interval);
        finishSplash();
      }
    }, 40);

    return () => {
      clearTimeout(soundTimer);
      clearInterval(interval);
    };
  }, []);

  return (
    <div
      onClick={finishSplash}
      onTouchStart={finishSplash}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') finishSplash();
      }}
      aria-label="Splash Screen - Tap to enter Main Menu"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden select-none cursor-pointer px-8 py-8"
      style={{
        background:
          'radial-gradient(ellipse 85% 75% at 50% 48%, rgba(12, 20, 38, 0.94) 0%, rgba(4, 6, 12, 0.98) 65%, #020306 100%)',
      }}
    >
      {/* Ambient Diagonal Light Beams */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="splash-beam-left absolute -top-1/4 -left-1/4 w-[140%] h-[42%] opacity-40"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(255, 170, 50, 0.28) 45%, rgba(0, 240, 255, 0.34) 65%, transparent 100%)',
            transform: 'rotate(-22deg)',
            filter: 'blur(36px)',
          }}
        />
        <div
          className="splash-beam-right absolute -bottom-1/4 -right-1/4 w-[140%] h-[42%] opacity-35"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(0, 229, 255, 0.32) 38%, rgba(255, 59, 48, 0.24) 70%, transparent 100%)',
            transform: 'rotate(-22deg)',
            filter: 'blur(42px)',
          }}
        />
        <div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[620px] h-[260px] rounded-full opacity-35"
          style={{
            background:
              'radial-gradient(circle, rgba(0, 229, 255, 0.38) 0%, rgba(255, 170, 68, 0.18) 52%, transparent 75%)',
            filter: 'blur(28px)',
          }}
        />
      </div>

      {/* Top spacer (clean minimalist layout without floating headers) */}
      <div className="h-6" />

      {/* Center Main Title */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto max-w-4xl px-4 splash-title-enter">
        <h1
          className="font-['Orbitron'] italic font-black uppercase tracking-wider leading-none text-4xl sm:text-6xl md:text-7xl"
          style={{
            background:
              'linear-gradient(180deg, #ffffff 0%, #f8fafc 32%, #ffd27d 68%, #ff9900 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter:
              'drop-shadow(0 6px 24px rgba(0, 0, 0, 0.95)) drop-shadow(0 0 28px rgba(255, 165, 0, 0.45))',
          }}
        >
          The Race: Car Driving 3D
        </h1>

        <div className="mt-4 flex items-center gap-4">
          <span className="h-[2px] w-12 sm:w-20 bg-gradient-to-r from-transparent to-cyan-400" />
          <p
            className="font-['Orbitron'] italic font-extrabold tracking-[0.26em] text-lg sm:text-2xl uppercase text-cyan-300"
            style={{
              textShadow:
                '0 0 18px rgba(0, 240, 255, 0.8), 0 2px 8px rgba(0, 0, 0, 0.95)',
            }}
          >
            Pure Arcade Drift
          </p>
          <span className="h-[2px] w-12 sm:w-20 bg-gradient-to-l from-transparent to-cyan-400" />
        </div>
      </div>

      {/* Bottom Progress Bar & Tap Prompt */}
      <div className="relative z-10 w-full max-w-xs flex flex-col items-center gap-3">
        <div className="w-full h-1 bg-slate-900/90 border border-cyan-500/25 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-75"
            style={{
              width: `${progress}%`,
              background:
                'linear-gradient(90deg, #ff9900 0%, #ffffff 50%, #00f0ff 100%)',
              boxShadow: '0 0 12px rgba(0, 240, 255, 0.8)',
            }}
          />
        </div>
        <span className="text-[11px] font-mono tracking-widest text-slate-400 uppercase">
          TAP TO CONTINUE
        </span>
      </div>
    </div>
  );
};
