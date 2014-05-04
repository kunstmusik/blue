package blue.soundObject.editor;

import blue.score.ScoreObject;
import javax.swing.JComponent;

/**
 * Swing editor component for a ScoreObject.  Should be registered using 
 * ScoreObjectEditorPlugin annotation.
 * 
 * @author steven yi
 * @version 1.0
 */
public abstract class ScoreObjectEditor extends JComponent {

    /**
     * Returns if this editor accepts the object passed in for editing.
     *
     * @param sObj
     * @return
     */
    public abstract boolean accepts(ScoreObject sObj);

    /**
     * Actually edits an object. This method is called after accepts().
     *
     * @param sObj
     */
    public abstract void editScoreObject(ScoreObject sObj);

}
