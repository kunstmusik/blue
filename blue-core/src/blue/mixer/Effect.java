/*
 * blue - object composition environment for csound Copyright (c) 2000-2005
 * Steven Yi (stevenyi@gmail.com)
 *
 * This program is free software; you can redistribute it and/or modify it under
 * the terms of the GNU General Public License as published by the Free
 * Software Foundation; either version 2 of the License or (at your option) any
 * later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more
 * details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; see the file COPYING.LIB. If not, write to the Free
 * Software Foundation Inc., 59 Temple Place - Suite 330, Boston, MA 02111-1307
 * USA
 */

package blue.mixer;

import blue.automation.Automatable;
import blue.automation.ParameterList;
import blue.orchestra.blueSynthBuilder.BSBCompilationUnit;
import blue.orchestra.blueSynthBuilder.BSBGraphicInterface;
import blue.orchestra.blueSynthBuilder.BSBParameterList;
import blue.orchestra.blueSynthBuilder.StringChannel;
import blue.udo.OpcodeList;
import blue.udo.UserDefinedOpcode;
import blue.utility.TextUtilities;
import blue.utility.UDOUtilities;
import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.beans.PropertyChangeEvent;
import java.beans.PropertyChangeListener;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Vector;
import org.apache.commons.lang3.text.StrBuilder;

public class Effect implements Automatable {

    private int numIns = 2;
    private int numOuts = 2;
    private BSBGraphicInterface graphicInterface;
    private String code = "";
    private String name = "New Effect";
    private String comments = "";
    private OpcodeList opcodeList;
    private boolean enabled = true;
    private transient Vector listeners = null;
    private BSBParameterList parameterList = null;

    public Effect() {
        this(true);
    }

    private Effect(boolean init) {
        if (init) {
            graphicInterface = new BSBGraphicInterface();
            parameterList = new BSBParameterList();
            parameterList.setBSBGraphicInterface(graphicInterface);
            opcodeList = new OpcodeList();
        }
    }

    public Effect(Effect effect) {
        numIns = effect.numIns;
        numOuts = effect.numOuts;
        code = effect.code;
        name = effect.name;
        comments = effect.comments;
        enabled = effect.enabled;
        graphicInterface = new BSBGraphicInterface(effect.graphicInterface);
        parameterList = new BSBParameterList(effect.parameterList);
        parameterList.setBSBGraphicInterface(graphicInterface);
        opcodeList = new OpcodeList(effect.opcodeList);
    }

    public UserDefinedOpcode generateUDO(OpcodeList udoList) {

        HashMap udoReplacementValues = UDOUtilities.appendUserDefinedOpcodes(
                opcodeList, udoList);

        UserDefinedOpcode udo = new UserDefinedOpcode();

        BSBCompilationUnit bsbUnit = new BSBCompilationUnit();
        graphicInterface.setupForCompilation(bsbUnit);

        StrBuilder buffer = new StrBuilder();
        buffer.append(getXinText()).append("\n");

        buffer.append(bsbUnit.replaceBSBValues(code)).append("\n");

        buffer.append(getXoutText()).append("\n");

        String udoCode = buffer.toString();

        if (udoReplacementValues != null) {
            udoCode = TextUtilities.replaceOpcodeNames(udoReplacementValues,
                    udoCode);
        }

        udo.codeBody = udoCode;

        udo.inTypes = getSigTypes(numIns);
        udo.outTypes = getSigTypes(numOuts);

        return udo;
    }

