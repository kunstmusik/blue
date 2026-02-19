package blue.components.lines;

import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class LinePointTest {

    @Test
    void testEqualsAndHashCodeForMatchingCoordinates() {
        LinePoint first = new LinePoint(1.25, 3.5);
        LinePoint second = new LinePoint(1.25, 3.5);
        LinePoint different = new LinePoint(1.25, 3.6);

        assertEquals(first, second);
        assertEquals(first.hashCode(), second.hashCode());
        assertFalse(first.equals(different));
    }

    @Test
    void testSignedZeroCoordinatesAreEqualAndShareHashCode() {
        LinePoint first = new LinePoint(0.0, -0.0);
        LinePoint second = new LinePoint(-0.0, 0.0);

        assertEquals(first, second);
        assertEquals(first.hashCode(), second.hashCode());
    }

    @Test
    void testNaNCoordinateIsReflexiveButDifferentInstancesRemainUnequal() {
        LinePoint pointWithNaN = new LinePoint(Double.NaN, 1.0);
        LinePoint anotherPointWithNaN = new LinePoint(Double.NaN, 1.0);

        assertEquals(pointWithNaN, pointWithNaN);
        assertFalse(pointWithNaN.equals(anotherPointWithNaN));
    }
}
