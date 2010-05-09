/*
 * Created on Aug 10, 2003
 *
 */
package blue.score.undo;

import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

import blue.BlueSystem;
import blue.SoundLayer;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;

/**
 * @author steven
 * 
 */

public class AddSoundObjectEdit extends AbstractUndoableEdit {
    private SoundObject sObj;

    private int soundLayerIndex;

    private PolyObject pObj;

    private AddSoundObjectEdit nextEdit = null;

    public AddSoundObjectEdit(PolyObject pObj, SoundObject sObj,
            int soundLayerIndex) {

        this.pObj = pObj;
        this.sObj = sObj;
        this.soundLayerIndex = soundLayerIndex;
    }

    public void addSubEdit(AddSoundObjectEdit edit) {
        if (nextEdit != null) {
            nextEdit.addSubEdit(edit);
        } else {
            nextEdit = edit;
        }
    }

    public void redo() throws CannotRedoException {
        super.redo();

        SoundLayer sLayer = (SoundLayer) pObj.getElementAt(soundLayerIndex);
        sLayer.addSoundObject(sObj);

        if (nextEdit != null) {
            nextEdit.redo();
        }
    }

    public void undo() throws CannotUndoException {
        super.undo();

        pObj.removeSoundObject(sObj);

        if (nextEdit != null) {
            nextEdit.undo();
        }
    }

    public String getPresentationName() {
        return BlueSystem.getString("scoreGUI.action.addSoundObject");
    }
}
