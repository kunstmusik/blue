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
import blue.ui.core.score.ScoreTopComponent;
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
        id = "blue.ui.core.score.object.actions.NudgeRightAction"
)
@ActionRegistration(
        displayName = "#CTL_NudgeRightAction"
)
@Messages("CTL_NudgeRightAction=NudgeRightAction")
@ActionReference(path = "blue/score/shortcuts", name = "RIGHT")
public final class NudgeRightAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        Collection<? extends ScoreObject> scoreObjects
                = ScoreController.getInstance().getSelectedScoreObjects();
        ScoreTopComponent scoreTopComponent = (ScoreTopComponent) 
                WindowManager.getDefault().findTopComponent("ScoreTopComponent");

        if (!scoreObjects.isEmpty()) {
            double adjust = 1.0f / scoreTopComponent.getTimeState().getPixelSecond();
            NudgeUtils.nudgeHorizontal(adjust, scoreObjects);
        }
    }
}
