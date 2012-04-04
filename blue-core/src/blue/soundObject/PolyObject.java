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
import blue.score.layers.Layer;
import blue.score.layers.LayerGroup;
import blue.score.layers.LayerGroupDataEvent;
import blue.score.layers.LayerGroupListener;
import blue.utility.ScoreUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.awt.Color;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;
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

    private transient Vector<PropertyChangeListener> listeners = null;

    private transient Vector<LayerGroupListener> layerGroupListeners = null;

    public static final int DISPLAY_TIME = 0;

    public static final int DISPLAY_NUMBER = 1;

    protected ArrayList<SoundLayer> soundLayers = new ArrayList<SoundLayer>();

    private boolean isRoot;

    private NoteProcessorChain npc = new NoteProcessorChain();

    private int pixelSecond;

    // private int heightIndex;
    private boolean snapEnabled = false;

    private float snapValue = 1.0f;

    private int timeDisplay = DISPLAY_TIME;

    private int timeUnit = 5;

    private int timeBehavior;

    float repeatPoint = -1.0f;

    private int defaultHeightIndex = 0;

    public PolyObject() {
        setName("polyObject");
        isRoot = false;
        pixelSecond = 64;
        // heightIndex = 0;
        timeBehavior = SoundObject.TIME_BEHAVIOR_SCALE;
        this.setBackgroundColor(new Color(102, 102, 153));
    }

    public PolyObject(boolean a) {
        setName("root");
        isRoot = a;
        pixelSecond = 64;
        // heightIndex = 0;
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
    public float getObjectiveDuration() {
        float totalDuration;
        try {
            totalDuration = ScoreUtilities.getTotalDuration(this.
                    generateObjectiveScore(false, -1.0f, -1.0f));
        } catch (SoundLayerException e) {
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

    /*
     * private float getMultiplier() { if(isRoot) { return 1.0f; } else { return
     * (getSubjectiveDuration() / getObjectiveDuration()); } }
     */

    /* LAYER PROPERTIES FOR DRAWING */
    public int getPixelSecond() {
        return this.pixelSecond;
    }

    public void setPixelSecond(int pixelSecond) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "pixelSecond",
                new Integer(this.pixelSecond), new Integer(pixelSecond));

        this.pixelSecond = pixelSecond;

        firePropertyChangeEvent(pce);
    }

    // public int getHeightIndex() {
    // return heightIndex;
    // }
    //
    // public void setHeightIndex(int heightIndex) {
    // PropertyChangeEvent pce = new PropertyChangeEvent(this, "heightIndex",
    // new Integer(this.heightIndex), new Integer(heightIndex));
    //
    // this.heightIndex = heightIndex;
    //
    // firePropertyChangeEvent(pce);
    // }
    public boolean isSnapEnabled() {
        return this.snapEnabled;
    }

    public void setSnapEnabled(boolean snapEnabled) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "snapEnabled",
                Boolean.valueOf(this.snapEnabled), Boolean.valueOf(snapEnabled));

        this.snapEnabled = snapEnabled;

        firePropertyChangeEvent(pce);
    }

    public float getSnapValue() {
        return this.snapValue;
    }

    public void setSnapValue(float snapValue) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "snapValue",
                new Float(this.snapValue), new Float(snapValue));

        this.snapValue = snapValue;

        firePropertyChangeEvent(pce);
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

    private final NoteList generateObjectiveScore(boolean muteCheck,
            float startTime, float endTime) throws SoundLayerException {
        NoteList notes = new NoteList();

        SoundLayer tempSLayer;
        int size = soundLayers.size();

        // check if solo is selected, if so, return only that layer's notes if
        // not muted

        boolean soloFound = false;

        for (int i = 0; i < size; i++) {
            tempSLayer = ((SoundLayer) soundLayers.get(i));
            if (tempSLayer.isSolo() && !tempSLayer.isMuted()) {
                soloFound = true;

                try {
                    notes.merge(tempSLayer.generateNotes(startTime, endTime));
                } catch (SoundLayerException e) {
                    e.setLayerNumber(i + 1);
                    throw e;
                }

            }
        }

        if (soloFound) {
            return notes;
        }

        // check if layers are muted or not and to return only notes from
        // non-muted layers
        for (int i = 0; i < size; i++) {

            tempSLayer = ((SoundLayer) soundLayers.get(i));

            try {
                if (!muteCheck) {
                    notes.merge(tempSLayer.generateNotes(startTime, endTime));
                } else if (!tempSLayer.isMuted()) {
                    notes.merge(tempSLayer.generateNotes(startTime, endTime));
                }
            } catch (SoundLayerException e) {
                e.setLayerNumber(i + 1);
                throw e;
            }

        }

        return notes;
    }

    /* SOUND OBJECT METHODS */
    public void generateGlobals(GlobalOrcSco globalOrcSco) {
        generateGlobals(globalOrcSco, 0.0f, -1.0f);
    }

    public void generateGlobals(GlobalOrcSco globalOrcSco, float startTime,
            float endTime) {
        int size = soundLayers.size();
        SoundLayer tempSLayer;

        boolean soloFound = false;

        for (int i = 0; i < size; i++) {
            tempSLayer = ((SoundLayer) soundLayers.get(i));
            if (tempSLayer.isSolo()) {
                if (!tempSLayer.isMuted()) {
                    soloFound = true;
                    tempSLayer.generateGlobals(globalOrcSco, startTime, endTime);
                }
            }
        }

        if (soloFound) {
            return;
        }

        for (int i = 0; i < size; i++) {
            tempSLayer = ((SoundLayer) soundLayers.get(i));
            if (!tempSLayer.isMuted()) {
                tempSLayer.generateGlobals(globalOrcSco, startTime, endTime);
            }
        }
    }

    public void generateFTables(Tables tables) {
        generateFTables(tables, 0.0f, -1.0f);
    }

    public void generateFTables(Tables tables, float startTime, float endTime) {
        int size = soundLayers.size();
        SoundLayer tempSLayer;

        boolean soloFound = false;

        for (int i = 0; i < size; i++) {
            tempSLayer = ((SoundLayer) soundLayers.get(i));
            if (tempSLayer.isSolo()) {
                if (!tempSLayer.isMuted()) {
                    soloFound = true;
                    tempSLayer.generateFTables(tables, startTime, endTime);
                }
            }
        }

        if (soloFound) {
            return;
        }

        for (int i = 0; i < size; i++) {
            tempSLayer = ((SoundLayer) soundLayers.get(i));
            if (!tempSLayer.isMuted()) {
                tempSLayer.generateFTables(tables, startTime, endTime);
            }
        }

    }

    public final void generateInstruments(Arrangement arrangement) {
        generateInstruments(arrangement, 0.0f, -1.0f);
    }

    public final void generateInstruments(Arrangement arrangement,
            float startTime, float endTime) {
        int size = soundLayers.size();
        SoundLayer tempSLayer;

        boolean soloFound = false;

        for (int i = 0; i < size; i++) {
            tempSLayer = ((SoundLayer) soundLayers.get(i));
            if (tempSLayer.isSolo()) {
                if (!tempSLayer.isMuted()) {
                    soloFound = true;
                    tempSLayer.generateInstruments(arrangement, startTime,
                            endTime);
                }
            }
        }

        if (soloFound) {
            return;
        }

        for (int i = 0; i < size; i++) {
            tempSLayer = ((SoundLayer) soundLayers.get(i));
            if (!tempSLayer.isMuted()) {
                tempSLayer.generateInstruments(arrangement, startTime, endTime);
            }
        }
    }

    public final NoteList generateNotes(float start, float endTime)
            throws SoundObjectException {
        // float multiplier = getMultiplier();

        NoteList retVal = null;

        NoteList nl;

        try {
            nl = this.generateObjectiveScore(true, start, endTime);
        } catch (SoundLayerException e) {
            throw new SoundObjectException(this, e);
        }

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

    //
//    public SoundObjectEditor getEditor() {
//        return new PolyObjectEditor();
//    }

    public Object clone() {
        PolyObject pObj = new PolyObject();

        // pObj.setHeightIndex(this.getHeightIndex());
        pObj.setRoot(this.isRoot());
        pObj.setName(this.getName());
        pObj.setPixelSecond(this.getPixelSecond());
        pObj.setSnapEnabled(this.isSnapEnabled());
        pObj.setSnapValue(this.getSnapValue());
        pObj.setStartTime(this.getStartTime());
        pObj.setSubjectiveDuration(this.getSubjectiveDuration());
        pObj.setTimeBehavior(this.getTimeBehavior());
        pObj.setTimeDisplay(this.getTimeDisplay());
        pObj.setTimeUnit(this.getTimeUnit());
        pObj.setRepeatPoint(this.getRepeatPoint());
        pObj.setNoteProcessorChain((NoteProcessorChain) this.
                getNoteProcessorChain().clone());

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

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "timeBehavior",
                new Integer(this.timeBehavior), new Integer(timeBehavior));

        this.timeBehavior = timeBehavior;

        firePropertyChangeEvent(pce);
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

    public int getTimeDisplay() {
        return timeDisplay;
    }

    public void setTimeDisplay(int timeDisplay) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "timeDisplay",
                new Integer(this.timeDisplay), new Integer(timeDisplay));

        this.timeDisplay = timeDisplay;

        firePropertyChangeEvent(pce);
    }

    public int getTimeUnit() {
        return timeUnit;
    }

    public void setTimeUnit(int timeUnit) {
        PropertyChangeEvent pce = new PropertyChangeEvent(this, "timeUnit",
                new Integer(this.timeUnit), new Integer(timeUnit));

        this.timeUnit = timeUnit;

        firePropertyChangeEvent(pce);
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#loadFromXML(electric.xml.Element)
     */
    public static SoundObject loadFromXML(Element data,
            SoundObjectLibrary sObjLibrary) throws Exception {
        PolyObject pObj = new PolyObject();

        SoundObjectUtilities.initBasicFromXML(data, pObj);

        Elements nodes = data.getElements();

        int heightIndex = -1;

        while (nodes.hasMoreElements()) {
            Element e = nodes.next();

            String nodeName = e.getName();

            if (nodeName.equals("isRoot")) {
                pObj.setRoot(Boolean.valueOf(e.getTextString()).booleanValue());
            } else if (nodeName.equals("pixelSecond")) {
                pObj.setPixelSecond(Integer.parseInt(e.getTextString()));
            } else if (nodeName.equals("heightIndex")) {
                int index = Integer.parseInt(e.getTextString());

                // checking if using old heightIndex values
                String val = e.getAttributeValue("version");

                if (val == null || val.length() == 0) {
                    index = index - 1;
                    index = index < 0 ? 0 : index;
                }

                heightIndex = index;

            // pObj.setHeightIndex(index);
            } else if (nodeName.equals("defaultHeightIndex")) {
                int index = Integer.parseInt(e.getTextString());
                pObj.setDefaultHeightIndex(index);
            } else if (nodeName.equals("snapEnabled")) {
                pObj.setSnapEnabled(Boolean.valueOf(e.getTextString()).
                        booleanValue());
            } else if (nodeName.equals("snapValue")) {
                pObj.setSnapValue(Float.parseFloat(e.getTextString()));
            } else if (nodeName.equals("timeDisplay")) {
                pObj.setTimeDisplay(Integer.parseInt(e.getTextString()));
            } else if (nodeName.equals("timeUnit")) {
                pObj.setTimeUnit(Integer.parseInt(e.getTextString()));
            } else if (nodeName.equals("soundLayer")) {
                pObj.soundLayers.add(SoundLayer.loadFromXML(e, sObjLibrary));
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

    /*
     * (non-Javadoc)
     * 
     * @see blue.soundObject.SoundObject#saveAsXML()
     */
    public Element saveAsXML(SoundObjectLibrary sObjLibrary) {
        Element retVal = SoundObjectUtilities.getBasicXML(this);

        retVal.addElement("isRoot").setText(Boolean.toString(this.isRoot()));

        retVal.addElement("pixelSecond").setText(
                Integer.toString(this.getPixelSecond()));

        // Element hIndexNode = XMLUtilities.writeInt("heightIndex",
        // heightIndex);
        // hIndexNode.setAttribute("version", "2");

        // retVal.addElement(hIndexNode);

        retVal.addElement(XMLUtilities.writeInt("defaultHeightIndex",
                defaultHeightIndex));
        retVal.addElement("snapEnabled").setText(
                Boolean.toString(this.isSnapEnabled()));
        retVal.addElement("snapValue").setText(
                Float.toString(this.getSnapValue()));
        retVal.addElement("timeDisplay").setText(
                Integer.toString(this.getTimeDisplay()));
        retVal.addElement("timeUnit").setText(
                Integer.toString(this.getTimeUnit()));

        for (Iterator iter = soundLayers.iterator(); iter.hasNext();) {
            SoundLayer sLayer = (SoundLayer) iter.next();
            retVal.addElement(sLayer.saveAsXML(sObjLibrary));
        }

        return retVal;
    }

    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (listeners == null) {
            return;
        }

        for (PropertyChangeListener listener : listeners) {
            listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            listeners = new Vector<PropertyChangeListener>();
        }

        listeners.add(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            return;
        }
        listeners.remove(pcl);
    }

    // /**
    // * @return
    // */
    // public int getSoundLayerHeight() {
    // return (getHeightIndex() + 1) * 22;
    // }
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

    public void processOnLoad() throws SoundObjectException {
        ArrayList sObjects;
        SoundObject sObj;

        for (int i = 0; i < soundLayers.size(); i++) {
            SoundLayer sLayer = (SoundLayer) soundLayers.get(i);
            sObjects = sLayer.getSoundObjects();

            for (int j = 0; j < sObjects.size(); j++) {
                sObj = (SoundObject) sObjects.get(j);
                if (sObj instanceof PolyObject) {
                    ((PolyObject) sObj).processOnLoad();
                } else if (sObj instanceof OnLoadProcessable) {
                    OnLoadProcessable olp = (OnLoadProcessable) sObj;
                    if (olp.isOnLoadProcessable()) {
                        try {
                            olp.processOnLoad();
                        } catch (SoundObjectException soe) {
                            throw new SoundObjectException(this,
                                    "Error during on load processing:", soe);
                        }
                    }
                }
            }
        }
    }

}