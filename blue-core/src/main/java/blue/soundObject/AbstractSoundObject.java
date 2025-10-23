package blue.soundObject;

import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.time.TimeContextManager;
import blue.time.TimeUnit;
import blue.time.TimeUtilities;
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

    /**
     * Internal storage for start time. Single source of truth.
     * Always stored as BeatTime for backward compatibility.
     */
    protected TimeUnit startTimeUnit = TimeUnit.beats(0.0);

    /**
     * Internal storage for subjective duration. Single source of truth.
     * Always stored as BeatTime for backward compatibility.
     */
    protected TimeUnit durationUnit = TimeUnit.beats(4.0);

    protected String name = "";

    protected Color backgroundColor = Color.DARK_GRAY;

    transient Vector<ScoreObjectListener> soundObjectListeners = null;

    transient int cloneSourceHashCode = 0;

    public AbstractSoundObject() {
    }

    public AbstractSoundObject(AbstractSoundObject aso) {
        startTimeUnit = aso.startTimeUnit;
        durationUnit = aso.durationUnit;
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
        this.startTimeUnit = TimeUnit.beats(startTime);

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.START_TIME);

        fireScoreObjectEvent(event);
    }

    @Override
    public double getStartTime() {
        // Fast path: if already BeatTime, extract directly
        if (startTimeUnit instanceof TimeUnit.BeatTime) {
            return ((TimeUnit.BeatTime) startTimeUnit).getCsoundBeats();
        }
        
        // Convert from other TimeUnit types using TimeContext
        return TimeUtilities.timeUnitToBeats(startTimeUnit, TimeContextManager.getContext());
    }

    @Override
    public void setSubjectiveDuration(double subjectiveDuration) {
        this.durationUnit = TimeUnit.beats(subjectiveDuration);

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.DURATION);

        fireScoreObjectEvent(event);
    }

    @Override
    public double getSubjectiveDuration() {
        // Fast path: if already BeatTime, extract directly
        if (durationUnit instanceof TimeUnit.BeatTime) {
            return ((TimeUnit.BeatTime) durationUnit).getCsoundBeats();
        }
        
        // Convert from other TimeUnit types using TimeContext
        return TimeUtilities.timeUnitToBeats(durationUnit, TimeContextManager.getContext());
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
        double currentStart = getStartTime();
        double currentDuration = getSubjectiveDuration();
        double diff = currentStart - newStartTime;
        setStartTime(newStartTime);
        setSubjectiveDuration(currentDuration + diff);
    }

    @Override
    public void resizeRight(double newEndTime) {
        double currentStart = getStartTime();
        setSubjectiveDuration(newEndTime - currentStart);
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
    
    // ========== TimeUnit-based API Implementation ==========
    
    @Override
    public TimeUnit getStartTimeUnit() {
        return startTimeUnit;
    }
    
    @Override
    public void setStartTimeUnit(TimeUnit startTimeUnit) {
        if (startTimeUnit == null) {
            throw new IllegalArgumentException("Start time cannot be null");
        }
        
        // Store TimeUnit in its original format
        this.startTimeUnit = startTimeUnit;
        
        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.START_TIME);
        fireScoreObjectEvent(event);
    }
    
    @Override
    public TimeUnit getSubjectiveDurationUnit() {
        return durationUnit;
    }
    
    @Override
    public void setSubjectiveDurationUnit(TimeUnit durationUnit) {
        if (durationUnit == null) {
            throw new IllegalArgumentException("Duration cannot be null");
        }
        
        // Store TimeUnit in its original format
        this.durationUnit = durationUnit;
        
        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.DURATION);
        fireScoreObjectEvent(event);
    }
    
}
