/*
 * blue - object composition environment for csound
 * Copyright (c) 2023 Steven Yi (stevenyi@gmail.com)
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

import electric.xml.Element;

/**
 * Abstract base class for time value representations.
 * 
 * TimeUnits can represent time in different formats (beats, measure/beats, 
 * clock time, frames) and are converted between formats using a 
 * TimeContext that provides meter, tempo, and sample rate information.
 * 
 * SMPTE timecode is display-only and is not a storage format.
 * See {@link blue.ui.core.score.TimeDisplayFormat#SMPTE}.
 * 
 * All TimePosition subclasses are immutable value objects.
 *
 * @author Steven Yi
 */
public abstract class TimePosition {
    
    /**
     * Returns the TimeBase type of this TimePosition.
     * 
     * @return the TimeBase enum value corresponding to this TimePosition type
     */
    public abstract TimeBase getTimeBase();
    
    // ========== Conversion Methods ==========
    
    /**
     * Converts this TimePosition to Csound beats using the provided TimeContext.
     * TimeContext is the first parameter for consistency across all context-dependent methods.
     * 
     * @param context the TimeContext providing meter, tempo, and sample rate information
     * @return the time value in Csound beats (quarter note = 1 beat)
     */
    public abstract double toBeats(TimeContext context);
    
    /**
     * Converts this TimePosition to seconds using the provided TimeContext.
     * TimeContext is the first parameter for consistency across all context-dependent methods.
     * 
     * @param context the TimeContext providing meter, tempo, and sample rate information
     * @return the time value in seconds
     */
    public abstract double toSeconds(TimeContext context);
    
    /**
     * Converts this TimePosition to audio sample frames using the provided TimeContext.
     * TimeContext is the first parameter for consistency across all context-dependent methods.
     * 
     * @param context the TimeContext providing meter, tempo, and sample rate information
     * @return the time value in audio sample frames
     */
    public abstract long toFrames(TimeContext context);
    
    // ========== Comparison Methods ==========
    
    /**
     * Returns true if this TimePosition is less than the other TimePosition.
     * TimeContext is the first parameter for consistency.
     * 
     * @param context the TimeContext for conversion
     * @param other the TimePosition to compare against
     * @return true if this < other
     */
    public boolean lt(TimeContext context, TimePosition other) {
        return this.toBeats(context) < other.toBeats(context);
    }
    
    /**
     * Returns true if this TimePosition is greater than the other TimePosition.
     * TimeContext is the first parameter for consistency.
     * 
     * @param context the TimeContext for conversion
     * @param other the TimePosition to compare against
     * @return true if this > other
     */
    public boolean gt(TimeContext context, TimePosition other) {
        return this.toBeats(context) > other.toBeats(context);
    }
    
    /**
     * Returns true if this TimePosition is less than or equal to the other TimePosition.
     * TimeContext is the first parameter for consistency.
     * 
     * @param context the TimeContext for conversion
     * @param other the TimePosition to compare against
     * @return true if this <= other
     */
    public boolean lte(TimeContext context, TimePosition other) {
        return this.toBeats(context) <= other.toBeats(context);
    }
    
    /**
     * Returns true if this TimePosition is greater than or equal to the other TimePosition.
     * TimeContext is the first parameter for consistency.
     * 
     * @param context the TimeContext for conversion
     * @param other the TimePosition to compare against
     * @return true if this >= other
     */
    public boolean gte(TimeContext context, TimePosition other) {
        return this.toBeats(context) >= other.toBeats(context);
    }
    

    public static BeatTime beats(double csoundBeats) {
        return new BeatTime(csoundBeats);
    }

    public static BBTTime bbt(long bar, int beat, int ticks) {
        return new BBTTime(bar, beat, ticks);
    }
    
    public static BBSTTime bbst(long bar, int beat, int sixteenth, int ticks) {
        return new BBSTTime(bar, beat, sixteenth, ticks);
    }
    
    public static BBFTime bbf(long bar, int beat, int fraction) {
        return new BBFTime(bar, beat, fraction);
    }

    /**
     * Absolute time representation using Csound beats (quarter note = 1 beat).
     * Independent of meter structure.
     * 
     * This is an immutable value object.
     */
    public static final class BeatTime extends TimePosition {
        
