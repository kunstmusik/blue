/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core.score;

import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.WeakHashMap;
import org.openide.util.Lookup;
import org.openide.util.lookup.InstanceContent;

/**
 *
 * @author stevenyi
 */
public class ScoreController {

    private static ScoreController INSTANCE = null;

    public static ScoreController getInstance() {
        if (INSTANCE == null) {
            INSTANCE = new ScoreController();
        }
        return INSTANCE;
    }

    private Lookup lookup;
    private ScoreObjectBuffer buffer = new ScoreObjectBuffer();
    private InstanceContent content;
    private Score score = null;
    WeakHashMap<Score, ScorePath> scorePaths = new WeakHashMap<>();
    private List<ScoreControllerListener> listeners = new ArrayList<>();

    private ScoreController() {
    }

    public void setLookupAndContent(Lookup lookup, InstanceContent content) {
        this.lookup = lookup;
        this.content = content;
    }

    protected Lookup getLookup() {
        return this.lookup;
    }

    public void setScore(Score score) {
        this.score = score;

        ScorePath path = scorePaths.get(score);
        if (path == null) {
            path = new ScorePath(score);
            scorePaths.put(score, path);
        }

        fireScorePathChanged();
    }

    public void editLayerGroup(LayerGroup layerGroup) {

        ScorePath path = scorePaths.get(score);
        if (path == null) {
            throw new RuntimeException(
                    "Error: LayerGroup passed in without a Score");
        }

        if (layerGroup == null) {
            if(!path.getLayerGroups().isEmpty()) {
                path.getLayerGroups().clear();
                fireScorePathChanged();
            }
            return;
        }

        List<WeakReference<LayerGroup>> layerGroups = path.getLayerGroups();

        if(!layerGroups.isEmpty() && layerGroups.get(layerGroups.size() - 1).get() == layerGroup) {
            return;
        }
        
        WeakReference<LayerGroup> foundRef = null;

        for (WeakReference<LayerGroup> ref : layerGroups) {
            if (ref.get() == layerGroup) {
                foundRef = ref;
                break;
            }
        }

        if (foundRef == null) {
           layerGroups.add(new WeakReference<>(layerGroup)); 
        } else {
           path.layerGroups = layerGroups.subList(0, layerGroups.indexOf(foundRef) + 1);
        }
        fireScorePathChanged();
        
    }

    public Score getScore() {
        return score;
    }


    public ScorePath getScorePath() {
        return scorePaths.get(score);
    }

    public void addScoreControllerListener(ScoreControllerListener listener) {
        listeners.add(listener);
    }

    public void removeScoreControllerListener(ScoreControllerListener listener) {
        listeners.remove(listener);
    }

    protected void fireScorePathChanged() {
        ScorePath path = scorePaths.get(score);

        if (path != null) {
            for (ScoreControllerListener listener : listeners) {
                listener.scorePathChanged(path);
            }
        }
    }

    public void copyScoreObjects() {
        if (lookup == null || content == null) {
            return;
        }

        Collection<? extends ScoreObject> scoreObjects = lookup.lookupAll(
                ScoreObject.class);
        Score score = lookup.lookup(Score.class);

        if (score == null) {
            throw new RuntimeException(
                    "Score object not set in ScoreController: internal error");
        }

        if (scoreObjects.isEmpty()) {
            return;
        }

        buffer.clear();
        List<Layer> layers = score.getAllLayers();

        int layerMin = Integer.MAX_VALUE;
        List<Integer> indexes = new ArrayList<>();

        for (ScoreObject scoreObject : scoreObjects) {
            Layer foundLayer = null;
            for (Layer layer : layers) {
                if (layer.contains(scoreObject)) {
                    foundLayer = layer;
                    break;
                }
            }

            if (foundLayer == null) {
                throw new RuntimeException(
                        "Error: Trying to copy a ScoreObject without a layer: Internal Error");
            }
            int layerIndex = layers.indexOf(foundLayer);
            buffer.scoreObjects.add(scoreObject);
            buffer.layers.add(foundLayer);
            indexes.add(layerIndex);

            if (layerIndex < layerMin) {
                layerMin = layerIndex;
            }
        }

        for (Integer layerIndex : indexes) {
            buffer.layerIndexes.add(layerIndex - layerMin);
        }
    }

    public void deleteScoreObjects() {
        if (lookup == null || content == null) {
            return;
        }

        Collection<? extends ScoreObject> scoreObjects = lookup.lookupAll(
                ScoreObject.class);
        Score score = lookup.lookup(Score.class);

        if (score == null) {
            throw new RuntimeException(
                    "Score object not set in ScoreController: internal error");
        }

        if (scoreObjects.isEmpty()) {
            return;
        }

        List<Layer> layers = score.getAllLayers();

        for (ScoreObject scoreObj : scoreObjects) {

            boolean found = false;

            for (Layer layer : layers) {
                if (layer.remove(scoreObj)) {
                    found = true;
                    break;
                }
            }
            if (!found) {
                throw new RuntimeException(
                        "Error: Unable to find Layer to remove ScoreObject: Internal Error");
            }
            content.remove(scoreObj);
        }

    }

    public void cutScoreObjects() {
        if (lookup == null || content == null) {
            return;
        }

        copyScoreObjects();
        deleteScoreObjects();
    }

    public ScoreObjectBuffer getScoreObjectBuffer() {
        return buffer;
    }

    /**
     * Set the current collection of selected ScoreObjects. Can pass null to
     * clear the selection.
     *
     * @param scoreObjects
     */
    public void setSelectedScoreObjects(Collection<? extends ScoreObject> scoreObjects) {
        if (lookup == null || content == null) {
            return;
        }

        for (ScoreObject scoreObj : lookup.lookupAll(ScoreObject.class)) {
            content.remove(scoreObj);
        }
        if (scoreObjects != null) {
            for (ScoreObject scoreObj : scoreObjects) {
                content.add(scoreObj);
            }
        }
    }

    public void addSelectedScoreObject(ScoreObject scoreObj) {
        if (lookup == null || content == null) {
            return;
        }
        content.add(scoreObj);
    }

    public void removeSelectedScoreObject(ScoreObject scoreObj) {
        if (lookup == null || content == null) {
            return;
        }
        content.remove(scoreObj);
    }

    public Collection<? extends ScoreObject> getSelectedScoreObjects() {
        if (lookup == null || content == null) {
            return null;
        }
        return lookup.lookupAll(ScoreObject.class);
    }


    public static class ScoreObjectBuffer {

        public final List<ScoreObject> scoreObjects = new ArrayList<>();
        public final List<Layer> layers = new ArrayList<>();
        public final List<Integer> layerIndexes = new ArrayList<>();

        public void clear() {
            scoreObjects.clear();
            layers.clear();
            layerIndexes.clear();
        }

    }
}
