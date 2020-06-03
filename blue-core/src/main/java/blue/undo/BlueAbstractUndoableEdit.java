/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

package blue.undo;

import javax.swing.undo.AbstractUndoableEdit;

/**
 * UndoableEdit base class that starts the Edit in a state to allow redo to be
 * called. Useful for creating edits to be called from Actions so that code does
 * not need to be duplicated.
 * 
 * @author Steven Yi
 */

public class BlueAbstractUndoableEdit extends AbstractUndoableEdit {
    public BlueAbstractUndoableEdit() {
        super();
        super.undo();
    }
}
