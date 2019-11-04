/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2009 Steven Yi (stevenyi@gmail.com)
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
package blue.projects;

import blue.BlueData;
import blue.BlueSystem;
import blue.ProjectProperties;
import blue.project.ProjectPlugin;
import blue.projects.recentProjects.RecentProjectsList;
import blue.score.Score;
import blue.score.layers.LayerGroup;
import blue.settings.DiskRenderSettings;
import blue.settings.GeneralSettings;
import blue.settings.ProjectDefaultsSettings;
import blue.settings.RealtimeRenderSettings;
import blue.soundObject.PolyObject;
import blue.ui.utilities.FileChooserManager;
import blue.undo.BlueUndoManager;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Vector;
import javafx.stage.FileChooser.ExtensionFilter;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;
import org.openide.awt.StatusDisplayer;
import org.openide.util.Exceptions;
import org.openide.util.lookup.Lookups;
import org.openide.windows.WindowManager;

/**
 *
 * @author steven
 */
public class BlueProjectManager {

//    Logger logger = Logger.getLogger("BlueProjectManager");
    public static final String CURRENT_PROJECT = "currentProject";

    public static final String PROJECT_FILE = "projectFile";

    private static BlueProjectManager instance = null;

    public boolean isProjectStillOpen(BlueProject project) {
        return projects.contains(project);
    }

    ArrayList<BlueProject> projects = new ArrayList<>();

    BlueProject currentProject = null;

    public Vector<PropertyChangeListener> listeners = null;

    public static BlueProjectManager getInstance() {
        if (instance == null) {
            instance = new BlueProjectManager();
        }
        return instance;
    }

    private BlueProjectManager() {
        BlueProject project = createNewProject();

        // TODO - initialize project to defaults from options

        setCurrentProject(project);

        FileChooserManager fcm = FileChooserManager.getDefault();
//        fcm.setAcceptAllFileFilterUsed(false);
        fcm.setMultiSelectionEnabled(this.getClass(), false);
        fcm.addFilter(this.getClass(),
                new ExtensionFilter("blue Project File", "*.blue"));
        fcm.setSelectedFile(this.getClass(),
                new File(
                GeneralSettings.getInstance().getDefaultDirectory() + File.separator + "default.blue"));
    }

    public static BlueProject createNewProject() {
        final BlueData blueData = new BlueData();
        BlueProject project = new BlueProject(blueData, null);

        for(LayerGroup<?> layerGroup : blueData.getScore()) {
            if(layerGroup instanceof PolyObject) {
                PolyObject pObj = (PolyObject)layerGroup;
                pObj.setDefaultHeightIndex(
                        ProjectDefaultsSettings.getInstance().layerHeightDefault);
                
                if(pObj.size() == 0) {
                    pObj.newLayerAt(-1);
                }
            }
        }
        
        blueData.getMixer().setEnabled(
                ProjectDefaultsSettings.getInstance().mixerEnabled);

        ProjectProperties proj = blueData.getProjectProperties();
        proj.author = ProjectDefaultsSettings.getInstance().defaultAuthor;

        RealtimeRenderSettings rtSettings = RealtimeRenderSettings.getInstance();

        proj.sampleRate = rtSettings.defaultSr;
        proj.ksmps = rtSettings.defaultKsmps;
        proj.channels = rtSettings.defaultNchnls;
        proj.useZeroDbFS = rtSettings.useZeroDbFS;
        proj.zeroDbFS = rtSettings.zeroDbFS;

        proj.useAudioOut = rtSettings.audioOutEnabled;
        proj.useAudioIn = rtSettings.audioInEnabled;
        proj.useMidiIn = rtSettings.midiInEnabled;
        proj.useMidiOut = rtSettings.midiOutEnabled;

        proj.noteAmpsEnabled = rtSettings.noteAmpsEnabled;
        proj.outOfRangeEnabled = rtSettings.outOfRangeEnabled;
        proj.warningsEnabled = rtSettings.warningsEnabled;
        proj.benchmarkEnabled = rtSettings.benchmarkEnabled;

        proj.advancedSettings = rtSettings.advancedSettings;

        // proj.commandLine = ProgramOptions.getDefaultCommandline();

        DiskRenderSettings diskSettings = DiskRenderSettings.getInstance();

        proj.diskSampleRate = diskSettings.defaultSr;
        proj.diskKsmps = diskSettings.defaultKsmps;
        proj.diskChannels = diskSettings.defaultNchnls;
        proj.diskUseZeroDbFS = diskSettings.useZeroDbFS;
        proj.diskZeroDbFS = diskSettings.zeroDbFS;

        proj.diskNoteAmpsEnabled = diskSettings.noteAmpsEnabled;
        proj.diskOutOfRangeEnabled = diskSettings.outOfRangeEnabled;
        proj.diskWarningsEnabled = diskSettings.warningsEnabled;
        proj.diskBenchmarkEnabled = diskSettings.benchmarkEnabled;

        proj.diskAdvancedSettings = diskSettings.advancedSettings;

        return project;
    }

