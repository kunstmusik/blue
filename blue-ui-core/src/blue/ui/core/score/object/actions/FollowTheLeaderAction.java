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

import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.FollowTheLeaderAction")
@ActionRegistration(
        displayName = "#CTL_FollowTheLeaderAction")
@Messages("CTL_FollowTheLeaderAction=&Follow the Leader")
@ActionReference(path = "blue/score/actions", position = 70)
public final class FollowTheLeaderAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        //FIXME
//        SoundObjectView[] sObjViews = sCanvas.mBuffer.motionBuffer;
//
//        float initialStartTimes[] = new float[sObjViews.length - 1];
//        float endingStartTimes[] = new float[sObjViews.length - 1];
//        SoundObject soundObjects[] = new SoundObject[sObjViews.length - 1];
//
//        float runningTotal;
//        runningTotal = sObjViews[0].getStartTime() + sObjViews[0].getSubjectiveDuration();
//        for (int i = 1; i < sObjViews.length; i++) {
//            initialStartTimes[i - 1] = sObjViews[i].getStartTime();
//            soundObjects[i - 1] = sObjViews[i].getSoundObject();
//            endingStartTimes[i - 1] = runningTotal;
//
//            sObjViews[i].setStartTime(runningTotal);
//            runningTotal += sObjViews[i].getSoundObject().getSubjectiveDuration();
//        }
//
//        BlueUndoManager.setUndoManager("score");
//        AlignEdit edit = new AlignEdit(soundObjects, initialStartTimes,
//                endingStartTimes);
//
//        edit.setPresentationName("Follow the Leader");
//
//        BlueUndoManager.addEdit(edit);
    }
}
