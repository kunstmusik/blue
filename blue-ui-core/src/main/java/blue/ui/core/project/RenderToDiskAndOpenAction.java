/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
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
package blue.ui.core.project;

import blue.BlueData;
import blue.BlueSystem;
import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import blue.settings.DiskRenderSettings;
import blue.ui.core.render.ProcessConsole;
import blue.ui.core.soundFile.AudioFilePlayerTopComponent;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;
import org.openide.windows.WindowManager;

public final class RenderToDiskAndOpenAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        BlueProject project = BlueProjectManager.getInstance().getCurrentProject();

        if (project != null) {
            BlueData data = project.getData();

            if (data != null) {
                RenderToDiskUtility.getInstance().renderToDisk(data, 
                        f -> {
                            DiskRenderSettings settings = 
                                    DiskRenderSettings.getInstance();

                                String command = settings.externalOpenCommand;
//                                command = command.replaceAll("\\$outfile",
//                                        f.getAbsolutePath());

                                try {
                                    if (System.getProperty("os.name").contains("Windows")) {
                                        String p = f.getAbsolutePath().replace("\\", "\\\\");
                                        command = command.replaceAll("\\$outfile", p);
                                        Runtime.getRuntime().exec(command);
                                    } else {
                                        command = command.replaceAll("\\$outfile",
                                        f.getAbsolutePath());
                                        String[] cmdArray = ProcessConsole.
                                        splitCommandString(command);
                                        Runtime.getRuntime().exec(cmdArray);
                                    }

                                    System.out.println(command);
                                } catch (Exception ex) {
                                    JOptionPane.showMessageDialog(
                                            WindowManager.getDefault().getMainWindow(),
                                            "Could not run command: " + command,
                                            "Error",
                                            JOptionPane.ERROR_MESSAGE);
                                    System.err.println("[" + BlueSystem.getString(
                                            "message.error") + "] - " + ex.
                                            getLocalizedMessage());
                                    ex.printStackTrace();
                                }
                            
                        });
            }

        }
    }
}
