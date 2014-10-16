/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

package blue.soundObject.editor.ceciliaModule;

import java.awt.Color;

/**
 * @author steven yi
 * 
 * Colors used by Cecilia for graph lines
 */
public class LineColors {

    private static final Color[] colors = { new Color(32, 221, 0),
            new Color(0, 0, 255), new Color(255, 165, 0), new Color(0, 139, 0),
            new Color(255, 0, 255), new Color(205, 55, 0),
            new Color(104, 34, 139), new Color(0, 104, 139),
            new Color(47, 79, 79), new Color(205, 16, 118),
            new Color(139, 105, 20), new Color(69, 139, 116),
            new Color(139, 69, 19), new Color(65, 105, 225),
            new Color(139, 125, 107), new Color(0, 0, 128),
            new Color(124, 252, 0), new Color(72, 61, 139),
            new Color(255, 215, 0), new Color(131, 139, 139),
            new Color(139, 26, 26), new Color(127, 255, 0),
            new Color(139, 35, 35), new Color(139, 115, 85),
            new Color(69, 139, 116), new Color(250, 128, 114),
            new Color(139, 62, 47), new Color(0, 139, 139),
            new Color(69, 139, 0), new Color(160, 32, 240) };

    private static final Color[] lightColors;

    static {
        lightColors = new Color[colors.length];

        for (int i = 0; i < colors.length; i++) {
            lightColors[i] = colors[i].darker();
        }

    }

    public static Color getColor(int index) {
        int i = index % colors.length;
        return colors[i];
    }

    public static Color getLightColor(int index) {
        int i = index % colors.length;
        return lightColors[i];
    }

}
