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

import blue.soundObject.NoteList;
import blue.soundObject.NoteParseException;
import junit.framework.TestCase;

public class ScoreUtilitiesTest extends TestCase {

    /*
     * Test method for 'blue.utility.ScoreUtilities.gets(String)'
     */
    public void testGetNotes() {
        StringBuilder testScore = new StringBuilder();

        testScore.append("/*\n" + "idur    =       p3\n"
                + "iamp    =       p4\n" + "ifreq   =       p5\n" + "*/\n\n");

        testScore.append("i1 0 2 3 4 5 ;garbage\n");
        testScore.append("i1 + 2 3 4 5\n");

        for(int i = 0; i < 200000; i++) {
            testScore.append("i1 + 2 3 4 5 6 7 8 [ 1.34 + 34 ] \n");
        }
        
        NoteList nl = null;

        // System.out.println(testScore.toString());
        long startTime = System.currentTimeMillis();
        try {
            nl = ScoreUtilities.getNotes(testScore.toString());
        } catch (Exception e) {
            e.printStackTrace();
        }

        assertNotNull(nl);

        System.out.println("getNotes(): time " + (System.currentTimeMillis() - startTime));
    }

    public void testMultiLineNotes() {
        String testScore = "i 1 0 2 3 4 5\n6 7 8 9\n8.8 8\n";
        testScore += "i1 2 3 4 5 ;comment\n";
        testScore += "i1 2 3 4 5\n";
        testScore += "\"test\" 1 2 3 4 5\n";

        NoteList nl = null;

        try {
            nl = ScoreUtilities.getNotes(testScore);
        } catch (NoteParseException ex) {
            ex.printStackTrace();
        }

        assertNotNull(nl);
        assertEquals(3, nl.size());
        assertEquals(12, nl.get(0).getPCount());
        assertEquals(12, nl.get(2).getPCount());
        assertEquals("\"test\"", nl.get(2).getPField(6));

//        System.out.println(nl.toString());
    }

    public void testCommentAtEnd() {
        String testScore = "i1 0 2 3 4 5 ; comment";

        String testScore2 = "i1 0 2 3 4 5 /* comment \n test test */i";
        
        NoteList nl = null;

        try {
            nl = ScoreUtilities.getNotes(testScore);
        } catch (NoteParseException ex) {
            ex.printStackTrace();
        }

        assertNotNull(nl);
        assertEquals(1, nl.size());
        assertEquals(6, nl.getNote(0).getPCount());
        assertEquals("5", nl.getNote(0).getPField(6)); 

        try {
            nl = ScoreUtilities.getNotes(testScore2);
        } catch (NoteParseException ex) {
            ex.printStackTrace();
        }

        assertNotNull(nl);
        assertEquals(1, nl.size());
        assertEquals(6, nl.getNote(0).getPCount());
        assertEquals("5", nl.getNote(0).getPField(6)); 
    }

    public void testScoreCarry() {


        String testScore = "i1 0 2 3 4 5\n" +
            "i1.1 0 .\n" +
            "i1 0 .";
        
        NoteList nl = null;

        try {
            nl = ScoreUtilities.getNotes(testScore);
        } catch (NoteParseException ex) {
            ex.printStackTrace();
        }

        assertNotNull(nl);
        assertEquals(3, nl.size());
        assertEquals(6, nl.get(1).getPCount());
        assertEquals(6, nl.get(2).getPCount());

    }
}
