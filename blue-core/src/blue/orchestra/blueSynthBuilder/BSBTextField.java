/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

//import blue.orchestra.editor.blueSynthBuilder.BSBObjectView;
//import blue.orchestra.editor.blueSynthBuilder.BSBTextFieldView;
import electric.xml.Element;
import electric.xml.Elements;

public class BSBTextField extends BSBObject {

    private String value = "";

    private int textFieldWidth = 100;

//    public BSBObjectView getBSBObjectView() {
//        return new BSBTextFieldView(this);
//    }

    public String getPresetValue() {
        return value;
    }

    public static BSBObject loadFromXML(Element data) {
        BSBTextField bsbText = new BSBTextField();
        initBasicFromXML(data, bsbText);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            if (node.getName().equals("value")) {
                bsbText.value = node.getTextString();
                if (bsbText.value == null) {
                    bsbText.value = "";
                }
            } else if (node.getName().equals("textFieldWidth")) {
                bsbText.textFieldWidth = Integer.parseInt(node.getTextString());
            }
        }

        return bsbText;
    }

    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement("value").setText(value);
        retVal.addElement("textFieldWidth").setText(
                Integer.toString(textFieldWidth));

        return retVal;
    }

    public void setPresetValue(String val) {
        value = val;
    }

    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        compilationUnit.addReplacementValue(objectName, value);
    }

    public String getValue() {
        return value;
    }

    public void setValue(String value) {
        this.value = value;
    }

    public int getTextFieldWidth() {
        return textFieldWidth;
    }

    public void setTextFieldWidth(int textFieldWidth) {
        this.textFieldWidth = textFieldWidth;
    }

}
