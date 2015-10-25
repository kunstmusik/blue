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
 * This file uses code from MetouiaTextField.java by Taoufik Romdhane
 * 
 */
package blue.plaf;

import java.awt.Component;
import java.awt.Graphics;
import java.awt.Insets;
import javax.swing.border.AbstractBorder;
import javax.swing.plaf.UIResource;
import javax.swing.text.JTextComponent;

/**
 * This is a simple 3d border class used for text fields.
 * 
 * @author Taoufik Romdhane
 */
public class BlueTextFieldBorder extends AbstractBorder implements UIResource {

    /**
     * The border insets.
     */
    private static final Insets insets = new Insets(4, 8, 4, 8);

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
        if (!(c instanceof JTextComponent)) {
            if (c.isEnabled()) {
//                BlueBorderUtilities.drawPressed3DFieldBorder(g, x, y, w, h);
                g.setColor(BlueLookAndFeel.getControlShadow().darker());
                g.drawRoundRect(x, y, w -1, h -1, 4, 4);
            } else {
//                BlueBorderUtilities.drawDisabledBorder(g, x, y, w, h);
                g.setColor(BlueLookAndFeel.getControlShadow().darker());
                g.drawRoundRect(x, y, w -1, h -1, 4, 4);
            }
            return;
        }

        if (c.isEnabled() && ((JTextComponent) c).isEditable()) {
//            BlueBorderUtilities.drawPressed3DFieldBorder(g, x, y, w, h);
            g.setColor(BlueLookAndFeel.getControlShadow().darker());
            g.drawRoundRect(x, y, w -1, h -1, 4, 4);
        } else {
//            BlueBorderUtilities.drawDisabledBorder(g, x, y, w, h);
            g.setColor(BlueLookAndFeel.getControlShadow().darker());
            g.drawRoundRect(x, y, w -1, h -1, 4, 4);
        }
    }
}