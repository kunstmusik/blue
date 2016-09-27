/*
 * blue - object composition environment for csound Copyright (c) 2000-2003
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.soundObject.ceciliaModule;

import electric.xml.Element;

/**
 * @author steven yi
 * 
 * To change the template for this generated type comment go to
 * Window>Preferences>Java>Code Generation>Code and Comments
 */
public class CGraphPoint implements Comparable<CGraphPoint> {

    public double time = 0.0f;

    public double value = 0.0f;

    public CGraphPoint(){}

    public CGraphPoint(CGraphPoint pt) {
        time = pt.time;
        value = pt.value;
    }

    @Override
    public String toString() {
        return "[CGraphPoint] Time: " + time + " Value: " + value;
    }

    public static CGraphPoint loadFromXML(Element data) {
        CGraphPoint cgp = new CGraphPoint();

        cgp.time = Double.parseDouble(data.getAttributeValue("time"));
        cgp.value = Double.parseDouble(data.getAttributeValue("value"));

        return cgp;
    }

    public Element saveAsXML() {
        Element retVal = new Element("cgraphPoint");

        retVal.setAttribute("time", Double.toString(time));
        retVal.setAttribute("value", Double.toString(value));

        return retVal;
    }

    @Override
    public int compareTo(CGraphPoint b) {
        CGraphPoint a = this;

        double val = a.time - b.time;

        if (val > 0.0f) {
            return 1;
        } else if (val < 0.0f) {
            return -1;
        } else {
            return 0;
        }
    }
}