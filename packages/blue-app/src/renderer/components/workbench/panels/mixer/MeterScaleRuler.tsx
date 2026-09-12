import React, { useMemo } from 'react';
import type { MeterProfileKey } from '@blue/data';
import { getMeterProfile } from './meter-profiles';
import { cn } from '../../../../lib/cn';

export interface MeterScaleRulerProps {
  profileKey?: MeterProfileKey;
  className?: string;
}

export function MeterScaleRuler({
  profileKey,
  className,
}: MeterScaleRulerProps): React.ReactElement {
  const profile = useMemo(() => getMeterProfile(profileKey), [profileKey]);

  return (
    <div
      className={cn(
        'mixer-scale-ruler select-none flex flex-col items-stretch shrink-0 border-r border-blue-border/40 bg-blue-overlay/30 text-blue-muted',
        className,
      )}
      style={{ width: 32, minWidth: 32 }}
      aria-label="Meter scale ruler"
    >
      {/* Spacer to align with channel strip name and pre chain */}
      <div className="mixer-scale-ruler__top shrink-0 border-b border-blue-border/30 h-[100px] flex items-center justify-center text-role-subheadline font-semibold tracking-wider text-blue-muted/60">
        dB
      </div>

      {/* Flexible scale section matching mixer-level-section */}
      <div className="mixer-scale-ruler__level-section flex-1 min-h-[96px] flex flex-col items-stretch py-2 relative">
        <div className="h-4 text-role-subheadline text-center text-blue-muted/60 uppercase font-mono">
          dB
        </div>
        {/* Track container with relative positioning matching MeterCanvas */}
        <div className="relative flex-1 min-h-[60px] w-full">
          {profile.majorTicks.map((tick) => {
            if (!tick.label) return null;
            const frac = profile.dbToFraction(tick.db);
            if (frac < 0 || frac > 1) return null;
            const isZero = tick.db === profile.zeroReferenceDb;

            return (
              <div
                key={tick.db}
                className="absolute right-0 flex items-center justify-end gap-1 -translate-y-1/2 pr-1 w-full"
                style={{
                  top: `calc(10px + ${(1 - frac).toFixed(4)} * (100% - 20px))`,
                }}
              >
                <span
                  className={cn(
                    'text-role-subheadline font-mono tracking-tight',
                    isZero ? 'text-amber-400 font-bold' : 'text-blue-muted/80',
                  )}
                >
                  {tick.label}
                </span>
                <span
                  className={cn(
                    'h-[1px] w-1.5 shrink-0',
                    isZero ? 'bg-amber-400' : 'bg-blue-border/70',
                  )}
                />
              </div>
            );
          })}
        </div>
        {/* Spacer to match mixer-level-value at bottom */}
        <div className="h-5" />
      </div>

      {/* Spacer to match post chain and output section */}
      <div className="mixer-scale-ruler__bottom shrink-0 h-[60px] border-t border-blue-border/30" />
    </div>
  );
}
