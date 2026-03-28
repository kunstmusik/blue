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
 * Tests for TimePosition and its subclasses, including conversion, comparison,
 * and arithmetic operations.
 *
 * @author stevenyi
 */
class TimePositionTest {
    
    private TimeContext context;
    
    @BeforeEach
    void setUp() {
        // Create a simple TimeContext for testing
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

    // ========== BeatTime Tests ==========
    
    @Test
    void testBeatTimeGetTimeBase() {
        TimePosition.BeatTime bt = TimePosition.beats(10.0);
        assertEquals(TimeBase.BEATS, bt.getTimeBase());
    }
    
    @Test
    void testBeatTimeImmutability() {
        TimePosition.BeatTime bt = TimePosition.beats(5.5);
        assertEquals(5.5, bt.getCsoundBeats(), 0.001);
    }
    
    @Test
    void testBeatTimeCopyConstructor() {
        TimePosition.BeatTime original = TimePosition.beats(7.5);
        TimePosition.BeatTime copy = new TimePosition.BeatTime(original);
        assertEquals(original.getCsoundBeats(), copy.getCsoundBeats(), 0.001);
    }
    
    @Test
    void testBeatTimeConversions() {
        TimePosition.BeatTime bt = TimePosition.beats(4.0);
        
        // toBeats should return the same value
        assertEquals(4.0, bt.toBeats(context), 0.001);
        
        // toSeconds: 60 BPM = 1 beat/second, so 4 beats = 4 seconds
        assertEquals(4.0, bt.toSeconds(context), 0.001);
        
        // toFrames: 4 seconds * 44100 Hz = 176400 frames
        assertEquals(176400, bt.toFrames(context));
    }
    
    @Test
    void testBeatTimeComparison() {
        TimePosition.BeatTime bt1 = TimePosition.beats(4.0);
        TimePosition.BeatTime bt2 = TimePosition.beats(6.0);
        TimePosition.BeatTime bt3 = TimePosition.beats(4.0);
        
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
    void testBeatTimeEqualsAndHashCode() {
        TimePosition.BeatTime bt1 = TimePosition.beats(4.0);
        TimePosition.BeatTime bt2 = TimePosition.beats(4.0);
        TimePosition.BeatTime bt3 = TimePosition.beats(5.0);
        
        assertEquals(bt1, bt2);
        assertNotEquals(bt1, bt3);
        assertEquals(bt1.hashCode(), bt2.hashCode());
    }
    
    // ========== BBSTTime Tests ==========
    
    @Test
    void testBBSTTimeGetTimeBase() {
        TimePosition.BBSTTime bbst = TimePosition.bbst(1, 1, 1, 0);
        assertEquals(TimeBase.BBST, bbst.getTimeBase());
    }
    
    @Test
    void testBBSTTimeImmutability() {
        TimePosition.BBSTTime bbst = TimePosition.bbst(5, 3, 2, 60);
        assertEquals(5, bbst.getBar());
        assertEquals(3, bbst.getBeat());
        assertEquals(2, bbst.getSixteenth());
        assertEquals(60, bbst.getTicks());
    }
    
    @Test
    void testBBSTTimeCopyConstructor() {
        TimePosition.BBSTTime original = TimePosition.bbst(10, 2, 3, 30);
        TimePosition.BBSTTime copy = new TimePosition.BBSTTime(original);
        assertEquals(original.getBar(), copy.getBar());
        assertEquals(original.getBeat(), copy.getBeat());
        assertEquals(original.getSixteenth(), copy.getSixteenth());
        assertEquals(original.getTicks(), copy.getTicks());
    }
    
    @Test
    void testBBSTTimeConversions() {
        // Bar 1, beat 1, sixteenth 1, ticks 0 = 0 beats (start of first measure)
        TimePosition.BBSTTime bbst = TimePosition.bbst(1, 1, 1, 0);
        assertEquals(0.0, bbst.toBeats(context), 0.001);
        
        // Bar 2, beat 1, sixteenth 1, ticks 0 = 4 beats (start of second measure in 4/4)
        bbst = TimePosition.bbst(2, 1, 1, 0);
        assertEquals(4.0, bbst.toBeats(context), 0.001);
        
        // Bar 1, beat 3, sixteenth 1, ticks 0 = 2 beats
        bbst = TimePosition.bbst(1, 3, 1, 0);
        assertEquals(2.0, bbst.toBeats(context), 0.001);
        assertEquals(2.0, bbst.toSeconds(context), 0.001); // 2 beats at 60 BPM = 2 seconds
    }
    
    @Test
    void testBBSTTimeInvalidBar() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimePosition.bbst(0, 1, 1, 0);
        });
    }
    
    @Test
    void testBBSTTimeInvalidBeat() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimePosition.bbst(1, 0, 1, 0);
        });
    }
    
    @Test
    void testBBSTTimeInvalidSixteenth() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimePosition.bbst(1, 1, 5, 0);
        });
    }
    
    // ========== BBTTime Tests ==========
    
    @Test
    void testBBTTimeGetTimeBase() {
        TimePosition.BBTTime bbt = TimePosition.bbt(1, 1, 0);
        assertEquals(TimeBase.BBT, bbt.getTimeBase());
    }
    
    @Test
    void testBBTTimeConversions() {
        // Bar 1, beat 1, ticks 0 = 0 beats
        TimePosition.BBTTime bbt = TimePosition.bbt(1, 1, 0);
        assertEquals(0.0, bbt.toBeats(context), 0.001);
        
        // Bar 1, beat 1, ticks 480 = 0.5 beats (half a beat at PPQ=960)
        bbt = TimePosition.bbt(1, 1, 480);
        assertEquals(0.5, bbt.toBeats(context), 0.001);
    }
    
    @Test
    void testBBTToBBSTConversion() {
        TimePosition.BBTTime bbt = TimePosition.bbt(1, 2, 480); // 480 ticks at PPQ=960
        TimePosition.BBSTTime bbst = bbt.toBBST(960);
        assertEquals(1, bbst.getBar());
        assertEquals(2, bbst.getBeat());
        assertEquals(3, bbst.getSixteenth()); // 480/240 = 2, so sixteenth 3
        assertEquals(0, bbst.getTicks());
    }
    
    // ========== BBFTime Tests ==========
    
    @Test
    void testBBFTimeGetTimeBase() {
        TimePosition.BBFTime bbf = TimePosition.bbf(1, 1, 0);
        assertEquals(TimeBase.BBF, bbf.getTimeBase());
    }
    
    @Test
    void testBBFTimeConversions() {
        // Bar 1, beat 1, fraction 0 = 0 beats
        TimePosition.BBFTime bbf = TimePosition.bbf(1, 1, 0);
        assertEquals(0.0, bbf.toBeats(context), 0.001);
        
        // Bar 1, beat 1, fraction 50 = 0.5 beats
        bbf = TimePosition.bbf(1, 1, 50);
        assertEquals(0.5, bbf.toBeats(context), 0.001);
    }
    
    @Test
    void testBBFTimeInvalidFraction() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimePosition.bbf(1, 1, 100); // fraction must be 0-99
        });
    }
    
    // ========== TimeValue Tests ==========
    
    @Test
    void testTimeValueGetTimeBase() {
        TimePosition.TimeValue tv = TimePosition.time(1, 30, 45, 500);
        assertEquals(TimeBase.TIME, tv.getTimeBase());
    }
    
    @Test
    void testTimeValueImmutability() {
        TimePosition.TimeValue tv = TimePosition.time(2, 15, 30, 250);
        assertEquals(2, tv.getHours());
        assertEquals(15, tv.getMinutes());
        assertEquals(30, tv.getSeconds());
        assertEquals(250, tv.getMilliseconds());
    }
    
    @Test
    void testTimeValueToTotalSeconds() {
        TimePosition.TimeValue tv = TimePosition.time(1, 30, 45, 500);
        // 1*3600 + 30*60 + 45 + 0.5 = 3600 + 1800 + 45 + 0.5 = 5445.5
        assertEquals(5445.5, tv.toTotalSeconds(), 0.001);
        
        tv = TimePosition.time(0, 0, 0, 0);
        assertEquals(0.0, tv.toTotalSeconds(), 0.001);
        
        tv = TimePosition.time(0, 1, 0, 0);
        assertEquals(60.0, tv.toTotalSeconds(), 0.001);
    }
    
    @Test
    void testTimeValueConversions() {
        TimePosition.TimeValue tv = TimePosition.time(0, 0, 2, 0); // 2 seconds
        
        // 2 seconds at 60 BPM (1 beat/sec) = 2 beats
        assertEquals(2.0, tv.toBeats(context), 0.001);
        assertEquals(2.0, tv.toSeconds(context), 0.001);
        assertEquals(88200, tv.toFrames(context)); // 2 * 44100
    }
    
    @Test
    void testTimeValueInvalidHours() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimePosition.time(-1, 0, 0, 0);
        });
    }
    
    @Test
    void testTimeValueInvalidMinutes() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimePosition.time(0, 60, 0, 0);
        });
    }
    
    @Test
    void testTimeValueInvalidSeconds() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimePosition.time(0, 0, 60, 0);
        });
    }
    
    @Test
    void testTimeValueInvalidMilliseconds() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimePosition.time(0, 0, 0, 1000);
        });
    }

    @Test
    void testSecondsValueGetTimeBase() {
        TimePosition.SecondsValue sv = TimePosition.seconds(1.25);
        assertEquals(TimeBase.SECONDS, sv.getTimeBase());
    }

    @Test
    void testSecondsValueConversions() {
        TimePosition.SecondsValue sv = TimePosition.seconds(2.5);
        assertEquals(2.5, sv.getTotalSeconds(), 0.001);
        assertEquals(2.5, sv.toSeconds(context), 0.001);
        assertEquals(2.5, sv.toBeats(context), 0.001);
        assertEquals(110250, sv.toFrames(context));
    }

    @Test
    void testSecondsValueNegativeRejected() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimePosition.seconds(-0.001);
        });
    }

    @Test
    void testSecondsValueXMLRoundTrip() throws Exception {
        TimePosition original = TimePosition.seconds(12.345678);
        var xml = original.saveAsXML();
        TimePosition loaded = TimePosition.loadFromXML(xml);
        assertEquals(original, loaded);
        assertInstanceOf(TimePosition.SecondsValue.class, loaded);
    }
    
    // ========== FrameValue Tests ==========
    
    @Test
    void testFrameValueGetTimeBase() {
        TimePosition.FrameValue fv = TimePosition.frames(44100);
        assertEquals(TimeBase.FRAME, fv.getTimeBase());
    }
    
    @Test
    void testFrameValueImmutability() {
        TimePosition.FrameValue fv = TimePosition.frames(88200);
        assertEquals(88200, fv.getFrameNumber());
    }
    
    @Test
    void testFrameValueToTotalSeconds() {
        TimePosition.FrameValue fv = TimePosition.frames(44100);
        assertEquals(1.0, fv.toTotalSeconds(44100), 0.001);
        
        fv = TimePosition.frames(88200);
        assertEquals(2.0, fv.toTotalSeconds(44100), 0.001);
        
        fv = TimePosition.frames(48000);
        assertEquals(1.0, fv.toTotalSeconds(48000), 0.001);
    }
    
    @Test
    void testFrameValueConversions() {
        TimePosition.FrameValue fv = TimePosition.frames(88200); // 2 seconds at 44100 Hz
        
        assertEquals(88200, fv.toFrames(context));
        assertEquals(2.0, fv.toSeconds(context), 0.001);
        assertEquals(2.0, fv.toBeats(context), 0.001); // 2 sec at 60 BPM
    }
    
    @Test
    void testFrameValueInvalidFrameNumber() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimePosition.frames(-1);
        });
    }
    
    @Test
    void testFrameValueToTotalSecondsInvalidSampleRate() {
        assertThrows(IllegalArgumentException.class, () -> {
            TimePosition.FrameValue fv = TimePosition.frames(44100);
            fv.toTotalSeconds(0);
        });
    }
}
