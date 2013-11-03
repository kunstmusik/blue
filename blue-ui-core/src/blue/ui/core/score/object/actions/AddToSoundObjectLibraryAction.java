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
import blue.projects.BlueProjectManager;
import blue.score.ScoreObject;
import blue.soundObject.Instance;
import blue.soundObject.SoundObject;
import blue.ui.core.score.layers.LayerGroupPanel;
import blue.ui.core.score.layers.soundObject.ScoreTimeCanvas;
import blue.ui.core.score.layers.soundObject.SoundObjectView;
import blue.ui.core.score.undo.ReplaceSoundObjectEdit;
import blue.undo.BlueUndoManager;
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
import org.openide.util.lookup.InstanceContent;

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
    private final LayerGroupPanel panel;
    private final InstanceContent ic;

    public AddToSoundObjectLibraryAction() {
        this(null, null, null, null);
    }

    public AddToSoundObjectLibraryAction(
            Collection<? extends ScoreObject> scoreObjects,
            Collection<? extends SoundObject> soundObjects,
            LayerGroupPanel panel,
            InstanceContent ic) {
        super(NbBundle.getMessage(AlignRightAction.class,
                "CTL_AddToSoundObjectLibraryAction"));
        this.scoreObjects = scoreObjects;
        this.soundObjects = soundObjects;
        this.panel = panel;
        this.ic = ic;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        SoundObject sObj = (SoundObject) soundObjects.iterator().next().clone();

        if (sObj instanceof Instance) {
            return;
        }

        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();
        data.getSoundObjectLibrary().addSoundObject(sObj);

        Instance i = new Instance(sObj);

        replaceSoundObject(soundObjects.iterator().next(), i, true, false);
    }

    @Override
    public boolean isEnabled() {
        return (scoreObjects.size() == soundObjects.size())
                && (soundObjects.size() == 1)
                && !(soundObjects.iterator().next() instanceof Instance)
                && (panel instanceof ScoreTimeCanvas);
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new AddToSoundObjectLibraryAction(
                actionContext.lookupAll(ScoreObject.class),
                actionContext.lookupAll(SoundObject.class),
                actionContext.lookup(LayerGroupPanel.class),
                actionContext.lookup(InstanceContent.class));
    }

    private void replaceSoundObject(SoundObject oldSoundObject,
            SoundObject newSoundObject, boolean scaleDuration,
            boolean recordEdit) {

        ScoreTimeCanvas sCanvas = (ScoreTimeCanvas) panel;

        SoundObjectView sObjView = sCanvas.getViewForSoundObject(oldSoundObject);

        int index = sCanvas.getPolyObject().getLayerNumForY(sObjView.getY());

        newSoundObject.setStartTime(oldSoundObject.getStartTime());

        if (scaleDuration) {
            newSoundObject.setSubjectiveDuration(
                    oldSoundObject.getSubjectiveDuration());
        }

        sCanvas.getPolyObject().removeSoundObject(oldSoundObject);
        sCanvas.getPolyObject().addSoundObject(index, newSoundObject);

        // remove old soundObject from selected objects
        ic.remove(oldSoundObject);

        if (recordEdit) {

            BlueUndoManager.setUndoManager("score");
            BlueUndoManager.addEdit(new ReplaceSoundObjectEdit(
                    sCanvas.getPolyObject(), oldSoundObject,
                    newSoundObject, index));
        }

    }
}
