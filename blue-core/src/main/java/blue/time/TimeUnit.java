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
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.LongProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleLongProperty;

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
     */
    public static class BeatTime extends TimeUnit {

        DoubleProperty csoundBeats = new SimpleDoubleProperty(0.0);

        public BeatTime() {
        }

        public BeatTime(double csoundBeats) {
            this.csoundBeats.set(csoundBeats);
        }

        public BeatTime(BeatTime beatTime) {
            setCsoundBeats(beatTime.getCsoundBeats());
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.CSOUND_BEATS;
        }

        public double getCsoundBeats() {
            return csoundBeats.get();
        }

        public void setCsoundBeats(double csoundBeats) {
            this.csoundBeats.set(csoundBeats);
        }

        public final DoubleProperty csoundBeatsProperty() {
            return csoundBeats;
        }

    }

    /**
     * Musical time representation using measure number and beat within measure.
     * Requires MeterMap context to interpret and convert to absolute time.
     * 
     * Measure numbers and beat numbers both start at 1.
     * Beat number is relative to the meter at that measure (e.g., beat 1-4 in 4/4).
     */
    public static class MeasureBeatsTime extends TimeUnit {

        LongProperty measureNumber = new SimpleLongProperty(1);
        DoubleProperty beatNumber = new SimpleDoubleProperty(1.0);

        public MeasureBeatsTime() {
        }

        public MeasureBeatsTime(long measures, double beats) {
            setMeasure(measures);
            setBeatNumber(beats);
        }

        public MeasureBeatsTime(MeasureBeatsTime measureBeatsTime) {
            setMeasure(measureBeatsTime.getMeasureNumber());
            setBeatNumber(measureBeatsTime.getBeatNumber());
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.MEASURE_BEATS;
        }

        public long getMeasureNumber() {
            return measureNumber.get();
        }

        public void setMeasure(long measure) {
            if (measure < 1) {
                throw new IllegalArgumentException(
                    "Measure number must be >= 1, got: " + measure);
            }
            this.measureNumber.set(measure);
        }

        public final LongProperty measureNumberProperty() {
            return measureNumber;
        }

        public double getBeatNumber() {
            return beatNumber.get();
        }

        public void setBeatNumber(double beats) {
            if (beats < 1.0) {
                throw new IllegalArgumentException(
                    "Beat number must be >= 1.0, got: " + beats);
            }
            this.beatNumber.set(beats);
        }

        public final DoubleProperty beatNumberProperty() {
            return beatNumber;
        }
    }

    /**
     * Clock time representation using hours, minutes, seconds, and milliseconds.
     * Independent of tempo and meter - represents absolute wall-clock time.
     */
    public static class TimeValue extends TimeUnit {
        
        LongProperty hours = new SimpleLongProperty(0);
        LongProperty minutes = new SimpleLongProperty(0);
        LongProperty seconds = new SimpleLongProperty(0);
        LongProperty milliseconds = new SimpleLongProperty(0);
        
        public TimeValue() {
        }
        
        public TimeValue(long hours, long minutes, long seconds, long milliseconds) {
            setHours(hours);
            setMinutes(minutes);
            setSeconds(seconds);
            setMilliseconds(milliseconds);
        }
        
        public TimeValue(TimeValue timeValue) {
            setHours(timeValue.getHours());
            setMinutes(timeValue.getMinutes());
            setSeconds(timeValue.getSeconds());
            setMilliseconds(timeValue.getMilliseconds());
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.TIME;
        }
        
        public long getHours() {
            return hours.get();
        }
        
        public void setHours(long hours) {
            if (hours < 0) {
                throw new IllegalArgumentException("Hours cannot be negative: " + hours);
            }
            this.hours.set(hours);
        }
        
        public final LongProperty hoursProperty() {
            return hours;
        }
        
        public long getMinutes() {
            return minutes.get();
        }
        
        public void setMinutes(long minutes) {
            if (minutes < 0 || minutes >= 60) {
                throw new IllegalArgumentException("Minutes must be 0-59, got: " + minutes);
            }
            this.minutes.set(minutes);
        }
        
        public final LongProperty minutesProperty() {
            return minutes;
        }
        
        public long getSeconds() {
            return seconds.get();
        }
        
        public void setSeconds(long seconds) {
            if (seconds < 0 || seconds >= 60) {
                throw new IllegalArgumentException("Seconds must be 0-59, got: " + seconds);
            }
            this.seconds.set(seconds);
        }
        
        public final LongProperty secondsProperty() {
            return seconds;
        }
        
        public long getMilliseconds() {
            return milliseconds.get();
        }
        
        public void setMilliseconds(long milliseconds) {
            if (milliseconds < 0 || milliseconds >= 1000) {
                throw new IllegalArgumentException("Milliseconds must be 0-999, got: " + milliseconds);
            }
            this.milliseconds.set(milliseconds);
        }
        
        public final LongProperty millisecondsProperty() {
            return milliseconds;
        }
        
        /**
         * Converts this time value to total seconds.
         * @return total seconds as a double
         */
        public double toSeconds() {
            return hours.get() * 3600.0 + minutes.get() * 60.0 + seconds.get() + milliseconds.get() / 1000.0;
        }
    }

    /**
     * SMPTE timecode representation using hours, minutes, seconds, and frames.
     * Frame rate must be provided by TimeContext for conversion to absolute time.
     */
    public static class SMPTEValue extends TimeUnit {
        
        LongProperty hours = new SimpleLongProperty(0);
        LongProperty minutes = new SimpleLongProperty(0);
        LongProperty seconds = new SimpleLongProperty(0);
        LongProperty frames = new SimpleLongProperty(0);
        
        public SMPTEValue() {
        }
        
        public SMPTEValue(long hours, long minutes, long seconds, long frames) {
            setHours(hours);
            setMinutes(minutes);
            setSeconds(seconds);
            setFrames(frames);
        }
        
        public SMPTEValue(SMPTEValue smpteValue) {
            setHours(smpteValue.getHours());
            setMinutes(smpteValue.getMinutes());
            setSeconds(smpteValue.getSeconds());
            setFrames(smpteValue.getFrames());
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.SMPTE;
        }
        
        public long getHours() {
            return hours.get();
        }
        
        public void setHours(long hours) {
            if (hours < 0) {
                throw new IllegalArgumentException("Hours cannot be negative: " + hours);
            }
            this.hours.set(hours);
        }
        
        public final LongProperty hoursProperty() {
            return hours;
        }
        
        public long getMinutes() {
            return minutes.get();
        }
        
        public void setMinutes(long minutes) {
            if (minutes < 0 || minutes >= 60) {
                throw new IllegalArgumentException("Minutes must be 0-59, got: " + minutes);
            }
            this.minutes.set(minutes);
        }
        
        public final LongProperty minutesProperty() {
            return minutes;
        }
        
        public long getSeconds() {
            return seconds.get();
        }
        
        public void setSeconds(long seconds) {
            if (seconds < 0 || seconds >= 60) {
                throw new IllegalArgumentException("Seconds must be 0-59, got: " + seconds);
            }
            this.seconds.set(seconds);
        }
        
        public final LongProperty secondsProperty() {
            return seconds;
        }
        
        public long getFrames() {
            return frames.get();
        }
        
        public void setFrames(long frames) {
            if (frames < 0) {
                throw new IllegalArgumentException("Frames cannot be negative: " + frames);
            }
            // Note: Max frames depends on frame rate, validated during conversion
            this.frames.set(frames);
        }
        
        public final LongProperty framesProperty() {
            return frames;
        }
        
        /**
         * Converts this SMPTE value to total seconds using the given frame rate.
         * @param frameRate the SMPTE frame rate (e.g., 24, 25, 29.97, 30, 60)
         * @return total seconds as a double
         */
        public double toSeconds(double frameRate) {
            if (frameRate <= 0) {
                throw new IllegalArgumentException("Frame rate must be positive: " + frameRate);
            }
            return hours.get() * 3600.0 + minutes.get() * 60.0 + seconds.get() + frames.get() / frameRate;
        }
    }

    /**
     * Audio sample frame number representation.
     * Requires sample rate from TimeContext for conversion to time.
     */
    public static class FrameValue extends TimeUnit {
        
        LongProperty frameNumber = new SimpleLongProperty(0);
        
        public FrameValue() {
        }
        
        public FrameValue(long frameNumber) {
            setFrameNumber(frameNumber);
        }
        
        public FrameValue(FrameValue frameValue) {
            setFrameNumber(frameValue.getFrameNumber());
        }
        
        @Override
        public TimeBase getTimeBase() {
            return TimeBase.FRAME;
        }
        
        public long getFrameNumber() {
            return frameNumber.get();
        }
        
        public void setFrameNumber(long frameNumber) {
            if (frameNumber < 0) {
                throw new IllegalArgumentException("Frame number cannot be negative: " + frameNumber);
            }
            this.frameNumber.set(frameNumber);
        }
        
        public final LongProperty frameNumberProperty() {
            return frameNumber;
        }
        
        /**
         * Converts this frame number to seconds using the given sample rate.
         * @param sampleRate the audio sample rate (e.g., 44100, 48000)
         * @return time in seconds
         */
        public double toSeconds(long sampleRate) {
            if (sampleRate <= 0) {
                throw new IllegalArgumentException("Sample rate must be positive: " + sampleRate);
            }
            return frameNumber.get() / (double) sampleRate;
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
