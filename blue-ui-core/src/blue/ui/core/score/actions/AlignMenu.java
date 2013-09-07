/*
 * blue - object composition environment for csound
 * Copyright (C) 2013
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.ui.core.score.actions;

import java.awt.event.ActionEvent;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;
import org.openide.util.Utilities;
import org.openide.util.actions.Presenter;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.AlignMenu")
@ActionRegistration(
        displayName = "#CTL_AlignMenu")
@Messages("CTL_AlignMenu=&Align")
@ActionReference(path = "blue/score/actions", position = 100)
public final class AlignMenu extends AbstractAction implements Presenter.Popup {

    Action[] actions = {new AlignLeftAction(), new AlignCenterAction(),
        new AlignRightAction()};

    @Override
    public JMenuItem getPopupPresenter() {
        JMenu menu = new JMenu(NbBundle.getMessage(AlignMenu.class,
                "CTL_AlignMenu"));
        org.openide.awt.Mnemonics.setLocalizedText(menu, menu.getText());

        for (Action action : actions) {
            Action temp = action;
            if (action instanceof ContextAwareAction) {
                temp = ((ContextAwareAction) action).createContextAwareInstance(
                        Utilities.actionsGlobalContext());
            }
            menu.add(new JMenuItem(temp));
        }

        return menu;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
    }
}
