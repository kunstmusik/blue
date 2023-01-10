package blue.ui.utilities;

import java.awt.Component;
import java.awt.FileDialog;
import java.awt.Frame;
import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import javax.swing.SwingUtilities;
import javax.swing.filechooser.FileFilter;

public class FileChooserManager {

    private HashMap<Object, DialogInfoSet> dialogInfoSets
            = new HashMap<>();

//    private FileChooser fileChooser;
    private static FileChooserManager instance = null;

    public static FileChooserManager getDefault() {
        if (instance == null) {
            instance = new FileChooserManager();
        }
        return instance;
    }

    public void addFilter(Object fileChooserId, FileFilter filter) {
        DialogInfoSet temp = getDialogInfoSet(fileChooserId);
        temp.filters.add(filter);
    }

    public void setSelectedFile(Object fileChooserId, File f) {
        DialogInfoSet temp = getDialogInfoSet(fileChooserId);
        temp.currentDirectory = null;
        temp.selectedFile = f;
    }

    public void setCurrentDirectory(Object fileChooserId, File f) {
        DialogInfoSet temp = getDialogInfoSet(fileChooserId);
        temp.selectedFile = null;
        temp.currentDirectory = f;
    }

    public void setDialogTitle(Object fileChooserId, String title) {
        DialogInfoSet temp = getDialogInfoSet(fileChooserId);
        temp.dialogTitle = title;
    }

    public void setMultiSelectionEnabled(Object fileChooserId, boolean val) {
        DialogInfoSet temp = getDialogInfoSet(fileChooserId);
        temp.isMultiSelect = val;
    }

    public void setDirectoryChooser(Object fileChooserId, boolean isDirectoriesOnly) {
        DialogInfoSet temp = getDialogInfoSet(fileChooserId);
        temp.directoriesOnly = isDirectoriesOnly;
    }

    public List<File> showOpenDialog(Object fileChooserId, Component parent) {
        final DialogInfoSet temp = getDialogInfoSet(fileChooserId);
        final List<File> retVal = new ArrayList<>();

        final boolean isMac = System.getProperty("os.name").toLowerCase().startsWith(
                "mac");

//        if (isMac) {
        final boolean isSwingEDT = SwingUtilities.isEventDispatchThread();

        Runnable r = () -> {
            // USE AWT IMPL ON MAC DUE TO ISSUES WITH FILE CHOOSER
            // THAT APPEAR TO BE INTRODUCED BY MacOS
            java.awt.FileDialog ff = new java.awt.FileDialog((Frame) SwingUtilities.windowForComponent(parent));

            ff.setFilenameFilter((dir, name)
                    -> true
            );

            ff.setMode(FileDialog.LOAD);
            ff.setTitle(temp.dialogTitle);
            ff.setMultipleMode(temp.isMultiSelect);

            if (temp.currentDirectory != null) {
                ff.setDirectory(temp.currentDirectory.getAbsolutePath());
            } else if (temp.selectedFile != null) {
                if(temp.selectedFile.getParentFile() != null) {
                    ff.setDirectory(temp.selectedFile.getParentFile().getAbsolutePath());
                }
            }
            if (temp.selectedFile != null) {
                ff.setFile(temp.selectedFile.getName());
            }

            if (temp.directoriesOnly) {
                System.setProperty("apple.awt.fileDialogForDirectories", "true");
            }

            ff.setVisible(true);

            final File[] files = ff.getFiles();

            System.setProperty("apple.awt.fileDialogForDirectories", "false");

            if (files != null) {
                for (File f : files) {
                    retVal.add(f);
                }
            }

        };

        if (isSwingEDT) {
            r.run();
        } else {
            SwingUtilities.invokeLater(r);
        }

        return retVal;
    }

    public File showSaveDialog(Object fileChooserId, Component parent) {
        DialogInfoSet temp = getDialogInfoSet(fileChooserId);
        final boolean isSwingEDT = SwingUtilities.isEventDispatchThread();

        final List<File> retVal = new ArrayList<>();

        // USE AWT IMPL ON MAC DUE TO ISSUES WITH FILE CHOOSER
        // THAT APPEAR TO BE INTRODUCED BY MacOS
        Runnable r = () -> {
            java.awt.FileDialog ff = new java.awt.FileDialog((Frame) SwingUtilities.windowForComponent(parent));

            ff.setFilenameFilter((File dir, String name)
                    -> true
            );

            ff.setMode(FileDialog.SAVE);
            ff.setTitle(temp.dialogTitle);
//        ff.setMultipleMode(temp.isMultiSelect);

            if (temp.currentDirectory != null) {
                ff.setDirectory(temp.currentDirectory.getAbsolutePath());
            } else if (temp.selectedFile != null) {
                ff.setDirectory(temp.selectedFile.getParentFile().getAbsolutePath());
            }
            if (temp.selectedFile != null) {
                ff.setFile(temp.selectedFile.getName());
            }

            ff.setVisible(true);

            final File[] files = ff.getFiles();

            if (files != null && files.length > 0) {
                retVal.add(files[0]);
            };

        };

        if (isSwingEDT) {
            r.run();
        } else {
            SwingUtilities.invokeLater(r);
        }

        return retVal.get(0);
    }

    private DialogInfoSet getDialogInfoSet(Object fileChooserId) {
        if (dialogInfoSets.containsKey(fileChooserId)) {
            DialogInfoSet infoSet = dialogInfoSets.get(fileChooserId);
            return infoSet;
        } else {
            DialogInfoSet temp = new DialogInfoSet();

            temp.selectedFile = new File(System.getProperty("user.home"));
            temp.currentDirectory = new File(System.getProperty("user.home"));

            dialogInfoSets.put(fileChooserId, temp);

            return temp;
        }
    }

    public boolean isDialogDefined(Object fileChooserId) {
        return dialogInfoSets.containsKey(fileChooserId);

    }

    public static class DialogInfoSet {

        List<FileFilter> filters = new ArrayList<>();

        File selectedFile;

        File currentDirectory;

        File[] selectedFiles;

        String dialogTitle = "Select File";

        boolean directoriesOnly = false;

        boolean isMultiSelect = false;

    }
}
