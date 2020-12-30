/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published
 * by  the Free Software Foundation; either version 2 of the License or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Library General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB.  If not, write to
 * the Free Software Foundation Inc., 59 Temple Place - Suite 330,
 * Boston, MA  02111-1307 USA
 */
package blue.orchestra.blueSynthBuilder;

import electric.xml.Element;
import electric.xml.Elements;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

public class BSBTextField extends BSBObject {

    private final StringProperty value = new SimpleStringProperty("");

    private final IntegerProperty textFieldWidth = new SimpleIntegerProperty(100) {
        @Override
        protected void invalidated() {
            if (get() < 5) {
                set(5);
            }
        }
    };

    public BSBTextField() {
    }

    public BSBTextField(BSBTextField tf) {
        super(tf);
        setValue(tf.getValue());
        setTextFieldWidth(tf.getTextFieldWidth());
    }

    public final void setValue(String val) {
        value.set(val);
    }

    public final String getValue() {
        return value.get();
    }

    public final StringProperty valueProperty() {
        return value;
    }

    public final void setTextFieldWidth(int value) {
        textFieldWidth.set(value);
    }

    public final int getTextFieldWidth() {
        return textFieldWidth.get();
    }

    public final IntegerProperty textFieldWidthProperty() {
        return textFieldWidth;
    }

    @Override
    public String getPresetValue() {
        return getValue();
    }

    public static BSBObject loadFromXML(Element data) {
        BSBTextField bsbText = new BSBTextField();
        initBasicFromXML(data, bsbText);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            switch (node.getName()) {
                case "value":
                    bsbText.setValue(node.getTextString());
                    if (bsbText.getValue() == null) {
                        bsbText.setValue("");
                    }
                    break;
                case "textFieldWidth":
                    bsbText.setTextFieldWidth(
                            Integer.parseInt(node.getTextString()));
                    break;
            }
        }

        return bsbText;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement("value").setText(getValue());
        retVal.addElement("textFieldWidth").setText(
                Integer.toString(getTextFieldWidth()));

        return retVal;
    }

    @Override
    public void setPresetValue(String val) {
        setValue(val);
    }

    @Override
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        compilationUnit.addReplacementValue(getObjectName(), getValue());
    }

    @Override
    public BSBObject deepCopy() {
        return new BSBTextField(this);
    }

}
