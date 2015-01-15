/*
 * Created on Aug 10, 2003
 *
 */
package blue.ui.core.score.undo;

import blue.BlueSystem;
import blue.score.ScoreObject;
import blue.score.layers.ScoreObjectLayer;
import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

/**
 * @author steven
 *
 */
public class AddScoreObjectEdit extends AbstractUndoableEdit {

    private ScoreObject sObj;

    private ScoreObjectLayer layer;

    private AddScoreObjectEdit nextEdit = null;

    public AddScoreObjectEdit(ScoreObjectLayer layer, ScoreObject sObj) {
        this.layer = layer;
        this.sObj = sObj;
    }

    public void addSubEdit(AddScoreObjectEdit edit) {
        if (nextEdit != null) {
            nextEdit.addSubEdit(edit);
        } else {
            nextEdit = edit;
        }
    }

    @Override
    public void redo() throws CannotRedoException {
        super.redo();

        layer.add(sObj);

        if (nextEdit != null) {
            nextEdit.redo();
        }
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();

        layer.remove(sObj);
        
        if (nextEdit != null) {
            nextEdit.undo();
        }
    }

    @Override
    public String getPresentationName() {
        return BlueSystem.getString("scoreGUI.action.addSoundObject");
    }
}
