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
import javafx.beans.binding.Bindings;
import javafx.geometry.Orientation;
import javafx.scene.control.Slider;
import javafx.scene.layout.BorderPane;
import javafx.util.StringConverter;

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
        setRight(valuePanel);

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

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                slider.maxProperty().unbind();
                slider.minProperty().unbind();
                slider.valueProperty().unbindBidirectional(bsbHSlider.valueProperty());
                slider.prefWidthProperty().unbind();
                Bindings.unbindBidirectional(valuePanel.valueProperty(),
                        bsbHSlider.valueProperty());
            } else {
                slider.maxProperty().bind(bsbHSlider.maximumProperty());
                slider.minProperty().bind(bsbHSlider.minimumProperty());
                slider.valueProperty().bindBidirectional(bsbHSlider.valueProperty());
                slider.prefWidthProperty().bind(bsbHSlider.sliderWidthProperty());
                Bindings.bindBidirectional(valuePanel.valueProperty(),
                        bsbHSlider.valueProperty(), converter);
            }
        });
    }

}
