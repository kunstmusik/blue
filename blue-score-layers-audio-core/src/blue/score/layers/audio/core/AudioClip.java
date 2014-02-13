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

import blue.score.ScoreObject;
import blue.utility.ObjectUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.File;
import java.io.IOException;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;
import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.UnsupportedAudioFileException;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class AudioClip implements ScoreObject, Serializable, Comparable<AudioClip> {

    String name = "";
    File audioFile = null;
    int numChannels = 0;
    float audioDuration = 0.0f;
    float start = 0.0f;
    float duration = 0.0f;
    transient List<PropertyChangeListener> propListeners = null;

    public AudioClip() {
    }

    protected void readAudioFileProperties() {
        AudioFileFormat aFormat;
        try {
            aFormat = AudioSystem.getAudioFileFormat(audioFile);
            AudioFormat format = aFormat.getFormat();

            numChannels = format.getChannels();
            audioDuration = aFormat.getByteLength()
                    / (format.getSampleRate() * (format.getSampleSizeInBits() / 8) * format
                    .getChannels());

        } catch (UnsupportedAudioFileException | IOException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    // GETTERS/SETTERS 
    public File getAudioFile() {
        return audioFile;
    }

    public void setAudioFile(File audioFile) {
        File old = this.audioFile;
        this.audioFile = audioFile;
        readAudioFileProperties();
        duration = audioDuration;
    }

    public float getAudioDuration() {
        return audioDuration;
    }

    public void setAudioDuration(float originalDuration) {
        this.audioDuration = originalDuration;
    }

    @Override
    public float getStartTime() {
        return start;
    }

    @Override
    public void setStartTime(float start) {
        if(this.start == start) return;
        float old = this.start;
        this.start = start;

        firePropertyChangeEvent("startTime", old, start);
    }

    @Override
    public float getSubjectiveDuration() {
        return duration;
    }

    @Override
    public void setSubjectiveDuration(float duration) {
        if(this.duration == duration) return;
        float old = this.duration;
        this.duration = duration;
        firePropertyChangeEvent("subjectiveDuration", old, start);
    }

    @Override
    public int compareTo(AudioClip o) {
        float diff = o.start - this.start;
        if (diff != 0) {
            return (int) diff;
        }

        return (int) (o.duration - this.duration);
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getNumChannels() {
        return numChannels;
    }

    //XML Methods 
    public Element saveAsXML() {
        Element root = new Element("audioClip");

        root.addElement("name").setText(name);
        root.addElement("audioFile").setText(audioFile.getAbsolutePath());
        root.addElement(XMLUtilities.writeInt("numChannels", numChannels));
        root.addElement(XMLUtilities.writeFloat("audioDuration", audioDuration));
        root.addElement(XMLUtilities.writeFloat("start", start));
        root.addElement(XMLUtilities.writeFloat("duration", duration));

        return root;
    }

    public static AudioClip loadFromXML(Element data) {
        AudioClip clip = new AudioClip();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            final Element node = nodes.next();
            final String nodeText = node.getTextString();

            switch (node.getName()) {
                case "name":
                    clip.name = nodeText;
                    break;
                case "audioFile":
                    clip.audioFile = new File(nodeText);
                    break;
                case "numChannels":
                    clip.numChannels = XMLUtilities.readInt(node);
                    break;
                case "audioDuration":
                    clip.audioDuration = XMLUtilities.readFloat(node);
                    break;
                case "start":
                    clip.start = XMLUtilities.readFloat(node);
                    break;
                case "duration":
                    clip.duration = XMLUtilities.readFloat(node);
                    break;
            }
        }

        return clip;
    }

    private void firePropertyChangeEvent(String param, Object oldValue, Object newValue) {
        if (propListeners == null) {
            return;
        }

        PropertyChangeEvent pce = new PropertyChangeEvent(this, param,
                oldValue, newValue);

        for (PropertyChangeListener listener : propListeners) {
           listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (propListeners == null) {
            propListeners = new ArrayList<PropertyChangeListener>();
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
    public ScoreObject clone() {
        return (ScoreObject) ObjectUtilities.clone(this);
    }


}
