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
import blue.score.layers.ScoreObjectLayer;
import blue.ui.core.score.undo.RemoveScoreObjectEdit;
import blue.undo.BlueUndoManager;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.WeakHashMap;
import javax.swing.JScrollPane;
import org.openide.util.Lookup;
import org.openide.util.lookup.InstanceContent;

/**
 *
 * @author stevenyi
 */
public class ScoreController {

    private static ScoreController INSTANCE = null;

    public static synchronized ScoreController getInstance() {
        if (INSTANCE == null) {
            INSTANCE = new ScoreController();
        }
        return INSTANCE;
    }

    private Lookup lookup;
    private final ScoreObjectBuffer buffer = new ScoreObjectBuffer();
    private InstanceContent content;
    private Score score = null;
    WeakHashMap<Score, ScorePath> scorePaths = new WeakHashMap<>();
    private List<ScoreControllerListener> listeners = new ArrayList<>();
    JScrollPane scrollPane = null;

    private ScoreController() {
    }

    public void setLookupAndContent(Lookup lookup, InstanceContent content) {
        this.lookup = lookup;
        this.content = content;
    }

    public void setScrollPane(JScrollPane scrollPane) {
        this.scrollPane = scrollPane;
    }

    protected Lookup getLookup() {
        return this.lookup;
    }

    public void setScore(Score score) {
        ScorePath path = scorePaths.get(this.score);
        if (path != null) {
            path.setScrollX(scrollPane.getHorizontalScrollBar().getValue());
            path.setScrollY(scrollPane.getVerticalScrollBar().getValue());
        }

        this.score = score;

        path = scorePaths.get(score);
        if (path == null) {
            path = new ScorePath(score);
            scorePaths.put(score, path);
        }

        fireScorePathChanged();

        final ScorePath fPath = path;
//            SwingUtilities.invokeLater(new Runnable() {
//                @Override
//                public void run() {
        scrollPane.getHorizontalScrollBar().setValue(fPath.getScrollX());
        scrollPane.getVerticalScrollBar().setValue(fPath.getScrollY());
//                }
//            });
    }

    public void editLayerGroup(LayerGroup layerGroup) {
        final ScorePath path = scorePaths.get(score);
        if (path == null) {
            throw new RuntimeException(
                    "Error: LayerGroup passed in without a Score");
        }

        if (!path.containsLayerGroup(layerGroup)) {
            int scrollX = scrollPane.getHorizontalScrollBar().getValue();
            int scrollY = scrollPane.getVerticalScrollBar().getValue();
            path.setScrollX(scrollX);
            path.setScrollY(scrollY);
        }

        if (path.editLayerGroup(layerGroup)) {
            fireScorePathChanged();

//            SwingUtilities.invokeLater(new Runnable() {
//                @Override
//                public void run() {
            scrollPane.getHorizontalScrollBar().setValue(path.getScrollX());
            scrollPane.getVerticalScrollBar().setValue(path.getScrollY());
//                }
//            });
        }

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

        if (scoreObjects.isEmpty()) {
            return;
        }

        buffer.clear();
        List<Layer> layers = getScorePath().getAllLayers();

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

        Collection<? extends ScoreObject> scoreObjects = 
                ScoreController.getInstance().getSelectedScoreObjects();
        Score score = lookup.lookup(Score.class);

        if (score == null) {
            throw new RuntimeException(
                    "Score object not set in ScoreController: internal error");
        }

        if (scoreObjects.isEmpty()) {
            return;
        }

        List<Layer> layers = getScorePath().getAllLayers();

        RemoveScoreObjectEdit top = null;
        for (ScoreObject scoreObj : scoreObjects) {

            RemoveScoreObjectEdit edit = null;
            for (Layer layer : layers) {
                if (layer.remove(scoreObj)) {
                    edit = new RemoveScoreObjectEdit(
                            (ScoreObjectLayer) layer, scoreObj);
                    break;
                }
            }
            if (edit == null) {
                throw new RuntimeException(
                        "Error: Unable to find Layer to remove ScoreObject: Internal Error");
            }

            if (top == null) {
                top = edit;
            } else {
                top.appendNextEdit(edit);
            }

            content.remove(scoreObj);
        }

        BlueUndoManager.setUndoManager("score");
        BlueUndoManager.addEdit(top);

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
        public final List<Integer> layerIndexes = new ArrayList<>();

        public void clear() {
            scoreObjects.clear();
            layerIndexes.clear();
        }

    }
}
