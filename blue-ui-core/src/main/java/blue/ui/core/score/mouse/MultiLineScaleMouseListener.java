/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 Steven Yi (stevenyi@gmail.com)
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
import static blue.ui.core.score.mouse.BlueMouseAdapter.scoreTC;
import blue.ui.core.score.undo.ClearLineSelectionEdit;
import blue.ui.core.score.undo.CompoundAppendable;
import blue.ui.core.score.undo.LineChangeEdit;
import blue.ui.core.score.undo.MoveScoreObjectEdit;
import blue.ui.utilities.ResizeMode;
import blue.ui.utilities.UiUtilities;
import blue.undo.BlueUndoManager;
import blue.utilities.scales.ScaleLinear;
import blue.utility.ScoreUtilities;
import java.awt.Point;
import java.awt.event.MouseEvent;
import java.util.HashMap;
import java.util.Map;
import javax.swing.SwingUtilities;

@ScoreMouseListenerPlugin(displayName = "MultiLineScaleMouseListener",
        position = 120)
class MultiLineScaleMouseListener extends BlueMouseAdapter {

    final static int EDGE = 5;

    private final MultiLineScoreSelection selection = MultiLineScoreSelection.getInstance();

    int startX = -1;

    private Map<ScoreObject, double[]> scoreObjectRecords = new HashMap<>();
    private Map<Line, Line> lineSourceCopyMap = new HashMap<>();

    TimeState timeState = null;

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

        if (!marquee.isVisible() || !marquee.contains(p) || resizeMode == ResizeMode.NONE) {
            return;
        }

        // Check if selected score objects fit within selection, otherwise don't 
        // scale to prevent partial object scaling
        timeState = scoreTC.getTimeState();

        startX = e.getX();
//        minTranslation = -selection.getStartTime();
//
        var selectedObjects = ScoreController.getInstance()
                .getSelectedScoreObjects();

        final double start = selection.getStartTime();
        final double end = selection.getEndTime();

        var overlapping = selectedObjects.stream().anyMatch((ScoreObject t) -> {
            double t1 = t.getStartTime();
            double t2 = t1 + t.getSubjectiveDuration();

            return ((t1 < start && t2 > start)
                    || (t1 < end && t2 > end));
        });

        if (overlapping) {
            System.err.println("Overlapping scoreobjects found, don't scale");
            return;
        }

        scoreObjectRecords.clear();

        for (var sObj : selectedObjects) {
            double t1 = sObj.getStartTime();
            double t2 = t1 + sObj.getSubjectiveDuration();

            scoreObjectRecords.put(sObj, new double[]{t1, t2});
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

        e.consume();
        RealtimeRenderManager.getInstance().stopAuditioning();

        selection.startScale(resizeMode);
    }

    @Override
    public void mouseDragged(MouseEvent e) {

        if (!isMultiLineMode()) {
            return;
        }

        e.consume();

        final var marquee = scoreTC.getMarquee();

        if (SwingUtilities.isLeftMouseButton(e)) {
            final int x = e.getX();
            final double pixelSecond = (double) timeState.getPixelSecond();
            final var edgeTime = EDGE / pixelSecond;

            double newTime = x / pixelSecond;

            if (timeState.isSnapEnabled() && !e.isControlDown()) {
                newTime = ScoreUtilities.getSnapValueMove(
                        newTime, timeState.getSnapValue());
            }

            ScaleLinear scale = selection.getScale();
            if (selection.getScaleDirection() == ResizeMode.LEFT) {
                newTime = Math.min(scale.getRangeEnd() - edgeTime, newTime);
                newTime = Math.max(newTime, 0.0);
            } else {
                newTime = Math.max(scale.getRangeStart() + edgeTime, newTime);
            }

            selection.updateScale(newTime);

            scoreObjectRecords.forEach((sObj, vals) -> {
                double start = scale.calc(vals[0]);
                double end = scale.calc(vals[1]);

//                System.out.printf("%g : %g\n", start, end);
                sObj.setStartTime(start);
                sObj.setSubjectiveDuration(end - start);
            });

            lineSourceCopyMap
                    .forEach((source, copy) -> {
                        var newLine = new Line(copy);
                        newLine.processLineForSelectionScale(scale);
                        source.setLinePoints(newLine.getObservableList());
                    });

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

            scoreObjectRecords.forEach((sObj, vals) -> {
                double sourceStart = vals[0];
                double sourceEnd = vals[1];

                MoveScoreObjectEdit edit = new MoveScoreObjectEdit(
                        sObj, null, null, sourceStart, sourceEnd - sourceStart,
                        sObj.getStartTime(), sObj.getSubjectiveDuration());

                compoundEdit.addEdit(edit);
            });

            lineSourceCopyMap
                    .forEach((source, copy) -> {
                        LineChangeEdit edit = new LineChangeEdit(source, copy, new Line(source));
                        compoundEdit.addEdit(edit);
                    });

            lineSourceCopyMap.clear();
            scoreObjectRecords.clear();

            selection.endScale();

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
