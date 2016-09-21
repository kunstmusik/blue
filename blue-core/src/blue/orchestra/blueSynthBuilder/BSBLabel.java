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
package blue.orchestra.blueSynthBuilder;

//import blue.orchestra.editor.blueSynthBuilder.BSBLabelView;
//import blue.orchestra.editor.blueSynthBuilder.BSBObjectView;
import electric.xml.Element;
import java.io.Externalizable;
import java.io.IOException;
import java.io.ObjectInput;
import java.io.ObjectOutput;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import javafx.scene.text.Font;
import javafx.scene.text.FontWeight;

/**
 * @author steven
 * 
 * To change the template for this generated type comment go to Window -
 * Preferences - Java - Code Generation - Code and Comments
 */
public class BSBLabel extends BSBObject implements Externalizable {

    StringProperty label; 
    ObjectProperty<Font> font;

    static final Pattern SIZE_REGEX = Pattern.compile("size=\"([^\"]*)\"", 
            Pattern.CASE_INSENSITIVE); 
    static final int SIZE_MAP[] = { 8, 10, 12, 14, 18, 24, 36 };

    public BSBLabel() {
        label = new SimpleStringProperty("label");
        font = new SimpleObjectProperty<>(new Font(12));
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

    protected static Font parseFont(String text) {
        Matcher m = SIZE_REGEX.matcher(text);
        int retVal = 2;
        if(m.find()) {
            try {
                String t = m.group(1);
                int v = Integer.parseInt(m.group(1));

                if(t.charAt(0) == '+' || 
                        t.charAt(0) == '-') {
                    retVal += v + 1;
                } else {
                    retVal = v - 1; 
                }
            } catch (NumberFormatException nfe) {
                nfe.printStackTrace();
                retVal = 0;
            }
        }
        retVal = Math.min(Math.max(0, retVal), 6);

        FontWeight weight = FontWeight.NORMAL;
        if(text.indexOf("<b>") >= 0 || retVal > 2) {
            weight = FontWeight.BOLD;
        }
        Font f = Font.font("System Regular", weight, SIZE_MAP[retVal]);
        return f;
    }

    protected static String stripHTML(String text) {
        return text.replaceAll("\\<[^>]*?>","");
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

        if(version < 2) {
            label.setFont(parseFont(labelText));
            labelText = stripHTML(labelText);
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
    public void writeExternal(ObjectOutput out) throws IOException {
        out.writeUTF(objectName);
        out.writeUTF(getLabel());
        out.writeUTF(getFont().getName());
        out.writeDouble(getFont().getSize());
    }

    @Override
    public void readExternal(ObjectInput in) throws IOException, ClassNotFoundException {
        setObjectName(in.readUTF());
        setLabel(in.readUTF());

        String fontName = in.readUTF();
        double fontSize = in.readDouble();

        setFont(new Font(fontName, fontSize));
    }
}