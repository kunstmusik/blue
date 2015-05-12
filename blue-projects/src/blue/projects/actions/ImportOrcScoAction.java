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
import blue.ui.utilities.FileChooserManager;
import blue.utility.CSDUtility;
import java.awt.Frame;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.util.List;
import javafx.stage.FileChooser.ExtensionFilter;
import javax.swing.JFileChooser;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import org.openide.awt.StatusDisplayer;
import org.openide.windows.WindowManager;

public final class ImportOrcScoAction implements ActionListener {

    ExtensionFilter orcFilter = new ExtensionFilter(
            "Csound ORC File (*.orc)", "*.orc");

    ExtensionFilter scoFilter = new ExtensionFilter(
            "Csound SCO File (*.sco)", "*.sco");

    public ImportOrcScoAction() {
        FileChooserManager fcm = FileChooserManager.getDefault();
//        fcm.setAcceptAllFileFilterUsed(false);
        fcm.setMultiSelectionEnabled(orcFilter, false);
        fcm.addFilter(orcFilter, orcFilter);
        fcm.setSelectedFile(orcFilter,
                GeneralSettings.getInstance().getDefaultDirectory());
        fcm.setDialogTitle(scoFilter, "Select ORC File");

        fcm.setMultiSelectionEnabled(scoFilter, false);
        fcm.addFilter(scoFilter, scoFilter);
        fcm.setSelectedFile(scoFilter,
                GeneralSettings.getInstance().getDefaultDirectory());
        fcm.setDialogTitle(scoFilter, "Select SCO File");
    }

    public void actionPerformed(ActionEvent e) {
        SwingUtilities.invokeLater(new Runnable() {
            public void run() {
                importOrcSco();
            }
        });
    }

    public void importOrcSco() {
        final Frame mainWindow = WindowManager.getDefault().getMainWindow();
        List<File> rValue = FileChooserManager.getDefault().showOpenDialog(orcFilter,
                mainWindow);

        if (rValue.isEmpty()) {
            StatusDisplayer.getDefault().setStatusText(BlueSystem.getString(
                    "message.actionCancelled"));
            return;
        }

        File orcFile = rValue.get(0);

        rValue = FileChooserManager.getDefault().showOpenDialog(scoFilter,
                mainWindow);

        if (rValue.isEmpty()) {
            StatusDisplayer.getDefault().setStatusText(BlueSystem.getString(
                    "message.actionCancelled"));
            return;
        }

        File scoFile = rValue.get(0);

        final Object[] values = {BlueSystem.getString("csd.import1"),
            BlueSystem.getString("csd.import2"),
            BlueSystem.getString("csd.import3")};

        Object selectedValue = JOptionPane.showInputDialog(mainWindow,
                BlueSystem.getString("csd.importMethod.message"), BlueSystem.
                getString(
                "csd.importMethod.title"),
                JOptionPane.INFORMATION_MESSAGE, null, values, values[0]);

        if (selectedValue == null) {
            return;
        }

        int modeType = 0;

        for (int i = 0; i < values.length; i++) {
            if (selectedValue == values[i]) {
                modeType = i;
                break;
            }
        }

        BlueData tempData = CSDUtility.convertOrcScoToBlue(orcFile, scoFile,
                modeType);

        if (tempData != null) {
            BlueProject project = new BlueProject(tempData, null);
            BlueProjectManager.getInstance().setCurrentProject(project);
        } else {
            JOptionPane.showMessageDialog(mainWindow, BlueSystem.getString(
                    "message.file.couldNotImport"), BlueSystem.getString(
                    "message.error"), JOptionPane.ERROR_MESSAGE);
        }

    }
}
