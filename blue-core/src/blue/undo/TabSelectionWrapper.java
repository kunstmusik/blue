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

import javax.swing.JTabbedPane;
import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;
import javax.swing.undo.UndoableEdit;

public class TabSelectionWrapper extends AbstractUndoableEdit {

    private UndoableEdit edit;

    private JTabbedPane tabs;

    private int index;

    public TabSelectionWrapper(UndoableEdit edit, JTabbedPane tabs) {
        this.edit = edit;
        this.tabs = tabs;
        this.index = tabs.getSelectedIndex();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.undo.AbstractUndoableEdit#redo()
     */
    public void redo() throws CannotRedoException {
        tabs.setSelectedIndex(index);
        edit.redo();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.undo.AbstractUndoableEdit#undo()
     */
    public void undo() throws CannotUndoException {
        tabs.setSelectedIndex(index);
        edit.undo();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.undo.AbstractUndoableEdit#canRedo()
     */
    public boolean canRedo() {
        return edit.canRedo();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.undo.AbstractUndoableEdit#canUndo()
     */
    public boolean canUndo() {
        return edit.canUndo();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.undo.AbstractUndoableEdit#getPresentationName()
     */
    public String getPresentationName() {
        return edit.getPresentationName();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.undo.AbstractUndoableEdit#getRedoPresentationName()
     */
    public String getRedoPresentationName() {
        return edit.getRedoPresentationName();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.undo.AbstractUndoableEdit#getUndoPresentationName()
     */
    public String getUndoPresentationName() {
        return edit.getUndoPresentationName();
    }
}