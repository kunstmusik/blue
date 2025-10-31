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
 * clock time, SMPTE, frames) and are converted between formats using a 
 * TimeContext that provides meter, tempo, and sample rate information.
 *
 * @author Steven Yi
 */
public abstract class TimeUnit {
    
    /**
     * Returns the TimeBase type of this TimeUnit.
     * 
     * @return the TimeBase enum value corresponding to this TimeUnit type
     */
    public abstract TimeBase getTimeBase();

    public static BeatTime beats(double csoundBeats) {
        return new BeatTime(csoundBeats);
    }

    public static MeasureBeatsTime measureBeats(long measure, double beats) {
        return new MeasureBeatsTime(measure, beats);
    }

    /**
     * Absolute time representation using Csound beats (quarter note = 1 beat).
     * Independent of meter structure.
     * 
     * This is an immutable value object.
     */
    public static final class BeatTime extends TimeUnit {
        
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
     * Musical time representation using measure number and beat within measure.
     * Requires MeterMap context to interpret and convert to absolute time.
     * 
     * Measure numbers and beat numbers both start at 1.
     * Beat number is relative to the meter at that measure (e.g., beat 1-4 in 4/4).
     * 
     * This is an immutable value object.
     */
    public static final class MeasureBeatsTime extends TimeUnit {
        
        public static final MeasureBeatsTime ZERO = new MeasureBeatsTime(1, 1.0);
        
        private final long measureNumber;
        private final double beatNumber;

        public MeasureBeatsTime(long measures, double beats) {
            if (measures < 1) {
                throw new IllegalArgumentException(
                    "Measure number must be >= 1, got: " + measures);
            }
            if (beats < 1.0) {
                throw new IllegalArgumentException(
                    "Beat number must be >= 1.0, got: " + beats);
            }
            this.measureNumber = measures;
            this.beatNumber = beats;
        }

        public MeasureBeatsTime(MeasureBeatsTime measureBeatsTime) {
            this.measureNumber = measureBeatsTime.measureNumber;
            this.beatNumber = measureBeatsTime.beatNumber;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.MEASURE_BEATS;
        }

        public long getMeasureNumber() {
            return measureNumber;
        }

