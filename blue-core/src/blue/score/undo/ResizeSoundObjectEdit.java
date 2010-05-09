/*
 * Created on Aug 10, 2003
 *
 */
package blue.score.undo;

import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

import blue.BlueSystem;
import blue.soundObject.SoundObject;

/**
 * @author steven
 * 
 */

public class ResizeSoundObjectEdit extends AbstractUndoableEdit {
    private SoundObject[] sObj;

    private float initialDuration, endingDuration;

    public ResizeSoundObjectEdit(SoundObject sObj, float initialDuration,
            float endingDuration) {

        this.initialDuration = initialDuration;
        this.endingDuration = endingDuration;
        this.sObj = new SoundObject[1];
        this.sObj[0] = sObj;
    }

    public void redo() throws CannotRedoException {
        super.redo();
        sObj[0].setSubjectiveDuration(endingDuration);
    }

    public void undo() throws CannotUndoException {
        super.undo();
        sObj[0].setSubjectiveDuration(initialDuration);
    }

    public String getPresentationName() {
        return BlueSystem.getString("scoreGUI.action.resizeSoundObject");
    }
}