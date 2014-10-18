/*
 * blue - object composition environment for csound Copyright (c) 2000-2014
 * Steven Yi (stevenyi@gmail.com)
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
package blue.ui.core;

import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;

/**
 *
 * @author syi
 */
public class BackupFileSaver implements Runnable {
    // private long waitTime = 5 * 60 * 1000;

    private final long waitTime = 60 * 1000;

    boolean shouldRun = true;

    private BlueProjectManager projectManager;

    public BackupFileSaver() {
        this.projectManager = BlueProjectManager.getInstance();
    }

    public void run() {
        while (shouldRun) {

            saveFileBackups();

            try {
                Thread.sleep(waitTime);
            } catch (InterruptedException e) {
                shouldRun = false;
            }
        }
    }

    private void saveFileBackups() {

        for (int i = 0; i < projectManager.getNumProjects(); i++) {
            BlueProject bdf = projectManager.getProject(i);

            if (bdf.getDataFile() != null && !bdf.isOpenedFromTempFile()) {

                if (bdf.getTempFile() == null) {
                    bdf.setTempFile(new File(
                            bdf.getDataFile().getAbsolutePath() + "~"));
                }

                try {
                    PrintWriter out = new PrintWriter(new FileWriter(
                            bdf.getTempFile()));

                    out.print(bdf.getData().saveAsXML().toString());

                    out.flush();
                    out.close();
                } catch (IOException ioe) {
                    // String errorMessage = BlueSystem
                    // .getString("message.file.couldNotSave")
                    // + "\n\n" + ioe.getLocalizedMessage();
                    // JOptionPane.showMessageDialog(null, errorMessage,
                    // BlueSystem
                    // .getString("message.error"),
                    // JOptionPane.ERROR_MESSAGE);
                    // StatusBar.updateStatus(BlueSystem
                    // .getString("message.file.couldNotSave")
                    // + " - " + ioe.getLocalizedMessage());
                    } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    public void quitFileSaver() {
        shouldRun = false;
    }
}
