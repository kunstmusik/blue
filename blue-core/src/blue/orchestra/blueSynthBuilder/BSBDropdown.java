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

/**
 * @author Steven Yi
 */
public class BSBDropdown extends AutomatableBSBObject implements
        ParameterListener, Randomizable {

    BSBDropdownItemList dropdownItems = new BSBDropdownItemList();

    int selectedIndex = 0;

    private boolean randomizable = true;

    public BSBDropdown() {
    }

    public static BSBObject loadFromXML(Element data) {
        BSBDropdown dropDown = new BSBDropdown();
        initBasicFromXML(data, dropDown);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("bsbDropdownItemList")) {
                dropDown.setDropdownItems(BSBDropdownItemList.loadFromXML(node));
            } else if (nodeName.equals("selectedIndex")) {
                dropDown.setSelectedIndex(Integer.parseInt(node.getTextString()));
            } else if (nodeName.equals("randomizable")) {
                dropDown.randomizable = XMLUtilities.readBoolean(node);
            }
        }

        return dropDown;
    }

    public Element saveAsXML() {
        Element retVal = getBasicXML(this);

        retVal.addElement(dropdownItems.saveAsXML());
        retVal.addElement("selectedIndex").setText(
                Integer.toString(this.getSelectedIndex()));
        retVal.addElement(XMLUtilities.writeBoolean("randomizable",
                randomizable));

        return retVal;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setupForCompilation(blue.orchestra.blueSynthBuilder.BSBCompilationUnit)
     */
    public void setupForCompilation(BSBCompilationUnit compilationUnit) {

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null && param.getCompilationVarName() != null) {
                compilationUnit.addReplacementValue(objectName, param
                        .getCompilationVarName());
                return;
            }
        }

        if (dropdownItems.size() == 0) {
            compilationUnit.addReplacementValue(objectName, "0");
        } else {
            
            String replaceVal;
            
            if(isAutomationAllowed()) {
                replaceVal = "" + selectedIndex;
            } else {
                BSBDropdownItem item = (BSBDropdownItem) dropdownItems.get(selectedIndex);
                replaceVal = item.getValue();
            }

            compilationUnit.addReplacementValue(objectName, replaceVal);
        }

    }

    /**
     * @return Returns the dropdownItems.
     */
    public BSBDropdownItemList getDropdownItems() {
        return dropdownItems;
    }

    /**
     * @param dropdownItems
     *            The dropdownItems to set.
     */
    public void setDropdownItems(BSBDropdownItemList dropdownItems) {
        this.dropdownItems = dropdownItems;
    }

    /**
     * @return Returns the selectedIndex.
     */
    public int getSelectedIndex() {
        return selectedIndex;
    }

    /**
     * @param selectedIndex
     *            The selectedIndex to set.
     */
    public void setSelectedIndex(int selectedIndex) {
        int tempIndex = selectedIndex;
        if (tempIndex >= dropdownItems.size()) {
            tempIndex = dropdownItems.size() - 1;
        }

        int oldValue = this.selectedIndex;
        this.selectedIndex = tempIndex;

        if (parameters != null) {
            Parameter param = parameters.getParameter(this.getObjectName());
            if (param != null) {
                param.setValue(this.selectedIndex);
            }
        }

        if (propListeners != null) {
            propListeners.firePropertyChange("value", new Integer(oldValue),
                    new Integer(this.selectedIndex));
        }
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#getPresetValue()
     */
    public String getPresetValue() {
        BSBDropdownItem item = (BSBDropdownItem) dropdownItems.get(selectedIndex);
        return "id:" + item.getUniqueId();
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.blueSynthBuilder.BSBObject#setPresetValue(java.lang.String)
     */
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
    public boolean isRandomizable() {
        return randomizable;
    }

    public void randomize() {
        if (randomizable) {

            int randomIndex = (int) (Math.random() * dropdownItems.size());

            if (randomIndex != this.getSelectedIndex()) {
                int oldIndex = this.selectedIndex;
                setSelectedIndex(randomIndex);

                if (propListeners != null) {
                    propListeners.firePropertyChange("selectedIndex", oldIndex,
                            randomIndex);
                }
            }
        }
    }

    public void setRandomizable(boolean randomizable) {
        this.randomizable = randomizable;
        fireBSBObjectChanged();
    }

    /* AUTOMATABLE METHODS */
    @Override
    protected void initializeParameters() {
        if (parameters == null) {
            return;
        }

        if (!automationAllowed) {
            if (objectName != null && objectName.length() != 0) {
                Parameter param = parameters.getParameter(objectName);
                if (param != null && param.isAutomationEnabled()) {
                    automationAllowed = true;
                } else {
                    parameters.removeParameter(objectName);
                    return;
                }
            }
        }

        if (this.objectName == null || this.objectName.trim().length() == 0) {
            return;
        }

        Parameter parameter = parameters.getParameter(this.objectName);

        if (parameter != null) {
            parameter.addParameterListener(this);

            if (!parameter.isAutomationEnabled()) {
                parameter.setValue(getSelectedIndex());
            }

            return;
        }

        Parameter param = new Parameter();
        param.setValue(getSelectedIndex());
        param.setMax(this.getDropdownItems().size() - 1, true);
        param.setMin(0.0f, true);
        param.setName(getObjectName());
        param.setResolution(1.0f);
        param.addParameterListener(this);

        parameters.addParameter(param);
    }

    @Override
    public void setAutomationAllowed(boolean allowAutomation) {
        this.automationAllowed = allowAutomation;

        if (parameters != null) {
            if (allowAutomation) {
                initializeParameters();
            } else if (objectName != null && objectName.length() != 0) {
                parameters.removeParameter(objectName);
            }
        }
    }

    public void parameterChanged(Parameter param) {
    }


    private void updateSelectedIndex(int index) {
        int oldValue = this.selectedIndex;
        this.selectedIndex = index;

        if (propListeners != null) {
            propListeners.firePropertyChange("updateValue",
                    new Integer(oldValue), new Integer(this.selectedIndex));
        }
    }

    public void lineDataChanged(Parameter param) {
        Parameter parameter = parameters.getParameter(this.objectName);

        if (parameter != null) {
            float time = ParameterTimeManagerFactory.getInstance().getTime();
            int val = Math.round(parameter.getLine().getValue(time));

            updateSelectedIndex(val);
        }
    }
}
