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
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.awt.Color;
import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleDoubleProperty;
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
public final class AudioClip implements ScoreObject, Comparable<AudioClip> {

    private StringProperty name = new SimpleStringProperty();
    private DoubleProperty start = new SimpleDoubleProperty();
    private DoubleProperty duration = new SimpleDoubleProperty();
    private ObjectProperty<Color> color = new SimpleObjectProperty<>(
            Color.DARK_GRAY);

    private ObjectProperty<File> audioFile = new SimpleObjectProperty<>();
    int numChannels = 0;
    double audioDuration = 0.0f;

    private DoubleProperty fileStartTime = new SimpleDoubleProperty(0.0f);
    private DoubleProperty fadeIn = new SimpleDoubleProperty(0.0f);
    private ObjectProperty<FadeType> fadeInType = new SimpleObjectProperty<>(
            FadeType.LINEAR);
    private DoubleProperty fadeOut = new SimpleDoubleProperty(0.0f);
    private ObjectProperty<FadeType> fadeOutType = new SimpleObjectProperty<>(
            FadeType.LINEAR);

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

    public AudioClip(AudioClip ac) {
        this();
        setName(ac.getName());
        setStart(ac.getStart());
        setDuration(ac.getDuration());
        setBackgroundColor(ac.getBackgroundColor());
        setAudioFile(ac.getAudioFile());
        setFileStartTime(ac.getFileStartTime());
        setFadeIn(ac.getFadeIn());
        setFadeInType(ac.getFadeInType());
        setFadeOut(ac.getFadeOut());
        setFadeOutType(ac.getFadeOutType());
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

    @Override
    public void setName(String value) {
        name.set(value);
    }

    @Override
    public String getName() {
        return name.get();
    }

    public StringProperty nameProperty() {
        return name;
    }

    public void setStart(double value) {
        start.set(value);
    }

    public double getStart() {
        return start.get();
    }

    public DoubleProperty startProperty() {
        return start;
    }

    public void setDuration(double value) {
        duration.set(value);
    }

    public double getDuration() {
        return duration.get();
    }

    public DoubleProperty durationProperty() {
        return duration;
    }

    public void setFileStartTime(double value) {
        fileStartTime.set(value);
    }

    public double getFileStartTime() {
        return fileStartTime.get();
    }

    public DoubleProperty fileStartTimeProperty() {
        return fileStartTime;
    }

    public void setFadeIn(double value) {
        fadeIn.set(value);
    }

    public double getFadeIn() {
        return fadeIn.get();
    }

    public DoubleProperty fadeInProperty() {
        return fadeIn;
    }

    public void setFadeOut(double value) {
        fadeOut.set(value);
    }

    public double getFadeOut() {
        return fadeOut.get();
    }

    public DoubleProperty fadeOutProperty() {
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

    public double getAudioDuration() {
        return audioDuration;
    }

    public void setAudioDuration(double originalDuration) {
        setDuration(originalDuration);
    }

    @Override
    public double getStartTime() {
        return getStart();
    }

    @Override
    public void setStartTime(double start) {
        setStart(start);
    }

    @Override
    public double getSubjectiveDuration() {
        return getDuration();
    }

    @Override
    public void setSubjectiveDuration(double duration) {
        double dur = Math.min(duration,
                getAudioDuration() - getFileStartTime());

        setDuration(dur);
    }

    @Override
    public double getMaxResizeRightDiff() {
        return audioDuration - (getFileStartTime() + getDuration());
    }

    @Override
    public double getMaxResizeLeftDiff() {
        return (getStart() < getFileStartTime()) ? -getStart() : -getFileStartTime();
    }

    @Override
    public void resizeLeft(double newStartTime) {

        if (newStartTime >= getStart() + getDuration()) {
            return;
        }

        double diff = newStartTime - getStart();
        double maxFileStartDiff = -getFileStartTime();

        if (diff < maxFileStartDiff) {
            diff = maxFileStartDiff;
        }

        double maxDurDiff = getAudioDuration() - getDuration();
        if (-diff > maxDurDiff) {
            diff = -maxDurDiff;
        }

        setFileStartTime(getFileStartTime() + diff);
        setStartTime(getStart() + diff);
        setSubjectiveDuration(getDuration() - diff);
    }

    @Override
    public void resizeRight(double newEndTime) {

        if (newEndTime <= getStart()) {
            return;
        }

        double newDur = newEndTime - getStart();

        newDur = (newDur > getAudioDuration()) ? getAudioDuration() : newDur;

        setSubjectiveDuration(newDur);
    }

    @Override
    public int compareTo(AudioClip o) {
        double diff = o.getStart() - this.getStart();
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

    public FadeType getFadeInType() {
        return this.fadeInType.getValue();
    }

    public void setFadeInType(FadeType fadeType) {
        this.fadeInType.setValue(fadeType);
    }

    public ObjectProperty<FadeType> fadeInTypeProperty() {
        return fadeInType;
    }

    public FadeType getFadeOutType() {
        return this.fadeOutType.getValue();
    }

    public void setFadeOutType(FadeType fadeType) {
        this.fadeOutType.setValue(fadeType);
    }

    public ObjectProperty<FadeType> fadeOutTypeProperty() {
        return fadeOutType;
    }

    //XML Methods 
    public Element saveAsXML() {
        Element root = new Element("audioClip");

        root.addElement("name").setText(getName());
        root.addElement("audioFile").setText(getAudioFile().getAbsolutePath());
        root.addElement(XMLUtilities.writeInt("numChannels", getNumChannels()));
        root.addElement(XMLUtilities.writeDouble("audioDuration",
                getAudioDuration()));
        root.addElement(XMLUtilities.writeDouble("fileStart", getFileStartTime()));
        root.addElement(XMLUtilities.writeDouble("start", getStart()));
        root.addElement(XMLUtilities.writeDouble("duration", getDuration()));
        root.addElement(XMLUtilities.writeDouble("fadeIn", getFadeIn()));
        root.addElement("fadeInType").setText(getFadeInType().toString());
        root.addElement(XMLUtilities.writeDouble("fadeOut", getFadeOut()));
        root.addElement("fadeOutType").setText(getFadeOutType().toString());

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
                    clip.setAudioDuration(XMLUtilities.readDouble(node));
                    break;
                case "fileStart":
                    clip.setFileStartTime(XMLUtilities.readDouble(node));
                    break;
                case "start":
                    clip.setStart(XMLUtilities.readDouble(node));
                    break;
                case "duration":
                    clip.setDuration(XMLUtilities.readDouble(node));
                    break;
                case "backgroundColor":
                    String colorStr = data.getTextString("backgroundColor");
                    clip.setBackgroundColor(
                            new Color(Integer.parseInt(colorStr)));
                    break;
                case "fadeIn":
                    clip.setFadeIn(XMLUtilities.readDouble(node));
                    break;
                case "fadeInType":
                    clip.setFadeInType(FadeType.fromString(nodeText));
                    break;
                case "fadeOut":
                    clip.setFadeOut(XMLUtilities.readDouble(node));
                    break;
                case "fadeOutType":
                    clip.setFadeOutType(FadeType.fromString(nodeText));
                    break;
            }
        }

        return clip;
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
    public AudioClip deepCopy() {
        return new AudioClip(this);
    }

}
