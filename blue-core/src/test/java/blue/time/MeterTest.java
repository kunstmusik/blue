/*
 * Copyright (C) 2023 stevenyi
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

import static org.junit.Assert.*;
import org.junit.Test;

/**
 *
 * @author stevenyi
 */
public class MeterTest {

    public MeterTest() {
    }

    /**
     * Test of getMeasureBeatDuration method, of class Meter.
     */
    @Test
    public void testGetMeasureBeatDuration() {
        assertEquals(4.0, new Meter(4, 4).getMeasureBeatDuration(), 0.001);
        assertEquals(1.0, new Meter(4, 16).getMeasureBeatDuration(), 0.001);

        assertEquals(4.0, new Meter(2, 2).getMeasureBeatDuration(), 0.001);
        assertEquals(16.0, new Meter(4, 1).getMeasureBeatDuration(), 0.001);
        
        assertEquals(3.5, new Meter(7, 8).getMeasureBeatDuration(), 0.001);
    }
    
    @Test
    public void testEquals() {
        Meter m1 = new Meter(4, 4);
        Meter m2 = new Meter(4, 4);
        Meter m3 = new Meter(3, 4);
        Meter m4 = new Meter(4, 8);
        
        // Reflexive
        assertEquals(m1, m1);
        
        // Symmetric
        assertEquals(m1, m2);
        assertEquals(m2, m1);
        
        // Different numBeats
        assertNotEquals(m1, m3);
        
        // Different beatLength
        assertNotEquals(m1, m4);
        
        // Null
        assertNotEquals(m1, null);
        
        // Different type
        assertNotEquals(m1, "4/4");
    }
    
    @Test
    public void testHashCode() {
        Meter m1 = new Meter(4, 4);
        Meter m2 = new Meter(4, 4);
        Meter m3 = new Meter(3, 4);
        
        // Equal objects must have equal hash codes
        assertEquals(m1.hashCode(), m2.hashCode());
        
        // Unequal objects should (usually) have different hash codes
        assertNotEquals(m1.hashCode(), m3.hashCode());
    }
    
    @Test
    public void testToString() {
        assertEquals("4/4", new Meter(4, 4).toString());
        assertEquals("3/4", new Meter(3, 4).toString());
        assertEquals("6/8", new Meter(6, 8).toString());
        assertEquals("7/8", new Meter(7, 8).toString());
        assertEquals("5/4", new Meter(5, 4).toString());
    }

}
