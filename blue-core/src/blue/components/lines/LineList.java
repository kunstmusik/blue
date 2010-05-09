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

import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;

import electric.xml.Element;
import electric.xml.Elements;

public class LineList extends ArrayList implements Serializable {

    public static LineList loadFromXML(Element data) {
        LineList retVal = new LineList();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            retVal.addLine(Line.loadFromXML(node));
        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("lines");

        for (Iterator iter = this.iterator(); iter.hasNext();) {
            Line line = (Line) iter.next();
            retVal.addElement(line.saveAsXML());
        }

        return retVal;
    }

    public Line getLine(int index) {
        return (Line) this.get(index);
    }

    public boolean addLine(Line line) {
        return this.add(line);
    }

    public String toString() {
        return "";
    }
}
