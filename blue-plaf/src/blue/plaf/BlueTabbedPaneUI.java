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
 * This file uses code from MetouiaTabbedPaneUI.java by Taoufik Romdhane
 *
 */
package blue.plaf;

import java.awt.Color;
import java.awt.Graphics;
import java.awt.Insets;
import java.awt.Rectangle;

import javax.swing.JComponent;
import javax.swing.UIManager;
import javax.swing.plaf.ComponentUI;
import javax.swing.plaf.basic.BasicTabbedPaneUI;

//import blue.gui.TabbedPaneSwitchDropTarget;

/**
 * This class represents the UI delegate for the JTabbedPane component.
 * 
 * @author Taoufik Romdhane
 */
public class BlueTabbedPaneUI extends BasicTabbedPaneUI {

    /**
     * The outer highlight color of the border.
     */
    private Color outerHighlight = BlueLookAndFeel.getControlDisabled();

    /**
     * The inner highlight color of the border.
     */
    private Color innerHighlight = BlueLookAndFeel.getPrimaryControlHighlight();

    /**
     * The outer shadow color of the border.
     */
    private Color outerShadow = BlueLookAndFeel.getControlDarkShadow();

    /**
     * The inner shadow color of the border.
     */
    private Color innerShadow = BlueLookAndFeel.getDesktopColor();

    /**
     * Creates the UI delegate for the given component.
     * 
     * @param c
     *            The component to create its UI delegate.
     * @return The UI delegate for the given component.
     */
    public static ComponentUI createUI(JComponent c) {
        return new BlueTabbedPaneUI();
    }

    /**
     * Paints the backround of a given tab.
     * 
     * @param g
     *            The graphics context.
     * @param tabPlacement
     *            The placement of the tab to paint.
     * @param tabIndex
     *            The index of the tab to paint.
     * @param x
     *            The x coordinate of the top left corner.
     * @param y
     *            The y coordinate of the top left corner.
     * @param w
     *            The width.
     * @param h
     *            The height.
     * @param isSelected
     *            True if the tab to paint is selected otherwise false.
     */
    protected void paintTabBackground(Graphics g, int tabPlacement,
            int tabIndex, int x, int y, int w, int h, boolean isSelected) {
        // if (isSelected)
        // {
        g.setColor(UIManager.getColor("TabbedPane.selected"));
        // }
        // else
        // {
        // g.setColor(UIManager.getColor("TabbedPane.unselected"));
        // g.setColor(tabPane.getBackgroundAt(tabIndex));
        // }
        switch (tabPlacement) {
            case LEFT:
                g.fillRect(x + 1, y + 1, w - 2, h - 3);
                break;
            case RIGHT:
                g.fillRect(x, y + 1, w - 2, h - 3);
                break;
            case BOTTOM:
                g.fillRect(x + 1, y, w - 3, h - 1);
                break;
            case TOP:
            default:
                g.fillRect(x + 1, y + 1, w - 3, h - 1);
        }
    }

    /**
     * Paints the border of a given tab.
     * 
     * @param g
     *            The graphics context.
     * @param tabPlacement
     *            The placement of the tab to paint.
     * @param selectedIndex
     *            The index of the selected tab.
     */
    protected void paintContentBorder(Graphics g, int tabPlacement,
            int selectedIndex) {
        int width = tabPane.getWidth();
        int height = tabPane.getHeight();
        Insets insets = tabPane.getInsets();

        int x = insets.left;
        int y = insets.top;
        int w = width - insets.right - insets.left;
        int h = height - insets.top - insets.bottom;

        switch (tabPlacement) {
            case LEFT:
                x += calculateTabAreaWidth(tabPlacement, runCount, maxTabWidth);
                w -= (x - insets.left);
                break;
            case RIGHT:
                w -= calculateTabAreaWidth(tabPlacement, runCount, maxTabWidth);
                break;
            case BOTTOM:
                h -= calculateTabAreaHeight(tabPlacement, runCount,
                        maxTabHeight);
                break;
            case TOP:
            default:
                y += calculateTabAreaHeight(tabPlacement, runCount,
                        maxTabHeight);
                h -= (y - insets.top);
        }
        paintContentBorderTopEdge(g, tabPlacement, selectedIndex, x, y, w, h);
        paintContentBorderLeftEdge(g, tabPlacement, selectedIndex, x, y, w, h);
        paintContentBorderBottomEdge(g, tabPlacement, selectedIndex, x, y, w, h);
        paintContentBorderRightEdge(g, tabPlacement, selectedIndex, x, y, w, h);

    }

