/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

import blue.soundObject.NoteParseException;
import junit.framework.TestCase;
import blue.soundObject.NoteList;
import org.openide.util.Exceptions;

public class ScoreUtilitiesTest extends TestCase {

    /*
     * Test method for 'blue.utility.ScoreUtilities.getNotes(String)'
     */
    public void testGetNotes() {
        StringBuffer testScore = new StringBuffer();

        testScore.append("/*\n" + "idur    =       p3\n"
                + "iamp    =       p4\n" + "ifreq   =       p5\n" + "*/\n\n");

        testScore.append("i1 0 2 3 4 5 ;garbage\n");
        testScore.append("i1 + 2 3 4 5\n");

        NoteList nl = null;

        // System.out.println(testScore.toString());

        try {
            nl = ScoreUtilities.getNotes(testScore.toString());
        } catch (Exception e) {
            e.printStackTrace();
        }

        assertNotNull(nl);
    }

    public void testMultiLineNotes() {
        String testScore = "i1 0 2 3 4 5\n6 7 8 9\n8.8 8\n";
        testScore += "i1 2 3 4 5\n";
        testScore += "i1 2 3 4 5\n";
        testScore += "\"test\" 1 2 3 4 5\n";

        NoteList nl = null;

        try {
            nl = ScoreUtilities.getNotes(testScore);
        } catch (NoteParseException ex) {
            Exceptions.printStackTrace(ex);
        }

        assertNotNull(nl);
        assertEquals(3, nl.size());
        assertEquals(12, nl.getNote(0).getPCount());
        assertEquals(12, nl.getNote(2).getPCount());
        assertEquals("\"test\"", nl.getNote(2).getPField(6));

//        System.out.println(nl.toString());
    }

    public void testScoreCarry() {


        String testScore = "i1 0 2 3 4 5\n" +
            "i1.1 0 .\n" +
            "i1 0 .";
        
        NoteList nl = null;

        try {
            nl = ScoreUtilities.getNotes(testScore);
        } catch (NoteParseException ex) {
            Exceptions.printStackTrace(ex);
        }

        assertNotNull(nl);
        assertEquals(3, nl.size());
        assertEquals(6, nl.getNote(1).getPCount());
        assertEquals(6, nl.getNote(2).getPCount());

    }
}
