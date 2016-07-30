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

class ma extends CybilAlgorithm {

    @Override
    public float[] getValue(CybilNoteList cybilNoteList) {
        String ranType = (String) args.get(0);
        boolean isInteger = ranType.equals("i");

        float startMin = getFloatValue(args.get(1));
        float startMax = getFloatValue(args.get(2));
        float endMin = getFloatValue(args.get(3));
        float endMax = getFloatValue(args.get(4));

        float minDiff = endMin - startMin;
        float maxDiff = endMax - startMax;

        float timeValue = getTimeValue(args.get(5));
        boolean isTime = isTime(args.get(5));

        NoteList notes = cybilNoteList.notes;

        if (cybilNoteList.pfield == 2) {
            if (isTime) {

            } else {

            }
        } else {
            if (isTime) {
                Note currentNote = notes.get(cybilNoteList.index);
                float startTime = currentNote.getStartTime();
                float endTime = startTime + timeValue;

                int count = getCount(notes, cybilNoteList.index, endTime);

                for (int i = 0; i < count; i++) {

                    float x = (currentNote.getStartTime() - startTime)
                            / timeValue;

                    float min = (minDiff * x) + startMin;
                    float max = (maxDiff * x) + startMax;
                    float diff = max - min;

                    double val = (float) (Math.random() * diff) + min;

                    String strVal = isInteger ? Integer.toString((int) val)
                            : Double.toString(val);

                    currentNote.setPField(strVal, cybilNoteList.pfield);

                    cybilNoteList.index++;

                    if (cybilNoteList.index >= notes.size()) {
                        break;
                    }
                    currentNote = notes.get(cybilNoteList.index);

                }

            } else {
                for (int i = 0; i < timeValue; i++) {
                    float x = i / timeValue;

                    float min = (minDiff * x) + startMin;
                    float max = (maxDiff * x) + startMax;
                    float diff = max - min;

                    double val = (Math.random() * diff) + min;

                    String strVal = isInteger ? Integer.toString((int) val)
                            : Double.toString(val);

                    Note currentNote = notes.get(cybilNoteList.index);
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