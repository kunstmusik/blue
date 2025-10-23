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

import javafx.beans.Observable;
import javafx.beans.property.SimpleListProperty;
import javafx.collections.FXCollections;

/**
 * Manages time signature (meter) changes across a musical timeline.
 * 
 * MeterMap maintains an ordered list of MeasureMeterPair entries, where each
 * entry defines the meter starting at a specific measure number. The meter
 * remains in effect until the next meter change.
 * 
 * Automatically maintains a cache of measure start beats for efficient
 * conversion between measure/beat positions and absolute Csound beats.
 *
 * @author stevenyi
 */
public class MeterMap extends SimpleListProperty<MeasureMeterPair> {

    protected double[] measureStartBeats = new double[0];

    public MeterMap() {
        super(FXCollections.observableArrayList(
                e -> new Observable[]{
                    e.measureNumberProperty(),
                    e.meterProperty()
                }
        ));

        add(new MeasureMeterPair(1, new Meter(4, 4)));
        addListener((Observable obs) -> {
            updateMeasureStartBeats();
        });
        updateMeasureStartBeats();
    }

    public MeterMap(MeterMap meterMap) {
        super(FXCollections.observableArrayList(
                meterMap.stream().map(e -> new MeasureMeterPair(e)).toList()));
        addListener((Observable obs) -> {
            updateMeasureStartBeats();
        });
        updateMeasureStartBeats();
    }

    private void updateMeasureStartBeats() {
        measureStartBeats = new double[this.size()];
        
        if (this.isEmpty()) {
            return; // Nothing to update
        }
        
        measureStartBeats[0] = 0;

        for (int i = 1; i < this.size(); i++) {
            var lastMeterEntry = this.get(i - 1);
            var curMeterEntry = this.get(i);

            var measureDur = lastMeterEntry.getMeter().getMeasureBeatDuration();

            var durationOfMeasureRange = measureDur
                    * (curMeterEntry.getMeasureNumber()
                    - lastMeterEntry.getMeasureNumber());

            measureStartBeats[i] = measureStartBeats[i - 1] + durationOfMeasureRange;
        }
    }

    /**
     * Converts a measure/beat time to absolute Csound beats.
     * 
     * @param measureBeatsTime the measure/beat position to convert
     * @return the equivalent position in Csound beats
     * @throws IllegalStateException if MeterMap is empty
     * @throws IllegalArgumentException if measure is before first meter entry
     *         or if beat number exceeds the meter's beat count
     */
    double toBeats(TimeUnit.MeasureBeatsTime measureBeatsTime) {
        if (this.isEmpty()) {
            throw new IllegalStateException("MeterMap is empty");
        }

        long measure = measureBeatsTime.getMeasureNumber();
        double beatNumber = measureBeatsTime.getBeatNumber();
        
        if (measure < this.get(0).getMeasureNumber()) {
            throw new IllegalArgumentException(
                "Measure " + measure + " is before first meter entry at measure " + 
                this.get(0).getMeasureNumber());
        }

        // Find the meter entry that applies to this measure
        int index = this.size() - 1;
        while (index != 0 && this.get(index).getMeasureNumber() > measure) {
            index--;
        }

        var meterEntry = this.get(index);
        var meter = meterEntry.getMeter();
        
        // Validate beat number doesn't exceed meter's beat count
        if (beatNumber > meter.numBeats) {
            throw new IllegalArgumentException(
                "Beat number " + beatNumber + " exceeds meter " + meter + 
                " which has " + meter.numBeats + " beats per measure");
        }
        
        var measureNumInRange = measure - meterEntry.getMeasureNumber();
        double retVal = measureStartBeats[index];

        retVal += (measureNumInRange * meter.getMeasureBeatDuration()) 
                + ((beatNumber - 1.0) * (4.0 / meter.beatLength));
        return retVal;
    }

    /**
     * Passthrough conversion for BeatTime (already in Csound beats).
     * 
     * @param beatTime the beat time value
     * @return the Csound beats value
     */
    double toBeats(TimeUnit.BeatTime beatTime) {
        return beatTime.getCsoundBeats();
    }

    /**
     * Converts absolute Csound beats to measure/beat time.
     * 
     * This is the inverse operation of toBeats(MeasureBeatsTime). It finds
     * which measure the beat falls in and calculates the beat position within
     * that measure according to the meter in effect.
     * 
     * @param beatTime the absolute beat time to convert
     * @return a new MeasureBeatsTime representing the measure/beat position
     * @throws IllegalStateException if MeterMap is empty
     * @throws IllegalArgumentException if beats is negative or before first measure
     */
    TimeUnit.MeasureBeatsTime toMeasureBeats(TimeUnit.BeatTime beatTime) {
        if (this.isEmpty()) {
            throw new IllegalStateException("MeterMap is empty");
        }
        
        double beats = beatTime.getCsoundBeats();
        
        if (beats < 0) {
            throw new IllegalArgumentException("Beats cannot be negative: " + beats);
        }
        
        // Find which meter range this beat falls into
        int index = 0;
        for (int i = 1; i < this.size(); i++) {
            if (beats >= measureStartBeats[i]) {
                index = i;
            } else {
                break;
            }
        }
        
        var meterEntry = this.get(index);
        var meter = meterEntry.getMeter();
        long baseMeasure = meterEntry.getMeasureNumber();
        double beatsFromRangeStart = beats - measureStartBeats[index];
        
        // Calculate how many complete measures and remaining beats
        double measureDuration = meter.getMeasureBeatDuration();
        long additionalMeasures = (long) (beatsFromRangeStart / measureDuration);
        double remainingBeats = beatsFromRangeStart - (additionalMeasures * measureDuration);
        
        // Convert remaining beats to beat number within measure
        // Beat number starts at 1, and is scaled by meter's beat length
        double beatNumber = 1.0 + (remainingBeats / (4.0 / meter.beatLength));
        
        long measureNumber = baseMeasure + additionalMeasures;
        
        return TimeUnit.measureBeats(measureNumber, beatNumber);
    }

}
