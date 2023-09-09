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
import org.apache.commons.lang3.builder.ToStringBuilder;

public class Mask {

    private double high = 1.0;

    private double low = 0.0;

    private double mapValue = 0.0;

    private boolean highTableEnabled = false;

    private boolean lowTableEnabled = false;

    private Table highTable = new Table();

    private Table lowTable = new Table();

    private boolean enabled = false;

    private transient double duration = 1.0;

    public Mask() {
    }

    public Mask(Mask mask) {
        high = mask.high;
        low = mask.low;
        mapValue = mask.mapValue;
        highTableEnabled = mask.highTableEnabled;
        lowTableEnabled = mask.lowTableEnabled;
        highTable = new Table(mask.highTable);
        lowTable = new Table(mask.lowTable);
        enabled = mask.enabled;
    }

    public static Mask loadFromXML(Element data) {
        Mask retVal = new Mask();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            switch (nodeName) {
                case "table":
                    Table t = Table.loadFromXML(node);
                    String tabInstance = node.getAttributeValue("tableId");
                    switch (tabInstance) {
                        case "highTable":
                            retVal.highTable = t;
                            break;
                        case "lowTable":
                            retVal.lowTable = t;
                            break;
                    }
                    break;
                case "highTableEnabled":
                    retVal.highTableEnabled = Boolean.valueOf(node.getTextString()).booleanValue();
                    break;
                case "lowTableEnabled":
                    retVal.lowTableEnabled = Boolean.valueOf(node.getTextString()).booleanValue();
                    break;
                case "low":
                    retVal.low = Double.parseDouble(node.getTextString());
                    break;
                case "high":
                    retVal.high = Double.parseDouble(node.getTextString());
                    break;
                case "mapValue":
                    retVal.mapValue = Double.parseDouble(node.getTextString());
                    break;
                case "enabled":
                    retVal.enabled = Boolean.valueOf(node.getTextString()).booleanValue();
                    break;
            }

        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("mask");

        retVal.addElement(XMLUtilities.writeBoolean("highTableEnabled",
                highTableEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("lowTableEnabled",
                lowTableEnabled));
        retVal.addElement(XMLUtilities.writeDouble("low", low));
        retVal.addElement(XMLUtilities.writeDouble("high", high));
        retVal.addElement(XMLUtilities.writeDouble("mapValue", mapValue));
        retVal.addElement(XMLUtilities.writeBoolean("enabled", enabled));

        Element hTableNode = highTable.saveAsXML();
        hTableNode.setAttribute("tableId", "highTable");

        retVal.addElement(hTableNode);

        Element lTableNode = lowTable.saveAsXML();
        lTableNode.setAttribute("tableId", "lowTable");

        retVal.addElement(lTableNode);

        return retVal;
    }

    private double mapper(double x, double e) {
        if (e == 0.0) {
            return x;
        } else {
            return Math.pow(x, e);
        }
    }

    public double getValue(double time, double val) {

        if (!enabled) {
            return val;
        }

        double localHigh = highTableEnabled ? highTable.getValue(time / duration) : high;
        double localLow = lowTableEnabled ? lowTable.getValue(time / duration) : low;

        double retVal = localLow + (localHigh - localLow) * mapper(val, mapValue);

        return retVal;

    }

//    public JComponent getEditor() {
//        return new MaskEditor(this);
//    }
    @Override
    public String toString() {
        return ToStringBuilder.reflectionToString(this);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public double getHigh() {
        return high;
    }

    public void setHigh(double high) {
        this.high = high;
    }

    public double getLow() {
        return low;
    }

    public void setLow(double low) {
        this.low = low;
    }

    public double getMapValue() {
        return mapValue;
    }

    public void setMapValue(double mapValue) {
        this.mapValue = mapValue;
    }

    public boolean isHighTableEnabled() {
        return highTableEnabled;
    }

    public void setHighTableEnabled(boolean highTableEnabled) {
        this.highTableEnabled = highTableEnabled;
    }

    public boolean isLowTableEnabled() {
        return lowTableEnabled;
    }

    public void setLowTableEnabled(boolean lowTableEnabled) {
        this.lowTableEnabled = lowTableEnabled;
    }

    public Table getHighTable() {
        return highTable;
    }

    public void setHighTable(Table highTable) {
        this.highTable = highTable;
    }

    public Table getLowTable() {
        return lowTable;
    }

    public void setLowTable(Table lowTable) {
        this.lowTable = lowTable;
    }

    public void setDuration(double duration) {
        this.duration = duration;
    }
}
