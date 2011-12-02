/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

package blue.soundObject.ceciliaModule.cybil;

import blue.soundObject.Note;
import blue.soundObject.NoteList;

class li extends CybilAlgorithm {

    public float[] getValue(CybilNoteList cybilNoteList) {

        float start = getFloatValue(args.get(0));
        float end = getFloatValue(args.get(1));

        float diff = end - start;

        float timeValue = getTimeValue(args.get(2));
        boolean isTime = isTime(args.get(2));

        NoteList notes = cybilNoteList.notes;

        if (cybilNoteList.pfield == 2) {
            if (isTime) {
                // TODO

            } else {
                for (int i = 0; i < timeValue; i++) {
                    float x = i / (timeValue - 1);

                    float val = (x * diff) + start;
                    String strVal = Float.toString(val);

                    Note currentNote = cybilNoteList.createDefaultNote();
                    notes.add(currentNote);
                    currentNote.setPField(strVal, cybilNoteList.pfield);
                    cybilNoteList.index++;

                    if (cybilNoteList.index >= notes.size()) {
                        break;
                    }
                }
            }
        } else {
            if (isTime) {

            } else {
                for (int i = 0; i < timeValue; i++) {
                    float x = i / (timeValue - 1);

                    float val = (x * diff) + start;
                    String strVal = Float.toString(val);

                    Note currentNote = notes.getNote(cybilNoteList.index);
                    currentNote.setPField(strVal, cybilNoteList.pfield);
                    cybilNoteList.index++;

                    if (cybilNoteList.index >= notes.size()) {
                        break;
                    }
                }
            }
        }

        return null;
    }
}