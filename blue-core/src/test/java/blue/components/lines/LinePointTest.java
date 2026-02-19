package blue.components.lines;

import org.junit.Test;
import static org.junit.Assert.*;

public class LinePointTest {

    @Test
    public void testEqualsAndHashCodeForMatchingCoordinates() {
        LinePoint first = new LinePoint(1.25, 3.5);
        LinePoint second = new LinePoint(1.25, 3.5);
        LinePoint different = new LinePoint(1.25, 3.6);

        assertEquals(first, second);
        assertEquals(first.hashCode(), second.hashCode());
        assertFalse(first.equals(different));
    }

    @Test
    public void testSignedZeroCoordinatesAreEqualAndShareHashCode() {
        LinePoint first = new LinePoint(0.0, -0.0);
        LinePoint second = new LinePoint(-0.0, 0.0);

        assertEquals(first, second);
        assertEquals(first.hashCode(), second.hashCode());
    }

    @Test
    public void testNaNCoordinateIsReflexiveButDifferentInstancesRemainUnequal() {
        LinePoint pointWithNaN = new LinePoint(Double.NaN, 1.0);
        LinePoint anotherPointWithNaN = new LinePoint(Double.NaN, 1.0);

        assertEquals(pointWithNaN, pointWithNaN);
        assertFalse(pointWithNaN.equals(anotherPointWithNaN));
    }
}
