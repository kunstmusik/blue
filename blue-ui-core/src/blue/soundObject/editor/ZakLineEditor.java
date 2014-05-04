/*
 * ZakLineEditor.java
 *
 * Created on July 18, 2005, 9:22 AM
 */

package blue.soundObject.editor;

import blue.components.LineCanvas;
import blue.components.lines.LineListTable;
import blue.plugin.ScoreObjectEditorPlugin;
import blue.score.ScoreObject;
import blue.soundObject.ZakLineObject;
import blue.soundObject.editor.lineEditor.ZakLineListTable;

/**
 * A Line editor of ZakLineObjects. Implementation difference is mainly in
 * member variables.
 * 
 * @author mbechard
 */
@ScoreObjectEditorPlugin
public class ZakLineEditor extends LineEditor {

    /** Creates a new instance of ZakLineEditor */
    public ZakLineEditor() {
        super();
    }

    /**
     * Gets a new LineTable specialized for zak lines
     */
    @Override
    protected LineListTable getNewLineTable() {
        return new ZakLineListTable();
    }

    /**
     * 
     */
    @Override
    protected LineCanvas getNewLineCanvas() {
        return new LineCanvas();
    }


    @Override
    public boolean accepts(ScoreObject sObj) {
        return (sObj != null && sObj instanceof ZakLineObject);
    }
    
    /**
     * Edits the SoundObject, using zak class references when necessary
     */
    @Override
    public void editScoreObject(ScoreObject sObj) {
        if (sObj == null) {
            // this.line = null;

            return;
        }

        if (!(sObj instanceof ZakLineObject)) {
            return;
        }

        ZakLineObject lineObj = (ZakLineObject) sObj;

        lineTable.setLineList(lineObj.getLines());
        lineCanvas.setLineList(lineObj.getLines());
    }
}
