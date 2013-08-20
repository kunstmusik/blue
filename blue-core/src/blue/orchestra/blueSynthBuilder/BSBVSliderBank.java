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
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.Iterator;

/**
 * @author Steven Yi
 * 
 */
public class BSBVSliderBank extends AutomatableBSBObject implements
        PropertyChangeListener, ParameterListener, Randomizable {

    private static MessageFormat KEY_FMT = new MessageFormat("{0}_{1}");

    public static final float defaultMinimum = 0.0f;

    public static final float defaultMaximum = 1.0f;

    float minimum = defaultMinimum;

    float maximum = defaultMaximum;

    float resolution = 0.1f;

    private final ArrayList sliders = new ArrayList();

    int sliderHeight = 150;

    private int gap = 5;

    private boolean randomizable = true;

    @Override
    public void setObjectName(String objectName) {
        if (objectName == null || objectName.equals(getObjectName())) {
            return;
        }

        if (unm != null) {
            if (objectName != null && objectName.length() != 0) {
                Object[] vals = new Object[2];
                vals[0] = objectName;

                for (int i = 0; i < sliders.size(); i++) {
                    vals[1] = new Integer(i);

                    String objName = KEY_FMT.format(vals);

                    if (!unm.isUnique(objName)) {
                        return;
                    }
                }
            }
        }

        String oldName = this.getObjectName();

        boolean doInitialize = false;

        if (parameters != null && automationAllowed) {

            Object[] vals = new Object[2];
            vals[0] = oldName;

            Object[] vals2 = new Object[2];
            vals2[0] = objectName;

            if (objectName == null || objectName.length() == 0) {
                for (int i = 0; i < sliders.size(); i++) {
                    vals[1] = new Integer(i);

                    String oldKey = KEY_FMT.format(vals);

                    parameters.removeParameter(oldKey);
                }
            } else {
                boolean missingParameters = false;

                for (int i = 0; i < sliders.size(); i++) {
                    vals[1] = new Integer(i);
                    vals2[1] = new Integer(i);
                    String oldKey = KEY_FMT.format(vals);
                    String newKey = KEY_FMT.format(vals2);

                    Parameter param = parameters.getParameter(oldKey);
                    if (param == null) {
                        missingParameters = true;
                        break;
                    } else {
                        param.setName(newKey);
                    }
                }

                if (missingParameters) {
                    for (int i = 0; i < sliders.size(); i++) {
                        vals[1] = new Integer(i);

                        String oldKey = KEY_FMT.format(vals);
                        parameters.removeParameter(oldKey);
                    }
                    doInitialize = true;
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

    public BSBVSliderBank() {
        BSBVSlider slider = new BSBVSlider();
        slider.addPropertyChangeListener(this);
        sliders.add(slider);
    }

    public ArrayList getSliders() {
        return sliders;
    }

    public static BSBObject loadFromXML(Element data) {
        BSBVSliderBank sliderBank = new BSBVSliderBank();
        float minVal = 0;
        float maxVal = 0;
        initBasicFromXML(data, sliderBank);

        Elements nodes = data.getElements();

        sliderBank.getSliders().clear();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "minimum":
                    minVal = Float.parseFloat(node.getTextString());
                    break;
                case "maximum":
                    maxVal = Float.parseFloat(node.getTextString());
                    break;
                case "resolution":
                    sliderBank
                            .setResolution(Float.parseFloat(node.getTextString()));
                    break;
                case "sliderHeight":
                    sliderBank.setSliderHeight(Integer.parseInt(node
                            .getTextString()));
                    break;
                case "gap":
                    sliderBank.setGap(Integer.parseInt(node.getTextString()));
                    break;
                case "randomizable":
                    sliderBank.randomizable = XMLUtilities.readBoolean(node);
                    break;
                case "bsbObject":
                    BSBVSlider vSlider = (BSBVSlider) BSBVSlider.loadFromXML(node);
                    vSlider.addPropertyChangeListener(sliderBank);
                    sliderBank.getSliders().add(vSlider);
                    break;
            }
        }

        // set min and max values
        if (minVal > BSBVSliderBank.defaultMaximum) {
            sliderBank.maximum = maxVal;
            sliderBank.minimum = minVal;
        } else {
            sliderBank.minimum = minVal;
            sliderBank.maximum = maxVal;
        }

        return sliderBank;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BlueSynthBuilderObject#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement(XMLUtilities.writeFloat("minimum", minimum));
        retVal.addElement(XMLUtilities.writeFloat("maximum", maximum));
        retVal.addElement(XMLUtilities.writeFloat("resolution", resolution));
        retVal.addElement(XMLUtilities.writeInt("sliderHeight", sliderHeight));
        retVal.addElement(XMLUtilities.writeInt("gap", gap));

        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                randomizable));

        for (Iterator iter = sliders.iterator(); iter.hasNext();) {
            BSBVSlider vSlider = (BSBVSlider) iter.next();
            retVal.addElement(vSlider.saveAsXML());
        }

        return retVal;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getBSBObjectView()
     */
//    public BSBObjectView getBSBObjectView() {
//        return new BSBVSliderBankView(this);
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
        if (maximum <= minimum) {
            return;
        }

        this.maximum = maximum;

        if (parameters != null) {
            Object[] vals = new Object[2];
            vals[0] = getObjectName();

            for (int i = 0; i < sliders.size(); i++) {
                vals[1] = new Integer(i);
                String key = KEY_FMT.format(vals);

                Parameter param = parameters.getParameter(key);
                if (param != null) {
                    param.setMax(this.maximum, truncate);
                }
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

        this.minimum = minimum;

        if (parameters != null) {
            Object[] vals = new Object[2];
            vals[0] = getObjectName();

            for (int i = 0; i < sliders.size(); i++) {
                vals[1] = new Integer(i);
                String key = KEY_FMT.format(vals);

                Parameter param = parameters.getParameter(key);
                if (param != null) {
                    param.setMin(this.minimum, truncate);
                }
            }
        }

        fireBSBObjectChanged();
    }

    public int getNumberOfSliders() {
        return sliders.size();
    }

    public boolean willBeUnique(int numSliders) {
        Object[] vals = new Object[2];
        vals[0] = getObjectName();

        for (int i = this.getNumberOfSliders(); i < numSliders; i++) {
            vals[1] = new Integer(i);
            String key = KEY_FMT.format(vals);
            if (!unm.isUnique(key)) {
                return false;
            }
        }
        return true;
    }

    public void setNumberOfSliders(int numSliders) {
        if (numSliders > 0) {

            int diff = numSliders - sliders.size();

            Object[] vals = new Object[2];
            vals[0] = getObjectName();

            if (diff > 0) {
                if (!willBeUnique(numSliders)) {
                    return;
                }

                BSBVSlider lastSlider = (BSBVSlider) sliders
                        .get(sliders.size() - 1);

                for (int i = 0; i < diff; i++) {
                    BSBVSlider copy = (BSBVSlider) lastSlider.clone();
                    sliders.add(copy);
                    copy.addPropertyChangeListener(this);

                    if (parameters != null && this.objectName != null
                            && this.objectName.trim().length() > 0) {

                        vals[1] = new Integer(sliders.size() - 1);
                        String key = KEY_FMT.format(vals);

                        Parameter param = new Parameter();
                        param.setName(key);

                        // order of setting these is important
                        if (getMinimum() > param.getMax()) {
                            param.setMax(getMaximum(), true);
                            param.setMin(getMinimum(), true);
                        } else {
                            param.setMin(getMinimum(), true);
                            param.setMax(getMaximum(), true);
                        }

                        param.setResolution(getResolution());
                        param.setValue(copy.getValue());

                        param.addParameterListener(this);

                        parameters.addParameter(param);
                    }

                }
            } else {
                for (int i = 0; i < -diff; i++) {
                    BSBVSlider slider = (BSBVSlider) sliders
                            .get(sliders.size() - 1);

                    sliders.remove(slider);
                    slider.removePropertyChangeListener(this);

                    if (parameters != null && this.objectName != null
                            && this.objectName.trim().length() > 0) {

                        vals[1] = new Integer(sliders.size());
                        String key = KEY_FMT.format(vals);

                        parameters.removeParameter(key);
                    }
                }

            }
        }
        fireBSBObjectChanged();
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setupForCompilation(blue.orchestra.blueSynthBuilder.BSBCompilationUnit)
     */
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {

        Object[] vals = new Object[2];
        vals[0] = objectName;

        for (int i = 0; i < sliders.size(); i++) {
            BSBVSlider slider = (BSBVSlider) sliders.get(i);

            vals[1] = new Integer(i);
            String key = KEY_FMT.format(vals);

            if (parameters != null) {
                Parameter param = parameters.getParameter(key);

                if (param != null && param.getCompilationVarName() != null) {
                    compilationUnit.addReplacementValue(key, param
                            .getCompilationVarName());
                    continue;
                }
            }

            compilationUnit.addReplacementValue(key, NumberUtilities
                    .formatFloat(slider.getValue()));
        }
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
            Object[] vals = new Object[2];
            vals[0] = getObjectName();

            for (int i = 0; i < sliders.size(); i++) {
                vals[1] = new Integer(i);
                String key = KEY_FMT.format(vals);

                Parameter param = parameters.getParameter(key);
                if (param != null) {
                    param.setResolution(this.resolution);
                }
            }
        }
    }

    /**
     * @return Returns the sliderWidth.
     */
    public int getSliderHeight() {
        return sliderHeight;
    }

    /**
     * @param sliderWidth
     *            The sliderWidth to set.
     */
    public void setSliderHeight(int sliderWidth) {
        this.sliderHeight = sliderWidth;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    public String getPresetValue() {

        boolean first = true;

        StringBuilder buffer = new StringBuilder();

        for (int i = 0; i < sliders.size(); i++) {
            if (first) {
                first = false;
            } else {
                buffer.append(":");
            }

            BSBVSlider slider = (BSBVSlider) sliders.get(i);

            buffer.append(Float.toString(slider.getValue()));
        }

        return buffer.toString();
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    public void setPresetValue(String val) {
        String vals[] = val.split(":");

        int size = sliders.size() < vals.length ? sliders.size() : vals.length;

        for (int i = 0; i < size; i++) {
            BSBVSlider slider = (BSBVSlider) sliders.get(i);
            slider.setValue(Float.parseFloat(vals[i]));
        }

    }

    public void setGap(int gap) {
        this.gap = gap;
        fireBSBObjectChanged();
    }

    public int getGap() {
        return gap;
    }

    @Override
    public String[] getReplacementKeys() {
        String objName = getObjectName().trim();

        if (objName.length() == 0) {
            return null;
        }

        String[] retVal = new String[sliders.size()];

        Object[] vals = new Object[2];
        vals[0] = objectName;

        for (int i = 0; i < sliders.size(); i++) {
            vals[1] = new Integer(i);
            String key = KEY_FMT.format(vals);

            retVal[i] = key;
        }

        return retVal;
    }

    public void propertyChange(PropertyChangeEvent pce) {
        if (pce.getPropertyName().equals("value") && parameters != null) {

            int index = sliders.indexOf(pce.getSource());
            if (index < 0) {
                return;
            }

            Object[] vals = new Object[2];
            vals[0] = objectName;

            vals[1] = new Integer(index);
            String key = KEY_FMT.format(vals);

            Parameter param = parameters.getParameter(key);
            if (param != null) {
                param.setValue(((Float) pce.getNewValue()).floatValue());
            }

        }
    }

    /*
     * This gets called as part of Serialization by Java and will do default
     * serialization plus reconnect this SliderBank as a listener to its Sliders
     */
    private void readObject(ObjectInputStream stream) throws IOException,
            ClassNotFoundException {
        stream.defaultReadObject();

        for (Iterator iter = sliders.iterator(); iter.hasNext();) {
            BSBVSlider slider = (BSBVSlider) iter.next();
            slider.addPropertyChangeListener(this);
        }
    }

    public void initializeParameters() {
         if(!automationAllowed) {
            
            if (parameters != null) {
                if (objectName != null && objectName.length() != 0) {
                    Object[] vals = new Object[2];
                    vals[0] = objectName;

                    vals[1] = new Integer(0);
                    Parameter param = parameters.getParameter(KEY_FMT.format(vals));
                            
                    if(param != null && param.isAutomationEnabled()) {
                        automationAllowed = true;
                    } else {   
                        for (int i = 0; i < sliders.size(); i++) {
                            vals[1] = new Integer(i);

                            String oldKey = KEY_FMT.format(vals);

                            parameters.removeParameter(oldKey);
                            
                        }
                        
                        return;
                    }
                }

            }            
        }

        if (this.objectName == null || this.objectName.trim().length() == 0) {
            return;
        }

        Object[] vals = new Object[2];
        vals[0] = getObjectName();

        boolean missingParameters = false;

        for (int i = 0; i < sliders.size(); i++) {
            vals[1] = new Integer(i);
            String key = KEY_FMT.format(vals);

            Parameter param = parameters.getParameter(key);

            if (param == null) {
                missingParameters = true;
                break;
            }
            
            if(!param.isAutomationEnabled()) {
                BSBVSlider slider = (BSBVSlider) sliders.get(i);
                param.setValue(slider.getValue());
            }

            param.addParameterListener(this);
        }

        if (!missingParameters) {
            return;
        }

        for (int i = 0; i < sliders.size(); i++) {
            BSBVSlider slider = (BSBVSlider) sliders.get(i);

            vals[1] = new Integer(i);
            String key = KEY_FMT.format(vals);

            // clear for safety
            parameters.removeParameter(key);

            Parameter param = new Parameter();
            param.setName(key);

            // order of setting these is important
            if (getMinimum() > param.getMax()) {
                param.setMax(getMaximum(), true);
                param.setMin(getMinimum(), true);
            } else {
                param.setMin(getMinimum(), true);
                param.setMax(getMaximum(), true);
            }

            param.setResolution(getResolution());
            param.setValue(slider.getValue());
            param.addParameterListener(this);

            parameters.addParameter(param);
        }

    }

    public void lineDataChanged(Parameter param) {
        float time = ParameterTimeManagerFactory.getInstance().getTime();

        String paramName = param.getName();
        String strIndex = paramName.substring(paramName.lastIndexOf('_') + 1);
        int sliderIndex = Integer.parseInt(strIndex);

        float val = param.getLine().getValue(time);
        BSBVSlider slider = (BSBVSlider) sliders.get(sliderIndex);

        slider.updateValue(val);
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
                Object[] vals = new Object[2];
                vals[0] = objectName;

                if (objectName != null && objectName.length() != 0) {
                    for (int i = 0; i < sliders.size(); i++) {
                        vals[1] = new Integer(i);

                        String oldKey = KEY_FMT.format(vals);

                        parameters.removeParameter(oldKey);
                    }
                }
            }
        }
    }

    /* RANDOMIZABLE METHODS */

    public boolean isRandomizable() {
        return randomizable;
    }

    public void randomize() {
        if (randomizable) {
            for (int i = 0; i < sliders.size(); i++) {
                BSBVSlider slider = (BSBVSlider) sliders.get(i);
                slider.randomize();
            }
        }
    }

    public void setRandomizable(boolean randomizable) {
        this.randomizable = randomizable;

        for (int i = 0; i < sliders.size(); i++) {
            BSBVSlider slider = (BSBVSlider) sliders.get(i);
            slider.setRandomizable(randomizable);
        }

        fireBSBObjectChanged();
    }
}
