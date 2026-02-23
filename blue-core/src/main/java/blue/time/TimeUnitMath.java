/*
 * blue - object composition environment for csound
 * Copyright (c) 2026 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.time;

/**
 * Type-safe arithmetic operations between {@link TimePosition} (position) and
 * {@link TimeDuration} (duration).
 * 
 * Method signatures enforce valid operations at compile time:
 * <ul>
 *   <li>Position + Duration → Position</li>
 *   <li>Position − Position → Duration (via {@link #distance})</li>
 *   <li>Duration + Duration → Duration</li>
 *   <li>Duration − Duration → Duration</li>
 * </ul>
 * 
 * Inspired by Ardour's deliberate disabling of {@code operator-} on
 * {@code timepos_t} to prevent semantically ambiguous operations.
 * 
 * All operations route through Csound beats as the canonical intermediate.
 * The result preserves the TimeBase of the first operand where applicable.
 *
 * @author Steven Yi
 */
public final class TimeUnitMath {
    
    private TimeUnitMath() {} // utility class — not instantiable
    
    // ========== Position + Duration → Position ==========
    
    /**
     * Adds a duration to a position, returning a new position.
     * The result preserves the TimeBase of the position operand.
     * 
     * @param context the TimeContext for conversion
     * @param position the starting position
     * @param duration the duration to add
     * @return a new TimePosition representing position + duration
     */
    public static TimePosition add(TimeContext context, TimePosition position, TimeDuration duration) {
        double posBeats = position.toBeats(context);
        double durBeats = duration.toBeats(context);
        double resultBeats = posBeats + durBeats;
        return TimeUtilities.beatsToTimePosition(resultBeats, position.getTimeBase(), context);
    }
    
    // ========== Position − Position → Duration ==========
    
    /**
     * Computes the distance between two positions as a duration.
     * Returns the absolute distance (always non-negative).
     * The result is in DurationBeats.
     * 
     * @param context the TimeContext for conversion
     * @param from the starting position
     * @param to the ending position
     * @return a TimeDuration representing the distance between the positions
     */
    public static TimeDuration distance(TimeContext context, TimePosition from, TimePosition to) {
        double fromBeats = from.toBeats(context);
        double toBeats = to.toBeats(context);
        return TimeDuration.beats(Math.abs(toBeats - fromBeats));
    }
    
    /**
     * Computes the signed distance from one position to another.
     * Positive if {@code to} is after {@code from}, negative is not possible
     * since TimeDuration cannot be negative — use {@link #distance} instead.
     * Returns zero if {@code to} is before {@code from}.
     * 
     * @param context the TimeContext for conversion
     * @param from the starting position
     * @param to the ending position
     * @return a TimeDuration representing max(0, to - from)
     */
    public static TimeDuration forwardDistance(TimeContext context, TimePosition from, TimePosition to) {
        double fromBeats = from.toBeats(context);
        double toBeats = to.toBeats(context);
        return TimeDuration.beats(Math.max(0, toBeats - fromBeats));
    }
    
    // ========== Duration + Duration → Duration ==========
    
    /**
     * Adds two durations together.
     * The result is in DurationBeats.
     * 
     * @param context the TimeContext for conversion
     * @param a the first duration
     * @param b the second duration
     * @return a TimeDuration representing a + b
     */
    public static TimeDuration add(TimeContext context, TimeDuration a, TimeDuration b) {
        double aBeats = a.toBeats(context);
        double bBeats = b.toBeats(context);
        return TimeDuration.beats(aBeats + bBeats);
    }
    
    // ========== Duration − Duration → Duration ==========
    
    /**
     * Subtracts one duration from another.
     * The result is clamped to zero (never negative).
     * The result is in DurationBeats.
     * 
     * @param context the TimeContext for conversion
     * @param a the duration to subtract from
     * @param b the duration to subtract
     * @return a TimeDuration representing max(0, a - b)
     */
    public static TimeDuration subtract(TimeContext context, TimeDuration a, TimeDuration b) {
        double aBeats = a.toBeats(context);
        double bBeats = b.toBeats(context);
        return TimeDuration.beats(Math.max(0, aBeats - bBeats));
    }
    
    // ========== Position − Duration → Position ==========
    
    /**
     * Subtracts a duration from a position, returning a new position.
     * The result is clamped so the position never goes below zero beats.
     * The result preserves the TimeBase of the position operand.
     * 
     * @param context the TimeContext for conversion
     * @param position the starting position
     * @param duration the duration to subtract
     * @return a new TimePosition representing max(0, position - duration)
     */
    public static TimePosition subtract(TimeContext context, TimePosition position, TimeDuration duration) {
        double posBeats = position.toBeats(context);
        double durBeats = duration.toBeats(context);
        double resultBeats = Math.max(0, posBeats - durBeats);
        return TimeUtilities.beatsToTimePosition(resultBeats, position.getTimeBase(), context);
    }
    
    // ========== Conversion Bridges ==========
    
    /**
     * Converts a TimeDuration to a specific TimeBase representation.
     * For measure-based formats (BBT, BBST, BBF), the result uses 0-based
     * duration semantics.
     * 
     * @param duration the duration to convert
     * @param targetTimeBase the desired TimeBase
     * @param context the TimeContext for conversion
     * @return a new TimeDuration in the target TimeBase
     */
    public static TimeDuration convertDuration(TimeDuration duration, TimeBase targetTimeBase, TimeContext context) {
        if (duration.getTimeBase() == targetTimeBase) {
            return duration;
        }
        
        double beats = duration.toBeats(context);
        return beatsToDuration(beats, targetTimeBase, context);
    }
    
