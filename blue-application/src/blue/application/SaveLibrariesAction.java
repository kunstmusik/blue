/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.application;

import blue.BlueSystem;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

public final class SaveLibrariesAction implements ActionListener {

    public void actionPerformed(ActionEvent e) {
        BlueSystem.saveUDOLibrary();
        BlueSystem.saveUserInstrumentLibrary();
    }
}
