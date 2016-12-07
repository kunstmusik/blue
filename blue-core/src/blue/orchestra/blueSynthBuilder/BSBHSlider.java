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
import java.math.BigDecimal;
import java.math.RoundingMode;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleIntegerProperty;

/**
 * @author Steven Yi
 *
 */
public class BSBHSlider extends AutomatableBSBObject implements
        ParameterListener, Randomizable {

    ClampedValueListener cvl = (pType, bType) -> {
        if (parameters != null) {
            Parameter p = parameters.getParameter(getObjectName());
            if (p != null) {
                updateParameter(getValueProperty(), p, pType, bType);
            }
        }
    };

    private ClampedValue value;

    private IntegerProperty sliderWidth = new SimpleIntegerProperty(150);

    private BooleanProperty randomizable = new SimpleBooleanProperty(true);
    private BooleanProperty valueDisplayEnabled = new SimpleBooleanProperty(true);

    public BSBHSlider() {
        value = new ClampedValue(0.0, 1.0, 0.0, new BigDecimal("0.1"));
        value.addListener(cvl);
    }

    public BSBHSlider(BSBHSlider slider) {
        super(slider);
        value = new ClampedValue(slider.value);
        value.addListener(cvl);
        setSliderWidth(slider.getSliderWidth());
        setRandomizable(slider.isRandomizable());
        setValueDisplayEnabled(slider.isValueDisplayEnabled());
    }

    public final void setMinimum(double val) {
        value.setMin(val);
    }

    public final double getMinimum() {
        return value.getMin();
    }

    public final DoubleProperty minimumProperty() {
        return value.minProperty();
    }

    public final void setMaximum(double val) {
        value.setMax(val);
    }

    public final double getMaximum() {
        return value.getMax();
    }

    public final DoubleProperty maximumProperty() {
        return value.maxProperty();
    }

    public final void setResolution(BigDecimal val) {
        value.setResolution(val);
    }

    public final BigDecimal getResolution() {
        return value.getResolution();
    }

    public final ObjectProperty<BigDecimal> resolutionProperty() {
        return value.resolutionProperty();
    }

    public final void setValue(double val) {
        value.setValue(val);
    }

    public final double getValue() {
        return value.getValue();
    }

    public final DoubleProperty valueProperty() {
        return value.valueProperty();
    }

    private final void setValueProperty(ClampedValue value) {
        if (this.value != null) {
            this.value.removeListener(cvl);
        }
        this.value = value;
        this.value.addListener(cvl);
    }

    public final void setSliderWidth(Integer value) {
        sliderWidth.set(value);
    }

    public final Integer getSliderWidth() {
        return sliderWidth.get();
    }

    public final IntegerProperty sliderWidthProperty() {
        return sliderWidth;
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

    public final boolean isValueDisplayEnabled(){
        return valueDisplayEnabled.get();
    }

    public final void setValueDisplayEnabled(boolean enabled){
        valueDisplayEnabled.set(enabled);
    }

    public final BooleanProperty valueDisplayEnabledProperty(){
        return valueDisplayEnabled;
    }

    public static BSBObject loadFromXML(Element data) {
        BSBHSlider slider = new BSBHSlider();
        double minVal = 0.0;
        double maxVal = 1.0;
        double val = 0.0;
        BigDecimal res = new BigDecimal("0.1");

        initBasicFromXML(data, slider);
        String verString = data.getAttributeValue("version");
        int version = (verString == null) ? 1 : Integer.parseInt(verString);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            final String nodeText = node.getTextString();
            switch (nodeName) {
                case "minimum":
                    minVal = Double.parseDouble(nodeText);
                    break;
                case "maximum":
                    maxVal = Double.parseDouble(nodeText);
                    break;
                case "resolution":
                    res = new BigDecimal(Double.parseDouble(nodeText))
                            .setScale(5, RoundingMode.HALF_UP)
                            .stripTrailingZeros();
                    break;
                case "bdresolution":
                    res = new BigDecimal(nodeText);
                    break;
                case "value":
                    val = Double.parseDouble(nodeText);
                    break;
                case "sliderWidth":
                    slider.setSliderWidth(Integer.parseInt(nodeText));
                    break;
                case "randomizable":
                    slider.setRandomizable(XMLUtilities.readBoolean(node));
                    break;
                case "valueDisplayEnabled":
                    slider.setValueDisplayEnabled(XMLUtilities.readBoolean(node));
                    break;
            }
        }

        slider.setValueProperty(new ClampedValue(minVal, maxVal, val, res));

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
        retVal.addElement("bdresolution").setText(getResolution().toString());
        retVal.addElement("value").setText(Double.toString(getValue()));
        retVal.addElement("sliderWidth").setText(Integer.toString(getSliderWidth()));

        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                isRandomizable()));
        retVal.addElement(XMLUtilities.writeBoolean("valueDisplayEnabled",
                isValueDisplayEnabled()));

        return retVal;
    }

