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

import org.junit.Test;
import static org.junit.Assert.*;

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

}
