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

type WorkshopTab = 'showroom' | 'upgrades' | 'customize';
type CategoryFilter = 'ALL' | 'COUPE' | 'MUSCLE' | 'SUPERCAR' | 'HYPERCAR' | 'RALLY' | 'SPECIAL';

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
  const [activeTab, setActiveTab] = useState<WorkshopTab>('showroom');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');

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

  const filteredCars =
    categoryFilter === 'ALL'
      ? BODY_KITS
      : BODY_KITS.filter((k) =>
          categoryFilter === 'SPECIAL'
            ? k.category === 'SPECIAL' || k.category === 'OFFROAD'
            : k.category === categoryFilter
        );

  const currentIndex = BODY_KITS.findIndex((k) => k.id === activeKit.id);

  useEffect(() => {
    onPreviewKit(activeKit, previewRimId, previewSpoilerId, previewPaintHex);
  }, []);

  const handleCarSelect = (kit: BodyKitSpec) => {
    setSelectedKitId(kit.id);
    const nextRim = kit.id === normalizeCarId(equippedKitId) ? equippedRimId : kit.defaultRimId;
    const nextSpoiler =
      kit.id === normalizeCarId(equippedKitId) ? equippedSpoilerId : kit.defaultSpoilerId;
    const nextPaint = kit.id === normalizeCarId(equippedKitId) ? equippedPaintHex : null;
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
    effect: string;
    accent: string;
  }[] = [
    { key: 'engine', label: 'Engine Block', effect: '+3 Top Speed', accent: '#06b6d4' },
    { key: 'turbo', label: 'Twin Turbo', effect: '+3 Acceleration', accent: '#f59e0b' },
    { key: 'tires', label: 'Racing Slicks', effect: '+3 Handling · +2 Drift', accent: '#34d399' },
    { key: 'nitro', label: 'Nitro Core', effect: '+Boost & Launch', accent: '#c084fc' },
  ];

  return (
    <div
      className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between select-none font-['Plus_Jakarta_Sans']"
      style={{
        paddingTop: 'max(0.6rem, env(safe-area-inset-top))',
        paddingBottom: 'max(0.55rem, env(safe-area-inset-bottom))',
        paddingLeft: 'max(0.85rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.85rem, env(safe-area-inset-right))',
      }}
    >
      {/* 1. TOP BAR: Back to Lobby | Live Car Class & PR | Credits */}
      <header className="pointer-events-auto flex items-center justify-between gap-2 w-full">
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => {
            window.__theRaceEngine?.playUiClick('click');
            onBackToMenu();
          }}
          style={{ touchAction: 'manipulation' }}
          className="h-9 px-3.5 rounded-lg bg-[#070b14]/90 border border-white/15 hover:border-cyan-400/60 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap shrink-0 backdrop-blur-md"
        >
          <span>←</span>
          <span>Lobby</span>
        </button>

        {/* Center Identity Bar */}
        <div className="hidden sm:flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-[#070b14]/88 border border-white/12 backdrop-blur-md">
          <span
            className={`w-6 h-6 rounded font-['Orbitron'] italic font-black text-xs flex items-center justify-center ${classColorMap[perf.carClass]}`}
          >
            {perf.carClass}
          </span>
          <span className="font-['Orbitron'] italic font-black text-sm text-white tracking-wider uppercase">
            {activeKit.name}
          </span>
          <span className="text-slate-500 text-xs" aria-hidden="true">·</span>
          <span className="font-mono font-bold text-xs text-amber-300 tabular-nums">
            PR {perf.pr}
          </span>
          <span className="text-slate-500 text-xs" aria-hidden="true">·</span>
          <span className="text-xs text-slate-400">{activeKit.subtitle}</span>
        </div>

        {/* Credits Counter */}
        <div className="h-9 flex items-center gap-2 px-3 rounded-lg bg-[#070b14]/90 border border-amber-400/45 backdrop-blur-md shrink-0">
          <span className="font-['Orbitron'] font-bold text-[10px] text-amber-400">CR</span>
          <span className="font-mono font-bold text-sm text-white tabular-nums">
            {coins.toLocaleString()}
          </span>
        </div>
      </header>

      {/* 2. UNCLUTTERED 360° 3D TURNTABLE STAGE + SIDE ARROWS */}
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
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            handlePrevCar();
          }}
          aria-label="Previous Car"
          style={{ touchAction: 'manipulation' }}
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#070b14]/75 border border-white/20 text-white font-bold text-xl flex items-center justify-center cursor-pointer shadow-xl active:scale-90 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
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
          className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#070b14]/75 border border-white/20 text-white font-bold text-xl flex items-center justify-center cursor-pointer shadow-xl active:scale-90 hover:border-cyan-400 hover:text-cyan-300 transition-colors"
        >
          ›
        </button>
      </div>

      {/* 3. BOTTOM WORKSHOP CONSOLE: Tabs (Showroom / Upgrades / Customize) + Stats + Controls */}
      <footer className="pointer-events-auto w-full max-w-6xl mx-auto bg-[#070b14]/94 border border-white/15 rounded-2xl p-3 sm:p-3.5 shadow-2xl backdrop-blur-md flex flex-col gap-2.5">
        {/* Header Row: Workshop Mode Tabs (Left) | Unlock / Equip + Race CTA (Right) */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-950/90 border border-white/10">
            {(
              [
                { id: 'showroom', label: 'Showroom' },
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
                className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-cyan-400 text-slate-950 font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Mobile Car Name + PR + Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex sm:hidden items-center gap-1.5 mr-1">
              <span
                className={`w-5 h-5 rounded font-['Orbitron'] italic font-black text-[10px] flex items-center justify-center ${classColorMap[perf.carClass]}`}
              >
                {perf.carClass}
              </span>
              <span className="font-['Orbitron'] italic font-black text-xs text-white">
                {activeKit.name}
              </span>
            </div>

            {!isUnlocked ? (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleUnlockOrEquip}
                disabled={!canAfford}
                style={{ touchAction: 'manipulation' }}
                className={`px-3.5 py-1.5 rounded-lg font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer border transition-transform active:scale-95 whitespace-nowrap ${
                  canAfford
                    ? 'bg-amber-400 border-amber-200 text-slate-950'
                    : 'bg-slate-900 border-white/10 text-slate-500 cursor-not-allowed'
                }`}
              >
                {canAfford ? `Unlock · ${activeKit.unlockCost} CR` : `Need ${activeKit.unlockCost} CR`}
              </button>
            ) : isEquipped ? (
              <span className="text-xs font-semibold text-emerald-400 px-2 whitespace-nowrap">
                Equipped
              </span>
            ) : (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={handleUnlockOrEquip}
                style={{ touchAction: 'manipulation' }}
                className="px-4 py-1.5 rounded-lg bg-cyan-400 text-slate-950 font-['Orbitron'] italic font-black text-xs uppercase cursor-pointer active:scale-95 whitespace-nowrap"
              >
                Equip
              </button>
            )}

            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (isUnlocked && !isEquipped) {
                  onSelectKit(activeKit, previewRimId, previewSpoilerId, previewPaintHex);
                }
                onStartRace();
              }}
              style={{ touchAction: 'manipulation' }}
              className="px-4 sm:px-5 py-1.5 rounded-lg bg-gradient-to-r from-cyan-400 to-amber-400 text-slate-950 font-['Orbitron'] italic font-black text-xs sm:text-sm tracking-wider uppercase cursor-pointer active:scale-95 whitespace-nowrap"
            >
              Race →
            </button>
          </div>
        </div>

        {/* 4-Stat Live Performance Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 bg-slate-900/75 border border-white/10 rounded-xl px-3 py-2">
          {[
            { label: 'Speed', val: perf.stats.speed, color: 'bg-cyan-400', text: 'text-cyan-300' },
            { label: 'Accel', val: perf.stats.acceleration, color: 'bg-amber-400', text: 'text-amber-300' },
            { label: 'Handling', val: perf.stats.handling, color: 'bg-emerald-400', text: 'text-emerald-300' },
            { label: 'Drift', val: perf.stats.drift, color: 'bg-sky-400', text: 'text-sky-300' },
          ].map((stat) => (
            <div key={stat.label} className="flex items-center gap-2">
              <span className="text-[11px] font-medium text-slate-400 w-14 shrink-0">
                {stat.label}
              </span>
              <div className="flex-1 h-1.5 bg-slate-950 rounded-full overflow-hidden">
                <div
                  className={`h-full ${stat.color} rounded-full transition-all duration-200`}
                  style={{ width: `${stat.val}%` }}
                />
              </div>
              <span className={`text-xs font-mono font-bold tabular-nums w-6 text-right ${stat.text}`}>
                {stat.val}
              </span>
            </div>
          ))}
        </div>

        {/* TAB 1: SHOWROOM CAR ROSTER */}
        {activeTab === 'showroom' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {(['ALL', 'COUPE', 'MUSCLE', 'SUPERCAR', 'HYPERCAR', 'RALLY', 'SPECIAL'] as const).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={() => setCategoryFilter(cat)}
                    style={{ touchAction: 'manipulation' }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                      categoryFilter === cat
                        ? 'bg-white/15 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {cat === 'ALL' ? 'All Cars' : cat.charAt(0) + cat.slice(1).toLowerCase()}
                  </button>
                )
              )}
            </div>

            <div className="w-full overflow-x-auto pb-0.5">
              <div className="flex items-center gap-2 min-w-max">
                {filteredCars.map((kit) => {
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
                      className={`px-3 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 shrink-0 active:scale-95 ${
                        isSelected
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-slate-900/70 border-white/10 text-slate-300 hover:border-white/25'
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
                        <div className="text-[10px] font-mono tabular-nums text-slate-400 mt-1 leading-none">
                          {kitEquipped
                            ? `PR ${kitPerf.pr} · Active`
                            : kitUnlocked
                              ? `PR ${kitPerf.pr}`
                              : `${kit.unlockCost} CR`}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PERFORMANCE UPGRADES (LV 1 -> LV 5) */}
        {activeTab === 'upgrades' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            {upgradeRows.map((row) => {
              const lvl = activeUpgrades[row.key] || 1;
              const cost = getUpgradeCost(lvl);
              const isMax = cost === null;
              const canUpgrade = isUnlocked && !isMax && coins >= cost;

              return (
                <div
                  key={row.key}
                  className="p-2.5 rounded-xl bg-slate-900/80 border border-white/10 flex flex-col justify-between gap-2"
                >
                  <div className="flex items-start justify-between gap-1">
                    <div>
                      <div className="text-xs font-bold text-white leading-tight">
                        {row.label}
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{row.effect}</div>
                    </div>
                    <span className="font-mono text-[11px] font-bold text-slate-200 tabular-nums shrink-0">
                      Lv.{lvl}/5
                    </span>
                  </div>

                  {/* Level Pips */}
                  <div className="grid grid-cols-5 gap-1">
                    {[1, 2, 3, 4, 5].map((pip) => (
                      <div
                        key={pip}
                        className="h-1.5 rounded-full"
                        style={{
                          backgroundColor: pip <= lvl ? row.accent : 'rgba(255,255,255,0.1)',
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
                    className={`w-full py-1.5 px-2 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap ${
                      !isUnlocked
                        ? 'bg-slate-950/70 text-slate-500 cursor-not-allowed'
                        : isMax
                          ? 'bg-emerald-500/15 text-emerald-300 cursor-default'
                          : canUpgrade
                            ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 cursor-pointer active:scale-95'
                            : 'bg-slate-950/80 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {!isUnlocked
                      ? 'Unlock Car First'
                      : isMax
                        ? 'Maxed Out'
                        : `Upgrade · ${cost} CR`}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* TAB 3: LIVE 3D VISUAL CUSTOMIZATION (PAINT, RIMS, SPOILERS) */}
        {activeTab === 'customize' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            {/* Paint */}
            <div className="p-2.5 rounded-xl bg-slate-900/75 border border-white/10 flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-slate-300">Body Paint</span>
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => applyCustomChange(previewRimId, previewSpoilerId, null)}
                  style={{ touchAction: 'manipulation' }}
                  title="Factory Stock Paint"
                  className={`px-2.5 h-7 rounded-md text-[11px] font-semibold border cursor-pointer ${
                    previewPaintHex === null
                      ? 'bg-white/15 border-cyan-400 text-white'
                      : 'bg-slate-950 border-white/15 text-slate-400'
                  }`}
                >
                  Stock
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
                      className={`w-7 h-7 rounded-full border-2 cursor-pointer transition-transform active:scale-90 ${
                        selected ? 'border-white scale-110' : 'border-white/25'
                      }`}
                    />
                  );
                })}
              </div>
            </div>

            {/* Rims */}
            <div className="p-2.5 rounded-xl bg-slate-900/75 border border-white/10 flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-slate-300">Wheel Rims</span>
              <div className="grid grid-cols-2 gap-1.5">
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
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium truncate cursor-pointer transition-colors ${
                        selected
                          ? 'bg-cyan-500/20 border-cyan-400 text-white'
                          : 'bg-slate-950/70 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {rim.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Spoilers */}
            <div className="p-2.5 rounded-xl bg-slate-900/75 border border-white/10 flex flex-col gap-2">
              <span className="text-[11px] font-semibold text-slate-300">Aero Spoiler</span>
              <div className="grid grid-cols-3 gap-1.5">
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
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium truncate cursor-pointer transition-colors ${
                        selected
                          ? 'bg-amber-500/20 border-amber-400 text-white'
                          : 'bg-slate-950/70 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sp.name.split(' ')[0]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </footer>
    </div>
  );
};
