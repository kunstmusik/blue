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
package blue.ui.core.score.mouse;

import blue.plugin.ScoreMouseListenerPlugin;
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.time.TimeContext;
import blue.time.TimeContextManager;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreMode;
import blue.ui.core.score.undo.ResizeScoreObjectsEdit;
import blue.ui.core.score.undo.StartDurationUnit;
import blue.undo.BlueUndoManager;
import blue.utility.MathUtils;
import blue.utility.ScoreUtilities;
import java.awt.Cursor;
import java.awt.event.MouseEvent;
import java.util.Collection;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 *
 * @author stevenyi
 */
@ScoreMouseListenerPlugin(displayName = "ResizeScoreObjectsListener",
        position = 30)
public class ResizeScoreObjectsListener extends BlueMouseAdapter {

    protected enum ResizeMode {
        RESIZE_RIGHT, RESIZE_LEFT
    }

    private static final int EDGE = 5;

    StartDurationUnit[] startDurationUnits = null;
    StartDurationUnit currentSObjTimes = null;
    private boolean resized = false;

    ResizeMode resizeMode = ResizeMode.RESIZE_LEFT;
    private ScoreObject[] selectedScoreObjects;
    private double minDiffTime;
    private double maxDiffTime;

    private static ResizeMode getResizeMode(Cursor c) {
        switch (c.getType()) {
            case Cursor.W_RESIZE_CURSOR:
                return ResizeMode.RESIZE_RIGHT;

            case Cursor.E_RESIZE_CURSOR:
                return ResizeMode.RESIZE_LEFT;
            default:
                throw new RuntimeException(
                        "Error: Unknown resize type: " + c.getType());
        }
    }

    @Override
    public void mousePressed(MouseEvent e) {
        Cursor c = scoreTC.getScorePanel().getCursor();
        if (currentScoreObjectView == null
                || c == null
                || !(c.getType() == Cursor.E_RESIZE_CURSOR || c.getType() == Cursor.W_RESIZE_CURSOR)) {
            return;
        }
        e.consume();

        Collection<? extends ScoreObject> temp
                = ScoreController.getInstance().getSelectedScoreObjects();

//        if (temp.size() != 1) {
//            // skip if trying to stretch more than one object for now, should 
//            // revisit to do more than one in the future
//            return;
//        }
        resizeMode = getResizeMode(c);
        resized = false;

        selectedScoreObjects = temp.toArray(new ScoreObject[0]);
        startDurationUnits = new StartDurationUnit[selectedScoreObjects.length];

        minDiffTime = Double.NEGATIVE_INFINITY;
        maxDiffTime = Double.POSITIVE_INFINITY;

        TimeState timeState = scoreTC.getTimeState();
        TimeContext context = TimeContextManager.getContext();
        double pixelSeconds = (double) timeState.getPixelSecond();

        if (resizeMode == ResizeMode.RESIZE_LEFT) {
            for (int i = 0; i < selectedScoreObjects.length; i++) {
                final ScoreObject sObj = selectedScoreObjects[i];

                startDurationUnits[i] = new StartDurationUnit(sObj);

                double[] limits = sObj.getResizeLeftLimits(context);

                var leftMaxDiff = limits[0];
                var rightMaxDiff = limits[1] - (EDGE / pixelSeconds);

                minDiffTime = Math.max(leftMaxDiff, minDiffTime);
                maxDiffTime = Math.min(rightMaxDiff, maxDiffTime);

            }

        } else if (resizeMode == ResizeMode.RESIZE_RIGHT) {
            for (int i = 0; i < selectedScoreObjects.length; i++) {
                final ScoreObject sObj = selectedScoreObjects[i];
                startDurationUnits[i] = new StartDurationUnit(sObj);

                double[] limits = sObj.getResizeRightLimits(context);

                var leftMaxDiff = limits[0] + (EDGE / pixelSeconds);
                var rightMaxDiff = (limits[1] != Double.MAX_VALUE)
                        ? limits[1] - (EDGE / pixelSeconds) : limits[1];
                
                System.out.println("rmd: " + rightMaxDiff);

                minDiffTime = Math.max(leftMaxDiff, minDiffTime);
                maxDiffTime = Math.min(rightMaxDiff, maxDiffTime);

            }
        } else {
            throw new RuntimeException("Error: Invalid Resize Mode: " + resizeMode);
        }

        currentSObjTimes = new StartDurationUnit(currentScoreObjectView.getScoreObject());
    }

