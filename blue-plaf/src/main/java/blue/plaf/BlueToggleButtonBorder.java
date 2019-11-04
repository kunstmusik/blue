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
 * This file uses code from MetouiaButtonBorder.java by Taoufik Romdhane.
 */

package blue.plaf;

import java.awt.Component;
import java.awt.Graphics;
import java.awt.Insets;
import javax.swing.ButtonModel;
import javax.swing.JToggleButton;
import javax.swing.border.AbstractBorder;
import javax.swing.plaf.UIResource;

/**
 * This is a simple 3d border class used for buttons.
 * 
 * @author Taoufik Romdhane
 */
public class BlueToggleButtonBorder extends AbstractBorder implements
        UIResource {

    /**
     * The border insets.
     */
    protected static final Insets insets = new Insets(2, 2, 2, 2);

    /**
     * Draws a simple 3d border for the given component.
     * 
     * @param c
     *            The component to draw its border.
     * @param g
     *            The graphics context.
     * @param x
     *            The x coordinate of the top left corner.
     * @param y
     *            The y coordinate of the top left corner.
     * @param w
     *            The width.
     * @param h
     *            The height.
     */
    @Override
    public void paintBorder(Component c, Graphics g, int x, int y, int w, int h) {
        JToggleButton button = (JToggleButton) c;
        ButtonModel model = button.getModel();

        // Optimizations are welcome here!
        if (model.isEnabled()) {
            if (model.isPressed() && model.isArmed()) {
                BlueBorderUtilities.drawPressed3DBorder(g, x, y, w, h);
            } else {
                // if (button.isDefaultButton())
                // {
                // BlueBorderUtilities.drawDefaultButtonBorder(g, x, y, w, h);
                // }
                // else
                // {
                if (button.isRolloverEnabled()) {
                    if (model.isRollover()) {
                        BlueBorderUtilities.drawSimple3DBorder(g, x, y, w, h);
                    }
                } else {
                    BlueBorderUtilities.drawSimple3DBorder(g, x, y, w, h);
                }
                // }
            }
            if (button.isSelected()) {
                BlueBorderUtilities.drawPressed3DBorder(g, x, y, w, h);
            }
        } else {
            if (!button.isRolloverEnabled()) {
                BlueBorderUtilities.drawDisabledBorder(g, x, y, w - 1, h - 1);
            }
        }
    }

    /**
     * Gets the border insets for a given component.
     * 
     * @param c
     *            The component to get its border insets.
     * @return Always returns the same insets as defined in <code>insets</code>.
     */
    @Override
    public Insets getBorderInsets(Component c) {
        return insets;
    }
}