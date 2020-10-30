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
public class NoteTimeEdit extends AbstractUndoableEdit {

    private final PianoNote[] notes;
    private final Number[][] originalValues;
    private final Number[][] endValues;


    public NoteTimeEdit(PianoNote[] notes, Number[][] originalValues, Number[][] endValues) {
        this.notes = notes;
        this.originalValues = originalValues;
        this.endValues = endValues;
    }
    
    @Override
    public void redo() throws CannotRedoException {
        for(int i = 0; i < notes.length; i++) {
            notes[i].setStart(endValues[i][0].doubleValue());
            notes[i].setDuration(endValues[i][1].doubleValue());
            notes[i].setOctave(endValues[i][2].intValue());
            notes[i].setScaleDegree(endValues[i][3].intValue());
        }
        super.redo();
    }

    @Override
    public void undo() throws CannotUndoException {
        super.undo();
        for(int i = 0; i < notes.length; i++) {
            notes[i].setStart(originalValues[i][0].doubleValue());
            notes[i].setDuration(originalValues[i][1].doubleValue());
            notes[i].setOctave(originalValues[i][2].intValue());
            notes[i].setScaleDegree(originalValues[i][3].intValue());
        }
    }

    @Override
    public String getPresentationName() {
        return "PianoRoll Note Change";
    }
}
