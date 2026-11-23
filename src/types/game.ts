export type GameState =
  | 'SPLASH'
  | 'MENU'
  | 'EVENTS'
  | 'GARAGE'
  | 'MISSIONS'
  | 'RACE'
  | 'GAMEOVER';

export type MapId = 'coast' | 'city' | 'canyon';

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

export const MAP_ORDER: MapId[] = ['coast', 'city', 'canyon'];

export const MAP_SPECS: MapSpec[] = [
  {
    id: 'coast',
    name: 'SUNSET COAST',
    shortName: 'COAST',
    subtitle: 'Coastal Asphalt Circuit',
    environmentTag: 'Asphalt · Banked · Palms',
    lengthLabel: '1.49 KM',
    laps: 3,
    goldTargetSec: 58,
    accentHex: '#fb923c',
    secondaryHex: '#0ea5e9',
    skyTopHex: '#1e293b',
    skyHorizonHex: '#fb923c',
    fogHex: '#2a2438',
    fogDensity: 0.32,
    previewImage: '/src/assets/images/circuit_sunset_coast_1795180167058.jpg',
    description: 'Golden-hour wide coastal asphalt circuit with banked turns, elevation climbs, and sunlit ocean curbs.',
  },
  {
    id: 'city',
    name: 'NEON CITY',
    shortName: 'CITY',
    subtitle: 'Midnight Street Circuit',
    environmentTag: 'Wet Asphalt · Skyline · Night',
    lengthLabel: '1.49 KM',
    laps: 3,
    goldTargetSec: 56,
    accentHex: '#00e5ff',
    secondaryHex: '#ec4899',
    skyTopHex: '#050814',
    skyHorizonHex: '#0f172a',
    fogHex: '#080d1d',
    fogDensity: 0.36,
    previewImage: '/src/assets/images/circuit_neon_city_1795180030711.jpg',
    description: 'High-speed midnight circuit with glossy wet-asphalt reflections, glowing skyscrapers, and neon barriers.',
  },
  {
    id: 'canyon',
    name: 'ALPINE SNOW',
    shortName: 'SNOW',
    subtitle: 'Alpine Mountain Pass',
    environmentTag: 'Alpine Tarmac · Cliffs · Pines',
    lengthLabel: '1.49 KM',
    laps: 3,
    goldTargetSec: 60,
    accentHex: '#38bdf8',
    secondaryHex: '#fbbf24',
    skyTopHex: '#0f172a',
    skyHorizonHex: '#475569',
    fogHex: '#182436',
    fogDensity: 0.34,
    previewImage: '/src/assets/images/circuit_alpine_snow_1795180030553.jpg',
    description: 'Frost-lined mountain pass featuring sweeping banked corners, rocky cliffs, and twilight floodlights.',
  },
];

export function normalizeMapId(id: string | undefined | null): MapId {
  if (!id) return 'coast';
  const cleaned = String(id).trim().toLowerCase();
  if (cleaned === 'coast' || cleaned === 'city' || cleaned === 'canyon') return cleaned;
  if (cleaned.includes('neon') || cleaned.includes('city')) return 'city';
  if (cleaned.includes('snow') || cleaned.includes('canyon') || cleaned.includes('alpine')) return 'canyon';
  if (cleaned.includes('asphalt') || cleaned.includes('coast')) return 'coast';
  return 'coast';
}

export function getNextRotatedMapId(currentId: MapId): MapId {
  const idx = MAP_ORDER.indexOf(currentId);
  if (idx === -1) return 'coast';
  return MAP_ORDER[(idx + 1) % MAP_ORDER.length];
}

