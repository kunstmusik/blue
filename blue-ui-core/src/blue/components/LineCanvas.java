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
 */
package blue.components;

import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.event.ActionEvent;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.util.Iterator;

import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;

import blue.components.lines.Line;
import blue.components.lines.LineEditorDialog;
import blue.components.lines.LineList;
import blue.components.lines.LinePoint;
import blue.ui.utilities.UiUtilities;
import blue.utility.NumberUtilities;

/**
 * @author steven
 */
public class LineCanvas extends JComponent implements TableModelListener {

    private static EditPointsPopup popup = null;

    LineList lineList = null;

    Line currentLine = null;

    LinePoint selectedPoint = null;

    Line selectedLine = null;

    int leftBoundaryX = -1, rightBoundaryX = -1;

    boolean locked = false;

    TableModelListener lineListener = null;

    public LineCanvas() {
        new LineCanvasMouseListener(this);

        lineListener = new TableModelListener() {
            public void tableChanged(TableModelEvent e) {
                repaint();
            }
        };
    }

    public void setLineList(LineList lineList) {
        this.lineList = lineList;
        currentLine = null;
        repaint();
    }

    /*
     * (non-Javadoc)
     * 
     * @see javax.swing.event.TableModelListener#tableChanged(javax.swing.event.TableModelEvent)
     */
    public void tableChanged(TableModelEvent e) {
        repaint();
    }

    public void setSelectedLine(Line line) {

        if (currentLine == line) {
            return;
        }

        if (currentLine != null) {
            currentLine.removeTableModelListener(lineListener);
        }

        currentLine = line;

        if (currentLine != null) {
            currentLine.addTableModelListener(lineListener);
        }

        repaint();
    }

    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        Graphics2D g2d = (Graphics2D) g;

        RenderingHints hints = new RenderingHints(
                RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHints(hints);

        // g.setColor(bgColor);
        g2d.setColor(Color.black);
        g2d.fillRect(0, 0, this.getWidth(), this.getHeight());

        g2d.setColor(Color.lightGray);
        g2d.drawRect(5, 5, this.getWidth() - 10, this.getHeight() - 10);

        Color currentColor = null;

        if (lineList == null) {
            return;
        }

        for (Iterator iter = lineList.iterator(); iter.hasNext();) {
            Line line = (Line) iter.next();

            if (line == currentLine) {
                currentColor = line.getColor();
            } else {
                g2d.setColor(line.getColor().darker());
                drawLine(g2d, line, false);
            }
        }

        if (currentColor != null) {
            g2d.setColor(currentColor);
            drawLine(g2d, currentLine, true);
        }

        if (selectedPoint != null) {
            float min = currentLine.getMin();
            float max = currentLine.getMax();

            int x = floatToScreenX(selectedPoint.getX());
            int y = floatToScreenY(selectedPoint.getY(), min, max);

            g2d.setColor(Color.red);
            paintPoint(g2d, x, y);

            if (currentLine != null) {
                drawPointInformation(g2d, x, y);
            }
        }
    }

    /**
     * @param g2d
     * @param x
     * @param y
     */
    private void drawPointInformation(Graphics2D g2d, int x, int y) {
        g2d.setColor(Color.white);

        float range = currentLine.getMax() - currentLine.getMin();
        float yVal = selectedPoint.getY();
        float xVal = selectedPoint.getX();

        String xText = "x: " + NumberUtilities.formatFloat(xVal);
        String yText = "y: " + NumberUtilities.formatFloat(yVal);

        // Rectangle2D xRect = g2d.getFontMetrics().getStringBounds(xText, g2d);
        // Rectangle2D yRect = g2d.getFontMetrics().getStringBounds(yText, g2d);

        // double wx = xRect.getWidth();
        // double wy = yRect.getWidth();

        // double w = wx > wy ? wx : wy;

        // int width = (int)Math.round(w);
        int width = 95;
        // int height = (int)(Math.round(xRect.getHeight() +
        // yRect.getHeight()));
        int height = 28;

        // System.out.println("width: " + width + " height: " + height);

        int xLoc = x + 5;
        int yLoc = y + 5;

        if (x + width > this.getWidth()) {
            xLoc = x - width - 5;
        }

        if (y + height > this.getHeight()) {
            yLoc = y - 14 - 5;
        }

        g2d.drawString(xText, xLoc, yLoc);
        g2d.drawString(yText, xLoc, yLoc + 14);
    }

