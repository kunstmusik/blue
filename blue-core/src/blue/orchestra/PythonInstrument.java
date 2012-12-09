package blue.orchestra;

import blue.Tables;
import blue.scripting.PythonProxy;
import blue.udo.OpcodeList;
import blue.utility.TextUtilities;
import blue.utility.UDOUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.HashMap;

/**
 * <p>
 * Title: blue
 * </p>
 * <p>
 * Description: an object composition environment for csound
 * </p>
 * <p>
 * Copyright: Copyright (c) 2001-2002
 * </p>
 * <p>
 * Company: steven yi music
 * </p>
 * 
 * @author unascribed
 * @version 1.0
 */

public class PythonInstrument extends AbstractInstrument implements
        Serializable {

    String instrumentText;

    String globalOrc, globalSco;

    OpcodeList opcodeList;

    private transient HashMap udoReplacementValues;

    public PythonInstrument() {
        instrumentText = "#use variable instrument at end of script to bring instrument "
                + "back into blue\n\ninstrument = \"aout oscili 32000, 440, 1\"";
        globalOrc = "";
        globalSco = "";

        opcodeList = new OpcodeList();
    }

    public String getText() {
        return instrumentText;
    }

    public void setText(String iText) {
        this.instrumentText = iText;
    }

    public boolean hasFTable() {
        return false;
    }

    public void generateUserDefinedOpcodes(OpcodeList udoList) {
        udoReplacementValues = UDOUtilities.appendUserDefinedOpcodes(
                opcodeList, udoList);
    }

    public void generateFTables(Tables tables) {
    }

    // -------------------------------------------

    public String generateInstrument() {
        String retVal = PythonProxy.processPythonInstrument(instrumentText);

        if (udoReplacementValues != null) {
            retVal = TextUtilities.replaceOpcodeNames(udoReplacementValues,
                    retVal);
            udoReplacementValues = null;
        }
        return retVal;
    }

    public String toString() {
        return this.name;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.Instrument#generateGlobalOrc()
     */
    public String generateGlobalOrc() {
        return getGlobalOrc();
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.Instrument#generateGlobalSco()
     */
    public String generateGlobalSco() {
        return getGlobalSco();
    }

    /**
     * @return Returns the globalOrc.
     */
    public String getGlobalOrc() {
        return globalOrc;
    }

    /**
     * @param globalOrc
     *            The globalOrc to set.
     */
    public void setGlobalOrc(String globalOrc) {
        this.globalOrc = globalOrc;
    }

    /**
     * @return Returns the globalSco.
     */
    public String getGlobalSco() {
        return globalSco;
    }

    /**
     * @param globalSco
     *            The globalSco to set.
     */
    public void setGlobalSco(String globalSco) {
        this.globalSco = globalSco;
    }

    public static Instrument loadFromXML(Element data) throws Exception {
        PythonInstrument instr = new PythonInstrument();

        InstrumentUtilities.initBasicFromXML(data, instr);

        Elements elements = data.getElements();

        while (elements.hasMoreElements()) {
            Element node = elements.next();
            String nodeName = node.getName();

            if (nodeName.equals("globalOrc")) {
                instr.setGlobalOrc(node.getTextString());
            } else if (nodeName.equals("globalSco")) {
                instr.setGlobalSco(node.getTextString());
            } else if (nodeName.equals("instrumentText")) {
                instr.setText(node.getTextString());
            } else if (nodeName.equals("opcodeList")) {
                instr.opcodeList = OpcodeList.loadFromXML(node);
            }
        }

        return instr;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.Instrument#saveAsXML()
     */
    public Element saveAsXML() {
        Element retVal = InstrumentUtilities.getBasicXML(this);

        retVal.addElement("globalOrc").setText(this.getGlobalOrc());
        retVal.addElement("globalSco").setText(this.getGlobalSco());
        retVal.addElement("instrumentText").setText(this.getText());

        retVal.addElement(opcodeList.saveAsXML());

        return retVal;
    }

    public OpcodeList getOpcodeList() {
        return opcodeList;
    }
}