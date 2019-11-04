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

import blue.automation.Parameter;
import blue.automation.ParameterListener;
import blue.automation.ParameterTimeManagerFactory;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.math.BigDecimal;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;
import javafx.beans.value.ChangeListener;

/**
 * @author steven
 */
public class BSBCheckBox extends AutomatableBSBObject implements ParameterListener, Randomizable {

    private StringProperty label;
    private BooleanProperty selected;
    private BooleanProperty randomizable;

    private ChangeListener<Boolean> listener = (obs, old, newVal) -> {
        if (parameters != null) {
            Parameter p = parameters.getParameter(getObjectName());
            if (p != null && !p.isAutomationEnabled()) {
                p.setValue(newVal ? 1 : 0);
            }
        }
    };

    public BSBCheckBox() {
        label = new SimpleStringProperty("label");
        selected = new SimpleBooleanProperty(false);
        randomizable = new SimpleBooleanProperty(true);

        selected.addListener(listener);
    }

    public BSBCheckBox(BSBCheckBox checkBox) {
        super(checkBox);

        label = new SimpleStringProperty(checkBox.getLabel());
        selected = new SimpleBooleanProperty(checkBox.isSelected());
        randomizable = new SimpleBooleanProperty(checkBox.isRandomizable());

        selected.addListener(listener);
    }

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
                    checkBox.setRandomizable(XMLUtilities.readBoolean(node));
                    break;
            }
        }

        return checkBox;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement("label").setText(getLabel());
        retVal.addElement("selected").setText(Boolean.toString(isSelected()));
        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                isRandomizable()));

        return retVal;
    }

    @Override
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null && param.getCompilationVarName() != null) {
                compilationUnit.addReplacementValue(getObjectName(), param
                        .getCompilationVarName());
                return;
            }
        }

        String replaceVal = this.isSelected() ? "1" : "0";

        compilationUnit.addReplacementValue(getObjectName(), replaceVal);

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

    public final void setSelected(boolean value) {
        selected.set(value);
    }

    public final boolean isSelected() {
        return selected.get();
    }

    public final BooleanProperty selectedProperty() {
        return selected;
    }

    public final void setRandomizable(boolean value) {
        randomizable.set(value);
    }
    @Override
    public final boolean isRandomizable() {
        return randomizable.get();
    }

    public final BooleanProperty randomizableProperty() {
        return randomizable;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    @Override
    public String getPresetValue() {
        return Boolean.toString(isSelected());
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue()
     */
    @Override
    public void setPresetValue(String val) {
        setSelected(Boolean.valueOf(val).booleanValue());
    }

//    /* RANDOMIZABLE METHODS */
    @Override
    public void randomize() {
        if (isRandomizable()) {

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


    /* Automatable */
    @Override
    protected void initializeParameters() {
        if (parameters == null) {
            return;
        }

        if (!automationAllowed) {
            if (getObjectName() != null && getObjectName().length() != 0) {
                Parameter param = parameters.getParameter(getObjectName());
                if (param != null && param.isAutomationEnabled()) {
                    automationAllowed = true;
                } else {
                    parameters.removeParameter(getObjectName());
                    return;
                }
            }
        }

        if (this.getObjectName() == null || this.getObjectName().trim().length() == 0) {
            return;
        }

        Parameter parameter = parameters.getParameter(this.getObjectName());

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
        param.setResolution(new BigDecimal(1));
        param.addParameterListener(this);

        parameters.add(param);
    }

    @Override
    public void setAutomationAllowed(boolean allowAutomation) {
        this.automationAllowed = allowAutomation;

        if (parameters != null) {
            if (allowAutomation) {
                initializeParameters();
            } else if (getObjectName() != null && getObjectName().length() != 0) {
                parameters.removeParameter(getObjectName());
            }
        }
    }

    /* ParameterListener */
    protected void updateSelected(boolean value) {
        boolean oldValue = this.isSelected();
        setSelected(value);

        if (propListeners != null) {
            propListeners.firePropertyChange("selected", oldValue, this.selected);
        }
    }

    @Override
    public void parameterChanged(Parameter param) {
    }

    @Override
    public void lineDataChanged(Parameter param) {
        Parameter parameter = parameters.getParameter(this.getObjectName());

        if (parameter != null && param.isAutomationEnabled()) {
            double time = ParameterTimeManagerFactory.getInstance().getTime();
            long val = Math.round(parameter.getLine().getValue(time));

            boolean newSelected = (val > 0);

            if (newSelected != isSelected()) {
                updateSelected(newSelected);
            }
        }
    }

    @Override
    public BSBCheckBox deepCopy() {
        return new BSBCheckBox(this);
    }

}
