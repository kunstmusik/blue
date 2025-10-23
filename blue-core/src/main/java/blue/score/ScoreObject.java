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
package blue.score;

import blue.DeepCopyable;
import blue.time.TimeUnit;
import java.awt.Color;

/**
 * Object that exists in the Score Timeline that can be selected, moved, and/or
 * resized. 
 * 
 * @author stevenyi
 */
public interface ScoreObject extends DeepCopyable<ScoreObject> {

    /**
     * Sets the name of the ScoreObject.
     */
    void setName(String name);

    /**
     * Gets the name of the ScoreObject;
     */
    String getName();
    
    /**
     * Gets the start time of the ScoreObject in Csound beats.
     * 
     * This is a convenience method that extracts beats from the internal TimeUnit.
     * For more control over time representation, use {@link #getStartTimeUnit()}.
     * 
     * @return the start time in Csound beats
     */
    double getStartTime();

    /**
     * Sets the start time of the ScoreObject in Csound beats.
     * 
     * This is a convenience method that creates a BeatTime TimeUnit internally.
     * For more control over time representation, use {@link #setStartTimeUnit(TimeUnit)}.
     * 
     * @param startTime the start time in Csound beats
     */
    void setStartTime(double startTime);
    
    /**
     * Gets the subjective duration of the ScoreObject in Csound beats.
     * 
     * The subjective duration of the ScoreObject is the amount of time a
     * ScoreObject is assigned to last, regardless of its contents.
     * 
     * This is a convenience method that extracts beats from the internal TimeUnit.
     * For more control over time representation, use {@link #getSubjectiveDurationUnit()}.
     * 
     * @return the subjective duration in Csound beats
     */
    double getSubjectiveDuration();

    /**
     * Sets the subjective duration of the ScoreObject in Csound beats.
     * 
     * The subjective duration of the ScoreObject is the amount of time a
     * ScoreObject is assigned to last, regardless of its contents.
     * 
     * This is a convenience method that creates a BeatTime TimeUnit internally.
     * For more control over time representation, use {@link #setSubjectiveDurationUnit(TimeUnit)}.
     * 
     * @param duration the subjective duration in Csound beats
     */
    void setSubjectiveDuration(double duration);

//    boolean isLayerTransferrable();
    // maybe use interface of Resizable?
//    boolean isLeftResizable()
    // boolean isRightResizble()

    /** Return double array of limits of left diff and right diff when doing 
     * a resize from the right side of objects.
     * @return 
     */
    double[] getResizeRightLimits();
    
    /** Return double array of limits of left diff and right diff when doing 
     * a resize from the left side of objects.
     * @return 
     */
    double[] getResizeLeftLimits();
    void resizeLeft(double newStartTime);
    void resizeRight(double newEndTime);

    /**
     * Adds a ScoreObjectListener to this ScoreObject
     * 
     * @param listener
     */
    void addScoreObjectListener(ScoreObjectListener listener);

    /**
     * Removes a ScoreObjectListener to this ScoreObject
     * 
     * @param listener
     */
    void removeScoreObjectListener(ScoreObjectListener listener);
   
    /**
     * Gets background color for ScoreObject
     * 
     * @return
     */
    Color getBackgroundColor();

    /**
     * Sets background color for ScoreObject
     * 
     * @param color
     */
    void setBackgroundColor(Color color);

    int getCloneSourceHashCode();
    
    // ========== TimeUnit-based API ==========
    
    /**
     * Gets the start time as a TimeUnit.
     * The TimeBase is determined by the stored TimeUnit type.
     * 
     * @return the start time as a TimeUnit
     */
    TimeUnit getStartTimeUnit();
    
    /**
     * Sets the start time using a TimeUnit.
     * The TimeUnit's type determines how the time is stored and interpreted.
     * 
     * @param startTime the start time as a TimeUnit
     */
    void setStartTimeUnit(TimeUnit startTime);
    
    /**
     * Gets the subjective duration as a TimeUnit.
     * The TimeBase is determined by the stored TimeUnit type.
     * 
     * @return the duration as a TimeUnit
     */
    TimeUnit getSubjectiveDurationUnit();
    
    /**
     * Sets the subjective duration using a TimeUnit.
     * The TimeUnit's type determines how the duration is stored and interpreted.
     * 
     * @param duration the duration as a TimeUnit
     */
    void setSubjectiveDurationUnit(TimeUnit duration);
}
