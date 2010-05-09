/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.utility;

import junit.framework.TestCase;

public class NumberUtilitiesTest extends TestCase {

    public final void testFormatFloat() {
        float f = 0.00000001f;

        assertEquals("1.0E-8", Float.toString(f));
        assertEquals("0.00000001", NumberUtilities.formatFloat(f));
    }

    public final void testFormatTime() {
        float time1 = 1.4350f;
        float time2 = 11.4350f;
        float time3 = 111.4350f;
        float time4 = 1111.4350f;
        float time5 = 11111.4350f;

        assertEquals("00:00:01:43", NumberUtilities.formatTime(time1));
        assertEquals("00:00:11:43", NumberUtilities.formatTime(time2));
        assertEquals("00:01:51:43", NumberUtilities.formatTime(time3));
        assertEquals("00:18:31:43", NumberUtilities.formatTime(time4));
        assertEquals("03:05:11:43", NumberUtilities.formatTime(time5));
    }

}
