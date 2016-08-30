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

import blue.automation.Parameter;
import blue.automation.ParameterListener;
import blue.automation.ParameterTimeManagerFactory;
import blue.components.lines.LineUtils;
import blue.utility.NumberUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

/**
 * @author Steven Yi
 *
 */
public class BSBValue extends AutomatableBSBObject implements ParameterListener {

    float defaultValue = 0.0f;

    float minimum = 0.0f;

    float maximum = 1.0f;

    public static BSBObject loadFromXML(Element data) {
        BSBValue value = new BSBValue();
        float minVal = 0;
        float maxVal = 0;
        initBasicFromXML(data, value);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "minimum":
                    minVal = Float.parseFloat(node.getTextString());
                    break;
                case "maximum":
                    maxVal = Float.parseFloat(node.getTextString());
                    break;
                case "defaultValue":
                    value.defaultValue = Float.parseFloat(node.getTextString());
                    break;
            }

        }

        // set min and max values
        if (minVal > 1.0f) {
            value.maximum = maxVal;
            value.minimum = minVal;
        } else {
            value.minimum = minVal;
            value.maximum = maxVal;
        }

        return value;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BlueSynthBuilderObject#saveAsXML()
     */
    @Override
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement("minimum").setText(Float.toString(minimum));
        retVal.addElement("maximum").setText(Float.toString(maximum));
        retVal.addElement("defaultValue").setText(Float.toString(defaultValue));

        return retVal;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getBSBObjectView()
     */
//    public BSBObjectView getBSBObjectView() {
//        return new BSBKnobView(this);
//    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setupForCompilation(blue.orchestra.blueSynthBuilder.BSBCompilationUnit)
     */
    @Override
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null && param.getCompilationVarName() != null) {
                compilationUnit.addReplacementValue(objectName, param
                        .getCompilationVarName());
                return;
            }
        }

        compilationUnit.addReplacementValue(objectName,
                Float.toString(defaultValue));
    }

    // ACCESSOR METHODS
    /**
     * @return Returns the maximum.
     */
    public float getMaximum() {
        return maximum;
    }

    /**
     * @param maximum The maximum to set.
     */
    public void setMaximum(float maximum, boolean truncate) {
        if (maximum <= getMinimum()) {
            return;
        }
        float oldMax = this.maximum;

        this.maximum = maximum;

        if (truncate) {
            setDefaultValue(LineUtils.truncate(getDefaultValue(), 
                    minimum, maximum));
        } else {
            setDefaultValue(LineUtils.rescale(getDefaultValue(), 
                    minimum, oldMax, minimum,
                    maximum, -1.0f));
        }

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null) {
                param.setMax(this.maximum, truncate);
            }
        }

        fireBSBObjectChanged();
    }

    /**
     * @return Returns the minimum.
     */
    public float getMinimum() {
        return minimum;
    }

    /**
     * @param minimum The minimum to set.
     */
    public void setMinimum(float minimum, boolean truncate) {
        if (minimum >= maximum) {
            return;
        }

        float oldMin = this.minimum;
        this.minimum = minimum;

        if (truncate) {
            setDefaultValue(LineUtils.truncate(getDefaultValue(), 
                    minimum, maximum));
        } else {
            setDefaultValue(LineUtils.rescale(getDefaultValue(), 
                    oldMin, maximum, minimum,
                    maximum, -1.0f));
        }

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null) {
                param.setMin(this.minimum, truncate);
            }
        }

        fireBSBObjectChanged();
    }

    /**
     * @return Returns the value.
     */
    public float getDefaultValue() {
        return defaultValue;
    }

    /**
     * @param value
     */
    public void setDefaultValue(float value) {
        float oldValue = this.defaultValue;
        this.defaultValue = value;

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null) {
                param.setValue(this.defaultValue);
            }
        }

        if (propListeners != null) {
            propListeners.firePropertyChange("defaultValue", new Float(oldValue),
                    new Float(this.defaultValue));
        }
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    @Override
    public String getPresetValue() {
        return NumberUtilities.formatFloat(getDefaultValue());
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    @Override
    public void setPresetValue(String val) {
        float fval = Float.parseFloat(val);
        setDefaultValue(fval);
    }

    @Override
    public void initializeParameters() {
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
                parameter.setValue(getDefaultValue());
            }

            return;
        }

        Parameter param = new Parameter();
        param.setValue(getDefaultValue());
        param.setMax(getMaximum(), true);
        param.setMin(getMinimum(), true);
        param.setName(getObjectName());
        param.setResolution(-1);
        param.addParameterListener(this);
        param.setValue(getDefaultValue());

        parameters.addParameter(param);
    }

    private void updateValue(float value) {
        float oldValue = this.defaultValue;
        this.defaultValue = value;

        if (propListeners != null) {
            propListeners.firePropertyChange("updateDefaultValue",
                    new Float(oldValue), new Float(this.defaultValue));
        }
    }

    @Override
    public void lineDataChanged(Parameter param) {
        Parameter parameter = parameters.getParameter(this.objectName);

        if (parameter != null) {
            float time = ParameterTimeManagerFactory.getInstance().getTime();
            float val = parameter.getLine().getValue(time);

            updateValue(val);
        }
    }

    @Override
    public void parameterChanged(Parameter param) {
    }

    // override to handle removing/adding parameters when this changes
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
}
