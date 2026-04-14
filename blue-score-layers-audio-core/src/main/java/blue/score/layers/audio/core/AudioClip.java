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
import blue.time.TimeBase;
import blue.time.TimeContext;
import blue.time.TimeDuration;
import blue.time.TimePosition;
import blue.time.TimeUnitMath;
import blue.time.TimeUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.awt.Color;
import java.beans.PropertyChangeListener;
import java.beans.PropertyChangeSupport;
import java.io.File;
import java.io.IOException;
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
public final class AudioClip implements ScoreObject, Comparable<AudioClip> {

    public static final String NAME = "name";
    public static final String START_TIME = "startTime";
    public static final String DURATION = "duration";
    public static final String COLOR = "color";
    public static final String FILE_START_TIME = "fileStartTime";
    public static final String FADE_IN = "fadeIn";
    public static final String FADE_IN_TYPE = "fadeInType";
    public static final String FADE_OUT = "fadeOut";
    public static final String FADE_OUT_TYPE = "fadeOutType";
    public static final String LOOPING = "looping";
    public static final String AUDIO_FILE = "audioFile";

    private final PropertyChangeSupport pcs = new PropertyChangeSupport(this);

    private String name = "";
    private TimePosition startTimePosition = TimePosition.beats(0.0);
    private TimeDuration durationUnit = TimeDuration.beats(0.0);
    private Color color = Color.DARK_GRAY;

    private File audioFile = null;
    int numChannels = 0;
    double audioDuration = 0.0f;

    private double fileStartTime = 0.0;
    private double fadeIn = 0.0;
    private FadeType fadeInType = FadeType.LINEAR;
    private double fadeOut = 0.0;
    private FadeType fadeOutType = FadeType.LINEAR;
    private boolean looping = true;

    transient List<ScoreObjectListener> scoreObjListeners = null;
    transient int cloneSourceHashCode = 0;

    public AudioClip() {
    }