    /**
     * Converts Csound beats to a TimeDuration of the specified TimeBase.
     * For measure-based formats, uses 0-based bars/beats (duration semantics).
     * 
     * @param beats the duration in Csound beats
     * @param targetTimeBase the desired TimeBase
     * @param context the TimeContext for conversion
     * @return a new TimeDuration of the specified type
     */
    public static TimeDuration beatsToDuration(double beats, TimeBase targetTimeBase, TimeContext context) {
        if (beats < 0) {
            beats = 0;
        }
        
        return switch (targetTimeBase) {
            case BEATS -> TimeDuration.beats(beats);
            case BBT -> {
                var meter = context.getMeterMap().get(0).getMeter();
                double beatsPerBar = meter.getMeasureBeatDuration();
                double beatScale = 4.0 / meter.beatLength;
                long bars = (long) (beats / beatsPerBar);
                double remainingBeats = beats - (bars * beatsPerBar);
                double scaledBeat = remainingBeats / beatScale;
                int wholeBeat = (int) scaledBeat;
                double fractionalBeat = scaledBeat - wholeBeat;
                int ticks = (int) Math.round(fractionalBeat * TimeContext.DEFAULT_PPQ);
                yield TimeDuration.bbt(bars, wholeBeat, ticks);
            }
            case BBST -> {
                var meter = context.getMeterMap().get(0).getMeter();
                double beatsPerBar = meter.getMeasureBeatDuration();
                double beatScale = 4.0 / meter.beatLength;
                long bars = (long) (beats / beatsPerBar);
                double remainingBeats = beats - (bars * beatsPerBar);
                double scaledBeat = remainingBeats / beatScale;
                int wholeBeat = (int) scaledBeat;
                double fractionalBeat = scaledBeat - wholeBeat;
                int totalTicks = (int) Math.round(fractionalBeat * TimeContext.DEFAULT_PPQ);
                int ticksPerSixteenth = TimeContext.DEFAULT_PPQ / 4;
                int sixteenth = totalTicks / ticksPerSixteenth;
                int subTicks = totalTicks % ticksPerSixteenth;
                yield TimeDuration.bbst(bars, wholeBeat, sixteenth, subTicks);
            }
            case BBF -> {
                var meter = context.getMeterMap().get(0).getMeter();
                double beatsPerBar = meter.getMeasureBeatDuration();
                double beatScale = 4.0 / meter.beatLength;
                long bars = (long) (beats / beatsPerBar);
                double remainingBeats = beats - (bars * beatsPerBar);
                double scaledBeat = remainingBeats / beatScale;
                int wholeBeat = (int) scaledBeat;
                double fractionalBeat = scaledBeat - wholeBeat;
                int fraction = (int) Math.round(fractionalBeat * 100);
                if (fraction >= 100) {
                    fraction = 99;
                }
                yield TimeDuration.bbf(bars, wholeBeat, fraction);
            }
            case TIME -> {
                double seconds = context.getTempoMap().beatsToSeconds(beats);
                long totalMs = Math.round(seconds * 1000);
                long h = totalMs / 3600000;
                long m = (totalMs % 3600000) / 60000;
                long s = (totalMs % 60000) / 1000;
                long ms = totalMs % 1000;
                yield TimeDuration.time(h, m, s, ms);
            }
            case SMPTE -> {
                // SMPTE is display-only — store as DurationTime instead
                double seconds = context.getTempoMap().beatsToSeconds(beats);
                long totalMs = Math.round(seconds * 1000);
                long h = totalMs / 3600000;
                long m = (totalMs % 3600000) / 60000;
                long s = (totalMs % 60000) / 1000;
                long ms = totalMs % 1000;
                yield TimeDuration.time(h, m, s, ms);
            }
            case FRAME -> {
                double seconds = context.getTempoMap().beatsToSeconds(beats);
                long frameCount = Math.round(seconds * context.getSampleRate());
                yield TimeDuration.frames(frameCount);
            }
        };
    }
    
    /**
     * Creates a TimeDuration from a TimePosition value, interpreting the TimePosition's
     * beat value as a duration rather than a position.
     * 
     * This is useful for bridging existing code that stores durations as TimePosition.
     * The resulting TimeDuration will be in DurationBeats format.
     * 
     * @param timePosition the TimePosition whose beat value represents a duration
     * @param context the TimeContext for conversion
     * @return a TimeDuration equivalent
     */
    public static TimeDuration fromTimePosition(TimePosition timePosition, TimeContext context) {
        double beats = timePosition.toBeats(context);
        return TimeDuration.beats(Math.max(0, beats));
    }
    
    /**
     * Creates a TimeDuration from a TimePosition value, converting to the specified
     * TimeBase with proper duration semantics (0-based for measure formats).
     * 
     * @param timePosition the TimePosition whose beat value represents a duration
     * @param targetTimeBase the desired TimeBase for the result
     * @param context the TimeContext for conversion
     * @return a TimeDuration in the target TimeBase
     */
    public static TimeDuration fromTimePosition(TimePosition timePosition, TimeBase targetTimeBase, TimeContext context) {
        double beats = timePosition.toBeats(context);
        return beatsToDuration(Math.max(0, beats), targetTimeBase, context);
    }
}
