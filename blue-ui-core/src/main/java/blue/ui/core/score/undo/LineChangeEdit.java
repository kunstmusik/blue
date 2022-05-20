/*
 * blue - object composition environment for csound 
 * Copyright (c) 2020
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.ui.core.score.undo;

import blue.components.lines.Line;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

/**
 *
 * @author stevenyi
 */
public class LineChangeEdit extends AppendableEdit {

    // using copies of Line as they do deep copies of line points
    private final Line sourceRef;
    private final Line sourceCopy;
    private final Line endCopy;

    public LineChangeEdit(Line sourceRef, Line sourceCopy, Line endCopy) {
        this.sourceRef = sourceRef;
        this.sourceCopy = sourceCopy;
        this.endCopy = endCopy;
    }

    @Override
    public String getPresentationName() {
        return "Line Data Change";
    }

    @Override
    public void redo() throws CannotRedoException {
        var newLine = new Line(endCopy);
        sourceRef.setLinePoints(newLine.getObservableList());
        super.redo(); 
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo(); 
        var newLine = new Line(sourceCopy);
        sourceRef.setLinePoints(newLine.getObservableList());
    }

    
}
