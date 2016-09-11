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
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleIntegerProperty;

/**
 * @author Steven Yi
 *
 */
public class BSBVSlider extends AutomatableBSBObject implements
        ParameterListener, Randomizable {

    DoubleProperty minimum;

    DoubleProperty maximum;

    DoubleProperty resolution;

    DoubleProperty value;

    IntegerProperty sliderHeight;

    BooleanProperty randomizable;

    public BSBVSlider() {
        minimum = new SimpleDoubleProperty(0.0);
        maximum = new SimpleDoubleProperty(1.0);
        resolution = new SimpleDoubleProperty(0.1);
        value = new SimpleDoubleProperty(0.0) {
            @Override
            public void set(double newValue) {
                double v = newValue;
                if (getResolution() > 0) {
                    v = LineUtils.snapToResolution(v, getMinimum(),
                            getMaximum(), getResolution());
                }

                super.set(v);

                // FIXME - don't think this should be set here
                if (parameters != null) {
                    Parameter param = parameters.getParameter(getObjectName());
                    if (param != null) {
                        param.setValue((float)v);
                    }
                }
            }
            
        };
        sliderHeight = new SimpleIntegerProperty(150);
        randomizable = new SimpleBooleanProperty(true);
    }

    public final void setMinimum(double value) {
        minimum.set(value);
    }

    public final double getMinimum() {
        return minimum.get();
    }

    public final DoubleProperty minimumProperty() {
        return minimum;
    }

    public final void setMaximum(double value) {
        maximum.set(value);
    }

    public final double getMaximum() {
        return maximum.get();
    }

    public final DoubleProperty maximumProperty() {
        return maximum;
    }

    public final void setResolution(double value) {
        resolution.set(value);
    }

    public final double getResolution() {
        return resolution.get();
    }

    public final DoubleProperty resolutionProperty() {
        return resolution;
    }

    public final void setValue(double val) {
        value.set(val);
    }

    public final double getValue() {
        return value.get();
    }

    public final DoubleProperty valueProperty() {
        return value;
    }

    public final void setSliderHeight(int value) {
        sliderHeight.set(value);
    }

    public final int getSliderHeight() {
        return sliderHeight.get();
    }

    public final IntegerProperty sliderHeightProperty() {
        return sliderHeight;
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


    
    private static double parseNum(String string, int version) {
       if(version < 2) {
           return (double)Float.parseFloat(string);
       } 
       return Double.parseDouble(string);
    }

    public static BSBObject loadFromXML(Element data) {
        BSBVSlider slider = new BSBVSlider();
        double minVal = 0;
        double maxVal = 0;

        initBasicFromXML(data, slider);
        String verString = data.getAttributeValue("version");
        int version = (verString == null) ? 1 : Integer.parseInt(verString);


        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "minimum":
                    minVal = parseNum(node.getTextString(), version);
                    break;
                case "maximum":
                    maxVal = parseNum(node.getTextString(), version);
                    break;
                case "resolution":
                    slider.setResolution(parseNum(node.getTextString(), version));
                    break;
                case "value":
                    slider.setValue(parseNum(node.getTextString(), version));
                    break;
                case "sliderHeight":
                    slider.setSliderHeight(Integer.parseInt(node.getTextString()));
                    break;
                case "randomizable":
                    slider.setRandomizable(XMLUtilities.readBoolean(node));
                    break;
            }
        }

        // set min and max values
        if (minVal > slider.getMaximum()) {
            slider.setMaximum(maxVal);
            slider.setMinimum(minVal);
        } else {
            slider.setMinimum(minVal);
            slider.setMaximum(maxVal);
        }

        return slider;
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
        retVal.addElement("resolution").setText(Double.toString(getResolution()));
        retVal.addElement("value").setText(Double.toString(getValue()));
        retVal.addElement("sliderHeight").setText(Integer.toString(getSliderHeight()));

        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                isRandomizable()));

        return retVal;
    }

//    /**
//     * @return Returns the maximum.
//     */
//    public float getMaximum() {
//        return maximum;
//    }
//
//    /**
//     * @param maximum The maximum to set.
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
//                    maximum, getResolution()));
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
//
//    /**
//     * @return Returns the minimum.
//     */
//    public float getMinimum() {
//        return minimum;
//    }
//
//    /**
//     * @param minimum The minimum to set.
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
//                    maximum, getResolution()));
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
//
//    /**
//     * @return
//     */
//    public float getValue() {
//        return this.value;
//    }
//
//    /**
//     * @param value The value to set.
//     */
//    public void setValue(float value) {
//        float oldValue = this.value;
//        this.value = value;
//
//        if (getResolution() > 0) {
//            this.value = LineUtils.snapToResolution(this.value, minimum,
//                    maximum, resolution);
//        }
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

        compilationUnit.addReplacementValue(objectName, NumberUtilities
                .formatDouble(getValue()));
    }

//    /**
//     * @return Returns the resolution.
//     */
//    public float getResolution() {
//        return resolution;
//    }
//
//    /**
//     * @param resolution The resolution to set.
//     */
//    public void setResolution(float resolution) {
//        this.resolution = resolution;
//
//        if (parameters != null) {
//            Parameter param = parameters.getParameter(this.getObjectName());
//            if (param != null) {
//                param.setResolution(this.resolution);
//            }
//        }
//    }
//
//    /**
//     * @return Returns the sliderHeight.
//     */
//    public int getSliderHeight() {
//        return sliderHeight;
//    }
//
//    /**
//     * @param sliderHeight The sliderHeight to set.
//     */
//    public void setSliderHeight(int sliderHeight) {
//        this.sliderHeight = sliderHeight;
//    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    @Override
    public String getPresetValue() {
        return Double.toString(getValue());
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    @Override
    public void setPresetValue(String val) {
        setValue(Double.parseDouble(val));
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
                // FIXME - make parameters use double??
                parameter.setValue((float)getValue());
            }

            return;
        }

        Parameter param = new Parameter();
        param.setValue((float)getValue());
        param.setMax((float)getMaximum(), true);
        param.setMin((float)getMinimum(), true);
        param.setName(getObjectName());
        param.setResolution((float)getResolution());
        param.addParameterListener(this);
        param.setValue((float)getValue());

        parameters.addParameter(param);
    }

//    public void updateValue(float value) {
//        float oldValue = this.value;
//        this.value = value;
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("updateValue",
//                    new Float(oldValue), new Float(this.value));
//        }
//    }

    @Override
    public void lineDataChanged(Parameter param) {
        Parameter parameter = parameters.getParameter(this.objectName);

        if (parameter != null) {
            float time = ParameterTimeManagerFactory.getInstance().getTime();
            float val = parameter.getLine().getValue(time);
//            updateValue(val);
            setValue(val);
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
//    @Override
//    public boolean isRandomizable() {
//        return randomizable;
//    }

    @Override
    public void randomize() {
        if (isRandomizable()) {
            double range = getMaximum() - getMinimum();
            double newValue;

            if (getResolution() > 0.0f) {
                long longRange = (long) (range / getResolution()) + 1;
                newValue = ((Math.random() * longRange) * getResolution());
                newValue = newValue + getMinimum();
            } else {
                newValue = (Math.random() * range) + getMinimum();
            }

            double oldValue = this.getValue();

            setValue(newValue);

            if (propListeners != null) {
                propListeners.firePropertyChange("updateValue", new Double(
                        oldValue), new Double(newValue));
            }
        }
    }

//    @Override
//    public void setRandomizable(boolean randomizable) {
//        this.randomizable = randomizable;
//        fireBSBObjectChanged();
//    }
}
