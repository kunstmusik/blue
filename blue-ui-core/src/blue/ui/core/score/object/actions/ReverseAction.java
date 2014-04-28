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
import blue.ui.core.score.ScoreTopComponent;
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
        scoreObjects = lookup.lookupAll(ScoreObject.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {

        if (scoreObjects.size() < 2) {
            return;
        }

        float start = Float.MAX_VALUE;
        float end = Float.MIN_VALUE;

        for (ScoreObject scoreObject : scoreObjects) {
            float tempStart = scoreObject.getStartTime();
            float tempEnd = tempStart + scoreObject.getSubjectiveDuration();

            if (tempStart < start) {
                start = tempStart;
            }

            if (tempEnd > end) {
                end = tempEnd;
            }
        }

        for (ScoreObject scoreObject : scoreObjects) {
            float tempStart = scoreObject.getStartTime();
            float tempEnd = tempStart + scoreObject.getSubjectiveDuration();

            float newStart = start + (end - tempEnd);

            scoreObject.setStartTime(newStart);
        }

        BlueUndoManager.setUndoManager("score");

// FIXME - need to do undoable edit here!
//        MoveSoundObjectsEdit edit = sCanvas.mBuffer.getMoveEdit(
//                sCanvas.getPolyObject());
//
//        edit.setPresentationName(BlueSystem.getString(
//                "soundObjectPopup.reverse.text"));
//        BlueUndoManager.addEdit(edit);
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
