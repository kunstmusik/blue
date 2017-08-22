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
package blue.soundObject.editor.sound;

import blue.components.DragDirection;
import blue.components.lines.Line;
import blue.components.lines.LineList;
import blue.components.lines.LinePoint;
import blue.jfx.BlueFX;
import java.util.Optional;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.collections.ListChangeListener;
import javafx.scene.canvas.Canvas;
import javafx.scene.canvas.GraphicsContext;
import javafx.scene.control.ButtonType;
import javafx.scene.control.ContextMenu;
import javafx.scene.control.Dialog;
import javafx.scene.control.MenuItem;
import javafx.scene.control.ScrollPane;
import javafx.scene.control.TableColumn;
import javafx.scene.control.TableView;
import javafx.scene.control.cell.PropertyValueFactory;
import javafx.scene.control.cell.TextFieldTableCell;
import javafx.scene.effect.Glow;
import javafx.scene.input.MouseEvent;
import javafx.scene.paint.Color;
import javafx.stage.Modality;
import javafx.util.converter.DoubleStringConverter;
import javax.swing.event.TableModelListener;
import org.controlsfx.tools.Utils;

/**
 *
 * @author stevenyi
 */
public class ParameterLineView extends Canvas {

    private final LineList lineList;
    ObjectProperty<Line> selectedLine = new SimpleObjectProperty<>();
    LinePoint selectedPoint = null;
    double leftBoundaryX = -1, rightBoundaryX = -1;
    double pressX = 0.0, pressY = 0.0;
    DragDirection direction = DragDirection.NOT_SET;

    BooleanProperty locked = new SimpleBooleanProperty(false);

    ContextMenu editPointsMenu = new ContextMenu();

