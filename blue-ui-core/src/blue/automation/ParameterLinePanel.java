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

import blue.components.DragDirection;
import blue.components.AlphaMarquee;
import blue.components.lines.Line;
import blue.components.lines.LineEditorDialog;
import blue.components.lines.LinePoint;
import blue.score.TimeState;
import blue.ui.core.score.ModeListener;
import blue.ui.core.score.ModeManager;
import blue.ui.core.score.ScoreMode;
import blue.ui.utilities.FileChooserManager;
import blue.ui.utilities.UiUtilities;
import blue.utility.NumberUtilities;
import blue.utility.ScoreUtilities;
import java.awt.Color;
import java.awt.Component;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.MouseEvent;
import java.awt.event.MouseListener;
import java.awt.event.MouseMotionListener;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.io.PrintWriter;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import javafx.stage.FileChooser.ExtensionFilter;
import javax.swing.AbstractAction;
import javax.swing.Action;
import javax.swing.JComponent;
import javax.swing.JMenu;
import javax.swing.JMenuItem;
import javax.swing.JOptionPane;
import javax.swing.JPopupMenu;
import javax.swing.SwingUtilities;
import javax.swing.event.ListDataEvent;
import javax.swing.event.ListDataListener;
import javax.swing.event.ListSelectionEvent;
import javax.swing.event.ListSelectionListener;
import javax.swing.event.TableModelEvent;
import javax.swing.event.TableModelListener;
import org.openide.util.Exceptions;

/**
 * @author steven
 */
