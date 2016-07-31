/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
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
package blue.score.layers.patterns.core;

import blue.CompileData;
import blue.score.ScoreObject;
import blue.score.layers.Layer;
import static blue.score.layers.Layer.LAYER_HEIGHT;
import blue.soundObject.GenericScore;
import blue.soundObject.NoteList;
import blue.soundObject.SoundObject;
import blue.soundObject.SoundObjectException;
import blue.utility.ObjectUtilities;
import blue.utility.ScoreUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.Iterator;
import java.util.Vector;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 *
 * @author stevenyi
 *
 */
public class PatternLayer implements Layer {

    private SoundObject soundObject = new GenericScore();
    private String name = "";
    private boolean muted = false;
    private boolean solo = false;
    private PatternData patternData = new PatternData();
    
    private transient Vector<PropertyChangeListener> propListeners = null;

    public PatternLayer(){
        this.soundObject.setStartTime(0);
        this.soundObject.setSubjectiveDuration(4.0f);
        this.soundObject.setTimeBehavior(SoundObject.TIME_BEHAVIOR_NONE);
    }
    
    public SoundObject getSoundObject() {
        return soundObject;
    }

    public void setSoundObject(SoundObject soundObject) {
        this.soundObject = soundObject;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public void setName(String name) {
        String oldName = this.name;
        this.name = (name == null) ? "" : name;
        
        if(!this.name.equals(oldName)) {
            firePropertyChangeEvent(new PropertyChangeEvent(this, "name",
                    oldName, name));
        }
    }

    public boolean isMuted() {
        return muted;
    }

    public void setMuted(boolean muted) {
        this.muted = muted;
    }

    public boolean isSolo() {
        return solo;
    }

    public void setSolo(boolean solo) {
        this.solo = solo;
    }

    public PatternData getPatternData() {
        return patternData;
    }

    public Element saveAsXML() {
        Element retVal = new Element("patternLayer");

        if (soundObject != null) {
            retVal.addElement(soundObject.saveAsXML(null));
        }
        retVal.addElement(patternData.saveAsXML());
        retVal.setAttribute("name", getName());
        retVal.setAttribute("muted", Boolean.toString(isMuted()));
        retVal.setAttribute("solo", Boolean.toString(isSolo()));

        return retVal;
    }

    public static PatternLayer loadFromXML(Element data) {
        PatternLayer layer = new PatternLayer();

        layer.setName(data.getAttributeValue("name"));
        layer.setMuted(
                Boolean.valueOf(data.getAttributeValue("muted")).booleanValue());
        layer.setSolo(
                Boolean.valueOf(data.getAttributeValue("solo")).booleanValue());

        Elements nodes = data.getElements();

        int heightIndex = -1;

        boolean oldTimeStateValuesFound = false;

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if ("soundObject".equals(nodeName)) {
                try {
                    layer.setSoundObject((SoundObject) ObjectUtilities.loadFromXML(
                            node, null));
                } catch (Exception ex) {
                    Logger.getLogger(PatternLayer.class.getName()).log(
                            Level.SEVERE,
                            null, ex);
                }
            } else if (nodeName.equals("patternData")) {
                layer.patternData = PatternData.loadFromXML(node);
            }
        }

        return layer;
    }

    void clearListeners() {
        //
    }

    NoteList generateForCSD(CompileData compileData, float startTime, float endTime, int patternBeatsLength) throws SoundObjectException {
        NoteList notes = new NoteList();

        this.soundObject.setStartTime(0);
        //this.soundObject.setSubjectiveDuration(patternBeatsLength);
        //this.soundObject.setTimeBehavior(SoundObject.TIME_BEHAVIOR_NONE);
        NoteList tempNotes = this.soundObject.generateForCSD(compileData, -1, -1);
        
        
        int currentIndex = (int)(startTime / patternBeatsLength);
        while(currentIndex < this.patternData.getSize()) {
            
            if(this.patternData.isPatternSet(currentIndex)) {
                float time = currentIndex * patternBeatsLength;
                final NoteList copy = (NoteList)tempNotes.clone();
                ScoreUtilities.setScoreStart(copy, time);
                notes.addAll(copy);
            }
            
            currentIndex++;   
        }
       
        return notes;
    }
    
     /* Property Change Event Code */

    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (propListeners == null) {
            return;
        }

        Iterator iter = new Vector(propListeners).iterator();

        while (iter.hasNext()) {
            PropertyChangeListener listener = (PropertyChangeListener) iter
                    .next();

            listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (propListeners == null) {
            propListeners = new Vector<>();
        }

        if (propListeners.contains(pcl)) {
            return;
        }

        propListeners.add(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (propListeners == null) {
            return;
        }
        propListeners.remove(pcl);
    }


    @Override
    public int getLayerHeight() {
        return LAYER_HEIGHT;    
    }

    @Override
    public boolean accepts(ScoreObject object) {
        return false;
    }

    @Override
    public boolean contains(ScoreObject object) {
        return false;
    }

    @Override
    public boolean remove(ScoreObject object) {
        return false;
    }
    
    @Override
    public int hashCode() {
        return System.identityHashCode(this);
    }

    @Override
    public boolean equals(Object obj) {
        return obj == this;
    }
}
