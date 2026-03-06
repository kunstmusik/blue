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

import blue.ProjectProperties;
import electric.xml.Element;
import java.beans.PropertyChangeListener;

/**
 * Context of time for a project. Used to resolve TimePosition values according to meter, tempo, and sample rate.
 *
 * @author stevenyi
 */
public class TimeContext {
    
    /**
     * Fixed PPQ (Pulses Per Quarter note) for all Blue projects.
     * Blue uses 960 PPQ — matches Logic Pro, Ableton, Reaper.
     * This is not user-configurable; PPQ only matters for MIDI import/export
     * resolution, which can be handled per-file if added later.
     */
    public static final int DEFAULT_PPQ = 960;
    
    /** Default SMPTE frame rate (24 fps) used when no project context is available. */
    public static final double DEFAULT_SMPTE_FRAME_RATE = 24.0;
    
    private static final long DEFAULT_SAMPLE_RATE = 44100L;

    private ProjectProperties projectProperties;
    private long cachedSampleRate = DEFAULT_SAMPLE_RATE;
    private final PropertyChangeListener sampleRateListener = evt -> invalidateSampleRateCache();
    private final MeterMap.MeterMapListener meterMapListener = this::syncTempoMapBeatPositions;
    private double smpteFrameRate;
    private MeterMap meterMap;
    private TempoMap tempoMap;
    
    public TimeContext() {
        smpteFrameRate = 24.0;
        setMeterMap(new MeterMap());
        setTempoMap(new TempoMap());
    }
    
    public TimeContext(long sampleRate, MeterMap meterMap, TempoMap tempoMap) {
        this.cachedSampleRate = sampleRate;
        this.smpteFrameRate = 24.0;
        setMeterMap(meterMap);
        setTempoMap(tempoMap);
    }
    
    public TimeContext(TimeContext tc) {
        this.cachedSampleRate = tc.cachedSampleRate;
        this.smpteFrameRate = tc.smpteFrameRate;
        setMeterMap(new MeterMap(tc.meterMap));
        setTempoMap(new TempoMap(tc.tempoMap));
    }

    /**
     * Sets the ProjectProperties reference and refreshes the cached sample rate.
     * Subscribes to sampleRate property changes so the cache stays current.
     * ProjectProperties is the single source of truth for sample rate.
     */
    public void setProjectProperties(ProjectProperties projectProperties) {
        if (this.projectProperties != null) {
            this.projectProperties.removePropertyChangeListener(sampleRateListener);
        }
        this.projectProperties = projectProperties;
        if (this.projectProperties != null) {
            this.projectProperties.addPropertyChangeListener(sampleRateListener);
        }
        invalidateSampleRateCache();
    }

    private void invalidateSampleRateCache() {
        if (projectProperties != null) {
            try {
                long sr = Long.parseLong(projectProperties.getSampleRate().trim());
                if (sr > 0) {
                    cachedSampleRate = sr;
                    return;
                }
            } catch (NumberFormatException ignored) {}
        }
        cachedSampleRate = DEFAULT_SAMPLE_RATE;
    }

    public long getSampleRate() {
        return cachedSampleRate;
    }
    
    /**
     * Get the SMPTE frame rate for this context.
     * Used for SMPTE timecode display and snap calculations.
     * @return SMPTE frame rate (e.g., 24.0, 25.0, 29.97, 30.0)
     */
    public double getSmpteFrameRate() {
        return smpteFrameRate;
    }
    
    /**
     * Set the SMPTE frame rate for this context.
     * @param smpteFrameRate frame rate, must be positive
     */
    public void setSmpteFrameRate(double smpteFrameRate) {
        if (smpteFrameRate <= 0) {
            throw new IllegalArgumentException("SMPTE frame rate must be positive: " + smpteFrameRate);
        }
        this.smpteFrameRate = smpteFrameRate;
    }
    
    public MeterMap getMeterMap() {
        return meterMap;
    }
    
    public void setMeterMap(MeterMap meterMap) {
        if (this.meterMap != null) {
            this.meterMap.removeListener(meterMapListener);
        }
        this.meterMap = meterMap == null ? new MeterMap() : meterMap;
        this.meterMap.addListener(meterMapListener);
        syncTempoMapBeatPositions();
    }
    
    public TempoMap getTempoMap() {
        return tempoMap;
    }
    
    public void setTempoMap(TempoMap tempoMap) {
        this.tempoMap = tempoMap == null ? new TempoMap() : tempoMap;
        syncTempoMapBeatPositions();
    }

    private void syncTempoMapBeatPositions() {
        if (tempoMap == null || tempoMap.isEmpty() || meterMap == null || meterMap.isEmpty()) {
            return;
        }
        tempoMap.recalculateBeatPositions(this);
    }
    
    /**
     * Returns true if this context has the same musical context
     * (tempo map and meter map) as the other context. Used to determine
     * whether beat-based values need conversion when pasting between contexts.
     * 
     * @param other the other TimeContext to compare
     * @return true if tempo and meter maps are equal
     */
    public boolean hasSameMusicalContext(TimeContext other) {
        if (other == null) return false;
        if (this == other) return true;
        return tempoMap.equals(other.tempoMap) && meterMap.equals(other.meterMap);
    }

    /**
     * Save TimeContext to XML.
     */
    public Element saveAsXML() {
        Element retVal = new Element("timeContext");
        retVal.addElement("smpteFrameRate").setText(Double.toString(smpteFrameRate));
        retVal.addElement(meterMap.saveAsXML());
        retVal.addElement(tempoMap.saveAsXML());
        return retVal;
    }
    
    /**
     * Load TimeContext from XML.
     */
    public static TimeContext loadFromXML(Element data) throws Exception {
        TimeContext tc = new TimeContext();
        
        // sampleRate is no longer stored in TimeContext XML (ProjectProperties is the source of truth).
        // Old project files may contain <sampleRate> — silently ignored for backward compat.
        
        Element smpteFrameRateElem = data.getElement("smpteFrameRate");
        if (smpteFrameRateElem != null) {
            tc.setSmpteFrameRate(Double.parseDouble(smpteFrameRateElem.getTextString()));
        }
        
        Element meterMapElem = data.getElement("meterMap");
        if (meterMapElem != null) {
            tc.setMeterMap(MeterMap.loadFromXML(meterMapElem));
        }
        
        Element tempoMapElem = data.getElement("tempoMap");
        if (tempoMapElem != null) {
            tc.setTempoMap(TempoMap.loadFromXML(tempoMapElem));
        }
        
        return tc;
    }
}
