/*
 * FieldTest.java
 * JUnit based test
 *
 * Created on April 25, 2007, 1:03 PM
 */

package blue.soundObject.jmask;

import blue.soundObject.NoteList;
import junit.framework.TestCase;

/**
 * 
 * @author steven
 */
public class FieldTest extends TestCase {

    public FieldTest(String testName) {
        super(testName);
    }

    /**
     * Test of loadFromXML method, of class blue.soundObject.jmask.Field.
     */
    // public void testLoadFromXML() throws Exception {
    // System.out.println("loadFromXML");
    //        
    // Element data = null;
    //        
    // Field expResult = null;
    // Field result = Field.loadFromXML(data);
    // assertEquals(expResult, result);
    //        
    // // TODO review the generated test code and remove the default call to
    // fail.
    // fail("The test case is a prototype.");
    // }
    //
    /**
     * Test of saveAsXML method, of class blue.soundObject.jmask.Field.
     */
    // public void testSaveAsXML() {
    // System.out.println("saveAsXML");
    //        
    // Field instance = new Field();
    //        
    // Element expResult = null;
    // Element result = instance.saveAsXML();
    // assertEquals(expResult, result);
    //        
    // // TODO review the generated test code and remove the default call to
    // fail.
    // fail("The test case is a prototype.");
    // }
    /**
     * Test of generateNotes method, of class blue.soundObject.jmask.Field.
     */
    public void testGenerateNotesConstant() {
        double duration = 5.0;
        Field field = new Field();

        NoteList result = field.generateNotes(duration);

        assertEquals(5, result.size());

        Constant c = (Constant) field.getParameter(0).getGenerator();
        c.setValue(2.0);

        result = field.generateNotes(duration);

        for (int i = 0; i < result.size(); i++) {
            assertEquals("2", result.getNote(i).getPField(1));
        }

        Constant c2 = (Constant) field.getParameter(1).getGenerator();
        c2.setValue(1.5);

        result = field.generateNotes(duration);

        assertEquals(4, result.size());

    }

}
