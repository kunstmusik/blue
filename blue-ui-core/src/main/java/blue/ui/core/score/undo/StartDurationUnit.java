/*
 * blue - object composition environment for csound
 * Copyright (C) 2015
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
package blue.ui.core.score.undo;

import blue.score.ScoreObject;
import blue.time.TimeContext;
import blue.time.TimeDuration;
import blue.time.TimePosition;
import blue.time.TimeUnitMath;

/**
 * Represents a unit of time information for a {@link ScoreObject}. Contains a start
 * {@link TimePosition} and a duration {@link TimePosition}.
 * 
 * @see ScoreObject
 * @see TimePosition
 * @see TimeContext
 * 
 * @author stevenyi
 */
public record StartDurationUnit(TimePosition start, TimeDuration duration) {

    /**
     * Creates a new instance of StartDurationUnit from a {@link ScoreObject}.
     * 
     * @param sObj the {@link ScoreObject} to create the instance from
     */
    public StartDurationUnit(ScoreObject sObj) {
        this(sObj.getStartTime(), sObj.getSubjectiveDuration());
    }

    /**
     * Returns the end time of the {@link ScoreObject} in the given
     * {@link TimeContext}.
     * 
     * @param context the {@link TimeContext} to use for the calculation
     * @return the end time of the {@link ScoreObject}
     */
    public TimePosition end(TimeContext context) {
        return TimeUnitMath.add(context, start(), duration());
    }
}
