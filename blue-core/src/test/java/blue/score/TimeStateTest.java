/*
 * blue - object composition environment for csound
 * Copyright (c) 2025 Steven Yi (stevenyi@gmail.com)
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
package blue.score;

import blue.time.TempoMap;
import blue.time.TimeBase;
import electric.xml.Document;
import electric.xml.Element;
import electric.xml.ParseException;
import org.junit.Before;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 * Tests for TimeState class.
 *
 * @author Steven Yi
 */
public class TimeStateTest {

    private TimeState timeState;

    @Before
    public void setUp() {
        timeState = new TimeState();
    }

    // ========== setTimeDisplay Tests ==========

    @Test
    public void testSetTimeDisplayValid() {
        timeState.setTimeDisplay(TimeBase.TIME);
        assertEquals(TimeBase.TIME, timeState.getTimeDisplay());
        
        timeState.setTimeDisplay(TimeBase.CSOUND_BEATS);
        assertEquals(TimeBase.CSOUND_BEATS, timeState.getTimeDisplay());
        
        timeState.setTimeDisplay(TimeBase.BBT);
        assertEquals(TimeBase.BBT, timeState.getTimeDisplay());
    }

    @Test(expected = IllegalArgumentException.class)
    public void testSetTimeDisplayNullThrowsException() {
        timeState.setTimeDisplay(null);
    }

    // ========== setSecondaryTimeDisplay Tests ==========

    @Test
    public void testSetSecondaryTimeDisplayValid() {
        timeState.setSecondaryTimeDisplay(TimeBase.CSOUND_BEATS);
        assertEquals(TimeBase.CSOUND_BEATS, timeState.getSecondaryTimeDisplay());
        
        timeState.setSecondaryTimeDisplay(TimeBase.SMPTE);
        assertEquals(TimeBase.SMPTE, timeState.getSecondaryTimeDisplay());
    }

    @Test(expected = IllegalArgumentException.class)
    public void testSetSecondaryTimeDisplayNullThrowsException() {
        timeState.setSecondaryTimeDisplay(null);
    }

    // ========== Default Values Tests ==========

    @Test
    public void testDefaultTimeDisplay() {
        assertEquals(TimeBase.CSOUND_BEATS, timeState.getTimeDisplay());
    }

    @Test
    public void testDefaultSecondaryTimeDisplay() {
        assertEquals(TimeBase.TIME, timeState.getSecondaryTimeDisplay());
    }

    @Test
    public void testDefaultSecondaryRulerEnabled() {
        assertFalse(timeState.isSecondaryRulerEnabled());
    }

    @Test
    public void testDefaultRowVisibility() {
        assertTrue(timeState.isTempoRowVisible());
        assertTrue(timeState.isMeterRowVisible());
        assertTrue(timeState.isMarkersRowVisible());
    }

    // ========== Copy Constructor Tests ==========

    @Test
    public void testCopyConstructor() {
        timeState.setTimeDisplay(TimeBase.BBT);
        timeState.setSecondaryTimeDisplay(TimeBase.SMPTE);
        timeState.setSecondaryRulerEnabled(true);
        timeState.setTempoRowVisible(false);
        timeState.setMeterRowVisible(false);
        timeState.setMarkersRowVisible(false);
        timeState.setSnapEnabled(true);
        timeState.setSnapValue(SnapValue.EIGHTH);

        TimeState copy = new TimeState(timeState);

        assertEquals(TimeBase.BBT, copy.getTimeDisplay());
        assertEquals(TimeBase.SMPTE, copy.getSecondaryTimeDisplay());
        assertTrue(copy.isSecondaryRulerEnabled());
        assertFalse(copy.isTempoRowVisible());
        assertFalse(copy.isMeterRowVisible());
        assertFalse(copy.isMarkersRowVisible());
        assertTrue(copy.isSnapEnabled());
        assertEquals(SnapValue.EIGHTH, copy.getSnapValue());
    }

    // ========== Property Change Listener Tests ==========

