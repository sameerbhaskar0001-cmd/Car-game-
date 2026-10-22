import React, { useState, useEffect } from 'react';
import {
  BODY_KITS,
  BodyKitId,
  BodyKitSpec,
  RIM_OPTIONS,
  RimId,
  SPOILER_OPTIONS,
  SpoilerId,
} from '../types/game';

interface GarageScreenProps {
  coins: number;
  equippedKitId: BodyKitId;
  equippedRimId: RimId;
  equippedSpoilerId: SpoilerId;
  unlockedKits: BodyKitId[];
  onSelectKit: (kit: BodyKitSpec, rimId: RimId, spoilerId: SpoilerId) => void;
  onPreviewKit: (kit: BodyKitSpec, rimId: RimId, spoilerId: SpoilerId) => void;
  onBackToMenu: () => void;
  onStartRace: () => void;
}

export const GarageScreen: React.FC<GarageScreenProps> = ({
  coins,
  equippedKitId,
  equippedRimId,
  equippedSpoilerId,
  unlockedKits,
  onSelectKit,
  onPreviewKit,
  onBackToMenu,
  onStartRace,
}) => {
  const [selectedKitId, setSelectedKitId] = useState<BodyKitId>(equippedKitId);
  const [selectedRimId, setSelectedRimId] = useState<RimId>(equippedRimId);
  const [selectedSpoilerId, setSelectedSpoilerId] =
    useState<SpoilerId>(equippedSpoilerId);

  const activeKit =
    BODY_KITS.find((k) => k.id === selectedKitId) || BODY_KITS[0];
  const isEquipped =
    equippedKitId === activeKit.id &&
    equippedRimId === selectedRimId &&
    equippedSpoilerId === selectedSpoilerId;
  const isUnlocked = unlockedKits.includes(activeKit.id);
  const canAfford = coins >= activeKit.unlockCost;

  // Ensure initial 3D preview matches selected state on mount
  useEffect(() => {
    onPreviewKit(activeKit, selectedRimId, selectedSpoilerId);
  }, []);

  const handleCardSelect = (kit: BodyKitSpec) => {
    const nextRim = kit.defaultRimId;
    const nextSpoiler = kit.defaultSpoilerId;
    setSelectedKitId(kit.id);
    setSelectedRimId(nextRim);
    setSelectedSpoilerId(nextSpoiler);
    onPreviewKit(kit, nextRim, nextSpoiler);
    if (unlockedKits.includes(kit.id)) {
      onSelectKit(kit, nextRim, nextSpoiler);
    }
  };

  const handleRimSelect = (rimId: RimId) => {
    setSelectedRimId(rimId);
    onPreviewKit(activeKit, rimId, selectedSpoilerId);
    if (isUnlocked) {
      onSelectKit(activeKit, rimId, selectedSpoilerId);
    }
  };

  const handleSpoilerSelect = (spoilerId: SpoilerId) => {
    setSelectedSpoilerId(spoilerId);
    onPreviewKit(activeKit, selectedRimId, spoilerId);
    if (isUnlocked) {
      onSelectKit(activeKit, selectedRimId, spoilerId);
    }
  };

  const handlePrimaryAction = () => {
    onSelectKit(activeKit, selectedRimId, selectedSpoilerId);
  };

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between select-none"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(1rem, env(safe-area-inset-left))',
        paddingRight: 'max(1rem, env(safe-area-inset-right))',
      }}
    >
      {/* Subtle Edge Vignette leaving Center 3D Car Turntable 100% Clear */}
      <div
        className="fixed inset-0 -z-10 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 52%, rgba(4, 7, 15, 0.0) 0%, rgba(4, 7, 15, 0.14) 44%, rgba(4, 7, 15, 0.85) 100%)',
        }}
      />

      {/* TOP BAR: Back Button (Left) | Clean Car Title Banner (Center) | Coin Balance (Right) */}
      <header className="pointer-events-auto flex items-center justify-between gap-3 w-full">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              onBackToMenu();
            }}
            onClick={onBackToMenu}
            className="px-4 py-2 rounded-xl bg-slate-950/90 border border-white/25 hover:border-cyan-400 text-xs font-['Orbitron'] italic font-bold text-white tracking-wider uppercase flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-95"
          >
            <span>←</span>
            <span>MENU</span>
          </button>
          <span className="font-['Orbitron'] italic font-black text-base sm:text-xl text-white uppercase tracking-wider">
            GARAGE
          </span>
        </div>

        {/* Center Clean Vehicle Badge */}
        <div className="hidden sm:flex items-center gap-2.5 bg-slate-950/85 border border-white/15 rounded-xl px-4 py-1.5 shadow-lg">
          <span
            className="w-3 h-3 rounded-full shadow-sm"
            style={{
              backgroundColor: activeKit.primaryColor,
              boxShadow: `0 0 10px ${activeKit.primaryColor}`,
            }}
          />
          <span className="font-['Orbitron'] italic font-black text-sm text-white tracking-wider uppercase">
            {activeKit.name}
          </span>
          <span className="text-white/25">|</span>
          <span className="text-[10px] font-['Orbitron'] font-bold tracking-widest text-cyan-300 uppercase">
            {activeKit.tag}
          </span>
        </div>

        {/* Player Coin Balance */}
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-950/90 border border-amber-400/50 shadow-lg">
          <svg
            className="w-4 h-4 text-amber-400 shrink-0"
            viewBox="0 0 24 24"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" fill="#f59e0b" />
            <circle cx="12" cy="12" r="7.5" fill="#fbbf24" />
          </svg>
          <span className="font-mono font-bold text-sm sm:text-base text-white tabular-nums">
            {coins.toLocaleString()}
          </span>
        </div>
      </header>

      {/* MIDDLE ROW: Left Dock (Arcade Vehicle Preview Cards) | Center 3D Car | Right Dock (Icon Customization & Minimalist Stat Bars) */}
      <div className="flex items-center justify-between w-full my-auto gap-3 sm:gap-5">
        {/* LEFT DOCK: 3 Clean Arcade Vehicle Preview Cards ("Street Tuner", "Aero Beast", "Cyber Phantom") */}
        <div className="pointer-events-auto w-[205px] sm:w-[240px] bg-slate-950/90 border border-white/15 rounded-2xl p-2.5 sm:p-3 shadow-2xl flex flex-col gap-2">
          <div className="text-[10px] font-['Orbitron'] italic font-bold tracking-[0.16em] text-slate-400 uppercase px-1">
            VEHICLES
          </div>

          {BODY_KITS.map((kit) => {
            const isSelected = kit.id === selectedKitId;
            const kitEquipped = kit.id === equippedKitId;
            const kitUnlocked = unlockedKits.includes(kit.id);

            return (
              <button
                key={kit.id}
                type="button"
                onTouchStart={(e) => {
                  e.stopPropagation();
                  handleCardSelect(kit);
                }}
                onClick={() => handleCardSelect(kit)}
                className={`w-full text-left p-2.5 rounded-xl border-2 transition-all cursor-pointer flex items-center gap-3 ${
                  isSelected
                    ? 'bg-slate-900 border-cyan-400 shadow-[0_0_18px_rgba(0,229,255,0.28)]'
                    : 'bg-slate-900/70 border-white/10 hover:border-white/30'
                }`}
              >
                {/* Arcade Vehicle Silhouette Thumbnail */}
                <div
                  className="w-11 h-10 rounded-lg shrink-0 flex items-center justify-center border border-white/20 shadow-inner relative overflow-hidden"
                  style={{
                    background: `radial-gradient(circle at 50% 35%, ${kit.primaryColor}44 0%, #090d16 90%)`,
                  }}
                >
                  <svg
                    className="w-8 h-5"
                    viewBox="0 0 48 24"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 16L9 9.5C10.5 7.5 13 6.5 16 6.5H29C32.5 6.5 35.5 8 38 10.5L43 13C44.2 13.6 45 14.8 45 16.2V17.5C45 18.3 44.3 19 43.5 19H4.5C3.7 19 3 18.3 3 17.5V16.8C3 16.3 3.8 16 5 16Z"
                      fill={kit.primaryColor}
                    />
                    <path
                      d="M15 8.2H28.5L34 12.2H12.5L15 8.2Z"
                      fill="#0b1324"
                    />
                    <circle cx="12" cy="18.2" r="4" fill="#1e293b" stroke="#e2e8f0" strokeWidth="1.5" />
                    <circle cx="36" cy="18.2" r="4" fill="#1e293b" stroke="#e2e8f0" strokeWidth="1.5" />
                  </svg>
                </div>

                {/* Clean Vehicle Name & Status */}
                <div className="min-w-0 flex-1">
                  <div className="font-['Orbitron'] italic font-black text-xs sm:text-sm text-white truncate">
                    {kit.name}
                  </div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {kit.subtitle}
                  </div>
                  <div className="text-[9px] font-['Orbitron'] font-bold uppercase tracking-wider mt-0.5">
                    {kitEquipped ? (
                      <span className="text-emerald-400">● EQUIPPED</span>
                    ) : kitUnlocked ? (
                      <span className="text-cyan-300">READY</span>
                    ) : (
                      <span className="text-amber-300">{kit.unlockCost} COINS</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* CENTER VIEWPORT: 100% Unobstructed 3D Rotating Showroom Car */}
        <div className="flex-1 pointer-events-none" />

        {/* RIGHT DOCK: Clean Icon Buttons & High-Contrast Minimalist Stat Bars */}
        <div className="pointer-events-auto w-[215px] sm:w-[250px] bg-slate-950/90 border border-white/15 rounded-2xl p-3 sm:p-3.5 shadow-2xl flex flex-col gap-3">
          {/* Wheels Icon Selector */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-['Orbitron'] font-bold tracking-wider text-slate-300 uppercase mb-1.5">
              <span>RIMS</span>
              <span className="text-cyan-300 text-[9px]">
                {RIM_OPTIONS.find((r) => r.id === selectedRimId)?.name}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {RIM_OPTIONS.map((rim, idx) => {
                const active = selectedRimId === rim.id;
                return (
                  <button
                    key={rim.id}
                    type="button"
                    title={rim.name}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      handleRimSelect(rim.id);
                    }}
                    onClick={() => handleRimSelect(rim.id)}
                    className={`h-10 rounded-xl flex flex-col items-center justify-center cursor-pointer border-2 transition-all active:scale-95 ${
                      active
                        ? 'bg-cyan-500/25 border-cyan-400 text-white shadow-[0_0_12px_rgba(0,229,255,0.3)]'
                        : 'bg-slate-900/90 border-white/10 text-slate-400 hover:border-white/30'
                    }`}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <circle cx="12" cy="12" r="9" />
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 3v6M12 15v6M3 12h6M15 12h6" />
                    </svg>
                    <span className="text-[8px] font-['Orbitron'] font-bold mt-0.5">
                      W{idx + 1}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Rear Wing Icon Selector */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-['Orbitron'] font-bold tracking-wider text-slate-300 uppercase mb-1.5">
              <span>SPOILER</span>
              <span className="text-amber-300 text-[9px]">
                {SPOILER_OPTIONS.find((s) => s.id === selectedSpoilerId)?.name}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {SPOILER_OPTIONS.map((sp, idx) => {
                const active = selectedSpoilerId === sp.id;
                return (
                  <button
                    key={sp.id}
                    type="button"
                    title={sp.name}
                    onTouchStart={(e) => {
                      e.stopPropagation();
                      handleSpoilerSelect(sp.id);
                    }}
                    onClick={() => handleSpoilerSelect(sp.id)}
                    className={`h-10 rounded-xl flex flex-col items-center justify-center cursor-pointer border-2 transition-all active:scale-95 ${
                      active
                        ? 'bg-amber-500/25 border-amber-400 text-white shadow-[0_0_12px_rgba(251,191,36,0.3)]'
                        : 'bg-slate-900/90 border-white/10 text-slate-400 hover:border-white/30'
                    }`}
                  >
                    <svg className="w-5 h-3.5" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      {idx === 0 ? (
                        <path d="M4 12h16" />
                      ) : idx === 1 ? (
                        <path d="M3 6h18M7 6v6M17 6v6" />
                      ) : (
                        <path d="M2 4h20M5 7h14M7 4v8M17 4v8" />
                      )}
                    </svg>
                    <span className="text-[8px] font-['Orbitron'] font-bold mt-0.5">
                      {idx === 0 ? 'CLEAN' : idx === 1 ? 'STREET' : 'GT PRO'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* High-Contrast Minimalist Stat Bars: Top Speed, Handling, Acceleration */}
          <div className="bg-slate-900/95 border border-white/15 rounded-xl p-2.5 flex flex-col gap-2">
            <div>
              <div className="flex justify-between items-center text-[10px] font-['Orbitron'] font-bold mb-1">
                <span className="text-white tracking-wider">TOP SPEED</span>
                <span className="font-mono font-bold text-cyan-300">
                  {activeKit.stats.speed}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full transition-all duration-200 bg-gradient-to-r from-cyan-500 to-cyan-300 rounded-full"
                  style={{ width: `${activeKit.stats.speed}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-[10px] font-['Orbitron'] font-bold mb-1">
                <span className="text-white tracking-wider">HANDLING</span>
                <span className="font-mono font-bold text-emerald-300">
                  {activeKit.stats.handling}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full transition-all duration-200 bg-gradient-to-r from-emerald-500 to-emerald-300 rounded-full"
                  style={{ width: `${activeKit.stats.handling}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-[10px] font-['Orbitron'] font-bold mb-1">
                <span className="text-white tracking-wider">ACCELERATION</span>
                <span className="font-mono font-bold text-amber-300">
                  {activeKit.stats.acceleration}
                </span>
              </div>
              <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-white/10">
                <div
                  className="h-full transition-all duration-200 bg-gradient-to-r from-amber-500 to-amber-300 rounded-full"
                  style={{ width: `${activeKit.stats.acceleration}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BOTTOM ACTION BAR: Unlock/Equip & Start Race */}
      <footer className="pointer-events-auto flex items-center justify-center gap-3 w-full">
        {!isUnlocked && (
          <button
            type="button"
            onTouchStart={(e) => {
              e.stopPropagation();
              handlePrimaryAction();
            }}
            onClick={handlePrimaryAction}
            disabled={!canAfford}
            className={`py-2.5 px-6 rounded-xl font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wider uppercase transition-all cursor-pointer border-2 shadow-xl ${
              canAfford
                ? 'bg-amber-500/35 border-amber-400 text-white active:scale-95'
                : 'bg-slate-900/80 border-white/15 text-slate-400 opacity-75'
            }`}
          >
            {canAfford
              ? `UNLOCK (${activeKit.unlockCost} COINS)`
              : `NEED ${activeKit.unlockCost} COINS`}
          </button>
        )}

        <button
          type="button"
          onTouchStart={(e) => {
            e.stopPropagation();
            if (isUnlocked && !isEquipped) {
              onSelectKit(activeKit, selectedRimId, selectedSpoilerId);
            }
            onStartRace();
          }}
          onClick={() => {
            if (isUnlocked && !isEquipped) {
              onSelectKit(activeKit, selectedRimId, selectedSpoilerId);
            }
            onStartRace();
          }}
          className="py-2.5 px-8 rounded-xl bg-gradient-to-r from-cyan-500/45 to-emerald-500/45 border-2 border-cyan-300 font-['Orbitron'] italic font-black text-xs sm:text-sm text-white tracking-wider uppercase cursor-pointer shadow-xl active:scale-95"
        >
          RACE THIS CAR ▶
        </button>
      </footer>
    </div>
  );
};
