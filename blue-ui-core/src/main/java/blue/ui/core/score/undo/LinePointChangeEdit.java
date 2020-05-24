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
import blue.components.lines.LinePoint;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

/**
 *
 * @author stevenyi
 */
public class LinePointChangeEdit extends AppendableEdit {

    private final LinePoint sourceRef;
    private final LinePoint sourceCopy;
    private final LinePoint endCopy;
    private final LinePoint removedPoint;
    private final Line line;

    public LinePointChangeEdit(Line line, LinePoint sourceRef, LinePoint sourceCopy, LinePoint endCopy, LinePoint removedPoint) {
        this.line = line;
        this.sourceRef = sourceRef;
        this.sourceCopy = sourceCopy;
        this.endCopy = endCopy;
        this.removedPoint = removedPoint;
    }

     @Override
    public String getPresentationName() {
        return "Line Point Change";
    }

    @Override
    public void redo() throws CannotRedoException {
        sourceRef.setLocation(endCopy.getX(), endCopy.getY());
        
        if(removedPoint != null) {
            line.removeLinePoint(removedPoint);
        }
        
        super.redo(); 
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo(); 
        sourceRef.setLocation(sourceCopy.getX(), sourceCopy.getY());
        
        if(removedPoint != null) {
            var list = line.getObservableList();
            int index = (endCopy.getX() > sourceCopy.getX()) ? 
                    list.indexOf(sourceRef) + 1 : 
                    list.indexOf(sourceRef) - 1;
            list.add(index, removedPoint);
        }
    }
}
