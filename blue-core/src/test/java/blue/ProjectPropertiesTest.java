package blue;

import static org.junit.jupiter.api.Assertions.*;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProjectPropertiesTest {

    @Test
    void testDefaultSampleRate() {
        ProjectProperties props = new ProjectProperties();
        assertEquals("44100", props.getSampleRate());
    }

    @Test
    void testSetSampleRateUpdatesValue() {
        ProjectProperties props = new ProjectProperties();
        props.setSampleRate("48000");
        assertEquals("48000", props.getSampleRate());
    }

    @Test
    void testSetSampleRateFiresPropertyChangeEvent() {
        ProjectProperties props = new ProjectProperties();
        List<PropertyChangeEvent> events = new ArrayList<>();
        props.addPropertyChangeListener(events::add);

        props.setSampleRate("96000");

        assertEquals(1, events.size());
        PropertyChangeEvent evt = events.get(0);
        assertEquals("sampleRate", evt.getPropertyName());
        assertEquals("44100", evt.getOldValue());
        assertEquals("96000", evt.getNewValue());
    }

    @Test
    void testSetSampleRateDoesNotFireEventWhenValueUnchanged() {
        // PropertyChangeSupport suppresses events when old value equals new value
        ProjectProperties props = new ProjectProperties();
        List<PropertyChangeEvent> events = new ArrayList<>();
        props.addPropertyChangeListener(events::add);

        props.setSampleRate("44100"); // same as default

        assertEquals(0, events.size());
    }

    @Test
    void testRemovePropertyChangeListenerStopsEvents() {
        ProjectProperties props = new ProjectProperties();
        List<PropertyChangeEvent> events = new ArrayList<>();
        PropertyChangeListener listener = events::add;

        props.addPropertyChangeListener(listener);
        props.setSampleRate("48000");
        assertEquals(1, events.size());

        props.removePropertyChangeListener(listener);
        props.setSampleRate("96000");
        assertEquals(1, events.size()); // no new event
    }

    @Test
    void testCopyConstructorCopiesSampleRate() {
        ProjectProperties original = new ProjectProperties();
        original.setSampleRate("88200");

        ProjectProperties copy = new ProjectProperties(original);
        assertEquals("88200", copy.getSampleRate());
    }

    @Test
    void testCopyConstructorListenersAreIndependent() {
        ProjectProperties original = new ProjectProperties();
        original.setSampleRate("48000");

        ProjectProperties copy = new ProjectProperties(original);

        List<PropertyChangeEvent> originalEvents = new ArrayList<>();
        List<PropertyChangeEvent> copyEvents = new ArrayList<>();
        original.addPropertyChangeListener(originalEvents::add);
        copy.addPropertyChangeListener(copyEvents::add);

        original.setSampleRate("96000");
        assertEquals(1, originalEvents.size());
        assertEquals(0, copyEvents.size()); // copy is independent

        copy.setSampleRate("44100");
        assertEquals(1, originalEvents.size()); // original unaffected
        assertEquals(1, copyEvents.size());
    }
}