export type BodyKitId =
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
    id: 'coupe',
    name: 'SWIFT',
    subtitle: 'Street Coupe',
    fullLabel: 'SWIFT',
    tag: 'STARTER',
    category: 'COUPE',
    description: 'Balanced twin-turbo street coupe with crisp handling and smooth cornering grip.',
    modelFile: '/models/cosmo/coupe.glb',
    primaryColor: '#475569',
    accentColor: '#161922',
    badgeColor: '#38bdf8',
    defaultRimId: 'rim0',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 82,
      acceleration: 84,
      handling: 89,
      drift: 86,
    },
    physics: {
      topSpeedMultiplier: 1.0,
      accelMultiplier: 1.0,
      handlingMultiplier: 1.0,
    },
    unlockCost: 0,
  },
  {
    id: 's64',
    name: 'SPORT',
    subtitle: 'Red GT Coupe',
    fullLabel: 'SPORT',
    tag: 'CLASSIC GT',
    category: 'COUPE',
    description: 'Custom red GT coupe with twin exhausts and balanced arcade drift control.',
    modelFile: '/models/cosmo/coupe.glb',
    primaryColor: '#ff1e26',
    accentColor: '#161922',
    badgeColor: '#ff3b30',
    defaultRimId: 'rim0',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 84,
      acceleration: 85,
      handling: 88,
      drift: 87,
    },
    physics: {
      topSpeedMultiplier: 1.02,
      accelMultiplier: 1.02,
      handlingMultiplier: 1.02,
    },
    unlockCost: 0,
  },
  {
    id: 'kamaro',
    name: 'BLAZE',
    subtitle: 'Muscle V8',
    fullLabel: 'BLAZE',
    tag: 'MUSCLE',
    category: 'MUSCLE',
    description: 'Supercharged V8 muscle car with strong launch acceleration and wide drifts.',
    modelFile: '/models/cosmo/kamaro.glb',
    primaryColor: '#ff8800',
    accentColor: '#0b1528',
    badgeColor: '#ff9900',
    defaultRimId: 'rim1',
    defaultSpoilerId: 'spoiler1',
    stats: {
      speed: 89,
      acceleration: 88,
      handling: 80,
      drift: 93,
    },
    physics: {
      topSpeedMultiplier: 1.06,
      accelMultiplier: 1.08,
      handlingMultiplier: 0.96,
    },
    unlockCost: 50,
  },
  {
    id: 'ghini',
    name: 'BOLT',
    subtitle: 'V12 Supercar',
    fullLabel: 'BOLT',
    tag: 'SUPERCAR',
    category: 'SUPERCAR',
    description: 'Sleek mid-engine supercar with fast straightaway speed and sharp cornering.',
    modelFile: '/models/cosmo/ghini.glb',
    primaryColor: '#eab308',
    accentColor: '#1a1a24',
    badgeColor: '#eab308',
    defaultRimId: 'rim2',
    defaultSpoilerId: 'spoiler2',
    stats: {
      speed: 95,
      acceleration: 93,
      handling: 91,
      drift: 88,
    },
    physics: {
      topSpeedMultiplier: 1.11,
      accelMultiplier: 1.14,
      handlingMultiplier: 1.08,
    },
    unlockCost: 100,
  },
  {
    id: 'fenyr',
    name: 'APEX',
    subtitle: 'Pro Hypercar',
    fullLabel: 'APEX',
    tag: 'HYPERCAR',
    category: 'HYPERCAR',
    description: 'Top-tier hypercar built for maximum top speed and razor-sharp track grip.',
    modelFile: '/models/cosmo/fenyr.glb',
    primaryColor: '#06b6d4',
    accentColor: '#0f172a',
    badgeColor: '#06b6d4',
    defaultRimId: 'rim3',
    defaultSpoilerId: 'spoiler2',
    stats: {
      speed: 99,
      acceleration: 97,
      handling: 94,
      drift: 90,
    },
    physics: {
      topSpeedMultiplier: 1.16,
      accelMultiplier: 1.18,
      handlingMultiplier: 1.12,
    },
    unlockCost: 200,
  },
  {
    id: 'police',
    name: 'PATROL',
    subtitle: 'Police Cruiser',
    fullLabel: 'PATROL',
    tag: 'INTERCEPTOR',
    category: 'SPECIAL',
    description: 'High-speed highway patrol cruiser with heavy stability and strong top speed.',
    modelFile: '/models/cosmo/police.glb',
    primaryColor: '#2563eb',
    accentColor: '#ffffff',
    badgeColor: '#3b82f6',
    defaultRimId: 'rim0',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 92,
      acceleration: 90,
      handling: 87,
      drift: 86,
    },
    physics: {
      topSpeedMultiplier: 1.08,
      accelMultiplier: 1.10,
      handlingMultiplier: 1.04,
    },
    unlockCost: 80,
  },
  {
    id: 'lamb',
    name: 'FLASH',
    subtitle: 'Cyber GT',
    fullLabel: 'FLASH',
    tag: 'SPORT GT',
    category: 'SUPERCAR',
    description: 'Sharp wedge supercar tuned for fast straightaways and responsive corners.',
    modelFile: '/models/cosmo/lamb.glb',
    primaryColor: '#ec4899',
    accentColor: '#18181b',
    badgeColor: '#ec4899',
    defaultRimId: 'rim1',
    defaultSpoilerId: 'spoiler2',
    stats: {
      speed: 94,
      acceleration: 91,
      handling: 90,
      drift: 89,
    },
    physics: {
      topSpeedMultiplier: 1.10,
      accelMultiplier: 1.12,
      handlingMultiplier: 1.06,
    },
    unlockCost: 120,
  },
  {
    id: 'italia',
    name: 'REDLINE',
    subtitle: 'Track Racer',
    fullLabel: 'REDLINE',
    tag: 'TRACK PRO',
    category: 'SUPERCAR',
    description: 'Track-tuned V8 sports car made for smooth corner exits and clean lap times.',
    modelFile: '/models/cosmo/italia.glb',
    primaryColor: '#ef4444',
    accentColor: '#1c1917',
    badgeColor: '#ef4444',
    defaultRimId: 'rim2',
    defaultSpoilerId: 'spoiler1',
    stats: {
      speed: 96,
      acceleration: 94,
      handling: 96,
      drift: 87,
    },
    physics: {
      topSpeedMultiplier: 1.12,
      accelMultiplier: 1.15,
      handlingMultiplier: 1.15,
    },
    unlockCost: 150,
  },
  {
    id: 'rally',
    name: 'DRIFT',
    subtitle: 'Rally Turbo',
    fullLabel: 'DRIFT',
    tag: 'RALLY AWD',
    category: 'RALLY',
    description: 'All-wheel-drive rally hatchback with quick turbo pickup around tight turns.',
    modelFile: '/models/cosmo/rally.glb',
    primaryColor: '#10b981',
    accentColor: '#0f172a',
    badgeColor: '#10b981',
    defaultRimId: 'rim0',
    defaultSpoilerId: 'spoiler1',
    stats: {
      speed: 86,
      acceleration: 93,
      handling: 97,
      drift: 99,
    },
    physics: {
      topSpeedMultiplier: 1.04,
      accelMultiplier: 1.14,
      handlingMultiplier: 1.18,
    },
    unlockCost: 60,
  },
  {
    id: 'jeep',
    name: 'ROVER',
    subtitle: 'Offroad 4x4',
    fullLabel: 'ROVER',
    tag: 'OFFROAD',
    category: 'OFFROAD',
    description: 'Rugged 4x4 desert truck with high ground clearance and steady traction.',
    modelFile: '/models/cosmo/jeep.glb',
    primaryColor: '#84cc16',
    accentColor: '#1e293b',
    badgeColor: '#84cc16',
    defaultRimId: 'rim0',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 80,
      acceleration: 83,
      handling: 86,
      drift: 80,
    },
    physics: {
      topSpeedMultiplier: 1.0,
      accelMultiplier: 1.04,
      handlingMultiplier: 1.05,
    },
    unlockCost: 60,
  },
  {
    id: 'armor',
    name: 'TANK',
    subtitle: 'Heavy 4x4',
    fullLabel: 'TANK',
    tag: 'HEAVY DUTY',
    category: 'SPECIAL',
    description: 'Armored heavy truck that holds its racing line firmly in bumper-to-bumper packs.',
    modelFile: '/models/cosmo/armor.glb',
    primaryColor: '#64748b',
    accentColor: '#090d16',
    badgeColor: '#94a3b8',
    defaultRimId: 'rim3',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 79,
      acceleration: 81,
      handling: 82,
      drift: 76,
    },
    physics: {
      topSpeedMultiplier: 0.99,
      accelMultiplier: 1.02,
      handlingMultiplier: 0.98,
    },
    unlockCost: 90,
  },
  {
    id: 'mobil',
    name: 'CRUISER',
    subtitle: 'City Sedan',
    fullLabel: 'CRUISER',
    tag: 'STREET',
    category: 'COUPE',
    description: 'Low-slung street sedan with clean balance and reliable cornering speed.',
    modelFile: '/models/cosmo/mobil.glb',
    primaryColor: '#a855f7',
    accentColor: '#18181b',
    badgeColor: '#a855f7',
    defaultRimId: 'rim0',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 84,
      acceleration: 83,
      handling: 86,
      drift: 85,
    },
    physics: {
      topSpeedMultiplier: 1.02,
      accelMultiplier: 1.03,
      handlingMultiplier: 1.03,
    },
    unlockCost: 40,
  },
  {
    id: 'van',
    name: 'CARGO',
    subtitle: 'Turbo Van',
    fullLabel: 'CARGO',
    tag: 'SLEEPER VAN',
    category: 'SPECIAL',
    description: 'Boxy street van hiding a surprisingly punchy turbo engine under the hood.',
    modelFile: '/models/cosmo/van.glb',
    primaryColor: '#f59e0b',
    accentColor: '#1c1917',
    badgeColor: '#f59e0b',
    defaultRimId: 'rim1',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 85,
      acceleration: 87,
      handling: 82,
      drift: 85,
    },
    physics: {
      topSpeedMultiplier: 1.03,
      accelMultiplier: 1.06,
      handlingMultiplier: 1.0,
    },
    unlockCost: 60,
  },
];

