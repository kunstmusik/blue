/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
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
package blue.projects.actions;

import blue.BlueData;
import blue.BlueSystem;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.settings.GeneralSettings;
import blue.soundObject.NoteParseException;
import blue.soundObject.PolyObject;
import blue.ui.utilities.FileChooserManager;
import blue.utility.midi.MidiImportUtilities;
import java.awt.Frame;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.util.List;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import javax.swing.filechooser.FileNameExtensionFilter;
import org.openide.awt.StatusDisplayer;
import org.openide.windows.WindowManager;

public final class ImportMidiAction implements ActionListener {

    public ImportMidiAction() {
           FileChooserManager fcm = FileChooserManager.getDefault();
//        fcm.setAcceptAllFileFilterUsed(false);
        fcm.setMultiSelectionEnabled(this.getClass(), false);
        fcm.addFilter(this.getClass(),
                new FileNameExtensionFilter("MIDI File (*.mid, *.midi)", "mid", "midi"));
        fcm.setSelectedFile(this.getClass(),
                GeneralSettings.getInstance().getDefaultDirectory());
        fcm.setDialogTitle(this.getClass(), "Select MIDI File");
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        SwingUtilities.invokeLater(this::importMidiFile);
    }

    public void importMidiFile() {
        final Frame mainWindow = WindowManager.getDefault().getMainWindow();
        List<File> rValue = FileChooserManager.getDefault().showOpenDialog(this.getClass(), mainWindow);

        if (rValue.size() == 0) {
            StatusDisplayer.getDefault().setStatusText(BlueSystem.getString(
                    "message.actionCancelled"));
            return;
        }
        File midiFile = rValue.get(0);

        BlueData tempData = new BlueData();

        try {
            PolyObject pObj = MidiImportUtilities.convertMidiFile(mainWindow, midiFile);
            if (pObj == null) {
                JOptionPane.showMessageDialog(mainWindow, BlueSystem.getString(
                        "message.file.couldNotImport"), BlueSystem.getString(
                        "message.error"), JOptionPane.ERROR_MESSAGE);
                return;
            }
            tempData.getScore().clear();
            tempData.getScore().add(pObj);
        } catch (NoteParseException e) {
            JOptionPane.showMessageDialog(mainWindow, BlueSystem.getString(
                    "message.file.couldNotImport"), BlueSystem.getString(
                    "message.error"), JOptionPane.ERROR_MESSAGE);
            return;
        }

        BlueProject project = new BlueProject(tempData, null);
        BlueProjectManager.getInstance().setCurrentProject(project);

    }
}