    public AudioClip(AudioClip ac) {
        this.name = ac.name;
        this.startTimePosition = ac.startTimePosition;
        this.durationUnit = ac.durationUnit;
        this.color = ac.color;
        this.audioFile = ac.audioFile;
        this.numChannels = ac.numChannels;
        this.audioDuration = ac.audioDuration;
        this.fileStartTime = ac.fileStartTime;
        this.fadeIn = ac.fadeIn;
        this.fadeInType = ac.fadeInType;
        this.fadeOut = ac.fadeOut;
        this.fadeOutType = ac.fadeOutType;
        this.looping = ac.looping;
        this.cloneSourceHashCode = ac.hashCode();
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

    // PropertyChangeListener support

    public void addPropertyChangeListener(PropertyChangeListener listener) {
        pcs.addPropertyChangeListener(listener);
    }

    public void removePropertyChangeListener(PropertyChangeListener listener) {
        pcs.removePropertyChangeListener(listener);
    }

    // Name

    @Override
    public void setName(String value) {
        String old = this.name;
        this.name = value;
        pcs.firePropertyChange(NAME, old, value);
        fireScoreObjectEvent(new ScoreObjectEvent(this, ScoreObjectEvent.NAME));
    }

    @Override
    public String getName() {
        return name;
    }

    // Start time

    @Override
    public void setStartTime(TimePosition startTime) {
        if (startTime == null) {
            throw new IllegalArgumentException("Start time cannot be null");
        }
        TimePosition old = this.startTimePosition;
        this.startTimePosition = startTime;
        pcs.firePropertyChange(START_TIME, old, startTime);
        fireScoreObjectEvent(new ScoreObjectEvent(this, ScoreObjectEvent.START_TIME));
    }

    @Override
    public TimePosition getStartTime() {
        return startTimePosition;
    }

    // Subjective duration

    @Override
    public void setSubjectiveDuration(TimeDuration duration) {
        if (duration == null) {
            throw new IllegalArgumentException("Duration cannot be null");
        }
        TimeDuration old = this.durationUnit;
        this.durationUnit = duration;
        pcs.firePropertyChange(DURATION, old, duration);
        fireScoreObjectEvent(new ScoreObjectEvent(this, ScoreObjectEvent.DURATION));
    }

    @Override
    public TimeDuration getSubjectiveDuration() {
        return durationUnit;
    }

    // File start time

    public void setFileStartTime(double value) {
        double old = this.fileStartTime;
        this.fileStartTime = value;
        pcs.firePropertyChange(FILE_START_TIME, old, value);
    }

    public double getFileStartTime() {
        return fileStartTime;
    }

    // Fade in

    public void setFadeIn(double value) {
        double old = this.fadeIn;
        this.fadeIn = value;
        pcs.firePropertyChange(FADE_IN, old, value);
    }

    public double getFadeIn() {
        return fadeIn;
    }

    // Fade out

    public void setFadeOut(double value) {
        double old = this.fadeOut;
        this.fadeOut = value;
        pcs.firePropertyChange(FADE_OUT, old, value);
    }

    public double getFadeOut() {
        return fadeOut;
    }

    // Looping

    public void setLooping(TimeContext context, boolean looping) {
        boolean old = this.looping;
        this.looping = looping;

        if (!looping) {
            var durLimit = getAudioDuration() - getFileStartTime();
            double durBeats = durationUnit.toBeats(context);
            if (durBeats > durLimit) {
                setSubjectiveDuration(TimeUnitMath.beatsToDuration(
                        durLimit, durationUnit.getTimeBase(), context));
            }
        }

        pcs.firePropertyChange(LOOPING, old, looping);
    }

    // Simple setter for copy constructor and deserialization - no validation
    private void setLooping(boolean looping) {
        this.looping = looping;
    }

    public boolean isLooping() {
        return looping;
    }

    // Audio file

    public File getAudioFile() {
        return audioFile;
    }

    public void setAudioFile(File audioFile) {
        File old = this.audioFile;
        this.audioFile = audioFile;
        readAudioFileProperties();
        setSubjectiveDuration(TimeDuration.fromSeconds(audioDuration));
        pcs.firePropertyChange(AUDIO_FILE, old, audioFile);
    }

    public double getAudioDuration() {
        return audioDuration;
    }

    public void setAudioDuration(double originalDuration) {
        audioDuration = originalDuration;
    }

    // Color

    @Override
    public Color getBackgroundColor() {
        return this.color;
    }

    @Override
    public void setBackgroundColor(Color color) {
        Color old = this.color;
        this.color = color;
        pcs.firePropertyChange(COLOR, old, color);
        fireScoreObjectEvent(new ScoreObjectEvent(this, ScoreObjectEvent.COLOR));
    }

    public int getNumChannels() {
        return numChannels;
    }

    // Fade types

    public FadeType getFadeInType() {
        return this.fadeInType;
    }

    public void setFadeInType(FadeType fadeType) {
        FadeType old = this.fadeInType;
        this.fadeInType = fadeType;
        pcs.firePropertyChange(FADE_IN_TYPE, old, fadeType);
    }

    public FadeType getFadeOutType() {
        return this.fadeOutType;
    }

    public void setFadeOutType(FadeType fadeType) {
        FadeType old = this.fadeOutType;
        this.fadeOutType = fadeType;
        pcs.firePropertyChange(FADE_OUT_TYPE, old, fadeType);
    }

    // Resize

    @Override
    public double[] getResizeRightLimits(TimeContext context) {
        double durBeats = durationUnit.toBeats(context);
        return isLooping()
                ? new double[]{-durBeats, Double.MAX_VALUE}
                : new double[]{-durBeats, (getAudioDuration() - (durBeats + getFileStartTime()))};
    }

    @Override
    public double[] getResizeLeftLimits(TimeContext context) {
        double startBeats = startTimePosition.toBeats(context);
        double durBeats = durationUnit.toBeats(context);
        var leftLimit = isLooping()
                ? -startBeats
                : Math.max(-startBeats, -getFileStartTime());

        return new double[]{leftLimit, durBeats};
    }

    @Override
    public void resizeLeft(TimeContext context, double newStartTime) {
        double currentStart = startTimePosition.toBeats(context);
        double currentDuration = durationUnit.toBeats(context);
        double diff = currentStart - newStartTime;
        double fileStart = getFileStartTime() - diff;
        double audioDur = getAudioDuration();

        if (audioDur > 0) {
            while (fileStart < 0) {
                fileStart += audioDur;
            }
            while (fileStart > audioDur) {
                fileStart -= audioDur;
            }
        }

        setStartTime(TimeUtilities.beatsToTimePosition(
                newStartTime, startTimePosition.getTimeBase(), context));
        setFileStartTime(fileStart);
        setSubjectiveDuration(TimeUnitMath.beatsToDuration(
                currentDuration + diff, durationUnit.getTimeBase(), context));
    }

    @Override
    public void resizeRight(TimeContext context, double newEndTime) {
        double currentStart = startTimePosition.toBeats(context);
        setSubjectiveDuration(TimeUnitMath.beatsToDuration(
                newEndTime - currentStart, durationUnit.getTimeBase(), context));
    }

    @Override
    public int compareTo(AudioClip o) {
        // Compare using beat values with a default TimeContext
        var context = new TimeContext();
        int cmp = Double.compare(
                this.startTimePosition.toBeats(context),
                o.startTimePosition.toBeats(context));
        if (cmp != 0) {
            return cmp;
        }
        return Double.compare(
                this.durationUnit.toBeats(context),
                o.durationUnit.toBeats(context));
    }

    // XML Methods

    public Element saveAsXML() {
        Element root = new Element("audioClip");

        root.addElement("name").setText(getName());
        root.addElement("audioFile").setText(getAudioFile().getAbsolutePath());
        root.addElement(XMLUtilities.writeInt("numChannels", getNumChannels()));
        root.addElement(XMLUtilities.writeDouble("audioDuration",
                getAudioDuration()));
        root.addElement(XMLUtilities.writeDouble("fileStart", getFileStartTime()));
        root.addElement(getStartTime().saveAsXML().setName("startTime"));
        root.addElement(getSubjectiveDuration().saveAsXML().setName("subjectiveDuration"));
        root.addElement(XMLUtilities.writeDouble("fadeIn", getFadeIn()));
        root.addElement("fadeInType").setText(getFadeInType().toString());
        root.addElement(XMLUtilities.writeDouble("fadeOut", getFadeOut()));
        root.addElement("fadeOutType").setText(getFadeOutType().toString());
        root.addElement(XMLUtilities.writeBoolean("looping", isLooping()));

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
                case "startTime":
                    if (node.getAttributeValue("type") != null) {
                        try {
                            clip.setStartTime(TimePosition.loadFromXML(node));
                        } catch (Exception ex) {
                            Exceptions.printStackTrace(ex);
                        }
                    } else {
                        clip.setStartTime(TimePosition.beats(
                                Double.parseDouble(node.getTextString())));
                    }
                    break;
                case "start":
                    // Legacy format: plain double (beats)
                    clip.setStartTime(TimePosition.beats(XMLUtilities.readDouble(node)));
                    break;
                case "subjectiveDuration":
                    if (node.getAttributeValue("type") != null) {
                        try {
                            clip.setSubjectiveDuration(TimeDuration.loadFromXML(node));
                        } catch (Exception ex) {
                            Exceptions.printStackTrace(ex);
                        }
                    } else {
                        clip.setSubjectiveDuration(TimeDuration.beats(
                                Double.parseDouble(node.getTextString())));
                    }
                    break;
                case "duration":
                    // Legacy format: plain double (beats)
                    clip.setSubjectiveDuration(TimeDuration.beats(XMLUtilities.readDouble(node)));
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
                case "looping":
                    clip.setLooping(XMLUtilities.readBoolean(node));
                    break;
            }
        }

        return clip;
    }

    // ScoreObject listener support

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

    @Override
    public int getCloneSourceHashCode() {
        return cloneSourceHashCode;
    }

}
