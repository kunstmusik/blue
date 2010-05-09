/*
 * Created on Aug 10, 2003
 *
 */
package blue.ui.core.score.undo;

import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

import blue.BlueSystem;
import blue.soundObject.SoundObject;

/**
 * @author steven
 * 
 */
public class StartTimeEdit extends AbstractUndoableEdit {
    float initialStart;

    float newStart;

    SoundObject sObj[];

    public StartTimeEdit(float initialStart, float newStart, SoundObject sObj) {

        this.initialStart = initialStart;
        this.newStart = newStart;
        this.sObj = new SoundObject[] { sObj };
    }

    public void redo() throws CannotRedoException {
        super.redo();
        this.sObj[0].setStartTime(newStart);
    }

    public void undo() throws CannotUndoException {
        super.undo();
        this.sObj[0].setStartTime(this.initialStart);

    }

    public String getPresentationName() {
        return BlueSystem.getString("scoreGUI.action.changeStartTime");
    }
}