    public ParameterLineView(LineList lineList) {
        getGraphicsContext2D().applyEffect(new Glow(0.75));
        this.lineList = lineList;

        repaint();

        boundsInParentProperty().addListener((obs, old, newVal) -> repaint());
        selectedLine.addListener((obs, old, newVal)
                -> BlueFX.runOnFXThread(() -> repaint()));

        if (lineList.size() > 0) {
            setSelectedLine(lineList.get(0));
        }

        MenuItem editPoints = new MenuItem("Edit Points");
        editPoints.setOnAction(e -> {
            BlueFX.runOnFXThread(() -> {
                editPoints();
            });
        });
        editPointsMenu.getItems().add(editPoints);

        setOnMousePressed(e -> mousePressed(e));
        setOnMouseDragged(e -> mouseDragged(e));
        setOnMouseReleased(e -> mouseReleased(e));
        setOnMouseMoved(e -> mouseMoved(e));

        ListChangeListener lcl = e -> {
            BlueFX.runOnFXThread(() -> {
                repaint();
            });
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                lineList.removeListener(lcl);
            } else {
                lineList.addListener(lcl);
            }
        });
    }

    public final void setSelectedLine(Line line) {
        selectedLine.set(line);
    }

    public final Line getSelectedLine() {
        return selectedLine.get();
    }

    public final ObjectProperty<Line> selectedLineProperty() {
        return selectedLine;
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

    public void repaint() {
        GraphicsContext gc = getGraphicsContext2D();
        double w = getWidth();
        double h = getHeight();
        gc.setFill(Color.BLACK);
        gc.fillRect(0, 0, w, h);

        gc.setLineWidth(0.0);

        for (Line line : lineList) {
            boolean current = (line == getSelectedLine());
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
            double min = getSelectedLine().getMin();
            double max = getSelectedLine().getMax();

            double x = selectedPoint.getX() * getWidth();
            double y = yToScreen(selectedPoint.getY(), min, max);

            gc.setFill(Color.RED);
            gc.fillRect(x - 2.5, y - 2.5, 5, 5);

//                drawPointInformation(g2d, x, y);
        }
    }

    private void mousePressed(MouseEvent me) {
        if (getSelectedLine() == null) {
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

                LinePoint first = getSelectedLine().getLinePoint(0);
                LinePoint last = getSelectedLine().getLinePoint(getSelectedLine()
                        .size() - 1);

                if (selectedPoint != first && selectedPoint != last) {
                    getSelectedLine().removeLinePoint(selectedPoint);
                    selectedPoint = null;
                    repaint();
                }

            } else {
                setBoundaryXValues();
            }
        } else {
            if (me.isSecondaryButtonDown()) {
                editPointsMenu.show(ParameterLineView.this, me.getScreenX(), me.getScreenY());
            } else if (me.isPrimaryButtonDown()) {
                if (!isLocked()) {
                    selectedPoint = insertGraphPoint(me.getX(), me.getY());
                    repaint();
                    setBoundaryXValues();
                }
            }
        }
    }

    private void mouseMoved(MouseEvent me) {
        if (getSelectedLine() == null) {
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
        if (getSelectedLine() != null) {
            me.consume();
            repaint();
        }
    }

    private void mouseDragged(MouseEvent me) {
        if (getSelectedLine() == null || selectedPoint == null) {
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

        if (me.isControlDown()) {
            if (direction == DragDirection.LEFT_RIGHT) {
                y = pressY;
            } else {
                x = pressX;
            }
        }

        x = Math.min(rightBoundaryX,
                Math.max(leftBoundaryX, x));

        y = Math.min(getHeight(), Math.max(0, y));

        selectedPoint.setLocation(x / getWidth(),
                screenToY(y, getSelectedLine().getMin(),
                        getSelectedLine().getMax()));

        repaint();
    }

    public LinePoint findGraphPoint(double x, double y) {
        double min = getSelectedLine().getMin();
        double max = getSelectedLine().getMax();

        for (int i = 0; i < getSelectedLine().size(); i++) {
            LinePoint point = getSelectedLine().getLinePoint(i);

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

        double min = getSelectedLine().getMin();
        double max = getSelectedLine().getMax();

        LinePoint point = new LinePoint();
        point.setLocation(x / getWidth(),
                screenToY(y, min, max));

        int index = 1;

        for (int i = 0; i < getSelectedLine().size() - 1; i++) {
            LinePoint p1 = getSelectedLine().getLinePoint(i);
            LinePoint p2 = getSelectedLine().getLinePoint(i + 1);

            if (point.getX() >= p1.getX() && point.getX() <= p2.getX()) {
                index = i + 1;
                break;
            }
        }
        getSelectedLine().addLinePoint(index, point);
        return point;
    }

    private void setBoundaryXValues() {
        if (selectedPoint == null || getSelectedLine() == null) {
            return;
        }

        int size = getSelectedLine().size();

        if (selectedPoint == getSelectedLine().getLinePoint(0)) {
            leftBoundaryX = 0.0;
            rightBoundaryX = 0.0;
            return;
        } else if (selectedPoint == getSelectedLine().getLinePoint(size - 1)) {
            leftBoundaryX = getWidth();
            rightBoundaryX = getWidth();
            return;
        }

        for (int i = 0; i < size; i++) {
            if (getSelectedLine().getLinePoint(i) == selectedPoint) {

                LinePoint p1 = getSelectedLine().getLinePoint(i - 1);
                LinePoint p2 = getSelectedLine().getLinePoint(i + 1);
                leftBoundaryX = p1.getX() * getWidth();
                rightBoundaryX = p2.getX() * getWidth();
                return;
            }
        }
    }

    private void editPoints() {
        TableView<LinePoint> table = new TableView<>();
        TableColumn<LinePoint, Double> xCol = new TableColumn<>("x");
        TableColumn<LinePoint, Double> yCol = new TableColumn<>("y");
        table.getColumns().setAll(xCol, yCol);
        table.setColumnResizePolicy(TableView.CONSTRAINED_RESIZE_POLICY);
        table.setItems(getSelectedLine().getObservableList());

        table.setEditable(true);
        xCol.setCellValueFactory(new PropertyValueFactory<LinePoint, Double>("x"));
        xCol.setCellFactory(TextFieldTableCell.forTableColumn(new DoubleStringConverter()));
        xCol.setOnEditCommit(te -> {
            LinePoint lp = te.getRowValue();
            if (getSelectedLine().getLinePoint(0) == lp
                    || getSelectedLine().getLinePoint(getSelectedLine().size() - 1) == lp) {
                return;
            }
            lp.setX(Utils.clamp(0.0, te.getNewValue(), 1.0));
        });
        xCol.setEditable(true);
        yCol.setCellValueFactory(new PropertyValueFactory<LinePoint, Double>("y"));
        yCol.setCellFactory(TextFieldTableCell.forTableColumn(new DoubleStringConverter()));
        yCol.setOnEditCommit(te -> {
            te.getRowValue().setY(
                    Utils.clamp(getSelectedLine().getMin(), te.getNewValue(), getSelectedLine().getMax()));
        });
        yCol.setEditable(true);

        Dialog<ButtonType> d = new Dialog<>();
        d.initOwner(getScene().getWindow());
        d.initModality(Modality.APPLICATION_MODAL);
        d.getDialogPane().setContent(new ScrollPane(table));
        d.getDialogPane().getStylesheets().add(BlueFX.getBlueFxCss());
        d.getDialogPane().getButtonTypes().setAll(ButtonType.OK);
        d.setTitle("Edit Points");

        TableModelListener tml = tme -> {
            repaint();
        };
        getSelectedLine().addTableModelListener(tml);

        Optional<ButtonType> res = d.showAndWait();
        getSelectedLine().removeTableModelListener(tml);
    }
}
