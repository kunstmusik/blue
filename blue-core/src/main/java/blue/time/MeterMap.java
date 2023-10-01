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
import javafx.beans.property.LongProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleLongProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.collections.FXCollections;
import javafx.collections.ObservableList;

/**
 *
 * @author stevenyi
 */
public class MeterMap {

    ObservableList<MeasureMeterPair> measureMeterList;

    public MeterMap() {
        measureMeterList
                = FXCollections.observableArrayList(
                        e -> new Observable[]{
                            e.measureNumberProperty(),
                            e.meterProperty()
                        }
                );
        measureMeterList.add(new MeasureMeterPair(1, new Meter(4,4)));
    }

    public MeterMap(MeterMap meterMap) {
        measureMeterList = FXCollections.observableArrayList(
                meterMap.measureMeterList.stream().map(e -> new MeasureMeterPair(e)).toList());
    }

    private static class MeasureMeterPair {

        public LongProperty measureNumber;

        public ObjectProperty<Meter> meter;

        public MeasureMeterPair(long measureNumber, Meter meter) {
            this.measureNumber = new SimpleLongProperty(measureNumber);
            this.meter = new SimpleObjectProperty(meter);
        }

        public MeasureMeterPair(MeasureMeterPair pair) {
            setMeasureNumber(pair.getMeasureNumber());
            setMeter(new Meter(pair.getMeter()));
        }

        public long getMeasureNumber() {
            return measureNumber.get();
        }

        public void setMeasureNumber(long measureNumber) {
            this.measureNumber.set(measureNumber);
        }

        public LongProperty measureNumberProperty() {
            return this.measureNumber;
        }

        public Meter getMeter() {
            return meter.get();
        }

        public void setMeter(Meter meter) {
            this.meter.set(meter);
        }

        public ObjectProperty<Meter> meterProperty() {
            return this.meter;
        }
    }
}
