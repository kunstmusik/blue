/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2014 Steven Yi (stevenyi@gmail.com)
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

import electric.xml.Element;

/**
 * @author Steven Yi
 * 
 * To change the template for this generated type comment go to
 * Window>Preferences>Java>Code Generation>Code and Comments
 */
public class InstrumentUtilities {

    public static Element getBasicXML(Instrument instr) {
        Element retVal = new Element("instrument");
        retVal.setAttribute("type", instr.getClass().getName());

        retVal.addElement("name").setText(instr.getName());
        retVal.addElement("comment").setText(instr.getComment());

        return retVal;
    }

    public static void initBasicFromXML(Element data, Instrument instr)
            throws Exception {

        String name = data.getTextString("name");
        String comment = data.getTextString("comment");

        if (name == null) {
            instr.setName("");
        } else {
            instr.setName(name);
        }

        if (comment == null) {
            instr.setComment("");
        } else {
            instr.setComment(comment);
        }
    }
}
