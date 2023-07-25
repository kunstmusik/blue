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

import blue.components.Knob;
import blue.orchestra.blueSynthBuilder.BSBKnob;
import blue.ui.utilities.UiUtilities;
import blue.utilities.scales.ScaleLinear;
import blue.utility.NumberUtilities;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.GridBagConstraints;
import java.awt.GridBagLayout;
import javafx.beans.value.ChangeListener;
import javax.swing.JLabel;
import javax.swing.ToolTipManager;

/**
 * @author steven
 */
public class BSBKnobView extends BSBObjectView<BSBKnob> implements ResizeableView {

    private static final int VALUE_HEIGHT = 14;

    JLabel label;
    Knob knobView;

    ValuePanel valuePanel;

    volatile boolean updating = false;

    ScaleLinear scale;

    ChangeListener<Number> minMaxListener;
    ChangeListener<Number> valueListener;
    ChangeListener<Number> knobWidthListener;
    ChangeListener<Boolean> vdeListener;
    ChangeListener<Boolean> labelEnabledListener;
    ChangeListener<String> labelListener;
    ChangeListener<Font> labelFontListener;

    /**
     * @param knob
     */
    public BSBKnobView(BSBKnob knob) {
        super(knob);
        updating = true;

        label = new JLabel(knob.getLabel());
        knobView = new Knob(bsbObj.getKnobWidth());
        valuePanel = new ValuePanel();

        label.setHorizontalAlignment(JLabel.CENTER);
        label.setFont(knob.getLabelFont());

        knobView.addChangeListener(ce -> {
            if (!updating) {
                updating = true;
                var val = scale.calcReverse(knobView.getValue());
                bsbObj.setValue(val);
                updating = false;
            }
        });

        setLayout(new GridBagLayout());
        var gbc = new GridBagConstraints();

        gbc.fill = GridBagConstraints.HORIZONTAL;
        gbc.gridx = 0;
        gbc.gridy = 0;
        add(label, gbc);

        gbc.fill = GridBagConstraints.NONE;
        gbc.gridy = 1;
        add(knobView, gbc);

        gbc.gridy = 2;
        add(valuePanel, gbc);

        scale = new ScaleLinear(bsbObj.getMinimum(), bsbObj.getMaximum(), 0.0, 1.0);

        knobView.setVal(scale.calc(bsbObj.getValue()));

        label.setVisible(bsbObj.isLabelEnabled());
        valuePanel.setVisible(bsbObj.isValueDisplayEnabled());
        valuePanel.addPropertyChangeListener(evt -> {
            if (updating) {
                return;
            }

            if ("value".equals(evt.getPropertyName())) {
                updating = true;
                try {
                    double val = Double.parseDouble(valuePanel.getPendingValue());

                    bsbObj.setValue(val);
                    knobView.setVal(scale.calc(val));
                } catch (NumberFormatException nfe) {
                    // ignore
                } finally {
                    updating = false;
                }
            }
        });

        updateValueDisplay();

        updating = false;

        minMaxListener = (obs, old, newVal) -> {
            scale.setDomain(knob.getMinimum(), knob.getMaximum());
            knobView.setVal(scale.calc(knob.getValue()));
            updateValueDisplay();
        };
        valueListener = (obs, old, newVal) -> {
            if (!updating) {
                knobView.setVal(scale.calc(knob.getValue()));
            }
            updateValueDisplay();
        };
        knobWidthListener = (obs, old, newVal) -> {
            var d = new Dimension(newVal.intValue(), newVal.intValue());
            knobView.setSize(d);
            knobView.setPreferredSize(d);

            d = new Dimension(newVal.intValue(), VALUE_HEIGHT);
            valuePanel.setSize(d);
            valuePanel.setPreferredSize(d);

            setSize(getPreferredSize());
            revalidate();
        };
        vdeListener = (obs, old, newVal) -> {
            valuePanel.setVisible(newVal);
            setSize(getPreferredSize());
            revalidate();
        };
        labelEnabledListener = (obs, old, newVal) -> {
            label.setVisible(newVal);
            setSize(getPreferredSize());
            revalidate();
        };
        labelListener = (obs, old, newVal) -> {
            label.setText(newVal);
            setSize(getPreferredSize());
            revalidate();
        };
        labelFontListener = (obs, old, newVal) -> {
            label.setFont(newVal);
            setSize(getPreferredSize());
            revalidate();
        };

        Dimension prefSize = new Dimension(bsbObj.getKnobWidth(), bsbObj.getKnobWidth());
        knobView.setPreferredSize(prefSize);
        knobView.setSize(prefSize);

        var d = new Dimension(bsbObj.getKnobWidth(), VALUE_HEIGHT);
        valuePanel.setSize(d);
        valuePanel.setPreferredSize(d);

        setSize(getPreferredSize());

                ToolTipManager.sharedInstance().registerComponent(knobView);

        revalidate();
    }
    
