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

import electric.xml.Document;
import electric.xml.Element;
import org.junit.Test;

import static org.junit.Assert.*;

/**
 * Tests for the unified TempoMap with CurveType support.
 */
public class TempoMapTest {
    
    private static final double EPSILON = 0.0001;
    
    // ========== Basic Construction Tests ==========
    
    @Test
    public void testDefaultConstruction() {
        TempoMap tm = new TempoMap();
        
        assertEquals(1, tm.size());
        assertEquals(0.0, tm.getBeat(0), EPSILON);
        assertEquals(60.0, tm.getTempo(0), EPSILON);
        assertEquals(CurveType.CONSTANT, tm.getCurveType(0));
        assertFalse(tm.isEnabled());
        assertFalse(tm.isVisible());
    }
    
    @Test
    public void testCopyConstruction() {
        TempoMap original = new TempoMap();
        original.setEnabled(true);
        original.setVisible(true);
        original.addTempoPoint(new TempoPoint(4.0, 120.0, CurveType.CONSTANT));
        
        TempoMap copy = new TempoMap(original);
        
        assertEquals(2, copy.size());
        assertTrue(copy.isEnabled());
        assertTrue(copy.isVisible());
        assertEquals(CurveType.CONSTANT, copy.getCurveType(1));
    }
    
    // ========== Enabled/Disabled Behavior Tests ==========
    
    @Test
    public void testDisabledUsesConstantTempo() {
        TempoMap tm = new TempoMap();
        tm.addTempoPoint(new TempoPoint(4.0, 120.0)); // Add accelerando
        tm.setEnabled(false);
        
        // When disabled, should use constant 60 BPM
        // At 60 BPM, 1 beat = 1 second
        assertEquals(4.0, tm.beatsToSeconds(4.0), EPSILON);
        assertEquals(8.0, tm.beatsToSeconds(8.0), EPSILON);
    }
    
    @Test
    public void testEnabledUsesTempoMap() {
        TempoMap tm = new TempoMap();
        tm.setTempoPoint(0, 0.0, 120.0); // 120 BPM at beat 0
        tm.setEnabled(true);
        
        // At 120 BPM, 1 beat = 0.5 seconds
        assertEquals(0.5, tm.beatsToSeconds(1.0), EPSILON);
        assertEquals(2.0, tm.beatsToSeconds(4.0), EPSILON);
    }
    
    // ========== CurveType.LINEAR Tests ==========
    
    @Test
    public void testLinearInterpolation() {
        TempoMap tm = new TempoMap();
        tm.setTempoPoint(0, 0.0, 60.0, CurveType.LINEAR);
        tm.addTempoPoint(new TempoPoint(4.0, 120.0, CurveType.LINEAR));
        tm.setEnabled(true);
        
        // At beat 0: tempo = 60 BPM
        assertEquals(60.0, tm.getTempoAt(0.0), EPSILON);
        
        // At beat 2: tempo should be halfway = 90 BPM
        assertEquals(90.0, tm.getTempoAt(2.0), EPSILON);
        
        // At beat 4: tempo = 120 BPM
        assertEquals(120.0, tm.getTempoAt(4.0), EPSILON);
    }
    
    @Test
    public void testLinearBeatsToSeconds() {
        TempoMap tm = TempoMap.createTempoMap("0 60 4 120");
        tm.setEnabled(true);
        
        // Beat 0 should be 0 seconds
        assertEquals(0.0, tm.beatsToSeconds(0.0), EPSILON);
        
        // The time for 4 beats with accelerando from 60 to 120 BPM
        // This is the area under the curve (60/tempo) from beat 0 to 4
        double time4 = tm.beatsToSeconds(4.0);
        assertTrue(time4 > 0);
        assertTrue(time4 < 4.0); // Should be less than 4 seconds (faster than 60 BPM average)
    }
    
    @Test
    public void testLinearSecondsToBeats() {
        TempoMap tm = TempoMap.createTempoMap("0 60 4 120");
        tm.setEnabled(true);
        
        // Round-trip test
        double beat = 2.5;
        double seconds = tm.beatsToSeconds(beat);
        double beatBack = tm.secondsToBeats(seconds);
        
        assertEquals(beat, beatBack, EPSILON);
    }
    
