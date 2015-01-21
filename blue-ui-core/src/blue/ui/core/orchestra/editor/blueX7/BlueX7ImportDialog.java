package blue.ui.core.orchestra.editor.blueX7;

import blue.orchestra.BlueX7;
import blue.ui.utilities.FileChooserManager;
import java.io.File;
import javax.swing.JFileChooser;
import javax.swing.JOptionPane;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class BlueX7ImportDialog {
    private static final String FILE_IMPORT = "blueX7ImportDialog";

    static {
        FileChooserManager.getDefault().setDialogTitle(FILE_IMPORT, "Open DX7 Sysex File");
    }

    public BlueX7ImportDialog() {
    }

    public static void importFromDX7File(BlueX7 blueX7) {

        int retVal = FileChooserManager.getDefault().showOpenDialog(FILE_IMPORT, null);
        byte[] sysex;

        if (retVal != JFileChooser.APPROVE_OPTION) {
            return;
        }

        File temp = FileChooserManager.getDefault().getSelectedFile(FILE_IMPORT);
        sysex = BlueX7SysexReader.fileToByteArray(temp);

        if (sysex == null) {
            JOptionPane.showMessageDialog(null,
                    "Could not read file as DX7 sysex.", "Error Importing",
                    JOptionPane.ERROR_MESSAGE);
            return;
        }

        int sysexType = BlueX7SysexReader.getSysexType(sysex);

        if (sysexType == BlueX7SysexReader.SINGLE) {
            BlueX7SysexReader.importFromSinglePatch(blueX7, sysex);
        } else if (sysexType == BlueX7SysexReader.BANK) {
            String[] patches = BlueX7SysexReader.getNameListFromBank(sysex);
            Object selectedValue = JOptionPane.showInputDialog(null,
                    "Choose Patch from Bank", "Input",
                    JOptionPane.INFORMATION_MESSAGE, null, patches, patches[0]);

            int patchNum = 0;
            for (int i = 0; i < patches.length; i++) {
                if (patches[i] == selectedValue) {
                    patchNum = i;
                    break;
                }
            }

            BlueX7SysexReader.importFromBank(blueX7, sysex, patchNum);

            System.out.println("selected patch was: " + patchNum + " : "
                    + patches[patchNum]);

        } else {
            JOptionPane.showMessageDialog(null,
                    "Could not read file as DX7 sysex.", "Error Importing",
                    JOptionPane.ERROR_MESSAGE);
            return;
        }

    }

    public static void main(String[] args) {
        // BlueX7ImportDialog blueX7ImportDialog1 = new BlueX7ImportDialog();
    }
}