// Helper to normalize any legacy kit IDs ('kit1', 'kit2', 'kit3') to the car IDs
export function normalizeCarId(id: string | undefined | null): BodyKitId {
  if (!id) return 'coupe';
  if (id === 'kit1') return 'coupe';
  if (id === 'kit2') return 'kamaro';
  if (id === 'kit3') return 'ghini';
  const found = BODY_KITS.find((k) => k.id === id);
  return found ? found.id : 'coupe';
}

export interface RivalRacerData {
  id: string;
  name: string;
  color: string;
  rank: number;
  speedKmh: number;
  position: [number, number, number];
}

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
  countdownStep: number;
  cameraMode: number;
  autopilot: boolean;
  audioEnabled: boolean;
  positionRank: number; // 1st, 2nd, 3rd, 4th
  rivals: RivalRacerData[];
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
  1: 75,
  2: 140,
  3: 240,
  4: 380,
};

export function getUpgradeCost(currentLevel: number): number | null {
  if (currentLevel >= 5) return null;
  return UPGRADE_PART_COSTS[currentLevel] ?? 400;
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
    rewardCoins: 120,
    rewardXp: 100,
    target: 1,
    getProgress: (c) => c.totalRaces,
  },
  {
    id: 'm_first_win',
    title: 'Checkered Flag',
    description: 'Finish 1st place in any race event.',
    category: 'Daily',
    rewardCoins: 180,
    rewardXp: 140,
    target: 1,
    getProgress: (c) => c.totalWins,
  },
  {
    id: 'm_tune_parts',
    title: 'Garage Tuner',
    description: 'Install 2 performance upgrades in the Garage.',
    category: 'Daily',
    rewardCoins: 160,
    rewardXp: 120,
    target: 2,
    getProgress: (c) => c.totalUpgrades,
  },
  {
    id: 'm_neon_city',
    title: 'Midnight Runner',
    description: 'Complete a race at Neon City circuit.',
    category: 'Daily',
    rewardCoins: 150,
    rewardXp: 120,
    target: 1,
    getProgress: (c) => (c.mapsRaced.includes('city') ? 1 : 0),
  },
  {
    id: 'm_alpine_snow',
    title: 'Alpine Conqueror',
    description: 'Complete a race at Alpine Snow pass.',
    category: 'Career',
    rewardCoins: 150,
    rewardXp: 120,
    target: 1,
    getProgress: (c) => (c.mapsRaced.includes('canyon') ? 1 : 0),
  },
  {
    id: 'm_world_tour',
    title: 'Circuit World Tour',
    description: 'Race on all 3 circuits (Sunset Coast, Neon City, Alpine Snow).',
    category: 'Career',
    rewardCoins: 280,
    rewardXp: 220,
    target: 3,
    getProgress: (c) => c.mapsRaced.length,
  },
  {
    id: 'm_car_collector',
    title: 'Showroom Collector',
    description: 'Own 4 cars in your personal garage.',
    category: 'Career',
    rewardCoins: 260,
    rewardXp: 200,
    target: 4,
    getProgress: (_c, unlockedCount) => unlockedCount,
  },
  {
    id: 'm_pro_veteran',
    title: 'Season Veteran',
    description: 'Complete 5 total race events.',
    category: 'Career',
    rewardCoins: 350,
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
}

export interface TheRaceEngineBridge {
  setScreen: (screen: GameState) => void;
  getScreen: () => GameState;
  startRace: () => void;
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
  setCameraMode: (mode: number) => void;
  getCameraMode: () => number;
  setAutopilot: (val: boolean) => void;
  toggleAudio: () => boolean;
  setAudioEnabled: (val: boolean) => boolean;
  isAudioEnabled: () => boolean;
  playSplashImpact: () => void;
  playUiClick: (variant?: 'click' | 'equip') => void;
  playCarRevPreview?: (kitId: BodyKitId) => void;
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
