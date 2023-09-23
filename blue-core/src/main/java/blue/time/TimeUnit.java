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
 * Class to hold time values.
 *ˆ
 * @author Steven Yi
 */
public abstract class TimeUnit {

    public abstract double toBeats(TimeContext timeContext);

    public abstract double toSeconds(TimeContext timeContext);

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

        public double toBeats(TimeContext timeContext) {
            return getCsoundBeats();
        }

        @Override
        public double toSeconds(TimeContext timeContext) {
            return -1;
        }
    }

    public static class MeasureBeatsTime extends TimeUnit {

        LongProperty measures = new SimpleLongProperty(0);
        DoubleProperty beats = new SimpleDoubleProperty(0);

        public MeasureBeatsTime() {
        }

        public MeasureBeatsTime(long measures, double beats) {
            setMeasures(measures);
            setBeats(beats);
        }

        public MeasureBeatsTime(MeasureBeatsTime measureBeatsTime) {
            setMeasures(measureBeatsTime.getMeasures());
            setBeats(measureBeatsTime.getBeats());
        }

        public long getMeasures() {
            return measures.get();
        }

        public void setMeasures(long measures) {
            this.measures.set(measures);
        }

        public final LongProperty measuresProperty() {
            return measures;
        }

        public double getBeats() {
            return beats.get();
        }

        public void setBeats(double beats) {
            this.beats.set(beats);
        }

        public final DoubleProperty beatsProperty() {
            return beats;
        }

        @Override
        public double toBeats(TimeContext timeContext) {
            throw new UnsupportedOperationException("Not supported yet."); // Generated from nbfs://nbhost/SystemFileSystem/Templates/Classes/Code/GeneratedMethodBody
        }

        @Override
        public double toSeconds(TimeContext timeContext) {
            throw new UnsupportedOperationException("Not supported yet."); // Generated from nbfs://nbhost/SystemFileSystem/Templates/Classes/Code/GeneratedMethodBody
        }

    }

}

//    double csoundBeats;
//    
//    long measure;
//    double beat; 
//    
//    long sampleFrames; 
//    
//    double seconds;
//}