    /**
     * Paints the top edge of the content border.
     * 
     * @param g
     *            The graphics context.
     * @param tabPlacement
     *            The placement of the tabs.
     * @param selectedIndex
     *            The index of the selected tab.
     * @param x
     *            The x coordinate of the top left corner.
     * @param y
     *            The y coordinate of the top left corner.
     * @param w
     *            The width.
     * @param h
     *            The height.
     */
    protected void paintContentBorderTopEdge(Graphics g, int tabPlacement,
            int selectedIndex, int x, int y, int w, int h) {
        if (tabPlacement != TOP
                || selectedIndex < 0
                || (rects[selectedIndex].y + rects[selectedIndex].height + 1 < y)) {
            g.setColor(outerHighlight);
            g.drawLine(x, y, x + w - 2, y);

            g.setColor(innerHighlight);
            g.drawLine(x, y + 1, x + w - 2, y + 1);
        } else {
            Rectangle selRect = rects[selectedIndex];

            g.setColor(outerHighlight);
            g.drawLine(x, y, selRect.x - 1, y);

            g.setColor(innerHighlight);
            g.drawLine(x, y + 1, selRect.x - 2, y + 1);

            if (selRect.x + selRect.width < x + w - 2) {
                g.setColor(outerHighlight);
                g.drawLine(selRect.x + selRect.width, y, x + w - 2, y);

                g.setColor(innerHighlight);
                g.drawLine(selRect.x + selRect.width, y + 1, x + w - 2, y + 1);
            } else {
                g.setColor(shadow);
                g.setColor(Color.red);
                g.drawLine(x + w - 2, y, x + w - 2, y);
            }
        }
    }

    /**
     * Paints the left edge of the content border.
     * 
     * @param g
     *            The graphics context.
     * @param tabPlacement
     *            The placement of the tabs.
     * @param selectedIndex
     *            The index of the selected tab.
     * @param x
     *            The x coordinate of the top left corner.
     * @param y
     *            The y coordinate of the top left corner.
     * @param w
     *            The width.
     * @param h
     *            The height.
     */
    protected void paintContentBorderLeftEdge(Graphics g, int tabPlacement,
            int selectedIndex, int x, int y, int w, int h) {
        if (tabPlacement != LEFT
                || selectedIndex < 0
                || (rects[selectedIndex].x + rects[selectedIndex].width + 1 < x)) {
            g.setColor(outerHighlight);
            g.drawLine(x, y, x, y + h - 2);

            g.setColor(innerHighlight);
            g.drawLine(x + 1, y + 1, x + 1, y + h - 2);
        } else {
            Rectangle selRect = rects[selectedIndex];

            g.setColor(outerHighlight);
            g.drawLine(x, y, x, selRect.y - 1);

            g.setColor(innerHighlight);
            g.drawLine(x + 1, y + 1, x + 1, selRect.y - 2);

            if (selRect.y + selRect.height < y + h - 2) {
                g.setColor(outerHighlight);
                g.drawLine(x, selRect.y + selRect.height, x, y + h - 2);

                g.setColor(innerHighlight);
                g.drawLine(x + 1, selRect.y + selRect.height, x + 1, y + h - 2);
            }
        }
    }

