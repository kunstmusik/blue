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
 *                                                                              
 * This file uses code from MetouiaMenuUI.java by Taoufik Romdhane
 * 
 */

package blue.plaf;

import java.awt.Graphics;

import javax.swing.JComponent;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.basic.BasicMenuUI;

/**
 * This class represents the UI delegate for the JMenu component.
 * 
 * @author Taoufik Romdhane
 */
public class BlueMenuUI extends BasicMenuUI {

    /**
     * Creates the UI delegate for the given component.
     * 
     * @param c
     *            The component to create its UI delegate.
     * @return The UI delegate for the given component.
     */
    public static ComponentUI createUI(JComponent c) {
        return new BlueMenuUI();
    }

    /**
     * Paints the given component.
     * 
     * @param g
     *            The graphics context to use.
     * @param c
     *            The component to paint.
     */
    public void paint(Graphics g, JComponent c) {
        super.paint(g, c);
        // Container parent = menuItem.getParent();

        // Paint the horizontal highlight gradient:
        // MetouiaGradients.drawHighlight(g, new Rectangle(0, -1,
        // parent.getWidth(), parent.getHeight() / 2),true, true);

        // Paint the horizontal shadow gradient:
        // MetouiaGradients.drawShadow(g,new Rectangle(0, parent.getHeight() / 2
        // - 1,parent.getWidth(), parent.getHeight() / 2),true, false);
    }
}