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

import java.math.BigDecimal;
import java.math.RoundingMode;

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
    public static double rescale(double oldVal, double oldMin, double oldMax,
            double newMin, double newMax, BigDecimal resolution) {

        double oldRange = oldMax - oldMin;

        double percent = (oldVal - oldMin) / oldRange;

        double newRange = newMax - newMin;

        double newVal = (percent * newRange) + newMin;

        if (resolution.doubleValue() > 0) {
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
    public static double truncate(double oldVal, double newMin, double newMax) {
        return Math.max(newMin, Math.min(newMax, oldVal));
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
    public static double snapToResolution(double value, double min, double max,
            BigDecimal resolution) {

        if (value >= max) {
            return max;
        }

        if (value <= min) {
            return min;
        }

        if (resolution.doubleValue() <= 0.0f) {
            return value;
        }

        double retVal = value - min;

        if (resolution.doubleValue() > 0.0f) {
            BigDecimal v = new BigDecimal(retVal).setScale(resolution.scale(),
                    RoundingMode.HALF_UP);
//            System.out.println("v: " + v +":"+v.remainder(resolution) +":" + resolution);
//            System.out.println("v2: " + v.subtract(v.remainder(resolution)));
            v = v.subtract(v.remainder(resolution));
//            System.out.println("v3: " + v);
            retVal = v.doubleValue();
//            // TODO - check if IEEERemainder is what is desired here
//            double newVal =  (retVal - MathUtils.remainder(retVal,
//                    resolution));
//
//            System.out.println(retVal +":"+MathUtils.remainder(retVal, resolution));
//            double nextVal = newVal + resolution;
//            double adjustedMax = max - min;
//            if (nextVal > adjustedMax) {
//                nextVal = adjustedMax;
//            }
//
//            System.out.println(newVal +":"+retVal +":"+nextVal);
//            if ((newVal - retVal) < (nextVal - newVal)) {
//                retVal = newVal;
//            } else {
//                retVal = nextVal;
//            }
        }

        return retVal + min;
    }
   
}
