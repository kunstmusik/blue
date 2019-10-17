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
public class MoveScoreObjectsEdit extends AbstractUndoableEdit {

    private ScoreObject[] scoreObjects;

    private ScoreObjectLayer[] startLayers;

    private ScoreObjectLayer[] endLayers;

    private double[] initialStartTimes;

    private double[] endingStartTimes;

    private String presentationName = null;

    public MoveScoreObjectsEdit(ScoreObject[] soundObjects,
            ScoreObjectLayer[] startLayers, ScoreObjectLayer[] endLayers,
            double[] initialStartTimes, double[] endingStarttimes) {

        this.scoreObjects = soundObjects;
        this.startLayers = startLayers;
        this.endLayers = endLayers;
        this.initialStartTimes = initialStartTimes;
        this.endingStartTimes = endingStarttimes;

    }

    @Override
    public void redo() throws CannotRedoException {
        super.redo();
        for (int i = 0; i < scoreObjects.length; i++) {
            ScoreObject scoreObj = scoreObjects[i];

            if (endingStartTimes != null) {
                scoreObj.setStartTime(this.endingStartTimes[i]);
            }

            if (startLayers != null && endLayers != null
                    && startLayers[i] != endLayers[i]) {
                startLayers[i].remove(scoreObj);
                endLayers[i].add(scoreObj);
            }
        }
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();

        for (int i = 0; i < scoreObjects.length; i++) {
            ScoreObject scoreObj = scoreObjects[i];

            if (initialStartTimes != null) {
                scoreObj.setStartTime(this.initialStartTimes[i]);
            }

            if (startLayers != null && endLayers != null
                    && startLayers[i] != endLayers[i]) {
                endLayers[i].remove(scoreObj);
                startLayers[i].add(scoreObj);
            }
        }
    }

    @Override
    public String getPresentationName() {
        if (presentationName != null) {
            return presentationName;
        }
        if (scoreObjects.length > 1) {
            return BlueSystem.getString("scoreGUI.action.moveSoundObjects");
        }
        return BlueSystem.getString("scoreGUI.action.moveSoundObject");

    }

    public void setPresentationName(String presentationName) {
        this.presentationName = presentationName;
    }

}
