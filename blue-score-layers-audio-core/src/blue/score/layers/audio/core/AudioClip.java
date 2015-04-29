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
import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.utility.ObjectUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.awt.Color;
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
    float fileStartTime = 0.0f;
    float start = 0.0f;
    float duration = 0.0f;
    Color backgroundColor = Color.DARK_GRAY;

    transient List<ScoreObjectListener> scoreObjListeners = null;
//    transient List<PropertyChangeListener> propListeners = null;

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

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.OTHER, "audioDuration");

        fireScoreObjectEvent(event);
    }

    public float getFileStartTime() {
        return fileStartTime;
    }

    public void setFileStartTime(float fileStartTime) {
        this.fileStartTime = fileStartTime;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.OTHER, "fileStartTime");

        fireScoreObjectEvent(event);

    }

    @Override
    public float getStartTime() {
        return start;
    }

    @Override
    public void setStartTime(float start) {
        this.start = start;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.START_TIME);

        fireScoreObjectEvent(event);
    }

    @Override
    public float getSubjectiveDuration() {
        return duration;
    }

    @Override
    public void setSubjectiveDuration(float duration) {
        this.duration = (float) Math.min(duration,
                this.audioDuration - this.fileStartTime);

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.DURATION);

        fireScoreObjectEvent(event);
    }

    @Override
    public float getMaxResizeRightDiff() {
        return audioDuration - (fileStartTime + duration);
    }

    @Override
    public float getMaxResizeLeftDiff() {
        return (start < fileStartTime) ? -start : -fileStartTime;
    }

    @Override
    public void resizeLeft(float newStartTime) {

        if (newStartTime >= start + duration) {
            return;
        }

        float diff = newStartTime - start;
        float maxFileStartDiff = -fileStartTime;

        if (diff < maxFileStartDiff) {
            diff = maxFileStartDiff;
        }

        float maxDurDiff = audioDuration - duration;
        if (-diff > maxDurDiff) {
            diff = -maxDurDiff;
        }

        setFileStartTime(fileStartTime + diff);
        setStartTime(start + diff);
        setSubjectiveDuration(duration - diff);
    }

    @Override
    public void resizeRight(float newEndTime) {

        if (newEndTime <= start) {
            return;
        }

        float newDur = newEndTime - start;

        newDur = (newDur > audioDuration) ? audioDuration : newDur;

        setSubjectiveDuration(newDur);
    }

    @Override
    public int compareTo(AudioClip o) {
        float diff = o.start - this.start;
        if (diff != 0) {
            return (int) diff;
        }

        return (int) (o.duration - this.duration);
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public void setName(String name) {
        this.name = name;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.NAME);

        fireScoreObjectEvent(event);
    }

    @Override
    public Color getBackgroundColor() {
        return this.backgroundColor;
    }

    @Override
    public void setBackgroundColor(Color color) {
        this.backgroundColor = color;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.COLOR);

        fireScoreObjectEvent(event);
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
        root.addElement(XMLUtilities.writeFloat("fileStart", fileStartTime));
        root.addElement(XMLUtilities.writeFloat("start", start));
        root.addElement(XMLUtilities.writeFloat("duration", duration));

        String colorStr = Integer.toString(getBackgroundColor().getRGB());
        root.addElement("backgroundColor").setText(colorStr);

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
                case "fileStart":
                    clip.fileStartTime = XMLUtilities.readFloat(node);
                    break;
                case "start":
                    clip.start = XMLUtilities.readFloat(node);
                    break;
                case "duration":
                    clip.duration = XMLUtilities.readFloat(node);
                    break;
                case "backgroundColor":
                    String colorStr = data.getTextString("backgroundColor");
                    clip.setBackgroundColor(
                            new Color(Integer.parseInt(colorStr)));
                    break;
            }
        }

        return clip;
    }

//    private void firePropertyChangeEvent(String param, Object oldValue, Object newValue) {
//        if (propListeners == null) {
//            return;
//        }
//
//        PropertyChangeEvent pce = new PropertyChangeEvent(this, param,
//                oldValue, newValue);
//
//        for (PropertyChangeListener listener : propListeners) {
//           listener.propertyChange(pce);
//        }
//    }
//
//    public void addPropertyChangeListener(PropertyChangeListener pcl) {
//        if (propListeners == null) {
//            propListeners = new ArrayList<PropertyChangeListener>();
//        }
//
//        if (propListeners.contains(pcl)) {
//            return;
//        }
//
//        propListeners.add(pcl);
//    }
//
//    public void removePropertyChangeListener(PropertyChangeListener pcl) {
//        if (propListeners == null) {
//            return;
//        }
//        propListeners.remove(pcl);
//    }
    @Override
    public ScoreObject clone() {
        return (ScoreObject) ObjectUtilities.clone(this);
    }

    @Override
    public void addScoreObjectListener(ScoreObjectListener listener) {
        if (scoreObjListeners == null) {
            scoreObjListeners = new ArrayList<>();
        }
        scoreObjListeners.add(listener);
    }

    @Override
    public void removeScoreObjectListener(ScoreObjectListener listener) {
        if (scoreObjListeners != null) {
            scoreObjListeners.remove(listener);
        }
    }

    protected void fireScoreObjectEvent(ScoreObjectEvent event) {
        if (scoreObjListeners != null) {
            for (ScoreObjectListener listener : scoreObjListeners) {
                listener.scoreObjectChanged(event);
            }
        }
    }

}
