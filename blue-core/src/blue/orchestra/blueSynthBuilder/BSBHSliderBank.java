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
import java.io.IOException;
import java.io.ObjectInputStream;
import java.text.MessageFormat;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleDoubleProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.FXCollections;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;

/**
 * @author Steven Yi
 *
 */
public class BSBHSliderBank extends AutomatableBSBObject implements
        ParameterListener, Randomizable {

    private static MessageFormat KEY_FMT = new MessageFormat("{0}_{1}");

    private DoubleProperty minimum = new SimpleDoubleProperty(0.0);
    private DoubleProperty maximum = new SimpleDoubleProperty(1.0);
    private DoubleProperty resolution = new SimpleDoubleProperty(0.1);
    private IntegerProperty sliderWidth = new SimpleIntegerProperty(150);
    private IntegerProperty gap = new SimpleIntegerProperty(5);
    private BooleanProperty randomizable = new SimpleBooleanProperty(true);

    private final ObservableList<BSBHSlider> sliders
            = FXCollections.observableArrayList();

    final ChangeListener<? super Number> cl = (obs, old, newVal) -> {
        if (parameters != null) {

            int index = sliders.indexOf(obs);
            if (index < 0) {
                return;
            }

            Object[] vals = new Object[2];
            vals[0] = objectName;

            vals[1] = new Integer(index);
            String key = KEY_FMT.format(vals);

            Parameter param = parameters.getParameter(key);
            if (param != null) {
                param.setValue(newVal.floatValue());
            }
        }
    };

    private final ListChangeListener<BSBHSlider> listChangeListener
            = new ListChangeListener<BSBHSlider>() {
        @Override
        public void onChanged(ListChangeListener.Change<? extends BSBHSlider> c) {
            while (c.next()) {
                if (c.wasPermutated()) {

                } else if (c.wasUpdated()) {

                } else {
                    for (BSBHSlider remItem : c.getRemoved()) {
                        remItem.maximumProperty().unbind();
                        remItem.minimumProperty().unbind();
                        remItem.sliderWidthProperty().unbind();
                        remItem.randomizableProperty().unbind();
                        remItem.resolutionProperty().unbind();
                        remItem.valueProperty().removeListener(cl);
                    }
                    for (BSBHSlider addItem : c.getAddedSubList()) {
                        addItem.maximumProperty().bind(maximumProperty());
                        addItem.minimumProperty().bind(minimumProperty());
                        addItem.sliderWidthProperty().bind(sliderWidthProperty());
                        addItem.randomizableProperty().bind(randomizableProperty());
                        addItem.resolutionProperty().bind(resolutionProperty());
                        addItem.valueProperty().addListener(cl);
                    }
                }
            }
        }
    };

    public BSBHSliderBank() {
        sliders.addListener(listChangeListener);
        sliders.add(new BSBHSlider());
    }

    public BSBHSliderBank(BSBHSliderBank bank) {
        super(bank);
        sliders.addListener(listChangeListener);    

        for(BSBHSlider slider : bank.sliders) {
            sliders.add(new BSBHSlider(slider));        
        }
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

    public final void setSliderWidth(int value) {
        sliderWidth.set(value);
    }

    public final int getSliderWidth() {
        return sliderWidth.get();
    }

    public final IntegerProperty sliderWidthProperty() {
        return sliderWidth;
    }

    public final void setGap(int value) {
        gap.set(value);
    }

    public final int getGap() {
        return gap.get();
    }

    public final IntegerProperty gapProperty() {
        return gap;
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

    // OVERRIDE to handle Parameter name changes and multiple parameters
    @Override
    public void setObjectName(String objectName) {
        if (objectName == null || objectName.equals(getObjectName())) {
            return;
        }

        if (unm != null) {
            if (!objectName.isEmpty()) {
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

            if (!objectName.isEmpty()) {
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

    public ObservableList<BSBHSlider> getSliders() {
        return sliders;
    }

    public static BSBObject loadFromXML(Element data) {
        BSBHSliderBank sliderBank = new BSBHSliderBank();
        double minVal = 0;
        double maxVal = 1.0;
        initBasicFromXML(data, sliderBank);

        Elements nodes = data.getElements();

        sliderBank.getSliders().clear();

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
                case "resolution":
                    sliderBank
                            .setResolution(Double.parseDouble(node.getTextString()));
                    break;
                case "sliderWidth":
                    sliderBank.setSliderWidth(Integer
                            .parseInt(node.getTextString()));
                    break;
                case "gap":
                    sliderBank.setGap(Integer.parseInt(node.getTextString()));
                    break;
                case "randomizable":
                    sliderBank.setRandomizable(XMLUtilities.readBoolean(node));
                    break;
                case "bsbObject":
                    BSBHSlider hSlider = (BSBHSlider) BSBHSlider.loadFromXML(node);
                    sliderBank.getSliders().add(hSlider);
                    break;
            }
        }

        // set min and max values
        if (minVal > 1.0) {
            sliderBank.setMaximum(maxVal);
            sliderBank.setMinimum(minVal);
        } else {
            sliderBank.setMinimum(minVal);
            sliderBank.setMaximum(maxVal);
        }

        return sliderBank;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BlueSynthBuilderObject#saveAsXML()
     */
    @Override
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement(XMLUtilities.writeDouble("minimum", getMinimum()));
        retVal.addElement(XMLUtilities.writeDouble("maximum", getMaximum()));
        retVal.addElement(XMLUtilities.writeDouble("resolution", getResolution()));
        retVal.addElement(XMLUtilities.writeInt("sliderWidth", getSliderWidth()));
        retVal.addElement(XMLUtilities.writeInt("gap", getGap()));

        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                isRandomizable()));

        for (BSBHSlider hSlider : sliders) {
            retVal.addElement(hSlider.saveAsXML());
        }

        return retVal;
    }

//    /**
//     * @param maximum The maximum to set.
//     */
//    public void setMaximum(float maximum, boolean truncate) {
//        if (maximum <= minimum) {
//            return;
//        }
//
//        this.maximum = maximum;
//
//        if (parameters != null) {
//            Object[] vals = new Object[2];
//            vals[0] = getObjectName();
//
//            for (int i = 0; i < sliders.size(); i++) {
//                vals[1] = new Integer(i);
//                String key = KEY_FMT.format(vals);
//
//                Parameter param = parameters.getParameter(key);
//                if (param != null) {
//                    param.setMax(this.maximum, truncate);
//                }
//            }
//        }
//
//        fireBSBObjectChanged();
//    }
//    /**
//     * @param minimum The minimum to set.
//     */
//    public void setMinimum(float minimum, boolean truncate) {
//        if (minimum >= maximum) {
//            return;
//        }
//
//        this.minimum = minimum;
//
//        if (parameters != null) {
//            Object[] vals = new Object[2];
//            vals[0] = getObjectName();
//
//            for (int i = 0; i < sliders.size(); i++) {
//                vals[1] = new Integer(i);
//                String key = KEY_FMT.format(vals);
//
//                Parameter param = parameters.getParameter(key);
//                if (param != null) {
//                    param.setMin(this.minimum, truncate);
//                }
//            }
//        }
//
//        fireBSBObjectChanged();
//    }
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
        if (numSliders > 0 && numSliders != sliders.size()) {

            int diff = numSliders - sliders.size();

            Object[] vals = new Object[2];
            vals[0] = getObjectName();

            if (diff > 0) {
                if (!willBeUnique(numSliders)) {
                    return;
                }

                BSBHSlider lastSlider = (BSBHSlider) sliders
                        .get(sliders.size() - 1);

                for (int i = 0; i < diff; i++) {
                    BSBHSlider copy = new BSBHSlider(lastSlider);
                    sliders.add(copy);

                    if (parameters != null && this.objectName != null
                            && this.objectName.trim().length() > 0) {

                        vals[1] = new Integer(sliders.size() - 1);
                        String key = KEY_FMT.format(vals);

                        Parameter param = new Parameter();
                        param.setName(key);

                        // order of setting these is important
                        if (getMinimum() > param.getMax()) {
                            param.setMax((float) getMaximum(), true);
                            param.setMin((float) getMinimum(), true);
                        } else {
                            param.setMin((float) getMinimum(), true);
                            param.setMax((float) getMaximum(), true);
                        }

                        param.setResolution((float) getResolution());
                        param.setValue((float) copy.getValue());

                        param.addParameterListener(this);

                        parameters.addParameter(param);
                    }

                }
            } else {
                for (int i = 0; i < -diff; i++) {
                    BSBHSlider slider = (BSBHSlider) sliders
                            .get(sliders.size() - 1);

                    sliders.remove(slider);

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
    @Override
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {
        Object[] vals = new Object[2];
        vals[0] = objectName;

        for (int i = 0; i < sliders.size(); i++) {
            BSBHSlider slider = sliders.get(i);

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
                    .formatDouble(slider.getValue()));
        }
    }

//    /**
//     * @param resolution The resolution to set.
//     */
//    public void setResolution(float resolution) {
//        this.resolution = resolution;
//
//        if (parameters != null) {
//            Object[] vals = new Object[2];
//            vals[0] = getObjectName();
//
//            for (int i = 0; i < sliders.size(); i++) {
//                vals[1] = new Integer(i);
//                String key = KEY_FMT.format(vals);
//
//                Parameter param = parameters.getParameter(key);
//                if (param != null) {
//                    param.setResolution(this.resolution);
//                }
//            }
//        }
//    }
    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    @Override
    public String getPresetValue() {

        boolean first = true;

        StringBuilder buffer = new StringBuilder();

        for (int i = 0; i < sliders.size(); i++) {
            if (first) {
                first = false;
            } else {
                buffer.append(":");
            }

            BSBHSlider slider = (BSBHSlider) sliders.get(i);

            buffer.append(Double.toString(slider.getValue()));
        }

        return buffer.toString();
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    @Override
    public void setPresetValue(String val) {
        String vals[] = val.split(":");

        int size = sliders.size() < vals.length ? sliders.size() : vals.length;

        for (int i = 0; i < size; i++) {
            BSBHSlider slider = sliders.get(i);
            slider.setValue(Double.parseDouble(vals[i]));
        }

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

    /*
     * This gets called as part of Serialization by Java and will do default
     * serialization plus reconnect this SliderBank as a listener to its Sliders
     */
    private void readObject(ObjectInputStream stream) throws IOException,
            ClassNotFoundException {
        stream.defaultReadObject();

        for (BSBHSlider slider : sliders) {
            // FIXME - maybe don't bother and just implement Clone...
//            slider.addPropertyChangeListener(this);
        }
    }

    @Override
    public void initializeParameters() {
        if (parameters == null) {
            return;
        }

        if (!automationAllowed) {

            if (parameters != null) {
                if (objectName != null && objectName.length() != 0) {
                    Object[] vals = new Object[2];
                    vals[0] = objectName;

                    vals[1] = new Integer(0);
                    Parameter param = parameters.getParameter(KEY_FMT.format(vals));

                    if (param != null && param.isAutomationEnabled()) {
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

            if (!param.isAutomationEnabled()) {
                BSBHSlider slider = (BSBHSlider) sliders.get(i);
                param.setValue((float) slider.getValue());
            }

            param.addParameterListener(this);
        }

        if (!missingParameters) {
            return;
        }

        for (int i = 0; i < sliders.size(); i++) {
            BSBHSlider slider = (BSBHSlider) sliders.get(i);

            vals[1] = new Integer(i);
            String key = KEY_FMT.format(vals);

            // clear for safety
            parameters.removeParameter(key);

            Parameter param = new Parameter();
            param.setName(key);

            // order of setting these is important
            if (getMinimum() > param.getMax()) {
                param.setMax((float) getMaximum(), true);
                param.setMin((float) getMinimum(), true);
            } else {
                param.setMin((float) getMinimum(), true);
                param.setMax((float) getMaximum(), true);
            }

            param.setResolution((float) getResolution());
            param.setValue((float) slider.getValue());

            param.addParameterListener(this);

            parameters.addParameter(param);
        }

    }

    @Override
    public void lineDataChanged(Parameter param) {
        float time = ParameterTimeManagerFactory.getInstance().getTime();

        String paramName = param.getName();
        String strIndex = paramName.substring(paramName.lastIndexOf('_') + 1);
        int sliderIndex = Integer.parseInt(strIndex);

        float val = param.getLine().getValue(time);
        BSBHSlider slider = sliders.get(sliderIndex);

        slider.setValue(val);

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
    @Override
    public void randomize() {
        if (isRandomizable()) {
            sliders.stream().forEach(BSBHSlider::randomize);
        }
    }

    @Override
    public BSBObject deepCopy() {
        return new BSBHSliderBank(this);
    }

}
