/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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

package blue.components;

import blue.settings.GeneralSettings;
import java.awt.Color;
import java.awt.Graphics;
import java.awt.Point;

import javax.swing.JComponent;


public class AlphaMarquee extends JComponent {

    private static final Color alphaWhite = new Color(255, 255, 255, 64);

    Point origin;

    public void setStart(Point p) {
        origin = p;
        setDragPoint(p);
    }

    public void setDragPoint(Point p) {
        int x = p.x < origin.x ? p.x : origin.x;
        int y = p.y < origin.y ? p.y : origin.y;
        int w = Math.abs(p.x - origin.x);
        int h = Math.abs(p.y - origin.y);

        this.setLocation(x, y);
        this.setSize(w, h);
        repaint();
    }

    public boolean intersects(JComponent c) {
        int marqueeLeft = this.getX();
        int marqueeRight = marqueeLeft + this.getWidth();
        int marqueeTop = this.getY();
        int marqueeBottom = marqueeTop + this.getHeight();

        int left = c.getX();
        int right = left + c.getWidth();
        int top = c.getY();
        int bottom = top + c.getHeight();

        if (left < marqueeRight && right > marqueeLeft && top < marqueeBottom
                && bottom > marqueeTop) {
            return true;
        }
        return false;
    }

    public void paint(Graphics g) {
        if (GeneralSettings.getInstance().isAlphaEnabled()) {
            g.setColor(alphaWhite);
            g.fillRect(0, 0, this.getWidth(), this.getHeight());
        }

        g.setColor(Color.white);
        g.drawRect(0, 0, this.getWidth() - 1, this.getHeight() - 1);
    }
}