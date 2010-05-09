/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */

package blue.soundObject.jmask;

import junit.framework.TestCase;

/**
 *
 * @author syi
 */
public class QuantizerTest extends TestCase {
    
    public void testGetValue() {
        Quantizer quantizer = new Quantizer();
        quantizer.setEnabled(true);
        quantizer.setGridSize(30.0);
        quantizer.setStrength(1.0);
        quantizer.setOffset(0.0);
                
        assertEquals(30.0, quantizer.getValue(0, 35), 0.0001);
        assertEquals(60.0, quantizer.getValue(0, 50), 0.0001);
        
        quantizer.setOffset(5.0);
        
        assertEquals(65.0, quantizer.getValue(0, 50), 0.0001);
    }
    
}
