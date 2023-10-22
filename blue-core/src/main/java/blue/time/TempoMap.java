/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006, 2023 Steven Yi (stevenyi@gmail.com)
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
package blue.time;

import java.util.ArrayList;
import java.util.List;
import java.util.StringTokenizer;

/**
 *
 * @author Steven Yi
 */
public class TempoMap {

    List<BeatTempoPair> timeMap;

    public TempoMap() {
        timeMap = new ArrayList<>();
        timeMap.add(new BeatTempoPair(0, 60));
    }

    public TempoMap(TempoMap tempoMap) {
        timeMap = new ArrayList<>();
        timeMap.addAll(tempoMap.timeMap.stream().map(e -> new BeatTempoPair(e)).toList());
    }

    public static TempoMap createTempoMap(String timeWarpString) {
        TempoMap tm = new TempoMap();

        StringTokenizer st = new StringTokenizer(timeWarpString);
        String time, tempo;

        if (st.countTokens() % 2 != 0) {
            // not an even amount of tokens!
            return null;
        }

        int index = 0;

        while (st.hasMoreTokens()) {
            try {
                time = st.nextToken();
                tempo = st.nextToken();

                var curr = new BeatTempoPair();
                curr.beat = Double.parseDouble(time);
                curr.tempo = Double.parseDouble(tempo);

                if (curr.beat < 0.0f || curr.tempo <= 0.0f) {
                    return null;
                }

                tm.timeMap.add(curr);

                if (index > 0) {
                    var last = tm.timeMap.get(index - 1);

                    double factor1 = 60.0f / last.tempo;
                    double factor2 = 60.0f / curr.tempo;
                    double deltaBeat = curr.beat - last.beat;

                    double acceleration = 0.0f;

                    if (deltaBeat >= 0.0f) {
                        acceleration = (factor2 - factor1)
                                / (curr.beat - last.beat);
                    }

                    if (curr.beat == last.beat) {
                        curr.accumulatedTime
                                = last.accumulatedTime;
                    } else {
                        curr.accumulatedTime
                                = last.accumulatedTime
                                + getAreaUnderCurve(factor1, deltaBeat,
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

        for (int i = 0; i < timeMap.size() - 1; i++) {
            var curr = timeMap.get(i);
            var next = timeMap.get(i + 1);

            if (beat >= curr.beat && beat < next.beat) {

                double factor1 = 60.0f / curr.tempo;
                double factor2 = 60.0f / next.tempo;
                double deltaBeat = beat - curr.beat;

                double acceleration;

                if (deltaBeat == 0.0f) {
                    acceleration = 0;
                } else {
                    acceleration = (factor2 - factor1)
                            / (next.beat - curr.beat);
                }

                double t = getAreaUnderCurve(factor1, deltaBeat, acceleration);

                return curr.accumulatedTime + t;
            }
        }

        BeatTempoPair lastTempoPair = timeMap.get(timeMap.size() - 1);

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

        if (timeMap.size() == 1) {
            double factor = timeMap.get(0).tempo / 60.0f;
            return seconds * factor;
        }

        for (int i = 0; i < timeMap.size() - 1; i++) {
            var curr = timeMap.get(i);
            var next = timeMap.get(i + 1);

            if (seconds < next.accumulatedTime) {
                /*
                 * BASED ON CODE BY ISTVAN VARGA Csound Mailing List - April 13,
                 * 2006
                 * 
                 * beat0: time in beats at beginning of segment beat1: time in
                 * beats at end of segment time0: time in seconds at beginning
                 * of segment btime0: (60 / tempo) at beginning of segment
                 * btime1: (60 / tempo) at end of segment
                 */

                double beat0 = curr.beat;
                double beat1 = next.beat;
                double time0 = curr.accumulatedTime;

                double btime0 = (60 / curr.tempo);
                double btime1 = (60 / next.tempo);

                double x;

                if (btime0 == btime1) {
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

        BeatTempoPair last = timeMap.get(timeMap.size() - 1);
        double beat = last.beat;

        double factor = last.tempo / 60.0f;

        return ((seconds - last.accumulatedTime) * factor) + beat;

    }

    @Override
    public String toString() {
        StringBuilder buffer = new StringBuilder();

        buffer.append("[TempoMap]").append("\n");

        for (BeatTempoPair pair : timeMap) {
            buffer.append(pair.beat).append(" : ").append(pair.tempo).append(
                    "\n");
        }

        return buffer.toString();
    }

    private static class BeatTempoPair {

        public double beat = 0.0f;

        public double tempo = 60.0f;

        public double accumulatedTime = 0.0f;

        public BeatTempoPair() {
        }

        public BeatTempoPair(double beat, double tempo) {
            this.beat = beat;
            this.tempo = tempo;
        }

        public BeatTempoPair(BeatTempoPair pair) {
            this.beat = pair.beat;
            this.tempo = pair.tempo;
        }
    }
}
