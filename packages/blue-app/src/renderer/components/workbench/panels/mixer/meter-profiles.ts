import type { MeterProfileKey } from '@blue/data';

export interface MeterTick {
  readonly db: number;
  readonly label?: string;
  readonly isMajor: boolean;
}

export interface MeterColorStop {
  readonly fraction: number;
  readonly color: string;
}

export interface MeterProfileDefinition {
  readonly key: MeterProfileKey;
  readonly label: string;
  readonly description: string;
  readonly minimumDb: number;
  readonly maximumDb: number;
  readonly zeroReferenceDb: number;
  readonly barMeasurement: 'rms';
  readonly secondaryMeasurement: 'peak';
  readonly dbToFraction: (db: number) => number;
  readonly majorTicks: readonly MeterTick[];
  readonly minorTicks: readonly MeterTick[];
  readonly colorStops: readonly MeterColorStop[];
}

export const K_REFERENCE_DISCLAIMER =
  'Visual reference only; does not calibrate monitor SPL, room gain, or acoustic listening level.';

function linearDbToFraction(db: number, minDb: number, maxDb: number): number {
  if (Number.isNaN(db) || db <= minDb) return 0;
  if (db >= maxDb) return 1;
  return (db - minDb) / (maxDb - minDb);
}

function mixingDbToFraction(db: number): number {
  if (Number.isNaN(db) || db <= -70) return 0;
  if (db >= 6) return 1;
  let def = 0;
  if (db < -60) {
    def = (db + 70) * 0.25;
  } else if (db < -50) {
    def = (db + 60) * 0.5 + 2.5;
  } else if (db < -40) {
    def = (db + 50) * 0.75 + 7.5;
  } else if (db < -30) {
    def = (db + 40) * 1.5 + 15.0;
  } else if (db < -20) {
    def = (db + 30) * 2.0 + 30.0;
  } else {
    def = (db + 20) * 2.5 + 50.0;
  }
  return Math.max(0, Math.min(1, def / 115));
}

