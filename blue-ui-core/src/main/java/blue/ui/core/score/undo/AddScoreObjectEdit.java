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
 *
 */
public class AddScoreObjectEdit extends AppendableEdit {

    private final ScoreObject sObj;

    private final ScoreObjectLayer layer;

    public AddScoreObjectEdit(ScoreObjectLayer layer, ScoreObject sObj) {
        this.layer = layer;
        this.sObj = sObj;
    }

    @Override
    public void redo() throws CannotRedoException {
        layer.add(sObj);
        super.redo();
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        layer.remove(sObj);
    }

    @Override
    public String getPresentationName() {
        return BlueSystem.getString("scoreGUI.action.addSoundObject");
    }
}
