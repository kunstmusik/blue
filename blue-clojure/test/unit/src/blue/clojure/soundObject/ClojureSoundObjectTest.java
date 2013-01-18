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
package blue.clojure.soundObject;

import blue.CompileData;
import blue.noteProcessor.NoteProcessorChain;
import blue.soundObject.NoteList;
import electric.xml.Element;
import java.util.Map;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class ClojureSoundObjectTest {
    
    public ClojureSoundObjectTest() {
    }

    /**
     * Test of generateForCSD method, of class ClojureSoundObject.
     */
    @Test
    public void testGenerateForCSD() throws Exception {
        System.out.println("generateForCSD");
        CompileData compileData = null;
        float startTime = 0.0F;
        float endTime = 0.0F;
        ClojureSoundObject instance = new ClojureSoundObject();
        NoteList expResult = null;
        NoteList result = instance.generateForCSD(compileData, startTime,
                endTime);
        assertEquals(expResult, result);
        // TODO review the generated test code and remove the default call to fail.
        fail("The test case is a prototype.");
    }

    /**
     * Test of saveAsXML method, of class ClojureSoundObject.
     */
    @Test
    public void testSaveAsXML() {
        System.out.println("saveAsXML");
        Map<Object, String> objRefMap = null;
        ClojureSoundObject instance = new ClojureSoundObject();
        Element expResult = null;
        Element result = instance.saveAsXML(objRefMap);
        assertEquals(expResult, result);
        // TODO review the generated test code and remove the default call to fail.
        fail("The test case is a prototype.");
    }

}
