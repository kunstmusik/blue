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
 * Supports conversions between all TimePosition types using TimeContext.
 * 
 * All conversions route through Csound beats as the canonical intermediate:
 * TimePosition → Csound beats → TimePosition
 * 
 * Conversion flow:
 * - BBTTime/BBSTTime/BBFTime → MeterMap → Csound beats
 * - BeatTime → direct (already in Csound beats)
 * - Csound beats → TempoMap → seconds
 * - Seconds → sample rate → frames
 * - Seconds → TimeValue
 *
 * @author Steven Yi
 */
public class TimeUtilities {
    public static double convertSampleTimeToSeconds(long sampleTime, long sampleRate) {
        return sampleTime / (double)sampleRate;
    }
    
    public static String convertSecondsToTimeString(double timeSeconds) {        
        long totalMillis = Math.round(timeSeconds * 1000.0);
        long hours = totalMillis / 3_600_000;
        long minutes = (totalMillis % 3_600_000) / 60_000;
        long seconds = (totalMillis % 60_000) / 1_000;
        long milliseconds = totalMillis % 1_000;
        return String.format("%02d:%02d:%02d.%03d", hours, minutes, seconds, milliseconds);
    }
    
    public static double convertTimeToSeconds(int hours, int minutes, int seconds, int milliseconds) {
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000.0;
    }
    
    /**
     * Converts seconds to SMPTE timecode string (HH:MM:SS:FF).
     * Uses truncation (not rounding) for frame number to prevent overflow.
     */
    public static String convertSecondsToSMPTE(double timeSeconds, double smpteFrameRate) {
        int hours = (int) (timeSeconds / 3600);
        int minutes = (int) ((timeSeconds % 3600) / 60);
        int seconds = (int) (timeSeconds % 60);
        int frameNumber = (int) ((timeSeconds - (int) timeSeconds) * smpteFrameRate);
        // Clamp to valid range
        int maxFrames = (int) smpteFrameRate - 1;
        if (frameNumber > maxFrames) frameNumber = maxFrames;
        if (frameNumber < 0) frameNumber = 0;
        return String.format("%02d:%02d:%02d:%02d", hours, minutes, seconds, frameNumber);
    }
    
    // ========== TimePosition Conversion Methods ==========
    
    /**
     * Converts any TimePosition to Csound beats using the provided TimeContext.
     * This is the core conversion that all other conversions route through.
     * 
     * @param timePosition the TimePosition to convert
     * @param context the TimeContext providing meter, tempo, and sample rate
     * @return the equivalent time in Csound beats
     */
    public static double timePositionToBeats(TimePosition timePosition, TimeContext context) {
        if (timePosition == null) {
            throw new IllegalArgumentException("TimePosition cannot be null");
        }
        if (context == null) {
            throw new IllegalArgumentException("TimeContext cannot be null");
        }
        
        return switch (timePosition.getTimeBase()) {
            case BEATS -> ((TimePosition.BeatTime) timePosition).getCsoundBeats();
            case BBT -> timePosition.toBeats(context);
            case BBST -> timePosition.toBeats(context);
            case BBF -> timePosition.toBeats(context);
            case TIME -> {
                TimePosition.TimeValue tv = (TimePosition.TimeValue) timePosition;
                double seconds = tv.toTotalSeconds();
                yield context.getTempoMap().secondsToBeats(seconds);
            }
            case SECONDS -> {
                TimePosition.SecondsValue sv = (TimePosition.SecondsValue) timePosition;
                yield context.getTempoMap().secondsToBeats(sv.getTotalSeconds());
            }
            case SMPTE -> {
                // SMPTE is display-only — should not appear as a stored TimePosition.
                // Fall through to TIME handling.
                throw new IllegalArgumentException(
                        "SMPTE is display-only and cannot be stored as a TimePosition");
            }
            case FRAME -> {
                TimePosition.FrameValue fv = (TimePosition.FrameValue) timePosition;
                double seconds = fv.toTotalSeconds(context.getSampleRate());
                yield context.getTempoMap().secondsToBeats(seconds);
            }
        };
    }
    
