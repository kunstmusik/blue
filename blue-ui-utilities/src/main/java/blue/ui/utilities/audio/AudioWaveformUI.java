/*
 * blue - object composition environment for csound
 * Copyright (C) 2014
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

package blue.ui.utilities.audio;

import java.awt.Graphics2D;
import java.awt.Rectangle;

/**
 *
 * @author stevenyi
 */
public class AudioWaveformUI {
    
    public static void paintWaveForm(Graphics2D g, int sObjVisibleHeight,
            AudioWaveformData waveForm, int audioFileStartIndex) {

        if (waveForm.data == null) {
            return;
        }

        // if (waveForm.percentLoadingComplete < 1.0) {
        // return;
        // }

        Rectangle bounds = g.getClipBounds();

        int startX = bounds.x; // + 1;
        int endX = startX + bounds.width;

        if (startX < 0) {
            startX = 0;
        }

        // System.out.println(startX + " : " + endX + " : " + bounds);

        int index;

        int channelHeight = sObjVisibleHeight / waveForm.data.length;
        int middleZero = channelHeight / 2;

        for (int j = 0; j < waveForm.data.length; j++) {
            int yAdjust = j * channelHeight;

            for (int i = startX; i < endX; i++) {
                index = (i + audioFileStartIndex) * 2;

                if (index + 1 > waveForm.data[j].length) {
                    break;
                }

                int y1 = (int) (middleZero - (waveForm.data[j][index] * middleZero))
                        + yAdjust;
                int y2 = (int) (middleZero - (waveForm.data[j][index + 1] * middleZero))
                        + yAdjust;

                g.drawLine(i, y1, i, y2);

            }
        }
    }
}