    private final void drawLine(Graphics g, Line line, boolean drawPoints) {
        float min = line.getMin();
        float max = line.getMax();

        int[] xValues = new int[line.size()];
        int[] yValues = new int[line.size()];
        
        for (int i = 0; i < line.size(); i++) {
            LinePoint point = line.getLinePoint(i);

            xValues[i] = floatToScreenX(point.getX());
            yValues[i] = floatToScreenY(point.getY(), min, max);
        }

        g.drawPolyline(xValues, yValues, xValues.length);
        
        if (drawPoints) {
            for (int i = 0; i < xValues.length; i++) {
                paintPoint(g, xValues[i], yValues[i]);
            }
        }
    }

    private final void paintPoint(Graphics g, int x, int y) {
        g.fillRect(x - 2, y - 2, 5, 5);
    }

    private int floatToScreenX(float val) {
        int width = this.getWidth() - 10;
        return Math.round(val * width) + 5;
    }

    private int floatToScreenY(float yVal, float min, float max) {
        int height = this.getHeight() - 10;

        float range = max - min;

        float percent = (yVal - min) / range;

        int y = Math.round(height * (1.0f - percent)) + 5;

        return y;
    }

    private float screenToFloatX(int val) {
        float width = this.getWidth() - 10;
        return (val - 5) / width;
    }

    private float screenToFloatY(int val, float min, float max) {
        float height = this.getHeight() - 10;
        float percent = 1 - ((val - 5) / height);
        float range = max - min;

        return (percent * range) + min;
    }

    public void setBoundaryXValues() {
        if(selectedPoint == null) {
            return;
        }
        
        if (selectedPoint == currentLine.getLinePoint(0)) {
            leftBoundaryX = 5;
            rightBoundaryX = 5;
            return;
        } else if (selectedPoint == currentLine
                .getLinePoint(currentLine.size() - 1)) {
            leftBoundaryX = this.getWidth() - 5;
            rightBoundaryX = this.getWidth() - 5;
            return;
        }

        for (int i = 0; i < currentLine.size(); i++) {
            if (currentLine.getLinePoint(i) == selectedPoint) {
                LinePoint p1 = currentLine.getLinePoint(i - 1);
                LinePoint p2 = currentLine.getLinePoint(i + 1);
                leftBoundaryX = floatToScreenX(p1.getX());
                rightBoundaryX = floatToScreenX(p2.getX());
                return;
            }
        }

    }

    /**
     * Use by the MouseListener to add points
     * 
     * @param i
     * @param j
     * @return
     */
    protected LinePoint insertGraphPoint(int x, int y) {
        if(x < 5 || x > this.getWidth() - 5 || y < 5 || y > this.getHeight() - 5) {
            return null;
        }
        
        float min = currentLine.getMin();
        float max = currentLine.getMax();

        LinePoint point = new LinePoint();
        point.setLocation(screenToFloatX(x), screenToFloatY(y, min, max));

        int index = 1;

        for (int i = 0; i < currentLine.size() - 1; i++) {
            LinePoint p1 = currentLine.getLinePoint(i);
            LinePoint p2 = currentLine.getLinePoint(i + 1);

            if (point.getX() >= p1.getX() && point.getX() <= p2.getX()) {
                index = i + 1;
                break;
            }
        }

        currentLine.addLinePoint(index, point);

        return point;
    }

    public LinePoint findGraphPoint(int x, int y) {
        float min = currentLine.getMin();
        float max = currentLine.getMax();

        for (int i = 0; i < currentLine.size(); i++) {
            LinePoint point = currentLine.getLinePoint(i);

            int tempX = floatToScreenX(point.getX());
            int tempY = floatToScreenY(point.getY(), min, max);

            if (tempX >= x - 2 && tempX <= x + 2 && tempY >= y - 2
                    && tempY <= y + 2) {
                return point;
            }

        }

        return null;
    }

    public LinePoint findGraphPoint(int x) {
        for (int i = 0; i < currentLine.size(); i++) {
            LinePoint point = currentLine.getLinePoint(i);

            int tempX = floatToScreenX(point.getX());

            if (tempX >= x - 2 && tempX <= x + 2) {
                return point;
            }

        }

        return null;
    }

    class LineCanvasMouseListener implements MouseListener, MouseMotionListener {

        LineCanvas lineCanvas;

        public LineCanvasMouseListener(LineCanvas lineCanvas) {
            this.lineCanvas = lineCanvas;
            lineCanvas.addMouseListener(this);
            lineCanvas.addMouseMotionListener(this);
        }

