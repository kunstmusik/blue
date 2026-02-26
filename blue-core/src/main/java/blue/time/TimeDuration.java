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

import electric.xml.Element;

/**
 * Abstract base class for time duration representations.
 * 
 * Unlike {@link TimePosition} which represents absolute timeline positions (1-based
 * bars/beats for measure formats), TimeDuration represents time distances or
 * offsets (0-based bars/beats for measure formats).
 * 
 * Inspired by Ardour's separation of {@code BBT_Time} (position, 1-based) and
 * {@code BBT_Offset} (duration, 0-based), and the higher-level {@code timepos_t}
 * vs {@code timecnt_t} distinction.
 * 
 * All TimeDuration subclasses are immutable value objects.
 *
 * @author Steven Yi
 */
public abstract class TimeDuration {
    
    /**
     * Returns the TimeBase type of this TimeDuration.
     * 
     * @return the TimeBase enum value corresponding to this TimeDuration type
     */
    public abstract TimeBase getTimeBase();
    
    // ========== Conversion Methods ==========
    
    /**
     * Converts this TimeDuration to Csound beats using the provided TimeContext.
     * For duration, this represents a time distance rather than an absolute position.
     * 
     * @param context the TimeContext providing meter, tempo, and sample rate information
     * @return the duration in Csound beats (quarter note = 1 beat)
     */
    public abstract double toBeats(TimeContext context);
    
    /**
     * Converts this TimeDuration to seconds using the provided TimeContext.
     * 
     * @param context the TimeContext providing meter, tempo, and sample rate information
     * @return the duration in seconds
     */
    public abstract double toSeconds(TimeContext context);
    
    /**
     * Converts this TimeDuration to audio sample frames using the provided TimeContext.
     * 
     * @param context the TimeContext providing meter, tempo, and sample rate information
     * @return the duration in audio sample frames
     */
    public abstract long toFrames(TimeContext context);
    
    // ========== Factory Methods ==========

    public static DurationBeats beats(double csoundBeats) {
        return new DurationBeats(csoundBeats);
    }

    public static DurationBBT bbt(long bars, int beats, int ticks) {
        return new DurationBBT(bars, beats, ticks);
    }
    
    public static DurationBBST bbst(long bars, int beats, int sixteenth, int ticks) {
        return new DurationBBST(bars, beats, sixteenth, ticks);
    }
    
    public static DurationBBF bbf(long bars, int beats, int fraction) {
        return new DurationBBF(bars, beats, fraction);
    }

    public static DurationTime time(long hours, long minutes, long seconds, long milliseconds) {
        return new DurationTime(hours, minutes, seconds, milliseconds);
    }

    /**
     * Creates a DurationTime from a total seconds value.
     * Converts the seconds into hours, minutes, seconds, and milliseconds components.
     *
     * @param totalSeconds the duration in seconds (must be >= 0)
     * @return a DurationTime representing the given seconds
     */
    public static DurationTime fromSeconds(double totalSeconds) {
        if (totalSeconds < 0) {
            totalSeconds = 0;
        }
        long totalMs = Math.round(totalSeconds * 1000.0);
        long hours = totalMs / 3_600_000;
        long minutes = (totalMs % 3_600_000) / 60_000;
        long seconds = (totalMs % 60_000) / 1_000;
        long ms = totalMs % 1_000;
        return new DurationTime(hours, minutes, seconds, ms);
    }

    public static DurationFrames frames(long frameNumber) {
        return new DurationFrames(frameNumber);
    }

    // ========== Duration Subtypes ==========

    /**
     * Duration in Csound beats (quarter note = 1 beat).
     * Semantically identical to BeatTime for position — 0.0 means zero duration.
     * 
     * This is an immutable value object.
     */
    public static final class DurationBeats extends TimeDuration {
        
        public static final DurationBeats ZERO = new DurationBeats(0.0);
        
        private final double csoundBeats;

        public DurationBeats(double csoundBeats) {
            if (csoundBeats < 0) {
                throw new IllegalArgumentException("Duration beats cannot be negative: " + csoundBeats);
            }
            this.csoundBeats = csoundBeats;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.BEATS;
        }

        public double getCsoundBeats() {
            return csoundBeats;
        }
        
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
            if (!(o instanceof DurationBeats)) return false;
            DurationBeats that = (DurationBeats) o;
            return Double.compare(that.csoundBeats, csoundBeats) == 0;
        }
        
        @Override
        public int hashCode() {
            return Double.hashCode(csoundBeats);
        }
        
