import circuitSunsetCoastImg from '../assets/images/circuit_sunset_coast_1795180167058.jpg';
import circuitNeonCityImg from '../assets/images/circuit_neon_city_1795180030711.jpg';
import circuitAlpineSnowImg from '../assets/images/circuit_alpine_snow_1795180030553.jpg';

export type GameState =
  | 'SPLASH'
  | 'MENU'
  | 'EVENTS'
  | 'GARAGE'
  | 'MISSIONS'
  | 'RACE'
  | 'GAMEOVER';

export type MapId = 'coast' | 'city' | 'canyon' | 'drift' | 'desert' | 'forest';

export type RaceModeId = 'circuit' | 'elimination' | 'drift' | 'time_attack';

export interface RaceModeSpec {
  id: RaceModeId;
  name: string;
  shortName: string;
  ruleSummary: string;
  description: string;
  rewardMultiplier: number;
  accentHex: string;
}

export const RACE_MODES: RaceModeSpec[] = [
  {
    id: 'circuit',
    name: 'Circuit Race',
    shortName: 'Circuit',
    ruleSummary: '3 Laps · 4-Car Grid',
    description: 'Classic high-speed pack battle across 3 laps for the podium.',
    rewardMultiplier: 1.0,
    accentHex: '#06b6d4',
  },
  {
    id: 'elimination',
    name: 'Elimination',
    shortName: 'Elimination',
    ruleSummary: 'Knockout · Last Out',
    description: 'Stay ahead of the pack before the elimination clock drops.',
    rewardMultiplier: 1.25,
    accentHex: '#f97316',
  },
  {
    id: 'drift',
    name: 'Drift Challenge',
    shortName: 'Drift',
    ruleSummary: 'Score Attack · Chain x5',
    description: 'Link wide auto-carve slides and exit boosts for maximum score.',
    rewardMultiplier: 1.2,
    accentHex: '#f59e0b',
  },
  {
    id: 'time_attack',
    name: 'Time Attack',
    shortName: 'Time Trial',
    ruleSummary: '3 Laps · Target Clock',
    description: 'Pure pace run chasing gold lap splits and personal best records.',
    rewardMultiplier: 1.15,
    accentHex: '#38bdf8',
  },
];

export interface MapSpec {
  id: MapId;
  name: string;
  shortName: string;
  subtitle: string;
  environmentTag: string;
  lengthLabel: string;
  laps: number;
  goldTargetSec: number;
  accentHex: string;
  secondaryHex: string;
  skyTopHex: string;
  skyHorizonHex: string;
  fogHex: string;
  fogDensity: number;
  previewImage: string;
  description: string;
}

export const MAP_ORDER: MapId[] = ['coast', 'city', 'canyon', 'drift', 'desert', 'forest'];

