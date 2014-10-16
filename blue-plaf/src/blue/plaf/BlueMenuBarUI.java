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
 *                                                                              
 * This file uses code from MetouiaMenuBarUI.java by Taoufik Romdhane
 * 
 */
package blue.plaf;

import java.awt.Graphics;

import javax.swing.JComponent;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.basic.BasicMenuBarUI;

/**
 * This class represents the UI delegate for the JMenuBar component.
 * 
 * @author Taoufik Romdhane
 */
public class BlueMenuBarUI extends BasicMenuBarUI {

    /**
     * Creates the UI delegate for the given component. Because in normal
     * application there is usually only one menu bar, the UI delegate isn't
     * cached here.
     * 
     * @param c
     *            The component to create its UI delegate.
     * @return The UI delegate for the given component.
     */
    public static ComponentUI createUI(JComponent c) {
        return new BlueMenuBarUI();
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

        // Paint the horizontal highlight gradient:
        // MetouiaGradients.drawHorizontalHighlight(g, c);

        // Paint the horizontal shadow gradient:
        // MetouiaGradients.drawHorizontalShadow(g, c);
    }
}