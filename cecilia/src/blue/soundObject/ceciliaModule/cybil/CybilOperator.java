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

class CybilOperator {

    public static void process(String operator, CybilNoteList cybNoteList,
            int startIndex, int endIndex, CybilArg arg) {

        switch (operator) {
            case "+":
                add(cybNoteList, startIndex, endIndex, arg);
                break;
            case "-":
                subtract(cybNoteList, startIndex, endIndex, arg);
                break;
            case "*":
                multiply(cybNoteList, startIndex, endIndex, arg);
                break;
            case "/":
                divide(cybNoteList, startIndex, endIndex, arg);
                break;
            default:
                break;
        }
    }

    /**
     * @param cybNoteList
     * @param startIndex
     * @param endIndex
     * @param arg
     */
    private static void add(CybilNoteList cybNoteList, int startIndex,
            int endIndex, CybilArg arg) {
        int pfield = cybNoteList.pfield;

        cybNoteList.index = startIndex;

        for (int i = startIndex; i < endIndex; i++) {
            Note note = cybNoteList.notes.get(i);

            double val = Double.parseDouble(note.getPField(pfield));

            val = val + arg.getValue(cybNoteList)[0];

            note.setPField(Double.toString(val), pfield);
            cybNoteList.index++;
        }

        cybNoteList.index = endIndex;
    }

    /**
     * @param cybNoteList
     * @param startIndex
     * @param endIndex
     * @param arg
     */
    private static void subtract(CybilNoteList cybNoteList, int startIndex,
            int endIndex, CybilArg arg) {
        int pfield = cybNoteList.pfield;

        cybNoteList.index = startIndex;

        for (int i = startIndex; i < endIndex; i++) {
            Note note = cybNoteList.notes.get(i);

            double val = Double.parseDouble(note.getPField(pfield));

            val = val - arg.getValue(cybNoteList)[0];

            note.setPField(Double.toString(val), pfield);
            cybNoteList.index++;
        }

        cybNoteList.index = endIndex;
    }

    /**
     * @param cybNoteList
     * @param startIndex
     * @param endIndex
     * @param arg
     */
    private static void multiply(CybilNoteList cybNoteList, int startIndex,
            int endIndex, CybilArg arg) {
        int pfield = cybNoteList.pfield;

        cybNoteList.index = startIndex;

        for (int i = startIndex; i < endIndex; i++) {
            Note note = cybNoteList.notes.get(i);

            double val = Double.parseDouble(note.getPField(pfield));

            val = val * arg.getValue(cybNoteList)[0];

            note.setPField(Double.toString(val), pfield);
            cybNoteList.index++;
        }

        cybNoteList.index = endIndex;
    }

    /**
     * @param cybNoteList
     * @param startIndex
     * @param endIndex
     * @param arg
     */
    private static void divide(CybilNoteList cybNoteList, int startIndex,
            int endIndex, CybilArg arg) {
        int pfield = cybNoteList.pfield;

        cybNoteList.index = startIndex;

        for (int i = startIndex; i < endIndex; i++) {
            Note note = cybNoteList.notes.get(i);

            double val = Double.parseDouble(note.getPField(pfield));

            val = val / arg.getValue(cybNoteList)[0];

            note.setPField(Double.toString(val), pfield);
            cybNoteList.index++;
        }

        cybNoteList.index = endIndex;

    }
}