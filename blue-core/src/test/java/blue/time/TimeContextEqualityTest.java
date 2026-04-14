/*
 * blue - object composition environment for csound
 * Copyright (c) 2023 Steven Yi (stevenyi@gmail.com)
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

import blue.ProjectProperties;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;


class TimeContextEqualityTest {

    // ===== MeterMap equals =====

    @Test
    void shouldConsiderDefaultMeterMapsEqual() {
        var a = new MeterMap();
        var b = new MeterMap();
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void shouldConsiderMeterMapsWithSameEntriesEqual() {
        var a = new MeterMap();
        a.add(new MeasureMeterPair(5, new Meter(3, 4)));
        var b = new MeterMap();
        b.add(new MeasureMeterPair(5, new Meter(3, 4)));
        assertEquals(a, b);
    }

    @Test
    void shouldConsiderMeterMapsWithDifferentEntriesNotEqual() {
        var a = new MeterMap();
        var b = new MeterMap();
        b.add(new MeasureMeterPair(5, new Meter(6, 8)));
        assertNotEquals(a, b);
    }

    // ===== TempoMap equals =====

    @Test
    void shouldConsiderDefaultTempoMapsEqual() {
        var a = new TempoMap();
        var b = new TempoMap();
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void shouldConsiderTempoMapsWithDifferentEnabledNotEqual() {
        var a = new TempoMap();
        a.setEnabled(true);
        var b = new TempoMap();
        b.setEnabled(false);
        assertNotEquals(a, b);
    }

    @Test
    void shouldConsiderTempoMapsWithDifferentPointsNotEqual() {
        var a = new TempoMap();
        var b = new TempoMap();
        b.addTempoPoint(new TempoPoint(4.0, 140.0));
        assertNotEquals(a, b);
    }

    @Test
    void shouldConsiderCopiedTempoMapEqual() {
        var a = new TempoMap();
        a.setEnabled(true);
        a.addTempoPoint(new TempoPoint(8.0, 100.0));
        var b = new TempoMap(a);
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    // ===== TimeContext.hasSameMusicalContext =====

    @Test
    void shouldDetectSameMusicalContext() {
        var a = new TimeContext();
        var b = new TimeContext();
        assertTrue(a.hasSameMusicalContext(b));
    }

    @Test
    void shouldDetectSameMusicalContextForCopy() {
        var a = new TimeContext();
        a.getTempoMap().setEnabled(true);
        a.getMeterMap().add(new MeasureMeterPair(3, new Meter(6, 8)));
        var b = new TimeContext(a);
        assertTrue(a.hasSameMusicalContext(b));
    }

    @Test
    void shouldDetectDifferentMusicalContextWhenTempoMapDiffers() {
        var a = new TimeContext();
        var b = new TimeContext();
        b.getTempoMap().setEnabled(true);
        assertFalse(a.hasSameMusicalContext(b));
    }

    @Test
    void shouldDetectDifferentMusicalContextWhenMeterMapDiffers() {
        var a = new TimeContext();
        var b = new TimeContext();
        b.getMeterMap().add(new MeasureMeterPair(5, new Meter(7, 8)));
        assertFalse(a.hasSameMusicalContext(b));
    }

    @Test
    void shouldReturnFalseForNullContext() {
        var a = new TimeContext();
        assertFalse(a.hasSameMusicalContext(null));
    }

    @Test
    void shouldReturnTrueForSelf() {
        var a = new TimeContext();
        assertTrue(a.hasSameMusicalContext(a));
    }

    @Test
    void shouldCopySampleRateAsDetachedSnapshot() {
        ProjectProperties props = new ProjectProperties();
        props.setSampleRate("48000");

        TimeContext original = new TimeContext();
        original.setProjectProperties(props);

        TimeContext copy = new TimeContext(original);

        // mutate source after copy; snapshot should stay fixed
        props.setSampleRate("96000");

        assertEquals(96000L, original.getSampleRate());
        assertEquals(48000L, copy.getSampleRate());
    }
}
