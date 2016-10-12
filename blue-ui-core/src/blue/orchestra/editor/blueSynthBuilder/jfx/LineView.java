/*
 * blue - object composition environment for csound
 * Copyright (C) 2016 stevenyi
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package blue.orchestra.editor.blueSynthBuilder.jfx;

import blue.components.DragDirection;
import blue.components.lines.Line;
import blue.components.lines.LineList;
import blue.components.lines.LinePoint;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.input.MouseEvent;
import javafx.scene.paint.Color;

/**
 *
 * @author stevenyi
 */
public class LineView extends Canvas {

    private final LineList lineList;
    Line currentLine = null;
    LinePoint selectedPoint = null;
    double leftBoundaryX = -1, rightBoundaryX = -1;
    double pressX = 0.0, pressY = 0.0;
    DragDirection direction = DragDirection.NOT_SET;

    BooleanProperty locked = new SimpleBooleanProperty(false);

    public LineView(LineList lineList) {
        this.lineList = lineList;

        repaint();

        boundsInParentProperty().addListener((obs, old, newVal) -> repaint());

        if (lineList.size() > 0) {
            setSelectedLine(lineList.get(0));
        }

        setOnMousePressed(e -> mousePressed(e));
        setOnMouseDragged(e -> mouseDragged(e));
        setOnMouseReleased(e -> mouseReleased(e));
        setOnMouseMoved(e -> mouseMoved(e));

    }

    public final void setLocked(boolean value) {
        locked.set(value);
    }

    public final boolean isLocked() {
        return locked.get();
    }

    public final BooleanProperty lockedProperty() {
        return locked;
    }

    public void setSelectedLine(Line line) {
        currentLine = line;
        repaint();
    }

    public void repaint() {
        GraphicsContext gc = getGraphicsContext2D();
        double w = getWidth();
        double h = getHeight();
        gc.setFill(Color.BLACK);
        gc.fillRect(0, 0, w, h);

        gc.setLineWidth(0.0);

        for (Line line : lineList) {
            boolean current = line == currentLine;
            Color c = current ? line.getColorFX()
                    : line.getColorFX().darker();
            gc.setStroke(c);
            gc.setFill(c);

            drawLine(line, gc, w, h);

            if (current) {
                drawPoints(line, gc, w, h);
            }
        }

        drawSelectedPoint(gc);
    }

    private void drawLine(Line line, GraphicsContext gc, double w, double h) {
        // TODO - replace with Affine transform
        double min = line.getMin();
        double max = line.getMax();

        gc.beginPath();
        for (int i = 0; i < line.size(); i++) {
            LinePoint lp = line.getLinePoint(i);
            double x = lp.getX() * w;
            double y = yToScreen(lp.getY(), min, max);

            if (i == 0) {
                gc.moveTo(x, y);
            } else {
                gc.lineTo(x, y);
                gc.stroke();
            }
        }
        gc.closePath();
    }

    private void drawPoints(Line line, GraphicsContext gc, double w, double h) {

        double min = line.getMin();
        double max = line.getMax();

        for (int i = 0; i < line.size(); i++) {
            LinePoint lp = line.getLinePoint(i);
            double x = lp.getX() * w;
            double y = yToScreen(lp.getY(), min, max);
            gc.fillRect(x - 2.5, y - 2.5, 5, 5);
        }
    }

    private void drawSelectedPoint(GraphicsContext gc) {

        if (selectedPoint != null) {
            double min = currentLine.getMin();
            double max = currentLine.getMax();

            double x = selectedPoint.getX() * getWidth();
            double y = yToScreen(selectedPoint.getY(), min, max);

            gc.setFill(Color.RED);
            gc.fillRect(x - 2.5, y - 2.5, 5, 5);

            if (currentLine != null) {
//                drawPointInformation(g2d, x, y);
            }
        }
    }

