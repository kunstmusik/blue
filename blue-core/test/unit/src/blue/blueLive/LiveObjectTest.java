/*
 * LiveObjectTest.java
 * JUnit based test
 *
 * Created on October 18, 2006, 7:08 PM
 */

package blue.blueLive;

import blue.soundObject.GenericScore;
import electric.xml.Element;
import junit.framework.TestCase;

/**
 * 
 * @author steven
 */
public class LiveObjectTest extends TestCase {

    public LiveObjectTest(String testName) {
        super(testName);
    }

    /**
     * Test of getSoundObject method, of class blue.blueLive.LiveObject.
     */
    public void testSerialization() {
        LiveObject liveObj = new LiveObject();

        liveObj.setSObj(new GenericScore());

        Element elem1 = liveObj.saveAsXML(null);
        Element elem2;
        try {
            elem2 = liveObj.loadFromXML(elem1, null).saveAsXML(null);
            assertEquals(elem1.toString(), elem2.toString());
        } catch (Exception ex) {
            ex.printStackTrace();
            fail("Did not load from xml");
        }

    }

}
