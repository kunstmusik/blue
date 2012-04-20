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
import blue.components.lines.LineUtils;
import blue.utility.NumberUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

/**
 * @author Steven Yi
 * 
 */
public class BSBKnob extends AutomatableBSBObject implements ParameterListener,
        Randomizable {

    public static final float defaultMinimum = 0.0f;

    public static final float defaultMaximum = 1.0f;

    float value = 0.0f;

    float minimum = defaultMinimum;

    float maximum = defaultMaximum;

    int knobWidth = 60;

    private boolean randomizable = true;

    // OVERRIDE to handle parameter name changes
    public void setObjectName(String objectName) {
        if (objectName == null || objectName.equals(getObjectName())) {
            return;
        }

        if (unm != null) {
            if (objectName != null && objectName.length() != 0
                    && !unm.isUnique(objectName)) {
                return;
            }
        }

        String oldName = this.getObjectName();

        boolean doInitialize = false;

        if (parameters != null && automationAllowed) {
            if (objectName == null || objectName.length() == 0) {
                parameters.removeParameter(oldName);
            } else {
                Parameter param = parameters.getParameter(oldName);

                if (param == null) {
                    doInitialize = true;
                } else {
                    param.setName(objectName);
                }
            }
        }

        super.setObjectName(objectName);

        if (doInitialize) {
            initializeParameters();
        }
    }

    public static BSBObject loadFromXML(Element data) {
        BSBKnob knob = new BSBKnob();
        float minVal = 0;
        float maxVal = 0;
        initBasicFromXML(data, knob);

        int version = 1;

        String versionStr = data.getAttributeValue("version");

        if (versionStr != null) {
            version = Integer.parseInt(versionStr);
        }

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("minimum")) {
                minVal = Float.parseFloat(node.getTextString());
            } else if (nodeName.equals("maximum")) {
                maxVal = Float.parseFloat(node.getTextString());
            } else if (nodeName.equals("value")) {
                knob.value = Float.parseFloat(node.getTextString());
            } else if (nodeName.equals("knobWidth")) {
                knob.setKnobWidth(Integer.parseInt(node.getTextString()));
            } else if (nodeName.equals("randomizable")) {
                knob.randomizable = XMLUtilities.readBoolean(node);
            }

        }

        // set min and max values
        if (minVal > BSBKnob.defaultMaximum) {
            knob.maximum = maxVal;
            knob.minimum = minVal;
        } else {
            knob.minimum = minVal;
            knob.maximum = maxVal;
        }

        // convert from relative to absolute values (0.110.0)
        if (version == 1) {
            float range = knob.maximum - knob.minimum;
            knob.value = (knob.value * range) + knob.minimum;
        }

        return knob;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BlueSynthBuilderObject#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.setAttribute("version", "2");

        retVal.addElement("minimum").setText(Float.toString(minimum));
        retVal.addElement("maximum").setText(Float.toString(maximum));
        retVal.addElement("value").setText(Float.toString(value));
        retVal.addElement("knobWidth").setText(Integer.toString(knobWidth));

        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                randomizable));

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
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null && param.getCompilationVarName() != null) {
                compilationUnit.addReplacementValue(objectName, param
                        .getCompilationVarName());
                return;
            }
        }

        compilationUnit.addReplacementValue(objectName, Float.toString(value));
    }

    // ACCESSOR METHODS

    /**
     * @return Returns the maximum.
     */
    public float getMaximum() {
        return maximum;
    }

    /**
     * @param maximum
     *            The maximum to set.
     */
    public void setMaximum(float maximum, boolean truncate) {
        if (maximum <= getMinimum()) {
            return;
        }
        float oldMax = this.maximum;

        this.maximum = maximum;

        if (truncate) {
            setValue(LineUtils.truncate(getValue(), minimum, maximum));
        } else {
            setValue(LineUtils.rescale(getValue(), minimum, oldMax, minimum,
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
     * @param minimum
     *            The minimum to set.
     */
    public void setMinimum(float minimum, boolean truncate) {
        if (minimum >= maximum) {
            return;
        }

        float oldMin = this.minimum;
        this.minimum = minimum;

        if (truncate) {
            setValue(LineUtils.truncate(getValue(), minimum, maximum));
        } else {
            setValue(LineUtils.rescale(getValue(), oldMin, maximum, minimum,
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
    public float getValue() {
        return value;
    }

    /**
     * @param value
     */
    public void setValue(float value) {
        float oldValue = this.value;
        this.value = value;

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null) {
                param.setValue(this.value);
            }
        }

        if (propListeners != null) {
            propListeners.firePropertyChange("value", new Float(oldValue),
                    new Float(this.value));
        }
    }

    /**
     * @return Returns the knobWidth.
     */
    public int getKnobWidth() {
        return knobWidth;
    }

    /**
     * @param knobWidth
     *            The knobWidth to set.
     */
    public void setKnobWidth(int knobWidth) {
        this.knobWidth = knobWidth;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    public String getPresetValue() {
        return "ver2:" + NumberUtilities.formatFloat(getValue());
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    public void setPresetValue(String val) {
        float fval;

        // version1 uses relative values and has no ver string
        if (val.indexOf(':') < 0) {
            fval = Float.parseFloat(val);
            fval = (fval * (maximum - minimum)) + minimum;
        } else {
            String[] parts = val.split(":");
            fval = Float.parseFloat(parts[1]);
        }

        setValue(fval);
    }

    public void initializeParameters() {
        if (parameters == null) {
            return;
        }
        
        if(!automationAllowed) {
            if (objectName != null && objectName.length() != 0) {
                Parameter param = parameters.getParameter(objectName);
                if(param != null && param.isAutomationEnabled()) {
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
            
            if(!parameter.isAutomationEnabled()) {
                parameter.setValue(getValue());
            }
            
            return;
        }

        Parameter param = new Parameter();
        param.setValue(getValue());
        param.setMax(getMaximum(), true);
        param.setMin(getMinimum(), true);
        param.setName(getObjectName());
        param.setResolution(-1);
        param.addParameterListener(this);
        param.setValue(getValue());

        parameters.addParameter(param);
    }

    private void updateValue(float value) {
        float oldValue = this.value;
        this.value = value;

        if (propListeners != null) {
            propListeners.firePropertyChange("updateValue",
                    new Float(oldValue), new Float(this.value));
        }
    }

    public void lineDataChanged(Parameter param) {
        Parameter parameter = parameters.getParameter(this.objectName);

        if (parameter != null) {
            float time = ParameterTimeManagerFactory.getInstance().getTime();
            float val = parameter.getLine().getValue(time);

            updateValue(val);
        }
    }

    public void parameterChanged(Parameter param) {
    }

    // override to handle removing/adding parameters when this changes
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

    /* RANDOMIZABLE METHODS */

    public boolean isRandomizable() {
        return randomizable;
    }

    public void randomize() {
        if (randomizable) {
            float range = getMaximum() - getMinimum();

            float newValue = (float) (Math.random() * range) + getMinimum();

            float oldValue = this.value;

            setValue(newValue);

            if (propListeners != null) {
                propListeners.firePropertyChange("updateValue", new Float(
                        oldValue), new Float(this.value));
            }
        }
    }

    public void setRandomizable(boolean randomizable) {
        this.randomizable = randomizable;
        fireBSBObjectChanged();
    }
}