export const METER_PROFILES: Readonly<Record<MeterProfileKey, MeterProfileDefinition>> = {
  'peak-rms-mixing-plus-6': {
    key: 'peak-rms-mixing-plus-6',
    label: 'Peak/RMS (+6 dBFS)',
    description:
      'RMS bar plus sample-peak marker on mixing-focused mapping (-70 to +6 dBFS) with expanded travel from -20 to +6 dBFS.',
    minimumDb: -70,
    maximumDb: 6,
    zeroReferenceDb: 0,
    barMeasurement: 'rms',
    secondaryMeasurement: 'peak',
    dbToFraction: mixingDbToFraction,
    majorTicks: [
      { db: 6, label: '+6', isMajor: true },
      { db: 3, label: '+3', isMajor: true },
      { db: 0, label: '0', isMajor: true },
      { db: -3, label: '-3', isMajor: true },
      { db: -6, label: '-6', isMajor: true },
      { db: -10, label: '-10', isMajor: true },
      { db: -14, label: '-14', isMajor: true },
      { db: -18, label: '-18', isMajor: true },
      { db: -20, label: '-20', isMajor: true },
      { db: -30, label: '-30', isMajor: true },
      { db: -40, label: '-40', isMajor: true },
      { db: -50, label: '-50', isMajor: true },
      { db: -60, label: '-60', isMajor: true },
      { db: -70, label: '-70', isMajor: true },
    ],
    minorTicks: [
      { db: 5, isMajor: false },
      { db: 4, isMajor: false },
      { db: 2, isMajor: false },
      { db: 1, isMajor: false },
      { db: -1, isMajor: false },
      { db: -2, isMajor: false },
      { db: -4, isMajor: false },
      { db: -5, isMajor: false },
      { db: -7, isMajor: false },
      { db: -8, isMajor: false },
      { db: -9, isMajor: false },
      { db: -12, isMajor: false },
      { db: -16, isMajor: false },
    ],
    colorStops: [
      { fraction: 0.0, color: '#22c55e' },
      { fraction: 55 / 115, color: '#22c55e' },
      { fraction: 92.5 / 115, color: '#eab308' },
      { fraction: 100 / 115, color: '#f97316' },
      { fraction: 1.0, color: '#ef4444' },
    ],
  },

  'peak-rms-linear-plus-6': {
    key: 'peak-rms-linear-plus-6',
    label: 'Peak/RMS Linear (+6 dBFS)',
    description: 'RMS bar plus sample-peak marker on uniform linear dB mapping (-60 to +6 dBFS).',
    minimumDb: -60,
    maximumDb: 6,
    zeroReferenceDb: 0,
    barMeasurement: 'rms',
    secondaryMeasurement: 'peak',
    dbToFraction: (db: number) => linearDbToFraction(db, -60, 6),
    majorTicks: [
      { db: 6, label: '+6', isMajor: true },
      { db: 0, label: '0', isMajor: true },
      { db: -6, label: '-6', isMajor: true },
      { db: -12, label: '-12', isMajor: true },
      { db: -18, label: '-18', isMajor: true },
      { db: -24, label: '-24', isMajor: true },
      { db: -30, label: '-30', isMajor: true },
      { db: -40, label: '-40', isMajor: true },
      { db: -50, label: '-50', isMajor: true },
      { db: -60, label: '-60', isMajor: true },
    ],
    minorTicks: [
      { db: 3, isMajor: false },
      { db: -3, isMajor: false },
      { db: -9, isMajor: false },
      { db: -15, isMajor: false },
      { db: -21, isMajor: false },
      { db: -36, isMajor: false },
      { db: -45, isMajor: false },
    ],
    colorStops: [
      { fraction: 0.0, color: '#22c55e' },
      { fraction: 48 / 66, color: '#22c55e' },
      { fraction: 57 / 66, color: '#eab308' },
      { fraction: 60 / 66, color: '#f97316' },
      { fraction: 1.0, color: '#ef4444' },
    ],
  },

  'k20-rms-peak': {
    key: 'k20-rms-peak',
    label: 'K20 (RMS + Peak)',
    description: `K-20 reference (0 on scale = -20 dBFS RMS) with absolute sample peak. ${K_REFERENCE_DISCLAIMER}`,
    minimumDb: -60,
    maximumDb: 0,
    zeroReferenceDb: -20,
    barMeasurement: 'rms',
    secondaryMeasurement: 'peak',
    dbToFraction: (db: number) => linearDbToFraction(db, -60, 0),
    majorTicks: [
      { db: 0, label: '+20', isMajor: true },
      { db: -16, label: '+4', isMajor: true },
      { db: -20, label: '0', isMajor: true },
      { db: -24, label: '-4', isMajor: true },
      { db: -30, label: '-10', isMajor: true },
      { db: -40, label: '-20', isMajor: true },
      { db: -50, label: '-30', isMajor: true },
      { db: -60, label: '-40', isMajor: true },
    ],
    minorTicks: [
      { db: -4, isMajor: false },
      { db: -8, isMajor: false },
      { db: -12, isMajor: false },
      { db: -18, isMajor: false },
      { db: -22, isMajor: false },
    ],
    colorStops: [
      { fraction: 0.0, color: '#22c55e' },
      { fraction: 40 / 60, color: '#22c55e' },
      { fraction: 44 / 60, color: '#eab308' },
      { fraction: 1.0, color: '#ef4444' },
    ],
  },

  'k14-rms-peak': {
    key: 'k14-rms-peak',
    label: 'K14 (RMS + Peak)',
    description: `K-14 reference (0 on scale = -14 dBFS RMS) with absolute sample peak. ${K_REFERENCE_DISCLAIMER}`,
    minimumDb: -60,
    maximumDb: 0,
    zeroReferenceDb: -14,
    barMeasurement: 'rms',
    secondaryMeasurement: 'peak',
    dbToFraction: (db: number) => linearDbToFraction(db, -60, 0),
    majorTicks: [
      { db: 0, label: '+14', isMajor: true },
      { db: -10, label: '+4', isMajor: true },
      { db: -14, label: '0', isMajor: true },
      { db: -18, label: '-4', isMajor: true },
      { db: -24, label: '-10', isMajor: true },
      { db: -34, label: '-20', isMajor: true },
      { db: -44, label: '-30', isMajor: true },
      { db: -60, label: '-46', isMajor: true },
    ],
    minorTicks: [
      { db: -2, isMajor: false },
      { db: -6, isMajor: false },
      { db: -12, isMajor: false },
      { db: -16, isMajor: false },
    ],
    colorStops: [
      { fraction: 0.0, color: '#22c55e' },
      { fraction: 46 / 60, color: '#22c55e' },
      { fraction: 50 / 60, color: '#eab308' },
      { fraction: 1.0, color: '#ef4444' },
    ],
  },

  'k12-rms-peak': {
    key: 'k12-rms-peak',
    label: 'K12 (RMS + Peak)',
    description: `K-12 reference (0 on scale = -12 dBFS RMS) with absolute sample peak. ${K_REFERENCE_DISCLAIMER}`,
    minimumDb: -60,
    maximumDb: 0,
    zeroReferenceDb: -12,
    barMeasurement: 'rms',
    secondaryMeasurement: 'peak',
    dbToFraction: (db: number) => linearDbToFraction(db, -60, 0),
    majorTicks: [
      { db: 0, label: '+12', isMajor: true },
      { db: -8, label: '+4', isMajor: true },
      { db: -12, label: '0', isMajor: true },
      { db: -16, label: '-4', isMajor: true },
      { db: -22, label: '-10', isMajor: true },
      { db: -32, label: '-20', isMajor: true },
      { db: -42, label: '-30', isMajor: true },
      { db: -60, label: '-48', isMajor: true },
    ],
    minorTicks: [
      { db: -2, isMajor: false },
      { db: -4, isMajor: false },
      { db: -6, isMajor: false },
      { db: -10, isMajor: false },
      { db: -14, isMajor: false },
    ],
    colorStops: [
      { fraction: 0.0, color: '#22c55e' },
      { fraction: 48 / 60, color: '#22c55e' },
      { fraction: 52 / 60, color: '#eab308' },
      { fraction: 1.0, color: '#ef4444' },
    ],
  },
};

export const FALLBACK_METER_PROFILE_KEY: MeterProfileKey = 'peak-rms-linear-plus-6';

export function getMeterProfile(key?: string | null): MeterProfileDefinition {
  if (key && Object.prototype.hasOwnProperty.call(METER_PROFILES, key)) {
    return METER_PROFILES[key as MeterProfileKey];
  }
  return METER_PROFILES[FALLBACK_METER_PROFILE_KEY];
}

export function formatPeakDb(db: number): string {
  if (!Number.isFinite(db) || db <= -100) {
    return '-inf';
  }
  const formatted = db.toFixed(1);
  return formatted === '-0.0' ? '0.0' : formatted;
}