    /**
     * Converts Csound beats to a TimePosition of the specified TimeBase.
     * 
     * @param beats the time in Csound beats
     * @param targetTimeBase the desired TimeBase for the result
     * @param context the TimeContext providing meter, tempo, and sample rate
     * @return a new TimePosition of the specified type
     */
    public static TimePosition beatsToTimePosition(double beats, TimeBase targetTimeBase, TimeContext context) {
        if (context == null) {
            throw new IllegalArgumentException("TimeContext cannot be null");
        }
        
        return switch (targetTimeBase) {
            case BEATS -> TimePosition.beats(beats);
            case BBT -> context.getMeterMap().beatsToBBT(beats, TimeContext.DEFAULT_PPQ);
            case BBST -> context.getMeterMap().beatsToBBST(beats, TimeContext.DEFAULT_PPQ);
            case BBF -> context.getMeterMap().beatsToBBF(beats);
            case TIME -> {
                double seconds = context.getTempoMap().beatsToSeconds(beats);
                yield secondsToTimeValue(seconds);
            }
            case SECONDS -> {
                double seconds = context.getTempoMap().beatsToSeconds(beats);
                yield TimePosition.seconds(seconds);
            }
            case SMPTE -> {
                // SMPTE is display-only — produce a TimeValue instead
                double seconds = context.getTempoMap().beatsToSeconds(beats);
                yield secondsToTimeValue(seconds);
            }
            case FRAME -> {
                double seconds = context.getTempoMap().beatsToSeconds(beats);
                long frameNumber = Math.round(seconds * context.getSampleRate());
                yield TimePosition.frames(frameNumber);
            }
        };
    }
    
    /**
     * Converts a TimePosition from one TimeBase to another.
     * 
     * @param timePosition the source TimePosition
     * @param targetTimeBase the desired target TimeBase
     * @param context the TimeContext for conversion
     * @return a new TimePosition in the target TimeBase
     */
    public static TimePosition convertTimePosition(TimePosition timePosition, TimeBase targetTimeBase, TimeContext context) {
        // Short circuit if already in target TimeBase
        if (timePosition.getTimeBase() == targetTimeBase) {
            return timePosition;
        }
        
        // Convert through Csound beats as intermediate
        double beats = timePositionToBeats(timePosition, context);
        return beatsToTimePosition(beats, targetTimeBase, context);
    }
    
    /**
     * Converts seconds to a TimePosition of the specified TimeBase.
     * 
     * @param seconds the time in seconds
     * @param targetTimeBase the desired TimeBase
     * @param context the TimeContext for conversion
     * @return a new TimePosition of the specified type
     */
    public static TimePosition secondsToTimePosition(double seconds, TimeBase targetTimeBase, TimeContext context) {
        double beats = context.getTempoMap().secondsToBeats(seconds);
        return beatsToTimePosition(beats, targetTimeBase, context);
    }
    
    /**
     * Converts a TimePosition to seconds.
     * 
     * @param timePosition the TimePosition to convert
     * @param context the TimeContext for conversion
     * @return the time in seconds
     */
    public static double timePositionToSeconds(TimePosition timePosition, TimeContext context) {
        double beats = timePositionToBeats(timePosition, context);
        return context.getTempoMap().beatsToSeconds(beats);
    }
    
    /**
     * Converts a sample frame number to a TimePosition.
     * 
     * @param frameNumber the audio sample frame number
     * @param targetTimeBase the desired TimeBase
     * @param context the TimeContext for conversion
     * @return a new TimePosition of the specified type
     */
    public static TimePosition framesToTimePosition(long frameNumber, TimeBase targetTimeBase, TimeContext context) {
        double seconds = frameNumber / (double) context.getSampleRate();
        return secondsToTimePosition(seconds, targetTimeBase, context);
    }
    
    /**
     * Converts a TimePosition to a sample frame number.
     * 
     * @param timePosition the TimePosition to convert
     * @param context the TimeContext for conversion
     * @return the audio sample frame number
     */
    public static long timePositionToFrames(TimePosition timePosition, TimeContext context) {
        double seconds = timePositionToSeconds(timePosition, context);
        return Math.round(seconds * context.getSampleRate());
    }
    
    private static TimePosition.TimeValue secondsToTimeValue(double seconds) {
        long totalMillis = Math.round(seconds * 1000.0);
        long hours = totalMillis / 3_600_000;
        long minutes = (totalMillis % 3_600_000) / 60_000;
        long secs = (totalMillis % 60_000) / 1_000;
        long millis = totalMillis % 1_000;
        return TimePosition.time(hours, minutes, secs, millis);
    }
}
