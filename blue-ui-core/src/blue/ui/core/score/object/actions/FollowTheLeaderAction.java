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
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
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
        id = "blue.ui.core.score.actions.FollowTheLeaderAction")
@ActionRegistration(
        displayName = "#CTL_FollowTheLeaderAction")
@Messages("CTL_FollowTheLeaderAction=&Follow the Leader")
@ActionReference(path = "blue/score/actions", position = 70)
public final class FollowTheLeaderAction extends AbstractAction implements ContextAwareAction {

    private final Collection<? extends ScoreObject> selected;

    public FollowTheLeaderAction() {
        this(Utilities.actionsGlobalContext());
    }

    private FollowTheLeaderAction(Lookup lookup) {
        super(NbBundle.getMessage(FollowTheLeaderAction.class,
                "CTL_FollowTheLeaderAction"));
        this.selected = lookup.lookupAll(ScoreObject.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        List<ScoreObject> scoreObjs = new ArrayList<>(selected);
        Collections.sort(scoreObjs, new Comparator<ScoreObject>() {
            @Override
            public int compare(ScoreObject o1, ScoreObject o2) {
                float diff = o1.getStartTime() - o2.getStartTime();
                if (diff > 0) {
                    return 1;
                } else if (diff < 0) {
                    return -1;
                }
                return 0;
            }
        });

        float[] initialStartTimes = new float[scoreObjs.size()];
        float[] endStartTimes = new float[scoreObjs.size()];

        for (int i = 0; i < scoreObjs.size(); i++) {
            initialStartTimes[i] = scoreObjs.get(i).getStartTime();
        }

        ScoreObject initial = scoreObjs.get(0);
        float runningTotal = initial.getStartTime() + initial.getSubjectiveDuration();
        endStartTimes[0] = initial.getStartTime();

        for (int i = 1; i < scoreObjs.size(); i++) {
            ScoreObject current = scoreObjs.get(i);
            endStartTimes[i] = runningTotal;
            current.setStartTime(runningTotal);
            runningTotal += current.getSubjectiveDuration();
        }

        BlueUndoManager.setUndoManager("score");
        AlignEdit edit = new AlignEdit(scoreObjs.toArray(new ScoreObject[0]),
                initialStartTimes,
                endStartTimes);

        edit.setPresentationName("Follow the Leader");

        BlueUndoManager.addEdit(edit);
    }

    @Override
    public boolean isEnabled() {
        return selected.size() > 1;
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new FollowTheLeaderAction(actionContext);
    }
}
