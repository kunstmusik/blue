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

import static org.junit.Assert.*;
import org.junit.Test;

/**
 *
 * @author stevenyi
 */
public class MeterMapTest {

    @Test
    public void testListenerNotifications() {
        MeterMap meterMap = new MeterMap();

        final var notificationCount = new AtomicInteger(0);

        MeterMap.MeterMapListener listener = () -> notificationCount.incrementAndGet();

        meterMap.addListener(listener);
        meterMap.add(new MeasureMeterPair(16, new Meter(3, 4)));
        
        // MeasureMeterPair is now immutable, so we use set() to replace
        meterMap.set(0, meterMap.get(0).withMeter(new Meter(5, 4)));
        
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
        MeterMap meterMap = new MeterMap();
        
        // Test basic conversion in 4/4
        TimeUnit.MeasureBeatsTime result = meterMap.toMeasureBeats(TimeUnit.beats(0.0));
        assertEquals(1, result.getMeasureNumber());
        assertEquals(1.0, result.getBeatNumber(), 0.001);
        
        result = meterMap.toMeasureBeats(TimeUnit.beats(4.0));
        assertEquals(2, result.getMeasureNumber());
        assertEquals(1.0, result.getBeatNumber(), 0.001);
        
        result = meterMap.toMeasureBeats(TimeUnit.beats(6.5));
        assertEquals(2, result.getMeasureNumber());
        assertEquals(3.5, result.getBeatNumber(), 0.001);
    }
    
    @Test
    public void testToMeasureBeatsWithMeterChanges() {
        MeterMap meterMap = new MeterMap();
        meterMap.add(new MeasureMeterPair(9, new Meter(3, 4)));
        
        // Before meter change (4/4)
        TimeUnit.MeasureBeatsTime result = meterMap.toMeasureBeats(TimeUnit.beats(0.0));
        assertEquals(1, result.getMeasureNumber());
        assertEquals(1.0, result.getBeatNumber(), 0.001);
        
        result = meterMap.toMeasureBeats(TimeUnit.beats(4.0));
        assertEquals(2, result.getMeasureNumber());
        assertEquals(1.0, result.getBeatNumber(), 0.001);
        
        // After meter change (3/4)
        result = meterMap.toMeasureBeats(TimeUnit.beats(32.0));
        assertEquals(9, result.getMeasureNumber());
        assertEquals(1.0, result.getBeatNumber(), 0.001);
        
        result = meterMap.toMeasureBeats(TimeUnit.beats(35.0));
        assertEquals(10, result.getMeasureNumber());
        assertEquals(1.0, result.getBeatNumber(), 0.001);
        
        result = meterMap.toMeasureBeats(TimeUnit.beats(36.5));
        assertEquals(10, result.getMeasureNumber());
        assertEquals(2.5, result.getBeatNumber(), 0.001);
    }
    
    @Test
    public void testRoundTripConversion() {
        MeterMap meterMap = new MeterMap();
        meterMap.add(new MeasureMeterPair(9, new Meter(3, 4)));
        meterMap.add(new MeasureMeterPair(17, new Meter(7, 8)));
        
        // Test round-trip: MeasureBeats → Beats → MeasureBeats
        TimeUnit.MeasureBeatsTime original = TimeUnit.measureBeats(1, 1);
        double beats = meterMap.toBeats(original);
        TimeUnit.MeasureBeatsTime roundTrip = meterMap.toMeasureBeats(TimeUnit.beats(beats));
        assertEquals(original.getMeasureNumber(), roundTrip.getMeasureNumber());
        assertEquals(original.getBeatNumber(), roundTrip.getBeatNumber(), 0.001);
        
        original = TimeUnit.measureBeats(5, 3.5);
        beats = meterMap.toBeats(original);
        roundTrip = meterMap.toMeasureBeats(TimeUnit.beats(beats));
        assertEquals(original.getMeasureNumber(), roundTrip.getMeasureNumber());
        assertEquals(original.getBeatNumber(), roundTrip.getBeatNumber(), 0.001);
        
        original = TimeUnit.measureBeats(10, 2);
        beats = meterMap.toBeats(original);
        roundTrip = meterMap.toMeasureBeats(TimeUnit.beats(beats));
        assertEquals(original.getMeasureNumber(), roundTrip.getMeasureNumber());
        assertEquals(original.getBeatNumber(), roundTrip.getBeatNumber(), 0.001);
        
        original = TimeUnit.measureBeats(20, 5.5);
        beats = meterMap.toBeats(original);
        roundTrip = meterMap.toMeasureBeats(TimeUnit.beats(beats));
        assertEquals(original.getMeasureNumber(), roundTrip.getMeasureNumber());
        assertEquals(original.getBeatNumber(), roundTrip.getBeatNumber(), 0.001);
    }
    
    @Test(expected = IllegalStateException.class)
    public void testToBeatsEmptyMeterMap() {
        MeterMap meterMap = new MeterMap();
        meterMap.clear();
        meterMap.toBeats(TimeUnit.measureBeats(1, 1));
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testToBeatsMeasureBeforeFirstEntry() {
        MeterMap meterMap = new MeterMap();
        // MeterMap starts at measure 1, try measure 0
        meterMap.toBeats(TimeUnit.measureBeats(0, 1));
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testToBeatsBeatExceedsMeter() {
        MeterMap meterMap = new MeterMap();
        // 4/4 meter, try beat 5
        meterMap.toBeats(TimeUnit.measureBeats(1, 5));
    }
    
    @Test(expected = IllegalStateException.class)
    public void testToMeasureBeatsEmptyMeterMap() {
        MeterMap meterMap = new MeterMap();
        meterMap.clear();
        meterMap.toMeasureBeats(TimeUnit.beats(0.0));
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testToMeasureBeatsNegativeBeats() {
        MeterMap meterMap = new MeterMap();
        meterMap.toMeasureBeats(TimeUnit.beats(-1.0));
    }
}
