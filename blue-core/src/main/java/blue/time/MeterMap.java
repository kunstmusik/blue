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
import java.util.List;

/**
 *
 * @author stevenyi
 */
public class MeterMap {

    List<MeasureMeterPair> measureMeterList;

    public MeterMap() {
        measureMeterList = new ArrayList<>();
    }

    public MeterMap(MeterMap meterMap) {
        measureMeterList = new ArrayList<>(
                meterMap.measureMeterList.stream().map(e -> new MeasureMeterPair(e)).toList());
    }

    private static class MeasureMeterPair {

        public long measureNumber;

        public Meter meter;

        public MeasureMeterPair(long measureNumber, Meter meter) {
            this.measureNumber = measureNumber;
            this.meter = meter;
        }

        public MeasureMeterPair(MeasureMeterPair pair) {
            this.measureNumber = pair.measureNumber;
            this.meter = new Meter(pair.meter);
        }

    }
}
