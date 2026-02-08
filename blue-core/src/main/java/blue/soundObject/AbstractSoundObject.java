package blue.soundObject;

import java.awt.Color;
import java.util.Vector;

import blue.score.ScoreObjectEvent;
import blue.score.ScoreObjectListener;
import blue.time.TimeContext;
import blue.time.TimeDuration;
import blue.time.TimeUnit;
import blue.time.TimeUnitMath;
import blue.time.TimeUtilities;

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
     */
    protected TimeDuration durationUnit = TimeDuration.beats(4.0);

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
    public void setStartTime(TimeUnit startTime) {
        if (startTime == null) {
            throw new IllegalArgumentException("Start time cannot be null");
        }
        
        this.startTimeUnit = startTime;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.START_TIME);

        fireScoreObjectEvent(event);
    }

    @Override
    public TimeUnit getStartTime() {
        return startTimeUnit;
    }

    @Override
    public void setSubjectiveDuration(TimeDuration duration) {
        if (duration == null) {
            throw new IllegalArgumentException("Duration cannot be null");
        }
        
        this.durationUnit = duration;

        ScoreObjectEvent event = new ScoreObjectEvent(this,
                ScoreObjectEvent.DURATION);

        fireScoreObjectEvent(event);
    }

    @Override
    public TimeDuration getSubjectiveDuration() {
        return durationUnit;
    }

    @Override
    public double[] getResizeRightLimits(TimeContext context) {
        double duration = durationUnit.toBeats(context);
        return new double[]{-duration, Double.MAX_VALUE};
    }

    @Override
    public double[] getResizeLeftLimits(TimeContext context) {
        double start = startTimeUnit.toBeats(context);
        double duration = durationUnit.toBeats(context);
        return new double[] { -start, duration };
    }

    @Override
    public void resizeLeft(TimeContext context, double newStartTime) {
        double currentStart = startTimeUnit.toBeats(context);
        double currentDuration = durationUnit.toBeats(context);
        double diff = currentStart - newStartTime;
        // Preserve the original TimeUnit type
        setStartTime(TimeUtilities.beatsToTimeUnit(newStartTime, startTimeUnit.getTimeBase(), context));
        setSubjectiveDuration(TimeUnitMath.beatsToDuration(currentDuration + diff, durationUnit.getTimeBase(), context));
    }

    @Override
    public void resizeRight(TimeContext context, double newEndTime) {
        double currentStart = startTimeUnit.toBeats(context);
        // Preserve the original TimeUnit type
        setSubjectiveDuration(TimeUnitMath.beatsToDuration(newEndTime - currentStart, durationUnit.getTimeBase(), context));
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
