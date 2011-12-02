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
import blue.soundObject.NoteParseException;

class CybilNoteList {

    public NoteList notes = new NoteList();

    public String instrumentId = "x";

    public int numPfields = 3;

    float p2time = 0.0f;

    float p2timeLimit = -1.0f;

    public int pfield = 0;

    public int index = 0;

    Note defaultNote = null;

    public Note createDefaultNote() {
        Note retVal = null;

        // Lazy initialization and caching
        if (defaultNote == null) {
            StringBuffer buffer = new StringBuffer();
            buffer.append("i");
            buffer.append(instrumentId);

            for (int i = 0; i < numPfields - 1; i++) {
                buffer.append(" 0");
            }

            try {
                defaultNote = Note.createNote(buffer.toString());
            } catch (NoteParseException e) {
                // TODO Auto-generated catch block
                e.printStackTrace();
            }

            // System.err.println("Default Note: " + defaultNote.toString());
            // System.err.println("Num Pfields: " + numPfields);
        }

        retVal = (Note) defaultNote.clone();
        return retVal;

    }

}