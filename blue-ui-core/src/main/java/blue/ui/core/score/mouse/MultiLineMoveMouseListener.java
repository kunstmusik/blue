/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2008 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.ui.core.score.mouse;

import blue.automation.AutomationManager;
import blue.components.AlphaMarquee;
import blue.components.lines.Line;
import blue.plugin.ScoreMouseListenerPlugin;
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.score.layers.AutomatableLayer;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.ModeManager;
import blue.ui.core.score.MultiLineScoreSelection;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreMode;
import blue.ui.core.score.undo.ClearLineSelectionEdit;
import blue.ui.core.score.undo.CompoundAppendable;
import blue.ui.core.score.undo.LineChangeEdit;
import blue.ui.core.score.undo.MoveScoreObjectEdit;
import blue.ui.utilities.ResizeMode;
import blue.ui.utilities.UiUtilities;
import blue.undo.BlueUndoManager;
import blue.utility.ScoreUtilities;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.MouseEvent;
import java.util.HashMap;
import java.util.Map;
import javax.swing.SwingUtilities;

@ScoreMouseListenerPlugin(displayName = "MultiLineMoveMouseListener",
        position = 110)
class MultiLineMoveMouseListener extends BlueMouseAdapter {

    private final Rectangle scrollRect = new Rectangle(0, 0, 1, 1);

    int startX = -1;
    double minTranslation = 0.0f;
    private ScoreObject[] selectedScoreObjects = null;
    private double[] startTimes = null;
    Map<Line, Line> lineSourceCopyMap = new HashMap<>();

    TimeState timeState = null;

    MultiLineScoreSelection selection = MultiLineScoreSelection.getInstance();

    @Override
    public void mousePressed(MouseEvent e) {

        if (!isMultiLineMode()) {
            return;
        }

        var marquee = scoreTC.getMarquee();

        var resizeMode = UiUtilities.getResizeMode(e.getComponent(),
                e.getPoint(), marquee);

        Point p = SwingUtilities.convertPoint(scoreTC.getScorePanel(),
                e.getPoint(), marquee);

        if (!marquee.isVisible() || !marquee.contains(p) || resizeMode != ResizeMode.NONE) {
            return;
        }

        e.consume();
        RealtimeRenderManager.getInstance().stopAuditioning();
        timeState = scoreTC.getTimeState();

        startX = e.getX();
        minTranslation = -selection.getStartTime();

        var selectedObjects = ScoreController.getInstance()
                .getSelectedScoreObjects();

        selectedScoreObjects = selectedObjects.toArray(new ScoreObject[0]);
        startTimes = new double[selectedScoreObjects.length];

        for (int i = 0; i < selectedScoreObjects.length; i++) {
            ScoreObject sObj = selectedScoreObjects[i];
            startTimes[i] = sObj.getStartTime();
            minTranslation = Math.max(minTranslation, -startTimes[i]);
        }

        lineSourceCopyMap.clear();
        for (var layer : selection.getSelectedLayers()) {
            if (layer instanceof AutomatableLayer) {
                var autoLayer = (AutomatableLayer) layer;
                var paramIds = autoLayer.getAutomationParameters();
                var autoManager = AutomationManager.getInstance();
                for (var paramId : paramIds) {
                    var param = autoManager.getParameter(paramId);
                    var line = param.getLine();

                    lineSourceCopyMap.put(line, new Line(line));
                }
            }
        }

        selection.startTranslation();
    }

    @Override
    public void mouseDragged(MouseEvent e) {

        if (!isMultiLineMode()) {
            return;
        }

        e.consume();

//        var marquee = scoreTC.getMarquee();
        if (SwingUtilities.isLeftMouseButton(e)) {
            int x = e.getX();
            int diffX = x - startX;

            double translation = diffX / (double) timeState.getPixelSecond();

            if (timeState.isSnapEnabled() && !e.isControlDown()) {
                double newTime = ScoreUtilities.getSnapValueMove(
                        -minTranslation + translation, timeState.getSnapValue());

                translation = newTime + minTranslation;
            }

            translation = Math.max(translation, minTranslation);
            final double trans = translation;

            lineSourceCopyMap.forEach((source, copy) -> {
                var newLine = new Line(copy);
                newLine.processLineForSelectionDrag(selection.getStartTime(),
                        selection.getEndTime(), trans);
                source.setLinePoints(newLine.getObservableList());
            });

            for (int i = 0; i < selectedScoreObjects.length; i++) {
                ScoreObject sObj = selectedScoreObjects[i];
                sObj.setStartTime(startTimes[i] + trans);
            }

            selection.updateTranslation(translation);
        }

        checkScroll(e);
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        e.consume();
        
        if (SwingUtilities.isLeftMouseButton(e)) {
            AlphaMarquee marquee = scoreTC.getMarquee();
            var scale = selection.getScale();
            marquee.startTime = scale.getRangeStart();
            marquee.endTime = scale.getRangeEnd();

            CompoundAppendable compoundEdit = new CompoundAppendable();
            compoundEdit.addEdit(new ClearLineSelectionEdit());
            
            for (int i = 0; i < selectedScoreObjects.length; i++) {
                ScoreObject sObj = selectedScoreObjects[i];
                
                MoveScoreObjectEdit edit = new MoveScoreObjectEdit(
                        sObj, null, null, startTimes[i], sObj.getSubjectiveDuration(), 
                        sObj.getStartTime(), sObj.getSubjectiveDuration());
                
                compoundEdit.addEdit(edit);
            }
            
            lineSourceCopyMap.forEach((source, copy) -> {
                LineChangeEdit edit = new LineChangeEdit(source, copy, new Line(source));
                compoundEdit.addEdit(edit);
            });
            
            lineSourceCopyMap.clear();
            selectedScoreObjects = null;
            selection.endTranslation();
            
            BlueUndoManager.addEdit("score", compoundEdit.getTopEdit());
        }

        timeState = null;
    }

    private boolean isMultiLineMode() {
        return ModeManager.getInstance().getMode() == ScoreMode.MULTI_LINE;
    }

    @Override
    public boolean acceptsMode(ScoreMode mode) {
        return mode == ScoreMode.MULTI_LINE;
    }

}