        @Override
        public String toString() {
            return String.format("DurationBeats[%.3f beats]", csoundBeats);
        }
    }

    /**
     * Duration in BBT (Bars.Beats.Ticks) format.
     * 0-based: bars >= 0, beats >= 0. Zero duration is 0|0|0.
     * 
     * Unlike position BBTTime (1-based, bar >= 1, beat >= 1), this represents
     * a time distance. For example, "1 bar and 2 beats" is DurationBBT(1, 2, 0).
     * 
     * This is an immutable value object.
     */
    public static final class DurationBBT extends TimeDuration {
        
        public static final DurationBBT ZERO = new DurationBBT(0, 0, 0);
        
        private final long bars;
        private final int beats;
        private final int ticks;

        public DurationBBT(long bars, int beats, int ticks) {
            if (bars < 0) {
                throw new IllegalArgumentException("Bars must be >= 0, got: " + bars);
            }
            if (beats < 0) {
                throw new IllegalArgumentException("Beats must be >= 0, got: " + beats);
            }
            if (ticks < 0) {
                throw new IllegalArgumentException("Ticks must be >= 0, got: " + ticks);
            }
            this.bars = bars;
            this.beats = beats;
            this.ticks = ticks;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.BBT;
        }

        public long getBars() {
            return bars;
        }

        public int getBeats() {
            return beats;
        }
        
        public int getTicks() {
            return ticks;
        }
        
        @Override
        public double toBeats(TimeContext context) {
            var meter = context.getMeterMap().get(0).getMeter();
            double beatsPerBar = meter.getMeasureBeatDuration();
            double beatScale = 4.0 / meter.beatLength;
            return (bars * beatsPerBar) + (beats * beatScale) + (ticks / (double) TimeContext.DEFAULT_PPQ);
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
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof DurationBBT)) return false;
            DurationBBT that = (DurationBBT) o;
            return bars == that.bars && beats == that.beats && ticks == that.ticks;
        }
        
        @Override
        public int hashCode() {
            int result = Long.hashCode(bars);
            result = 31 * result + beats;
            result = 31 * result + ticks;
            return result;
        }
        
        @Override
        public String toString() {
            return String.format("%d.%d.%d", bars, beats, ticks);
        }
    }

    /**
     * Duration in BBST (Bars.Beats.Sixteenths.Ticks) format.
     * 0-based: bars >= 0, beats >= 0, sixteenth >= 0.
     * 
     * Unlike position BBSTTime (1-based), this represents a time distance.
     * Sixteenth is 0-3 (which 16th note within the beat).
     * 
     * This is an immutable value object.
     */
    public static final class DurationBBST extends TimeDuration {
        
        public static final DurationBBST ZERO = new DurationBBST(0, 0, 0, 0);
        
        private final long bars;
        private final int beats;
        private final int sixteenth;
        private final int ticks;

        public DurationBBST(long bars, int beats, int sixteenth, int ticks) {
            if (bars < 0) {
                throw new IllegalArgumentException("Bars must be >= 0, got: " + bars);
            }
            if (beats < 0) {
                throw new IllegalArgumentException("Beats must be >= 0, got: " + beats);
            }
            if (sixteenth < 0 || sixteenth > 3) {
                throw new IllegalArgumentException("Sixteenth must be 0-3, got: " + sixteenth);
            }
            if (ticks < 0) {
                throw new IllegalArgumentException("Ticks must be >= 0, got: " + ticks);
            }
            this.bars = bars;
            this.beats = beats;
            this.sixteenth = sixteenth;
            this.ticks = ticks;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.BBST;
        }

        public long getBars() {
            return bars;
        }

        public int getBeats() {
            return beats;
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
            return sixteenth * ticksPerSixteenth + ticks;
        }
        
        @Override
        public double toBeats(TimeContext context) {
            var meter = context.getMeterMap().get(0).getMeter();
            double beatsPerBar = meter.getMeasureBeatDuration();
            double beatScale = 4.0 / meter.beatLength;
            int totalTicks = toTotalTicks(TimeContext.DEFAULT_PPQ);
            return (bars * beatsPerBar) + (beats * beatScale) + (totalTicks / (double) TimeContext.DEFAULT_PPQ);
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
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof DurationBBST)) return false;
            DurationBBST that = (DurationBBST) o;
            return bars == that.bars && beats == that.beats && 
                   sixteenth == that.sixteenth && ticks == that.ticks;
        }
        
        @Override
        public int hashCode() {
            int result = Long.hashCode(bars);
            result = 31 * result + beats;
            result = 31 * result + sixteenth;
            result = 31 * result + ticks;
            return result;
        }
        
        @Override
        public String toString() {
            return String.format("%d.%d.%d.%d", bars, beats, sixteenth, ticks);
        }
    }

    /**
     * Duration in BBF (Bars.Beats.Fraction) format.
     * 0-based: bars >= 0, beats >= 0. Zero duration is 0.0.00.
     * 
     * Unlike position BBFTime (1-based), this represents a time distance.
     * Fraction is 0-99 (percentage of beat).
     * 
     * This is an immutable value object.
     */
    public static final class DurationBBF extends TimeDuration {
        
        public static final DurationBBF ZERO = new DurationBBF(0, 0, 0);
        
        private final long bars;
        private final int beats;
        private final int fraction;

        public DurationBBF(long bars, int beats, int fraction) {
            if (bars < 0) {
                throw new IllegalArgumentException("Bars must be >= 0, got: " + bars);
            }
            if (beats < 0) {
                throw new IllegalArgumentException("Beats must be >= 0, got: " + beats);
            }
            if (fraction < 0 || fraction > 99) {
                throw new IllegalArgumentException("Fraction must be 0-99, got: " + fraction);
            }
            this.bars = bars;
            this.beats = beats;
            this.fraction = fraction;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.BBF;
        }

        public long getBars() {
            return bars;
        }

        public int getBeats() {
            return beats;
        }
        
        public int getFraction() {
            return fraction;
        }
        
        @Override
        public double toBeats(TimeContext context) {
            var meter = context.getMeterMap().get(0).getMeter();
            double beatsPerBar = meter.getMeasureBeatDuration();
            double beatScale = 4.0 / meter.beatLength;
            return (bars * beatsPerBar) + (beats * beatScale) + (fraction / 100.0);
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
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof DurationBBF)) return false;
            DurationBBF that = (DurationBBF) o;
            return bars == that.bars && beats == that.beats && fraction == that.fraction;
        }
        
        @Override
        public int hashCode() {
            int result = Long.hashCode(bars);
            result = 31 * result + beats;
            result = 31 * result + fraction;
            return result;
        }
        
        @Override
        public String toString() {
            return String.format("%d.%d.%02d", bars, beats, fraction);
        }
    }

    /**
     * Duration in clock time (hours, minutes, seconds, milliseconds).
     * Semantically identical to TimeValue for position — 0 means zero duration.
     * 
     * This is an immutable value object.
     */
    public static final class DurationTime extends TimeDuration {
        
        public static final DurationTime ZERO = new DurationTime(0, 0, 0, 0);
        
        private final long hours;
        private final long minutes;
        private final long seconds;
        private final long milliseconds;
        
        public DurationTime(long hours, long minutes, long seconds, long milliseconds) {
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
        
        public double toTotalSeconds() {
            return hours * 3600.0 + minutes * 60.0 + seconds + milliseconds / 1000.0;
        }
        
        @Override
        public double toBeats(TimeContext context) {
            double secs = toTotalSeconds();
            return context.getTempoMap().secondsToBeats(secs);
        }
        
        @Override
        public double toSeconds(TimeContext context) {
            return toTotalSeconds();
        }
        
        @Override
        public long toFrames(TimeContext context) {
            double secs = toTotalSeconds();
            return Math.round(secs * context.getSampleRate());
        }
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof DurationTime)) return false;
            DurationTime that = (DurationTime) o;
            return hours == that.hours && minutes == that.minutes && 
                   seconds == that.seconds && milliseconds == that.milliseconds;
        }
        
        @Override
        public int hashCode() {
            int result = Long.hashCode(hours);
            result = 31 * result + Long.hashCode(minutes);
            result = 31 * result + Long.hashCode(seconds);
            result = 31 * result + Long.hashCode(milliseconds);
            return result;
        }
        
        @Override
        public String toString() {
            return String.format("DurationTime[%02d:%02d:%02d.%03d]", hours, minutes, seconds, milliseconds);
        }
    }

    /**
     * Duration in audio sample frames.
     * Requires sample rate from TimeContext for conversion to time.
     * 
     * This is an immutable value object.
     */
    public static final class DurationFrames extends TimeDuration {
        
        public static final DurationFrames ZERO = new DurationFrames(0);
        
        private final long frameCount;
        
        public DurationFrames(long frameCount) {
            if (frameCount < 0) {
                throw new IllegalArgumentException("Frame count cannot be negative: " + frameCount);
            }
            this.frameCount = frameCount;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.FRAME;
        }
        
        public long getFrameCount() {
            return frameCount;
        }
        
        public double toTotalSeconds(long sampleRate) {
            if (sampleRate <= 0) {
                throw new IllegalArgumentException("Sample rate must be positive: " + sampleRate);
            }
            return frameCount / (double) sampleRate;
        }
        
        @Override
        public double toBeats(TimeContext context) {
            double secs = toTotalSeconds(context.getSampleRate());
            return context.getTempoMap().secondsToBeats(secs);
        }
        
        @Override
        public double toSeconds(TimeContext context) {
            return toTotalSeconds(context.getSampleRate());
        }
        
        @Override
        public long toFrames(TimeContext context) {
            return frameCount;
        }
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof DurationFrames)) return false;
            DurationFrames that = (DurationFrames) o;
            return frameCount == that.frameCount;
        }
        
        @Override
        public int hashCode() {
            return Long.hashCode(frameCount);
        }
        
        @Override
        public String toString() {
            return String.format("DurationFrames[%d frames]", frameCount);
        }
    }

    // ========== XML Serialization ==========
    
    /**
     * Saves this TimeDuration as an XML Element.
     * 
     * @return XML Element representing this TimeDuration
     */
    public Element saveAsXML() {
        Element element = new Element("timeDuration");
        element.setAttribute("type", getTimeBase().name());
        
        if (this instanceof DurationBeats db) {
            element.addElement("csoundBeats").setText(Double.toString(db.getCsoundBeats()));
        } else if (this instanceof DurationBBT d) {
            element.addElement("bars").setText(Long.toString(d.getBars()));
            element.addElement("beats").setText(Integer.toString(d.getBeats()));
            element.addElement("ticks").setText(Integer.toString(d.getTicks()));
        } else if (this instanceof DurationBBST d) {
            element.addElement("bars").setText(Long.toString(d.getBars()));
            element.addElement("beats").setText(Integer.toString(d.getBeats()));
            element.addElement("sixteenth").setText(Integer.toString(d.getSixteenth()));
            element.addElement("ticks").setText(Integer.toString(d.getTicks()));
        } else if (this instanceof DurationBBF d) {
            element.addElement("bars").setText(Long.toString(d.getBars()));
            element.addElement("beats").setText(Integer.toString(d.getBeats()));
            element.addElement("fraction").setText(Integer.toString(d.getFraction()));
        } else if (this instanceof DurationTime d) {
            element.addElement("hours").setText(Long.toString(d.getHours()));
            element.addElement("minutes").setText(Long.toString(d.getMinutes()));
            element.addElement("seconds").setText(Long.toString(d.getSeconds()));
            element.addElement("milliseconds").setText(Long.toString(d.getMilliseconds()));
        } else if (this instanceof DurationFrames d) {
            element.addElement("frameCount").setText(Long.toString(d.getFrameCount()));
        }
        
        return element;
    }
    
    /**
     * Loads a TimeDuration from an XML Element.
     * 
     * @param element XML Element containing TimeDuration data
     * @return the loaded TimeDuration
     * @throws Exception if the XML is invalid or type is unknown
     */
    public static TimeDuration loadFromXML(Element element) throws Exception {
        String type = element.getAttributeValue("type");
        
        if (type == null) {
            throw new Exception("TimeDuration XML missing 'type' attribute");
        }
        
        return switch (type) {
            case "BEATS", "CSOUND_BEATS", "DurationBeats" -> {
                double csoundBeats = Double.parseDouble(element.getTextString("csoundBeats"));
                yield new DurationBeats(csoundBeats);
            }
            case "BBT", "DurationBBT" -> {
                long bars = Long.parseLong(element.getTextString("bars"));
                int beats = Integer.parseInt(element.getTextString("beats"));
                int ticks = Integer.parseInt(element.getTextString("ticks"));
                yield new DurationBBT(bars, beats, ticks);
            }
            case "BBST", "DurationBBST" -> {
                long bars = Long.parseLong(element.getTextString("bars"));
                int beats = Integer.parseInt(element.getTextString("beats"));
                int sixteenth = Integer.parseInt(element.getTextString("sixteenth"));
                int ticks = Integer.parseInt(element.getTextString("ticks"));
                yield new DurationBBST(bars, beats, sixteenth, ticks);
            }
            case "BBF", "DurationBBF" -> {
                long bars = Long.parseLong(element.getTextString("bars"));
                int beats = Integer.parseInt(element.getTextString("beats"));
                int fraction = Integer.parseInt(element.getTextString("fraction"));
                yield new DurationBBF(bars, beats, fraction);
            }
            case "TIME", "DurationTime" -> {
                long hours = Long.parseLong(element.getTextString("hours"));
                long minutes = Long.parseLong(element.getTextString("minutes"));
                long seconds = Long.parseLong(element.getTextString("seconds"));
                long milliseconds = Long.parseLong(element.getTextString("milliseconds"));
                yield new DurationTime(hours, minutes, seconds, milliseconds);
            }
            case "FRAME", "DurationFrames" -> {
                long frameCount = Long.parseLong(element.getTextString("frameCount"));
                yield new DurationFrames(frameCount);
            }
            default -> throw new Exception("Unknown TimeDuration type: " + type);
        };
    }

}
