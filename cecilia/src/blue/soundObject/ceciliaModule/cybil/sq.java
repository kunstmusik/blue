/*
 * blue - object composition environment for csound Copyright (c) 2000-2004
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

package blue.soundObject.ceciliaModule.cybil;

import blue.soundObject.Note;
import blue.soundObject.NoteList;

class sq extends CybilAlgorithm {

    // TODO - Need to implement
    @Override
    public float[] getValue(CybilNoteList cybilNoteList) {

        String time = (String) args.get(args.size() - 1);

        float timeValue = getTimeValue(time);
        boolean isTime = isTime(time);

        if (!isTime) {
            timeValue = timeValue * (args.size() - 1);
        }

        NoteList notes = cybilNoteList.notes;

        int index = 0;

        if (cybilNoteList.pfield == 2) {
            if (isTime) {
                if (notes.size() == 0) {
                    notes.add(cybilNoteList.createDefaultNote());
                }

                float startTime = cybilNoteList.p2time;
                float timeLimit = startTime + timeValue;

                while (true) {
                    Object obj = args.get(index);

                    if (obj instanceof CybilAlgorithm) {
                        ((CybilAlgorithm) obj).getValue(cybilNoteList);
                    } else {

                        float val = getFloatValue(obj);

                        if (cybilNoteList.p2time + val > timeLimit) {
                            break;
                        }

                        cybilNoteList.p2time += val;

                        String strVal = Float.toString(cybilNoteList.p2time);

                        Note currentNote = cybilNoteList.createDefaultNote();
                        notes.add(currentNote);
                        currentNote.setPField(strVal, cybilNoteList.pfield);
                        cybilNoteList.index++;

                    }

                    index++;
                    if (index >= args.size() - 1) {
                        index = 0;
                    }

                }

                // remove any extra notes that may have been generated
                while (true) {
                    if (notes.size() == 0) {
                        break;
                    }

                    Note note = (Note) notes.get(notes.size() - 1);

                    if (note.getStartTime() < timeLimit) {
                        break;
                    }

                    notes.remove(note);
                    cybilNoteList.index--;

                }
            } else {
                if (notes.size() == 0) {
                    notes.add(cybilNoteList.createDefaultNote());
                }
                for (int i = 0; i < timeValue; i++) {
                    Object obj = args.get(index);

                    if (obj instanceof CybilAlgorithm) {
                        ((CybilAlgorithm) obj).getValue(cybilNoteList);
                    } else {

                        float val = getFloatValue(obj);
                        cybilNoteList.p2time += val;

                        String strVal = Float.toString(cybilNoteList.p2time);

                        Note currentNote = cybilNoteList.createDefaultNote();
                        notes.add(currentNote);
                        currentNote.setPField(strVal, cybilNoteList.pfield);
                        cybilNoteList.index++;

                    }

                    index++;
                    if (index >= args.size() - 1) {
                        index = 0;
                    }

                }
            }
        } else {

            if (cybilNoteList.index >= notes.size()) {
                return null;
            }

            if (isTime) {
                Note currentNote = notes.get(cybilNoteList.index);
                float startTime = currentNote.getStartTime();
                float endTime = startTime + timeValue;

                int count = getCount(notes, cybilNoteList.index, endTime);

                for (int i = 0; i < count; i++) {
                    Object obj = args.get(index);

                    if (obj instanceof CybilAlgorithm) {
                        ((CybilAlgorithm) obj).getValue(cybilNoteList);
                    } else {

                        float val = getFloatValue(obj);

                        String strVal = Float.toString(val);

                        currentNote = notes.get(cybilNoteList.index);
                        currentNote.setPField(strVal, cybilNoteList.pfield);
                        cybilNoteList.index++;

                    }

                    index++;
                    if (index >= args.size() - 1) {
                        index = 0;
                    }

                    if (cybilNoteList.index >= notes.size()) {
                        break;
                    }
                }
            } else {
                for (int i = 0; i < timeValue; i++) {
                    Object obj = args.get(index);

                    if (obj instanceof CybilAlgorithm) {
                        ((CybilAlgorithm) obj).getValue(cybilNoteList);
                    } else {

                        float val = getFloatValue(obj);

                        Note currentNote = notes.get(cybilNoteList.index);

                        String strVal = Float.toString(val);
                        currentNote.setPField(strVal, cybilNoteList.pfield);

                        cybilNoteList.index++;
                    }

                    index++;
                    if (index >= args.size() - 1) {
                        index = 0;
                    }

                    if (cybilNoteList.index >= notes.size()) {
                        break;
                    }

                }
            }
        }

        // TODO Auto-generated method stub
        return null;
    }
}