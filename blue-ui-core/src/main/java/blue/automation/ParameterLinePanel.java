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
package blue.automation;

import blue.BlueSystem;
import blue.components.DragDirection;
import blue.components.lines.Line;
import blue.components.lines.LinePoint;
import blue.score.TimeState;
import blue.ui.core.score.ModeListener;
import blue.ui.core.score.ModeManager;
import blue.ui.core.score.ScoreController;
import blue.ui.core.score.ScoreMode;
import blue.ui.core.score.ScoreTopComponent;
import blue.ui.core.score.SingleLineScoreSelection;
import blue.ui.core.score.undo.ClearLineSelectionEdit;
import blue.ui.core.score.undo.LineChangeEdit;
import blue.ui.core.score.undo.LinePointAddEdit;
import blue.ui.core.score.undo.LinePointChangeEdit;
import blue.ui.core.score.undo.LinePointRemoveEdit;
import blue.ui.utilities.ResizeMode;
import blue.ui.utilities.UiUtilities;
import blue.undo.BlueUndoManager;
import blue.utilities.scales.ScaleLinear;
import blue.utility.NumberUtilities;
import blue.utility.ScoreUtilities;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Component;
import java.awt.Cursor;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.Stroke;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import javax.swing.JComponent;
import javax.swing.JLayeredPane;
import javax.swing.SwingUtilities;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import org.openide.windows.WindowManager;

/**
 * @author steven
 */
