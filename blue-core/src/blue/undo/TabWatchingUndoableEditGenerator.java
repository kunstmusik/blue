/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.undo;

import javax.swing.JTabbedPane;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;
import javax.swing.undo.AbstractUndoableEdit;
import javax.swing.undo.CannotRedoException;
import javax.swing.undo.CannotUndoException;
import javax.swing.undo.UndoManager;

/**
 *
 * @author stevenyi
 */
public class TabWatchingUndoableEditGenerator {

    JTabbedPane jTabbedPane;
    int currentTab;
    private final UndoManager undo;
    private boolean processingUndoRedo = false;

    public TabWatchingUndoableEditGenerator(JTabbedPane tabs, UndoManager undoManager) {
        this.jTabbedPane = tabs;
        currentTab = tabs.getSelectedIndex();
        this.undo = undoManager;
        tabs.addChangeListener(new ChangeListener() {
            public void stateChanged(ChangeEvent e) {
                if (!processingUndoRedo) {
                    undo.addEdit(new TabSwitchUndoableEdit(jTabbedPane,
                            currentTab,
                            jTabbedPane.getSelectedIndex()));

                    currentTab = jTabbedPane.getSelectedIndex();
                }
            }
        });
    }

    class TabSwitchUndoableEdit extends AbstractUndoableEdit {

        private final int previousTab;
        private final int nextTab;
        private final JTabbedPane tabs;

        public TabSwitchUndoableEdit(JTabbedPane tabs, int previousTab, int nextTab) {
            this.tabs = tabs;
            this.previousTab = previousTab;
            this.nextTab = nextTab;
        }

        @Override
        public void undo() throws CannotUndoException {
            processingUndoRedo = true;
            tabs.setSelectedIndex(previousTab);
            processingUndoRedo = false;
        }

        @Override
        public void redo() throws CannotRedoException {
            processingUndoRedo = true;
            tabs.setSelectedIndex(nextTab);
            processingUndoRedo = false;
        }

        @Override
        public boolean isSignificant() {
            return false;
        }
    }
}
