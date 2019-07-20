/*
 * To change this template, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.ui.core.score.tempo;

import blue.components.DragDirection;
import blue.components.lines.Line;
import blue.components.lines.LineEditorDialog;
import blue.components.lines.LinePoint;
import blue.score.TimeState;
import blue.score.tempo.Tempo;
import blue.ui.core.score.ModeManager;
import blue.ui.utilities.UiUtilities;
import blue.utility.GUI;
import blue.utility.NumberUtilities;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.Frame;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.Stroke;
import java.awt.event.ActionEvent;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JComponent;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;

/**
 *
 * @author syi
 */
public class TempoEditor extends JComponent implements PropertyChangeListener {

    private static final Stroke STROKE1 = new BasicStroke(1);

    private static final Stroke STROKE2 = new BasicStroke(2);

    EditPointsPopup popup;
    TempoMinMaxDialog tempoMinMaxDialog;

    TableModelListener lineListener;
    Tempo tempo = null;
    private TimeState timeState;

    LinePoint selectedPoint = null;

    int leftBoundaryX = -1, rightBoundaryX = -1;

    public TempoEditor() {
        lineListener = (TableModelEvent e) -> {
            repaint();
        };

        TempoEditorMouseListener tempoEditorMouseListener
                = new TempoEditorMouseListener(this);

        this.addMouseListener(tempoEditorMouseListener);
        this.addMouseMotionListener(tempoEditorMouseListener);
    }

