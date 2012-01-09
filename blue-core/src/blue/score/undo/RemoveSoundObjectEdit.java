/*
 * Created on Aug 10, 2003
 *
 */
package blue.score.undo;

import blue.BlueSystem;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

/**
 * @author steven
 */
public class RemoveSoundObjectEdit extends AbstractUndoableEdit {
    private SoundObject sObj;

    private int soundLayerIndex;

    private PolyObject pObj;

    RemoveSoundObjectEdit nextEdit = null;

    public RemoveSoundObjectEdit(PolyObject pObj, SoundObject sObj,
            int soundLayerIndex) {

        this.pObj = pObj;
        this.sObj = sObj;
        this.soundLayerIndex = soundLayerIndex;
    }

    public void redo() throws CannotRedoException {
        super.redo();
        this.pObj.removeSoundObject(sObj);
        if (nextEdit != null) {
            nextEdit.redo();
        }
    }

    public void undo() throws CannotUndoException {
        super.undo();
        this.pObj.addSoundObject(soundLayerIndex, this.sObj);
        if (nextEdit != null) {
            nextEdit.undo();
        }
    }

    public String getPresentationName() {
        if (nextEdit == null) {
            return BlueSystem.getString("scoreGUI.action.removeSoundObject");
        }
        return BlueSystem.getString("scoreGUI.action.removeSoundObjects");
    }

    public void setNextEdit(RemoveSoundObjectEdit nextEdit) {
        this.nextEdit = nextEdit;
    }
}