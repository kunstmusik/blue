/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.projects.actions;

import blue.projects.BlueProjectManager;
import java.awt.event.ActionEvent;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.AbstractAction;
import javax.swing.Action;
import org.openide.util.NbBundle;

/**
 *
 * @author steven
 */
public class CloseProjectAction extends AbstractAction implements
        PropertyChangeListener {

    public CloseProjectAction() {
        putValue(Action.NAME, NbBundle.getMessage(this.getClass(),
                "CTL_CloseProjectAction"));
        BlueProjectManager.getInstance().addPropertyChangeListener(this);
        this.setEnabled(BlueProjectManager.getInstance().getCurrentProject() != null);
    }

    public void actionPerformed(ActionEvent e) {
        BlueProjectManager.getInstance().closeCurrentProject();
    }

    public void propertyChange(PropertyChangeEvent evt) {
        if (BlueProjectManager.CURRENT_PROJECT.equals(evt.getPropertyName())) {
            setEnabled(evt.getNewValue() != null);
        }
    }
}
