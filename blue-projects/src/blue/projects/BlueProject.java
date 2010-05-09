/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.projects;

import blue.BlueData;
import java.io.File;
import java.util.HashMap;
import javax.swing.undo.UndoManager;

/**
 *
 * @author steven
 */
public class BlueProject {

    private BlueData data;

    private boolean openedFromTempFile;

    private File dataFile;

    private File tempFile;

    private final HashMap<String, UndoManager> undo = new HashMap<String, UndoManager>();

    public BlueProject(BlueData data, File dataFile) {
        this.data = data;
        this.dataFile = dataFile;
        this.tempFile = null;
    }

    /**
     * @return the data
     */
    public BlueData getData() {
        return data;
    }

    /**
     * @param data the data to set
     */
    public void setData(BlueData data) {
        this.data = data;
    }

    /**
     * @return the wasTempFile
     */
    public boolean isOpenedFromTempFile() {
        return openedFromTempFile;
    }

    /**
     * @param wasTempFile the wasTempFile to set
     */
    public void setOpenedFromTempFile(boolean openedFromTempFile) {
        this.openedFromTempFile = openedFromTempFile;
    }

    /**
     * @return the dataFile
     */
    public File getDataFile() {
        return dataFile;
    }

    /**
     * @param dataFile the dataFile to set
     */
    public void setDataFile(File dataFile) {
        this.dataFile = dataFile;
    }

    /**
     * @return the tempFile
     */
    public File getTempFile() {
        return tempFile;
    }

    /**
     * @param tempFile the tempFile to set
     */
    public void setTempFile(File tempFile) {
        this.tempFile = tempFile;
    }

    public HashMap<String, UndoManager> getUndoManager() {
        return this.undo;
    }

}
