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

import java.util.concurrent.atomic.AtomicInteger;
import javafx.collections.ListChangeListener;
import org.junit.After;
import org.junit.AfterClass;
import org.junit.Before;
import org.junit.BeforeClass;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class MeterMapTest {

    @Test
    public void testObservableNotifications() {
        MeterMap meterMap = new MeterMap();

        final var notificationCount = new AtomicInteger(0);

        ListChangeListener<MeasureMeterPair> lcl = (c) -> {
//            System.out.println(c.toString());
            while (c.next()) {
                notificationCount.incrementAndGet();
            }
        };

        meterMap.addListener(lcl);
        meterMap.add(new MeasureMeterPair(16, new Meter(3,4)));
        meterMap.get(0).setMeter(new Meter(5,4));
        
        assertEquals(2, notificationCount.get());
    }

    @Test
    public void testUpdateMeasureStartBeats() {
        MeterMap meterMap = new MeterMap();
        
        meterMap.add(new MeasureMeterPair(9, new Meter(7, 8)));
        meterMap.add(new MeasureMeterPair(17, new Meter(3, 4)));
        
        var measureStartBeats = meterMap.measureStartBeats;
        
        assertEquals(3, measureStartBeats.length);
        assertEquals(0.0, measureStartBeats[0], 0.001);
        assertEquals(32.0, measureStartBeats[1], 0.001);
        assertEquals(60.0, measureStartBeats[2], 0.001);
    }
    
    @Test
    public void testToBeats() {
        MeterMap meterMap = new MeterMap();
        meterMap.add(new MeasureMeterPair(9, new Meter(3, 4)));

        assertEquals(0.0, meterMap.toBeats(new TimeUnit.MeasureBeatsTime(1, 1)), .001);
        assertEquals(4.0, meterMap.toBeats(new TimeUnit.MeasureBeatsTime(2, 1)), .001);
        assertEquals(6.5, meterMap.toBeats(new TimeUnit.MeasureBeatsTime(2, 3.5)), .001);
        assertEquals(32.0, meterMap.toBeats(new TimeUnit.MeasureBeatsTime(9, 1)), .001);
        assertEquals(35.0, meterMap.toBeats(new TimeUnit.MeasureBeatsTime(10, 1)), .001);
        
    }
    
    @Test 
    public void testToMeasureBeats() {
        
    }
}
