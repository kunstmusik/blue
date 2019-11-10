/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2005 Steven Yi (stevenyi@gmail.com)
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
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleIntegerProperty;

public class BSBXYController extends AutomatableBSBObject implements
        ParameterListener, Randomizable {

    private final IntegerProperty width = new SimpleIntegerProperty(100);
    private final IntegerProperty height = new SimpleIntegerProperty(80);
    private ClampedValue xValue;
    private ClampedValue yValue;
    private final BooleanProperty randomizable = new SimpleBooleanProperty(true);
    private final BooleanProperty valueDisplayEnabled = new SimpleBooleanProperty(true);

    ClampedValueListener xcvl = (pType, bType) -> {
        if (parameters != null) {
            Parameter p = parameters.getParameter(getObjectName() + "X");
            if (p != null) {
                updateParameter(xValueProperty(), p, pType, bType);
            }
        }
    };
    ClampedValueListener ycvl = (pType, bType) -> {
        if (parameters != null) {
            Parameter p = parameters.getParameter(getObjectName() + "Y");
            if (p != null) {
                updateParameter(yValueProperty(), p, pType, bType);
            }
        }
    };

    public BSBXYController() {
        xValue = new ClampedValue(0.0, 1.0, 0.5, new BigDecimal(-1.0));
        xValue.addListener(xcvl);
        yValue = new ClampedValue(0.0, 1.0, 0.5, new BigDecimal(-1.0));
        yValue.addListener(ycvl);
    }

    public BSBXYController(BSBXYController xy) {
        super(xy);
        xValue = new ClampedValue(xy.xValueProperty());
        xValue.addListener(xcvl);
        yValue = new ClampedValue(xy.yValueProperty());
        yValue.addListener(ycvl);

        setWidth(xy.getWidth());
        setHeight(xy.getHeight());
        setRandomizable(xy.isRandomizable());
        setValueDisplayEnabled(xy.isValueDisplayEnabled());
    }

    // OVERRIDE to handle parameter name changes and multiple parameters
    @Override
    public void setObjectName(String objectName) {
        String oldName = this.getObjectName();

        if (unm != null) {
            if (objectName != null && objectName.length() != 0) {
                if (!unm.isUnique(objectName + "X")
                        || !unm.isUnique(objectName + "Y")) {
                    return;
                }
            }
        }

        boolean doInitialize = false;

        if (parameters != null && automationAllowed) {
            if (objectName == null || objectName.length() == 0) {
                parameters.removeParameter(oldName + "X");
                parameters.removeParameter(oldName + "Y");
            } else {
                Parameter param = parameters.getParameter(oldName + "X");
                Parameter param2 = parameters.getParameter(oldName + "Y");

                if (param == null || param2 == null) {
                    parameters.removeParameter(oldName + "X");
                    parameters.removeParameter(oldName + "Y");
                    doInitialize = true;
                } else {
                    param.setName(objectName + "X");
                    param2.setName(objectName + "Y");
                }
            }
        }

        this.objectNameProperty().set(objectName);

        if (doInitialize) {
            initializeParameters();
        }

    }

    public final void setWidth(int value) {
        width.set(value);
    }

    public final int getWidth() {
        return width.get();
    }

    public final IntegerProperty widthProperty() {
        return width;
    }

    public final void setHeight(int value) {
        height.set(value);
    }

    public final int getHeight() {
        return height.get();
    }

    public final IntegerProperty heightProperty() {
        return height;
    }

    @Override
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

    public final void setValueDisplayEnabled(boolean value) {
        valueDisplayEnabled.set(value);
    }

    public final boolean isValueDisplayEnabled() {
        return valueDisplayEnabled.get();
    }

    public final BooleanProperty valueDisplayEnabledProperty() {
        return valueDisplayEnabled;
    }

    public final ClampedValue xValueProperty() {
        return xValue;
    }

    public final ClampedValue yValueProperty() {
        return yValue;
    }

    public final void setXValue(double val) {
        xValue.setValue(val);
    }

    public final double getXValue() {
        return xValue.getValue();
    }

    public final void setXMin(double value) {
        xValue.setMin(value);
    }

    public final double getXMin() {
        return xValue.getMin();
    }

    public final void setXMax(double value) {
        xValue.setMax(value);
    }

    public final double getXMax() {
        return xValue.getMax();
    }

    public final void setYValue(double val) {
        yValue.setValue(val);
    }

    public final double getYValue() {
        return yValue.getValue();
    }

    public final void setYMin(double value) {
        yValue.setMin(value);
    }

    public final double getYMin() {
        return yValue.getMin();
    }

    public final void setYMax(double value) {
        yValue.setMax(value);
    }

    public final double getYMax() {
        return yValue.getMax();
    }

    private final void setXValueProperty(ClampedValue value) {
        if (this.xValue != null) {
            this.xValue.removeListener(xcvl);
        }
        this.xValue = value;
        xValue.addListener(xcvl);
    }

    private final void setYValueProperty(ClampedValue value) {
        if (this.yValue != null) {
            this.yValue.removeListener(ycvl);
        }
        this.yValue = value;
        yValue.addListener(ycvl);
    }

    public static BSBObject loadFromXML(Element data) {
        BSBXYController xyController = new BSBXYController();

        initBasicFromXML(data, xyController);

        int version = 1;

        String versionStr = data.getAttributeValue("version");

        if (versionStr != null) {
            version = Integer.parseInt(versionStr);
        }

        double xmin = 0.0, xmax = 1.0, xval = 0.0;
        double ymin = 0.0, ymax = 1.0, yval = 0.0;

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            final String nodeText = node.getTextString();
            switch (nodeName) {
                case "width":
                    xyController.setWidth(Integer.parseInt(nodeText));
                    break;
                case "height":
                    xyController.setHeight(Integer.parseInt(nodeText));
                    break;
                case "xMin":
                    xmin = Double.parseDouble(nodeText);
                    break;
                case "xMax":
                    xmax = Double.parseDouble(nodeText);
                    break;
                case "yMin":
                    ymin = Double.parseDouble(nodeText);
                    break;
                case "yMax":
                    ymax = Double.parseDouble(nodeText);
                    break;
                case "xValue":
                    xval = Double.parseDouble(nodeText);
                    break;
                case "yValue":
                    yval = Double.parseDouble(nodeText);
                    break;
                case "randomizable":
                    xyController.setRandomizable(XMLUtilities.readBoolean(node));
                    break;
                case "valueDisplayEnabled":
                    xyController.setValueDisplayEnabled(XMLUtilities.readBoolean(node));
                    break;
            }
        }

        // convert from relative to absolute values (0.110.0)
        if (version == 1) {
            double xrange = xmax - xmin;
            xval = (xrange * xval) + xmin;

            double yrange = ymax - ymin;
            yval = (yrange * yval) + ymin;
        }

        xyController.setXValueProperty(
                new ClampedValue(xmin, xmax, xval, new BigDecimal(-1.0)));
        xyController.setYValueProperty(
                new ClampedValue(ymin, ymax, yval, new BigDecimal(-1.0)));

        return xyController;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.setAttribute("version", "2");

        retVal.addElement("width").setText(Integer.toString(getWidth()));
        retVal.addElement("height").setText(Integer.toString(getHeight()));

        retVal.addElement("xMin").setText(Double.toString(xValue.getMin()));
        retVal.addElement("xMax").setText(Double.toString(xValue.getMax()));
        retVal.addElement("yMin").setText(Double.toString(yValue.getMin()));
        retVal.addElement("yMax").setText(Double.toString(yValue.getMax()));

        retVal.addElement("xValue").setText(Double.toString(xValue.getValue()));
        retVal.addElement("yValue").setText(Double.toString(yValue.getValue()));

        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                isRandomizable()));
        retVal.addElement(XMLUtilities.writeBoolean("valueDisplayEnabled",
                isValueDisplayEnabled()));

        return retVal;
    }

    @Override
    public String[] getReplacementKeys() {
        String objectName = getObjectName();
        if (objectName == null || objectName.trim().length() == 0) {
            return new String[]{};
        }

        return new String[]{objectName + "X", objectName + "Y"};
    }

    @Override
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {

        String xCompVal = null;
        String yCompVal = null;
        String objectName = getObjectName();

        if (parameters != null) {
            Parameter param = parameters.getParameter(objectName + "X");

            if (param != null && param.getCompilationVarName() != null) {
                xCompVal = param.getCompilationVarName();
            }

            param = parameters.getParameter(objectName + "Y");

            if (param != null && param.getCompilationVarName() != null) {
                yCompVal = param.getCompilationVarName();
            }
        }

        compilationUnit.addReplacementValue(objectName + "X",
                (xCompVal == null) ? NumberUtilities.formatDouble(xValue.getValue())
                        : xCompVal);
        compilationUnit.addReplacementValue(objectName + "Y",
                (yCompVal == null) ? NumberUtilities.formatDouble(yValue.getValue())
                        : yCompVal);
    }

    @Override
    public String getPresetValue() {
        return "ver2:" + xValue.getValue() + ":" + yValue.getValue();
    }

    @Override
    public void setPresetValue(String val) {
        String[] vals = val.split(":");

        double xVal, yVal;

        // version1 uses relative values and has no ver string
        if (vals.length == 2) {
            xVal = Double.parseDouble(vals[0]);
            yVal = Double.parseDouble(vals[1]);

            xVal = (xVal * (xValue.getMax() - xValue.getMin())) + xValue.getMin();
            yVal = (yVal * (yValue.getMax() - yValue.getMin())) + yValue.getMin();
        } else {
            xVal = Double.parseDouble(vals[1]);
            yVal = Double.parseDouble(vals[2]);
        }

        xValue.setValue(xVal);
        yValue.setValue(yVal);
    }

    @Override
    public void initializeParameters() {
        if (parameters == null) {
            return;
        }

        String objectName = getObjectName();

        if (!automationAllowed) {
            if (objectName != null && objectName.length() != 0) {
                Parameter param = parameters.getParameter(objectName + "X");

                if (param != null && param.isAutomationEnabled()) {
                    automationAllowed = true;
                } else {
                    parameters.removeParameter(objectName + "X");
                    parameters.removeParameter(objectName + "Y");
                    return;
                }
            }
        }

        if (objectName == null || objectName.trim().length() == 0) {
            return;
        }

        Parameter param = parameters.getParameter(objectName + "X");
        Parameter param2 = parameters.getParameter(objectName + "Y");

        if (param != null && param2 != null) {
            param.addParameterListener(this);
            param2.addParameterListener(this);

            if (!param.isAutomationEnabled()) {
                param.setValue(xValue.getValue());
            }

            if (!param2.isAutomationEnabled()) {
                param2.setValue(yValue.getValue());
            }

            return;
        }

        // in case of corrupted file
        if (param != null || param2 != null) {
            parameters.removeParameter(objectName + "X");
            parameters.removeParameter(objectName + "Y");
            return;
        }

        param = new Parameter();
        param.setValue(xValue.getValue());
        param.setMax(xValue.getMax(), true);
        param.setMin(xValue.getMin(), true);
        param.setName(getObjectName() + "X");
        param.setResolution(new BigDecimal(-1));
        param.addParameterListener(this);
        param.setValue(xValue.getValue());

        parameters.add(param);

        param = new Parameter();
        param.setValue(yValue.getValue());
        param.setMax(yValue.getMax(), true);
        param.setMin(yValue.getMin(), true);
        param.setName(getObjectName() + "Y");
        param.setResolution(new BigDecimal(-1));
        param.addParameterListener(this);
        param.setValue(yValue.getValue());

        parameters.add(param);
    }

    @Override
    public void lineDataChanged(Parameter param) {
        if (param.isAutomationEnabled()) {
            double time = ParameterTimeManagerFactory.getInstance().getTime();
            double val = param.getLine().getValue(time);

            String paramName = param.getName();

            if (paramName.endsWith("X")) {
//            updateXValue(val);
                xValue.setValue(val);
            } else if (paramName.endsWith("Y")) {
//            updateYValue(val);
                yValue.setValue(val);
            }
        }
    }

    @Override
    public void parameterChanged(Parameter param) {
    }

    // override to handle removing/adding parameters when this changes
    @Override
    public void setAutomationAllowed(boolean allowAutomation) {
        this.automationAllowed = allowAutomation;
        String objectName = getObjectName();

        if (parameters != null) {
            if (allowAutomation) {
                initializeParameters();
            } else if (objectName != null && objectName.length() != 0) {
                parameters.removeParameter(objectName + "X");
                parameters.removeParameter(objectName + "Y");
            }
        }
    }

    /* RANDOMIZABLE METHODS */
    @Override
    public void randomize() {
        if (isRandomizable()) {
            xValue.randomizeValue();
            yValue.randomizeValue();
        }
    }

    @Override
    public BSBXYController deepCopy() {
        return new BSBXYController(this);
    }
}
