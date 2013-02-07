/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
package blue.settings;

import java.util.Vector;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class DriverUtilsTest {
    
    public DriverUtilsTest() {
    }

//    /**
//     * Test of getAudioOutputs method, of class DriverUtils.
//     */
//    @Test
//    public void testGetAudioOutputs() {
//        System.out.println("getAudioOutputs");
//        String csoundCommand = "";
//        String driver = "";
//        Vector expResult = null;
//        Vector result = DriverUtils.getAudioOutputs(csoundCommand, driver);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of getAudioInputs method, of class DriverUtils.
//     */
//    @Test
//    public void testGetAudioInputs() {
//        System.out.println("getAudioInputs");
//        String csoundCommand = "";
//        String driver = "";
//        Vector expResult = null;
//        Vector result = DriverUtils.getAudioInputs(csoundCommand, driver);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of getMIDIOutputs method, of class DriverUtils.
//     */
//    @Test
//    public void testGetMIDIOutputs() {
//        System.out.println("getMIDIOutputs");
//        String csoundCommand = "";
//        String driver = "";
//        Vector expResult = null;
//        Vector result = DriverUtils.getMIDIOutputs(csoundCommand, driver);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of getMIDIInputs method, of class DriverUtils.
//     */
//    @Test
//    public void testGetMIDIInputs() {
//        System.out.println("getMIDIInputs");
//        String csoundCommand = "";
//        String driver = "";
//        Vector expResult = null;
//        Vector result = DriverUtils.getMIDIInputs(csoundCommand, driver);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

    @Test
    public void testDetectJackPortsWithJackLsp() {
        Vector vals = new Vector();
        boolean retVal = DriverUtils.detectJackPortsWithJackLsp(vals, "input");
        assertTrue(retVal);
        assertEquals(1, vals.size());
        
        DriverUtils.JackCardInfo info = (DriverUtils.JackCardInfo) vals.get(0);
        assertEquals("system:playback_", info.deviceName);
        assertEquals("(2 channels)", info.description);
        
        vals.removeAllElements();
        
        retVal = DriverUtils.detectJackPortsWithJackLsp(vals, "output");
        assertTrue(retVal);
        assertEquals(1, vals.size());
        
        info = (DriverUtils.JackCardInfo) vals.get(0);
        assertEquals("system:capture_", info.deviceName);
        assertEquals("(2 channels)", info.description);
    }
}