export const MAP_SPECS: MapSpec[] = [
  {
    id: 'coast',
    name: 'AMALFI RIVIERA',
    shortName: 'RIVIERA',
    subtitle: 'Mediterranean Cliff & Bay Circuit',
    environmentTag: 'Coastal Tarmac · 3D Cliffs · Harbor',
    lengthLabel: '1.49 KM',
    laps: 3,
    goldTargetSec: 58,
    accentHex: '#fb923c',
    secondaryHex: '#0ea5e9',
    skyTopHex: '#1e293b',
    skyHorizonHex: '#fb923c',
    fogHex: '#2a2438',
    fogDensity: 0.32,
    previewImage: circuitSunsetCoastImg,
    description: 'Golden-hour coastal headland circuit flanked by 3D photogrammetry sea cliffs, lush forest groves, and harbor yachts.',
  },
  {
    id: 'city',
    name: 'SHIBUYA METROPOLIS',
    shortName: 'SHIBUYA',
    subtitle: 'Midnight Cyber Expressway',
    environmentTag: 'Wet Asphalt · 3D Skyline · Night',
    lengthLabel: '1.49 KM',
    laps: 3,
    goldTargetSec: 56,
    accentHex: '#00e5ff',
    secondaryHex: '#ec4899',
    skyTopHex: '#050814',
    skyHorizonHex: '#0f172a',
    fogHex: '#080d1d',
    fogDensity: 0.36,
    previewImage: circuitNeonCityImg,
    description: 'High-speed midnight expressway with wet-puddle reflections, multi-tier glass towers, 3D street lamps, and neon portals.',
  },
  {
    id: 'canyon',
    name: 'CHAMONIX GLACIER',
    shortName: 'GLACIER',
    subtitle: '3D Snowy Mountain Pass',
    environmentTag: 'Snowy Massif · 3D Pines · Cliffs',
    lengthLabel: '1.49 KM',
    laps: 3,
    goldTargetSec: 60,
    accentHex: '#38bdf8',
    secondaryHex: '#fbbf24',
    skyTopHex: '#0f172a',
    skyHorizonHex: '#475569',
    fogHex: '#182436',
    fogDensity: 0.34,
    previewImage: circuitAlpineSnowImg,
    description: 'High-altitude alpine glacier pass surrounded by real 3D snowy mountain massifs, dense snow-covered pine forests, and rock cliffs.',
  },
  {
    id: 'drift',
    name: 'AUTODROME ARENA',
    shortName: 'AUTODROME',
    subtitle: 'Pro Drift Stadium Circuit',
    environmentTag: '3D Drift Track · Guardrails · Flags',
    lengthLabel: '1.67 KM',
    laps: 3,
    goldTargetSec: 62,
    accentHex: '#f43f5e',
    secondaryHex: '#fbbf24',
    skyTopHex: '#0f172a',
    skyHorizonHex: '#f97316',
    fogHex: '#1e1b2e',
    fogDensity: 0.28,
    previewImage: circuitSunsetCoastImg,
    description: 'Dedicated 3D drift stadium circuit featuring technical hairpin combos, W-beam steel guardrails, racing flags, and sponsor arches.',
  },
  {
    id: 'desert',
    name: 'MOJAVE RED CANYON',
    shortName: 'MOJAVE',
    subtitle: 'Sandstone Gorge & Mesa Run',
    environmentTag: '3D Canyon Cliffs · Boulders · Mesa',
    lengthLabel: '1.60 KM',
    laps: 3,
    goldTargetSec: 59,
    accentHex: '#f59e0b',
    secondaryHex: '#ef4444',
    skyTopHex: '#451a03',
    skyHorizonHex: '#f59e0b',
    fogHex: '#3b1d0e',
    fogDensity: 0.30,
    previewImage: circuitSunsetCoastImg,
    description: 'Blistering desert highway carving through towering 3D photogrammetry red-rock canyon walls, weathered boulders, and desert trees.',
  },
  {
    id: 'forest',
    name: 'HAKONE TOUGE PASS',
    shortName: 'HAKONE',
    subtitle: 'Emerald Forest Mountain Touge',
    environmentTag: '3D Forest Grove · Viaducts · Touge',
    lengthLabel: '1.65 KM',
    laps: 3,
    goldTargetSec: 61,
    accentHex: '#10b981',
    secondaryHex: '#38bdf8',
    skyTopHex: '#064e3b',
    skyHorizonHex: '#34d399',
    fogHex: '#0d2822',
    fogDensity: 0.32,
    previewImage: circuitAlpineSnowImg,
    description: 'Elevated mountain touge winding through lush 3D forest groves, normal-mapped canopy trees, rocky cliff escarpments, and viaduct bridges.',
  },
];

export function normalizeMapId(id: string | undefined | null): MapId {
  if (!id) return 'coast';
  const cleaned = String(id).trim().toLowerCase();
  if (
    cleaned === 'coast' ||
    cleaned === 'city' ||
    cleaned === 'canyon' ||
    cleaned === 'drift' ||
    cleaned === 'desert' ||
    cleaned === 'forest'
  ) {
    return cleaned;
  }
  if (cleaned.includes('drift') || cleaned.includes('autodrome')) return 'drift';
  if (cleaned.includes('desert') || cleaned.includes('mojave')) return 'desert';
  if (cleaned.includes('forest') || cleaned.includes('hakone') || cleaned.includes('touge')) return 'forest';
  if (cleaned.includes('neon') || cleaned.includes('city') || cleaned.includes('shibuya')) return 'city';
  if (cleaned.includes('snow') || cleaned.includes('canyon') || cleaned.includes('alpine') || cleaned.includes('glacier')) return 'canyon';
  if (cleaned.includes('asphalt') || cleaned.includes('coast') || cleaned.includes('riviera')) return 'coast';
  return 'coast';
}

export function getNextRotatedMapId(currentId: MapId): MapId {
  const idx = MAP_ORDER.indexOf(currentId);
  if (idx === -1) return 'coast';
  return MAP_ORDER[(idx + 1) % MAP_ORDER.length];
}

export type BodyKitId =
  | 'v12_goblin'
  | 'apex_g82'
  | 'solstice_ie'
  | 'valkyr_aero'
  | 'razor_f82'
  | 'ferrari'
  | 'silver_arrow'
  | 'lemans_proto'
  | 'scion_gt'
  | 's64'
  | 'coupe'
  | 'kamaro'
  | 'ghini'
  | 'fenyr'
  | 'police'
  | 'lamb'
  | 'italia'
  | 'rally'
  | 'jeep'
  | 'armor'
  | 'mobil'
  | 'van'
  | 'kit1'
  | 'kit2'
  | 'kit3';

