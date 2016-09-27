/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.apache.commons.lang3.builder.EqualsBuilder;

/**
 * @author Steven Yi
 */
public class LinePoint implements Comparable<LinePoint> {
    private double y;

    private double x;

    private transient Vector listeners = null;

    private transient ChangeEvent changeEvent = null;

    public LinePoint(){}
    public LinePoint(LinePoint lp){
        x = lp.x;
        y = lp.y;
    }

    public static LinePoint loadFromXML(Element data) {
        LinePoint lp = new LinePoint();

        double x = Double.parseDouble(data.getAttributeValue("x"));
        double y = Double.parseDouble(data.getAttributeValue("y"));

        lp.setLocation(x, y);

        return lp;
    }

    public Element saveAsXML() {
        Element retVal = new Element("linePoint");

        retVal.setAttribute("x", Double.toString(getX()));
        retVal.setAttribute("y", Double.toString(getY()));

        return retVal;
    }

    @Override
    public int compareTo(LinePoint b) {
        LinePoint a = this;

        double val = a.getX() - b.getX();

        if (val > 0.0f) {
            return 1;
        } else if (val < 0.0f) {
            return -1;
        } else {
            return 0;
        }
    }

    public void setLocation(double x, double y) {
        this.x = x;
        this.y = y;

        if (changeEvent == null) {
            changeEvent = new ChangeEvent(this);
        }

        fireChangeEvent(changeEvent);
    }

    public double getX() {
        return x;
    }

    public double getY() {
        return y;
    }

    /* EVENT CODE */

    public void addChangeListener(ChangeListener pcl) {
        if (listeners == null) {
            listeners = new Vector();
        }
        listeners.add(pcl);
    }

    public void removeChangeListener(ChangeListener pcl) {
        if (listeners != null) {
            listeners.remove(pcl);
        }
    }

    public void fireChangeEvent(ChangeEvent pce) {
        if (listeners != null) {
            for (Iterator iter = listeners.iterator(); iter.hasNext();) {
                ChangeListener pcl = (ChangeListener) iter.next();
                pcl.stateChanged(pce);
            }
        }
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }
}