    private void mousePressed(MouseEvent me) {
        if (currentLine == null) {
            return;
        }

        pressX = me.getX();
        pressY = me.getY();

        me.consume();

        if (selectedPoint != null) {
            if (me.isSecondaryButtonDown()) {
                if (isLocked()) {
                    return;
                }

                LinePoint first = currentLine.getLinePoint(0);
                LinePoint last = currentLine.getLinePoint(currentLine
                        .size() - 1);

                if (selectedPoint != first && selectedPoint != last) {
                    currentLine.removeLinePoint(selectedPoint);
                    selectedPoint = null;
                    repaint();
                }

            } else {
                setBoundaryXValues();
            }
        } else {
            if (me.isPrimaryButtonDown()) {
                if (!isLocked()) {
                    selectedPoint = insertGraphPoint(me.getX(), me.getY());
                    repaint();
                    setBoundaryXValues();
                }
            }
        }
    }

    private void mouseMoved(MouseEvent me) {
        if (currentLine == null) {
            return;
        }

        me.consume();

        double x = me.getX();
        double y = me.getY();

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

    private void mouseReleased(MouseEvent me) {
        direction = DragDirection.NOT_SET;
        if (currentLine != null) {
            me.consume();
            repaint();
        }
    }

    private void mouseDragged(MouseEvent me) {
        if (currentLine == null || selectedPoint == null) {
            return;
        }
        me.consume();

        double x = me.getX();
        double y = me.getY();

        if (direction == DragDirection.NOT_SET) {
            double magx = Math.abs(x - pressX);
            double magy = Math.abs(y - pressY);

            direction = (magx > magy) ? DragDirection.LEFT_RIGHT
                    : DragDirection.UP_DOWN;
        }


                if(me.isControlDown()) {
                    if(direction == DragDirection.LEFT_RIGHT) {
                        y = pressY;
                    } else {
                        x = pressX; 
                    }
                }

        x = Math.min(rightBoundaryX,
                Math.max(leftBoundaryX, x));

        y = Math.min(getHeight(), Math.max(0, y));

        selectedPoint.setLocation(x / getWidth(),
                screenToY(y, currentLine.getMin(),
                        currentLine.getMax()));

        repaint();
    }

    public LinePoint findGraphPoint(double x, double y) {
        double min = currentLine.getMin();
        double max = currentLine.getMax();

        for (int i = 0; i < currentLine.size(); i++) {
            LinePoint point = currentLine.getLinePoint(i);

            double tempX = point.getX() * getWidth();
            double tempY = yToScreen(point.getY(), min, max);

            if (tempX >= x - 2 && tempX <= x + 2 && tempY >= y - 2
                    && tempY <= y + 2) {
                return point;
            }

        }

        return null;
    }

    private double yToScreen(double yVal, double min, double max) {
        double range = max - min;
        double percent = (yVal - min) / range;
        return getHeight() * (1.0 - percent);
    }

    private double screenToY(double screenY, double min, double max) {
        double p = 1 - (screenY / getHeight());
        return (p * (max - min)) + min;
    }

    private LinePoint insertGraphPoint(double x, double y) {
        if (x < 0 || x > getWidth() || y < 0 || y > getHeight()) {
            return null;
        }

        double min = currentLine.getMin();
        double max = currentLine.getMax();

        LinePoint point = new LinePoint();
        point.setLocation(x / getWidth(),
                screenToY(y, min, max));

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

    private void setBoundaryXValues() {
        if (selectedPoint == null || currentLine == null) {
            return;
        }

        int size = currentLine.size();

        if (selectedPoint == currentLine.getLinePoint(0)) {
            leftBoundaryX = 0.0;
            rightBoundaryX = 0.0;
            return;
        } else if (selectedPoint == currentLine.getLinePoint(size - 1)) {
            leftBoundaryX = getWidth();
            rightBoundaryX = getWidth();
            return;
        }

        for (int i = 0; i < size; i++) {
            if (currentLine.getLinePoint(i) == selectedPoint) {

                LinePoint p1 = currentLine.getLinePoint(i - 1);
                LinePoint p2 = currentLine.getLinePoint(i + 1);
                leftBoundaryX = p1.getX() * getWidth();
                rightBoundaryX = p2.getX() * getWidth();
                return;
            }
        }
    }
}
