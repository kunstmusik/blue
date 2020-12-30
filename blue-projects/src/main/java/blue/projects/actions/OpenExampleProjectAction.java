/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.projects.actions;

import blue.BlueData;
import blue.BlueSystem;
import blue.projects.*;
import blue.projects.recentProjects.RecentProjectsList;
import blue.score.Score;
import blue.score.layers.LayerGroup;
import blue.settings.GeneralSettings;
import blue.soundObject.AudioFile;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.utilities.FileChooserManager;
import blue.utility.TextUtilities;
import electric.xml.Document;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.io.File;
import java.io.FileNotFoundException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Map.Entry;
import java.util.logging.Logger;
import javafx.stage.FileChooser.ExtensionFilter;
import javax.swing.JFileChooser;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;
import org.openide.awt.StatusDisplayer;
import org.openide.util.Exceptions;
import org.openide.windows.WindowManager;

public final class OpenExampleProjectAction implements ActionListener {

    private static final Logger logger = Logger.getLogger("OpenExampleProjectAction");

    private static AudioFileDependencyDialog dependencyDialog = null;

    public OpenExampleProjectAction() {
        FileChooserManager fcm = FileChooserManager.getDefault();
//        fcm.setAcceptAllFileFilterUsed(false);
        fcm.setMultiSelectionEnabled(this.getClass(), true);
        fcm.addFilter(this.getClass(),
                new ExtensionFilter("blue Project File (*.blue)", "*.blue"));
    }
    
    protected String getPath() {
        String val = System.getProperty("netbeans.dirs");
        String[] vals = val.split(File.pathSeparator);

        for (String path : vals) {

            int index = path.indexOf(".app/Contents");

            if (index > 0) {
                path = path.substring(0, index + 4);
                String retVal = path + "/examples";
                retVal = retVal.replaceAll(" ", "%20");
                return retVal;
            }

            File f = new File(path + File.separator + "pythonLib");
            if (f.isDirectory()) {
                path = path.substring(0, path.lastIndexOf(File.separator));
                path = path.replaceAll("\\\\", "/");
                String retVal = path + "/examples";
                retVal = retVal.replaceAll(" ", "%20");
                return retVal;
            }
        }

        return null;
    }

    @Override
    public void actionPerformed(ActionEvent e) {

        FileChooserManager fcm = FileChooserManager.getDefault();
        System.out.println("PATH: " + getPath());
        fcm.setCurrentDirectory(this.getClass(),
                new File(getPath()));
        
        List<File> rValue = fcm.showOpenDialog(this.getClass(),
                WindowManager.getDefault().getMainWindow());
        if (rValue.size() > 0) {
            BlueProjectManager projectManager = BlueProjectManager.getInstance();

            for (File temp : rValue) {

                if (temp.getName().trim().endsWith(".patterns")) {
//                    openPatternsFile(temp);
                } else {

                    if (!(temp.getName().trim().endsWith(".blue"))) {
                        temp = new File(temp.getAbsolutePath() + ".blue");
                    }

                    BlueProject project = projectManager.findProjectFromFile(
                            temp);

                    if (project != null) {
                        projectManager.setCurrentProject(project);
                        continue;
                    }

                    open(temp);
                }
            }

        } else {
            StatusDisplayer.getDefault().setStatusText("No files selected.");
        }

    }

