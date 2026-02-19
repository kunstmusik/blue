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
package blue.ui.core.score;

import blue.time.MeterMap;
import blue.time.TempoMap;
import blue.time.TimeBase;
import blue.time.TimeContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests for TimeDisplayFormat enum.
 *
 * @author Steven Yi
 */
class TimeDisplayFormatTest {

    private TimeContext context;

    @BeforeEach
    void setUp() {
        // Create a context with default 4/4 meter and 120 BPM
        TempoMap tempoMap = new TempoMap();
        MeterMap meterMap = new MeterMap();
        context = new TimeContext(44100, meterMap, tempoMap);
    }

    // ========== BEATS format tests ==========

    @Test
    void testBeatsFormat() {
        assertEquals("0.00", TimeDisplayFormat.BEATS.format(0.0, context));
        assertEquals("4.00", TimeDisplayFormat.BEATS.format(4.0, context));
        assertEquals("8.50", TimeDisplayFormat.BEATS.format(8.5, context));
        assertEquals("12.25", TimeDisplayFormat.BEATS.format(12.25, context));
    }

    @Test
    void testBeatsFormatCompact() {
        assertEquals("0", TimeDisplayFormat.BEATS.formatCompact(0.0, context));
        assertEquals("4", TimeDisplayFormat.BEATS.formatCompact(4.0, context));
        assertEquals("8.5", TimeDisplayFormat.BEATS.formatCompact(8.5, context));
        assertEquals("12.3", TimeDisplayFormat.BEATS.formatCompact(12.25, context));
    }

    @Test
    void testBeatsFormatWithNullContext() {
        // BEATS should work without context
        assertEquals("4.00", TimeDisplayFormat.BEATS.format(4.0, null));
        assertEquals("4", TimeDisplayFormat.BEATS.formatCompact(4.0, null));
    }

    // ========== BBT format tests ==========

    @Test
    void testBBTFormat() {
        // In 4/4 time, beat 0 = bar 1, beat 1, ticks 0
        String formatted = TimeDisplayFormat.BBT.format(0.0, context);
        assertTrue(formatted.startsWith("1.1"),
                   "Expected BBT format starting with 1.1, got: " + formatted);
        // Beat 4 = bar 2, beat 1
        formatted = TimeDisplayFormat.BBT.format(4.0, context);
        assertTrue(formatted.startsWith("2.1"),
                   "Expected BBT format starting with 2.1, got: " + formatted);
    }

    @Test
    void testBBTFormatFallsBackToBeatsWithNullContext() {
        assertEquals("4.00", TimeDisplayFormat.BBT.format(4.0, null));
        assertEquals("4", TimeDisplayFormat.BBT.formatCompact(4.0, null));
    }

    // ========== BBST format tests ==========

    @Test
    void testBBSTFormat() {
        // In 4/4 time, beat 0 = bar 1, beat 1, sixteenth 1, ticks 0
        String formatted = TimeDisplayFormat.BBST.format(0.0, context);
        assertTrue(formatted.startsWith("1.1"),
                   "Expected BBST format starting with 1.1, got: " + formatted);
        // Beat 4 = bar 2, beat 1
        formatted = TimeDisplayFormat.BBST.format(4.0, context);
        assertTrue(formatted.startsWith("2.1"),
                   "Expected BBST format starting with 2.1, got: " + formatted);
    }

    @Test
    void testBBSTFormatCompact() {
        String formatted = TimeDisplayFormat.BBST.formatCompact(0.0, context);
        assertTrue(formatted.startsWith("1.1"),
                   "Expected compact BBST format, got: " + formatted);
    }

    @Test
    void testBBSTFormatFallsBackToBeatsWithNullContext() {
        assertEquals("4.00", TimeDisplayFormat.BBST.format(4.0, null));
        assertEquals("4", TimeDisplayFormat.BBST.formatCompact(4.0, null));
    }

    // ========== BBF format tests ==========