    public void setTempo(Tempo tempo) {
        if (this.tempo != null) {
            this.tempo.getLine().removeTableModelListener(lineListener);
            this.tempo.removePropertyChangeListener(this);
        }

        this.tempo = tempo;
        this.tempo.getLine().addTableModelListener(lineListener);
        this.tempo.addPropertyChangeListener(this);
        this.setTempoVisible(tempo.isVisible());
    }

    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
        //FIXME - setVisible should be called by container class and in context
        //setVisible(this.timeState.isRoot());
    }

    public void setTempoVisible(boolean tempoVisible) {
        if (tempoVisible) {
            this.setPreferredSize(new Dimension(1, 100));
            this.setSize(this.getWidth(), 100);
        } else {
            this.setPreferredSize(new Dimension(1, 20));
            this.setSize(this.getWidth(), 20);
        }
    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        if (this.tempo == null) {
            return;
        }

        Graphics2D g2d = (Graphics2D) g;
        g2d.setStroke(STROKE2);

        RenderingHints hints = new RenderingHints(
                RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHints(hints);

        Color currentColor = null;

        ModeManager modeManager = ModeManager.getInstance();

        Line tempoLine = this.tempo.getLine();
        boolean enabled = this.tempo.isEnabled();

        if (enabled) {
            if (tempo.isVisible()) {
                g2d.setColor(Color.GREEN);
            } else {
                g2d.setColor(Color.GREEN.darker().darker());
            }
            drawLine(g2d, tempoLine, this.tempo.isVisible());
        } else {
            g2d.setColor(Color.DARK_GRAY);
            drawLine(g2d, tempoLine, false);
            g2d.setColor(Color.WHITE);
            g2d.drawLine(0, getHeight() - 1, getWidth(), getHeight() - 1);
            return;
        }

        if (enabled && selectedPoint != null) {
            double min = tempoLine.getMin();
            double max = tempoLine.getMax();

            int x = doubleToScreenX(selectedPoint.getX());
            int y = doubleToScreenY(selectedPoint.getY(), min, max);

            g2d.setColor(Color.red);
            paintPoint(g2d, x, y);

            drawPointInformation(g2d, x, y);

        }

        g2d.setColor(Color.WHITE);
        g2d.drawLine(0, getHeight() - 1, getWidth(), getHeight() - 1);
    }

    /**
     * @param g2d
     * @param x
     * @param y
     */
    private void drawPointInformation(Graphics2D g2d, int x, int y) {
        g2d.setColor(Color.white);

        // Line currentLine = currentParameter.getLine();
        double yVal = selectedPoint.getY();
        double xVal = selectedPoint.getX();

        String xText = "x: " + NumberUtilities.formatDouble(xVal);
        String yText = "y: " + NumberUtilities.formatDouble(yVal) + " bpm";

        int width = 95;
        int height = 28;

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
        Rectangle clipBounds = g.getClipBounds();

        if (line.size() == 0) {
            return;
        }

        if (line.size() == 1) {
            LinePoint lp = line.getLinePoint(0);

            double min = line.getMin();
            double max = line.getMax();

            int x = doubleToScreenX(lp.getX());
            int y = doubleToScreenY(lp.getY(), min, max);

            g.drawLine(0, y, getWidth(), y);

            if (drawPoints) {
                paintPoint(g, x, y);
            }
            return;
        }

        int prevX = -1;
        int prevY = -1;
        int x, y;

        double min = line.getMin();
        double max = line.getMax();

        int[] xValues = new int[line.size()];
        int[] yValues = new int[line.size()];

        for (int i = 0; i < line.size(); i++) {
            LinePoint point = line.getLinePoint(i);

            x = doubleToScreenX(point.getX());
            y = doubleToScreenY(point.getY(), min, max);
            xValues[i] = x;
            yValues[i] = y;

            if (prevX != -1) {

                if ((prevX <= (clipBounds.x + clipBounds.width))
                        && (x >= clipBounds.x)) {
                    g.drawLine(prevX, prevY, x, y);
                }
            }

            prevX = x;
            prevY = y;
        }

        if (prevX < this.getWidth()) {
            g.drawLine(prevX, prevY, getWidth(), prevY);
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

        g2d.setStroke(s);
    }

    private int doubleToScreenX(double val) {
        if (timeState == null) {
            return -1;
        }
        return (int) Math.round(val * timeState.getPixelSecond());
    }

    private int doubleToScreenY(double yVal, double min, double max) {
        return doubleToScreenY(yVal, min, max, -1.0f);
    }

    private int doubleToScreenY(double yVal, double min, double max,
            double resolution) {
        int height = this.getHeight() - 10;

        double range = max - min;

        double adjustedY = yVal - min;

        if (resolution > 0.0f) {

            double tempY = 0.0f;

            while (tempY <= adjustedY) {
                tempY += resolution;
            }

            tempY -= resolution;

            // adjustedY = (double) (adjustedY - Math.IEEEremainder(adjustedY,
            // resolution));
            adjustedY = (tempY > range) ? range : tempY;

        }

        double percent = adjustedY / range;

        int y = (int) Math.round(height * (1.0f - percent)) + 5;

        return y;
    }

    private double screenToDoubleX(int val) {
        if (timeState == null) {
            return -1;
        }

        return (double) val / timeState.getPixelSecond();
    }

    private double screenToDoubleY(int val, double min, double max, double resolution) {
        double height = this.getHeight() - 10;
        double percent = 1 - ((val - 5) / height);
        double range = max - min;

        double value = percent * range;

        if (resolution > 0.0f) {
            value = (double) (value - Math.IEEEremainder(value, resolution));
        }

        if (value > range) {
            value = range;
        }

        if (value < 0) {
            value = 0;
        }

        return value + min;
    }

    public void setBoundaryXValues() {

        Line currentLine = tempo.getLine();

        if (selectedPoint == currentLine.getLinePoint(0)) {
            leftBoundaryX = 0;
            rightBoundaryX = 0;
            return;
        } else if (selectedPoint == currentLine
                .getLinePoint(currentLine.size() - 1)) {
            LinePoint p1 = currentLine.getLinePoint(currentLine.size() - 2);

            leftBoundaryX = doubleToScreenX(p1.getX());
            rightBoundaryX = this.getWidth();
            return;
        }

        for (int i = 0; i < currentLine.size(); i++) {
            if (currentLine.getLinePoint(i) == selectedPoint) {
                LinePoint p1 = currentLine.getLinePoint(i - 1);
                LinePoint p2 = currentLine.getLinePoint(i + 1);
                leftBoundaryX = doubleToScreenX(p1.getX());
                rightBoundaryX = doubleToScreenX(p2.getX());
                return;
            }
        }

    }

    /**
     * Use by the MouseListener to add points
     *
     * @param x
     * @param y
     * @return
     */
    protected LinePoint insertGraphPoint(int x, int y) {
        LinePoint point = new LinePoint();

        Line currentLine = tempo.getLine();

        double min = currentLine.getMin();
        double max = currentLine.getMax();

        point.setLocation(screenToDoubleX(x), screenToDoubleY(y, min, max,
                -1));

        int index = 1;

        LinePoint last = currentLine.getLinePoint(currentLine.size() - 1);

        if (point.getX() > last.getX()) {
            currentLine.addLinePoint(point);
            return point;
        }

        for (int i = 0; i < currentLine.size(); i++) {
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
        Line currentLine = tempo.getLine();

        double min = currentLine.getMin();
        double max = currentLine.getMax();

        for (int i = 0; i < currentLine.size(); i++) {
            LinePoint point = currentLine.getLinePoint(i);

            int tempX = doubleToScreenX(point.getX());
            int tempY = doubleToScreenY(point.getY(), min, max);

            if (tempX >= x - 2 && tempX <= x + 2 && tempY >= y - 2
                    && tempY <= y + 2) {
                return point;
            }

        }

        return null;
    }

    public LinePoint findGraphPoint(int x) {
        Line currentLine = tempo.getLine();

        for (int i = 0; i < currentLine.size(); i++) {
            LinePoint point = currentLine.getLinePoint(i);

            int tempX = doubleToScreenX(point.getX());

            if (tempX >= x - 2 && tempX <= x + 2) {
                return point;
            }

        }

        return null;
    }

    public class TempoEditorMouseListener implements MouseListener, MouseMotionListener {

        TempoEditor tempoEditor;
        DragDirection direction = DragDirection.NOT_SET;
        Point pressPoint = null;

        public TempoEditorMouseListener(TempoEditor tempoEditor) {
            this.tempoEditor = tempoEditor;
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
            if (tempo == null || !tempo.isEnabled() || !tempo.isVisible()) {
                return;
            }

            pressPoint = e.getPoint();

            if (selectedPoint != null) {
                if (UiUtilities.isRightMouseButton(e)) {
                    LinePoint first = tempo.getLine().getLinePoint(0);

                    if (selectedPoint != first) {
                        tempo.getLine().removeLinePoint(selectedPoint);
                        selectedPoint = null;
                    }
                } else {
                    setBoundaryXValues();
                }
            } else {
                if (SwingUtilities.isLeftMouseButton(e)) {

                    int start = e.getX();

                    if (timeState.isSnapEnabled() && !e.isShiftDown()) {
                        int snapPixels = (int) (timeState.getSnapValue() * timeState.getPixelSecond());
                        int fraction = start % snapPixels;

                        start = start - fraction;

                        if (fraction > snapPixels / 2) {
                            start += snapPixels;
                        }
                    }

                    selectedPoint = insertGraphPoint(start, e.getY());
                    setBoundaryXValues();
                } else if (UiUtilities.isRightMouseButton(e)) {
                    if (popup == null) {
                        popup = new EditPointsPopup();
                    }
                    popup.show((Component) e.getSource(), e.getX(), e.getY());
                }
            }

        }

        @Override
        public void mouseReleased(MouseEvent e) {
            direction = DragDirection.NOT_SET;
            if (tempo == null || !tempo.isEnabled() || !tempo.isVisible()) {
                return;
            }

            repaint();

        }

        @Override
        public void mouseDragged(MouseEvent e) {
            if (tempo == null || !tempo.isEnabled() || !tempo.isVisible()) {
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

                if (timeState.isSnapEnabled() && !e.isShiftDown()) {
                    int snapPixels = (int) (timeState.getSnapValue() * timeState.getPixelSecond());
                    int fraction = x % snapPixels;

                    x = x - fraction;

                    if (fraction > snapPixels / 2) {
                        x += snapPixels;
                    }
                }

                double min = tempo.getLine().getMin();
                double max = tempo.getLine().getMax();

                if (selectedPoint != null) {
                    selectedPoint.setLocation(screenToDoubleX(x),
                            screenToDoubleY(y, min, max, -1));
                    repaint();
                }
            }
        }

        @Override
        public void mouseMoved(MouseEvent e) {
            if (tempo == null || !tempo.isEnabled() || !tempo.isVisible()) {
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

    @Override
    public void propertyChange(PropertyChangeEvent evt) {
        String prop = evt.getPropertyName();
        switch (prop) {
            case "enabled":
                repaint();
                break;
            case "visible":
                this.setTempoVisible(((Boolean) evt.getNewValue()).booleanValue());
                break;
        }
    }

    class EditPointsPopup extends JPopupMenu {

        Action editPointsAction;
        Action editBoundariesAction;

        public EditPointsPopup() {

            editPointsAction = new AbstractAction("Edit Points") {

                @Override
                public void actionPerformed(ActionEvent e) {
                    if (tempo != null) {
                        Component root = SwingUtilities.getRoot(getInvoker());

                        LineEditorDialog dialog = LineEditorDialog
                                .getInstance(root);

                        dialog.setLine(tempo.getLine());
                        dialog.ask();
                    }
                }

            };

            editBoundariesAction = new AbstractAction("Edit Min/Max") {
                @Override
                public void actionPerformed(ActionEvent e) {
                    if (tempo != null) {
                        if (tempoMinMaxDialog == null) {
                            Component root = SwingUtilities.getRoot(getInvoker());
                            tempoMinMaxDialog = new TempoMinMaxDialog((Frame) root, true);
                            GUI.centerOnScreen(tempoMinMaxDialog);
                        }
                        Line line = tempo.getLine();
                        tempoMinMaxDialog.setValues(line.getMin(), line.getMax());
                        tempoMinMaxDialog.setVisible(true);

                        if (tempoMinMaxDialog.getReturnStatus() == TempoMinMaxDialog.RET_OK) {
                            double min = tempoMinMaxDialog.getMin();
                            double max = tempoMinMaxDialog.getMax();
                            boolean truncate = tempoMinMaxDialog.isTruncate();

                            line.setMinMax(min, max, truncate);
                        }
                    }
                }
            };

            this.add(editPointsAction);
            this.add(editBoundariesAction);
        }

    }

}
