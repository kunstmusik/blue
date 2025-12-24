/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 Steven Yi (stevenyi@gmail.com)
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
 * Utility class for converting time values according to meter and tempo. 
 * Supports conversions between all TimeUnit types using TimeContext.
 * 
 * All conversions route through Csound beats as the canonical intermediate:
 * TimeUnit → Csound beats → TimeUnit
 * 
 * Conversion flow:
 * - BBTTime/BBSTTime/BBFTime → MeterMap → Csound beats
 * - BeatTime → direct (already in Csound beats)
 * - Csound beats → TempoMap → seconds
 * - Seconds → sample rate → frames
 * - Seconds → TimeValue/SMPTEValue
 *
 * @author Steven Yi
 */
public class TimeUtilities {
    public static double convertSampleTimeToSeconds(long sampleTime, long sampleRate) {
        return sampleTime / (double)sampleRate;
    }
    
    public static String convertSecondsToTimeString(double timeSeconds) {        
        int hours = (int) (timeSeconds / 3600);
        int minutes = (int) ((timeSeconds % 3600) / 60);
        int seconds = (int) (timeSeconds % 60);
        int milliseconds = (int) Math.round((timeSeconds - (int) timeSeconds) * 1000);

        String timeString = String.format("%02d:%02d:%02d.%03d", hours, minutes, seconds, milliseconds);
        return timeString;
    }
    
    public static double convertTimeToSeconds(int hours, int minutes, int seconds, int milliseconds) {
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000.0;
    }
    
    // FIXME: need to review if this is correct
    public static String convertSecondsToSMPTE(double timeSeconds, double smpteFrameRate) {
        int hours = (int) (timeSeconds / 3600);
        int minutes = (int) ((timeSeconds % 3600) / 60);
        int seconds = (int) (timeSeconds % 60);
        int frameNumber = (int) Math.round((timeSeconds - (int) timeSeconds) * smpteFrameRate);

        String timeString = String.format("%02d:%02d:%02d.%02d", hours, minutes, seconds, frameNumber);
        return timeString;
    }
    
    // ========== TimeUnit Conversion Methods ==========
    
    /**
     * Converts any TimeUnit to Csound beats using the provided TimeContext.
     * This is the core conversion that all other conversions route through.
     * 
     * @param timeUnit the TimeUnit to convert
     * @param context the TimeContext providing meter, tempo, and sample rate
     * @return the equivalent time in Csound beats
     */
    public static double timeUnitToBeats(TimeUnit timeUnit, TimeContext context) {
        if (timeUnit == null) {
            throw new IllegalArgumentException("TimeUnit cannot be null");
        }
        if (context == null) {
            throw new IllegalArgumentException("TimeContext cannot be null");
        }
        
        return switch (timeUnit.getTimeBase()) {
            case CSOUND_BEATS -> ((TimeUnit.BeatTime) timeUnit).getCsoundBeats();
            case BBT -> timeUnit.toBeats(context);
            case BBST -> timeUnit.toBeats(context);
            case BBF -> timeUnit.toBeats(context);
            case TIME -> {
                TimeUnit.TimeValue tv = (TimeUnit.TimeValue) timeUnit;
                double seconds = tv.toTotalSeconds();
                yield context.getTempoMap().secondsToBeats(seconds);
            }
            case SMPTE -> {
                TimeUnit.SMPTEValue sv = (TimeUnit.SMPTEValue) timeUnit;
                // TODO: SMPTE frame rate should come from TimeContext
                double frameRate = 30.0; // Default, should be configurable
                double seconds = sv.toTotalSeconds(frameRate);
                yield context.getTempoMap().secondsToBeats(seconds);
            }
            case FRAME -> {
                TimeUnit.FrameValue fv = (TimeUnit.FrameValue) timeUnit;
                double seconds = fv.toTotalSeconds(context.getSampleRate());
                yield context.getTempoMap().secondsToBeats(seconds);
            }
            case PROJECT_DEFAULT -> throw new IllegalArgumentException(
                "Cannot convert PROJECT_DEFAULT TimeBase - must be resolved to concrete TimeBase first");
        };
    }
    
