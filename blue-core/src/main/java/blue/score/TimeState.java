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

import blue.time.TimeBase;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Vector;

/**
 * UI/editing state for the score timeline.
 * 
 * TODO: Future enhancement - consider integrating with TimeUnit system:
 * - snapValue could be a TimeUnit (snap to beat, measure, etc.)
 * - timeDisplay could support DISPLAY_MEASURES mode
 * - formatTime() method could use TimeContext for conversions
 *
 * @author stevenyi
 */
public class TimeState {

    // Legacy constants - kept for reference but no longer used for storage
    @Deprecated
    public static final int DISPLAY_TIME = 0;
    @Deprecated
    public static final int DISPLAY_BEATS = 1;
    
    // Format version for migration support
    // Version 1 (or no attribute): Legacy format (timeDisplay: 0=TIME, 1=BEATS)
    // Version 2: Uses TimeBase enum names for storage
    private static final int CURRENT_FORMAT_VERSION = 2;

    private transient Vector<PropertyChangeListener> listeners = null;

    private boolean snapEnabled = false;
    private double snapValue = 1.0f;
    private TimeBase timeDisplay = TimeBase.CSOUND_BEATS;
    private TimeBase secondaryTimeDisplay = TimeBase.TIME;
    private boolean secondaryRulerEnabled = false;

    private int zoomIterations = 0;

    public TimeState() {
    }

    public TimeState(TimeState timeState) {
        snapEnabled = timeState.snapEnabled;
        snapValue = timeState.snapValue;
        timeDisplay = timeState.timeDisplay;
        secondaryTimeDisplay = timeState.secondaryTimeDisplay;
        secondaryRulerEnabled = timeState.secondaryRulerEnabled;
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
                this.snapValue, snapValue);

        this.snapValue = snapValue;

        firePropertyChangeEvent(pce);
    }

    public TimeBase getTimeDisplay() {
        return timeDisplay;
    }

    public void setTimeDisplay(TimeBase timeDisplay) {
        if (timeDisplay == null) {
            throw new IllegalArgumentException("timeDisplay cannot be null");
        }
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "timeDisplay",
                this.timeDisplay, timeDisplay);

        this.timeDisplay = timeDisplay;

        firePropertyChangeEvent(pce);
    }

    public TimeBase getSecondaryTimeDisplay() {
        return secondaryTimeDisplay;
    }

    public void setSecondaryTimeDisplay(TimeBase secondaryTimeDisplay) {
        if (secondaryTimeDisplay == null) {
            throw new IllegalArgumentException("secondaryTimeDisplay cannot be null");
        }
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "secondaryTimeDisplay",
                this.secondaryTimeDisplay, secondaryTimeDisplay);

        this.secondaryTimeDisplay = secondaryTimeDisplay;

        firePropertyChangeEvent(pce);
    }

    public boolean isSecondaryRulerEnabled() {
        return secondaryRulerEnabled;
    }

    public void setSecondaryRulerEnabled(boolean secondaryRulerEnabled) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "secondaryRulerEnabled",
                this.secondaryRulerEnabled, secondaryRulerEnabled);

        this.secondaryRulerEnabled = secondaryRulerEnabled;

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

        String versionStr = data.getAttributeValue("version");
        int version = (versionStr == null) ? 1 : Integer.parseInt(versionStr);
        
        while (nodes.hasMoreElements()) {
            Element e = nodes.next();

            String nodeName = e.getName();
            final String nodeText = e.getTextString();
            switch (nodeName) {
                case "pixelSecond" -> {
                    var pixelSecond = Integer.parseInt(nodeText);
                    timeState.zoomIterations = (int) ((Math.log(pixelSecond / 100.0) / Math.log(2)) * 32.0);
                }
                case "zoomIterations" ->
                    timeState.zoomIterations = Integer.parseInt(nodeText);
                case "snapEnabled" ->
                    timeState.snapEnabled = Boolean.parseBoolean(nodeText);
                case "snapValue" ->
                    timeState.snapValue = Double.parseDouble(nodeText);
                case "timeDisplay" ->
                    timeState.timeDisplay = parseTimeBase(nodeText, TimeBase.CSOUND_BEATS);
                case "secondaryTimeDisplay" ->
                    timeState.secondaryTimeDisplay = parseTimeBase(nodeText, TimeBase.TIME);
                case "secondaryRulerEnabled" ->
                    timeState.secondaryRulerEnabled = Boolean.parseBoolean(nodeText);
            }
        }
        
        // Migrate legacy format values (version 1 or no version attribute)
        if (version < 2) {
            // Secondary ruler did not exist in legacy format
            timeState.secondaryRulerEnabled = false;
        }

        return timeState;
    }
    
    /**
     * Parses a TimeBase from XML text. Handles both enum names (v2+) and legacy int values (v1).
     * Legacy: 0=TIME, 1=BEATS
     */
    private static TimeBase parseTimeBase(String text, TimeBase defaultValue) {
        if (text == null || text.isEmpty()) {
            return defaultValue;
        }
        // Try parsing as enum name first (v2 format)
        try {
            return TimeBase.valueOf(text);
        } catch (IllegalArgumentException e) {
            // Fall back to legacy int parsing
            try {
                int legacyValue = Integer.parseInt(text);
                return migrateLegacyDisplayValue(legacyValue);
            } catch (NumberFormatException nfe) {
                return defaultValue;
            }
        }
    }
    
    /**
     * Converts a legacy display int value to TimeBase.
     * Legacy: 0=DISPLAY_TIME, 1=DISPLAY_BEATS
     */
    private static TimeBase migrateLegacyDisplayValue(int legacyValue) {
        return switch (legacyValue) {
            case 0 -> TimeBase.TIME;         // Legacy DISPLAY_TIME
            case 1 -> TimeBase.CSOUND_BEATS; // Legacy DISPLAY_BEATS
            default -> TimeBase.CSOUND_BEATS;
        };
    }

    public Element saveAsXML() {
        Element retVal = new Element("timeState");
        retVal.setAttribute("version", Integer.toString(CURRENT_FORMAT_VERSION));

        retVal.addElement(XMLUtilities.writeInt("zoomIterations",
                this.zoomIterations));
        retVal.addElement(XMLUtilities.writeBoolean("snapEnabled",
                this.snapEnabled));
        retVal.addElement(XMLUtilities.writeDouble("snapValue", this.snapValue));
        Element timeDisplayElem = new Element("timeDisplay");
        timeDisplayElem.setText(this.timeDisplay.name());
        retVal.addElement(timeDisplayElem);
        Element secondaryTimeDisplayElem = new Element("secondaryTimeDisplay");
        secondaryTimeDisplayElem.setText(this.secondaryTimeDisplay.name());
        retVal.addElement(secondaryTimeDisplayElem);
        retVal.addElement(XMLUtilities.writeBoolean("secondaryRulerEnabled",
                this.secondaryRulerEnabled));

        return retVal;
    }

}
