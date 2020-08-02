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

import blue.SoundLayer;
import blue.score.ScoreObject;
import blue.score.layers.Layer;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScorePath;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
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
        id = "blue.ui.core.score.actions.ConvertToPolyObjectAction")
@ActionRegistration(
        displayName = "#CTL_ConvertToPolyObjectAction")
@Messages("CTL_ConvertToPolyObjectAction=Convert to &PolyObject")
@ActionReference(path = "blue/score/actions", position = 40)
public final class ConvertToPolyObjectAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends ScoreObject> scoreObjects;
    private final Collection<? extends SoundObject> soundObjects;
    private final Point p;
    private final PolyObject pObj = new PolyObject();
    private final ScorePath scorePath;

    public ConvertToPolyObjectAction() {
        this(Utilities.actionsGlobalContext());
    }

    public ConvertToPolyObjectAction(Lookup lookup) {
        super(NbBundle.getMessage(AlignRightAction.class,
                "CTL_ConvertToPolyObjectAction"));

        this.soundObjects = lookup.lookupAll(SoundObject.class);
        this.scoreObjects = lookup.lookupAll(ScoreObject.class);
        this.p = lookup.lookup(Point.class);
        this.scorePath = lookup.lookup(ScorePath.class);
    }

    @Override
    public void actionPerformed(ActionEvent e) {
        int retVal = JOptionPane.showConfirmDialog(null,
                "This operation can not be undone.\nAre you sure?");

        if (retVal != JOptionPane.OK_OPTION) {
            return;
        }

        List<Layer> allLayers = scorePath.getAllLayers();
        List<SoundObject> sObjList = new ArrayList<>();
        List<Integer> layerIndexes = new ArrayList<>();
        int layerMin = Integer.MAX_VALUE;
        int layerMax = Integer.MIN_VALUE;

        double start = Double.POSITIVE_INFINITY;

        for (SoundObject sObj : soundObjects) {
            sObjList.add(sObj);
            double sObjStart = sObj.getStartTime();

            if (sObj.getStartTime() < start) {
                start = sObj.getStartTime();
            }

            for (int i = 0; i < allLayers.size(); i++) {
                if (allLayers.get(i).contains(sObj)) {
                    layerIndexes.add(i);
                    if (i < layerMin) {
                        layerMin = i;
                    }
                    if (i > layerMax) {
                        layerMax = i;
                    }
                    break;
                }
            }
            if (sObjList.size() != layerIndexes.size()) {
                throw new RuntimeException(
                        "Error: Unable to find layer for SoundObject.");
            }
        }

        int numLayers = layerMax - layerMin + 1;
        for (int i = 0; i < numLayers; i++) {
            pObj.newLayerAt(-1);
        }

        for (int i = 0; i < sObjList.size(); i++) {
            SoundObject sObj = sObjList.get(i);
            int layerNum = layerIndexes.get(i);
            SoundLayer layer = (SoundLayer) allLayers.get(layerNum);
            layer.remove(sObj);
            pObj.get(layerNum - layerMin).add(sObj); // don't need to clone here...
        }

        pObj.normalizeSoundObjects();
        pObj.setStartTime(start);

        ((SoundLayer)scorePath.getGlobalLayerForY(p.y)).add(pObj);
        ScoreController.getInstance().setSelectedScoreObjects(
                Collections.singleton(pObj));
    }

    @Override
    public boolean isEnabled() {
        Layer layer = scorePath.getGlobalLayerForY(p.y);
        return (soundObjects.size() > 0
                && scoreObjects.size() == soundObjects.size()
                && layer != null
                && layer.accepts(pObj));
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new ConvertToPolyObjectAction(actionContext);
    }

    //FIXME - code above should register an undoable edit
//    public void removeSoundObjects(Collection<? extends SoundObject> selectedObjects, PolyObject pObj) {
//        RemoveSoundObjectEdit firstEdit = null;
//        RemoveSoundObjectEdit lastEdit = null;
//        RemoveSoundObjectEdit temp;
//
//        for (SoundObject sObj : selectedObjects) {
//            int sLayerIndex = pObj.removeSoundObject(sObj);
//
//            if (firstEdit == null) {
//                firstEdit = new RemoveSoundObjectEdit(pObj, sObj,
//                        sLayerIndex);
//                lastEdit = firstEdit;
//            } else {
//                temp = new RemoveSoundObjectEdit(pObj, sObj,
//                        sLayerIndex);
//                lastEdit.setNextEdit(temp);
//                lastEdit = temp;
//            }
//        }
//
//        if (firstEdit != null) {
//            BlueUndoManager.setUndoManager("score");
//            BlueUndoManager.addEdit(firstEdit);
//        }
//
//    }
//
//
//    private PolyObject convertToPolyObject(PolyObject pObj, 
//            Collection<? extends SoundObject> selected) {
//        PolyObject temp = new PolyObject();
//
//        // int layerHeight = pObj.getSoundLayerHeight();
//
//        TreeMap<Integer, ArrayList<SoundObject>> sObjMap = new TreeMap<>();
//
//        double start = Double.POSITIVE_INFINITY;
//        double end = Double.NEGATIVE_INFINITY;
//        
//        for (SoundObject sObj : selected) {
//
//            int layerNum = pObj.getLayerNumForScoreObject(sObj);
//            Integer key = new Integer(layerNum);
//            double sObjStart = sObj.getStartTime();
//            double sObjEnd = sObjStart + sObj.getSubjectiveDuration();
//
//            if (!sObjMap.containsKey(key)) {
//                sObjMap.put(key, new ArrayList<SoundObject>());
//            }
//
//            ArrayList<SoundObject> list = sObjMap.get(key);
//
//            list.add(sObj);
//
//            if(sObjStart < start) {
//                start = sObjStart;
//            }
//            if(sObjEnd > end) {
//                end = sObjEnd;
//            }
//
//        }
//
//        int keyMin = ((Integer) sObjMap.firstKey()).intValue();
//        int keyMax = ((Integer) sObjMap.lastKey()).intValue();
//
//        int range = (keyMax - keyMin) + 1;
//
//        for (int i = 0; i < range; i++) {
//            temp.newLayerAt(-1);
//        }
//
//        for (Map.Entry<Integer, ArrayList<SoundObject>> entry : sObjMap.entrySet()) {
//
//            Integer key = entry.getKey();
//            ArrayList<SoundObject> sObjects = entry.getValue();
//
//            int layerNum = key.intValue() - keyMin;
//            SoundLayer sLayer = temp.get(layerNum);
//
//            for (SoundObject sObj : sObjects) {
//                sLayer.add((SoundObject) sObj.clone());
//            }
//
//        }
//
//        temp.normalizeSoundObjects();
//        temp.setStartTime(start);
//        temp.setSubjectiveDuration(end - start);
//        return temp;
//    }
}
