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

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Tests for TimeUtilities conversion methods.
 *
 * @author stevenyi
 */
class TimeUtilitiesTest {

    private TimeContext context;
    
    @BeforeEach
    void setUp() {
        context = new TimeContext();
        // Default: 44100 sample rate, 4/4 meter, 60 BPM tempo
    }
    
    // ========== timePositionToBeats Tests ==========
    
    @Test
    void testTimeUnitToBeatsWithBeatTime() {
        TimePosition.BeatTime bt = TimePosition.beats(10.5);
        double result = TimeUtilities.timePositionToBeats(bt, context);
        assertEquals(10.5, result, 0.001);
    }
    
    @Test
    void testTimeUnitToBeatsWithBBSTTime() {
        TimePosition.BBSTTime bbst = TimePosition.bbst(2, 3, 1, 0);
        double result = TimeUtilities.timePositionToBeats(bbst, context);
        // Bar 2, beat 3 in 4/4 = 4 + 2 = 6 beats
        assertEquals(6.0, result, 0.001);
    }
    
    @Test
    void testTimeUnitToBeatsWithTimeValue() {
        // At 60 BPM: 1 beat = 1 second
        TimePosition.TimeValue tv = TimePosition.time(0, 0, 10, 0);
        double result = TimeUtilities.timePositionToBeats(tv, context);
        assertEquals(10.0, result, 0.001);
    }
    
    @Test
    void testTimeUnitToBeatsWithFrameValue() {
        // At 44100 Hz and 60 BPM: 44100 frames = 1 second = 1 beat
        TimePosition.FrameValue fv = TimePosition.frames(44100);
        double result = TimeUtilities.timePositionToBeats(fv, context);
        assertEquals(1.0, result, 0.001);
    }
    