    /**
     * Paints the bottom edge of the content border.
     * 
     * @param g
     *            The graphics context.
     * @param tabPlacement
     *            The placement of the tabs.
     * @param selectedIndex
     *            The index of the selected tab.
     * @param x
     *            The x coordinate of the top left corner.
     * @param y
     *            The y coordinate of the top left corner.
     * @param w
     *            The width.
     * @param h
     *            The height.
     */
    protected void paintContentBorderBottomEdge(Graphics g, int tabPlacement,
            int selectedIndex, int x, int y, int w, int h) {
        g.setColor(innerShadow);
        if (tabPlacement != BOTTOM || selectedIndex < 0
                || (rects[selectedIndex].y - 1 > h)) {
            g.drawLine(x + 2, y + h - 2, x + w - 2, y + h - 2);
            g.setColor(outerShadow);
            g.drawLine(x, y + h - 1, x + w - 1, y + h - 1);
        } else {
            Rectangle selRect = rects[selectedIndex];

            g.drawLine(x + 2, y + h - 2, selRect.x - 1, y + h - 2);
            g.setColor(outerShadow);
            g.drawLine(x, y + h - 1, selRect.x - 1, y + h - 1);
            if (selRect.x + selRect.width < x + w - 2) {
                g.setColor(innerShadow);
                g.drawLine(selRect.x + selRect.width, y + h - 2, x + w - 2, y
                        + h - 2);
                g.setColor(outerShadow);
                g.drawLine(selRect.x + selRect.width, y + h - 1, x + w - 1, y
                        + h - 1);
            }
        }

    }

    /**
     * Paints the right edge of the content border.
     * 
     * @param g
     *            The graphics context.
     * @param tabPlacement
     *            The placement of the tabs.
     * @param selectedIndex
     *            The index of the selected tab.
     * @param x
     *            The x coordinate of the top left corner.
     * @param y
     *            The y coordinate of the top left corner.
     * @param w
     *            The width.
     * @param h
     *            The height.
     */
    protected void paintContentBorderRightEdge(Graphics g, int tabPlacement,
            int selectedIndex, int x, int y, int w, int h) {

        g.setColor(innerShadow);
        if (tabPlacement != RIGHT || selectedIndex < 0
                || rects[selectedIndex].x - 1 > w) {
            g.drawLine(x + w - 2, y + 1, x + w - 2, y + h - 3);
            g.setColor(outerShadow);
            g.drawLine(x + w - 1, y, x + w - 1, y + h - 1);
        } else {
            Rectangle selRect = rects[selectedIndex];

            g.drawLine(x + w - 2, y + 1, x + w - 2, selRect.y - 1);
            g.setColor(outerShadow);
            g.drawLine(x + w - 1, y, x + w - 1, selRect.y - 1);

            if (selRect.y + selRect.height < y + h - 2) {
                g.setColor(innerShadow);
                g.drawLine(x + w - 2, selRect.y + selRect.height, x + w - 2, y
                        + h - 2);
                g.setColor(outerShadow);
                g.drawLine(x + w - 1, selRect.y + selRect.height, x + w - 1, y
                        + h - 2);
            }
        }
    }

