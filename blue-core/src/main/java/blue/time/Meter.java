/*
 * blue - object composition environment for csound
 * Copyright (c) 2023 Steven Yi (stevenyi@gmail.com)
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

import electric.xml.Element;
import java.util.Objects;

/**
 * Represents a musical time signature (meter).
 * Immutable value object.
 * 
 * @author syi
 */
public class Meter {
    /** Minimum 1, max unbounded */
    public final long numBeats;
    
    /** Duration of beat, should be 1, 2, 4, 8, 16, 32 */
    public final long beatLength;  
    
    public Meter() {
        this(4, 4);
    }
    
    public Meter(long numBeats, long beatLength) {
        assert(numBeats > 0);
        assert(beatLength >= 0);
        
        this.numBeats = numBeats;
        this.beatLength = beatLength;
    }
    
    public Meter(Meter meter) {
        this.numBeats = meter.numBeats;
        this.beatLength = meter.beatLength;
    }
    
    /**
     * Calculates the duration of one measure in Csound beats (quarter notes).
     * For example, 4/4 time = 4 beats, 3/4 time = 3 beats, 6/8 time = 3 beats.
     * 
     * @return duration of one measure in Csound beats
     */
    public double getMeasureBeatDuration() {
        return numBeats * (4.0 / beatLength);
    }
    
    @Override
    public boolean equals(Object obj) {
        if (this == obj) return true;
        if (!(obj instanceof Meter)) return false;
        Meter other = (Meter) obj;
        return numBeats == other.numBeats && beatLength == other.beatLength;
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(numBeats, beatLength);
    }
    
    @Override
    public String toString() {
        return numBeats + "/" + beatLength;
    }
    
    /**
     * Save Meter to XML.
     */
    public Element saveAsXML() {
        Element retVal = new Element("meter");
        retVal.addElement("numBeats").setText(Long.toString(numBeats));
        retVal.addElement("beatLength").setText(Long.toString(beatLength));
        return retVal;
    }
    
    /**
     * Load Meter from XML.
     */
    public static Meter loadFromXML(Element data) {
        long numBeats = Long.parseLong(data.getElement("numBeats").getTextString());
        long beatLength = Long.parseLong(data.getElement("beatLength").getTextString());
        return new Meter(numBeats, beatLength);
    }
}
