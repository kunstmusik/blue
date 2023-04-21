/*
 * blue - object composition environment for csound
 * Copyright (C) 2020
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
package blue.ui.core.score.layers.soundObject.views;

import blue.plugin.SoundObjectViewPlugin;
import blue.score.layers.Layer;
import blue.soundObject.GenericViewable;
import blue.soundObject.TimeBehavior;
import blue.ui.utilities.BlueGradientFactory;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;

/**
 *
 * @author stevenyi
 */
@SoundObjectViewPlugin(scoreObjectType = GenericViewable.class)
public class GenericView extends SoundObjectView {

    protected int labelOffset = 5;

    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);

        Graphics2D g = (Graphics2D) graphics;
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);

        int w = getWidth();
        int h = getHeight();

        Color bgColor;
        Color border1;
        Color border2;
        Color fontColor;

        if (isSelected()) {
            bgColor = sObj.getBackgroundColor().brighter().brighter();
            border1 = Color.WHITE;
            border2 = Color.WHITE;
            fontColor = Color.WHITE;
        } else {
            bgColor = sObj.getBackgroundColor();
            border1 = bgColor.brighter().brighter();
            border2 = bgColor.darker().darker();
            int total = bgColor.getRed() + bgColor.getGreen()
                    + bgColor.getBlue();

            if (total > 128 * 3) {
                fontColor = Color.BLACK;
            } else {
                fontColor = Color.WHITE;
            }
        }

        g.setPaint(BlueGradientFactory.getGradientPaint(bgColor));

        g.fillRect(0, 1, w, h - 2);

        if (isSelected()) {
            g.setColor(bgColor.darker().darker().darker().darker());
            g.fillRect(0, 2, w, 18);
        }

//        g.drawLine(0, 1, w-1, 1);
//        g.drawLine(0, 1, 0, h - 2);
//
//        g.setColor(border2);
//        g.drawLine(0, h - 2, w-1, h - 2);
//        g.drawLine(w - 1, h - 2, w - 1, 2);
//        if (isSelected()) {
//            g.setColor(new Color(255, 255, 255, 196));
//            g.drawRect(1, 3, w - 3, h - 6);
//        }
        // paint repeat
        double repeatPoint = sObj.getRepeatPoint();
        var tb = sObj.getTimeBehavior();

        if ((tb == TimeBehavior.REPEAT_CLASSIC || tb == TimeBehavior.REPEAT)
                && repeatPoint > 0.0f) {

            double lineTime = repeatPoint;
            double dur = sObj.getSubjectiveDuration();

            int[] x = new int[3];
            int[] y = new int[3];

            while (lineTime <= dur) {

                g.setColor(border2);

                int lineX = (int) (lineTime * timeState.getPixelSecond());

                // g.drawLine(lineX, 3, lineX, h - 4);
                x[0] = lineX - 5;
                x[1] = lineX;
                x[2] = lineX;

                y[0] = 3;
                y[1] = 8;
                y[2] = 3;

                g.fillPolygon(x, y, 3);

                y[0] = h - 3;
                y[1] = h - 8;
                y[2] = h - 3;

                g.fillPolygon(x, y, 3);

                lineTime += repeatPoint;
            }
        }

        g.setPaint(fontColor);

        if (h >= 20) {
            g.setComposite(AlphaComposite.Src);
            g.setFont(renderFont);

            String[] parts = sObj.getName().split(
                    "\\\\[n]");

            for (int i = 0; i < parts.length; i++) {
                int y = 16 + (i * Layer.LAYER_HEIGHT);
                g.drawString(parts[i], labelOffset, y);
            }
        }

        // DRAW BORDER
        g.setColor(border1);
        g.drawRect(0, 1, w - 1, h - 2);
    }

}
