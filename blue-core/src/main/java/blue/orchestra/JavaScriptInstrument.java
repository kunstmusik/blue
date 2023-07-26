package blue.orchestra;

import blue.Tables;
import blue.plugin.InstrumentPlugin;
import blue.scripting.JavaScriptProxy;
import blue.udo.OpcodeList;
import blue.utility.TextUtilities;
import blue.utility.UDOUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.HashMap;
import javax.script.ScriptException;
import org.openide.util.Exceptions;

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

@InstrumentPlugin(displayName = "JavaScriptInstrument", position = 30)
public class JavaScriptInstrument extends AbstractInstrument {

    String instrumentText;

    String globalOrc, globalSco;

    OpcodeList opcodeList;

    private transient HashMap udoReplacementValues;

    public JavaScriptInstrument() {
        instrumentText = "//use variable instrument at end of script to "
                + "bring instrument back into blue\n\n"
                + "instrument = \"aout oscili 32000, 440, 1\";";
        globalOrc = "";
        globalSco = "";

        opcodeList = new OpcodeList();
    }

    /** Copy Constructor */
    public JavaScriptInstrument(JavaScriptInstrument jsInstr) {
        super(jsInstr);
        instrumentText = jsInstr.instrumentText; 
        globalOrc = jsInstr.globalOrc; 
        globalSco = jsInstr.globalSco; 
        opcodeList = new OpcodeList(jsInstr.opcodeList); 
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

    @Override
    public void generateUserDefinedOpcodes(OpcodeList udoList) {
        udoReplacementValues = UDOUtilities.appendUserDefinedOpcodes(
                opcodeList, udoList);
    }

    @Override
    public void generateFTables(Tables tables) {
    }

    // -------------------------------------------

    @Override
    public String generateInstrument() {
        try {
            String retVal = JavaScriptProxy.processJavascriptInstrument(this.getText(),
                    this.getName());
            
            if (udoReplacementValues != null) {
                retVal = TextUtilities.replaceOpcodeNames(udoReplacementValues,
                        retVal);
                udoReplacementValues = null;
            }
            
            return retVal;
        } catch (ScriptException ex) {
            Exceptions.printStackTrace(ex);
            return "";
        }
    }

    @Override
    public String toString() {
        return this.name;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.Instrument#generateGlobalOrc()
     */
    @Override
    public String generateGlobalOrc() {
        return getGlobalOrc();
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.Instrument#generateGlobalSco()
     */
    @Override
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
        JavaScriptInstrument instr = new JavaScriptInstrument();

        InstrumentUtilities.initBasicFromXML(data, instr);

        Elements elements = data.getElements();

        while (elements.hasMoreElements()) {
            Element node = elements.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "globalOrc":
                    instr.setGlobalOrc(node.getTextString());
                    break;
                case "globalSco":
                    instr.setGlobalSco(node.getTextString());
                    break;
                case "instrumentText":
                    instr.setText(node.getTextString());
                    break;
                case "opcodeList":
                    instr.opcodeList = OpcodeList.loadFromXML(node);
                    break;
            }
        }

        return instr;
    }

    /*
     * (non-Javadoc)
     * 
     * @see blue.orchestra.Instrument#saveAsXML()
     */
    @Override
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

    @Override
    public JavaScriptInstrument deepCopy() {
        return new JavaScriptInstrument(this);
    }
}