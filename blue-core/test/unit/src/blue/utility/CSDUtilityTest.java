/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
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

package blue.utility;

import blue.BlueData;
import static org.junit.Assert.assertEquals;
import org.junit.*;

/**
 *
 * @author syi
 */
public class CSDUtilityTest {

    public CSDUtilityTest() {
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

    /**
     * Test of convertOrcScoToBlue method, of class CSDUtility.
     */
//    @Test
//    public void testConvertOrcScoToBlue() {
//        System.out.println("convertOrcScoToBlue");
//        File orcFile = null;
//        File scoFile = null;
//        int importMode = 0;
//        BlueData expResult = null;
//        BlueData result = CSDUtility.convertOrcScoToBlue(orcFile, scoFile,
//                importMode);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

    /**
     * Test of convertCSDtoBlue method, of class CSDUtility.
     */
//    @Test
//    public void testConvertCSDtoBlue() {
//        System.out.println("convertCSDtoBlue");
//        File csdFile = null;
//        int importMode = 0;
//        BlueData expResult = null;
//        BlueData result = CSDUtility.convertCSDtoBlue(csdFile, importMode);
//        assertEquals(expResult, result);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

    /**
     * Test of parseCsScore method, of class CSDUtility.
     */
    @Test
    public void testParseCsScore() {
        BlueData data = new BlueData();
        String score = "f1 0 10 1\n f2 0 10 .5 .3 .1\ni1 0 2 3 4 5\ni2 0 2 3 4 5";
        int importMode = CSDUtility.IMPORT_GLOBAL;
        CSDUtility.parseCsScore(data, score, importMode);

        assertEquals("f1 0 10 1\n f2 0 10 .5 .3 .1\n", data.getTableSet().getTables());
    }

    @Test
    public void testParseCsScore_multiLine() {
        BlueData data = new BlueData();
        String score1 = "i1 0 2 3 4 5\n6 7 8 9\n8.8 8\n";
        score1 += "i1 2 3 4 5\n";
        score1 += "i1 2 3 4 5\n";
        score1 += "\"test\" 1 2 3 4 5\n";
        
        String score2 = "f1 0 3 4\n   5 6 7\n";

        String score = score1 + score2;

        int importMode = CSDUtility.IMPORT_GLOBAL;
        CSDUtility.parseCsScore(data, score, importMode);

        assertEquals(score1, data.getGlobalOrcSco().getGlobalSco());
        assertEquals(score2, data.getTableSet().getTables());

    }



    /**
     * Test of main method, of class CSDUtility.
     */
//    @Test
//    public void testMain() {
//        System.out.println("main");
//        String[] args = null;
//        CSDUtility.main(args);
//        // TODO review the generated test code and remove the default call to fail.
//        fail("The test case is a prototype.");
//    }

}