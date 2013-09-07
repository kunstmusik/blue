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

import blue.soundObject.SoundObject;
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
//        id = "blue.ui.core.score.actions.AlignCenterAction")
//@ActionRegistration(
//        displayName = "#CTL_AlignCenterAction")
@Messages("CTL_AlignCenterAction=Align Center")
//@ActionReference(path = "blue/score/actions", position = 110)
public final class AlignCenterAction extends AbstractAction implements ContextAwareAction {

    private final Collection<? extends SoundObject> soundObjects;

    public AlignCenterAction() {
        this(null);
    }

    public AlignCenterAction(Collection<? extends SoundObject> soundObjects) {
        super(NbBundle.getMessage(AlignCenterAction.class, "CTL_AlignCenterAction"));
        this.soundObjects = soundObjects;
    }

    @Override
    public void actionPerformed(ActionEvent ev) {
//        SoundObject soundObjects[] = sCanvas.mBuffer.getSoundObjectsAsArray();
//        if (soundObjects.length < 2) {
//            return;
//        }
//
//        float initialStartTimes[] = new float[soundObjects.length];
//        float endingStartTimes[] = new float[soundObjects.length];
//
//        float farLeft = soundObjects[0].getStartTime();
//        initialStartTimes[0] = farLeft;
//
//        float tempStart;
//        for (int i = 1; i < soundObjects.length; i++) {
//            tempStart = soundObjects[i].getStartTime();
//
//            initialStartTimes[i] = tempStart;
//
//            if (tempStart < farLeft) {
//                farLeft = tempStart;
//            }
//        }
//
//        float farRight = soundObjects[0].getStartTime() + soundObjects[0].getSubjectiveDuration();
//        float endTime;
//
//        for (int i = 1; i < soundObjects.length; i++) {
//            endTime = soundObjects[i].getStartTime() + soundObjects[i].getSubjectiveDuration();
//
//            if (endTime > farRight) {
//                farRight = endTime;
//            }
//        }
//
//        float centerTime = ((farRight - farLeft) / 2) + farLeft;
//
//        float newEndTime;
//        for (int i = 0; i < soundObjects.length; i++) {
//            newEndTime = centerTime - (soundObjects[i].getSubjectiveDuration() / 2);
//            soundObjects[i].setStartTime(newEndTime);
//            endingStartTimes[i] = newEndTime;
//        }
//
//        BlueUndoManager.setUndoManager("score");
//        AlignEdit edit = new AlignEdit(soundObjects, initialStartTimes,
//                endingStartTimes);
//
//        edit.setPresentationName("Align Center");
//
//        BlueUndoManager.addEdit(edit)
    }

    @Override
    public boolean isEnabled() {
        return soundObjects.size() > 1;
    }

    

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new AlignCenterAction(actionContext.lookupAll(SoundObject.class));
    }
}
