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

import javafx.beans.property.DoubleProperty;
import javafx.beans.property.LongProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleLongProperty;

/**
 *
 * Class to hold time values. ˆ
 *
 * @author Steven Yi
 */
public abstract class TimeUnit {

    public static BeatTime beats(double csoundBeats) {
        return new BeatTime(csoundBeats);
    }

    public static MeasureBeatsTime measureBeats(long measure, double beats) {
        return new MeasureBeatsTime(measure, beats);
    }

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
     * TimeUnit in measure number and beatNumber. Measure number and beat number
     * both start at 1.
     */
    public static class MeasureBeatsTime extends TimeUnit {

        LongProperty measureNumber = new SimpleLongProperty(0);
        DoubleProperty beatNumber = new SimpleDoubleProperty(0);

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

        public long getMeasureNumber() {
            return measureNumber.get();
        }

        public void setMeasure(long measure) {
            assert (measure > 0);
            this.measureNumber.set(measure);
        }

        public final LongProperty measureNumberProperty() {
            return measureNumber;
        }

        public double getBeatNumber() {
            return beatNumber.get();
        }

        public void setBeatNumber(double beats) {
            assert (beats >= 1);
            this.beatNumber.set(beats);
        }

        public final DoubleProperty beatNumberProperty() {
            return beatNumber;
        }
    }

}