        public static final BeatTime ZERO = new BeatTime(0.0);
        
        private final double csoundBeats;

        public BeatTime(double csoundBeats) {
            this.csoundBeats = csoundBeats;
        }

        public BeatTime(BeatTime beatTime) {
            this.csoundBeats = beatTime.csoundBeats;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.CSOUND_BEATS;
        }

        public double getCsoundBeats() {
            return csoundBeats;
        }
        
        // Conversion methods
        
        @Override
        public double toBeats(TimeContext context) {
            return csoundBeats;
        }
        
        @Override
        public double toSeconds(TimeContext context) {
            return context.getTempoMap().beatsToSeconds(csoundBeats);
        }
        
        @Override
        public long toFrames(TimeContext context) {
            double seconds = toSeconds(context);
            return Math.round(seconds * context.getSampleRate());
        }
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof BeatTime)) return false;
            BeatTime that = (BeatTime) o;
            return Double.compare(that.csoundBeats, csoundBeats) == 0;
        }
        
        @Override
        public int hashCode() {
            return Double.hashCode(csoundBeats);
        }
        
        @Override
        public String toString() {
            return String.format("BeatTime[%.3f beats]", csoundBeats);
        }

    }

    /**
     * BBT (Bars.Beats.Ticks) time representation.
     * Uses PPQ-based ticks for sub-beat precision.
     * Matches Ardour/Qtractor style.
     * 
     * Bar and beat numbers are 1-based.
     * Ticks range from 0 to PPQ-1 (0-959 at PPQ=960).
     * PPQ is hardcoded at 960 via {@link TimeContext#DEFAULT_PPQ}.
     * 
     * This is an immutable value object.
     */
    public static final class BBTTime extends TimePosition {
        
        public static final BBTTime ZERO = new BBTTime(1, 1, 0);
        
        private final long bar;
        private final int beat;
        private final int ticks;

        public BBTTime(long bar, int beat, int ticks) {
            if (bar < 1) {
                throw new IllegalArgumentException("Bar must be >= 1, got: " + bar);
            }
            if (beat < 1) {
                throw new IllegalArgumentException("Beat must be >= 1, got: " + beat);
            }
            if (ticks < 0) {
                throw new IllegalArgumentException("Ticks must be >= 0, got: " + ticks);
            }
            this.bar = bar;
            this.beat = beat;
            this.ticks = ticks;
        }

        public BBTTime(BBTTime bbtTime) {
            this.bar = bbtTime.bar;
            this.beat = bbtTime.beat;
            this.ticks = bbtTime.ticks;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.BBT;
        }

        public long getBar() {
            return bar;
        }

        public int getBeat() {
            return beat;
        }
        
        public int getTicks() {
            return ticks;
        }
        
        // Conversion methods
        
        @Override
        public double toBeats(TimeContext context) {
            // Get the absolute beat position for bar:beat from MeterMap
            double absoluteBeats = context.getMeterMap().barBeatToBeats(bar, beat);
            // Add tick fraction
            return absoluteBeats + (ticks / (double) TimeContext.DEFAULT_PPQ);
        }
        
        @Override
        public double toSeconds(TimeContext context) {
            double beats = toBeats(context);
            return context.getTempoMap().beatsToSeconds(beats);
        }
        
        @Override
        public long toFrames(TimeContext context) {
            double seconds = toSeconds(context);
            return Math.round(seconds * context.getSampleRate());
        }
        
        /**
         * Convert to BBST format.
         * @param ppq the PPQ value for tick calculation
         * @return equivalent BBSTTime
         */
        public BBSTTime toBBST(int ppq) {
            int ticksPerSixteenth = ppq / 4;
            int sixteenth = (ticks / ticksPerSixteenth) + 1;
            int subTicks = ticks % ticksPerSixteenth;
            return new BBSTTime(bar, beat, sixteenth, subTicks);
        }
        
        /**
         * Convert to BBF format.
         * @param ppq the PPQ value for fraction calculation
         * @return equivalent BBFTime
         */
        public BBFTime toBBF(int ppq) {
            int fraction = (ticks * 100) / ppq;
            return new BBFTime(bar, beat, fraction);
        }
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof BBTTime)) return false;
            BBTTime that = (BBTTime) o;
            return bar == that.bar && beat == that.beat && ticks == that.ticks;
        }
        
        @Override
        public int hashCode() {
            int result = Long.hashCode(bar);
            result = 31 * result + beat;
            result = 31 * result + ticks;
            return result;
        }
        
        @Override
        public String toString() {
            return String.format("%d.%d.%d", bar, beat, ticks);
        }
    }

    /**
     * BBST (Bars.Beats.Sixteenths.Ticks) time representation.
     * Uses sixteenth-note subdivisions with PPQ-based sub-ticks.
     * Matches Cubase/Reason style.
     * 
     * Bar and beat numbers are 1-based.
     * Sixteenth is 1-4 (which 16th note within the beat).
     * Ticks range from 0 to (PPQ/4)-1 (0-239 at PPQ=960).
     * PPQ is hardcoded at 960 via {@link TimeContext#DEFAULT_PPQ}.
     * 
     * This is an immutable value object.
     */
    public static final class BBSTTime extends TimePosition {
        
        public static final BBSTTime ZERO = new BBSTTime(1, 1, 1, 0);
        
        private final long bar;
        private final int beat;
        private final int sixteenth;
        private final int ticks;

        public BBSTTime(long bar, int beat, int sixteenth, int ticks) {
            if (bar < 1) {
                throw new IllegalArgumentException("Bar must be >= 1, got: " + bar);
            }
            if (beat < 1) {
                throw new IllegalArgumentException("Beat must be >= 1, got: " + beat);
            }
            if (sixteenth < 1 || sixteenth > 4) {
                throw new IllegalArgumentException("Sixteenth must be 1-4, got: " + sixteenth);
            }
            if (ticks < 0) {
                throw new IllegalArgumentException("Ticks must be >= 0, got: " + ticks);
            }
            this.bar = bar;
            this.beat = beat;
            this.sixteenth = sixteenth;
            this.ticks = ticks;
        }

        public BBSTTime(BBSTTime bbstTime) {
            this.bar = bbstTime.bar;
            this.beat = bbstTime.beat;
            this.sixteenth = bbstTime.sixteenth;
            this.ticks = bbstTime.ticks;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.BBST;
        }

        public long getBar() {
            return bar;
        }

        public int getBeat() {
            return beat;
        }
        
        public int getSixteenth() {
            return sixteenth;
        }
        
        public int getTicks() {
            return ticks;
        }
        
        /**
         * Convert to total ticks within the beat (0 to PPQ-1).
         * @param ppq the PPQ value
         * @return total ticks
         */
        public int toTotalTicks(int ppq) {
            int ticksPerSixteenth = ppq / 4;
            return (sixteenth - 1) * ticksPerSixteenth + ticks;
        }
        
        // Conversion methods
        
        @Override
        public double toBeats(TimeContext context) {
            int ppq = TimeContext.DEFAULT_PPQ;
            int totalTicks = toTotalTicks(ppq);
            double absoluteBeats = context.getMeterMap().barBeatToBeats(bar, beat);
            return absoluteBeats + (totalTicks / (double) ppq);
        }
        
        @Override
        public double toSeconds(TimeContext context) {
            double beats = toBeats(context);
            return context.getTempoMap().beatsToSeconds(beats);
        }
        
        @Override
        public long toFrames(TimeContext context) {
            double seconds = toSeconds(context);
            return Math.round(seconds * context.getSampleRate());
        }
        
        /**
         * Convert to BBT format.
         * @param ppq the PPQ value for tick calculation
         * @return equivalent BBTTime
         */
        public BBTTime toBBT(int ppq) {
            int totalTicks = toTotalTicks(ppq);
            return new BBTTime(bar, beat, totalTicks);
        }
        
        /**
         * Convert to BBF format.
         * @param ppq the PPQ value for fraction calculation
         * @return equivalent BBFTime
         */
        public BBFTime toBBF(int ppq) {
            int totalTicks = toTotalTicks(ppq);
            int fraction = (totalTicks * 100) / ppq;
            return new BBFTime(bar, beat, fraction);
        }
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof BBSTTime)) return false;
            BBSTTime that = (BBSTTime) o;
            return bar == that.bar && beat == that.beat && 
                   sixteenth == that.sixteenth && ticks == that.ticks;
        }
        
        @Override
        public int hashCode() {
            int result = Long.hashCode(bar);
            result = 31 * result + beat;
            result = 31 * result + sixteenth;
            result = 31 * result + ticks;
            return result;
        }
        
        @Override
        public String toString() {
            return String.format("%d.%d.%d.%d", bar, beat, sixteenth, ticks);
        }
    }

    /**
     * BBF (Bars.Beats.Fraction) time representation.
     * Uses percentage-based fraction for sub-beat precision.
     * Matches REAPER style.
     * 
     * Bar and beat numbers are 1-based.
     * Fraction is 0-99 (percentage of beat).
     * 
     * This is an immutable value object.
     */
    public static final class BBFTime extends TimePosition {
        
        public static final BBFTime ZERO = new BBFTime(1, 1, 0);
        
        private final long bar;
        private final int beat;
        private final int fraction;

        public BBFTime(long bar, int beat, int fraction) {
            if (bar < 1) {
                throw new IllegalArgumentException("Bar must be >= 1, got: " + bar);
            }
            if (beat < 1) {
                throw new IllegalArgumentException("Beat must be >= 1, got: " + beat);
            }
            if (fraction < 0 || fraction > 99) {
                throw new IllegalArgumentException("Fraction must be 0-99, got: " + fraction);
            }
            this.bar = bar;
            this.beat = beat;
            this.fraction = fraction;
        }

        public BBFTime(BBFTime bbfTime) {
            this.bar = bbfTime.bar;
            this.beat = bbfTime.beat;
            this.fraction = bbfTime.fraction;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.BBF;
        }

        public long getBar() {
            return bar;
        }

        public int getBeat() {
            return beat;
        }
        
        public int getFraction() {
            return fraction;
        }
        
        // Conversion methods
        
        @Override
        public double toBeats(TimeContext context) {
            double absoluteBeats = context.getMeterMap().barBeatToBeats(bar, beat);
            return absoluteBeats + (fraction / 100.0);
        }
        
        @Override
        public double toSeconds(TimeContext context) {
            double beats = toBeats(context);
            return context.getTempoMap().beatsToSeconds(beats);
        }
        
        @Override
        public long toFrames(TimeContext context) {
            double seconds = toSeconds(context);
            return Math.round(seconds * context.getSampleRate());
        }
        
        /**
         * Convert to BBT format.
         * @param ppq the PPQ value for tick calculation
         * @return equivalent BBTTime
         */
        public BBTTime toBBT(int ppq) {
            int ticks = (fraction * ppq) / 100;
            return new BBTTime(bar, beat, ticks);
        }
        
        /**
         * Convert to BBST format.
         * @param ppq the PPQ value for tick calculation
         * @return equivalent BBSTTime
         */
        public BBSTTime toBBST(int ppq) {
            int totalTicks = (fraction * ppq) / 100;
            int ticksPerSixteenth = ppq / 4;
            int sixteenth = (totalTicks / ticksPerSixteenth) + 1;
            int subTicks = totalTicks % ticksPerSixteenth;
            return new BBSTTime(bar, beat, sixteenth, subTicks);
        }
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof BBFTime)) return false;
            BBFTime that = (BBFTime) o;
            return bar == that.bar && beat == that.beat && fraction == that.fraction;
        }
        
        @Override
        public int hashCode() {
            int result = Long.hashCode(bar);
            result = 31 * result + beat;
            result = 31 * result + fraction;
            return result;
        }
        
        @Override
        public String toString() {
            return String.format("%d.%d.%02d", bar, beat, fraction);
        }
    }

    /**
     * Clock time representation using hours, minutes, seconds, and milliseconds.
     * Independent of tempo and meter - represents absolute wall-clock time.
     * 
     * This is an immutable value object.
     */
    public static final class TimeValue extends TimePosition {
        
        public static final TimeValue ZERO = new TimeValue(0, 0, 0, 0);
        
        private final long hours;
        private final long minutes;
        private final long seconds;
        private final long milliseconds;
        
        public TimeValue(long hours, long minutes, long seconds, long milliseconds) {
            if (hours < 0) {
                throw new IllegalArgumentException("Hours cannot be negative: " + hours);
            }
            if (minutes < 0 || minutes >= 60) {
                throw new IllegalArgumentException("Minutes must be 0-59, got: " + minutes);
            }
            if (seconds < 0 || seconds >= 60) {
                throw new IllegalArgumentException("Seconds must be 0-59, got: " + seconds);
            }
            if (milliseconds < 0 || milliseconds >= 1000) {
                throw new IllegalArgumentException("Milliseconds must be 0-999, got: " + milliseconds);
            }
            this.hours = hours;
            this.minutes = minutes;
            this.seconds = seconds;
            this.milliseconds = milliseconds;
        }
        
        public TimeValue(TimeValue timeValue) {
            this.hours = timeValue.hours;
            this.minutes = timeValue.minutes;
            this.seconds = timeValue.seconds;
            this.milliseconds = timeValue.milliseconds;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.TIME;
        }
        
        public long getHours() {
            return hours;
        }
        
        public long getMinutes() {
            return minutes;
        }
        
        public long getSeconds() {
            return seconds;
        }
        
        public long getMilliseconds() {
            return milliseconds;
        }
        
        /**
         * Converts this time value to total seconds.
         * @return total seconds as a double
         */
        public double toTotalSeconds() {
            return hours * 3600.0 + minutes * 60.0 + seconds + milliseconds / 1000.0;
        }
        
        // Conversion methods
        
        @Override
        public double toBeats(TimeContext context) {
            double seconds = toTotalSeconds();
            return context.getTempoMap().secondsToBeats(seconds);
        }
        
        @Override
        public double toSeconds(TimeContext context) {
            return toTotalSeconds();
        }
        
        @Override
        public long toFrames(TimeContext context) {
            double seconds = toTotalSeconds();
            return Math.round(seconds * context.getSampleRate());
        }
        
    }

    /**
     * Audio sample frame number representation.
     * Requires sample rate from TimeContext for conversion to time.
     * 
     * This is an immutable value object.
     */
    public static final class FrameValue extends TimePosition {
        
        public static final FrameValue ZERO = new FrameValue(0);
        
        private final long frameNumber;
        
        public FrameValue(long frameNumber) {
            if (frameNumber < 0) {
                throw new IllegalArgumentException("Frame number cannot be negative: " + frameNumber);
            }
            this.frameNumber = frameNumber;
        }
        
        public FrameValue(FrameValue frameValue) {
            this.frameNumber = frameValue.frameNumber;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.FRAME;
        }
        
        public long getFrameNumber() {
            return frameNumber;
        }
        
        /**
         * Converts this frame number to seconds using the given sample rate.
         * @param sampleRate the audio sample rate (e.g., 44100, 48000)
         * @return time in seconds
         */
        public double toTotalSeconds(long sampleRate) {
            if (sampleRate <= 0) {
                throw new IllegalArgumentException("Sample rate must be positive: " + sampleRate);
            }
            return frameNumber / (double) sampleRate;
        }
        
        // Conversion methods
        
        @Override
        public double toBeats(TimeContext context) {
            double seconds = toTotalSeconds(context.getSampleRate());
            return context.getTempoMap().secondsToBeats(seconds);
        }
        
        @Override
        public double toSeconds(TimeContext context) {
            return toTotalSeconds(context.getSampleRate());
        }
        
        @Override
        public long toFrames(TimeContext context) {
            return frameNumber;
        }
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof FrameValue)) return false;
            FrameValue that = (FrameValue) o;
            return frameNumber == that.frameNumber;
        }
        
        @Override
        public int hashCode() {
            return Long.hashCode(frameNumber);
        }
        
        @Override
        public String toString() {
            return String.format("FrameValue[%d frames]", frameNumber);
        }
    }

    // Static factory methods for new TimePosition types
    
    public static TimeValue time(long hours, long minutes, long seconds, long milliseconds) {
        return new TimeValue(hours, minutes, seconds, milliseconds);
    }
    
    public static FrameValue frames(long frameNumber) {
        return new FrameValue(frameNumber);
    }

    // ========== XML Serialization ==========
    
    /**
     * Saves this TimePosition as an XML Element.
     * 
     * @return XML Element representing this TimePosition
     */
    public Element saveAsXML() {
        Element element = new Element("timePosition");
        element.setAttribute("type", this.getClass().getSimpleName());
        
        if (this instanceof BeatTime) {
            BeatTime bt = (BeatTime) this;
            element.addElement("csoundBeats").setText(Double.toString(bt.getCsoundBeats()));
        } else if (this instanceof BBTTime) {
            BBTTime bbt = (BBTTime) this;
            element.addElement("bar").setText(Long.toString(bbt.getBar()));
            element.addElement("beat").setText(Integer.toString(bbt.getBeat()));
            element.addElement("ticks").setText(Integer.toString(bbt.getTicks()));
        } else if (this instanceof BBSTTime) {
            BBSTTime bbst = (BBSTTime) this;
            element.addElement("bar").setText(Long.toString(bbst.getBar()));
            element.addElement("beat").setText(Integer.toString(bbst.getBeat()));
            element.addElement("sixteenth").setText(Integer.toString(bbst.getSixteenth()));
            element.addElement("ticks").setText(Integer.toString(bbst.getTicks()));
        } else if (this instanceof BBFTime) {
            BBFTime bbf = (BBFTime) this;
            element.addElement("bar").setText(Long.toString(bbf.getBar()));
            element.addElement("beat").setText(Integer.toString(bbf.getBeat()));
            element.addElement("fraction").setText(Integer.toString(bbf.getFraction()));
        } else if (this instanceof TimeValue) {
            TimeValue tv = (TimeValue) this;
            element.addElement("hours").setText(Long.toString(tv.getHours()));
            element.addElement("minutes").setText(Long.toString(tv.getMinutes()));
            element.addElement("seconds").setText(Long.toString(tv.getSeconds()));
            element.addElement("milliseconds").setText(Long.toString(tv.getMilliseconds()));
        } else if (this instanceof FrameValue) {
            FrameValue fv = (FrameValue) this;
            element.addElement("frameNumber").setText(Long.toString(fv.getFrameNumber()));
        }
        
        return element;
    }
    
    /**
     * Loads a TimePosition from an XML Element.
     * 
     * @param element XML Element containing TimePosition data
     * @return the loaded TimePosition
     * @throws Exception if the XML is invalid or type is unknown
     */
    public static TimePosition loadFromXML(Element element) throws Exception {
        String type = element.getAttributeValue("type");
        
        if (type == null) {
            throw new Exception("TimePosition XML missing 'type' attribute");
        }
        
        return switch (type) {
            case "BeatTime" -> {
                double csoundBeats = Double.parseDouble(element.getTextString("csoundBeats"));
                yield new BeatTime(csoundBeats);
            }
            case "BBTTime" -> {
                long bar = Long.parseLong(element.getTextString("bar"));
                int beat = Integer.parseInt(element.getTextString("beat"));
                int ticks = Integer.parseInt(element.getTextString("ticks"));
                yield new BBTTime(bar, beat, ticks);
            }
            case "BBSTTime" -> {
                long bar = Long.parseLong(element.getTextString("bar"));
                int beat = Integer.parseInt(element.getTextString("beat"));
                int sixteenth = Integer.parseInt(element.getTextString("sixteenth"));
                int ticks = Integer.parseInt(element.getTextString("ticks"));
                yield new BBSTTime(bar, beat, sixteenth, ticks);
            }
            case "BBFTime" -> {
                long bar = Long.parseLong(element.getTextString("bar"));
                int beat = Integer.parseInt(element.getTextString("beat"));
                int fraction = Integer.parseInt(element.getTextString("fraction"));
                yield new BBFTime(bar, beat, fraction);
            }
            case "TimeValue" -> {
                long hours = Long.parseLong(element.getTextString("hours"));
                long minutes = Long.parseLong(element.getTextString("minutes"));
                long seconds = Long.parseLong(element.getTextString("seconds"));
                long milliseconds = Long.parseLong(element.getTextString("milliseconds"));
                yield new TimeValue(hours, minutes, seconds, milliseconds);
            }
            case "FrameValue" -> {
                long frameNumber = Long.parseLong(element.getTextString("frameNumber"));
                yield new FrameValue(frameNumber);
            }
            default -> throw new Exception("Unknown TimePosition type: " + type);
        };
    }

}
