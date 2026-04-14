/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2025 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307 USA
 */
package blue.time;

import electric.xml.Element;

/**
 * Represents a single tempo point in a TempoMap.
 * 
 * A TempoPoint defines:
 * - A position as a TimePosition (BeatTime, BBTTime, BBSTTime, or BBFTime)
 * - A tempo value (in BPM)
 * - A curve type defining how tempo transitions TO the next point
 * 
 * The position is stored as a TimePosition, allowing tempo changes to be
 * specified in either Csound beats or bar/beat notation. A cached
 * beat value is maintained for efficient sorting and calculations.
 * 
 * @author stevenyi
 */
public class TempoPoint implements Comparable<TempoPoint> {
    
    /** Position as a TimePosition (BeatTime, BBTTime, BBSTTime, or BBFTime) */
    private TimePosition position;
    
    /** Cached beat position for sorting and calculations */
    private double cachedBeat;
    
    /** Tempo in BPM (always > 0) */
    private double tempo;
    
    /** How tempo transitions from this point to the next */
    private CurveType curveType;
    
    /** Cached accumulated time in seconds from beat 0 to this point */
    double accumulatedTime = 0.0;
    
    /**
     * Creates a tempo point at beat 0 with tempo 60 BPM and LINEAR curve.
     */
    public TempoPoint() {
        this(TimePosition.beats(0.0), 60.0, CurveType.LINEAR);
    }
    
    /**
     * Creates a tempo point with the specified beat and tempo, using LINEAR curve.
     * Convenience constructor that creates a BeatTime position.
     * 
     * @param beat the beat position (must be >= 0)
     * @param tempo the tempo in BPM (must be > 0)
     */
    public TempoPoint(double beat, double tempo) {
        this(TimePosition.beats(beat), tempo, CurveType.LINEAR);
    }
    
    /**
     * Creates a tempo point with the specified beat, tempo, and curve type.
     * Convenience constructor that creates a BeatTime position.
     * 
     * @param beat the beat position (must be >= 0)
     * @param tempo the tempo in BPM (must be > 0)
     * @param curveType the curve type for transition to next point
     */
    public TempoPoint(double beat, double tempo, CurveType curveType) {
        this(TimePosition.beats(beat), tempo, curveType);
    }
    
    /**
     * Creates a tempo point with the specified TimePosition position, tempo, and curve type.
     * 
     * @param position the position as a TimePosition (BeatTime, BBTTime, BBSTTime, or BBFTime)
     * @param tempo the tempo in BPM (must be > 0)
     * @param curveType the curve type for transition to next point
     */
    public TempoPoint(TimePosition position, double tempo, CurveType curveType) {
        if (position == null) {
            throw new IllegalArgumentException("Position cannot be null");
        }
        if (!(position instanceof TimePosition.BeatTime) && 
            !(position instanceof TimePosition.BBTTime) &&
            !(position instanceof TimePosition.BBSTTime) &&
            !(position instanceof TimePosition.BBFTime)) {
            throw new IllegalArgumentException(
                "TempoPoint position must be BeatTime, BBTTime, BBSTTime, or BBFTime, got: " + 
                position.getClass().getSimpleName());
        }
        if (tempo <= 0) {
            throw new IllegalArgumentException("Tempo must be > 0, got: " + tempo);
        }
        this.position = position;
        this.tempo = tempo;
        this.curveType = java.util.Objects.requireNonNullElse(curveType, CurveType.LINEAR);
        
        // Initialize cached beat (will be recalculated by TempoMap if bar/beat time)
        if (position instanceof TimePosition.BeatTime beatTime) {
            this.cachedBeat = beatTime.getCsoundBeats();
        } else {
            // For BBT/BBST/BBF, set a placeholder - TempoMap will recalculate
            this.cachedBeat = 0.0;
        }
    }
    
    /**
     * Copy constructor.
     */
    public TempoPoint(TempoPoint other) {
        this.position = other.position;
        this.cachedBeat = other.cachedBeat;
        this.tempo = other.tempo;
        this.curveType = other.curveType;
        this.accumulatedTime = other.accumulatedTime;
    }
    
    // ========== Getters ==========
    
    /**
     * Gets the position as a TimePosition.
     */
    public TimePosition getPosition() {
        return position;
    }
    
    /**
     * Gets the cached beat position (for sorting and calculations).
     * This is automatically updated when the position changes or when
     * the MeterMap changes (for BBT/BBST/BBF positions).
     */
    public double getBeat() {
        return cachedBeat;
    }
    
    public double getTempo() {
        return tempo;
    }
    
    public CurveType getCurveType() {
        return curveType;
    }
    
    public double getAccumulatedTime() {
        return accumulatedTime;
    }
    
    // ========== Setters ==========
    
