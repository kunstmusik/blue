package blue.noteProcessor;

import blue.utility.ObjectUtilities;
import electric.xml.Element;
import electric.xml.Elements;
import java.util.ArrayList;

/**
 * Title: blue Description: an object composition environment for csound
 * Copyright: Copyright (c) 2001 Company: steven yi music
 *
 * @author steven yi
 * @version 1.0
 */
public class NoteProcessorChain extends ArrayList<NoteProcessor> {

    public NoteProcessorChain() {
        super();
    }

    public NoteProcessorChain(NoteProcessorChain npc) {
        for (NoteProcessor np : npc) {
            add(np.deepCopy());
        }
    }

    public static NoteProcessorChain loadFromXML(Element data) throws Exception {
        NoteProcessorChain npc = new NoteProcessorChain();

        Elements nProcNodes = data.getElements("noteProcessor");

        while (nProcNodes.hasMoreElements()) {
            Element elem = nProcNodes.next();

            Object obj = ObjectUtilities.loadFromXML(elem);
            npc.add((NoteProcessor)obj);
        }

        return npc;
    }

    public Element saveAsXML() {
        Element retVal = new Element("noteProcessorChain");

        for (NoteProcessor np : this) {
            retVal.addElement(np.saveAsXML());
        }

        return retVal;
    }
}
