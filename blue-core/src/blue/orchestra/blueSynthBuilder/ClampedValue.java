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

import javafx.beans.property.DoubleProperty;
import javafx.beans.property.DoublePropertyBase;

/**
 * Provides double value property that is clamped to reside between min and max
 * value properties.  
 * 
 * @author stevenyi
 */
public class ClampedValue {

    private DoubleProperty value;
    private DoubleProperty min;
    private DoubleProperty max;

    public ClampedValue() {
        this(0.0, 1.0, 0.5);    
    }

    public ClampedValue(double minVal, double maxVal, double val) {
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
    }

    protected void adjustValue() {
        double v = getValue();
        double min = getMin();
        double max = getMax();
        if(v < min || v > max) {
           setValue(Math.max(min, Math.min(max, v))); 
        }
        
    }

    public final void setValue(double val) {
        value.set(val);
    }

    public final double getValue() {
        return value.get();
    }

    public final DoubleProperty valueProperty() {
        return value;
    }

    public final void setMin(double value) {
        min.set(value);
    }

    public final double getMin() {
        return min.get();
    }

    public final DoubleProperty minProperty() {
        return min;
    }

    public final void setMax(double value) {
        max.set(value);
    }

    public final double getMax() {
        return max.get();
    }

    public final DoubleProperty maxProperty() {
        return max;
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
        double range = getMax() - min;
        double newVal = (range * value) + min;
        setValue(newVal);
    }

    /** Utility method for getting a normalized value in range [0.0, 1.0]. 
     * Useful for percentage calculation when drawing.
     * 
     * @return 
     */
    public double getNormalizedValue() {
        double min = getMin();
        double range = getMax() - min;
        double newVal = (getValue() - min) / range;
        return newVal;
    }
}
