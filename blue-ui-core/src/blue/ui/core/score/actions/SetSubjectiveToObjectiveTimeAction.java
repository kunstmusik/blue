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
package blue.ui.core.score.actions;

import blue.BlueSystem;
import blue.soundObject.SoundObject;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JOptionPane;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
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
        // TODO implement action bo
//        SoundObject sObj = this.sObjView.getSoundObject();
//        if (sObj.getObjectiveDuration() <= 0) {
//            JOptionPane.showMessageDialog(
//                    null,
//                    BlueSystem.getString("soundObjectPopup.setTime.error.text"),
//                    BlueSystem.getString("soundObjectPopup.setTime.error.title"),
//                    JOptionPane.ERROR_MESSAGE);
//            return;
//        }
//        this.sObjView.setSubjectiveTime(sObj.getObjectiveDuration());
    }
}
