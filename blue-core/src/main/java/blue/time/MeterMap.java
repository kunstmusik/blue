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
import electric.xml.Elements;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.stream.Stream;

/**
 * Manages time signature (meter) changes across a musical timeline.
 * 
 * MeterMap maintains an ordered list of MeasureMeterPair entries, where each
 * entry defines the meter starting at a specific measure number. The meter
 * remains in effect until the next meter change.
 * 
 * Automatically maintains a cache of measure start beats for efficient
 * conversion between measure/beat positions and absolute Csound beats.
 * 
 * Entries are always kept sorted by measure number.
 *
 * @author stevenyi
 */
public class MeterMap {
    
    /**
     * Listener interface for MeterMap changes.
     */
    public interface MeterMapListener {
        void meterMapChanged();
    }

    private final List<MeasureMeterPair> entries = new ArrayList<>();
    private final List<MeterMapListener> listeners = new CopyOnWriteArrayList<>();
    protected double[] measureStartBeats = new double[0];

    public MeterMap() {
        entries.add(new MeasureMeterPair(1, new Meter(4, 4)));
        updateMeasureStartBeats();
    }

    public MeterMap(MeterMap meterMap) {
        for (MeasureMeterPair pair : meterMap.entries) {
            entries.add(new MeasureMeterPair(pair));
        }
        updateMeasureStartBeats();
    }
    
    // ========== Listener Management ==========
    
    public void addListener(MeterMapListener listener) {
        if (listener != null && !listeners.contains(listener)) {
            listeners.add(listener);
        }
    }
    
    public void removeListener(MeterMapListener listener) {
        listeners.remove(listener);
    }
    
    private void fireChanged() {
        updateMeasureStartBeats();
        for (MeterMapListener listener : listeners) {
            listener.meterMapChanged();
        }
    }
    
    // ========== List Operations ==========
    
    public int size() {
        return entries.size();
    }
    
    public boolean isEmpty() {
        return entries.isEmpty();
    }
    
    public MeasureMeterPair get(int index) {
        return entries.get(index);
    }
    
    public void add(MeasureMeterPair pair) {
        entries.add(pair);
        sortEntries();
        fireChanged();
    }
    
    public void set(int index, MeasureMeterPair pair) {
        entries.set(index, pair);
        sortEntries();
        fireChanged();
    }
    
    public void remove(int index) {
        entries.remove(index);
        fireChanged();
    }
    
    public void clear() {
        entries.clear();
        fireChanged();
    }
    
    /**
     * Replaces all entries in this MeterMap with copies from the source.
     * Preserves listeners registered on this object.
     * 
     * @param source the MeterMap to copy entries from
     */
    public void replaceAll(MeterMap source) {
        entries.clear();
        for (MeasureMeterPair pair : source.entries) {
            entries.add(new MeasureMeterPair(pair));
        }
        sortEntries();
        fireChanged();
    }
    
    public Stream<MeasureMeterPair> stream() {
        return entries.stream();
    }
    
    public List<MeasureMeterPair> getEntries() {
        return Collections.unmodifiableList(entries);
    }
    
    private void sortEntries() {
        entries.sort(Comparator.comparingLong(MeasureMeterPair::getMeasureNumber));
    }

    private void updateMeasureStartBeats() {
        measureStartBeats = new double[this.size()];
        
        if (this.isEmpty()) {
            return; // Nothing to update
        }
        
        measureStartBeats[0] = 0;

        for (int i = 1; i < this.size(); i++) {
            var lastMeterEntry = this.get(i - 1);
            var curMeterEntry = this.get(i);

            var measureDur = lastMeterEntry.getMeter().getMeasureBeatDuration();

            var durationOfMeasureRange = measureDur
                    * (curMeterEntry.getMeasureNumber()
                    - lastMeterEntry.getMeasureNumber());

            measureStartBeats[i] = measureStartBeats[i - 1] + durationOfMeasureRange;
        }
    }

