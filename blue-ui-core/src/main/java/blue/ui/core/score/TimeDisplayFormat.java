/*
 * blue - object composition environment for csound
 * Copyright (c) 2025 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.score;

import blue.time.TimeContext;
import blue.time.TimeUnit;

/**
 * Enum defining the available time display formats for the timeline ruler
 * and status bar. Each format provides appropriate formatting methods for
 * displaying time values.
 * 
 * <p>This is part of Sprint 5 UI Layer Features for the new time system.
 * Option C design - Compact with Expandable Details.</p>
 *
 * @author Steven Yi
 * @since 3.0
 */
public enum TimeDisplayFormat {
    
    /**
     * Classic Blue format using Csound beats (e.g., "0.0", "4.0", "8.0").
     * Does not account for measures, only absolute beat position.
     */
    BEATS("Beats", "0.0, 4.0, 8.0") {
        @Override
        public String format(double beatPosition, TimeContext context) {
            return String.format("%.2f", beatPosition);
        }
        
        @Override
        public String formatCompact(double beatPosition, TimeContext context) {
            if (beatPosition == Math.floor(beatPosition)) {
                return String.format("%.0f", beatPosition);
            }
            return String.format("%.1f", beatPosition);
        }
    },
    
    /**
     * Musical notation format showing Measure:Beat (e.g., "1:1.0", "2:3.0").
     * Requires MeterMap context for proper calculation.
     */
    MEASURE_BEATS("Measures:Beats", "1:1.0, 2:1.0") {
        @Override
        public String format(double beatPosition, TimeContext context) {
            if (context == null || context.getMeterMap() == null) {
                return BEATS.format(beatPosition, context);
            }
            var meterMap = context.getMeterMap();
            var measureBeats = meterMap.toMeasureBeats(TimeUnit.beats(beatPosition));
            return String.format("%d:%.2f", measureBeats.getMeasureNumber(), 
                    measureBeats.getBeatNumber());
        }
        
        @Override
        public String formatCompact(double beatPosition, TimeContext context) {
            if (context == null || context.getMeterMap() == null) {
                return BEATS.formatCompact(beatPosition, context);
            }
            var meterMap = context.getMeterMap();
            var measureBeats = meterMap.toMeasureBeats(TimeUnit.beats(beatPosition));
            double beatInMeasure = measureBeats.getBeatNumber();
            if (beatInMeasure == Math.floor(beatInMeasure)) {
                return String.format("%d:%d", measureBeats.getMeasureNumber(), 
                        (int) beatInMeasure);
            }
            return String.format("%d:%.1f", measureBeats.getMeasureNumber(), 
                    beatInMeasure);
        }
    },
    
    /**
     * Clock time format in hours:minutes:seconds.milliseconds (e.g., "0:00.000").
     * Requires TempoMap context for conversion from beats to time.
     */
    TIME("Time", "0:00.000") {
        @Override
        public String format(double beatPosition, TimeContext context) {
            double seconds = beatsToSeconds(beatPosition, context);
            return formatTime(seconds);
        }
        
        @Override
        public String formatCompact(double beatPosition, TimeContext context) {
            double seconds = beatsToSeconds(beatPosition, context);
            return formatTimeCompact(seconds);
        }
        
        private String formatTime(double seconds) {
            int totalSeconds = (int) seconds;
            int minutes = totalSeconds / 60;
            int secs = totalSeconds % 60;
            int millis = (int) ((seconds - totalSeconds) * 1000);
            
            if (minutes >= 60) {
                int hours = minutes / 60;
                minutes = minutes % 60;
                return String.format("%d:%02d:%02d.%03d", hours, minutes, secs, millis);
            }
            return String.format("%d:%02d.%03d", minutes, secs, millis);
        }
        
        private String formatTimeCompact(double seconds) {
            int totalSeconds = (int) seconds;
            int minutes = totalSeconds / 60;
            int secs = totalSeconds % 60;
            
            if (minutes >= 60) {
                int hours = minutes / 60;
                minutes = minutes % 60;
                return String.format("%d:%02d:%02d", hours, minutes, secs);
            }
            return String.format("%d:%02d", minutes, secs);
        }
    },
    
    /**
     * SMPTE timecode format (e.g., "00:00:00:00" for HH:MM:SS:FF).
     * Standard frame rates: 24, 25, 29.97, 30 fps.
     */
    SMPTE("SMPTE", "00:00:00:00") {
        private static final double DEFAULT_FRAME_RATE = 30.0;
        
        @Override
        public String format(double beatPosition, TimeContext context) {
            double seconds = beatsToSeconds(beatPosition, context);
            double frameRate = getFrameRate(context);
            return formatSMPTE(seconds, frameRate);
        }
        
        @Override
        public String formatCompact(double beatPosition, TimeContext context) {
            return format(beatPosition, context);
        }
        
        private double getFrameRate(TimeContext context) {
            // TODO: Get frame rate from project settings when available
            return DEFAULT_FRAME_RATE;
        }
        
        private String formatSMPTE(double seconds, double frameRate) {
            int totalFrames = (int) (seconds * frameRate);
            int frames = (int) (totalFrames % frameRate);
            int totalSecs = totalFrames / (int) frameRate;
            int secs = totalSecs % 60;
            int mins = (totalSecs / 60) % 60;
            int hours = totalSecs / 3600;
            
            return String.format("%02d:%02d:%02d:%02d", hours, mins, secs, frames);
        }
    },
    
