/*
 * Created on Aug 10, 2003
 *
 */
package blue.ui.core.score.undo;

import blue.BlueSystem;
import blue.score.ScoreObject;
import blue.score.layers.ScoreObjectLayer;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

/**
 * @author steven
 */
public class RemoveScoreObjectEdit extends AppendableEdit {

    private final ScoreObject sObj;
    private final ScoreObjectLayer layer;

    public RemoveScoreObjectEdit(ScoreObjectLayer layer, ScoreObject sObj) {
        this.layer = layer;
        this.sObj = sObj;
    }

    @Override
    public void redo() throws CannotRedoException {
        layer.remove(sObj);
        super.redo();        
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        layer.add(sObj);
    }

    @Override
    public String getPresentationName() {
        if (nextEdit == null) {
            return BlueSystem.getString("scoreGUI.action.removeSoundObject");
        }
        return BlueSystem.getString("scoreGUI.action.removeSoundObjects");
    }

}
