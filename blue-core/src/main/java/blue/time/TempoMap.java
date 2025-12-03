/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006, 2023, 2025 Steven Yi (stevenyi@gmail.com)
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
package blue.time;

import blue.components.lines.Line;
import blue.components.lines.LinePoint;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.StringTokenizer;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Manages tempo changes across a musical timeline.
 * 
 * TempoMap maintains an ordered list of TempoPoints, where each point defines
 * a tempo at a specific beat position. The tempo between points can either:
 * - Stay constant until the next point (CONSTANT curve type)
 * - Interpolate linearly to the next point (LINEAR curve type)
 * 
 * Entries are always kept sorted by beat position.
 * 
 * When enabled is false, the tempo map behaves as if there's a single
 * constant tempo of 60 BPM (the default).
 *
 * @author Steven Yi
 */
public class TempoMap {
    
    /** Default tempo when tempo map is disabled or empty */
    public static final double DEFAULT_TEMPO = 60.0;
    
    /**
     * Listener interface for TempoMap changes.
     */
    public interface TempoMapListener {
        void tempoMapChanged();
    }

    private final List<TempoPoint> points = new ArrayList<>();
    private final List<TempoMapListener> listeners = new CopyOnWriteArrayList<>();
    private final List<PropertyChangeListener> propertyListeners = new CopyOnWriteArrayList<>();
    
    /** Whether tempo changes are enabled (Use Tempo checkbox) */
    private boolean enabled = false;
    
    /** Whether the tempo editor is expanded/visible in the UI */
    private boolean visible = false;

    public TempoMap() {
        points.add(new TempoPoint(0, DEFAULT_TEMPO, CurveType.LINEAR));
    }

    public TempoMap(TempoMap tempoMap) {
        for (TempoPoint point : tempoMap.points) {
            points.add(new TempoPoint(point));
        }
        this.enabled = tempoMap.enabled;
        this.visible = tempoMap.visible;
    }
    
    // ========== Enabled/Visible Properties ==========
    
    /**
     * Returns whether tempo changes are enabled.
     * When disabled, beatsToSeconds uses a constant 60 BPM.
     */
    public boolean isEnabled() {
        return enabled;
    }
    
    /**
     * Sets whether tempo changes are enabled.
     */
    public void setEnabled(boolean enabled) {
        if (this.enabled != enabled) {
            boolean oldValue = this.enabled;
            this.enabled = enabled;
            firePropertyChange("enabled", oldValue, enabled);
            fireChanged();
        }
    }
    
    /**
     * Returns whether the tempo editor is visible/expanded in the UI.
     */
    public boolean isVisible() {
        return visible;
    }
    
    /**
     * Sets whether the tempo editor is visible/expanded in the UI.
     */
    public void setVisible(boolean visible) {
        if (this.visible != visible) {
            boolean oldValue = this.visible;
            this.visible = visible;
            firePropertyChange("visible", oldValue, visible);
        }
    }
    
    // ========== Listener Management ==========
    
    public void addListener(TempoMapListener listener) {
        if (listener != null && !listeners.contains(listener)) {
            listeners.add(listener);
        }
    }
    
    public void removeListener(TempoMapListener listener) {
        listeners.remove(listener);
    }
    
    public void addPropertyChangeListener(PropertyChangeListener listener) {
        if (listener != null && !propertyListeners.contains(listener)) {
            propertyListeners.add(listener);
        }
    }
    
    public void removePropertyChangeListener(PropertyChangeListener listener) {
        propertyListeners.remove(listener);
    }
    
    private void fireChanged() {
        recalculateAccumulatedTimes();
        for (TempoMapListener listener : listeners) {
            listener.tempoMapChanged();
        }
    }
    
    private void firePropertyChange(String propertyName, Object oldValue, Object newValue) {
        PropertyChangeEvent event = new PropertyChangeEvent(this, propertyName, oldValue, newValue);
        for (PropertyChangeListener listener : propertyListeners) {
            listener.propertyChange(event);
        }
    }
    
    // ========== List Operations ==========
    
    public int size() {
        return points.size();
    }
    
    public boolean isEmpty() {
        return points.isEmpty();
    }
    
    /**
     * Gets the tempo point at the given index.
     */
    public TempoPoint getPoint(int index) {
        return points.get(index);
    }
    
    /**
     * Gets an unmodifiable view of all tempo points.
     */
    public List<TempoPoint> getPoints() {
        return Collections.unmodifiableList(points);
    }
    
    /**
     * Gets the beat position at the given index.
     */
    public double getBeat(int index) {
        return points.get(index).getBeat();
    }
    
    /**
     * Gets the tempo at the given index.
     */
    public double getTempo(int index) {
        return points.get(index).getTempo();
    }
    
