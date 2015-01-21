/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core.score.undo;

import blue.BlueSystem;
import blue.score.ScoreObject;
import java.awt.Color;
import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;
import javax.swing.undo.UndoableEdit;

/**
 *
 * @author stevenyi
 */
public class SetColorEdit extends AbstractUndoableEdit {
    private final ScoreObject sObj;
    private final Color oldColor;
    private final Color newColor;

    private SetColorEdit nextEdit = null;

    public SetColorEdit(ScoreObject sObj, Color oldColor, Color newColor) {
        this.sObj = sObj;
        this.oldColor = oldColor;
        this.newColor = newColor;
    }

    @Override
    public void redo() throws CannotRedoException {
        super.redo();
        sObj.setBackgroundColor(newColor);

        if (nextEdit != null) {
            nextEdit.redo();
        }
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        sObj.setBackgroundColor(oldColor);

        if (nextEdit != null) {
            nextEdit.undo();
        }
    }

    @Override
    public String getPresentationName() {
        return BlueSystem.getString("Set ScoreObject Color");
    }

    @Override
    public boolean addEdit(UndoableEdit anEdit) {
        if (anEdit instanceof SetColorEdit) {
            if (nextEdit == null) {
                nextEdit = (SetColorEdit) anEdit;
                return true;
            } else {
                return nextEdit.addEdit(anEdit);
            }
        }
        return false;
    }

}
