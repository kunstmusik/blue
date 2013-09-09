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

/**
 * Object that exists in the Score Timeline that can be selected, moved, and/or
 * resized. 
 * 
 * @author stevenyi
 */
public interface ScoreObject {
    //FIXME -  change this to use double
    public float getStartTime();

    //FIXME -  change this to use double
    public void setStartTime(float startTime);
    
    //FIXME -  change this to use double
    public float getSubjectiveDuration();

    //FIXME -  change this to use double
    public void setSubjectiveDuration(float duration);
//    boolean isLayerTransferrable();

    // maybe use interface of Resizable?
//    boolean isLeftResizable()
    // boolean isRightResizble()

}
