/*
 * blue - object composition environment for csound
 * Copyright (c) 2025 Steven Yi (stevenyi@gmail.com)
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

import static org.junit.Assert.*;
import org.junit.Before;
import org.junit.Test;

/**
 * Tests for TimeUtilities conversion methods.
 *
 * @author stevenyi
 */
public class TimeUtilitiesTest {

    private TimeContext context;
    
    @Before
    public void setUp() {
        context = new TimeContext();
        // Default: 44100 sample rate, 4/4 meter, 60 BPM tempo
    }
    
    // ========== timeUnitToBeats Tests ==========
    
    @Test
    public void testTimeUnitToBeatsWithBeatTime() {
        TimeUnit.BeatTime bt = TimeUnit.beats(10.5);
        double result = TimeUtilities.timeUnitToBeats(bt, context);
        assertEquals(10.5, result, 0.001);
    }
    
    @Test
    public void testTimeUnitToBeatsWithBBSTTime() {
        TimeUnit.BBSTTime bbst = TimeUnit.bbst(2, 3, 1, 0);
        double result = TimeUtilities.timeUnitToBeats(bbst, context);
        // Bar 2, beat 3 in 4/4 = 4 + 2 = 6 beats
        assertEquals(6.0, result, 0.001);
    }
    
    @Test
    public void testTimeUnitToBeatsWithTimeValue() {
        // At 60 BPM: 1 beat = 1 second
        TimeUnit.TimeValue tv = TimeUnit.time(0, 0, 10, 0);
        double result = TimeUtilities.timeUnitToBeats(tv, context);
        assertEquals(10.0, result, 0.001);
    }
    