     @Override
            public String getToolTipText() {
                return shouldShowToolTip()
                        ? NumberUtilities.formatDouble(bsbObj.getValue()) : "";
                
            }

    @Override
    public void addNotify() {
        super.addNotify();

//        bsbObj.valueDisplayEnabledProperty().addListener(vdeListener);
//        bsbObj.min().addListener(vdeListener);
        var valProp = bsbObj.knobValueProperty();
        valProp.valueProperty().addListener(valueListener);
        valProp.minProperty().addListener(minMaxListener);
        valProp.maxProperty().addListener(minMaxListener);
        bsbObj.knobWidthProperty().addListener(knobWidthListener);
        bsbObj.valueDisplayEnabledProperty().addListener(vdeListener);
        bsbObj.labelEnabledProperty().addListener(labelEnabledListener);
        bsbObj.labelProperty().addListener(labelListener);
        bsbObj.labelFontProperty().addListener(labelFontListener);

        setSize(getPreferredSize());
//        revalidate();
//        repaint();
    }

    @Override
    public void removeNotify() {
        super.removeNotify();

        var valProp = bsbObj.knobValueProperty();
        valProp.valueProperty().removeListener(valueListener);
        valProp.minProperty().removeListener(minMaxListener);
        valProp.maxProperty().removeListener(minMaxListener);
        bsbObj.knobWidthProperty().removeListener(knobWidthListener);
        bsbObj.valueDisplayEnabledProperty().removeListener(vdeListener);
        bsbObj.labelEnabledProperty().removeListener(labelEnabledListener);
        bsbObj.labelProperty().removeListener(labelListener);
        bsbObj.labelFontProperty().removeListener(labelFontListener);
    }

    protected void updateKnobValue() {

        double viewValue = (float) knobView.getValue();
        double value = scale.calc(viewValue);
        bsbObj.setValue(value);

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

        UiUtilities.invokeOnSwingThread(() -> valuePanel.setValue(v));
    }

    @Override
    public Dimension getPreferredSize() {

        int height = bsbObj.getKnobWidth();
        if (bsbObj.isLabelEnabled()) {
            height += label.getPreferredSize().height;
        }
        if (bsbObj.isValueDisplayEnabled()) {
            height += VALUE_HEIGHT;
        }

        int width = Math.max(bsbObj.getKnobWidth(), (int) label.getPreferredSize().getWidth());
        return new Dimension(width, height);

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
        if (bsbObj.isValueDisplayEnabled()) {
            h += (int) valuePanel.getHeight();
        }
        if (bsbObj.isLabelEnabled()) {
            h += (int) label.getHeight();
        }
        return h;
    }

    public int getWidgetWidth() {
        return bsbObj.getKnobWidth();
    }

    public void setWidgetWidth(int width) {
        bsbObj.setKnobWidth(Math.max(20, width));
    }

    public int getWidgetHeight() {
        int h = bsbObj.getKnobWidth();
        if (bsbObj.isValueDisplayEnabled()) {
            h += (int) valuePanel.getHeight();
        }
        if (bsbObj.isLabelEnabled()) {
            h += (int) label.getHeight();
        }
        return h;
    }

    public void setWidgetHeight(int height) {
        int h = height;
        if (bsbObj.isValueDisplayEnabled()) {
            h -= (int) valuePanel.getHeight();
        }
        if (bsbObj.isLabelEnabled()) {
            h -= (int) label.getHeight();
        }

        bsbObj.setKnobWidth(Math.max(20, h));
    }

    public void setWidgetX(int x) {
        bsbObj.setX(x);
    }

    public int getWidgetX() {
        return bsbObj.getX();
    }

    public void setWidgetY(int y) {
        bsbObj.setY(y);
    }

    public int getWidgetY() {
        return bsbObj.getY();
    }
}
