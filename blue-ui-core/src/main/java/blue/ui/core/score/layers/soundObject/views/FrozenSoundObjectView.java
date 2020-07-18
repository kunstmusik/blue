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
import blue.soundObject.FrozenSoundObject;
import java.awt.AlphaComposite;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;

/**
 *
 * @author stevenyi
 */
@SoundObjectViewPlugin(scoreObjectType = FrozenSoundObject.class)
public class FrozenSoundObjectView extends SoundObjectView {

      private static Font renderFont = new Font("Dialog", Font.BOLD, 12);

    protected static Color selectedBgColor = Color.white;

    protected static Color selectedBorder1 = selectedBgColor.brighter()
            .brighter();

    protected static Color selectedBorder2 = selectedBgColor.darker().darker();

    protected static Color selectedFontColor = Color.darkGray;

    protected static Color normalBgColor = new Color(193, 205, 205);

    private static Color normalBorder1 = normalBgColor.brighter().brighter();

    private static Color normalBorder2 = normalBgColor.darker().darker();

    protected static Color normalFontColor = Color.black;

    private static Color shadeColor = new Color(0, 0, 0, 64);

    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);

        Graphics2D g = (Graphics2D) graphics;
        int w = getWidth();
        int h = getHeight();

        FrozenSoundObject fso = (FrozenSoundObject) sObj;
        double percentOriginal = fso.getFrozenSoundObject()
                .getSubjectiveDuration()
                / fso.getSubjectiveDuration();

        Color bgColor;
        Color border1;
        Color border2;
        Color fontColor;

        if (isSelected()) {
            bgColor = normalBgColor.brighter().brighter();
            border1 = Color.WHITE;
            border2 = Color.WHITE;
            fontColor = Color.WHITE;
        } else {
            bgColor = normalBgColor;
            border1 = normalBorder1;
            border2 = normalBorder2;
            fontColor = normalFontColor;
        }

        g.setPaint(bgColor);

        // fill original soundObject area
        g.fillRect(0, 2, w, h - 4);

        // fill extended area
        g.setColor(shadeColor);
        g.fillRect((int) (w * percentOriginal), 2, w, h - 4);

        if (isSelected()) {
            g.setColor(bgColor.darker().darker().darker().darker());
            g.fillRect(0, 2, w, 18);
        }

        g.setColor(border1);
        g.drawLine(0, 2, w, 2);
        g.drawLine(0, 2, 0, h - 2);

        g.setColor(border2);
        g.drawLine(0, h - 2, w, h - 2);
        g.drawLine(w - 1, h - 2, w - 1, 2);

        if (isSelected()) {
            g.setColor(new Color(255, 255, 255, 196));
            g.drawRect(1, 3, w - 3, h - 6);
        }

        g.setPaint(fontColor);

        if (h >= 20) {
            g.setComposite(AlphaComposite.Src);
            g.setFont(renderFont);

            String[] parts = sObj.getName().split(
                    "\\\\[n]");

            for (int i = 0; i < parts.length; i++) {
                int y = 16 + (i * Layer.LAYER_HEIGHT);
                g.drawString(parts[i], 5, y);
            }
        }
    }

}
