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
import java.awt.Font;
import java.math.BigDecimal;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.property.SimpleObjectProperty;
import javafx.beans.property.SimpleStringProperty;
import javafx.beans.property.StringProperty;


/**
 * @author Steven Yi
 *
 */
public class BSBKnob extends AutomatableBSBObject implements ParameterListener,
        Randomizable {

    ClampedValueListener cvl = (pType, bType) -> {
        if (parameters != null) {
            Parameter p = parameters.getParameter(getObjectName());
            if (p != null) {
                updateParameter(knobValueProperty(), p, pType, bType);
            }
        }
    };

    private ClampedValue knobValue;
    private final IntegerProperty knobWidth = new SimpleIntegerProperty(60);
    private final BooleanProperty randomizable = new SimpleBooleanProperty(true);
    private final BooleanProperty valueDisplayEnabled = new SimpleBooleanProperty(true);

    private final StringProperty label = new SimpleStringProperty("label");
    private final BooleanProperty labelEnabled = new SimpleBooleanProperty(true);
    private final ObjectProperty<Font> labelFont = new SimpleObjectProperty<>(new Font(Font.DIALOG, Font.PLAIN, 12));

    public BSBKnob() {
        knobValue = new ClampedValue(0.0, 1.0, 0.0, new BigDecimal(-1.0));
        knobValue.addListener(cvl);
    }

    public BSBKnob(BSBKnob knob) {
        super(knob);
        knobValue = new ClampedValue(knob.knobValueProperty());
        knobValue.addListener(cvl);
        setKnobWidth(knob.getKnobWidth());
        setRandomizable(knob.isRandomizable());
        setValueDisplayEnabled(knob.isValueDisplayEnabled());
        setLabel(knob.getLabel());
        setLabelEnabled(knob.isLabelEnabled());
        setLabelFont(knob.getLabelFont());
    }


    public final ClampedValue knobValueProperty() {
        return knobValue;
    }

    private final void setKnobValueProperty(ClampedValue value) {
        if(this.knobValue != null) {
            this.knobValue.removeListener(cvl);
        }
        this.knobValue = value;
        knobValue.addListener(cvl);
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

        // set false by default when loading for backwards compatibility with
        // Blue versions < 2.7.2
        knob.setLabelEnabled(false);

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
                case "valueDisplayEnabled":
                    knob.setValueDisplayEnabled(XMLUtilities.readBoolean(node));
                    break;
                case "label":
                    knob.setLabel(node.getTextString());
                    break;
                case "labelEnabled":
                    knob.setLabelEnabled(XMLUtilities.readBoolean(node));
                    break;
                case "font":
                    knob.setLabelFont(BSBFontUtil.loadFromXML(node));
                    break;
            }

        }

        // convert from relative to absolute values (0.110.0)
        if (version == 1) {
            double range = maxVal - minVal;
            value = (value * range) + minVal;
        }

        knob.setKnobValueProperty(new ClampedValue(minVal, maxVal, value, new BigDecimal(-1.0)));

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
        retVal.addElement(XMLUtilities.writeBoolean("valueDisplayEnabled",
                isValueDisplayEnabled()));


        retVal.addElement("label").setText(getLabel());
        retVal.addElement(XMLUtilities.writeBoolean("labelEnabled",
                isLabelEnabled()));
        retVal.addElement(BSBFontUtil.saveAsXML(getLabelFont()));

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

        compilationUnit.addReplacementValue(getObjectName(), Double.toString(
                knobValue.getValue()));
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

    public final void setValueDisplayEnabled(boolean value) {
        valueDisplayEnabled.set(value);
    }

    public final boolean isValueDisplayEnabled() {
        return valueDisplayEnabled.get();
    }

    public final BooleanProperty valueDisplayEnabledProperty() {
        return valueDisplayEnabled;
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

    public final void setLabelEnabled(boolean value) {
        labelEnabled.set(value);
    }

    public final boolean isLabelEnabled() {
        return labelEnabled.get();
    }

    public final BooleanProperty labelEnabledProperty() {
        return labelEnabled;
    }

    public final void setLabelFont(Font f) {
        labelFont.set(f);
    }

    public final Font getLabelFont() {
        return labelFont.get();
    }

    public final ObjectProperty<Font> labelFontProperty() {
        return labelFont;
    }

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
            double fval = Double.parseDouble(val);
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
        param.setResolution(new BigDecimal(-1));
        param.addParameterListener(this);
        param.setValue(getValue());

        parameters.add(param);
    }

    @Override
    public void lineDataChanged(Parameter param) {
        Parameter parameter = parameters.getParameter(this.getObjectName());

        if (parameter != null && param.isAutomationEnabled()) {
            double time = ParameterTimeManagerFactory.getInstance().getTime();
            double val = parameter.getLine().getValue(time);

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
    @Override
    public void randomize() {
        if (isRandomizable()) {
            double range = getMaximum() - getMinimum();
            double newValue = (Math.random() * range) + getMinimum();
            setValue(newValue);
        }
    }

    @Override
    public BSBObject deepCopy() {
        return new BSBKnob(this);
    }

}