    public static Effect loadFromXML(Element data) throws Exception {
        Effect effect = new Effect(false);

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "name":
                    effect.setName(node.getTextString());
                    break;
                case "enabled":
                    effect.setEnabled(XMLUtilities.readBoolean(node));
                    break;
                case "numIns":
                    effect.setNumIns(XMLUtilities.readInt(node));
                    break;
                case "numOuts":
                    effect.setNumOuts(XMLUtilities.readInt(node));
                    break;
                case "code":
                    effect.setCode(node.getTextString());
                    break;
                case "comments":
                    effect.setComments(node.getTextString());
                    break;
                case "opcodeList":
                    effect.opcodeList = OpcodeList.loadFromXML(node);
                    break;
                case "graphicInterface":
                    effect.setGraphicInterface(BSBGraphicInterface
                            .loadFromXML(node));
                    break;
                case "bsbParameterList":
                    effect.parameterList = (BSBParameterList) BSBParameterList
                            .loadFromXML(node);
                    break;
            }
        }

        if (effect.opcodeList == null) {
            effect.opcodeList = new OpcodeList();
        }

        if (effect.graphicInterface == null) {
            effect.graphicInterface = new BSBGraphicInterface();
        }

        if (effect.parameterList == null) {
            effect.parameterList = new BSBParameterList();
        }

        effect.parameterList.setBSBGraphicInterface(effect.graphicInterface);

        return effect;
    }

    public Element saveAsXML() {
        Element retVal = new Element("effect");

        retVal.addElement("name").setText(name);
        retVal.addElement(XMLUtilities.writeBoolean("enabled", enabled));
        retVal.addElement(XMLUtilities.writeInt("numIns", numIns));
        retVal.addElement(XMLUtilities.writeInt("numOuts", numOuts));
        retVal.addElement("code").setText(code);
        retVal.addElement("comments").setText(comments);
        retVal.addElement(opcodeList.saveAsXML());
        retVal.addElement(graphicInterface.saveAsXML());
        retVal.addElement(parameterList.saveAsXML());

        return retVal;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public int getNumIns() {
        return numIns;
    }

    public void setNumIns(int numIns) {
        Integer oldVal = new Integer(this.numIns);
        Integer newVal = new Integer(numIns);

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "numIns",
                oldVal, newVal);

        this.numIns = numIns;

        firePropertyChangeEvent(pce);
    }

    public int getNumOuts() {
        return numOuts;
    }

    public void setNumOuts(int numOuts) {

        Integer oldVal = new Integer(this.numOuts);
        Integer newVal = new Integer(numOuts);

        PropertyChangeEvent pce = new PropertyChangeEvent(this, "numOuts",
                oldVal, newVal);

        this.numOuts = numOuts;

        firePropertyChangeEvent(pce);
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public OpcodeList getOpcodeList() {
        return opcodeList;
    }

    public BSBGraphicInterface getGraphicInterface() {
        return graphicInterface;
    }

    public void setGraphicInterface(BSBGraphicInterface graphicInterface) {
        this.graphicInterface = graphicInterface;
    }

    private void firePropertyChangeEvent(PropertyChangeEvent pce) {
        if (listeners == null) {
            return;
        }

        for (Iterator iter = listeners.iterator(); iter.hasNext();) {
            PropertyChangeListener listener = (PropertyChangeListener) iter
                    .next();

            listener.propertyChange(pce);
        }
    }

    public void addPropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            listeners = new Vector();
        }

        listeners.add(pcl);
    }

    public void removePropertyChangeListener(PropertyChangeListener pcl) {
        if (listeners == null) {
            return;
        }
        listeners.remove(pcl);
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getComments() {
        return comments;
    }

    public void setComments(String comments) {
        this.comments = comments;
    }

    @Override
    public String toString() {
        return getName();
    }

//    public JComponent getEditor() {
//        // TODO - fix this!
////        return null;
//        BSBEditPanel editPanel = new BSBEditPanel(BSBObjectRegistry
//                .getBSBObjects());
//        editPanel.editBSBGraphicInterface(graphicInterface);
//
//        return editPanel;
//    }

    private String getXinText() {
        StringBuilder buffer = new StringBuilder();

        for (int i = 0; i < numIns; i++) {
            if (i > 0) {
                buffer.append(",");
            }
            buffer.append("ain").append(i + 1);
        }

        buffer.append("\txin");

        return buffer.toString();
    }

    private String getXoutText() {
        StringBuilder buffer = new StringBuilder();

        buffer.append("xout\t");

        for (int i = 0; i < numOuts; i++) {
            if (i > 0) {
                buffer.append(",");
            }
            buffer.append("aout").append(i + 1);
        }

        return buffer.toString();
    }

    private String getSigTypes(int num) {
        StringBuilder buffer = new StringBuilder();

        for (int i = 0; i < num; i++) {
            buffer.append("a");
        }

        return buffer.toString();
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
     */
    public void clearParameters() {
        parameterList = new BSBParameterList();
        parameterList.setBSBGraphicInterface(graphicInterface);
    }

    @Override
    public ArrayList<StringChannel> getStringChannels() {
        return null;
    }
}
