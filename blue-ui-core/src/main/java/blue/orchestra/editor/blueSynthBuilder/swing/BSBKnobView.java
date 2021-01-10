/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2004 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.editor.blueSynthBuilder.swing;

import blue.jfx.BlueFX;
import blue.jfx.controls.Knob;
import blue.jfx.controls.ValuePanel;
import blue.orchestra.blueSynthBuilder.BSBKnob;
import blue.utility.NumberUtilities;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import javafx.application.Platform;
import javafx.embed.swing.JFXPanel;
import javafx.scene.Scene;
import javafx.scene.layout.BorderPane;
import javax.swing.event.ChangeEvent;
import javax.swing.event.ChangeListener;

/**
 * @author steven
 *
 * To change the template for this generated type comment go to Window -
 * Preferences - Java - Code Generation - Code and Comments
 */
public class BSBKnobView extends BSBObjectView<BSBKnob> implements
        PropertyChangeListener {

    private static final int VALUE_HEIGHT = 14;
    
    Knob knobView;
    JFXPanel knobPanel;
    BorderPane pane;

    ValuePanel valuePanel;

    ChangeListener cl;
    boolean updating = false;

    /**
     * @param knob
     */
    public BSBKnobView(BSBKnob knob) {
        super(knob);
        updating = true;

//        knobPanel = new JFXPanel();
//        
//        Platform.runLater(() -> {
//
//            pane = new BorderPane();
//            
//            knobView = new Knob();
//            valuePanel = new ValuePanel();
//            valuePanel.setValidator(v ->  {
//                try {
//                    float f = Float.parseFloat(v);
//                    return (f >= knob.getMinimum() && f <= knob.getMaximum());
//                } catch (NumberFormatException nfe) {
//                    return false;
//                }
//            });
//
//            pane.setCenter(knobView);
//            pane.setBottom(valuePanel);
//            
//            final Scene scene = new Scene(pane);
//            BlueFX.style(scene);
//            knobPanel.setScene(scene);
//
//
//            double val = knob.getValue();
//            val = (val - knob.getMinimum())
//                    / (knob.getMaximum() - knob.getMinimum());
//
//            knobView.setValue(val);
//
//            knobView.valueProperty().addListener((obs, o, n) -> {
//                if(!updating) {
//                    updateKnobValue();
//                }
//            });
//
//            valuePanel.valueProperty().addListener((obs, o, n) -> {
//                double newVal = (Double.parseDouble(n) - knob.getMinimum())
//                        / (knob.getMaximum() - knob.getMinimum());
//
//                knobView.setValue(newVal); 
//            });
//
//            updateValueDisplay();
//        });
//
//
//        cl = (ChangeEvent e) -> {
//            if (!updating) {
//                updateKnobValue();
//            }
//        };
//
//        setKnobWidth(knob.getKnobWidth());
//
//        this.setLayout(new BorderLayout());
//        this.add(knobPanel, BorderLayout.CENTER);
//
//        
//        revalidate();
//
//        knob.addPropertyChangeListener(this);
        updating = false;
    }

    protected void updateKnobValue() {
        double value = (float)knobView.getValue();
        var knob = getBSBObject();
        value = (value * (knob.getMaximum() - knob.getMinimum()))
                + knob.getMinimum();
        knob.setValue(value);
        updateValueDisplay();

    }

    private void updateValueDisplay() {
        var knob = getBSBObject();
        double val = knob.getValue();

        String strVal = NumberUtilities.formatDouble(val);

        if (strVal.length() > 7) {
            strVal = strVal.substring(0, 7);
        }

        final String v = strVal;

        BlueFX.runOnFXThread(() -> valuePanel.setValue(v));

    }

//    public float getMinimum() {
//        return knob.getMinimum();
//    }
//
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
//
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

//    public int getKnobWidth() {
//        return knob.getKnobWidth();
//    }

    public void setKnobWidth(int knobWidth) {

        Dimension d = new Dimension(knobWidth, knobWidth + 23);

        this.setPreferredSize(d);
        this.setSize(d);

        getBSBObject().setKnobWidth(knobWidth);

        revalidate();
    }

    @Override
    public void propertyChange(PropertyChangeEvent pce) {
        if (pce.getSource() == getBSBObject()) {
            if (pce.getPropertyName().equals("updateValue")) {
                updating = true;

                updateValueDisplay();
                
                var knob = getBSBObject();
                double val = knob.getValue();

                val = (val - knob.getMinimum())
                        / (knob.getMaximum() - knob.getMinimum());

                knobView.setValue(val);

                updating = false;
            }
        }
    }
    
    

//    @Override
//    public void cleanup() {
//        knob.removePropertyChangeListener(this);
//    }

    @Override
    public Dimension getPreferredSize() {
        return new Dimension(bsbObj.getKnobWidth(), bsbObj.getKnobWidth() + VALUE_HEIGHT)
        ;
    }
}
