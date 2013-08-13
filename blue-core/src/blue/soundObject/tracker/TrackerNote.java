/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2006 Steven Yi (stevenyi@gmail.com)
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
package blue.soundObject.tracker;

import blue.utility.XMLUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Iterator;
import org.apache.commons.lang3.builder.EqualsBuilder;

public class TrackerNote implements Serializable {

    boolean tied = false;

    boolean off = false;

    ArrayList fields = new ArrayList();

    public boolean isTied() {
        return tied;
    }

    public void setTied(boolean tied) {
        this.tied = tied;
    }

    public boolean isOff() {
        return off;
    }

    public void setOff(boolean off) {
        this.off = off;
    }

    public int getNumFields() {
        return 1 + fields.size();
    }

    public void addColumn() {
        fields.add("");
    }

    public void removeColumn(int index) {
        int adjustIndex = index + 1;

        if (adjustIndex < 0 || adjustIndex > fields.size() - 1) {
            return;
        }

        fields.remove(adjustIndex);
    }

    public void setValue(int col, String value) {
        switch (col) {
            case 0:
                System.err.println("Error: TrackerNote: SetValue with column"
                        + " 0 should not be called");
                return;
            default:
                int index = col - 1;
                fields.set(index, value);
        }
        setOff(false);
    }

    public String getValue(int col) {
        if (off) {
            return "OFF";
        }

        switch (col) {
            case 0:
                return isTied() ? "-" : "";
        }

        int index = col - 1;
        return (String) fields.get(index);
    }

    /**
     * Return if the note has anything set and is active. Used when generating
     * notes by Track and TrackerObject to see if note is to be used for
     * compilation.
     * 
     * @return
     */
    public boolean isActive() {
        for (Iterator iter = fields.iterator(); iter.hasNext();) {
            String field = (String) iter.next();
            if (field.length() != 0) {
                return true;
            }
        }

        return false;
    }

    @Override
    public boolean equals(Object obj) {
        return EqualsBuilder.reflectionEquals(this, obj);
    }

    public Element saveAsXML() {
        Element retVal = new Element("trackerNote");

        retVal.addElement(XMLUtilities.writeBoolean("tied", tied));
        retVal.addElement(XMLUtilities.writeBoolean("off", off));

        for (Iterator iter = fields.iterator(); iter.hasNext();) {
            String val = (String) iter.next();
            retVal.addElement("field").setAttribute("val", val);
        }

        return retVal;
    }

    public static TrackerNote loadFromXML(Element data) {
        TrackerNote retVal = new TrackerNote();

        Elements nodes = data.getElements();

        while (nodes.hasMoreElements()) {
            Element node = nodes.next();
            String nodeName = node.getName();
            String nodeVal = node.getTextString();

            if (nodeName.equals("tied")) {
                retVal.tied = Boolean.valueOf(nodeVal).booleanValue();
            } else if (nodeName.equals("off")) {
                retVal.off = Boolean.valueOf(nodeVal).booleanValue();
            } else if (nodeName.equals("pitch")) {
                String val = (nodeVal == null) ? "" : nodeVal;
                retVal.fields.add(val);
            } else if (nodeName.equals("amp")) {
                String val = (nodeVal == null) ? "" : nodeVal;
                retVal.fields.add(val);
            } else if (nodeName.equals("field")
                    || nodeName.equals("otherField")) {
                String atVal = node.getAttributeValue("val");
                atVal = (atVal == null) ? "" : atVal;
                retVal.fields.add(atVal);
            }
        }

        return retVal;
    }

    public void copyValues(TrackerNote note) {
        this.setTied(note.isTied());
        this.setOff(note.isOff());
        this.fields = new ArrayList(note.fields);
    }

    public void clear() {
        for (int i = 0; i < fields.size(); i++) {
            fields.set(i, "");
        }
        setTied(false);
        setOff(false);
    }

}