    @Override
    public void mouseDragged(MouseEvent e) {
        if (resizeMode == ResizeMode.RESIZE_LEFT) {
            resizeScoreObjectLeft(e);
            resized = true;
        } else if (resizeMode == ResizeMode.RESIZE_RIGHT) {
            resizeScoreObjectRight(e);
            resized = true;
        }
        e.consume();
    }

    @Override
    public void mouseReleased(MouseEvent e) {
        e.consume();

        if (resized) {

            StartDurationUnit[] finalTimes = (StartDurationUnit[]) Stream.of(selectedScoreObjects)
                    .map(sObj -> new StartDurationUnit(sObj))
                    .collect(Collectors.toList())
                    .toArray(new StartDurationUnit[0]);

            var edit = new ResizeScoreObjectsEdit(selectedScoreObjects, startDurationUnits, finalTimes);

            BlueUndoManager.addEdit("score", edit);

        }

        resized = false;
        startDurationUnits = null;
        selectedScoreObjects = null;
    }

    private void resizeScoreObjectRight(MouseEvent e) {
        if (selectedScoreObjects == null) {
            return;
        }

        TimeState timeState = scoreTC.getTimeState();
        TimeContext context = TimeContextManager.getContext();
        int xVal = e.getX();
        double newEnd;
//        var currentSobj = currentScoreObjectView.getScoreObject();

        if (timeState.isSnapEnabled()) {
            double beatPos = xVal / (double) timeState.getPixelSecond();
            final double snapValue = timeState.getSnapValueInBeats(beatPos, context.getTempoMap(), context.getSampleRate());

            double endTime = ScoreUtilities.getSnapValueMove(beatPos, snapValue);

            double minTime = ScoreUtilities.getSnapValueMove(
                    currentSObjTimes.start().toBeats(context) + snapValue / 2, snapValue);

            newEnd = (endTime < minTime) ? minTime : endTime;

        } else {

            double endTime = (double) xVal / timeState.getPixelSecond();
            double minTime = currentSObjTimes.start().toBeats(context);

            newEnd = (endTime < minTime) ? minTime : endTime;
        }

        if (newEnd > currentSObjTimes.end(context).toBeats(context) + maxDiffTime) {
            newEnd = currentSObjTimes.end(context).toBeats(context) + maxDiffTime;
        }

        double diff = MathUtils.clamp(minDiffTime, newEnd - currentSObjTimes.end(context).toBeats(context), maxDiffTime);

        for (int i = 0; i < startDurationUnits.length; i++) {
            blue.ui.core.score.undo.StartDurationUnit t = startDurationUnits[i];
            var sObj = selectedScoreObjects[i];
            var end = t.end(context).toBeats(context) + diff;
            sObj.resizeRight(context, end);
        }

    }

    private void resizeScoreObjectLeft(MouseEvent e) {

        if (selectedScoreObjects == null) {
            return;
        }

        TimeState timeState = scoreTC.getTimeState();
        TimeContext context = TimeContextManager.getContext();
        int xVal = e.getX();
        double newStart;

        if (timeState.isSnapEnabled()) {
            double beatPos = xVal / (double) timeState.getPixelSecond();
            double snapValue = timeState.getSnapValueInBeats(beatPos, context.getTempoMap(), context.getSampleRate());
            double endTime = ScoreUtilities.getSnapValueMove(
                    currentSObjTimes.end(context).toBeats(context) - (snapValue * .5001f), snapValue);

            newStart = ScoreUtilities.getSnapValueMove(beatPos, snapValue);

            newStart = (newStart < 0.0f) ? 0.0f : newStart;

            if (newStart > endTime) {
                newStart = endTime;
            }
        } else {

            double maxTime = currentSObjTimes.end(context).toBeats(context);

            if (xVal < 0) {
                xVal = 0;
            }

            newStart = (double) xVal / timeState.getPixelSecond();

            if (newStart > maxTime) {
                newStart = maxTime;
            }

        }

        if (newStart < currentSObjTimes.start().toBeats(context) + minDiffTime) {
            newStart = currentSObjTimes.start().toBeats(context) + minDiffTime;
        }

        double diff = MathUtils.clamp(minDiffTime, newStart - currentSObjTimes.start().toBeats(context), maxDiffTime);

        for (int i = 0; i < startDurationUnits.length; i++) {
            StartDurationUnit t = startDurationUnits[i];
            var sObj = selectedScoreObjects[i];
            var start = t.start().toBeats(context) + diff;
            sObj.resizeLeft(context, start);
        }

    }

    @Override
    public boolean acceptsMode(ScoreMode mode) {
        return mode == ScoreMode.SCORE;
    }

    static class UndoResizeScoreObjectsEdit {

    }
}
