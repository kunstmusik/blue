/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.project.stems;

import java.awt.Dialog;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import org.openide.DialogDisplayer;
import org.openide.WizardDescriptor;

public final class RenderStemsAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        WizardDescriptor wd = new WizardDescriptor(new RenderStemsWizardIterator());

        Dialog d = DialogDisplayer.getDefault().createDialog(wd);
        d.setVisible(true);
    }
}
