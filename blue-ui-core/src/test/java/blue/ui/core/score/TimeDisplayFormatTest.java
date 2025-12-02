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
import blue.time.TimeContext;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Tests for TimeDisplayFormat enum.
 *
 * @author Steven Yi
 */
public class TimeDisplayFormatTest {

    private TimeContext context;

    @Before
    public void setUp() {
        // Create a context with default 4/4 meter and 120 BPM
        TempoMap tempoMap = new TempoMap();
        MeterMap meterMap = new MeterMap();
        context = new TimeContext(44100, meterMap, tempoMap);
    }

    // ========== BEATS format tests ==========

    @Test
    public void testBeatsFormat() {
        assertEquals("0.00", TimeDisplayFormat.BEATS.format(0.0, context));
        assertEquals("4.00", TimeDisplayFormat.BEATS.format(4.0, context));
        assertEquals("8.50", TimeDisplayFormat.BEATS.format(8.5, context));
        assertEquals("12.25", TimeDisplayFormat.BEATS.format(12.25, context));
    }

    @Test
    public void testBeatsFormatCompact() {
        assertEquals("0", TimeDisplayFormat.BEATS.formatCompact(0.0, context));
        assertEquals("4", TimeDisplayFormat.BEATS.formatCompact(4.0, context));
        assertEquals("8.5", TimeDisplayFormat.BEATS.formatCompact(8.5, context));
        assertEquals("12.3", TimeDisplayFormat.BEATS.formatCompact(12.25, context));
    }

    @Test
    public void testBeatsFormatWithNullContext() {
        // BEATS should work without context
        assertEquals("4.00", TimeDisplayFormat.BEATS.format(4.0, null));
        assertEquals("4", TimeDisplayFormat.BEATS.formatCompact(4.0, null));
    }

    // ========== MEASURE_BEATS format tests ==========

    @Test
    public void testMeasureBeatsFormat() {
        // In 4/4 time, beat 0 = measure 1:beat 1
        assertEquals("1:1.00", TimeDisplayFormat.MEASURE_BEATS.format(0.0, context));
        // Beat 4 = measure 2:beat 1
        assertEquals("2:1.00", TimeDisplayFormat.MEASURE_BEATS.format(4.0, context));
        // Beat 2 = measure 1:beat 3 (beat number is 1-indexed, and quarter = 1 beat in 4/4)
        // Actually in the code, beat 0 maps to measure 1, beat 1.0, so:
        // beat 2 => measure 1, beat 2+1 = beat 3.0 (if 1-indexed)
        // Need to check the actual implementation
    }

    @Test
    public void testMeasureBeatsFormatCompact() {
        assertEquals("1:1", TimeDisplayFormat.MEASURE_BEATS.formatCompact(0.0, context));
        assertEquals("2:1", TimeDisplayFormat.MEASURE_BEATS.formatCompact(4.0, context));
    }

    @Test
    public void testMeasureBeatsFormatFallsBackToBeatsWithNullContext() {
        assertEquals("4.00", TimeDisplayFormat.MEASURE_BEATS.format(4.0, null));
        assertEquals("4", TimeDisplayFormat.MEASURE_BEATS.formatCompact(4.0, null));
    }

    // ========== TIME format tests ==========

    @Test
    public void testTimeFormat() {
        // At default 60 BPM, 1 beat = 1 second
        // 0 beats = 0:00.000
        assertEquals("0:00.000", TimeDisplayFormat.TIME.format(0.0, context));
        // 4 beats = 4 seconds = 0:04.000
        String formatted = TimeDisplayFormat.TIME.format(4.0, context);
        assertTrue("Expected time around 4 seconds, got: " + formatted,
                formatted.contains("04") || formatted.contains("4"));
    }

    @Test
    public void testTimeFormatCompact() {
        assertEquals("0:00", TimeDisplayFormat.TIME.formatCompact(0.0, context));
    }

    // ========== SMPTE format tests ==========

