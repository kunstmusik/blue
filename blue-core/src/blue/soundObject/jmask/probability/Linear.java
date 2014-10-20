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
package blue.soundObject.jmask.probability;

import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

public class Linear implements ProbabilityGenerator {
    public static final int DECREASING = 0;

    public static final int INCREASING = 1;

    private int direction = DECREASING;

    public static ProbabilityGenerator loadFromXML(Element data) {
        Linear retVal = new Linear();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("direction")) {
                retVal.direction = XMLUtilities.readInt(node);
            }
        }
        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("probabilityGenerator");
        retVal.setAttribute("type", getClass().getName());

        retVal.addElement(XMLUtilities.writeInt("direction",getDirection()));

        return retVal;
    }

//    public JComponent getEditor() {
//        return new LinearEditor(this);
//    }

    public String getName() {
        return "Linear";
    }

    public double getValue(double time) {
        double x1 = Math.random();
        double x2 = Math.random();

        double retVal;

        if (direction == DECREASING) {
            retVal = x1 < x2 ? x1 : x2;
        } else {
            retVal = x1 > x2 ? x1 : x2;
        }

        return retVal;
    }

    public int getDirection() {
        return direction;
    }

    public void setDirection(int direction) {
        this.direction = direction;
    }

}
