package blue.soundObject;

import blue.CompileData;
import blue.time.TimeContext;
import blue.time.TimeDuration;
import blue.time.TimePosition;
import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class SoundTest {

    @Test
    void testGenerateForCSDConvertsTimeUnitsAndClipsPartialRender() throws Exception {
        TimeContext context = new TimeContext();
        Sound sound = new Sound();
        sound.setStartTime(TimePosition.bbt(2, 1, 0));
        sound.setSubjectiveDuration(TimeDuration.bbt(1, 0, 0));

        NoteList notes = sound.generateForCSD(context,
                CompileData.createEmptyCompileData(), 1.0, 3.0);

        assertEquals(1, notes.size());
        assertEquals(5.0, notes.get(0).getStartTime(), 0.0001);
        assertEquals(2.0, notes.get(0).getSubjectiveDuration(), 0.0001);
    }
}
