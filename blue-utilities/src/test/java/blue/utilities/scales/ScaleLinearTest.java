/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.utilities.scales;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

/**
 *
 * @author syyigmmbp
 */
public class ScaleLinearTest {
    
    public ScaleLinearTest() {
    }

    
    /**
     * Test of calc method, of class ScaleLinear.
     */
    @org.junit.jupiter.api.Test
    public void testCalc() {
        ScaleLinear instance = new ScaleLinear(0.0, 10.0, 1.0, 2.0);
        assertEquals(instance.calc(0.0), 1.0);
        assertEquals(instance.calc(-1.0), 1.0);
        assertEquals(instance.calc(10.0), 2.0);
        assertEquals(instance.calc(20.0), 2.0);
        assertEquals(instance.calc(5.0), 1.5);
    }
    
}
