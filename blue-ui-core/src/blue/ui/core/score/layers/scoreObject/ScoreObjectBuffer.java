package blue.ui.core.score.layers.scoreObject;

import blue.score.ScoreObject;
import blue.score.layers.LayerGroup;
import blue.ui.core.score.layers.scoreObject.ScoreObjectBuffer.ScoreObjectBufferData;
import java.util.HashMap;

/**
 *
 * @author steven
 */


public class ScoreObjectBuffer extends HashMap<ScoreObject, ScoreObjectBufferData> {

    public static class ScoreObjectBufferData {
        public LayerGroup sourceLayerGroup;
        public int layerIndex;
        public int globalLayerIndex;
    }
    
    
    
}
