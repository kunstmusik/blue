/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.noteProcessor;

import java.util.StringTokenizer;

/**
 * @author steven
 * 
 */
public class ValueTimeMapper {
    BeatValuePair[] timeMap;

    private ValueTimeMapper() {
    }

    public static ValueTimeMapper createValueTimeMapper(String beatValueString) {
        ValueTimeMapper tm = new ValueTimeMapper();
        StringTokenizer st = new StringTokenizer(beatValueString);
        String time, tempo;
        BeatValuePair temp;

        if (st.countTokens() % 2 != 0) {
            // not an even amount of tokens!
            return null;
        }

        tm.timeMap = new BeatValuePair[st.countTokens() / 2];
        int index = 0;

        while (st.hasMoreTokens()) {
            try {
                time = st.nextToken();
                tempo = st.nextToken();

                temp = new BeatValuePair();
                temp.beat = Double.parseDouble(time);
                temp.value = Double.parseDouble(tempo);

                if (temp.beat < 0.0f) {
                    return null;
                }

                tm.timeMap[index] = temp;
                index++;
            } catch (Exception e) {
                // if there's any errors whatsoever, return null
                // and let the calling procedure handle it
                return null;
            }
        }
        return tm;
    }

    public double getValueForBeat(double beat) {
        if (beat >= timeMap[timeMap.length - 1].beat) {
            return timeMap[timeMap.length - 1].value;
        }

        for (int i = 0; i < timeMap.length - 1; i++) {
            // System.err.println(beat + " : " + timeMap[i].beat + " : " +
            // timeMap[i + 1].beat );
            if (beat >= timeMap[i].beat && beat < timeMap[i + 1].beat) {
                double x1 = timeMap[i].value;
                double x2 = timeMap[i + 1].value;

                double m = x2 - x1;

                double x = (beat - timeMap[i].beat)
                        / (timeMap[i + 1].beat - timeMap[i].beat);

                double y = m * x + x1;

                return y;
            }
        }
        return Double.NaN;

    }

}

class BeatValuePair {
    public double beat = 0.0f;

    public double value = 0;
}