export type RimId = 'rim0' | 'rim1' | 'rim2' | 'rim3';
export type SpoilerId = 'spoiler0' | 'spoiler1' | 'spoiler2';

export interface RimSpec {
  id: RimId;
  name: string;
  accentHex: string;
}

export interface SpoilerSpec {
  id: SpoilerId;
  name: string;
  tag: string;
}

export interface PaintSpec {
  id: string;
  name: string;
  hex: string;
}

export const RIM_OPTIONS: RimSpec[] = [
  { id: 'rim0', name: 'Stock 6-Spoke', accentHex: '#cbd5e1' },
  { id: 'rim1', name: 'Neon 5-Blade', accentHex: '#00f0ff' },
  { id: 'rim2', name: '24K Gold Mesh', accentHex: '#fbbf24' },
  { id: 'rim3', name: 'Titanium Turbine', accentHex: '#f8fafc' },
];

export const SPOILER_OPTIONS: SpoilerSpec[] = [
  { id: 'spoiler0', name: 'Stock Deck', tag: 'NONE' },
  { id: 'spoiler1', name: 'Carbon Lip Wing', tag: 'CARBON LIP' },
  { id: 'spoiler2', name: 'GT Pro Dual Wing', tag: 'GT PRO' },
];

export const PAINT_OPTIONS: PaintSpec[] = [
  { id: 'paint_crimson', name: 'Crimson Red', hex: '#ff1e26' },
  { id: 'paint_cyan', name: 'Electric Cyan', hex: '#00e5ff' },
  { id: 'paint_gold', name: '24K Cyber Gold', hex: '#ffc72c' },
  { id: 'paint_emerald', name: 'Venom Emerald', hex: '#10b981' },
  { id: 'paint_violet', name: 'Royal Ultraviolet', hex: '#8b5cf6' },
  { id: 'paint_obsidian', name: 'Stealth Gunmetal', hex: '#334155' },
];

export interface BodyKitSpec {
  id: BodyKitId;
  name: string;
  subtitle: string;
  fullLabel: string;
  tag: string;
  category: 'COUPE' | 'MUSCLE' | 'SUPERCAR' | 'HYPERCAR' | 'SPECIAL' | 'RALLY' | 'OFFROAD';
  description: string;
  modelFile: string;
  primaryColor: string;
  accentColor: string;
  badgeColor: string;
  defaultRimId: RimId;
  defaultSpoilerId: SpoilerId;
  stats: {
    speed: number;
    acceleration: number;
    handling: number;
    drift: number;
  };
  physics: {
    topSpeedMultiplier: number;
    accelMultiplier: number;
    handlingMultiplier: number;
  };
  unlockCost: number;
}