    @Test
    void testTimeUnitToBeatsNullTimePosition() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeUtilities.timePositionToBeats(null, context);
        });
    }
    
    @Test
    void testTimeUnitToBeatsNullContext() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeUtilities.timePositionToBeats(TimePosition.beats(1.0), null);
        });
    }
    
    // ========== beatsToTimePosition Tests ==========
    
    @Test
    void testBeatsToTimeUnitBeatTime() {
        TimePosition result = TimeUtilities.beatsToTimePosition(10.5, TimeBase.BEATS, context);
        assertTrue(result instanceof TimePosition.BeatTime);
        assertEquals(10.5, ((TimePosition.BeatTime) result).getCsoundBeats(), 0.001);
    }
    
    @Test
    void testBeatsToTimeUnitBBSTTime() {
        // 6 beats in 4/4 = bar 2, beat 3
        TimePosition result = TimeUtilities.beatsToTimePosition(6.0, TimeBase.BBST, context);
        assertTrue(result instanceof TimePosition.BBSTTime);
        TimePosition.BBSTTime bbst = (TimePosition.BBSTTime) result;
        assertEquals(2, bbst.getBar());
        assertEquals(3, bbst.getBeat());
    }
    
    @Test
    void testBeatsToTimeUnitTimeValue() {
        // At 60 BPM: 10 beats = 10 seconds
        TimePosition result = TimeUtilities.beatsToTimePosition(10.0, TimeBase.TIME, context);
        assertTrue(result instanceof TimePosition.TimeValue);
        TimePosition.TimeValue tv = (TimePosition.TimeValue) result;
        assertEquals(0, tv.getHours());
        assertEquals(0, tv.getMinutes());
        assertEquals(10, tv.getSeconds());
    }
    
    @Test
    void testBeatsToTimeUnitFrameValue() {
        // At 60 BPM and 44100 Hz: 1 beat = 1 second = 44100 frames
        TimePosition result = TimeUtilities.beatsToTimePosition(1.0, TimeBase.FRAME, context);
        assertTrue(result instanceof TimePosition.FrameValue);
        assertEquals(44100, ((TimePosition.FrameValue) result).getFrameNumber());
    }
    
    // ========== convertTimePosition Tests ==========
    
    @Test
    void testConvertTimeUnitSameTimeBase() {
        TimePosition.BeatTime original = TimePosition.beats(5.0);
        TimePosition result = TimeUtilities.convertTimePosition(original, TimeBase.BEATS, context);
        assertSame(original, result);
    }
    
    @Test
    void testConvertTimeUnitBeatTimeToBBST() {
        TimePosition.BeatTime bt = TimePosition.beats(8.0);
        TimePosition result = TimeUtilities.convertTimePosition(bt, TimeBase.BBST, context);
        assertTrue(result instanceof TimePosition.BBSTTime);
        TimePosition.BBSTTime bbst = (TimePosition.BBSTTime) result;
        // 8 beats in 4/4 = bar 3, beat 1
        assertEquals(3, bbst.getBar());
        assertEquals(1, bbst.getBeat());
    }
    
    @Test
    void testConvertTimeUnitBBSTToTime() {
        TimePosition.BBSTTime bbst = TimePosition.bbst(3, 2, 1, 0);
        TimePosition result = TimeUtilities.convertTimePosition(bbst, TimeBase.TIME, context);
        assertTrue(result instanceof TimePosition.TimeValue);
        // Bar 3, beat 2 = 9 beats at 60 BPM = 9 seconds
        TimePosition.TimeValue tv = (TimePosition.TimeValue) result;
        assertEquals(9, tv.toTotalSeconds(), 0.001);
    }
    
    // ========== Round-trip Conversion Tests ==========
    
    @Test
    void testRoundTripBeatTimeToBBST() {
        TimePosition.BeatTime original = TimePosition.beats(12.0); // Use whole number to avoid tick rounding
        TimePosition intermediate = TimeUtilities.convertTimePosition(original, TimeBase.BBST, context);
        TimePosition result = TimeUtilities.convertTimePosition(intermediate, TimeBase.BEATS, context);
        assertEquals(original.getCsoundBeats(), ((TimePosition.BeatTime) result).getCsoundBeats(), 0.001);
    }
    
    @Test
    void testRoundTripBBSTToTime() {
        TimePosition.BBSTTime original = TimePosition.bbst(5, 3, 1, 0);
        TimePosition intermediate = TimeUtilities.convertTimePosition(original, TimeBase.TIME, context);
        TimePosition result = TimeUtilities.convertTimePosition(intermediate, TimeBase.BBST, context);
        TimePosition.BBSTTime bbst = (TimePosition.BBSTTime) result;
        assertEquals(original.getBar(), bbst.getBar());
        assertEquals(original.getBeat(), bbst.getBeat());
    }
    
    @Test
    void testRoundTripTimeToFrames() {
        TimePosition.TimeValue original = TimePosition.time(0, 1, 30, 0);
        TimePosition intermediate = TimeUtilities.convertTimePosition(original, TimeBase.FRAME, context);
        TimePosition result = TimeUtilities.convertTimePosition(intermediate, TimeBase.TIME, context);
        TimePosition.TimeValue tv = (TimePosition.TimeValue) result;
        assertEquals(original.toTotalSeconds(), tv.toTotalSeconds(), 0.1); // Allow small rounding error
    }
    
    // ========== Helper Method Tests ==========
    
    @Test
    void testSecondsToTimePosition() {
        TimePosition result = TimeUtilities.secondsToTimePosition(10.0, TimeBase.BEATS, context);
        // At 60 BPM: 10 seconds = 10 beats
        assertEquals(10.0, ((TimePosition.BeatTime) result).getCsoundBeats(), 0.001);
    }
    
    @Test
    void testTimeUnitToSeconds() {
        TimePosition.BeatTime bt = TimePosition.beats(5.0);
        double result = TimeUtilities.timePositionToSeconds(bt, context);
        // At 60 BPM: 5 beats = 5 seconds
        assertEquals(5.0, result, 0.001);
    }
    
    @Test
    void testFramesToTimePosition() {
        TimePosition result = TimeUtilities.framesToTimePosition(88200, TimeBase.BEATS, context);
        // At 44100 Hz and 60 BPM: 88200 frames = 2 seconds = 2 beats
        assertEquals(2.0, ((TimePosition.BeatTime) result).getCsoundBeats(), 0.001);
    }
    
    @Test
    void testTimeUnitToFrames() {
        TimePosition.BeatTime bt = TimePosition.beats(2.0);
        long result = TimeUtilities.timePositionToFrames(bt, context);
        // At 60 BPM and 44100 Hz: 2 beats = 2 seconds = 88200 frames
        assertEquals(88200, result);
    }
    
    @Test
    void testFramesToTimePositionNormalizesMillisecondCarry() {
        // 44099 / 44100 = 0.999977... seconds, rounds to exactly 1.000 second
        TimePosition result = TimeUtilities.framesToTimePosition(44099, TimeBase.TIME, context);
        assertTrue(result instanceof TimePosition.TimeValue);
        TimePosition.TimeValue timeValue = (TimePosition.TimeValue) result;
        assertEquals(0, timeValue.getHours());
        assertEquals(0, timeValue.getMinutes());
        assertEquals(1, timeValue.getSeconds());
        assertEquals(0, timeValue.getMilliseconds());
    }
    
    @Test
    void testDefaultContextSampleRateIs44100() {
        // TimeContext with no ProjectProperties wired must default to 44100
        TimeContext ctx = new TimeContext();
        assertEquals(44100L, ctx.getSampleRate());
    }

    @Test
    void testDefaultContextSampleRateUsedForFrameConversion() {
        // Verify frame conversions use the default 44100 when no ProjectProperties is set
        TimeContext ctx = new TimeContext();
        // 44100 frames at 44100 Hz = 1 second = 1 beat at 60 BPM
        TimePosition result = TimeUtilities.beatsToTimePosition(1.0, TimeBase.FRAME, ctx);
        assertTrue(result instanceof TimePosition.FrameValue);
        assertEquals(44100, ((TimePosition.FrameValue) result).getFrameNumber());
    }

    // ========== Meter Change Tests ==========
    
    @Test
    void testConversionWithMeterChanges() {
        // Add meter change: 3/4 starting at measure 5
        context.getMeterMap().add(new MeasureMeterPair(5, new Meter(3, 4)));
        
        // Bar 6, beat 2 in 3/4
        TimePosition.BBSTTime bbst = TimePosition.bbst(6, 2, 1, 0);
        double beats = TimeUtilities.timePositionToBeats(bbst, context);
        
        // Convert back
        TimePosition result = TimeUtilities.beatsToTimePosition(beats, TimeBase.BBST, context);
        TimePosition.BBSTTime roundTrip = (TimePosition.BBSTTime) result;
        
        assertEquals(bbst.getBar(), roundTrip.getBar());
        assertEquals(bbst.getBeat(), roundTrip.getBeat());
    }
}
