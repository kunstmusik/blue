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
import org.apache.commons.lang.builder.EqualsBuilder;
import org.apache.commons.lang.builder.ToStringBuilder;

public class Accumulator implements Serializable {

    public static final int ON = 0;

    public static final int LIMIT = 1;

    public static final int MIRROR = 2;

    public static final int WRAP = 3;

    public static final String[] MODES = {"On", "Limit", "Mirror", "Wrap"};

    Table highTable = new Table();

    Table lowTable = new Table();

    private boolean highTableEnabled = false;

    private boolean lowTableEnabled = false;

    int mode = ON;

    double low = 0.0;

    double high = 1.0;

    double initialValue = 0.0;

    boolean enabled = false;

    double runningValue = 0.0; // used only during compilaition time

    boolean firstTime = true; // used only during compilaition time
    
    private transient double duration = 1.0;

    public static Accumulator loadFromXML(Element data) {
        Accumulator retVal = new Accumulator();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();

            if (nodeName.equals("table")) {
                Table t = Table.loadFromXML(node);
                String tabInstance = node.getAttributeValue("tableId");

                if(tabInstance == null) {
                    continue;
                } else if (tabInstance.equals("highTable")) {
                    retVal.highTable = t;
                } else if (tabInstance.equals("lowTable")) {
                    retVal.lowTable = t;
                }

            } else if (nodeName.equals("highTableEnabled")) {
                retVal.highTableEnabled = Boolean.valueOf(node.getTextString()).booleanValue();
            } else if (nodeName.equals("lowTableEnabled")) {
                retVal.lowTableEnabled = Boolean.valueOf(node.getTextString()).booleanValue();
            } else if (nodeName.equals("mode")) {
                retVal.mode = Integer.parseInt(node.getTextString());
            } else if (nodeName.equals("low")) {
                retVal.low = Double.parseDouble(node.getTextString());
            } else if (nodeName.equals("high")) {
                retVal.high = Double.parseDouble(node.getTextString());
            } else if (nodeName.equals("initialValue")) {
                retVal.initialValue = Double.parseDouble(node.getTextString());
            } else if (nodeName.equals("enabled")) {
                retVal.enabled = Boolean.valueOf(node.getTextString()).booleanValue();

            }

        }
        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("accumulator");

        Element hTableNode = highTable.saveAsXML();
        hTableNode.setAttribute("tableId", "highTable");

        retVal.addElement(hTableNode);

        Element lTableNode = lowTable.saveAsXML();
        lTableNode.setAttribute("tableId", "lowTable");

        retVal.addElement(lTableNode);

        retVal.addElement(XMLUtilities.writeBoolean("highTableEnabled",
                highTableEnabled));
        retVal.addElement(XMLUtilities.writeBoolean("lowTableEnabled",
                lowTableEnabled));
        retVal.addElement(XMLUtilities.writeInt("mode", mode));
        retVal.addElement(XMLUtilities.writeDouble("low", low));
        retVal.addElement(XMLUtilities.writeDouble("high", high));
        retVal.addElement(XMLUtilities.writeDouble("initialValue", initialValue));
        retVal.addElement(XMLUtilities.writeBoolean("enabled", enabled));
        return retVal;
    }
    
//    public JComponent getEditor() {
//        return new AccumulatorEditor(this);
//    }

    public double getValue(double time, double val) {

        if (!enabled) {
            return val;
        }

        if (firstTime) {
            firstTime = false;
            // runningValue += initialValue;
            runningValue = initialValue; // TODO - Check
        }

        runningValue += val;

        double lowerBound = lowTableEnabled ? lowTable.getValue(time / duration) : low;
        double upperBound = highTableEnabled ? highTable.getValue(time / duration) : high;

        switch (mode) {
            case ON:
                break;
            case LIMIT:
                runningValue = Utilities.limit(runningValue, lowerBound,
                        upperBound);
                break;
            case MIRROR:
                runningValue = Utilities.mirror(runningValue, lowerBound,
                        upperBound);
                break;
            case WRAP:
                runningValue = Utilities.wrap(runningValue, lowerBound,
                        upperBound);
                break;
        }

        return runningValue;
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

    public Table getHighTable() {
        return highTable;
    }

    public void setHighTable(Table highTable) {
        this.highTable = highTable;
    }

    public double getLow() {
        return low;
    }

    public void setLow(double low) {
        this.low = low;
    }

    public Table getLowTable() {
        return lowTable;
    }

    public void setLowTable(Table lowTable) {
        this.lowTable = lowTable;
    }

    public int getMode() {
        return mode;
    }

    public void setMode(int mode) {
        this.mode = mode;
    }

    public double getRunningValue() {
        return runningValue;
    }

    public void setRunningValue(double value) {
        this.runningValue = value;
    }

    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public String toString() {
        return ToStringBuilder.reflectionToString(this);
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
    
    public void setDuration(double duration) {
        this.duration = duration;
    }
}
