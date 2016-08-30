/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.projects.actions;

import blue.projects.BlueProject;
import blue.projects.BlueProjectManager;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

public final class NewProjectAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        final BlueProjectManager blueProjectManager = BlueProjectManager.
                getInstance();
        BlueProject project = BlueProjectManager.createNewProject();
        blueProjectManager.setCurrentProject(project);
    }
}
