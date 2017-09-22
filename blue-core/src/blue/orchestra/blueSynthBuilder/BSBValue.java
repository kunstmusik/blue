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
import blue.utility.NumberUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.math.BigDecimal;
import javafx.beans.property.DoubleProperty;

/**
 * @author Steven Yi
 *
 */
public class BSBValue extends AutomatableBSBObject implements ParameterListener {

    ClampedValueListener cvl = (pType, bType) -> {
        if (parameters != null) {
            Parameter p = parameters.getParameter(getObjectName());
            if (p != null) {
                updateParameter(getDefaultValueProperty(), p, pType, bType);
            }
        }
    };

    private ClampedValue defaultValue;

    public BSBValue() {
        defaultValue = new ClampedValue(0.0, 1.0, 0.0, new BigDecimal(-1.0));
        defaultValue.addListener(cvl);
    }

    public BSBValue(BSBValue val) {
        super(val);
        defaultValue = new ClampedValue(val.defaultValue);
        defaultValue.addListener(cvl);
    }

    public final void setDefaultValue(double value) {
        defaultValue.setValue(value);
    }

    public final double getDefaultValue() {
        return defaultValue.getValue();
    }

    public final DoubleProperty defaultValueProperty() {
        return defaultValue.valueProperty();
    }

    public final void setMinimum(double value) {
        defaultValue.setMin(value);
    }

    public final double getMinimum() {
        return defaultValue.getMin();
    }

    public final DoubleProperty minimumProperty() {
        return defaultValue.minProperty();
    }

    public final void setMaximum(double value) {
        defaultValue.setMax(value);
    }

    public final double getMaximum() {
        return defaultValue.getMax();
    }

    public final DoubleProperty maximumProperty() {
        return defaultValue.maxProperty();
    }

    private final void setDefaultValueProperty(ClampedValue value) {
        if(this.defaultValue != null) {
            this.defaultValue.removeListener(cvl);
        }
        this.defaultValue = value;
        defaultValue.addListener(cvl);
    }

    private ClampedValue getDefaultValueProperty(){
        return defaultValue;
    }

    public static BSBObject loadFromXML(Element data) {
        BSBValue value = new BSBValue();
        double minVal = 0.0;
        double maxVal = 1.0;
        double val = 0.0;
        initBasicFromXML(data, value);

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
                case "defaultValue":
                    val = Double.parseDouble(nodeText);
                    break;
            }
        }

        value.setDefaultValueProperty(
                new ClampedValue(minVal, maxVal, val, new BigDecimal(-1.0)));

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

        retVal.addElement("minimum").setText(Double.toString(getMinimum()));
        retVal.addElement("maximum").setText(Double.toString(getMaximum()));
        retVal.addElement("defaultValue").setText(
                Double.toString(getDefaultValue()));

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
                compilationUnit.addReplacementValue(getObjectName(), param
                        .getCompilationVarName());
                return;
            }
        }

        compilationUnit.addReplacementValue(getObjectName(),
                Double.toString(getDefaultValue()));
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    @Override
    public String getPresetValue() {
        return NumberUtilities.formatDouble(getDefaultValue());
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    @Override
    public void setPresetValue(String val) {
        double fval = Double.parseDouble(val);
        setDefaultValue(fval);
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
                parameter.setValue(getDefaultValue());
            }

            return;
        }

        Parameter param = new Parameter();
        param.setValue(getDefaultValue());
        param.setMax(getMaximum(), true);
        param.setMin(getMinimum(), true);
        param.setName(getObjectName());
        param.setResolution(new BigDecimal(-1));
        param.addParameterListener(this);
        param.setValue(getDefaultValue());

        parameters.add(param);
    }

    @Override
    public void lineDataChanged(Parameter param) {
        Parameter parameter = parameters.getParameter(this.getObjectName());

        if (parameter != null) {
            double time = ParameterTimeManagerFactory.getInstance().getTime();
            double val = parameter.getLine().getValue(time);

            setDefaultValue(val);
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

    @Override
    public BSBObject deepCopy() {
        return new BSBValue(this);
    }
}
