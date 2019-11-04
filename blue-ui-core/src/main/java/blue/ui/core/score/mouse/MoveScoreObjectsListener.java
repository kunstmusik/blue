/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
package blue.ui.core.score.mouse;

import blue.BlueSystem;
import blue.plugin.ScoreMouseListenerPlugin;
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.ScoreObjectLayer;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreMode;
import blue.ui.core.score.ScorePath;
import blue.ui.core.score.undo.MoveScoreObjectsEdit;
import blue.undo.BlueUndoManager;
import blue.utility.ScoreUtilities;
import java.awt.Point;
import java.awt.event.MouseEvent;
import java.util.Collection;
import java.util.List;
import javax.swing.SwingUtilities;

/**
 *
 * @author stevenyi
 */
@ScoreMouseListenerPlugin(displayName = "MoveScoreObjectsListener",
        position = 50)
public class MoveScoreObjectsListener extends BlueMouseAdapter {

    private static final int OS_CTRL_KEY = BlueSystem.getMenuShortcutKey();

    private Point startPoint;

    //Collection<? extends ScoreObject> selectedScoreObjects = null;
    //Map<ScoreObject, Double> startTimes = new HashMap<>();
    boolean initialDrag = true;

    private ScoreObject[] selectedScoreObjects = null;
    private double[] startTimes = null;
    private double minDiffTime = Double.MIN_VALUE;
    private int[] startLayerIndices = null;
    private int[] currentLayerIndices = null;

    private int startLayer = 0;
    private int lastLayerAdjust = 0;
    private int minYAdjust = 0;
    private int maxYAdjust = 0;

    protected static int getMinYAdjust(List<Layer> layers,
            ScoreObject scoreObj, int sObjLayerIndex) {
        for (int index = sObjLayerIndex - 1; index >= 0; index--) {
            if (layers.get(index).accepts(scoreObj)) {
                continue;
            }
            return (index + 1) - sObjLayerIndex;
        }

        return -sObjLayerIndex;
    }

    protected static int getMaxYAdjust(List<Layer> layers,
            ScoreObject scoreObj,
            int sObjLayerIndex) {

        for (int index = sObjLayerIndex + 1; index < layers.size(); index++) {
            if (layers.get(index).accepts(scoreObj)) {
                continue;
            }
            return (index - 1) - sObjLayerIndex;
        }

        return layers.size() - 1 - sObjLayerIndex;
    }

    @Override
    public void mousePressed(MouseEvent e) {

        if (currentScoreObjectView == null
                || !SwingUtilities.isLeftMouseButton(e)) {
            return;
        }

        ScoreObject scoreObj = currentScoreObjectView.getScoreObject();
        Collection<? extends ScoreObject> temp
                = ScoreController.getInstance().getSelectedScoreObjects();

        if (!temp.contains(scoreObj)) {
            return;
        }

        e.consume();

        ScorePath scorePath = ScoreController.getInstance().getScorePath();

        startPoint = e.getPoint();
        selectedScoreObjects = temp.toArray(new ScoreObject[0]);
        startTimes = new double[selectedScoreObjects.length];
        startLayerIndices = new int[selectedScoreObjects.length];
        currentLayerIndices = new int[selectedScoreObjects.length];

        minDiffTime = Double.MAX_VALUE;

        startLayer = scorePath.getGlobalLayerIndexForY(e.getY());
        lastLayerAdjust = 0;
        minYAdjust = Integer.MIN_VALUE;
        maxYAdjust = Integer.MAX_VALUE;

        initialDrag = true;

        List<Layer> allLayers = scorePath.getAllLayers();

        for (int i = 0; i < selectedScoreObjects.length; i++) {
            startTimes[i] = selectedScoreObjects[i].getStartTime();
            if (startTimes[i] < minDiffTime) {
                minDiffTime = startTimes[i];
            }
            startLayerIndices[i] = currentLayerIndices[i]
                    = scorePath.getGlobalLayerIndexForScoreObject(
                            selectedScoreObjects[i]);
            int minY = getMinYAdjust(allLayers, scoreObj, startLayerIndices[i]);
            int maxY = getMaxYAdjust(allLayers, scoreObj, startLayerIndices[i]);

            minYAdjust = (minY > minYAdjust) ? minY : minYAdjust;
            maxYAdjust = (maxY < maxYAdjust) ? maxY : maxYAdjust;
        }
        minDiffTime = -minDiffTime;

    }

