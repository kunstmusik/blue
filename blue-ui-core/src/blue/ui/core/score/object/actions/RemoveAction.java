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

import blue.ui.core.score.ModeManager;
import blue.ui.core.score.ScoreController;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionReferences;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.RemoveAction")
@ActionRegistration(
        displayName = "#CTL_RemoveAction")
@Messages("CTL_RemoveAction=&Remove ScoreObjects")
@ActionReferences({
    @ActionReference(path = "blue/score/actions", position = 300, separatorAfter = 305)
    ,
@ActionReference(path = "blue/score/shortcuts", name = "DELETE")
    ,
@ActionReference(path = "blue/score/shortcuts", name = "BACK_SPACE")
})
public final class RemoveAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        final ScoreController scoreController = ScoreController.getInstance();

        switch (ModeManager.getInstance().getMode()) {
            case SCORE:
                scoreController.deleteScoreObjects();
                break;
            case SINGLE_LINE:
                // deleteSingleLine();
                break;
            case MULTI_LINE:
                scoreController.deleteScoreObjects();
                scoreController.deleteMultiLineData();
                break;
        }
    }

}
