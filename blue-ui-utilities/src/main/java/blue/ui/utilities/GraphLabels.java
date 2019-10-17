/*
 * blue - object composition environment for csound
 * Copyright (C) 2017 stevenyi
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
package blue.ui.utilities;

/**
 * Implementation of Paul Heckbert's "Nice Numbers for Graph Labels", from
 * "Graphic Gems", p.61-63.
 *
 * @author stevenyi
 */
public class GraphLabels {

    public static void drawTicks(double min, double max, int nticks, 
            DrawCallback dcb) {

        double range = niceNum(max - min, false);
        double d = niceNum(range / (nticks - 1), true);
        double graphMin = Math.floor(min / d) * d;
        double graphMax = Math.ceil(max / d) * d;
        int nfrac = (int) Math.max(-Math.floor(Math.log10(d)), 0);


        for(double x = graphMin; x < graphMax + 0.5 * d; x += d) {
            dcb.draw(x, nfrac);
        }

    }

    public static double niceNum(double x, boolean round) {
        long exp;
        double f;
        double nf;

        exp = (long) Math.floor(Math.log10(x));
        f = x / Math.pow(10, exp);

        if (round) {
            if (f < 1.5) {
                nf = 1;
            } else if (f < 3) {
                nf = 2;
            } else if (f < 7) {
                nf = 5;
            } else {
                nf = 10;
            }
        } else {
            if (f <= 1) {
                nf = 1;
            } else if (f <= 2) {
                nf = 2;
            } else if (f <= 5) {
                nf = 5;
            } else {
                nf = 10;
            }
        }
        return nf * Math.pow(10, exp);
    }

    public static interface DrawCallback {

        public void draw(double x, int nfrac);
    }
}
