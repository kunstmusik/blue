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

import blue.BlueData;
import blue.projects.BlueProjectManager;
import blue.soundObject.Instance;
import blue.soundObject.SoundObject;
import java.awt.event.ActionEvent;
import java.util.Collection;
import javax.swing.AbstractAction;
import javax.swing.Action;
import org.openide.awt.ActionID;
import org.openide.awt.ActionReference;
import org.openide.awt.ActionRegistration;
import org.openide.util.ContextAwareAction;
import org.openide.util.Lookup;
import org.openide.util.NbBundle;
import org.openide.util.NbBundle.Messages;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.AddToSoundObjectLibraryAction")
@ActionRegistration(
        displayName = "#CTL_AddToSoundObjectLibraryAction", lazy = true)
@Messages("CTL_AddToSoundObjectLibraryAction=Add to SoundObject &Library")
@ActionReference(path = "blue/score/actions", position = 20, separatorAfter = 25)
public final class AddToSoundObjectLibraryAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends SoundObject> soundObjects;

    public AddToSoundObjectLibraryAction() {
        this(null);
    }

    public AddToSoundObjectLibraryAction(Collection<? extends SoundObject> soundObjects) {
        super(NbBundle.getMessage(AlignRightAction.class, "CTL_AddToSoundObjectLibraryAction"));
        this.soundObjects = soundObjects;
    }
    
    @Override
    public void actionPerformed(ActionEvent e) {
        SoundObject sObj = (SoundObject) soundObjects.iterator().next().clone();

        if (sObj instanceof Instance) {
            return;
        }

//        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();
//        data.getSoundObjectLibrary().addSoundObject(sObj);
//
//        Instance i = new Instance(sObj);
//
//        replaceSoundObject(sObjView.getSoundObject(), i, true, false);
    }

    @Override
    public boolean isEnabled() {
        return soundObjects.size() == 1;
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new AddToSoundObjectLibraryAction(actionContext.lookupAll(SoundObject.class));
    }
}
