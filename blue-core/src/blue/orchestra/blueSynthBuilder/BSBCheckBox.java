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

//import blue.orchestra.editor.blueSynthBuilder.BSBCheckBoxView;
//import blue.orchestra.editor.blueSynthBuilder.BSBObjectView;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

/**
 * @author steven
 */
public class BSBCheckBox extends BSBObject implements Randomizable {

    String label = "label";

    boolean selected = false;

    private boolean randomizable = true;

    public static BSBObject loadFromXML(Element data) {
        BSBCheckBox checkBox = new BSBCheckBox();
        initBasicFromXML(data, checkBox);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("label")) {
                checkBox.setLabel(node.getTextString());
            } else if (nodeName.equals("selected")) {
                checkBox.setSelected(node.getTextString().equals("true"));
            } else if (nodeName.equals("randomizable")) {
                checkBox.randomizable = XMLUtilities.readBoolean(node);
            }
        }

        return checkBox;
    }

    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement("label").setText(label);
        retVal.addElement("selected").setText(Boolean.toString(selected));
        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                randomizable));

        return retVal;
    }

//    public BSBObjectView getBSBObjectView() {
//        return new BSBCheckBoxView(this);
//    }

    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        String replaceVal = this.isSelected() ? "1" : "0";

        compilationUnit.addReplacementValue(objectName, replaceVal);

    }

    public String getLabel() {
        return this.label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public void setSelected(boolean selected) {
        this.selected = selected;
    }

    public boolean isSelected() {
        return selected;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    public String getPresetValue() {
        return Boolean.toString(isSelected());
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue()
     */
    public void setPresetValue(String val) {
        setSelected(Boolean.valueOf(val).booleanValue());
    }

    /* RANDOMIZABLE METHODS */

    public boolean isRandomizable() {
        return randomizable;
    }

    public void randomize() {
        if (randomizable) {

            boolean randomSelected = (Math.random() < .5);

            if (randomSelected != this.isSelected()) {
                setSelected(randomSelected);

                if (propListeners != null) {
                    propListeners.firePropertyChange("selected",
                            !randomSelected, randomSelected);
                }

            }
        }
    }

    public void setRandomizable(boolean randomizable) {
        this.randomizable = randomizable;
        fireBSBObjectChanged();
    }
}