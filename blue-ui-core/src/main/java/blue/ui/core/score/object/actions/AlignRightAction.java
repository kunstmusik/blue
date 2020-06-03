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
import blue.ui.core.score.undo.AlignEdit;
import blue.undo.BlueUndoManager;
import java.awt.event.ActionEvent;
import java.util.Collection;
import javax.swing.AbstractAction;
import javax.swing.Action;
import org.openide.util.ContextAwareAction;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;

//@ActionID(
//        category = "Blue",
//        id = "blue.ui.core.score.actions.AlignRightAction")
//@ActionRegistration(
//        displayName = "#CTL_AlignRightAction")
@Messages("CTL_AlignRightAction=Align Right")
//@ActionReference(path = "blue/score/actions/Align", position = 110)
public final class AlignRightAction extends AbstractAction implements ContextAwareAction {

    private final Collection<? extends ScoreObject> selected;

    public AlignRightAction() {
        this(null);
    }

    public AlignRightAction(Collection<? extends ScoreObject> soundObjects) {
        super(NbBundle.getMessage(AlignRightAction.class, "CTL_AlignRightAction"));
        this.selected = soundObjects;
    }

    @Override
    public void actionPerformed(ActionEvent ev) {
        if (selected.size() < 2) {
            return;
        }

        double[] initialStartTimes = new double[selected.size()];
        double[] endingStartTimes = new double[selected.size()];

        double farRight = Double.MIN_VALUE;
        int i = 0;

        for (ScoreObject scoreObj : selected) {
            initialStartTimes[i] = scoreObj.getStartTime();

            double end = initialStartTimes[i] + scoreObj.getSubjectiveDuration();

            if (end > farRight) {
                farRight = end;
            }
            i++;
        }

        i = 0;

        for (ScoreObject scoreObj : selected) {
            double newTime = farRight - scoreObj.getSubjectiveDuration();
            scoreObj.setStartTime(newTime);
            endingStartTimes[i] = newTime;
            i++;
        }

        BlueUndoManager.setUndoManager("score");
        AlignEdit edit = new AlignEdit(selected.toArray(new ScoreObject[0]),
                initialStartTimes,
                endingStartTimes);

        edit.setPresentationName("Align Right");

        BlueUndoManager.addEdit(edit);
    }

    @Override
    public boolean isEnabled() {
        return selected.size() > 1;
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new AlignRightAction(actionContext.lookupAll(ScoreObject.class));
    }
}
