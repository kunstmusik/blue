package blue.soundObject;

import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.score.ScoreObject;
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
    protected float subjectiveDuration = 2.0f;

    protected float startTime = 0.0f;

    protected String name = "";

    protected Color backgroundColor = Color.DARK_GRAY;

    transient Vector<ScoreObjectListener> soundObjectListeners = null;

    public AbstractSoundObject() {
    }

    public void setName(String name) {
        this.name = name;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.NAME);

        fireScoreObjectEvent(event);
    }

    public String getName() {
        return name;
    }

    public void setStartTime(float startTime) {
        this.startTime = startTime;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.START_TIME);

        fireScoreObjectEvent(event);
    }

    public float getStartTime() {
        return startTime;
    }

    public void setSubjectiveDuration(float subjectiveDuration) {
        this.subjectiveDuration = subjectiveDuration;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.DURATION);

        fireScoreObjectEvent(event);
    }

    public float getSubjectiveDuration() {
        return subjectiveDuration;
    }

    @Override
    public SoundObject clone() {
        return (SoundObject)ObjectUtilities.clone(this);
    }

    public void addScoreObjectListener(ScoreObjectListener listener) {
        if (soundObjectListeners == null) {
            soundObjectListeners = new Vector<>();
        }
        soundObjectListeners.add(listener);
    }

    public void removeScoreObjectListener(ScoreObjectListener listener) {
        if (soundObjectListeners == null) {
            return;
        }
        soundObjectListeners.remove(listener);
    }

    public void fireScoreObjectEvent(ScoreObjectEvent sObjEvent) {
        if (soundObjectListeners == null) {
            return;
        }

        for (ScoreObjectListener listener : soundObjectListeners) {
            listener.scoreObjectChanged(sObjEvent);
        }
    }

    public Color getBackgroundColor() {
        return backgroundColor;
    }

    public void setBackgroundColor(Color backgroundColor) {
        this.backgroundColor = backgroundColor;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.COLOR);

        fireScoreObjectEvent(event);
    }
}