package blue.ui.core.score.layers.soundObject;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */

import blue.SoundLayer;
import blue.event.SelectionEvent;
import blue.event.SelectionListener;
import blue.soundObject.PolyObject;
import blue.soundObject.SoundObject;
import blue.ui.core.score.undo.MoveSoundObjectsEdit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Iterator;
import java.util.Map;
import java.util.Map.Entry;
import java.util.TreeMap;

public final class MotionBuffer extends ArrayList<SoundObjectView> implements SelectionListener {

    PolyObject pObj;

    // ArrayList buffer = new ArrayList();

    public SoundObjectView[] motionBuffer;

    public float[] initialStartTimes;

    public int[] sObjYValues;

    public int resizeWidth;

    public int minX, minY, maxY;

    private static MotionBuffer instance = null;

    private MotionBuffer() {
    }

    public static MotionBuffer getInstance() {
        if (instance == null) {
            instance = new MotionBuffer();
        }
        return instance;
    }

    @Override
    public void selectionPerformed(SelectionEvent e) {
        Object selectedItem = e.getSelectedItem();

        switch (e.getSelectionType()) {
            case SelectionEvent.SELECTION_CLEAR:
                this.clearBuffer();
                break;
            case SelectionEvent.SELECTION_SINGLE:
                if (this.contains(selectedItem)) {
                    return;
                }
                this.clearBuffer();
                this.addBufferedObject((SoundObjectView) selectedItem);
                break;
            case SelectionEvent.SELECTION_ADD:
                this.addBufferedObject((SoundObjectView) e.getSelectedItem());
                break;
            case SelectionEvent.SELECTION_REMOVE:
                ((SoundObjectView) selectedItem).deselect();
                this.remove(selectedItem);
                break;
        }

    }

    public void setPolyObject(PolyObject pObj) {
        this.pObj = pObj;
    }

    // METHODS FOR BUFFERING OBJECTS FOR MOTION
    // public void setBufferedObject(SoundObjectView sObj) {
    // clearBuffer();
    // this.add(sObj);
    // sObj.select();
    // }

    private void addBufferedObject(SoundObjectView sObj) {
        if (!this.contains(sObj)) {
            this.add(sObj);
            sObj.select();
        }
    }

    private void clearBuffer() {
        SoundObjectView temp;
        for (int i = 0; i < this.size(); i++) {
            temp = (SoundObjectView) this.get(i);
            temp.deselect();
        }
        this.clear();
        motionBuffer = null;
        sObjYValues = null;
    }

    // caches the soundObject view's original x-locations
    public void motionBufferObjects() {
        if (this.size() == 0) {
            return;
        }
        motionBuffer = new SoundObjectView[this.size()];
        sObjYValues = new int[this.size()];
        initialStartTimes = new float[this.size()];

        Collections.sort(this);

        int size = this.size();

        SoundObjectView temp = (SoundObjectView) this.get(0);

        minX = temp.getX();
        minY = temp.getY();
        maxY = temp.getY();

        for (int i = 0; i < size; i++) {
            motionBuffer[i] = (SoundObjectView) this.get(i);
            sObjYValues[i] = motionBuffer[i].getY();
            initialStartTimes[i] = motionBuffer[i].getStartTime();

            if (sObjYValues[i] < minY) {
                minY = sObjYValues[i];
            }

            if (sObjYValues[i] > maxY) {
                maxY = sObjYValues[i];
            }
        }

        if (size == 1) {
            resizeWidth = motionBuffer[0].getWidth();
        }

    }

    public SoundObject getBufferedSoundObject() {

        if (this.size() == 0) {
            return null;
        } else if (this.size() == 1) {
            return (SoundObject) ((SoundObjectView) (this.get(0)))
                    .getSoundObject().clone();
        } else {
            return convertToPolyObject();
        }

    }

    public SoundObject[] getSoundObjectsAsArray() {
        SoundObject[] retVal = new SoundObject[this.size()];

        Collections.sort(this);

        for (int i = 0; i < this.size(); i++) {
            SoundObjectView sObjView = (SoundObjectView) this.get(i);
            retVal[i] = sObjView.getSoundObject();
        }

        return retVal;
    }

    public PolyObject getBufferedPolyObject() {
        return convertToPolyObject();
    }

    private PolyObject convertToPolyObject() {
        PolyObject temp = new PolyObject();
        SoundObjectView sObjView;

        // int layerHeight = pObj.getSoundLayerHeight();

        TreeMap sObjMap = new TreeMap();

        for (int i = 0; i < this.size(); i++) {
            sObjView = (SoundObjectView) (this.get(i));

            int layerNum = pObj.getLayerNumForY(sObjView.getY());
            Integer key = new Integer(layerNum);

            if (!sObjMap.containsKey(key)) {
                sObjMap.put(key, new ArrayList());
            }

            ArrayList list = (ArrayList) sObjMap.get(key);

            list.add(sObjView.getSoundObject());
        }

        int keyMin = ((Integer) sObjMap.firstKey()).intValue();
        int keyMax = ((Integer) sObjMap.lastKey()).intValue();

        int range = (keyMax - keyMin) + 1;

        for (int i = 0; i < range; i++) {
            temp.newLayerAt(-1);
        }

        for (Iterator iter = sObjMap.entrySet().iterator(); iter.hasNext();) {
            Map.Entry entry = (Entry) iter.next();

            Integer key = (Integer) entry.getKey();
            ArrayList sObjects = (ArrayList) entry.getValue();

            int layerNum = key.intValue() - keyMin;
            SoundLayer sLayer = (SoundLayer) temp.getLayerAt(layerNum);

            for (Iterator iterator = sObjects.iterator(); iterator.hasNext();) {
                SoundObject sObj = (SoundObject) iterator.next();

                sLayer.addSoundObject((SoundObject) sObj.clone());
            }

        }

        temp.normalizeSoundObjects();
        return temp;
    }

    public MoveSoundObjectsEdit getMoveEdit(PolyObject pObj) {
        if (pObj == null) {
            return null;
        }

        int[] startIndex = new int[motionBuffer.length];
        int[] endIndex = new int[motionBuffer.length];

        float[] endingStartTimes = new float[motionBuffer.length];

        for (int i = 0; i < motionBuffer.length; i++) {
            startIndex[i] = pObj.getLayerNumForY(this.sObjYValues[i]);
            endIndex[i] = pObj.getLayerNumForY(this.motionBuffer[i].getY());
            endingStartTimes[i] = this.motionBuffer[i].getStartTime();

        }

        SoundObject[] soundObjects = new SoundObject[motionBuffer.length];

        for (int i = 0; i < motionBuffer.length; i++) {
            soundObjects[i] = motionBuffer[i].getSoundObject();
        }

        MoveSoundObjectsEdit edit = new MoveSoundObjectsEdit(pObj,
                soundObjects, startIndex, endIndex, initialStartTimes,
                endingStartTimes);

        return edit;
    }

}