    /**
     * Gets the curve type at the given index.
     */
    public CurveType getCurveType(int index) {
        return points.get(index).getCurveType();
    }
    
    /**
     * Adds a tempo point. The list is automatically sorted by beat.
     */
    public void addTempoPoint(TempoPoint point) {
        points.add(new TempoPoint(point));
        sortEntries();
        fireChanged();
    }
    
    /**
     * Updates the tempo point at the given index.
     * 
     * @param index the index to update
     * @param beat the new beat position (must be >= 0)
     * @param tempo the new tempo in BPM (must be > 0)
     * @throws IllegalArgumentException if beat < 0 or tempo <= 0
     */
    public void setTempoPoint(int index, double beat, double tempo) {
        setTempoPoint(index, beat, tempo, points.get(index).getCurveType());
    }
    
    /**
     * Updates the tempo point at the given index.
     * 
     * @param index the index to update
     * @param beat the new beat position (must be >= 0)
     * @param tempo the new tempo in BPM (must be > 0)
     * @param curveType the curve type for transition to next point
     * @throws IllegalArgumentException if beat < 0 or tempo <= 0
     */
    public void setTempoPoint(int index, double beat, double tempo, CurveType curveType) {
        TempoPoint point = points.get(index);
        point.setBeat(beat);
        point.setTempo(tempo);
        point.setCurveType(curveType);
        sortEntries();
        fireChanged();
    }
    
    /**
     * Sets only the curve type at the given index.
     */
    public void setCurveType(int index, CurveType curveType) {
        points.get(index).setCurveType(curveType);
        fireChanged();
    }
    
    /**
     * Removes the tempo point at the given index.
     * Note: Cannot remove the last tempo point.
     * 
     * @param index the index to remove
     * @throws IllegalStateException if trying to remove the last tempo point
     */
    public void removeTempoPoint(int index) {
        if (points.size() <= 1) {
            throw new IllegalStateException("Cannot remove the last tempo point");
        }
        points.remove(index);
        fireChanged();
    }
    
    /**
     * Clears all tempo points and resets to default (beat 0, tempo 60, LINEAR).
     */
    public void reset() {
        points.clear();
        points.add(new TempoPoint(0, DEFAULT_TEMPO, CurveType.LINEAR));
        fireChanged();
    }
    
    private void sortEntries() {
        Collections.sort(points);
    }
    
    /**
     * Recalculates the cached beat positions for all tempo points using the provided MeterMap.
     * This should be called when the MeterMap changes, as MeasureBeatsTime positions
     * depend on the meter map for conversion to beats.
     * 
     * @param meterMap the meter map for measure-to-beat conversion
     */
    public void recalculateBeatPositions(MeterMap meterMap) {
        for (TempoPoint point : points) {
            point.recalculateBeat(meterMap);
        }
        sortEntries();
        recalculateAccumulatedTimes();
        fireChanged();
    }
    
    /**
     * Recalculates the accumulated time for each tempo point.
     * Must be called after any modification to the tempo map.
     */
    private void recalculateAccumulatedTimes() {
        if (points.isEmpty()) return;
        
        points.get(0).accumulatedTime = 0;
        
        for (int i = 1; i < points.size(); i++) {
            TempoPoint last = points.get(i - 1);
            TempoPoint curr = points.get(i);
            
            double deltaBeat = curr.getBeat() - last.getBeat();
            
            if (deltaBeat == 0) {
                curr.accumulatedTime = last.accumulatedTime;
            } else if (last.getCurveType() == CurveType.CONSTANT) {
                // Constant tempo: simple calculation
                double factor = 60.0 / last.getTempo();
                curr.accumulatedTime = last.accumulatedTime + (factor * deltaBeat);
            } else {
                // Linear interpolation: use area under curve
                double factor1 = 60.0 / last.getTempo();
                double factor2 = 60.0 / curr.getTempo();
                double acceleration = (factor2 - factor1) / deltaBeat;
                curr.accumulatedTime = last.accumulatedTime + 
                    getAreaUnderCurve(factor1, deltaBeat, acceleration);
            }
        }
    }

