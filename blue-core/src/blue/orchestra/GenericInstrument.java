/*
 * blue - object composition environment for csound
 * Copyright (c) 2001-2003 Steven Yi (stevenyi@gmail.com)
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

package blue.orchestra;

import blue.Tables;
import blue.udo.OpcodeList;
import blue.utility.TextUtilities;
import blue.utility.UDOUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.HashMap;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 * 
 * @author steven yi
 * @version 1.0
 */

public class GenericInstrument extends AbstractInstrument implements
        Serializable {

    String instrumentText;

    String globalOrc;

    String globalSco;

    OpcodeList opcodeList;

    private transient HashMap udoReplacementValues;

    public GenericInstrument() {
        instrumentText = "";
        globalOrc = "";
        globalSco = "";
        opcodeList = new OpcodeList();
    }

    public String generateInstrument() {
        String retVal = instrumentText;

        // the case for auto-generated generic instruments
        if (udoReplacementValues != null) {
            retVal = TextUtilities.replaceOpcodeNames(udoReplacementValues,
                    retVal);
            udoReplacementValues = null;
        }

        return retVal;
    }

    public String getText() {
        return instrumentText;
    }

    public void setText(String iText) {
        if (iText == null) {
            this.instrumentText = "";
        } else {
            this.instrumentText = iText;
        }
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

    @Override
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
        if (globalOrc == null) {
            this.globalOrc = "";
        } else {
            this.globalOrc = globalOrc;
        }
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
        if (globalSco == null) {
            this.globalSco = "";
        } else {
            this.globalSco = globalSco;
        }
    }

    public static Instrument loadFromXML(Element data) throws Exception {
        GenericInstrument instr = new GenericInstrument();

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