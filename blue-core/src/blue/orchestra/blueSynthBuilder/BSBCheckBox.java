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
import blue.automation.Parameter;
import blue.automation.ParameterListener;
import blue.automation.ParameterTimeManagerFactory;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

/**
 * @author steven
 */
public class BSBCheckBox extends AutomatableBSBObject implements ParameterListener, Randomizable {

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
            switch (nodeName) {
                case "label":
                    checkBox.setLabel(node.getTextString());
                    break;
                case "selected":
                    checkBox.setSelected(node.getTextString().equals("true"));
                    break;
                case "randomizable":
                    checkBox.randomizable = XMLUtilities.readBoolean(node);
                    break;
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

    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null && param.getCompilationVarName() != null) {
                compilationUnit.addReplacementValue(objectName, param
                        .getCompilationVarName());
                return;
            }
        }

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
        boolean oldValue = this.isSelected();
        this.selected = selected;

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null) {
                param.setValue(selected ? 1 : 0);
            }
        }
        
        if (propListeners != null) {
            propListeners.firePropertyChange("selected", oldValue, this.selected);
        }
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

    /* Automatable */

    @Override
    protected void initializeParameters() {
        if (parameters == null) {
            return;
        }

        if (!automationAllowed) {
            if (objectName != null && objectName.length() != 0) {
                Parameter param = parameters.getParameter(objectName);
                if (param != null && param.isAutomationEnabled()) {
                    automationAllowed = true;
                } else {
                    parameters.removeParameter(objectName);
                    return;
                }
            }
        }

        if (this.objectName == null || this.objectName.trim().length() == 0) {
            return;
        }

        Parameter parameter = parameters.getParameter(this.objectName);

        if (parameter != null) {
            parameter.addParameterListener(this);

            if (!parameter.isAutomationEnabled()) {
                parameter.setValue(this.isSelected() ? 1 : 0);
            }

            return;
        }

        Parameter param = new Parameter();
        param.setValue(this.isSelected() ? 1 : 0);
        param.setMax(1.0f, true);
        param.setMin(0.0f, true);
        param.setName(getObjectName());
        param.setResolution(1.0f);
        param.addParameterListener(this);

        parameters.addParameter(param);
    }

    @Override
    public void setAutomationAllowed(boolean allowAutomation) {
        this.automationAllowed = allowAutomation;

        if (parameters != null) {
            if (allowAutomation) {
                initializeParameters();
            } else if (objectName != null && objectName.length() != 0) {
                parameters.removeParameter(objectName);
            }
        }
    }

    /* ParameterListener */
   
    protected void updateSelected(boolean value) {
        boolean oldValue = this.isSelected();
        this.selected = value;

        if (propListeners != null) {
            propListeners.firePropertyChange("selected", oldValue, this.selected);
        }
    }
    
    public void parameterChanged(Parameter param) {
    }

    public void lineDataChanged(Parameter param) {
        Parameter parameter = parameters.getParameter(this.objectName);

        if (parameter != null) {
            float time = ParameterTimeManagerFactory.getInstance().getTime();
            int val = Math.round(parameter.getLine().getValue(time));

            boolean newSelected = (val > 0);

            if(newSelected != isSelected()) {
                updateSelected(newSelected);
            }
        }
    }

}