    /**
     * Converts Csound beats to a TimeUnit of the specified TimeBase.
     * 
     * @param beats the time in Csound beats
     * @param targetTimeBase the desired TimeBase for the result
     * @param context the TimeContext providing meter, tempo, and sample rate
     * @return a new TimeUnit of the specified type
     */
    public static TimeUnit beatsToTimeUnit(double beats, TimeBase targetTimeBase, TimeContext context) {
        if (context == null) {
            throw new IllegalArgumentException("TimeContext cannot be null");
        }
        if (targetTimeBase == TimeBase.PROJECT_DEFAULT) {
            throw new IllegalArgumentException(
                "Cannot convert to PROJECT_DEFAULT TimeBase - must specify concrete TimeBase");
        }
        
        return switch (targetTimeBase) {
            case CSOUND_BEATS -> TimeUnit.beats(beats);
            case BBT -> context.getMeterMap().beatsToBBT(beats, context.getPPQ());
            case BBST -> context.getMeterMap().beatsToBBST(beats, context.getPPQ());
            case BBF -> context.getMeterMap().beatsToBBF(beats);
            case TIME -> {
                double seconds = context.getTempoMap().beatsToSeconds(beats);
                int hours = (int) (seconds / 3600);
                int minutes = (int) ((seconds % 3600) / 60);
                int secs = (int) (seconds % 60);
                int millis = (int) Math.round((seconds - (int) seconds) * 1000);
                yield TimeUnit.time(hours, minutes, secs, millis);
            }
            case SMPTE -> {
                double seconds = context.getTempoMap().beatsToSeconds(beats);
                // TODO: SMPTE frame rate should come from TimeContext
                double frameRate = 30.0; // Default, should be configurable
                int hours = (int) (seconds / 3600);
                int minutes = (int) ((seconds % 3600) / 60);
                int secs = (int) (seconds % 60);
                int frames = (int) Math.round((seconds - (int) seconds) * frameRate);
                yield TimeUnit.smpte(hours, minutes, secs, frames);
            }
            case FRAME -> {
                double seconds = context.getTempoMap().beatsToSeconds(beats);
                long frameNumber = Math.round(seconds * context.getSampleRate());
                yield TimeUnit.frames(frameNumber);
            }
            case PROJECT_DEFAULT -> throw new IllegalStateException("Should not reach here");
        };
    }
    
    /**
     * Converts a TimeUnit from one TimeBase to another.
     * 
     * @param timeUnit the source TimeUnit
     * @param targetTimeBase the desired target TimeBase
     * @param context the TimeContext for conversion
     * @return a new TimeUnit in the target TimeBase
     */
    public static TimeUnit convertTimeUnit(TimeUnit timeUnit, TimeBase targetTimeBase, TimeContext context) {
        // Short circuit if already in target TimeBase
        if (timeUnit.getTimeBase() == targetTimeBase) {
            return timeUnit;
        }
        
        // Convert through Csound beats as intermediate
        double beats = timeUnitToBeats(timeUnit, context);
        return beatsToTimeUnit(beats, targetTimeBase, context);
    }
    
    /**
     * Converts seconds to a TimeUnit of the specified TimeBase.
     * 
     * @param seconds the time in seconds
     * @param targetTimeBase the desired TimeBase
     * @param context the TimeContext for conversion
     * @return a new TimeUnit of the specified type
     */
    public static TimeUnit secondsToTimeUnit(double seconds, TimeBase targetTimeBase, TimeContext context) {
        double beats = context.getTempoMap().secondsToBeats(seconds);
        return beatsToTimeUnit(beats, targetTimeBase, context);
    }
    
    /**
     * Converts a TimeUnit to seconds.
     * 
     * @param timeUnit the TimeUnit to convert
     * @param context the TimeContext for conversion
     * @return the time in seconds
     */
    public static double timeUnitToSeconds(TimeUnit timeUnit, TimeContext context) {
        double beats = timeUnitToBeats(timeUnit, context);
        return context.getTempoMap().beatsToSeconds(beats);
    }
    
    /**
     * Converts a sample frame number to a TimeUnit.
     * 
     * @param frameNumber the audio sample frame number
     * @param targetTimeBase the desired TimeBase
     * @param context the TimeContext for conversion
     * @return a new TimeUnit of the specified type
     */
    public static TimeUnit framesToTimeUnit(long frameNumber, TimeBase targetTimeBase, TimeContext context) {
        double seconds = frameNumber / (double) context.getSampleRate();
        return secondsToTimeUnit(seconds, targetTimeBase, context);
    }
    
    /**
     * Converts a TimeUnit to a sample frame number.
     * 
     * @param timeUnit the TimeUnit to convert
     * @param context the TimeContext for conversion
     * @return the audio sample frame number
     */
    public static long timeUnitToFrames(TimeUnit timeUnit, TimeContext context) {
        double seconds = timeUnitToSeconds(timeUnit, context);
        return Math.round(seconds * context.getSampleRate());
    }
}
