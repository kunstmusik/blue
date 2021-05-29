/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2016 Steven Yi (stevenyi@gmail.com)
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
package blue.orchestra.blueSynthBuilder;

import static blue.orchestra.blueSynthBuilder.SwingHTMLFontParser.parseFont;
import static blue.orchestra.blueSynthBuilder.SwingHTMLFontParser.stripHTML;
import electric.xml.Element;
import java.awt.Font;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;

/**
 * @author steven
 */
public class BSBLabel extends BSBObject {

    StringProperty label = new SimpleStringProperty("label");
    ObjectProperty<Font> font = new SimpleObjectProperty<>(new Font("Roboto", Font.PLAIN, 12));

    public BSBLabel() {
    }

    public BSBLabel(BSBLabel label) {
        super(label);
        setLabel(label.getLabel());
        setFont(label.getFont());
    }

    public final void setLabel(String value) {
        label.set(value);
    }

    public final String getLabel() {
        return label.get();
    }

    public final StringProperty labelProperty() {
        return label;
    }

    public final void setFont(Font f) {
        font.set(f);
    }

    public final Font getFont() {
        return font.get();
    }

    public final ObjectProperty<Font> fontProperty() {
        return font;
    }

    public static BSBObject loadFromXML(Element data) {
        BSBLabel label = new BSBLabel();
        initBasicFromXML(data, label);

        int version = 1;

        String versionStr = data.getAttributeValue("version");

        if (versionStr != null) {
            version = Integer.parseInt(versionStr);
        }

        String labelText = data.getTextString("label");
        if (labelText == null) {
            labelText = "";
        }

        if (version < 2) {
            label.setFont(parseFont(labelText));
            labelText = stripHTML(labelText);
            labelText = labelText.replace("&nbsp;", " ");
        } else {
            label.setFont(BSBFontUtil.loadFromXML(data.getElement("font")));
        }

        label.setLabel(labelText);

        return label;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BlueSynthBuilderObject#saveAsXML()
     */
    @Override
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);
        retVal.setAttribute("version", "2");

        retVal.addElement("label").setText(getLabel());
        retVal.addElement(BSBFontUtil.saveAsXML(getFont()));

        return retVal;
    }

    @Override
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        // DO NOTHING
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    @Override
    public String getPresetValue() {
        return null;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    @Override
    public void setPresetValue(String val) {
    }

    @Override
    public BSBObject deepCopy() {
        return new BSBLabel(this);
    }
}