    // ========== CurveType.CONSTANT Tests ==========
    
    @Test
    public void testConstantCurve() {
        TempoMap tm = new TempoMap();
        tm.setTempoPoint(0, 0.0, 60.0, CurveType.CONSTANT);
        tm.addTempoPoint(new TempoPoint(4.0, 120.0, CurveType.CONSTANT));
        tm.setEnabled(true);
        
        // With CONSTANT, tempo stays at 60 until beat 4, then jumps to 120
        assertEquals(60.0, tm.getTempoAt(0.0), EPSILON);
        assertEquals(60.0, tm.getTempoAt(2.0), EPSILON);
        assertEquals(60.0, tm.getTempoAt(3.99), EPSILON);
        assertEquals(120.0, tm.getTempoAt(4.0), EPSILON);
    }
    
    @Test
    public void testConstantBeatsToSeconds() {
        TempoMap tm = new TempoMap();
        tm.setTempoPoint(0, 0.0, 60.0, CurveType.CONSTANT);
        tm.addTempoPoint(new TempoPoint(4.0, 120.0, CurveType.CONSTANT));
        tm.setEnabled(true);
        
        // First 4 beats at 60 BPM = 4 seconds
        assertEquals(4.0, tm.beatsToSeconds(4.0), EPSILON);
        
        // Next 4 beats at 120 BPM = 2 seconds, total = 6 seconds
        assertEquals(6.0, tm.beatsToSeconds(8.0), EPSILON);
    }
    
    @Test
    public void testConstantSecondsToBeats() {
        TempoMap tm = new TempoMap();
        tm.setTempoPoint(0, 0.0, 60.0, CurveType.CONSTANT);
        tm.addTempoPoint(new TempoPoint(4.0, 120.0, CurveType.CONSTANT));
        tm.setEnabled(true);
        
        // At 2 seconds, we're at beat 2 (60 BPM)
        assertEquals(2.0, tm.secondsToBeats(2.0), EPSILON);
        
        // At 5 seconds: 4 beats in first 4 seconds, then 1 second at 120 BPM = 2 beats
        assertEquals(6.0, tm.secondsToBeats(5.0), EPSILON);
    }
    
    // ========== createTempoMap (Legacy Format) Tests ==========
    
    @Test
    public void testCreateTempoMapSimple() {
        TempoMap tm = TempoMap.createTempoMap("0 60");
        
        assertNotNull(tm);
        assertEquals(1, tm.size());
        assertEquals(0.0, tm.getBeat(0), EPSILON);
        assertEquals(60.0, tm.getTempo(0), EPSILON);
        // createTempoMap should set enabled=true for TimeWarpProcessor use
        assertTrue(tm.isEnabled());
    }
    
    @Test
    public void testCreateTempoMapMultiplePoints() {
        TempoMap tm = TempoMap.createTempoMap("0 60 4 120 8 90");
        
        assertNotNull(tm);
        assertEquals(3, tm.size());
        assertEquals(4.0, tm.getBeat(1), EPSILON);
        assertEquals(120.0, tm.getTempo(1), EPSILON);
    }
    
    @Test
    public void testCreateTempoMapInvalidOddTokens() {
        TempoMap tm = TempoMap.createTempoMap("0 60 4");
        assertNull(tm);
    }
    
    @Test
    public void testCreateTempoMapInvalidNegativeBeat() {
        TempoMap tm = TempoMap.createTempoMap("-1 60");
        assertNull(tm);
    }
    
    @Test
    public void testCreateTempoMapInvalidZeroTempo() {
        TempoMap tm = TempoMap.createTempoMap("0 0");
        assertNull(tm);
    }
    
    // ========== XML Serialization Tests ==========
    
