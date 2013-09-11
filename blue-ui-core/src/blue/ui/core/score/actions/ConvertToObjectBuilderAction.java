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

import blue.soundObject.External;
import blue.soundObject.PythonObject;
import blue.soundObject.SoundObject;
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

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.ConvertToObjectBuilderAction")
@ActionRegistration(
        displayName = "#CTL_ConvertToObjectBuilderAction", lazy = true)
@Messages("CTL_ConvertToObjectBuilderAction=Convert to ObjectBuilder")
@ActionReference(path = "blue/score/actions", position = 50)
public final class ConvertToObjectBuilderAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends SoundObject> soundObjects;

    public ConvertToObjectBuilderAction() {
        this(null);
    }

    public ConvertToObjectBuilderAction(Collection<? extends SoundObject> soundObjects) {
        super(NbBundle.getMessage(AlignRightAction.class,
                "CTL_ConvertToObjectBuilderAction"));
        this.soundObjects = soundObjects;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        SoundObject temp = soundObjects.iterator().next();

        int retVal = JOptionPane.showConfirmDialog(null,
                "This operation can not be undone.\nAre you sure?");

        if (retVal != JOptionPane.OK_OPTION) {
            return;
        }
//
//        int index = sCanvas.getPolyObject().getLayerNumForY(sObjView.getY());
//
//        ObjectBuilder objBuilder = new ObjectBuilder();
//
//        if (temp instanceof PythonObject) {
//            PythonObject tempPython = (PythonObject) temp;
//            objBuilder.setName(tempPython.getName());
//            objBuilder.setNoteProcessorChain(tempPython.getNoteProcessorChain());
//            objBuilder.setTimeBehavior(tempPython.getTimeBehavior());
//            objBuilder.setStartTime(tempPython.getStartTime());
//            objBuilder.setSubjectiveDuration(tempPython.getSubjectiveDuration());
//            objBuilder.setCode(tempPython.getText());
//            objBuilder.setBackgroundColor(tempPython.getBackgroundColor());
//
//        } else if (temp instanceof External) {
//            External tempExt = (External) temp;
//            objBuilder.setName(tempExt.getName());
//            objBuilder.setNoteProcessorChain(tempExt.getNoteProcessorChain());
//            objBuilder.setTimeBehavior(tempExt.getTimeBehavior());
//            objBuilder.setStartTime(tempExt.getStartTime());
//            objBuilder.setSubjectiveDuration(tempExt.getSubjectiveDuration());
//            objBuilder.setCode(tempExt.getText());
//            objBuilder.setCommandLine(tempExt.getCommandLine());
//            objBuilder.setExternal(true);
//            objBuilder.setBackgroundColor(tempExt.getBackgroundColor());
//        } else {
//            return;
//        }
//
//        removeSObj();
//        sCanvas.getPolyObject().addSoundObject(index, objBuilder);
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
