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
 * This file uses code from MetouiaBorderUtilities.java by Taoufik Romdhane
 *
 */

package blue.plaf;

import java.awt.Color;
import java.awt.Graphics;
import java.awt.Rectangle;
import javax.swing.border.Border;
import javax.swing.plaf.BorderUIResource;
import javax.swing.plaf.basic.BasicBorders;

/**
 * This is a utility class for painting simple 3d borders, and providding common
 * ones.
 * 
 * @author Taoufik Romdhane
 */
public class BlueBorderUtilities {

    /**
     * Cached botton border instance.
     */
    private static Border buttonBorder;

    /**
     * Cached text border instance.
     */
    private static Border textBorder;

    /**
     * Cached text field border instance.
     */
    private static Border textFieldBorder;

    /**
     * Cached spinner border instance.
     */
    private static Border spinnerBorder;
    /**
     * Cached toggle botton border instance.
     */
    private static Border toggleButtonBorder;

    /**
     * Draws a simple 3d border.
     * 
     * @param g
     *            The graphics context.
     * @param r
     *            The rectangle object defining the bounds of the border.
     */
    static void drawSimple3DBorder(Graphics g, Rectangle r) {
        drawSimple3DBorder(g, r.x, r.y, r.width, r.height);
    }

    /**
     * Draws a simple 3d border.
     * 
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
    static void drawSimple3DBorder(Graphics g, int x, int y, int w, int h) {
        drawSimple3DBorder(g, x, y, w, h, BlueLookAndFeel
                .getControlDarkShadow(), BlueLookAndFeel.getControlHighlight());
    }

    /**
     * Draws a pressed simple 3d border. It is used for things like pressed
     * buttons.
     * 
     * @param g
     *            The graphics context.
     * @param r
     *            The rectangle object defining the bounds of the border.
     */
    static void drawPressed3DBorder(Graphics g, Rectangle r) {
        drawPressed3DBorder(g, r.x, r.y, r.width, r.height);
    }

    /**
     * Draws a disabled simple 3d border.
     * 
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
    public static void drawDisabledBorder(Graphics g, int x, int y, int w, int h) {
        drawSimple3DBorder(g, x, y, w, h, BlueLookAndFeel.getControlShadow(),
                BlueLookAndFeel.getControlHighlight());
    }

    /**
     * Draws a pressed simple 3d border. It is used for things like pressed
     * buttons.
     * 
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
    static void drawPressed3DBorder(Graphics g, int x, int y, int w, int h) {
        drawSimple3DBorder(g, x, y, w, h,
                BlueLookAndFeel.getControlHighlight(), BlueLookAndFeel
                        .getControlDarkShadow());
    }

    /**
     * Draws a simple 3d border with specified colors.
     * 
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
     * @param highlight
     *            The highlight color to use.
     * @param shadow
     *            The shadow color to use.
     */
    public static final void drawSimple3DBorder(Graphics g, int x, int y,
            int w, int h, Color highlight, Color shadow) {
        g.translate(x, y);

        g.setColor(highlight);
        g.drawLine(0, 0, w - 2, 0);
        g.drawLine(0, 1, 0, h - 1);

        g.setColor(shadow);
        g.drawLine(w - 1, 0, w - 1, h - 2);
        g.drawLine(1, h - 1, w - 1, h - 1);

        g.translate(-x, -y);
    }

    /**
     * Draws a bevel 3d border with the specified colors.
     * 
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
     * @param highlight
     *            The highlight color to use.
     * @param shadow
     *            The shadow color to use.
     * @param innerHighlight
     *            The inner highlight color to use.
     * @param innerShadow
     *            The inner shadow color to use.
     */
    public static final void drawBevel3DBorder(Graphics g, int x, int y, int w,
            int h, Color highlight, Color shadow, Color innerHighlight,
            Color innerShadow) {
        g.translate(x, y);

        g.setColor(highlight);
        g.drawLine(0, 0, w - 2, 0);
        g.drawLine(0, 1, 0, h - 1);

        g.setColor(shadow);
        g.drawLine(w - 1, 0, w - 1, h - 2);
        g.drawLine(1, h - 1, w - 1, h - 1);

        x++;
        y++;
        w -= 1;
        h -= 1;

        g.setColor(innerHighlight);
        g.drawLine(0, 0, w - 2, 0);
        g.drawLine(0, 1, 0, h - 1);

        g.setColor(innerShadow);
        g.drawLine(w - 1, 0, w - 1, h - 2);
        g.drawLine(1, h - 1, w - 1, h - 1);

        g.translate(-x, -y);
    }

