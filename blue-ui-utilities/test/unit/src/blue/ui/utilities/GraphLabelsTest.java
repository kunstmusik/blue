/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
package blue.ui.utilities;

import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class GraphLabelsTest {
    
    public GraphLabelsTest() {

    }



    /**
     * Test of niceNum method, of class GraphLabels.
     */
    @Test
    public void testNiceNum() {
        assertEquals(1.0, GraphLabels.niceNum(1.01, true), 0.0);
        assertEquals(1.0, GraphLabels.niceNum(1.02, true), 0.0);
        assertEquals(1.0, GraphLabels.niceNum(1.2, true), 0.0);
        assertEquals(2.0, GraphLabels.niceNum(1.9, true), 0.0);
        assertEquals(200.0, GraphLabels.niceNum(293, true), 0.0);
        assertEquals(500.0, GraphLabels.niceNum(403, true), 0.0);
    }
    
}
