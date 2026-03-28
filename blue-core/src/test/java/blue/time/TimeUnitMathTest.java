/*
 * blue - object composition environment for csound
 * Copyright (c) 2026 Steven Yi (stevenyi@gmail.com)
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
 * Tests for TimeUnitMath type-safe arithmetic operations.
 *
 * @author stevenyi
 */
class TimeUnitMathTest {
    
    private TimeContext context;
    
    @BeforeEach
    void setUp() {
        // Tempo: 60 BPM (1 beat per second)
        // Meter: 4/4
        // Sample rate: 44100 Hz
        MeterMap meterMap = new MeterMap();
        TempoMap tempoMap = new TempoMap();
        context = new TimeContext();
        context.setMeterMap(meterMap);
        context.setTempoMap(tempoMap);
        blue.ProjectProperties props = new blue.ProjectProperties();
        props.setSampleRate("44100");
        context.setProjectProperties(props);
    }

    // ========== Position + Duration → Position ==========
    
    @Test
    void testAddDurationToPosition_Beats() {
        TimePosition position = TimePosition.beats(4.0);
        TimeDuration duration = TimeDuration.beats(2.0);
        
        TimePosition result = TimeUnitMath.add(context, position, duration);
        assertTrue(result instanceof TimePosition.BeatTime);
        assertEquals(6.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testAddDurationToPosition_BBF() {
        // Position at bar 1, beat 1 (= 0 beats)
        TimePosition position = TimePosition.bbf(1, 1, 0);
        // Duration of 1 bar (= 4 beats in 4/4)
        TimeDuration duration = TimeDuration.beats(4.0);
        
        TimePosition result = TimeUnitMath.add(context, position, duration);
        // Result should be BBF (preserves position's TimeBase)
        assertTrue(result instanceof TimePosition.BBFTime);
        assertEquals(4.0, result.toBeats(context), 0.001);
        // Should be bar 2, beat 1
        TimePosition.BBFTime bbf = (TimePosition.BBFTime) result;
        assertEquals(2, bbf.getBar());
        assertEquals(1, bbf.getBeat());
        assertEquals(0, bbf.getFraction());
    }

    @Test
    void testFromTimePosition_WithTargetSecondsTimeBase() {
        TimePosition tu = TimePosition.time(0, 0, 4, 500);
        TimeDuration result = TimeUnitMath.fromTimePosition(tu, TimeBase.SECONDS, context);
        assertTrue(result instanceof TimeDuration.DurationSeconds);
        assertEquals(4.5, ((TimeDuration.DurationSeconds) result).getTotalSeconds(), 0.001);
    }
    
    @Test
    void testAddDurationToPosition_BBT() {
        TimePosition position = TimePosition.bbt(1, 1, 0); // 0 beats
        TimeDuration duration = TimeDuration.beats(2.5);
        
        TimePosition result = TimeUnitMath.add(context, position, duration);
        assertTrue(result instanceof TimePosition.BBTTime);
        assertEquals(2.5, result.toBeats(context), 0.001);
    }
    
    @Test
    void testAddDurationToPosition_ZeroDuration() {
        TimePosition position = TimePosition.beats(10.0);
        TimeDuration duration = TimeDuration.beats(0.0);
        
        TimePosition result = TimeUnitMath.add(context, position, duration);
        assertEquals(10.0, result.toBeats(context), 0.001);
    }

    @Test
    void testAddDurationToPosition_SecondsPreservesTimeBase() {
        TimePosition position = TimePosition.seconds(2.0);
        TimeDuration duration = TimeDuration.beats(1.5);

        TimePosition result = TimeUnitMath.add(context, position, duration);
        assertTrue(result instanceof TimePosition.SecondsValue);
        assertEquals(3.5, ((TimePosition.SecondsValue) result).getTotalSeconds(), 0.001);
    }
    
    @Test
    void testAddDurationBBTToPositionBBF() {
        // Position at bar 2, beat 1 (= 4 beats)
        TimePosition position = TimePosition.bbf(2, 1, 0);
        // Duration of 1 bar, 2 beats (= 6 beats in 4/4)
        TimeDuration duration = TimeDuration.bbt(1, 2, 0);
        
        TimePosition result = TimeUnitMath.add(context, position, duration);
        // Result preserves BBF (position's TimeBase)
        assertTrue(result instanceof TimePosition.BBFTime);
        assertEquals(10.0, result.toBeats(context), 0.001);
    }
    
    // ========== Position − Position → Duration ==========
    
    @Test
    void testDistance_Basic() {
        TimePosition from = TimePosition.beats(2.0);
        TimePosition to = TimePosition.beats(6.0);
        
        TimeDuration result = TimeUnitMath.distance(context, from, to);
        assertEquals(4.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testDistance_Reversed() {
        // distance() returns absolute value
        TimePosition from = TimePosition.beats(6.0);
        TimePosition to = TimePosition.beats(2.0);
        
        TimeDuration result = TimeUnitMath.distance(context, from, to);
        assertEquals(4.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testDistance_SamePosition() {
        TimePosition pos = TimePosition.beats(5.0);
        
        TimeDuration result = TimeUnitMath.distance(context, pos, pos);
        assertEquals(0.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testDistance_MixedTypes() {
        TimePosition from = TimePosition.bbf(1, 1, 0); // 0 beats
        TimePosition to = TimePosition.beats(4.0);
        
        TimeDuration result = TimeUnitMath.distance(context, from, to);
        assertEquals(4.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testForwardDistance_Normal() {
        TimePosition from = TimePosition.beats(2.0);
        TimePosition to = TimePosition.beats(6.0);
        
        TimeDuration result = TimeUnitMath.forwardDistance(context, from, to);
        assertEquals(4.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testForwardDistance_Reversed_ClampedToZero() {
        TimePosition from = TimePosition.beats(6.0);
        TimePosition to = TimePosition.beats(2.0);
        
        TimeDuration result = TimeUnitMath.forwardDistance(context, from, to);
        assertEquals(0.0, result.toBeats(context), 0.001);
    }
    
    // ========== Duration + Duration → Duration ==========
    
    @Test
    void testAddDurations() {
        TimeDuration a = TimeDuration.beats(3.0);
        TimeDuration b = TimeDuration.beats(2.0);
        
        TimeDuration result = TimeUnitMath.add(context, a, b);
        assertEquals(5.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testAddDurations_MixedTypes() {
        TimeDuration a = TimeDuration.beats(4.0);
        TimeDuration b = TimeDuration.bbt(0, 2, 0); // 2 beats in 4/4
        
        TimeDuration result = TimeUnitMath.add(context, a, b);
        assertEquals(6.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testAddDurations_Zero() {
        TimeDuration a = TimeDuration.beats(4.0);
        TimeDuration b = TimeDuration.beats(0.0);
        
        TimeDuration result = TimeUnitMath.add(context, a, b);
        assertEquals(4.0, result.toBeats(context), 0.001);
    }
    
    // ========== Duration − Duration → Duration ==========
    
    @Test
    void testSubtractDurations() {
        TimeDuration a = TimeDuration.beats(5.0);
        TimeDuration b = TimeDuration.beats(2.0);
        
        TimeDuration result = TimeUnitMath.subtract(context, a, b);
        assertEquals(3.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testSubtractDurations_ClampedToZero() {
        TimeDuration a = TimeDuration.beats(2.0);
        TimeDuration b = TimeDuration.beats(5.0);
        
        TimeDuration result = TimeUnitMath.subtract(context, a, b);
        assertEquals(0.0, result.toBeats(context), 0.001);
    }
    
    // ========== Position − Duration → Position ==========
    
    @Test
    void testSubtractDurationFromPosition() {
        TimePosition position = TimePosition.beats(6.0);
        TimeDuration duration = TimeDuration.beats(2.0);
        
        TimePosition result = TimeUnitMath.subtract(context, position, duration);
        assertTrue(result instanceof TimePosition.BeatTime);
        assertEquals(4.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testSubtractDurationFromPosition_ClampedToZero() {
        TimePosition position = TimePosition.beats(2.0);
        TimeDuration duration = TimeDuration.beats(5.0);
        
        TimePosition result = TimeUnitMath.subtract(context, position, duration);
        assertEquals(0.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testSubtractDurationFromPosition_PreservesTimeBase() {
        TimePosition position = TimePosition.bbf(3, 1, 0); // 8 beats
        TimeDuration duration = TimeDuration.beats(4.0);
        
        TimePosition result = TimeUnitMath.subtract(context, position, duration);
        assertTrue(result instanceof TimePosition.BBFTime);
        assertEquals(4.0, result.toBeats(context), 0.001);
    }
    
    // ========== convertDuration ==========
    
    @Test
    void testConvertDuration_BeatsToBBF() {
        TimeDuration dur = TimeDuration.beats(4.0); // 1 bar in 4/4
        
        TimeDuration result = TimeUnitMath.convertDuration(dur, TimeBase.BBF, context);
        assertTrue(result instanceof TimeDuration.DurationBBF);
        TimeDuration.DurationBBF bbf = (TimeDuration.DurationBBF) result;
        assertEquals(1, bbf.getBars());
        assertEquals(0, bbf.getBeats());
        assertEquals(0, bbf.getFraction());
    }
    
    @Test
    void testConvertDuration_BeatsToBBT() {
        TimeDuration dur = TimeDuration.beats(6.0); // 1 bar + 2 beats in 4/4
        
        TimeDuration result = TimeUnitMath.convertDuration(dur, TimeBase.BBT, context);
        assertTrue(result instanceof TimeDuration.DurationBBT);
        TimeDuration.DurationBBT bbt = (TimeDuration.DurationBBT) result;
        assertEquals(1, bbt.getBars());
        assertEquals(2, bbt.getBeats());
        assertEquals(0, bbt.getTicks());
    }
    
    @Test
    void testConvertDuration_BeatsToBBST() {
        TimeDuration dur = TimeDuration.beats(4.5); // 1 bar + 0.5 beats in 4/4
        
        TimeDuration result = TimeUnitMath.convertDuration(dur, TimeBase.BBST, context);
        assertTrue(result instanceof TimeDuration.DurationBBST);
        TimeDuration.DurationBBST bbst = (TimeDuration.DurationBBST) result;
        assertEquals(1, bbst.getBars());
        assertEquals(0, bbst.getBeats());
        // 0.5 beats = 2 sixteenths
        assertEquals(2, bbst.getSixteenth());
        assertEquals(0, bbst.getTicks());
    }
    
    @Test
    void testConvertDuration_BeatsToTime() {
        TimeDuration dur = TimeDuration.beats(2.0); // 2 seconds at 60 BPM
        
        TimeDuration result = TimeUnitMath.convertDuration(dur, TimeBase.TIME, context);
        assertTrue(result instanceof TimeDuration.DurationTime);
        TimeDuration.DurationTime time = (TimeDuration.DurationTime) result;
        assertEquals(0, time.getHours());
        assertEquals(0, time.getMinutes());
        assertEquals(2, time.getSeconds());
        assertEquals(0, time.getMilliseconds());
    }

    @Test
    void testConvertDuration_BeatsToSeconds() {
        TimeDuration dur = TimeDuration.beats(2.5);

        TimeDuration result = TimeUnitMath.convertDuration(dur, TimeBase.SECONDS, context);
        assertTrue(result instanceof TimeDuration.DurationSeconds);
        assertEquals(2.5, ((TimeDuration.DurationSeconds) result).getTotalSeconds(), 0.001);
    }
    
    @Test
    void testConvertDuration_BeatsToFrames() {
        TimeDuration dur = TimeDuration.beats(1.0); // 1 second at 60 BPM
        
        TimeDuration result = TimeUnitMath.convertDuration(dur, TimeBase.FRAME, context);
        assertTrue(result instanceof TimeDuration.DurationFrames);
        assertEquals(44100, ((TimeDuration.DurationFrames) result).getFrameCount());
    }
    
    @Test
    void testConvertDuration_SameTimeBase_ReturnsSame() {
        TimeDuration dur = TimeDuration.beats(4.0);
        
        TimeDuration result = TimeUnitMath.convertDuration(dur, TimeBase.BEATS, context);
        assertSame(dur, result);
    }
    
    // ========== beatsToDuration ==========
    
    @Test
    void testBeatsToDuration_Zero() {
        TimeDuration result = TimeUnitMath.beatsToDuration(0.0, TimeBase.BBF, context);
        assertTrue(result instanceof TimeDuration.DurationBBF);
        TimeDuration.DurationBBF bbf = (TimeDuration.DurationBBF) result;
        assertEquals(0, bbf.getBars());
        assertEquals(0, bbf.getBeats());
        assertEquals(0, bbf.getFraction());
    }
    
    @Test
    void testBeatsToDuration_NegativeClamped() {
        TimeDuration result = TimeUnitMath.beatsToDuration(-5.0, TimeBase.BEATS, context);
        assertEquals(0.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testBeatsToDuration_BBF_FourBeats() {
        // 4 beats in 4/4 = 1 bar, 0 beats, 0 fraction
        TimeDuration result = TimeUnitMath.beatsToDuration(4.0, TimeBase.BBF, context);
        assertTrue(result instanceof TimeDuration.DurationBBF);
        TimeDuration.DurationBBF bbf = (TimeDuration.DurationBBF) result;
        assertEquals(1, bbf.getBars());
        assertEquals(0, bbf.getBeats());
        assertEquals(0, bbf.getFraction());
    }
    
    @Test
    void testBeatsToDuration_BBF_FiveAndHalfBeats() {
        // 5.5 beats in 4/4 = 1 bar, 1 beat, fraction 50
        TimeDuration result = TimeUnitMath.beatsToDuration(5.5, TimeBase.BBF, context);
        assertTrue(result instanceof TimeDuration.DurationBBF);
        TimeDuration.DurationBBF bbf = (TimeDuration.DurationBBF) result;
        assertEquals(1, bbf.getBars());
        assertEquals(1, bbf.getBeats());
        assertEquals(50, bbf.getFraction());
    }
    
    // ========== fromTimePosition Bridge ==========
    
    @Test
    void testFromTimePosition_BeatTime() {
        TimePosition tu = TimePosition.beats(4.0);
        TimeDuration result = TimeUnitMath.fromTimePosition(tu, context);
        assertEquals(4.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testFromTimePosition_BBFPosition() {
        // BBF position bar 2, beat 1 = 4 beats
        TimePosition tu = TimePosition.bbf(2, 1, 0);
        TimeDuration result = TimeUnitMath.fromTimePosition(tu, context);
        // The beat value (4.0) is interpreted as duration
        assertEquals(4.0, result.toBeats(context), 0.001);
    }
    
    @Test
    void testFromTimePosition_WithTargetTimeBase() {
        TimePosition tu = TimePosition.beats(4.0);
        TimeDuration result = TimeUnitMath.fromTimePosition(tu, TimeBase.BBF, context);
        assertTrue(result instanceof TimeDuration.DurationBBF);
        TimeDuration.DurationBBF bbf = (TimeDuration.DurationBBF) result;
        assertEquals(1, bbf.getBars());
        assertEquals(0, bbf.getBeats());
        assertEquals(0, bbf.getFraction());
    }
    
    // ========== Non-4/4 Meter Tests ==========
    
    @Test
    void testConvertDuration_BBF_In34() {
        MeterMap meterMap = new MeterMap();
        meterMap.set(0, new MeasureMeterPair(1, new Meter(3, 4)));
        TempoMap tempoMap = new TempoMap();
        TimeContext ctx34 = new TimeContext();
        ctx34.setMeterMap(meterMap);
        ctx34.setTempoMap(tempoMap);
        blue.ProjectProperties props34 = new blue.ProjectProperties();
        props34.setSampleRate("44100");
        ctx34.setProjectProperties(props34);
        
        // 3 beats = 1 bar in 3/4
        TimeDuration result = TimeUnitMath.beatsToDuration(3.0, TimeBase.BBF, ctx34);
        assertTrue(result instanceof TimeDuration.DurationBBF);
        TimeDuration.DurationBBF bbf = (TimeDuration.DurationBBF) result;
        assertEquals(1, bbf.getBars());
        assertEquals(0, bbf.getBeats());
        assertEquals(0, bbf.getFraction());
    }
    
    @Test
    void testAddPositionDuration_In34() {
        MeterMap meterMap = new MeterMap();
        meterMap.set(0, new MeasureMeterPair(1, new Meter(3, 4)));
        TempoMap tempoMap = new TempoMap();
        TimeContext ctx34 = new TimeContext();
        ctx34.setMeterMap(meterMap);
        ctx34.setTempoMap(tempoMap);
        blue.ProjectProperties props34b = new blue.ProjectProperties();
        props34b.setSampleRate("44100");
        ctx34.setProjectProperties(props34b);
        
        // Position at bar 1, beat 1 (0 beats)
        TimePosition position = TimePosition.beats(0.0);
        // Duration of 1 bar in 3/4 (3 beats)
        TimeDuration duration = TimeDuration.bbt(1, 0, 0);
        
        TimePosition result = TimeUnitMath.add(ctx34, position, duration);
        assertEquals(3.0, result.toBeats(ctx34), 0.001);
    }
}
