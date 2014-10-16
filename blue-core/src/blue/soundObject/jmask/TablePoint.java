/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
 *
 * Based on CMask by Andre Bartetzki
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
package blue.soundObject.jmask;

import electric.xml.Element;
import java.io.Serializable;
import java.util.Iterator;
import java.util.Vector;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class TablePoint implements Serializable {
    private double time = 0.0;

    private double value = .5;
    
    private transient Vector listeners = null;

    private transient ChangeEvent changeEvent = null;

    public static TablePoint loadFromXML(Element data) {
        TablePoint tp = new TablePoint();

        tp.setTime(Double.parseDouble(data.getAttributeValue("time")));
        tp.setValue(Double.parseDouble(data.getAttributeValue("value")));

        return tp;
    }

    public Element saveAsXML() {
        Element retVal = new Element("point");

        retVal.setAttribute("time", Double.toString(getTime()));
        retVal.setAttribute("value", Double.toString(getValue()));

        return retVal;
    }

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public double getTime() {
        return time;
    }

    public void setTime(double time) {
        this.time = time;
    }

    public double getValue() {
        return value;
    }

    public void setValue(double value) {
        this.value = value;
    }
    
    public void setLocation(double time, double value) {
        this.time = time;
        this.value = value;

        if (changeEvent == null) {
            changeEvent = new ChangeEvent(this);
        }

        fireChangeEvent(changeEvent);
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
}
