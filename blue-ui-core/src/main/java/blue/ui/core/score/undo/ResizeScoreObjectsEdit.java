/*
 * Created on Aug 10, 2003
 *
 */
package blue.ui.core.score.undo;

import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

import blue.score.ScoreObject;

/**
 * @author steven
 * 
 */
public class ResizeScoreObjectsEdit extends AbstractUndoableEdit {

    private final ScoreObject[] scoreObjects;
    private final StartDurationUnit[] initialTimes;
    private final StartDurationUnit[] finalTimes;

    public ResizeScoreObjectsEdit(ScoreObject[] scoreObjects, StartDurationUnit[] initialTimes,
            StartDurationUnit[] finalTimes) {
        this.scoreObjects = scoreObjects;
        this.initialTimes = initialTimes;
        this.finalTimes = finalTimes;
    }

    @Override
    public void redo() throws CannotRedoException {
        super.redo();

        for (int i = 0; i < scoreObjects.length; i++) {
            scoreObjects[i].setStartTime(finalTimes[i].start());
            scoreObjects[i].setSubjectiveDuration(finalTimes[i].duration());
        }
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        for (int i = 0; i < scoreObjects.length; i++) {
            scoreObjects[i].setStartTime(initialTimes[i].start());
            scoreObjects[i].setSubjectiveDuration(initialTimes[i].duration());
        }
    }

    @Override
    public String getPresentationName() {
        return "Resize ScoreObjects";
    }

}
