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

package blue.ui.core.score.noteProcessorChain;

import blue.noteProcessor.NoteProcessor;

class NoteProcessorEditProxy {

    private final String name;

    private final int startRow;
    private final int endRow;

    private final NoteProcessor np;

    public NoteProcessorEditProxy(NoteProcessor np, int startRow, int endRow) {
        this.np = np;
        // this.name = "<html><b><font color=#ffc800>" + np.toString() +
        // "</font></b></html>";
        this.name = "<html><b>" + np.toString() + "</b></html>";
        this.startRow = startRow;
        this.endRow = endRow;
    }

    public NoteProcessor getNoteProcessor() {
        return this.np;
    }

    public String getName() {
        return name;
    }

    public int getStartRow() {
        return startRow;
    }

    public int getEndRow() {
        return endRow;
    }

}