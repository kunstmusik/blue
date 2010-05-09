/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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
import java.awt.Graphics;
import java.awt.Point;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseMotionAdapter;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.util.ArrayList;

import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.SwingUtilities;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class EdittableGraph extends JComponent {
    ArrayList points = new ArrayList();

    int xMin = 0;

    int xMax = 1024;

    int yMin = -100;

    int yMax = 100;

    public EdittableGraph() {
        for (int i = 0; i < 5; i++) {
            ClickPoint temp = new ClickPoint();
            temp.setLocation(i * 20, 50);
            this.add(temp);
            points.add(temp);
        }
    }

    public Point translateNumbersToPoint(int x, int y) {
        Point p = new Point();
        p.x = (int) (((float) x / (float) xMax) * this.getWidth());
        p.y = (int) (((float) y / (float) yMax) * this.getHeight());
        return p;
    }

    public void paintComponent(Graphics g) {
        // super.paint(g);
        ClickPoint a, b;
        g.setColor(Color.black);
        for (int i = 0; i < points.size(); i++) {
            if (i != 0) {
                a = (ClickPoint) points.get(i);
                b = (ClickPoint) points.get(i - 1);
                g.drawLine(a.getX() + 1, a.getY() + 1, b.getX() + 1,
                        b.getY() + 1);
            }

        }
    }

    /* UNIT TEST */
    public static void main(String args[]) {
        JFrame mFrame = new JFrame();
        mFrame.setSize(800, 600);
        EdittableGraph a = new EdittableGraph();
        mFrame.getContentPane().add(a);

        /*
         * for(int i = 0; i < 20; i++) { Instrument temp = new
         * GenericInstrument(); temp.setName("temp" + i); a.addInstrument(temp); }
         */

        mFrame.show();
        mFrame.addWindowListener(new WindowAdapter() {
            public void windowClosing(WindowEvent e) {
                System.exit(0);
            }
        });
    }

}

class ClickPoint extends JComponent {
    public int x = 0;

    public int y = 0;

    boolean over = false;

    boolean drag = false;

    boolean endPoint = false;

    private static Color overColor = Color.cyan;

    private static Color normalColor = Color.black;

    public ClickPoint() {
        this.setSize(3, 3);
        this.addMouseListener(new MouseAdapter() {
            public void mouseClicked(MouseEvent e) {

            }

            public void mousePressed(MouseEvent e) {
                drag = true;
            }

            public void mouseReleased(MouseEvent e) {
                drag = false;
            }

            public void mouseEntered(MouseEvent e) {
                over = true;
                repaint();
            }

            public void mouseExited(MouseEvent e) {
                over = false;
                repaint();
            }
        });
        this.addMouseMotionListener(new MouseMotionAdapter() {
            public void mouseDragged(MouseEvent e) {
                if (drag) {
                    doDrag(e.getX(), e.getY());
                }
            }

            public void mouseMoved(MouseEvent e) {
            }
        });
    }

    public void setEndpoint(boolean val) {
        this.endPoint = val;
    }

    public boolean isEndpoint() {
        return this.endPoint;
    }

    public void doDrag(int x, int y) {
        Point p = SwingUtilities.convertPoint(this, x, y, this.getParent());

        this.setLocation(p.x, p.y);
        this.getParent().repaint();
    }

    public void paint(Graphics g) {
        if (over) {
            g.setColor(overColor);
        } else {
            g.setColor(normalColor);
        }
        g.fillRect(0, 0, 3, 3);
    }

}