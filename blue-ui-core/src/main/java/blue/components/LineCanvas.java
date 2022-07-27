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
 */
package blue.components;

import blue.components.lines.Line;
import blue.components.lines.LineEditorDialog;
import blue.components.lines.LineList;
import blue.components.lines.LinePoint;
import blue.ui.utilities.UiUtilities;
import blue.utilities.scales.ScaleLinear;
import blue.utility.NumberUtilities;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Insets;
import java.awt.Point;
import java.awt.RenderingHints;
import java.awt.Stroke;
import java.awt.event.ActionEvent;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import javax.swing.AbstractAction;
import javax.swing.JComponent;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;

/**
 * @author steven
 */
public class LineCanvas extends JComponent implements TableModelListener {

    private static final Stroke STROKE1 = new BasicStroke(1);

    private static final Stroke STROKE2 = new BasicStroke(2);

    private static EditPointsPopup popup = null;

    LineList lineList = null;

    Line currentLine = null;

    LinePoint selectedPoint = null;

    Line selectedLine = null;

    int leftBoundaryX = -1, rightBoundaryX = -1;

    boolean locked = false;

    TableModelListener lineListener = null;

    
    /** Used to map from data coordinates to other coordinates for viewing 
     (see Sound SoundObject editor) */
    ScaleLinear dataProjectionX;
    
    /** Used to map from screen coordinates (domain) to data x coordinates (range) */
    ScaleLinear screenToDataScaleX;
    /** Used to map from screen coordinates (domain) to data y coordinates (range)*/
    ScaleLinear screenToDataScaleY;

