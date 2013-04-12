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
package blue.score.layers.audio.core;

import blue.CompileData;
import blue.score.layers.Layer;
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
public class AudioLayer implements Layer {

    private String name = "";
    private boolean muted = false;
    private boolean solo = false;
    
    private transient Vector<PropertyChangeListener> propListeners = null;

    public AudioLayer(){
        
    }
    
    @Override
    public String getName() {
        return name;
    }

    @Override
    public void setName(String name) {
        String oldName = this.name;
        this.name = name;
        
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

    public Element saveAsXML() {
        Element retVal = new Element("patternLayer");

        retVal.setAttribute("name", getName());
        retVal.setAttribute("muted", Boolean.toString(isMuted()));
        retVal.setAttribute("solo", Boolean.toString(isSolo()));

        return retVal;
    }

    public static AudioLayer loadFromXML(Element data) {
        AudioLayer layer = new AudioLayer();

        layer.setName(data.getAttributeValue("name"));
        layer.setMuted(
                Boolean.valueOf(data.getAttributeValue("muted")).booleanValue());
        layer.setSolo(
                Boolean.valueOf(data.getAttributeValue("solo")).booleanValue());

        return layer;
    }

    void clearListeners() {
        //
    }

    NoteList generateForCSD(CompileData compileData, float startTime, float endTime, int patternBeatsLength) throws SoundObjectException {
        NoteList notes = new NoteList();
       
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
            propListeners = new Vector<PropertyChangeListener>();
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
}
