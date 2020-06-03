/*
 * blue - object composition environment for csound
 * Copyright (c) 2012 Steven Yi (stevenyi@gmail.com)
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
 *
 * This file uses code from MetouiaButtonBorder.java by Taoufik Romdhane.
 */
package blue.plaf;

import java.awt.*;
import javax.swing.AbstractButton;
import javax.swing.JComponent;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.metal.MetalButtonUI;

/**
 *
 * @author stevenyi
 */
public class BlueButtonUI extends MetalButtonUI {

    public static ComponentUI createUI(JComponent c) {
        return new BlueButtonUI();
    }

    @Override
    public void update(Graphics g, JComponent c) {
        super.update(g, c);

//        if (!(c.getParent() instanceof JToolBar)) {
        Graphics2D g2d = (Graphics2D) g;

        Dimension size = c.getSize();

        Color bgColor = c.getBackground();
        if (bgColor == null) {
            bgColor = BlueLookAndFeel.getControl();
        }
        
        GradientPaint gp = BlueGradientFactory.getGradientPaint(BlueLookAndFeel.getControl());

        Paint p = g2d.getPaint();
        g2d.setPaint(gp);
//            g2d.fillRoundRect(0, 0, size.width, size.height, 4, 4);
        g2d.fillRect(0, 0, size.width, size.height);
        g2d.setPaint(p);
//        }

        paint(g, c);
    }

    @Override
    protected void paintFocus(Graphics g, AbstractButton b, Rectangle viewRect, Rectangle textRect, Rectangle iconRect) {
        g.setColor(BlueLookAndFeel.getFocusColor());
        Dimension size = b.getSize();
//        g.drawRoundRect(1, 1, size.width - 3, size.height - 3, 4, 4);
//        g.drawRect(1, 1, size.width - 3, size.height - 3);
        g.drawLine(1, 1, size.width - 2, 1);
    }

    @Override
    protected void paintButtonPressed(Graphics g, AbstractButton b) {
        if (b.isContentAreaFilled()) {
//            Dimension size = b.getSize();
//            g.setColor(getSelectColor());
////            g.fillRoundRect(2, 2, size.width - 4, size.height - 4, 4, 4);
//            g.fillRect(0, 0, size.width - 1, size.height - 1);

            Graphics2D g2d = (Graphics2D) g;

            Dimension size = b.getSize();

            GradientPaint pressedGp = BlueGradientFactory.getGradientPaint(getSelectColor());

            Paint p = g2d.getPaint();
            g2d.setPaint(pressedGp);
//            g2d.fillRoundRect(0, 0, size.width, size.height, 4, 4);
            g2d.fillRect(0, 0, size.width, size.height);
            g2d.setPaint(p);

        }
    }
}
