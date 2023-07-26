package blue.soundObject;

import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import java.awt.Color;
import java.util.Vector;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
public abstract class AbstractSoundObject implements SoundObject {

    protected double subjectiveDuration = 4.0f;

    protected double startTime = 0.0f;

    protected String name = "";

    protected Color backgroundColor = Color.DARK_GRAY;

    transient Vector<ScoreObjectListener> soundObjectListeners = null;

    transient int cloneSourceHashCode = 0;

    public AbstractSoundObject() {
    }

    public AbstractSoundObject(AbstractSoundObject aso) {
        subjectiveDuration = aso.subjectiveDuration;
        startTime = aso.startTime;
        name = aso.name;
        backgroundColor = aso.backgroundColor;
        cloneSourceHashCode = aso.hashCode();
    }

    @Override
    public void setName(String name) {
        this.name = name;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.NAME);

        fireScoreObjectEvent(event);
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public void setStartTime(double startTime) {
        this.startTime = startTime;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.START_TIME);

        fireScoreObjectEvent(event);
    }

    @Override
    public double getStartTime() {
        return startTime;
    }

    @Override
    public void setSubjectiveDuration(double subjectiveDuration) {
        this.subjectiveDuration = subjectiveDuration;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.DURATION);

        fireScoreObjectEvent(event);
    }

    @Override
    public double getSubjectiveDuration() {
        return subjectiveDuration;
    }

    @Override
    public double[] getResizeRightLimits() {
        return new double[]{-getSubjectiveDuration(), Double.MAX_VALUE};
    }

    @Override
    public double[] getResizeLeftLimits() {
        return new double[] { -getStartTime(), getSubjectiveDuration() };
    }

    @Override
    public void resizeLeft(double newStartTime) {
        double diff = startTime - newStartTime;
        setStartTime(newStartTime);
        setSubjectiveDuration(subjectiveDuration + diff);
    }

    @Override
    public void resizeRight(double newEndTime) {
        setSubjectiveDuration(newEndTime - startTime);
    }

    @Override
    public void addScoreObjectListener(ScoreObjectListener listener) {
        if (soundObjectListeners == null) {
            soundObjectListeners = new Vector<>();
        }
        soundObjectListeners.add(listener);
    }

    @Override
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

    @Override
    public Color getBackgroundColor() {
        return backgroundColor;
    }

    @Override
    public void setBackgroundColor(Color backgroundColor) {
        this.backgroundColor = backgroundColor;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.COLOR);

        fireScoreObjectEvent(event);
    }

    @Override
    public int getCloneSourceHashCode() {
        return cloneSourceHashCode;
    }
}