    /**
     * Converts a bar/beat position to absolute Csound beats.
     * This is the core conversion method for BBT/BBST/BBF time units.
     * 
     * @param bar the bar (measure) number (1-based)
     * @param beat the beat number within the bar (1-based)
     * @return the equivalent position in Csound beats (without tick fraction)
     * @throws IllegalStateException if MeterMap is empty
     * @throws IllegalArgumentException if bar is before first meter entry
     *         or if beat number exceeds the meter's beat count
     */
    public double barBeatToBeats(long bar, int beat) {
        if (this.isEmpty()) {
            throw new IllegalStateException("MeterMap is empty");
        }

        if (bar < this.get(0).getMeasureNumber()) {
            throw new IllegalArgumentException(
                "Bar " + bar + " is before first meter entry at measure " + 
                this.get(0).getMeasureNumber());
        }

        // Find the meter entry that applies to this bar
        int index = this.size() - 1;
        while (index != 0 && this.get(index).getMeasureNumber() > bar) {
            index--;
        }

        var meterEntry = this.get(index);
        var meter = meterEntry.getMeter();
        
        // Validate beat number doesn't exceed meter's beat count
        if (beat > meter.numBeats) {
            throw new IllegalArgumentException(
                "Beat number " + beat + " exceeds meter " + meter + 
                " which has " + meter.numBeats + " beats per measure");
        }
        
        var measureNumInRange = bar - meterEntry.getMeasureNumber();
        double retVal = measureStartBeats[index];

        retVal += (measureNumInRange * meter.getMeasureBeatDuration()) 
                + ((beat - 1) * (4.0 / meter.beatLength));
        return retVal;
    }

    /**
     * Passthrough conversion for BeatTime (already in Csound beats).
     * 
     * @param beatTime the beat time value
     * @return the Csound beats value
     */
    double toBeats(TimePosition.BeatTime beatTime) {
        return beatTime.getCsoundBeats();
    }

    /**
     * Converts absolute Csound beats to BBT (Bars.Beats.Ticks) time.
     * 
     * @param csoundBeats the absolute beat position to convert
     * @param ppq the PPQ (pulses per quarter note) for tick calculation
     * @return a new BBTTime representing the bar/beat/tick position
     * @throws IllegalStateException if MeterMap is empty
     * @throws IllegalArgumentException if beats is negative
     */
    public TimePosition.BBTTime beatsToBBT(double csoundBeats, int ppq) {
        if (this.isEmpty()) {
            throw new IllegalStateException("MeterMap is empty");
        }
        
        if (csoundBeats < 0) {
            throw new IllegalArgumentException("Beats cannot be negative: " + csoundBeats);
        }
        
        // Find which meter range this beat falls into
        int index = 0;
        for (int i = 1; i < this.size(); i++) {
            if (csoundBeats >= measureStartBeats[i]) {
                index = i;
            } else {
                break;
            }
        }
        
        var meterEntry = this.get(index);
        var meter = meterEntry.getMeter();
        long baseMeasure = meterEntry.getMeasureNumber();
        double beatsFromRangeStart = csoundBeats - measureStartBeats[index];
        
        // Calculate how many complete measures and remaining beats
        double measureDuration = meter.getMeasureBeatDuration();
        long additionalMeasures = (long) (beatsFromRangeStart / measureDuration);
        double remainingBeats = beatsFromRangeStart - (additionalMeasures * measureDuration);
        
        // Convert remaining beats to beat number within measure
        // Beat number starts at 1, and is scaled by meter's beat length
        double beatWithFraction = 1.0 + (remainingBeats / (4.0 / meter.beatLength));
        
        int wholeBeat = (int) beatWithFraction;
        double fractionalBeat = beatWithFraction - wholeBeat;
        int ticks = (int) Math.round(fractionalBeat * ppq);
        
        // Handle tick overflow (ticks == ppq means next beat)
        if (ticks >= ppq) {
            ticks = 0;
            wholeBeat++;
            // Handle beat overflow to next measure
            if (wholeBeat > meter.numBeats) {
                wholeBeat = 1;
                additionalMeasures++;
            }
        }
        
        long bar = baseMeasure + additionalMeasures;
        
        return TimePosition.bbt(bar, wholeBeat, ticks);
    }
    
