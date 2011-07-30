/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.components.lines;

import blue.utility.MathUtils;
import java.math.BigDecimal;
import java.math.MathContext;

public class LineUtils {
    /**
     * Get new value for old value, passing in old and new boundaries
     * 
     * @param oldVal
     * @param oldMin
     * @param oldMax
     * @param newMin
     * @param newMax
     * @return
     */
    public static float rescale(float oldVal, float oldMin, float oldMax,
            float newMin, float newMax, float resolution) {

        float oldRange = oldMax - oldMin;

        float percent = (oldVal - oldMin) / oldRange;

        float newRange = newMax - newMin;

        float newVal = (percent * newRange) + newMin;

        if (resolution > 0) {
            newVal = snapToResolution(newVal, newMin, newMax, resolution);
        }

        return newVal;
    }

    public static double rescale(double oldVal, double oldMin, double oldMax,
            double newMin, double newMax, double resolution) {

        double oldRange = oldMax - oldMin;

        double percent = (oldVal - oldMin) / oldRange;

        double newRange = newMax - newMin;

        double newVal = (percent * newRange) + newMin;

        if (resolution > 0) {
            newVal = snapToResolution(newVal, newMin, newMax, resolution);
        }

        return newVal;
    }    
    
    /**
     * Return value within new boundaries
     * 
     * @param oldVal
     * @param newMin
     * @param newMax
     * @return
     */
    public static float truncate(float oldVal, float newMin, float newMax) {
        float retVal = oldVal;

        if (retVal < newMin) {
            retVal = newMin;
        }

        if (retVal > newMax) {
            retVal = newMax;
        }

        return retVal;
    }

    public static double truncate(double oldVal, double newMin, double newMax) {
        double retVal = oldVal;

        if (retVal < newMin) {
            retVal = newMin;
        }

        if (retVal > newMax) {
            retVal = newMax;
        }

        return retVal;
    }
    
    /**
     * Snaps points to resolution, snapping to closest value on grid
     * 
     * @param value
     * @param min
     * @param max
     * @param resolution
     * @return
     */
    public static float snapToResolution(float value, float min, float max,
            float resolution) {

        if (value >= max) {
            return max;
        }

        if (value <= min) {
            return min;
        }

        if (resolution <= 0.0f) {
            return value;
        }

        float retVal = value - min;

        if (resolution > 0.0f) {

            // TODO - check if IEEERemainder is what is desired here
            float newVal = (float) (retVal - MathUtils.remainder(retVal,
                    resolution));

            float nextVal = newVal + resolution;
            float adjustedMax = max - min;
            if (nextVal > adjustedMax) {
                nextVal = adjustedMax;
            }

            if ((newVal - retVal) < (nextVal - newVal)) {
                retVal = newVal;
            } else {
                retVal = nextVal;
            }
        }

        return retVal + min;
    }
    
    public static double snapToResolution(double value, double min, double max,
            double resolution) {

        if (value >= max) {
            return max;
        }

        if (value <= min) {
            return min;
        }

        if (resolution <= 0.0f) {
            return value;
        }

        double retVal = value - min;

        if (resolution > 0.0f) {

            // TODO - check if IEEERemainder is what is desired here
            double newVal = (double) (retVal - MathUtils.remainder(retVal,
                    resolution));

            double nextVal = newVal + resolution;
            double adjustedMax = max - min;
            if (nextVal > adjustedMax) {
                nextVal = adjustedMax;
            }

            if ((newVal - retVal) < (nextVal - newVal)) {
                retVal = newVal;
            } else {
                retVal = nextVal;
            }
        }

        return retVal + min;
    }
}