    @Test
    public void testTimeUnitToBeatsWithFrameValue() {
        // At 44100 Hz and 60 BPM: 44100 frames = 1 second = 1 beat
        TimeUnit.FrameValue fv = TimeUnit.frames(44100);
        double result = TimeUtilities.timeUnitToBeats(fv, context);
        assertEquals(1.0, result, 0.001);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testTimeUnitToBeatsNullTimeUnit() {
        TimeUtilities.timeUnitToBeats(null, context);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testTimeUnitToBeatsNullContext() {
        TimeUtilities.timeUnitToBeats(TimeUnit.beats(1.0), null);
    }
    
    // ========== beatsToTimeUnit Tests ==========
    
    @Test
    public void testBeatsToTimeUnitBeatTime() {
        TimeUnit result = TimeUtilities.beatsToTimeUnit(10.5, TimeBase.CSOUND_BEATS, context);
        assertTrue(result instanceof TimeUnit.BeatTime);
        assertEquals(10.5, ((TimeUnit.BeatTime) result).getCsoundBeats(), 0.001);
    }
    
    @Test
    public void testBeatsToTimeUnitBBSTTime() {
        // 6 beats in 4/4 = bar 2, beat 3
        TimeUnit result = TimeUtilities.beatsToTimeUnit(6.0, TimeBase.BBST, context);
        assertTrue(result instanceof TimeUnit.BBSTTime);
        TimeUnit.BBSTTime bbst = (TimeUnit.BBSTTime) result;
        assertEquals(2, bbst.getBar());
        assertEquals(3, bbst.getBeat());
    }
    
    @Test
    public void testBeatsToTimeUnitTimeValue() {
        // At 60 BPM: 10 beats = 10 seconds
        TimeUnit result = TimeUtilities.beatsToTimeUnit(10.0, TimeBase.TIME, context);
        assertTrue(result instanceof TimeUnit.TimeValue);
        TimeUnit.TimeValue tv = (TimeUnit.TimeValue) result;
        assertEquals(0, tv.getHours());
        assertEquals(0, tv.getMinutes());
        assertEquals(10, tv.getSeconds());
    }
    
    @Test
    public void testBeatsToTimeUnitFrameValue() {
        // At 60 BPM and 44100 Hz: 1 beat = 1 second = 44100 frames
        TimeUnit result = TimeUtilities.beatsToTimeUnit(1.0, TimeBase.FRAME, context);
        assertTrue(result instanceof TimeUnit.FrameValue);
        assertEquals(44100, ((TimeUnit.FrameValue) result).getFrameNumber());
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testBeatsToTimeUnitProjectDefault() {
        TimeUtilities.beatsToTimeUnit(1.0, TimeBase.PROJECT_DEFAULT, context);
    }
    
    // ========== convertTimeUnit Tests ==========
    
    @Test
    public void testConvertTimeUnitSameTimeBase() {
        TimeUnit.BeatTime original = TimeUnit.beats(5.0);
        TimeUnit result = TimeUtilities.convertTimeUnit(original, TimeBase.CSOUND_BEATS, context);
        assertSame(original, result);
    }
    
    @Test
    public void testConvertTimeUnitBeatTimeToBBST() {
        TimeUnit.BeatTime bt = TimeUnit.beats(8.0);
        TimeUnit result = TimeUtilities.convertTimeUnit(bt, TimeBase.BBST, context);
        assertTrue(result instanceof TimeUnit.BBSTTime);
        TimeUnit.BBSTTime bbst = (TimeUnit.BBSTTime) result;
        // 8 beats in 4/4 = bar 3, beat 1
        assertEquals(3, bbst.getBar());
        assertEquals(1, bbst.getBeat());
    }
    
    @Test
    public void testConvertTimeUnitBBSTToTime() {
        TimeUnit.BBSTTime bbst = TimeUnit.bbst(3, 2, 1, 0);
        TimeUnit result = TimeUtilities.convertTimeUnit(bbst, TimeBase.TIME, context);
        assertTrue(result instanceof TimeUnit.TimeValue);
        // Bar 3, beat 2 = 9 beats at 60 BPM = 9 seconds
        TimeUnit.TimeValue tv = (TimeUnit.TimeValue) result;
        assertEquals(9, tv.toTotalSeconds(), 0.001);
    }
    
    // ========== Round-trip Conversion Tests ==========
    
    @Test
    public void testRoundTripBeatTimeToBBST() {
        TimeUnit.BeatTime original = TimeUnit.beats(12.0); // Use whole number to avoid tick rounding
        TimeUnit intermediate = TimeUtilities.convertTimeUnit(original, TimeBase.BBST, context);
        TimeUnit result = TimeUtilities.convertTimeUnit(intermediate, TimeBase.CSOUND_BEATS, context);
        assertEquals(original.getCsoundBeats(), ((TimeUnit.BeatTime) result).getCsoundBeats(), 0.001);
    }
    
    @Test
    public void testRoundTripBBSTToTime() {
        TimeUnit.BBSTTime original = TimeUnit.bbst(5, 3, 1, 0);
        TimeUnit intermediate = TimeUtilities.convertTimeUnit(original, TimeBase.TIME, context);
        TimeUnit result = TimeUtilities.convertTimeUnit(intermediate, TimeBase.BBST, context);
        TimeUnit.BBSTTime bbst = (TimeUnit.BBSTTime) result;
        assertEquals(original.getBar(), bbst.getBar());
        assertEquals(original.getBeat(), bbst.getBeat());
    }
    
    @Test
    public void testRoundTripTimeToFrames() {
        TimeUnit.TimeValue original = TimeUnit.time(0, 1, 30, 0);
        TimeUnit intermediate = TimeUtilities.convertTimeUnit(original, TimeBase.FRAME, context);
        TimeUnit result = TimeUtilities.convertTimeUnit(intermediate, TimeBase.TIME, context);
        TimeUnit.TimeValue tv = (TimeUnit.TimeValue) result;
        assertEquals(original.toTotalSeconds(), tv.toTotalSeconds(), 0.1); // Allow small rounding error
    }
    
    // ========== Helper Method Tests ==========
    
    @Test
    public void testSecondsToTimeUnit() {
        TimeUnit result = TimeUtilities.secondsToTimeUnit(10.0, TimeBase.CSOUND_BEATS, context);
        // At 60 BPM: 10 seconds = 10 beats
        assertEquals(10.0, ((TimeUnit.BeatTime) result).getCsoundBeats(), 0.001);
    }
    
    @Test
    public void testTimeUnitToSeconds() {
        TimeUnit.BeatTime bt = TimeUnit.beats(5.0);
        double result = TimeUtilities.timeUnitToSeconds(bt, context);
        // At 60 BPM: 5 beats = 5 seconds
        assertEquals(5.0, result, 0.001);
    }
    
    @Test
    public void testFramesToTimeUnit() {
        TimeUnit result = TimeUtilities.framesToTimeUnit(88200, TimeBase.CSOUND_BEATS, context);
        // At 44100 Hz and 60 BPM: 88200 frames = 2 seconds = 2 beats
        assertEquals(2.0, ((TimeUnit.BeatTime) result).getCsoundBeats(), 0.001);
    }
    
    @Test
    public void testTimeUnitToFrames() {
        TimeUnit.BeatTime bt = TimeUnit.beats(2.0);
        long result = TimeUtilities.timeUnitToFrames(bt, context);
        // At 60 BPM and 44100 Hz: 2 beats = 2 seconds = 88200 frames
        assertEquals(88200, result);
    }
    
    // ========== Meter Change Tests ==========
    
    @Test
    public void testConversionWithMeterChanges() {
        // Add meter change: 3/4 starting at measure 5
        context.getMeterMap().add(new MeasureMeterPair(5, new Meter(3, 4)));
        
        // Bar 6, beat 2 in 3/4
        TimeUnit.BBSTTime bbst = TimeUnit.bbst(6, 2, 1, 0);
        double beats = TimeUtilities.timeUnitToBeats(bbst, context);
        
        // Convert back
        TimeUnit result = TimeUtilities.beatsToTimeUnit(beats, TimeBase.BBST, context);
        TimeUnit.BBSTTime roundTrip = (TimeUnit.BBSTTime) result;
        
        assertEquals(bbst.getBar(), roundTrip.getBar());
        assertEquals(bbst.getBeat(), roundTrip.getBeat());
    }
}
