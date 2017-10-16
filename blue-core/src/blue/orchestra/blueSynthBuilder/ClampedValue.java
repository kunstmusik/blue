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
package blue.orchestra.blueSynthBuilder;

import blue.components.lines.LineUtils;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.DoublePropertyBase;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javax.swing.JOptionPane;
import javax.swing.SwingUtilities;

/**
 * Provides double value property that is clamped to reside between min and max
 * value properties, optionally using resolution.
 *
 * The setters for this class contain code to query the user for how to handle
 * line boundary changes. These setters should be used only by the end-user,
 * such as when editing the value from a property sheet. To set values manually
 * and avoid the querying, use the property directly and call .set() on it.
 *
 * @author stevenyi
 */
public class ClampedValue {

    private DoubleProperty value;
    private DoubleProperty min;
    private DoubleProperty max;
    private ObjectProperty<BigDecimal> resolution;

    List<ClampedValueListener> listeners = null;

    public ClampedValue() {
        this(0.0, 1.0, 0.5, new BigDecimal(-1.0));
    }

    public ClampedValue(ClampedValue cv) {
        this(cv.getMin(), cv.getMax(), cv.getValue(), cv.getResolution());
    }

    public ClampedValue(double minVal, double maxVal, double val, BigDecimal res) {
        min = new DoublePropertyBase(minVal) {
            @Override
            protected void invalidated() {
                if (get() > getMax()) {
                    setMax(get());
                }
                adjustValue();
            }

            @Override
            public Object getBean() {
                return ClampedValue.this;
            }

            @Override
            public String getName() {
                return "min";
            }
        };

        max = new DoublePropertyBase(maxVal) {

            @Override
            protected void invalidated() {
                if (get() < getMin()) {
                    setMin(get());
                }
                adjustValue();
            }

            @Override
            public Object getBean() {
                return ClampedValue.this;
            }

            @Override
            public String getName() {
                return "max";
            }
        };

        value = new DoublePropertyBase(val) {
            @Override
            protected void invalidated() {
                adjustValue();
            }

            @Override
            public Object getBean() {
                return ClampedValue.this;
            }

            @Override
            public String getName() {
                return "value";
            }
        };
        resolution = new SimpleObjectProperty<>(res);
    }

    protected void adjustValue() {
        double v = getValue();
        double min = getMin();
        double max = getMax();
        BigDecimal resolution = getResolution();

        double newV = Math.max(min, Math.min(max, v));

        if (resolution.doubleValue() > 0.0) {
            newV = LineUtils.snapToResolution(newV, min, max, resolution);
        }

        setValue(newV);
    }

    public final void randomizeValue() {
        setNormalizedValue(Math.random());
    }

    /**
     * Utility method for setting a normalized value in range [0.0,1.0] that
     * will be rescaled and translated within [min,max] range.
     */
    public void setNormalizedValue(double value) {
        double min = getMin();
        double max = getMax();
        BigDecimal resolution = getResolution();
        double range = getMax() - min;
        double newVal = (range * value) + min;

        if (resolution.doubleValue() > 0.0) {
            newVal = LineUtils.snapToResolution(newVal, min, max, resolution);
        }
        setValue(newVal);
    }

    /**
     * Utility method for getting a normalized value in range [0.0, 1.0]. Useful
     * for percentage calculation when drawing.
     *
     * @return
     */
    public double getNormalizedValue() {
        double min = getMin();
        double range = getMax() - min;
        double newVal = (getValue() - min) / range;
        return newVal;
    }

    public final void setValue(double val) {
        double v = Math.max(getMin(), Math.min(getMax(), val));

        if (getResolution().doubleValue() > 0.0) {
            v = LineUtils.snapToResolution(v, getMin(), getMax(), getResolution());
        }
        value.set(val);

        notifyListeners(ClampedValueListener.PropertyType.VALUE,
                ClampedValueListener.BoundaryType.NONE);
    }

    public final double getValue() {
        return value.get();
    }

    public final DoubleProperty valueProperty() {
        return value;
    }

    public final void setMin(double value) {

        if (value >= getMax()) {
            if (!SwingUtilities.isEventDispatchThread()) {
//                Alert a = new Alert(AlertType.NONE,
//                        "Error: Min value can not be set greater or equals to Max value.",
//                        ButtonType.OK);
//                a.setTitle("Error");
//                BlueFX.style(a.getDialogPane());
//                a.showAndWait();
                SwingUtilities.invokeLater(() -> {
                    JOptionPane.showMessageDialog(null, "Error: Min value "
                            + "can not be set greater or equals to Max value.",
                            "Error", JOptionPane.ERROR_MESSAGE);
                });
            } else {
                JOptionPane.showMessageDialog(null, "Error: Min value "
                        + "can not be set greater or equals to Max value.",
                        "Error", JOptionPane.ERROR_MESSAGE);
            }
            return;
        }

        double oldMin = getMin();
        double oldValue = getValue();

        min.set(value);
        setValue(LineUtils.rescale(oldValue, oldMin, getMax(),
                value, getMax(), getResolution()));

        notifyListeners(ClampedValueListener.PropertyType.MIN, ClampedValueListener.BoundaryType.SCALE);
    }

    public final double getMin() {
        return min.get();
    }

    public final DoubleProperty minProperty() {
        return min;
    }

    public final void setMax(double value) {

        if (value <= getMin()) {

            if (!SwingUtilities.isEventDispatchThread()) {
//                Alert a = new Alert(AlertType.NONE,
//                        "Error: Max value can not be set less than or "
//                        + "equal to Min value.",
//                        ButtonType.OK);
//                a.setTitle("Error");
//                BlueFX.style(a.getDialogPane());
//                a.showAndWait();
                SwingUtilities.invokeLater(() -> {
                    JOptionPane.showMessageDialog(null, "Error: Max value "
                            + "can not be set less than or " + "equal to Min value.",
                            "Error", JOptionPane.ERROR_MESSAGE);
                });
            } else {
                JOptionPane.showMessageDialog(null, "Error: Max value "
                        + "can not be set less than or " + "equal to Min value.",
                        "Error", JOptionPane.ERROR_MESSAGE);
            }
            return;
        }

        double oldMax = getMax();
        double oldValue = getValue();

        max.set(value);
        setValue(LineUtils.rescale(oldValue, getMin(), oldMax,
                getMin(), value, getResolution()));

        notifyListeners(ClampedValueListener.PropertyType.MAX, ClampedValueListener.BoundaryType.SCALE);
    }

    public final double getMax() {
        return max.get();
    }

    public final DoubleProperty maxProperty() {
        return max;
    }

    public final void setResolution(BigDecimal value) {
        resolution.set(value);
        adjustValue();
        notifyListeners(ClampedValueListener.PropertyType.RESOLUTION,
                ClampedValueListener.BoundaryType.NONE);
    }

    public final BigDecimal getResolution() {
        return resolution.get();
    }

    public final ObjectProperty<BigDecimal> resolutionProperty() {
        return resolution;
    }


    /* Listener Code*/
    public void addListener(ClampedValueListener cvl) {
        if (listeners == null) {
            listeners = new ArrayList<>();
        }
        listeners.add(cvl);
    }

    public void removeListener(ClampedValueListener cvl) {
        if (listeners != null) {
            listeners.remove(cvl);
        }
    }

    public void notifyListeners(ClampedValueListener.PropertyType pType,
            ClampedValueListener.BoundaryType bType) {
        if (listeners != null) {
            for (ClampedValueListener listener : listeners) {
                listener.propertyChanged(pType, bType);
            }
        }

    }

}
