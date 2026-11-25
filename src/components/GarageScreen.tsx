import React, { useState, useEffect, useRef } from 'react';
import {
  BODY_KITS,
  BodyKitId,
  BodyKitSpec,
  CarUpgradeLevels,
  DEFAULT_CAR_UPGRADES,
  PAINT_OPTIONS,
  RIM_OPTIONS,
  RimId,
  SPOILER_OPTIONS,
  SpoilerId,
  UpgradePartKey,
  getEffectiveCarPerformance,
  getUpgradeCost,
  normalizeCarId,
} from '../types/game';

interface GarageScreenProps {
  coins: number;
  equippedKitId: BodyKitId;
  equippedRimId: RimId;
  equippedSpoilerId: SpoilerId;
  equippedPaintHex: string | null;
  unlockedKits: BodyKitId[];
  carUpgradesMap: Partial<Record<BodyKitId, CarUpgradeLevels>>;
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
  onUpgradePart: (kit: BodyKitSpec, part: UpgradePartKey) => void;
  onBackToMenu: () => void;
  onStartRace: () => void;
}

type WorkshopTab = 'cars' | 'upgrades' | 'customize';
type CustomizePartTab = 'paint' | 'rims' | 'spoiler';

export const GarageScreen: React.FC<GarageScreenProps> = ({
  coins,
  equippedKitId,
  equippedRimId,
  equippedSpoilerId,
  equippedPaintHex,
  unlockedKits,
  carUpgradesMap,
  onSelectKit,
  onPreviewKit,
  onUpgradePart,
  onBackToMenu,
  onStartRace,
}) => {
  const [selectedKitId, setSelectedKitId] = useState<BodyKitId>(() =>
    normalizeCarId(equippedKitId)
  );
  const [activeTab, setActiveTab] = useState<WorkshopTab>('cars');
  const [customizeSubTab, setCustomizeSubTab] = useState<CustomizePartTab>('paint');

  const [previewRimId, setPreviewRimId] = useState<RimId>(equippedRimId);
  const [previewSpoilerId, setPreviewSpoilerId] = useState<SpoilerId>(equippedSpoilerId);
  const [previewPaintHex, setPreviewPaintHex] = useState<string | null>(equippedPaintHex);

  const dragXRef = useRef<number | null>(null);

  const activeKit =
    BODY_KITS.find((k) => k.id === selectedKitId) || BODY_KITS[0];
  const isUnlocked = unlockedKits.includes(activeKit.id);
  const canAfford = coins >= activeKit.unlockCost;
  const isEquipped = normalizeCarId(equippedKitId) === activeKit.id;

  const activeUpgrades = carUpgradesMap[activeKit.id] || DEFAULT_CAR_UPGRADES;
  const perf = getEffectiveCarPerformance(activeKit, activeUpgrades);
  const currentIndex = BODY_KITS.findIndex((k) => k.id === activeKit.id);

  useEffect(() => {
    onPreviewKit(activeKit, previewRimId, previewSpoilerId, previewPaintHex);
  }, []);

  const handleCarSelect = (kit: BodyKitSpec) => {
    setSelectedKitId(kit.id);
    const isTargetEquipped = kit.id === normalizeCarId(equippedKitId);
    const nextRim = isTargetEquipped ? equippedRimId : kit.defaultRimId;
    const nextSpoiler = isTargetEquipped ? equippedSpoilerId : kit.defaultSpoilerId;
    const nextPaint = isTargetEquipped ? equippedPaintHex : null;
    setPreviewRimId(nextRim);
    setPreviewSpoilerId(nextSpoiler);
    setPreviewPaintHex(nextPaint);

    onPreviewKit(kit, nextRim, nextSpoiler, nextPaint);
    if (unlockedKits.includes(kit.id)) {
      onSelectKit(kit, nextRim, nextSpoiler, nextPaint);
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
    onSelectKit(activeKit, previewRimId, previewSpoilerId, previewPaintHex);
  };

  const applyCustomChange = (
    nextRim: RimId,
    nextSpoiler: SpoilerId,
    nextPaint: string | null
  ) => {
    setPreviewRimId(nextRim);
    setPreviewSpoilerId(nextSpoiler);
    setPreviewPaintHex(nextPaint);
    window.__theRaceEngine?.playUiClick('click');
    if (isUnlocked) {
      onSelectKit(activeKit, nextRim, nextSpoiler, nextPaint);
    } else {
      onPreviewKit(activeKit, nextRim, nextSpoiler, nextPaint);
    }
  };

  const classColorMap: Record<'D' | 'C' | 'B' | 'A' | 'S', string> = {
    D: 'bg-slate-600 text-white',
    C: 'bg-sky-500 text-slate-950',
    B: 'bg-emerald-400 text-slate-950',
    A: 'bg-amber-400 text-slate-950',
    S: 'bg-rose-500 text-white',
  };

  const upgradeRows: {
    key: UpgradePartKey;
    label: string;
    boost: string;
    accent: string;
  }[] = [
    { key: 'engine', label: 'Engine', boost: '+Speed', accent: '#06b6d4' },
    { key: 'turbo', label: 'Turbo', boost: '+Accel', accent: '#f59e0b' },
    { key: 'tires', label: 'Tires', boost: '+Grip', accent: '#34d399' },
    { key: 'nitro', label: 'Nitro', boost: '+Boost', accent: '#c084fc' },
  ];

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between select-none font-['Plus_Jakarta_Sans']"
      style={{
        paddingTop: 'max(0.55rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.85rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.85rem, env(safe-area-inset-right))',
      }}
    >
      {/* 1. CLEAN TOP BAR: Back | Car Name & PR | Coins */}
      <header className="pointer-events-auto flex items-center justify-between gap-2 w-full">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            window.__theRaceEngine?.playUiClick('click');
            onBackToMenu();
          }}
          style={{ touchAction: 'manipulation' }}
          className="h-9 px-3.5 rounded-lg bg-[#070b14]/88 border border-white/15 hover:border-cyan-400/60 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap shrink-0 backdrop-blur-md"
        >
          <span>←</span>
          <span>Lobby</span>
        </button>

        {/* Compact Centered Car Identity */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#070b14]/84 border border-white/12 backdrop-blur-md min-w-0">
          <span
            className={`w-6 h-6 rounded font-['Orbitron'] italic font-black text-xs flex items-center justify-center shrink-0 ${classColorMap[perf.carClass]}`}
          >
            {perf.carClass}
          </span>
          <span className="font-['Orbitron'] italic font-black text-xs sm:text-sm text-white tracking-wider uppercase truncate">
            {activeKit.name}
          </span>
          <span className="text-slate-500 text-xs hidden sm:inline" aria-hidden="true">·</span>
          <span className="font-mono font-bold text-[11px] sm:text-xs text-amber-300 tabular-nums shrink-0">
            PR {perf.pr}
          </span>
        </div>

        {/* Coins Counter */}
        <div className="h-9 flex items-center gap-1.5 px-3 rounded-lg bg-[#070b14]/88 border border-amber-400/45 backdrop-blur-md shrink-0 whitespace-nowrap">
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
      </header>

      {/* 2. WIDE-OPEN 360° 3D CAR TURNTABLE STAGE (Always >75% visible — even during Customize!) */}
      <div
        className="flex-1 w-full pointer-events-auto relative flex items-center justify-between cursor-grab active:cursor-grabbing min-h-[140px]"
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
        {/* Minimal Floating Spec Readout (Top-Left corner only — hidden on Customize so 3D view is 100% pure) */}
        {activeTab !== 'customize' && (
          <div className="hidden sm:flex flex-col gap-1.5 absolute top-2.5 left-0 w-44 p-2.5 rounded-xl bg-[#070b14]/72 border border-white/10 backdrop-blur-sm pointer-events-none">
            {[
              { label: 'Speed', val: perf.stats.speed, color: 'bg-cyan-400' },
              { label: 'Accel', val: perf.stats.acceleration, color: 'bg-amber-400' },
              { label: 'Grip', val: perf.stats.handling, color: 'bg-emerald-400' },
              { label: 'Drift', val: perf.stats.drift, color: 'bg-sky-400' },
            ].map((stat) => (
              <div key={stat.label} className="flex items-center gap-2">
                <span className="text-[10px] font-medium text-slate-300 w-10 shrink-0">
                  {stat.label}
                </span>
                <div className="flex-1 h-1 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${stat.color} rounded-full transition-all duration-200`}
                    style={{ width: `${stat.val}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono font-bold tabular-nums text-white w-5 text-right">
                  {stat.val}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handlePrevCar();
          }}
          aria-label="Previous Car"
          style={{ touchAction: 'manipulation' }}
          className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#070b14]/72 border border-white/20 text-white font-bold text-xl flex items-center justify-center cursor-pointer shadow-xl active:scale-90 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
        >
          ‹
        </button>

        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handleNextCar();
          }}
          aria-label="Next Car"
          style={{ touchAction: 'manipulation' }}
          className="w-9 h-9 sm:w-11 sm:h-11 rounded-full bg-[#070b14]/72 border border-white/20 text-white font-bold text-xl flex items-center justify-center cursor-pointer shadow-xl active:scale-90 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
        >
          ›
        </button>
      </div>

      {/* 3. ULTRA-SLIM FRICTIONLESS BOTTOM DOCK (Low profile — NEVER covers the 3D car!) */}
      <footer className="pointer-events-auto w-full max-w-5xl mx-auto bg-[#070b14]/92 border border-white/14 rounded-2xl px-3 py-2.5 shadow-2xl backdrop-blur-md flex flex-col gap-2">
        {/* Compact Action Row: 3 Tabs (Left) | Unlock / Equip / Race CTA (Right) */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-950/90 border border-white/10">
            {(
              [
                { id: 'cars', label: 'Cars' },
                { id: 'upgrades', label: 'Upgrades' },
                { id: 'customize', label: 'Customize' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  window.__theRaceEngine?.playUiClick('click');
                  setActiveTab(tab.id);
                }}
                style={{ touchAction: 'manipulation' }}
                className={`px-3 sm:px-4 py-1.5 rounded-md text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-cyan-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isUnlocked ? (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleUnlockOrEquip}
                disabled={!canAfford}
                style={{ touchAction: 'manipulation' }}
                className={`px-3.5 py-1.5 rounded-lg font-['Orbitron'] italic font-black text-[11px] sm:text-xs uppercase border transition-transform active:scale-95 whitespace-nowrap ${
                  canAfford
                    ? 'bg-amber-400 border-amber-200 text-slate-950 cursor-pointer'
                    : 'bg-slate-900 border-white/10 text-slate-400 cursor-not-allowed'
                }`}
              >
                {canAfford
                  ? `Buy 🪙 ${activeKit.unlockCost.toLocaleString()}`
                  : `🪙 ${activeKit.unlockCost.toLocaleString()} COINS`}
              </button>
            ) : !isEquipped ? (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleUnlockOrEquip}
                style={{ touchAction: 'manipulation' }}
                className="px-3.5 py-1.5 rounded-lg bg-cyan-400 text-slate-950 font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer active:scale-95 whitespace-nowrap"
              >
                Equip
              </button>
            ) : null}

            {isUnlocked && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  if (!isEquipped) {
                    onSelectKit(activeKit, previewRimId, previewSpoilerId, previewPaintHex);
                  }
                  onStartRace();
                }}
                style={{ touchAction: 'manipulation' }}
                className="px-4 sm:px-5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-amber-400 text-slate-950 font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wider uppercase cursor-pointer active:scale-95 whitespace-nowrap"
              >
                Race →
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: SINGLE-ROW SILKY HORIZONTAL CAR SELECTOR */}
        {activeTab === 'cars' && (
          <div
            className="w-full overflow-x-auto pb-0.5"
            style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}
          >
            <div className="flex items-center gap-2 min-w-max">
              {BODY_KITS.map((kit) => {
                const isSelected = kit.id === activeKit.id;
                const kitUnlocked = unlockedKits.includes(kit.id);
                const kitEquipped = kit.id === normalizeCarId(equippedKitId);
                const kitPerf = getEffectiveCarPerformance(
                  kit,
                  carUpgradesMap[kit.id] || DEFAULT_CAR_UPGRADES
                );

                return (
                  <button
                    key={kit.id}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => handleCarSelect(kit)}
                    style={{ touchAction: 'manipulation' }}
                    className={`px-3 py-1.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 shrink-0 active:scale-95 ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-white'
                        : 'bg-slate-900/75 border-white/10 text-slate-300 hover:border-white/25'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded font-['Orbitron'] italic font-black text-[10px] flex items-center justify-center shrink-0 ${classColorMap[kitPerf.carClass]}`}
                    >
                      {kitPerf.carClass}
                    </span>
                    <div className="min-w-0">
                      <div className="font-['Orbitron'] italic font-black text-xs leading-none whitespace-nowrap">
                        {kit.name}
                      </div>
                      <div className="text-[10px] font-mono tabular-nums mt-1 leading-none whitespace-nowrap">
                        {kitEquipped ? (
                          <span className="text-emerald-400 font-semibold">Active · PR {kitPerf.pr}</span>
                        ) : kitUnlocked ? (
                          <span className="text-slate-300">Owned · PR {kitPerf.pr}</span>
                        ) : (
                          <span className="text-amber-300">
                            🪙 {kit.unlockCost.toLocaleString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 2: COMPACT SINGLE-ROW 4-PART UPGRADE STRIP */}
        {activeTab === 'upgrades' && (
          <div
            className="w-full overflow-x-auto pb-0.5"
            style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}
          >
            <div className="grid grid-cols-4 gap-2 min-w-[460px]">
              {upgradeRows.map((row) => {
                const lvl = activeUpgrades[row.key] || 1;
                const cost = getUpgradeCost(lvl);
                const isMax = cost === null;
                const canUpgrade = isUnlocked && !isMax && coins >= cost;

                return (
                  <div
                    key={row.key}
                    className="px-2.5 py-2 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between gap-1 leading-none">
                      <span className="text-[11px] font-bold text-white whitespace-nowrap">
                        {row.label}
                      </span>
                      <span className="font-mono text-[10px] text-slate-300 tabular-nums">
                        Lv.{lvl}/5
                      </span>
                    </div>

                    <div className="grid grid-cols-5 gap-0.5">
                      {[1, 2, 3, 4, 5].map((pip) => (
                        <div
                          key={pip}
                          className="h-1 rounded-full"
                          style={{
                            backgroundColor: pip <= lvl ? row.accent : 'rgba(255,255,255,0.12)',
                          }}
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={!canUpgrade}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onUpgradePart(activeKit, row.key)}
                      style={{ touchAction: 'manipulation' }}
                      className={`w-full py-1 px-2 rounded-md text-[10px] font-bold transition-colors whitespace-nowrap ${
                        !isUnlocked
                          ? 'bg-slate-950/70 text-slate-500 cursor-not-allowed'
                          : isMax
                            ? 'bg-emerald-500/15 text-emerald-300 cursor-default'
                            : canUpgrade
                              ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer active:scale-95'
                              : 'bg-slate-950/80 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      {!isUnlocked
                        ? 'Locked'
                        : isMax
                          ? 'MAX'
                          : `🪙 ${cost.toLocaleString()}`}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: ULTRA-SLIM SINGLE-ROW CUSTOMIZE BAR (Zero screen bloat — 3D car stays 100% visible!) */}
        {activeTab === 'customize' && (
          <div className="flex items-center gap-2.5 overflow-x-auto pb-0.5" style={{ touchAction: 'pan-x', WebkitOverflowScrolling: 'touch' }}>
            {/* Part Switcher */}
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-950 border border-white/10 shrink-0">
              {(
                [
                  { id: 'paint', label: 'Paint' },
                  { id: 'rims', label: 'Rims' },
                  { id: 'spoiler', label: 'Spoiler' },
                ] as const
              ).map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    window.__theRaceEngine?.playUiClick('click');
                    setCustomizeSubTab(sub.id);
                  }}
                  style={{ touchAction: 'manipulation' }}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    customizeSubTab === sub.id
                      ? 'bg-amber-400 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            <div className="h-5 w-px bg-white/15 shrink-0" />

            {/* Single-Row Paint Swatches */}
            {customizeSubTab === 'paint' && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => applyCustomChange(previewRimId, previewSpoilerId, null)}
                  style={{ touchAction: 'manipulation' }}
                  className={`px-3 h-8 rounded-lg text-[11px] font-semibold border cursor-pointer whitespace-nowrap transition-colors ${
                    previewPaintHex === null
                      ? 'bg-cyan-500/20 border-cyan-400 text-white'
                      : 'bg-slate-900 border-white/15 text-slate-300 hover:text-white'
                  }`}
                >
                  Factory
                </button>
                {PAINT_OPTIONS.map((p) => {
                  const selected = previewPaintHex === p.hex;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => applyCustomChange(previewRimId, previewSpoilerId, p.hex)}
                      style={{ backgroundColor: p.hex, touchAction: 'manipulation' }}
                      aria-label={p.name}
                      title={p.name}
                      className={`w-8 h-8 rounded-full border-2 cursor-pointer transition-transform active:scale-90 shrink-0 ${
                        selected ? 'border-white scale-110 shadow-lg' : 'border-white/30'
                      }`}
                    />
                  );
                })}
              </div>
            )}

            {/* Single-Row Rim Choices */}
            {customizeSubTab === 'rims' && (
              <div className="flex items-center gap-2 shrink-0">
                {RIM_OPTIONS.map((rim) => {
                  const selected = previewRimId === rim.id;
                  return (
                    <button
                      key={rim.id}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() =>
                        applyCustomChange(rim.id, previewSpoilerId, previewPaintHex)
                      }
                      style={{ touchAction: 'manipulation' }}
                      className={`px-3 h-8 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors flex items-center gap-2 whitespace-nowrap ${
                        selected
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-slate-900 border-white/12 text-slate-300 hover:text-white'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: rim.accentHex }}
                      />
                      <span>{rim.name}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Single-Row Spoiler Choices */}
            {customizeSubTab === 'spoiler' && (
              <div className="flex items-center gap-2 shrink-0">
                {SPOILER_OPTIONS.map((sp) => {
                  const selected = previewSpoilerId === sp.id;
                  return (
                    <button
                      key={sp.id}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() =>
                        applyCustomChange(previewRimId, sp.id, previewPaintHex)
                      }
                      style={{ touchAction: 'manipulation' }}
                      className={`px-3.5 h-8 rounded-lg border text-[11px] font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                        selected
                          ? 'bg-amber-500/20 border-amber-400 text-white'
                          : 'bg-slate-900 border-white/12 text-slate-300 hover:text-white'
                      }`}
                    >
                      {sp.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </footer>
    </div>
  );
};