    /**
     * Creates a TempoMap from a time warp string (legacy format).
     * Format: "beat1 tempo1 beat2 tempo2 ..."
     * All segments use LINEAR interpolation.
     * 
     * @param timeWarpString the time warp string
     * @return the created TempoMap, or null if parsing fails
     */
    public static TempoMap createTempoMap(String timeWarpString) {
        TempoMap tm = new TempoMap();
        tm.points.clear(); // Remove default point

        StringTokenizer st = new StringTokenizer(timeWarpString);

        if (st.countTokens() % 2 != 0) {
            // not an even amount of tokens!
            return null;
        }

        while (st.hasMoreTokens()) {
            try {
                String timeStr = st.nextToken();
                String tempoStr = st.nextToken();

                double beat = Double.parseDouble(timeStr);
                double tempo = Double.parseDouble(tempoStr);

                if (beat < 0.0 || tempo <= 0.0) {
                    return null;
                }

                tm.points.add(new TempoPoint(beat, tempo, CurveType.LINEAR));
            } catch (Exception e) {
                // if there's any errors whatsoever, return null
                // and let the calling procedure handle it
                return null;
            }
        }
        
        if (tm.points.isEmpty()) {
            return null;
        }
        
        // When created from a string, the tempo map should be enabled
        // (this is used by TimeWarpProcessor for explicit time warping)
        tm.enabled = true;
        tm.recalculateAccumulatedTimes();
        return tm;
    }
    
    /**
     * Gets the instantaneous tempo at the given beat position.
     * 
     * @param beat the beat position
     * @return the tempo in BPM at that beat
     */
    public double getTempoAt(double beat) {
        if (!enabled || points.isEmpty()) {
            return DEFAULT_TEMPO;
        }
        
        if (beat <= 0.0) {
            return points.get(0).getTempo();
        }
        
        // Find the segment containing this beat
        for (int i = 0; i < points.size() - 1; i++) {
            TempoPoint curr = points.get(i);
            TempoPoint next = points.get(i + 1);
            
            if (beat >= curr.getBeat() && beat < next.getBeat()) {
                if (curr.getCurveType() == CurveType.CONSTANT) {
                    return curr.getTempo();
                } else {
                    // Linear interpolation
                    double t = (beat - curr.getBeat()) / (next.getBeat() - curr.getBeat());
                    return curr.getTempo() + t * (next.getTempo() - curr.getTempo());
                }
            }
        }
        
        // Beyond last point - use last tempo
        return points.get(points.size() - 1).getTempo();
    }

    /**
     * Converts beats to seconds using the tempo map.
     * If tempo is disabled, uses constant 60 BPM.
     */
    public double beatsToSeconds(double beat) {
        if (beat == 0.0) {
            return 0.0;
        }
        
        // If disabled, use constant default tempo
        if (!enabled) {
            return beat * (60.0 / DEFAULT_TEMPO);
        }

        for (int i = 0; i < points.size() - 1; i++) {
            TempoPoint curr = points.get(i);
            TempoPoint next = points.get(i + 1);

            if (beat >= curr.getBeat() && beat < next.getBeat()) {
                double deltaBeat = beat - curr.getBeat();
                
                if (curr.getCurveType() == CurveType.CONSTANT) {
                    // Constant tempo in this segment
                    double factor = 60.0 / curr.getTempo();
                    return curr.accumulatedTime + (factor * deltaBeat);
                } else {
                    // Linear interpolation
                    double factor1 = 60.0 / curr.getTempo();
                    double factor2 = 60.0 / next.getTempo();
                    double segmentLength = next.getBeat() - curr.getBeat();
                    
                    double acceleration = (factor2 - factor1) / segmentLength;
                    double t = getAreaUnderCurve(factor1, deltaBeat, acceleration);
                    
                    return curr.accumulatedTime + t;
                }
            }
        }

        // Beyond last point - use constant tempo from last point
        TempoPoint lastPoint = points.get(points.size() - 1);
        double factor = 60.0 / lastPoint.getTempo();
        double deltaBeat = beat - lastPoint.getBeat();

        return lastPoint.accumulatedTime + (factor * deltaBeat);
    }

    private static double getAreaUnderCurve(double factor1, double deltaBeat,
            double acceleration) {
        return (factor1 * deltaBeat)
                + (0.5 * acceleration * Math.pow(deltaBeat, 2));
    }