    /**
     * Draws the border around each tab.
     * 
     * @param g
     *            The graphics context.
     * @param tabPlacement
     *            The placement of the tabs.
     * @param tabIndex
     *            The index of the tab to paint.
     * @param x
     *            The x coordinate of the top left corner.
     * @param y
     *            The y coordinate of the top left corner.
     * @param w
     *            The width.
     * @param h
     *            The height.
     * @param isSelected
     *            True if the tab to paint is selected otherwise false.
     */
    protected void paintTabBorder(Graphics g, int tabPlacement, int tabIndex,
            int x, int y, int w, int h, boolean isSelected) {
        g.setColor(outerHighlight);

        switch (tabPlacement) {
            case LEFT:
                g.drawLine(x + 1, y + h - 2, x + 1, y + h - 2);
                // bottom-left highlight
                g.drawLine(x, y + 2, x, y + h - 3); // left highlight
                g.drawLine(x + 1, y + 1, x + 1, y + 1); // top-left highlight
                g.drawLine(x + 2, y, x + w - 1, y); // top highlight

                g.setColor(shadow);
                g.drawLine(x + 2, y + h - 2, x + w - 1, y + h - 2);
                // bottom shadow

                g.setColor(darkShadow);
                // bottom dark shadow
                g.drawLine(x + 2, y + h - 1, x + w - 1, y + h - 1);
                break;
            case RIGHT:
                g.drawLine(x, y, x + w - 3, y); // top highlight

                g.setColor(shadow);
                g.drawLine(x, y + h - 2, x + w - 3, y + h - 2);
                // bottom shadow
                g.drawLine(x + w - 2, y + 2, x + w - 2, y + h - 3);
                // right shadow

                g.setColor(darkShadow);
                // top-right dark shadow
                g.drawLine(x + w - 2, y + 1, x + w - 2, y + 1);
                // bottom-right dark shadow
                g.drawLine(x + w - 2, y + h - 2, x + w - 2, y + h - 2);
                // right dark shadow
                g.drawLine(x + w - 1, y + 2, x + w - 1, y + h - 3);
                // bottom dark shadow
                g.drawLine(x, y + h - 1, x + w - 3, y + h - 1);
                break;
            case BOTTOM:
                g.drawLine(x, y, x, y + h - 3); // left highlight
                g.drawLine(x + 1, y + h - 2, x + 1, y + h - 2);
                // bottom-left highlight

                g.setColor(shadow);
                g.drawLine(x + 2, y + h - 2, x + w - 3, y + h - 2);
                // bottom shadow
                g.drawLine(x + w - 2, y, x + w - 2, y + h - 3); // right shadow

                g.setColor(darkShadow);
                // bottom dark shadow
                g.drawLine(x + 2, y + h - 1, x + w - 3, y + h - 1);
                // bottom-right dark shadow
                g.drawLine(x + w - 2, y + h - 2, x + w - 2, y + h - 2);
                // right dark shadow
                g.drawLine(x + w - 1, y, x + w - 1, y + h - 3);
                break;
            case TOP:
            default:
                int yoffset = isSelected ? -1 : 0;
                // int xoffset = isSelected ? 0 : (tabIndex > 0) 0;
                boolean bla = (!isSelected && tabIndex > 0);
                if (bla) {
                    x--;
                    w += 1;
                } else {
                    g.drawLine(x, y + 2, x, y + h - 1 + yoffset);
                    // left highlight
                }
                g.drawLine(x + 1, y + 1, x + 1, y + 1); // top-left highlight
                g.drawLine(x + 2, y, x + w - 3, y); // top highlight

                g.setColor(innerHighlight);
                g.drawLine(x + 1, y + 2, x + 1, y + h - 1 + yoffset);
                // left highlight
                g.drawLine(x + 1, y + 2, x + 1, y + 2); // top-left highlight
                g.drawLine(x + 2, y + 1, x + w - 3, y + 1); // top highlight

                // g.setColor(Color.red);
                // top highlight
                g.drawLine(x + w - 1, y + h + yoffset, x + w - 1, y + h
                        + yoffset);

                g.setColor(innerShadow);
                // g.setColor(Color.red);
                // right shadow
                g.drawLine(x + w - 2, y + 2, x + w - 2, y + h - 1 + yoffset);

                if (!isSelected) {
                    g.setColor(outerHighlight);
                } else {
                    g.setColor(outerShadow);
                }
                // right dark-shadow
                g.drawLine(x + w - 1, y + 2, x + w - 1, y + h - 1 + yoffset);
                // right dark-shadow
                g.drawLine(x + w - 2, y + 1, x + w - 2, y + 1);
                // g.drawLine(x+w-2, y+1, x+w-2, y+2); // top-right shadow
        }
    }

    protected void installListeners() {
        super.installListeners();

//        new DropTarget(tabPane, new TabbedPaneSwitchDropTarget(tabPane));
    }

    protected void uninstallListeners() {
        // TODO Auto-generated method stub
        super.uninstallListeners();
    }

}