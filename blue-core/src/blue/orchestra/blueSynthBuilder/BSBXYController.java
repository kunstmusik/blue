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
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleIntegerProperty;

public class BSBXYController extends AutomatableBSBObject implements
        ParameterListener, Randomizable {

    private final IntegerProperty width = new SimpleIntegerProperty(100);
    private final IntegerProperty height = new SimpleIntegerProperty(80);
    private final ClampedValue xValue;
    private final ClampedValue yValue;
    private final BooleanProperty randomizable = new SimpleBooleanProperty(true);

    public BSBXYController() {
        xValue = new ClampedValue(0.0, 1.0, 0.5);
        yValue = new ClampedValue(0.0, 1.0, 0.5);
    }

    public BSBXYController(BSBXYController xy) {
        super(xy);
        xValue = new ClampedValue(xy.xValueProperty());
        yValue = new ClampedValue(xy.yValueProperty());
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

        this.objectName = objectName;

        if (propListeners != null) {
            propListeners.firePropertyChange("objectName", oldName,
                    this.objectName);
        }

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

    public static BSBObject loadFromXML(Element data) {
        BSBXYController xyController = new BSBXYController();

        initBasicFromXML(data, xyController);

        int version = 1;

        String versionStr = data.getAttributeValue("version");

        if (versionStr != null) {
            version = Integer.parseInt(versionStr);
        }

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
                    xyController.xValue.setMin(Double.parseDouble(nodeText));
                    break;
                case "xMax":
                    xyController.xValue.setMax(Double.parseDouble(nodeText));
                    break;
                case "yMin":
                    xyController.xValue.setMin(Double.parseDouble(nodeText));
                    break;
                case "yMax":
                    xyController.yValue.setMax(Double.parseDouble(nodeText));
                    break;
                case "xValue":
                    xyController.xValue.setValue(Double.parseDouble(nodeText));
                    break;
                case "yValue":
                    xyController.yValue.setValue(Double.parseDouble(nodeText));
                    break;
                case "randomizable":
                    xyController.setRandomizable(XMLUtilities.readBoolean(node));
                    break;
            }
        }

        // convert from relative to absolute values (0.110.0)
        if (version == 1) {
            double xrange = xyController.xValue.getMax() - xyController.xValue.getMin();
            xyController.xValue.setValue(
                    (xyController.xValue.getValue() * xrange)
                    + xyController.xValue.getMin());

            double yrange = xyController.yValue.getMax() - xyController.yValue.getMin();
            xyController.yValue.setValue(
                    (xyController.yValue.getValue() * yrange)
                    + xyController.yValue.getMin());
        }

        return xyController;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = super.getBasicXML(this);

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

        return retVal;
    }

