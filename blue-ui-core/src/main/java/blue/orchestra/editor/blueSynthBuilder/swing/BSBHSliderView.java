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
import blue.orchestra.blueSynthBuilder.BSBHSlider;
import blue.ui.utilities.UiUtilities;
import blue.utility.NumberUtilities;
import java.awt.BorderLayout;
import java.awt.Dimension;
import java.beans.PropertyChangeEvent;
import javafx.beans.value.ChangeListener;
import javax.swing.event.ChangeEvent;

public class BSBHSliderView extends BSBObjectView<BSBHSlider> {

    private static final int VALUE_DISPLAY_HEIGHT = 30;

    private static final int VALUE_DISPLAY_WIDTH = 50;

    private final ValueSlider valSlider;

    ValuePanel valuePanel = new ValuePanel();

    private volatile boolean updating = false;

    final ChangeListener<Boolean> vdeListener;

    final ChangeListener<Number> resListener;
    final ChangeListener<Number> minListener;
    final ChangeListener<Number> maxListener;
    final ChangeListener<Number> valueListener;
    final ChangeListener<Number> widthListener;

    /**
     * @param slider
     */
    public BSBHSliderView(BSBHSlider slider) {
        super(slider);

        updating = true;

        valSlider = new ValueSlider();

        valSlider.setOpaque(false);
        valSlider.addChangeListener((ChangeEvent e) -> {
            if (!updating) {
                updating = true;
                bsbObj.setValue(getValueFromSlider());
                updating = false;
            }
        });

        valuePanel.setPreferredSize(new Dimension(VALUE_DISPLAY_WIDTH,
                VALUE_DISPLAY_HEIGHT));

        this.setLayout(new BorderLayout());
        this.add(valSlider, BorderLayout.CENTER);

        if (bsbObj.isValueDisplayEnabled()) {
            this.add(valuePanel, BorderLayout.EAST);
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
                        add(valuePanel, BorderLayout.EAST);
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
        this.widthListener = (obs, old, newVal) -> {
            valSlider.setSize(newVal.intValue(), VALUE_DISPLAY_HEIGHT);
            setSize(getPreferredSize());
        };
    }

    @Override
    public void addNotify() {
        super.addNotify();

        bsbObj.resolutionProperty().addListener(resListener);
        bsbObj.minimumProperty().addListener(minListener);
        bsbObj.maximumProperty().addListener(maxListener);
        bsbObj.valueProperty().addListener(valueListener);
        bsbObj.sliderWidthProperty().addListener(widthListener);
        bsbObj.valueDisplayEnabledProperty().addListener(vdeListener);

        valSlider.setMinimum(bsbObj.getMinimum());
        valSlider.setMaximum(bsbObj.getMaximum());
        valSlider.setValue(bsbObj.getValue());
        valSlider.setResolution(getNumTicks());
    }

    @Override
    public void removeNotify() {
        super.removeNotify();

        bsbObj.resolutionProperty().removeListener(resListener);
        bsbObj.minimumProperty().removeListener(minListener);
        bsbObj.maximumProperty().removeListener(maxListener);
        bsbObj.valueProperty().removeListener(valueListener);
        bsbObj.sliderWidthProperty().removeListener(widthListener);
        bsbObj.valueDisplayEnabledProperty().removeListener(vdeListener);
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
        var w = (bsbObj.isValueDisplayEnabled())
                ? bsbObj.getSliderWidth() + VALUE_DISPLAY_WIDTH
                : bsbObj.getSliderWidth();

        return new Dimension(w, VALUE_DISPLAY_HEIGHT);
    }

}
