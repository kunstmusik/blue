/*
 * To change this license header, choose License Headers in Project Properties.
 * To change this template file, choose Tools | Templates
 * and open the template in the editor.
 */
package blue.soundObject.pianoRoll;

import electric.xml.Element;
import java.util.Map;

/**
 *
 * @author stevenyi
 */
public class Field {

    private final FieldDef fieldDef;
    
    private double value = 0.0;
    
    public Field(FieldDef fieldDef) {
        this.fieldDef = fieldDef;
        this.value = fieldDef.getDefaultValue();
    }

    Field(Field f) {
        this.fieldDef = f.fieldDef;
        this.value = f.value;
    }

    public FieldDef getFieldDef() {
        return fieldDef;
    }

    public double getValue() {
        return value;
    }

    public void setValue(double value) {
        this.value = value;
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
        retVal.setAttribute("val", Double.toString(value));
        
        return retVal;
    }
}
