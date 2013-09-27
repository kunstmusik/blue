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

import blue.soundObject.SoundObject;
import blue.ui.core.score.layers.soundObject.MotionBuffer;
import java.awt.Color;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.JColorChooser;
import javax.swing.JComponent;
import javax.swing.SwingUtilities;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.NbBundle.Messages;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.SetColorAction")
@ActionRegistration(
        displayName = "#CTL_SetColorAction")
@Messages("CTL_SetColorAction=Set Color")
@ActionReference(path = "blue/score/actions", position = 400, separatorAfter = 405)
public final class SetColorAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
//        MotionBuffer buffer = MotionBuffer.getInstance();
//
//        if (buffer.size() == 0) {
//            return;
//        }
//
//        SoundObject[] sObjects = buffer.getSoundObjectsAsArray();
//
//        Color retVal = JColorChooser.showDialog(SwingUtilities.getRoot(
//                (JComponent) e.getSource()), "Choose Color",
//                sObjects[0].getBackgroundColor());
//
//        if (retVal != null) {
//            for (int i = 0; i < sObjects.length; i++) {
//                SoundObject sObj = sObjects[i];
//                sObj.setBackgroundColor(retVal);
//            }
//        }

    }
}