export const BODY_KITS: BodyKitSpec[] = [
  {
    id: 'v12_goblin',
    name: 'V12 GOBLIN',
    subtitle: 'Bespoke V12 Hypercar',
    fullLabel: 'V12 GOBLIN',
    tag: 'AAA HYPERCAR',
    category: 'HYPERCAR',
    description: 'Bespoke sculpted V12 hypercar with dual-clearcoat emerald finish, razor aero intakes, and full spinning alloy wheels.',
    modelFile: '/models/supercars/v12_goblin.glb',
    primaryColor: '#047857',
    accentColor: '#0f172a',
    badgeColor: '#10b981',
    defaultRimId: 'rim2',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 98,
      acceleration: 97,
      handling: 95,
      drift: 94,
    },
    physics: {
      topSpeedMultiplier: 1.13,
      accelMultiplier: 1.14,
      handlingMultiplier: 1.11,
    },
    unlockCost: 0,
  },
  {
    id: 'apex_g82',
    name: 'APEX G82 ADRO',
    subtitle: 'Carbon Widebody GT',
    fullLabel: 'APEX G82 ADRO',
    tag: 'WIDEBODY GT',
    category: 'SUPERCAR',
    description: 'Aggressive widebody twin-turbo coupe fitted with exposed carbon-fiber Adro aero kit, rear diffuser, and glowing crimson tailbar.',
    modelFile: '/models/supercars/apex_g82.glb',
    primaryColor: '#0ea5e9',
    accentColor: '#111827',
    badgeColor: '#38bdf8',
    defaultRimId: 'rim1',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 95,
      acceleration: 96,
      handling: 94,
      drift: 97,
    },
    physics: {
      topSpeedMultiplier: 1.09,
      accelMultiplier: 1.12,
      handlingMultiplier: 1.1,
    },
    unlockCost: 0,
  },
  {
    id: 'solstice_ie',
    name: 'SOLSTICE V12',
    subtitle: 'Track Carbon Hypercar',
    fullLabel: 'SOLSTICE V12',
    tag: 'AAA HYPERCAR',
    category: 'HYPERCAR',
    description: 'Extreme track-bred V12 hypercar with triple-vent carbon bodywork, towering GT rear wing, and razor-sharp red LED tail blades.',
    modelFile: '/models/supercars/solstice_ie.glb',
    primaryColor: '#ef4444',
    accentColor: '#090d16',
    badgeColor: '#f43f5e',
    defaultRimId: 'rim3',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 99,
      acceleration: 98,
      handling: 96,
      drift: 92,
    },
    physics: {
      topSpeedMultiplier: 1.15,
      accelMultiplier: 1.16,
      handlingMultiplier: 1.13,
    },
    unlockCost: 0,
  },
  {
    id: 'valkyr_aero',
    name: 'VALKYR AERO',
    subtitle: 'F1-Aero Hypercar',
    fullLabel: 'VALKYR AERO',
    tag: 'F1 HYPERCAR',
    category: 'HYPERCAR',
    description: 'Formula-inspired ground-effect hypercar with open-tunnel carbon floor, teardrop cockpit, and relentless cornering downforce.',
    modelFile: '/models/supercars/valkyr_aero.glb',
    primaryColor: '#046342',
    accentColor: '#0f172a',
    badgeColor: '#34d399',
    defaultRimId: 'rim3',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 100,
      acceleration: 98,
      handling: 99,
      drift: 91,
    },
    physics: {
      topSpeedMultiplier: 1.16,
      accelMultiplier: 1.17,
      handlingMultiplier: 1.16,
    },
    unlockCost: 0,
  },
  {
    id: 'razor_f82',
    name: 'RAZOR F82',
    subtitle: 'Street Racing GT',
    fullLabel: 'RAZOR F82',
    tag: 'STREET GT',
    category: 'SUPERCAR',
    description: 'Street-tuned widebody coupe featuring custom race livery, dual-clearcoat gloss, glowing LED lamps, and drift-ready balance.',
    modelFile: '/models/supercars/razor_f82.glb',
    primaryColor: '#f97316',
    accentColor: '#18181b',
    badgeColor: '#fb923c',
    defaultRimId: 'rim1',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 93,
      acceleration: 94,
      handling: 93,
      drift: 96,
    },
    physics: {
      topSpeedMultiplier: 1.08,
      accelMultiplier: 1.1,
      handlingMultiplier: 1.09,
    },
    unlockCost: 0,
  },
  {
    id: 'ferrari',
    name: 'F458 GT',
    subtitle: 'V8 Italian Supercar',
    fullLabel: 'F458 GT',
    tag: 'AAA SHOWCASE',
    category: 'SUPERCAR',
    description: 'High-poly V8 exotic coupe with sculpted cockpit interior, carbon aero, glowing brake discs, and dual-clearcoat metallic paint.',
    modelFile: '/models/supercars/ferrari.glb',
    primaryColor: '#d90429',
    accentColor: '#111827',
    badgeColor: '#ef4444',
    defaultRimId: 'rim2',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 96,
      acceleration: 95,
      handling: 94,
      drift: 95,
    },
    physics: {
      topSpeedMultiplier: 1.07,
      accelMultiplier: 1.09,
      handlingMultiplier: 1.08,
    },
    unlockCost: 0,
  },
  {
    id: 'silver_arrow',
    name: 'SILVER ARROW P1',
    subtitle: 'F1-Hybrid Hypercar',
    fullLabel: 'SILVER ARROW P1',
    tag: 'F1 HYPERCAR',
    category: 'HYPERCAR',
    description: 'Formula-derived hybrid hypercar with roof shark-fin aero, active carbon bodywork, razor LED lamps, and extreme cornering grip.',
    modelFile: '/models/supercars/silver_arrow.glb',
    primaryColor: '#b8c4d0',
    accentColor: '#14b8a6',
    badgeColor: '#2dd4bf',
    defaultRimId: 'rim3',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 100,
      acceleration: 99,
      handling: 98,
      drift: 93,
    },
    physics: {
      topSpeedMultiplier: 1.17,
      accelMultiplier: 1.18,
      handlingMultiplier: 1.15,
    },
    unlockCost: 0,
  },
  {
    id: 'lemans_proto',
    name: 'LE MANS LMP-X',
    subtitle: 'Endurance Prototype',
    fullLabel: 'LE MANS LMP-X',
    tag: 'PROTOTYPE',
    category: 'HYPERCAR',
    description: 'Pure 24-hour endurance prototype sculpted for maximum downforce, ultra-low center of gravity, and relentless top-end velocity.',
    modelFile: '/models/supercars/lemans_proto.glb',
    primaryColor: '#1d4ed8',
    accentColor: '#f8fafc',
    badgeColor: '#3b82f6',
    defaultRimId: 'rim3',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 100,
      acceleration: 97,
      handling: 100,
      drift: 90,
    },
    physics: {
      topSpeedMultiplier: 1.18,
      accelMultiplier: 1.16,
      handlingMultiplier: 1.18,
    },
    unlockCost: 0,
  },
  {
    id: 'scion_gt',
    name: 'APEX GT-86',
    subtitle: 'Widebody Street Tuner',
    fullLabel: 'APEX GT-86',
    tag: 'DRIFT TUNER',
    category: 'SUPERCAR',
    description: 'Aggressive widebody rear-drive street coupe tuned for razor-sharp drift angles, agile weight transfer, and deep metallic gloss.',
    modelFile: '/models/supercars/scion_gt.glb',
    primaryColor: '#991b1b',
    accentColor: '#18181b',
    badgeColor: '#ef4444',
    defaultRimId: 'rim1',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 92,
      acceleration: 94,
      handling: 96,
      drift: 99,
    },
    physics: {
      topSpeedMultiplier: 1.07,
      accelMultiplier: 1.1,
      handlingMultiplier: 1.12,
    },
    unlockCost: 0,
  },
];

