/*
 * Created on Aug 10, 2003
 *
 */
package blue.score.undo;

import blue.BlueSystem;
import blue.SoundLayer;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

/**
 * @author steven
 * 
 */
public class MoveSoundObjectsEdit extends AbstractUndoableEdit {
    private SoundObject[] soundObjects;

    private int[] startIndex;

    private int[] endIndex;

    private float[] initalStartTimes;

    private float[] endingStartTimes;

    // private PolyObjectController pObjController;

    private PolyObject pObj;

    private String presentationName = null;

    public MoveSoundObjectsEdit(PolyObject pObj, SoundObject[] soundObjects,
            int[] startIndex, int[] endIndex, float[] initialStartTimes,
            float[] endingStarttimes) {

        this.pObj = pObj;
        this.soundObjects = soundObjects;
        this.startIndex = startIndex;
        this.endIndex = endIndex;
        this.initalStartTimes = initialStartTimes;
        this.endingStartTimes = endingStarttimes;

    }

    public void redo() throws CannotRedoException {
        super.redo();
        for (int i = 0; i < soundObjects.length; i++) {
            soundObjects[i].setStartTime(this.endingStartTimes[i]);

            if (startIndex[i] != endIndex[i]) {
                ((SoundLayer) (pObj.getElementAt(startIndex[i])))
                        .removeSoundObject(soundObjects[i]);
                ((SoundLayer) (pObj.getElementAt(endIndex[i])))
                        .addSoundObject(soundObjects[i]);
            }
        }
    }

    public void undo() throws CannotUndoException {
        super.undo();
        for (int i = 0; i < soundObjects.length; i++) {
            soundObjects[i].setStartTime(this.initalStartTimes[i]);

            if (startIndex[i] != endIndex[i]) {
                ((SoundLayer) (pObj.getElementAt(endIndex[i])))
                        .removeSoundObject(soundObjects[i]);
                ((SoundLayer) (pObj.getElementAt(startIndex[i])))
                        .addSoundObject(soundObjects[i]);
            }
        }
    }

    public String getPresentationName() {
        if (presentationName != null) {
            return presentationName;
        }
        if (soundObjects.length > 1) {
            return BlueSystem.getString("scoreGUI.action.moveSoundObjects");
        }
        return BlueSystem.getString("scoreGUI.action.moveSoundObject");

    }

    public void setPresentationName(String presentationName) {
        this.presentationName = presentationName;
    }

}