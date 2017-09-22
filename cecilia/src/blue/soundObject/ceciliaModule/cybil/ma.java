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
    public double[] getValue(CybilNoteList cybilNoteList) {
        String ranType = (String) args.get(0);
        boolean isInteger = ranType.equals("i");

        double startMin = getDoubleValue(args.get(1));
        double startMax = getDoubleValue(args.get(2));
        double endMin = getDoubleValue(args.get(3));
        double endMax = getDoubleValue(args.get(4));

        double minDiff = endMin - startMin;
        double maxDiff = endMax - startMax;

        double timeValue = getTimeValue(args.get(5));
        boolean isTime = isTime(args.get(5));

        NoteList notes = cybilNoteList.notes;

        if (cybilNoteList.pfield == 2) {
            if (isTime) {

            } else {

            }
        } else {
            if (isTime) {
                Note currentNote = notes.get(cybilNoteList.index);
                double startTime = currentNote.getStartTime();
                double endTime = startTime + timeValue;

                int count = getCount(notes, cybilNoteList.index, endTime);

                for (int i = 0; i < count; i++) {

                    double x = (currentNote.getStartTime() - startTime)
                            / timeValue;

                    double min = (minDiff * x) + startMin;
                    double max = (maxDiff * x) + startMax;
                    double diff = max - min;

                    double val = (double) (Math.random() * diff) + min;

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
                    double x = i / timeValue;

                    double min = (minDiff * x) + startMin;
                    double max = (maxDiff * x) + startMax;
                    double diff = max - min;

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