public class ParameterLinePanel extends JComponent implements
        TableModelListener, ListDataListener, ListSelectionListener,
        ModeListener {

    final static int EDGE = 5;

    private static final List<ParameterLinePanel> ALL_PANELS = new ArrayList<>();

    private static final Stroke STROKE1 = new BasicStroke(1);

    private static final Stroke STROKE2 = new BasicStroke(2);

    private EditPointsPopup popup = null;

    LinePoint selectedPoint = null;

    double leftBoundaryTime = -1.0, rightBoundaryTime = -1.0;

    TableModelListener lineListener;

    ParameterIdList parameterIdList = null;

    ParameterList paramList = null;

    Parameter currentParameter = null;

    private TimeState timeState;

    LineCanvasMouseListener mouseListener = new LineCanvasMouseListener(this);

    int mouseDownInitialX = -1;

    double initialStartTime = -1.0;

    double transTime = 0;

    final SingleLineScoreSelection selection = SingleLineScoreSelection.getInstance();

    public ParameterLinePanel(TimeState timeState, ParameterIdList paramIdList) {
        lineListener = (TableModelEvent e) -> repaint();
        this.timeState = timeState;
        
        this.parameterIdList = paramIdList;
        paramList = new ParameterList();

        AutomationManager automationManager = AutomationManager.getInstance();

        for (int i = 0; i < parameterIdList.size(); i++) {
            String paramId = parameterIdList.getParameterId(i);

            Parameter param = automationManager.getParameter(paramId);

            if (param != null) {
                paramList.add(param);
                param.getLine().addTableModelListener(lineListener);
            }
        }
        
         if (this.parameterIdList != null) {
            int index = this.parameterIdList.getSelectedIndex();
            if (index >= 0) {
                String id = this.parameterIdList.getParameterId(index);
                Parameter param = automationManager.getParameter(id);

                setSelectedParameter(param);
            }
        }

        // setSelectedParameter(null);
        selectedPoint = null;

        modeChanged(ModeManager.getInstance().getMode());
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

    private void setSelectedParameter(Parameter param) {
        if (currentParameter == param) {
            repaint();
            return;
        }

        currentParameter = param;

        repaint();
    }

    @Override
    public void paintComponent(Graphics g) {
        super.paintComponent(g);

        if (paramList == null || paramList.size() == 0) {
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
        boolean editing = (modeManager.getMode() == ScoreMode.SINGLE_LINE);
//        boolean multiLineMode = (modeManager.getMode() == ModeManager.MODE_MULTI_LINE);
        boolean multiLineMode = !editing;

        for (Parameter param : paramList) {
            Line line = param.getLine();

            if (multiLineMode) {
                g2d.setColor(line.getColor().darker());
                drawSelectionLine(g2d, param);
            } else if (param == currentParameter) {
                currentColor = line.getColor();
            } else {
                g2d.setColor(line.getColor().darker());
                drawLine(g2d, param, false);
            }
        }

        if (multiLineMode) {
            return;
        }

        if (currentColor != null) {
            g2d.setColor(currentColor);

            if (paramList.containsLine(selection.getSourceLine())) {
                drawSelectionLine(g2d, currentParameter);
            } else {
                drawLine(g2d, currentParameter, true);
            }

        }

        if (selectedPoint != null && currentParameter != null && 
                currentParameter.getLine().getObservableList().contains(selectedPoint)) {

            double min = currentParameter.getMin();
            double max = currentParameter.getMax();

            int x = doubleToScreenX(selectedPoint.getX());
            int y = doubleToScreenY(selectedPoint.getY(), min, max);

            g2d.setColor(Color.red);
            g2d.fillOval(x - 3, y - 3, 7, 7);
            g2d.setStroke(STROKE1);
            g2d.drawOval(x - 3, y - 3, 7, 7);
            g2d.setStroke(STROKE2);

            if (currentParameter != null) {
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

        // Line currentLine = currentParameter.getLine();
        double yVal = selectedPoint.getY();
        double xVal = selectedPoint.getX();

        String xText = "x: " + NumberUtilities.formatDouble(xVal);
        String yText = "y: " + NumberUtilities.formatDouble(yVal);

        String label = currentParameter.getLabel();

        if (label.length() > 0) {
            yText += " " + label;
        }

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

    private void drawLine(Graphics g, Parameter p, boolean drawPoints) {
        Line line = p.getLine();

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

        if (p.getResolution().doubleValue() <= 0) {

            int[] xValues = new int[line.size()];
            int[] yValues = new int[line.size()];

            double min = line.getMin();
            double max = line.getMax();

            for (int i = 0; i < line.size(); i++) {
                LinePoint point = line.getLinePoint(i);

                xValues[i] = doubleToScreenX(point.getX());
                yValues[i] = doubleToScreenY(point.getY(), min, max);

            }

            g.drawPolyline(xValues, yValues, xValues.length);

            final int lastX = xValues[xValues.length - 1];
            if (lastX < this.getWidth()) {
                int lastY = yValues[yValues.length - 1];
                g.drawLine(lastX, lastY, getWidth(), lastY);
            }

            if (drawPoints) {
                for (int i = 0; i < xValues.length; i++) {
                    paintPoint(g, xValues[i], yValues[i]);
                }
            }

        } else {

            LinePoint previous = null;

            int x, y;

            double min = p.getMin();
            double max = p.getMax();

            for (int i = 0; i < line.size(); i++) {

                LinePoint point = line.getLinePoint(i);

                x = doubleToScreenX(point.getX());
                y = doubleToScreenY(point.getY(), min, max);

                if (previous != null) {

                    double startVal = previous.getY();

                    int startX = doubleToScreenX(previous.getX());
                    int startY = doubleToScreenY(startVal, min, max);

                    int endX = doubleToScreenX(point.getX());
                    int endY = doubleToScreenY(point.getY(), min, max);

                    if (startVal == point.getY()) {
                        g.drawLine(startX, startY, endX, startY);
                        previous = point;
                        continue;
                    }

                    if (previous.getX() == point.getX()) {
                        if (startY != endY) {
                            g.drawLine(startX, startY, startX, endY);
                        }
                        previous = point;
                        continue;
                    }

                    int lastY = startY;
                    int lastX = startX;

                    for (int j = startX; j <= endX; j++) {
                        double timeVal = screenToDoubleX(j);
                        double val = line.getValue(timeVal);

                        int newY = doubleToScreenY(val, min, max);

                        if (endY > startY) {
                            if (newY < startY) {
                                newY = startY;
                            }
                        } else if (newY > startY) {
                            newY = startY;
                        }

                        if (newY != lastY) {
                            g.drawLine(lastX, lastY, j, lastY);
                            g.drawLine(j, lastY, j, newY);

                            lastX = j;
                            lastY = newY;
                        }
                    }
                    if (lastX != endX) {
                        g.drawLine(lastX, lastY, endX, lastY);
                        g.drawLine(endX, lastY, endX, endY);
                    }

                }

                previous = point;
            }

            assert previous != null;
            if (previous.getX() < this.getWidth()) {
                int lastX = doubleToScreenX(previous.getX());
                int lastY = doubleToScreenY(previous.getY(), min, max);

                g.drawLine(lastX, lastY, getWidth(), lastY);
            }

            if (drawPoints) {
                for (int i = 0; i < line.size(); i++) {
                    var lp = line.getLinePoint(i);
                    x = doubleToScreenX(lp.getX());
                    y = doubleToScreenY(lp.getY(), min, max);
                    paintPoint(g, x, y);
                }
            }
        }

    }

    void paintSelectionPoint(Graphics g, int x, int y, double time,
            double selectionStart, double selectionEnd) {
        if (time >= selectionStart && time <= selectionEnd) {
            Graphics2D g2d = (Graphics2D) g;
            g.fillOval(x - 3, y - 3, 7, 7);
        } else {
            paintPoint(g, x, y);
        }
    }


    /* Draws line when in selection mode (MULTILINE, SCORE when SCALING) */
    private void drawSelectionLine(Graphics g, Parameter p) {
        Line tempLine = p.getLine();

        if (ModeManager.getInstance().getMode() == ScoreMode.SCORE) {
            drawLine(g, p, false);
            return;
        }

        Color currentColor = g.getColor();

        Rectangle clipBounds = g.getClipBounds();

        if (tempLine.size() == 0) {
            return;
        }

        final double selectionStart = selection.getRangeStartTime();
        final double selectionEnd = selection.getRangeEndTime();

        if (tempLine.size() == 1) {
            LinePoint lp = tempLine.getLinePoint(0);

            double min = tempLine.getMin();
            double max = tempLine.getMax();

            int x = doubleToScreenX(lp.getX());
            int y = doubleToScreenY(lp.getY(), min, max);

            g.setColor(currentColor);
            g.drawLine(0, y, getWidth(), y);

            paintSelectionPoint(g, x, y, lp.getX(), selectionStart,
                    selectionEnd);

            return;
        }

        if (p.getResolution().doubleValue() <= 0) {

            int[] xValues = new int[tempLine.size()];
            int[] yValues = new int[tempLine.size()];
            double[] pointX = new double[tempLine.size()];

            double min = tempLine.getMin();
            double max = tempLine.getMax();

            for (int i = 0; i < tempLine.size(); i++) {
                LinePoint point = tempLine.getLinePoint(i);

                pointX[i] = point.getX();
                xValues[i] = doubleToScreenX(pointX[i]);
                yValues[i] = doubleToScreenY(point.getY(), min, max);

            }

            g.drawPolyline(xValues, yValues, xValues.length);

            final int lastX = xValues[xValues.length - 1];
            if (lastX < this.getWidth()) {
                int lastY = yValues[yValues.length - 1];
                g.drawLine(lastX, lastY, getWidth(), lastY);
            }

            for (int i = 0; i < xValues.length; i++) {
                paintSelectionPoint(g, xValues[i], yValues[i],
                        pointX[i], selectionStart, selectionEnd);
            }
        } else {

            LinePoint previous = null;

            int x, y;

            double min = p.getMin();
            double max = p.getMax();
            BigDecimal resolution = p.getResolution();

            for (int i = 0; i < tempLine.size(); i++) {

                LinePoint point = tempLine.getLinePoint(i);

                x = doubleToScreenX(point.getX());
                y = doubleToScreenY(point.getY(), min, max);

                if (previous != null) {

                    double startVal = previous.getY();

                    int startX = doubleToScreenX(previous.getX());
                    int startY = doubleToScreenY(startVal, min, max);

                    int endX = doubleToScreenX(point.getX());
                    int endY = doubleToScreenY(point.getY(), min, max);

                    if (startVal == point.getY()) {
                        g.setColor(currentColor);
                        g.drawLine(startX, startY, endX, startY);
                        previous = point;
                        continue;
                    }

                    if (previous.getX() == point.getX()) {
                        if (startY != endY) {
                            g.setColor(currentColor);
                            g.drawLine(startX, startY, startX, endY);
                        }
                        previous = point;
                        continue;
                    }

                    int lastY = startY;
                    int lastX = startX;

                    for (int j = startX; j <= endX; j++) {
                        double timeVal = screenToDoubleX(j);
                        double val = tempLine.getValue(timeVal);

                        int newY = doubleToScreenY(val, min, max);

                        if (endY > startY) {
                            if (newY < startY) {
                                newY = startY;
                            }
                        } else if (newY > startY) {
                            newY = startY;
                        }

                        if (newY != lastY) {
                            g.setColor(currentColor);
                            g.drawLine(lastX, lastY, j, lastY);
                            g.drawLine(j, lastY, j, newY);

                            lastX = j;
                            lastY = newY;
                        }
                    }
                    if (lastX != endX) {
                        g.setColor(currentColor);
                        g.drawLine(lastX, lastY, endX, lastY);
                        g.drawLine(endX, lastY, endX, endY);
                    }

                }

                paintSelectionPoint(g, x, y, point.getX(), selectionStart,
                        selectionEnd);

                previous = point;
            }

            if (previous.getX() < this.getWidth()) {
                int lastX = doubleToScreenX(previous.getX());
                int lastY = doubleToScreenY(previous.getY(), min, max);

                g.setColor(currentColor);
                g.drawLine(lastX, lastY, getWidth(), lastY);
            }

        }
    }

    private void paintPoint(Graphics g, int x, int y) {
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
        int height = this.getHeight() - 10;
        double range = max - min;
        double adjustedY = yVal - min;
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

    private double screenToDoubleY(int val, double min, double max,
            BigDecimal resolution) {
        double height = this.getHeight() - 10;
        double percent = 1 - ((val - 5) / height);
        double range = max - min;

        double value = percent * range;

        if (resolution.doubleValue() > 0.0f) {
            BigDecimal v = new BigDecimal(value).setScale(resolution.scale(),
                    RoundingMode.HALF_UP);
            value = v.subtract(v.remainder(resolution)).doubleValue();
        }

        if (value > range) {
            value = range;
        }

        if (value < 0) {
            value = 0;
        }

        return value + min;
    }

    private void setBoundaryXValues() {

        Line currentLine = currentParameter.getLine();

        if (selectedPoint == currentLine.getLinePoint(0)) {
            leftBoundaryTime = 0;
            rightBoundaryTime = 0;
            return;
        } else if (selectedPoint == currentLine
                .getLinePoint(currentLine.size() - 1)) {
            LinePoint p1 = currentLine.getLinePoint(currentLine.size() - 2);

            leftBoundaryTime = p1.getX();
            rightBoundaryTime = screenToDoubleX(this.getWidth());
            return;
        }

        for (int i = 0; i < currentLine.size(); i++) {
            if (currentLine.getLinePoint(i) == selectedPoint) {
                LinePoint p1 = currentLine.getLinePoint(i - 1);
                LinePoint p2 = currentLine.getLinePoint(i + 1);
                leftBoundaryTime = p1.getX();
                rightBoundaryTime = p2.getX();
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

        double min = currentParameter.getMin();
        double max = currentParameter.getMax();

        point.setLocation(screenToDoubleX(x), screenToDoubleY(y, min, max,
                currentParameter.getResolution()));

        int index = 1;

        Line currentLine = currentParameter.getLine();

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
        Line currentLine = currentParameter.getLine();

        double min = currentParameter.getMin();
        double max = currentParameter.getMax();

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

    @Override
    public void addNotify() {
        super.addNotify();

        if (parameterIdList != null) {
            parameterIdList.addListDataListener(this);
            parameterIdList.addListSelectionListener(this);
        }

        if (paramList != null) {
            for (Parameter param : paramList) {
                param.getLine().addTableModelListener(this);
            }
        }

        ModeManager.getInstance().addModeListener(this);

        ALL_PANELS.add(this);
    }

    @Override
    public void removeNotify() {
        if (parameterIdList != null) {
            parameterIdList.removeListDataListener(this);
            parameterIdList.removeListSelectionListener(this);
        }

        if (paramList != null) {
            for (Parameter param : paramList) {
                param.getLine().removeTableModelListener(this);
            }
        }

//        parameterIdList = null;
//        paramList = null;
        ModeManager.getInstance().removeModeListener(this);
        ALL_PANELS.remove(this);
        super.removeNotify();
    }

    @Override
    public void contentsChanged(ListDataEvent e) {
        // ignore - not used by parameterIdList
    }

    @Override
    public void intervalAdded(ListDataEvent e) {
        if (e.getSource() == parameterIdList) {
            String paramId = parameterIdList.getParameterId(e.getIndex0());
            Parameter param = AutomationManager.getInstance().getParameter(
                    paramId);
            paramList.add(param);
            param.getLine().addTableModelListener(this);
            repaint();
            // if (paramList.size() == 1) {
            // setSelectedParameter(param);
            // }
        }
    }

    @Override
    public void intervalRemoved(ListDataEvent e) {
        if (e.getSource() == parameterIdList) {

            for (int i = 0; i < paramList.size(); i++) {
                Parameter param = paramList.get(i);

                if (!parameterIdList.contains(param.getUniqueId())) {
                    paramList.remove(i);
                    param.getLine().removeTableModelListener(this);
                    repaint();
                    return;
                }
            }
            //
            // Parameter param = paramList.getParameter(e.getIndex0());
            // paramList.removeParameter(e.getIndex0());
            // param.getLine().removeTableModelListener(this);

            // if (currentParameter == param) {
            // if (paramList.size() > 0) {
            // setSelectedParameter(paramList.getParameter(0));
            // } else {
            // setSelectedParameter(null);
            // }
            // }
        }
    }

    @Override
    public void modeChanged(ScoreMode mode) {
        removeMouseListener(mouseListener);
        removeMouseMotionListener(mouseListener);
        if (mode == ScoreMode.SINGLE_LINE) {
            addMouseListener(mouseListener);
            addMouseMotionListener(mouseListener);
        }
        repaint();
    }

    @Override
    public void valueChanged(ListSelectionEvent e) {
        int index = e.getFirstIndex();

        if (index < 0) {
            setSelectedParameter(null);
            return;
        }

        String paramId = parameterIdList.getParameterId(index);

        Parameter param = AutomationManager.getInstance().getParameter(paramId);
        setSelectedParameter(param);
    }

    class LineCanvasMouseListener extends MouseAdapter {

        ParameterLinePanel lineCanvas;
        DragDirection direction = DragDirection.NOT_SET;
        Point pressPoint = null;
        boolean verticalShift = false;
        private int initialY;
        boolean justPasted = false;
        Line sourceCopy = null;
        LinePoint lpSourceCopy = null;
        boolean newLinePoint = false;

        LineVerticalShifter vShifter = new LineVerticalShifter();

        public LineCanvasMouseListener(ParameterLinePanel lineCanvas) {
            this.lineCanvas = lineCanvas;
        }

        private boolean timeContains(double time, double start, double end) {
            return time >= start && time <= end;
        }

        @Override
        public void mousePressed(MouseEvent e) {
            if (ModeManager.getInstance().getMode() != ScoreMode.SINGLE_LINE) {
                return;
            }

            e.consume();
            requestFocus();

            pressPoint = e.getPoint();

            final int x = e.getX();
            final double pixelSecond = timeState.getPixelSecond();
            final double mouseTime = x / pixelSecond;

            if (paramList.containsLine(selection.getSourceLine())) {

                if (SwingUtilities.isLeftMouseButton(e)
                        && !timeContains(mouseTime, selection.getStartTime(), selection.getEndTime())) {
                    transTime = 0.0f;
                    mouseDownInitialX = -1;
                    selection.updateSelection(null, -1.0, -1.0);
                    sourceCopy = null;
                    return;
                } else {
                    // TRANSLATION OR SCALING OF SELECTION
                    if (SwingUtilities.isLeftMouseButton(e)) {
                        mouseDownInitialX = e.getX();
                        transTime = 0.0f;

                        initialStartTime = selection.getStartTime();

                        verticalShift = e.isControlDown();

                        if (verticalShift) {
                            vShifter.setup(currentParameter, initialStartTime, selection.getEndTime());
                        }

                        initialY = e.getY();
                        sourceCopy = new Line(selection.getSourceLine());

                        ScoreTopComponent scoreTC = (ScoreTopComponent) WindowManager.getDefault().findTopComponent("ScoreTopComponent");
                        var resizeMode = UiUtilities.getResizeMode(e.getComponent(), e.getPoint(), scoreTC.getMarquee());
                        if (resizeMode != ResizeMode.NONE) {
                            selection.startScale(resizeMode);
                        }
                    }
                    return;

                }
            }

            transTime = 0.0f;
            mouseDownInitialX = -1;

            selection.updateSelection(null, -1.0, -1.0);

            if (currentParameter == null) {
                return;
            }

            Line currentLine = currentParameter.getLine();

            if (selectedPoint != null) {
                if (UiUtilities.isRightMouseButton(e)) {
                    LinePoint first = currentLine.getLinePoint(0);

                    if (selectedPoint != first) {                        
                        final var linePointRemoveEdit = new LinePointRemoveEdit(
                                currentLine, selectedPoint,
                                currentLine.getObservableList().indexOf(selectedPoint));
                        BlueUndoManager.addEdit("score", linePointRemoveEdit);
                        
                        currentLine.removeLinePoint(selectedPoint);

                        selectedPoint = null;
                        repaint();
                    }
                } else {
                    // MOVING LINE POINT
                    setBoundaryXValues();
                    lpSourceCopy = new LinePoint(selectedPoint);
                }
            } else if (SwingUtilities.isLeftMouseButton(e)) {

                int start = e.getX();

                double startTime = start / pixelSecond;

                if (timeState.isSnapEnabled() && !(e.isControlDown() && e.isShiftDown())) {
                    startTime = ScoreUtilities.getSnapValueStart(startTime, timeState.getSnapValue());
                }

                final int OS_CTRL_KEY = BlueSystem.getMenuShortcutKey();

                if ((e.getModifiers() & OS_CTRL_KEY) == OS_CTRL_KEY) {
                    ScoreController.getInstance().pasteSingleLine(startTime);
                    justPasted = true;

                } else if (e.isShiftDown()) {
                    initialStartTime = startTime;
                    ScoreTopComponent scoreTC = (ScoreTopComponent) WindowManager.getDefault().findTopComponent("ScoreTopComponent");
                    Rectangle rect = new Rectangle(start, 0, 1, getHeight());
                    rect = SwingUtilities.convertRectangle(ParameterLinePanel.this, rect, scoreTC.getScorePanel());
                    scoreTC.getMarquee().setBounds(rect);
                    SingleLineScoreSelection selection
                            = SingleLineScoreSelection.getInstance();
                    selection.updateSelection(currentLine, startTime, startTime);

                } else {
                    selectedPoint = insertGraphPoint(start, e.getY());
                    newLinePoint = true;
                    setBoundaryXValues();
                }
            } else if (UiUtilities.isRightMouseButton(e)) {
                if (popup == null) {
                    popup = new EditPointsPopup(blue.automation.ParameterLinePanel.this);
                }
                popup.setLine(currentLine);
                popup.show((Component) e.getSource(), e.getX(), e.getY());
            }

        }

        @Override
        public void mouseDragged(MouseEvent e) {
            if (ModeManager.getInstance().getMode() != ScoreMode.SINGLE_LINE) {
                return;
            }

            e.consume();

            if (currentParameter == null || justPasted) {
                return;
            }

            // check if selection currently is for line that is contained in this panel
            if (paramList.containsLine(selection.getSourceLine())) {
                int x = e.getX();
                final double pixelSecond = timeState.getPixelSecond();

                if (verticalShift) {

                    double height = getHeight() - 10;
                    double range = currentParameter.getMax() - currentParameter.getMin();
                    double percent = (initialY - e.getY()) / height;

                    double amount = percent * range;

                    vShifter.processVShift(amount);

                } else if (mouseDownInitialX >= 0) { // MOVING OF SELECTION
                    if (SwingUtilities.isLeftMouseButton(e)) {

                        // SCALING
                        if (selection.getScaleDirection() != ResizeMode.NONE) {

                            final var edgeTime = EDGE / pixelSecond;

                            double newTime = x / pixelSecond;

                            if (timeState.isSnapEnabled() && !e.isControlDown()) {
                                newTime = ScoreUtilities.getSnapValueMove(
                                        newTime, timeState.getSnapValue());
                            }

                            ScaleLinear scale = selection.getScale();
                            if (selection.getScaleDirection() == ResizeMode.LEFT) {
                                newTime = Math.min(scale.getRangeEnd() - edgeTime, newTime);
                                newTime = Math.max(newTime, 0.0);
                            } else {
                                newTime = Math.max(scale.getRangeStart() + edgeTime, newTime);
                            }

                            selection.updateScale(newTime);

                            var newLine = new Line(sourceCopy);
                            newLine.processLineForSelectionScale(selection.getScale());
                            selection.getSourceLine().setLinePoints(newLine.getObservableList());
                        } else {
                            // TRANSLATION
                            transTime = (x - mouseDownInitialX) / pixelSecond;

                            double newTime = initialStartTime + transTime;

                            if (timeState.isSnapEnabled() && !e.isControlDown()) {
                                newTime = ScoreUtilities.getSnapValueMove(newTime,
                                        timeState.getSnapValue());
                                transTime = newTime - selection.getStartTime();
                            }

                            if (newTime < 0) {
                                transTime -= newTime;
                                newTime = 0;
                            }

                            var newLine = new Line(sourceCopy);
                            newLine.processLineForSelectionDrag(selection.getStartTime(),
                                    selection.getEndTime(), transTime);
                            selection.getSourceLine().setLinePoints(newLine.getObservableList());
                            selection.updateTranslation(transTime);
                        }
                    }
                } else {
                    if (x < 0) {
                        x = 0;
                    }

                    double startTime = initialStartTime;
                    double endTime = x / pixelSecond;

                    if (timeState.isSnapEnabled() && !e.isControlDown()) {
                        endTime = ScoreUtilities.getSnapValueMove(endTime,
                                timeState.getSnapValue());
                    }

                    if (endTime < startTime) {
                        double temp = startTime;
                        startTime = endTime;
                        endTime = temp;
                    }

                    selection.updateSelection(currentParameter.getLine(), startTime, endTime);
                }

                // check if there is a selected point, which means we're dragging a point
            } else if (selectedPoint != null) {

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

                if (y < topY) {
                    y = topY;
                } else if (y > bottomY) {
                    y = bottomY;
                }

                double pixelSecond = timeState.getPixelSecond();
                double dragTime = x / pixelSecond;

                if (timeState.isSnapEnabled() && !e.isControlDown()) {
                    dragTime = ScoreUtilities.getSnapValueMove(dragTime,
                            timeState.getSnapValue());
                }

                dragTime = Math.max(leftBoundaryTime,
                        Math.min(rightBoundaryTime, dragTime));

                double min = currentParameter.getMin();
                double max = currentParameter.getMax();

                if (selectedPoint != null) {
                    selectedPoint.setLocation(dragTime,
                            screenToDoubleY(y, min, max, currentParameter
                                    .getResolution()));
                }
            }
            repaint();
        }

        @Override
        public void mouseReleased(MouseEvent e) {
            direction = DragDirection.NOT_SET;
            vShifter.cleanup();
            boolean didVerticalShift = verticalShift;
            verticalShift = false;
            justPasted = false;
            transTime = 0.0f;

            if (ModeManager.getInstance().getMode() != ScoreMode.SINGLE_LINE) {
                return;
            }

            e.consume();

            if (currentParameter == null) {
                return;
            }

            if (SwingUtilities.isLeftMouseButton(e)) {
                if (selectedPoint != null) {
                    if (newLinePoint) {
                        final var line = currentParameter.getLine();
                        final var linePointAddEdit = new LinePointAddEdit(
                                line, selectedPoint,
                                line.getObservableList().indexOf(selectedPoint));
                        BlueUndoManager.addEdit("score", linePointAddEdit);
                    } else {
                        final var linePointChangeEdit = new LinePointChangeEdit(
                                selectedPoint, lpSourceCopy,
                                new LinePoint(selectedPoint));
                        BlueUndoManager.addEdit("score", linePointChangeEdit);
                    }
                } else if (paramList.containsLine(selection.getSourceLine())) {
                    if (didVerticalShift || mouseDownInitialX > 0) {

                        if (selection.getScaleDirection() == ResizeMode.NONE) {
                            selection.endTranslation();
                        } else {
                            selection.endScale();
                        }
                        var line = selection.getSourceLine();
                        var endCopy = new Line(line);
                        ClearLineSelectionEdit top = new ClearLineSelectionEdit();
                        top.appendNextEdit(new LineChangeEdit(line, new Line(sourceCopy), endCopy));
                                
                        BlueUndoManager.addEdit("score", top);
                        sourceCopy = null;
                        
                    }
                }
            }
            
            newLinePoint = false;

            repaint();
        }

        @Override
        public void mouseMoved(MouseEvent e) {
            if (ModeManager.getInstance().getMode() != ScoreMode.SINGLE_LINE) {
                return;
            }

            if (currentParameter == null) {
                return;
            }

            ScoreTopComponent scoreTC = (ScoreTopComponent) WindowManager.getDefault().findTopComponent("ScoreTopComponent");
            final JLayeredPane scorePanel = scoreTC.getScorePanel();
            var resizeMode = UiUtilities.getResizeMode(e.getComponent(), e.getPoint(), scoreTC.getMarquee());
            //System.out.println("RESIZE_MODE: " + resizeMode);
            switch (resizeMode) {
                case LEFT:
                    scorePanel.setCursor(Cursor.getPredefinedCursor(Cursor.W_RESIZE_CURSOR));
                    break;
                case RIGHT:
                    scorePanel.setCursor(Cursor.getPredefinedCursor(Cursor.E_RESIZE_CURSOR));
                    break;
                default:
                    if (getCursor() != Cursor.getDefaultCursor()) {
                        scorePanel.setCursor(Cursor.getDefaultCursor());
                    }
                    break;
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

    public static int[] getYHeight(Line line) {
        for (ParameterLinePanel panel : ALL_PANELS) {
            if (panel.paramList.containsLine(line)) {
                ScoreTopComponent scoreTopComponent = (ScoreTopComponent) WindowManager.getDefault().findTopComponent(
                        "ScoreTopComponent");
                JComponent scorePanel = scoreTopComponent.getScorePanel();
                Point p = SwingUtilities.convertPoint(panel.getParent(), panel.getLocation(), scorePanel);
                return new int[]{(int) p.getY(), panel.getHeight()};
            }
        }
        return null;
    }
}
