/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.blueLive;

import blue.soundObject.GenericScore;
import electric.xml.Element;
import java.util.Map;
import org.junit.*;
import static org.junit.Assert.*;

/**
 *
 * @author stevenyi
 */
public class LiveObjectBinsTest {
    
    public LiveObjectBinsTest() {
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
     * Test of loadFromXML method, of class LiveObjectBins.
     */
    @Test
    public void testLoadFromXML() throws Exception {
        Map<Object, String> objRefMap = null;
        Map<String, Object> objRefMap2 = null;
        LiveObjectBins expResult = new LiveObjectBins();
        Element node = expResult.saveAsXML(objRefMap);
        LiveObjectBins result = LiveObjectBins.loadFromXML(node, objRefMap2);
        assertEquals(node.toString(), result.saveAsXML(objRefMap).toString());
    }

    /**
     * Test of setLiveObject method, of class LiveObjectBins.
     */
    @Test
    public void testSetLiveObject() {
        System.out.println("setLiveObject");
        int column = 0;
        int row = 2;
        LiveObjectBins instance = new LiveObjectBins();
        LiveObject liveObject = new LiveObject(new GenericScore());
        instance.setLiveObject(column, row, liveObject);
        assertEquals(liveObject, instance.getLiveObject(column, row));
    }

    /**
     * Test of insertRow method, of class LiveObjectBins.
     */
    @Test
    public void testInsertRow() {
        LiveObjectBins instance = new LiveObjectBins();
        LiveObject liveObject = new LiveObject(new GenericScore());
        instance.setLiveObject(0, 2, liveObject);
        
        instance.insertRow(1);
        assertEquals(9, instance.getRowCount());
        assertEquals(liveObject, instance.getLiveObject(0, 3));
        
        instance.insertRow(20);
        assertEquals(10, instance.getRowCount());
        assertEquals(liveObject, instance.getLiveObject(0, 3));
    }

    /**
     * Test of insertColumn method, of class LiveObjectBins.
     */
    @Test
    public void testInsertColumn() {
        LiveObjectBins instance = new LiveObjectBins();
        LiveObject liveObject = new LiveObject(new GenericScore());
        instance.setLiveObject(0, 2, liveObject);
        
        instance.insertColumn(1);
        assertEquals(2, instance.getColumnCount());
        assertEquals(liveObject, instance.getLiveObject(0, 2));
        
        instance.insertColumn(-1);
        assertEquals(3, instance.getColumnCount());
        assertEquals(liveObject, instance.getLiveObject(1, 2));
    }
    
    @Test 
    public void testGetRow_Column_Index() {
        LiveObjectBins instance = new LiveObjectBins();
        LiveObject liveObject = new LiveObject(new GenericScore());
        instance.setLiveObject(0, 2, liveObject);
        
        instance.insertColumn(0);
        instance.insertRow(0);
        assertEquals(1, instance.getColumnForObject(liveObject));
        assertEquals(3, instance.getRowForObject(liveObject));
    }
    
    @Test 
    public void testRemoveRow_Column() {
        LiveObjectBins instance = new LiveObjectBins();
        LiveObject liveObject = new LiveObject(new GenericScore());
        instance.setLiveObject(0, 2, liveObject);
        
        instance.insertColumn(0);
        instance.insertRow(0);
        assertEquals(1, instance.getColumnForObject(liveObject));
        assertEquals(3, instance.getRowForObject(liveObject));
        
        instance.removeRow(0);
        assertEquals(1, instance.getColumnForObject(liveObject));
        assertEquals(2, instance.getRowForObject(liveObject));
        instance.removeColumn(-1);
        assertEquals(1, instance.getColumnForObject(liveObject));
        assertEquals(2, instance.getRowForObject(liveObject));
                
        instance.removeColumn(0);
        assertEquals(0, instance.getColumnForObject(liveObject));
        assertEquals(2, instance.getRowForObject(liveObject));
        
        instance.removeColumn(0);

        assertEquals(1, instance.getColumnCount());
        assertEquals(8, instance.getRowCount());
    }
}
