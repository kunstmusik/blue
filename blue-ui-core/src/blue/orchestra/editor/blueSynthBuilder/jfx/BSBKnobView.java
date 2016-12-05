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
import javafx.beans.binding.Bindings;
import javafx.beans.value.ChangeListener;
import javafx.scene.layout.BorderPane;
import javafx.util.StringConverter;

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
            if(newVal) {
                setBottom(valuePanel);
            } else {
                setBottom(null);
            }
        };


        sceneProperty().addListener((obs, old, newVal) -> {
            if (newVal == null) {
                knobView.minProperty().unbind();
                knobView.maxProperty().unbind();
                knobView.valueProperty().unbindBidirectional(
                        knob.knobValueProperty().valueProperty());
                knobView.prefWidthProperty().unbind();
                knobView.prefHeightProperty().unbind();
                valuePanel.prefWidthProperty().unbind();
                knob.valueDisplayEnabledProperty().removeListener(vdeListener);
                Bindings.unbindBidirectional(valuePanel.valueProperty(),
                        knob.knobValueProperty().valueProperty());
            } else {
                knobView.minProperty().bind(knob.knobValueProperty().minProperty());
                knobView.maxProperty().bind(knob.knobValueProperty().maxProperty());
                knobView.valueProperty().bindBidirectional(
                        knob.knobValueProperty().valueProperty());
                knobView.prefWidthProperty().bind(knob.knobWidthProperty());
                knobView.prefHeightProperty().bind(knob.knobWidthProperty());
                valuePanel.prefWidthProperty().bind(knobView.prefWidthProperty());
                knob.valueDisplayEnabledProperty().addListener(vdeListener);
                Bindings.bindBidirectional(valuePanel.valueProperty(),
                        knob.knobValueProperty().valueProperty(), converter);

                if(knob.isValueDisplayEnabled()) {
                    setBottom(valuePanel);
                } else {
                    setBottom(null);
                }
            }
        });
    }

//    protected void updateKnobValue() {
//        float value = (float) knobView.getValue();
//        value = (value * (knob.getMaximum() - knob.getMinimum()))
//                + knob.getMinimum();
//        knob.setValue(value);
//        updateValueDisplay();
//    }
//    private void updateValueDisplay() {
//        double val = knob.getValue();
//
//        String strVal = NumberUtilities.formatDouble(val);
//
//        if (strVal.length() > 7) {
//            strVal = strVal.substring(0, 7);
//        }
//
//        final String v = strVal;
//
//        BlueFX.runOnFXThread(() -> valuePanel.setValue(v));
//    }
//    public void setMinimum(float minimum) {
//        if (minimum >= knob.getMaximum()) {
//            JOptionPane.showMessageDialog(null, "Error: Min value "
//                    + "can not be set greater or equals to Max value.",
//                    "Error", JOptionPane.ERROR_MESSAGE);
//            return;
//        }
//
//        String retVal = LineBoundaryDialog.getLinePointMethod();
//
//        if (retVal == null) {
//            return;
//        }
//
//        knob.setMinimum(minimum, (retVal == LineBoundaryDialog.TRUNCATE));
//
//        float newVal = (knob.getValue() - knob.getMinimum())
//                / (knob.getMaximum() - knob.getMinimum());
//
//        BlueFX.runOnFXThread(() -> knobView.setValue(newVal));
//        updateValueDisplay();
//    }
//    public float getMaximum() {
//        return knob.getMaximum();
//    }
//
//    public void setMaximum(float maximum) {
//        if (maximum <= knob.getMinimum()) {
//            JOptionPane.showMessageDialog(null, "Error: Max value "
//                    + "can not be set less than or " + "equal to Min value.",
//                    "Error", JOptionPane.ERROR_MESSAGE);
//
//            return;
//        }
//
//        String retVal = LineBoundaryDialog.getLinePointMethod();
//
//        if (retVal == null) {
//            return;
//        }
//
//        knob.setMaximum(maximum, (retVal == LineBoundaryDialog.TRUNCATE));
//        float newVal = (knob.getValue() - knob.getMinimum())
//                / (knob.getMaximum() - knob.getMinimum());
//        knobView.setValue(newVal);
//        updateValueDisplay();
//    }
//
//    public int getKnobWidth() {
//        return knob.getKnobWidth();
//    }
//
//    public void setKnobWidth(int knobWidth) {
//
////        Dimension d = new Dimension(knobWidth, knobWidth + 23);
////        this.setPreferredSize(d);
////        this.setSize(d);
//        setPrefWidth(knobWidth);
//        setPrefHeight(knobWidth + 23);
//
//        knob.setKnobWidth(knobWidth);
//
////        revalidate();
//    }
//    public boolean isRandomizable() {
//        return knob.isRandomizable();
//    }
//
//    public void setRandomizable(boolean randomizable) {
//        knob.setRandomizable(randomizable);
//    }
//    @Override
//    public void propertyChange(PropertyChangeEvent pce) {
//        if (pce.getSource() == this.knob) {
//            if (pce.getPropertyName().equals("updateValue")) {
//                updating = true;
//
//                updateValueDisplay();
//
//                float val = knob.getValue();
//
//                val = (val - knob.getMinimum())
//                        / (knob.getMaximum() - knob.getMinimum());
//
//                knobView.setValue(val);
//
//                updating = false;
//            }
//        }
//    }
}
