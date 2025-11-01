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
import blue.time.TimeContext;
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
     * Gets the start time of the ScoreObject as a TimeUnit.
     * The TimeUnit type determines how the time is represented (beats, measure/beats, time, SMPTE, frames).
     * 
     * @return the start time as a TimeUnit
     */
    TimeUnit getStartTime();

    /**
     * Sets the start time of the ScoreObject using a TimeUnit.
     * The TimeUnit's type determines how the time is stored and interpreted.
     * 
     * @param startTime the start time as a TimeUnit
     */
    void setStartTime(TimeUnit startTime);
    
    /**
     * Gets the subjective duration of the ScoreObject as a TimeUnit.
     * 
     * The subjective duration of the ScoreObject is the amount of time a
     * ScoreObject is assigned to last, regardless of its contents.
     * The TimeUnit type determines how the duration is represented.
     * 
     * @return the subjective duration as a TimeUnit
     */
    TimeUnit getSubjectiveDuration();

    /**
     * Sets the subjective duration of the ScoreObject using a TimeUnit.
     * 
     * The subjective duration of the ScoreObject is the amount of time a
     * ScoreObject is assigned to last, regardless of its contents.
     * The TimeUnit's type determines how the duration is stored and interpreted.
     * 
     * @param duration the subjective duration as a TimeUnit
     */
    void setSubjectiveDuration(TimeUnit duration);

//    boolean isLayerTransferrable();
    // maybe use interface of Resizable?
//    boolean isLeftResizable()
    // boolean isRightResizble()

    /** Return double array of limits of left diff and right diff when doing 
     * a resize from the right side of objects.
     * 
     * @param context the TimeContext for time conversions
     * @return array of [minDiff, maxDiff]
     */
    double[] getResizeRightLimits(TimeContext context);
    
    /** Return double array of limits of left diff and right diff when doing 
     * a resize from the left side of objects.
     * 
     * @param context the TimeContext for time conversions
     * @return array of [minDiff, maxDiff]
     */
    double[] getResizeLeftLimits(TimeContext context);
    
    /**
     * Resizes the object from the left side.
     * 
     * @param context the TimeContext for time conversions
     * @param newStartTime the new start time in beats
     */
    void resizeLeft(TimeContext context, double newStartTime);
    
    /**
     * Resizes the object from the right side.
     * 
     * @param context the TimeContext for time conversions
     * @param newEndTime the new end time in beats
     */
    void resizeRight(TimeContext context, double newEndTime);

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
    
}
