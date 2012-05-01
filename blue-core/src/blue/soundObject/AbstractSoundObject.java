package blue.soundObject;

import blue.utility.ObjectUtilities;
import java.awt.Color;
import java.io.Serializable;
import java.util.Vector;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public abstract class AbstractSoundObject implements SoundObject, Serializable {
    float subjectiveDuration = 2.0f;

    float startTime = 0.0f;

    String name = "";

    Color backgroundColor = Color.DARK_GRAY;

    transient Vector<SoundObjectListener> soundObjectListeners = null;

    public AbstractSoundObject() {
    }

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

    public Object clone() {
        return ObjectUtilities.clone(this);
    }

    public void addSoundObjectListener(SoundObjectListener listener) {
        if (soundObjectListeners == null) {
            soundObjectListeners = new Vector<SoundObjectListener>();
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
}