package blue.midi;

import javax.sound.midi.MidiDevice;
import org.junit.Test;
import static org.junit.Assert.*;

public class BlueMidiDeviceTest {

    @Test
    public void testEqualsAndHashCodeForMatchingDeviceMetadata() {
        BlueMidiDevice first = new BlueMidiDevice(new TestInfo("name", "vendor",
                "description", "1.0"));
        BlueMidiDevice second = new BlueMidiDevice(new TestInfo("name", "vendor",
                "description", "1.0"));

        first.setEnabled(true);
        second.setEnabled(false);

        assertEquals(first, second);
        assertEquals(first.hashCode(), second.hashCode());
    }

    @Test
    public void testNotEqualsForDifferentDeviceMetadata() {
        BlueMidiDevice first = new BlueMidiDevice(new TestInfo("name", "vendor",
                "description", "1.0"));
        BlueMidiDevice second = new BlueMidiDevice(new TestInfo("name", "vendor",
                "different", "1.0"));

        assertFalse(first.equals(second));
    }

    @Test
    public void testNullDeviceInfoHandling() {
        BlueMidiDevice first = new BlueMidiDevice(null);
        BlueMidiDevice second = new BlueMidiDevice(null);
        BlueMidiDevice withInfo = new BlueMidiDevice(new TestInfo("name",
                "vendor", "description", "1.0"));

        assertEquals(first, second);
        assertEquals(first.hashCode(), second.hashCode());
        assertFalse(first.equals(withInfo));
        assertEquals("Error", first.toString());
    }

    private static final class TestInfo extends MidiDevice.Info {

        private TestInfo(String name, String vendor, String description,
                String version) {
            super(name, vendor, description, version);
        }
    }
}
