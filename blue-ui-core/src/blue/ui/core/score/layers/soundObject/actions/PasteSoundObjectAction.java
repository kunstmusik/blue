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
package blue.ui.core.score.layers.soundObject.actions;

import blue.BlueData;
import blue.SoundLayer;
import blue.SoundObjectLibrary;
import blue.projects.BlueProjectManager;
import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.ScoreObjectLayer;
import blue.soundObject.Instance;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.undo.AddSoundObjectEdit;
import blue.undo.BlueUndoManager;
import blue.utility.ScoreUtilities;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
        id = "blue.ui.core.score.layers.soundObject.actions.PasteSoundObjectAction")
@ActionRegistration(
        displayName = "#CTL_PasteSoundObjectAction")
@Messages("CTL_PasteSoundObjectAction=Paste")
@ActionReference(path = "blue/score/layers/soundObject/actions",
        position = 50)
public final class PasteSoundObjectAction extends AbstractAction implements ContextAwareAction {

    private Collection<? extends ScoreObject> scoreObjects;
    private Point p;
    private TimeState timeState;

    public PasteSoundObjectAction() {
        this(null, null, null);
    }

    private PasteSoundObjectAction(Collection<? extends ScoreObject> scoreObjects,
            Point p, TimeState timeState) {
        super(NbBundle.getMessage(PasteSoundObjectAction.class,
                "CTL_PasteSoundObjectAction"));
        this.scoreObjects = scoreObjects;
        this.p = p;
        this.timeState = timeState;
    }

    @Override
    public boolean isEnabled() {
        ScoreController.ScoreObjectBuffer buffer = ScoreController.getInstance().getScoreObjectBuffer();
        Score score = ScoreController.getInstance().getScore();
        int y = score.getGlobalLayerIndexForY(p.y);

        return buffer.scoreObjects.size() > 0 && y >= 0;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        float start = (float) p.x / timeState.getPixelSecond();

        if (timeState.isSnapEnabled()) {
            start = ScoreUtilities.getSnapValueStart(start,
                    timeState.getSnapValue());
        }

        Score score = ScoreController.getInstance().getScore();
        ScoreController.ScoreObjectBuffer buffer = ScoreController.getInstance().getScoreObjectBuffer();
        List<Layer> allLayers = score.getAllLayers();
        int selectedLayerIndex = score.getGlobalLayerIndexForY(p.y);

        int minLayer = Integer.MAX_VALUE;
        int maxLayer = Integer.MIN_VALUE;
        float bufferStart = Float.POSITIVE_INFINITY;

        for (int i = 0; i < buffer.scoreObjects.size(); i++) {
            ScoreObject scoreObj = buffer.scoreObjects.get(i);
            int layer = buffer.layerIndexes.get(i);

            if (scoreObj.getStartTime() < bufferStart) {
                bufferStart = scoreObj.getStartTime();
            }
            if (layer < minLayer) {
                minLayer = layer;
            }
            if (layer > maxLayer) {
                maxLayer = layer;
            }
        }

        int layerTranslation = selectedLayerIndex - minLayer;
        float startTranslation = start - bufferStart;

        if ((maxLayer + layerTranslation) >= allLayers.size()) {
            JOptionPane.showMessageDialog(null, "Not Enough Layers to Paste");
            return;
        }

        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();
        SoundObjectLibrary sObjLib = data.getSoundObjectLibrary();

        AddSoundObjectEdit undoEdit = null;

        // FIXME - Need a generic way to handle shadow objects; perhaps need to
        // deal with this in the model...
        Set<Instance> instanceSoundObjects = new HashSet<Instance>();

        for (int i = 0; i < buffer.scoreObjects.size(); i++) {
            ScoreObject sObj = buffer.scoreObjects.get(i).clone();

            int newLayerIndex = buffer.layerIndexes.get(i) + layerTranslation;

            if (sObj instanceof Instance) {
                instanceSoundObjects.add((Instance) sObj);
            } else if (sObj instanceof PolyObject) {
                PolyObject pObj = (PolyObject) sObj;
                getInstancesFromPolyObject(instanceSoundObjects, pObj);
            }

            sObj.setStartTime(sObj.getStartTime() + startTranslation);

            ((ScoreObjectLayer<ScoreObject>)allLayers.get(newLayerIndex)).add(sObj);
            // FIXME - fix undoable edits
//            sCanvas.getPolyObject().addSoundObject(newLayerIndex, sObj);

//            AddSoundObjectEdit tempEdit = new AddSoundObjectEdit(sCanvas
//                    .getPolyObject(), sObj, newLayerIndex);
//
//            if (undoEdit == null) {
//                undoEdit = tempEdit;
//            } else {
//                undoEdit.addSubEdit(tempEdit);
//            }
        }

        checkAndAddInstanceSoundObjects(sObjLib, instanceSoundObjects);

//        BlueUndoManager.setUndoManager("score");
//        BlueUndoManager.addEdit(undoEdit);

    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new PasteSoundObjectAction(
                actionContext.lookupAll(ScoreObject.class),
                actionContext.lookup(Point.class),
                actionContext.lookup(TimeState.class));
    }

    private void getInstancesFromPolyObject(Set<Instance> instanceSoundObjects, 
            PolyObject pObj) {
        for (SoundLayer layer : pObj) {
            for (SoundObject sObj : layer) {
                if (sObj instanceof Instance) {
                    Instance instance = (Instance) sObj;
                    instanceSoundObjects.add(instance);
                } else if (sObj instanceof PolyObject) {
                    getInstancesFromPolyObject(instanceSoundObjects,
                            (PolyObject) sObj);
                }
            }
        }
    }

    private void checkAndAddInstanceSoundObjects(SoundObjectLibrary sObjLib, 
            Set<Instance> instanceSoundObjects) {
        Map<SoundObject, SoundObject> originalToCopyMap = new HashMap<>();

        for (Instance instance : instanceSoundObjects) {
            final SoundObject instanceSObj = instance.getSoundObject();
            if (!sObjLib.contains(instanceSObj)) {
                SoundObject copy;

                if (originalToCopyMap.containsKey(instanceSObj)) {
                    copy = originalToCopyMap.get(instanceSObj);
                } else {
                    copy = (SoundObject) instance.getSoundObject().clone();
                    sObjLib.addSoundObject(copy);
                    originalToCopyMap.put(instanceSObj, copy);
                }

                instance.setSoundObject(copy);
            }
        }
    }
}
