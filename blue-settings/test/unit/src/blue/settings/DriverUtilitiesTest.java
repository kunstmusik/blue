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

import blue.services.render.DeviceInfo;
import java.util.ArrayList;
import java.util.List;
import org.junit.Test;
import static org.junit.Assert.*;
import org.junit.Test;

/**
 *
 * @author stevenyi
 */
public class DriverUtilitiesTest {
    
    private static String TEST_JACK_LSP_OUTPUT = "system:capture_1\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:capture_2\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:capture_3\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:capture_4\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:capture_5\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:capture_6\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:capture_7\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:capture_8\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:capture_9\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:capture_10\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:capture_11\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:capture_12\n"
            + "    properties: output,can-monitor,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:playback_1\n"
            + "    properties: input,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:playback_2\n"
            + "    properties: input,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:playback_3\n"
            + "    properties: input,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:playback_4\n"
            + "    properties: input,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:playback_5\n"
            + "    properties: input,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:playback_6\n"
            + "    properties: input,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:playback_7\n"
            + "    properties: input,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:playback_8\n"
            + "    properties: input,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:playback_9\n"
            + "    properties: input,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:playback_10\n"
            + "    properties: input,physical,terminal,\n"
            + "    32 bit float mono audio\n"
            + "system:midi_capture_1\n"
            + "    properties: output,physical,terminal,\n"
            + "    8 bit raw midi\n"
            + "system:midi_playback_1\n"
            + "    properties: input,physical,terminal,\n"
            + "    8 bit raw midi\n"
            + "system:midi_capture_2\n"
            + "    properties: output,physical,terminal,\n"
            + "    8 bit raw midi\n"
            + "system:midi_playback_2\n"
            + "    properties: input,physical,terminal,\n"
            + "    8 bit raw midi\n"
            + "a2j:Midi Through [14] (capture): Midi Through Port-0\n"
            + "    properties: output,physical,terminal,\n"
            + "    8 bit raw midi\n"
            + "a2j:Midi Through [14] (playback): Midi Through Port-0\n"
            + "    properties: input,physical,terminal,\n"
            + "    8 bit raw midi\n"
            + "a2j:M Audio Audiophile 24/96 [20] (capture): M Audio Audiophile 24/96 MIDI\n"
            + "    properties: output,physical,terminal,\n"
            + "    8 bit raw midi\n"
            + "a2j:M Audio Audiophile 24/96 [20] (playback): M Audio Audiophile 24/96 MIDI\n"
            + "    properties: input,physical,terminal,\n"
            + "    8 bit raw midi";
    
    public DriverUtilitiesTest() {
    }

    @Test
    public void testParseJackLspOutput() {
        List<DeviceInfo> v = new ArrayList<>();
        DriverUtilities.parseJackLspOutput(TEST_JACK_LSP_OUTPUT,
                "audio", "input", "adc:", v);
        
        assertEquals(1, v.size());
        DeviceInfo info = v.get(0);
        assertEquals("adc:system:playback_", info.getDeviceId());
        assertEquals("system:playback_ (10 channels)", info.toString());
        
        
        v.clear();
        DriverUtilities.parseJackLspOutput(TEST_JACK_LSP_OUTPUT,
                "audio", "output", "dac:", v);
        
        assertEquals(1, v.size());
        info = v.get(0);
        assertEquals("dac:system:capture_", info.getDeviceId());
        assertEquals("system:capture_ (12 channels)", info.toString());
    }

//    @Test
//    public void testDetectJackPortsWithJackLsp() {
//        Vector vals = new Vector();
//        boolean retVal = DriverUtils.detectJackPortsWithJackLsp(vals, "input");
//        assertTrue(retVal);
//        assertEquals(1, vals.size());
//        
//        DriverUtils.JackCardInfo info = (DriverUtils.JackCardInfo) vals.get(0);
//        assertEquals("system:playback_", info.deviceName);
//        assertEquals("(2 channels)", info.description);
//        
//        vals.removeAllElements();
//        
//        retVal = DriverUtils.detectJackPortsWithJackLsp(vals, "output");
//        assertTrue(retVal);
//        assertEquals(1, vals.size());
//        
//        info = (DriverUtils.JackCardInfo) vals.get(0);
//        assertEquals("system:capture_", info.deviceName);
//        assertEquals("(2 channels)", info.description);
//    }
}
