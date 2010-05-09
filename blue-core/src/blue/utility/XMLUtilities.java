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
package blue.utility;

import electric.xml.Element;

/**
 * Utilities for XML handling with EXML library
 * 
 * @author steven
 */
public class XMLUtilities {
    // TODO - Consider removing as it promotes not looping through elements
    public static int readInt(Element data, String nodeName) {
        return Integer.parseInt(data.getTextString(nodeName));
    }

    public static int readInt(Element data) {
        return Integer.parseInt(data.getTextString());
    }

    // TODO - Consider removing as it promotes not looping through elements
    public static float readFloat(Element data, String nodeName) {
        return Float.parseFloat(data.getTextString(nodeName));
    }

    public static float readFloat(Element data) {
        return Float.parseFloat(data.getTextString());
    }

    // TODO - Consider removing as it promotes not looping through elements
    public static boolean readBoolean(Element data, String nodeName) {
        return Boolean.valueOf(data.getTextString(nodeName)).booleanValue();
    }

    public static boolean readBoolean(Element data) {
        return Boolean.valueOf(data.getTextString()).booleanValue();
    }

    public static double readDouble(Element data) {
        return Double.parseDouble(data.getTextString());
    }

    public static Element writeInt(String nodeName, int val) {
        Element elem = new Element(nodeName);
        elem.setText(Integer.toString(val));

        return elem;
    }

    public static Element writeFloat(String nodeName, float val) {
        Element elem = new Element(nodeName);
        elem.setText(Float.toString(val));

        return elem;
    }

    public static Element writeDouble(String nodeName, double val) {
        Element elem = new Element(nodeName);
        elem.setText(Double.toString(val));

        return elem;
    }

    public static Element writeBoolean(String nodeName, boolean val) {
        Element elem = new Element(nodeName);
        elem.setText(Boolean.toString(val));

        return elem;
    }
}