    /**
     * Converts seconds to beats using the tempo map.
     * If tempo is disabled, uses constant 60 BPM.
     */
    public double secondsToBeats(double seconds) {
        if (seconds == 0.0) {
            return 0.0;
        }
        
        // If disabled, use constant default tempo
        if (!enabled) {
            return seconds * (DEFAULT_TEMPO / 60.0);
        }

        if (points.size() == 1) {
            double factor = points.get(0).getTempo() / 60.0;
            return seconds * factor;
        }

        for (int i = 0; i < points.size() - 1; i++) {
            TempoPoint curr = points.get(i);
            TempoPoint next = points.get(i + 1);

            if (seconds < next.accumulatedTime) {
                double beat0 = curr.getBeat();
                double time0 = curr.accumulatedTime;
                
                if (curr.getCurveType() == CurveType.CONSTANT) {
                    // Constant tempo: simple calculation
                    double factor = curr.getTempo() / 60.0;
                    double elapsedTime = seconds - time0;
                    return beat0 + (elapsedTime * factor);
                } else {
                    // Linear interpolation
                    // BASED ON CODE BY ISTVAN VARGA Csound Mailing List - April 13, 2006
                    double beat1 = next.getBeat();
                    double btime0 = 60.0 / curr.getTempo();
                    double btime1 = 60.0 / next.getTempo();

                    double x;
                    if (btime0 == btime1) {
                        double elapsedTime = seconds - time0;
                        x = elapsedTime / btime0;
                    } else {
                        double a = 0.5 * (btime1 - btime0) / (beat1 - beat0);
                        double b = btime0;
                        double c = time0 - seconds;
                        x = (Math.sqrt(b * b - (4 * a * c)) - b) / (2 * a);
                    }

                    return x + beat0;
                }
            }
        }

        // Beyond last point
        TempoPoint last = points.get(points.size() - 1);
        double factor = last.getTempo() / 60.0;
        return ((seconds - last.accumulatedTime) * factor) + last.getBeat();
    }

    @Override
    public String toString() {
        StringBuilder buffer = new StringBuilder();
        buffer.append("[TempoMap enabled=").append(enabled).append("]\n");

        for (TempoPoint point : points) {
            buffer.append(point.getBeat())
                  .append(" : ")
                  .append(point.getTempo())
                  .append(" (")
                  .append(point.getCurveType())
                  .append(")\n");
        }

        return buffer.toString();
    }
    
    // ========== XML Serialization ==========
    
    /**
     * Save TempoMap to XML.
     */
    public Element saveAsXML() {
        Element retVal = new Element("tempoMap");
        
        retVal.addElement(XMLUtilities.writeBoolean("enabled", enabled));
        retVal.addElement(XMLUtilities.writeBoolean("visible", visible));
        
        for (TempoPoint point : points) {
            retVal.addElement(point.saveAsXML());
        }
        
        return retVal;
    }
    
    /**
     * Load TempoMap from XML.
     * Supports both new format (tempoPoint elements) and legacy format (beatTempoPair elements).
     */
    public static TempoMap loadFromXML(Element data) throws Exception {
        TempoMap tm = new TempoMap();
        tm.points.clear();
        
        Elements children = data.getElements();
        while (children.hasMoreElements()) {
            Element child = children.next();
            String name = child.getName();
            
            switch (name) {
                case "enabled" -> tm.enabled = Boolean.parseBoolean(child.getTextString());
                case "visible" -> tm.visible = Boolean.parseBoolean(child.getTextString());
                case "tempoPoint" -> tm.points.add(TempoPoint.loadFromXML(child));
                case "beatTempoPair" -> tm.points.add(TempoPoint.loadFromLegacyXML(child));
            }
        }
        
        // Ensure at least one point exists
        if (tm.points.isEmpty()) {
            tm.points.add(new TempoPoint(0, DEFAULT_TEMPO, CurveType.LINEAR));
        }
        
        tm.recalculateAccumulatedTimes();
        return tm;
    }
    
    // ========== Migration from Legacy Tempo ==========
    
    /**
     * Creates a TempoMap from legacy &lt;tempo&gt; XML element.
     * This is used for migrating old project files that used the
     * blue.score.tempo.Tempo class with a Line for tempo automation.
     * 
     * The Line's points (x=beat, y=tempo) are converted to TempoPoints.
     * The old system always used linear interpolation between points.
     * 
     * @param tempoElement the legacy &lt;tempo&gt; XML element
     * @return a new TempoMap with the same tempo data
     */
    public static TempoMap loadFromLegacyTempoXML(Element tempoElement) {
        TempoMap tm = new TempoMap();
        tm.points.clear();
        
        Elements nodes = tempoElement.getElements();
        Line line = null;
        
        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            switch (node.getName()) {
                case "enabled" -> tm.enabled = Boolean.parseBoolean(node.getTextString());
                case "visible" -> tm.visible = Boolean.parseBoolean(node.getTextString());
                case "line" -> line = Line.loadFromXML(node);
            }
        }
        
        // Convert Line points to TempoPoints
        if (line != null) {
            for (int i = 0; i < line.size(); i++) {
                LinePoint lp = line.getLinePoint(i);
                double beat = lp.getX();
                double tempoValue = lp.getY();
                
                // Old system always used linear interpolation
                tm.points.add(new TempoPoint(beat, tempoValue, CurveType.LINEAR));
            }
        }
        
        // Ensure at least one point exists
        if (tm.points.isEmpty()) {
            tm.points.add(new TempoPoint(0, DEFAULT_TEMPO, CurveType.LINEAR));
        }
        
        tm.recalculateAccumulatedTimes();
        return tm;
    }
}
