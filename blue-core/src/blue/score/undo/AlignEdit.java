/*
 * Created on Aug 13, 2003
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

public class AlignEdit extends AbstractUndoableEdit {
    private SoundObject[] soundObjects;

    private float[] initalStartTimes;

    private float[] endingStartTimes;

    private String presentationName;

    public AlignEdit(SoundObject[] soundObjects, float[] initialStartTimes,
            float[] endingStartTimes) {
        this.soundObjects = soundObjects;
        this.initalStartTimes = initialStartTimes;
        this.endingStartTimes = endingStartTimes;

        presentationName = BlueSystem.getString("scoreGUI.action.align");
    }

    public void redo() throws CannotRedoException {
        super.redo();
        for (int i = 0; i < soundObjects.length; i++) {
            soundObjects[i].setStartTime(this.endingStartTimes[i]);
        }
    }

    public void undo() throws CannotUndoException {
        super.undo();
        for (int i = 0; i < soundObjects.length; i++) {
            soundObjects[i].setStartTime(this.initalStartTimes[i]);
        }
    }

    public String getPresentationName() {
        return this.presentationName;
    }

    public void setPresentationName(String presentationName) {
        this.presentationName = presentationName;
    }

}