        public void mouseClicked(MouseEvent e) {
        }

        public void mouseEntered(MouseEvent e) {
        }

        public void mouseExited(MouseEvent e) {
        }

        public void mousePressed(MouseEvent e) {
            if (currentLine == null) {
                return;
            }

            if (selectedLine != null) {

            } else if (selectedPoint != null) {
                if (UiUtilities.isRightMouseButton(e)
                        && !lineCanvas.isLocked()) {
                    LinePoint first = currentLine.getLinePoint(0);
                    LinePoint last = currentLine.getLinePoint(currentLine
                            .size() - 1);

                    if (selectedPoint != first && selectedPoint != last) {
                        currentLine.removeLinePoint(selectedPoint);
                        selectedPoint = null;
                    }
                } else {
                    setBoundaryXValues();
                }
            } else {
                if (SwingUtilities.isLeftMouseButton(e)) {
                    if (!lineCanvas.isLocked()) {
                        selectedPoint = insertGraphPoint(e.getX(), e.getY());
                        setBoundaryXValues();
                        // repaint();
                    }
                } else if (UiUtilities.isRightMouseButton(e)) {
                    if (popup == null) {
                        popup = new EditPointsPopup();
                    }
                    popup.setLine(currentLine);
                    popup.show((Component) e.getSource(), e.getX(), e.getY());
                }
            }

        }

        public void mouseReleased(MouseEvent e) {
            if (currentLine == null) {
                return;
            }
            repaint();

        }

        public void mouseDragged(MouseEvent e) {
            if (currentLine == null) {
                return;
            }
            if (selectedPoint != null) {

                int x = e.getX();
                int y = e.getY();

                int topY = 5;
                int bottomY = getHeight() - 5;

                if (x < leftBoundaryX) {
                    x = leftBoundaryX;
                } else if (x > rightBoundaryX) {
                    x = rightBoundaryX;
                }

                if (y < topY) {
                    y = topY;
                } else if (y > bottomY) {
                    y = bottomY;
                }

               
                float min = currentLine.getMin();
                float max = currentLine.getMax();

                float floatYValue = screenToFloatY(y, min, max);
                
                selectedPoint.setLocation(screenToFloatX(x),
                        floatYValue);
                
                if(currentLine.isEndPointsLinked()) {
                    LinePoint first = currentLine.getLinePoint(0);
                    LinePoint last = currentLine.getLinePoint(currentLine.getRowCount() - 1);
                    if(selectedPoint == first) {
                        last.setLocation(last.getX(), floatYValue);
                    } else if (selectedPoint == last) {
                        first.setLocation(first.getX(), floatYValue);
                    }
                }
                
                repaint();

            } else if (selectedLine != null) {

            }
        }

        public void mouseMoved(MouseEvent e) {
            if (currentLine == null) {
                return;
            }

            int x = e.getX();
            int y = e.getY();

            LinePoint foundPoint = findGraphPoint(x, y);

            if (foundPoint != null) {
                if (selectedPoint != foundPoint) {
                    selectedPoint = foundPoint;
                    repaint();
                }
            } else if (selectedPoint != null) {
                selectedPoint = null;
                repaint();
            }
        }

    }

    public boolean isLocked() {
        return locked;
    }

    /**
     * Sets if the line is locked so it points can be added or removed; existing
     * points are still editable
     * 
     * @return
     */
    public void setLocked(boolean locked) {
        this.locked = locked;
    }

    class EditPointsPopup extends JPopupMenu {
        Line line = null;

        public EditPointsPopup() {
            this.add(new AbstractAction("Edit Points") {

                public void actionPerformed(ActionEvent e) {
                    LineEditorDialog dialog = LineEditorDialog
                            .getInstance(getInvoker());

                    dialog.setLine(line);
                    dialog.ask();
                }

            });
        }

        public void setLine(Line line) {
            this.line = line;
        }

        public void show(Component invoker, int x, int y) {
            if (this.line != null) {
                super.show(invoker, x, y);
            }
        }

    }

    @Override
    public void addNotify() {
        super.addNotify();
        if (currentLine != null) {
            currentLine.addTableModelListener(lineListener);
        }
    }

    @Override
    public void removeNotify() {
        super.removeNotify();

        if (currentLine != null) {
            currentLine.removeTableModelListener(lineListener);
        }
    }
}