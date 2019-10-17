/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

import blue.BlueSystem;
import blue.soundObject.ceciliaModule.ModuleDefinition;
import blue.ui.utilities.FileChooserManager;
import blue.utility.TextUtilities;
import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.List;
import javafx.stage.FileChooser.ExtensionFilter;
import javax.swing.JFileChooser;

public class CeciliaModuleImportDialog {
    private static final String FILE_IMPORT = "ceciliaModuleImportDialog";

    private static final ExtensionFilter fileFilter;

    static {
        fileFilter = new ExtensionFilter("blue Cecilia Module (*.bcm)", "*.bcm");
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

        List<File> retVal = FileChooserManager.getDefault().showOpenDialog(FILE_IMPORT, null);

        if (retVal.isEmpty()) {
            return null;
        }

        File temp = retVal.get(0);
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
