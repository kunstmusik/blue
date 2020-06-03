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
import blue.soundObject.SoundObject;
import blue.ui.core.score.undo.ResizeScoreObjectEdit;
import blue.undo.BlueUndoManager;
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
        id = "blue.ui.core.score.actions.SetSubjectiveToObjectiveTime")
@ActionRegistration(
        displayName = "#CTL_SetSubjectiveToObjectiveTime")
@Messages("CTL_SetSubjectiveToObjectiveTime=Set Subjective Time to Objective Time")
@ActionReference(path = "blue/score/actions", position = 110, separatorAfter = 115)
public final class SetSubjectiveToObjectiveTimeAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends ScoreObject> scoreObjects;
    private final Collection<? extends SoundObject> soundObjects;

    public SetSubjectiveToObjectiveTimeAction() {
        this(Utilities.actionsGlobalContext());
    }

    public SetSubjectiveToObjectiveTimeAction(Lookup lookup) {
        super(NbBundle.getMessage(SetSubjectiveToObjectiveTimeAction.class,
                "CTL_SetSubjectiveToObjectiveTime"));
        scoreObjects = lookup.lookupAll(ScoreObject.class);
        soundObjects = lookup.lookupAll(SoundObject.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {

        if (soundObjects.size() > 0 && scoreObjects.size() == soundObjects.size()) {
            ResizeScoreObjectEdit top = null;
            for (SoundObject soundObject : soundObjects) {

                if (soundObject.getObjectiveDuration() <= 0) {
                    JOptionPane.showMessageDialog(
                            null,
                            BlueSystem.getString(
                                    "soundObjectPopup.setTime.error.text"),
                            BlueSystem.getString(
                                    "soundObjectPopup.setTime.error.title"),
                            JOptionPane.ERROR_MESSAGE);
                    return;
                }
                double oldTime = soundObject.getSubjectiveDuration();
                double newTime = soundObject.getObjectiveDuration();

                if (oldTime != newTime) {
                    soundObject.setSubjectiveDuration(
                            newTime);
                    ResizeScoreObjectEdit edit = new ResizeScoreObjectEdit(
                            soundObject, oldTime, newTime);

                    if(top == null) {
                        top = edit;
                    } else {
                        top.addEdit(edit);
                    }
                }
            }
            
            if(top != null) {
                BlueUndoManager.setUndoManager("score");
                BlueUndoManager.addEdit(top);
            }
        }

    }

    @Override
    public boolean isEnabled() {
        return scoreObjects.size() == soundObjects.size()
                && soundObjects.size() > 0;
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new SetSubjectiveToObjectiveTimeAction(actionContext);
    }
}
