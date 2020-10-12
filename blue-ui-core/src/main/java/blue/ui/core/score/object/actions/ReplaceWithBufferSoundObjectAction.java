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
import blue.SoundObjectLibrary;
import blue.projects.BlueProjectManager;
import blue.score.ScoreObject;
import blue.score.layers.Layer;
import blue.score.layers.ScoreObjectLayer;
import blue.soundObject.Instance;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import blue.ui.core.score.undo.ReplaceScoreObjectEdit;
import blue.undo.BlueUndoManager;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
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
        id = "blue.ui.core.score.actions.ReplaceWithBufferSoundObjectAction")
@ActionRegistration(
        displayName = "#CTL_ReplaceWithBufferSoundObjectAction")
@Messages("CTL_ReplaceWithBufferSoundObjectAction=Repl&ace with SoundObject in Buffer")
@ActionReference(path = "blue/score/actions", position = 60)
public final class ReplaceWithBufferSoundObjectAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends ScoreObject> scoreObjects;
    private final Collection<? extends SoundObject> soundObjects;
    private final Point p;
    private final ScorePath scorePath;

    public ReplaceWithBufferSoundObjectAction() {
        this(Utilities.actionsGlobalContext());
    }

    public ReplaceWithBufferSoundObjectAction(Lookup lookup) {

        super(NbBundle.getMessage(ReplaceWithBufferSoundObjectAction.class,
                "CTL_ReplaceWithBufferSoundObjectAction"));
        this.scoreObjects = lookup.lookupAll(ScoreObject.class);
        this.soundObjects = lookup.lookupAll(SoundObject.class);
        this.p = lookup.lookup(Point.class);
        this.scorePath = lookup.lookup(ScorePath.class);
    }

    @Override
    public boolean isEnabled() {
        return (soundObjects.size() > 0
                && scoreObjects.size() == soundObjects.size());
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        ScoreController.ScoreObjectBuffer buffer
                = ScoreController.getInstance().getScoreObjectBuffer();
        List<Layer> layers = scorePath.getAllLayers();

        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();
        SoundObjectLibrary sObjLib = data.getSoundObjectLibrary();

        List<Instance> instances = new ArrayList<>();
        ReplaceScoreObjectEdit top = null;
        for (SoundObject sObj : soundObjects) {
            SoundObject replacement = getReplacementObject(buffer, instances);
            replacement.setStartTime(sObj.getStartTime());
            replacement.setSubjectiveDuration(sObj.getSubjectiveDuration());

            ScoreObjectLayer layer = (ScoreObjectLayer) findLayerForSoundObject(
                    layers, sObj);
            layer.remove(sObj);
            layer.add(replacement);

            ReplaceScoreObjectEdit edit = new ReplaceScoreObjectEdit(layer, sObj,
                    replacement);

            if (top == null) {
                top = edit;
            } else {
                top.addEdit(edit);
            }
        }

        //FIXME - this part is not undoable...
        sObjLib.checkAndAddInstanceSoundObjects(instances);

        BlueUndoManager.setUndoManager("score");
        BlueUndoManager.addEdit(top);
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new ReplaceWithBufferSoundObjectAction(actionContext);
    }

    protected SoundObject getReplacementObject(ScoreController.ScoreObjectBuffer buffer,
            List<Instance> instances) {
        if (buffer.scoreObjects.size() == 1) {
            SoundObject sObj = (SoundObject) buffer.scoreObjects.get(0).deepCopy();
            if (sObj instanceof Instance) {
                instances.add((Instance) sObj);
            }
            return sObj;
        }

        PolyObject pObj = new PolyObject();

        int minLayer = Integer.MAX_VALUE;
        int maxLayer = Integer.MIN_VALUE;

        for (Integer layerIndex : buffer.layerIndexes) {
            if (layerIndex < minLayer) {
                minLayer = layerIndex;
            }
            if (layerIndex > maxLayer) {
                maxLayer = layerIndex;
            }
        }

        int numLayers = maxLayer - minLayer + 1;

        for (int i = 0; i < numLayers; i++) {
            pObj.newLayerAt(-1);
        }

        for (int i = 0; i < buffer.scoreObjects.size(); i++) {
            ScoreObject scoreObj = buffer.scoreObjects.get(i);
            int layerIndex = buffer.layerIndexes.get(i);
            SoundLayer layer = pObj.get(layerIndex - minLayer);

            SoundObject clone = (SoundObject) scoreObj.deepCopy();
            layer.add(clone);

            if (clone instanceof Instance) {
                instances.add((Instance) clone);
            }

        }
        return pObj;
    }

    private Layer findLayerForSoundObject(List<Layer> layers, SoundObject sObj) {
        for (Layer layer : layers) {
            if (layer.contains(sObj)) {
                return layer;
            }
        }

        return null;
    }

}