    public void setCurrentProject(BlueProject project) {
        BlueProject previousProject = currentProject;
        currentProject = project;

        if (!projects.contains(project)) {
            addProject(project);
        }

        if (currentProject != null) {
            BlueUndoManager.setUndoGroup(project.getUndoManager());

            File f = project.getDataFile();

            BlueSystem.setCurrentBlueData(project.getData());

            if (f != null) {
                BlueSystem.setCurrentProjectDirectory(f.getParentFile());
            } else {
                BlueSystem.setCurrentProjectDirectory(null);
            }
            
            final Score score = project.getData().getScore();
          
            Collection<? extends ProjectPlugin> plugins = 
                    Lookups.forPath("blue/project/plugins").lookupAll(ProjectPlugin.class);
            for(ProjectPlugin plugin : plugins) {
                plugin.preRender(project.getData());
            }
            
            new Thread(() -> {
                try {
                    score.processOnLoad();
                } catch (Exception ex) {
                    Exceptions.printStackTrace(ex);
                }
            }).start();
            
            
        }

        fireUpdatedCurrentProject(previousProject, currentProject);

    }

    public void addProject(BlueProject project) {
        projects.add(project);
    }

    public void closeCurrentProject() {
        if (projects.isEmpty()) {
            return;
        }

        if (saveCheck()) {

            if (currentProject.getTempFile() != null && !currentProject.isOpenedFromTempFile()) {
                currentProject.getTempFile().delete();
            }

            int index = projects.indexOf(currentProject);
            projects.remove(currentProject);

            if (projects.isEmpty()) {
                setCurrentProject(createNewProject());
            } else if (index >= projects.size()) {
                setCurrentProject(projects.get(projects.size() - 1));
            } else {
                setCurrentProject(projects.get(index));
            }
        }

    }

    public BlueProject getCurrentProject() {
        return currentProject;
    }

    public BlueData getCurrentBlueData() {
        if (currentProject == null) {
            return null;
        }
        return currentProject.getData();
    }

    public int getNumProjects() {
        return projects.size();
    }

    // LISTENER CODE
    public synchronized void addPropertyChangeListener(
            PropertyChangeListener pcl) {
        if (listeners == null) {
            listeners = new Vector<>();
        }
        listeners.add(pcl);
    }

    public synchronized void removePropertyChangeListener(
            PropertyChangeListener pcl) {
        if (listeners != null) {
            listeners.remove(pcl);
        }
    }

    protected synchronized void fireUpdatedCurrentProject(BlueProject oldProject, 
            BlueProject newProject) {

        if (listeners == null || listeners.size() == 0) {
            return;
        }

        PropertyChangeEvent pce = new PropertyChangeEvent(this,
                CURRENT_PROJECT, oldProject, newProject);

        for (PropertyChangeListener pcl : listeners) {
            pcl.propertyChange(pce);
        }

    }

    protected synchronized void fireProjectFileChanged() {
        if (listeners == null || listeners.size() == 0) {
            return;
        }

        PropertyChangeEvent pce = new PropertyChangeEvent(this,
                PROJECT_FILE, null, currentProject);

        for (PropertyChangeListener pcl : listeners) {
            pcl.propertyChange(pce);
        }
    }

    public BlueProject findProjectFromFile(File temp) {
        if (temp == null || !temp.exists() || temp.isDirectory()) {
            return null;
        }
        for (BlueProject project : projects) {
            if (temp.equals(project.getDataFile())) {
                return project;
            }
        }
        return null;
    }

    public void save() {
        if (getCurrentProject().getDataFile() != null) {
            try (PrintWriter out = new PrintWriter(new FileWriter(
                    getCurrentProject().getDataFile()))) {

                out.print(getCurrentProject().getData().saveAsXML().toString());

                out.flush();
            } catch (IOException ioe) {

                NotifyDescriptor descriptor = new NotifyDescriptor.Message(
                        "Could not save file:\n\n" + ioe.getLocalizedMessage(),
                        NotifyDescriptor.ERROR_MESSAGE);

                DialogDisplayer.getDefault().notify(descriptor);

            } catch (Exception e) {
                e.printStackTrace();
            }
            StatusDisplayer.getDefault().setStatusText("File saved: "
                    + getCurrentProject().getDataFile().getName());
        } else {
            saveAs();
        }
    }

