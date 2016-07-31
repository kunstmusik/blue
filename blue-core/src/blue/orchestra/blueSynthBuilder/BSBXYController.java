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
import blue.components.lines.LineUtils;
import blue.utility.NumberUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;

public class BSBXYController extends AutomatableBSBObject implements
        ParameterListener, Randomizable {

    int width = 100;

    int height = 80;

    float xMin = 0.0f;

    float xMax = 1.0f;

    float yMin = 0.0f;

    float yMax = 1.0f;

    float xValue = 0.5f;

    float yValue = 0.5f;

    boolean randomizable = true;

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
            switch (nodeName) {
                case "width":
                    xyController.setWidth(Integer.parseInt(node.getTextString()));
                    break;
                case "height":
                    xyController.setHeight(Integer.parseInt(node.getTextString()));
                    break;
                case "xMin":
                    xyController.xMin = Float.parseFloat(node.getTextString());
                    break;
                case "xMax":
                    xyController.xMax = Float.parseFloat(node.getTextString());
                    break;
                case "yMin":
                    xyController.yMin = Float.parseFloat(node.getTextString());
                    break;
                case "yMax":
                    xyController.yMax = Float.parseFloat(node.getTextString());
                    break;
                case "xValue":
                    xyController.xValue = Float.parseFloat(node.getTextString());
                    break;
                case "yValue":
                    xyController.yValue = Float.parseFloat(node.getTextString());
                    break;
                case "randomizable":
                    xyController.randomizable = XMLUtilities.readBoolean(node);
                    break;
            }
        }

        // convert from relative to absolute values (0.110.0)
        if (version == 1) {
            float xrange = xyController.xMax - xyController.xMin;
            xyController.xValue = (xyController.x * xrange) + xyController.xMin;

            float yrange = xyController.yMax - xyController.yMin;
            xyController.yValue = (xyController.y * yrange) + xyController.yMin;
        }

        return xyController;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = super.getBasicXML(this);

        retVal.setAttribute("version", "2");

        retVal.addElement("width").setText(Integer.toString(width));
        retVal.addElement("height").setText(Integer.toString(height));

        retVal.addElement("xMin").setText(Float.toString(xMin));
        retVal.addElement("xMax").setText(Float.toString(xMax));
        retVal.addElement("yMin").setText(Float.toString(yMin));
        retVal.addElement("yMax").setText(Float.toString(yMax));

        retVal.addElement("xValue").setText(Float.toString(xValue));
        retVal.addElement("yValue").setText(Float.toString(yValue));

        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                randomizable));

        return retVal;
    }

