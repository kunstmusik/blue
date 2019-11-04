/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
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
package blue.components.lines;

import java.math.BigDecimal;
import junit.framework.TestCase;

public class LineUtilsTest extends TestCase {

    public final void testRescale() {
        // fail("Not yet implemented"); // TODO
    }

    public final void testTruncate() {
        // fail("Not yet implemented"); // TODO
    }

    public final void testSnapToResolution() {
        BigDecimal bd1 = new BigDecimal(1);
        // condition beyond maximum
        assertEquals(6.0, LineUtils.snapToResolution(7.0f, .2f, 6.0f, bd1),
                0.0001);

        // condition below minimum
        assertEquals(.2, LineUtils.snapToResolution(-5.0f, .2f, 6.0f, bd1),
                0.0001);

        // condition with resolution
        assertEquals(5.2, LineUtils.snapToResolution(5.4, .2f, 6.0f, bd1),
                0.0001);

        // condition without resolution
        assertEquals(5.3, LineUtils.snapToResolution(5.3, .2f, 6.0f, new BigDecimal(-1)),
                0.0001);

		assertEquals(1.0, LineUtils.snapToResolution(1.0, -20.0, 20.0, 
                new BigDecimal(".2")), 0.0001);

		assertEquals(1.2, LineUtils.snapToResolution(1.20, -20.0, 20.0, new BigDecimal(".1")), 0.0001);
		
		assertEquals(1.4, LineUtils.snapToResolution(1.40, -20.0f, 20.0f, 
                new BigDecimal(".2")), 0.0001);
    }

}
