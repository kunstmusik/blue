import { describe, expect, it } from 'vitest';
import {
  getMeterTrackGeometry,
  getProfileLabelCenterY,
  selectVisibleMeterLabels,
  METER_TRACK_TOP,
  METER_TRACK_BOTTOM_INSET,
} from '../components/workbench/panels/mixer/meter-layout';
import {
  METER_PROFILES,
  type MeterProfileKey,
} from '../components/workbench/panels/mixer/meter-profiles';

describe('meter-layout geometry and label selection', () => {
  const profileKeys: MeterProfileKey[] = [
    'peak-rms-mixing-plus-6',
    'peak-rms-linear-plus-6',
    'k20-rms-peak',
    'k14-rms-peak',
    'k12-rms-peak',
  ];

  it('computes correct track geometry for various heights', () => {
    expect(getMeterTrackGeometry(60)).toEqual({
      trackTop: 10,
      trackBottom: 50,
      trackHeight: 40,
    });
    expect(getMeterTrackGeometry(120)).toEqual({
      trackTop: 10,
      trackBottom: 110,
      trackHeight: 100,
    });
    expect(getMeterTrackGeometry(240)).toEqual({
      trackTop: 10,
      trackBottom: 230,
      trackHeight: 220,
    });
  });

  it('maps profile reference positions accurately to track geometry', () => {
    for (const key of profileKeys) {
      const profile = METER_PROFILES[key];
      const h = 120;
      const { trackTop, trackBottom, trackHeight } = getMeterTrackGeometry(h);

      // Top of track (fraction = 1.0)
      const topY = getProfileLabelCenterY(profile.maximumDb, profile, h);
      expect(topY).toBeCloseTo(trackTop, 5);

      // Bottom of track (fraction = 0.0)
      const bottomY = getProfileLabelCenterY(profile.minimumDb, profile, h);
      expect(bottomY).toBeCloseTo(trackBottom, 5);

      // Zero reference
      const zeroY = getProfileLabelCenterY(profile.zeroReferenceDb, profile, h);
      const zeroFraction = profile.dbToFraction(profile.zeroReferenceDb);
      expect(zeroY).toBeCloseTo(trackTop + (1 - zeroFraction) * trackHeight, 5);
    }
  });

  it('preserves zero and floor references across heights for all five profiles', () => {
    const heights = [60, 120, 240];

    for (const key of profileKeys) {
      const profile = METER_PROFILES[key];
      for (const h of heights) {
        const labels = selectVisibleMeterLabels({ profile, totalHeight: h });
        expect(labels.length).toBeGreaterThanOrEqual(2);

        // Zero reference tick must be present and marked as zero
        const zeroLabel = labels.find((l) => l.isZero);
        expect(zeroLabel).toBeDefined();
        expect(zeroLabel?.db).toBe(profile.zeroReferenceDb);

        // Floor tick must be present
        const floorLabel = labels.find((l) => l.db === profile.minimumDb);
        expect(floorLabel).toBeDefined();

        // All labels must have at least 2px logical separation (lineHeight = 14)
        for (let i = 0; i < labels.length - 1; i++) {
          const separation = labels[i + 1].centerY - labels[i].centerY;
          expect(separation).toBeGreaterThanOrEqual(14 + 2 - 1e-6);
        }

        // Must be sorted by centerY ascending
        for (let i = 0; i < labels.length - 1; i++) {
          expect(labels[i].centerY).toBeLessThan(labels[i + 1].centerY);
        }

        // All text boxes must stay within [0, h]
        for (const l of labels) {
          expect(l.centerY - 7).toBeGreaterThanOrEqual(-1e-6);
          expect(l.centerY + 7).toBeLessThanOrEqual(h + 1e-6);
        }
      }
    }
  });

  it('removes colliding labels deterministically prioritizing zero, floor, then ceiling', () => {
    // At H=60, mixing-plus-6 ceiling (+6 dB) collides with zero (0 dB) because distance is ~5.2px < 16px
    const mixingProfile = METER_PROFILES['peak-rms-mixing-plus-6'];
    const labels60 = selectVisibleMeterLabels({ profile: mixingProfile, totalHeight: 60 });

    // Zero must be present
    expect(labels60.some((l) => l.isZero)).toBe(true);
    // Floor (-70) must be present
    expect(labels60.some((l) => l.db === -70)).toBe(true);
    // Ceiling (+6) must have been removed due to collision with 0
    expect(labels60.some((l) => l.db === 6)).toBe(false);

    // At H=240, ceiling (+6) has enough room and should be included
    const labels240 = selectVisibleMeterLabels({ profile: mixingProfile, totalHeight: 240 });
    expect(labels240.some((l) => l.db === 6)).toBe(true);
    expect(labels240.some((l) => l.isZero)).toBe(true);
    expect(labels240.some((l) => l.db === -70)).toBe(true);
  });

  it('allows ceiling/clip independence when ceiling label is omitted', () => {
    // Even when ceiling label is omitted, track geometry and ceiling dB calculations are independent
    const mixingProfile = METER_PROFILES['peak-rms-mixing-plus-6'];
    const labels60 = selectVisibleMeterLabels({ profile: mixingProfile, totalHeight: 60 });
    expect(labels60.some((l) => l.db === mixingProfile.maximumDb)).toBe(false);

    // Track geometry still maps maximumDb to trackTop (y=10), allowing clip box to render above trackTop (y < 10)
    const ceilingCenterY = getProfileLabelCenterY(mixingProfile.maximumDb, mixingProfile, 60);
    expect(ceilingCenterY).toBe(METER_TRACK_TOP);
  });
});