    @Test
    public void testTimeDisplayPropertyChangeEvent() {
        final boolean[] listenerCalled = {false};
        final TimeBase[] oldValue = {null};
        final TimeBase[] newValue = {null};

        timeState.addPropertyChangeListener(evt -> {
            if ("timeDisplay".equals(evt.getPropertyName())) {
                listenerCalled[0] = true;
                oldValue[0] = (TimeBase) evt.getOldValue();
                newValue[0] = (TimeBase) evt.getNewValue();
            }
        });

        timeState.setTimeDisplay(TimeBase.TIME);

        assertTrue(listenerCalled[0]);
        assertEquals(TimeBase.CSOUND_BEATS, oldValue[0]);
        assertEquals(TimeBase.TIME, newValue[0]);
    }

    @Test
    public void testSecondaryTimeDisplayPropertyChangeEvent() {
        final boolean[] listenerCalled = {false};

        timeState.addPropertyChangeListener(evt -> {
            if ("secondaryTimeDisplay".equals(evt.getPropertyName())) {
                listenerCalled[0] = true;
            }
        });

        timeState.setSecondaryTimeDisplay(TimeBase.FRAME);

        assertTrue(listenerCalled[0]);
    }

    // ========== SnapValue Tests ==========

    @Test
    public void testDefaultSnapValue() {
        assertEquals(SnapValue.BEAT, timeState.getSnapValue());
    }

    @Test
    public void testSetSnapValueMusical() {
        timeState.setSnapValue(SnapValue.HALF);
        assertEquals(SnapValue.HALF, timeState.getSnapValue());
    }

    @Test
    public void testSetSnapValueTriplet() {
        timeState.setSnapValue(SnapValue.EIGHTH_TRIPLET);
        assertEquals(SnapValue.EIGHTH_TRIPLET, timeState.getSnapValue());
    }

    @Test
    public void testSetSnapValueTimeBased() {
        timeState.setSnapValue(SnapValue.ONE_SECOND);
        assertEquals(SnapValue.ONE_SECOND, timeState.getSnapValue());
    }

    @Test(expected = IllegalArgumentException.class)
    public void testSetSnapValueNullThrowsException() {
        timeState.setSnapValue(null);
    }

    @Test
    public void testSnapValuePropertyChangeEvent() {
        final boolean[] listenerCalled = {false};
        final SnapValue[] oldVal = {null};
        final SnapValue[] newVal = {null};

        timeState.addPropertyChangeListener(evt -> {
            if ("snapValue".equals(evt.getPropertyName())) {
                listenerCalled[0] = true;
                oldVal[0] = (SnapValue) evt.getOldValue();
                newVal[0] = (SnapValue) evt.getNewValue();
            }
        });

        timeState.setSnapValue(SnapValue.SIXTEENTH);

        assertTrue(listenerCalled[0]);
        assertEquals(SnapValue.BEAT, oldVal[0]);
        assertEquals(SnapValue.SIXTEENTH, newVal[0]);
    }

    // ========== getSnapValueInBeats Tests ==========

    @Test
    public void testGetSnapValueInBeatsMusical() {
        timeState.setSnapValue(SnapValue.BEAT);
        // Musical values are tempo-independent
        double sv60 = timeState.getSnapValueInBeats(0.0, null, 44100);
        assertEquals(1.0, sv60, 0.001);

        TempoMap tempoMap = new TempoMap();
        double sv120 = timeState.getSnapValueInBeats(0.0, tempoMap, 44100);
        assertEquals(1.0, sv120, 0.001);
    }

    @Test
    public void testGetSnapValueInBeatsTimeBased() {
        timeState.setSnapValue(SnapValue.ONE_SECOND);
        // 1 second at 60 BPM = 1 beat
        double sv = timeState.getSnapValueInBeats(0.0, null, 44100);
        assertEquals(1.0, sv, 0.001);

        // 1 second at 120 BPM = 2 beats
        TempoMap tempoMap = new TempoMap();
        tempoMap.setEnabled(true);
        tempoMap.setTempoPoint(0, 0.0, 120.0);
        double sv120 = timeState.getSnapValueInBeats(0.0, tempoMap, 44100);
        assertEquals(2.0, sv120, 0.001);
    }

    // ========== XML Serialization Tests ==========

    @Test
    public void testSnapValueXmlRoundTrip() {
        timeState.setSnapValue(SnapValue.QUARTER_TRIPLET);
        timeState.setSnapEnabled(true);

        Element xml = timeState.saveAsXML();
        TimeState loaded = TimeState.loadFromXML(xml);

        assertEquals(SnapValue.QUARTER_TRIPLET, loaded.getSnapValue());
        assertTrue(loaded.isSnapEnabled());
    }

