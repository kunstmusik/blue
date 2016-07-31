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
package blue.ui.core;

import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.File;
import java.io.FilenameFilter;
import javax.swing.JOptionPane;
import org.openide.windows.WindowManager;

/**
 *
 * @author stevenyi
 */
public class TempFileCleaner implements PropertyChangeListener {

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        BlueProjectManager bpm = BlueProjectManager.getInstance();
        BlueProject currentProject = bpm.getCurrentProject();
        
        if(currentProject.isTempCsdFilesChecked()) {
            return;
        }
        
        currentProject.setTempCsdFilesChecked(true);

        File curProjFile = currentProject.getDataFile();
        
        if(curProjFile == null) {
            return;
        }
        
        File parentProjDir = curProjFile.getParentFile();
        
        int size = bpm.getNumProjects();
        boolean otherOpenProjectsFound = false;
        
        for(int i = 0; i < size; i++) {
            BlueProject project = bpm.getProject(i);
            if(project != currentProject) {
                
                if(project.getDataFile() != null) {
                    File parentDir = project.getDataFile().getParentFile();
                    if(parentDir.equals(parentProjDir)) {
                        otherOpenProjectsFound = true;
                        break;
                    }
                }
            }
        }
        
        if(otherOpenProjectsFound) {
            return;
        }
        
        File[] tempFiles = parentProjDir.listFiles((File dir, String name) -> name.startsWith("tempCsd") && name.endsWith(".csd"));
        
        if(tempFiles.length > 0) {
            int retVal = JOptionPane.showConfirmDialog(
                    WindowManager.getDefault().getMainWindow(),
                        "Temporary CSD files were found.  These are "
                        + "probably from a previous Blue session that crashed.  Would you like to "
                        + "delete these?", "Temp CSD Files Found", JOptionPane.YES_NO_OPTION);
            
            if(retVal == JOptionPane.YES_OPTION) {
                deleteTempFiles(tempFiles);
            }
        }
    }
    
    public void deleteTempFiles(File[] tempFiles) {
        int filesDeleted = 0;
        for(File f : tempFiles) {
            if(!f.delete()) {
                JOptionPane.showMessageDialog(WindowManager.getDefault().getMainWindow(), 
                        "Unable to delete temp file: " + f.getAbsolutePath(), 
                        "Error",
                        JOptionPane.ERROR_MESSAGE);
            } else {
                filesDeleted++;
            }
        }
        JOptionPane.showMessageDialog(WindowManager.getDefault().getMainWindow(), 
            "Deleted " + filesDeleted + " temp files out of " + 
                tempFiles.length + " found.", "Complete",
                        JOptionPane.INFORMATION_MESSAGE);
    }
}
