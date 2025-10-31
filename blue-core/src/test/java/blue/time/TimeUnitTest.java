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
 * Tests for TimeUnit and its subclasses, including conversion, comparison,
 * and arithmetic operations.
 *
 * @author stevenyi
 */
public class TimeUnitTest {
    
    private TimeContext context;
    
    @Before
    public void setUp() {
        // Create a simple TimeContext for testing
        // Tempo: 60 BPM (1 beat per second) - default
        // Meter: 4/4 - default
        // Sample rate: 44100 Hz
        MeterMap meterMap = new MeterMap();
        TempoMap tempoMap = new TempoMap();
        
        context = new TimeContext(44100, meterMap, tempoMap);
    }

    // ========== BeatTime Tests ==========
    
    @Test
    public void testBeatTimeGetTimeBase() {
        TimeUnit.BeatTime bt = TimeUnit.beats(10.0);
        assertEquals(TimeBase.CSOUND_BEATS, bt.getTimeBase());
    }
    
    @Test
    public void testBeatTimeImmutability() {
        TimeUnit.BeatTime bt = TimeUnit.beats(5.5);
        assertEquals(5.5, bt.getCsoundBeats(), 0.001);
    }
    
    @Test
    public void testBeatTimeCopyConstructor() {
        TimeUnit.BeatTime original = TimeUnit.beats(7.5);
        TimeUnit.BeatTime copy = new TimeUnit.BeatTime(original);
        assertEquals(original.getCsoundBeats(), copy.getCsoundBeats(), 0.001);
    }
    
    @Test
    public void testBeatTimeConversions() {
        TimeUnit.BeatTime bt = TimeUnit.beats(4.0);
        
        // toBeats should return the same value
        assertEquals(4.0, bt.toBeats(context), 0.001);
        
        // toSeconds: 60 BPM = 1 beat/second, so 4 beats = 4 seconds
        assertEquals(4.0, bt.toSeconds(context), 0.001);
        
        // toFrames: 4 seconds * 44100 Hz = 176400 frames
        assertEquals(176400, bt.toFrames(context));
    }
    
    @Test
    public void testBeatTimeComparison() {
        TimeUnit.BeatTime bt1 = TimeUnit.beats(4.0);
        TimeUnit.BeatTime bt2 = TimeUnit.beats(6.0);
        TimeUnit.BeatTime bt3 = TimeUnit.beats(4.0);
        
        assertTrue(bt1.lt(context, bt2));
        assertFalse(bt2.lt(context, bt1));
        assertFalse(bt1.lt(context, bt3));
        
        assertTrue(bt2.gt(context, bt1));
        assertFalse(bt1.gt(context, bt2));
        assertFalse(bt1.gt(context, bt3));
        
        assertTrue(bt1.lte(context, bt2));
        assertTrue(bt1.lte(context, bt3));
        assertFalse(bt2.lte(context, bt1));
        
        assertTrue(bt2.gte(context, bt1));
        assertTrue(bt1.gte(context, bt3));
        assertFalse(bt1.gte(context, bt2));
    }
    
    @Test
    public void testBeatTimeArithmetic() {
        TimeUnit.BeatTime bt1 = TimeUnit.beats(4.0);
        TimeUnit.BeatTime bt2 = TimeUnit.beats(2.0);
        
        TimeUnit result = bt1.add(context, bt2);
        assertTrue(result instanceof TimeUnit.BeatTime);
        assertEquals(6.0, ((TimeUnit.BeatTime) result).getCsoundBeats(), 0.001);
        
        result = bt1.subtract(context, bt2);
        assertTrue(result instanceof TimeUnit.BeatTime);
        assertEquals(2.0, ((TimeUnit.BeatTime) result).getCsoundBeats(), 0.001);
    }
    
    @Test
    public void testBeatTimeEqualsAndHashCode() {
        TimeUnit.BeatTime bt1 = TimeUnit.beats(4.0);
        TimeUnit.BeatTime bt2 = TimeUnit.beats(4.0);
        TimeUnit.BeatTime bt3 = TimeUnit.beats(5.0);
        
        assertEquals(bt1, bt2);
        assertNotEquals(bt1, bt3);
        assertEquals(bt1.hashCode(), bt2.hashCode());
    }
    
    // ========== MeasureBeatsTime Tests ==========
    
    @Test
    public void testMeasureBeatsTimeGetTimeBase() {
        TimeUnit.MeasureBeatsTime mbt = TimeUnit.measureBeats(1, 1);
        assertEquals(TimeBase.MEASURE_BEATS, mbt.getTimeBase());
    }
    
    @Test
    public void testMeasureBeatsTimeImmutability() {
        TimeUnit.MeasureBeatsTime mbt = TimeUnit.measureBeats(5, 3.5);
        assertEquals(5, mbt.getMeasureNumber());
        assertEquals(3.5, mbt.getBeatNumber(), 0.001);
    }
    
