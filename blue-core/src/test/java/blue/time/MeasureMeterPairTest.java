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

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class MeasureMeterPairTest {

    @Test
    void shouldBeEqualForSameMeasureAndMeter() {
        var a = new MeasureMeterPair(1, new Meter(4, 4));
        var b = new MeasureMeterPair(1, new Meter(4, 4));
        assertEquals(a, b);
        assertEquals(a.hashCode(), b.hashCode());
    }

    @Test
    void shouldNotBeEqualForDifferentMeasure() {
        var a = new MeasureMeterPair(1, new Meter(4, 4));
        var b = new MeasureMeterPair(2, new Meter(4, 4));
        assertNotEquals(a, b);
    }

    @Test
    void shouldNotBeEqualForDifferentMeter() {
        var a = new MeasureMeterPair(1, new Meter(4, 4));
        var b = new MeasureMeterPair(1, new Meter(3, 4));
        assertNotEquals(a, b);
    }

    @Test
    void shouldNotBeEqualToNull() {
        var a = new MeasureMeterPair(1, new Meter(4, 4));
        assertNotEquals(null, a);
    }

    @Test
    void shouldBeEqualToSelf() {
        var a = new MeasureMeterPair(1, new Meter(4, 4));
        assertEquals(a, a);
    }
}
