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
import blue.soundObject.NoteList;
import electric.xml.Element;
import java.util.Map;
import org.apache.commons.lang3.builder.EqualsBuilder;
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
     * Test of generateForCSD method, of class ClojureObject.
     */
    @Test
    public void testGenerateForCSD() throws Exception {
        CompileData compileData = null;
        float startTime = 0.0F;
        float endTime = 2.0F;
        ClojureObject instance = new ClojureObject();
        instance.setClojureCode("(def score \"i1 0 2 3 5\")");
        NoteList result = instance.generateForCSD(compileData, startTime,
                endTime);
        assertEquals(result.getNote(0).getPField(5), "5");
    }

    /**
     * Test of saveAsXML method, of class ClojureObject.
     */
    @Test
    public void testSaveAsXML() throws Exception {
        System.out.println("saveAsXML");
        Map<Object, String> objRefMap = null;
        ClojureObject instance = new ClojureObject();
        instance.setClojureCode("(def score \"i1 0 2 3 5\")");

        Element result = instance.saveAsXML(objRefMap);
        ClojureObject instance2 = (ClojureObject)ClojureObject.loadFromXML(result, null);
        assertTrue(EqualsBuilder.reflectionEquals(instance, instance2, null));
    }

}
