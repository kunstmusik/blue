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
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreTopComponent;
import java.awt.Color;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.Collection;
import javax.swing.JColorChooser;
import javax.swing.JComponent;
import javax.swing.SwingUtilities;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.Lookup;
import org.openide.util.NbBundle.Messages;
import org.openide.windows.WindowManager;

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


        Lookup lkp = ScoreTopComponent.findInstance().getLookup();
        Collection<? extends ScoreObject> selected = lkp.lookupAll(
                ScoreObject.class);
        Collection<? extends SoundObject> sObjects = lkp.lookupAll(SoundObject.class);


        if (sObjects.size() > 0 && selected.size() == sObjects.size()) {

            Color retVal = JColorChooser.showDialog(
                    WindowManager.getDefault().getMainWindow(), "Choose Color",
                    sObjects.iterator().next().getBackgroundColor());

            if (retVal != null) {
                for (SoundObject sObj : sObjects) {
                    sObj.setBackgroundColor(retVal);
                }
            }
        }
    }
}
