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
package blue.soundObject.editor.pianoRoll.undo;

import blue.BlueSystem;
import blue.soundObject.PianoRoll;
import blue.soundObject.pianoRoll.PianoNote;
import java.util.List;
import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;

/**
 *
 * @author Steven Yi
 */
public class AddNotesEdit extends AbstractUndoableEdit {

    private final PianoRoll pianoRoll;
    private final List<PianoNote> notes;

    public AddNotesEdit(PianoRoll p, List<PianoNote> notes) {
        this.pianoRoll = p;
        this.notes = notes;
    }
    
    @Override
    public void redo() throws CannotRedoException {
        pianoRoll.getNotes().addAll(notes);
        super.redo();
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        pianoRoll.getNotes().removeAll(notes);
    }

    @Override
    public String getPresentationName() {
        return "Add PianoRoll Notes";
    }
}