    /**
     * Draws a pressed simple 3d border. It is used for things like text fields.
     * 
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
    static void drawPressed3DFieldBorder(Graphics g, int x, int y, int w, int h) {
        g.translate(x, y);

        g.setColor(BlueLookAndFeel.getControlHighlight());
        g.drawRect(1, 1, w - 2, h - 2);

        g.setColor(BlueLookAndFeel.getControlDarkShadow());
        g.drawRect(0, 0, w - 2, h - 2);

        g.translate(-x, -y);
    }

    /**
     * Draws an active button border (normal state).
     * 
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
    static void drawDefaultButtonBorder(Graphics g, int x, int y, int w, int h) {
        drawSimple3DBorder(g, x + 1, y + 1, w - 2, h - 2, BlueLookAndFeel
                .getControlDarkShadow(), BlueLookAndFeel.getControlHighlight());

        g.setColor(new Color(255,255,255, 128));
        g.drawLine( x + 2, y + 2, x + w - 3, y + 2);
        //g.drawRect(x, y, w - 1, h - 1);
    }

    /**
     * Gets a border instance for a button. The border instance is cached for
     * future use.
     * 
     * @return A border instance for a button.
     */
    public static Border getButtonBorder() {
        if (buttonBorder == null) {
            buttonBorder = new BorderUIResource.CompoundBorderUIResource(
                    new BlueButtonBorder(), new BasicBorders.MarginBorder());
        }
        return buttonBorder;
    }

    /**
     * Gets a border instance for a button. The border instance is cached for
     * future use.
     * 
     * @return A border instance for a button.
     */
    public static Border getToggleButtonBorder() {
        if (toggleButtonBorder == null) {
            toggleButtonBorder = new BorderUIResource.CompoundBorderUIResource(
                    new BlueToggleButtonBorder(),
                    new BasicBorders.MarginBorder());
        }
        return toggleButtonBorder;
    }

    /**
     * Gets a border instance for a text component. The border instance is
     * cached for future use.
     * 
     * @return A border instance for a text component.
     */
    public static Border getTextBorder() {
        if (textBorder == null) {
            textBorder = new BorderUIResource.CompoundBorderUIResource(
                    new BlueTextFieldBorder(), new BasicBorders.MarginBorder());
        }
        return textBorder;
    }

    /**
     * Gets a border instance for a text field component. The border instance is
     * cached for future use.
     * 
     * @return A border instance for a text field component.
     */
    public static Border getTextFieldBorder() {
        if (textFieldBorder == null) {
            textFieldBorder = new BorderUIResource.CompoundBorderUIResource(
                    new BlueTextFieldBorder(), new BasicBorders.MarginBorder());
        }
        return textFieldBorder;
    }

    // /**
    // * Gets a border instance for a toggle button.
    // * The border instance is cached for future use.
    // *
    // * @return A border instance for a toggle button.
    // */
    // public static Border getToggleButtonBorder()
    // {
    // if (toggleButtonBorder == null)
    // {
    // toggleButtonBorder = new BorderUIResource.CompoundBorderUIResource(
    // new MetouiaToggleButtonBorder(), new BasicBorders.MarginBorder());
    // }
    // return toggleButtonBorder;
    // }
    //
    //
    // /**
    // * Gets a border instance for a desktop icon.
    // *
    // * @return A border instance for a desktop icon.
    // */
    // public static Border getDesktopIconBorder()
    // {
    // return new BorderUIResource.CompoundBorderUIResource(
    // new LineBorder(MetouiaLookAndFeel.getControlDarkShadow(), 1),
    // new MatteBorder(2, 2, 1, 2, MetouiaLookAndFeel.getControl()));
    // }
}