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
import org.junit.Test;

/**
 * Tests for TimeUnit and its subclasses.
 *
 * @author stevenyi
 */
public class TimeUnitTest {

    // ========== BeatTime Tests ==========
    
    @Test
    public void testBeatTimeGetTimeBase() {
        TimeUnit.BeatTime bt = TimeUnit.beats(10.0);
        assertEquals(TimeBase.CSOUND_BEATS, bt.getTimeBase());
    }
    
    @Test
    public void testBeatTimeBasicOperations() {
        TimeUnit.BeatTime bt = TimeUnit.beats(5.5);
        assertEquals(5.5, bt.getCsoundBeats(), 0.001);
        
        bt.setCsoundBeats(10.25);
        assertEquals(10.25, bt.getCsoundBeats(), 0.001);
    }
    
    @Test
    public void testBeatTimeCopyConstructor() {
        TimeUnit.BeatTime original = TimeUnit.beats(7.5);
        TimeUnit.BeatTime copy = new TimeUnit.BeatTime(original);
        assertEquals(original.getCsoundBeats(), copy.getCsoundBeats(), 0.001);
    }
    
    // ========== MeasureBeatsTime Tests ==========
    
    @Test
    public void testMeasureBeatsTimeGetTimeBase() {
        TimeUnit.MeasureBeatsTime mbt = TimeUnit.measureBeats(1, 1);
        assertEquals(TimeBase.MEASURE_BEATS, mbt.getTimeBase());
    }
    
    @Test
    public void testMeasureBeatsTimeBasicOperations() {
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
    
    @Test(expected = IllegalArgumentException.class)
    public void testMeasureBeatsTimeInvalidMeasure() {
        TimeUnit.measureBeats(0, 1);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testMeasureBeatsTimeInvalidBeat() {
        TimeUnit.measureBeats(1, 0.5);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testMeasureBeatsTimeSetInvalidMeasure() {
        TimeUnit.MeasureBeatsTime mbt = TimeUnit.measureBeats(1, 1);
        mbt.setMeasure(-1);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testMeasureBeatsTimeSetInvalidBeat() {
        TimeUnit.MeasureBeatsTime mbt = TimeUnit.measureBeats(1, 1);
        mbt.setBeatNumber(0.0);
    }
    
    // ========== TimeValue Tests ==========
    
    @Test
    public void testTimeValueGetTimeBase() {
        TimeUnit.TimeValue tv = TimeUnit.time(1, 30, 45, 500);
        assertEquals(TimeBase.TIME, tv.getTimeBase());
    }
    
    @Test
    public void testTimeValueBasicOperations() {
        TimeUnit.TimeValue tv = TimeUnit.time(2, 15, 30, 250);
        assertEquals(2, tv.getHours());
        assertEquals(15, tv.getMinutes());
        assertEquals(30, tv.getSeconds());
        assertEquals(250, tv.getMilliseconds());
    }
    
    @Test
    public void testTimeValueToSeconds() {
        TimeUnit.TimeValue tv = TimeUnit.time(1, 30, 45, 500);
        // 1*3600 + 30*60 + 45 + 0.5 = 3600 + 1800 + 45 + 0.5 = 5445.5
        assertEquals(5445.5, tv.toSeconds(), 0.001);
        
        tv = TimeUnit.time(0, 0, 0, 0);
        assertEquals(0.0, tv.toSeconds(), 0.001);
        
        tv = TimeUnit.time(0, 1, 0, 0);
        assertEquals(60.0, tv.toSeconds(), 0.001);
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
    public void testSMPTEValueBasicOperations() {
        TimeUnit.SMPTEValue sv = TimeUnit.smpte(2, 15, 30, 20);
        assertEquals(2, sv.getHours());
        assertEquals(15, sv.getMinutes());
        assertEquals(30, sv.getSeconds());
        assertEquals(20, sv.getFrames());
    }
    
    @Test
    public void testSMPTEValueToSeconds() {
        // At 30 fps: 1:30:45.15 = 3600 + 1800 + 45 + 15/30 = 5445.5
        TimeUnit.SMPTEValue sv = TimeUnit.smpte(1, 30, 45, 15);
        assertEquals(5445.5, sv.toSeconds(30.0), 0.001);
        
        // At 24 fps
        sv = TimeUnit.smpte(0, 0, 1, 12);
        assertEquals(1.5, sv.toSeconds(24.0), 0.001);
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
    public void testSMPTEValueToSecondsInvalidFrameRate() {
        TimeUnit.SMPTEValue sv = TimeUnit.smpte(0, 0, 1, 0);
        sv.toSeconds(0.0);
    }
    
    // ========== FrameValue Tests ==========
    
    @Test
    public void testFrameValueGetTimeBase() {
        TimeUnit.FrameValue fv = TimeUnit.frames(44100);
        assertEquals(TimeBase.FRAME, fv.getTimeBase());
    }
    
    @Test
    public void testFrameValueBasicOperations() {
        TimeUnit.FrameValue fv = TimeUnit.frames(88200);
        assertEquals(88200, fv.getFrameNumber());
        
        fv.setFrameNumber(44100);
        assertEquals(44100, fv.getFrameNumber());
    }
    
    @Test
    public void testFrameValueToSeconds() {
        TimeUnit.FrameValue fv = TimeUnit.frames(44100);
        assertEquals(1.0, fv.toSeconds(44100), 0.001);
        
        fv = TimeUnit.frames(88200);
        assertEquals(2.0, fv.toSeconds(44100), 0.001);
        
        fv = TimeUnit.frames(48000);
        assertEquals(1.0, fv.toSeconds(48000), 0.001);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testFrameValueInvalidFrameNumber() {
        TimeUnit.frames(-1);
    }
    
    @Test(expected = IllegalArgumentException.class)
    public void testFrameValueToSecondsInvalidSampleRate() {
        TimeUnit.FrameValue fv = TimeUnit.frames(44100);
        fv.toSeconds(0);
    }
}
