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
          osc.frequency.setValueAtTime(108, now);
          osc.frequency.exponentialRampToValueAtTime(28, now + 1.0);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.4, now + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 1.15);
        }
      } catch {
        // Ignore browser autoplay restrictions until first gesture
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
    const duration = 2200;

    const interval = setInterval(() => {
      const elapsed = performance.now() - start;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setProgress(pct);
      if (elapsed >= duration) {
        clearInterval(interval);
        finishSplash();
      }
    }, 35);

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
      aria-label="Splash Screen - Tap to enter Lobby"
      className="fixed inset-0 z-50 flex flex-col items-center justify-between overflow-hidden select-none cursor-pointer px-6 py-8 sm:py-10 font-['Plus_Jakarta_Sans']"
      style={{
        background:
          'radial-gradient(ellipse 80% 70% at 50% 46%, rgba(14, 22, 40, 0.90) 0%, rgba(5, 8, 16, 0.97) 64%, #03050a 100%)',
      }}
    >
      {/* Subtle angled motorsport light planes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-1/3 -left-1/4 w-[150%] h-[38%] opacity-30"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(245, 158, 11, 0.28) 45%, rgba(6, 182, 212, 0.32) 68%, transparent 100%)',
            transform: 'rotate(-16deg)',
            filter: 'blur(40px)',
          }}
        />
        <div
          className="absolute -bottom-1/3 -right-1/4 w-[150%] h-[36%] opacity-25"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(6, 182, 212, 0.30) 40%, rgba(245, 158, 11, 0.22) 72%, transparent 100%)',
            transform: 'rotate(-16deg)',
            filter: 'blur(44px)',
          }}
        />
      </div>

      {/* Top Motorsport Hairline */}
      <div className="relative z-10 w-full max-w-4xl flex items-center justify-between text-xs text-slate-400 tracking-wide">
        <span className="font-['Orbitron'] italic font-bold text-slate-300 tracking-widest">
          THE RACE 3D
        </span>
        <span className="font-mono tabular-nums text-slate-400">
          3 Circuits · 13 Cars
        </span>
      </div>

      {/* Center Hero Title Lockup */}
      <div className="relative z-10 flex flex-col items-center text-center my-auto max-w-3xl px-4">
        <div className="flex items-center gap-3 mb-3">
          <span className="h-[2px] w-10 bg-amber-400" />
          <span className="font-['Orbitron'] font-bold text-[11px] sm:text-xs tracking-[0.28em] text-amber-300 uppercase">
            Arcade Motorsport
          </span>
          <span className="h-[2px] w-10 bg-cyan-400" />
        </div>

        <h1
          className="font-['Orbitron'] italic font-black uppercase tracking-wider leading-[1.02] text-4xl sm:text-6xl md:text-7xl text-balance"
          style={{
            background:
              'linear-gradient(180deg, #ffffff 0%, #f1f5f9 44%, #fcd34d 78%, #f59e0b 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            filter: 'drop-shadow(0 8px 24px rgba(0, 0, 0, 0.92))',
          }}
        >
          THE RACE 3D
        </h1>

        <p className="mt-3 text-sm sm:text-base text-slate-300 max-w-md leading-relaxed">
          High-speed coastal circuits, midnight city streets, and precision power drifting.
        </p>
      </div>

      {/* Bottom Ignition Progress & Tap Prompt */}
      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-2.5">
        <div className="w-full flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-400">
          <span>Preparing showroom &amp; circuits</span>
          <span className="text-cyan-300 font-semibold">{progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-slate-900/90 border border-white/10 rounded-full overflow-hidden">
          <div
            className="h-full transition-all duration-75"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #f59e0b 0%, #f8fafc 52%, #06b6d4 100%)',
            }}
          />
        </div>
        <span className="text-xs font-medium tracking-wider text-slate-400 pt-1">
          Tap anywhere to continue
        </span>
      </div>
    </div>
  );
};
