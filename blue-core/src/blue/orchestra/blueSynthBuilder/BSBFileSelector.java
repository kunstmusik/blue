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

//import blue.orchestra.editor.blueSynthBuilder.BSBFileSelectorView;
//import blue.orchestra.editor.blueSynthBuilder.BSBObjectView;
import electric.xml.Element;
import electric.xml.Elements;

/**
 * @author steven
 * 
 */
public class BSBFileSelector extends BSBObject {
    String fileName = "";

    int textFieldWidth = 100;

    public static BSBObject loadFromXML(Element data) {
        BSBFileSelector selector = new BSBFileSelector();
        initBasicFromXML(data, selector);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();

            if (node.getName().equals("fileName")) {
                selector.setFileName(node.getTextString());
            } else if (node.getName().equals("textFieldWidth")) {
                selector.setTextFieldWidth(Integer.parseInt(node
                        .getTextString()));
            }

        }

        return selector;
    }

    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement("fileName").setText(fileName);

        retVal.addElement("textFieldWidth").setText(
                Integer.toString(textFieldWidth));

        return retVal;
    }

//    public BSBObjectView getBSBObjectView() {
//        return new BSBFileSelectorView(this);
//    }

    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        String fileNameValue = fileName.replace('\\', '/');
        compilationUnit.addReplacementValue(objectName, fileNameValue);
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = (fileName == null) ? "" : fileName;
    }

    /**
     * @return Returns the textFieldWidth.
     */
    public int getTextFieldWidth() {
        return textFieldWidth;
    }

    /**
     * @param textFieldWidth
     *            The textFieldWidth to set.
     */
    public void setTextFieldWidth(int textFieldWidth) {
        this.textFieldWidth = textFieldWidth;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    public String getPresetValue() {
        return fileName;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    public void setPresetValue(String val) {
        setFileName(val);
    }
}