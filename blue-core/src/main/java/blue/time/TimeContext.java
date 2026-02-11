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

/**
 * Context of time for a project. Used to resolve TimeUnit values according to meter, tempo, and sample rate.
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
    
    private long sampleRate;
    private double smpteFrameRate;
    private MeterMap meterMap;
    private TempoMap tempoMap;
    
    public TimeContext() {
        sampleRate = 44100;
        smpteFrameRate = 24.0;
        meterMap = new MeterMap();
        tempoMap = new TempoMap();
    }
    
    public TimeContext(long sampleRate, MeterMap meterMap, TempoMap tempoMap) {
        this.sampleRate = sampleRate;
        this.smpteFrameRate = 24.0;
        this.meterMap = meterMap;
        this.tempoMap = tempoMap;
    }
    
    public TimeContext(TimeContext tc) {
        this.sampleRate = tc.sampleRate;
        this.smpteFrameRate = tc.smpteFrameRate;
        this.meterMap = new MeterMap(tc.meterMap);
        this.tempoMap = new TempoMap(tc.tempoMap);
    }
    
    public long getSampleRate() {
        return sampleRate;
    }
    
    public void setSampleRate(long sampleRate) {
        this.sampleRate = sampleRate;
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
        this.meterMap = meterMap;
    }
    
    public TempoMap getTempoMap() {
        return tempoMap;
    }
    
    public void setTempoMap(TempoMap tempoMap) {
        this.tempoMap = tempoMap;
    }
    
    /**
     * Save TimeContext to XML.
     */
    public Element saveAsXML() {
        Element retVal = new Element("timeContext");
        retVal.addElement("sampleRate").setText(Long.toString(sampleRate));
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
        
        Element sampleRateElem = data.getElement("sampleRate");
        if (sampleRateElem != null) {
            tc.setSampleRate(Long.parseLong(sampleRateElem.getTextString()));
        }
        
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
