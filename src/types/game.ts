export type GameState = 'SPLASH' | 'MENU' | 'GARAGE' | 'RACE' | 'GAMEOVER';

export type BodyKitId = 'kit1' | 'kit2' | 'kit3';
export type RimId = 'rim0' | 'rim1' | 'rim2' | 'rim3';
export type SpoilerId = 'spoiler0' | 'spoiler1' | 'spoiler2';

export interface RimSpec {
  id: RimId;
  name: string;
}

export interface SpoilerSpec {
  id: SpoilerId;
  name: string;
}

export const RIM_OPTIONS: RimSpec[] = [
  { id: 'rim0', name: 'Stock Alloy' },
  { id: 'rim1', name: 'Stealth 5-Spoke' },
  { id: 'rim2', name: 'Deep Dish Gold' },
  { id: 'rim3', name: 'GT Forged' },
];

export const SPOILER_OPTIONS: SpoilerSpec[] = [
  { id: 'spoiler0', name: 'Clean Deck' },
  { id: 'spoiler1', name: 'Street Wing' },
  { id: 'spoiler2', name: 'GT Pro Wing' },
];

export interface BodyKitSpec {
  id: BodyKitId;
  name: string;
  subtitle: string;
  fullLabel: string;
  tag: string;
  description: string;
  primaryColor: string;
  accentColor: string;
  badgeColor: string;
  defaultRimId: RimId;
  defaultSpoilerId: SpoilerId;
  stats: {
    speed: number;
    acceleration: number;
    handling: number;
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
    id: 'kit1',
    name: 'Street Tuner',
    subtitle: 'Crimson Street Coupe',
    fullLabel: 'Street Tuner',
    tag: 'BALANCED GRIP',
    description:
      'Agile street-tuned coupe with crimson metallic finish and balanced cornering grip.',
    primaryColor: '#ff1e26',
    accentColor: '#161922',
    badgeColor: '#ff3b30',
    defaultRimId: 'rim0',
    defaultSpoilerId: 'spoiler0',
    stats: {
      speed: 78,
      acceleration: 82,
      handling: 86,
    },
    physics: {
      topSpeedMultiplier: 1.0,
      accelMultiplier: 1.0,
      handlingMultiplier: 1.0,
    },
    unlockCost: 0,
  },
  {
    id: 'kit2',
    name: 'Aero Beast',
    subtitle: 'Neon Widebody GT',
    fullLabel: 'Aero Beast',
    tag: 'HIGH DOWNFORCE',
    description:
      'Widebody aero kit with electric neon cyan finish, forged 5-spoke rims, and high cornering downforce.',
    primaryColor: '#00e5ff',
    accentColor: '#0b1528',
    badgeColor: '#00e5ff',
    defaultRimId: 'rim1',
    defaultSpoilerId: 'spoiler1',
    stats: {
      speed: 88,
      acceleration: 89,
      handling: 95,
    },
    physics: {
      topSpeedMultiplier: 1.07,
      accelMultiplier: 1.12,
      handlingMultiplier: 1.16,
    },
    unlockCost: 150,
  },
  {
    id: 'kit3',
    name: 'Cyber Phantom',
    subtitle: 'Obsidian Gold Hypercar',
    fullLabel: 'Cyber Phantom',
    tag: 'MAX TOP SPEED',
    description:
      'Hyper-tuner prototype in stealth obsidian and gold with deep-dish rims and pro GT wing.',
    primaryColor: '#ffc72c',
    accentColor: '#161820',
    badgeColor: '#fbbf24',
    defaultRimId: 'rim2',
    defaultSpoilerId: 'spoiler2',
    stats: {
      speed: 97,
      acceleration: 94,
      handling: 91,
    },
    physics: {
      topSpeedMultiplier: 1.14,
      accelMultiplier: 1.18,
      handlingMultiplier: 1.1,
    },
    unlockCost: 250,
  },
];

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
  shieldActive: boolean;
  spinoutActive: boolean;
  driftCharge?: number;
  incomingAttack?: boolean;
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
    }
  ) => void;
  setCustomParts: (parts: {
    bodyId?: BodyKitId;
    rimId?: RimId;
    spoilerId?: SpoilerId;
  }) => void;
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
