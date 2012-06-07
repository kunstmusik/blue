/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
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
package blue.score.layers.patterns.core;

import electric.xml.Element;
import org.junit.*;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class PatternDataTest {
    
    private PatternData patternData = null;
    
    public PatternDataTest() {
    }

    @BeforeClass
    public static void setUpClass() throws Exception {
    }

    @AfterClass
    public static void tearDownClass() throws Exception {
    }
    
    @Before
    public void setUp() {
        patternData = new PatternData();
    }
    
    @After
    public void tearDown() {
        patternData = null;
    }

    /**
     * Test of isPatternSet method, of class PatternData.
     */
    @Test
    public void testIsPatternSet() {
        assertFalse(patternData.isPatternSet(1));
        patternData.setPattern(1, true);
        assertTrue(patternData.isPatternSet(1));
        patternData.setPattern(1, false);
        assertFalse(patternData.isPatternSet(1));
        assertFalse(patternData.isPatternSet(-1));
        assertFalse(patternData.isPatternSet(300));
    }

    /**
     * Test of setPattern method, of class PatternData.
     */
    @Test
    public void testSetPattern() {
        assertFalse(patternData.isPatternSet(1));
        patternData.setPattern(1, true);
        assertTrue(patternData.isPatternSet(1));
        assertEquals(16, patternData.getSize());
        patternData.setPattern(33, false);
        assertEquals(16, patternData.getSize());
        patternData.setPattern(33, true);
        assertTrue(patternData.isPatternSet(33));
        assertEquals(48, patternData.getSize());
    }

    /**
     * Test of calculateMaxSelected method, of class PatternData.
     */
    @Test
    public void testCalculateMaxSelected() {
        assertEquals(-1, patternData.getMaxSelected());
        patternData.setPattern(2, true);
        assertEquals(2, patternData.getMaxSelected());
        patternData.setPattern(4, true);
        assertEquals(4, patternData.getMaxSelected());
        patternData.setPattern(33, true);
        assertEquals(33, patternData.getMaxSelected());
        assertEquals(48, patternData.getSize());
        patternData.setPattern(33, false);
        assertEquals(4, patternData.getMaxSelected());
        
    }

    /**
     * Test of resizePatterns method, of class PatternData.
     */
    @Test
    public void testResizePatterns() {
        assertEquals(16, patternData.getSize());
        patternData.resizePatterns(35);
        assertEquals(48, patternData.getSize());
        patternData.resizePatterns(7);
        assertEquals(16, patternData.getSize());
    }
    
    @Test
    public void testSaveAsXML() {
        Element data = patternData.saveAsXML();
        assertEquals("0000000000000000", data.getTextString());
        
        patternData.setPattern(0, true);
        patternData.setPattern(4, true);
        patternData.setPattern(15, true);
        data = patternData.saveAsXML();
        assertEquals("1000100000000001", data.getTextString());
        
        patternData.setPattern(16, true);
        assertEquals(32, patternData.getSize());
        patternData.setPattern(16, false);
        assertEquals(32, patternData.getSize());
        data = patternData.saveAsXML();
        assertEquals("1000100000000001", data.getTextString());
        assertEquals(16, patternData.getSize());
    }
    
    @Test
    public void testLoadFromXML() {
        patternData.setPattern(0, true);
        patternData.setPattern(4, true);
        patternData.setPattern(15, true);
        Element data = patternData.saveAsXML();
        assertEquals("1000100000000001", data.getTextString());
        
        PatternData patternData2 = PatternData.loadFromXML(data);
        Element data2 = patternData2.saveAsXML();
        assertEquals(data.getTextString(), data2.getTextString());
        assertEquals(patternData.patterns.length, patternData2.patterns.length);
        for(int i = 0; i < patternData.patterns.length; i++) {
            assertEquals(patternData.patterns[i], patternData2.patterns[i]);
        }
        
        patternData.setPattern(33, true);
        data = patternData.saveAsXML();
        patternData2 = PatternData.loadFromXML(data);
        
        assertEquals(48, patternData2.getSize());
    }
}