// Helper to normalize any legacy low-poly car IDs ('coupe', 's64', 'kit1', etc.) to the AAA supercar roster
export function normalizeCarId(id: string | undefined | null): BodyKitId {
  if (!id) return 'v12_goblin';
  const cleaned = String(id).trim().toLowerCase();
  const found = BODY_KITS.find((k) => k.id === cleaned);
  if (found) return found.id;
  if (cleaned === 'kamaro' || cleaned === 'kit2' || cleaned === 'rally') return 'razor_f82';
  if (cleaned === 'ghini' || cleaned === 'kit3' || cleaned === 'italia') return 'ferrari';
  if (cleaned === 'fenyr' || cleaned === 'lamb') return 'solstice_ie';
  if (cleaned === 'police' || cleaned === 'mobil') return 'apex_g82';
  return 'v12_goblin';
}

export interface RivalRacerData {
  id: string;
  name: string;
  color: string;
  rank: number;
  isLeader?: boolean;
  eliminated?: boolean;
  speedKmh: number;
  position: [number, number, number];
  screenX?: number;
  screenY?: number;
  onScreen?: boolean;
  distMeters?: number;
  mapX?: number;
  mapY?: number;
}

export interface DailyStreakState {
  streakDay: number; // 1..7
  claimedToday: boolean;
  todayReward: number;
  lastClaimDate: string | null;
}

export const DAILY_STREAK_REWARDS: readonly number[] = [
  5000, 8000, 12000, 18000, 25000, 40000, 100000,
];

export type WeatherMode = 'clear' | 'dust' | 'mist' | 'drizzle';

export interface WeatherSpec {
  id: WeatherMode;
  label: string;
  shortLabel: string;
  description: string;
  accentHex: string;
}

export const WEATHER_SPECS: WeatherSpec[] = [
  {
    id: 'clear',
    label: 'Clear Skies',
    shortLabel: 'Clear',
    description: 'Crisp natural lighting with clear horizon visibility',
    accentHex: '#38bdf8',
  },
  {
    id: 'dust',
    label: 'Golden Dust',
    shortLabel: 'Dust',
    description: 'Warm amber sunlight with subtle floating dust motes',
    accentHex: '#fbbf24',
  },
  {
    id: 'mist',
    label: 'Light Mist',
    shortLabel: 'Mist',
    description: 'Soft diffused light with low-lying drifting track mist',
    accentHex: '#cbd5e1',
  },
  {
    id: 'drizzle',
    label: 'Twilight Drizzle',
    shortLabel: 'Drizzle',
    description: 'Moody cool atmosphere with fine diagonal mist streaks',
    accentHex: '#60a5fa',
  },
];

export function normalizeWeatherMode(id?: string | null): WeatherMode {
  if (id === 'clear' || id === 'dust' || id === 'mist' || id === 'drizzle') {
    return id;
  }
  return 'dust';
}

export function getNextWeatherMode(current: WeatherMode): WeatherMode {
  const idx = WEATHER_SPECS.findIndex((w) => w.id === current);
  return WEATHER_SPECS[(idx + 1) % WEATHER_SPECS.length].id;
}

/**
 * Automatically selects a natural, dynamic track atmosphere for each circuit
 * so environments evolve seamlessly without manual UI toggles.
 */
export function pickAutoWeatherForMap(mapId: MapId, seed = 0): WeatherMode {
  const mapPools: Record<MapId, WeatherMode[]> = {
    coast: ['dust', 'clear', 'drizzle'],
    city: ['drizzle', 'clear'],
    canyon: ['mist', 'clear', 'drizzle'],
    drift: ['clear', 'dust', 'drizzle'],
    desert: ['dust', 'clear'],
    forest: ['mist', 'clear', 'drizzle'],
  };
  const pool = mapPools[mapId] || mapPools.coast;
  const idx = Math.abs(Math.floor(seed)) % pool.length;
  return pool[idx];
}

