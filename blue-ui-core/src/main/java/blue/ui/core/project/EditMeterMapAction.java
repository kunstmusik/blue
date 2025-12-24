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
import blue.time.MeterMap;
import blue.time.TimeContext;
import blue.ui.core.time.MeterMapEditorPanel;
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
 * Action to open the Meter Map editor dialog.
 * 
 * @author stevenyi
 */
@ActionID(
        category = "Project",
        id = "blue.ui.core.project.EditMeterMapAction"
)
@ActionRegistration(
        displayName = "#CTL_EditMeterMapAction"
)
@ActionReference(path = "Menu/Project", position = 395)
@Messages("CTL_EditMeterMapAction=Edit Time Signature Map...")
public final class EditMeterMapAction implements ActionListener {

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
        MeterMap currentMap = timeContext.getMeterMap();
        
        MeterMap editedMap = MeterMapEditorPanel.showDialog(
            WindowManager.getDefault().getMainWindow(),
            currentMap
        );
        
        if (editedMap != null) {
            // Create undoable edit
            MeterMap oldMap = new MeterMap(currentMap);
            timeContext.setMeterMap(editedMap);
            
            BlueUndoManager.addEdit("Edit Meter Map", new AbstractUndoableEdit() {
                @Override
                public void undo() {
                    super.undo();
                    timeContext.setMeterMap(oldMap);
                }
                
                @Override
                public void redo() {
                    super.redo();
                    timeContext.setMeterMap(editedMap);
                }
            });
        }
    }
}
