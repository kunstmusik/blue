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
package blue.noteProcessor;

import java.util.HashMap;
import java.util.Iterator;

import electric.xml.Element;
import electric.xml.Elements;

/**
 * @author steven
 */
public class NoteProcessorChainMap extends HashMap {

    public NoteProcessorChain getNoteProcessorChain(Object key) {
        return (NoteProcessorChain) get(key);
    }

    public static NoteProcessorChainMap loadFromXML(Element data)
            throws Exception {
        NoteProcessorChainMap map = new NoteProcessorChainMap();

        Elements npcNodes = data.getElements("npc");

        while (npcNodes.hasMoreElements()) {
            Element elem = npcNodes.next();

            String name = elem.getAttributeValue("name");
            NoteProcessorChain npc = NoteProcessorChain.loadFromXML(elem
                    .getElement("noteProcessorChain"));

            map.put(name, npc);
        }

        return map;
    }

    public Element saveAsXML() {
        Element retVal = new Element("noteProcessorChainMap");

        for (Iterator iter = this.keySet().iterator(); iter.hasNext();) {
            String name = (String) iter.next();
            NoteProcessorChain npc = this.getNoteProcessorChain(name);

            Element npcNode = new Element("npc");
            npcNode.setAttribute("name", name);

            npcNode.addElement(npc.saveAsXML());

            retVal.addElement(npcNode);
        }

        return retVal;
    }
}