    public boolean saveAs() {

        FileChooserManager fcm = FileChooserManager.getDefault();

        if (getCurrentProject().getDataFile() != null) {
           fcm.setSelectedFile(this.getClass(), getCurrentProject().getDataFile());
        } else {
           fcm.setSelectedFile(this.getClass(),
                new File(
                GeneralSettings.getInstance().getDefaultDirectory() + File.separator + "default.blue"));
        }

        File rValue = fcm.showSaveDialog(this.getClass(),
                WindowManager.getDefault().getMainWindow());

        if (rValue != null) {
            File temp = rValue;
            if (!(temp.getName().trim().endsWith(".blue"))) {
                temp = new File(temp.getAbsolutePath() + ".blue");
            }

            if (temp.exists()) {
                NotifyDescriptor descriptor = new NotifyDescriptor.Confirmation(
                "Are you sure you would like to overwite the project file: " +
                 temp.getAbsolutePath(),
                "Overwrite Project?");

                Object retVal = DialogDisplayer.getDefault().notify(descriptor);

                if (retVal != NotifyDescriptor.YES_OPTION) {
                    return false;
                }
            }

            if (getCurrentProject().isOpenedFromTempFile()) {
                getCurrentProject().getTempFile().delete();
                getCurrentProject().setOpenedFromTempFile(false);
            }

            try (PrintWriter out = new PrintWriter(new FileWriter(temp))) {

                BlueData data = getCurrentProject().getData();

                out.print(data.saveAsXML().toString());

                out.flush();
            } catch (Exception e) {
                NotifyDescriptor descriptor = new NotifyDescriptor.Message(
                        "Could not save file:\n\n" + e.getLocalizedMessage(),
                        NotifyDescriptor.ERROR_MESSAGE);

                DialogDisplayer.getDefault().notify(descriptor);
            }
            StatusDisplayer.getDefault().setStatusText("File saved: " + temp.
                    getName());
//                ProgramOptions.addRecentFile(temp);
//                blueMenuBar.resetRecentFiles();
//                ProgramOptions.save();
//
RecentProjectsList.getInstance().addFile(temp.getAbsolutePath());
// fileName = temp;

getCurrentProject().setDataFile(temp);
BlueSystem.setCurrentProjectDirectory(temp.getParentFile());
temp = null;
fireProjectFileChanged();

//                this.setTitle(BlueConstants.getVersion() + " - " + currentDataFile.dataFile.
//                        getName());
//                setRevertEnabled();
            return true;
//        } 
//        else if (rValue == JFileChooser.CANCEL_OPTION) {
//            StatusBar.updateStatus(BlueSystem.getString(
//                    "message.actionCancelled"));
//            return false;
        } else {
            return false;
        }
    }

    public boolean closeAllFiles() {
        while (this.projects.size() > 0) {
            if (saveCheck()) {
                int index = projects.indexOf(currentProject);
                projects.remove(currentProject);

                if (currentProject.getTempFile() != null) {
                    currentProject.getTempFile().delete();
                }

                if (projects.size() == 0) {
                    return true;
                } else if (index >= projects.size()) {
                    setCurrentProject(projects.get(projects.size() - 1));
                } else {
                    setCurrentProject(projects.get(index));
                }
            } else {
                return false;
            }
        }
        return true;
    }

    public BlueProject getProject(int i) {
        return projects.get(i);
    }

    private boolean saveCheck() {

        NotifyDescriptor descriptor = new NotifyDescriptor.Confirmation(
                "Do you wish to save the current project?",
                "Save Project?");

        Object retVal = DialogDisplayer.getDefault().notify(descriptor);

        if (retVal == NotifyDescriptor.YES_OPTION) {
            if (getCurrentProject().getDataFile() != null) {
                save();
                return true;
            }

            return (saveAs());

        } else if (retVal == NotifyDescriptor.NO_OPTION) {
            return true;
        }

        return false;
    }

    public void selectNextProject() {
        if (projects.size() < 2 || currentProject == null) {
            return;
        }

        int index = projects.indexOf(currentProject) + 1;

        if (index >= projects.size()) {
            index = 0;
        }

        setCurrentProject(projects.get(index));
    }

    public void selectPreviousProject() {
        if (projects.size() < 2 || currentProject == null) {
            return;
        }

        int index = projects.indexOf(currentProject) - 1;

        if (index < 0) {
            index = projects.size() - 1;
        }

        setCurrentProject(projects.get(index));
    }

}
