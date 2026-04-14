package blue.soundObject;

import blue.time.TimeDuration;
import blue.time.TimePosition;
import electric.xml.Element;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

class SoundObjectUtilitiesTest {

    @Test
    void testInitBasicFromXMLLegacyBeatDurationUnitMigratesToDurationBeats() throws Exception {
        Element data = createBaseSoundObjectElement();
        Element legacyDuration = TimePosition.beats(3.5).saveAsXML();
        legacyDuration.setName("subjectiveDurationUnit");
        data.addElement(legacyDuration);

        GenericScore score = new GenericScore();
        SoundObjectUtilities.initBasicFromXML(data, score);

        assertTrue(score.getSubjectiveDuration() instanceof TimeDuration.DurationBeats);
        assertEquals(3.5,
                ((TimeDuration.DurationBeats) score.getSubjectiveDuration()).getCsoundBeats(),
                0.0001);
    }

    @Test
    void testInitBasicFromXMLLegacyNonBeatDurationUnitThrows() throws Exception {
        assertThrows(Exception.class, () -> {
            Element data = createBaseSoundObjectElement();
            Element legacyDuration = TimePosition.time(0, 0, 1, 0).saveAsXML();
            legacyDuration.setName("subjectiveDurationUnit");
            data.addElement(legacyDuration);

            GenericScore score = new GenericScore();
            SoundObjectUtilities.initBasicFromXML(data, score);
        });
    }

    private Element createBaseSoundObjectElement() {
        Element data = new Element("soundObject");
        data.addElement("startTime").setText("0.0");
        data.addElement("name").setText("test");
        return data;
    }
}