    /**
     * Converts absolute Csound beats to BBST (Bars.Beats.Sixteenths.Ticks) time.
     * 
     * @param csoundBeats the absolute beat position to convert
     * @param ppq the PPQ (pulses per quarter note) for tick calculation
     * @return a new BBSTTime representing the bar/beat/sixteenth/tick position
     * @throws IllegalStateException if MeterMap is empty
     * @throws IllegalArgumentException if beats is negative
     */
    public TimePosition.BBSTTime beatsToBBST(double csoundBeats, int ppq) {
        TimePosition.BBTTime bbt = beatsToBBT(csoundBeats, ppq);
        return bbt.toBBST(ppq);
    }
    
    /**
     * Converts absolute Csound beats to BBF (Bars.Beats.Fraction) time.
     * 
     * @param csoundBeats the absolute beat position to convert
     * @return a new BBFTime representing the bar/beat/fraction position
     * @throws IllegalStateException if MeterMap is empty
     * @throws IllegalArgumentException if beats is negative
     */
    public TimePosition.BBFTime beatsToBBF(double csoundBeats) {
        if (this.isEmpty()) {
            throw new IllegalStateException("MeterMap is empty");
        }
        
        if (csoundBeats < 0) {
            throw new IllegalArgumentException("Beats cannot be negative: " + csoundBeats);
        }
        
        // Find which meter range this beat falls into
        int index = 0;
        for (int i = 1; i < this.size(); i++) {
            if (csoundBeats >= measureStartBeats[i]) {
                index = i;
            } else {
                break;
            }
        }
        
        var meterEntry = this.get(index);
        var meter = meterEntry.getMeter();
        long baseMeasure = meterEntry.getMeasureNumber();
        double beatsFromRangeStart = csoundBeats - measureStartBeats[index];
        
        // Calculate how many complete measures and remaining beats
        double measureDuration = meter.getMeasureBeatDuration();
        long additionalMeasures = (long) (beatsFromRangeStart / measureDuration);
        double remainingBeats = beatsFromRangeStart - (additionalMeasures * measureDuration);
        
        // Convert remaining beats to beat number within measure
        double beatWithFraction = 1.0 + (remainingBeats / (4.0 / meter.beatLength));
        
        int wholeBeat = (int) beatWithFraction;
        double fractionalBeat = beatWithFraction - wholeBeat;
        int fraction = (int) Math.round(fractionalBeat * 100);
        
        // Handle fraction overflow (fraction == 100 means next beat)
        if (fraction >= 100) {
            fraction = 0;
            wholeBeat++;
            // Handle beat overflow to next measure
            if (wholeBeat > meter.numBeats) {
                wholeBeat = 1;
                additionalMeasures++;
            }
        }
        
        long bar = baseMeasure + additionalMeasures;
        
        return TimePosition.bbf(bar, wholeBeat, fraction);
    }
    
    /**
     * Save MeterMap to XML.
     */
    public Element saveAsXML() {
        Element retVal = new Element("meterMap");
        
        for (MeasureMeterPair pair : entries) {
            retVal.addElement(pair.saveAsXML());
        }
        
        return retVal;
    }
    
    /**
     * Load MeterMap from XML.
     */
    public static MeterMap loadFromXML(Element data) {
        MeterMap meterMap = new MeterMap();
        
        // Clear default entry
        meterMap.clear();
        
        // Load all meter entries
        Elements pairs = data.getElements("measureMeterPair");
        while (pairs.hasMoreElements()) {
            Element pairElement = pairs.next();
            meterMap.add(MeasureMeterPair.loadFromXML(pairElement));
        }
        
        // If empty after loading, add default
        if (meterMap.isEmpty()) {
            meterMap.add(new MeasureMeterPair(1, new Meter(4, 4)));
        }
        
        return meterMap;
    }

}