        public double getBeatNumber() {
            return beatNumber;
        }
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof MeasureBeatsTime)) return false;
            MeasureBeatsTime that = (MeasureBeatsTime) o;
            return measureNumber == that.measureNumber &&
                   Double.compare(that.beatNumber, beatNumber) == 0;
        }
        
        @Override
        public int hashCode() {
            int result = Long.hashCode(measureNumber);
            result = 31 * result + Double.hashCode(beatNumber);
            return result;
        }
        
        @Override
        public String toString() {
            return String.format("MeasureBeatsTime[m%d:%.3f]", measureNumber, beatNumber);
        }
    }

    /**
     * Clock time representation using hours, minutes, seconds, and milliseconds.
     * Independent of tempo and meter - represents absolute wall-clock time.
     * 
     * This is an immutable value object.
     */
    public static final class TimeValue extends TimeUnit {
        
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
    }

    /**
     * SMPTE timecode representation using hours, minutes, seconds, and frames.
     * Frame rate must be provided by TimeContext for conversion to absolute time.
     * 
     * This is an immutable value object.
     */
    public static final class SMPTEValue extends TimeUnit {
        
        public static final SMPTEValue ZERO = new SMPTEValue(0, 0, 0, 0);
        
        private final long hours;
        private final long minutes;
        private final long seconds;
        private final long frames;
        
        public SMPTEValue(long hours, long minutes, long seconds, long frames) {
            if (hours < 0) {
                throw new IllegalArgumentException("Hours cannot be negative: " + hours);
            }
            if (minutes < 0 || minutes >= 60) {
                throw new IllegalArgumentException("Minutes must be 0-59, got: " + minutes);
            }
            if (seconds < 0 || seconds >= 60) {
                throw new IllegalArgumentException("Seconds must be 0-59, got: " + seconds);
            }
            if (frames < 0) {
                throw new IllegalArgumentException("Frames cannot be negative: " + frames);
            }
            this.hours = hours;
            this.minutes = minutes;
            this.seconds = seconds;
            this.frames = frames;
        }
        
        public SMPTEValue(SMPTEValue smpteValue) {
            this.hours = smpteValue.hours;
            this.minutes = smpteValue.minutes;
            this.seconds = smpteValue.seconds;
            this.frames = smpteValue.frames;
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.SMPTE;
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
        
        public long getFrames() {
            return frames;
        }
        
        /**
         * Converts this SMPTE value to total seconds using the given frame rate.
         * @param frameRate the SMPTE frame rate (e.g., 24, 25, 29.97, 30, 60)
         * @return total seconds as a double
         */
        public double toTotalSeconds(double frameRate) {
            if (frameRate <= 0) {
                throw new IllegalArgumentException("Frame rate must be positive: " + frameRate);
            }
            return hours * 3600.0 + minutes * 60.0 + seconds + frames / frameRate;
        }
        
        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (!(o instanceof SMPTEValue)) return false;
            SMPTEValue that = (SMPTEValue) o;
            return hours == that.hours &&
                   minutes == that.minutes &&
                   seconds == that.seconds &&
                   frames == that.frames;
        }
        
        @Override
        public int hashCode() {
            int result = Long.hashCode(hours);
            result = 31 * result + Long.hashCode(minutes);
            result = 31 * result + Long.hashCode(seconds);
            result = 31 * result + Long.hashCode(frames);
            return result;
        }
        
        @Override
        public String toString() {
            return String.format("SMPTEValue[%02d:%02d:%02d:%02d]", hours, minutes, seconds, frames);
        }
    }

    /**
     * Audio sample frame number representation.
     * Requires sample rate from TimeContext for conversion to time.
     * 
     * This is an immutable value object.
     */
    public static final class FrameValue extends TimeUnit {
        
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

    // Static factory methods for new TimeUnit types
    
    public static TimeValue time(long hours, long minutes, long seconds, long milliseconds) {
        return new TimeValue(hours, minutes, seconds, milliseconds);
    }
    
    public static SMPTEValue smpte(long hours, long minutes, long seconds, long frames) {
        return new SMPTEValue(hours, minutes, seconds, frames);
    }
    
    public static FrameValue frames(long frameNumber) {
        return new FrameValue(frameNumber);
    }

    // ========== XML Serialization ==========
    
    /**
     * Saves this TimeUnit as an XML Element.
     * 
     * @return XML Element representing this TimeUnit
     */
    public Element saveAsXML() {
        Element element = new Element("timeUnit");
        element.setAttribute("type", this.getClass().getSimpleName());
        
        if (this instanceof BeatTime) {
            BeatTime bt = (BeatTime) this;
            element.addElement("csoundBeats").setText(Double.toString(bt.getCsoundBeats()));
        } else if (this instanceof MeasureBeatsTime) {
            MeasureBeatsTime mbt = (MeasureBeatsTime) this;
            element.addElement("measureNumber").setText(Long.toString(mbt.getMeasureNumber()));
            element.addElement("beatNumber").setText(Double.toString(mbt.getBeatNumber()));
        } else if (this instanceof TimeValue) {
            TimeValue tv = (TimeValue) this;
            element.addElement("hours").setText(Long.toString(tv.getHours()));
            element.addElement("minutes").setText(Long.toString(tv.getMinutes()));
            element.addElement("seconds").setText(Long.toString(tv.getSeconds()));
            element.addElement("milliseconds").setText(Long.toString(tv.getMilliseconds()));
        } else if (this instanceof SMPTEValue) {
            SMPTEValue sv = (SMPTEValue) this;
            element.addElement("hours").setText(Long.toString(sv.getHours()));
            element.addElement("minutes").setText(Long.toString(sv.getMinutes()));
            element.addElement("seconds").setText(Long.toString(sv.getSeconds()));
            element.addElement("frames").setText(Long.toString(sv.getFrames()));
        } else if (this instanceof FrameValue) {
            FrameValue fv = (FrameValue) this;
            element.addElement("frameNumber").setText(Long.toString(fv.getFrameNumber()));
        }
        
        return element;
    }
    
    /**
     * Loads a TimeUnit from an XML Element.
     * 
     * @param element XML Element containing TimeUnit data
     * @return the loaded TimeUnit
     * @throws Exception if the XML is invalid or type is unknown
     */
    public static TimeUnit loadFromXML(Element element) throws Exception {
        String type = element.getAttributeValue("type");
        
        if (type == null) {
            throw new Exception("TimeUnit XML missing 'type' attribute");
        }
        
        return switch (type) {
            case "BeatTime" -> {
                double csoundBeats = Double.parseDouble(element.getTextString("csoundBeats"));
                yield new BeatTime(csoundBeats);
            }
            case "MeasureBeatsTime" -> {
                long measureNumber = Long.parseLong(element.getTextString("measureNumber"));
                double beatNumber = Double.parseDouble(element.getTextString("beatNumber"));
                yield new MeasureBeatsTime(measureNumber, beatNumber);
            }
            case "TimeValue" -> {
                long hours = Long.parseLong(element.getTextString("hours"));
                long minutes = Long.parseLong(element.getTextString("minutes"));
                long seconds = Long.parseLong(element.getTextString("seconds"));
                long milliseconds = Long.parseLong(element.getTextString("milliseconds"));
                yield new TimeValue(hours, minutes, seconds, milliseconds);
            }
            case "SMPTEValue" -> {
                long hours = Long.parseLong(element.getTextString("hours"));
                long minutes = Long.parseLong(element.getTextString("minutes"));
                long seconds = Long.parseLong(element.getTextString("seconds"));
                long frames = Long.parseLong(element.getTextString("frames"));
                yield new SMPTEValue(hours, minutes, seconds, frames);
            }
            case "FrameValue" -> {
                long frameNumber = Long.parseLong(element.getTextString("frameNumber"));
                yield new FrameValue(frameNumber);
            }
            default -> throw new Exception("Unknown TimeUnit type: " + type);
        };
    }

}
