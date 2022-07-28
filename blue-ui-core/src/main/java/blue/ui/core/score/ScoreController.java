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

import blue.automation.AutomationManager;
import blue.automation.Parameter;
import blue.automation.ParameterIdList;
import blue.components.lines.Line;
import blue.components.lines.LinePoint;
import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.layers.AutomatableLayer;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.ScoreObjectLayer;
import blue.ui.core.clipboard.BlueClipboardUtils;
import blue.ui.core.score.undo.AddScoreObjectEdit;
import blue.ui.core.score.undo.AppendableEdit;
import blue.ui.core.score.undo.CompoundAppendable;
import blue.ui.core.score.undo.LineChangeEdit;
import blue.ui.core.score.undo.RemoveScoreObjectEdit;
import blue.undo.BlueUndoManager;
import java.awt.Toolkit;
import java.awt.datatransfer.StringSelection;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.WeakHashMap;
import java.util.stream.Collectors;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
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

    private final SingleLineBuffer singleLineBuffer = new SingleLineBuffer();
    private final MultiLineBuffer multiLineBuffer = new MultiLineBuffer();

    private InstanceContent content;
    private Score score = null;
    WeakHashMap<Score, ScorePath> scorePaths = new WeakHashMap<>();
    
    private BooleanProperty scoreObjectsMoving = new SimpleBooleanProperty(false);
    
    private final List<ScoreControllerListener> listeners = new ArrayList<>();
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

        List<Layer> layers = getScorePath().getAllLayers();

        int layerMin = Integer.MAX_VALUE;

        List<ScoreObject> copyScoreObjects = new ArrayList<>();
        List<Integer> copyIndices = new ArrayList<>();

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
            copyScoreObjects.add(scoreObject);
            copyIndices.add(layerIndex);

            if (layerIndex < layerMin) {
                layerMin = layerIndex;
            }
        }

        var copy = new ScoreObjectCopy(copyScoreObjects, copyIndices);
        var clipboard = BlueClipboardUtils.getClipboard();
        clipboard.setContents(copy, new StringSelection(""));
    }

    public Optional<AppendableEdit> deleteScoreObjects() {
        if (lookup == null || content == null) {
            return Optional.empty();
        }

        Collection<? extends ScoreObject> scoreObjects
                = ScoreController.getInstance().getSelectedScoreObjects();
        Score score = lookup.lookup(Score.class);

        if (score == null) {
            throw new RuntimeException(
                    "Score object not set in ScoreController: internal error");
        }

        if (scoreObjects.isEmpty()) {
            return Optional.empty();
        }

        List<Layer> layers = getScorePath().getAllLayers();

        CompoundAppendable compoundEdit = new CompoundAppendable();

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

            compoundEdit.addEdit(edit);

            content.remove(scoreObj);
        }

        var top = compoundEdit.getTopEdit();
        BlueUndoManager.addEdit("score", top);

        return Optional.of(top);
    }

    public void cutScoreObjects() {
        if (lookup == null || content == null) {
            return;
        }

        copyScoreObjects();
        deleteScoreObjects();
    }

    /* Single Line Handling */
    public void copySingleLine() {
        SingleLineScoreSelection selection
                = SingleLineScoreSelection.getInstance();
        if (selection.getSourceLine() != null) {
            singleLineBuffer.clear();
            singleLineBuffer.sourceLine = selection.getSourceLine();
            singleLineBuffer.startTime = selection.getStartTime();
            singleLineBuffer.points.addAll(selection.getSourceLine().copy(
                    selection.getStartTime(), selection.getEndTime()));
        }
    }

    public void deleteSingleLine() {
        SingleLineScoreSelection selection
                = SingleLineScoreSelection.getInstance();
        final var line = selection.getSourceLine();
        if (line != null) {

            var sourceCopy = new Line(line);

            line.delete(selection.getStartTime(), selection.getEndTime());

            var endCopy = new Line(line);

            BlueUndoManager.addEdit("score",
                    new LineChangeEdit(line, sourceCopy, endCopy));

            selection.clear();
        }

    }

    public void cutSingleLine() {
        copySingleLine();
        deleteSingleLine();
    }

    public void pasteSingleLine(double start) {
        if (singleLineBuffer.sourceLine == null
                || singleLineBuffer.startTime < 0.0) {
            return;
        }
        double adjust = start - singleLineBuffer.startTime;
        List<LinePoint> points
                = singleLineBuffer.points.stream().map(lp -> {
                    LinePoint p = new LinePoint(lp);
                    p.setX(p.getX() + adjust);
                    return p;
                }).collect(Collectors.toList());

        final Line line = singleLineBuffer.sourceLine;
        final var sourceCopy = new Line(line);
        line.paste(points);
        final var endCopy = new Line(line);
        BlueUndoManager.addEdit("score",
                new LineChangeEdit(line, sourceCopy, endCopy));

        SingleLineScoreSelection selection
                = SingleLineScoreSelection.getInstance();
        selection.updateSelection(singleLineBuffer.sourceLine, points.get(0).getX(), points.get(points.size() - 1).getX());
    }

    /* Multi Line Data Handling*/
    public void copyMultiLine() {
        if (lookup == null || content == null) {
            return;
        }

        Collection<? extends ScoreObject> scoreObjects = lookup.lookupAll(
                ScoreObject.class);

        final MultiLineScoreSelection selection
                = MultiLineScoreSelection.getInstance();
        final double start = selection.getStartTime();
        final double end = selection.getEndTime();

        AutomationManager manager = AutomationManager.getInstance();

        multiLineBuffer.clear();
        multiLineBuffer.sourceScore = getScore();
        multiLineBuffer.selectionStart = start;

        List<Layer> layers = getScorePath().getAllLayers();
        double minScoreTime = start;

        // COPY SCORE OBJECTS
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

            // deep copy to lock in scoreObject properties 
            multiLineBuffer.scoreObjects.put(scoreObject.deepCopy(),
                    (ScoreObjectLayer) foundLayer);
            minScoreTime = Math.min(minScoreTime, scoreObject.getStartTime());
        }

        multiLineBuffer.scorePasteMin = minScoreTime;

        // COPY AUTOMATION DATA 
        for (Layer layer : selection.getSelectedLayers()) {
            if (layer instanceof AutomatableLayer) {
                AutomatableLayer al = (AutomatableLayer) layer;
                ParameterIdList params = al.getAutomationParameters();

                for (String paramId : params) {
                    Parameter param = manager.getParameter(paramId);
                    Line line = param.getLine();
                    List<LinePoint> autoData = line.copy(start, end);
                    multiLineBuffer.automationData.put(autoData, line);
                }
            }
        }

        multiLineBuffer.selectedLayers.addAll(selection.getSelectedLayers());
    }

    public void deleteMultiLine() {

        final MultiLineScoreSelection selection
                = MultiLineScoreSelection.getInstance();

        if (selection.getSelectedLayers() == null) {
            return;
        }

        final double start = selection.getStartTime();
        final double end = selection.getEndTime();

        AutomationManager manager = AutomationManager.getInstance();

        CompoundAppendable compoundEdit = new CompoundAppendable();
        for (Layer layer : selection.getSelectedLayers()) {
            if (layer instanceof AutomatableLayer) {
                AutomatableLayer al = (AutomatableLayer) layer;
                ParameterIdList params = al.getAutomationParameters();

                for (String paramId : params) {
                    Parameter param = manager.getParameter(paramId);
                    Line line = param.getLine();
                    var sourceCopy = new Line(line);
                    line.delete(start, end);
                    var endCopy = new Line(line);

                    var edit = new LineChangeEdit(line, sourceCopy, endCopy);
                    compoundEdit.addEdit(edit);
                }
            }
        }
        var top = compoundEdit.getTopEdit();
        var scoreObjectsEdit = deleteScoreObjects();
        if (scoreObjectsEdit.isPresent()) {
            scoreObjectsEdit.get().appendNextEdit(top);
        } else if (top != null) {
            BlueUndoManager.addEdit("score", top);
        }

        selection.reset();
    }

    public void cutMultiLine() {
        copyMultiLine();
        deleteMultiLine();
    }

    public void pasteMultiLine(double start) {
        if (start < (multiLineBuffer.selectionStart - multiLineBuffer.scorePasteMin)
                || getScore() != multiLineBuffer.sourceScore
                || multiLineBuffer.selectionStart < 0.0) {
            throw new RuntimeException("Error: Unable to paste: paste time < "
                    + "min score time");
        }

        double adjust = start - multiLineBuffer.selectionStart;

        ScoreController controller = ScoreController.getInstance();

        Set<ScoreObject> selected = new HashSet<>();
        CompoundAppendable compoundEdit = new CompoundAppendable();

        for (var entry : multiLineBuffer.scoreObjects.entrySet()) {
            final var sObj = entry.getKey().deepCopy();
            final var layer = entry.getValue();

            sObj.setStartTime(sObj.getStartTime() + adjust);
            layer.add(sObj);
            selected.add(sObj);

            compoundEdit.addEdit(new AddScoreObjectEdit(layer, sObj));
        }
        controller.setSelectedScoreObjects(selected);

        for (var entry : multiLineBuffer.automationData.entrySet()) {

            final Line line = entry.getValue();
            final var sourceCopy = new Line(line);
            List<LinePoint> points
                    = entry.getKey().stream().map(lp -> {
                        LinePoint p = new LinePoint(lp);
                        p.setX(p.getX() + adjust);
                        return p;
                    }).collect(Collectors.toList());
            line.paste(points);
            final var endCopy = new Line(line);
            compoundEdit.addEdit(new LineChangeEdit(line, sourceCopy, endCopy));
        }

        MultiLineScoreSelection selection = MultiLineScoreSelection.getInstance();
        final double dur = selection.endTime - selection.startTime;
        selection.updateSelection(start, start + dur, multiLineBuffer.selectedLayers);

        BlueUndoManager.addEdit("score", compoundEdit.getTopEdit());
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

    public BooleanProperty getScoreObjectsMovingProperty() {
        return scoreObjectsMoving;
    }    
    

    public static class SingleLineBuffer {

        public Line sourceLine = null;
        public final List<LinePoint> points = new ArrayList<>();
        public double startTime = -1.0;

        public void clear() {
            sourceLine = null;
            startTime = -1.0;
            points.clear();
        }
    }

    public static class MultiLineBuffer {

        // use maps here as Blue only allows pasting back into the source layers
        // and lines for multiline copy/paste
        public final Map<ScoreObject, ScoreObjectLayer> scoreObjects = new HashMap<>();
        public final Map<List<LinePoint>, Line> automationData = new HashMap<>();
        public final Set<Layer> selectedLayers = new HashSet<>();

        public Score sourceScore = null;

        // This is the start time for the marquee selection 
        public double selectionStart = -1.0;
        // This is the different in time between selectionStart and first
        // scoreObject time. This is here to prevent trying to paste data and 
        // have scoreObjects with time < 0.0 
        double scorePasteMin = -1.0;

        public void clear() {
            scoreObjects.clear();
            automationData.clear();
            selectedLayers.clear();
            sourceScore = null;
            selectionStart = -1.0;
            scorePasteMin = -1.0;
        }

    }
}
