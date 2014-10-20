/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

package blue.soundObject.editor.ceciliaModule;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

import javax.swing.JFileChooser;

import blue.BlueSystem;
import blue.soundObject.ceciliaModule.ModuleDefinition;
import blue.ui.utilities.FileChooserManager;
import blue.utility.GenericFileFilter;
import blue.utility.TextUtilities;

public class CeciliaModuleImportDialog {
    private static final String FILE_IMPORT = "ceciliaModuleImportDialog";

    private static final GenericFileFilter fileFilter;

    static {
        fileFilter = new GenericFileFilter("bcm", "blue Cecilia Module (*.bcm)");
        FileChooserManager.getDefault().setDialogTitle(FILE_IMPORT, BlueSystem
                .getString("ceciliaModule.openFileTitle"));
        String libFolder = BlueSystem.getLibDir() + File.separator
                + "ceciliaModule/";
        FileChooserManager.getDefault().setSelectedFile(FILE_IMPORT, new File(libFolder));
        FileChooserManager.getDefault().addFilter(FILE_IMPORT, fileFilter);
    }

    private CeciliaModuleImportDialog() {
    }

    public static ModuleDefinition importCeciliaModule() {

        int retVal = FileChooserManager.getDefault().showOpenDialog(FILE_IMPORT, null);

        if (retVal != JFileChooser.APPROVE_OPTION) {
            return null;
        }

        File temp = FileChooserManager.getDefault().getSelectedFile(FILE_IMPORT);
        return convertCeciliaModule(temp);

    }

    /**
     * @param ceciliaFile
     * @return
     */
    public static ModuleDefinition convertCeciliaModule(File ceciliaFile) {
        String moduleText;

        try {
            moduleText = TextUtilities.getTextFromFile(ceciliaFile);
        } catch (FileNotFoundException e) {
            return null;
        } catch (IOException e) {
            return null;
        }

        ModuleDefinition moduleDefinition = new ModuleDefinition();

        moduleDefinition.info = TextUtilities.getTextBetweenTags("info",
                moduleText);
        moduleDefinition.tk_interface = TextUtilities.getTextBetweenTags(
                "tk_interface", moduleText);
        moduleDefinition.mono = TextUtilities.getTextBetweenTags("mono",
                moduleText);
        moduleDefinition.stereo = TextUtilities.getTextBetweenTags("stereo",
                moduleText);
        moduleDefinition.quad = TextUtilities.getTextBetweenTags("quad",
                moduleText);
        moduleDefinition.score = TextUtilities.getTextBetweenTags("score",
                moduleText);

        return moduleDefinition;
    }
}
