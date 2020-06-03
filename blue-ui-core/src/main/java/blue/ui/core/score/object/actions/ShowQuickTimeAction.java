/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
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

import blue.score.ScoreObject;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.layers.soundObject.QuickTimeDialog;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.Collection;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;
import org.openide.windows.WindowManager;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.object.actions.ShowQuickTimeAction"
)
@ActionRegistration(
        displayName = "#CTL_ShowQuickTimeAction"
)
@Messages("CTL_ShowQuickTimeAction=Show Quick Time Action")
@ActionReference(path = "blue/score/shortcuts", name = "D-T")
public final class ShowQuickTimeAction implements ActionListener {

    private QuickTimeDialog qtDialog = null;

    @Override
    public void actionPerformed(ActionEvent e) {
        Collection<? extends ScoreObject> scoreObjects
                = ScoreController.getInstance().getSelectedScoreObjects();

        if (scoreObjects.size() == 1) {
            if (qtDialog == null) {
                qtDialog = new QuickTimeDialog(
                        WindowManager.getDefault().getMainWindow());
            }
            qtDialog.show(scoreObjects.iterator().next());
        }
    }
}
