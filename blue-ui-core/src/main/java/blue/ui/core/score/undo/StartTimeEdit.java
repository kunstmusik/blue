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
public class StartTimeEdit extends AbstractUndoableEdit {
    double initialStart;

    double newStart;

    ScoreObject sObj;

    UndoableEdit nextEdit = null;

    public StartTimeEdit(double initialStart, double newStart, ScoreObject sObj) {

        this.initialStart = initialStart;
        this.newStart = newStart;
        this.sObj =  sObj;
    }

    @Override
    public void redo() throws CannotRedoException {
        super.redo();
        this.sObj.setStartTime(newStart);
        if(this.nextEdit != null) {
            this.nextEdit.redo();
        }
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        this.sObj.setStartTime(this.initialStart);
        if(this.nextEdit != null) {
            this.nextEdit.undo();
        }
    }

    @Override
    public String getPresentationName() {
        return BlueSystem.getString("scoreGUI.action.changeStartTime");
    }

    @Override
    public boolean addEdit(UndoableEdit anEdit) {
        if(this.nextEdit == null) {
            this.nextEdit = anEdit;
            return true;
        }

        return this.nextEdit.addEdit(anEdit);
    }

    
}
