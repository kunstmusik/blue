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
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.MessageFormat;
import java.util.ArrayList;
import java.util.List;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.DoubleProperty;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.ObjectProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.FXCollections;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;

/**
 * @author Steven Yi
 *
 */
public class BSBVSliderBank extends AutomatableBSBObject implements
        ParameterListener, Randomizable {

    private static MessageFormat KEY_FMT = new MessageFormat("{0}_{1}");

    private ClampedValue value;

    private IntegerProperty sliderHeight = new SimpleIntegerProperty(150);
    private IntegerProperty gap = new SimpleIntegerProperty(5);
    private BooleanProperty randomizable = new SimpleBooleanProperty(true);
    private BooleanProperty valueDisplayEnabled = new SimpleBooleanProperty(true);

    private final ObservableList<BSBVSlider> sliders
            = FXCollections.observableArrayList();

    final ChangeListener<? super Number> cl = (obs, old, newVal) -> {
        if (parameters != null) {

            int index = sliders.indexOf(obs);
            if (index < 0) {
                return;
            }

            Object[] vals = new Object[2];
            vals[0] = getObjectName();

            vals[1] = new Integer(index);
            String key = KEY_FMT.format(vals);

            Parameter param = parameters.getParameter(key);
            if (param != null) {
                param.setValue(newVal.doubleValue());
            }
        }
    };

    private final ListChangeListener<BSBVSlider> listChangeListener
            = new ListChangeListener<BSBVSlider>() {
        @Override
        public void onChanged(ListChangeListener.Change<? extends BSBVSlider> c) {
            while (c.next()) {
                if (c.wasPermutated()) {

                } else if (c.wasUpdated()) {

                } else {
                    for (BSBVSlider remItem : c.getRemoved()) {
                        remItem.maximumProperty().unbind();
                        remItem.minimumProperty().unbind();
                        remItem.sliderHeightProperty().unbind();
                        remItem.randomizableProperty().unbind();
                        remItem.valueDisplayEnabledProperty().unbind();
                        remItem.resolutionProperty().unbind();
                        remItem.valueProperty().removeListener(cl);
                    }
                    for (BSBVSlider addItem : c.getAddedSubList()) {
                        addItem.maximumProperty().bind(maximumProperty());
                        addItem.minimumProperty().bind(minimumProperty());
                        addItem.sliderHeightProperty().bind(sliderHeightProperty());
                        addItem.randomizableProperty().bind(randomizableProperty());
                        addItem.resolutionProperty().bind(resolutionProperty());
                        addItem.valueDisplayEnabledProperty().bind(
                                valueDisplayEnabledProperty());
                        addItem.valueProperty().addListener(cl);
                    }
                }
            }
        }
    };

    ClampedValueListener cvl = (pType, bType) -> {
        double v;
        if (null != pType) {
            switch (pType) {
                case MIN:
                    v = getMinimum();
                    for (Parameter param : getParameters()) {
                        param.setMin(v,
                                bType == ClampedValueListener.BoundaryType.TRUNCATE);
                    }
                    break;
                case MAX:
                    v = getMaximum();
                    for (Parameter param : getParameters()) {
                        param.setMax(v,
                                bType == ClampedValueListener.BoundaryType.TRUNCATE);
                    }
                    break;
                case VALUE:
                    v = getMaximum();
                    for (Parameter param : getParameters()) {
                        if(!param.isAutomationEnabled()) {
                            param.setMax(v,
                                    bType == ClampedValueListener.BoundaryType.TRUNCATE);
                        }
                    }
                    break;
                case RESOLUTION:
                    BigDecimal bdv = getResolution();
                    for (Parameter param : getParameters()) {
                        param.setResolution(bdv);
                    }
                    break;
                default:
                    break;
            }
        }
    };

    public BSBVSliderBank() {
        value = new ClampedValue(0.0, 1.0, 0.0, new BigDecimal("0.1"));
        value.addListener(cvl);
        sliders.addListener(listChangeListener);
        sliders.add(new BSBVSlider());
    }

    public BSBVSliderBank(BSBVSliderBank bank) {
        super(bank);
        value = new ClampedValue(bank.value);
        value.addListener(cvl);
        sliders.addListener(listChangeListener);
        setValueDisplayEnabled(bank.isValueDisplayEnabled());

        for (BSBVSlider slider : bank.sliders) {
            sliders.add(new BSBVSlider(slider));
        }
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

    public final void setSliderHeight(int value) {
        sliderHeight.set(value);
    }

    public final int getSliderHeight() {
        return sliderHeight.get();
    }

    public final IntegerProperty sliderHeightProperty() {
        return sliderHeight;
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

    public final boolean isValueDisplayEnabled(){
        return valueDisplayEnabled.get();
    }

    public final void setValueDisplayEnabled(boolean enabled){
        valueDisplayEnabled.set(enabled);
    }

    public final BooleanProperty valueDisplayEnabledProperty(){
        return valueDisplayEnabled;
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

        this.objectNameProperty().set(objectName);

        if (doInitialize) {
            initializeParameters();
        }
    }

    public ObservableList<BSBVSlider> getSliders() {
        return sliders;
    }

    private final void setValueProperty(ClampedValue value) {
        if (this.value != null) {
            this.value.removeListener(cvl);
        }
        this.value = value;
        value.addListener(cvl);
    }

    public static BSBObject loadFromXML(Element data) {
        BSBVSliderBank sliderBank = new BSBVSliderBank();
        double minVal = 0;
        double maxVal = 1.0;
        BigDecimal resolution = new BigDecimal("0.1");

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
                    resolution = new BigDecimal(Double.parseDouble(
                            node.getTextString()))
                            .setScale(5, RoundingMode.HALF_UP)
                            .stripTrailingZeros();
                    break;
                case "bdresolution":
                    resolution = new BigDecimal(node.getTextString());
                    break;
                case "sliderHeight":
                    sliderBank.setSliderHeight(Integer
                            .parseInt(node.getTextString()));
                    break;
                case "gap":
                    sliderBank.setGap(Integer.parseInt(node.getTextString()));
                    break;
                case "randomizable":
                    sliderBank.setRandomizable(XMLUtilities.readBoolean(node));
                    break;
                case "valueDisplayEnabled":
                    sliderBank.setValueDisplayEnabled(XMLUtilities.readBoolean(node));
                    break;
                case "bsbObject":
                    BSBVSlider hSlider = (BSBVSlider) BSBVSlider.loadFromXML(node);
                    sliderBank.getSliders().add(hSlider);
                    break;
            }
        }

        sliderBank.setValueProperty(new ClampedValue(minVal, maxVal, 0.0, resolution));

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
        retVal.addElement("bdresolution").setText(getResolution().toString());
        retVal.addElement(XMLUtilities.writeInt("sliderHeight", getSliderHeight()));
        retVal.addElement(XMLUtilities.writeInt("gap", getGap()));

        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                isRandomizable()));
        retVal.addElement(XMLUtilities.writeBoolean("valueDisplayEnabled",
                isValueDisplayEnabled()));

        for (BSBVSlider hSlider : sliders) {
            retVal.addElement(hSlider.saveAsXML());
        }

        return retVal;
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
        if (numSliders > 0 && numSliders != sliders.size()) {

            int diff = numSliders - sliders.size();
            String objectName = getObjectName();

            Object[] vals = new Object[2];
            vals[0] = objectName;


            if (diff > 0) {
                if (!willBeUnique(numSliders)) {
                    return;
                }

                BSBVSlider lastSlider = (BSBVSlider) sliders
                        .get(sliders.size() - 1);

                for (int i = 0; i < diff; i++) {
                    BSBVSlider copy = new BSBVSlider(lastSlider);
                    sliders.add(copy);

                    if (parameters != null && objectName != null
                            && objectName.trim().length() > 0) {

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

                    if (parameters != null && objectName != null
                            && objectName.trim().length() > 0) {

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
        vals[0] = getObjectName();

        for (int i = 0; i < sliders.size(); i++) {
            BSBVSlider slider = sliders.get(i);

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

            BSBVSlider slider = (BSBVSlider) sliders.get(i);

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
            BSBVSlider slider = sliders.get(i);
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
        vals[0] = getObjectName();

        for (int i = 0; i < sliders.size(); i++) {
            vals[1] = new Integer(i);
            String key = KEY_FMT.format(vals);

            retVal[i] = key;
        }

        return retVal;
    }

    @Override
    public void initializeParameters() {
        if (parameters == null) {
            return;
        }

        String objectName = getObjectName();

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

        if (objectName == null || objectName.trim().length() == 0) {
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

    @Override
    public void lineDataChanged(Parameter param) {
        double time = ParameterTimeManagerFactory.getInstance().getTime();

        String paramName = param.getName();
        String strIndex = paramName.substring(paramName.lastIndexOf('_') + 1);
        int sliderIndex = Integer.parseInt(strIndex);

        double val = param.getLine().getValue(time);
        BSBVSlider slider = sliders.get(sliderIndex);

        slider.setValue(val);

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
            sliders.stream().forEach(BSBVSlider::randomize);
        }
    }

    @Override
    public BSBObject deepCopy() {
        return new BSBVSliderBank(this);
    }

    private List<Parameter> getParameters() {
        List<Parameter> params = new ArrayList<>();

        if (parameters != null) {

            Object[] vals = new Object[2];
            vals[0] = getObjectName();

            for (int i = 0; i < sliders.size(); i++) {
                vals[1] = new Integer(i);
                String key = KEY_FMT.format(vals);

                Parameter param = parameters.getParameter(key);

                if (param != null) {
                    params.add(param);
                }
            }

        }
        return params;
    }
}
