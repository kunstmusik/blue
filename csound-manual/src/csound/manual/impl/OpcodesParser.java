/*
 * blue - object composition environment for csound
 * Copyright (C) 2012
 * Steven Yi <stevenyi@gmail.com>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 59 Temple Place - Suite 330, Boston, MA  02111-1307, USA.
 */
package csound.manual.impl;

import csound.manual.OpcodeDoc;
import csound.manual.OpcodeDocCategory;
import java.io.IOException;
import java.util.Stack;
import java.util.logging.Level;
import java.util.logging.Logger;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.parsers.SAXParser;
import javax.xml.parsers.SAXParserFactory;
import org.xml.sax.Attributes;
import org.xml.sax.SAXException;
import org.xml.sax.helpers.DefaultHandler;

/**
 *
 * @author stevenyi
 */
public class OpcodesParser extends DefaultHandler {

    Stack<OpcodeDocCategory> categories = new Stack<OpcodeDocCategory>();    
    OpcodeDoc currentOpcode = null;
    String currentValue = null;
    
    private OpcodesParser() {
        OpcodeDocCategory root = new OpcodeDocCategory();
        root.categoryName = "opcodes";
        categories.add(root);
    }
    
    public static OpcodeDocCategory loadOpcodesXML() {
        OpcodesParser opParser = new OpcodesParser();
        try {
            SAXParser parser = SAXParserFactory.newInstance().newSAXParser();
            parser.parse(OpcodesParser.class.getResourceAsStream("opcodes.xml"),
                    opParser);
        } catch (IOException ex) {
            Logger.getLogger(OpcodesParser.class.getName()).log(Level.SEVERE,
                    null, ex);
        } catch (ParserConfigurationException ex) {
            Logger.getLogger(OpcodesParser.class.getName()).log(Level.SEVERE,
                    null, ex);
        } catch (SAXException ex) {
            Logger.getLogger(OpcodesParser.class.getName()).log(Level.SEVERE,
                    null, ex);
        }
        return opParser.categories.pop();
    }

    @Override
    public void startElement(String uri, String localName, String qName, Attributes atts) throws SAXException {
        if("opcodeGroup".equals(qName)) {
            OpcodeDocCategory cat = new OpcodeDocCategory();
            cat.categoryName = atts.getValue("name");
            categories.peek().subGroups.add(cat);
            categories.push(cat);
        } else if ("opcode".equals(qName)) {
            currentOpcode = new OpcodeDoc();
        }
    }

    @Override
    public void endElement(String uri, String localName, String qName) throws SAXException {
        if("opcodeGroup".equals(qName)) {
            categories.pop();
        } else if ("opcode".equals(qName)) {
            categories.peek().opcodes.add(currentOpcode);
            currentOpcode = null;
        } else if("name".equals(qName)) {
            currentOpcode.opcodeName = currentValue;
        } else if("signature".equals(qName)) {
            currentOpcode.signature = currentValue;
        }
    }

    @Override
    public void characters(char[] ch, int start, int length) throws SAXException {
        currentValue = new String(ch, start, length).trim();
    }
}
