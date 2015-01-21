/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.tools;

import blue.ui.core.tools.csoundrc.CsoundRCDialog;
import blue.utility.GUI;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;
import org.openide.windows.WindowManager;

@ActionID(category = "Application",
id = "blue.ui.core.tools.OpenCsoundRCEditorAction")
@ActionRegistration(displayName = "#CTL_OpenCsoundRCEditorAction")
@ActionReferences({
    @ActionReference(path = "Menu/Tools", position = 87)
})
@Messages("CTL_OpenCsoundRCEditorAction=.csoundrc Editor")
public final class OpenCsoundRCEditorAction implements ActionListener {
    
    @Override
    public void actionPerformed(ActionEvent e) {
        CsoundRCDialog dialog = new CsoundRCDialog(WindowManager.getDefault().getMainWindow(), true);
        GUI.centerOnScreen(dialog);
        dialog.setVisible(true);
    }
}
