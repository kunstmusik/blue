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
package blue.automation;

import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class ParameterNameManagerTest {
    
    /**
     * Test of getUniqueParamName method, of class ParameterNameManager.
     */
    @Test
    public void testGetUniqueParamName() {
        assertEquals("gk_blue_auto1", 
                new ParameterNameManager(1).getUniqueParamName());
        assertEquals("gk_blue_auto10", 
                new ParameterNameManager(10).getUniqueParamName());
        assertEquals("gk_blue_auto100", 
                new ParameterNameManager(100).getUniqueParamName());
        assertEquals("gk_blue_auto1000", 
                new ParameterNameManager(1000).getUniqueParamName());
    }
    
}
