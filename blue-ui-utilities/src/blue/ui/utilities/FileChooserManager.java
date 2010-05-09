package blue.ui.utilities;

import java.awt.Component;
import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;

import javax.swing.JFileChooser;
import javax.swing.filechooser.FileFilter;

public class FileChooserManager {

    private HashMap<Object, DialogInfoSet> dialogInfoSets =
            new HashMap<Object, DialogInfoSet>();

    private JFileChooser fileChooser = new JFileChooser();

    private static FileChooserManager instance = null;

    public static FileChooserManager getDefault() {
        if(instance == null) {
            instance = new FileChooserManager();
        }
        return instance;
    }

//    private static AudioFilePreview audioFilePreview = new AudioFilePreview(
//            swingFileChooser);
    private JFileChooser getFileChooser() {
        if (fileChooser == null) {
            fileChooser = new JFileChooser();
            fileChooser.setAcceptAllFileFilterUsed(true);
        }
        return fileChooser;
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

    public int showOpenDialog(Object fileChooserId, Component parent) {
        DialogInfoSet temp = getDialogInfoSet(fileChooserId);

        JFileChooser swingFileChooser = getFileChooser();

        swingFileChooser.resetChoosableFileFilters();
        for (int i = 0; i < temp.filters.size(); i++) {
            FileFilter f = temp.filters.get(i);
            swingFileChooser.addChoosableFileFilter(f);
        }

        if(temp.selectedFile != null) {
            swingFileChooser.setSelectedFile(temp.selectedFile);
        }
        if(temp.currentDirectory != null) {
            swingFileChooser.setCurrentDirectory(temp.currentDirectory);
        }
        
        swingFileChooser.setDialogTitle(temp.dialogTitle);
        swingFileChooser.setMultiSelectionEnabled(temp.isMultiSelect);

        int retVal = swingFileChooser.showOpenDialog(parent);

        if (temp.isMultiSelect) {
            temp.selectedFile = null;
            temp.selectedFiles = swingFileChooser.getSelectedFiles();
        } else {
            temp.selectedFile = swingFileChooser.getSelectedFile();
            temp.selectedFiles = null;
        }

//        audioFilePreview.stop();

        return retVal;
    }

    public int showSaveDialog(Object fileChooserId, Component parent) {
        DialogInfoSet temp = getDialogInfoSet(fileChooserId);

        JFileChooser swingFileChooser = getFileChooser();

        swingFileChooser.resetChoosableFileFilters();
        for (int i = 0; i < temp.filters.size(); i++) {
            FileFilter f = temp.filters.get(i);
            swingFileChooser.addChoosableFileFilter(f);
        }

        if(temp.selectedFile != null) {
            swingFileChooser.setSelectedFile(temp.selectedFile);
        }
        if(temp.currentDirectory != null) {
            swingFileChooser.setCurrentDirectory(temp.currentDirectory);
        }
        
        swingFileChooser.setDialogTitle(temp.dialogTitle);
        swingFileChooser.setMultiSelectionEnabled(temp.isMultiSelect);

        int retVal = swingFileChooser.showSaveDialog(parent);

        if (temp.isMultiSelect) {
            temp.selectedFile = null;
            temp.selectedFiles = swingFileChooser.getSelectedFiles();
        } else {
            temp.selectedFile = swingFileChooser.getSelectedFile();
            temp.selectedFiles = null;
        }

//        audioFilePreview.stop();

        return retVal;
    }

    public File getSelectedFile(Object fileChooserId) {
        DialogInfoSet temp = getDialogInfoSet(fileChooserId);
        return temp.selectedFile;
    }

    public File[] getSelectedFiles(Object fileChooserId) {
        DialogInfoSet temp = getDialogInfoSet(fileChooserId);
        return temp.selectedFiles;
    }

    private DialogInfoSet getDialogInfoSet(Object fileChooserId) {
        if (dialogInfoSets.containsKey(fileChooserId)) {
            DialogInfoSet infoSet = dialogInfoSets.get(fileChooserId);
            return infoSet;
        } else {
            DialogInfoSet temp = new DialogInfoSet();

            temp.selectedFile = new File(System.getProperty("user.home"));

            dialogInfoSets.put(fileChooserId, temp);

            return temp;
        }
    }

    public boolean isDialogDefined(Object fileChooserId) {
        return dialogInfoSets.containsKey(fileChooserId);
    }

//    private static class AudioFilePreview extends JComponent implements
//            PropertyChangeListener {
//
//        private final JFileChooser jfc;
//
//        private final SoundFilePlayer sfPlayer = new SoundFilePlayer();
//
//        public AudioFilePreview(JFileChooser jfc) {
//            this.jfc = jfc;
//            this.setLayout(new BorderLayout());
//            this.add(sfPlayer, BorderLayout.CENTER);
//            jfc.addPropertyChangeListener(this);
//
//            this.setPreferredSize(new Dimension(300, 200));
//        }
//
//        public void propertyChange(PropertyChangeEvent evt) {
//            File file = jfc.getSelectedFile();
//            sfPlayer.setSoundFile(file);
//        }
//
//        public void stop() {
//            sfPlayer.stop();
//        }
//    }
    public static class DialogInfoSet {

        ArrayList<FileFilter> filters = new ArrayList<FileFilter>();

        File selectedFile;

        File currentDirectory;

        File[] selectedFiles;

        String dialogTitle = "Select File";

        boolean directoriesOnly = false;

        boolean isMultiSelect = false;

    }
}
