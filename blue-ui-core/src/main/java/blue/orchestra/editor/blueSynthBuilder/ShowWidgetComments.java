/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.orchestra.editor.blueSynthBuilder;

import blue.midi.MidiInputManager;
import blue.ui.core.blueLive.BlueLiveToolBar;
import blue.ui.core.score.object.actions.AlignActionsPresenter;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.AbstractAction;
import javax.swing.JCheckBoxMenuItem;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;
import org.openide.util.NbPreferences;
import org.openide.util.actions.Presenter;

@ActionID(
        category = "View",
        id = "blue.orchestra.editor.blueSynthBuilder.ShowWidgetComments"
)
@ActionRegistration(
        displayName = "#CTL_ShowWidgetComments"
)

@ActionReference(path = "Menu/View", position = 550, separatorBefore = 540)

@Messages("CTL_ShowWidgetComments=Show Widget Comments")
public final class ShowWidgetComments extends AbstractAction implements Presenter.Menu {

    JCheckBoxMenuItem menuItem;
    
    public ShowWidgetComments() {
        menuItem = new JCheckBoxMenuItem(NbBundle.getMessage(ShowWidgetComments.class,
                "CTL_ShowWidgetComments"));
        menuItem.addActionListener(this);
    }
    
    @Override
    public void actionPerformed(ActionEvent e) {
        var prefs = BSBPreferences.getInstance();
        prefs.setShowWidgetComments(!prefs.getShowWidgetComments());
        menuItem.setSelected(prefs.getShowWidgetComments());
    }
    
     @Override
    public JMenuItem getMenuPresenter() {
        var prefs = BSBPreferences.getInstance();
        menuItem.setSelected(prefs.getShowWidgetComments());

        return menuItem;
    }
}
