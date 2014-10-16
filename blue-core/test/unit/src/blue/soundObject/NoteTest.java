/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject;

import junit.framework.TestCase;

public class NoteTest extends TestCase {
    /*
     * Test for Object clone()
     */
    public void testNoteInit() {
        Note testNote;
        try {
            testNote = Note.createNote("i1 [4 + 23] 5 4");
            testNote.setSubjectiveDuration(12f);
            assertEquals("i1\t27.0\t12\t4", testNote.toString());

            testNote = Note.createNote("i1 2 3 4 5");
            testNote.setSubjectiveDuration(12f);
            assertEquals("i1\t2\t12\t4\t5", testNote.toString());

            testNote = Note.createNote("i1 [4 + 23] 5 4");
            testNote.setSubjectiveDuration(12f);
            assertEquals("i1\t27.0\t12\t4", testNote.toString());

            testNote = Note.createNote("i\"test\" [4 + 23] 5 4");
            testNote.setSubjectiveDuration(12f);
            assertEquals("i\"test\"\t27.0\t12\t4", testNote.toString());

        } catch (NoteParseException e) {
            // TODO Auto-generated catch block
            e.printStackTrace();
        }
    }
}