    @Override
    public void mouseDragged(MouseEvent e) {
        ScoreController scoreController = ScoreController.getInstance();
        ScorePath scorePath = ScoreController.getInstance().getScorePath();
        List<Layer> allLayers = scorePath.getAllLayers();

        e.consume();

        if (initialDrag) {
            initialDrag = false;
            if ((e.getModifiers() & OS_CTRL_KEY) == OS_CTRL_KEY) {
                for (int i = 0; i < selectedScoreObjects.length; i++) {
                    ScoreObject original = selectedScoreObjects[i];
                    ScoreObject clone = original.deepCopy();
                    ScoreObjectLayer layer = (ScoreObjectLayer) allLayers.get(
                            startLayerIndices[i]);
                    layer.add(clone);
                    scoreController.removeSelectedScoreObject(original);
                    scoreController.addSelectedScoreObject(clone);
                    selectedScoreObjects[i] = clone;
                }
            }
        }

        double diffTime = e.getX() - startPoint.x;
        TimeState timeState = scoreTC.getTimeState();
        diffTime = diffTime / timeState.getPixelSecond();

        if (diffTime < minDiffTime) {
            diffTime = minDiffTime;
        }

        if (timeState.isSnapEnabled()) {

            double tempStart = -minDiffTime + diffTime;
            double snappedStart = ScoreUtilities.getSnapValueMove(tempStart,
                    timeState.getSnapValue());

            diffTime = snappedStart + minDiffTime;

        }

        int newLayerIndex = scorePath.getGlobalLayerIndexForY(e.getY());
        int layerAdjust = newLayerIndex - startLayer;
        layerAdjust = Math.max(layerAdjust, minYAdjust);
        layerAdjust = Math.min(layerAdjust, maxYAdjust);
        boolean layerAdjusted = lastLayerAdjust != layerAdjust;
        if (layerAdjusted) {
            lastLayerAdjust = layerAdjust;
        }

        for (int i = 0; i < selectedScoreObjects.length; i++) {
            selectedScoreObjects[i].setStartTime(startTimes[i] + diffTime);
            if (layerAdjusted) {
                ScoreObject scoreObj = selectedScoreObjects[i];
                int startIndex = startLayerIndices[i];
                int curLayerIndex = currentLayerIndices[i];
                int newSObjLayerIndex = startIndex + layerAdjust;

                allLayers.get(curLayerIndex).remove(scoreObj);

                // Re-add moved scoreObject as selected
                scoreController.addSelectedScoreObject(scoreObj);

                ((ScoreObjectLayer) allLayers.get(newSObjLayerIndex)).add(
                        scoreObj);

                currentLayerIndices[i] = newSObjLayerIndex;

            }
        }

        checkScroll(e);
    }

    @Override
    public void mouseReleased(MouseEvent e) {

        e.consume();

        if (!initialDrag) {
            List<Layer> allLayers = ScoreController.getInstance().getScorePath().getAllLayers();

            int len = startTimes.length;
            double[] endTimes = new double[len];
            ScoreObjectLayer[] startLayers = new ScoreObjectLayer[len];
            ScoreObjectLayer[] endLayers = new ScoreObjectLayer[len];

            for (int i = 0; i < selectedScoreObjects.length; i++) {
                endTimes[i] = selectedScoreObjects[i].getStartTime();
                startLayers[i] = (ScoreObjectLayer) allLayers.get(startLayerIndices[i]);
                endLayers[i] = (ScoreObjectLayer) allLayers.get(currentLayerIndices[i]);
            }

            MoveScoreObjectsEdit edit = new MoveScoreObjectsEdit(
                    selectedScoreObjects, startLayers, endLayers, startTimes,
                    endTimes);

            BlueUndoManager.setUndoManager("score");
            BlueUndoManager.addEdit(edit);
        }

        selectedScoreObjects = null;
        startTimes = null;
        startLayerIndices = null;
        currentLayerIndices = null;
    }
    
    @Override
    public boolean acceptsMode(ScoreMode mode) {
        return mode == ScoreMode.SCORE;
    }

}
