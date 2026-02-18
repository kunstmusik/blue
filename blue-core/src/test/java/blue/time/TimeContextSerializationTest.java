/*
 * blue - object composition environment for csound
 * Copyright (C) 2025
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
package blue.time;

import electric.xml.Element;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Test XML serialization for TimeContext, MeterMap, and TempoMap.
 * 
 * @author stevenyi
 */
public class TimeContextSerializationTest {
    
    @Test
    public void testMeterSerialization() {
        Meter original = new Meter(3, 4);
        Element xml = original.saveAsXML();
        Meter loaded = Meter.loadFromXML(xml);
        
        assertEquals(original.numBeats, loaded.numBeats);
        assertEquals(original.beatLength, loaded.beatLength);
        assertEquals(original, loaded);
    }
    
    @Test
    public void testMeasureMeterPairSerialization() {
        MeasureMeterPair original = new MeasureMeterPair(5, new Meter(6, 8));
        Element xml = original.saveAsXML();
        MeasureMeterPair loaded = MeasureMeterPair.loadFromXML(xml);
        
        assertEquals(original.getMeasureNumber(), loaded.getMeasureNumber());
        assertEquals(original.getMeter(), loaded.getMeter());
    }
    
    @Test
    public void testMeterMapSerialization() {
        MeterMap original = new MeterMap();
        original.clear();
        original.add(new MeasureMeterPair(1, new Meter(4, 4)));
        original.add(new MeasureMeterPair(5, new Meter(3, 4)));
        original.add(new MeasureMeterPair(9, new Meter(6, 8)));
        
        Element xml = original.saveAsXML();
        MeterMap loaded = MeterMap.loadFromXML(xml);
        
        assertEquals(original.size(), loaded.size());
        for (int i = 0; i < original.size(); i++) {
            assertEquals(original.get(i).getMeasureNumber(), loaded.get(i).getMeasureNumber());
            assertEquals(original.get(i).getMeter(), loaded.get(i).getMeter());
        }
    }
    
    @Test
    public void testTempoMapSerialization() throws Exception {
        TempoMap original = TempoMap.createTempoMap("0 60 4 120 8 90");
        assertNotNull(original);
        
        Element xml = original.saveAsXML();
        TempoMap loaded = TempoMap.loadFromXML(xml);
        
        assertNotNull(loaded);
        
        // Test conversion consistency at multiple points
        for (double testBeat : new double[]{0.0, 2.0, 4.0, 6.0, 8.0, 10.0}) {
            double originalSeconds = original.beatsToSeconds(testBeat);
            double loadedSeconds = loaded.beatsToSeconds(testBeat);
            assertEquals("Beat " + testBeat, originalSeconds, loadedSeconds, 0.0001);
        }
        
        // Test reverse conversion
        for (double testSeconds : new double[]{0.0, 1.0, 2.0, 3.0, 4.0}) {
            double originalBeats = original.secondsToBeats(testSeconds);
            double loadedBeats = loaded.secondsToBeats(testSeconds);
            assertEquals("Seconds " + testSeconds, originalBeats, loadedBeats, 0.0001);
        }
    }
    
    @Test
    public void testTimeContextSerialization() throws Exception {
        TimeContext original = new TimeContext();
        blue.ProjectProperties props = new blue.ProjectProperties();
        props.setSampleRate("48000");
        original.setProjectProperties(props);
        
        // Set up custom meter map
        MeterMap meterMap = new MeterMap();
        meterMap.clear();
        meterMap.add(new MeasureMeterPair(1, new Meter(4, 4)));
        meterMap.add(new MeasureMeterPair(5, new Meter(3, 4)));
        original.setMeterMap(meterMap);
        
        // Set up custom tempo map
        TempoMap tempoMap = TempoMap.createTempoMap("0 120 4 90");
        original.setTempoMap(tempoMap);
        
        // Serialize and deserialize
        Element xml = original.saveAsXML();
        TimeContext loaded = TimeContext.loadFromXML(xml);
        
        // Verify sampleRate is NOT serialized in TimeContext XML (ProjectProperties is the source of truth)
        assertNull(xml.getElement("sampleRate"));
        
        // Verify meter map
        assertEquals(original.getMeterMap().size(), loaded.getMeterMap().size());
        for (int i = 0; i < original.getMeterMap().size(); i++) {
            assertEquals(
                original.getMeterMap().get(i).getMeasureNumber(), 
                loaded.getMeterMap().get(i).getMeasureNumber()
            );
            assertEquals(
                original.getMeterMap().get(i).getMeter(), 
                loaded.getMeterMap().get(i).getMeter()
            );
        }
        
        // Verify tempo map
        double testBeat = 3.0;
        double originalSeconds = original.getTempoMap().beatsToSeconds(testBeat);
        double loadedSeconds = loaded.getTempoMap().beatsToSeconds(testBeat);
        assertEquals(originalSeconds, loadedSeconds, 0.0001);
    }
    
    @Test
    public void testLegacyXmlWithSampleRateIsIgnored() throws Exception {
        // Old project files contain <sampleRate> in <timeContext> — must load silently
        TimeContext original = new TimeContext();
        Element xml = original.saveAsXML();
        xml.addElement("sampleRate").setText("48000"); // inject legacy element

        TimeContext loaded = TimeContext.loadFromXML(xml);

        // sampleRate from XML is ignored; loaded context has no ProjectProperties wired
        // so it falls back to the default 44100
        assertEquals(44100L, loaded.getSampleRate());
    }

    @Test
    public void testTimeContextDefaultSerialization() throws Exception {
        // Test that default TimeContext serializes and loads correctly
        TimeContext original = new TimeContext();
        
        Element xml = original.saveAsXML();
        TimeContext loaded = TimeContext.loadFromXML(xml);
        
        // Test functional equivalence rather than exact structure
        // Both should convert beats to seconds the same way
        double testBeat = 4.0;
        double originalSeconds = original.getTempoMap().beatsToSeconds(testBeat);
        double loadedSeconds = loaded.getTempoMap().beatsToSeconds(testBeat);
        assertEquals(originalSeconds, loadedSeconds, 0.0001);
        
        // Both should have same meter at measure 1
        assertEquals(
            original.getMeterMap().get(0).getMeter(),
            loaded.getMeterMap().get(0).getMeter()
        );
    }
}
