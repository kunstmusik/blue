/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
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
package blue.ui.core.score.object.actions;

import blue.soundObject.Instance;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.utilities.FileChooserManager;
import electric.xml.Element;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import javax.swing.JFileChooser;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.ExportAction")
@ActionRegistration(
        displayName = "#CTL_ExportAction")
@Messages("CTL_ExportAction=E&xport")
@ActionReference(path = "blue/score/actions", position = 500)
public final class ExportAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {

//        int retVal = FileChooserManager.getDefault().showSaveDialog(
//                EXPORT_DIALOG, SwingUtilities.getRoot(sCanvas));
//
//        if (retVal == JFileChooser.APPROVE_OPTION) {
//
//            File f = FileChooserManager.getDefault().getSelectedFile(
//                    EXPORT_DIALOG);
//
//            if (f.exists()) {
//                int overWrite = JOptionPane.showConfirmDialog(
//                        SwingUtilities.getRoot(sCanvas),
//                        "Please confirm you would like to overwrite this file.");
//
//                if (overWrite != JOptionPane.OK_OPTION) {
//                    return;
//                }
//            }
//
//            SoundObject sObj = sObjView.getSoundObject();
//
//            if ((sObj instanceof Instance) || ((sObj instanceof PolyObject) && containsInstance(
//                    (PolyObject) sObj))) {
//                JOptionPane.showMessageDialog(
//                        SwingUtilities.getRoot(sCanvas),
//                        "Error: Export of Instance or " + "PolyObjects containing Instance " + "is not allowed.",
//                        "Error", JOptionPane.ERROR_MESSAGE);
//                return;
//            }
//
//            Element node = sObj.saveAsXML(null);
//
//            PrintWriter out;
//
//            try {
//                out = new PrintWriter(new FileWriter(f));
//                out.print(node.toString());
//
//                out.flush();
//                out.close();
//            } catch (IOException ex) {
//                ex.printStackTrace();
//            }
//
//        }
    }
}

