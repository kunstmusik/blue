import React, { useMemo } from 'react';
import type { MeterProfileKey } from '@blue/data';
import { getMeterProfile } from './meter-profiles';
import { selectVisibleMeterLabels, DEFAULT_METER_LINE_HEIGHT } from './meter-layout';
import { cn } from '../../../../lib/cn';

export interface MeterScaleRulerProps {
  profileKey?: MeterProfileKey;
  height?: number;
  className?: string;
  lineHeight?: number;
}

export const MeterScaleRuler = React.memo(function MeterScaleRuler({
  profileKey,
  height = 120,
  className,
  lineHeight = DEFAULT_METER_LINE_HEIGHT,
}: MeterScaleRulerProps): React.ReactElement {
  const profile = useMemo(() => getMeterProfile(profileKey), [profileKey]);

  const labels = useMemo(
    () => selectVisibleMeterLabels({ profile, totalHeight: height, lineHeight }),
    [profile, height, lineHeight],
  );

  const accessibleContext = useMemo(() => {
    if (profile.key === 'k20-rms-peak') {
      return 'K-20 reference (-20 dBFS offset)';
    }
    if (profile.key === 'k14-rms-peak') {
      return 'K-14 reference (-14 dBFS offset)';
    }
    if (profile.key === 'k12-rms-peak') {
      return 'K-12 reference (-12 dBFS offset)';
    }
    return 'dBFS signal scale';
  }, [profile.key]);

  return (
    <div
      className={cn(
        'mixer-scale-ruler mixer-scale-ruler--local select-none relative shrink-0 w-[22px] overflow-hidden pointer-events-none',
        className,
      )}
      style={{ height, width: 22, minWidth: 22, maxWidth: 22 }}
      aria-label={`Meter scale for ${profile.label} (${accessibleContext})`}
      title={`${profile.label} (${accessibleContext})`}
    >
      {labels.map((label) => (
        <span
          key={label.db}
          className={cn(
            'absolute right-0 text-role-subheadline font-mono pr-0.5 text-right select-none',
            label.isZero ? 'text-amber-400 font-bold' : 'text-blue-muted/80',
          )}
          style={{
            top: `${(label.centerY - lineHeight / 2).toFixed(2)}px`,
            height: `${lineHeight}px`,
            lineHeight: `${lineHeight}px`,
          }}
        >
          {label.label}
        </span>
      ))}
    </div>
  );
});
