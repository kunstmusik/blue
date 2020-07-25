/*
 * blue - object composition environment for csound
 * Copyright (c) 2020 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.pianoRoll;

import javafx.beans.property.DoubleProperty;
import javafx.beans.property.SimpleDoubleProperty;

/**
 *
 * @author stevenyi
 */
public class FieldDef {

    private FieldType fieldType = FieldType.CONTINUOUS;
    private String fieldName = "field";

    DoubleProperty minValue;
    DoubleProperty maxValue;
    DoubleProperty defaultValue;

    public FieldDef() {
        minValue = new SimpleDoubleProperty(0.0);
        maxValue = new SimpleDoubleProperty(1.0);
        defaultValue = new SimpleDoubleProperty(1.0);
    }

    public FieldDef(FieldDef fieldDef) {
        this.fieldType = fieldDef.fieldType;
        this.fieldName = fieldDef.fieldName;

        minValue = new SimpleDoubleProperty(fieldDef.getMinValue());
        maxValue = new SimpleDoubleProperty(fieldDef.getMaxValue());
        defaultValue = new SimpleDoubleProperty(fieldDef.getDefaultValue());
    }

    public FieldType getFieldType() {
        return fieldType;
    }

    public void setFieldType(FieldType fieldType) {
        if (fieldType != this.fieldType) {
            this.fieldType = fieldType;
            
            var min = convertToFieldType(getMinValue());
            var max = convertToFieldType(getMaxValue());
            var defaultVal = convertToFieldType(getDefaultValue());
            
            if(min == max) {
                max += 1;
            }
            setMinValue(min);
            setMaxValue(max);
            setDefaultValue(defaultVal);
        }

    }

    public String getFieldName() {
        return fieldName;
    }

    public void setFieldName(String fieldName) {
        this.fieldName = fieldName;
    }

    public double getMinValue() {
        return minValue.get();
    }

    public void setMinValue(double minValue) {

        minValue = convertToFieldType(minValue);

        if (minValue < getMaxValue()) {
            this.minValue.set(minValue);

            var newDefault = getClampedDefaultValue();
            if (newDefault != getDefaultValue()) {
                setDefaultValue(newDefault);
            }
        }
    }

    public DoubleProperty minValueProperty() {
        return minValue;
    }

    public double getMaxValue() {
        return maxValue.get();
    }

    public void setMaxValue(double maxValue) {

        maxValue = convertToFieldType(maxValue);

        if (maxValue > getMinValue()) {
            this.maxValue.set(maxValue);

            var newDefault = getClampedDefaultValue();
            if (newDefault != getDefaultValue()) {
                setDefaultValue(newDefault);
            }
        }
    }

    public DoubleProperty maxValueProperty() {
        return maxValue;
    }

    public double getDefaultValue() {
        return defaultValue.get();
    }

    public void setDefaultValue(double defaultValue) {
        defaultValue = convertToFieldType(defaultValue);

        if (defaultValue >= getMinValue() && defaultValue <= getMaxValue()) {
            this.defaultValue.set(defaultValue);
        }
    }

    public DoubleProperty defaultValueProperty() {
        return defaultValue;
    }

    protected double convertToFieldType(double val) {
        if (fieldType == FieldType.DISCRETE) {
            return (int) val;
        }
        return val;
    }

    protected double getClampedDefaultValue() {
        return Math.max(getMinValue(), Math.min(getMaxValue(), getDefaultValue()));
    }
    
    @Override
    public String toString() {
        return getFieldName();
    }
}
