export type GameState = 'SPLASH' | 'MENU' | 'GARAGE' | 'RACE' | 'GAMEOVER';

export type MapId = 'coast' | 'city' | 'canyon';

export interface MapSpec {
  id: MapId;
  name: string;
  shortName: string;
  subtitle: string;
  environmentTag: string;
  lengthLabel: string;
  laps: number;
  accentHex: string;
  secondaryHex: string;
  skyTopHex: string;
  skyHorizonHex: string;
  fogHex: string;
  fogDensity: number;
  description: string;
}

export const MAP_ORDER: MapId[] = ['coast', 'city', 'canyon'];

export const MAP_SPECS: MapSpec[] = [
  {
    id: 'coast',
    name: 'SUNSET COAST',
    shortName: 'COAST',
    subtitle: 'Coastal Beach Highway',
    environmentTag: 'OCEAN · BRIDGE · PALMS',
    lengthLabel: '3.8 KM',
    laps: 3,
    accentHex: '#fb923c',
    secondaryHex: '#0ea5e9',
    skyTopHex: '#1e293b',
    skyHorizonHex: '#fb923c',
    fogHex: '#2a2438',
    fogDensity: 0.32,
    description: 'Golden-hour oceanfront highway with swaying palms, sandy bay, and suspension bridge.',
  },
  {
    id: 'city',
    name: 'NEON CITY',
    shortName: 'CITY',
    subtitle: 'Midnight City Circuit',
    environmentTag: 'SKYLINE · TUNNEL · NEON',
    lengthLabel: '3.6 KM',
    laps: 3,
    accentHex: '#00e5ff',
    secondaryHex: '#ec4899',
    skyTopHex: '#050814',
    skyHorizonHex: '#0f172a',
    fogHex: '#080d1d',
    fogDensity: 0.36,
    description: 'High-speed downtown circuit through glowing skyscrapers, wet asphalt, and a highway tunnel.',
  },
  {
    id: 'canyon',
    name: 'ALPINE PASS',
    shortName: 'CANYON',
    subtitle: 'Mountain Canyon Pass',
    environmentTag: 'CLIFFS · GORGE · PINES',
    lengthLabel: '4.1 KM',
    laps: 3,
    accentHex: '#34d399',
    secondaryHex: '#fbbf24',
    skyTopHex: '#0f172a',
    skyHorizonHex: '#475569',
    fogHex: '#182436',
    fogDensity: 0.34,
    description: 'Sweeping mountain switchbacks, pine ridges, and a steel truss bridge over a misty gorge.',
  },
];

export function normalizeMapId(id: string | undefined | null): MapId {
  if (id === 'coast' || id === 'city' || id === 'canyon') return id;
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

export interface RaceTelemetry {
  speedKmh: number;
  lapCount: number;
  currentLapTime: number;
  totalRaceTime: number;
  bestLapTime: number | null;
  boostCharge: number;
  boostActive: number;
  isDrifting: boolean;
  driftCharge?: number;
  countdownStep: number;
  cameraMode: number;
  autopilot: boolean;
  audioEnabled: boolean;
  positionRank: number; // 1st, 2nd, 3rd, 4th
  rivals: RivalRacerData[];
}

export interface RaceFinishResult {
  totalTime: number;
  bestLap: number;
  lapTimes: number[];
  coinsEarned: number;
  finishRank: number; // 1, 2, 3, or 4
  mapId?: MapId;
}

export interface TheRaceEngineBridge {
  setScreen: (screen: GameState) => void;
  getScreen: () => GameState;
  startRace: () => void;
  setMap?: (mapId: MapId) => void;
  getMap?: () => MapId;
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
    dir: 'left' | 'right' | 'forward' | 'backward',
    isDown: boolean
  ) => void;
  clearTouchControls: () => void;
  triggerNitro: () => boolean;
  setCameraMode: (mode: number) => void;
  getCameraMode: () => number;
  setAutopilot: (val: boolean) => void;
  toggleAudio: () => boolean;
  setAudioEnabled: (val: boolean) => boolean;
  isAudioEnabled: () => boolean;
  playSplashImpact: () => void;
  playUiClick: (variant?: 'click' | 'equip') => void;
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
