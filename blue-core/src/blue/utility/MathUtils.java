/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU Library General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */

package blue.utility;

import java.math.BigDecimal;

/**
 * 
 * @author steven
 */
public class MathUtils {

    public static double remainder(double f1, double f2) {
        BigDecimal dec1 = new BigDecimal(f1);
        BigDecimal dec2 = new BigDecimal(f2);

        // Not available in Java 1.4
        // BigDecimal value = dec1.remainder(dec2);

        BigDecimal part = dec1.divide(dec2, BigDecimal.ROUND_DOWN);
        part = new BigDecimal(part.longValue());

        BigDecimal value = dec1.subtract(part.multiply(dec2));

        return value.doubleValue();
    }

    public static void main(String args[]) {
        System.out.println(MathUtils.remainder(5.2, 5));
        System.out.println(MathUtils.remainder(5.2, 1));
    }
}
