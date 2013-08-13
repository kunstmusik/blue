/*
 * blue - object composition environment for csound
 * Copyright (c) 2007 Steven Yi (stevenyi@gmail.com)
 *
 * Based on CMask by Andre Bartetzki
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
package blue.soundObject.jmask;

import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import org.apache.commons.lang3.builder.EqualsBuilder;
import org.apache.commons.lang3.builder.ToStringBuilder;

public class Quantizer implements Serializable {

    private double gridSize = 1.0;

    private double strength = 1.0;

    private double offset = 0.0;

    private boolean gridSizeTableEnabled = false;

    private boolean strengthTableEnabled = false;

    private boolean offsetTableEnabled = false;

    private Table gridSizeTable = new Table();

    private Table strengthTable = new Table();

    private Table offsetTable = new Table();

    private boolean enabled = false;
    
    private transient double duration = 1.0;

    public Quantizer() {
        gridSizeTable.getPoint(0).setValue(1.0);
        gridSizeTable.getPoint(0).setValue(1.0);
        gridSizeTable.setMin(Double.MIN_VALUE, true);

        strengthTable.getPoint(0).setValue(1.0);
        strengthTable.getPoint(0).setValue(1.0);

        offsetTable.getPoint(0).setValue(0.0);
        offsetTable.getPoint(0).setValue(0.0);
    }

    public static Quantizer loadFromXML(Element data) {
        Quantizer retVal = new Quantizer();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            String nodeVal = node.getTextString();

            if (nodeName.equals("gridSize")) {
                retVal.gridSize = Double.parseDouble(nodeVal);
            } else if (nodeName.equals("strength")) {
                retVal.strength = Double.parseDouble(nodeVal);
            } else if (nodeName.equals("offset")) {
                retVal.offset = Double.parseDouble(nodeVal);
            } else if (nodeName.equals("gridSizeTableEnabled")) {
                retVal.gridSizeTableEnabled = Boolean.valueOf(node.getTextString()).booleanValue();
            } else if (nodeName.equals("strengthTableEnabled")) {
                retVal.strengthTableEnabled = Boolean.valueOf(node.getTextString()).booleanValue();
            } else if (nodeName.equals("offsetTableEnabled")) {
                retVal.offsetTableEnabled = Boolean.valueOf(node.getTextString()).booleanValue();
            } else if (nodeName.equals("enabled")) {
                retVal.enabled = Boolean.valueOf(node.getTextString()).booleanValue();
            } else if (nodeName.equals("table")) {
                Table t = Table.loadFromXML(node);
                String tabInstance = node.getAttributeValue("tableId");

                if (tabInstance.equals("gridSizeTable")) {
                    retVal.gridSizeTable = t;
                } else if (tabInstance.equals("strengthTable")) {
                    retVal.strengthTable = t;
                } else if (tabInstance.equals("offsetTable")) {
                    retVal.offsetTable = t;
                }

            }

        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("quantizer");

        retVal.addElement(XMLUtilities.writeDouble("gridSize", gridSize));
        retVal.addElement(XMLUtilities.writeDouble("strength", strength));
        retVal.addElement(XMLUtilities.writeDouble("offset", offset));

        retVal.addElement(XMLUtilities.writeBoolean("gridSizeTableEnabled", gridSizeTableEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("strengthTableEnabled", strengthTableEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("offsetTableEnabled", offsetTableEnabled));

        retVal.addElement(XMLUtilities.writeBoolean("enabled", enabled));

        Element gridSizeTableNode = gridSizeTable.saveAsXML();
        Element strengthTableNode = strengthTable.saveAsXML();
        Element offsetTableNode = offsetTable.saveAsXML();

        gridSizeTableNode.setAttribute("tableId", "gridSizeTable");
        strengthTableNode.setAttribute("tableId", "strengthTable");
        offsetTableNode.setAttribute("tableId", "offsetTable");

        retVal.addElement(gridSizeTableNode);
        retVal.addElement(strengthTableNode);
        retVal.addElement(offsetTableNode);

        return retVal;
    }

    public double getValue(double time, double val) {

        if(!enabled) {
            return val;
        }

	double retVal,err,d,r;

        double localGridSize = gridSizeTableEnabled ?
            gridSizeTable.getValue(time / duration) : gridSize;

        double localStrength = strengthTableEnabled ?
            strengthTable.getValue(time / duration) : strength;

        double localOffset = offsetTableEnabled ?
            offsetTable.getValue(time / duration) : offset;

//        if(localGridSize == 0) {
//            throw new Exception("GridSize == 0");
//        }

	d = val - localOffset;
	r = Math.floor((d + localGridSize / 2.0) / localGridSize);
	err = d / localGridSize - r;
	retVal = localOffset + (r + err * (1 - localStrength)) * localGridSize;

//	if(limit)
//		{
//		if (erg < g1) erg = localOffset + (r + 1.0 + err*(1-localStrength)) * localGridSize;
//		if (erg > g2) erg = localOffset + (r - 1.0 + err*(1-localStrength)) * localGridSize;
//		}

	return retVal;

    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public double getGridSize() {
        return gridSize;
    }

    public void setGridSize(double gridSize) {
        this.gridSize = gridSize;
    }

    public double getStrength() {
        return strength;
    }

    public void setStrength(double strength) {
        this.strength = strength;
    }

    public double getOffset() {
        return offset;
    }

    public void setOffset(double offset) {
        this.offset = offset;
    }

    public boolean isGridSizeTableEnabled() {
        return gridSizeTableEnabled;
    }

    public void setGridSizeTableEnabled(boolean gridSizeTableEnabled) {
        this.gridSizeTableEnabled = gridSizeTableEnabled;
    }

    public boolean isStrengthTableEnabled() {
        return strengthTableEnabled;
    }

    public void setStrengthTableEnabled(boolean strengthTableEnabled) {
        this.strengthTableEnabled = strengthTableEnabled;
    }

    public boolean isOffsetTableEnabled() {
        return offsetTableEnabled;
    }

    public void setOffsetTableEnabled(boolean offsetTableEnabled) {
        this.offsetTableEnabled = offsetTableEnabled;
    }

    public Table getGridSizeTable() {
        return gridSizeTable;
    }

    public void setGridSizeTable(Table gridSizeTable) {
        this.gridSizeTable = gridSizeTable;
    }

    public Table getStrengthTable() {
        return strengthTable;
    }

    public void setStrengthTable(Table strengthTable) {
        this.strengthTable = strengthTable;
    }

    public Table getOffsetTable() {
        return offsetTable;
    }

    public void setOffsetTable(Table offsetTable) {
        this.offsetTable = offsetTable;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

//    public JComponent getEditor() {
//        return new QuantizerEditor(this);
//    }
    
    public void setDuration(double duration) {
        this.duration = duration;
    }
}
