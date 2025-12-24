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
    
    /** Default PPQ (Pulses Per Quarter note) - industry standard */
    public static final int DEFAULT_PPQ = 480;
    
    private long sampleRate;
    private int ppq;
    private MeterMap meterMap;
    private TempoMap tempoMap;
    
    public TimeContext() {
        sampleRate = 44100;
        ppq = DEFAULT_PPQ;
        meterMap = new MeterMap();
        tempoMap = new TempoMap();
    }
    
    public TimeContext(long sampleRate, MeterMap meterMap, TempoMap tempoMap) {
        this.sampleRate = sampleRate;
        this.ppq = DEFAULT_PPQ;
        this.meterMap = meterMap;
        this.tempoMap = tempoMap;
    }
    
    public TimeContext(TimeContext tc) {
        this.sampleRate = tc.sampleRate;
        this.ppq = tc.ppq;
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
     * Get the PPQ (Pulses Per Quarter note) for this context.
     * Used for tick-based musical time representations (BBT, BBST).
     * @return PPQ value (default 480)
     */
    public int getPPQ() {
        return ppq;
    }
    
    /**
     * Set the PPQ (Pulses Per Quarter note) for this context.
     * @param ppq PPQ value, must be positive and divisible by 4
     */
    public void setPPQ(int ppq) {
        if (ppq <= 0) {
            throw new IllegalArgumentException("PPQ must be positive: " + ppq);
        }
        if (ppq % 4 != 0) {
            throw new IllegalArgumentException("PPQ must be divisible by 4: " + ppq);
        }
        this.ppq = ppq;
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
        retVal.addElement("ppq").setText(Integer.toString(ppq));
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
        
        Element ppqElem = data.getElement("ppq");
        if (ppqElem != null) {
            tc.setPPQ(Integer.parseInt(ppqElem.getTextString()));
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
