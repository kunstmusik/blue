/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

package blue.utility;

import java.text.MessageFormat;
import java.util.Locale;

public class NumberUtilities {

    private static MessageFormat FLOAT_FMT = new MessageFormat(
            "{0,number,##.##########}", Locale.ENGLISH);

    private static final MessageFormat TIME_FORMAT = new MessageFormat(
            "{0}:{1}:{2}:{3}", Locale.ENGLISH);

    private static final Object[] TIME_ARRAY = new Object[4];

    /**
     * Formats a double to String and prevents scientific notation
     * 
     * @param val
     * @return
     */
    
    public static String formatDouble(double val) {
        return FLOAT_FMT.format(new Object[] { new Double(val) });
    }

    /**
     * Formats a time in seconds into HH:MM:SS:MS
     * 
     * @param seconds
     * @return
     */
    public static String formatTime(double seconds) {
        int s = (int) seconds;

        int ms = (int) ((seconds - s) * 100);

        int h = s / 3600;
        int m = (s - (h * 3600)) / 60;

        s = s % 60;

        String hStr = h < 10 ? "0" + h : Integer.toString(h);
        String mStr = m < 10 ? "0" + m : Integer.toString(m);
        String sStr = s < 10 ? "0" + s : Integer.toString(s);
        String msStr = ms < 10 ? "0" + ms : Integer.toString(ms);

        TIME_ARRAY[0] = hStr;
        TIME_ARRAY[1] = mStr;
        TIME_ARRAY[2] = sStr;
        TIME_ARRAY[3] = msStr;

        return TIME_FORMAT.format(TIME_ARRAY);
    }

}
