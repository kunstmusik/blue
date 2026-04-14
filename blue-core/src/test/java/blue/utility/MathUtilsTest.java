package blue.utility;

import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class MathUtilsTest {

    @Test
    void testRemainder() {
        assertEquals(0, MathUtils.remainder(8.00, 2.0), .00001);
        assertEquals(0, MathUtils.remainder(8.00, .25), .00001);
        assertEquals(.15, MathUtils.remainder(8.15, .2), .00001);
        assertEquals(-.15, MathUtils.remainder(-8.15, .2), .00001);
    }

}
