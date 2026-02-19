package blue.ui.core.render;

import blue.time.CurveType;
import blue.time.TempoMap;
import blue.time.TempoPoint;
import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class CSDRenderTest {

    private static final class TestableCSDRender extends CSDRender {
        String getTempoScoreForTest(TempoMap tempoMap, double renderStart, double renderEnd) {
            return getTempoScore(tempoMap, renderStart, renderEnd);
        }
    }

    @Test
    void testGetTempoScoreConstantCurveUsesDuplicateTimePoints() {
        TempoMap tempoMap = new TempoMap();
        tempoMap.setEnabled(true);
        tempoMap.setTempoPoint(0, 0.0, 60.0, CurveType.CONSTANT);
        tempoMap.addTempoPoint(new TempoPoint(4.0, 120.0, CurveType.CONSTANT));

        String score = new TestableCSDRender().getTempoScoreForTest(tempoMap, 0.0, -1.0);

        assertEquals("t 0 60.0 4.0 60.0 4.0 120.0\n", score);
    }

    @Test
    void testGetTempoScoreRenderEndAtConstantBoundaryUsesPriorTempo() {
        TempoMap tempoMap = new TempoMap();
        tempoMap.setEnabled(true);
        tempoMap.setTempoPoint(0, 0.0, 60.0, CurveType.CONSTANT);
        tempoMap.addTempoPoint(new TempoPoint(4.0, 120.0, CurveType.CONSTANT));

        String score = new TestableCSDRender().getTempoScoreForTest(tempoMap, 0.0, 4.0);

        assertEquals("t 0 60.0 4.0 60.0\n", score);
    }
}
