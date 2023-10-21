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

import java.util.ArrayList;
import javafx.beans.Observable;
import javafx.beans.property.SimpleListProperty;
import javafx.collections.FXCollections;

/**
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

    double toBeats(TimeUnit.MeasureBeatsTime measureBeatsTime) {

        long measure = measureBeatsTime.getMeasureNumber();
        double beatNumber = measureBeatsTime.getBeatNumber();

        int index = this.size() - 1;
        while (index != 0 && this.get(index).getMeasureNumber() > measure) {
            index--;
        }

        var meterEntry = this.get(index);
        var meter = meterEntry.getMeter();
        var measureNumInRange = measure - meterEntry.getMeasureNumber();
        double retVal = measureStartBeats[index];

        retVal += (measureNumInRange * meter.getMeasureBeatDuration()) 
                + ((beatNumber - 1.0) * (4.0 / meter.beatLength));
        return retVal;
    }

    double toBeats(TimeUnit.BeatTime beatTime) {
        return beatTime.getCsoundBeats();
    }

    double toMeasureBeats(TimeUnit.BeatTime beatTime) {
        throw new UnsupportedOperationException("not yet implemented");
    }

}
