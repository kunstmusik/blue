/*
 * Created on Aug 10, 2003
 *
 */
package blue.ui.core.score.undo;

import blue.BlueSystem;
import blue.score.ScoreObject;
import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;
import javax.swing.undo.UndoableEdit;

/**
 * @author steven
 * 
 */
public class ResizeScoreObjectsEdit extends AbstractUndoableEdit {

    private final ScoreObject[] scoreObjects;
    private final StartEndTime[] initialTimes;
    private final StartEndTime[] finalTimes;

    public ResizeScoreObjectsEdit(ScoreObject[] scoreObjects, StartEndTime[] initialTimes, StartEndTime[] finalTimes) {
        this.scoreObjects = scoreObjects;
        this.initialTimes = initialTimes;
        this.finalTimes = finalTimes;        
    }

    @Override
    public void redo() throws CannotRedoException {
        super.redo();
        
        for(int i = 0; i < scoreObjects.length; i++) {
            scoreObjects[i].setStartTime(finalTimes[i].start);
            scoreObjects[i].setSubjectiveDuration(finalTimes[i].end - finalTimes[i].start);
        }
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        for(int i = 0; i < scoreObjects.length; i++) {
            scoreObjects[i].setStartTime(initialTimes[i].start);
            scoreObjects[i].setSubjectiveDuration(initialTimes[i].end - initialTimes[i].start);
        }
    }

    @Override
    public String getPresentationName() {
        return "Resize ScoreObjects";
    }

}
