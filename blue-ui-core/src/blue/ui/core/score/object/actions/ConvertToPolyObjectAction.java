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

import blue.soundObject.External;
import blue.soundObject.PythonObject;
import blue.soundObject.SoundObject;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
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

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.ConvertToPolyObjectAction")
@ActionRegistration(
        displayName = "#CTL_ConvertToPolyObjectAction", lazy = true)
@Messages("CTL_ConvertToPolyObjectAction=Convert to &PolyObject")
@ActionReference(path = "blue/score/actions", position = 40)
public final class ConvertToPolyObjectAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends SoundObject> soundObjects;

    public ConvertToPolyObjectAction() {
        this(null);
    }

    public ConvertToPolyObjectAction(Collection<? extends SoundObject> soundObjects) {
        super(NbBundle.getMessage(AlignRightAction.class,
                "CTL_ConvertToPolyObjectAction"));
        this.soundObjects = soundObjects;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        //        int retVal = JOptionPane.showConfirmDialog(null,
//                "This operation can not be undone.\nAre you sure?");
//
//        if (retVal != JOptionPane.OK_OPTION) {
//            return;
//        }
//
//        int index = sCanvas.getPolyObject().getLayerNumForY(sObjView.getY());
//
//        PolyObject temp = sCanvas.mBuffer.getBufferedPolyObject();
//
//        removeSObj();
//
//        float startTime = (float) sObjView.getX() / timeState.getPixelSecond();
//        temp.setStartTime(startTime);
//
//        sCanvas.getPolyObject().addSoundObject(index, temp);
//        content.set(Collections.emptyList(), null);
    }

    @Override
    public boolean isEnabled() {
        if (soundObjects.size() != 1) {
            return false;
        }
        SoundObject sObj = soundObjects.iterator().next();
        return (sObj instanceof PythonObject || sObj instanceof External);
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new AlignRightAction(actionContext.lookupAll(SoundObject.class));
    }

}
