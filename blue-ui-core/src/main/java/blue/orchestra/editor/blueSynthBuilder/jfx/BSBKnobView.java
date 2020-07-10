/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2016 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.editor.blueSynthBuilder.jfx;

import blue.jfx.controls.Knob;
import blue.jfx.controls.ValuePanel;
import blue.orchestra.blueSynthBuilder.BSBKnob;
import blue.orchestra.editor.blueSynthBuilder.BSBPreferences;
import blue.utility.NumberUtilities;
import javafx.application.Platform;
import javafx.beans.binding.Bindings;
import javafx.beans.binding.IntegerBinding;
import javafx.beans.value.ChangeListener;
import javafx.beans.value.ObservableValue;
import javafx.geometry.Pos;
import javafx.scene.Scene;
import javafx.scene.control.Label;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.BorderPane;
import javafx.util.StringConverter;

/**
 * @author steven
 *
 */
public class BSBKnobView extends BorderPane implements ResizeableView {

    private static final int VALUE_HEIGHT = 14;
    BSBKnob knob;

    Knob knobView;

    ValuePanel valuePanel;
    Label label;

    Tooltip tooltip = BSBTooltipUtil.createTooltip();

    /**
     * @param knob
     */
    public BSBKnobView(BSBKnob knob) {
        setUserData(knob);

        this.knob = knob;

        label = new Label();
        label.setStyle("-fx-fill: white; "
                + "-fx-font-smooth-type: lcd");
        label.setAlignment(Pos.CENTER);
        label.setMaxWidth(Double.POSITIVE_INFINITY);

        knobView = new Knob();
        valuePanel = new ValuePanel();
        valuePanel.setValidator(v -> {
            try {
                double f = Double.parseDouble(v);
                return (f >= knob.getMinimum() && f <= knob.getMaximum());
            } catch (NumberFormatException nfe) {
                return false;
            }
        });

        this.setCenter(knobView);

        valuePanel.setPrefHeight(VALUE_HEIGHT);
        BorderPane.setAlignment(valuePanel, Pos.CENTER);

        StringConverter<Number> converter = new StringConverter<Number>() {
            @Override
            public String toString(Number object) {
                return (object == null) ? "" : NumberUtilities.formatDouble(object.doubleValue());
            }

            @Override
            public Number fromString(String string) {
                try {
                    return Double.parseDouble(string);
                } catch (NumberFormatException nfe) {
                    return 0.0;
                }
            }

        };
        final ChangeListener<Boolean> vdeListener = (obs, old, newVal) -> {
            if (newVal) {
                setBottom(valuePanel);
            } else {
                setBottom(null);
            }
        };
        final ChangeListener<Boolean> labelEnabledListener = (obs, old, newVal) -> {
            if (newVal) {
                setTop(label);
            } else {
                setTop(null);
            }
        };

        final boolean[] val = new boolean[1];
        val[0] = false;

        final ChangeListener<Number> knobToViewListener = (obs, old, newVal) -> {
            if (!val[0]) {
                val[0] = true;
                if (!Platform.isFxApplicationThread()) {
                    Platform.runLater(() -> {
                        try {
                            knobView.setValue(knob.getValue());
                        } finally {
                            val[0] = false;
                        }
                    });

                } else {
                    knobView.setValue(knob.getValue());
                    val[0] = false;
                }
            }
        };
        final ChangeListener<Number> viewToKnobListener = (obs, old, newVal) -> {
            if (!val[0]) {
                val[0] = true;
                knob.setValue(knobView.getValue());
                val[0] = false;
            }
        };

        IntegerBinding knobViewHeight = knob.knobWidthProperty().subtract(4);

        sceneProperty().addListener((ObservableValue<? extends Scene> obs, Scene old, Scene newVal) -> {
            if (newVal == null) {
                knobView.minProperty().unbind();
                knobView.maxProperty().unbind();
                knob.knobValueProperty().valueProperty().removeListener(knobToViewListener);
                knobView.valueProperty().removeListener(viewToKnobListener);
                knobView.prefWidthProperty().unbind();
                knobView.prefHeightProperty().unbind();
                valuePanel.prefWidthProperty().unbind();
                valuePanel.maxWidthProperty().unbind();
                knob.valueDisplayEnabledProperty().removeListener(vdeListener);
                knob.labelEnabledProperty().removeListener(labelEnabledListener);
                Bindings.unbindBidirectional(valuePanel.valueProperty(),
                        knob.knobValueProperty().valueProperty());
                label.textProperty().unbind();
                label.fontProperty().unbind();
                tooltip.textProperty().unbind();
            } else {
                knobView.minProperty().bind(knob.knobValueProperty().minProperty());
                knobView.maxProperty().bind(knob.knobValueProperty().maxProperty());
                knobView.prefWidthProperty().bind(knob.knobWidthProperty());
                knobView.prefHeightProperty().bind(knobViewHeight);
                knobView.setValue(knob.getValue());
                knobView.minWidthProperty().bind(knobView.prefWidthProperty());
                knobView.minHeightProperty().bind(knobView.prefHeightProperty());
                knobView.maxWidthProperty().bind(knob.knobWidthProperty());
                knobView.maxHeightProperty().bind(knobViewHeight);
                valuePanel.prefWidthProperty().bind(knobView.prefWidthProperty());
                valuePanel.maxWidthProperty().bind(knob.knobWidthProperty());
                knob.valueDisplayEnabledProperty().addListener(vdeListener);
                knob.labelEnabledProperty().addListener(labelEnabledListener);
                knob.knobValueProperty().valueProperty().addListener(knobToViewListener);
                knobView.valueProperty().addListener(viewToKnobListener);
                Bindings.bindBidirectional(valuePanel.valueProperty(),
                        knob.knobValueProperty().valueProperty(), converter);

                label.textProperty().bind(knob.labelProperty());
                label.fontProperty().bind(knob.labelFontProperty());

                if (knob.isValueDisplayEnabled()) {
                    setBottom(valuePanel);
                } else {
                    setBottom(null);
                }
                if (knob.isLabelEnabled()) {
                    setTop(label);
                } else {
                    setTop(null);
                }

                var showCommentsProperty = BSBPreferences.getInstance().showWidgetCommentsProperty();
            
                tooltip.textProperty().bind(
                        Bindings.when(Bindings.or(knob.commentProperty().isEmpty(), showCommentsProperty.not()))
                                .then(Bindings.format("Value: %s", knobView.valueProperty().asString())
                                ).otherwise(
                                        Bindings.format("Value: %s\n\n%s", knobView.valueProperty().asString(), knob.commentProperty())
                                ));

            }
        });

        knobView.setTooltip(tooltip);
    }