    /**
     * Sets the position as a TimePosition.
     */
    public void setPosition(TimePosition position) {
        if (position == null) {
            throw new IllegalArgumentException("Position cannot be null");
        }
        if (!(position instanceof TimePosition.BeatTime) && 
            !(position instanceof TimePosition.BBTTime) &&
            !(position instanceof TimePosition.BBSTTime) &&
            !(position instanceof TimePosition.BBFTime)) {
            throw new IllegalArgumentException(
                "TempoPoint position must be BeatTime, BBTTime, BBSTTime, or BBFTime, got: " + 
                position.getClass().getSimpleName());
        }
        this.position = position;
        
        // Update cached beat for BeatTime
        if (position instanceof TimePosition.BeatTime beatTime) {
            this.cachedBeat = beatTime.getCsoundBeats();
        } else {
            this.cachedBeat = 0.0;
        }
    }
    
    /**
     * Sets the position using a beat value (creates a BeatTime).
     * Convenience method for backward compatibility.
     */
    public void setBeat(double beat) {
        if (beat < 0) {
            throw new IllegalArgumentException("Beat must be >= 0, got: " + beat);
        }
        this.position = TimePosition.beats(beat);
        this.cachedBeat = beat;
    }
    
    public void setTempo(double tempo) {
        if (tempo <= 0) {
            throw new IllegalArgumentException("Tempo must be > 0, got: " + tempo);
        }
        this.tempo = tempo;
    }
    
    public void setCurveType(CurveType curveType) {
        this.curveType = java.util.Objects.requireNonNullElse(curveType, CurveType.LINEAR);
    }
    
    // ========== Beat Calculation ==========
    
    /**
     * Recalculates the cached beat value using the provided TimeContext.
     * This should be called by TempoMap when the MeterMap changes.
     * 
     * @param context the time context for bar/beat-to-beat conversion
     */
    public void recalculateBeat(TimeContext context) {
        if (position instanceof TimePosition.BeatTime beatTime) {
            this.cachedBeat = beatTime.getCsoundBeats();
        } else {
            // BBTTime, BBSTTime, BBFTime all use toBeats(context)
            this.cachedBeat = position.toBeats(context);
        }
    }
    
    // ========== Comparable ==========
    
    @Override
    public int compareTo(TempoPoint other) {
        return Double.compare(this.cachedBeat, other.cachedBeat);
    }
    
    // ========== XML Serialization ==========
    
    /**
     * Saves this tempo point to XML.
     */
    public Element saveAsXML() {
        Element retVal = new Element("tempoPoint");
        retVal.setAttribute("tempo", Double.toString(tempo));
        retVal.setAttribute("curve", curveType.name());
        
        // Reuse TimePosition's XML serialization
        retVal.addElement(position.saveAsXML());
        
        return retVal;
    }
    
    /**
     * Loads a tempo point from XML.
     */
    public static TempoPoint loadFromXML(Element data) throws Exception {
        double tempo = Double.parseDouble(data.getAttributeValue("tempo"));
        CurveType curveType = CurveType.fromString(data.getAttributeValue("curve"));
        
        // Try to load position from child timePosition element
        Element timeUnitElement = data.getElement("timePosition");
        TimePosition position;
        
        if (timeUnitElement != null) {
            // New format: uses TimePosition's XML serialization
            position = TimePosition.loadFromXML(timeUnitElement);
        } else {
            // Legacy format: beat stored as attribute
            String beatStr = data.getAttributeValue("beat");
            double beat = beatStr != null ? Double.parseDouble(beatStr) : 0.0;
            position = TimePosition.beats(beat);
        }
        
        return new TempoPoint(position, tempo, curveType);
    }
    
    /**
     * Loads a tempo point from the old BeatTempoPair XML format.
     * Used for backward compatibility.
     */
    public static TempoPoint loadFromLegacyXML(Element data) {
        double beat = Double.parseDouble(data.getElement("beat").getTextString());
        double tempo = Double.parseDouble(data.getElement("tempo").getTextString());
        // Legacy format always used linear interpolation and beat positions
        return new TempoPoint(TimePosition.beats(beat), tempo, CurveType.LINEAR);
    }
    
    @Override
    public String toString() {
        if (position instanceof TimePosition.BeatTime) {
            return String.format("TempoPoint[beat=%.2f, tempo=%.2f, curve=%s]", 
                cachedBeat, tempo, curveType);
        } else {
            // BBT, BBST, or BBF - show the position string and cached beat
            return String.format("TempoPoint[%s (beat=%.2f), tempo=%.2f, curve=%s]", 
                position.toString(), cachedBeat, tempo, curveType);
        }
    }
    
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (!(obj instanceof TempoPoint other)) return false;
        return position.equals(other.position) &&
               Double.compare(tempo, other.tempo) == 0 &&
               curveType == other.curveType;
    }
    
    @Override
    public int hashCode() {
        int result = position.hashCode();
        result = 31 * result + Double.hashCode(tempo);
        result = 31 * result + curveType.hashCode();
        return result;
    }
}
