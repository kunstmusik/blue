/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.orchestra.editor.blueSynthBuilder;

import blue.jfx.BlueFX;
import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.JCheckBoxMenuItem;
import javax.swing.JMenuItem;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;
import org.openide.util.actions.Presenter;

@ActionID(
        category = "View",
        id = "blue.orchestra.editor.blueSynthBuilder.ShowWidgetComments"
)
@ActionRegistration(
        displayName = "#CTL_ShowWidgetComments"
)

@ActionReferences({
    @ActionReference(path = "Menu/View", position = 550, separatorBefore = 540),
    @ActionReference(path = "Shortcuts", name = "DS-I")
})

@Messages("CTL_ShowWidgetComments=Show Widget Comments")
public final class ShowWidgetComments extends AbstractAction implements Presenter.Menu {

    JCheckBoxMenuItem menuItem;

    public ShowWidgetComments() {
        menuItem = new JCheckBoxMenuItem();
        putValue(NAME, NbBundle.getMessage(ShowWidgetComments.class,
                "CTL_ShowWidgetComments"));
        menuItem.setAction(this);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        var prefs = BSBPreferences.getInstance();

        BlueFX.runOnFXThread(() -> {
            prefs.setShowWidgetComments(!prefs.getShowWidgetComments());
            menuItem.setSelected(prefs.getShowWidgetComments());
        });
    }

    @Override
    public JMenuItem getMenuPresenter() {
        var prefs = BSBPreferences.getInstance();
        menuItem.setSelected(prefs.getShowWidgetComments());

        return menuItem;
    }
}
