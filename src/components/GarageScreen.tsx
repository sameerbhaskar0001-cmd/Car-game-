import React, { useState, useEffect, useRef } from 'react';
import {
  BODY_KITS,
  BodyKitId,
  BodyKitSpec,
  RimId,
  SpoilerId,
  normalizeCarId,
} from '../types/game';

interface GarageScreenProps {
  coins: number;
  equippedKitId: BodyKitId;
  equippedRimId: RimId;
  equippedSpoilerId: SpoilerId;
  equippedPaintHex: string | null;
  unlockedKits: BodyKitId[];
  onSelectKit: (
    kit: BodyKitSpec,
    rimId: RimId,
    spoilerId: SpoilerId,
    paintHex?: string | null
  ) => void;
  onPreviewKit: (
    kit: BodyKitSpec,
    rimId: RimId,
    spoilerId: SpoilerId,
    paintHex?: string | null
  ) => void;
  onBackToMenu: () => void;
  onStartRace: () => void;
}

export const GarageScreen: React.FC<GarageScreenProps> = ({
  coins,
  equippedKitId,
  equippedRimId,
  equippedSpoilerId,
  equippedPaintHex,
  unlockedKits,
  onSelectKit,
  onPreviewKit,
  onBackToMenu,
  onStartRace,
}) => {
  const [selectedKitId, setSelectedKitId] = useState<BodyKitId>(() =>
    normalizeCarId(equippedKitId)
  );

  const dragXRef = useRef<number | null>(null);

  const activeKit =
    BODY_KITS.find((k) => k.id === selectedKitId) || BODY_KITS[0];
  const isUnlocked = unlockedKits.includes(activeKit.id);
  const canAfford = coins >= activeKit.unlockCost;
  const isEquipped = normalizeCarId(equippedKitId) === activeKit.id;
  const currentIndex = BODY_KITS.findIndex((k) => k.id === activeKit.id);

  useEffect(() => {
    onPreviewKit(activeKit, activeKit.defaultRimId, activeKit.defaultSpoilerId, null);
  }, []);

  const handleCarSelect = (kit: BodyKitSpec) => {
    setSelectedKitId(kit.id);
    window.__theRaceEngine?.playUiClick('click');
    onPreviewKit(kit, kit.defaultRimId, kit.defaultSpoilerId, null);
    if (unlockedKits.includes(kit.id)) {
      onSelectKit(kit, kit.defaultRimId, kit.defaultSpoilerId, null);
    }
  };

  const handlePrevCar = () => {
    const prevIdx = (currentIndex - 1 + BODY_KITS.length) % BODY_KITS.length;
    handleCarSelect(BODY_KITS[prevIdx]);
  };

  const handleNextCar = () => {
    const nextIdx = (currentIndex + 1) % BODY_KITS.length;
    handleCarSelect(BODY_KITS[nextIdx]);
  };

  const handleUnlockOrEquip = () => {
    onSelectKit(activeKit, activeKit.defaultRimId, activeKit.defaultSpoilerId, null);
  };

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between select-none"
      style={{
        paddingTop: 'max(0.6rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.85rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.85rem, env(safe-area-inset-right))',
      }}
    >
      {/* 1. TOP BAR: Back Button (Left) | Coin Balance (Right) — Clean & Minimal */}
      <header className="pointer-events-auto flex items-center justify-between w-full">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            window.__theRaceEngine?.playUiClick('click');
            onBackToMenu();
          }}
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          className="px-3.5 py-1.5 rounded-xl bg-slate-950/90 border border-white/20 active:border-cyan-400 text-xs font-['Orbitron'] italic font-bold text-white tracking-wider uppercase flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
        >
          <span>←</span>
          <span>MENU</span>
        </button>

        {/* Clean Coin Counter */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-amber-400/50 shadow-lg">
          <span className="text-amber-400 text-sm">🪙</span>
          <span className="font-mono font-bold text-xs sm:text-sm text-white tabular-nums">
            {coins.toLocaleString()}
          </span>
        </div>
      </header>

      {/* 2. 3D STAGE (100% Uncluttered View) + Side Chevrons + Touch Drag */}
      <div
        className="flex-1 w-full pointer-events-auto relative flex items-center justify-between cursor-grab active:cursor-grabbing"
        onPointerDown={(e) => {
          dragXRef.current = e.clientX;
        }}
        onPointerMove={(e) => {
          if (dragXRef.current !== null) {
            const dx = e.clientX - dragXRef.current;
            dragXRef.current = e.clientX;
            window.__theRaceEngine?.rotateShowroom?.(dx * 0.012);
          }
        }}
        onPointerUp={() => {
          dragXRef.current = null;
        }}
        onPointerCancel={() => {
          dragXRef.current = null;
        }}
      >
        {/* Left Arrow */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handlePrevCar();
          }}
          aria-label="Previous Car"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          className="w-11 h-11 rounded-full bg-slate-950/70 border border-white/20 text-white font-black text-xl flex items-center justify-center cursor-pointer shadow-xl active:scale-90 hover:border-cyan-400 hover:text-cyan-300 transition-all"
        >
          ‹
        </button>

        {/* Right Arrow */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleNextCar();
          }}
          aria-label="Next Car"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
          className="w-11 h-11 rounded-full bg-slate-950/70 border border-white/20 text-white font-black text-xl flex items-center justify-center cursor-pointer shadow-xl active:scale-90 hover:border-cyan-400 hover:text-cyan-300 transition-all"
        >
          ›
        </button>
      </div>

      {/* 3. FLUSH BOTTOM PANEL: Car Name + 3 Stat Meters + Single Action Bar + Compact Car Strip */}
      <footer className="pointer-events-auto w-full bg-slate-950/95 border-t border-white/15 rounded-2xl p-2.5 sm:p-3 shadow-2xl flex flex-col gap-2">
        {/* Row 1: Car Identity (Left) | Action CTA (Right) */}
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: activeKit.primaryColor }}
              />
              <h2 className="font-['Orbitron'] italic font-black text-sm sm:text-base text-white uppercase tracking-wider truncate leading-tight">
                {activeKit.name}
              </h2>
            </div>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest ml-4 mt-0.5">
              {activeKit.subtitle}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isUnlocked ? (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleUnlockOrEquip}
                disabled={!canAfford}
                style={{ touchAction: 'manipulation' }}
                className={`px-3.5 py-1.5 rounded-xl font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer border transition-transform active:scale-95 ${
                  canAfford
                    ? 'bg-amber-500 border-amber-300 text-slate-950 shadow-md'
                    : 'bg-slate-900 border-white/10 text-slate-500 opacity-60'
                }`}
              >
                {canAfford ? `UNLOCK 🪙 ${activeKit.unlockCost}` : `NEED 🪙 ${activeKit.unlockCost}`}
              </button>
            ) : isEquipped ? (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-[10px] font-['Orbitron'] font-bold text-emerald-300 uppercase">
                EQUIPPED
              </span>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleUnlockOrEquip}
                style={{ touchAction: 'manipulation' }}
                className="px-4 py-1.5 rounded-xl bg-cyan-400 border border-cyan-200 text-slate-950 font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer shadow-md active:scale-95"
              >
                EQUIP
              </button>
            )}

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (isUnlocked && !isEquipped) {
                  onSelectKit(activeKit, activeKit.defaultRimId, activeKit.defaultSpoilerId, null);
                }
                onStartRace();
              }}
              style={{ touchAction: 'manipulation' }}
              className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wider uppercase cursor-pointer shadow-lg active:scale-95"
            >
              RACE ▶
            </button>
          </div>
        </div>

        {/* Row 2: 3 Clean Performance Stat Bars */}
        <div className="grid grid-cols-3 gap-3 bg-slate-900/80 border border-white/10 rounded-xl px-3 py-1.5">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-['Orbitron'] font-bold text-slate-400">SPD</span>
            <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-400 rounded-full transition-all duration-200"
                style={{ width: `${activeKit.stats.speed}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-cyan-300">{activeKit.stats.speed}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-['Orbitron'] font-bold text-slate-400">ACC</span>
            <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-400 rounded-full transition-all duration-200"
                style={{ width: `${activeKit.stats.acceleration}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-amber-300">{activeKit.stats.acceleration}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[9px] font-['Orbitron'] font-bold text-slate-400">HND</span>
            <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-400 rounded-full transition-all duration-200"
                style={{ width: `${activeKit.stats.handling}%` }}
              />
            </div>
            <span className="text-[10px] font-mono font-bold text-emerald-300">{activeKit.stats.handling}</span>
          </div>
        </div>

        {/* Row 3: Clean Horizontal Car Strip */}
        <div className="w-full overflow-x-auto pb-0.5">
          <div className="flex items-center gap-1.5 min-w-max">
            {BODY_KITS.map((kit) => {
              const isSelected = kit.id === activeKit.id;
              const kitUnlocked = unlockedKits.includes(kit.id);
              const kitEquipped = kit.id === normalizeCarId(equippedKitId);

              return (
                <button
                  key={kit.id}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => handleCarSelect(kit)}
                  style={{ touchAction: 'manipulation' }}
                  className={`px-3 py-1.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2 shrink-0 active:scale-95 ${
                    isSelected
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow-[0_0_10px_rgba(6,182,212,0.3)]'
                      : 'bg-slate-900/60 border-white/10 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: kit.primaryColor }}
                  />
                  <span className="font-['Orbitron'] italic font-black text-[11px] whitespace-nowrap">
                    {kit.name}
                  </span>
                  {kitEquipped ? (
                    <span className="text-[9px] font-bold text-emerald-400">✓</span>
                  ) : !kitUnlocked ? (
                    <span className="text-[9px] text-amber-400">🔒</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      </footer>
    </div>
  );
};
