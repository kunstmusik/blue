/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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

import java.awt.Component;
import java.awt.Graphics;

import javax.swing.Icon;

public class IconFactory {

    private static Icon rightArrowIcon = null;

    private static Icon leftArrowIcon = null;

    private static Icon downArrowIcon = null;

    public static Icon getRightArrowIcon() {
        if (rightArrowIcon == null) {
            rightArrowIcon = new RightArrowIcon();
        }
        return rightArrowIcon;
    }

    public static Icon getLeftArrowIcon() {
        if (leftArrowIcon == null) {
            leftArrowIcon = new LeftArrowIcon();
        }
        return leftArrowIcon;
    }

    public static Icon getDownArrowIcon() {
        if (downArrowIcon == null) {
            downArrowIcon = new DownArrowIcon();
        }
        return downArrowIcon;
    }

    private static class RightArrowIcon implements Icon {

        public void paintIcon(Component c, Graphics g, int x, int y) {
            g.translate(x, y);
            g.setColor(c.getForeground());

            g.drawLine(0, 0, 0, 7);
            g.drawLine(1, 1, 1, 6);
            g.drawLine(2, 2, 2, 5);
            g.drawLine(3, 3, 3, 4);
            g.translate(-x, -y);

        }

        public int getIconWidth() {
            return 4;
        }

        public int getIconHeight() {
            // TODO Auto-generated method stub
            return 8;
        }

    }

    private static class LeftArrowIcon implements Icon {

        public void paintIcon(Component c, Graphics g, int x, int y) {
            g.translate(x, y);
            g.setColor(c.getForeground());

            g.drawLine(3, 0, 3, 7);
            g.drawLine(2, 1, 2, 6);
            g.drawLine(1, 2, 1, 5);
            g.drawLine(0, 3, 0, 4);
            g.translate(-x, -y);

        }

        public int getIconWidth() {
            return 4;
        }

        public int getIconHeight() {
            // TODO Auto-generated method stub
            return 8;
        }

    }

    private static class DownArrowIcon implements Icon {

        public void paintIcon(Component c, Graphics g, int x, int y) {
            g.translate(x, y);
            g.setColor(c.getForeground());

            g.drawLine(0, 0, 7, 0);
            g.drawLine(1, 1, 6, 1);
            g.drawLine(2, 2, 5, 2);
            g.drawLine(3, 3, 4, 3);
            g.translate(-x, -y);

        }

        public int getIconWidth() {
            return 8;
        }

        public int getIconHeight() {
            // TODO Auto-generated method stub
            return 4;
        }

    }
}
