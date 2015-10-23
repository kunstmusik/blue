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
import java.io.Externalizable;
import java.io.File;
import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectOutput;
import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.FloatProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleFloatProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import javax.sound.sampled.AudioFileFormat;
import javax.sound.sampled.AudioFormat;
import javax.sound.sampled.AudioSystem;
import javax.sound.sampled.UnsupportedAudioFileException;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class AudioClip implements ScoreObject, Externalizable, Comparable<AudioClip> {

    private StringProperty name = new SimpleStringProperty();
    private FloatProperty start = new SimpleFloatProperty();
    private FloatProperty duration = new SimpleFloatProperty();
    private ObjectProperty<Color> color = new SimpleObjectProperty<>(
            Color.DARK_GRAY);

    private ObjectProperty<File> audioFile = new SimpleObjectProperty<>();
    int numChannels = 0;
    float audioDuration = 0.0f;

    private FloatProperty fileStartTime = new SimpleFloatProperty(0.0f);
    private FloatProperty fadeIn = new SimpleFloatProperty(0.0f);
    private FloatProperty fadeOut = new SimpleFloatProperty(0.0f);

    transient List<ScoreObjectListener> scoreObjListeners = null;
//    transient List<PropertyChangeListener> propListeners = null;

    public AudioClip() {
        name.addListener((obs, old, newVal) -> {
            fireScoreObjectEvent(new ScoreObjectEvent(this,
                    ScoreObjectEvent.NAME));
        });
        start.addListener((obs, old, newVal) -> {
            fireScoreObjectEvent(new ScoreObjectEvent(this,
                    ScoreObjectEvent.START_TIME));
        });
        duration.addListener((obs, old, newVal) -> {
            fireScoreObjectEvent(new ScoreObjectEvent(this,
                    ScoreObjectEvent.DURATION));
        });
        color.addListener((obs, old, newVal) -> {
            fireScoreObjectEvent(new ScoreObjectEvent(this,
                    ScoreObjectEvent.COLOR));
        });
    }

    protected void readAudioFileProperties() {
        AudioFileFormat aFormat;
        try {
            aFormat = AudioSystem.getAudioFileFormat(audioFile.get());
            AudioFormat format = aFormat.getFormat();

            numChannels = format.getChannels();
            audioDuration = aFormat.getByteLength()
                    / (format.getSampleRate() * (format.getSampleSizeInBits() / 8) * format
                    .getChannels());

        } catch (UnsupportedAudioFileException | IOException ex) {
            Exceptions.printStackTrace(ex);
        }
    }

    public void setName(String value) {
        name.set(value);
    }

    public String getName() {
        return name.get();
    }

    public StringProperty nameProperty() {
        return name;
    }

    public void setStart(float value) {
        start.set(value);
    }

    public float getStart() {
        return start.get();
    }

    public FloatProperty startProperty() {
        return start;
    }

    public void setDuration(float value) {
        duration.set(value);
    }

    public float getDuration() {
        return duration.get();
    }

    public FloatProperty durationProperty() {
        return duration;
    }

    public void setFileStartTime(float value) {
        fileStartTime.set(value);
    }

    public float getFileStartTime() {
        return fileStartTime.get();
    }

    public FloatProperty fileStartTimeProperty() {
        return fileStartTime;
    }

    public void setFadeIn(float value) {
        fadeIn.set(value);
    }

    public float getFadeIn() {
        return fadeIn.get();
    }

    public FloatProperty fadeInProperty() {
        return fadeIn;
    }

    public void setFadeOut(float value) {
        fadeOut.set(value);
    }

    public float getFadeOut() {
        return fadeOut.get();
    }

    public FloatProperty fadeOutProperty() {
        return fadeOut;
    }

    // GETTERS/SETTERS 
    public File getAudioFile() {
        return audioFile.get();
    }

    public void setAudioFile(File audioFile) {
        this.audioFile.set(audioFile);
        readAudioFileProperties();
        duration.set(audioDuration);
    }

    public ObjectProperty<File> audioFileProperty() {
        return this.audioFile;
    }

    public float getAudioDuration() {
        return audioDuration;
    }

    public void setAudioDuration(float originalDuration) {
        setDuration(originalDuration);
    }

    @Override
    public float getStartTime() {
        return getStart();
    }

    @Override
    public void setStartTime(float start) {
        setStart(start);
    }

    @Override
    public float getSubjectiveDuration() {
        return getDuration();
    }

    @Override
    public void setSubjectiveDuration(float duration) {
        float dur = Math.min(duration,
                getAudioDuration() - getFileStartTime());

        setDuration(dur);
    }

    @Override
    public float getMaxResizeRightDiff() {
        return audioDuration - (getFileStartTime() + getDuration());
    }

    @Override
    public float getMaxResizeLeftDiff() {
        return (getStart() < getFileStartTime()) ? -getStart() : -getFileStartTime();
    }

    @Override
    public void resizeLeft(float newStartTime) {

        if (newStartTime >= getStart() + getDuration()) {
            return;
        }

        float diff = newStartTime - getStart();
        float maxFileStartDiff = -getFileStartTime();

        if (diff < maxFileStartDiff) {
            diff = maxFileStartDiff;
        }

        float maxDurDiff = getAudioDuration() - getDuration();
        if (-diff > maxDurDiff) {
            diff = -maxDurDiff;
        }

        setFileStartTime(getFileStartTime() + diff);
        setStartTime(getStart() + diff);
        setSubjectiveDuration(getDuration() - diff);
    }

    @Override
    public void resizeRight(float newEndTime) {

        if (newEndTime <= getStart()) {
            return;
        }

        float newDur = newEndTime - getStart();

        newDur = (newDur > getAudioDuration()) ? getAudioDuration() : newDur;

        setSubjectiveDuration(newDur);
    }

    @Override
    public int compareTo(AudioClip o) {
        float diff = o.getStart() - this.getStart();
        if (diff != 0) {
            return (int) diff;
        }

        return (int) (o.getDuration() - this.getDuration());
    }

    @Override
    public Color getBackgroundColor() {
        return this.color.get();
    }

    @Override
    public void setBackgroundColor(Color color) {
        this.color.set(color);

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.COLOR);

        fireScoreObjectEvent(event);
    }

    public ObjectProperty<Color> backgroundColorProperty() {
        return color;
    }

    public int getNumChannels() {
        return numChannels;
    }

    //XML Methods 
    public Element saveAsXML() {
        Element root = new Element("audioClip");

        root.addElement("name").setText(getName());
        root.addElement("audioFile").setText(getAudioFile().getAbsolutePath());
        root.addElement(XMLUtilities.writeInt("numChannels", getNumChannels()));
        root.addElement(XMLUtilities.writeFloat("audioDuration",
                getAudioDuration()));
        root.addElement(XMLUtilities.writeFloat("fileStart", getFileStartTime()));
        root.addElement(XMLUtilities.writeFloat("start", getStart()));
        root.addElement(XMLUtilities.writeFloat("duration", getDuration()));
        root.addElement(XMLUtilities.writeFloat("fadeIn", getFadeIn()));
        root.addElement(XMLUtilities.writeFloat("fadeOut", getFadeOut()));

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
                    clip.setName(nodeText);
                    break;
                case "audioFile":
                    clip.setAudioFile(new File(nodeText));
                    break;
                case "numChannels":
                    clip.numChannels = XMLUtilities.readInt(node);
                    break;
                case "audioDuration":
                    clip.setAudioDuration(XMLUtilities.readFloat(node));
                    break;
                case "fileStart":
                    clip.setFileStartTime(XMLUtilities.readFloat(node));
                    break;
                case "start":
                    clip.setStart(XMLUtilities.readFloat(node));
                    break;
                case "duration":
                    clip.setDuration(XMLUtilities.readFloat(node));
                    break;
                case "backgroundColor":
                    String colorStr = data.getTextString("backgroundColor");
                    clip.setBackgroundColor(
                            new Color(Integer.parseInt(colorStr)));
                    break;
                case "fadeIn":
                    clip.setFadeIn(XMLUtilities.readFloat(node));
                    break;
                case "fadeOut":
                    clip.setFadeOut(XMLUtilities.readFloat(node));
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

    @Override
    public void writeExternal(ObjectOutput out) throws IOException {
        out.writeUTF(getName());
        out.writeFloat(getStart());
        out.writeFloat(getSubjectiveDuration());
        out.writeObject(getBackgroundColor());
        out.writeObject(getAudioFile());
        out.writeFloat(getFileStartTime());
        out.writeFloat(getFadeIn());
        out.writeFloat(getFadeOut());
    }

    @Override
    public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException {
        setName(in.readUTF());
        setStart(in.readFloat());
        setSubjectiveDuration(in.readFloat());
        setBackgroundColor((Color) in.readObject());
        setAudioFile((File) in.readObject());
        setFileStartTime(in.readFloat());
        setFadeIn(in.readFloat());
        setFadeOut(in.readFloat());
    }

}
