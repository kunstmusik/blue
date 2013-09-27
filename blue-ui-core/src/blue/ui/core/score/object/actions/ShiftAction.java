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
        id = "blue.ui.core.score.actions.ShiftAction")
@ActionRegistration(
        displayName = "#CTL_ShiftAction")
@Messages("CTL_ShiftAction=Shift")
@ActionReference(path = "blue/score/actions", position = 100)
public final class ShiftAction implements ActionListener {

    @Override
    public void actionPerformed(ActionEvent e) {
        // FIXME
                
//                if (sCanvas.mBuffer.size() <= 0) {
//                    return;
//                }
//
//                String value = JOptionPane.showInputDialog(null, BlueSystem
//                        .getString("scoreGUI.action.shift.message"));
//
//                sCanvas.mBuffer.motionBufferObjects();
//                SoundObjectView[] views = sCanvas.mBuffer.motionBuffer;
//
//                try {
//                    float val = Float.parseFloat(value);
//
//                    for (int i = 0; i < views.length; i++) {
//                        if ((views[i].getStartTime() + val) < 0) {
//                            JOptionPane.showMessageDialog(null, BlueSystem
//                                    .getString("scoreGUI.action.shift.error"));
//                            return;
//                        }
//                    }
//
//                    for (int i = 0; i < views.length; i++) {
//                        SoundObject sObj = views[i].getSoundObject();
//
//                        views[i].setStartTime(sObj.getStartTime() + val);
//                    }
//
//                } catch (NumberFormatException nfe) {
//                    System.err.println(nfe.getMessage());
//                
    }
}
