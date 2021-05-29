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

import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import javax.swing.UIManager;

/**
 *
 * @author stevenyi
 */
public class LetterRendererView extends GenericView {

    private static final Font miniFont = 
            UIManager.getFont("Label.font").deriveFont(Font.BOLD, 10);

    protected String letter = "";

    public LetterRendererView() {
        super();
        labelOffset = 13;
    }
    
    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);

         Graphics2D g = (Graphics2D) graphics;

        Color boxColor;
        Color fontColor;

        if (isSelected()) {
            boxColor = Color.WHITE;
            fontColor = Color.BLACK;
        } else {
            Color bgColor = sObj.getBackgroundColor();
            boxColor = bgColor.brighter().brighter();

            int total = bgColor.getRed() + bgColor.getGreen()
                    + bgColor.getBlue();

            if (total > 128 * 3) {
                fontColor = Color.black;
            } else {
                fontColor = Color.white;
            }
        }

        // DRAW BOX
        g.setColor(boxColor);
        g.fillRect(2, 5, 9, 9);

        // DRAW LETTER
        g.setColor(fontColor);
        g.setFont(miniFont);
        g.drawString(letter, 3, 13);
    }

}
