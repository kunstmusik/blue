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
package blue.ui.core.score.object.actions;

import blue.BlueSystem;
import blue.score.ScoreObject;
import java.awt.event.ActionEvent;
import java.util.Collection;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JOptionPane;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;
import org.openide.util.Utilities;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.ShiftAction")
@ActionRegistration(
        displayName = "#CTL_ShiftAction")
@Messages("CTL_ShiftAction=Shift")
@ActionReference(path = "blue/score/actions", position = 100)
public final class ShiftAction extends AbstractAction implements ContextAwareAction {

    private final Collection<? extends ScoreObject> selected;

    public ShiftAction() {
        this(Utilities.actionsGlobalContext());
    }

    public ShiftAction(Lookup lookup) {
        super(NbBundle.getMessage(ShiftAction.class,
                "CTL_ShiftAction"));
        this.selected = lookup.lookupAll(ScoreObject.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {

        if (selected == null || selected.size() <= 0) {
            return;
        }

        String value = JOptionPane.showInputDialog(null, BlueSystem
                .getString("scoreGUI.action.shift.message"));

        try {
            float val = Float.parseFloat(value);

            for (ScoreObject scoreObj : selected) {
                if ((scoreObj.getStartTime() + val) < 0) {
                    JOptionPane.showMessageDialog(null, BlueSystem
                            .getString("scoreGUI.action.shift.error"));
                    return;
                }
            }

            for (ScoreObject scoreObj : selected) {
                scoreObj.setStartTime(scoreObj.getStartTime() + val);
            }

        } catch (NumberFormatException nfe) {
            System.err.println(nfe.getMessage());

        }
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new ShiftAction(actionContext);
    }
}
