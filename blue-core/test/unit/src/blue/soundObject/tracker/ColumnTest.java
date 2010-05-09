/*
 * ColumnTest.java
 * JUnit based test
 *
 * Created on October 3, 2006, 11:14 AM
 */

package blue.soundObject.tracker;

import junit.framework.TestCase;

/**
 * 
 * @author steven
 */
public class ColumnTest extends TestCase {

    public ColumnTest(String testName) {
        super(testName);
    }

    /**
     * Test of getDefaultValue method, of class blue.soundObject.tracker.Column.
     */
    // public void testGetDefaultValue() {
    // System.out.println("getDefaultValue");
    //
    // Column instance = new Column();
    //
    // String expResult = "";
    // String result = instance.getDefaultValue();
    // assertEquals(expResult, result);
    //
    // // TODO review the generated test code and remove the default call to
    // fail.
    // fail("The test case is a prototype.");
    // }
    /**
     * Test of getIncrementValue method, of class
     * blue.soundObject.tracker.Column.
     */
    public void testGetIncrementValue() {

        Column col = new Column();
        String result;

        col.setType(Column.TYPE_BLUE_PCH);
        result = col.getIncrementValue("8.1");
        assertEquals("8.2", result);

        col.setType(Column.TYPE_PCH);
        result = col.getIncrementValue("8.09");
        assertEquals("8.10", result);

        col.setType(Column.TYPE_MIDI);
        result = col.getIncrementValue("72");
        assertEquals("73", result);

        col.setType(Column.TYPE_NUM);

        col.setRestrictedToInteger(false);
        col.setUsingRange(false);
        result = col.getIncrementValue("80");
        assertEquals(Double.parseDouble("81"), Double.parseDouble(result),
                0.00001);

        col.setUsingRange(true);
        col.setRangeMax(80.5);
        result = col.getIncrementValue("80");
        assertEquals(Double.parseDouble("80.5"), Double.parseDouble(result),
                0.00001);

        col.setRestrictedToInteger(true);
        col.setUsingRange(false);
        result = col.getIncrementValue("80");
        assertEquals(Integer.parseInt("81"), Integer.parseInt(result));

        col.setUsingRange(true);
        col.setRangeMax(81);
        result = col.getIncrementValue("80");
        assertEquals(81, Integer.parseInt(result));

        col.setType(Column.TYPE_STR);
        result = col.getIncrementValue("8.1");
        assertNull(result);

    }

    /**
     * Test of getDecrementValue method, of class
     * blue.soundObject.tracker.Column.
     */
    public void testGetDecrementValue() {

        Column col = new Column();
        String result;

        col.setType(Column.TYPE_BLUE_PCH);
        result = col.getDecrementValue("8.1");
        assertEquals("8.0", result);

        col.setType(Column.TYPE_PCH);
        result = col.getDecrementValue("8.00");
        assertEquals("7.11", result);

        col.setType(Column.TYPE_MIDI);
        result = col.getDecrementValue("72");
        assertEquals("71", result);

        col.setType(Column.TYPE_NUM);

        col.setRestrictedToInteger(false);
        col.setUsingRange(false);
        result = col.getDecrementValue("81");
        assertEquals(80.0, Double.parseDouble(result), 0.00001);

        col.setUsingRange(true);
        col.setRangeMin(79.5);
        result = col.getDecrementValue("80");
        assertEquals(Double.parseDouble("79.5"), Double.parseDouble(result),
                0.00001);

        col.setRestrictedToInteger(true);
        col.setUsingRange(false);
        result = col.getDecrementValue("80");
        assertEquals(Integer.parseInt("79"), Integer.parseInt(result));

        col.setUsingRange(true);
        col.setRangeMin(79);
        result = col.getDecrementValue("80");
        assertEquals(79, Integer.parseInt(result));

        col.setType(Column.TYPE_STR);
        result = col.getDecrementValue("8.1");
        assertNull(result);
    }

}
