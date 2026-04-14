package blue.soundObject;

import blue.time.TimeContext;
import blue.time.TimeDuration;
import java.io.File;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import org.junit.jupiter.api.Test;

class ObjectBuilderTest {

    @Test
    void testCreateScoreScriptInitValuesUsesNumericBlueDuration() {
        TimeContext context = new TimeContext();
        ObjectBuilder objectBuilder = new ObjectBuilder();
        objectBuilder.setSubjectiveDuration(TimeDuration.bbt(1, 0, 0));

        Map<String, Object> initValues = objectBuilder.createScoreScriptInitValues(
                context, new File("."));

        assertInstanceOf(Double.class, initValues.get("blueDuration"));
        assertEquals(4.0, (Double) initValues.get("blueDuration"), 0.0001);
    }
}
