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
import javax.swing.undo.UndoableEdit;

/**
 * @author steven
 *
 */
public class ReplaceScoreObjectEdit extends AbstractUndoableEdit {

    private ScoreObject oldSObj;

    private ScoreObject newSObj;

    private ScoreObjectLayer layer;

    private ReplaceScoreObjectEdit nextEdit = null;

    public ReplaceScoreObjectEdit(ScoreObjectLayer layer, ScoreObject sObjOld,
            ScoreObject sObjNew) {

        this.layer = layer;
        this.oldSObj = sObjOld;
        this.newSObj = sObjNew;
    }

    @Override
    public void redo() throws CannotRedoException {
        super.redo();
        this.layer.remove(oldSObj);
        this.layer.add(this.newSObj);

        if (nextEdit != null) {
            nextEdit.redo();
        }
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        this.layer.remove(newSObj);
        this.layer.add(this.oldSObj);

        if (nextEdit != null) {
            nextEdit.undo();
        }
    }

    @Override
    public String getPresentationName() {
        return BlueSystem.getString("scoreGUI.action.replaceSoundObject");
    }

    @Override
    public boolean addEdit(UndoableEdit anEdit) {
        if (anEdit instanceof ReplaceScoreObjectEdit) {
            if (nextEdit == null) {
                nextEdit = (ReplaceScoreObjectEdit) anEdit;
                return true;
            } else {
                return nextEdit.addEdit(anEdit);
            }
        }
        return false;
    }

}
