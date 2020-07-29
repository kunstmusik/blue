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

import electric.xml.Element;
import java.util.Map;
import java.util.Objects;
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleObjectProperty;

/**
 *
 * @author stevenyi
 */
public class FieldDef {

    private String fieldName = "field";

    DoubleProperty minValue;
    DoubleProperty maxValue;
    DoubleProperty defaultValue;
    ObjectProperty<FieldType> fieldType;

    public FieldDef() {
        minValue = new SimpleDoubleProperty(0.0);
        maxValue = new SimpleDoubleProperty(1.0);
        defaultValue = new SimpleDoubleProperty(1.0);
        fieldType = new SimpleObjectProperty<>(FieldType.CONTINUOUS);
    }

    public FieldDef(FieldDef fieldDef) {
        this.fieldName = fieldDef.fieldName;

        minValue = new SimpleDoubleProperty(fieldDef.getMinValue());
        maxValue = new SimpleDoubleProperty(fieldDef.getMaxValue());
        defaultValue = new SimpleDoubleProperty(fieldDef.getDefaultValue());
        fieldType = new SimpleObjectProperty<>(fieldDef.getFieldType());
    }

    public FieldType getFieldType() {
        return fieldType.get();
    }

    public void setFieldType(FieldType fieldType) {
        if (fieldType != getFieldType()) {
            this.fieldType.set(fieldType);

            var min = convertToFieldType(getMinValue());
            var max = convertToFieldType(getMaxValue());
            var defaultVal = convertToFieldType(getDefaultValue());

            if (min == max) {
                max += 1;
            }
            setMinValue(min);
            setMaxValue(max);
            setDefaultValue(defaultVal);
        }
    }
    
    public ObjectProperty<FieldType> fieldTypeProperty() {
        return fieldType;
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
        if (getFieldType() == FieldType.DISCRETE) {
            return (long) val;
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

//    @Override
//    public int hashCode() {
//        int hash = 3;
//        hash = 97 * hash + Objects.hashCode(this.fieldType);
//        hash = 97 * hash + Objects.hashCode(this.fieldName);
//        hash = 97 * hash + (int) (Double.doubleToLongBits(this.getMinValue()) ^ (Double.doubleToLongBits(this.getMinValue()) >>> 32));
//        hash = 97 * hash + (int) (Double.doubleToLongBits(this.getMaxValue()) ^ (Double.doubleToLongBits(this.getMaxValue()) >>> 32));
//        hash = 97 * hash + (int) (Double.doubleToLongBits(this.getDefaultValue()) ^ (Double.doubleToLongBits(this.getDefaultValue()) >>> 32));
//
//        return hash;
//    }
//
//    @Override
//    public boolean equals(Object obj) {
//        if (this == obj) {
//            return true;
//        }
//        if (obj == null) {
//            return false;
//        }
//        if (getClass() != obj.getClass()) {
//            return false;
//        }
//        final FieldDef other = (FieldDef) obj;
//        if (!Objects.equals(this.fieldName, other.fieldName)) {
//            return false;
//        }
//        if (this.fieldType != other.fieldType) {
//            return false;
//        }
//        if (Double.doubleToLongBits(this.getMinValue()) != Double.doubleToLongBits(other.getMinValue())) {
//            return false;
//        }
//        if (Double.doubleToLongBits(this.getMaxValue()) != Double.doubleToLongBits(other.getMaxValue())) {
//            return false;
//        }
//        if (Double.doubleToLongBits(this.getDefaultValue()) != Double.doubleToLongBits(other.getDefaultValue())) {
//            return false;
//        }
//        return true;
//    }

    public static FieldDef loadFromXML(Element data) {

        FieldDef fd = new FieldDef();

        fd.setFieldName(data.getAttributeValue("name"));
        fd.setFieldType(FieldType.valueOf(data.getAttributeValue("fieldType")));

        var val = Double.parseDouble(data.getAttributeValue("min"));
        fd.setMinValue(val);
        val = Double.parseDouble(data.getAttributeValue("max"));
        fd.setMaxValue(val);
        val = Double.parseDouble(data.getAttributeValue("default"));
        fd.setDefaultValue(val);

        return fd;
    }

    public Element saveAsXML() {
        Element retVal = new Element("fieldDef");

        retVal.setAttribute("name", getFieldName());
        retVal.setAttribute("fieldType", getFieldType().name());
        retVal.setAttribute("min", Double.toString(getMinValue()));
        retVal.setAttribute("max", Double.toString(getMaxValue()));
        retVal.setAttribute("default", Double.toString(getDefaultValue()));

        return retVal;
    }
}
