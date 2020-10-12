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

import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.dnd.DropTargetDragEvent;
import java.awt.dnd.DropTargetDropEvent;
import java.awt.dnd.DropTargetEvent;
import java.awt.dnd.DropTargetListener;
import javax.swing.JPanel;
import javax.swing.JRootPane;
import javax.swing.JTable;
import javax.swing.SwingUtilities;

/**
 * Code modified from http://jroller.com/page/santhosh/ May 25, 2005 blog entry
 * "Visual Clues for JList DND" to work with JTable
 * 
 * @author Santhosh Kumar - santhosh@in.fiorano.com
 * @author Steven Yi
 */
public class TableHilightDropListener implements DropTargetListener {

    private Component oldGlassPane;

    private Point from, to;

    // glasspane on which visual clues are drawn
    JPanel glassPane = new JPanel() {

        @Override
        public void paint(Graphics g) {
            g.setColor(Color.GREEN);
            if (from == null || to == null) {
                return;
            }
            int x1 = from.x;
            int x2 = to.x;
            int y1 = from.y;

            // line
            g.drawLine(x1 + 2, y1, x2 - 2, y1);
            g.drawLine(x1 + 2, y1 + 1, x2 - 2, y1 + 1);

            // right
            g.drawLine(x1, y1 - 2, x1, y1 + 3);
            g.drawLine(x1 + 1, y1 - 1, x1 + 1, y1 + 2);

            // left
            g.drawLine(x2, y1 - 2, x2, y1 + 3);
            g.drawLine(x2 - 1, y1 - 1, x2 - 1, y1 + 2);
        }
    };

    // size of hotspot used to find
    // the whether user wants to insert element
    private final int hotspot = 5;

    // dropindex - subclasses can access this in to accept/reject drop
    protected int listIndex = -1;

    // null means replace element at listIndex
    // true means insert element before listIndex
    // false means insert element after listIndex
    // subclasses can access this in drop
    protected Boolean before = null;

    private void updateLine(JTable table, Point pt) {

        int h = table.getRowHeight();

        listIndex = pt != null ? (pt.y / h) : -1;

        if (listIndex > table.getRowCount()) {
            listIndex = table.getRowCount();
        }

        if (listIndex == -1) {
            from = to = null;
            before = null;
            // table.clearSelection();
        } else {
            // Rectangle bounds = table.getCellBounds(listIndex, listIndex);

            Rectangle bounds = new Rectangle(0, listIndex * h,
                    table.getWidth(), h);

            if (pt.y <= bounds.y + hotspot) {
                from = bounds.getLocation();
                to = new Point(table.getWidth(), from.y);
                before = Boolean.TRUE;
            } else if (pt.y >= bounds.y + bounds.height - hotspot) {
                from = new Point(bounds.x, bounds.y + bounds.height);
                to = new Point(table.getWidth(), from.y);
                before = Boolean.FALSE;
            } else {
                from = to = null;
                before = null;
            }

            if (from != null && to != null) {
                from = SwingUtilities.convertPoint(table, from, glassPane);
                to = SwingUtilities.convertPoint(table, to, glassPane);
                table.clearSelection();
            } else {
                // table.setRowSelectionInterval(listIndex, listIndex);
            }
        }
        glassPane.getRootPane().repaint();
    }

    @Override
    public void dragEnter(DropTargetDragEvent dtde) {

        JTable table = (JTable) dtde.getDropTargetContext().getComponent();
        Point location = dtde.getLocation();

        JRootPane rootPane = table.getRootPane();
        oldGlassPane = rootPane.getGlassPane();
        rootPane.setGlassPane(glassPane);
        glassPane.setOpaque(false);
        glassPane.setVisible(true);

        updateLine(table, location);
    }

    @Override
    public void dragOver(DropTargetDragEvent dtde) {
        JTable table = (JTable) dtde.getDropTargetContext().getComponent();
        Point location = dtde.getLocation();
        updateLine(table, location);
    }

    @Override
    public void dropActionChanged(DropTargetDragEvent dtde) {
    }

    private void resetGlassPane(DropTargetEvent dte) {
        JTable table = (JTable) dte.getDropTargetContext().getComponent();

        JRootPane rootPane = table.getRootPane();
        rootPane.setGlassPane(oldGlassPane);
        oldGlassPane.setVisible(false);
        rootPane.repaint();
    }

    @Override
    public void dragExit(DropTargetEvent dte) {
        resetGlassPane(dte);
    }

    @Override
    public void drop(DropTargetDropEvent dtde) {
        resetGlassPane(dtde);
    }
}
