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
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.SimpleDoubleProperty;

/**
 *
 * @author stevenyi
 */
public class Field {

    private FieldDef fieldDef;

    private final DoubleProperty value;

    public Field(FieldDef fieldDef) {
        this.fieldDef = fieldDef;
        this.value = new SimpleDoubleProperty(fieldDef.getDefaultValue());
    }

    Field(Field f) {
        this.fieldDef = f.fieldDef;
        this.value = new SimpleDoubleProperty(f.getValue());
    }

    public FieldDef getFieldDef() {
        return fieldDef;
    }

    /**
     * Should only be used when cloning a PianoRoll
     */
    public void setFieldDef(FieldDef fieldDef) {
        this.fieldDef = fieldDef;
    }

    public double getValue() {
        return fieldDef.convertToFieldType(value.get());
    }

    public void setValue(double value) {
        var newVal = Math.max(fieldDef.getMinValue(), Math.min(value, fieldDef.getMaxValue()));

        this.value.set(fieldDef.convertToFieldType(newVal));
    }

    public DoubleProperty valueProperty() {
        return value;
    }

    public static Field loadFromXML(Element data, Map<String, FieldDef> fieldTypes) {
        String fieldName = data.getAttributeValue("name");

        FieldDef fieldDef = fieldTypes.get(fieldName);
        Field f = new Field(fieldDef);
        var val = Double.parseDouble(data.getAttributeValue("val"));
        f.setValue(val);

        return f;
    }

    public Element saveAsXML() {
        Element retVal = new Element("field");

        retVal.setAttribute("name", fieldDef.getFieldName());
        retVal.setAttribute("val", Double.toString(getValue()));

        return retVal;
    }

}
