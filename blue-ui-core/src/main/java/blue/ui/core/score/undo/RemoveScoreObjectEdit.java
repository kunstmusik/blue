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
 */
public class RemoveScoreObjectEdit extends AbstractUndoableEdit {

    private final ScoreObject sObj;
    private final ScoreObjectLayer layer;

    RemoveScoreObjectEdit nextEdit = null;

    public RemoveScoreObjectEdit(ScoreObjectLayer layer, ScoreObject sObj) {
        this.layer = layer;
        this.sObj = sObj;
    }

    @Override
    public void redo() throws CannotRedoException {
        super.redo();
        layer.remove(sObj);
        if (nextEdit != null) {
            nextEdit.redo();
        }
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        layer.add(sObj);
        if (nextEdit != null) {
            nextEdit.undo();
        }
    }

    @Override
    public String getPresentationName() {
        if (nextEdit == null) {
            return BlueSystem.getString("scoreGUI.action.removeSoundObject");
        }
        return BlueSystem.getString("scoreGUI.action.removeSoundObjects");
    }

    public void appendNextEdit(RemoveScoreObjectEdit nextEdit) {
        if (this.nextEdit != null) {
            this.nextEdit.appendNextEdit(nextEdit);
        } else {
            this.nextEdit = nextEdit;
        }
    }
}
