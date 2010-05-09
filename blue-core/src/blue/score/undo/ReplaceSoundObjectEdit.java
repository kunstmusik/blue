/*
 * Created on Aug 10, 2003
 *
 */
package blue.score.undo;

import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

import blue.BlueSystem;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;

/**
 * @author steven
 * 
 */
public class ReplaceSoundObjectEdit extends AbstractUndoableEdit {
    private SoundObject oldSObj;

    private SoundObject newSObj;

    private int soundLayerIndex;

    private PolyObject pObj;

    public ReplaceSoundObjectEdit(PolyObject pObj, SoundObject sObjOld,
            SoundObject sObjNew, int soundLayerIndex) {

        this.pObj = pObj;
        this.oldSObj = sObjOld;
        this.newSObj = sObjNew;
        this.soundLayerIndex = soundLayerIndex;
    }

    public void redo() throws CannotRedoException {
        super.redo();
        this.pObj.removeSoundObject(oldSObj);
        this.pObj.addSoundObject(soundLayerIndex, this.newSObj);
    }

    public void undo() throws CannotUndoException {
        super.undo();
        this.pObj.removeSoundObject(newSObj);
        this.pObj.addSoundObject(soundLayerIndex, this.oldSObj);
    }

    public String getPresentationName() {
        return BlueSystem.getString("scoreGUI.action.replaceSoundObject");
    }
}