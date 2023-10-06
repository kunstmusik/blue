package blue.ui.utilities;

import java.awt.Component;
import java.awt.FileDialog;
import java.awt.Frame;
import java.io.File;
import java.io.FilenameFilter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import javax.swing.SwingUtilities;
import javax.swing.filechooser.FileFilter;

public class FileChooserManager {

    private HashMap<Object, FileDialog> fileDialogs
            = new HashMap<>();

    private FilenameFilter directoryFileNameFilter = (dir, file) -> new File(dir, file).isDirectory();

//    private FileChooser fileChooser;
    private static FileChooserManager instance = null;

    public static FileChooserManager getDefault() {
        if (instance == null) {
            instance = new FileChooserManager();
        }
        return instance;
    }

    public void addFilter(Object fileChooserId, FileFilter filter) {
//        DialogInfoSet temp = getDialogInfoSet(fileChooserId);
//        temp.filters.add(filter);
        var dialog = getDialog(fileChooserId);
        // FIXME
//        dialog.setFilenameFilter((dir, name) -> 
//                return filter.accept(new File(dir, name)));
    }

    public void setSelectedFile(Object fileChooserId, File f) {
        getDialog(fileChooserId).setFile(f.getAbsolutePath());
    }

    public void setCurrentDirectory(Object fileChooserId, File f) {
        getDialog(fileChooserId).setDirectory(
                f.isDirectory() ? f.getAbsolutePath()
                : f.getParent());
    }

    public void setDialogTitle(Object fileChooserId, String title) {
        getDialog(fileChooserId).setTitle(title);
    }

    public void setMultiSelectionEnabled(Object fileChooserId, boolean val) {
        getDialog(fileChooserId).setMultipleMode(val);
    }

    public void setDirectoryChooser(Object fileChooserId, boolean isDirectoriesOnly) {
        getDialog(fileChooserId).setFilenameFilter(
                directoryFileNameFilter);
    }

    public List<File> showOpenDialog(Object fileChooserId, Component parent) {
        final var dialog = getDialog(fileChooserId);
        final List<File> retVal = new ArrayList<>();

        final boolean isMac = System.getProperty("os.name").toLowerCase().startsWith(
                "mac");

//        if (isMac) {
        final boolean isSwingEDT = SwingUtilities.isEventDispatchThread();

        Runnable r = () -> {

            dialog.setMode(FileDialog.LOAD);
            
            if (dialog.getFilenameFilter() == directoryFileNameFilter) {
                System.setProperty("apple.awt.fileDialogForDirectories", "true");
            }

            dialog.setVisible(true);

            final File[] files = dialog.getFiles();

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
        final var dialog = getDialog(fileChooserId);
        final boolean isSwingEDT = SwingUtilities.isEventDispatchThread();

        final List<File> retVal = new ArrayList<>();

        // USE AWT IMPL ON MAC DUE TO ISSUES WITH FILE CHOOSER
        // THAT APPEAR TO BE INTRODUCED BY MacOS
        Runnable r = () -> {

            dialog.setMode(FileDialog.SAVE);

            dialog.setVisible(true);

            final File[] files = dialog.getFiles();

            if (files != null && files.length > 0) {
                retVal.add(files[0]);
            };

        };

        if (isSwingEDT) {
            r.run();
        } else {
            SwingUtilities.invokeLater(r);
        }

        return retVal.size() == 0 ? null : retVal.get(0);
    }

    private FileDialog getDialog(Object fileChooserId) {
        var dialog = fileDialogs.get(fileChooserId);

        if (dialog == null) {
            dialog = new FileDialog((Frame) null);
            dialog.setDirectory(System.getProperty("user.home"));

            fileDialogs.put(fileChooserId, dialog);
        }
        return dialog;
    }

    public boolean isDialogDefined(Object fileChooserId) {
        return fileDialogs.containsKey(fileChooserId);

    }

//    public static class DialogInfoSet {
//
//        List<FileFilter> filters = new ArrayList<>();
//
//        File selectedFile;
//
//        File currentDirectory;
//
//        File[] selectedFiles;
//
//        String dialogTitle = "Select File";
//
//        boolean directoriesOnly = false;
//
//        boolean isMultiSelect = false;
//
//    }
}
