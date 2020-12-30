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
import blue.orchestra.blueSynthBuilder.BSBHSlider;
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
public class BSBHSliderView extends BorderPane implements ResizeableView {

    Slider slider;
    ValuePanel valuePanel;
    BSBHSlider bsbHSlider;

    Tooltip tooltip = BSBTooltipUtil.createTooltip();

    public BSBHSliderView(BSBHSlider bsbHSlider) {
        setUserData(bsbHSlider);
        this.bsbHSlider = bsbHSlider;

        slider = new Slider();
        slider.setOrientation(Orientation.HORIZONTAL);
        slider.setPrefHeight(30.0);

        valuePanel = new ValuePanel();
        valuePanel.setPrefHeight(30.0);
        valuePanel.setPrefWidth(50.0);

        setCenter(slider);

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

        final ChangeListener<Boolean> vdeListener = (obs, old, newVal) -> {
            if (newVal) {
                setRight(valuePanel);
            } else {
                setRight(null);
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
                            slider.setValue(bsbHSlider.getValue());
                        } finally {
                            val[0] = false;
                        }
                    });

                } else {
                    slider.setValue(bsbHSlider.getValue());
                    val[0] = false;
                }
            }
        };
        final ChangeListener<Number> viewToSliderListener = (obs, old, newVal) -> {
            if (!val[0]) {
                val[0] = true;
                bsbHSlider.setValue(slider.getValue());
                val[0] = false;
            }
        };

        final ChangeListener<Number> tickListener = (obs, old, newVal) -> {
            updateTickCount();
        };

        ChangeListener<Object> toolTipListener = (obs, old, newVal) -> {
            BlueFX.runOnFXThread(() -> {
                var comment = bsbHSlider.getComment();
                var showComments = BSBPreferences.getInstance().getShowWidgetComments();
                if (comment == null || comment.isBlank() || !showComments) {
                    BSBTooltipUtil.install(this, null);
                } else {
                    BSBTooltipUtil.install(this, tooltip);
                }
            });
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                slider.maxProperty().unbind();
                slider.minProperty().unbind();
                slider.prefWidthProperty().unbind();
                slider.valueProperty().removeListener(viewToSliderListener);
                bsbHSlider.valueProperty().removeListener(sliderToViewListener);
                bsbHSlider.valueDisplayEnabledProperty().removeListener(vdeListener);
                Bindings.unbindBidirectional(valuePanel.valueProperty(),
                        bsbHSlider.valueProperty());
                bsbHSlider.maximumProperty().removeListener(tickListener);
                bsbHSlider.minimumProperty().removeListener(tickListener);
                bsbHSlider.resolutionProperty().removeListener(tickListener);

                BSBPreferences.getInstance().showWidgetCommentsProperty()
                        .removeListener(toolTipListener);

                bsbHSlider.commentProperty().removeListener(toolTipListener);
                tooltip.textProperty().unbind();
                BSBTooltipUtil.install(this, null);
            } else {
                slider.maxProperty().bind(bsbHSlider.maximumProperty());
                slider.minProperty().bind(bsbHSlider.minimumProperty());
                slider.prefWidthProperty().bind(bsbHSlider.sliderWidthProperty());
                bsbHSlider.valueDisplayEnabledProperty().addListener(vdeListener);
                slider.setValue(bsbHSlider.getValue());
                slider.valueProperty().addListener(viewToSliderListener);
                bsbHSlider.valueProperty().addListener(sliderToViewListener);
                Bindings.bindBidirectional(valuePanel.valueProperty(),
                        bsbHSlider.valueProperty(), converter);

                if (bsbHSlider.isValueDisplayEnabled()) {
                    setRight(valuePanel);
                } else {
                    setRight(null);
                }

                slider.setMinorTickCount(0);
                updateTickCount();

                bsbHSlider.maximumProperty().addListener(tickListener);
                bsbHSlider.minimumProperty().addListener(tickListener);
                bsbHSlider.resolutionProperty().addListener(tickListener);

                BSBPreferences.getInstance().showWidgetCommentsProperty()
                        .addListener(toolTipListener);

                bsbHSlider.commentProperty().addListener(toolTipListener);
                tooltip.textProperty().bind(bsbHSlider.commentProperty());
                toolTipListener.changed(null, null, null);
            }
        });
    }

    protected void updateTickCount() {
        BigDecimal bd = bsbHSlider.getResolution();
        if (bd.doubleValue() <= 0) {
            slider.setSnapToTicks(false);
            return;
        }

        slider.setSnapToTicks(true);
        BigDecimal range = new BigDecimal(
                bsbHSlider.getMaximum() - bsbHSlider.getMinimum());

        slider.setMajorTickUnit(bsbHSlider.getResolution().doubleValue());
    }

    public boolean canResizeWidgetWidth() {
        return true;
    }

    public boolean canResizeWidgetHeight() {
        return false;
    }

    public int getWidgetMinimumWidth() {
        int base = bsbHSlider.isValueDisplayEnabled() ? 50 : 0;
        return 45 + base;
    }

    public int getWidgetMinimumHeight() {
        return -1;
    }

    public int getWidgetWidth() {
        int base = bsbHSlider.isValueDisplayEnabled() ? 50 : 0;
        return base + bsbHSlider.getSliderWidth();
    }

    public void setWidgetWidth(int width) {
        int base = bsbHSlider.isValueDisplayEnabled() ? 50 : 0;
        bsbHSlider.setSliderWidth(Math.max(45, width - base));
    }

    public int getWidgetHeight() {
        return -1;
    }

    public void setWidgetHeight(int height) {
    }

    public void setWidgetX(int x) {
        bsbHSlider.setX(x);
    }

    public int getWidgetX() {
        return bsbHSlider.getX();
    }

    public void setWidgetY(int y) {
    }

    public int getWidgetY() {
        return -1;
    }
}
