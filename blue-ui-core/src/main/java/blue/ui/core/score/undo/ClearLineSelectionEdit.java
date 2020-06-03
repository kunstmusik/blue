/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.score.undo;

import blue.ui.core.score.MultiLineScoreSelection;
import blue.ui.core.score.SingleLineScoreSelection;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

/**
 *
 * @author stevenyi
 */
public class ClearLineSelectionEdit extends AppendableEdit {

    @Override
    public void undo() throws CannotUndoException {
        super.undo(); 
        SingleLineScoreSelection.getInstance().clear();
        MultiLineScoreSelection.getInstance().reset();
    }

    @Override
    public void redo() throws CannotRedoException {
        SingleLineScoreSelection.getInstance().clear();
        MultiLineScoreSelection.getInstance().reset();
        super.redo(); 
    }
    
    
}
