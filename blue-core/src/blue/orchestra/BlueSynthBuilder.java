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

package blue.orchestra;

import blue.Tables;
import blue.automation.Automatable;
import blue.automation.ParameterList;
import blue.mixer.Channel;
import blue.orchestra.blueSynthBuilder.*;
import blue.plugin.InstrumentPlugin;
import blue.udo.OpcodeList;
import blue.utility.TextUtilities;
import blue.utility.UDOUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.HashMap;

/**
 * @author Steven Yi
 * 
 */

@InstrumentPlugin(displayName = "BlueSynthBuilder", position = 50)
public class BlueSynthBuilder extends AbstractInstrument implements
        Serializable, Automatable {

    BSBGraphicInterface graphicInterface;

    BSBParameterList parameterList;

    PresetGroup presetGroup;

    OpcodeList opcodeList;

    String instrumentText;

    private String alwaysOnInstrumentText;

    String globalOrc;

    String globalSco;

    boolean editEnabled = true;

    private transient BSBCompilationUnit bsbCompilationUnit;

    private transient HashMap udoReplacementValues;

    public BlueSynthBuilder() {
        this(true);
    }

    private BlueSynthBuilder(boolean init) {
        if (init) {
            graphicInterface = new BSBGraphicInterface();
            parameterList = new BSBParameterList();

            parameterList.setBSBGraphicInterface(graphicInterface);

            presetGroup = new PresetGroup();

            opcodeList = new OpcodeList();
        }

        instrumentText = "";
        alwaysOnInstrumentText = "";
        globalOrc = "";
        globalSco = "";
    }

    @Override
    public void generateUserDefinedOpcodes(OpcodeList udoList) {
        udoReplacementValues = UDOUtilities.appendUserDefinedOpcodes(
                opcodeList, udoList);
    }

    @Override
    public void generateFTables(Tables tables) {
        doPreCompilation();
    }

    @Override
    public String generateGlobalOrc() {
        String retVal = bsbCompilationUnit
                .replaceBSBValues(this.getGlobalOrc());

        return retVal;
    }

    @Override
    public String generateInstrument() {
        String retVal = bsbCompilationUnit
                .replaceBSBValues(getInstrumentText());

        if (udoReplacementValues != null) {
            retVal = TextUtilities.replaceOpcodeNames(udoReplacementValues,
                    retVal);
        }

        return retVal;
    }

    @Override
    public String generateAlwaysOnInstrument() {
        String retVal = bsbCompilationUnit
                .replaceBSBValues(getAlwaysOnInstrumentText());

        if (udoReplacementValues != null) {
            retVal = TextUtilities.replaceOpcodeNames(udoReplacementValues,
                    retVal);
            udoReplacementValues = null;
        }

        return retVal;
    }

    @Override
    public String generateGlobalSco() {
        String retVal = bsbCompilationUnit.replaceBSBValues(getGlobalSco());

        // doPostCompilation();

        return retVal;
    }

    private void doPreCompilation() {
        bsbCompilationUnit = new BSBCompilationUnit();
        graphicInterface.setupForCompilation(bsbCompilationUnit);
    }

    // private void doPostCompilation() {
    // bsbCompilationUnit = null;
    // }

    /* XML SERIALIZATION */

    public static Instrument loadFromXML(Element data) throws Exception {
        BlueSynthBuilder bsb = new BlueSynthBuilder(false);
        InstrumentUtilities.initBasicFromXML(data, bsb);

        String editEnabledStr = data.getAttributeValue("editEnabled");
        if (editEnabledStr != null) {
            bsb.setEditEnabled(Boolean.valueOf(editEnabledStr).booleanValue());
        }

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "globalOrc":
                    bsb.setGlobalOrc(node.getTextString());
                    break;
                case "globalSco":
                    bsb.setGlobalSco(node.getTextString());
                    break;
                case "instrumentText":
                    bsb.setInstrumentText(node.getTextString());
                    break;
                case "alwaysOnInstrumentText":
                    bsb.setAlwaysOnInstrumentText(node.getTextString());
                    break;
                case "graphicInterface":
                    bsb.setGraphicInterface(BSBGraphicInterface.loadFromXML(node));
                    break;
                case "presetGroup":
                    bsb.setPresetGroup(PresetGroup.loadFromXML(node));
                    break;
                case "bsbParameterList":
                    bsb.parameterList = (BSBParameterList) BSBParameterList
                            .loadFromXML(node);
                    break;
                case "opcodeList":
                    bsb.opcodeList = OpcodeList.loadFromXML(node);
                    break;
            }

        }

        if (bsb.presetGroup == null) {
            bsb.presetGroup = new PresetGroup();
        }

        if (bsb.graphicInterface == null) {
            bsb.graphicInterface = new BSBGraphicInterface();
        }

        if (bsb.parameterList == null) {
            bsb.parameterList = new BSBParameterList();
        }

        if (bsb.opcodeList == null) {
            bsb.opcodeList = new OpcodeList();
        }

        bsb.parameterList.setBSBGraphicInterface(bsb.graphicInterface);

        return bsb;
    }

    @Override
    public Element saveAsXML() {
        Element retVal = InstrumentUtilities.getBasicXML(this);

        retVal.setAttribute("editEnabled", Boolean.toString(editEnabled));

        retVal.addElement("globalOrc").setText(this.getGlobalOrc());
        retVal.addElement("globalSco").setText(this.getGlobalSco());
        retVal.addElement("instrumentText").setText(this.getInstrumentText());
        retVal.addElement("alwaysOnInstrumentText").setText(this.getAlwaysOnInstrumentText());

        retVal.addElement(graphicInterface.saveAsXML());
        retVal.addElement(parameterList.saveAsXML());
        retVal.addElement(presetGroup.saveAsXML());

        retVal.addElement(opcodeList.saveAsXML());

        return retVal;
    }

    @Override
    public String toString() {
        return this.name;
    }

    /* ACCESSOR METHODS */

    /**
     * @return Returns the graphicInterface.
     */
    public BSBGraphicInterface getGraphicInterface() {
        return graphicInterface;
    }

    /**
     * @param graphicInterface
     *            The graphicInterface to set.
     */
    public void setGraphicInterface(BSBGraphicInterface graphicInterface) {
        this.graphicInterface = graphicInterface;
    }

    /**
     * @return Returns the instrumentText.
     */
    public String getInstrumentText() {
        return instrumentText;
    }

    /**
     * @param instrumentText
     *            The instrumentText to set.
     */
    public void setInstrumentText(String instrumentText) {
        this.instrumentText = (instrumentText == null) ? "" : instrumentText;
    }

    /**
     * @return the alwaysOnInstrumentText
     */
    public String getAlwaysOnInstrumentText() {
        return alwaysOnInstrumentText;
    }

    /**
     * @param alwaysOnInstrumentText the alwaysOnInstrumentText to set
     */
    public void setAlwaysOnInstrumentText(String alwaysOnInstrumentText) {
        this.alwaysOnInstrumentText = (alwaysOnInstrumentText == null) ? "" : alwaysOnInstrumentText;
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

    public PresetGroup getPresetGroup() {
        return presetGroup;
    }

    public void setPresetGroup(PresetGroup presetGroup) {
        this.presetGroup = presetGroup;
    }

    @Override
    public ParameterList getParameterList() {
        return parameterList;
    }

    /**
     * Clears Parameter settings. Used when a copy of this object is being made
     * by the user. Not implemented to do automatically on serialization as
     * BlueData is copied via serialization before rendering and all data must
     * stay valid.
     * 
     * In 0.114.0, modified to also reset any subchannel dropdowns to MASTER
     */
    public void clearParameters() {
        for (int i = 0; i < graphicInterface.size(); i++) {
            BSBObject bsbObj = graphicInterface.getBSBObject(i);

            if (bsbObj instanceof BSBSubChannelDropdown) {
                ((BSBSubChannelDropdown) bsbObj)
                        .setChannelOutput(Channel.MASTER);
            }
        }

        parameterList = new BSBParameterList();
        parameterList.setBSBGraphicInterface(graphicInterface);
    }

    /*
     * This gets called as part of Serialization by Java and will do default
     * serialization plus reconnect the BSBGraphicInterface to the
     * BSBParameterList
     */
    private void readObject(ObjectInputStream stream) throws IOException,
            ClassNotFoundException {
        stream.defaultReadObject();

        parameterList.setBSBGraphicInterface(graphicInterface);
    }

    public boolean isEditEnabled() {
        return editEnabled;
    }

    public void setEditEnabled(boolean editEnabled) {
        this.editEnabled = editEnabled;
    }

    public OpcodeList getOpcodeList() {
        return opcodeList;
    }

    public void setOpcodeList(OpcodeList opcodeList) {
        this.opcodeList = opcodeList;
    }

    @Override
    public ArrayList<StringChannel> getStringChannels() {
        ArrayList<StringChannel> stringChannels = new ArrayList<>();
        
        for(int i = 0; i < graphicInterface.size(); i++) {
            BSBObject bsbObj = graphicInterface.getBSBObject(i);
            
            if(bsbObj instanceof StringChannelProvider) {
                StringChannelProvider provider = (StringChannelProvider)bsbObj;
                if(provider.isStringChannelEnabled()) {
                    stringChannels.add(provider.getStringChannel());
                }
            }
        }
        
        return stringChannels;
    }
}