export function formatCompactCoins(amount: number): string {
  const safe = Math.max(0, Math.round(amount || 0));
  if (safe >= 100000) {
    const lakhs = safe / 100000;
    return `${Number.isInteger(lakhs) ? lakhs : lakhs.toFixed(1)}L`;
  }
  if (safe >= 1000) {
    const k = safe / 1000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)}K`;
  }
  return String(safe);
}

export interface RaceTelemetry {
  speedKmh: number;
  lapCount: number;
  currentLapTime: number;
  totalRaceTime: number;
  bestLapTime: number | null;
  boostCharge: number;
  boostActive: number;
  shockwaveActive?: boolean;
  slipstreamActive?: boolean;
  autoGas?: boolean;
  weather?: WeatherMode;
  actionBanner?: string | null;
  actionBannerColor?: string;
  isDrifting: boolean;
  driftCharge?: number;
  driftBoostTier?: number;
  modeId?: RaceModeId;
  eliminationTimer?: number;
  remainingRacers?: number;
  driftScore?: number;
  currentDriftPoints?: number;
  driftCombo?: number;
  driftTargetGold?: number;
  countdownStep: number;
  cameraMode: number;
  autopilot: boolean;
  audioEnabled: boolean;
  positionRank: number; // 1st, 2nd, 3rd, 4th
  rivals: RivalRacerData[];
  minimapPath?: [number, number][];
  playerMapPos?: [number, number];
  ghostMapPos?: [number, number] | null;
  ghostEnabled?: boolean;
  hasGhostPb?: boolean;
  ghostDeltaSec?: number | null;
  stuntCamActive?: boolean;
}

export type UpgradePartKey = 'engine' | 'turbo' | 'tires' | 'nitro';

export interface CarUpgradeLevels {
  engine: number; // 1..5
  turbo: number; // 1..5
  tires: number; // 1..5
  nitro: number; // 1..5
}

export const DEFAULT_CAR_UPGRADES: CarUpgradeLevels = {
  engine: 1,
  turbo: 1,
  tires: 1,
  nitro: 1,
};

export const UPGRADE_PART_COSTS: Record<number, number> = {
  1: 4500,
  2: 9500,
  3: 18000,
  4: 32000,
};

export function getUpgradeCost(currentLevel: number): number | null {
  if (currentLevel >= 5) return null;
  return UPGRADE_PART_COSTS[currentLevel] ?? 32000;
}

export function getEffectiveCarPerformance(
  kit: BodyKitSpec,
  upgrades?: Partial<CarUpgradeLevels>
) {
  const eng = Math.min(5, Math.max(1, upgrades?.engine ?? 1));
  const trb = Math.min(5, Math.max(1, upgrades?.turbo ?? 1));
  const tir = Math.min(5, Math.max(1, upgrades?.tires ?? 1));
  const nit = Math.min(5, Math.max(1, upgrades?.nitro ?? 1));

  const speed = Math.min(100, kit.stats.speed + (eng - 1) * 3 + Math.floor((nit - 1) * 0.75));
  const acceleration = Math.min(100, kit.stats.acceleration + (trb - 1) * 3 + Math.floor((nit - 1) * 0.75));
  const handling = Math.min(100, kit.stats.handling + (tir - 1) * 3);
  const drift = Math.min(100, kit.stats.drift + (tir - 1) * 2 + (nit - 1) * 1);

  const pr = Math.round(speed * 1.45 + acceleration * 1.35 + handling * 1.25 + drift * 1.15);
  const carClass: 'D' | 'C' | 'B' | 'A' | 'S' =
    pr >= 490 ? 'S' : pr >= 460 ? 'A' : pr >= 435 ? 'B' : pr >= 415 ? 'C' : 'D';

  const physics = {
    topSpeedMultiplier: Number((kit.physics.topSpeedMultiplier + (eng - 1) * 0.022 + (nit - 1) * 0.008).toFixed(3)),
    accelMultiplier: Number((kit.physics.accelMultiplier + (trb - 1) * 0.028 + (nit - 1) * 0.010).toFixed(3)),
    handlingMultiplier: Number((kit.physics.handlingMultiplier + (tir - 1) * 0.025).toFixed(3)),
  };

  return {
    levels: { engine: eng, turbo: trb, tires: tir, nitro: nit },
    stats: { speed, acceleration, handling, drift },
    pr,
    carClass,
    physics,
  };
}

export interface TrackRecord {
  bestLap: number | null;
  bestTotalTime: number | null;
  bestStars: number; // 0..3
  racesCompleted: number;
  wins: number;
}

export interface PlayerCareerState {
  xp: number;
  totalRaces: number;
  totalWins: number;
  totalUpgrades: number;
  mapsRaced: MapId[];
  bestSingleRaceTime: number | null;
  claimedMissionIds: string[];
  trackRecords: Record<MapId, TrackRecord>;
}

export const DEFAULT_CAREER_STATE: PlayerCareerState = {
  xp: 0,
  totalRaces: 0,
  totalWins: 0,
  totalUpgrades: 0,
  mapsRaced: [],
  bestSingleRaceTime: null,
  claimedMissionIds: [],
  trackRecords: {
    coast: { bestLap: null, bestTotalTime: null, bestStars: 0, racesCompleted: 0, wins: 0 },
    city: { bestLap: null, bestTotalTime: null, bestStars: 0, racesCompleted: 0, wins: 0 },
    canyon: { bestLap: null, bestTotalTime: null, bestStars: 0, racesCompleted: 0, wins: 0 },
    drift: { bestLap: null, bestTotalTime: null, bestStars: 0, racesCompleted: 0, wins: 0 },
    desert: { bestLap: null, bestTotalTime: null, bestStars: 0, racesCompleted: 0, wins: 0 },
    forest: { bestLap: null, bestTotalTime: null, bestStars: 0, racesCompleted: 0, wins: 0 },
  },
};

export interface DriverLevelInfo {
  level: number;
  title: string;
  currentXp: number;
  nextLevelXp: number;
  progressPct: number;
}

export function getDriverLevelInfo(xp: number): DriverLevelInfo {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  const xpPerLevel = 250;
  const level = Math.min(25, Math.floor(safeXp / xpPerLevel) + 1);
  const currentXp = safeXp % xpPerLevel;
  const titles = [
    'Rookie Driver',
    'Street Challenger',
    'Circuit Contender',
    'Drift Specialist',
    'Apex Runner',
    'Pro Motorsport',
    'Track Legend',
  ];
  const title = titles[Math.min(titles.length - 1, Math.floor((level - 1) / 2))];
  return {
    level,
    title,
    currentXp,
    nextLevelXp: xpPerLevel,
    progressPct: Math.min(100, Math.round((currentXp / xpPerLevel) * 100)),
  };
}

export interface MissionSpec {
  id: string;
  title: string;
  description: string;
  category: 'Daily' | 'Career';
  actionTarget?: 'events' | 'garage';
  rewardCoins: number;
  rewardXp: number;
  target: number;
  getProgress: (career: PlayerCareerState, unlockedCount: number) => number;
}

export const MISSIONS_LIST: MissionSpec[] = [
  {
    id: 'm_first_race',
    title: 'Ignition Start',
    description: 'Complete your first official race on any circuit.',
    category: 'Daily',
    actionTarget: 'events',
    rewardCoins: 8000,
    rewardXp: 100,
    target: 1,
    getProgress: (c) => c.totalRaces,
  },
  {
    id: 'm_first_win',
    title: 'Checkered Flag',
    description: 'Finish 1st place in any race event.',
    category: 'Daily',
    actionTarget: 'events',
    rewardCoins: 14000,
    rewardXp: 140,
    target: 1,
    getProgress: (c) => c.totalWins,
  },
  {
    id: 'm_tune_parts',
    title: 'Garage Tuner',
    description: 'Install 2 performance upgrades in the Garage.',
    category: 'Daily',
    actionTarget: 'garage',
    rewardCoins: 12000,
    rewardXp: 120,
    target: 2,
    getProgress: (c) => c.totalUpgrades,
  },
  {
    id: 'm_neon_city',
    title: 'Midnight Runner',
    description: 'Complete a race at Shibuya Metropolis circuit.',
    category: 'Daily',
    actionTarget: 'events',
    rewardCoins: 10000,
    rewardXp: 120,
    target: 1,
    getProgress: (c) => (c.mapsRaced.includes('city') ? 1 : 0),
  },
  {
    id: 'm_alpine_snow',
    title: 'Glacier Conqueror',
    description: 'Complete a race at Chamonix Glacier pass.',
    category: 'Career',
    actionTarget: 'events',
    rewardCoins: 12000,
    rewardXp: 120,
    target: 1,
    getProgress: (c) => (c.mapsRaced.includes('canyon') ? 1 : 0),
  },
  {
    id: 'm_drift_arena',
    title: 'Autodrome Drift King',
    description: 'Complete a race at Autodrome Arena circuit.',
    category: 'Career',
    actionTarget: 'events',
    rewardCoins: 15000,
    rewardXp: 150,
    target: 1,
    getProgress: (c) => (c.mapsRaced.includes('drift') ? 1 : 0),
  },
  {
    id: 'm_world_tour',
    title: 'World Championship Tour',
    description: 'Race across all 6 global circuits.',
    category: 'Career',
    actionTarget: 'events',
    rewardCoins: 45000,
    rewardXp: 350,
    target: 6,
    getProgress: (c) => c.mapsRaced.length,
  },
  {
    id: 'm_car_collector',
    title: 'Showroom Collector',
    description: 'Own 4 cars in your personal garage.',
    category: 'Career',
    actionTarget: 'garage',
    rewardCoins: 22000,
    rewardXp: 200,
    target: 4,
    getProgress: (_c, unlockedCount) => unlockedCount,
  },
  {
    id: 'm_pro_veteran',
    title: 'Season Veteran',
    description: 'Complete 5 total race events.',
    category: 'Career',
    actionTarget: 'events',
    rewardCoins: 35000,
    rewardXp: 280,
    target: 5,
    getProgress: (c) => c.totalRaces,
  },
];

export interface RaceFinishResult {
  totalTime: number;
  bestLap: number;
  lapTimes: number[];
  coinsEarned: number;
  xpEarned?: number;
  starsEarned?: number;
  finishRank: number; // 1, 2, 3, or 4
  mapId?: MapId;
  modeId?: RaceModeId;
  driftScore?: number;
  eliminated?: boolean;
}

export interface TheRaceEngineBridge {
  setScreen: (screen: GameState) => void;
  getScreen: () => GameState;
  startRace: (modeId?: RaceModeId) => void;
  setRaceMode?: (modeId: RaceModeId) => void;
  getRaceMode?: () => RaceModeId;
  setMap?: (mapId: MapId) => void;
  getMap?: () => MapId;
  setWeather?: (mode: WeatherMode) => WeatherMode;
  getWeather?: () => WeatherMode;
  cycleWeather?: () => WeatherMode;
  setBodyKit: (
    kitId: BodyKitId,
    stats?: {
      topSpeedMultiplier: number;
      accelMultiplier: number;
      handlingMultiplier: number;
    },
    customOverrides?: {
      rimId?: RimId;
      spoilerId?: SpoilerId;
      paintHex?: string | null;
    }
  ) => void;
  setCustomParts: (parts: {
    bodyId?: BodyKitId;
    rimId?: RimId;
    spoilerId?: SpoilerId;
    paintHex?: string | null;
  }) => void;
  rotateShowroom?: (deltaRad: number) => void;
  setTouchControl: (
    dir: 'left' | 'right' | 'forward' | 'backward' | 'drift',
    isDown: boolean
  ) => void;
  clearTouchControls: () => void;
  triggerNitro: () => boolean;
  setAutoGas?: (val: boolean) => void;
  getAutoGas?: () => boolean;
  setGhostEnabled?: (val: boolean) => void;
  getGhostEnabled?: () => boolean;
  setCameraMode: (mode: number) => void;
  getCameraMode: () => number;
  setAutopilot: (val: boolean) => void;
  toggleAudio: () => boolean;
  setAudioEnabled: (val: boolean) => boolean;
  isAudioEnabled: () => boolean;
  playSplashImpact: () => void;
  playUiClick: (variant?: 'click' | 'equip') => void;
  playCarRevPreview?: (kitId: BodyKitId) => void;
  playVictoryVoice?: () => void;
  playGameOverVoice?: () => void;
  playEvilLaugh?: () => void;
  playUnlockOrStuntVoice?: () => void;
  setGraphicsSettings: (settings: {
    bloomStrength?: number;
    dofStrength?: number;
    lampIntensity?: number;
    visualQuality?: 'performance' | 'ultra';
  }) => void;
  getGraphicsSettings: () => {
    bloomStrength: number;
    dofStrength: number;
    lampIntensity: number;
    visualQuality?: 'performance' | 'ultra';
  };
  completeRaceDemo: () => void;
  onTelemetry: (cb: (data: RaceTelemetry) => void) => () => void;
  onRaceFinish: (
    cb: (res: {
      totalTime: number;
      bestLap: number;
      lapTimes: number[];
      finishRank: number;
      driftScore?: number;
      eliminated?: boolean;
      modeId?: RaceModeId;
    }) => void
  ) => () => void;
}

declare global {
  interface Window {
    __theRaceEngine?: TheRaceEngineBridge;
  }
}

export function formatRaceTime(seconds: number | null | undefined): string {
  const safeSecs = Math.max(0, Number(seconds) || 0);
  const totalCentis = Math.floor(safeSecs * 100);
  const mins = Math.floor(totalCentis / 6000);
  const secs = Math.floor((totalCentis % 6000) / 100);
  const centis = totalCentis % 100;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(
    centis
  ).padStart(2, '0')}`;
}
