/*
 * blue - object composition environment for csound Copyright (c) 2000-2014
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.orchestra.blueSynthBuilder;

import static org.junit.Assert.assertEquals;
import org.junit.*;

/**
 *
 * @author syi
 */
public class UniqueNameManagerTest {

    public UniqueNameManagerTest() {
    }

    @BeforeClass
    public static void setUpClass() throws Exception {
    }

    @AfterClass
    public static void tearDownClass() throws Exception {
    }

    @Before
    public void setUp() {
    }

    @After
    public void tearDown() {
    }

 
//
//    /**
//     * Test of isUniquelyNamed method, of class UniqueNameManager.
//     */
//    @Test
//    public void testIsUniquelyNamed() {
//        System.out.println("isUniquelyNamed");
//        BSBObject bsbObj = null;
//        UniqueNameManager instance = new UniqueNameManager();
//        boolean expResult = false;
//        boolean result = instance.isUniquelyNamed(bsbObj);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }
//
//    /**
//     * Test of setUniqueName method, of class UniqueNameManager.
//     */
//    @Test
//    public void testSetUniqueName() {
//        System.out.println("setUniqueName");
//        BSBObject bsbObj = null;
//        UniqueNameManager instance = new UniqueNameManager();
//        instance.setUniqueName(bsbObj);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

    /**
     * Test of getPrefix method, of class UniqueNameManager.
     */
    @Test
    public void testGetPrefix() {
        UniqueNameManager instance = new UniqueNameManager();

        assertEquals("test", instance.getPrefix("test"));
        assertEquals("test", instance.getPrefix("test2"));
        assertEquals("test", instance.getPrefix("test02"));
        assertEquals("", instance.getPrefix("20234"));
        assertEquals("t", instance.getPrefix("t4"));
        assertEquals("t", instance.getPrefix("t"));
        
    }
//
//    /**
//     * Test of isUnique method, of class UniqueNameManager.
//     */
//    @Test
//    public void testIsUnique() {
//        System.out.println("isUnique");
//        String name = "";
//        UniqueNameManager instance = new UniqueNameManager();
//        boolean expResult = false;
//        boolean result = instance.isUnique(name);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

//    /**
//     * Test of saveAsXML method, of class UniqueNameManager.
//     */
//    @Test
//    public void testSaveAsXML() {
//        System.out.println("saveAsXML");
//        UniqueNameManager instance = new UniqueNameManager();
//        Element expResult = null;
//        Element result = instance.saveAsXML();
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

//    /**
//     * Test of loadFromXML method, of class UniqueNameManager.
//     */
//    @Test
//    public void testLoadFromXML() {
//        System.out.println("loadFromXML");
//        Element data = null;
//        UniqueNameManager expResult = null;
//        UniqueNameManager result = UniqueNameManager.loadFromXML(data);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

  

}