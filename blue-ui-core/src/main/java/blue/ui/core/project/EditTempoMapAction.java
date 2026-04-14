/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2025 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA 02111-1307 USA
 */
package blue.ui.core.project;

import blue.BlueData;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.time.TempoMap;
import blue.time.TimeBase;
import blue.time.TimeContext;
import blue.ui.core.time.TempoMapEditorPanel;
import blue.undo.BlueUndoManager;

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

import javax.swing.undo.AbstractUndoableEdit;

import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;
import org.openide.windows.WindowManager;

/**
 * Action to open the Tempo Map editor dialog.
 * 
 * @author stevenyi
 */
@ActionID(
        category = "Project",
        id = "blue.ui.core.project.EditTempoMapAction"
)
@ActionRegistration(
        displayName = "#CTL_EditTempoMapAction"
)
@ActionReference(path = "Menu/Project", position = 390, separatorBefore = 388)
@Messages("CTL_EditTempoMapAction=Edit Tempo Map...")
public final class EditTempoMapAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();
        
        if (project == null) {
            return;
        }
        
        BlueData data = project.getData();
        
        if (data == null) {
            return;
        }
        
        TimeContext timeContext = data.getScore().getTimeContext();
        TimeBase defaultTimeBase = data.getScore().getTimeState().getTimeDisplay();
        TempoMap currentMap = timeContext.getTempoMap();
        
        TempoMap editedMap = TempoMapEditorPanel.showDialog(
            WindowManager.getDefault().getMainWindow(),
            currentMap,
            timeContext,
            defaultTimeBase
        );
        
        if (editedMap != null) {
            // Snapshot for undo before mutating
            TempoMap oldSnapshot = new TempoMap(currentMap);
            currentMap.replaceAll(editedMap);
            
            BlueUndoManager.addEdit("Edit Tempo Map", new AbstractUndoableEdit() {
                @Override
                public void undo() {
                    super.undo();
                    currentMap.replaceAll(oldSnapshot);
                }
                
                @Override
                public void redo() {
                    super.redo();
                    currentMap.replaceAll(editedMap);
                }
            });
        }
    }
}
