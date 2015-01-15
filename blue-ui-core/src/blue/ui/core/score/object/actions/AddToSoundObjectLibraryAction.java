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

import blue.BlueData;
import blue.SoundLayer;
import blue.projects.BlueProjectManager;
import blue.score.ScoreObject;
import blue.soundObject.Instance;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import blue.ui.core.score.undo.ReplaceScoreObjectEdit;
import blue.undo.BlueUndoManager;
import java.awt.Point;
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

@ActionID(
        category = "Blue",
        id = "blue.ui.core.score.actions.AddToSoundObjectLibraryAction")
@ActionRegistration(
        displayName = "#CTL_AddToSoundObjectLibraryAction")
@Messages("CTL_AddToSoundObjectLibraryAction=Add to SoundObject &Library")
@ActionReference(path = "blue/score/actions", position = 20, separatorAfter = 25)
public final class AddToSoundObjectLibraryAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends ScoreObject> scoreObjects;
    private final Collection<? extends SoundObject> soundObjects;
    private final ScorePath scorePath;
    private final Point p;

    public AddToSoundObjectLibraryAction() {
        this(Utilities.actionsGlobalContext());
    }

    public AddToSoundObjectLibraryAction(Lookup lookup) {
        super(NbBundle.getMessage(AlignRightAction.class,
                "CTL_AddToSoundObjectLibraryAction"));
        this.scoreObjects = lookup.lookupAll(ScoreObject.class);
        this.soundObjects = lookup.lookupAll(SoundObject.class);
        this.p = lookup.lookup(Point.class);
        this.scorePath = lookup.lookup(ScorePath.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        SoundObject sObj = (SoundObject) soundObjects.iterator().next().clone();

        if (sObj instanceof Instance) {
            return;
        }

        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();
         
        Instance i = new Instance(sObj);
        i.setStartTime(sObj.getStartTime());
        i.setSubjectiveDuration(sObj.getSubjectiveDuration());
        
        data.getSoundObjectLibrary().addSoundObject(sObj);
        SoundLayer layer = (SoundLayer)scorePath.getGlobalLayerForY(p.y);
        layer.remove(soundObjects.iterator().next());
        layer.add(i);


// BlueUndoManager.setUndoManager("score");
//            BlueUndoManager.addEdit(new ReplaceScoreObjectEdit(
//                    sCanvas.getPolyObject(), oldSoundObject,
//                    newSoundObject, index));
        
    }

    @Override
    public boolean isEnabled() {
        return (scoreObjects.size() == soundObjects.size())
                && (soundObjects.size() == 1)
                && !(soundObjects.iterator().next() instanceof Instance);
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new AddToSoundObjectLibraryAction(actionContext);
    }

}
