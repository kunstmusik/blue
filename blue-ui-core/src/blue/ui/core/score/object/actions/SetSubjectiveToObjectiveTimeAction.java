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
import blue.ui.core.score.ScoreTopComponent;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.Collection;
import javax.swing.JOptionPane;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.Lookup;
import org.openide.util.NbBundle.Messages;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.SetSubjectiveToObjectiveTime")
@ActionRegistration(
        displayName = "#CTL_SetSubjectiveToObjectiveTime")
@Messages("CTL_SetSubjectiveToObjectiveTime=Set Subjective time to Objective Time")
@ActionReference(path = "blue/score/actions", position = 110, separatorAfter = 115)
public final class SetSubjectiveToObjectiveTimeAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        //FIXME - should be a ContextAwareAction...
        Lookup lkp = ScoreTopComponent.findInstance().getLookup();
        Collection<? extends ScoreObject> selected = lkp.lookupAll(
                ScoreObject.class);
        Collection<? extends SoundObject> sObjects = lkp.lookupAll(
                SoundObject.class);


        if (sObjects.size() > 0 && selected.size() == sObjects.size()) {
            for (SoundObject soundObject : sObjects) {

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
                soundObject.setSubjectiveDuration(soundObject.getObjectiveDuration());
            }
        }

    }
}
