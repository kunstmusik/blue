/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.projects.actions;

import blue.projects.BlueProjectManager;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

public final class NextProjectAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        BlueProjectManager.getInstance().selectNextProject();
    }
}
