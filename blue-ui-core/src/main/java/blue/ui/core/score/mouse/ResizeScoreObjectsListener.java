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

import blue.ui.core.score.undo.StartEndTime;
import blue.plugin.ScoreMouseListenerPlugin;
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreMode;
import blue.ui.core.score.undo.ResizeScoreObjectsEdit;
import blue.undo.BlueUndoManager;
import blue.utility.ScoreUtilities;
import java.awt.Cursor;
import java.awt.Point;
import java.awt.event.MouseEvent;
import java.util.Arrays;
import java.util.Collection;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.controlsfx.tools.Utils;

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

    private Point startPoint;
    StartEndTime[] startEndTimes = null;
    StartEndTime currentSObjTimes = null;
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

        startPoint = e.getPoint();
        selectedScoreObjects = temp.toArray(new ScoreObject[0]);
        startEndTimes = new StartEndTime[selectedScoreObjects.length];

        minDiffTime = Double.NEGATIVE_INFINITY;
        maxDiffTime = Double.POSITIVE_INFINITY;

        TimeState timeState = scoreTC.getTimeState();
        double pixelSeconds = (double) timeState.getPixelSecond();

        if (resizeMode == ResizeMode.RESIZE_LEFT) {
            for (int i = 0; i < selectedScoreObjects.length; i++) {
                final ScoreObject sObj = selectedScoreObjects[i];

                startEndTimes[i] = new StartEndTime(sObj);

                double[] limits = sObj.getResizeLeftLimits();

                var leftMaxDiff = limits[0];
                var rightMaxDiff = limits[1] - (EDGE / pixelSeconds);

                minDiffTime = Math.max(leftMaxDiff, minDiffTime);
                maxDiffTime = Math.min(rightMaxDiff, maxDiffTime);

            }

        } else if (resizeMode == ResizeMode.RESIZE_RIGHT) {
            for (int i = 0; i < selectedScoreObjects.length; i++) {
                final ScoreObject sObj = selectedScoreObjects[i];
                startEndTimes[i] = new StartEndTime(sObj);

                double[] limits = sObj.getResizeRightLimits();

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

        currentSObjTimes = new StartEndTime(currentScoreObjectView.getScoreObject());
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

            StartEndTime[] finalTimes = (StartEndTime[]) Stream.of(selectedScoreObjects)
                    .map(sObj -> new StartEndTime(sObj))
                    .collect(Collectors.toList())
                    .toArray(new StartEndTime[0]);

            var edit = new ResizeScoreObjectsEdit(selectedScoreObjects, startEndTimes, finalTimes);

            BlueUndoManager.addEdit("score", edit);

        }

        resized = false;
        startPoint = null;
        startEndTimes = null;
        selectedScoreObjects = null;
    }

    private void resizeScoreObjectRight(MouseEvent e) {
        if (selectedScoreObjects == null) {
            return;
        }

        TimeState timeState = scoreTC.getTimeState();
        int xVal = e.getX();
        double newEnd;
//        var currentSobj = currentScoreObjectView.getScoreObject();

        if (timeState.isSnapEnabled()) {
            final double snapValue = timeState.getSnapValue();

            double endTime = ScoreUtilities.getSnapValueMove(
                    xVal / (double) timeState.getPixelSecond(), snapValue);

            double minTime = ScoreUtilities.getSnapValueMove(
                    currentSObjTimes.start + snapValue / 2, snapValue);

            newEnd = (endTime < minTime) ? minTime : endTime;

        } else {

            double endTime = (double) xVal / timeState.getPixelSecond();
            double minTime = currentSObjTimes.start;

            newEnd = (endTime < minTime) ? minTime : endTime;
        }

        if (newEnd > currentSObjTimes.end + maxDiffTime) {
            newEnd = currentSObjTimes.end + maxDiffTime;
        }

        double diff = Utils.clamp(minDiffTime, newEnd - currentSObjTimes.end, maxDiffTime);

        for (int i = 0; i < startEndTimes.length; i++) {
            blue.ui.core.score.undo.StartEndTime t = startEndTimes[i];
            var sObj = selectedScoreObjects[i];
            var end = t.end + diff;
            sObj.resizeRight(end);
        }

    }

    private void resizeScoreObjectLeft(MouseEvent e) {

        if (selectedScoreObjects == null) {
            return;
        }

        TimeState timeState = scoreTC.getTimeState();
        int xVal = e.getX();
        double newStart;

        if (timeState.isSnapEnabled()) {
            double snapValue = timeState.getSnapValue();
            double endTime = ScoreUtilities.getSnapValueMove(
                    currentSObjTimes.end - (snapValue * .5001f), snapValue);

            newStart = ScoreUtilities.getSnapValueMove(
                    xVal / (double) timeState.getPixelSecond(),
                    snapValue);

            newStart = (newStart < 0.0f) ? 0.0f : newStart;

            if (newStart > endTime) {
                newStart = endTime;
            }
        } else {

            double maxTime = currentSObjTimes.end;

            if (xVal < 0) {
                xVal = 0;
            }

            newStart = (double) xVal / timeState.getPixelSecond();

            if (newStart > maxTime) {
                newStart = maxTime;
            }

        }

        if (newStart < currentSObjTimes.start + minDiffTime) {
            newStart = currentSObjTimes.start + minDiffTime;
        }

        double diff = Utils.clamp(minDiffTime, newStart - currentSObjTimes.start, maxDiffTime);

        for (int i = 0; i < startEndTimes.length; i++) {
            blue.ui.core.score.undo.StartEndTime t = startEndTimes[i];
            var sObj = selectedScoreObjects[i];
            var start = t.start + diff;
            sObj.resizeLeft(start);
        }

    }

    @Override
    public boolean acceptsMode(ScoreMode mode) {
        return mode == ScoreMode.SCORE;
    }

    static class UndoResizeScoreObjectsEdit {

    }
}
