/*
 * blue - object composition environment for csound
 * Copyright (C) 2016
 * Steven Yi <stevenyi@gmail.com>
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

import blue.jfx.BlueFX;
import blue.orchestra.blueSynthBuilder.BSBXYController;
import blue.orchestra.blueSynthBuilder.ClampedValue;
import javafx.beans.value.ChangeListener;
import javafx.scene.control.Label;
import javafx.scene.layout.BorderPane;
import javafx.scene.layout.Pane;
import javafx.scene.paint.Color;
import javafx.scene.shape.Rectangle;
import javafx.scene.text.Font;

/**
 *
 * @author stevenyi
 */
public class BSBXYControllerView extends BorderPane {

    private final BSBXYController bsbXYController;
    private final Pane pane = new Pane();
    Rectangle yLine = new Rectangle();
    Rectangle xLine = new Rectangle();
    Rectangle rect = new Rectangle(3, 3);
    Label label = new Label();

    public BSBXYControllerView(BSBXYController bsbXYController) {
        setUserData(bsbXYController);

        this.bsbXYController = bsbXYController;

        pane.setStyle("-fx-background-color: black");

        label.setFont(new Font(10));
        label.setTextFill(Color.WHITE);

        setCenter(pane);
        setBottom(label);

        yLine.setX(0);
        yLine.setHeight(1.0);
        yLine.setFill(Color.WHITE);

        xLine.setY(0);
        xLine.setWidth(1.0);

        xLine.setFill(Color.WHITE);

        rect.setFill(Color.color(0, 1.0, 0));

        pane.getChildren().addAll(xLine, yLine, rect);
        pane.setOnMousePressed(me -> {
            bsbXYController.xValueProperty().setNormalizedValue(
                    me.getX() / pane.getWidth()
            );
            bsbXYController.yValueProperty().setNormalizedValue(
                    1.0 - (me.getY() / pane.getHeight())
            );
        });
        pane.setOnMouseDragged(me -> {
            if (me.getSource() == pane) {
                bsbXYController.xValueProperty().setNormalizedValue(
                        me.getX() / pane.getWidth()
                );
                bsbXYController.yValueProperty().setNormalizedValue(
                        1.0 - (me.getY() / pane.getHeight())
                );
            }
        });

        ChangeListener<Number> labelListener = (obs, old, newVal) -> {
            Runnable r = () -> updateLabel();
            BlueFX.runOnFXThread(r);
        };

        ChangeListener<Number> yListener = (obs, old, newVal) -> {
            Runnable r = () -> updateUIforY();
            BlueFX.runOnFXThread(r);
        };

        ChangeListener<Number> xListener = (obs, old, newVal) -> {
            Runnable r = () -> updateUIforX();
            BlueFX.runOnFXThread(r);
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                pane.prefWidthProperty().unbind();
                pane.prefHeightProperty().unbind();
                label.prefWidthProperty().unbind();
                yLine.widthProperty().unbind();
                xLine.heightProperty().unbind();

                unbindClampedValue(bsbXYController.xValueProperty(), labelListener);
                unbindClampedValue(bsbXYController.xValueProperty(), xListener);
                unbindClampedValue(bsbXYController.yValueProperty(), labelListener);
                unbindClampedValue(bsbXYController.yValueProperty(), yListener);
            } else {

                pane.prefWidthProperty().bind(bsbXYController.widthProperty());
                pane.prefHeightProperty().bind(bsbXYController.heightProperty());
                label.prefWidthProperty().bind(pane.prefWidthProperty());
                yLine.widthProperty().bind(pane.widthProperty());
                xLine.heightProperty().bind(pane.heightProperty());

                updateLabel();
                updateUIforX();
                updateUIforY();

                bindClampedValue(bsbXYController.xValueProperty(), labelListener);
                bindClampedValue(bsbXYController.xValueProperty(), xListener);
                bindClampedValue(bsbXYController.yValueProperty(), labelListener);
                bindClampedValue(bsbXYController.yValueProperty(), yListener);
            }
        });
    }

    private void bindClampedValue(ClampedValue v, ChangeListener<? super Number> listener) {
        v.valueProperty().addListener(listener);
        v.minProperty().addListener(listener);
        v.maxProperty().addListener(listener);
    }

    private void unbindClampedValue(ClampedValue v, ChangeListener<? super Number> listener) {
        v.valueProperty().removeListener(listener);
        v.minProperty().removeListener(listener);
        v.maxProperty().removeListener(listener);
    }

    private void updateUIforX() {
        double percent = bsbXYController.xValueProperty().getNormalizedValue();
        xLine.setX(pane.getPrefWidth() * percent);
        rect.setX((int) (percent * pane.getPrefWidth()) - 1.0);
    }

    private void updateUIforY() {
        double percent = bsbXYController.yValueProperty().getNormalizedValue();
        yLine.setY(Math.floor(pane.getPrefHeight() * (1 - percent)));
        rect.setY((int) ((1.0 - percent) * pane.getPrefHeight()) - 1.0);
    }

    private void updateLabel() {
        label.setText(String.format("x: %.4g y: %.4g",
                bsbXYController.getXValue(),
                bsbXYController.getYValue()));
    }
}
