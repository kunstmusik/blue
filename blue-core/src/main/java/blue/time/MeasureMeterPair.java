/*
 * Copyright (C) 2023 stevenyi
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */

package blue.time;

import javafx.beans.property.LongProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleLongProperty;
import javafx.beans.property.SimpleObjectProperty;

/**
 *
 * @author stevenyi
 */
public class MeasureMeterPair {

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