//    /**
//     * @return Returns the maximum.
//     */
//    public double getMaximum() {
//        return maximum;
//    }
//
//    /**
//     * @param maximum The maximum to set.
//     */
//    public void setMaximum(double maximum, boolean truncate) {
//        if (maximum <= getMinimum()) {
//            return;
//        }
//        double oldMax = this.maximum;
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
//    public double getMinimum() {
//        return minimum;
//    }
//
//    /**
//     * @param minimum The minimum to set.
//     */
//    public void setMinimum(double minimum, boolean truncate) {
//        if (minimum >= maximum) {
//            return;
//        }
//
//        double oldMin = this.minimum;
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
//    public double getValue() {
//        return this.value;
//    }
//
//    /**
//     * @param value The value to set.
//     */
//    public void setValue(double value) {
//        double oldValue = this.value;
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
//            propListeners.firePropertyChange("value", new Double(oldValue),
//                    new Double(this.value));
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
                compilationUnit.addReplacementValue(getObjectName(), param
                        .getCompilationVarName());
                return;
            }
        }

        compilationUnit.addReplacementValue(getObjectName(), NumberUtilities
                .formatDouble(getValue()));
    }

//    /**
//     * @return Returns the resolution.
//     */
//    public double getResolution() {
//        return resolution;
//    }
//
//    /**
//     * @param resolution The resolution to set.
//     */
//    public void setResolution(double resolution) {
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
//     * @return Returns the sliderWidth.
//     */
//    public int getSliderWidth() {
//        return sliderWidth;
//    }
//
//    /**
//     * @param sliderWidth The sliderWidth to set.
//     */
//    public void setSliderWidth(int sliderWidth) {
//        this.sliderWidth = sliderWidth;
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

//    public void updateValue(double value) {
//        double oldValue = this.value;
//        this.value = value;
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("updateValue",
//                    new Double(oldValue), new Double(this.value));
//        }
//    }
    @Override
    public void lineDataChanged(Parameter param) {
        Parameter parameter = parameters.getParameter(this.getObjectName());

        if (parameter != null) {
            double time = ParameterTimeManagerFactory.getInstance().getTime();
            double val = parameter.getLine().getValue(time);
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
            } else if (getObjectName() != null && getObjectName().length() != 0) {
                parameters.removeParameter(getObjectName());
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

            if (getResolution().doubleValue() > 0.0f) {
                BigDecimal newV = new BigDecimal(range * Math.random())
                        .setScale(getResolution().scale(), RoundingMode.HALF_UP);
                newV = newV.subtract(newV.remainder(getResolution()));
                newValue = newV.doubleValue() + getMinimum();
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

    @Override
    public BSBObject deepCopy() {
        return new BSBHSlider(this);
    }

    private ClampedValue getValueProperty() {
        return value;
    }
}