    public static void open(File selected) {

        File absoluteSelected = selected.getAbsoluteFile();

        File temp = absoluteSelected;

        File backup = new File(absoluteSelected.getAbsolutePath() + "~");

        boolean wasTempFile = false;

        if (backup.exists() && backup.lastModified() > temp.lastModified()) {
            String message = "A backup work file was found. This should only " + "occur if blue did not close successfully.\n\n" + "Would you like to open the backup file?\n\n" + "If you open the backup file, it will be required to " + "\"Save as\" the file to overwrite your old work.)";
            NotifyDescriptor descriptor = new NotifyDescriptor.Confirmation(
                    message, NotifyDescriptor.YES_NO_CANCEL_OPTION);

            Object retVal = DialogDisplayer.getDefault().notify(descriptor);

            if (retVal == NotifyDescriptor.YES_OPTION) {
                temp = backup;
                wasTempFile = true;
            } else if (retVal == NotifyDescriptor.CANCEL_OPTION) {
                return;
            }
        }

        try {

            String text = TextUtilities.getTextFromFile(temp);

            BlueData tempData;

            if (text.startsWith("<blueData")) {
                Document d = new Document(text);
                tempData = BlueData.loadFromXML(d.getElement("blueData"));
            } else {
                return;
//                JOptionPane.showMessageDialog(this, BlueSystem.getString(
//                        "blue.pre94"));
//
//                XMLSerializer xmlSer = new XMLSerializer();
//                BufferedReader xmlIn = new BufferedReader(
//                        new StringReader(text));
//
//                tempData = (BlueData) xmlSer.read(xmlIn);
//
//                xmlIn.close();
//                tempData.upgradeData();
            }

//            InstrumentLibrary iLibrary = tempData.getInstrumentLibrary();
//
//            if (iLibrary != null) {
//                tempData.normalizeArrangement();
//                tempData.setInstrumentLibrary(null);
//
//                // TODO - TRANSLATE
//                String message = "This project contains an InstrumentLibrary \n" + "which is no longer being used in blue. The project's\n " + "orchestra will be updated to have individual copies of\n " + "each instrument from the library. \n\n" + "Upon saving, the InstrumentLibrary in this project will\n" + "no longer be accessible.\n\n" + "Would you like to import a copy of your library into " + "your user InstrumentLibrary?";
//
//                int retVal = JOptionPane.showConfirmDialog(this, message);
//
//                if (retVal == JOptionPane.YES_OPTION) {
//                    BlueSystem.getUserInstrumentLibrary().importLibrary(
//                            iLibrary);
//                }
//            }
            BlueProject project;

            if (wasTempFile) {
                project = new BlueProject(tempData, null);
                project.setTempFile(temp);
                project.setOpenedFromTempFile(true);
            } else {
                project = new BlueProject(tempData, temp);
            }

            BlueProjectManager projectManager = BlueProjectManager.getInstance();
            projectManager.setCurrentProject(project);

            if (!temp.getAbsolutePath().endsWith("~")) {
                RecentProjectsList.getInstance().addFile(temp.getAbsolutePath());
            }
//            this.blueDataFileArray.add(bdf);

            temp = null;

            // StatusBar.updateStatus(selected.getName() + " opened.");
            checkDependencies(tempData);

        } catch (FileNotFoundException fe) {

            String message = "Error: Could not open " + temp.toString();

            StatusDisplayer.getDefault().setStatusText(message);

            NotifyDescriptor descriptor = new NotifyDescriptor.Message(message,
                    NotifyDescriptor.ERROR_MESSAGE);

            DialogDisplayer.getDefault().notify(descriptor);

        } catch (Exception e) {
            Exceptions.printStackTrace(e);
            StatusDisplayer.getDefault().setStatusText(
                    "Error: Could not open " + temp.
                    toString());
        }

    }

    private static void checkDependencies(BlueData tempData) {
        Score score = tempData.getScore();

        ArrayList<String> filesList = new ArrayList<>();

        for (LayerGroup<?> layerGroup : score) {

            if (!(layerGroup instanceof PolyObject)) {
                continue;
            }

            PolyObject pObj = (PolyObject) layerGroup;

            checkAudioFiles(pObj, filesList);
        }

        if (filesList.size() > 0) {
            if (dependencyDialog == null) {
                dependencyDialog = new AudioFileDependencyDialog();
            }

            dependencyDialog.setFilesList(filesList);

            if (dependencyDialog.ask()) {

                Map<String, String> map = dependencyDialog.getFilesMap();

                if (map == null || map.size() == 0) {
                    return;
                }

                for ( Entry<String, String> entry : map.entrySet()) {
                    String key = entry.getKey();
                    String val = entry.getValue();

                    val = BlueSystem.getRelativePath(val);

                    entry.setValue(val);
                }

                System.out.println(map);

                for (LayerGroup<?> layerGroup : score) {

                    if (!(layerGroup instanceof PolyObject)) {
                        continue;
                    }

                    PolyObject pObj = (PolyObject) layerGroup;

                    reconcileAudioFiles(pObj, map);
                }
            }
        }

    }

    private static void checkAudioFiles(PolyObject pObj, ArrayList<String> filesList) {
        for (Iterator<SoundObject> iter = pObj.getSoundObjects(true).iterator(); iter.hasNext();) {
            SoundObject sObj = iter.next();
            if (sObj instanceof AudioFile) {
                AudioFile af = (AudioFile) sObj;

                String soundFileName = af.getSoundFileName();
                if (soundFileName == null) {
                    continue;
                }

                if (BlueSystem.findFile(soundFileName) == null) {
                    if (!filesList.contains(soundFileName)) {
                        filesList.add(soundFileName);
                    }
                }
            } else if (sObj instanceof PolyObject) {
                checkAudioFiles((PolyObject) sObj, filesList);
            }
        }
    }

    private static void reconcileAudioFiles(PolyObject pObj, Map<String, String> map) {
        for (SoundObject sObj : pObj.getSoundObjects(true)) {
            if (sObj instanceof AudioFile) {
                AudioFile af = (AudioFile) sObj;

                String soundFileName = af.getSoundFileName();

                if (map.containsKey(soundFileName)) {
                    af.setSoundFileName(map.get(soundFileName));
                }
            } else if (sObj instanceof PolyObject) {
                reconcileAudioFiles((PolyObject) sObj, map);
            }
        }

    }
}
