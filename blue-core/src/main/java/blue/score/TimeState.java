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

import blue.time.TempoMap;
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
 * Stores ruler display format (primary/secondary via {@link TimeBase}),
 * snap settings (via {@link SnapValue}), zoom level, and SMPTE frame rate.
 * Property change events are fired for all state changes so UI components
 * can update accordingly.
 *
 * @author stevenyi
 */
public class TimeState {

    // Format version for migration support
    // Version 1 (or no attribute): Legacy format (timeDisplay: 0=TIME, 1=BEATS)
    // Version 2: Uses TimeBase enum names for storage, adds row visibility flags (tempo/meter/markers)
    private static final int CURRENT_FORMAT_VERSION = 2;

    private transient Vector<PropertyChangeListener> listeners = null;

    private boolean snapEnabled = false;
    private SnapValue snapValue = SnapValue.BEAT;
    private TimeBase timeDisplay = TimeBase.BEATS;
    private TimeBase secondaryTimeDisplay = TimeBase.TIME;
    private boolean secondaryRulerEnabled = false;
    private boolean tempoRowVisible = true;
    private boolean meterRowVisible = true;
    private boolean markersRowVisible = true;
    private double smpteFrameRate = 24.0;

    private int zoomIterations = 0;

    public TimeState() {
    }

    public TimeState(TimeState timeState) {
        snapEnabled = timeState.snapEnabled;
        snapValue = timeState.snapValue;
        timeDisplay = timeState.timeDisplay;
        secondaryTimeDisplay = timeState.secondaryTimeDisplay;
        secondaryRulerEnabled = timeState.secondaryRulerEnabled;
        tempoRowVisible = timeState.tempoRowVisible;
        meterRowVisible = timeState.meterRowVisible;
        markersRowVisible = timeState.markersRowVisible;
        smpteFrameRate = timeState.smpteFrameRate;
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

    public SnapValue getSnapValue() {
        return this.snapValue;
    }

    public void setSnapValue(SnapValue snapValue) {
        if (snapValue == null) {
            throw new IllegalArgumentException("snapValue cannot be null");
        }
        SnapValue oldVal = this.snapValue;
        this.snapValue = snapValue;

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "snapValue",
                oldVal, snapValue);
        firePropertyChangeEvent(pce);
    }

    /**
     * Calculates the snap value in beats for the given beat position,
     * using the tempo at that position for time/SMPTE/sample-based snap values.
     *
     * @param beatPosition the beat position on the timeline (for tempo lookup)
     * @param tempoMap the tempo map (may be null for constant tempo)
     * @param sampleRate the audio sample rate
     * @return snap value in beats
     */
    public double getSnapValueInBeats(double beatPosition,
            TempoMap tempoMap, long sampleRate) {
        double tempo = (tempoMap != null) ? tempoMap.getTempoAt(beatPosition) : 60.0;
        return snapValue.toBeats(tempo, smpteFrameRate, sampleRate, getPixelSecond());
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

    public boolean isTempoRowVisible() {
        return tempoRowVisible;
    }

    public void setTempoRowVisible(boolean tempoRowVisible) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "tempoRowVisible",
                this.tempoRowVisible, tempoRowVisible);

        this.tempoRowVisible = tempoRowVisible;

        firePropertyChangeEvent(pce);
    }

    public boolean isMeterRowVisible() {
        return meterRowVisible;
    }

    public void setMeterRowVisible(boolean meterRowVisible) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "meterRowVisible",
                this.meterRowVisible, meterRowVisible);

        this.meterRowVisible = meterRowVisible;

        firePropertyChangeEvent(pce);
    }

    public boolean isMarkersRowVisible() {
        return markersRowVisible;
    }

    public void setMarkersRowVisible(boolean markersRowVisible) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "markersRowVisible",
                this.markersRowVisible, markersRowVisible);

        this.markersRowVisible = markersRowVisible;

        firePropertyChangeEvent(pce);
    }

    public double getSmpteFrameRate() {
        return smpteFrameRate;
    }

    public void setSmpteFrameRate(double smpteFrameRate) {
        if (smpteFrameRate <= 0) {
            throw new IllegalArgumentException("smpteFrameRate must be positive");
        }
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "smpteFrameRate",
                this.smpteFrameRate, smpteFrameRate);

        this.smpteFrameRate = smpteFrameRate;

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
                case "snapValue" -> {
                    // Try enum name first (current format), then legacy double
                    try {
                        timeState.snapValue = SnapValue.valueOf(nodeText);
                    } catch (IllegalArgumentException e1) {
                        // Legacy format: double value — find closest match
                        try {
                            double legacyVal = Double.parseDouble(nodeText);
                            timeState.snapValue = SnapValue.closestMatch(legacyVal);
                        } catch (NumberFormatException nfe) {
                            timeState.snapValue = SnapValue.BEAT;
                        }
                    }
                }
                case "timeDisplay" ->
                    timeState.timeDisplay = parseTimeBase(nodeText, TimeBase.BEATS);
                case "secondaryTimeDisplay" ->
                    timeState.secondaryTimeDisplay = parseTimeBase(nodeText, TimeBase.TIME);
                case "secondaryRulerEnabled" ->
                    timeState.secondaryRulerEnabled = Boolean.parseBoolean(nodeText);
                case "tempoRowVisible" ->
                    timeState.tempoRowVisible = Boolean.parseBoolean(nodeText);
                case "meterRowVisible" ->
                    timeState.meterRowVisible = Boolean.parseBoolean(nodeText);
                case "markersRowVisible" ->
                    timeState.markersRowVisible = Boolean.parseBoolean(nodeText);
                case "smpteFrameRate" ->
                    timeState.smpteFrameRate = Double.parseDouble(nodeText);
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
            case 1 -> TimeBase.BEATS; // Legacy DISPLAY_BEATS
            default -> TimeBase.BEATS;
        };
    }

    public Element saveAsXML() {
        Element retVal = new Element("timeState");
        retVal.setAttribute("version", Integer.toString(CURRENT_FORMAT_VERSION));

        retVal.addElement(XMLUtilities.writeInt("zoomIterations",
                this.zoomIterations));
        retVal.addElement(XMLUtilities.writeBoolean("snapEnabled",
                this.snapEnabled));
        Element snapValueElem = new Element("snapValue");
        snapValueElem.setText(this.snapValue.name());
        retVal.addElement(snapValueElem);
        Element timeDisplayElem = new Element("timeDisplay");
        timeDisplayElem.setText(this.timeDisplay.name());
        retVal.addElement(timeDisplayElem);
        Element secondaryTimeDisplayElem = new Element("secondaryTimeDisplay");
        secondaryTimeDisplayElem.setText(this.secondaryTimeDisplay.name());
        retVal.addElement(secondaryTimeDisplayElem);
        retVal.addElement(XMLUtilities.writeBoolean("secondaryRulerEnabled",
                this.secondaryRulerEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("tempoRowVisible",
                this.tempoRowVisible));
        retVal.addElement(XMLUtilities.writeBoolean("meterRowVisible",
                this.meterRowVisible));
        retVal.addElement(XMLUtilities.writeBoolean("markersRowVisible",
                this.markersRowVisible));
        retVal.addElement(XMLUtilities.writeDouble("smpteFrameRate",
                this.smpteFrameRate));

        return retVal;
    }

}
