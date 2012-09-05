/*
 * blue - object composition environment for csound Copyright (c) 2001-2003
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.soundObject;

import blue.*;
import blue.noteProcessor.NoteProcessorChain;
import blue.noteProcessor.NoteProcessorException;
import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.utility.ScoreUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.awt.Color;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.Map;
import java.util.Vector;

/**
 * Title: blue (Object Composition Environment) Description: Copyright:
 * Copyright (c) steven yi Company: steven yi music
 * 
 * @author steven yi
 * @created November 11, 2001
 * @version 1.0
 */
public class PolyObject extends AbstractSoundObject implements LayerGroup,
        Serializable, Cloneable, GenericViewable {

    private transient Vector<LayerGroupListener> layerGroupListeners = null;

    public static final int DISPLAY_TIME = 0;

    public static final int DISPLAY_NUMBER = 1;

    protected ArrayList<SoundLayer> soundLayers = new ArrayList<SoundLayer>();

    private boolean isRoot;

    private NoteProcessorChain npc = new NoteProcessorChain();

    private int timeBehavior;

    float repeatPoint = -1.0f;

    private int defaultHeightIndex = 0;
    
    private TimeState timeState = null;

    public PolyObject() {
        setName("polyObject");
        this.isRoot = false;
        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
        this.setBackgroundColor(new Color(102, 102, 153));
    }

    public PolyObject(boolean isRoot) {
        setName("SoundObject Layer Group");
        this.isRoot = isRoot;
        this.setBackgroundColor(new Color(102, 102, 153));
    }
   
    /**
     * Returns all soundObjects for this polyObject. Does not enter into
     * polyObjects to get their soundObjects
     * 
     * @return
     */
    public final ArrayList getSoundObjects(boolean grabMutedSoundObjects) {
        ArrayList sObjects = new ArrayList();
        SoundLayer sLayer;
        for (int i = 0; i < soundLayers.size(); i++) {
            sLayer = (SoundLayer) soundLayers.get(i);

            if (!grabMutedSoundObjects && sLayer.isMuted()) {
                continue;
            }

            ArrayList temp = sLayer.getSoundObjects();

            sObjects.addAll(temp);
        }
        return sObjects;
    }

    public final void addSoundObject(int layerIndex, SoundObject sObj) {
        SoundLayer temp = (SoundLayer) soundLayers.get(layerIndex);
        temp.addSoundObject(sObj);
    }

    /**
     * 
     * Removes a soundObject and returns what soundLayerIndex it was on (return
     * value used for undoable edit)
     * 
     * @param sObj
     * @return
     */
    public final int removeSoundObject(SoundObject sObj) {
        for (int i = 0; i < soundLayers.size(); i++) {
            SoundLayer tempLayer = (SoundLayer) soundLayers.get(i);
            if (tempLayer.contains(sObj)) {
                tempLayer.removeSoundObject(sObj);
                return i;
            }
        }
        return -1;
    }

    // public accessor methods
    //FIXME
    public float getObjectiveDuration() {
        float totalDuration;
        try {
            totalDuration = ScoreUtilities.getTotalDuration(this.
                    generateForCSD(
                    null, -1.0f, -1.0f, false));
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
        return totalDuration;
    }

    public NoteProcessorChain getNoteProcessorChain() {
        return npc;
    }

    public void setNoteProcessorChain(NoteProcessorChain npc) {
        this.npc = npc;
    }

    public TimeState getTimeState() {
        return timeState;
    }

    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
    }
    
    


    /** ************************************************* */
    /**
     * Shifts soundObjects so first object starts at 0.0f Called by
     * SoundObjectBuffer when creating a new PolyObject from a group of
     * SoundObjects
     */
    public final void normalizeSoundObjects() {
        ArrayList sObjects = this.getSoundObjects(true);
        int size = sObjects.size();

        if (size == 0) {
            return;
        }

        float min = ((SoundObject) (sObjects.get(0))).getStartTime();
        SoundObject temp;

        for (int i = 1; i < size; i++) {
            temp = (SoundObject) (sObjects.get(i));
            if (temp.getStartTime() < min) {
                min = temp.getStartTime();
            }
        }

        for (int i = 0; i < size; i++) {
            temp = (SoundObject) (sObjects.get(i));
            temp.setStartTime(temp.getStartTime() - min);
        }

        this.setSubjectiveDuration(ScoreUtilities.getMaxTime(sObjects));

    }

    //
    /**
     * called by ScoreTimeCanvas, returns the maxTime of the polyobject calls
     * getMaxTime on each soundLayer
     * 
     * @return The maxTime value
     */
    public final float getMaxTime() {
        SoundLayer tempSLayer;
        int size = soundLayers.size();
        float max = 0.0f;
        float temp;

        for (int i = 0; i < size; i++) {
            tempSLayer = ((SoundLayer) soundLayers.get(i));
            temp = tempSLayer.getMaxTime();
            if (temp > max) {
                max = temp;
            }
        }
        return max;
    }

    protected float getAdjustedRenderStart(float renderStart) {
        if (this.isRoot) {
            return renderStart;
        }

        if (renderStart <= 0.0f || !isAdjustedTimeCalculateable()) {
            return 0.0f;
        }

        float adjustedStart = renderStart - this.getStartTime();

        float internalDur = ScoreUtilities.getMaxTimeWithEmptyCheck(getSoundObjects(
                false));

        float multiplier = getSubjectiveDuration() / internalDur;

        return adjustedStart * multiplier;
    }

    protected float getAdjustedRenderEnd(float renderEnd) {
        if (this.isRoot || renderEnd < 0.0f) {
            return renderEnd;
        }

        if (renderEnd >= this.getStartTime() + this.getSubjectiveDuration()) {
            return -1.0f;
        }

        if (!isAdjustedTimeCalculateable()) {
            return -1.0f;
        }

        float adjustedEnd = renderEnd - this.getStartTime();

        float internalDur = ScoreUtilities.getMaxTimeWithEmptyCheck(getSoundObjects(
                false));

        float multiplier = getSubjectiveDuration() / internalDur;

        return adjustedEnd * multiplier;

    }

    /* CSD GENERATION CODE */
    
    @Override
    public boolean hasSoloLayers() {
        for(SoundLayer layer : soundLayers) {
            if(layer.isSolo()) {
                return true;
            }
        }
        return false;
    }
    
    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime) {
        return generateForCSD(compileData, startTime, endTime, true);
    }
    
    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime, boolean processWithSolo) {
        
        NoteList noteList = new NoteList();
        
        if(processWithSolo) {
            for(SoundLayer soundLayer : soundLayers) {
                if (soundLayer.isSolo()) {
                    if (!soundLayer.isMuted()) {
                        noteList.merge(soundLayer.generateForCSD(compileData, startTime, endTime));
                    }
                }
            }
        } else {
            for(SoundLayer soundLayer : soundLayers) {
                if (!soundLayer.isMuted()) {
                    noteList.merge(soundLayer.generateForCSD(compileData, startTime, endTime));
                }
            }
        }

        noteList = processNotes(compileData, noteList, startTime, endTime);

        return noteList;
        
    }
   
    private NoteList processNotes(CompileData compileData, NoteList nl, float start, float endTime) {
        
        NoteList retVal = null;
        
        try {
            ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new RuntimeException(new SoundObjectException(this, e));
        }

        int timeBehavior = isRoot ? SoundObject.TIME_BEHAVIOR_NONE : this.
                getTimeBehavior();

        ScoreUtilities.applyTimeBehavior(nl, timeBehavior, this.
                getSubjectiveDuration(), this.getRepeatPoint());

        ScoreUtilities.setScoreStart(nl, startTime);

        if (start == 0.0f) {
            retVal = nl;
        } else {
            ScoreUtilities.setScoreStart(nl, -start);

            NoteList buffer = new NoteList();
            Note tempNote;

            for (int i = 0; i < nl.size(); i++) {
                tempNote = nl.getNote(i);

                if (tempNote.getStartTime() >= 0) {
                    buffer.addNote(tempNote);
                }
            }
            retVal = buffer;
        }

        if (endTime > start) {
            // float dur = endTime - start;

            NoteList buffer = new NoteList();
            Note tempNote;

            for (int i = 0; i < retVal.size(); i++) {
                tempNote = retVal.getNote(i);

                if (tempNote.getStartTime() <= endTime) {
                    buffer.addNote(tempNote);
                }
            }
            retVal = buffer;
        }

        return retVal;
    }

    public Object clone() {
        PolyObject pObj = new PolyObject();

        pObj.setRoot(this.isRoot());
        pObj.setName(this.getName());
        pObj.setStartTime(this.getStartTime());
        pObj.setSubjectiveDuration(this.getSubjectiveDuration());
        pObj.setTimeBehavior(this.getTimeBehavior());
        pObj.setRepeatPoint(this.getRepeatPoint());
        pObj.setNoteProcessorChain((NoteProcessorChain) this.
                getNoteProcessorChain().clone());
        pObj.setTimeState((TimeState)timeState.clone());

        for (Iterator iter = this.soundLayers.iterator(); iter.hasNext();) {
            SoundLayer sLayer = (SoundLayer) iter.next();
            pObj.soundLayers.add((SoundLayer) sLayer.clone());
        }

        return pObj;
    }

    public int getTimeBehavior() {
        return this.timeBehavior;
    }

    public void setTimeBehavior(int timeBehavior) {
        this.timeBehavior = timeBehavior;
    }

    public float getRepeatPoint() {
        return this.repeatPoint;
    }

    public void setRepeatPoint(float repeatPoint) {
        this.repeatPoint = repeatPoint;

        SoundObjectEvent event = new SoundObjectEvent(this,
                SoundObjectEvent.REPEAT_POINT);

        fireSoundObjectEvent(event);
    }

    public int getSoundLayerIndex(SoundObject sObj) {
        for (int i = 0; i < soundLayers.size(); i++) {
            SoundLayer tempLayer = (SoundLayer) soundLayers.get(i);
            if (tempLayer.contains(sObj)) {
                return i;
            }
        }
        return -1;

    }

    /**
     * @return
     */
    public boolean isRoot() {
        return isRoot;
    }

    public void setRoot(boolean val) {
        isRoot = val;
    }

    

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static PolyObject loadFromXML(Element data,
            Map<String, Object> objRefMap) throws Exception {
        PolyObject pObj = new PolyObject();

        SoundObjectUtilities.initBasicFromXML(data, pObj);

        Elements nodes = data.getElements();

        int heightIndex = -1;
        
        boolean oldTimeStateValuesFound = false;

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("isRoot")) {
                pObj.setRoot(Boolean.valueOf(node.getTextString()).booleanValue());
            } else if (nodeName.equals("heightIndex")) {
                int index = Integer.parseInt(node.getTextString());

                // checking if using old heightIndex values
                String val = node.getAttributeValue("version");

                if (val == null || val.length() == 0) {
                    index = index - 1;
                    index = index < 0 ? 0 : index;
                }

                heightIndex = index;

            // pObj.setHeightIndex(index);
            } else if (nodeName.equals("defaultHeightIndex")) {
                int index = Integer.parseInt(node.getTextString());
                pObj.setDefaultHeightIndex(index);
            } else if (nodeName.equals("soundLayer")) {
                pObj.soundLayers.add(SoundLayer.loadFromXML(node, objRefMap));
            } else if (nodeName.equals("timeState")) {
                pObj.timeState = TimeState.loadFromXML(node);
            } else if (!oldTimeStateValuesFound && isTimeStateValueFound(nodeName)) {
                oldTimeStateValuesFound = true;
                pObj.timeState = TimeState.loadFromXML(data);
            }
        }

        if (heightIndex >= 0) {
            for (int i = 0; i < pObj.getSize(); i++) {
                SoundLayer layer = (SoundLayer) pObj.getLayerAt(i);
                layer.setHeightIndex(heightIndex);
            }

            pObj.setDefaultHeightIndex(heightIndex);
        }

        return pObj;

    }

    /** 
     * Introduced blue 2.3.0, used to check if previous timeState values are 
     * found, signal to create a timeState value instead
     * 
     * @param node
     * @return 
     */
    
    private static boolean isTimeStateValueFound(String nodeName) {
         return nodeName.equals("pixelSecond") ||
                 nodeName.equals("snapEnabled") || 
                 nodeName.equals("snapValue") ||
                 nodeName.equals("timeDisplay") ||
                 nodeName.equals("timeUnit");
    }
    
    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(Map<Object, String> objRefMap) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("isRoot").setText(Boolean.toString(this.isRoot()));

        retVal.addElement(XMLUtilities.writeInt("defaultHeightIndex",
                defaultHeightIndex));
        
        if(timeState != null) {
            retVal.addElement(timeState.saveAsXML());
        }
        
        for (Iterator iter = soundLayers.iterator(); iter.hasNext();) {
            SoundLayer sLayer = (SoundLayer) iter.next();
            retVal.addElement(sLayer.saveAsXML(objRefMap));
        }

        return retVal;
    }

    public int getLayerNum(SoundLayer layer) {
        return soundLayers.indexOf(layer);
    }

    public int getLayerNumForY(int y) {
        int runningY = 0;

        for (int i = 0; i < soundLayers.size(); i++) {
            SoundLayer layer = (SoundLayer) soundLayers.get(i);
            runningY += layer.getSoundLayerHeight();

            if (runningY > y) {
                return i;
            }
        }

        return soundLayers.size() - 1;
    }

    public int getYForLayerNum(int layerNum) {
        int runningY = 0;
        int max = layerNum;

        int lastIndex = soundLayers.size() - 1;

        if (max > lastIndex) {
            max = lastIndex;
        }

        for (int i = 0; i < max; i++) {
            SoundLayer layer = (SoundLayer) soundLayers.get(i);
            runningY += layer.getSoundLayerHeight();
        }

        return runningY;
    }

    public int getSoundLayerHeight(int layerNum) {
        SoundLayer layer = (SoundLayer) soundLayers.get(layerNum);
        return layer.getSoundLayerHeight();
    }

    public int getTotalHeight() {
        int runningHeight = 0;

        for (int i = 0; i < soundLayers.size(); i++) {
            SoundLayer layer = (SoundLayer) soundLayers.get(i);
            runningHeight += layer.getSoundLayerHeight();
        }

        return runningHeight;
    }

    /* LAYER GROUP INTERFACE */
    
    @Override
    public Layer getLayerAt(int index) {
        return soundLayers.get(index);
    }

    @Override
    public int getSize() {
        return soundLayers.size();
    }
    
    @Override
    public Layer newLayerAt(int index) {
        
        SoundLayer sLayer = new SoundLayer();
        sLayer.setHeightIndex(getDefaultHeightIndex());
        
        if(index < 0 || index >= soundLayers.size()) {
            soundLayers.add(sLayer);
        } else {
            soundLayers.add(index, sLayer);
        }
        
        ArrayList<Layer> layers = new ArrayList<Layer>();
        layers.add(sLayer);

        int insertIndex = soundLayers.indexOf(sLayer);
        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_ADDED, insertIndex, insertIndex, layers);

        fireLayerGroupDataEvent(lde);
        
        return sLayer;
    }
    
    @Override
    public void removeLayers(int startIndex, int endIndex) {
        
        ArrayList<Layer> layers = new ArrayList<Layer>();
        
        for (int i = endIndex; i >= startIndex; i--) {
            SoundLayer sLayer = (SoundLayer) soundLayers.get(i);
            sLayer.clearListeners();

            soundLayers.remove(i);

            layers.add(sLayer);
        }

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_REMOVED, startIndex, endIndex, layers);

        fireLayerGroupDataEvent(lde);

    }
    
    @Override
    public void pushUpLayers(int startIndex, int endIndex) {
        SoundLayer a = soundLayers.remove(startIndex - 1);
        soundLayers.add(endIndex, a);

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_CHANGED, startIndex - 1, endIndex);

        fireLayerGroupDataEvent(lde);
    }

    @Override
    public void pushDownLayers(int startIndex, int endIndex) {
        SoundLayer a = soundLayers.remove(endIndex + 1);
        soundLayers.add(startIndex, a);

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_CHANGED, -startIndex, -(endIndex + 1));

        fireLayerGroupDataEvent(lde);
    }

    @Override
    public void addLayerGroupListener(LayerGroupListener l) {
        if (layerGroupListeners == null) {
            layerGroupListeners = new Vector<LayerGroupListener>();
        }

        layerGroupListeners.add(l);
    }

    @Override
    public void removeLayerGroupListener(LayerGroupListener l) {
        if (layerGroupListeners != null) {
            layerGroupListeners.remove(l);
        }
    }

    private void fireLayerGroupDataEvent(LayerGroupDataEvent lde) {
        if (layerGroupListeners == null) {
            return;
        }

        for(LayerGroupListener listener : layerGroupListeners) {
            listener.layerGroupChanged(lde);
        }
    }

    
    /****/

    public int getDefaultHeightIndex() {
        return defaultHeightIndex;
    }

    public void setDefaultHeightIndex(int defaultHeightIndex) {
        this.defaultHeightIndex = defaultHeightIndex;
    }

    /**
     * Returns if this PolyObject has any score generating SoundObjects
     * 
     * @return
     */
    public boolean isScoreGenerationEmpty() {

        ArrayList sObjects = getSoundObjects(false);

        for (Iterator iter = sObjects.iterator(); iter.hasNext();) {
            SoundObject element = (SoundObject) iter.next();

            if (element instanceof Comment) {
                continue;
            } else if (element instanceof PolyObject) {
                PolyObject pObj = (PolyObject) element;
                if (!pObj.isScoreGenerationEmpty()) {
                    return false;
                }

                continue;
            }

            return false;
        }

        return true;
    }

    public boolean isAdjustedTimeCalculateable() {
        ArrayList sObjects = getSoundObjects(false);

        for (Iterator iter = sObjects.iterator(); iter.hasNext();) {
            SoundObject element = (SoundObject) iter.next();

            if (element.getTimeBehavior() == SoundObject.TIME_BEHAVIOR_NONE) {
                return false;
            }

            if (element instanceof PolyObject) {
                PolyObject pObj = (PolyObject) element;
                if (!pObj.isAdjustedTimeCalculateable()) {
                    return false;
                }

                continue;
            }
        }

        return true;
    }

    public void onLoadComplete() {
        ArrayList sObjects;
        SoundObject sObj;

        for (int i = 0; i < soundLayers.size(); i++) {
            SoundLayer sLayer = (SoundLayer) soundLayers.get(i);
            sObjects = sLayer.getSoundObjects();

            for (int j = 0; j < sObjects.size(); j++) {
                sObj = (SoundObject) sObjects.get(j);
                if (sObj instanceof PolyObject) {
                    ((PolyObject) sObj).onLoadComplete();
                } else if (sObj instanceof OnLoadProcessable) {
                    OnLoadProcessable olp = (OnLoadProcessable) sObj;
                    if (olp.isOnLoadProcessable()) {
                        try {
                            olp.processOnLoad();
                        } catch (SoundObjectException soe) {
                            throw new RuntimeException(new SoundObjectException(this,
                                    "Error during on load processing:", soe));
                        }
                    }
                }
            }
        }
    }

}