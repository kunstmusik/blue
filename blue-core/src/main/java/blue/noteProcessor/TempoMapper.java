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
package blue.noteProcessor;

import java.util.StringTokenizer;
import org.apache.commons.lang3.text.StrBuilder;

public class TempoMapper {

    BeatTempoPair[] timeMap;

    private TempoMapper() {
    }

    public static TempoMapper createTempoMapper(String timeWarpString) {
        TempoMapper tm = new TempoMapper();
        StringTokenizer st = new StringTokenizer(timeWarpString);
        String time, tempo;
        BeatTempoPair temp;

        if (st.countTokens() % 2 != 0) {
            // not an even amount of tokens!
            return null;
        }

        tm.timeMap = new BeatTempoPair[st.countTokens() / 2];
        int index = 0;

        BeatTempoPair[] tMap = tm.timeMap;

        while (st.hasMoreTokens()) {
            try {
                time = st.nextToken();
                tempo = st.nextToken();

                temp = new BeatTempoPair();
                temp.beat = Double.parseDouble(time);
                temp.tempo = Double.parseDouble(tempo);

                if (temp.beat < 0.0f || temp.tempo <= 0.0f) {
                    return null;
                }

                tMap[index] = temp;

                if (index > 0) {

                    double factor1 = 60.0f / tMap[index - 1].tempo;
                    double factor2 = 60.0f / tMap[index].tempo;
                    double deltaBeat = tMap[index].beat - tMap[index - 1].beat;

                    double acceleration = 0.0f;

                    if (deltaBeat >= 0.0f) {
                        acceleration = (factor2 - factor1)
                                / (tMap[index].beat - tMap[index - 1].beat);
                    }

                    if (tMap[index].beat == tMap[index - 1].beat) {
                        tMap[index].accumulatedTime = 
                                tMap[index - 1].accumulatedTime;
                    } else {
                        tMap[index].accumulatedTime = 
                                tMap[index - 1].accumulatedTime + 
                                getAreaUnderCurve(factor1, deltaBeat, 
                                acceleration);
                    }
                }

                index++;
            } catch (Exception e) {
                // if there's any errors whatsoever, return null
                // and let the calling procedure handle it
                return null;
            }
        }
        return tm;
    }

    public double beatsToSeconds(double beat) {
        if (beat == 0.0f) {
            return 0.0f;
        }

        for (int i = 0; i < timeMap.length - 1; i++) {

            if (beat >= timeMap[i].beat && beat < timeMap[i + 1].beat) {

                double factor1 = 60.0f / timeMap[i].tempo;
                double factor2 = 60.0f / timeMap[i + 1].tempo;
                double deltaBeat = beat - timeMap[i].beat;

                double acceleration;

                if (deltaBeat == 0.0f) {
                    acceleration = 0;
                } else {
                    acceleration = (factor2 - factor1)
                            / (timeMap[i + 1].beat - timeMap[i].beat);
                }

                double t = getAreaUnderCurve(factor1, deltaBeat, acceleration);

                return timeMap[i].accumulatedTime + t;
            }
        }

        BeatTempoPair lastTempoPair = timeMap[timeMap.length - 1];

        double factor1 = 60.0f / lastTempoPair.tempo;
        double deltaBeat = beat - lastTempoPair.beat;

        double t = (factor1 * deltaBeat) + lastTempoPair.accumulatedTime;

        return t;
    }

    private static double getAreaUnderCurve(double factor1, double deltaBeat,
            double acceleration) {
        return (factor1 * deltaBeat)
                + (0.5f * acceleration * Math.pow(deltaBeat, 2));
    }

    public double secondsToBeats(double seconds) {
        if (seconds == 0.0f) {
            return 0.0f;
        }

        if (timeMap.length == 1) {
            double factor = timeMap[0].tempo / 60.0f;
            return seconds * factor;
        }

        for (int i = 0; i < timeMap.length - 1; i++) {
            if (seconds < timeMap[i + 1].accumulatedTime) {
                /*
                 * BASED ON CODE BY ISTVAN VARGA Csound Mailing List - April 13,
                 * 2006
                 * 
                 * beat0: time in beats at beginning of segment beat1: time in
                 * beats at end of segment time0: time in seconds at beginning
                 * of segment btime0: (60 / tempo) at beginning of segment
                 * btime1: (60 / tempo) at end of segment
                 */

                double beat0 = timeMap[i].beat;
                double beat1 = timeMap[i + 1].beat;
                double time0 = timeMap[i].accumulatedTime;

                double btime0 = (60 / timeMap[i].tempo);
                double btime1 = (60 / timeMap[i + 1].tempo);

                double x;
                
                if(btime0 == btime1) {
                    double elapsedTime = seconds - time0;
                    x = elapsedTime / btime0;
                } else {
                    double a = 0.5f * (btime1 - btime0) / (beat1 - beat0);
                    double b = btime0;
                    double c = time0 - seconds;
                    x = (Math.sqrt(b * b - (4 * a * c)) - b)
                            / (2 * a);
                }
                
                return (x + beat0);

            }
        }

        BeatTempoPair last = timeMap[timeMap.length - 1];
        double beat = last.beat;

        double factor = last.tempo / 60.0f;

        return ((seconds - last.accumulatedTime) * factor) + beat;

    }

    @Override
    public String toString() {
        StrBuilder buffer = new StrBuilder();

        buffer.append("[TempoMapper]").append("\n");

        for (int i = 0; i < timeMap.length; i++) {
            BeatTempoPair pair = timeMap[i];

            buffer.append(pair.beat).append(" : ").append(pair.tempo).append(
                    "\n");
        }

        return buffer.toString();
    }

    private static class BeatTempoPair {

        public double beat = 0.0f;

        public double tempo = 60.0f;

        public double accumulatedTime = 0.0f;
    }
}