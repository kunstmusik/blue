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
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.ScoreObjectLayer;
import blue.soundObject.Instance;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import blue.ui.core.score.undo.AddScoreObjectEdit;
import blue.ui.core.score.undo.CompoundAppendable;
import blue.undo.BlueUndoManager;
import blue.utility.ScoreUtilities;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
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
import org.openide.util.Utilities;

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
    private final ScorePath scorePath;

    public PasteSoundObjectAction() {
        this(Utilities.actionsGlobalContext());
    }

    private PasteSoundObjectAction(Lookup lookup) {
        super(NbBundle.getMessage(PasteSoundObjectAction.class,
                "CTL_PasteSoundObjectAction"));

        this.scoreObjects = lookup.lookupAll(ScoreObject.class);
        this.p = lookup.lookup(Point.class);
        this.timeState = lookup.lookup(TimeState.class);
        this.scorePath = lookup.lookup(ScorePath.class);
    }

    @Override
    public boolean isEnabled() {
        ScoreController.ScoreObjectBuffer buffer
                = ScoreController.getInstance().getScoreObjectBuffer();

        return buffer.scoreObjects.size() > 0
                && scorePath.getGlobalLayerForY(p.y) != null;
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        double start = (double) p.x / timeState.getPixelSecond();

        if (timeState.isSnapEnabled()) {
            start = ScoreUtilities.getSnapValueStart(start,
                    timeState.getSnapValue());
        }

        ScoreController.ScoreObjectBuffer buffer = ScoreController.getInstance().getScoreObjectBuffer();
        List<Layer> allLayers = scorePath.getAllLayers();
        int selectedLayerIndex = scorePath.getGlobalLayerIndexForY(p.y);

        int minLayer = Integer.MAX_VALUE;
        int maxLayer = Integer.MIN_VALUE;
        double bufferStart = Double.POSITIVE_INFINITY;

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
        double startTranslation = start - bufferStart;

        if ((maxLayer + layerTranslation) >= allLayers.size()) {
            JOptionPane.showMessageDialog(null, "Not Enough Layers to Paste");
            return;
        }

        for (int i = 0; i < buffer.scoreObjects.size(); i++) {
            ScoreObject scoreObj = buffer.scoreObjects.get(i);
            int index = buffer.layerIndexes.get(i);
            Layer layer = allLayers.get(index + layerTranslation);

            if (!layer.accepts(scoreObj)) {
                JOptionPane.showMessageDialog(null,
                        "Unable to paste due to target layers not "
                        + "accepting types of objects within the copy buffer (i.e. trying to "
                        + "paste a SoundObject into an AudioLayer");
                return;
            }
        }

        BlueData data = BlueProjectManager.getInstance().getCurrentBlueData();
        SoundObjectLibrary sObjLib = data.getSoundObjectLibrary();

        CompoundAppendable compoundEdit = new CompoundAppendable();

        // FIXME - Need a generic way to handle shadow objects; perhaps need to
        // deal with this in the model...
        List<Instance> instanceSoundObjects = new ArrayList<>();

        List<ScoreObject> copies = buffer.scoreObjects.stream()
                .map(s -> s.deepCopy())
                .collect(Collectors.toList());

        for (int i = 0; i < copies.size(); i++) {
            ScoreObject sObj = copies.get(i);

            int newLayerIndex = buffer.layerIndexes.get(i) + layerTranslation;

            if (sObj instanceof Instance) {
                instanceSoundObjects.add((Instance) sObj);
            } else if (sObj instanceof PolyObject) {
                PolyObject pObj = (PolyObject) sObj;
                getInstancesFromPolyObject(instanceSoundObjects, pObj);
            }

            sObj.setStartTime(sObj.getStartTime() + startTranslation);

            ScoreObjectLayer<ScoreObject> layer
                    = (ScoreObjectLayer<ScoreObject>) allLayers.get(newLayerIndex);
            layer.add(sObj);

            AddScoreObjectEdit tempEdit = new AddScoreObjectEdit(layer, sObj);

            compoundEdit.addEdit(tempEdit);
        }

        checkAndAddInstanceSoundObjects(sObjLib, instanceSoundObjects);

        final var top = compoundEdit.getTopEdit();
        if (top != null) {
            BlueUndoManager.setUndoManager("score");
            BlueUndoManager.addEdit(top);
        }

        ScoreController.getInstance().setSelectedScoreObjects(copies);
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new PasteSoundObjectAction(actionContext);
    }

    private void getInstancesFromPolyObject(List<Instance> instanceSoundObjects,
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
            List<Instance> instanceSoundObjects) {
        Map<SoundObject, SoundObject> originalToCopyMap = new HashMap<>();

        for (Instance instance : instanceSoundObjects) {
            final SoundObject instanceSObj = instance.getSoundObject();
            if (!sObjLib.contains(instanceSObj)) {
                SoundObject copy;

                if (originalToCopyMap.containsKey(instanceSObj)) {
                    copy = originalToCopyMap.get(instanceSObj);
                } else {
                    copy = instance.getSoundObject().deepCopy();
                    sObjLib.addSoundObject(copy);
                    originalToCopyMap.put(instanceSObj, copy);
                }

                instance.setSoundObject(copy);
            }
        }
    }
}
