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

/**
 * @author steven
 * 
 */
public class StartTimeEdit extends AbstractUndoableEdit {
    float initialStart;

    float newStart;

    ScoreObject sObj[];

    public StartTimeEdit(float initialStart, float newStart, ScoreObject sObj) {

        this.initialStart = initialStart;
        this.newStart = newStart;
        this.sObj = new ScoreObject[] { sObj };
    }

    @Override
    public void redo() throws CannotRedoException {
        super.redo();
        this.sObj[0].setStartTime(newStart);
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        this.sObj[0].setStartTime(this.initialStart);

    }

    @Override
    public String getPresentationName() {
        return BlueSystem.getString("scoreGUI.action.changeStartTime");
    }
}
