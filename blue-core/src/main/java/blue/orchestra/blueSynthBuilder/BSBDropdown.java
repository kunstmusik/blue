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

//import blue.orchestra.editor.blueSynthBuilder.BSBDropdownView;
//import blue.orchestra.editor.blueSynthBuilder.BSBObjectView;
import blue.automation.Parameter;
import blue.automation.ParameterListener;
import blue.automation.ParameterTimeManagerFactory;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.awt.Font;
import java.math.BigDecimal;
import javafx.beans.property.BooleanProperty;
import javafx.beans.property.IntegerProperty;
import javafx.beans.property.SimpleBooleanProperty;
import javafx.beans.property.SimpleIntegerProperty;
import javafx.beans.value.ChangeListener;
import javafx.collections.ListChangeListener;
import javafx.collections.ObservableList;

/**
 * @author Steven Yi
 */
public class BSBDropdown extends AutomatableBSBObject implements
        ParameterListener, Randomizable {

    private BSBDropdownItemList dropdownItems;
    private final IntegerProperty selectedIndex = new SimpleIntegerProperty(0);
    private final BooleanProperty randomizable = new SimpleBooleanProperty(true);

    IntegerProperty fontSize = new SimpleIntegerProperty(12) {
        @Override
        protected void invalidated() {
            if (get() < 8) {
                set(8);
            } else if (get() > 36) {
                set(36);
            }
        }

    };

    private final ListChangeListener<BSBDropdownItem> lcl = (c) -> {
        if (parameters != null) {
            Parameter param = parameters.getParameter(getObjectName());
            if (param != null) {
                param.setMax(Math.max(0, dropdownItems.size() - 1), true);
            }
        }
    };

    private final ChangeListener<Number> indexListener = (obs, old, newVal) -> {
        if (parameters != null) {
            Parameter p = parameters.getParameter(getObjectName());
            if (p != null && !p.isAutomationEnabled()) {
                p.setValue(newVal.intValue());
            }
        }
    };

    public BSBDropdown() {
        dropdownItems = new BSBDropdownItemList();
        dropdownItems.addListener(lcl);

        selectedIndex.addListener(indexListener);
    }

    public BSBDropdown(BSBDropdown dropdown) {
        super(dropdown);
        dropdownItems = new BSBDropdownItemList(dropdown.dropdownItems);
        dropdownItems.addListener(lcl);

        setSelectedIndex(dropdown.getSelectedIndex());
        setRandomizable(dropdown.isRandomizable());

        selectedIndex.addListener(indexListener);
    }

    public static BSBObject loadFromXML(Element data) {
        BSBDropdown dropDown = new BSBDropdown();
        initBasicFromXML(data, dropDown);

        int version = 1;

        String versionStr = data.getAttributeValue("version");

        if (versionStr != null) {
            version = Integer.parseInt(versionStr);
        }

        Elements nodes = data.getElements();
        int selectedIndex = 0;

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            Elements subNodes;
            switch (nodeName) {
                case "bsbDropdownItemList":
                    dropDown.dropdownItems = BSBDropdownItemList.loadFromXML(node);
                    break;
                case "selectedIndex":
                    selectedIndex = Integer.parseInt(node.getTextString());
                    break;
                case "randomizable":
                    dropDown.setRandomizable(XMLUtilities.readBoolean(node));
                    break;
                case "fontSize":
                    dropDown.setFontSize(XMLUtilities.readInt(node));
                    break;
            }
        }
        dropDown.setSelectedIndex(selectedIndex);

        if (version < 2) {
            int fontSize = 12;

            for (BSBDropdownItem dropdownItem : dropDown.dropdownItems) {
                String str = dropdownItem.getName();
                Font f = SwingHTMLFontParser.parseFont(str);
                if (f.getSize() != 12.0) {
                    fontSize = (int) f.getSize();
                }
                dropdownItem.setName(SwingHTMLFontParser.stripHTML(str));
            }

            if (fontSize != 12) {
                dropDown.setFontSize(fontSize);
            }
        }

        return dropDown;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = getBasicXML(this);
        retVal.setAttribute("version", "2");

        retVal.addElement("selectedIndex").setText(
                Integer.toString(this.getSelectedIndex()));
        retVal.addElement("fontSize").setText(
                Integer.toString(getFontSize()));
        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                isRandomizable()));

        Element items = retVal.addElement("bsbDropdownItemList");

        for (BSBDropdownItem item : dropdownItems) {
            items.addElement(item.saveAsXML());
        }

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

        if (dropdownItems.size() == 0) {
            compilationUnit.addReplacementValue(getObjectName(), "0");
        } else {

            String replaceVal;

            if (isAutomationAllowed()) {
                replaceVal = "" + getSelectedIndex();
            } else {
                BSBDropdownItem item = dropdownItems.get(getSelectedIndex());
                replaceVal = item.getValue();
            }

            compilationUnit.addReplacementValue(getObjectName(), replaceVal);
        }

    }

    public BSBDropdownItemList getBSBDropdownItemList() {
        return dropdownItems;
    }

    public void setBSBDropdownItemList(BSBDropdownItemList list) {
        var oldVal = this.dropdownItems;

        if (oldVal != null) {
            oldVal.removeListener(lcl);
        }
        this.dropdownItems = list;
        if (list != null) {
            list.addListener(lcl);
            if (parameters != null) {
                Parameter param = parameters.getParameter(getObjectName());
                if (param != null) {
                    param.setMax(Math.max(0, dropdownItems.size() - 1), true);
                }
            }
        }
        propListeners.firePropertyChange("bsbDropdownItemList", oldVal, list);
    }

    public ObservableList<BSBDropdownItem> dropdownItemsProperty() {
        return dropdownItems;
    }

    /**
     * @return Returns the selectedIndex.
     */
    public final int getSelectedIndex() {
        return selectedIndex.get();
    }

    /**
     * @param selectedIndex The selectedIndex to set.
     */
    public final void setSelectedIndex(int selectedIndex) {
        int tempIndex = selectedIndex;
        if (tempIndex >= dropdownItems.size()) {
            tempIndex = dropdownItems.size() - 1;
        }

        if (tempIndex < 0) {
            tempIndex = 0;
        }

        this.selectedIndex.set(tempIndex);
    }

    public final IntegerProperty selectedIndexProperty() {
        return selectedIndex;
    }

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

    public final void setFontSize(int size) {
        fontSize.set(size);
    }

    public final int getFontSize() {
        return fontSize.get();
    }

    public final IntegerProperty fontSizeProperty() {
        return fontSize;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    @Override
    public String getPresetValue() {
        BSBDropdownItem item = dropdownItems.get(getSelectedIndex());
        return "id:" + item.getUniqueId();
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
    @Override
    public void setPresetValue(String val) {
        if (val.startsWith("id:")) {
            String uniqueId = val.substring(3);
            int index = getIndexOfItemByUniqueId(uniqueId);

            if (index >= 0) {
                setSelectedIndex(index);
            }
        } else {
            setSelectedIndex(Integer.parseInt(val));
        }
    }

    protected int getIndexOfItemByUniqueId(String uniqueId) {
        if (uniqueId == null) {
            return -1;
        }
        for (int i = 0; i < dropdownItems.size(); i++) {
            BSBDropdownItem item = dropdownItems.get(i);
            if (uniqueId.equals(item.getUniqueId())) {
                return i;
            }
        }
        return -1;
    }

    /* RANDOMIZABLE METHODS */
    @Override
    public void randomize() {
        if (isRandomizable()) {

            int randomIndex = (int) (Math.random() * dropdownItems.size());

            if (randomIndex != this.getSelectedIndex()) {
                int oldIndex = getSelectedIndex();
                setSelectedIndex(randomIndex);

//                if (propListeners != null) {
//                    propListeners.firePropertyChange("selectedIndex", oldIndex,
//                            randomIndex);
//                }
            }
        }
    }

    /* AUTOMATABLE METHODS */
    @Override
    protected void initializeParameters() {
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
            parameter.setMax(dropdownItems.size() - 1, true);
            parameter.addParameterListener(this);

            if (!parameter.isAutomationEnabled()) {
                parameter.setValue(getSelectedIndex());
            }

            return;
        }

        Parameter param = new Parameter();
        param.setValue(getSelectedIndex());
        param.setMax(dropdownItems.size() - 1, true);
        param.setMin(0.0f, true);
        param.setName(getObjectName());
        param.setResolution(new BigDecimal(1));
        param.addParameterListener(this);

        parameters.add(param);
    }

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
    public void parameterChanged(Parameter param) {
    }

//    private void updateSelectedIndex(int index) {
//        int oldValue = getSelectedIndex();
//        setSelectedIndex(index);
//
//        if (propListeners != null) {
//            propListeners.firePropertyChange("updateValue",
//                    new Integer(oldValue), new Integer(index));
//        }
//    }
    @Override
    public void lineDataChanged(Parameter param) {
        Parameter parameter = parameters.getParameter(this.getObjectName());

        if (parameter != null && param.isAutomationEnabled()) {
            double time = ParameterTimeManagerFactory.getInstance().getTime();
            double val = parameter.getLine().getValue(time);

            setSelectedIndex((int) Math.round(val));
        }
    }

    @Override
    public BSBObject deepCopy() {
        return new BSBDropdown(this);
    }

}
