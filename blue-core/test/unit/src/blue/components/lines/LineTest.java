/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

import junit.framework.TestCase;

public class LineTest extends TestCase {
    public void testLine() {
        Line line = new Line(false);

        // LinePoint lp = new LinePoint();
        //
        //
        // line.addLinePoint(lp);

    }

    public void testMinMax() {
        Line line = new Line(false);
        line.setMax(2.0f, false);

        assertEquals(1.0f, line.getLinePoint(0).getY(), 0.001f);

        line.setMax(0.5f, true);

        assertEquals(0.5f, line.getLinePoint(0).getY(), 0.001f);

        line.getLinePoint(0).setLocation(0, 0.25f);

        line.setMin(-0.5f, false);

        assertEquals(0.0f, line.getLinePoint(0).getY(), 0.001f);

        line.setMin(0.25f, true);

        assertEquals(0.25f, line.getLinePoint(0).getY(), 0.001f);
    }
}
