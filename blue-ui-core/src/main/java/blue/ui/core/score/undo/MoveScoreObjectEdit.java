/*
 * blue - object composition environment for csound 
 * Copyright (c) 2020
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.score.undo;

import blue.score.ScoreObject;
import blue.score.layers.ScoreObjectLayer;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

/**
 * Edit for moving ScoreObject. Handles source and target ScoreLayers, start
 * times, and durations.
 *
 * @author stevenyi
 */
public class MoveScoreObjectEdit extends AppendableEdit {

    private final ScoreObject sObj;
    private final ScoreObjectLayer sourceLayer;
    private final ScoreObjectLayer targetLayer;
    private final double sourceStart;
    private final double sourceDuration;
    private final double targetStart;
    private final double targetDuration;

    public MoveScoreObjectEdit(ScoreObject sObj, ScoreObjectLayer sourceLayer,
            ScoreObjectLayer targetLayer, double sourceStart, double sourceDuration,
            double targetStart, double targetDuration) {
        this.sObj = sObj;
        this.sourceLayer = sourceLayer;
        this.targetLayer = targetLayer;
        this.sourceStart = sourceStart;
        this.sourceDuration = sourceDuration;
        this.targetStart = targetStart;
        this.targetDuration = targetDuration;
    }

    @Override
    public void redo() throws CannotRedoException {
        sObj.setStartTime(targetStart);
        sObj.setSubjectiveDuration(targetDuration);

        if (sourceLayer != null && targetLayer != null
                && sourceLayer != targetLayer) {
            sourceLayer.remove(sObj);
            targetLayer.add(sObj);
        }

        super.redo();
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        sObj.setStartTime(sourceStart);
        sObj.setSubjectiveDuration(sourceDuration);

        if (sourceLayer != null && targetLayer != null
                && sourceLayer != targetLayer) {
            targetLayer.remove(sObj);
            sourceLayer.add(sObj);
        }
    }
}
