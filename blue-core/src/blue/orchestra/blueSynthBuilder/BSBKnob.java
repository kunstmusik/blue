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
import blue.utility.NumberUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleIntegerProperty;

/**
 * @author Steven Yi
 *
 */
public class BSBKnob extends AutomatableBSBObject implements ParameterListener,
        Randomizable {

    private ClampedValue knobValue;

    private IntegerProperty knobWidth;

    private BooleanProperty randomizable;

    public BSBKnob() {
        knobValue = new ClampedValue(0.0, 1.0, 0.0);
        knobWidth = new SimpleIntegerProperty(60);
        randomizable = new SimpleBooleanProperty(true);
    }

    public final void setKnobWidth(int value) {
        knobWidth.set(value);
    }

    public final int getKnobWidth() {
        return knobWidth.get();
    }

    public final IntegerProperty knobWidthProperty() {
        return knobWidth;
    }

    public final void setRandomizable(boolean value) {
        randomizable.set(value);
    }

    public final boolean isRandomizable() {
        return randomizable.get();
    }

    public final BooleanProperty randomizableProperty() {
        return randomizable;
    }

    public final ClampedValue knobValueProperty() {
        return knobValue;
    }

    public final void setValue(double val) {
        knobValue.setValue(val);
    }

    public final double getValue() {
        return knobValue.getValue();
    }

    public final void setMinimum(double value) {
        knobValue.setMin(value);
    }

    public final double getMinimum() {
        return knobValue.getMin();
    }

    public final void setMaximum(double value) {
        knobValue.setMax(value);
    }

    public final double getMaximum() {
        return knobValue.getMax();
    }

    public static BSBObject loadFromXML(Element data) {
        BSBKnob knob = new BSBKnob();
        double minVal = 0;
        double maxVal = 0;
        double value = 0;
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
            switch (nodeName) {
                case "minimum":
                    minVal = Double.parseDouble(node.getTextString());
                    break;
                case "maximum":
                    maxVal = Double.parseDouble(node.getTextString());
                    break;
                case "value":
                    value = Double.parseDouble(node.getTextString());
                    break;
                case "knobWidth":
                    knob.setKnobWidth(Integer.parseInt(node.getTextString()));
                    break;
                case "randomizable":
                    knob.setRandomizable(XMLUtilities.readBoolean(node));
                    break;
            }

        }

        // set min and max values
        if (minVal > 1.0f) {
            knob.setMaximum(maxVal);
            knob.setMinimum(minVal);
        } else {
            knob.setMinimum(minVal);
            knob.setMaximum(maxVal);
        }


        // convert from relative to absolute values (0.110.0)
        if (version == 1) {
            double range = maxVal - minVal;
            value = (value * range) + minVal;
        }

        knob.setValue(value);

        return knob;
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

        retVal.addElement("minimum").setText(Double.toString(getMinimum()));
        retVal.addElement("maximum").setText(Double.toString(getMaximum()));
        retVal.addElement("value").setText(Double.toString(getValue()));
        retVal.addElement("knobWidth").setText(Integer.toString(getKnobWidth()));

        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                isRandomizable()));

        return retVal;
    }

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

        compilationUnit.addReplacementValue(objectName, Double.toString(
                knobValue.getValue()));
    }

//    /**
//     * @param maximum
//     *            The maximum to set.
//     */
//    public void setMaximum(float maximum, boolean truncate) {
//        if (maximum <= getMinimum()) {
//            return;
//        }
//        float oldMax = this.maximum;
//
//        this.maximum = maximum;
//
//        if (truncate) {
//            setValue(LineUtils.truncate(getValue(), minimum, maximum));
//        } else {
//            setValue(LineUtils.rescale(getValue(), minimum, oldMax, minimum,
//                    maximum, -1.0f));
//        }
//
//        if (parameters != null) {
//            Parameter param = parameters.getParameter(this.getObjectName());
//            if (param != null) {
//                param.setMax(this.maximum, truncate);
//            }
//        }
//
//        fireBSBObjectChanged();
//    }
//    /**
//     * @param minimum
//     *            The minimum to set.
//     */
//    public void setMinimum(float minimum, boolean truncate) {
//        if (minimum >= maximum) {
//            return;
//        }
//
//        float oldMin = this.minimum;
//        this.minimum = minimum;
//
//        if (truncate) {
//            setValue(LineUtils.truncate(getValue(), minimum, maximum));
//        } else {
//            setValue(LineUtils.rescale(getValue(), oldMin, maximum, minimum,
//                    maximum, -1.0f));
//        }
//
//        if (parameters != null) {
//            Parameter param = parameters.getParameter(this.getObjectName());
//            if (param != null) {
//                param.setMin(this.minimum, truncate);
//            }
//        }
//
//        fireBSBObjectChanged();
//    }
//    /**
//     * @param value
//     */
//    public void setValue(float value) {
//        float oldValue = this.value;
//        this.value = value;
//
//        if (parameters != null) {
//            Parameter param = parameters.getParameter(this.getObjectName());
//            if (param != null) {
//                param.setValue(this.value);
//            }
//        }
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("value", new Float(oldValue),
//                    new Float(this.value));
//        }
//    }
    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    @Override
    public String getPresetValue() {
        return "ver2:" + NumberUtilities.formatDouble(knobValue.getValue());
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    @Override
    public void setPresetValue(String val) {
        double dval;

        // version1 uses relative values and has no ver string
        if (val.indexOf(':') < 0) {
            float fval = Float.parseFloat(val);
            dval = (fval * (knobValue.getMax() - knobValue.getMin()))
                    + knobValue.getMin();
        } else {
            String[] parts = val.split(":");
            dval = Double.parseDouble(parts[1]);
        }

        setValue(dval);
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
                parameter.setValue((float) getValue());
            }

            return;
        }

        Parameter param = new Parameter();
        param.setValue((float) getValue());
        param.setMax((float) getMaximum(), true);
        param.setMin((float) getMinimum(), true);
        param.setName(getObjectName());
        param.setResolution(-1);
        param.addParameterListener(this);
        param.setValue((float) getValue());

        parameters.addParameter(param);
    }

    private void updateValue(float value) {
//        float oldValue = this.value;
//        this.value = value;
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("updateValue",
//                    new Float(oldValue), new Float(this.value));
//        }
        setValue(value);
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

    /* RANDOMIZABLE METHODS */
    @Override
    public void randomize() {
        if (isRandomizable()) {
            double range = getMaximum() - getMinimum();
            double newValue = (Math.random() * range) + getMinimum();
            setValue(newValue);
        }
    }

}
