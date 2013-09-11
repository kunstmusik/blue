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
import blue.ui.core.score.layers.soundObject.FreezeDialog;
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
import org.openide.util.Utilities;
import org.openide.windows.WindowManager;

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.FreezeUnfreezeAction")
@ActionRegistration(
        displayName = "#CTL_FreezeUnfreezeAction", lazy = true)
@Messages("CTL_FreezeUnfreezeAction=Freeze/Unfreeze ScoreObjects")
@ActionReference(path = "blue/score/actions", position = 30, separatorAfter = 35)
public final class FreezeUnfreezeAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends SoundObject> soundObjects;

    public FreezeUnfreezeAction() {
        this(null);
    }

    public FreezeUnfreezeAction(Collection<? extends SoundObject> soundObjects) {
        super(NbBundle.getMessage(FreezeUnfreezeAction.class,
                "CTL_FreezeUnfreezeAction"));
        this.soundObjects = soundObjects;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        // FIXME
//        Utilities.actionsGlobalContext().lookupAll(SoundObject.class);
//
//        FreezeDialog.freezeSoundObjects(soundObjects.toArray(new SoundObject[0]),
//                WindowManager.getDefault().getMainWindow());
    }

    @Override
    public boolean isEnabled() {
        // check that all objects are freezable, depends on scoreoobject 
        return !soundObjects.isEmpty();
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new FreezeUnfreezeAction(actionContext.lookupAll(
                SoundObject.class));
    }
}
