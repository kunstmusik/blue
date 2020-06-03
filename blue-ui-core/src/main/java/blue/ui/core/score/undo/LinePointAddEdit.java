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
public class LinePointAddEdit extends AppendableEdit {

    private final Line line;
    private final LinePoint linePoint;
    private final int index;
    private final LinePoint removedPoint;

    public LinePointAddEdit(Line line, LinePoint linePoint, int index,
            LinePoint removedPoint) {
        this.line = line;
        this.linePoint = linePoint;
        this.index = index;
        this.removedPoint = removedPoint;
    }

    @Override
    public String getPresentationName() {
        return "Line Point Add";
    }

    @Override
    public void redo() throws CannotRedoException {
        line.addLinePoint(index, linePoint);
        if (removedPoint != null) {
            line.removeLinePoint(removedPoint);
        }
        super.redo();
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        line.removeLinePoint(linePoint);
        if(removedPoint != null) {
            line.addLinePoint(index, removedPoint);
        }
    }
}
