package blue;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import org.junit.jupiter.api.Test;

class BlueDataTest {

    @Test
    void testTimeContextReflectsProjectPropertiesSampleRate() {
        BlueData data = new BlueData();
        data.getProjectProperties().setSampleRate("48000");

        assertEquals(48000L, data.getScore().getTimeContext().getSampleRate());
    }

    @Test
    void testSetProjectPropertiesWiresTimeContext() {
        BlueData data = new BlueData();
        ProjectProperties properties = new ProjectProperties();
        properties.setSampleRate("96000");

        data.setProjectProperties(properties);

        assertSame(properties, data.getProjectProperties());
        assertEquals(96000L, data.getScore().getTimeContext().getSampleRate());
    }

    @Test
    void testTimeContextDefaultSampleRate() {
        BlueData data = new BlueData();
        assertEquals(44100L, data.getScore().getTimeContext().getSampleRate());
    }

    @Test
    void testOldProjectPropertiesNoLongerDrivesTimeContextAfterReplacement() {
        BlueData data = new BlueData();
        ProjectProperties oldProps = data.getProjectProperties();

        ProjectProperties newProps = new ProjectProperties();
        newProps.setSampleRate("48000");
        data.setProjectProperties(newProps);

        // Changing the old (detached) ProjectProperties must not affect TimeContext
        oldProps.setSampleRate("11025");
        assertEquals(48000L, data.getScore().getTimeContext().getSampleRate());
    }
}