    /**
     * Audio sample frame number format (e.g., "0", "44100", "88200").
     * Based on project sample rate (default 44100 Hz).
     */
    SAMPLES("Samples", "0, 44100") {
        private static final int DEFAULT_SAMPLE_RATE = 44100;
        
        @Override
        public String format(double beatPosition, TimeContext context) {
            double seconds = beatsToSeconds(beatPosition, context);
            int sampleRate = getSampleRate(context);
            long samples = (long) (seconds * sampleRate);
            return String.valueOf(samples);
        }
        
        @Override
        public String formatCompact(double beatPosition, TimeContext context) {
            double seconds = beatsToSeconds(beatPosition, context);
            int sampleRate = getSampleRate(context);
            long samples = (long) (seconds * sampleRate);
            
            if (samples >= 1_000_000) {
                return String.format("%.1fM", samples / 1_000_000.0);
            } else if (samples >= 1_000) {
                return String.format("%.1fK", samples / 1_000.0);
            }
            return String.valueOf(samples);
        }
        
        private int getSampleRate(TimeContext context) {
            // TODO: Get sample rate from project settings when available
            return DEFAULT_SAMPLE_RATE;
        }
    };
    
    private final String displayName;
    private final String example;
    
    TimeDisplayFormat(String displayName, String example) {
        this.displayName = displayName;
        this.example = example;
    }
    
    /**
     * Returns the human-readable display name for this format.
     * 
     * @return the display name (e.g., "Beats", "Measures:Beats")
     */
    public String getDisplayName() {
        return displayName;
    }
    
    /**
     * Returns an example of the format for UI display.
     * 
     * @return example format string (e.g., "0.0, 4.0, 8.0")
     */
    public String getExample() {
        return example;
    }
    
    /**
     * Returns a formatted menu item string combining name and example.
     * 
     * @return formatted string for dropdown menus
     */
    public String getMenuLabel() {
        return displayName + " (" + example + ")";
    }
    
    /**
     * Formats a beat position using this format.
     * 
     * @param beatPosition the beat position to format
     * @param context the time context for conversion (may be null)
     * @return formatted string representation
     */
    public abstract String format(double beatPosition, TimeContext context);
    
    /**
     * Formats a beat position using a compact representation.
     * Useful for ruler tick labels where space is limited.
     * 
     * @param beatPosition the beat position to format
     * @param context the time context for conversion (may be null)
     * @return compact formatted string
     */
    public abstract String formatCompact(double beatPosition, TimeContext context);
    
    /**
     * Converts a beat position to seconds using the TimeContext.
     * Falls back to assuming 60 BPM if context is unavailable.
     * 
     * @param beatPosition the beat position
     * @param context the time context (may be null)
     * @return time in seconds
     */
    public static double beatsToSeconds(double beatPosition, TimeContext context) {
        if (context != null && context.getTempoMap() != null) {
            return context.getTempoMap().beatsToSeconds(beatPosition);
        }
        // Fallback: assume 60 BPM (1 beat per second)
        return beatPosition;
    }
    
    /**
     * Converts seconds to a beat position using the TimeContext.
     * Falls back to assuming 60 BPM if context is unavailable.
     * 
     * @param seconds the time in seconds
     * @param context the time context (may be null)
     * @return beat position
     */
    public static double secondsToBeats(double seconds, TimeContext context) {
        if (context != null && context.getTempoMap() != null) {
            return context.getTempoMap().secondsToBeats(seconds);
        }
        // Fallback: assume 60 BPM (1 beat per second)
        return seconds;
    }
    
    /**
     * Maps a legacy TimeState display constant to a TimeDisplayFormat.
     * 
     * @param timeStateValue the TimeState.DISPLAY_* constant
     * @return the corresponding TimeDisplayFormat
     */
    public static TimeDisplayFormat fromTimeStateValue(int timeStateValue) {
        return switch (timeStateValue) {
            case 0 -> TIME;  // DISPLAY_TIME
            case 1 -> BEATS; // DISPLAY_BEATS
            default -> BEATS;
        };
    }
    
    /**
     * Maps this format to a legacy TimeState display constant.
     * Note: Not all formats have legacy equivalents.
     * 
     * @return the TimeState.DISPLAY_* constant, or -1 if no equivalent
     */
    public int toTimeStateValue() {
        return switch (this) {
            case TIME, SMPTE -> 0;     // Maps to DISPLAY_TIME
            case BEATS, MEASURE_BEATS, SAMPLES -> 1; // Maps to DISPLAY_BEATS
        };
    }
    
    @Override
    public String toString() {
        return displayName;
    }
}
