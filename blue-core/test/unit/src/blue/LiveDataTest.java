/*
 * LiveDataTest.java
 * JUnit based test
 *
 * Created on October 18, 2006, 7:16 PM
 */

package blue;

import blue.blueLive.LiveObject;
import blue.soundObject.GenericScore;
import electric.xml.Element;
import junit.framework.TestCase;

/**
 * 
 * @author steven
 */
public class LiveDataTest extends TestCase {

    public LiveDataTest(String testName) {
        super(testName);
    }

    public void testSerialization() {
        LiveData liveData = new LiveData();

        liveData.getLiveSoundObjects().add(new LiveObject(new GenericScore()));

        Element elem1 = liveData.saveAsXML(null);
        Element elem2;
        try {
            elem2 = LiveData.loadFromXML(elem1, null).saveAsXML(null);
            assertEquals(elem1.toString(), elem2.toString());
        } catch (Exception ex) {
            ex.printStackTrace();
            fail("Did not load from xml");
        }

    }
}
