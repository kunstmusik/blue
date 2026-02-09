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
import blue.time.TimeContext;
import blue.time.TimeContextManager;
import blue.time.TimeDuration;
import blue.time.TimeUnit;
import blue.time.TimeUnitMath;
import blue.time.TimeUtilities;
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

    private final Map<ScoreObject, ScoreObjectRecord> scoreObjectRecords = new HashMap<>();
    
    // Record to store original TimeUnits and beat values for scaling
    private record ScoreObjectRecord(TimeUnit startUnit, TimeDuration durationUnit, double startBeats, double endBeats) {}
    private final Map<Line, Line> lineSourceCopyMap = new HashMap<>();

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
        
        TimeContext context = TimeContextManager.getContext();

        startX = e.getX();
//        minTranslation = -selection.getStartTime();
//
        var selectedObjects = ScoreController.getInstance()
                .getSelectedScoreObjects();

        final double start = selection.getStartTime();
        final double end = selection.getEndTime();

        var overlapping = selectedObjects.stream().anyMatch((ScoreObject t) -> {
            double t1 = t.getStartTime().toBeats(context);
            double t2 = t1 + t.getSubjectiveDuration().toBeats(context);

            return ((t1 < start && t2 > start)
                    || (t1 < end && t2 > end));
        });

        if (overlapping) {
            System.err.println("Overlapping scoreobjects found, don't scale");
            return;
        }

        scoreObjectRecords.clear();

        for (var sObj : selectedObjects) {
            TimeUnit startUnit = sObj.getStartTime();
            TimeDuration durationUnit = sObj.getSubjectiveDuration();
            double t1 = startUnit.toBeats(context);
            double t2 = t1 + durationUnit.toBeats(context);

            scoreObjectRecords.put(sObj, new ScoreObjectRecord(startUnit, durationUnit, t1, t2));
        }

        lineSourceCopyMap.clear();
        for (var layer : selection.getSelectedLayers()) {
            if (layer instanceof AutomatableLayer autoLayer) {
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
            final double pixelSecond = timeState.getPixelSecond();
            final var edgeTime = EDGE / pixelSecond;

            double newTime = x / pixelSecond;

            if (timeState.isSnapEnabled() && !e.isControlDown()) {
                TimeContext ctx = TimeContextManager.getContext();
                newTime = ScoreUtilities.getSnapValueMove(
                        newTime, timeState.getSnapValueInBeats(newTime, ctx.getTempoMap(), ctx.getSampleRate()));
            }

            ScaleLinear scale = selection.getScale();
            if (selection.getScaleDirection() == ResizeMode.LEFT) {
                newTime = Math.min(scale.getRangeEnd() - edgeTime, newTime);
                newTime = Math.max(newTime, 0.0);
            } else {
                newTime = Math.max(scale.getRangeStart() + edgeTime, newTime);
            }

            selection.updateScale(newTime);

            scoreObjectRecords.forEach((sObj, record) -> {
                double start = scale.calc(record.startBeats());
                double end = scale.calc(record.endBeats());
                TimeContext ctx = TimeContextManager.getContext();

//                System.out.printf("%g : %g\n", start, end);
                // Preserve the original TimeUnit types
                sObj.setStartTime(TimeUtilities.beatsToTimeUnit(start, record.startUnit().getTimeBase(), ctx));
                sObj.setSubjectiveDuration(TimeUnitMath.beatsToDuration(end - start, record.durationUnit().getTimeBase(), ctx));
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

            scoreObjectRecords.forEach((sObj, record) -> {
                // Use original TimeUnits for undo
                MoveScoreObjectEdit edit = new MoveScoreObjectEdit(
                        sObj, null, null, 
                        record.startUnit(), record.durationUnit(),
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
