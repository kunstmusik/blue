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
 * Tests for TimeDuration and its subclasses, including conversion,
 * equality, and XML serialization.
 *
 * @author stevenyi
 */
class TimeDurationTest {
    
    private TimeContext context;
    
    @BeforeEach
    void setUp() {
        // Tempo: 60 BPM (1 beat per second) - default
        // Meter: 4/4 - default
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

    // ========== DurationBeats Tests ==========
    
    @Test
    void testDurationBeatsGetTimeBase() {
        TimeDuration.DurationBeats db = TimeDuration.beats(4.0);
        assertEquals(TimeBase.BEATS, db.getTimeBase());
    }
    
    @Test
    void testDurationBeatsZero() {
        assertEquals(0.0, TimeDuration.DurationBeats.ZERO.getCsoundBeats(), 0.001);
    }
    
    @Test
    void testDurationBeatsConversions() {
        TimeDuration.DurationBeats db = TimeDuration.beats(4.0);
        
        assertEquals(4.0, db.toBeats(context), 0.001);
        // 60 BPM = 1 beat/second, so 4 beats = 4 seconds
        assertEquals(4.0, db.toSeconds(context), 0.001);
        // 4 seconds * 44100 Hz = 176400 frames
        assertEquals(176400, db.toFrames(context));
    }
    
    @Test
    void testDurationBeatsEquality() {
        TimeDuration.DurationBeats a = TimeDuration.beats(4.0);
        TimeDuration.DurationBeats b = TimeDuration.beats(4.0);
        TimeDuration.DurationBeats c = TimeDuration.beats(5.0);
        
        assertEquals(a, b);
        assertNotEquals(a, c);
        assertEquals(a.hashCode(), b.hashCode());
    }
    
    @Test
    void testDurationBeatsNegative() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.beats(-1.0);
        });
    }
    
    // ========== DurationBBT Tests ==========
    
    @Test
    void testDurationBBTGetTimeBase() {
        TimeDuration.DurationBBT d = TimeDuration.bbt(0, 0, 0);
        assertEquals(TimeBase.BBT, d.getTimeBase());
    }
    
    @Test
    void testDurationBBTZero() {
        TimeDuration.DurationBBT zero = TimeDuration.DurationBBT.ZERO;
        assertEquals(0, zero.getBars());
        assertEquals(0, zero.getBeats());
        assertEquals(0, zero.getTicks());
        assertEquals(0.0, zero.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBTOneMeasureIn44() {
        // 1 bar in 4/4 = 4 beats
        TimeDuration.DurationBBT d = TimeDuration.bbt(1, 0, 0);
        assertEquals(4.0, d.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBTOneBarTwoBeatsIn44() {
        // 1 bar + 2 beats in 4/4 = 6 beats
        TimeDuration.DurationBBT d = TimeDuration.bbt(1, 2, 0);
        assertEquals(6.0, d.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBTWithTicks() {
        // 0 bars, 0 beats, 480 ticks at PPQ=960 = 0.5 beats
        TimeDuration.DurationBBT d = TimeDuration.bbt(0, 0, 480);
        assertEquals(0.5, d.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBTSecondsAndFrames() {
        // 1 bar in 4/4 = 4 beats = 4 seconds at 60 BPM
        TimeDuration.DurationBBT d = TimeDuration.bbt(1, 0, 0);
        assertEquals(4.0, d.toSeconds(context), 0.001);
        assertEquals(176400, d.toFrames(context));
    }
    
    @Test
    void testDurationBBTEquality() {
        TimeDuration.DurationBBT a = TimeDuration.bbt(1, 2, 100);
        TimeDuration.DurationBBT b = TimeDuration.bbt(1, 2, 100);
        TimeDuration.DurationBBT c = TimeDuration.bbt(1, 3, 100);
        
        assertEquals(a, b);
        assertNotEquals(a, c);
        assertEquals(a.hashCode(), b.hashCode());
    }
    
    @Test
    void testDurationBBTNegativeBars() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.bbt(-1, 0, 0);
        });
    }
    
    @Test
    void testDurationBBTNegativeBeats() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.bbt(0, -1, 0);
        });
    }
    
    @Test
    void testDurationBBTNegativeTicks() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.bbt(0, 0, -1);
        });
    }
    
    // ========== DurationBBST Tests ==========
    
    @Test
    void testDurationBBSTGetTimeBase() {
        TimeDuration.DurationBBST d = TimeDuration.bbst(0, 0, 0, 0);
        assertEquals(TimeBase.BBST, d.getTimeBase());
    }
    
    @Test
    void testDurationBBSTZero() {
        TimeDuration.DurationBBST zero = TimeDuration.DurationBBST.ZERO;
        assertEquals(0, zero.getBars());
        assertEquals(0, zero.getBeats());
        assertEquals(0, zero.getSixteenth());
        assertEquals(0, zero.getTicks());
        assertEquals(0.0, zero.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBSTOneMeasureIn44() {
        // 1 bar in 4/4 = 4 beats
        TimeDuration.DurationBBST d = TimeDuration.bbst(1, 0, 0, 0);
        assertEquals(4.0, d.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBSTWithSixteenth() {
        // 0 bars, 0 beats, 2 sixteenths = 0.5 beats (each sixteenth = 0.25 beats)
        TimeDuration.DurationBBST d = TimeDuration.bbst(0, 0, 2, 0);
        assertEquals(0.5, d.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBSTTotalTicks() {
        // sixteenth=2, ticks=60 at PPQ=960 → ticksPerSixteenth=240
        // totalTicks = 2*240 + 60 = 540
        TimeDuration.DurationBBST d = TimeDuration.bbst(0, 0, 2, 60);
        assertEquals(540, d.toTotalTicks(960));
    }
    
    @Test
    void testDurationBBSTEquality() {
        TimeDuration.DurationBBST a = TimeDuration.bbst(1, 2, 1, 30);
        TimeDuration.DurationBBST b = TimeDuration.bbst(1, 2, 1, 30);
        TimeDuration.DurationBBST c = TimeDuration.bbst(1, 2, 2, 30);
        
        assertEquals(a, b);
        assertNotEquals(a, c);
        assertEquals(a.hashCode(), b.hashCode());
    }
    
    @Test
    void testDurationBBSTNegativeBars() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.bbst(-1, 0, 0, 0);
        });
    }
    
    @Test
    void testDurationBBSTInvalidSixteenth() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.bbst(0, 0, 4, 0); // must be 0-3
        });
    }
    
    // ========== DurationBBF Tests ==========
    
    @Test
    void testDurationBBFGetTimeBase() {
        TimeDuration.DurationBBF d = TimeDuration.bbf(0, 0, 0);
        assertEquals(TimeBase.BBF, d.getTimeBase());
    }
    
    @Test
    void testDurationBBFZero() {
        TimeDuration.DurationBBF zero = TimeDuration.DurationBBF.ZERO;
        assertEquals(0, zero.getBars());
        assertEquals(0, zero.getBeats());
        assertEquals(0, zero.getFraction());
        assertEquals(0.0, zero.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBFOneMeasureIn44() {
        // 1 bar in 4/4 = 4 beats
        TimeDuration.DurationBBF d = TimeDuration.bbf(1, 0, 0);
        assertEquals(4.0, d.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBFWithFraction() {
        // 0 bars, 0 beats, fraction 50 = 0.5 beats
        TimeDuration.DurationBBF d = TimeDuration.bbf(0, 0, 50);
        assertEquals(0.5, d.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBFOneBarTwoBeats() {
        // 1 bar + 2 beats in 4/4 = 6 beats
        TimeDuration.DurationBBF d = TimeDuration.bbf(1, 2, 0);
        assertEquals(6.0, d.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBFEquality() {
        TimeDuration.DurationBBF a = TimeDuration.bbf(1, 2, 50);
        TimeDuration.DurationBBF b = TimeDuration.bbf(1, 2, 50);
        TimeDuration.DurationBBF c = TimeDuration.bbf(1, 2, 75);
        
        assertEquals(a, b);
        assertNotEquals(a, c);
        assertEquals(a.hashCode(), b.hashCode());
    }
    
    @Test
    void testDurationBBFNegativeBars() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.bbf(-1, 0, 0);
        });
    }
    
    @Test
    void testDurationBBFInvalidFraction() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.bbf(0, 0, 100); // must be 0-99
        });
    }
    
    // ========== DurationTime Tests ==========
    
    @Test
    void testDurationTimeGetTimeBase() {
        TimeDuration.DurationTime d = TimeDuration.time(0, 0, 2, 0);
        assertEquals(TimeBase.TIME, d.getTimeBase());
    }
    
    @Test
    void testDurationTimeZero() {
        TimeDuration.DurationTime zero = TimeDuration.DurationTime.ZERO;
        assertEquals(0.0, zero.toTotalSeconds(), 0.001);
    }
    
    @Test
    void testDurationTimeConversions() {
        TimeDuration.DurationTime d = TimeDuration.time(0, 0, 2, 0); // 2 seconds
        
        assertEquals(2.0, d.toBeats(context), 0.001); // 60 BPM
        assertEquals(2.0, d.toSeconds(context), 0.001);
        assertEquals(88200, d.toFrames(context)); // 2 * 44100
    }
    
    @Test
    void testDurationTimeTotalSeconds() {
        TimeDuration.DurationTime d = TimeDuration.time(1, 30, 45, 500);
        assertEquals(5445.5, d.toTotalSeconds(), 0.001);
    }
    
    @Test
    void testDurationTimeEquality() {
        TimeDuration.DurationTime a = TimeDuration.time(0, 1, 30, 500);
        TimeDuration.DurationTime b = TimeDuration.time(0, 1, 30, 500);
        TimeDuration.DurationTime c = TimeDuration.time(0, 1, 30, 501);
        
        assertEquals(a, b);
        assertNotEquals(a, c);
    }
    
    @Test
    void testDurationTimeNegativeHours() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.time(-1, 0, 0, 0);
        });
    }
    
    @Test
    void testDurationTimeInvalidMinutes() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.time(0, 60, 0, 0);
        });
    }
    
    @Test
    void testDurationTimeInvalidSeconds() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.time(0, 0, 60, 0);
        });
    }
    
    @Test
    void testDurationTimeInvalidMilliseconds() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.time(0, 0, 0, 1000);
        });
    }
    
    // ========== DurationFrames Tests ==========
    
    @Test
    void testDurationFramesGetTimeBase() {
        TimeDuration.DurationFrames d = TimeDuration.frames(44100);
        assertEquals(TimeBase.FRAME, d.getTimeBase());
    }
    
    @Test
    void testDurationFramesConversions() {
        TimeDuration.DurationFrames d = TimeDuration.frames(88200); // 2 seconds at 44100 Hz
        
        assertEquals(88200, d.toFrames(context));
        assertEquals(2.0, d.toSeconds(context), 0.001);
        assertEquals(2.0, d.toBeats(context), 0.001); // 60 BPM
    }
    
    @Test
    void testDurationFramesTotalSeconds() {
        TimeDuration.DurationFrames d = TimeDuration.frames(44100);
        assertEquals(1.0, d.toTotalSeconds(44100), 0.001);
    }
    
    @Test
    void testDurationFramesEquality() {
        TimeDuration.DurationFrames a = TimeDuration.frames(44100);
        TimeDuration.DurationFrames b = TimeDuration.frames(44100);
        TimeDuration.DurationFrames c = TimeDuration.frames(88200);
        
        assertEquals(a, b);
        assertNotEquals(a, c);
    }
    
    @Test
    void testDurationFramesNegative() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.frames(-1);
        });
    }
    
    @Test
    void testDurationFramesInvalidSampleRate() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimeDuration.frames(44100).toTotalSeconds(0);
        });
    }
    
    // ========== XML Serialization Tests ==========
    
    @Test
    void testDurationBeatsXMLRoundTrip() throws Exception {
        TimeDuration original = TimeDuration.beats(4.5);
        var xml = original.saveAsXML();
        TimeDuration loaded = TimeDuration.loadFromXML(xml);
        assertEquals(original, loaded);
    }
    
    @Test
    void testDurationBBTXMLRoundTrip() throws Exception {
        TimeDuration original = TimeDuration.bbt(2, 3, 120);
        var xml = original.saveAsXML();
        TimeDuration loaded = TimeDuration.loadFromXML(xml);
        assertEquals(original, loaded);
    }
    
    @Test
    void testDurationBBSTXMLRoundTrip() throws Exception {
        TimeDuration original = TimeDuration.bbst(1, 2, 3, 60);
        var xml = original.saveAsXML();
        TimeDuration loaded = TimeDuration.loadFromXML(xml);
        assertEquals(original, loaded);
    }
    
    @Test
    void testDurationBBFXMLRoundTrip() throws Exception {
        TimeDuration original = TimeDuration.bbf(3, 2, 75);
        var xml = original.saveAsXML();
        TimeDuration loaded = TimeDuration.loadFromXML(xml);
        assertEquals(original, loaded);
    }
    
    @Test
    void testDurationTimeXMLRoundTrip() throws Exception {
        TimeDuration original = TimeDuration.time(1, 30, 45, 500);
        var xml = original.saveAsXML();
        TimeDuration loaded = TimeDuration.loadFromXML(xml);
        assertEquals(original, loaded);
    }
    
    @Test
    void testDurationFramesXMLRoundTrip() throws Exception {
        TimeDuration original = TimeDuration.frames(88200);
        var xml = original.saveAsXML();
        TimeDuration loaded = TimeDuration.loadFromXML(xml);
        assertEquals(original, loaded);
    }
    
    @Test
    void testLoadFromXMLMissingType() throws Exception {
        assertThrows(Exception.class, () -> {
            var element = new electric.xml.Element("timeDuration");
            TimeDuration.loadFromXML(element);
        });
    }
    
    @Test
    void testLoadFromXMLUnknownType() throws Exception {
        assertThrows(Exception.class, () -> {
            var element = new electric.xml.Element("timeDuration");
            element.setAttribute("type", "UnknownType");
            TimeDuration.loadFromXML(element);
        });
    }
    
    // ========== Comparison with Position Types ==========
    
    @Test
    void testDurationBBTVsPositionBBT() {
        // Position: bar 1, beat 1, ticks 0 = 0 beats (1-based origin)
        TimePosition.BBTTime position = TimePosition.bbt(1, 1, 0);
        assertEquals(0.0, position.toBeats(context), 0.001);
        
        // Duration: 0 bars, 0 beats, 0 ticks = 0 beats (0-based zero)
        TimeDuration.DurationBBT duration = TimeDuration.bbt(0, 0, 0);
        assertEquals(0.0, duration.toBeats(context), 0.001);
        
        // Position: bar 2, beat 1, ticks 0 = 4 beats (start of second measure)
        position = TimePosition.bbt(2, 1, 0);
        assertEquals(4.0, position.toBeats(context), 0.001);
        
        // Duration: 1 bar, 0 beats, 0 ticks = 4 beats (one measure duration)
        duration = TimeDuration.bbt(1, 0, 0);
        assertEquals(4.0, duration.toBeats(context), 0.001);
    }
    
    @Test
    void testDurationBBFVsPositionBBF() {
        // Position: bar 1, beat 1, fraction 0 = 0 beats
        TimePosition.BBFTime position = TimePosition.bbf(1, 1, 0);
        assertEquals(0.0, position.toBeats(context), 0.001);
        
        // Duration: 0 bars, 0 beats, fraction 0 = 0 beats
        TimeDuration.DurationBBF duration = TimeDuration.bbf(0, 0, 0);
        assertEquals(0.0, duration.toBeats(context), 0.001);
        
        // The key difference: 4 beats of duration
        // Position: bar 2, beat 1, fraction 0 → displays as "2.1.00"
        position = TimePosition.bbf(2, 1, 0);
        assertEquals(4.0, position.toBeats(context), 0.001);
        
        // Duration: 1 bar, 0 beats, fraction 0 → displays as "1.0.00"
        duration = TimeDuration.bbf(1, 0, 0);
        assertEquals(4.0, duration.toBeats(context), 0.001);
    }
    
    // ========== Non-4/4 Meter Tests ==========
    
    @Test
    void testDurationBBTIn34() {
        // 3/4 meter: 3 beats per bar
        MeterMap meterMap = new MeterMap();
        meterMap.set(0, new MeasureMeterPair(1, new Meter(3, 4)));
        TempoMap tempoMap = new TempoMap();
        TimeContext ctx34 = new TimeContext();
        ctx34.setMeterMap(meterMap);
        ctx34.setTempoMap(tempoMap);
        blue.ProjectProperties props34 = new blue.ProjectProperties();
        props34.setSampleRate("44100");
        ctx34.setProjectProperties(props34);
        
        // 1 bar in 3/4 = 3 beats
        TimeDuration.DurationBBT d = TimeDuration.bbt(1, 0, 0);
        assertEquals(3.0, d.toBeats(ctx34), 0.001);
        
        // 2 bars in 3/4 = 6 beats
        d = TimeDuration.bbt(2, 0, 0);
        assertEquals(6.0, d.toBeats(ctx34), 0.001);
        
        // 1 bar + 2 beats in 3/4 = 5 beats
        d = TimeDuration.bbt(1, 2, 0);
        assertEquals(5.0, d.toBeats(ctx34), 0.001);
    }
    
    @Test
    void testDurationBBFIn68() {
        // 6/8 meter: 6 eighth notes = 3 quarter note beats per bar
        MeterMap meterMap = new MeterMap();
        meterMap.set(0, new MeasureMeterPair(1, new Meter(6, 8)));
        TempoMap tempoMap = new TempoMap();
        TimeContext ctx68 = new TimeContext();
        ctx68.setMeterMap(meterMap);
        ctx68.setTempoMap(tempoMap);
        blue.ProjectProperties props68 = new blue.ProjectProperties();
        props68.setSampleRate("44100");
        ctx68.setProjectProperties(props68);
        
        // 1 bar in 6/8 = 3 beats (6 * 4/8 = 3)
        TimeDuration.DurationBBF d = TimeDuration.bbf(1, 0, 0);
        assertEquals(3.0, d.toBeats(ctx68), 0.001);
        
        // 0 bars, 1 beat in 6/8 = 0.5 beats (one eighth note = 4/8 = 0.5 quarter)
        d = TimeDuration.bbf(0, 1, 0);
        assertEquals(0.5, d.toBeats(ctx68), 0.001);
    }
}
