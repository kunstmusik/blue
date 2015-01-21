/*
 * Created on Aug 10, 2003
 *
 */
package blue.ui.core.score.undo;

import blue.BlueSystem;
import blue.score.ScoreObject;
import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;
import javax.swing.undo.UndoableEdit;

/**
 * @author steven
 * 
 */

public class ResizeScoreObjectEdit extends AbstractUndoableEdit {
    private ScoreObject sObj;

    private float initialDuration, endingDuration;

    private ResizeScoreObjectEdit nextEdit = null;

    public ResizeScoreObjectEdit(ScoreObject sObj, float initialDuration,
            float endingDuration) {

        this.initialDuration = initialDuration;
        this.endingDuration = endingDuration;
        this.sObj = sObj;
    }

    @Override
    public void redo() throws CannotRedoException {
        super.redo();
        sObj.setSubjectiveDuration(endingDuration);
        if(nextEdit != null) {
            nextEdit.redo();
        }
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        sObj.setSubjectiveDuration(initialDuration);
        if(nextEdit != null) {
            nextEdit.undo();
        }
    }

    @Override
    public String getPresentationName() {
        return BlueSystem.getString("scoreGUI.action.resizeSoundObject");
    }

    @Override
    public boolean addEdit(UndoableEdit anEdit) {
        if (anEdit instanceof ResizeScoreObjectEdit) {
            if (nextEdit == null) {
                nextEdit = (ResizeScoreObjectEdit) anEdit;
                return true;
            } else {
                return nextEdit.addEdit(anEdit);
            }
        }
        return false;
    }
}