public class ParameterLinePanel extends JComponent implements
        TableModelListener, ListDataListener, ListSelectionListener,
        ModeListener {

    private static final String FILE_BPF_IMPORT = "paramaterLinePanel.bpf_import";

    private static final String FILE_BPF_EXPORT = "paramaterLinePanel.bpf_export";

    private EditPointsPopup popup = null;

    LinePoint selectedPoint = null;

    int leftBoundaryX = -1, rightBoundaryX = -1;

    TableModelListener lineListener = null;

    ParameterIdList parameterIdList = null;

    ParameterList paramList = null;

    Parameter currentParameter = null;

    private TimeState timeState;

    LineCanvasMouseListener mouseListener = new LineCanvasMouseListener(this);

    // MouseWheelListener wheelListener;
    AlphaMarquee marquee;

    ArrayList<double[]> selectionList = new ArrayList<>();

    double mouseDownInitialTime = -1.0f;

    double transTime = 0;

    private double selectionStartTime = -1;

    private double selectionEndTime = -1;

    private double newSelectionStartTime = -1;

    private double newSelectionEndTime = -1;

    public ParameterLinePanel(AlphaMarquee marquee) {
        this.marquee = marquee;

        ModeManager.getInstance().addModeListener(this);

        lineListener = (TableModelEvent e) -> {
            repaint();
        };

        FileChooserManager fcm = FileChooserManager.getDefault();

        fcm.addFilter(FILE_BPF_IMPORT, new ExtensionFilter(
                "Break Point File", "*.bpf"));

        fcm.addFilter(FILE_BPF_EXPORT, new ExtensionFilter(
                "Break Point File", "*.bpf"));

        fcm.setDialogTitle(FILE_BPF_IMPORT, "Import BPF File");
        fcm.setDialogTitle(FILE_BPF_EXPORT, "Export BPF File");

        // wheelListener = new MouseWheelListener() {
        // public void mouseWheelMoved(MouseWheelEvent e) {
        // ModeManager modeManager = ModeManager.getInstance();
        // if (modeManager.getMode() != ModeManager.MODE_SINGLE_LINE) {
        // return;
        // }
        //
        // if (paramList.size() == 0) {
        // return;
        // }
        //
        // if (e.getWheelRotation() > 0) {
        // if (currentParameter == null) {
        // setSelectedParameter(paramList.getParameter(0));
        // } else {
        // int index = paramList.indexOf(currentParameter);
        //
        // if (index == paramList.size() - 1) {
        // index = 0;
        // } else {
        // index++;
        // }
        //
        // setSelectedParameter(paramList.getParameter(index));
        // }
        // repaint();
        // } else {
        // if (currentParameter == null) {
        // setSelectedParameter(paramList.getParameter(0));
        // } else {
        // int index = paramList.indexOf(currentParameter);
        //
        // if (index == 0) {
        // index = paramList.size() - 1;
        // } else {
        // index--;
        // }
        //
        // setSelectedParameter(paramList.getParameter(index));
        // }
        // }
        // }
        // };
    }

    public void setTimeState(TimeState timeState) {
        this.timeState = timeState;
    }

    public void setParameterIdList(ParameterIdList paramIdList) {
        if (this.parameterIdList != null) {
            this.parameterIdList.removeListDataListener(this);
            this.parameterIdList.removeListSelectionListener(this);

            if (this.paramList != null) {
                for (int i = 0; i < this.paramList.size(); i++) {
                    Parameter param = paramList.getParameter(i);
                    param.getLine().removeTableModelListener(lineListener);
                }
            }
        }

        this.parameterIdList = paramIdList;
        paramList = new ParameterList();

        AutomationManager automationManager = AutomationManager.getInstance();

        for (int i = 0; i < parameterIdList.size(); i++) {
            String paramId = parameterIdList.getParameterId(i);

            Parameter param = automationManager.getParameter(paramId);

            if (param != null) {
                paramList.addParameter(param);
                param.getLine().addTableModelListener(lineListener);
            }
        }

        if (this.parameterIdList != null) {
            this.parameterIdList.addListDataListener(this);
            this.parameterIdList.addListSelectionListener(this);

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

        RenderingHints hints = new RenderingHints(
                RenderingHints.KEY_ANTIALIASING,
                RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHints(hints);

        Color currentColor = null;

        ModeManager modeManager = ModeManager.getInstance();
        boolean editing = (modeManager.getMode() == ScoreMode.SINGLE_LINE);
//        boolean multiLineMode = (modeManager.getMode() == ModeManager.MODE_MULTI_LINE);
        boolean multiLineMode = !editing;

        for (int i = 0; i < paramList.size(); i++) {
            Parameter param = paramList.getParameter(i);

            Line line = param.getLine();

            if (multiLineMode) {
                g2d.setColor(line.getColor().darker());
                drawSelectionLine(g2d, param);
            } else if (editing && param == currentParameter) {
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

            if (editing && marquee.isVisible() && marquee.intersects(this)) {
                drawSelectionLine(g2d, currentParameter);
            } else {
                drawLine(g2d, currentParameter, true);
            }

        }

        if (editing && selectedPoint != null) {

            double min = currentParameter.getMin();
            double max = currentParameter.getMax();

            int x = doubleToScreenX(selectedPoint.getX());
            int y = doubleToScreenY(selectedPoint.getY(), min, max);

            g2d.setColor(Color.red);
            paintPoint(g2d, x, y);

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

    private final void drawLine(Graphics g, Parameter p, boolean drawPoints) {
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
            BigDecimal resolution = p.getResolution();

            for (int i = 0; i < line.size(); i++) {

                LinePoint point = line.getLinePoint(i);

                x = doubleToScreenX(point.getX());
                y = doubleToScreenY(point.getY(), min, max);

                if (drawPoints) {
                    paintPoint(g, x, y);
                }

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

            if (previous.getX() < this.getWidth()) {
                int lastX = doubleToScreenX(previous.getX());
                int lastY = doubleToScreenY(previous.getY(), min, max);

                g.drawLine(lastX, lastY, getWidth(), lastY);
            }

        }

    }

    void paintSelectionPoint(Graphics g, int x, int y, double time,
            double selectionStart, double selectionEnd) {
        if (time >= selectionStart && time <= selectionEnd) {
            Color c = g.getColor();
            g.setColor(c.darker().darker());
            g.fillRect(x - 3, y - 3, 7, 7);
            g.setColor(c);
        }
        paintPoint(g, x, y);
    }

    /**
     * Returns a line that has the points sorted and those masked removed when
     * handling SelectionMoving; not sure this will be good for long term as it
     * doesn't seem performant but using for initial work and can reevaluate
     * later.
     *
     * @param line
     * @return
     */
    private Line getSelectionSortedLine(Line line) {
        Line retVal = new Line(line);
        processLineForSelectionDrag(retVal);

        return retVal;
    }

    private boolean isPointInSelectionRegion(double pointTime, double timeMod) {
        double min, max;
        double[] points;

        for (int i = 0; i < selectionList.size(); i++) {
            points = selectionList.get(i);
            min = points[0] + timeMod;
            max = points[1] + timeMod;

            if (pointTime >= min && pointTime <= max) {
                return true;
            }
        }
        return false;
    }

    private void processLineForSelectionDrag(Line line) {
        ArrayList<LinePoint> points = new ArrayList<>();

        for (Iterator<LinePoint> iter = line.iterator(); iter.hasNext();) {

            LinePoint lp = iter.next();

            if (line.isFirstLinePoint(lp)) {
                continue;
            }

            double pointTime = lp.getX();

            if (isPointInSelectionRegion(pointTime, 0)) {
                points.add(lp);
                iter.remove();
            } else if (isPointInSelectionRegion(pointTime, transTime)) {
                iter.remove();
            }
        }

        for (Iterator<LinePoint> iterator = points.iterator(); iterator.hasNext();) {
            LinePoint lp = iterator.next();

            lp.setLocation(lp.getX() + transTime, lp.getY());
            line.addLinePoint(lp);
        }

        line.sort();
    }

    /**
     * Returns a line that has the points sorted and those masked removed when
     * handling SelectionScaling; not sure this will be good for long term as it
     * doesn't seem performant but using for initial work and can reevaluate
     * later.
     *
     * @param line
     * @return
     */
    private Line getSelectionScalingSortedLine(Line line) {
        Line retVal = new Line(line);
        processLineForSelectionScale(retVal);

        return retVal;
    }

    private void processLineForSelectionScale(Line line) {
        if (selectionStartTime < 0) {
            return;
        }

        ArrayList<LinePoint> points = new ArrayList<>();

        for (Iterator<LinePoint> iter = line.iterator(); iter.hasNext();) {

            LinePoint lp = iter.next();

            if (line.isFirstLinePoint(lp)) {
                continue;
            }

            double pointTime = lp.getX();

            if (pointTime >= selectionStartTime && pointTime <= selectionEndTime) {
                points.add(lp);
                iter.remove();
            } else if (pointTime >= newSelectionStartTime && pointTime <= newSelectionEndTime) {
                iter.remove();
            }
        }

        double oldStart = selectionStartTime;
        double newStart = newSelectionStartTime;
        double oldRange = selectionEndTime - selectionStartTime;
        double newRange = newSelectionEndTime - newSelectionStartTime;

        for (Iterator<LinePoint> iterator = points.iterator(); iterator.hasNext();) {
            LinePoint lp = iterator.next();

            double newX = (lp.getX() - oldStart);
            newX = (newX / oldRange) * newRange;
            newX += newStart;

            lp.setLocation(newX, lp.getY());
            line.addLinePoint(lp);
        }

        line.sort();
    }

    /* Draws line when in selection mode (MULTILINE, SCORE when SCALING) */
    private final void drawSelectionLine(Graphics g, Parameter p) {
        Line tempLine = p.getLine();

        if (selectionList.size() > 0) {
            tempLine = getSelectionSortedLine(tempLine);
        } else if (newSelectionStartTime >= 0) {
            tempLine = getSelectionScalingSortedLine(tempLine);
        } else {
            drawLine(g, p, false);
            return;
        }

        Color currentColor = g.getColor();

        Rectangle clipBounds = g.getClipBounds();

        if (tempLine.size() == 0) {
            return;
        }

        double pixelSecond = (double) timeState.getPixelSecond();

        double selectionStart;
        double selectionEnd;

        if (newSelectionStartTime >= 0) {
            selectionStart = newSelectionStartTime;
            selectionEnd = newSelectionEndTime;
        } else {
            selectionStart = marquee.startTime;
            selectionEnd = marquee.endTime;
        }

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

    private final void paintPoint(Graphics g, int x, int y) {
        g.fillRect(x - 2, y - 2, 5, 5);
    }

    private int doubleToScreenX(double val) {
        if (timeState == null) {
            return -1;
        }
        return (int)Math.round(val * timeState.getPixelSecond());
    }

    private int doubleToScreenY(double yVal, double min, double max) {
        int height = this.getHeight() - 10;
        double range = max - min;
        double adjustedY = yVal - min;
        double percent = adjustedY / range;

        int y = (int)Math.round(height * (1.0f - percent)) + 5;

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

    public void setBoundaryXValues() {

        Line currentLine = currentParameter.getLine();

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

    public LinePoint findGraphPoint(int x) {
        Line currentLine = currentParameter.getLine();

        for (int i = 0; i < currentLine.size(); i++) {
            LinePoint point = currentLine.getLinePoint(i);

            int tempX = doubleToScreenX(point.getX());

            if (tempX >= x - 2 && tempX <= x + 2) {
                return point;
            }

        }

        return null;
    }

    public void cleanup() {

        if (parameterIdList != null) {
            parameterIdList.removeListDataListener(this);
            parameterIdList.removeListSelectionListener(this);
        }

        if (paramList != null) {
            for (int i = 0; i < paramList.size(); i++) {
                Parameter param = paramList.getParameter(i);
                param.getLine().removeTableModelListener(this);
            }
        }

        parameterIdList = null;
        paramList = null;

        ModeManager.getInstance().removeModeListener(this);
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
            paramList.addParameter(param);
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
                Parameter param = paramList.getParameter(i);

                if (!parameterIdList.contains(param.getUniqueId())) {
                    paramList.removeParameter(i);
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
        if (mode == ScoreMode.SINGLE_LINE) {
            addMouseListener(mouseListener);
            addMouseMotionListener(mouseListener);
            // addMouseWheelListener(wheelListener);

            // if (currentParameter == null && paramList.size() > 0) {
            // setSelectedParameter(paramList.getParameter(0));
            // }
        } else {
            removeMouseListener(mouseListener);
            removeMouseMotionListener(mouseListener);
            // removeMouseWheelListener(wheelListener);
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

    class LinePointOrigin {

        private final int originY;
        private final Parameter param;
        private final LinePoint linePoint;

        public LinePointOrigin(Parameter p, LinePoint lp) {
            this.originY = doubleToScreenY(lp.getY(), p.getMin(), p.getMax());
            this.param = p;
            this.linePoint = lp;
        }
    }

    class LineCanvasMouseListener implements MouseListener, MouseMotionListener {

        ParameterLinePanel lineCanvas;
        DragDirection direction = DragDirection.NOT_SET;
        Point pressPoint = null;
        boolean horizontalShift = false;
        private int initialY;
        List<LinePointOrigin> linePointOrigins = new ArrayList<>();
        int maxHorizontalUp = 0;
        int maxHorizontalDown = 0;

        public LineCanvasMouseListener(ParameterLinePanel lineCanvas) {
            this.lineCanvas = lineCanvas;
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
            if (ModeManager.getInstance().getMode() != ScoreMode.SINGLE_LINE) {
                return;
            }

            pressPoint = e.getPoint();

            if (marquee.isVisible()) {

                if (SwingUtilities.isLeftMouseButton(e)
                        && !marquee.contains(
                                SwingUtilities.convertPoint(e.getComponent(), pressPoint, marquee))) {
                    transTime = 0.0f;
                    mouseDownInitialTime = -1.0f;
                    clearSelectionDragRegions();

                    marquee.setVisible(false);
                    return;
                } else 
                    if (marquee.intersects(ParameterLinePanel.this)) {

                    int x = e.getX();

                    if (x >= marquee.getX()
                            && x <= marquee.getX() + marquee.getWidth()) {

                        if (SwingUtilities.isLeftMouseButton(e)) {
                            double pixelSecond = (double) timeState.getPixelSecond();

                            mouseDownInitialTime = e.getX() / pixelSecond;
                            transTime = 0.0f;

                            double marqueeLeft = marquee.getX() / pixelSecond;
                            double marqueeRight = (marquee.getX() + marquee.getWidth()) / pixelSecond;

                            if (selectionList.size() == 0) {
                                double[] points = new double[]{
                                    marqueeLeft, marqueeRight};
                                selectionList.add(points);
                            } else {
                                double[] points = selectionList.get(0);
                                points[0] = marqueeLeft;
                                points[1] = marqueeRight;
                            }

                            horizontalShift = e.isControlDown();

                            int topY = 5;
                            int bottomY = getHeight() - 5;

                            if (horizontalShift) {
                                linePointOrigins.clear();
                                int max = Integer.MAX_VALUE;
                                int min = Integer.MAX_VALUE;
                                for (Parameter p : paramList) {
                                    // these are flipped from graphics coordinates
                                    for (LinePoint lp : p.getLine()) {
                                        if (lp.getX() >= marqueeLeft
                                                && lp.getX() <= marqueeRight) {
                                            LinePointOrigin lpo = new LinePointOrigin(p, lp);
                                            linePointOrigins.add(lpo);
                                            max = Math.min(Math.abs(topY - lpo.originY), max);
                                            min = Math.min(bottomY - lpo.originY, min);
                                        }
                                    }
                                }

                                maxHorizontalUp = -max;
                                maxHorizontalDown = min;
                            }

                            initialY = e.getY();
                        }
                        return;
                    }
                }
            }

            transTime = 0.0f;
            mouseDownInitialTime = -1.0f;
            clearSelectionDragRegions();

            marquee.setVisible(false);

            if (currentParameter == null) {
//                if (UiUtilities.isRightMouseButton(e)) {
//                    if (popup == null) {
//                        popup = new EditPointsPopup();
//                    }
//                    popup.setLine(null);
//                    popup.show((Component) e.getSource(), e.getX(), e.getY());
//                }
                return;
            }

            Line currentLine = currentParameter.getLine();

            if (selectedPoint != null) {
                if (UiUtilities.isRightMouseButton(e)) {
                    LinePoint first = currentLine.getLinePoint(0);

                    if (selectedPoint != first) {
                        currentLine.removeLinePoint(selectedPoint);
                        selectedPoint = null;
                    }
                } else {
                    setBoundaryXValues();
                }
            } else if (SwingUtilities.isLeftMouseButton(e)) {

                int start = e.getX();
                double pixelSecond = (double) timeState.getPixelSecond();

                double startTime = start / pixelSecond;

                if (timeState.isSnapEnabled() && !e.isControlDown()) {
                    startTime = ScoreUtilities.getSnapValueStart(startTime, timeState.getSnapValue());
                }

                if (e.isShiftDown()) {
                    Point p = new Point(start, getY());
                    marquee.setStart(p);
                    marquee.startTime = startTime;
                    marquee.endTime = startTime;
                    marquee.setVisible(true);
                } else {
                    selectedPoint = insertGraphPoint(start, e.getY());
                    setBoundaryXValues();
                }
            } else if (UiUtilities.isRightMouseButton(e)) {
                if (popup == null) {
                    popup = new EditPointsPopup();
                }
                popup.setLine(currentLine);
                popup.show((Component) e.getSource(), e.getX(), e.getY());
            }

        }

//        private int setStartForSnap(int start) {
//            int snapPixels = (int) (pObj.getSnapValue() * pObj.getPixelSecond());
//            int fraction = start % snapPixels;
//
//            start = start - fraction;
//
//            if (fraction > snapPixels / 2) {
//                start += snapPixels;
//            }
//            return start;
//        }
        @Override
        public void mouseReleased(MouseEvent e
        ) {
            direction = DragDirection.NOT_SET;
            boolean didHorizontalShift = horizontalShift;
            horizontalShift = false;

            if (ModeManager.getInstance().getMode() != ScoreMode.SINGLE_LINE) {
                return;
            }

            if (currentParameter == null) {
                return;
            }

            if (selectedPoint == null && !didHorizontalShift
                    && marquee.isVisible()
                    && marquee.intersects(ParameterLinePanel.this)
                    && selectionList.size() > 0
                    && SwingUtilities.isLeftMouseButton(e)) {
                processLineForSelectionDrag(currentParameter.getLine());
            }

            clearSelectionDragRegions();
            transTime = 0.0f;

            repaint();

        }

        private double getInitialStartTime() {
            if (selectionList.size() == 0) {
                return 0;
            }

            double retVal = Double.MAX_VALUE;

            for (int i = 0; i < selectionList.size(); i++) {
                double[] points = selectionList.get(i);
                if (points[0] < retVal) {
                    retVal = points[0];
                }
            }

            return retVal;
        }

        @Override
        public void mouseDragged(MouseEvent e) {
            if (ModeManager.getInstance().getMode() != ScoreMode.SINGLE_LINE) {
                return;
            }

            if (currentParameter == null) {
                return;
            }

            if (marquee.isVisible()) {
                int x = e.getX();
                double pixelSecond = (double) timeState.getPixelSecond();
                double mouseDragTime = x / pixelSecond;

                if (horizontalShift) {
                    int yDiff = e.getY() - initialY;
                    yDiff = Math.max(yDiff, maxHorizontalUp);
                    yDiff = Math.min(yDiff, maxHorizontalDown);
                    processHorizontalShift(yDiff, linePointOrigins);

                } else if (mouseDownInitialTime > 0) {
                    if (SwingUtilities.isLeftMouseButton(e)) {
                        transTime = mouseDragTime - mouseDownInitialTime;

                        double newTime = getInitialStartTime() + transTime;

                        if (timeState.isSnapEnabled() && !e.isControlDown()) {
                            newTime = ScoreUtilities.getSnapValueStart(newTime,
                                    timeState.getSnapValue());
                            transTime = newTime - getInitialStartTime();
                        }

                        if (newTime < 0) {
                            transTime -= newTime;
                            newTime = 0;
                        }

                        marquee.startTime = newTime;
                        marquee.endTime = newTime;
                        marquee.setLocation((int) (newTime * pixelSecond), marquee.getY());
                    }
                } else {
                    if (x < 0) {
                        x = 0;
                    }

                    double endTime = x / pixelSecond;

                    if (timeState.isSnapEnabled() && !e.isControlDown()) {
                        endTime = ScoreUtilities.getSnapValueMove(endTime,
                                timeState.getSnapValue());
                    }

                    Point p = new Point((int) (endTime * pixelSecond), getY() + getHeight());
                    marquee.endTime = endTime;
                    marquee.setDragPoint(p);
                }
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

                double pixelSecond = (double) timeState.getPixelSecond();
                double dragTime = x / pixelSecond;

                if (timeState.isSnapEnabled() && !e.isControlDown()) {
                    dragTime = ScoreUtilities.getSnapValueMove(dragTime,
                            timeState.getSnapValue());
                }

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
        public void mouseMoved(MouseEvent e) {
            if (ModeManager.getInstance().getMode() != ScoreMode.SINGLE_LINE) {
                return;
            }

            if (currentParameter == null) {
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

        private void processHorizontalShift(int yDiff, List<LinePointOrigin> lpos) {
            for (LinePointOrigin lpo : lpos) {
                LinePoint lp = lpo.linePoint;
                Parameter param = lpo.param;
                double newY = screenToDoubleY(lpo.originY + yDiff, 
                        param.getMin(), param.getMax(), new BigDecimal(-1));
                lp.setLocation(lp.getX(), newY);
            }
        }

    }

    /* MULTILINE MODE */
//    public void addSelectionDragRegion(double startTime, double endTime) {
//        selectionList.add(new double[] {startTime, endTime});
//    }
    public void setSelectionDragRegion(double startTime, double endTime) {
        if (selectionList.size() == 0) {
            selectionList.add(new double[2]);
        }

        double[] points = selectionList.get(0);
        points[0] = startTime;
        points[1] = endTime;
        repaint();
    }

    public void clearSelectionDragRegions() {
        selectionList.clear();
        repaint();
    }

    public void setMultiLineMouseTranslation(double transTime) {
        this.transTime = transTime;
        repaint();
    }

    public void commitMultiLineDrag() {
        if (this.paramList != null
                && (marquee.intersects(this) || selectionList.size() > 0)) {
            for (int i = 0; i < this.paramList.size(); i++) {
                Parameter param = paramList.getParameter(i);
                processLineForSelectionDrag(param.getLine());
            }
        }
//        clearSelectionDragRegions();
        transTime = 0.0f;
    }

    /* SCORE MODE*/
    public void initiateScoreScale(double startTime, double endTime) {
        this.selectionStartTime = startTime;
        this.newSelectionStartTime = startTime;
        this.selectionEndTime = endTime;
        this.newSelectionEndTime = endTime;
    }

    /**
     * Used by SCORE mode for scaling points when soundObject is scaled
     *
     * @param newSelectionStartX
     */
    public void setScoreScaleStart(double newSelectionStartTime) {
        this.newSelectionStartTime = newSelectionStartTime;
        repaint();
    }

    public void setScoreScaleEnd(double newSelectionEndTime) {
        this.newSelectionEndTime = newSelectionEndTime;
        repaint();
    }

    public void commitScoreScale() {
        if (this.paramList != null) {
            for (int i = 0; i < this.paramList.size(); i++) {
                Parameter param = paramList.getParameter(i);
                processLineForSelectionScale(param.getLine());
            }

            selectionStartTime = selectionEndTime = -1;
            newSelectionStartTime = newSelectionEndTime = -1;
            transTime = 0;
        }
        repaint();
    }

    class EditPointsPopup extends JPopupMenu {

        Line line = null;

        JMenu selectParameterMenu;

        ActionListener paramItemListener;

        Action editPointsAction;

        Action importBPF;

        Action exportBPF;

        public EditPointsPopup() {

            selectParameterMenu = new JMenu("Select Parameter");

            editPointsAction = new AbstractAction("Edit Points") {

                @Override
                public void actionPerformed(ActionEvent e) {
                    Component root = SwingUtilities.getRoot(getInvoker());

                    LineEditorDialog dialog = LineEditorDialog
                            .getInstance(root);

                    dialog.setLine(line);
                    dialog.ask();
                }

            };

            paramItemListener = (ActionEvent e) -> {
                JMenuItem menuItem = (JMenuItem) e.getSource();
                Parameter param = (Parameter) menuItem
                        .getClientProperty("param");

                parameterIdList.setSelectedParameter(param.getUniqueId());
                ParameterLinePanel.this.repaint();
            };

            exportBPF = new AbstractAction("Export BPF") {

                @Override
                public void actionPerformed(ActionEvent arg0) {
                    if (line != null && line.size() > 0) {
                        File retVal = FileChooserManager.getDefault().showSaveDialog(
                                FILE_BPF_EXPORT, SwingUtilities
                                .getRoot(ParameterLinePanel.this));

                        if (retVal != null) {
                            File f = retVal;

                            try {
                                try (PrintWriter out = new PrintWriter(
                                        new FileWriter(f))) {
                                    out.print(line.exportBPF());

                                    out.flush();
                                }

                                JOptionPane.showMessageDialog(SwingUtilities
                                        .getRoot(ParameterLinePanel.this),
                                        "Line Exported as: "
                                        + f.getAbsolutePath());

                            } catch (IOException e) {
                                Exceptions.printStackTrace(e);
                            }

                        }
                    }

                }

            };

            importBPF = new AbstractAction("Import BPF") {

                @Override
                public void actionPerformed(ActionEvent arg0) {
                    if (line != null && line.size() > 0) {
                        File retVal = FileChooserManager.getDefault().showSaveDialog(
                                FILE_BPF_IMPORT, SwingUtilities
                                .getRoot(ParameterLinePanel.this));

                        if (retVal != null) {
                            File f = retVal;

                            if (!line.importBPF(f)) {
                                JOptionPane.showMessageDialog(SwingUtilities
                                        .getRoot(ParameterLinePanel.this),
                                        "Failed to import BPF from file "
                                        + f.getAbsolutePath());
                            }

                        }
                    }

                }

            };

            this.add(selectParameterMenu);
            this.add(editPointsAction);
            this.addSeparator();
            this.add(importBPF);
            this.add(exportBPF);
        }

        public void repopulate() {
            selectParameterMenu.removeAll();

            if (paramList == null || paramList.size() == 0) {
                return;
            }

            for (int i = 0; i < paramList.size(); i++) {
                Parameter param = paramList.getParameter(i);

                JMenuItem item = new JMenuItem();
                item.setText(param.getName());
                item.setEnabled(param != currentParameter);
                item.putClientProperty("param", param);
                item.addActionListener(paramItemListener);

                selectParameterMenu.add(item);
            }
        }

        public void setLine(Line line) {
            this.line = line;
        }

        @Override
        public void show(Component invoker, int x, int y) {
            if (paramList != null) {
                repopulate();

                editPointsAction.setEnabled(this.line != null);

                boolean bpfEnabled = (this.line != null)
                        && (currentParameter.getResolution().doubleValue() <= 0);

                importBPF.setEnabled(bpfEnabled);
                exportBPF.setEnabled(bpfEnabled);

                super.show(invoker, x, y);
            }
        }

    }

}