//    public BSBObjectView getBSBObjectView() {
//        return new BSBXYControllerView(this);
//    }
    @Override
    public String[] getReplacementKeys() {
        if (this.objectName == null || this.objectName.trim().length() == 0) {
            return new String[]{};
        }

        return new String[]{this.objectName + "X", this.objectName + "Y"};
    }

    @Override
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {

        String xCompVal = null;
        String yCompVal = null;

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


//    public double getXValue() {
//        return xValue;
//    }
//
//    public void setXValue(double value) {
//        double oldVal = xValue;
//        xValue = value;
//
//        if (parameters != null) {
//            Parameter param = parameters.getParameter(this.getObjectName()
//                    + "X");
//            if (param != null) {
//                param.setValue(this.xValue);
//            }
//        }
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("xValue", new Double(oldVal),
//                    new Double(value));
//        }
//    }
//
//    public double getYValue() {
//        return yValue;
//    }
//
//    public void setYValue(double value) {
//        double oldVal = yValue;
//        yValue = value;
//
//        if (parameters != null) {
//            Parameter param = parameters.getParameter(this.getObjectName()
//                    + "Y");
//            if (param != null) {
//                param.setValue(this.yValue);
//            }
//        }
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("yValue", new Double(oldVal),
//                    new Double(value));
//        }
//    }
//
//    public double getXMax() {
//        return xMax;
//    }
//
//    public void setXMax(double value, boolean truncate) {
//        if (value <= getXMin()) {
//            return;
//        }
//
//        double oldMax = xMax;
//        xMax = value;
//
//        if (truncate) {
//            setXValue(LineUtils.truncate(getXValue(), xMin, xMax));
//        } else {
//            setXValue(LineUtils.rescale(getXValue(), xMin, oldMax, xMin, xMax,
//                    -1.0f));
//        }
//
//        if (parameters != null) {
//            Parameter param = parameters.getParameter(this.getObjectName()
//                    + "X");
//            if (param != null) {
//                param.setMax(this.xMax, truncate);
//            }
//        }
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("xMax", new Double(oldMax),
//                    new Double(value));
//        }
//    }
//
//    public double getXMin() {
//        return xMin;
//    }
//
//    public void setXMin(double value, boolean truncate) {
//        if (value >= getXMax()) {
//            return;
//
//        }
//        double oldMin = xMin;
//        xMin = value;
//
//        if (truncate) {
//            setXValue(LineUtils.truncate(getXValue(), xMin, xMax));
//        } else {
//            setXValue(LineUtils.rescale(getXValue(), oldMin, xMax, xMin, xMax,
//                    -1.0f));
//        }
//
//        if (parameters != null) {
//            Parameter param = parameters.getParameter(this.getObjectName()
//                    + "X");
//            if (param != null) {
//                param.setMin(this.xMin, truncate);
//            }
//        }
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("xMin", new Double(oldMin),
//                    new Double(value));
//        }
//    }
//
//    public double getYMax() {
//        return yMax;
//    }
//
//    public void setYMax(double value, boolean truncate) {
//        if (value <= getYMin()) {
//            return;
//        }
//
//        double oldMax = yMax;
//        yMax = value;
//
//        if (truncate) {
//            setYValue(LineUtils.truncate(getYValue(), yMin, yMax));
//        } else {
//            setYValue(LineUtils.rescale(getYValue(), yMin, oldMax, yMin, yMax,
//                    -1.0f));
//        }
//
//        if (parameters != null) {
//            Parameter param = parameters.getParameter(this.getObjectName()
//                    + "Y");
//            if (param != null) {
//                param.setMax(this.yMax, truncate);
//            }
//        }
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("yMax", new Double(oldMax),
//                    new Double(value));
//        }
//    }
//
//    public double getYMin() {
//        return yMin;
//    }
//
//    public void setYMin(double value, boolean truncate) {
//        if (value >= getYMax()) {
//            return;
//        }
//
//        double oldMin = yMin;
//        yMin = value;
//
//        if (truncate) {
//            setYValue(LineUtils.truncate(getYValue(), yMin, yMax));
//        } else {
//            setYValue(LineUtils.rescale(getYValue(), oldMin, yMax, yMin, yMax,
//                    -1.0f));
//        }
//
//        if (parameters != null) {
//            Parameter param = parameters.getParameter(this.getObjectName()
//                    + "Y");
//            if (param != null) {
//                param.setMin(this.yMin, truncate);
//            }
//        }
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("yMin", new Double(oldMin),
//                    new Double(value));
//        }
//    }
    @Override
    public void initializeParameters() {
        if (parameters == null) {
            return;
        }

        if (!automationAllowed) {
            if (objectName != null && objectName.length() != 0) {
                Parameter param = parameters.getParameter(this.objectName + "X");

                if (param != null && param.isAutomationEnabled()) {
                    automationAllowed = true;
                } else {
                    parameters.removeParameter(this.objectName + "X");
                    parameters.removeParameter(this.objectName + "Y");
                    return;
                }
            }
        }

        if (this.objectName == null || this.objectName.trim().length() == 0) {
            return;
        }

        Parameter param = parameters.getParameter(this.objectName + "X");
        Parameter param2 = parameters.getParameter(this.objectName + "Y");

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
            parameters.removeParameter(this.objectName + "X");
            parameters.removeParameter(this.objectName + "Y");
            return;
        }

        param = new Parameter();
        param.setValue(xValue.getValue());
        param.setMax(xValue.getMax(), true);
        param.setMin(xValue.getMin(), true);
        param.setName(getObjectName() + "X");
        param.setResolution(-1);
        param.addParameterListener(this);
        param.setValue(xValue.getValue());

        parameters.addParameter(param);

        param = new Parameter();
        param.setValue(yValue.getValue());
        param.setMax(yValue.getMax(), true);
        param.setMin(yValue.getMin(), true);
        param.setName(getObjectName() + "Y");
        param.setResolution(-1);
        param.addParameterListener(this);
        param.setValue(yValue.getValue());

        parameters.addParameter(param);
    }

//    public void updateXValue(double value) {
//        double oldVal = xValue.getValue();
//        xValue.setValue(value);
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("xValue", new Double(oldVal),
//                    new Double(value));
//        }
//    }
//
//    public void updateYValue(double value) {
//        double oldVal = yValue;
//        yValue = value;
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("yValue", new Double(oldVal),
//                    new Double(value));
//        }
//    }
    @Override
    public void lineDataChanged(Parameter param) {

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
