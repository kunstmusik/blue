/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
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
package blue.soundObject.pianoRoll;

import java.util.ArrayList;
import java.util.Collections;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.AfterAll;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

/**
 *
 * @author stevenyi
 */
class PianoNoteTest {
    
    public PianoNoteTest() {
    }
    
    @BeforeAll
    public static void setUpClass() {
    }
    
    @AfterAll
    public static void tearDownClass() {
    }
    
    @BeforeEach
    void setUp() {
    }
    
    @AfterEach
    void tearDown() {
    }

    
    /**
     * Test of compareTo method, of class PianoNote.
     */
    @Test
    void testCompareTo() {
        
        ArrayList<PianoNote> list = new ArrayList<>();
        
        PianoNote note0 = new PianoNote();
        note0.octave = 6;
        note0.scaleDegree = 5;
        
        PianoNote note1 = new PianoNote();
        note1.octave = 7;
        note1.scaleDegree = 4;
        
        PianoNote note2 = new PianoNote();
        note2.octave = 9;
        note2.scaleDegree = 3;
        
        list.add(note0);
        list.add(note1);
        list.add(note2);
        
        Collections.sort(list);
        
        assertEquals(note0, list.get(0));
        assertEquals(note1, list.get(1));
        assertEquals(note2, list.get(2));

        //
        
        list.clear();
        
        //
        
        list.add(note2);
        list.add(note0);
        list.add(note1);
        
        assertEquals(note2, list.get(0));
        assertEquals(note0, list.get(1));
        assertEquals(note1, list.get(2));
        
        Collections.sort(list);
        
        assertEquals(note0, list.get(0));
        assertEquals(note1, list.get(1));
        assertEquals(note2, list.get(2));

    }
}
