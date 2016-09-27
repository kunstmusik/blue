/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;

public class LineList extends ArrayList<Line> {

    public LineList() {
    }

    public LineList(LineList ll) {
        super(ll.size());
        for (Line line : ll) {
            add(new Line(line));
        }
    }

    public static LineList loadFromXML(Element data) {
        LineList retVal = new LineList();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            retVal.add(Line.loadFromXML(node));
        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("lines");

        for (Line line : this) {
            retVal.addElement(line.saveAsXML());
        }

        return retVal;
    }

    @Override
    public String toString() {
        return "";
    }
}
