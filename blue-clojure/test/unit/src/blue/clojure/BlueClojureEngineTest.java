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
package blue.clojure;

import java.io.File;
import java.util.HashMap;
import javax.script.ScriptException;
import org.junit.Test;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class BlueClojureEngineTest {
    
    public BlueClojureEngineTest() {
    }

//    /**
//     * Test of setLibDir method, of class BlueClojureEngine.
//     */
//    @Test
//    public void testSetLibDir() {
//        System.out.println("setLibDir");
//        File newLibDir = null;
//        BlueClojureEngine.setLibDir(newLibDir);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

    /**
     * Test of getInstance method, of class BlueClojureEngine.
     */
    @Test
    public void testGetInstance() {
        BlueClojureEngine expResult = BlueClojureEngine.getInstance();;
        BlueClojureEngine result = BlueClojureEngine.getInstance();
        assertEquals(expResult, result);
    }

    /**
     * Test of reinitialize method, of class BlueClojureEngine.
     */
//    @Test
//    public void testReinitialize() {
//        System.out.println("reinitialize");
//        BlueClojureEngine.reinitialize();
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

    /**
     * Test of processScript method, of class BlueClojureEngine.
     */
    @Test
    public void testProcessScript() {
        System.out.println("processScript");
        String code = "(def score \"i1 0 2\")";
        HashMap<String, ? extends Object> values = null;
        String returnVariableName = "score";
        BlueClojureEngine instance = new BlueClojureEngine();
        String expResult = "i1 0 2";
        try {
            String result = instance.processScript(code, values, returnVariableName);
            assertEquals(expResult, result);
        } catch(ScriptException se) {
            fail("Script threw exception");
        }
        
    }
}
