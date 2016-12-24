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
import blue.utility.NumberUtilities;
import java.util.concurrent.CountDownLatch;
import javafx.application.Platform;
import javafx.beans.binding.Bindings;
import javafx.beans.value.ChangeListener;
import javafx.scene.layout.BorderPane;
import javafx.util.StringConverter;
import org.openide.util.Exceptions;

/**
 * @author steven
 *
 */
public class BSBKnobView extends BorderPane {

    private static final int VALUE_HEIGHT = 14;
    BSBKnob knob;

    Knob knobView;

    ValuePanel valuePanel;

    /**
     * @param knob
     */
    public BSBKnobView(BSBKnob knob) {
        setUserData(knob);

        this.knob = knob;

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

        final boolean[] val = new boolean[1];
        val[0] = false;

        final ChangeListener<Number> knobToViewListener = (obs, old, newVal) -> {
            if (!val[0]) {
                val[0] = true;
                if (!Platform.isFxApplicationThread()) {
                    CountDownLatch latch = new CountDownLatch(1);
                    Platform.runLater(() -> {
                        try {
                            knobView.setValue(knob.getValue());
                        } finally {
                            latch.countDown();
                        }
                    });
                    try {
                        latch.await();
                    } catch (InterruptedException ex) {
                        Exceptions.printStackTrace(ex);
                    }
                } else {
                    knobView.setValue(knob.getValue());
                }
                val[0] = false;
            }
        };
        final ChangeListener<Number> viewToKnobListener = (obs, old, newVal) -> {
            if (!val[0]) {
                val[0] = true;
                knob.setValue(knobView.getValue());
                val[0] = false;
            }
        };

        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                knobView.minProperty().unbind();
                knobView.maxProperty().unbind();
                knob.knobValueProperty().valueProperty().removeListener(knobToViewListener);
                knobView.valueProperty().removeListener(viewToKnobListener);
                knobView.prefWidthProperty().unbind();
                knobView.prefHeightProperty().unbind();
                valuePanel.prefWidthProperty().unbind();
                knob.valueDisplayEnabledProperty().removeListener(vdeListener);
                Bindings.unbindBidirectional(valuePanel.valueProperty(),
                        knob.knobValueProperty().valueProperty());
            } else {
                knobView.setValue(knob.getValue());
                knobView.minProperty().bind(knob.knobValueProperty().minProperty());
                knobView.maxProperty().bind(knob.knobValueProperty().maxProperty());
                knobView.prefWidthProperty().bind(knob.knobWidthProperty());
                knobView.prefHeightProperty().bind(knob.knobWidthProperty());
                valuePanel.prefWidthProperty().bind(knobView.prefWidthProperty());
                knob.valueDisplayEnabledProperty().addListener(vdeListener);
                knob.knobValueProperty().valueProperty().addListener(knobToViewListener);
                knobView.valueProperty().addListener(viewToKnobListener);
                Bindings.bindBidirectional(valuePanel.valueProperty(),
                        knob.knobValueProperty().valueProperty(), converter);

                if (knob.isValueDisplayEnabled()) {
                    setBottom(valuePanel);
                } else {
                    setBottom(null);
                }
            }
        });
    }
}