    @Test
    public void testSaveAndLoadXML() throws Exception {
        TempoMap original = new TempoMap();
        original.setEnabled(true);
        original.setVisible(true);
        original.setTempoPoint(0, 0.0, 80.0, CurveType.CONSTANT);
        original.addTempoPoint(new TempoPoint(8.0, 160.0, CurveType.LINEAR));
        
        Element xml = original.saveAsXML();
        TempoMap loaded = TempoMap.loadFromXML(xml);
        
        assertEquals(original.size(), loaded.size());
        assertEquals(original.isEnabled(), loaded.isEnabled());
        assertEquals(original.isVisible(), loaded.isVisible());
        assertEquals(original.getTempo(0), loaded.getTempo(0), EPSILON);
        assertEquals(original.getCurveType(0), loaded.getCurveType(0));
        assertEquals(original.getTempo(1), loaded.getTempo(1), EPSILON);
        assertEquals(original.getCurveType(1), loaded.getCurveType(1));
    }
    
    @Test
    public void testLoadLegacyXML() throws Exception {
        // Simulate old beatTempoPair format
        String xmlStr = """
            <tempoMap>
                <beatTempoPair>
                    <beat>0.0</beat>
                    <tempo>60.0</tempo>
                </beatTempoPair>
                <beatTempoPair>
                    <beat>4.0</beat>
                    <tempo>120.0</tempo>
                </beatTempoPair>
            </tempoMap>
            """;
        
        Document doc = new Document(xmlStr);
        TempoMap loaded = TempoMap.loadFromXML(doc.getRoot());
        
        assertEquals(2, loaded.size());
        assertEquals(0.0, loaded.getBeat(0), EPSILON);
        assertEquals(60.0, loaded.getTempo(0), EPSILON);
        assertEquals(4.0, loaded.getBeat(1), EPSILON);
        assertEquals(120.0, loaded.getTempo(1), EPSILON);
        // Legacy format should default to LINEAR
        assertEquals(CurveType.LINEAR, loaded.getCurveType(0));
    }
    
    // ========== Listener Tests ==========
    
    @Test
    public void testTempoMapListener() {
        TempoMap tm = new TempoMap();
        int[] callCount = {0};
        
        tm.addListener(() -> callCount[0]++);
        
        tm.addTempoPoint(new TempoPoint(4.0, 120.0));
        assertEquals(1, callCount[0]);
        
        tm.setTempoPoint(0, 0.0, 80.0);
        assertEquals(2, callCount[0]);
        
        tm.removeTempoPoint(1);
        assertEquals(3, callCount[0]);
    }
    
    @Test
    public void testPropertyChangeListener() {
        TempoMap tm = new TempoMap();
        java.util.List<String> properties = new java.util.ArrayList<>();
        
        tm.addPropertyChangeListener(evt -> properties.add(evt.getPropertyName()));
        
        tm.setEnabled(true);
        // setEnabled fires "enabled" then "data" (via fireChanged)
        assertTrue(properties.contains("enabled"));
        assertTrue(properties.contains("data"));
        
        properties.clear();
        tm.setVisible(true);
        // setVisible only fires "visible"
        assertEquals(1, properties.size());
        assertEquals("visible", properties.get(0));
    }
    
    // ========== BBSTTime Position Tests ==========
    
    @Test
    public void testTempoPointWithBBSTTime() {
        // Create a tempo point at bar 2, beat 1
        TempoPoint point = new TempoPoint(TimePosition.bbst(2, 1, 1, 0), 120.0, CurveType.LINEAR);
        
        assertEquals(120.0, point.getTempo(), EPSILON);
        assertEquals(CurveType.LINEAR, point.getCurveType());
        assertTrue(point.getPosition() instanceof TimePosition.BBSTTime);
    }
    
    @Test
    public void testRecalculateBeatPositions() {
        TempoMap tm = new TempoMap();
        tm.setEnabled(true);
        
        // Add a tempo point at bar 2, beat 1 (in 4/4, this is beat 4)
        tm.addTempoPoint(new TempoPoint(TimePosition.bbst(2, 1, 1, 0), 120.0, CurveType.LINEAR));
        
        // Create a TimeContext with default 4/4 meter map
        TimeContext context = new TimeContext();
        
        // Recalculate beat positions
        tm.recalculateBeatPositions(context);
        
        // In 4/4, bar 2 beat 1 = beat 4 (bar 1 has beats 0-3.999, bar 2 starts at beat 4)
        
        // The second point should have its beat recalculated
        assertEquals(2, tm.size());
        // First point is at beat 0
        assertEquals(0.0, tm.getBeat(0), EPSILON);
    }
    
