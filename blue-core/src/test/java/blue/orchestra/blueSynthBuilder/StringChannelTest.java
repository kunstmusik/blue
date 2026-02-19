package blue.orchestra.blueSynthBuilder;

import java.beans.PropertyChangeEvent;
import org.junit.Test;
import static org.junit.Assert.*;

public class StringChannelTest {

    @Test
    public void testSetValueMarksDirtyOnlyWhenValueChanges() {
        StringChannel channel = new StringChannel();
        channel.setDirty(false);

        channel.setValue("alpha");
        assertTrue(channel.isDirty());
        assertEquals("alpha", channel.getValue());
        assertFalse(channel.isDirty());

        channel.setValue("alpha");
        assertFalse(channel.isDirty());

        channel.setValue(null);
        assertFalse(channel.isDirty());
        assertEquals("alpha", channel.getValue());
    }

    @Test
    public void testPropertyChangeOnlyRespondsToStringChannelValueProperty() {
        StringChannel channel = new StringChannel();
        channel.setValue("initial");
        channel.getValue();

        channel.propertyChange(new PropertyChangeEvent(this, "otherProperty",
                "initial", "ignored"));
        assertEquals("initial", channel.getValue());

        channel.propertyChange(new PropertyChangeEvent(this, "stringChannelValue",
                "initial", "updated"));
        assertTrue(channel.isDirty());
        assertEquals("updated", channel.getValue());
    }

    @Test
    public void testEqualsAndHashCodeIncludeDirtyAndFieldValues() {
        StringChannel first = createChannel("chan", "value", false);
        StringChannel second = createChannel("chan", "value", false);
        StringChannel differentDirty = createChannel("chan", "value", true);
        StringChannel differentValue = createChannel("chan", "other", false);
        StringChannel differentName = createChannel("other", "value", false);

        assertEquals(first, second);
        assertEquals(first.hashCode(), second.hashCode());
        assertFalse(first.equals(differentDirty));
        assertFalse(first.equals(differentValue));
        assertFalse(first.equals(differentName));
    }

    @Test
    public void testCopyConstructorPreservesState() {
        StringChannel original = createChannel("copyTarget", "copyValue", false);
        StringChannel copy = new StringChannel(original);

        assertEquals(original, copy);
        assertEquals(original.hashCode(), copy.hashCode());
    }

    private static StringChannel createChannel(String channelName,
            String value, boolean dirty) {
        StringChannel channel = new StringChannel();
        channel.setChannelName(channelName);
        channel.setValue(value);
        if (!dirty) {
            channel.getValue();
        } else {
            channel.setDirty(true);
        }
        return channel;
    }
}
