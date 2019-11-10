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
     * Gets the start time of the ScoreObject.
     */
    //FIXME -  change this to use double
    double getStartTime();

    /**
     * Sets the start time of the ScoreObject.
     */
    //FIXME -  change this to use double
    void setStartTime(double startTime);
    
    /**
     * Gets the subjective duration of the ScoreObject.
     * 
     * The subjective duration of the ScoreObject is the amount of time a
     * ScoreObject is assigned to last, regardless of its contents.
     */
    //FIXME -  change this to use double
    double getSubjectiveDuration();

    /**
     * Sets the subjective duration of the ScoreObject.
     * 
     * The subjective duration of the ScoreObject is the amount of time a
     * ScoreObject is assigned to last, regardless of its contents.
     */
    void setSubjectiveDuration(double duration);

//    boolean isLayerTransferrable();
    // maybe use interface of Resizable?
//    boolean isLeftResizable()
    // boolean isRightResizble()

    double getMaxResizeRightDiff();
    double getMaxResizeLeftDiff();
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
}
