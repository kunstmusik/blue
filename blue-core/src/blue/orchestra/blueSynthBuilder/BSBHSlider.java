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
//import blue.orchestra.editor.blueSynthBuilder.BSBHSliderView;
//import blue.orchestra.editor.blueSynthBuilder.BSBObjectView;
import blue.utility.NumberUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

/**
 * @author Steven Yi
 * 
 */
public class BSBHSlider extends AutomatableBSBObject implements
        ParameterListener, Randomizable {

    public static final float defaultMinimum = 0.0f;

    public static final float defaultMaximum = 1.0f;

    float minimum = defaultMinimum;

    float maximum = defaultMaximum;

    float resolution = 0.1f;

    float value = 0.0f;

    int sliderWidth = 150;

    private boolean randomizable = true;

    // OVERRIDE to handle parameter name changes
    public void setObjectName(String objectName) {
        if (objectName == null || objectName.equals(getObjectName())) {
            return;
        }

        if (unm != null) {
            if (objectName != null && !objectName.equals("")
                    && !unm.isUnique(objectName)) {
                return;
            }
        }

        String oldName = this.getObjectName();

        boolean doInitialize = false;

        if (parameters != null && automationAllowed) {
            if (objectName == null || objectName.equals("")) {
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
        BSBHSlider slider = new BSBHSlider();
        float minVal = 0;
        float maxVal = 0;

        initBasicFromXML(data, slider);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("minimum")) {
                minVal = Float.parseFloat(node.getTextString());
            } else if (nodeName.equals("maximum")) {
                maxVal = Float.parseFloat(node.getTextString());
            } else if (nodeName.equals("resolution")) {
                slider.resolution = Float.parseFloat(node.getTextString());
            } else if (nodeName.equals("value")) {
                slider.value = Float.parseFloat(node.getTextString());
            } else if (nodeName.equals("sliderWidth")) {
                slider.setSliderWidth(Integer.parseInt(node.getTextString()));
            } else if (nodeName.equals("randomizable")) {
                slider.randomizable = XMLUtilities.readBoolean(node);
            }
        }

        // set min and max values
        if (minVal > BSBHSlider.defaultMaximum) {
            slider.maximum = maxVal;
            slider.minimum = minVal;
        } else {
            slider.minimum = minVal;
            slider.maximum = maxVal;
        }

        return slider;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BlueSynthBuilderObject#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement("minimum").setText(Float.toString(minimum));
        retVal.addElement("maximum").setText(Float.toString(maximum));
        retVal.addElement("resolution").setText(Float.toString(resolution));
        retVal.addElement("value").setText(Float.toString(value));
        retVal.addElement("sliderWidth").setText(Integer.toString(sliderWidth));

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
//        return new BSBHSliderView(this);
//    }

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
                    maximum, getResolution()));
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
                    maximum, getResolution()));
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
     * @return
     */
    public float getValue() {
        return this.value;
    }

    /**
     * @param value
     *            The value to set.
     */
    public void setValue(float value) {
        float oldValue = this.value;
        this.value = value;

        if (getResolution() > 0) {
            this.value = LineUtils.snapToResolution(this.value, minimum,
                    maximum, resolution);
        }

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

        compilationUnit.addReplacementValue(objectName, NumberUtilities
                .formatFloat(value));
    }

    /**
     * @return Returns the resolution.
     */
    public float getResolution() {
        return resolution;
    }

    /**
     * @param resolution
     *            The resolution to set.
     */
    public void setResolution(float resolution) {
        this.resolution = resolution;

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null) {
                param.setResolution(this.resolution);
            }
        }
    }

    /**
     * @return Returns the sliderWidth.
     */
    public int getSliderWidth() {
        return sliderWidth;
    }

    /**
     * @param sliderWidth
     *            The sliderWidth to set.
     */
    public void setSliderWidth(int sliderWidth) {
        this.sliderWidth = sliderWidth;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    public String getPresetValue() {
        return Float.toString(getValue());
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    public void setPresetValue(String val) {
        setValue(Float.parseFloat(val));
    }

    public void initializeParameters() {
        if (parameters == null) {
            return;
        }
                
        if(!automationAllowed) {
            if (objectName != null && !objectName.equals("")) {
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
        param.setResolution(getResolution());
        param.addParameterListener(this);
        param.setValue(getValue());

        parameters.addParameter(param);
    }

    public void updateValue(float value) {
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
            } else if (objectName != null && !objectName.equals("")) {
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
            float newValue;

            if (getResolution() > 0.0f) {
                long longRange = (long) (range / getResolution()) + 1;
                newValue = (float) ((Math.random() * longRange) * getResolution());
                newValue = newValue + getMinimum();
            } else {
                newValue = (float) (Math.random() * range) + getMinimum();
            }

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