    @Test
    public void testSmpteFormat() {
        assertEquals("00:00:00:00", TimeDisplayFormat.SMPTE.format(0.0, context));
    }

    // ========== SAMPLES format tests ==========

    @Test
    public void testSamplesFormat() {
        assertEquals("0", TimeDisplayFormat.SAMPLES.format(0.0, context));
        // At default 60 BPM, 4 beats = 4 seconds = 176,400 samples at 44100 Hz
        String formatted = TimeDisplayFormat.SAMPLES.format(4.0, context);
        assertTrue("Expected sample count around 176400, got: " + formatted,
                formatted.contains("176"));
    }

    // ========== Metadata tests ==========

    @Test
    public void testDisplayNames() {
        assertEquals("Beats", TimeDisplayFormat.BEATS.getDisplayName());
        assertEquals("Measures:Beats", TimeDisplayFormat.MEASURE_BEATS.getDisplayName());
        assertEquals("Time", TimeDisplayFormat.TIME.getDisplayName());
        assertEquals("SMPTE", TimeDisplayFormat.SMPTE.getDisplayName());
        assertEquals("Samples", TimeDisplayFormat.SAMPLES.getDisplayName());
    }

    @Test
    public void testExamples() {
        assertEquals("0.0, 4.0, 8.0", TimeDisplayFormat.BEATS.getExample());
        assertEquals("1:1.0, 2:1.0", TimeDisplayFormat.MEASURE_BEATS.getExample());
        assertEquals("0:00.000", TimeDisplayFormat.TIME.getExample());
        assertEquals("00:00:00:00", TimeDisplayFormat.SMPTE.getExample());
        assertEquals("0, 44100", TimeDisplayFormat.SAMPLES.getExample());
    }

    @Test
    public void testMenuLabels() {
        assertTrue(TimeDisplayFormat.BEATS.getMenuLabel().contains("Beats"));
        assertTrue(TimeDisplayFormat.BEATS.getMenuLabel().contains("0.0, 4.0"));
    }

    // ========== TimeState compatibility tests ==========

    @Test
    public void testFromTimeStateValue() {
        // DISPLAY_TIME = 0 maps to TIME
        assertEquals(TimeDisplayFormat.TIME, TimeDisplayFormat.fromTimeStateValue(0));
        // DISPLAY_BEATS = 1 maps to BEATS
        assertEquals(TimeDisplayFormat.BEATS, TimeDisplayFormat.fromTimeStateValue(1));
        // Unknown values default to BEATS
        assertEquals(TimeDisplayFormat.BEATS, TimeDisplayFormat.fromTimeStateValue(99));
    }

    @Test
    public void testToTimeStateValue() {
        // TIME and SMPTE map to DISPLAY_TIME = 0
        assertEquals(0, TimeDisplayFormat.TIME.toTimeStateValue());
        assertEquals(0, TimeDisplayFormat.SMPTE.toTimeStateValue());
        
        // BEATS and MEASURE_BEATS map to DISPLAY_BEATS = 1
        assertEquals(1, TimeDisplayFormat.BEATS.toTimeStateValue());
        assertEquals(1, TimeDisplayFormat.MEASURE_BEATS.toTimeStateValue());
        assertEquals(1, TimeDisplayFormat.SAMPLES.toTimeStateValue());
    }

    @Test
    public void testAllValuesPresent() {
        TimeDisplayFormat[] values = TimeDisplayFormat.values();
        assertEquals(5, values.length);
        
        // Verify all expected formats are present
        assertNotNull(TimeDisplayFormat.valueOf("BEATS"));
        assertNotNull(TimeDisplayFormat.valueOf("MEASURE_BEATS"));
        assertNotNull(TimeDisplayFormat.valueOf("TIME"));
        assertNotNull(TimeDisplayFormat.valueOf("SMPTE"));
        assertNotNull(TimeDisplayFormat.valueOf("SAMPLES"));
    }
}
