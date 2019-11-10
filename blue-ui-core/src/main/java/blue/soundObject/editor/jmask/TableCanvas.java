/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2008 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.editor.jmask;

import blue.soundObject.jmask.Table;
import blue.soundObject.jmask.TablePoint;
import blue.ui.utilities.UiUtilities;
import blue.utility.NumberUtilities;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.Stroke;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import javax.swing.JComponent;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;

/**
 *
 * @author syi
 */
public class TableCanvas extends JComponent {

    private static final Stroke STROKE1 = new BasicStroke(1);

    private static final Stroke STROKE2 = new BasicStroke(2);

    private static EditPointsPopup popup = null;
    Table table = null;
    TablePoint selectedPoint = null;
    int leftBoundaryX = -1, rightBoundaryX = -1;
    boolean locked = false;
    TableModelListener lineListener = null;

    double duration = 1.0;

    public TableCanvas() {
        lineListener = (TableModelEvent e) -> {
            repaint();
        };

        new TableCanvasMouseListener(this);
    }

    public void setTable(Table table) {
        if (this.table != null) {
            this.table.removeTableModelListener(lineListener);
        }

        this.table = table;

        if (this.table != null) {
            this.table.addTableModelListener(lineListener);
        }

        repaint();
    }

    public void setDuration(double duration) {
        this.duration = duration;
    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        Graphics2D g2d = (Graphics2D) g;
        g2d.setStroke(STROKE2);

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

        if (table == null) {
            return;
        }

        g2d.setColor(Color.GREEN);
        drawTable(g2d, table, true);

        if (selectedPoint != null) {
            double min = table.getMin();
            double max = table.getMax();

            int x = doubleToScreenX(selectedPoint.getTime());
            int y = doubleToScreenY(selectedPoint.getValue(), min, max);

            g2d.setColor(Color.red);
            paintPoint(g2d, x, y);

            if (table != null) {
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

        double range = table.getMax() - table.getMin();
        double yVal = selectedPoint.getValue();
        double xVal = selectedPoint.getTime();

        String xText = "x: " + NumberUtilities.formatDouble(xVal * duration);
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

    @SuppressWarnings("fallthrough")
    private final void drawTable(Graphics g, Table table, boolean drawPoints) {

        double min = table.getMin();
        double max = table.getMax();

        int[] xValues = new int[table.getRowCount()];
        int[] yValues = new int[table.getRowCount()];

        for (int i = 0; i < table.getRowCount(); i++) {
            TablePoint point = table.getTablePoint(i);

            xValues[i] = doubleToScreenX(point.getTime());
            yValues[i] = doubleToScreenY(point.getValue(), min, max);
        }

        switch (table.getInterpolationType()) {
            case Table.OFF:
                for (int i = 0; i < xValues.length - 1; i++) {
                    g.drawLine(xValues[i], yValues[i], xValues[i + 1], yValues[i]);
                    g.drawLine(xValues[i + 1], yValues[i], xValues[i + 1], yValues[i + 1]);
                }
                break;
            case Table.ON:
                if (table.getInterpolation() == 0.0) {
                    g.drawPolyline(xValues, yValues, xValues.length);
                    break;
                }
            //else let fall through
            default:
                int tableLen = this.getWidth() - 10;
                int[] tempTable = new int[tableLen];
                int[] xvals = new int[tableLen];
                int tableHeight = this.getHeight() - 10;

                double range = max - min;

                for (int i = 0; i < tableLen; i++) {
                    xvals[i] = i + 5;
                    double time = i / (double) tableLen;
                    double val = table.getValue(time);
                    double percent = (val - min) / range;
                    int y = (int) (tableHeight - (percent * tableHeight));
                    tempTable[i] = y + 5;
                }

                g.drawPolyline(xvals, tempTable, tableLen);
        }

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

    private int doubleToScreenX(double val) {
        int width = this.getWidth() - 10;
        return (int) Math.round(val * width) + 5;
    }

    private int doubleToScreenY(double yVal, double min, double max) {
        int height = this.getHeight() - 10;

        double range = max - min;

        double percent = (yVal - min) / range;

        int y = (int) Math.round(height * (1.0 - percent)) + 5;

        return y;
    }

    private double screenToDoubleX(int val) {
        double width = this.getWidth() - 10;
        return (val - 5) / width;
    }

    private double screenToDoubleY(int val, double min, double max) {
        double height = this.getHeight() - 10;
        double percent = 1 - ((val - 5) / height);
        double range = max - min;

        return (percent * range) + min;
    }

    public void setBoundaryXValues() {
        if (selectedPoint == null) {
            return;
        }

        if (selectedPoint == table.getTablePoint(0)) {
            leftBoundaryX = 5;
            rightBoundaryX = 5;
            return;
        } else if (selectedPoint == table.getTablePoint(table.getRowCount() - 1)) {
            leftBoundaryX = this.getWidth() - 5;
            rightBoundaryX = this.getWidth() - 5;
            return;
        }

        for (int i = 0; i < table.getRowCount(); i++) {
            if (table.getTablePoint(i) == selectedPoint) {
                TablePoint p1 = table.getTablePoint(i - 1);
                TablePoint p2 = table.getTablePoint(i + 1);
                leftBoundaryX = doubleToScreenX(p1.getTime());
                rightBoundaryX = doubleToScreenX(p2.getTime());
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
    protected TablePoint insertGraphPoint(int x, int y) {
        if (x < 5 || x > this.getWidth() - 5 || y < 5 || y > this.getHeight() - 5) {
            return null;
        }

        double min = table.getMin();
        double max = table.getMax();

        TablePoint point = new TablePoint();
        point.setLocation(screenToDoubleX(x), screenToDoubleY(y, min, max));

        int index = 1;

        for (int i = 0; i < table.getRowCount() - 1; i++) {
            TablePoint p1 = table.getTablePoint(i);
            TablePoint p2 = table.getTablePoint(i + 1);

            if (point.getTime() >= p1.getTime() && point.getTime() <= p2.getTime()) {
                index = i + 1;
                break;
            }
        }

        table.addPoint(index, point);

        return point;
    }

    public TablePoint findGraphPoint(int x, int y) {
        double min = table.getMin();
        double max = table.getMax();

        for (int i = 0; i < table.getRowCount(); i++) {
            TablePoint point = table.getTablePoint(i);

            int tempX = doubleToScreenX(point.getTime());
            int tempY = doubleToScreenY(point.getValue(), min, max);

            if (tempX >= x - 2 && tempX <= x + 2 && tempY >= y - 2 && tempY <= y + 2) {
                return point;
            }

        }

        return null;
    }

    public TablePoint findGraphPoint(int x) {
        for (int i = 0; i < table.getRowCount(); i++) {
            TablePoint point = table.getTablePoint(i);

            int tempX = doubleToScreenX(point.getTime());

            if (tempX >= x - 2 && tempX <= x + 2) {
                return point;
            }

        }

        return null;
    }

    class TableCanvasMouseListener implements MouseListener, MouseMotionListener {

        TableCanvas tableCanvas;

        public TableCanvasMouseListener(TableCanvas tableEditor) {
            this.tableCanvas = tableEditor;
            tableEditor.addMouseListener(this);
            tableEditor.addMouseMotionListener(this);
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
            if (table == null) {
                return;
            }

            if (selectedPoint != null) {
                if (UiUtilities.isRightMouseButton(e)) {
                    TablePoint first = table.getTablePoint(0);
                    TablePoint last = table.getTablePoint(table.getRowCount() - 1);

                    if (selectedPoint != first && selectedPoint != last) {
                        table.removePoint(selectedPoint);
                        selectedPoint = null;
                    }
                } else {
                    setBoundaryXValues();
                }
            } else {
                if (SwingUtilities.isLeftMouseButton(e)) {

                    selectedPoint = insertGraphPoint(e.getX(), e.getY());
                    setBoundaryXValues();
                    // repaint();

                } else if (UiUtilities.isRightMouseButton(e)) {
//                    if (popup == null) {
//                        popup = new EditPointsPopup();
//                    }
//                    popup.setLine(table);
//                    popup.show((Component) e.getSource(), e.getX(), e.getY());
                }
            }

        }

        @Override
        public void mouseReleased(MouseEvent e) {
            if (table == null) {
                return;
            }
            repaint();

        }

        @Override
        public void mouseDragged(MouseEvent e) {
            if (table == null) {
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

                double min = table.getMin();
                double max = table.getMax();

                double floatYValue = screenToDoubleY(y, min, max);

                selectedPoint.setLocation(screenToDoubleX(x),
                        floatYValue);

//                if (table.isEndPointsLinked()) {
//                    TablePoint first = table.getTablePoint(0);
//                    TablePoint last = table.getTablePoint(table.getRowCount() - 1);
//                    if (selectedPoint == first) {
//                        last.setLocation(last.getX(), floatYValue);
//                    } else if (selectedPoint == last) {
//                        first.setLocation(first.getX(), floatYValue);
//                    }
//                }
                repaint();

            }
        }

        @Override
        public void mouseMoved(MouseEvent e) {
            if (table == null) {
                return;
            }

            int x = e.getX();
            int y = e.getY();

            TablePoint foundPoint = findGraphPoint(x, y);

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

        Table table = null;

        public EditPointsPopup() {
//            this.add(new AbstractAction("Edit Points") {
//
//                public void actionPerformed(ActionEvent e) {
//                    LineEditorDialog dialog = LineEditorDialog.getInstance(getInvoker());
//
//                    dialog.setLine(line);
//                    dialog.ask();
//                }
//            });
        }

        public void setTable(Table table) {
            this.table = table;
        }

        @Override
        public void show(Component invoker, int x, int y) {
            if (this.table != null) {
                super.show(invoker, x, y);
            }
        }
    }

    @Override
    public void addNotify() {
        super.addNotify();

        if (table != null) {
            table.addTableModelListener(lineListener);
        }
    }

    @Override
    public void removeNotify() {
        super.removeNotify();

        if (table != null) {
            table.removeTableModelListener(lineListener);
        }
    }
}
