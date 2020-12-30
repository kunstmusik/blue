/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.soundObject.editor.pianoRoll;

import blue.soundObject.PianoRoll;
import blue.soundObject.pianoRoll.PianoNote;
import java.util.ArrayList;
import java.util.List;

/**
 *
 * @author stevenyi
 */
public class NoteCopyBuffer {

    private PianoRoll sourcePianoRoll = null;
    private List<PianoNote> copiedNotes = new ArrayList<>();

    private static NoteCopyBuffer INSTANCE;

    private NoteCopyBuffer() {
    }

    public static NoteCopyBuffer getInstance() {
        if (INSTANCE == null) {
            INSTANCE = new NoteCopyBuffer();
        }
        return INSTANCE;
    }

    public void setSourcePianoRoll(PianoRoll sourcePianoRoll) {
        this.sourcePianoRoll = sourcePianoRoll;
    }   
    
    public PianoRoll getSourcePianoRoll() {
        return sourcePianoRoll;
    }

    public List<PianoNote> getCopiedNotes() {
        return copiedNotes;
    }

    public void clear() {
        this.sourcePianoRoll = null;
        copiedNotes.clear();
    }

}