    @Test
    void testBBFFormat() {
        // In 4/4 time, beat 0 = bar 1, beat 1, fraction 0
        String formatted = TimeDisplayFormat.BBF.format(0.0, context);
        assertTrue(formatted.startsWith("1.1"),
                   "Expected BBF format starting with 1.1, got: " + formatted);
        // Beat 4 = bar 2, beat 1
        formatted = TimeDisplayFormat.BBF.format(4.0, context);
        assertTrue(formatted.startsWith("2.1"),
                   "Expected BBF format starting with 2.1, got: " + formatted);
    }

    @Test
    void testBBFFormatFallsBackToBeatsWithNullContext() {
        assertEquals("4.00", TimeDisplayFormat.BBF.format(4.0, null));
        assertEquals("4", TimeDisplayFormat.BBF.formatCompact(4.0, null));
    }

    // ========== TIME format tests ==========

    @Test
    void testTimeFormat() {
        // At default 60 BPM, 1 beat = 1 second
        // 0 beats = 0:00.000
        assertEquals("0:00.000", TimeDisplayFormat.TIME.format(0.0, context));
        // 4 beats = 4 seconds = 0:04.000
        String formatted = TimeDisplayFormat.TIME.format(4.0, context);
        assertTrue(formatted.contains("04") || formatted.contains("4"),
                   "Expected time around 4 seconds, got: " + formatted);
    }

    @Test
    void testTimeFormatCompact() {
        assertEquals("0:00", TimeDisplayFormat.TIME.formatCompact(0.0, context));
    }

    // ========== SMPTE format tests ==========

    @Test
    void testSmpteFormat() {
        assertEquals("00:00:00:00", TimeDisplayFormat.SMPTE.format(0.0, context));
    }

    @Test
    void testSmpteFormatUsesContextFrameRate() {
        // Default context has 24 fps SMPTE frame rate
        // At 60 BPM, 1 beat = 1 second → 1.5 seconds = 1 second + 12 frames at 24fps
        assertEquals("00:00:01:12", TimeDisplayFormat.SMPTE.format(1.5, context));

        // Change frame rate to 30 fps
        context.setSmpteFrameRate(30.0);
        // 1.5 seconds = 1 second + 15 frames at 30fps
        assertEquals("00:00:01:15", TimeDisplayFormat.SMPTE.format(1.5, context));
    }

    @Test
    void testSmpteFormatWithNullContext() {
        // Should fall back to DEFAULT_SMPTE_FRAME_RATE (24 fps)
        String formatted = TimeDisplayFormat.SMPTE.format(0.0, null);
        assertEquals("00:00:00:00", formatted);
    }

    // ========== SAMPLES format tests ==========

    @Test
    void testSamplesFormat() {
        assertEquals("0", TimeDisplayFormat.SAMPLES.format(0.0, context));
        // At default 60 BPM, 4 beats = 4 seconds = 176,400 samples at 44100 Hz
        String formatted = TimeDisplayFormat.SAMPLES.format(4.0, context);
        assertTrue(formatted.contains("176"),
                   "Expected sample count around 176400, got: " + formatted);
    }
    
    @Test
    void testSamplesFormatUsesContextSampleRate() {
        TimeContext customContext = new TimeContext(48000, new MeterMap(), new TempoMap());
        // At 60 BPM default, 1 beat = 1 second -> 48000 samples
        assertEquals("48000", TimeDisplayFormat.SAMPLES.format(1.0, customContext));
    }

    // ========== Metadata tests ==========

    @Test
    void testDisplayNames() {
        assertEquals("Beats", TimeDisplayFormat.BEATS.getDisplayName());
        assertEquals("BBT", TimeDisplayFormat.BBT.getDisplayName());
        assertEquals("BBST", TimeDisplayFormat.BBST.getDisplayName());
        assertEquals("BBF", TimeDisplayFormat.BBF.getDisplayName());
        assertEquals("Time", TimeDisplayFormat.TIME.getDisplayName());
        assertEquals("SMPTE", TimeDisplayFormat.SMPTE.getDisplayName());
        assertEquals("Samples", TimeDisplayFormat.SAMPLES.getDisplayName());
    }

