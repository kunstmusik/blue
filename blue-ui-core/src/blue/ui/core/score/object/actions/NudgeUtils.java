/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
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
package blue.ui.core.score.object.actions;

import blue.score.ScoreObject;
import blue.ui.core.score.undo.MoveScoreObjectsEdit;
import blue.undo.BlueUndoManager;
import java.util.Collection;

/**
 *
 * @author stevenyi
 */
public class NudgeUtils {

    // TODO - Respect snap values, Make Undoable
    public static void nudgeHorizontal(float timeValue,
            Collection<? extends ScoreObject> scoreObjects) {
        if (scoreObjects == null || scoreObjects.size() == 0) {
            return;
        }

        float adjustedTime = timeValue;

        if (timeValue < 0.0f) {
            for (ScoreObject scoreObj : scoreObjects) {
                float start = scoreObj.getStartTime();
                if (start == 0.0) {
                    return;
                }
                if (adjustedTime < -start) {
                    adjustedTime = -start;
                }
            }
        }

        //FIXME - handle for translating automations
//        mBuffer.motionBufferObjects();
//        setSelectionDragRegions();
        int len = scoreObjects.size();
        ScoreObject[] objects = scoreObjects.<ScoreObject>toArray(
                new ScoreObject[scoreObjects.size()]);
        float[] startTimes = new float[len];
        float[] endTimes = new float[len];

        for (int i = 0; i < objects.length; i++) {
            ScoreObject scoreObj = objects[i];
            startTimes[i] = scoreObj.getStartTime();
            endTimes[i] = scoreObj.getStartTime() + adjustedTime;
            scoreObj.setStartTime(endTimes[i]);
        }

        MoveScoreObjectsEdit edit = new MoveScoreObjectsEdit(objects,
                null, null, startTimes, endTimes);

        BlueUndoManager.setUndoManager("score");
        BlueUndoManager.addEdit(edit);

//        automationPanel.setMultiLineTranslation(timeValue);
//        automationPanel.commitMultiLineDrag();
    }
}
