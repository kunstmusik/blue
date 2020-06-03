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
package blue;

import electric.xml.Element;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Iterator;
import java.util.Vector;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class Marker implements Comparable<Marker> {

    private double time = 0.0f;

    private String name;

    transient Vector listeners = null;

    public Marker() {
    }

    public Marker(Marker marker) {
        time = marker.time;
        name = marker.name;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        String oldName = name;

        this.name = name;

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "name",
                oldName, name);

        firePropertyChangeEvent(pce);
    }

    public double getTime() {
        return time;
    }

    public void setTime(double time) {
        double oldVal = this.time;

        this.time = time;

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "time", oldVal, time);

        firePropertyChangeEvent(pce);
    }

    public static Marker loadFromXML(Element data) {
        Marker m = new Marker();

        m.setTime(Double.parseDouble(data.getAttributeValue("time")));
        m.setName(data.getAttributeValue("name"));

        return m;
    }

    public Element saveAsXML() {
        Element retVal = new Element("marker");

        retVal.setAttribute("time", Double.toString(getTime()));
        retVal.setAttribute("name", getName());

        return retVal;
    }

    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (listeners == null) {
            return;
        }

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            PropertyChangeListener listener = (PropertyChangeListener) iter
                    .next();

            listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            listeners = new Vector();
        }

        listeners.add(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            return;
        }
        listeners.remove(pcl);
    }

    @Override
    public int compareTo(Marker b) {
        if (this.time > b.time) {
            return 1;
        } else if (this.time < b.time) {
            return -1;
        }
        return 0;
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }
}
