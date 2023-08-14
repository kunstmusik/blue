/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.score;

import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Vector;

/**
 *
 * @author stevenyi
 */
public class TimeState {

    public static final int DISPLAY_TIME = 0;
    public static final int DISPLAY_BEATS = 1;

    private transient Vector<PropertyChangeListener> listeners = null;

    private boolean snapEnabled = false;
    private double snapValue = 1.0f;
    private int timeDisplay = DISPLAY_TIME;

    private int zoomIterations = 0;

    public TimeState() {
    }

    public TimeState(TimeState timeState) {
        snapEnabled = timeState.snapEnabled;
        snapValue = timeState.snapValue;
        timeDisplay = timeState.timeDisplay;
        zoomIterations = timeState.zoomIterations;
    }

    public double getPixelSecond() {
        return 100 * Math.exp(Math.log(2) * (zoomIterations / 32.0));
    }

    public void lowerPixelSecond() {
        var oldPs = getPixelSecond();
        zoomIterations--;
        var newPs = getPixelSecond();
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "pixelSecond",
                oldPs, newPs);

        firePropertyChangeEvent(pce);
    }

    public void raisePixelSecond() {
        var oldPs = getPixelSecond();
        zoomIterations++;
        var newPs = getPixelSecond();
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "pixelSecond",
                oldPs, newPs);

        firePropertyChangeEvent(pce);
    }

    public boolean isSnapEnabled() {
        return this.snapEnabled;
    }

    public void setSnapEnabled(boolean snapEnabled) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "snapEnabled",
                this.snapEnabled, snapEnabled);

        this.snapEnabled = snapEnabled;

        firePropertyChangeEvent(pce);
    }

    public double getSnapValue() {
        return this.snapValue;
    }

    public void setSnapValue(double snapValue) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "snapValue",
                new Double(this.snapValue), new Double(snapValue));

        this.snapValue = snapValue;

        firePropertyChangeEvent(pce);
    }

    public int getTimeDisplay() {
        return timeDisplay;
    }

    public void setTimeDisplay(int timeDisplay) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "timeDisplay",
                new Integer(this.timeDisplay), new Integer(timeDisplay));

        this.timeDisplay = timeDisplay;

        firePropertyChangeEvent(pce);
    }

    /* PROPERTY CHANGE LISTENER CODE */
    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (listeners == null) {
            return;
        }

        for (PropertyChangeListener listener : listeners) {
            listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            listeners = new Vector<>();
        }

        if (!listeners.contains(pcl)) {
            listeners.add(pcl);
        }
    }

    public void addPropertyChangeListener(int index, PropertyChangeListener pcl) {
        if (listeners == null) {
            listeners = new Vector<>();
        }

        listeners.add(index, pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            return;
        }
        listeners.remove(pcl);
    }

    /*
     * SERIALIZATION CODE
     */
    public static TimeState loadFromXML(Element data) {

        TimeState timeState = new TimeState();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element e = nodes.next();

            String nodeName = e.getName();
            final String nodeText = e.getTextString();
            switch (nodeName) {
                case "pixelSecond": {
                    var pixelSecond = Integer.parseInt(nodeText);
                    timeState.zoomIterations = (int) ((Math.log(pixelSecond / 100.0) / Math.log(2)) * 32.0);
                }
                break;
                case "zoomIterations":
                    timeState.zoomIterations = Integer.parseInt(nodeText);
                case "snapEnabled":
                    timeState.snapEnabled = Boolean.parseBoolean(nodeText);
                    break;
                case "snapValue":
                    timeState.snapValue = Double.parseDouble(nodeText);
                    break;
                case "timeDisplay":
                    timeState.timeDisplay = Integer.parseInt(nodeText);
                    break;
            }
        }

        return timeState;
    }

    public Element saveAsXML() {
        Element retVal = new Element("timeState");

        retVal.addElement(XMLUtilities.writeInt("zoomIterations",
                this.zoomIterations));
        retVal.addElement(XMLUtilities.writeBoolean("snapEnabled",
                this.snapEnabled));
        retVal.addElement(XMLUtilities.writeDouble("snapValue", this.snapValue));
        retVal.addElement(XMLUtilities.writeInt("timeDisplay", this.timeDisplay));

        return retVal;
    }

}
