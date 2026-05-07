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

import blue.time.TimeBase;
import blue.time.TimeContext;
import java.math.BigDecimal;
import java.math.RoundingMode;

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
    BEATS("Beats", "0.0, 4.0, 8.0", TimeBase.BEATS) {
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
     * BBT format showing Bar.Beat.Ticks (e.g., "1.1.0", "2.3.120").
     * Ardour/Qtractor style. Requires MeterMap context for proper calculation.
     */
    BBT("BBT", "1.1.0, 2.1.0", TimeBase.BBT) {
        @Override
        public String format(double beatPosition, TimeContext context) {
            if (context == null || context.getMeterMap() == null) {
                return BEATS.format(beatPosition, context);
            }
            var meterMap = context.getMeterMap();
            var bbt = meterMap.beatsToBBT(beatPosition, TimeContext.DEFAULT_PPQ);
            return bbt.toString();
        }
        
        @Override
        public String formatCompact(double beatPosition, TimeContext context) {
            if (context == null || context.getMeterMap() == null) {
                return BEATS.formatCompact(beatPosition, context);
            }
            var meterMap = context.getMeterMap();
            var bbt = meterMap.beatsToBBT(beatPosition, TimeContext.DEFAULT_PPQ);
            // Compact: show bar.beat (omit ticks if 0)
            if (bbt.getTicks() == 0) {
                return String.format("%d.%d", bbt.getBar(), bbt.getBeat());
            }
            return bbt.toString();
        }
        
        @Override
        public String formatDuration(double durationBeats, TimeContext context) {
            if (context == null || context.getMeterMap() == null) {
                return BEATS.format(durationBeats, context);
            }
            var meter = context.getMeterMap().get(0).getMeter();
            int ppq = TimeContext.DEFAULT_PPQ;
            double beatsPerBar = meter.getMeasureBeatDuration();
            double beatScale = 4.0 / meter.beatLength;
            long bars = (long) (durationBeats / beatsPerBar);
            double remainingBeats = durationBeats - (bars * beatsPerBar);
            double scaledBeat = remainingBeats / beatScale;
            int wholeBeat = (int) scaledBeat;
            double fractionalBeat = scaledBeat - wholeBeat;
            int ticks = (int) Math.round(fractionalBeat * ppq);
            if (ticks >= ppq) {
                ticks = 0;
                wholeBeat++;
            }
            return String.format("%d.%d.%d", bars, wholeBeat, ticks);
        }
    },
    
    /**
     * BBST format showing Bar.Beat.Sixteenth.Ticks (e.g., "1.1.1.0", "2.3.2.60").
     * Cubase/Reason style. Requires MeterMap context for proper calculation.
     */
    BBST("BBST", "1.1.1.0, 2.1.1.0", TimeBase.BBST) {
        @Override
        public String format(double beatPosition, TimeContext context) {
            if (context == null || context.getMeterMap() == null) {
                return BEATS.format(beatPosition, context);
            }
            var meterMap = context.getMeterMap();
            var bbst = meterMap.beatsToBBST(beatPosition, TimeContext.DEFAULT_PPQ);
            return bbst.toString();
        }
        
        @Override
        public String formatCompact(double beatPosition, TimeContext context) {
            if (context == null || context.getMeterMap() == null) {
                return BEATS.formatCompact(beatPosition, context);
            }
            var meterMap = context.getMeterMap();
            var bbst = meterMap.beatsToBBST(beatPosition, TimeContext.DEFAULT_PPQ);
            // Compact: show bar.beat.sixteenth (omit ticks if 0)
            if (bbst.getTicks() == 0) {
                return String.format("%d.%d.%d", bbst.getBar(), bbst.getBeat(), bbst.getSixteenth());
            }
            return bbst.toString();
        }
        
        @Override
        public String formatDuration(double durationBeats, TimeContext context) {
            if (context == null || context.getMeterMap() == null) {
                return BEATS.format(durationBeats, context);
            }
            var meter = context.getMeterMap().get(0).getMeter();
            int ppq = TimeContext.DEFAULT_PPQ;
            double beatsPerBar = meter.getMeasureBeatDuration();
            double beatScale = 4.0 / meter.beatLength;
            long bars = (long) (durationBeats / beatsPerBar);
            double remainingBeats = durationBeats - (bars * beatsPerBar);
            double scaledBeat = remainingBeats / beatScale;
            int wholeBeat = (int) scaledBeat;
            double fractionalBeat = scaledBeat - wholeBeat;
            int ticks = (int) Math.round(fractionalBeat * ppq);
            int sixteenthsPerBeat = ppq / 4;
            int sixteenth = 0;
            if (sixteenthsPerBeat > 0) {
                sixteenth = ticks / sixteenthsPerBeat;
                ticks = ticks % sixteenthsPerBeat;
            }
            return String.format("%d.%d.%d.%d", bars, wholeBeat, sixteenth, ticks);
        }
    },
    
    /**
     * BBF format showing Bar.Beat.Fraction (e.g., "1.1.00", "2.3.50").
     * REAPER style. Uses canonical two-digit hundredths (0-99) for sub-beat precision.
     */
    BBF("BBF", "1.1.00, 2.1.50", TimeBase.BBF) {
        @Override
        public String format(double beatPosition, TimeContext context) {
            if (context == null || context.getMeterMap() == null) {
                return BEATS.format(beatPosition, context);
            }
            var meterMap = context.getMeterMap();
            var bbf = meterMap.beatsToBBF(beatPosition);
            return bbf.toString();
        }
        
        @Override
        public String formatCompact(double beatPosition, TimeContext context) {
            if (context == null || context.getMeterMap() == null) {
                return BEATS.formatCompact(beatPosition, context);
            }
            var meterMap = context.getMeterMap();
            var bbf = meterMap.beatsToBBF(beatPosition);
            // Compact: show bar.beat (omit fraction if 0)
            if (bbf.getFraction() == 0) {
                return String.format("%d.%d", bbf.getBar(), bbf.getBeat());
            }
            return bbf.toString();
        }
        
        @Override
        public String formatDuration(double durationBeats, TimeContext context) {
            if (context == null || context.getMeterMap() == null) {
                return BEATS.format(durationBeats, context);
            }
            var meter = context.getMeterMap().get(0).getMeter();
            double beatsPerBar = meter.getMeasureBeatDuration();
            double beatScale = 4.0 / meter.beatLength;
            long bars = (long) (durationBeats / beatsPerBar);
            double remainingBeats = durationBeats - (bars * beatsPerBar);
            double scaledBeat = remainingBeats / beatScale;
            int wholeBeat = (int) scaledBeat;
            double fractionalBeat = scaledBeat - wholeBeat;
            int fraction = (int) Math.round(fractionalBeat * 100);
            if (fraction >= 100) {
                fraction = 0;
                wholeBeat++;
            }
            return String.format("%d.%d.%02d", bars, wholeBeat, fraction);
        }
    },
    
    /**
     * Clock time format in hours:minutes:seconds.milliseconds (e.g., "0:00.000").
     * Requires TempoMap context for conversion from beats to time.
     */
    TIME("Time", "0:00.000", TimeBase.TIME) {
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
        
        @Override
        public String formatDuration(double durationBeats, TimeContext context) {
            double seconds = beatsToSeconds(durationBeats, context);
            return formatTime(seconds);
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
    SMPTE("SMPTE", "00:00:00:00", TimeBase.SMPTE) {
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
            if (context != null) {
                return context.getSmpteFrameRate();
            }
            return TimeContext.DEFAULT_SMPTE_FRAME_RATE;
        }
        
        private String formatSMPTE(double seconds, double frameRate) {
            int hours = (int) (seconds / 3600);
            int mins = (int) ((seconds % 3600) / 60);
            int secs = (int) (seconds % 60);
            int frames = (int) ((seconds - (int) seconds) * frameRate);
            // Clamp frames to valid range
            int maxFrames = (int) frameRate - 1;
            if (frames > maxFrames) frames = maxFrames;
            if (frames < 0) frames = 0;
            
            return String.format("%02d:%02d:%02d:%02d", hours, mins, secs, frames);
        }
        
        @Override
        public String formatDuration(double durationBeats, TimeContext context) {
            double seconds = beatsToSeconds(durationBeats, context);
            double frameRate = getFrameRate(context);
            return formatSMPTE(seconds, frameRate);
        }
    },
    
    /**
     * Seconds format showing seconds with fractional part (e.g., "0.0", "1.5").
     * Requires TempoMap context for conversion from beats to time.
     */
    SECONDS("Seconds", "0.0, 1.5", TimeBase.SECONDS) {
        @Override
        public String format(double beatPosition, TimeContext context) {
            double seconds = beatsToSeconds(beatPosition, context);
            return formatDecimalSeconds(seconds, 3, true);
        }

        @Override
        public String formatCompact(double beatPosition, TimeContext context) {
            double seconds = beatsToSeconds(beatPosition, context);
            return formatDecimalSeconds(seconds, 3, false);
        }
        
        @Override
        public String formatDuration(double durationBeats, TimeContext context) {
            double seconds = beatsToSeconds(durationBeats, context);
            return formatDecimalSeconds(seconds, 3, true);
        }
    },
    
    /**
     * Audio sample frame number format (e.g., "0", "44100", "88200").
     * Based on project sample rate (default 44100 Hz).
     */
    SAMPLES("Samples", "0, 44100", TimeBase.FRAME) {
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
            if (context != null && context.getSampleRate() > 0) {
                return (int) context.getSampleRate();
            }
            return DEFAULT_SAMPLE_RATE;
        }
    };
    
    private final String displayName;
    private final String example;
    private final TimeBase timeBase;
    
    TimeDisplayFormat(String displayName, String example, TimeBase timeBase) {
        this.displayName = displayName;
        this.example = example;
        this.timeBase = timeBase;
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
     * Formats a duration in beats using this format.
     * For measure-based formats (BBT, BBST, BBF), uses 0-based bars and beats
     * (e.g., 6 beats in 4/4 = "1.2.00" meaning 1 bar + 2 beats).
     * For other formats, delegates to {@link #format}.
     * 
     * @param durationBeats the duration in beats to format
     * @param context the time context for conversion (may be null)
     * @return formatted duration string
     */
    public String formatDuration(double durationBeats, TimeContext context) {
        return format(durationBeats, context);
    }
    
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

    private static String formatDecimalSeconds(double seconds, int maxFractionDigits, boolean forceFractionDigit) {
        String text = BigDecimal.valueOf(seconds)
                .setScale(maxFractionDigits, RoundingMode.HALF_UP)
                .stripTrailingZeros()
                .toPlainString();
        if (forceFractionDigit && !text.contains(".")) {
            return text + ".0";
        }
        return text;
    }
    
    /**
     * Returns the TimeBase associated with this display format.
     * 
     * @return the corresponding TimeBase
     */
    public TimeBase getTimeBase() {
        return timeBase;
    }
    
    /**
     * Finds the TimeDisplayFormat for a given TimeBase.
     * 
     * @param timeBase the TimeBase to find a format for
     * @return the corresponding TimeDisplayFormat, or BEATS if not found
     */
    public static TimeDisplayFormat fromTimeBase(TimeBase timeBase) {
        if (timeBase == null) {
            return BEATS;
        }
        for (TimeDisplayFormat format : values()) {
            if (format.timeBase == timeBase) {
                return format;
            }
        }
        return BEATS;
    }
    
    @Override
    public String toString() {
        return displayName;
    }
}
