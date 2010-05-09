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
 * This file uses code from MetouiaScrollButton.java by Taoufik Romdhane
 * 
 */
package blue.plaf;

import java.awt.Color;
import java.awt.Graphics;

import javax.swing.plaf.metal.MetalScrollButton;

/**
 * This class represents an arrow button used in scrollbars.
 * 
 * @author Taoufik Romdhane
 */
public class BlueScrollButton extends MetalScrollButton {

    private boolean isFreeStanding;

    /**
     * Creates a new scroll button with the given direction and width.
     * 
     * @param direction
     *            The arrow direction of the button.
     * @param width
     *            The button's width.
     * @param freeStanding
     *            The button's state (stand alonne or in scrollbar).
     */
    public BlueScrollButton(int direction, int width, boolean freeStanding) {
        super(direction, width, freeStanding);
        this.isFreeStanding = freeStanding;
        this.setBackground(BlueLookAndFeel.getControl());
    }

    public void paint(Graphics g) {
        boolean leftToRight = this.getComponentOrientation().isLeftToRight();
        boolean isEnabled = getParent().isEnabled();

        Color arrowColor = isEnabled ? BlueLookAndFeel.getControlInfo()
                : BlueLookAndFeel.getControlDisabled();
        boolean isPressed = getModel().isPressed();
        int width = getWidth();
        int height = getHeight();
        int w = width;
        int h = height;
        int arrowHeight = (height + 1) / 4;

        if (isPressed) {
            g.setColor(BlueLookAndFeel.getControlShadow());
        } else {
            g.setColor(getBackground());
        }

        g.fillRect(0, 0, width, height);

        if (getDirection() == NORTH) {
            if (!isFreeStanding) {
                height += 1;
                g.translate(0, -1);
                if (!leftToRight) {
                    width += 1;
                    g.translate(-1, 0);
                } else {
                    width += 2;
                }
            }

            // Draw the arrow
            g.setColor(arrowColor);
            int startY = ((h + 1) - arrowHeight) / 2;
            int startX = (w / 2);

            for (int line = 0; line < arrowHeight; line++) {
                g.drawLine(startX - line, startY + line, startX + line + 1,
                        startY + line);
            }

            if (isEnabled) {
                if (isPressed) {
                    BlueBorderUtilities.drawPressed3DBorder(g, 0, 0, w, h);
                } else {
                    BlueBorderUtilities.drawSimple3DBorder(g, 0, 0, w, h);
                }

            } else {
                BlueBorderUtilities.drawDisabledBorder(g, 0, 0, width,
                        height + 1);
            }
            if (!isFreeStanding) {
                height -= 1;
                g.translate(0, 1);
                if (!leftToRight) {
                    width -= 1;
                    g.translate(1, 0);
                } else {
                    width -= 2;
                }
            }
        } else if (getDirection() == SOUTH) {
            if (!isFreeStanding) {
                height += 1;
                if (!leftToRight) {
                    width += 1;
                    g.translate(-1, 0);
                } else {
                    width += 2;
                }
            }

            // Draw the arrow
            g.setColor(arrowColor);

            int startY = (((h + 1) - arrowHeight) / 2) + arrowHeight - 1;
            int startX = (w / 2);

            for (int line = 0; line < arrowHeight; line++) {
                g.drawLine(startX - line, startY - line, startX + line + 1,
                        startY - line);
            }

            if (isEnabled) {
                if (isPressed) {
                    BlueBorderUtilities.drawPressed3DBorder(g, 0, 0, w, h);
                } else {
                    BlueBorderUtilities.drawSimple3DBorder(g, 0, 0, w, h);
                }
            } else {
                BlueBorderUtilities.drawDisabledBorder(g, 0, -1, width,
                        height + 1);
            }

            if (!isFreeStanding) {
                height -= 1;
                if (!leftToRight) {
                    width -= 1;
                    g.translate(1, 0);
                } else {
                    width -= 2;
                }
            }
        } else if (getDirection() == EAST) {
            if (!isFreeStanding) {
                height += 2;
                width += 1;
            }

            // Draw the arrow
            g.setColor(arrowColor);

            int startX = (((w + 1) - arrowHeight) / 2) + arrowHeight - 1;
            int startY = (h / 2);

            for (int line = 0; line < arrowHeight; line++) {
                g.drawLine(startX - line, startY - line, startX - line, startY
                        + line + 1);
            }

            if (isEnabled) {
                if (isPressed) {
                    BlueBorderUtilities.drawPressed3DBorder(g, 0, 0, w, h);
                } else {
                    BlueBorderUtilities.drawSimple3DBorder(g, 0, 0, w, h);
                }
            } else {
                BlueBorderUtilities.drawDisabledBorder(g, -1, 0, width + 1,
                        height);
            }
            if (!isFreeStanding) {
                height -= 2;
                width -= 1;
            }
        } else if (getDirection() == WEST) {
            if (!isFreeStanding) {
                height += 2;
                width += 1;
                g.translate(-1, 0);
            }

            // Draw the arrow
            g.setColor(arrowColor);

            int startX = (((w + 1) - arrowHeight) / 2);
            int startY = (h / 2);

            for (int line = 0; line < arrowHeight; line++) {
                g.drawLine(startX + line, startY - line, startX + line, startY
                        + line + 1);
            }

            if (isEnabled) {
                if (isPressed) {
                    BlueBorderUtilities.drawPressed3DBorder(g, 0, 0, w, h);
                } else {
                    BlueBorderUtilities.drawSimple3DBorder(g, 0, 0, w, h);
                }
            } else {
                BlueBorderUtilities.drawDisabledBorder(g, 0, 0, width + 1,
                        height);
            }

            if (!isFreeStanding) {
                height -= 2;
                width -= 1;
                g.translate(1, 0);
            }
        }
    }
}