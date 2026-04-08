/*
 * blue - object composition environment for csound
 * Copyright (c) 2000-2007 Steven Yi (stevenyi@gmail.com)
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
package blue.udo;

import electric.xml.Element;
import static org.junit.jupiter.api.Assertions.*;
import org.junit.jupiter.api.Test;

class OpcodeListTest {

    @Test
    void testGetNameOfExistingCopy() {
        OpcodeList list = new OpcodeList();

        UserDefinedOpcode udo1 = new UserDefinedOpcode();
        udo1.setOpcodeName("test1");
        udo1.inTypes = "i";
        udo1.outTypes = "i";
        udo1.codeBody = "code";

        list.addOpcode(udo1);

        UserDefinedOpcode udo2 = new UserDefinedOpcode();
        udo2.setOpcodeName("test2");
        udo2.inTypes = "i";
        udo2.outTypes = "i";
        udo2.codeBody = "code";

        assertEquals("test1", list.getNameOfEquivalentCopy(udo2));

        assertNull(list.getNameOfEquivalentCopy(null));

        udo2.codeBody = "code2";

        assertNull(list.getNameOfEquivalentCopy(udo2));

        udo2.codeBody = "code";
        udo2.inTypes = "k";

        assertNull(list.getNameOfEquivalentCopy(udo2));

        udo2.inTypes = "i";
        udo2.outTypes = "k";

        assertNull(list.getNameOfEquivalentCopy(udo2));
    }

    @Test
    void testGetNameOfExistingModernCopy() {
        OpcodeList list = new OpcodeList();

        UserDefinedOpcode udo1 = new UserDefinedOpcode();
        udo1.style = UDOStyle.MODERN;
        udo1.setOpcodeName("testModern1");
        udo1.inputArguments = "aSig, kDrive";
        udo1.outTypes = "a";
        udo1.codeBody = "aOut = tanh(aSig * kDrive)\nxout aOut";

        list.addOpcode(udo1);

        UserDefinedOpcode udo2 = new UserDefinedOpcode();
        udo2.style = UDOStyle.MODERN;
        udo2.setOpcodeName("testModern2");
        udo2.inputArguments = "aSig, kDrive";
        udo2.outTypes = "a";
        udo2.codeBody = "aOut = tanh(aSig * kDrive)\nxout aOut";

        assertEquals("testModern1", list.getNameOfEquivalentCopy(udo2));

        udo2.inputArguments = "aSig, kOther";
        assertNull(list.getNameOfEquivalentCopy(udo2));
    }

    @Test
    void testLegacyXmlDefaultsToClassicStyle() {
        Element xml = new Element("udo");
        xml.addElement("opcodeName").setText("legacyOpcode");
        xml.addElement("outTypes").setText("a");
        xml.addElement("inTypes").setText("ak");
        xml.addElement("codeBody").setText("aOut = aSig\nxout aOut");
        xml.addElement("comments").setText("legacy");

        UserDefinedOpcode udo = UserDefinedOpcode.loadFromXML(xml);

        assertEquals(UDOStyle.CLASSIC, udo.style);
        assertEquals("legacyOpcode", udo.getOpcodeName());
        assertEquals("ak", udo.inTypes);
        assertEquals("a", udo.outTypes);
    }

}
