/*
 * Created on Feb 15, 2004
 * 
 * To change the template for this generated file go to Window - Preferences -
 * Java - Code Generation - Code and Comments
 */
package blue.soundObject.ceciliaModule;

import electric.xml.Element;
import java.io.Serializable;

/**
 * @author steven
 * 
 */
public abstract class CeciliaObject implements Serializable {

    String objectName = "";

    String label = "";

    /**
     * @return Returns the objectName.
     */
    public String getObjectName() {
        return objectName;
    }

    /**
     * @param objectName
     *            The objectName to set.
     */
    public void setObjectName(String objectName) {
        this.objectName = objectName;
    }

    public abstract void initialize(String[] tokens);

    public abstract String processText(String ceciliaText);

    public String getLabel() {
        if (this.label.equals("")) {
            return this.objectName;
        }
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    // public static abstract CeciliaObject loadFromXML(Element data);

    public abstract Element saveAsXML();

    public static void initBasicFromXML(Element data, CeciliaObject cObj) {
        cObj.setLabel(data.getTextString("label"));
        cObj.setObjectName(data.getTextString("objectName"));
    }

    public static Element getBasicXML(CeciliaObject cObj) {
        Element retVal = new Element("ceciliaObject");
        retVal.setAttribute("type", cObj.getClass().getName());

        retVal.addElement("label").setText(cObj.getLabel());
        retVal.addElement("objectName").setText(cObj.getObjectName());

        return retVal;

    }

}