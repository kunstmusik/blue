/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
import blue.automation.ParameterList;
import static blue.orchestra.blueSynthBuilder.ClampedValueListener.BoundaryType.TRUNCATE;
import blue.utility.XMLUtilities;
import electric.xml.Element;

/**
 * Base Class for BSBObjects which are automatable. Care must be taken to
 * correctly add and remove Parameters to the parameter list.
 *
 * <ul>
 * <li>If automationAllowed is toggled, parameters need to be added or
 * removed.</li>
 * <li>If the objectName changes, the new name must be checked if it is unique.
 * If the object produces multiple values, it must check to see if all of the
 * generated values are unique. Old parameters must be removed and new
 * parameters added if the name changes. If the name changes to an empty string,
 * the parameters must be removed.</li>
 * </ul>
 *
 * @author steven
 */
public abstract class AutomatableBSBObject extends BSBObject {

    boolean automationAllowed = true;

    transient ParameterList parameters = null;

    public AutomatableBSBObject() {
        super();
    }

    public AutomatableBSBObject(AutomatableBSBObject bsbObj) {
        super(bsbObj);
        automationAllowed = bsbObj.isAutomationAllowed();
    }

    public void setParameterList(ParameterList parameters) {
        this.parameters = parameters;
        initializeParameters();
    }

    // OVERRIDE to handle parameter name changes
    @Override
    public void setObjectName(String objectName) {
        if (objectName == null || objectName.equals(getObjectName())) {
            return;
        }

        if (unm != null) {
            if (objectName != null && objectName.length() != 0
                    && !unm.isUnique(objectName)) {
                return;
            }
        }

        String oldName = this.getObjectName();

        boolean doInitialize = false;

        if (parameters != null && automationAllowed) {
            if (objectName == null || objectName.length() == 0) {
                parameters.removeParameter(oldName);
            } else {
                Parameter param = parameters.getParameter(oldName);

                if (param == null) {
                    doInitialize = true;
                } else {
                    param.setName(objectName);
                }
            }
        }

        super.setObjectName(objectName);

        if (doInitialize) {
            initializeParameters();
        }
    }

    public static void initBasicFromXML(Element data, BSBObject bsbObj) {
        BSBObject.initBasicFromXML(data, bsbObj);

        Element elem = data.getElement("automationAllowed");

        AutomatableBSBObject automatableBsbObj = ((AutomatableBSBObject) bsbObj);

        if (elem != null) {
            automatableBsbObj.automationAllowed = Boolean
                    .valueOf(elem.getTextString()).booleanValue();
        } else {
            automatableBsbObj.automationAllowed = false;
        }
    }

    public static Element getBasicXML(BSBObject bsbObj) {
        Element retVal = BSBObject.getBasicXML(bsbObj);

        retVal.addElement(XMLUtilities.writeBoolean("automationAllowed",
                ((AutomatableBSBObject) bsbObj).automationAllowed));

        return retVal;
    }

    /**
     * Method for BSBParameterList to call to make sure Parameters exist for
     * this object
     *
     * @param parameters
     */
    protected abstract void initializeParameters();

    public boolean isAutomationAllowed() {
        return automationAllowed;
    }

    public abstract void setAutomationAllowed(boolean allowAutomation);

    /** Used by sub-classes for ClampedValueListeners to adjust parameters*/
    protected void updateParameter(ClampedValue cv, Parameter param, 
            ClampedValueListener.PropertyType pType, 
            ClampedValueListener.BoundaryType bType) {
        switch (pType) {
            case MIN:
                param.setMin(cv.getMin(), bType == TRUNCATE);
                break;
            case MAX:
                param.setMax(cv.getMax(), bType == TRUNCATE);
                break;
            case VALUE:
                if (!param.isAutomationEnabled()) {
                    param.setValue(cv.getValue());
                }
                break;
            case RESOLUTION:
                param.setResolution(cv.getResolution());
                break;
        }
    }
}