    @Test
    public void testMeasureBeatsTimeCopyConstructor() {
        TimeUnit.MeasureBeatsTime original = TimeUnit.measureBeats(10, 2.5);
        TimeUnit.MeasureBeatsTime copy = new TimeUnit.MeasureBeatsTime(original);
        assertEquals(original.getMeasureNumber(), copy.getMeasureNumber());
        assertEquals(original.getBeatNumber(), copy.getBeatNumber(), 0.001);
    }
    
    @Test
    public void testMeasureBeatsTimeConversions() {
        // Measure 1, beat 1 = 0 beats (start of first measure)
        TimeUnit.MeasureBeatsTime mbt = TimeUnit.measureBeats(1, 1);
        assertEquals(0.0, mbt.toBeats(context), 0.001);
        
        // Measure 2, beat 1 = 4 beats (start of second measure in 4/4)
        mbt = TimeUnit.measureBeats(2, 1);
        assertEquals(4.0, mbt.toBeats(context), 0.001);
        
        // Measure 1, beat 3 = 2 beats
        mbt = TimeUnit.measureBeats(1, 3);
        assertEquals(2.0, mbt.toBeats(context), 0.001);
        assertEquals(2.0, mbt.toSeconds(context), 0.001); // 2 beats at 60 BPM = 2 seconds
    }
    