    public boolean canResizeWidgetWidth() {
        return true;
    }

    public boolean canResizeWidgetHeight() {
        return true;
    }

    public int getWidgetMinimumWidth() {
        return 20;
    }

    public int getWidgetMinimumHeight() {
        int h = 20;
        if (knob.isValueDisplayEnabled()) {
            h += (int) valuePanel.getHeight();
        }
        if (knob.isLabelEnabled()) {
            h += (int) label.getHeight();
        }
        return h;
    }

    public int getWidgetWidth() {
        return knob.getKnobWidth();
    }

    public void setWidgetWidth(int width) {
        knob.setKnobWidth(Math.max(20, width));
    }

    public int getWidgetHeight() {
        return (int) getHeight();
    }

    public void setWidgetHeight(int height) {
        int h = height;
        if (knob.isValueDisplayEnabled()) {
            h -= (int) valuePanel.getHeight();
        }
        if (knob.isLabelEnabled()) {
            h -= (int) label.getHeight();
        }

        knob.setKnobWidth(Math.max(20, h));
    }

    public void setWidgetX(int x) {
        knob.setX(x);
    }

    public int getWidgetX() {
        return knob.getX();
    }

    public void setWidgetY(int y) {
        knob.setY(y);
    }

    public int getWidgetY() {
        return knob.getY();
    }
}
