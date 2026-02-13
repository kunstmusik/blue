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
    public void testBarBeatToBeats() {
        MeterMap meterMap = new MeterMap();
        meterMap.add(new MeasureMeterPair(9, new Meter(3, 4)));

        assertEquals(0.0, meterMap.barBeatToBeats(1, 1), .001);
        assertEquals(4.0, meterMap.barBeatToBeats(2, 1), .001);
        assertEquals(6.0, meterMap.barBeatToBeats(2, 3), .001);
        assertEquals(32.0, meterMap.barBeatToBeats(9, 1), .001);
        assertEquals(35.0, meterMap.barBeatToBeats(10, 1), .001);
    }
    
    @Test 
    public void testBeatsToBBT() {
        MeterMap meterMap = new MeterMap();
        int ppq = 960;
        
        // Test basic conversion in 4/4
        TimePosition.BBTTime result = meterMap.beatsToBBT(0.0, ppq);
        assertEquals(1, result.getBar());
        assertEquals(1, result.getBeat());
        assertEquals(0, result.getTicks());
        
        result = meterMap.beatsToBBT(4.0, ppq);
        assertEquals(2, result.getBar());
        assertEquals(1, result.getBeat());
        assertEquals(0, result.getTicks());
        
        result = meterMap.beatsToBBT(6.5, ppq);
        assertEquals(2, result.getBar());
        assertEquals(3, result.getBeat());
        assertEquals(480, result.getTicks()); // 0.5 beat = 480 ticks at PPQ=960
    }
    
    @Test
    public void testBeatsToBBTWithMeterChanges() {
        MeterMap meterMap = new MeterMap();
        meterMap.add(new MeasureMeterPair(9, new Meter(3, 4)));
        int ppq = 960;
        
        // Before meter change (4/4)
        TimePosition.BBTTime result = meterMap.beatsToBBT(0.0, ppq);
        assertEquals(1, result.getBar());
        assertEquals(1, result.getBeat());
        
        result = meterMap.beatsToBBT(4.0, ppq);
        assertEquals(2, result.getBar());
        assertEquals(1, result.getBeat());
        
        // After meter change (3/4)
        result = meterMap.beatsToBBT(32.0, ppq);
        assertEquals(9, result.getBar());
        assertEquals(1, result.getBeat());
        
        result = meterMap.beatsToBBT(35.0, ppq);
        assertEquals(10, result.getBar());
        assertEquals(1, result.getBeat());
        
        result = meterMap.beatsToBBT(36.5, ppq);
        assertEquals(10, result.getBar());
        assertEquals(2, result.getBeat());
        assertEquals(480, result.getTicks());
    }
    
    @Test
    public void testRoundTripConversion() {
        MeterMap meterMap = new MeterMap();
        meterMap.add(new MeasureMeterPair(9, new Meter(3, 4)));
        meterMap.add(new MeasureMeterPair(17, new Meter(7, 8)));
        int ppq = 960;
        
        // Test round-trip: BBT → Beats → BBT
        TimePosition.BBTTime original = TimePosition.bbt(1, 1, 0);
        double beats = meterMap.barBeatToBeats(original.getBar(), original.getBeat());
        TimePosition.BBTTime roundTrip = meterMap.beatsToBBT(beats, ppq);
        assertEquals(original.getBar(), roundTrip.getBar());
        assertEquals(original.getBeat(), roundTrip.getBeat());
        
        original = TimePosition.bbt(5, 3, 0);
        beats = meterMap.barBeatToBeats(original.getBar(), original.getBeat());
        roundTrip = meterMap.beatsToBBT(beats, ppq);
        assertEquals(original.getBar(), roundTrip.getBar());
        assertEquals(original.getBeat(), roundTrip.getBeat());
        
        original = TimePosition.bbt(10, 2, 0);
        beats = meterMap.barBeatToBeats(original.getBar(), original.getBeat());
        roundTrip = meterMap.beatsToBBT(beats, ppq);
        assertEquals(original.getBar(), roundTrip.getBar());
        assertEquals(original.getBeat(), roundTrip.getBeat());
    }
    
    @Test(expected = IllegalStateException.class)
    public void testBarBeatToBeatsEmptyMeterMap() {
        MeterMap meterMap = new MeterMap();
        meterMap.clear();
        meterMap.barBeatToBeats(1, 1);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testBarBeatToBeatsBarBeforeFirstEntry() {
        MeterMap meterMap = new MeterMap();
        // MeterMap starts at measure 1, try bar 0
        meterMap.barBeatToBeats(0, 1);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testBarBeatToBeatsBeatExceedsMeter() {
        MeterMap meterMap = new MeterMap();
        // 4/4 meter, try beat 5
        meterMap.barBeatToBeats(1, 5);
    }
    
    @Test(expected = IllegalStateException.class)
    public void testBeatsToBBTEmptyMeterMap() {
        MeterMap meterMap = new MeterMap();
        meterMap.clear();
        meterMap.beatsToBBT(0.0, 960);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testBeatsToBBTNegativeBeats() {
        MeterMap meterMap = new MeterMap();
        meterMap.beatsToBBT(-1.0, 960);
    }
    
    @Test
    public void testReplaceAllCopiesEntries() {
        MeterMap original = new MeterMap();
        MeterMap source = new MeterMap();
        source.add(new MeasureMeterPair(5, new Meter(3, 4)));
        source.add(new MeasureMeterPair(13, new Meter(6, 8)));
        
        original.replaceAll(source);
        
        assertEquals(3, original.size());
        assertEquals(1, original.get(0).getMeasureNumber());
        assertEquals(5, original.get(1).getMeasureNumber());
        assertEquals(3, original.get(1).getMeter().numBeats);
        assertEquals(13, original.get(2).getMeasureNumber());
        assertEquals(6, original.get(2).getMeter().numBeats);
    }
    
    @Test
    public void testReplaceAllFiresListener() {
        MeterMap meterMap = new MeterMap();
        final var notificationCount = new AtomicInteger(0);
        meterMap.addListener(() -> notificationCount.incrementAndGet());
        
        MeterMap source = new MeterMap();
        source.add(new MeasureMeterPair(9, new Meter(3, 4)));
        
        meterMap.replaceAll(source);
        
        assertEquals(1, notificationCount.get());
    }
    
    @Test
    public void testReplaceAllPreservesListeners() {
        MeterMap meterMap = new MeterMap();
        final var notificationCount = new AtomicInteger(0);
        meterMap.addListener(() -> notificationCount.incrementAndGet());
        
        // First replaceAll
        MeterMap source1 = new MeterMap();
        source1.add(new MeasureMeterPair(5, new Meter(3, 4)));
        meterMap.replaceAll(source1);
        
        // Second replaceAll — listener should still be active
        MeterMap source2 = new MeterMap();
        source2.add(new MeasureMeterPair(9, new Meter(7, 8)));
        meterMap.replaceAll(source2);
        
        assertEquals(2, notificationCount.get());
    }
}
