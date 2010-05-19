/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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

import blue.ui.utilities.UiUtilities;
import java.awt.Color;
import java.awt.Cursor;
import java.awt.Dimension;
import java.awt.Graphics;
import java.awt.Point;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;

import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.SwingUtilities;

import blue.utility.GUI;

public class HandGrabberMouseListener implements MouseListener,
        MouseMotionListener {

    private JScrollPane jsp;

    int startX = 0;

    int startY = 0;

    Point viewPoint = null;

    Point newPoint = new Point();

    int scrollStartX = 0;

    int scrollStartY = 0;

    boolean isWorking = false;

    public HandGrabberMouseListener(JScrollPane jsp) {
        this.jsp = jsp;
        jsp.getViewport().getView().addMouseListener(this);
        jsp.getViewport().getView().addMouseMotionListener(this);
    }

    public void mouseClicked(MouseEvent e) {
        // TODO Auto-generated method stub

    }

    public void mouseEntered(MouseEvent e) {
        // TODO Auto-generated method stub

    }

    public void mouseExited(MouseEvent e) {
        // TODO Auto-generated method stub

    }

    public void mousePressed(MouseEvent e) {
        if (UiUtilities.isRightMouseButton(e) && e.isShiftDown()) {
            isWorking = true;

            jsp.getViewport().getView().setCursor(
                    Cursor.getPredefinedCursor(Cursor.MOVE_CURSOR));

            startX = e.getX();
            startY = e.getY();

            scrollStartX = jsp.getHorizontalScrollBar().getValue();
            scrollStartY = jsp.getVerticalScrollBar().getValue();

            viewPoint = jsp.getViewport().getViewPosition();
        }

    }

    public void mouseReleased(MouseEvent e) {
        if (isWorking) {
            jsp.getViewport().getView().setCursor(Cursor.getDefaultCursor());
        }

        isWorking = false;

    }

    public void mouseDragged(MouseEvent e) {
        if (isWorking) {
            int diffX = startX - e.getX();
            int diffY = startY - e.getY();

            int maxX = jsp.getHorizontalScrollBar().getMaximum();
            int maxY = jsp.getVerticalScrollBar().getMaximum();

            // maxX = (maxX < 0) ? 0 : maxX;
            // maxY = (maxY < 0) ? 0 : maxY;

            // if(newPoint.x < 0 ) {
            // newPoint.x = 0;
            // }
            //
            // if(newPoint.x > maxX) {
            // newPoint.x = maxX;
            // }
            //
            // if(newPoint.y < 0 ) {
            // newPoint.y = 0;
            // }
            //
            // if(newPoint.y > maxY) {
            // newPoint.y = maxY;
            // }

            int newX = scrollStartX + diffX;
            int newY = scrollStartY + diffY;

            if (newX < 0) {
                newX = 0;
            }

            if (newX > maxX) {
                newX = maxX;
            }

            if (newY < 0) {
                newY = 0;
            }

            if (newY > maxY) {
                newY = maxY;
            }

            // jsp.getV

            // jsp.getViewport().setViewPosition(newPoint);

            final int tempX = newX;
            final int tempY = newY;

            SwingUtilities.invokeLater(new Runnable() {

                public void run() {
                    jsp.getHorizontalScrollBar().setValue(tempX);
                    jsp.getVerticalScrollBar().setValue(tempY);
                }

            });

        }
    }

    public void mouseMoved(MouseEvent e) {
        // TODO Auto-generated method stub

    }

    public static void main(String args[]) {

        JPanel panel = new JPanel() {
            public void paintComponent(Graphics g) {
                super.paintComponent(g);

                g.setColor(Color.BLACK);

                int h = getHeight();
                int w = getWidth();

                g.fillRect(0, 0, w, h);

                g.setColor(Color.DARK_GRAY);

                for (int i = 0; i < h; i += 10) {
                    g.drawLine(0, i, w, i);
                }

                for (int i = 0; i < w; i += 10) {
                    g.drawLine(i, 0, i, h);
                }
            }
        };

        panel.setSize(10000, 10000);
        panel.setPreferredSize(new Dimension(1000, 1000));

        JScrollPane jsp = new JScrollPane(panel);

        new HandGrabberMouseListener(jsp);

        GUI.showComponentAsStandalone(jsp, "Hand Grabber Test", true);
    }
}
