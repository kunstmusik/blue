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
import blue.projects.BlueProjectManager;
import blue.score.Score;
import blue.score.ScoreObject;
import blue.score.layers.LayerGroup;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.undo.RemoveSoundObjectEdit;
import blue.undo.BlueUndoManager;
import java.awt.Point;
import java.awt.event.ActionEvent;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JOptionPane;
import org.openide.DialogDisplayer;
import org.openide.NotifyDescriptor;
import static org.openide.NotifyDescriptor.ERROR_MESSAGE;
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
        id = "blue.ui.core.score.actions.ConvertToPolyObjectAction")
@ActionRegistration(
        displayName = "#CTL_ConvertToPolyObjectAction")
@Messages("CTL_ConvertToPolyObjectAction=Convert to &PolyObject")
@ActionReference(path = "blue/score/actions", position = 40)
public final class ConvertToPolyObjectAction extends AbstractAction
        implements ContextAwareAction {

    private final Collection<? extends ScoreObject> scoreObjects;
    private final Collection<? extends SoundObject> soundObjects;
    private final InstanceContent content;
    private final Point p;

    public ConvertToPolyObjectAction() {
        this(null, null, null, null);
    }

    public ConvertToPolyObjectAction(Collection<? extends ScoreObject> scoreObjects,
            Collection<? extends SoundObject> soundObjects,
            InstanceContent content,
            Point p) {
        super(NbBundle.getMessage(AlignRightAction.class,
                "CTL_ConvertToPolyObjectAction"));
        this.scoreObjects = scoreObjects;
        this.soundObjects = soundObjects;
        this.content = content;
        this.p = p;
    }

    @Override
    public void actionPerformed(ActionEvent e) {

        Score score = BlueProjectManager.getInstance().getCurrentBlueData().getScore();
        List<LayerGroup> layerGroups = score.getLayersForScoreObjects(
                scoreObjects);

        if (layerGroups.size() != 1) {
            NotifyDescriptor descriptor = new NotifyDescriptor.Message(
            "Blue does not currently support converting SoundObjects into a "
                    + "PolyObject across PolyObjects", ERROR_MESSAGE);
            DialogDisplayer.getDefault().notify(descriptor);
            return;
        }
        if(!(layerGroups.get(0) instanceof PolyObject)) {
            NotifyDescriptor descriptor = new NotifyDescriptor.Message(
            "This operation only works with SoundObjects", ERROR_MESSAGE);
            DialogDisplayer.getDefault().notify(descriptor);
            return;
        }

        PolyObject pObj = (PolyObject) layerGroups.get(0);

        int retVal = JOptionPane.showConfirmDialog(null,
                "This operation can not be undone.\nAre you sure?");

        if (retVal != JOptionPane.OK_OPTION) {
            return;
        }


        PolyObject temp = convertToPolyObject(pObj, soundObjects);
        removeSoundObjects(soundObjects, pObj);

        int index = pObj.getLayerNumForY(p.y);
        pObj.addSoundObject(index, temp);

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
        for(SoundObject sObj : soundObjects) {
            content.remove(sObj);
        }
        content.add(temp);
    }

    @Override
    public boolean isEnabled() {
        return (soundObjects.size() > 0
                && scoreObjects.size() == soundObjects.size());
    }

    @Override
    public Action createContextAwareInstance(Lookup actionContext) {
        return new ConvertToPolyObjectAction(actionContext.lookupAll(
                ScoreObject.class),
                actionContext.lookupAll(SoundObject.class),
                actionContext.lookup(InstanceContent.class),
                actionContext.lookup(Point.class)
                );
    }

    public void removeSoundObjects(Collection<? extends SoundObject> selectedObjects, PolyObject pObj) {
        RemoveSoundObjectEdit firstEdit = null;
        RemoveSoundObjectEdit lastEdit = null;
        RemoveSoundObjectEdit temp;

        for (SoundObject sObj : selectedObjects) {
            int sLayerIndex = pObj.removeSoundObject(sObj);

            if (firstEdit == null) {
                firstEdit = new RemoveSoundObjectEdit(pObj, sObj,
                        sLayerIndex);
                lastEdit = firstEdit;
            } else {
                temp = new RemoveSoundObjectEdit(pObj, sObj,
                        sLayerIndex);
                lastEdit.setNextEdit(temp);
                lastEdit = temp;
            }
        }

        if (firstEdit != null) {
            BlueUndoManager.setUndoManager("score");
            BlueUndoManager.addEdit(firstEdit);
        }

    }


    private PolyObject convertToPolyObject(PolyObject pObj, 
            Collection<? extends SoundObject> selected) {
        PolyObject temp = new PolyObject();

        // int layerHeight = pObj.getSoundLayerHeight();

        TreeMap<Integer, ArrayList<SoundObject>> sObjMap = new TreeMap<>();

        float start = Float.POSITIVE_INFINITY;
        float end = Float.NEGATIVE_INFINITY;
        
        for (SoundObject sObj : selected) {

            int layerNum = pObj.getLayerNumForScoreObject(sObj);
            Integer key = new Integer(layerNum);
            float sObjStart = sObj.getStartTime();
            float sObjEnd = sObjStart + sObj.getSubjectiveDuration();

            if (!sObjMap.containsKey(key)) {
                sObjMap.put(key, new ArrayList<SoundObject>());
            }

            ArrayList<SoundObject> list = sObjMap.get(key);

            list.add(sObj);

            if(sObjStart < start) {
                start = sObjStart;
            }
            if(sObjEnd > end) {
                end = sObjEnd;
            }

        }

        int keyMin = ((Integer) sObjMap.firstKey()).intValue();
        int keyMax = ((Integer) sObjMap.lastKey()).intValue();

        int range = (keyMax - keyMin) + 1;

        for (int i = 0; i < range; i++) {
            temp.newLayerAt(-1);
        }

        for (Map.Entry<Integer, ArrayList<SoundObject>> entry : sObjMap.entrySet()) {

            Integer key = entry.getKey();
            ArrayList<SoundObject> sObjects = entry.getValue();

            int layerNum = key.intValue() - keyMin;
            SoundLayer sLayer = temp.get(layerNum);

            for (SoundObject sObj : sObjects) {
                sLayer.add((SoundObject) sObj.clone());
            }

        }

        temp.normalizeSoundObjects();
        temp.setStartTime(start);
        temp.setSubjectiveDuration(end - start);
        return temp;
    }
}
