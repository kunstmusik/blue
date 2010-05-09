/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.utility;

import blue.utility.midi.MidiImportUtilities;
import junit.framework.TestCase;

public class MidiUtilitiesTest extends TestCase {

    public final void testProcessNoteTemplate() {

        String expected1 = "i2 3.0 5.0 8.05 16344.651";
        String expected2 = "i2 3.0 5.0 65 16344.651";
        String expected3 = "i2 3.0 5.0 8.416666 90";
        String expected4 = "i2 3.0 5.0 440.0 90";

//        assertEquals(expected1, MidiImportUtilities.processNoteTemplate(
//                "i<INSTR_ID> <START> <DUR> <KEY_PCH> <VELOCITY_AMP>", "2",
//                3.0f, 5.0f, 65, 90));
//
//        assertEquals(expected2, MidiImportUtilities.processNoteTemplate(
//                "i<INSTR_ID> <START> <DUR> <KEY> <VELOCITY_AMP>", "2", 3.0f,
//                5.0f, 65, 90));
//
//        assertEquals(expected3, MidiImportUtilities.processNoteTemplate(
//                "i<INSTR_ID> <START> <DUR> <KEY_OCT> <VELOCITY>", "2", 3.0f,
//                5.0f, 65, 90));
//
//        assertEquals(expected4, MidiImportUtilities.processNoteTemplate(
//                "i<INSTR_ID> <START> <DUR> <KEY_CPS> <VELOCITY>", "2", 3.0f,
//                5.0f, 69, 90));
    }

    public final void testCpsmid() {
        assertEquals(261.6, MidiImportUtilities.cpsmid(60), 0.1);
        assertEquals(523.25, MidiImportUtilities.cpsmid(72), 0.1);
    }

}
