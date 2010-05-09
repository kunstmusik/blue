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

package blue;

import java.io.Serializable;

import blue.orchestra.Instrument;
import blue.utility.ObjectUtilities;
import electric.xml.Element;

/**
 * @author Steven Yi
 */
public class InstrumentAssignment implements Serializable, Comparable {

    public String arrangementId = "";

    public Instrument instr;

    public boolean enabled = true;

    // NEW SERIALIZATION METHODS

    public static InstrumentAssignment loadFromXML(Element data)
            throws Exception {
        InstrumentAssignment retVal = new InstrumentAssignment();

        retVal.arrangementId = data.getAttributeValue("arrangementId");

        String enabled = data.getAttributeValue("isEnabled");

        if (enabled != null) {
            retVal.enabled = Boolean.valueOf(enabled).booleanValue();
        }

        if (data.getElement("instrument") != null) {
            retVal.instr = (Instrument) ObjectUtilities.loadFromXML(data
                    .getElement("instrument"));
        }

        return retVal;
    }

    public Element saveAsXML() {
        Element retVal = new Element("instrumentAssignment");

        retVal.setAttribute("arrangementId", arrangementId);
        retVal.setAttribute("isEnabled", Boolean.toString(enabled));

        retVal.addElement(instr.saveAsXML());

        return retVal;
    }

    // OLD SERIALIZATION METHODS

    /**
     * Used by old pre 0.95.0 code before instrument libraries removed from
     * project and user instrument library was implemented.
     * 
     * This code is here to maintain compatibility with projects that still
     * contain InstrumentLibraries and is used when migrating to new format.
     * 
     * @deprecated
     */
    public static InstrumentAssignment loadFromXML(Element data,
            InstrumentLibrary iLibrary) {
        InstrumentAssignment retVal = new InstrumentAssignment();

        retVal.arrangementId = data.getAttributeValue("arrangementId");
        retVal.instr = iLibrary.getInstrumentById(data
                .getAttributeValue("instrumentId"));

        String enabled = data.getAttributeValue("isEnabled");

        if (enabled != null) {
            retVal.enabled = Boolean.valueOf(enabled).booleanValue();
        }

        return retVal;
    }

    /**
     * Used by old pre 0.95.0 code before instrument libraries removed from
     * project and user instrument library was implemented.
     * 
     * This code is here to maintain compatibility with projects that still
     * contain InstrumentLibraries and is used when migrating to new format.
     * 
     * @deprecated
     */
    public Element saveAsXML(InstrumentLibrary iLibrary) {
        Element retVal = new Element("instrumentAssignment");

        retVal.setAttribute("arrangementId", arrangementId);
        retVal.setAttribute("instrumentId", iLibrary.getInstrumentId(instr));
        retVal.setAttribute("isEnabled", Boolean.toString(enabled));

        return retVal;
    }

    /*
     * (non-Javadoc)
     * 
     * @see java.lang.Comparable#compareTo(java.lang.Object)
     */
    public int compareTo(Object o) {
        InstrumentAssignment ia = (InstrumentAssignment) o;

        try {
            int a = Integer.parseInt(this.arrangementId);
            int b = Integer.parseInt(ia.arrangementId);

            return a - b;

        } catch (NumberFormatException nfe) {
            return (this.arrangementId).compareToIgnoreCase(ia.arrangementId);
        }
    }

    /**
     * 
     */
    public void normalize() {
        this.instr = (Instrument) this.instr.clone();
    }
}