    @Test
    void testExamples() {
        assertEquals("0.0, 4.0, 8.0", TimeDisplayFormat.BEATS.getExample());
        assertEquals("1.1.0, 2.1.0", TimeDisplayFormat.BBT.getExample());
        assertEquals("1.1.1.0, 2.1.1.0", TimeDisplayFormat.BBST.getExample());
        assertEquals("1.1.00, 2.1.50", TimeDisplayFormat.BBF.getExample());
        assertEquals("0:00.000", TimeDisplayFormat.TIME.getExample());
        assertEquals("00:00:00:00", TimeDisplayFormat.SMPTE.getExample());
        assertEquals("0, 44100", TimeDisplayFormat.SAMPLES.getExample());
    }

    @Test
    void testMenuLabels() {
        assertTrue(TimeDisplayFormat.BEATS.getMenuLabel().contains("Beats"));
        assertTrue(TimeDisplayFormat.BEATS.getMenuLabel().contains("0.0, 4.0"));
    }

    // ========== TimeBase mapping tests ==========

    @Test
    void testFromTimeBase() {
        assertEquals(TimeDisplayFormat.BEATS, TimeDisplayFormat.fromTimeBase(TimeBase.CSOUND_BEATS));
        assertEquals(TimeDisplayFormat.BBT, TimeDisplayFormat.fromTimeBase(TimeBase.BBT));
        assertEquals(TimeDisplayFormat.BBST, TimeDisplayFormat.fromTimeBase(TimeBase.BBST));
        assertEquals(TimeDisplayFormat.BBF, TimeDisplayFormat.fromTimeBase(TimeBase.BBF));
        assertEquals(TimeDisplayFormat.TIME, TimeDisplayFormat.fromTimeBase(TimeBase.TIME));
        assertEquals(TimeDisplayFormat.SMPTE, TimeDisplayFormat.fromTimeBase(TimeBase.SMPTE));
        assertEquals(TimeDisplayFormat.SAMPLES, TimeDisplayFormat.fromTimeBase(TimeBase.FRAME));
        // null should default to BEATS
        assertEquals(TimeDisplayFormat.BEATS, TimeDisplayFormat.fromTimeBase(null));
    }

    @Test
    void testAllValuesPresent() {
        TimeDisplayFormat[] values = TimeDisplayFormat.values();
        assertEquals(7, values.length);
        
        // Verify all expected formats are present
        assertNotNull(TimeDisplayFormat.valueOf("BEATS"));
        assertNotNull(TimeDisplayFormat.valueOf("BBT"));
        assertNotNull(TimeDisplayFormat.valueOf("BBST"));
        assertNotNull(TimeDisplayFormat.valueOf("BBF"));
        assertNotNull(TimeDisplayFormat.valueOf("TIME"));
        assertNotNull(TimeDisplayFormat.valueOf("SMPTE"));
        assertNotNull(TimeDisplayFormat.valueOf("SAMPLES"));
    }

    @Test
    void testGetTimeBase() {
        assertEquals(TimeBase.CSOUND_BEATS, TimeDisplayFormat.BEATS.getTimeBase());
        assertEquals(TimeBase.BBT, TimeDisplayFormat.BBT.getTimeBase());
        assertEquals(TimeBase.BBST, TimeDisplayFormat.BBST.getTimeBase());
        assertEquals(TimeBase.BBF, TimeDisplayFormat.BBF.getTimeBase());
        assertEquals(TimeBase.TIME, TimeDisplayFormat.TIME.getTimeBase());
        assertEquals(TimeBase.SMPTE, TimeDisplayFormat.SMPTE.getTimeBase());
        assertEquals(TimeBase.FRAME, TimeDisplayFormat.SAMPLES.getTimeBase());
    }
}
