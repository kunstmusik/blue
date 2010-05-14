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

package blue.undo;

import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;
import javax.swing.undo.UndoManager;

/**
 * @author Steven Yi
 */
public class NoStyleChangeUndoManager extends UndoManager {

    public synchronized void redo() throws CannotRedoException {
        try {
            super.redo();
            while (getRedoPresentationName().equals("Redo style change")) {
                super.redo();
            }

        } catch (CannotRedoException ex) {
        }
    }

    public synchronized void undo() throws CannotUndoException {
        try {
            while (getUndoPresentationName().equals("Undo style change")) {
                super.undo();
            }
            super.undo();
        } catch (CannotUndoException ex) {
        }

    }
}