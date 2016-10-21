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
import blue.orchestra.blueSynthBuilder.BSBVSlider;
import javafx.beans.binding.Bindings;
import javafx.geometry.Orientation;
import javafx.scene.control.Slider;
import javafx.scene.layout.BorderPane;
import javafx.util.StringConverter;

/**
 *
 * @author stevenyi
 */
public class BSBVSliderView extends BorderPane {
    Slider slider;
    ValuePanel valuePanel;

    public BSBVSliderView(BSBVSlider bsbVSlider) {
        setUserData(bsbVSlider);

        slider = new Slider();
        slider.setOrientation(Orientation.VERTICAL);
        slider.setPrefWidth(30.0);
       
        valuePanel = new ValuePanel();
        valuePanel.setPrefHeight(30.0);
        valuePanel.setPrefWidth(50.0);

        setCenter(slider);
        setBottom(valuePanel);

        StringConverter<Number> converter = new StringConverter<Number>() {
            @Override
            public String toString(Number object) {
                return (object == null) ? "" : object.toString();
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
                slider.valueProperty().unbindBidirectional(bsbVSlider.valueProperty());
                slider.prefWidthProperty().unbind();

                Bindings.unbindBidirectional(valuePanel.valueProperty(),
                        bsbVSlider.valueProperty());
            } else {
                slider.maxProperty().bind(bsbVSlider.maximumProperty());
                slider.minProperty().bind(bsbVSlider.minimumProperty());
                slider.valueProperty().bindBidirectional(bsbVSlider.valueProperty());
                slider.prefHeightProperty().bind(bsbVSlider.sliderHeightProperty());

                Bindings.bindBidirectional(valuePanel.valueProperty(),
                        bsbVSlider.valueProperty(), converter);
            }
        });
    }
    
}
