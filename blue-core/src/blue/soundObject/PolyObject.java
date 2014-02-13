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
import blue.score.ScoreObject;
import blue.score.TimeState;
import blue.score.layers.Layer;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.score.layers.ScoreObjectLayerGroup;
import blue.utility.ScoreUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.awt.Color;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
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
public class PolyObject extends ArrayList<SoundLayer> implements SoundObject, 
        ScoreObjectLayerGroup<SoundLayer>,
        Serializable, Cloneable, GenericViewable {

    private transient Vector<LayerGroupListener> layerGroupListeners = null;
    public static final int DISPLAY_TIME = 0;
    public static final int DISPLAY_NUMBER = 1;
    private boolean isRoot;
    protected float subjectiveDuration = 2.0f;
    protected float startTime = 0.0f;
    protected String name = "";
    protected Color backgroundColor = Color.DARK_GRAY;
    transient Vector<SoundObjectListener> soundObjectListeners = null;
    private NoteProcessorChain npc = new NoteProcessorChain();
    private int timeBehavior;
    float repeatPoint = -1.0f;
    private int defaultHeightIndex = 0;
    private TimeState timeState = new TimeState();

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
    public final List<SoundObject> getSoundObjects(boolean grabMutedSoundObjects) {
        List<SoundObject> sObjects = new ArrayList<>();

        for (SoundLayer sLayer : this) {
            
            if (!grabMutedSoundObjects && sLayer.isMuted()) {
                continue;
            }

            sObjects.addAll(sLayer);
        }
        return sObjects;
    }

    public final void addSoundObject(int layerIndex, SoundObject sObj) {
        SoundLayer temp = this.get(layerIndex);
        temp.add(sObj);
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
        for (int i = 0; i < this.size(); i++) {
            SoundLayer tempLayer = (SoundLayer) this.get(i);
            if (tempLayer.contains(sObj)) {
                tempLayer.remove(sObj);
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

    /**
     * *************************************************
     */
    /**
     * Shifts soundObjects so first object starts at 0.0f Called by
     * SoundObjectBuffer when creating a new PolyObject from a group of
     * SoundObjects
     */
    public final void normalizeSoundObjects() {
        List<SoundObject> sObjects = this.getSoundObjects(true);
        int size = sObjects.size();

        if (size == 0) {
            return;
        }

        float min = sObjects.get(0).getStartTime();
        SoundObject temp;

        for (int i = 1; i < size; i++) {
            temp = sObjects.get(i);
            if (temp.getStartTime() < min) {
                min = temp.getStartTime();
            }
        }

        for (int i = 0; i < size; i++) {
            temp = sObjects.get(i);
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
        float max = 0.0f;
        float temp;

        for (SoundLayer tempSLayer : this) {
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

        float internalDur = ScoreUtilities.getMaxTimeWithEmptyCheck(
                getSoundObjects(
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

        float internalDur = ScoreUtilities.getMaxTimeWithEmptyCheck(
                getSoundObjects(
                false));

        float multiplier = getSubjectiveDuration() / internalDur;

        return adjustedEnd * multiplier;

    }

    /* CSD GENERATION CODE */
    @Override
    public boolean hasSoloLayers() {
        for (SoundLayer layer : this) {
            if (layer.isSolo()) {
                return true;
            }
        }
        return false;
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime,
            float endTime) throws SoundObjectException {

        boolean soloFound = false;
        for (SoundLayer soundLayer : this) {
            if (soundLayer.isSolo()) {
                soloFound = true;
                break;
            }
        }

        return generateForCSD(compileData, startTime, endTime, soloFound);
    }

    @Override
    public NoteList generateForCSD(CompileData compileData, float startTime, float endTime, boolean processWithSolo) throws SoundObjectException {

        NoteList noteList = new NoteList();

        if (processWithSolo) {
            for (SoundLayer soundLayer : this) {
                if (soundLayer.isSolo()) {
                    if (!soundLayer.isMuted()) {
                        try {
                            noteList.merge(
                                    soundLayer.generateForCSD(compileData,
                                    startTime, endTime));
                        } catch (SoundLayerException ex) {
                            throw new SoundObjectException(this, ex);
                        }
                    }
                }
            }
        } else {
            for (SoundLayer soundLayer : this) {
                if (!soundLayer.isMuted()) {
                    try {
                        noteList.merge(soundLayer.generateForCSD(compileData,
                                startTime, endTime));
                    } catch (SoundLayerException ex) {
                        throw new SoundObjectException(this, ex);
                    }
                }
            }
        }

        noteList = processNotes(compileData, noteList, startTime, endTime);

        return noteList;

    }

    private NoteList processNotes(CompileData compileData, NoteList nl, float start, float endTime) throws SoundObjectException {

        NoteList retVal = null;

        try {
            ScoreUtilities.applyNoteProcessorChain(nl, this.npc);
        } catch (NoteProcessorException e) {
            throw new SoundObjectException(this, e);
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
                tempNote = nl.get(i);

                if (tempNote.getStartTime() >= 0) {
                    buffer.add(tempNote);
                }
            }
            retVal = buffer;
        }

        if (endTime > start) {
            // float dur = endTime - start;

            NoteList buffer = new NoteList();
            Note tempNote;

            for (int i = 0; i < retVal.size(); i++) {
                tempNote = retVal.get(i);

                if (tempNote.getStartTime() <= endTime) {
                    buffer.add(tempNote);
                }
            }
            retVal = buffer;
        }

        return retVal;
    }

    @Override
    public ScoreObject clone() {
        PolyObject pObj = new PolyObject();

        pObj.setRoot(this.isRoot());
        pObj.setName(this.getName());
        pObj.setStartTime(this.getStartTime());
        pObj.setSubjectiveDuration(this.getSubjectiveDuration());
        pObj.setTimeBehavior(this.getTimeBehavior());
        pObj.setRepeatPoint(this.getRepeatPoint());
        pObj.setNoteProcessorChain((NoteProcessorChain) this.
                getNoteProcessorChain().clone());
        pObj.setTimeState((TimeState) timeState.clone());

        for (SoundLayer sLayer : this) {
            pObj.add((SoundLayer) sLayer.clone());
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
        for (int i = 0; i < this.size(); i++) {
            SoundLayer tempLayer = (SoundLayer) this.get(i);
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

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "isRoot":
                    pObj.setRoot(
                            Boolean.valueOf(node.getTextString()).booleanValue());
                    break;
                case "heightIndex": {
                    int index = Integer.parseInt(node.getTextString());
                    // checking if using old heightIndex values
                    String val = node.getAttributeValue("version");
                    if (val == null || val.length() == 0) {
                        index = index - 1;
                        index = index < 0 ? 0 : index;
                    }
                    heightIndex = index;
                    break;
                }
                case "defaultHeightIndex": {
                    int index = Integer.parseInt(node.getTextString());
                    pObj.setDefaultHeightIndex(index);
                    break;
                }
                case "soundLayer":
                    pObj.add(SoundLayer.loadFromXML(node, objRefMap));
                    break;
                case "timeState":
                    pObj.timeState = TimeState.loadFromXML(node);
                    break;
            }
        }

        if (heightIndex >= 0) {
            for (int i = 0; i < pObj.size(); i++) {
                SoundLayer layer = pObj.get(i);
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
        return nodeName.equals("pixelSecond")
                || nodeName.equals("snapEnabled")
                || nodeName.equals("snapValue")
                || nodeName.equals("timeDisplay")
                || nodeName.equals("timeUnit");
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

        if (timeState != null) {
            retVal.addElement(timeState.saveAsXML());
        }

        for (SoundLayer sLayer : this) {
            retVal.addElement(sLayer.saveAsXML(objRefMap));
        }

        return retVal;
    }

    public int getLayerNum(SoundLayer layer) {
        return this.indexOf(layer);
    }

    public int getLayerNumForY(int y) {
        int runningY = 0;

        for (int i = 0; i < this.size(); i++) {
            SoundLayer layer = this.get(i);
            runningY += layer.getSoundLayerHeight();

            if (runningY > y) {
                return i;
            }
        }

        return this.size() - 1;
    }

    public int getYForLayerNum(int layerNum) {
        int runningY = 0;
        int max = layerNum;

        int lastIndex = this.size() - 1;

        if (max > lastIndex) {
            max = lastIndex;
        }

        for (int i = 0; i < max; i++) {
            SoundLayer layer = this.get(i);
            runningY += layer.getSoundLayerHeight();
        }

        return runningY;
    }

    public int getSoundLayerHeight(int layerNum) {
        return this.get(layerNum).getSoundLayerHeight();
    }

    public int getTotalHeight() {
        int runningHeight = 0;

        for (SoundLayer layer : this) {
            runningHeight += layer.getSoundLayerHeight();
        }

        return runningHeight;
    }

    /* LAYER GROUP INTERFACE */
    @Override
    public SoundLayer newLayerAt(int index) {

        SoundLayer sLayer = new SoundLayer();
        sLayer.setHeightIndex(getDefaultHeightIndex());

        if (index < 0 || index >= this.size()) {
            this.add(sLayer);
        } else {
            this.add(index, sLayer);
        }

        ArrayList<Layer> layers = new ArrayList<>();
        layers.add(sLayer);

        int insertIndex = this.indexOf(sLayer);
        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_ADDED, insertIndex, insertIndex, layers);

        fireLayerGroupDataEvent(lde);

        return sLayer;
    }

    @Override
    public void removeLayers(int startIndex, int endIndex) {

        ArrayList<Layer> layers = new ArrayList<>();

        for (int i = endIndex; i >= startIndex; i--) {
            SoundLayer sLayer = this.get(i);
            sLayer.clearListeners();

            this.remove(i);

            layers.add(sLayer);
        }

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_REMOVED, startIndex, endIndex, layers);

        fireLayerGroupDataEvent(lde);

    }

    @Override
    public void pushUpLayers(int startIndex, int endIndex) {
        SoundLayer a = this.remove(startIndex - 1);
        this.add(endIndex, a);

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_CHANGED, startIndex - 1, endIndex);

        fireLayerGroupDataEvent(lde);
    }

    @Override
    public void pushDownLayers(int startIndex, int endIndex) {
        SoundLayer a = this.remove(endIndex + 1);
        this.add(startIndex, a);

        LayerGroupDataEvent lde = new LayerGroupDataEvent(this,
                LayerGroupDataEvent.DATA_CHANGED, -startIndex, -(endIndex + 1));

        fireLayerGroupDataEvent(lde);
    }

    @Override
    public void addLayerGroupListener(LayerGroupListener l) {
        if (layerGroupListeners == null) {
            layerGroupListeners = new Vector<>();
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

        for (LayerGroupListener listener : layerGroupListeners) {
            listener.layerGroupChanged(lde);
        }
    }

    /**
     * *
     */
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

        List<SoundObject> sObjects = getSoundObjects(false);

        for (SoundObject element : sObjects) {
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
        List<SoundObject> sObjects = getSoundObjects(false);

        for (SoundObject element : sObjects) {
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
        SoundObject sObj;

        for (SoundLayer sLayer : this) {

            for (int j = 0; j < sLayer.size(); j++) {
                sObj = sLayer.get(j);
                if (sObj instanceof PolyObject) {
                    ((PolyObject) sObj).onLoadComplete();
                } else if (sObj instanceof OnLoadProcessable) {
                    OnLoadProcessable olp = (OnLoadProcessable) sObj;
                    if (olp.isOnLoadProcessable()) {
                        try {
                            olp.processOnLoad();
                        } catch (SoundObjectException soe) {
                            throw new RuntimeException(new SoundObjectException(
                                    this,
                                    "Error during on load processing:", soe));
                        }
                    }
                }
            }
        }
    }

    // methods from AbstractSoundObject
    public void setName(String name) {
        this.name = name;

        SoundObjectEvent event = new SoundObjectEvent(this,
                SoundObjectEvent.NAME);

        fireSoundObjectEvent(event);
    }

    public String getName() {
        return name;
    }

    public void setStartTime(float startTime) {
        this.startTime = startTime;

        SoundObjectEvent event = new SoundObjectEvent(this,
                SoundObjectEvent.START_TIME);

        fireSoundObjectEvent(event);
    }

    public float getStartTime() {
        return startTime;
    }

    public void setSubjectiveDuration(float subjectiveDuration) {
        this.subjectiveDuration = subjectiveDuration;

        SoundObjectEvent event = new SoundObjectEvent(this,
                SoundObjectEvent.DURATION);

        fireSoundObjectEvent(event);
    }

    public float getSubjectiveDuration() {
        return subjectiveDuration;
    }

    public void addSoundObjectListener(SoundObjectListener listener) {
        if (soundObjectListeners == null) {
            soundObjectListeners = new Vector<>();
        }
        soundObjectListeners.add(listener);
    }

    public void removeSoundObjectListener(SoundObjectListener listener) {
        if (soundObjectListeners == null) {
            return;
        }
        soundObjectListeners.remove(listener);
    }

    public void fireSoundObjectEvent(SoundObjectEvent sObjEvent) {
        if (soundObjectListeners == null) {
            return;
        }

        for (SoundObjectListener listener : soundObjectListeners) {
            listener.soundObjectChanged(sObjEvent);
        }
    }

    public Color getBackgroundColor() {
        return backgroundColor;
    }

    public void setBackgroundColor(Color backgroundColor) {
        this.backgroundColor = backgroundColor;

        SoundObjectEvent event = new SoundObjectEvent(this,
                SoundObjectEvent.COLOR);

        fireSoundObjectEvent(event);
    }

    @Override
    public int getLayerNumForScoreObject(ScoreObject scoreObj) {
        for(int i = 0; i < this.size(); i++) {
            if(get(i).contains(scoreObj)) {
                return i;
            }
        }
        return -1;
    }
}