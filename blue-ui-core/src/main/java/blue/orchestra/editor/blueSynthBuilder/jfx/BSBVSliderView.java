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
import blue.jfx.controls.ValuePanel;
import blue.orchestra.blueSynthBuilder.BSBVSlider;
import blue.orchestra.editor.blueSynthBuilder.BSBPreferences;
import blue.utility.NumberUtilities;
import java.math.BigDecimal;
import javafx.application.Platform;
import javafx.beans.binding.Bindings;
import javafx.beans.value.ChangeListener;
import javafx.geometry.Orientation;
import javafx.scene.control.Slider;
import javafx.scene.control.Tooltip;
import javafx.scene.layout.BorderPane;
import javafx.util.StringConverter;

/**
 *
 * @author stevenyi
 */
public class BSBVSliderView extends BorderPane implements ResizeableView {

    Slider slider;
    ValuePanel valuePanel;
    BSBVSlider bsbVSlider;

    Tooltip tooltip = new Tooltip();

    public BSBVSliderView(BSBVSlider bsbVSlider) {
        setUserData(bsbVSlider);
        this.bsbVSlider = bsbVSlider;

        slider = new Slider();
        slider.setOrientation(Orientation.VERTICAL);
        slider.setPrefWidth(30.0);

        valuePanel = new ValuePanel();
        valuePanel.setPrefHeight(30.0);
        valuePanel.setPrefWidth(50.0);

        setCenter(slider);

        final ChangeListener<Boolean> vdeListener = (obs, old, newVal) -> {
            if (newVal) {
                setBottom(valuePanel);
            } else {
                setBottom(null);
            }
        };

        StringConverter<Number> converter = new StringConverter<Number>() {
            @Override
            public String toString(Number object) {
                return (object == null) ? ""
                        : NumberUtilities.formatDouble(object.doubleValue());
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

        final boolean[] val = new boolean[1];
        val[0] = false;

        final ChangeListener<Number> sliderToViewListener = (obs, old, newVal) -> {
            if (!val[0]) {
                val[0] = true;
                if (!Platform.isFxApplicationThread()) {
                    Platform.runLater(() -> {
                        try {
                            slider.setValue(bsbVSlider.getValue());
                        } finally {
                            val[0] = false;
                        }
                    });

                } else {
                    slider.setValue(bsbVSlider.getValue());
                    val[0] = false;

                }
            }
        };
        final ChangeListener<Number> viewToSliderListener = (obs, old, newVal) -> {
            if (!val[0]) {
                val[0] = true;
                bsbVSlider.setValue(slider.getValue());
                val[0] = false;
            }
        };

        final ChangeListener<Number> tickListener = (obs, old, newVal) -> {
            updateTickCount();
        };

        ChangeListener<Object> toolTipListener = (obs, old, newVal) -> {
            BlueFX.runOnFXThread(() -> {
                var comment = bsbVSlider.getComment();
                var showComments = BSBPreferences.getInstance().getShowWidgetComments();
                if (comment == null || comment.isBlank() || !showComments) {
                    slider.setTooltip(null);
                } else {
                    slider.setTooltip(tooltip);
                }
            });
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                slider.maxProperty().unbind();
                slider.minProperty().unbind();
                slider.prefWidthProperty().unbind();
                slider.valueProperty().removeListener(viewToSliderListener);
                bsbVSlider.valueProperty().removeListener(sliderToViewListener);
                bsbVSlider.valueDisplayEnabledProperty().removeListener(vdeListener);

                Bindings.unbindBidirectional(valuePanel.valueProperty(),
                        bsbVSlider.valueProperty());
                bsbVSlider.maximumProperty().removeListener(tickListener);
                bsbVSlider.minimumProperty().removeListener(tickListener);
                bsbVSlider.resolutionProperty().removeListener(tickListener);

                BSBPreferences.getInstance().showWidgetCommentsProperty()
                        .removeListener(toolTipListener);

                bsbVSlider.commentProperty().removeListener(toolTipListener);
                tooltip.textProperty().unbind();
                slider.setTooltip(null);
            } else {
                slider.maxProperty().bind(bsbVSlider.maximumProperty());
                slider.minProperty().bind(bsbVSlider.minimumProperty());
                slider.prefHeightProperty().bind(bsbVSlider.sliderHeightProperty());
                bsbVSlider.valueDisplayEnabledProperty().addListener(vdeListener);
                slider.setValue(bsbVSlider.getValue());
                slider.valueProperty().addListener(viewToSliderListener);
                bsbVSlider.valueProperty().addListener(sliderToViewListener);
                Bindings.bindBidirectional(valuePanel.valueProperty(),
                        bsbVSlider.valueProperty(), converter);

                if (bsbVSlider.isValueDisplayEnabled()) {
                    setBottom(valuePanel);
                } else {
                    setBottom(null);
                }

                slider.setMinorTickCount(0);
                updateTickCount();

                bsbVSlider.maximumProperty().addListener(tickListener);
                bsbVSlider.minimumProperty().addListener(tickListener);
                bsbVSlider.resolutionProperty().addListener(tickListener);

                BSBPreferences.getInstance().showWidgetCommentsProperty()
                        .addListener(toolTipListener);

                bsbVSlider.commentProperty().addListener(toolTipListener);
                tooltip.textProperty().bind(bsbVSlider.commentProperty());
                toolTipListener.changed(null, null, null);
            }
        });
    }

    protected void updateTickCount() {
        BigDecimal bd = bsbVSlider.getResolution();
        if (bd.doubleValue() <= 0) {
            slider.setSnapToTicks(false);
            return;
        }

        slider.setSnapToTicks(true);
        BigDecimal range = new BigDecimal(
                bsbVSlider.getMaximum() - bsbVSlider.getMinimum());

        slider.setMajorTickUnit(bsbVSlider.getResolution().doubleValue());
    }

    public boolean canResizeWidgetWidth() {
        return false;
    }

    public boolean canResizeWidgetHeight() {
        return true;
    }

    public int getWidgetMinimumWidth() {
        return -1;
    }

    public int getWidgetMinimumHeight() {
        int base = bsbVSlider.isValueDisplayEnabled() ? 30 : 0;
        return 45 + base;
    }

    public int getWidgetWidth() {
        return -1;
    }

    public void setWidgetWidth(int width) {
    }

    public int getWidgetHeight() {
        int base = bsbVSlider.isValueDisplayEnabled() ? 30 : 0;
        return base + bsbVSlider.getSliderHeight();
    }

    public void setWidgetHeight(int height) {
        int base = bsbVSlider.isValueDisplayEnabled() ? 30 : 0;
        bsbVSlider.setSliderHeight(Math.max(45, height - base));
    }

    public void setWidgetX(int x) {
    }

    public int getWidgetX() {
        return -1;
    }

    public void setWidgetY(int y) {
        bsbVSlider.setY(y);
    }

    public int getWidgetY() {
        return bsbVSlider.getY();
    }
}
