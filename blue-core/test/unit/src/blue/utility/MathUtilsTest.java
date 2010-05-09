package blue.utility;

import junit.framework.TestCase;

public class MathUtilsTest extends TestCase {

    public void testRemainder() {
        assertEquals(0, MathUtils.remainder(8.00, 2.0), .00001);
        assertEquals(0, MathUtils.remainder(8.00, .25), .00001);
        assertEquals(.15, MathUtils.remainder(8.15, .2), .00001);
        assertEquals(-.15, MathUtils.remainder(-8.15, .2), .00001);
    }

}
