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

import blue.jfx.controls.ValuePanel;
import blue.orchestra.blueSynthBuilder.BSBHSlider;
import blue.utility.NumberUtilities;
import java.util.concurrent.CountDownLatch;
import javafx.application.Platform;
import javafx.beans.binding.Bindings;
import javafx.beans.value.ChangeListener;
import javafx.geometry.Orientation;
import javafx.scene.control.Slider;
import javafx.scene.layout.BorderPane;
import javafx.util.StringConverter;
import org.openide.util.Exceptions;

/**
 *
 * @author stevenyi
 */
public class BSBHSliderView extends BorderPane {

    Slider slider;
    ValuePanel valuePanel;

    public BSBHSliderView(BSBHSlider bsbHSlider) {
        setUserData(bsbHSlider);

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
            if(newVal) {
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
                    CountDownLatch latch = new CountDownLatch(1);
                    Platform.runLater(() -> {
                        slider.setValue(bsbHSlider.getValue());
                        latch.countDown();
                    });
                    try {
                        latch.await();
                    } catch (InterruptedException ex) {
                        Exceptions.printStackTrace(ex);
                    }
                } else {
                    slider.setValue(bsbHSlider.getValue());
                }
                val[0] = false;
            }
        };
        final ChangeListener<Number> viewToSliderListener = (obs, old, newVal) -> {
            if (!val[0]) {
                val[0] = true;
                bsbHSlider.setValue(slider.getValue());
                val[0] = false;
            }
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
            } else {
                slider.maxProperty().bind(bsbHSlider.maximumProperty());
                slider.minProperty().bind(bsbHSlider.minimumProperty());
                slider.prefWidthProperty().bind(bsbHSlider.sliderWidthProperty());
                bsbHSlider.valueDisplayEnabledProperty().addListener(vdeListener);
                slider.valueProperty().addListener(viewToSliderListener);
                bsbHSlider.valueProperty().addListener(sliderToViewListener);
                Bindings.bindBidirectional(valuePanel.valueProperty(),
                        bsbHSlider.valueProperty(), converter);

                if(bsbHSlider.isValueDisplayEnabled()) {
                    setRight(valuePanel);
                } else {
                    setRight(null);
                }
            }
        });
    }

}
