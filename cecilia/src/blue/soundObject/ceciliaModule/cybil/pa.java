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

class pa extends CybilFunction {

    @Override
    public double[] getValue(CybilNoteList cybilNoteList) {
        NoteList nl = cybilNoteList.notes;

        int index = Integer.parseInt((String) args.get(0));

        double[] val = new double[1];

        int currentNoteIndex = cybilNoteList.index;
        Note note = cybilNoteList.notes.get(currentNoteIndex);

        val[0] = Double.parseDouble(note.getPField(index));

        return val;

    }
}