/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core.mixer;

import blue.mixer.*;
import blue.settings.GeneralSettings;
import blue.ui.utilities.FileChooserManager;
import blue.utility.GenericFileFilter;
import electric.xml.Document;
import electric.xml.Element;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import javax.swing.JFileChooser;
import javax.swing.JOptionPane;
import javax.swing.filechooser.FileFilter;
import org.openide.windows.WindowManager;

public class EffectsUtil {

    private static final String IMPORT_DIALOG = "effect.import";

    private static final String EXPORT_DIALOG = "effect.export";

    static {
        /* setup file choosers */

        File defaultFile = new File(GeneralSettings.getInstance()
                .getDefaultDirectory()
                + File.separator + "default.effect");

        FileFilter presetFilter = new GenericFileFilter("effect",
                "blue Effect File");
        final FileChooserManager fcm = FileChooserManager.getDefault();

        fcm.addFilter(IMPORT_DIALOG, presetFilter);
        fcm.setDialogTitle(IMPORT_DIALOG, "Import Effect");
        fcm.setSelectedFile(IMPORT_DIALOG, defaultFile);

        fcm.addFilter(EXPORT_DIALOG, presetFilter);
        fcm.setDialogTitle(EXPORT_DIALOG, "Export Effect");
        fcm.setSelectedFile(EXPORT_DIALOG, defaultFile);
    }
    public static void exportEffect(Effect effect) {
        int retVal = FileChooserManager.getDefault().showSaveDialog(EXPORT_DIALOG,
                WindowManager.getDefault().getMainWindow());

        if (retVal == JFileChooser.APPROVE_OPTION) {

            File f = FileChooserManager.getDefault().getSelectedFile(EXPORT_DIALOG);

            if (f.exists()) {
                int overWrite = JOptionPane
                        .showConfirmDialog(WindowManager.getDefault().getMainWindow(),
                                "Please confirm you would like to overwrite this file.");

                if (overWrite != JOptionPane.OK_OPTION) {
                    return;
                }
            }

            Element node = effect.saveAsXML();

            PrintWriter out;

            try {
                out = new PrintWriter(new FileWriter(f));
                out.print(node.toString());

                out.flush();
                out.close();
            } catch (IOException ex) {
                ex.printStackTrace();
            }

        }
    }

    public static Effect importEffect() {
        int retVal = FileChooserManager.getDefault().showOpenDialog(IMPORT_DIALOG,
                WindowManager.getDefault().getMainWindow());

        Effect effect = null;

        if (retVal == JFileChooser.APPROVE_OPTION) {

            File f = FileChooserManager.getDefault().getSelectedFile(IMPORT_DIALOG);
            Document doc;

            try {
                doc = new Document(f);
                Element root = doc.getRoot();
                if (root.getName().equals("effect")) {
                    effect = Effect.loadFromXML(root);
                } else {
                    JOptionPane.showMessageDialog(
                            WindowManager.getDefault().getMainWindow(),
                            "Error: File did not contain Effect", "Error",
                            JOptionPane.ERROR_MESSAGE);
                }

            } catch (Exception ex) {
                ex.printStackTrace();
                JOptionPane.showMessageDialog(
                        WindowManager.getDefault().getMainWindow(),
                        "Error: Could not read Effect from file", "Error",
                        JOptionPane.ERROR_MESSAGE);
            }

        }

        return effect;
    }
}
