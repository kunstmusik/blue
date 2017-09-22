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

import blue.score.ScoreObject;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.undo.MoveScoreObjectsEdit;
import blue.undo.BlueUndoManager;
import java.awt.event.ActionEvent;
import java.util.Collection;
import javax.swing.AbstractAction;
import javax.swing.Action;
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
        id = "blue.ui.core.score.actions.ReverseAction")
@ActionRegistration(
        displayName = "#CTL_ReverseAction")
@Messages("CTL_ReverseAction=Re&verse")
@ActionReference(path = "blue/score/actions", position = 90)
public final class ReverseAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends ScoreObject> scoreObjects;

    public ReverseAction() {
        this(Utilities.actionsGlobalContext());
    }

    public ReverseAction(Lookup lookup) {

        super(NbBundle.getMessage(ReverseAction.class, "CTL_ReverseAction"));
        scoreObjects = ScoreController.getInstance().getSelectedScoreObjects();
    }

    @Override
    public void actionPerformed(ActionEvent e) {

        if (scoreObjects.size() < 2) {
            return;
        }

        double start = Double.MAX_VALUE;
        double end = Double.MIN_VALUE;

        for (ScoreObject scoreObject : scoreObjects) {
            double tempStart = scoreObject.getStartTime();
            double tempEnd = tempStart + scoreObject.getSubjectiveDuration();

            if (tempStart < start) {
                start = tempStart;
            }

            if (tempEnd > end) {
                end = tempEnd;
            }
        }

        int len = scoreObjects.size();
        ScoreObject[] objects = scoreObjects.<ScoreObject>toArray(
                new ScoreObject[scoreObjects.size()]);
        double[] startTimes = new double[len];
        double[] endTimes = new double[len];
        
        for (int i = 0; i < len; i++) {
            ScoreObject scoreObj = objects[i];
            double tempStart = scoreObj.getStartTime();
            double tempEnd = tempStart + scoreObj.getSubjectiveDuration();

            double newStart = start + (end - tempEnd);

            scoreObj.setStartTime(newStart);

            startTimes[i] = tempStart;
            endTimes[i] = newStart;
        }

        BlueUndoManager.setUndoManager("score");

        MoveScoreObjectsEdit edit = new MoveScoreObjectsEdit(objects,
                null, null, startTimes, endTimes);

        BlueUndoManager.setUndoManager("score");
        BlueUndoManager.addEdit(edit);

    }

    @Override
    public boolean isEnabled() {
        return scoreObjects.size() > 1;
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new ReverseAction(actionContext);
    }
}
