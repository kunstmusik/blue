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
package blue.components.lines;

import java.util.ArrayList;
import java.util.List;
import javafx.collections.ObservableList;
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

    public void testGetValueLeftRight() {
        Line line = new Line(false);
        Line copy;

        ObservableList<LinePoint> points = line.points;

        points.add(new LinePoint(1.0, 0.0));
        points.add(new LinePoint(1.0, 1.0));

        assertEquals(0.0, line.getValue(1.0, true), 0.0001);
        assertEquals(1.0, line.getValue(1.0, false), 0.0001);
    }

    public void testStripOuterPoints() {
        List<LinePoint> points = new ArrayList<>();

        points.add(new LinePoint(1.0, 0.0));
        points.add(new LinePoint(1.0, 1.0));
        points.add(new LinePoint(2.0, 1.0));
        points.add(new LinePoint(2.0, 0.0));

        Line.stripOuterPoints(points, 1.0, 2.0);
        assertEquals(2, points.size());
        assertEquals(1.0, points.get(0).getY(), 0.0001);
        assertEquals(1.0, points.get(1).getY(), 0.0001);
    }

    public void testProcessLineForSelectionDragNoChange() {
        Line line = new Line(false);
        Line copy;

        ObservableList<LinePoint> points = line.points;

        assertEquals(1, line.points.size());

        assertEquals(0.5, points.get(0).getY(), 0.0001);
        assertEquals(0.0, points.get(0).getX(), 0.0001);

        // testing selection drag to right by 0.5 but all values are same
        // so don't create new points
        copy = new Line(line);

        copy.processLineForSelectionDrag(0.5, 1.5, 0.5);
        assertEquals(1, copy.points.size());

        // add additional points
        line.addLinePoint(new LinePoint(1.0, 1.0));
        line.addLinePoint(new LinePoint(2.0, 0.0));

        assertEquals(3, line.points.size());

    }
}
