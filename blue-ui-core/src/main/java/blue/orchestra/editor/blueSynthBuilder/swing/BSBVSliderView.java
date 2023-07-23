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

import blue.components.ValueSlider;
import blue.orchestra.blueSynthBuilder.BSBVSlider;
import blue.ui.utilities.UiUtilities;
import blue.utility.NumberUtilities;
import java.awt.BorderLayout;
import java.awt.Component;
import java.awt.Dimension;
import java.beans.PropertyChangeEvent;
import javafx.beans.value.ChangeListener;
import javax.swing.BoxLayout;
import javax.swing.event.ChangeEvent;

/**
 * @author steven
 */
public class BSBVSliderView extends BSBObjectView<BSBVSlider> implements
        ResizeableView {

    private static final int VALUE_DISPLAY_HEIGHT = 30;
    private static final int VALUE_DISPLAY_WIDTH = 50;
    private final ValueSlider valSlider;
    final javax.swing.event.ChangeListener valSliderListener;

    ValuePanel valuePanel = new ValuePanel();

    private volatile boolean updating = false;

    final ChangeListener<Boolean> vdeListener;

    final ChangeListener<Number> resListener;
    final ChangeListener<Number> minListener;
    final ChangeListener<Number> maxListener;
    final ChangeListener<Number> valueListener;
    final ChangeListener<Number> heightListener;

    /**
     * @param slider
     */
    public BSBVSliderView(BSBVSlider slider) {
        super(slider);
        updating = true;

        valSlider = new ValueSlider();
        valSlider.setOrientation(ValueSlider.VERTICAL);

        valSlider.setOpaque(false);
        valSliderListener = (ChangeEvent e) -> {
            if (!updating) {
                updating = true;
                bsbObj.setValue(getValueFromSlider());
                updating = false;
            }
        };

        valuePanel.setPreferredSize(new Dimension(VALUE_DISPLAY_WIDTH,
                VALUE_DISPLAY_HEIGHT));
        valuePanel.setMaximumSize(new Dimension(VALUE_DISPLAY_WIDTH,
                VALUE_DISPLAY_HEIGHT));
        valSlider.setAlignmentX(Component.CENTER_ALIGNMENT);

        var layout = new BoxLayout(this, BoxLayout.Y_AXIS);
        this.setLayout(layout);
        
        this.add(valSlider);

        if (bsbObj.isValueDisplayEnabled()) {
            this.add(valuePanel);
        }

        this.setSize(getPreferredSize());
        updating = false;

        valuePanel.addPropertyChangeListener((PropertyChangeEvent evt) -> {
            if ("value".equals(evt.getPropertyName())) {
                try {
                    float val = Float.parseFloat(valuePanel.getPendingValue());

                    updating = true;

                    getBSBObject().setValue(val);

                    updating = false;

                } catch (NumberFormatException nfe) {
                }
            }
        });

        this.vdeListener = (obs, old, newVal) -> {
            UiUtilities.invokeOnSwingThread(() -> {
                if (!newVal) {
                    remove(valuePanel);
                } else {
                    if (valuePanel.getParent() == null) {
                        add(valuePanel, BorderLayout.SOUTH);
                    }
                }
                setSize(getPreferredSize());
            });
        };

        this.resListener = (obs, old, newVal) -> {
            UiUtilities.invokeOnSwingThread(() -> {
                valSlider.setResolution(getNumTicks());
                valuePanel.setValue(NumberUtilities.formatDouble(getValueFromSlider()));
            });
        };
        this.minListener = (obs, old, newVal) -> {
            UiUtilities.invokeOnSwingThread(() -> {
                valSlider.setMinimum(newVal.doubleValue());
                valSlider.setResolution(getNumTicks());
                valuePanel.setValue(NumberUtilities.formatDouble(getValueFromSlider()));
            });
        };
        this.maxListener = (obs, old, newVal) -> {
            UiUtilities.invokeOnSwingThread(() -> {
                valSlider.setMaximum(newVal.doubleValue());
                valSlider.setResolution(getNumTicks());
                valuePanel.setValue(NumberUtilities.formatDouble(getValueFromSlider()));
            });
        };
        this.valueListener = (obs, old, newVal) -> {
            UiUtilities.invokeOnSwingThread(() -> {
                valSlider.setValue(newVal.doubleValue());
                valuePanel.setValue(NumberUtilities.formatDouble(getValueFromSlider()));
            });
        };
        this.heightListener = (obs, old, newVal) -> {
            valSlider.setPreferredSize(new Dimension(0, newVal.intValue()));
            setSize(getPreferredSize());
        };
    }

    @Override
    public void addNotify() {
        super.addNotify();

        updating = true;

        try {
            bsbObj.resolutionProperty().addListener(resListener);
            bsbObj.minimumProperty().addListener(minListener);
            bsbObj.maximumProperty().addListener(maxListener);
            bsbObj.valueProperty().addListener(valueListener);
            bsbObj.sliderHeightProperty().addListener(heightListener);
            bsbObj.valueDisplayEnabledProperty().addListener(vdeListener);

            valSlider.setMinimum(bsbObj.getMinimum());
            valSlider.setMaximum(bsbObj.getMaximum());

            valSlider.setResolution(getNumTicks());
            valSlider.setValue(bsbObj.getValue());
            valSlider.addChangeListener(valSliderListener);            
            updateValueDisplay();
        } finally {
            updating = false;
        }
    }

    @Override
    public void removeNotify() {
        super.removeNotify();

        updating = true;
        valSlider.removeChangeListener(valSliderListener);

        bsbObj.resolutionProperty().removeListener(resListener);
        bsbObj.minimumProperty().removeListener(minListener);
        bsbObj.maximumProperty().removeListener(maxListener);
        bsbObj.valueProperty().removeListener(valueListener);
        bsbObj.sliderHeightProperty().removeListener(heightListener);
        bsbObj.valueDisplayEnabledProperty().removeListener(vdeListener);
        updating = false;
    }

    private int getNumTicks() {
        double res = bsbObj.getResolution().doubleValue();
        double range = (bsbObj.getMaximum() - bsbObj.getMinimum());
        return (res > 0) ? (int) (range / res) : (int) (range * 100);
    }

    protected double getValueFromSlider() {
        double newVal;
        double res = bsbObj.getResolution().doubleValue();
        double min = bsbObj.getMinimum();

        newVal = (res > 0) ? (valSlider.getValue() * res) + min
                : (valSlider.getValue() * 0.01f) + min;

        return newVal;
    }

    @Override
    public Dimension getPreferredSize() {
        var h = (bsbObj.isValueDisplayEnabled())
                ? bsbObj.getSliderHeight() + VALUE_DISPLAY_HEIGHT
                : bsbObj.getSliderHeight();

        return new Dimension(VALUE_DISPLAY_WIDTH, h);
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
        int base = bsbObj.isValueDisplayEnabled() ? 30 : 0;
        return 45 + base;
    }

    public int getWidgetWidth() {
        return -1;
    }

    public void setWidgetWidth(int width) {
    }

    public int getWidgetHeight() {
        int base = bsbObj.isValueDisplayEnabled() ? 30 : 0;
        return base + bsbObj.getSliderHeight();
    }

    public void setWidgetHeight(int height) {
        int base = bsbObj.isValueDisplayEnabled() ? 30 : 0;
        bsbObj.setSliderHeight(Math.max(45, height - base));
    }

    public void setWidgetX(int x) {
    }

    public int getWidgetX() {
        return -1;
    }

    public void setWidgetY(int y) {
        bsbObj.setY(y);
    }

    public int getWidgetY() {
        return bsbObj.getY();
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
}