    @Test
    public void testSnapValueXmlBackwardCompatibilityLegacyDouble() throws ParseException {
        // Simulate legacy XML with double snapValue (old format)
        String xmlStr = "<timeState version=\"2\">" +
                "<zoomIterations>0</zoomIterations>" +
                "<snapEnabled>true</snapEnabled>" +
                "<snapValue>0.5</snapValue>" +
                "<timeDisplay>CSOUND_BEATS</timeDisplay>" +
                "<secondaryTimeDisplay>TIME</secondaryTimeDisplay>" +
                "<secondaryRulerEnabled>false</secondaryRulerEnabled>" +
                "<smpteFrameRate>24.0</smpteFrameRate>" +
                "</timeState>";
        Document doc = new Document(xmlStr);
        TimeState loaded = TimeState.loadFromXML(doc.getRoot());

        // 0.5 should map to HALF via closestMatch
        assertEquals(SnapValue.HALF, loaded.getSnapValue());
        assertTrue(loaded.isSnapEnabled());
        assertTrue(loaded.isTempoRowVisible());
        assertTrue(loaded.isMeterRowVisible());
        assertTrue(loaded.isMarkersRowVisible());
    }

    @Test
    public void testSnapValueClosestMatch() {
        assertEquals(SnapValue.BEAT, SnapValue.closestMatch(1.0));
        assertEquals(SnapValue.HALF, SnapValue.closestMatch(0.5));
        assertEquals(SnapValue.QUARTER, SnapValue.closestMatch(0.25));
        assertEquals(SnapValue.EIGHTH, SnapValue.closestMatch(0.125));
        assertEquals(SnapValue.BAR, SnapValue.closestMatch(4.0));
        // Arbitrary value should find closest
        assertEquals(SnapValue.BEAT, SnapValue.closestMatch(0.9));
        assertEquals(SnapValue.HALF, SnapValue.closestMatch(0.45));
    }

    @Test
    public void testSecondaryRulerEnabledPropertyChangeEvent() {
        final boolean[] listenerCalled = {false};

        timeState.addPropertyChangeListener(evt -> {
            if ("secondaryRulerEnabled".equals(evt.getPropertyName())) {
                listenerCalled[0] = true;
            }
        });

        timeState.setSecondaryRulerEnabled(true);

        assertTrue(listenerCalled[0]);
    }

    @Test
    public void testTempoRowVisiblePropertyChangeEvent() {
        final boolean[] listenerCalled = {false};

        timeState.addPropertyChangeListener(evt -> {
            if ("tempoRowVisible".equals(evt.getPropertyName())) {
                listenerCalled[0] = true;
            }
        });

        timeState.setTempoRowVisible(false);

        assertTrue(listenerCalled[0]);
    }

    @Test
    public void testMeterRowVisiblePropertyChangeEvent() {
        final boolean[] listenerCalled = {false};

        timeState.addPropertyChangeListener(evt -> {
            if ("meterRowVisible".equals(evt.getPropertyName())) {
                listenerCalled[0] = true;
            }
        });

        timeState.setMeterRowVisible(false);

        assertTrue(listenerCalled[0]);
    }

    @Test
    public void testMarkersRowVisiblePropertyChangeEvent() {
        final boolean[] listenerCalled = {false};

        timeState.addPropertyChangeListener(evt -> {
            if ("markersRowVisible".equals(evt.getPropertyName())) {
                listenerCalled[0] = true;
            }
        });

        timeState.setMarkersRowVisible(false);

        assertTrue(listenerCalled[0]);
    }

    @Test
    public void testRowVisibilityXmlRoundTrip() {
        timeState.setTempoRowVisible(false);
        timeState.setMeterRowVisible(false);
        timeState.setMarkersRowVisible(false);

        Element xml = timeState.saveAsXML();
        TimeState loaded = TimeState.loadFromXML(xml);

        assertFalse(loaded.isTempoRowVisible());
        assertFalse(loaded.isMeterRowVisible());
        assertFalse(loaded.isMarkersRowVisible());
    }
}