    public LineCanvas() {
        new LineCanvasMouseListener(this);

        Insets insets = getInsets();

        screenToDataScaleX = new ScaleLinear(insets.left, getWidth() - insets.right, 0, 1.0);
        screenToDataScaleY = new ScaleLinear(getHeight() - insets.bottom, insets.top, 0, 1.0);
        dataProjectionX = new ScaleLinear(0, 1, 0, 1);
        dataProjectionX.setClamped(false);
        

        this.addComponentListener(new ComponentAdapter() {
            @Override
            public void componentResized(ComponentEvent e) {
                Insets insets = getInsets();

                screenToDataScaleX.setDomain(insets.left, getWidth() - insets.right);
                screenToDataScaleY.setDomain(getHeight() - insets.bottom, insets.top);
            }
        });

        lineListener = (TableModelEvent e) -> {
            repaint();
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
    @Override
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

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        Insets insets = getInsets();

        Graphics2D g2d = (Graphics2D) g;
        g2d.setStroke(STROKE2);

        RenderingHints hints = new RenderingHints(
                RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHints(hints);

        g2d.setColor(Color.black);
        g2d.fillRect(0, 0, this.getWidth(), this.getHeight());

        g2d.setClip(insets.left, insets.top, getWidth() - insets.right - insets.left, getHeight() - insets.bottom - insets.top);
        //g2d.translate(insets.left, insets.top);

        // g.setColor(bgColor);
//        g2d.setColor(Color.lightGray);
//        g2d.drawRect(0, 0, this.getWidth(), this.getHeight());
        Color currentColor = null;

        if (lineList == null) {
            return;
        }

        for (Line line : lineList) {
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
            double min = currentLine.getMin();
            double max = currentLine.getMax();

            int x = (int)screenToDataScaleX.calcReverse(selectedPoint.getX());
            screenToDataScaleY.setRange(min, max);
            int y = (int)screenToDataScaleY.calcReverse(selectedPoint.getY());

            g2d.setColor(Color.red);
            paintPoint(g2d, x, y);

            if (currentLine != null) {
                drawPointInformation(g2d, x, y);
            }
        }
        g2d.setClip(null);
    }

    /**
     * @param g2d
     * @param x
     * @param y
     */
    private void drawPointInformation(Graphics2D g2d, int x, int y) {
        g2d.setColor(Color.white);

        double range = currentLine.getMax() - currentLine.getMin();
        double yVal = selectedPoint.getY();
        double xVal = selectedPoint.getX();

        String xText = "x: " + NumberUtilities.formatDouble(dataProjectionX.calc(xVal));
        String yText = "y: " + NumberUtilities.formatDouble(yVal);

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
        int xLoc = x;
        int yLoc = y;

        if (x + width > this.getWidth()) {
            xLoc = x - width;
        }

        if (y + height > this.getHeight()) {
            yLoc = y - 14;
        }

        g2d.drawString(xText, xLoc, yLoc);
        g2d.drawString(yText, xLoc, yLoc + 14);
    }

    private final void drawLine(Graphics g, Line line, boolean drawPoints) {
        double min = line.getMin();
        double max = line.getMax();

        int[] xValues = new int[line.size()];
        int[] yValues = new int[line.size()];

        for (int i = 0; i < line.size(); i++) {
            LinePoint point = line.getLinePoint(i);

            xValues[i] = (int)screenToDataScaleX.calcReverse(point.getX());
            screenToDataScaleY.setRange(min, max);
            yValues[i] = (int)screenToDataScaleY.calcReverse(point.getY());
        }

        g.drawPolyline(xValues, yValues, xValues.length);

        if (drawPoints) {
            for (int i = 0; i < xValues.length; i++) {
                paintPoint(g, xValues[i], yValues[i]);
            }
        }
    }

    private final void paintPoint(Graphics g, int x, int y) {
        Graphics2D g2d = (Graphics2D) g;

        Color c = g.getColor();
        Stroke s = g2d.getStroke();

        g2d.setStroke(STROKE1);
        g.setColor(Color.BLACK);
        g.fillOval(x - 3, y - 3, 7, 7);
        g.setColor(c);
        g.drawOval(x - 3, y - 3, 7, 7);
    }

    public void setBoundaryXValues() {
        if (selectedPoint == null) {
            return;
        }

        var insets = getInsets();
        
        if (selectedPoint == currentLine.getLinePoint(0)) {
            leftBoundaryX = insets.left;
            rightBoundaryX = insets.left;
            return;
        } else if (selectedPoint == currentLine
                .getLinePoint(currentLine.size() - 1)) {
            leftBoundaryX = this.getWidth() - insets.right;
            rightBoundaryX = this.getWidth() - insets.right;
            return;
        }

        for (int i = 0; i < currentLine.size(); i++) {
            if (currentLine.getLinePoint(i) == selectedPoint) {
                LinePoint p1 = currentLine.getLinePoint(i - 1);
                LinePoint p2 = currentLine.getLinePoint(i + 1);
                leftBoundaryX = (int)(screenToDataScaleX.calcReverse(p1.getX()));
                rightBoundaryX = (int)(screenToDataScaleX.calcReverse(p2.getX()));
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
        if (x < 0 || x >= this.getWidth() || y < 0 || y >= this.getHeight()) {
            return null;
        }

        double min = currentLine.getMin();
        double max = currentLine.getMax();

        LinePoint point = new LinePoint();
        screenToDataScaleY.setRange(min, max);
        point.setLocation(screenToDataScaleX.calc(x), screenToDataScaleY.calc(y));

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
        double min = currentLine.getMin();
        double max = currentLine.getMax();

        for (int i = 0; i < currentLine.size(); i++) {
            LinePoint point = currentLine.getLinePoint(i);

            int tempX = (int)screenToDataScaleX.calcReverse(point.getX());
            screenToDataScaleY.setRange(min, max);
            int tempY = (int)screenToDataScaleY.calcReverse(point.getY());

            if (tempX >= x - 3 && tempX <= x + 3 && tempY >= y - 3
                    && tempY <= y + 3) {
                return point;
            }

        }

        return null;
    }

    public LinePoint findGraphPoint(int x) {
        for (int i = 0; i < currentLine.size(); i++) {
            LinePoint point = currentLine.getLinePoint(i);

            int tempX = (int)screenToDataScaleX.calcReverse(point.getX());

            if (tempX >= x - 3 && tempX <= x + 3) {
                return point;
            }

        }

        return null;
    }

    class LineCanvasMouseListener implements MouseListener, MouseMotionListener {

        LineCanvas lineCanvas;
        DragDirection direction = DragDirection.NOT_SET;
        Point pressPoint = null;

        public LineCanvasMouseListener(LineCanvas lineCanvas) {
            this.lineCanvas = lineCanvas;
            lineCanvas.addMouseListener(this);
            lineCanvas.addMouseMotionListener(this);
        }

        @Override
        public void mouseClicked(MouseEvent e) {
        }

        @Override
        public void mouseEntered(MouseEvent e) {
        }

        @Override
        public void mouseExited(MouseEvent e) {
        }

        @Override
        public void mousePressed(MouseEvent e) {
            if (currentLine == null) {
                return;
            }
            pressPoint = e.getPoint();

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

                        int x = e.getX();
                        int y = e.getY();

                        // INSERTING NEW LINE POINT
                        if ((e.getModifiersEx() & MouseEvent.ALT_DOWN_MASK) == MouseEvent.ALT_DOWN_MASK) {
                            // ...ON THE EXISTING LINE 
                            final var time = screenToDataScaleX.calc(x);
                            final var val = currentLine.getValue(time);
                            screenToDataScaleY.setRange(currentLine.getMin(), currentLine.getMax());
                            y = (int)screenToDataScaleY.calcReverse(val);
                        }

                        selectedPoint = insertGraphPoint(x, y);
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

        @Override
        public void mouseReleased(MouseEvent e) {
            direction = DragDirection.NOT_SET;
            if (currentLine == null) {
                return;
            }
            repaint();

        }

        @Override
        public void mouseDragged(MouseEvent e) {
            if (currentLine == null) {
                return;
            }
            if (selectedPoint != null) {

                int x = e.getX();
                int y = e.getY();

                if (direction == DragDirection.NOT_SET) {
                    int magx = Math.abs(x - (int) pressPoint.getX());
                    int magy = Math.abs(y - (int) pressPoint.getY());

                    direction = (magx > magy) ? DragDirection.LEFT_RIGHT
                            : DragDirection.UP_DOWN;
                }

                if (e.isControlDown()) {
                    if (direction == DragDirection.LEFT_RIGHT) {
                        y = (int) pressPoint.getY();
                    } else {
                        x = (int) pressPoint.getX();
                    }
                }

                int topY = 0;
                int bottomY = getHeight();

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

                double min = currentLine.getMin();
                double max = currentLine.getMax();

                screenToDataScaleY.setRange(min, max);
                double doubleYValue = screenToDataScaleY.calc(y);

                selectedPoint.setLocation(screenToDataScaleX.calc(x),
                        doubleYValue);

                if (currentLine.isEndPointsLinked()) {
                    LinePoint first = currentLine.getLinePoint(0);
                    LinePoint last = currentLine.getLinePoint(currentLine.getRowCount() - 1);
                    if (selectedPoint == first) {
                        last.setLocation(last.getX(), doubleYValue);
                    } else if (selectedPoint == last) {
                        first.setLocation(first.getX(), doubleYValue);
                    }
                }

                repaint();

            } else if (selectedLine != null) {

            }
        }

        @Override
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

                @Override
                public void actionPerformed(ActionEvent e) {
                    LineEditorDialog dialog = LineEditorDialog
                            .getInstance(getInvoker());

                    dialog.setLine(line);
                    dialog.ask();
                }

            });
            
            this.add(new AbstractAction("Reset Line") {
            @Override
            public void actionPerformed(ActionEvent e) {
                if (line != null) {
                    
//                    var sourceCopy = new Line(line);
                    
                    var linePoints = line.getObservableList();
                    linePoints.clear();
                    linePoints.add(new LinePoint(0, 0.5));
                    if (line.isRightBound()) {
                        linePoints.add(new LinePoint(1.0, 0.5));
                    }
                    LineCanvas.this.repaint();
//                    var endCopy = new Line(line);
//                    var edit = new LineChangeEdit(line, sourceCopy, endCopy);
//                    BlueUndoManager.addEdit("score", edit);
                }
            }
            });

        }

        public void setLine(Line line) {
            this.line = line;
        }

        @Override
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
    
    
    /** Add offset and scaling for viewing of X data */
    public void setDataProjectionX(double rangeStart, double rangeEnd) {
        dataProjectionX.setRange(rangeStart, rangeEnd);
    }
}
