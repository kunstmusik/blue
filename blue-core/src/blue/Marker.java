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
package blue;

import electric.xml.Element;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.util.Iterator;
import java.util.Vector;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class Marker implements Serializable, Comparable {

    private float time = 0.0f;

    private String name;

    transient Vector listeners = null;

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

    public float getTime() {
        return time;
    }

    public void setTime(float time) {
        float oldVal = this.time;

        this.time = time;

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "time",
                new Float(oldVal), new Float(time));

        firePropertyChangeEvent(pce);
    }

    public static Marker loadFromXML(Element data) {
        Marker m = new Marker();

        m.setTime(Float.parseFloat(data.getAttributeValue("time")));
        m.setName(data.getAttributeValue("name"));

        return m;
    }

    public Element saveAsXML() {
        Element retVal = new Element("marker");

        retVal.setAttribute("time", Float.toString(getTime()));
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

    public int compareTo(Object arg0) {
        Marker b = (Marker) arg0;

        if (this.time > b.time) {
            return 1;
        } else if (this.time < b.time) {
            return -1;
        }
        return 0;
    }

    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }
}
