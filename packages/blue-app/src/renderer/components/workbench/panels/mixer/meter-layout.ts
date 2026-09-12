import type { MeterProfileDefinition } from './meter-profiles';

export const METER_TRACK_TOP = 10;
export const METER_TRACK_BOTTOM_INSET = 10;
export const DEFAULT_METER_LINE_HEIGHT = 14;
export const MIN_LABEL_SEPARATION_PX = 2;

export interface MeterTrackGeometry {
  readonly trackTop: number;
  readonly trackBottom: number;
  readonly trackHeight: number;
}

export function getMeterTrackGeometry(totalHeight: number): MeterTrackGeometry {
  const trackTop = METER_TRACK_TOP;
  const trackBottom = Math.max(trackTop, totalHeight - METER_TRACK_BOTTOM_INSET);
  const trackHeight = Math.max(0, totalHeight - (METER_TRACK_TOP + METER_TRACK_BOTTOM_INSET));
  return { trackTop, trackBottom, trackHeight };
}

export function getProfileLabelCenterY(
  db: number,
  profile: MeterProfileDefinition,
  totalHeight: number,
): number {
  const fraction = profile.dbToFraction(db);
  const { trackTop, trackHeight } = getMeterTrackGeometry(totalHeight);
  return trackTop + (1 - fraction) * trackHeight;
}

export interface SelectedMeterLabel {
  readonly db: number;
  readonly label: string;
  readonly centerY: number;
  readonly isZero: boolean;
}

export interface SelectVisibleMeterLabelsOptions {
  readonly profile: MeterProfileDefinition;
  readonly totalHeight: number;
  readonly lineHeight?: number;
}

export function selectVisibleMeterLabels({
  profile,
  totalHeight,
  lineHeight = DEFAULT_METER_LINE_HEIGHT,
}: SelectVisibleMeterLabelsOptions): readonly SelectedMeterLabel[] {
  if (totalHeight <= 0) return [];

  const candidatesWithLabels = profile.majorTicks.filter(
    (tick): tick is typeof tick & { label: string } =>
      Boolean(tick.label && tick.label.trim().length > 0),
  );

  // Deduplicate by tick.db
  const uniqueCandidatesMap = new Map<number, (typeof candidatesWithLabels)[0]>();
  for (const tick of candidatesWithLabels) {
    if (!uniqueCandidatesMap.has(tick.db)) {
      uniqueCandidatesMap.set(tick.db, tick);
    }
  }
  const uniqueCandidates = Array.from(uniqueCandidatesMap.values());
  if (uniqueCandidates.length === 0) return [];

  // Identify prioritized candidates: zero, floor, ceiling
  const zeroTick = uniqueCandidates.find((t) => t.db === profile.zeroReferenceDb);
  const sortedByDb = [...uniqueCandidates].sort((a, b) => a.db - b.db);
  const floorTick = sortedByDb[0];
  const ceilingTick = sortedByDb[sortedByDb.length - 1];

  const orderedToConsider: Array<(typeof candidatesWithLabels)[0]> = [];
  const consideredKeys = new Set<number>();

  const pushCandidate = (tick: (typeof candidatesWithLabels)[0] | undefined) => {
    if (!tick) return;
    if (consideredKeys.has(tick.db)) return;
    consideredKeys.add(tick.db);
    orderedToConsider.push(tick);
  };

  // Prioritization order: profile zero, floor, ceiling, then remaining high-to-low
  pushCandidate(zeroTick);
  pushCandidate(floorTick);
  pushCandidate(ceilingTick);

  // Remaining high-to-low
  const remainingHighToLow = [...uniqueCandidates]
    .filter((t) => !consideredKeys.has(t.db))
    .sort((a, b) => b.db - a.db);

  for (const tick of remainingHighToLow) {
    pushCandidate(tick);
  }

  const accepted: SelectedMeterLabel[] = [];

  for (const tick of orderedToConsider) {
    const centerY = getProfileLabelCenterY(tick.db, profile, totalHeight);
    const boxTop = centerY - lineHeight / 2;
    const boxBottom = centerY + lineHeight / 2;

    // Must fit inside [0, totalHeight]
    if (boxTop < 0 || boxBottom > totalHeight) {
      continue;
    }

    // Must have at least MIN_LABEL_SEPARATION_PX from all already accepted labels
    const collides = accepted.some(
      (existing) => Math.abs(existing.centerY - centerY) < lineHeight + MIN_LABEL_SEPARATION_PX,
    );
    if (collides) {
      continue;
    }

    accepted.push({
      db: tick.db,
      label: tick.label,
      centerY,
      isZero: tick.db === profile.zeroReferenceDb,
    });
  }

  // Return sorted by Y for top-to-bottom rendering
  return accepted.sort((a, b) => a.centerY - b.centerY);
}