//    public BSBObjectView getBSBObjectView() {
//        return new BSBXYControllerView(this);
//    }

    @Override
    public String[] getReplacementKeys() {
        if (this.objectName == null || this.objectName.trim().length() == 0) {
            return new String[] {};
        }

        return new String[] { this.objectName + "X", this.objectName + "Y" };
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
                (xCompVal == null) ? NumberUtilities.formatFloat(xValue)
                        : xCompVal);
        compilationUnit.addReplacementValue(objectName + "Y",
                (yCompVal == null) ? NumberUtilities.formatFloat(yValue)
                        : yCompVal);
    }

    @Override
    public String getPresetValue() {
        return "ver2:" + xValue + ":" + yValue;
    }

    @Override
    public void setPresetValue(String val) {
        String[] vals = val.split(":");

        float x, y;

        // version1 uses relative values and has no ver string
        if (vals.length == 2) {
            x = Float.parseFloat(vals[0]);
            y = Float.parseFloat(vals[1]);

            x = (x * (xMax - xMin)) + xMin;
            y = (y * (yMax - yMin)) + yMin;
        } else {
            x = Float.parseFloat(vals[1]);
            y = Float.parseFloat(vals[2]);
        }

        setXValue(x);
        setYValue(y);
    }

    public int getHeight() {
        return height;
    }

    public void setHeight(int height) {
        int oldHeight = this.height;
        this.height = height;

        if (propListeners != null) {
            propListeners.firePropertyChange("height", oldHeight, height);
        }
    }

    public int getWidth() {
        return width;
    }

    public void setWidth(int width) {
        int oldWidth = this.width;
        this.width = width;

        if (propListeners != null) {
            propListeners.firePropertyChange("width", oldWidth, width);
        }
    }

    public float getXValue() {
        return xValue;
    }

    public void setXValue(float value) {
        float oldVal = xValue;
        xValue = value;

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName()
                    + "X");
            if (param != null) {
                param.setValue(this.xValue);
            }
        }

        if (propListeners != null) {
            propListeners.firePropertyChange("xValue", new Float(oldVal),
                    new Float(value));
        }
    }

    public float getYValue() {
        return yValue;
    }

    public void setYValue(float value) {
        float oldVal = yValue;
        yValue = value;

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName()
                    + "Y");
            if (param != null) {
                param.setValue(this.yValue);
            }
        }

        if (propListeners != null) {
            propListeners.firePropertyChange("yValue", new Float(oldVal),
                    new Float(value));
        }
    }

    public float getXMax() {
        return xMax;
    }

    public void setXMax(float value, boolean truncate) {
        if (value <= getXMin()) {
            return;
        }

        float oldMax = xMax;
        xMax = value;

        if (truncate) {
            setXValue(LineUtils.truncate(getXValue(), xMin, xMax));
        } else {
            setXValue(LineUtils.rescale(getXValue(), xMin, oldMax, xMin, xMax,
                    -1.0f));
        }

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName()
                    + "X");
            if (param != null) {
                param.setMax(this.xMax, truncate);
            }
        }

        if (propListeners != null) {
            propListeners.firePropertyChange("xMax", new Float(oldMax),
                    new Float(value));
        }
    }

    public float getXMin() {
        return xMin;
    }

    public void setXMin(float value, boolean truncate) {
        if (value >= getXMax()) {
            return;

        }
        float oldMin = xMin;
        xMin = value;

        if (truncate) {
            setXValue(LineUtils.truncate(getXValue(), xMin, xMax));
        } else {
            setXValue(LineUtils.rescale(getXValue(), oldMin, xMax, xMin, xMax,
                    -1.0f));
        }

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName()
                    + "X");
            if (param != null) {
                param.setMin(this.xMin, truncate);
            }
        }

        if (propListeners != null) {
            propListeners.firePropertyChange("xMin", new Float(oldMin),
                    new Float(value));
        }
    }

    public float getYMax() {
        return yMax;
    }

    public void setYMax(float value, boolean truncate) {
        if (value <= getYMin()) {
            return;
        }

        float oldMax = yMax;
        yMax = value;

        if (truncate) {
            setYValue(LineUtils.truncate(getYValue(), yMin, yMax));
        } else {
            setYValue(LineUtils.rescale(getYValue(), yMin, oldMax, yMin, yMax,
                    -1.0f));
        }

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName()
                    + "Y");
            if (param != null) {
                param.setMax(this.yMax, truncate);
            }
        }

        if (propListeners != null) {
            propListeners.firePropertyChange("yMax", new Float(oldMax),
                    new Float(value));
        }
    }

    public float getYMin() {
        return yMin;
    }

    public void setYMin(float value, boolean truncate) {
        if (value >= getYMax()) {
            return;
        }

        float oldMin = yMin;
        yMin = value;

        if (truncate) {
            setYValue(LineUtils.truncate(getYValue(), yMin, yMax));
        } else {
            setYValue(LineUtils.rescale(getYValue(), oldMin, yMax, yMin, yMax,
                    -1.0f));
        }

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName()
                    + "Y");
            if (param != null) {
                param.setMin(this.yMin, truncate);
            }
        }

        if (propListeners != null) {
            propListeners.firePropertyChange("yMin", new Float(oldMin),
                    new Float(value));
        }
    }

    @Override
    public void initializeParameters() {
        if (parameters == null) {
            return;
        }
        
        if(!automationAllowed) {
            if (objectName != null && objectName.length() != 0) {
                Parameter param = parameters.getParameter(this.objectName + "X");

                if(param != null && param.isAutomationEnabled()) {
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
            
            if(!param.isAutomationEnabled()) {
                param.setValue(getXValue());
            }
            
            if(!param2.isAutomationEnabled()) {
                param2.setValue(getYValue());
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
        param.setValue(getXValue());
        param.setMax(getXMax(), true);
        param.setMin(getXMin(), true);
        param.setName(getObjectName() + "X");
        param.setResolution(-1);
        param.addParameterListener(this);
        param.setValue(getXValue());

        parameters.addParameter(param);

        param = new Parameter();
        param.setValue(getYValue());
        param.setMax(getYMax(), true);
        param.setMin(getYMin(), true);
        param.setName(getObjectName() + "Y");
        param.setResolution(-1);
        param.addParameterListener(this);
        param.setValue(getYValue());

        parameters.addParameter(param);
    }

    public void updateXValue(float value) {
        float oldVal = xValue;
        xValue = value;

        if (propListeners != null) {
            propListeners.firePropertyChange("xValue", new Float(oldVal),
                    new Float(value));
        }
    }

    public void updateYValue(float value) {
        float oldVal = yValue;
        yValue = value;

        if (propListeners != null) {
            propListeners.firePropertyChange("yValue", new Float(oldVal),
                    new Float(value));
        }
    }

    @Override
    public void lineDataChanged(Parameter param) {

        float time = ParameterTimeManagerFactory.getInstance().getTime();
        float val = param.getLine().getValue(time);

        String paramName = param.getName();

        if (paramName.endsWith("X")) {
            updateXValue(val);
        } else if (paramName.endsWith("Y")) {
            updateYValue(val);
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
    public boolean isRandomizable() {
        return randomizable;
    }

    @Override
    public void randomize() {
        if (randomizable) {
            float rangeX = getXMax() - getXMin();
            float rangeY = getYMax() - getYMin();

            float newX = (float) (Math.random() * rangeX) + getXMin();
            float newY = (float) (Math.random() * rangeY) + getYMin();

            setXValue(newX);
            setYValue(newY);
        }
    }

    @Override
    public void setRandomizable(boolean randomizable) {
        this.randomizable = randomizable;
        fireBSBObjectChanged();
    }
}
