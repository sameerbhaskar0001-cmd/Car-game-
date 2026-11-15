export type GameState = 'SPLASH' | 'MENU' | 'GARAGE' | 'RACE' | 'GAMEOVER';

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
    name: 'PHANTOM',
    subtitle: 'Twin-Turbo Street Apex',
    fullLabel: 'PHANTOM',
    tag: 'APEX HUNTER',
    category: 'COUPE',
    description: 'Twin-turbocharged street legend with carbon aero splitters and razor-sharp cornering grip.',
    modelFile: '/models/cosmo/coupe.glb',
    primaryColor: '#ff2233',
    accentColor: '#161922',
    badgeColor: '#ff3b30',
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
    name: 'SHOGUN',
    subtitle: 'Widebody Neo-Tuner',
    fullLabel: 'SHOGUN',
    tag: 'STREET LEGEND',
    category: 'COUPE',
    description: 'Custom widebody cyber-tuner with twin titanium exhausts, forged aero, and surgical drift control.',
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
    name: 'DEMON',
    subtitle: 'Supercharged Muscle Beast',
    fullLabel: 'DEMON',
    tag: 'RAW TORQUE',
    category: 'MUSCLE',
    description: 'Supercharged American muscle interceptor packing monstrous V8 torque and tire-shredding power.',
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
    name: 'VENOM',
    subtitle: 'Italian Stealth Hyper-Wedge',
    fullLabel: 'VENOM',
    tag: 'V12 FURY',
    category: 'SUPERCAR',
    description: 'Aerodynamic Italian mid-engine stealth supercar with screaming V12 fury and ground-effect downforce.',
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
    name: 'VALKYRIE',
    subtitle: 'Le Mans Prototype Hypercar',
    fullLabel: 'VALKYRIE',
    tag: 'MACH SPEED',
    category: 'HYPERCAR',
    description: 'Ultra-exotic Le Mans hypercar engineered with active carbon venturi tunnels and Mach-level velocity.',
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
    name: 'ENFORCER',
    subtitle: 'Tactical Pursuit Interceptor',
    fullLabel: 'ENFORCER',
    tag: 'HIGHWAY HUNTER',
    category: 'SPECIAL',
    description: 'High-speed tactical pursuit interceptor armed with reinforced ramming bars and strobe lightbars.',
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
    name: 'DIABLO',
    subtitle: 'Synthwave Cyber Supercar',
    fullLabel: 'DIABLO',
    tag: 'CYBER ICON',
    category: 'SUPERCAR',
    description: 'Razor-edged synthwave V12 prototype built for high-speed neon straightaways and aggressive drifts.',
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
    name: 'SCUDERIA',
    subtitle: 'Maranello Track Weapon',
    fullLabel: 'SCUDERIA',
    tag: 'TRACK WEAPON',
    category: 'SUPERCAR',
    description: 'Track-bred Italian V8 thoroughbred engineered for surgical apex clipping and explosive corner exits.',
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
    name: 'THUNDERBOLT',
    subtitle: 'AWD Turbo Drift Monster',
    fullLabel: 'THUNDERBOLT',
    tag: 'DRIFT KING',
    category: 'RALLY',
    description: 'All-wheel-drive gymkhana rally weapon with anti-lag turbo boost that slingshots around hairpins.',
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
    name: 'TITAN',
    subtitle: 'Desert Raid Trophy Brawler',
    fullLabel: 'TITAN',
    tag: 'ALL-TERRAIN',
    category: 'OFFROAD',
    description: 'Heavy-duty Baja trophy raid 4x4 with long-travel suspension, roll cage, and unstoppable traction.',
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
    name: 'JUGGERNAUT',
    subtitle: 'Heavy Armored Colossus',
    fullLabel: 'JUGGERNAUT',
    tag: 'UNSTOPPABLE',
    category: 'SPECIAL',
    description: 'Ballistic-plated tactical juggernaut that bulldozes rivals out of the racing line with zero flinch.',
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
    name: 'YAKUZA',
    subtitle: 'Twin-Turbo VIP Cruiser',
    fullLabel: 'YAKUZA',
    tag: 'NIGHT RUNNER',
    category: 'COUPE',
    description: 'Slammed midnight VIP executive sedan packing a hidden twin-turbo V8 and silky drift balance.',
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
    name: 'SYNDICATE',
    subtitle: '1000HP Sleeper Heist Rig',
    fullLabel: 'SYNDICATE',
    tag: 'TURBO SLEEPER',
    category: 'SPECIAL',
    description: 'Deceptively wild mid-engine heist van swapped with a 1000HP twin-turbo supercar powertrain.',
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

export type PowerupType =
  | 'ROCKET'
  | 'SHIELD'
  | 'OIL_SLICK'
  | 'HYPER_NITRO'
  | 'EMP';

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
  countdownStep: number;
  cameraMode: number;
  autopilot: boolean;
  audioEnabled: boolean;
  positionRank: number; // 1st, 2nd, 3rd, 4th
  rivals: RivalRacerData[];
  heldPowerup: PowerupType | null;
  rouletteActive?: boolean;
  roulettePreview?: PowerupType | null;
  lockedTargetName?: string | null;
  lockedTargetDistM?: number | null;
  shieldActive: boolean;
  spinoutActive: boolean;
  spinoutReason?: string | null;
  driftCharge?: number;
  incomingAttack?: boolean;
  incomingAttacker?: string | null;
  incomingUrgency?: number;
  combatFeedMessage?: string | null;
}

export interface RaceFinishResult {
  totalTime: number;
  bestLap: number;
  lapTimes: number[];
  coinsEarned: number;
  finishRank: number; // 1, 2, 3, or 4
}

export interface TheRaceEngineBridge {
  setScreen: (screen: GameState) => void;
  getScreen: () => GameState;
  startRace: () => void;
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
  triggerPowerup: () => boolean;
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
