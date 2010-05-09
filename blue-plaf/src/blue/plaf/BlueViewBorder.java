/*
 * blue - object composition environment for csound Copyright (c) 2000-2009
 * Steven Yi (stevenyi@gmail.com)
 * 
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 * 
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */
package blue.plaf;

import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Insets;
import java.awt.Rectangle;
import javax.swing.border.Border;
import javax.swing.plaf.UIResource;

/**
 *
 * @author syi
 */
public class BlueViewBorder implements Border, UIResource {
    private final Color highlight;
    private final Color shadow;

    public BlueViewBorder(Color highlight, Color shadow) {
        this.highlight = highlight;
        this.shadow = shadow;
    }

    public void paintBorder(Component c, Graphics g, int x, int y, int width,
            int height) {
        Rectangle rect = c.getBounds();
        g.setColor(shadow);
        g.drawLine(0, 0, rect.width - 1, 0);
        g.drawLine(0, 0, 0, rect.height - 1);
        g.setColor(highlight);
        g.drawLine(0, rect.height - 1, rect.width - 1, rect.height - 1);
        g.drawLine(rect.width - 1, 0, rect.width - 1, rect.height - 1);
    }

    public Insets getBorderInsets(Component c) {
        return new Insets(1, 1, 1, 1);
    }

    public boolean isBorderOpaque() {
        return true;
    }
}