    // ========== Edge Cases ==========
    
    @Test
    public void testBeyondLastPoint() {
        TempoMap tm = new TempoMap();
        tm.setTempoPoint(0, 0.0, 120.0, CurveType.LINEAR);
        tm.setEnabled(true);
        
        // Beyond the last point, tempo should stay constant
        assertEquals(120.0, tm.getTempoAt(100.0), EPSILON);
        
        // At 120 BPM, 100 beats = 50 seconds
        assertEquals(50.0, tm.beatsToSeconds(100.0), EPSILON);
    }
    
    @Test
    public void testCannotRemoveLastPoint() {
        TempoMap tm = new TempoMap();
        
        assertThrows(IllegalStateException.class, () -> tm.removeTempoPoint(0));
    }
    
    // ========== Legacy Migration Tests ==========
    
    @Test
    public void testMigrationFromLegacyTempoXML() throws Exception {
        // Create legacy <tempo> XML with multiple points
        String legacyXml = """
            <tempo>
              <enabled>true</enabled>
              <visible>true</visible>
              <line name="" version="2" max="240.0" min="30.0" bdresolution="-1" color="-8355712" rightBound="false" endPointsLinked="false">
                <linePoint x="0.0" y="60.0"/>
                <linePoint x="4.0" y="120.0"/>
                <linePoint x="8.0" y="90.0"/>
              </line>
            </tempo>
            """;
        
        Document doc = new Document(legacyXml);
        Element tempoElement = doc.getRoot();
        
        // Migrate to new TempoMap
        TempoMap migrated = TempoMap.loadFromLegacyTempoXML(tempoElement);
        
        // Verify enabled/visible state
        assertTrue(migrated.isEnabled());
        assertTrue(migrated.isVisible());
        
        // Verify points were migrated
        assertEquals(3, migrated.size());
        assertEquals(0.0, migrated.getBeat(0), EPSILON);
        assertEquals(60.0, migrated.getTempo(0), EPSILON);
        assertEquals(4.0, migrated.getBeat(1), EPSILON);
        assertEquals(120.0, migrated.getTempo(1), EPSILON);
        assertEquals(8.0, migrated.getBeat(2), EPSILON);
        assertEquals(90.0, migrated.getTempo(2), EPSILON);
        
        // All should be LINEAR (old system always used linear)
        assertEquals(CurveType.LINEAR, migrated.getCurveType(0));
        assertEquals(CurveType.LINEAR, migrated.getCurveType(1));
        assertEquals(CurveType.LINEAR, migrated.getCurveType(2));
    }
    
    @Test
    public void testMigrationPreservesTempoCalculations() throws Exception {
        // Create legacy <tempo> XML with accelerando
        String legacyXml = """
            <tempo>
              <enabled>true</enabled>
              <visible>false</visible>
              <line name="" version="2" max="240.0" min="30.0" bdresolution="-1" color="-8355712" rightBound="false" endPointsLinked="false">
                <linePoint x="0.0" y="60.0"/>
                <linePoint x="4.0" y="120.0"/>
              </line>
            </tempo>
            """;
        
        Document doc = new Document(legacyXml);
        Element tempoElement = doc.getRoot();
        
        // Migrate
        TempoMap migrated = TempoMap.loadFromLegacyTempoXML(tempoElement);
        
        // The tempo calculations should work correctly
        // At beat 0: tempo = 60
        assertEquals(60.0, migrated.getTempoAt(0.0), EPSILON);
        
        // At beat 2: tempo should be interpolated to 90
        assertEquals(90.0, migrated.getTempoAt(2.0), EPSILON);
        
        // At beat 4: tempo = 120
        assertEquals(120.0, migrated.getTempoAt(4.0), EPSILON);
    }
    
    @Test
    public void testReset() {
        TempoMap tm = new TempoMap();
        tm.setEnabled(true);
        tm.addTempoPoint(new TempoPoint(4.0, 120.0));
        tm.addTempoPoint(new TempoPoint(8.0, 90.0));
        
        tm.reset();
        
        assertEquals(1, tm.size());
        assertEquals(0.0, tm.getBeat(0), EPSILON);
        assertEquals(60.0, tm.getTempo(0), EPSILON);
    }
}