    @Test
    public void testMeasureBeatsTimeArithmetic() {
        TimeUnit.MeasureBeatsTime mbt1 = TimeUnit.measureBeats(1, 1); // 0 beats
        TimeUnit.BeatTime bt = TimeUnit.beats(2.0);
        
        TimeUnit result = mbt1.add(context, bt);
        assertTrue(result instanceof TimeUnit.MeasureBeatsTime);
        // 0 + 2 = 2 beats = measure 1, beat 3
        TimeUnit.MeasureBeatsTime mbtResult = (TimeUnit.MeasureBeatsTime) result;
        assertEquals(1, mbtResult.getMeasureNumber());
        assertEquals(3.0, mbtResult.getBeatNumber(), 0.001);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testMeasureBeatsTimeInvalidMeasure() {
        TimeUnit.measureBeats(0, 1);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testMeasureBeatsTimeInvalidBeat() {
        TimeUnit.measureBeats(1, 0.5);
    }
    
    // ========== TimeValue Tests ==========
    
    @Test
    public void testTimeValueGetTimeBase() {
        TimeUnit.TimeValue tv = TimeUnit.time(1, 30, 45, 500);
        assertEquals(TimeBase.TIME, tv.getTimeBase());
    }
    
    @Test
    public void testTimeValueImmutability() {
        TimeUnit.TimeValue tv = TimeUnit.time(2, 15, 30, 250);
        assertEquals(2, tv.getHours());
        assertEquals(15, tv.getMinutes());
        assertEquals(30, tv.getSeconds());
        assertEquals(250, tv.getMilliseconds());
    }
    
    @Test
    public void testTimeValueToTotalSeconds() {
        TimeUnit.TimeValue tv = TimeUnit.time(1, 30, 45, 500);
        // 1*3600 + 30*60 + 45 + 0.5 = 3600 + 1800 + 45 + 0.5 = 5445.5
        assertEquals(5445.5, tv.toTotalSeconds(), 0.001);
        
        tv = TimeUnit.time(0, 0, 0, 0);
        assertEquals(0.0, tv.toTotalSeconds(), 0.001);
        
        tv = TimeUnit.time(0, 1, 0, 0);
        assertEquals(60.0, tv.toTotalSeconds(), 0.001);
    }
    
    @Test
    public void testTimeValueConversions() {
        TimeUnit.TimeValue tv = TimeUnit.time(0, 0, 2, 0); // 2 seconds
        
        // 2 seconds at 60 BPM (1 beat/sec) = 2 beats
        assertEquals(2.0, tv.toBeats(context), 0.001);
        assertEquals(2.0, tv.toSeconds(context), 0.001);
        assertEquals(88200, tv.toFrames(context)); // 2 * 44100
    }
    
    @Test
    public void testTimeValueArithmetic() {
        TimeUnit.TimeValue tv1 = TimeUnit.time(0, 0, 2, 0);
        TimeUnit.TimeValue tv2 = TimeUnit.time(0, 0, 1, 500);
        
        TimeUnit result = tv1.add(context, tv2);
        assertTrue(result instanceof TimeUnit.TimeValue);
        TimeUnit.TimeValue tvResult = (TimeUnit.TimeValue) result;
        assertEquals(0, tvResult.getHours());
        assertEquals(0, tvResult.getMinutes());
        assertEquals(3, tvResult.getSeconds());
        assertEquals(500, tvResult.getMilliseconds());
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testTimeValueInvalidHours() {
        TimeUnit.time(-1, 0, 0, 0);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testTimeValueInvalidMinutes() {
        TimeUnit.time(0, 60, 0, 0);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testTimeValueInvalidSeconds() {
        TimeUnit.time(0, 0, 60, 0);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testTimeValueInvalidMilliseconds() {
        TimeUnit.time(0, 0, 0, 1000);
    }
    
    // ========== SMPTEValue Tests ==========
    
    @Test
    public void testSMPTEValueGetTimeBase() {
        TimeUnit.SMPTEValue sv = TimeUnit.smpte(1, 30, 45, 15);
        assertEquals(TimeBase.SMPTE, sv.getTimeBase());
    }
    
    @Test
    public void testSMPTEValueImmutability() {
        TimeUnit.SMPTEValue sv = TimeUnit.smpte(2, 15, 30, 20);
        assertEquals(2, sv.getHours());
        assertEquals(15, sv.getMinutes());
        assertEquals(30, sv.getSeconds());
        assertEquals(20, sv.getFrames());
    }
    
    @Test
    public void testSMPTEValueToTotalSeconds() {
        // At 30 fps: 1:30:45.15 = 3600 + 1800 + 45 + 15/30 = 5445.5
        TimeUnit.SMPTEValue sv = TimeUnit.smpte(1, 30, 45, 15);
        assertEquals(5445.5, sv.toTotalSeconds(30.0), 0.001);
        
        // At 24 fps
        sv = TimeUnit.smpte(0, 0, 1, 12);
        assertEquals(1.5, sv.toTotalSeconds(24.0), 0.001);
    }
    
    @Test
    public void testSMPTEValueConversions() {
        // 0:00:02:00 at 30fps = 2 seconds
        TimeUnit.SMPTEValue sv = TimeUnit.smpte(0, 0, 2, 0);
        
        assertEquals(2.0, sv.toSeconds(context), 0.001);
        assertEquals(2.0, sv.toBeats(context), 0.001); // 2 sec at 60 BPM
        assertEquals(88200, sv.toFrames(context)); // 2 * 44100
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testSMPTEValueInvalidHours() {
        TimeUnit.smpte(-1, 0, 0, 0);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testSMPTEValueInvalidMinutes() {
        TimeUnit.smpte(0, 60, 0, 0);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testSMPTEValueInvalidSeconds() {
        TimeUnit.smpte(0, 0, 60, 0);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testSMPTEValueInvalidFrames() {
        TimeUnit.smpte(0, 0, 0, -1);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testSMPTEValueToTotalSecondsInvalidFrameRate() {
        TimeUnit.SMPTEValue sv = TimeUnit.smpte(0, 0, 1, 0);
        sv.toTotalSeconds(0.0);
    }
    
    // ========== FrameValue Tests ==========
    
    @Test
    public void testFrameValueGetTimeBase() {
        TimeUnit.FrameValue fv = TimeUnit.frames(44100);
        assertEquals(TimeBase.FRAME, fv.getTimeBase());
    }
    
    @Test
    public void testFrameValueImmutability() {
        TimeUnit.FrameValue fv = TimeUnit.frames(88200);
        assertEquals(88200, fv.getFrameNumber());
    }
    
    @Test
    public void testFrameValueToTotalSeconds() {
        TimeUnit.FrameValue fv = TimeUnit.frames(44100);
        assertEquals(1.0, fv.toTotalSeconds(44100), 0.001);
        
        fv = TimeUnit.frames(88200);
        assertEquals(2.0, fv.toTotalSeconds(44100), 0.001);
        
        fv = TimeUnit.frames(48000);
        assertEquals(1.0, fv.toTotalSeconds(48000), 0.001);
    }
    
    @Test
    public void testFrameValueConversions() {
        TimeUnit.FrameValue fv = TimeUnit.frames(88200); // 2 seconds at 44100 Hz
        
        assertEquals(88200, fv.toFrames(context));
        assertEquals(2.0, fv.toSeconds(context), 0.001);
        assertEquals(2.0, fv.toBeats(context), 0.001); // 2 sec at 60 BPM
    }
    
    @Test
    public void testFrameValueArithmetic() {
        TimeUnit.FrameValue fv1 = TimeUnit.frames(44100);
        TimeUnit.FrameValue fv2 = TimeUnit.frames(22050);
        
        TimeUnit result = fv1.add(context, fv2);
        assertTrue(result instanceof TimeUnit.FrameValue);
        assertEquals(66150, ((TimeUnit.FrameValue) result).getFrameNumber());
        
        result = fv1.subtract(context, fv2);
        assertTrue(result instanceof TimeUnit.FrameValue);
        assertEquals(22050, ((TimeUnit.FrameValue) result).getFrameNumber());
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testFrameValueInvalidFrameNumber() {
        TimeUnit.frames(-1);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testFrameValueToTotalSecondsInvalidSampleRate() {
        TimeUnit.FrameValue fv = TimeUnit.frames(44100);
        fv.toTotalSeconds(0);
    }
}
