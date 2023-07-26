/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.orchestra.editor.blueSynthBuilder;

import blue.ui.utilities.UiUtilities;
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
    private final BSBPreferences prefs = BSBPreferences.getInstance();

    public ShowWidgetComments() {
        menuItem = new JCheckBoxMenuItem();
        putValue(NAME, NbBundle.getMessage(ShowWidgetComments.class,
                "CTL_ShowWidgetComments"));
        menuItem.setAction(this);

        prefs.showWidgetCommentsProperty().addListener((obs, old, newVal) -> {
            menuItem.setSelected(prefs.getShowWidgetComments());
        });
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        UiUtilities.invokeOnSwingThread(() -> {
            prefs.setShowWidgetComments(!prefs.getShowWidgetComments());
        });
    }

    @Override
    public JMenuItem getMenuPresenter() {
        menuItem.setSelected(prefs.getShowWidgetComments());

        return menuItem;
    }
}
