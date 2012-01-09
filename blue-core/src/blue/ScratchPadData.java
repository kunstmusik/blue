/*
 * Created on May 1, 2003
 *  
 */
package blue;

import electric.xml.Element;
import java.io.Serializable;

public class ScratchPadData implements Serializable {

    private String scratchText = "";

    private boolean isWordWrapEnabled = true;

    public ScratchPadData() {

    }

    /**
     * @return
     */
    public boolean isWordWrapEnabled() {
        return isWordWrapEnabled;
    }

    /**
     * @param b
     */
    public void setWordWrapEnabled(boolean b) {
        isWordWrapEnabled = b;
    }

    /**
     * @return
     */
    public String getScratchText() {
        return scratchText;
    }

    /**
     * @param string
     */
    public void setScratchText(String scratchText) {
        this.scratchText = scratchText;
    }

    public static ScratchPadData loadFromXML(Element data) {
        ScratchPadData scratch = new ScratchPadData();

        scratch.setWordWrapEnabled(Boolean.valueOf(
                data.getTextString("isWordWrapEnabled")).booleanValue());
        scratch.setScratchText(data.getTextString("scratchText"));

        return scratch;
    }

    /**
     * @return
     */
    public Element saveAsXML() {
        Element retVal = new Element("scratchPadData");

        retVal.addElement("isWordWrapEnabled").setText(
                Boolean.toString(isWordWrapEnabled()));
        retVal.addElement("scratchText").setText(getScratchText());

        return retVal;
    }

}