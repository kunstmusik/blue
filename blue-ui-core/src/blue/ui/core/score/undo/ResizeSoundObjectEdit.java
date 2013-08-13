/*
 * Created on Aug 10, 2003
 *
 */
package blue.ui.core.score.undo;

import blue.BlueSystem;
import blue.soundObject.SoundObject;
import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

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

    @Override
    public void redo() throws CannotRedoException {
        super.redo();
        sObj[0].setSubjectiveDuration(endingDuration);
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        sObj[0].setSubjectiveDuration(initialDuration);
    }

    @Override
    public String getPresentationName() {
        return BlueSystem.getString("scoreGUI.action.resizeSoundObject");
    }
}