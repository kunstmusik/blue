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

import blue.plugin.ScoreMouseListenerPlugin;
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.ui.core.render.RealtimeRenderManager;
import blue.ui.core.score.ModeManager;
import blue.ui.core.score.MultiLineScoreSelection;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreMode;
import blue.ui.utilities.ResizeMode;
import blue.ui.utilities.UiUtilities;
import blue.utilities.scales.ScaleLinear;
import blue.utility.ScoreUtilities;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.event.MouseEvent;
import java.util.HashMap;
import java.util.Map;
import javax.swing.SwingUtilities;

@ScoreMouseListenerPlugin(displayName = "MultiLineScaleMouseListener",
        position = 120)
class MultiLineScaleMouseListener extends BlueMouseAdapter {

    final static int EDGE = 5;

    private final MultiLineScoreSelection selection = MultiLineScoreSelection.getInstance();
    private final Rectangle scrollRect = new Rectangle(0, 0, 1, 1);

    int startX = -1;

    private Map<ScoreObject, double[]> scoreObjectRecords = new HashMap<>();

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

//        selectedScoreObjects = selectedObjects.toArray(new ScoreObject[0]);
//        startTimes = new double[selectedScoreObjects.length];
//        for (int i = 0; i < selectedScoreObjects.length; i++) {
//            ScoreObject sObj = selectedScoreObjects[i];
//            startTimes[i] = sObj.getStartTime();
//            minTranslation = Math.max(minTranslation, -startTimes[i]);
//        }
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

                System.out.printf("%g : %g\n", start, end);

                sObj.setStartTime(start);
                sObj.setSubjectiveDuration(end - start);
            });
        }

        checkScroll(e);
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        e.consume();
        if (SwingUtilities.isLeftMouseButton(e)) {
//            AlphaMarquee marquee = scoreTC.getMarquee();
//
//            marquee.startTime += selection.getTranslationTime();
//            marquee.endTime += selection.getTranslationTime();

            selection.endScale();
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
